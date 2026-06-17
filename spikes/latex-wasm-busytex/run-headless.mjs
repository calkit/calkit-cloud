// Headless driver for the spike: loads the page, clicks Compile, waits for the
// result, prints metrics + a PDF artifact. Uses the frontend's playwright + system Chrome.
import pw from '/Users/pete/dev/calkit-cloud/frontend/node_modules/playwright-core/index.js';
import { writeFileSync } from 'node:fs';
const { chromium } = pw;

const PAGE_URL = process.env.URL || 'http://localhost:8099/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
page.on('console', (m) => console.log('  [page]', m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

await page.goto(PAGE_URL, { waitUntil: 'load' });

// Capture the compiled PDF bytes by hooking Blob URL creation isn't trivial; instead
// re-expose the last result from the worker via a global the page sets.
await page.evaluate(() => { window.__lastPdfLen = 0; });

await page.click('#run');

const deadline = Date.now() + 240_000;
let status = '';
while (Date.now() < deadline) {
  status = await page.textContent('#status');
  if (/compiled|failed|FAILED|error/.test(status)) break;
  await page.waitForTimeout(500);
}

const metrics = (await page.textContent('#metrics'))?.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
console.log('\nSTATUS :', status);
console.log('METRICS:', metrics || '(none)');

// Pull the PDF from the iframe blob URL into the page and out to Node.
const pdfB64 = await page.evaluate(async () => {
  const src = document.getElementById('pdf').getAttribute('src');
  if (!src) return null;
  const buf = await (await fetch(src)).arrayBuffer();
  let bin = ''; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
});
if (pdfB64) {
  writeFileSync('out.pdf', Buffer.from(pdfB64, 'base64'));
  console.log('PDF    : wrote out.pdf (' + (pdfB64.length * 0.75 / 1024).toFixed(1) + ' KB)');
}
await page.screenshot({ path: 'out.png', fullPage: false });

await browser.close();
const ok = /compiled/.test(status) && !!pdfB64;
console.log('\nRESULT :', ok ? 'PASS ✓' : 'FAIL ✗');
process.exit(ok ? 0 : 1);
