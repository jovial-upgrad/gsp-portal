// @ts-nocheck -- typed with the work API.
/**
 * The application rules' automatic work (slice 4 PRD, Every timer; Jovial's Task triggers sheet).
 *
 * - Statuses never move by themselves. Everything here creates **tasks**, never statuses.
 * - A task exists while its condition holds: when the status changes (forward, back or closed), the RP answers, or the
 *   officer opens the application, the task closes itself. The assignee can also close it with Done.
 * - The rules are **data** (S4-13): each one's on/off, "task starts after", SLA, RP reminder, queue and sharing come
 *   from Admin › Work › Task rules (work/seed.ts RULES, edited in the store). Only the trigger (`when`) and the title
 *   are code here, keyed by the rule's number.
 * - Every application task goes to the application's officer (S4-5); the queue is the application's regional
 *   Admissions queue. While the officer is on leave, the queue's leader covers.
 * - Times are working hours on the record's region's calendar, in IST (work/calendars.ts, work/clock.ts).
 * In the real build this is the work service, run on every change to an application and by job J4 every 15 minutes.
 */
import { sampleApplications, STATUS, toCheck, openRequests, statusText, courseOf, REUPLOAD_AT, PROOF_STATUSES, isOpen } from '../data/applications';
import { sampleStudents } from '../data/students';
import { withLive, liveFlags } from '../data/live';
import { intakeState } from '../data/courses';
import { regionQueueId } from './seed';
import { queueOfRule, goesToOfRule } from './routing';
import { routeApplication, TEST_AGENCY } from '../data/regions';
import { destOf } from '../data/applications';
import { addWorkingHours, workingHoursBetween } from './calendars';
import { now as clockNow } from './clock';

export { addWorkingHours, workingHoursBetween };
const DAY = 864e5;
export const DAY_START = 9.5;
/** A working day in SLA terms: 9 hours (9:30 to 18:30 IST); "2 working days" is 18 working hours. */
export const DAY_HOURS = 9;

/* ---------- a rule's times: { n, u } in working hours ('wh'), working days ('d') or calendar days ('days') ---------- */
export const timeHours = (t) => (!t || t.text ? 0 : t.u === 'd' ? t.n * DAY_HOURS : t.u === 'days' ? t.n * DAY_HOURS : Number(t.n) || 0);
export const timeText = (t) => (!t ? '—' : t.text ? t.text : t.u === 'd' ? `${t.n} d` : t.u === 'days' ? `${t.n} days` : `${t.n} wh`);
/** The moment a wait ends: working hours on the calendar, or plain calendar days ("90 days"). */
export const afterFrom = (cal, from, t) => (!t ? from : t.u === 'days' ? from + t.n * DAY : addWorkingHours(cal, from, timeHours(t)));
/** An SLA as working hours: { h } or { d }, or a rule time. */
export const slaHours = (sla) => (sla?.u ? timeHours(sla) : (sla?.h ?? 0) + (sla?.d ?? 0) * DAY_HOURS);
export const slaText = (sla) => (sla?.d ? `${sla.d} working day${sla.d === 1 ? '' : 's'}` : `${sla.h} working hour${sla.h === 1 ? '' : 's'}`);
/** Is this rule making tasks for a condition that started at `since`? On, or switched off after it started (its open tasks stay). */
export const ruleLive = (r, since) => !!r && (r.on || (r.offAt != null && since < r.offAt));

/* ---------- the application rules: trigger and title (code), by rule number ---------- */
const RE_UPLOAD = new Set(REUPLOAD_AT.filter(Boolean));
/** The statuses whose payment proof GSP checks (T15): tuition paid and deposit paid (4 Nov). */
const PAYMENT_PROOF = PROOF_STATUSES;
const uni = (a) => courseOf(a).uni.name;
const lateIntake = (a) => {
  const i = courseOf(a).intakes?.find((x) => x.month === a.intake);
  return i ? intakeState(i) === 'late' : false;
};
/** The course start date: the 1st of the intake's month ("Feb 2027"), for T57. */
export const startDateOf = (a) => {
  const t = Date.parse(`1 ${String(a.intake).replace(/^\d{1,2}-/, '').replace(/-/g, ' ')}`);
  return Number.isNaN(t) ? null : t;
};
/**
 * `chase`: the task chases the RP (its clock is the RP's wait running out), so it never pauses while the RP is asked.
 * The rest are GSP's own work on the application and pause while a request to the RP is open (S4-10).
 */
export const APP_LOGIC = {
  T1: { when: (a) => a.status === 'checking', title: (n) => `Verify the documents for ${n}` },
  WH5: { when: (a) => !['checking', ...PAYMENT_PROOF].includes(a.status) && toCheck(a).length > 0, title: (n, a) => `Check ${toCheck(a).length === 1 ? `the ${toCheck(a)[0].name.toLowerCase()}` : `${toCheck(a).length} documents`} the RP sent for ${n}` },
  W11: { when: (a, f) => (f.rpNews ?? 0) > (f.rpSeen ?? 0), since: (a, f) => f.rpNews, title: (n, a, f) => `Needs you: the RP sent ${f.rpWhat || 'a message'} on ${n}` },
  T2: { chase: true, when: (a) => RE_UPLOAD.has(a.status) && openRequests(a).length > 0, title: (n) => `Chase the RP: re-upload for ${n} is late` },
  T4: { when: (a) => a.status === 'ready', title: (n, a) => `Submit ${n} to ${uni(a)}` },
  T19: { when: (a) => ['checking', 'ready'].includes(a.status) && lateIntake(a), title: (n, a) => `Check ${uni(a)} still accepts ${n} for ${a.intake} (deadline passed)` },
  T5: { when: (a) => a.status === 'lodged', title: (n, a) => `Chase ${uni(a)} for a decision on ${n}` },
  // L-1 (2 Nov): back with their statuses; T53 stays gone with Additional documents submitted to university
  T7: { chase: true, when: (a) => a.status === 'moreinfo' && openRequests(a).length > 0, title: (n) => `Chase the RP: additional documents for ${n} are late` },
  T52: { when: (a) => a.status === 'addverify', title: (n) => `Check the additional documents for ${n}` },
  T54: { when: (a) => a.status === 'interview', title: (n, a) => `Chase ${uni(a)} about ${n}’s assessment or interview` },
  T9: { when: (a, f) => a.status === 'conditions' && f.condsSent === false, title: (n) => `Send the offer and its conditions to the RP for ${n}` },
  T9b: { chase: true, when: (a, f) => a.status === 'conditions' && f.condsSent !== false, since: (a, f) => (f.condsSent ? f.condsSent : a.since), title: (n) => `Chase the RP: offer conditions for ${n}` },
  T10: { when: (a) => a.status === 'condsent', title: (n, a) => `Chase ${uni(a)} about the conditions for ${n}` },
  T11: { when: (a) => a.status === 'finance', title: (n) => `Do the GSP check for ${n}` },
  T13: { when: (a) => a.status === 'uol', title: (n) => `Send the offer to the RP and ask for the deposit for ${n}` },
  T14: { chase: true, when: (a) => a.status === 'deposit' && openRequests(a).length > 0, title: (n) => `Chase the RP: deposit for ${n} not paid` },
  T15: { when: (a) => PAYMENT_PROOF.includes(a.status), title: (n) => `Check the payment proof for ${n}` },
  T16: { when: (a) => a.status === 'waitad', title: (n, a) => `Chase ${uni(a)} for the acceptance letter for ${n}` },
  T55: { when: (a) => a.status === 'accrec', title: (n) => `Move ${n} to visa` },
  T17: { chase: true, when: (a, f) => a.status === 'visa' && (f.visaBy ?? a.visaBy) !== 'gsp' && openRequests(a).length > 0, title: (n) => `Chase the RP: visa for ${n} not lodged` },
  WH7: { when: (a, f) => a.status === 'visa' && (f.visaBy ?? a.visaBy) === 'gsp', title: (n) => `Lodge the student visa for ${n} (GSP lodges this one)` },
  T56: { when: (a) => a.status === 'visasub', title: (n) => `Chase the visa decision for ${n}` },
  T57: { when: (a) => a.status === 'startdate', start: (a, f) => f?.start ?? startDateOf(a), title: (n) => `Confirm ${n} has started` },
  T20: { when: (a) => a.status === 'enrolconf', title: (n, a) => `Confirm ${n}’s enrolment with ${uni(a)}` },
  // lock answer S3C-9 (2 Nov): GSP closed (or withdrew) the application after it went to the university. The close
  // event records whether it had been submitted (end.submitted); older closes without that record make no task.
  T71: { closed: true, when: (a) => a.status === 'closed' && a.end?.submitted === true, title: (n, a) => `Tell ${uni(a)} that ${n} withdrew` },
};

/** Who-has-it labels (Jovial, 1 Nov). */
export { OWNER_WORD as OWNER_LABEL } from '../data/owners';

/* ---------- applications, as every module sees them now ---------- */
let cache = { key: null, apps: [] };
export function liveApps(live) {
  if (cache.key === live) return cache.apps;
  const studs = sampleStudents('');
  const apps = sampleApplications().map((a0) => {
    const a = withLive(a0, live);
    const st = studs.find((x) => x.id === a.studentId);
    // an application with no sales region yet is routed by Admin's rules (slice 1's Application routing)
    const routed = a.region ? null : routeApplication({ rp: a.rp, nationality: st?.nationality ?? 'India', livesIn: st?.country ?? 'India', dest: destOf(a) });
    // T61: routing found no rule (the fallback, rule 6, or nothing at all): Admin is asked to add one
    const how = routed ? { ...routed, fallback: !routed.rule || /Nothing above matched/.test(routed.why || ''), nationality: st?.nationality ?? '', livesIn: st?.country ?? '' } : null;
    return { ...a, ...(how ? { region: how.region, routed: how } : {}), student: st ? `${st.first} ${st.last}` : a.studentId };
  });
  cache = { key: live, apps };
  return apps;
}

/**
 * The first officer (slice 4 PRD, The first officer; S4-5): when the RP sends the documents, the application's
 * regional Admissions queue picks the member (leader included) with the fewest open applications in the queue,
 * skipping anyone on leave or deactivated and anyone whose sales regions don't cover the application; a tie goes to
 * the name first in alphabetical order. Everyone skipped: the leader. The store keeps the pick: it doesn't change
 * until someone changes the officer on the application.
 */
export function pickOfficer(s, apps, region, canTake = () => true, officerOf = (a) => a.officer) {
  const q = s.queues.find((x) => x.id === regionQueueId(region, s.queues)) || s.queues.find((x) => x.id === 'q-adm-global');
  if (!q) return null;
  const people = [q.leader, ...(q.members || [])].filter((id, i, l) => id && l.indexOf(id) === i && canTake(id));
  if (!people.length) return q.leader;
  const open = (id) => apps.filter((a) => officerOf(a) === id && isOpen(a)).length;
  const name = (id) => (s.users.find((u) => u.id === id) || {}).name || id;
  return people.sort((x, y) => open(x) - open(y) || name(x).localeCompare(name(y)))[0];
}

/**
 * The tasks the application rules make right now. `s.officerOf(a)` is the application's officer (store), `s.closed`
 * the tasks closed with Done (never made again for the same condition), `s.frozen` each task's SLA hours as it was
 * created with (S4-11).
 */
export function appTasks(s, live, now = clockNow()) {
  const flags = liveFlags();
  const out = [];
  const all = liveApps(live);
  for (const a0 of all) {
    // a closed application only has the rules made for a close (T71); an enrolled one none
    const shut = !isOpen(a0);
    if (shut && a0.status !== 'closed') continue;
    const officer = s.officerOf ? s.officerOf(a0) : a0.officer;
    const a = { ...a0, officer };
    const f = flags[a.id] || {};
    const cal = s.calFor(a.region);
    const queue = regionQueueId(a.region || 'Direct', s.queues);
    const q = s.queues.find((x) => x.id === queue);
    for (const [row, L] of Object.entries(APP_LOGIC)) {
      if (!!L.closed !== shut) continue;
      const r = s.rules.find((x) => x.row === row);
      if (!r || !L.when(a, f)) continue;
      const since = L.since ? L.since(a, f) : a.since;
      if (!ruleLive(r, since)) continue;
      const due0 = L.start ? L.start(a, f) : r.after ? afterFrom(cal, since, r.after) : since;
      if (due0 == null || now < due0) continue;
      const id = `A-${a.id}-${row}-${since}`;
      if (s.closed?.[id]) continue;
      // the queue: the rule's kind of work's Goes to (5 Nov), the application's regional queue when it goes by region
      const tq = queueOfRule(s, r, { id, appQueue: queue });
      const tqq = s.queues.find((x) => x.id === tq) || q;
      // the officer gets every application task (S4-5), unless Admin set the rule to share another way
      const assignee = !r.share || r.share === 'officer' ? (officer ?? null) : null;
      const reminded = r.remind ? afterFrom(cal, since, r.remind) : null;
      const req = !L.chase ? openRequests(a).find((n) => n.request) : null;
      out.push({
        id, rule: row, row, kind: r.kind, record: a.id, queue: tq, goesTo: goesToOfRule(s, r, id), assignee, share: r.share && r.share !== 'officer' ? r.share : null, created: due0, status: 'open', auto: true,
        title: L.title(a.student, a, f), slaHours: s.frozen?.[id] ?? timeHours(r.sla), cal: cal.id, closes: r.closes, leader: tqq?.leader,
        reminded: reminded && now > reminded ? reminded : null,
        // GSP's own task pauses while the RP is asked for something (S4-10)
        pausedNow: req ? { from: Math.max(due0, req.request.at), title: req.title } : null,
      });
    }
  }
  return out;
}

/** The application record My work and Mail show, from the live application. */
export function appRecord(a) {
  const c = courseOf(a);
  return { id: a.id, type: 'Application', label: `${a.id} · ${a.student}, ${c.uni.name}`, student: a.student, region: a.region, agency: a.rp || TEST_AGENCY.name, uni: c.uni.name, course: c.name, intake: a.intake, officer: a.officer, status: statusText(a), stage: STATUS[a.status]?.stage, has: STATUS[a.status]?.owner, since: a.since, closed: !isOpen(a), needs: openRequests(a).map((n) => ({ title: n.title, at: n.request?.at, due: n.due })), uploads: a.files.filter((f) => f.from === 'you' && f.via === 'request').map((f) => ({ name: f.name, at: f.at })) };
}
