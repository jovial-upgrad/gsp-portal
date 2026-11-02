/**
 * One ordered education list for slice 3's eligibility check (S3C-1's proposal, built until it's answered): the
 * student's **Highest education** is Grade 10, then slice 2's **Minimum highest education required** values
 * (MIN_EDUCATION in data/courses.ts, S3-18) in their order, then Doctorate. So the level check compares like with
 * like: Grade 10 is below every course minimum; Doctorate meets every one. Fixed in code (the order matters).
 */
import { MIN_EDUCATION } from './courses';

export { MIN_EDUCATION };
export type MinEducation = (typeof MIN_EDUCATION)[number];
export const HIGHEST_EDUCATION = ['Grade 10', ...MIN_EDUCATION, 'Doctorate'] as const;
export type HighestEducation = (typeof HIGHEST_EDUCATION)[number];
/** Where a value sits in the one order (Grade 10 lowest, Doctorate highest); -1 for a value not in it. */
export const eduRank = (v: string) => HIGHEST_EDUCATION.indexOf(v as HighestEducation);

/** The student record's education level for a Highest education: Grade 10, Grade 12, a diploma or bachelor's (ug), a master's or doctorate (pg). */
export const levelOfEd = (v: string): 'g10' | 'g12' | 'ug' | 'pg' => (v === 'Grade 10' ? 'g10' : v === 'Grade 12' ? 'g12' : v === 'Master’s' || v === 'Doctorate' ? 'pg' : 'ug');
