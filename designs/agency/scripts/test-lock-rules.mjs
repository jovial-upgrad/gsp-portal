// The work rules added by Jovial's lock answers (2 Nov): T69's agreement reminders and task (L-5), T70's university
// tasks after a partner is reopened (S2C-19), T71's "tell the university" task after a close from Submitted to
// university onwards (S3C-9), T62's nationality tasks (S1C-13), T7 and T52 back (L-1), and that T43 and T59 are gone.
// Every rule id is used once. Every
// derived item must come from a rule and a record: no rule, or no record that meets it, gives nothing. Exits 1 on any
// failure.   node scripts/test-lock-rules.mjs   (from designs/agency)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.__glob = () => ({});
globalThis.window = globalThis.window ?? { addEventListener: () => {}, removeEventListener: () => {} };
const out = await build({
  stdin: { contents: "export * from './src/work/rpRules.ts'; export { RULES, KINDS, QUEUES } from './src/work/seed.ts'; export * as R from './src/work/routing.ts'; export { APP_LOGIC } from './src/work/engine.ts';", resolveDir: path.join(here, '..'), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', jsx: 'automatic', resolveExtensions: ['.ts', '.tsx', '.js', '.json'], define: { 'import.meta.glob': 'globalThis.__glob', 'import.meta.env.MODE': '"test"' },
  loader: { '.webp': 'empty', '.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.css': 'empty' },
});
// the bundle is too big for a data: URL: written under node_modules/.cache, so its packages resolve
const dir = path.join(here, '..', 'node_modules', '.cache');
mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'test-lock-rules.mjs');
writeFileSync(file, out.outputFiles[0].text);
const W = await import(pathToFileURL(file).href);
let pass = 0, fail = 0;
const ok = (what, got, exp) => { const g = JSON.stringify(got), e = JSON.stringify(exp); if (g === e) pass++; else { fail++; console.log(`FAIL ${what}: expected ${e} got ${g}`); } };
const DAY = 86_400_000;
const rules = structuredClone(W.RULES);
// the queue comes from the rule's kind of work's Goes to (5 Nov), so the kinds and queues are the seed's
const s = { rules, closed: {}, frozen: {}, kinds: structuredClone(W.KINDS), queues: structuredClone(W.QUEUES) };
const now = Date.parse('2026-11-02T12:00:00+05:30');
const sent = (daysAgo) => ({ id: 'rp-x', name: 'Sample agency', country: 'India', status: 'Agreement sent', agreements: [{ id: 'v1', version: 'v1', file: 'a.pdf', size: 1, uploadedAt: now - daysAgo * DAY, uploadedBy: 'RP Ops', sentAt: now - daysAgo * DAY, status: 'Sent' }], activity: [] });

ok('T43 removed', rules.some((r) => r.row === 'T43'), false);
ok('T59 removed', rules.some((r) => r.row === 'T59'), false);
ok('T69 exists', !!rules.find((r) => r.row === 'T69'), true);
ok('T70 exists', !!rules.find((r) => r.row === 'T70'), true);
ok('T71 exists', !!rules.find((r) => r.row === 'T71'), true);
ok('T7 and T52 back (L-1)', ['T7', 'T52'].map((x) => rules.some((r) => r.row === x)), [true, true]);

// one rule per id (the lock-s1s2 and lock-s3 branches both added a T69: agreement reminders keep it, T71 is the withdrawal)
const ids = rules.map((r) => r.row);
ok('every rule id unique', ids.filter((x, i) => ids.indexOf(x) !== i), []);
ok('T69 is the RP agreement rule', [rules.find((r) => r.row === 'T69')?.record, rules.find((r) => r.row === 'T69')?.name], ['RP', 'Agreement not signed']);
ok('T70 is the university to activate', rules.find((r) => r.row === 'T70')?.record, 'University');
ok('T71 is the application withdrawal task', [rules.find((r) => r.row === 'T71')?.record, rules.find((r) => r.row === 'T71')?.task], ['Application', 'Tell <university> that <student> withdrew']);
// every application task logic has its rule (no derived task without a rule), and no withdrawal logic left on T69
ok('every APP_LOGIC entry has a rule', Object.keys(W.APP_LOGIC).filter((k) => !ids.includes(k)), []);
ok('no application logic on T69', 'T69' in W.APP_LOGIC, false);

// S3C-9: T71 only for a close after submission
const L = W.APP_LOGIC.T71;
const closedApp = (submitted) => ({ status: 'closed', end: { kind: 'closed', reason: 'x', stage: 2, at: now, submitted }, uni: 'Uni One' });
ok('T71 closed after submission: task', L.when(closedApp(true), {}), true);
ok('T71 closed before submission: none', L.when(closedApp(false), {}), false);
ok('T71 older close without the record: none', L.when({ status: 'closed', end: { kind: 'closed', reason: 'x', stage: 2, at: now } }, {}), false);
ok('T71 open application: none', L.when({ status: 'lodged' }, {}), false);
ok('T71 marked for closed applications', L.closed, true);

// L-5: reminders at 3 and 7 working days, the task after 10
ok('sent today: no reminder', W.agreementReminders(sent(0), rules, now).length, 0);
ok('sent 1 day ago: no reminder', W.agreementReminders(sent(1), rules, now).length, 0);
ok('sent 6 calendar days ago: one reminder', W.agreementReminders(sent(6), rules, now).length, 1);
ok('sent 20 calendar days ago: two reminders', W.agreementReminders(sent(20), rules, now).length, 2);
ok('sent 6 days ago: no T69 task yet', W.rpTasks(s, [sent(6)], now).filter((t) => t.rule === 'T69').length, 0);
ok('sent 20 days ago: one T69 task, RP Ops', W.rpTasks(s, [sent(20)], now).filter((t) => t.rule === 'T69').map((t) => t.queue), ['q-rp-ops']);
const signed = sent(20);
signed.agreements[0].status = 'Signed copy uploaded';
ok('signed copy in: no reminders', W.agreementReminders(signed, rules, now).length, 0);
ok('signed copy in: no T69', W.rpTasks(s, [signed], now).filter((t) => t.rule === 'T69').length, 0);
ok('no agreement: nothing', [W.agreementReminders({ ...sent(20), agreements: [] }, rules, now).length, W.rpTasks(s, [{ ...sent(20), agreements: [] }], now).length], [0, 0]);
const off = rules.map((r) => (r.row === 'T69' ? { ...r, on: false, offAt: now - 30 * DAY } : r));
ok('T69 off: no reminders', W.agreementReminders(sent(20), off, now).length, 0);
ok('T69 off: no task', W.rpTasks({ ...s, rules: off }, [sent(20)], now).filter((t) => t.rule === 'T69').length, 0);
const edited = rules.map((r) => (r.row === 'T69' ? { ...r, remind2: null } : r));
ok('second reminder cleared in Task rules: one', W.agreementReminders(sent(20), edited, now).length, 1);

// S2C-19: reopened partner, a task per university not Live
const ip = { id: 'ip-x', name: 'Partner X', status: 'Agreement executed', reopenedAt: now - DAY };
const unis = [{ id: 'u1', name: 'Uni One', ip: 'ip-x', status: 'Ended' }, { id: 'u2', name: 'Uni Two', ip: 'ip-x', status: 'Live' }, { id: 'u3', name: 'Uni Three', ip: 'ip-y', status: 'Ended' }];
ok('reopened: one T70 for the Ended university', W.ipTasks(s, [ip], unis, now).map((t) => [t.record, t.queue]), [['u1', 'q-inst-ops']]);
ok('never reopened: none', W.ipTasks(s, [{ ...ip, reopenedAt: undefined }], unis, now).length, 0);
ok('closed again: none', W.ipTasks(s, [{ ...ip, status: 'Terminated by GSP' }], unis, now).length, 0);
ok('university Live again: none', W.ipTasks(s, [ip], unis.map((u) => ({ ...u, status: 'Live' })), now).length, 0);

// S1C-13: an unmapped nationality gives T62; mapped ones give nothing
ok('mapped nationality: no T62', W.nationalityTasks(s, [{ nationality: 'India', added: now }], now).length, 0);
ok('unmapped nationality: one T62', W.nationalityTasks(s, [{ nationality: 'Mongolia', added: now }, { nationality: 'Mongolia', added: now }], now).map((t) => t.title), ['Map Mongolia to a sales region']);
ok('non-EU Europe mapped (S1C-6)', W.nationalityTasks(s, [{ nationality: 'United Kingdom' }, { nationality: 'Switzerland' }, { nationality: 'Norway' }], now).length, 0);

// Goes to (5 Nov): every kind has one, valid for its record; no rule carries a queue; a new Goes to reaches new tasks only
ok('every kind has a valid Goes to', W.KINDS.filter((k) => !W.R.goesToValid(s, k, k.goesTo)).map((k) => k.id), []);
ok('no rule has a queue of its own', W.RULES.filter((r) => 'queue' in r).map((r) => r.row), []);
ok('no queue stores what it receives', W.QUEUES.filter((q) => 'kinds' in q).map((q) => q.id), []);
ok('routed Goes to only for its record', [W.R.goesToValid(s, { record: 'RP' }, 'region'), W.R.goesToValid(s, { record: 'Application' }, 'recruitment'), W.R.goesToValid(s, { record: 'RP' }, 'recruitment')], [false, false, true]);
const moved = { ...s, kinds: s.kinds.map((k) => (k.id === rules.find((r) => r.row === 'T69').kind ? { ...k, goesTo: 'q-admin' } : k)) };
ok('kind goes to Admin: a new T69 task goes there', W.rpTasks(moved, [sent(20)], now).filter((t) => t.rule === 'T69').map((t) => t.queue), ['q-admin']);
const t69 = W.rpTasks(s, [sent(20)], now).find((t) => t.rule === 'T69');
ok('kind goes to Admin: the open T69 task keeps RP Ops', W.rpTasks({ ...moved, routed: { [t69.id]: t69.goesTo } }, [sent(20)], now).filter((t) => t.rule === 'T69').map((t) => t.queue), ['q-rp-ops']);
ok('the queue sheet lists what lands in RP Ops', W.R.receivesOf(s, s.queues.find((q) => q.id === 'q-rp-ops')).direct.map((k) => k.id).sort(), s.kinds.filter((k) => k.goesTo === 'q-rp-ops').map((k) => k.id).sort());
console.log(`\n${pass} checks pass, ${fail} fail`);
if (fail) process.exit(1);
