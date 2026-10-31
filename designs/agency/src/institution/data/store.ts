/**
 * Everything the Institution Team keeps, in one place (29 Oct, 2nd round): the portal holds it, and each page reads
 * it and changes it through `set`. Changes stay in this portal: RP Admin and GSP Team never see them.
 */
import { sampleAnnouncements, type Announcement } from './announcements';
import { sampleCourseRecs, sampleUniRecs, type CourseRec, type UniRec } from './catalogue';
import { samplePartners, sampleRps, type InstitutionPartner, type RecruitmentPartner } from './records';

export type Db = {
  ips: InstitutionPartner[];
  unis: UniRec[];
  courses: CourseRec[];
  anns: Announcement[];
  rps: RecruitmentPartner[];
};
export type SetDb = (fn: (d: Db) => Db) => void;

export const sampleDb = (): Db => ({ ips: samplePartners(), unis: sampleUniRecs(), courses: sampleCourseRecs(), anns: sampleAnnouncements(), rps: sampleRps() });

/** Changes one record in a list, by id. */
export const patch = <T extends { id: string }>(list: T[], id: string, fn: (x: T) => T) => list.map((x) => (x.id === id ? fn(x) : x));

/** "29 Oct, 14:02", for logs. */
export const stamp = (d = new Date()) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}, ${d.toTimeString().slice(0, 5)}`;
