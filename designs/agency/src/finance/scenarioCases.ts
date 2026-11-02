// @ts-nocheck -- plain JS shape so it compiles into the standalone Commissions Sandbox too.
/*
 * The commissions team's scenarios (Commission_2.xlsx, tabs IP and RP, 2 Nov) plus the combination cases, as test
 * cases for the engine. Each case is its own small world: the terms it configures, the sample students
 * (pseudonyms), what has happened to them (enrolled, invoiced, paid, withdrawn), the date it is looked at, and the
 * checks: every expected value is worked out BY HAND here (`calc` says how), never by the engine.
 *
 * Used by scripts/test-commissions.mjs (exits non-zero on any mismatch) and by the Sandbox's Commission scenarios tab.
 */

const RATES = { GBP: 1.95, USD: 1.52, NZD: 0.91, INR: 0.0175, NPR: 0.0111, BDT: 0.0126, LKR: 0.0051, VND: 0.0000585 };
const FX = (() => { const rows = []; let d = new Date(Date.UTC(2025, 11, 29)); while (d.getUTCFullYear() < 2029) { rows.push(Object.assign({ week: d.toISOString().slice(0, 10) }, RATES)); d = new Date(d.getTime() + 7 * 864e5); } return rows; })();
export const SCEN_SETTINGS = { defaultMode: 'flat', defaultPct: 70, gspLeadPct: 50, fallbackWeeks: 4, auGst: 10, rpGst: 10, wht: {}, selfCheck: true, legalDays: 90, annuityRp: 'same', annuityPct: null, rpCap: 100, regionGroups: { SEA: ['Vietnam', 'Malaysia', 'Indonesia', 'Thailand', 'Philippines', 'Singapore', 'Cambodia', 'Myanmar'], 'South Asia': ['India', 'Nepal', 'Bangladesh', 'Sri Lanka', 'Pakistan', 'Bhutan'] }, fxNote: 'Scenario rates: GBP 1.95, USD 1.52, NZD 0.91, INR 0.0175 AUD per unit, every week', fx: FX };

const NAMES = ['Anika Bose', 'Dev Kapur', 'Riya Sen', 'Vikram Iyer', 'Naina Das', 'Arnav Pillay', 'Tanvi Shah', 'Kabir Lal', 'Mira Joshi', 'Rehan Ali', 'Zoya Khan', 'Aryan Dutta', 'Ira Nair', 'Neel Ghosh', 'Saanvi Rao', 'Om Bhatt', 'Pihu Garg', 'Yash Mehra', 'Kiara Sood', 'Rudra Jain', 'Myra Chopra', 'Ayaan Sethi', 'Diya Bansal', 'Advik Arora', 'Navya Kohli', 'Reyansh Goel', 'Aditi Sinha', 'Vihan Kaul', 'Siya Batra', 'Krish Oberoi', 'Linh Pham', 'Bao Nguyen', 'Sujata Thapa', 'Bikash Gurung', 'Nuwan Fernando', 'Hana Tan', 'Farhan Siddiqui', 'Esha Varma', 'Ishan Kapadia', 'Mahi Rathore'];
let ni = 0;
const nm = () => NAMES[ni++ % NAMES.length] + ' (sample)';

const uni = (id, o) => Object.assign({ id, name: id, country: 'AU', cur: 'AUD', trigger: 'census', inst: 1, payDays: 30, cap: null, levels: { UG: 15 }, fixed: {}, tier: null, status: 'Checked', flag: '', contract: {}, annuity: null, sample: 'scenario' }, o);
const rp = (id, o) => Object.assign({ id, name: id, region: 'India', scheme: '', flat: 80, gst: false, cur: 'AUD', bank: 'AU', payee: '', mp: false, annuityPct: null, sample: 'scenario' }, o);
const app = (id, o) => { const a = Object.assign({ id, student: nm(), nationality: 'India', level: 'UG', intake: '2026-02-23', census: '2026-03-31', tuition: 30000, scholarship: 0, studentType: 'New', gspLead: false, inv: {}, paidIP: {}, paidRP: {} }, o); if (a.enrolled === undefined) a.enrolled = a.intake; return a; };
/* the university paid line `key` (invoiced, then paid), and optionally the RP was paid `rpAmt` on its line */
const paid = (a, key, inv, date, amt, rpKey, rpAmt) => { a.inv[key] = inv; a.paidIP[key] = { date, amt }; if (rpKey) a.paidRP[rpKey] = rpAmt; return a; };
const world = (o) => ({ unis: o.unis || [], rps: o.rps || [], schemes: o.schemes || [], notices: o.notices || [], groups: o.groups || [], settings: Object.assign({}, SCEN_SETTINGS, o.settings || {}) });
const byId = (list) => Object.fromEntries(list.map((a) => [a.id, a]));

/* getters on a result */
const ipl = (R, app, key) => R.ip.find((x) => x.app === app && x.l.key === key);
const rpl = (R, app, key) => R.rp.find((x) => x.app === app && x.key === key);
export const G = {
  ip: (app, key, f = 'ent') => (R) => { const x = ipl(R, app, key); if (!x) return 'no line ' + key; return f === 'st' ? x.l.st[0] : x.l[f]; },
  rp: (app, key, f = 'ent') => (R) => { const x = rpl(R, app, key); if (!x) return 'no line ' + key; return f === 'st' ? x.st[0] : x[f]; },
  ipDates: (app) => (R) => R.ip.filter((x) => x.app === app && x.l.type === 'standard').map((x) => [x.l.ent, x.l.date]),
  ipCount: (app, type) => (R) => R.ip.filter((x) => x.app === app && (!type || x.l.type === type)).length,
  rpCount: (app) => (R) => R.rp.filter((x) => x.app === app).length,
  app: (app, f) => (R) => f(R.apps[app]),
  exc: (app, type) => (R) => R.exc.some((e) => e.app === app && e.type === type),
};

const IP = 'Commission Structure for Institutions', RPH = 'Commission Structure for Agents';
const C = [];
const add = (c) => C.push(c);

/* ---------------- IP: what the university pays GSP ---------------- */
{
  const a1 = paid(app('ip1-a', { uni: 'SC-IP1A', rp: 'SC-R80' }), 'ip1', '2026-04-02', '2026-04-30', 4500);
  const a2 = paid(app('ip1-b', { uni: 'SC-IP1B', rp: 'SC-R80' }), 'ip1', '2026-04-02', '2026-04-30', 2000);
  add({ id: 'IP1', tab: 'IP', sheetNo: 'Scenario 1', title: 'Basic Commission Rate (persentage or Amount)', sheet: 'A fixed commission rate for student courses, which can be defined either as a percentage or a specific monetary amount. Examples: Percentage = 15%; Fixed amount = 2,000.',
    terms: ['Percentage university: Undergraduate 15% of the final tuition fee, paid once a year, first year only.', 'Fixed-amount university: Undergraduate AUD 2,000 per student.', 'RP on a flat 80% of GSP’s line.'],
    today: '2026-05-10', focus: 'ip1-a',
    cfg: world({ unis: [uni('SC-IP1A', { name: 'Percentage University (sample)' }), uni('SC-IP1B', { name: 'Fixed-Amount University (sample)', levels: {}, fixed: { UG: 2000 } })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId([a1, a2]),
    checks: [
      { what: 'GSP line at 15%', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip1-a', 'ip1') },
      { what: 'GST on the Australian invoice', calc: '4,500 × 10% = 450', exp: 450, got: G.ip('ip1-a', 'ip1', 'gst') },
      { what: 'GSP line at a fixed amount', calc: 'AUD 2,000 per student', exp: 2000, got: G.ip('ip1-b', 'ip1') },
      { what: 'A fixed amount is one line, not one per period', calc: '1 line', exp: 1, got: G.ipCount('ip1-b') },
      { what: 'RP share of the % line', calc: '4,500 × 80% = 3,600', exp: 3600, got: G.rp('ip1-a', 'rp1') },
      { what: 'RP share of the fixed line', calc: '2,000 × 80% = 1,600', exp: 1600, got: G.rp('ip1-b', 'rp1') },
      { what: 'RP line is payable once GSP is paid', calc: 'university paid 30 Apr', exp: 'Ready for payout', got: G.rp('ip1-a', 'rp1', 'st') },
    ] });
}
{
  const S = [1, 2, 3, 4, 5].map((i) => paid(app('ip2-0' + i, { uni: 'SC-IP2', rp: 'SC-R80', intake: '2026-09-21', census: '2026-10-16' }), 'ip1', '2026-10-20', '2026-11-20', 4500, 'rp1', 3600));
  S[0].inv['ip1~t1'] = '2027-02-25'; S[0].paidIP['ip1~t1'] = { date: '2027-03-10', amt: 1500 };
  const s6 = app('ip2-06', { uni: 'SC-IP2', rp: 'SC-R80', intake: '2027-01-25', census: '2027-02-19' });
  const s7 = app('ip2-07', { uni: 'SC-IP2', rp: 'SC-R80', intake: '2027-09-20', census: '2027-10-15' });
  add({ id: 'IP2', tab: 'IP', sheetNo: 'Scenario 2', title: 'Tiered Commission – Retrospective (Academic Year)', sheet: 'Commission is calculated retrospectively based on the total number of students/courses in the academic year. Example: 1–5 students = 15%; 6–11 = 20%; 12+ = 25%.',
    terms: ['UK university, paid in GBP. Tier: 1–5 students 15%, 6–11 20%, 12+ 25%, retrospective.', 'Counted per academic year starting September (UK: Sep–Aug), by the intake.', 'Five September 2026 students were invoiced and paid at 15%, and the RP was paid 80% of that. A sixth starts in January 2027 (same academic year). A seventh starts in September 2027 (next academic year).', 'The first student’s top-up has been invoiced and paid; the other four have not.'],
    today: '2027-10-25', focus: 'ip2-01',
    cfg: world({ unis: [uni('SC-IP2', { name: 'Northbridge University (sample)', country: 'UK', cur: 'GBP', tier: { retro: true, window: 'AY', ayStart: 9, scope: 'all', pool: 'uni', levels: [], bands: [[1, 5, 15], [6, 11, 20], [12, null, 25]] } })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId([...S, s6, s7]),
    checks: [
      { what: 'Sixth student (Jan 2027) is in AY 2026/27', calc: 'Sep 2026 to Aug 2027', exp: 'AY2026/27', got: G.app('ip2-06', (r) => r.uniTier.key) },
      { what: 'Students counted in AY 2026/27', calc: '5 in Sep 2026 + 1 in Jan 2027', exp: 6, got: G.app('ip2-06', (r) => r.uniTier.total) },
      { what: 'Sixth student at band 2', calc: '6 students → 20%; 30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip2-06', 'ip1') },
      { what: 'First student’s top-up (GSP receivable)', calc: '6,000 − 4,500 already paid = 1,500', exp: 1500, got: G.ip('ip2-01', 'ip1~t1') },
      { what: 'First student’s top-up is paid', calc: 'paid 10 Mar 2027', exp: 'Paid', got: G.ip('ip2-01', 'ip1~t1', 'st') },
      { what: 'First student’s RP top-up is payable', calc: 'GSP received 6,000; 6,000 × 80% = 4,800 − 3,600 paid = 1,200', exp: 1200, got: G.rp('ip2-01', 'rp1', 'due') },
      { what: 'Second student’s top-up is GSP’s to invoice', calc: '6,000 − 4,500 = 1,500, not yet invoiced', exp: 'Top-up to invoice', got: G.ip('ip2-02', 'ip1~t1', 'st') },
      { what: 'Second student’s RP top-up is NOT paid before GSP is', calc: 'GSP received 4,500 × 80% = 3,600 − 3,600 paid = 0', exp: 0, got: G.rp('ip2-02', 'rp1', 'due') },
      { what: 'Second student’s RP line says why', calc: '', exp: 'Paid; top-up waits for the university', got: G.rp('ip2-02', 'rp1', 'st') },
      { what: 'RP entitlement still shows the new band', calc: '6,000 × 80% = 4,800', exp: 4800, got: G.rp('ip2-02', 'rp1') },
      { what: 'Payout run pays only the top-up GSP has received', calc: 'only the first student’s 1,200', exp: 1, got: (R, X) => X.buildRun(X.cfg, R, X.today).lines.length },
      { what: 'Seventh student (Sep 2027) starts a new academic year', calc: 'AY 2027/28: 1 student → 15%; 30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip2-07', 'ip1') },
    ] });
}
{
  const P = [1, 2, 3, 4, 5].map((i) => paid(app('ip3-0' + i, { uni: 'SC-IP3', rp: 'SC-R80' }), 'ip1', '2026-04-02', '2026-04-30', 4500));
  const p6 = app('ip3-06', { uni: 'SC-IP3', rp: 'SC-R80', intake: '2026-07-20', census: '2026-08-31' });
  const p7 = app('ip3-07', { uni: 'SC-IP3', rp: 'SC-R80', intake: '2026-07-20', census: '2026-08-31' });
  add({ id: 'IP3', tab: 'IP', sheetNo: 'Scenario 3', title: 'Tiered Commission – Prospective (Academic Year)', sheet: 'Commission is calculated prospectively based on the number of students/courses achieved during the academic year. Example: 1–5 students = 15%; 6–11 = 20%; 12+ = 25%.',
    terms: ['Australian university. Tier: 1–5 students 15%, 6–11 20%, 12+ 25%, prospective.', 'Counted per academic year starting January (AU: Jan–Dec), by the intake.', 'Five February 2026 students, paid at 15%; two July 2026 students.'],
    today: '2026-09-15', focus: 'ip3-06',
    cfg: world({ unis: [uni('SC-IP3', { name: 'Southern Cross Institute (sample)', tier: { retro: false, window: 'AY', ayStart: 1, scope: 'all', pool: 'uni', levels: [], bands: [[1, 5, 15], [6, 11, 20], [12, null, 25]] } })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId([...P, p6, p7]),
    checks: [
      { what: 'Fifth student stays at band 1', calc: 'place 5 → 15%; 30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip3-05', 'ip1') },
      { what: 'No top-up for earlier students', calc: 'prospective: 1 line only', exp: 1, got: G.ipCount('ip3-01') },
      { what: 'Sixth student at band 2', calc: 'place 6 → 20%; 30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip3-06', 'ip1') },
      { what: 'Seventh student at band 2', calc: 'place 7 → 20% = 6,000', exp: 6000, got: G.ip('ip3-07', 'ip1') },
      { what: 'Window is the academic year 2026', calc: 'AU academic year Jan–Dec', exp: 'AY2026', got: G.app('ip3-07', (r) => r.uniTier.key) },
    ] });
}
{
  const mk = (i, census) => app('ip4-0' + i, { uni: 'SC-IP4', rp: 'SC-R80', census });
  const F = [mk(1, '2026-03-20'), mk(2, '2026-03-20'), mk(3, '2026-03-20'), mk(4, '2026-03-20'), mk(5, ''), mk(6, '2026-04-02')];
  const J = [7, 8].map((i) => app('ip4-0' + i, { uni: 'SC-IP4', rp: 'SC-R80', intake: '2026-07-20', census: '2026-08-14' }));
  add({ id: 'IP4', tab: 'IP', sheetNo: 'Scenario 4', title: 'Tiered Commission – Intake Wise', sheet: 'Commission tiers are calculated based on the number of students/courses within each intake. Example: 1–5 students = 15%; 6–11 = 20%; 12+ = 25%.',
    terms: ['Tier per intake: 1–5 students 15%, 6–11 20%, 12+ 25%, retrospective within the intake.', 'Six February 2026 students: four with census 20 Mar, one with no census date (start + 4 weeks), one with census 2 Apr. Two July 2026 students.'],
    today: '2026-09-01', focus: 'ip4-06',
    cfg: world({ unis: [uni('SC-IP4', { name: 'Harbourview College (sample)', tier: { retro: true, window: 'intake', scope: 'all', pool: 'uni', levels: [], bands: [[1, 5, 15], [6, 11, 20], [12, null, 25]] } })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId([...F, ...J]),
    checks: [
      { what: 'April-census student counts in the February intake', calc: 'intake Feb 2026, not census month', exp: 'Intake Feb 2026', got: G.app('ip4-06', (r) => r.uniTier.key) },
      { what: 'February intake has 6 students', calc: '', exp: 6, got: G.app('ip4-06', (r) => r.uniTier.total) },
      { what: 'April-census student at band 2', calc: '6 → 20%; 30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip4-06', 'ip1') },
      { what: 'No-census student at band 2', calc: '6 → 20% = 6,000', exp: 6000, got: G.ip('ip4-05', 'ip1') },
      { what: 'First February student at band 2 (retrospective in the intake)', calc: '6 → 20% = 6,000', exp: 6000, got: G.ip('ip4-01', 'ip1') },
      { what: 'July intake counts on its own', calc: '2 students → 15%; 30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip4-07', 'ip1') },
    ] });
}
{
  const e1 = app('ip5-01', { uni: 'SC-IP5', rp: 'SC-R80', courseYears: 3, yearFees: [30000, 32000] });
  add({ id: 'IP5', tab: 'IP', sheetNo: 'Scenario 5', title: 'Different commission on students study period', sheet: "Different commission rates may apply depending on the student's study period or semester. Example: 1st Semester = 20%; 2nd Semester = 10%, 3rd Semester=5%.",
    terms: ['Paid each semester, chargeable for 3 semesters.', 'Rate rows: study period 1 → 20%, period 2 → 10%, period 3 → 5%.', 'Student: 3-year degree, fees on the application 30,000 (year 1) and 32,000 (year 2). Census 31 Mar 2026.'],
    today: '2027-04-10', focus: 'ip5-01',
    cfg: world({ unis: [uni('SC-IP5', { name: 'Riverside University (sample)', levels: {}, rates: [{ period: 1, pct: 20 }, { period: 2, pct: 10 }, { period: 3, pct: 5 }], pay: 'semester', charge: { unit: 'semester', n: 3 } })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId([e1]),
    checks: [
      { what: 'Three chargeable semesters', calc: '3 lines', exp: 3, got: G.ipCount('ip5-01', 'standard') },
      { what: 'Semester 1', calc: '30,000 ÷ 2 = 15,000 × 20% = 3,000 on 31 Mar 2026', exp: [3000, '2026-03-31'], got: (R) => G.ipDates('ip5-01')(R)[0] },
      { what: 'Semester 2', calc: '15,000 × 10% = 1,500 on 31 Aug 2026 (+5 months)', exp: [1500, '2026-08-31'], got: (R) => G.ipDates('ip5-01')(R)[1] },
      { what: 'Semester 3 uses year 2’s own fee', calc: '32,000 ÷ 2 = 16,000 × 5% = 800 on 31 Mar 2027', exp: [800, '2027-03-31'], got: (R) => G.ipDates('ip5-01')(R)[2] },
      { what: 'RP share of semester 3', calc: '800 × 80% = 640', exp: 640, got: G.rp('ip5-01', 'rpY2-1') },
    ] });
}
{
  const L = [['ip6-01', 'UG', 'Nursing', 30000], ['ip6-02', 'UG', 'Business', 30000], ['ip6-03', 'PG', 'IT', 30000], ['ip6-04', 'VET', 'Carpentry', 25000], ['ip6-05', 'ELICOS', 'General English', 10000], ['ip6-06', 'PG', 'Nursing', 30000]].map(([id, level, course, tuition]) => app(id, { uni: 'SC-IP6', rp: 'SC-R80', level, course, tuition }));
  add({ id: 'IP6', tab: 'IP', sheetNo: 'Scenario 6', title: 'Different Commission Rates by Course Sector or Course', sheet: 'Commission rates vary by course sector or individual course. Example sectors: UG, PG, VET, English. Rates may also differ by specific courses such as Nursing, IT, Management, etc.',
    terms: ['Level (sector) table: UG 15%, PG 12%, VET 10%, English (ELICOS) 20%.', 'Rate row 1: UG · Nursing → 18%. Rate row 2: any level · IT → 17%.', 'A matching row beats the level table; the most specific row wins.'],
    today: '2026-05-01', focus: 'ip6-01',
    cfg: world({ unis: [uni('SC-IP6', { name: 'Coastal University (sample)', levels: { UG: 15, PG: 12, VET: 10, ELICOS: 20 }, rates: [{ level: 'UG', course: 'Nursing', pct: 18 }, { course: 'IT', pct: 17 }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'UG Nursing (course rate)', calc: '30,000 × 18% = 5,400', exp: 5400, got: G.ip('ip6-01', 'ip1') },
      { what: 'UG Business (sector rate)', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip6-02', 'ip1') },
      { what: 'PG IT (course rate beats PG 12%)', calc: '30,000 × 17% = 5,100', exp: 5100, got: G.ip('ip6-03', 'ip1') },
      { what: 'VET', calc: '25,000 × 10% = 2,500', exp: 2500, got: G.ip('ip6-04', 'ip1') },
      { what: 'English (ELICOS)', calc: '10,000 × 20% = 2,000', exp: 2000, got: G.ip('ip6-05', 'ip1') },
      { what: 'PG Nursing (the Nursing row is UG only)', calc: '30,000 × 12% = 3,600', exp: 3600, got: G.ip('ip6-06', 'ip1') },
    ] });
}
{
  const L = [['ip7-01', 'India'], ['ip7-02', 'Nepal'], ['ip7-03', 'Vietnam'], ['ip7-04', 'Malaysia']].map(([id, nationality]) => app(id, { uni: 'SC-IP7', rp: 'SC-R80', nationality }));
  add({ id: 'IP7', tab: 'IP', sheetNo: 'Scenario 7', title: 'Different Commission Rates by Region', sheet: "Commission rates vary based on the student's recruitment/source region. Example regions: India, Nepal, Vietnam, Sri Lanka, etc.",
    terms: ['Level table: UG 15%.', 'Rate rows: students from Nepal → 18%; students from SEA (Vietnam, Malaysia, Indonesia, Thailand, Philippines, Singapore, Cambodia, Myanmar) → 16%.'],
    today: '2026-05-01', focus: 'ip7-02',
    cfg: world({ unis: [uni('SC-IP7', { name: 'Lakeside University (sample)', rates: [{ region: 'Nepal', pct: 18 }, { region: 'SEA', pct: 16 }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'India (no region row)', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip7-01', 'ip1') },
      { what: 'Nepal', calc: '30,000 × 18% = 5,400', exp: 5400, got: G.ip('ip7-02', 'ip1') },
      { what: 'Vietnam (in SEA)', calc: '30,000 × 16% = 4,800', exp: 4800, got: G.ip('ip7-03', 'ip1') },
      { what: 'Malaysia (in SEA)', calc: '30,000 × 16% = 4,800', exp: 4800, got: G.ip('ip7-04', 'ip1') },
    ] });
}
{
  const L = [['ip8-01', 'Nursing', 'India'], ['ip8-02', 'Nursing', 'Vietnam'], ['ip8-03', 'Business', 'Vietnam'], ['ip8-04', 'Business', 'India'], ['ip8-05', 'Nursing', 'Nepal']].map(([id, course, nationality]) => app(id, { uni: 'SC-IP8', rp: 'SC-R80', course, nationality }));
  add({ id: 'IP8', tab: 'IP', sheetNo: 'Scenario 8', title: 'Different Commission Rates by Course and Region', sheet: "Commission rates vary based on both the course/sector and the student's region. For example, the commission for an UG course may differ between India and Vietnam.",
    terms: ['Level table: UG 15%.', 'Rate rows: Nursing + India → 20%; Nursing + Vietnam → 22%; Vietnam (any course) → 16%.'],
    today: '2026-05-01', focus: 'ip8-02',
    cfg: world({ unis: [uni('SC-IP8', { name: 'Meridian University (sample)', rates: [{ course: 'Nursing', region: 'India', pct: 20 }, { course: 'Nursing', region: 'Vietnam', pct: 22 }, { region: 'Vietnam', pct: 16 }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Nursing, India', calc: '30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip8-01', 'ip1') },
      { what: 'Nursing, Vietnam (2 keys beat 1)', calc: '30,000 × 22% = 6,600', exp: 6600, got: G.ip('ip8-02', 'ip1') },
      { what: 'Business, Vietnam', calc: '30,000 × 16% = 4,800', exp: 4800, got: G.ip('ip8-03', 'ip1') },
      { what: 'Business, India', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip8-04', 'ip1') },
      { what: 'Nursing, Nepal (no row for Nepal)', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip8-05', 'ip1') },
    ] });
}
{
  const J = { intake: '2026-07-13', census: '2026-08-14' };
  const L = [app('ip9-01', Object.assign({ uni: 'SC-IP9', rp: 'SC-R80', nationality: 'India' }, J)), app('ip9-02', Object.assign({ uni: 'SC-IP9', rp: 'SC-R80', nationality: 'Vietnam' }, J)), app('ip9-03', Object.assign({ uni: 'SC-IP9', rp: 'SC-R80', nationality: 'Nepal' }, J)), app('ip9-04', { uni: 'SC-IP9', rp: 'SC-R80', nationality: 'India', intake: '2027-02-22', census: '2027-03-31' })];
  add({ id: 'IP9', tab: 'IP', sheetNo: 'Scenario 9', title: 'Promotional Commission Rates by Region', sheet: 'Temporary or promotional commission rates are offered for specific regions. Example: Promotional rates applicable only to Southeast Asia (SEA) and India.',
    terms: ['Standard: UG 15%.', 'University promotion “SEA and India”: 20% for students from SEA or India, intakes 1 Jan to 31 Dec 2026; highest wins.'],
    today: '2027-04-15', focus: 'ip9-02',
    cfg: world({ unis: [uni('SC-IP9', { name: 'Eastgate University (sample)', promos: [{ id: 'P9', name: 'SEA and India promotion', from: '2026-01-01', to: '2026-12-31', regions: ['SEA', 'India'], pct: 20, combine: 'highest' }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'India, July 2026', calc: '30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip9-01', 'ip1') },
      { what: 'Vietnam (SEA), July 2026', calc: '30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip9-02', 'ip1') },
      { what: 'Nepal: outside the promotion', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip9-03', 'ip1') },
      { what: 'India, Feb 2027: after the window', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip9-04', 'ip1') },
      { what: 'RP share follows GSP’s promoted line', calc: '6,000 × 80% = 4,800', exp: 4800, got: G.rp('ip9-01', 'rp1') },
    ] });
}
{
  const L = [app('ip10-01', { uni: 'SC-IP10', rp: 'SC-R80', intake: '2026-07-13', census: '2026-08-14', enrolled: '2026-06-15' }), app('ip10-02', { uni: 'SC-IP10', rp: 'SC-R80' }), app('ip10-03', { uni: 'SC-IP10', rp: 'SC-R80', intake: '2026-08-10', census: '2026-09-04' }), app('ip10-04', { uni: 'SC-IP10', rp: 'SC-R80', intake: '2027-02-22', census: '2027-03-31' })];
  add({ id: 'IP10', tab: 'IP', sheetNo: 'Scenario 10', title: 'Promotional Commission Rates by Intake or Academic Year', sheet: 'Temporary or promotional commission rates are offered for specific intakes or academic years. Example: A promotional commission rate applicable only to the July 2026 intake.',
    terms: ['Standard: UG 15%.', 'Promotion “July 2026 intake”: 20%, intake July 2026 only.', 'Promotion “Academic year 2027”: 18%, intakes 1 Jan to 31 Dec 2027.', 'Matched on the intake start, not on the date the enrolment was marked.'],
    today: '2027-04-15', focus: 'ip10-01',
    cfg: world({ unis: [uni('SC-IP10', { name: 'Westbury University (sample)', promos: [{ id: 'P10a', name: 'July 2026 intake promotion', intakes: ['2026-07'], pct: 20, combine: 'highest' }, { id: 'P10b', name: 'Academic year 2027 promotion', from: '2027-01-01', to: '2027-12-31', pct: 18, combine: 'highest' }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'July 2026 intake, enrolment marked in June', calc: 'intake July 2026 → 30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip10-01', 'ip1') },
      { what: 'February 2026 intake', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip10-02', 'ip1') },
      { what: 'August 2026 intake', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip10-03', 'ip1') },
      { what: 'February 2027 intake (AY 2027 promotion)', calc: '30,000 × 18% = 5,400', exp: 5400, got: G.ip('ip10-04', 'ip1') },
    ] });
}
{
  const L = [['ip11-01', 'UG', 'Nursing'], ['ip11-02', 'UG', 'Business'], ['ip11-03', 'PG', 'Business'], ['ip11-04', 'PG', 'IT']].map(([id, level, course]) => app(id, { uni: 'SC-IP11', rp: 'SC-R80', level, course }));
  add({ id: 'IP11', tab: 'IP', sheetNo: 'Scenario 11', title: 'Promotional Commission Rates by Course or Course Sector', sheet: 'Temporary or promotional commission rates are offered for specific courses or course sectors. Example: A promotional commission rate applicable only to Nursing or IT or Managemsnt courses or the UG or PG course sector.',
    terms: ['Standard: UG 15%, PG 15%.', 'Promotion “Nursing and IT”: 20% for Nursing or IT, intakes in 2026.', 'Promotion “PG sector”: 17% for PG, intakes in 2026. Highest wins.'],
    today: '2026-05-01', focus: 'ip11-04',
    cfg: world({ unis: [uni('SC-IP11', { name: 'Northshore University (sample)', levels: { UG: 15, PG: 15 }, promos: [{ id: 'P11a', name: 'Nursing and IT promotion', courses: ['Nursing', 'IT'], from: '2026-01-01', to: '2026-12-31', pct: 20, combine: 'highest' }, { id: 'P11b', name: 'PG sector promotion', levels: ['PG'], from: '2026-01-01', to: '2026-12-31', pct: 17, combine: 'highest' }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'UG Nursing', calc: '30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip11-01', 'ip1') },
      { what: 'UG Business (no promotion)', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip11-02', 'ip1') },
      { what: 'PG Business (sector promotion)', calc: '30,000 × 17% = 5,100', exp: 5100, got: G.ip('ip11-03', 'ip1') },
      { what: 'PG IT (both: highest wins)', calc: 'max(20%, 17%) → 30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip11-04', 'ip1') },
    ] });
}
{
  const at = (u, ids) => ids.map((id) => app(id, { uni: u, rp: 'SC-R80' }));
  const L = [...at('SC-12A', ['ip12-a1', 'ip12-a2', 'ip12-a3']), ...at('SC-12B', ['ip12-b1', 'ip12-b2']), ...at('SC-12C', ['ip12-c1', 'ip12-c2'])];
  add({ id: 'IP12', tab: 'IP', sheetNo: 'Scenario 12', title: 'Institution / Institution Partner Tier', sheet: 'Commission or bonus can be determined according to an institution or Institution partner tier. This may support institution-specific tiers or Institution partner tiers applied across the wider like Navitas group.\nInstitition wise tiers (particular Institution under Navitas)\nInstitution partners wise tier (Navitas as whole)',
    terms: ['University group “Group partner (sample)” with colleges A, B and C (Finance › University groups). Group tier: 1–5 students 15%, 6+ 18%, retrospective, calendar year.', 'College A also has its own tier: 1–2 students 15%, 3+ 20%, retrospective.', 'Colleges B and C have no tier of their own (UG 15%). Their students still count toward the group.', 'College tier and group tier: the higher rate wins.'],
    today: '2026-05-01', focus: 'ip12-b1',
    cfg: world({ unis: [uni('SC-12A', { name: 'Group College A (sample)', tier: { retro: true, window: 'CY', scope: 'all', pool: 'uni', levels: [], bands: [[1, 2, 15], [3, null, 20]] } }), uni('SC-12B', { name: 'Group College B (sample)' }), uni('SC-12C', { name: 'Group College C (sample)' })], groups: [{ id: 'SC-GRP', name: 'Group partner (sample)', members: ['SC-12A', 'SC-12B', 'SC-12C'], tier: { retro: true, window: 'CY', scope: 'all', levels: [], bands: [[1, 5, 15], [6, null, 18]] } }], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Group count includes college C (no tier of its own)', calc: '3 + 2 + 2 = 7', exp: 7, got: G.app('ip12-b1', (r) => r.uniTier.total) },
      { what: 'College B student at the group band', calc: '7 → 18%; 30,000 × 18% = 5,400', exp: 5400, got: G.ip('ip12-b1', 'ip1') },
      { what: 'College C student at the group band', calc: '7 → 18% = 5,400', exp: 5400, got: G.ip('ip12-c1', 'ip1') },
      { what: 'College A: own tier beats group tier', calc: 'college 3 → 20% vs group 18%: 20%; 30,000 × 20% = 6,000', exp: 6000, got: G.ip('ip12-a1', 'ip1') },
      { what: 'College A’s winning tier is the college’s', calc: '', exp: 'college', got: G.app('ip12-a1', (r) => r.uniTier.who) },
    ] });
}
{
  const L = [app('ip13-g', { uni: 'SC-13G', rp: 'SC-R80', tuition: 25000, scholarship: 5000 }), app('ip13-n', { uni: 'SC-13N', rp: 'SC-R80', tuition: 25000, scholarship: 5000 })];
  add({ id: 'IP13', tab: 'IP', sheetNo: 'Scenario 13', title: 'Gross/Net', sheet: 'Defines whether commission is calculated on Gross Tuition Fees or Net Tuition Fees.',
    terms: ['Gross university: “Commission on gross fee”, UG 15%.', 'Net university: UG 15% on the final tuition fee.', 'Both students: final tuition fee 25,000 (after a 5,000 scholarship, as on the CoE); scholarship 5,000 on the application.'],
    today: '2026-05-01', focus: 'ip13-g',
    cfg: world({ unis: [uni('SC-13G', { name: 'Gross-Fee University (sample)', basis: 'gross' }), uni('SC-13N', { name: 'Net-Fee University (sample)', basis: 'net' })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Gross: fee plus scholarship', calc: '(25,000 + 5,000) × 15% = 4,500', exp: 4500, got: G.ip('ip13-g', 'ip1') },
      { what: 'Net: final tuition fee', calc: '25,000 × 15% = 3,750', exp: 3750, got: G.ip('ip13-n', 'ip1') },
      { what: 'RP on gross', calc: '4,500 × 80% = 3,600', exp: 3600, got: G.rp('ip13-g', 'rp1') },
      { what: 'RP on net', calc: '3,750 × 80% = 3,000', exp: 3000, got: G.rp('ip13-n', 'rp1') },
    ] });
}
{
  const units = [1, 2, 3, 4, 5, 6].map((i) => ({ name: 'Unit ' + i, fee: 3000, census: '2026-0' + (2 + i) + '-15' }));
  const L = [app('ip14-y', { uni: 'SC-14Y', rp: 'SC-R80', courseYears: 3, yearFees: [30000, 31000, 32000] }), app('ip14-s', { uni: 'SC-14S', rp: 'SC-R80', courseYears: 3, yearFees: [30000, 31000] }), app('ip14-u', { uni: 'SC-14U', rp: 'SC-R80', units }), app('ip14-f', { uni: 'SC-14F', rp: 'SC-R80', feePayments: [{ date: '2026-03-01', amt: 12000 }, { date: '2026-08-01', amt: 12000 }] })];
  add({ id: 'IP14', tab: 'IP', sheetNo: 'Scenario 14', title: 'Commission Chargable time', sheet: 'If the commission is Chargable  For how many Year /Semster /Term /unit/fees paid by student wise ',
    terms: ['A: paid yearly, chargeable 2 years (3-year course; fees 30,000 / 31,000 / 32,000).', 'B: paid each semester, chargeable 3 semesters (fees 30,000 / 31,000).', 'C: paid per unit, chargeable 4 units (6 units of 3,000).', 'D: paid on fees paid, chargeable on the first 20,000 the student pays (payments 12,000 and 12,000).', 'All UG 15%.'],
    today: '2027-04-15', focus: 'ip14-s',
    cfg: world({ unis: [uni('SC-14Y', { name: 'Chargeable 2 Years Uni (sample)', pay: 'year', charge: { unit: 'year', n: 2 } }), uni('SC-14S', { name: 'Chargeable 3 Semesters Uni (sample)', pay: 'semester', charge: { unit: 'semester', n: 3 } }), uni('SC-14U', { name: 'Chargeable 4 Units Uni (sample)', pay: 'unit', charge: { unit: 'unit', n: 4 } }), uni('SC-14F', { name: 'Chargeable First 20,000 Uni (sample)', pay: 'fees', charge: { unit: 'fees', n: 20000 } })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'A: 2 years', calc: '2 lines', exp: 2, got: G.ipCount('ip14-y', 'standard') },
      { what: 'A: year 2 uses its own fee', calc: '31,000 × 15% = 4,650', exp: 4650, got: G.ip('ip14-y', 'an2-1') },
      { what: 'B: 3 semesters', calc: '3 lines', exp: 3, got: G.ipCount('ip14-s', 'standard') },
      { what: 'B: semester 3 (year 2 fee)', calc: '31,000 ÷ 2 = 15,500 × 15% = 2,325', exp: 2325, got: G.ip('ip14-s', 'an2-1') },
      { what: 'C: 4 of 6 units', calc: '4 lines', exp: 4, got: G.ipCount('ip14-u', 'standard') },
      { what: 'C: each unit', calc: '3,000 × 15% = 450', exp: 450, got: G.ip('ip14-u', 'un4') },
      { what: 'D: first payment', calc: '12,000 × 15% = 1,800', exp: 1800, got: G.ip('ip14-f', 'fp1') },
      { what: 'D: second payment, only 8,000 chargeable', calc: '(20,000 − 12,000) × 15% = 1,200', exp: 1200, got: G.ip('ip14-f', 'fp2') },
    ] });
}
{
  const L = [app('ip15-y', { uni: 'SC-15Y', rp: 'SC-R80', courseYears: 3 }), app('ip15-t', { uni: 'SC-15T', rp: 'SC-R80' }), app('ip15-q1', { uni: 'SC-15Q', rp: 'SC-R80', periods: [{ census: '2026-02-27' }, { census: '2026-05-29' }, { census: '2026-08-28' }, { census: '2026-11-27' }] }), app('ip15-q2', { uni: 'SC-15Q', rp: 'SC-R80' }), app('ip15-u', { uni: 'SC-15U', rp: 'SC-R80', units: [{ name: 'Anatomy', fee: 2500, census: '2026-03-15' }, { name: 'Chemistry', fee: 2500, census: '2026-04-15' }, { name: 'Ethics', fee: 2500, census: '2026-05-15' }] }), app('ip15-f', { uni: 'SC-15F', rp: 'SC-R80', feePayments: [{ date: '2026-03-01', amt: 15000 }, { date: '2026-08-01', amt: 15000 }] })];
  add({ id: 'IP15', tab: 'IP', sheetNo: 'Scenario 15', title: 'Commission Paid by Yearly/Semsterwise/Term /unit/fees', sheet: 'If the commission is paid by Year wise/Semster wise/Term /unit/fees paid by student wise ',
    terms: ['Yearly, whole course (3 years; no later-year fees on the application, so year 1’s fee repeats, flagged).', 'Each trimester, first year.', 'Each term (4 a year), first year: one student with the term census dates on the application, one without.', 'Per unit, each on its own census date.', 'On each fee payment, dated the payment.', 'All UG 15%, first census 31 Mar 2026 unless the application says otherwise.'],
    today: '2026-12-01', focus: 'ip15-q2',
    cfg: world({ unis: [uni('SC-15Y', { name: 'Paid Yearly Uni (sample)', pay: 'year', charge: { unit: 'course' } }), uni('SC-15T', { name: 'Paid per Trimester Uni (sample)', pay: 'trimester', charge: { unit: 'year', n: 1 } }), uni('SC-15Q', { name: 'Paid per Term Uni (sample)', pay: 'term', charge: { unit: 'year', n: 1 } }), uni('SC-15U', { name: 'Paid per Unit Uni (sample)', pay: 'unit', charge: { unit: 'course' } }), uni('SC-15F', { name: 'Paid on Fees Paid Uni (sample)', pay: 'fees', charge: { unit: 'fees', n: null } })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Yearly: one line a year, each its own date', calc: '30,000 × 15% = 4,500 on 31 Mar 2026, 2027, 2028', exp: [[4500, '2026-03-31'], [4500, '2027-03-31'], [4500, '2028-03-31']], got: G.ipDates('ip15-y') },
      { what: 'Trimester: no date slips into December', calc: '10,000 × 15% = 1,500 on 31 Mar, 31 Jul, 30 Nov', exp: [[1500, '2026-03-31'], [1500, '2026-07-31'], [1500, '2026-11-30']], got: G.ipDates('ip15-t') },
      { what: 'Term: each term its own census date from the application', calc: '7,500 × 15% = 1,125 on each', exp: [[1125, '2026-02-27'], [1125, '2026-05-29'], [1125, '2026-08-28'], [1125, '2026-11-27']], got: G.ipDates('ip15-q1') },
      { what: 'Term: no dates on the application, 3 months apart', calc: '1,125 on 31 Mar, 30 Jun, 30 Sep, 31 Dec', exp: [[1125, '2026-03-31'], [1125, '2026-06-30'], [1125, '2026-09-30'], [1125, '2026-12-31']], got: G.ipDates('ip15-q2') },
      { what: 'Per unit, on each unit’s census', calc: '2,500 × 15% = 375 on 15 Mar, 15 Apr, 15 May', exp: [[375, '2026-03-15'], [375, '2026-04-15'], [375, '2026-05-15']], got: G.ipDates('ip15-u') },
      { what: 'On fees paid, dated the payment', calc: '15,000 × 15% = 2,250 on 1 Mar and 1 Aug', exp: [[2250, '2026-03-01'], [2250, '2026-08-01']], got: G.ipDates('ip15-f') },
    ] });
}
{
  const L = [['ip16-01', 'Sydney'], ['ip16-02', 'Melbourne'], ['ip16-03', 'Online']].map(([id, campus]) => app(id, { uni: 'SC-IP16', rp: 'SC-R80', campus }));
  add({ id: 'IP16', tab: 'IP', sheetNo: 'Scenario 16', title: 'Campus', sheet: 'Commission rates can vary by the specific campus of an institution.',
    terms: ['Level table: UG 15%.', 'Rate rows: Melbourne campus → 17%; Sydney campus → 15%.'],
    today: '2026-05-01', focus: 'ip16-02',
    cfg: world({ unis: [uni('SC-IP16', { name: 'Two-Campus University (sample)', rates: [{ campus: 'Melbourne', pct: 17 }, { campus: 'Sydney', pct: 15 }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Sydney campus', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip16-01', 'ip1') },
      { what: 'Melbourne campus', calc: '30,000 × 17% = 5,100', exp: 5100, got: G.ip('ip16-02', 'ip1') },
      { what: 'Online (no campus row: level table)', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip16-03', 'ip1') },
    ] });
}
{
  const L = [app('ip17-01', { uni: 'SC-IP17', rp: 'SC-R80', intake: '2023-07-17', census: '2023-08-31' }), app('ip17-02', { uni: 'SC-IP17', rp: 'SC-R80' }), app('ip17-03', { uni: 'SC-IP17', rp: 'SC-R80', intake: '2026-07-13', census: '2026-08-14' }), app('ip17-04', { uni: 'SC-IP17', rp: 'SC-R80', intake: '2028-02-21', census: '2028-03-31' })];
  add({ id: 'IP17', tab: 'IP', sheetNo: 'Scenario 17', title: 'Agreement dates', sheet: 'Defines the period during which the commission agreement is active, including effective-from and effective-to dates.',
    terms: ['Agreement in force 1 Jan 2024 to 31 Dec 2027.', 'Original terms: UG 15%. Version 2 from 1 Jul 2026: UG 18% (S5-2: each enrolment uses the version in force on its intake).'],
    today: '2028-04-15', focus: 'ip17-03',
    cfg: world({ unis: [uni('SC-IP17', { name: 'Dated-Agreement University (sample)', starts: '2024-01-01', ends: '2027-12-31', versions: [{ id: 'v2', label: 'Version 2 (rate rise)', from: '2026-07-01', set: { levels: { UG: 18 } } }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Intake before the agreement: held', calc: 'Jul 2023 < 1 Jan 2024', exp: 'Held: agreement not yet in force', got: G.ip('ip17-01', 'ip1', 'st') },
      { what: 'Held intake goes to exceptions', calc: '', exp: true, got: G.exc('ip17-01', 'Agreement not yet in force') },
      { what: 'Feb 2026 intake: original terms', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip17-02', 'ip1') },
      { what: 'Jul 2026 intake: version 2', calc: '30,000 × 18% = 5,400', exp: 5400, got: G.ip('ip17-03', 'ip1') },
      { what: 'Intake after the agreement ends: held', calc: 'Feb 2028 > 31 Dec 2027', exp: 'Held: contract ended', got: G.ip('ip17-04', 'ip1', 'st') },
    ] });
}
{
  const J = { intake: '2026-09-21', census: '2026-10-16' };
  const L = [app('ip18-g', Object.assign({ uni: 'SC-18G', rp: 'SC-R80', tuition: 20000 }, J)), app('ip18-u', Object.assign({ uni: 'SC-18U', rp: 'SC-R80', tuition: 20000 }, J)), app('ip18-z', Object.assign({ uni: 'SC-18Z', rp: 'SC-R80', tuition: 25000 }, J))];
  add({ id: 'IP18', tab: 'IP', sheetNo: 'Scenario 18', title: 'Currencies ', sheet: 'Defines the currency in which the institution pays the commission. Example: AUD, USD, GBP, INR.',
    terms: ['UK university pays in GBP, US university in USD, NZ university in NZD; each UG 15%.', 'AUD view at the week’s rate for the trigger date: GBP 1.95, USD 1.52, NZD 0.91 AUD per unit.'],
    today: '2026-11-01', focus: 'ip18-g',
    cfg: world({ unis: [uni('SC-18G', { name: 'GBP University (sample)', country: 'UK', cur: 'GBP' }), uni('SC-18U', { name: 'USD University (sample)', country: 'US', cur: 'USD' }), uni('SC-18Z', { name: 'NZD University (sample)', country: 'NZ', cur: 'NZD' })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'GBP line', calc: '20,000 × 15% = GBP 3,000', exp: 3000, got: G.ip('ip18-g', 'ip1') },
      { what: 'GBP in AUD', calc: '3,000 × 1.95 = AUD 5,850', exp: 5850, got: G.ip('ip18-g', 'ip1', 'aud') },
      { what: 'USD in AUD', calc: '3,000 × 1.52 = AUD 4,560', exp: 4560, got: G.ip('ip18-u', 'ip1', 'aud') },
      { what: 'NZD in AUD', calc: '25,000 × 15% = 3,750 × 0.91 = AUD 3,412.50', exp: 3412.5, got: G.ip('ip18-z', 'ip1', 'aud') },
      { what: 'No GST outside Australia', calc: '', exp: 0, got: G.ip('ip18-g', 'ip1', 'gst') },
    ] });
}
{
  const L = [app('ip19-01', { uni: 'SC-IP19', rp: 'SC-R80', course: 'Business' }), app('ip19-02', { uni: 'SC-IP19', rp: 'SC-R80', level: 'PG', course: 'Business' }), app('ip19-03', { uni: 'SC-IP19', rp: 'SC-R80', course: 'Nursing', intake: '2026-07-20', census: '2026-08-31' })];
  add({ id: 'IP19', tab: 'IP', sheetNo: 'Scenario 19', title: 'Course Commission/Bonu/Additional commission ', sheet: 'Identifies whether the configured amount represents a standard course commission, bonus, or additional commission.',
    terms: ['Standard commission: UG 15%, PG 15%.', 'Tier (prospective, calendar year): 1–2 students 15%; 3+ 15% plus a band bonus of AUD 500 per student.', 'Bonus scheme “PG bonus”: 2% of the first-year fee per PG student.', 'Bonus scheme “3rd enrolment bonus”: AUD 2,000 once 3 students enrol in the calendar year.', 'Additional commission: 5% for Nursing, intakes in 2026.', 'Bonuses are GSP’s; additional commission is shared with the RP.'],
    today: '2026-09-15', focus: 'ip19-03',
    cfg: world({ unis: [uni('SC-IP19', { name: 'Bonus University (sample)', levels: { UG: 15, PG: 15 }, tier: { retro: false, window: 'CY', scope: 'all', pool: 'uni', levels: [], bands: [[1, 2, 15], [3, null, 15]], bandBonus: { 2: { kind: 'fixed', v: 500 } } }, bonuses: [{ id: 'B1', name: 'PG bonus', kind: 'pct', v: 2, per: 'student', levels: ['PG'] }, { id: 'B2', name: '3rd enrolment bonus', kind: 'fixed', v: 2000, per: 'threshold', threshold: 3, window: 'CY' }], promos: [{ id: 'A1', name: 'Nursing additional commission', courses: ['Nursing'], pct: 5, combine: 'additional', from: '2026-01-01', to: '2026-12-31' }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Standard commission', calc: '30,000 × 15% = 4,500', exp: 4500, got: G.ip('ip19-01', 'ip1') },
      { what: 'First student has no bonus', calc: 'standard line only', exp: 1, got: G.ipCount('ip19-01') },
      { what: 'PG bonus (% per student)', calc: '30,000 × 2% = 600', exp: 600, got: G.ip('ip19-02', 'bo-B1') },
      { what: 'Band bonus on the 3rd student', calc: 'band 2: AUD 500', exp: 500, got: G.ip('ip19-03', 'ipb') },
      { what: 'Scheme bonus on the 3rd enrolment', calc: 'AUD 2,000 lump sum', exp: 2000, got: G.ip('ip19-03', 'bo-B2') },
      { what: 'Additional commission', calc: '30,000 × 5% = 1,500', exp: 1500, got: G.ip('ip19-03', 'ad-A1-1') },
      { what: 'RP shares the additional commission', calc: '1,500 × 80% = 1,200', exp: 1200, got: G.rp('ip19-03', 'rpA1-A1') },
      { what: 'RP gets no bonus lines', calc: 'standard + additional = 2 lines', exp: 2, got: G.rpCount('ip19-03') },
    ] });
}

/* ---------------- RP: what GSP pays the RP ---------------- */
const U15 = uni('SC-RPU', { name: 'Partner University (sample)' });
const paidU = (a) => paid(a, 'ip1', '2026-04-02', '2026-04-30', 4500);
{
  const L = [['rp1-80', 'SC-R80'], ['rp1-75', 'SC-R75'], ['rp1-70', 'SC-R70']].map(([id, r]) => paidU(app(id, { uni: 'SC-RPU', rp: r })));
  add({ id: 'RP1', tab: 'RP', sheetNo: 'Scenario 1', title: 'Basic Commission Rates – No Promotion or Tier', sheet: 'Fixed commission rates with no tiering or promotional adjustments. Example: 80%, 75%, or 70%, depending on the applicable agreement.',
    terms: ['Three RPs on their own flat rates: 80%, 75%, 70% of GSP’s line.', 'GSP’s line: 30,000 × 15% = 4,500, paid by the university.'],
    today: '2026-05-10', focus: 'rp1-75',
    cfg: world({ unis: [U15], rps: [rp('SC-R80', { name: 'Flat 80 Partners (sample)' }), rp('SC-R75', { name: 'Flat 75 Partners (sample)', flat: 75 }), rp('SC-R70', { name: 'Flat 70 Partners (sample)', flat: 70 })] }),
    apps: byId(L),
    checks: [
      { what: '80%', calc: '4,500 × 80% = 3,600', exp: 3600, got: G.rp('rp1-80', 'rp1') },
      { what: '75%', calc: '4,500 × 75% = 3,375', exp: 3375, got: G.rp('rp1-75', 'rp1') },
      { what: '70%', calc: '4,500 × 70% = 3,150', exp: 3150, got: G.rp('rp1-70', 'rp1') },
    ] });
}
{
  const L = Array.from({ length: 10 }, (_, i) => paidU(app('rp2-' + String(i + 1).padStart(2, '0'), { uni: 'SC-RPU', rp: 'SC-RP2' })));
  const lead = paidU(app('rp2-lead', { uni: 'SC-RPU', rp: 'SC-RP2', gspLead: true, enrolReady: true }));
  add({ id: 'RP2', tab: 'RP', sheetNo: 'Scenario 2', title: 'Tiered Commission – Retrospective', sheet: 'Commission is calculated retrospectively based on the total number of students/enrolments achieved during the applicable period. Example: 1–4 students = 70%; 5–9 = 75%; 10+ = 80%. Special lead arrangement: 50% commission applies when GSP provides the RP with a qualified student lead and the RP provides an enrolment-ready application.',
    terms: ['Scheme: 1–4 students 70%, 5–9 75%, 10+ 80%, retrospective, calendar year by intake.', 'Ten February 2026 students, all paid by the university (4,500 each).', 'One more student is a special lead: GSP gave the lead and the RP’s application was enrolment-ready.'],
    today: '2026-05-15', focus: 'rp2-01',
    cfg: world({ unis: [U15], schemes: [{ id: 'SC-S2', name: 'Retrospective 70/75/80 (sample)', region: 'All', type: 'tier', bands: [[1, 4, 70], [5, 9, 75], [10, null, 80]], retro: 'yes', window: 'CY' }], rps: [rp('SC-RP2', { name: 'Tier Partners (sample)', flat: null, scheme: 'SC-S2' })] }),
    apps: byId([...L, lead]),
    checks: [
      { what: 'Ten counted (the special lead is not)', calc: '10', exp: 10, got: G.app('rp2-01', (r) => r.rpTier.total) },
      { what: 'Every student at band 3', calc: '10 → 80%; 4,500 × 80% = 3,600', exp: 3600, got: G.rp('rp2-01', 'rp1') },
      { what: 'Tenth student', calc: '3,600', exp: 3600, got: G.rp('rp2-10', 'rp1') },
      { what: 'Special lead at 50%', calc: '4,500 × 50% = 2,250', exp: 2250, got: G.rp('rp2-lead', 'rp1') },
    ] });
}
{
  const L = Array.from({ length: 16 }, (_, i) => paidU(app('rp3-' + String(i + 1).padStart(2, '0'), { uni: 'SC-RPU', rp: 'SC-RP3' })));
  add({ id: 'RP3', tab: 'RP', sheetNo: 'Scenario 3', title: 'Tiered Commission – Prospective', sheet: 'Commission is calculated prospectively based on the applicable student/enrolment volume tier. Example: 1–15 students = 70%; 16–30 = 75%; 31+ = 80%.',
    terms: ['Scheme: 1–15 students 70%, 16–30 75%, 31+ 80%, prospective, calendar year by intake.', 'Sixteen February 2026 students, all paid by the university.'],
    today: '2026-05-15', focus: 'rp3-16',
    cfg: world({ unis: [U15], schemes: [{ id: 'SC-S3', name: 'Prospective 70/75/80 (sample)', region: 'All', type: 'tier', bands: [[1, 15, 70], [16, 30, 75], [31, null, 80]], retro: 'no', window: 'CY' }], rps: [rp('SC-RP3', { name: 'Volume Partners (sample)', flat: null, scheme: 'SC-S3' })] }),
    apps: byId(L),
    checks: [
      { what: 'Students 1–15 at 70%', calc: '4,500 × 70% = 3,150', exp: 3150, got: G.rp('rp3-15', 'rp1') },
      { what: 'Student 16 at 75%', calc: '4,500 × 75% = 3,375', exp: 3375, got: G.rp('rp3-16', 'rp1') },
      { what: 'Student 1 is not topped up', calc: 'prospective: 3,150', exp: 3150, got: G.rp('rp3-01', 'rp1') },
    ] });
}
{
  const L = [['rp4-vn', 'SC-RVN'], ['rp4-in', 'SC-RIN'], ['rp4-np', 'SC-RNP']].map(([id, r]) => paidU(app(id, { uni: 'SC-RPU', rp: r })));
  add({ id: 'RP4', tab: 'RP', sheetNo: 'Scenario 4', title: 'Special Promotional Commission Rates – Region Wise', sheet: 'Temporary or promotional commission rates are offered for specific regions. Example: Special promotional rates applicable to SEA and India.',
    terms: ['Three RPs on a flat 70%: one in Vietnam, one in India, one in Nepal (their sales regions).', 'Notice “SEA and India promotion”: 85% of GSP’s line for RPs in SEA or India, intakes in 2026, a separate box.'],
    today: '2026-05-10', focus: 'rp4-vn',
    cfg: world({ unis: [U15], notices: [{ id: 'SC-N4', name: 'SEA and India promotion (sample)', region: '', regions: ['SEA', 'India'], doc: 'Notice', rps: [], start: '2026-01-01', end: '2026-12-31', dest: [], unis: [], kind: 'flat', flat: 85, combine: 'box' }], rps: [rp('SC-RVN', { name: 'Saigon Pathways (sample)', region: 'Vietnam', flat: 70 }), rp('SC-RIN', { name: 'Pune Futures (sample)', region: 'India', flat: 70 }), rp('SC-RNP', { name: 'Kathmandu Gateway (sample)', region: 'Nepal', flat: 70 })] }),
    apps: byId(L),
    checks: [
      { what: 'Vietnam RP (SEA)', calc: '4,500 × 85% = 3,825', exp: 3825, got: G.rp('rp4-vn', 'rp1') },
      { what: 'India RP', calc: '4,500 × 85% = 3,825', exp: 3825, got: G.rp('rp4-in', 'rp1') },
      { what: 'Nepal RP: outside the notice', calc: '4,500 × 70% = 3,150', exp: 3150, got: G.rp('rp4-np', 'rp1') },
    ] });
}
{
  const L = [paid(app('rp5-jul', { uni: 'SC-RPU', rp: 'SC-R5', intake: '2026-07-13', census: '2026-08-14', enrolled: '2026-06-15' }), 'ip1', '2026-08-20', '2026-09-20', 4500), paidU(app('rp5-feb', { uni: 'SC-RPU', rp: 'SC-R5' })), paid(app('rp5-nov', { uni: 'SC-RPU', rp: 'SC-R5', intake: '2026-11-16', census: '2026-12-11' }), 'ip1', '2026-12-14', '2027-01-05', 4500)];
  add({ id: 'RP5', tab: 'RP', sheetNo: 'Scenario 5', title: 'Special Promotional Commission Rates – Intake/Year Wise', sheet: 'Temporary or promotional commission rates are offered for specific intakes, seasons, or financial years. Example: A special promotional commission rate applicable only to the July26 intake or for FY26',
    terms: ['RP on a flat 70%.', 'Notice “July 2026 intake”: 90%, intake July 2026 only, box.', 'Notice “FY 2026–27”: 80%, intakes 1 Apr 2026 to 31 Mar 2027, box.', 'Both cover the July student: the higher rate wins.', 'The July student’s enrolment was marked in June; notices match the intake.'],
    today: '2027-01-10', focus: 'rp5-jul',
    cfg: world({ unis: [U15], notices: [{ id: 'SC-N5a', name: 'July 2026 intake promotion (sample)', regions: ['India'], doc: 'Notice', rps: [], intakes: ['2026-07'], dest: [], unis: [], kind: 'flat', flat: 90, combine: 'box' }, { id: 'SC-N5b', name: 'FY 2026–27 promotion (sample)', regions: ['India'], doc: 'Notice', rps: [], start: '2026-04-01', end: '2027-03-31', dest: [], unis: [], kind: 'flat', flat: 80, combine: 'box' }], rps: [rp('SC-R5', { name: 'Intake Partners (sample)', flat: 70 })] }),
    apps: byId(L),
    checks: [
      { what: 'July 2026 intake (marked enrolled in June)', calc: 'max(90%, 80%): 4,500 × 90% = 4,050', exp: 4050, got: G.rp('rp5-jul', 'rp1') },
      { what: 'February 2026 intake: before both', calc: '4,500 × 70% = 3,150', exp: 3150, got: G.rp('rp5-feb', 'rp1') },
      { what: 'November 2026 intake: FY 2026–27', calc: '4,500 × 80% = 3,600', exp: 3600, got: G.rp('rp5-nov', 'rp1') },
    ] });
}
{
  const L = [paidU(app('rp6-x', { uni: 'SC-6X', rp: 'SC-R6' })), paidU(app('rp6-uk', { uni: 'SC-6UK', rp: 'SC-R6' })), paidU(app('rp6-o', { uni: 'SC-RPU', rp: 'SC-R6' }))];
  add({ id: 'RP6', tab: 'RP', sheetNo: 'Scenario 6', title: 'Special Promotional Commission Rates – Specific Institutions/Destinations ', sheet: 'Temporary or promotional commission rates are offered for specific intakes, seasons, or financial years. Example: A special promotional commission rate applicable only to selected institutions or destinations.',
    terms: ['RP on a flat 70%.', 'Notice “Featured university”: 85% at Featured University only, box.', 'Notice “UK destination”: 82% for any UK university, box.', 'Each university pays 15% of 30,000 (the UK one in GBP).'],
    today: '2026-05-10', focus: 'rp6-x',
    cfg: world({ unis: [U15, uni('SC-6X', { name: 'Featured University (sample)' }), uni('SC-6UK', { name: 'UK Destination University (sample)', country: 'UK', cur: 'GBP' })], notices: [{ id: 'SC-N6a', name: 'Featured university promotion (sample)', regions: ['India'], doc: 'Notice', rps: [], start: '2026-01-01', end: '2026-12-31', dest: [], unis: ['SC-6X'], kind: 'flat', flat: 85, combine: 'box' }, { id: 'SC-N6b', name: 'UK destination promotion (sample)', regions: ['India'], doc: 'Notice', rps: [], start: '2026-01-01', end: '2026-12-31', dest: ['UK'], unis: [], kind: 'flat', flat: 82, combine: 'box' }], rps: [rp('SC-R6', { name: 'Destination Partners (sample)', flat: 70 })] }),
    apps: byId(L),
    checks: [
      { what: 'Featured university', calc: '4,500 × 85% = 3,825', exp: 3825, got: G.rp('rp6-x', 'rp1') },
      { what: 'UK destination (GBP)', calc: '4,500 × 82% = GBP 3,690', exp: 3690, got: G.rp('rp6-uk', 'rp1') },
      { what: 'Any other university', calc: '4,500 × 70% = 3,150', exp: 3150, got: G.rp('rp6-o', 'rp1') },
    ] });
}
{
  const L = [paidU(app('rp7-01', { uni: 'SC-RPU', rp: 'SC-R7' }))];
  add({ id: 'RP7', tab: 'RP', sheetNo: 'Scenario 7', title: 'Special Promotional Commission Rates – % on Tution fees ', sheet: 'Temporary or promotional commission rates are offered for specific intakes, seasons, or financial years. Example: A special promotional commission rate applicable on the tution fees paid by student ',
    terms: ['RP on a flat 70%.', 'Notice “Tuition promotion”: 5% of the student’s final tuition fee, intakes in 2026, paid on top of the RP’s share once GSP is paid.'],
    today: '2026-05-10', focus: 'rp7-01',
    cfg: world({ unis: [U15], notices: [{ id: 'SC-N7', name: 'Tuition promotion (sample)', regions: ['India'], doc: 'Flyer', rps: [], start: '2026-01-01', end: '2026-12-31', dest: [], unis: [], kind: 'tuitionPct', flat: 5, combine: 'adds' }], rps: [rp('SC-R7', { name: 'Tuition Promo Partners (sample)', flat: 70 })] }),
    apps: byId(L),
    checks: [
      { what: 'Standard share', calc: '4,500 × 70% = 3,150', exp: 3150, got: G.rp('rp7-01', 'rp1') },
      { what: 'Promotion on tuition', calc: '30,000 × 5% = 1,500', exp: 1500, got: G.rp('rp7-01', 'tp-SC-N7') },
      { what: 'Promotion is payable (GSP paid)', calc: '', exp: 'Ready for payout', got: G.rp('rp7-01', 'tp-SC-N7', 'st') },
    ] });
}

/* ---------------- Combinations ---------------- */
{
  const L = [1, 2, 3, 4, 5].map((i) => app('c1-0' + i, { uni: 'SC-C1U', rp: 'SC-RC1a' })).concat([app('c1-06', { uni: 'SC-C1U', rp: 'SC-RC1b' })]);
  add({ id: 'C1', tab: 'Combination', title: 'Tier and promotion on the same student (and the RP cap)', sheet: 'University: a retrospective tier and a regional promotion both cover the student. RP: a notice that adds on to the RP’s own rate.',
    terms: ['University: tier 1–5 students 15%, 6+ 20%, retrospective, calendar year; promotion “India” 18%, highest wins. Six Indian students in Feb 2026.', 'RP A: flat 80% plus a notice that adds 30% (listed by ID). RP B: flat 80% with a notice at 85%, highest wins.', 'Proposal: an RP never gets more than 100% of GSP’s line.'],
    today: '2026-05-01', focus: 'c1-01',
    cfg: world({ unis: [uni('SC-C1U', { name: 'Tier and Promo University (sample)', tier: { retro: true, window: 'CY', scope: 'all', pool: 'uni', levels: [], bands: [[1, 5, 15], [6, null, 20]] }, promos: [{ id: 'PC1', name: 'India promotion', regions: ['India'], from: '2026-01-01', to: '2026-12-31', pct: 18, combine: 'highest' }] })], notices: [{ id: 'SC-NC1', name: 'Adds 30% (sample)', doc: 'Email', rps: ['SC-RC1a'], start: '2026-01-01', end: '2026-12-31', dest: [], unis: [], kind: 'flat', flat: 30, combine: 'adds' }, { id: 'SC-NC1b', name: 'Highest 85% (sample)', doc: 'Email', rps: ['SC-RC1b'], start: '2026-01-01', end: '2026-12-31', dest: [], unis: [], kind: 'flat', flat: 85, combine: 'highest' }], rps: [rp('SC-RC1a', { name: 'Add-on Partners (sample)' }), rp('SC-RC1b', { name: 'Highest-wins Partners (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Tier beats a lower promotion', calc: '6 → 20% vs promo 18%: 30,000 × 20% = 6,000', exp: 6000, got: G.ip('c1-01', 'ip1') },
      { what: 'Adds on, capped at 100%', calc: '80% + 30% = 110% → 100%', exp: 100, got: G.app('c1-01', (r) => r.rpPct) },
      { what: 'RP never above GSP’s line', calc: '6,000 × 100% = 6,000', exp: 6000, got: G.rp('c1-01', 'rp1') },
      { what: 'Highest wins', calc: 'max(85%, 80%): 6,000 × 85% = 5,100', exp: 5100, got: G.rp('c1-06', 'rp1') },
    ] });
}
{
  const L = [['c2-01', 'Nursing', 'India', 'Melbourne'], ['c2-02', 'Nursing', 'India', 'Sydney'], ['c2-03', 'Business', 'India', 'Sydney'], ['c2-04', 'Nursing', 'Nepal', 'Sydney']].map(([id, course, nationality, campus]) => app(id, { uni: 'SC-C2U', rp: 'SC-R80', course, nationality, campus }));
  add({ id: 'C2', tab: 'Combination', title: 'Course + region (+ campus): the most specific row wins', sheet: 'Rate rows on several dimensions at once; the row that names the most of them wins.',
    terms: ['Level table: UG 15%.', 'Rows: Nursing → 18%; India → 16%; Nursing + India → 20%; Nursing + India + Sydney → 22%.'],
    today: '2026-05-01', focus: 'c2-02',
    cfg: world({ unis: [uni('SC-C2U', { name: 'Specific-Rates University (sample)', rates: [{ course: 'Nursing', pct: 18 }, { region: 'India', pct: 16 }, { course: 'Nursing', region: 'India', pct: 20 }, { course: 'Nursing', region: 'India', campus: 'Sydney', pct: 22 }] })], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'Nursing, India, Melbourne', calc: '2 keys: 30,000 × 20% = 6,000', exp: 6000, got: G.ip('c2-01', 'ip1') },
      { what: 'Nursing, India, Sydney', calc: '3 keys: 30,000 × 22% = 6,600', exp: 6600, got: G.ip('c2-02', 'ip1') },
      { what: 'Business, India', calc: 'India row: 30,000 × 16% = 4,800', exp: 4800, got: G.ip('c2-03', 'ip1') },
      { what: 'Nursing, Nepal', calc: 'Nursing row: 30,000 × 18% = 5,400', exp: 5400, got: G.ip('c2-04', 'ip1') },
    ] });
}
{
  const L = [...['c3-a1', 'c3-a2', 'c3-a3'].map((id) => app(id, { uni: 'SC-C3A', rp: 'SC-R80' })), ...['c3-b1', 'c3-b2', 'c3-b3'].map((id) => app(id, { uni: 'SC-C3B', rp: 'SC-R80' }))];
  add({ id: 'C3', tab: 'Combination', title: 'College tier vs group tier: the group wins here', sheet: 'A college with its own tier inside a group that has a group tier.',
    terms: ['Group: colleges A and B; group tier 1–5 students 15%, 6+ 18%, retrospective, calendar year.', 'College A’s own tier: 1–2 students 15%, 3+ 16%, retrospective. College B has none.', 'Three students at each college, Feb 2026. Higher rate wins.'],
    today: '2026-05-01', focus: 'c3-a1',
    cfg: world({ unis: [uni('SC-C3A', { name: 'Tiered College (sample)', tier: { retro: true, window: 'CY', scope: 'all', pool: 'uni', levels: [], bands: [[1, 2, 15], [3, null, 16]] } }), uni('SC-C3B', { name: 'Untiered College (sample)' })], groups: [{ id: 'SC-G3', name: 'Two-college group (sample)', members: ['SC-C3A', 'SC-C3B'], tier: { retro: true, window: 'CY', scope: 'all', levels: [], bands: [[1, 5, 15], [6, null, 18]] } }], rps: [rp('SC-R80', { name: 'Harbour Education (sample)' })] }),
    apps: byId(L),
    checks: [
      { what: 'College A: group 18% beats college 16%', calc: '30,000 × 18% = 5,400', exp: 5400, got: G.ip('c3-a1', 'ip1') },
      { what: 'Winning tier is the group’s', calc: '', exp: 'group', got: G.app('c3-a1', (r) => r.uniTier.who) },
      { what: 'College B at the group band', calc: '6 → 18% = 5,400', exp: 5400, got: G.ip('c3-b1', 'ip1') },
    ] });
}
{
  const L = [1, 2, 3, 4].map((i) => paid(app('c4-0' + i, { uni: 'SC-RPU', rp: 'SC-RC4' }), 'ip1', '2026-04-02', '2026-04-30', 4500, 'rp1', 3150)).concat([paid(app('c4-05', { uni: 'SC-RPU', rp: 'SC-RC4', intake: '2026-07-20', census: '2026-08-31' }), 'ip1', '2026-09-01', '2026-09-30', 4500)]);
  add({ id: 'C4', tab: 'Combination', title: 'RP retrospective recount at the 5th student', sheet: 'Four students were paid at 70%; the fifth paid enrolment moves everyone to 75%.',
    terms: ['Scheme: 1–4 students 70%, 5–9 75%, 10+ 80%, retrospective, calendar year by intake.', 'Four February 2026 students: university paid, RP paid 3,150 each. Fifth student (July 2026): university paid 30 Sep.'],
    today: '2026-10-05', focus: 'c4-01',
    cfg: world({ unis: [U15], schemes: [{ id: 'SC-S4', name: 'Retrospective 70/75/80 (sample)', region: 'All', type: 'tier', bands: [[1, 4, 70], [5, 9, 75], [10, null, 80]], retro: 'yes', window: 'CY' }], rps: [rp('SC-RC4', { name: 'Recount Partners (sample)', flat: null, scheme: 'SC-S4' })] }),
    apps: byId(L),
    checks: [
      { what: 'First student’s top-up', calc: '4,500 × 75% = 3,375 − 3,150 paid = 225', exp: 225, got: G.rp('c4-01', 'rp1', 'due') },
      { what: 'First student’s status', calc: '', exp: 'Top-up ready for payout', got: G.rp('c4-01', 'rp1', 'st') },
      { what: 'Fifth student', calc: '4,500 × 75% = 3,375', exp: 3375, got: G.rp('c4-05', 'rp1', 'due') },
    ] });
}
{
  const A1 = [1, 2, 3, 4].map((i) => paidU(app('c5-a' + i, { uni: 'SC-RPU', rp: 'SC-RC5a' }))).concat([paidU(app('c5-a5', { uni: 'SC-RPU', rp: 'SC-RC5a', gspLead: true, enrolReady: true }))]);
  const B1 = [1, 2, 3, 4].map((i) => paidU(app('c5-b' + i, { uni: 'SC-RPU', rp: 'SC-RC5b' }))).concat([paidU(app('c5-b5', { uni: 'SC-RPU', rp: 'SC-RC5b', gspLead: true, enrolReady: false }))]);
  const sch = { id: 'SC-S5', name: 'Retrospective 70/75 (sample)', region: 'All', type: 'tier', bands: [[1, 4, 70], [5, null, 75]], retro: 'yes', window: 'CY' };
  add({ id: 'C5', tab: 'Combination', title: '50% special lead overriding the tier', sheet: 'The special lead needs both conditions: GSP gave a qualified lead, and the RP provided an enrolment-ready application.',
    terms: ['Scheme: 1–4 students 70%, 5+ 75%, retrospective.', 'RP A: four students plus a special lead with both conditions met.', 'RP B: four students plus a GSP lead whose application was not enrolment-ready.'],
    today: '2026-05-15', focus: 'c5-a5',
    cfg: world({ unis: [U15], schemes: [sch], rps: [rp('SC-RC5a', { name: 'Lead Partners A (sample)', flat: null, scheme: 'SC-S5' }), rp('SC-RC5b', { name: 'Lead Partners B (sample)', flat: null, scheme: 'SC-S5' })] }),
    apps: byId([...A1, ...B1]),
    checks: [
      { what: 'Special lead at 50%', calc: '4,500 × 50% = 2,250', exp: 2250, got: G.rp('c5-a5', 'rp1') },
      { what: 'The lead does not lift RP A’s band', calc: '4 counted → 70%: 3,150', exp: 3150, got: G.rp('c5-a1', 'rp1') },
      { what: 'Not enrolment-ready: standard terms, and it counts', calc: '5 counted → 75%: 4,500 × 75% = 3,375', exp: 3375, got: G.rp('c5-b5', 'rp1') },
      { what: 'RP B’s others move to 75%', calc: '3,375', exp: 3375, got: G.rp('c5-b1', 'rp1') },
      { what: 'Flagged for Finance', calc: '', exp: true, got: G.exc('c5-b5', 'Special lead not enrolment-ready') },
    ] });
}
{
  const L = [1, 2, 3, 4, 5].map((i) => paid(app('c6-0' + i, { uni: 'SC-RPU', rp: 'SC-RC6' }), 'ip1', '2026-04-02', '2026-04-30', 4500, 'rp1', 3375));
  L[4].withdrawn = { date: '2026-10-10', refund: true };
  add({ id: 'C6', tab: 'Combination', title: 'Withdrawal and the end-of-period rework (S5-15)', sheet: 'A refunded withdrawal does not drop the band at once: the tier is re-worked at the end of the period.',
    terms: ['Scheme: 1–4 students 70%, 5+ 75%, retrospective, calendar year.', 'Five February 2026 students, university paid 4,500 each, RP paid 3,375 each (75%).', 'The fifth withdraws on 10 Oct 2026 and the university takes its commission back.', 'Looked at on 1 Nov 2026 (period still open) and on 5 Jan 2027 (after the rework).'],
    today: '2026-11-01', focus: 'c6-01',
    cfg: world({ unis: [U15], schemes: [{ id: 'SC-S6', name: 'Retrospective 70/75 (sample)', region: 'All', type: 'tier', bands: [[1, 4, 70], [5, null, 75]], retro: 'yes', window: 'CY' }], rps: [rp('SC-RC6', { name: 'Rework Partners (sample)', flat: null, scheme: 'SC-S6' })] }),
    apps: byId(L),
    checks: [
      { what: '1 Nov: the university recovers its line', calc: '0 − 4,500 paid = −4,500', exp: -4500, got: G.ip('c6-05', 'ip1', 'due') },
      { what: '1 Nov: RP’s share recovered', calc: '0 − 3,375 paid = −3,375', exp: -3375, got: G.rp('c6-05', 'rp1', 'due') },
      { what: '1 Nov: the others keep 75% until the rework', calc: '5 still counted → 75%: 3,375 − 3,375 = 0', exp: 0, got: G.rp('c6-01', 'rp1', 'due') },
      { what: '1 Nov: rework pending is shown', calc: '1 pending', exp: 1, got: G.app('c6-01', (r) => r.rpTier.pending.length) },
      { what: '5 Jan 2027: reworked to 70%', calc: '4 counted → 70%: 4,500 × 70% = 3,150', exp: 3150, got: G.rp('c6-01', 'rp1'), today: '2027-01-05' },
      { what: '5 Jan 2027: the difference is recovered', calc: '3,150 − 3,375 = −225', exp: -225, got: G.rp('c6-01', 'rp1', 'due'), today: '2027-01-05' },
    ] });
}
{
  const z = paid(app('c7-01', { uni: 'SC-C7U', rp: 'SC-RC7', tuition: 20000, intake: '2026-09-21', census: '2026-10-16' }), 'ip1', '2026-10-20', '2026-11-05', 3000);
  add({ id: 'C7', tab: 'Combination', title: 'GBP → AUD → INR chain', sheet: 'A UK university pays GSP in GBP; the RP is paid in INR. All conversion goes through AUD with the week’s rates.',
    terms: ['UK university, GBP, UG 15%. Student’s fee GBP 20,000; the university paid GBP 3,000 on 5 Nov 2026.', 'RP in India on a flat 80%, paid in INR to a local account.', 'Rates for the payout run’s week (AUD per unit): GBP 1.95, INR 0.0175.'],
    today: '2026-11-10', focus: 'c7-01',
    cfg: world({ unis: [uni('SC-C7U', { name: 'Sterling University (sample)', country: 'UK', cur: 'GBP' })], rps: [rp('SC-RC7', { name: 'Rupee Partners (sample)', cur: 'INR', bank: 'Local' })] }),
    apps: byId([z]),
    checks: [
      { what: 'RP share in GBP', calc: '3,000 × 80% = GBP 2,400', exp: 2400, got: G.rp('c7-01', 'rp1') },
      { what: 'Run date', calc: 'Thursday after 10 Nov 2026', exp: '2026-11-12', got: (R, X) => X.buildRun(X.cfg, R, X.today).date },
      { what: 'GBP → AUD', calc: '2,400 × 1.95 = AUD 4,680.00', exp: 4680, got: (R, X) => X.buildRun(X.cfg, R, X.today).lines[0].aud },
      { what: 'AUD → INR', calc: '4,680 ÷ 0.0175 = INR 2,67,428.57', exp: 267428.57, got: (R, X) => X.buildRun(X.cfg, R, X.today).lines[0].pay },
      { what: 'Paid in INR', calc: '', exp: 'INR', got: (R, X) => X.buildRun(X.cfg, R, X.today).lines[0].payCur },
    ] });
}

export const SCENARIOS = C;

const same = (e, g) => { if (typeof e === 'number' && typeof g === 'number') return Math.abs(e - g) < 0.005; return JSON.stringify(e) === JSON.stringify(g); };
/* run one case: compute once per date it is looked at, then every check */
export function runScenario(c, compute, buildRun) {
  const days = [...new Set([c.today, ...c.checks.map((k) => k.today).filter(Boolean)])];
  const res = {}; days.forEach((t) => { res[t] = compute(c.cfg, c.apps, t); });
  const checks = c.checks.map((k) => { const t = k.today || c.today; let got; try { got = k.got(res[t], { buildRun, cfg: c.cfg, today: t }); } catch (e) { got = 'error: ' + e.message; } return { what: k.what, calc: k.calc, exp: k.exp, got, ok: same(k.exp, got), today: t }; });
  return { id: c.id, ok: checks.every((x) => x.ok), checks, res };
}
export function runAll(compute, buildRun) { return SCENARIOS.map((c) => runScenario(c, compute, buildRun)); }
