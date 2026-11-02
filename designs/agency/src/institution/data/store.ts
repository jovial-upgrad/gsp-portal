/**
 * Everything the Institution Team keeps, in one place (29 Oct, 2nd round). Jovial, 31 Oct: one catalogue for every
 * role. GSP · Institution and GSP · Admin change it; Course search in every role reads it (`searchCatalogue`): live
 * universities with their live courses, territory and active campuses. Shared across roles in this window; a reload
 * starts from the sample again (the catalogue is too large to keep in the browser).
 */
import { setUniversitiesReader } from '../../data/reference';
import { fmtDate } from '../../data/format';
import { useSyncExternalStore } from 'react';
import { AREAS, LEVELS, setCatalogueReaders, setFormLevelReader, setFormsReader, setUniScholarships, type Course, type University } from '../../data/courses';
import { sampleAnnouncements, type Announcement } from './announcements';
import { forSearch, sampleCourseRecs, sampleUniRecs, searchable, type CourseRec, type UniRec } from './catalogue';
import { agreementJob, samplePartners, sampleRps, type InstitutionPartner, type RecruitmentPartner } from './records';
import { SEED_TAGS } from './catalogue';
import { sampleMps, type MasterPartner } from './masters';

/** A course tag on Admin's list (S2-16): retired tags aren't offered and leave every course. */
export type CourseTag = { id: string; name: string; retired: boolean };
/**
 * A Program level on Admin's list (S2-17, S2C-13): added, retired and restored there. Each has a required
 * Application form level: which of the application form's own levels (FORM_LEVELS) it counts as, so Add an
 * application and the document rules read a new level the right way. A retired level isn't offered for new courses;
 * courses that have it keep it.
 */
export type ProgramLevel = { id: string; name: string; formLevel: string; retired: boolean };
/** A Study area on Admin's list (S2-17, S2C-13): added, retired and restored the same way. */
export type StudyArea = { id: string; name: string; retired: boolean };
/** The application form's levels (the levels Add an application and Admin's document rules know). */
export const FORM_LEVELS: readonly string[] = LEVELS;

export type Db = {
  ips: InstitutionPartner[];
  unis: UniRec[];
  courses: CourseRec[];
  anns: Announcement[];
  rps: RecruitmentPartner[];
  /** Master Partners (S2-21): their own records, created by RP Ops. */
  mps: MasterPartner[];
  /** GSP · Admin › Course tags (S2-16). */
  tags: CourseTag[];
  /** GSP · Admin › Program levels and study areas (S2-17, S2C-13). */
  levels: ProgramLevel[];
  areas: StudyArea[];
};
export type SetDb = (fn: (d: Db) => Db) => void;

export const sampleDb = (): Db => {
  // job J1 runs at 01:00 Asia/Kolkata: today's run has happened by the time anyone opens the portal (S2-15, Decision A)
  const j = agreementJob(samplePartners(), sampleUniRecs());
  return { ips: j.ips, unis: j.unis, courses: sampleCourseRecs(), anns: sampleAnnouncements(), rps: sampleRps(), mps: sampleMps(), tags: SEED_TAGS.map((name, i) => ({ id: `tag-${i + 1}`, name, retired: false })), levels: LEVELS.map((name, i) => ({ id: `lvl-${i + 1}`, name, formLevel: name, retired: false })), areas: AREAS.map((name, i) => ({ id: `area-${i + 1}`, name, retired: false })) };
};
/** The course tags Admin's list offers now. */
export const liveTags = (db: Db) => db.tags.filter((t) => !t.retired).map((t) => t.name);
/** The Program levels and Study areas offered for a course now (Admin's lists, S2C-13); `keep` stays offered (a course's own). */
export const liveLevels = (db: Db, keep?: string) => db.levels.filter((l) => !l.retired || l.name === keep).map((l) => l.name);
export const liveAreas = (db: Db, keep?: string) => db.areas.filter((a) => !a.retired || a.name === keep).map((a) => a.name);
/** The application form level a Program level counts as (S2C-13): its own name for the built-in levels. */
export const formLevelOf = (level: string) => getDb().levels.find((l) => l.name === level)?.formLevel ?? level;
setFormLevelReader(formLevelOf);

let DB: Db | null = null;
const subs = new Set<() => void>();
/** The catalogue and records now. */
export const getDb = (): Db => (DB ??= sampleDb());
// reference data (S3F-4): destinations are the countries of live universities, read from here
setUniversitiesReader(() => getDb().unis);
/** Change them; every role sees it. */
export const setSharedDb: SetDb = (fn) => {
  DB = fn(getDb());
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
/** For stores outside React (Finance's agreement dates and territory, W8): called on every change. */
export const onDbChange = (f: () => void) => subscribe(f);
/** For a portal: the same as useState(sampleDb), but one copy for every role. */
export const useSharedDb = () => [useSyncExternalStore(subscribe, getDb), setSharedDb] as const;

// course pages read each university's scholarships from here
setUniScholarships((uniId) => getDb().unis.find((u) => u.id === uniId)?.scholarships);
// intake dates and submission channels, for course pages, applications, GSP's submission card and Finance
setCatalogueReaders(
  (courseId, month) => getDb().courses.find((c) => c.id === courseId)?.dates[month],
  (uniId, region) => {
    const u = getDb().unis.find((x) => x.id === uniId);
    if (!u || !u.channel) return undefined;
    // logins only for Own portal and StudyLink (Jovial, 2 Nov): the region's own, else All regions, else the first
    if (u.channel === 'Email') return { channel: u.channel, link: u.link };
    const l = u.logins.find((x) => x.region === region) ?? u.logins.find((x) => /^all/i.test(x.region)) ?? u.logins[0];
    return { channel: u.channel, link: u.link, username: l?.username, secret: l?.secret };
  },
);

// each university's own application forms, for Add an application (Jovial, 1 Nov)
setFormsReader((uniId) => getDb().unis.find((u) => u.id === uniId)?.forms ?? []);

let cache: { db: Db; out: { courses: Course[]; unis: University[] } } | null = null;
/**
 * What Course search reads, in every role: live universities (a paused one doesn't show), their active campuses and
 * territory, and their live courses.
 */
export function searchCatalogue() {
  const db = getDb();
  if (cache?.db === db) return cache.out;
  const ip = new Map(db.ips.map((p) => [p.id, p]));
  const unis = new Map(db.unis.filter((u) => u.status === 'Live').map((u) => [u.id, forSearch(u, ip.get(u.ip))]));
  const courses = db.courses.filter((c) => searchable(c) && unis.has(c.uni.id) && unis.get(c.uni.id)!.campuses.some((x) => x.name === c.campus.name)).map((c) => ({ ...c, uni: unis.get(c.uni.id)! }));
  cache = { db, out: { courses, unis: [...unis.values()] } };
  return cache.out;
}

/** Changes one record in a list, by id. */
export const patch = <T extends { id: string }>(list: T[], id: string, fn: (x: T) => T) => list.map((x) => (x.id === id ? fn(x) : x));

/** "29 Oct, 14:02", for logs. */
export const stamp = (d = new Date()) => `${fmtDate(d, { year: false })}, ${d.toTimeString().slice(0, 5)}`;
