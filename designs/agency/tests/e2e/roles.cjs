// Roles (testing only): the switcher beside Prototype, RP Admin by default, and GSP Team, a copy of the portal seen from GSP's side.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
(async () => {
  const b = await chromium.launch();
  const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL + '#applications'); await p.waitForTimeout(1500);
  ok('a Role button beside Prototype, RP Admin by default', (await p.innerText('.proto__rolebtn')).replace(/\s+/g, ' ').trim() === 'Role RP Admin' && (await p.$('.proto__fabs .proto__fab')) !== null);
  await p.click('.proto__rolebtn'); await p.waitForTimeout(300);
  ok('it opens a menu of five roles (30 Oct: GSP · Admin; 4 Nov: RP Ops), the current one ticked', (await p.$$eval('.proto__role .proto__role-name', (e) => e.map((x) => x.textContent))).join('|') === 'RP Admin|GSP Team|GSP · Institution|GSP · Admin|RP Ops' && (await p.getAttribute('.proto__role:has-text("RP Admin")', 'aria-checked')) === 'true');
  await p.click('.proto__fab'); await p.waitForTimeout(300);
  ok('one menu at a time: Prototype closes the role menu', !(await p.$('.proto__roles')) && (await p.$('.proto__panel')) !== null);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('Esc closes it', !(await p.$('.proto__panel')));
  await p.click('.proto__rolebtn'); await p.click('.proto__role:has-text("GSP Team")'); await p.waitForTimeout(900);
  ok('GSP Team: the menu closes, the button says so, the same state stays open', !(await p.$('.proto__roles')) && (await p.innerText('.proto__rolebtn')).includes('GSP Team') && (await p.$$('.arow')).length === 9);
  await p.reload(); await p.waitForTimeout(1500);
  ok('the role is remembered after a reload', (await p.innerText('.proto__rolebtn')).includes('GSP Team'));
  await p.goto(URL + '#signin'); await p.waitForTimeout(1200);
  await p.click('.proto__rolebtn'); await p.click('.proto__role:has-text("RP Admin")'); await p.waitForTimeout(1200);
  ok('switching role while signed out opens that role’s Home, signed in', p.url().endsWith('#home') && (await p.$('.shell__side')) !== null);
  await ctx.close();

  // GSP Team, from GSP's side (27 Oct): its own name by the logo; GSP's work is pending on you, the agency's is With RP
  const as = async (role, hash) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await c.addInitScript((r) => { try { localStorage.setItem('gsp-proto-role', r); } catch {} }, role);
    const q = await c.newPage(); q.on('pageerror', (e) => errs.push(`${role} ${hash}: ${e.message}`));
    await q.goto(URL + '#' + hash); await q.waitForTimeout(1800);
    return [q, c];
  };
  const txt = async (q, sel) => ((await q.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  {
    const [q, c] = await as('gsp-team', 'applications');
    ok('GSP Team: "GSP Team" by the logo', (await q.innerText('.lockup__label')).replace(/\s+/g, ' ').trim() === 'GSP Team');
    ok('GSP Team: tiles All, Pending on you (GSP), With RP, With university', (await q.$$eval('.atile__label', (e) => e.map((x) => x.textContent))).join('|') === 'All applications|Pending on you|With RP|With university' && (await q.$$eval('.atile__n', (e) => e.map((x) => x.textContent))).join() === '9,2,4,2'); // 28 Oct: awaiting the acceptance letter is GSP's
    ok('GSP Team: what’s pending from GSP comes first', (await txt(q, '.arow:first-child .astat__own')) === 'Pending on you');
    ok('GSP Team: the agency’s statuses say With RP', (await txt(q, '.arow:has-text("GSP-24102") .astat__own')) === 'With RP');
    ok('GSP Team: counsellors by name, no "(you)"', !(await txt(q, '.atab')).includes('(you)') && (await txt(q, '.arow:has-text("GSP-24055") .arow__who')) === 'Asha Menon' && !(await q.$$eval('#ap-who option', (o) => o.map((x) => x.textContent))).includes('My students'));
    await q.click('.atile--gsp'); await q.waitForTimeout(300);
    ok('GSP Team: Pending on you shows GSP’s', (await q.$$('.arow')).length === 2);
    await c.close();
  }
  {
    const [q, c] = await as('gsp-team', 'application-offer');
    ok('GSP Team, an application: the corner tag says With RP', (await txt(q, '.ahead__status .who')) === 'With RP');
    ok('GSP Team, an application: the agency’s to-dos are With RP, to see', (await txt(q, '.aneed:not(.aneed--gsp) .aneed__title')).startsWith('With RP: 1 thing to do') && (await txt(q, '.aneed:not(.aneed--gsp) .btn')) === 'See it' && !(await txt(q, '.abody__side .cdl')).includes('(you)'));
    await c.close();
  }
  // Institution Partner (29 Oct): a copy of GSP Team, with its own name by the logo
  {
    const [q, c] = await as('institution-partner', 'applications');
    ok('GSP · Institution: "Institution Team" by the logo, the role button says so', (await q.innerText('.lockup__label')).replace(/\s+/g, ' ').trim() === 'Institution Team' && (await q.innerText('.proto__rolebtn')).includes('GSP · Institution'));
    ok('Institution Partner: GSP Team’s screens (tiles, With RP)', (await q.$$eval('.atile__label', (e) => e.map((x) => x.textContent))).join('|') === 'All applications|Pending on you|With RP|With university' && (await txt(q, '.arow:has-text("GSP-24102") .astat__own')) === 'With RP');
    await q.click('.arow:has-text("GSP-24102") .arow__open'); await q.waitForTimeout(900);
    ok('Institution Partner, an application: GSP Team’s tabs and Change', (await q.$$eval('.atabs__tab', (e) => e.map((x) => x.textContent.replace(/\d+/g, '').trim()))).join('|') === 'Chat|Mail|Documents|Submission|Activity' && (await q.$('.gstat__change')) !== null);
    await q.reload(); await q.waitForTimeout(1500);
    ok('GSP · Institution is remembered after a reload', (await q.innerText('.proto__rolebtn')).includes('GSP · Institution'));
    await q.click('.proto__rolebtn'); await q.click('.proto__role:has-text("GSP Team")'); await q.waitForTimeout(900);
    ok('back to GSP Team: "GSP Team" by the logo', (await q.innerText('.lockup__label')).replace(/\s+/g, ' ').trim() === 'GSP Team');
    await q.click('.proto__rolebtn'); await q.waitForTimeout(300);
    await q.click('.proto__split'); await q.waitForTimeout(2500);
    ok('Side by side stays RP Admin and GSP Team', (await q.$$eval('.split__role', (e) => e.map((x) => x.textContent))).join('|') === 'RP Admin|GSP Team');
    await c.close();
  }
  {
    const [q, c] = await as('rp-admin', 'applications');
    ok('RP Admin unchanged: Partner Portal, Pending on you is the agency’s, "(you)" stays', (await q.innerText('.lockup__label')).replace(/\s+/g, ' ').trim() === 'Partner Portal' && (await q.$$eval('.atile__label', (e) => e.map((x) => x.textContent))).join('|') === 'All applications|Pending on you|With GSP|With university' && (await txt(q, '.atab')).includes('(you)'));
    await c.close();
  }
  ok('no errors', errs.length === 0, errs.join(' | '));
  await b.close();
})();
