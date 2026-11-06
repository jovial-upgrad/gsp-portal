// GSP · Recruitment (Nesil, 6 Nov, from the access sheet: E edit, V view, - not shown).
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
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-recruitment'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
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
  ok(menu.join('|') === 'Home|My work|Students|Applications|Course search|Recruitment partners|Master Partners|Institution partners', 'menu: ' + menu.join(', '));
  ok((await p.locator('.shell__brand').innerText()).replace(/\s+/g, ' ').includes('GSP Recruitment'), 'GSP Recruitment beside the logo');
  ok((await p.locator('.shell__sidefoot').innerText()).includes('Aditya Rao'), 'signed in as Aditya Rao, GSP · Recruitment');

  await nav('My work').click(); await wait(700);
  ok((await p.locator('.iw-tab tbody tr').count()) === 3 && (await has(/Mark as completed/)), 'My work: E');
  await nav('Course search').click(); await wait(700);
  await p.locator('main').getByRole('button', { name: 'MBA in the UK' }).click(); await wait(1200);
  ok((await p.locator('main').getByRole('button', { name: /^Apply/ }).count()) > 0, 'Find courses: E');
  ok(!(await text()).includes('Base commission'), 'Find courses › Commissions: not shown');

  await nav('Students').click(); await wait(700);
  ok((await edits()).length === 0, 'Students list: V ' + (await edits()).join(', '));
  await p.locator('main tr.srow').first().click(); await wait(800);
  ok((await edits()).length === 0, 'Student record: V ' + (await edits()).join(', '));
  await tab('Documents').click(); await wait(400);
  ok((await edits()).length === 0, 'Student documents: V ' + (await edits()).join(', '));

  await nav('Applications').click(); await wait(700);
  ok((await edits()).length === 0, 'Applications list: V ' + (await edits()).join(', '));
  await p.locator('main .arow, main tbody tr').first().click(); await wait(900);
  ok((await tabNames()).join('|') === 'Commission|Chat|Documents|Logs', 'Application record: Commission, Chat, Documents, Logs; no Mail or Submission (' + (await tabNames()).join(', ') + ')');
  ok(!(await has(/^Change status$/)), 'Application record: V (no Change status)');
  await tab('Chat').click(); await wait(300);
  ok((await p.locator('#achat-input').count()) === 1, 'Application › Chat: E');
  await tab('Documents').click(); await wait(300);
  ok((await panelEdits()).length === 0, 'Application › Documents: V ' + (await panelEdits()).join(', '));
  await tab('Commission').click(); await wait(300);
  ok((await panelEdits()).length === 0 && (await text()).includes('Base commission'), 'Application › Commission: V');

  await nav('Recruitment partners').click(); await wait(700);
  ok((await p.locator('.iviewonly--page').count()) === 0, 'Recruitment partners list: E (no view-only line)');
  await p.locator('main tbody tr, main .irow__open').first().click(); await wait(800);
  ok(await has(/^Edit the details$/), 'Recruitment partner record: E (Edit the details)');
  ok((await has(/^Add branch$/)) && (await has(/^Add team member$/)), 'Recruitment partner › Branches and Team: E');
  await tab('Documents').click(); await wait(300);
  ok((await panelEdits()).length === 0, 'Recruitment partner › Documents and Agreement: V ' + (await panelEdits()).join(', '));
  await tab('Commission').click(); await wait(300);
  ok((await panelEdits()).length === 0 && (await text()).includes('Partner’s share'), 'Recruitment partner › Commission: V');

  await nav('Master Partners').click(); await wait(700);
  ok((await edits()).length === 0, 'Master Partners list: V ' + (await edits()).join(', '));
  await p.locator('main tbody tr, main .irow__open').first().click(); await wait(800);
  const mt = await tabNames();
  ok(mt.includes('Documents') && mt.includes('Commission'), 'Master Partner: Documents and Commission shown');
  for (const t of mt) { await tab(t).click(); await wait(300); const e = await edits(); ok(e.length === 0, `Master Partner › ${t}: V${e.length ? ' (found ' + e.join(', ') + ')' : ''}`); }

  await nav('Institution partners').click(); await wait(700);
  ok((await edits()).length === 0, 'Institution partners list: V');
  await p.locator('main .irow__open').first().click(); await wait(800);
  const it = await tabNames();
  ok(it.includes('Documents') && it.includes('Commission'), 'Institution partner: Documents and Commission shown');
  for (const t of it) { await tab(t).click(); await wait(300); const e = await edits(); ok(e.length === 0, `Institution partner › ${t}: V${e.length ? ' (found ' + e.join(', ') + ')' : ''}`); }
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
