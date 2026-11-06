// GSP · View Only (Nesil, 6 Nov): GSP · Institution's pages to look at; only Course search can be used.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? (pass++, console.log('PASS ', m)) : (fails.push(m), console.log('FAIL ', m)));
// a control that changes something; looking, searching, filtering, opening, previewing and downloading are fine
const EDIT = /^(Add|Edit|Save|Delete|Remove|New announcement|New mail|Import|Upload|Update QS|Assign(\s|$)|Reassign|Mark as completed|Mark as unread|Publish|Go live|Pause|Resume|Withdraw|Reply|Forward|Archive|Connect inboxes|Change|Start application|Send|Reject|Accept|Request|Link$|Hide|Show again|Make (in)?active)/i;
(async () => {
  const b = await chromium.launch();
  const open = async (role) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#home');
    await wait(1800);
    return { p, ctx, errs };
  };
  const editsShown = async (p) => {
    const labels = await p.locator('main button:visible:not(.mbx__folder):not([role=tab]), main label.btn:visible').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')));
    return labels.filter((l) => /^(Add|Edit|Save|Delete|Remove|New announcement|New mail|Import|Upload|Update QS|Assign(\s|$)|Reassign|Mark as completed|Mark as unread|Publish|Go live|Pause|Resume|Withdraw|Reply|Forward|Archive|Connect inboxes|Change|Start application|Send|Reject|Accept|Request|Link$|Hide|Show again|Make (in)?active)/i.test(l));
  };
  const nav = (p, label) => p.locator('.shell__side nav button', { hasText: new RegExp(`^${label}$`) }).first();

  // the same menu as GSP · Institution
  const inst = await open('institution-partner');
  const instMenu = (await inst.p.locator('.shell__side nav button').allInnerTexts()).map((x) => x.trim());
  await nav(inst.p, 'Universities').click(); await wait(700);
  ok((await inst.p.getByRole('button', { name: 'Add a university' }).count()) === 1, 'GSP · Institution still has Add a university');
  await inst.ctx.close();

  const { p, ctx, errs } = await open('gsp-view');
  const menu = (await p.locator('.shell__side nav button').allInnerTexts()).map((x) => x.trim());
  ok(menu.join('|') === instMenu.join('|'), 'the same menu as GSP · Institution: ' + menu.join(', '));
  ok((await p.locator('.shell__brand').innerText()).replace(/\s+/g, ' ').includes('GSP View Only'), 'GSP View Only beside the logo');
  ok((await p.locator('.shell__sidefoot').innerText()).includes('Tanvi Kapoor'), 'signed in as Tanvi Kapoor, GSP · View Only');

  for (const page of menu) {
    await nav(p, page).click(); await wait(800);
    const shown = await editsShown(p);
    const note = await p.locator('.iviewonly--page').count();
    if (page === 'Course search') {
      ok(note === 0, 'Course search: no view-only line');
      continue;
    }
    ok(note === 1, `${page}: the view-only line`);
    ok(shown.length === 0, `${page}: nothing to change${shown.length ? ' (found ' + shown.join(', ') + ')' : ''}`);
    // open the first record and go through its tabs
    const row = p.locator('main .irow__open, main tr.srow, main .arow, main .mbx__row, main a.irow__open').first();
    if (await row.count()) {
      await row.click(); await wait(700);
      const tabs = p.locator('main [role=tab]');
      const n = await tabs.count();
      for (let i = 0; i < Math.max(1, n); i++) {
        // some records' tabs change as you move between them: count again each time
        if (n && i >= (await tabs.count())) break;
        const name = n ? (await tabs.nth(i).innerText()).trim().split('\n')[0] : '';
        if (n) { await tabs.nth(i).click(); await wait(350); }
        const s2 = await editsShown(p);
        ok(s2.length === 0, `${page} › record${name ? ' › ' + name : ''}: nothing to change${s2.length ? ' (found ' + s2.join(', ') + ')' : ''}`);
      }
    }
  }
  // Course search works
  await nav(p, 'Course search').click(); await wait(900);
  await p.locator('main').getByRole('button', { name: 'MBA in the UK' }).click(); await wait(1200);
  ok((await p.locator('main').getByRole('button', { name: /^Apply/ }).count()) > 0, 'Course search: courses with Apply');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await ctx.close();
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
