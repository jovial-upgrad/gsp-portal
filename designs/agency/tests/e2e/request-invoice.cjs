// R112 (Jovial, 13 Nov): Finance asks for the RP's invoice (Request invoice, with a confirm), and only then does the RP
// see the line (as To invoice); before that the RP sees only its first payment, as an Estimate. Commission lines' Tiers
// to unlock page (what the next enrolments unlock, with a university filter and its splits); Earnings' next band.
// GSP · Admissions and RP Ops see no commission: no Commission tab on a university, an RP or a partner.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch();
  const open = async (role, width) => {
    const ctx = await b.newContext({ viewport: { width, height: 1000 } });
    await ctx.addInitScript((role) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', role); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#home'); await wait(1500);
    const nav = async (n) => { await p.evaluate((n) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === n || e.getAttribute('aria-label') === n); x && x.click(); }, n); await wait(700); };
    return { ctx, p, errs, nav };
  };
  for (const width of [1440, 390]) {
    const { ctx, p, errs, nav } = await open('gsp-finance', width);
    await nav(width < 700 ? 'Lines' : 'Commission lines');
    const tabs = (await p.locator('main [role=tab]').allInnerTexts()).map((x) => x.replace(/\s*\d+\s*$/, '').trim());
    ok(tabs.join('|') === 'To do|All lines|Tiers to unlock', `${width}px: Commission lines pages ${tabs.join('|')}`);
    ok((await p.locator('main').innerText()).includes('Invoices to request'), `${width}px: To do has Invoices to request`);
    await p.locator('main [role=tab]', { hasText: /^All lines/ }).first().click(); await wait(300);
    await p.locator('.clines__switch button', { hasText: /^RPs/ }).click(); await wait(300);
    const row = p.locator('main tbody tr', { hasText: 'Ready to request' }).first();
    const id = (await row.locator('td').nth(1).innerText()).split('\n')[0];
    await p.locator(`label[for="clines-t-${id}"]`).click(); await wait(200);
    await p.getByRole('button', { name: 'Request invoice' }).click(); await wait(300);
    ok((await p.locator('[role=alertdialog]').count()) === 1, `${width}px: Request invoice asks first`);
    await p.evaluate(() => { const x = [...document.querySelectorAll('[role=alertdialog] button')].find((e) => e.textContent.trim() === 'Request invoice'); x && x.click(); }); await wait(500);
    await p.fill('#clines-q', id); await wait(300);
    ok((await p.locator('main tbody tr').first().innerText()).includes('Invoice requested'), `${width}px: the line is Invoice requested`);
    await p.fill('#clines-q', ''); await wait(200);
    // Tiers to unlock: a card per tier or scheme, its bands, splits, and a university filter that narrows it
    await p.locator('main [role=tab]', { hasText: /^Tiers to unlock/ }).first().click(); await wait(500);
    const cards = await p.locator('section.cunlock').count();
    ok(cards > 0 && (await p.locator('.cunlock__splits').first().innerText()).includes('Sales region'), `${width}px: Tiers to unlock: ${cards} cards with splits by level, region, country and course`);
    const unis = await p.locator('#cunl-uni option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    if (unis.length) { await p.selectOption('#cunl-uni', unis[0]); await wait(300); }
    ok(unis.length > 0 && (await p.locator('section.cunlock').count()) <= cards, `${width}px: the university filter narrows the cards`);
    ok((await p.locator('main').innerText()).includes('RPs and their next band'), `${width}px: RPs and their next band`);
    ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${width}px: nothing off the page`);
    // the RP's side: what it sees
    await p.evaluate(() => localStorage.setItem('gsp-proto-role', 'rp-admin')); await p.reload(); await wait(1500);
    await nav('Earnings');
    await p.locator('main [role=tab]', { hasText: /^Commission lines/ }).first().click(); await wait(400);
    const st = await p.locator('main tbody').innerText();
    ok(!/Ready to request|Invoice requested|Waiting for university|\bExpected\b/.test(st), `${width}px: the RP never reads Finance's statuses`);
    ok(/Estimate|To invoice|Paid/.test(st), `${width}px: the RP reads Estimate, To invoice or later`);
    ok(errs.length === 0, `${width}px: no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
  // no commission for GSP · Admissions or RP Ops (Jovial, 13 Nov)
  {
    const { ctx, p, nav } = await open('gsp-team', 1440);
    await nav('Universities');
    await p.locator('main tbody tr').first().locator('button, a').first().click().catch(() => {}); await wait(700);
    const tabs = await p.locator('main [role=tab]').allInnerTexts();
    ok(tabs.length > 0 && !tabs.some((t) => /^Commission/.test(t)), `Admissions: a university has no Commission tab (${tabs.length} tabs)`);
    await ctx.close();
  }
  {
    const { ctx, p, nav } = await open('rp-ops', 1440);
    await nav('Recruitment partners');
    await p.locator('main tbody tr').first().locator('button, a').first().click().catch(() => {}); await wait(700);
    const tabs = await p.locator('main [role=tab]').allInnerTexts();
    ok(tabs.length > 0 && !tabs.some((t) => /^Commission/.test(t)), `RP Ops: an RP has no Commission tab (${tabs.join('|').replace(/\n/g, ' ')})`);
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
