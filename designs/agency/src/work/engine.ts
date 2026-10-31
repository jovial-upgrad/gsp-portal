// @ts-nocheck -- typed with the work API.
/**
 * The application lifecycle's automatic work (Jovial's Pending Questions sheet, 1 Nov: Status triggers, Who has it,
 * Task triggers, Queue assignment).
 *
 * - Statuses never move by themselves, except New to Pre-screening when the RP sends the application. Everything
 *   here creates **tasks**, never statuses.
 * - A task exists while its condition holds: when the officer changes the status (forward, back, or closed), the
 *   task closes itself. The officer can also close it with one click.
 * - Tasks go to the application's officer. Their queue is the application's regional Admissions queue; QC goes to
 *   Admission Ops. When the officer is on leave, the queue's leader covers.
 * - SLAs and waits count working hours (9:30 to 18:30) on working days: Monday to Friday, Sunday to Thursday in
 *   Bangladesh.
 * In the real build this is the work service, run on every change to an application.
 */
import { sampleApplications, STATUS, toCheck, openRequests, statusText, courseOf, REUPLOAD_AT, isOpen } from '../data/applications';
import { sampleStudents } from '../data/students';
import { withLive, liveFlags } from '../data/live';
import { intakeState } from '../data/courses';
import { onLeave } from '../data/leave';
import { regionQueueId } from './seed';

const H = 36e5;
export const DAY_START = 9.5;
export const DAY_HOURS = 9;

/* ---------- working hours ---------- */
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const isWorkingDay = (cal, t) => cal.days.includes(new Date(t).getDay()) && !cal.holidays.some((h) => h[0] === ymd(t));
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** The moment `hours` working hours after `from`. */
export function addWorkingHours(cal, from, hours) {
  let left = hours * H;
  let t = from;
  for (let guard = 0; guard < 400; guard++) {
    const day = startOfDay(t);
    const open = day + DAY_START * H;
    const close = open + DAY_HOURS * H;
    if (isWorkingDay(cal, day) && t < close) {
      const from2 = Math.max(t, open);
      if (from2 + left <= close) return from2 + left;
      left -= close - from2;
    }
    t = day + 24 * H + 1;
    t = startOfDay(t);
  }
  return t;
}
/** Working hours between two moments (negative if b is before a). */
export function workingHoursBetween(cal, a, b) {
  if (b < a) return -workingHoursBetween(cal, b, a);
  let n = 0;
  for (let day = startOfDay(a); day <= b; day += 24 * H) {
    const d0 = startOfDay(day + 2 * H); // daylight saving safe
    if (!isWorkingDay(cal, d0)) continue;
    const open = d0 + DAY_START * H;
    const close = open + DAY_HOURS * H;
    n += Math.max(0, Math.min(close, b) - Math.max(open, a));
  }
  return n / H;
}
/** An SLA as working hours: { h } or { d } (working days of 9 hours). */
export const slaHours = (sla) => (sla?.h ?? 0) + (sla?.d ?? 0) * DAY_HOURS;
export const slaText = (sla) => (sla?.d ? `${sla.d} working day${sla.d === 1 ? '' : 's'}` : `${sla.h} working hour${sla.h === 1 ? '' : 's'}`);

/* ---------- the rules ---------- */
const RE_UPLOAD = new Set(REUPLOAD_AT.filter(Boolean));
const uni = (a) => courseOf(a).uni.name;
/**
 * The application rules (Task triggers T1–T23, Status triggers S1–S27). `when` says whether the task exists now;
 * `after` is how long the application has to be in that state first (a wait before a chase).
 */
export const APP_RULES = [
  { id: 'a-verify', row: 'T1', kind: 'k-verify', when: (a) => a.status === 'checking', title: (n) => `Verify the documents for ${n}`, sla: { h: 1 }, closes: 'Status moves on' },
  { id: 'a-check', row: 'WH5', kind: 'k-verify', when: (a) => !['checking', 'payreview'].includes(a.status) && toCheck(a).length > 0, title: (n, a) => `Check ${toCheck(a).length === 1 ? `the ${toCheck(a)[0].name.toLowerCase()}` : `${toCheck(a).length} documents`} the RP sent for ${n}`, sla: { h: 1 }, closes: 'Every document verified or sent back' },
  { id: 'a-reupload', row: 'T2', kind: 'k-verify', when: (a) => RE_UPLOAD.has(a.status) && openRequests(a).length > 0, after: { h: 48 }, title: (n) => `Chase the RP: re-upload for ${n} is late`, sla: { h: 6 }, closes: 'The RP re-uploads, or the status changes', remind: { h: 24 } },
  { id: 'a-qc', row: 'T3', kind: 'k-qc', queue: 'q-adm-ops', who: 'leader-assigns', when: (a) => a.status === 'ready', title: (n) => `Quality-check ${n} before submission`, sla: { h: 1 }, closes: 'Status moves on' },
  { id: 'a-submit', row: 'T4', kind: 'k-submit', when: (a) => a.status === 'ready', title: (n, a) => `Submit ${n} to ${uni(a)}`, sla: { h: 1 }, closes: 'Status moves to Submitted to university', late: true },
  { id: 'a-chase-uni', row: 'T5', kind: 'k-chase-uni', when: (a) => a.status === 'lodged', after: { d: 2 }, title: (n, a) => `Chase ${uni(a)} for a decision on ${n}`, sla: { h: 12 }, closes: 'Officer closes it, or the status changes' },
  { id: 'a-moreinfo', row: 'T7', kind: 'k-chase-uni', when: (a) => a.status === 'moreinfo' && openRequests(a).length > 0, after: { h: 12 }, title: (n) => `Chase the RP: additional documents for ${n} are late`, sla: { h: 12 }, closes: 'The RP uploads, or the status changes', remind: { h: 6 } },
  { id: 'a-conds', row: 'T9', kind: 'k-uni-mail', when: (a, f) => a.status === 'conditions' && f.condsSent === false, title: (n) => `Send the offer and its conditions to the RP for ${n}`, sla: { h: 12 }, closes: 'Conditions sent to the RP' },
  { id: 'a-conds-chase', row: 'T9', kind: 'k-uni-mail', when: (a, f) => a.status === 'conditions' && f.condsSent !== false, after: { h: 12 }, title: (n) => `Chase the RP: offer conditions for ${n}`, sla: { h: 12 }, closes: 'Status moves to Conditions submitted', remind: { h: 6 } },
  { id: 'a-chase-conds', row: 'T10', kind: 'k-chase-uni', when: (a) => a.status === 'condsent', after: { d: 2 }, title: (n, a) => `Chase ${uni(a)} about the conditions for ${n}`, sla: { h: 12 }, closes: 'Officer closes it, or the status changes' },
  { id: 'a-gsp-check', row: 'T11', kind: 'k-gsp-check', when: (a) => a.status === 'finance', title: (n) => `Do the GSP check for ${n}`, sla: { h: 12 }, closes: 'Officer closes it, or the status changes' },
  { id: 'a-uol', row: 'T13', kind: 'k-uni-mail', when: (a) => a.status === 'uol', title: (n) => `Send the offer to the RP and ask for the deposit for ${n}`, sla: { h: 4 }, closes: 'Status moves to Tuition or deposit pending' },
  { id: 'a-deposit', row: 'T14', kind: 'k-payment', when: (a) => a.status === 'deposit' && openRequests(a).length > 0, after: { d: 2 }, title: (n) => `Chase the RP: deposit for ${n} not paid`, sla: { h: 12 }, closes: 'Payment proof uploaded, or the status changes', remind: { d: 1 } },
  { id: 'a-payment', row: 'T15', kind: 'k-payment', when: (a) => a.status === 'payreview', title: (n) => `Check the payment proof for ${n}`, sla: { h: 4 }, closes: 'Status moves on' },
  { id: 'a-chase-accept', row: 'T16', kind: 'k-chase-uni', when: (a) => a.status === 'waitad', after: { d: 3 }, title: (n, a) => `Chase ${uni(a)} for the acceptance letter for ${n}`, sla: { h: 12 }, closes: 'Officer closes it, or the status changes' },
  { id: 'a-visa', row: 'T17', kind: 'k-chase-uni', when: (a, f) => a.status === 'visa' && (f.visaBy ?? a.visaBy) !== 'gsp' && openRequests(a).length > 0, after: { d: 7 }, title: (n) => `Chase the RP: visa for ${n} not lodged`, sla: { h: 12 }, closes: 'Lodgement proof uploaded, or the status changes', remind: { d: 5 } },
  { id: 'a-visa-gsp', row: 'WH7', kind: 'k-submit', when: (a, f) => a.status === 'visa' && (f.visaBy ?? a.visaBy) === 'gsp', title: (n) => `Lodge the student visa for ${n} (GSP lodges this one)`, sla: { d: 7 }, closes: 'Status moves to Visa decision pending' },
  { id: 'a-late', row: 'T19', kind: 'k-chase-uni', when: (a) => ['checking', 'ready'].includes(a.status) && lateIntake(a), title: (n, a) => `Check ${uni(a)} still accepts ${n} for ${a.intake} (deadline passed)`, sla: { h: 12 }, closes: 'Officer records go ahead, moves the intake, or closes' },
  { id: 'a-enrol', row: 'T20', kind: 'k-enrol', when: (a) => a.status === 'enrolconf', title: (n, a) => `Confirm ${n}’s enrolment with ${uni(a)}`, sla: { d: 3 }, closes: 'Status moves to Student enrolled' },
];
const lateIntake = (a) => {
  const i = courseOf(a).intakes?.find((x) => x.month === a.intake);
  return i ? intakeState(i) === 'late' : false;
};

/** Who-has-it labels (Jovial, 1 Nov). */
export const OWNER_LABEL = { you: 'On RP', gsp: 'On GSP', uni: 'On university', done: 'Done', end: 'Ended' };

/* ---------- applications, as every module sees them now ---------- */
let cache = { key: null, apps: [] };
export function liveApps(live) {
  if (cache.key === live) return cache.apps;
  const studs = sampleStudents('');
  const apps = sampleApplications().map((a0) => {
    const a = withLive(a0, live);
    const st = studs.find((x) => x.id === a.studentId);
    return { ...a, student: st ? `${st.first} ${st.last}` : a.studentId };
  });
  cache = { key: live, apps };
  return apps;
}

/** The officer who gets a new application: the regional queue's member with the fewest open applications, skipping people on leave (Queue assignment A1). */
export function pickOfficer(s, apps, region) {
  const q = s.queues.find((x) => x.id === regionQueueId(region)) || s.queues.find((x) => x.id === 'q-adm-global');
  if (!q) return null;
  const people = [q.leader, ...(q.members || [])].filter((id) => id && !onLeave(id));
  if (!people.length) return q.leader;
  const open = (id) => apps.filter((a) => a.officer === id && isOpen(a)).length;
  return people.sort((x, y) => open(x) - open(y) || x.localeCompare(y))[0];
}

/** The tasks the application rules create right now. Closed ones (one click) are in `s.closed`. */
export function appTasks(s, live, now = Date.now()) {
  const flags = liveFlags();
  const calFor = (region) => s.calendars.find((c) => c.regions.includes(region || 'Global')) || s.calendars[0];
  const out = [];
  const all = liveApps(live);
  for (const a0 of all) {
    if (!isOpen(a0)) continue;
    // an application nobody owns yet gets one: the regional queue's member with the fewest open (A1)
    const a = a0.officer ? a0 : { ...a0, officer: pickOfficer(s, all, a0.region || 'Direct') };
    const f = flags[a.id] || {};
    const cal = calFor(a.region);
    const queue = regionQueueId(a.region || 'Direct');
    const q = s.queues.find((x) => x.id === queue);
    for (const r of APP_RULES) {
      if (!r.when(a, f)) continue;
      const since = r.id === 'a-conds-chase' && f.condsSent ? f.condsSent : a.since;
      const due0 = r.after ? addWorkingHours(cal, since, slaHours(r.after)) : since;
      if (r.after && now < due0) continue;
      const id = `A-${a.id}-${r.id}-${since}`;
      if (s.closed?.[id]) continue;
      const tq = r.queue || queue;
      // on leave (A4) or no longer at GSP (A5): the queue's leader covers
      const gone = a.officer && !s.users.some((u) => u.id === a.officer);
      const covering = a.officer && (onLeave(a.officer) || gone);
      const assignee = r.who === 'leader-assigns' ? null : covering ? q?.leader ?? null : a.officer ?? null;
      const reminded = r.remind ? addWorkingHours(cal, since, slaHours(r.remind)) : null;
      out.push({
        id, rule: r.id, row: r.row, kind: r.kind, record: a.id, queue: tq, assignee, created: due0, status: 'open', auto: true,
        title: r.title(a.student, a), slaHours: slaHours(r.sla), cal: cal.id, closes: r.closes,
        note: [covering ? (gone ? 'Their officer has left GSP: the leader has it' : `Covering while ${(s.users.find((u) => u.id === a.officer) || {}).name || 'the officer'} is on leave`) : null, reminded && now > reminded ? 'The RP was reminded automatically' : null, `Closes when: ${r.closes.toLowerCase()}`].filter(Boolean).join(' · '),
      });
    }
  }
  return out;
}

/** The application record My work and Mail show, from the live application. */
export function appRecord(a) {
  const c = courseOf(a);
  return { id: a.id, type: 'Application', label: `${a.id} · ${a.student}, ${c.uni.name}`, student: a.student, region: a.region || 'India', agency: a.rp || 'GSP test agency', uni: c.uni.name, course: c.name, intake: a.intake, officer: a.officer, status: statusText(a), stage: STATUS[a.status]?.stage, since: a.since, closed: !isOpen(a) };
}
