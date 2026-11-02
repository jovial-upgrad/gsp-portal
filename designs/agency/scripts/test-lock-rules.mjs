// The work rules added by Jovial's lock answers (2 Nov): T69's agreement reminders and task (L-5), T70's university
// tasks after a partner is reopened (S2C-19), T62's nationality tasks (S1C-13), and that T43 and T59 are gone. Every
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
  stdin: { contents: "export * from './src/work/rpRules.ts'; export { RULES } from './src/work/seed.ts';", resolveDir: path.join(here, '..'), loader: 'ts' },
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
const s = { rules, closed: {}, frozen: {}, queues: [] };
const now = Date.parse('2026-11-02T12:00:00+05:30');
const sent = (daysAgo) => ({ id: 'rp-x', name: 'Sample agency', country: 'India', status: 'Agreement sent', agreements: [{ id: 'v1', version: 'v1', file: 'a.pdf', size: 1, uploadedAt: now - daysAgo * DAY, uploadedBy: 'RP Ops', sentAt: now - daysAgo * DAY, status: 'Sent' }], activity: [] });

ok('T43 removed', rules.some((r) => r.row === 'T43'), false);
ok('T59 removed', rules.some((r) => r.row === 'T59'), false);
ok('T69 exists', !!rules.find((r) => r.row === 'T69'), true);
ok('T70 exists', !!rules.find((r) => r.row === 'T70'), true);

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

console.log(`\n${pass} checks pass, ${fail} fail`);
if (fail) process.exit(1);
