// Commission scenarios (Prototype panel, Jovial 12 Nov): every sandbox case opens as its own world, its lines worked
// out by the prototype's engine, seen by Finance (Commission lines) and the RP (Earnings); the clock moves the date and
// the lines' statuses with it; leaving brings back the prototype's own data. Desktop and phone; no page errors.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch();
  for (const width of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width, height: 1000 } });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-finance'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#home'); await wait(1500);
    const nav = async (n) => { await p.evaluate((n) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === n || e.getAttribute('aria-label') === n); x && x.click(); }, n); await wait(800); };
    const pick = async (id) => {
      await p.locator('.proto__fab').click(); await wait(300);
      await p.selectOption('select[aria-labelledby="proto-scen"]', id); await wait(600);
      await p.locator('.proto__close').click(); await wait(300);
    };
    await nav(width < 700 ? 'Lines' : 'Commission lines');
    const before = await p.locator('main').innerText();
    const ids = await p.evaluate(() => [...document.querySelectorAll('select')].length);
    await p.locator('.proto__fab').click(); await wait(300);
    const cases = await p.locator('select[aria-labelledby="proto-scen"] option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    await p.locator('.proto__close').click(); await wait(200);
    ok(cases.length >= 38, `${width}px: ${cases.length} scenarios in the panel`);

    // every case opens without a page error and shows its own lines to Finance
    let shown = 0;
    for (const id of width < 700 ? ['IP2', 'RP4', 'C1'] : cases) {
      await pick(id);
      await p.locator('main [role=tab]', { hasText: /^All lines/ }).first().click().catch(() => {}); await wait(400);
      const t = await p.locator('main').innerText();
      const bar = await p.locator('.scen').innerText().catch(() => '');
      if (bar.includes(`Scenario ${id}`) && /\(sample\)/.test(t)) shown++;
      else console.log(`  ${id}: bar ${bar.slice(0, 40)} | ${t.slice(0, 80)}`);
    }
    ok(shown === (width < 700 ? 3 : cases.length), `${width}px: each scenario shows its own (sample) lines to Finance (${shown})`);

    // every Finance page and tab opens inside a scenario (12 Nov: Setup failed on the case RPs' agreements)
    if (width === 1440) {
      await pick('C1');
      const broke = [];
      const navs = await p.evaluate(() => [...new Set([...document.querySelectorAll('nav button')].map((e) => e.textContent.trim()).filter(Boolean))]);
      for (const n of navs) {
        await p.evaluate((n) => { const x = [...document.querySelectorAll('nav button')].find((e) => e.textContent.trim() === n); x && x.click(); }, n); await wait(500);
        const tabs = await p.locator('main [role=tab]').count();
        for (let i = -1; i < Math.min(tabs, 8); i++) {
          if (i >= 0) { await p.locator('main [role=tab]').nth(i).click().catch(() => {}); await wait(250); }
          if ((await p.locator('body').innerText()).includes('This screen didn’t open')) {
            broke.push(`${n}${i >= 0 ? ` tab ${i + 1}` : ''}`);
            await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Back to the screen'); x && x.click(); }); await wait(300);
          }
        }
      }
      ok(navs.length > 3 && broke.length === 0, `every Finance page and tab opens in a scenario (${navs.length} pages)${broke.length ? `: ${broke.join(', ')}` : ''}`);
    }

    // the terms form shows what the case set up (12 Nov: VET and ELICOS rates, and scenario courses in rate rows, were missing)
    if (width === 1440) {
      await pick('IP6');
      await nav('Setup');
      await p.locator('main [role=tab]', { hasText: /^University terms/ }).click(); await wait(400);
      ok(/VET 10%.*ELICOS 20%/.test(await p.locator('main').innerText()), 'IP6: the terms list shows VET and ELICOS rates');
      await p.locator('main tbody tr').first().locator('button').last().click(); await wait(300);
      await p.getByRole('menuitem', { name: /Edit/ }).first().click(); await wait(700);
      const v = await p.locator('[role=dialog] select').evaluateAll((ss) => Object.fromEntries(ss.map((s) => [s.id, s.value])));
      ok(v['cut-rows-course-0'] === 'Nursing' && v['cut-rows-level-0'] === 'Bachelor’s degree' && v['cut-rows-course-1'] === 'IT', 'IP6: the rate rows show their level and course in the form');
      ok((await p.locator('[role=dialog]').innerText()).includes('ELICOS'), 'IP6: the form has a rate field for ELICOS');
      // a level the university has no courses at can be added from the contract (Jovial, 12 Nov)
      const more = await p.locator('#cut-add-level option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
      if (more.length) {
        await p.selectOption('#cut-add-level', more[0]); await wait(250);
      }
      ok(more.length > 0 && (await p.locator('.clevels__name').allInnerTexts()).includes(more[0]), `IP6: Add a program level adds a row (${more[0]})`);
      await p.keyboard.press('Escape'); await wait(400);
      await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /^(Discard|Leave)/.test(e.textContent.trim())); x && x.click(); }); await wait(300);
    }

    // IP12B's group: tier and bonus per source country, and no empty conditions on the bonus (12 Nov)
    if (width === 1440) {
      await pick('IP12B');
      await nav('Setup');
      await p.locator('main [role=tab]', { hasText: /^Groups/ }).click(); await wait(400);
      await p.locator('main tbody tr').first().locator('button').last().click(); await wait(300);
      await p.getByRole('menuitem', { name: /Edit/ }).first().click(); await wait(700);
      const g = await p.locator('[role=dialog] select').evaluateAll((ss) => Object.fromEntries(ss.map((s) => [s.id, s.value])));
      ok(g['cgr-country'] === 'Yes' && g['cgr-schemes-pc-0'] === 'Yes', 'IP12B: the group tier and its bonus count per source country');
      ok((await p.locator('[role=dialog] .ccond__row').count()) === 0, 'IP12B: the group bonus has no empty conditions');
      await p.keyboard.press('Escape'); await wait(400);
      await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /^(Discard|Leave)/.test(e.textContent.trim())); x && x.click(); }); await wait(300);
    }

    // the clock: a month on, the date and at least one line's status move (IP3: students reach their census dates)
    await pick('IP3');
    await nav(width < 700 ? 'Lines' : 'Commission lines');
    await p.locator('main [role=tab]', { hasText: /^All lines/ }).first().click().catch(() => {}); await wait(400);
    const d0 = await p.locator('.scen__date').innerText();
    const s0 = await p.locator('main').innerText();
    for (let i = 0; i < 6; i++) { await p.locator('.scen__clock button', { hasText: '+1 month' }).click(); await wait(250); }
    const d1 = await p.locator('.scen__date').innerText();
    const s1 = await p.locator('main').innerText();
    ok(d0 !== d1, `${width}px: the clock moves the date (${d0} → ${d1})`);
    ok(s0 !== s1, `${width}px: the lines change with the date`);

    // the checks: every one of the case's hand-worked values matches the engine
    await p.locator('.scen__more').click(); await wait(200);
    const bad = await p.locator('.scen__checks .is-bad').count();
    ok(bad === 0 && (await p.locator('.scen__checks .is-ok').count()) > 0, `${width}px: IP3's checks all match`);

    // the RP's side: Earnings as the case's RP
    await p.locator('.scen__go button', { hasText: 'RP Admin' }).click(); await wait(1200);
    await nav('Earnings');
    const e = await p.locator('main').innerText();
    ok(/\(sample\)/.test(e), `${width}px: RP Admin › Earnings shows the case's RP`);

    // nothing off the page with the bar open
    ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${width}px: nothing off the page`);

    // leaving: the prototype's own data again
    await p.locator('.scen__head button[aria-label="Leave the scenario"]').click(); await wait(600);
    ok((await p.locator('.scen').count()) === 0, `${width}px: leaving closes the bar`);
    await p.locator('.scen__go button').count();
    await p.evaluate(() => {});
    const after = await p.locator('main').innerText();
    ok(!/\(sample\)/.test(after), `${width}px: after leaving, no scenario data is left`);
    ok(errs.length === 0, `${width}px: no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
