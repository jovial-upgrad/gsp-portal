/**
 * Applications: one student, one course intake, moving through eight stages and the statuses inside them.
 * Each status says who has the application (the agency, GSP, the university, or the agency and GSP
 * together) and which document arrives there. Wording follows the destination for the acceptance
 * document: a CoE in Australia, a CAS in the UK, an I-20 in the USA, an LOA in Canada.
 *
 * GSP can ask for a document at any stage. A request shows in the chat, in Documents and as "Pending on you",
 * and can be answered from any of them.
 *
 * The "GSP Assist" helpers at the end stand in for the AI in the real product: reading an offer letter,
 * checking a document before GSP sees it, checking eligibility, forecasting dates and drafting messages.
 * They answer only from the application's own data, and they never change it.
 */
import { CLARITY, isClear } from './clarity';
import { finalFeeOf, flagsOf } from './live';
import { closeReasons, endName, isWithdrawal, type EndKind } from './reasons';
import { uniForms } from './courses';
import { adminCfg } from '../admin/data/store';
import { condOf, whenText } from '../admin/data/config';
import { STAFF, label, staffById } from './staff';
import { routeApplication } from './regions';
import { datasetApplications, testAgencyApps, testAgencyStudents } from './dataset';
import { COURSES, formLevelOf, intakeDates, blockedFor, daysTo, earnOf, intakeState, money, type Course, type Destination } from './courses';
import { eligibility, groupsOf } from './eligibility';
import { TESTS, eduDocKey, fullName, testDocKey, testDocName, testSummary, type DocStatus, type Level as EduLevel, type Owner, type Student, type StudentApp } from './students';
import { shortDate } from './dates';

export const DAY = 86_400_000;

/* ---------- stages and statuses ---------- */

export const STAGES = ['New', 'Pre-screening', 'Application', 'Offer', 'Verification', 'Acceptance', 'Visa', 'Enrolment'] as const;
/** What each stage means, in a line. */
export const STAGE_HINT = [
  'You add the application and its documents',
  'GSP verifies the documents',
  'GSP submits to the university, which decides',
  'The offer, and its conditions',
  'Finance and background check, assessment, the unconditional offer',
  'Tuition or deposit, then the acceptance letter',
  'The visa',
  'Enrolment',
];

/** Who has it now. done: enrolled. end: closed. wd: withdrawn (S3-27: the three finished pills). */
export type AppOwner = Owner | 'done' | 'end' | 'wd';

export type StatusKey =
  | 'docs'
  | 'checking'
  | 'reupload'
  | 'ready'
  | 'lodged'
  | 'moreinfo'
  | 'addverify'
  | 'reapp'
  | 'conditions'
  | 'condsent'
  | 'reoffer'
  | 'finance'
  | 'bgdocs'
  | 'interview'
  | 'uol'
  | 'rever'
  | 'deposit'
  | 'payreview'
  | 'waitad'
  | 'accrec'
  | 'reacc'
  | 'refundacc'
  | 'visa'
  | 'visasub'
  | 'startdate'
  | 'revisa'
  | 'refundvisa'
  | 'enrolconf'
  | 'reenrol'
  | 'enrolled'
  | 'closed';

/**
 * The acceptance document, by destination (Jovial, 31 Oct): GSP · Admin › Document configuration's first Acceptance
 * rule for the destination ("Confirmation of Enrolment (CoE)"). The short name is the part in brackets.
 */
const acceptRule = (d: string) =>
  adminCfg().docRules.find((r) => r.on && r.stage === 'Acceptance' && r.by === 'GSP' && condOf(r).countries.includes(d))?.doc ?? 'Acceptance letter';
const shortOf = (doc: string) => /\(([^)]+)\)\s*$/.exec(doc)?.[1] ?? doc;
export const ENROL_DOC = new Proxy({} as Record<Destination, string>, { get: (_t, d: string) => shortOf(acceptRule(d)) });
export const ENROL_DOC_LONG = new Proxy({} as Record<Destination, string>, { get: (_t, d: string) => acceptRule(d) });
export const VISA_NAME: Record<Destination, string> = { Australia: 'student visa (subclass 500)', UK: 'Student visa', USA: 'F-1 visa', Canada: 'study permit', 'New Zealand': 'student visa', Ireland: 'study visa' };

type StatusDef = {
  stage: number;
  owner: AppOwner;
  text: (d: Destination) => string;
  /** A status only some applications go through, and when. */
  branch?: string;
  /** The document that arrives at this status, and who adds it ("lodger": whoever lodges the visa). */
  doc?: { by: 'gsp' | 'you' | 'lodger'; name: (d: Destination) => string };
  /** The agency's part here is what GSP asks for: once it's all in, it's with GSP until GSP moves it on. */
  asks?: true;
  /** Where it sits against the university submission, in the Application stage (engineering review, 1 Nov): lists by stage group them. */
  phase?: Phase;
};
export type Phase = 'before' | 'after';
/** The group names for `phase`, as the status lists show them. */
export const PHASE_LABEL: Record<Phase, string> = { before: 'Before submission', after: 'After submission' };

/**
 * The journey, stage by stage, as GSP runs it (Nesil's stage and status concept, 28 Oct 2026). Only New to
 * Pre-screening moves on its own, when the agency sends the documents; GSP's team moves every other status.
 * The university has the statuses where it's deciding.
 */
export const STATUS: Record<StatusKey, StatusDef> = {
  docs: { stage: 0, owner: 'you', text: () => 'Waiting for documents' },
  checking: { stage: 1, owner: 'gsp', text: () => 'Pending verification' },
  reupload: { stage: 1, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  ready: { stage: 2, owner: 'gsp', text: () => 'Ready to submit', phase: 'before' },
  lodged: { stage: 2, owner: 'uni', text: () => 'Submitted to university', phase: 'after' },
  // Lock answers L-1 (Jovial, 2 Nov): Additional documents requested (On GSP; On RP while a request is open, Who has it
  // rule 2) and Verifying additional documents (On GSP) are back; Additional documents submitted to university stays removed
  moreinfo: { stage: 2, owner: 'gsp', text: () => 'Additional documents requested', branch: 'If the university asks for more', asks: true, phase: 'after' },
  addverify: { stage: 2, owner: 'gsp', text: () => 'Verifying additional documents', branch: 'After additional documents', phase: 'after' },
  // a document rejected at this stage is one of the additional documents, so it comes after submission
  reapp: { stage: 2, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true, phase: 'after' },
  conditions: { stage: 3, owner: 'gsp', text: () => 'Conditional offer received, conditions pending', doc: { by: 'gsp', name: () => 'Conditional offer letter' }, asks: true },
  condsent: { stage: 3, owner: 'uni', text: () => 'Conditions submitted to university' },
  reoffer: { stage: 3, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  finance: { stage: 4, owner: 'gsp', text: () => 'Finance and background check' },
  // Jovial, 2 Nov: On GSP; On RP while a document request is open (Who has it rule 2)
  bgdocs: { stage: 4, owner: 'gsp', text: () => 'Background/finance documents upload pending', branch: 'If GSP asks for background or finance documents', asks: true },
  // S3-24: the university's
  interview: { stage: 4, owner: 'uni', text: () => 'University assessment or interview', branch: 'If the university assesses or interviews' },
  uol: { stage: 4, owner: 'gsp', text: () => 'Unconditional offer letter received', doc: { by: 'gsp', name: () => 'Unconditional offer letter' } },
  rever: { stage: 4, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  // S3-24: On GSP; On RP once the payment proof is requested (separately)
  deposit: { stage: 5, owner: 'gsp', text: () => 'Tuition or deposit pending', asks: true },
  payreview: { stage: 5, owner: 'gsp', text: () => 'Payment proof under review', doc: { by: 'you', name: () => 'Payment proof' } },
  waitad: { stage: 5, owner: 'uni', text: () => 'Awaiting acceptance letter from university', doc: { by: 'gsp', name: (d) => ENROL_DOC_LONG[d] } },
  // S3-23: one Acceptance letter for every destination (no CoE, CAS, I-20, LOA or Offer of place)
  accrec: { stage: 5, owner: 'gsp', text: () => 'Acceptance letter received', doc: { by: 'gsp', name: () => 'Acceptance letter' } },
  reacc: { stage: 5, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  // Jovial, 2 Nov: the university refunds the deposit; it doesn't close the application by itself
  refundacc: { stage: 5, owner: 'uni', text: () => 'Deposit refund pending', branch: 'If the university refunds the deposit' },
  // the visa is lodged by the agency or by GSP, never both: these two follow whoever lodges it (see ownerAt)
  visa: { stage: 6, owner: 'you', text: () => 'Visa lodgement pending', asks: true },
  // S3-12: On GSP, whoever lodged
  visasub: { stage: 6, owner: 'gsp', text: () => 'Visa decision pending', doc: { by: 'lodger', name: () => 'Visa lodgement proof' } },
  // Jovial, 2 Nov: one status, Visa granted, which asks for the course start date (no sub-statuses)
  startdate: { stage: 6, owner: 'gsp', text: () => 'Visa granted', doc: { by: 'lodger', name: () => 'Visa' } },
  revisa: { stage: 6, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  refundvisa: { stage: 6, owner: 'uni', text: () => 'Deposit refund pending', branch: 'If the university refunds the deposit' },
  enrolconf: { stage: 7, owner: 'gsp', text: () => 'Enrolment confirmation pending', doc: { by: 'gsp', name: () => 'Proof of enrolment' } },
  reenrol: { stage: 7, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  enrolled: { stage: 7, owner: 'done', text: () => 'Student enrolled' },
  closed: { stage: 0, owner: 'end', text: () => 'Closed' },
};
/** Document re-upload pending, in each stage from Pre-screening: where GSP's rejection of a document puts the application. */
export const REUPLOAD_AT: (StatusKey | undefined)[] = [undefined, 'reupload', 'reapp', 'reoffer', 'rever', 'reacc', 'revisa', 'reenrol'];
/** The statuses in journey order (GSP's status list follows it). */
export const STATUS_ORDER = Object.keys(STATUS).filter((k) => k !== 'closed') as StatusKey[];
/** A status's group in a list by stage ("Before submission"), for the stages that split; undefined elsewhere. */
export const phaseOf = (k: StatusKey) => (STATUS[k].phase ? PHASE_LABEL[STATUS[k].phase!] : undefined);

/** Who has it, in words: one table, data/owners.ts (HC24). */
// the RP portal's wording (GSP roles use data/owners.ts OWNER_WORD: On RP, On GSP, On university)
export { RP_OWNER_WORD as OWNER_WORD, RP_OWNER_TAG as OWNER_TAG } from './owners';
/** How an application can close, and the ways it closes at each stage (GSP's status list): one list, data/reasons.ts (HC23). */
export type { EndKind } from './reasons';
export const CLOSE_AT = new Proxy([] as EndKind[][], { get: (t, k) => (typeof k === 'string' && /^\d+$/.test(k) ? closeReasons(Number(k)) : Reflect.get(t, k)) });

/* ---------- the application ---------- */

/** Something the agency has to do now: a document to upload, a detail to add, or a payment to confirm. */
export type Need = {
  id: string;
  title: string;
  /** Why it's asked, or GSP's reason for sending a document back. */
  why: string;
  /** Where the request came from: "Offer letter, page 2, condition 1". */
  source?: string;
  due?: number;
  /** What the agency has uploaded for it, and what GSP Assist made of it. */
  file?: string;
  check?: 'reading' | 'ok' | 'flag';
  note?: string;
  /** A detail to add to the student's profile rather than a file. */
  profile?: 'education' | 'personal' | 'tests';
  /** Something to confirm rather than upload, like paying the deposit. */
  action?: string;
  /** GSP asked for it (a document request): it goes to GSP as soon as it's uploaded. */
  request?: { by: string; at: number };
  /** Asked for at this status (an offer's conditions, the visa proof): no longer needed once the application moves on. */
  step?: StatusKey;
  /** A conditions form: the offer's conditions, each a question to answer or a document to upload, sent together. */
  form?: Cond[];
};

/** One of an offer's conditions: a question to answer, or a document to upload; and the agency's answer. */
export type Cond = { id: string; text: string; kind: 'question' | 'document'; source?: string; answer?: string; file?: string };
/** A conditions form the agency has answered and sent to GSP. */
export type CondSet = { id: string; title: string; by: string; at: number; sent: number; items: Cond[] };

/** A document on the application itself (not the student's profile): from the agency, GSP or the university. */
/** `via: 'profile'`: a copy of the student's profile document, added to the application for GSP to verify for this application. */
export type AppFile = { name: string; file: string; from: 'you' | 'gsp' | 'uni'; at: number; status: 'uploaded' | 'checking' | 'verified'; via?: 'chat' | 'request' | 'profile' | 'mail'; /** The request it answered. */ req?: string };

export type Who = 'you' | 'gsp' | 'uni' | 'ai' | 'system';
/** `kind`: what the line is about (data/activity.ts), for who sees it; read from the text when it isn't set. */
export type Event = { at: number; who: Who; text: string; by?: string; kind?: import('./activity').ActivityKind };
export type Msg = {
  id: string;
  at: number;
  from: 'you' | 'gsp' | 'ai' | 'uni';
  name: string;
  text: string;
  /** University emails are placed in the chat by the email engine. */
  via?: 'email';
  /** Files attached to the message. */
  files?: string[];
  /** A document request from GSP: the need it created, and the document's name (for the card once it's answered). */
  request?: string;
  requestName?: string;
  /** What an assistant answer was drawn from. */
  cites?: string[];
  /** An assistant answer that offers to hand over to a person. */
  handover?: boolean;
  /** An attached file GSP Assist matched to something the application needs. */
  useFor?: { need: string; file: string };
  /** A message drafted for the agency to send to the student. */
  draft?: { en: string; hi: string };
  /** A request card that ended without an answer: withdrawn by GSP ("Withdrawn by <name>") or closed with the application. */
  ended?: { kind: 'withdrawn' | 'closed'; by?: string; at: number };
};

export type Offer = {
  kind: 'conditional' | 'unconditional';
  file: string;
  at: number;
  acceptBy: number;
  deposit: number;
  conditions: { id: string; text: string; doc: string; source: string }[];
  /** GSP Assist found the letter in the chat. */
  found?: 'chat';
  /**
   * What GSP Assist read from the letter into Key details (S3F-2 proposal): the Offer, Accept by and Deposit rows show
   * only once it's here. Nothing fills it in v1 (later, when GSP Assist reads offer letters), so the rows stay hidden.
   */
  read?: { at: number; acceptBy?: number; deposit?: number };
};

export type Application = {
  id: string;
  /** The recruitment partner it's for, when GSP adds it (30 Oct); an agency's own have none. */
  rp?: string;
  /** The GSP admissions person who owns it: a staff id (data/staff.ts). */
  officer?: string;
  /** The sales region it's routed to. */
  region?: string;
  studentId: string;
  courseId: string;
  intake: string;
  status: StatusKey;
  created: number;
  /** When the current status started. */
  since: number;
  uniRef?: string;
  /** The documents it asked for when it was added (the course's, read for the student); anything later is a GSP request. */
  asks?: AppDoc[];
  /** The offer's conditions, as the agency answered them. */
  conds?: CondSet[];
  needs: Need[];
  files: AppFile[];
  history: Event[];
  chat: Msg[];
  offer?: Offer;
  /** The financial documents' total, once GSP verified them (in the destination's currency). */
  funds?: number;
  /** `submitted`: closed after it went to the university (S3C-9: the officer tells the university). */
  end?: { kind: EndKind; reason: string; stage: number; at: number; submitted?: boolean };
  /** GSP chased the university about a late decision. */
  chased?: number;
  /** Unread chat messages for the agency. */
  unread?: number;
  /** Who lodges the visa: the agency (the default) or GSP, when the agency asks. */
  visaBy?: 'you' | 'gsp';
  /** Document requests from a later stage, paused while the status is back before it (Jovial, 1 Nov, O1). */
  parked?: Need[];
};

export const courseOf = (a: Pick<Application, 'courseId'>) => COURSES.find((c) => c.id === a.courseId)!;
export const destOf = (a: Pick<Application, 'courseId'>) => courseOf(a).uni.country;
export const stageOf = (a: Application) => (a.status === 'closed' ? a.end?.stage ?? 0 : STATUS[a.status].stage);
export const openRequests = (a: Application) => a.needs.filter((n) => n.request);
/** Who has a status on this application: the visa steps belong to whoever lodges the visa. */
/**
 * Who has a status (Jovial, 1 Nov, Who has it): the visa steps belong to whoever lodges the visa (GSP sets it when it
 * moves the application to Visa lodgement pending); a conditional offer is GSP's until GSP has sent the conditions to
 * the RP, then the RP's.
 */
export const ownerAt = (k: StatusKey, a: Pick<Application, 'visaBy'> & { id?: string; end?: Application['end'] }): AppOwner => {
  const f = a.id ? flagsOf(a.id) : {};
  if (k === 'closed' && isWithdrawal(a.end?.kind)) return 'wd';
  if (k === 'visa') return (f.visaBy ?? a.visaBy ?? 'you') === 'gsp' ? 'gsp' : 'you';
  return STATUS[k].owner;
};
/** The five university statuses (slice 3 PRD, Who has it rule 4; University assessment or interview from 2 Nov, S3-24). */
export const UNI_STATUSES: StatusKey[] = ['lodged', 'condsent', 'interview', 'waitad', 'refundacc', 'refundvisa'];
/** The agency's documents GSP hasn't checked yet: the latest copy of each, sent and not verified. */
export function toCheck(a: Application) {
  if (a.status === 'docs') return [];
  const latest = new Map<string, AppFile>();
  for (const f of a.files.filter((x) => x.from === 'you')) if (!latest.has(f.name) || latest.get(f.name)!.at <= f.at) latest.set(f.name, f);
  return [...latest.values()].filter((f) => f.status !== 'verified');
}
/**
 * Who has it, in every stage (Nesil, 28 Oct): a document GSP asked for puts it with the agency; one the agency
 * has sent and GSP hasn't checked puts it with GSP. Where the agency's part is what GSP asks for (a re-upload,
 * additional documents, conditions, payment, the visa proof), it's with GSP once everything asked for is in, until
 * GSP moves the status on. Otherwise the status says who.
 */
export function ownerOf(a: Application): AppOwner {
  // a finished application is with no one: Enrolled, Closed or Withdrawn (S3-27)
  if (!isOpen(a)) return ownerAt(a.status, a);
  // slice 3 PRD, Who has it comes from what's open, not from the status (decided); the first rule that matches decides:
  // 1. New: On RP, until the RP sends the documents
  if (a.status === 'docs') return 'you';
  // 2. an open request to the RP (a document request, a send-back, a conditions request, the visa lodgement proof):
  //    On RP; paused and withdrawn requests aren't in `needs`; it outranks a university status (S3-11)
  if (a.needs.some((n) => !n.profile)) return 'you';
  // 3. something the RP sent that waits for GSP's review: On GSP
  if (toCheck(a).length) return 'gsp';
  // 4. a university status: On university
  if (UNI_STATUSES.includes(a.status)) return 'uni';
  // 5. anything else: On GSP
  return 'gsp';
}
/** Needs the agency: its own statuses, or a document GSP asked for. */
export const needsYou = (a: Application) => isOpen(a) && ownerOf(a) === 'you';
/** "Closed: University rejected", "Withdrawn: The student chose another offer", or the status. */
export const statusText = (a: Application) =>
  a.status === 'closed' ? (isWithdrawal(a.end?.kind) ? `Withdrawn${a.end?.reason ? `: ${a.end.reason}` : ''}` : `Closed: ${endName(a.end?.kind) ?? ''}`.replace(/: $/, '')) : STATUS[a.status].text(destOf(a));
export const isOpen = (a: Application) => a.status !== 'closed' && a.status !== 'enrolled';

/**
 * GSP's person on an application (HC21, Jovial 1 Nov): its officer; without one, its sales region's Admissions
 * contact (GSP · Admin › Sales regions). Both are people on the staff list (data/staff.ts).
 */
export function gspContact(a: Partial<Pick<Application, 'officer' | 'region'>>) {
  let s = a.officer ? staffById(a.officer) : undefined;
  if (!s && a.region) {
    const name = adminCfg().regions.find((g) => g.name === a.region)?.contact;
    s = name ? STAFF.find((x) => label(x) === name) : undefined;
  }
  if (!s) return { name: 'GSP Admissions', role: 'GSP admissions', phone: '', email: '', first: 'GSP' };
  return { name: label(s), role: 'GSP admissions', phone: s.phone ? `${s.dial} ${s.phone}` : '', email: s.email, first: s.first };
}

/**
 * Typical days at a status (HC22, Jovial 1 Nov): Work › SLA by status, in working hours, 9 to a day. The work store
 * reads every module's applications, so it's loaded after this module starts (a static import would be circular).
 */
type SlaRow = { stage: string; status: string; days: number };
let slaRows: (() => SlaRow[]) | null = null;
void import('../work/store')
  .then((m) => {
    slaRows = () => (m.getState() as { statusSla: SlaRow[] }).statusSla;
  })
  .catch(() => undefined);
export function usualDays(k: StatusKey, d: Destination): number | undefined {
  const rows = slaRows?.() ?? [];
  const text = STATUS[k].text(d);
  const row = rows.find((r) => r.status === text && r.stage === STAGES[STATUS[k].stage]) ?? rows.find((r) => r.status === text);
  return row && row.days > 0 ? Math.max(1, Math.round(row.days / 9)) : undefined;
}
const usualOf = (k: StatusKey, c: Course) => usualDays(k, c.uni.country);

/** How long the application has been at this status, and how long it usually takes there. */
export function clock(a: Application) {
  const days = Math.floor((Date.now() - a.since) / DAY);
  const usual = usualOf(a.status, courseOf(a));
  const late = usual !== undefined && usual > 0 && days > usual;
  return { days, usual, late };
}

/** The sentence the student's record uses for an application. */
export function studentApps(list: Application[], studentId: string): StudentApp[] {
  return list
    .filter((a) => a.studentId === studentId)
    .map((a) => {
      const c = courseOf(a);
      const o = ownerOf(a);
      return { id: a.id, course: c.name, uni: c.uni.name, intake: a.intake, owner: o, status: openRequests(a).length ? `GSP asked for ${openRequests(a)[0].title.toLowerCase()}` : statusText(a) };
    });
}

/* ---------- documents ---------- */

/** Profile document keys for the course's own documents: these are kept on the student for next time. */
const PROFILE_KEY: [RegExp, string][] = [
  [/^Statement of purpose/, 'sop'],
  [/^CV/, 'cv'],
  [/^Two references|^Letters of recommendation/, 'lor'],
  [/^Work experience/, 'work'],
];
export const profileKeyFor = (name: string) => PROFILE_KEY.find(([re]) => re.test(name))?.[1];
/** Documents kept on the student's profile, so every application can use them (and a decision on one counts for all). */
export const keptOnProfile = (key: string) => /^(passport|edu-|test-|sop$|cv$|lor$|work$)/.test(key);

/** A document an application asks for, decided when it's added. */
export type AppDoc = {
  key: string;
  name: string;
  /** What it is, in a line. */
  what: string;
  need: 'required' | 'optional';
  /** A marksheet, and the level of education it's for. */
  level?: EduLevel;
  /** The university's template to download and fill (its own application form). */
  template?: { name: string; file: string };
};

/** The application form's postgraduate levels; a Program level Admin added counts as its Application form level (S2C-13). */
const PG_LEVELS: string[] = ['Master’s degree', 'Postgraduate diploma', 'PhD or research'];
export const isPgCourse = (c: Pick<Course, 'level'>) => PG_LEVELS.includes(formLevelOf(c.level));
const MARKS: Record<EduLevel, [string, string]> = {
  g10: ['10th marksheet', 'Class 10 board exam marksheet'],
  g12: ['12th marksheet', 'Class 12 board exam marksheet'],
  ug: ['UG marksheet', 'Undergraduate marksheets, every semester, and the degree certificate'],
  pg: ['PG marksheet', 'Postgraduate marksheets, every semester, and the degree certificate'],
};
const markDoc = (l: EduLevel, need: AppDoc['need']): AppDoc => ({ key: eduDocKey(l), name: MARKS[l][0], what: MARKS[l][1], need, level: l });
/** The course's own documents, as an application names and explains them. */
const OWN: [RegExp, string, string][] = [
  [/^Statement of purpose/, 'Statement of purpose', 'Why this course and this university, written for this application'],
  [/^CV/, 'CV', 'Education, work and achievements, up to date'],
  [/^Work experience/, 'Work experience letters', 'A letter from each employer, with dates and role'],
  [/^Portfolio/, 'Portfolio', 'Recent work, as one PDF'],
  [/^Research proposal/, 'Research proposal', 'The question, the approach, and why this university'],
];

/**
 * The documents an application asks for, decided when it's added: the course's own list (Find courses shows it
 * under Documents to collect), read for this student. The marksheets follow the course's level and the student's
 * education; the English score report is the test on the student's profile. What the course needs only later
 * (financial documents after the offer, references if the university wants them, a gap explanation) isn't
 * collected here: GSP asks for it in the chat when it's needed.
 */
/** The study level as GSP · Admin's document rules name it. */
const RULE_LEVEL: Record<string, string> = { Foundation: 'Foundation', Diploma: 'Diploma', 'Bachelor’s degree': 'Bachelor’s degree', 'Postgraduate diploma': 'Postgraduate diploma', 'Master’s degree': 'Master’s degree', 'PhD or research': 'PhD or research' };
/**
 * The documents an application asks for when it's added (Jovial, 31 Oct): GSP · Admin › Document configuration's
 * rules for the New stage that the RP uploads, where each rule applies to this course (its study level, the
 * university's country, where the student is). A rule with a condition the prototype can't check ("the university
 * has its own form") asks for it as optional, with the condition as the reason. The English test comes from the
 * course's English rule, as before.
 */
export function docsFor(s: Student, c: Course): AppDoc[] {
  const out: AppDoc[] = [];
  // a Program level Admin added counts as its Application form level (S2C-13)
  const level = RULE_LEVEL[formLevelOf(c.level)] ?? 'Postgraduate';
  const inDest = s.country === c.uni.country || (s.country === 'United Kingdom' && c.uni.country === 'UK');
  const add = (d: AppDoc) => { if (!out.some((x) => x.key === d.key)) out.push(d); };
  for (const r of adminCfg().docRules) {
    if (!r.on || r.stage !== 'New' || r.by !== 'RP') continue;
    const k = condOf(r);
    if (k.levels.length && !k.levels.includes(level)) continue;
    if (k.countries.length && !k.countries.includes(c.uni.country)) continue;
    if (k.where === 'Already in the destination' && !inDest) continue;
    if (k.where === 'Outside the destination' && inDest) continue;
    const need: AppDoc['need'] = r.setting === 'Mandatory' && !k.other ? 'required' : 'optional';
    const name = r.doc;
    if (/^Passport/i.test(name)) add({ key: 'passport', name: 'Passport', what: 'The photo page and the address page', need });
    else if (/class 10|10th|ssc/i.test(name)) add(markDoc('g10', need));
    else if (/class 12|12th|hsc/i.test(name)) add(markDoc('g12', need));
    else if (/^UG |undergraduate|bachelor/i.test(name)) add(markDoc('ug', need));
    else if (/^PG |postgraduate|master/i.test(name)) add(markDoc('pg', need));
    else if (/application form/i.test(name)) {
      // only when the university has its own form for this level, with the template to download (Jovial, 1 Nov)
      const f = uniForms(c.uni.id, c.level)[0];
      if (f) add({ key: 'uni-form', name: 'University application form, filled', what: `${c.uni.name}’s own form: download the template, fill it in and upload it`, need: r.setting === 'Mandatory' ? 'required' : 'optional', template: { name: f.name, file: f.file } });
    } else {
      const own = OWN.find(([re]) => re.test(name));
      add({ key: profileKeyFor(name) ?? name.toLowerCase().replace(/[^a-z]+/g, '-'), name: own?.[1] ?? name, what: k.other ? `When ${k.other.charAt(0).toLowerCase()}${k.other.slice(1)}` : own?.[2] ?? `GSP asks for it for ${whenText(k).toLowerCase()}`, need });
    }
  }
  // the English test: from the course's English rule
  const t = s.tests.find((x) => TESTS[x.type].kind === 'English' && x.overall);
  if (t) add({ key: testDocKey(t), name: testDocName(t), what: `${testSummary(t)}, from ${s.first}’s profile`, need: 'required' });
  else add({ key: 'english', name: 'English test score report', what: c.englishFlex ? `${c.uni.name} can take it later; GSP asks for it before the offer is final` : `${c.name} needs one before GSP can submit`, need: c.englishFlex ? 'optional' : 'required' });
  return out;
}


/** What an application asks for: what was set when it was added (the course's, read for the student, for older ones). */
export const asksOf = (a: Application, s: Student) => a.asks ?? docsFor(s, courseOf(a));

/** One of the application's documents, and where it is: uploaded to this application (the latest), on the student's profile, or nowhere yet. */
export type DocLine = AppDoc & { from?: 'profile' | 'application'; file?: string; status?: DocStatus; via?: AppFile['via'] };
export function docLines(a: Application, s: Student): DocLine[] {
  return asksOf(a, s).map((d) => {
    const own = a.files.filter((f) => f.name === d.name).sort((x, y) => y.at - x.at)[0];
    const prof = s.docs[d.key];
    return { ...d, from: own ? 'application' : prof ? 'profile' : undefined, file: own?.file ?? prof?.file, status: own?.status ?? prof?.status, via: own?.via };
  });
}

/* ---------- GSP Assist: eligibility ---------- */

export type Verdict = 'Eligible' | 'Eligible with conditions' | 'Not eligible' | 'Add details to check' | 'Not specified';
/** na: not specified by the university; it doesn't count against the student. */
export type Reason = { ok: 'yes' | 'warn' | 'no' | 'add' | 'na'; title: string; text: string; /** Academics and English (2 Nov): each check under the group, with its own result and why. */ lines?: { sub: string; ok: Reason['ok']; text: string }[] };

/** A check's result and why as one sentence, said once ("Expired: Expired: …" was the result twice) and ending once. */
const lineText = (l: { result: string; why: string }) => {
  const why = l.why.startsWith(`${l.result}:`) ? l.why.slice(l.result.length + 1).trim() : l.why;
  return `${l.result}: ${why}${/[.!?]$/.test(why) ? '' : '.'}`;
};

/** Checks a student against a course intake, with the reason for each part of the verdict. */
export function checkFit(s: Student, c: Course, intake: string): { verdict: Verdict; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const uni = c.uni.name;
  const so = (ok: boolean) => `so ${s.first} ${ok ? 'is eligible' : 'isn’t eligible'}`;
  // where the student lives: the country says it (a state only where a university turns that state down)
  if (blockedFor(c.uni, s.country, s.state))
    reasons.push({ ok: 'no', title: 'Where they live', text: `${uni} doesn’t take students from ${s.state ? `${s.state}, ` : ''}${s.country} through GSP.` });
  else reasons.push({ ok: 'yes', title: 'Where they live', text: `${uni} takes students from ${s.country}.` });
  // academics and English: the eligibility check (slice 3 PRD; data/eligibility.ts), each line with its result
  void so;
  const k = eligibility(s, c);
  // one row each for Academics and English (Jovial, 2 Nov), its worst line's state, every check under it
  for (const g of groupsOf(k)) reasons.push({ ok: g.ok, title: g.key, text: g.verdict, lines: g.lines.map((l) => ({ sub: l.sub, ok: l.ok, text: lineText(l) })) });
  // intake
  const i = c.intakes.find((x) => x.month === intake);
  if (i) {
    const st = intakeState(i);
    const d = daysTo(i.deadline);
    if (st === 'closed') reasons.push({ ok: 'no', title: 'Intake', text: `${intake} closed on ${shortDate(new Date(i.deadline))}.` });
    else if (st === 'late') reasons.push({ ok: 'warn', title: 'Intake', text: `${intake} closed on ${shortDate(new Date(i.deadline))}, so the likelihood is low. GSP Admissions checks with the university and tells you whether to go ahead or close the application.` });
    else if (st === 'likely') reasons.push({ ok: 'warn', title: 'Intake', text: `${intake} usually opens; the university hasn’t confirmed it yet.` });
    else reasons.push({ ok: d <= 21 ? 'warn' : 'yes', title: 'Intake', text: `${intake} is open, closes ${shortDate(new Date(i.deadline))}${d <= 45 ? `: ${d} ${d === 1 ? 'day' : 'days'} left` : ''}.` });
  }
  // the overall verdict: academics and English as the check has them (neither specified: Not specified), with where they
  // live and the intake kept beside them (slice 3 PRD, Overall verdict)
  const verdict: Verdict = reasons.some((r) => r.ok === 'no') ? 'Not eligible' : reasons.some((r) => r.ok === 'add') ? 'Add details to check' : k.verdict === 'Not specified' ? 'Not specified' : reasons.some((r) => r.ok === 'warn') ? 'Eligible with conditions' : 'Eligible';
  return { verdict, reasons };
}

/** Courses close to the one picked that the student can apply to: same subject and destination first. */
export function nearMisses(s: Student, c: Course, n = 3) {
  return COURSES.filter((x) => x.id !== c.id && x.uni.country === c.uni.country && x.level === c.level && x.intakes.some((i) => intakeState(i) === 'open'))
    .map((x) => {
      const intake = x.intakes.find((i) => intakeState(i) === 'open')!.month;
      return { c: x, intake, fit: checkFit(s, x, intake) };
    })
    .filter((m) => m.fit.verdict === 'Eligible' || m.fit.verdict === 'Eligible with conditions')
    .sort((a, b) => Number(b.c.area === c.area) - Number(a.c.area === c.area) || Number(a.fit.verdict !== 'Eligible') - Number(b.fit.verdict !== 'Eligible') || a.c.offerDays - b.c.offerDays)
    .slice(0, n);
}


/* ---------- GSP Assist: reading a document before GSP sees it ---------- */

const KINDS: [RegExp, string][] = [
  [/ielts|trf|pte|toefl|duolingo|det\b|english|score[-_ ]report/i, 'an English test score report'],
  [/proposal/i, 'a research proposal'],
  [/passport/i, 'a passport'],
  [/bank|statement[-_ ]?\d|statements/i, 'a bank statement'],
  [/transcript|marks|marksheet|degree|semester|grade|consolidated/i, 'an academic transcript'],
  [/offer/i, 'an offer letter'],
  // a payment's receipt before the visa's: "deposit_receipt" is a payment
  [/deposit|payment|paid|tuition/i, 'a payment receipt'],
  [/immi|lodg|\btrn\b|visa/i, 'a visa lodgement receipt'],
  [/\bcv\b|_cv|cv_|resume/i, 'a CV'],
  [/sop|statement[-_ ]of[-_ ]purpose/i, 'a statement of purpose'],
  [/experience|relieving|employment/i, 'a work experience letter'],
  [/gap/i, 'a gap explanation letter'],
  [/reference|recommendation|\blor\b/i, 'a reference letter'],
  [/portfolio/i, 'a portfolio'],
];
/** What kind of document a name or a request is about. */
export const kindOf = (text: string) => KINDS.find(([re]) => re.test(text))?.[1];

/**
 * What GSP Assist makes of a file before it goes to GSP: the kind of document, whether it's the one asked
 * for, and the details it read. In this prototype the file name stands in for the page.
 */
export function readFile(file: string, want: string, s: Student): { ok: boolean; note: string } {
  const wanted = kindOf(want);
  const got = kindOf(file);
  // BR-50: below the clarity pass mark the file isn't kept and is uploaded again (data/clarity.ts)
  if (!isClear(file)) return { ok: false, note: CLARITY.unclear };
  if (wanted && got && wanted !== got) return { ok: false, note: `This looks like ${got}, not ${wanted}. Check you picked the right file.` };
  const name = fullName(s);
  if (wanted === 'a bank statement') return { ok: true, note: `Bank statement, State Bank of India: 6 months, May to October 2026. Name matches ${name}.` };
  if (wanted === 'an academic transcript') return { ok: true, note: `Transcript, all semesters, with the final result. Name matches ${name}.` };
  if (wanted === 'a visa lodgement receipt') return { ok: true, note: `Visa lodgement receipt, lodged ${shortDate(new Date())}. Name and passport number match.` };
  if (wanted === 'a payment receipt') return { ok: true, note: `Payment receipt to the university. Name matches ${name}.` };
  if (wanted === 'a statement of purpose') return { ok: true, note: `Statement of purpose, 2 pages, about the course and ${s.first}’s plans. Name matches.` };
  if (wanted === 'a gap explanation letter') return { ok: true, note: `Signed letter covering the years since ${s.first}’s last qualification.` };
  if (wanted === 'a work experience letter') return { ok: true, note: `Letter on company letterhead, with dates and role. Name matches ${name}.` };
  return { ok: true, note: `Readable, and the name matches ${name}.` };
}

/** Which marksheet a file looks like, from its name (the page itself, in the real product). */
const MARK_LEVEL: [RegExp, EduLevel][] = [
  [/12|twelfth|xii|hsc|puc|plus[-_ ]?two|intermediate/i, 'g12'],
  [/10|tenth|\bx\b|ssc|sslc|matric/i, 'g10'],
  [/\bpg\b|_pg|pg_|m\.?tech|m\.?sc|\bma\b|mba|master|post[-_ ]?grad/i, 'pg'],
  [/ug|b\.?com|bca|b\.?tech|b\.?sc|\bba\b|b\.?e\b|bachelor|degree|semester|graduat|consolidated/i, 'ug'],
];
/**
 * What GSP Assist makes of a document uploaded for an application: not clear, not the document asked for (a
 * marksheet for another level, or another kind of document), another student's name, or uploaded successfully.
 * The file name stands in for the page in this prototype.
 */
export type DocIssue = 'unclear' | 'wrong' | 'name';
/** A document's name inside a sentence: "the statement of purpose", "the CV", "the English test score report". */
export const named = (n: string) => (/^(English|IELTS|PTE|TOEFL|Duolingo)\b/.test(n) ? n : n.replace(/^[A-Z](?=[a-z])/, (x) => x.toLowerCase()));
export function readDoc(file: string, d: Pick<AppDoc, 'name' | 'level'>, s: Student): { ok: boolean; note: string; issue?: DocIssue } {
  if (!isClear(file)) return { ok: false, issue: 'unclear', note: CLARITY.unclear };
  if (d.level) {
    const got = MARK_LEVEL.find(([re]) => re.test(file))?.[1];
    if (got && got !== d.level) return { ok: false, issue: 'wrong', note: `The document uploaded is not the ${d.name}.` };
  } else {
    const wanted = kindOf(d.name);
    const got = kindOf(file);
    if (wanted && got && wanted !== got) return { ok: false, issue: 'wrong', note: `The document uploaded is not the ${named(d.name)}.` };
  }
  if (otherPerson(file, s)) return { ok: false, issue: 'name', note: 'The student name in the document is mismatched.' };
  return { ok: true, note: 'Uploaded successfully.' };
}

/** First names GSP Assist recognises in a file name, to tell one person's document from another's (sample). */
const NAMES = new Set(
  'aarav aditya ajay akash ali aman amit ananya anjali ankit arjun arun asha ayesha deepak dev divya fatima gaurav harsh irfan isha karthik kavya kiran kunal lakshmi manish meera mohit neha nikhil nisha omar pooja priya rahul raj rakesh ravi rekha riya rohan rohit sachin sahil sanjay sara shreya sneha sunita suresh swati tanvi varun vijay vikram vivek yash zara'.split(' '),
);
/** A name in the file that isn't the student's: the 10th marksheet of "rohit" uploaded for Irfan. */
function otherPerson(file: string, s: Student) {
  const mine = `${s.first} ${s.last}`.toLowerCase().split(/[^a-z]+/);
  return file
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .split(/[^a-z]+/)
    .find((t) => NAMES.has(t) && !mine.includes(t));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Courses start around the fourth week of the intake month. */
/** When the application's course starts and its census date (Jovial, 31 Oct): the catalogue's intake dates; without them, the 22nd of the month and four weeks on. */
export function startOf(a: Pick<Application, 'courseId' | 'intake'>) {
  const d = intakeDates(a.courseId, a.intake);
  return d?.start ? Date.parse(d.start + 'T00:00:00Z') : intakeStart(a.intake);
}
export function censusOf(a: Pick<Application, 'courseId' | 'intake'>) {
  const d = intakeDates(a.courseId, a.intake);
  return d?.census ? Date.parse(d.census + 'T00:00:00Z') : startOf(a) + 28 * DAY;
}
/**
 * The census date the application starts with (lock answer S3C-13, Jovial, 2 Nov): Admissions fills it on the
 * application; the intake's census date (Institution › Courses › Intakes) pre-fills it when it's set. Null when the
 * intake has none: the field starts empty.
 */
export function intakeCensusOf(a: Pick<Application, 'courseId' | 'intake'>): number | null {
  const d = intakeDates(a.courseId, a.intake);
  return d?.census ? Date.parse(d.census + 'T00:00:00Z') : null;
}
export function intakeStart(intake: string) {
  const [m, y] = intake.split(' ');
  return new Date(Number(y), MONTHS.indexOf(m), 22).getTime();
}


/** What the agency earns on the application, once the student enrols and the census date passes. */
export const earnFor = (a: Application) => {
  // from the application's final tuition fee (Jovial, 1 Nov): the course's fee until Admissions changes it
  const c = courseOf(a);
  const amount = earnOf({ ...c, tuition: finalFeeOf(a.id, c.tuition) });
  return { amount, currency: c.currency, text: money(amount, c.currency) };
};

/* ---------- moving an application on ---------- */

/** The one move that happens on its own: the agency sends the documents and the application goes to GSP's pre-screening. GSP's team moves every other. */
export const NEXT_AFTER_YOU: Partial<Record<StatusKey, StatusKey>> = { docs: 'checking' };

/** What the agency has to do at a status it arrives at: documents (which GSP asks for in the chat) or something to confirm. */
// Jovial, 2 Nov: a status change never asks for a document by itself (not the visa lodgement proof, not the payment
// proof): the officer asks from the chat with Request a document. GSP's own uploads a status needs stay in Change status.
export function needsAt(_k: StatusKey, _a: Application): Need[] {
  return [];
}

/**
 * A document GSP asks the agency for, in the chat: a need to upload (it goes to GSP as soon as it's in), and the
 * request card that carries it.
 */
export function askRp(x: Application, n: Omit<Need, 'request'>, by: string, at: number): Application {
  return {
    ...x,
    needs: [...x.needs, { ...n, request: { by, at } }],
    chat: [...x.chat, { id: `m${at}-${n.id}`, at, from: 'gsp', name: by, text: '', request: n.id, requestName: n.title }],
    unread: (x.unread ?? 0) + 1,
    history: [...x.history, { at, who: 'gsp', text: `Asked for the ${named(n.title)}`, by }],
  };
}

/**
 * Arriving at a status: the old status's needs are done, and so are GSP's requests made for it (GSP's other
 * requests stay until they're answered). What the new one needs from the agency is added: a document needed now
 * is asked for by GSP in the chat, from `by` (the GSP contact, or the person in GSP's team who moved it); paying
 * the deposit is the agency's to confirm.
 */
export function arriveAt(x: Application, k: StatusKey, at: number, by = gspContact(x).name): Application {
  // requests made at a later stage pause when the status moves back before it, and come back when it returns
  // there; anything already uploaded stays (Jovial, 1 Nov: Status triggers, O1)
  const stageAt = STATUS[k].stage;
  const later = (n: Need) => !!n.step && STATUS[n.step as StatusKey] && STATUS[n.step as StatusKey].stage > stageAt;
  const back = (x.parked ?? []).filter((n) => n.step === k || (n.step && STATUS[n.step as StatusKey]?.stage === stageAt));
  const parked = [...(x.parked ?? []).filter((n) => !back.includes(n)), ...x.needs.filter((n) => n.request && later(n))];
  const kept = { ...x, parked, needs: [...x.needs.filter((n) => n.request && !later(n) && (!n.step || n.step === k || STATUS[n.step as StatusKey]?.stage === stageAt)), ...back] };
  return needsAt(k, x).reduce<Application>((y, n) => (n.action ? { ...y, needs: [...y.needs, n] } : askRp(y, { ...n, step: k }, by, at)), kept);
}

export type Upload = { key: string; name: string; file: string };

/** A new application: it goes straight to GSP when every required document is in, or waits for them. */
export function newApplication(p: {
  id: string;
  s: Student;
  c: Course;
  intake: string;
  me: string;
  uploads?: Upload[];
  /** The documents it asks for, as Add an application showed them; the course's, read for the student, otherwise. */
  asks?: AppDoc[];
}): Application {
  const now = Date.now();
  const uploads = p.uploads ?? [];
  const asks = p.asks ?? docsFor(p.s, p.c);
  const sent = (key: string) => uploads.some((u) => u.key === key);
  // a required document that's neither on the profile nor uploaded stays on the application's to-do list, to upload
  // (only documents: details missing from the profile are for the profile, as the eligibility check says)
  const needs: Need[] = asks
    .filter((d) => d.need === 'required' && !p.s.docs[d.key] && !sent(d.key))
    .map((d) => ({
      id: d.key,
      title: d.name,
      why: d.key === 'english' ? `${p.c.name} needs one before GSP can submit.` : keptOnProfile(d.key) ? `${p.c.uni.name} asks for it. It’s saved to the profile too, for the next application.` : `${p.c.uni.name} asks for it with the application.`,
    }));
  const status: StatusKey = needs.length ? 'docs' : 'checking';
  // every document of the application is verified by GSP for it, those taken from the profile too (Nesil, 28 Oct)
  const fresh = status === 'checking' ? 'checking' : 'uploaded';
  const reused = asks.filter((d) => p.s.docs[d.key] && !sent(d.key));
  const files: AppFile[] = [
    ...reused.map((d): AppFile => ({ name: d.name, file: p.s.docs[d.key].file, from: 'you', at: now, status: fresh, via: 'profile' })),
    ...uploads.map((u): AppFile => ({ name: u.name, file: u.file, from: 'you', at: now, status: fresh })),
  ];
  return {
    id: p.id,
    studentId: p.s.id,
    courseId: p.c.id,
    intake: p.intake,
    status,
    created: now,
    since: now,
    asks,
    needs,
    files,
    history: [
      { at: now, who: 'you', text: `Application started for ${fullName(p.s)}`, by: p.me },
      { at: now, who: 'ai', text: `GSP Assist took ${reused.length} ${reused.length === 1 ? 'document' : 'documents'} from ${p.s.first}’s profile${uploads.length ? ` and read ${uploads.length} new ${uploads.length === 1 ? 'one' : 'ones'}` : ''}, for GSP to verify` },
      ...(status === 'checking' ? [{ at: now, who: 'system' as const, text: 'Sent to GSP: checking documents' }] : []),
    ],
    chat: [],
  };
}

/* ---------- sample applications ---------- */

/**
 * Every application: the GSP test agency's own nine (HC13, 1 Nov: in the data set, scripts/test_agency.json; five
 * need the agency, one is with GSP, three with universities, one closed), then every other application GSP has
 * (data/dataset.ts). Each one's sales region comes from Admin's routing rules (HC27), never a default.
 */
export function sampleApplications(): Application[] {
  const studs = new Map(testAgencyStudents('').map((s) => [s.id, s]));
  const routed = (x: Application): Application => {
    if (x.region) return x;
    const s = studs.get(x.studentId);
    return { ...x, region: routeApplication({ rp: x.rp, nationality: s?.nationality ?? '', livesIn: s?.country ?? '', dest: destOf(x) }).region };
  };
  return [...testAgencyApps().map(routed), ...datasetApplications()];
}

/** The next application ID. */
export const nextId = (list: Application[]) => `GSP-${Math.max(24102, ...list.map((a) => Number(a.id.replace(/\D/g, '')) || 0)) + 1}`;
