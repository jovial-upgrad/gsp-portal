// Suman, 19 Nov: Add lines' side follows the line it was opened from; a hand-added RP clawback is a recovery that says
// where it's going; Correct amount on a hand-entered line; Record payment keeps a line Part paid when the rest is coming.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const w = (p, ms) => p.waitForTimeout(ms);
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('i')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', 'gsp-finance'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('i', '1'); } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await w(p, 1500);
  await p.locator('.shell__side nav button, .pnav__item', { hasText: /^\s*Commission lines\s*$/ }).first().click(); await w(p, 1200);
  await p.locator('main [role=tab]', { hasText: /^All lines/ }).first().click(); await w(p, 800);
  await p.locator('main button', { hasText: /^\s*RPs\s*\d/ }).first().click(); await w(p, 800);
  const search = p.locator('main input[type=search]').first(); await search.fill('GSP-23305'); await w(p, 800);
  await p.locator('main table tbody tr').first().locator('button[aria-label^="More"]').first().click(); await w(p, 400);
  await p.getByRole('menuitem', { name: /Add lines/ }).click(); await w(p, 700);
  ok((await p.locator('#cadd-side-0').inputValue()) === 'rp', 'Add lines from an RP line starts on GSP → RP');
  await p.selectOption('#cadd-type-0', 'Clawback'); await p.fill('#cadd-amt-0', '500'); await p.fill('#cadd-why', 'Overpaid on the first payment');
  await p.getByRole('dialog').getByRole('button', { name: /^Add$/ }).click(); await w(p, 500);
  await p.getByRole('alertdialog').getByRole('button').last().click(); await w(p, 900);
  await search.fill(''); await w(p, 200); await search.fill('GSP-23305'); await w(p, 800);
  const rec = (await p.locator('main table tbody tr').allInnerTexts()).find((r) => /Recovery/.test(r)) ?? '';
  ok(/−GBP 500/.test(rec) && /To recover/.test(rec) && /next invoice request with a GBP line/.test(rec), 'the hand-added clawback is a recovery that says where it’s going');
  const recRow = p.locator('main table tbody tr', { hasText: 'Recovery' }).first();
  await recRow.locator('button[aria-label^="More"]').first().click(); await w(p, 400);
  ok((await p.getByRole('menuitem', { name: /Correct amount/ }).count()) === 1, 'a hand-entered line can be corrected');
  await p.getByRole('menuitem', { name: /Correct amount/ }).click(); await w(p, 500);
  await p.fill('#ccor-amt', '-450'); await p.fill('#ccor-why', 'The university took back 450, not 500');
  await p.getByRole('dialog').getByRole('button', { name: /^Correct$/ }).click(); await w(p, 400);
  await p.getByRole('alertdialog').getByRole('button').last().click(); await w(p, 900);
  ok((await p.locator('main table tbody tr', { hasText: 'Recovery' }).first().innerText()).includes('−GBP 450'), 'Correct amount changes the line itself');
  // instalments
  await p.locator('main button', { hasText: /^\s*Universities\s*\d/ }).first().click(); await w(p, 800);
  await search.fill('GSP-23663'); await w(p, 800);
  const ready = p.locator('main table tbody tr', { hasText: 'Ready to invoice' }).first();
  await ready.locator('button[aria-label^="More"]').first().click(); await w(p, 300);
  const hasPay = await p.getByRole('menuitem', { name: /^Record payment$/ }).count();
  await p.keyboard.press('Escape');
  ok(hasPay === 0, 'a Ready to invoice line isn’t paid before it’s invoiced');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
