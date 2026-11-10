/**
 * Pricing rules for the University → GSP side (Jovial, 10 Nov: parity with the Commissions Sandbox Finance signed off),
 * ported from the sandbox engine (ref-ours, branch sandbox-tier-split, src/finance/engine.ts) to the prototype's records:
 * how the university pays (year, semester, trimester, term, per unit, on each fee payment), how long it's chargeable,
 * the trigger date of each study period (with the fallback weeks when the application holds none), the most specific
 * rate row, university promotions, tiers (the university's own and its group's, per source country, by level,
 * retrospective or not), the Tier bonus line above the base rate, the first-year cap, band bonuses and bonus schemes.
 * Pure functions: engine.ts calls them and turns what they give into lines.
 */
import type { AddlKind, BonusScheme, Cond, Enrolment, RateRow, Settings, Step, TermsBody, UniCountedPer, UniGroup } from './model';
import { CHARGE_UNITS, PAY_UNITS, TRIGGERS, dayText, money, pct, roundMoney } from './model';
import type { Level } from './model';

/* ---------- dates ---------- */

const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
export const plusDays = (d: string, n: number) => (d ? isoOf(ms(d) + n * 86_400_000) : '');
const daysIn = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
export function plusMonths(d: string, n: number) {
  if (!d) return '';
  const y = Number(d.slice(0, 4)), m0 = Number(d.slice(5, 7)) - 1, day = Number(d.slice(8, 10));
  const whole = Math.floor(n);
  const t = new Date(Date.UTC(y, m0 + whole, 1));
  t.setUTCDate(Math.min(day, daysIn(t.getUTCFullYear(), t.getUTCMonth())));
  const out = isoOf(t.getTime());
  return n === whole ? out : plusDays(out, Math.round((n - whole) * 30.4));
}
const monthsBetween = (a: string, b: string) => {
  const x = new Date(ms(a)), y = new Date(ms(b));
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth()) + (y.getUTCDate() - x.getUTCDate()) / 31;
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const lc = (s?: string) => String(s ?? '').trim().toLowerCase().replace(/[’']/g, "'");

/* ---------- counting windows: by the intake start, never the census or payment date ---------- */

/** The window a day falls in, for a count by calendar, academic or financial year, intake, or two intakes. */
export function windowKey(per: UniCountedPer | 'Two intakes', d: string, yearStart: number, fyStart: number, intake?: string) {
  if (!d) return '';
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
  if (per === 'Intake') return `Intake ${intake ?? monthName(d.slice(0, 7))}`;
  if (per === 'Two intakes') return m >= 4 && m <= 7 ? `Apr–Jul ${y}` : m >= 8 ? `Aug ${y}–Mar ${y + 1}` : `Aug ${y - 1}–Mar ${y}`;
  const start = per === 'Financial year' ? fyStart : per === 'Academic year' ? yearStart || 1 : 1;
  if (start === 1) return `${per === 'Calendar year' ? 'CY' : per === 'Financial year' ? 'FY' : 'AY'} ${y}`;
  const from = m >= start ? y : y - 1;
  return `${per === 'Financial year' ? 'FY' : 'AY'} ${from}–${String((from + 1) % 100).padStart(2, '0')}`;
}
/** The last day of the window a day falls in ('' for an intake: it ends with its last trigger date). */
export function windowEnd(per: UniCountedPer | 'Two intakes', d: string, yearStart: number, fyStart: number) {
  if (!d || per === 'Intake') return '';
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
  if (per === 'Two intakes') return m >= 4 && m <= 7 ? `${y}-07-31` : `${m >= 8 ? y + 1 : y}-03-31`;
  const start = per === 'Financial year' ? fyStart : per === 'Academic year' ? yearStart || 1 : 1;
  const from = m >= start ? y : y - 1;
  return plusDays(plusMonths(`${from}-${String(start).padStart(2, '0')}-01`, 12), -1);
}
export const windowWords = (per: UniCountedPer | 'Two intakes', yearStart: number) =>
  per === 'Academic year' ? `academic year starting ${MON[(yearStart || 1) - 1]}` : per === 'Two intakes' ? 'two intakes (Apr–Jul, Aug–Mar)' : per.toLowerCase();

/* ---------- regions and conditions ---------- */

/** Does `want` (a country, or a region group from Settings) cover the student's country? */
export function regionCovers(S: Pick<Settings, 'regionGroups'>, want: string, country?: string) {
  if (!want) return true;
  if (lc(want) === lc(country)) return true;
  const g = Object.entries(S.regionGroups ?? {}).find(([k]) => lc(k) === lc(want))?.[1];
  return !!g?.some((c) => lc(c) === lc(country));
}
/** A study period spec: 2, 3+ or 1-2. */
export function periodCovers(spec: string | undefined, k: number) {
  if (spec == null || spec === '') return true;
  const s = String(spec).trim();
  let m = /^(\d+)\+$/.exec(s);
  if (m) return k >= +m[1];
  m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(s);
  if (m) return k >= +m[1] && k <= +m[2];
  return Number(s) === k;
}
/** The student a rule is tested against. */
export type Who = { level: Level; course: string; campus?: string; nationality?: string; start: string };
/** Why a condition doesn't cover the student (empty: it does). Matched on the intake start, not the enrolment or census date. */
export function condTest(c: Cond | undefined, w: Who, S: Pick<Settings, 'regionGroups'>): string[] {
  if (!c) return [];
  const why: string[] = [];
  const d = w.start;
  if (c.from && d < c.from) why.push(`intake ${dayText(d)} is before ${dayText(c.from)}`);
  if (c.to && d > c.to) why.push(`intake ${dayText(d)} is after ${dayText(c.to)}`);
  if (c.intakes?.length && !c.intakes.includes(d.slice(0, 7))) why.push(`intakes ${c.intakes.map(monthName).join(', ')} only; this is ${monthName(d.slice(0, 7))}`);
  if (c.regions?.length && !c.regions.some((r) => regionCovers(S, r, w.nationality))) why.push(`students from ${c.regions.join(', ')} only; this student is from ${w.nationality || 'an unknown country'}`);
  if (c.courses?.length && !c.courses.some((x) => lc(x) === lc(w.course))) why.push(`courses ${c.courses.join(', ')} only; this is ${w.course}`);
  if (c.levels?.length && !c.levels.includes(w.level)) why.push(`levels ${c.levels.join(', ')} only; this is ${w.level}`);
  if (c.campuses?.length && !c.campuses.some((x) => lc(x) === lc(w.campus))) why.push(`campuses ${c.campuses.join(', ')} only; this is ${w.campus || 'not given'}`);
  return why;
}

/* ---------- rate rows: the most specific match wins ---------- */

export type Row = RateRow & { src: 'level' | 'row'; idx: number };
const rowKeys = (x: RateRow) => (['level', 'course', 'campus', 'region', 'period'] as const).filter((k) => x[k] != null && x[k] !== '');
export function rateRows(t: Pick<TermsBody, 'rates' | 'fixed' | 'rateRows'>): Row[] {
  const rows: Row[] = [];
  Object.entries(t.rates ?? {}).forEach(([L, v]) => v != null && rows.push({ src: 'level', level: L as Level, pct: Number(v), amt: null, idx: 0 }));
  Object.entries(t.fixed ?? {}).forEach(([L, v]) => v != null && rows.push({ src: 'level', level: L as Level, pct: null, amt: Number(v), idx: 0 }));
  (t.rateRows ?? []).forEach((x, i) => rows.push({ ...x, src: 'row', idx: i + 1 }));
  return rows;
}
export function rowLabel(x: Row, cur: string) {
  const keys = rowKeys(x).map((k) => (k === 'period' ? `study period ${x.period}` : k === 'region' ? `students from ${x.region}` : k === 'campus' ? `${x.campus} campus` : String(x[k])));
  return `${x.src === 'level' ? 'Rates by level' : `Rate row ${x.idx}`}: ${keys.join(' · ') || 'any course'} → ${x.amt != null ? `${money(x.amt, cur)} fixed` : pct(x.pct ?? 0)}`;
}
function rowTest(x: Row, w: Who, k: number, S: Pick<Settings, 'regionGroups'>) {
  const why: string[] = [];
  if (x.level && x.level !== w.level) why.push(`level ${x.level}, the student’s is ${w.level}`);
  if (x.course && lc(x.course) !== lc(w.course)) why.push(`course “${x.course}”, the student’s is “${w.course}”`);
  if (x.campus && lc(x.campus) !== lc(w.campus)) why.push(`campus ${x.campus}, the student’s is ${w.campus || 'not given'}`);
  if (x.region && !regionCovers(S, x.region, w.nationality)) why.push(`region ${x.region} doesn’t include ${w.nationality || 'an unknown country'}`);
  if (x.period && !periodCovers(x.period, k)) why.push(`study period ${x.period}, this is period ${k}`);
  return why;
}
/** The rate for a study period: the most specific matching row (the rates by level are the fallback); equal rows: the first listed, flagged. */
export function pickRate(t: Pick<TermsBody, 'rates' | 'fixed' | 'rateRows'>, w: Who, k: number, S: Pick<Settings, 'regionGroups'>) {
  const ok: Row[] = [], no: { x: Row; why: string[] }[] = [];
  rateRows(t).forEach((x) => {
    const why = rowTest(x, w, k, S);
    if (why.length) no.push({ x, why });
    else ok.push(x);
  });
  const weight = (x: Row) => rowKeys(x).length + (x.src === 'row' ? 0.5 : 0);
  ok.sort((p, q) => weight(q) - weight(p) || p.idx - q.idx);
  const best = ok[0] ?? null;
  const tie = !!(best && ok[1] && best.src === 'row' && ok[1].src === 'row' && rowKeys(ok[1]).length === rowKeys(best).length);
  return { best, ok, no, tie };
}
/** A row saved with a ":" or "=" inside a value matches nobody (Jovial, 10 Nov): flagged. */
export const unreadableRows = (t: Pick<TermsBody, 'rates' | 'fixed' | 'rateRows'>) => rateRows(t).filter((x) => x.src === 'row' && rowKeys(x).some((k) => /[:=]/.test(String(x[k]))));

/* ---------- study periods ---------- */

export type Period = {
  k: number;
  /** Year of the course (1 on) and the period in its year. */
  y: number;
  p: number;
  slot: string;
  label: string;
  date: string;
  estimated: boolean;
  dateWhy: string;
  fee: number;
  feeWhy: string;
  frac: number;
  chargeWhy: string;
  estimateFee: boolean;
};
const DEF_POINTS = 120;
/**
 * The study periods the university pays on, each with its trigger date and fee, cut to the chargeable time. Missing
 * inputs come back in `missing` (units for a per-unit payer), and `warn` (credit points assumed).
 */
/** Months later, kept in the month: 31 Mar + 8 months is 30 Nov, never 1 Dec. */
export const keepMonth = (d: string, n: number) => {
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)) - 1, day = Number(d.slice(8, 10));
  const t = new Date(Date.UTC(y, m + Math.round(n), 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString().slice(0, 10);
};
export function periodsOf(T: TermsBody, e: Enrolment, months: number, S: Pick<Settings, 'fallbackWeeks'>) {
  const f = e.fees!;
  const start = f.start;
  const fb = S.fallbackWeeks || 4;
  const pay = PAY_UNITS.find((x) => x.label === T.payUnit) ?? PAY_UNITS[0];
  const trig = TRIGGERS.find((x) => x.label === T.trigger) ?? TRIGGERS[0];
  const net = (gross: number) => (T.feeBasis === 'Tuition before scholarship' ? gross : gross - (f.scholarship ?? 0));
  const out: Period[] = [];
  const missing: string[] = [];
  const warn: string[] = [];
  let stepMonths = 0;
  /** A study period's trigger date: the date the application holds, else the fallback (estimated). */
  const dateFor = (k: number, periodStart: string): { date: string; estimated: boolean; why: string } => {
    if (T.trigger === 'Withdrawal deadline') {
      const wk = T.triggerWeeks ?? fb;
      return { date: plusDays(periodStart, 7 * wk), estimated: false, why: `the withdrawal deadline: the period’s start ${dayText(periodStart)} + ${wk} weeks${T.triggerWeeks == null ? ' (Settings’ default)' : ''}` };
    }
    if (trig.field === 'confirmed' && k === 1) return { date: e.enrolled, estimated: false, why: `enrolment confirmed: the day it became Student enrolled, ${dayText(e.enrolled)}` };
    const held = f[trig.field]?.[k - 1];
    if (held) return { date: held, estimated: false, why: `the ${trig.date.toLowerCase()} on the application, ${dayText(held)}` };
    // a later period with no census date of its own: study period 1's census date moved on by the months between them,
    // kept in the month (31 Mar + 5 months is 31 Aug, + 8 is 30 Nov: the sandbox's IP15), estimated
    const first = f[trig.field]?.[0];
    if (trig.field === 'census' && k > 1 && first && stepMonths) {
      // each period's place in its year: semesters 0 and 5 months in, trimesters 0, 4, 8, terms 0, 3, 6, 9 (the sandbox's)
      const per = Math.round(12 / stepMonths);
      const OFF: Record<number, number[]> = { 1: [0], 2: [0, 5], 3: [0, 4, 8], 4: [0, 3, 6, 9] };
      const y = Math.ceil(k / per), p = ((k - 1) % per) + 1;
      const months = 12 * (y - 1) + (OFF[per]?.[p - 1] ?? (p - 1) * stepMonths);
      const d = keepMonth(first, months);
      return { date: d, estimated: true, why: `no census date for study period ${k} on the application: study period 1’s ${dayText(first)} + ${months} months = ${dayText(d)} (estimated)` };
    }
    if (trig.field === 'census') return { date: plusDays(periodStart, 7 * fb), estimated: true, why: `no census date on the application: the period’s start ${dayText(periodStart)} + ${fb} weeks = ${dayText(plusDays(periodStart, 7 * fb))} (estimated)` };
    return { date: '', estimated: false, why: `waiting for the ${trig.date.toLowerCase()} for study period ${k}` };
  };
  if (pay.per) {
    const per = pay.per;
    stepMonths = 12 / per;
    const total = Math.max(1, Math.ceil((months / 12) * per - 1e-9));
    for (let k = 1; k <= total; k++) {
      const y = Math.ceil(k / per), p = ((k - 1) % per) + 1;
      const pStart = plusMonths(start, ((k - 1) * 12) / per);
      const d = dateFor(k, pStart);
      const yearFee = f.yearFees?.[y - 1];
      const gross = yearFee != null ? yearFee : (f.tuition ?? 0);
      const fee = roundMoney(net(gross) / per);
      const estimateFee = y > 1 && yearFee == null;
      const feeWhy = `${y === 1 ? 'the tuition fee a year' : yearFee != null ? `year ${y}’s fee` : `no fee for year ${y} on the application, so the first year’s (an estimate until Admissions adds it)`} ${gross.toLocaleString('en-GB')}` + (T.feeBasis === 'Tuition after scholarship' && f.scholarship ? ` less the scholarship ${f.scholarship.toLocaleString('en-GB')}` : '') + (per > 1 ? `, ÷ ${per}` : '');
      out.push({ k, y, p, slot: `p${k}`, label: per === 1 ? `Year ${y}` : `${pay.one} ${k}${per > 1 ? ` (year ${y}, ${pay.one.toLowerCase()} ${p})` : ''}`, date: d.date, estimated: d.estimated, dateWhy: d.why, fee, feeWhy, frac: 1, chargeWhy: '', estimateFee });
    }
  } else if (T.payUnit === 'Per unit') {
    (f.units ?? []).forEach((u, i) => {
      const date = u.census || plusDays(start, 7 * fb);
      const y = Math.floor(Math.max(0, monthsBetween(start, date)) / 12) + 1;
      out.push({ k: i + 1, y, p: i + 1, slot: `u${i + 1}`, label: `Unit ${i + 1}: ${u.name}`, date, estimated: !u.census, dateWhy: u.census ? `the unit’s census date, ${dayText(u.census)}` : `no census date for the unit: start + ${fb} weeks (estimated)`, fee: u.fee, feeWhy: `the unit fee on the application, ${u.fee.toLocaleString('en-GB')}`, frac: 1, chargeWhy: '', estimateFee: false });
    });
    if (!(f.units ?? []).length) missing.push('units');
  } else {
    [...(f.feePayments ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((x, i) => {
        const y = Math.floor(Math.max(0, monthsBetween(start, x.date)) / 12) + 1;
        out.push({ k: i + 1, y, p: i + 1, slot: `f${i + 1}`, label: `Fee payment ${i + 1} (${dayText(x.date)})`, date: x.date, estimated: false, dateWhy: `the day the student paid, ${dayText(x.date)}`, fee: x.amount, feeWhy: `the fee payment of ${x.amount.toLocaleString('en-GB')} on ${dayText(x.date)}`, frac: 1, chargeWhy: '', estimateFee: false });
      });
  }
  // how long it's chargeable (IP14)
  const ch = T.charge ?? { unit: 'Years', n: 1 };
  const chMonths = CHARGE_UNITS.find((x) => x.label === ch.unit)?.months ?? 0;
  const ppy = f.points ?? DEF_POINTS;
  if (ch.unit === 'Credit points' && f.points == null) warn.push(`pays on the first ${ch.n} credit points, but the application doesn’t say how many the programme is worth a year: ${DEF_POINTS} is assumed`);
  let left: number | null = ch.unit === 'Fees up to' ? ch.n ?? null : ch.unit === 'Credit points' ? ch.n ?? 0 : null;
  out.forEach((q) => {
    if (ch.unit === 'Whole course') q.chargeWhy = 'chargeable for the whole course';
    else if (ch.unit === 'Credit points') {
      const pts = ppy * (pay.per ? 1 / pay.per : 1);
      const take = Math.max(0, Math.min(pts, left ?? 0));
      q.frac = pts ? take / pts : 0;
      left = (left ?? 0) - take;
      q.chargeWhy = take >= pts ? `all ${roundMoney(pts)} points of this period are within the first ${ch.n}` : take > 0 ? `only ${roundMoney(take)} of its ${roundMoney(pts)} points are within the first ${ch.n}` : `beyond the first ${ch.n} points`;
    } else if (ch.unit === 'Units') {
      q.frac = T.payUnit === 'Per unit' && q.k <= (ch.n ?? 0) ? 1 : T.payUnit === 'Per unit' ? 0 : 1;
      q.chargeWhy = T.payUnit === 'Per unit' ? (q.frac ? `unit ${q.k} of the ${ch.n} chargeable` : `beyond the ${ch.n} chargeable units`) : 'a unit limit applies only when commission is paid per unit';
    } else if (ch.unit === 'Fees up to') {
      if (left == null) q.chargeWhy = 'every fee payment is chargeable';
      else {
        const take = Math.max(0, Math.min(q.fee, left));
        q.chargeWhy = take >= q.fee ? `within the first ${(ch.n ?? 0).toLocaleString('en-GB')} of fees` : take > 0 ? `only ${take.toLocaleString('en-GB')} of it is within the first ${(ch.n ?? 0).toLocaleString('en-GB')} of fees` : `beyond the first ${(ch.n ?? 0).toLocaleString('en-GB')} of fees`;
        q.fee = roundMoney(take);
        q.frac = take > 0 ? 1 : 0;
        left = roundMoney(left - take);
      }
    } else {
      const L = (ch.n ?? 1) * chMonths;
      if (pay.per) {
        const s = ((q.k - 1) * 12) / pay.per, e2 = (q.k * 12) / pay.per;
        q.frac = Math.max(0, Math.min(1, (L - s) / (e2 - s)));
      } else q.frac = monthsBetween(start, q.date) < L ? 1 : 0;
      const words = `${ch.n} ${ch.unit.toLowerCase().replace(/s$/, '')}${ch.n === 1 ? '' : 's'}`;
      q.chargeWhy = q.frac === 1 ? `inside the chargeable time (${words})` : q.frac === 0 ? `after the chargeable time (${words})` : `${Math.round(q.frac * 100)}% of this period falls inside the chargeable time (${words})`;
    }
  });
  return { periods: out.filter((q) => q.frac > 0), dropped: out.filter((q) => q.frac <= 0).length, missing, warn, pay };
}

/* ---------- tiers ---------- */

export type TierSpec = { who: 'university' | 'group'; name: string; members: string[]; bands: { from: number; to: number | null; pct: number }[]; countedPer: UniCountedPer; yearStart: number; retro: boolean; perCountry: boolean; levels: Level[]; bandBonuses: TermsBody['bandBonuses'] };
export const bandIndex = (bands: { from: number; to: number | null }[], n: number) => {
  let i = bands.findIndex((b) => n >= b.from && (b.to === null || n <= b.to));
  if (i < 0) i = n < (bands[0]?.from ?? 1) ? 0 : bands.length - 1;
  return i;
};
export const tierOfTerms = (T: TermsBody, uni: string, name: string): TierSpec | null =>
  T.bands?.length ? { who: 'university', name, members: [uni], bands: T.bands, countedPer: T.countedPer ?? 'Calendar year', yearStart: T.yearStart ?? 1, retro: !!T.tierRetro, perCountry: !!T.tierPerCountry, levels: T.tierLevels ?? [], bandBonuses: T.bandBonuses ?? [] } : null;
export const tierOfGroup = (g: UniGroup): TierSpec | null =>
  g.bands?.length ? { who: 'group', name: g.name, members: g.members, bands: g.bands, countedPer: g.countedPer ?? 'Calendar year', yearStart: g.yearStart ?? 1, retro: !!g.tierRetro, perCountry: !!g.tierPerCountry, levels: g.tierLevels ?? [], bandBonuses: g.bandBonuses ?? [] } : null;

/** The bonus a scheme or band gives: a fixed amount, or a % of the first-year fee. */
export const bonusAmount = (kind: AddlKind, value: number, fyFee: number) => (kind === '%' ? roundMoney((fyFee * value) / 100) : value);
export const bonusWindow = (B: BonusScheme, T: Pick<TermsBody, 'countedPer'>) => B.countedPer ?? T.countedPer ?? 'Calendar year';

/** Steps text helpers. */
export const step = (h: string, t: string): Step => ({ h, t });
export const pctOf = (fee: number, p: number, cur: string) => `${money(fee, cur)} × ${pct(p)} = ${money(roundMoney((fee * p) / 100, cur), cur)}`;
