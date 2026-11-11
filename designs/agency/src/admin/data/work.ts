/**
 * Queues and Working Days, and Task Rules (Jovial, PM, 9 Nov: the PRD's "Queues and My work" tab). Every task is made
 * by a **task rule**: the rule says which **queue** its task lands in (a queue, or each region's Admissions or
 * Recruitment queue), how it's **shared** there and its **SLA**; the working days of the record's sales region say when
 * it's due. No kinds of work, no reminders and no escalation: a late task shows as Breached. Sample settings.
 */

/** How a queue shares a new task (9 Nov: three ways; no "Members pick" or "Leader assigns"). */
export type Sharing = 'fewest' | 'owner' | 'leader';
export const SHARING: Record<Sharing, { label: string; hint: string }> = {
  fewest: {
    label: 'Fewest open',
    hint: 'It goes to the member (leader included) with the fewest open tasks in this queue; a tie goes to the name first in alphabetical order. Deactivated users and anyone who can’t see the record are skipped; people on leave are not. If no one is left, the leader gets it.',
  },
  owner: {
    label: 'Record owner',
    hint: 'It goes to whoever owns the record: the application’s officer, the RP’s Recruitment contact, the partner’s or university’s relationship manager, when that person is an active member of the queue. Otherwise: Fewest open.',
  },
  leader: { label: 'To the leader', hint: 'It goes to the queue’s leader, who does it or assigns it to a member.' },
};
export const SHARINGS = Object.keys(SHARING) as Sharing[];

/** Where a rule's task goes: a queue's id, or each sales region's own Admissions or Recruitment queue. */
export type Destination = string;
export const REGION_ADMISSIONS = 'region:Admissions';
export const REGION_RECRUITMENT = 'region:Recruitment';
/** The two regional destinations: their label, the queue name each region's queue has, and where a region with none goes. */
export const REGIONAL: Record<string, { label: string; suffix: string; fallback: string }> = {
  [REGION_ADMISSIONS]: { label: 'Each region’s Admissions queue', suffix: 'Admissions', fallback: 'Global Admissions' },
  [REGION_RECRUITMENT]: { label: 'Each region’s Recruitment queue', suffix: 'Recruitment', fallback: 'Rest of world Recruitment' },
};

/** The time zones a calendar can count in (9 Nov: each calendar has its own). */
export const TIME_ZONES = ['Asia/Kolkata', 'Asia/Dhaka', 'Asia/Kathmandu', 'Asia/Colombo', 'Asia/Karachi', 'Asia/Ho_Chi_Minh', 'Asia/Jakarta', 'Asia/Manila', 'Asia/Shanghai', 'Australia/Sydney', 'Africa/Lagos', 'Europe/London', 'America/Bogota'];
export const DEFAULT_TZ = 'Asia/Kolkata';

/** The working week (Monday first) and hours an SLA counts on, in the calendar's time zone. */
export type Week = { days: boolean[]; from: string; to: string };
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export type Holiday = { id: string; date: string; name: string };
/**
 * A working calendar: its time zone (9 Nov: each calendar has its own), working days and hours, the sales regions on
 * it and its own holidays. A region is on one calendar; a record's SLA counts its region's calendar. The first is the
 * default: a record with no region, or a region on no calendar, uses it.
 */
export type Calendar = Week & { id: string; name: string; tz: string; regions: string[]; holidays: Holiday[] };
export const sampleCalendars = (regions: string[]): Calendar[] => [
  {
    id: 'cal-monfri',
    name: 'Monday to Friday',
    tz: 'Asia/Kolkata',
    days: [true, true, true, true, true, false, false],
    from: '09:30',
    to: '18:30',
    regions: regions.filter((r) => r !== 'Bangladesh'),
    holidays: [
      { id: 'h1', date: '2026-11-08', name: 'Diwali' },
      { id: 'h2', date: '2026-12-25', name: 'Christmas' },
      { id: 'h3', date: '2027-01-01', name: 'New Year’s Day' },
    ],
  },
  {
    id: 'cal-sunthu',
    name: 'Sunday to Thursday',
    tz: 'Asia/Dhaka',
    days: [true, true, true, true, false, false, true],
    from: '09:30',
    to: '18:30',
    regions: ['Bangladesh'],
    holidays: [
      { id: 'h5', date: '2026-12-16', name: 'Victory Day' },
      { id: 'h6', date: '2026-12-25', name: 'Christmas' },
    ],
  },
];
/** Working hours a day; a day that ends before it starts runs past midnight. */
export const dayHours = (from: string, to: string) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const d = (m(to) - m(from) + 1440) % 1440;
  return Math.round((d / 60) * 10) / 10;
};
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** "Mon–Fri", "Sun–Thu", or the days listed, reading the week round from any day. */
export const daysShort = (days: boolean[]) => {
  const n = days.filter(Boolean).length;
  if (!n) return 'No working days';
  if (n === 7) return 'Every day';
  // a run that wraps the week (Sun–Thu): start after an off day
  for (let s = 0; s < 7; s++) {
    if (!days[s] || days[(s + 6) % 7]) continue;
    let k = 0;
    while (k < 7 && days[(s + k) % 7]) k++;
    if (k === n) return n === 1 ? SHORT[s] : `${SHORT[s]}–${SHORT[(s + n - 1) % 7]}`;
  }
  return SHORT.filter((_, i) => days[i]).join(', ');
};
/** "Monday to Friday", or the days listed. */
export const weekText = (days: boolean[]) => {
  const on = WEEKDAYS.filter((_, i) => days[i]);
  const run = days.findIndex((d) => d) >= 0 && on.length > 1 && on.every((d) => days[WEEKDAYS.indexOf(d)]) && WEEKDAYS.indexOf(on[on.length - 1]) - WEEKDAYS.indexOf(on[0]) === on.length - 1;
  return !on.length ? 'No working days' : run ? `${on[0]} to ${on[on.length - 1]}` : on.join(', ');
};

/** A rule's times: working hours, working days or calendar days. */
export type SpanUnit = 'hours' | 'days' | 'calendar';
export const SPAN_UNITS: Record<SpanUnit, string> = { hours: 'working hours', days: 'working days', calendar: 'days' };
/** Which units each of a rule's times takes (Starts after: all three; SLA and the RP reminder: working time). */
export const AFTER_UNITS: SpanUnit[] = ['hours', 'days', 'calendar'];
export const SLA_UNITS: SpanUnit[] = ['hours', 'days'];
/** The SLA's limits: 1 to 60 working days, or 1 to 99 working hours. */
export const SLA_MAX: Record<SpanUnit, number> = { hours: 99, days: 60, calendar: 60 };
export type Span = { n: number; unit: SpanUnit } | null;
/** Working hours in a working day: both starting calendars have 9. */
export const DAY_HOURS = 9;
/** A span in working hours (calendar days count as working days, for the sample's clock). */
export const spanHours = (x: Span) => (!x ? 0 : x.unit === 'hours' ? x.n : x.n * DAY_HOURS);
/** "4 wh", "2 wd", "30 days": short, for the table. */
export const spanShort = (x: Span) => (!x ? '—' : x.unit === 'hours' ? `${x.n} wh` : x.unit === 'days' ? `${x.n} wd` : `${x.n} ${x.n === 1 ? 'day' : 'days'}`);
/** "4 working hours", "30 days". */
export const spanText = (x: Span) => (!x ? '' : `${x.n} ${x.unit === 'calendar' ? (x.n === 1 ? 'day' : 'days') : `working ${x.unit === 'hours' ? (x.n === 1 ? 'hour' : 'hours') : x.n === 1 ? 'day' : 'days'}`}`);
/** Several reminders, one unit: "3 wd and 7 wd". */
export const spansShort = (xs: Span[]) => (xs.length ? xs.map(spanShort).join(' and ') : '—');
export const spansText = (xs: Span[]) => xs.map(spanText).join(' and ');

/** How a rule's task is shared: to the application's officer (application rules only), the queue's own way, or one of the three. */
export type RuleSharing = 'officer' | 'queue' | Sharing;
export const RULE_SHARING: Record<RuleSharing, string> = { officer: 'The application’s officer', queue: 'The queue’s own way', fewest: 'Fewest open', owner: 'Record owner', leader: 'To the leader' };
export const RULE_SHARINGS = Object.keys(RULE_SHARING) as RuleSharing[];

/** The rule groups, as Task Rules' tabs. */
export const RULE_CATS = ['Applications', 'RPs', 'Institution partners, universities, courses', 'Email', 'Commission'] as const;
export type RuleCat = (typeof RULE_CATS)[number];
/** The record a rule's task is about. */
export type RecordType = 'Application' | 'RP' | 'Institution partner' | 'University' | 'Course' | 'Email';

/**
 * A task rule (9 Nov: the only task rules; commission rules come separately). **When**, the **task** and **closes**
 * are part of the product (shown, not edited); the Admin changes where it **goes**, when it **starts**, its **SLA**, when
 * the **RP is reminded** (only where the RP owes something), how it's **shared**, and whether it's **on**. `afterEvent`:
 * a rule that starts at an event (the course start date) rather than after a time. `param`: a number the rule's When
 * reads (T38's days before the agreement ends). `done`: it closes on Done, so the assignee can Mark as completed.
 */
export type TaskRule = {
  id: string;
  code: string;
  cat: RuleCat;
  record: RecordType;
  name: string;
  on: boolean;
  when: string;
  param?: { label: string; n: number };
  after: Span;
  afterEvent?: string;
  task: string;
  to: Destination;
  sla: Span;
  /** When the RP is reminded; null where the RP owes nothing (the field isn't shown). */
  remind: Span[] | null;
  sharing: RuleSharing;
  closes: string;
  done: boolean;
};
/** A rule's When, with its number filled in. */
export const whenText = (r: TaskRule) => (r.param ? r.when.replace('{days}', String(r.param.n)) : r.when);
const h = (n: number): Span => ({ n, unit: 'hours' });
const d = (n: number): Span => ({ n, unit: 'days' });
const r = (code: string, cat: RuleCat, record: RecordType, name: string, when: string, task: string, to: Destination, sla: Span, sharing: RuleSharing, closes: string, o: Partial<Pick<TaskRule, 'after' | 'afterEvent' | 'remind' | 'param'>> = {}): TaskRule => ({
  id: code,
  code,
  cat,
  record,
  name,
  on: true,
  when,
  param: o.param,
  after: o.after ?? null,
  afterEvent: o.afterEvent,
  task,
  to,
  sla,
  remind: o.remind ?? null,
  sharing,
  closes,
  done: /^Done\b/.test(closes),
});
/** The task rules (Jovial, 9 Nov), with their IDs. Team queues by id: see `sampleQueues` in config.ts. */
export const sampleRules = (): TaskRule[] => [
  r('T5', 'Applications', 'Application', 'No decision yet', 'Submitted to university', 'Chase {university} for a decision on {student}', REGION_ADMISSIONS, h(12), 'officer', 'Done, or the status changes', { after: d(2) }),
  r('T54', 'Applications', 'Application', 'Assessment or interview', 'University assessment or interview', 'Chase {university} about {student}’s assessment or interview', REGION_ADMISSIONS, h(12), 'officer', 'Done, or the status changes', { after: d(5) }),
  r('T16', 'Applications', 'Application', 'Acceptance letter', 'Awaiting acceptance letter from university', 'Chase {university} for the acceptance letter for {student}', REGION_ADMISSIONS, h(12), 'officer', 'Done, or the status changes', { after: d(3) }),
  r('T57', 'Applications', 'Application', 'Course started', 'Visa granted', 'Confirm {student} has started', REGION_ADMISSIONS, h(18), 'officer', 'The status changes', { afterEvent: 'the course start date' }),
  r('T20', 'Applications', 'Application', 'Enrolment confirmation', 'Enrolment confirmation pending', 'Confirm {student}’s enrolment with {university}', REGION_ADMISSIONS, d(3), 'officer', 'The status moves to Student enrolled'),
  r('T32', 'RPs', 'RP', 'Onboarding documents', 'Every onboarding document uploaded', 'Verify {RP}', 'q-rp-ops', h(12), 'fewest', 'Verified or sent back'),
  r('T69', 'RPs', 'RP', 'Signed agreement', 'An agreement was sent to the RP and no signed copy is uploaded yet (Sent)', 'Chase {RP} for its signed agreement', 'q-rp-ops', h(18), 'fewest', 'A signed copy is uploaded, or the agreement is withdrawn', { after: d(10), remind: [d(3), d(7)] }),
  r('T37', 'RPs', 'RP', 'No new application', 'No new application', 'Check in with {RP}', REGION_RECRUITMENT, h(45), 'owner', 'An application is added, or the Recruitment contact notes why', { after: { n: 90, unit: 'calendar' } }),
  r('T38', 'Institution partners, universities, courses', 'Institution partner', 'Agreement ends', '{days} days before the agreement ends', 'Renew the agreement with {partner}', 'q-institution', d(30), 'owner', 'A new agreement is uploaded', { param: { label: 'Days before the agreement ends', n: 60 } }),
  r('T40', 'Institution partners, universities, courses', 'University', 'University not live', 'Go-live checks incomplete 14 days after the university was created', 'Get {university} live', 'q-ip-ops', d(14), 'leader', 'The university is Live'),
  r('T41', 'Institution partners, universities, courses', 'Course', 'Course in draft', 'A course in draft for 7 days', 'Finish and publish {course}', 'q-ip-ops', d(5), 'leader', 'Published'),
  r('T42', 'Institution partners, universities, courses', 'Course', 'No next intake', 'The last intake’s deadline passed and there’s no next intake', 'Add the next intake for {course}', 'q-ip-ops', d(5), 'queue', 'An intake is added'),
  r('T27', 'Email', 'Email', 'Mail not linked', 'A mail to gsp.admissions@ can’t be linked to an application and isn’t forwarded (a student with no application yet, say)', 'Link this mail to an application', 'q-global-admissions', h(1), 'fewest', 'Linked, forwarded or marked Not needed'),
  // 9 Nov (Jovial, the PRD's Commissions tab): Commissions enters an RP's commission record and a university's terms
  r('T80', 'Commission', 'RP', 'Commission record', 'RP Ops accepts an RP’s first signed agreement', 'Enter commission details for {RP}', 'q-finance', d(2), 'fewest', 'The RP’s commission record is saved'),
  // 11 Nov (Jovial): T80 and T81 are the only commission task rules; exceptions, tier periods, continuing students and
  // notices to issue are worked from Commission lines and RP Ops › Notices, with no task
  r('T81', 'Commission', 'University', 'Commission terms', 'A university is added', 'Enter commission terms for {university}', 'q-finance', d(5), 'fewest', 'The university’s terms are saved'),
];
