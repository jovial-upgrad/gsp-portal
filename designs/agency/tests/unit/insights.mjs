// Dashboards, round 1 (Jovial, 18 Nov): the reporting records, the metrics worked out from them, targets and the queue hierarchy
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
let pass = 0, fail = 0;
const ok = (name, cond, more = '') => (cond ? pass++ : (fail++, console.log('FAIL', name, more)));
try {
  const data = await vite.ssrLoadModule('/src/insights/data.ts');
  const m = await vite.ssrLoadModule('/src/insights/metrics.ts');
  const t = await vite.ssrLoadModule('/src/insights/targets.ts');
  const d = data.sampleReporting();
  const d2 = data.sampleReporting();
  const s = m.sampleInsightSettings();
  ok('the reporting set is seeded and repeatable', d.apps.length === d2.apps.length && d.apps[5].id === d2.apps[5].id && d.apps[5].created === d2.apps[5].created);
  ok('every application\'s status changes are in time order', d.apps.every((a) => a.moves.every((x, i) => !i || x.at >= a.moves[i - 1].at)));
  ok('a closed application has a reason its stage allows', d.apps.filter((a) => a.end).every((a) => a.moves.at(-1).s === 'closed' && !!a.end.kind));
  ok('every application has an RP, a BDM and a region', d.apps.every((a) => a.rp && a.bdm && a.region));
  // the funnel never grows from one stage to the next
  const fun = m.funnel(d.apps, s.milestones);
  ok('the funnel only narrows', fun.every((x, i) => !i || x.n <= fun[i - 1].n), fun.map((x) => x.n).join());
  ok('the funnel counts every application received', fun[0].n === d.apps.length);
  // Ramish: per student, Safe + Drop + WIP = every student
  const st = m.studentStates(d.apps, s, 'startdate');
  ok('Safe + Drop + WIP = unique applicants', st.safe.length + st.drop.length + st.wip.length === st.students && st.students === new Set(d.apps.map((a) => a.student)).size);
  // a Drop setting change moves students between Drop and WIP, never Safe
  const noDefer = m.studentStates(d.apps, { ...s, dropKinds: s.dropKinds.filter((k) => k !== 'Deferred') }, 'startdate');
  ok('leaving Deferred out of Drop only moves students to WIP', noDefer.safe.length === st.safe.length && noDefer.drop.length + noDefer.wip.length === st.drop.length + st.wip.length);
  // filters: a regional manager sees only their own BDMs' applications
  const rms = m.regionalManagers(d.queues, d.users);
  const [rm, people] = [...rms.entries()][0];
  const mine = m.applyFilters(d, { ...m.noFilters(), rm: [rm] });
  ok('the regional manager filter keeps their BDMs only', mine.length > 0 && mine.every((a) => people.has(a.bdm)), rm);
  const live = m.applyFilters(d, { ...m.noFilters(), state: 'live' });
  ok('Live means not closed and not enrolled', live.every((a) => !a.end && a.moves.at(-1).s !== 'enrolled'));
  // ageing: every live application is in exactly one cell
  const now = new Date('2026-11-18T12:00:00').getTime();
  const age = m.ageing(d.apps, s, now);
  ok('every live application sits in one ageing cell', age.rows.reduce((n, r) => n + r.cells.reduce((k, c) => k + c.length, 0), 0) === age.live.filter((a) => m.milestoneOf(a, s.milestones).key !== 'enrolled').length);
  const wk = m.series(d.apps, (a) => a.created, 'week', now);
  ok('the weekly series counts every application once', wk.reduce((n, p) => n + p.apps.length, 0) === d.apps.length);
  // targets: the file is read by its headings, and bad lines say why
  const names = t.namesFor(d, ['Navitas']);
  const r = t.readTargets('Name,Level,Period,Enrolments,Deposits\nHarsh,BDM,OND 26,40,60\nNobody,BDM,OND 26,1,1\nIndia,Sales region,2027-13,5,5\nIndia,Sales region,Feb 2027,12,\nHarsh,BDM,OND 26,1,1\nUK,Destination,JFM\'27,x,1', names);
  const good = r.rows.filter((x) => x.row);
  ok('targets: good lines are read, in any column order', good.length === 2 && good[0].row.values.enrolled === 40 && good[0].row.values.deposit === 60 && good[0].row.months.join() === '2026-10,2026-11,2026-12');
  ok('targets: a month in words is read', good[1].row.period === '2027-02' && good[1].row.values.deposit === undefined);
  ok('targets: unknown names, bad periods, twice in the file and non-numbers are left out with a reason', r.rows.filter((x) => x.error).length === 4 && r.rows.every((x) => x.row || /No BDM|can’t be read|twice|isn’t a number/.test(x.error)));
  ok('targets: a file without Level, Name and Period is refused', !!t.readTargets('A,B\n1,2', names).error);
  const vs = t.sampleTargets(d, ['Navitas']);
  ok('one target version is current', vs.filter((v) => v.current).length === 1 && vs.every((v) => v.rows.length > 0));
  ok('a quarter target is found for its months', t.targetFor(vs.find((v) => v.current), 'BDM', 'Harsh', 'enrolled', ['2026-10', '2026-11', '2026-12']) === 34);
  // rounds 2–5: durations, forecast rates, financial year
  const lo = m.between(d.apps, 'lodged', 'conditions');
  ok('time between steps: median ≤ 90th percentile, from applications with both dates', lo.n > 0 && lo.median <= lo.p90);
  const rates = m.stageRates(d.apps, s, now);
  ok('conversion to enrolment never falls as an application moves on', s.milestones.every((x, i) => !i || rates.get(x.key) >= rates.get(s.milestones[i - 1].key) - 1e-9), [...rates.values()].map((x) => x.toFixed(2)).join());
  ok('an enrolled application converts at 100%', rates.get('enrolled') === 1);
  const fy = m.fyOf('2026-11', 4), fy2 = m.fyOf('2027-02', 4), fy3 = m.fyOf('2026-04', 4);
  ok('financial year April–March: Nov 26 is FY27 OND, Feb 27 FY27 JFM, Apr 26 FY27 AMJ', fy.fy === 'FY27' && fy.q === 'OND' && fy2.fy === 'FY27' && fy2.q === 'JFM' && fy3.fy === 'FY27' && fy3.q === 'AMJ');
  ok('the financial year has 12 months, April first', m.fyMonths(2027, 4).length === 12 && m.fyMonths(2027, 4)[0] === '2026-04' && m.fyMonths(2027, 4)[11] === '2027-03');
  ok('some applications are in assessment or interview now (Interview tracker)', d.apps.some((a) => !a.end && a.moves.at(-1).s === s.interviewStatus));
  ok('every rejection has a reason', d.apps.filter((a) => a.end && s.rejectKinds.includes(a.end.kind)).every((a) => !!a.end.reason));
  // hard-coded scan: no options written by hand, no milestone statuses compared in the pages
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../../src/insights/', import.meta.url);
  const hard = readdirSync(dir).filter((f) => f.endsWith('.tsx')).flatMap((f) => {
    const src = readFileSync(new URL(f, dir), 'utf8');
    const hits = [];
    if (/<option[^>]*>\s*[^<{\s]/.test(src)) hits.push(`${f}: an option written by hand`);
    if (/\.s\s*[!=]==?\s*'/.test(src) || /status\s*[!=]==?\s*'/.test(src)) hits.push(`${f}: compares a status by hand`);
    return hits;
  });
  ok('hard-coded scan: the dashboard pages take their lists and statuses from settings and records', hard.length === 0, hard.join('; '));
} finally {
  await vite.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
