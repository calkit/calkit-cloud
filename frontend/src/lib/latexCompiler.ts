// Thin client-side wrapper around the (MIT) busytex WASM worker for in-browser
// LaTeX compilation. This is our own loader (Path 1) — no TeXlyre code. The
// engine binaries are served from VITE_TEX_ENGINE_URL (default same-origin
// /tex). Compilation is preview-only; see LATEX_EDITOR_PLAN.md §3.1.

export interface LatexFile {
  path: string
  contents: string | Uint8Array | null
}

export interface CompileResult {
  pdf: Uint8Array | null
  log: string
  exitCode: number
}

// busytex drivers: pdftex_bibtex8 | xetex_bibtex8_dvipdfmx | luahbtex_bibtex8
const DRIVER = "pdftex_bibtex8"
// Eagerly loaded base filesystem.
const PRELOAD_PACKAGES = ["texlive-basic.js"]
// All available bundles; the engine resolves \usepackage names against these
// and loads the needed .data on demand. Bundles are a subset of full TeX Live;
// anything absent (e.g. sectsty, revtex) is fetched on demand from the texmf
// proxy by the patched engine when VITE_TEXMF_PROXY is set. See
// spikes/busytex-remote-fetch and LATEX_EDITOR_PLAN.md.
const DATA_PACKAGES = [
  "texlive-basic.js",
  "ubuntu-texlive-latex-base.js",
  "ubuntu-texlive-latex-recommended.js",
  "ubuntu-texlive-latex-extra.js",
  "ubuntu-texlive-science.js",
  "ubuntu-texlive-fonts-recommended.js",
]

const ENGINE_BASE = (import.meta.env.VITE_TEX_ENGINE_URL || "/tex").replace(
  /\/$/,
  "",
)

// Bump when the engine binaries or worker glue change. The ~30 MB busytex.wasm
// is aggressively cached by the browser; without a version query, a rebuilt
// engine (e.g. the remote-fetch/font patches) won't be picked up until a hard
// refresh. Appended to the worker + engine URLs to bust the HTTP cache.
const ENGINE_VERSION = "2026-07-02-remote-fetch"
const V = `?v=${ENGINE_VERSION}`

// Self-hosted texmf proxy. When set, the patched busytex engine fetches any TeX
// file missing from the bundled subset on demand (one compile, exact filenames),
// giving full TeX Live coverage. Empty => engine falls back to stock behaviour
// (missing package => friendly error). See spikes/busytex-remote-fetch.
const TEXMF_PROXY = (import.meta.env.VITE_TEXMF_PROXY || "").replace(/\/$/, "")

type Pending = {
  resolve: (r: CompileResult) => void
  reject: (e: Error) => void
}

// Pull "File `foo.sty' not found" package names out of a TeX log so the UI can
// explain that a package isn't in the in-browser bundle.
export function findMissingPackages(log: string): string[] {
  const out = new Set<string>()
  const re = /File `([^']+\.(?:sty|cls))' not found/g
  let m = re.exec(log)
  while (m !== null) {
    out.add(m[1])
    m = re.exec(log)
  }
  return [...out]
}

export class LatexCompiler {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private pending: Pending | null = null
  private onLog?: (line: string) => void

  constructor(opts: { onLog?: (line: string) => void } = {}) {
    this.onLog = opts.onLog
  }

  // Lazily spin up the worker and wait for the engine to initialize.
  init(): Promise<void> {
    if (this.ready) {
      return this.ready
    }
    this.ready = new Promise<void>((resolve, reject) => {
      const worker = new Worker(`${ENGINE_BASE}/busytex_worker.js${V}`)
      this.worker = worker
      worker.onmessage = ({ data }) => {
        if (data.print !== undefined) {
          this.onLog?.(data.print)
          return
        }
        if (data.initialized !== undefined) {
          resolve()
          return
        }
        if (data.exception !== undefined) {
          const err = new Error(data.exception)
          if (this.pending) {
            this.pending.reject(err)
            this.pending = null
          } else {
            reject(err)
          }
          return
        }
        // Otherwise: a compile result.
        if (this.pending) {
          this.pending.resolve({
            pdf: data.pdf ?? null,
            log: data.log ?? "",
            exitCode: data.exit_code ?? -1,
          })
          this.pending = null
        }
      }
      worker.onerror = (e) => {
        const err = new Error(`Engine worker error: ${e.message}`)
        if (this.pending) {
          this.pending.reject(err)
          this.pending = null
        } else {
          reject(err)
        }
      }
      // Data-package and wasm paths are resolved relative to the worker's
      // location unless absolute, so pass absolute engine URLs.
      worker.postMessage({
        busytex_wasm: `${ENGINE_BASE}/busytex.wasm${V}`,
        busytex_js: `${ENGINE_BASE}/busytex.js${V}`,
        preload_data_packages_js: PRELOAD_PACKAGES.map(
          (p) => `${ENGINE_BASE}/${p}`,
        ),
        data_packages_js: DATA_PACKAGES.map((p) => `${ENGINE_BASE}/${p}`),
        texmf_local: [],
        preload: true,
        calkit_texmf_endpoint: TEXMF_PROXY,
      })
    })
    return this.ready
  }

  async compile(
    files: LatexFile[],
    mainTexPath: string,
  ): Promise<CompileResult> {
    await this.init()
    if (this.pending) {
      throw new Error("A compilation is already in progress")
    }
    return new Promise<CompileResult>((resolve, reject) => {
      this.pending = { resolve, reject }
      this.worker?.postMessage({
        files,
        main_tex_path: mainTexPath,
        // Force a single pdflatex pass. The bibtex multi-pass reuses one WASM
        // module instance, which makes pdftex assert on the 2nd run
        // (pdfinitmapfile). Single-pass means a preview always renders;
        // bibliography citations stay unresolved until we have a build that
        // supports multi-pass (or per-pass module recreation). Preview-only.
        bibtex: false,
        verbose: "silent",
        driver: DRIVER,
        data_packages_js: DATA_PACKAGES.map((p) => `${ENGINE_BASE}/${p}`),
      })
    })
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    this.pending = null
  }
}
