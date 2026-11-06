// 4 Nov onboarding round, RP Admin: the panel scrolls inside; the GSP Recruitment contact from state and city; no
// referral code; documents in three groups; no "Opens after verification"; the documents pop-up centred; the verified
// strip → Profile's Documents; the partner agreement (to sign, with GSP, sent back, accepted); Earnings opens; Home's summary.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const PDF = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 x') });
let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`); };
const wait = (p, ms = 400) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const open = async (hash, vp = { width: 1440, height: 900 }, keep = false) => {
    const ctx = await b.newContext({ viewport: vp });
    await ctx.addInitScript((k) => { try { if (!sessionStorage.getItem('init')) { if (!k) localStorage.clear(); localStorage.setItem('gsp-proto-role', 'rp-admin'); localStorage.setItem('gsp-theme', 'light'); sessionStorage.setItem('init', '1'); } } catch {} }, keep);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(hash + ': ' + e.message));
    await p.goto(URL + '#' + hash); await wait(p, 1800);
    return { p, ctx };
  };
  const nav = (p, name) => p.locator('.pnav__item', { hasText: new RegExp(`^\\s*${name}`) }).first();

  /* ---------- Become a partner: the panel keeps its size ---------- */
  { const { p, ctx } = await open('signup');
    const before = await p.locator('.auth__panel').boundingBox();
    await p.mouse.move(1150, 500); await p.mouse.wheel(0, 800); await wait(p, 500);
    const after = await p.locator('.auth__panel').boundingBox();
    const r = await p.evaluate(() => ({ win: window.scrollY, inner: document.querySelector('.auth__center').scrollTop }));
    ok('Become a partner: the form scrolls inside the panel; the panel and page stay put', r.win === 0 && r.inner > 100 && Math.abs(after.y - before.y) < 1 && Math.abs(after.height - before.height) < 1 && before.height <= 900, JSON.stringify({ ...r, h: before.height }));
    ok('…the footer stays in view', (await p.locator('.auth__foot').boundingBox()).y + 20 < 900);
    await ctx.close(); }

  /* ---------- Setup: the GSP Recruitment contact ---------- */
  { const { p, ctx } = await open('portal-setup');
    const side = p.locator('.home__side');
    ok('contact: asks for the state and city', (await side.innerText()).includes('Add your state and city') && (await side.innerText()).includes('They decide your GSP Recruitment contact, who helps you get started.'));
    await side.getByRole('button', { name: 'Add them' }).click(); await wait(p, 400);
    ok('…“Add them” takes you to the state', await p.evaluate(() => ['su-state', 'su-state-field'].includes(document.activeElement?.id)));
    ok('no referral code', (await p.locator('#su-ref').count()) === 0 && !(await p.locator('#setup-step').innerText()).includes('Referral'));
    await p.selectOption('#su-state', 'Kerala'); await p.fill('#su-city', 'Kochi'); await wait(p, 1200);
    ok('…then GSP is seen assigning someone', (await side.innerText()).includes('Assigning your GSP Recruitment contact') && (await side.innerText()).includes('Matching Kochi, Kerala'));
    await wait(p, 2200);
    const t = await side.innerText();
    ok('…then the contact lands: Aditya Rao, GSP Recruitment contact, assigned (no line under it)', t.includes('Aditya Rao') && t.includes('GSP Recruitment contact') && /Assigned to/.test(t) && t.includes('+91 98110 40217') && !t.includes('helps you get started:'), t.replace(/\s+/g, ' ').slice(0, 140));
    await p.fill('#su-city', 'Mumbai'); await p.selectOption('#su-state', 'Maharashtra'); await wait(p, 3400);
    ok('…a new state and city assign again (Sneha Kulkarni)', (await side.innerText()).includes('Sneha Kulkarni'));
    await p.selectOption('#su-state', 'West Bengal'); await p.fill('#su-city', 'Kolkata'); await wait(p, 3400);
    ok('…a city outside the rule still gets someone (by state)', (await side.innerText()).includes('Ankita Sen'));
    await ctx.close(); }

  /* ---------- Setup: the documents, in three groups ---------- */
  { const { p, ctx } = await open('portal-setup-docs');
    const groups = await p.locator('.dl__h').allInnerTexts();
    ok('documents: To upload, Optional, Uploaded', groups.map((g) => g.replace(/\s*\d+$/, '').replace(/\s+/g, ' ').trim().split(/ upload only/i)[0].toLowerCase()).join('|') === 'to upload|optional|uploaded', JSON.stringify(groups));
    ok('…a count and a bar of the required ones', (await p.locator('.dl__count').innerText()).startsWith('1 of 2') && (await p.locator('.dl__bar span.is-on').count()) === 1);
    ok('…the one to upload has its own Upload button and the error', (await p.locator('.ldoc--todo').first().innerText()).includes('PAN card') && (await p.locator('.ldoc--todo').first().getByText('Upload', { exact: true }).count()) === 1 && (await p.locator('.ldoc--todo .ldoc__err').first().innerText()).includes('.heic'));
    ok('…the uploaded one shows its file, Replace and Remove', (await p.locator('.ldoc--done').first().innerText()).includes('BrightPath-registration-certificate.pdf') && (await p.locator('.ldoc--done').getByText('Replace').count()) === 1);
    ok('…no line above Send to GSP (screen readers still hear it)', (await p.locator('.docs__send .docs__count').count()) === 0 && (await p.locator('.docs__send .vh[role=status]').count()) === 1);
    { const top = await p.locator('.ldoc--done').first().evaluate((e) => getComputedStyle(e).borderTopWidth);
      ok('…every row has its top border', top === '1px', top); }
    await p.setInputFiles('#doc-pan-card', PDF('PAN.pdf')); await wait(p, 1600);
    ok('…uploading moves it to Uploaded; 2 of 2', (await p.locator('.ldoc--done').count()) === 2 && (await p.locator('.dl__count').innerText()).startsWith('2 of 2') && (await p.locator('.ldoc--todo').count()) === 1);
    await p.getByRole('button', { name: 'Send to GSP for verification' }).click(); await wait(p, 1800);
    ok('…sent: verification, with no “Opens after verification” tiles', (await p.locator('.vcard__title').first().innerText()).includes('verification in progress') && (await p.locator('#after-title').count()) === 0 && (await p.locator('.ltile').count()) === 0);
    const steps = (await p.locator('.vtrack__title').allInnerTexts()).map((x) => x.split('\n')[0]);
    ok('…the track has the agreement before All Access', steps.join('|').includes('Verification|Agreement|All Access'), steps.join('|'));
    await ctx.close(); }

  /* ---------- The documents pop-up stays centred on a tablet-wide window ---------- */
  { const { p, ctx } = await open('portal-verifying', { width: 900, height: 800 });
    await p.getByRole('button', { name: 'View documents' }).first().click(); await wait(p, 800);
    const r = await p.locator('.sheet').first().boundingBox();
    ok('View documents: a pop-up in the middle at 900px', r.x > 40 && Math.abs(r.x + r.width / 2 - 450) < 4 && r.y > 40, JSON.stringify(r));
    await ctx.close(); }

  /* ---------- Verified: the strip, the agreement ---------- */
  { const { p, ctx } = await open('portal-agreement');
    const strip = p.locator('.okstrip');
    ok('verified: a small strip, not the big card', (await strip.count()) === 1 && (await strip.innerText()).includes('BrightPath Overseas is verified') && (await p.locator('.okcard').count()) === 0 && (await strip.boundingBox()).height < 80);
    ok('…Students and Applications open; Earnings locked', !(await nav(p, 'Students').locator('.pnav__lock').count()) && !(await nav(p, 'Applications').locator('.pnav__lock').count()) && (await nav(p, 'Earnings').locator('.pnav__lock').count()) === 1);
    ok('…the sidebar says sign your agreement', (await p.locator('.sstatus').innerText()).includes('Sign your agreement'));
    ok('…no summary until the agreement is accepted', (await p.locator('.hsum').count()) === 0 && (await p.locator('.hnews').count()) === 0);
    const agr = p.locator('.agr');
    ok('…no note beside Send signed copy', !(await agr.innerText()).includes('Only the owner can sign'));
    ok('agreement: with you, three steps (download, sign, upload), a date', (await agr.innerText()).includes('Sign your partner agreement') && (await agr.locator('.agr__step').count()) === 3 && (await p.locator('#agr-date').count()) === 1);
    await agr.getByRole('button', { name: 'Send signed copy' }).click(); await wait(p, 300);
    ok('…sending with nothing says what’s missing', (await agr.innerText()).includes('Upload the signed copy to send it.') && (await agr.innerText()).includes('Enter the date it was signed.'));
    await agr.getByRole('button', { name: 'Preview' }).click(); await wait(p, 700);
    ok('…Preview opens the agreement', (await p.locator('.sheet').last().innerText()).includes('GSP Partner Agreement'));
    await p.keyboard.press('Escape'); await wait(p, 500);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), agr.getByRole('button', { name: 'Download', exact: true }).click()]);
    await wait(p, 300);
    ok('…Download saves it and ticks step 1', !!dl && (await agr.locator('.agr__step').first().getAttribute('class')).includes('is-done'), dl ? dl.suggestedFilename() : 'no download');
    await p.setInputFiles('#agr-file', { name: 'signed.heic', mimeType: 'image/heic', buffer: Buffer.from('x') }); await wait(p, 300);
    ok('…a wrong file type is refused', (await agr.innerText()).includes('.heic'));
    await p.setInputFiles('#agr-file', PDF('BrightPath-agreement-signed.pdf')); await wait(p, 1500);
    ok('…the signed copy uploads; the date starts as today', (await agr.innerText()).includes('BrightPath-agreement-signed.pdf') && (await p.inputValue('#agr-date')).length === 10);
    await p.fill('#agr-date', '2099-01-01'); await agr.getByRole('button', { name: 'Send signed copy' }).click(); await wait(p, 300);
    ok('…a date in the future is refused', (await agr.innerText()).includes('can’t be in the future'));
    await p.fill('#agr-date', '2026-11-03'); await agr.getByRole('button', { name: 'Send signed copy' }).click(); await wait(p, 1600);
    ok('…sent: with GSP, the copy and when to expect it', (await p.locator('.agr').innerText()).includes('GSP is checking your signed agreement') && (await p.locator('.agr').innerText()).includes('Signed on 3 Nov 2026'));
    ok('…the sidebar says it’s with GSP', (await p.locator('.sstatus').innerText()).includes('Agreement being checked'));
    await nav(p, 'Earnings').click(); await wait(p, 600);
    ok('Earnings locked: opens once GSP accepts your agreement', (await p.locator('.locked__title').innerText()).includes('Opens once GSP accepts your agreement'));
    await nav(p, 'Home').click(); await wait(p, 600);
    await p.locator('.okstrip').getByRole('button', { name: 'View documents' }).click(); await wait(p, 700);
    ok('the strip’s View documents opens Profile → Documents, with the agreement', (await p.getByRole('tab', { selected: true }).innerText()) === 'Documents' && (await p.locator('#pagr-title').count()) === 1 && (await p.locator('.pcard', { hasText: 'Partner agreement' }).innerText()).includes('Checking'));
    // a reload on “Your registration” keeps it (a review link like #portal-agreement is a fixed state and starts again)
    await p.goto(URL + '#portal'); await wait(p, 800);
    await p.reload(); await wait(p, 1800);
    await nav(p, 'Home').click(); await wait(p, 600);
    ok('…a reload keeps the agreement with GSP', (await p.locator('.agr').innerText()).includes('GSP is checking your signed agreement'));
    // GSP sends it back (the Prototype panel acts on this registration)
    await p.goto(URL + '#portal-agreement-back'); await wait(p, 1500);
    const back = p.locator('.agr');
    ok('sent back: why, the copy sent, and the steps again', (await back.innerText()).includes('wasn’t accepted') && (await back.innerText()).includes('Page 4 isn’t signed') && (await back.innerText()).includes('BrightPath-agreement-signed.pdf') && (await back.locator('.pill--bad').count()) === 1, (await back.innerText()).slice(0, 80));
    ok('…the sidebar says it needs you', (await p.locator('.sstatus').innerText()).includes('Agreement not accepted'));
    await back.getByRole('button', { name: 'Send it again' }).click(); await wait(p, 300);
    ok('…sending again needs a new copy', (await back.innerText()).includes('Upload the signed copy to send it.'));
    await p.setInputFiles('#agr-file', PDF('BrightPath-agreement-signed-2.pdf')); await wait(p, 1500);
    await back.getByRole('button', { name: 'Send it again' }).click(); await wait(p, 1600);
    ok('…the new copy goes to GSP', (await p.locator('.agr').innerText()).includes('BrightPath-agreement-signed-2.pdf') && (await p.locator('.agr').innerText()).includes('GSP is checking'));
    // GSP accepts it
    await p.goto(URL + '#portal-verified'); await wait(p, 1500);
    ok('accepted: a strip says so; Earnings opens', (await p.locator('.okstrip').innerText()).includes('Your partner agreement is accepted') && !(await nav(p, 'Earnings').locator('.pnav__lock').count()) && (await p.locator('.agr').count()) === 0 && (await p.locator('.sstatus').count()) === 0);
    ok('…Home is the summary: four numbers, Start something, the latest news; no Needs you now with nothing waiting', (await p.locator('.hkpi').count()) === 4 && (await p.getByRole('heading', { name: 'Needs you now' }).count()) === 0 && (await p.getByRole('heading', { name: 'Start something' }).count()) === 1 && (await p.locator('.hnews').count()) === 1);
    await nav(p, 'Profile').click(); await wait(p, 500); await p.getByRole('tab', { name: 'Documents' }).click(); await wait(p, 300);
    ok('…Profile’s agreement card says Accepted, with the new copy', (await p.locator('.pcard', { hasText: 'Partner agreement' }).innerText()).includes('Accepted') && (await p.locator('.pcard', { hasText: 'Partner agreement' }).innerText()).includes('signed-2.pdf'));
    await ctx.close(); }

  /* ---------- An established partner: the summary with data ---------- */
  { const { p, ctx } = await open('home');
    const kpi = await p.locator('.hkpi').allInnerTexts();
    ok('established: Pending on you, in progress, offers, students', kpi.length === 4 && /^\d+\s*\nPending on you/.test(kpi[0].trim()) && kpi[3].includes('Students'), JSON.stringify(kpi.map((k) => k.replace(/\s+/g, ' '))));
    const rows = p.locator('.hsum__row');
    ok('…Needs you now lists the applications waiting for you', (await rows.count()) >= 1 && (await rows.count()) <= 4);
    ok('…applications by stage: one bar and a legend of 8 stages', (await p.locator('.hsum__bar .hsum__seg').count()) >= 2 && (await p.locator('.hsum__legend li').count()) === 8);
    { const h = await p.getByRole('heading', { name: 'Needs you now' }).boundingBox();
      const dot = await rows.first().locator('.hsum__who').boundingBox();
      const tags = await Promise.all((await rows.all()).map((r) => r.locator('.hsum__tags').boundingBox()));
      const all = await p.getByRole('button', { name: /^See all/ }).boundingBox();
      const go = await rows.first().locator('.hsum__go').boundingBox();
      ok('…rows line up: the name with the heading, the arrow with See all, the status tags on one right edge', Math.abs(dot.x - h.x) < 2 && Math.abs(go.x + go.width - (all.x + all.width)) < 3 && new Set(tags.map((t) => Math.round(t.x + t.width))).size === 1, JSON.stringify({ h: h.x, name: dot.x, all: all.x + all.width, go: go.x + go.width })); }
    ok('…the course isn’t cut short', await rows.first().locator('.hsum__what').evaluate((e) => e.scrollWidth <= e.clientWidth + 1));
    ok('…every row names its student', !(await p.locator('.hsum__who').allInnerTexts()).some((t) => /A student|Student removed/.test(t)));
    const who = (await rows.first().locator('.hsum__who').innerText()).trim();
    await rows.first().click(); await wait(p, 900);
    ok('…a row opens that application', (await p.locator('h1').first().innerText()).includes(who.split(' ')[0]), who);
    await nav(p, 'Home').click(); await wait(p, 500);
    await p.locator('.hkpi').first().click(); await wait(p, 600);
    ok('…a number opens its page', (await p.locator('h1').first().innerText()) === 'Applications');
    await ctx.close(); }

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
