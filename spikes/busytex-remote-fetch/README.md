# Scaffold: busytex + in-engine remote-fetch (kpathsea) hook

The licensing-clean path from the package-proxy spike (`../latex-package-proxy/`):
patch **busytex** (MIT, TeX Live 2023) with our **own** kpathsea hook so the WASM
engine fetches missing `.cls`/`.sty`/etc. on demand from a self-hosted texmf
proxy — in **one** compile, with exact filenames and no log-parsing. SwiftLaTeX's
engine has this hook but is **AGPL-3.0**; this is a clean-room reimplementation,
so the result stays MIT.

## Status: BUILT ✅

`build.sh` ran green under `emscripten/emsdk:3.1.43` and produced a working
engine — **`busytex.js` (~297 KB) + `busytex.wasm` (~30 MB)** — with our hook
embedded (`calkitTexmfEndpoint` / `__calkitCache` in the JS, `_malloc` /
`stringToUTF8` / `lengthBytesUTF8` / `UTF8ToString` exported). Remaining:
copy the binaries into `frontend/public/tex/`, set `Module.calkitTexmfEndpoint`,
and test end-to-end against boom-paper (single-pass on-demand fetch).

## Design: pure-C kpathsea + EM_JS only in the engine

The hook is split in two so **every** binary links, not just the engine:

- **kpathsea stays pure C.** `apply_patch.py` adds, in `tex-file.c`: (1) the
  call inside `kpathsea_find_file` on a local miss, and (2) a real, always-defined
  `kpse_remote_fetch` that just delegates through a function pointer
  `kpse_remote_fetch_hook` (default `NULL`). No EM_JS here.
- **The browser fetch (EM_JS) lives only in `busytex.c`** (`remote_fetch.c` is
  appended to it), and a `constructor` installs it into the hook pointer at
  engine startup.

Why: `EM_JS` makes a symbol a JS *import*. busytex builds ~6 **standalone applet
executables** (kpsewhich, bibtex8, …) whose link steps pull in `libkpathsea` and
**reject** a JS-import symbol. Keeping kpathsea pure C makes `kpse_remote_fetch`
a real defined wasm symbol everywhere; the applets get a NULL-pointer no-op
(stock behaviour), and only the engine carries the fetch. This was the crux —
an earlier `#include "remote_fetch.c"` into `busytex.c` (def only in the engine)
and a later EM_JS-in-kpathsea both failed applet links; the indirection fixes it.

## Files

| File | What it is | Status |
|---|---|---|
| `apply_patch.py` | kpathsea patch: call site + pure-C hook-pointer indirection in `tex-file.c` | **validated**, idempotent; produced the built engine |
| `remote_fetch.c` | engine-side EM_JS fetch + constructor (appended to `busytex.c`) | **built into the engine** |
| `build.sh` | clone busytex → download-native → unpack → patch → append hook → extend exports → `make wasm` | **ran green** |
| `tex-file.patch` | reference call-site diff (human-readable); `apply_patch.py` is authoritative | reference only |

## How it works

1. TeX asks kpathsea for a file (e.g. `revtex4-1.cls`). The normal local search
   (`kpathsea_find_file` → `kpathsea_find_file_generic`) returns `NULL` because
   it's not in the bundled texmf.
2. The patched `kpathsea_find_file` calls `kpse_remote_fetch(name, format)`,
   which delegates to `kpse_remote_fetch_hook` (installed by the engine).
3. The engine hook (EM_JS) does a **synchronous** `XMLHttpRequest` to
   `Module.calkitTexmfEndpoint + "/f/<name>"`, writes the bytes into MEMFS at
   `/calkit-remote/<name>`, and returns that path. Sync XHR is allowed because
   busytex runs in a Web Worker → **no Asyncify needed**. Hits and misses are
   cached on `Module.__calkitCache` so `\IfFileExists` probes don't spam the
   proxy.
4. kpathsea returns the path; TeX opens it and continues. One compile.

## Build (needs the busytex toolchain; multi-hour TeX Live compile)

```sh
# Inside the pinned Emscripten image (amd64):
docker run --rm --platform linux/amd64 \
  -v "$PWD:/scaffold:ro" -v /tmp/busytex-remote-build:/work \
  emscripten/emsdk:3.1.43 \
  bash -c 'SCAFFOLD=/scaffold /scaffold/build.sh /work'
# -> /tmp/busytex-remote-build/busytex/build/wasm/busytex.{js,wasm}
```

Notes learned the hard way: install `file` (needed by `make download-native`);
build via `make wasm` (not the final-link target alone — it needs the applet
prerequisites); and **redirect `make` output to a file** — piping its very large
output through `docker logs` can break the pipe (`make: write error: stdout`)
and abort an otherwise-successful build.

## Wiring into the frontend (after a successful build)

1. Replace the engine binaries in `frontend/public/tex/` with the patched
   `busytex.{js,wasm}` (keep the worker/pipeline glue).
2. In `frontend/src/lib/latexCompiler.ts`, set the endpoint on the worker before
   init, e.g. post `Module.calkitTexmfEndpoint = import.meta.env.VITE_TEXMF_PROXY`
   (or have the worker assign it onto `Module`).
3. **Delete the iterative loop idea entirely** — missing files now resolve inside
   a single `compile()`. The Phase-2 "Missing from the in-browser TeX bundle: X"
   message becomes a rare fallback (proxy 404 / offline).

## Texmf proxy (the server side)

Reuse `../latex-package-proxy/proxy-server.py` (a `kpsewhich`-backed
`texlive/texlive` container, `GET /f/<name>`). For production: host it ourselves,
CORS-restrict to the app origin, cache aggressively, pin a TeX Live version
(ideally 2023 to match the engine). Cheap and entirely ours.

## Open items before this ships

- Run the build; confirm the unpack target and that the EM_JS helpers
  (`stringToUTF8`, `lengthBytesUTF8`) aren't dead-code-eliminated (the export
  list in `build.sh` guards this).
- Verify on **boom-paper** end-to-end: expect a single compile, ~100 files
  pulled once, then cached.
- Decide proxy hosting + a TeX Live version pin; add an HTTP cache (CDN) in front.
- Path-qualified lookups: the hook handles basenames only; check whether any
  real lookups arrive path-qualified and extend if so.
