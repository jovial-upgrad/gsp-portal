/**
 * Students and their profiles. A student is added with a few basics (names, nationality, email, phone,
 * passport number, highest education); the profile is completed later: personal details, education, work
 * experience, tests, background and documents. The passport and the highest education are the two
 * documents every application needs, and the highest education's details are required.
 */
import { countryByName } from './partners';
import { parseDate, parseMonth } from './dates';
import { datasetStudents, testAgencyStudents } from './dataset';
import { GRADING_SCALES } from './grading';
import { bandNamed, grades, systemOf, toPct } from '../admin/data/eligibility';
import { TESTS, type Test, type TestType } from './tests';
import { CARD_LEVELS, LANGUAGES_OF_INSTRUCTION, MARRIED, OTHER_GRADING, STUDENT_GRADING } from './reference';

/* ---------- education ---------- */

export type Level = 'pg' | 'ug' | 'g12' | 'g10';
export const LEVELS: Level[] = ['pg', 'ug', 'g12', 'g10'];
export const LEVEL_NAME: Record<Level, string> = { pg: 'Postgraduate', ug: 'Undergraduate', g12: 'Grade 12', g10: 'Grade 10' };
export const HIGHEST: [Level, string][] = [
  ['pg', 'Postgraduate (master’s or PG diploma)'],
  ['ug', 'Undergraduate (bachelor’s or diploma)'],
  ['g12', 'Grade 12 or equivalent'],
  ['g10', 'Grade 10 or equivalent'],
];
/** The highest level and every level below it. */
export const levelsFor = (h: Level) => LEVELS.slice(LEVELS.indexOf(h));
export const isSchool = (l: Level) => l === 'g12' || l === 'g10';

/** Program levels per Academics card: reference data (S3F-4, data/reference.ts). */
export const STUDY_LEVELS = CARD_LEVELS as Record<Level, string[]>;
/**
 * A student's grading system (slice 3 PRD): picked from Admin › Course configuration › Grade conversion, its active
 * systems (a retired one stays on the entries that have it, S3C-18). Older records hold a scale key ('100', '10', '4',
 * '5'), read as Percentage, CGPA out of 10, GPA out of 4 and GPA out of 5.
 */
export type Grading = string;
/**
 * The picker's options: [value, label], from the reference list (data/reference.ts STUDENT_GRADING, 4 Nov: labels
 * without country names, then Others). The value is the Grade conversion system's name, so the eligibility check
 * converts it; a system Admin retired isn't offered. The record's current one is kept when it's retired or an older key.
 */
export const gradingOptions = (current = ''): [string, string][] => {
  const active = grades().filter((g) => g.status === 'Active');
  const list = STUDENT_GRADING.flatMap((r): [string, string][] => {
    if (!r.system) return [[r.label, r.label]];
    const sys = active.find((g) => g.id === r.system);
    return sys ? [[sys.name, r.label]] : [];
  });
  const cur = current ? systemOf(current) : undefined;
  if (!current || list.some(([k]) => k === current)) return list;
  // an older record's scale key ('10') for a system on the list: that option, under the key the record holds
  const same = cur && list.find(([k]) => k === cur.name);
  if (same) return list.map((o) => (o === same ? [current, same[1]] : o));
  return [[current, cur ? `${cur.name}${cur.status === 'Retired' ? ' (retired)' : ''}` : current], ...list];
};
/** @deprecated the fixed scales before Admin's list; kept for the readers that still import it. */
export const GRADING: [Grading, string][] = GRADING_SCALES.filter((g) => g.max).map((g) => [g.key as Grading, g.label]);
/** The top of a grading system's scale, for its numbers ("out of 10"); undefined for grades (bands with labels). */
export function scaleMax(grading: string): number | undefined {
  const s = systemOf(grading);
  if (!s) return Number(grading) || undefined;
  const named = /out of (\d+)/i.exec(s.name)?.[1];
  if (named) return Number(named);
  if (s.by === 'As is') return 100;
  if (s.by === 'Multiplier') return Math.round((100 / (s.mult ?? 1)) * 100) / 100;
  const nums = s.bands.flatMap((b) => [Number(b.from), Number(b.to)]).filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : undefined;
}
/** Languages of instruction: reference data (S3F-4, data/reference.ts). */
export const LANGUAGES = LANGUAGES_OF_INSTRUCTION as string[];

export type Edu = {
  country: string;
  state: string;
  level: string;
  institution: string;
  qualification: string;
  grading: Grading;
  score: string;
  language: string;
  backlogs: string;
  /** MM/YYYY */
  start: string;
  end: string;
  /** With grading system Others: how the student was graded (4 Nov). */
  gradingNote?: string;
};
export const emptyEdu = (country = ''): Edu => ({ country, state: '', level: '', institution: '', qualification: '', grading: '', score: '', language: '', backlogs: '', start: '', end: '' });
/** Graded some other way: no conversion, a description instead (4 Nov). */
export const isOtherGrading = (g: string) => g === OTHER_GRADING;

/** A score that fits its grading system: a number on its scale, or one of its grades for band systems. */
export const scoreOk = (e: Pick<Edu, 'grading' | 'score'>) => {
  if (!e.grading || e.score.trim() === '') return false;
  if (isOtherGrading(e.grading)) return true;
  const s = systemOf(e.grading);
  if (s?.by === 'Bands' && s.bands.some((b) => bandNamed(b, e.score))) return true;
  const v = Number(e.score);
  const max = scaleMax(e.grading);
  return !Number.isNaN(v) && v >= 0 && (max === undefined || v <= max);
};
/** The score as a percentage, with Admin's Grade conversion (S3-15). */
export function pctOf(e: Pick<Edu, 'grading' | 'score'>) {
  if (!scoreOk(e)) return null;
  const p = toPct(systemOf(e.grading), e.score);
  return p === null ? null : Math.round(p);
}

/**
 * The fields an education level needs, in order, with how each is named when it's missing. Kept light (admissions
 * feedback, 4 Nov): the university or school board, its state and the score are optional (a score that's there still
 * has to fit its grading system); Others needs its description.
 */
export function eduFields(l: Level, e: Edu) {
  return (
    [
      ['country', 'country', !!e.country],
      ['level', 'program level', !!e.level],
      ['qualification', isSchool(l) ? 'qualification' : 'degree', !!e.qualification.trim()],
      ['grading', 'grading system', !!e.grading],
      ...(isOtherGrading(e.grading) ? [['gradingNote', 'grading description', !!e.gradingNote?.trim()]] : []),
      ['score', 'score', e.score.trim() === '' || scoreOk(e)],
      ['language', 'language of instruction', !!e.language],
      ...(isSchool(l) ? [] : [['backlogs', 'backlogs', e.backlogs.trim() !== '' && Number(e.backlogs) >= 0]]),
      ['start', 'start date', !!parseMonth(e.start)],
      ['end', 'end date', !!parseMonth(e.end)],
    ] as [keyof Edu, string, boolean][]
  );
}

/* ---------- work and tests ---------- */

export type Work = { id: string; org: string; role: string; from: string; to: string; current: boolean };

// the tests: one table (HC15), data/tests.ts
export { TESTS, TEST_ORDER, ENGLISH_TESTS, inRange, rangeText, testSummary, testMissing, type TestType, type TestDef, type Test } from './tests';

/* ---------- documents ---------- */

export type DocStatus = 'uploaded' | 'checking' | 'verified';
export type Doc = { name: string; file: string; status: DocStatus };
export const eduDocKey = (l: Level) => `edu-${l}`;
export const eduDocName = (l: Level) => (isSchool(l) ? `${LEVEL_NAME[l]} marksheet` : `${LEVEL_NAME[l]} transcript and degree certificate`);
export const testDocKey = (t: Test) => `test-${t.id}`;
export const testDocName = (t: Test) => `${TESTS[t.type].name} score report`;
/** Documents the student can add any time, used by some applications. */
export const EXTRA_DOCS: [string, string, string][] = [
  ['cv', 'CV', 'Most postgraduate applications ask for one.'],
  ['sop', 'Statement of purpose', 'Written for each application; keep the latest here.'],
  ['lor', 'Letters of recommendation', 'From teachers or employers.'],
  ['work', 'Work experience letters', 'From each employer, with dates and role.'],
];

/* ---------- the student ---------- */

export type Owner = 'you' | 'gsp' | 'uni';
/** An application as the student's record shows it; the Applications page holds the application itself. */
export type StudentApp = { id: string; course: string; uni: string; intake: string; owner: Owner | 'done' | 'end' | 'wd'; status: string };
export type Gender = '' | 'Male' | 'Female' | 'Other';
/** A postal address (4 Nov: used for application lodgement). */
export type Address = { line1: string; line2: string; city: string; state: string; postcode: string; country: string };
export const emptyAddress = (country = ''): Address => ({ line1: '', line2: '', city: '', state: '', postcode: '', country });
/** A visa refusal: the country, which visa or document, and when (MM/YYYY). */
export type Refusal = { id: string; country: string; visa: string; when: string };
export const emptyRefusal = (id: string): Refusal => ({ id, country: '', visa: '', when: '' });

export type Student = {
  id: string;
  first: string;
  last: string;
  /** Some passports carry one name only. */
  oneName?: boolean;
  nationality: string;
  email: string;
  dial: string;
  phone: string;
  passport: string;
  highest: Level;
  /** Highest education in the one list (S3C-1), when it was picked; else read from `highest` (data/eligibility.ts). */
  highestEd?: import('./education').HighestEducation;
  // the profile
  gender: Gender;
  /** DD/MM/YYYY */
  dob: string;
  passportExpiry: string;
  /** Where the student lives now, which decides the courses they can apply to. */
  country: string;
  state: string;
  city: string;
  /** The rest of the present address (4 Nov): its country, state and city are the three above. */
  addr1?: string;
  addr2?: string;
  postcode?: string;
  /** Permanent address: the same as the present one, or its own. */
  permSame?: boolean;
  perm?: Address;
  eduCountry: string;
  edu: Partial<Record<Level, Edu>>;
  work: Work[];
  tests: Test[];
  /** Background (4 Nov): marital status (mandatory, data/reference.ts MARITAL_STATUSES) and, if married, the date (DD/MM/YYYY). */
  marital?: string;
  marriedOn?: string;
  /** Ever refused a visa (mandatory to answer); each refusal when yes. `visaNote` is the older free-text answer. */
  visa: '' | 'yes' | 'no';
  refusals?: Refusal[];
  /** Accompanying spouse or dependents (optional), and how many. */
  dependants?: '' | 'yes' | 'no';
  dependantsCount?: string;
  /** The recruitment partner the student is with, when GSP adds them (30 Oct); an agency's own students have none. */
  rp?: string;
  visaNote: string;
  disability: '' | 'yes' | 'no' | 'na';
  disabilityNote: string;
  docs: Record<string, Doc>;
  /** Fields read from an uploaded document, until someone edits them. */
  read: string[];
  /**
   * The documents already used to fill the profile in, by their key in `docs` (passport, edu-ug, test-…, cv), and
   * when. Autofill is one-time (1 Nov, with engineering): after it, the part is corrected by hand.
   */
  filled?: Record<string, number>;
  // around the student
  counsellor: string;
  added: number;
  addedBy: string;
  apps: StudentApp[];
  /** Courses shortlisted for the student in Find courses, by id. */
  shortlist?: string[];
};

/** What a team member can do: an RP Admin runs the whole agency, a Branch Manager one branch, a Counsellor their own students. */
export type TeamRole = 'RP Admin' | 'Branch Manager' | 'Counsellor';
/** Someone on the agency's team: their contact, role and branch; `invited` until they accept the invitation. */
export type Member = { id: string; name: string; role: TeamRole; email?: string; dial?: string; phone?: string; branch?: string; invited?: boolean; /** The RP whose team they're on (GSP's lists hold every RP's). */ rp?: string };

export const fullName = (s: Pick<Student, 'first' | 'last'>) => [s.first, s.last].filter(Boolean).join(' ');
export const initialsOf = (s: Pick<Student, 'first' | 'last'>) => ((s.first[0] ?? '') + (s.last[0] ?? s.first[1] ?? '')).toUpperCase();

/** A city list for the states most students come from; elsewhere the city is typed (HC14: data/geo.json). */
export { CITIES, citiesOf } from './partners';

/**
 * How ready a profile is to apply with (lock answer S3C-17, Jovial, 2 Nov: "only required fields"): only the
 * required fields count, the personal details and every field of the highest education. Documents don't count (no
 * passport copy, no marksheet or transcript); work experience, tests, background and additional documents are
 * optional and never make a section incomplete. 100% is ready to apply.
 */
export function readiness(s: Student) {
  const hasStates = (countryByName(s.country)?.states.length ?? 0) > 0;
  const checks = (
    [
      ['last name', s.oneName || !!s.last.trim()],
      ['phone', s.phone.replace(/\D/g, '').length >= 7],
      ['passport number', !!s.passport],
      ['gender', !!s.gender],
      ['date of birth', !!parseDate(s.dob)],
      ['current country', !!s.country],
      ['state', !hasStates || !!s.state],
      ['city', !!s.city.trim()],
      // the present address's own lines (4 Nov), and the permanent address
      ['address line 1', !!s.addr1?.trim()],
      ['postcode', !!s.postcode?.trim()],
      ['permanent address', !!s.permSame || addressMissing(s.perm).length === 0],
    ] as [string, boolean][]
  );
  const personal = checks
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  const bg = backgroundChecks(s);
  const background = bg.filter(([, ok]) => !ok).map(([k]) => k);
  const top = s.edu[s.highest] ?? emptyEdu();
  const education = eduFields(s.highest, top)
    .filter(([, , ok]) => !ok)
    .map(([, label]) => label);
  // additional documents: anything that isn't the passport, a marksheet, a transcript or a score report
  const extra = Object.keys(s.docs).filter((k) => k !== 'passport' && !k.startsWith('edu-') && !k.startsWith('test-')).length;
  const sections = [
    { key: 'personal', label: 'Personal details', missing: personal },
    { key: 'education', label: 'Education', missing: education },
    { key: 'work', label: 'Work experience', optional: true, missing: [] as string[], filled: s.work.length },
    { key: 'tests', label: 'Tests', optional: true, missing: [] as string[], filled: s.tests.length },
    // mandatory from 4 Nov: marital status and the visa refusal question
    { key: 'background', label: 'Background', missing: background },
    { key: 'documents', label: 'Additional documents', optional: true, missing: [] as string[], filled: extra },
  ];
  // first, nationality and email come with every student; the rest is counted (fields only, no documents: S3C-17)
  const total = 3 + checks.length + eduFields(s.highest, top).length + bg.length;
  const toAdd = personal.length + education.length + background.length;
  return { sections, toAdd, pct: Math.round(((total - toAdd) / total) * 100), complete: toAdd === 0 };
}

/** What an address still needs, by name: line 1, city, state (where the country has states), postcode, country. */
export function addressMissing(a?: Address): string[] {
  const x = a ?? emptyAddress();
  const hasStates = (countryByName(x.country)?.states.length ?? 0) > 0;
  return (
    [
      ['address line 1', !!x.line1.trim()],
      ['city', !!x.city.trim()],
      ['state or province', !hasStates || !!x.state],
      ['postcode', !!x.postcode.trim()],
      ['country', !!x.country],
    ] as [string, boolean][]
  )
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
}
/** A refusal with its country, visa and month. */
export const refusalOk = (r: Refusal) => !!r.country && !!r.visa.trim() && !!parseMonth(r.when);
/** Background's mandatory answers (4 Nov), each with how it's named when it's missing. */
export function backgroundChecks(s: Student): [string, boolean][] {
  return [
    ['marital status', !!s.marital],
    ...(s.marital === MARRIED ? ([['marriage date', !!parseDate(s.marriedOn ?? '')]] as [string, boolean][]) : []),
    ['visa refusal answer', !!s.visa],
    // an older record's free-text answer counts until someone edits it
    ...(s.visa === 'yes' ? ([['visa refusal details', s.refusals?.length ? s.refusals.every(refusalOk) : !!s.visaNote.trim()]] as [string, boolean][]) : []),
  ];
}

/* ---------- reading documents (OCR in the real product; sample values here) ---------- */

/** What the passport page reads as. A file named after a person uses that name. */
export function readPassport(fileName: string) {
  const words = fileName
    .replace(/\.\w+$/, '')
    .replace(/passport|photo|page|scan|img|image|copy|front|back/gi, ' ')
    .replace(/[^a-z\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1).toLowerCase();
  const named = words.length >= 2;
  return {
    first: named ? cap(words[0]) : 'Arjun',
    last: named ? words.slice(1).map(cap).join(' ') : 'Nair',
    dob: '19/05/2002',
    gender: 'Male' as Gender,
    nationality: 'India',
    passport: 'W4831726',
    passportExpiry: '11/02/2033',
  };
}

/** What a resume reads as: the jobs on it (sample values). */
export function readResume(): Omit<Work, 'id'>[] {
  return [
    { org: 'Infosys', role: 'Systems engineer', from: '07/2023', to: '', current: true },
    { org: 'Tata Consultancy Services', role: 'Intern, data analytics', from: '01/2023', to: '06/2023', current: false },
  ];
}

/** What a marksheet or transcript reads as, for each level. */
export function readEducation(l: Level, country: string, state: string): Edu {
  const base = { ...emptyEdu(country), state: country === 'India' ? state || 'Karnataka' : state, language: 'English' };
  if (l === 'pg') return { ...base, level: 'Master’s degree', institution: 'Bangalore University', qualification: 'M.Com, Finance', grading: '100', score: '68', backlogs: '0', start: '08/2022', end: '06/2024' };
  if (l === 'ug') return { ...base, level: 'Bachelor’s degree', institution: 'Visvesvaraya Technological University', qualification: 'B.E., Computer Science', grading: '10', score: '7.8', backlogs: '0', start: '08/2019', end: '06/2023' };
  if (l === 'g12') return { ...base, level: 'Grade 12 (higher secondary)', institution: 'Karnataka School Examination and Assessment Board', qualification: 'PUC, Science (PCMB)', grading: '100', score: '84', start: '06/2017', end: '03/2019' };
  return { ...base, level: 'Grade 10 (secondary)', institution: 'CBSE', qualification: 'Secondary School Certificate', grading: '10', score: '9.2', start: '06/2016', end: '03/2017' };
}

/** What a score report reads as, for each test. */
export function readTest(type: TestType): Pick<Test, 'cert' | 'date' | 'overall' | 'parts'> {
  const r: Record<TestType, Pick<Test, 'cert' | 'date' | 'overall' | 'parts'>> = {
    IELTS: { cert: '26IN004512NAIA012A', date: '12/08/2026', overall: '7.0', parts: { l: '7.5', r: '7.0', w: '6.5', s: '7.0' } },
    TOEFL: { cert: '0000 2468 1357 9024', date: '03/07/2026', overall: '98', parts: { l: '26', r: '25', w: '23', s: '24' } },
    PTE: { cert: 'PTE-ACA-8841-2207', date: '21/06/2026', overall: '65', parts: { l: '66', r: '63', w: '68', s: '62' } },
    Duolingo: { cert: 'DET-7C21A9F0', date: '02/09/2026', overall: '120', parts: { lit: '125', comp: '120', conv: '110', prod: '115' } },
    SAT: { cert: 'SAT-55120347', date: '04/10/2025', overall: '1380', parts: { rw: '680', math: '700', essay: '6' } },
    ACT: { cert: 'ACT-11872034', date: '13/09/2025', overall: '29', parts: { math: '30', reading: '28', science: '29', english: '29', writing: '8' } },
    GMAT: { cert: 'GMAT-0198-4472', date: '18/05/2026', overall: '660', parts: { q: '47', v: '35', awa: '5.0', ir: '6' } },
    GRE: { cert: 'GRE-7741023', date: '27/04/2026', overall: '318', parts: { q: '162', v: '156', awa: '4.0' } },
  };
  return r[type];
}

/* ---------- sample students ---------- */

/**
 * Every student: the GSP test agency's own five (HC13, 1 Nov: in the data set, scripts/test_agency.json; one just
 * added with an incomplete profile, four complete with applications), then the students of every other application
 * GSP has (data/dataset.ts). `me` is the person signed in.
 */
export function sampleStudents(me: string): Student[] {
  return [...testAgencyStudents(me), ...datasetStudents(me)];
}
