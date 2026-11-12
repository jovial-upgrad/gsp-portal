// R106 (commissions team, 11 Nov): Finance records a university's clawback on a paid line; the RP's share becomes a
// recovery line, To recover, on the To recover tile; no page errors.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-finance'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await wait(1500);
  await p.locator('.shell__side nav button', { hasText: /^Commission lines$/ }).first().click(); await wait(1000);
  // All lines (12 Nov: To do | All lines), the Universities side, Paid
  await p.locator('main [role=tab]', { hasText: /^All lines/ }).first().click(); await wait(400);
  await p.locator('main [role=group][aria-label=Status] button', { hasText: /^Paid/ }).first().click(); await wait(600);
  const row = p.locator('main tbody tr').filter({ hasText: 'Course commission' }).first();
  ok(await row.count() > 0, 'a paid University → GSP line to claw back');
  await row.locator('button[aria-label^="More for"]').click(); await wait(300);
  await p.getByRole('menuitem', { name: 'Record clawback' }).click(); await wait(500);
  await p.fill('#ccb-amount', '500');
  await p.fill('#ccb-why', 'The student withdrew in semester 1');
  await p.getByRole('button', { name: 'Record clawback', exact: true }).last().click(); await wait(400);
  await p.getByRole('button', { name: 'Record clawback', exact: true }).last().click(); await wait(800);
  await p.locator('main [role=tab]', { hasText: /^To do/ }).first().click(); await wait(400);
  const tile = p.locator('main .itile', { hasText: 'To recover' });
  ok(await tile.count() > 0, 'a To recover tile');
  await p.getByRole('button', { name: /To recover/ }).first().click(); await wait(800);
  const t2 = await p.locator('main tbody').innerText();
  ok(/Recovery/.test(t2) && /To recover/.test(t2), 'the RP’s recovery line, To recover');
  ok(!errs.length, `no page errors ${errs.join(' | ')}`);
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
