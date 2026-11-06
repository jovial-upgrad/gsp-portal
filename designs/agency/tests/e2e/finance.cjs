// GSP · Finance (Nesil, 6 Nov): GSP · Institution's pages, with RP Ops' partners; Inbox, My work, Students and Course
// search to use; commission to change on applications, recruitment partners and Master Partners; the rest to look at.
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
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-finance'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home');
  await wait(1800);
  const labels = () => p.locator('main button:visible:not(.mbx__folder):not([role=tab]), main label.btn:visible').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')));
  const edits = async () => (await labels()).filter((l) => EDIT.test(l));
  const nav = (label) => p.locator('.shell__side nav button', { hasText: new RegExp(`^${label}$`) }).first();
  const tab = (name) => p.locator('main [role=tab]', { hasText: new RegExp(`^${name}`) }).first();
  const tabNames = async () => (await p.locator('main [role=tab]').allInnerTexts()).map((x) => x.trim().split('\n')[0].replace(/\s*\d+$/, ''));

  const menu = (await p.locator('.shell__side nav button').allInnerTexts()).map((x) => x.trim());
  ok(menu.join('|') === 'Home|Inbox|My work|Students|Applications|Course search|Recruitment partners|Master Partners|Institution partners|Universities|Courses', 'menu: ' + menu.join(', '));
  ok((await p.locator('.shell__brand').innerText()).replace(/\s+/g, ' ').includes('GSP Finance'), 'GSP Finance beside the logo');
  ok((await p.locator('.shell__sidefoot').innerText()).includes('Rhythm Jain'), 'signed in as Rhythm Jain, GSP · Finance');

  // to use
  await nav('Inbox').click(); await wait(800);
  ok((await p.getByRole('button', { name: 'New mail' }).count()) === 1, 'Inbox: New mail (edit access)');
  ok((await p.locator('.iviewonly--page').count()) === 0, 'Inbox: no view-only line');
  await nav('My work').click(); await wait(800);
  ok((await p.locator('.iw-tab tbody tr').count()) === 3, 'My work: Rhythm’s three Finance tasks');
  ok((await p.getByRole('button', { name: /Mark as completed/ }).count()) >= 1, 'My work: Mark as completed (edit access)');
  await nav('Students').click(); await wait(800);
  ok((await p.getByRole('button', { name: 'Add student' }).count()) >= 1, 'Students: Add student (edit access)');
  await p.locator('main tr.srow').first().click(); await wait(800);
  ok((await p.getByRole('button', { name: /^(Edit|Save)/ }).count()) >= 1, 'Student record: Edit or Save (edit access)');
  await tab('Documents').click(); await wait(500);
  const docEdits = (await labels()).filter((l) => /^(Upload|Remove|Replace)/.test(l));
  ok(docEdits.length === 0, 'Student record › Documents: view only' + (docEdits.length ? ' (found ' + docEdits.join(', ') + ')' : ''));
  await nav('Course search').click(); await wait(800);
  await p.locator('main').getByRole('button', { name: 'MBA in the UK' }).click(); await wait(1200);
  ok((await p.locator('main').getByRole('button', { name: /^Apply/ }).count()) > 0, 'Course search: results with Apply');
  ok(!(await p.locator('main').innerText()).includes('Base commission'), 'Course search: no commission');
  ok((await p.locator('#fc-view').count()) === 0, 'Course search: no Student view switch (no commission to hide)');

  // applications: view, with Commission to change
  await nav('Applications').click(); await wait(800);
  ok((await edits()).length === 0, 'Applications: view only ' + (await edits()).join(', '));
  await p.locator('main .arow, main tbody tr').first().click(); await wait(900);
  ok((await tabNames()).join('|') === 'Commission|Logs', 'Application: Commission and Logs only (' + (await tabNames()).join(', ') + ')');
  const appEdits = (await edits()).filter((l) => !/^Edit the commission$/.test(l) && !/^Edit$/.test(l));
  ok(appEdits.length === 0, 'Application: nothing else to change' + (appEdits.length ? ' (found ' + appEdits.join(', ') + ')' : ''));
  await p.getByRole('button', { name: /Edit the commission/ }).click(); await wait(300);
  await p.locator('#acom-status').selectOption('Paid');
  await p.getByRole('button', { name: 'Save', exact: true }).click(); await wait(300);
  ok((await p.locator('.field__msg--error').count()) === 2, 'Commission: Paid needs the invoice and the date');
  await p.fill('#acom-invoice', 'INV-2026-0501');
  await p.fill('#acom-paid', '2026-11-05');
  await p.getByRole('button', { name: 'Save', exact: true }).click(); await wait(400);
  ok((await p.locator('main .ifacts').innerText()).includes('INV-2026-0501') && (await p.locator('main .ifacts').innerText()).includes('Paid'), 'Commission saved: Paid, with the invoice');

  // recruitment partners: view, Commission to change
  await nav('Recruitment partners').click(); await wait(800);
  ok((await edits()).length === 0, 'Recruitment partners: view only ' + (await edits()).join(', '));
  await p.locator('main tbody tr, main .irow__open').first().click(); await wait(800);
  ok((await tabNames()).includes('Commission'), 'Recruitment partner: a Commission tab');
  for (const t of await tabNames()) {
    if (t === 'Commission') continue;
    await tab(t).click(); await wait(350);
    const e = await edits();
    ok(e.length === 0, `Recruitment partner › ${t}: view only${e.length ? ' (found ' + e.join(', ') + ')' : ''}`);
  }
  await tab('Commission').click(); await wait(400);
  await p.getByRole('button', { name: /Edit the commission terms/ }).click(); await wait(300);
  await p.fill('#orp-com-share', '75');
  await p.getByRole('button', { name: 'Save', exact: true }).click(); await wait(400);
  ok((await p.locator('main .ifacts').innerText()).includes('75%'), 'Recruitment partner: commission terms saved (75%)');

  // Master Partners: view, Commission to change
  await nav('Master Partners').click(); await wait(800);
  ok((await edits()).length === 0, 'Master Partners: view only ' + (await edits()).join(', '));
  await p.locator('main tbody tr, main .irow__open').first().click(); await wait(800);
  for (const t of await tabNames()) {
    await tab(t).click(); await wait(350);
    const e = await edits();
    if (t === 'Commission') ok(e.some((l) => /commission/i.test(l)), 'Master Partner › Commission: can be changed');
    else ok(e.length === 0, `Master Partner › ${t}: view only${e.length ? ' (found ' + e.join(', ') + ')' : ''}`);
  }

  // institution partners, universities, courses: view
  for (const [page, hidden] of [['Institution partners', []], ['Universities', ['Scholarships', 'Territory', 'Submission and contacts']], ['Courses', []]]) {
    await nav(page).click(); await wait(800);
    ok((await edits()).length === 0, `${page}: view only ${(await edits()).join(', ')}`);
    await p.locator('main .irow__open').first().click(); await wait(800);
    const names = await tabNames();
    if (hidden.length) ok(hidden.every((h) => !names.includes(h)), `${page} record: no ${hidden.join(', ')} (${names.join(', ')})`);
    for (const t of names) {
      await tab(t).click(); await wait(300);
      const e = await edits();
      ok(e.length === 0, `${page} › ${t}: view only${e.length ? ' (found ' + e.join(', ') + ')' : ''}`);
    }
    if (page === 'Universities') {
      await tab('Overview').click(); await wait(300);
      ok(!(await p.locator('main').innerText()).includes('QS world ranking'), 'University: no QS ranking');
    }
  }
  await nav('Universities').click(); await wait(600);
  ok((await p.getByRole('button', { name: 'Update QS ranking' }).count()) === 0, 'Universities: no Update QS ranking');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
