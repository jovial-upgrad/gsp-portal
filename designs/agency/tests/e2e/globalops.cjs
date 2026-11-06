// GSP · Global Ops (Nesil, 6 Nov, from the access sheet: E edit, V view, - not shown).
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
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-globalops'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
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

  const menu = (await p.locator('.shell__side nav button').allInnerTexts()).map((x) => x.trim());
  ok(menu.join('|') === 'Home|Inbox|My work|Students|Applications|Course search|Recruitment partners|Master Partners|Institution partners|Universities|Courses|Announcements', 'menu: ' + menu.join(', '));
  ok((await p.locator('.shell__brand').innerText()).replace(/\s+/g, ' ').includes('GSP Global Ops'), 'GSP Global Ops beside the logo');
  ok((await p.locator('.shell__sidefoot').innerText()).includes('Neha Kulkarni'), 'signed in as Neha Kulkarni, GSP · Global Ops');

  // My Work E, Mail E
  await nav('Inbox').click(); await wait(700);
  ok(await has(/^New mail$/), 'Inbox: E (New mail)');
  await nav('My work').click(); await wait(700);
  ok((await p.locator('.iw-tab tbody tr').count()) === 3 && (await has(/Mark as completed/)), 'My work: E (Neha’s three Global Ops tasks, Mark as completed)');
  // Find courses E, commission -
  await nav('Course search').click(); await wait(700);
  await p.locator('main').getByRole('button', { name: 'MBA in the UK' }).click(); await wait(1200);
  ok((await p.locator('main').getByRole('button', { name: /^Apply/ }).count()) > 0, 'Find courses: E (Apply)');
  ok(!(await text()).includes('Base commission'), 'Find courses › Commissions: not shown');
  // Students E (list, record, documents)
  await nav('Students').click(); await wait(700);
  ok(await has(/^Add student$/), 'Students list: E');
  await p.locator('main tr.srow').first().click(); await wait(800);
  ok(await has(/^(Edit|Save)/), 'Student record: E');
  await tab('Documents').click(); await wait(400);
  ok(await has(/^Upload a document$/), 'Student documents: E');
  // Applications E (list, record, chat, mail, documents, submission), commission -
  await nav('Applications').click(); await wait(700);
  ok(await has(/^Add application$/), 'Applications list: E');
  await p.locator('main .arow, main tbody tr').first().click(); await wait(900);
  ok((await tabNames()).join('|') === 'Chat|Mail|Documents|Submission|Logs', 'Application record: Chat, Mail, Documents, Submission, Logs (' + (await tabNames()).join(', ') + ')');
  ok(await has(/^Change status$/), 'Application record: E (Change status)');
  ok(!(await text()).includes('Base commission'), 'Application › Commission: not shown');
  await tab('Chat').click(); await wait(300);
  ok((await p.locator('#achat-input').count()) === 1, 'Application › Chat: E');
  await tab('Documents').click(); await wait(300);
  ok(await has(/^Upload$/), 'Application › Documents: E');
  // Recruitment Partners V; commission, documents, agreement, branches, teams -
  await nav('Recruitment partners').click(); await wait(700);
  ok((await edits()).length === 0, 'Recruitment partners list: V ' + (await edits()).join(', '));
  await p.locator('main tbody tr, main .irow__open').first().click(); await wait(800);
  ok((await tabNames()).join('|') === 'Overview|Logs', 'Recruitment partner record: Overview and Logs only (' + (await tabNames()).join(', ') + ')');
  ok((await edits()).length === 0, 'Recruitment partner record: V ' + (await edits()).join(', '));
  const rpText = await text();
  ok(!/Branches|Team\b/.test(rpText.replace(/GSP contacts/g, '')) && !rpText.includes('Commission statements'), 'Recruitment partner: no Branches, Team or commission');
  // Master Partners V; documents, commission -
  await nav('Master Partners').click(); await wait(700);
  ok((await edits()).length === 0, 'Master Partners list: V ' + (await edits()).join(', '));
  await p.locator('main tbody tr, main .irow__open').first().click(); await wait(800);
  ok((await tabNames()).join('|') === 'Overview|RPs|Logs', 'Master Partner record: Overview, RPs, Logs (' + (await tabNames()).join(', ') + ')');
  ok((await edits()).length === 0 && !(await text()).includes('Commissions email'), 'Master Partner record: V, no commission');
  // Institution Partners V; documents V; commission -
  await nav('Institution partners').click(); await wait(700);
  ok((await edits()).length === 0, 'Institution partners list: V');
  await p.locator('main .irow__open').first().click(); await wait(800);
  const ipTabs = await tabNames();
  ok(ipTabs.includes('Documents') && !ipTabs.includes('Commission'), 'Institution partner: Documents, no Commission (' + ipTabs.join(', ') + ')');
  for (const t of ipTabs) { await tab(t).click(); await wait(300); const e = await edits(); ok(e.length === 0, `Institution partner › ${t}: V${e.length ? ' (found ' + e.join(', ') + ')' : ''}`); }
  // Universities list V, record E, Update QS -, scholarships E, territory V, submission E
  await nav('Universities').click(); await wait(700);
  ok((await edits()).length === 0, 'Universities list: V, no Update QS ranking or Add ' + (await edits()).join(', '));
  await p.locator('main .irow__open').first().click(); await wait(800);
  ok(await has(/^Edit profile$/), 'University record: E (Edit profile)');
  await tab('Scholarships').click(); await wait(300);
  ok(await has(/^Add a scholarship$/), 'University › Scholarships: E');
  await tab('Territory').click(); await wait(300);
  const terr = (await p.locator('main [role=tabpanel] button:visible').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()))).filter((l) => EDIT.test(l));
  ok(terr.length === 0, 'University › Territory: V ' + terr.join(', '));
  await tab('Submission and contacts').click(); await wait(300);
  ok(await has(/^Add /), 'University › Submission and contacts: E');
  // Courses V; Academic E, English E
  await nav('Courses').click(); await wait(700);
  ok((await edits()).length === 0, 'Courses list: V ' + (await edits()).join(', '));
  await p.locator('main .irow__open').first().click(); await wait(800);
  for (const t of await tabNames()) {
    await tab(t).click(); await wait(300);
    const e = await edits();
    if (t === 'Academic' || t === 'English') ok(e.some((l) => /^Edit/.test(l)), `Course › ${t}: E`);
    else ok(e.length === 0, `Course › ${t}: V${e.length ? ' (found ' + e.join(', ') + ')' : ''}`);
  }
  // Announcements E
  await nav('Announcements').click(); await wait(700);
  ok(await has(/^New announcement$/), 'Announcements: E');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
