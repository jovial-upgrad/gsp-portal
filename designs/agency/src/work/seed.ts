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
  'Indonesia, Malaysia and Thailand', 'Myanmar and Bhutan', 'Australia',
  'Philippines', 'Africa', 'Latin America and Europe', 'China',
  'Rest of world', 'Direct',
];

/* Working week per region, for SLA clocks. 1 = Monday … 6 = Saturday, 0 = Sunday. */
export const CALENDARS = [
  { id: 'cal-mon-sat', name: 'Monday to Saturday', days: [1, 2, 3, 4, 5, 6], regions: ['India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Pakistan'],
    holidays: [['2026-11-08', 'Diwali'], ['2026-12-25', 'Christmas']] },
  { id: 'cal-mon-fri', name: 'Monday to Friday', days: [1, 2, 3, 4, 5], regions: ['Vietnam', 'Indonesia, Malaysia and Thailand', 'Myanmar and Bhutan', 'Australia', 'Philippines', 'Africa', 'Latin America and Europe', 'China', 'Rest of world', 'Direct', 'Global'],
    holidays: [['2026-12-25', 'Christmas'], ['2027-01-01', 'New Year’s Day']] },
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

/* Kinds of work: what can land in a queue, with its default SLA in working days. */
export const KINDS = [
  { id: 'k-verify', name: 'Verify application documents', record: 'Application', sla: 1 },
  { id: 'k-submit', name: 'Submit to the university', record: 'Application', sla: 1 },
  { id: 'k-chase-uni', name: 'Chase the university', record: 'Application', sla: 2 },
  { id: 'k-uni-mail', name: 'File a university email', record: 'Application', sla: 1 },
  { id: 'k-gsp-check', name: 'GSP check (finance and background)', record: 'Application', sla: 2 },
  { id: 'k-payment', name: 'Check payment proof', record: 'Application', sla: 1 },
  { id: 'k-enrol', name: 'Confirm enrolment', record: 'Application', sla: 7 },
  { id: 'k-qc', name: 'Quality check before submission', record: 'Application', sla: 1 },
  { id: 'k-rp-verify', name: 'Verify a new RP', record: 'RP', sla: 2 },
  { id: 'k-rp-change', name: 'RP lifecycle change', record: 'RP', sla: 3 },
  { id: 'k-renew', name: 'Renew an agreement', record: 'Institution partner', sla: 30 },
  { id: 'k-golive', name: 'Get a university live', record: 'University', sla: 14 },
  { id: 'k-course', name: 'Course data update', record: 'Course', sla: 5 },
  { id: 'k-announce', name: 'Publish an announcement', record: 'Announcement', sla: 1 },
  { id: 'k-terms', name: 'Enter commission terms', record: 'Commission', sla: 2 },
  { id: 'k-check', name: 'Check a change (maker-checker)', record: 'Commission', sla: 1 },
  { id: 'k-exception', name: 'Commission exception', record: 'Commission', sla: 2 },
  { id: 'k-payout', name: 'Thursday payout run', record: 'Commission', sla: 1 },
  { id: 'k-mail', name: 'Match an unmatched email', record: 'Email', sla: 1 },
  { id: 'k-escalation', name: 'SLA escalation', record: 'Any', sla: 1 },
];

const inRegion = (region) => STAFF.filter((s) => s.role === 'Admission' && s.regions.includes(region)).map((s) => s.id);
const withRole = (role) => STAFF.filter((s) => s.role === role).map((s) => s.id);
const regionalQueue = (region, leader, members = inRegion(region).filter((id) => id !== leader), extra = {}) => ({
  id: 'q-adm-' + region.toLowerCase().replace(/\W+/g, '-'),
  name: region + ' Admissions', kind: 'region', region, leader, members,
  assign: 'round-robin', cover: 'leader', sla: 1, handover: null,
  kinds: ['k-verify', 'k-submit', 'k-chase-uni', 'k-uni-mail', 'k-gsp-check', 'k-payment', 'k-enrol'],
  ...extra,
});

export const QUEUES = [
  regionalQueue('India', 'u-ramish-jafery', undefined, {
    handover: [{ from: 'New', to: 'Offer', people: ['u-alfiya1-khan'] }, { from: 'Verification', to: 'Enrolment', people: ['u-ramish-jafery'] }],
  }),
  regionalQueue('Bangladesh', 'u-kamrun-nahar'),
  regionalQueue('Pakistan', 'u-sabrina-hyder'),
  regionalQueue('Africa', 'u-kamrun-nahar'),
  regionalQueue('Nepal', 'u-supriya-shrestha'),
  regionalQueue('Sri Lanka', 'u-subodya-suraweera'),
  regionalQueue('Vietnam', 'u-truc-nguyen'),
  regionalQueue('Philippines', 'u-truc-nguyen'),
  regionalQueue('Myanmar and Bhutan', 'u-truc-nguyen'),
  regionalQueue('Indonesia, Malaysia and Thailand', 'u-truc-nguyen'),
  regionalQueue('Australia', 'u-jo-qiu'),
  regionalQueue('China', 'u-jo-qiu'),
  regionalQueue('Latin America and Europe', 'u-valentina-castillo'),
  regionalQueue('Rest of world', 'u-tasha-tandon'),
  regionalQueue('Direct', 'u-tasha-tandon'),
  { id: 'q-rp-ops', name: 'Recruitment Ops', kind: 'team', leader: 'u-garima-bhardwaj', members: withRole('Recruitment Ops').filter((id) => id !== 'u-garima-bhardwaj'), assign: 'round-robin', cover: 'leader', sla: 2, kinds: ['k-rp-verify', 'k-rp-change'] },
  { id: 'q-institution', name: 'Institution', kind: 'team', leader: 'u-matt-beazley', members: withRole('Institution').filter((id) => id !== 'u-matt-beazley'), assign: 'record-owner', cover: 'leader', sla: 5, kinds: ['k-renew', 'k-golive'] },
  { id: 'q-inst-ops', name: 'Institution Ops', kind: 'team', leader: 'u-gauri-bhardwaj', members: withRole('Institution Ops').filter((id) => id !== 'u-gauri-bhardwaj'), assign: 'round-robin', cover: 'queue', sla: 5, kinds: ['k-course'] },
  { id: 'q-adm-ops', name: 'Admission Ops', kind: 'team', leader: 'u-tasha-tandon', members: withRole('Admission Ops').filter((id) => id !== 'u-tasha-tandon'), assign: 'leader-assigns', cover: 'leader', sla: 1, kinds: ['k-qc', 'k-announce', 'k-escalation'] },
  { id: 'q-finance', name: 'Finance', kind: 'team', leader: 'u-suman1-verma', members: withRole('Finance').filter((id) => id !== 'u-suman1-verma'), assign: 'members-pick', cover: 'queue', sla: 2, makerChecker: true, kinds: ['k-terms', 'k-check', 'k-exception', 'k-payout'] },
  { id: 'q-mail', name: 'Unmatched mail', kind: 'team', leader: 'u-tasha-tandon', members: ['u-ashu-rajpal'], assign: 'members-pick', cover: 'leader', sla: 1, kinds: ['k-mail'] },
  { id: 'q-fallback', name: 'Fallback', kind: 'team', leader: 'u-jovial-lejo', members: [], assign: 'leader-assigns', cover: 'leader', sla: 1, kinds: [] },
];

/* SLA per application status (working days). Taken from the designer's "usual" days. */
export const STATUS_SLA = [
  { stage: 'Pre-screening', status: 'Pending verification', owner: 'GSP', days: 1 },
  { stage: 'Pre-screening', status: 'Document re-upload pending', owner: 'RP', days: 3 },
  { stage: 'Application', status: 'Ready to submit', owner: 'GSP', days: 1 },
  { stage: 'Application', status: 'Submitted to university', owner: 'University', days: 14 },
  { stage: 'Application', status: 'Additional documents requested', owner: 'RP', days: 3 },
  { stage: 'Application', status: 'Verifying additional documents', owner: 'GSP', days: 1 },
  { stage: 'Offer', status: 'Conditional offer received, conditions pending', owner: 'RP', days: 7 },
  { stage: 'Offer', status: 'Conditions submitted to university', owner: 'University', days: 5 },
  { stage: 'Verification', status: 'Finance and background check', owner: 'GSP', days: 2 },
  { stage: 'Verification', status: 'University assessment or interview', owner: 'Student', days: 7 },
  { stage: 'Verification', status: 'Unconditional offer letter received', owner: 'GSP', days: 1 },
  { stage: 'Acceptance', status: 'Tuition or deposit pending', owner: 'RP', days: 7 },
  { stage: 'Acceptance', status: 'Payment proof under review', owner: 'GSP', days: 1 },
  { stage: 'Acceptance', status: 'Awaiting acceptance letter from university', owner: 'University', days: 5 },
  { stage: 'Visa', status: 'Visa lodgement pending', owner: 'RP', days: 14 },
  { stage: 'Visa', status: 'Visa decision pending', owner: 'Government', days: 28 },
  { stage: 'Visa', status: 'Visa granted: waiting for start date', owner: 'GSP', days: 5 },
  { stage: 'Enrolment', status: 'Enrolment confirmation pending', owner: 'GSP', days: 7 },
];

export const ESCALATION = { remindBefore: 1, leaderAtDue: true, opsAfter: 2, adminAfter: 5, digestTime: '08:30' };

/* Task rules: trigger → task → where it goes → SLA → when it closes. */
export const RULES = [
  { id: 'r1', on: true, name: 'Documents to verify', record: 'Application', when: 'Status becomes Pending verification', task: 'Verify the documents for [record]', to: 'region', who: 'owner', kind: 'k-verify', sla: 1, closes: 'Status moves past Pending verification' },
  { id: 'r2', on: true, name: 'Ready to submit', record: 'Application', when: 'Status becomes Ready to submit', task: 'Submit [record] to the university', to: 'region', who: 'owner', kind: 'k-submit', sla: 1, closes: 'A university reference is added' },
  { id: 'r3', on: true, name: 'No decision from the university', record: 'Application', when: 'Submitted to university for longer than its SLA', task: 'Chase the university for [record]', to: 'region', who: 'owner', kind: 'k-chase-uni', sla: 2, closes: 'A decision is recorded' },
  { id: 'r4', on: true, name: 'University email on an application', record: 'Email', when: 'An email is matched to an application', task: 'File the email on [record] and act on it', to: 'region', who: 'owner', kind: 'k-uni-mail', sla: 1, closes: 'The email is filed or dismissed' },
  { id: 'r5', on: true, name: 'GSP check', record: 'Application', when: 'Status becomes Finance and background check', task: 'Do the GSP check for [record]', to: 'region', who: 'owner', kind: 'k-gsp-check', sla: 2, closes: 'Check passed or failed' },
  { id: 'r6', on: true, name: 'Payment proof to check', record: 'Application', when: 'Status becomes Payment proof under review', task: 'Check the payment proof for [record]', to: 'region', who: 'owner', kind: 'k-payment', sla: 1, closes: 'Proof approved or sent back' },
  { id: 'r7', on: true, name: 'Quality check', record: 'Application', when: 'Documents verified and ready to submit', task: 'Quality-check [record] before submission', to: 'q-adm-ops', who: 'leader-assigns', kind: 'k-qc', sla: 1, closes: 'QC passed or sent back' },
  { id: 'r8', on: true, name: 'New RP to verify', record: 'RP', when: 'All onboarding documents uploaded', task: 'Verify [record]', to: 'q-rp-ops', who: 'members-pick', kind: 'k-rp-verify', sla: 2, closes: 'RP verified or documents sent back' },
  { id: 'r9', on: true, name: 'RP signed up, not activated', record: 'RP', when: 'Not activated for 3 days', task: 'Help [record] finish sign-up', to: 'owner', who: 'owner', kind: 'k-rp-change', sla: 2, closes: 'RP activated' },
  { id: 'r10', on: true, name: 'Agreement ending', record: 'Institution partner', when: '60 days before the agreement ends', task: 'Renew the agreement with [record]', to: 'q-institution', who: 'record-owner', kind: 'k-renew', sla: 30, closes: 'A new agreement is uploaded' },
  { id: 'r11', on: true, name: 'Draft courses', record: 'Course', when: 'A course is in draft for 7 days', task: 'Finish and publish [record]', to: 'q-inst-ops', who: 'round-robin', kind: 'k-course', sla: 5, closes: 'The course is published' },
  { id: 'r12', on: true, name: 'Commission terms missing', record: 'Commission', when: 'An agreement is signed and no terms are entered', task: 'Enter commission terms for [record]', to: 'q-finance', who: 'members-pick', kind: 'k-terms', sla: 2, closes: 'Terms entered and checked' },
  { id: 'r13', on: true, name: 'Change waiting for a checker', record: 'Commission', when: 'Terms, a notice or a scheme changed', task: 'Check the change to [record]', to: 'q-finance', who: 'not-maker', kind: 'k-check', sla: 1, closes: 'A different person approves or rejects it' },
  { id: 'r14', on: true, name: 'Email not matched', record: 'Email', when: 'AI confidence below 80%', task: 'Match this email to a record', to: 'q-mail', who: 'members-pick', kind: 'k-mail', sla: 1, closes: 'Matched or marked not needed' },
  { id: 'r15', on: true, name: 'SLA breached', record: 'Any', when: 'A task is overdue by 2 working days', task: 'Escalated: [record]', to: 'q-adm-ops', who: 'leader-assigns', kind: 'k-escalation', sla: 1, closes: 'The original task is done' },
];

/* Records. GSP-… applications are the designer's; A00… are sampled from GSP's real applications
   (real RPs, universities, courses, stages; student names and numbers invented). */
import SAMPLE from './sample.json';
const DESIGNER_APPS = [
  { id: 'GSP-23944', student: 'Rohan Gupta', uni: 'Northumbria University', status: 'Pending verification', stage: 'Pre-screening', branch: 'Mumbai', owner: 'u-divya', officer: 'u-alfiya1-khan', since: ago(0, 20) },
  { id: 'GSP-24063', student: 'Sneha Patil', uni: 'Coventry University', status: 'Awaiting acceptance letter from university', stage: 'Acceptance', branch: 'Bengaluru head office', owner: 'u-nesil', officer: 'u-ramish-jafery', since: ago(3) },
  { id: 'GSP-24055', student: 'Sneha Patil', uni: 'Flinders University', status: 'Pending verification', stage: 'Pre-screening', branch: 'Bengaluru head office', owner: 'u-nesil', officer: 'u-alfiya1-khan', since: ago(0, 14), waitingOn: 'RP', waitingFor: 'Gap explanation document', due: ago(-3) },
  { id: 'GSP-24102', student: 'Priya Raman', uni: 'Deakin University', status: 'Conditional offer received, conditions pending', stage: 'Offer', branch: 'Bengaluru head office', owner: 'u-karthik', officer: 'u-alfiya1-khan', since: ago(5), waitingOn: 'RP', waitingFor: 'Offer conditions', due: ago(-2) },
  { id: 'GSP-24061', student: 'Sneha Patil', uni: 'University of Newcastle', status: 'Document re-upload pending', stage: 'Pre-screening', branch: 'Bengaluru head office', owner: 'u-nesil', officer: 'u-alfiya1-khan', since: ago(4), waitingOn: 'RP', waitingFor: 'Re-uploaded 12th marksheet', due: ago(1) },
  { id: 'GSP-23710', student: 'Fatima Sheikh', uni: 'RMIT University', status: 'Visa lodgement pending', stage: 'Visa', branch: 'Mumbai', owner: 'u-divya', officer: 'u-ramish-jafery', since: ago(2), waitingOn: 'RP', waitingFor: 'Visa lodgement proof', due: ago(-12) },
  { id: 'GSP-23941', student: 'Rohan Gupta', uni: 'Coventry University', status: 'Submitted to university', stage: 'Application', branch: 'Mumbai', owner: 'u-divya', officer: 'u-alfiya1-khan', since: ago(12), waitingOn: 'University', waitingFor: 'Decision from Coventry', due: ago(-2) },
  { id: 'GSP-24097', student: 'Priya Raman', uni: 'University of Wollongong', status: 'Submitted to university', stage: 'Application', branch: 'Bengaluru head office', owner: 'u-karthik', officer: 'u-alfiya1-khan', since: ago(13), waitingOn: 'University', waitingFor: 'Decision from Wollongong', due: ago(1) },
].map(a => ({ ...a, type: 'Application', label: `${a.id} · ${a.student}, ${a.uni.replace(/^University of |University /, '').trim()}`, region: 'India', agency: 'GSP test agency' }));

const SAMPLE_APPS = SAMPLE.records.map(r => ({ ...r, since: ago(r.sinceDays), due: r.dueDays != null ? ago(-r.dueDays) : undefined }));

export const RECORDS = [
  ...DESIGNER_APPS,
  ...SAMPLE_APPS,
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
export const TASKS = [
  t('T-1001', 'r1', 'k-verify', 'GSP-23944', 'q-adm-india', 'u-alfiya1-khan', ago(0, 20)),
  t('T-1002', 'r4', 'k-uni-mail', 'GSP-24063', 'q-adm-india', 'u-ramish-jafery', ago(0, 3), { note: 'CAS arrived from Coventry by mail. Add it to Documents and move to Visa.' }),
  t('T-1003', 'r3', 'k-chase-uni', 'GSP-24097', 'q-adm-india', 'u-alfiya1-khan', ago(3)),
  t('T-1004', 'r7', 'k-qc', 'GSP-23944', 'q-adm-ops', null, ago(0, 5)),
  ...SAMPLE.tasks.map(x => ({ ...x, created: ago(x.createdDays) })),
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
  t('T-1023', 'r14', 'k-mail', 'mail-1', 'q-mail', null, ago(0, 9)),
  t('T-1024', 'r14', 'k-mail', 'mail-2', 'q-mail', 'u-ashu-rajpal', ago(1, 2)),
  t('T-1025', 'r15', 'k-escalation', 'GSP-24097', 'q-adm-ops', 'u-tasha-tandon', ago(1), { note: 'Chase on Wollongong is overdue.' }),
];

/* Who is "watching" what, for the Watching tab. */
export const WATCHING = { 'u-jovial-lejo': ['T-1012', 'T-1021', 'T-1022'], 'u-tasha-tandon': ['T-1003'], 'u-myleeta-williams': ['T-1012', 'T-1022', 'T-1003'] };
