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
import { person, label, idOf, staffById } from './staff';
import { datasetApplications } from './dataset';
import { COURSES, blockedFor, daysTo, earnOf, intakeState, money, type Course, type Destination } from './courses';
import { LEVELS as EDU_LEVELS, TESTS, eduDocKey, fullName, pctOf, testDocKey, testDocName, testSummary, type DocStatus, type Level as EduLevel, type Owner, type Student, type StudentApp } from './students';
import { shortDate } from './dates';

export const DAY = 86_400_000;
const HOUR = 3_600_000;

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

/** Who has it now. done: enrolled. end: closed early. */
export type AppOwner = Owner | 'done' | 'end';

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
  | 'interview'
  | 'uol'
  | 'rever'
  | 'deposit'
  | 'payreview'
  | 'waitad'
  | 'reacc'
  | 'visa'
  | 'visasub'
  | 'startdate'
  | 'revisa'
  | 'enrolconf'
  | 'reenrol'
  | 'enrolled'
  | 'closed';

/** The acceptance document, by destination. */
export const ENROL_DOC: Record<Destination, string> = { Australia: 'CoE', UK: 'CAS', USA: 'I-20', Canada: 'LOA', 'New Zealand': 'Offer of Place', Ireland: 'letter of acceptance' };
export const ENROL_DOC_LONG: Record<Destination, string> = {
  Australia: 'Confirmation of Enrolment (CoE)',
  UK: 'Confirmation of Acceptance for Studies (CAS)',
  USA: 'Form I-20',
  Canada: 'Letter of Acceptance (LOA)',
  'New Zealand': 'Offer of Place',
  Ireland: 'Letter of acceptance',
};
export const VISA_NAME: Record<Destination, string> = { Australia: 'student visa (subclass 500)', UK: 'Student visa', USA: 'F-1 visa', Canada: 'study permit', 'New Zealand': 'student visa', Ireland: 'study visa' };

type StatusDef = {
  stage: number;
  owner: AppOwner;
  text: (d: Destination) => string;
  /** Typical days at this step, for the steps others take. */
  usual?: number;
  /** A status only some applications go through, and when. */
  branch?: string;
  /** The document that arrives at this status, and who adds it ("lodger": whoever lodges the visa). */
  doc?: { by: 'gsp' | 'you' | 'lodger'; name: (d: Destination) => string };
  /** The agency's part here is what GSP asks for: once it's all in, it's with GSP until GSP moves it on. */
  asks?: true;
};

/**
 * The journey, stage by stage, as GSP runs it (Nesil's stage and status concept, 28 Oct 2026). Only New to
 * Pre-screening moves on its own, when the agency sends the documents; GSP's team moves every other status.
 * The university has the statuses where it's deciding.
 */
export const STATUS: Record<StatusKey, StatusDef> = {
  docs: { stage: 0, owner: 'you', text: () => 'Waiting for documents' },
  checking: { stage: 1, owner: 'gsp', text: () => 'Pending verification', usual: 0 },
  reupload: { stage: 1, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  ready: { stage: 2, owner: 'gsp', text: () => 'Ready to submit', usual: 1 },
  lodged: { stage: 2, owner: 'uni', text: () => 'Submitted to university' },
  moreinfo: { stage: 2, owner: 'you', text: () => 'Additional documents requested', branch: 'If the university asks for more', asks: true },
  addverify: { stage: 2, owner: 'gsp', text: () => 'Verifying additional documents', usual: 1, branch: 'After additional documents' },
  reapp: { stage: 2, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  conditions: { stage: 3, owner: 'you', text: () => 'Conditional offer received, conditions pending', doc: { by: 'gsp', name: () => 'Conditional offer letter' }, asks: true },
  condsent: { stage: 3, owner: 'uni', text: () => 'Conditions submitted to university', usual: 5 },
  reoffer: { stage: 3, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  finance: { stage: 4, owner: 'gsp', text: () => 'Finance and background check', usual: 2 },
  interview: { stage: 4, owner: 'you', text: () => 'University assessment or interview', usual: 7, branch: 'If the university assesses or interviews' },
  uol: { stage: 4, owner: 'gsp', text: () => 'Unconditional offer letter received', usual: 1, doc: { by: 'gsp', name: () => 'Unconditional offer letter' } },
  rever: { stage: 4, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  deposit: { stage: 5, owner: 'you', text: () => 'Tuition or deposit pending', asks: true },
  payreview: { stage: 5, owner: 'gsp', text: () => 'Payment proof under review', usual: 1, doc: { by: 'you', name: () => 'Payment proof' } },
  waitad: { stage: 5, owner: 'gsp', text: () => 'Awaiting acceptance letter from university', usual: 5, doc: { by: 'gsp', name: (d) => ENROL_DOC_LONG[d] } },
  reacc: { stage: 5, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  // the visa is lodged by the agency or by GSP, never both: these two follow whoever lodges it (see ownerAt)
  visa: { stage: 6, owner: 'you', text: () => 'Visa lodgement pending', asks: true },
  visasub: { stage: 6, owner: 'you', text: () => 'Visa decision pending', usual: 28, doc: { by: 'lodger', name: () => 'Visa lodgement proof' } },
  startdate: { stage: 6, owner: 'gsp', text: () => 'Visa granted: waiting for start date', doc: { by: 'lodger', name: () => 'Visa' } },
  revisa: { stage: 6, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  enrolconf: { stage: 7, owner: 'gsp', text: () => 'Enrolment confirmation pending', usual: 7, doc: { by: 'gsp', name: () => 'Proof of enrolment' } },
  reenrol: { stage: 7, owner: 'you', text: () => 'Document re-upload pending', branch: 'If GSP rejects a document', asks: true },
  enrolled: { stage: 7, owner: 'done', text: () => 'Student enrolled' },
  closed: { stage: 0, owner: 'end', text: () => 'Closed' },
};
/** Document re-upload pending, in each stage from Pre-screening: where GSP's rejection of a document puts the application. */
export const REUPLOAD_AT: (StatusKey | undefined)[] = [undefined, 'reupload', 'reapp', 'reoffer', 'rever', 'reacc', 'revisa', 'reenrol'];
/** The statuses in journey order (GSP's status list follows it). */
export const STATUS_ORDER = Object.keys(STATUS).filter((k) => k !== 'closed') as StatusKey[];

export const OWNER_WORD: Record<AppOwner, string> = { you: 'Pending on you', gsp: 'With GSP', uni: 'With university', done: 'Enrolled', end: 'Closed' };
/** The short tag for who has a status: in the journey and the stage path. */
export const OWNER_TAG: Record<AppOwner, string> = { you: 'You', gsp: 'GSP', uni: 'University', done: 'Done', end: 'Closed' };
/** How an application can close, by where it is. Deferred can happen at any stage once it's with the university. */
export type EndKind = 'Not eligible' | 'Student withdrawn' | 'University rejected' | 'Offer declined' | 'Refused after assessment' | 'Rejected by university' | 'Visa refused' | 'Deferred';
/** The ways an application closes at each stage (index), for GSP's status list. */
export const CLOSE_AT: EndKind[][] = [
  ['Student withdrawn'],
  ['Not eligible', 'Student withdrawn'],
  ['University rejected', 'Student withdrawn', 'Deferred'],
  ['Offer declined', 'Student withdrawn', 'Deferred'],
  ['Refused after assessment', 'Rejected by university', 'Student withdrawn', 'Deferred'],
  ['Student withdrawn', 'Deferred'],
  ['Visa refused', 'Student withdrawn', 'Deferred'],
  ['Deferred'],
];

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
export type AppFile = { name: string; file: string; from: 'you' | 'gsp' | 'uni'; at: number; status: 'uploaded' | 'checking' | 'verified'; via?: 'chat' | 'request' | 'profile'; /** The request it answered. */ req?: string };

export type Who = 'you' | 'gsp' | 'uni' | 'ai' | 'system';
export type Event = { at: number; who: Who; text: string; by?: string };
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
  end?: { kind: EndKind; reason: string; stage: number; at: number };
  /** GSP chased the university about a late decision. */
  chased?: number;
  /** Unread chat messages for the agency. */
  unread?: number;
  /** Who lodges the visa: the agency (the default) or GSP, when the agency asks. */
  visaBy?: 'you' | 'gsp';
};

export const courseOf = (a: Pick<Application, 'courseId'>) => COURSES.find((c) => c.id === a.courseId)!;
export const destOf = (a: Pick<Application, 'courseId'>) => courseOf(a).uni.country;
export const stageOf = (a: Application) => (a.status === 'closed' ? a.end?.stage ?? 0 : STATUS[a.status].stage);
export const openRequests = (a: Application) => a.needs.filter((n) => n.request);
/** Who has a status on this application: the visa steps belong to whoever lodges the visa. */
export const ownerAt = (k: StatusKey, a: Pick<Application, 'visaBy'>): AppOwner => (k === 'visa' || k === 'visasub' ? a.visaBy ?? 'you' : STATUS[k].owner);
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
  if (!isOpen(a)) return ownerAt(a.status, a);
  if (openRequests(a).length) return 'you';
  if (toCheck(a).length) return 'gsp';
  const o = ownerAt(a.status, a);
  return o === 'you' && STATUS[a.status].asks && !a.needs.length ? 'gsp' : o;
}
/** Needs the agency: its own statuses, or a document GSP asked for. */
export const needsYou = (a: Application) => isOpen(a) && ownerOf(a) === 'you';
export const statusText = (a: Application) => (a.status === 'closed' ? `${a.end?.kind ?? 'Closed'}: ${a.end?.reason ?? ''}`.replace(/: $/, '') : STATUS[a.status].text(destOf(a)));
export const isOpen = (a: Application) => a.status !== 'closed' && a.status !== 'enrolled';

/**
 * The GSP admissions contact on an application, from the staff list (data/staff.ts). The sample agency is in India,
 * so it's India's Admissions contact, Ramish Jafery; UK and Ireland applications go to Prachi Pilani, on the same
 * India team. The staff list has no phone numbers, so none shows.
 */
const CONTACT_OF = { main: person('ramish.jafery@upgrad.com'), ukie: person('prachi.pilani@upgrad.com') };
export function gspContact(d: Destination, officer?: string) {
  const s = (officer && staffById(officer)) || (d === 'UK' || d === 'Ireland' ? CONTACT_OF.ukie : CONTACT_OF.main);
  return { name: label(s), role: 'GSP admissions', phone: '', email: s.email, first: s.first };
}

const usualOf = (k: StatusKey, c: Course) => (k === 'lodged' ? c.offerDays : STATUS[k].usual);

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
};

const PG_LEVELS: string[] = ['Master’s degree', 'Postgraduate diploma', 'PhD or research'];
export const isPgCourse = (c: Pick<Course, 'level'>) => PG_LEVELS.includes(c.level);
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
  [/^Work experience/, 'Work experience letters', 'Two years or more: a letter from each employer, with dates and role'],
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
export function docsFor(s: Student, c: Course): AppDoc[] {
  const pg = isPgCourse(c);
  // the student has studied to this level: their highest education is at or above it, or its marksheet is on the profile
  const holds = (l: EduLevel) => EDU_LEVELS.indexOf(s.highest) <= EDU_LEVELS.indexOf(l) || !!s.docs[eduDocKey(l)];
  const out: AppDoc[] = [];
  for (const [name, need, when] of c.docs) {
    if (/^Passport/.test(name)) out.push({ key: 'passport', name: 'Passport', what: 'The photo page and the address page', need: 'required' });
    else if (/transcripts|mark sheets/.test(name)) {
      out.push(markDoc('g10', 'required'));
      if (c.level !== 'Foundation') out.push(markDoc('g12', 'required'));
      else if (holds('g12')) out.push(markDoc('g12', 'optional'));
      if (pg) out.push(markDoc('ug', 'required'));
      else if (holds('ug')) out.push(markDoc('ug', 'optional'));
      if (c.level === 'PhD or research') out.push(markDoc('pg', 'required'));
      else if (pg && holds('pg')) out.push(markDoc('pg', 'optional'));
    } else if (/^English test/.test(name)) {
      const t = s.tests.find((x) => TESTS[x.type].kind === 'English' && x.overall);
      if (t) out.push({ key: testDocKey(t), name: testDocName(t), what: `${testSummary(t)}, from ${s.first}’s profile`, need: 'required' });
      else
        out.push({
          key: 'english',
          name: 'English test score report',
          what: c.englishFlex ? `${c.uni.name} can take it later; GSP asks for it before the offer is final` : `${c.name} needs one before GSP can submit`,
          need: c.englishFlex ? 'optional' : 'required',
        });
    } else if (when === 'With the application') {
      const own = OWN.find(([re]) => re.test(name));
      out.push({ key: profileKeyFor(name) ?? name.toLowerCase().replace(/[^a-z]+/g, '-'), name: own?.[1] ?? name, what: own?.[2] ?? `${c.uni.name} asks for it with the application`, need: need === 'Required' ? 'required' : 'optional' });
    }
  }
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

export type Verdict = 'Eligible' | 'Eligible with conditions' | 'Not eligible' | 'Add details to check';
export type Reason = { ok: 'yes' | 'warn' | 'no' | 'add'; title: string; text: string };

/** Checks a student against a course intake, with the reason for each part of the verdict. */
export function checkFit(s: Student, c: Course, intake: string): { verdict: Verdict; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const uni = c.uni.name;
  const so = (ok: boolean) => `so ${s.first} ${ok ? 'is eligible' : 'isn’t eligible'}`;
  // where the student lives: the country says it (a state only where a university turns that state down)
  if (blockedFor(c.uni, s.country, s.state))
    reasons.push({ ok: 'no', title: 'Where they live', text: `${uni} doesn’t take students from ${s.state ? `${s.state}, ` : ''}${s.country} through GSP.` });
  else reasons.push({ ok: 'yes', title: 'Where they live', text: `${uni} takes students from ${s.country}.` });
  // academics: what the university asks for against what the student has, or the profile to complete first
  const top = s.edu[s.highest];
  const pct = top ? pctOf(top) : null;
  if (pct === null) reasons.push({ ok: 'add', title: 'Academics', text: `Complete the academic details on ${s.first}’s profile to check eligibility.` });
  else reasons.push({ ok: pct >= c.academic ? 'yes' : 'no', title: 'Academics', text: `${uni} asks for ${c.academic}% and ${s.first} has ${pct}%, ${so(pct >= c.academic)}.` });
  // English: the same, from the test on the profile
  const ielts = s.tests.find((t) => t.type === 'IELTS' && t.overall);
  const pte = s.tests.find((t) => t.type === 'PTE' && t.overall);
  if (ielts || pte) {
    const t = (ielts ?? pte)!;
    const [need, band] = t.type === 'IELTS' ? c.ielts : c.pte;
    const parts = Object.values(t.parts).map(Number).filter((n) => !Number.isNaN(n));
    const low = parts.length ? Math.min(...parts) : Number(t.overall);
    const fmt = (n: number) => (t.type === 'IELTS' ? n.toFixed(1) : String(n));
    const meets = Number(t.overall) >= need && low >= band;
    const said = `${uni} asks for ${t.type} ${fmt(need)} (no band below ${fmt(band)}) and ${s.first} has ${t.type} ${fmt(Number(t.overall))} (lowest band ${fmt(low)})`;
    if (meets) reasons.push({ ok: 'yes', title: 'English', text: `${said}, ${so(true)}.` });
    else if (c.englishFlex) reasons.push({ ok: 'warn', title: 'English', text: `${said}, so ${s.first} isn’t eligible yet: the university can offer on condition of a pre-sessional English course.` });
    else reasons.push({ ok: 'no', title: 'English', text: `${said}, ${so(false)}.` });
  } else reasons.push({ ok: 'add', title: 'English', text: `Complete the English test details on ${s.first}’s profile to check eligibility.` });
  // intake
  const i = c.intakes.find((x) => x.month === intake);
  if (i) {
    const st = intakeState(i);
    const d = daysTo(i.deadline);
    if (st === 'closed') reasons.push({ ok: 'no', title: 'Intake', text: `${intake} closed on ${shortDate(new Date(i.deadline))}.` });
    else if (st === 'likely') reasons.push({ ok: 'warn', title: 'Intake', text: `${intake} usually opens; the university hasn’t confirmed it yet.` });
    else reasons.push({ ok: d <= 21 ? 'warn' : 'yes', title: 'Intake', text: `${intake} is open, closes ${shortDate(new Date(i.deadline))}${d <= 45 ? `: ${d} ${d === 1 ? 'day' : 'days'} left` : ''}.` });
  }
  const verdict: Verdict = reasons.some((r) => r.ok === 'no') ? 'Not eligible' : reasons.some((r) => r.ok === 'add') ? 'Add details to check' : reasons.some((r) => r.ok === 'warn') ? 'Eligible with conditions' : 'Eligible';
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
  if (/blur|dark|photo_?\d|whatsapp/i.test(file)) return { ok: false, note: 'Part of the page is too blurred to read. A scan or a sharp photo of the whole page works best.' };
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
  if (/blur|dark|unclear|photo_?\d|whatsapp/i.test(file)) return { ok: false, issue: 'unclear', note: 'The attached document is not clear.' };
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
export function intakeStart(intake: string) {
  const [m, y] = intake.split(' ');
  return new Date(Number(y), MONTHS.indexOf(m), 22).getTime();
}


/** What the agency earns on the application, once the student enrols and the census date passes. */
export const earnFor = (a: Application) => {
  const c = courseOf(a);
  return { amount: earnOf(c), currency: c.currency, text: money(earnOf(c), c.currency) };
};

/* ---------- moving an application on ---------- */

/** The one move that happens on its own: the agency sends the documents and the application goes to GSP's pre-screening. GSP's team moves every other. */
export const NEXT_AFTER_YOU: Partial<Record<StatusKey, StatusKey>> = { docs: 'checking' };

/** What the agency has to do at a status it arrives at: documents (which GSP asks for in the chat) or something to confirm. */
export function needsAt(k: StatusKey, a: Application): Need[] {
  const c = courseOf(a);
  if (k === 'deposit')
    return [{ id: 'payment-proof', title: 'Payment proof', why: `Pay ${money(a.offer?.deposit ?? c.deposit, c.currency)} (tuition or deposit) to ${c.uni.name}, then upload the receipt.` }];
  if (k === 'visa' && a.visaBy !== 'gsp') return [{ id: 'visa', title: 'Visa lodgement proof', why: `Lodge the ${VISA_NAME[c.uni.country]}, then upload the lodgement receipt here.` }];
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
export function arriveAt(x: Application, k: StatusKey, at: number, by = gspContact(destOf(x)).name): Application {
  const kept = { ...x, needs: x.needs.filter((n) => n.request && (!n.step || n.step === k)) };
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

const m = (id: string, at: number, from: Msg['from'], name: string, text: string, more: Partial<Msg> = {}): Msg => ({ id, at, from, name, text, ...more });
const f = (name: string, file: string, from: AppFile['from'], at: number, status: AppFile['status'] = 'verified', via?: AppFile['via']): AppFile => ({ name, file, from, at, status, via });

/** The sample agency's applications, for its sample students: five need the agency, one is with GSP, three with universities, one closed. */
export function sampleApplications(): Application[] {
  const now = Date.now();
  const ago = (d: number, h = 0) => now - d * DAY - h * HOUR;
  const offerAt = ago(1, 3);
  const own: Application[] = [
    {
      id: 'GSP-24102',
      studentId: 'S-24811',
      courseId: 'deakin-5',
      intake: 'Feb 2027',
      status: 'conditions',
      created: ago(16),
      since: offerAt,
      uniRef: 'DKN-2611407',
      offer: {
        kind: 'conditional',
        file: 'Deakin_conditional_offer_Priya_Raman.pdf',
        at: offerAt,
        acceptBy: now + 19 * DAY,
        deposit: 9000,
        found: 'chat',
        conditions: [
          { id: 'c1', text: 'Final semester transcript, showing the degree is complete', doc: 'Final semester transcript', source: 'Offer letter, page 2, condition 1' },
          { id: 'c2', text: 'Bank statements for the last 6 months, showing at least AUD 67,510', doc: 'Bank statements (6 months)', source: 'Offer letter, page 2, condition 2' },
        ],
      },
      needs: [
        {
          id: 'conds',
          title: 'Offer conditions',
          why: 'Deakin’s conditional offer has 3 conditions. Answer them all, then send them to GSP.',
          source: 'Conditional offer letter, page 2',
          due: now + 19 * DAY,
          request: { by: gspContact('Australia').name, at: offerAt + 60_000 },
          step: 'conditions',
          form: [
            { id: 'c1', kind: 'question', text: 'Will Priya accept the offer and start in February 2027?', source: 'Condition 1' },
            { id: 'c2', kind: 'question', text: 'Why has Priya chosen Deakin and this course over similar courses in India? (Genuine Student statement, 100 to 300 words)', source: 'Condition 2' },
            { id: 'c3', kind: 'question', text: 'Has Priya been refused a visa for any country before? If so, when and why?', source: 'Condition 3' },
          ],
        },
      ],
      files: [f('10th marksheet', 'priya_10th_marksheet.pdf', 'you', ago(16), 'verified'), f('Statement of purpose', 'priya_sop_deakin.pdf', 'you', ago(16)), f('CV', 'priya_raman_cv.pdf', 'you', ago(16)), f('Conditional offer letter', 'Deakin_conditional_offer_Priya_Raman.pdf', 'gsp', offerAt, 'verified', 'chat')],
      history: [
        { at: ago(16), who: 'you', text: 'Application started for Priya Raman', by: 'Karthik Nair' },
        { at: ago(16), who: 'ai', text: 'GSP Assist reused 4 documents from Priya’s profile and read 1 new one' },
        { at: ago(16, -1), who: 'gsp', text: 'GSP checked the documents: all clear', by: gspContact('Australia').name },
        { at: ago(15), who: 'gsp', text: 'Submitted to Deakin University. Reference DKN-2611407', by: gspContact('Australia').name },
        { at: offerAt, who: 'gsp', text: 'GSP uploaded the conditional offer letter, in the chat', by: gspContact('Australia').name },
        { at: offerAt, who: 'ai', text: `GSP Assist found the offer letter in the chat and read it: 2 conditions, accept by ${shortDate(new Date(now + 19 * DAY))}` },
        { at: offerAt + 60_000, who: 'gsp', text: 'Sent the offer’s 3 conditions to answer', by: gspContact('Australia').name },
      ],
      chat: [
        m('m1', ago(15), 'gsp', gspContact('Australia').name, 'Submitted to Deakin today. Their reference is DKN-2611407. Offers for this course usually take about 6 days.'),
        m('m2', offerAt, 'gsp', gspContact('Australia').name, 'Good news: Deakin has made Priya a conditional offer. The letter is attached.', { files: ['Deakin_conditional_offer_Priya_Raman.pdf'] }),
        m('m3', offerAt + 60_000, 'gsp', gspContact('Australia').name, 'The offer has 3 conditions. Answer them in the form by the date and send it; I’ll pass them to Deakin.', { request: 'conds', requestName: 'Offer conditions' }),
      ],
      unread: 2,
    },
    {
      id: 'GSP-24097',
      studentId: 'S-24811',
      courseId: 'uow-13',
      intake: 'Feb 2027',
      status: 'lodged',
      created: ago(14),
      since: ago(9, 2),
      uniRef: 'UOW-5508812',
      needs: [],
      files: [f('10th marksheet', 'priya_10th_marksheet.pdf', 'you', ago(14), 'verified'), f('Statement of purpose', 'priya_sop_wollongong.pdf', 'you', ago(14)), f('CV', 'priya_raman_cv.pdf', 'you', ago(14))],
      chased: ago(0, 4),
      history: [
        { at: ago(14), who: 'you', text: 'Application started for Priya Raman', by: 'Karthik Nair' },
        { at: ago(14), who: 'ai', text: 'GSP Assist reused 4 documents from Priya’s profile and read 1 new one' },
        { at: ago(13), who: 'gsp', text: 'GSP checked the documents: all clear', by: gspContact('Australia').name },
        { at: ago(9, 2), who: 'gsp', text: 'Submitted to University of Wollongong. Reference UOW-5508812', by: gspContact('Australia').name },
        { at: ago(0, 4), who: 'gsp', text: 'Reminded Wollongong about the decision', by: gspContact('Australia').name },
      ],
      chat: [m('m1', ago(0, 4), 'gsp', gspContact('Australia').name, 'Wollongong is taking a little longer than usual this month. I reminded them today and will again on Wednesday.')],
    },
    {
      id: 'GSP-24055',
      studentId: 'S-24807',
      courseId: 'flinders-3',
      intake: 'Feb 2027',
      status: 'checking',
      created: ago(0, 1),
      since: ago(0, 0.6),
      needs: [
        {
          id: 'req-gap',
          title: 'Gap explanation document',
          why: 'Sneha finished her B.Com in 2022. Flinders asks for a short signed letter on what she has done since.',
          request: { by: gspContact('Australia').name, at: ago(0, 0.3) },
          due: now + 3 * DAY,
        },
      ],
      files: [
        f('Passport', 'sneha_passport.jpg', 'you', ago(0, 1), 'checking', 'profile'),
        f('UG marksheet', 'sneha_bcom_marks.pdf', 'you', ago(0, 1), 'checking', 'profile'),
        f('PTE Academic score report', 'sneha_pte.pdf', 'you', ago(0, 1), 'checking', 'profile'),
        f('10th marksheet', 'sneha_sslc_marksheet.pdf', 'you', ago(0, 1), 'checking'),
        f('12th marksheet', 'sneha_hsc_marksheet.pdf', 'you', ago(0, 1), 'checking'),
        f('Statement of purpose', 'sneha_sop_flinders.pdf', 'you', ago(0, 1), 'checking'),
        f('CV', 'sneha_patil_cv.pdf', 'you', ago(0, 1), 'checking'),
      ],
      history: [
        { at: ago(0, 1), who: 'you', text: 'Application started for Sneha Patil', by: 'You' },
        { at: ago(0, 1), who: 'ai', text: 'GSP Assist reused 3 documents from Sneha’s profile and read 2 new ones' },
        { at: ago(0, 0.6), who: 'system', text: 'Sent to GSP: checking documents' },
        { at: ago(0, 0.3), who: 'gsp', text: 'GSP asked for a gap explanation', by: gspContact('Australia').name },
      ],
      chat: [m('m1', ago(0, 0.3), 'gsp', gspContact('Australia').name, 'Before I submit to Flinders, could you upload a short gap explanation from Sneha? Everything else looks good.', { request: 'req-gap', requestName: 'Gap explanation document' })],
      unread: 1,
    },
    {
      id: 'GSP-24061',
      studentId: 'S-24807',
      courseId: 'newcastle-3',
      intake: 'Feb 2027',
      status: 'reupload',
      created: ago(5),
      since: ago(1, 5),
      needs: [
        {
          id: 'edu-ug',
          title: 'Undergraduate transcript and degree certificate',
          why: 'GSP: pages 3 and 4 of the transcript are missing. Upload all 4 pages as one file.',
          source: 'GSP check, ' + shortDate(new Date(ago(1, 5))),
          request: { by: gspContact('Australia').name, at: ago(1, 5) },
          step: 'reupload',
        },
      ],
      files: [f('10th marksheet', 'sneha_sslc_marksheet.pdf', 'you', ago(5), 'verified'), f('12th marksheet', 'sneha_hsc_marksheet.pdf', 'you', ago(5), 'verified'), f('Statement of purpose', 'sneha_sop_newcastle.pdf', 'you', ago(5)), f('CV', 'sneha_patil_cv.pdf', 'you', ago(5))],
      history: [
        { at: ago(5), who: 'you', text: 'Application started for Sneha Patil', by: 'You' },
        { at: ago(5), who: 'ai', text: 'GSP Assist reused 3 documents from Sneha’s profile and read 2 new ones' },
        { at: ago(1, 5), who: 'gsp', text: 'Sent back the undergraduate transcript: pages 3 and 4 missing', by: gspContact('Australia').name },
      ],
      chat: [m('m1', ago(1, 5), 'gsp', gspContact('Australia').name, 'The transcript only has pages 1 and 2. Could you upload all four pages in one file? Everything else is fine.', { request: 'edu-ug', requestName: 'Undergraduate transcript and degree certificate' })],
      unread: 1,
    },
    {
      id: 'GSP-24063',
      studentId: 'S-24807',
      courseId: 'coventry-3',
      intake: 'Jan 2027',
      status: 'waitad',
      created: ago(31),
      since: ago(3, 2),
      uniRef: 'COV-1189034',
      needs: [],
      funds: 31800,
      files: [f('10th marksheet', 'sneha_sslc_marksheet.pdf', 'you', ago(31), 'verified'), f('12th marksheet', 'sneha_hsc_marksheet.pdf', 'you', ago(31), 'verified'), 
        f('Statement of purpose', 'sneha_sop_coventry.pdf', 'you', ago(31)),
        f('CV', 'sneha_patil_cv.pdf', 'you', ago(31)),
        f('Unconditional offer letter', 'Coventry_offer_Sneha_Patil.pdf', 'gsp', ago(22)),
        f('Deposit proof', 'sneha_coventry_deposit.pdf', 'you', ago(4)),
      ],
      history: [
        { at: ago(31), who: 'you', text: 'Application started for Sneha Patil', by: 'You' },
        { at: ago(30), who: 'gsp', text: 'Submitted to Coventry University. Reference COV-1189034', by: gspContact('UK').name },
        { at: ago(27), who: 'gsp', text: 'Verified the financial documents: GBP 31,800', by: gspContact('UK').name },
        { at: ago(22), who: 'gsp', text: 'GSP uploaded the unconditional offer letter', by: gspContact('UK').name },
        { at: ago(4), who: 'you', text: 'Deposit proof uploaded: GBP 3,000', by: 'You' },
        { at: ago(3, 2), who: 'gsp', text: 'Deposit confirmed with Coventry', by: gspContact('UK').name },
      ],
      chat: [m('m1', ago(3, 2), 'gsp', gspContact('UK').name, 'Coventry confirmed the deposit. The CAS usually follows within 5 working days.')],
    },
    {
      id: 'GSP-23941',
      studentId: 'S-24796',
      courseId: 'coventry-60',
      intake: 'Jan 2027',
      status: 'lodged',
      created: ago(12),
      since: ago(4, 3),
      uniRef: 'COV-1201877',
      needs: [],
      files: [f('10th marksheet', 'rohan_10th_marksheet.pdf', 'you', ago(12), 'verified'), f('12th marksheet', 'rohan_12th_marksheet.pdf', 'you', ago(12), 'verified'), f('Statement of purpose', 'rohan_sop_coventry.pdf', 'you', ago(12)), f('CV', 'rohan_gupta_cv.pdf', 'you', ago(12))],
      history: [
        { at: ago(12), who: 'you', text: 'Application started for Rohan Gupta', by: 'Divya Shetty' },
        { at: ago(11), who: 'gsp', text: 'GSP checked the documents: all clear', by: gspContact('UK').name },
        { at: ago(4, 3), who: 'gsp', text: 'Submitted to Coventry University. Reference COV-1201877', by: gspContact('UK').name },
        { at: ago(4), who: 'uni', text: 'Coventry acknowledged the application, by email. Placed in the chat automatically' },
      ],
      chat: [m('m1', ago(4), 'uni', 'Coventry University Admissions', 'Thank you for your application to MSc Cyber Security (January 2027). Your reference is COV-1201877. We aim to make a decision within 10 working days.', { via: 'email' })],
    },
    {
      id: 'GSP-23944',
      studentId: 'S-24796',
      courseId: 'northumbria-55',
      intake: 'Jan 2027',
      status: 'checking',
      created: ago(0, 3),
      since: ago(0, 1),
      needs: [],
      files: [
        f('Passport', 'rohan_passport.pdf', 'you', ago(0, 3), 'checking', 'profile'),
        f('UG marksheet', 'rohan_bca.pdf', 'you', ago(0, 3), 'checking', 'profile'),
        f('IELTS Academic score report', 'rohan_trf.pdf', 'you', ago(0, 3), 'checking', 'profile'),
        f('10th marksheet', 'rohan_10th_marksheet.pdf', 'you', ago(0, 3), 'checking'),
        f('12th marksheet', 'rohan_12th_marksheet.pdf', 'you', ago(0, 3), 'checking'),
        f('Statement of purpose', 'rohan_sop_northumbria.pdf', 'you', ago(0, 3), 'uploaded'),
        f('CV', 'rohan_gupta_cv.pdf', 'you', ago(0, 3), 'uploaded'),
      ],
      history: [
        { at: ago(0, 3), who: 'you', text: 'Application started for Rohan Gupta', by: 'Divya Shetty' },
        { at: ago(0, 1), who: 'system', text: 'Sent to GSP: checking documents' },
      ],
      chat: [],
    },
    {
      id: 'GSP-23710',
      studentId: 'S-24781',
      courseId: 'rmit-10',
      intake: 'Feb 2027',
      status: 'visa',
      created: ago(46),
      since: ago(2, 6),
      uniRef: 'RMIT-77120554',
      funds: 92400,
      needs: [{ id: 'visa', title: 'Visa lodgement proof', why: 'Lodge the student visa (subclass 500) in ImmiAccount, then upload the lodgement receipt here.', due: now + 12 * DAY, request: { by: gspContact('Australia').name, at: ago(2, 5) }, step: 'visa' }],
      files: [f('10th marksheet', 'fatima_10th_marksheet.pdf', 'you', ago(46), 'verified'), f('12th marksheet', 'fatima_12th_marksheet.pdf', 'you', ago(46), 'verified'), f('UG marksheet', 'fatima_btech_marksheets.pdf', 'you', ago(46), 'verified'), 
        f('Statement of purpose', 'fatima_sop_rmit.pdf', 'you', ago(46)),
        f('CV', 'fatima_sheikh_cv.pdf', 'you', ago(46)),
        f('Conditional offer letter', 'RMIT_conditional_offer_Fatima_Sheikh.pdf', 'gsp', ago(33)),
        f('Unconditional offer letter', 'RMIT_offer_Fatima_Sheikh.pdf', 'gsp', ago(20)),
        f('Deposit proof', 'fatima_rmit_deposit.pdf', 'you', ago(9)),
        f('Confirmation of Enrolment (CoE)', 'CoE_Fatima_Sheikh.pdf', 'gsp', ago(2, 6)),
      ],
      history: [
        { at: ago(46), who: 'you', text: 'Application started for Fatima Sheikh', by: 'Divya Shetty' },
        { at: ago(44), who: 'gsp', text: 'Submitted to RMIT University. Reference RMIT-77120554', by: gspContact('Australia').name },
        { at: ago(33), who: 'gsp', text: 'GSP uploaded the conditional offer letter', by: gspContact('Australia').name },
        { at: ago(27), who: 'gsp', text: 'Verified the financial documents: AUD 92,400', by: gspContact('Australia').name },
        { at: ago(20), who: 'gsp', text: 'GSP uploaded the unconditional offer letter', by: gspContact('Australia').name },
        { at: ago(9), who: 'you', text: 'Deposit proof uploaded: AUD 11,000', by: 'Divya Shetty' },
        { at: ago(2, 6), who: 'gsp', text: 'GSP uploaded the CoE', by: gspContact('Australia').name },
        { at: ago(2, 5), who: 'gsp', text: 'Asked for the visa lodgement proof', by: gspContact('Australia').name },
      ],
      chat: [m('m1', ago(2, 6), 'gsp', gspContact('Australia').name, 'Fatima’s CoE is here (in Documents). She can lodge the visa now; lodging in the next 2 weeks keeps her well ahead of February. I can lodge it with you if you’d like.', { files: ['CoE_Fatima_Sheikh.pdf'] }),
        m('m2', ago(2, 5), 'gsp', gspContact('Australia').name, '', { request: 'visa', requestName: 'Visa lodgement proof' }),
      ],
      unread: 1,
    },
    {
      id: 'GSP-23655',
      studentId: 'S-24781',
      courseId: 'deakin-14',
      intake: 'Feb 2027',
      status: 'closed',
      created: ago(58),
      since: ago(20),
      uniRef: 'DKN-2580031',
      needs: [],
      files: [f('10th marksheet', 'fatima_10th_marksheet.pdf', 'you', ago(58), 'verified'), f('12th marksheet', 'fatima_12th_marksheet.pdf', 'you', ago(58), 'verified'), f('UG marksheet', 'fatima_btech_marksheets.pdf', 'you', ago(58), 'verified'), f('Statement of purpose', 'fatima_sop_deakin.pdf', 'you', ago(58)), f('CV', 'fatima_sheikh_cv.pdf', 'you', ago(58))],
      end: { kind: 'Student withdrawn', reason: 'Fatima chose RMIT', stage: 2, at: ago(20) },
      history: [
        { at: ago(58), who: 'you', text: 'Application started for Fatima Sheikh', by: 'Divya Shetty' },
        { at: ago(55), who: 'gsp', text: 'Submitted to Deakin University. Reference DKN-2580031', by: gspContact('Australia').name },
        { at: ago(20), who: 'you', text: 'Withdrawn: Fatima chose RMIT', by: 'Divya Shetty' },
      ],
      chat: [],
    },
  ];
  // the sample agency's own (above), then every other application GSP has (data/dataset.ts)
  return [...own.map((x) => ({ ...x, region: x.region ?? 'India', officer: x.officer ?? idOf(gspContact(destOf(x)).email) })), ...datasetApplications()];
}

/** The next application ID. */
export const nextId = (list: Application[]) => `GSP-${Math.max(24102, ...list.map((a) => Number(a.id.replace(/\D/g, '')) || 0)) + 1}`;
