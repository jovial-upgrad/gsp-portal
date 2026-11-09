/**
 * The module's seeded records (Jovial, 9 Nov): settings, agreement variants, RP commission records, RP bank details,
 * notices with their RP lists, university terms for most live universities, other RPs' enrolled applications, and
 * what people did with the lines (invoices raised, payments received, invoices requested and sent, payments made).
 * Only records: commission items, transactions, amounts, due dates and statuses are worked out by engine.ts. The
 * prototype's own RP (Horizon Overseas) has its enrolled applications in the applications seed (data/applications.ts).
 */
import { idText, lineKey } from './engine';
import type { Addl, Agreement, AgreementBonus, AgreementTerms, Band, Bank, Bonus, CommState, Enrolment, FileRef, InvoiceRequest, Level, Notice, Override, Receipt, RpInvoice, RpPayment, RpRecord, Settings, Stamp, TermsBody, Trigger, UniInvoice, UniTerms } from './model';

const at = (iso: string, time = '10:30') => new Date(`${iso}T${time}`).getTime();
const by = (who: string, iso: string): Stamp => ({ by: who, at: at(iso) });
const file = (name: string, kb: number): FileRef => ({ name, size: kb * 1024 });
const LAV = 'Lav Likhi';
const RHYTHM = 'Rhythm Jain';
const JOANA = 'Joana Cabrera';

export const sampleSettings = (): Settings => ({
  gsp: { name: 'Global Study Partners', lines: ['Level 2, 11 York Street', 'Sydney NSW 2000'] },
  disputeEmail: 'commissions.gsp@upgrad.com',
  periodMonths: 6,
  fyStart: 7,
  maxFileMb: 10,
  invoiceFormat: 'GSP-{code}-{year}-{seq}',
  countryCurrency: { India: 'INR', Nepal: 'NPR', Vietnam: 'VND', Philippines: 'PHP', 'Sri Lanka': 'LKR', Bangladesh: 'BDT', Nigeria: 'NGN', Pakistan: 'PKR' },
  bankCurrencies: ['INR', 'NPR', 'VND', 'PHP', 'LKR', 'BDT', 'NGN', 'PKR', 'AUD', 'GBP', 'USD', 'CAD', 'NZD', 'EUR'],
  tax: { India: { name: 'GST', pct: 18 }, Nepal: { name: 'VAT', pct: 13 }, Vietnam: { name: 'VAT', pct: 10 }, Philippines: { name: 'VAT', pct: 12 }, 'Sri Lanka': { name: 'VAT', pct: 18 }, Bangladesh: { name: 'VAT', pct: 15 } },
});

/* ---------- agreements ---------- */

const terms = (t: Partial<AgreementTerms>): AgreementTerms => ({ shareType: 'Flat', share: null, bands: [], countedPer: 'Financial year', retro: false, addl: null, bonuses: [], payDays: 30, details: '', doc: null, ...t });
const agBonus = (id: string, desc: string, amount: number, currency: string, nth: number | null): AgreementBonus => ({ id, desc, amount, currency, when: nth === null ? 'Every enrolment' : 'At an enrolment number', nth });
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
    ...terms({ shareType: 'Tiered by enrolments', bands: [band(1, 10, 75), band(11, 25, 80), band(26, null, 85)], retro: true, bonuses: [agBonus('ab-std26-10', 'Milestone bonus', 1000, 'AUD', 10)], details: 'Bands count the RP’s enrolments in GSP’s financial year. Reaching a higher band raises every earlier enrolment that year. A milestone bonus on the 10th enrolment of the year.', doc: file('GSP-Partner-Agreement-v3-Nov-2026.pdf', 1025) }),
    created: by(LAV, '2026-06-02'),
    updated: by(RHYTHM, '2026-06-20'),
    // edited on 20 Jun: the top band was 82% before
    earlier: [{ ...terms({ shareType: 'Tiered by enrolments', bands: [band(1, 10, 75), band(11, 25, 80), band(26, null, 82)], retro: true, bonuses: [agBonus('ab-std26-10', 'Milestone bonus', 1000, 'AUD', 10)], details: 'Bands count the RP’s enrolments in GSP’s financial year.', doc: file('GSP-Partner-Agreement-v3-draft.pdf', 1002) }), until: '2026-06-20' }],
  },
  {
    id: 'ag-vietnam',
    name: 'Vietnam partner agreement',
    status: 'Active',
    ...terms({ share: 75, addl: 75, payDays: 21, bonuses: [agBonus('ab-vn-each', 'Enrolment bonus', 100, 'AUD', null)], details: 'An enrolment bonus on every enrolment.', doc: file('GSP-Vietnam-Partner-Agreement-2025.pdf', 870) }),
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

/* ---------- RP records and banks (RPs by id, as RP Ops keeps them) ---------- */

export const sampleRecords = (): RpRecord[] => [
  { rp: 'rp-horizon', agreement: 'ag-std-2026', from: '2026-07-01', tax: true, moves: [{ agreement: 'ag-std-2024', from: '2024-08-10' }], created: by(LAV, '2024-08-12'), updated: by(RHYTHM, '2026-06-24') },
  { rp: 'rp-delhi', agreement: 'ag-std-2024', from: '2024-11-10', tax: true, moves: [], created: by(LAV, '2024-11-26'), updated: by(LAV, '2024-11-26') },
  { rp: 'rp-saigon', agreement: 'ag-vietnam', from: '2025-01-19', tax: false, moves: [], created: by(JOANA, '2025-02-03'), updated: by(JOANA, '2025-02-03') },
  { rp: 'rp-pokhara', agreement: 'ag-pilot-2023', from: '2025-03-12', tax: false, moves: [], created: by(LAV, '2025-03-29'), updated: by(LAV, '2025-03-29') },
];

export const sampleBanks = (): Bank[] => [
  { rp: 'rp-horizon', bank: 'HDFC Bank', account: 'Horizon Overseas Pvt Ltd', number: '50200061234871', swift: 'HDFCINBBXXX', address: 'Fort, Mumbai 400001, India', currency: 'INR', taxId: '27AAFCH4412K1Z3', updated: by('Ananya Rao', '2024-08-20') },
  { rp: 'rp-delhi', bank: 'ICICI Bank', account: 'Capital Career Abroad LLP', number: '001105023318', swift: 'ICICINBBCTS', address: 'Connaught Place, New Delhi 110001, India', currency: 'INR', taxId: '07AALFC9021M1Z8', updated: by('Manish Gupta', '2024-12-02') },
  { rp: 'rp-saigon', bank: 'Vietcombank', account: 'Saigon Bridge Education Co., Ltd', number: '0071000824519', swift: 'BFTVVNVX', address: '5 Me Linh Square, District 1, Ho Chi Minh City, Vietnam', currency: 'USD', updated: by('Lan Tran', '2025-02-10') },
];

/* ---------- notices ---------- */

export const sampleNotices = (): Notice[] => [
  {
    id: 'nt-uk-2026',
    name: 'UK Promotion 2026',
    doc: file('GSP-Notice-UK-Promotion-2026.pdf', 412),
    starts: '2026-01-01',
    ends: '2026-12-31',
    dests: ['UK'],
    unis: [],
    levels: [],
    benefit: 'Bonus per enrolment',
    amount: 300,
    currency: 'GBP',
    share: null,
    bands: [],
    retro: false,
    rps: ['rp-horizon', 'rp-delhi'],
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
    benefit: 'Share instead of the agreement’s',
    amount: null,
    currency: 'AUD',
    share: 85,
    bands: [],
    retro: false,
    rps: ['rp-horizon'],
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
    benefit: 'Bonus per enrolment',
    amount: 200,
    currency: 'AUD',
    share: null,
    bands: [],
    retro: false,
    rps: ['rp-saigon'],
    created: by(JOANA, '2026-10-28'),
    updated: by(JOANA, '2026-10-28'),
  },
];

/* ---------- university terms ---------- */

// rates in the order Foundation, Diploma, Bachelor’s degree, Postgraduate diploma, Master’s degree, PhD or research (null: none)
const ORDER: Level[] = ['Foundation', 'Diploma', 'Bachelor’s degree', 'Postgraduate diploma', 'Master’s degree', 'PhD or research'];
const rates = (r: (number | null)[]) => Object.fromEntries(ORDER.map((l, i) => [l, r[i]]).filter(([, v]) => v !== null)) as Partial<Record<Level, number>>;
// each additional commission and bonus has its own ID (the lines it makes are known by it, never by its place in the list)
const addl = (id: string, desc: string, kind: Addl['kind'], value: number, when: Addl['when']): Addl => ({ id, desc, kind, value, when });
const bonus = (id: string, desc: string, amount: number, min: number, year: number): Bonus => ({ id, desc, amount, min, year });
const uniTerms = (uni: string, r: (number | null)[], trigger: Trigger, inst: number, payDays: number, entered: string, o: Partial<TermsBody> = {}): UniTerms => ({
  uni,
  rates: rates(r),
  feeBasis: 'Tuition after scholarship',
  fixed: {},
  trigger,
  inst,
  payDays,
  cap: null,
  bands: [],
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
  uniTerms('flinders', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2024-05-10', { addl: [addl('ad-flinders-mkt', 'Marketing contribution', '%', 2, 'With study period 1')], notes: 'Research degrees earn nothing.' }),
  uniTerms('adelaide', [12, 12, 15, 15, 15, null], 'Census date', 2, 45, '2025-02-14'),
  uniTerms('deakin', [15, 15, 15, 17.5, 17.5, null], 'Census date', 2, 45, '2024-03-02', { cap: 12000 }),
  uniTerms('newcastle', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2024-04-18'),
  uniTerms('uow', [15, 15, 15, 15, 15, 10], 'Census date', 2, 30, '2024-06-21', { bonus: [bonus('bn-uow-2026', 'Volume bonus 2026', 1000, 2, 2026)], notes: 'The volume bonus is GSP’s: no RP gets a share of it.' }),
  uniTerms('cqu', [20, 20, 20, 20, 20, null], 'Tuition paid', 2, 30, '2024-09-09'),
  uniTerms('vu', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-01-22'),
  uniTerms('murdoch', [15, 15, 16, 16, 16, null], 'Census date', 2, 30, '2025-03-11'),
  uniTerms('rmit', [15, 12, 10, 10, 10, 10], 'Census date', 2, 30, '2024-02-27', { feeBasis: 'Tuition before scholarship', notes: 'Students moving between RMIT programmes earn 5%: claim by hand.' }),
  uniTerms('feduni', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-05-06'),
  uniTerms('abertay', [15, 15, 15, 15, 15, null], 'Enrolment confirmed', 1, 30, '2024-10-01'),
  uniTerms('coventry', [15, 15, 15, 15, 15, null], 'Census date', 4, 30, '2024-01-30', { addl: [addl('ad-coventry-fee', 'Service fee', 'Amount', 500, 'On enrolment')], bands: [band(1, 20, 15), band(21, null, 17.5)] }),
  uniTerms('herts', [14, 14, 14, 14, 14, null], 'Enrolment confirmed', 2, 30, '2024-07-08'),
  uniTerms('northumbria', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2024-08-14'),
  uniTerms('greenwich', [16, 16, 16, 16, 16, null], 'Census date', 2, 30, '2024-09-19'),
  uniTerms('ulster', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-01-09'),
  uniTerms('leeds', [null, null, 10, 10, 10, null], 'Census date', 1, 60, '2025-04-03', { fixed: { 'Bachelor’s degree': 2000 } }),
  uniTerms('birmingham', [null, null, 10, 10, 10, null], 'Census date', 1, 60, '2025-04-03'),
  uniTerms('windsor', [15, 15, 15, 15, 15, null], 'Tuition paid', 2, 45, '2024-11-12'),
  uniTerms('algoma', [15, 15, 15, 15, 15, null], 'Tuition paid', 2, 45, '2025-02-25'),
  uniTerms('fanshawe', [null, 15, 15, 15, 15, null], 'Tuition paid', 2, 45, '2024-10-17'),
  uniTerms('tru', [15, 15, 15, 15, 15, null], 'Tuition paid', 2, 45, '2025-06-12'),
  uniTerms('massey', [12.5, 12.5, 12.5, 12.5, 12.5, null], 'Census date', 1, 60, '2023-08-01'),
  uniTerms('waikato', [12.5, 12.5, 12.5, 12.5, 12.5, null], 'Census date', 2, 60, '2024-12-05'),
  uniTerms('griffith', [null, 15, 15, 15, 15, null], 'Enrolment confirmed', 1, 30, '2025-03-27'),
  uniTerms('dbs', [null, 15, 15, 15, 15, null], 'Enrolment confirmed', 1, 30, '2025-03-27'),
  uniTerms('ul', [12, 12, 12, 12, 12, null], 'Census date', 1, 45, '2025-07-15'),
  uniTerms('pace', [12, 12, 12, 12, 12, null], 'Census date', 2, 60, '2025-08-20'),
  uniTerms('canberra', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-09-02'),
  uniTerms('unisc', [15, 15, 15, 15, 15, null], 'Census date', 2, 30, '2025-09-02'),
];

/* ---------- other RPs' enrolled applications (Horizon's are in the applications seed) ---------- */

/** The fee, scholarship and dates, as each application's Admissions officer entered them (index 0: study period 1). */
const fees = (tuition: number, scholarship: number, start: string, dates: { census?: string[]; confirmed?: string[]; paid?: string[] }) => ({ tuition, scholarship, start, census: dates.census ?? [], confirmed: dates.confirmed ?? [], paid: dates.paid ?? [] });
export const sampleEnrolments = (): Enrolment[] => [
  { app: 'GSP-22950', student: 'Arjun Malhotra', rp: 'rp-delhi', course: 'herts-1', intake: 'Sep 2025', enrolled: '2025-09-30', fees: fees(22200, 0, '2025-09-22', { confirmed: ['', '2026-02-02'] }) },
  { app: 'GSP-23510', student: 'Simran Kaur', rp: 'rp-delhi', course: 'coventry-10', intake: 'Jan 2026', enrolled: '2026-01-28', fees: fees(20250, 0, '2026-01-26', { census: ['2026-02-20', '2026-06-19', '2027-02-19', '2027-06-18'] }) },
  { app: 'GSP-23577', student: 'Rohit Bansal', rp: 'rp-delhi', course: 'greenwich-3', intake: 'Jan 2026', enrolled: '2026-01-27', withdrawn: '2026-05-10', fees: fees(17500, 1750, '2026-01-26', { census: ['2026-02-20', '2026-06-12'] }) },
  { app: 'GSP-23120', student: 'Nguyen Minh Anh', rp: 'rp-saigon', course: 'uow-4', intake: 'Feb 2026', enrolled: '2026-03-01', fees: fees(45900, 4600, '2026-02-23', { census: ['2026-03-20', '2026-08-21'] }) },
  { app: 'GSP-23466', student: 'Tran Bao Ngoc', rp: 'rp-saigon', course: 'waikato-2', intake: 'Jul 2026', enrolled: '2026-07-25', fees: fees(41100, 8200, '2026-07-13', { census: ['2026-08-07', '2027-03-26'] }) },
  { app: 'GSP-23490', student: 'Sita Gurung', rp: 'rp-pokhara', course: 'uow-2', intake: 'Jul 2026', enrolled: '2026-07-26', fees: fees(31350, 7850, '2026-07-20', { census: ['2026-08-21', '2027-03-19'] }) },
  { app: 'GSP-23533', student: 'Le Thu Ha', rp: 'rp-hanoi', course: 'windsor-2', intake: 'Sep 2026', enrolled: '2026-09-28', fees: fees(26900, 5400, '2026-09-08', { paid: ['2026-08-28'] }) },
];

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
const rec = (id: string, uni: string, txs: string[], date: string, who = LAV): Receipt => ({ id, uni, txs, amount: null, date, by: who, at: at(date, '15:10') });
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
  { id: 'ov-1', tx: r('GSP-23490', 'p1'), amount: null, due: null, hold: true, reason: 'Himalayan Study Centre hasn’t added a bank account yet.', by: RHYTHM, at: at('2026-10-02') },
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
  banks: sampleBanks(),
  notices: sampleNotices(),
  terms: sampleTerms(),
  enrolments: sampleEnrolments(),
  invoices,
  receipts,
  requests,
  rpInvoices,
  rpPayments,
  overrides,
  ids: Object.fromEntries(NAMED.map((k, i) => [k, idText(ID_START + i + 1)])),
  idSeq: ID_START + NAMED.length,
  // what the acted-on lines were then is kept the first time the engine works them out (engine.ts, settle)
  frozen: {},
  logs: [],
  downloads: [],
  };
};
