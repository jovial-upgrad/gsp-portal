// Commissions (Jovial, 9 Nov): the engine works out every line from the seeded records only. Loads the prototype's
// modules with Vite (no browser), runs the engine over the seeded records on a fixed day, and checks the rules the
// PRD's Commissions tab sets.
//   cd designs/agency && npm run test:commissions
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
let pass = 0, fail = 0;
const ok = (name, cond, more = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond || !more ? '' : `: ${more}`}`); };
try {
  const model = await vite.ssrLoadModule('/src/finance/commission/model.ts');
  const engine = await vite.ssrLoadModule('/src/finance/commission/engine.ts');
  const seed = await vite.ssrLoadModule('/src/finance/commission/seed.ts');
  const store = await vite.ssrLoadModule('/src/finance/commission/store.ts');
  const lines = await vite.ssrLoadModule('/src/finance/commission/lines.ts');
  const appsMod = await vite.ssrLoadModule('/src/data/applications.ts');
  const studentsMod = await vite.ssrLoadModule('/src/data/students.ts');
  const TODAY = '2026-11-09';
  const extra = store.enrolmentsOf(appsMod.sampleApplications(), studentsMod.sampleStudents(''));
  // as the portal keeps it: every line given its ID, and lines acted on kept as they were
  const state = engine.settleAll(seed.sampleComm(), store.ctxOf(TODAY), extra);
  const res = engine.compute(state, store.ctxOf(TODAY), extra);
  const uni = res.txs.filter((t) => t.side === 'uni');
  const rp = res.txs.filter((t) => t.side === 'rp');
  console.log(`${res.apps.length} enrolled applications, ${uni.length} University → GSP and ${rp.length} GSP → RP lines`);
  ok('there are lines on both sides', uni.length > 0 && rp.length > 0);
  ok('the prototype’s own enrolled applications are read', extra.length === 3 && extra.every((e) => res.byApp.has(e.app)), extra.map((e) => e.app).join());

  // every RP line has a matching university line, or comes from a notice
  const orphan = rp.filter((t) => (t.matches ? !res.byId.has(t.matches) : !t.notice && !t.key.includes('|rp|ab:')));
  ok('every RP line has a matching university line, or is a notice’s or its agreement’s bonus', orphan.length === 0, orphan.map((t) => t.id).join());
  const wrongApp = rp.filter((t) => t.matches && res.byId.get(t.matches).app !== t.app);
  ok('a matching university line is on the same application', wrongApp.length === 0, wrongApp.map((t) => t.id).join());

  // an RP line isn't Ready to invoice (or later) before GSP has its university line's money (Paid, or Part paid: Q44)
  const LATER = ['Ready to request', 'Invoice requested', 'Invoice in review', 'Approved', 'Sent back', 'Paid'];
  const firstUni = (t) => res.byApp.get(t.app).uniItem.txs.find((x) => x.type === 'Course commission') ?? res.byApp.get(t.app).uniItem.txs[0];
  const early = rp.filter((t) => LATER.includes(t.status) && !['Paid', 'Part paid'].includes(t.matches ? res.byId.get(t.matches).status : firstUni(t)?.status));
  ok('no RP line is Ready to invoice before its university line is paid', early.length === 0, early.map((t) => `${t.id} ${t.status}`).join());
  // and once the university line is paid, the RP line moves on (unless held or paid)
  const stuck = rp.filter((t) => t.matches && res.byId.get(t.matches).status === 'Paid' && t.status === 'Expected');
  ok('an RP line whose university line is Paid is no longer Expected', stuck.length === 0, stuck.map((t) => t.id).join());

  // status groups cover every status, once each
  for (const side of model.SIDE_KEYS) {
    const all = model.STATUSES_OF[side];
    const grouped = model.GROUPS.flatMap((g) => g[side]);
    ok(`${side}: every status is in one status group`, all.every((s) => grouped.filter((x) => x === s).length === 1) && grouped.every((s) => all.includes(s)), all.filter((s) => !grouped.includes(s)).join());
  }
  const ungrouped = res.txs.filter((t) => !model.groupOf(t.side, t.status));
  ok('every line’s status is in a group', ungrouped.length === 0);

  // notice RPs only get notice bonuses
  const noticed = rp.filter((t) => t.notice);
  ok('the seed has notice bonuses', noticed.length > 0);
  // who a notice is for (10 Nov): its listed RPs, or (none listed) every RP in its sales regions; and only benefits that pay their own line
  const pricing = await vite.ssrLoadModule('/src/finance/commission/pricing.ts');
  const regionOf = new Map(store.ctxRps().map((r) => [r.id, r.region]));
  const forRp = (n, rpId) => (n.rps.length ? n.rps.includes(rpId) || (n.removed ?? []).some((x) => x.rp === rpId) : (n.regions ?? []).some((g) => g === regionOf.get(rpId) || pricing.regionCovers(state.settings, g, regionOf.get(rpId))));
  const OWN_LINE = ['Bonus per enrolment', 'Share plus amount per enrolment', 'Milestone', '% of tuition'];
  const strays = noticed.filter((t) => {
    const n = state.notices.find((x) => x.id === t.notice);
    return !n || !forRp(n, t.rp) || !OWN_LINE.includes(n.benefit);
  });
  ok('only a notice’s RPs get its bonus', strays.length === 0, strays.map((t) => `${t.id} ${t.rpName}`).join());
  const missing = rp.filter((t) => t.notice && !forRp(state.notices.find((n) => n.id === t.notice), t.rp));
  ok('no RP outside a notice gets its bonus', missing.length === 0);
  ok('a region-wide notice reaches an RP in its region', noticed.some((t) => !state.notices.find((n) => n.id === t.notice).rps.length));

  // amounts stay in the university's currency (an RP's own bonuses, from a notice or its agreement, in theirs)
  const cur = res.txs.filter((t) => !(t.side === 'rp' && t.type === 'Bonus') && t.currency !== store.uniCurrency(t.uni));
  ok('every line is in its university’s currency', cur.length === 0, cur.map((t) => t.id).join());

  // a withdrawn student's later study periods are Not payable on both sides
  const gone = res.apps.filter((a) => a.withdrawn);
  ok('withdrawn applications make later periods Not payable', gone.length > 0 && gone.every((a) => a.uniItem.txs.filter((t) => t.trigger > a.withdrawn).every((t) => t.status === 'Not payable') && a.rpItem.txs.filter((t) => t.trigger > a.withdrawn).every((t) => t.status === 'Not payable')));

  // nothing derived is in the seed: no lines, statuses or amounts written by hand
  const seededKeys = Object.keys(state);
  ok('the seed holds records only (no lines, items or statuses)', !seededKeys.some((k) => /^(txs|lines|items|transactions|statuses)$/.test(k)));
  const ids = new Set(res.txs.map((t) => t.id));
  const actions = [...state.invoices, ...state.receipts, ...state.requests, ...state.rpInvoices, ...state.rpPayments].flatMap((a) => a.txs).concat(state.overrides.map((o) => o.tx));
  const dangling = actions.filter((t) => !ids.has(t));
  ok('every seeded action names a line the engine made', dangling.length === 0, [...new Set(dangling)].join());
  ok('the same records give the same lines', JSON.stringify(engine.compute(state, store.ctxOf(TODAY), extra).txs) === JSON.stringify(res.txs));
  ok('every status on the page is one the module lists', res.txs.every((t) => model.STATUSES_OF[t.side].includes(t.status)));

  // the export respects the filters
  const views = [
    lines.blankView('uni'),
    { ...lines.blankView('rp'), tab: 'progress' },
    { ...lines.blankView('uni'), who: ['coventry'], from: '2026-01-01', to: '2026-12-31' },
    { ...lines.blankView('rp'), types: ['Bonus'] },
    { ...lines.blankView('rp'), q: 'Simran' },
    { ...lines.blankView('uni'), statuses: ['Overdue'], regions: ['Vietnam'] },
  ];
  for (const v of views) {
    const shown = lines.filterLines(res.txs, v);
    const csv = lines.csvRows(shown);
    const okRows = csv.length === shown.length + 1 && csv.slice(1).every((r, i) => r[0] === shown[i].id);
    const allMatch = shown.every((t) => t.side === v.side && (v.tab === 'all' || model.groupOf(t.side, t.status) === v.tab) && (!v.from || t.due >= v.from) && (!v.to || t.due <= v.to) && (!v.types.length || v.types.includes(t.type)) && (!v.statuses.length || v.statuses.includes(t.status)) && (!v.who.length || v.who.includes(v.side === 'uni' ? t.uni : t.rp)));
    const none = res.txs.filter((t) => !shown.includes(t)).every((t) => lines.filterLines([t], v).length === 0);
    ok(`export respects the view: ${lines.viewText(v, (x) => x)}`, okRows && allMatch && none, `${shown.length} shown, ${csv.length - 1} exported`);
  }
  ok('a filtered export is smaller than the whole list', lines.filterLines(res.txs, views[2]).length < lines.filterLines(res.txs, views[0]).length);

  // tasks T80 and T81 come from the records, and closing them is saving the record
  const without = engine.rpsWithoutRecord(state, store.acceptedRps());
  ok('some accepted RPs have no record yet (T80)', without.length > 0, without.map((r) => r.name).join());
  const noTerms = engine.unisWithoutTerms(state, store.ctxUnis());
  ok('some universities have no terms yet (T81)', noTerms.length > 0, noTerms.map((u) => u.name).join());
  // hard-coded scan: the pages take statuses, types and options from the model, never their own lists
  const dir = `${root}src/finance/commission/`;
  const pages = readdirSync(dir).filter((f) => f.endsWith('.tsx'));
  const statusWords = [...new Set([...model.UNI_STATUSES, ...model.RP_STATUSES])];
  const hard = pages.flatMap((f) => {
    const src = readFileSync(dir + f, 'utf8');
    const hits = [];
    statusWords.forEach((w) => new RegExp(`status\\s*[!=]==?\\s*'${w}'`).test(src) && hits.push(`${f}: compares a line's status to '${w}'`));
    if (/<option[^>]*>\s*[^<{\s]/.test(src)) hits.push(`${f}: an option written by hand`);
    statusWords.forEach((w) => new RegExp(`(includes|all)\\(\\[?'${w}'`).test(src) && hits.push(`${f}: '${w}' in a list`));
    return hits;
  });
  ok('hard-coded scan: no status lists or options written in the pages', hard.length === 0, hard.join('; '));
  // the statuses seen in the seed, for a look
  const tally = {};
  res.txs.forEach((t) => (tally[`${t.side} ${t.status}`] = (tally[`${t.side} ${t.status}`] ?? 0) + 1));
  console.log(Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join('; '));
} finally {
  await vite.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
