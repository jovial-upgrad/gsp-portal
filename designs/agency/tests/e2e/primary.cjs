// A student's primary application (Nesil, 6 Nov): with several applications one is Primary and the rest Secondary;
// with one, it's Primary. GSP · Admin and GSP · Admissions mark another as primary (asked first); RP Admin sees the tag.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? (pass++, console.log('PASS ', m)) : (fails.push(m), console.log('FAIL ', m)));
(async () => {
  const b = await chromium.launch();
  for (const [role, name, canMark] of [['rp-admin', 'RP Admin', false], ['gsp-team', 'GSP · Admissions', true], ['gsp-admin', 'GSP · Admin', true], ['institution-partner', 'GSP · Institution', false]]) {
    const R = (m) => `${name}: ${m}`;
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#applications'); await wait(2000);
    const rows = await p.locator('.arow').evaluateAll((rs) => rs.map((r) => [r.querySelector('.arow__name')?.textContent.trim(), r.querySelector('.arank')?.textContent.trim(), r.querySelector('.arow__open')?.textContent.trim()]));
    const by = {};
    rows.forEach(([n, rank]) => ((by[n] = by[n] || []).push(rank)));
    ok(rows.length > 0 && rows.every(([, rank]) => rank === 'Primary' || rank === 'Secondary'), R('every application carries Primary or Secondary'));
    const multi = Object.entries(by).filter(([, rs]) => rs.length > 1);
    ok(multi.length > 0 && multi.every(([, rs]) => rs.filter((x) => x === 'Primary').length === 1), R('a student with several: one Primary, the rest Secondary: ' + JSON.stringify(multi)));
    const single = Object.entries(by).filter(([, rs]) => rs.length === 1);
    ok(single.every(([, rs]) => rs[0] === 'Primary'), R('a student with one: Primary'));
    // open a secondary application
    const sec = rows.find(([n, rank]) => rank === 'Secondary' && by[n].length > 1);
    await p.locator('.arow', { hasText: sec[2] }).locator('.arow__open').click(); await wait(800);
    ok((await p.locator('.ahead__rank .arank').innerText()).trim() === 'Secondary', R('the application page shows Secondary under the name'));
    const btn = p.locator('.ahead__rankbtn');
    ok((await btn.count()) === (canMark ? 1 : 0), R(canMark ? 'Mark as Primary offered' : 'no Mark as Primary'));
    if (canMark) {
      await btn.click(); await wait(400);
      const dlg = p.locator('[role=alertdialog], .confirm').last();
      ok((await dlg.innerText()).includes('becomes secondary'), R('asked first, saying which becomes secondary'));
      await dlg.getByRole('button', { name: 'Mark as Primary' }).click(); await wait(500);
      ok((await p.locator('.ahead__rank .arank').innerText()).trim() === 'Primary' && (await btn.count()) === 0, R('now Primary, the button gone'));
      await p.locator('.rback').first().click(); await wait(800);
      const after = await p.locator('.arow').evaluateAll((rs) => rs.map((r) => [r.querySelector('.arow__name')?.textContent.trim(), r.querySelector('.arank')?.textContent.trim(), r.querySelector('.arow__open')?.textContent.trim()]));
      const mine = after.filter(([n]) => n === sec[0]);
      ok(mine.find(([, , id]) => id === sec[2])?.[1] === 'Primary' && mine.filter(([, r]) => r === 'Primary').length === 1, R('in the list: it is Primary, the student’s other ones Secondary'));
    }
    ok(errs.length === 0, R('no errors: ' + errs.slice(0, 2).join(' / ')));
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('FAIL ', f));
})();
