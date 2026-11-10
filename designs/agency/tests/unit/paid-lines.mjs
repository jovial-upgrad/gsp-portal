// Jovial's 9 Nov commission decisions: paid lines never change (G3), stable transaction IDs (G29), the RP never sees
// GSP's rate or amount (G1), commission only from the fee and dates Admissions fills in (G5/G6), and no RP share of a
// university's bonus to GSP, only the RP's own agreement and notice bonuses (G25). Each scenario below changed a paid
// line before 9 Nov; now the paid line stays as paid and the difference is its own Adjustment line.
//   cd designs/agency && node tests/unit/paid-lines.mjs
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
let pass = 0, fail = 0;
const ok = (name, cond, more = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond || !more ? '' : `: ${more}`}`); };
try {
  const engine = await vite.ssrLoadModule('/src/finance/commission/engine.ts');
  const seed = await vite.ssrLoadModule('/src/finance/commission/seed.ts');
  const store = await vite.ssrLoadModule('/src/finance/commission/store.ts');
  const fees = await vite.ssrLoadModule('/src/finance/commission/AppFees.tsx');
  const appsMod = await vite.ssrLoadModule('/src/data/applications.ts');
  const studentsMod = await vite.ssrLoadModule('/src/data/students.ts');
  const TODAY = '2026-11-09';
  const ctx = store.ctxOf(TODAY);
  const baseExtra = store.enrolmentsOf(appsMod.sampleApplications(), studentsMod.sampleStudents(''));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const start = (extra = baseExtra) => engine.settleAll(seed.sampleComm(), ctx, extra);
  const run = (s, extra = baseExtra) => engine.compute(s, ctx, extra);
  const byKey = (res, key) => res.txs.find((t) => t.key === key);
  const k = (app, side, slot) => engine.lineKey(app, side, slot);
  const paidNow = (res) => res.txs.filter((t) => t.status === 'Paid');
  /** Pays a line in the records, as Record payment / Mark paid would. */
  const pay = (s, t, day = '2026-11-01') =>
    t.side === 'uni'
      ? { ...s, invoices: [...s.invoices, { number: `T-${t.id}`, uni: t.uni, date: day, txs: [t.id], by: 'Test', at: 1 }], receipts: [...s.receipts, { id: `rc-${t.id}`, uni: t.uni, txs: [t.id], amount: null, date: day, by: 'Test', at: 2 }] }
      : { ...s, requests: [...s.requests, { id: `rq-${t.id}`, rp: t.rp, txs: [t.id], date: day, by: 'Test', at: 1 }], rpInvoices: [...s.rpInvoices, { id: `ri-${t.id}`, rp: t.rp, file: { name: 'x.pdf', size: 1 }, txs: [t.id], by: 'Test', at: 2, state: 'Accepted', decided: { by: 'Test', at: 3 } }], rpPayments: [...s.rpPayments, { id: `rpp-${t.id}`, rp: t.rp, txs: [t.id], date: day, by: 'Test', at: 4 }] };
  /** After a change: every line Paid before is still there, Paid, with the same ID, amount and what it's for. */
  const unchanged = (before, after) => {
    const bad = paidNow(before).filter((t) => {
      const x = after.byId.get(t.id);
      return !x || x.status !== 'Paid' || x.amount !== t.amount || x.what !== t.what || x.key !== t.key;
    });
    return { ok: bad.length === 0, bad: bad.map((t) => `${t.id} ${t.amount}→${after.byId.get(t.id)?.amount}`).join(', ') };
  };
  const adjOf = (res, id) => res.txs.filter((t) => t.adjusts === id);
  const fee = (tuition, scholarship, start, census) => ({ tuition, scholarship, start, census, confirmed: [], paid: [] });

  /* ---------- G3: the scenarios that used to change paid lines ---------- */

  // 1. back-dated enrolments move a university's tier band (Coventry: 21+ students in a year earn 17.5%, not 15%)
  {
    const s0 = start();
    const r0 = run(s0);
    const p1 = byKey(r0, k('GSP-23305', 'uni', 'p1'));
    const more = Array.from({ length: 20 }, (_, i) => ({ app: `GSP-1${String(i).padStart(4, '0')}`, student: `Student ${i}`, rp: 'rp-delhi', course: 'coventry-1', intake: 'Sep 2025', enrolled: '2025-09-01', fees: fee(19500, 0, '2025-09-22', ['2025-10-17']) }));
    const s1 = engine.settleAll({ ...s0, enrolments: [...s0.enrolments, ...more] }, ctx, baseExtra);
    const r1 = run(s1);
    const u = unchanged(r0, r1);
    ok('1. back-dated enrolments moving a university band: paid lines unchanged', u.ok, u.bad);
    // 10 Nov (the sandbox's rule): a band above the student's rate is its own Tier bonus line, so the paid line stays and the uplift is new
    const tb = byKey(r1, k('GSP-23305', 'uni', 'tb:p1'));
    ok('1. … and the uplift is its own Tier bonus line beside the paid line', p1.status === 'Paid' && !!tb && tb.type === 'Tier bonus' && tb.amount > 0, tb ? `${tb.type} ${tb.amount}` : 'none');
  }

  // 2. a retrospective band is reached, its top-up paid, then the count drops: the paid top-up stays, a credit line takes it back
  {
    // eleven of Horizon's enrolments this financial year (after the Australia PG notice ends): the 80% band from the 11th
    const more = Array.from({ length: 11 }, (_, i) => ({ app: `GSP-2${String(i).padStart(4, '0')}`, student: `Student ${i}`, rp: 'rp-horizon', course: 'flinders-1', intake: 'Jul 2026', enrolled: `2026-09-${String(i + 1).padStart(2, '0')}`, fees: fee(33750, 0, '2026-07-27', ['2026-10-01']) }));
    // 10 Nov (the sandbox's rule): an RP line not yet kept is simply raised; once kept (paid), the rise is a Tier top-up line
    let s = start();
    s = engine.settleAll({ ...s, enrolments: [...s.enrolments, more[0]] }, ctx, baseExtra);
    let r = run(s);
    s = engine.settleAll(pay(s, byKey(r, k('GSP-20000', 'uni', 'p1'))), ctx, baseExtra);
    r = run(s);
    s = engine.settleAll(pay(s, byKey(r, k('GSP-20000', 'rp', 'm:p1'))), ctx, baseExtra);
    s = engine.settleAll({ ...s, enrolments: [...s.enrolments, ...more.slice(1)] }, ctx, baseExtra);
    r = run(s);
    ok('2. an RP line not yet kept is raised to the band itself', byKey(r, k('GSP-20005', 'rp', 'm:p1'))?.what.includes('80%'), byKey(r, k('GSP-20005', 'rp', 'm:p1'))?.what);
    const top = byKey(r, k('GSP-20000', 'rp', 'rt:p1'));
    ok('2. reaching the 80% band makes a top-up line on the first enrolment', !!top && top.amount > 0 && top.status === 'Ready to invoice', top ? `${top.status} ${top.amount}` : 'none');
    s = engine.settleAll(pay(s, top), ctx, baseExtra);
    const rPaid = run(s);
    ok('2. … paid', rPaid.byId.get(top.id).status === 'Paid');
    const s2 = engine.settleAll({ ...s, enrolments: s.enrolments.filter((e) => e.app === 'GSP-20000' || !more.some((m) => m.app === e.app)) }, ctx, baseExtra);
    const r2 = run(s2);
    const u = unchanged(rPaid, r2);
    ok('2. the count drops back: paid lines unchanged (the paid top-up stays)', u.ok, u.bad);
    const credit = adjOf(r2, top.id);
    ok('2. … and a credit line takes the top-up back', credit.length === 1 && Math.abs(credit[0].amount + top.amount) < 0.01, JSON.stringify(credit.map((c) => c.amount)));
  }

  // 3. Admissions corrects the student's fee after the line was paid
  {
    const s0 = start();
    const r0 = run(s0);
    const extra = clone(baseExtra).map((e) => (e.app === 'GSP-23305' ? { ...e, fees: { ...e.fees, tuition: e.fees.tuition + 3000 } } : e));
    const s1 = engine.settleAll(s0, ctx, extra);
    const r1 = run(s1, extra);
    const u = unchanged(r0, r1);
    ok('3. the fee changes after payment: paid lines unchanged', u.ok, u.bad);
    const p1 = byKey(r0, k('GSP-23305', 'uni', 'p1'));
    ok('3. … and the difference is an Adjustment line, with the RP’s share of it as its own', adjOf(r1, p1.id).length === 1 && r1.txs.some((t) => t.side === 'rp' && t.matches === adjOf(r1, p1.id)[0].id));
  }

  // 4. an RP comes off a notice after its notice bonus was paid
  {
    let s = start();
    let r = run(s);
    const bonus = byKey(r, k('GSP-23510', 'rp', 'nt:nt-uk-2026'));
    ok('4. Capital Career has the UK Promotion bonus on GSP-23510', !!bonus);
    s = engine.settleAll(pay(s, bonus), ctx, baseExtra);
    const rPaid = run(s);
    const s2 = engine.settleAll({ ...s, notices: s.notices.map((n) => (n.id === 'nt-uk-2026' ? { ...n, rps: n.rps.filter((x) => x !== 'rp-delhi') } : n)) }, ctx, baseExtra);
    const r2 = run(s2);
    const u = unchanged(rPaid, r2);
    ok('4. the RP comes off the notice: the paid bonus stays', u.ok, u.bad);
    ok('4. … and a credit line takes it back', adjOf(r2, bonus.id).length === 1 && adjOf(r2, bonus.id)[0].amount === -bonus.amount);
  }

  // 5. an RP's record moves to another agreement from a date before its paid lines
  {
    const s0 = start();
    const r0 = run(s0);
    const s1 = engine.settleAll({ ...s0, records: s0.records.map((x) => (x.rp === 'rp-delhi' ? { ...x, agreement: 'ag-vietnam', from: '2024-01-01', moves: [] } : x)) }, ctx, baseExtra);
    const r1 = run(s1);
    const u = unchanged(r0, r1);
    ok('5. the RP moves agreement back-dated: paid lines unchanged', u.ok, u.bad);
    const line = byKey(r0, k('GSP-22950', 'rp', 'm:p1'));
    ok('5. … and the difference is an Adjustment line', line.status === 'Paid' && adjOf(r1, line.id).length === 1);
  }

  // 6. (G29) the university's additional commissions are re-listed: the paid line keeps its ID; one taken out is credited
  {
    const s0 = start();
    const r0 = run(s0);
    const fee0 = byKey(r0, k('GSP-23305', 'uni', 'ad:ad-coventry-fee'));
    const withNew = { ...s0, terms: s0.terms.map((t) => (t.uni === 'coventry' ? { ...t, addl: [{ id: 'ad-coventry-new', desc: 'Marketing', kind: 'Amount', value: 250, when: 'On enrolment' }, ...t.addl], earlier: [] } : t)) };
    const s1 = engine.settleAll(withNew, ctx, baseExtra);
    const r1 = run(s1);
    ok('6. a new additional commission listed first: the paid line keeps its ID and amount', r1.byId.get(fee0.id)?.key === fee0.key && r1.byId.get(fee0.id).amount === fee0.amount && r1.byId.get(fee0.id).status === 'Paid');
    const fresh = byKey(r1, k('GSP-23305', 'uni', 'ad:ad-coventry-new'));
    ok('6. … the new one gets a new ID, never one in use', !!fresh && !r0.byId.has(fresh.id) && !engine.isNewId(fresh.id));
    const s2 = engine.settleAll({ ...s1, terms: s1.terms.map((t) => (t.uni === 'coventry' ? { ...t, addl: t.addl.filter((a) => a.id !== 'ad-coventry-fee') } : t)) }, ctx, baseExtra);
    const r2 = run(s2);
    ok('6. the service fee taken out of the terms: its paid line stays, and a credit line takes it back', r2.byId.get(fee0.id)?.status === 'Paid' && adjOf(r2, fee0.id).length === 1 && adjOf(r2, fee0.id)[0].amount === -fee0.amount);
  }

  // 7. an override on a paid line doesn't change it (and the page doesn't offer one)
  {
    const s0 = start();
    const r0 = run(s0);
    const p = paidNow(r0)[0];
    const s1 = { ...s0, overrides: [...s0.overrides, { id: 'ov-x', tx: p.id, amount: 1, due: '2030-01-01', hold: true, reason: 'test', by: 'Test', at: 9 }] };
    const r1 = run(s1);
    ok('7. an override on a paid line changes nothing', r1.byId.get(p.id).amount === p.amount && r1.byId.get(p.id).due === p.due && r1.byId.get(p.id).status === 'Paid');
  }

  /* ---------- G29: IDs given once ---------- */
  {
    const s = start();
    const r = run(s);
    const ids = r.txs.map((t) => t.id);
    ok('G29: every line has an ID from the sequence', ids.every((x) => /^T\d{8}$/.test(x)), ids.filter((x) => !/^T\d{8}$/.test(x)).join());
    ok('G29: no two lines share an ID', new Set(ids).size === ids.length);
    ok('G29: working out again gives the same IDs', JSON.stringify(run(engine.settleAll(s, ctx, baseExtra)).txs.map((t) => t.id)) === JSON.stringify(ids));
    const newApp = { app: 'GSP-99305', student: 'New', rp: 'rp-delhi', course: 'coventry-1', intake: 'Sep 2026', enrolled: '2026-09-30', fees: fee(19500, 0, '2026-09-21', ['2026-10-16']) };
    const s2 = engine.settleAll({ ...s, enrolments: [...s.enrolments, newApp] }, ctx, baseExtra);
    const r2 = run(s2);
    ok('G29: an application whose number ends like another’s gets its own IDs, and nobody else’s move', r2.txs.filter((t) => t.app === 'GSP-99305').every((t) => !ids.includes(t.id)) && r.txs.every((t) => r2.byId.get(t.id)?.key === t.key));
  }

  /* ---------- G1: the RP's words ---------- */
  {
    const r = run(start());
    const leaks = r.txs.filter((t) => t.side === 'rp' && /%|GSP’s|GSP's|\b[A-Z]{3} [\d,.]+/.test(t.rpWhat));
    ok('G1: no RP-side description shows a rate, GSP’s amount or the RP’s share of GSP’s commission', leaks.length === 0, leaks.map((t) => t.rpWhat).join(' | '));
  }

  /* ---------- G5/G6: only the fee and dates Admissions fills in ---------- */
  {
    const s = start();
    const r = run(s);
    const a = baseExtra.find((e) => e.app === 'GSP-23305');
    ok('G6: a census-date line’s trigger is the census date on the application', byKey(r, k('GSP-23305', 'uni', 'p1')).trigger === a.fees.census[0] && byKey(r, k('GSP-23305', 'uni', 'p2')).trigger === a.fees.census[1]);
    ok('G6: Enrolment confirmed’s study period 1 is the day it was enrolled', byKey(r, k('GSP-22950', 'uni', 'p1')).trigger === '2025-09-30');
    const w = byKey(r, k('GSP-23560', 'uni', 'p2'));
    ok('G6: a Fees paid line with no date yet waits, Expected, with no due date', !!w && w.status === 'Expected' && w.due === '' && w.trigger === '');
    const noFee = { app: 'GSP-88001', student: 'No fee', rp: 'rp-delhi', course: 'coventry-1', intake: 'Sep 2026', enrolled: '2026-09-30' };
    const r2 = run(engine.settleAll({ ...s, enrolments: [...s.enrolments, noFee] }, ctx, baseExtra));
    const al = r2.byApp.get('GSP-88001');
    ok('G5: no fee on the application: no lines, and a note saying what Admissions needs to add', al.uniItem.txs.length === 0 && /Waiting for Admissions/.test(al.uniItem.note ?? ''), al.uniItem.note);
    ok('G5: Student enrolled is blocked until the fee and dates are in', /tuition fee/.test(fees.enrolBlock({ courseId: 'coventry-1' })) && fees.enrolBlock({ courseId: 'coventry-1', fees: fee(19500, 0, '2026-09-21', ['2026-10-16']) }) === '');
    const scholarshipZero = fees.enrolBlock({ courseId: 'coventry-1', fees: fee(19500, 0, '2026-09-21', ['2026-10-16']) });
    ok('G5: a scholarship of 0 counts as filled in', scholarshipZero === '');
  }

  /* ---------- G25: no share of a university's bonus to GSP ---------- */
  {
    const r = run(start());
    const uniBonus = r.txs.filter((t) => t.side === 'uni' && t.type === 'Bonus');
    ok('G25: the seed has a university bonus to GSP', uniBonus.length > 0);
    ok('G25: no RP line matches a university bonus', !r.txs.some((t) => t.side === 'rp' && uniBonus.some((b) => b.id === t.matches)));
    const vn = r.txs.filter((t) => t.side === 'rp' && t.rp === 'rp-saigon' && t.key.includes('|rp|ab:ab-vn-each'));
    ok('G25: the Vietnam agreement’s own bonus is on every Saigon Bridge enrolment', vn.length === r.apps.filter((a) => a.rp === 'rp-saigon').length && vn.length > 0);
  }
} finally {
  await vite.close();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
