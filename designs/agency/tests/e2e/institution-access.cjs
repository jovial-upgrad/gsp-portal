// GSP · Institution, checked against Nesil's access sheet (6 Nov: E edit, V view, - not shown).
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
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'institution-partner'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
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
  ok(menu.join('|') === 'Home|Inbox|My work|Students|Applications|Course search|Recruitment partners|Master Partners|Institution partners|Universities|Courses|Announcements', 'menu: ' + menu.join(', '));

  await nav('My work').click(); await wait(700);
  ok((await p.locator('.iviewonly--page').count()) === 0, 'My work: E');
  await nav('Inbox').click(); await wait(700);
  ok((await p.locator('.mbx__row').count()) > 0 && !(await has(/^(New mail|Connect inboxes)$/)), 'Mail: V');
  await nav('Course search').click(); await wait(700);
  await p.locator('main').getByRole('button', { name: 'MBA in the UK' }).click(); await wait(1200);
  ok((await p.locator('main').getByRole('button', { name: /^Apply/ }).count()) > 0 && !(await text()).includes('Base commission'), 'Find courses: E, commission not shown');

  await nav('Students').click(); await wait(700);
  ok((await edits()).length === 0, 'Students list: V ' + (await edits()).join(', '));
  await p.locator('main tr.srow').first().click(); await wait(800);
  ok((await edits()).length === 0, 'Student record: V ' + (await edits()).join(', '));
  await tab('Documents').click(); await wait(400);
  ok((await edits()).length === 0, 'Student documents: V');

  await nav('Applications').click(); await wait(700);
  ok((await edits()).length === 0, 'Applications list: V');
  await p.locator('main .arow, main tbody tr').first().click(); await wait(900);
  ok((await tabNames()).join('|') === 'Chat|Mail|Submission|Logs', 'Application record: Chat, Mail, Submission, Logs; no Documents or Commission (' + (await tabNames()).join(', ') + ')');
  ok((await edits()).length === 0 && !(await text()).includes('Base commission'), 'Application record: V, no commission ' + (await edits()).join(', '));
  for (const t of ['Chat', 'Mail', 'Submission']) { await tab(t).click(); await wait(300); ok((await panelEdits()).length === 0 && (await p.locator('#achat-input').count()) === 0, `Application › ${t}: V`); }

  await nav('Recruitment partners').click(); await wait(700);
  ok((await edits()).length === 0, 'Recruitment partners list: V');
  await p.locator('main tbody tr, main .irow__open').first().click(); await wait(800);
  const rt = await tabNames();
  ok(rt.includes('Documents') && !rt.includes('Commission'), 'Recruitment partner: Documents (with agreements), no Commission (' + rt.join(', ') + ')');
  ok((await text()).includes('Branches') && !(await text()).includes('Commission statements'), 'Recruitment partner: Branches and Team shown, no commission');
  for (const t of rt) { await tab(t).click(); await wait(300); const e = await edits(); ok(e.length === 0, `Recruitment partner › ${t}: V${e.length ? ' (found ' + e.join(', ') + ')' : ''}`); }

  await nav('Master Partners').click(); await wait(700);
  ok((await edits()).length === 0, 'Master Partners list: V');
  await p.locator('main tbody tr, main .irow__open').first().click(); await wait(800);
  ok((await tabNames()).join('|') === 'Overview|RPs|Logs', 'Master Partner: Overview, RPs, Logs (' + (await tabNames()).join(', ') + ')');
  ok((await edits()).length === 0, 'Master Partner record: V');

  await nav('Institution partners').click(); await wait(700);
  ok(await has(/^Add a partner$/), 'Institution partners list: E');
  await p.locator('main .irow__open').first().click(); await wait(800);
  ok((await tabNames()).includes('Commission'), 'Institution partner: Commission shown');
  await tab('Documents').click(); await wait(300);
  ok(await has(/^Add /), 'Institution partner › Documents: E');

  await nav('Universities').click(); await wait(700);
  ok((await has(/^Add a university$/)) && (await has(/^Update QS ranking$/)), 'Universities list: E, Update QS ranking');
  await p.locator('main .irow__open').first().click(); await wait(800);
  ok(await has(/^Edit profile$/), 'University record: E');
  await tab('Scholarships').click(); await wait(300); ok(await has(/^Add a scholarship$/), 'University › Scholarships: E');
  await tab('Territory').click(); await wait(300); ok(await has(/^Edit territory$/), 'University › Territory: E');
  await tab('Submission and contacts').click(); await wait(300); ok(await has(/^Add /), 'University › Submission and contacts: E');

  await nav('Courses').click(); await wait(700);
  ok((await edits()).length === 0, 'Courses list: V');
  await p.locator('main .irow__open').first().click(); await wait(800);
  for (const t of await tabNames()) { await tab(t).click(); await wait(300); const e = await edits(); ok(e.length === 0, `Course › ${t}: V${e.length ? ' (found ' + e.join(', ') + ')' : ''}`); }

  await nav('Announcements').click(); await wait(700);
  ok((await edits()).length === 0, 'Announcements list: V ' + (await edits()).join(', '));
  await p.locator('main .irow__open').first().click(); await wait(800);
  ok((await edits()).length === 0, 'Announcement record: V ' + (await edits()).join(', '));
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
