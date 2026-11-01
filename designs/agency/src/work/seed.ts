// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * Demo data for the add-ons. Names, IDs and records match the designer's
 * prototype so both tell one story. Records marked `addon: true` exist only
 * here (to show other regions); they are not in his prototype yet.
 * In the real build all of this comes from the server.
 */

import { STAFF, label } from '../data/staff';

const DAY = 864e5;
export const ago = (d, h = 0) => Date.now() - d * DAY - h * 36e5;

export const REGIONS = [
  'India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Vietnam', 'Pakistan',
  'Indonesia, Malaysia and Thailand', 'Myanmar', 'Bhutan', 'Australia',
  'Philippines', 'Africa', 'Latin America and Europe', 'China',
  'Rest of world', 'Direct',
];

/* Working week per region, for SLA clocks. 1 = Monday … 6 = Saturday, 0 = Sunday. */
export const CALENDARS = [
  // Jovial, 1 Nov (Queue assignment A17): everyone works Monday to Friday, except Bangladesh, Sunday to Thursday.
  // Working hours 9:30 to 18:30 local: SLAs in hours count only these.
  { id: 'cal-mon-fri', name: 'Monday to Friday', days: [1, 2, 3, 4, 5], hours: '9:30 to 18:30', regions: ['India', 'Nepal', 'Sri Lanka', 'Pakistan', 'Vietnam', 'Indonesia, Malaysia and Thailand', 'Myanmar', 'Bhutan', 'Australia', 'Philippines', 'Africa', 'Latin America and Europe', 'China', 'Rest of world', 'Direct', 'Global'],
    holidays: [['2026-11-08', 'Diwali'], ['2026-12-25', 'Christmas'], ['2027-01-01', 'New Year’s Day']] },
  { id: 'cal-sun-thu', name: 'Sunday to Thursday', days: [0, 1, 2, 3, 4], hours: '9:30 to 18:30', regions: ['Bangladesh'],
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
};

/* Kinds of work: what can land in a queue, with its default SLA in working hours (a working day is 9). */
export const KINDS = [
  { id: 'k-verify', name: 'Verify application documents', record: 'Application', sla: 9 },
  { id: 'k-submit', name: 'Submit to the university', record: 'Application', sla: 9 },
  { id: 'k-chase-uni', name: 'Chase the university', record: 'Application', sla: 18 },
  { id: 'k-uni-mail', name: 'File a university email', record: 'Application', sla: 9 },
  { id: 'k-gsp-check', name: 'GSP check (finance and background)', record: 'Application', sla: 18 },
  { id: 'k-payment', name: 'Check payment proof', record: 'Application', sla: 9 },
  { id: 'k-enrol', name: 'Confirm enrolment', record: 'Application', sla: 63 },
  { id: 'k-qc', name: 'Quality check before submission', record: 'Application', sla: 9 },
  { id: 'k-rp-verify', name: 'Verify a new RP', record: 'RP', sla: 18 },
  { id: 'k-rp-change', name: 'RP lifecycle change', record: 'RP', sla: 27 },
  { id: 'k-renew', name: 'Renew an agreement', record: 'Institution partner', sla: 270 },
  { id: 'k-golive', name: 'Get a university live', record: 'University', sla: 126 },
  { id: 'k-course', name: 'Course data update', record: 'Course', sla: 45 },
  { id: 'k-announce', name: 'Publish an announcement or review a newsletter', record: 'Announcement', sla: 9 },
  { id: 'k-terms', name: 'Enter commission terms', record: 'Commission', sla: 18 },
  { id: 'k-check', name: 'Check a change (maker-checker)', record: 'Commission', sla: 9 },
  { id: 'k-exception', name: 'Commission exception', record: 'Commission', sla: 18 },
  { id: 'k-payout', name: 'Thursday payout run', record: 'Commission', sla: 9 },
  { id: 'k-mail', name: 'Match an unmatched email', record: 'Email', sla: 9 },
  { id: 'k-escalation', name: 'SLA escalation', record: 'Any', sla: 9 },
];

const inRegion = (region) => STAFF.filter((s) => s.role === 'Admission' && s.regions.includes(region)).map((s) => s.id);
const withRole = (role) => STAFF.filter((s) => s.role === role).map((s) => s.id);
const SEA = ['Vietnam', 'Indonesia, Malaysia and Thailand', 'Myanmar', 'Bhutan'];
/** The Admissions queue an application's region goes to (Jovial's sheet, 31 Oct). */
export const regionQueueId = (region) => (SEA.includes(region) ? 'q-adm-sea' : region === 'Rest of world' || region === 'Direct' ? 'q-adm-global' : 'q-adm-' + String(region || '').toLowerCase().replace(/\W+/g, '-'));
const regionalQueue = (region, leader, members = inRegion(region).filter((id) => id !== leader), extra = {}) => ({
  id: 'q-adm-' + region.toLowerCase().replace(/\W+/g, '-'),
  name: region + ' Admissions', kind: 'region', region, leader, members,
  assign: 'fewest-open', cover: 'leader', sla: 9, handover: null,
  kinds: ['k-verify', 'k-submit', 'k-chase-uni', 'k-uni-mail', 'k-gsp-check', 'k-payment', 'k-enrol'],
  ...extra,
});

export const QUEUES = [
  // Jovial, 1 Nov (A2): no handover by stage for now; officers move applications between themselves
  regionalQueue('India', 'u-ramish-jafery'),
  regionalQueue('Bangladesh', 'u-kamrun-nahar'),
  regionalQueue('Pakistan', 'u-sabrina-hyder'),
  regionalQueue('Africa', 'u-kamrun-nahar'),
  regionalQueue('Nepal', 'u-supriya-shrestha'),
  regionalQueue('Sri Lanka', 'u-subodya-suraweera'),
  // Jovial's Queues tab (31 Oct): South-East Asia is one queue; Rest of world and Direct share Global Admissions
  { ...regionalQueue('SEA', 'u-truc-nguyen', [...new Set(SEA.flatMap(inRegion))].filter((id) => id !== 'u-truc-nguyen')), name: 'SEA Admissions', regions: SEA, assign: 'round-robin' },
  regionalQueue('Philippines', 'u-kimberly-olaes'),
  regionalQueue('Australia', 'u-jo-qiu'),
  regionalQueue('China', 'u-jo-qiu'),
  regionalQueue('Latin America and Europe', 'u-valentina-castillo'),
  { ...regionalQueue('Global', 'u-tasha-tandon', withRole('Admission Ops').filter((id) => id !== 'u-tasha-tandon')), name: 'Global Admissions', regions: ['Rest of world', 'Direct'] },
  { id: 'q-rp-ops', name: 'Recruitment Ops', kind: 'team', leader: 'u-garima-bhardwaj', members: withRole('Recruitment Ops').filter((id) => id !== 'u-garima-bhardwaj'), assign: 'round-robin', cover: 'leader', sla: 18, kinds: ['k-rp-verify', 'k-rp-change'] },
  { id: 'q-institution', name: 'Institution', kind: 'team', leader: 'u-matt-beazley', members: withRole('Institution').filter((id) => id !== 'u-matt-beazley'), assign: 'record-owner', cover: 'leader', sla: 45, kinds: ['k-renew', 'k-golive'] },
  { id: 'q-inst-ops', name: 'Institution Ops', kind: 'team', leader: 'u-gauri-bhardwaj', members: withRole('Institution Ops').filter((id) => id !== 'u-gauri-bhardwaj'), assign: 'round-robin', cover: 'queue', sla: 45, kinds: ['k-course'] },
  { id: 'q-adm-ops', name: 'Admission Ops', kind: 'team', leader: 'u-tasha-tandon', members: withRole('Admission Ops').filter((id) => id !== 'u-tasha-tandon'), assign: 'leader-assigns', cover: 'leader', sla: 9, kinds: ['k-qc', 'k-announce', 'k-escalation', 'k-mail'] },
  { id: 'q-finance', name: 'Finance', kind: 'team', leader: 'u-suman1-verma', members: withRole('Finance').filter((id) => id !== 'u-suman1-verma'), assign: 'members-pick', cover: 'queue', sla: 18, makerChecker: true, kinds: ['k-terms', 'k-check', 'k-exception', 'k-payout'] },
  { id: 'q-fallback', name: 'Fallback', kind: 'team', leader: 'u-jovial-lejo', members: [], assign: 'leader-assigns', cover: 'leader', sla: 9, kinds: [] },
];

/* SLA per application status, in working hours (Jovial's Task triggers sheet, 1 Nov; a working day is 9 hours). */
export const STATUS_SLA = [
  { stage: 'Pre-screening', status: 'Pending verification', owner: 'GSP', days: 1 },
  { stage: 'Pre-screening', status: 'Document re-upload pending', owner: 'RP', days: 6 },
  { stage: 'Application', status: 'Ready to submit', owner: 'GSP', days: 1 },
  { stage: 'Application', status: 'Submitted to university', owner: 'University', days: 18 },
  { stage: 'Application', status: 'Additional documents requested', owner: 'RP', days: 12 },
  { stage: 'Application', status: 'Verifying additional documents', owner: 'GSP', days: 9 },
  { stage: 'Offer', status: 'Conditional offer received, conditions pending', owner: 'RP', days: 12 },
  { stage: 'Offer', status: 'Conditions submitted to university', owner: 'University', days: 18 },
  { stage: 'Verification', status: 'Finance and background check', owner: 'GSP', days: 12 },
  { stage: 'Verification', status: 'University assessment or interview', owner: 'Student', days: 9 },
  { stage: 'Verification', status: 'Unconditional offer letter received', owner: 'GSP', days: 4 },
  { stage: 'Acceptance', status: 'Tuition or deposit pending', owner: 'RP', days: 18 },
  { stage: 'Acceptance', status: 'Payment proof under review', owner: 'GSP', days: 4 },
  { stage: 'Acceptance', status: 'Awaiting acceptance letter from university', owner: 'University', days: 27 },
  { stage: 'Acceptance', status: 'Acceptance letter received', owner: 'GSP', days: 9 },
  { stage: 'Visa', status: 'Visa lodgement pending', owner: 'RP', days: 63 },
  { stage: 'Visa', status: 'Visa decision pending', owner: 'Government', days: 252 },
  { stage: 'Visa', status: 'Visa granted: waiting for start date', owner: 'GSP', days: 45 },
  { stage: 'Enrolment', status: 'Enrolment confirmation pending', owner: 'GSP', days: 27 },
];

export const ESCALATION = { remindBefore: 1, leaderAtDue: true, opsAfter: 2, adminAfter: 5, digestTime: '08:30' };

/* Task rules (Jovial's Task triggers sheet, 1 Nov): trigger, task, where it goes, SLA in working hours (a working day
   is 9 hours), when it closes. Statuses never move by themselves; these only create tasks. The application rules
   run in work/engine.ts. `row` is the sheet's row. */
export const RULES = [
  { id: 'r1', row: 'T1', on: true, name: 'Documents to verify', record: 'Application', when: 'Status becomes Pending verification (the RP sent the application)', task: 'Verify the documents for [record]', to: 'region', who: 'owner', kind: 'k-verify', sla: 1, closes: 'The officer changes the status' },
  { id: 'r2', row: 'T2', on: true, name: 'Re-upload late', record: 'Application', when: 'Document re-upload pending for 48 working hours (the RP is reminded at 24)', task: 'Chase the RP: re-upload for [record] is late', to: 'region', who: 'owner', kind: 'k-verify', sla: 6, closes: 'The RP re-uploads, or the status changes' },
  { id: 'r3', row: 'T3', on: true, name: 'Quality check', record: 'Application', when: 'Status becomes Ready to submit', task: 'Quality-check [record] before submission', to: 'q-adm-ops', who: 'leader-assigns', kind: 'k-qc', sla: 1, closes: 'The officer changes the status' },
  { id: 'r4', row: 'T4', on: true, name: 'Ready to submit', record: 'Application', when: 'Status becomes Ready to submit', task: 'Submit [record] to the university', to: 'region', who: 'owner', kind: 'k-submit', sla: 1, closes: 'A university reference is added, or the status changes' },
  { id: 'r5', row: 'T5', on: true, name: 'No decision from the university', record: 'Application', when: 'Submitted to university for 2 working days', task: 'Chase the university for [record]', to: 'region', who: 'owner', kind: 'k-chase-uni', sla: 12, closes: 'The officer closes it, or the status changes' },
  { id: 'r6', row: 'T6', on: true, name: 'University email on an application', record: 'Email', when: 'An email is matched to an application (90% or more)', task: 'Act on the email for [record]', to: 'region', who: 'owner', kind: 'k-uni-mail', sla: 1, closes: 'The officer files or dismisses the email' },
  { id: 'r7', row: 'T7', on: true, name: 'Additional documents late', record: 'Application', when: 'Additional documents requested for 12 working hours (the RP is reminded at 6)', task: 'Chase the RP: additional documents for [record]', to: 'region', who: 'owner', kind: 'k-chase-uni', sla: 12, closes: 'The RP uploads, or the status changes' },
  { id: 'r8', row: 'T9', on: true, name: 'Conditions to send', record: 'Application', when: 'Status becomes Conditional offer received and the conditions weren’t sent with it', task: 'Send the offer and its conditions to the RP for [record]', to: 'region', who: 'owner', kind: 'k-uni-mail', sla: 12, closes: 'The conditions are sent to the RP' },
  { id: 'r9', row: 'T9', on: true, name: 'Conditions late', record: 'Application', when: 'Conditions sent to the RP 12 working hours ago (reminded at 6)', task: 'Chase the RP: offer conditions for [record]', to: 'region', who: 'owner', kind: 'k-uni-mail', sla: 12, closes: 'The status changes' },
  { id: 'r10', row: 'T10', on: true, name: 'No answer on conditions', record: 'Application', when: 'Conditions submitted to university for 2 working days', task: 'Chase the university about the conditions for [record]', to: 'region', who: 'owner', kind: 'k-chase-uni', sla: 12, closes: 'The officer closes it, or the status changes' },
  { id: 'r11', row: 'T11', on: true, name: 'GSP check', record: 'Application', when: 'Status becomes Finance and background check', task: 'Do the GSP check for [record]', to: 'region', who: 'owner', kind: 'k-gsp-check', sla: 12, closes: 'The officer closes it, or the status changes' },
  { id: 'r12', row: 'T12', on: true, name: 'Interview or GS', record: 'Email', when: 'An email asks for an interview or GS assessment', task: 'Book the interview for [record]', to: 'region', who: 'owner', kind: 'k-uni-mail', sla: 9, closes: 'Interview booked' },
  { id: 'r13', row: 'T13', on: true, name: 'Unconditional offer', record: 'Application', when: 'Status becomes Unconditional offer letter received', task: 'Send the offer to the RP and ask for the deposit for [record]', to: 'region', who: 'owner', kind: 'k-uni-mail', sla: 4, closes: 'Status moves to Tuition or deposit pending' },
  { id: 'r14', row: 'T14', on: true, name: 'Deposit not paid', record: 'Application', when: 'Tuition or deposit pending for 2 working days (the RP is reminded at 1)', task: 'Chase the RP: deposit for [record]', to: 'region', who: 'owner', kind: 'k-payment', sla: 12, closes: 'Payment proof uploaded, or the status changes' },
  { id: 'r15', row: 'T15', on: true, name: 'Payment proof to check', record: 'Application', when: 'Status becomes Payment proof under review', task: 'Check the payment proof for [record]', to: 'region', who: 'owner', kind: 'k-payment', sla: 4, closes: 'The officer changes the status' },
  { id: 'r16', row: 'T16', on: true, name: 'Acceptance letter late', record: 'Application', when: 'Awaiting acceptance letter for 3 working days', task: 'Chase the university for the acceptance letter for [record]', to: 'region', who: 'owner', kind: 'k-chase-uni', sla: 12, closes: 'The officer closes it, or the status changes' },
  { id: 'r17', row: 'T17', on: true, name: 'Visa not lodged', record: 'Application', when: 'Visa lodgement pending for 7 working days, the RP lodging (reminded at 5)', task: 'Chase the RP: visa for [record]', to: 'region', who: 'owner', kind: 'k-chase-uni', sla: 12, closes: 'Lodgement proof uploaded, or the status changes' },
  { id: 'r18', row: 'WH7', on: true, name: 'GSP lodges the visa', record: 'Application', when: 'Status becomes Visa lodgement pending, GSP lodging', task: 'Lodge the student visa for [record]', to: 'region', who: 'owner', kind: 'k-submit', sla: 63, closes: 'Status moves to Visa decision pending' },
  { id: 'r19', row: 'T19', on: true, name: 'Late intake', record: 'Application', when: 'Pending verification or Ready to submit, for an intake past its deadline (up to 2 weeks)', task: 'Check the university still accepts [record]', to: 'region', who: 'owner', kind: 'k-chase-uni', sla: 12, closes: 'The officer records go ahead, moves the intake, or closes' },
  { id: 'r20', row: 'T20', on: true, name: 'Enrolment to confirm', record: 'Application', when: 'Status becomes Enrolment confirmation pending', task: 'Confirm enrolment for [record]', to: 'region', who: 'owner', kind: 'k-enrol', sla: 27, closes: 'Status moves to Student enrolled' },
  { id: 'r21', row: 'WH5', on: true, name: 'Documents from the RP to check', record: 'Application', when: 'The RP sent documents GSP hasn’t checked (any status but Pending verification and Payment proof under review)', task: 'Check the documents the RP sent for [record]', to: 'region', who: 'owner', kind: 'k-verify', sla: 1, closes: 'Every document verified or sent back' },
  { id: 'r22', row: 'T26', on: true, name: 'Check an email match', record: 'Email', when: 'AI confidence 60 to 89%', task: 'Check the match for this email', to: 'region', who: 'owner', kind: 'k-mail', sla: 1, closes: 'Match confirmed or changed' },
  { id: 'r23', row: 'T27', on: true, name: 'Email not matched', record: 'Email', when: 'AI confidence below 60%', task: 'Match this email to a record', to: 'q-adm-ops', who: 'members-pick', kind: 'k-mail', sla: 1, closes: 'Matched or marked not needed' },
  { id: 'r24', row: 'T28', on: true, name: 'New application by email', record: 'Email', when: 'An RP sends a new application by email', task: 'Create the application, or send the RP to the portal', to: 'q-adm-ops', who: 'members-pick', kind: 'k-verify', sla: 3, closes: 'Closed by hand once done' },
  { id: 'r25', row: 'T29', on: true, name: 'Mail to admin.gsp@', record: 'Email', when: 'Any email to admin.gsp@', task: 'Handle this request', to: 'q-rp-ops', who: 'members-pick', kind: 'k-rp-change', sla: 24, closes: 'Closed by hand' },
  { id: 'r26', row: 'T30', on: true, name: 'Commission remittance', record: 'Email', when: 'A remittance or statement, or any mail to commissions.gsp@', task: 'Match the remittance against Commissions', to: 'q-finance', who: 'members-pick', kind: 'k-exception', sla: 24, closes: 'Matched to invoices' },
  { id: 'r27', row: 'T31', on: true, name: 'University newsletter', record: 'Email', when: 'A university newsletter arrives', task: 'Review the newsletter for an announcement', to: 'q-adm-ops', who: 'round-robin', kind: 'k-announce', sla: 6, closes: 'Announcement published or dismissed' },
  { id: 'r28', row: 'T32', on: true, name: 'New RP to verify', record: 'RP', when: 'All onboarding documents uploaded', task: 'Verify [record]', to: 'q-rp-ops', who: 'members-pick', kind: 'k-rp-verify', sla: 12, closes: 'RP verified or documents sent back' },
  { id: 'r29', row: 'T33', on: true, name: 'RP signed up, not activated', record: 'RP', when: 'Not activated for 2 working days', task: 'Help [record] finish sign-up', to: 'owner', who: 'owner', kind: 'k-rp-change', sla: 18, closes: 'RP activated' },
  { id: 'r30', row: 'T34', on: true, name: 'RP documents sent back', record: 'RP', when: 'Onboarding documents sent back 7 working days ago (the RP is reminded at 3)', task: 'Chase [record] for its documents', to: 'owner', who: 'owner', kind: 'k-rp-change', sla: 18, closes: 'Documents re-uploaded' },
  { id: 'r31', row: 'T35', on: true, name: 'New bank details', record: 'RP', when: 'The RP sends new bank details (payouts held)', task: 'Check the new bank details for [record]', to: 'q-finance', who: 'not-maker', kind: 'k-check', sla: 6, closes: 'Approved or rejected' },
  { id: 'r32', row: 'T36', on: true, name: 'RP lifecycle change', record: 'RP', when: 'The BDM requests a suspension, termination or tier change', task: 'Approve and make the change to [record]', to: 'q-rp-ops', who: 'leader-assigns', kind: 'k-rp-change', sla: 12, closes: 'Approved or rejected' },
  { id: 'r33', row: 'T37', on: true, name: 'RP inactive', record: 'RP', when: 'No new applications for 90 days', task: 'Check in with [record]', to: 'owner', who: 'owner', kind: 'k-rp-change', sla: 45, closes: 'An application is added, or the BDM notes why' },
  { id: 'r34', row: 'W23', on: true, name: 'New RP assigned', record: 'RP', when: 'A new RP is assigned to a BDM', task: 'Get in touch with [record]', to: 'owner', who: 'owner', kind: 'k-rp-change', sla: 18, closes: 'The BDM logs the first call' },
  { id: 'r35', row: 'T38', on: true, name: 'Agreement ending', record: 'Institution partner', when: '60 days before the agreement ends', task: 'Renew the agreement with [record]', to: 'q-institution', who: 'record-owner', kind: 'k-renew', sla: 270, closes: 'A new agreement is uploaded' },
  { id: 'r36', row: 'T39', on: true, name: 'Commission terms missing', record: 'Commission', when: 'An agreement is uploaded and no terms are entered', task: 'Enter commission terms for [record]', to: 'q-finance', who: 'members-pick', kind: 'k-terms', sla: 18, closes: 'Terms entered and checked' },
  { id: 'r37', row: 'T40', on: true, name: 'University not live', record: 'University', when: 'Go-live checks incomplete 14 days after it was created', task: 'Get [record] live', to: 'q-institution', who: 'record-owner', kind: 'k-golive', sla: 126, closes: 'University live' },
  { id: 'r38', row: 'T41', on: true, name: 'Draft courses', record: 'Course', when: 'A course is in draft for 7 days', task: 'Finish and publish [record]', to: 'q-inst-ops', who: 'round-robin', kind: 'k-course', sla: 45, closes: 'The course is published' },
  { id: 'r39', row: 'T42', on: true, name: 'No open intake', record: 'Course', when: 'Last intake’s deadline passed and no next intake', task: 'Add the next intake for [record]', to: 'q-inst-ops', who: 'round-robin', kind: 'k-course', sla: 45, closes: 'An intake is added' },
  { id: 'r40', row: 'T43', on: true, name: 'Next year’s fees missing', record: 'Course', when: '1 September, for courses without next year’s fees', task: 'Add next year’s fees for [record]', to: 'q-inst-ops', who: 'round-robin', kind: 'k-course', sla: 90, closes: 'Fees added' },
  { id: 'r41', row: 'T45', on: true, name: 'Change waiting for a checker', record: 'Commission', when: 'Terms, a notice or a scheme changed', task: 'Check the change to [record]', to: 'q-finance', who: 'not-maker', kind: 'k-check', sla: 9, closes: 'A different person approves or rejects it' },
  { id: 'r42', row: 'T46', on: true, name: 'University invoice due', record: 'Commission', when: 'A commission line’s trigger date passes (census or enrolment)', task: 'Raise the invoice for [record]', to: 'q-finance', who: 'members-pick', kind: 'k-exception', sla: 18, closes: 'Invoice sent' },
  { id: 'r43', row: 'T47', on: true, name: 'University payment overdue', record: 'Commission', when: 'Invoice unpaid past the university’s payment days', task: 'Chase [record]’s payment', to: 'q-finance', who: 'members-pick', kind: 'k-exception', sla: 18, closes: 'Paid' },
  { id: 'r44', row: 'T48', on: true, name: 'Short payment or unmatched remittance', record: 'Commission', when: 'Amount paid differs from the invoice', task: 'Resolve the exception on [record]', to: 'q-finance', who: 'members-pick', kind: 'k-exception', sla: 18, closes: 'Resolved' },
  { id: 'r45', row: 'T49', on: true, name: 'Payout run', record: 'Commission', when: 'Every Monday (pay on Thursday)', task: 'Prepare the payout run', to: 'q-finance', who: 'leader-assigns', kind: 'k-payout', sla: 9, closes: 'Run approved' },
  { id: 'r46', row: 'T50', on: true, name: 'Exchange rates missing', record: 'Any', when: 'Friday, no rates for next week', task: 'Enter next week’s exchange rates', to: 'q-fallback', who: 'leader-assigns', kind: 'k-escalation', sla: 9, closes: 'Rates entered' },
  { id: 'r47', row: 'T51', on: true, name: 'SLA breached', record: 'Any', when: 'A task is overdue: its queue’s leader at once, the team’s Ops queue after 2 working days, Admin after 5', task: 'Escalated: [record]', to: 'ops', who: 'leader-assigns', kind: 'k-escalation', sla: 9, closes: 'The original task is done' }
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
  { id: 'rp-visaterminal', type: 'RP', label: 'The Visa Terminal', region: 'Nepal', agency: 'The Visa Terminal', owner: 'u-ali-butt', waitingOn: 'RP', waitingFor: 'Owner’s ID, sent back', due: ago(5) },
  { id: 'rp-isv', type: 'RP', label: 'ISV Overseas', region: 'India', agency: 'ISV Overseas', owner: 'u-mayank-kansal' },
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
  { id: 'cm-payout', type: 'Commission', label: 'Payout run · Thursday' },
  { id: 'mail-1', type: 'Email', label: 'admissions.india@ · “Offer letter – Student ID 4471209”', region: 'India' },
  { id: 'mail-2', type: 'Email', label: 'admissions.bangladesh@ · “Re: deposit receipt”', region: 'Bangladesh' },
];

/* Open tasks, as task rules would have created them. */
const t = (id, rule, kind, record, queue, assignee, created, extra = {}) => ({ id, rule, kind, record, queue, assignee, created, status: 'open', ...extra });
const SEEDED = [
  t('T-1001', 'r1', 'k-verify', 'GSP-23944', 'q-adm-india', 'u-alfiya1-khan', ago(0, 20)),
  t('T-1002', 'r4', 'k-uni-mail', 'GSP-24063', 'q-adm-india', 'u-ramish-jafery', ago(0, 3), { note: 'CAS arrived from Coventry by mail. Add it to Documents and move to Visa.' }),
  t('T-1003', 'r3', 'k-chase-uni', 'GSP-24097', 'q-adm-india', 'u-alfiya1-khan', ago(3)),
  t('T-1004', 'r7', 'k-qc', 'GSP-23944', 'q-adm-ops', null, ago(0, 5)),
  ...SAMPLE.tasks.map(x => ({ ...x, record: OLD_ID[x.record] ?? x.record, created: ago(x.createdDays) })),
  t('T-1009', 'r8', 'k-rp-verify', 'rp-legal', 'q-rp-ops', 'u-kartik-sharma', ago(3)),
  t('T-1010', 'r8', 'k-rp-verify', 'rp-tutee', 'q-rp-ops', null, ago(2)),
  t('T-1011', 'r9', 'k-rp-change', 'rp-isv', null, 'u-mayank-kansal', ago(5)),
  t('T-1012', 'r10', 'k-renew', 'ip-griffith', 'q-institution', 'u-catherine-wilson', ago(122)),
  t('T-1013', 'r10', 'k-renew', 'ip-cqu', 'q-institution', 'u-kevin-mcewan', ago(91)),
  t('T-1014', 'r10', 'k-renew', 'ip-vu', 'q-institution', 'u-namita-nath', ago(1)),
  t('T-1026', 'r10', 'k-renew', 'ip-newcastle', 'q-institution', 'u-lalaine-dizon', ago(1)),
  t('T-1027', 'r10', 'k-renew', 'ip-une', 'q-institution', 'u-matt-beazley', ago(30)),
  t('T-1015', null, 'k-golive', 'uni-jcub', 'q-institution', 'u-catherine-wilson', ago(6)),
  t('T-1016', 'r11', 'k-course', 'c-flinders-nursing', 'q-inst-ops', null, ago(9)),
  t('T-1017', null, 'k-course', 'c-murdoch-it', 'q-inst-ops', 'u-munmun-kapil', ago(4)),
  t('T-1018', null, 'k-course', 'c-torrens-mba', 'q-inst-ops', 'u-neelam-sharma', ago(2)),
  t('T-1019', null, 'k-announce', 'an-113', 'q-adm-ops', 'u-rajinder-kaur', ago(0, 8)),
  t('T-1020', 'r12', 'k-terms', 'cm-legal', 'q-finance', null, ago(3)),
  t('T-1021', 'r13', 'k-check', 'cm-uk-promo', 'q-finance', null, ago(0, 7), { maker: 'u-suman1-verma' }),
  t('T-1028', null, 'k-exception', 'cm-jcub', 'q-finance', 'u-suman1-verma', ago(1)),
  t('T-1022', null, 'k-payout', 'cm-payout', 'q-finance', 'u-suman1-verma', ago(0, 2)),
  t('T-1023', 'r14', 'k-mail', 'mail-1', 'q-adm-ops', null, ago(0, 9)),
  t('T-1024', 'r14', 'k-mail', 'mail-2', 'q-adm-ops', 'u-ashu-rajpal', ago(1, 2)),
  t('T-1025', 'r15', 'k-escalation', 'GSP-24097', 'q-adm-ops', 'u-tasha-tandon', ago(1), { note: 'Chase on Wollongong is overdue.' }),
];

/* Application tasks come from the rules (work/engine.ts) and follow the status; only those raised from mail stay here. */
export const TASKS = SEEDED.filter((x) => !String(x.record).startsWith('GSP-') || x.kind === 'k-uni-mail');

/* Who is "watching" what, for the Watching tab. */
export const WATCHING = { 'u-jovial-lejo': ['T-1012', 'T-1021', 'T-1022'], 'u-tasha-tandon': ['T-1003'], 'u-myleeta-williams': ['T-1012', 'T-1022', 'T-1003'] };
