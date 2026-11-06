// 4 Nov (Nesil): in every role, pop-ups have a close icon at the top right and their buttons at the bottom right;
// every dropdown is the product's (no browser-native select visible).
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`); };
const wait = (p, ms = 450) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch();
  const open = async (role, hash = 'home') => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', (e) => p._errs.push(e.message));
    await p.goto(URL + '#' + hash); await wait(p, 1800);
    return { p, ctx };
  };
  // no visible native select on the page or in a pop-up (the Prototype panel aside)
  const natives = (p) => p.$$eval('select', (l) => l.filter((s) => !s.classList.contains('dd__native') && !s.closest('.proto, .split') && s.getBoundingClientRect().width > 2).map((s) => s.id || s.className));
  // a pop-up: the close icon in the top-right corner, the buttons at the bottom right
  const audit = async (p, name) => {
    const d = p.locator('.sheet, .confirm').last();
    if (!(await d.count())) return ok(`${name}: opens`, false);
    const box = await d.boundingBox();
    const close = d.locator('.sheet__close, .confirm__close').first();
    const cb = (await close.count()) ? await close.boundingBox() : null;
    ok(`${name}: close icon top right`, !!cb && box.x + box.width - (cb.x + cb.width) < 48 && cb.y - box.y < 64, cb ? `${Math.round(box.x + box.width - cb.x - cb.width)}px from the right` : 'none');
    const btns = d.locator('.sheet__foot .btn:not(.btn--link), .confirm__acts .btn, .naend .asf__acts .btn');
    const n = await btns.count();
    if (n) {
      const boxes = [];
      for (let i = 0; i < n; i++) boxes.push(await btns.nth(i).boundingBox());
      const right = Math.max(...boxes.map((x) => x.x + x.width));
      const left = Math.min(...boxes.map((x) => x.x));
      ok(`${name}: buttons at the bottom right`, box.x + box.width - right < 48 && left - box.x > 24, `${n} buttons, ${Math.round(box.x + box.width - right)}px from the right`);
    }
    const nat = await natives(p);
    ok(`${name}: no native dropdown`, nat.length === 0, nat.join(','));
  };
  const close = async (p) => { await p.keyboard.press('Escape'); await wait(p, 350); };
  const nav = (p, n) => p.locator('.pnav__item, .pnav__group', { hasText: new RegExp(`^\\s*${n}\\s*$`) }).first().click().then(() => wait(p, 700));
  const fly = async (p, g, item) => { await p.locator('.pnav__group', { hasText: g }).click(); await wait(p, 300); await p.locator('.pfly__item', { hasText: new RegExp('^\\s*' + item + '\\s*$') }).first().click(); await wait(p, 700); };
  const btn = (p, name) => p.getByRole('button', { name: typeof name === 'string' ? new RegExp(`^${name}$`) : name }).last();
  // opens a pop-up from a button and audits it; a missing button is a failure, not a crash
  const pop = async (p, name, label, after) => {
    const b = btn(p, name);
    if (!(await b.count())) return ok(`${label}: its button`, false, String(name));
    await b.click({ timeout: 5000 }).catch(() => b.evaluate((e) => e.click()));
    await wait(p, 700); await audit(p, label); if (after) await after(); else await close(p);
  };
  const page = async (p, name) => { const nat = await natives(p); ok(`${name}: no native dropdown on the page`, nat.length === 0, nat.join(',')); };

  // RP Admin, with everything open
  { const { p, ctx } = await open('rp-admin', 'portal-verified');
    await nav(p, 'Students'); await page(p, 'RP Admin Students');
    await pop(p, /^Add (a )?student$/, 'RP Admin · Add a student');
    await nav(p, 'Applications'); await page(p, 'RP Admin Applications');
    await pop(p, /^(Add|New) (an )?application$/, 'RP Admin · Add an application');
    await nav(p, 'Find courses').catch(() => {}); await nav(p, 'Course search').catch(() => {}); await page(p, 'RP Admin course search');
    // the bell's panel
    await p.getByRole('button', { name: 'Notifications' }).filter({ visible: true }).first().click(); await wait(p, 500);
    ok('RP Admin · notifications: close icon', (await p.locator('.inbox__close').count()) === 1);
    await p.locator('.inbox__close').click(); await wait(p, 300);
    ok('…closes it', (await p.locator('.inbox').count()) === 0);
    ok('RP Admin: no page errors', p._errs.length === 0, p._errs[0]);
    await ctx.close(); }

  // GSP Team
  { const { p, ctx } = await open('gsp-team');
    await nav(p, 'Applications'); await page(p, 'GSP Team Applications');
    await p.locator('.arow .arow__open').first().click(); await wait(p, 900);
    const cs = p.getByRole('button', { name: /Change status/ }).first();
    if (await cs.count()) { await cs.click(); await wait(p, 600); await audit(p, 'GSP Team · Change status'); await close(p); }
    ok('GSP Team: no page errors', p._errs.length === 0, p._errs[0]);
    await ctx.close(); }

  // GSP · Institution
  { const { p, ctx } = await open('institution-partner');
    await nav(p, 'Universities'); await page(p, 'Institution Universities');
    await pop(p, /^Add (a )?university$/, 'Institution · Add a university');
    await nav(p, 'Institution partners');
    const ip = p.getByRole('button', { name: /^Add an institution partner$|^Add institution partner$/ }).first();
    if (await ip.count()) { await ip.click(); await wait(p, 600); await audit(p, 'Institution · Add an institution partner'); await close(p); }
    await nav(p, 'Courses'); await page(p, 'Institution Courses');
    ok('Institution: no page errors', p._errs.length === 0, p._errs[0]);
    await ctx.close(); }

  // GSP · Admin
  { const { p, ctx } = await open('gsp-admin');
    await fly(p, 'User Roles', 'Sales Regions'); await page(p, 'Admin Sales Regions');
    await pop(p, 'Add Sales Region', 'Admin · Add Sales Region');
    await p.getByRole('button', { name: /More for Pakistan/ }).click(); await wait(p, 300);
    await p.getByRole('menuitem', { name: 'Delete Sales Region' }).click(); await wait(p, 400); await audit(p, 'Admin · Delete Sales Region (confirmation)');
    await p.locator('.confirm__close').click(); await wait(p, 300);
    ok('…its close icon cancels', (await p.locator('.confirm').count()) === 0 && (await p.locator('tr', { hasText: 'Pakistan' }).count()) > 0);
    await fly(p, 'User Roles', 'Create Roles'); await page(p, 'Admin Create Roles');
    const au = p.getByRole('button', { name: /^Add User$|^Create Role$|^Add Role$/ }).first();
    if (await au.count()) { await au.click(); await wait(p, 600); await audit(p, 'Admin · Create Roles pop-up'); await close(p); }
    await fly(p, 'Recruitment', 'BDM Assignment'); await page(p, 'Admin BDM Assignment');
    await pop(p, 'Add Row', 'Admin · Add Row');
    await fly(p, 'Other Configurations', 'Logs'); await page(p, 'Admin Logs');
    ok('Admin: no page errors', p._errs.length === 0, p._errs[0]);
    await ctx.close(); }

  // RP Ops
  { const { p, ctx } = await open('rp-ops');
    await nav(p, 'Recruitment partners'); await page(p, 'RP Ops Recruitment partners');
    await p.locator('.irow__open', { hasText: 'EduVista' }).click(); await wait(p, 700);
    await pop(p, 'Add branch', 'RP Ops · Add branch');
    await p.getByRole('tab', { name: /Documents/ }).click(); await wait(p, 400);
    await p.getByRole('button', { name: /^Send back/ }).first().click(); await wait(p, 600); await audit(p, 'RP Ops · Reject and send back'); await close(p);
    await nav(p, 'Master Partners'); await page(p, 'RP Ops Master Partners');
    await pop(p, 'New Master Partner', 'RP Ops · New Master Partner', async () => {});
    // the phone's dial code is the product's dropdown too
    await p.locator('.phone__btn').click(); await wait(p, 300);
    const lb = p.locator('[role=listbox]');
    ok('…the dial code opens the white list, as wide as the phone field', (await lb.count()) === 1 && (await lb.boundingBox()).width >= (await p.locator('.phone').boundingBox()).width - 2);
    await p.getByRole('option', { name: /^Nepal \+977/ }).click(); await wait(p, 200);
    ok('…picking Nepal shows +977', (await p.locator('.phone__code').innerText()).trim() === '+977');
    await close(p);
    ok('RP Ops: no page errors', p._errs.length === 0, p._errs[0]);
    await ctx.close(); }

  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
