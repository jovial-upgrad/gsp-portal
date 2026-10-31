/**
 * Students and their profiles. A student is added with a few basics (names, nationality, email, phone,
 * passport number, highest education); the profile is completed later: personal details, education, work
 * experience, tests, background and documents. The passport and the highest education are the two
 * documents every application needs, and the highest education's details are required.
 */
import { countryByName } from './partners';
import { parseDate, parseMonth } from './dates';
import { datasetStudents } from './dataset';

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
export const GRADING: [Grading, string][] = [
  ['100', 'Percentage (out of 100)'],
  ['10', 'CGPA out of 10'],
  ['7', 'CGPA out of 7'],
  ['5', 'CGPA out of 5'],
  ['4', 'GPA out of 4'],
];
export type Grading = '' | '100' | '10' | '7' | '5' | '4';
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

export type TestType = 'IELTS' | 'TOEFL' | 'PTE' | 'DET' | 'SAT' | 'ACT' | 'GMAT' | 'GRE';
type Range = [number, number, number];
export type TestDef = {
  name: string;
  kind: 'English' | 'Admission';
  cert: string;
  overall: Range;
  parts: { key: string; label: string; range: Range; optional?: boolean }[];
  /** How long a score is accepted. */
  years: number;
};
const band = (key: string, label: string, range: Range) => ({ key, label, range });
const LRWS = (r: Range) => [band('l', 'Listening', r), band('r', 'Reading', r), band('w', 'Writing', r), band('s', 'Speaking', r)];
export const TESTS: Record<TestType, TestDef> = {
  IELTS: { name: 'IELTS Academic', kind: 'English', cert: 'Test Report Form number', overall: [0, 9, 0.5], parts: LRWS([0, 9, 0.5]), years: 2 },
  TOEFL: { name: 'TOEFL iBT', kind: 'English', cert: 'Appointment number', overall: [0, 120, 1], parts: LRWS([0, 30, 1]), years: 2 },
  PTE: { name: 'PTE Academic', kind: 'English', cert: 'Score report code', overall: [10, 90, 1], parts: LRWS([10, 90, 1]), years: 2 },
  DET: { name: 'Duolingo English Test', kind: 'English', cert: 'Certificate ID', overall: [10, 160, 5], parts: [], years: 2 },
  SAT: {
    name: 'SAT',
    kind: 'Admission',
    cert: 'Score report ID',
    overall: [400, 1600, 10],
    parts: [band('rw', 'Reading and writing', [200, 800, 10]), band('math', 'Math', [200, 800, 10]), { ...band('essay', 'Essay', [2, 8, 1]), optional: true }],
    years: 5,
  },
  ACT: {
    name: 'ACT',
    kind: 'Admission',
    cert: 'ACT ID',
    overall: [1, 36, 1],
    parts: [band('math', 'Math', [1, 36, 1]), band('reading', 'Reading', [1, 36, 1]), band('science', 'Science', [1, 36, 1]), band('english', 'English', [1, 36, 1]), { ...band('writing', 'Writing', [2, 12, 1]), optional: true }],
    years: 5,
  },
  GMAT: {
    name: 'GMAT',
    kind: 'Admission',
    cert: 'Score report ID',
    overall: [200, 800, 10],
    parts: [band('q', 'Quantitative', [6, 51, 1]), band('v', 'Verbal', [6, 51, 1]), band('awa', 'Analytical writing', [0, 6, 0.5]), band('ir', 'Integrated reasoning', [1, 8, 1])],
    years: 5,
  },
  GRE: {
    name: 'GRE General',
    kind: 'Admission',
    cert: 'Registration number',
    overall: [260, 340, 1],
    parts: [band('q', 'Quantitative', [130, 170, 1]), band('v', 'Verbal', [130, 170, 1]), band('awa', 'Analytical writing', [0, 6, 0.5])],
    years: 5,
  },
};
export const TEST_ORDER: TestType[] = ['IELTS', 'TOEFL', 'PTE', 'DET', 'SAT', 'ACT', 'GMAT', 'GRE'];
export type Test = { id: string; type: TestType; cert: string; /** DD/MM/YYYY */ date: string; overall: string; parts: Record<string, string> };

/** A score inside its range and on its steps (IELTS goes up in halves). */
export function inRange(v: string, [min, max, step]: Range) {
  if (v.trim() === '') return false;
  const n = Number(v);
  return !Number.isNaN(n) && n >= min && n <= max && Math.abs((n - min) / step - Math.round((n - min) / step)) < 1e-6;
}
export const rangeText = ([min, max, step]: Range) => `${min} to ${max}${step !== 1 ? `, in steps of ${step}` : ''}`;

/** A one-line summary: "IELTS 7.0 (no band below 6.5)". */
export function testSummary(t: Test) {
  const d = TESTS[t.type];
  if (!t.overall) return d.name;
  const bands = d.parts.filter((p) => !p.optional).map((p) => Number(t.parts[p.key])).filter((n) => !Number.isNaN(n) && t.parts);
  const low = d.kind === 'English' && bands.length === d.parts.length && bands.length ? Math.min(...bands) : null;
  return `${t.type === 'DET' ? 'Duolingo' : t.type} ${t.type === 'IELTS' ? Number(t.overall).toFixed(1) : t.overall}${low !== null ? ` (no band below ${t.type === 'IELTS' ? low.toFixed(1) : low})` : ''}`;
}

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
  // around the student
  counsellor: string;
  added: number;
  addedBy: string;
  apps: StudentApp[];
  /** The passport is on a student at another agency: GSP asks the student which agency they want. */
  consentCheck?: boolean;
  /** Courses shortlisted for the student in Find courses, by id. */
  shortlist?: string[];
};

/** What a team member can do: an RP Admin runs the whole agency, a Branch Admin one branch, a Counsellor their own students. */
export type TeamRole = 'RP Admin' | 'Branch Admin' | 'Counsellor';
/** Someone on the agency's team: their contact, role and branch; `invited` until they accept the invitation. */
export type Member = { id: string; name: string; role: TeamRole; email?: string; dial?: string; phone?: string; branch?: string; invited?: boolean; /** The RP whose team they're on (GSP's lists hold every RP's). */ rp?: string };

/** The agency's team (sample): the person signed in, its RP Admin, and two counsellors, at the head office and a branch. */
export const teamFor = (me: string, email = 'asha@brightpathoverseas.in'): Member[] => {
  // the colleagues' addresses are the agency's own domain; the test account signs in with an upGrad address (W21)
  const own = email.split('@')[1] ?? 'brightpathoverseas.in';
  const domain = /^up(grad|gard)\.com$/.test(own) ? 'gsptestagency.in' : own;
  return [
    { id: 'me', name: me, role: 'RP Admin', email, dial: '+91', phone: '98450 12345', branch: 'hq' },
    { id: 'karthik', name: 'Karthik Nair', role: 'Counsellor', email: `karthik.nair@${domain}`, dial: '+91', phone: '98450 22113', branch: 'hq' },
    { id: 'divya', name: 'Divya Shetty', role: 'Counsellor', email: `divya.shetty@${domain}`, dial: '+91', phone: '98201 76420', branch: 'mumbai' },
  ];
};

export const fullName = (s: Pick<Student, 'first' | 'last'>) => [s.first, s.last].filter(Boolean).join(' ');
export const initialsOf = (s: Pick<Student, 'first' | 'last'>) => ((s.first[0] ?? '') + (s.last[0] ?? s.first[1] ?? '')).toUpperCase();

/** A city list for the states most students come from; elsewhere the city is typed. */
export const CITIES: Record<string, string[]> = {
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'],
  Telangana: ['Hyderabad', 'Warangal', 'Karimnagar'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
  Delhi: ['New Delhi'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Mohali'],
  Haryana: ['Gurugram', 'Faridabad', 'Karnal', 'Ambala'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
  'Uttar Pradesh': ['Lucknow', 'Noida', 'Kanpur', 'Varanasi'],
  'West Bengal': ['Kolkata', 'Siliguri', 'Durgapur'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Gwalior'],
  'Bagmati Zone': ['Kathmandu', 'Lalitpur', 'Bhaktapur'],
  'Gandaki Zone': ['Pokhara'],
  'Dhaka Division': ['Dhaka', 'Gazipur', 'Narayanganj'],
  'Chittagong Division': ['Chattogram', 'Cox’s Bazar'],
  'Western Province': ['Colombo', 'Negombo', 'Kalutara'],
};

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

/** Passports already on students at other agencies (sample). */
export const OTHER_AGENCY_PASSPORTS = ['N4417720', 'P7712045'];

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
    DET: { cert: 'DET-7C21A9F0', date: '02/09/2026', overall: '120', parts: {} },
    SAT: { cert: 'SAT-55120347', date: '04/10/2025', overall: '1380', parts: { rw: '680', math: '700', essay: '' } },
    ACT: { cert: 'ACT-11872034', date: '13/09/2025', overall: '29', parts: { math: '30', reading: '28', science: '29', english: '29', writing: '' } },
    GMAT: { cert: 'GMAT-0198-4472', date: '18/05/2026', overall: '660', parts: { q: '47', v: '35', awa: '5.0', ir: '6' } },
    GRE: { cert: 'GRE-7741023', date: '27/04/2026', overall: '318', parts: { q: '162', v: '156', awa: '4.0' } },
  };
  return r[type];
}

/* ---------- sample students ---------- */

const DAY = 86_400_000;
const edu = (p: Partial<Edu>): Edu => ({ ...emptyEdu('India'), language: 'English', ...p });
const blank = (me: string) => ({
  oneName: false,
  dial: '+91',
  gender: '' as Gender,
  dob: '',
  passportExpiry: '',
  country: 'India',
  state: '',
  city: '',
  eduCountry: 'India',
  edu: {},
  work: [] as Work[],
  tests: [] as Test[],
  visa: '' as const,
  visaNote: '',
  disability: '' as const,
  disabilityNote: '',
  docs: {} as Record<string, Doc>,
  read: [] as string[],
  addedBy: me,
  apps: [] as StudentApp[],
});
const doc = (name: string, file: string, status: DocStatus = 'verified'): Doc => ({ name, file, status });

/** A Bengaluru agency's students: one just added (profile incomplete, no applications yet), and four with complete profiles and applications. */
export function sampleStudents(me: string): Student[] {
  const now = Date.now();
  const own: Student[] = [
    {
      ...blank(me),
      id: 'S-24818',
      first: 'Mohammed',
      last: 'Irfan',
      nationality: 'India',
      email: 'irfan.m@gmail.com',
      phone: '94470 31288',
      passport: '',
      highest: 'ug',
      counsellor: 'divya',
      added: now - 1 * DAY,
      addedBy: 'Divya Shetty',
      shortlist: ['deakin-5', 'flinders-3', 'coventry-3'],
    },
    {
      ...blank(me),
      id: 'S-24811',
      shortlist: ['deakin-14', 'rmit-10'],
      first: 'Priya',
      last: 'Raman',
      nationality: 'India',
      email: 'priya.raman@gmail.com',
      phone: '98450 77120',
      passport: 'V8810342',
      highest: 'ug',
      gender: 'Female',
      dob: '14/03/2000',
      passportExpiry: '18/09/2032',
      state: 'Karnataka',
      city: 'Bengaluru',
      edu: {
        ug: edu({ state: 'Karnataka', level: 'Bachelor’s degree', institution: 'Visvesvaraya Technological University', qualification: 'B.E., Computer Science', grading: '10', score: '7.6', backlogs: '0', start: '08/2018', end: '06/2022' }),
        g12: edu({ state: 'Karnataka', level: 'Grade 12 (higher secondary)', institution: 'Karnataka School Examination and Assessment Board', qualification: 'PUC, Science (PCMB)', grading: '100', score: '84', start: '06/2016', end: '03/2018' }),
      },
      work: [{ id: 'w1', org: 'Infosys, Bengaluru', role: 'Systems engineer', from: '08/2022', to: '', current: true }],
      tests: [{ id: 't1', type: 'IELTS', cert: '26IN004512RAMP011A', date: '12/08/2026', overall: '7.0', parts: { l: '7.5', r: '7.0', w: '6.5', s: '7.0' } }],
      visa: 'no',
      disability: 'no',
      docs: {
        passport: doc('Passport', 'priya_passport.pdf'),
        'edu-ug': doc(eduDocName('ug'), 'priya_btech_transcript.pdf'),
        'edu-g12': doc(eduDocName('g12'), 'priya_puc_marksheet.pdf'),
        'test-t1': doc('IELTS Academic score report', 'priya_ielts_trf.pdf'),
        cv: doc('CV', 'priya_raman_cv.pdf', 'uploaded'),
      },
      counsellor: 'karthik',
      added: now - 12 * DAY,
    },
    {
      ...blank(me),
      id: 'S-24807',
      first: 'Sneha',
      last: 'Patil',
      nationality: 'India',
      email: 'sneha.patil01@gmail.com',
      phone: '99001 44562',
      passport: 'U3329018',
      highest: 'ug',
      gender: 'Female',
      dob: '02/11/2001',
      passportExpiry: '20/01/2027',
      state: 'Karnataka',
      city: 'Hubballi',
      edu: {
        ug: edu({ state: 'Karnataka', level: 'Bachelor’s degree', institution: 'Karnatak University', qualification: 'B.Com', grading: '100', score: '68', backlogs: '1', start: '07/2019', end: '05/2022' }),
      },
      tests: [
        { id: 't1', type: 'PTE', cert: 'PTE-ACA-5512-0918', date: '21/06/2026', overall: '65', parts: { l: '66', r: '63', w: '68', s: '62' } },
        { id: 't2', type: 'GMAT', cert: '', date: '', overall: '', parts: {} },
      ],
      visa: 'no',
      docs: { passport: doc('Passport', 'sneha_passport.jpg'), 'edu-ug': doc(eduDocName('ug'), 'sneha_bcom_marks.pdf'), 'test-t1': doc('PTE Academic score report', 'sneha_pte.pdf') },
      counsellor: 'me',
      added: now - 19 * DAY,
    },
    {
      ...blank(me),
      id: 'S-24796',
      first: 'Rohan',
      last: 'Gupta',
      nationality: 'India',
      email: 'rohan.gupta.pb@gmail.com',
      phone: '98140 22981',
      passport: 'S9940211',
      highest: 'ug',
      gender: 'Male',
      dob: '09/02/2001',
      passportExpiry: '12/12/2030',
      state: 'Punjab',
      city: 'Ludhiana',
      edu: { ug: edu({ state: 'Punjab', level: 'Bachelor’s degree', institution: 'Punjab Technical University', qualification: 'BCA', grading: '10', score: '6.8', backlogs: '2', start: '07/2019', end: '06/2022' }) },
      tests: [{ id: 't1', type: 'IELTS', cert: '25IN009934GUPR004A', date: '30/11/2025', overall: '6.0', parts: { l: '6.5', r: '6.0', w: '5.5', s: '6.0' } }],
      docs: { passport: doc('Passport', 'rohan_passport.pdf'), 'edu-ug': doc(eduDocName('ug'), 'rohan_bca.pdf'), 'test-t1': doc('IELTS Academic score report', 'rohan_trf.pdf') },
      counsellor: 'divya',
      added: now - 33 * DAY,
    },
    {
      ...blank(me),
      id: 'S-24781',
      first: 'Fatima',
      last: 'Sheikh',
      nationality: 'India',
      email: 'fatima.sheikh98@gmail.com',
      phone: '90000 51734',
      passport: 'R6672330',
      highest: 'pg',
      gender: 'Female',
      dob: '05/12/1998',
      passportExpiry: '22/08/2031',
      state: 'Telangana',
      city: 'Hyderabad',
      edu: {
        pg: edu({ state: 'Telangana', level: 'Master’s degree', institution: 'Osmania University', qualification: 'M.Tech, Structural Engineering', grading: '10', score: '8.1', backlogs: '0', start: '08/2020', end: '07/2022' }),
        ug: edu({ state: 'Telangana', level: 'Bachelor’s degree', institution: 'JNTU Hyderabad', qualification: 'B.Tech, Civil Engineering', grading: '100', score: '70', backlogs: '0', start: '08/2016', end: '06/2020' }),
      },
      work: [{ id: 'w1', org: 'L&T Construction', role: 'Site engineer', from: '09/2022', to: '08/2025', current: false }],
      tests: [{ id: 't1', type: 'IELTS', cert: '26IN007702SHEF002A', date: '14/02/2026', overall: '6.5', parts: { l: '7.0', r: '6.5', w: '6.0', s: '6.5' } }],
      visa: 'yes',
      visaNote: 'Canada, study permit, 2023',
      docs: {
        passport: doc('Passport', 'fatima_passport.pdf'),
        'edu-pg': doc(eduDocName('pg'), 'fatima_mtech.pdf'),
        'test-t1': doc('IELTS Academic score report', 'fatima_trf.pdf'),
        work: doc('Work experience letters', 'fatima_lnt_letter.pdf', 'uploaded'),
      },
      counsellor: 'divya',
      added: now - 58 * DAY,
    },
  ];
  // the sample agency's own (above), then the students of every other application GSP has (data/dataset.ts)
  return [...own, ...datasetStudents(me)];
}
