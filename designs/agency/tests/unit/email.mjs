// Email (Jovial, 10 Nov): Q29 an application's mail goes out from GSP Admission with its GSP ID in the subject;
// Q30 the compliance inbox's address; Q31 Not needed sorts a mail into Others, kept on the mail.
//   cd designs/agency && node tests/unit/email.mjs
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
let pass = 0, fail = 0;
const ok = (name, cond, more = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond || !more ? '' : `: ${more}`}`); };
try {
  const mb = await vite.ssrLoadModule('/src/data/mailbox.ts');
  ok('the compliance inbox is compliance.gsp@upgrad.com', mb.groupOf('compliance')?.email === 'compliance.gsp@upgrad.com');
  ok('application mail goes from a seeded inbox', !!mb.groupOf(mb.APPLICATION_MAILBOX));
  const a = { id: 'GSP-23305', uniRef: 'UNI-778' };
  ok('a new mail’s subject starts with the GSP ID and the university reference', mb.appSubjectTag(a) === 'GSP-23305 · UNI-778');
  ok('a subject without the GSP ID gets it', mb.withAppTag(a, 'Offer query') === 'GSP-23305 · UNI-778 · Offer query');
  ok('a subject that has it is kept', mb.withAppTag(a, 'Re: GSP-23305 · UNI-778 · Offer query') === 'Re: GSP-23305 · UNI-778 · Offer query');
  ok('no university reference yet: the GSP ID alone', mb.withAppTag({ id: 'GSP-1' }, 'Hello') === 'GSP-1 · Hello');
  const m = { id: 'x', group: 'admission', folder: 'inbox', from: { name: 'A', email: 'a@b' }, to: [], subject: 's', body: '', at: 0, read: false };
  ok('a mail not placed is Not linked', mb.categoryOf(m) === 'unlinked');
  ok('Not needed puts it in Others', mb.categoryOf({ ...m, notNeeded: { by: 'Me', at: 1 } }) === 'other');
  for (const f of ['src/gsp/applications/Mail.tsx', 'src/institution/applications/Mail.tsx']) {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    ok(`${f}: sends from the application inbox, not the person`, src.includes('groupOf(APPLICATION_MAILBOX)') && !src.includes('GSP_USER'));
  }
  const inbox = readFileSync(new URL('../../src/mailbox/MailInbox.tsx', import.meta.url), 'utf8');
  ok('the Inbox nudge offers Not needed', /onClick=\{onNotNeeded\}/.test(inbox));
} finally {
  await vite.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
