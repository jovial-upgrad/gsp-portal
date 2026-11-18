// Jovial, 18 Nov: Admin › Targets downloads a filled template (every level, Company first, the FY's quarters) and
// explains where targets show; Overview tiles show the Company target; every Admissions user can change an
// application's BDM in Key details; RP Ops has Commission setup with RP records and Agreements only; no page errors.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const open = async (b, role) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await wait(1500);
  return { p, errs };
};
(async () => {
  const b = await chromium.launch();

  // Admin: Targets
  {
    const { p, errs } = await open(b, 'gsp-admin');
    await p.locator('.pnav__group', { hasText: 'Dashboards' }).first().click(); await wait(300);
    await p.locator('.pfly__item', { hasText: /^\s*Targets\s*$/ }).first().click(); await wait(1000);
    const t = await p.locator('main').innerText();
    ok(/How targets get in, and where they show/.test(t) && /Company: Overview tiles/.test(t), 'Targets explains how they get in and where they show');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.getByRole('button', { name: 'Download template' }).click()]);
    ok(!!dl, 'Download template downloads a file');
    if (dl) {
      const cells = (l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((x) => x.replace(/,$/, '').replace(/^"|"$/g, ''));
      const csv = fs.readFileSync(await dl.path(), 'utf8').trim().split(/\r?\n/);
      ok(/^Level,Name,Period,Applications/.test(csv[0]), 'template header: ' + csv[0]);
      const levels = new Set(csv.slice(1).map((l) => cells(l)[0]));
      ok(['Company', 'Sales region', 'BDM', 'Destination', 'University', 'IP'].every((l) => levels.has(l)), 'template has every level: ' + [...levels].join(', '));
      ok(/^Company,Global Study Partners,/.test(csv[1]), 'Company row first, named from Commission settings: ' + csv[1]);
      const qs = [...new Set(csv.slice(1).map((l) => cells(l)[2]))];
      ok(qs.join('|') === 'AMJ 26|JAS 26|OND 26|JFM 27', 'the FY’s four quarters per name: ' + qs.join(', '));
    }
    await p.locator('.pnav__group', { hasText: 'Dashboards' }).first().click(); await wait(300);
    await p.locator('.pfly__item', { hasText: /^\s*Overview\s*$/ }).first().click(); await wait(1200);
    ok(/target [\d,]+ \(/.test(await p.locator('main').innerText()), 'Overview tiles show the Company target');
    // Queues: Sales region and Type required; Sales regions: the two queues optional, offered by type (18 Nov)
    await p.locator('.pnav__group', { hasText: 'Work' }).first().click(); await wait(300);
    await p.locator('.pfly__item').filter({ hasText: /Queues/ }).first().click(); await wait(1000);
    const qhead = (await p.locator('.wk-queues thead th').allInnerTexts()).map((x) => x.trim());
    ok(qhead.includes('Sales region') && qhead.includes('Type'), 'queues table: Sales region and Type columns: ' + qhead.join(', '));
    await p.getByRole('button', { name: 'Create Queue' }).first().click(); await wait(600);
    const sh = p.getByRole('dialog');
    await sh.getByRole('button', { name: 'Create Queue' }).click(); await wait(300);
    const qerr = await sh.locator('.field__msg--error').allInnerTexts();
    ok(qerr.includes('Choose its sales region.') && qerr.includes('Choose its type.'), 'Create Queue: sales region and type required: ' + qerr.join(' | '));
    await p.fill('#wq-name', 'Middle East Admissions'); await p.selectOption('#wq-region', 'Global'); await p.selectOption('#wq-type', 'Admissions'); await p.selectOption('#wq-lead', { index: 1 });
    await sh.getByRole('button', { name: 'Create Queue' }).click(); await wait(700);
    const row = await p.locator('.wk-queues tr', { hasText: 'Middle East Admissions' }).innerText();
    ok(/Global/.test(row) && /Admissions/.test(row), 'a new queue shows its region and type: ' + row.replace(/\s+/g, ' '));
    await p.locator('.pnav__group', { hasText: 'User Roles' }).first().click(); await wait(300);
    await p.locator('.pfly__item', { hasText: /^\s*Sales Regions\s*$/ }).first().click(); await wait(900);
    await p.getByRole('button', { name: 'Add Sales Region' }).first().click(); await wait(600);
    const rg = p.getByRole('dialog');
    await rg.getByRole('button', { name: 'Add Sales Region' }).click(); await wait(300);
    const rerr = await rg.locator('.field__msg--error').allInnerTexts();
    ok(!rerr.some((e) => /queue/i.test(e)) && rerr.length >= 3, 'Add Sales Region: admission and recruitment queues optional: ' + rerr.join(' | '));
    const opts = await p.locator('#rg-queue option').allInnerTexts();
    ok(opts.includes('Middle East Admissions') && !opts.some((o) => /Recruitment/.test(o)), 'Admission queue offers Admissions-type queues only');
    ok(errs.length === 0, 'Admin: no page errors ' + errs.join(' | '));
  }

  // Admissions: Application BDM
  {
    const { p, errs } = await open(b, 'gsp-team');
    await p.locator('.shell__side nav button', { hasText: /^Applications$/ }).first().click(); await wait(800);
    await p.locator('main .arow, main tbody tr').first().click(); await wait(1000);
    ok(/Application BDM/.test(await p.locator('main').innerText()), 'Key details has Application BDM');
    const pen = p.getByRole('button', { name: 'Change the application BDM' });
    ok(await pen.count() > 0, 'Admissions can change the application BDM');
    if (await pen.count()) {
      await pen.first().click(); await wait(500);
      ok(await p.getByRole('dialog').filter({ hasText: 'Application BDM' }).count() > 0, 'the change asks in a sheet (BDM and why)');
    }
    ok(errs.length === 0, 'Admissions: no page errors ' + errs.join(' | '));
  }

  // RP Ops: Commission setup
  {
    const { p, errs } = await open(b, 'rp-ops');
    await p.locator('.shell__side nav button', { hasText: /^Commission setup$/ }).first().click(); await wait(1000);
    const tabs = (await p.locator('main [role=tab]').allInnerTexts()).map((x) => x.replace(/\s*\d+\s*$/, '').trim());
    ok(tabs.length === 2 && /RP/.test(tabs[0]) && /Agreement/.test(tabs[1]), 'RP Ops Commission setup: RP records and Agreements only: ' + tabs.join(', '));
    ok(errs.length === 0, 'RP Ops: no page errors ' + errs.join(' | '));
  }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
