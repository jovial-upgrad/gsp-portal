// Jovial, 19 Nov: an application's Key details say who it's allocated to at GSP and their queue; the queue's leader and
// members can reassign it to someone in the queue (with why), and My work's tasks for it follow; other roles only see it.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const open = async (b, role) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await wait(1500);
  return { p, errs };
};
const nav = async (p, name) => { await p.locator('.shell__side nav button, .pnav__item', { hasText: new RegExp(`^\\s*${name}\\s*$`) }).first().click(); await wait(900); };
const keyRow = async (p) => (await p.locator('dt', { hasText: /^Allocated to$/ }).locator('xpath=following-sibling::dd[1]').first().innerText()).trim();
(async () => {
  const b = await chromium.launch();
  {
    const { p, errs } = await open(b, 'gsp-team');
    await nav(p, 'Applications');
    await p.locator('main tbody tr', { hasText: 'GSP-24097' }).first().click(); await wait(1000);
    const before = await keyRow(p);
    ok(/Ramish/.test(before) && /India Admissions/.test(before), 'Key details: allocated to the queue leader, with the queue: ' + before);
    const pen = p.getByRole('button', { name: 'Reassign the application' });
    ok(await pen.count() === 1, 'a member of the queue can reassign it');
    await pen.click(); await wait(500);
    const sh = p.getByRole('dialog');
    await sh.getByRole('button', { name: 'Reassign' }).click(); await wait(300);
    const errsShown = await sh.locator('.field__msg--error').allInnerTexts();
    ok(errsShown.includes('Choose who it goes to.') && errsShown.includes('Say why.'), 'who and why are required: ' + errsShown.join(' | '));
    const opts = await p.locator('#aal-to option').allInnerTexts();
    ok(opts.some((o) => /Ramish \(leader\)/.test(o)) && opts.some((o) => /Freddy Forrest \(you\)/.test(o)) && !opts.some((o) => /Kamrun/.test(o)), 'only people in the queue are offered, the leader and you marked');
    await p.selectOption('#aal-to', 'Alfiya Khan'); await p.fill('#aal-why', 'Ramish is on leave');
    await sh.getByRole('button', { name: 'Reassign' }).click(); await wait(700);
    ok(/Alfiya Khan/.test(await keyRow(p)), 'the record shows the new person');
    await nav(p, 'My work');
    await p.locator('.gw-views button', { hasText: 'My team' }).click(); await wait(600);
    const row = await p.locator('main tr', { hasText: 'GSP-24097' }).first().innerText().catch(() => '');
    ok(/Alfiya Khan/.test(row), 'My work: the application’s task moved with it: ' + row.replace(/\s+/g, ' ').slice(0, 160));
    ok(errs.length === 0, 'Admissions: no page errors ' + errs.join(' | '));
  }
  {
    const { p, errs } = await open(b, 'institution-partner');
    await nav(p, 'Applications');
    await p.locator('main tbody tr').first().click(); await wait(1000);
    ok(/·/.test(await keyRow(p)), 'GSP · Institution sees who has it');
    ok(await p.getByRole('button', { name: 'Reassign the application' }).count() === 0, 'someone outside the queue cannot reassign it');
    ok(errs.length === 0, 'Institution: no page errors ' + errs.join(' | '));
  }
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
