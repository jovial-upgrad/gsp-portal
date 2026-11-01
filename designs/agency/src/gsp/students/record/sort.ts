import { EXTRA_DOCS, TESTS, eduDocName, levelsFor, type Level, type Student, type TestType } from '../../../data/students';
import { fillFromEducation, fillFromPassport, fillFromResume, fillFromTest, saveEducation, savePassport, saveTest } from './read';

/**
 * Sorting a student's documents into the profile, for the bulk upload in Add a student (the only place to upload
 * in bulk, since 29 Oct). Each file is recognised from its name (in the real product, from reading it), filed in
 * the section it belongs to and read into it: the passport into Personal details, marksheets and transcripts into
 * Education, score reports into Tests, the CV's jobs into Work experience. The CV, SOP, recommendation and work
 * letters, and anything that isn't part of a section, are kept in Additional documents.
 */
export { OK_TYPES } from '../../../data/uploads';
/** A file that isn't the passport, a marksheet, a transcript or a score report: kept in Documents under its own name. */
export const isOther = (key: string) => key.startsWith('other-');
let other = 1;
export const otherKey = () => `other-${Date.now().toString(36)}${other++}`;
export { UPLOAD_MAX_BYTES as MAX_SIZE } from '../../../data/uploads';

export type Place = 'personal' | 'education' | 'work' | 'tests' | 'documents';
export type Kind = { t: 'passport' } | { t: 'edu'; l: Level } | { t: 'test'; type: TestType } | { t: 'extra'; key: string } | { t: 'other' };

const TEST_WORDS: [RegExp, TestType][] = [
  [/\bielts\b/, 'IELTS'],
  [/\btoefl\b/, 'TOEFL'],
  [/\bpte\b/, 'PTE'],
  [/\b(duolingo|det)\b/, 'Duolingo'],
  [/\bsat\b/, 'SAT'],
  [/\bact\b/, 'ACT'],
  [/\bgmat\b/, 'GMAT'],
  [/\bgre\b/, 'GRE'],
];
const EXTRA_WORDS: [RegExp, string][] = [
  [/\b(cv|resume)\b/, 'cv'],
  [/\b(sop|statement)\b/, 'sop'],
  [/\b(lor|recommendation|reference)\b/, 'lor'],
  [/\b(experience|employment|relieving|work)\b/, 'work'],
];
const LEVEL_WORDS: [RegExp, Level][] = [
  [/\b(10th|grade 10|class 10|sslc|ssc)\b/, 'g10'],
  [/\b(12th|grade 12|class 12|hsc|puc|intermediate)\b/, 'g12'],
  [/\b(masters?|mtech|mba|msc|mcom|pg|pgdm|postgraduate)\b/, 'pg'],
  [/\b(bachelors?|btech|be|bsc|bcom|bca|bba|ug|degree|undergraduate)\b/, 'ug'],
];

/** What a file is, from its name. Anything else is an additional document. */
export function classify(file: string, highest: Level): Kind {
  const n = file.toLowerCase().replace(/\.\w+$/, '').replace(/[_\-.]+/g, ' ');
  if (/\bpassport\b/.test(n)) return { t: 'passport' };
  for (const [re, type] of TEST_WORDS) if (re.test(n)) return { t: 'test', type };
  for (const [re, key] of EXTRA_WORDS) if (re.test(n)) return { t: 'extra', key };
  const levels = levelsFor(highest);
  // a level above the highest education isn't one of its levels: it's kept with the additional documents
  for (const [re, l] of LEVEL_WORDS) if (re.test(n)) return levels.includes(l) ? { t: 'edu', l } : { t: 'other' };
  if (/\b(transcript|marksheet|marks|grades)\b/.test(n)) return { t: 'edu', l: highest };
  return { t: 'other' };
}

export const nameOf = (k: Kind) =>
  k.t === 'passport'
    ? 'Passport'
    : k.t === 'edu'
      ? eduDocName(k.l)
      : k.t === 'test'
        ? `${TESTS[k.type].name} score report`
        : k.t === 'extra'
          ? EXTRA_DOCS.find(([key]) => key === k.key)?.[1] ?? 'Document'
          : 'Other document';
const isCv = (k: Kind) => k.t === 'extra' && k.key === 'cv';
export const PLACE_NAME: Record<Place, string> = { personal: 'Personal details', education: 'Education', work: 'Work experience', tests: 'Tests', documents: 'Additional documents' };
const ORDER: Place[] = ['personal', 'education', 'work', 'tests', 'documents'];
/** Where a file goes: a CV goes to two places, kept in Additional documents and read into Work experience. */
export const placesOf = (k: Kind): Place[] =>
  k.t === 'passport' ? ['personal'] : k.t === 'edu' ? ['education'] : k.t === 'test' ? ['tests'] : isCv(k) ? ['work', 'documents'] : ['documents'];
/** The sections files went to, in the profile's order: "Personal details, Education and Additional documents". */
export const listOf = (kinds: Kind[]) => {
  const names = ORDER.filter((p) => kinds.some((k) => placesOf(k).includes(p))).map((p) => PLACE_NAME[p]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
};
/** Something was read into a section's fields, not only kept. */
export const isRead = (k: Kind) => k.t === 'passport' || k.t === 'edu' || k.t === 'test' || isCv(k);

let seq = 1;

/**
 * Files each document in its part of a student's profile and reads it in (what was typed is never overwritten).
 * `saved` is the passport the form already read and saved, not filed twice.
 */
export function fileInto(s: Student, files: string[], saved?: string): Student {
  if (!files.length) return s;
  let p = s;
  for (const file of files) {
    const k = classify(file, s.highest);
    if (file === saved) continue;
    if (k.t === 'passport') p = fillFromPassport(savePassport(p, file), file);
    else if (k.t === 'edu') p = fillFromEducation(saveEducation(p, k.l, file), k.l);
    else if (k.t === 'test') {
      const id = p.tests.find((t) => t.type === k.type)?.id ?? `tb${seq++}`;
      const t = p.tests.find((x) => x.id === id) ?? { id, type: k.type, cert: '', date: '', overall: '', parts: {} };
      const tests = p.tests.some((x) => x.id === id) ? p.tests : [...p.tests, t];
      p = fillFromTest(saveTest({ ...p, tests }, t, file), id);
    } else if (k.t === 'extra') {
      p = { ...p, docs: { ...p.docs, [k.key]: { name: nameOf(k), file, status: 'uploaded' as const } } };
      if (isCv(k)) p = fillFromResume(p);
    } else p = { ...p, docs: { ...p.docs, [otherKey()]: { name: 'Other document', file, status: 'uploaded' as const } } };
  }
  return p;
}
