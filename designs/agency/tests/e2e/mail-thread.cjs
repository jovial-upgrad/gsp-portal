// 5 Nov: a mail can be a thread, in the Inbox of every GSP role (GSP · Admissions, Institution, Admin, RP Ops).
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`); };
const wait = (p, ms = 300) => p.waitForTimeout(ms);
const ROLES = [
  ['gsp-team', '#portal-verified', /Conditions on Kavya Iyer/, 5, 'Deakin University Offers, Alfiya Khan'],
  ['institution-partner', '#home', /2027 international fees/, 4, 'Namita Nath, Priya Nair'],
  ['rp-ops', '#home', /Onboarding documents: Edulink Dhaka/, 5, 'Rafiq Hasan, Garima Bhardwaj'],
  ['gsp-admin', '#home', /Onboarding documents: Edulink Dhaka/, 5, 'Rafiq Hasan, Garima Bhardwaj'],
];
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [role, hash, subj, n, people] of ROLES) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${role}: ${e.message}`));
    await p.goto(URL + hash); await wait(p, 1800);
    await p.locator('.pnav__item', { hasText: /^\s*Inbox/ }).first().click(); await wait(p, 700);
    const row = p.locator('.mbx__row', { hasText: subj }).first();
    const rt = (await row.innerText()).replace(/\s+/g, ' ');
    ok(`${role}: the thread is in the list, with who wrote and its count (${n})`, rt.includes(people) && (await row.locator('.mbx__n-msgs').innerText()).startsWith(String(n)), rt.slice(0, 120));
    await row.click(); await wait(p, 600);
    ok(`${role}: reading it: ${n} messages, ${n - 1} folded, the latest open`, (await p.locator('.mbx__tag--thread').innerText()) === `${n} messages` && (await p.locator('.mbx__msg-line').count()) === n - 1 && (await p.locator('.mbx__msg--last .gmail__body').count()) === 1);
    await p.locator('.mbx__msg-line').first().click(); await wait(p, 200);
    ok(`${role}: a folded message opens on click`, (await p.locator('.mbx__msg.is-open').count()) === 2);
    await p.getByRole('button', { name: 'Expand all' }).click(); await wait(p, 200);
    ok(`${role}: Expand all opens every message`, (await p.locator('.mbx__msg-line').count()) === 0 && (await p.getByRole('button', { name: 'Collapse all' }).count()) === 1);
    if (role === 'gsp-team') {
      await p.getByRole('button', { name: 'Collapse all' }).click(); await wait(p, 200);
      await p.locator('#mb-search, .mbx__search input').first().fill('PTE'); await wait(p, 300);
      ok('search finds words in earlier messages', (await p.locator('.mbx__row', { hasText: subj }).count()) === 1);
      await p.locator('#mb-search, .mbx__search input').first().fill(''); await wait(p, 300);
      await p.locator('.mbx__row', { hasText: subj }).first().click(); await wait(p, 400);
      await p.getByRole('button', { name: 'Reply', exact: true }).click(); await wait(p, 500);
      await p.locator('.mbx__pane textarea').first().fill('Thank you. We will tell the agency.');
      await p.getByRole('button', { name: /^Send/ }).click(); await wait(p, 600);
      ok('a reply joins the thread as the latest message (6 messages)', (await p.locator('.mbx__tag--thread').innerText()) === '6 messages' && (await p.locator('.mbx__msg--last .gmail__body').innerText()).includes('We will tell the agency'));
      ok('…and the list shows “me” among who wrote', (await p.locator('.mbx__row', { hasText: subj }).first().innerText()).includes(', me'));
    }
    await ctx.close();
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
