# LaTeX → PDF in WASM — compile spike (§8.1)

Throwaway spike for `LATEX_EDITOR_PLAN.md` Phase 0: prove that LaTeX compiles to PDF
entirely in the browser, and measure cold-start + compile time, before building the editor.

## Engine & license (Path 1, MIT-clean)

- Engine: **upstream `busytex/busytex`** WASM build — **TeX Live 2023**, emscripten 3.1.43.
- The busytex `.js` glue (`busytex_pipeline.js`, `busytex_worker.js`) is **MIT**; the
  compiled `busytex.wasm` and `texlive-*.data` bundles carry TeX Live / LPPL (permissive)
  licenses. This is clean to redistribute from an MIT project.
- We deliberately do **not** use TeXlyre's TeX Live 2026 build (`texlyre-busytex`), which is
  **AGPL-3.0**. See `LATEX_EDITOR_PLAN.md` §0.
- `main.js` is **our own** thin loader around the MIT worker — no TeXlyre source is used.

## Run it

```sh
./download-assets.sh     # ~135 MB from busytex GitHub releases (needs gh, authed)
node serve.mjs           # http://localhost:8099  (sets COOP/COEP)
```

Open http://localhost:8099 and click **Compile sample**. The left pane streams the TeX log;
the right pane renders the produced PDF; the header shows cold-start / compile / total ms.

## What it does

- `vendor/busytex_worker.js` (MIT) runs the engine in a Web Worker.
- `main.js` initializes the pipeline, then compiles `sample/main.tex` with the
  `pdftex_bibtex8` driver against the `texlive-basic` bundle.
- PDF bytes come back as a `Uint8Array` and are shown via a blob URL in an `<iframe>`.

## Findings (headless Chrome, localhost, assets warm in HTTP cache)

Verified end-to-end with `run-headless.mjs` — `sample/main.tex` (article + amsmath,
graphicx, hyperref) compiles to a 121.6 KB PDF, `exit_code 0`, rendered in the iframe
(see `out.png`, `out.pdf`):

- **Engine cold-start** (worker spawn → pipeline initialized): **~1.5–1.8 s**.
- **Compile** (hello-world, single pdflatex pass): **~0.4 s**.
- **Total**: **~1.9–2.2 s**.
- All three `\usepackage`s resolved from the **`texlive-basic`** bundle — no missing packages.
- Engine + basic bundle transfer size: `busytex.wasm` ≈ 29 MB, `texlive-basic.data` ≈ 100 MB
  (one-time download; cached thereafter). This is the real cost to manage in production.
- A single benign `404` appears in logs — the browser's automatic `favicon.ico`, unrelated
  to compilation.
- SyncTeX: busytex supports it; not exercised in this spike.

**Verdict: GO.** In-browser LaTeX compilation is fast and correct for the editor preview.
The dominant cost is the ~130 MB one-time asset download, which productionization must
lazy-load + cache (IndexedDB / service worker), not the compile itself.

## Notes for productionization (not this spike)

- 100 MB+ data bundle ⇒ lazy-load only when the editor opens; cache in IndexedDB / SW.
- Decide bundle granularity (`basic` vs `latex-recommended`/`extra`) vs a package proxy.
- Replace the iframe with the app's pdf.js viewer; wire the FS seed to `getProjectContents`.
