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
  // Working hours 9:30 to 18:30 local: SLAs in hours count only these.
  // the seed for Work › Working days (work/calendars.ts), where they're edited
  { id: 'cal-mon-fri', name: 'Monday to Friday', days: [1, 2, 3, 4, 5], start: '09:30', end: '18:30', regions: ['India', 'Nepal', 'Sri Lanka', 'Pakistan', 'Vietnam', 'Indonesia Malaysia & Thailand', 'Myanmar', 'Bhutan', 'Australia', 'Philippines', 'Africa', 'Latin America & Europe', 'China', 'Rest of world', 'Direct', 'Global'],
    holidays: [['2026-11-08', 'Diwali'], ['2026-12-25', 'Christmas'], ['2027-01-01', 'New Year’s Day']] },
  { id: 'cal-sun-thu', name: 'Sunday to Thursday', days: [0, 1, 2, 3, 4], start: '09:30', end: '18:30', regions: ['Bangladesh'],
    holidays: [['2026-12-16', 'Victory Day'], ['2026-12-25', 'Christmas']] },
];

/* GSP's people: every one comes from the staff list (data/staff.ts, Jovial's export of 31 Oct). */
const ROLE_KEY = (r) => r.toLowerCase().replace(/ /g, '-');
export const USERS = [
  ...STAFF.map((s) => ({ id: s.id, name: label(s), email: s.email, role: ROLE_KEY(s.role), title: s.role, regions: s.regions })).sort((a, b) => a.name.localeCompare(b.name)),
  // RP (the designer's GSP test agency)
  { id: 'u-nesil', name: 'Nesil Noble', role: 'rp-admin', title: 'RP Admin', agency: 'GSP test agency', branch: 'Bengaluru head office' },
  { id: 'u-anita', name: 'Anita Desai', role: 'branch-admin', title: 'Branch Admin', agency: 'GSP test agency', branch: 'Mumbai', addon: true },
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
   day is 9). No quality check before submission (S4-21). */
export const KINDS = [
  { id: 'k-verify', name: 'Verify application documents', record: 'Application', sla: 9 },
  { id: 'k-submit', name: 'Submit to the university', record: 'Application', sla: 9 },
  { id: 'k-chase-uni', name: 'Chase the university', record: 'Application', sla: 18 },
  { id: 'k-uni-mail', name: 'File a university email', record: 'Application', sla: 9 },
  { id: 'k-gsp-check', name: 'GSP check (finance and background)', record: 'Application', sla: 18 },
  { id: 'k-payment', name: 'Check payment proof', record: 'Application', sla: 9 },
  { id: 'k-enrol', name: 'Confirm enrolment', record: 'Application', sla: 63 },
  { id: 'k-rp-verify', name: 'Verify a new RP', record: 'RP', sla: 18 },
  { id: 'k-rp-change', name: 'RP lifecycle change', record: 'RP', sla: 27 },
  { id: 'k-renew', name: 'Renew an agreement', record: 'Institution partner', sla: 270 },
  { id: 'k-rp-train', name: 'Train a new RP', record: 'RP', sla: 45 },
  { id: 'k-rp-notice', name: 'Notice issue', record: 'RP', sla: 27 },
  { id: 'k-golive', name: 'Get a university live', record: 'University', sla: 126 },
  { id: 'k-course', name: 'Course data update', record: 'Course', sla: 45 },
  { id: 'k-announce', name: 'Publish an announcement or review a newsletter', record: 'Announcement', sla: 9 },
  { id: 'k-terms', name: 'Enter commission terms', record: 'Commission', sla: 18 },
  { id: 'k-check', name: 'Check a change', record: 'Commission', sla: 9 },
  { id: 'k-exception', name: 'Commission exception', record: 'Commission', sla: 18 },
  { id: 'k-payout', name: 'Payout run', record: 'Commission', sla: 9 },
  { id: 'k-mail', name: 'Match an unmatched email', record: 'Email', sla: 9 },
  { id: 'k-escalation', name: 'SLA escalation', record: 'Any', sla: 9 },
  // proposal S4-28: Admin's own tasks (a setting missing, a job failed)
  { id: 'k-admin', name: 'Fix a setting or a failed job', record: 'Setting', sla: 9 },
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
const APP_KINDS = ['k-verify', 'k-submit', 'k-chase-uni', 'k-uni-mail', 'k-gsp-check', 'k-payment', 'k-enrol'];
/** A queue: a name, one leader, members, how work is shared, and what it receives. No type and no regions (S4-24). */
const queue = (id, name, leader, members, assign, kinds) => ({ id, name, leader, members: [...new Set(members)].filter((m) => m && m !== leader), assign, kinds });
const regional = (region, leader, members = inRegion(region)) => queue('q-adm-' + slug(region), region + ' Admissions', leader, members, 'fewest-open', APP_KINDS);
/** One Recruitment queue per sales region (S4-3). S4-19's table is still blank: each is led by the region's default BDM, with its other BDMs. */
const REC_LEADS = {
  India: 'u-saurabh-chaudhary', Bangladesh: 'u-sania-shanta', Nepal: 'u-anil-shrestha', 'Sri Lanka': 'u-kanchani-jayawardhana', Vietnam: 'u-quan-hoang',
  Pakistan: 'u-ali-butt', 'Indonesia Malaysia & Thailand': 'u-rifaldo-marbun', Myanmar: 'u-nilar-win', Bhutan: 'u-ishwor-acharya', Australia: 'u-judy-tan',
  Philippines: 'u-arielle-sevilleno', Africa: 'u-gsp-bangladesh', 'Latin America & Europe': 'u-camilo-penaranda', China: 'u-annie-gu', 'Rest of world': 'u-ali-butt',
};
const recruitment = (region) => queue('q-rec-' + slug(region), region + ' Recruitment', REC_LEADS[region], recruiters(region), 'record-owner', ['k-rp-change']);

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
  { ...regional('Global', 'u-tasha-tandon', withRole('Global Ops')), name: 'Global Admissions', kinds: [...APP_KINDS, 'k-mail', 'k-announce', 'k-escalation'] },
  queue('q-rp-ops', 'RP Ops', 'u-garima-bhardwaj', withRole('RP Ops'), 'fewest-open', ['k-rp-verify', 'k-rp-change', 'k-rp-train', 'k-rp-notice']),
  queue('q-institution', 'Institution', 'u-matt-beazley', withRole('Institution'), 'record-owner', ['k-renew', 'k-golive']),
  ...Object.keys(REC_LEADS).map(recruitment),
  queue('q-inst-ops', 'IP Ops', 'u-gauri-bhardwaj', withRole('IP Ops'), 'fewest-open', ['k-course']),
  queue('q-finance', 'Finance', 'u-suman1-verma', withRole('Finance'), 'fewest-open', ['k-terms', 'k-check', 'k-exception', 'k-payout']),
  queue('q-admin', 'Admin', 'u-jovial-lejo', withRole('Admin'), 'fewest-open', ['k-admin']),
];

/*
 * The statuses the old "SLA by status" tab held (S4-12), with the rule that now times each. Nothing edits this list:
 * data/applications.ts reads each status's usual time from the rules through it.
 */
export const STATUS_SLA = [
  ['Pre-screening', 'Pending verification', 'T1'], ['Pre-screening', 'Document re-upload pending', 'T2'],
  ['Application', 'Ready to submit', 'T4'], ['Application', 'Submitted to university', 'T5'], ['Application', 'Additional documents requested', 'T7'],
  ['Application', 'Verifying additional documents', 'T52'], ['Application', 'Additional documents submitted to university', 'T53'],
  ['Offer', 'Conditional offer received, conditions pending', 'T9b'], ['Offer', 'Conditions submitted to university', 'T10'],
  ['Verification', 'Finance and background check', 'T11'], ['Verification', 'University assessment or interview', 'T54'], ['Verification', 'Unconditional offer letter received', 'T13'],
  ['Acceptance', 'Tuition or deposit pending', 'T14'], ['Acceptance', 'Payment proof under review', 'T15'], ['Acceptance', 'Awaiting acceptance letter from university', 'T16'], ['Acceptance', 'Acceptance letter received', 'T55'],
  ['Visa', 'Visa lodgement pending', 'T17'], ['Visa', 'Visa decision pending', 'T56'], ['Visa', 'Visa granted: waiting for start date', 'T57'],
  ['Enrolment', 'Enrolment confirmation pending', 'T20'],
].map(([stage, status, row]) => ({ stage, status, row }));

/* The ladder (slice 4 PRD, Breach and escalation): working days, 0 to 60; the morning email's time, IST. */
export const ESCALATION = { remindBefore: 1, opsAfter: 2, adminAfter: 5, digestTime: '08:30' };

/*
 * Task rules (slice 4 PRD, Every timer; rule numbers are the rows of Jovial's Task triggers sheet). The rules are data
 * the work service reads (S4-13): Admin changes on/off, `after` (task starts after), `sla`, `remind` (RP reminded),
 * `queue` and `share`. `when`, `task` and `closes` are the code's triggers and close conditions, shown read-only.
 * Times are { n, u }: u 'wh' working hours, 'd' working days (9 wh), 'days' calendar days. `queue`: 'region' (the
 * application's regional Admissions queue), 'recruitment' (the RP's region's Recruitment queue) or a queue id.
 * `share`: 'officer' (the application's officer, S4-5), a way of its own, or null for the queue's own way.
 */
const wh = (n) => ({ n, u: 'wh' });
const d = (n) => ({ n, u: 'd' });
const days = (n) => ({ n, u: 'days' });
const R = (row, group, o) => ({ id: row, row, group, on: true, after: null, remind: null, share: null, ...o });
const A = (row, o) => R(row, 'Applications', { record: 'Application', queue: 'region', share: 'officer', ...o });
const IPG = 'Institution partners, universities, courses';
export const RULE_GROUPS = ['Applications', 'RPs', IPG, 'Email', 'Commission', 'Admin', 'Escalation'];
export const RULES = [
  A('T1', { name: 'Documents to verify', when: 'Status is Pending verification', task: 'Verify the documents for <student>', kind: 'k-verify', sla: wh(1), closes: 'The status changes' }),
  A('WH5', { name: 'Documents from the RP to check', when: 'The RP sent documents GSP hasn’t checked (any status except Pending verification and Payment proof under review)', task: 'Check the <document> the RP sent for <student> (“Check N documents…” when several)', kind: 'k-verify', sla: wh(1), closes: 'Every document verified or sent back' }),
  A('W11', { name: 'Needs you', when: 'The RP sent a message or upload the officer hasn’t seen', task: 'Needs you: the RP sent <a message> on <student>', kind: 'k-uni-mail', sla: wh(1), closes: 'The officer opens the application' }),
  A('T2', { name: 'Re-upload late', when: 'Document re-upload pending, with an open send-back', after: wh(48), task: 'Chase the RP: re-upload for <student> is late', kind: 'k-verify', sla: wh(6), remind: wh(24), closes: 'The RP re-uploads, or the status changes' }),
  A('T4', { name: 'Ready to submit', when: 'Ready to submit', task: 'Submit <student> to <university>', kind: 'k-submit', sla: wh(1), closes: 'The status moves to Submitted to university' }),
  A('T19', { name: 'Late intake', when: 'Pending verification or Ready to submit, and the intake is up to 2 weeks past its deadline (“Late: likelihood is low”)', task: 'Check <university> still accepts <student> for <intake> (deadline passed)', kind: 'k-chase-uni', sla: wh(12), closes: 'Done (go ahead), the intake moved, or closed' }),
  A('T5', { name: 'No decision from the university', when: 'Submitted to university', after: d(2), task: 'Chase <university> for a decision on <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T7', { name: 'Additional documents late', when: 'Additional documents requested, with an open request', after: wh(12), task: 'Chase the RP: additional documents for <student> are late', kind: 'k-chase-uni', sla: wh(12), remind: wh(6), closes: 'The RP uploads, or the status changes' }),
  A('T52', { name: 'Additional documents to check', when: 'Verifying additional documents', task: 'Check the additional documents for <student>', kind: 'k-verify', sla: wh(9), closes: 'The status changes' }),
  A('T53', { name: 'Additional documents with the university', when: 'Additional documents submitted to university', after: d(2), task: 'Chase <university> about the additional documents for <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T54', { name: 'Assessment or interview', when: 'University assessment or interview', after: d(5), task: 'Chase <university> about <student>’s assessment or interview', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T9', { name: 'Conditions to send', when: 'Conditional offer received, conditions not sent yet', task: 'Send the offer and its conditions to the RP for <student>', kind: 'k-uni-mail', sla: wh(12), closes: 'The conditions request is sent' }),
  A('T9b', { name: 'Conditions late', when: 'Conditional offer received, conditions sent', after: wh(12), task: 'Chase the RP: offer conditions for <student>', kind: 'k-uni-mail', sla: wh(12), remind: wh(6), closes: 'The status moves to Conditions submitted to university' }),
  A('T10', { name: 'No answer on conditions', when: 'Conditions submitted to university', after: d(2), task: 'Chase <university> about the conditions for <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T11', { name: 'GSP check', when: 'Finance and background check', task: 'Do the GSP check for <student>', kind: 'k-gsp-check', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T13', { name: 'Unconditional offer', when: 'Unconditional offer letter received', task: 'Send the offer to the RP and ask for the deposit for <student>', kind: 'k-uni-mail', sla: wh(4), closes: 'The status moves to Tuition or deposit pending' }),
  A('T14', { name: 'Deposit not paid', when: 'Tuition or deposit pending, with an open payment request', after: d(2), task: 'Chase the RP: deposit for <student> not paid', kind: 'k-payment', sla: wh(12), remind: d(1), closes: 'Payment proof uploaded, or the status changes' }),
  A('T15', { name: 'Payment proof to check', when: 'Payment proof under review', task: 'Check the payment proof for <student>', kind: 'k-payment', sla: wh(4), closes: 'The status changes' }),
  A('T16', { name: 'Acceptance letter late', when: 'Awaiting acceptance letter from university', after: d(3), task: 'Chase <university> for the acceptance letter for <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T55', { name: 'Move to visa', when: 'Acceptance letter received', task: 'Move <student> to visa', kind: 'k-submit', sla: wh(9), closes: 'The status changes' }),
  A('T17', { name: 'Visa not lodged', when: 'Visa lodgement pending, the RP lodges, with an open request', after: d(7), task: 'Chase the RP: visa for <student> not lodged', kind: 'k-chase-uni', sla: wh(12), remind: d(5), closes: 'Lodgement proof uploaded, or the status changes' }),
  A('WH7', { name: 'GSP lodges the visa', when: 'Visa lodgement pending, GSP lodges', task: 'Lodge the student visa for <student> (GSP lodges this one)', kind: 'k-submit', sla: d(7), closes: 'The status moves to Visa decision pending' }),
  A('T56', { name: 'Visa decision late', when: 'Visa decision pending', after: d(20), task: 'Chase the visa decision for <student>', kind: 'k-chase-uni', sla: wh(12), closes: 'Done, or the status changes' }),
  A('T57', { name: 'Course start', when: 'Visa granted: waiting for start date', after: { text: 'The course start date' }, task: 'Confirm <student> has started', kind: 'k-enrol', sla: wh(18), closes: 'The status changes' }),
  A('T20', { name: 'Enrolment to confirm', when: 'Enrolment confirmation pending', task: 'Confirm <student>’s enrolment with <university>', kind: 'k-enrol', sla: d(3), closes: 'The status moves to Student enrolled' }),

  R('T32', 'RPs', { record: 'RP', name: 'New RP to verify', when: 'Every onboarding document uploaded (rp.documents_sent)', task: 'Verify <RP>', queue: 'q-rp-ops', share: 'fewest-open', kind: 'k-rp-verify', sla: wh(12), closes: 'Verified or sent back' }),
  R('RPA', 'RPs', { record: 'RP', label: '—', name: 'Signed agreement to check', when: 'Signed agreement uploaded (rp.agreement_uploaded)', task: 'Check <RP>’s signed agreement', queue: 'q-rp-ops', share: 'fewest-open', kind: 'k-rp-verify', sla: wh(12), closes: 'Accepted or sent back' }),
  R('T58', 'RPs', { record: 'RP', name: 'Train a new RP', when: 'The RP’s agreement is executed (rp.agreement_signed)', task: 'Train <RP> on the portal', queue: 'q-rp-ops', share: 'fewest-open', kind: 'k-rp-train', sla: d(5), closes: 'RP Ops marks the training done (S4-22)' }),
  R('T33', 'RPs', { record: 'RP', name: 'RP signed up, not activated', when: 'Signed up, not activated', after: d(2), task: 'Help <RP> finish sign-up', queue: 'recruitment', share: 'record-owner', kind: 'k-rp-change', sla: wh(18), closes: 'Activated' }),
  R('T34', 'RPs', { record: 'RP', name: 'RP documents sent back', when: 'Onboarding documents sent back', after: d(7), task: 'Chase <RP> for its documents', queue: 'q-rp-ops', kind: 'k-rp-change', sla: wh(18), remind: d(3), closes: 'Re-uploaded' }),
  R('T36', 'RPs', { record: 'RP', name: 'RP lifecycle change', when: 'The BDM asks for a suspension, termination or tier change', task: 'Approve and make the change to <RP>', queue: 'q-rp-ops', share: 'to-leader', kind: 'k-rp-change', sla: wh(12), closes: 'Approved or rejected' }),
  R('T59', 'RPs', { record: 'RP', name: 'Notice follow-up', when: 'RP Ops issues a notice to an RP', task: 'Follow up the notice to <RP>', queue: 'q-rp-ops', share: 'fewest-open', kind: 'k-rp-notice', sla: d(3), closes: 'Done (S4-22)' }),
  R('T37', 'RPs', { record: 'RP', name: 'RP inactive', when: 'No new application', after: days(90), task: 'Check in with <RP>', queue: 'recruitment', share: 'record-owner', kind: 'k-rp-change', sla: wh(45), closes: 'An application is added, or the BDM notes why' }),
  R('W23', 'RPs', { record: 'RP', name: 'New RP assigned', when: 'A new RP is assigned to a BDM', task: 'Get in touch with <RP>', queue: 'recruitment', share: 'record-owner', kind: 'k-rp-change', sla: wh(18), closes: 'The BDM logs the first call' }),
  R('T35', 'RPs', { record: 'RP', name: 'New bank details', when: 'The RP sends new bank details (payouts held)', task: 'Check the new bank details for <RP>', queue: 'q-finance', share: 'not-maker', kind: 'k-check', sla: wh(6), closes: 'Approved or rejected' }),

  R('T38', IPG, { record: 'Institution partner', name: 'Agreement ending', days: 60, when: '<days> days before the agreement ends (the days are editable here; slice 2’s renewal reminder reads them)', task: 'Renew the agreement with <partner>', queue: 'q-institution', share: 'record-owner', kind: 'k-renew', sla: d(30), closes: 'A new agreement is uploaded' }),
  R('T40', IPG, { record: 'University', name: 'University not live', when: 'Go-live checks incomplete 14 days after the university was created', task: 'Get <university> live', queue: 'q-institution', share: 'record-owner', kind: 'k-golive', sla: d(14), closes: 'The university is Live' }),
  R('T41', IPG, { record: 'Course', name: 'Draft courses', when: 'A course in draft for 7 days', task: 'Finish and publish <course>', queue: 'q-inst-ops', share: 'fewest-open', kind: 'k-course', sla: d(5), closes: 'Published' }),
  R('T42', IPG, { record: 'Course', name: 'No open intake', when: 'The last intake’s deadline passed and there’s no next intake', task: 'Add the next intake for <course>', queue: 'q-inst-ops', kind: 'k-course', sla: d(5), closes: 'An intake is added' }),
  R('T43', IPG, { record: 'Course', name: 'Next year’s fees missing', when: '1 September, for courses without next year’s fees', task: 'Add next year’s fees for <course>', queue: 'q-inst-ops', kind: 'k-course', sla: d(10), closes: 'Fees added' }),

  // Mail (later slice) keeps the same clock and states
  R('T6', 'Email', { record: 'Email', name: 'University email on an application', when: 'An email is matched to an application (90% or more)', task: 'Act on the email for <student>', queue: 'region', share: 'officer', kind: 'k-uni-mail', sla: wh(1), closes: 'The officer files or dismisses the email' }),
  R('T12', 'Email', { record: 'Email', name: 'Interview or GS', when: 'An email asks for an interview or GS assessment', task: 'Book the interview for <student>', queue: 'region', share: 'officer', kind: 'k-uni-mail', sla: wh(9), closes: 'Interview booked' }),
  R('T26', 'Email', { record: 'Email', name: 'Check an email match', when: 'AI confidence 60 to 89%', task: 'Check the match for this email', queue: 'region', share: 'officer', kind: 'k-mail', sla: wh(1), closes: 'Match confirmed or changed' }),
  R('T27', 'Email', { record: 'Email', name: 'Email not matched', when: 'AI confidence below 60%', task: 'Match this email to a record', queue: 'q-adm-global', kind: 'k-mail', sla: wh(1), closes: 'Matched or marked not needed' }),
  R('T28', 'Email', { record: 'Email', name: 'New application by email', when: 'An RP sends a new application by email', task: 'Create the application, or send the RP to the portal', queue: 'q-adm-global', kind: 'k-verify', sla: wh(3), closes: 'Done' }),
  R('T29', 'Email', { record: 'Email', name: 'Mail to admin.gsp@', when: 'Any email to admin.gsp@', task: 'Handle this request', queue: 'q-admin', kind: 'k-admin', sla: wh(24), closes: 'Done' }),
  R('T31', 'Email', { record: 'Email', name: 'University newsletter', when: 'A university newsletter arrives', task: 'Review the newsletter for an announcement', queue: 'q-adm-global', kind: 'k-announce', sla: wh(6), closes: 'Announcement published or dismissed' }),

  // Commission (slice 5 owns what each task does)
  R('T30', 'Commission', { record: 'Email', name: 'Commission remittance', when: 'A remittance or statement, or any mail to commissions.gsp@', task: 'Match the remittance against Commissions', queue: 'q-finance', kind: 'k-exception', sla: wh(24), closes: 'Matched to invoices' }),
  R('T39', 'Commission', { record: 'Commission', name: 'Commission terms missing', when: 'An agreement is uploaded and no terms are entered', task: 'Enter commission terms for <partner>', queue: 'q-finance', kind: 'k-terms', sla: wh(18), closes: 'Terms entered and checked' }),
  R('T45', 'Commission', { record: 'Commission', name: 'Change waiting for a checker', when: 'Terms, a notice or a scheme changed', task: 'Check the change to <record>', queue: 'q-finance', share: 'not-maker', kind: 'k-check', sla: wh(9), closes: 'A different person approves or rejects it' }),
  R('T46', 'Commission', { record: 'Commission', name: 'University invoice due', when: 'A commission line’s trigger date passes (census or enrolment)', task: 'Raise the invoice for <record>', queue: 'q-finance', kind: 'k-exception', sla: wh(18), closes: 'Invoice sent' }),
  R('T47', 'Commission', { record: 'Commission', name: 'University payment overdue', when: 'Invoice unpaid past the university’s payment days', task: 'Chase <record>’s payment', queue: 'q-finance', kind: 'k-exception', sla: wh(18), closes: 'Paid' }),
  R('T48', 'Commission', { record: 'Commission', name: 'Short payment or unmatched remittance', when: 'Amount paid differs from the invoice', task: 'Resolve the exception on <record>', queue: 'q-finance', kind: 'k-exception', sla: wh(18), closes: 'Resolved' }),
  R('T49', 'Commission', { record: 'Commission', name: 'Payout run', when: 'Mondays 01:00 IST (J8)', task: 'Prepare the payout run', queue: 'q-finance', share: 'to-leader', kind: 'k-payout', sla: wh(9), closes: 'Run approved' }),

  // Admin: T50, and the proposal S4-28 (T60 to T68). All in the Admin queue, To the leader.
  R('T50', 'Admin', { record: 'Setting', name: 'Exchange rates missing', when: 'Friday 01:00 IST and next week has no exchange rates', task: 'Enter next week’s exchange rates', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: wh(9), closes: 'The rates are saved' }),
  R('T60', 'Admin', { record: 'Setting', proposal: true, name: 'Currency with no rate', when: 'A university, notice or terms line uses a currency with no rate for its date', task: 'Add an exchange rate for <currency> from <date>', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: wh(9), closes: 'The rate is saved' }),
  R('T61', 'Admin', { record: 'Setting', proposal: true, name: 'Application not routed', when: 'Routing finds no rule for an application (it lands in Global Admissions by default)', task: 'Add a routing rule: <student> from <country> wasn’t routed', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: wh(18), closes: 'A rule that matches is saved, or Done' }),
  R('T62', 'Admin', { record: 'Setting', proposal: true, name: 'Nationality not mapped', when: 'A student’s nationality isn’t in any sales region’s nationality map', task: 'Map <nationality> to a sales region', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: wh(18), closes: 'The nationality is mapped' }),
  R('T63', 'Admin', { record: 'Setting', proposal: true, name: 'Next year’s holidays', when: '1 December, and next year has no holidays on a working calendar in use', task: 'Add <year>’s holidays to <calendar>', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: d(5), closes: 'Holidays for that year are saved' }),
  R('T64', 'Admin', { record: 'Setting', proposal: true, name: 'Yearly cost review', when: '1 March, yearly: living costs and visa and health fees are due for review', task: 'Review living costs and visa fees for <year>', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: d(10), closes: 'Done' }),
  R('T65', 'Admin', { record: 'Setting', proposal: true, name: 'Daily job failed', when: 'A daily job fails, or doesn’t finish by 06:00 IST', task: 'Daily job <job> failed on <date>', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: wh(4), closes: 'The job’s next run succeeds, or Done' }),
  R('T66', 'Admin', { record: 'Setting', proposal: true, name: 'Emails bouncing', when: 'An email to the same address bounces 3 times in 7 days', task: 'Fix the email address for <person> (<n> bounced emails)', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: wh(18), closes: 'The address changes, or Done' }),
  R('T67', 'Admin', { record: 'Setting', proposal: true, name: 'Queue setup broken', when: 'A kind of work no queue receives, or a queue with no leader, is saved', task: 'Fix queue setup: <what>', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: wh(9), closes: 'The setup is fixed' }),
  R('T68', 'Admin', { record: 'Setting', proposal: true, name: 'No document rules', when: 'A program level or destination is added with no document rules', task: 'Add document rules for <level / destination>', queue: 'q-admin', share: 'to-leader', kind: 'k-admin', sla: wh(18), closes: 'A rule for it is saved' }),

  R('T51', 'Escalation', { record: 'Any', name: 'SLA breached', when: 'A task is past its due time (the ladder in Queues, SLA and escalation › Reminders and escalation)', task: 'No new task: the same task is shown to more people', queue: 'ops', kind: 'k-escalation', sla: wh(9), closes: 'The original task is done', ladder: true }),
];

/* Records. Every application is the one the portals show (data/applications.ts and data/dataset.ts): one data set,
   so a task or a mail opens the same application in any role. Only what My work adds sits here: who's waiting on
   whom, and on what. */
import SAMPLE from './sample.json';
import { sampleApplications, courseOf, statusText, stageOf, STAGES } from '../data/applications';
import { sampleStudents } from '../data/students';
import { OLD_ID, rpByName } from '../data/dataset';
const WAITING = {
  'GSP-24055': { waitingOn: 'RP', waitingFor: 'Gap explanation document', due: ago(-3) },
  'GSP-24102': { waitingOn: 'RP', waitingFor: 'Offer conditions', due: ago(-2) },
  'GSP-24061': { waitingOn: 'RP', waitingFor: 'Re-uploaded 12th marksheet', due: ago(-1) },
  'GSP-23710': { waitingOn: 'RP', waitingFor: 'Visa lodgement proof', due: ago(-12) },
  'GSP-23941': { waitingOn: 'University', waitingFor: 'Decision from Coventry', due: ago(-2) },
  'GSP-24097': { waitingOn: 'University', waitingFor: 'Decision from Wollongong', due: ago(-1) },
};
SAMPLE.records.forEach((r) => { if (r.waitingOn) WAITING[OLD_ID[r.id] ?? r.id] = { waitingOn: r.waitingOn, waitingFor: r.waitingFor, due: r.dueDays != null ? ago(-r.dueDays) : undefined }; });
const STUDENTS = sampleStudents('');
const APP_RECORDS = sampleApplications().map((a) => {
  const c = courseOf(a);
  const st = STUDENTS.find((x) => x.id === a.studentId);
  const student = st ? `${st.first} ${st.last}` : a.studentId;
  return {
    id: a.id, type: 'Application', label: `${a.id} · ${student}, ${c.uni.name}`, student, region: a.region || 'India',
    agency: a.rp || 'GSP test agency', rpId: a.rp ? rpByName(a.rp)?.id : 'R-TEST', uni: c.uni.name, course: c.name, intake: a.intake,
    officer: a.officer, status: statusText(a), stage: STAGES[stageOf(a)], since: a.since, ...(WAITING[a.id] || {}),
  };
});


export const RECORDS = [
  ...APP_RECORDS,
  { id: 'rp-legal', type: 'RP', label: 'The Legal Immigration (18060)', region: 'India', agency: 'The Legal Immigration', owner: 'u-ramandeep-kaur' },
  { id: 'rp-tutee', type: 'RP', label: 'Tutee Connect', region: 'Bangladesh', agency: 'Tutee Connect', owner: 'u-sania-shanta' },
  { id: 'rp-visaterminal', type: 'RP', label: 'The Visa Terminal', region: 'Nepal', agency: 'The Visa Terminal', owner: 'u-anil-shrestha' },
  { id: 'rp-isv', type: 'RP', label: 'ISV Overseas', region: 'India', agency: 'ISV Overseas', owner: 'u-mayank-kansal' },
  { id: 'rp-pathway', type: 'RP', label: 'Pathway To Aus', region: 'Philippines', agency: 'Pathway To Aus', owner: 'u-arielle-sevilleno' },
  { id: 'ip-griffith', type: 'Institution partner', label: 'Griffith University (agreement ended 30 Jun 2026)', owner: 'u-catherine-wilson' },
  { id: 'ip-cqu', type: 'Institution partner', label: 'CQUniversity (agreement ended 30 Sep 2026)', owner: 'u-kevin-mcewan' },
  { id: 'ip-vu', type: 'Institution partner', label: 'Victoria University (ends 31 Dec 2026)', owner: 'u-namita-nath' },
  { id: 'ip-newcastle', type: 'Institution partner', label: 'University of Newcastle (ends 31 Dec 2026)', owner: 'u-lalaine-dizon' },
  { id: 'ip-une', type: 'Institution partner', label: 'University of New England (ends 3 Dec 2026)', owner: 'u-matt-beazley' },
  { id: 'uni-jcub', type: 'University', label: 'James Cook University Brisbane', owner: 'u-catherine-wilson' },
  { id: 'c-murdoch-it', type: 'Course', label: 'Bachelor of Information Technology · Murdoch University (2027 fees)' },
  { id: 'c-flinders-nursing', type: 'Course', label: 'Bachelor of Nursing · Flinders University (draft)' },
  { id: 'c-torrens-mba', type: 'Course', label: 'Master of Business Administration · Torrens University (intakes)' },
  { id: 'an-113', type: 'Announcement', label: 'AN-113 Coventry: tuition deposit lowered to GBP 3,000' },
  { id: 'cm-legal', type: 'Commission', label: 'Commission terms · The Legal Immigration' },
  { id: 'cm-uk-promo', type: 'Commission', label: 'Notice N01 · UK Promotion (bands changed)' },
  { id: 'cm-jcub', type: 'Commission', label: 'Exception · JCUB degree rate missing' },
  { id: 'cm-payout', type: 'Commission', label: 'Payout run · this pay day' },
  { id: 'mail-1', type: 'Email', label: 'admissions.india@ · “Offer letter – Student ID 4471209”', region: 'India' },
  { id: 'mail-2', type: 'Email', label: 'admissions.bangladesh@ · “Re: deposit receipt”', region: 'Bangladesh' },
  // Admin's own (proposal S4-28): a setting, opened in GSP · Admin
  { id: 'set-fx', type: 'Setting', label: 'Currency exchange', page: 'currency' },
  { id: 'set-routing', type: 'Setting', label: 'Application routing', page: 'routing' },
  { id: 'set-nationality', type: 'Setting', label: 'Sales regions › Nationality', page: 'regions' },
  { id: 'set-jobs', type: 'Setting', label: 'Daily jobs', page: 'work-mail' },
  { id: 'set-docs', type: 'Setting', label: 'Document configuration', page: 'documents' },
];

/*
 * Open tasks, as the task rules would have made them: the non-application ones (application tasks come from the
 * rules in work/engine.ts, from the applications as they are now). The assignee is left to the rule's or queue's
 * sharing when the store starts: no task is ever unassigned (S4-2).
 */
const t = (id, rule, kind, record, queue, created, extra = {}) => ({ id, rule, kind, record, queue, assignee: null, created, status: 'open', ...extra });
export const TASKS = [
  ...SAMPLE.tasks.filter((x) => x.kind === 'k-uni-mail').map((x) => ({ ...x, rule: 'T6', record: OLD_ID[x.record] ?? x.record, assignee: null, created: ago(x.createdDays) })),
  t('T-1009', 'T32', 'k-rp-verify', 'rp-legal', 'q-rp-ops', ago(3)),
  t('T-1010', 'T32', 'k-rp-verify', 'rp-tutee', 'q-rp-ops', ago(2)),
  t('T-1030', 'RPA', 'k-rp-verify', 'rp-isv', 'q-rp-ops', ago(0, 4)),
  t('T-1031', 'T58', 'k-rp-train', 'rp-pathway', 'q-rp-ops', ago(1)),
  t('T-1032', 'T59', 'k-rp-notice', 'rp-visaterminal', 'q-rp-ops', ago(4)),
  t('T-1033', 'T34', 'k-rp-change', 'rp-visaterminal', 'q-rp-ops', ago(11)),
  t('T-1011', 'T37', 'k-rp-change', 'rp-isv', 'q-rec-india', ago(5)),
  t('T-1034', 'W23', 'k-rp-change', 'rp-tutee', 'q-rec-bangladesh', ago(0, 6)),
  t('T-1035', 'T33', 'k-rp-change', 'rp-pathway', 'q-rec-philippines', ago(3)),
  t('T-1012', 'T38', 'k-renew', 'ip-griffith', 'q-institution', ago(122)),
  t('T-1013', 'T38', 'k-renew', 'ip-cqu', 'q-institution', ago(91)),
  t('T-1014', 'T38', 'k-renew', 'ip-vu', 'q-institution', ago(1)),
  t('T-1026', 'T38', 'k-renew', 'ip-newcastle', 'q-institution', ago(1)),
  t('T-1027', 'T38', 'k-renew', 'ip-une', 'q-institution', ago(30)),
  t('T-1015', 'T40', 'k-golive', 'uni-jcub', 'q-institution', ago(6)),
  t('T-1016', 'T41', 'k-course', 'c-flinders-nursing', 'q-inst-ops', ago(9)),
  t('T-1017', 'T43', 'k-course', 'c-murdoch-it', 'q-inst-ops', ago(4)),
  t('T-1018', 'T42', 'k-course', 'c-torrens-mba', 'q-inst-ops', ago(2)),
  t('T-1019', 'T31', 'k-announce', 'an-113', 'q-adm-global', ago(0, 8)),
  t('T-1020', 'T39', 'k-terms', 'cm-legal', 'q-finance', ago(3)),
  t('T-1021', 'T45', 'k-check', 'cm-uk-promo', 'q-finance', ago(0, 7), { maker: 'u-suman1-verma' }),
  t('T-1028', 'T48', 'k-exception', 'cm-jcub', 'q-finance', ago(1)),
  t('T-1022', 'T49', 'k-payout', 'cm-payout', 'q-finance', ago(0, 2)),
  t('T-1023', 'T27', 'k-mail', 'mail-1', 'q-adm-global', ago(0, 9)),
  t('T-1024', 'T27', 'k-mail', 'mail-2', 'q-adm-global', ago(1, 2)),
  t('T-1040', 'T60', 'k-admin', 'set-fx', 'q-admin', ago(0, 5), { title: 'Add an exchange rate for NPR from 1 Nov 2026' }),
  t('T-1041', 'T61', 'k-admin', 'set-routing', 'q-admin', ago(1), { title: 'Add a routing rule: Lwazi Dube from South Africa wasn’t routed' }),
  t('T-1042', 'T62', 'k-admin', 'set-nationality', 'q-admin', ago(2), { title: 'Map Mongolian to a sales region' }),
  t('T-1043', 'T65', 'k-admin', 'set-jobs', 'q-admin', ago(0, 3), { title: 'Daily job J3 Date rules failed on 2 Nov 2026' }),
  t('T-1044', 'T68', 'k-admin', 'set-docs', 'q-admin', ago(4), { title: 'Add document rules for Diploma / Ireland' }),
];
