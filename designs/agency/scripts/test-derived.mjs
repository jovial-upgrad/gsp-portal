// Nothing derived without a rule (Jovial, 2 Nov: nothing hard-coded). Loads the work store, Finance and the bell
// the way the portal does, then checks that every task, notification, email log entry, log line, Activity line and
// commission line was produced by a rule from a seeded record, and that none exists once the rules are gone:
//   - no seeded tasks or records in the work store; the logs start empty
//   - every task names a rule that exists and has trigger logic (engine.ts, rpRules.ts, recordRules.ts)
//   - switching one rule off (from before its conditions started) removes exactly its tasks; no rules, no tasks,
//     no work notifications, no task emails
//   - every email log entry uses a template and points at a record or person that exists
//   - every bell notification about an application points at a real application and one of its events
//   - every commission line has the engine's working (trace) and an application Finance knows
//   - the testing aids (a failed job, a bouncing address) raise T65 and T66 through their rules, and clearing them
//     takes the tasks away
// Exits 1 on any failure.   node scripts/test-derived.mjs   (from designs/agency)
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.__glob = () => ({});
// one fixed clock for the whole run: a rule's wait running out between two checks (T9b at 12 working hours) must not
// look like a task no rule produced (flaky in the evening, 3 Nov)
const FROZEN = Date.now();
Date.now = () => FROZEN;
globalThis.window = { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, location: { search: '', hash: '' } };
globalThis.document = { addEventListener() {}, removeEventListener() {} };
const out = await build({
  stdin: {
    contents: [
      "export * as F from './src/finance/store.ts';",
      "export * as W from './src/work/store.ts';",
      "export * as C from './src/work/clock.ts';",
      "export { RULES } from './src/work/seed.ts';",
      "export * as SEED from './src/work/seed.ts';",
      "export { APP_LOGIC } from './src/work/engine.ts';",
      "export { RP_LOGIC } from './src/work/rpRules.ts';",
      "export { RECORD_LOGIC } from './src/work/recordRules.ts';",
      "export { emailLog } from './src/work/emailLog.ts';",
      "export { EMAIL_TEMPLATES } from './src/work/mail.ts';",
      "export { sampleLog } from './src/admin/data/config.ts';",
      "export { adminCfg } from './src/admin/data/store.ts';",
      "export { compute } from './src/finance/engine.ts';",
      "export { notesFor } from './src/data/inbox.ts';",
      "export { sampleApplications } from './src/data/applications.ts';",
      "export { sampleStudents } from './src/data/students.ts';",
      "export { docsFor, STATUS, PROOF_STATUSES } from './src/data/applications.ts';",
      "export { COURSES } from './src/data/courses.ts';",
    ].join('\n'),
    resolveDir: root, loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', jsx: 'automatic', resolveExtensions: ['.ts', '.tsx', '.js', '.json'],
  define: { 'import.meta.glob': 'globalThis.__glob', 'import.meta.env.MODE': '"test"' },
  loader: { '.webp': 'empty', '.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.css': 'empty' },
});
const dir = path.join(root, 'node_modules', '.cache');
mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'test-derived.mjs');
writeFileSync(file, out.outputFiles[0].text);
const M = await import(pathToFileURL(file).href);
const { W, F, C } = M;
const tick = () => new Promise((r) => setTimeout(r, 20));
let pass = 0, fail = 0;
const ok = (what, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
await tick();

/* ---------- nothing seeded ---------- */
ok('the seed has no tasks', !('TASKS' in M.SEED));
ok('the seed has no records', !('RECORDS' in M.SEED));
ok('Admin’s log starts empty', M.sampleLog().length === 0);
W.resetAll();
await tick();
let s = W.getState();
ok('the work log starts empty', s.log.filter((l) => !String(l.event || '').startsWith('application.officer')).length === 0, JSON.stringify(s.log.slice(0, 2)));
ok('every task is a rule’s (auto)', s.tasks.every((t) => t.auto === true), s.tasks.filter((t) => !t.auto).map((t) => t.id).join(', '));
ok('the data set seeds no history or Activity', !JSON.parse(readFileSync(path.join(root, 'src/data/dataset.json'), 'utf8')).apps.some((a) => 'history' in a || 'activity' in a || 'tasks' in a));

/* ---------- every task has a rule with trigger logic ---------- */
const LOGIC = new Set([...Object.keys(M.APP_LOGIC), ...Object.keys(M.RP_LOGIC), ...Object.keys(M.RECORD_LOGIC), 'T62', 'T70', 'T66']);
const rows = new Set(M.RULES.map((r) => r.row));
const noRule = s.tasks.filter((t) => !rows.has(t.rule));
ok('every task names a rule that exists', noRule.length === 0, noRule.map((t) => `${t.id} (${t.rule})`).join(', '));
const noLogic = s.tasks.filter((t) => !LOGIC.has(t.rule));
ok('every task’s rule has trigger logic', noLogic.length === 0, noLogic.map((t) => t.rule).join(', '));
ok('every RECORD_LOGIC key is a rule', Object.keys(M.RECORD_LOGIC).every((k) => rows.has(k)), Object.keys(M.RECORD_LOGIC).filter((k) => !rows.has(k)).join(', '));
ok('every task id carries its rule', s.tasks.every((t) => t.id.includes(`-${t.rule}-`) || t.id.endsWith(`-${t.rule}`)), s.tasks.filter((t) => !t.id.includes(t.rule)).map((t) => t.id).join(', '));
ok('rules make tasks in the seed', s.tasks.length > 0);
const byRule = {};
for (const t of s.tasks) byRule[t.rule] = (byRule[t.rule] || 0) + 1;

/* ---------- each rule off: exactly its tasks go ---------- */
const before = { ...byRule };
for (const row of Object.keys(before)) {
  W.update((d) => { const r = d.rules.find((x) => x.row === row); r.on = false; r.offAt = 0; });
  await tick();
  const n = W.getState().tasks.filter((t) => t.rule === row).length;
  const others = W.getState().tasks.filter((t) => t.rule !== row).length;
  ok(`${row} off: its ${before[row]} tasks go`, n === 0, `${n} left`);
  ok(`${row} off: the other rules’ tasks stay`, others === s.tasks.length - before[row], `${others} vs ${s.tasks.length - before[row]}`);
  W.update((d) => { const r = d.rules.find((x) => x.row === row); r.on = true; delete r.offAt; });
}

/* ---------- no rules: nothing derived ---------- */
W.update((d) => { d.rules = []; });
await tick();
const bare = W.getState();
ok('no rules: no tasks', bare.tasks.length === 0, String(bare.tasks.length));
ok('no rules: no work notifications', bare.users.every((u) => W.workNotes(bare, u.id).length === 0));
const TASK_TPL = new Set(['E13', 'E17', 'E19', 'E20', 'E21', 'E22']);
ok('no rules: no task emails', M.emailLog(bare).every((m) => !TASK_TPL.has(m.tpl)), M.emailLog(bare).filter((m) => TASK_TPL.has(m.tpl)).map((m) => m.tpl).join(', '));
W.resetAll();
await tick();
s = W.getState();

/* ---------- Goes to (5 Nov): a task's queue is its kind of work's; a change reaches new tasks only ---------- */
{
  await tick();
  const st = W.getState();
  const named = st.tasks.filter((t) => t.auto && st.queues.some((q) => q.id === st.kinds.find((k) => k.id === t.kind)?.goesTo));
  ok('each task is in its kind’s queue', named.length > 0 && named.every((t) => t.queue === st.kinds.find((k) => k.id === t.kind).goesTo), named.filter((t) => t.queue !== st.kinds.find((k) => k.id === t.kind).goesTo).map((t) => t.id).slice(0, 3).join(', '));
  const t0 = named[0], k0 = st.kinds.find((k) => k.id === t0.kind);
  const other = st.queues.find((q) => q.id !== k0.goesTo && q.leader);
  W.saveKind({ ...k0, goesTo: other.id }, 'Test');
  await tick();
  const after = W.getState();
  ok('a new Goes to leaves open tasks where they are', after.tasks.find((t) => t.id === t0.id)?.queue === k0.goesTo);
  ok('a new Goes to is logged', after.log.some((l) => l.event === 'kind.goes_to' && l.text.includes('→')));
  ok('a queue a kind goes to can’t be deleted', (W.removeQueue(other.id, 'Test').refused || []).some((k) => k.id === k0.id) && !!after.queues.find((q) => q.id === other.id));
  W.resetAll();
  await tick();
  s = W.getState();
}

/* ---------- email log ---------- */
const tpls = new Set(M.EMAIL_TEMPLATES.map((e) => e.id));
const log = M.emailLog(s);
ok('the email log has entries', log.length > 0);
ok('every email uses a template', log.every((m) => tpls.has(m.tpl)), log.filter((m) => !tpls.has(m.tpl)).map((m) => m.tpl).join(', '));
ok('every email’s record exists', log.every((m) => !m.record || s.records.some((r) => r.id === m.record)), log.filter((m) => m.record && !s.records.some((r) => r.id === m.record)).map((m) => `${m.tpl}:${m.record}`).slice(0, 5).join(', '));
ok('every email to a person names a user', log.every((m) => !m.toId || s.users.some((u) => u.id === m.toId)));
ok('every email delivered (no simulation yet)', log.every((m) => m.result === 'Delivered'));

// E23 (4 Nov): one per RP upload against a GSP request, to the application's officer, and nothing else
const e23 = log.filter((m) => m.tpl === 'E23');
const uploads = s.records.filter((r) => r.type === 'Application' && !r.closed && r.officer).reduce((n, r) => n + (r.uploads || []).filter((u) => u.at <= Date.now()).length, 0);
ok('E23: one email per upload against a request', e23.length === uploads && uploads > 0, `${e23.length} emails, ${uploads} uploads`);
ok('E23: each to the application’s officer', e23.every((m) => s.records.find((r) => r.id === m.record)?.officer === m.toId));

/* ---------- payment proof statuses (4 Nov) ---------- */
ok('T15 for Tuition paid and Deposit paid, payment proof pending', M.PROOF_STATUSES.length === 2 && M.PROOF_STATUSES.every((k) => M.APP_LOGIC.T15.when({ status: k })), M.PROOF_STATUSES.join(', '));
ok('the payment proof statuses read as agreed', M.STATUS.payreview.text() === 'Tuition paid, payment proof pending' && M.STATUS.depreview.text() === 'Deposit paid, payment proof pending');

/* ---------- document rules (4 Nov): CV for postgraduate, SOP for UK postgraduate, Class 10 by where the student lives ---------- */
const stu = M.sampleStudents('')[0];
const course = (lv, country) => M.COURSES.find((c) => c.level === lv && c.uni.country === country);
const keys = (st, c) => (c ? M.docsFor(st, c).map((d) => `${d.key}:${d.need}`) : null);
const pgUk = course('Master’s degree', 'UK'), ugUk = course('Bachelor’s degree', 'UK'), pgAu = course('Master’s degree', 'Australia');
ok('a UK master’s asks for the CV and the SOP', !!pgUk && keys(stu, pgUk).some((k) => k.startsWith('cv:required')) && keys(stu, pgUk).some((k) => k.startsWith('sop:required')), String(keys(stu, pgUk)));
ok('an Australian master’s asks for the CV, not the SOP', !!pgAu && keys(stu, pgAu).some((k) => k.startsWith('cv:')) && !keys(stu, pgAu).some((k) => k.startsWith('sop:')), String(keys(stu, pgAu)));
ok('a UK bachelor’s asks for no SOP or CV', !!ugUk && !keys(stu, ugUk).some((k) => k.startsWith('sop:') || k.startsWith('cv:')), String(keys(stu, ugUk)));
ok('a UK bachelor’s: Class 10 optional for a student in India', !!ugUk && keys({ ...stu, country: 'India' }, ugUk).includes('edu-g10:optional'), String(keys({ ...stu, country: 'India' }, ugUk)));
ok('a UK bachelor’s: no Class 10 for a student in Vietnam', !!ugUk && !keys({ ...stu, country: 'Vietnam' }, ugUk).some((k) => k.startsWith('edu-g10')), String(keys({ ...stu, country: 'Vietnam' }, ugUk)));

/* ---------- the bell ---------- */
const apps = M.sampleApplications();
const notes = M.notesFor('gsp', { access: 'all', agency: '', apps, students: M.sampleStudents(''), me: 'u-ramish-jafery', meName: 'Ramish Jafery', work: W.workNotes(s, 'u-ramish-jafery') });
ok('the bell has notifications', notes.length > 0);
const appNotes = notes.filter((n) => n.to && 'app' in n.to);
ok('every application notification is about a real application', appNotes.every((n) => apps.some((a) => a.id === n.to.app)));
const workIds = new Set(s.tasks.map((t) => t.id));
const work = W.workNotes(s, 'u-ramish-jafery');
ok('every work notification is about one of the person’s tasks', work.every((n) => [...workIds].some((id) => n.id.includes(id))), work.filter((n) => ![...workIds].some((id) => n.id.includes(id))).map((n) => n.id).join(', '));

/* ---------- commission lines ---------- */
const fs = F.getState();
const res = M.compute(fs.comm.cfg, fs.comm.apps, fs.comm.today);
ok('commission lines exist', res.ip.length > 0 && res.rp.length > 0);
ok('every university line has the engine’s working', res.ip.every((x) => x.l.trace?.length > 0));
ok('every university line is for an application Finance knows', res.ip.every((x) => fs.comm.apps[x.app]));
ok('every RP line is for an application Finance knows', res.rp.every((x) => fs.comm.apps[x.app] || fs.comm.apps[x.app?.id]));

/* ---------- testing aids go through the rules ---------- */
W.simulateJobFailure('J3', 1);
await tick();
s = W.getState();
ok('a failed J3 run raises T65', s.tasks.some((t) => t.rule === 'T65' && t.title.includes('J3')));
W.clearSimulations();
await tick();
ok('clearing it, T65 goes', !W.getState().tasks.some((t) => t.rule === 'T65'));
C.setClockOffset(4 * 864e5);
W.simulateBounces('u-ramish-jafery');
await tick();
s = W.getState();
ok('a bouncing address raises T66 once 3 emails bounce', s.tasks.some((t) => t.rule === 'T66'));
ok('the bounced emails show as Bounced in the log', M.emailLog(s).some((m) => m.result === 'Bounced'));
W.clearSimulations();
await tick();
ok('clearing it, T66 goes', !W.getState().tasks.some((t) => t.rule === 'T66'));
ok('date rules: T50 on the Friday with no rates for next week', W.getState().tasks.some((t) => t.rule === 'T50'));
C.setClockOffset(0);

console.log(`\n${Object.keys(byRule).length} rules made ${Object.values(byRule).reduce((a, b) => a + b, 0)} tasks: ${Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`${pass} checks pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
