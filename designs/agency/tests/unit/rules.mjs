// Task rules (Jovial, 9 Nov): every task in My work comes from a kept task rule. Loads the prototype's modules with
// Vite (no browser), runs the rules over the seeded records, and fails if any task exists that no rule produced, names
// a rule that isn't on the list, sits in another queue than its rule sends it to, or goes to someone outside it.
//   cd designs/agency && node tests/unit/rules.mjs
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
let pass = 0, fail = 0;
const ok = (name, cond, more = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond || !more ? '' : `: ${more}`}`); };
try {
  const { sampleCfg } = await vite.ssrLoadModule('/src/admin/config/ConfigPage.tsx');
  const mw = await vite.ssrLoadModule('/src/admin/data/mywork.ts');
  const KEPT = ['T5', 'T54', 'T16', 'T57', 'T20', 'T32', 'T69', 'T37', 'T38', 'T40', 'T41', 'T42', 'T27'];
  const cfg = sampleCfg();
  ok('the task rules are exactly the kept ones', cfg.taskRules.map((r) => r.code).join() === KEPT.join(), cfg.taskRules.map((r) => r.code).join());
  ok('no kinds of work, reminders or requests in the settings', !('kinds' in cfg) && !('ladder' in cfg) && !('requests' in cfg));
  const again = mw.runRules(cfg.taskRules, mw.sampleRecords(), cfg.queues, cfg.regions, cfg.users, cfg.calendars);
  const made = new Set(again.map((t) => t.id));
  const stray = cfg.tasks.filter((t) => !made.has(t.id));
  ok('every task was made by a rule (none written by hand)', stray.length === 0, stray.map((t) => t.title).join('; '));
  const off = cfg.tasks.filter((t) => !KEPT.includes(t.rule));
  ok('every task names a kept rule', off.length === 0, off.map((t) => t.rule).join());
  const wrongQ = cfg.tasks.filter((t) => {
    const r = cfg.taskRules.find((x) => x.code === t.rule);
    return mw.queueFor(r.to, t.region, cfg.queues, cfg.regions)?.id !== t.queue;
  });
  ok('every task is in the queue its rule sends it to', wrongQ.length === 0, wrongQ.map((t) => t.id).join());
  const outside = cfg.tasks.filter((t) => {
    const q = cfg.queues.find((x) => x.id === t.queue);
    return ![q.lead, ...q.members].map((id) => cfg.users.find((u) => u.id === id)?.name).includes(t.assignee);
  });
  ok('every assignee is in the task’s queue', outside.length === 0, outside.map((t) => `${t.id} ${t.assignee}`).join());
  const titles = cfg.tasks.filter((t) => /\{\w+\}/.test(t.title));
  ok('every title is its rule’s task, filled in', titles.length === 0, titles.map((t) => t.title).join('; '));
  for (const role of ['gsp', 'globalops', 'institution', 'instops', 'recruitment', 'rpops', 'finance']) {
    const d = await vite.ssrLoadModule(`/src/${role}/work/data.ts`);
    const fn = Object.keys(d).find((k) => /^sample\w+Tasks$/.test(k));
    const ts = d[fn]();
    const bad = ts.filter((t) => !KEPT.includes(t.rule) || !made.has(t.id));
    ok(`${role}: ${ts.length} tasks, each from a kept rule`, bad.length === 0, bad.map((t) => t.title).join('; '));
  }
  const fin = await vite.ssrLoadModule('/src/finance/work/data.ts');
  ok('Finance gets no tasks (no rule sends work to it)', fin.sampleIwTasks().length === 0);
} finally {
  await vite.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
