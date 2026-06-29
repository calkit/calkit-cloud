// Spike: iterative package proxy. Load boom-paper, then loop:
//   compile (busytex) -> detect missing .cls/.sty in the log -> fetch from the
//   texmf proxy -> inject into the FS -> recompile, until it produces a PDF.
import pw from "/Users/pete/dev/calkit-cloud/frontend/node_modules/playwright-core/index.js"
const { chromium } = pw
const PROXY = "http://127.0.0.1:8771/f/"
const PROXY_DIR = "http://127.0.0.1:8771/dir/"
const ctx = await chromium.launchPersistentContext("/tmp/pp-prof", {
  channel: "chrome",
  headless: true,
  args: ["--disable-web-security"],
})
const page = await ctx.newPage()
await page.goto("http://localhost:5173/login", { waitUntil: "domcontentloaded" })

const result = await page.evaluate(async ({ PROXY, PROXY_DIR }) => {
  const BASE = "/tex"
  const DATA = [
    "texlive-basic.js",
    "ubuntu-texlive-latex-base.js",
    "ubuntu-texlive-latex-recommended.js",
    "ubuntu-texlive-latex-extra.js",
    "ubuntu-texlive-science.js",
    "ubuntu-texlive-fonts-recommended.js",
  ].map((p) => `${BASE}/${p}`)
  const API =
    "http://api.localhost/projects/petebachant/boom-paper/contents?path="
  const decode = (b) =>
    new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)))
  const toBytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
  const ext = (p) => {
    const i = p.lastIndexOf(".")
    return i < 0 ? "" : p.slice(i + 1).toLowerCase()
  }
  const TEXT = new Set(["tex", "bib", "cls", "sty", "bst", "def", "clo", "cfg"])
  const IMG = new Set(["png", "jpg", "jpeg", "pdf", "eps", "gif"])
  const get = async (p) =>
    (await fetch(API + encodeURIComponent(p))).json()

  const deps = [
    "paper/main.tex",
    "paper/references.bib",
    "paper/aasjournal.bst",
    "paper/aastex631.cls",
    "paper/results.tex",
    "paper/diagrams",
    "paper/figures",
  ]
  const files = []
  const seen = new Set()
  async function addFile(p) {
    if (seen.has(p)) return
    seen.add(p)
    const j = await get(p)
    if (TEXT.has(ext(p))) {
      const t = j.content
        ? decode(j.content)
        : j.url
          ? await (await fetch(j.url)).text()
          : ""
      files.push({ path: p, contents: t })
    } else {
      let bytes = null
      if (j.content) bytes = toBytes(j.content)
      else if (j.url)
        bytes = new Uint8Array(await (await fetch(j.url)).arrayBuffer())
      if (bytes) files.push({ path: p, contents: bytes })
    }
  }
  for (const d of deps) {
    if (d.startsWith(".")) continue
    const j = await get(d)
    if (j.type === "dir") {
      for (const it of j.dir_items || [])
        if (it.type !== "dir" && (TEXT.has(ext(it.name)) || IMG.has(ext(it.name))))
          await addFile(it.path)
    } else if (TEXT.has(ext(d)) || IMG.has(ext(d))) await addFile(d)
  }
  const mainPath = "paper/main.tex"
  const mainDir = "paper"

  const w = new Worker(`${BASE}/busytex_worker.js`)
  await new Promise((res) => {
    const h = ({ data }) => {
      if (data.initialized !== undefined) {
        w.removeEventListener("message", h)
        res()
      }
    }
    w.addEventListener("message", h)
    w.postMessage({
      busytex_wasm: `${BASE}/busytex.wasm`,
      busytex_js: `${BASE}/busytex.js`,
      preload_data_packages_js: [`${BASE}/texlive-basic.js`],
      data_packages_js: DATA,
      texmf_local: [],
      preload: true,
    })
  })
  const compile = () =>
    new Promise((res) => {
      const prints = []
      w.onmessage = ({ data }) => {
        if (data.print !== undefined) {
          prints.push(data.print)
          return
        }
        if (data.initialized !== undefined) return
        if (data.exception !== undefined)
          res({ exception: String(data.exception).slice(0, 120), log: prints.join("\n") })
        else if (data.exit_code !== undefined)
          res({
            exit: data.exit_code,
            bytes: data.pdf ? data.pdf.byteLength : 0,
            // The full TeX log is in the result (`data.log`); `print` messages
            // are suppressed in silent mode.
            log: data.log || prints.join("\n"),
          })
      }
      w.postMessage({
        files: [...files],
        main_tex_path: mainPath,
        bibtex: false,
        verbose: "silent",
        driver: "pdftex_bibtex8",
        data_packages_js: DATA,
      })
    })
  // Extract any TeX file token from lines that look like errors — TeX reports
  // missing files in many formats (File `x' not found, Driver file ``x'',
  // Enter file name, etc.), so be liberal rather than match each format.
  const FILE_RE =
    /[`'"( ]([\w.-]+\.(?:sty|cls|def|clo|cfg|rtx|fd|ldf|enc|tex))\b/g
  function findMissing(log) {
    const out = new Set()
    // aastex-style "...include `revtex4-1.cls'" (a warning, no "not found")
    const inc = /include `?([\w.-]+\.(?:cls|sty))'?/g
    let m
    while ((m = inc.exec(log)) !== null) out.add(m[1])
    // any file token on an error-ish line (covers "Driver file ``x''", etc.)
    for (const line of log.split("\n")) {
      if (!/not found|Error|Emergency|can't find|cannot/i.test(line)) continue
      FILE_RE.lastIndex = 0
      let mm
      while ((mm = FILE_RE.exec(line)) !== null) out.add(mm[1])
    }
    // Never try to re-fetch the document's own files.
    return [...out].filter(
      (n) => !/^main\.(tex|log|aux|out|toc|bbl|blg|nav|snm)$/i.test(n),
    )
  }

  const fetched = []
  const log = []
  let r
  for (let iter = 1; iter <= 80; iter++) {
    r = await compile()
    if (r.bytes > 0) {
      log.push(`iter ${iter}: SUCCESS, ${r.bytes} bytes`)
      break
    }
    const missing = findMissing(r.log || "").filter((n) => !fetched.includes(n))
    if (missing.length === 0) {
      log.push(`iter ${iter}: stuck (exit ${r.exit}, no new missing files)`)
      break
    }
    const got = []
    const grab = async (n) => {
      if (fetched.includes(n)) return
      fetched.push(n)
      try {
        const resp = await fetch(PROXY + encodeURIComponent(n))
        if (resp.status === 200) {
          files.push({ path: `${mainDir}/${n}`, contents: await resp.text() })
          got.push(n)
        }
      } catch {}
    }
    for (const name of missing) {
      await grab(name)
      // Deep deps: a class/style pulls in sibling files (e.g. revtex's .rtx
      // society files) that TeX requests with formats my regex can't name.
      if (/\.(cls|sty)$/i.test(name)) {
        try {
          const sibs = await (
            await fetch(`${PROXY_DIR}${encodeURIComponent(name)}`)
          ).json()
          for (const sib of sibs)
            if (/\.(cls|sty|rtx|clo|def|cfg|fd|ltx)$/i.test(sib)) await grab(sib)
        } catch {}
      }
    }
    log.push(`iter ${iter}: missing [${missing.join(", ")}] -> fetched [${got.join(", ")}]`)
    if (got.length === 0) break
  }
  return {
    progress: log,
    fetchedCount: fetched.length,
    fetched,
    final: { exit: r.exit, bytes: r.bytes, exception: r.exception },
    lastLogTail: (r.log || "").split("\n").filter((l) => l.trim()).slice(-12),
  }
}, { PROXY, PROXY_DIR })

console.log(JSON.stringify(result, null, 2))
await ctx.close()
