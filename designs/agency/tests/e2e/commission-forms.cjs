// The commission terms forms (Jovial, 11 Nov: clean, easy to understand, nothing breaks): every Setup form opens with
// its sections, no typed-syntax boxes, nothing wider than the sheet at desktop and phone width; a promotion with a
// condition saves on University terms and comes back when the form reopens.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const FORMS = [
  ['RP records', 'Add RP record', ['The RP and its agreement', 'This RP’s own terms', 'What the RP sees']],
  ['Agreements', 'Add Agreement', ['The agreement', 'The RP’s share', 'Payment', 'Bonus']],
  ['Notices', 'Add Notice', ['The notice', 'Who it’s for', 'Which enrolments', 'What the RP gets']],
  ['University terms', 'Add University terms', ['The university and its contract', 'What GSP earns', 'How and when it pays', 'Tier', 'Promotions and additional commission', 'GSP’s own bonus schemes']],
  ['Groups', 'Add Group', ['The group', 'Group tier', 'Group bonus schemes']],
  ['Settings', 'Edit settings', ['Counting and dates', 'RPs', 'Invoices and regions', 'Lists', 'Reminders']],
];
async function open(b, width) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-finance'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await wait(1500);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Setup'); b && b.click(); }); await wait(900);
  return { ctx, p, errs };
}
const overflow = (p) => p.evaluate(() => { const s = document.querySelector('.sheet'); if (!s) return 'no sheet'; const r = s.getBoundingClientRect(); return [...s.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.width > 0 && q.right > r.right + 1; }).slice(0, 3).map((e) => e.tagName + '.' + (e.className.baseVal ?? e.className)).join(' | '); });
const close = async (p) => { await p.keyboard.press('Escape'); await wait(300); const d = p.getByRole('button', { name: /^Discard/ }); if (await d.count()) { await d.first().click(); await wait(300); } };
(async () => {
  const b = await chromium.launch();
  for (const width of [1440, 390]) {
    const { ctx, p, errs } = await open(b, width);
    for (const [tab, add, secs] of FORMS) {
      await p.locator('main [role=tab]', { hasText: new RegExp('^' + tab) }).first().click(); await wait(500);
      await p.getByRole('button', { name: add }).first().click(); await wait(700);
      const heads = await p.locator('.sheet .cform__sech').allInnerTexts();
      ok(secs.every((x) => heads.includes(x)), `${width}px ${tab}: sections ${secs.join(', ')}${secs.every((x) => heads.includes(x)) ? '' : ' (found ' + heads.join(', ') + ')'}`);
      if (tab === 'University terms') { for (const n of ['Add rate row', 'Add promotion', 'Add additional commission', 'Add bonus scheme', 'Add band']) await p.getByRole('button', { name: n }).first().click(); await wait(400); }
      const ov = await overflow(p);
      ok(!ov, `${width}px ${tab}: nothing wider than the form ${ov}`);
      await close(p);
    }
    ok(!errs.length, `${width}px: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  // a promotion with a condition saves and comes back
  {
    const { ctx, p, errs } = await open(b, 1440);
    await p.locator('main [role=tab]', { hasText: /^University terms/ }).first().click(); await wait(500);
    const row = p.locator('main tbody tr').first();
    const uni = (await row.locator('td').first().innerText()).split('\n')[0].trim();
    await row.locator('button').last().click(); await wait(300);
    await p.getByRole('menuitem', { name: /^Edit/ }).first().click(); await wait(800);
    await p.getByRole('button', { name: 'Add promotion' }).click(); await wait(300);
    const n = (await p.locator('.sheet [id^="cut-promos-name-"]').count()) - 1;
    await p.fill(`#cut-promos-name-${n}`, 'Test India promotion');
    await p.fill(`#cut-promos-rate-${n}-v`, '19');
    await p.locator(`#cut-promos-cond-${n}-add-field`).click(); await wait(200);
    await p.locator('[role=option]', { hasText: 'Students from' }).first().click(); await wait(300);
    await p.locator(`#cut-promos-cond-${n}-regions`).click().catch(() => {}); await wait(300);
    await p.locator('[role=option], .mpick__opt, label', { hasText: /^India$/ }).first().click().catch(() => {}); await wait(200);
    await p.keyboard.press('Escape'); await wait(200);
    await p.getByRole('button', { name: 'Save', exact: true }).last().click(); await wait(600);
    const confirm = p.getByRole('button', { name: 'Save', exact: true });
    if (await confirm.count()) { await confirm.last().click(); await wait(600); }
    ok(!(await p.locator('.sheet .cform__sech').count()), `Edit ${uni}: saved and closed`);
    await row.locator('button').last().click(); await wait(300);
    await p.getByRole('menuitem', { name: /^Edit/ }).first().click(); await wait(800);
    const txt = await p.locator('.sheet').first().innerText();
    ok(txt.includes('Test India promotion'), `Edit ${uni}: the promotion is back as a card`);
    ok(/Students from/.test(txt), `Edit ${uni}: with its condition`);
    await close(p);
    ok(!errs.length, `save: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
