// R103 (Jovial, 11 Nov, Q107): Finance (Lav) creates a notice; RP Ops (Garima, BAP) issues it from its Notices page.
// The seeded New Zealand bonus 2027 waits to be issued; RP Ops issues it.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
async function as(b, role) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await wait(1500);
  return { ctx, p, errs };
}
(async () => {
  const b = await chromium.launch();
  {
    const { ctx, p, errs } = await as(b, 'gsp-finance');
    await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Setup'); x && x.click(); }); await wait(800);
    await p.locator('main [role=tab]', { hasText: /^Notices/ }).first().click(); await wait(500);
    const row = p.locator('main tbody tr', { hasText: 'New Zealand bonus 2027' });
    ok((await row.innerText()).includes('Waiting for RP Ops to issue'), 'Finance › Setup › Notices: the new notice waits for RP Ops');
    ok(!errs.length, `Finance: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  {
    const { ctx, p, errs } = await as(b, 'rp-ops');
    await p.locator('.shell__side nav button', { hasText: /^Notices$/ }).first().click(); await wait(800);
    const row = p.locator('main tbody tr', { hasText: 'New Zealand bonus 2027' });
    ok(await row.count() === 1 && (await row.innerText()).includes('Waiting for RP Ops to issue'), 'RP Ops › Notices: the notice, waiting');
    ok(await p.locator('main tbody tr', { hasText: 'Issued by' }).count() > 0, 'RP Ops › Notices: issued ones say who issued them');
    await row.getByRole('button', { name: /^Issue/ }).click(); await wait(400);
    await p.getByRole('button', { name: 'Issue', exact: true }).last().click(); await wait(700);
    const after = await row.innerText();
    ok(/Upcoming|Active/.test(after) && after.includes('Issued by'), 'RP Ops › Notices: issued, with who and when');
    ok(await row.getByRole('button', { name: /^Issue/ }).count() === 0, 'RP Ops › Notices: no Issue once issued');
    ok(!errs.length, `RP Ops: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
