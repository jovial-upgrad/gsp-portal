// Applications: empty state, the list (tiles, filters, search), an application (student-led header, one owner tag, Chat,
// Documents, Activity; needs, AI file checks, send, chat, draft, handover, withdraw, no backups), adding one (eligibility, alternatives, duplicates, success), and links
// with Students and Find courses.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
const file = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('x') });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const txt = async (sel) => ((await p.textContent(sel, { timeout: 2000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  const ids = () => p.$$eval('.arow .arow__open', (e) => e.map((x) => x.textContent.trim()));
  const go = async (hash, wait = 1600) => { await p.goto(URL + '#' + hash); await p.waitForTimeout(wait); await p.waitForFunction(() => !document.querySelector('.is-reading, .is-writing'), null, { timeout: 4000 }); };
  const click = (sel) => p.locator(sel).first().evaluate((e) => e.click());
  const answered = async () => { await p.waitForSelector('.msg--typing', { state: 'detached', timeout: 8000 }); await p.waitForTimeout(300); };

  // empty
  await go('applications-empty');
  ok('empty: no applications yet, the 8 stages, Add application', (await txt('#aempty-title')) === 'No applications yet' && (await p.$$('.aempty__stop')).length === 8 && (await txt('.aempty .sempty__acts')).includes('Add application'));
  await p.click('.aempty button:has-text("Add application")'); await p.waitForTimeout(600);
  ok('…which opens Add an application', (await txt('#sheet-title')) === 'Add an application');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // the list (review, 27 Oct): no GSP Assist brief; tiles without subtexts; primary filters
  await p.goto(URL + '#applications'); await p.waitForSelector('.atab'); await p.waitForTimeout(300);
  ok('no GSP Assist brief on the list', !(await p.$('.abrief')) && !(await p.$('.abcard')));
  ok('8 columns in order', (await p.$$eval('.atab thead th', (e) => e.map((x) => x.textContent))).join('|') === 'Application|Student|Course|Intake|Destination|Counsellor|Stage|Status');
  ok('9 applications, the 4 pending on you first', (await ids()).length === 9 && (await p.$$eval('.arow', (e) => e.slice(0, 4).every((r) => r.classList.contains('arow--you')))));
  ok('tiles: 9 all, 4 pending on you, 2 with GSP, 2 with universities (28 Oct: awaiting the acceptance letter is GSP’s)', (await p.$$eval('.atile__n', (e) => e.map((x) => x.textContent))).join() === '9,4,2,2' && !(await p.$('.atile__sub')));
  ok('no “new” tags in the list', !(await p.$('.arow__new')) && !(await txt('.atab')).match(/\d new/));
  ok('course column: course, then university', (await txt('.arow:has-text("GSP-24097") .arow__cname')) === 'Master of Data Science' && (await txt('.arow:has-text("GSP-24097") .arow__uni')) === 'University of Wollongong');
  ok('status: owner and the PM wording, no line under it (review, 27 Oct)', (await txt('.arow:has-text("GSP-24097") .astat__own')) === 'With university' && (await txt('.arow:has-text("GSP-24097") .astat__text')) === 'Submitted to university' && !(await p.$('.arow__clock')));
  ok('stage: 8 segments and the stage name', (await p.$$('.arow:has-text("GSP-24102") .smeter span')).length === 8 && (await txt('.arow:has-text("GSP-24102") .arow__sname')) === 'Offer 4/8');
  await p.click('.atile--you'); await p.waitForTimeout(250);
  ok('Pending on you tile: 4', (await ids()).length === 4 && (await txt('#atable-count')).startsWith('4 of 9'));
  await p.click('.atile--all'); await p.click('.amile:has-text("Offer received")'); await p.waitForTimeout(250);
  ok('Offer received: Priya’s offer', (await ids()).sort().join() === 'GSP-24102');
  await p.click('.amile:has-text("Offer received")'); await p.fill('#ap-q', 'UOW-55'); await p.waitForTimeout(250);
  ok('search by university reference', (await ids()).join() === 'GSP-24097');
  // 3 Nov: the search no longer matches the passport number; the student's name finds both of Priya's
  await p.fill('#ap-q', 'v8810342'); await p.waitForTimeout(250);
  ok('a passport number no longer matches', (await ids()).length === 0);
  await p.fill('#ap-q', 'Priya Raman'); await p.waitForTimeout(250);
  ok('search by student name finds both of Priya’s', (await ids()).sort().join() === 'GSP-24097,GSP-24102', JSON.stringify(await ids()));
  await p.fill('#ap-q', ''); await p.selectOption('#ap-dest', 'UK'); await p.waitForTimeout(250);
  ok('UK: 3', (await ids()).length === 3);
  await p.selectOption('#ap-dest', ''); await p.selectOption('#ap-who', 'me'); await p.waitForTimeout(250);
  ok('my students’ applications: Sneha’s 3', (await ids()).length === 3);
  await p.click('.stools__clear'); await p.waitForTimeout(200);
  ok('Clear filters', (await ids()).length === 9);

  // an application (review, 27 Oct): led by the student, the status and one tag in the corner, Chat first
  await click('.arow:has-text("GSP-24102") .arow__open'); await p.waitForSelector('.ahead'); await p.waitForTimeout(500);
  ok('header: the student is the title, no ID line above it (28 Oct)', (await txt('.ahead__title')) === 'Priya Raman' && !(await p.$('.ahead__kicker')) && (await txt('.abody__side .cdl')).includes('GSP-24102') && (await txt('.abody__side .cdl')).includes('DKN-2611407'));
  ok('…then course and university, then campus, country and intake', (await txt('.ahead__course')) === 'Master of Artificial Intelligence · Deakin University' && (await txt('.ahead__meta')).startsWith('Waurn Ponds, Geelong ·') && (await txt('.ahead__meta')).endsWith('Australia · Feb 2027 intake'));
  ok('corner: the status and one tag, Pending on you', (await txt('.ahead__st')) === 'Conditional offer received, conditions pending' && (await p.$$('.ahead__status .who')).length === 1 && (await txt('.ahead__status .who')) === 'Pending on you' && (await p.$('#app-more')) !== null);
  ok('header: a border on all four sides', await p.$eval('.ahead', (e) => { const s = getComputedStyle(e); return ['Top', 'Right', 'Bottom', 'Left'].every((k) => s[`border${k}Width`] === '1px' && s[`border${k}Color`] !== 'rgba(0, 0, 0, 0)' && s[`border${k}Style`] === 'solid'); }));
  ok('header: a light line between the details and the stages', await p.$eval('.ahead__top', (e) => getComputedStyle(e).borderBottomStyle === 'solid' && getComputedStyle(e).borderBottomWidth === '1px'));
  ok('a light upright line, with space, between the status and More', await p.evaluate(() => { const s = document.querySelector('.ahead__status'); const cs = getComputedStyle(s); const gap = document.querySelector('#app-more').getBoundingClientRect().left - s.getBoundingClientRect().right; return cs.borderRightStyle === 'solid' && cs.borderRightWidth === '1px' && parseFloat(cs.paddingRight) >= 20 && gap >= 20; }));
  ok('⋯ says More', (await txt('#app-more')) === 'More' && (await p.getAttribute('#app-more', 'aria-label')) === 'More for this application');
  ok('no fact strip, no summary', !(await p.$('.ahead__facts')) && !(await p.$('.aisum')) && !(await p.$('#atab-summary')) && !(await p.$('.aoffer')));
  ok('8-stage path, now at Offer; the tag says who, so the path says Now', (await p.$$('.strack__step')).length === 8 && (await txt('.strack__step.is-now .strack__name')) === 'Offer' && (await txt('.strack__step.is-now .strack__when')) === 'Now');
  ok('no You earn card or Withdraw link at the bottom', !(await p.$('.aearn')) && !(await p.$('.awithdraw')));
  ok('Pending on you banner: the offer’s conditions, due date, Answer the conditions', (await txt('.aneed__title')).startsWith('Pending on you: 1 thing to do · due') && (await txt('.aneed__text')) === 'Offer conditions' && (await txt('.aneed button')) === 'Answer the conditions');
  ok('tabs: Chat (open, its messages read), Documents (1 to do), Activity', (await p.$$eval('.atabs__tab', (e) => e.map((x) => x.textContent.replace(/\d+/g, '').trim()))).join('|') === 'Chat|Documents|Activity' && (await p.getAttribute('#atab-chat', 'aria-selected')) === 'true' && !(await p.$('#atab-chat .atabs__badge')) && (await txt('#atab-documents .atabs__badge')) === '1');
  ok('beside the chat: Key details with the offer, counsellor and commission', (await txt('.abody__side .cdl')).includes('Accept by') && (await txt('.abody__side .cdl')).includes('AUD 9,000') && (await txt('.abody__side .cdl')).includes('Karthik Nair') && (await txt('.abody__side .cdl')).includes('AUD 3,760'));
  ok('…and the GSP contact: name, role without regions, phone and email', (await txt('.aperson__name')) === 'Meera Pillai' && (await txt('.aperson__role')) === 'GSP admissions' && (await txt('.aperson__ways')).includes('+91 80 4718 2210') && (await p.getAttribute('.aperson__mail', 'href')) === 'mailto:meera.pillai@gsp.upgrad.com' && (await p.$$('.aperson__ways .scopy')).length === 2);
  ok('side (28 Oct): Your GSP contact first, then Key details; Duration, no Length or Campus; no chat button', (await p.$$eval('.abody__side > .card .acard__title', (e) => e.map((x) => x.textContent.trim()))).join('|') === 'Your GSP contact|Key details' && (await p.$$eval('.abody__side .cdl dt', (e) => e.map((x) => x.textContent))).includes('Duration') && !(await p.$$eval('.abody__side .cdl dt', (e) => e.map((x) => x.textContent))).some((x) => x === 'Length' || x === 'Campus') && !(await p.$('.aperson button:has-text("Message in the chat")')));
  ok('chat: no suggested prompts', !(await p.$('.aprompt')) && !(await p.$('.achat__prompts')));
  const edges = await p.evaluate(() => [document.querySelector('.achat').getBoundingClientRect(), document.querySelector('.abody__side').getBoundingClientRect(), document.querySelector('.aperson').getBoundingClientRect()].map((r) => [Math.round(r.top), Math.round(r.bottom)]));
  ok('chat lines up with the side column: same top as the GSP contact, same bottom as Key details', edges[0][0] === edges[2][0] && Math.abs(edges[0][1] - edges[1][1]) <= 1, JSON.stringify(edges));
  ok('chat: a liquid-glass frame round a solid panel', (await p.$eval('.achat', (e) => getComputedStyle(e).paddingTop)) === '6px' && /blur/.test(await p.$eval('.achat', (e) => getComputedStyle(e).backdropFilter)) && (await p.$eval('.achat', (e) => getComputedStyle(e, '::after').backgroundImage)).includes('linear-gradient'));
  ok('chat: a very light tint, people on white', (await p.$eval('.achat', (e) => getComputedStyle(e, '::before').backgroundColor)) === 'rgb(247, 248, 252)' && (await p.$eval('.msg--gsp .msg__bubble', (e) => getComputedStyle(e).backgroundColor)) === 'rgb(255, 255, 255)');
  ok('chat: a plain card, no aurora, no glass bubbles', (await p.$eval('.achat', (e) => getComputedStyle(e, '::before').backgroundImage)) === 'none' && !/blur/.test(await p.$eval('.msg__bubble', (e) => getComputedStyle(e).backdropFilter)));
  ok('chat (28 Oct, 3rd round): GSP Assist heads it as in GSP Team; no Assist messages, no attach button, the box says “Ask GSP…”', (await txt('.achat__head .alabel')).toLowerCase().includes('gsp assist') && !(await p.$('.msg--ai')) && !(await p.$('#achat-file')) && (await p.getAttribute('#achat-input', 'placeholder')) === 'Ask GSP…' && (await txt('.achat__head h2')) === 'Chat about Priya’s application');
  ok('chat: GSP’s message carries the offer letter', (await txt('.msg--gsp .msg__file')).includes('Deakin_conditional_offer_Priya_Raman.pdf'));
  ok('chat: no Talk to Meera button', !(await p.$('.achat__head button')));
  ok('chat: the conditions come as GSP’s form, to open', (await txt('.areq--form .areq__title')) === 'Offer conditions' && (await txt('.areq--form .areq__why')).startsWith('3 conditions to answer.') && (await p.$('.areq--form button:has-text("Open the form")')) !== null);
  await p.click('.aneed button'); await p.waitForTimeout(600);
  ok('Answer the conditions: the form, 3 questions', (await txt('.cform .sheet__title')) === 'Offer conditions' && (await p.$$eval('.cform__kind', (e) => e.map((x) => x.textContent))).join('|') === 'Question|Question|Question' && (await p.$$('.cform textarea')).length === 3);
  await p.click('.cform button:has-text("Send to GSP")'); await p.waitForTimeout(300);
  ok('…every one needs an answer before it goes', (await txt('.cform__left')) === '3 conditions still need an answer.' && (await p.$$('.cform__item.is-bad')).length === 3);
  await p.fill('#cond-c1', 'Yes. Priya will accept the offer and start in February 2027.');
  await p.fill('#cond-c2', 'Deakin’s Master of AI has the industry projects Priya wants, and its graduates work in the AI roles she is aiming for.');
  await p.fill('#cond-c3', 'No, Priya has never been refused a visa.');
  ok('…answered: words counted', (await p.$$('.cform__item.is-done')).length === 3 && /\d+ words/.test(await txt('.cform__hint')));
  await p.click('.cform button:has-text("Send to GSP")'); await p.waitForTimeout(700);
  ok('sent: the status stays for GSP to move; with GSP now (28 Oct, only New to Pre-screening moves on its own)', (await txt('.ahead__st')) === 'Conditional offer received, conditions pending' && (await txt('.ahead__status .who')) === 'GSP' && !(await p.$('.aneed')) && !(await p.$('.cform')));
  await p.click('#atab-documents'); await p.waitForTimeout(400);
  ok('Documents (28 Oct): tabs All, Pending, In review, Approved, Conditions, with counts', (await p.$$eval('.adtab', (e) => e.map((x) => x.textContent.replace(/\s+/g, '')))).join('|') === 'All8|Pending0|Inreview0|Approved7|Conditions1', (await p.$$eval('.adtab', (e) => e.map((x) => x.textContent.replace(/\s+/g, '')))).join('|'));
  ok('…what it asked for when it was added (the course’s list, read for Priya), with where each is', (await p.$$eval('.adocs__list:not(:last-of-type) .adoc, .adocs__body > .adocs__list:first-of-type .adoc', (e) => [...new Set(e)].map((x) => x.querySelector('.adoc__name').textContent + ':' + x.querySelector('.dpill').textContent))).join('|') === 'Passport:Approved|10th marksheet:Approved|12th marksheet:Approved|UG marksheet:Approved|IELTS Academic score report:Approved|Statement of purpose:Approved|CV:Approved' && (await txt('.adoc:has-text("12th") .adoc__file')).includes('from Priya’s profile'));
  ok('…then what GSP added: the offer letter', (await txt('.adocs__k')) === 'From GSP' && (await txt('.adoc:has-text("Conditional offer letter") .dpill')) === 'By GSP');
  ok('…and nothing the course needs only later (financial documents, references)', !/Financial documents|references/.test(await txt('.adocs')));
  ok('every document: Preview and Download', (await p.$$('.adoc .dview__btn')).length === 16);
  await p.locator('.adoc:has-text("Passport") .dview__btn').first().click(); await p.waitForTimeout(500);
  ok('Preview: the first page, with Download', (await txt('.dprev .sheet__title')) === 'Passport' && (await p.$('.dprev .dpp__photo')) !== null && (await p.$('.dprev button:has-text("Download")')) !== null);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('.dprev button:has-text("Download")')]);
  ok('Download saves it', !!dl && dl.suggestedFilename() === 'priya_passport.pdf', dl ? dl.suggestedFilename() : 'no download');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.click('#adtab-conditions'); await p.waitForTimeout(300);
  ok('Conditions (28 Oct, 3rd round): GSP Team’s card, as answered, sent to GSP', (await txt('.condcard .condcard__title')) === 'Offer conditions' && (await txt('.condcard .dpill')) === 'Sent to GSP' && (await txt('.condcard')).includes('Will Priya accept'));
  await p.click('.condcard'); await p.waitForTimeout(400);
  ok('…the card opens the answers', (await txt('.conddlg')).includes('industry projects') && (await txt('.conddlg')).includes('never been refused'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.click('#adtab-approved'); await p.waitForTimeout(200);
  ok('Approved: only the approved ones', (await p.$$('.adoc')).length === 7 && !(await p.$('.adocs__todo')));
  await p.click('#adtab-review'); await p.waitForTimeout(200);
  ok('In review: nothing with GSP right now', (await txt('.adocs__empty')) === 'Nothing with GSP right now.');
  await p.click('#adtab-all'); await p.waitForTimeout(200);
  await p.click('#atab-activity'); await p.waitForTimeout(400);
  ok('activity: the conditions answered and sent', (await txt('.aact')).includes('Answered the offer conditions and sent them to GSP'));
  await p.click('#atab-chat'); await p.waitForTimeout(1800);
  ok('chat: the form card says it’s answered; Meera says she has them', (await txt('.areq--form.is-done .areq__why')).startsWith('Answered and sent to GSP') && (await p.$$eval('.msg--gsp', (e) => e[e.length - 1].textContent)).includes('got the offer conditions'));
  await p.click('#atab-activity'); await p.waitForTimeout(400);
  ok('Key details stay beside every tab', (await p.$('.abody__side .cdl')) !== null);

  // keyboard on the tabs
  await p.focus('#atab-activity'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(400);
  ok('arrow keys move between tabs', (await p.getAttribute('#atab-documents', 'aria-selected')) === 'true' && (await p.evaluate(() => document.activeElement.id)) === 'atab-documents');
  await p.keyboard.press('Home'); await p.waitForTimeout(400);
  ok('Home goes to Chat', (await p.getAttribute('#atab-chat', 'aria-selected')) === 'true');

  // chat (28 Oct): the agency and its GSP contact; nothing answers on its own
  await p.fill('#achat-input', 'Where is it now?'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok('sent: “Meera is typing…”, no Thinking', (await txt('.msg--typing .msg__typing')) === 'Meera is typing…' && !(await p.$('.athink')) && (await p.$$eval('.msg--you', (e) => e[e.length - 1].textContent)).includes('Where is it now?'));
  await answered();
  ok('…and Meera replies, in the chat', /I’ll look into it and reply here by|Thanks, noted/.test(await p.$$eval('.msg--gsp', (e) => e[e.length - 1].textContent)) && !(await p.$('.msg--ai')));
  await p.fill('#achat-input', 'Thanks'); await p.keyboard.press('Enter'); await answered();
  ok('…a second message: noted', (await p.$$eval('.msg--gsp', (e) => e[e.length - 1].textContent)).includes('Thanks, noted'));

  // a document request from GSP: in the chat, in Documents, as Pending on you
  await go('application-request');
  ok('request: Pending on you, though GSP is checking; one tag only; no “GSP asked” tag (28 Oct)', (await txt('.ahead__st')) === 'Pending verification' && (await p.$$('.ahead__status .who')).length === 1 && (await txt('.ahead__status .who')) === 'Pending on you' && (await txt('.aneed__text')) === 'Gap explanation document');
  ok('…as a card in the chat, to upload there', (await txt('.areq .areq__title')) === 'Gap explanation document' && (await p.$('.areq label:has-text("Upload")')) !== null);
  await p.click('#atab-documents'); await p.waitForTimeout(400);
  ok('…and in Documents, pending on you first; what it was sent with, in review', (await txt('.adocs__todo .nrow__title')) === 'Gap explanation document' && (await p.$$eval('.adoc.is-review .adoc__name', (e) => e.map((x) => x.textContent))).join('|') === 'Passport|10th marksheet|12th marksheet|UG marksheet|PTE Academic score report|Statement of purpose|CV' && (await txt('.adoc:has-text("Passport") .adoc__file')).includes('from Sneha’s profile') && (await txt('#adtab-pending')) === 'Pending1');
  await p.click('#atab-chat'); await p.waitForTimeout(400);
  await p.setInputFiles('#req-req-gap', file('sneha_gap_explanation.pdf')); await p.waitForTimeout(2200);
  ok('uploaded from the chat: sent to GSP, tagged GSP', (await p.$('.areq.is-done')) !== null && (await txt('.ahead__status .who')) === 'GSP' && !(await p.$('.aneed')));
  await p.waitForTimeout(1800);
  ok('…and Meera says so', (await p.$$eval('.msg--gsp', (e) => e[e.length - 1].textContent)).includes('got the gap explanation'));
  await p.click('#atab-documents'); await p.waitForTimeout(400);
  ok('…it shows in Documents, in review', (await txt('.adoc:has-text("Gap explanation")')).includes('uploaded for GSP’s request') && (await txt('.adoc:has-text("Gap explanation") .dpill')) === 'In review' && !(await p.$('.adocs__todo')));

  // the offer's dates are in Key details (nothing is attached in the chat since 28 Oct)
  await go('application-late');
  ok('late: with the university, one tag', (await txt('.ahead__st')) === 'Submitted to university' && (await txt('.ahead__status .who')) === 'University');
  ok('…no attach button in the chat', !(await p.$('#achat-file')) && !(await p.$('.achat__attach')));

  // the uni's email in the chat
  await go('applications');
  ok('list again: still no brief', !(await p.$('.abrief')));
  await click('.arow:has-text("GSP-23941")'); await p.waitForTimeout(700);
  ok('University email placed in the chat', (await txt('.msg--uni .msg__who')).includes('by email, placed here automatically'));

  // the visa: you lodge it, or GSP does; never both
  await go('application-visa');
  ok('visa lodgement: yours', (await txt('.ahead__st')) === 'Visa lodgement pending' && (await txt('.ahead__status .who')) === 'Pending on you');
  ok('…GSP asked for the lodgement proof in the chat', (await txt('.areq .areq__title')) === 'Visa lodgement proof' && (await p.$('.areq label:has-text("Upload")')) !== null);
  await p.click('#atab-documents'); await p.waitForTimeout(400);
  ok('…pending on you in Documents, with Ask GSP to lodge it and no Send to GSP', (await txt('.adocs__todo .nrow__title')) === 'Visa lodgement proof' && (await p.$('.aneeds__btns button:has-text("Ask GSP to lodge it")')) !== null && !(await p.$('.aneeds__btns button:has-text("Send to GSP")')));
  await p.click('.aneeds__btns button:has-text("Ask GSP to lodge it")'); await p.waitForTimeout(500);
  ok('Ask GSP to lodge it: with GSP, tagged GSP', (await txt('.ahead__status .who')) === 'GSP' && (await txt('.strack__step.is-now .strack__when')) === 'Now' && !(await p.$('.aneed')));
  await p.click('#atab-chat'); await p.waitForTimeout(400);
  ok('…and the request in the chat says it’s no longer needed', (await txt('.areq.is-done')).includes('No longer needed.') && (await txt('.areq.is-done .areq__title')) === 'Visa lodgement proof');

  // no backup applications (27 Oct): Rohan's Northumbria one is with GSP, checking documents
  await go('applications');
  ok('no backup applications: no Backup tag in the list', !(await p.$('.arow__tag')));
  await p.locator('.arow', { hasText: 'GSP-23944' }).locator('.arow__open').click(); await p.waitForTimeout(600);
  ok('…GSP-23944 is checking documents, with no backup banner', (await txt('.ahead__st')) === 'Pending verification' && !(await p.$('.aneed--calm')));

  // the ⋯ menu: student profile, withdraw
  await go('application-late');
  await p.click('#app-more'); await p.waitForTimeout(300);
  ok('⋯ menu: Student profile and Withdraw application (GSP already chased)', (await p.$$eval('.mmenu [role=menuitem]', (e) => e.map((x) => x.textContent.trim()))).join('|') === 'Student profile|Withdraw application' && (await p.evaluate(() => document.activeElement.getAttribute('role'))) === 'menuitem');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok('Esc closes it, focus back on ⋯', !(await p.$('.mmenu')) && (await p.evaluate(() => document.activeElement.id)) === 'app-more');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok('withdraw asks why, Keep it focused first', (await txt('#confirm-title')).startsWith('Withdraw Priya’s application') && (await p.$$('.wreason')).length === 4 && (await p.evaluate(() => document.activeElement.textContent)) === 'Keep it');
  await p.click('.wreason:has-text("deferring")'); await p.click('.confirm button:has-text("Withdraw")'); await p.waitForTimeout(500);
  ok('closed, with the reason', (await txt('.strack__step.is-ended .strack__when')) === 'Closed here' && (await txt('.aneed--calm')).includes('deferring') && (await txt('.ahead__status .who')) === 'Closed');
  await p.click('#app-more'); await p.waitForTimeout(300);
  ok('closed: the menu has no Withdraw', (await p.$$eval('.mmenu [role=menuitem]', (e) => e.map((x) => x.textContent.trim()))).join('|') === 'Student profile');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.click('.ahead__stu'); await p.waitForTimeout(700);
  ok('the student’s name opens the record', (await txt('.rhead__name')) === 'Priya Raman');
  await p.locator('.shell__side').getByRole('button', { name: /^Applications/ }).click(); await p.waitForTimeout(600);
  ok('list: 2 closed', (await p.$$eval('.atab tbody .astat__own', (e) => e.filter((x) => x.textContent === 'Closed').length)) === 2);

  // (adding Ananya's application and a new student mid-flow left with the 5-student data round on the other branch)
  // the student's chips, and the check scrolling into view when a pick starts it
  await go('application-new', 1800);
  await p.selectOption('#na-student', 'S-24811'); await p.waitForTimeout(300);
  ok('no pills under the student (the check says what it used)', (await p.$$('.nachip')).length === 0);
  await p.fill('#na-course', 'artificial intelligence canberra'); await p.waitForTimeout(300);
  const checkSpot = () => p.evaluate(() => { const el = document.querySelector('.nacheck'), b = document.querySelector('.sheet__body'); return el && b ? [Math.round(b.scrollTop), Math.round(el.getBoundingClientRect().top - b.getBoundingClientRect().top), Math.round(b.clientHeight)] : null; });
  await p.click('.napick__opt'); await p.waitForTimeout(1200);
  { const sp = await checkSpot(); ok('picking the course (it picks the intake): the form scrolls to GSP Assist’s check', !!sp && sp[0] > 100 && sp[1] >= 0 && sp[1] < sp[2] / 2, JSON.stringify(sp)); }
  await p.$eval('.sheet__body', (e) => e.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.click('.naintake:not(.is-on)'); await p.waitForTimeout(1200);
  { const sp = await checkSpot(); ok('picking another intake: it scrolls to the check again', !!sp && sp[0] > 100 && sp[1] >= 0 && sp[1] < sp[2] / 2, JSON.stringify(sp)); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // not eligible: close courses
  await go('application-new-miss', 6200);
  ok('not eligible: why, and close courses', (await txt('#na-check')) === 'Not eligible' && /asks for 69% and \w+ has \d+%, so \w+ isn’t eligible/.test(await txt('.nareason--no')) && (await p.$$('.naalt')).length === 3, await txt('.nareason--no'));
  ok('…can still start, said plainly', (await txt('.naend button:last-child')) === 'Start anyway');
  await p.locator('.naalt button').first().click(); await p.waitForTimeout(5600);
  ok('Use this: checks again', (await txt('#na-check')) !== 'Not eligible' && (await txt('#na-check')) !== '');
  ok('another application this intake: no alongside-or-backup choice', (await p.$$('.narank__opt')).length === 0);

  // review, 28 Oct: destination, program level and study area; a slower check that says what it's doing; the reasons
  await go('application-new', 1800);
  await p.selectOption('#na-student', 'S-24811'); await p.waitForTimeout(300);
  ok('course: Destination, University, Program Level, Study Area', (await p.$$eval('.nafind .field__label, .nafind label', (e) => e.map((x) => x.textContent.trim()).filter(Boolean))).join('|').startsWith('Destination|University|Program Level|Study Area'), (await p.$$eval('.nafind label', (e) => e.map((x) => x.textContent.trim()))).join('|'));
  ok('destination: the countries', (await p.$$eval('#na-dest option', (e) => e.map((x) => x.value).filter(Boolean))).join('|') === 'Australia|UK|Canada|New Zealand|Ireland|USA', (await p.$$eval('#na-dest option', (e) => e.map((x) => x.value).filter(Boolean))).join('|'));
  await p.selectOption('#na-dest', 'Canada'); await p.waitForTimeout(400);
  ok('a destination narrows the universities to its own', (await p.$$eval('#na-uni optgroup', (e) => e.map((x) => x.label))).join('|') === 'Canada');
  ok('…and the courses', (await p.$$eval('.napick__uni', (e) => e.every((x) => x.textContent.trim().endsWith('Canada')))) && (await p.$$('.napick__opt')).length > 0);
  await p.locator('.napick__opt').first().click(); await p.waitForTimeout(1500);
  ok('checking: says what it’s doing', (await txt('.nacheck__what')).startsWith('GSP Assist is checking Priya’s profile details against') && (await txt('.nacheck__what')).includes('to see if Priya is eligible'));
  ok('…and it’s slower: still on the second part after 1.5s', (await p.$$('.nacheck__step.is-done')).length === 1);
  ok('where they live: the country only', (await txt('.nacheck__step.is-done .nacheck__v')) === 'Checked');
  await p.waitForTimeout(4200);
  const rs = await p.$$eval('.nareason', (e) => e.map((x) => x.querySelector('.nareason__v').textContent.trim()));
  ok('reasons: where they live by country', / takes students from India\.$/.test(rs[0]), rs[0]);
  ok('reasons: academics, asks for and has', /asks for \d+% and Priya has \d+%, so Priya is eligible\./.test(rs[1]), rs[1]);
  ok('reasons: English, asks for and has', /asks for (IELTS|PTE) [\d.]+ \(no band below [\d.]+\) and Priya has (IELTS|PTE) [\d.]+ \(lowest band [\d.]+\), so Priya (is|isn’t) eligible/.test(rs[2]), rs[2]);
  ok('checked: says what it checked', (await txt('.nacheck__what')).startsWith('GSP Assist checked Priya’s profile details'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // no scores on the profile: complete them, from the reason
  await go('applications'); await go('application-new', 1800);
  await p.selectOption('#na-student', 'S-24818'); await p.waitForTimeout(200);
  await p.selectOption('#na-dest', 'UK'); await p.waitForTimeout(300);
  await p.locator('.napick__opt').first().click(); await p.waitForTimeout(5600);
  const ms = await p.$$eval('.nareason', (e) => e.map((x) => x.querySelector('.nareason__v').textContent.trim()));
  ok('no score: complete the academic details', ms[1].startsWith('Complete the academic details on Mohammed’s profile to check eligibility.'), ms[1]);
  ok('no test: complete the English test details', ms[2].startsWith('Complete the English test details on Mohammed’s profile to check eligibility.'), ms[2]);
  await p.locator('.nareason__fix').first().click(); await p.waitForTimeout(900);
  ok('Open the profile: the student’s education', (await txt('.rhead__name')).startsWith('Mohammed') && (await p.getAttribute('#rsub-education', 'aria-selected')) === 'true');
  // documents: what this course asks for, read for the student; what GSP Assist makes of each upload
  await go('applications'); await go('application-new', 1800);
  await p.selectOption('#na-student', 'S-24781'); await p.waitForTimeout(200);
  await p.selectOption('#na-dest', 'Australia'); await p.waitForTimeout(300);
  await p.locator('.napick__opt').first().click(); await p.waitForTimeout(5600);
  const docNames = async () => p.$$eval('.mdoc', (e) => e.map((x) => x.querySelector('.mdoc__name').firstChild.textContent.trim() + ':' + x.querySelector('.mdoc__need').textContent + ':' + x.querySelector('.mdoc__pill').textContent));
  ok('documents for a master’s: the course’s list, required first; what’s on Fatima’s profile is ready', (await docNames()).join('|') === 'Passport:Required:Ready|10th marksheet:Required:Not added|12th marksheet:Required:Not added|UG marksheet:Required:Not added|IELTS Academic score report:Required:Ready|Statement of purpose:Required:Not added|CV:Required:Not added|PG marksheet:Optional:Ready', (await docNames()).join('|'));
  ok('…nothing the course needs only later', !/Financial|references|Gap explanation/.test(await txt('.mdocs')) && (await txt('section[aria-labelledby="na-docs"] .nahint')).includes('Anything needed later, GSP asks for in the chat'));
  ok('…counted against what’s required', (await txt('.nadocs2__count')) === '2 of 7 required ready');
  const card = (name) => p.locator('.mdoc', { has: p.locator('.mdoc__name', { hasText: name }) });
  await card('10th marksheet').locator('input[type=file]').setInputFiles(file('blurry_10th.jpg')); await p.waitForTimeout(150);
  await card('12th marksheet').locator('input[type=file]').setInputFiles(file('10th_marks.pdf')); await p.waitForTimeout(150);
  await card('UG marksheet').locator('input[type=file]').setInputFiles(file('rohit_ug_transcript.pdf')); await p.waitForTimeout(150);
  await card('Statement of purpose').locator('input[type=file]').setInputFiles(file('fatima_cv.pdf')); await p.waitForTimeout(3400);
  const st = async (name) => [await card(name).locator('.mdoc__pill').innerText(), await card(name).locator('.mfile__note').innerText(), await card(name).locator('.mfile__acts .btn').innerText()];
  ok('not clear: Re-upload', JSON.stringify(await st('10th marksheet')) === JSON.stringify(['Re-upload', 'The attached document is not clear.', 'Re-upload']), JSON.stringify(await st('10th marksheet')));
  ok('not the document asked for: Re-upload', JSON.stringify(await st('12th marksheet')) === JSON.stringify(['Re-upload', 'The document uploaded is not the 12th marksheet.', 'Re-upload']), JSON.stringify(await st('12th marksheet')));
  ok('another student’s name: Re-upload', JSON.stringify(await st('UG marksheet')) === JSON.stringify(['Re-upload', 'The student name in the document is mismatched.', 'Re-upload']), JSON.stringify(await st('UG marksheet')));
  ok('a CV for the statement of purpose: Re-upload', JSON.stringify(await st('Statement of purpose')) === JSON.stringify(['Re-upload', 'The document uploaded is not the statement of purpose.', 'Re-upload']), JSON.stringify(await st('Statement of purpose')));
  ok('none of them counts as ready', (await txt('.nadocs2__count')) === '2 of 7 required ready');
  await card('10th marksheet').locator('input[type=file]').setInputFiles(file('fatima_10th_marksheet.pdf')); await p.waitForTimeout(150);
  await card('CV').locator('input[type=file]').setInputFiles(file('fatima_sheikh_cv.pdf')); await p.waitForTimeout(3400);
  ok('the right one: Uploaded, Replace', JSON.stringify(await st('10th marksheet')) === JSON.stringify(['Uploaded', 'Uploaded successfully.', 'Replace']), JSON.stringify(await st('10th marksheet')));
  ok('…the CV too', JSON.stringify(await st('CV')) === JSON.stringify(['Uploaded', 'Uploaded successfully.', 'Replace']), JSON.stringify(await st('CV')));
  ok('…and they count', (await txt('.nadocs2__count')) === '4 of 7 required ready');
  await p.click('.naend button:has-text("Start application")'); await p.waitForTimeout(800);
  ok('started: waiting for the two to re-upload', (await txt('.nadone__text')) === 'Waiting for documents.');
  await p.click('.nadone button:has-text("Open application"), .asf button:has-text("Open application")'); await p.waitForTimeout(900);
  await p.click('#atab-documents'); await p.waitForTimeout(400);
  ok('the new application: what wasn’t uploaded is pending on you; what was, in review', (await p.$$eval('.adocs__todo .nrow__title', (e) => e.map((x) => x.textContent))).join('|') === '12th marksheet|UG marksheet|Statement of purpose' && (await p.$$eval('.adoc.is-review .adoc__name', (e) => e.map((x) => x.textContent))).join('|') === 'Passport|10th marksheet|IELTS Academic score report|CV|PG marksheet' && !(await p.$('.adoc.is-approved')) && (await txt('.adoc:has-text("Passport") .adoc__file')).includes('from Fatima’s profile'), (await p.$$eval('.adoc .adoc__name', (e) => e.map((x) => x.textContent))).join('|'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // expand to the full window, and back
  await go('application-new-check', 2600);
  const box = () => p.$eval('.sheet', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(innerWidth - r.right), Math.round(innerHeight - r.bottom), Math.round(r.width)]; });
  ok('the dialog has an expand button beside Close', (await p.getAttribute('.sheet__size', 'aria-label')) === 'Expand to full page' && (await p.$('.sheet__acts .sheet__close')) !== null && (await box())[4] === 840);
  await p.click('.sheet__size'); await p.waitForTimeout(600);
  const fullBox = await box();
  ok('expanded: the whole window with a 24px margin all round', fullBox.slice(0, 4).every((m) => m === 24) && (await p.getAttribute('.sheet__size', 'aria-label')) === 'Back to normal size', JSON.stringify(fullBox));
  await p.click('.sheet__size'); await p.waitForTimeout(900);
  const backBox = await box();
  ok('…and back to its normal size', backBox[4] === 840, JSON.stringify(backBox));
  await p.click('.sheet__size'); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.click('.apps__acts button:has-text("Add application")'); await p.waitForTimeout(800);
  ok('closed while expanded, it opens again at its normal size', (await box())[4] === 840);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.setViewportSize({ width: 390, height: 844 }); await go('application-new', 1800);
  ok('phones: a bottom sheet, no expand button', !(await p.$('.sheet__size')) && (await p.$('.sheet__close')) !== null);
  await p.setViewportSize({ width: 1440, height: 900 });

  // duplicate
  await go('application-new-check', 2600);
  await p.click('.nacourse button:has-text("Change")'); await p.fill('#na-course', 'artificial intelligence deakin'); await p.waitForTimeout(300);
  await p.click('.napick__opt:has-text("Deakin")'); await p.waitForTimeout(1700);
  ok('the same application twice is stopped', (await txt('.dupe')).includes('already has this application: GSP-24102') && (await p.isDisabled('.naend button:last-child')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // links: students and find courses
  await go('applications');
  await p.locator('.shell__side').getByRole('button', { name: /^Students/ }).click(); await p.waitForTimeout(600);
  await p.click('.srow:has-text("Mohammed") .srow__open'); await p.waitForTimeout(600);
  await p.click('#rtab-apps'); await p.waitForTimeout(400);
  await p.click('.rempty button:has-text("Add application")'); await p.waitForTimeout(800);
  ok('from a student: Add application with the student picked', (await txt('#sheet-title')) === 'Add an application' && (await p.inputValue('#na-student')) === 'S-24818');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('.shell__side').getByRole('button', { name: /^Find courses/ }).click(); await p.waitForTimeout(600);
  await p.goto(URL + '#courses-results'); await p.waitForTimeout(1600);
  const firstCourse = await txt('.course__name');
  await p.locator('.course__acts button:has-text("Apply")').first().click(); await p.waitForTimeout(800);
  ok('Apply on a course: Add application with the course picked', (await txt('#sheet-title')) === 'Add an application' && (await txt('.nacourse__name')) === firstCourse, firstCourse);

  // the student list follows the applications
  await go('students');
  ok('students: applications counted from the applications, with nothing under the number', (await txt('.srow:has-text("Fatima") .sapps-n')).startsWith('2') && !(await p.$('.sapps-you')) && (await p.innerText('.srow:has-text("Sneha") .srow__apps')).trim() === '3');

  // fits: no sideways scroll at 1280; phone cards
  await p.setViewportSize({ width: 1280, height: 900 }); await go('applications');
  const fit = await p.$eval('.atable .stab-wrap', (w) => [w.scrollWidth, w.clientWidth]);
  ok('1280: the table fits', fit[0] <= fit[1] + 1, JSON.stringify(fit));
  await p.setViewportSize({ width: 390, height: 844 }); await go('applications');
  ok('phone: no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= 391));

  // reduced motion: the mark stays still
  const rm = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const q = await rm.newPage(); await q.goto(URL + '#application-offer'); await q.waitForTimeout(1600);
  ok('reduced motion: the mark stays still', (await q.$('.amark--idle')) === null && (await q.$('.amark animateTransform')) === null);
  await rm.close();

  ok('no errors', errs.length === 0, errs.join(' | '));
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
