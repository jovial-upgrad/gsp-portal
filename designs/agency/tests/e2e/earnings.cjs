// RP Admin › Earnings, redesigned (Deepesh, 10 Nov; built 11 Nov): quarters, the chart (month and quarter), Your
// terms, still to come with about what it earns per university, student cards that narrow the lines, filters; and the
// Prototype panel's Earnings as for the three walkthrough RPs. Desktop and phone; no page errors, nothing off the page.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch();
  for (const width of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width, height: 1000 } });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'rp-admin'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#home'); await wait(1500);
    await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Earnings'); x && x.click(); }); await wait(1000);
    const t = await p.locator('main').innerText();
    for (const k of ['Last quarter', 'This quarter', 'Next quarter', 'Your band', 'Your terms', 'Month by month', 'Still to come', 'Your students', 'Commission lines']) ok(t.includes(k), `${width}px: ${k}`);
    ok(/You earn about [\d.]+% of the (net|gross) fee/.test(t), `${width}px: about what it earns per university (R104)`);
    ok(!/GSP’s [A-Z]{3} /.test(t) && !t.includes('How it’s worked out'), `${width}px: no GSP amount or working`);
    await p.getByRole('button', { name: 'Quarter', exact: true }).click(); await wait(300);
    ok((await p.locator('main').innerText()).includes('Quarter by quarter') && (await p.locator('.cchart__col').count()) === 6, `${width}px: quarter by quarter, 6 bars`);
    const card = p.locator('.cearn__card').first();
    const who = (await card.locator('.iw-strong').innerText()).trim();
    await card.click(); await wait(300);
    const rows = await p.locator('main table tbody tr').allInnerTexts();
    ok(rows.length > 0 && rows.every((r) => r.includes(who)), `${width}px: a student card narrows the lines to ${who}`);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(ov <= 1, `${width}px: nothing wider than the page (${ov}px)`);
    if (width === 1440) {
      for (const [rp, name, k] of [['rp-delhi', 'Capital Career Abroad', /80%/], ['rp-pokhara', 'Himalayan Study Centre', /Pilot agreement 2023/], ['rp-saigon', 'Saigon Bridge Education', /Notice: /]]) {
        await p.locator('.proto__fab').click(); await wait(300);
        await p.selectOption('.proto__panel select.proto__select', rp); await wait(300);
        await p.locator('.proto__close').click().catch(() => {}); await wait(500);
        const x = await p.locator('main').innerText();
        ok(x.includes(name) && k.test(x), `Earnings as ${name}: ${k}`);
      }
    }
    ok(!errs.length, `${width}px: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
