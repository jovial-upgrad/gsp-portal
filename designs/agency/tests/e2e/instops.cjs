// GSP · Institution Ops (Nesil, 6 Nov, from the access sheet: E edit, V view, - not shown).
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? (pass++, console.log('PASS ', m)) : (fails.push(m), console.log('FAIL ', m)));
const EDIT = /^(Add|Edit|Save|Delete|Remove|New (mail|application|announcement|Master)|Import|Upload|Update QS|Assign(\s|$)|Reassign|Mark as completed|Publish|Go live|Pause|Resume|Withdraw|Change|Start application|Send|Reject|Accept|Request|Verify|Link|Unlink|Set (in)?active|Hide|Show again|Make (in)?active)/i;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-instops'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home');
  await wait(1800);
  const labels = () => p.locator('main button:visible:not(.mbx__folder):not([role=tab]), main label.btn:visible').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')));
  const edits = async () => (await labels()).filter((l) => EDIT.test(l));
  const has = async (re) => (await labels()).some((l) => re.test(l));
  const nav = (label) => p.locator('.shell__side nav button', { hasText: new RegExp(`^${label}$`) }).first();
  const tab = (name) => p.locator('main [role=tab]', { hasText: new RegExp(`^${name}`) }).first();
  const tabNames = async () => (await p.locator('main [role=tab]').allInnerTexts()).map((x) => x.trim().split('\n')[0].replace(/\s*\d+$/, ''));
  const text = async () => p.locator('main').innerText();

  const panelEdits = async () => (await p.locator('main [role=tabpanel] button:visible, main [role=tabpanel] label.btn:visible').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')))).filter((l) => EDIT.test(l));
  const menu = (await p.locator('.shell__side nav button').allInnerTexts()).map((x) => x.trim());
  ok(menu.join('|') === 'Home|Inbox|My work|Course search|Institution partners|Universities|Courses|Announcements', 'menu (no Students, Applications, Recruitment partners, Master Partners): ' + menu.join(', '));
  ok((await p.locator('.shell__brand').innerText()).replace(/\s+/g, ' ').includes('GSP Institution Ops'), 'GSP Institution Ops beside the logo');
  ok((await p.locator('.shell__sidefoot').innerText()).includes('Riya Sen'), 'signed in as Riya Sen, GSP · Institution Ops');

  await nav('My work').click(); await wait(700);
  ok((await p.locator('.iw-tab tbody tr').count()) === 3 && (await has(/Mark as completed/)), 'My work: E');
  await nav('Inbox').click(); await wait(700);
  ok(await has(/^New mail$/), 'Mail: E');
  await nav('Course search').click(); await wait(700);
  await p.locator('main').getByRole('button', { name: 'MBA in the UK' }).click(); await wait(1200);
  ok((await p.locator('main .course').count()) > 0 && !(await text()).includes('Base commission'), 'Find courses: E, commission not shown');
  ok((await p.locator('#fc-student').count()) === 0 && (await p.locator('main').getByRole('button', { name: /^Apply/ }).count()) === 0 && (await p.locator('main .star').count()) === 0, 'Find courses: no student picker, shortlist or Apply (Students and Applications –)');

  await nav('Institution partners').click(); await wait(700);
  ok((await edits()).length === 0, 'Institution partners list: V');
  await p.locator('main .irow__open').first().click(); await wait(800);
  const it = await tabNames();
  ok(it.includes('Documents') && it.includes('Commission'), 'Institution partner: Documents and Commission shown');
  for (const t of it) { await tab(t).click(); await wait(300); const e = await edits(); ok(e.length === 0, `Institution partner › ${t}: V${e.length ? ' (found ' + e.join(', ') + ')' : ''}`); }

  await nav('Universities').click(); await wait(700);
  ok((await has(/^Add a university$/)) && (await has(/^Update QS ranking$/)), 'Universities list: E, Update QS ranking');
  await p.locator('main .irow__open').first().click(); await wait(800);
  ok(await has(/^Edit profile$/), 'University record: E');
  await tab('Scholarships').click(); await wait(300); ok(await has(/^Add a scholarship$/), 'University › Scholarships: E');
  await tab('Territory').click(); await wait(300); ok(await has(/^Edit territory$/), 'University › Territory: E');
  await tab('Submission and contacts').click(); await wait(300); ok(await has(/^Add /), 'University › Submission and contacts: E');

  await nav('Courses').click(); await wait(700);
  ok(await has(/^Add a course$/), 'Courses list: E');
  await p.locator('main .irow__open').first().click(); await wait(800);
  await tab('Academic').click(); await wait(300); ok(await has(/^Edit/), 'Course › Academic: E');
  await tab('English').click(); await wait(300); ok(await has(/^Edit/), 'Course › English: E');

  await nav('Announcements').click(); await wait(700);
  ok(await has(/^New announcement$/), 'Announcements: E');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
