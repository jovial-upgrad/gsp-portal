import { salesRegionNames } from '../../admin/data/config';
/**
 * The catalogue as the Institution Team keeps it (29 Oct, 2nd round, from the PM prototype's IP team): each
 * university sits under one institution partner and goes live on its own; it has campuses that can be made inactive,
 * scholarships, territory rules, a submission profile, contacts and portal logins. 29 Oct (7th round): no Changes
 * tab, no log of who looked at a password, no typical offer time on the page; display priority is a number; each
 * part of a record says who last changed it, and when. Each course has a status, where its details came from, and what the PM prototype's course record
 * holds. 29 Oct (6th round): no bots and no held updates; everything is entered by the team.
 * 29 Oct (4th round, Nesil): no automation for universities. A university is added with its basic details and the
 * team fills in the rest on its page; a course is added with its basics and its details are entered on its page. The
 * four-weekly check is gone.
 */
import { COURSES, UNIVERSITIES, type Area, type Campus, type Course, type Level, type Picture, type University } from '../../data/courses';
import sample1 from '../../assets/campus/sample-1.webp';
import sample2 from '../../assets/campus/sample-2.webp';
import sample3 from '../../assets/campus/sample-3.webp';
import sample4 from '../../assets/campus/sample-4.webp';
import sample5 from '../../assets/campus/sample-5.webp';
import { COUNTRIES } from '../../data/partners';
import { inDays, partnerIdOf, type Contact, type InstitutionPartner, type Stamps } from './records';
import { nameOf } from '../../data/staff';
/** An Institution person's name from the staff list, by the start of their email. */
const IN = (local: string) => nameOf(`${local}@upgrad.com`);


/* ---------- universities ---------- */

export const UNI_STATUSES = ['Live', 'Setting up', 'Paused', 'Ended'] as const;
export type UniStatus = (typeof UNI_STATUSES)[number];
export const UNI_TYPES = ['University', 'College', 'Institute', 'School'] as const;
export type UniType = (typeof UNI_TYPES)[number];

/** 30 Oct: how much, as a range: a percentage of tuition, or an amount in a currency. The same number twice is fixed. */
export const AMOUNT_TYPES = ['Percentage', 'Absolute amount'] as const;
export type AmountType = (typeof AMOUNT_TYPES)[number];

export type Scholarship = {
  id: string;
  name: string;
  amountType: AmountType;
  low: number;
  high: number;
  /** For an absolute amount. */
  currency: string;
  /** Students from these countries; empty for everyone. */
  from: string[];
  levels: Level[];
  areas: Area[];
  conditions: string;
};

/** Who can apply, who comes first, and who never sees it. */
export type Territory = {
  mode: 'all' | 'except' | 'only';
  /** The countries left out ("except") or the only ones in ("only"). */
  countries: string[];
  /** Of the countries that can apply: their applications get a Priority tag for GSP's teams. */
  priority: string[];
  blocked: { country: string; state: string }[];
  /** Recruitment partners that never see it, by id. */
  hiddenFrom: string[];
};

export const CHANNELS = ['Own portal', 'StudyLink', 'Email'] as const;
export type Channel = (typeof CHANNELS)[number];
export const FORM_FOR = ['All courses', 'Undergraduate', 'Postgraduate', 'Research', 'Foundation and diploma'] as const;
export type FormFor = (typeof FORM_FOR)[number];
export type SubmissionForm = { id: string; name: string; file: string; for: FormFor };

/** The sales regions a submission contact covers: Admin › Sales regions (Jovial, 1 Nov, HC38). */
export const REGIONS: string[] = ['All regions', ...salesRegionNames().filter((r) => r !== 'Global')];
export type Login = { id: string; region: string; username: string; secret: string; added: string; by: string };

/** A campus as the team keeps it (30 Oct): its country, state and Google Maps link too. */
export type CampusRec = Campus & { country?: string; state?: string; map?: string };

export type UniRec = Omit<University, 'campuses'> & {
  campuses: CampusRec[];
  ip: string;
  status: UniStatus;
  utype: UniType;
  sector: 'Public' | 'Private';
  studylink: boolean;
  pathway: boolean;
  cricos: string;
  /** Display priority: a number that breaks ties in search; '' when not set. */
  priority: string;
  /** Pictures (Jovial, 1 Nov, HC11): course search's campus photos, in this order; none, and it shows none. */
  pictures: Picture[];
  /** Campuses made inactive: their courses leave Course search; applications already made carry on. */
  inactive: string[];
  scholarships: Scholarship[];
  territory: Territory;
  channel: Channel | '';
  /** The portal's address, or the email applications go to. */
  link: string;
  forms: SubmissionForm[];
  contacts: Contact[];
  logins: Login[];
  added: string;
  /** Who last changed its status, partner, profile, campuses, scholarships, territory, forms, submission, logins and contacts. */
  stamps: Stamps;
};

let n = 0;
const nid = (p: string) => `${p}-${(++n).toString(36)}`;
const mailOf = (u: University) => (u.website ? u.website.replace(/^www\./, '') : `${u.id}.edu`);

/** The scholarships its courses already name, as one card each. */
function scholarshipsOf(u: University): Scholarship[] {
  const named = new Map<string, Course[]>();
  COURSES.filter((c) => c.uni.id === u.id && c.scholarshipName).forEach((c) => named.set(c.scholarshipName!, [...(named.get(c.scholarshipName!) ?? []), c]));
  return [...named].map(([name, list]) => {
    const top = Math.max(...list.map((c) => c.scholarship));
    return {
      id: nid('sch'),
      name,
      amountType: 'Absolute amount',
      low: Math.min(...list.map((c) => c.scholarship)),
      high: top,
      currency: list[0].currency,
      from: [],
      levels: [...new Set(list.map((c) => c.level))],
      areas: [],
      conditions: '', // no source for when to apply (Jovial, 1 Nov)
    };
  });
}

function territoryOf(u: University): Territory {
  const whole = (u.blocked ?? []).filter((b) => !b.states).map((b) => b.country);
  return {
    mode: whole.length ? 'except' : 'all',
    countries: whole,
    priority: [...(u.priorityFor ?? [])],
    blocked: (u.blocked ?? []).flatMap((b) => (b.states ?? []).map((s) => ({ country: b.country, state: s }))),
    hiddenFrom: [],
  };
}

const SUB: Record<string, [Channel, string]> = {
  Australia: ['StudyLink', 'studylink.com'],
  UK: ['Own portal', 'apply'],
  Canada: ['Own portal', 'apply'],
  'New Zealand': ['Email', 'international'],
  Ireland: ['Email', 'admissions'],
  USA: ['Own portal', 'apply'],
};

/** The sample pictures, on the sample records of the Australian and UK universities that have a profile (HC11). */
const SAMPLE_PICTURES: [string, string][] = [
  ['campus-lawn.webp', sample1],
  ['between-classes.webp', sample2],
  ['on-campus.webp', sample3],
  ['library.webp', sample4],
  ['graduation.webp', sample5],
];
/** Pathway providers in the sample (HC2: a university-level field, Institution › Profile). */
const PATHWAY = ['flinders', 'deakin', 'newcastle', 'uow', 'canberra', 'coventry', 'herts', 'northumbria', 'ulster', 'tru', 'pace', 'usf'];
/** A sample campus's Google Maps link, from its address (HC3: a field on the campus record from now on). */
const mapOf = (u: University, k: Campus) => (k.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${u.name}, ${k.address}`)}` : undefined);

function record(u: University, i: number): UniRec {
  const [channel, part] = SUB[u.country];
  const domain = mailOf(u);
  return {
    ...u,
    campuses: u.campuses.map((k) => ({ ...k, map: k.map ?? mapOf(u, k) })),
    ip: partnerIdOf(u.id),
    status: u.id === 'massey' ? 'Paused' : 'Live',
    utype: u.college ? 'College' : 'University',
    sector: u.kind?.startsWith('Private') ? 'Private' : 'Public',
    studylink: channel === 'StudyLink',
    pathway: PATHWAY.includes(u.id),
    cricos: u.country === 'Australia' ? `${String(100 + i * 37).padStart(5, '0')}${'ABCDEFGHJK'[i % 10]}` : '',
    priority: u.priorityFor?.length ? '10' : '',
    pictures: u.about && (u.country === 'Australia' || u.country === 'UK') ? SAMPLE_PICTURES.map(([name, src]) => ({ id: nid('pic'), name, src })) : [],
    inactive: [],
    scholarships: scholarshipsOf(u),
    territory: territoryOf(u),
    channel,
    link: channel === 'StudyLink' ? 'studylink.com' : channel === 'Email' ? `${part}@${domain}` : `${part}.${domain}`,
    forms: [],
    contacts: [{ id: nid('ct'), name: 'International admissions', title: 'Admissions team', for: 'Admissions', email: `international@${domain}` }],
    logins: channel === 'Email' ? [] : [{ id: nid('lg'), region: 'All regions', username: `gsp.${u.id}`, secret: 'Kq7#mT2v!pL9', added: '2025-09-01', by: IN('catherine.wilson') }],
    added: '2025-01-01',
    stamps: {},
  };
}

/** Two more, set up but not live: one under a partner still being agreed, one waiting for its courses. */
const extra = (): UniRec[] => [
  {
    ...record({ id: 'utas', name: 'University of Tasmania', aka: ['UTAS'], country: 'Australia', campuses: [{ name: 'Sandy Bay', city: 'Hobart', setting: 'Suburban', regional: true }, { name: 'Launceston', city: 'Launceston', setting: 'Regional town', regional: true }], website: 'utas.edu.au', kind: 'Public university', founded: 1890, about: 'Australia’s fourth-oldest university, with campuses across Tasmania.', qs: 293, rate: 15 }, 40),
    ip: 'ip-utas',
    status: 'Setting up',
    added: inDays(-40),
    logins: [],
  },
  {
    ...record({ id: 'wichita', name: 'Wichita State University', country: 'USA', campuses: [{ name: 'Main campus', city: 'Wichita', setting: 'Suburban' }], website: 'wichita.edu', kind: 'Public university', founded: 1895, about: 'A public research university in Kansas, known for aviation and engineering.', rate: 12 }, 41),
    ip: 'ip-campusconnect',
    status: 'Setting up',
    added: inDays(-6),
    logins: [],
  },
];

export function sampleUniRecs(): UniRec[] {
  // UTAS is in the catalogue now (GSP's applications use it), live: it keeps its partner from here
  const more = extra();
  const list = [...UNIVERSITIES.map(record), ...more.filter((x) => !UNIVERSITIES.some((u) => u.id === x.id))];
  for (const x of more) {
    const have = list.find((u) => u.id === x.id && u !== x);
    if (have) have.ip = x.ip;
  }
  const get = (id: string) => list.find((u) => u.id === id)!;
  // what the samples show: the Flinders set-up from the PM prototype, and who last changed some of it
  const f = get('flinders');
  f.territory = { mode: 'only', countries: ['India', 'Nepal', 'Sri Lanka', 'Bangladesh', 'Vietnam'], priority: ['India'], blocked: [{ country: 'India', state: 'Punjab' }], hiddenFrom: ['rp-delhi'] };
  f.forms = [{ id: nid('fm'), name: 'Flinders postgraduate international application form', file: 'Flinders_PG_international_application_form.pdf', for: 'Postgraduate' }];
  f.stamps = { territory: { by: IN('kevin.mcewan'), at: inDays(-5) }, profile: { by: IN('catherine.wilson'), at: inDays(-20) }, forms: { by: IN('catherine.wilson'), at: inDays(-20) } };
  get('massey').stamps = { status: { by: IN('lalaine.dizon'), at: inDays(-243) } };
  // priority source markets the Institution Team set (sample), which GSP's application lists flag (Jovial, 31 Oct)
  const PRIORITY: Record<string, string[]> = { deakin: ['India'], uow: ['India', 'Nepal'], canberra: ['India'], scu: ['India'], wsu: ['Bangladesh'], vuw: ['Bangladesh'], uws: ['India'], ais: ['India'], utas: ['India'], latrobe: ['Bhutan', 'Myanmar'] };
  for (const [id, markets] of Object.entries(PRIORITY)) {
    const u = list.find((x) => x.id === id);
    if (u) u.territory = { ...u.territory, priority: [...new Set([...u.territory.priority, ...markets])] };
  }
  return list;
}

/** A new university, with its basic details: set up, out of Course search, and the rest entered on its page. */
export function newUniRec(f: { name: string; utype: UniType; country: University['country']; website: string; ip: string }): UniRec {
  const id = `${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}`;
  const u = record({ id, name: f.name, country: f.country, campuses: [], website: f.website || undefined, rate: 15, college: f.utype === 'College' }, 50);
  return { ...u, ip: f.ip, status: 'Setting up', utype: f.utype, priority: '', cricos: '', logins: [], contacts: [], scholarships: [], territory: { mode: 'all', countries: [], priority: [], blocked: [], hiddenFrom: [] }, channel: '', link: '', added: inDays(0), stamps: {} };
}

/** A university as Course search reads it: its live campuses and its territory as blocks. */
export function forSearch(u: UniRec, _p?: InstitutionPartner): University {
  const t = u.territory;
  const states = new Map<string, string[]>();
  t.blocked.forEach((b) => states.set(b.country, [...(states.get(b.country) ?? []), b.state]));
  const out = t.mode === 'except' ? t.countries : t.mode === 'only' ? COUNTRIES.map((c) => c.name).filter((c) => !t.countries.includes(c)) : [];
  return {
    ...u,
    campuses: u.campuses.filter((c) => !u.inactive.includes(c.name)),
    priorityFor: t.priority,
    blocked: [...out.map((country) => ({ country })), ...[...states].filter(([c]) => !out.includes(c)).map(([country, s]) => ({ country, states: s }))],
    // GSP's rate comes from Finance's terms (data/courses.ts termsRate), not the partner record (Jovial, 31 Oct)
    rate: u.rate,
  };
}

/** The countries a student can come from, for priority and blocked states. */
export const canApplyFrom = (t: Territory, all: string[]) => (t.mode === 'only' ? t.countries : all.filter((c) => !(t.mode === 'except' && t.countries.includes(c))));

/* ---------- courses ---------- */

/**
 * A course as the PM prototype's course record keeps it (29 Oct, 6th round): Basics (code, name, level, study area,
 * duration, campus, mode, its page on the university's website, tags, the date it was last checked), Intakes (each with its
 * dates), Fees, Academic rules and English rules. No other fields, nothing automated. The shared course fields that
 * Course search reads (months, intakes, academic, IELTS, PTE, TOEFL, backlogs) follow from these when it's saved.
 */
/** 29 Oct (5th round, Nesil): no Needs a check. */
export const COURSE_STATUSES = ['Live', 'Draft', 'Hidden'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export const SOURCES = ['University website', 'StudyLink', 'Email', 'Added by hand'] as const;
export type Source = (typeof SOURCES)[number];
/** Shown to partners on the course in search, and quick filters there. Only a GSP admin adds a new tag to the list. */
export const TAGS = [
  'Faster offer TAT',
  'Scholarship available',
  'High offer acceptance rate',
  'English test waiver',
  'Affordable university',
  'Co-op and built-in internships',
  'High job demand',
  'No tuition deposit (US)',
  'Major city',
  'Eligible for non-collateral loan',
  'GS approval with KC (Australia)',
  'Regional university (Australia)',
  'Higher backlog acceptance',
  'Low tuition deposit',
  'No interview required',
  'MBA programs',
  'Russell Group (UK)',
  'MOI acceptable',
  'University has its own English test',
  'Public university',
  'Post-study work visa',
  'Conditional offers',
  'Work while studying',
  'Accommodation',
] as const;

export const DURATION_UNITS = ['Months', 'Years', 'Weeks', 'Credits'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];
export const CURRENCIES = ['AUD', 'GBP', 'NZD', 'CAD', 'EUR', 'USD'] as const;
export const QUALIFICATIONS = ['Applicable to all', 'Bachelor (3 years)', 'Bachelor (4 years)', 'Bachelor (3 or 4 years)', 'Grade 12', 'Diploma'] as const;
export type Qualification = (typeof QUALIFICATIONS)[number];
export const SCALES = ['Percentage', 'GPA 4', 'GPA 10', 'UK class'] as const;
export type Scale = (typeof SCALES)[number];
/** The English tests a course rule can name: the same names as the student's tests (data/tests.ts, HC15). */
export const TESTS = ['IELTS Academic', 'TOEFL iBT', 'PTE Academic', 'Duolingo English Test'] as const;
export type Test = (typeof TESTS)[number];
/** What the second figure of each test is called. */
export const TEST_MIN: Record<Test, string> = { 'IELTS Academic': 'No band below', 'TOEFL iBT': 'Minimum in each section', 'PTE Academic': 'No part below', 'Duolingo English Test': 'No subscore below' };

/** An intake's other dates, beside its application deadline (the shared intake's `deadline`). */
export type IntakeDates = { deposit: string; accept: string; start: string; census: string };
/** One row per country and qualification; no countries is every country. Backlogs: '' for no limit. */
export type AcademicRule = { id: string; countries: string[]; qual: Qualification; board: string; scale: Scale; min: number; backlogs: string; note: string };
/** One row per test and student country; no countries is every country, and a country's row overrides it. */
export type EnglishRule = { id: string; countries: string[]; test: Test; overall: number; min: number; note: string };

export type CourseRec = Course & {
  status: CourseStatus;
  /** Unique at its campus; the same course at another campus has its own. */
  code: string;
  durUnit: DurationUnit;
  durValue: number;
  /** Its page on the university's website. */
  url: string;
  firstYearFee: number;
  fullFee: number;
  /** By intake ("Feb 2027"). */
  dates: Record<string, IntakeDates>;
  academicRules: AcademicRule[];
  englishRules: EnglishRule[];
  source: Source;
  tags: string[];
  /** Who last changed its status and each tab (basics, intakes, fees, academic, english). */
  stamps: Stamps;
};

const MAJOR = ['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide', 'London', 'Birmingham', 'Manchester', 'Toronto', 'Vancouver', 'Dublin', 'Auckland'];
function tagsOf(c: Course): string[] {
  // sample tags; none from offer time, the English test waiting, placement or post-study work (Jovial, 1 Nov, HC2)
  const t: string[] = [];
  if (c.scholarship) t.push('Scholarship available');
  if (MAJOR.includes(c.campus.city)) t.push('Major city');
  if (c.campus.regional) t.push('Regional university (Australia)');
  return t;
}
const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
let rid = 0;
const ruleId = () => `r${(++rid).toString(36)}`;
export const newRuleId = ruleId;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A sample intake's dates: the course starts on a Monday in the intake's month (the same one for every course at the university), census 4 weeks later, deposit 30 days after the deadline. */
function datesFor(month: string, deadline: string, uniId: string): IntakeDates {
  const [m, y] = month.split(' ');
  const d = new Date(Date.UTC(Number(y), MON.indexOf(m), 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * ([...uniId].reduce((t, ch) => t + ch.charCodeAt(0), 0) % 3));
  const start = d.toISOString().slice(0, 10);
  return { deposit: plusDays(deadline, 30), accept: '', start, census: plusDays(start, 28) };
}

export function sampleCourseRecs(): CourseRec[] {
  return COURSES.map((c, i) => ({
    ...c,
    status: i % 89 === 29 ? 'Hidden' : i % 400 === 13 ? 'Draft' : 'Live',
    code: c.cricos ?? `${c.uni.id.slice(0, 3).toUpperCase()}-${(4000 + i * 7).toString().slice(-4)}`,
    durUnit: 'Months',
    durValue: c.months,
    url: `https://${c.uni.website ?? `${c.uni.id}.edu`}/courses/${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    firstYearFee: 0,
    // 30 Oct: the fee the team enters is the full course fee; tuition a year follows from it
    fullFee: Math.round((c.tuition * c.months) / 12),
    // each intake's dates (Jovial, 31 Oct): the source for course search and the application; start on a Monday, census four weeks on
    dates: Object.fromEntries(c.intakes.map((x) => [x.month, datesFor(x.month, x.deadline, c.uni.id)])),
    academicRules: [{ id: ruleId(), countries: [], qual: 'Applicable to all', board: '', scale: 'Percentage', min: c.academic, backlogs: c.backlogs !== undefined ? String(c.backlogs) : '', note: '' }],
    englishRules: [
      { id: ruleId(), countries: [], test: 'IELTS Academic', overall: c.ielts[0], min: c.ielts[1], note: '' },
      { id: ruleId(), countries: [], test: 'TOEFL iBT', overall: c.toefl[0], min: c.toefl[1], note: '' },
      { id: ruleId(), countries: [], test: 'PTE Academic', overall: c.pte[0], min: c.pte[1], note: '' },
    ],
    source: i % 10 === 3 ? 'Added by hand' : i % 5 === 1 ? 'StudyLink' : 'University website',
    tags: tagsOf(c),
    // the 2027 fees Catherine Wilson entered for Flinders
    stamps: c.uni.id === 'flinders' ? { fees: { by: IN('catherine.wilson'), at: inDays(-8) } } : {},
  }));
}

/** The shared fields Course search reads, from what the team entered. */
export function withSearchFields(c: CourseRec): CourseRec {
  const months = c.durUnit === 'Months' ? c.durValue : c.durUnit === 'Years' ? c.durValue * 12 : c.durUnit === 'Weeks' ? Math.round(c.durValue / 4.345) : c.months;
  const pct = c.academicRules.find((r) => r.scale === 'Percentage' && !r.countries.length) ?? c.academicRules.find((r) => r.scale === 'Percentage') ?? c.academicRules[0];
  const test = (t: Test, was: [number, number]): [number, number] => {
    const r = c.englishRules.find((x) => x.test === t && !x.countries.length) ?? c.englishRules.find((x) => x.test === t);
    return r ? [r.overall, r.min] : was[0] && !c.englishRules.length ? was : [0, 0];
  };
  const back = c.academicRules.find((r) => r.backlogs !== '');
  // Course search shows tuition a year: the full course fee over the years it takes (one, for a course under a year)
  const tuition = c.fullFee > 0 ? Math.round(c.fullFee / Math.max(1, months / 12)) : c.tuition;
  return { ...c, months, tuition, academic: pct?.min ?? 0, backlogs: back ? Number(back.backlogs) : undefined, ielts: test('IELTS Academic', c.ielts), toefl: test('TOEFL iBT', c.toefl), pte: test('PTE Academic', c.pte), duolingo: test('Duolingo English Test', c.duolingo ?? [0, 0]) };
}

/** Course search shows live courses at live universities. */
export const searchable = (c: CourseRec) => c.status === 'Live';
export const coursesOf = <T extends Course>(courses: T[], uniId: string) => courses.filter((c) => c.uni.id === uniId);
