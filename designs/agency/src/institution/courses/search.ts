/**
 * Find courses: the search state, the plain-language box, typo-tolerant matching, filters and sorting.
 * Results only show once five things are known (the brief): destination, the student's country and state,
 * program level and study area. Courses the student can't be offered are hidden, and the count says so.
 */
import {
  AREAS,
  COURSES,
  CURRENCY,
  DESTINATIONS,
  LEVELS,
  UNIVERSITIES,
  blockedFor,
  daysTo,
  earnOf,
  intakeState,
  type Area,
  type Course,
  type Destination,
  type Level,
  type University,
} from '../../data/courses';
import type { Announcement } from '../data/announcements';

/**
 * What Course search reads in the Institution Team (29 Oct): the catalogue as the team keeps it on Universities and
 * Courses, so a course added there shows here. The portal sets it; it starts as GSP's sample catalogue.
 */
export const catalogue: { courses: Course[]; unis: University[]; anns?: Announcement[] } = { courses: COURSES, unis: UNIVERSITIES };
/** 3 Nov: with the team's announcements, which a course's University tab lists. */
export const setCatalogue = (courses: Course[], unis: University[], anns?: Announcement[]) => {
  catalogue.courses = courses;
  catalogue.unis = unis;
  catalogue.anns = anns;
};

export type Need = { dest: Destination | ''; country: string; state: string; level: Level | ''; area: Area | '' };
export type Filters = {
  /** Universities to show (3 Nov: several); none means all. */
  unis: string[];
  /** 4 Nov: campuses to show, as `campusKey` gives them; none means all. */
  campuses: string[];
  intake: string;
  maxFee: number;
  /** 3 Nov (Nesil): tuition and duration as ranges on sliders; 0 means no limit. */
  minFee: number;
  minMonths: number;
  maxMonths: number;
  open: boolean;
  soon: boolean;
  schol: boolean;
  noFee: boolean;
  flex: boolean;
  psw: boolean;
  shortlisted: boolean;
  /** The tuition cap as it was typed in rupees ("under 25 lakhs"), to say it back the same way. */
  feeLakh?: number;
};
export type Sort = 'match' | 'fee' | 'rank' | 'earn';

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
};

export const NO_FILTERS: Filters = { unis: [], campuses: [], intake: '', minFee: 0, maxFee: 0, minMonths: 0, maxMonths: 0, open: false, soon: false, schol: false, noFee: false, flex: false, psw: false, shortlisted: false };

/** The student's country and state start as the agency's own (it says so, and they can be changed). */
export const newSearch = (country = 'India', state = ''): CourseSearch => ({
  text: '',
  keyword: '',
  need: { dest: '', country, state, level: '', area: '' },
  filters: { ...NO_FILTERS },
  sort: 'match',
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
/** What the brief still needs; the state or province is optional (Nesil, 3 Nov). */
export const missingNeed = (n: Need) => (Object.keys(NEED_LABEL) as (keyof Need)[]).filter((k) => k !== 'state' && !n[k]);

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
/** "abertey" finds "abertay", "univeristy" finds "university", "comp" finds "computer". */
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
  for (const uni of catalogue.unis) {
    for (const name of [uni.name, ...(uni.aka ?? [])]) {
      const t = words(name).filter((w) => !STOP.has(w));
      const all = q.every((w) => t.some((x) => close(w, x)));
      const distinct = q.some((w) => !GENERIC.has(w) && t.some((x) => !GENERIC.has(x) && close(w, x)));
      if (!all || !distinct) continue;
      // the more of the name the words cover, the better; on a tie, the name written closest to what was typed wins,
      // so "university of adelaide" is read as the old name of Adelaide University
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

export type Read = { dest?: Destination; level?: Level; area?: Area; month?: string; maxFee?: number; lakh?: number; flex?: boolean; schol?: boolean; noFee?: boolean; keyword: string; said: string[] };

/** Rupees per unit, sample rates: Indian agencies often budget in lakhs (1 lakh = ₹100,000). */
export const INR_PER: Record<string, number> = { AUD: 56, GBP: 112, CAD: 62, NZD: 51, EUR: 95, USD: 86 };
const LAKH = /^(lakhs?|lacs?|l)$/;

/** Reads "mba uk under 22k jan" as destination, level, area, intake and a tuition cap; anything else is a search word. */
export function readBox(text: string): Read {
  const out: Read = { keyword: '', said: [] };
  const w = words(text.replace(/new zealand/gi, 'nz').replace(/united kingdom/gi, 'uk').replace(/united states/gi, 'usa'));
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
    if (/^(under|below|max|upto|within|budget)$/.test(x) && /^\d+(\.\d+)?(k|l|lakhs?|lacs?)?$/.test(next)) {
      const unit = next.replace(/^[\d.]+/, '') || (LAKH.test(w[i + 2] ?? '') ? w[i + 2] : '');
      if (LAKH.test(unit)) out.lakh = parseFloat(next);
      else out.maxFee = parseFloat(next) * (unit === 'k' ? 1000 : 1);
      i += unit && !next.endsWith(unit) ? 2 : 1;
      continue;
    }
    if ((x === 'no' || x === 'without') && /^(ielts|english|test)$/.test(next)) {
      out.flex = true;
      i++;
      continue;
    }
    if (x === 'waiver' || x === 'moi') {
      out.flex = true;
      continue;
    }
    if (/^scholarships?$/.test(x)) {
      out.schol = true;
      continue;
    }
    if ((x === 'no' && /^(application|fee)$/.test(next)) || x === 'free') {
      out.noFee = true;
      if (next === 'application') i++;
      if (w[i + 1] === 'fee') i++;
      continue;
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
  // one area is a clear ask; two ("business analytics") is a course name, so the words stay as search words
  if (areas.size === 1) out.area = [...areas][0];
  else if (areas.size > 1) w.filter((x) => AREA_WORDS.some(([r, , keep]) => r.test(x) && !keep)).forEach((x) => rest.push(x));
  out.keyword = rest.filter((x) => x.length > 1).join(' ');
  if (out.dest) out.said.push(out.dest);
  if (out.level) out.said.push(out.level);
  if (out.area) out.said.push(out.area);
  if (out.month) out.said.push(`${out.month} intake`);
  if (out.maxFee) out.said.push(`Tuition up to ${out.maxFee.toLocaleString('en-GB')}`);
  if (out.lakh) out.said.push(`Tuition up to ₹${out.lakh} lakh`);
  if (out.flex) out.said.push('English test can wait or be waived');
  if (out.schol) out.said.push('Scholarship');
  if (out.noFee) out.said.push('No application fee');
  return out;
}

/** Pressing Search: the box fills what it can, a university it names sets the destination, and results show. */
export function runSearch(s: CourseSearch): CourseSearch {
  const r = readBox(s.text);
  const uni = r.keyword ? universityIn(r.keyword) : null;
  const need = { ...s.need };
  if (r.dest) need.dest = r.dest;
  else if (uni && !need.dest) need.dest = uni.uni.country;
  if (r.level) need.level = r.level;
  if (r.area) need.area = r.area;
  const f = { ...s.filters };
  // "jan" picks the next Jan intake on offer, the way the Intake field lists them ("Jan 2027")
  if (r.month) f.intake = intakeMonths(need).find((m) => m.startsWith(r.month!)) ?? r.month;
  if (r.maxFee) {
    f.maxFee = r.maxFee;
    f.feeLakh = undefined;
  }
  // a budget in lakhs becomes a cap in the destination's currency (it needs the destination to know which)
  if (r.lakh && need.dest) {
    f.maxFee = Math.round((r.lakh * 100_000) / INR_PER[CURRENCY[need.dest]] / 100) * 100;
    f.feeLakh = r.lakh;
  }
  if (r.flex) f.flex = true;
  if (r.schol) f.schol = true;
  if (r.noFee) f.noFee = true;
  const said = [...r.said];
  if (uni) said.unshift(uni.uni.name);
  return { ...s, need, filters: f, keyword: r.keyword, understood: said, searched: true, shown: 20 };
}

/* ---------- results ---------- */

export const needOk = (n: Need) => missingNeed(n).length === 0;

export const nextOpen = (c: Course) => c.intakes.find((i) => intakeState(i) === 'open');
const nextDeadline = (c: Course) => {
  const i = nextOpen(c);
  return i ? daysTo(i.deadline) : 9999;
};
export const isPriority = (c: Course, country: string) => !!c.uni.priorityFor?.includes(country);

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
};

function keywordMatch(c: Course, q: string[]) {
  const hay = words(`${c.name} ${c.uni.name} ${(c.uni.aka ?? []).join(' ')} ${c.campus.name} ${c.campus.city} ${c.area}`);
  return q.every((w) => hay.some((t) => close(w, t)));
}

/** The courses the brief and the search words find, before the filters, and those the student can't be offered. */
function found(s: CourseSearch) {
  const n = s.need;
  const named = s.keyword ? universityIn(s.keyword) : null;
  const q = named ? [] : words(s.keyword).filter((w) => !STOP.has(w));
  const pool = catalogue.courses.filter((c) => (!n.dest || c.uni.country === n.dest) && (!n.level || c.level === n.level) && (!n.area || c.area === n.area) && (named ? c.uni.id === named.uni.id : keywordMatch(c, q)));
  const blocked = n.country ? pool.filter((c) => blockedFor(c.uni, n.country, n.state)) : [];
  return { pool: pool.filter((c) => !blocked.includes(c)), blocked, named };
}

/** A campus, told apart from another university's of the same name. */
export const campusKey = (c: Course) => `${c.uni.id}|${c.campus.name}`;

/**
 * 4 Nov: the Campus filter's choices: the campuses of the courses the search finds, at the universities picked (all of
 * them when none is), by university and then campus.
 */
export function campusesFor(s: CourseSearch): { key: string; uni: University; campus: Course['campus'] }[] {
  const out = new Map<string, { key: string; uni: University; campus: Course['campus'] }>();
  found(s)
    .pool.filter((c) => !s.filters.unis.length || s.filters.unis.includes(c.uni.id))
    .forEach((c) => out.set(campusKey(c), { key: campusKey(c), uni: c.uni, campus: c.campus }));
  return [...out.values()].sort((a, b) => a.uni.name.localeCompare(b.uni.name) || a.campus.name.localeCompare(b.campus.name));
}

export function results(s: CourseSearch): Results {
  const n = s.need;
  const f = s.filters;
  const { pool, blocked, named } = found(s);
  const before = pool.length;
  let list = pool.filter(
    (c) =>
      (!f.unis.length || f.unis.includes(c.uni.id)) &&
      (!f.campuses.length || f.campuses.includes(campusKey(c))) &&
      (!f.intake || c.intakes.some((i) => i.month.startsWith(f.intake) && intakeState(i) !== 'closed')) &&
      (!f.maxFee || c.tuition <= f.maxFee) &&
      (!f.minFee || c.tuition >= f.minFee) &&
      (!f.minMonths || c.months >= f.minMonths) &&
      (!f.maxMonths || c.months <= f.maxMonths) &&
      (!f.open || !!nextOpen(c)) &&
      (!f.soon || (nextDeadline(c) >= 0 && nextDeadline(c) <= 45)) &&
      (!f.schol || c.scholarship > 0) &&
      (!f.noFee || c.appFee === 0) &&
      (!f.flex || c.englishFlex) &&
      (!f.psw || c.psw) &&
      (!f.shortlisted || s.shortlist.includes(c.id)),
  );
  const by: Record<Sort, (a: Course, b: Course) => number> = {
    // 3 Nov: the Institution Team's Search priority (1 to 10, 5 when not set) comes first, highest first
    match: (a, b) => (b.uni.priority ?? 5) - (a.uni.priority ?? 5) || Number(isPriority(b, n.country)) - Number(isPriority(a, n.country)) || Number(!!nextOpen(b)) - Number(!!nextOpen(a)) || nextDeadline(a) - nextDeadline(b) || a.offerDays - b.offerDays,
    fee: (a, b) => a.tuition - b.tuition,
    rank: (a, b) => (a.uni.qs ?? 9999) - (b.uni.qs ?? 9999),
    earn: (a, b) => (earnOf(b) ?? -1) - (earnOf(a) ?? -1),
  };
  list = [...list].sort(by[s.studentView && s.sort === 'earn' ? 'match' : s.sort]);
  return { list, hidden: blocked.length, hiddenBy: [...new Set(blocked.map((c) => c.uni.name))], uni: named?.uni ?? null, alias: named?.alias, before };
}

/** How many courses the fields chosen so far would give, while some are still empty. */
export const soFar = (n: Need) => catalogue.courses.filter((c) => (!n.dest || c.uni.country === n.dest) && (!n.level || c.level === n.level) && (!n.area || c.area === n.area)).length;

/* ---------- options ---------- */

export const FEE_CAPS: Record<string, number[]> = {
  AUD: [25000, 30000, 35000, 40000],
  NZD: [25000, 30000, 35000, 40000],
  CAD: [18000, 22000, 26000, 30000],
  USD: [22000, 28000, 32000, 36000],
  GBP: [14000, 16000, 18000, 20000, 22000],
  EUR: [12000, 14000, 16000, 18000],
};
export const currencyOf = (n: Need) => (n.dest ? CURRENCY[n.dest] : '');
export const intakeMonths = (n: Need) => {
  const ms = new Set<string>();
  catalogue.courses.filter((c) => !n.dest || c.uni.country === n.dest).forEach((c) => c.intakes.forEach((i) => intakeState(i) !== 'closed' && ms.add(i.month)));
  const order = (m: string) => new Date(`1 ${m}`).getTime();
  return [...ms].sort((a, b) => order(a) - order(b));
};
export const universitiesFor = (n: Need) => catalogue.unis.filter((u) => !n.dest || u.country === n.dest).sort((a, b) => a.name.localeCompare(b.name));

/** The tuition and duration the brief's courses span, for the sliders (tuition to the nearest thousand). */
export function bounds(n: Need) {
  const pool = catalogue.courses.filter((c) => (!n.dest || c.uni.country === n.dest) && (!n.level || c.level === n.level) && (!n.area || c.area === n.area));
  const fees = pool.map((c) => c.tuition);
  const ms = pool.map((c) => c.months);
  return {
    fee: (fees.length ? [Math.floor(Math.min(...fees) / 1000) * 1000, Math.ceil(Math.max(...fees) / 1000) * 1000] : [0, 0]) as [number, number],
    months: (ms.length ? [Math.min(...ms), Math.max(...ms)] : [0, 0]) as [number, number],
  };
}

export const SORTS: [Sort, string][] = [
  ['match', 'Best match'],
  ['fee', 'Lowest tuition'],
  ['rank', 'Highest ranked'],
  ['earn', 'Highest base commission'],
];

/** Popular starting points (PM prototype). Each fills the box and searches. */
export const POPULAR: [string, string][] = [
  ['MBA in the UK', 'mba uk'],
  ['Data science, Australia', 'masters data science australia'],
  ['Nursing, Australia', 'bachelor nursing australia'],
  ['Computing, Canada', 'masters computing canada'],
  ['Cyber security, UK', 'msc cyber security uk'],
  ['Accounting, Australia, under 40k', 'masters accounting australia under 40k'],
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
  'courses-hidden': {
    label: 'Results: some hidden (Punjab)',
    make: () => runSearch(with_({ text: '' }, { dest: 'Australia', state: 'Punjab', level: 'Master’s degree', area: 'Business and management' })),
  },
  'courses-renamed': {
    label: 'Search: renamed university',
    make: () => runSearch(with_({ text: 'univeristy of adelaide' }, { state: 'Kerala', level: 'Master’s degree', area: 'Data and analytics' })),
  },
  'courses-none': {
    label: 'Results: nothing matches',
    make: () => {
      const s = runSearch(with_({ text: '' }, { dest: 'UK', state: 'Karnataka', level: 'Master’s degree', area: 'Law' }));
      return { ...s, filters: { ...s.filters, maxFee: 14000, noFee: true } };
    },
  },
};
