// RP Ops (4 Nov): a fifth role, GSP's team for the recruitment partners: Inbox, Applications, Students, Course search
// and Recruitment partners (GSP · Institution's own pages), its own sign-in, signed in as Rohan Desai.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`); };
const wait = (p, ms = 500) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const open = async (hash, role = 'rp-ops') => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(hash + ': ' + e.message));
    await p.goto(URL + '#' + hash); await wait(p, 1800);
    return { p, ctx };
  };
  const h1 = async (p) => (await p.locator('h1').first().innerText()).trim();
  const nav = (p, n) => p.locator('.pnav__item', { hasText: new RegExp(`^\\s*${n}\\s*$`) }).first().click().then(() => wait(p, 700));

  // the Role menu has five roles, RP Ops last
  { const { p, ctx } = await open('home');
    ok('the Role button says RP Ops', (await p.innerText('.proto__rolebtn')).includes('RP Ops'));
    await p.click('.proto__rolebtn'); await wait(p, 400);
    const roles = await p.$$eval('.proto__role .proto__role-name', (e) => e.map((x) => x.textContent));
    ok('Role: five roles, RP Ops last', roles.join('|') === 'RP Admin|GSP Team|GSP · Institution|GSP · Admin|RP Ops', roles.join('|'));
    await p.click('.proto__rolebtn'); await wait(p, 300);
    // the portal
    ok('opens on Applications', (await h1(p)) === 'Applications', await h1(p));
    const labels = await p.locator('.pnav__label').allInnerTexts();
    ok('menu: Inbox, Applications, Students, Course search, Recruitment partners, Master Partners', labels.join('|') === 'Inbox|Applications|Students|Course search|Recruitment partners|Master Partners', labels.join('|'));
    ok('brand: RP Ops; signed in as Rohan Desai, GSP · RP Ops', (await p.locator('.shell__side').innerText()).includes('RP') && (await p.locator('.shell__side').innerText()).includes('Rohan Desai') && (await p.locator('.shell__side').innerText()).includes('GSP · RP Ops'));
    ok('…Applications: the list, with applications', (await p.locator('.arow').count()) > 0);
    await nav(p, 'Students');
    ok('…Students: the list', (await h1(p)) === 'Students' && (await p.locator('.srow, .stab tbody tr').count()) > 0);
    await nav(p, 'Course search');
    ok('…Course search', /Course search|Find courses/.test(await h1(p)), await h1(p));
    await nav(p, 'Recruitment partners');
    ok('…Recruitment partners: the list', (await h1(p)) === 'Recruitment partners' && (await p.locator('table tbody tr').count()) > 0);
    await p.locator('table tbody tr').first().click(); await wait(p, 700);
    ok('…a partner’s page opens', (await p.getByRole('tab').count()) >= 2, (await p.getByRole('tab').allInnerTexts()).join('|'));
    await nav(p, 'Inbox');
    ok('…Inbox: GSP Recruitment, Commission and BAP connected', (await h1(p)) === 'Inbox' && /Recruitment|Commission|BAP/.test(await p.locator('main').innerText()));
    await nav(p, 'Applications');
    await p.locator('.arow .arow__open').first().click(); await wait(p, 900);
    ok('…an application opens (GSP’s side)', (await p.getByRole('tab').count()) >= 2);
    await ctx.close(); }

  // Recruitment partners, RP Ops' own (4 Nov): overview, branches, documents, the agreement
  { const { p, ctx } = await open('home');
    const main = () => p.locator('main').innerText();
    const sheet = () => p.locator('.sheet').last();
    const openRp = async (n) => { await nav(p, 'Recruitment partners'); await p.locator('.irow__open', { hasText: n }).click(); await wait(p, 700); };
    await openRp('EduVista');
    const t = await main();
    ok('RP overview: Details with its note', t.includes('The RP changes these until it’s verified.'));
    const labels = await p.locator('#orp-details ~ * dt, .irsec:has(#orp-details) dt').allInnerTexts();
    ok('…12 fields in order', labels.join('|') === 'Code|Name|Contact person|Email|Phone|City|State or province|Country|Owner|Commission statements|How they found GSP|Onboarded on', labels.join('|'));
    ok('…GSP contacts and mapping: Recruitment, First call, Admissions contact, Sales region, Master Partner', ['GSP contacts and mapping', 'Not logged yet', 'Log the first call', 'Admissions contact', 'Sales region', 'Link a Master Partner'].every((x) => t.includes(x)));
    ok('…Branches and team: note and empty line', t.includes('The same people the RP’s Profile lists, as GSP sees them on applications.') && t.includes('No branches yet: the head office is made from the business details on verification.'));
    // Change the Recruitment contact
    await p.getByRole('button', { name: /Change the Recruitment contact/ }).click(); await wait(p, 500);
    await p.selectOption('#ops-pick', 'Meera Pillai'); await sheet().getByRole('button', { name: 'Save' }).click(); await wait(p, 500);
    ok('Change: the Recruitment contact is Meera Pillai', (await p.locator('.irsec:has(#orp-gsp)').innerText()).includes('Meera Pillai'));
    // Log the first call
    await p.getByRole('button', { name: 'Log the first call' }).click(); await wait(p, 500);
    await p.fill('#ops-call-note', 'Walked through the portal.'); await sheet().getByRole('button', { name: 'Log call' }).click(); await wait(p, 500);
    ok('Log the first call: logged, with the note', (await p.locator('.irsec:has(#orp-gsp)').innerText()).includes('Walked through the portal.') && !(await main()).includes('Not logged yet'));
    // Add branch
    await p.getByRole('button', { name: /^Add branch$/ }).first().click(); await wait(p, 500);
    const st = await sheet().innerText();
    ok('Add branch: pop-up with its subtitle and read-only contact hint', st.includes('The branch’s sales region comes from its country; its Recruitment contact from Recruitment assignment.') && st.includes('Set by the system from Recruitment assignment.'));
    ok('…the contact is read-only', await p.locator('#ops-br-contact').isDisabled());
    await sheet().getByRole('button', { name: 'Add branch' }).click(); await wait(p, 300);
    ok('…empty: three errors', (await sheet().locator('.field__msg--error').count()) === 3);
    await p.fill('#ops-br-name', 'Vijayawada branch');
    await p.fill('#ops-br-country', 'India'); await wait(p, 300); await p.keyboard.press('Enter'); await wait(p, 200);
    await p.fill('#ops-br-city', 'Vijayawada'); await wait(p, 200);
    const contact = await p.inputValue('#ops-br-contact');
    ok('…the contact fills in from Recruitment assignment', contact && contact !== '—', contact);
    await sheet().getByRole('button', { name: 'Add branch' }).click(); await wait(p, 600);
    ok('…added to the table', (await p.locator('.irsec:has(#orp-branches) tbody tr').count()) === 1 && (await p.locator('.irsec:has(#orp-branches)').innerText()).includes('Vijayawada branch'));
    // Documents
    await p.getByRole('tab', { name: /Documents/ }).click(); await wait(p, 500);
    const send = p.getByRole('button', { name: /^Send agreement$/ });
    ok('Documents: Send agreement is off until every document is verified', await send.isDisabled());
    ok('…and says so', (await main()).includes('No agreement yet. Send agreement turns on once every required document is verified.'));
    ok('…a verified one says who and when', /Verified by Garima Bhardwaj, \d+ \w+ 2026, \d\d:\d\d/.test(await main()));
    await p.getByRole('button', { name: /^Send back Owner/ }).click(); await wait(p, 500);
    await sheet().getByRole('button', { name: 'Reject and send back' }).click(); await wait(p, 300);
    ok('Send back: a note is required', (await sheet().locator('.field__msg--error').count()) === 1);
    await p.fill('#ops-why', 'The photo page is cut off.'); await sheet().getByRole('button', { name: 'Reject and send back' }).click(); await wait(p, 600);
    ok('…sent back with the note; the partner is “Documents sent back”', (await main()).includes('The photo page is cut off.') && (await p.locator('.irhead').innerText()).includes('Documents sent back'));
    await ctx.close(); }

  { const { p, ctx } = await open('home');
    const main = () => p.locator('main').innerText();
    const sheet = () => p.locator('.sheet').last();
    await nav(p, 'Recruitment partners'); await p.locator('.irow__open', { hasText: 'EduVista' }).click(); await wait(p, 700);
    await p.getByRole('tab', { name: /Documents/ }).click(); await wait(p, 500);
    for (let i = 0; i < 3; i++) { await p.getByRole('button', { name: /^Verify / }).first().click(); await wait(p, 300); }
    ok('Verify all: “Verified by Rohan Desai”; the partner is Activated', (await main()).includes('Verified by Rohan Desai') && (await p.locator('.irhead').innerText()).includes('Activated'));
    const send = p.getByRole('button', { name: /^Send agreement$/ });
    ok('…Send agreement turns on', await send.isEnabled());
    await send.click(); await wait(p, 500);
    const st = await sheet().innerText();
    ok('Send the agreement: title, subtitle, fields and buttons', st.includes('Send the agreement') && st.includes('It goes to the RP to sign and upload. Accepting the signed copy approves the partner.') && st.includes('PDF, up to 20 MB') && st.includes('What the RP sees, like “v4 · Nov 2026”.') && st.includes('Empty: the day the signed copy is accepted.') && st.includes('For GSP: what changed in this version.') && ['Cancel', 'Save draft', 'Send to the RP'].every((b) => st.includes(b)));
    await sheet().getByRole('button', { name: 'Send to the RP' }).click(); await wait(p, 300);
    ok('…empty: the file and the version are required', (await sheet().locator('.field__msg--error').count()) === 2);
    await p.setInputFiles('#ops-agr-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await wait(p, 200);
    ok('…a file that isn’t a PDF is refused', (await sheet().innerText()).includes('can’t be used here'));
    await p.setInputFiles('#ops-agr-file', { name: 'GSP-Partner-Agreement-v4.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2048) }); await wait(p, 200);
    await p.fill('#ops-agr-version', 'v4 · Nov 2026'); await p.fill('#ops-agr-notes', 'First agreement.');
    await sheet().getByRole('button', { name: 'Send to the RP' }).click(); await wait(p, 600);
    ok('…sent: “With the RP”; the button is off while it’s open', (await main()).includes('With the RP') && (await main()).includes('v4 · Nov 2026: with the RP to sign') && await p.getByRole('button', { name: /Send new agreement/ }).isDisabled());
    await p.getByRole('button', { name: /Prototype: the RP uploads/ }).click(); await wait(p, 400);
    ok('Prototype: the signed copy comes in, to Accept or Send back', (await main()).includes('Signed copy in') && /uploaded by Kiran Reddy/.test(await main()));
    await p.getByRole('button', { name: /^Accept$/ }).click(); await wait(p, 600);
    ok('Accept: “Accepted (active)”, the partner is approved (Agreement signed)', (await main()).includes('Accepted (active)') && (await p.locator('.irhead').innerText()).includes('Agreement signed') && /Accepted by Rohan Desai/.test(await main()));
    ok('…“Send new agreement” now', await p.getByRole('button', { name: /Send new agreement/ }).isEnabled());
    // Kathmandu: send back a signed copy with a note
    await nav(p, 'Recruitment partners'); await p.locator('.irow__open', { hasText: 'Kathmandu' }).click(); await wait(p, 700);
    await p.getByRole('tab', { name: /Documents/ }).click(); await wait(p, 500);
    await p.getByRole('button', { name: /Prototype: the RP uploads/ }).click(); await wait(p, 400);
    await p.getByRole('button', { name: /^Send back$/ }).click(); await wait(p, 400);
    await sheet().getByRole('button', { name: 'Reject and send back' }).click(); await wait(p, 300);
    ok('Agreement send back: a note is required', (await sheet().locator('.field__msg--error').count()) === 1);
    await p.fill('#ops-why', 'Page 3 isn’t signed.'); await sheet().getByRole('button', { name: 'Reject and send back' }).click(); await wait(p, 600);
    ok('…“Sent back”, with the note', (await main()).includes('Page 3 isn’t signed.') && (await main()).includes('Sent back by Rohan Desai'));
    // Horizon: v3 accepted, active from 1 Dec
    await nav(p, 'Recruitment partners'); await p.locator('.irow__open', { hasText: 'Horizon' }).click(); await wait(p, 700);
    await p.getByRole('tab', { name: /Documents/ }).click(); await wait(p, 500);
    const h = await main();
    ok('Horizon: v2 active, v3 accepted and active from 1 Dec 2026', h.includes('Accepted (active)') && h.includes('Active from 1 Dec 2026') && h.includes('v3 · Nov 2026, active from 1 Dec 2026'));
    ok('…columns Version, Status, Sent, Signed copy, Decision, Effective from', (await p.locator('.ops-agr thead th').allInnerTexts()).join('|') === 'Version|Status|Sent|Signed copy|Decision|Effective from');
    await ctx.close(); }

  // Master Partners (4 Nov): the list, New Master Partner, the page and its tabs, linking RPs
  { const { p, ctx } = await open('home');
    const main = () => p.locator('main').innerText();
    const sheet = () => p.locator('.sheet').last();
    await nav(p, 'Master Partners');
    ok('Master Partners: title and lead', (await h1(p)) === 'Master Partners' && (await main()).includes('Aggregators that bring several RPs under them.'));
    ok('…columns Master Partner, Country, Recruitment, RPs, Status', (await p.locator('table thead th').allInnerTexts()).join('|') === 'Master Partner|Country|Recruitment|RPs|Status', (await p.locator('table thead th').allInnerTexts()).join('|'));
    const statuses = await p.$$eval('#omp-status option', (o) => o.map((x) => x.textContent));
    ok('…statuses: All statuses, Active, Inactive', statuses.join('|') === 'All statuses|Active|Inactive');
    await p.fill('#omp-q', 'MP-1002'); await wait(p, 300);
    ok('…search by code', (await p.locator('table tbody tr').count()) === 1 && (await p.locator('#omp-count').innerText()).includes('1 of 2'));
    await p.fill('#omp-q', '');
    await p.getByRole('button', { name: 'New Master Partner' }).click(); await wait(p, 500);
    ok('New Master Partner: “Its code (MP-…) and sales region are set by the system.”', (await sheet().innerText()).includes('Its code (MP-…) and sales region are set by the system.'));
    await sheet().getByRole('button', { name: 'Save' }).click(); await wait(p, 300);
    ok('…empty: eight errors', (await sheet().locator('.field__msg--error').count()) === 8, String(await sheet().locator('.field__msg--error').count()));
    await p.fill('#mp-name', 'Dhaka Education Hub');
    await p.fill('#mp-country', 'Bangladesh'); await wait(p, 300); await p.keyboard.press('Enter'); await wait(p, 200);
    await p.fill('#mp-city', 'Dhaka');
    await p.fill('#mp-cname', 'Rafiq Hasan'); await p.fill('#mp-email', 'rafiq@dhakaedu.com.bd');
    await p.fill('#mp-phone', '1711 555 210').catch(async () => p.locator('.phone input').last().fill('1711 555 210'));
    await p.fill('#mp-cemail', 'accounts@dhakaedu.com.bd'); await wait(p, 200);
    const rec = await p.inputValue('#mp-rec');
    ok('…Recruitment fills in from Recruitment assignment once the location is in', !!rec, rec);
    await sheet().getByRole('button', { name: 'Save' }).click(); await wait(p, 700);
    ok('…saved: its page opens as MP-1003, Active', (await p.locator('.irhead').innerText()).includes('MP-1003') && (await p.locator('.irhead').innerText()).includes('Active'));
    ok('…Overview: Details note and System information', (await main()).includes('RP Ops onboards a Master Partner in person, outside the portal.') && (await main()).includes('System information') && (await main()).includes('Created by'));
    ok('…tabs Overview, RPs, Documents, Commission, Change log', (await p.getByRole('tab').allInnerTexts()).map((x) => x.replace(/\s*\d+$/, '').trim()).join('|') === 'Overview|RPs|Documents|Commission|Change log');
    // Edit
    await p.getByRole('button', { name: /Edit the details/ }).click(); await wait(p, 500);
    await p.fill('#mp-notes', 'Met at the Dhaka fair.'); await sheet().getByRole('button', { name: 'Save' }).click(); await wait(p, 500);
    ok('Edit: the notes show', (await main()).includes('Met at the Dhaka fair.'));
    // RPs: Link an RP
    await p.getByRole('tab', { name: /RPs/ }).click(); await wait(p, 400);
    ok('RPs: note and empty line', (await main()).includes('An RP links to at most one Master Partner.') && (await main()).includes('No RPs linked yet.'));
    await p.getByRole('button', { name: 'Link an RP' }).click(); await wait(p, 500);
    ok('Link an RP: Link is off until an RP is picked', await sheet().getByRole('button', { name: 'Link' }).isDisabled());
    await p.fill('#mp-link', 'AG-1043'); await wait(p, 300); await p.keyboard.press('Enter'); await wait(p, 300);
    await sheet().getByRole('button', { name: 'Link' }).click(); await wait(p, 600);
    ok('…linked: EduVista in the table, RPs 1', (await main()).includes('EduVista Consultants') && (await p.getByRole('tab', { name: /RPs/ }).innerText()).includes('1'));
    await p.getByRole('button', { name: 'EduVista Consultants', exact: true }).click(); await wait(p, 700);
    ok('…opens the RP, back to the Master Partner', (await h1(p)) === 'EduVista Consultants' && (await p.locator('.rback').innerText()).includes('Dhaka Education Hub'));
    ok('…the RP’s Master Partner is Dhaka Education Hub', (await p.locator('.irsec:has(#orp-gsp)').innerText()).includes('Dhaka Education Hub'));
    await p.locator('.rback').click(); await wait(p, 600);
    ok('…back lands on the Master Partner’s RPs', (await h1(p)) === 'Dhaka Education Hub' && (await p.getByRole('tab', { selected: true }).innerText()).startsWith('RPs'));
    // Unlink
    await p.getByRole('button', { name: /Unlink EduVista/ }).click(); await wait(p, 400);
    await p.locator('.confirm').getByRole('button', { name: 'Unlink' }).click(); await wait(p, 500);
    ok('Unlink: back to no RPs', (await main()).includes('No RPs linked yet.'));
    // Documents: Upload a document
    await p.getByRole('tab', { name: /Documents/ }).click(); await wait(p, 400);
    ok('Documents: “Uploaded by RP Ops. No checking, verification or agreement signing.”', (await main()).includes('Uploaded by RP Ops. No checking, verification or agreement signing.') && (await main()).includes('No documents yet.'));
    await p.getByRole('button', { name: 'Upload a document' }).click(); await wait(p, 500);
    await p.setInputFiles('#mp-doc-file', { name: 'Trade-licence.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(4096) }); await wait(p, 200);
    ok('…the name fills in from the file', (await p.inputValue('#mp-doc-name')) === 'Trade licence');
    await sheet().getByRole('button', { name: 'Upload' }).click(); await wait(p, 600);
    ok('…uploaded, by Rohan Desai', (await main()).includes('Trade licence') && (await main()).includes('Uploaded by Rohan Desai'));
    // Commission
    await p.getByRole('tab', { name: /Commission/ }).click(); await wait(p, 400);
    await p.getByRole('button', { name: /Edit the commission terms/ }).click(); await wait(p, 400);
    await p.fill('#mp-share', '75'); await sheet().getByRole('button', { name: 'Save' }).click(); await wait(p, 500);
    ok('Commission: 75%', (await main()).includes('75%'));
    // Change log
    await p.getByRole('tab', { name: /Change log/ }).click(); await wait(p, 400);
    const log = await p.locator('.aact__text').allInnerTexts();
    ok('Change log: every change, newest first, ending with “Added as MP-1003”', log[0].startsWith('Share of GSP’s commission set to 75%') && log.includes('Uploaded Trade licence') && log.includes('Linked EduVista Consultants (AG-1043)') && log.includes('Unlinked EduVista Consultants (AG-1043)') && log.includes('Edited the details') && log[log.length - 1] === 'Added as MP-1003', log.join(' | '));
    // Set inactive
    await p.getByRole('button', { name: 'Set inactive' }).click(); await wait(p, 400);
    await p.locator('.confirm').getByRole('button', { name: 'Set inactive' }).click(); await wait(p, 500);
    await p.getByRole('tab', { name: /RPs/ }).click(); await wait(p, 300);
    ok('Set inactive: Inactive; Link an RP is off', (await p.locator('.irhead').innerText()).includes('Inactive') && await p.getByRole('button', { name: 'Link an RP' }).isDisabled());
    // from the RP side: Link a Master Partner offers active ones only
    await nav(p, 'Recruitment partners'); await p.locator('.irow__open', { hasText: 'BrightPath' }).click(); await wait(p, 700);
    await p.getByRole('button', { name: 'Link a Master Partner' }).click(); await wait(p, 400);
    const opts = await p.$$eval('#ops-pick option', (o) => o.map((x) => x.textContent));
    ok('RP: Link a Master Partner offers the active ones', opts.includes('South Asia Study Alliance') && !opts.includes('Dhaka Education Hub'), opts.join('|'));
    await p.selectOption('#ops-pick', 'South Asia Study Alliance'); await sheet().getByRole('button', { name: 'Link' }).click(); await wait(p, 500);
    await nav(p, 'Master Partners');
    ok('…the Master Partners list counts it', (await p.locator('tr', { hasText: 'South Asia Study Alliance' }).locator('td').nth(3).innerText()).trim() === '1');
    await ctx.close(); }

  // GSP · Institution's Recruitment partners don't change
  { const { p, ctx } = await open('home', 'institution-partner');
    await p.locator('.pnav__item', { hasText: /^\s*Recruitment partners\s*$/ }).first().click().catch(() => {}); await wait(p, 700);
    const rows = p.locator('table tbody tr');
    if (await rows.count()) { await p.locator('.irow__open', { hasText: 'EduVista' }).click(); await wait(p, 700);
      await p.getByRole('tab', { name: /Documents/ }).click().catch(() => {}); await wait(p, 400); }
    const t = await p.locator('main').innerText();
    ok('GSP · Institution: no Verify, Send back or Send agreement there', !/\bVerify\b|Send agreement|Reject and send back/.test(t));
    await ctx.close(); }

  // its own sign-in
  { const { p, ctx } = await open('signin');
    const t = await p.locator('main').innerText();
    ok('sign-in: “Sign in to RP Ops with your GSP email.”', t.includes('Sign in to RP Ops with your GSP email.'));
    await p.fill('input[type=email], #ts-id, input[autocomplete=username]', 'rohan.desai@gsp.upgrad.com').catch(() => {});
    await ctx.close(); }

  // GSP · Institution keeps its own person
  { const { p, ctx } = await open('home', 'institution-partner');
    ok('GSP · Institution still signed in as Raj Shamani', (await p.locator('.shell__side').innerText()).includes('Raj Shamani'));
    await ctx.close(); }

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
