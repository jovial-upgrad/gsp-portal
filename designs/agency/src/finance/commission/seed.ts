/**
 * The module's seeded records (Jovial, 9–10 Nov): settings, agreement variants, RP commission records, notices with
 * their RP lists, university terms for most live universities, university groups, other RPs' enrolled applications, and
 * what people did with the lines (invoices raised, payments received, invoices requested and sent, payments made).
 * Only records: commission items, transactions, amounts, due dates and statuses are worked out by engine.ts. The
 * prototype's own RP (Horizon Overseas) has its enrolled applications in the applications seed (data/applications.ts).
 */
import { idText, lineKey } from './engine';
import type { Addl, Agreement, AgreementBonus, AgreementTerms, Band, BonusScheme, CommState, Confirm, Enrolment, FileRef, InvoiceRequest, Level, Notice, Override, PayUnit, Receipt, RpInvoice, RpPayment, RpRecord, Settings, Stamp, TermsBody, Trigger, UniGroup, UniInvoice, UniTerms } from './model';

const at = (iso: string, time = '10:30') => new Date(`${iso}T${time}`).getTime();
const by = (who: string, iso: string): Stamp => ({ by: who, at: at(iso) });
const file = (name: string, kb: number): FileRef => ({ name, size: kb * 1024 });
const LAV = 'Lav Likhi';
const RHYTHM = 'Rhythm Jain';
const JOANA = 'Joana Cabrera';

export const sampleSettings = (): Settings => ({
  gsp: { name: 'Global Study Partners', lines: ['Level 2, 11 York Street', 'Sydney NSW 2000'] },
  disputeEmail: 'commissions.gsp@upgrad.com',
  invoiceFrom: 'commissions.gsp@upgrad.com',
  fallbackWeeks: 4,
  // Jovial, 10 Nov (D14): the financial year starts in April by default
  fyStart: 4,
  maxFileMb: 10,
  invoiceFormat: 'GSP-{code}-{year}-{seq}',
  // Jovial, 10 Nov (C6): 10% GST on GSP's invoices to Australian universities; no GST anywhere else
  gst: { Australia: 10 },
  regionGroups: { SEA: ['Vietnam', 'Malaysia', 'Indonesia', 'Thailand', 'Philippines', 'Singapore', 'Cambodia', 'Myanmar'], 'South Asia': ['India', 'Nepal', 'Bangladesh', 'Sri Lanka', 'Pakistan', 'Bhutan'] },
  annuity: { rule: 'Same as year 1', pct: null },
  // Jovial, 11 Nov: by default an RP sees every kind of line, for its first study period only (the business, 11 Nov)
  // the commissions team, 11 Nov (R105): an RP can claim for 12 months after the study period ends
  rpClaimMonths: 12,
  rpView: { kinds: ['Course commission', 'Tier top-up', 'Additional commission', 'Bonus'], periods: 'First study period only' },
  docTypes: ['Notice', 'Addendum', 'Flyer', 'Email'],
  studentTypes: ['New', 'Progression', 'Transfer'],
  // Jovial, 10 Nov (Q44): why a university paid less than a line
  partReasons: ['Part payment', 'Rate dispute', 'Student not recognised', 'Bank charges', 'Exchange difference'],
  // Jovial, 10 Nov (Q47): days after an invoice request (RP) and after a line's due date (university); no escalation
  reminders: { rpInvoice: [3, 7, 14], uniPayment: [0, 7, 14], rpPayment: [0, 7, 14] },
});

/* ---------- agreements ---------- */

const terms = (t: Partial<AgreementTerms>): AgreementTerms => ({ shareType: 'Flat', share: null, bands: [], countedPer: 'Financial year', retro: false, addl: null, bonuses: [], payDays: 30, details: '', doc: null, ...t });
const agBonus = (id: string, desc: string, amount: number, nth: number | null): AgreementBonus => ({ id, desc, amount, when: nth === null ? 'Every enrolment' : 'At an enrolment number', nth });
const band = (from: number, to: number | null, pct: number): Band => ({ from, to, pct });
export const sampleAgreements = (): Agreement[] => [
  {
    id: 'ag-std-2024',
    name: 'Standard agreement 2024',
    status: 'Active',
    ...terms({ share: 70, details: 'Commission is paid on the first year of study only. GSP may recover commission a university claws back.', doc: file('GSP-Partner-Agreement-v2-Aug-2024.pdf', 943) }),
    created: by(LAV, '2024-07-15'),
    updated: by(LAV, '2024-07-15'),
    earlier: [],
  },
  {
    id: 'ag-std-2026',
    name: 'Standard agreement 2026',
    status: 'Active',
    ...terms({ shareType: 'Tiered by enrolments', bands: [band(1, 10, 75), band(11, 25, 80), band(26, null, 85)], retro: true, bonuses: [agBonus('ab-std26-10', 'Milestone bonus', 1000, 10)], details: 'Bands count the RP’s enrolments in GSP’s financial year. Reaching a higher band raises every earlier enrolment that year. A milestone bonus on the 10th enrolment of the year.', doc: file('GSP-Partner-Agreement-v3-Nov-2026.pdf', 1025) }),
    created: by(LAV, '2026-06-02'),
    updated: by(RHYTHM, '2026-06-20'),
    // edited on 20 Jun: the top band was 82% before
    earlier: [{ ...terms({ shareType: 'Tiered by enrolments', bands: [band(1, 10, 75), band(11, 25, 80), band(26, null, 82)], retro: true, bonuses: [agBonus('ab-std26-10', 'Milestone bonus', 1000, 10)], details: 'Bands count the RP’s enrolments in GSP’s financial year.', doc: file('GSP-Partner-Agreement-v3-draft.pdf', 1002) }), until: '2026-06-20' }],
  },
  {
    id: 'ag-vietnam',
    name: 'Vietnam partner agreement',
    status: 'Active',
    ...terms({ share: 75, addl: 75, payDays: 21, bonuses: [agBonus('ab-vn-each', 'Enrolment bonus', 100, null)], details: 'An enrolment bonus on every enrolment.', doc: file('GSP-Vietnam-Partner-Agreement-2025.pdf', 870) }),
    created: by(LAV, '2024-12-10'),
    updated: by(LAV, '2024-12-10'),
    earlier: [],
  },
  {
    id: 'ag-pilot-2023',
    name: 'Pilot agreement 2023',
    status: 'Retired',
    ...terms({ share: 65, payDays: 45, details: 'The first partners’ agreement. Replaced by the standard agreements.' }),
    created: by(LAV, '2023-03-01'),
    updated: by(LAV, '2025-06-30'),
    earlier: [],
  },
];

/* ---------- RP records (RPs by id, as RP Ops keeps them); no payment details on the portal (Q45) ---------- */

export const sampleRecords = (): RpRecord[] => [
  { rp: 'rp-horizon', agreement: 'ag-std-2026', from: '2026-07-01', moves: [{ agreement: 'ag-std-2024', from: '2024-08-10' }], created: by(LAV, '2024-08-12'), updated: by(RHYTHM, '2026-06-24') },
  // walkthrough (Deepesh, 10 Nov): Capital Career Abroad moved to the tiered Standard 2026 from 1 Apr 2026 and has 12 students
  // this financial year, so it reached its 80% band (retrospective: earlier ones rise too)
  { rp: 'rp-delhi', agreement: 'ag-std-2026', from: '2026-04-01', moves: [{ agreement: 'ag-std-2024', from: '2024-11-10' }], created: by(LAV, '2024-11-26'), updated: by(LAV, '2026-03-30') },
  { rp: 'rp-saigon', agreement: 'ag-vietnam', from: '2025-01-19', moves: [], created: by(JOANA, '2025-02-03'), updated: by(JOANA, '2025-02-03') },
  // its own flat share instead of the agreement's (the sandbox's own flat %)
  // walkthrough: Himalayan Study Centre's terms changed partway: the Pilot 2023 agreement until 30 Jun 2026, Standard 2026 from 1 Jul
  { rp: 'rp-pokhara', agreement: 'ag-std-2026', from: '2026-07-01', moves: [{ agreement: 'ag-pilot-2023', from: '2025-03-12' }], created: by(LAV, '2025-03-29'), updated: by(LAV, '2026-06-26') },
];

/* ---------- notices ---------- */

// Jovial, 11 Nov (Q107, R103): Finance (Lav) creates a notice and RP Ops (Garima, BAP) issues it; the seeded ones are issued
const GARIMA = 'Garima Bhardwaj';
const seededNotices = (): Notice[] => [
  // saved by Finance on 10 Nov and not issued yet (R103): RP Ops' Notices and its T85 task show it
  {
    id: 'nt-nz-2027',
    name: 'New Zealand bonus 2027',
    doc: file('GSP-Notice-NZ-Bonus-2027.pdf', 296),
    starts: '2027-01-01',
    ends: '2027-12-31',
    dests: ['New Zealand'],
    unis: [],
    levels: [],
    docType: 'Notice',
    benefit: 'Bonus per enrolment',
    amount: 400,
    share: null,
    bands: [],
    retro: false,
    rps: ['rp-horizon'],
    removed: [],
    issued: null,
    created: by(LAV, '2026-11-10'),
    updated: by(LAV, '2026-11-10'),
  },
  {
    id: 'nt-uk-2026',
    name: 'UK Promotion 2026',
    doc: file('GSP-Notice-UK-Promotion-2026.pdf', 412),
    starts: '2026-01-01',
    ends: '2026-12-31',
    dests: ['UK'],
    unis: [],
    levels: [],
    docType: 'Addendum',
    benefit: 'Bonus per enrolment',
    amount: 300,
    share: null,
    bands: [],
    retro: false,
    rps: ['rp-horizon', 'rp-delhi'],
    removed: [],
    created: by(LAV, '2025-12-12'),
    updated: by(RHYTHM, '2026-02-03'),
  },
  {
    id: 'nt-au-pg-2026',
    name: 'Australia postgraduate share 2026',
    doc: file('GSP-Notice-Australia-PG-2026.pdf', 388),
    starts: '2026-02-01',
    ends: '2026-08-31',
    dests: ['Australia'],
    unis: [],
    levels: ['Master’s degree', 'Postgraduate diploma'],
    docType: 'Notice',
    benefit: 'Share',
    combine: 'Highest wins',
    amount: null,
    share: 85,
    bands: [],
    retro: false,
    rps: ['rp-horizon'],
    removed: [],
    created: by(LAV, '2026-01-20'),
    updated: by(LAV, '2026-01-20'),
  },
  {
    id: 'nt-vn-2027',
    name: 'Vietnam Spring 2027',
    doc: file('GSP-Notice-Vietnam-Spring-2027.pdf', 296),
    starts: '2027-01-01',
    ends: '2027-03-31',
    dests: ['Australia', 'New Zealand'],
    unis: [],
    levels: [],
    docType: 'Flyer',
    // only the January and February 2027 intakes
    intakes: ['2027-01', '2027-02'],
    benefit: 'Bonus per enrolment',
    amount: 200,
    share: null,
    bands: [],
    retro: false,
    rps: ['rp-saigon'],
    removed: [],
    created: by(JOANA, '2026-10-28'),
    updated: by(JOANA, '2026-10-28'),
  },
  // Jovial, 10 Nov: the sandbox's notice structures. A separate box: replaces the share, and isn't counted in the RP's tier
  {
    id: 'nt-uk-ug-box',
    name: 'UK undergraduate box 2026',
    docType: 'Email',
    doc: file('Email-approval-UK-UG-box-2026.pdf', 64),
    starts: '2026-01-01',
    ends: '2026-12-31',
    dests: ['UK'],
    unis: [],
    levels: ['Bachelor’s degree'],
    benefit: 'Share',
    combine: 'Separate box',
    amount: null,
    share: 80,
    bands: [],
    retro: false,
    rps: ['rp-delhi'],
    removed: [],
    created: by(RHYTHM, '2025-12-20'),
    updated: by(RHYTHM, '2025-12-20'),
  },
  // a milestone: a lump sum once GSP has been paid for N enrolments under it, even after it ends
  {
    id: 'nt-vn-milestone',
    name: 'Vietnam milestone 2026',
    docType: 'Notice',
    doc: file('GSP-Notice-Vietnam-Milestone-2026.pdf', 210),
    starts: '2026-01-01',
    ends: '2026-12-31',
    dests: [],
    unis: [],
    levels: [],
    benefit: 'Milestone',
    milestones: [
      { count: 1, amount: 500 },
      { count: 3, amount: 1500 },
    ],
    amount: null,
    share: null,
    bands: [],
    retro: false,
    rps: ['rp-saigon'],
    removed: [],
    created: by(JOANA, '2026-01-08'),
    updated: by(JOANA, '2026-01-08'),
  },
  // a % of the student's tuition fee, on top of the share
  {
    id: 'nt-waikato-tuition',
    name: 'Waikato tuition promotion',
    docType: 'Flyer',
    doc: file('Waikato-promotion-flyer-2026.pdf', 520),
    starts: '2026-06-01',
    ends: '2026-09-30',
    dests: ['New Zealand'],
    unis: ['waikato'],
    levels: [],
    benefit: '% of tuition',
    combine: 'Adds on top',
    tuitionPct: 2,
    amount: null,
    share: null,
    bands: [],
    retro: false,
    rps: ['rp-saigon'],
    removed: [],
    created: by(JOANA, '2026-05-20'),
    updated: by(JOANA, '2026-05-20'),
  },
  // no RPs listed: every RP in its sales regions
  {
    id: 'nt-south-asia-bonus',
    name: 'South Asia Australia bonus',
    docType: 'Notice',
    doc: file('GSP-Notice-South-Asia-Australia-2026.pdf', 180),
    starts: '2026-07-01',
    ends: '2026-12-31',
    dests: ['Australia'],
    unis: [],
    levels: [],
    benefit: 'Bonus per enrolment',
    amount: 150,
    share: null,
    bands: [],
    retro: false,
    rps: [],
    regions: ['South Asia'],
    removed: [],
    created: by(LAV, '2026-06-15'),
    updated: by(LAV, '2026-06-15'),
  },
];
export const sampleNotices = (): Notice[] => seededNotices().map((n) => ({ ...n, issued: 'issued' in n ? n.issued : { by: GARIMA, at: n.created.at } }));

/* ---------- university terms ---------- */

// rates in the order Foundation, Diploma, Bachelor’s degree, Postgraduate diploma, Master’s degree, PhD or research (null: none)
const ORDER: Level[] = ['Foundation', 'Diploma', 'Bachelor’s degree', 'Postgraduate diploma', 'Master’s degree', 'PhD or research'];
const rates = (r: (number | null)[]) => Object.fromEntries(ORDER.map((l, i) => [l, r[i]]).filter(([, v]) => v !== null)) as Partial<Record<Level, number>>;
// each additional commission and bonus has its own ID (the lines it makes are known by it, never by its place in the list)
const addl = (id: string, desc: string, kind: Addl['kind'], value: number, when: Addl['when']): Addl => ({ id, desc, kind, value, when });
const scheme = (id: string, name: string, o: Partial<BonusScheme>): BonusScheme => ({ id, name, per: 'Per student', kind: 'Amount', value: 0, threshold: null, bands: [], retro: true, perCountry: false, cond: {}, ...o });
// how the university pays (instalments a year), and how many years are chargeable (the first, unless the contract says more)
const PAY: Record<number, PayUnit> = { 1: 'Year', 2: 'Semester', 3: 'Trimester', 4: 'Term' };
const uniTerms = (uni: string, r: (number | null)[], trigger: Trigger, inst: number, payDays: number, entered: string, o: Partial<TermsBody> = {}): UniTerms => ({
  uni,
  rates: rates(r),
  feeBasis: 'Tuition after scholarship',
  fixed: {},
  rateRows: [],
  trigger,
  triggerWeeks: null,
  payUnit: PAY[inst],
  charge: { unit: 'Years', n: 1 },
  payDays,
  cap: null,
  bands: [],
  countedPer: 'Calendar year',
  yearStart: 1,
  tierRetro: false,
  tierPerCountry: false,
  tierLevels: [],
  bandBonuses: [],
  promos: [],
  addl: [],
  bonus: [],
  contract: file(`${uni.replace(/(^|-)(\w)/g, (_, d: string, c: string) => `${d ? '-' : ''}${c.toUpperCase()}`)}-GSP-Agency-Agreement.pdf`, 1200 + uni.length * 37),
  notes: '',
  ...o,
  created: by(LAV, entered),
  updated: by(LAV, entered),
  earlier: [],
});
/** Terms for every live university but Lincoln and South Florida (and the two still setting up): T81 asks for those. */
export const sampleTerms = (): UniTerms[] => [
  uniTerms('flinders', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2024-05-10', { addl: [addl('ad-flinders-mkt', 'Marketing contribution', '%', 2, 'With study period 1')], notes: 'Research degrees aren’t covered by the contract.' }),
  uniTerms('adelaide', [12, 12, 15, 15, 15, null], 'Census date', 2, 45, '2025-02-14'),
  // a promotion: 18% for postgraduates from January 2026, when it's higher than the rate
  uniTerms('deakin', [15, 15, 15, 17.5, 17.5, null], 'Census date', 2, 45, '2024-03-02', { cap: 12000, promos: [{ id: 'pr-deakin-pg', name: 'Deakin postgraduate promotion 2026', pct: 18, amt: null, combine: 'Highest wins', cond: { from: '2026-01-01', to: '2026-12-31', levels: ['Master’s degree', 'Postgraduate diploma'] } }] }),
  uniTerms('newcastle', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2024-04-18'),
  // rate rows: the most specific match wins (a course for students from Vietnam, and a fixed amount for South Asia's engineers)
  uniTerms('uow', [15, 15, 15, 15, 15, 10], 'Census date', 2, 30, '2024-06-21', {
    rateRows: [
      { course: 'Master of Animation', region: 'Vietnam', pct: 18, amt: null },
      { level: 'Bachelor’s degree', course: 'Bachelor of Electrical Engineering', region: 'South Asia', pct: null, amt: 4500 },
    ],
    bonus: [scheme('bn-uow-2026', 'Volume bonus 2026', { per: 'At a number', value: 1000, threshold: 2, countedPer: 'Calendar year', cond: { from: '2026-01-01', to: '2026-12-31' } })],
    notes: 'The volume bonus is GSP’s: no RP gets a share of it.',
  }),
  uniTerms('cqu', [20, 20, 20, 20, 20, null], 'Fees paid', 3, 30, '2024-09-09'),
  uniTerms('vu', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-01-22'),
  uniTerms('murdoch', [15, 15, 16, 16, 16, null], 'Census date', 2, 30, '2025-03-11'),
  uniTerms('rmit', [15, 12, 10, 10, 10, 10], 'Census date', 2, 30, '2024-02-27', { feeBasis: 'Tuition before scholarship', notes: 'Students moving between RMIT programmes earn 5%: claim by hand.' }),
  uniTerms('feduni', [15, 15, 15, 15, 15, null], 'Withdrawal deadline', 2, 30, '2025-05-06', { triggerWeeks: 4 }),
  uniTerms('abertay', [15, 15, 15, 15, 15, null], 'Enrolment confirmed', 1, 30, '2024-10-01'),
  uniTerms('coventry', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2024-01-30', { charge: { unit: 'Years', n: 2 }, addl: [addl('ad-coventry-fee', 'Service fee', 'Amount', 500, 'On enrolment')], bands: [band(1, 20, 15), band(21, null, 17.5)], bandBonuses: [{ band: 2, kind: 'Amount', value: 250 }] }),
  uniTerms('herts', [14, 14, 14, 14, 14, null], 'Enrolment confirmed', 2, 30, '2024-07-08'),
  uniTerms('northumbria', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2024-08-14'),
  uniTerms('greenwich', [16, 16, 16, 16, 16, null], 'Census date', 2, 30, '2024-09-19'),
  uniTerms('ulster', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-01-09'),
  uniTerms('leeds', [null, null, 10, 10, 10, null], 'Census date', 1, 60, '2025-04-03', { fixed: { 'Bachelor’s degree': 2000 } }),
  uniTerms('birmingham', [null, null, 10, 10, 10, null], 'Census date', 1, 60, '2025-04-03'),
  uniTerms('windsor', [15, 15, 15, 15, 15, null], 'Fees paid', 2, 45, '2024-11-12', { payUnit: 'Each fee payment', charge: { unit: 'Fees up to', n: 30000 } }),
  uniTerms('algoma', [15, 15, 15, 15, 15, null], 'Fees paid', 2, 45, '2025-02-25'),
  uniTerms('fanshawe', [null, 15, 15, 15, 15, null], 'Fees paid', 2, 45, '2024-10-17'),
  uniTerms('tru', [15, 15, 15, 15, 15, null], 'Fees paid', 2, 45, '2025-06-12'),
  uniTerms('massey', [12.5, 12.5, 12.5, 12.5, 12.5, null], 'Census date', 1, 60, '2023-08-01'),
  // NZ: chargeable on the first 120 credit points
  uniTerms('waikato', [12.5, 12.5, 12.5, 12.5, 12.5, null], 'Census date', 2, 60, '2024-12-05', { charge: { unit: 'Credit points', n: 120 } }),
  uniTerms('griffith', [null, 15, 15, 15, 15, null], 'Enrolment confirmed', 1, 30, '2025-03-27'),
  uniTerms('dbs', [null, 15, 15, 15, 15, null], 'Enrolment confirmed', 1, 30, '2025-03-27'),
  uniTerms('ul', [12, 12, 12, 12, 12, null], 'Census date', 1, 45, '2025-07-15'),
  uniTerms('pace', [12, 12, 12, 12, 12, null], 'Census date', 2, 60, '2025-08-20'),
  uniTerms('canberra', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-09-02'),
  uniTerms('unisc', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-09-02'),
];

/* ---------- university groups (Q56): counted together for a tier and for group bonuses ---------- */

export const sampleGroups = (): UniGroup[] => [
  {
    id: 'grp-uk-partners',
    name: 'UK partner group',
    members: ['coventry', 'herts', 'greenwich'],
    bands: [band(1, 2, 15), band(3, null, 16)],
    countedPer: 'Calendar year',
    yearStart: 1,
    tierRetro: true,
    tierPerCountry: false,
    tierLevels: [],
    bandBonuses: [],
    bonus: [scheme('gb-uk-volume', 'Group volume bonus', { per: 'By count', bands: [{ from: 3, to: null, value: 250, kind: 'Amount' }], countedPer: 'Calendar year', perCountry: true })],
    notes: 'One agreement covers these universities: students at any of them count toward the group’s tier.',
    created: by(LAV, '2025-11-04'),
    updated: by(LAV, '2025-11-04'),
  },
];

/* ---------- other RPs' enrolled applications (Horizon's are in the applications seed) ---------- */

/** The fee, scholarship and dates, as each application's Admissions officer entered them (index 0: study period 1). */
const fees = (tuition: number, scholarship: number, start: string, dates: { census?: string[]; confirmed?: string[]; paid?: string[] }, more: Partial<NonNullable<Enrolment['fees']>> = {}) => ({ tuition, scholarship, start, census: dates.census ?? [], confirmed: dates.confirmed ?? [], paid: dates.paid ?? [], feeBy: { by: 'Asha Pillai', at: at(start) }, ...more });
export const sampleEnrolments = (): Enrolment[] => [
  { app: 'GSP-22950', student: 'Arjun Malhotra', nationality: 'India', rp: 'rp-delhi', course: 'herts-1', intake: 'Sep 2025', enrolled: '2025-09-30', fees: fees(22200, 0, '2025-09-22', { confirmed: ['', '2026-02-02'] }) },
  { app: 'GSP-23510', student: 'Simran Kaur', nationality: 'India', rp: 'rp-delhi', course: 'coventry-10', intake: 'Jan 2026', enrolled: '2026-01-28', fees: fees(20250, 0, '2026-01-26', { census: ['2026-02-20', '2026-06-19', '2027-02-19', '2027-06-18'] }) },
  { app: 'GSP-23577', student: 'Rohit Bansal', nationality: 'India', rp: 'rp-delhi', course: 'greenwich-3', intake: 'Jan 2026', enrolled: '2026-01-27', withdrawn: '2026-05-10', fees: fees(17500, 1750, '2026-01-26', { census: ['2026-02-20', '2026-06-12'] }) },
  { app: 'GSP-23120', student: 'Nguyen Minh Anh', nationality: 'Vietnam', rp: 'rp-saigon', course: 'uow-4', intake: 'Feb 2026', enrolled: '2026-03-01', fees: fees(45900, 4600, '2026-02-23', { census: ['2026-03-20', '2026-08-21'] }, { studentType: 'New', campus: 'Wollongong' }) },
  { app: 'GSP-23466', student: 'Tran Bao Ngoc', nationality: 'Vietnam', rp: 'rp-saigon', course: 'waikato-2', intake: 'Jul 2026', enrolled: '2026-07-25', fees: fees(41100, 8200, '2026-07-13', { census: ['2026-08-07', '2027-03-26'] }, { points: 180 }) },
  // no student type yet: the Exceptions list asks Admissions for it
  { app: 'GSP-23490', student: 'Sita Gurung', nationality: 'Nepal', rp: 'rp-pokhara', course: 'uow-2', intake: 'Jul 2026', enrolled: '2026-07-26', fees: fees(31350, 7850, '2026-07-20', { census: ['2026-08-21', '2027-03-19'] }) },
  { app: 'GSP-23533', student: 'Le Thu Ha', nationality: 'Vietnam', rp: 'rp-hanoi', course: 'windsor-2', intake: 'Sep 2026', enrolled: '2026-09-28', fees: fees(26900, 5400, '2026-09-08', { paid: ['2026-08-28'] }, { feePayments: [{ date: '2026-08-28', amount: 10750 }, { date: '2027-01-05', amount: 10750 }] }) },
  // a PhD at Deakin, whose terms have no rate for it: Rate missing, held (D10)
  { app: 'GSP-23545', student: 'Kavya Nair', nationality: 'India', rp: 'rp-delhi', course: 'deakin-13', intake: 'Jul 2026', enrolled: '2026-07-24', fees: fees(36800, 0, '2026-07-13', { census: ['2026-08-31'] }, { studentType: 'New' }) },
  // Massey's agreement with GSP ended in March 2026: Contract ended, held (D11)
  { app: 'GSP-23552', student: 'Pham Quoc Bao', nationality: 'Vietnam', rp: 'rp-saigon', course: 'massey-1', intake: 'Jul 2026', enrolled: '2026-07-20', fees: fees(34500, 3000, '2026-07-13', { census: ['2026-08-14'] }) },
  // CQU pays by trimester on fees paid; the second trimester's payment isn't in yet
  { app: 'GSP-23560', student: 'Aarav Shrestha', nationality: 'Nepal', rp: 'rp-pokhara', course: 'cqu-1', intake: 'Mar 2026', enrolled: '2026-03-16', fees: fees(28800, 2880, '2026-03-09', { paid: ['2026-03-02'] }, { studentType: 'New' }) },
  // Federation pays at the withdrawal deadline (start + 4 weeks), no census date needed
  { app: 'GSP-23568', student: 'Ishaan Verma', nationality: 'India', rp: 'rp-delhi', course: 'feduni-1', intake: 'Jul 2026', enrolled: '2026-07-21', fees: fees(30400, 0, '2026-07-13', {}, { studentType: 'New' }) },
  // walkthrough (Deepesh, 10 Nov): ten more of Capital Career Abroad's students this financial year, its 11th and 12th reach the 80% band
  { app: 'GSP-23610', student: 'Aditya Rao', nationality: 'India', rp: 'rp-delhi', course: 'flinders-1', intake: 'Jul 2026', enrolled: '2026-07-12', fees: fees(33750, 6750, '2026-07-06', { census: ['2026-08-12', '2027-03-12'] }, { studentType: 'New' }) },
  { app: 'GSP-23611', student: 'Neha Sharma', nationality: 'India', rp: 'rp-delhi', course: 'flinders-2', intake: 'Jul 2026', enrolled: '2026-07-13', fees: fees(38400, 9600, '2026-07-06', { census: ['2026-08-13', '2027-03-13'] }, { studentType: 'New' }) },
  { app: 'GSP-23612', student: 'Karan Mehta', nationality: 'India', rp: 'rp-delhi', course: 'flinders-14', intake: 'Jul 2026', enrolled: '2026-07-14', fees: fees(38450, 0, '2026-07-06', { census: ['2026-08-14', '2027-03-14'] }, { studentType: 'New' }) },
  { app: 'GSP-23613', student: 'Pooja Iyer', nationality: 'India', rp: 'rp-delhi', course: 'flinders-15', intake: 'Jul 2026', enrolled: '2026-07-15', fees: fees(37450, 0, '2026-07-06', { census: ['2026-08-15', '2027-03-15'] }, { studentType: 'New' }) },
  { app: 'GSP-23614', student: 'Rahul Gupta', nationality: 'India', rp: 'rp-delhi', course: 'flinders-17', intake: 'Jul 2026', enrolled: '2026-07-16', fees: fees(39700, 0, '2026-07-06', { census: ['2026-08-16', '2027-03-16'] }, { studentType: 'New' }) },
  { app: 'GSP-23615', student: 'Sneha Patil', nationality: 'India', rp: 'rp-delhi', course: 'flinders-22', intake: 'Jul 2026', enrolled: '2026-07-17', fees: fees(37650, 0, '2026-07-06', { census: ['2026-08-17', '2027-03-17'] }, { studentType: 'New' }) },
  { app: 'GSP-23616', student: 'Vikram Singh', nationality: 'India', rp: 'rp-delhi', course: 'flinders-25', intake: 'Jul 2026', enrolled: '2026-07-18', fees: fees(34650, 0, '2026-07-06', { census: ['2026-08-18', '2027-03-18'] }, { studentType: 'New' }) },
  { app: 'GSP-23617', student: 'Ananya Das', nationality: 'India', rp: 'rp-delhi', course: 'flinders-27', intake: 'Jul 2026', enrolled: '2026-07-19', fees: fees(41150, 0, '2026-07-06', { census: ['2026-08-19', '2027-03-19'] }, { studentType: 'New' }) },
  { app: 'GSP-23618', student: 'Arnav Joshi', nationality: 'India', rp: 'rp-delhi', course: 'flinders-7', intake: 'Jul 2026', enrolled: '2026-07-20', fees: fees(38350, 5750, '2026-07-06', { census: ['2026-08-20', '2027-03-20'] }, { studentType: 'New' }) },
  { app: 'GSP-23619', student: 'Divya Menon', nationality: 'India', rp: 'rp-delhi', course: 'flinders-24', intake: 'Jul 2026', enrolled: '2026-07-21', fees: fees(36950, 5550, '2026-07-06', { census: ['2026-08-21', '2027-03-21'] }, { studentType: 'New' }) },
];

/** Finance confirmed these students continue, so their later study periods can be invoiced (D19). */
export const sampleConfirms = (): Confirm[] => [{ app: 'GSP-23510', period: 2, by: RHYTHM, at: at('2026-06-24') }];

/* ---------- what people did with the lines ---------- */

/**
 * The transaction IDs GSP gave the lines these records name, by what each line is for (its key): given once, from
 * the sequence, in the order below. Lines the engine makes later get the next IDs.
 */
const ID_START = 492000;
const NAMED: string[] = [];
const named = (app: string, side: 'uni' | 'rp', slot: string) => {
  const k = lineKey(app, side, slot);
  if (!NAMED.includes(k)) NAMED.push(k);
  return idText(ID_START + NAMED.indexOf(k) + 1);
};
const u = (app: string, slot: string) => named(app, 'uni', slot);
const r = (app: string, slot: string) => named(app, 'rp', `m:${slot}`);

export const sampleInvoices = (): UniInvoice[] => [
  { number: 'GSP-COVE-2025-001', uni: 'coventry', date: '2025-10-24', txs: [u('GSP-23305', 'p1'), u('GSP-23305', 'ad:ad-coventry-fee')], by: LAV, at: at('2025-10-24') },
  { number: 'GSP-HERT-2025-001', uni: 'herts', date: '2025-10-06', txs: [u('GSP-22950', 'p1')], by: LAV, at: at('2025-10-06') },
  { number: 'GSP-COVE-2026-001', uni: 'coventry', date: '2026-02-24', txs: [u('GSP-23510', 'p1'), u('GSP-23510', 'ad:ad-coventry-fee')], by: RHYTHM, at: at('2026-02-24') },
  { number: 'GSP-GREE-2026-001', uni: 'greenwich', date: '2026-02-24', txs: [u('GSP-23577', 'p1')], by: RHYTHM, at: at('2026-02-24') },
  { number: 'GSP-DEAK-2026-001', uni: 'deakin', date: '2026-03-27', txs: [u('GSP-23318', 'p1')], by: RHYTHM, at: at('2026-03-27') },
  { number: 'GSP-HERT-2026-001', uni: 'herts', date: '2026-03-25', txs: [u('GSP-22950', 'p2')], by: RHYTHM, at: at('2026-03-25') },
  { number: 'GSP-UOW-2026-001', uni: 'uow', date: '2026-03-27', txs: [u('GSP-23120', 'p1')], by: JOANA, at: at('2026-03-27') },
  { number: 'GSP-COVE-2026-002', uni: 'coventry', date: '2026-04-23', txs: [u('GSP-23305', 'p2')], by: RHYTHM, at: at('2026-04-23') },
  { number: 'GSP-FLIN-2026-001', uni: 'flinders', date: '2026-08-24', txs: [u('GSP-23402', 'p1'), u('GSP-23402', 'ad:ad-flinders-mkt')], by: RHYTHM, at: at('2026-08-24') },
  { number: 'GSP-WAIK-2026-001', uni: 'waikato', date: '2026-08-27', txs: [u('GSP-23466', 'p1')], by: JOANA, at: at('2026-08-27') },
  { number: 'GSP-DEAK-2026-002', uni: 'deakin', date: '2026-09-21', txs: [u('GSP-23318', 'p2')], by: RHYTHM, at: at('2026-09-21') },
];

/** A payment received; its amount null: the lines' total, as the remittance said. */
const rec = (id: string, uni: string, txs: string[], date: string, who = LAV): Receipt => ({ id, uni, txs, amount: null, paid: {}, short: {}, date, by: who, at: at(date, '15:10') });
export const sampleReceipts = (): Receipt[] => [
  rec('rc-1', 'coventry', [u('GSP-23305', 'p1'), u('GSP-23305', 'ad:ad-coventry-fee')], '2025-11-19'),
  rec('rc-2', 'herts', [u('GSP-22950', 'p1')], '2025-11-03'),
  rec('rc-3', 'coventry', [u('GSP-23510', 'p1'), u('GSP-23510', 'ad:ad-coventry-fee')], '2026-03-20', RHYTHM),
  rec('rc-4', 'greenwich', [u('GSP-23577', 'p1')], '2026-03-24', RHYTHM),
  rec('rc-5', 'deakin', [u('GSP-23318', 'p1')], '2026-05-11', RHYTHM),
  rec('rc-6', 'herts', [u('GSP-22950', 'p2')], '2026-04-22', RHYTHM),
  rec('rc-7', 'uow', [u('GSP-23120', 'p1')], '2026-04-24', JOANA),
  rec('rc-8', 'coventry', [u('GSP-23305', 'p2')], '2026-05-28', RHYTHM),
  rec('rc-9', 'flinders', [u('GSP-23402', 'p1'), u('GSP-23402', 'ad:ad-flinders-mkt')], '2026-09-30', RHYTHM),
];

export const sampleRequests = (): InvoiceRequest[] => [
  { id: 'rq-1', rp: 'rp-horizon', txs: [r('GSP-23305', 'p1'), r('GSP-23305', 'ad:ad-coventry-fee')], date: '2025-11-21', by: LAV, at: at('2025-11-21') },
  { id: 'rq-2', rp: 'rp-delhi', txs: [r('GSP-22950', 'p1')], date: '2025-11-05', by: LAV, at: at('2025-11-05') },
  { id: 'rq-3', rp: 'rp-delhi', txs: [r('GSP-22950', 'p2'), r('GSP-23577', 'p1')], date: '2026-10-30', by: RHYTHM, at: at('2026-10-30') },
  { id: 'rq-4', rp: 'rp-horizon', txs: [r('GSP-23305', 'p2'), r('GSP-23318', 'p1')], date: '2026-11-02', by: RHYTHM, at: at('2026-11-02') },
  { id: 'rq-5', rp: 'rp-saigon', txs: [r('GSP-23120', 'p1')], date: '2026-05-04', by: JOANA, at: at('2026-05-04') },
];

export const sampleRpInvoices = (): RpInvoice[] => [
  { id: 'ri-1', rp: 'rp-horizon', file: file('Horizon-Overseas-INV-2025-118.pdf', 214), txs: [r('GSP-23305', 'p1'), r('GSP-23305', 'ad:ad-coventry-fee')], by: 'Ananya Rao', at: at('2025-11-24'), state: 'Accepted', decided: by(LAV, '2025-11-25') },
  { id: 'ri-2', rp: 'rp-delhi', file: file('CCA-Invoice-Nov-2025.pdf', 188), txs: [r('GSP-22950', 'p1')], by: 'Manish Gupta', at: at('2025-11-07'), state: 'Accepted', decided: by(LAV, '2025-11-10') },
  { id: 'ri-3', rp: 'rp-delhi', file: file('CCA-Invoice-Oct-2026.pdf', 201), txs: [r('GSP-22950', 'p2'), r('GSP-23577', 'p1')], by: 'Manish Gupta', at: at('2026-11-06', '17:45'), state: 'To check' },
  { id: 'ri-4', rp: 'rp-saigon', file: file('SBE-invoice-May-2026.jpg', 960), txs: [r('GSP-23120', 'p1')], by: 'Lan Tran', at: at('2026-05-05'), state: 'Sent back', reason: 'The total doesn’t match the line: it’s in USD. Invoice in AUD, as the line is.', decided: by(JOANA, '2026-05-06') },
];

export const sampleRpPayments = (): RpPayment[] => [
  { id: 'rpp-1', rp: 'rp-horizon', txs: [r('GSP-23305', 'p1'), r('GSP-23305', 'ad:ad-coventry-fee')], date: '2025-12-12', by: LAV, at: at('2025-12-12') },
  { id: 'rpp-2', rp: 'rp-delhi', txs: [r('GSP-22950', 'p1')], date: '2025-12-03', by: LAV, at: at('2025-12-03') },
];

export const sampleOverrides = (): Override[] => [
  { id: 'ov-1', tx: r('GSP-23490', 'p1'), amount: null, due: null, hold: true, reason: 'Waiting for Himalayan Study Centre’s payment details by email before paying.', by: RHYTHM, at: at('2026-10-02') },
];

/** Everything seeded, as the store starts. Logs start empty: every Setup log line is written by an action. */
export const sampleComm = (): CommState => {
  const invoices = sampleInvoices();
  const receipts = sampleReceipts();
  const requests = sampleRequests();
  const rpInvoices = sampleRpInvoices();
  const rpPayments = sampleRpPayments();
  const overrides = sampleOverrides();
  return {
  settings: sampleSettings(),
  agreements: sampleAgreements(),
  records: sampleRecords(),
  notices: sampleNotices(),
  terms: sampleTerms(),
  groups: sampleGroups(),
  enrolments: sampleEnrolments(),
  invoices,
  receipts,
  requests,
  rpInvoices,
  rpPayments,
  writeOffs: [],
  clawbacks: [],
  overrides,
  lumps: [],
  confirms: sampleConfirms(),
  seen: {},
  history: [],
  ids: Object.fromEntries(NAMED.map((k, i) => [k, idText(ID_START + i + 1)])),
  idSeq: ID_START + NAMED.length,
  // what the acted-on lines were then is kept the first time the engine works them out (engine.ts, settle)
  frozen: {},
  logs: [],
  downloads: [],
  };
};
