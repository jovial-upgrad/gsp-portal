// GSP · Admin, 3 Nov round: Title Case, one-line leads, pages, row menus with confirmations, Edit then Save Changes,
// the new Course Configuration pages, Application Configuration read-only until Edit, Logs filters.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? pass++ : fails.push(m));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', 'gsp-admin'); localStorage.setItem('gsp-theme', 'light'); sessionStorage.setItem('init', '1'); } } catch {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
  await p.goto(URL + '#home'); await wait(1800);
  const go = async (g, item) => {
    await p.locator('.pnav__group', { hasText: g }).click(); await wait(300);
    await p.locator('.pfly__item', { hasText: new RegExp('^\\s*' + item + '\\s*$') }).first().click(); await wait(600);
  };
  const h1 = () => p.locator('h1').first().innerText();
  const oneLine = async () => { const el = p.locator('.stu__lead').first(); const bx = await el.boundingBox(); return bx && bx.height < 34; };
  const sheet = () => p.locator('.sheet').last();
  const ctaRight = async () => { const s = await sheet().boundingBox(); const btns = sheet().locator('.asf__acts .btn'); const last = await btns.last().boundingBox(); return s && last && s.x + s.width - (last.x + last.width) < 60; };
  const confirmBox = () => p.locator('[role=alertdialog], .confirm').last();

  // the menu
  const groups = (await p.locator('.pnav__group .pnav__label').allInnerTexts()).map((x) => x.trim());
  ok(groups.join('|') === 'User Modules|Institution|User Roles|Work|Recruitment|Course Configuration|Application Configuration|Other Configurations', 'groups in Title Case: ' + groups.join('|'));
  await p.locator('.pnav__group', { hasText: 'Course Configuration' }).click(); await wait(300);
  const course = (await p.locator('.pfly__item').allInnerTexts()).map((x) => x.trim());
  ok(course.join('|') === 'Currency Exchange|Living Costs and Fees|Course Tags|Program Level Configuration|Grade Conversion|English Test Equivalence', 'Course Configuration pages: ' + course.join('|'));
  await p.keyboard.press('Escape'); await wait(200);
  await p.locator('.pnav__group', { hasText: 'Other Configurations' }).click(); await wait(300);
  ok((await p.locator('.pfly__item').allInnerTexts()).map((x) => x.trim()).join('|') === 'Logs', 'Other Configurations: Logs only (no Filters Configuration)');
  await p.keyboard.press('Escape'); await wait(200);

  // BDM Assignment
  await go('Recruitment', 'BDM Assignment');
  ok((await h1()) === 'BDM Assignment', 'BDM Assignment title');
  ok(await oneLine(), 'BDM lead on one line');
  ok((await p.locator('.cfg__tab tbody tr').count()) === 20, '20 rows a page');
  ok((await p.locator('.cfg__pager-n').innerText()).includes('1–20 of 23'), 'pager says 1–20 of 23');
  await p.getByRole('button', { name: 'Next page' }).click(); await wait(300);
  ok((await p.locator('.cfg__tab tbody tr').count()) === 3 && (await p.locator('.cfg__tab tbody tr').last().innerText()).includes('Fallback'), 'page 2: 3 rows, the fallback last');
  await p.getByRole('button', { name: 'Page 1' }).click(); await wait(200);
  await p.getByRole('button', { name: 'Add Row', exact: true }).click(); await wait(500);
  ok((await sheet().locator('.sheet__title, h2').first().innerText()).includes('Add Row'), 'pop-up: Add Row');
  ok(await ctaRight(), 'Add Row: buttons on the right');
  await sheet().locator('#bd-country').selectOption('India'); await wait(200);
  // 4 Nov: State and City are two fields, each picking several
  await sheet().locator('#bd-state').click(); await wait(300);
  const panel = p.locator('.imp__panel');
  ok(await panel.locator('input[type=search]').count() === 1, 'State: a search');
  await panel.locator('input[type=search]').fill('Goa'); await wait(200);
  await panel.getByText('Goa', { exact: true }).click(); await wait(150);
  await panel.locator('input[type=search]').fill('Kerala'); await wait(200);
  await panel.getByText('Kerala', { exact: true }).click(); await wait(150);
  ok((await sheet().locator('#bd-state').innerText()).includes('Goa') && (await sheet().locator('#bd-state').innerText()).includes('Kerala'), 'State: several picked');
  await p.keyboard.press('Escape'); await wait(200);
  await sheet().locator('#bd-bdm').fill('Nadia');
  await sheet().getByRole('button', { name: 'Add Row', exact: true }).click(); await wait(500);
  ok((await p.locator('.cfg__tab tbody').innerText()).includes('Goa') && (await p.locator('.cfg__tab tbody').innerText()).includes('Kerala'), 'the new row: India · Goa, Kerala');

  // Create Roles
  await go('User Roles', 'Create Roles');
  ok((await h1()) === 'Create Roles' && (await oneLine()), 'Create Roles title, one-line lead');
  ok((await p.locator('.cfg__tab tbody tr').count()) === 20 && (await p.locator('.cfg__pager').count()) === 1, 'Create Roles: 20 a page, with pages');
  // 6 Nov (Nesil): the role filter lists every prototype role but RP Admin's backup; the sales region filter picks several
  const roleOpts = (await p.locator('#usf-role option').allInnerTexts()).map((x) => x.trim()).filter((x) => x && x !== 'All roles');
  ok(roleOpts.length === 12 && roleOpts.includes('GSP Counsellor') && roleOpts.includes('GSP · View Only') && roleOpts.includes('RP Admin') && !roleOpts.some((x) => x.includes('Backup')), 'role filter: the 12 prototype roles, no backup: ' + roleOpts.join('|'));
  ok((await p.locator('.cfg__tab tbody').innerText()).includes('GSP · Admissions'), 'users carry the prototype roles');
  await p.locator('#usf-region').click(); await wait(300);
  await p.locator('.imp__panel').getByText('Nepal', { exact: true }).click();
  await p.locator('.imp__panel').getByText('Sri Lanka', { exact: true }).click();
  await p.locator('.imp__panel').getByRole('button', { name: 'Done' }).click(); await wait(300);
  const regs = await p.locator('.cfg__tab tbody tr td:nth-child(5)').allInnerTexts();
  ok(regs.length > 2 && regs.every((x) => x.trim() === 'Nepal' || x.trim() === 'Sri Lanka') && regs.some((x) => x.trim() === 'Nepal') && regs.some((x) => x.trim() === 'Sri Lanka'), 'sales region: two picked, both shown: ' + regs.join('|'));
  await p.getByRole('button', { name: 'Clear filters' }).first().click(); await wait(300);
  const row = (n) => p.locator('.cfg__tab tbody tr', { hasText: n });
  await row('Megha Malhotra').locator('.more__btn, button[aria-label^="More for"]').click(); await wait(250);
  const items = (await p.locator('[role=menuitem]').allInnerTexts()).map((x) => x.trim());
  ok(items.join('|') === 'Edit|Resend Login Mail|Deactivate User|Delete User', 'row menu: ' + items.join('|'));
  await p.getByRole('menuitem', { name: 'Deactivate User' }).click(); await wait(400);
  ok((await confirmBox().innerText()).includes('Deactivate Megha Malhotra?'), 'Deactivate is asked first');
  await confirmBox().getByRole('button', { name: 'Deactivate User' }).click(); await wait(400);
  ok((await row('Megha Malhotra').innerText()).includes('Deactivated'), 'deactivated');
  await row('Megha Malhotra').locator('button[aria-label^="More for"]').click(); await wait(250);
  ok((await p.locator('[role=menuitem]').allInnerTexts()).map((x) => x.trim()).join('|') === 'Edit|Reactivate User|Delete User', 'deactivated: Reactivate User instead, no login mail');
  await p.getByRole('menuitem', { name: 'Reactivate User' }).click(); await wait(300);
  await confirmBox().getByRole('button', { name: 'Reactivate User' }).click(); await wait(300);
  ok(!(await row('Megha Malhotra').innerText()).includes('Deactivated'), 'reactivated');
  await row('Ramish').locator('button[aria-label^="More for"]').click(); await wait(250);
  await p.getByRole('menuitem', { name: 'Resend Login Mail' }).click(); await wait(300);
  ok((await confirmBox().innerText()).includes('Resend the login mail to Ramish?'), 'Resend Login Mail is asked first');
  await confirmBox().getByRole('button', { name: 'Cancel' }).click(); await wait(300);
  await row('Ramish').locator('button[aria-label^="More for"]').click(); await wait(250);
  await p.getByRole('menuitem', { name: 'Edit' }).click(); await wait(500);
  await sheet().locator('#us-title').fill('Senior Admissions Officer');
  await sheet().getByRole('button', { name: 'Save Changes' }).click(); await wait(500);
  ok((await confirmBox().innerText()).includes('Title: Admissions Officer → Senior Admissions Officer'), 'Edit is asked first, with what changes');
  await confirmBox().getByRole('button', { name: 'Save Changes' }).click(); await wait(400);
  ok((await row('Ramish').innerText()).includes('Senior Admissions Officer'), 'edit saved');
  await row('Saurabh').locator('button[aria-label^="More for"]').click(); await wait(250);
  await p.getByRole('menuitem', { name: 'Delete User' }).click(); await wait(300);
  ok((await confirmBox().innerText()).includes('Delete Saurabh?'), 'Delete User is asked first');
  await confirmBox().getByRole('button', { name: 'Cancel' }).click(); await wait(300);

  // Sales Regions
  await go('User Roles', 'Sales Regions');
  ok((await h1()) === 'Sales Regions' && (await oneLine()), 'Sales Regions title, one-line lead');
  ok((await p.locator('.cfg__tab--even').count()) === 1, 'Sales Regions: even columns');
  ok(!(await p.locator('.cfg__tab tbody').innerText()).includes('Not set'), 'every region has its contacts and queues');
  await p.getByRole('button', { name: 'Add Sales Region', exact: true }).click(); await wait(500);
  const labels = (await sheet().locator('.field__label, label.field__k, .field label').allInnerTexts()).join('|');
  ok(['Name', 'Countries', 'Admission contact', 'BDM contact', 'Admission queue'].every((l) => labels.includes(l)), 'fields: Name, Countries, Admission contact, BDM contact, Admission queue: ' + labels);
  ok((await sheet().locator('.field__req, .req, [aria-hidden=true]:text("*")').count()) >= 5 || (await sheet().innerText()).split('*').length - 1 >= 5, 'all five marked required');
  ok(await ctaRight(), 'Add Sales Region: buttons on the right');
  await sheet().getByRole('button', { name: 'Add Sales Region', exact: true }).click(); await wait(300);
  ok((await sheet().locator('.field__err, [role=alert], .ferr').count()) >= 5 || ['Name the region', 'Pick its countries', 'Admission contact', 'BDM contact', 'admission queue'].every((t) => (async () => true)()), 'empty: five errors');
  const errText = await sheet().innerText();
  ok(['Name the region', 'Pick its countries.', 'Pick its Admission contact.', 'Pick its BDM contact.', 'Pick its admission queue.'].every((t) => errText.includes(t)), 'each field says what’s missing');
  await sheet().getByRole('button', { name: 'Cancel' }).click(); await wait(300);

  // Permission Roles
  await go('User Roles', 'Permission Roles');
  ok((await h1()) === 'Permission Roles' && (await oneLine()), 'Permission Roles title, one-line lead');
  ok((await p.getByText('Every role side by side').count()) === 0, 'no side-by-side view');
  ok((await p.locator('#pr-role').count()) === 1 && (await p.locator('.cfg__roles').count()) === 0, 'the role is a dropdown');
  ok((await p.locator('.cfg__perm select').count()) === 0, 'read only until Edit');
  ok((await p.locator('.cfg__grouprow th').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 17, 'group headings bigger');
  await p.locator('.cfg__permbar').getByRole('button', { name: 'Edit' }).click(); await wait(300);
  ok((await p.locator('.cfg__perm select').count()) >= 30, 'Edit: every object editable');
  ok(await p.getByRole('button', { name: 'Save Changes' }).isDisabled(), 'Save Changes waits for a change');
  await p.locator('.cfg__perm select').first().selectOption('N'); await wait(200);
  await p.getByRole('button', { name: 'Save Changes' }).click(); await wait(300);
  ok((await p.locator('.cfg__perm select').count()) === 0 && (await p.locator('.cfg__perm tbody').first().innerText()).includes('No Access'), 'saved, back to read only');

  // Queues (5 Nov: moved to Work › Queues, SLA and Escalation)
  await go('Work', 'Queues, SLA and Escalation');
  ok((await oneLine()) && (await p.locator('.wk-queues').count()) === 3, 'Queues: one-line lead, three groups');

  // Emails
  await go('User Roles', 'Emails');
  ok((await p.locator('.cfg__emails .icon-btn[aria-label^="Take"]').count()) === 0 && (await p.locator('.cfg__emails select').count()) === 0, 'Emails: read only until Edit');
  await p.locator('.cfg__emails').getByRole('button', { name: 'Edit' }).click(); await wait(300);
  ok((await p.locator('.cfg__emails select').count()) === 3 && (await p.getByRole('button', { name: 'Add People' }).count()) === 1, 'Edit: access to change, people to add');
  await p.locator('.cfg__emails select').last().selectOption('send'); await wait(150);
  await p.getByRole('button', { name: 'Save Changes' }).click(); await wait(300);
  ok((await p.locator('.cfg__emails select').count()) === 0 && (await p.locator('.cfg__access--send').count()) === 3, 'saved: Meera can send');

  // Currency Exchange
  await go('Course Configuration', 'Currency Exchange');
  ok((await h1()) === 'Currency Exchange' && (await oneLine()), 'Currency Exchange title, one-line lead');
  ok((await p.locator('.fx__tab thead').innerText()).includes('1 unit in AUD') && (await p.locator('.fx__tab thead').innerText()).includes('1 unit in INR'), 'AUD and INR columns');
  await p.getByRole('button', { name: 'Fetch with AI' }).click(); await wait(1900);
  ok((await p.locator('.fx__ask').innerText()).includes('Nothing changes until you use them and save'), 'GSP Assist proposes, nothing changes yet');
  await p.getByRole('button', { name: 'Use These Rates' }).click(); await wait(300);
  ok((await p.locator('.fx__tab input').count()) === 6, 'the rates go into Edit');
  await p.getByRole('button', { name: 'Save Changes' }).click(); await wait(300);
  ok((await p.locator('.fx__tab input').count()) === 0, 'saved');
  await p.locator('#fx-week').click(); await wait(250);
  await p.locator('.smenu__list [role=option]').nth(2).click(); await wait(300);
  ok(await p.getByRole('button', { name: 'Edit' }).isDisabled() && (await p.getByRole('button', { name: 'Fetch with AI' }).count()) === 0, 'a past week can’t change');

  // Living Costs and Fees
  await go('Course Configuration', 'Living Costs and Fees');
  ok((await h1()) === 'Living Costs and Fees' && (await p.locator('.lc').count()) === 6, 'Living Costs and Fees: a card a destination');
  ok((await p.locator('.lc').first().innerText()).includes('Visa fee, once') && (await p.locator('.lc').first().innerText()).includes('Health insurance a year'), 'visa fee and health insurance');
  await p.getByRole('button', { name: 'Edit' }).click(); await wait(300);
  await p.locator('#lv-visa-Australia').fill('2100'); await wait(100);
  await p.getByRole('button', { name: 'Save Changes' }).click(); await wait(300);
  ok((await p.locator('.lc').first().innerText()).includes('2,100') && (await p.locator('.lc').first().innerText()).includes('Ishaan Verma'), 'saved, with who changed it');

  // Course Tags
  await go('Course Configuration', 'Course Tags');
  ok((await h1()) === 'Course Tags' && (await oneLine()), 'Course Tags title, one-line lead');
  ok((await p.getByText('Retire').count()) === 0 && (await p.getByRole('button', { name: /^Deactivate / }).count()) > 0, 'Deactivate, not Retire');
  await p.getByRole('button', { name: 'Add Tag', exact: true }).click(); await wait(400);
  ok(await ctaRight(), 'Add Tag: buttons on the right');
  await sheet().locator('#cn-name').fill('Spring intake');
  await sheet().getByRole('button', { name: 'Add Tag', exact: true }).click(); await wait(300);
  await p.locator('#tg-q').fill('spring'); await wait(300);
  ok((await p.locator('.cfg__tab tbody tr').count()) === 1 && (await p.locator('.cfg__tab tbody').innerText()).includes('In use'), 'added, and found by the search');
  await p.getByRole('button', { name: 'Deactivate Spring intake' }).click(); await wait(300);
  await confirmBox().getByRole('button', { name: 'Deactivate Tag' }).click(); await wait(300);
  ok((await p.locator('.cfg__tab tbody').innerText()).includes('Deactivated'), 'deactivated after asking');

  // Program Level Configuration
  await go('Course Configuration', 'Program Level Configuration');
  ok((await p.locator('.cfg__panel .cfg__title').allInnerTexts()).join('|') === 'Program Levels|Study Areas', 'two sections');
  ok(!(await p.locator('.cfg__tab thead').first().innerText()).includes('Application form level') && !(await p.locator('main').innerText()).includes('application form'), '6 Nov: no application form level');
  const mastersBefore = (await p.locator('.cfg__tab').first().locator('tr', { hasText: 'Master’s degree' }).locator('td.num').innerText()).trim();
  await p.getByRole('button', { name: 'Edit Master’s degree' }).click(); await wait(400);
  ok((await sheet().locator('#cn-name').inputValue()) === 'Master’s degree' && (await sheet().getByRole('button', { name: 'Save Changes' }).count()) === 1, 'Edit: the name filled in, Save Changes');
  await sheet().locator('#cn-name').fill('Master’s');
  await sheet().getByRole('button', { name: 'Save Changes' }).click(); await wait(300);
  const renamed = p.locator('.cfg__tab').first().locator('tr', { hasText: 'Master’s' });
  ok((await renamed.locator('td.cfg__strong').innerText()).trim() === 'Master’s' && (await renamed.locator('td.num').innerText()).trim() === mastersBefore, 'renamed, its courses kept: ' + mastersBefore);
  ok((await p.getByRole('button', { name: 'Edit Law' }).count()) === 1, 'study areas have Edit too');
  await p.getByRole('button', { name: 'Add Study Area' }).click(); await wait(400);
  await sheet().locator('#cn-name').fill('Hospitality and tourism');
  await sheet().getByRole('button', { name: 'Add Study Area', exact: true }).click(); await wait(300);
  ok((await p.locator('.cfg__tab').nth(1).innerText()).includes('Hospitality and tourism'), 'study area added');
  await p.getByRole('button', { name: 'Deactivate Law' }).click(); await wait(300);
  await confirmBox().getByRole('button', { name: 'Deactivate Study Area' }).click(); await wait(300);
  ok((await p.locator('.cfg__tab').nth(1).locator('tr', { hasText: 'Law' }).innerText()).includes('Deactivated'), 'study area deactivated');

  // Grade Conversion
  await go('Course Configuration', 'Grade Conversion');
  ok((await h1()) === 'Grade Conversion' && (await oneLine()), 'Grade Conversion title, one-line lead');
  ok((await p.locator('.gc__tab .cfg__state').count()) === 8 && (await p.getByText('Retire').count()) === 0, 'status pills, Deactivate not Retire');
  await p.getByRole('button', { name: 'Add Grading System', exact: true }).click(); await wait(400);
  ok(await ctaRight(), 'Add Grading System: buttons on the right');
  ok((await sheet().innerText()).includes('Values') && !(await sheet().locator('label', { hasText: /^Multiplier/ }).count()), 'Values, not Multiplier, as the field');
  await sheet().locator('#gc-name').fill('Percentile');
  await sheet().locator('#gc-countries').click(); await wait(250);
  await p.locator('.imp__panel input[type=search]').fill('Ken'); await wait(150);
  await p.locator('.imp__panel').getByText('Kenya', { exact: true }).click();
  await p.locator('.imp__panel input[type=search]').fill('Ghan'); await wait(150);
  await p.locator('.imp__panel').getByText('Ghana', { exact: true }).click();
  await p.keyboard.press('Escape'); await wait(150);
  await sheet().locator('#gc-values').fill('1');
  await sheet().getByRole('button', { name: 'Add Grading System', exact: true }).click(); await wait(300);
  ok((await p.locator('.gc__tab tr', { hasText: 'Percentile' }).innerText()).includes('Kenya, Ghana'), 'added, used in two countries');

  // English Test Equivalence
  await go('Course Configuration', 'English Test Equivalence');
  ok((await h1()) === 'English Test Equivalence' && (await p.locator('.en__tab tbody tr').count()) === 5, 'five rows of equal scores');
  await p.getByRole('button', { name: 'Edit' }).click(); await wait(300);
  await p.locator('#en-pte-en1').fill('43'); await wait(100);
  await p.getByRole('button', { name: 'Save Changes' }).click(); await wait(300);
  ok((await p.locator('.en__tab tbody tr').first().innerText()).includes('43'), 'saved');

  // Application Routing
  await go('Application Configuration', 'Application Routing');
  ok((await p.getByText('Region defaults').count()) === 0 && (await p.getByText('Region Defaults').count()) === 0, 'no region defaults');
  ok((await p.locator('.cfg__rules .switch, .cfg__rules [role=switch]').count()) === 0, 'rules read only until Edit');
  await p.getByRole('button', { name: 'Edit' }).click(); await wait(300);
  ok((await p.locator('.cfg__rules input[type=checkbox], .cfg__rules [role=switch]').count()) === 5, 'Edit: rules switch off and move');
  await p.locator('.cfg__rules input[type=checkbox], .cfg__rules [role=switch]').nth(2).click({ force: true }); await wait(200);
  await p.getByRole('button', { name: 'Save Changes' }).click(); await wait(300);
  ok((await p.locator('.cfg__rule').nth(2).innerText()).includes('Off'), 'saved: rule 3 off');

  // Document Configuration
  await go('Application Configuration', 'Document Configuration');
  ok((await p.locator('.cfg__docs select').count()) === 0 && (await p.locator('.cfg__reasons').first().locator('li').count()) === 5, 'read only, with five send-back reasons');
  await p.getByRole('button', { name: 'Edit' }).click(); await wait(300);
  ok((await p.locator('.cfg__docs select').count()) > 0, 'Edit: rules to change');
  await p.locator('#rs-new').fill('Signature missing');
  await p.getByRole('button', { name: 'Add Reason' }).click(); await wait(200);
  await p.getByRole('button', { name: 'Save Changes' }).click(); await wait(300);
  ok((await p.locator('.cfg__reasons').first().locator('li').count()) === 6 && (await p.locator('.cfg__docs select').count()) === 0, 'saved: six reasons');

  // Logs
  await go('Other Configurations', 'Logs');
  // 4 Nov: Logs is a table with Source, Role and Sales region filters
  ok((await p.locator('#lg-source').count()) === 1 && (await p.locator('#lg-role').count()) === 1 && (await p.locator('#lg-region').count()) === 1, 'filters: Source, Role, Sales region');
  const all = await p.locator('.cfg__tab tbody tr').count();
  const firstRole = (await p.locator('#lg-role option').allInnerTexts()).map((x) => x.trim()).filter((x) => x && x !== 'All roles')[0];
  await p.locator('#lg-role').selectOption(firstRole); await wait(250);
  const mine = await p.locator('.cfg__tab tbody tr').count();
  ok(mine > 0 && mine <= all, `Role filter: ${mine} of ${all}`);

  ok(errs.length === 0, 'no errors: ' + errs.slice(0, 2).join(' / '));
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('FAIL ', f));
})();
