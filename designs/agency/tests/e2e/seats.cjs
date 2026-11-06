// GSP Branch Manager and GSP Counsellor (Nesil, 6 Nov, from the access sheet): RP Admin's portal for one branch or one
// counsellor; Find courses (no commission), Students and Applications (Chat, Documents) to use; everything else -.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? (pass++, console.log('PASS ', m)) : (fails.push(m), console.log('FAIL ', m)));
(async () => {
  const b = await chromium.launch();
  for (const [role, who, title, n] of [['rp-branch', 'Meghna Rao', 'Branch Manager', 3], ['rp-counsellor', 'Karthik Nair', 'Counsellor', 1]]) {
    const R = (m) => `${title}: ${m}`;
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#home'); await wait(1800);
    const nav = (label) => p.locator('.shell__side nav button', { hasText: new RegExp(`^${label}$`) }).first();
    const tabNames = async () => (await p.locator('main [role=tab]').allInnerTexts()).map((x) => x.trim().split('\n')[0].replace(/\s*\d+$/, ''));
    const menu = (await p.locator('.shell__side nav button').allInnerTexts()).map((x) => x.trim());
    ok(menu.join('|') === 'Home|Find courses|Applications|Students', R('menu: no My work, Mail, Earnings, Profile or GSP pages (' + menu.join(', ') + ')'));
    const foot = await p.locator('.shell__sidefoot').innerText();
    ok(foot.includes(who) && foot.includes(title), R(`signed in as ${who}, ${title}`));
    await nav('Find courses').click(); await wait(800);
    await p.locator('main').getByRole('button', { name: 'MBA in the UK' }).click().catch(() => {}); await wait(1200);
    ok((await p.locator('main').getByRole('button', { name: /^Apply/ }).count()) > 0, R('Find courses: E'));
    ok(!(await p.locator('main').innerText()).includes('Base commission'), R('Find courses › Commissions: not shown'));
    await nav('Students').click(); await wait(800);
    ok((await p.getByRole('button', { name: 'Add student' }).count()) >= 1, R('Students: E'));
    ok((await p.locator('main tr.srow').count()) === n, R(`Students: ${n} (${role === 'rp-branch' ? 'the Mumbai branch' : 'their own'}), got ${await p.locator('main tr.srow').count()}`));
    await p.locator('main tr.srow').first().click(); await wait(800);
    ok((await p.getByRole('button', { name: /^(Edit|Save)/ }).count()) >= 1, R('Student record: E'));
    await nav('Applications').click(); await wait(800);
    ok((await p.getByRole('button', { name: /Add application/ }).count()) >= 1, R('Applications: E'));
    await p.locator('main .arow, main tbody tr').first().click(); await wait(900);
    ok((await tabNames()).join('|') === 'Chat|Documents|Logs', R('Application: Chat, Documents, Logs; no Mail or Submission (' + (await tabNames()).join(', ') + ')'));
    ok(!(await p.locator('main').innerText()).includes('Base commission'), R('Application › Commission: not shown'));
    ok((await p.locator('main textarea').count()) >= 1, R('Application › Chat: E'));
    await p.locator('.topend__me').click().catch(() => {}); await wait(300);
    ok(errs.length === 0, R('no page errors ' + errs.join(' | ')));
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
