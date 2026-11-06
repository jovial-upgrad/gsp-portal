/**
 * The one ordered **Highest education** list (lock answer S3C-1, Jovial, 2 Nov): Grade 10, Grade 12, Diploma,
 * Bachelor's (3 years), Bachelor's (4 years), Master's, Doctorate, used by students (Add a student, the record's
 * Academics) and by courses (Minimum highest education required). **Admin edits it** in Admin › Course configuration
 * › Highest education: add, rename, reorder, retire and restore. Its order drives the eligibility check's level check
 * (a student meets a course's minimum when their level sits at or after it).
 *
 * The list lives in Admin's settings store (admin/data/education.ts sets the reader below); the seed is only where
 * it starts. Each level names the profile section it fills on the student's record (Grade 10, Grade 12,
 * Undergraduate or Postgraduate, data/students.ts LEVEL_NAME). A renamed level keeps its old names in `was`, so
 * students and courses saved under an old name still read it; a retired one isn't offered for new picks, and
 * records already on it keep it and its place in the order.
 */
import type { Level } from './students';

export type EducationLevel = {
  id: string;
  name: string;
  /** The record's education section it fills. */
  record: Level;
  retired?: boolean;
  /** Earlier names. */
  was?: string[];
  /** false: a qualification the check can't place on the ladder (Jovial, 6 Nov): GSP confirms eligibility by hand. */
  compare?: boolean;
};

/** Where the list starts (S3C-1's seven, in order). */
export const SEED_EDUCATION: EducationLevel[] = [
  { id: 'ed-g10', name: 'Grade 10', record: 'g10' },
  { id: 'ed-g12', name: 'Grade 12', record: 'g12' },
  { id: 'ed-dip', name: 'Diploma', record: 'ug' },
  { id: 'ed-ba3', name: 'Bachelor’s (3 years)', record: 'ug' },
  { id: 'ed-ba4', name: 'Bachelor’s (4 years)', record: 'ug' },
  { id: 'ed-ma', name: 'Master’s', record: 'pg' },
  { id: 'ed-phd', name: 'Doctorate', record: 'pg' },
  // a qualification from any market that isn't one of the above (an HND, a foundation year, an associate degree…)
  { id: 'ed-other', name: 'Other qualification', record: 'ug', compare: false },
];

let read: () => EducationLevel[] = () => SEED_EDUCATION;
/** Admin's settings store hands its list here once it's loaded (admin/data/education.ts). */
export const setEducationReader = (f: () => EducationLevel[]) => {
  read = f;
};
/** The whole list, retired levels included, in order. */
export const educationLevels = (): EducationLevel[] => {
  try {
    return read();
  } catch {
    return SEED_EDUCATION;
  }
};
/** The level a saved value names, under its name now or an earlier one. */
export const eduItem = (v?: string) => (v ? educationLevels().find((x) => x.name === v || x.was?.includes(v)) : undefined);
/** A saved value under its name now. */
export const eduName = (v?: string) => eduItem(v)?.name ?? v ?? '';
/** Where a value sits in the one order (first lowest); -1 for a value not on the list. */
export const eduRank = (v?: string) => {
  const it = eduItem(v);
  if (!it || it.compare === false) return -1;
  return educationLevels().filter((x) => x.compare !== false).indexOf(it);
};
/** Whether a value is the last level on the list (so "or higher" says nothing). */
export const isTopEducation = (v?: string) => {
  const l = educationLevels().filter((x) => x.compare !== false);
  return eduRank(v) === l.length - 1;
};
/** The names offered for a new pick: every level not retired, in order. */
export const activeEducation = () => educationLevels().filter((x) => !x.retired).map((x) => x.name);

/**
 * The offered names as an array that is always the list now (the same array everywhere it's read: map, filter,
 * includes, join), for pickers and CSV checks.
 */
const liveNames = (): string[] =>
  new Proxy([] as string[], {
    get(_t, k) {
      return Reflect.get(activeEducation(), k);
    },
    has(_t, k) {
      return Reflect.has(activeEducation(), k);
    },
  });
/** Highest education's options (students): one list. */
export const HIGHEST_EDUCATION: readonly string[] = liveNames();
/** Minimum highest education's options (courses): the same list without the ones the check can't compare. */
export const COMPARABLE_EDUCATION: readonly string[] = new Proxy([] as string[], {
  get(_t, k) {
    return Reflect.get(educationLevels().filter((x) => !x.retired && x.compare !== false).map((x) => x.name), k);
  },
  has(_t, k) {
    return Reflect.has(educationLevels().filter((x) => !x.retired && x.compare !== false).map((x) => x.name), k);
  },
});
export type HighestEducation = string;
export type MinEducation = string;

/** The student record's education section for a Highest education. */
export const levelOfEd = (v: string): Level => eduItem(v)?.record ?? 'ug';
