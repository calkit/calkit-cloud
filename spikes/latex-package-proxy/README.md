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

Adopt the proxy, but deliver files via an **in-engine kpathsea hook** (what
SwiftLaTeX does), **not** log-parsing:

- The WASM TeX engine, when kpathsea can't find a file, calls back to JS with
  the **exact** filename + format; JS fetches it from the **self-hosted texmf
  proxy** and returns it; the engine continues. **One compile, exact names, no
  log parsing** — fixing both the O(N)-recompiles and the brittleness.
- busytex has no such hook today → either **patch busytex's kpathsea** (as
  SwiftLaTeX did to its engine) or **switch to SwiftLaTeX's pdftex/xetex
  engine** (which already has the hook), pointed at our proxy. Engine licensing
  (§0) must be re-checked for whichever path.
- The proxy itself = `texlive/texlive` + a `kpsewhich`-backed endpoint, hosted
  by us (CORS-controlled). Cache aggressively; pin a TeX Live version.

Net: package coverage is **solvable** and the path is clear — the remaining work
is the in-engine hook, not the file source.
