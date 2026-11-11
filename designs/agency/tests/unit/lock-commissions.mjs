// Jovial's 10 Nov answers (All pending questions), Commissions: effective-from terms by intake start (Q41), RP counts
// of payable students and the band tile (Q43), payment line by line with Part paid and write-off (Q44), reminders
// (Q47), the RP statuses (Q50), sent back and approved notifications (Q54), rounding (Q62), no tax ID (Q64), an RP
// taken off a notice keeps it for earlier enrolments (Q65), bonuses in the university's currency (Q67).
//   cd designs/agency && node tests/unit/lock-commissions.mjs
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
let pass = 0, fail = 0;
const ok = (name, cond, more = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond || !more ? '' : `: ${more}`}`); };
try {
  const engine = await vite.ssrLoadModule('/src/finance/commission/engine.ts');
  const model = await vite.ssrLoadModule('/src/finance/commission/model.ts');
  const seed = await vite.ssrLoadModule('/src/finance/commission/seed.ts');
  const store = await vite.ssrLoadModule('/src/finance/commission/store.ts');
  const appsMod = await vite.ssrLoadModule('/src/data/applications.ts');
  const studentsMod = await vite.ssrLoadModule('/src/data/students.ts');
  const TODAY = '2026-11-09';
  const ctx = store.ctxOf(TODAY);
  const extra = store.enrolmentsOf(appsMod.sampleApplications(), studentsMod.sampleStudents(''));
  const start = () => engine.settleAll(seed.sampleComm(), ctx, extra);
  const run = (s) => engine.compute(engine.settleAll(s, ctx, extra), ctx, extra);
  const s0 = start();
  const r0 = run(s0);

  // Q62: half up to the currency's smallest unit
  ok('Q62 rounds half up to cents', model.roundMoney(1.005, 'AUD') === 1.01 && model.roundMoney(2.345, 'GBP') === 2.35);
  ok('Q62 a credit rounds like the amount it takes back', model.roundMoney(-1.005, 'AUD') === -1.01);
  ok('Q62 a currency with no minor unit rounds to whole', model.roundMoney(2.5, 'JPY') === 3);
  ok('Q62 every line is rounded to its currency', r0.txs.every((t) => t.amount === model.roundMoney(t.amount, t.currency)));
  ok('Q62 rounding makes no 0.01 Adjustment lines', !r0.txs.some((t) => t.type === 'Adjustment' && Math.abs(t.amount) < 0.02), r0.txs.filter((t) => t.type === 'Adjustment').map((t) => `${t.id} ${t.amount}`).join());

  // Q50: only the agreed RP statuses
  const rpStatuses = new Set(r0.txs.filter((t) => t.side === 'rp').map((t) => t.status));
  ok('Q50 RP lines use only the agreed statuses', [...rpStatuses].every((x) => model.RP_STATUSES.includes(x)), [...rpStatuses].join());
  ok('Q50 the agreed list (with D24’s Overdue to pay)', model.RP_STATUSES.join() === 'Expected,Waiting for university,Ready to invoice,Invoice in review,Approved,Overdue to pay,On hold,Sent back,Paid,Not payable');
  const waitingOk = r0.txs.filter((t) => t.side === 'rp' && t.status === 'Waiting for university').every((t) => {
    const u = r0.byId.get(t.matches) ?? r0.byApp.get(t.app).uniItem.txs[0];
    return u && !['Expected', 'Paid', 'Part paid'].includes(u.status);
  });
  ok('Q50 Waiting for university: GSP’s line is due, not paid', waitingOk);

  // Q44: a line paid short is Part paid, the RP line is its share of what came in, and a write-off makes it Paid
  const u = r0.txs.find((t) => t.side === 'uni' && t.status === 'Ready to invoice' && t.type === 'Course commission' && r0.txs.some((x) => x.matches === t.id));
  const rpLine0 = r0.txs.find((x) => x.matches === u.id && x.key.endsWith(`m:${u.key.split('|')[2]}`));
  const half = model.roundMoney(u.amount / 2, u.currency);
  let s1 = { ...s0, invoices: [...s0.invoices, { number: 'T-1', uni: u.uni, date: '2026-11-01', txs: [u.id], by: 'Test', at: 1 }], receipts: [...s0.receipts, { id: 'rc-t', uni: u.uni, txs: [u.id], amount: half, paid: { [u.id]: half }, short: { [u.id]: 'Bank charges' }, date: '2026-11-05', by: 'Test', at: 2 }] };
  let r1 = run(s1);
  const u1 = r1.byId.get(u.id);
  ok('Q44 a line paid short is Part paid, with what came in and why', u1.status === 'Part paid' && u1.received === half && u1.short === 'Bank charges', `${u1.status} ${u1.received} ${u1.short}`);
  const rp1 = r1.byId.get(rpLine0.id);
  ok('Q44 its RP line is ready for its share of what came in', rp1.status === 'Ready to invoice' && Math.abs(rp1.amount - model.roundMoney((rpLine0.amount * half) / u.amount, u.currency)) <= 0.01, `${rp1.status} ${rp1.amount} of ${rpLine0.amount}`);
  const s2 = { ...s1, writeOffs: [{ id: 'wo', tx: u.id, amount: u.amount - half, reason: 'Bank charges', by: 'Test', at: 3 }] };
  const r2 = run(s2);
  ok('Q44 writing off the rest makes it Paid', r2.byId.get(u.id).status === 'Paid');
  ok('Q44 the RP stays at its share of what came in', Math.abs(r2.byId.get(rpLine0.id).amount - rp1.amount) <= 0.01);
  ok('Q44 the reasons are a seeded setting', s0.settings.partReasons.length >= 5 && s0.settings.partReasons.includes('Part payment'));

  // What the RP sees (Jovial, 11 Nov): by default the first study period only; a hidden line's request sends nothing
  {
    const later = r0.txs.find((t) => t.side === 'rp' && (t.period ?? 1) > 1);
    const first = r0.txs.find((t) => t.side === 'rp' && (t.period ?? 1) === 1 && t.type === 'Course commission');
    ok('View: by default the RP sees its first study period’s lines', !!first && first.rpSees === true, first ? `${first.id} ${first.rpSees}` : 'no line');
    ok('View: by default a later study period’s line is not shown to the RP', !!later && later.rpSees === false, later ? `${later.id} ${later.rpSees}` : 'no line');
    if (later) {
      const sh = { ...s0, requests: [...s0.requests, { id: 'rq-h', rp: later.rp, txs: [later.id], date: '2026-11-01', by: 'Test', at: 4 }] };
      const nh = engine.commNotes(sh, run(sh), (x) => x, TODAY);
      ok('View: asking for a hidden line’s invoice sends the RP nothing (no N16, no reminder)', !nh.some((n) => n.id === 'n16-rq-h' || n.id.startsWith('n21-rq-h')));
    }
    const rec = s0.records.find((r) => r.rp === first?.rp);
    const sv = { ...s0, records: s0.records.map((r) => (r === rec ? { ...r, view: { kinds: ['Additional commission'], periods: 'Every study period' } } : r)) };
    const rv = run(sv);
    ok('View: an RP’s own record can hide its course commission', rv.txs.filter((t) => t.side === 'rp' && t.rp === rec.rp && t.type === 'Course commission').every((t) => t.rpSees === false));
    ok('View: the default is a setting', Array.isArray(s0.settings.rpView.kinds) && model.RP_VIEW_PERIODS.includes(s0.settings.rpView.periods));
  }

  // R104 (Q101): what a course earns, from the university's terms and the RP's own terms, as the engine prices it
  {
    const est = await vite.ssrLoadModule('/src/finance/commission/estimate.ts');
    const courses = await vite.ssrLoadModule('/src/data/courses.ts');
    const rp0 = s0.records[0].rp;
    const withTerms = courses.COURSES.find((c) => s0.terms.some((t) => t.uni === c.uni.id && t.rates[c.level] != null && !(t.rateRows ?? []).length));
    const T = s0.terms.find((t) => t.uni === withTerms.uni.id);
    const g = est.estimateFor(s0, withTerms, null, TODAY);
    const fee = T.feeBasis === 'Tuition before scholarship' ? withTerms.tuition : withTerms.tuition - (withTerms.scholarship ?? 0);
    ok('R104 GSP’s view: the university’s rate on the fee', !!g && Math.abs(g.amount - Math.round((fee * T.rates[withTerms.level]) / 100 / 10) * 10) <= 10, g && `${g.amount}`);
    const r = est.estimateFor(s0, withTerms, rp0, TODAY);
    ok('R104 the RP’s view: its share of GSP’s amount, and the % of the fee', !!r && r.share > 0 && Math.abs(r.amount - Math.round((g.amount * r.share) / 100 / 10) * 10) <= 20 && r.pctOfFee > 0, r && `${r.amount} ${r.share}% ${r.pctOfFee}%`);
    const noTerms = courses.COURSES.find((c) => !s0.terms.some((t) => t.uni === c.uni.id));
    ok('R104 no university terms: no estimate', !noTerms || est.estimateFor(s0, noTerms, rp0, TODAY) === null);
    const hid = { ...s0, records: s0.records.map((x) => (x.rp === rp0 ? { ...x, view: { kinds: ['Bonus'], periods: 'Every study period' } } : x)) };
    ok('R104 an RP not shown course commission gets no estimate', est.estimateFor(hid, withTerms, rp0, TODAY) === null);
  }

  // R105: claim windows. Lines stay as they are; Finance sees the ones past their window, still unclaimed
  {
    const ready = r0.txs.filter((t) => t.side === 'rp' && t.status === 'Ready to invoice');
    ok('R105 a fresh RP line inside 12 months isn’t flagged', ready.every((t) => !t.claimLapsed), ready.filter((t) => t.claimLapsed).map((t) => t.id).join(' '));
    ok('R105 its claim window ends 12 months after its study period ends', ready.length > 0 && ready.every((t) => !!t.claimEnds));
    const s1m = { ...s0, settings: { ...s0.settings, rpClaimMonths: 1 } };
    const r1m = run(s1m);
    const lapsedRp = r1m.txs.filter((t) => t.side === 'rp' && t.claimLapsed);
    ok('R105 with a 1-month window, older unclaimed RP lines are flagged', lapsedRp.length > 0 && lapsedRp.every((t) => ['Ready to invoice', 'Sent back'].includes(t.status)));
    ok('R105 a flagged line keeps its status and amount (nothing closes)', lapsedRp.every((t) => r0.byId.get(t.id)?.status === t.status && r0.byId.get(t.id)?.amount === t.amount));
    ok('R105 the RP hears nothing about it', !engine.commNotes(s1m, r1m, (x) => x, TODAY).some((n) => n.to === 'rp' && /claim/i.test(n.title + n.text)));
    const u = r0.txs.find((t) => t.side === 'uni' && t.status === 'Ready to invoice');
    const sU = { ...s0, terms: s0.terms.map((t) => (t.uni === u.uni ? { ...t, claimMonths: 1 } : t)) };
    const lapsedU = run(sU).txs.filter((t) => t.side === 'uni' && t.uni === u.uni && t.claimLapsed);
    ok('R105 a university’s own window flags GSP’s uninvoiced lines', lapsedU.length > 0 && lapsedU.every((t) => !t.invoice));
    ok('R105 no university window, no flag', r0.txs.filter((t) => t.side === 'uni').every((t) => !t.claimLapsed));
  }

  // Q47 and Q54: reminders, sent back and approved
  const rq = { id: 'rq-t', rp: rp1.rp, txs: [rp1.id], date: '2026-11-01', by: 'Test', at: 4 };
  // this RP is shown every study period here, so the reminder is about lines it can see (Jovial, 11 Nov)
  const allView = { kinds: [...model.RP_VIEW_KINDS], periods: 'Every study period' };
  const s3 = { ...s1, settings: { ...s1.settings, rpView: allView }, requests: [...s1.requests, rq] };
  const r3 = run(s3);
  const notes3 = engine.commNotes(s3, r3, (x) => x, TODAY);
  const n19 = notes3.filter((n) => n.id.startsWith('n21-rq-t'));
  ok('Q47 the RP is reminded 3 and 7 days after the request (14 not yet)', n19.length === 2, `${n19.length}`);
  ok('Q47 Finance is reminded of university lines past due', notes3.some((n) => n.code === 'N22'));
  ok('Q47 the reminder days are a setting', s0.settings.reminders.rpInvoice.join() === '3,7,14' && s0.settings.reminders.uniPayment.join() === '0,7,14');
  const s4 = { ...s3, rpInvoices: [...s3.rpInvoices, { id: 'ri-t', rp: rp1.rp, file: { name: 'inv.pdf', size: 1 }, txs: [rp1.id], by: 'RP', at: 5, state: 'Sent back', reason: 'The amount doesn’t match.', decided: { by: 'Fin', at: 6 } }] };
  const r4 = run(s4);
  ok('Q50 a sent-back line is Sent back', r4.byId.get(rp1.id).status === 'Sent back');
  ok('Q54 the RP is told it was sent back, with the reason', engine.commNotes(s4, r4, (x) => x, TODAY).some((n) => n.code === 'N19' && n.to === 'rp' && n.text.includes('doesn’t match')));
  const s5 = { ...s4, rpInvoices: [...s4.rpInvoices, { id: 'ri-t2', rp: rp1.rp, file: { name: 'inv2.pdf', size: 1 }, txs: [rp1.id], by: 'RP', at: 7, state: 'To check' }] };
  ok('Q50 a new invoice puts it In review', run(s5).byId.get(rp1.id).status === 'Invoice in review');
  const s6 = { ...s5, rpInvoices: s5.rpInvoices.map((i) => (i.id === 'ri-t2' ? { ...i, state: 'Accepted', decided: { by: 'Fin', at: Date.parse(`${TODAY}T09:00:00Z`) } } : i)) };
  const r6 = run(s6);
  ok('Q50 an accepted invoice makes it Approved', r6.byId.get(rp1.id).status === 'Approved');
  // D24: GSP's own promise: an approved line past Pay within is Overdue to pay, and Finance is reminded (N23)
  const s6b = { ...s6, rpInvoices: s6.rpInvoices.map((i) => (i.id === 'ri-t2' ? { ...i, decided: { by: 'Fin', at: Date.parse('2026-09-01T09:00:00Z') } } : i)) };
  const r6b = run(s6b);
  ok('D24 an approved line past Pay within is Overdue to pay', r6b.byId.get(rp1.id).status === 'Overdue to pay', r6b.byId.get(rp1.id).status);
  ok('D24 Finance is reminded to pay it (N23)', engine.commNotes(s6b, r6b, (x) => x, TODAY).some((n) => n.code === 'N23' && n.to === 'finance'));
  ok('Q54 the RP is told it was approved', engine.commNotes(s6, r6, (x) => x, TODAY).some((n) => n.code === 'N20' && n.to === 'rp'));
  ok('Q47 no reminder once the line is on an invoice', !engine.commNotes(s6, r6, (x) => x, TODAY).some((n) => n.id.startsWith('n21-rq-t')));

  // Q41: an edit's Effective from: intakes that start before it keep the terms before
  const plain = r0.txs.find((t) => {
    if (t.side !== 'uni' || t.type !== 'Course commission' || t.frozen) return false;
    const tr = s0.terms.find((x) => x.uni === t.uni);
    return tr && !tr.bands.length && !Object.keys(tr.fixed).length && tr.cap === null;
  });
  const tr = s0.terms.find((x) => x.uni === plain.uni);
  const { created, updated, earlier, uni, ...body } = tr;
  const changed = { ...tr, rates: Object.fromEntries(Object.keys(tr.rates).map((l) => [l, 1])), earlier: [{ ...body, until: '2099-01-01' }] };
  const r7 = run({ ...s0, terms: s0.terms.map((x) => (x.uni === plain.uni ? changed : x)) });
  ok('Q41 an intake before Effective from keeps the old rate', r7.byId.get(plain.id).amount === plain.amount, `${plain.amount} → ${r7.byId.get(plain.id).amount}`);
  const changed2 = { ...changed, earlier: [{ ...body, until: '2000-01-01' }] };
  const r8 = run({ ...s0, terms: s0.terms.map((x) => (x.uni === plain.uni ? changed2 : x)) });
  ok('Q41 an intake on or after it takes the new rate', r8.byId.get(plain.id).what.includes('1%'), r8.byId.get(plain.id).what);
  ok('Q41 the intake start is the course start Admissions filled in', engine.startOf({ fees: { start: '2026-07-13' }, intake: 'Jul 2026', enrolled: '2026-08-01' }) === '2026-07-13' && engine.startOf({ intake: 'Sep 2025', enrolled: '2025-10-01' }) === '2025-09-01');

  // Q43: the RP's count leaves out students GSP won't be paid for, and Earnings shows the band
  const st0 = engine.bandStanding(s0, ctx, 'rp-horizon', extra);
  const mk = (i, withdrawn) => ({ app: `GSP-9${String(i).padStart(4, '0')}`, student: `S${i}`, rp: 'rp-horizon', course: extra[0]?.course ?? s0.enrolments[0].course, intake: 'Oct 2026', enrolled: '2026-10-20', ...(withdrawn ? { withdrawn: '2026-10-25' } : {}), fees: { tuition: 20000, scholarship: 0, start: '2026-10-19', census: ['2026-11-30'], confirmed: [], paid: [] } });
  const st1 = engine.bandStanding({ ...s0, enrolments: [...s0.enrolments, mk(1), mk(2), mk(3, true)] }, ctx, 'rp-horizon', extra);
  ok('Q43 Horizon has a band tile (tiered agreement)', !!st0 && st0.share > 0, JSON.stringify(st0));
  ok('Q43 a withdrawn student doesn’t count', st1.count === st0.count + 2, `${st0.count} → ${st1.count}`);

  // Q64, Q65, Q67
  ok('Q45 the portal keeps no payment details', !('banks' in s0) && typeof seed.sampleBanks === 'undefined');
  ok('D8 no RP tax line', s0.records.every((r) => !('tax' in r)) && !('tax' in s0.settings));
  const nt = s0.notices.find((n) => n.benefit === 'Bonus per enrolment' && n.rps.length);
  const withNt = r0.txs.filter((t) => t.notice === nt.id);
  ok('Q67 a notice bonus is in its university’s currency', withNt.length > 0 && withNt.every((t) => t.currency === r0.byApp.get(t.app).uniItem.txs[0]?.currency), withNt.map((t) => t.currency).join());
  const rpOff = withNt[0].rp;
  const keep = run({ ...s0, notices: s0.notices.map((n) => (n.id === nt.id ? { ...n, rps: n.rps.filter((r) => r !== rpOff), removed: [{ rp: rpOff, on: '2099-01-01' }] } : n)) });
  ok('Q65 an RP taken off a notice keeps it for enrolments before that day', keep.txs.filter((t) => t.notice === nt.id && t.rp === rpOff && t.type !== 'Adjustment').length === withNt.filter((t) => t.rp === rpOff).length);
  const lose = run({ ...s0, notices: s0.notices.map((n) => (n.id === nt.id ? { ...n, rps: n.rps.filter((r) => r !== rpOff), removed: [{ rp: rpOff, on: '2000-01-01' }] } : n)) });
  const unpaid = withNt.filter((t) => t.rp === rpOff && !t.frozen);
  ok('Q65 … and enrolments after it don’t get it', unpaid.every((t) => !lose.txs.some((x) => x.key === t.key && x.type !== 'Adjustment' && !x.frozen)));
  ok('Q67 agreement bonuses have no currency of their own', s0.agreements.every((a) => a.bonuses.every((b) => !('currency' in b))));

  // Q55: a university's tier counts per the year in its contract
  ok('Q55 the counting years', model.UNI_COUNTED_PER.join() === 'Calendar year,Academic year,Financial year,Intake');
  ok('Q55 every university’s terms say how they count', s0.terms.every((t) => model.UNI_COUNTED_PER.includes(t.countedPer)));
} finally {
  await vite.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
