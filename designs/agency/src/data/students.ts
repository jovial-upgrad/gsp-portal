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
import { TESTS, type Test, type TestType } from './tests';

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

export const STUDY_LEVELS: Record<Level, string[]> = {
  pg: ['Master’s degree', 'Postgraduate diploma', 'PhD'],
  ug: ['Bachelor’s degree', 'Advanced diploma', 'Diploma'],
  g12: ['Grade 12 (higher secondary)', 'A levels', 'IB Diploma', 'Diploma after Grade 10'],
  g10: ['Grade 10 (secondary)', 'O levels', 'IGCSE'],
};
/** A student's grading system: the numeric scales of the one list (data/grading.ts). */
export type Grading = '' | '100' | '10' | '7' | '5' | '4';
export const GRADING: [Grading, string][] = GRADING_SCALES.filter((g) => g.max).map((g) => [g.key as Grading, g.label]);
export const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Nepali', 'Sinhala', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Gujarati', 'Punjabi', 'Urdu', 'Vietnamese', 'Other'];

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
};
export const emptyEdu = (country = ''): Edu => ({ country, state: '', level: '', institution: '', qualification: '', grading: '', score: '', language: '', backlogs: '', start: '', end: '' });

/** A score that fits its grading system. */
export const scoreOk = (e: Pick<Edu, 'grading' | 'score'>) => {
  const v = Number(e.score);
  return !!e.grading && e.score.trim() !== '' && !Number.isNaN(v) && v >= 0 && v <= Number(e.grading);
};
/** Roughly what the score is as a percentage (CGPA out of 10 uses the common × 9.5). */
export function pctOf(e: Pick<Edu, 'grading' | 'score'>) {
  if (!scoreOk(e)) return null;
  const v = Number(e.score);
  return Math.min(100, Math.round(e.grading === '100' ? v : e.grading === '10' ? v * 9.5 : (v / Number(e.grading)) * 100));
}

/** The fields an education level needs, in order, with how each is named when it's missing. */
export function eduFields(l: Level, e: Edu) {
  const hasStates = (countryByName(e.country)?.states.length ?? 0) > 0;
  return (
    [
      ['country', 'country', !!e.country],
      ['state', 'state', !hasStates || !!e.state],
      ['level', 'program level', !!e.level],
      ['institution', isSchool(l) ? 'school board' : 'university', !!e.institution.trim()],
      ['qualification', isSchool(l) ? 'qualification' : 'degree', !!e.qualification.trim()],
      ['grading', 'grading system', !!e.grading],
      ['score', 'score', scoreOk(e)],
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
export type StudentApp = { id: string; course: string; uni: string; intake: string; owner: Owner | 'done' | 'end'; status: string };
export type Gender = '' | 'Male' | 'Female' | 'Other';

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
  // the profile
  gender: Gender;
  /** DD/MM/YYYY */
  dob: string;
  passportExpiry: string;
  /** Where the student lives now, which decides the courses they can apply to. */
  country: string;
  state: string;
  city: string;
  eduCountry: string;
  edu: Partial<Record<Level, Edu>>;
  work: Work[];
  tests: Test[];
  visa: '' | 'yes' | 'no';
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

/** What a team member can do: an RP Admin runs the whole agency, a Branch Admin one branch, a Counsellor their own students. */
export type TeamRole = 'RP Admin' | 'Branch Admin' | 'Counsellor';
/** Someone on the agency's team: their contact, role and branch; `invited` until they accept the invitation. */
export type Member = { id: string; name: string; role: TeamRole; email?: string; dial?: string; phone?: string; branch?: string; invited?: boolean; /** The RP whose team they're on (GSP's lists hold every RP's). */ rp?: string };

export const fullName = (s: Pick<Student, 'first' | 'last'>) => [s.first, s.last].filter(Boolean).join(' ');
export const initialsOf = (s: Pick<Student, 'first' | 'last'>) => ((s.first[0] ?? '') + (s.last[0] ?? s.first[1] ?? '')).toUpperCase();

/** A city list for the states most students come from; elsewhere the city is typed (HC14: data/geo.json). */
export { CITIES, citiesOf } from './partners';

/**
 * How ready a profile is to apply with. Only what's mandatory counts: the personal details with a copy of the
 * passport, and every field of the highest education with its marksheet or transcript. Work experience,
 * tests, background and additional documents are optional and never make a section incomplete.
 */
export function readiness(s: Student) {
  const hasStates = (countryByName(s.country)?.states.length ?? 0) > 0;
  const personal = (
    [
      ['last name', s.oneName || !!s.last.trim()],
      ['phone', s.phone.replace(/\D/g, '').length >= 7],
      ['passport number', !!s.passport],
      ['gender', !!s.gender],
      ['date of birth', !!parseDate(s.dob)],
      ['current country', !!s.country],
      ['state', !hasStates || !!s.state],
      ['city', !!s.city.trim()],
      ['passport copy', !!s.docs.passport],
    ] as [string, boolean][]
  )
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  const top = s.edu[s.highest] ?? emptyEdu();
  const education = [
    ...eduFields(s.highest, top)
      .filter(([, , ok]) => !ok)
      .map(([, label]) => label),
    ...(s.docs[eduDocKey(s.highest)] ? [] : [eduDocName(s.highest).toLowerCase()]),
  ];
  // additional documents: anything that isn't the passport, a marksheet, a transcript or a score report
  const extra = Object.keys(s.docs).filter((k) => k !== 'passport' && !k.startsWith('edu-') && !k.startsWith('test-')).length;
  const sections = [
    { key: 'personal', label: 'Personal details', missing: personal },
    { key: 'education', label: 'Education', missing: education },
    { key: 'work', label: 'Work experience', optional: true, missing: [] as string[], filled: s.work.length },
    { key: 'tests', label: 'Tests', optional: true, missing: [] as string[], filled: s.tests.length },
    { key: 'background', label: 'Background', optional: true, missing: [] as string[], filled: (s.visa ? 1 : 0) + (s.disability ? 1 : 0) },
    { key: 'documents', label: 'Additional documents', optional: true, missing: [] as string[], filled: extra },
  ];
  // first, nationality and email come with every student; the rest is counted (the passport copy and the education document included)
  const total = 3 + 10 + eduFields(s.highest, top).length + 1;
  const toAdd = personal.length + education.length;
  return { sections, toAdd, pct: Math.round(((total - toAdd) / total) * 100), complete: toAdd === 0 };
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
