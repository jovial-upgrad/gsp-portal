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
import { COURSES, money, type Course, type Destination } from './courses';
import { ENROL_DOC_LONG, VISA_NAME, docsFor, type AppFile, type Application, type Event, type Msg, type Need, type StatusKey } from './applications';
import { eduDocKey, eduDocName, type Edu, type Level, type Student } from './students';
import { labelOfId, staffById } from './staff';

const DAY = 86_400_000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type DataApp = (typeof DATASET.apps)[number];
/** One person on an RP's team (W21, 1 Nov): the RP's Profile and GSP's RP contact both read these. */
export type DataRpPerson = { name: string; email: string; dial: string; phone: string; role: 'RP Admin' | 'Counsellor' };
export type DataRp = { id: string; name: string; region: string; terms: boolean; city?: string; state?: string; since?: string; team?: DataRpPerson[] };

/** Every RP an application in the data set is with: Finance's id, name and sales region, its city, since when, its team. */
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

/* ---------- the students' profiles (W29, 1 Nov): filled in, as an application past pre-screening needs ---------- */

/** A stable number from a string. */
const hash = (x: string) => [...x].reduce((t, ch) => (t * 31 + ch.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(xs: T[], key: string) => xs[hash(key) % xs.length];
/** Where students of each nationality live and study (sample): state, city, a university and a school board. */
const HOME: Record<string, { state: string; city: string; uni: string; board: string; g12: string }[]> = {
  India: [
    { state: 'Karnataka', city: 'Mysuru', uni: 'University of Mysore', board: 'Karnataka School Examination and Assessment Board', g12: 'PUC, Science' },
    { state: 'Kerala', city: 'Kochi', uni: 'Mahatma Gandhi University', board: 'Kerala Board of Higher Secondary Education', g12: 'Higher Secondary, Commerce' },
    { state: 'Maharashtra', city: 'Pune', uni: 'Savitribai Phule Pune University', board: 'Maharashtra State Board', g12: 'HSC, Science' },
    { state: 'Gujarat', city: 'Ahmedabad', uni: 'Gujarat University', board: 'Gujarat Secondary and Higher Secondary Education Board', g12: 'HSC, Commerce' },
    { state: 'Punjab', city: 'Amritsar', uni: 'Guru Nanak Dev University', board: 'Punjab School Education Board', g12: 'Senior Secondary, Science' },
    { state: 'Telangana', city: 'Warangal', uni: 'Kakatiya University', board: 'Telangana State Board of Intermediate Education', g12: 'Intermediate, MPC' },
    { state: 'Tamil Nadu', city: 'Coimbatore', uni: 'Bharathiar University', board: 'Tamil Nadu State Board', g12: 'Higher Secondary, Science' },
  ],
  Bangladesh: [{ state: 'Dhaka Division', city: 'Dhaka', uni: 'University of Dhaka', board: 'Board of Intermediate and Secondary Education, Dhaka', g12: 'HSC, Science' }],
  Nepal: [{ state: 'Bagmati Zone', city: 'Kathmandu', uni: 'Tribhuvan University', board: 'National Examinations Board', g12: 'Grade 12, Management' }],
  'Sri Lanka': [{ state: 'Western Province', city: 'Colombo', uni: 'University of Colombo', board: 'Department of Examinations', g12: 'GCE Advanced Level' }],
  Pakistan: [{ state: 'Punjab', city: 'Lahore', uni: 'University of the Punjab', board: 'BISE Lahore', g12: 'HSSC, Pre-engineering' }],
  Vietnam: [{ state: 'Hà Nội', city: 'Hanoi', uni: 'Vietnam National University, Hanoi', board: 'Ministry of Education and Training', g12: 'Upper secondary diploma' }],
  Philippines: [{ state: 'Metro Manila', city: 'Manila', uni: 'University of Santo Tomas', board: 'Department of Education', g12: 'Senior High School, STEM' }],
  Indonesia: [{ state: 'DKI Jakarta', city: 'Jakarta', uni: 'Universitas Indonesia', board: 'Ministry of Education', g12: 'SMA, Science' }],
  Nigeria: [{ state: 'Lagos', city: 'Lagos', uni: 'University of Lagos', board: 'West African Examinations Council', g12: 'WASSCE' }],
  Colombia: [{ state: 'Bogotá D.C.', city: 'Bogotá', uni: 'Universidad Nacional de Colombia', board: 'ICFES', g12: 'Bachillerato' }],
  Myanmar: [{ state: 'Yangon Region', city: 'Yangon', uni: 'University of Yangon', board: 'Myanmar Examination Board', g12: 'Matriculation' }],
};
const levelOfCourse = (lv: string): Level => (lv === 'Bachelor’s degree' || lv === 'Diploma' || lv === 'Foundation' ? 'g12' : lv === 'PhD or research' ? 'pg' : 'ug');
const slugOf = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

type DataStudent = (typeof DATASET.students)[number];
function profileOf(s: DataStudent, a: DataApp, me: string): Student {
  const dest = courseFor(a).uni.country as Destination;
  const highest = levelOfCourse(a.level);
  const where = pick(HOME[s.nationality] ?? HOME.India, s.id);
  // the year the student's highest education ended, from the intake: a gap of a year or so
  const yIntake = Number(intakeOf(a).split(' ')[1]) || 2027;
  const endY = yIntake - 1 - (hash(s.id + 'g') % 2);
  const dobY = endY - (highest === 'g12' ? 18 : highest === 'ug' ? 22 : 24);
  const e = (p: Partial<Edu>): Edu => ({ country: s.nationality, state: where.state, level: '', institution: '', qualification: '', grading: '100', score: '', language: 'English', backlogs: '', start: '', end: '', ...p });
  const sc = (lo: number, k: string) => String(lo + (hash(s.id + k) % 20));
  const edu: Partial<Record<Level, Edu>> = {};
  if (highest === 'pg') edu.pg = e({ level: 'Master’s degree', institution: where.uni, qualification: 'Master’s, Business Studies', score: sc(62, 'pg'), backlogs: '0', start: `08/${endY - 2}`, end: `06/${endY}` });
  if (highest === 'pg' || highest === 'ug') {
    const ue = highest === 'pg' ? endY - 2 : endY;
    edu.ug = e({ level: 'Bachelor’s degree', institution: where.uni, qualification: /Engineer|Data|Comput|IT|Cyber|Information/i.test(a.course) ? 'Bachelor of Technology' : /Nurs|Health/i.test(a.course) ? 'Bachelor of Science' : 'Bachelor of Commerce', score: sc(60, 'ug'), backlogs: String(hash(s.id + 'b') % 3 === 0 ? 1 : 0), start: `08/${ue - 4}`, end: `06/${ue}` });
  }
  const g12End = highest === 'g12' ? endY : (highest === 'ug' ? endY : endY - 2) - 4;
  edu.g12 = e({ level: 'Grade 12 (higher secondary)', institution: where.board, qualification: where.g12, score: sc(68, 'g12'), start: `06/${g12End - 2}`, end: `03/${g12End}` });
  edu.g10 = e({ level: 'Grade 10 (secondary)', institution: where.board, qualification: 'Secondary School Certificate', score: sc(72, 'g10'), start: `06/${g12End - 3}`, end: `03/${g12End - 2}` });
  const first = s.first.toLowerCase();
  const ielts = 6 + (hash(s.id + 'i') % 3) * 0.5;
  const band = (k: string) => (ielts - (hash(s.id + k) % 2) * 0.5).toFixed(1);
  const tests = [{ id: 't1', type: 'IELTS' as const, cert: `${String(endY).slice(2)}${s.nationality.slice(0, 2).toUpperCase()}${String(hash(s.id) % 900000).padStart(6, '0')}A`, date: `14/0${1 + (hash(s.id + 'd') % 8)}/${yIntake - 1}`, overall: ielts.toFixed(1), parts: { l: band('l'), r: band('r'), w: band('w'), s: band('s') } }];
  const docs: Student['docs'] = {
    passport: { name: 'Passport', file: `${first}_passport.pdf`, status: 'verified' },
    'test-t1': { name: 'IELTS Academic score report', file: `${first}_ielts_trf.pdf`, status: 'verified' },
  };
  for (const l of Object.keys(edu) as Level[]) docs[eduDocKey(l)] = { name: eduDocName(l), file: `${first}_${l}_${l === 'g10' || l === 'g12' ? 'marksheet' : 'transcript'}.pdf`, status: 'verified' };
  const female = /a$|i$|ee$|Mithila|Nadia|Lan|Linh|Hoa|Grace|Simran|Navneet|Harpreet|Zainab|Isha|Meher|Thanh|Nimesha/i.test(s.first);
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
    highest,
    gender: female ? 'Female' : 'Male',
    dob: `${String(1 + (hash(s.id + 'dd') % 27)).padStart(2, '0')}/${String(1 + (hash(s.id + 'mm') % 12)).padStart(2, '0')}/${dobY}`,
    passportExpiry: '',
    country: a.region === 'Australia' && dest === 'Australia' ? 'Australia' : s.nationality,
    state: a.region === 'Australia' && dest === 'Australia' ? 'Victoria' : where.state,
    city: a.region === 'Australia' && dest === 'Australia' ? 'Melbourne' : where.city,
    eduCountry: s.nationality,
    edu,
    work: [],
    tests,
    visa: 'no',
    rp: s.rp ?? undefined,
    visaNote: '',
    disability: 'no',
    disabilityNote: '',
    docs,
    read: [],
    // the RP's own counsellor (data/rpteam.ts), or the sample agency's
    counsellor: s.rp ? `${rpByName(s.rp)?.id ?? 'rp'}:1` : 'karthik',
    added: Date.now() - 200 * DAY,
    addedBy: s.rp ? s.rp : me,
    apps: [],
  } as Student;
}
let STUDENT_CACHE: Map<string, Student> | null = null;
const studentOf = (id: string) => {
  STUDENT_CACHE ??= new Map(DATASET.students.map((s) => [s.id, profileOf(s, DATASET.apps.find((x) => x.studentId === s.id)!, '')]));
  return STUDENT_CACHE.get(id)!;
};

/* ---------- the applications (W1, 1 Nov): documents, chat and history that fit each one's stage ---------- */

/** How far each status is along the journey: what has happened by then. */
const STEP: Partial<Record<StatusKey, number>> = { checking: 1, reupload: 1, ready: 2, lodged: 3, conditions: 4, finance: 5, uol: 6, deposit: 7, payreview: 8, visa: 9, visasub: 10, enrolconf: 11, enrolled: 12, closed: 12 };

/** The data set's applications, in the shape every portal reads. */
export function datasetApplications(): Application[] {
  const now = Date.now();
  return DATASET.apps.map((a) => {
    const c = courseFor(a);
    const dest = c.uni.country as Destination;
    const status = a.status as StatusKey;
    const step = STEP[status] ?? 0;
    const intake = intakeOf(a);
    const officer = labelOfId(a.officer) || 'GSP admissions';
    const start = 'intakeDate' in a && a.intakeDate ? Date.parse(a.intakeDate as string) : 0;
    const since = status === 'enrolled' || status === 'closed' ? (start || now) + 35 * DAY : now - (a.sinceDays ?? 1) * DAY;
    const created = status === 'enrolled' || status === 'closed' ? (start || now) - 150 * DAY : since - (STAGE_DAYS[status] ?? 5) * DAY;
    const s = studentOf(a.studentId);
    // the RP's person on it: its counsellor (data/rpteam.ts keeps the same people)
    const rpRec = a.rp ? rpByName(a.rp) : undefined;
    const rpWho = a.rp ? rpRec?.team?.[1]?.name ?? rpRec?.team?.[0]?.name ?? a.rp : 'Karthik Nair';
    const first = s.first;
    const fname = (x: string) => `${first.toLowerCase()}_${slugOf(x)}.pdf`;
    const uniShort = c.uni.name.replace(/^The /, '');
    const ref = step >= 3 ? `${c.uni.id.toUpperCase().slice(0, 3)}-${a.id.slice(4)}7` : undefined;
    // when each thing happened, spread between the start and the current status
    const span = Math.max(since - created, 2 * DAY);
    const t = (k: number) => Math.round(created + (span * k) / 13);
    const asks = docsFor(s, c);
    const files: AppFile[] = [];
    const needs: Need[] = [];
    const history: Event[] = [{ at: created, who: 'you', text: `Application started for ${s.first} ${s.last}`, by: rpWho }];
    const chat: Msg[] = [];
    const say = (at: number, from: Msg['from'], text: string, more: Partial<Msg> = {}) => chat.push({ id: `m${chat.length + 1}`, at, from, name: from === 'gsp' ? officer : from === 'uni' ? `${uniShort} Admissions` : rpWho, text, ...more });
    const f = (name: string, file: string, from: AppFile['from'], at: number, st: AppFile['status'] = 'verified', via?: AppFile['via']) => files.push({ name, file, from, at, status: st, via });
    // the documents asked for when it was added: from the profile, or uploaded for it; checked by GSP at Pre-screening
    for (const d of asks) {
      const prof = s.docs[d.key];
      if (!prof && d.need !== 'required') continue;
      f(d.name, prof?.file ?? fname(d.name), 'you', created, step <= 1 && status === 'checking' ? 'checking' : 'verified', prof ? 'profile' : undefined);
    }
    history.push({ at: created, who: 'system', text: 'Sent to GSP: checking documents' });
    if (status === 'checking') say(t(6), 'you', `Hi, all of ${first}’s documents are in. ${first} is keen on the ${intake} intake.`);
    if (status === 'reupload') {
      const d = asks.find((x) => x.level) ?? asks[0];
      const at = t(8);
      const why = `GSP: the ${d.name.toLowerCase()} is cut off at the bottom of the page. Upload the whole page as one file.`;
      needs.push({ id: d.key, title: d.name, why, source: `GSP check, ${new Date(at).getDate()} ${MON[new Date(at).getMonth()]}`, request: { by: officer, at }, step: 'reupload' });
      const ff = files.find((x) => x.name === d.name);
      if (ff) ff.status = 'checking';
      history.push({ at, who: 'gsp', text: `Sent back the ${d.name.toLowerCase()}: page cut off`, by: officer });
      say(at, 'gsp', `The ${d.name.toLowerCase()} is cut off at the bottom. Could you upload the full page? Everything else is fine.`, { request: d.key, requestName: d.name });
    }
    if (step >= 2) {
      history.push({ at: t(1), who: 'gsp', text: 'GSP checked the documents: all clear', by: officer });
      if (status === 'ready') say(t(2), 'gsp', `${first}’s documents are verified. I’m submitting to ${uniShort} next.`);
    }
    let offer: Application['offer'];
    if (step >= 3) {
      history.push({ at: t(2), who: 'gsp', text: `Submitted to ${c.uni.name}. Reference ${ref}`, by: officer });
      say(t(2), 'gsp', `Submitted to ${uniShort} today. Their reference is ${ref}.`);
      if (status === 'lodged') say(t(8), 'you', `Any update from ${uniShort}? ${first} is asking.`);
      if (status === 'lodged') say(t(9), 'gsp', `Not yet; ${uniShort} is within its usual time. I’ll chase them if there’s nothing by the end of the week.`);
    }
    // a conditional offer first for about half of them, then the unconditional one
    const conditional = status === 'conditions' || (step >= 5 && hash(a.id) % 2 === 0);
    if (step >= 4 && conditional) {
      const at = t(3);
      const file = `${c.uni.id.toUpperCase()}_conditional_offer_${first}_${s.last}.pdf`.replace(/\s+/g, '_');
      f('Conditional offer letter', file, 'gsp', at, 'verified', 'chat');
      history.push({ at, who: 'gsp', text: 'GSP uploaded the conditional offer letter, in the chat', by: officer });
      say(at, 'gsp', `Good news: ${uniShort} has made ${first} a conditional offer. The letter is attached.`, { files: [file] });
      if (status === 'conditions') {
        offer = { kind: 'conditional', file, at, acceptBy: now + 20 * DAY, deposit: c.deposit, conditions: [] };
        needs.push({ id: 'conds', title: 'Offer conditions', why: `${uniShort}’s conditional offer has 2 conditions. Answer them both, then send them to GSP.`, source: 'Conditional offer letter, page 2', due: now + 14 * DAY, request: { by: officer, at: at + 60_000 }, step: 'conditions', form: [
          { id: 'c1', kind: 'question', text: `Will ${first} accept the offer and start in ${intake}?`, source: 'Condition 1' },
          { id: 'c2', kind: 'question', text: `Why has ${first} chosen ${uniShort} and this course? (Genuine Student statement, 100 to 300 words)`, source: 'Condition 2' },
        ] });
        say(at + 60_000, 'gsp', 'The offer has 2 conditions. Answer them in the form and send it; I’ll pass them to the university.', { request: 'conds', requestName: 'Offer conditions' });
      } else {
        history.push({ at: t(4), who: 'gsp', text: 'Conditions submitted to university', by: officer });
        say(t(4), 'you', `Here are ${first}’s answers to the conditions.`);
      }
    }
    if (step >= 5) {
      const at = t(5);
      f('Bank statements (6 months)', fname('bank statements'), 'you', at, status === 'finance' ? 'checking' : 'verified');
      history.push({ at, who: 'you', text: 'Financial documents uploaded', by: rpWho });
      if (status === 'finance') say(at, 'you', `${first}’s bank statements are uploaded for the finance check.`);
      else history.push({ at: t(5) + DAY, who: 'gsp', text: 'Verified the financial documents', by: officer });
    }
    if (step >= 6) {
      const at = t(6);
      const file = `${c.uni.id.toUpperCase()}_offer_${first}_${s.last}.pdf`.replace(/\s+/g, '_');
      f('Unconditional offer letter', file, 'gsp', at, 'verified', 'chat');
      offer = { kind: 'unconditional', file, at, acceptBy: at + 28 * DAY, deposit: c.deposit, conditions: [] };
      history.push({ at, who: 'gsp', text: 'GSP uploaded the unconditional offer letter', by: officer });
      say(at, 'gsp', `${uniShort} has sent ${first}’s unconditional offer letter (attached). Next is the deposit of ${money(c.deposit, c.currency)}.`, { files: [file] });
    }
    if (status === 'deposit') {
      const at = t(7);
      needs.push({ id: 'payment-proof', title: 'Payment proof', why: `Pay ${money(c.deposit, c.currency)} (tuition or deposit) to ${c.uni.name}, then upload the receipt.`, due: now + 10 * DAY, request: { by: officer, at }, step: 'deposit' });
      history.push({ at, who: 'gsp', text: 'Asked for the payment proof', by: officer });
      say(at, 'gsp', '', { request: 'payment-proof', requestName: 'Payment proof' });
    }
    if (step >= 8) {
      const at = t(8);
      f('Payment proof', fname('deposit receipt'), 'you', at, status === 'payreview' ? 'checking' : 'verified', 'request');
      history.push({ at, who: 'you', text: `Payment proof uploaded: ${money(c.deposit, c.currency)}`, by: rpWho });
      if (status === 'payreview') say(at, 'you', `${first} has paid the deposit. The receipt is uploaded.`);
      else history.push({ at: t(8) + DAY, who: 'gsp', text: `Payment confirmed with ${uniShort}`, by: officer });
    }
    if (step >= 9) {
      const at = t(9);
      const doc = ENROL_DOC_LONG[dest];
      f(doc, `${slugOf(doc.replace(/\(.*\)/, ''))}_${first.toLowerCase()}.pdf`, 'gsp', at);
      history.push({ at, who: 'gsp', text: `GSP uploaded the ${doc}`, by: officer });
      say(at, 'gsp', `${first}’s ${doc} is here (in Documents). ${first} can lodge the visa now.`);
    }
    if (status === 'visa') {
      const at = t(9) + 3_600_000;
      needs.push({ id: 'visa', title: 'Visa lodgement proof', why: `Lodge the ${VISA_NAME[dest]}, then upload the lodgement receipt here.`, due: now + 12 * DAY, request: { by: officer, at }, step: 'visa' });
      history.push({ at, who: 'gsp', text: 'Asked for the visa lodgement proof', by: officer });
      say(at, 'gsp', '', { request: 'visa', requestName: 'Visa lodgement proof' });
    }
    if (step >= 10) {
      const at = t(10);
      f('Visa lodgement proof', fname('visa lodgement receipt'), 'you', at, 'verified', 'request');
      history.push({ at, who: 'you', text: 'Visa lodged; lodgement proof uploaded', by: rpWho });
      if (status === 'visasub') say(at, 'you', `${first}’s visa is lodged. The receipt is uploaded.`);
    }
    if (step >= 11) {
      const at = t(11);
      f('Visa', fname('visa grant'), 'you', at, 'verified');
      history.push({ at, who: 'you', text: 'Visa granted', by: rpWho });
      say(at, 'you', `${first}’s visa is granted! The grant letter is in Documents.`);
      if (status === 'enrolconf') say(t(11) + DAY, 'gsp', `Congratulations to ${first}. I’ll confirm the enrolment with ${uniShort} once classes start.`);
    }
    if (step >= 12) {
      f('Proof of enrolment', `${c.uni.id}_enrolment_${first.toLowerCase()}.pdf`, 'gsp', since);
      history.push({ at: since, who: 'gsp', text: 'Student enrolled: the university confirmed the enrolment', by: officer });
      say(since, 'gsp', `${uniShort} confirmed ${first}’s enrolment.`);
    }
    if (status === 'closed') {
      history.push({ at: since + DAY, who: 'you', text: `Withdrawn: ${first} withdrew after enrolling`, by: rpWho });
      say(since + DAY, 'you', `${first} has withdrawn from the course, unfortunately.`);
    }
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
      uniRef: ref,
      asks,
      needs,
      files,
      history: history.sort((x, y) => x.at - y.at),
      chat: chat.sort((x, y) => x.at - y.at),
      offer,
      funds: step >= 6 ? Math.round(c.tuition * 1.6) : undefined,
      unread: needs.some((n) => n.request) ? 1 : undefined,
      ...(a.status === 'closed' ? { end: { kind: 'Student withdrawn' as const, reason: 'Withdrew after enrolling', stage: 7, at: since + DAY } } : {}),
    };
    return app;
  });
}

/** The data set's students. `me` is the person signed in, for the sample agency's own. */
export function datasetStudents(me: string): Student[] {
  return DATASET.students.map((s) => ({ ...studentOf(s.id), addedBy: s.rp ? s.rp : me }));
}

/** Who owns an application on GSP's side, as a person. */
export const officerOf = (a: Pick<Application, 'officer'>) => (a.officer ? staffById(a.officer) : undefined);
/** The data set's record for an application id (new or old), when it's one of these. */
export const dataApp = (id: string) => DATASET.apps.find((a) => a.id === (OLD_ID[id] ?? id));
