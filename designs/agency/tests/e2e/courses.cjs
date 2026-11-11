// Find courses: plain-language search, the five fields, filters, sort, student view, shortlist, details, typos, territory.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const txt = async (sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  const count = async () => +(await txt('#fc-count')).split(' ')[0];

  await p.goto(URL); await p.evaluate(() => localStorage.clear());
  await p.goto(URL + '#portal-verifying'); await p.reload(); await p.waitForTimeout(1600);
  await p.locator('.shell__side').getByRole('button', { name: /^Find courses/ }).click(); await p.waitForTimeout(600);
  ok('landing: popular searches', (await p.$$('.fpop button')).length === 6);
  ok('country and state start as the agency’s', (await p.inputValue('#fc-country')) === 'India' && (await p.inputValue('#fc-state')) === 'Karnataka');
  await p.fill('#fc-q', 'mba uk under 22k jan'); await p.press('#fc-q', 'Enter'); await p.waitForTimeout(600);
  ok('Enter searches; the box fills the fields', (await p.inputValue('#fc-dest')) === 'UK' && (await p.inputValue('#fc-level')) === 'Master’s degree' && (await p.inputValue('#fc-area')) === 'Business and management');
  ok('…and the intake, in the bar', (await p.inputValue('#fc-intake')).startsWith('Jan'), await p.inputValue('#fc-intake'));
  const chips = await p.$$eval('.fchip', (e) => e.map((x) => x.textContent));
  ok('what the box set shows as filter chips (the intake is in the bar, not a chip)', !chips.some((t) => t.includes('intake')) && chips.some((t) => t.startsWith('Tuition up to GBP 22,000')), JSON.stringify(chips));
  ok('no "Search for" line or hint', !(await p.$('.fneed__legend')) && !(await p.$('.fsearch__hint')) && !(await p.$('.fsearch__said')));
  const n = await count();
  const cards = await p.$$eval('.course', (els) => els.map((e) => ({ uni: e.querySelector('.course__uni').textContent, fee: +e.querySelector('.course__facts dd').textContent.replace(/[^0-9]/g, ''), intakes: [...e.querySelectorAll('.ipill')].map((i) => i.textContent) })));
  ok(`results: ${n} UK MBAs, all ≤ 22,000 with a Jan intake`, n > 0 && cards.every((c) => c.fee <= 22000 && c.intakes.some((i) => i.startsWith('Jan'))), JSON.stringify(cards.slice(0, 2)));
  // sort
  await p.selectOption('.fbar__select', 'fee'); await p.waitForTimeout(300);
  const fees = await p.$$eval('.course .course__facts > div:first-child dd', (e) => e.map((x) => +x.textContent.replace(/[^0-9]/g, '')));
  ok('sort: lowest tuition first', fees.every((f, i) => i === 0 || f >= fees[i - 1]), JSON.stringify(fees.slice(0, 5)));
  // remove a filter chip
  await p.click('.fchip:has-text("Tuition up to")'); await p.waitForTimeout(300);
  ok('removing a chip widens the results', (await count()) >= n);
  // student view
  // R104 (11 Nov): what a course earns comes from the agency's own commission terms; a new agency has none yet
  ok('You earn: not shown until the agency has a commission record (R104)', (await p.$$('.course .is-earn')).length === 0);
  ok('cards: no GSP priority tag (review, 27 Oct)', (await p.$$('.course')).length > 0 && (await p.locator('.course .tag', { hasText: 'GSP priority' }).count()) === 0);
  await p.click('#fc-view'); await p.waitForTimeout(300);
  ok('Student view hides You earn', (await p.$$('.course .is-earn')).length === 0 && !(await p.$$eval('.fbar__select option', (o) => o.map((x) => x.value))).includes('earn'));
  await p.click('#fc-view'); await p.waitForTimeout(200);
  // shortlist
  const star = p.locator('.course .star').first();
  await star.click(); await p.waitForTimeout(200);
  ok('shortlist star', (await star.getAttribute('aria-pressed')) === 'true');
  await p.click('label[for=ff-short]'); await p.waitForTimeout(300);
  ok('Shortlisted only: 1', (await count()) === 1);
  await p.click('label[for=ff-short]'); await p.waitForTimeout(200);
  // details
  await p.locator('.course__open').first().click(); await p.waitForTimeout(600);
  ok('details sheet opens on Overview, with 4 tabs', await p.getByRole('dialog').isVisible() && (await p.$$('[role=tab]')).length === 4 && (await p.getAttribute('[role=tab][aria-selected=true]', 'id')) === 'cs-tab-overview');
  const web = await p.getAttribute('.sheet__sub .cs-web', 'href');
  ok('university website link, new tab', /^https:\/\/[a-z.]+\.(ac\.uk|edu\.au|ca|ie|edu|ac\.nz|nz)$/.test(web) && (await p.getAttribute('.sheet__sub .cs-web', 'target')) === '_blank', web);
  ok('campus with address and a map link', (await txt('.cs-campus__addr')).length > 8 && (await p.getAttribute('.cs-campus__map', 'href')).startsWith('https://www.google.com/maps/search/'), await txt('.cs-campus__addr'));
  ok('no About the course (27 Oct, 3rd round); similar courses', !(await p.$('#cs-about')) && (await p.$$('.cs-sim')).length > 0);
  ok('apply waits for verification', await p.locator('.csheet__acts button', { hasText: 'Apply' }).isDisabled() && (await txt('.csheet__lock')).includes('verifies'));
  await p.focus('#cs-tab-overview'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  ok('arrow key moves to Costs', (await p.getAttribute('[role=tab][aria-selected=true]', 'id')) === 'cs-tab-costs' && (await p.evaluate(() => document.activeElement.id)) === 'cs-tab-costs');
  const costs = await txt('#cs-panel');
  ok('costs: other costs and first year all in', costs.includes('Immigration Health Surcharge') && costs.includes('First year, all in'));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  ok('no offer time anywhere: card, dialog, filter or sort', !/Offer in|Offer within|Fastest offer|Typical offer time/.test(await p.evaluate(() => document.body.innerText + [...document.querySelectorAll('option')].map((o) => o.textContent).join('|'))));
  // 30 Oct: only the passport, the academic documents and the English test score (optional), in equal columns
  { const names = await p.$$eval('.cs-doc__name', (e) => e.map((x) => x.textContent.trim()));
    const needs = await p.$$eval('.cs-doc .cs-need', (e) => e.map((x) => x.textContent.trim()));
    const cols = await p.$eval('.cs-doc', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').slice(1));
    ok('entry: passport, academic documents, English test (optional)', names[0] === 'Passport' && names[names.length - 1] === 'English test score' && names.length >= 3 && names.length <= 4 && needs[needs.length - 1] === 'Optional' && needs.slice(0, -1).every((x) => x === 'Required'), JSON.stringify(names));
    ok('entry: the documents’ columns are equal', new Set(cols.map((x) => Math.round(parseFloat(x)))).size === 1, JSON.stringify(cols)); }
  await p.keyboard.press('End'); await p.waitForTimeout(400);
  ok('University tab: about, campuses', (await p.getAttribute('[role=tab][aria-selected=true]', 'id')) === 'cs-tab-uni' && (await p.$$('.cs-campuses .cs-campus')).length >= 1 && !!(await p.$('.cs-campus.is-current')));
  ok('no "Show only this university in results" (review decision, 27 Oct)', (await p.getByRole('button', { name: 'Show only this university in results' }).count()) === 0);
  // review round (27 Oct): a dialog in the middle, the flag header, a fact strip, the first year as a bar
  { const d = await p.locator('.sheet--modal').boundingBox(), vw = p.viewportSize().width;
    ok('details is a dialog in the middle of the window', !!d && Math.abs(d.x + d.width / 2 - vw / 2) < 2 && d.y > 0, JSON.stringify(d)); }
  ok('header names the country, fact strip has 4 facts (study mode, duration, total tuition, base commission)', (await txt('.cm-country')).trim().length > 1 && (await p.$$('.cs-stats .cs-stat')).length === 4);
  // review round 2 (27 Oct): no GSP priority, no "Likely", the page scrolls as one, rows line up, entry tiles
  await p.click('#cs-tab-overview'); await p.waitForTimeout(400);
  ok('no GSP priority tag in the dialog', (await p.locator('.sheet .tag', { hasText: 'GSP priority' }).count()) === 0);
  { const states = await p.$$eval('.cm-state', (e) => e.map((x) => x.textContent.trim()));
    ok('intakes: no "Likely", no days left (a closed one still says so)', states.every((x) => x === 'Closed') && !/days? left|Likely/.test(await txt('.sheet')), JSON.stringify(states)); }
  { const a = await p.locator('[aria-labelledby=cs-intakes]').boundingBox(), b = await p.locator('[aria-labelledby=cs-campus]').boundingBox();
    ok('cards side by side start and end together', Math.abs(a.y - b.y) < 1 && Math.abs(a.height - b.height) < 1); }
  await p.click('#cs-tab-costs'); await p.waitForTimeout(400);
  { const rights = await p.$$eval('.cbar__amt', (e) => e.map((x) => Math.round(x.getBoundingClientRect().right)));
    ok('cost legend: amounts line up', rights.length > 1 && rights.every((r) => r === rights[0]), JSON.stringify(rights)); }
  await p.click('#cs-tab-entry'); await p.waitForTimeout(400);
  // 3 Nov: one country's card, open, with no arrow: Grade 10, Grade 12 and the highest degree for India, then English
  { const tiles = await p.$$eval('.ecard .cm-tile dt', (e) => e.map((x) => x.textContent));
    const vals = await p.$$eval('.ecard .cm-tile__v', (e) => e.map((x) => x.textContent));
    ok('entry: India’s card: Grade 10, Grade 12, highest degree, English test', tiles.slice(0, 3).join('|') === 'Grade 10|Grade 12|Highest degree' && vals.slice(0, 3).every((v) => /^\d+%\+$/.test(v)) && tiles.includes('English test') && (await p.$$('.ecard button.ecard__head')).length === 0 && (await p.$$('.ecard .cs-doc')).length >= 3, JSON.stringify(tiles)); }
  await p.locator('#cm-cpick').click(); await p.waitForTimeout(250);
  await p.locator('.smenu__list [role=option]').first().click(); await p.waitForTimeout(400);
  ok('All countries: a card a country, closed, each with its arrow', (await p.$$('.ecard')).length === 6 && (await p.$$('.ecard.is-open')).length === 0 && (await p.$$('.ecard button.ecard__head[aria-expanded=false]')).length === 6);
  await p.locator('.ecard button.ecard__head').nth(1).click(); await p.waitForTimeout(300);
  ok('opening one shows its needs and documents, without Grade 10 outside India', (await p.$$('.ecard.is-open')).length === 1 && !(await p.locator('.ecard.is-open').innerText()).includes('Grade 10') && (await p.$$('.ecard.is-open .cs-doc')).length >= 3);
  await p.click('#cs-tab-uni'); await p.waitForTimeout(400);
  { const r = await p.evaluate(() => { const sc = document.querySelector('.sheet__scroll'); const before = sc.scrollHeight > sc.clientHeight; sc.scrollTo({ top: 600 }); return before; });
    await p.waitForTimeout(300);
    const barTop = await p.evaluate(() => document.querySelector('.cm-bar').getBoundingClientRect().top - document.querySelector('.sheet__scroll').getBoundingClientRect().top);
    ok('the dialog scrolls as one; the tabs bar stays at the top', r && Math.abs(barTop) < 1 && (await p.locator('.cm-bar').evaluate((e) => e.classList.contains('is-stuck'))), `bar at ${barTop}`);
    await p.evaluate(() => document.querySelector('.sheet__scroll').scrollTo({ top: 0 })); await p.waitForTimeout(200); }
  await p.click('#cs-tab-overview'); await p.waitForTimeout(400);
  await p.click('#cs-tab-costs'); await p.waitForTimeout(400);
  { const segs = await p.$$('.cbar__seg'), items = await p.$$('.cbar__item');
    const sum = await p.$$eval('.cbar__item dd', (e) => e.reduce((n, x) => n + Number(x.textContent.replace(/[^0-9]/g, '').slice(0, -2) || 0), 0));
    ok('costs: a bar of the first year with its parts listed', segs.length >= 3 && segs.length === items.length, `${segs.length} parts`); }
  await p.locator('.cbar__seg').first().hover(); await p.waitForTimeout(250);
  ok('pointing at a part shows its amount and share', /\d+%/.test(await txt('.cbar__tip')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok('Esc closes it', !(await p.getByRole('dialog').isVisible()));
  await p.locator('.course .course__acts button', { hasText: 'Apply' }).first().click(); await p.waitForTimeout(200);
  ok('card Apply explains', (await txt('.course__why')).startsWith('Applications open once GSP verifies'));
  // typo + university
  await p.fill('#fc-q', 'abertey'); await p.press('#fc-q', 'Enter'); await p.waitForTimeout(500);
  ok('typo finds Abertay', (await txt('#fc-count')).includes('at Abertay University') && (await count()) > 0, await txt('#fc-count'));
  // a missing field
  await p.selectOption('#fc-country', 'Nepal'); await p.waitForTimeout(300);
  // 3 Nov: the state or province is optional, so a new country keeps the results
  ok('new country clears the state, and the results stay (the state is optional)', (await p.$$('.course')).length > 0 && (await p.$eval('#fc-state', (e) => e.value)) === '' && !(await p.$eval('#fc-state', (e) => e.closest('.fseg__item').classList.contains('is-error'))));
  await p.selectOption('#fc-state', { index: 1 }); await p.waitForTimeout(300);
  ok('results with a state too', (await p.$$('.course')).length > 0);
  // territory
  await p.fill('#fc-q', 'business'); await p.selectOption('#fc-dest', 'Australia'); await p.selectOption('#fc-country', 'India'); await p.selectOption('#fc-state', 'Punjab'); await p.press('#fc-q', 'Enter'); await p.waitForTimeout(500);
  ok('Punjab: hidden courses explained', (await txt('.fnote')).includes('don’t take students from Punjab, India'), await txt('.fnote'));
  // a budget in lakhs
  await p.selectOption('#fc-country', 'India'); await p.selectOption('#fc-state', 'Karnataka');
  await p.fill('#fc-q', 'MBA in UK under 25 lakhs'); await p.press('#fc-q', 'Enter'); await p.waitForTimeout(500);
  ok('lakhs become a GBP cap, said both ways', (await p.$$eval('.fchip', (e) => e.map((x) => x.textContent))).some((t) => t.startsWith('Tuition up to ₹25 lakh (≈ GBP 22,300)')) && (await count()) > 0);
  // verified agency can apply
  await p.click('.proto__fab'); await p.locator('.proto__state', { hasText: 'Agreement accepted: All Access' }).click(); await p.click('.proto__close'); await p.waitForTimeout(900);
  await p.locator('.shell__side').getByRole('button', { name: /^Find courses/ }).click(); await p.waitForTimeout(500);
  ok('search kept when coming back', (await p.$$('.course')).length > 0);
  await p.locator('.course .course__acts button', { hasText: 'Apply' }).first().click(); await p.waitForTimeout(500);
  ok('verified: Apply goes to Applications', (await txt('h1')) === 'Applications');
  // logos, and moving between courses in the sheet
  await p.goto(URL + '#courses-results'); await p.reload(); await p.waitForTimeout(1200);
  await p.fill('#fc-q', 'university of canberra'); await p.press('#fc-q', 'Enter'); await p.waitForTimeout(500);
  ok('card shows the emblem', await p.$eval('.course .umark--logo img', (i) => i.complete && i.naturalWidth > 0));
  await p.locator('.course__open').first().click(); await p.waitForTimeout(600);
  ok('sheet shows the full logo', await p.$eval('.sheet .ulogo img', (i) => i.complete && i.naturalWidth > 0 && i.alt === 'University of Canberra logo'));
  ok('Canberra campus: its address, nothing about regional visas', !(await txt('.cs-campus')).includes('Regional area for visa purposes') && !(await txt('.cs-campus')).includes('post-study work visa') && (await txt('.cs-campus__addr')).includes('Bruce ACT 2617'));
  ok('Australian course: no About the course, so no CRICOS line', !(await p.$('[aria-labelledby=cs-about]')));
  const before = await txt('#sheet-title');
  await p.locator('.cs-sim').first().click(); await p.waitForTimeout(600);
  ok('a similar course opens in place, focus on its tabs', (await txt('.sheet__sub')) !== '' && !(await txt('.sheet__sub')).startsWith('University of Canberra') && (await p.evaluate(() => document.activeElement.id)) === 'cs-tab-overview', before + ' → ' + (await txt('.sheet__sub')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // the examples take turns in the empty box
  await p.goto(URL + '#courses'); await p.reload(); await p.waitForTimeout(1200);
  const h1 = await txt('.fsearch__ph'); await p.waitForTimeout(3000); const h2 = await txt('.fsearch__ph');
  ok('rotating examples', h1 === 'Course, university or city' && h2.startsWith('Try “'), h1 + ' → ' + h2);
  const box = await p.$eval('.fsearch', (e) => Math.round(e.getBoundingClientRect().height));
  ok('search card is compact', box < 170, box + 'px');
  const ctx = await b.newContext({ reducedMotion: 'reduce' }); const q = await ctx.newPage();
  await q.goto(URL + '#courses'); await q.waitForTimeout(4000);
  ok('reduced motion: the example stays put', (await q.textContent('.fsearch__ph')).trim() === 'Course, university or city');
  await ctx.close();
  // review round (27 Oct): a student to search for, the intake in the bar, cards with logos and "Last updated"
  await p.goto(URL + '#home'); await p.waitForTimeout(1500);
  await p.click('.pnav__item:has-text("Find courses")'); await p.waitForTimeout(900);
  ok('a student can be picked, optionally', (await p.inputValue('#fc-student')) === '' && (await p.$$('#fc-student option')).length > 2);
  { const w = await p.locator('.fsearch__who').boundingBox(), x = await p.locator('.fsearch__box').boundingBox(); ok('…on the search row, before the search box', Math.abs(w.y - x.y) < 2 && w.x < x.x); }
  const pick = await p.$$eval('#fc-student option', (e) => e.find((x) => x.textContent.includes('Karnataka'))?.value);
  await p.selectOption('#fc-student', pick); await p.waitForTimeout(300);
  ok('…their country and state fill the bar', (await p.inputValue('#fc-country')) === 'India' && (await p.inputValue('#fc-state')) === 'Karnataka');
  await p.fill('#fc-q', 'mba uk'); await p.click('.fsearch__go'); await p.waitForTimeout(900);
  ok('the bar has six parts, Intake last and optional', (await p.$$('.fseg__item')).length === 6 && (await p.textContent('label[for=fc-intake]')).trim() === 'Intake' && (await p.inputValue('#fc-intake')) === '');
  ok('no Intake in the side filters', !(await p.$('#ff-intake')));
  const dts = await p.locator('.course').first().locator('dt').allTextContents();
  ok('cards: no IELTS', !dts.includes('IELTS'), JSON.stringify(dts));
  ok('cards: "Last updated on … 26"', /^Last updated on \d{1,2} \w{3} 26$/.test((await p.locator('.course__checked').first().textContent()).trim()));
  ok('cards: every university shows its logo', (await p.locator('.course .umark--logo img').count()) === (await p.locator('.course').count()));
  await p.selectOption('#fc-student', ''); await p.waitForTimeout(300);
  ok('no student: back to the agency’s own country', (await p.inputValue('#fc-student')) === '');

  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
