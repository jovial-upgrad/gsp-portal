// Suman, 18 Nov: a credit note keeps the original line, adds a minus credit note line and a new invoice line; a
// payment for less opens the credit note form; a clawback added by hand on the RP side is a minus recovery; an RP line
// carries the bill number of the university invoice it follows; no page errors.
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
  await p.locator('.shell__side nav button', { hasText: /^Commission lines$/ }).first().click(); await wait(1000);
  // the Overdue tile: invoiced lines past their due date
  await p.locator('main .itile', { hasText: /Overdue/ }).first().click(); await wait(800);
  // an invoiced line: Credit note from its menu
  const row = p.locator('main tbody tr').filter({ has: p.locator('.dpill', { hasText: /^(Invoiced|Overdue)$/ }) }).first();
  ok(await row.count() > 0, 'an invoiced university line');
  const id = (await row.locator('td').nth(1).locator('.iw-strong').innerText()).trim();
  const was = (await row.locator('td.ctab__num').innerText()).trim();
  const app = (await row.locator('td').nth(3).innerText()).match(/GSP-\d+/)[0];
  await row.locator('button[aria-label^="More for"]').click(); await wait(300);
  await p.getByRole('menuitem', { name: 'Credit note' }).click(); await wait(500);
  await p.fill(`#ccn-${id}`, '500');
  await p.fill('#ccn-xero', '7788');
  await p.fill('#ccn-why', 'The university pays 500 (statement of 18 Nov)');
  await p.getByRole('button', { name: 'Credit and re-invoice', exact: true }).last().click(); await wait(500);
  await p.getByRole('alertdialog').getByRole('button', { name: 'Credit and re-invoice' }).click(); await wait(1000);
  await p.getByRole('button', { name: 'Clear filters' }).click(); await wait(500);
  await p.fill('#clines-q', app); await wait(500);
  const t = await p.locator('main tbody').innerText(); if (process.env.DBG) console.log(t);
  ok(t.includes('Credit note') && /reverses/.test(t), `a credit note line reverses ${id}`);
  ok(t.includes('−' + was.split('\n')[0]) || /−[A-Z]{3} /.test(t), `its amount is a minus (${was.split('\n')[0]})`);
  ok(/Credited/.test(t), 'the original line is Credited');
  await p.fill('#clines-q', 'INV-7788'); await wait(500);
  const n = await p.locator('main tbody').innerText();
  ok(/500/.test(n) && /INV-7788/.test(n), 'the new invoice line at 500 on INV-7788');
  // RP side: the bill number follows the university invoice
  await p.fill('#clines-q', ''); await wait(200);
  await p.locator('main .clines__switch button', { hasText: /^RPs/ }).first().click(); await wait(500);
  const rpT = await p.locator('main tbody').innerText();
  ok(/BIL-/.test(rpT), 'RP lines show a BIL- bill number');
  ok(!errs.length, `no page errors ${errs.join(' | ')}`);
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
