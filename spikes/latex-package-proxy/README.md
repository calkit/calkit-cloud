# Spike: LaTeX package proxy (on-demand TeX file fetching)

**Question:** busytex only ships a *subset* of TeX Live, so real papers using
packages/classes it doesn't bundle (e.g. `sectsty`, and journal classes like
`aastex631`→`revtex4-1`) fail with no fix. Can we fetch missing files on demand
so they compile?

**Answer: yes, the concept works — but the *delivery mechanism* matters.**

## What's here

- `proxy-server.py` — a **texmf file proxy** (the [Texlive-Ondemand](https://github.com/SwiftLaTeX/Texlive-Ondemand)
  model). `GET /f/<name>` resolves a file by name via `kpsewhich` inside a
  full-TeX-Live container and returns its bytes; `GET /dir/<name>` lists the
  sibling files in that file's package directory. CORS-open.
- `run-spike.mjs` — drives the real busytex worker in a headless browser:
  load `petebachant/boom-paper`, then loop **compile → scan the TeX log for
  missing files → fetch them from the proxy → inject into the FS → recompile**.

## Run it

```sh
docker run -d --name tl-proxy --entrypoint /bin/sh texlive/texlive:latest-full -c "sleep infinity"
python3 proxy-server.py &              # texmf proxy on :8771
# dev frontend must be up (serves /tex busytex assets)
node run-spike.mjs                     # iterative compile against boom-paper
```

## Findings

1. **The texmf proxy works perfectly.** A full TeX Live + `kpsewhich` resolves
   any file by name (`revtex4-1.cls`, `sectsty.sty`, `pgfsys-pdftex.def`, …).
   The public `texlive.swiftlatex.com` server is **dead** (DNS gone), so this
   must be **self-hosted** — which is cheap (one container + a tiny endpoint).
2. **On-demand fetching resolves real, deep dependency trees.** Starting from
   "aastex emulates revtex → no output", the iterative loop auto-fetched
   **~94 files** — `revtex4-1.cls` + its 8 society `.rtx` files, then the entire
   `tikz`/`pgf` core — driving boom-paper from zero output deep into a real
   compile. So busytex *can* compile these papers once the files are present.
3. **The iterative log-parsing approach is the wrong delivery mechanism**, for
   two reasons it surfaced concretely:
   - **O(N) recompiles.** One recompile per missing file. boom-paper needs
     100+ files ⇒ 100+ recompiles ⇒ minutes. Unusable interactively.
   - **Error-format whack-a-mole.** TeX announces missing files many ways:
     `File \`x' not found`, `Driver file \`\`x''`, `\usepgflibrary{...}`,
     interactive `Enter file name:` prompts, etc. Each needs bespoke parsing;
     the loop got stuck on a pgf *library* file whose name isn't in the log.

## Recommendation

Adopt the proxy, but deliver files via an **in-engine kpathsea hook**, **not**
log-parsing: when kpathsea can't find a file, the WASM engine calls back to JS
with the **exact** filename + format; JS synchronously fetches it from the
**self-hosted texmf proxy** and returns it; the engine continues. **One compile,
exact names, no log parsing** — fixes both the O(N) recompiles and the
brittleness. (Sync-fetch-from-WASM is done via a synchronous XHR in the worker,
as SwiftLaTeX does, or Emscripten Asyncify.)

Two ways to get that hook — assessed:

### Path A — use SwiftLaTeX's engine (it already has the hook). ❌ Rejected.
- **AGPL-3.0 blocker.** SwiftLaTeX's LICENSE is GNU **AGPL-3.0**, and the
  kpathsea-remote hook *is* their AGPL contribution. Using their engine in our
  **MIT** editor triggers AGPL's network copyleft — a hosted SaaS built on it
  must release its source under AGPL. Contradicts §0 (Path 1) and Calkit's MIT.
- Also older (**TeX Live 2020**), no npm package (WASM via GitHub releases,
  last tagged 2022), uncertain maintenance.

### Path B — patch busytex with our own MIT hook. ✅ Recommended.
- busytex is **MIT** (code) + permissive/LPPL TeX Live binaries, **TeX Live
  2023**, and already builds via a Makefile + Emscripten with source patches
  (`fontconfig_emcc.patch`). We write a **clean-room** kpathsea patch (SwiftLaTeX
  is a reference for the *technique*, not the code) → result stays MIT.
- **Work:** stand up the busytex build (Emscripten + cmake + p7zip, Docker,
  multi-hour TeX Live compile) → add a focused kpathsea patch that, on a miss,
  calls a JS callback that sync-fetches from our proxy into MEMFS and retries →
  rebuild the ~30 MB wasm. The build infra is the main lift; the patch itself is
  small and well-understood.
- **Pure-JS FS hooks are *not* enough:** kpathsea decides a file is absent
  *before* `fopen` (it searches its db/dirs), so the search logic itself must be
  patched — hence a rebuild, not just an Emscripten `FS` override.

### Pragmatic fallback — server-side compile with full TeX Live.
For the heaviest papers, a **backend compile** (full TeX Live, no proxy needed —
the server has everything) is the simplest coverage. Cost: per-session server
compute (the thing WASM avoided), so keep it opt-in / for "export-quality"
builds. Dovetails with §3.1's "provenance-perfect builds with user compute".

### The texmf proxy (either path / fallback)
`texlive/texlive` + a `kpsewhich`-backed endpoint, hosted by us (CORS-controlled,
cache aggressively, pin a TeX Live version). Cheap and ours. For Path B, expose
the protocol the patched engine expects (SwiftLaTeX uses `/pdftex/<format>/<name>`).

**Net:** coverage is solvable and the file source is trivial. The decision is
**patch busytex for an MIT in-engine hook** (Path B); SwiftLaTeX's engine is out
on AGPL. The remaining work is a one-time engine build — bounded, not open-ended.
