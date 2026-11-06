// GSP · Admin, 4 Nov: Sales Regions has two tabs, Sales Regions and Nationality Map; routing reads the map.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`); };
const wait = (p, ms = 400) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', 'gsp-admin'); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#home'); await wait(p, 1800);
  const go = async (g, item) => { await p.locator('.pnav__group', { hasText: g }).click(); await wait(p, 300); await p.locator('.pfly__item', { hasText: new RegExp('^\\s*' + item + '\\s*$') }).first().click(); await wait(p, 600); };
  const main = () => p.locator('main').innerText();
  const tab = (n) => p.getByRole('tab', { name: new RegExp(n) });

  await go('User Roles', 'Sales Regions');
  const tabs = (await p.getByRole('tab').allInnerTexts()).map((x) => x.replace(/\s*\d+\s*$/, '').trim());
  ok('two tabs: Sales Regions, Nationality Map', tabs.join('|') === 'Sales Regions|Nationality Map', tabs.join('|'));
  ok('…opens on Sales Regions, with the table and Add Sales Region', (await tab('Sales Regions').getAttribute('aria-selected')) === 'true' && (await p.locator('.cfg__tab--even').count()) === 1 && (await p.getByRole('button', { name: 'Add Sales Region' }).count()) === 1);
  await tab('Nationality Map').click(); await wait(p, 500);
  const t = await main();
  ok('Nationality Map: its note', /\d+ of \d+ nationalities mapped\. Routing rule 5 \(Student’s nationality\) reads it; a nationality that isn’t mapped falls to rule 6, Fallback\. Only a student’s nationality reads it: an RP’s and a branch’s region come from each region’s countries\./.test(t));
  ok('…no Add Sales Region here', (await p.getByRole('button', { name: 'Add Sales Region' }).count()) === 0);
  ok('…columns Nationality, Sales region', (await p.locator('.cfg__nat thead th').allInnerTexts()).join('|') === 'Nationality|Sales region');
  ok('…20 a page, with pages', (await p.locator('.cfg__nat tbody tr').count()) === 20 && (await p.locator('.cfg__pager').count()) === 1);
  const first = await p.locator('.cfg__nat tbody tr').first().innerText();
  ok('…nationality with its country under it (Afghan, Afghanistan)', first.includes('Afghan') && first.includes('Afghanistan') && first.includes('Rest of world'), first.replace(/\n/g, ' / '));
  await p.fill('#nat-q', 'albania'); await wait(p, 300);
  ok('search by country: Albanian, Latin America and Europe', (await p.locator('.cfg__nat tbody tr').count()) === 1 && (await p.locator('.cfg__nat tbody').innerText()).includes('Latin America and Europe'));
  await p.fill('#nat-q', 'Myanmar and Bhutan'); await wait(p, 300);
  ok('search by region: Burmese and Bhutanese', (await p.locator('.cfg__nat tbody tr').count()) === 2);
  await p.fill('#nat-q', 'emirati'); await wait(p, 300);
  ok('Emirati: not mapped, falls to the Fallback', (await p.locator('.cfg__nat tbody').innerText()).includes('Not mapped: falls to the Fallback'));
  // routing before
  await go('Application Configuration', 'Application Routing');
  await p.getByRole('button', { name: 'Unmapped nationality' }).click(); await wait(p, 300);
  ok('Routing, before: the UAE student falls to the Fallback (Direct)', (await p.locator('.cfg__result').innerText()).includes('Direct') && (await p.locator('.cfg__result').innerText()).includes('isn’t on the Nationality Map'));
  // map Emirati to India
  await go('User Roles', 'Sales Regions'); await tab('Nationality Map').click(); await wait(p, 400);
  ok('read only until Edit', (await p.locator('.cfg__nat select').count()) === 0);
  await p.fill('#nat-q', 'emirati'); await wait(p, 300);
  await p.getByRole('button', { name: /^Edit$/ }).click(); await wait(p, 300);
  ok('Edit: a region to pick on each row; Save Changes off until something changes', (await p.locator('.cfg__nat select').count()) === 1 && await p.getByRole('button', { name: 'Save Changes' }).isDisabled());
  const opts = await p.$$eval('#nat-United\\ Arab\\ Emirates option', (o) => o.map((x) => x.textContent));
  ok('…Not mapped and the work regions (no Global, no Direct)', opts[0] === 'Not mapped' && opts.includes('India') && opts.includes('Rest of world') && !opts.includes('Global') && !opts.includes('Direct'), opts.join('|'));
  await p.selectOption('#nat-United\\ Arab\\ Emirates', 'India'); await wait(p, 200);
  ok('…the changed row shows, and the count', (await p.locator('.cfg__nat tr.is-changed').count()) === 1 && (await p.locator('#nat-count').innerText()).includes('1 changed'));
  await p.getByRole('button', { name: 'Save Changes' }).click(); await wait(p, 400);
  ok('Save Changes: Emirati goes to India; the tab count goes up', (await p.locator('.cfg__nat tbody').innerText()).includes('India') && /194/.test(await tab('Nationality Map').innerText()), await tab('Nationality Map').innerText());
  await p.locator('.cfg__history summary').click(); await wait(p, 200);
  ok('…Change history: “Changed 1 nationality: Emirati to India”', (await p.locator('.cfg__history').innerText()).includes('Changed 1 nationality: Emirati to India'));
  // routing after
  await go('Application Configuration', 'Application Routing');
  await p.getByRole('button', { name: 'Unmapped nationality' }).click(); await wait(p, 300);
  const res = await p.locator('.cfg__result').innerText();
  ok('Routing, after: rule 5 sends the UAE student to India', res.includes('India') && res.includes('maps to India on the Nationality Map'), res.slice(0, 160).replace(/\n/g, ' / '));
  // deleting a region leaves its nationalities not mapped
  await go('User Roles', 'Sales Regions');
  await p.locator('tr', { hasText: /^\s*Pakistan/ }).first().getByRole('button', { name: /More for Pakistan/ }).click(); await wait(p, 300);
  await p.getByRole('menuitem', { name: 'Delete Sales Region' }).click(); await wait(p, 300);
  ok('Delete Pakistan: the confirmation says its nationality won’t be mapped', (await p.locator('.confirm').innerText()).includes('1 nationality goes to it on the Nationality Map'));
  await p.locator('.confirm').getByRole('button', { name: 'Delete Sales Region' }).click(); await wait(p, 400);
  await tab('Nationality Map').click(); await wait(p, 300); await p.fill('#nat-q', 'pakistani'); await wait(p, 300);
  ok('…Pakistani is not mapped now', (await p.locator('.cfg__nat tbody').innerText()).includes('Not mapped'));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
