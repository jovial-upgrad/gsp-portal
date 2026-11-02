/**
 * The two education lists of slice 3's eligibility check, fixed in code (the level check depends on their order).
 * - A course's **Minimum highest education required** (S3-18): Grade 12 to Master's.
 * - A student's **Highest education** (S3C-1, proposal built until answered): Grade 10 to Doctorate. Grade 10 is
 *   below every course minimum; Doctorate meets every one.
 */
export const MIN_EDUCATION = ['Grade 12', 'Diploma', 'Bachelor’s (3 years)', 'Bachelor’s (4 years)', 'Master’s'] as const;
export type MinEducation = (typeof MIN_EDUCATION)[number];
export const HIGHEST_EDUCATION = ['Grade 10', 'Grade 12', 'Diploma', 'Bachelor’s (3 years)', 'Bachelor’s (4 years)', 'Master’s', 'Doctorate'] as const;
export type HighestEducation = (typeof HIGHEST_EDUCATION)[number];
/** Where a value sits in the one order (Grade 10 lowest, Doctorate highest). */
export const eduRank = (v: string) => HIGHEST_EDUCATION.indexOf(v as HighestEducation);

/** The student record's education level for a Highest education: Grade 10, Grade 12, a diploma or bachelor's (ug), a master's or doctorate (pg). */
export const levelOfEd = (v: string): 'g10' | 'g12' | 'ug' | 'pg' => (v === 'Grade 10' ? 'g10' : v === 'Grade 12' ? 'g12' : v === 'Master’s' || v === 'Doctorate' ? 'pg' : 'ug');
