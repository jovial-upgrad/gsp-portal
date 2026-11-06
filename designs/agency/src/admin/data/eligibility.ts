/**
 * Admin › Course configuration › **Grade conversion** and **English test equivalence** (slice 3 PRD, decided 2 Nov:
 * S3-4, S3-15, S3-16, S3-29), with their seed values. Admin's settings store keeps them (as `grades` and `equiv`,
 * beside the other settings, so a save is logged like every other: settings.changed). The eligibility check
 * (data/eligibility.ts) reads them each time a verdict is shown, so a change applies at once.
 */
import { adminCfg, type Cfg } from './store';

/** How a grading system converts to a percentage (S3-4). */
export const CONVERT_BY = ['As is', 'Multiplier', 'Bands'] as const;
export type ConvertBy = (typeof CONVERT_BY)[number];
/**
 * A band: From and To on the system's own scale (To may be a grade, such as First), the percentage it converts to, and
 * other names a student may write for the same grade (Jovial, 6 Nov: "2.1", "Upper second" for 2:1).
 */
export type Band = { from: string; to: string; pct: number; aka?: string[] };
/**
 * A grading system. `lower`: lower is better (Germany's 1.0 to 5.0, the Philippines' GWA), so a score between two bands
 * takes the worse one, the higher number (Jovial, 6 Nov: fit for every market).
 */
export type GradingSystem = { id: string; name: string; usedIn: string; by: ConvertBy; mult?: number; bands: Band[]; lower?: boolean; status: 'Active' | 'Retired' };
/** A row of English test equivalence: the same level on each test's own scale. */
export type EquivRow = { ielts: number; toefl: number; pte: number; duolingo: number };

const g = (id: string, name: string, usedIn: string, by: ConvertBy, x: number | Band[] = []): GradingSystem => ({
  id,
  name,
  usedIn,
  by,
  ...(by === 'Multiplier' ? { mult: x as number } : {}),
  bands: by === 'Bands' ? (x as Band[]) : [],
  status: 'Active',
});
const b = (from: string, to: string, pct: number): Band => ({ from, to, pct });
const grade = (label: string, pct: number, aka: string[] = []): Band => ({ from: label, to: label, pct, ...(aka.length ? { aka } : {}) });

/**
 * The seeded grading systems (S3-15; Jovial, 6 Nov: one common standard). "Percentage" in the check is the UK-style
 * standard universities use, First 70, 2:1 60, 2:2 50, Third 40, and every system converts to it, by bands where its
 * scale reads differently. The band values are a starting point, to confirm with Admissions; Admin edits them.
 */
export const SEED_GRADES: GradingSystem[] = [
  g('pct', 'Percentage', 'India, Pakistan, Bangladesh (degrees), Nepal, Sri Lanka', 'As is'),
  g('cgpa10', 'CGPA out of 10', 'India (CBSE, most universities)', 'Bands', [b('7.50', '10.00', 70), b('6.50', '7.49', 60), b('5.50', '6.49', 50), b('4.50', '5.49', 40)]),
  g('gpa4', 'GPA out of 4', 'USA, Nepal (NEB, Tribhuvan), Indonesia (IPK), Malaysia, China, Vietnam (some universities)', 'Bands', [b('3.70', '4.00', 70), b('3.00', '3.69', 60), b('2.50', '2.99', 50), b('2.00', '2.49', 40)]),
  g('gpa5', 'GPA out of 5', 'Bangladesh (SSC, HSC)', 'Bands', [b('4.50', '5.00', 70), b('4.00', '4.49', 60), b('3.50', '3.99', 50), b('3.00', '3.49', 40)]),
  g('cgpa5', 'CGPA out of 5', 'Nigeria', 'Bands', [b('4.50', '5.00', 70), b('3.50', '4.49', 60), b('2.40', '3.49', 50), b('1.50', '2.39', 40)]),
  g('ukclass', 'UK degree class', 'UK, Kenya, Ghana, Uganda, Sri Lanka, Malaysia, Hong Kong (UK-pattern degrees)', 'Bands', [grade('First', 70, ['1st', '1', 'First class']), grade('2:1', 60, ['2.1', 'Upper second', 'Second class upper']), grade('2:2', 50, ['2.2', 'Lower second', 'Second class lower']), grade('Third', 40, ['3rd', '3', 'Third class'])]),
  g('division', 'Division', 'Pakistan, older Indian marksheets', 'Bands', [grade('First', 60, ['1st', 'First Division', 'I']), grade('Second', 45, ['2nd', 'Second Division', 'II']), grade('Third', 33, ['3rd', 'Third Division', 'III'])]),
  g('alevel-lk', 'A-level grade (Sri Lanka)', 'Sri Lanka', 'Bands', [grade('A', 75), grade('B', 65), grade('C', 55), grade('S', 40)]),
  g('out10', 'Out of 10', 'Vietnam, Latin America (0 to 10)', 'Bands', [b('8.00', '10.00', 70), b('7.00', '7.99', 60), b('6.00', '6.99', 50), b('5.00', '5.99', 40)]),
  g('out20', 'Out of 20', 'France, Belgium, Portugal, Peru, Venezuela, Francophone Africa', 'Bands', [b('14.00', '20.00', 70), b('12.00', '13.99', 60), b('11.00', '11.99', 50), b('10.00', '10.99', 40)]),
  g('out7', 'Out of 7 (1 to 7)', 'Chile', 'Bands', [b('6.00', '7.00', 70), b('5.00', '5.99', 60), b('4.50', '4.99', 50), b('4.00', '4.49', 40)]),
  { ...g('de', 'German grade (1.0 best, 5.0 fail)', 'Germany, Austria', 'Bands', [b('1.0', '1.5', 70), b('1.6', '2.5', 60), b('2.6', '3.0', 50), b('3.1', '4.0', 40)]), lower: true },
  { ...g('gwa', 'GWA (1.0 best, 5.0 fail)', 'Philippines', 'Bands', [b('1.00', '1.75', 70), b('1.76', '2.25', 60), b('2.26', '2.75', 50), b('2.76', '3.00', 40)]), lower: true },
  g('ects', 'ECTS grade (A to E)', 'Europe (Bologna degrees)', 'Bands', [grade('A', 70), grade('B', 60), grade('C', 55), grade('D', 50), grade('E', 40)]),
];

/**
 * The seeded equivalence rows (S3-16; Jovial, 6 Nov: IELTS 4.5 to 8.5, so most course minimums fall inside the table).
 * From published concordances, rounded; to confirm with Admissions.
 */
export const SEED_EQUIV: EquivRow[] = [
  { ielts: 4.5, toefl: 32, pte: 30, duolingo: 75 },
  { ielts: 5.0, toefl: 35, pte: 36, duolingo: 85 },
  { ielts: 5.5, toefl: 46, pte: 42, duolingo: 95 },
  { ielts: 6.0, toefl: 60, pte: 50, duolingo: 105 },
  { ielts: 6.5, toefl: 79, pte: 58, duolingo: 115 },
  { ielts: 7.0, toefl: 94, pte: 65, duolingo: 125 },
  { ielts: 7.5, toefl: 102, pte: 73, duolingo: 135 },
  { ielts: 8.0, toefl: 110, pte: 79, duolingo: 145 },
  { ielts: 8.5, toefl: 115, pte: 84, duolingo: 155 },
];

/** The settings with these two tables (kept beside the rest, like Intake timings). */
export type EligCfg = Cfg & { grades?: GradingSystem[]; equiv?: EquivRow[] };
export const gradesOf = (c: Cfg): GradingSystem[] => (c as EligCfg).grades ?? SEED_GRADES;
export const equivOf = (c: Cfg): EquivRow[] => (c as EligCfg).equiv ?? SEED_EQUIV;
export const withGrades = (c: Cfg, grades: GradingSystem[]): Cfg => ({ ...c, grades }) as EligCfg;
export const withEquiv = (c: Cfg, equiv: EquivRow[]): Cfg => ({ ...c, equiv }) as EligCfg;

/** The tables now (Admin's, else the seeds). */
export function grades(): GradingSystem[] {
  try {
    return gradesOf(adminCfg());
  } catch {
    return SEED_GRADES;
  }
}
export function equiv(): EquivRow[] {
  try {
    return equivOf(adminCfg());
  } catch {
    return SEED_EQUIV;
  }
}

/* ---------- checks for Admin's forms ---------- */

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
/**
 * Overlapping bands, by row index (S3-29): numeric bands overlap when one runs into the next; grade bands when the
 * same grade is listed twice. Returns the first clash as [a, b], or null.
 */
export function overlapOf(bands: Band[]): [number, number] | null {
  const rows = bands.map((x, i) => ({ i, from: num(x.from), to: num(x.to), label: x.from.trim().toLowerCase() }));
  for (let a = 0; a < rows.length; a++)
    for (let c = a + 1; c < rows.length; c++) {
      const x = rows[a];
      const y = rows[c];
      if (x.from !== null && x.to !== null && y.from !== null && y.to !== null) {
        if (x.from <= y.to && y.from <= x.to) return [x.i, y.i];
      } else if (x.from === null && y.from === null && x.label && x.label === y.label) return [x.i, y.i];
    }
  return null;
}
/** A band's own problem: From at most To (numbers), a percentage 0 to 100. */
export function bandError(x: Band): string | null {
  if (!x.from.trim() || !x.to.trim()) return 'Enter From and To.';
  const f = num(x.from);
  const t = num(x.to);
  if ((f === null) !== (t === null)) return 'From and To are both numbers, or both the same grade.';
  if (f !== null && t !== null && f > t) return 'From is at most To.';
  if (Number.isNaN(x.pct) || x.pct < 0 || x.pct > 100) return 'Enter a percentage from 0 to 100.';
  return null;
}

/** The scales and steps of each test's column (slice 2's ranges). */
export const EQUIV_COLS: { key: keyof EquivRow; name: string; min: number; max: number; step: number }[] = [
  { key: 'ielts', name: 'IELTS Academic', min: 0, max: 9, step: 0.5 },
  { key: 'toefl', name: 'TOEFL iBT', min: 0, max: 120, step: 1 },
  { key: 'pte', name: 'PTE Academic', min: 10, max: 90, step: 1 },
  { key: 'duolingo', name: 'Duolingo English Test', min: 10, max: 160, step: 5 },
];
/* ---------- grade conversion ---------- */

/** The student's grading system, from Admin's list: a system's name, or an older record's scale key. */
const OLD_KEYS: Record<string, string> = { '100': 'Percentage', '10': 'CGPA out of 10', '4': 'GPA out of 4', '5': 'GPA out of 5' };
export function systemOf(name: string): GradingSystem | undefined {
  const n = OLD_KEYS[name] ?? name;
  return grades().find((x) => x.name === n || x.id === n);
}
/** A course rule's scale (slice 2's four) as a grading system (S3-15). */
export const RULE_SCALE: Record<string, string> = { Percentage: 'Percentage', 'GPA 4': 'GPA out of 4', 'GPA 10': 'CGPA out of 10', 'UK class': 'UK degree class' };
export const UK_CODE: Record<string, string> = { '1': 'First', '2.1': '2:1', '2.2': '2:2', '3': 'Third' };

/** Whether a score names a band: its grade, or one of its other names (any case). */
export const bandNamed = (x: Band, score: string) => {
  const l = score.trim().toLowerCase();
  return x.from.trim().toLowerCase() === l || x.to.trim().toLowerCase() === l || (x.aka ?? []).some((a) => a.trim().toLowerCase() === l);
};
/**
 * A score on a grading system as a percentage of the common standard, or null when it can't be read. A converted score
 * above 100% counts as 100%. Bands: the band it falls in, by grade (or another name) or by number; in a gap between
 * bands, the worse band; worse than the last band, 0%; better than the first, the first (Jovial, 6 Nov: `lower` systems,
 * where 1.0 is best, read the other way). A retired system still converts the entries already on it.
 */
export function toPct(sys: GradingSystem | undefined, score: string): number | null {
  if (!sys || score.trim() === '') return null;
  const v = Number(score);
  if (sys.by === 'As is') return Number.isNaN(v) ? null : Math.min(100, v);
  if (sys.by === 'Multiplier') return Number.isNaN(v) ? null : Math.min(100, Math.round(v * (sys.mult ?? 1) * 100) / 100);
  const named = sys.bands.find((x) => bandNamed(x, score));
  if (named) return named.pct;
  if (Number.isNaN(v)) return null;
  const nums = sys.bands.map((x) => ({ from: Number(x.from), to: Number(x.to), pct: x.pct })).filter((x) => !Number.isNaN(x.from) && !Number.isNaN(x.to));
  if (!nums.length) return null;
  const inBand = nums.find((x) => v >= x.from && v <= x.to);
  if (inBand) return inBand.pct;
  // the worse side: lower numbers when higher is better, higher numbers when lower is better
  const worse = sys.lower ? nums.filter((x) => x.from > v).sort((a, c) => a.from - c.from)[0] : nums.filter((x) => x.to < v).sort((a, c) => c.to - a.to)[0];
  if (worse) return worse.pct;
  // nothing on the worse side: past the best band (best band), or nothing at all (0%)
  const best = [...nums].sort((a, c) => c.pct - a.pct)[0];
  const pastBest = sys.lower ? v < Math.min(...nums.map((x) => x.from)) : v > Math.max(...nums.map((x) => x.to));
  return pastBest ? best.pct : 0;
}
