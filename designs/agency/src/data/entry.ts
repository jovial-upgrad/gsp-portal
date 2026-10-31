import type { Course, Destination } from './courses';
import { COUNTRIES } from './partners';

/**
 * Entry requirements and documents depend on where the student studied. The course page's dropdown offers All
 * countries, then the countries GSP recruits from most, and opens on the RP's own country. These are sample
 * rules: the qualification each country's students hold, how a course's percentage reads in that country's
 * grading, whether backlogs are counted, how English can be waived, and the documents only that country needs.
 */
export const ENTRY_COUNTRIES = ['India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Nigeria', 'Vietnam'];
/** The dropdown's first choice: every country side by side. */
export const ALL_COUNTRIES = 'all';
/** Where the RP is: the dropdown starts here (India for every agency in the prototype). */
export const RP_COUNTRY = 'India';

/** A country's flag, from its ISO code. */
export const flagOf = (name: string) => {
  const iso = COUNTRIES.find((c) => c.name === name)?.iso;
  return iso ? String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '';
};

type Doc = Course['docs'][number];
/** What the course asks of a student from one country. */
export type EntryRules = {
  /** The qualification needed before the course, and a line under it. */
  from: string;
  /** The grade needed, in the country's own grading, and what it's in. */
  grade: string;
  gradeSub: string;
  /** Backlogs (subjects failed and cleared later) are counted for students from here. */
  backlogs: boolean;
  /** How the English test can be waived, after "a conditional offer is possible". */
  waiver?: string;
  docs: Course['docs'];
  /** Anything else worth knowing for students from here. */
  note?: string;
};

type Rules = {
  school: string;
  schoolDocs: string;
  degree: string;
  grade: (p: number, pg: boolean) => [string, string];
  backlogs: boolean;
  waiver?: string;
  note?: (pg: boolean, dest: Destination) => string | undefined;
};

/** A percentage on another scale, read off a few fixed points (sample conversions). */
const scale = (points: [number, number][]) => (p: number) => {
  const lo = [...points].reverse().find(([x]) => x <= p) ?? points[0];
  const hi = points.find(([x]) => x >= p) ?? points[points.length - 1];
  const v = hi[0] === lo[0] ? lo[1] : lo[1] + ((p - lo[0]) / (hi[0] - lo[0])) * (hi[1] - lo[1]);
  return v.toFixed(1);
};
const gpa4 = scale([[40, 2.0], [50, 2.3], [60, 2.8], [70, 3.2], [80, 3.6], [90, 3.9]]);
const gpa5 = scale([[50, 3.0], [60, 3.5], [70, 4.0], [80, 4.5], [90, 5.0]]);
const gpa10 = scale([[50, 5.5], [60, 6.5], [70, 7.0], [80, 8.0], [90, 9.0]]);

const RULES: Record<string, Rules> = {
  India: {
    school: 'Grade 12 (CBSE, ISC or a state board)',
    schoolDocs: 'Class 10 and 12 mark sheets',
    degree: 'Bachelor’s degree, 3 or 4 years',
    grade: (p) => [`${p}%+`, ''],
    backlogs: true,
    waiver: '70% or more in Grade 12 English (CBSE, ISC or a state board) can waive it',
    note: (pg, dest) => (pg && (dest === 'USA' || dest === 'Canada') ? 'Universities here usually ask for 16 years of education: a 4-year degree, or a 3-year degree with a master’s or a postgraduate diploma.' : undefined),
  },
  Bangladesh: {
    school: 'HSC (or A-Level)',
    schoolDocs: 'SSC and HSC certificates and mark sheets',
    degree: 'Bachelor’s degree, 4 years',
    grade: (p, pg) => (pg ? [`CGPA ${gpa4(p)}`, 'out of 4'] : [`GPA ${gpa5(p)}`, 'out of 5, in the HSC']),
    backlogs: false,
    waiver: 'an English-medium letter from the university may be accepted instead',
    note: (pg) => (pg ? 'A 3-year pass degree needs a master’s as well.' : undefined),
  },
  Nepal: {
    school: 'NEB Grade 12 (or A-Level)',
    schoolDocs: 'SEE and NEB Grade 12 transcripts',
    degree: 'Bachelor’s degree, 4 years for most universities',
    grade: (p, pg) => [`${p}% or GPA ${gpa4(p)}`, pg ? 'out of 4, in the bachelor’s degree' : 'out of 4, in Grade 12'],
    backlogs: true,
    waiver: 'a B+ or better in NEB Grade 12 English waives it at some universities',
  },
  'Sri Lanka': {
    school: 'GCE A-Level, 3 passes',
    schoolDocs: 'GCE O-Level and A-Level certificates',
    degree: 'Bachelor’s degree',
    grade: (p, pg) => (pg ? [`GPA ${gpa4(p)}`, 'out of 4, or a second class'] : ['3 passes', 'at A-Level, C or better']),
    backlogs: false,
    waiver: 'a C or better in GCE O-Level English can waive it',
  },
  Nigeria: {
    school: 'WAEC or NECO (SSCE), 5 credits',
    schoolDocs: 'WAEC or NECO results (SSCE)',
    degree: 'Bachelor’s degree (BSc or BA)',
    grade: (p, pg) => (pg ? [p >= 65 ? 'Second class upper' : 'Second class lower', p >= 65 ? '2:1, or CGPA 3.5 out of 5' : '2:2, or CGPA 2.5 out of 5'] : ['5 credits', 'including English and Maths']),
    backlogs: false,
    waiver: 'a credit (C6) or better in WAEC or NECO English can waive it',
  },
  Vietnam: {
    school: 'High school graduation (Grade 12)',
    schoolDocs: 'High school transcript and graduation certificate',
    degree: 'Bachelor’s degree',
    grade: (p, pg) => [`GPA ${gpa10(p)}`, pg ? 'out of 10, in the bachelor’s degree' : 'out of 10, in Grade 12'],
    backlogs: false,
  },
};

/** Any country without its own rules: the course's percentage or its equivalent, checked by GSP. */
const ANY: Rules = {
  school: 'Grade 12 or equivalent',
  schoolDocs: 'School leaving certificates and mark sheets',
  degree: 'Bachelor’s degree or equivalent',
  grade: (p) => [`${p}% or equivalent`, 'in the country’s own grading'],
  backlogs: false,
  note: () => 'GSP checks the equivalent grade with the university for students from here.',
};

const PG: Course['level'][] = ['Postgraduate diploma', 'Master’s degree', 'PhD or research'];

export function entryFor(c: Course, country: string): EntryRules {
  const r = RULES[country] ?? ANY;
  const pg = PG.includes(c.level);
  const from = c.level === 'PhD or research' ? 'Master’s degree' : pg ? r.degree : c.level === 'Foundation' && country === 'India' ? 'Grade 11 or 12' : r.school;
  const [grade, sub] = r.grade(c.academic, pg);
  // 30 Oct: only the passport, the academic documents (the school's, in the country's own names, and the degree's for
  // a postgraduate course) and the English test score, which is optional
  const school = !pg && country === 'India' ? c.docs[1][0] : r.schoolDocs;
  const docs: Doc[] = [
    ['Passport', 'Required', 'With the application'],
    [school, 'Required', 'With the application'],
    ...(pg ? [[c.docs[1][0], 'Required', 'With the application'] as Doc] : []),
    ['English test score', 'Optional', 'With the application'],
  ];
  return {
    from,
    grade,
    gradeSub: sub || (pg ? 'in the bachelor’s degree' : 'in Grade 12'),
    backlogs: r.backlogs && c.backlogs !== undefined,
    waiver: r.waiver,
    docs,
    note: r.note?.(pg, c.uni.country),
  };
}
