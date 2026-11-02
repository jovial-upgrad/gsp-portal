/**
 * Slice 3 PRD rules for applications that every role shares (RP portal, GSP · Admissions, the Institution Team and
 * Admin): who an automatic chat line is from, the university reference's format and uniqueness, the GSP uploads
 * some statuses need, the duplicate-application block, and who counts as Admissions.
 */
import { ENROL_DOC, ENROL_DOC_LONG, courseOf, destOf, isOpen, STATUS, type Application, type StatusKey } from './applications';
import { officerOf } from './dataset';
import { label } from './staff';
import { getScope, isMine } from './scope';
import { adminCfg } from '../admin/data/store';
import { regionQueueName } from '../admin/data/config';
import { fullName, type Student } from './students';

/**
 * The name an automatic chat line goes out under (S3-13): the officer the application is assigned to; before one is
 * assigned (at New, before routing), the person who acted. No line goes out under "GSP" or "System".
 */
export function autoName(a: Pick<Application, 'officer'>, actor: string) {
  const o = officerOf(a);
  return o ? label(o) : actor;
}

/**
 * Admissions: the roles with Edit on Applications in slice 1's matrix (Admission in their regions, Global Ops,
 * Admin). Only they change a status, accept or reject documents, request, upload as GSP and close.
 */
export const ADMISSIONS_ROLES = ['Admission', 'Global Ops', 'Admin'];
export function isAdmissions() {
  const s = getScope();
  // the GSP · Admissions portal signs in as an Admission user; an unknown role there counts as Admissions
  return ADMISSIONS_ROLES.includes(s.role) || (s.viewer === 'gsp-admissions' && !s.role) || s.viewer === 'gsp-admin';
}

/**
 * Who changes an application's assigned officer (lock answer S3C-8, Jovial, 2 Nov): the leader of the application's
 * Admissions queue (Admin › Work › Queues), Admin and Global Ops. Everyone else sees the officer without Change.
 */
export const OFFICER_CHANGERS = ['Admin', 'Global Ops'];
export function canChangeOfficer(a: Pick<Application, 'region'>) {
  const s = getScope();
  if (OFFICER_CHANGERS.includes(s.role) || s.viewer === 'gsp-admin') return true;
  try {
    const cfg = adminCfg();
    const q = cfg.queues.find((x) => x.name === regionQueueName(a.region ?? ''));
    const lead = q ? cfg.users.find((u) => u.id === q.lead) : undefined;
    return !!lead && !!s.email && lead.email.toLowerCase() === s.email.toLowerCase();
  } catch {
    return false;
  }
}

/* ---------- the university reference (S3-8, S3-22) ---------- */

/** 3–30 letters, digits, / _ -, saved in upper case. */
export const refFormat = (v: string) => /^[A-Za-z0-9/_-]{3,30}$/.test(v.trim());
export const REF_FORMAT_ERROR = '3 to 30 letters, digits, / _ -.';
/**
 * Another application at the same university with this reference (S3-22: university + reference; the same reference
 * at another university is allowed).
 */
export function refClash(all: Application[], a: Application, ref: string): Application | undefined {
  const uni = courseOf(a).uni.id;
  const r = ref.trim().toUpperCase();
  return all.find((x) => x.id !== a.id && x.uniRef?.toUpperCase() === r && courseOf(x).uni.id === uni);
}
/** The clash error; outside the officer's regions, without the other application's ID and student (as S3-7). */
export function refClashError(clash: Application, students: Student[]) {
  const uni = courseOf(clash).uni.name;
  if (!isMine(clash.region)) return `This reference is already on another application at ${uni}. Check it against the university’s portal.`;
  const st = students.find((s) => s.id === clash.studentId);
  return `This reference is already on another application at ${uni} (${clash.id}${st ? `, ${fullName(st)}` : ''}). Check it against the university’s portal.`;
}

/* ---------- GSP's mandatory uploads on a status change (S3-9, S3-23) ---------- */

/**
 * The document GSP uploads before the status can change: the conditional offer letter, the unconditional offer
 * letter, the Acceptance letter (one for every destination), and the visa grant when GSP lodged the visa. When the
 * RP lodged it there's none: GSP asks the RP for the visa grant with Request a document.
 */
export function mandatoryUpload(k: StatusKey, visaBy: 'you' | 'gsp' | undefined): string | undefined {
  if (k === 'conditions') return 'Conditional offer letter';
  if (k === 'uol') return 'Unconditional offer letter';
  if (k === 'accrec') return 'Acceptance letter';
  if (k === 'startdate' && visaBy === 'gsp') return 'Visa grant';
  return undefined;
}

/**
 * The mandatory upload already in Documents (Jovial, 2 Nov, the Acceptance letter bug): a GSP or university copy filed
 * from Mail or uploaded in Documents counts, under the status's name or the destination's own name for it (CoE, CAS).
 */
export function uploadOnFile(a: Pick<Application, 'files' | 'courseId'>, doc: string | undefined) {
  if (!doc) return undefined;
  const d = destOf(a);
  const names = [doc, ...(doc === 'Acceptance letter' ? [ENROL_DOC_LONG[d], ENROL_DOC[d]] : [])].map((n) => n.toLowerCase());
  return [...a.files].reverse().find((f) => f.from !== 'you' && names.includes(f.name.toLowerCase()));
}

/* ---------- the RP's Withdraw (Jovial, 2 Nov) ---------- */

/** Submitted to the university: past Ready to submit (Application stage onwards), or closed after it had a reference. */
export const submittedToUni = (a: Pick<Application, 'status' | 'uniRef'>) =>
  a.status === 'closed' ? !!a.uniRef : STATUS[a.status].stage > 2 || (STATUS[a.status].stage === 2 && a.status !== 'ready');
/**
 * The RP can withdraw up to and including Ready to submit; from Submitted to university on, its Withdraw is off with
 * this reason (GSP can still close at any stage).
 */
export const RP_WITHDRAW_OFF = 'Submitted to the university. Ask your GSP contact in chat to withdraw.';
export const rpCanWithdraw = (a: Pick<Application, 'status' | 'uniRef'>) => isOpen(a as Application) && !submittedToUni(a);

/* ---------- uniqueness (S3-7, S3-28) ---------- */

/**
 * An application that blocks a new one for this student and course, whatever the intake: an open one, or an
 * Enrolled one (S3-28). Closed and withdrawn applications don't block, so re-applying after closure is allowed.
 */
export function blockingApp(all: Application[], studentId: string, courseId: string) {
  const c = courseId ? courseOf({ courseId }) : undefined;
  return all.find((x) => x.studentId === studentId && (x.courseId === courseId || (!!c && courseOf(x).uni.id === c.uni.id && courseOf(x).name === c.name)) && (isOpen(x) || x.status === 'enrolled'));
}
/** The block's message: with the ID, status and a link inside the person's regions; without them outside (S3-7). */
export function blockMessage(x: Application, first: string): { text: string; link?: string } {
  const c = courseOf(x);
  if (!isMine(x.region)) return { text: `${first} already has an open application for this course.` };
  return { text: `${first} already has an open application for this course: ${x.id}, ${x.status === 'enrolled' ? 'Student enrolled' : STATUS[x.status].text(c.uni.country)}`, link: x.id };
}
