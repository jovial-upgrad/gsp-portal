// PARITY: the GSP Team suite, run as Institution Partner. GSP Team, application page: Mail, Submission, status change, census and fee, Request document, Documents in tabs.
// Also checks RP Admin's application page is unchanged.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? pass++ : fails.push(m));

(async () => {
  const b = await chromium.launch();
  const open = async (role, hash) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((r) => { try { localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); } catch {} }, role);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL + '#' + hash);
    await p.waitForTimeout(1600);
    return { p, ctx, errs };
  };
  const tabs = async (p) => (await p.getByRole('tab').allInnerTexts()).map((t) => t.replace(/\s*\d+$/, '').trim());
  const activity = async (p) => {
    await p.getByRole('tab', { name: /Activity/ }).click();
    await p.waitForTimeout(400);
    return p.locator('.aact').innerText();
  };

  // the status dialog (28 Oct, 3rd round): dropdowns that drop from their fields, no remarks, closing asks first
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const menuPick = async (p, id, value) => {
    await p.locator('#' + id).click();
    await wait(150);
    await p.locator(`.smenu__list [data-value="${value}"]`).click();
    await wait(150);
  };
  const menuOpts = async (p, id) => {
    await p.locator('#' + id).click();
    await wait(150);
    const t = await p.locator('.smenu__list [role=option] .cbx__name').allInnerTexts();
    await p.locator('#' + id).press('Escape');
    await wait(150);
    return t;
  };
  const pickStatus = async (p, k) => {
    const m = /^end:(\d+):/.exec(k);
    for (let i = m ? Number(m[1]) : 0; i < 8; i++) {
      await menuPick(p, 'gstat-stage', String(i));
      await p.locator('#gstat-status').click();
      await wait(150);
      const o = p.locator(`.smenu__list [data-value="${k}"]`);
      if (await o.count()) return (await o.click(), wait(150));
      await p.locator('#gstat-status').press('Escape');
      await wait(100);
    }
    throw new Error('no status ' + k);
  };
  const changeStatus = async (p, k) => {
    await p.locator('.gstat__change').click();
    await wait(300);
    await pickStatus(p, k);
    await p.locator('.gstat').getByRole('button', { name: 'Change status' }).click();
    await wait(300);
    if (k.startsWith('end:')) await p.locator('.confirm').getByRole('button', { name: 'Close application' }).click();
    await wait(500);
  };

  /* ---------- the offer: tabs, chat, request ---------- */
  {
    const { p, ctx, errs } = await open('institution-partner', 'application-offer');
    ok(JSON.stringify(await tabs(p)) === JSON.stringify(['Chat', 'Mail', 'Documents', 'Submission', 'Activity']), 'five tabs in order: ' + (await tabs(p)));
    ok((await p.locator('#atab-mail .atabs__badge').innerText()) === '1', 'mail tab shows 1 unread');
    ok(await p.getByText('Chat with BrightPath Overseas').isVisible(), 'chat is with the RP');
    ok((await p.locator('.aperson .acard__title').innerText()) === 'RP contact', 'side card is the RP contact');
    ok(await p.locator('.aperson__name', { hasText: 'Karthik Nair' }).isVisible(), 'RP contact is the counsellor');

    // a message
    await p.locator('#achat-input').fill('Can you send the transcript this week?');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(500);
    const last = p.locator('.achat__list > li').last();
    ok((await last.getAttribute('class')).includes('msg--you'), 'own message on the right');
    ok((await last.innerText()).includes('Can you send the transcript'), 'own message text');

    // Request document: validation, then send
    await p.getByRole('button', { name: 'Request document' }).click();
    await p.waitForTimeout(300);
    ok(await p.locator('.greq').isVisible(), 'request form opens');
    ok(!(await p.locator('#achat-input').isVisible()), 'message box hides while requesting');
    ok(await p.locator('#greq-title').evaluate((el) => el === document.activeElement), 'title has focus');
    await p.getByRole('button', { name: 'Send request' }).click();
    ok((await p.locator('.greq .gmail__err').innerText()).includes('Add a title'), 'title required');
    await p.locator('#greq-title').fill('Passport copy, all pages');
    await p.getByRole('button', { name: 'Send request' }).click();
    ok((await p.locator('.greq .gmail__err').innerText()).includes('Say what'), 'text required');
    await p.locator('#greq-text').fill('Deakin needs every page, including the blank ones.');
    await p.locator('#greq-due').fill('2026-11-10');
    await p.getByRole('button', { name: 'Send request' }).click();
    await p.waitForTimeout(500);
    ok(!(await p.locator('.greq').count()), 'request form closes');
    const card = p.locator('.areq').last();
    ok((await card.innerText()).includes('Passport copy, all pages'), 'request card in the chat');
    ok((await card.innerText()).includes('With RP'), 'request card says With RP');
    ok((await card.innerText()).includes('Due 10 Nov'), 'request card shows the due date');
    ok((await p.locator('.aneed:not(.aneed--gsp) .aneed__text').innerText()).includes('Passport copy, all pages (you asked)'), 'banner lists the request');

    // Documents: the request is With RP, read-only
    await p.getByRole('tab', { name: /Documents/ }).click();
    await p.waitForTimeout(400);
    const req = p.locator('.nrow', { hasText: 'Passport copy, all pages' });
    ok(await req.isVisible(), 'request in With RP');
    ok((await req.innerText()).includes('You asked'), 'request tagged You asked');
    ok((await p.locator('.aneeds input[type=file]').count()) === 0, 'no upload in With RP');
    ok((await p.getByRole('button', { name: 'Send to GSP' }).count()) === 0, 'no Send to GSP');

    // Documents (28 Oct, 2nd round): one card in tabs with counts, as in RP Admin
    const dtabs = await p.locator('.adtab').evaluateAll((e) => e.map((x) => x.textContent.replace(/\s+/g, '')));
    ok(dtabs.length === 5 && /^All\d+$/.test(dtabs[0]) && /^Toreview\d+$/.test(dtabs[1]) && /^WithRP\d+$/.test(dtabs[2]) && /^Approved\d+$/.test(dtabs[3]) && /^Conditions\d+$/.test(dtabs[4]), 'tabs: ' + dtabs.join('|'));
    ok((await p.locator('#gdtab-all').getAttribute('aria-selected')) === 'true' && (await p.locator('.gchip').count()) === 0, 'All on first; no filter chips');
    ok(await p.locator('.adocs__k', { hasText: 'By GSP' }).isVisible(), 'All: what GSP added');
    await p.locator('#gdtab-rp').click();
    await p.waitForTimeout(300);
    ok((await p.locator('.nrow', { hasText: 'Passport copy, all pages' }).isVisible()) && (await p.locator('.adocs__k', { hasText: 'By GSP' }).count()) === 0, 'With RP: the request, and not GSP’s documents');
    await p.locator('#gdtab-approved').click();
    await p.waitForTimeout(300);
    ok((await p.locator('.adoc .dpill').allInnerTexts()).every((x) => x === 'Approved') && (await p.locator('.nrow').count()) === 0, 'Approved: only what GSP approved');
    await p.locator('#gdtab-conditions').click();
    await p.waitForTimeout(300);
    ok((await p.locator('.condcard.is-rp').count()) === 1 && (await p.locator('#gdtab-conditions .adtab__n').innerText()) === '1', 'Conditions: the offer’s form, with the RP, counted as one set');
    ok((await p.locator('.condcard .ccard__kind, .condcard__kind').count()) === 0, 'questions only: no kind on the card');
    ok(await p.locator('.condcard').evaluate((el) => { const s = getComputedStyle(el); return s.borderLeftWidth === s.borderTopWidth && s.boxShadow === 'none'; }), 'the card’s left border is like its other sides');
    await p.locator('.condcard').first().click();
    await p.waitForTimeout(400);
    ok((await p.locator('.conddlg').innerText()).includes('Genuine Student statement'), 'a conditions card opens in a dialog');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    await p.locator('#gdtab-all').click();
    await p.waitForTimeout(300);
    ok((await p.locator('.adoc .dpill--uni').count()) === 0, 'By GSP: no pill');
    const gspList = p.locator('.adocs__k + .adocs__list .adoc');
    const byGsp = await gspList.count();
    ok(!/\d{1,2} [A-Z][a-z]{2}/.test(await gspList.first().locator('.adoc__file').innerText()), 'By GSP: no date: ' + (await gspList.first().locator('.adoc__file').innerText()));
    await p.locator('#gdocs-file').setInputFiles({ name: 'Deakin_CoE_Priya_Raman.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await p.waitForTimeout(500);
    ok((await p.locator('.gname .sheet__title').innerText()) === 'Name the document' && (await p.locator('#gname-name').inputValue()) === 'Deakin CoE Priya Raman', 'upload: name it first, starting from the file');
    await p.locator('#gname-name').fill('');
    await p.locator('.gname').getByRole('button', { name: 'Add to documents' }).click();
    ok(await p.getByText('Give it a name').isVisible(), 'a name is needed');
    await p.locator('.gname').getByRole('button', { name: 'Confirmation of Enrolment (CoE)' }).click();
    ok((await p.locator('#gname-name').inputValue()) === 'Confirmation of Enrolment (CoE)', 'a usual name fills it');
    await p.locator('.gname').getByRole('button', { name: 'Add to documents' }).click();
    await p.waitForTimeout(500);
    const added = p.locator('.adoc', { hasText: 'Deakin_CoE_Priya_Raman.pdf' });
    ok((await added.isVisible()) && (await added.locator('.adoc__name').innerText()) === 'Confirmation of Enrolment (CoE)' && (await gspList.count()) === byGsp + 1, 'GSP upload listed by the name given');

    const act = await activity(p);
    ok(act.includes('Asked the RP for the passport copy, all pages'), 'activity: request');
    ok(act.includes('Uploaded Deakin_CoE_Priya_Raman.pdf'), 'activity: GSP upload');
    ok(errs.length === 0, 'no errors (offer): ' + errs.join('|'));
    await ctx.close();
  }

  /* ---------- mail ---------- */
  {
    const { p, ctx, errs } = await open('institution-partner', 'application-offer');
    await p.getByRole('tab', { name: /Mail/ }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('.gmail__item').count()) === 2, 'two mails');
    ok((await p.locator('.gmail__item.is-unread').count()) === 1, 'one unread');
    await p.locator('.gmail__item.is-unread').click();
    await p.waitForTimeout(400);
    ok((await p.locator('#atab-mail .atabs__badge').count()) === 0, 'reading clears the badge');
    ok((await p.locator('.gmail__title').innerText()).startsWith('Conditional offer of admission'), 'reader shows the subject');
    ok(await p.locator('.gmail__files', { hasText: 'Deakin_conditional_offer_Priya_Raman.pdf' }).isVisible(), 'attachment shown');
    await p.getByRole('button', { name: 'Summarise' }).click();
    await p.waitForTimeout(300);
    ok(await p.getByText('Reading the mail…').isVisible(), 'summary: working state');
    await p.waitForTimeout(1300);
    const sum = await p.locator('.gmail__sum-list li').allInnerTexts();
    ok(sum.length === 3 && sum[2].includes('deposit'), 'summary has 3 lines: ' + sum.join(' / '));
    ok((await p.getByRole('button', { name: 'Summarise' }).count()) === 0, 'Summarise goes once used');

    // reply, keep as a draft, reopen, send
    await p.getByRole('button', { name: 'Reply' }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('#gm-to').inputValue()) === 'offers@deakin.edu.au', 'reply goes to the sender');
    ok((await p.locator('#gm-subject').inputValue()).startsWith('Re: Conditional offer'), 'reply subject');
    ok((await p.locator('#gm-body').inputValue()).includes('> Dear Meera,'), 'reply quotes the mail');
    ok(await p.locator('#gm-body').evaluate((el) => el === document.activeElement), 'reply starts in the text');
    await p.locator('#gm-body').press('Home');
    await p.keyboard.type('Thank you, we will send both conditions by 15 Nov.');
    await p.getByRole('button', { name: 'Save draft' }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('.gmail__item').count()) === 3, 'draft listed');
    ok(await p.locator('.gmail__tag--draft').isVisible(), 'draft tag');
    await p.locator('.gmail__item', { has: p.locator('.gmail__tag--draft') }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('#gm-body').inputValue()).startsWith('Thank you, we will send'), 'draft reopens with its text');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('.gmail__title').innerText()).startsWith('Re: Conditional offer'), 'sent mail opens');
    await p.getByRole('button', { name: 'All mail' }).click();
    await p.waitForTimeout(300);
    ok((await p.locator('.gmail__tag--draft').count()) === 0, 'draft gone once sent');
    ok((await p.locator('.gmail__tag', { hasText: 'Sent' }).count()) === 1, 'sent tag');

    // forward carries the files; new mail validates
    await p.locator('.gmail__item', { has: p.locator('.gmail__from', { hasText: /^Deakin University Offers$/ }) }).click();
    await p.getByRole('button', { name: 'Forward' }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('#gm-subject').inputValue()).startsWith('Fwd: '), 'forward subject');
    ok(await p.locator('.gmail__compose .msg__file', { hasText: 'Deakin_conditional_offer' }).isVisible(), 'forward carries the attachment');
    ok(await p.locator('#gm-to').evaluate((el) => el === document.activeElement), 'forward starts at To');
    await p.getByRole('button', { name: 'Discard' }).click();
    await p.waitForTimeout(300);
    ok(await p.getByRole('button', { name: 'Reply' }).isVisible(), 'discarding a forward returns to the mail');
    await p.getByRole('button', { name: 'All mail' }).click();
    await p.getByRole('button', { name: 'New mail' }).click();
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    ok((await p.locator('.gmail__err').innerText()).includes('Add who it’s to'), 'new mail: To required');
    await p.locator('#gm-to').fill('not-an-address');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    ok((await p.locator('.gmail__err').innerText()).includes('as an email address'), 'new mail: To must be an address');
    await p.locator('#gm-to').fill('admissions@deakin.edu.au');
    await p.locator('#gm-subject').fill('Census date for Priya Raman');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    ok((await p.locator('.gmail__err').innerText()).includes('Write the message'), 'new mail: text required');
    await p.locator('#gm-body').fill('Could you confirm the census date for the Feb 2027 intake?');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    await p.waitForTimeout(300);
    const act = await activity(p);
    ok(act.includes('GSP emailed offers@deakin.edu.au'), 'activity: reply sent');
    ok(act.includes('Census date for Priya Raman'), 'activity: new mail sent');
    ok(errs.length === 0, 'no errors (mail): ' + errs.join('|'));
    await ctx.close();
  }

  /* ---------- submission, status, key details ---------- */
  {
    const { p, ctx, errs } = await open('institution-partner', 'application-offer');
    await p.getByRole('tab', { name: /Submission/ }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('.gsub__via').innerText()) === 'Through StudyLink', 'Deakin goes through StudyLink');
    ok(await p.locator('.gsub__link').isVisible(), 'portal link');
    ok((await p.locator('.gsub__link').getAttribute('target')) === '_blank', 'link opens in a new tab');
    const pw = p.locator('.gsub__cred', { hasText: 'Password' }).locator('.gsub__val');
    ok(/^•{12}Hidden$/.test(await pw.textContent()), 'password hidden: ' + (await pw.textContent()));
    await p.getByRole('button', { name: 'Show password' }).click();
    ok(/^Gsp-DEA-\d{4}!$/.test(await pw.innerText()), 'password shown: ' + (await pw.innerText()));
    ok((await p.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')) === 'true', 'eye is pressed');
    ok((await p.locator('.gsub__creds .scopy').count()) === 4, 'copy for link, username, password (+ eye): ' + (await p.locator('.gsub__creds .scopy').count()));
    await p.getByRole('button', { name: /Copy username/i }).click().catch(() => p.locator('.gsub__cred', { hasText: 'Username' }).locator('.scopy').click());

    // the reference: edit, confirm, keep; then change
    ok((await p.locator('.gsub__ref .gsub__mono').innerText()) === 'DKN-2611407', 'reference shown');
    await p.locator('.gsub').getByRole('button', { name: 'Edit' }).click();
    await p.locator('#gsub-ref-input').fill('x');
    await p.getByRole('button', { name: 'Save' }).click();
    ok((await p.locator('#gsub-ref-note').innerText()).includes('3 to 30'), 'reference: bad format');
    await p.locator('#gsub-ref-input').fill('dkn-2611470');
    await p.getByRole('button', { name: 'Save' }).click();
    await p.waitForTimeout(300);
    ok(await p.getByRole('heading', { name: 'Change the university reference?' }).isVisible(), 'confirm before changing');
    ok(await p.getByRole('button', { name: 'Keep DKN-2611407' }).isVisible(), 'keep button names the old one');
    await p.getByRole('button', { name: 'Keep DKN-2611407' }).click();
    await p.waitForTimeout(300);
    ok((await p.locator('.ahead__kicker').innerText()).includes('DKN-2611407'), 'kept: header unchanged');
    await p.getByRole('button', { name: 'Save' }).click();
    await p.getByRole('button', { name: 'Change it' }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('.gsub__ref .gsub__mono').innerText()) === 'DKN-2611470', 'reference changed, uppercased');
    ok((await p.locator('.ahead__kicker').innerText()).includes('DKN-2611470'), 'header shows the new reference');

    // census date and fee
    await p.getByRole('button', { name: 'Edit the census date' }).click();
    ok(await p.locator('#gedit-census').evaluate((el) => el === document.activeElement), 'census field has focus');
    await p.locator('#gedit-census').fill('2027-03-15');
    await p.locator('.gedit').getByRole('button', { name: 'Save' }).click();
    await p.waitForTimeout(300);
    ok((await p.locator('.gedit', { hasText: 'Census date' }).innerText()).includes('15 Mar 2027'), 'census date saved');
    await p.getByRole('button', { name: 'Edit the final tuition fee' }).click();
    await p.locator('#gedit-fee').fill('abc');
    await p.locator('.gedit').getByRole('button', { name: 'Save' }).click();
    ok(await p.locator('.gedit__err').isVisible(), 'fee: number required');
    await p.locator('#gedit-fee').fill('32,500');
    await p.locator('.gedit').getByRole('button', { name: 'Save' }).click();
    await p.waitForTimeout(300);
    const fee = await p.locator('.gedit', { hasText: 'Final tuition fee' }).innerText();
    ok(fee.includes('AUD 32,500') && fee.includes('listed AUD 35,800'), 'fee saved with the listed one: ' + fee);
    await p.getByRole('button', { name: 'Edit the final tuition fee' }).click();
    await p.waitForTimeout(150);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    ok((await p.locator('#gedit-fee').count()) === 0, 'Escape cancels the edit');
    await p.waitForTimeout(100);
    ok(await p.getByRole('button', { name: 'Edit the final tuition fee' }).evaluate((el) => el === document.activeElement), 'focus back on the pencil');

    // the status, changed by hand
    await p.locator('.gstat__change').click();
    await p.waitForTimeout(400);
    ok(await p.getByRole('heading', { name: 'Change status' }).isVisible(), 'status dialog');
    ok((await p.locator('#gstat-reason').count()) === 0, 'no remarks (28 Oct, 3rd round)');
    ok((await p.locator('#gstat-status .smenu__value').innerText()) === 'Conditional offer received, conditions pending', 'Status: starts as the current one');
    await p.locator('.gstat').getByRole('button', { name: 'Change status' }).click();
    ok(await p.getByText('That’s the status it’s at now. Pick another.').isVisible(), 'unchanged: pick another');
    ok((await p.locator('#gstat-stage .smenu__value').innerText()) === '4. Offer' && (await p.locator('#gstat-stage .smenu__note').innerText()) === 'Now', 'Stage: starts on the current one');
    const stages = await menuOpts(p, 'gstat-stage');
    ok(stages.length === 8 && stages[0] === '1. New' && stages[3] === '4. Offer', 'Stage: the 8 stages: ' + stages.join('|'));
    const sts = await menuOpts(p, 'gstat-status');
    ok(sts.join('|') === 'Conditional offer received, conditions pending|Conditions submitted to university|Document re-upload pending|Closed: Offer declined|Closed: Student withdrawn|Closed: Deferred', 'Status: the stage’s statuses and how it can close: ' + sts.join('|'));
    await p.locator('#gstat-status').click();
    await p.waitForTimeout(150);
    ok((await p.locator('.smenu__list [aria-selected=true] .cbx__dial').innerText()) === 'Now' && (await p.locator('.smenu__list [role=option].is-active').innerText()).startsWith('Conditional offer'), 'current status marked Now, and where the list starts');
    // by keyboard: down one, Enter
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(200);
    ok((await p.locator('.smenu__list').count()) === 0 && (await p.locator('#gstat-status .smenu__value').innerText()) === 'Conditions submitted to university', 'arrow keys and Enter pick');
    await p.locator('.gstat').getByRole('button', { name: 'Change status' }).click();
    await p.waitForTimeout(500);
    ok((await p.locator('.ahead__st').innerText()) === 'Conditions submitted to university', 'status changed in the header');
    ok((await p.locator('.ahead__status .who').innerText()) === 'University', 'tag follows the status: ' + (await p.locator('.ahead__status .who').innerText()));
    const act = await activity(p);
    ok(act.includes('Changed the status from “Conditional offer received, conditions pending” to “Conditions submitted to university”'), 'activity: the status change');
    ok(act.includes('Changed the university reference from DKN-2611407 to DKN-2611470'), 'activity: reference');
    ok(act.includes('Set the census date to 15 Mar 2027'), 'activity: census');
    ok(act.includes('Set the final tuition fee to AUD 32,500'), 'activity: fee');
    ok(/Freddy Forrest/.test(act), 'activity: by the signed-in GSP person');

    // desk changes survive leaving the application
    await p.getByRole('button', { name: 'Applications' }).first().click();
    await p.waitForTimeout(500);
    await p.locator('.arow', { hasText: 'GSP-24102' }).first().click().catch(() => p.getByText('Priya Raman').first().click());
    await p.waitForTimeout(800);
    ok((await p.locator('.gedit', { hasText: 'Census date' }).innerText()).includes('15 Mar 2027'), 'census date kept after leaving');
    ok(errs.length === 0, 'no errors (submission): ' + errs.join('|'));
    await ctx.close();
  }

  /* ---------- not submitted yet: the reference waits ---------- */
  {
    const { p, ctx, errs } = await open('institution-partner', 'application-reupload');
    await p.getByRole('tab', { name: /Submission/ }).click();
    await p.waitForTimeout(400);
    ok(await p.locator('#gsub-ref-input').isDisabled(), 'reference locked before submission');
    ok((await p.locator('#gsub-ref-note').innerText()).includes('once the application is submitted'), 'says why it’s locked');
    ok((await p.locator('#atab-submission .atabs__badge').count()) === 0, 'no badge before submission');
    await p.getByRole('button', { name: 'More for this application' }).click();
    await p.waitForTimeout(200);
    const more = await p.locator('.mmenu [role=menuitem]').allInnerTexts();
    ok(more.map((x) => x.trim()).join('|') === 'Student profile|Withdraw application', 'More: no Change status, no Write to the university: ' + more.join('|'));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    await changeStatus(p, 'lodged');
    ok((await p.locator('#atab-submission .atabs__badge').innerText()) === '1', 'submitted without a reference: badge');
    ok(!(await p.locator('#gsub-ref-input').isDisabled()), 'reference open once submitted');
    await p.locator('#gsub-ref-input').fill('cov-778812');
    await p.getByRole('button', { name: 'Submit' }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('.gsub__ref .gsub__mono').innerText()) === 'COV-778812', 'reference added without a confirmation');
    ok((await p.locator('#atab-submission .atabs__badge').count()) === 0, 'badge clears');
    ok(errs.length === 0, 'no errors (not submitted): ' + errs.join('|'));
    await ctx.close();
  }

  /* ---------- Add an application, as in RP Admin (28 Oct) ---------- */
  {
    const { p, ctx, errs } = await open('institution-partner', 'application-new');
    // 30 Oct: GSP adds an application for a recruitment partner; their students show once it's picked
    ok((await p.locator('label[for=na-rp]').innerText()).includes('Recruitment partner') && (await p.locator('#na-student').count()) === 0, 'GSP add: the recruitment partner first');
    await p.selectOption('#na-rp', 'Horizon Overseas');
    await p.waitForTimeout(200);
    await p.selectOption('#na-student', 'S-24781');
    await p.waitForTimeout(200);
    ok((await p.$$('.nachip')).length === 0, 'GSP add: no pills under the student');
    ok((await p.locator('label[for=na-dest]').innerText()).trim() === 'Destination', 'GSP add: Destination');
    ok((await p.locator('label[for=na-level]').innerText()).trim() === 'Program Level' && (await p.locator('label[for=na-area]').innerText()).trim() === 'Study Area', 'GSP add: Program Level, Study Area');
    await p.selectOption('#na-dest', 'Australia');
    await p.waitForTimeout(300);
    await p.locator('.napick__opt').first().click();
    await p.waitForTimeout(1300);
    ok((await p.locator('.nacheck__what').innerText()).includes('is checking Fatima’s profile details'), 'GSP add: says what the check is doing');
    await p.waitForTimeout(4300);
    ok((await p.locator('.nareason').first().innerText()).includes('takes students from India.'), 'GSP add: where they live by country');
    const twelfth = p.locator('.mdoc', { has: p.locator('.mdoc__name', { hasText: '12th marksheet' }) });
    await twelfth.locator('input[type=file]').setInputFiles({ name: 'rohit_12th.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
    await p.waitForTimeout(3400);
    ok((await twelfth.locator('.mfile__note').innerText()) === 'The student name in the document is mismatched.' && (await twelfth.locator('.mdoc__pill').innerText()) === 'Re-upload', 'GSP add: name mismatch asks to re-upload');
    ok(errs.length === 0, 'no errors (GSP add): ' + errs.join('|'));
    await ctx.close();
  }

  /* ---------- RP Admin: unchanged ---------- */
  {
    const { p, ctx, errs } = await open('rp-admin', 'application-offer');
    ok(JSON.stringify(await tabs(p)) === JSON.stringify(['Chat', 'Documents', 'Activity']), 'RP: three tabs');
    ok((await p.locator('.gstat__change').count()) === 0, 'RP: no status change');
    ok((await p.locator('.aperson .acard__title').innerText()) === 'Your GSP contact', 'RP: GSP contact');
    ok((await p.locator('.gedit').count()) === 0, 'RP: no editable details');
    ok(await p.getByText('Tuition, per year').isVisible(), 'RP: tuition row as before');
    await p.getByRole('tab', { name: /Documents/ }).click();
    await p.waitForTimeout(400);
    ok((await p.locator('.gchip').count()) === 0, 'RP: no documents filter');
    ok(JSON.stringify(await p.locator('.adtab').evaluateAll((l) => l.map((x) => x.firstChild.textContent.trim()))) === JSON.stringify(['All', 'Pending', 'In review', 'Approved', 'Conditions']), 'RP: its own Documents, in tabs by state, with Conditions');
    ok(errs.length === 0, 'no errors (RP): ' + errs.join('|'));
    await ctx.close();
  }

  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  for (const f of fails) console.log('  FAIL', f);
  process.exit(fails.length ? 1 : 0);
})();
