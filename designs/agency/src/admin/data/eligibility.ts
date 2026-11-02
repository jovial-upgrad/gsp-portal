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
/** A band: From and To on the system's own scale (To may be a grade, such as First) and the percentage it converts to. */
export type Band = { from: string; to: string; pct: number };
export type GradingSystem = { id: string; name: string; usedIn: string; by: ConvertBy; mult?: number; bands: Band[]; status: 'Active' | 'Retired' };
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
const grade = (label: string, pct: number): Band => ({ from: label, to: label, pct });

/** The 9 seeded grading systems (S3-15). */
export const SEED_GRADES: GradingSystem[] = [
  g('pct', 'Percentage', 'India, Pakistan, Bangladesh (degrees), Nepal, Sri Lanka', 'As is'),
  g('cgpa10', 'CGPA out of 10', 'India (CBSE, most universities)', 'Multiplier', 9.5),
  g('gpa4', 'GPA out of 4', 'Nepal (NEB, Tribhuvan), US-style transcripts', 'Multiplier', 25),
  g('gpa5', 'GPA out of 5', 'Bangladesh (SSC, HSC)', 'Bands', [b('5.00', '5.00', 80), b('4.00', '4.99', 70), b('3.50', '3.99', 60), b('3.00', '3.49', 50), b('2.00', '2.99', 40), b('1.00', '1.99', 33)]),
  g('cgpa5', 'CGPA out of 5', 'Nigeria', 'Bands', [b('4.50', '5.00', 70), b('3.50', '4.49', 60), b('2.40', '3.49', 50), b('1.50', '2.39', 40)]),
  g('ukclass', 'UK degree class', 'UK-pattern degrees', 'Bands', [grade('First', 70), grade('2:1', 60), grade('2:2', 50), grade('Third', 40)]),
  g('division', 'Division', 'Pakistan, older Indian marksheets', 'Bands', [grade('First', 60), grade('Second', 45), grade('Third', 33)]),
  g('alevel-lk', 'A-level grade (Sri Lanka)', 'Sri Lanka', 'Bands', [grade('A', 75), grade('B', 65), grade('C', 55), grade('S', 40)]),
  g('out10', 'Out of 10', 'Vietnam', 'Multiplier', 10),
];

/** The 5 seeded equivalence rows (S3-16). */
export const SEED_EQUIV: EquivRow[] = [
  { ielts: 5.5, toefl: 46, pte: 42, duolingo: 95 },
  { ielts: 6.0, toefl: 60, pte: 50, duolingo: 105 },
  { ielts: 6.5, toefl: 79, pte: 58, duolingo: 115 },
  { ielts: 7.0, toefl: 94, pte: 65, duolingo: 125 },
  { ielts: 7.5, toefl: 102, pte: 73, duolingo: 135 },
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

/**
 * A score on a grading system as a percentage, or null when it can't be read. A converted score above 100% counts as
 * 100%. Bands: the band it falls in; below the lowest band, 0%; in a gap between bands, the band below (S3C-18).
 * A retired system still converts the entries already on it.
 */
export function toPct(sys: GradingSystem | undefined, score: string): number | null {
  if (!sys || score.trim() === '') return null;
  const v = Number(score);
  if (sys.by === 'As is') return Number.isNaN(v) ? null : Math.min(100, v);
  if (sys.by === 'Multiplier') return Number.isNaN(v) ? null : Math.min(100, Math.round(v * (sys.mult ?? 1) * 100) / 100);
  const label = score.trim().toLowerCase();
  const named = sys.bands.find((x) => x.from.trim().toLowerCase() === label || x.to.trim().toLowerCase() === label);
  if (named) return named.pct;
  if (Number.isNaN(v)) return null;
  const nums = sys.bands.map((x) => ({ from: Number(x.from), to: Number(x.to), pct: x.pct })).filter((x) => !Number.isNaN(x.from) && !Number.isNaN(x.to));
  if (!nums.length) return null;
  const inBand = nums.find((x) => v >= x.from && v <= x.to);
  if (inBand) return inBand.pct;
  const below = nums.filter((x) => x.to < v).sort((a, b) => b.to - a.to)[0];
  return below ? below.pct : 0;
}

