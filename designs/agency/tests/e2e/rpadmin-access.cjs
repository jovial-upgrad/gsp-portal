// RP Admin, checked against Nesil's access sheet (6 Nov: E edit, V view, - not shown), and its backup role,
// "RP Admin (Backup - not for Engineering)", which must look the same.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? (pass++, console.log('PASS ', m)) : (fails.push(m), console.log('FAIL ', m)));
(async () => {
  const b = await chromium.launch();
  for (const role of ['rp-admin', 'rp-admin-backup']) {
    const R = (m) => `${role}: ${m}`;
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#home'); await wait(1800);
    const nav = (label) => p.locator('.shell__side nav button', { hasText: new RegExp(`^${label}$`) }).first();
    const tabNames = async () => (await p.locator('main [role=tab]').allInnerTexts()).map((x) => x.trim().split('\n')[0].replace(/\s*\d+$/, ''));
    const menu = (await p.locator('.shell__side nav button').allInnerTexts()).map((x) => x.trim());
    ok(menu.join('|') === 'Home|Find courses|Applications|Students|Earnings|Profile', R('menu: no My work, Inbox or GSP pages (' + menu.join(', ') + ')'));
    await nav('Find courses').click(); await wait(800);
    await p.locator('main').getByRole('button', { name: 'MBA in the UK' }).click().catch(() => {}); await wait(1200);
    ok((await p.locator('main').getByRole('button', { name: /^Apply/ }).count()) > 0, R('Find courses: E'));
    ok((await p.locator('main').innerText()).includes('Base commission'), R('Find courses › Commissions: V (shown)'));
    await nav('Students').click(); await wait(800);
    ok((await p.getByRole('button', { name: 'Add student' }).count()) >= 1, R('Students list: E'));
    await nav('Applications').click(); await wait(800);
    ok((await p.getByRole('button', { name: /Add application/ }).count()) >= 1, R('Applications list: E'));
    await p.locator('main .arow, main tbody tr').first().click(); await wait(900);
    ok((await tabNames()).join('|') === 'Chat|Documents|Logs', R('Application record: Chat, Documents, Logs; no Mail or Submission (' + (await tabNames()).join(', ') + ')'));
    ok((await p.locator('main').innerText()).includes('Base commission'), R('Application › Commission: V (shown, nothing to change)'));
    ok((await p.locator('main textarea').count()) >= 1, R('Application › Chat: E'));
    ok(errs.length === 0, R('no page errors ' + errs.join(' | ')));
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
