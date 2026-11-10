/**
 * The commission engine (Jovial, 9 Nov): pure functions that work out, from the records Commissions keeps (agreements,
 * RP records, notices, university terms), the enrolled applications (with the fee and dates their Admissions officer
 * filled in), what people did (invoices, payments, requests, RP invoices, overrides) and today's date, every
 * application's two commission items and their transactions, with amounts, due dates and statuses. The pages call
 * `compute` and show what it gives; `settle` keeps what must be kept (each line's ID, and lines once acted on).
 *
 * University → GSP: one Course commission transaction per study period the university pays on, plus any additional
 * commission and bonus in the university's terms, earned on the trigger date the application holds. GSP → RP: a
 * matching transaction for each course and additional commission line, at the agreement's share (the higher of a
 * notice's and the agreement's), Bonus lines from the RP's own agreement and notices (never a share of a university's
 * bonus to GSP), and retrospective band top-ups as their own lines. Amounts stay in the university's currency.
 *
 * Lines that were invoiced, requested or paid never change (9 Nov): later differences become Adjustment lines.
 */
import type { Agreement, AgreementTerms, Band, CommState, Destination, Enrolment, Frozen, Level, Notice, Override, RpInvoice, RpStatus, Side, TermsBody, TxStatus, TxType, UniStatus, UniTerms } from './model';
import { SIDES, TRIGGERS, dayText, money, pct, roundMoney } from './model';

/* ---------- context: what the engine reads from other modules ---------- */

export type CtxUni = { id: string; name: string; country: Destination; ip?: string };
export type CtxRp = { id: string; name: string; code: string; country: string; region: string };
/** A course as the engine reads it: no fee (the application holds the student's own). */
export type CtxCourse = { id: string; name: string; level: Level; months: number; currency: string; uni: string };
export type Ctx = { unis: CtxUni[]; rps: CtxRp[]; course: (id: string) => CtxCourse | undefined; today: string };

/* ---------- dates (yyyy-mm-dd, counted in UTC so time zones never move a day) ---------- */

const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => (d ? iso(ms(d) + n * 86_400_000) : '');
const yearOf = (d: string) => Number(d.slice(0, 4));
/** The financial year a day falls in, named by the year it starts. */
const fyOf = (d: string, start: number) => (Number(d.slice(5, 7)) >= start ? yearOf(d) : yearOf(d) - 1);
/** Rounds half up to the currency's smallest unit (Q62); without a currency, to cents. */
const round2 = (n: number, cur?: string) => roundMoney(n, cur);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * An enrolment's intake start (Jovial, 10 Nov, Q41): the course start date Admissions filled in, else the 1st of the
 * intake's month. Terms in force on this day apply; tiers order enrolments by it, then by enrolment date.
 */
export const startOf = (e: Pick<Enrolment, 'fees' | 'intake' | 'enrolled'>) => {
  if (e.fees?.start) return e.fees.start;
  const m = /^(\w{3})\w* (\d{4})$/.exec(e.intake ?? '');
  const k = m ? MONTHS.indexOf(m[1]) : -1;
  return k >= 0 ? `${m![2]}-${String(k + 1).padStart(2, '0')}-01` : e.enrolled;
};

/* ---------- keys and transaction IDs ---------- */

/**
 * What a line is for, which never changes: the application, the side, and its slot (p1… a study period, ad:{id} an
 * additional commission, bn:{id} a university bonus, m:{slot} the RP's line matching a university slot, rt:{slot} a
 * retrospective top-up, nt:{id} a notice bonus, ab:{id} an agreement bonus; ~n: its nth adjustment).
 */
export const lineKey = (app: string, side: Side, slot: string) => `${app}|${side}|${slot}`;
/** The ID format: T and eight digits, like T00492048. */
export const idText = (n: number) => `T${String(n).padStart(8, '0')}`;
/** A line not given its ID yet (only for a moment, until `settle` gives it one). */
const NEW = 'new:';
export const isNewId = (id: string) => id.startsWith(NEW);
/** The study periods a university pays on for a course: its terms' instalments, at most the course's length in study periods. */
export const periodsFor = (inst: number, months: number, periodMonths: number) => Math.max(1, Math.min(inst, Math.ceil(months / periodMonths)));

/* ---------- what the engine gives ---------- */

export type Tx = {
  id: string;
  key: string;
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
  /** What it's for, with the working: GSP's views. */
  what: string;
  /** What it's for, in plain words (no rates, no GSP amounts): the RP's views (Jovial, 9 Nov). */
  rpWhat: string;
  amount: number;
  /** Empty: its trigger date isn't filled in yet. */
  due: string;
  status: TxStatus;
  /** As worked out, before any override. */
  base: { amount: number; due: string };
  /** The day it's earned (University → GSP), or the matching line's (GSP → RP). Empty: not filled in yet. */
  trigger: string;
  /** The study period it's for (1 on), when it's course commission or its adjustment or top-up. */
  period?: number;
  /** GSP → RP: the University → GSP transaction it matches (none for a bonus). */
  matches?: string;
  /** A notice bonus: the notice. */
  notice?: string;
  /** An Adjustment: the line it adjusts. */
  adjusts?: string;
  /** Invoiced, requested or paid: its amount and what it's for are kept as they were. */
  frozen?: boolean;
  /** The invoice it's on: GSP's to the university (its number), or the RP's (its file). */
  invoice?: string;
  rpInvoice?: string;
  override?: Override;
  /** University → GSP: what came in for it so far, what was written off, and why it was paid short (Q44). */
  received?: number;
  writtenOff?: number;
  short?: string;
  /** GSP → RP: the day GSP asked the RP for its invoice. */
  requested?: string;
};
export type Item = { app: string; side: Side; label: string; totals: Record<string, number>; settled: Record<string, number>; txs: Tx[]; note?: string };
export type AppLines = { app: string; student: string; rp: string; uni: string; uniName: string; course: string; intake: string; enrolled: string; withdrawn?: string; uniItem: Item; rpItem: Item };
export type Result = {
  txs: Tx[];
  apps: AppLines[];
  byId: Map<string, Tx>;
  byApp: Map<string, AppLines>;
  /** Lines that need an ID (their keys), for `settle`. */
  needIds: string[];
};

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
  // an RP taken off a notice keeps it for enrolments before that day (Q65)
  (n.rps.includes(e.rp) || (n.removed ?? []).some((r) => r.rp === e.rp && e.enrolled < r.on)) && e.enrolled >= n.starts && e.enrolled <= n.ends && (!n.dests.length || n.dests.includes(uni.country)) && (!n.unis.length || n.unis.includes(uni.id)) && (!n.levels.length || n.levels.includes(level));
/** What the application still needs from Admissions before commission can be worked out (empty: nothing). */
export function feesMissing(e: Pick<Enrolment, 'fees'>, terms?: Pick<TermsBody, 'trigger'>): string[] {
  const f = e.fees;
  const trig = TRIGGERS.find((t) => t.label === terms?.trigger);
  return [
    ...(f?.tuition == null ? ['tuition fee'] : []),
    ...(f?.scholarship == null ? ['scholarship'] : []),
    ...(!f?.start ? ['course start date'] : []),
    // study period 1's trigger date, unless it's the day of enrolment
    ...(trig && trig.field !== 'confirmed' && !f?.[trig.field]?.[0] ? [trig.date.toLowerCase()] : []),
  ];
}

/* ---------- the engine ---------- */

type Draft = { slot: string; type: TxType; what: string; rpWhat: string; amount: number; trigger: string; due?: string; period?: number; matches?: string; notice?: string; currency?: string };

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
  // what came in for each line over all receipts (an older receipt with no per-line amounts paid its lines in full), and write-offs (Q44)
  const received = new Map<string, number>();
  const shortWhy = new Map<string, string>();
  const fullyPaid = new Set<string>();
  [...state.receipts].sort((a, b) => a.at - b.at).forEach((r) =>
    r.txs.forEach((t) => {
      if (!r.paid || r.paid[t] == null) return void fullyPaid.add(t);
      received.set(t, (received.get(t) ?? 0) + r.paid[t]);
      if (r.short?.[t]) shortWhy.set(t, r.short[t]);
    }),
  );
  const writtenOff = new Map((state.writeOffs ?? []).map((w) => [w.tx, w]));
  const paidRp = new Set(state.rpPayments.flatMap((r) => r.txs));
  const rpInv = new Map<string, RpInvoice>();
  const sentBack = new Map<string, RpInvoice>();
  [...state.rpInvoices]
    .sort((a, b) => a.at - b.at)
    .forEach((i) =>
      i.txs.forEach((t) => {
        // the latest invoice for a line decides: sent back, until the RP sends another
        if (i.state === 'Sent back') return void (rpInv.delete(t), sentBack.set(t, i));
        rpInv.set(t, i);
        sentBack.delete(t);
      }),
    );
  const requestedOn = new Map<string, string>();
  state.requests.forEach((r) => r.txs.forEach((t) => requestedOn.set(t, r.date)));
  const over = new Map<string, Override>();
  [...state.overrides].sort((a, b) => a.at - b.at).forEach((o) => over.set(o.tx, o));
  const frozenByApp = new Map<string, Frozen[]>();
  Object.entries(state.frozen).forEach(([, f]) => frozenByApp.set(f.app, [...(frozenByApp.get(f.app) ?? []), f]));
  const needIds: string[] = [];
  const idOf = (key: string) => state.ids[key] ?? (needIds.push(key), `${NEW}${key}`);
  const courseOf = (e: Enrolment) => ctx.course(e.course);
  const termsOfUni = (uni: string, day: string) => {
    const tr = state.terms.find((t) => t.uni === uni);
    return tr ? termsAt<TermsBody>(tr as UniTerms, day) : undefined;
  };
  /** Study period 1's trigger date as the application holds it (empty: not filled in yet). */
  const firstTrigger = (x: Enrolment) => {
    const cx = courseOf(x);
    const Tx = cx ? termsOfUni(cx.uni, startOf(x)) : undefined;
    const trig = TRIGGERS.find((t) => t.label === Tx?.trigger) ?? TRIGGERS[0];
    return trig.field === 'confirmed' ? x.enrolled : x.fees?.[trig.field]?.[0] ?? '';
  };
  /** A student GSP will be paid for (Q43, Q55): not withdrawn before study period 1's trigger date. */
  const payable = (x: Enrolment) => !x.withdrawn || (!!firstTrigger(x) && x.withdrawn >= firstTrigger(x));
  /** Counting order (Q43): by intake start, then enrolment date. */
  const before = (x: Enrolment, e: Enrolment) => {
    const a = startOf(x), b = startOf(e);
    return a < b || (a === b && (x.enrolled < e.enrolled || (x.enrolled === e.enrolled && x.app <= e.app)));
  };
  // an enrolment's place among the payable ones counted together (1 = the first)
  const ordinal = (e: Enrolment, same: (x: Enrolment) => boolean) => all.filter((x) => same(x) && payable(x) && before(x, e)).length;
  /** The window a day falls in for a count: the year as the terms or agreement count it, or the intake. */
  const windowOf = (x: Enrolment, per: string, yearStart: number) => {
    const d = startOf(x);
    return per === 'Intake' ? `i:${x.intake}` : per === 'Financial year' ? `f:${fyOf(d, S.fyStart)}` : per === 'Academic year' ? `a:${fyOf(d, yearStart || 1)}` : `c:${yearOf(d)}`;
  };

  const out: Tx[] = [];
  const apps: AppLines[] = [];
  for (const e of all) {
    const c = courseOf(e);
    const u = c ? uniOf.get(c.uni) : undefined;
    if (!c || !u) continue;
    const rp = rpOf.get(e.rp);
    const cur = c.currency;
    const base = { app: e.app, student: e.student, rp: e.rp, rpName: rp?.name ?? e.rp, region: rp?.region ?? '', uni: u.id, uniName: u.name, course: c.name, level: c.level, intake: e.intake, currency: cur };
    const frozenHere = frozenByApp.get(e.app) ?? [];

    /**
     * A slot's lines: the line as worked out, or, once it's frozen, as it was, then its frozen adjustments and one
     * open Adjustment for whatever the worked-out amount now differs by. `d` undefined: the slot isn't worked out any
     * more (its notice or additional commission went), so the frozen lines stay and an Adjustment takes them back.
     */
    const chain = (side: Side, slot: string, d: Draft | undefined): (Tx & { _base: number })[] => {
      const key = lineKey(e.app, side, slot);
      const id = idOf(key);
      const fr = state.frozen[id];
      const mk = (k: string, tid: string, x: Omit<Draft, 'slot'>, f?: Frozen): Tx & { _base: number } => ({
        id: tid,
        key: k,
        side,
        ...base,
        type: x.type,
        what: x.what,
        rpWhat: x.rpWhat,
        amount: round2(x.amount, x.currency ?? cur),
        due: x.due ?? '',
        status: 'Expected',
        base: { amount: round2(f ? f.base : x.amount, x.currency ?? cur), due: x.due ?? '' },
        trigger: x.trigger,
        period: x.period,
        matches: x.matches,
        notice: x.notice,
        currency: x.currency ?? cur,
        frozen: !!f,
        _base: f ? f.base : round2(x.amount, x.currency ?? cur),
      });
      if (!fr) return d ? [mk(key, id, d)] : [];
      const fromFrozen = (f: Frozen, k: string, tid: string) => {
        const t = mk(k, tid, { type: f.type, what: f.what, rpWhat: f.rpWhat, amount: f.amount, trigger: f.trigger, due: f.due, period: f.period, matches: f.matches, notice: f.notice, currency: f.currency }, f);
        return Object.assign(t, { adjusts: f.key === key ? undefined : id });
      };
      const lines = [fromFrozen(fr, key, id)];
      let sum = fr.base;
      let n = 1;
      for (;;) {
        const k = `${key}~${n}`;
        const aid = state.ids[k];
        const fa = aid ? state.frozen[aid] : undefined;
        if (!fa) break;
        lines.push(fromFrozen(fa, k, aid!));
        sum += fa.base;
        n++;
      }
      const target = d ? d.amount : 0;
      const diff = round2(target - sum);
      if (Math.abs(diff) >= 0.01) {
        const k = `${key}~${n}`;
        const m = d ?? { type: fr.type, what: fr.what, rpWhat: fr.rpWhat, trigger: fr.trigger, period: fr.period, matches: fr.matches, notice: fr.notice, currency: fr.currency };
        const why = d ? `${money(round2(sum), fr.currency)} → ${money(round2(target), fr.currency)}` : `${money(round2(sum), fr.currency)} no longer earned`;
        lines.push(
          Object.assign(mk(k, idOf(k), { type: 'Adjustment', what: `Adjustment to ${id}: ${why}`, rpWhat: `Adjustment to ${id}`, amount: diff, trigger: m.trigger, due: d?.due, period: m.period, matches: d?.matches ?? m.matches, notice: m.notice, currency: m.currency ?? fr.currency }), { adjusts: id }),
        );
      }
      return lines;
    };
    /** The frozen slots of a side that weren't worked out this time: their lines, with an Adjustment taking them back. */
    const leftovers = (side: Side, done: Set<string>) =>
      frozenHere
        .filter((f) => f.side === side && !f.adjusts && !done.has(f.key))
        .flatMap((f) => chain(side, f.key.slice(`${e.app}|${side}|`.length), undefined));

    const uniTxs: (Tx & { _base: number })[] = [];
    const rpTxs: (Tx & { _base: number })[] = [];
    const tr = state.terms.find((t) => t.uni === u.id);
    let uniNote: string | undefined;
    let rpNote: string | undefined;
    const uniDone = new Set<string>();
    const T: TermsBody | undefined = tr ? termsAt<TermsBody>(tr as UniTerms, startOf(e)) : undefined;
    const missing = feesMissing(e, T);
    if (!T) uniNote = `No commission terms for ${u.name} yet.`;
    else if (missing.length) uniNote = `Waiting for Admissions to add the ${missing.join(', ')} on the application.`;
    if (T && !missing.length) {
      const f = e.fees!;
      const feeYear = T.feeBasis === 'Tuition before scholarship' ? f.tuition! : f.tuition! - f.scholarship!;
      const perPeriod = round2((feeYear * S.periodMonths) / 12);
      const periods = periodsFor(T.inst, c.months, S.periodMonths);
      const trig = TRIGGERS.find((x) => x.label === T.trigger) ?? TRIGGERS[0];
      // the trigger date the application holds for a study period (Enrolment confirmed's first: the day it was enrolled)
      const triggerOf = (k: number) => (trig.field === 'confirmed' && k === 0 ? e.enrolled : f[trig.field][k] ?? '');
      const fixed = T.fixed[c.level];
      // a university's bands count its payable students in the year its contract says (Q55)
      const uniWindow = (x: Enrolment) => windowOf(x, T.countedPer ?? 'Calendar year', T.yearStart ?? 1);
      const rate = T.bands.length ? bandFor(T.bands, ordinal(e, (x) => courseOf(x)?.uni === u.id && uniWindow(x) === uniWindow(e))).pct : T.rates[c.level];
      const drafts: Draft[] = [];
      if (fixed !== undefined || rate !== undefined) {
        let sofar = 0;
        for (let k = 0; k < periods; k++) {
          let amt = fixed !== undefined ? fixed : (perPeriod * rate!) / 100;
          if (T.cap !== null) amt = Math.max(0, Math.min(amt, T.cap - sofar));
          sofar += amt;
          const what = fixed !== undefined ? `Study period ${k + 1}: fixed ${money(fixed, cur)}` : `Study period ${k + 1}: ${pct(rate!)} of ${money(perPeriod, cur)}`;
          drafts.push({ slot: `p${k + 1}`, type: 'Course commission', what: T.cap !== null && amt < (fixed ?? (perPeriod * rate!) / 100) ? `${what}, capped at ${money(T.cap, cur)} a student` : what, rpWhat: `Study period ${k + 1} commission`, amount: amt, trigger: triggerOf(k), period: k + 1 });
        }
      }
      T.addl.forEach((a) => drafts.push({ slot: `ad:${a.id}`, type: 'Additional commission', what: a.kind === '%' ? `${a.desc}: ${pct(a.value)} of ${money(feeYear, cur)}` : a.desc, rpWhat: a.desc, amount: a.kind === '%' ? (feeYear * a.value) / 100 : a.value, trigger: a.when === 'On enrolment' ? e.enrolled : triggerOf(0) }));
      T.bonus.forEach((b) => {
        const n = ordinal(e, (x) => courseOf(x)?.uni === u.id && yearOf(startOf(x)) === b.year);
        if (yearOf(startOf(e)) === b.year && payable(e) && n === b.min) drafts.push({ slot: `bn:${b.id}`, type: 'Bonus', what: `${b.desc}: enrolment ${b.min} of ${b.year}`, rpWhat: b.desc, amount: b.amount, trigger: e.enrolled });
      });
      drafts.forEach((d) => {
        uniDone.add(lineKey(e.app, 'uni', d.slot));
        uniTxs.push(...chain('uni', d.slot, d));
      });
    }
    uniTxs.push(...leftovers('uni', uniDone));
    // due dates and statuses
    const payDays = T?.payDays ?? 0;
    uniTxs.forEach((t) => {
      const fr = state.frozen[t.id];
      const inv = invoiceOf.get(t.id);
      if (!fr?.final) t.due = inv ? addDays(inv.date, payDays) : addDays(t.trigger, payDays);
      t.base.due = t.due;
      t.invoice = inv?.number;
      const o = over.get(t.id);
      if (o && !fr?.final) Object.assign(t, { override: o, amount: o.amount ?? t.amount, due: o.due ?? t.due });
      const got = fullyPaid.has(t.id) ? t.amount : received.get(t.id) ?? 0;
      const off = writtenOff.get(t.id);
      t.received = round2(got, t.currency);
      if (off) t.writtenOff = off.amount;
      if (shortWhy.has(t.id)) t.short = shortWhy.get(t.id);
      t.status = uniStatus(t, { withdrawn: e.withdrawn, paid: fullyPaid.has(t.id) || !!off || (got > 0 && got >= t.amount - 0.005), part: got > 0, invoiced: !!t.invoice, hold: !!o?.hold, today });
    });

    // GSP → RP
    const ag = agreementOn(state, e.rp, startOf(e));
    const rpDone = new Set<string>();
    if (!ag) rpNote = `No commission record for ${rp?.name ?? e.rp} yet.`;
    else {
      const A: AgreementTerms = termsAt<AgreementTerms>(ag, startOf(e));
      // the RP's count (Q43): its payable students in the agreement's window (an RP's branches enrol under the RP, so they count with it)
      const periodSame = (x: Enrolment) => x.rp === e.rp && windowOf(x, A.countedPer, 1) === windowOf(e, A.countedPer, 1);
      const n = ordinal(e, periodSame);
      let share = A.shareType === 'Flat' ? A.share ?? 0 : bandFor(A.bands, n)?.pct ?? 0;
      // retrospective: the band the RP's count has reached by today raises every earlier enrolment in the period
      const reached = A.shareType !== 'Flat' && A.retro ? bandFor(A.bands, all.filter((x) => periodSame(x) && payable(x) && x.enrolled <= today).length)?.pct ?? share : share;
      const covering = state.notices.filter((nt) => noticeCovers(nt, e, u, c.level));
      let from = '';
      covering
        .filter((nt) => nt.benefit !== 'Bonus per enrolment')
        .forEach((nt) => {
          const covered = (x: Enrolment) => {
            const cx = courseOf(x);
            const ux = cx && uniOf.get(cx.uni);
            return !!ux && noticeCovers(nt, x, ux, cx.level);
          };
          // a tiered notice counts like an agreement: by enrolment date, and retrospective when it says so (Q57)
          const count = nt.retro ? all.filter((x) => covered(x) && payable(x) && x.enrolled <= today).length : ordinal(e, covered);
          const s = nt.benefit === 'Tiered share' ? bandFor(nt.bands, count)?.pct ?? 0 : nt.share ?? 0;
          if (s > share) {
            share = s;
            from = nt.name;
          }
        });
      const addlShare = A.addl ?? share;
      const agName = from ? `notice: ${from}` : ag.name;
      const drafts: Draft[] = [];
      uniTxs.forEach((t0) => {
        // a university line paid short (Q44): the RP's line is its share of what came in, until the rest comes or is written off
        const t = (t0.status === 'Part paid' || t0.writtenOff) && t0.amount > 0 ? { ...t0, amount: t0.received ?? 0 } : t0;
        const slot = t.key.slice(`${e.app}|uni|`.length);
        // what the university line is at heart: an Adjustment counts as what it adjusts
        const kind = t.type === 'Adjustment' ? uniTxs.find((x) => x.id === t.adjusts)?.type ?? t.type : t.type;
        if (kind === 'Course commission') {
          const p = t.period;
          drafts.push({ slot: `m:${slot}`, type: t.type, what: `${t.type === 'Adjustment' ? `Adjustment to ${t.adjusts}, study period ${p}` : `Study period ${p}`}: ${pct(share)} of GSP’s ${money(t.amount, cur)} (${agName})`, rpWhat: t.type === 'Adjustment' ? `Study period ${p} commission, adjusted` : `Study period ${p} commission`, amount: (t.amount * share) / 100, trigger: t.trigger, period: p, matches: t.id });
          if (reached > share) drafts.push({ slot: `rt:${slot}`, type: t.type, what: `Study period ${p}: retrospective band, ${pct(share)} → ${pct(reached)} of ${money(t.amount, cur)}`, rpWhat: `Retrospective band top-up, study period ${p}`, amount: (t.amount * (reached - share)) / 100, trigger: t.trigger, period: p, matches: t.id });
        } else if (kind === 'Additional commission') drafts.push({ slot: `m:${slot}`, type: t.type, what: `${t.what}: ${pct(addlShare)} passed on`, rpWhat: t.rpWhat, amount: (t.amount * addlShare) / 100, trigger: t.trigger, matches: t.id });
        // a university's bonus to GSP is GSP's alone (9 Nov)
      });
      // the RP's own bonuses: its agreement's and its notices', whether or not GSP meets a university's tier
      covering
        .filter((nt) => nt.benefit === 'Bonus per enrolment')
        .forEach((nt) => drafts.push({ slot: `nt:${nt.id}`, type: 'Bonus', what: `Notice: ${nt.name}`, rpWhat: `Notice: ${nt.name}`, amount: nt.amount ?? 0, trigger: first()?.trigger ?? e.enrolled, notice: nt.id }));
      (A.bonuses ?? []).forEach((b) => {
        if (b.when === 'Every enrolment' || n === b.nth) drafts.push({ slot: `ab:${b.id}`, type: 'Bonus', what: `${b.desc} (${ag.name})${b.when === 'Every enrolment' ? '' : `: enrolment ${b.nth}`}`, rpWhat: `Bonus: ${b.desc}`, amount: b.amount, trigger: first()?.trigger ?? e.enrolled });
      });
      drafts.forEach((d) => {
        rpDone.add(lineKey(e.app, 'rp', d.slot));
        rpTxs.push(...chain('rp', d.slot, d));
      });
    }
    rpTxs.push(...leftovers('rp', rpDone));
    rpTxs.forEach((t) => statusRp(t, ag ? termsAt<AgreementTerms>(ag, startOf(e)).payDays : 0));
    function statusRp(t: Tx, payDaysRp: number) {
      const fr = state.frozen[t.id];
      const inv = rpInv.get(t.id);
      const anchor = (t.matches ? uniTxs.find((x) => x.id === t.matches) : undefined) ?? first();
      if (!fr?.final) t.due = inv?.state === 'Accepted' && inv.decided ? addDays(iso(inv.decided.at), payDaysRp) : anchor?.due ? addDays(anchor.due, payDaysRp) : '';
      t.base.due = t.due;
      if (!fr) t.trigger = anchor?.trigger ?? t.trigger;
      t.invoice = inv?.file.name;
      t.rpInvoice = inv?.id ?? sentBack.get(t.id)?.id;
      t.requested = requestedOn.get(t.id);
      const o = over.get(t.id);
      if (o && !fr?.final) Object.assign(t, { override: o, amount: o.amount ?? t.amount, due: o.due ?? t.due });
      t.status = rpStatus({ uni: anchor?.status, paid: paidRp.has(t.id), hold: !!o?.hold, invoice: inv?.state, sentBack: sentBack.has(t.id) });
    }
    function first() {
      return uniTxs.find((t) => t.type === 'Course commission' && !t.adjusts) ?? uniTxs.find((t) => !t.adjusts);
    }
    const clean = (t: Tx & { _base?: number }): Tx => {
      const { _base: _b, ...rest } = t;
      return rest;
    };
    const U = uniTxs.map(clean);
    const R = rpTxs.map(clean);
    out.push(...U, ...R);
    const item = (side: Side, txs: Tx[], note?: string): Item => {
      const totals: Record<string, number> = {};
      const settled: Record<string, number> = {};
      txs.forEach((t) => {
        if (t.status === 'Not payable') return;
        totals[t.currency] = round2((totals[t.currency] ?? 0) + t.amount, t.currency);
        if (t.status === 'Paid') settled[t.currency] = round2((settled[t.currency] ?? 0) + t.amount, t.currency);
      });
      return { app: e.app, side, label: SIDES[side], totals, settled, txs, note };
    };
    apps.push({ app: e.app, student: e.student, rp: e.rp, uni: u.id, uniName: u.name, course: c.name, intake: e.intake, enrolled: e.enrolled, withdrawn: e.withdrawn, uniItem: item('uni', U, uniNote), rpItem: item('rp', R, rpNote) });
  }
  return { txs: out, apps, byId: new Map(out.map((t) => [t.id, t])), byApp: new Map(apps.map((a) => [a.app, a])), needIds: [...new Set(needIds)].sort() };
}

/**
 * Where an RP stands in its agreement's bands today (Jovial, 10 Nov, Q43), for Earnings' band tile: its payable
 * students in the agreement's current window (by intake start), the band's share, and how many more reach the next.
 * Null: a flat share, or no commission record.
 */
export function bandStanding(state: CommState, ctx: Ctx, rp: string, extra: Enrolment[] = []): { count: number; share: number; window: string; next?: { more: number; share: number } } | null {
  const today = ctx.today;
  const ag = agreementOn(state, rp, today);
  if (!ag) return null;
  const A = termsAt<AgreementTerms>(ag, today);
  if (A.shareType === 'Flat' || !A.bands.length) return null;
  const seen = new Set<string>();
  const all = [...extra, ...state.enrolments].filter((e) => (seen.has(e.app) ? false : (seen.add(e.app), true)));
  const S = state.settings;
  const key = (d: string, intake?: string) => (A.countedPer === 'Intake' ? `i:${intake}` : A.countedPer === 'Financial year' ? `f:${fyOf(d, S.fyStart)}` : `c:${yearOf(d)}`);
  const mine = all.filter((x) => x.rp === rp && !x.withdrawn);
  const latest = [...mine].sort((a, b) => startOf(b).localeCompare(startOf(a)))[0];
  const now = A.countedPer === 'Intake' ? key('', latest?.intake) : key(today);
  const count = mine.filter((x) => key(startOf(x), x.intake) === now).length;
  const band = bandFor(A.bands, Math.max(1, count));
  const nextBand = A.bands.find((b) => b.from > count && b.pct > band.pct);
  const window = A.countedPer === 'Intake' ? `the ${latest?.intake ?? 'current'} intake` : A.countedPer === 'Financial year' ? `GSP’s financial year ${fyOf(today, S.fyStart)}–${String((fyOf(today, S.fyStart) + 1) % 100).padStart(2, '0')}` : yearOf(today).toString();
  return { count, share: band.pct, window, next: nextBand ? { more: nextBand.from - count, share: nextBand.pct } : undefined };
}

/** Acted on: invoiced (University → GSP), its invoice requested (GSP → RP), or paid. From then on it's kept as it was. */
export const actedOn = (state: CommState, t: Pick<Tx, 'id' | 'side'>) =>
  t.side === 'uni' ? state.invoices.some((i) => i.txs.includes(t.id)) || state.receipts.some((r) => r.txs.includes(t.id)) : state.requests.some((r) => r.txs.includes(t.id)) || state.rpPayments.some((p) => p.txs.includes(t.id));
const paidOf = (state: CommState, t: Pick<Tx, 'id' | 'side'>) => (t.side === 'uni' ? state.receipts : state.rpPayments).some((r) => r.txs.includes(t.id));

/**
 * What must be kept from a work-out (Jovial, 9 Nov): an ID for each line that has none yet, given once, in order;
 * each line acted on, as it was then; and, once Paid, as paid. Returns the state unchanged when there's nothing to keep.
 */
export function settle(state: CommState, res: Result, at = Date.now()): CommState {
  let ids = state.ids;
  let seq = state.idSeq;
  const fresh = res.needIds.filter((k) => !state.ids[k]);
  if (fresh.length) {
    ids = { ...state.ids };
    fresh.forEach((k) => (ids[k] = idText(++seq)));
  }
  let frozen = state.frozen;
  res.txs.forEach((t) => {
    if (isNewId(t.id) || !actedOn(state, t)) return;
    const was = frozen[t.id];
    const paid = paidOf(state, t);
    if (was && (was.final || !paid)) return;
    if (frozen === state.frozen) frozen = { ...state.frozen };
    frozen[t.id] = was
      ? { ...was, amount: t.amount, due: t.due, final: true }
      : { key: t.key, app: t.app, side: t.side, type: t.type, what: t.what, rpWhat: t.rpWhat, base: t.base.amount, amount: t.amount, currency: t.currency, due: t.due, trigger: t.trigger, period: t.period, matches: t.matches, notice: t.notice, adjusts: t.adjusts, final: paid || undefined, at };
  });
  return ids === state.ids && frozen === state.frozen ? state : { ...state, ids, idSeq: seq, frozen };
}
/** Work out and keep until nothing more is to be kept (a new ID can make a line that then needs keeping). */
export function settleAll(state: CommState, ctx: Ctx, extra: Enrolment[] = []): CommState {
  let s = state;
  for (let i = 0; i < 5; i++) {
    const next = settle(s, compute(s, ctx, extra));
    if (next === s) return s;
    s = next;
  }
  return s;
}

/** A University → GSP line's status, from what's happened to it and today. A line with no trigger date yet is Expected. */
export function uniStatus(t: Pick<Tx, 'trigger' | 'due'>, o: { withdrawn?: string; paid: boolean; part?: boolean; invoiced: boolean; hold: boolean; today: string }): UniStatus {
  if (o.paid) return 'Paid';
  if (o.withdrawn && (!t.trigger || o.withdrawn < t.trigger)) return 'Not payable';
  if (o.hold) return 'Held';
  if (o.part) return 'Part paid';
  if (o.invoiced) return t.due && o.today > t.due ? 'Overdue' : 'Invoiced';
  return t.trigger && t.trigger <= o.today ? 'Ready to invoice' : 'Expected';
}
/**
 * A GSP → RP line's status (Q50): it can't be Ready to invoice until GSP has its money for the matching University →
 * GSP line (all of it, or part of it: then the line is the RP's share of what came in).
 */
export function rpStatus(o: { uni?: TxStatus; paid: boolean; hold: boolean; invoice?: RpInvoice['state']; sentBack?: boolean }): RpStatus {
  if (o.paid) return 'Paid';
  if (o.uni === 'Not payable' || !o.uni) return 'Not payable';
  if (o.hold) return 'On hold';
  if (o.uni === 'Expected') return 'Expected';
  if (o.uni !== 'Paid' && o.uni !== 'Part paid') return 'Waiting for university';
  if (o.invoice === 'Accepted') return 'Approved';
  if (o.invoice === 'To check') return 'Invoice in review';
  if (o.sentBack) return 'Sent back';
  return 'Ready to invoice';
}

/** Adds money by currency: "AUD 2,000 + GBP 300". */
export const totalsText = (m: Record<string, number>) => (Object.keys(m).length ? Object.entries(m).map(([c, n]) => money(n, c)).join(' + ') : '—');
export const sumBy = (txs: Pick<Tx, 'amount' | 'currency'>[]) => txs.reduce<Record<string, number>>((m, t) => ((m[t.currency] = round2((m[t.currency] ?? 0) + t.amount, t.currency)), m), {});

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

export type CommNote = { id: string; to: 'rp' | 'finance'; rp: string; code: 'N16' | 'N17' | 'N18' | 'N19' | 'N20' | 'N21' | 'N22'; title: string; text: string; at: number };
const at9 = (d: string) => Date.parse(`${d}T09:00:00`);
/**
 * The notifications the records make (bell and email): N16 to the RP when its invoice is asked for, N17 to Finance
 * when an RP sends one, N18 when GSP pays; and (Jovial, 10 Nov) N21 when an RP's invoice is sent back, with the reason,
 * N22 when it's approved (Q54); reminders (Q47, days from Settings, no escalation): N19 to the RP while lines it was
 * asked to invoice still aren't on an invoice, N20 to Finance while a University → GSP line is past due and not paid.
 */
export function commNotes(state: CommState, res: Result, rpName: (id: string) => string, today = new Date().toISOString().slice(0, 10)): CommNote[] {
  const total = (ids: string[]) => totalsText(sumBy(ids.map((i) => res.byId.get(i)).filter((x): x is Tx => !!x)));
  const R = state.settings.reminders ?? { rpInvoice: [], uniPayment: [] };
  const rpReminders = state.requests.flatMap((r) => {
    const open = r.txs.filter((t) => ['Ready to invoice', 'Sent back'].includes(res.byId.get(t)?.status ?? ''));
    if (!open.length) return [];
    return R.rpInvoice
      .map((d) => addDays(r.date, d))
      .filter((d) => d <= today)
      .map((d, i): CommNote => ({ id: `n19-${r.id}-${i}`, to: 'rp', rp: r.rp, code: 'N19', title: 'Reminder: send your invoice to GSP', text: `${open.length} ${open.length === 1 ? 'line' : 'lines'}, ${total(open)}, asked for on ${dayText(r.date)}. Upload it on Earnings.`, at: at9(d) }));
  });
  const uniReminders = res.txs
    .filter((t) => t.side === 'uni' && t.due && ['Invoiced', 'Overdue', 'Part paid'].includes(t.status))
    .flatMap((t) =>
      R.uniPayment
        .map((d) => addDays(t.due, d))
        .filter((d) => d <= today)
        .map((d, i): CommNote => ({ id: `n20-${t.id}-${i}`, to: 'finance', rp: t.rp, code: 'N20', title: `${t.uniName} hasn’t paid ${t.id}`, text: `${money(roundMoneyOf(t), t.currency)} ${t.invoice ? `on invoice ${t.invoice}` : ''}, due ${dayText(t.due)}. Chase it with the university.`.replace('  ', ' '), at: at9(d) })),
    );
  return [
    ...state.requests.map((r): CommNote => ({ id: `n16-${r.id}`, to: 'rp', rp: r.rp, code: 'N16', title: 'GSP is ready to pay you: send your invoice', text: `${r.txs.length} ${r.txs.length === 1 ? 'line' : 'lines'}, ${total(r.txs)}. Download GSP’s invoice on Earnings, or upload your own.`, at: r.at })),
    ...state.rpInvoices.map((i): CommNote => ({ id: `n17-${i.id}`, to: 'finance', rp: i.rp, code: 'N17', title: `${rpName(i.rp)} sent an invoice for ${i.txs.length} ${i.txs.length === 1 ? 'line' : 'lines'}`, text: `${i.file.name}: ${total(i.txs)}. Check it on Commission lines.`, at: i.at })),
    ...state.rpInvoices
      .filter((i) => i.state === 'Sent back' && i.decided)
      .map((i): CommNote => ({ id: `n21-${i.id}`, to: 'rp', rp: i.rp, code: 'N21', title: `GSP sent back your invoice ${i.file.name}`, text: `${i.reason ?? ''} Upload a new invoice on Earnings for ${i.txs.length} ${i.txs.length === 1 ? 'line' : 'lines'}, ${total(i.txs)}.`.trim(), at: i.decided!.at })),
    ...state.rpInvoices
      .filter((i) => i.state === 'Accepted' && i.decided)
      .map((i): CommNote => ({ id: `n22-${i.id}`, to: 'rp', rp: i.rp, code: 'N22', title: `GSP approved your invoice ${i.file.name}`, text: `${i.txs.length} ${i.txs.length === 1 ? 'line' : 'lines'}, ${total(i.txs)}. GSP pays it next.`, at: i.decided!.at })),
    ...state.rpPayments.map((p): CommNote => ({ id: `n18-${p.id}`, to: 'rp', rp: p.rp, code: 'N18', title: `GSP paid you ${total(p.txs)}`, text: `${p.txs.length} ${p.txs.length === 1 ? 'line' : 'lines'}, paid on ${dayText(p.date)}.`, at: p.at })),
    ...rpReminders,
    ...uniReminders,
  ].sort((a, b) => b.at - a.at);
}
const roundMoneyOf = (t: Pick<Tx, 'amount' | 'received' | 'currency'>) => round2(t.amount - (t.received ?? 0), t.currency);
