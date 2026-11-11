const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/gsp-partner-portal.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-team'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} });
const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
await p.goto(URL + '#home'); await wait(1800);
await p.locator('.shell__side nav button', { hasText: /^Applications$/ }).first().click(); await wait(1000);
await p.getByText('GSP-24102', { exact: true }).first().click(); await wait(1500); console.log('CHANGE BTNS', await p.locator('.gstat__change').count());
const pick = async (stageLabel, statusLabel) => {
  await p.locator('.gstat__change').first().click(); await wait(500);
  await p.locator('#gstat-stage').click(); await wait(200); await p.locator('[role=option]', { hasText: stageLabel }).first().click(); await wait(200);
  await p.locator('#gstat-status').click(); await wait(200); await p.locator('[role=option]', { hasText: statusLabel }).first().click(); await wait(300);
};
const dlgText = async () => (await p.locator('.gstat').first().innerText()).replace(/\s+/g,' ');
const change = async () => { await p.locator('.gstat button', { hasText: /^Change status$/ }).click(); await wait(500); };
const open = async () => (await p.locator('.gstat').count()) && (await p.locator('.gstat').first().isVisible());
// 1 Submitted to university
await pick('Application', 'Submitted to university');
let t = await dlgText(); ok(/University reference ID/.test(t) && /No reference ID/.test(t), 'Submitted: asks reference or No reference ID');
await p.locator('#gstat-ref').fill(''); await change(); ok(await open(), 'Submitted: blocked without a reference');
await p.locator('#gstat-ref').fill('FLN-2611407'); await change(); ok(!(await open()), 'Submitted: moves once the reference is in');
// 2 Conditional offer
await pick('Offer', 'Conditional offer');
t = await dlgText(); ok(/Conditional offer letter/.test(t), 'CoL: asks for the letter');
if (/already in Documents/.test(t)) { await change(); ok(!(await open()), 'CoL: letter already in Documents, so it moves'); }
else { await change(); ok(await open(), 'CoL: blocked without the letter'); await p.setInputFiles('#gstat-letter', { name: 'col.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') }); await change(); ok(!(await open()), 'CoL: moves once uploaded'); }
// UoL: no copy on file yet
await pick('Verification', 'Unconditional offer'); t = await dlgText(); ok(/Unconditional offer letter/.test(t), 'UoL: asks for the letter'); await change(); ok(await open(), 'UoL: blocked without the letter');
await p.setInputFiles('#gstat-letter', { name: 'uol.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') }); await change(); ok(!(await open()), 'UoL: moves once uploaded');
// Acceptance letter
await pick('Acceptance', 'Acceptance letter received'); t = await dlgText(); ok(/Acceptance letter/.test(t), 'Acceptance: asks for the letter'); await change(); ok(await open(), 'Acceptance: blocked without it');
await p.setInputFiles('#gstat-letter', { name: 'coe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') }); await change(); ok(!(await open()), 'Acceptance: moves once uploaded');
// 3 Visa lodgement pending
await pick('Visa', 'Visa lodgement pending');
t = await dlgText(); ok(/Who lodges the visa/.test(t), 'Visa: asks who lodges'); await change(); ok(await open(), 'Visa: blocked until picked');
await p.locator('input[name=gstat-lodger][value=gsp]').check(); await change(); ok(!(await open()), 'Visa: moves once GSP picked');
// 4 Visa granted (GSP lodged)
await pick('Visa', 'Visa granted');
t = await dlgText(); ok(/Visa grant letter/.test(t), 'Granted: asks grant letter when GSP lodged'); await change(); ok(await open(), 'Granted: blocked without it');
await p.setInputFiles('#gstat-letter', { name: 'grant.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') }); await change(); ok(!(await open()), 'Granted: moves once uploaded');
// Student enrolled: optional acceptance letter offered
await pick('Enrolment', 'Student enrolled'); t = await dlgText(); ok(/\(optional\)/.test(t) || /already in Documents/.test(t), 'Enrolled: acceptance letter offered as optional'); await p.locator('.gstat button', { hasText: /^Cancel$/ }).click(); await wait(300);
console.log('ERR', errs); await b.close(); })().catch(e=>{console.log('THROW',e.message);process.exit(1)});
