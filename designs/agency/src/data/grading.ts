/**
 * Grading systems: one list (HC14, Jovial 1 Nov) for a student's education and a course's academic rules (the
 * Institution Team's catalogue). `key` is what a student's record stores (the scale's top mark), `name` what a course
 * rule names, `label` what a form shows. UK class has no top mark: courses use it, a student's score is a number.
 */
export type GradingScale = { key: string; name: string; label: string; max?: number };
export const GRADING_SCALES: GradingScale[] = [
  { key: '100', name: 'Percentage', label: 'Percentage (out of 100)', max: 100 },
  { key: '10', name: 'GPA 10', label: 'CGPA out of 10', max: 10 },
  { key: '7', name: 'GPA 7', label: 'CGPA out of 7', max: 7 },
  { key: '5', name: 'GPA 5', label: 'CGPA out of 5', max: 5 },
  { key: '4', name: 'GPA 4', label: 'GPA out of 4', max: 4 },
  { key: 'uk', name: 'UK class', label: 'UK degree class' },
];
/** The scale names a course's academic rule picks from. */
export const SCALE_NAMES = GRADING_SCALES.map((g) => g.name);
