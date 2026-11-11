/**
 * My work (Jovial, 9 Nov: the PRD's "Queues and My work"): the open tasks, each made by a task rule from the seeded
 * records as they stand now, and the records waiting on someone outside GSP. Nothing here is written by hand: a rule's
 * condition is read from the records (an application's status, an RP's documents, a partner's agreement…), its task
 * lands in the queue the rule names, goes to whoever the rule's sharing picks, and is timed on the record's working
 * calendar. Times are working hours.
 */
import { sampleQueues, sampleRegions, sampleUsers, type Queue, type Region, type User } from './config';
import { DAY_HOURS, REGIONAL, REGION_ADMISSIONS, sampleCalendars, sampleRules, spanHours, type Calendar, type RecordType, type TaskRule } from './work';
import { STATUS, courseOf, intakeStart, sampleApplications, statusText, type Application } from '../../data/applications';
import { fullName, sampleStudents, type Student } from '../../data/students';
import { intakeState } from '../../data/courses';
import { mailsFor, categoryOf, type BoxMail } from '../../data/mailbox';
import { sampleDb } from '../../institution/data/store';
import { agreementOf, checkedAt, isClosed, type InstitutionPartner, type RecruitmentPartner } from '../../institution/data/records';
import type { CourseRec, UniRec } from '../../institution/data/catalogue';
import { HOME_RP } from '../../gsp/rps';
import { agreementsOf, sampleOps, type OpsRp } from '../../rpops/records/data';
import { sampleComm } from '../../finance/commission/seed';
import { rpsWithoutRecord, unisWithoutTerms } from '../../finance/commission/engine';
import type { CommState } from '../../finance/commission/model';

export type { RecordType };
/** A task: its rule's task text filled in, the rule that made it, its record, queue and assignee, and its clock. */
export type WorkTask = {
  id: string;
  /** The rule's ID (T5…). */
  rule: string;
  title: string;
  record: RecordType;
  /** The record's ID or name. */
  ref: string;
  /** The university, partner or RP it's about. */
  about: string;
  region: string;
  queue: string;
  assignee: string;
  waited: number;
  sla: number;
  /** Its rule closes on Done, so its assignee can mark it completed. */
  canComplete: boolean;
  done?: boolean;
  /** Why it was completed before its condition cleared (Q36). */
  note?: string;
};
export type Wait = { id: string; student: string; ref: string; uni: string; status: string; on: 'RP' | 'University'; what: string; since: number; left: number | null };

/** How a task stands against its SLA: left is working hours to go (below 0: late). */
export type Standing = 'track' | 'soon' | 'late' | 'done';
export const STANDING: Record<Standing, string> = { track: 'On track', soon: 'Due soon', late: 'Breached', done: 'Completed' };
export const standing = (left: number): Standing => (left < 0 ? 'late' : left <= DAY_HOURS ? 'soon' : 'track');
export const taskStanding = (t: WorkTask): Standing => (t.done ? 'done' : standing(t.sla - t.waited));
/** "5 working hours", "3 working days". */
export const whText = (wh: number) => {
  const n = Math.abs(wh);
  if (n < DAY_HOURS) return `${n} working ${n === 1 ? 'hour' : 'hours'}`;
  const d = Math.round(n / DAY_HOURS);
  return `${d} working ${d === 1 ? 'day' : 'days'}`;
};
export const whShort = (wh: number) => (wh < DAY_HOURS ? `${wh} wh` : `${Math.round(wh / DAY_HOURS)} wd`);

/* ---------- working time, on a calendar ---------- */

const HOUR = 3_600_000;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Working hours between two times on a calendar: its working days and hours, less its holidays (whole hours). */
export function workingHours(from: number, to: number, cal: Calendar): number {
  if (to <= from) return 0;
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - 1); // a day running past midnight can start the day before
  let total = 0;
  // records older than three years count three years: enough to read as breached
  const stop = Math.max(from, to - 3 * 365 * 24 * HOUR);
  while (day.getTime() <= to) {
    const wd = (day.getDay() + 6) % 7;
    if (cal.days[wd] && !cal.holidays.some((h) => h.date === isoDay(day))) {
      const s = day.getTime() + mins(cal.from) * 60_000;
      let e = day.getTime() + mins(cal.to) * 60_000;
      if (e <= s) e += 24 * HOUR;
      const a = Math.max(s, stop);
      const b = Math.min(e, to);
      if (b > a) total += (b - a) / HOUR;
    }
    if (day.getTime() < stop - 2 * 24 * HOUR) day.setTime(stop - 2 * 24 * HOUR);
    day.setDate(day.getDate() + 1);
  }
  return Math.floor(total);
}

/* ---------- the records the rules read ---------- */

/** The seeded records the task rules read: applications and their students, RPs, institution partners, universities, courses and gsp.admissions@ mail. */
export type WorkRecords = { apps: Application[]; students: Student[]; rps: RecruitmentPartner[]; ips: InstitutionPartner[]; unis: UniRec[]; courses: CourseRec[]; mails: BoxMail[]; ops: OpsRp[]; comm: CommState };
export function sampleRecords(me: { name: string; email: string } = { name: '', email: '' }): WorkRecords {
  const apps = sampleApplications();
  const students = sampleStudents(me.name);
  const db = sampleDb();
  const now = Date.now();
  return { apps, students, rps: db.rps, ips: db.ips, unis: db.unis, courses: db.courses, mails: mailsFor('admission', now - 30 * 24 * HOUR, { apps, students, me, now }), ops: sampleOps(), comm: sampleComm() };
}

/** A record a rule's condition holds for: when it started holding, its region, and the words its task fills in. */
type Hit = { key: string; since: number; region: string; ref: string; about: string; owner?: string; vars: Record<string, string> };
const at = (iso: string) => new Date(`${iso}T09:30`).getTime();
const activityAt = (rp: RecruitmentPartner, what: RegExp) => {
  const a = rp.activity.find((x) => what.test(x.what));
  return a ? at(a.at) : at(rp.since);
};

/**
 * Each rule's condition (When), as the product reads it from the records. Keyed by rule ID: a rule with no entry
 * here makes no tasks.
 */
function hitsFor(rule: TaskRule, rec: WorkRecords, regionOf: (country: string) => string, now: number): Hit[] {
  const student = (a: Application) => {
    const s = rec.students.find((x) => x.id === a.studentId);
    return s ? fullName(s) : a.studentId;
  };
  const rpOf = (a: Application) => rec.rps.find((r) => r.name === (a.rp ?? HOME_RP));
  const app = (status: Application['status']) =>
    rec.apps
      .filter((a) => a.status === status)
      .map((a): Hit => {
        const uni = courseOf(a).uni.name;
        return { key: a.id, since: a.since, region: regionOf(rpOf(a)?.country ?? ''), ref: a.id, about: uni, vars: { student: student(a), university: uni } };
      });
  const rp = (r: RecruitmentPartner, since: number): Hit => ({ key: r.id, since, region: regionOf(r.country), ref: r.code, about: r.name, owner: r.bdm, vars: { RP: r.name } });
  const ipOf = (u: UniRec) => rec.ips.find((p) => p.id === u.ip);
  switch (rule.code) {
    case 'T5':
      return app('lodged');
    case 'T54':
      return app('interview');
    case 'T16':
      return app('waitad');
    case 'T57':
      // starts at the course start date, not after a time
      return app('startdate').map((h) => ({ ...h, since: intakeStart(rec.apps.find((a) => a.id === h.key)!.intake) }));
    case 'T20':
      return app('enrolconf');
    case 'T32':
      return rec.rps.filter((r) => r.docs.every((d) => d.state === 'With BAP')).map((r) => rp(r, activityAt(r, /documents uploaded/i)));
    case 'T69':
      return rec.rps.filter((r) => r.status === 'Activated').map((r) => rp(r, activityAt(r, /agreement sent/i)));
    case 'T37':
      return rec.rps
        .filter((r) => r.status === 'Agreement signed' || r.status === 'Dormant')
        .map((r) => {
          const last = Math.max(activityAt(r, /agreement signed/i), ...rec.apps.filter((a) => (a.rp ?? HOME_RP) === r.name).map((a) => a.created));
          return rp(r, last);
        });
    case 'T38':
      return rec.ips
        .filter((p) => !isClosed(p.status))
        .flatMap((p): Hit[] => {
          const a = agreementOf(p);
          if (!a) return [];
          const since = at(a.end) - (rule.param?.n ?? 0) * 24 * HOUR;
          return since <= now ? [{ key: p.id, since, region: 'Global', ref: p.name, about: p.name, owner: p.rm, vars: { partner: p.name } }] : [];
        });
    case 'T40':
      return rec.unis.filter((u) => u.status === 'Setting up').map((u) => ({ key: u.id, since: at(u.added) + 14 * 24 * HOUR, region: 'Global', ref: u.name, about: ipOf(u)?.name ?? u.name, owner: ipOf(u)?.rm, vars: { university: u.name } }));
    case 'T41':
      return rec.courses.filter((c) => c.status === 'Draft').map((c) => ({ key: c.id, since: checkedAt(c.checked) + 7 * 24 * HOUR, region: 'Global', ref: c.code || c.name, about: c.uni.name, vars: { course: c.name, university: c.uni.name } }));
    case 'T42':
      return rec.courses
        .filter((c) => c.status === 'Live' && c.intakes.length && c.intakes.every((i) => intakeState(i) === 'closed'))
        .map((c) => ({ key: c.id, since: Math.max(...c.intakes.map((i) => at(i.deadline))), region: 'Global', ref: c.code || c.name, about: c.uni.name, vars: { course: c.name, university: c.uni.name } }));
    case 'T80': {
      // an RP whose signed agreement RP Ops accepted, with no commission record yet: from the day it was accepted
      const accepted = rec.ops.filter((r) => agreementsOf(r).active || agreementsOf(r).next);
      return rpsWithoutRecord(rec.comm, accepted).map((r) => {
        const a = r.agreements.filter((x) => x.status === 'accepted').sort((x, y) => (x.decision?.at ?? 0) - (y.decision?.at ?? 0))[0];
        return { key: r.id, since: a?.decision?.at ?? at(r.since), region: regionOf(r.country), ref: r.code, about: r.name, vars: { RP: r.name } };
      });
    }
    case 'T81':
      // a university with no commission terms: from the day it was added
      return unisWithoutTerms(rec.comm, rec.unis).map((u) => ({ key: u.id, since: at(u.added), region: 'Global', ref: u.name, about: u.name, vars: { university: u.name } }));
    case 'T27':
      return rec.mails.filter((m) => m.folder === 'inbox' && categoryOf(m) === 'unlinked').map((m) => ({ key: m.id, since: m.at, region: 'Global', ref: m.subject, about: m.from.name, vars: {} }));
    default:
      return [];
  }
}

/** The rule's task text, with the record's words in it. */
export const fillTask = (task: string, vars: Record<string, string>) => task.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/** Where a rule's task lands for a record in a region: the queue it names, or the region's own (else the fallback). */
export function queueFor(to: string, region: string, queues: Queue[], regions: Region[]): Queue | undefined {
  const reg = REGIONAL[to];
  if (!reg) return queues.find((q) => q.id === to);
  const routed = to.endsWith('Admissions') ? queues.find((q) => q.id === regions.find((r) => r.name === region)?.queue) : undefined;
  return routed ?? queues.find((q) => q.name === `${region} ${reg.suffix}`) ?? queues.find((q) => q.name === reg.fallback);
}

/**
 * Runs the task rules over the records (9 Nov): one task per record while its rule's condition holds, once its start
 * time has passed; in the queue the rule names; to the person its sharing picks (Fewest open counts the queue's open
 * tasks; a tie goes to the name first in alphabetical order; deactivated people are skipped); timed on the record's
 * region's calendar.
 */
/**
 * `closed`: the task IDs completed early (Q36, Jovial 10 Nov). Such a task doesn't come back for that record while its
 * condition still holds. A rule switched off makes no new tasks; its open ones stay where they are (Q37), so the page
 * keeps the tasks it has and only adds what a run makes that it doesn't have.
 */
export function runRules(rules: TaskRule[], rec: WorkRecords, queues: Queue[], regions: Region[], users: User[], cals: Calendar[], now = Date.now(), closed: Set<string> = new Set()): WorkTask[] {
  const regionOf = (country: string) => regions.find((r) => r.countries.includes(country))?.name ?? (country ? 'Rest of world' : 'Global');
  const calOf = (region: string) => cals.find((c) => c.regions.includes(region)) ?? cals[0];
  const userOf = (id: string) => users.find((u) => u.id === id);
  const active = (id: string) => !!userOf(id) && userOf(id)!.status !== 'Deactivated';
  const open = new Map<string, number>();
  const officers = new Map<string, string>();
  const out: WorkTask[] = [];
  const fewest = (q: Queue) => {
    const people = [q.lead, ...q.members].filter(active).map((id) => userOf(id)!.name);
    if (!people.length) return userOf(q.lead)?.name ?? '';
    return people.sort((a, b) => (open.get(`${q.id}|${a}`) ?? 0) - (open.get(`${q.id}|${b}`) ?? 0) || a.localeCompare(b))[0];
  };
  for (const rule of rules.filter((r) => r.on)) {
    for (const hit of hitsFor(rule, rec, regionOf, now)) {
      if (closed.has(`${rule.code}-${hit.key}`)) continue;
      const cal = calOf(hit.region);
      const after = rule.after;
      const start = after?.unit === 'calendar' ? hit.since + after.n * 24 * HOUR : hit.since;
      if (start > now) continue;
      const held = workingHours(start, now, cal);
      const wait = after && after.unit !== 'calendar' ? spanHours(after) : 0;
      if (held < wait) continue;
      const q = queueFor(rule.to, hit.region, queues, regions);
      if (!q) continue;
      const way = rule.sharing === 'queue' ? q.sharing : rule.sharing;
      const members = [q.lead, ...q.members].filter(active).map((id) => userOf(id)!.name);
      let who: string;
      if (way === 'leader') who = userOf(q.lead)?.name ?? '';
      else if (way === 'officer') {
        // the application's officer: picked once, by Fewest open, and every later application task goes to them
        who = officers.get(hit.key) ?? fewest(q);
        officers.set(hit.key, who);
      } else if (way === 'owner' && hit.owner && members.includes(hit.owner)) who = hit.owner;
      else who = fewest(q);
      open.set(`${q.id}|${who}`, (open.get(`${q.id}|${who}`) ?? 0) + 1);
      out.push({
        id: `${rule.code}-${hit.key}`,
        rule: rule.code,
        title: fillTask(rule.task, hit.vars),
        record: rule.record,
        ref: hit.ref,
        about: hit.about,
        region: hit.region,
        queue: q.id,
        assignee: who,
        waited: held - wait,
        sla: spanHours(rule.sla),
        canComplete: rule.done,
      });
    }
  }
  return out;
}

/**
 * One queue's work, for a role's own My work (9 Nov): the queue as GSP · Admin seeds it (its leader and people), and
 * the tasks the seeded task rules make in it from the seeded records. A queue no rule sends work to has none.
 */
export function queueWork(name: string) {
  const users = sampleUsers();
  const queues = sampleQueues(users);
  const regions = sampleRegions(queues);
  const q = queues.find((x) => x.name === name);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const tasks = q ? runRules(sampleRules(), sampleRecords(), queues, regions, users, sampleCalendars(regions.map((r) => r.name))).filter((t) => t.queue === q.id) : [];
  return { queue: name, leader: q ? nameOf(q.lead) : '', team: q ? [q.lead, ...q.members].map(nameOf).filter(Boolean) : [], tasks };
}

/**
 * Waiting on others (Jovial, 10 Nov, Q38): the applications whose status is with the RP or the university, so the
 * GSP clock is paused and the officer can chase. Worked out from the records like the tasks: what is awaited is the
 * RP's open requests (else the status), how long it has waited is working hours since the status started, on the
 * region's calendar. `queue` limits it to the applications whose region's Admissions queue that is.
 */
export function waitsFor(queue?: string, rec: WorkRecords = sampleRecords(), now = Date.now()): Wait[] {
  const users = sampleUsers();
  const queues = sampleQueues(users);
  const regions = sampleRegions(queues);
  const cals = sampleCalendars(regions.map((r) => r.name));
  const regionOf = (country: string) => regions.find((r) => r.countries.includes(country))?.name ?? (country ? 'Rest of world' : 'Global');
  const q = queue ? queues.find((x) => x.name === queue) : undefined;
  return rec.apps
    .map((a) => ({ a, owner: STATUS[a.status].owner }))
    .filter(({ owner }) => owner === 'you' || owner === 'uni')
    .map(({ a, owner }) => {
      const rp = rec.rps.find((r) => r.name === (a.rp ?? HOME_RP));
      const region = regionOf(rp?.country ?? '');
      return { a, owner, region, home: queueFor(REGION_ADMISSIONS, region, queues, regions) };
    })
    .filter((x) => !queue || x.home?.id === q?.id)
    .map(({ a, owner, region }) => {
      const s = rec.students.find((x) => x.id === a.studentId);
      const open = a.needs.filter((n) => !n.file && !n.action);
      const cal = cals.find((c) => c.regions.includes(region)) ?? cals[0];
      return {
        id: `w-${a.id}`,
        student: s ? fullName(s) : a.studentId,
        ref: a.id,
        uni: courseOf(a).uni.name,
        status: statusText(a),
        on: owner === 'you' ? 'RP' : 'University',
        what: owner === 'you' && open.length ? open.map((n) => n.title).join(', ') : statusText(a),
        since: workingHours(a.since, now, cal),
        // the GSP clock is paused while it waits, so there is no time left to show
        left: null,
      } as Wait;
    })
    .sort((x, y) => y.since - x.since);
}
