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
import { COURSES, UNIVERSITIES, type Area, type Campus, type Course, type Level, type University } from '../../data/courses';
import { COUNTRIES } from '../../data/partners';
import { photosOf } from '../../screens/courses/CampusLife';
import { TEAM, inDays, lastStamp, logLine, nowIso, partnerIdOf, today, withPhones, type Contact, type InstitutionPartner, type LogLine, type Stamp, type Stamps } from './records';

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
  /** 3 Nov: what was Conditions. */
  description: string;
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

export const REGIONS = ['All regions', 'India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Vietnam', 'Nigeria', 'Rest of the world'] as const;
export type Login = { id: string; region: string; username: string; secret: string; added: string; by: string };

/** A picture of the university (3 Nov): uploaded, put in order, replaced or deleted on its Images tab. */
export type UniImage = { id: string; name: string; src: string };
/** Up to 10, as the university page partners see shows (Campus life). */
export const MAX_IMAGES = 10;
/** 3 Nov: Search priority, a whole number from 1 to 10; Best match in Course search puts the highest first. */
export const PRIORITY_DEFAULT = 5;

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
  /** The state (or region) it's in, shown after its country (3 Nov). */
  state: string;
  /** Search priority, 1 to 10 (3 Nov). */
  priority: number;
  /** Its pictures, in the order they show. */
  images: UniImage[];
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
  /** Who added it, and when. */
  created: Stamp;
  /** Who last changed its status, partner, profile, campuses, images, scholarships, territory, forms, submission, logins and contacts. */
  stamps: Stamps;
  /** Every change, newest first (3 Nov: the Logs tab). */
  log: LogLine[];
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
      description: list[0].scholarshipAuto ? '' : 'Students apply for it once they hold an offer.',
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

/** Where each sample university is, as the country list names its states (sample data). */
const STATE: Record<string, string> = {
  flinders: 'South Australia', adelaide: 'South Australia', deakin: 'Victoria', newcastle: 'New South Wales', uow: 'New South Wales', cqu: 'Queensland', vu: 'Victoria', murdoch: 'Western Australia', rmit: 'Victoria', feduni: 'Victoria', canberra: 'Australian Capital Territory', unisc: 'Queensland', utas: 'Tasmania',
  abertay: 'Scotland', coventry: 'England', herts: 'England', northumbria: 'England', greenwich: 'England', ulster: 'Northern Ireland', leeds: 'England', birmingham: 'England',
  windsor: 'Ontario', algoma: 'Ontario', fanshawe: 'Ontario', tru: 'British Columbia',
  massey: 'Manawatu-Wanganui Region', waikato: 'Waikato Region', lincoln: 'Canterbury Region',
  griffith: 'Dublin', dbs: 'Dublin', ul: 'Limerick',
  pace: 'New York', usf: 'Florida', wichita: 'Kansas',
};
/** The admissions person each sample university's contact is (sample data). */
const ADMISSIONS = ['Emma Wilson', 'Arjun Kapoor', 'Sophie Taylor', 'Daniel Okoro', 'Hannah Lee', 'Marco Rossi', 'Aisha Rahman', 'Tom Gallagher', 'Mei Chen', 'Lucy Brennan'];
/** The pictures it starts with: its own photos, or the shared samples, as the page partners see shows them. */
const imagesOf = (u: University): UniImage[] => photosOf(u).map((x, k) => ({ id: nid('img'), name: `${u.id}-${k + 1}.webp`, src: x.src }));
/** "Kavya Menon" and "2026-10-05T11:20" for a sample record, from its place in the list. */
const sampleStamp = (i: number, days: number): Stamp => ({ by: TEAM[i % TEAM.length], at: `${inDays(-days)}T${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}` });

function record(u: University, i: number): UniRec {
  const [channel, part] = SUB[u.country];
  const domain = mailOf(u);
  return {
    ...u,
    campuses: [...u.campuses],
    ip: partnerIdOf(u.id),
    status: u.id === 'massey' ? 'Paused' : 'Live',
    utype: u.college ? 'College' : 'University',
    sector: u.kind?.startsWith('Private') ? 'Private' : 'Public',
    studylink: channel === 'StudyLink',
    pathway: false,
    cricos: u.country === 'Australia' ? `${String(100 + i * 37).padStart(5, '0')}${'ABCDEFGHJK'[i % 10]}` : '',
    state: STATE[u.id] ?? '',
    priority: u.priorityFor?.length ? 8 : PRIORITY_DEFAULT,
    images: imagesOf(u),
    inactive: [],
    scholarships: scholarshipsOf(u),
    territory: territoryOf(u),
    channel,
    link: channel === 'StudyLink' ? 'studylink.com' : channel === 'Email' ? `${part}@${domain}` : `${part}.${domain}`,
    forms: [],
    contacts: withPhones([{ id: nid('ct'), first: ADMISSIONS[i % ADMISSIONS.length].split(' ')[0], last: ADMISSIONS[i % ADMISSIONS.length].split(' ')[1], title: 'International admissions', for: 'Admissions', dial: '', phone: '', email: `international@${domain}` }], u.country),
    logins: channel === 'Email' ? [] : [{ id: nid('lg'), region: 'All regions', username: `gsp.${u.id}`, secret: 'Kq7#mT2v!pL9', added: '2025-09-01', by: 'Kavya Menon' }],
    added: '2025-01-01',
    created: { by: TEAM[i % TEAM.length], at: `2025-01-0${1 + (i % 9)}T${String(9 + (i % 8)).padStart(2, '0')}:00` },
    stamps: {},
    log: [],
  };
}

/** Two more, set up but not live: one under a partner still being agreed, one waiting for its courses. */
const extra = (): UniRec[] => [
  {
    ...record({ id: 'utas', name: 'University of Tasmania', aka: ['UTAS'], country: 'Australia', campuses: [{ name: 'Sandy Bay', city: 'Hobart', setting: 'Suburban', regional: true }, { name: 'Launceston', city: 'Launceston', setting: 'Regional town', regional: true }], website: 'utas.edu.au', kind: 'Public university', founded: 1890, about: 'Australia’s fourth-oldest university, with campuses across Tasmania.', qs: 293, rate: 15, offerDays: 7, checked: today() }, 40),
    ip: 'ip-utas',
    status: 'Setting up',
    added: inDays(-40),
    logins: [],
  },
  {
    ...record({ id: 'wichita', name: 'Wichita State University', country: 'USA', campuses: [{ name: 'Main campus', city: 'Wichita', setting: 'Suburban' }], website: 'wichita.edu', kind: 'Public university', founded: 1895, about: 'A public research university in Kansas, known for aviation and engineering.', rate: 12, offerDays: 9, checked: today() }, 41),
    ip: 'ip-campusconnect',
    status: 'Setting up',
    added: inDays(-6),
    logins: [],
  },
];

export function sampleUniRecs(): UniRec[] {
  const list = [...UNIVERSITIES.map(record), ...extra()];
  const get = (id: string) => list.find((u) => u.id === id)!;
  // what the samples show: the Flinders set-up from the PM prototype, and who last changed some of it
  const f = get('flinders');
  f.territory = { mode: 'only', countries: ['India', 'Nepal', 'Sri Lanka', 'Bangladesh', 'Vietnam'], priority: ['India'], blocked: [{ country: 'India', state: 'Punjab' }], hiddenFrom: ['rp-delhi'] };
  f.forms = [{ id: nid('fm'), name: 'Flinders postgraduate international application form', file: 'Flinders_PG_international_application_form.pdf', for: 'Postgraduate' }];
  f.stamps = { territory: { by: 'Raj Shamani', at: `${inDays(-5)}T15:42` }, profile: { by: 'Kavya Menon', at: `${inDays(-20)}T11:05` }, forms: { by: 'Kavya Menon', at: `${inDays(-20)}T11:12` } };
  f.log = [
    logLine('Raj Shamani', 'territory', 'Only India, Nepal, Sri Lanka, Bangladesh and Vietnam can apply; India is a priority country; Punjab, India blocked; hidden from Capital Career Abroad', f.stamps.territory!.at),
    logLine('Kavya Menon', 'forms', 'Added Flinders postgraduate international application form (Postgraduate)', f.stamps.forms!.at),
    logLine('Kavya Menon', 'profile', 'Changed Search priority from 5 to 8', f.stamps.profile!.at),
  ];
  const m = get('massey');
  m.stamps = { status: { by: 'Leena Thomas', at: `${inDays(-243)}T09:30` } };
  m.log = [logLine('Leena Thomas', 'status', 'Paused: its partner’s agreement ended', m.stamps.status!.at)];
  return list;
}

/** A new university, with its basic details: set up, out of Course search, and the rest entered on its page. */
export function newUniRec(f: { name: string; utype: UniType; country: University['country']; website: string; ip: string; by: string }): UniRec {
  const id = `${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}`;
  const u = record({ id, name: f.name, country: f.country, campuses: [], website: f.website || undefined, rate: 15, offerDays: 7, checked: today(), college: f.utype === 'College' }, 50);
  return { ...u, ip: f.ip, status: 'Setting up', utype: f.utype, priority: PRIORITY_DEFAULT, created: { by: f.by, at: nowIso() }, log: [], cricos: '', state: '', images: [], logins: [], contacts: [], scholarships: [], territory: { mode: 'all', countries: [], priority: [], blocked: [], hiddenFrom: [] }, channel: '', link: '', added: inDays(0), stamps: {} };
}

/** A university as Course search reads it: its live campuses, its territory as blocks, and its partner's commission. */
export function forSearch(u: UniRec, p: InstitutionPartner | undefined): University {
  const t = u.territory;
  const states = new Map<string, string[]>();
  t.blocked.forEach((b) => states.set(b.country, [...(states.get(b.country) ?? []), b.state]));
  const out = t.mode === 'except' ? t.countries : t.mode === 'only' ? COUNTRIES.map((c) => c.name).filter((c) => !t.countries.includes(c)) : [];
  return {
    ...u,
    campuses: u.campuses.filter((c) => !u.inactive.includes(c.name)),
    priorityFor: t.priority,
    blocked: [...out.map((country) => ({ country })), ...[...states].filter(([c]) => !out.includes(c)).map(([country, s]) => ({ country, states: s }))],
    rate: p?.commission?.state === 'Active' ? p.commission.rate : u.rate,
  };
}

/** The countries a student can come from, for priority and blocked states. */
export const canApplyFrom = (t: Territory, all: string[]) => (t.mode === 'only' ? t.countries : all.filter((c) => !(t.mode === 'except' && t.countries.includes(c))));

/* ---------- courses ---------- */

/**
 * A course as the PM prototype's course record keeps it (29 Oct, 6th round): Basics (code, name, level, study area,
 * duration, campus, mode, its page on the university's website, post-study work visa, tags), Intakes (each with its
 * dates), Fees, Academic rules and English rules. No other fields, nothing automated. The shared course fields that
 * Course search reads (months, intakes, academic, IELTS, PTE, TOEFL, backlogs) follow from these when it's saved.
 */
/** 29 Oct (5th round, Nesil): no Needs a check. */
export const COURSE_STATUSES = ['Live', 'Draft', 'Hidden'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export const SOURCES = ['University website', 'StudyLink', 'Email', 'Added by hand', 'CSV upload'] as const;
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
export const TESTS = ['IELTS Academic', 'TOEFL iBT', 'PTE Academic', 'Duolingo'] as const;
export type Test = (typeof TESTS)[number];
/** What the second figure of each test is called. */
export const TEST_MIN: Record<Test, string> = { 'IELTS Academic': 'No band below', 'TOEFL iBT': 'Minimum in each section', 'PTE Academic': 'No part below', Duolingo: 'No subscore below' };

/** An intake's other dates, beside its application deadline (the shared intake's `deadline`). */
export type IntakeDates = { deposit: string; accept: string; start: string; census: string };
/** One row per country and qualification; no countries is every country. Backlogs: '' for no limit. */
export type AcademicRule = { id: string; countries: string[]; qual: Qualification; board: string; scale: Scale; min: number; backlogs: string; note: string };
/** 4 Nov (Nesil's reference): the least a student needs to have finished, for the whole course. */
export const MIN_EDUCATION = ['Grade 12', 'Diploma', 'Advanced diploma', 'Bachelor (3 years)', 'Bachelor (4 years)', 'Postgraduate diploma', 'Master’s degree'] as const;
export type MinEducation = (typeof MIN_EDUCATION)[number];
/** The course's academic entry (4 Nov), above its rules: the education, its grading scale, the minimum in it, and backlogs ('' for no limit). */
export type AcademicEntry = { edu: MinEducation | ''; scale: Scale | ''; min: number; backlogs: string };
export const blankEntry: AcademicEntry = { edu: '', scale: '', min: 0, backlogs: '' };
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
  /** 4 Nov: the academic entry for the whole course; the rules below it are for particular countries or qualifications. */
  entry: AcademicEntry;
  academicRules: AcademicRule[];
  englishRules: EnglishRule[];
  source: Source;
  tags: string[];
  /** Who added it, and when. */
  created: Stamp;
  /** Who last changed its status and each tab (basics, intakes, fees, academic, english). */
  stamps: Stamps;
  /** Every change, newest first (3 Nov: the Logs tab). */
  log: LogLine[];
};
/** Who changed a course last, and when: its latest stamp, or when it was added (3 Nov: the university's Courses tab). */
export const courseUpdated = (c: CourseRec) => lastStamp(c.stamps, c.created);

const MAJOR = ['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide', 'London', 'Birmingham', 'Manchester', 'Toronto', 'Vancouver', 'Dublin', 'Auckland'];
function tagsOf(c: Course): string[] {
  const t: string[] = [];
  if (c.offerDays <= 5) t.push('Faster offer TAT');
  if (c.scholarship) t.push('Scholarship available');
  if (c.englishFlex) t.push('English test waiver');
  if (c.placement) t.push('Co-op and built-in internships');
  if (MAJOR.includes(c.campus.city)) t.push('Major city');
  if (c.campus.regional) t.push('Regional university (Australia)');
  if (c.psw) t.push('Post-study work visa');
  return t;
}
const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
let rid = 0;
const ruleId = () => `r${(++rid).toString(36)}`;
/** The least education each program level asks for (sample data). */
const ENTRY_FOR: Partial<Record<Level, MinEducation>> = { Foundation: 'Grade 12', Diploma: 'Grade 12', 'Bachelor’s degree': 'Grade 12', 'Postgraduate diploma': 'Bachelor (3 years)', 'Master’s degree': 'Bachelor (3 years)', 'PhD or research': 'Master’s degree' };
export const newRuleId = ruleId;

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
    dates: Object.fromEntries(c.intakes.map((x) => [x.month, { deposit: plusDays(x.deadline, 30), accept: '', start: '', census: '' }])),
    // 4 Nov: the course's academic entry holds what its one rule for everyone used to
    entry: { edu: ENTRY_FOR[c.level] ?? 'Grade 12', scale: 'Percentage', min: c.academic, backlogs: c.backlogs !== undefined ? String(c.backlogs) : '' },
    academicRules: [],
    englishRules: [
      { id: ruleId(), countries: [], test: 'IELTS Academic', overall: c.ielts[0], min: c.ielts[1], note: '' },
      { id: ruleId(), countries: [], test: 'TOEFL iBT', overall: c.toefl[0], min: c.toefl[1], note: '' },
      { id: ruleId(), countries: [], test: 'PTE Academic', overall: c.pte[0], min: c.pte[1], note: '' },
    ],
    source: i % 10 === 3 ? 'Added by hand' : i % 5 === 1 ? 'StudyLink' : 'University website',
    tags: tagsOf(c),
    created: sampleStamp(i, 40 + ((i * 37) % 300)),
    // the 2027 fees Kavya entered for Flinders
    stamps: c.uni.id === 'flinders' ? { fees: { by: 'Kavya Menon', at: `${inDays(-8)}T14:20` } } : {},
    log: c.uni.id === 'flinders' ? [logLine('Kavya Menon', 'fees', 'Entered the 2027 fees', `${inDays(-8)}T14:20`)] : [],
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
  // 4 Nov: the course's academic entry first, when it's a percentage; then its rules
  const e = c.entry;
  const academic = e.scale === 'Percentage' && e.min > 0 ? e.min : pct?.min ?? 0;
  const backlogs = e.backlogs !== '' ? Number(e.backlogs) : back ? Number(back.backlogs) : undefined;
  // Course search shows tuition a year: the full course fee over the years it takes (one, for a course under a year)
  const tuition = c.fullFee > 0 ? Math.round(c.fullFee / Math.max(1, months / 12)) : c.tuition;
  return { ...c, months, tuition, academic, backlogs, ielts: test('IELTS Academic', c.ielts), toefl: test('TOEFL iBT', c.toefl), pte: test('PTE Academic', c.pte) };
}

/** Course search shows live courses at live universities. */
export const searchable = (c: CourseRec) => c.status === 'Live';
export const coursesOf = <T extends Course>(courses: T[], uniId: string) => courses.filter((c) => c.uni.id === uniId);
