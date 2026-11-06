// Inbox (Nesil, 3 Nov): GSP's shared inboxes in GSP Team, GSP · Institution and GSP · Admin, not RP Admin.
const { chromium } = require('playwright');
const URL = process.env.GSP_URL || require('url').pathToFileURL(require('path').resolve(__dirname, '../../dist-artifact/index.html')).href;
let pass = 0;
const fails = [];
const ok = (c, m) => (c ? pass++ : fails.push(m));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const open = async (role, w = 1440) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, acceptDownloads: true });
    await ctx.addInitScript((r) => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('gsp-proto-role', r); localStorage.setItem('gsp-theme', 'light'); localStorage.setItem('gsp-proto-link', JSON.stringify({ mode: 'off', app: '' })); sessionStorage.setItem('init', '1'); } } catch {} }, role);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
    await p.goto(URL + '#home');
    await wait(1800);
    return { p, ctx, errs };
  };
  const navInbox = (p) => p.locator('nav button', { hasText: /^Inbox$/ });

  // RP Admin has none
  {
    const { p, ctx } = await open('rp-admin');
    ok((await navInbox(p).count()) === 0, 'RP Admin: no Inbox in the menu');
    await ctx.close();
  }

  for (const [role, who, start] of [['gsp-team', 'Freddy Forrest', 5], ['institution-partner', 'Raj Shamani', 3], ['gsp-admin', 'Ishaan Verma', 14]]) {
    const { p, ctx, errs } = await open(role);
    const T = (m) => `${role}: ${m}`;
    ok((await navInbox(p).count()) >= 1 && (await navInbox(p).first().isVisible()), T('Inbox in the menu'));
    const labels = await p.locator('nav.pnav, nav').first().locator('button').allInnerTexts();
    ok(labels.map((x) => x.trim()).indexOf('Inbox') === 1, T('Inbox comes right after Home: ' + labels.slice(0, 3).join('|')));
    await navInbox(p).first().click();
    await wait(800);
    ok((await p.locator('h1').first().innerText()) === 'Inbox', T('the page is Inbox'));
    ok((await p.locator('.mbx__folder').allInnerTexts()).map((x) => x.replace(/\d+|unread/g, '').trim()).join('|') === 'Inbox|Sent|Drafts|Archive', T('four folders'));
    // the email groups
    await p.locator('#mb-group').click(); await wait(250);
    const opts = await p.locator('.smenu__list [role=option]').count();
    ok(opts === start + 1, T(`All inboxes plus ${start} connected groups (got ${opts})`));
    await p.keyboard.press('Escape'); await wait(200);
    const rows = await p.locator('.mbx__row').count();
    ok(rows > 0, T('mail in the list'));
    ok((await p.locator('.mbx__pick').innerText()).includes('Pick a mail'), T('nothing open to start with'));
    // reading marks it read
    const unread0 = Number((await p.locator('.mbx__folder').first().locator('.mbx__n').innerText().catch(() => '0')).replace(/\D/g, '') || 0);
    const firstUnread = p.locator('.mbx__row.is-unread').first();
    const subj = (await firstUnread.locator('.mbx__subject').innerText()).trim();
    await firstUnread.click(); await wait(500);
    ok((await p.locator('#mb-subject').innerText()).trim() === subj, T('the mail opens beside the list'));
    const unread1 = Number((await p.locator('.mbx__folder').first().locator('.mbx__n').innerText().catch(() => '0')).replace(/\D/g, '') || 0);
    ok(unread1 === unread0 - 1, T(`opening it marks it read (${unread0} → ${unread1})`));
    ok((await p.locator('.mbx__row.is-on').count()) === 1, T('the open mail is marked in the list'));
    // Summarise
    await p.locator('.gmail__sum-btn').click(); await wait(1500);
    ok((await p.locator('.gmail__sum-list li').count()) >= 1, T('GSP Assist sums it up'));
    // mark unread
    await p.getByRole('button', { name: 'Mark as unread', exact: true }).click(); await wait(300);
    const unread2 = Number((await p.locator('.mbx__folder').first().locator('.mbx__n').innerText()).replace(/\D/g, ''));
    ok(unread2 === unread0, T('Mark as unread puts it back'));
    // attachments: filter, preview, download
    await p.locator('.mbx__chip').click(); await wait(300);
    const withFiles = await p.locator('.mbx__row').count();
    ok(withFiles > 0 && withFiles < rows && (await p.locator('.mbx__row .mbx__tag--files').count()) === withFiles, T('With attachments shows only mail with files'));
    await p.locator('.mbx__row').first().click(); await wait(500);
    ok((await p.locator('.mbx__file').count()) >= 1, T('the attachments are listed'));
    ok(/KB|MB/.test(await p.locator('.mbx__file-sub').first().innerText()), T('each with its type and size'));
    await p.locator('.mbx__file-main').first().click(); await wait(500);
    ok(await p.locator('.dprev .dpaper').isVisible(), T('Preview opens the first page'));
    ok((await p.locator('.dprev').getByRole('button', { name: 'Open in a new tab' }).count()) === 1, T('the preview offers Open in a new tab'));
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.locator('.dprev').getByRole('button', { name: 'Download' }).click()]);
    ok(!!dl, T('Download saves the file'));
    await p.keyboard.press('Escape'); await wait(400);
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), p.locator('.mbx__file-acts button[title="Open in a new tab"]').first().click()]);
    ok(!!pop, T('Open in a new tab opens it'));
    if (pop) await pop.close();
    await p.locator('.mbx__chip').click(); await wait(300);
    // search
    await p.locator('.mbx__search input').fill('zzzz no such mail'); await wait(300);
    ok((await p.locator('.mbx__row').count()) === 0 && (await p.getByText('No mail matches').count()) === 1, T('a search with no match says so'));
    await p.getByRole('button', { name: 'Clear the search', exact: true }).click(); await wait(300);
    ok((await p.locator('.mbx__row').count()) === rows, T('Clear the search brings the list back'));
    // reply: from the mail's own inbox, quoting it; sending puts it in Sent
    await p.locator('.mbx__row').first().click(); await wait(400);
    const g0 = (await p.locator('.mbx__subj .mbx__tag').first().innerText()).trim();
    await p.getByRole('button', { name: 'Reply', exact: true }).click(); await wait(500);
    ok((await p.locator('#mb-from option:checked').innerText()).startsWith(g0), T('a reply goes from the mail’s own inbox'));
    ok((await p.locator('#mb-subject').inputValue()).startsWith('Re: '), T('Re: on the subject'));
    ok((await p.locator('#mb-body').inputValue()).includes('wrote:'), T('the reply quotes the mail'));
    await p.locator('#mb-to').fill(''); await p.getByRole('button', { name: 'Send', exact: true }).click(); await wait(300);
    ok((await p.locator('.gmail__err').innerText()).includes('who it’s to'), T('no address: it asks for one'));
    await p.locator('#mb-to').fill('someone@university.edu');
    await p.locator('#mb-body').fill('Thanks, noted.');
    await p.getByRole('button', { name: 'Send', exact: true }).click(); await wait(600);
    ok((await p.locator('.toast__title').innerText().catch(() => '')).includes('Sent'), T('Sent, said in the corner'));
    await p.locator('.mbx__folder', { hasText: 'Sent' }).click(); await wait(400);
    ok((await p.locator('.mbx__row').first().innerText()).includes('someone@university.edu'), T('the reply is first in Sent'));
    // a new mail kept as a draft, reopened, then discarded
    await p.getByRole('button', { name: 'New mail', exact: true }).click(); await wait(500);
    await p.locator('#mb-to').fill('test@uni.edu');
    await p.locator('#mb-subject').fill('Draft test');
    await p.getByRole('button', { name: 'Save draft', exact: true }).click(); await wait(500);
    await p.locator('.mbx__folder', { hasText: 'Drafts' }).click(); await wait(400);
    const dr = p.locator('.mbx__row', { hasText: 'Draft test' });
    ok((await dr.count()) === 1, T('the draft is in Drafts'));
    await dr.click(); await wait(500);
    ok((await p.locator('#mb-subject').inputValue()) === 'Draft test', T('a draft reopens in the writer'));
    await p.getByRole('button', { name: 'Discard', exact: true }).click(); await wait(400);
    ok((await p.locator('.mbx__row', { hasText: 'Draft test' }).count()) === 0, T('Discard deletes the draft'));
    // attach a file in the writer
    await p.getByRole('button', { name: 'New mail', exact: true }).click(); await wait(400);
    await p.locator('.mbx__compose input[type=file]').setInputFiles({ name: 'Notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x'.repeat(3000)) });
    await wait(200);
    ok((await p.locator('.mbx__fchip').innerText()).includes('Notes.pdf'), T('Attach files adds the file'));
    await p.locator('.mbx__fchip-x').click(); await wait(200);
    ok((await p.locator('.mbx__fchip').count()) === 0, T('× takes it off'));
    await p.getByRole('button', { name: 'Discard', exact: true }).click(); await wait(300);
    // archive and back
    await p.locator('.mbx__folder', { hasText: 'Inbox' }).click(); await wait(300);
    const n0 = await p.locator('.mbx__row').count();
    const s1 = (await p.locator('.mbx__row').first().locator('.mbx__subject').innerText()).trim();
    await p.locator('.mbx__row').first().click(); await wait(300);
    await p.locator('.mbx__actions').getByRole('button', { name: 'Archive' }).click(); await wait(400);
    ok((await p.locator('.mbx__row').count()) === n0 - 1, T('Archive takes it out of the Inbox'));
    await p.locator('.mbx__folder', { hasText: 'Archive' }).click(); await wait(300);
    await p.locator('.mbx__row', { hasText: s1 }).first().click(); await wait(300);
    await p.locator('.mbx__actions').getByRole('button', { name: 'Move to Inbox' }).click(); await wait(300);
    await p.locator('.mbx__folder', { hasText: 'Inbox' }).click(); await wait(300);
    ok((await p.locator('.mbx__row').count()) === n0, T('Move to Inbox brings it back'));
    // filter by email group
    await p.locator('#mb-group').click(); await wait(250);
    await p.locator('.smenu__list [role=option]').nth(1).click(); await wait(300);
    const gname = (await p.locator('#mb-group').innerText()).replace(/\d+/g, '').trim();
    const tagsShown = await p.locator('.mbx__row .mbx__tag:not(.mbx__tag--files)').count();
    ok(tagsShown === 0 && (await p.locator('.mbx__count').innerText()).includes(gname), T(`one group (${gname}) shows only its mail`));
    await p.locator('#mb-group').click(); await wait(250);
    await p.locator('.smenu__list [role=option]').first().click(); await wait(300);
    // connect and disconnect
    await p.getByRole('button', { name: 'Connect inboxes' }).first().click(); await wait(600);
    ok((await p.locator('.mbx__box').count()) === 14, T('all 14 email groups in Connect inboxes'));
    ok((await p.locator('.mbx__box.is-on').count()) === start, T(`${start} connected to start with`));
    if (start < 14) {
      const name = (await p.locator('.mbx__box:not(.is-on) .mbx__box-name').first().innerText()).trim();
      await p.locator('#mb-since').selectOption('90');
      await p.getByRole('button', { name: `Connect ${name}` }).click(); await wait(400);
      ok((await p.locator('.mbx__box-busy').count()) === 1, T('Connecting… while it syncs'));
      await wait(1300);
      ok((await p.locator('.mbx__box.is-on', { hasText: name }).count()) === 1, T(`${name} connected`));
    }
    const off = (await p.locator('.mbx__box.is-on .mbx__box-name').first().innerText()).trim();
    await p.getByRole('button', { name: `Disconnect ${off}` }).click(); await wait(300);
    ok((await p.locator('.mbx__box.is-on', { hasText: off }).count()) === 0, T(`${off} disconnected`));
    await p.getByRole('button', { name: 'Done', exact: true }).click(); await wait(400);
    ok((await p.locator('.mbx__row .mbx__tag', { hasText: off }).count()) === 0, T('its mail goes from the list'));
    // an application's mail opens it (GSP Admission)
    if (role !== 'institution-partner') {
      const appMail = p.locator('.mbx__row', { hasText: 'Conditional offer' }).first();
      if (await appMail.count()) {
        await appMail.click(); await wait(400);
        await p.locator('.mbx__app').click(); await wait(1200);
        ok((await p.locator('h1').first().innerText()) !== 'Inbox' && (await p.locator('nav button[aria-current=page]').first().innerText()).includes('Applications'), T('Open application goes to it'));
      } else ok(role === 'gsp-admin' && off === 'GSP Admission', T('the offer mail is there'));
    }
    ok(errs.length === 0, T('no errors: ' + errs.slice(0, 2).join(' / ')));
    await ctx.close();
  }

  // phones: the list, then the mail on its own with Back
  {
    const { p, ctx } = await open('gsp-team', 390);
    await p.locator('.tabbar .tab', { hasText: 'Inbox' }).click(); await wait(600);
    ok(await p.locator('.mbx__list').isVisible(), 'phone: the list first');
    ok(!(await p.locator('.mbx__pane').isVisible()), 'phone: no empty reading pane');
    await p.locator('.mbx__row').first().click(); await wait(500);
    ok(!(await p.locator('.mbx__list').isVisible()) && (await p.locator('#mb-subject').isVisible()), 'phone: the mail takes the screen');
    await p.getByRole('button', { name: 'Back to the list' }).click(); await wait(400);
    ok(await p.locator('.mbx__list').isVisible(), 'phone: Back to the list');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= 390, 'phone: nothing wider than the screen: ' + sw);
    await ctx.close();
  }
  await b.close();
  console.log(`${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('FAIL ', f));
})();
