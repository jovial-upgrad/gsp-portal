// Prints the design-system HTML to docs/GSP-Design-System.pdf with Playwright Chromium (A4, page numbers).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(require('url').pathToFileURL(process.argv[2]).href, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: process.argv[3], format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#5D6676;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>GSP 3.0 · Design system</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' } });
  await b.close();
})();
