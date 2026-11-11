// What the RP sees (Jovial, 11 Nov): GSP · Finance and GSP · RP Ops set it on an RP's Commission tab; only they have the RP's Commission tab
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const RP = process.env.RP || 'Horizon Overseas';
async function role(b, r, shot) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, r);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await wait(1600);
  await p.locator('.shell__side nav button', { hasText: /^Recruitment partners$/ }).first().click(); await wait(900);
  await p.locator('main tr, main .irow__open', { hasText: RP }).first().click(); await wait(900);
  await p.locator('[role=tab]', { hasText: /^Commission$/ }).first().click(); await wait(600);
  const sec = p.locator('section[aria-labelledby="crp-view"]');
  ok(await sec.count() > 0, `${r}: the Commission tab has What the RP sees`);
  const edit = sec.locator('button', { hasText: /^Edit$/ });
  return { p, ctx, sec, edit, errs };
}
(async () => {
  const b = await chromium.launch();
  for (const r of ['gsp-finance', 'rp-ops']) {
    const { p, ctx, sec, edit, errs } = await role(b, r);
    ok(await edit.count() === 1, `${r}: can edit what the RP sees`);
    const before = (await sec.innerText()).replace(/\s+/g, ' ');
    ok(/First study period only/.test(before) && /Settings’ default/.test(before), `${r}: starts as Settings’ default, first study period only`);
    if (r === 'gsp-finance') await p.screenshot({ path: process.env.SHOT || '/tmp/rp-view.png', fullPage: false });
    await edit.click(); await wait(400);
    await p.locator('#cview-periods-field').click(); await wait(200);
    await p.locator('[role=option]', { hasText: 'Every study period' }).first().click(); await wait(200);
    await p.getByRole('button', { name: 'Save', exact: true }).click(); await wait(500);
    const after = (await sec.innerText()).replace(/\s+/g, ' ');
    ok(/Every study period/.test(after) && /This RP’s record/.test(after), `${r}: saved on the RP’s record`);
    ok(!errs.length, `${r}: no page errors ${errs.join('; ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
})();
