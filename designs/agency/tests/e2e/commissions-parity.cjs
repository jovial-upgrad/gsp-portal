// Commissions, parity with the sandbox (Jovial, 10 Nov): GSP · Finance's Commission lines (worklist tiles, exceptions,
// tier periods to close, students to confirm, lump sums, the Promotion type) and Setup (Groups, Settings, the new terms
// fields); GSP · Admissions' Key details inputs and the GSP-side Commission tab; RP Admin's Earnings and Commission tab
// with no payment details, no GSP amounts or rates, and none of Admissions' commission fields.
//   cd designs/agency && npm run build:artifact && node tests/e2e/commissions-parity.cjs
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? (pass++, console.log('PASS ', m)) : (fails.push(m), console.log('FAIL ', m)));

async function role(b, key) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((k) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', k); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, key);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home');
  await wait(1800);
  const nav = (label) => p.locator('.shell__side nav button', { hasText: new RegExp(`^${label}$`) }).first();
  const main = () => p.locator('main').innerText();
  return { ctx, p, errs, nav, main };
}
const openApp = async (p, nav, id) => {
  await nav('Applications').click();
  await wait(900);
  const row = p.locator('main tr', { hasText: id }).first();
  if (!(await row.count())) return false;
  await row.click();
  await wait(1000);
  return true;
};

(async () => {
  const b = await chromium.launch();

  /* ---------- GSP · Finance ---------- */
  {
    const { ctx, p, errs, nav, main } = await role(b, 'gsp-finance');
    await nav('Commission lines').click();
    await wait(1200);
    const t = await main();
    for (const k of ['Ready to invoice', 'Overdue', 'Part paid', 'Invoices to check', 'Approved to pay', 'To confirm']) ok(t.includes(k), `Finance › Commission lines: the ${k} tile`);
    ok(/Exceptions/.test(t) && t.includes('Contract ended') && t.includes('Rate missing'), 'Commission lines: Exceptions lists Contract ended and Rate missing (held)');
    ok(t.includes('Tier periods to close') && t.includes('UK partner group'), 'Commission lines: Tier periods to close shows the UK partner group’s ended year');
    await p.getByRole('button', { name: /^Close period/ }).first().click();
    await wait(500);
    await p.locator('#layer button', { hasText: /^Close period$/ }).last().click();
    await wait(800);
    ok(!(await main()).includes('Tier periods to close'), 'Close period: asked first, then the period leaves the list');
    await p.locator('main .itile', { hasText: 'To confirm' }).first().click();
    await wait(800);
    ok((await main()).includes('Students to confirm'), 'The To confirm tile opens Students to confirm');
    const before = await p.getByRole('button', { name: /^Confirm continuing/ }).count();
    await p.getByRole('button', { name: /^Confirm continuing/ }).first().click();
    // 12 Nov: every confirm asks first
    ok(await p.locator('[role=dialog], [role=alertdialog]').last().isVisible().catch(() => false), 'Confirm continuing: asks first');
    await p.locator('[role=dialog] button, [role=alertdialog] button', { hasText: /^Confirm$/ }).last().click(); await wait(500);
    await wait(800);
    ok((await p.getByRole('button', { name: /^Confirm continuing/ }).count()) === before - 1, `Confirm continuing: the student leaves the list (${before} → ${before - 1})`);
    await p.locator('main .itile', { hasText: 'Ready to invoice' }).first().click();
    await wait(600);
    ok((await p.locator('main tbody tr').count()) > 0, 'The Ready to invoice tile filters the lines');
    await p.getByRole('button', { name: 'Record lump sum' }).click();
    await wait(600);
    ok((await p.locator('[role=dialog]', { hasText: 'Record lump sum' }).count()) > 0 || (await p.getByText('A payment that isn’t one student’s line').count()) > 0, 'Record lump sum opens its form');
    await p.keyboard.press('Escape');
    await wait(400);
    await p.locator('#clines-type').click().catch(() => {});
    await wait(300);
    ok((await p.getByText('Promotion', { exact: true }).count()) > 0, 'Type filter offers Promotion');
    await p.keyboard.press('Escape');

    await nav('Setup').click();
    await wait(1000);
    const tabs = (await p.locator('main [role=tab]').allInnerTexts()).map((x) => x.trim().split('\n')[0].replace(/\s*\d+$/, ''));
    ok(tabs.includes('Groups') && tabs.includes('Settings'), `Setup tabs: ${tabs.join(', ')}`);
    await p.locator('main [role=tab]', { hasText: /^Groups/ }).click();
    await wait(600);
    ok((await main()).includes('UK partner group') && (await main()).includes('Group volume bonus'), 'Setup › Groups: the UK partner group with its group bonus');
    await p.locator('main [role=tab]', { hasText: /^Settings/ }).click();
    await wait(600);
    const st = await main();
    ok(st.includes('Census fallback') && st.includes('RP share after year 1') && st.includes('GST on invoices to universities') && st.includes('Region groups'), 'Setup › Settings: fallback weeks, annuity, GST, region groups');
    await p.getByRole('button', { name: 'Edit settings' }).click();
    await wait(600);
    ok((await p.getByText('Edit Commission settings').count()) > 0, 'Edit settings opens its form');
    await p.keyboard.press('Escape');
    await wait(300);
    await p.locator('main [role=tab]', { hasText: /^University terms/ }).click();
    await wait(600);
    await p.getByRole('button', { name: 'Add University terms' }).first().click();
    await wait(700);
    const form = await p.locator('body').innerText();
    for (const f of ['Commission is paid', 'Chargeable for', 'Rate rows', 'Promotions', 'Additional commission', 'GSP’s own bonus schemes']) ok(form.includes(f), `University terms form: ${f}`);
    ok((await p.locator('.sheet textarea').count()) === 1, 'University terms form: no typed rules, only the Notes box');
    await p.getByRole('button', { name: 'Add band' }).first().click();
    await wait(300);
    const tierForm = await p.locator('body').innerText();
    for (const f of ['Band bonuses', 'Counted per source country', 'Levels in the tier']) ok(tierForm.includes(f), `University terms form, with a band: ${f}`);
    await p.keyboard.press('Escape');
    await wait(300);
    await p.locator('main [role=tab]', { hasText: /^RP records/ }).click();
    await wait(600);
    ok(!/bank/i.test(await main()), 'Setup › RP records: no bank details');
    // Jovial, 13 Nov: no own terms on an RP record; a From and a To date
    ok(!(await main()).includes('Own terms') && /\bTo\b/.test(await main()), 'Setup › RP records: From and To, no Own terms column');
    // the application's Commission tab, GSP side: terms in force, exceptions, and the working on each line
    if (await openApp(p, nav, 'GSP-23318')) {
      await p.locator('main [role=tab]', { hasText: /^Commission/ }).first().click().catch(() => {});
      await wait(800);
      const c = await main();
      ok(c.includes('This application’s terms') && c.includes('University pays GSP') && c.includes('GSP pays the RP') && c.includes('Tiers and exceptions') && c.includes('Student type missing'), 'Finance › application Commission: the terms at the top (fee, GSP’s rate, the RP’s share) and the exception (GSP view)');
      ok((await p.locator('main details.chow').count()) > 0, 'Finance › application Commission: How it’s worked out on the lines');
      ok(c.includes('GST'), 'Finance › application Commission: GST on the Australian university’s lines (C6)');
    } else ok(false, 'Finance: opens GSP-23318');
    ok(errs.length === 0, `Finance: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  /* ---------- GSP · Admissions ---------- */
  {
    const { ctx, p, errs, nav, main } = await role(b, 'gsp-team');
    const opened = await openApp(p, nav, 'GSP-23318');
    ok(opened, 'Admissions: opens GSP-23318 (Deakin, enrolled)');
    const t = await main();
    ok(t.includes('Student type') && t.includes('Leave of absence from') && t.includes('Tuition fee, year 2'), 'Admissions › Key details: student type (Australia), leave of absence, year 2 fee');
    ok(t.includes('Entered by'), 'Key details: who entered the fee, and when (D7)');
    ok((await p.locator('main [role=tab]', { hasText: /^Commission/ }).count()) === 0, 'Admissions: no Commission tab (as the access sheet has it)');
    ok(errs.length === 0, `Admissions: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  /* ---------- RP Admin ---------- */
  {
    const { ctx, p, errs, nav, main } = await role(b, 'rp-admin');
    await nav('Earnings').click();
    await wait(1200);
    // the lines are on Earnings' Commission lines tab (12 Nov)
    await p.locator('main [role=tab]', { hasText: /^Overview/ }).first().click(); await wait(400);
    const over = await main();
    await p.locator('main [role=tab]', { hasText: /^Commission lines/ }).first().click(); await wait(500);
    const t = over + (await main());
    ok(!/bank/i.test(t), 'RP Admin › Earnings: no bank details');
    ok(t.includes('Estimate, can change until GSP is paid'), 'Earnings: amounts that can change are labelled as estimates (D21)');
    const whats = await p.locator('main table tbody tr td:nth-child(4)').allInnerTexts();
    ok(whats.length > 0 && whats.every((w) => !/%|GSP’s/.test(w)), 'Earnings: no rate or GSP amount in what each line is for');
    ok((await p.locator('main details.chow').count()) === 0 && !t.includes('How it’s worked out'), 'Earnings: no How it’s worked out (GSP’s working)');
    ok(!/GST|Held:/.test(t), 'Earnings: no GST or exception text');
    const opened = await openApp(p, nav, 'GSP-23318');
    if (opened) {
      await p.locator('main [role=tab]', { hasText: /^Commission/ }).first().click().catch(() => {});
      await wait(800);
      const c = await main();
      ok(!c.includes('Tiers and exceptions') && !c.includes('University → GSP') && (await p.locator('main details.chow').count()) === 0, 'RP Admin › application Commission: GSP → RP only, no working, no tiers or exceptions');
      ok(c.includes('This application’s terms') && c.includes('Your terms') && !c.includes('University pays GSP') && !c.includes('GSP’s base'), 'RP Admin › application Commission: the fee and its own terms at the top, never GSP’s rate');
      for (const f of ['Student type', 'Credit points', 'Fee payments', 'Leave of absence', 'Campus', 'Units (']) ok(!c.includes(f), `RP Admin › application: no Admissions field “${f}”`);
    } else ok(false, 'RP Admin: opens GSP-23318');
    ok(errs.length === 0, `RP Admin: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
