/**
 * One application data set (Jovial, 31 Oct). Every module reads the same applications: the RP portal, Admissions,
 * Institution, Admin, My work's tasks, Mail's threads, the Commission tab and Finance's ledgers and payout runs.
 * Each application points by id to its student, its course (and so its university), its RP and the GSP person who
 * owns it; Finance's terms are found from the university (`link`) and the RP id.
 *
 * dataset.json is built by gen_dataset.py from the CRM-shaped work sample (47 open applications at every stage,
 * real RPs and universities, invented students) and Finance's demo enrolments (30, with their commission). The
 * designer's nine applications (data/applications.ts) are the sample agency's own and sit alongside these.
 */
import DATASET from './dataset.json';
import { COURSES, type Course, type Destination } from './courses';
import type { Application, StatusKey } from './applications';
import type { Student } from './students';
import { labelOfId, staffById } from './staff';

const DAY = 86_400_000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type DataApp = (typeof DATASET.apps)[number];
export type DataRp = { id: string; name: string; region: string; terms: boolean };

/** Every RP an application in the data set is with: Finance's id, name and sales region. */
export const RPS: DataRp[] = DATASET.rps as DataRp[];
export const rpByName = (name: string) => RPS.find((r) => r.name === name);
/** Catalogue university id → Finance's terms id. */
export const UNI_TERMS: Record<string, string> = DATASET.link;
/** The old sample ids (A00391…, A00401…) → the application's id, for anything that still names them. */
export const OLD_ID: Record<string, string> = DATASET.idmap;

/** "03-Feb-2027" or "2025-07-21" → "Feb 2027" */
function intakeOf(a: DataApp) {
  if ('intakeDate' in a && a.intakeDate) {
    const [y, m] = (a.intakeDate as string).split('-');
    return `${MON[Number(m) - 1]} ${y}`;
  }
  const [, m, y] = (a.intake ?? '').split('-');
  return `${m} ${y}`;
}
/** The application's course: the one with that name at that university. */
export function courseFor(a: Pick<DataApp, 'uni' | 'course' | 'level'>): Course {
  return COURSES.find((c) => c.uni.id === a.uni && c.name === a.course) ?? COURSES.find((c) => c.uni.id === a.uni && c.level === a.level) ?? COURSES.find((c) => c.uni.id === a.uni)!;
}
const STAGE_DAYS: Partial<Record<StatusKey, number>> = { checking: 2, reupload: 6, ready: 4, lodged: 10, conditions: 18, uol: 24, finance: 30, deposit: 34, payreview: 36, visa: 44, visasub: 52, enrolconf: 70 };

/** The data set's applications, in the shape every portal reads. */
export function datasetApplications(): Application[] {
  const now = Date.now();
  return DATASET.apps.map((a) => {
    const c = courseFor(a);
    const status = a.status as StatusKey;
    const intake = intakeOf(a);
    const officer = labelOfId(a.officer) || 'GSP admissions';
    const start = 'intakeDate' in a && a.intakeDate ? Date.parse(a.intakeDate as string) : 0;
    const since = status === 'enrolled' || status === 'closed' ? (start || now) + 35 * DAY : now - (a.sinceDays ?? 1) * DAY;
    const created = status === 'enrolled' || status === 'closed' ? (start || now) - 150 * DAY : since - (STAGE_DAYS[status] ?? 5) * DAY;
    const app: Application = {
      id: a.id,
      rp: a.rp ?? undefined,
      officer: a.officer,
      region: a.region,
      studentId: a.studentId,
      courseId: c.id,
      intake,
      status,
      created,
      since,
      uniRef: status === 'checking' || status === 'ready' || status === 'reupload' ? undefined : `${c.uni.id.toUpperCase().slice(0, 3)}-${a.id.slice(4)}7`,
      needs: [],
      files: [],
      history: [
        { at: created, who: 'you', text: 'Application added' },
        ...(status === 'checking' || status === 'reupload' ? [] : [{ at: created + DAY, who: 'gsp' as const, text: 'GSP checked the documents: all clear', by: officer }]),
        ...(STAGE_DAYS[status] && (STAGE_DAYS[status] ?? 0) > 4 ? [{ at: created + 2 * DAY, who: 'gsp' as const, text: `Submitted to ${c.uni.name}`, by: officer }] : []),
        ...(status === 'enrolled' ? [{ at: since, who: 'gsp' as const, text: 'Student enrolled: the university confirmed the enrolment', by: officer }] : []),
      ],
      chat: [],
      ...(a.status === 'closed' ? { end: { kind: 'Student withdrawn' as const, reason: 'Withdrew after enrolling', stage: 7, at: since } } : {}),
    };
    return app;
  });
}

/** The data set's students. `me` is the person signed in, for the sample agency's own. */
export function datasetStudents(me: string): Student[] {
  const now = Date.now();
  return DATASET.students.map((s) => {
    const a = DATASET.apps.find((x) => x.studentId === s.id)!;
    const dest = courseFor(a).uni.country as Destination;
    return {
      id: s.id,
      first: s.first,
      last: s.last,
      oneName: false,
      nationality: s.nationality,
      email: s.email,
      dial: s.dial,
      phone: s.phone,
      passport: s.passport,
      highest: a.level === 'Bachelor’s degree' || a.level === 'Diploma' || a.level === 'Foundation' ? 'g12' : 'ug',
      gender: '',
      dob: '',
      passportExpiry: '',
      country: a.region === 'Australia' && dest === 'Australia' ? 'Australia' : s.nationality,
      state: '',
      city: '',
      eduCountry: s.nationality,
      edu: {},
      work: [],
      tests: [],
      visa: '',
      rp: s.rp ?? undefined,
      visaNote: '',
      disability: '',
      disabilityNote: '',
      docs: {},
      read: [],
      counsellor: s.rp ? '' : 'karthik',
      added: now - 200 * DAY,
      addedBy: s.rp ? s.rp : me,
      apps: [],
    } as Student;
  });
}

/** Who owns an application on GSP's side, as a person. */
export const officerOf = (a: Pick<Application, 'officer'>) => (a.officer ? staffById(a.officer) : undefined);
/** The data set's record for an application id (new or old), when it's one of these. */
export const dataApp = (id: string) => DATASET.apps.find((a) => a.id === (OLD_ID[id] ?? id));
