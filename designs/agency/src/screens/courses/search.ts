/**
 * Find courses: the search state, the plain-language box, typo-tolerant matching, filters and sorting, as the
 * slice 3 PRD has them, in every role (RP users and every GSP role read this one module).
 * Results only show once the inputs are known: destination, the student's country and state, program level and
 * study area. Courses the student can't be offered (territory) are hidden, and a line says so.
 */
import { getDb, liveTags } from '../../institution/data/store';
import { TEST_AGENCY } from '../../data/rpteam';
import { adminCfg, searchConvert } from '../../admin/data/store';
import { countryByName } from '../../data/partners';
// what Course search reads: the Institution Team's catalogue, in every role (Jovial, 31 Oct)
import { searchCatalogue } from '../../institution/data/store';
import {
  AREAS,
  CURRENCY,
  DESTINATIONS,
  LEVELS,
  blockedFor,
  daysTo,
  inCredits,
  searchPriorityOf,
  intakeState,
  tagsOf,
  totalFeeOf,
  type Area,
  type Course,
  type Destination,
  type Level,
  type University,
} from '../../data/courses';

/** `level` and `area` are names on Admin's Program levels and Study areas lists (S2C-13). */
export type Need = { dest: Destination | ''; country: string; state: string; level: Level | string; area: Area | string };
/**
 * The left panel's five filters, and no others (slice 3 PRD, Filters): the tuition fee range (the total fee, in the
 * destination's currency; null is the whole range), tags (all of them, S3C-4), the duration range (stops 0 "<1 year"
 * to 5 "5+ years"), universities (any of them) and the destination's state or province. `intake` is the search
 * bar's Intake input, kept here so a change of it pages back like a filter.
 */
export type Filters = {
  fee: [number, number] | null;
  tags: string[];
  dur: [number, number];
  unis: string[];
  destState: string;
  intake: string;
  /** The top of the fee range as it was typed in another currency ("under 25 lakhs", "under 500 million dong"), to say it back the same way. */
  feeAs?: string;
};
/** Four sorts, and no others (slice 3 PRD, Sort). */
export type Sort = 'recommended' | 'feeHigh' | 'feeLow' | 'qs';

export type CourseSearch = {
  /** What's in the box right now. */
  text: string;
  /** The words left to match against courses after the box was read. */
  keyword: string;
  need: Need;
  filters: Filters;
  sort: Sort;
  /** Search has been pressed: from then on, results follow every change. */
  searched: boolean;
  studentView: boolean;
  shortlist: string[];
  /** What the box set, said back in plain words. */
  understood: string[];
  shown: number;
  /** The student the search was started for, from their profile. */
  student?: string;
  studentId?: string;
  /** Prototype only: show the page's error state ("Courses didn't load."). */
  failed?: boolean;
};

/** Duration's stops: <1 year, 1 to 4 years, 5+ years (S3-21). */
/** Duration's steps, in years (Jovial, 2 Nov: just the numbers; the filter's label says "years" once). */
export const DUR_STOPS = ['<1', '1', '2', '3', '4', '5+'];
export const ANY_DUR: [number, number] = [0, DUR_STOPS.length - 1];
export const NO_FILTERS: Filters = { fee: null, tags: [], dur: ANY_DUR, unis: [], destState: '', intake: '' };

/** The student's country and state start as the agency's own (it says so, and they can be changed). */
export const newSearch = (country = 'India', state = ''): CourseSearch => ({
  text: '',
  keyword: '',
  need: { dest: '', country, state, level: '', area: '' },
  filters: { ...NO_FILTERS },
  sort: 'recommended',
  searched: false,
  studentView: false,
  shortlist: [],
  understood: [],
  shown: 20,
});

export const NEED_LABEL: Record<keyof Need, string> = {
  dest: 'destination',
  country: 'student’s country',
  state: 'state or province',
  level: 'program level',
  area: 'study area',
};
/** What the search still needs before results mean anything. The student's state or province is optional (Jovial, 2 Nov). */
export const OPTIONAL_NEED: (keyof Need)[] = ['state'];
export const missingNeed = (n: Need) => (Object.keys(NEED_LABEL) as (keyof Need)[]).filter((k) => !n[k] && !OPTIONAL_NEED.includes(k));

/* ---------- typo-tolerant matching ---------- */

const STOP = new Set(['in', 'for', 'with', 'a', 'an', 'the', 'and', 'of', 'to', 'at', 'on', 'course', 'courses', 'program', 'programme', 'programs', 'intake', 'study']);
const GENERIC = new Set(['university', 'college', 'school', 'institute']);
const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

function edits(a: string, b: string, cap = true) {
  if (cap && Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}
/** "abertey" finds "abertay", "univeristy" finds "university", "comp" finds "computer" (typo-tolerant, S3C-20). */
export function close(q: string, t: string) {
  if (t === q) return true;
  if (q.length >= 3 && t.startsWith(q)) return true;
  if (q.length >= 4) return edits(q, t) <= (q.length >= 8 ? 2 : 1);
  return false;
}

/** A university the words name, by its name or an old one ("University of Adelaide" → Adelaide University). */
export function universityIn(text: string): { uni: University; alias?: string } | null {
  const q = words(text).filter((w) => !STOP.has(w));
  if (!q.length) return null;
  let best: { uni: University; alias?: string; score: number } | null = null;
  const typed = q.join(' ');
  for (const uni of searchCatalogue().unis) {
    for (const name of [uni.name, ...(uni.aka ?? [])]) {
      const t = words(name).filter((w) => !STOP.has(w));
      const all = q.every((w) => t.some((x) => close(w, x)));
      const distinct = q.some((w) => !GENERIC.has(w) && t.some((x) => !GENERIC.has(x) && close(w, x)));
      if (!all || !distinct) continue;
      const score = q.length / t.length - edits(typed, t.join(' '), false) / 100 + (name === uni.name ? 0.001 : 0);
      if (!best || score > best.score) best = { uni, alias: name === uni.name ? undefined : name, score };
    }
  }
  return best && { uni: best.uni, alias: best.alias };
}

/* ---------- the plain-language box ---------- */

const DEST_WORDS: [RegExp, Destination][] = [
  [/^(uk|britain|england|scotland|wales)$/, 'UK'],
  [/^(australia|aus|oz)$/, 'Australia'],
  [/^canada$/, 'Canada'],
  [/^(nz)$/, 'New Zealand'],
  [/^ireland$/, 'Ireland'],
  [/^(usa|us|america)$/, 'USA'],
];
const LEVEL_WORDS: [RegExp, Level][] = [
  [/^(masters?|msc|ms|mba|mtech|pg|postgraduate|mres)$/, 'Master’s degree'],
  [/^(bachelors?|bsc|ba|btech|bba|bs|ug|undergraduate)$/, 'Bachelor’s degree'],
  [/^(pgdip|pgd)$/, 'Postgraduate diploma'],
  [/^(diploma|hnd)$/, 'Diploma'],
  [/^(phd|doctorate|research)$/, 'PhD or research'],
  [/^foundation$/, 'Foundation'],
];
/** keep: the word also stays a search word ("nursing" finds nursing courses, not all of health) */
const AREA_WORDS: [RegExp, Area, boolean][] = [
  [/^(business|management)$/, 'Business and management', false],
  [/^mba$/, 'Business and management', true],
  [/^(marketing|hr)$/, 'Business and management', true],
  [/^(it|computing|cs)$/, 'Computing and IT', false],
  [/^(computer|cyber|software|ai)$/, 'Computing and IT', true],
  [/^(data|analytics)$/, 'Data and analytics', true],
  [/^(engineering)$/, 'Engineering', false],
  [/^(civil|mechanical|electrical)$/, 'Engineering', true],
  [/^(health)$/, 'Health and nursing', false],
  [/^(nursing|physiotherapy)$/, 'Health and nursing', true],
  [/^(accounting|accountancy|finance)$/, 'Accounting and finance', true],
  [/^law$/, 'Law', true],
  [/^(design|arts|art|media|animation|architecture)$/, 'Arts and design', true],
];
const MONTH: Record<string, string> = { jan: 'Jan', january: 'Jan', feb: 'Feb', february: 'Feb', mar: 'Mar', march: 'Mar', may: 'May', jul: 'Jul', july: 'Jul', aug: 'Aug', august: 'Aug', sep: 'Sep', sept: 'Sep', september: 'Sep', nov: 'Nov', november: 'Nov' };

/** A budget as typed: the amount, its currency when one was named (else the student's own), and how to say it back. */
export type Budget = { amount: number; cur?: string; as: string };
export type Read = { dest?: Destination; level?: Level; area?: Area; month?: string; budget?: Budget; keyword: string; said: string[] };

/** The student's own currency: their country's (Need.country; geo.json, Jovial 6 Nov). Budgets with no currency are in it. */
export const homeCurrency = (n: Pick<Need, 'country'>) => countryByName(n.country)?.currency ?? '';

/* Words for amounts (Jovial, 6 Nov: lakhs and crores for South Asia, millions and billions for everyone). */
const MULT: [RegExp, number, string][] = [
  [/^(k|thousand)$/, 1e3, 'thousand'],
  [/^(l|lakhs?|lacs?)$/, 1e5, 'lakh'],
  [/^(m|mn|millions?)$/, 1e6, 'million'],
  [/^(cr|crores?)$/, 1e7, 'crore'],
  [/^(b|bn|billions?)$/, 1e9, 'billion'],
];
const multOf = (w: string) => MULT.find(([r]) => r.test(w));
/**
 * The currencies a budget can name, from the search rates (Admin › Currency exchange): each code ("usd"), and each
 * name's last word ("taka", "dong", "rupee") and symbol ("£", "৳") from the platform. A word or symbol several
 * currencies share ("dollar", "$", "rupee") is the destination's, else the student's, else the first.
 */
function currencyWords(prefer: string[]) {
  let codes: string[] = [];
  try {
    codes = adminCfg().rates.map((r) => r.code);
  } catch {
    /* Admin not loaded */
  }
  const words = new Map<string, string[]>();
  const add = (k: string, code: string) => k && words.set(k, [...(words.get(k) ?? []), code]);
  for (const code of codes) {
    add(code.toLowerCase(), code);
    let name = '';
    let sym = '';
    try {
      name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? '';
      sym = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(1).find((x) => x.type === 'currency')?.value ?? '';
    } catch {
      /* the platform doesn't know it */
    }
    const last = name.toLowerCase().split(/\s+/).pop() ?? '';
    if (last) add(last, code);
    if (sym && !/[a-z]/i.test(sym)) add(sym, code);
  }
  const pick = (k: string) => {
    const l = words.get(k);
    if (!l) return undefined;
    return l.find((c) => prefer[0] === c) ?? l.find((c) => prefer[1] === c) ?? l[0];
  };
  return { pick, symbols: [...words.keys()].filter((k) => !/^[a-z]+$/.test(k)) };
}
const fmtAmount = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * Reads "MBA in UK under 25 lakhs": the destination, level and the top of the tuition fee range (the PRD's three),
 * plus the area and intake the bar also has; lakhs and crores convert with Admin's Currency exchange. Anything else
 * is a search word.
 */
export function readBox(text: string, prefer: string[] = []): Read {
  const out: Read = { keyword: '', said: [] };
  const cw = currencyWords(prefer);
  // symbols become their code ("£20k" → "gbp 20k"); thousands separators go ("25,000" → "25000")
  let t = text.replace(/(\d),(?=\d{3}\b)/g, '$1');
  for (const sym of cw.symbols.sort((a, b) => b.length - a.length)) t = t.split(sym).join(` ${(cw.pick(sym) ?? '').toLowerCase()} `);
  const w = words(t.replace(/new zealand/gi, 'nz').replace(/united kingdom/gi, 'uk').replace(/united states/gi, 'usa'));
  const curOf = (x: string) => cw.pick(x) ?? cw.pick(x.replace(/s$/, ''));
  const rest: string[] = [];
  const areas = new Set<Area>();
  for (let i = 0; i < w.length; i++) {
    const x = w[i];
    const next = w[i + 1] ?? '';
    const dest = DEST_WORDS.find(([r]) => r.test(x))?.[1];
    if (dest) {
      out.dest = dest;
      continue;
    }
    // a budget: "under 25 lakhs", "under £20k", "below 500 million dong", "max 30000 usd"
    if (/^(under|below|max|upto|within|budget|less)$/.test(x)) {
      let j = i + 1;
      let cur = curOf(w[j] ?? '') && /^\d/.test(w[j + 1] ?? '') ? curOf(w[j++]) : undefined;
      const m = /^(\d+(?:\.\d+)?)([a-z]*)$/.exec(w[j] ?? '');
      if (m && (!m[2] || multOf(m[2]))) {
        j++;
        let mult = m[2] ? multOf(m[2]) : undefined;
        if (!mult && multOf(w[j] ?? '') && !curOf(w[j] ?? '')) mult = multOf(w[j++]);
        if (!cur && w[j] && curOf(w[j])) cur = curOf(w[j++]);
        const n = parseFloat(m[1]);
        const shown = mult && mult[2] !== 'thousand' ? `${fmtAmount(n)} ${mult[2]}` : fmtAmount(n * (mult?.[1] ?? 1));
        out.budget = { amount: n * (mult?.[1] ?? 1), cur, as: cur ? `${cur} ${shown}` : shown };
        i = j - 1;
        continue;
      }
    }
    if (MONTH[x]) {
      out.month = MONTH[x];
      if (/^20\d\d$/.test(next)) i++;
      continue;
    }
    if (x === 'pg' && next === 'diploma') {
      out.level = 'Postgraduate diploma';
      i++;
      continue;
    }
    const level = LEVEL_WORDS.find(([r]) => r.test(x))?.[1];
    const area = AREA_WORDS.find(([r]) => r.test(x));
    if (level) out.level = level;
    if (area) {
      areas.add(area[1]);
      if (area[2]) rest.push(x);
      continue;
    }
    if (level) continue;
    if (STOP.has(x)) continue;
    rest.push(x);
  }
  if (areas.size === 1) out.area = [...areas][0];
  else if (areas.size > 1) w.filter((x) => AREA_WORDS.some(([r, , keep]) => r.test(x) && !keep)).forEach((x) => rest.push(x));
  out.keyword = rest.filter((x) => x.length > 1).join(' ');
  if (out.dest) out.said.push(out.dest);
  if (out.level) out.said.push(out.level);
  if (out.area) out.said.push(out.area);
  if (out.month) out.said.push(`${out.month} intake`);
  if (out.budget) out.said.push(`Tuition up to ${out.budget.as}`);
  return out;
}

/** Pressing Search: the box fills what it can (overwriting those fields), a university it names sets the destination, and results show. */
export function runSearch(s: CourseSearch): CourseSearch {
  const destCur = s.need.dest ? CURRENCY[s.need.dest] : '';
  const r = readBox(s.text, [destCur, homeCurrency(s.need)]);
  const uni = r.keyword ? universityIn(r.keyword) : null;
  const need = { ...s.need };
  if (r.dest) need.dest = r.dest;
  else if (uni && !need.dest) need.dest = uni.uni.country;
  if (r.level) need.level = r.level;
  if (r.area) need.area = r.area;
  const f = { ...s.filters };
  if (r.dest && r.dest !== s.need.dest) Object.assign(f, { fee: null, unis: [], destState: '' });
  if (r.month) f.intake = intakeMonths(need).find((m) => m.startsWith(r.month!)) ?? r.month;
  // the top of the tuition fee range (the total fee); the bottom stays where it was
  const said = [...r.said];
  // the top of the fee range, in the destination's currency: a budget in another currency converts at this week's
  // search rates; one with no currency named is in the student's own (Jovial, 6 Nov)
  if (r.budget) {
    const to = need.dest ? CURRENCY[need.dest] : '';
    const from = r.budget.cur ?? (homeCurrency(need) || to);
    const i = said.findIndex((x) => x.startsWith('Tuition up to'));
    if (!to) {
      if (i >= 0) said[i] = `${said[i]} (pick a destination to use it)`;
    } else if (!r.budget.cur && !homeCurrency(need)) {
      if (i >= 0) said[i] = `${said[i]} (choose the student’s country, or name a currency, to use it)`;
    } else if (from === to) {
      f.fee = [f.fee?.[0] ?? 0, r.budget.amount];
      f.feeAs = undefined;
    } else {
      const v = searchConvert(r.budget.amount, from, to);
      const as = r.budget.cur ? r.budget.as : `${from} ${r.budget.as}`;
      if (v == null) {
        f.fee = [f.fee?.[0] ?? 0, r.budget.amount];
        f.feeAs = undefined;
        if (i >= 0) said[i] = `Tuition up to ${to} ${fmtAmount(r.budget.amount)} (no rate for ${from} yet)`;
      } else {
        f.fee = [f.fee?.[0] ?? 0, Math.round(v / 100) * 100];
        f.feeAs = as;
        if (i >= 0) said[i] = `Tuition up to ${as}`;
      }
    }
  }
  if (uni) said.unshift(uni.uni.name);
  return { ...s, need, filters: f, keyword: r.keyword, understood: said, searched: true, shown: 20 };
}

/* ---------- results ---------- */

export const needOk = (n: Need) => missingNeed(n).length === 0;

export const nextOpen = (c: Course) => c.intakes.find((i) => intakeState(i) === 'open');
const nextDeadline = (c: Course) => {
  const i = nextOpen(c);
  return i ? daysTo(i.deadline) : Number.POSITIVE_INFINITY;
};

/** An amount in another currency, with Admin's Currency exchange (one unit in AUD each; S3C-5). */
export function convert(v: number, from: string, to: string) {
  if (!to || from === to) return v;
  try {
    return searchConvert(v, from, to) ?? v;
  } catch {
    return v;
  }
}
/** The total tuition fee in the destination's currency, for the slider, the fee sorts and Compare's tags (S3C-5). */
export const totalIn = (c: Course, cur: string) => convert(totalFeeOf(c), c.currency, cur || c.currency);

/** Whether a course's length falls in the duration range, both ends included (S3-21); credit courses match every range (S3-3). */
export function inDuration(c: Course, [lo, hi]: [number, number]) {
  if (inCredits(c)) return true;
  const last = DUR_STOPS.length - 1;
  const m = c.months;
  const min = lo === 0 ? 0 : lo * 12;
  const max = hi === last ? Number.POSITIVE_INFINITY : hi === 0 ? 11.999 : hi * 12;
  return m >= min && m <= max;
}

const AU: Record<string, string> = { SA: 'South Australia', VIC: 'Victoria', NSW: 'New South Wales', QLD: 'Queensland', WA: 'Western Australia', ACT: 'Australian Capital Territory', TAS: 'Tasmania', NT: 'Northern Territory' };
const CITY_STATE: Record<string, string> = {
  Adelaide: 'South Australia', Melbourne: 'Victoria', Geelong: 'Victoria', Ballarat: 'Victoria', Sydney: 'New South Wales', Newcastle: 'New South Wales', Wollongong: 'New South Wales', Brisbane: 'Queensland', Perth: 'Western Australia', Canberra: 'Australian Capital Territory', Hobart: 'Tasmania', Launceston: 'Tasmania', 'Sippy Downs': 'Queensland', Petrie: 'Queensland',
  Auckland: 'Auckland Region', 'Palmerston North': 'Manawatu-Wanganui Region', Hamilton: 'Waikato Region', Tauranga: 'Bay of Plenty Region', Christchurch: 'Canterbury Region', Wellington: 'Wellington Region',
  London: 'Greater London', 'Newcastle upon Tyne': 'Newcastle upon Tyne', Hatfield: 'Hertfordshire', Belfast: 'Belfast district', Dundee: 'Dundee',
};
/**
 * The campus's state or province (slice 2's campus record); the sample campuses that have none take it from their
 * address or city.
 */
export function campusState(c: Course): string {
  const k = c.campus as { state?: string; address?: string; city: string };
  if (k.state) return k.state;
  const au = /\b(SA|VIC|NSW|QLD|WA|ACT|TAS|NT)\s\d{4}\b/.exec(k.address ?? '')?.[1];
  if (au) return AU[au];
  const after = k.city.split(',')[1]?.trim();
  return after ?? CITY_STATE[k.city] ?? k.city;
}

export type Results = {
  list: Course[];
  /** Courses that match but that the student can't be offered, and which universities that's from. */
  hidden: number;
  hiddenBy: string[];
  /** The university the search words name, and the old name they used. */
  uni: University | null;
  alias?: string;
  /** Matches before the filters, for "N courses match so far". */
  before: number;
  /** Those matches themselves: the filters offer only what's in them (1 Nov). */
  pool: Course[];
};

/**
 * Whether a course passes the filters. With `skip`, every filter but that one: what a filter offers is what the
 * other filters leave (1 Nov), so a university picked doesn't hide the other universities.
 */
export function passes(c: Course, f: Filters, cur: string, skip?: keyof Filters) {
  const on = (k: keyof Filters) => k !== skip;
  const fee = on('fee') && f.fee;
  return (
    (!on('unis') || !f.unis.length || f.unis.includes(c.uni.id)) &&
    (!on('intake') || !f.intake || c.intakes.some((i) => i.month.startsWith(f.intake) && intakeState(i) !== 'closed')) &&
    (!fee || (totalIn(c, cur) >= fee[0] - 0.5 && totalIn(c, cur) <= fee[1] + 0.5)) &&
    // every tag picked (S3C-4: all of them)
    (!on('tags') || f.tags.every((t) => tagsOf(c).includes(t))) &&
    (!on('dur') || inDuration(c, f.dur)) &&
    (!on('destState') || !f.destState || campusState(c) === f.destState)
  );
}

function keywordMatch(c: Course, q: string[]) {
  const hay = words(`${c.name} ${c.uni.name} ${(c.uni.aka ?? []).join(' ')} ${c.campus.name} ${c.campus.city} ${c.area}`);
  return q.every((w) => hay.some((t) => close(w, t)));
}

const byName = (a: Course, b: Course) => a.name.localeCompare(b.name);
const qsOf = (c: Course) => c.uni.qs ?? Number.POSITIVE_INFINITY;
/**
 * The four sorts (slice 3 PRD, Sort). Recommended: Search priority (highest first), the soonest open intake deadline
 * (none last), QS rank (none last), name; eligibility plays no part. The fee sorts use the total tuition fee; ties
 * by name; a course with no QS rank comes last in QS ranking.
 */
export function sorter(sort: Sort, cur: string): (a: Course, b: Course) => number {
  if (sort === 'feeHigh') return (a, b) => totalIn(b, cur) - totalIn(a, cur) || byName(a, b);
  if (sort === 'feeLow') return (a, b) => totalIn(a, cur) - totalIn(b, cur) || byName(a, b);
  if (sort === 'qs') return (a, b) => (qsOf(a) === qsOf(b) ? 0 : qsOf(a) - qsOf(b)) || byName(a, b);
  return (a, b) => {
    const p = searchPriorityOf(b.uni) - searchPriorityOf(a.uni);
    if (p) return p;
    const da = nextDeadline(a);
    const db = nextDeadline(b);
    if (da !== db) return da === Number.POSITIVE_INFINITY ? 1 : db === Number.POSITIVE_INFINITY ? -1 : da - db;
    if (qsOf(a) !== qsOf(b)) return qsOf(a) === Number.POSITIVE_INFINITY ? 1 : qsOf(b) === Number.POSITIVE_INFINITY ? -1 : qsOf(a) - qsOf(b);
    return byName(a, b);
  };
}

/** The results. `rp`: an RP user is looking, so universities hidden from that RP leave (territory). */
export function results(s: CourseSearch, rp = true): Results {
  const n = s.need;
  const f = s.filters;
  const cur = currencyOf(n);
  const named = s.keyword ? universityIn(s.keyword) : null;
  const q = named ? [] : words(s.keyword).filter((w) => !STOP.has(w));
  let pool = searchCatalogue().courses.filter((c) => (!n.dest || c.uni.country === n.dest) && (!n.level || c.level === n.level) && (!n.area || c.area === n.area));
  pool = pool.filter((c) => (named ? c.uni.id === named.uni.id : keywordMatch(c, q)));
  const blocked = n.country ? pool.filter((c) => blockedFor(c.uni, n.country, n.state)) : [];
  pool = pool.filter((c) => !blocked.includes(c));
  // a university's territory can hide it from named RPs (slice 3 check, 1 Nov): the signed-in agency's record
  const me = rp ? myRpId() : undefined;
  const hiddenRp = me ? pool.filter((c) => c.uni.hiddenFrom?.includes(me)) : [];
  pool = pool.filter((c) => !hiddenRp.includes(c));
  const before = pool.length;
  const list = pool.filter((c) => passes(c, f, cur)).sort(sorter(s.sort, cur));
  const hid = [...blocked, ...hiddenRp];
  return { list, pool, hidden: hid.length, hiddenBy: [...new Set(hid.map((c) => c.uni.name))], uni: named?.uni ?? null, alias: named?.alias, before };
}

/** How many courses the fields chosen so far would give, while some are still empty. */
export const soFar = (n: Need) => searchCatalogue().courses.filter((c) => (!n.dest || c.uni.country === n.dest) && (!n.level || c.level === n.level) && (!n.area || c.area === n.area)).length;

/* ---------- options ---------- */

export const currencyOf = (n: Need) => (n.dest ? CURRENCY[n.dest] : '');
/** The Intake input: one month and year from the intakes of the matching courses that are Open, Likely or Late. */
export const intakeMonths = (n: Need) => {
  const ms = new Set<string>();
  searchCatalogue()
    .courses.filter((c) => (!n.dest || c.uni.country === n.dest) && (!n.level || c.level === n.level) && (!n.area || c.area === n.area))
    .forEach((c) => c.intakes.forEach((i) => intakeState(i) !== 'closed' && ms.add(i.month)));
  const order = (m: string) => new Date(`1 ${m}`).getTime();
  return [...ms].sort((a, b) => order(a) - order(b));
};
/** Admin's Course tags list (slice 2): active tags only, and only those at least one course carries, so no tag finds nothing. */
export const tagList = (): string[] => {
  const used = new Set(searchCatalogue().courses.flatMap((c) => tagsOf(c)));
  return liveTags(getDb()).filter((t) => used.has(t));
};

export const SORTS: [Sort, string][] = [
  ['recommended', 'Recommended'],
  ['feeHigh', 'Fee high to low'],
  ['feeLow', 'Fee low to high'],
  ['qs', 'QS ranking'],
];

/** Popular starting points (PM prototype). Each fills the box and searches. */
export const POPULAR: [string, string][] = [
  ['MBA in the UK', 'mba uk'],
  ['Data science, Australia', 'masters data science australia'],
  ['Nursing, Australia', 'bachelor nursing australia'],
  ['Computing, Canada', 'masters computing canada'],
  ['Cyber security, UK', 'msc cyber security uk'],
  ['Accounting, Australia, under 80k', 'masters accounting australia under 80k'],
];

export { AREAS, DESTINATIONS, LEVELS };

/* ---------- review states ---------- */

const with_ = (patch: Partial<CourseSearch>, need: Partial<Need> = {}): CourseSearch => {
  const base = newSearch('India', 'Karnataka');
  return { ...base, ...patch, need: { ...base.need, ...need } };
};
export const COURSE_PRESETS: Record<string, { label: string; make: () => CourseSearch }> = {
  courses: { label: 'Find courses: start', make: () => newSearch('India', 'Karnataka') },
  'courses-results': {
    label: 'Results: data, Australia',
    make: () => runSearch(with_({ text: 'data science' }, { dest: 'Australia', state: 'Karnataka', level: 'Master’s degree' })),
  },
  'courses-renamed': {
    label: 'Search: renamed university',
    make: () => runSearch(with_({ text: 'univeristy of adelaide' }, { state: 'Kerala', level: 'Master’s degree', area: 'Data and analytics' })),
  },
  'courses-none': {
    label: 'Results: nothing matches',
    make: () => {
      const s = runSearch(with_({ text: '' }, { dest: 'UK', state: 'Karnataka', level: 'Master’s degree', area: 'Law' }));
      return { ...s, filters: { ...s.filters, fee: [0, 15000], tags: ['Russell Group (UK)', 'Accommodation'] } };
    },
  },
  'courses-hidden': {
    label: 'Results: some hidden (Punjab)',
    make: () => runSearch(with_({ text: '' }, { dest: 'Australia', state: 'Punjab', level: 'Master’s degree', area: 'Business and management' })),
  },
  'courses-error': {
    label: 'Results: didn’t load',
    make: () => ({ ...runSearch(with_({ text: 'data science' }, { dest: 'Australia', state: 'Karnataka', level: 'Master’s degree' })), failed: true }),
  },
};

/** The signed-in agency's recruitment partner record id, if it has one (for a university's hidden-from list). */
function myRpId(): string | undefined {
  try {
    return getDb().rps.find((r) => r.name === TEST_AGENCY)?.id;
  } catch {
    return undefined;
  }
}
