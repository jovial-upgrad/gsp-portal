/**
 * Reading an uploaded document into the profile (OCR in the real product). What's already filled stays;
 * the document fills the gaps, and every field it filled is marked to check.
 */
import { LEVELS, emptyEdu, eduDocKey, eduDocName, readEducation, readPassport, readResume, readTest, testDocKey, testDocName, type Edu, type Level, type Student, type Test, type TestType, type Work } from '../../../data/students';

const mark = (p: Student, keys: string[]) => [...new Set([...p.read, ...keys])];

/** Saves the passport in Documents. */
export const savePassport = (p: Student, file: string): Student => ({ ...p, docs: { ...p.docs, passport: { name: 'Passport', file, status: 'uploaded' } } });
/** Fills names, passport number, gender, date of birth and expiry from the passport. */
export function fillFromPassport(p: Student, file: string): Student {
  const r = readPassport(file);
  const fill: Partial<Student> = {};
  if (!p.first) fill.first = r.first;
  if (!p.last && !p.oneName) fill.last = r.last;
  if (!p.passport) fill.passport = r.passport;
  if (!p.gender) fill.gender = r.gender;
  if (!p.dob) fill.dob = r.dob;
  if (!p.passportExpiry) fill.passportExpiry = r.passportExpiry;
  return { ...p, ...fill, read: mark(p, Object.keys(fill)) };
}

export const saveEducation = (p: Student, l: Level, file: string): Student => ({ ...p, docs: { ...p.docs, [eduDocKey(l)]: { name: eduDocName(l), file, status: 'uploaded' } } });
export function fillFromEducation(p: Student, l: Level): Student {
  const cur = p.edu[l] ?? emptyEdu(p.eduCountry);
  const r = readEducation(l, cur.country || p.eduCountry, p.state);
  const keys = (Object.keys(r) as (keyof Edu)[]).filter((k) => !cur[k] && r[k]);
  const fill = Object.fromEntries(keys.map((k) => [k, r[k]])) as Partial<Edu>;
  return { ...p, edu: { ...p.edu, [l]: { ...cur, ...fill } }, read: mark(p, keys.map((k) => `edu.${l}.${k}`)) };
}

export const saveTest = (p: Student, t: Test, file: string): Student => ({ ...p, docs: { ...p.docs, [testDocKey(t)]: { name: testDocName(t), file, status: 'uploaded' } } });
export function fillFromTest(p: Student, id: string): Student {
  const t = p.tests.find((x) => x.id === id);
  if (!t) return p;
  const r = readTest(t.type);
  const keys: string[] = [];
  const next: Test = { ...t, parts: { ...t.parts } };
  (['cert', 'date', 'overall'] as const).forEach((k) => {
    if (!t[k] && r[k]) (next[k] = r[k], keys.push(k));
  });
  Object.entries(r.parts).forEach(([k, v]) => {
    if (!t.parts[k] && v) (next.parts[k] = v, keys.push(k));
  });
  return { ...p, tests: p.tests.map((x) => (x.id === id ? next : x)), read: mark(p, keys.map((k) => `test.${id}.${k}`)) };
}

/** Saves the resume as the CV, in Additional documents. */
export const saveResume = (p: Student, file: string): Student => ({ ...p, docs: { ...p.docs, cv: { name: 'CV', file, status: 'uploaded' } } });
let seq = 1;
/** Adds the jobs on the resume that aren't there yet, each field marked to check. */
export function fillFromResume(p: Student): Student {
  const have = new Set(p.work.map((j) => j.org.trim().toLowerCase()));
  const jobs: Work[] = readResume()
    .filter((j) => !have.has(j.org.toLowerCase()))
    .map((j) => ({ ...j, id: `wr${seq++}` }));
  const keys = jobs.flatMap((j) => (['org', 'role', 'from', 'to'] as const).filter((k) => j[k]).map((k) => `work.${j.id}.${k}`));
  return { ...p, work: [...p.work, ...jobs], read: mark(p, keys) };
}

/* ---------- adding to a section from the menus at its top ---------- */

/** Adds a level's card; a level above the highest education becomes the highest, so its details are mandatory. */
/** Adds a level of education. One above the highest becomes the highest; the old highest stays, now optional. */
export function addLevel(p: Student, l: Level): Student {
  const higher = LEVELS.indexOf(l) < LEVELS.indexOf(p.highest);
  const blank = () => emptyEdu(p.eduCountry || p.country);
  return { ...p, highest: higher ? l : p.highest, edu: { ...p.edu, ...(higher ? { [p.highest]: p.edu[p.highest] ?? blank() } : {}), [l]: p.edu[l] ?? blank() } };
}
export const addJob = (p: Student, id: string): Student => ({ ...p, work: [...p.work, { id, org: '', role: '', from: '', to: '', current: false }] });
export const addTest = (p: Student, id: string, type: TestType): Student => ({ ...p, tests: [...p.tests, { id, type, cert: '', date: '', overall: '', parts: {} }] });
