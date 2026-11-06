// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * Demo data for the add-ons. Names, IDs and records match the designer's
 * prototype so both tell one story. Records marked `addon: true` exist only
 * here (to show other regions); they are not in his prototype yet.
 * In the real build all of this comes from the server.
 */

import { STAFF, label } from '../data/staff';
import { adminCfg } from '../admin/data/store';
import { salesRegionNames } from '../admin/data/config';

const DAY = 864e5;
export const ago = (d, h = 0) => Date.now() - d * DAY - h * 36e5;

/* The sales regions (HC38, 1 Nov): GSP · Admin › Sales regions, the only list. Global isn't a region work goes to. */
export const regionsNow = () => salesRegionNames().filter((r) => r !== 'Global');

/* Working week per region, for SLA clocks. 1 = Monday … 6 = Saturday, 0 = Sunday. */
export const CALENDARS = [
  // Jovial, 1 Nov (Queue assignment A17): everyone works Monday to Friday, except Bangladesh, Sunday to Thursday.
  // Working hours 9:30 to 18:30 in the calendar's own time zone (Jovial, 6 Nov): SLAs in hours count only these.
  // the seed for Work › Working days (work/calendars.ts), where they're edited
  { id: 'cal-mon-fri', name: 'Monday to Friday', tz: 'Asia/Kolkata', days: [1, 2, 3, 4, 5], start: '09:30', end: '18:30', regions: ['India', 'Nepal', 'Sri Lanka', 'Pakistan', 'Vietnam', 'Indonesia Malaysia & Thailand', 'Myanmar', 'Bhutan', 'Australia', 'Philippines', 'Africa', 'Latin America & Europe', 'China', 'Rest of world', 'Direct', 'Global'],
    holidays: [['2026-11-08', 'Diwali'], ['2026-12-25', 'Christmas'], ['2027-01-01', 'New Year’s Day']] },
  { id: 'cal-sun-thu', name: 'Sunday to Thursday', tz: 'Asia/Dhaka', days: [0, 1, 2, 3, 4], start: '09:30', end: '18:30', regions: ['Bangladesh'],
    holidays: [['2026-12-16', 'Victory Day'], ['2026-12-25', 'Christmas']] },
];

/* GSP's people: every one comes from the staff list (data/staff.ts, Jovial's export of 31 Oct). */
const ROLE_KEY = (r) => r.toLowerCase().replace(/ /g, '-');
export const USERS = [
  ...STAFF.map((s) => ({ id: s.id, name: label(s), email: s.email, role: ROLE_KEY(s.role), title: s.role, regions: s.regions })).sort((a, b) => a.name.localeCompare(b.name)),
  // RP (the designer's GSP test agency)
  { id: 'u-nesil', name: 'Nesil Noble', role: 'rp-admin', title: 'RP Admin', agency: 'GSP test agency', branch: 'Bengaluru head office' },
  { id: 'u-anita', name: 'Anita Desai', role: 'branch-admin', title: 'Branch Manager', agency: 'GSP test agency', branch: 'Mumbai', addon: true },
  { id: 'u-karthik', name: 'Karthik Nair', role: 'counsellor', title: 'Counsellor', agency: 'GSP test agency', branch: 'Bengaluru head office' },
  { id: 'u-divya', name: 'Divya Shetty', role: 'counsellor', title: 'Counsellor', agency: 'GSP test agency', branch: 'Mumbai' },
];

/* Who each of the designer's switcher roles acts as by default. */
export const DEFAULT_PERSONA = {
  'gsp-team': 'u-ramish-jafery',
  'institution-partner': 'u-matt-beazley',
  'gsp-admin': 'u-jovial-lejo',
  'rp-admin': 'u-nesil',
  'gsp-finance': 'u-suman1-verma',
  'gsp-recruitment': 'u-saurabh-chaudhary',
  'gsp-bap': 'u-garima-bhardwaj',
  // slice 1 (2 Nov): the new roles in the Role menu
  'gsp-global-ops': 'u-rhea-menon',
  'gsp-ip-ops': 'u-kabir-sethi',
  'gsp-view-only': 'u-anaya-iyer',
  'rp-branch-admin': 'u-anita',
  'rp-counsellor': 'u-karthik',
};

/* Kinds of work (slice 4 PRD, Kinds of work): a name, the record it's about, an SLA in whole working hours (a working
   day is 9), and where its tasks go (Jovial, 5 Nov: `goesTo`, the one routing setting; work/routing.ts). Goes to is a
   queue's id, 'region' (the application's regional Admissions queue, Application kinds only) or 'recruitment' (the
   RP's Recruitment queue, RP kinds only). Seeded from the queues the task rules had (5 Nov): where a kind's rules
   disagreed, the most common, and on a tie the queue that keeps every rule's assignee (Record owner rules still reach
   the record's owner). No quality check before submission (S4-21). */
export const KINDS = [
  { id: 'k-verify', name: 'Verify application documents', record: 'Application', sla: 9, goesTo: 'region' },
  { id: 'k-submit', name: 'Submit to the university', record: 'Application', sla: 9, goesTo: 'region' },
  { id: 'k-chase-uni', name: 'Chase the university', record: 'Application', sla: 18, goesTo: 'region' },
  { id: 'k-uni-mail', name: 'File a university email', record: 'Application', sla: 9, goesTo: 'region' },
  { id: 'k-gsp-check', name: 'GSP check (finance and background)', record: 'Application', sla: 18, goesTo: 'region' },
  { id: 'k-payment', name: 'Check payment proof', record: 'Application', sla: 9, goesTo: 'region' },
  { id: 'k-enrol', name: 'Confirm enrolment', record: 'Application', sla: 63, goesTo: 'region' },
  { id: 'k-rp-verify', name: 'Verify a new RP', record: 'RP', sla: 18, goesTo: 'q-rp-ops' },
  { id: 'k-rp-change', name: 'RP lifecycle change', record: 'RP', sla: 27, goesTo: 'q-rp-ops' },
  { id: 'k-renew', name: 'Renew an agreement', record: 'Institution partner', sla: 270, goesTo: 'q-institution' },
  { id: 'k-rp-train', name: 'Train a new RP', record: 'RP', sla: 45, goesTo: 'q-rp-ops' },
  { id: 'k-golive', name: 'Get a university live', record: 'University', sla: 126, goesTo: 'q-inst-ops' },
  { id: 'k-course', name: 'Course data update', record: 'Course', sla: 45, goesTo: 'q-inst-ops' },
  { id: 'k-announce', name: 'Publish an announcement or review a newsletter', record: 'Announcement', sla: 9, goesTo: 'q-adm-global' },
  { id: 'k-terms', name: 'Enter commission terms', record: 'Commission', sla: 18, goesTo: 'q-finance' },
  { id: 'k-check', name: 'Check a change', record: 'Commission', sla: 9, goesTo: 'q-finance' },
  { id: 'k-exception', name: 'Commission exception', record: 'Commission', sla: 18, goesTo: 'q-finance' },
  { id: 'k-payout', name: 'RP invoices and payout', record: 'Commission', sla: 9, goesTo: 'q-finance' },
  { id: 'k-mail', name: 'Match an unmatched email', record: 'Email', sla: 9, goesTo: 'q-adm-global' },
  { id: 'k-escalation', name: 'SLA escalation', record: 'Any', sla: 9, goesTo: 'q-adm-global' },
  // proposal S4-28: Admin's own tasks (a setting missing, a job failed)
  { id: 'k-admin', name: 'Fix a setting or a failed job', record: 'Setting', sla: 9, goesTo: 'q-admin' },
  // exchange rates are Finance's (Jovial, 6 Nov): T50 and T60
  { id: 'k-fx', name: 'Enter exchange rates', record: 'Setting', sla: 9, goesTo: 'q-finance' },
];

/** Two role names are the same role (slice 1's names only since the merge: Global Ops, RP Ops, IP Ops). */
export const sameRole = (a, b) => a === b;
const inRegion = (region) => STAFF.filter((s) => s.role === 'Admission' && s.regions.includes(region)).map((s) => s.id);
const withRole = (role) => STAFF.filter((s) => sameRole(s.role, role)).map((s) => s.id);
const recruiters = (region) => STAFF.filter((s) => s.role === 'Recruitment' && s.regions.includes(region)).map((s) => s.id).sort();
const SEA = ['Vietnam', 'Indonesia Malaysia & Thailand', 'Myanmar', 'Bhutan'];
/**
 * The Admissions queue an application's region goes to (HC50, 1 Nov): the queue stored for the region in GSP · Admin
 * (Application routing › Region defaults), matched to the work queue of the same name. Global Admissions if none
 * (also when the region's queue was deleted).
 */
export const regionQueueId = (region, queues = QUEUES) => {
  let name = null;
  try {
    const c = adminCfg();
    // slice 1 (S4-1): Sales regions stores the Work queue's name (older settings: Admin's own queue id)
    name = c.queues.find((q) => q.id === c.regionQueue[region])?.name ?? c.regionQueue[region] ?? null;
  } catch { /* Admin not loaded */ }
  const id = name ? queues.find((q) => q.name === name)?.id : null;
  return id || 'q-adm-global';
};
const slug = (x) => String(x || '').toLowerCase().replace(/\W+/g, '-');
/** The Recruitment queue an RP's region goes to (S4-3, S4-19): "<region> Recruitment", else Rest of world Recruitment. */
export const recruitmentQueueId = (region, queues = QUEUES) => {
  const id = 'q-rec-' + slug(region);
  return queues.some((q) => q.id === id) ? id : queues.some((q) => q.id === 'q-rec-rest-of-world') ? 'q-rec-rest-of-world' : 'q-rp-ops';
};
/**
 * A queue: a name, one leader, members and how work is shared. No type and no regions (S4-24). What it receives isn't
 * stored on it (5 Nov): the kinds of work whose Goes to is the queue, and the routed ones it gets as a region's queue.
 */
const queue = (id, name, leader, members, assign) => ({ id, name, leader, members: [...new Set(members)].filter((m) => m && m !== leader), assign });
const regional = (region, leader, members = inRegion(region)) => queue('q-adm-' + slug(region), region + ' Admissions', leader, members, 'fewest-open');
/** One Recruitment queue per sales region (S4-3). S4-19's table is still blank: each is led by the region's default recruitment contact, with its other BDMs. */
const REC_LEADS = {
  India: 'u-saurabh-chaudhary', Bangladesh: 'u-sania-shanta', Nepal: 'u-anil-shrestha', 'Sri Lanka': 'u-kanchani-jayawardhana', Vietnam: 'u-quan-hoang',
  Pakistan: 'u-ali-butt', 'Indonesia Malaysia & Thailand': 'u-rifaldo-marbun', Myanmar: 'u-nilar-win', Bhutan: 'u-ishwor-acharya', Australia: 'u-judy-tan',
  Philippines: 'u-arielle-sevilleno', Africa: 'u-gsp-bangladesh', 'Latin America & Europe': 'u-camilo-penaranda', China: 'u-annie-gu', 'Rest of world': 'u-ali-butt',
};
const recruitment = (region) => queue('q-rec-' + slug(region), region + ' Recruitment', REC_LEADS[region], recruiters(region), 'record-owner');

/*
 * The queues (slice 4 PRD, The queues; Jovial's Queues tab, 31 Oct, and the 1 Nov answers). Global Admissions is the
 * Global Ops team's queue (S4-20); the Admin queue was "Fallback". Work is shared Fewest open, Record owner or To the
 * leader (S4-2).
 */
export const QUEUES = [
  regional('India', 'u-ramish-jafery'),
  regional('Bangladesh', 'u-kamrun-nahar'),
  regional('Pakistan', 'u-sabrina-hyder'),
  regional('Africa', 'u-kamrun-nahar'),
  regional('Nepal', 'u-supriya-shrestha'),
  regional('Sri Lanka', 'u-subodya-suraweera'),
  { ...regional('SEA', 'u-truc-nguyen', SEA.flatMap(inRegion)), name: 'SEA Admissions' },
  regional('Philippines', 'u-kimberly-olaes'),
  regional('Australia', 'u-jo-qiu'),
  regional('China', 'u-jo-qiu'),
  regional('Latin America & Europe', 'u-valentina-castillo'),
  { ...regional('Global', 'u-tasha-tandon', withRole('Global Ops')), name: 'Global Admissions' },
  queue('q-rp-ops', 'RP Ops', 'u-garima-bhardwaj', withRole('RP Ops'), 'fewest-open'),
  queue('q-institution', 'Institution', 'u-matt-beazley', withRole('Institution'), 'record-owner'),
  ...Object.keys(REC_LEADS).map(recruitment),
  queue('q-inst-ops', 'IP Ops', 'u-gauri-bhardwaj', withRole('IP Ops'), 'fewest-open'),
  queue('q-finance', 'Finance', 'u-suman1-verma', withRole('Finance'), 'fewest-open'),
  queue('q-admin', 'Admin', 'u-jovial-lejo', withRole('Admin'), 'fewest-open'),
];

/*
 * The statuses the old "SLA by status" tab held (S4-12), with the rule that now times each. Nothing edits this list:
 * data/applications.ts reads each status's usual time from the rules through it.
 */
export const STATUS_SLA = [
  ['Pre-screening', 'Pending verification', 'T1'], ['Pre-screening', 'Document re-upload pending', 'T2'],
  ['Application', 'Ready to submit', 'T4'], ['Application', 'Submitted to university', 'T5'], ['Application', 'Additional documents requested', 'T7'],
  ['Application', 'Verifying additional documents', 'T52'],
  ['Offer', 'Conditional offer received, conditions pending', 'T9b'], ['Offer', 'Conditions submitted to university', 'T10'],
  ['Verification', 'Finance and background check', 'T11'], ['Verification', 'University assessment or interview', 'T54'], ['Verification', 'Unconditional offer letter received', 'T13'],
  ['Acceptance', 'Tuition or deposit pending', 'T14'], ['Acceptance', 'Tuition paid, payment proof pending', 'T15'], ['Acceptance', 'Deposit paid, payment proof pending', 'T15'], ['Acceptance', 'Awaiting acceptance letter from university', 'T16'], ['Acceptance', 'Acceptance letter received', 'T55'],
  ['Visa', 'Visa lodgement pending', 'T17'], ['Visa', 'Visa decision pending', 'T56'], ['Visa', 'Visa granted', 'T57'],
  ['Enrolment', 'Enrolment confirmation pending', 'T20'],
].map(([stage, status, row]) => ({ stage, status, row }));

/* The ladder (slice 4 PRD, Breach and escalation): working days, 0 to 60; the morning email's time, IST. */
// two levels (Jovial, 6 Nov): level 1 at due (assignee and leader), level 2 the Admin queue after adminAfter working days
export const ESCALATION = { remindBefore: 1, adminAfter: 5, digestTime: '08:30' };

/*
 * Task rules (slice 4 PRD, Every timer; rule numbers are the rows of Jovial's Task triggers sheet). The rules are data
 * the work service reads (S4-13): Admin changes on/off, `after` (task starts after), `sla`, `remind` (RP reminded)
 * and `share`. `when`, `task` and `closes` are the code's triggers and close conditions, shown read-only.
 * Times are { n, u }: u 'wh' working hours, 'd' working days (9 wh), 'days' calendar days. A rule has no queue of its
 * own (5 Nov): its task goes where its kind of work's Goes to says (work/routing.ts queueOfRule).
 * `share`: 'officer' (the application's officer, S4-5), a way of its own, or null for the queue's own way.
 */
const wh = (n) => ({ n, u: 'wh' });
const d = (n) => ({ n, u: 'd' });
const days = (n) => ({ n, u: 'days' });
const R = (row, group, o) => ({ id: row, row, group, on: true, after: null, remind: null, share: null, ...o });
const A = (row, o) => R(row, 'Applications', { record: 'Application', share: 'officer', ...o });
const IPG = 'Institution partners, universities, courses';
export const RULE_GROUPS = ['Applications', 'RPs', IPG, 'Email', 'Commission', 'Admin', 'Escalation'];
export const RULES = [
  A('T1', { name: 'Documents to verify', when: 'Status is Pending verification', task: 'Verify the documents for <student>', kind: 'k-verify', sla: wh(1), closes: 'The status changes' }),
  A('WH5', { name: 'Documents from the RP to check', when: 'The RP sent documents GSP hasn’t checked (any status except Pending verification, Tuition paid, payment proof pending and Deposit paid, payment proof pending)', task: 'Check the <document> the RP sent for <student> (“Check N documents…” when several)', kind: 'k-verify', sla: wh(1), closes: 'Every document verified or sent back' }),
  A('W11', { name: 'Needs you', when: 'The RP sent a message or upload the officer hasn’t seen', task: 'Needs you: the RP sent <a message> on <student>', kind: 'k-uni-mail', sla: wh(1), closes: 'The officer opens the application' }),
  A('T2', { name: 'Re-upload late', when: 'Document re-upload pending, with an open send-back', after: wh(48), task: 'Chase the RP: re-upload for <student> is late', kind: 'k-verify', sla: wh(6), remind: wh(24), closes: 'The RP re-uploads, or the status changes' }),
  A('T4', { name: 'Ready to submit', when: 'Ready to submit', task: 'Submit <student> to <university>', kind: 'k-submit', sla: wh(1), closes: 'The status moves to Submitted to university' }),
  A('T19', { name: 'Late intake', when: 'Pending verification or Ready to submit, and the intake is up to 2 weeks past its deadline (“Late: likelihood is low”)', task: 'Check <university> still accepts <student> for <intake> (deadline passed)', kind: 'k-chase-uni', sla: wh(12), closes: 'Done (go ahead), or closed (the intake is fixed after Start: a later intake is a close as Deferred and a new application, S3C-22)' }),
  A('T5', { name: 'No decision from the university', when: 'Submitted to university', after: d(2), task: 'Chase <university> for a decision on <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T7', { name: 'Additional documents late', when: 'Additional documents requested, with an open request', after: wh(12), task: 'Chase the RP: additional documents for <student> are late', kind: 'k-chase-uni', sla: wh(12), remind: wh(6), closes: 'The RP uploads, or the status changes' }),
  A('T52', { name: 'Additional documents to check', when: 'Verifying additional documents', task: 'Check the additional documents for <student>', kind: 'k-verify', sla: wh(9), closes: 'The status changes' }),
  A('T54', { name: 'Assessment or interview', when: 'University assessment or interview', after: d(5), task: 'Chase <university> about <student>’s assessment or interview', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T9', { name: 'Conditions to send', when: 'Conditional offer received, conditions not sent yet', task: 'Send the offer and its conditions to the RP for <student>', kind: 'k-uni-mail', sla: wh(12), closes: 'The conditions request is sent' }),
  A('T9b', { name: 'Conditions late', when: 'Conditional offer received, conditions sent', after: wh(12), task: 'Chase the RP: offer conditions for <student>', kind: 'k-uni-mail', sla: wh(12), remind: wh(6), closes: 'The status moves to Conditions submitted to university' }),
  A('T10', { name: 'No answer on conditions', when: 'Conditions submitted to university', after: d(2), task: 'Chase <university> about the conditions for <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T11', { name: 'GSP check', when: 'Finance and background check', task: 'Do the GSP check for <student>', kind: 'k-gsp-check', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T13', { name: 'Unconditional offer', when: 'Unconditional offer letter received', task: 'Send the offer to the RP and ask for the deposit for <student>', kind: 'k-uni-mail', sla: wh(4), closes: 'The status moves to Tuition or deposit pending' }),
  A('T14', { name: 'Deposit not paid', when: 'Tuition or deposit pending, with an open payment request', after: d(2), task: 'Chase the RP: deposit for <student> not paid', kind: 'k-payment', sla: wh(12), remind: d(1), closes: 'Payment proof uploaded, or the status changes' }),
  A('T15', { name: 'Payment proof to check', when: 'Tuition paid, payment proof pending, or Deposit paid, payment proof pending', task: 'Check the payment proof for <student>', kind: 'k-payment', sla: wh(4), closes: 'The status changes' }),
  A('T16', { name: 'Acceptance letter late', when: 'Awaiting acceptance letter from university', after: d(3), task: 'Chase <university> for the acceptance letter for <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T55', { name: 'Move to visa', when: 'Acceptance letter received', task: 'Move <student> to visa', kind: 'k-submit', sla: wh(9), closes: 'The status changes' }),
  A('T17', { name: 'Visa not lodged', when: 'Visa lodgement pending, the RP lodges, with an open request', after: d(7), task: 'Chase the RP: visa for <student> not lodged', kind: 'k-chase-uni', sla: wh(12), remind: d(5), closes: 'Lodgement proof uploaded, or the status changes' }),
  A('WH7', { name: 'GSP lodges the visa', when: 'Visa lodgement pending, GSP lodges', task: 'Lodge the student visa for <student> (GSP lodges this one)', kind: 'k-submit', sla: d(7), closes: 'The status moves to Visa decision pending' }),
  A('T56', { name: 'Visa decision late', when: 'Visa decision pending', after: d(20), task: 'Chase the visa decision for <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T57', { name: 'Course start', when: 'Visa granted', after: { text: 'The course start date' }, task: 'Confirm <student> has started', kind: 'k-enrol', sla: wh(18), closes: 'The status changes' }),
  A('T71', { name: 'Tell the university about a withdrawal', when: 'GSP closes or withdraws an application from Submitted to university onwards', task: 'Tell <university> that <student> withdrew', kind: 'k-uni-mail', sla: wh(9), closes: 'Done (the officer has told the university)' }),
  A('T20', { name: 'Enrolment to confirm', when: 'Enrolment confirmation pending', task: 'Confirm <student>’s enrolment with <university>', kind: 'k-enrol', sla: d(3), closes: 'The status moves to Student enrolled' }),

  R('T32', 'RPs', { record: 'RP', name: 'New RP to verify', when: 'Every onboarding document uploaded (rp.documents_sent)', task: 'Verify <RP>', share: 'fewest-open', kind: 'k-rp-verify', sla: wh(12), closes: 'Verified or sent back' }),
  R('RPA', 'RPs', { record: 'RP', label: '—', name: 'Signed agreement to check', when: 'The RP uploaded a signed copy of an agreement version: the first, or a new one (rp.agreement_uploaded)', task: 'Check <RP>’s signed agreement', share: 'fewest-open', kind: 'k-rp-verify', sla: wh(12), closes: 'Accepted or sent back' }),
  R('T58', 'RPs', { record: 'RP', name: 'Train a new RP', when: 'The RP’s first agreement is accepted, so it’s approved (rp.agreement_accepted)', task: 'Train <RP> on the portal', share: 'fewest-open', kind: 'k-rp-train', sla: d(5), closes: 'RP Ops marks the training done (S4-22)' }),
  R('T33', 'RPs', { record: 'RP', name: 'RP signed up, not activated', when: 'Signed up, not activated', after: d(2), task: 'Help <RP> finish sign-up', share: 'record-owner', kind: 'k-rp-change', sla: wh(18), closes: 'Activated' }),
  R('T34', 'RPs', { record: 'RP', name: 'RP documents sent back', when: 'Onboarding documents sent back', after: d(7), task: 'Chase <RP> for its documents', kind: 'k-rp-change', sla: wh(18), remind: d(3), closes: 'Re-uploaded' }),
  R('T36', 'RPs', { record: 'RP', name: 'RP lifecycle change', when: 'Recruitment asks for a suspension, termination or tier change', task: 'Approve and make the change to <RP>', share: 'to-leader', kind: 'k-rp-change', sla: wh(12), closes: 'Approved or rejected' }),
  // L-5 (Jovial, 2 Nov): an agreement sent and not signed reminds the RP Admins (bell and email E22) after 3 and 7
  // working days, and gives RP Ops a task after 10. T59 (notice follow-up) is removed with Issue a notice (S2C-12).
  R('T69', 'RPs', { record: 'RP', name: 'Agreement not signed', when: 'An agreement was sent to the RP and no signed copy is uploaded yet (Sent)', after: d(10), task: 'Chase <RP> for its signed agreement', share: 'fewest-open', kind: 'k-rp-change', sla: wh(18), remind: d(3), remind2: d(7), closes: 'A signed copy is uploaded, or the agreement is withdrawn' }),
  R('T37', 'RPs', { record: 'RP', name: 'RP inactive', when: 'No new application', after: days(90), task: 'Check in with <RP>', share: 'record-owner', kind: 'k-rp-change', sla: wh(45), closes: 'An application is added, or the Recruitment contact notes why' }),

  R('T38', IPG, { record: 'Institution partner', name: 'Agreement ending', days: 60, when: '<days> days before the agreement ends (the days are editable here; slice 2’s renewal reminder reads them)', task: 'Renew the agreement with <partner>', share: 'record-owner', kind: 'k-renew', sla: d(30), closes: 'A new agreement is uploaded' }),
  R('T40', IPG, { record: 'University', name: 'University not live', when: 'Go-live checks incomplete 14 days after the university was created', task: 'Get <university> live', share: 'to-leader', kind: 'k-golive', sla: d(14), closes: 'The university is Live' }),
  R('T41', IPG, { record: 'Course', name: 'Draft courses', when: 'A course in draft for 7 days', task: 'Finish and publish <course>', share: 'to-leader', kind: 'k-course', sla: d(5), closes: 'Published' }),
  R('T42', IPG, { record: 'Course', name: 'No open intake', when: 'The last intake’s deadline passed and there’s no next intake', task: 'Add the next intake for <course>', kind: 'k-course', sla: d(5), closes: 'An intake is added' }),
  // no fee year (S2C-6): fees are updated when the team updates them, so T43 (next year's fees) is removed.
  // S2C-19: a Closed institution partner reopened by hand leaves its universities as they are; IP Ops gets a task to
  // activate each one.

  // Mail, kept simple (Jovial, 5 Nov): every gsp.admissions@ mail is linked to an application (it shows in the application's
  // Mail tab, no task) or forwarded; only mail that can't be linked makes a task, for Global Ops. T6, T12, T26, T28, T31 and T72 removed.
  R('T27', 'Email', { record: 'Email', name: 'Mail not linked', when: 'A mail to gsp.admissions@ can’t be linked to an application and isn’t forwarded (a student with no application yet, say)', task: 'Link this mail to an application', share: 'fewest-open', kind: 'k-mail', sla: wh(1), closes: 'Linked or forwarded' }),
  R('T29', 'Email', { record: 'Email', name: 'Mail to admin.gsp@', when: 'Any email to admin.gsp@', task: 'Handle this request', share: 'to-leader', kind: 'k-admin', sla: wh(24), closes: 'Done' }),

  // Commission (slice 5 owns what each task does)
  R('T30', 'Commission', { record: 'Email', name: 'Commission remittance', when: 'A remittance or statement, or any mail to commissions.gsp@', task: 'Match the remittance against Commissions', kind: 'k-exception', sla: wh(24), closes: 'Matched to invoices' }),
  R('T39', 'Commission', { record: 'Commission', name: 'Commission terms missing', when: 'An agreement is uploaded and no terms are entered', task: 'Enter commission terms for <partner>', kind: 'k-terms', sla: wh(18), closes: 'Terms entered and checked' }),
  // T45 (change waiting for a checker) removed, 5 Nov: no second-person check in Finance (Commissions flow Q1, Q17, Q35)
  R('T46', 'Commission', { record: 'Commission', name: 'University invoice due', when: 'A commission line’s trigger date passes (census or enrolment)', task: 'Raise the invoice for <record>', kind: 'k-exception', sla: wh(18), closes: 'Invoice sent' }),
  R('T47', 'Commission', { record: 'Commission', name: 'University payment overdue', when: 'Invoice unpaid past the university’s payment days', task: 'Chase <record>’s payment', kind: 'k-exception', sla: wh(18), closes: 'Paid' }),
  R('T48', 'Commission', { record: 'Commission', name: 'Short payment or unmatched remittance', when: 'Amount paid differs from the invoice', task: 'Resolve the exception on <record>', kind: 'k-exception', sla: wh(18), closes: 'Resolved' }),
  R('T49', 'Commission', { record: 'Commission', name: 'Pay approved RP invoices', when: 'Approved RP invoices not paid yet (the month’s pay-by day, Finance setup)', task: 'Pay the approved RP invoices for <record>', share: 'to-leader', kind: 'k-payout', sla: wh(18), closes: 'Every approved invoice is marked paid' }),
  R('T73', 'Commission', { record: 'Commission', name: 'RP invoice to check', when: 'An RP uploads its signed invoice for the month', task: 'Check <record>’s invoice', kind: 'k-payout', sla: wh(18), closes: 'Approved or sent back' }),
  R('T74', 'Commission', { record: 'Commission', name: 'RP query on a line', when: 'An RP queries a commission line on Earnings', task: 'Answer <record>’s query', kind: 'k-exception', sla: wh(27), closes: 'Answered' }),

  // Admin: T50, and the proposal S4-28 (T60 to T68). All in the Admin queue, To the leader.
  R('T50', 'Admin', { record: 'Setting', name: 'Exchange rates missing', when: 'Friday 01:00 IST and next week has no exchange rates', task: 'Enter next week’s exchange rates', share: 'fewest-open', kind: 'k-fx', sla: wh(9), closes: 'The rates are saved' }),
  R('T60', 'Admin', { record: 'Setting', proposal: true, name: 'Currency with no rate', when: 'A university or a commission terms line uses a currency with no rate for its date', task: 'Add an exchange rate for <currency> from <date>', share: 'fewest-open', kind: 'k-fx', sla: wh(9), closes: 'The rate is saved' }),
  R('T61', 'Admin', { record: 'Setting', proposal: true, name: 'Application not routed', when: 'Routing finds no rule for an application (it lands in Global Admissions by default)', task: 'Add a routing rule: <student> from <country> wasn’t routed', share: 'to-leader', kind: 'k-admin', sla: wh(18), closes: 'A rule that matches is saved, or Done' }),
  R('T62', 'Admin', { record: 'Setting', proposal: true, name: 'Nationality not mapped', when: 'A student’s nationality isn’t in any sales region’s nationality map', task: 'Map <nationality> to a sales region', share: 'to-leader', kind: 'k-admin', sla: wh(18), closes: 'The nationality is mapped' }),
  R('T63', 'Admin', { record: 'Setting', proposal: true, name: 'Next year’s holidays', when: '1 December, and next year has no holidays on a working calendar in use', task: 'Add <year>’s holidays to <calendar>', share: 'to-leader', kind: 'k-admin', sla: d(5), closes: 'Holidays for that year are saved' }),
  R('T64', 'Admin', { record: 'Setting', proposal: true, name: 'Yearly cost review', when: '1 March, yearly: living costs and visa and health fees are due for review', task: 'Review living costs and visa fees for <year>', share: 'to-leader', kind: 'k-admin', sla: d(10), closes: 'Done' }),
  R('T65', 'Admin', { record: 'Setting', proposal: true, name: 'Daily job failed', when: 'A daily job fails, or doesn’t finish by 06:00 IST', task: 'Daily job <job> failed on <date>', share: 'to-leader', kind: 'k-admin', sla: wh(4), closes: 'The job’s next run succeeds, or Done' }),
  R('T66', 'Admin', { record: 'Setting', proposal: true, name: 'Emails bouncing', when: 'An email to the same address bounces 3 times in 7 days', task: 'Fix the email address for <person> (<n> bounced emails)', share: 'to-leader', kind: 'k-admin', sla: wh(18), closes: 'The address changes, or Done' }),
  R('T67', 'Admin', { record: 'Setting', proposal: true, name: 'Queue setup broken', when: 'A queue with no leader (one saved before a leader was required)', task: 'Fix queue setup: <what>', share: 'to-leader', kind: 'k-admin', sla: wh(9), closes: 'The setup is fixed' }),
  R('T68', 'Admin', { record: 'Setting', proposal: true, name: 'No document rules', when: 'A program level or destination is added with no document rules', task: 'Add document rules for <level / destination>', share: 'to-leader', kind: 'k-admin', sla: wh(18), closes: 'A rule for it is saved' }),

  R('T51', 'Escalation', { record: 'Any', name: 'SLA breached', when: 'A task is past its due time (the ladder in Queues, SLA and escalation › Reminders and escalation)', task: 'No new task: the same task is shown to more people', kind: 'k-escalation', sla: wh(9), closes: 'The original task is done', ladder: true }),
];

/*
 * No records and no tasks are seeded here (Jovial, 2 Nov: nothing hard-coded). My work's records are the
 * applications, RPs, partners, universities, courses, mail and commission lines as their own modules have them, and
 * every task comes from a rule: work/engine.ts (applications), work/rpRules.ts and work/recordRules.ts (the rest).
 */
