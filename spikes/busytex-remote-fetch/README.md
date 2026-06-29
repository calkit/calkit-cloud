# Scaffold: busytex + in-engine remote-fetch (kpathsea) hook

The licensing-clean path from the package-proxy spike (`../latex-package-proxy/`):
patch **busytex** (MIT, TeX Live 2023) with our **own** kpathsea hook so the WASM
engine fetches missing `.cls`/`.sty`/etc. on demand from a self-hosted texmf
proxy — in **one** compile, with exact filenames and no log-parsing. SwiftLaTeX's
engine has this hook but is **AGPL-3.0**; this is a clean-room reimplementation,
so the result stays MIT.

## Files

| File | What it is | Status |
|---|---|---|
| `tex-file.patch` | kpathsea patch: on a local miss in `kpathsea_find_file`, call `kpse_remote_fetch()` | reference diff |
| `apply_patch.py` | robust inserter for the patch (matches the function, survives line drift) | **validated** against real TeX Live 2023 kpathsea |
| `remote_fetch.c` | the `kpse_remote_fetch` EM_JS hook: sync-XHR a file from the proxy into MEMFS, return its path | written, not yet built |
| `build.sh` | clone busytex → patch → add glue → extend Emscripten exports → build the wasm | **scaffold** (build not run here) |

## How it works

1. TeX asks kpathsea for a file (e.g. `revtex4-1.cls`). The normal local search
   (`kpathsea_find_file` → `kpathsea_find_file_generic`) returns `NULL` because
   it's not in the bundled texmf.
2. The patch calls `kpse_remote_fetch(name, format)`.
3. `remote_fetch.c` (EM_JS) does a **synchronous** `XMLHttpRequest` to
   `Module.calkitTexmfEndpoint + "/f/<name>"`, writes the bytes into MEMFS at
   `/calkit-remote/<name>`, and returns that path. Sync XHR is allowed because
   busytex runs in a Web Worker → **no Asyncify needed**. Hits and misses are
   cached on `Module.__calkitCache` so `\IfFileExists` probes don't spam the
   proxy.
4. kpathsea returns the path; TeX opens it and continues. One compile.

## Build (needs the busytex toolchain; multi-hour TeX Live compile)

```sh
# deps: wget cmake gperf p7zip-full emscripten python3
./build.sh            # -> build/wasm/busytex.{js,wasm} under the work dir
```

`build.sh` is grounded in busytex's real Makefile (TeX Live 2023 source;
kpathsea at `texk/kpathsea/tex-file.c`; final link `OPTS_BUSYTEX_LINK_wasm` with
`EXPORTED_RUNTIME_METHODS=[…,"FS",…]`). The one step to **confirm on first run**
is the TeX Live *unpack* target name (`make source/texlive`) — find it with
`make -pn | grep texlive`.

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
