// Suman, 18 Nov: Finance works an application's lines on its Commission tab (the same menus as Commission lines); a
// clawback added by hand on the RP side becomes a minus recovery; the cards have room between them; no page errors.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', 'gsp-finance'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await wait(1500);
  await p.locator('.shell__side nav button', { hasText: /^Applications$/ }).first().click(); await wait(1000);
  await p.locator('main tbody tr', { hasText: 'Kavya Reddy' }).first().click(); await wait(1200);
  await p.locator('main [role=tab]', { hasText: /^Commission/ }).first().click(); await wait(800);
  // room between the actions and the Terms card
  const gap = await p.evaluate(() => { const a = document.querySelector('.capp-acts')?.getBoundingClientRect(); const t = a && document.querySelector('.capp-acts')?.nextElementSibling?.getBoundingClientRect(); return a && t ? t.top - a.bottom : -1; });
  ok(gap >= 8, `room between Add lines and the Terms card (${gap}px)`);
  const menus = await p.locator('.clines--app button[aria-label^="More for"]').count();
  ok(menus > 0, `each line has its menu on the application (${menus})`);
  await p.getByRole('button', { name: 'Add lines', exact: true }).first().click(); await wait(500);
  await p.selectOption('#cadd-side-0', 'rp');
  await p.selectOption('#cadd-type-0', 'Clawback');
  await p.fill('#cadd-amt-0', '300');
  await p.fill('#cadd-why', 'The university took back semester 1');
  await p.getByRole('button', { name: 'Add', exact: true }).last().click(); await wait(400);
  await p.getByRole('alertdialog').getByRole('button', { name: 'Add' }).click(); await wait(1000);
  await p.locator('.clines--app .clines__switch button', { hasText: /^RPs/ }).first().click(); await wait(600);
  const t = await p.locator('.clines--app tbody').innerText();
  ok(/Recovery/.test(t) && /−AUD 300/.test(t), 'the RP-side clawback is a recovery of −AUD 300');
  ok(/To recover/.test(t), 'it waits to be taken off the RP’s next invoice (To recover)');
  ok(!errs.length, `no page errors ${errs.join(' | ')}`);
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
