/**
 * The Applications list's extra columns (Jovial, 18 Nov: what Commissions asked to see), each read from the records
 * the portal keeps: the application, its student, its course and university, the university's institution partner and
 * territory, and the RP record. A column whose field the portal doesn't hold yet says so (Application BDM is kept on the
 * application when it's made, R152; until then the RP's BDM).
 */
import { STAGES, intakeStart, rankOf, stageOf, statusText, type Application } from '../../data/applications';
import { fullName, type Student } from '../../data/students';
import { courseOf } from '../../data/applications';
import { ctxRps, ctxUnis, ipName } from '../../finance/commission/store';
import { sampleOps } from '../../rpops/records/data';
import { HOME_RP } from '../rps';

export type ColCtx = { apps: Application[]; student: (a: Application) => Student | undefined; counsellor: (a: Application) => string };
export type AppColumn = { key: string; label: string; get: (a: Application, x: ColCtx) => string };

let ops: ReturnType<typeof sampleOps> | undefined;
const rpOf = (a: Application) => ctxRps().find((r) => r.name === (a.rp ?? HOME_RP));
const opsOf = (a: Application) => (ops ??= sampleOps()).find((r) => r.name === (a.rp ?? HOME_RP));
const day = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const plusMonths = (iso: string, m: number) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
};

/** The application BDM (R152): the one kept on the application, else the RP's BDM when it was made. */
export const appBdmOf = (a: Application) => a.bdm ?? opsOf(a)?.recruitment ?? '';

export const APP_COLUMNS: AppColumn[] = [
  { key: 'gsp', label: 'GSP student ID', get: (a) => a.studentId },
  { key: 'name', label: 'Full name', get: (a, x) => (x.student(a) ? fullName(x.student(a)!) : '') },
  { key: 'dob', label: 'Date of birth', get: (a, x) => x.student(a)?.dob ?? '' },
  { key: 'nationality', label: 'Nationality', get: (a, x) => x.student(a)?.nationality ?? '' },
  { key: 'current', label: 'Current country', get: (a, x) => x.student(a)?.country ?? '' },
  { key: 'insid', label: 'Institution ID', get: (a) => courseOf(a).uni.id },
  { key: 'ins', label: 'Institution name', get: (a) => courseOf(a).uni.name },
  { key: 'partner', label: 'Partner name (IP)', get: (a) => ipName(ctxUnis().find((u) => u.id === courseOf(a).uni.id)?.ip) },
  { key: 'priority', label: 'IP priority', get: (a) => (courseOf(a).uni.priorityFor?.includes(rpOf(a)?.country ?? '') ? 'Priority' : '') },
  { key: 'country', label: 'Country', get: (a) => courseOf(a).uni.country },
  { key: 'campus', label: 'Campus', get: (a) => a.fees?.campus || courseOf(a).campus.name },
  { key: 'pref', label: 'Preference', get: (a, x) => rankOf(x.apps, a, x.student(a)?.primaryApp) },
  { key: 'stage', label: 'Stage', get: (a) => STAGES[stageOf(a)] },
  { key: 'status', label: 'Status', get: (a) => statusText(a) },
  { key: 'intake', label: 'Intake', get: (a) => a.intake },
  { key: 'done', label: 'Completion date', get: (a) => day(plusMonths(a.fees?.start || new Date(intakeStart(a.intake)).toISOString().slice(0, 10), courseOf(a).months)) },
  { key: 'sector', label: 'Sector (study area)', get: (a) => courseOf(a).area },
  { key: 'level', label: 'Programme level', get: (a) => courseOf(a).level },
  { key: 'stype', label: 'Student type', get: (a) => a.fees?.studentType ?? '' },
  { key: 'fee', label: 'Course fee (a year)', get: (a) => (a.fees?.tuition ?? courseOf(a).tuition).toLocaleString('en-GB') },
  { key: 'cur', label: 'Currency', get: (a) => courseOf(a).currency },
  { key: 'rp', label: 'RP', get: (a) => a.rp ?? HOME_RP },
  { key: 'rpid', label: 'RP ID', get: (a) => rpOf(a)?.code ?? '' },
  { key: 'rpbdm', label: 'RP BDM', get: (a) => opsOf(a)?.recruitment ?? '' },
  { key: 'counsellor', label: 'RP counsellor', get: (a, x) => x.counsellor(a) },
  { key: 'appbdm', label: 'Application BDM', get: (a) => appBdmOf(a) },
];
