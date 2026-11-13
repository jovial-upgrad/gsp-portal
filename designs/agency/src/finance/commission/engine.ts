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
import type { Agreement, AgreementTerms, Band, CommState, Destination, Enrolment, Exc, ExceptionType, Frozen, Level, Notice, Override, RpInvoice, RpStatus, RpView, Side, Step, TermsBody, TxStatus, TxType, UniCountedPer, UniGroup, UniStatus, UniTerms } from './model';
import { EXCEPTIONS, PAY_UNITS, RP_ESTIMATE, SIDES, TRIGGERS, dayText, money, pct, roundMoney } from './model';
import { bandIndex, bonusAmount, keepMonth, bonusWindow, condTest, periodsOf, pickRate, regionCovers, rowLabel, step, tierOfGroup, tierOfTerms, unreadableRows, windowEnd, windowKey, windowWords, type TierSpec, type Who } from './pricing';

/* ---------- context: what the engine reads from other modules ---------- */

/** A university, with its institution partner's agreement dates (earliest start to latest end of its agreement documents). */
export type CtxUni = { id: string; name: string; country: Destination; ip?: string; agreement?: { start: string; end: string } | null };
/** An RP: its sales region, and its status (a Suspended RP's commission is held: D23). */
export type CtxRp = { id: string; name: string; code: string; country: string; region: string; status?: string };
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
/** How many study periods a course has under a university's pay unit (a date for each, filled in by Admissions); per unit and fee payments: none fixed. */
export const periodCount = (T: Pick<TermsBody, 'payUnit'> | undefined, months: number) => {
  const per = PAY_UNITS.find((x) => x.label === T?.payUnit)?.per ?? 1;
  return per ? Math.max(1, Math.ceil((months / 12) * per - 1e-9)) : 0;
};

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
  /** The study period it's for (1 on), when it's course commission or its adjustment or top-up; `year`: the year of the course it falls in. */
  period?: number;
  year?: number;
  /** How it's worked out (GSP's views only: the sandbox's trace). */
  trace?: Step[];
  /** GST on GSP's invoice to the university (C6), for a University → GSP line. */
  gst?: number;
  /** Why it's held: an exception, or a suspended RP. */
  heldWhy?: string;
  /** A study period after the first waits for Finance to confirm the student continues (D19). */
  toConfirm?: boolean;
  /** Its trigger date is estimated (no census date on the application: start + fallback weeks). */
  estimated?: boolean;
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
  /** A recovery: how much has been set off so far (Q123); the rest is still To recover. */
  recovered?: number;
  /** A recovery: GSP's debit note asking the RP to pay it back (Q118). */
  debitNote?: string;
  writtenOff?: number;
  short?: string;
  /** GSP → RP: the day GSP asked the RP for its invoice. */
  requested?: string;
  /** Its claim window (R105): the last day it can be claimed (GSP's invoice to the university, or the RP's to GSP), and whether that has passed while it's still unclaimed. Finance only; nothing closes. */
  claimEnds?: string;
  claimLapsed?: boolean;
  /** A clawback (University → GSP) or a recovery (GSP → RP): the line clawed back (R106). */
  claws?: string;
  /** GSP → RP: the RP is shown this line (its record's view, or Settings'; Jovial, 11 Nov). GSP sees every line. */
  rpSees?: boolean;
  /** GSP → RP: a kind of line the RP is shown (whatever the study period): one it can be asked to invoice. */
  rpKind?: boolean;
};
export type Item = { app: string; side: Side; label: string; totals: Record<string, number>; settled: Record<string, number>; txs: Tx[]; note?: string };
/** Where an application stands in a count: its tier (university or group), or a bonus scheme's progress. */
export type Standing = { who: 'university' | 'group'; name: string; rank: number; total: number; band: number; pct: number; window: string; retro: boolean; ends: string };
export type Progress = { name: string; have: number; need: number };
export type AppLines = {
  app: string;
  student: string;
  rp: string;
  uni: string;
  uniName: string;
  course: string;
  intake: string;
  enrolled: string;
  withdrawn?: string;
  uniItem: Item;
  rpItem: Item;
  /** The terms used (the version in force on the intake start), its tiers, and bonus progress (GSP's views). */
  terms?: string;
  tiers: Standing[];
  progress: Progress[];
  exceptions: Exc[];
  /** This application's terms in a few fields, for the top of its Commission tab (Deepesh, 10 Nov). */
  summary: AppSummary;
};
/**
 * The terms behind an application's lines, as the engine used them: the fee, how the university pays, its rate on the
 * first study period (and the tier above it), and the RP's share of GSP's base lines. GSP's rate and amounts are GSP's
 * only; the RP is shown its fee, periods and its own terms (`rpTerms`).
 */
export type AppSummary = {
  currency: string;
  fee?: number;
  scholarship?: number;
  feeBasis?: string;
  payUnit?: string;
  chargeable?: string;
  trigger?: string;
  periods?: number;
  uniRate?: string;
  uniRateWhy?: string;
  rpShare?: string;
  rpShareWhy?: string;
  rpTerms?: string;
  rpLater?: string;
};
export type Result = {
  txs: Tx[];
  apps: AppLines[];
  byId: Map<string, Tx>;
  byApp: Map<string, AppLines>;
  /** Lines that need an ID (their keys), for `settle`. */
  needIds: string[];
  /** What couldn't be priced safely (D10, D11): the Exceptions list. */
  exceptions: Exc[];
  /** Each university and group tier and bonus scheme, in its counting windows still open: what more enrolments unlock. */
  unlocks: Unlock[];
};
/**
 * What the next enrolments unlock with a university (Jovial, 13 Nov, for Finance): one tier (a university's own or its
 * group's) or one bonus scheme, in one counting window (and source country, when it counts per country). Its count, its
 * bands with how many more reach each, and who the counted students are, by course level, sales region, source country
 * and course. Worked out from the same pool the lines are priced on.
 */
export type Unlock = {
  id: string;
  kind: 'Tier' | 'Bonus scheme';
  who: 'university' | 'group';
  name: string;
  unis: string[];
  window: string;
  country?: string;
  ends: string;
  retro: boolean;
  levels: Level[];
  currency: string;
  count: number;
  bands: { from: number; to: number | null; label: string; more: number; now: boolean }[];
  by: { level: Record<string, number>; region: Record<string, number>; country: Record<string, number>; course: Record<string, number> };
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
export const noticeStatus = (n: Pick<Notice, 'starts' | 'ends' | 'issued'>, today: string) => (!n.issued ? 'Waiting for RP Ops to issue' : today < n.starts ? 'Upcoming' : today > n.ends ? 'Ended' : 'Active');
/**
 * A notice covers an enrolment: one of its RPs (none listed: every RP in its sales regions), enrolled in its period (and
 * in one of its intake months, when it names some), and a course it applies to (empty: every course).
 */
export const noticeCovers = (n: Notice, e: Enrolment, uni: CtxUni, level: Level, rp?: Pick<CtxRp, 'region'>, groups: Record<string, string[]> = {}) => {
  // not issued by RP Ops yet (R103): it applies to nobody
  if (!n.issued) return false;
  const listed = n.rps.length > 0;
  // an RP taken off a notice keeps it for enrolments before that day (Q65)
  const who = listed ? n.rps.includes(e.rp) || (n.removed ?? []).some((r) => r.rp === e.rp && e.enrolled < r.on) : !!rp && (n.regions ?? []).some((g) => g === rp.region || regionCovers({ regionGroups: groups }, g, rp.region));
  const month = startOf(e).slice(0, 7);
  return who && e.enrolled >= n.starts && e.enrolled <= n.ends && (!(n.intakes ?? []).length || n.intakes!.includes(month)) && (!n.dests.length || n.dests.includes(uni.country)) && (!n.unis.length || n.unis.includes(uni.id)) && (!n.levels.length || n.levels.includes(level));
};
/** What the application still needs from Admissions before commission can be worked out (empty: nothing). */
export function feesMissing(e: Pick<Enrolment, 'fees'>, terms?: Pick<TermsBody, 'trigger' | 'payUnit'>): string[] {
  const f = e.fees;
  const trig = TRIGGERS.find((t) => t.label === terms?.trigger);
  return [
    ...(f?.tuition == null && terms?.payUnit !== 'Per unit' && terms?.payUnit !== 'Each fee payment' ? ['tuition fee'] : []),
    ...(f?.scholarship == null ? ['scholarship'] : []),
    ...(!f?.start ? ['course start date'] : []),
    // study period 1's trigger date, unless the day of enrolment, the withdrawal deadline (start + weeks) or a census
    // date (blank: start + Settings' fallback weeks, shown as estimated: Q69 as the sandbox does it)
    ...(trig && trig.field === 'paid' && terms?.trigger !== 'Withdrawal deadline' && !f?.[trig.field]?.[0] ? [trig.date.toLowerCase()] : []),
  ];
}

/* ---------- the engine ---------- */

type Draft = { slot: string; type: TxType; what: string; rpWhat: string; amount: number; trigger: string; due?: string; period?: number; year?: number; matches?: string; notice?: string; currency?: string; trace?: Step[]; estimated?: boolean; credit?: string };
const HOLDS = new Set<string>(EXCEPTIONS.filter((x) => x.hold).map((x) => x.type));

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
  const paidOn = new Map<string, string>();
  [...state.receipts].sort((a, b) => a.at - b.at).forEach((r) =>
    r.txs.forEach((t) => {
      if (!paidOn.has(t)) paidOn.set(t, r.date);
      if (!r.paid || r.paid[t] == null) return void fullyPaid.add(t);
      received.set(t, (received.get(t) ?? 0) + r.paid[t]);
      if (r.short?.[t]) shortWhy.set(t, r.short[t]);
    }),
  );
  const writtenOff = new Map((state.writeOffs ?? []).map((w) => [w.tx, w]));
  const paidRp = new Set(state.rpPayments.flatMap((r) => r.txs));
  // Q123: how much of each recovery the payments set off (a payment that lists one without an amount took all of it)
  const recoveredOf = new Map<string, number>();
  state.rpPayments.forEach((p) => p.txs.forEach((t) => recoveredOf.set(t, (recoveredOf.get(t) ?? 0) + (p.recovered?.[t] ?? Infinity))));
  const debitOf = new Map((state.debitNotes ?? []).flatMap((d) => d.txs.map((t) => [t, d.number] as const)));
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
  const confirmed = new Set((state.confirms ?? []).map((c) => `${c.app}|${c.period}`));
  const frozenByApp = new Map<string, Frozen[]>();
  Object.entries(state.frozen).forEach(([, f]) => frozenByApp.set(f.app, [...(frozenByApp.get(f.app) ?? []), f]));
  const needIds: string[] = [];
  const idOf = (key: string) => state.ids[key] ?? (needIds.push(key), `${NEW}${key}`);
  const courseOf = (e: Enrolment) => ctx.course(e.course);
  const groups: UniGroup[] = state.groups ?? [];
  const groupOf = (uni: string) => groups.find((g) => g.members.includes(uni));
  const termsOfUni = (uni: string, day: string) => {
    const tr = state.terms.find((t) => t.uni === uni);
    return tr ? termsAt<TermsBody>(tr as UniTerms, day) : undefined;
  };
  const exceptions: Exc[] = [];

  /* ---------- pass 1: each enrolment's terms, inputs and study periods ---------- */
  type Pre = { e: Enrolment; cur: string; uni: CtxUni; level: Level; months: number; course: string; T?: TermsBody; who: Who; periods: ReturnType<typeof periodsOf>['periods']; dropped: number; trig1: string; exc: Exc[]; missing: string[] };
  const pre = new Map<string, Pre>();
  for (const e of all) {
    const c = courseOf(e);
    const u = c ? uniOf.get(c.uni) : undefined;
    if (!c || !u) continue;
    const T = termsOfUni(u.id, startOf(e));
    const who: Who = { level: c.level, course: c.name, campus: e.fees?.campus, nationality: e.nationality, start: startOf(e) };
    const exc: Exc[] = [];
    const add = (type: ExceptionType, text: string) => exc.push({ app: e.app, type, text, hold: HOLDS.has(type) });
    const missing = feesMissing(e, T);
    let periods: Pre['periods'] = [];
    let dropped = 0;
    if (!T) add('No terms', `No commission terms for ${u.name} yet. Finance adds them in Setup.`);
    else if (!missing.length) {
      const pr = periodsOf(T, e, c.months, S);
      periods = pr.periods;
      dropped = pr.dropped;
      if (pr.missing.includes('units')) add('Units missing', `${u.name} pays per unit of study, but the application lists no units. Admissions adds them from the enrolment statement.`);
      pr.warn.forEach((w) => add('Credit points missing', `${u.name} ${w}. Admissions adds the points from the offer letter.`));
      const ag = u.agreement;
      if (ag?.start && startOf(e) < ag.start) add('Agreement not yet in force', `${u.name}’s agreement starts ${dayText(ag.start)}; this intake (${dayText(startOf(e))}) is before it. Held until Finance confirms which terms apply.`);
      if (ag?.end && startOf(e) > ag.end) add('Contract ended', `${u.name}’s agreement ended ${dayText(ag.end)}. Enrolments after that are held until a renewal is entered.`);
      if (u.country === 'Australia' && !e.fees?.studentType) add('Student type missing', 'Student type (new, progression or transfer) is needed for Australian universities. Admissions adds it in Key details.');
      unreadableRows(T).forEach((x) => add('Rate row unreadable', `${u.name}: ${rowLabel(x, c.currency)} has “:” or “=” in a value, so it matches no student. Write it as course=Nursing; region=Bangladesh : 5000.`));
      const anyRate = periods.some((q) => pickRate(T, who, q.k, S).best);
      if (periods.length && !anyRate) add('Rate missing', `${u.name} has no rate for ${c.level}${c.name ? ` (${c.name})` : ''}. Add it to the university’s terms.`);
    }
    const cur = T?.currency || c.currency;
    const trig = TRIGGERS.find((t) => t.label === T?.trigger) ?? TRIGGERS[0];
    const trig1 = periods[0]?.date ?? (trig.field === 'confirmed' ? e.enrolled : e.fees?.[trig.field]?.[0] ?? '');
    pre.set(e.app, { e, cur, uni: u, level: c.level, months: c.months, course: c.name, T, who, periods, dropped, trig1, exc, missing });
  }
  /** A student GSP will be paid for (Q43, Q55): not withdrawn before study period 1's trigger date. */
  const payable = (x: Enrolment) => {
    const t = pre.get(x.app)?.trig1;
    return !x.withdrawn || (!!t && x.withdrawn >= t);
  };
  /** Counting order (Q43): by intake start, then enrolment date. */
  const before = (x: Enrolment, e: Enrolment) => {
    const a = startOf(x), b = startOf(e);
    return a < b || (a === b && (x.enrolled < e.enrolled || (x.enrolled === e.enrolled && x.app <= e.app)));
  };
  // an enrolment's place among the payable ones counted together (1 = the first)
  const ordinal = (e: Enrolment, same: (x: Enrolment) => boolean) => all.filter((x) => same(x) && payable(x) && before(x, e)).length;
  /** The window a day falls in for an RP count: the year as the agreement counts it, the intake, or two intakes. */
  const windowOf = (x: Enrolment, per: string, yearStart: number) => windowKey(per as never, startOf(x), yearStart || 1, S.fyStart, x.intake);

  /* ---------- pass 2: tiers (the university's own and its group's), on the intake start ---------- */
  const standing = (spec: TierSpec, e: Enrolment) => {
    const p = pre.get(e.app)!;
    const keyOf = (x: Enrolment) => windowKey(spec.countedPer, startOf(x), spec.yearStart, S.fyStart, x.intake) + (spec.perCountry ? ` · ${x.nationality ?? '—'}` : '');
    const k0 = keyOf(e);
    const pool = all
      .filter((x) => {
        const px = pre.get(x.app);
        return !!px?.T && spec.members.includes(px.uni.id) && (!spec.levels.length || spec.levels.includes(px.level)) && keyOf(x) === k0 && payable(x);
      })
      .sort((x, y) => (before(x, y) ? -1 : 1));
    const rank = pool.findIndex((x) => x.app === e.app) + 1;
    const total = pool.length;
    const useN = spec.retro ? total : rank;
    const bi = bandIndex(spec.bands, Math.max(1, useN));
    const setter = spec.retro ? pool[total - 1] : e;
    const end = windowEnd(spec.countedPer, startOf(e), spec.yearStart, S.fyStart) || pool.reduce((m, x) => ((pre.get(x.app)?.trig1 ?? '') > m ? pre.get(x.app)!.trig1 : m), p.trig1);
    return { spec, rank, total, bi, pct: spec.bands[bi].pct, key: k0, setDate: setter ? pre.get(setter.app)?.trig1 ?? '' : '', end, pool };
  };
  const tiersOf = new Map<string, ReturnType<typeof standing>[]>();
  for (const e of all) {
    const p = pre.get(e.app);
    if (!p?.T || !payable(e)) continue;
    const list: ReturnType<typeof standing>[] = [];
    const own = tierOfTerms(p.T, p.uni.id, p.uni.name);
    const g = groupOf(p.uni.id);
    if (own && (!own.levels.length || own.levels.includes(p.level))) list.push(standing(own, e));
    const gt = g && tierOfGroup(g);
    if (gt && (!gt.levels.length || gt.levels.includes(p.level))) list.push(standing(gt, e));
    tiersOf.set(e.app, list);
  }

  /* ---------- what the next enrolments unlock (Jovial, 13 Nov): every tier and bonus scheme, its open windows ---------- */
  const unlocks: Unlock[] = [];
  {
    const splitOf = (xs: Enrolment[]) => {
      const add = (m: Record<string, number>, k: string) => ((m[k] = (m[k] ?? 0) + 1), m);
      const by = { level: {} as Record<string, number>, region: {} as Record<string, number>, country: {} as Record<string, number>, course: {} as Record<string, number> };
      xs.forEach((x) => {
        const px = pre.get(x.app)!;
        add(by.level, px.level);
        add(by.region, rpOf.get(x.rp)?.region || '—');
        add(by.country, x.nationality || '—');
        add(by.course, courseOf(x)?.name ?? x.course);
      });
      return by;
    };
    /** Windows still counting: one that ends today or later; for an intake, the two latest. */
    const open = (groups: Map<string, Enrolment[]>, per: UniCountedPer, yearStart: number) => {
      const ent = [...groups.entries()].map(([k, xs]) => ({ k, xs, end: windowEnd(per, startOf(xs[0]), yearStart, S.fyStart), last: xs.reduce((m, x) => (startOf(x) > m ? startOf(x) : m), '') }));
      if (per === 'Intake') {
        const latest = [...new Set(ent.sort((a, b) => b.last.localeCompare(a.last)).map((x) => x.k.split(' · ')[0]))].slice(0, 2);
        return ent.filter((x) => latest.includes(x.k.split(' · ')[0]));
      }
      return ent.filter((x) => x.end >= today);
    };
    const specs = new Map<string, { spec: TierSpec; cur: string; bonus: { B: TermsBody['bonus'][number]; per: UniCountedPer; T: TermsBody; uni: string }[] }>();
    for (const e of all) {
      const p = pre.get(e.app);
      if (!p?.T) continue;
      const own = tierOfTerms(p.T, p.uni.id, p.uni.name);
      const g = groupOf(p.uni.id);
      const gt = g ? tierOfGroup(g) : null;
      const k1 = `u:${p.uni.id}`, k2 = g ? `g:${g.id}` : '';
      if (!specs.has(k1)) specs.set(k1, { spec: own ?? { who: 'university', name: p.uni.name, members: [p.uni.id], bands: [], countedPer: p.T.countedPer ?? 'Calendar year', yearStart: p.T.yearStart ?? 1, retro: false, perCountry: false, levels: [], bandBonuses: [] }, cur: p.cur, bonus: (p.T.bonus ?? []).filter((B) => B.per !== 'Per student').map((B) => ({ B, per: bonusWindow(B, p.T!), T: p.T!, uni: p.uni.id })) });
      if (g && k2 && !specs.has(k2)) specs.set(k2, { spec: gt ?? { who: 'group', name: g.name, members: g.members, bands: [], countedPer: g.countedPer ?? 'Calendar year', yearStart: g.yearStart ?? 1, retro: false, perCountry: false, levels: [], bandBonuses: [] }, cur: p.cur, bonus: (g.bonus ?? []).filter((B) => B.per !== 'Per student').map((B) => ({ B, per: bonusWindow(B, p.T!), T: p.T!, uni: p.uni.id })) });
    }
    specs.forEach(({ spec, cur, bonus }, sk) => {
      const inSpec = (x: Enrolment) => {
        const px = pre.get(x.app);
        return !!px?.T && spec.members.includes(px.uni.id) && payable(x);
      };
      if (spec.bands.length) {
        const keyOf = (x: Enrolment) => windowKey(spec.countedPer, startOf(x), spec.yearStart, S.fyStart, x.intake) + (spec.perCountry ? ` · ${x.nationality ?? '—'}` : '');
        const groups = new Map<string, Enrolment[]>();
        all.filter((x) => inSpec(x) && (!spec.levels.length || spec.levels.includes(pre.get(x.app)!.level))).forEach((x) => groups.set(keyOf(x), [...(groups.get(keyOf(x)) ?? []), x]));
        open(groups, spec.countedPer, spec.yearStart).forEach(({ k, xs, end }) => {
          const n = xs.length;
          const bi = bandIndex(spec.bands, Math.max(1, n));
          unlocks.push({
            id: `${sk}:tier:${k}`, kind: 'Tier', who: spec.who, name: spec.name, unis: spec.members, window: k.split(' · ')[0], country: spec.perCountry ? k.split(' · ')[1] : undefined, ends: end, retro: spec.retro, levels: spec.levels, currency: cur, count: n,
            bands: spec.bands.map((b, i) => {
              const bb = spec.bandBonuses.find((x) => x.band === i + 1);
              return { from: b.from, to: b.to, label: `${pct(b.pct)}${bb?.value ? ` + ${bb.kind === '%' ? `${pct(bb.value)} bonus` : `${money(bb.value, cur)} bonus`} per student` : ''}`, more: Math.max(0, b.from - n), now: i === bi };
            }),
            by: splitOf(xs),
          });
        });
      }
      bonus.forEach(({ B, per, T }) => {
        const keyOf = (x: Enrolment) => windowKey(per, startOf(x), T.yearStart ?? 1, S.fyStart, x.intake) + (B.perCountry ? ` · ${x.nationality ?? '—'}` : '');
        const groups = new Map<string, Enrolment[]>();
        all.filter((x) => inSpec(x) && !condTest(B.cond, pre.get(x.app)!.who, S).length).forEach((x) => groups.set(keyOf(x), [...(groups.get(keyOf(x)) ?? []), x]));
        open(groups, per, T.yearStart ?? 1).forEach(({ k, xs, end }) => {
          const n = xs.length;
          const val = (kind: typeof B.kind, v: number) => (kind === '%' ? `${pct(v)} of the first-year fee` : money(v, cur));
          const bands =
            B.per === 'At a number'
              ? [{ from: B.threshold ?? 0, to: null, label: `${val(B.kind, B.value)}, once`, more: Math.max(0, (B.threshold ?? 0) - n), now: n >= (B.threshold ?? 0) }]
              : B.bands.map((b) => ({ from: b.from, to: b.to, label: `${val(b.kind, b.value)} per student`, more: Math.max(0, b.from - n), now: n >= b.from && (b.to === null || n <= b.to) }));
          unlocks.push({ id: `${sk}:bonus:${B.id}:${k}`, kind: 'Bonus scheme', who: spec.who, name: `${spec.who === 'group' ? `${spec.name}: ` : ''}${B.name}`, unis: spec.members, window: k.split(' · ')[0], country: B.perCountry ? k.split(' · ')[1] : undefined, ends: end, retro: B.retro, levels: [], currency: cur, count: n, bands, by: splitOf(xs) });
        });
      });
    });
  }

  const out: Tx[] = [];
  const apps: AppLines[] = [];
  for (const e of all) {
    const p = pre.get(e.app);
    if (!p) continue;
    const c = courseOf(e)!;
    const u = p.uni;
    const rp = rpOf.get(e.rp);
    const cur = p.cur;
    const base = { app: e.app, student: e.student, rp: e.rp, rpName: rp?.name ?? e.rp, region: rp?.region ?? '', uni: u.id, uniName: u.name, course: c.name, level: c.level, intake: e.intake, currency: cur };
    const frozenHere = frozenByApp.get(e.app) ?? [];
    const exc = [...p.exc];
    const addExc = (type: ExceptionType, text: string) => exc.push({ app: e.app, type, text, hold: HOLDS.has(type) });

    /**
     * A slot's lines: the line as worked out, or, once it's frozen, as it was, then its frozen adjustments and one
     * open Adjustment for whatever the worked-out amount now differs by. `d` undefined: the slot isn't worked out any
     * more (its notice or additional commission went), so the frozen lines stay and an Adjustment takes them back.
     * An override's amount on a frozen line is a difference too (D16): it becomes an Adjustment, the line stays.
     * A credit (a negative Adjustment from a tier recount) counts from the end of the counting period (Q68).
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
        year: x.year,
        matches: x.matches,
        notice: x.notice,
        currency: x.currency ?? cur,
        frozen: !!f,
        trace: f?.trace ?? x.trace,
        estimated: x.estimated,
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
      // compare like with like: the line as it would be rounded now against what was kept (no 0.01 ghosts)
      const o = over.get(id);
      const target = o?.amount != null && !fr.final ? round2(o.amount, fr.currency) : d ? round2(d.amount, d.currency ?? cur) : 0;
      const diff = round2(target - sum, d?.currency ?? fr.currency);
      if (Math.abs(diff) >= 0.01) {
        const k = `${key}~${n}`;
        const m = d ?? { type: fr.type, what: fr.what, rpWhat: fr.rpWhat, trigger: fr.trigger, period: fr.period, matches: fr.matches, notice: fr.notice, currency: fr.currency, credit: undefined };
        const why = o?.amount != null && !fr.final ? `overridden by ${o.by}: ${o.reason}` : d ? `${money(round2(sum), fr.currency)} → ${money(round2(target), fr.currency)}` : `${money(round2(sum), fr.currency)} no longer earned`;
        const trig = diff < 0 && d?.credit && d.credit > (m.trigger || '') ? d.credit : m.trigger;
        lines.push(
          Object.assign(mk(k, idOf(k), { type: 'Adjustment', what: `Adjustment to ${id}: ${why}`, rpWhat: `Adjustment to ${id}`, amount: diff, trigger: trig, due: d?.due, period: m.period, year: d?.year, matches: d?.matches ?? m.matches, notice: m.notice, currency: m.currency ?? fr.currency, trace: [step('Adjustment', `${id} was ${money(round2(sum), fr.currency)} when it was ${fr.side === 'uni' ? 'invoiced' : 'requested'}; it’s now worked out at ${money(round2(target), fr.currency)}. The kept line doesn’t change: this line carries the ${money(diff, fr.currency)} difference${trig !== m.trigger ? `, counted from ${dayText(trig)}, the end of the counting period (Q68)` : ''}.`)] }), { adjusts: id }),
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
    const T = p.T;
    const tiers = tiersOf.get(e.app) ?? [];
    // the higher of the university's and its group's tier counts (the sandbox's rule: they don't stack)
    const tier = [...tiers].sort((a, b) => b.pct - a.pct)[0];
    const progress: Progress[] = [];
    const summary: AppSummary = { currency: cur };
    const version = T && tr ? (tr.earlier.length && T !== (tr as TermsBody) ? `Terms before ${dayText([...tr.earlier].sort((a, b) => a.until.localeCompare(b.until)).find((x) => startOf(e) < x.until)!.until)}` : `Terms ${tr.earlier.length ? `from ${dayText([...tr.earlier].sort((a, b) => b.until.localeCompare(a.until))[0].until)}` : `saved ${dayText(new Date(tr.updated.at).toISOString().slice(0, 10))}`}`) : undefined;
    if (!T) uniNote = `No commission terms for ${u.name} yet.`;
    else if (p.missing.length) uniNote = `Waiting for Admissions to add the ${p.missing.join(', ')} on the application.`;
    if (T && !p.missing.length) {
      const f = e.fees!;
      const net = (gross: number) => (T.feeBasis === 'Tuition before scholarship' ? gross : gross - (f.scholarship ?? 0));
      const fyFee = round2(net(f.tuition ?? 0), cur);
      Object.assign(summary, {
        fee: f.tuition ?? 0,
        scholarship: f.scholarship ?? 0,
        feeBasis: T.feeBasis,
        payUnit: T.payUnit,
        chargeable: T.charge?.unit === 'Whole course' || !T.charge ? 'The whole course' : T.charge.unit === 'Fees up to' ? `Fees up to ${money(T.charge.n ?? 0, cur)}` : `${T.charge.n ?? 1} ${(T.charge.n ?? 1) === 1 ? T.charge.unit.toLowerCase().replace(/s$/, '') : T.charge.unit.toLowerCase()}`,
        trigger: T.trigger === 'Withdrawal deadline' ? `Withdrawal deadline (${T.triggerWeeks ?? S.fallbackWeeks} weeks after the start)` : T.trigger,
        periods: p.periods.length,
      });
      const head: Step[] = [
        step('Terms', `${u.name}, in ${cur}. The terms in force on the intake start, ${dayText(startOf(e))}: ${version}.`),
        step('Fee basis', `${T.feeBasis === 'Tuition before scholarship' ? 'The tuition fee before the scholarship' : 'The tuition fee less the scholarship'}: ${money(f.tuition ?? 0, cur)}${f.scholarship ? ` (scholarship ${money(f.scholarship, cur)} a year)` : ''}, as Admissions entered it${f.feeBy ? ` (${f.feeBy.by}, ${dayText(new Date(f.feeBy.at).toISOString().slice(0, 10))})` : ''}.`),
        step('Paid and chargeable', `Paid ${T.payUnit.toLowerCase()}${PAY_UNITS.find((x) => x.label === T.payUnit)?.per ? '' : ''}; chargeable for ${T.charge?.unit === 'Whole course' ? 'the whole course' : `${T.charge?.n ?? 1} ${(T.charge?.unit ?? 'Years').toLowerCase()}`}.${p.dropped ? ` ${p.dropped} later period${p.dropped === 1 ? ' is' : 's are'} outside the chargeable time, so no line.` : ''}`),
      ];
      const tierSteps: Step[] = tiers.map((t) =>
        step(`${t.spec.who === 'group' ? 'Group tier' : 'University tier'}: ${t.spec.name}`, `${t.spec.retro ? 'Retrospective' : 'Prospective'}, counted per ${windowWords(t.spec.countedPer, t.spec.yearStart)}${t.spec.perCountry ? ' and per source country' : ''}${t.spec.levels.length ? `, levels ${t.spec.levels.join(', ')}` : ''}. ${t.key}: ${t.total} student${t.total === 1 ? '' : 's'} counted; this student is number ${t.rank}. ${t.spec.retro ? `The total (${t.total})` : `This student’s own place (${t.rank})`} sets the band: band ${t.bi + 1}, ${pct(t.pct)}.`),
      );
      if (tiers.length > 1) tierSteps.push(step('University and group tier', `${tiers.map((t) => `${t.spec.name} ${pct(t.pct)}`).join(' vs ')}: the higher wins, ${pct(tier!.pct)}. They don’t stack.`));
      const promoStates = (T.promos ?? []).map((pr) => ({ pr, why: condTest(pr.cond, p.who, S) }));
      const drafts: Draft[] = [];
      const credit = tier?.end && tier.end > today ? tier.end : undefined;
      for (const q of p.periods) {
        const rt = pickRate(T, p.who, q.k, S);
        if (rt.tie) addExc('Rate rows overlap', `${u.name}: two rate rows match ${e.student} equally (${rowLabel(rt.ok[0], cur)} and ${rowLabel(rt.ok[1], cur)}). The first listed is used; make one more specific.`);
        const row = rt.best;
        const steps: Step[] = [...head, step('Period', `${q.label}: ${q.chargeWhy}. Due on ${q.dateWhy}.`)];
        steps.push(step('Rate', row ? `Uses ${rowLabel(row, cur)}${row.src === 'row' ? ' (the most specific row that matches)' : ''}.${rt.no.length ? ` Not matching: ${rt.no.map((n) => `${rowLabel(n.x, cur)} (${n.why.join('; ')})`).join(' | ')}.` : ''}` : 'No rate matches this student: the line can’t be priced until a rate is added.'));
        if (!row) continue;
        // a fixed amount without a study period is paid once, with the first period
        if (row.amt != null && !row.period && q.k > 1) continue;
        let rate = row.pct;
        const fixed = row.amt;
        let tierTp: number | null = null;
        if (fixed == null && tier) {
          steps.push(...tierSteps);
          if (row.pct != null && tier.pct > row.pct) {
            tierTp = tier.pct;
            steps.push(step('Rate after tier', `Band ${tier.bi + 1} (${pct(tier.pct)}) is above the ${row.src === 'level' ? 'rate by level' : 'rate row'} (${pct(row.pct)}). This line stays at ${pct(row.pct)}; the difference is its own Tier bonus line.`));
          } else if (row.src === 'level') {
            rate = tier.pct;
            steps.push(step('Rate after tier', `The tier band replaces the rate by level: ${pct(tier.pct)}.`));
          } else steps.push(step('Rate after tier', `The rate row (${pct(row.pct ?? 0)}) is not below the band (${pct(tier.pct)}), so it stays.`));
        }
        const extraPromos: typeof promoStates = [];
        if (fixed == null && rate != null && promoStates.length) {
          const on = promoStates.filter((x) => !x.why.length);
          steps.push(step('University promotions', promoStates.map(({ pr, why }) => `${pr.name}: ${why.length ? `doesn’t apply (${why.join('; ')})` : 'applies'}`).join('. ') + '.'));
          const rep = on.filter((x) => x.pr.combine === 'Replaces the rate' && x.pr.pct != null).sort((a, b) => (b.pr.pct ?? 0) - (a.pr.pct ?? 0))[0];
          if (rep) {
            steps.push(step('Rate after promotion', `${rep.pr.name} replaces the rate: ${pct(rate)} → ${pct(rep.pr.pct!)}.`));
            rate = rep.pr.pct!;
          }
          on.filter((x) => x.pr.combine === 'Highest wins' && x.pr.pct != null).forEach((x) => {
            if (x.pr.pct! > rate!) {
              steps.push(step('Rate after promotion', `${x.pr.name}: ${pct(x.pr.pct!)} is higher than ${pct(rate!)}, so it applies.`));
              rate = x.pr.pct!;
            }
          });
          extraPromos.push(...on.filter((x) => x.pr.combine === 'Additional line'));
        }
        const replaced = promoStates.some((x) => !x.why.length && x.pr.combine === 'Replaces the rate' && x.pr.pct != null);
        const tierUp = tierTp != null && rate != null && !replaced ? Math.max(0, tierTp - rate) : 0;
        const baseFee = round2(q.fee * q.frac, cur);
        const amount = fixed != null ? fixed : ((baseFee * (rate ?? 0)) / 100);
        if (q.k === 1) {
          summary.uniRate = fixed != null ? `${money(fixed, cur)} fixed` : `${pct(rate ?? 0)} of the ${T.feeBasis === 'Tuition before scholarship' ? 'gross' : 'net'} tuition fee${tierUp > 0 ? `, plus a ${pct(tierUp)} tier bonus` : ''}`;
          summary.uniRateWhy = [row.src === 'level' ? 'rate by level' : 'rate row', ...(rate !== row.pct && fixed == null ? ['after promotions and tier'] : []), ...(tierUp > 0 && tier ? [`${tier.spec.name} band ${tier.bi + 1}`] : [])].join(', ');
        }
        steps.push(step('Amount', fixed != null ? `Fixed ${money(fixed, cur)}${row.period ? ` for study period ${row.period}` : ', once per student, with the first period'}.` : `${q.feeWhy}${q.frac < 1 ? `, × ${Math.round(q.frac * 1000) / 10}% chargeable` : ''} = ${money(baseFee, cur)}. ${money(baseFee, cur)} × ${pct(rate ?? 0)} = ${money(round2(amount, cur), cur)}${q.estimateFee ? ' (an estimate: no fee for this year on the application yet)' : ''}.`));
        drafts.push({ slot: q.slot, type: 'Course commission', what: fixed != null ? `${q.label}: fixed ${money(fixed, cur)}` : `${q.label}: ${pct(rate ?? 0)} of ${money(baseFee, cur)}`, rpWhat: `${q.label} commission`, amount, trigger: q.date, estimated: q.estimated, period: q.k, year: q.y, trace: steps, credit });
        if (tierUp > 0) {
          const v = (baseFee * tierUp) / 100;
          const date = tier!.spec.retro && tier!.setDate && tier!.setDate > q.date ? tier!.setDate : q.date;
          drafts.push({ slot: `tb:${q.slot}`, type: 'Tier bonus', what: `${q.label}: tier bonus, band ${tier!.bi + 1} ${pct(tier!.pct)} less ${pct(rate!)} = ${pct(tierUp)} of ${money(baseFee, cur)}`, rpWhat: `${q.label} tier bonus`, amount: v, trigger: date, period: q.k, year: q.y, credit, trace: [...steps.filter((x) => x.h !== 'Amount'), step('Tier bonus', `${tier!.spec.name} band ${tier!.bi + 1} is ${pct(tier!.pct)}; the course line is at ${pct(rate!)}, so this line is the difference: ${money(baseFee, cur)} × ${pct(tierUp)} = ${money(round2(v, cur), cur)}${date !== q.date ? `. Dated ${dayText(date)}, when band ${tier!.bi + 1} was reached` : ''}. The RP gets its share of it (Q70).`)] });
        }
        extraPromos.forEach(({ pr }) => {
          if (pr.amt != null && q.k > 1) return;
          const v = pr.amt != null ? pr.amt : (baseFee * (pr.pct ?? 0)) / 100;
          drafts.push({ slot: `pr:${pr.id}:${q.k}`, type: 'Promotion', what: `${pr.name} (${q.label}): ${pr.amt != null ? `fixed ${money(pr.amt, cur)}` : `${pct(pr.pct ?? 0)} of ${money(baseFee, cur)}`}`, rpWhat: pr.name, amount: v, trigger: q.date, period: q.k, year: q.y, trace: [...head, step('Promotion', `${pr.name} adds its own line on top of the course commission: ${pr.amt != null ? `${money(pr.amt, cur)} once per student` : `${money(baseFee, cur)} × ${pct(pr.pct ?? 0)}`}. It’s commission on the course, so the RP gets its share.`)] });
        });
      }
      // the first year's cap covers the course and Tier bonus lines, not additional commission (Q59 as the sandbox does it)
      const capped = drafts.filter((d) => (d.type === 'Course commission' || d.type === 'Tier bonus') && (d.year ?? 1) === 1);
      const tot = capped.reduce((s2, d) => s2 + d.amount, 0);
      if (T.cap != null && tot > T.cap && tot > 0) {
        const k = T.cap / tot;
        capped.forEach((d) => {
          const was = d.amount;
          d.amount = d.amount * k;
          d.what += `, capped`;
          d.trace = [...(d.trace ?? []), step('Cap', `The first year’s commission (${money(round2(tot, cur), cur)}) is over the cap of ${money(T.cap!, cur)} a student, so each line is scaled by ${Math.round(k * 10000) / 100}%: ${money(round2(was, cur), cur)} → ${money(round2(d.amount, cur), cur)}.`)];
        });
      }
      const first = drafts.find((d) => d.type === 'Course commission');
      const firstDate = first?.trigger ?? p.trig1;
      (T.addl ?? []).forEach((a) => {
        const why = condTest(a.cond, p.who, S);
        if (why.length) return;
        drafts.push({ slot: `ad:${a.id}`, type: 'Additional commission', what: a.kind === '%' ? `${a.desc}: ${pct(a.value)} of ${money(fyFee, cur)}` : a.desc, rpWhat: a.desc, amount: a.kind === '%' ? (fyFee * a.value) / 100 : a.value, trigger: a.when === 'On enrolment' ? e.enrolled : firstDate, trace: [...head, step('Additional commission', `${a.desc}: ${a.kind === '%' ? `${money(fyFee, cur)} × ${pct(a.value)}` : `${money(a.value, cur)} fixed`}, ${a.when.toLowerCase()}.`)] });
      });
      if (first && payable(e)) {
        // a band's own bonus per student
        tiers.forEach((t) => {
          const bb = t.spec.bandBonuses.find((b) => b.band === t.bi + 1);
          if (bb && bb.value) drafts.push({ slot: `bb:${t.spec.who}`, type: 'Bonus', what: `${t.spec.name} band ${t.bi + 1} bonus`, rpWhat: 'Bonus', amount: bonusAmount(bb.kind, bb.value, fyFee), trigger: firstDate, trace: [...head, ...tierSteps, step('Band bonus', `Band ${t.bi + 1} carries ${bb.kind === '%' ? `${pct(bb.value)} of the first-year fee` : money(bb.value, cur)} per student. GSP’s own: no RP gets a share (C4/G25).`)] });
        });
        // bonus schemes: the university's own, then its group's (counted across every member); GSP's own, never shared
        const g = groupOf(u.id);
        const schemes: [TermsBody['bonus'][number], string[], string, string][] = [...(T.bonus ?? []).map((B) => [B, [u.id], 'bn:', ''] as [TermsBody['bonus'][number], string[], string, string]), ...(g?.bonus ?? []).map((B) => [B, g!.members, 'gb:', `${g!.name}: `] as [TermsBody['bonus'][number], string[], string, string])];
        schemes.forEach(([B, members, pre0, nm]) => {
          if (condTest(B.cond, p.who, S).length) return;
          const meets = (x: Enrolment) => {
            const px = pre.get(x.app);
            return !!px && members.includes(px.uni.id) && !condTest(B.cond, px.who, S).length && (!B.perCountry || x.nationality === e.nationality) && payable(x);
          };
          const per = bonusWindow(B, T);
          const wk = (x: Enrolment) => windowKey(per, startOf(x), T.yearStart ?? 1, S.fyStart, x.intake);
          const pool = all.filter((x) => meets(x) && wk(x) === wk(e)).sort((x, y) => (before(x, y) ? -1 : 1));
          const rank = pool.findIndex((x) => x.app === e.app) + 1;
          if (!rank) return;
          const name = nm + B.name;
          const line = (kind: typeof B.kind, value: number, why: string) => drafts.push({ slot: `${pre0}${B.id}`, type: 'Bonus', what: `Bonus: ${name}`, rpWhat: 'Bonus', amount: bonusAmount(kind, value, fyFee), trigger: firstDate, trace: [...head, step('Bonus scheme', why), step('Not shared', 'A university’s bonus is GSP’s own: no RP gets a share (G25).')] });
          if (B.per === 'Per student') line(B.kind, B.value, `${B.name}: ${B.kind === '%' ? `${pct(B.value)} of the first-year fee` : money(B.value, cur)} per student.`);
          else if (B.per === 'At a number') {
            progress.push({ name, have: pool.length, need: B.threshold ?? 0 });
            if (rank === B.threshold) line(B.kind, B.value, `${B.name}: once ${B.threshold} students enrol in the ${windowWords(per, T.yearStart ?? 1)} (${wk(e)}). This student is number ${rank} of ${pool.length}, so the lump sum sits on this line.`);
          } else {
            const n = B.retro ? pool.length : rank;
            const bi = B.bands.findIndex((b) => n >= b.from && (b.to === null || n <= b.to));
            if (bi < 0) return void progress.push({ name, have: pool.length, need: B.bands[0]?.from ?? 0 });
            const bd = B.bands[bi];
            line(bd.kind, bd.value, `${B.name}, per student by count (${B.retro ? `${pool.length} enrolled` : `this student is number ${rank}`} in the ${windowWords(per, T.yearStart ?? 1)}, ${wk(e)}): band ${bi + 1}, ${bd.from}${bd.to === null ? '+' : `–${bd.to}`}.`);
          }
        });
      }
      drafts.forEach((d) => {
        uniDone.add(lineKey(e.app, 'uni', d.slot));
        uniTxs.push(...chain('uni', d.slot, d));
      });
    }
    uniTxs.push(...leftovers('uni', uniDone));
    // R106: a university's clawback on a line it paid: its own negative line, taken by the university (counts as Paid)
    (state.clawbacks ?? []).forEach((cl) => {
      const L = uniTxs.find((x) => x.id === cl.tx);
      if (!L) return;
      const slot = `cb:${cl.id}`;
      const d: Draft = { slot, type: 'Clawback', what: `${u.name} clawed back ${money(cl.amount, L.currency)} of ${L.id}: ${cl.reason}`, rpWhat: 'Clawback', amount: -cl.amount, trigger: cl.date, due: cl.date, period: L.period, year: L.year, currency: L.currency, trace: [step('Clawback', `Recorded by ${cl.by} on ${dayText(cl.date)}: ${cl.reason}. The RP’s share of it is recovered from its next payment.`)] };
      const made = chain('uni', slot, d);
      made.forEach((x) => (x.claws = L.id));
      uniTxs.push(...made);
    });
    const holdWhy = exc.find((x) => x.hold)?.text;
    // due dates and statuses
    const payDays = T?.payDays ?? 0;
    const gstPct = S.gst?.[u.country] ?? 0;
    uniTxs.forEach((t) => {
      const fr = state.frozen[t.id];
      const inv = invoiceOf.get(t.id);
      if (!fr?.final) t.due = inv ? addDays(inv.date, payDays) : addDays(t.trigger, payDays);
      t.base.due = t.due;
      t.invoice = inv?.number;
      const o = over.get(t.id);
      // an override changes a line not yet kept; a kept line's amount stays, and the difference is an Adjustment (D16)
      if (o && !fr?.final) Object.assign(t, { override: o, amount: !fr && o.amount != null ? o.amount : t.amount, due: o.due ?? t.due });
      if (gstPct && t.amount) t.gst = round2((t.amount * gstPct) / 100, t.currency);
      const got = fullyPaid.has(t.id) ? t.amount : received.get(t.id) ?? 0;
      const off = writtenOff.get(t.id);
      t.received = round2(got, t.currency);
      if (off) t.writtenOff = off.amount;
      if (shortWhy.has(t.id)) t.short = shortWhy.get(t.id);
      // a study period after the first waits for Finance to confirm the student continues (D19)
      const needs = (t.period ?? 1) > 1 && !t.adjusts && !fr && !t.invoice && !confirmed.has(`${e.app}|${t.period}`);
      if (needs) t.toConfirm = true;
      const held = !!holdWhy;
      if (held) t.heldWhy = holdWhy;
      t.status = uniStatus(t, { withdrawn: e.withdrawn, paid: fullyPaid.has(t.id) || !!off || (got > 0 && got >= t.amount - 0.005), part: got > 0, invoiced: !!t.invoice, hold: !!o?.hold || held, today, toConfirm: needs });
      if (t.type === 'Clawback') t.status = 'Paid';
      // R105: GSP's own claim window with the university, when its terms have one
      if (T?.claimMonths && !t.invoice && !['Paid', 'Part paid', 'Not payable'].includes(t.status)) {
        t.claimEnds = keepMonth(periodEnd(t), T.claimMonths);
        t.claimLapsed = today > t.claimEnds;
      }
    });

    // GSP → RP
    const rec = state.records.find((x) => x.rp === e.rp);
    const rpView = rec?.view ?? state.settings.rpView;
    const ag = agreementOn(state, e.rp, startOf(e));
    const rpDone = new Set<string>();
    let rpHold: string | undefined = rp?.status === 'Suspended' ? `${rp.name} is suspended: its commission is held until it’s reactivated (D23).` : undefined;
    if (!rp) addExc('No RP', `Recruitment partner ${e.rp} isn’t in RP Ops’ list.`);
    if (!ag || !rec) rpNote = `No commission record for ${rp?.name ?? e.rp} yet.`;
    else if ([...rec.moves.map((m) => m.from), rec.from].every((d) => d > startOf(e))) {
      addExc('RP terms not in force', `${rp?.name ?? e.rp}’s commission record starts ${dayText([...rec.moves.map((m) => m.from), rec.from].sort()[0])}, after this intake (${dayText(startOf(e))}). Add the terms that applied then.`);
      rpNote = `${rp?.name ?? e.rp}’s terms aren’t in force for this intake.`;
      rpHold = rpHold ?? 'RP terms not in force';
    } else {
      const A: AgreementTerms = termsAt<AgreementTerms>(ag, startOf(e));
      const covering = state.notices.filter((nt) => noticeCovers(nt, e, u, c.level, rp, S.regionGroups));
      const shareN = covering
        .filter((nt) => nt.benefit === 'Share' || nt.benefit === 'Tiered share' || nt.benefit === 'Share plus amount per enrolment')
        // a notice listing the RP beats a region-wide one; then the higher share
        .sort((x, y) => (y.rps.length ? 1 : 0) - (x.rps.length ? 1 : 0) || (y.share ?? y.bands[0]?.pct ?? 0) - (x.share ?? x.bands[0]?.pct ?? 0));
      const boxed = (x: Enrolment) => {
        const px = pre.get(x.app);
        if (!px) return false;
        const rpx = rpOf.get(x.rp);
        const n0 = state.notices
          .filter((nt) => noticeCovers(nt, x, px.uni, px.level, rpx, S.regionGroups) && (nt.benefit === 'Share' || nt.benefit === 'Tiered share' || nt.benefit === 'Share plus amount per enrolment'))
          .sort((a, b) => (b.rps.length ? 1 : 0) - (a.rps.length ? 1 : 0))[0];
        return n0?.combine === 'Separate box';
      };
      // the RP's count (Q43): its payable students in the agreement's window, not in a notice's separate box
      const periodSame = (x: Enrolment) => x.rp === e.rp && !boxed(x) && windowOf(x, A.countedPer, A.yearStart ?? 1) === windowOf(e, A.countedPer, A.yearStart ?? 1);
      const n = ordinal(e, periodSame);
      const own = rec.ownFlat != null;
      let share = own ? rec.ownFlat! : A.shareType === 'Flat' ? A.share ?? 0 : bandFor(A.bands, n)?.pct ?? 0;
      const rpSteps: Step[] = [step('Standard terms', own ? `${rp?.name ?? e.rp}’s own flat share: ${pct(share)}.` : A.shareType === 'Flat' ? `${ag.name}: ${pct(share)} flat.` : `${ag.name}: ${bandsTxt(A.bands)}, counted per ${windowWords(A.countedPer as never, A.yearStart ?? 1)}. This student is enrolment ${n} of the window: ${pct(share)}.`)];
      // retrospective: the band the RP's count has reached by today raises every earlier enrolment in the period;
      // "top band only": only once the count reaches the top band
      const countNow = all.filter((x) => periodSame(x) && payable(x) && x.enrolled <= today).length;
      const top = A.bands[A.bands.length - 1];
      const retroOn = !own && A.shareType !== 'Flat' && A.retro && (!A.retroTop || (top && countNow >= top.from));
      let reached = retroOn ? bandFor(A.bands, countNow)?.pct ?? share : share;
      let from = '';
      const nt0 = shareN[0];
      if (nt0) {
        const covered = (x: Enrolment) => {
          const cx = courseOf(x);
          const ux = cx && uniOf.get(cx.uni);
          return !!ux && noticeCovers(nt0, x, ux, cx.level, rpOf.get(x.rp), S.regionGroups);
        };
        // a tiered notice counts like an agreement: by enrolment date, and retrospective when it says so (Q57)
        const count = nt0.retro ? all.filter((x) => covered(x) && payable(x) && x.enrolled <= today).length : ordinal(e, covered);
        const s = nt0.benefit === 'Tiered share' ? bandFor(nt0.bands, count)?.pct ?? 0 : nt0.share ?? 0;
        const comb = nt0.combine ?? 'Highest wins';
        if (comb === 'Separate box') {
          share = s;
          reached = s;
          from = nt0.name;
          rpSteps.push(step('Notice', `${nt0.name}: ${pct(s)}, a separate box: it replaces the standard share, and this enrolment doesn’t count toward the RP’s standard tier.`));
        } else if (comb === 'Adds on top') {
          share = share + s;
          reached = reached + s;
          from = nt0.name;
          rpSteps.push(step('Notice', `${nt0.name} adds ${pct(s)} on top of the standard share: ${pct(share)} (no cap: C5).`));
        } else if (s > share) {
          rpSteps.push(step('Notice', `${nt0.name}: ${pct(s)} is higher than ${pct(share)}, so it applies.`));
          share = s;
          reached = Math.max(reached, s);
          from = nt0.name;
        } else rpSteps.push(step('Notice', `${nt0.name}: ${pct(s)} is not higher than ${pct(share)}, so the standard share stays.`));
      }
      const addlShare = A.addl ?? share;
      // after the first year (annuity): the RP's own %, else Settings' rule
      const ann = rec.annuityPct ?? (S.annuity?.rule === 'Flat %' ? S.annuity.pct ?? 0 : S.annuity?.rule === 'None' ? 0 : null);
      const agName = from ? `notice: ${from}` : own ? 'own flat share' : ag.name;
      summary.rpShare = `${pct(share)} of GSP’s base commission`;
      summary.rpShareWhy = own ? 'its own flat share' : from ? `notice ${from}` : A.shareType === 'Flat' ? `${ag.name}, flat` : `${ag.name}, band of enrolment ${n}${retroOn && reached > share ? ` (raised to ${pct(reached)} by the retrospective band)` : ''}`;
      summary.rpTerms = from ? `Notice: ${from}` : own ? 'Own flat share' : A.shareType === 'Flat' ? ag.name : `${ag.name}, enrolment ${n} in ${windowWords(A.countedPer as never, A.yearStart ?? 1)}`;
      summary.rpLater = ann != null ? `${pct(ann)} after year 1` : undefined;
      const tuitionBox = covering.some((nt) => nt.benefit === '% of tuition' && nt.combine === 'Separate box');
      const drafts: Draft[] = [];
      uniTxs.forEach((t0) => {
        // a university line paid short (Q44): the RP's line is its share of what came in, until the rest comes or is written off
        const t = (t0.status === 'Part paid' || t0.writtenOff) && t0.amount > 0 ? { ...t0, amount: t0.received ?? 0 } : t0;
        const slot = t.key.slice(`${e.app}|uni|`.length);
        // what the university line is at heart: an Adjustment counts as what it adjusts
        const kind = t.type === 'Adjustment' ? uniTxs.find((x) => x.id === t.adjusts)?.type ?? t.type : t.type;
        const later = (t.year ?? 1) > 1;
        // a retrospective band reached raises the line itself while it isn't kept yet (the sandbox's rule); once it's
        // invoiced or paid, the rise is its own Tier top-up line
        const keptId = state.ids[lineKey(e.app, 'rp', `m:${slot}`)];
        const kept = !!keptId && !!state.frozen[keptId];
        const raise = !later && reached > share && !kept;
        const sh = later && ann != null ? ann : raise ? reached : share;
        if (tuitionBox && (kind === 'Course commission' || kind === 'Tier bonus')) return;
        // GSP's Tier bonus (what GSP's tier with the university unlocks) is GSP's alone: the RP gets only what its own
        // contract gives, its share of the base course commission at its own band (Jovial, 11 Nov; reverses Q70)
        if (kind === 'Tier bonus') return;
        if (kind === 'Course commission') {
          const pr = t.period;
          const label = `Study period ${pr} commission`;
          if (sh > 0) drafts.push({ slot: `m:${slot}`, type: t.type, what: `${t.type === 'Adjustment' ? `Adjustment to ${t.adjusts}, ` : ''}${label}: ${pct(sh)} of GSP’s ${money(t.amount, cur)} (${later && ann != null ? 'after year 1' : agName})`, rpWhat: t.type === 'Adjustment' ? `${label}, adjusted` : label, amount: (t.amount * sh) / 100, trigger: t.trigger, period: pr, year: t.year, matches: t.id, trace: [...rpSteps, ...(raise ? [step('Retrospective band', `The RP’s count reached ${countNow} enrolments in the window: every enrolment in it is at ${pct(reached)}.`)] : []), ...(later && ann != null ? [step('After the first year', `The RP’s share after year 1: ${pct(ann)}${rec.annuityPct != null ? ' (its own)' : ` (Settings: ${S.annuity.rule})`}.`)] : []), step('GSP’s line', `${money(t.amount, cur)} × ${pct(sh)} = ${money(round2((t.amount * sh) / 100, cur), cur)}.`)] });
          if (reached > share && !later && kept) drafts.push({ slot: `rt:${slot}`, type: 'Tier top-up', what: `${label}: retrospective band, ${pct(share)} → ${pct(reached)} of ${money(t.amount, cur)}`, rpWhat: `Tier top-up, study period ${pr}`, amount: (t.amount * (reached - share)) / 100, trigger: t.trigger, period: pr, year: t.year, matches: t.id, trace: [...rpSteps, step('Tier top-up', `The RP’s count reached ${pct(reached)} (${countNow} enrolments): every earlier enrolment in the window is raised. ${money(t.amount, cur)} × (${pct(reached)} − ${pct(share)}).`)] });
        } else if (kind === 'Promotion') {
          // a university promotion's own line is commission on the course: the RP gets its usual share of it
          if (sh > 0) drafts.push({ slot: `m:${slot}`, type: t.type, what: `${t.what}: ${pct(sh)} of GSP’s ${money(t.amount, cur)}`, rpWhat: t.rpWhat, amount: (t.amount * sh) / 100, trigger: t.trigger, period: t.period, year: t.year, matches: t.id, trace: [...rpSteps, step('Promotion', `${money(t.amount, cur)} × ${pct(sh)}, the RP’s share.`)] });
        } else if (kind === 'Clawback') {
          // R106: the RP gives back its share of what the university took back: what was shared with it on that line
          const L = uniTxs.find((x) => x.id === t.claws);
          const lk = L?.type === 'Adjustment' ? uniTxs.find((x) => x.id === L.adjusts)?.type : L?.type;
          const shL = !L ? 0 : lk === 'Course commission' || lk === 'Promotion' ? ((L.year ?? 1) > 1 && ann != null ? ann : share) : lk === 'Additional commission' ? addlShare : 0;
          const cl = (state.clawbacks ?? []).find((c) => `cb:${c.id}` === slot);
          if (L && shL > 0)
            drafts.push({ slot: `rc:${slot}`, type: 'Recovery', what: `Recovery: ${pct(shL)} of ${L.id}’s clawback, ${money(-t.amount, cur)}`, rpWhat: `Recovery: ${u.name} took back commission on this student${cl ? ` (${cl.reason})` : ''}`, amount: (t.amount * shL) / 100, trigger: t.trigger, due: t.trigger, period: L.period, year: L.year, matches: t.id, trace: [...rpSteps, step('Recovery', `${u.name} clawed back ${money(-t.amount, cur)} of ${L.id}. The RP’s share of that line was ${pct(shL)}: ${money(round2((-t.amount * shL) / 100, cur), cur)} is set against its next payment. No time limit.`)] });
        } else if (kind === 'Additional commission' && addlShare > 0) drafts.push({ slot: `m:${slot}`, type: t.type, what: `${t.what}: ${pct(addlShare)} passed on`, rpWhat: t.rpWhat, amount: (t.amount * addlShare) / 100, trigger: t.trigger, period: t.period, year: t.year, matches: t.id, trace: [...rpSteps, step('Additional commission', `${money(t.amount, cur)} × ${pct(addlShare)} passed on.`)] });
        // a university's bonus to GSP is GSP's alone (9 Nov)
      });
      const firstT = first();
      // the RP's own bonuses: its agreement's and its notices', whether or not GSP meets a university's tier
      covering
        .filter((nt) => nt.benefit === 'Bonus per enrolment' || (nt.benefit === 'Share plus amount per enrolment' && nt === nt0))
        .forEach((nt) => drafts.push({ slot: `nt:${nt.id}`, type: 'Bonus', what: `Notice: ${nt.name}`, rpWhat: `Notice: ${nt.name}`, amount: nt.amount ?? 0, trigger: firstT?.trigger ?? e.enrolled, notice: nt.id, trace: [step('Notice', `${nt.name}: ${money(nt.amount ?? 0, cur)} per enrolment, in the university’s currency (Q67).`)] }));
      // % of tuition (the sandbox's RP7): its own line; in a separate box it replaces the RP's share
      covering
        .filter((nt) => nt.benefit === '% of tuition')
        .forEach((nt) => {
          const v = (round2((e.fees?.tuition ?? 0) - (e.fees?.scholarship ?? 0), cur) * (nt.tuitionPct ?? 0)) / 100;
          const gspTot = uniTxs.filter((x) => x.type !== 'Bonus').reduce((s2, x) => s2 + x.amount, 0);
          if (v > gspTot) addExc('Promotion costs more than GSP earns', `${nt.name} pays ${rp?.name ?? e.rp} ${money(round2(v, cur), cur)} (${pct(nt.tuitionPct ?? 0)} of tuition), more than GSP’s own ${money(round2(gspTot, cur), cur)} for this student. Confirm with the approver.`);
          drafts.push({ slot: `tp:${nt.id}`, type: 'Bonus', what: `${nt.name}: ${pct(nt.tuitionPct ?? 0)} of the tuition fee`, rpWhat: `Notice: ${nt.name}`, amount: v, trigger: firstT?.trigger ?? e.enrolled, notice: nt.id, trace: [step('Promotion on tuition', `${nt.name}: ${pct(nt.tuitionPct ?? 0)} of the student’s final tuition fee. ${nt.combine === 'Separate box' ? 'A separate box: it replaces the RP’s share of GSP’s commission.' : 'Paid on top of the RP’s share.'}`)] });
        });
      (A.bonuses ?? []).forEach((b) => {
        if (b.when === 'Every enrolment' || n === b.nth) drafts.push({ slot: `ab:${b.id}`, type: 'Bonus', what: `${b.desc} (${ag.name})${b.when === 'Every enrolment' ? '' : `: enrolment ${b.nth}`}`, rpWhat: `Bonus: ${b.desc}`, amount: b.amount, trigger: firstT?.trigger ?? e.enrolled, trace: [step('Agreement bonus', `${b.desc}: ${money(b.amount, cur)}${b.when === 'Every enrolment' ? ' on every enrolment' : `, on the ${b.nth}th enrolment GSP is paid for in the window`}.`)] });
      });
      drafts.forEach((d) => {
        rpDone.add(lineKey(e.app, 'rp', d.slot));
        rpTxs.push(...chain('rp', d.slot, d));
      });
    }
    // milestones (the sandbox's N07): a lump sum on the enrolment that reaches each count GSP has been paid for, even after the notice ends
    state.notices
      .filter((nt) => nt.benefit === 'Milestone' && rp && noticeCovers(nt, e, u, c.level, rp, S.regionGroups))
      .forEach((nt) => {
        const paidFor = all
          .filter((x) => {
            const px = pre.get(x.app);
            return x.rp === e.rp && !!px && noticeCovers(nt, x, px.uni, px.level, rpOf.get(x.rp), S.regionGroups) && !!firstPaidOn(x.app);
          })
          .sort((x, y) => (firstPaidOn(x.app) + x.app).localeCompare(firstPaidOn(y.app) + y.app));
        (nt.milestones ?? []).forEach((m) => {
          if (paidFor.length < m.count) return void progress.push({ name: `${nt.name} milestone`, have: paidFor.length, need: m.count });
          if (paidFor[m.count - 1].app !== e.app) return;
          const slot = `ms:${nt.id}:${m.count}`;
          rpDone.add(lineKey(e.app, 'rp', slot));
          rpTxs.push(...chain('rp', slot, { slot, type: 'Bonus', what: `${nt.name}: milestone of ${m.count} paid enrolments`, rpWhat: `Milestone: ${nt.name}`, amount: m.amount, trigger: firstPaidOn(e.app), notice: nt.id, trace: [step('Milestone', `${nt.name}: ${m.count} enrolments GSP has been paid for → ${money(m.amount, cur)}. This student was number ${m.count} (paid ${dayText(firstPaidOn(e.app))}). Due once GSP is paid, even after the notice ends.`)] }));
        });
      });
    rpTxs.push(...leftovers('rp', rpDone));
    const rpHeld = rpHold ?? holdWhy;
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
      t.rpKind = rpKindShown(rpView, t, rpTxs);
      const o = over.get(t.id);
      if (o && !fr?.final) Object.assign(t, { override: o, amount: !fr && o.amount != null ? o.amount : t.amount, due: o.due ?? t.due });
      if (rpHeld) t.heldWhy = rpHeld;
      // a withdrawn student earns the RP no bonus (D28); a milestone counts students GSP was paid for, so it stands
      const noBonus = t.type === 'Bonus' && !!e.withdrawn && !t.key.includes('|ms:');
      t.status = noBonus && !paidRp.has(t.id) ? 'Not payable' : rpStatus({ uni: anchor?.status, paid: paidRp.has(t.id), hold: !!o?.hold || !!rpHeld, invoice: inv?.state, sentBack: sentBack.has(t.id), requested: !!t.requested, due: t.due, today });
      // R106: a recovery waits for the RP's next payment, which it's set against
      if (t.type === 'Recovery') {
        const got = Math.min(-t.amount, recoveredOf.get(t.id) ?? 0);
        if (got > 0) t.recovered = round2(got, t.currency);
        t.debitNote = debitOf.get(t.id);
        t.status = got >= -t.amount - 0.005 ? 'Recovered' : 'To recover';
      }
      t.rpSees = rpSees(rpView, t, rpTxs);
      // R105: the RP's claim window, from the end of the study period the line pays for; the line stays as it is
      if (['Ready to request', 'Invoice requested', 'Sent back'].includes(t.status) && !inv) {
        const months = (ag ? termsAt<AgreementTerms>(ag, startOf(e)).claimMonths : null) ?? S.rpClaimMonths;
        t.claimEnds = keepMonth(periodEnd(anchor ?? t), months);
        t.claimLapsed = today > t.claimEnds;
      }
    }
    /** The end of the study period a line pays for (R105): the course start + its periods (by how the university pays);
     *  per unit or per fee payment, the line's own date. */
    function periodEnd(t: Pick<Tx, 'period' | 'trigger'>) {
      const per = T ? PAY_UNITS.find((x) => x.label === T.payUnit)?.per ?? 0 : 0;
      return per ? keepMonth(startOf(e), Math.round(((t.period ?? 1) * 12) / per)) : t.trigger;
    }
    function first() {
      return uniTxs.find((t) => t.type === 'Course commission' && !t.adjusts) ?? uniTxs.find((t) => !t.adjusts);
    }
    function firstPaidOn(app: string) {
      const k = lineKey(app, 'uni', 'p1');
      const id = state.ids[k];
      return (id && paidOn.get(id)) || '';
    }
    const clean = (t: Tx & { _base?: number }): Tx => {
      const { _base: _b, ...rest } = t;
      return rest;
    };
    const U = uniTxs.map(clean);
    const R = rpTxs.map(clean);
    out.push(...U, ...R);
    exceptions.push(...exc);
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
    apps.push({
      app: e.app,
      student: e.student,
      rp: e.rp,
      uni: u.id,
      uniName: u.name,
      course: c.name,
      intake: e.intake,
      enrolled: e.enrolled,
      withdrawn: e.withdrawn,
      uniItem: item('uni', U, uniNote ?? (holdWhy ? `Held: ${holdWhy}` : undefined)),
      rpItem: item('rp', R, rpNote ?? (rpHeld ? `Held: ${rpHeld}` : undefined)),
      terms: version,
      tiers: tiers.map((t) => ({ who: t.spec.who, name: t.spec.name, rank: t.rank, total: t.total, band: t.bi + 1, pct: t.pct, window: t.key, retro: t.spec.retro, ends: t.end })),
      progress,
      exceptions: exc,
      summary,
    });
  }
  return { txs: out, apps, byId: new Map(out.map((t) => [t.id, t])), byApp: new Map(apps.map((a) => [a.app, a])), needIds: [...new Set(needIds)].sort(), exceptions, unlocks };
}
const bandsTxt = (b: Band[]) => b.map((x) => `${x.from}${x.to === null ? '+' : `–${x.to}`}: ${pct(x.pct)}`).join(', ');

/**
 * Where an RP stands in its agreement (Q43; Jovial, 13 Nov: Earnings' Overview shows what its next enrolments unlock):
 * its count in the agreement's current counting window, its band, every band with how many more reach it, when the
 * window ends, whether reaching a band raises earlier enrolments too, and its agreement's bonuses at an enrolment number.
 * Its agreement's terms only. A flat share has no bands; null with no agreement.
 */
export type RpStanding = {
  agreement: string;
  count: number;
  share: number;
  window: string;
  /** The window's last day ('' for an intake). */
  ends: string;
  retro: boolean;
  retroTop: boolean;
  bands: { from: number; to: number | null; pct: number; more: number; now: boolean }[];
  next?: { more: number; share: number };
  bonuses: { desc: string; amount: number; nth: number; more: number }[];
};
export function bandStanding(state: CommState, ctx: Ctx, rp: string, extra: Enrolment[] = []): RpStanding | null {
  const today = ctx.today;
  const ag = agreementOn(state, rp, today);
  if (!ag) return null;
  const A = termsAt<AgreementTerms>(ag, today);
  const atNumber = (A.bonuses ?? []).filter((b) => b.when === 'At an enrolment number' && b.nth);
  if ((A.shareType === 'Flat' || !A.bands.length) && !atNumber.length) return null;
  const seen = new Set<string>();
  const all = [...extra, ...state.enrolments].filter((e) => (seen.has(e.app) ? false : (seen.add(e.app), true)));
  const S = state.settings;
  const key = (d: string, intake?: string) => windowKey(A.countedPer as never, d, A.yearStart ?? 1, S.fyStart, intake);
  const mine = all.filter((x) => x.rp === rp && !x.withdrawn);
  const latest = [...mine].sort((a, b) => startOf(b).localeCompare(startOf(a)))[0];
  const now = A.countedPer === 'Intake' ? key(latest ? startOf(latest) : today, latest?.intake) : key(today);
  const count = mine.filter((x) => key(startOf(x), x.intake) === now).length;
  const banded = A.shareType !== 'Flat' && A.bands.length > 0;
  const band = banded ? bandFor(A.bands, Math.max(1, count)) : undefined;
  const nextBand = band ? A.bands.find((b) => b.from > count && b.pct > band.pct) : undefined;
  const window = A.countedPer === 'Intake' ? `the ${latest?.intake ?? 'current'} intake` : A.countedPer === 'Financial year' ? `GSP’s financial year ${fyOf(today, S.fyStart)}–${String((fyOf(today, S.fyStart) + 1) % 100).padStart(2, '0')}` : now;
  return {
    agreement: ag.name,
    count,
    share: band?.pct ?? A.share ?? 0,
    window,
    ends: windowEnd(A.countedPer as never, today, A.yearStart ?? 1, S.fyStart),
    retro: !!A.retro,
    retroTop: !!A.retroTop,
    bands: banded ? A.bands.map((b) => ({ ...b, more: Math.max(0, b.from - count), now: b === band })) : [],
    next: nextBand ? { more: nextBand.from - count, share: nextBand.pct } : undefined,
    bonuses: atNumber.map((b) => ({ desc: b.desc, amount: b.amount, nth: b.nth!, more: Math.max(0, b.nth! - count) })),
  };
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
  // each line's amount as last worked out, and its changes (D21: the RP sees its lines' history)
  let seenAmt = state.seen ?? {};
  let history = state.history ?? [];
  res.txs.forEach((t) => {
    if (isNewId(t.id)) return;
    const was = seenAmt[t.id];
    if (was === t.amount) return;
    if (seenAmt === (state.seen ?? {})) seenAmt = { ...seenAmt };
    if (was !== undefined) history = [...history, { tx: t.id, at, from: was, to: t.amount }];
    seenAmt[t.id] = t.amount;
  });
  res.txs.forEach((t) => {
    if (isNewId(t.id) || !actedOn(state, t)) return;
    const was = frozen[t.id];
    const paid = paidOf(state, t);
    if (was && (was.final || !paid)) return;
    if (frozen === state.frozen) frozen = { ...state.frozen };
    frozen[t.id] = was
      ? { ...was, amount: t.amount, due: t.due, final: true }
      : { key: t.key, app: t.app, side: t.side, type: t.type, what: t.what, rpWhat: t.rpWhat, base: t.base.amount, amount: t.amount, currency: t.currency, due: t.due, trigger: t.trigger, period: t.period, matches: t.matches, notice: t.notice, adjusts: t.adjusts, final: paid || undefined, at, trace: t.trace, gst: t.gst };
  });
  // R112 (Jovial, 13 Nov): nothing asks for the RP's invoice by itself any more (R111 is reversed): Finance does, with
  // Request invoice on Commission lines, and only then does the RP see the line.
  const requests = state.requests;
  const same = ids === state.ids && frozen === state.frozen && seenAmt === (state.seen ?? {}) && history === (state.history ?? []) && requests === state.requests;
  return same && state.seen ? state : { ...state, ids, idSeq: seq, frozen, seen: seenAmt, history, requests };
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
export function uniStatus(t: Pick<Tx, 'trigger' | 'due'>, o: { withdrawn?: string; paid: boolean; part?: boolean; invoiced: boolean; hold: boolean; today: string; toConfirm?: boolean }): UniStatus {
  if (o.paid) return 'Paid';
  if (o.withdrawn && (!t.trigger || o.withdrawn < t.trigger)) return 'Not payable';
  if (o.hold) return 'Held';
  if (o.part) return 'Part paid';
  if (o.invoiced) return t.due && o.today > t.due ? 'Overdue' : 'Invoiced';
  // a later study period waits for Finance to confirm the student continues (D19)
  if (o.toConfirm) return 'Expected';
  return t.trigger && t.trigger <= o.today ? 'Ready to invoice' : 'Expected';
}
/**
 * A GSP → RP line's status (Q50): it can't be Ready to invoice until GSP has its money for the matching University →
 * GSP line (all of it, or part of it: then the line is the RP's share of what came in).
 */
export function rpStatus(o: { uni?: TxStatus; paid: boolean; hold: boolean; invoice?: RpInvoice['state']; sentBack?: boolean; requested?: boolean; due?: string; today?: string }): RpStatus {
  if (o.paid) return 'Paid';
  // an exception holds the RP's lines even when there's no university line yet (Rate missing, No terms)
  if (!o.uni && o.hold) return 'On hold';
  if (o.uni === 'Not payable' || !o.uni) return 'Not payable';
  if (o.hold) return 'On hold';
  if (o.uni === 'Expected') return 'Expected';
  if (o.uni !== 'Paid' && o.uni !== 'Part paid') return 'Waiting for university';
  // GSP's own promise (D24): an approved line past Pay within is overdue to pay
  if (o.invoice === 'Accepted') return o.due && o.today && o.today > o.due ? 'Overdue to pay' : 'Approved';
  if (o.invoice === 'To check') return 'Invoice in review';
  if (o.sentBack) return 'Sent back';
  // Jovial, 13 Nov (R112): GSP has its money; Finance asks for the RP's invoice, and only then can the RP send it
  return o.requested ? 'Invoice requested' : 'Ready to request';
}

/**
 * What a payment to an RP sets off of its recoveries (Jovial, 13 Nov, Q123, Q124): each recovery in the currency of the
 * lines being paid, oldest first, up to what's left of those lines; the rest of a recovery stays To recover. A recovery
 * in a currency with nothing being paid waits. Returns each recovery's amount set off (positive), leaving out zeros.
 */
export function setOff(lines: Pick<Tx, 'amount' | 'currency' | 'type'>[], recs: Pick<Tx, 'id' | 'amount' | 'currency' | 'recovered' | 'trigger'>[]): Map<string, number> {
  const room = new Map<string, number>();
  lines.filter((t) => t.type !== 'Recovery' && t.amount > 0).forEach((t) => room.set(t.currency, (room.get(t.currency) ?? 0) + t.amount));
  const out = new Map<string, number>();
  [...recs]
    .sort((a, b) => (a.trigger ?? '').localeCompare(b.trigger ?? ''))
    .forEach((r) => {
      const left = round2(-r.amount - (r.recovered ?? 0), r.currency);
      const take = round2(Math.min(left, room.get(r.currency) ?? 0), r.currency);
      if (take <= 0) return;
      out.set(r.id, take);
      room.set(r.currency, round2((room.get(r.currency) ?? 0) - take, r.currency));
    });
  return out;
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

export type CommNote = { id: string; to: 'rp' | 'finance'; rp: string; code: 'N16' | 'N17' | 'N18' | 'N19' | 'N20' | 'N21' | 'N22' | 'N23' | 'N24' | 'N25' | 'N26' | 'N27'; title: string; text: string; at: number };
/** Whether an RP is shown a line, by its view (Jovial, 11 Nov): its kind (a promotion is course commission; an adjustment
 * is what it adjusts) and its study period. */
export function rpSees(v: RpView, t: Pick<Tx, 'type' | 'adjusts' | 'period'> & { requested?: string; status?: string }, all: Pick<Tx, 'id' | 'type' | 'adjusts'>[]): boolean {
  let base: TxType = t.type;
  let at: Pick<Tx, 'type' | 'adjusts'> | undefined = t;
  for (let i = 0; at && at.type === 'Adjustment' && i < 5; i++) {
    at = all.find((x) => x.id === at!.adjusts);
    if (at) base = at.type;
  }
  // R112 (Jovial, 13 Nov): the RP sees a line once Finance has asked for its invoice (and from then on, through review,
  // approval and payment); a recovery too, which goes with the request (R106 as changed)
  const asked = !!t.requested || (!!t.status && (AFTER_ASK as readonly string[]).includes(t.status));
  if (t.type === 'Recovery') return asked;
  const kind = base === 'Promotion' ? 'Course commission' : base;
  if (!(v.kinds as readonly string[]).includes(kind)) return false;
  if (asked) return true;
  // before that, only the first payment, as an estimate: study period 1's course commission, while it's still coming
  return v.periods === 'First study period only' && kind === 'Course commission' && (t.period ?? 1) <= 1 && (!t.status || (RP_ESTIMATE as readonly string[]).includes(t.status));
}
/** The RP's statuses that mean its invoice was asked for (a line can't reach them otherwise). */
const AFTER_ASK = ['Invoice requested', 'Sent back', 'Invoice in review', 'Approved', 'Overdue to pay', 'Paid', 'Recovered'] as const;
/** The kinds of line an RP is shown (its view's kinds): what it can be asked to invoice. */
export function rpKindShown(v: RpView, t: Pick<Tx, 'type' | 'adjusts'>, all: Pick<Tx, 'id' | 'type' | 'adjusts'>[]): boolean {
  let base: TxType = t.type;
  let at: Pick<Tx, 'type' | 'adjusts'> | undefined = t;
  for (let i = 0; at && at.type === 'Adjustment' && i < 5; i++) {
    at = all.find((x) => x.id === at!.adjusts);
    if (at) base = at.type;
  }
  if (t.type === 'Recovery') return true;
  return (v.kinds as readonly string[]).includes(base === 'Promotion' ? 'Course commission' : base);
}
const at9 = (d: string) => Date.parse(`${d}T09:00:00`);
/**
 * The notifications the records make (bell and email): N16 to the RP when its invoice is asked for, N17 to Finance
 * when an RP sends one, N18 when GSP pays; and (Jovial, 10 Nov) N19 when an RP's invoice is sent back, with the reason,
 * N20 when it's approved (Q54); reminders (Q47, days from Settings, no escalation): N21 to the RP while lines it was
 * asked to invoice still aren't on an invoice, N22 to Finance while a University → GSP line is past due and not paid;
 * N23 to Finance while an approved RP line is past Pay within (D24), N24 when a university's terms are edited, and N25,
 * monthly, the notices and university contracts ending soon. (N6 and N15 are retired.)
 */
export function commNotes(state: CommState, res: Result, rpName: (id: string) => string, today = new Date().toISOString().slice(0, 10), unis: Pick<CtxUni, 'id' | 'name' | 'agreement'>[] = []): CommNote[] {
  const total = (ids: string[]) => totalsText(sumBy(ids.map((i) => res.byId.get(i)).filter((x): x is Tx => !!x)));
  const R = state.settings.reminders ?? { rpInvoice: [], uniPayment: [] };
  // the RP hears only of lines it's shown (Jovial, 11 Nov): asking for a hidden line's invoice sends it nothing
  const seen = (ids: string[]) => ids.filter((i) => res.byId.get(i)?.rpSees !== false);
  const rpReminders = state.requests.flatMap((r) => {
    const open = seen(r.txs).filter((t) => ['Invoice requested', 'Sent back'].includes(res.byId.get(t)?.status ?? ''));
    if (!open.length) return [];
    return R.rpInvoice
      .map((d) => addDays(r.date, d))
      .filter((d) => d <= today)
      .map((d, i): CommNote => ({ id: `n21-${r.id}-${i}`, to: 'rp', rp: r.rp, code: 'N21', title: 'Reminder: send your invoice to GSP', text: `${open.length} ${open.length === 1 ? 'line' : 'lines'}, ${total(open)}, asked for on ${dayText(r.date)}. Upload it on Earnings.`, at: at9(d) }));
  });
  const uniReminders = res.txs
    .filter((t) => t.side === 'uni' && t.due && ['Invoiced', 'Overdue', 'Part paid'].includes(t.status))
    .flatMap((t) =>
      R.uniPayment
        .map((d) => addDays(t.due, d))
        .filter((d) => d <= today)
        .map((d, i): CommNote => ({ id: `n22-${t.id}-${i}`, to: 'finance', rp: t.rp, code: 'N22', title: `${t.uniName} hasn’t paid ${t.id}`, text: `${money(roundMoneyOf(t), t.currency)} ${t.invoice ? `on invoice ${t.invoice}` : ''}, due ${dayText(t.due)}. Chase it with the university.`.replace('  ', ' '), at: at9(d) })),
    );
  // N23 (D24): GSP's own payment to the RP is past its Pay within: Finance is reminded at the due date, +7 and +14
  const rpPayReminders = res.txs
    .filter((t) => t.side === 'rp' && t.status === 'Overdue to pay')
    .flatMap((t) =>
      (R.rpPayment ?? [])
        .map((d) => addDays(t.due, d))
        .filter((d) => d <= today)
        .map((d, i): CommNote => ({ id: `n23-${t.id}-${i}`, to: 'finance', rp: t.rp, code: 'N23', title: `Pay ${t.rpName}: ${t.id} is past due`, text: `${money(t.amount, t.currency)}, approved and due ${dayText(t.due)}. Pay it on Commission lines.`, at: at9(d) })),
    );
  // N24: Finance (and the partner's relationship manager, by email) is told when a university's terms are edited (the terms' Logs)
  const termsChanged = state.logs.filter((l) => l.area === 'terms').map((l): CommNote => ({ id: `n24-${l.id}`, to: 'finance', rp: '', code: 'N24', title: 'University commission terms edited', text: l.text, at: l.at }));
  // N25: monthly, on the 1st, Finance hears which notices and university contracts end before the end of next month
  const first = `${today.slice(0, 7)}-01`;
  const horizon = addDays(`${addMonthsIso(first, 2).slice(0, 7)}-01`, -1);
  const ending = [
    ...state.notices.filter((n) => n.ends >= first && n.ends <= horizon).map((n) => `notice ${n.name} (${dayText(n.ends)})`),
    ...unis.filter((u) => u.agreement && u.agreement.end >= first && u.agreement.end <= horizon).map((u) => `${u.name}’s contract (${dayText(u.agreement!.end)})`),
  ];
  const monthly: CommNote[] = ending.length ? [{ id: `n25-${first}`, to: 'finance', rp: '', code: 'N25', title: `${ending.length} ${ending.length === 1 ? 'agreement or notice ends' : 'agreements and notices end'} soon`, text: `Ending by ${dayText(horizon)}: ${ending.join('; ')}. Renew or let them end.`, at: at9(first) }] : [];
  return [
    ...state.requests
      .map((r) => ({ ...r, txs: seen(r.txs) }))
      .filter((r) => r.txs.length)
      .map((r): CommNote => ({ id: `n16-${r.id}`, to: 'rp', rp: r.rp, code: 'N16', title: 'GSP is ready to pay you: send your invoice', text: `${r.txs.length} ${r.txs.length === 1 ? 'line' : 'lines'}, ${total(r.txs)}. Download GSP’s invoice on Earnings, or upload your own.`, at: r.at })),
    ...state.rpInvoices.map((i): CommNote => ({ id: `n17-${i.id}`, to: 'finance', rp: i.rp, code: 'N17', title: `${rpName(i.rp)} sent an invoice for ${i.txs.length} ${i.txs.length === 1 ? 'line' : 'lines'}`, text: `${i.file.name}: ${total(i.txs)}. Check it on Commission lines.`, at: i.at })),
    ...state.rpInvoices
      .filter((i) => i.state === 'Sent back' && i.decided)
      .map((i): CommNote => ({ id: `n19-${i.id}`, to: 'rp', rp: i.rp, code: 'N19', title: `GSP sent back your invoice ${i.file.name}`, text: `${i.reason ?? ''} Upload a new invoice on Earnings for ${i.txs.length} ${i.txs.length === 1 ? 'line' : 'lines'}, ${total(i.txs)}.`.trim(), at: i.decided!.at })),
    ...state.rpInvoices
      .filter((i) => i.state === 'Accepted' && i.decided)
      .map((i): CommNote => ({ id: `n20-${i.id}`, to: 'rp', rp: i.rp, code: 'N20', title: `GSP approved your invoice ${i.file.name}`, text: `${i.txs.length} ${i.txs.length === 1 ? 'line' : 'lines'}, ${total(i.txs)}. GSP pays it next.`, at: i.decided!.at })),
    ...state.rpPayments
      .map((p) => ({ ...p, txs: seen(p.txs) }))
      .filter((p) => p.txs.length)
      .map((p): CommNote => ({ id: `n18-${p.id}`, to: 'rp', rp: p.rp, code: 'N18', title: `GSP paid you ${total(p.txs)}`, text: `${p.txs.length} ${p.txs.length === 1 ? 'line' : 'lines'}, paid on ${dayText(p.date)}.`, at: p.at })),
    // N26 (R106, Q54's "recovery applied"): the RP is told when GSP will recover a university's clawback from its next
    // payment: since 13 Nov (R112), when Finance's invoice request takes the recovery with it
    ...res.txs
      .filter((t) => t.side === 'rp' && t.type === 'Recovery' && ((t.status === 'To recover' && !!t.requested) || (!t.requested && t.status === 'Recovered')))
      .map((t): CommNote => ({ id: `n26-${t.id}`, to: 'rp', rp: t.rp, code: 'N26', title: `${t.uniName} took back commission on ${t.student}`, text: `${money(-t.amount, t.currency)} is set against this payment from GSP (${t.id}). Questions: reply to the commission email.`, at: state.requests.find((r) => r.txs.includes(t.id))?.at ?? state.rpPayments.find((r) => r.txs.includes(t.id))?.at ?? Date.now() })),
    // N27 (Jovial, 13 Nov, Q118/Q125): GSP's debit note asks the RP to pay back a recovery it had nothing to set against
    ...(state.debitNotes ?? []).map((d): CommNote => ({ id: `n27-${d.id}`, to: 'rp', rp: d.rp, code: 'N27', title: `GSP asks you to pay back ${totalsText(sumBy(d.txs.map((i) => res.byId.get(i)).filter((x): x is Tx => !!x).map((x) => ({ ...x, amount: -x.amount - (x.recovered ?? 0) }))))}`, text: `Debit note ${d.number}, ${dayText(d.date)}: commission universities took back on your students, with no payment from GSP to set it against. Download it on Earnings; pay it as the note says.`, at: d.at })),
    ...rpReminders,
    ...uniReminders,
    ...rpPayReminders,
    ...termsChanged,
    ...monthly,
  ].sort((a, b) => b.at - a.at);
}
const addMonthsIso = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 10);
};
const roundMoneyOf = (t: Pick<Tx, 'amount' | 'received' | 'currency'>) => round2(t.amount - (t.received ?? 0), t.currency);
