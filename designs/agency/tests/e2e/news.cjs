// 3 Nov: every university's course dialog has recent announcements and Summarise, in every role; a course's own are marked.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const UNIS = ['Flinders University', 'Adelaide University', 'Deakin University', 'University of Newcastle', 'University of Wollongong', 'CQUniversity', 'Victoria University', 'Murdoch University', 'RMIT University', 'Federation University', 'Abertay University', 'Coventry University', 'University of Hertfordshire', 'Northumbria University', 'University of Greenwich', 'Ulster University', 'University of Leeds', 'University of Birmingham', 'University of Windsor', 'Algoma University', 'Fanshawe College', 'Thompson Rivers University', 'Massey University', 'University of Waikato', 'Lincoln University', 'Griffith College', 'Dublin Business School', 'University of Limerick', 'Pace University', 'University of South Florida', 'University of Canberra', 'University of the Sunshine Coast'];
let pass = 0, fail = 0;
// a university's courses: its name in the box, then a program level and study area that it has
const COUNTRY = (n) => { const i = UNIS.indexOf(n); return i < 10 || i >= 30 ? 'Australia' : i < 18 ? 'UK' : i < 22 ? 'Canada' : i < 25 ? 'New Zealand' : i < 28 ? 'Ireland' : 'USA'; };
const find = async (p, name, only) => {
  for (const [level, area] of only ? [only] :  [['Master’s degree', 'Business and management'], ['Master’s degree', 'Computing and IT'], ['Postgraduate diploma', 'Business and management'], ['Bachelor’s degree', 'Business and management']]) {
    await p.selectOption('#fc-dest', COUNTRY(name)); await p.selectOption('#fc-level', level); await p.selectOption('#fc-area', area);
    await p.fill('#fc-q', name); await p.press('#fc-q', 'Enter'); await p.waitForTimeout(450);
    if (await p.locator('.course').count()) return;
  }
};
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
(async () => {
  const b = await chromium.launch();
  for (const [role, hash, all] of [['rp-admin', 'portal-verifying', true], ['gsp-team', 'portal', false], ['institution-partner', 'portal', false], ['gsp-admin', 'portal', false]]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#' + hash); await p.waitForTimeout(1600);
    if (role === 'gsp-admin') { await p.locator('.pnav__group', { hasText: 'User Modules' }).click(); await p.waitForTimeout(300); await p.locator('.pfly__item', { hasText: /^\s*Course Search\s*$/ }).first().click(); }
    else await p.locator('.pnav__item, .shell__side button').filter({ hasText: /^\s*(Find courses|Course search)\s*$/ }).first().click();
    await p.waitForTimeout(700);
    let mine = 0, minUni = 99, maxUni = 0, empty = [];
    for (const name of all ? UNIS : [UNIS[0], UNIS[2], UNIS[11], UNIS[19], UNIS[26], UNIS[30]]) {
      await find(p, name);
      const cards = p.locator('.course');
      if (!(await cards.count())) { empty.push(name + ' (no courses)'); continue; }
      for (const k of [0, 3]) {
        if (k >= (await cards.count())) break;
        await cards.nth(k).locator('.course__open').click(); await p.waitForTimeout(450);
        await p.click('#cs-tab-uni'); await p.waitForTimeout(350);
        const n = await p.locator('[aria-labelledby=cs-news] .cs-news__item').count();
        const sum = await p.locator('[aria-labelledby=cs-news]').getByRole('button', { name: 'Summarise' }).count();
        const uni = (await p.locator('#cs-uni-name').innerText()).trim();
        if (n < 3 || n > 4 || !sum || uni !== name) empty.push(`${name}#${k}: ${n} items, summarise ${sum}, tab ${uni}`);
        minUni = Math.min(minUni, n); maxUni = Math.max(maxUni, n);
        mine += await p.locator('[aria-labelledby=cs-news] .cs-news__mine').count();
        await p.keyboard.press('Escape'); await p.waitForTimeout(350);
      }
    }
    ok(`${role}: every university checked shows 3 or 4 announcements and Summarise`, empty.length === 0, empty.join('; ') + ` (fewest ${minUni}, most ${maxUni})`);
    if (all) ok(`${role}: some courses show "For this course"`, mine > 0, `${mine} marked`);
    // a master's in Computing and IT at Adelaide: its scholarship is marked for it, and comes first
    await find(p, UNIS[1], ['Master’s degree', 'Computing and IT']);
    await p.locator('.course .course__open').first().click(); await p.waitForTimeout(450);
    await p.click('#cs-tab-uni'); await p.waitForTimeout(350);
    { const first = p.locator('[aria-labelledby=cs-news] .cs-news__item').first();
      ok(`${role}: the course's own announcement is marked and first`, (await first.locator('.cs-news__mine').count()) === 1 && (await first.innerText()).includes('Computing and IT'), (await first.innerText()).replace(/\s+/g, ' ').slice(0, 140)); }
    await p.locator('[aria-labelledby=cs-news]').getByRole('button', { name: 'Summarise' }).click(); await p.waitForTimeout(7500);
    const lines = await p.locator('[aria-labelledby=cs-news] .gmail__sum-list li').allInnerTexts();
    ok(`${role}: Summarise sums them up and says which are for this course`, lines.length >= 3 && /live now|are live|It’s live/.test(lines[lines.length - 1]) && lines.some((l) => l.includes('(for this course)')) && /for this course’s program level or study area/.test(lines[lines.length - 1]), JSON.stringify(lines));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(`${role}: no page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // the dialog with a course's own announcement, for a look
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', 'rp-admin'); localStorage.setItem('gsp-theme', 'light'); sessionStorage.setItem('init', '1'); } } catch {} });
    const p = await ctx.newPage();
    await p.goto(URL + '#portal-verifying'); await p.waitForTimeout(1600);
    await p.locator('.pnav__item, .shell__side button').filter({ hasText: /^\s*Find courses\s*$/ }).first().click(); await p.waitForTimeout(700);
    let shot = false;
    for (const name of UNIS) {
      await find(p, name);
      const cards = p.locator('.course');
      for (let k = 0; k < Math.min(6, await cards.count()) && !shot; k++) {
        await cards.nth(k).locator('.course__open').click(); await p.waitForTimeout(400);
        await p.click('#cs-tab-uni'); await p.waitForTimeout(300);
        if (await p.locator('[aria-labelledby=cs-news] .cs-news__mine').count()) {
          await p.locator('[aria-labelledby=cs-news]').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
          await p.locator('[aria-labelledby=cs-news]').getByRole('button', { name: 'Summarise' }).click(); await p.waitForTimeout(7500);
          await p.locator('[aria-labelledby=cs-news]').screenshot({ path: require('path').join(require('os').tmpdir(), 'gsp-news.png') });
          console.log('shot:', name);
          shot = true;
        }
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      }
      if (shot) break;
    }
    await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
