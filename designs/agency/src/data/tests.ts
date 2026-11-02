/**
 * The tests a student can add, and the one list of English tests a course's English rule names (HC15, Jovial 1 Nov):
 * one table for the student record, Add a student, eligibility and the Institution Team's catalogue. Each test has
 * one key and one name: Duolingo is "Duolingo" (key) and "Duolingo English Test" (name), never "DET".
 *
 * Every field is required (Jovial's Test fields sheet, 1 Nov): the score report, the certificate ID, the date of
 * examination, the overall score and every part (the SAT essay and the ACT writing included).
 */
import { TEST_DEFS } from './reference';
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
/** The definitions are reference data (S3F-4): data/reference.ts, the one list. */
export const TESTS: Record<TestType, TestDef> = TEST_DEFS as Record<TestType, TestDef>;
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
