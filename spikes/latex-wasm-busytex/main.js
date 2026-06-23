// Spike orchestrator: load the MIT busytex worker, compile sample/main.tex to PDF
// entirely in the browser, render it, and report timings. This is OUR OWN thin loader
// (Path 1) around the busytex MIT worker/pipeline glue — no TeXlyre code involved.

const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const metricsEl = document.getElementById('metrics');
const frame = document.getElementById('pdf');
const runBtn = document.getElementById('run');

const now = () => performance.now();
const ms = (a, b) => `${Math.round(b - a)} ms`;

function log(line) {
  logEl.textContent += line + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(s) { statusEl.textContent = s; }

// busytex driver options: pdftex_bibtex8 | xetex_bibtex8_dvipdfmx | luahbtex_bibtex8 | luatex_bibtex8
const DRIVER = 'pdftex_bibtex8';
const DATA_PACKAGES = ['texlive-basic.js']; // base TeX Live 2023 filesystem

let worker;
let tWorkerStart, tInitialized, tCompileStart;

async function main() {
  runBtn.disabled = true;
  logEl.textContent = '';
  metricsEl.textContent = '';
  frame.removeAttribute('src');
  setStatus('loading engine…');

  const texSource = await (await fetch('sample/main.tex')).text();

  tWorkerStart = now();
  // Worker lives in vendor/ so its importScripts('busytex_pipeline.js') and the
  // bare asset filenames below all resolve relative to vendor/.
  worker = new Worker('vendor/busytex_worker.js');

  worker.onmessage = ({ data }) => {
    if (data.print !== undefined) { log(data.print); return; }

    if (data.initialized !== undefined) {
      tInitialized = now();
      setStatus('engine ready — compiling…');
      log(`\n=== engine initialized in ${ms(tWorkerStart, tInitialized)} ===`);
      log('applet versions: ' + JSON.stringify(data.initialized) + '\n');
      tCompileStart = now();
      worker.postMessage({
        files: [{ path: 'main.tex', contents: texSource }],
        main_tex_path: 'main.tex',
        bibtex: null,          // auto-detect; sample has no bibliography -> single pdflatex pass
        verbose: 'silent',
        driver: DRIVER,
        data_packages_js: DATA_PACKAGES,
      });
      return;
    }

    if (data.exception !== undefined) {
      setStatus('FAILED');
      log('\n!!! EXCEPTION:\n' + data.exception);
      runBtn.disabled = false;
      return;
    }

    // Otherwise: the compile result {pdf, log, exit_code, logs}
    const tDone = now();
    const ok = data.exit_code === 0 && data.pdf;
    setStatus(ok ? 'compiled ✓' : `compile failed (exit ${data.exit_code})`);
    metricsEl.innerHTML = [
      `engine cold-start: <b>${ms(tWorkerStart, tInitialized)}</b>`,
      `compile: <b>${ms(tCompileStart, tDone)}</b>`,
      `total: <b>${ms(tWorkerStart, tDone)}</b>`,
      `pdf size: <b>${data.pdf ? (data.pdf.byteLength / 1024).toFixed(1) + ' KB' : 'none'}</b>`,
    ].join(' &nbsp;|&nbsp; ');

    if (ok) {
      const blob = new Blob([data.pdf], { type: 'application/pdf' });
      frame.src = URL.createObjectURL(blob);
    } else {
      log('\n=== compile log ===\n' + (data.log || '(no log)'));
    }
    runBtn.disabled = false;
    worker.terminate();
  };

  worker.onerror = (e) => {
    setStatus('worker error');
    log(`\n!!! worker error: ${e.message} @ ${e.filename}:${e.lineno}`);
    runBtn.disabled = false;
  };

  // Initialize the pipeline (paths are relative to the worker's vendor/ dir).
  worker.postMessage({
    busytex_wasm: 'busytex.wasm',
    busytex_js: 'busytex.js',
    preload_data_packages_js: DATA_PACKAGES,
    data_packages_js: DATA_PACKAGES,
    texmf_local: [],
    preload: true,
  });
}

runBtn.addEventListener('click', main);
