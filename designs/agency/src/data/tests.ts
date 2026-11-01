/**
 * The tests a student can add, and the one list of English tests a course's English rule names (HC15, Jovial 1 Nov):
 * one table for the student record, Add a student, eligibility and the Institution Team's catalogue. Each test has
 * one key and one name: Duolingo is "Duolingo" (key) and "Duolingo English Test" (name), never "DET".
 *
 * Every field is required (Jovial's Test fields sheet, 1 Nov): the score report, the certificate ID, the date of
 * examination, the overall score and every part (the SAT essay and the ACT writing included).
 */
export type TestType = 'IELTS' | 'TOEFL' | 'PTE' | 'Duolingo' | 'SAT' | 'ACT' | 'GMAT' | 'GRE';
export type Range = [number, number, number];
export type TestDef = {
  name: string;
  /** Shown in a summary: "IELTS 7.0", "Duolingo 120". */
  short: string;
  kind: 'English' | 'Admission';
  /** What the certificate ID is called on this test's report. */
  cert: string;
  overall: Range;
  parts: { key: string; label: string; range: Range }[];
  /** How long a score is accepted. */
  years: number;
  /** English tests: what a course's minimum for each part is called (the catalogue's English rules). */
  partRule?: string;
};
const band = (key: string, label: string, range: Range) => ({ key, label, range });
const LRWS = (r: Range) => [band('l', 'Listening', r), band('r', 'Reading', r), band('w', 'Writing', r), band('s', 'Speaking', r)];
export const TESTS: Record<TestType, TestDef> = {
  IELTS: { name: 'IELTS Academic', short: 'IELTS', kind: 'English', cert: 'Test Report Form number', overall: [0, 9, 0.5], parts: LRWS([0, 9, 0.5]), years: 2, partRule: 'No band below' },
  TOEFL: { name: 'TOEFL iBT', short: 'TOEFL', kind: 'English', cert: 'Appointment number', overall: [0, 120, 1], parts: LRWS([0, 30, 1]), years: 2, partRule: 'Minimum in each section' },
  PTE: { name: 'PTE Academic', short: 'PTE', kind: 'English', cert: 'Score report code', overall: [10, 90, 1], parts: LRWS([10, 90, 1]), years: 2, partRule: 'No part below' },
  Duolingo: {
    name: 'Duolingo English Test',
    short: 'Duolingo',
    kind: 'English',
    cert: 'Certificate ID',
    overall: [10, 160, 5],
    parts: [band('lit', 'Literacy', [10, 160, 5]), band('comp', 'Comprehension', [10, 160, 5]), band('conv', 'Conversation', [10, 160, 5]), band('prod', 'Production', [10, 160, 5])],
    years: 2,
    partRule: 'No subscore below',
  },
  SAT: { name: 'SAT', short: 'SAT', kind: 'Admission', cert: 'Score report ID', overall: [400, 1600, 10], parts: [band('rw', 'Reading and writing', [200, 800, 10]), band('math', 'Math', [200, 800, 10]), band('essay', 'Essay', [2, 8, 1])], years: 5 },
  ACT: {
    name: 'ACT',
    short: 'ACT',
    kind: 'Admission',
    cert: 'ACT ID',
    overall: [1, 36, 1],
    parts: [band('math', 'Math', [1, 36, 1]), band('reading', 'Reading', [1, 36, 1]), band('science', 'Science', [1, 36, 1]), band('english', 'English', [1, 36, 1]), band('writing', 'Writing', [2, 12, 1])],
    years: 5,
  },
  GMAT: {
    name: 'GMAT',
    short: 'GMAT',
    kind: 'Admission',
    cert: 'Score report ID',
    overall: [200, 800, 10],
    parts: [band('q', 'Quantitative', [6, 51, 1]), band('v', 'Verbal', [6, 51, 1]), band('awa', 'Analytical writing', [0, 6, 0.5]), band('ir', 'Integrated reasoning', [1, 8, 1])],
    years: 5,
  },
  GRE: { name: 'GRE General', short: 'GRE', kind: 'Admission', cert: 'Registration number', overall: [260, 340, 1], parts: [band('q', 'Quantitative', [130, 170, 1]), band('v', 'Verbal', [130, 170, 1]), band('awa', 'Analytical writing', [0, 6, 0.5])], years: 5 },
};
// a record saved before the rename still opens: "DET" reads as Duolingo
Object.defineProperty(TESTS, 'DET', { value: TESTS.Duolingo, enumerable: false });
export const TEST_ORDER: TestType[] = ['IELTS', 'TOEFL', 'PTE', 'Duolingo', 'SAT', 'ACT', 'GMAT', 'GRE'];
export const ENGLISH_TESTS = TEST_ORDER.filter((t) => TESTS[t].kind === 'English');
/** The English tests by name, as a course's English rule names them (the Institution Team's catalogue). */
export const ENGLISH_TEST_NAMES = ENGLISH_TESTS.map((t) => TESTS[t].name);
/** What each English test's part minimum is called, by name: "No band below". */
export const TEST_PART_RULE: Record<string, string> = Object.fromEntries(ENGLISH_TESTS.map((t) => [TESTS[t].name, TESTS[t].partRule ?? 'Minimum in each part']));

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
  const bands = d.parts.map((p) => Number(t.parts[p.key])).filter((n) => !Number.isNaN(n));
  const low = d.kind === 'English' && bands.length === d.parts.length && bands.length ? Math.min(...bands) : null;
  const fmt = (n: number) => (t.type === 'IELTS' ? n.toFixed(1) : String(n));
  return `${d.short} ${t.type === 'IELTS' ? Number(t.overall).toFixed(1) : t.overall}${low !== null ? ` (no ${t.type === 'IELTS' ? 'band' : 'part'} below ${fmt(low)})` : ''}`;
}

/**
 * What's missing on a test (every field is required): the score report, the certificate ID, the date, the overall
 * and each part, by name. `hasReport`: the score report is on the student's documents.
 */
export function testMissing(t: Test, hasReport: boolean): string[] {
  const d = TESTS[t.type];
  return [
    ...(hasReport ? [] : ['score report']),
    ...(t.cert.trim() ? [] : ['certificate ID']),
    ...(t.date.trim() ? [] : ['date of examination']),
    ...(inRange(t.overall, d.overall) ? [] : ['overall score']),
    ...d.parts.filter((p) => !inRange(t.parts[p.key] ?? '', p.range)).map((p) => p.label.toLowerCase()),
  ];
}

/**
 * The course's English rule for a test (HC15): [overall, lowest part], or null when the course doesn't take it.
 * IELTS, TOEFL and PTE are on every course; Duolingo where the course lists it.
 */
export function englishRuleFor(c: { ielts: [number, number]; toefl: [number, number]; pte: [number, number]; duolingo?: [number, number] }, t: TestType): [number, number] | null {
  const r = t === 'IELTS' ? c.ielts : t === 'TOEFL' ? c.toefl : t === 'PTE' ? c.pte : t === 'Duolingo' ? c.duolingo : undefined;
  return r && r[0] > 0 ? r : null;
}
