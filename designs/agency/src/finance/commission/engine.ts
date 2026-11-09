/**
 * The commission engine (Jovial, 9 Nov): pure functions that work out, from the records Commissions keeps (agreements,
 * RP records, notices, university terms), the enrolled applications, what people did (invoices, payments, requests,
 * RP invoices, overrides) and today's date, every application's two commission items and their transactions, with
 * amounts, due dates and statuses. Nothing here is stored: the pages call `compute` and show what it gives.
 *
 * University → GSP: one Course commission transaction per instalment (study period), plus any additional commission
 * and bonus in the university's terms, earned on the trigger date. GSP → RP: a matching transaction for each, at the
 * agreement's shares (the higher of a notice's and the agreement's share), its own Bonus transactions from notices,
 * and adjustments once a retrospective band is reached. Amounts stay in the university's currency.
 */
import type { Agreement, AgreementTerms, Band, CommState, Destination, Enrolment, Level, Notice, Override, RpInvoice, RpStatus, Side, TermsBody, TxStatus, TxType, UniStatus, UniTerms } from './model';
import { SIDES, TRIGGERS, dayText, money, pct } from './model';

/* ---------- context: what the engine reads from other modules ---------- */

export type CtxUni = { id: string; name: string; country: Destination; ip?: string };
export type CtxRp = { id: string; name: string; code: string; country: string; region: string };
export type CtxCourse = { id: string; name: string; level: Level; tuition: number; scholarship: number; months: number; currency: string; uni: string };
export type Ctx = { unis: CtxUni[]; rps: CtxRp[]; course: (id: string) => CtxCourse | undefined; today: string };

/* ---------- dates (yyyy-mm-dd, counted in UTC so time zones never move a day) ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => iso(ms(d) + n * 86_400_000);
export const addMonths = (d: string, n: number) => {
  const x = new Date(ms(d));
  x.setUTCMonth(x.getUTCMonth() + n);
  return iso(x.getTime());
};
/** An intake's first day ("Feb 2026" → 2026-02-22), as applications count it. */
export const intakeDay = (intake: string) => {
  const [m, y] = intake.split(' ');
  return `${y}-${String(MONTHS.indexOf(m) + 1).padStart(2, '0')}-22`;
};
const yearOf = (d: string) => Number(d.slice(0, 4));
/** The financial year a day falls in, named by the year it starts. */
const fyOf = (d: string, start: number) => (Number(d.slice(5, 7)) >= start ? yearOf(d) : yearOf(d) - 1);
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- transaction IDs ---------- */

/**
 * A transaction's ID, the same every time it's worked out: T, the application's five digits, 1 (University → GSP) or
 * 2 (GSP → RP), and two for which one: 01–12 the study periods, 21+ additional commission, 31+ bonus, 41+ notice
 * bonuses, 51–62 retrospective adjustments. Like T23305101.
 */
export const txId = (app: string, side: Side, idx: number) => `T${app.replace(/\D/g, '').slice(-5).padStart(5, '0')}${side === 'uni' ? 1 : 2}${String(idx).padStart(2, '0')}`;

/* ---------- what the engine gives ---------- */

export type Tx = {
  id: string;
  side: Side;
  type: TxType;
  app: string;
  student: string;
  rp: string;
  rpName: string;
  region: string;
  uni: string;
  uniName: string;
  course: string;
  level: Level;
  intake: string;
  currency: string;
  what: string;
  amount: number;
  due: string;
  status: TxStatus;
  /** As worked out, before any override. */
  base: { amount: number; due: string };
  /** The day it's earned (University → GSP), or the matching line's (GSP → RP). */
  trigger: string;
  /** The study period it's for (1 on), when it's course commission or its adjustment. */
  period?: number;
  /** GSP → RP: the University → GSP transaction it matches (none for a notice bonus). */
  matches?: string;
  /** A notice bonus: the notice. */
  notice?: string;
  /** The invoice it's on: GSP's to the university (its number), or the RP's (its file). */
  invoice?: string;
  rpInvoice?: string;
  override?: Override;
};
export type Item = { app: string; side: Side; label: string; totals: Record<string, number>; settled: Record<string, number>; txs: Tx[]; note?: string };
export type AppLines = { app: string; student: string; rp: string; uni: string; uniName: string; course: string; intake: string; enrolled: string; withdrawn?: string; uniItem: Item; rpItem: Item };
export type Result = { txs: Tx[]; apps: AppLines[]; byId: Map<string, Tx>; byApp: Map<string, AppLines> };

/* ---------- records as they stood on a day ---------- */

/** An agreement's or a university's terms on a day: an edit applies to items made after it. */
export function termsAt<T extends object>(rec: T & { earlier: (T & { until: string })[] }, day: string): T {
  const before = [...rec.earlier].sort((a, b) => a.until.localeCompare(b.until)).find((e) => day < e.until);
  return before ?? rec;
}
/** The agreement an RP record had on a day: the latest one from that day or before (else its earliest). */
export function agreementOn(state: CommState, rp: string, day: string): Agreement | undefined {
  const r = state.records.find((x) => x.rp === rp);
  if (!r) return undefined;
  const all = [...r.moves, { agreement: r.agreement, from: r.from }].sort((a, b) => a.from.localeCompare(b.from));
  const on = [...all].reverse().find((m) => m.from <= day) ?? all[0];
  return state.agreements.find((a) => a.id === on.agreement);
}
/** Which band a count falls in. */
export const bandFor = (bands: Band[], n: number) => bands.find((b) => n >= b.from && (b.to === null || n <= b.to)) ?? bands[bands.length - 1];
export const noticeStatus = (n: Pick<Notice, 'starts' | 'ends'>, today: string) => (today < n.starts ? 'Upcoming' : today > n.ends ? 'Ended' : 'Active');
/** A notice covers an enrolment: one of its RPs, enrolled in its period, and a course it applies to (empty: every course). */
export const noticeCovers = (n: Notice, e: Enrolment, uni: CtxUni, level: Level) =>
  n.rps.includes(e.rp) && e.enrolled >= n.starts && e.enrolled <= n.ends && (!n.dests.length || n.dests.includes(uni.country)) && (!n.unis.length || n.unis.includes(uni.id)) && (!n.levels.length || n.levels.includes(level));

/* ---------- the engine ---------- */

/**
 * Every enrolled application's commission items and transactions. `extra`: enrolments from the portal's own
 * applications (an application at Student enrolled), added to the seeded ones.
 */
export function compute(state: CommState, ctx: Ctx, extra: Enrolment[] = []): Result {
  const today = ctx.today;
  const S = state.settings;
  const seen = new Set<string>();
  const all = [...extra, ...state.enrolments].filter((e) => (seen.has(e.app) ? false : (seen.add(e.app), true))).sort((a, b) => a.enrolled.localeCompare(b.enrolled) || a.app.localeCompare(b.app));
  const uniOf = new Map(ctx.unis.map((u) => [u.id, u]));
  const rpOf = new Map(ctx.rps.map((r) => [r.id, r]));
  const invoiceOf = new Map<string, { number: string; date: string }>();
  state.invoices.forEach((i) => i.txs.forEach((t) => invoiceOf.set(t, i)));
  const paidUni = new Set(state.receipts.flatMap((r) => r.txs));
  const paidRp = new Set(state.rpPayments.flatMap((r) => r.txs));
  const requested = new Set(state.requests.flatMap((r) => r.txs));
  const rpInv = new Map<string, RpInvoice>();
  [...state.rpInvoices].sort((a, b) => a.at - b.at).forEach((i) => i.state !== 'Sent back' && i.txs.forEach((t) => rpInv.set(t, i)));
  const over = new Map<string, Override>();
  [...state.overrides].sort((a, b) => a.at - b.at).forEach((o) => over.set(o.tx, o));
  const courseOf = (e: Enrolment) => ctx.course(e.course);
  // an enrolment's place among others counted together (1 = the first)
  const ordinal = (e: Enrolment, same: (x: Enrolment) => boolean) => all.filter((x) => same(x) && (x.enrolled < e.enrolled || (x.enrolled === e.enrolled && x.app <= e.app))).length;

  const out: Tx[] = [];
  const apps: AppLines[] = [];
  for (const e of all) {
    const c = courseOf(e);
    const u = c ? uniOf.get(c.uni) : undefined;
    if (!c || !u) continue;
    const rp = rpOf.get(e.rp);
    const cur = c.currency;
    const base = { app: e.app, student: e.student, rp: e.rp, rpName: rp?.name ?? e.rp, region: rp?.region ?? '', uni: u.id, uniName: u.name, course: c.name, level: c.level, intake: e.intake, currency: cur };
    const uniTxs: Tx[] = [];
    const rpTxs: Tx[] = [];
    const tr = state.terms.find((t) => t.uni === u.id);
    let uniNote: string | undefined;
    let rpNote: string | undefined;
    if (!tr) uniNote = `No commission terms for ${u.name} yet.`;
    else {
      const T: TermsBody = termsAt<TermsBody>(tr as UniTerms, e.enrolled);
      const feeYear = T.feeBasis === 'Tuition before scholarship' ? c.tuition : c.tuition - c.scholarship;
      const perPeriod = round2((feeYear * S.periodMonths) / 12);
      const periods = Math.max(1, Math.min(T.inst, Math.ceil(c.months / S.periodMonths)));
      const trig = TRIGGERS.find((x) => x.label === T.trigger) ?? TRIGGERS[0];
      const start = intakeDay(e.intake);
      const triggerOf = (k: number) => (k === 0 && trig.days === 0 ? e.enrolled : addDays(addMonths(start, k * S.periodMonths), trig.days));
      const fixed = T.fixed[c.level];
      const rate = T.bands.length ? bandFor(T.bands, ordinal(e, (x) => courseOf(x)?.uni === u.id && yearOf(x.enrolled) === yearOf(e.enrolled))).pct : T.rates[c.level];
      const mk = (idx: number, type: TxType, what: string, amount: number, trigger: string, period?: number) => {
        const id = txId(e.app, 'uni', idx);
        const inv = invoiceOf.get(id);
        const due = inv ? addDays(inv.date, T.payDays) : addDays(trigger, T.payDays);
        uniTxs.push({ id, side: 'uni', type, ...base, what, amount: round2(amount), due, status: 'Expected', base: { amount: round2(amount), due }, trigger, period, invoice: inv?.number });
      };
      if (fixed !== undefined || rate !== undefined) {
        let sofar = 0;
        for (let k = 0; k < periods; k++) {
          let amt = fixed !== undefined ? fixed : (perPeriod * rate!) / 100;
          if (T.cap !== null) amt = Math.max(0, Math.min(amt, T.cap - sofar));
          sofar += amt;
          const what = fixed !== undefined ? `Study period ${k + 1}: fixed ${money(fixed, cur)}` : `Study period ${k + 1}: ${pct(rate!)} of ${money(perPeriod, cur)}`;
          mk(k + 1, 'Course commission', T.cap !== null && amt < (fixed ?? (perPeriod * rate!) / 100) ? `${what}, capped at ${money(T.cap, cur)} a student` : what, amt, triggerOf(k), k + 1);
        }
      }
      T.addl.forEach((a, j) => mk(21 + j, 'Additional commission', a.kind === '%' ? `${a.desc}: ${pct(a.value)} of ${money(feeYear, cur)}` : a.desc, a.kind === '%' ? (feeYear * a.value) / 100 : a.value, a.when === 'On enrolment' ? e.enrolled : triggerOf(0)));
      T.bonus.forEach((b, j) => {
        const n = ordinal(e, (x) => courseOf(x)?.uni === u.id && yearOf(x.enrolled) === b.year);
        if (yearOf(e.enrolled) === b.year && n === b.min) mk(31 + j, 'Bonus', `${b.desc}: enrolment ${b.min} of ${b.year}`, b.amount, e.enrolled);
      });
      // statuses
      uniTxs.forEach((t) => {
        const o = over.get(t.id);
        if (o) Object.assign(t, { override: o, amount: o.amount ?? t.amount, due: o.due ?? t.due });
        t.status = uniStatus(t, { withdrawn: e.withdrawn, paid: paidUni.has(t.id), invoiced: !!t.invoice, hold: !!o?.hold, today });
      });
    }

    // GSP → RP
    const ag = agreementOn(state, e.rp, e.enrolled);
    if (!ag) rpNote = `No commission record for ${rp?.name ?? e.rp} yet.`;
    else {
      const A: AgreementTerms = termsAt<AgreementTerms>(ag, e.enrolled);
      const periodSame = (x: Enrolment) =>
        x.rp === e.rp && (A.countedPer === 'Calendar year' ? yearOf(x.enrolled) === yearOf(e.enrolled) : A.countedPer === 'Intake' ? x.intake === e.intake : fyOf(x.enrolled, S.fyStart) === fyOf(e.enrolled, S.fyStart));
      const n = ordinal(e, periodSame);
      let share = A.shareType === 'Flat' ? A.share ?? 0 : bandFor(A.bands, n)?.pct ?? 0;
      // retrospective: the band the RP's count has reached by today raises every earlier enrolment in the period
      const reached = A.shareType !== 'Flat' && A.retro ? bandFor(A.bands, all.filter((x) => periodSame(x) && x.enrolled <= today).length)?.pct ?? share : share;
      const covering = c && u ? state.notices.filter((nt) => noticeCovers(nt, e, u, c.level)) : [];
      let from = '';
      covering
        .filter((nt) => nt.benefit !== 'Bonus per enrolment')
        .forEach((nt) => {
          const s = nt.benefit === 'Tiered share' ? bandFor(nt.bands, ordinal(e, (x) => { const cx = courseOf(x); const ux = cx && uniOf.get(cx.uni); return !!ux && noticeCovers(nt, x, ux, cx.level); }))?.pct ?? 0 : nt.share ?? 0;
          if (s > share) {
            share = s;
            from = nt.name;
          }
        });
      const addlShare = A.addl ?? share;
      const agName = from ? `notice: ${from}` : ag.name;
      const first = uniTxs.find((t) => t.type === 'Course commission') ?? uniTxs[0];
      const mkRp = (idx: number, type: TxType, what: string, amount: number, matched?: Tx, extra: Partial<Tx> = {}) => {
        const id = txId(e.app, 'rp', idx);
        const inv = rpInv.get(id);
        const anchor = matched ?? first;
        const due = inv?.state === 'Accepted' && inv.decided ? addDays(iso(inv.decided.at), A.payDays) : anchor ? addDays(anchor.due, A.payDays) : addDays(e.enrolled, A.payDays);
        const t: Tx = { id, side: 'rp', type, ...base, what, amount: round2(amount), due, status: 'Expected', base: { amount: round2(amount), due }, trigger: anchor?.trigger ?? e.enrolled, matches: matched?.id, invoice: inv?.file.name, rpInvoice: inv?.id, ...extra };
        const o = over.get(id);
        if (o) Object.assign(t, { override: o, amount: o.amount ?? t.amount, due: o.due ?? t.due });
        t.status = rpStatus({ uni: anchor?.status, paid: paidRp.has(id), hold: !!o?.hold, received: inv?.state === 'Accepted', requested: requested.has(id) });
        rpTxs.push(t);
      };
      uniTxs.forEach((t) => {
        const idx = Number(t.id.slice(-2));
        if (t.type === 'Course commission') {
          mkRp(idx, t.type, `Study period ${t.period}: ${pct(share)} of GSP’s ${money(t.amount, cur)} (${agName})`, (t.amount * share) / 100, t, { period: t.period });
          if (reached > share) mkRp(50 + idx, t.type, `Study period ${t.period}: retrospective band, ${pct(share)} → ${pct(reached)} of ${money(t.amount, cur)}`, (t.amount * (reached - share)) / 100, t, { period: t.period });
        } else if (t.type === 'Additional commission') mkRp(idx, t.type, `${t.what}: ${pct(addlShare)} passed on`, (t.amount * addlShare) / 100, t);
        else if (A.bonus !== null) mkRp(idx, t.type, `${t.what}: ${pct(A.bonus)} passed on`, (t.amount * A.bonus) / 100, t);
      });
      covering
        .filter((nt) => nt.benefit === 'Bonus per enrolment')
        .forEach((nt, j) => mkRp(41 + j, 'Bonus', `Notice: ${nt.name}`, nt.amount ?? 0, undefined, { notice: nt.id, currency: nt.currency }));
    }
    out.push(...uniTxs, ...rpTxs);
    const item = (side: Side, txs: Tx[], note?: string): Item => {
      const totals: Record<string, number> = {};
      const settled: Record<string, number> = {};
      txs.forEach((t) => {
        if (t.status === 'Not payable') return;
        totals[t.currency] = round2((totals[t.currency] ?? 0) + t.amount);
        if (t.status === 'Paid') settled[t.currency] = round2((settled[t.currency] ?? 0) + t.amount);
      });
      return { app: e.app, side, label: SIDES[side], totals, settled, txs, note };
    };
    apps.push({ app: e.app, student: e.student, rp: e.rp, uni: u.id, uniName: u.name, course: c.name, intake: e.intake, enrolled: e.enrolled, withdrawn: e.withdrawn, uniItem: item('uni', uniTxs, uniNote), rpItem: item('rp', rpTxs, rpNote) });
  }
  return { txs: out, apps, byId: new Map(out.map((t) => [t.id, t])), byApp: new Map(apps.map((a) => [a.app, a])) };
}

/** A University → GSP line's status, from what's happened to it and today. */
export function uniStatus(t: Pick<Tx, 'trigger' | 'due'>, o: { withdrawn?: string; paid: boolean; invoiced: boolean; hold: boolean; today: string }): UniStatus {
  if (o.withdrawn && o.withdrawn < t.trigger) return 'Not payable';
  if (o.paid) return 'Paid';
  if (o.hold) return 'Held';
  if (o.invoiced) return o.today > t.due ? 'Overdue' : 'Invoiced';
  return t.trigger <= o.today ? 'Ready to invoice' : 'Expected';
}
/** A GSP → RP line's status: it can't be Ready to pay until its University → GSP line is Paid. */
export function rpStatus(o: { uni?: TxStatus; paid: boolean; hold: boolean; received: boolean; requested: boolean }): RpStatus {
  if (o.uni === 'Not payable' || !o.uni) return 'Not payable';
  if (o.paid) return 'Paid';
  if (o.hold) return 'Held';
  if (o.uni !== 'Paid') return 'Expected';
  if (o.received) return 'Invoice received';
  if (o.requested) return 'Invoice requested';
  return 'Ready to pay';
}

/** Adds money by currency: "AUD 2,000 + GBP 300". */
export const totalsText = (m: Record<string, number>) => (Object.keys(m).length ? Object.entries(m).map(([c, n]) => money(n, c)).join(' + ') : '—');
export const sumBy = (txs: Pick<Tx, 'amount' | 'currency'>[]) => txs.reduce<Record<string, number>>((m, t) => ((m[t.currency] = round2((m[t.currency] ?? 0) + t.amount)), m), {});

/** GSP's next invoice number to a university: GSP-{code}-{year}-{seq}, the sequence counting that university's invoices that year. */
export function nextInvoiceNumber(state: CommState, uni: string, day: string) {
  const code = uni.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase();
  const year = day.slice(0, 4);
  const seq = state.invoices.filter((i) => i.uni === uni && i.date.slice(0, 4) === year).length + 1;
  return state.settings.invoiceFormat.replace('{code}', code).replace('{year}', year).replace('{seq}', String(seq).padStart(3, '0'));
}

/* ---------- tasks and notifications the records make (T80, T81; N16, N17, N18) ---------- */

/** RPs with an accepted agreement and no commission record: each makes a T80 task, and the "without a record" tile counts them. */
export const rpsWithoutRecord = <R extends { id: string }>(state: CommState, accepted: R[]) => accepted.filter((r) => !state.records.some((x) => x.rp === r.id));
/** Universities without terms: each makes a T81 task, and the "without terms" tile counts them. */
export const unisWithoutTerms = <U extends { id: string }>(state: CommState, unis: U[]) => unis.filter((u) => !state.terms.some((t) => t.uni === u.id));

export type CommNote = { id: string; to: 'rp' | 'finance'; rp: string; code: 'N16' | 'N17' | 'N18'; title: string; text: string; at: number };
/** The notifications the actions made: N16 to the RP when its invoice is asked for, N17 to Finance when an RP sends one, N18 when GSP pays. */
export function commNotes(state: CommState, res: Result, rpName: (id: string) => string): CommNote[] {
  const total = (ids: string[]) => totalsText(sumBy(ids.map((i) => res.byId.get(i)).filter((x): x is Tx => !!x)));
  return [
    ...state.requests.map((r): CommNote => ({ id: `n16-${r.id}`, to: 'rp', rp: r.rp, code: 'N16', title: 'GSP is ready to pay you: send your invoice', text: `${r.txs.length} ${r.txs.length === 1 ? 'line' : 'lines'}, ${total(r.txs)}. Download GSP’s invoice on Earnings, or upload your own.`, at: r.at })),
    ...state.rpInvoices.map((i): CommNote => ({ id: `n17-${i.id}`, to: 'finance', rp: i.rp, code: 'N17', title: `${rpName(i.rp)} sent an invoice for ${i.txs.length} ${i.txs.length === 1 ? 'line' : 'lines'}`, text: `${i.file.name}: ${total(i.txs)}. Check it on Commission lines.`, at: i.at })),
    ...state.rpPayments.map((p): CommNote => ({ id: `n18-${p.id}`, to: 'rp', rp: p.rp, code: 'N18', title: `GSP paid you ${total(p.txs)}`, text: `${p.txs.length} ${p.txs.length === 1 ? 'line' : 'lines'}, paid on ${dayText(p.date)}.`, at: p.at })),
  ].sort((a, b) => b.at - a.at);
}
