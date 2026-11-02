/**
 * Reference data (slice 3 PRD, S3F-4 proposal, 3 Nov): seeded lists every screen reads, read-only in v1. Nothing
 * else keeps its own copy: the student record, Add a student, course search, eligibility, the Institution Team's
 * catalogue and Admin's routing test all read these.
 *
 * - Destinations: the countries of live universities (GSP · Institution › Universities), read when shown.
 * - Program levels per Academics card: which qualifications each card of the student record offers.
 * - Languages of instruction: the Education cards' "Primary language of instruction".
 * - Test definitions: data/tests.ts reads TEST_DEFS (names, parts, ranges, how long a score is accepted).
 */
import type { TestDef, TestType, Range } from './tests';

/** The student record's four Academics cards. */
export type CardLevel = 'pg' | 'ug' | 'g12' | 'g10';

/** Program levels per Academics card (S3F-4): the qualifications each card offers. */
export const CARD_LEVELS: Readonly<Record<CardLevel, readonly string[]>> = Object.freeze({
  pg: ['Master’s degree', 'Postgraduate diploma', 'PhD'],
  ug: ['Bachelor’s degree', 'Advanced diploma', 'Diploma'],
  g12: ['Grade 12 (higher secondary)', 'A levels', 'IB Diploma', 'Diploma after Grade 10'],
  g10: ['Grade 10 (secondary)', 'O levels', 'IGCSE'],
});

/** Languages of instruction (S3F-4). */
export const LANGUAGES_OF_INSTRUCTION: readonly string[] = Object.freeze(['English', 'Hindi', 'Bengali', 'Nepali', 'Sinhala', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Gujarati', 'Punjabi', 'Urdu', 'Vietnamese', 'Other']);

/* ---------- test definitions (S3F-4; HC15, Jovial 1 Nov) ---------- */
const band = (key: string, label: string, range: Range) => ({ key, label, range });
const LRWS = (r: Range) => [band('l', 'Listening', r), band('r', 'Reading', r), band('w', 'Writing', r), band('s', 'Speaking', r)];
export const TEST_DEFS: Readonly<Record<TestType, TestDef>> = {
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

/* ---------- destinations: the countries of live universities ---------- */
type UniLike = { country: string; status?: string };
let readUnis: () => UniLike[] = () => [];
/** GSP · Institution's store registers its universities here (institution/data/store.ts), so this module has no import cycle. */
export const setUniversitiesReader = (f: () => UniLike[]) => void (readUnis = f);
/** The destinations course search, Add an application and routing offer (S3F-4): countries with a Live university. */
export function destinations(): string[] {
  const seen: string[] = [];
  for (const u of readUnis()) if (u.status === 'Live' && u.country && !seen.includes(u.country)) seen.push(u.country);
  return seen;
}
