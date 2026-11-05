// @ts-nocheck -- plain JS shape so the same file compiles into the standalone Commissions Sandbox (scripts/sandbox-engine.mjs).
/*
 * Commission engine (commissions-26, 2 Nov). ONE engine for the portal (src/finance), the standalone Commissions
 * Sandbox (bundled from this file) and the scenario test (scripts/test-commissions.mjs). Pure functions over
 * (cfg, apps, today); in production this runs on the server and the pages only read its output.
 *
 *   compute(cfg, apps, today) -> { ip: university lines, rp: RP lines, exc: exceptions, apps: per-application workings }
 *   buildRun(cfg, result, date) -> the payout run for that week's pay day
 *
 * Every line carries `trace`: the steps that produced its amount ({h: heading, t: plain words with the numbers,
 * ref: the commissions team's sheet scenario, e.g. 'IP5'}). The pages show it as "How it's worked out".
 *
 * University terms (cfg.unis[]), all optional beyond the first block (old rows keep working):
 *   id, name, country, cur, trigger, payDays, cap, status, flag, contract, group (legacy free text)
 *   triggerWeeks                     for the Withdrawal deadline trigger: weeks after the study start (Commissions
 *                                    team, 3 Nov); blank = Settings' fallback weeks
 *   starts, ends                     agreement dates (IP17); enrolments outside them are held
 *   versions: [{id, from, label, set:{...any field below}}]   terms versioned by effective-from (S5-2)
 *   levels {UG: 15}, fixed {RES: 1000}  the rate table by level / sector (IP1, IP6)
 *   rates: [{level, course, campus, region, period, pct | amt}]  rate rows keyed by any combination (IP5–8, IP16)
 *   basis: 'net' | 'gross'           commission on the final tuition fee, or on it plus the scholarship (IP13, S5-7)
 *   pay: 'year'|'semester'|'trimester'|'term'|'unit'|'fees'   how commission is paid (IP15); old rows: inst 1–4
 *   charge: {unit:'course'|'year'|'semester'|'trimester'|'term'|'unit'|'fees'|'points', n}  how long it is chargeable (IP14);
 *                                    'points': the first n credit points (NZ: AUT pays on the first 120 points, even
 *                                    when a one-year programme is worth 180; the commissions team, 3 Nov)
 *   annuity {on, maxYears}            old way of saying "chargeable after the first year"
 *   tier: {retro, window:'CY'|'AY'|'FY'|'intake', ayStart, scope:'all'|'country', pool:'uni'|'group', levels[],
 *          bands[[from,to,pct]], bandBonus{'2':{kind:'fixed'|'pct', v}}}   (IP2–4, IP12, IP19)
 *   promos: [{id, name, from, to, intakes[], regions[], courses[], levels[], campuses[], pct | amt,
 *             combine:'highest'|'replace'|'additional'}]   university-side promotions (IP9–11, IP19)
 *   bonuses: [{id, name, kind:'fixed'|'pct', v, per:'student'|'threshold'|'band', threshold, window, levels[],
 *             bands[[from,to,v,kind]], retro}]  (IP19). per 'band': the amount per student depends on how many students
 *             enrol at the university in the window (retro: the final count sets every student's band; else the student's own place).
 * University groups (cfg.groups[], S5-22): [{id, name, members:[uni ids], tier}]; every member counts toward the group.
 * Settings add: regionGroups {SEA:[countries]}, rpCap (100: an RP never gets more than GSP's line).
 * Applications add: pointsPerYear (credit points the programme is worth a year; NZ full time is 120), course, campus, enrolReady, yearFees[], periods[{census, tuition}], units[{name, fee, census}],
 *   feePayments[{date, amt}], invAmt{} (the amount on an invoice once raised).
 */
import { fmtMoney } from '../data/format';

const DEFYEARS = { UG: 3, PG: 2, RES: 3, DIP: 1, FDN: 1, VET: 2, ELICOS: 1, SA: 1 };
const LEVELS = { UG: 'Undergraduate', PG: 'Postgraduate coursework', RES: 'Research degree', DIP: 'Diploma', FDN: 'Foundation', VET: 'Vocational (VET/TAFE)', ELICOS: 'English (ELICOS)', SA: 'Study Abroad' };
const TRIG = { census: 'Census date', fees: 'Fees paid (start of study)', withdrawal: 'Withdrawal deadline (start + weeks)', enrol: 'Enrolment confirmed (start of study)' };
const DEST = { AU: 'Australia', NZ: 'New Zealand', UK: 'United Kingdom', MY: 'Malaysia', EU: 'Europe', IE: 'Ireland', US: 'United States', CA: 'Canada', AE: 'UAE' };
const PAY = { year: { per: 1, off: [0], one: 'Year' }, semester: { per: 2, off: [0, 5], one: 'Semester' }, trimester: { per: 3, off: [0, 4, 8], one: 'Trimester' }, term: { per: 4, off: [0, 3, 6, 9], one: 'Term' } };
const PAYNAME = { year: 'once a year', semester: 'each semester', trimester: 'each trimester', term: 'each term', unit: 'per unit of study', fees: 'on each fee payment the student makes' };
const UNIT_MONTHS = { year: 12, semester: 6, trimester: 4, term: 3 };
const CHARGENAME = { course: 'the whole course', year: 'year', semester: 'semester', trimester: 'trimester', term: 'term', unit: 'unit', fees: 'fees paid', points: 'credit point' };
/* a full-time year in credit points when the application gives none (NZ: 120) */
const DEF_POINTS = 120;
const DEF_REGION_GROUPS = { SEA: ['Vietnam', 'Malaysia', 'Indonesia', 'Thailand', 'Philippines', 'Singapore', 'Cambodia', 'Myanmar'], 'South Asia': ['India', 'Nepal', 'Bangladesh', 'Sri Lanka', 'Pakistan', 'Bhutan'] };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fd = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = pd(s); d.setUTCDate(d.getUTCDate() + n); return fd(d); };
const daysIn = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
/* months later, kept in the month: 31 Mar + 8 months is 30 Nov, never 1 Dec (IP15) */
const addMonths = (s, n) => { const d = pd(s); const day = d.getUTCDate(); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)); t.setUTCDate(Math.min(day, daysIn(t.getUTCFullYear(), t.getUTCMonth()))); return fd(t); };
const monthsBetween = (a, b) => { const x = pd(a), y = pd(b); return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth()) + (y.getUTCDate() - x.getUTCDate()) / 31; };
const nice = (s) => { if (!s) return '—'; const d = pd(s); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return MON[m - 1] + ' ' + y; };
/* the pay day on or after a date (HC34): Finance setup's pay day, Thursday (4) when none is set */
const payDayFor = (cfg) => { const n = Number(cfg && cfg.settings && cfg.settings.ops && cfg.settings.ops.payDay); return n >= 0 && n <= 6 && !isNaN(n) ? n : 4; };
const thursdayOf = (s, cfg) => { const d = pd(s); const k = (payDayFor(cfg) - d.getUTCDay() + 7) % 7; d.setUTCDate(d.getUTCDate() + k); return fd(d); };
/* round half up to 2 decimals after every step (S5-9) */
const r2 = (x) => { if (x == null || isNaN(x)) return x; const s = x < 0 ? -1 : 1; return (s * Math.round(Math.abs(x) * 100 + 1e-7)) / 100; };
const money = (x, c) => fmtMoney(x, c || '');
const pctTxt = (p) => (p == null ? '—' : +p + '%');
const lc = (s) => String(s || '').trim().toLowerCase();
const listTxt = (l) => (l || []).join(', ');

function fxRate(cfg, cur, date) {
  if (!cur || cur === 'AUD') return 1;
  const rows = (cfg.settings.fx || []).slice().sort((a, b) => (a.week < b.week ? -1 : 1));
  let r = null;
  for (const w of rows) { if (w.week <= date) r = w; else break; }
  if (!r || addDays(r.week, 7) <= date) return null;
  return r[cur] == null || r[cur] === '' ? null : +r[cur];
}
function fxWeek(cfg, date) { const rows = (cfg.settings.fx || []).slice().sort((a, b) => (a.week < b.week ? -1 : 1)); let r = null; for (const w of rows) { if (w.week <= date) r = w; else break; } return r && addDays(r.week, 7) > date ? r.week : null; }
function bandOf(bands, n) { let i = bands.findIndex((b) => n >= b[0] && (b[1] == null || n <= b[1])); if (i < 0) i = n < bands[0][0] ? 0 : bands.length - 1; return { i, from: bands[i][0], to: bands[i][1], pct: +bands[i][2] }; }
const bandTxt = (b) => (b || []).map((x) => x[0] + (x[1] == null ? '+' : '–' + x[1]) + ': ' + x[2] + '%').join(', ');

/* counting windows: by the application's intake (study start), never the census or payment date */
function windowKey(win, date, o) {
  if (!date) return '';
  const d = pd(date), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  if (win === 'FY') return m >= 4 ? 'FY' + y + '–' + String(y + 1).slice(2) : 'FY' + (y - 1) + '–' + String(y).slice(2);
  if (win === 'AY') { const s = +((o && o.ayStart) || 1); if (s === 1) return 'AY' + y; return m >= s ? 'AY' + y + '/' + String(y + 1).slice(2) : 'AY' + (y - 1) + '/' + String(y).slice(2); }
  if (win === 'intake2') { if (m >= 4 && m <= 7) return 'Apr–Jul ' + y; return m >= 8 ? 'Aug ' + y + '–Mar ' + (y + 1) : 'Aug ' + (y - 1) + '–Mar ' + y; }
  if (win === 'intake') return 'Intake ' + monthName(date.slice(0, 7));
  return 'CY' + y;
}
/* the last day of the window a date falls in (null for intake windows: the caller decides) */
function windowEnd(win, date, o) {
  const d = pd(date), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  if (win === 'FY') return m >= 4 ? y + 1 + '-03-31' : y + '-03-31';
  if (win === 'AY') { const s = +((o && o.ayStart) || 1); const start = (m >= s ? y : y - 1) + '-' + String(s).padStart(2, '0') + '-01'; return addDays(addMonths(start, 12), -1); }
  if (win === 'intake2') { if (m >= 4 && m <= 7) return y + '-07-31'; return (m >= 8 ? y + 1 : y) + '-03-31'; }
  if (win === 'intake') return null;
  return y + '-12-31';
}
const winName = { CY: 'calendar year (Jan–Dec)', FY: 'financial year (Apr–Mar)', AY: 'academic year', intake: 'intake', intake2: 'two intakes (Apr–Jul, Aug–Mar)' };
const winLabel = (win, o) => (win === 'AY' ? 'academic year starting ' + MON[(+((o && o.ayStart) || 1)) - 1] : winName[win] || win);

const regionGroupsOf = (S) => Object.assign({}, DEF_REGION_GROUPS, (S && S.regionGroups) || {});
/* does `want` (a country or a region group) cover `country`? */
function regionCovers(S, want, country) {
  if (!want) return true;
  if (lc(want) === lc(country)) return true;
  const g = regionGroupsOf(S)[Object.keys(regionGroupsOf(S)).find((k) => lc(k) === lc(want))];
  return !!(g && g.some((c) => lc(c) === lc(country)));
}
function periodCovers(spec, k) {
  if (spec == null || spec === '') return true;
  const s = String(spec).trim();
  let m = s.match(/^(\d+)\+$/); if (m) return k >= +m[1];
  m = s.match(/^(\d+)\s*[-–]\s*(\d+)$/); if (m) return k >= +m[1] && k <= +m[2];
  return +s === k;
}

/* ---- terms in force on the enrolment date (S5-2) ---- */
function termsAt(u, date) {
  const vs = (u.versions || []).filter((v) => v && v.from).slice().sort((a, b) => (a.from < b.from ? -1 : 1));
  let cur = null; const considered = [];
  vs.forEach((v) => { if (v.from <= date) cur = v; });
  vs.forEach((v) => considered.push((v.label || v.id || 'Version') + ' from ' + nice(v.from) + (v === cur ? ': in force' : v.from > date ? ': not yet in force on ' + nice(date) : ': replaced by a later version')));
  const t = cur ? Object.assign({}, u, cur.set || {}) : u;
  return { t, ver: cur, considered, base: u.versionLabel || 'Original terms' + (u.starts ? ' from ' + nice(u.starts) : '') };
}
const payOf = (t) => t.pay || ({ 1: 'year', 2: 'semester', 3: 'trimester', 4: 'term' }[Math.max(1, Math.min(4, +t.inst || 1))]);
const chargeOf = (t) => t.charge && t.charge.unit ? t.charge : t.annuity && t.annuity.on ? (t.annuity.maxYears ? { unit: 'year', n: +t.annuity.maxYears } : { unit: 'course' }) : { unit: 'year', n: 1 };
const chargeTxt = (c) => (c.unit === 'course' ? 'the whole course' : c.unit === 'fees' ? (c.n ? 'the first ' + c.n.toLocaleString('en-AU') + ' of fees the student pays' : 'every fee payment the student makes') : c.n + ' ' + CHARGENAME[c.unit] + (c.n === 1 ? '' : 's'));

/* every rate row the terms hold: the level table first (least specific), then the rows */
function rateRows(t) {
  const rows = [];
  Object.entries(t.levels || {}).forEach(([L, v]) => { if (v !== '' && v != null) rows.push({ src: 'level', level: L, pct: +v, idx: 0 }); });
  Object.entries(t.fixed || {}).forEach(([L, v]) => { if (v !== '' && v != null) rows.push({ src: 'level', level: L, amt: +v, idx: 0 }); });
  (t.rates || []).forEach((x, i) => rows.push(Object.assign({}, x, { src: 'row', idx: i + 1, pct: x.pct === '' || x.pct == null ? null : +x.pct, amt: x.amt === '' || x.amt == null ? null : +x.amt })));
  return rows;
}
const rowKeys = (x) => ['level', 'course', 'campus', 'region', 'period'].filter((k) => x[k] != null && x[k] !== '');
function rowLabel(x, cur) {
  const keys = rowKeys(x).map((k) => (k === 'level' ? LEVELS[x.level] || x.level : k === 'period' ? 'study period ' + x.period : k === 'region' ? 'students from ' + x.region : k === 'campus' ? x.campus + ' campus' : x[k]));
  return (x.src === 'level' ? 'Level table' : 'Rate row ' + x.idx) + ': ' + (keys.join(' · ') || 'any course') + ' → ' + (x.amt != null ? money(x.amt, cur) + ' fixed' : pctTxt(x.pct));
}
function rowTest(x, a, k, S) {
  const why = [];
  if (x.level && x.level !== a.level) why.push('level ' + (x.level) + ', the student is ' + a.level);
  if (x.course && lc(x.course) !== lc(a.course)) why.push('course “' + x.course + '”, the student’s is “' + (a.course || 'not given') + '”');
  if (x.campus && lc(x.campus) !== lc(a.campus)) why.push('campus ' + x.campus + ', the student’s is ' + (a.campus || 'not given'));
  if (x.region && !regionCovers(S, x.region, a.nationality)) why.push('region ' + x.region + ' does not include ' + (a.nationality || 'an unknown country'));
  if (x.period != null && x.period !== '' && !periodCovers(x.period, k)) why.push('study period ' + x.period + ', this is period ' + k);
  return why;
}
/* the most specific matching row wins; the level table is the fallback; equal rows: the first listed (proposal) */
function pickRate(t, a, k, S) {
  const rows = rateRows(t); const ok = [], no = [];
  rows.forEach((x) => { const w = rowTest(x, a, k, S); (w.length ? no : ok).push({ x, w }); });
  ok.sort((p, q) => { const sp = rowKeys(p.x).length + (p.x.src === 'row' ? 0.5 : 0), sq = rowKeys(q.x).length + (q.x.src === 'row' ? 0.5 : 0); return sq - sp || p.x.idx - q.x.idx; });
  const best = ok[0] ? ok[0].x : null;
  const tie = ok[1] && best && rowKeys(ok[1].x).length === rowKeys(best).length && ok[1].x.src === best.src && best.src === 'row';
  return { best, ok: ok.map((o) => o.x), no, tie };
}
function promoTest(p, a, S) {
  const w = [], d = a.intake;
  if (p.from && d < p.from) w.push('intake ' + nice(d) + ' is before ' + nice(p.from));
  if (p.to && d > p.to) w.push('intake ' + nice(d) + ' is after ' + nice(p.to));
  if ((p.intakes || []).length && !p.intakes.includes(d.slice(0, 7))) w.push('intakes ' + p.intakes.map(monthName).join(', ') + ' only; this is ' + monthName(d.slice(0, 7)));
  if ((p.regions || []).length && !p.regions.some((r) => regionCovers(S, r, a.nationality))) w.push('students from ' + listTxt(p.regions) + ' only; this student is from ' + (a.nationality || 'an unknown country'));
  if ((p.courses || []).length && !p.courses.some((c) => lc(c) === lc(a.course))) w.push('courses ' + listTxt(p.courses) + ' only; this is ' + (a.course || 'not given'));
  if ((p.levels || []).length && !p.levels.includes(a.level)) w.push('levels ' + listTxt(p.levels) + ' only; this is ' + a.level);
  if ((p.campuses || []).length && !p.campuses.some((c) => lc(c) === lc(a.campus))) w.push('campuses ' + listTxt(p.campuses) + ' only; this is ' + (a.campus || 'not given'));
  return w;
}
const courseYearsOf = (a, S) => Math.max(0.5, +a.courseYears || (S.courseYears && +S.courseYears[a.level]) || DEFYEARS[a.level] || 2);

function compute(cfg, apps, today) {
  const S = cfg.settings || {}, U = {}, RP = {}, SC = {};
  cfg.unis.forEach((u) => (U[u.id] = u)); cfg.rps.forEach((r) => (RP[r.id] = r)); (cfg.schemes || []).forEach((s) => (SC[s.id] = s));
  const notices = cfg.notices || [];
  const out = { ip: [], rp: [], exc: [], apps: {} };
  const A = Object.values(apps).sort((a, b) => ((a.intake || '') < (b.intake || '') ? -1 : (a.intake || '') > (b.intake || '') ? 1 : a.id < b.id ? -1 : 1));
  const exc = (app, type, msg, sev) => out.exc.push({ app: app && app.id, type, msg, sev: sev || 'bad' });
  const fb = S.fallbackWeeks || 4;
  /* University groups (S5-22): Finance's list; a university's free-text group still works for old rows */
  const groups = (cfg.groups || []).map((g) => Object.assign({}, g, { members: (g.members || []).slice() }));
  cfg.unis.forEach((u) => { if (u.group && !groups.some((g) => g.members.includes(u.id))) { let g = groups.find((x) => x.legacy && x.name === u.group); if (!g) { g = { id: 'txt:' + u.group, name: u.group, members: [], legacy: true, tier: null }; groups.push(g); } g.members.push(u.id); } });
  const groupOf = (uid) => groups.find((g) => g.members.includes(uid)) || null;

  /* ---------- pass 1: terms, trigger, periods, rate rows, promotions ---------- */
  const base = {};
  A.forEach((a) => {
    const u0 = U[a.uni];
    const r = { a, u: u0, lines: [], why: [], steps: [], trigBase: null, enrolDate: a.intake };
    base[a.id] = r; out.apps[a.id] = r;
    if (!u0) { exc(a, 'No university terms', 'No terms for this university. The application cannot be priced.'); return; }
    const tv = termsAt(u0, a.intake || today); const u = tv.t; r.u = u; r.u0 = u0; r.ver = tv.ver;
    r.group = groupOf(u0.id);
    const st = r.steps;
    st.push({ h: 'Terms', t: u.name + ' (' + (u.status || 'terms') + '), in ' + u.cur + '. Priced from the terms in force on the intake start, ' + nice(a.intake) + ': ' + (tv.ver ? (tv.ver.label || tv.ver.id) + ' (from ' + nice(tv.ver.from) + ')' : tv.base) + '.' + (tv.considered.length ? ' Versions considered: ' + tv.considered.join('; ') + '.' : ''), ref: tv.considered.length ? 'IP17' : null });
    if (u.starts || u.ends) st.push({ h: 'Agreement dates', t: 'In force ' + (u.starts ? 'from ' + nice(u.starts) : 'with no start date') + (u.ends ? ' to ' + nice(u.ends) : ', no end date') + '. Intake ' + nice(a.intake) + (u.starts && a.intake < u.starts ? ' is before the agreement starts.' : u.ends && a.intake > u.ends ? ' is after the agreement ends.' : ' is inside it.'), ref: 'IP17' });
    let tb, tw;
    if (u.trigger === 'census') { tb = a.census || addDays(a.intake, 7 * fb); tw = a.census ? 'Census date ' + nice(a.census) : 'No census date known: start + ' + fb + ' weeks = ' + nice(tb); }
    else if (u.trigger === 'withdrawal') { const own = u.triggerWeeks !== '' && u.triggerWeeks != null && !isNaN(+u.triggerWeeks); const wk = own ? +u.triggerWeeks : fb; tb = addDays(a.intake, 7 * wk); tw = 'Withdrawal deadline: start + ' + wk + ' weeks' + (own ? ' (the university’s terms)' : ' (Settings’ default; the terms give no weeks)') + ' = ' + nice(tb); }
    else { tb = a.intake; tw = (u.trigger === 'fees' ? 'Fees paid' : 'Enrolment confirmed') + ' at start of study, ' + nice(tb); }
    r.trigBase = tb; r.trigWhy = tw;
    const pay = payOf(u), ch = chargeOf(u); r.pay = pay; r.charge = ch;
    const yrs = courseYearsOf(a, S); r.courseYears = yrs;
    const gross = u.basis === 'gross'; const sch = +a.scholarship || 0; const fee1 = +a.tuition || 0;
    r.gross = gross;
    st.push({ h: 'Fee basis', t: gross ? 'Commission on the gross fee: the final tuition fee (first year) ' + money(fee1, u.cur) + ' plus the scholarship or discount on the application ' + money(sch, u.cur) + ' = ' + money(r2(fee1 + sch), u.cur) + ' a year.' : 'Commission on the net fee: the final tuition fee on the application, ' + money(fee1, u.cur) + ' (first year, after any scholarship, as the CoE shows it). ' + (sch ? 'The scholarship of ' + money(sch, u.cur) + ' is not added back: the contract pays on net.' : 'Nothing is added or taken off.'), ref: 'IP13' });
    st.push({ h: 'Paid and chargeable', t: 'Paid ' + PAYNAME[pay] + '; chargeable for ' + chargeTxt(ch) + '. Course length ' + yrs + ' year' + (yrs === 1 ? '' : 's') + '.', ref: 'IP14/IP15' });
    /* periods: each with its own date and its own fee where the application holds one */
    const P = [];
    if (PAY[pay]) {
      const per = PAY[pay].per, total = Math.ceil(yrs * per - 1e-9);
      for (let k = 1; k <= total; k++) {
        const y = Math.ceil(k / per), p = ((k - 1) % per) + 1, off = 12 * (y - 1) + PAY[pay].off[p - 1];
        const pr = (a.periods || [])[k - 1] || null;
        const date = pr && pr.census ? pr.census : k === 1 ? tb : addMonths(tb, off);
        const dWhy = pr && pr.census ? 'its census date on the application, ' + nice(date) : k === 1 ? tw : 'the first trigger date + ' + off + ' months = ' + nice(date) + ' (the application holds no date for this period)';
        let fee, feeWhy;
        if (pr && pr.tuition != null && pr.tuition !== '') { fee = +pr.tuition; feeWhy = 'the fee for period ' + k + ' on the application, ' + money(fee, u.cur); }
        else if (a.yearFees && a.yearFees[y - 1] != null && a.yearFees[y - 1] !== '') { fee = r2(+a.yearFees[y - 1] / per); feeWhy = 'year ' + y + '’s fee on the application ' + money(+a.yearFees[y - 1], u.cur) + (per > 1 ? ' ÷ ' + per + ' = ' + money(fee, u.cur) : ''); }
        else { fee = r2(fee1 / per); feeWhy = (y === 1 ? 'the final tuition fee (first year) ' : 'no fee for year ' + y + ' on the application, so the first year’s fee (Finance to confirm) ') + money(fee1, u.cur) + (per > 1 ? ' ÷ ' + per + ' = ' + money(fee, u.cur) : ''); }
        let add = 0; if (gross && y === 1 && sch) add = r2(sch / per);
        P.push({ k, y, p, per, date, dWhy, fee, feeWhy, add, s: (k - 1) * 12 / per, e: (k * 12) / per, label: per === 1 ? 'Year ' + y : PAY[pay].one + ' ' + k + (per > 1 ? ' (year ' + y + ', ' + PAY[pay].one.toLowerCase() + ' ' + p + ')' : '') });
      }
    } else if (pay === 'unit') {
      (a.units || []).forEach((x, i) => { const date = x.census || tb; const y = Math.floor(Math.max(0, monthsBetween(a.intake, date)) / 12) + 1; P.push({ k: i + 1, y, p: i + 1, per: 1, date, dWhy: x.census ? 'the unit’s census date, ' + nice(date) : tw, fee: +x.fee || 0, feeWhy: 'the unit fee on the application, ' + money(+x.fee || 0, u.cur), add: 0, unit: x.name || 'Unit ' + (i + 1), label: 'Unit ' + (i + 1) + ': ' + (x.name || 'unit') }); });
      if (!(a.units || []).length && a.enrolled) exc(a, 'Units missing', u.name + ' pays per unit of study, but the application lists no units. Admissions adds them from the enrolment statement.');
    } else if (pay === 'fees') {
      (a.feePayments || []).slice().sort((p, q) => (p.date < q.date ? -1 : 1)).forEach((x, i) => { const y = Math.floor(Math.max(0, monthsBetween(a.intake, x.date)) / 12) + 1; P.push({ k: i + 1, y, p: i + 1, per: 1, date: x.date, dWhy: 'the date the student paid, ' + nice(x.date), fee: +x.amt || 0, feeWhy: 'the fee payment of ' + money(+x.amt || 0, u.cur) + ' on ' + nice(x.date), add: 0, label: 'Fee payment ' + (i + 1) + ' (' + nice(x.date) + ')' }); });
    }
    /* chargeable time (IP14) */
    let left = ch.unit === 'fees' && ch.n ? +ch.n : ch.unit === 'points' ? +ch.n : null;
    const ppy = +a.pointsPerYear || DEF_POINTS;
    if (ch.unit === 'points') { st.push({ h: 'Credit points', t: 'Chargeable for the first ' + ch.n + ' credit points. The programme is worth ' + ppy + ' points a year' + (a.pointsPerYear ? ' (on the application)' : ' (the application gives none, so a full-time year of ' + DEF_POINTS + ' is assumed)') + '.', ref: 'IP14' }); if (!a.pointsPerYear && a.enrolled) exc(a, 'Points missing', u.name + ' pays on the first ' + ch.n + ' credit points, but the application does not say how many points the programme is worth a year. ' + DEF_POINTS + ' is assumed; Admissions adds the points from the offer letter.', 'warn'); }
    P.forEach((q) => {
      q.frac = 1; q.chWhy = '';
      if (ch.unit === 'course') q.chWhy = 'chargeable for the whole course';
      else if (ch.unit === 'points') { const pts = ppy * (PAY[pay] ? 1 / q.per : 1); const take = Math.max(0, Math.min(pts, left)); q.frac = pts ? take / pts : 0; left = left - take; q.chWhy = take >= pts ? 'all ' + r2(pts) + ' points of this period are within the first ' + ch.n : take > 0 ? 'only ' + r2(take) + ' of its ' + r2(pts) + ' points are within the first ' + ch.n + ' (' + r2(take) + ' ÷ ' + r2(pts) + ' = ' + Math.round(q.frac * 1000) / 10 + '% of its fee)' : 'beyond the first ' + ch.n + ' points'; }
      else if (ch.unit === 'unit') { if (pay === 'unit') { q.frac = q.k <= ch.n ? 1 : 0; q.chWhy = q.frac ? 'unit ' + q.k + ' of the ' + ch.n + ' chargeable' : 'beyond the ' + ch.n + ' chargeable units'; } else q.chWhy = 'a unit limit applies only when commission is paid per unit'; }
      else if (ch.unit === 'fees') { if (left == null) q.chWhy = 'every fee payment is chargeable'; else { const take = Math.max(0, Math.min(q.fee, left)); q.chWhy = take >= q.fee ? 'within the first ' + money(ch.n, u.cur) + ' of fees (' + money(left, u.cur) + ' left before it)' : take > 0 ? 'only ' + money(take, u.cur) + ' of it is within the first ' + money(ch.n, u.cur) + ' of fees' : 'beyond the first ' + money(ch.n, u.cur) + ' of fees'; q.fee = r2(take); q.frac = take > 0 ? 1 : 0; left = r2(left - take); } }
      else { const L = ch.n * UNIT_MONTHS[ch.unit]; if (PAY[pay]) { if (ch.unit === pay) { q.frac = q.k <= ch.n ? 1 : 0; } else q.frac = Math.max(0, Math.min(1, (L - q.s) / (q.e - q.s))); } else q.frac = monthsBetween(a.intake, q.date) < L ? 1 : 0; q.chWhy = q.frac === 1 ? 'inside the chargeable time (' + chargeTxt(ch) + ')' : q.frac === 0 ? 'after the chargeable time (' + chargeTxt(ch) + ')' : Math.round(q.frac * 100) + '% of this period falls inside the chargeable time (' + chargeTxt(ch) + '), so that share of its fee counts'; }
    });
    r.periods = P.filter((q) => q.frac > 0);
    r.dropped = P.length - r.periods.length;
    /* rate per period */
    r.periods.forEach((q) => { q.rate = pickRate(u, a, q.k, S); if (q.rate.tie) exc(a, 'Rate rows overlap', u.name + ': two rate rows match ' + a.student + ' equally (' + rowLabel(q.rate.ok[0], u.cur) + ' and ' + rowLabel(q.rate.ok[1], u.cur) + '). The first listed is used; make one more specific.', 'warn'); });
    r.rateMissing = !r.periods.length ? !rateRows(u).length : r.periods.every((q) => !q.rate.best);
    /* university-side promotions (IP9–11): matched on the intake start */
    r.promos = (u.promos || []).map((p) => ({ p, w: promoTest(p, a, S) }));
    if (!a.enrolled) return;
    if (r.rateMissing) exc(a, 'Rate missing', u.name + ' has no rate for ' + (LEVELS[a.level] || a.level) + '. Add it on the university’s terms.');
    if (u.starts && a.intake < u.starts) exc(a, 'Agreement not yet in force', u.name + '’s agreement starts ' + nice(u.starts) + '; this intake (' + nice(a.intake) + ') is before it. Held until Finance confirms which terms apply.');
    if (u.ends && a.intake > u.ends) exc(a, 'Contract ended', u.name + '’s contract ended ' + nice(u.ends) + '. New enrolments after that date are held until a renewal is entered.');
    if (u.country === 'AU' && !a.studentType) exc(a, 'Student type missing', 'Student type (new, progression or transfer) is mandatory for Australian universities. Admissions enters it.', 'warn');
  });

  /* ---------- pass 2: university tiers (college and group), on the intake ---------- */
  const isRefundedAfterTrigger = (x) => { const w = x.withdrawn; return !!(w && w.refund && w.date > base[x.id].trigBase); };
  const tierPool = (t, members, a, u) => {
    const keyOf = (x) => windowKey(t.window || 'CY', x.intake, t) + (t.scope === 'country' ? ' · ' + (x.nationality || '—') : '');
    const myKey = keyOf(a);
    const cand = A.filter((x) => x.enrolled && base[x.id].u && members.includes(x.uni) && (!(t.levels || []).length || t.levels.includes(x.level)) && keyOf(x) === myKey);
    let end = windowEnd(t.window || 'CY', a.intake, t);
    if (!end) end = cand.reduce((m, x) => (base[x.id].trigBase > m ? base[x.id].trigBase : m), a.intake);
    const reworked = today > end;
    const notes = [];
    const pool = cand.filter((x) => {
      const w = x.withdrawn;
      if (w && w.date <= base[x.id].trigBase) { notes.push(x.student + ' withdrew on ' + nice(w.date) + ', before their trigger date: never counted'); return false; }
      if (isRefundedAfterTrigger(x)) { if (reworked) { notes.push(x.student + ' withdrew with a refund on ' + nice(w.date) + ': taken out at the end-of-period rework (' + nice(end) + ')'); return false; } notes.push(x.student + ' withdrew with a refund on ' + nice(w.date) + ': still counted until the period ends on ' + nice(end) + ', then the band is re-worked (S5-15)'); }
      return true;
    }).sort((x, y) => ((x.intake || '') + (x.enrolled || '') + x.id < (y.intake || '') + (y.enrolled || '') + y.id ? -1 : 1));
    const rank = pool.findIndex((x) => x.id === a.id) + 1, total = pool.length;
    const useN = t.retro ? total : rank;
    const b = bandOf(t.bands, Math.max(1, useN));
    const setter = t.retro ? pool[total - 1] : a;
    return { key: myKey, pool, rank, total, b, useN, end, reworked, notes, setDate: setter ? base[setter.id].trigBase : null };
  };
  A.forEach((a) => {
    const r = base[a.id]; if (!r.u || !a.enrolled) return; const u = r.u; r.tiers = [];
    const g = r.group;
    if (u.tier && (u.tier.bands || []).length && (!(u.tier.levels || []).length || u.tier.levels.includes(a.level))) {
      const t = Object.assign({}, u.tier); if (t.scope === 'intake') t.window = 'intake';
      const pool = t.pool || (g && g.legacy ? 'group' : 'uni');
      const members = pool === 'group' && g ? g.members : [u.id];
      const res = tierPool(t, members, a, u);
      r.tiers.push(Object.assign({ who: pool === 'group' && g ? 'group' : 'college', name: pool === 'group' && g ? g.name : u.name, t }, res));
    }
    if (g && g.tier && (g.tier.bands || []).length && (!(g.tier.levels || []).length || g.tier.levels.includes(a.level))) {
      const res = tierPool(g.tier, g.members, a, u);
      r.tiers.push(Object.assign({ who: 'group', name: g.name, t: g.tier }, res));
    }
    if (r.tiers.length) {
      const best = r.tiers.slice().sort((x, y) => y.b.pct - x.b.pct)[0];
      r.tier = best;
      r.uniTier = { rank: best.rank, total: best.total, band: best.b, retro: !!best.t.retro, key: best.key, scope: best.t.scope, who: best.who, name: best.name };
    }
  });

  /* ---------- pass 3: lines, amounts, top-ups, statuses ---------- */
  A.forEach((a) => {
    const r = base[a.id]; if (!r.u || !a.enrolled) return; const u = r.u; const cur = u.cur;
    const tiersTxt = (r.tiers || []).map((T) => {
      const order = T.pool.map((x, i) => (i + 1) + '. ' + x.student + ' (' + monthName(x.intake.slice(0, 7)) + (x.uni !== a.uni ? ', ' + (U[x.uni] ? U[x.uni].name : x.uni) : '') + ')' + (x.id === a.id ? ' ← this student' : '')).join('; ');
      return { h: (T.who === 'group' ? 'Group tier: ' : 'University tier: ') + T.name, t: (T.t.retro ? 'Retrospective' : 'Prospective') + ', counted per ' + winLabel(T.t.window || 'CY', T.t) + (T.t.scope === 'country' ? ' and per source country' : '') + (T.who === 'group' ? ', across every university in the group (members count even without a tier of their own)' : '') + (T.t.levels && T.t.levels.length ? ', levels ' + T.t.levels.join(', ') : '') + '. Bands ' + bandTxt(T.t.bands) + '. Window ' + T.key + ' (by intake, not census): ' + T.total + ' student' + (T.total === 1 ? '' : 's') + ' counted, in order: ' + order + '. ' + (T.t.retro ? 'Retrospective, so the total (' + T.total + ') sets the band for everyone' : 'Prospective, so this student’s own place (' + T.rank + ') sets the band') + ': band ' + (T.b.i + 1) + ' → ' + T.b.pct + '%.' + (T.notes.length ? ' ' + T.notes.join('. ') + '.' : ''), ref: T.who === 'group' ? 'IP12' : T.t.window === 'intake' ? 'IP4' : T.t.retro ? 'IP2' : 'IP3' };
    });
    if ((r.tiers || []).length > 1) tiersTxt.push({ h: 'College tier and group tier', t: r.tiers.map((T) => T.name + ' ' + T.b.pct + '%').join(' vs ') + ': the higher rate wins (proposal), so ' + r.tier.b.pct + '% (' + r.tier.name + '). They do not stack.', ref: 'IP12' });
    const promoTxt = r.promos.length ? { h: 'University promotions', t: r.promos.map(({ p, w }) => (p.name || p.id) + ' (' + (p.amt != null && p.amt !== '' ? money(+p.amt, cur) : pctTxt(p.pct)) + ', ' + ({ highest: 'highest wins', replace: 'replaces the rate', additional: 'additional commission line' }[p.combine || 'highest']) + (p.from || p.to ? ', intakes ' + nice(p.from) + ' to ' + nice(p.to) : '') + '): ' + (w.length ? 'does not apply: ' + w.join('; ') : 'applies')).join('. ') + '. Matched on the intake start ' + nice(a.intake) + ', not the enrolment or census date.', ref: 'IP9–11' } : null;
    const lines = [];
    let firstYearBase = 0;
    r.periods.forEach((q) => {
      const rt = q.rate; const row = rt.best;
      const tr = [].concat(r.steps);
      const isYr1 = q.y === 1;
      const key = PAY[r.pay] ? (isYr1 ? 'ip' + q.p : 'an' + q.y + '-' + q.p) : (r.pay === 'unit' ? 'un' : 'fp') + q.k;
      const kk = PAY[r.pay] ? (isYr1 ? q.p : 'Y' + q.y + '-' + q.p) : (r.pay === 'unit' ? 'U' : 'F') + q.k;
      tr.push({ h: 'Period', t: q.label + ': ' + q.chWhy + '. Trigger: ' + TRIG[u.trigger] + '; this line is due on ' + q.dWhy + '.', ref: 'IP15' });
      const considered = rt.ok.map((x) => rowLabel(x, cur) + (x === row ? ' ✓ used' : ' (matches, less specific)')).concat(rt.no.map((n) => rowLabel(n.x, cur) + ' ✗ ' + n.w.join('; ')));
      tr.push({ h: 'Rate', t: (row ? 'Uses ' + rowLabel(row, cur) + (row.src === 'row' ? ' (the most specific row that matches)' : '') + '. ' : 'No row matches. ') + 'Rows considered for ' + (LEVELS[a.level] || a.level) + (a.course ? ', ' + a.course : '') + (a.campus ? ', ' + a.campus + ' campus' : '') + (a.nationality ? ', from ' + a.nationality : '') + ', period ' + q.k + ': ' + (considered.join(' | ') || 'none') + '.', ref: row && row.src === 'row' ? rowKeys(row).filter((k) => k !== 'level').map((k) => ({ course: 'IP6', campus: 'IP16', region: 'IP7', period: 'IP5' }[k])).join('/') || 'IP6' : 'IP1/IP6' });
      if (row && row.amt != null && row.period == null && q.k > 1) { return; } // a fixed amount without a period is paid once
      let pct = row ? row.pct : null, fixed = row && row.amt != null ? row.amt : null;
      if (fixed == null && r.tier) {
        const tp = r.tier.b.pct;
        if (!row || row.src === 'level') { tiersTxt.forEach((x) => tr.push(x)); tr.push({ h: 'Rate after tier', t: 'The tier band replaces the level rate' + (row ? ' (' + pctTxt(row.pct) + ')' : '') + ': ' + tp + '%.', ref: 'IP2–4' }); pct = tp; }
        else { tiersTxt.forEach((x) => tr.push(x)); const hi = Math.max(row.pct, tp); tr.push({ h: 'Rate after tier', t: 'A specific rate row (' + pctTxt(row.pct) + ') and the tier band (' + tp + '%): the higher wins (proposal), ' + hi + '%.', ref: 'IP2–4' }); pct = hi; }
      }
      const add = [];
      if (fixed == null && pct != null) {
        const ap = r.promos.filter((x) => !x.w.length);
        const rep = ap.filter((x) => (x.p.combine || 'highest') === 'replace' && x.p.pct != null && x.p.pct !== '');
        const hi = ap.filter((x) => (x.p.combine || 'highest') === 'highest' && x.p.pct != null && x.p.pct !== '');
        if (promoTxt) tr.push(promoTxt);
        if (rep.length) { const best = rep.slice().sort((x, y) => y.p.pct - x.p.pct)[0]; tr.push({ h: 'Rate after promotion', t: (best.p.name || best.p.id) + ' replaces the rate: ' + pct + '% → ' + +best.p.pct + '%.', ref: 'IP9–11' }); pct = +best.p.pct; }
        hi.forEach((x) => { if (+x.p.pct > pct) { tr.push({ h: 'Rate after promotion', t: (x.p.name || x.p.id) + ': ' + +x.p.pct + '% is higher than ' + pct + '%, so ' + +x.p.pct + '% applies (highest wins).', ref: 'IP9–11' }); pct = +x.p.pct; } else tr.push({ h: 'Rate after promotion', t: (x.p.name || x.p.id) + ': ' + +x.p.pct + '% is not higher than ' + pct + '%, so ' + pct + '% stays (highest wins).', ref: 'IP9–11' }); });
        ap.filter((x) => x.p.combine === 'additional').forEach((x) => add.push(x.p));
      } else if (promoTxt && fixed != null) tr.push({ h: 'University promotions', t: 'A fixed amount is not changed by promotions or tiers.', ref: 'IP9–11' });
      const baseFee = r2((q.fee + q.add) * q.frac);
      if (isYr1) firstYearBase = r2(firstYearBase + baseFee);
      let amt;
      if (fixed != null) { amt = fixed; tr.push({ h: 'Amount', t: 'Fixed amount ' + money(fixed, cur) + (row.period != null ? ' for study period ' + row.period : ', once per student, with the first period') + '.', ref: 'IP1' }); }
      else if (pct == null) { amt = null; tr.push({ h: 'Amount', t: 'No rate for ' + (LEVELS[a.level] || a.level) + ': this line cannot be priced until the rate is added.' }); }
      else { amt = r2((baseFee * pct) / 100); tr.push({ h: 'Amount', t: 'Base: ' + q.feeWhy + (q.add ? ' + scholarship share ' + money(q.add, cur) + ' (gross)' : '') + (q.frac < 1 ? ' × ' + Math.round(q.frac * 1000) / 10 + '% chargeable' : '') + ' = ' + money(baseFee, cur) + '. ' + money(baseFee, cur) + ' × ' + pct + '% = ' + money(amt, cur) + ' (rounded half up to the cent).', ref: 'IP1' }); }
      lines.push({ key, k: kk, n: PAY[r.pay] ? q.per : r.periods.length, y: q.y, p: q.p, date: q.date, fixed, pct, amt, base: baseFee, annuity: !isYr1, type: 'standard', label: q.label, trace: tr, period: q });
      add.forEach((p) => {
        const isAmt = p.amt != null && p.amt !== '';
        if (isAmt && q.k > 1) return;
        const v = isAmt ? +p.amt : r2((baseFee * +p.pct) / 100);
        lines.push({ key: 'ad-' + (p.id || 'x') + '-' + q.k, k: 'A' + q.k + '-' + (p.id || 'x'), n: 1, y: q.y, p: q.p, date: q.date, fixed: isAmt ? v : null, pct: isAmt ? null : +p.pct, amt: v, base: baseFee, annuity: !isYr1, type: 'additional', additional: true, label: 'Additional commission: ' + (p.name || p.id) + ' (' + q.label + ')', trace: tr.slice(0, r.steps.length + 1).concat([promoTxt, { h: 'Additional commission', t: (p.name || p.id) + ' is an additional commission on top of the standard line: ' + (isAmt ? money(v, cur) + ' fixed, once per student' : money(baseFee, cur) + ' × ' + +p.pct + '% = ' + money(v, cur)) + '. It is commission on the course, so the RP gets its share of it (proposal).', ref: 'IP19' }]) });
      });
    });
    /* cap per student on the first year's standard lines */
    const fy = lines.filter((l) => l.type === 'standard' && !l.annuity && l.amt != null); const tot = r2(fy.reduce((s, l) => s + l.amt, 0));
    if (u.cap && tot > u.cap && tot > 0) { const f = u.cap / tot; fy.forEach((l) => { const was = l.amt; l.amt = r2(l.amt * f); l.trace.push({ h: 'Cap', t: 'The first year’s commission (' + money(tot, cur) + ') is over the cap of ' + money(u.cap, cur) + ' per student, so each line is scaled by ' + Math.round(f * 10000) / 100 + '%: ' + money(was, cur) + ' → ' + money(l.amt, cur) + '.' }); }); r.capped = true; }
    /* bonuses: per tier band, per student, or once a threshold is reached (IP19). GSP's own: never shared with RPs */
    const first = lines.find((l) => l.type === 'standard') || null;
    if (first) {
      const fyBase = firstYearBase || r2((+a.tuition || 0) + (r.gross ? +a.scholarship || 0 : 0));
      const bonusLine = (key, name, kind, v, tr) => { const amt = kind === 'pct' ? r2((fyBase * v) / 100) : +v; lines.push({ key, k: 'B', n: 1, y: 1, p: 1, date: first.date, fixed: amt, pct: null, amt, bonus: true, type: 'bonus', label: 'Bonus: ' + name, trace: r.steps.slice(0, 1).concat(tr, [{ h: 'Bonus amount', t: kind === 'pct' ? money(fyBase, cur) + ' (first-year fee base) × ' + v + '% = ' + money(amt, cur) + '.' : 'Fixed ' + money(amt, cur) + '.', ref: 'IP19' }, { h: 'Not shared', t: 'A bonus is GSP’s: RPs are paid on standard and additional commission only.', ref: 'IP19' }]) }); };
      (r.tiers || []).forEach((T) => { const bb = (T.t.bandBonus && T.t.bandBonus[String(T.b.i + 1)]) || (T.t.bandFixed && T.t.bandFixed[String(T.b.i + 1)] ? { kind: 'fixed', v: +T.t.bandFixed[String(T.b.i + 1)] } : null); if (bb && +bb.v) { r.uniBonus = bb.kind === 'pct' ? r2((fyBase * bb.v) / 100) : +bb.v; bonusLine(T.who === 'group' ? 'ipbg' : 'ipb', T.name + ' band ' + (T.b.i + 1), bb.kind, +bb.v, tiersTxt.concat([{ h: 'Band bonus', t: 'Band ' + (T.b.i + 1) + ' carries a bonus of ' + (bb.kind === 'pct' ? bb.v + '% of the fee' : money(+bb.v, cur)) + ' per student.', ref: 'IP19' }])); } });
      (u.bonuses || []).forEach((B) => {
        const skip = (why) => { r.bonusSkip = (r.bonusSkip || []).concat([{ name: B.name || B.id, why }]); };
        if ((B.levels || []).length && !B.levels.includes(a.level)) { skip(`this is a ${a.level} student, and the bonus is for ${B.levels.join(', ')} only`); return; }
        if (B.per === 'band') {
          const win = B.window || 'CY'; const k0 = windowKey(win, a.intake, B);
          const pool = A.filter((x) => x.enrolled && x.uni === a.uni && (!(B.levels || []).length || B.levels.includes(x.level)) && windowKey(win, x.intake, B) === k0 && !(x.withdrawn && x.withdrawn.date <= base[x.id].trigBase)).sort((x, y) => (x.intake + x.id < y.intake + y.id ? -1 : 1));
          const rank = pool.findIndex((x) => x.id === a.id) + 1; if (!rank) return;
          const n = B.retro === false ? rank : pool.length;
          const bi = (B.bands || []).findIndex((b) => n >= b[0] && (b[1] == null || n <= b[1]));
          const bandsT = (B.bands || []).map((b) => b[0] + (b[1] == null ? '+' : '–' + b[1]) + ': ' + (b[3] === 'pct' ? b[2] + '%' : money(+b[2], cur))).join(', ');
          const cnt = (B.retro === false ? 'Counted prospectively: this student is number ' + rank : 'Counted retrospectively: ' + pool.length + ' students enrolled') + ' in the ' + winLabel(win, B) + ' (' + k0 + ')' + ((B.levels || []).length ? ' at ' + B.levels.join(', ') : '') + '.';
          if (bi < 0) { r.bonusProgress = (r.bonusProgress || []).concat([{ B, have: pool.length, th: +B.bands[0][0] }]); skip(B.retro === false ? `this student is number ${rank} in the ${winLabel(win, B)} (${k0})${(B.levels || []).length ? ' at ' + B.levels.join(', ') : ''}, and the bonus starts at student ${B.bands[0][0]}` : `${pool.length} student${pool.length === 1 ? '' : 's'} enrolled in the ${winLabel(win, B)} (${k0})${(B.levels || []).length ? ' at ' + B.levels.join(', ') : ''} so far, and the bonus starts at ${B.bands[0][0]}`); return; }
          const bd = B.bands[bi];
          bonusLine('bo-' + B.id, B.name || B.id, bd[3] === 'pct' ? 'pct' : 'fixed', +bd[2], [{ h: 'Bonus scheme', t: (B.name || B.id) + ', per student by count: ' + bandsT + '. ' + cnt + ' That is band ' + (bi + 1) + ' (' + bd[0] + (bd[1] == null ? '+' : '–' + bd[1]) + ').', ref: 'IP19' }]);
        } else if ((B.per || 'student') === 'student') bonusLine('bo-' + B.id, B.name || B.id, B.kind, +B.v, [{ h: 'Bonus scheme', t: (B.name || B.id) + ': ' + (B.kind === 'pct' ? B.v + '% of the first-year fee' : money(+B.v, cur)) + ' per student' + ((B.levels || []).length ? ' at ' + B.levels.join(', ') : '') + '.', ref: 'IP19' }]);
        else {
          const win = B.window || 'CY'; const k0 = windowKey(win, a.intake, B);
          const pool = A.filter((x) => x.enrolled && x.uni === a.uni && (!(B.levels || []).length || B.levels.includes(x.level)) && windowKey(win, x.intake, B) === k0 && !(x.withdrawn && x.withdrawn.date <= base[x.id].trigBase)).sort((x, y) => (x.intake + x.id < y.intake + y.id ? -1 : 1));
          const rank = pool.findIndex((x) => x.id === a.id) + 1;
          r.bonusProgress = (r.bonusProgress || []).concat([{ B, have: pool.length, th: +B.threshold }]);
          if (rank === +B.threshold) bonusLine('bo-' + B.id, B.name || B.id, B.kind, +B.v, [{ h: 'Bonus scheme', t: (B.name || B.id) + ': ' + (B.kind === 'pct' ? B.v + '% of the fee' : money(+B.v, cur)) + ' once ' + B.threshold + ' students enrol in the ' + winLabel(win, B) + ' (' + k0 + '). This student is number ' + rank + ' of ' + pool.length + ' (' + pool.map((x) => x.student).join(', ') + '), so the lump sum sits on this line.', ref: 'IP19' }]);
        }
      });
    }
    r.lines = [];
    /* statuses, top-ups and recoveries */
    const held = u.starts && a.intake < u.starts ? 'Agreement not yet in force' : u.ends && a.intake > u.ends ? 'Contract ended' : null;
    const wd = a.withdrawn;
    const fxOf = (l) => { const d = l.date <= today ? l.date : today; l.fxDate = d; l.fx = fxRate(cfg, cur, d); l.fxWeek = fxWeek(cfg, d); l.aud = l.fx == null || l.ent == null ? null : r2(l.ent * l.fx); l.dueAud = l.fx == null || l.due == null ? null : r2(l.due * l.fx); };
    const finish = (l) => {
      l.cancelled = !!(wd && wd.date <= l.date); l.refunded = !!(wd && wd.date > l.date && wd.refund);
      l.paid = (a.paidIP && a.paidIP[l.key]) || null; l.inv = (a.inv && a.inv[l.key]) || null;
      if (l.ent === undefined) l.ent = l.cancelled || l.refunded || l.amt == null ? 0 : l.amt;
      else if (l.cancelled || l.refunded) l.ent = 0;
      l.held = held && !l.paid ? held : l.amt == null ? 'Rate missing' : null;
      const paidAmt = l.paid ? +l.paid.amt : 0; l.due = r2(l.ent - paidAmt);
      if (l.cancelled) l.st = ['Not payable', 'p-mute', 'Student withdrew on ' + nice(wd.date) + ', before this date'];
      else if (l.paid && l.due < 0) l.st = ['University recovers', 'p-bad', (wd && wd.refund ? 'Student withdrew with a refund on ' + nice(wd.date) + '; ' : '') + 'the university takes back ' + money(-l.due, cur)];
      else if (l.ent < 0 && !l.paid) l.st = ['Credit to university', 'p-bad', 'The band went down at the end-of-period rework; GSP owes back ' + money(-l.ent, cur)];
      else if (l.paid) l.st = ['Paid', 'p-good', 'Received ' + nice(l.paid.date)];
      else if (l.held) l.st = ['Held: ' + l.held.toLowerCase(), 'p-bad', ''];
      else if (l.inv) { const dueOn = addDays(l.inv, +u.payDays || 30); l.dueOn = dueOn; l.st = dueOn < today ? ['Payment overdue', 'p-bad', 'Invoiced ' + nice(l.inv) + ', due ' + nice(dueOn)] : ['Invoiced', 'p-acc', 'Invoiced ' + nice(l.inv) + ', due ' + nice(dueOn)]; }
      else if (l.date <= today && !l.refunded) l.st = [l.topup ? 'Top-up to invoice' : 'Ready to invoice', 'p-warn', 'Trigger date ' + nice(l.date) + ' has passed'];
      else l.st = ['Not yet due', 'p-mute', 'Trigger date ' + nice(l.date)];
      l.gst = u.country === 'AU' ? r2((l.ent * (S.auGst || 0)) / 100) : 0;
      fxOf(l);
      if (l.cancelled) l.trace.push({ h: 'Withdrawal', t: 'The student withdrew on ' + nice(wd.date) + ', before this line’s date: nothing is payable.' });
      if (l.refunded) l.trace.push({ h: 'Withdrawal', t: 'The student withdrew with a refund on ' + nice(wd.date) + ': the university keeps nothing' + (l.paid ? ' and takes back the ' + money(+l.paid.amt, cur) + ' it paid' : '') + '.' });
      if (l.held) l.trace.push({ h: 'Held', t: l.held + '.' + (l.held === 'Agreement not yet in force' ? ' The agreement starts ' + nice(u.starts) + '.' : l.held === 'Contract ended' ? ' The contract ended ' + nice(u.ends) + '.' : ''), ref: 'IP17' });
      if (l.gst) l.trace.push({ h: 'GST', t: 'Australian university: the invoice adds ' + (S.auGst || 0) + '% GST, ' + money(l.ent, cur) + ' × ' + (S.auGst || 0) + '% = ' + money(l.gst, cur) + '.' });
      l.trace.push({ h: 'Currency', t: cur === 'AUD' ? 'The university pays in AUD.' : 'The university pays in ' + cur + '. AUD view at the rate for the week of ' + (l.date <= today ? 'the trigger date, ' : 'today (the trigger date is still ahead), ') + nice(l.fxDate) + (l.fx == null ? ': no ' + cur + ' rate for that week, so the AUD view is blank.' : ' (week of ' + nice(l.fxWeek) + '): ' + money(l.ent, cur) + ' × ' + l.fx + ' = ' + money(l.aud, 'AUD') + '.'), ref: 'IP18' });
      r.lines.push(l); out.ip.push({ app: a.id, l, u, a });
    };
    lines.forEach((l) => {
      l.full = l.amt; const paidO = a.paidIP && a.paidIP[l.key]; const invAmt = a.invAmt && a.invAmt[l.key];
      const billed = paidO ? +paidO.amt : invAmt != null ? +invAmt : null;
      const kids = [];
      if (billed != null && l.amt != null && !(wd && wd.date <= l.date)) {
        l.ent = wd && wd.refund && wd.date > l.date ? 0 : billed;
        let rest = r2(l.amt - billed); let i = 1;
        while ((a.inv && a.inv[l.key + '~t' + i]) || (a.paidIP && a.paidIP[l.key + '~t' + i])) {
          const k = l.key + '~t' + i; const fixed = a.paidIP && a.paidIP[k] ? +a.paidIP[k].amt : a.invAmt && a.invAmt[k] != null ? +a.invAmt[k] : rest;
          kids.push({ k, amt: fixed }); rest = r2(rest - fixed); i++;
        }
        if (Math.abs(rest) >= 0.01 && !(wd && wd.refund && wd.date > l.date)) kids.push({ k: l.key + '~t' + i, amt: rest, open: true });
        if (kids.length) l.trace.push({ h: 'Billed on this line', t: 'This line was ' + (paidO ? 'paid at ' : 'invoiced at ') + money(billed, cur) + ' before the rate changed to ' + pctTxt(l.pct) + '. The full amount for the period is now ' + money(l.amt, cur) + '; the difference is on the top-up line' + (kids.length > 1 ? 's' : '') + ' below, which GSP invoices to the university.', ref: 'IP2' });
      }
      finish(l);
      const setDate = r.tier && r.tier.setDate && r.tier.setDate > l.date ? r.tier.setDate : l.date;
      kids.forEach((c, j) => {
        const t = { key: c.k, k: l.k + '~t' + (j + 1), n: l.n, y: l.y, p: l.p, date: setDate, fixed: c.amt, pct: l.pct, amt: c.amt, ent: c.amt, annuity: l.annuity, type: 'topup', topup: true, parent: l.key, parentLine: l, label: (c.amt < 0 ? 'Credit after tier rework: ' : 'Tier top-up: ') + l.label, trace: l.trace.filter((x) => x.h !== 'Billed on this line' && x.h !== 'Currency' && x.h !== 'GST').concat([{ h: c.amt < 0 ? 'Credit' : 'Top-up', t: 'Full amount for the period ' + money(l.amt, cur) + ' − billed on the original line ' + money(billed, cur) + (j ? ' − earlier top-ups ' + money(r2(kids.slice(0, j).reduce((s, x) => s + x.amt, 0)), cur) : '') + ' = ' + money(c.amt, cur) + '. ' + (c.amt < 0 ? 'The band went down at the end-of-period rework, so GSP owes it back.' : 'A retrospective tier moved the band up, so GSP invoices the university for the difference: this is GSP’s receivable, and the RP’s matching top-up waits until it is paid.'), ref: 'IP2' }]) };
        finish(t); kids[j].line = t;
      });
      l.topups = kids.map((c) => c.line);
      l.received = r2((l.paid ? +l.paid.amt : 0) + l.topups.reduce((s, t) => s + (t.paid ? +t.paid.amt : 0), 0));
      l.fullEnt = l.cancelled || l.refunded || l.amt == null ? 0 : l.amt;
    });
    r.received = r.lines.filter((l) => l.paid && (l.type === 'standard' || l.type === 'additional')).map((l) => l.paid.date).sort()[0] || null;
    r.nothingEarned = r.lines.filter((l) => l.type === 'standard').every((l) => l.refunded || l.cancelled);
    r.counts = !!r.received && !r.nothingEarned;
  });

  /* ---------- pass 4: RP side ---------- */
  const RG = regionGroupsOf(S);
  const regionOk = (n, rp) => {
    if ((n.regions || []).length) return n.regions.some((g) => lc(g) === lc(rp.region) || (RG[g] || []).some((c) => lc(c) === lc(rp.region)) || (lc(g) === 'global'));
    const reg = String(n.region || '');
    return reg.startsWith(rp.region) || (reg.startsWith('Global') && !(reg.includes('excl. Australia Onshore') && rp.region === 'Australia Onshore')) || !reg;
  };
  const noticeTest = (n, a, r, rp) => {
    const w = []; const listed = (n.rps || []).length; const d = a.intake;
    if (listed && !n.rps.includes(rp.id) && !(rp.payee && n.rps.includes(rp.payee))) w.push('lists RPs ' + n.rps.join(', ') + ', not ' + rp.id);
    if (!listed && !regionOk(n, rp)) w.push('for ' + ((n.regions || []).length ? n.regions.join(', ') : n.region) + ', the RP is in ' + rp.region);
    if (n.start && d < n.start) w.push('intake ' + nice(d) + ' is before ' + nice(n.start));
    if (n.end && d > n.end) w.push('intake ' + nice(d) + ' is after ' + nice(n.end));
    if ((n.intakes || []).length && !n.intakes.includes(d.slice(0, 7))) w.push('intakes ' + n.intakes.map(monthName).join(', ') + ' only; this is ' + monthName(d.slice(0, 7)));
    if ((n.dest || []).length && !n.dest.includes(r.u.country)) w.push('destinations ' + n.dest.map((x) => DEST[x] || x).join(', ') + ' only; this is ' + (DEST[r.u.country] || r.u.country));
    if ((n.unis || []).length && !n.unis.includes(r.u.id)) w.push('universities ' + n.unis.map((x) => (U[x] ? U[x].name : x)).join(', ') + ' only');
    if ((n.levels || []).length && !n.levels.includes(a.level)) w.push('levels ' + n.levels.join(', ') + ' only');
    return w;
  };
  const nPct = (n) => (n.kind === 'tier' ? +((n.bands || [[0, 0, 0]])[0][2]) : n.kind === 'tuitionPct' ? 0 : +n.flat || 0);
  const noticeFor = (a, r, rp) => {
    if (!r.u) return null;
    const tested = notices.map((n) => ({ n, w: noticeTest(n, a, r, rp) }));
    const c = tested.filter((x) => !x.w.length).map((x) => x.n);
    const pctN = c.filter((n) => n.kind !== 'milestone' && n.kind !== 'tuitionPct').sort((x, y) => ((y.rps || []).length ? 2 : 1) - ((x.rps || []).length ? 2 : 1) || nPct(y) - nPct(x));
    return { pct: pctN[0] || null, ms: c.filter((n) => n.kind === 'milestone'), tp: c.filter((n) => n.kind === 'tuitionPct'), all: c, tested, others: pctN.slice(1) };
  };
  const leadOf = (a) => !!a.gspLead && a.enrolReady !== false;
  A.forEach((a) => {
    const r = base[a.id]; const rp = RP[a.rp]; r.rp = rp;
    if (!rp) { if (a.enrolled) exc(a, 'No RP', 'Recruitment partner ' + a.rp + ' is not in the RP list.'); return; }
    r.payee = rp.payee && RP[rp.payee] ? RP[rp.payee] : rp; r.notice = noticeFor(a, r, rp);
    r.lead = leadOf(a);
  });
  A.forEach((a) => { const r = base[a.id]; r.boxed = !!(r.notice && r.notice.pct && r.notice.pct.combine === 'box' && !r.lead); });
  const schemeOf = (rp) => (rp.flat != null && rp.flat !== '' ? { type: 'flat', flat: +rp.flat, name: 'Own flat rate' } : rp.scheme && SC[rp.scheme] ? SC[rp.scheme] : null);
  /* who counts toward an RP tier: GSP received the university's money, and not reworked out (S5-15) */
  const rpCountable = (x, win, notes) => {
    const b = base[x.id]; if (!b.received) return false;
    if (b.nothingEarned) { const end = windowEnd(win, x.intake) || addMonths(x.intake, 6); if (today > end) { notes && notes.push(x.student + ' withdrew with a refund on ' + nice(x.withdrawn.date) + ': taken out at the end-of-period rework on ' + nice(end)); return false; } notes && notes.push(x.student + ' withdrew with a refund on ' + nice(x.withdrawn.date) + ': still counted until the period ends on ' + nice(end) + ', when the band is re-worked (S5-15). Rework pending.'); }
    return true;
  };
  const cap = S.rpCap == null || S.rpCap === '' ? 100 : +S.rpCap;
  A.forEach((a) => {
    const r = base[a.id]; const rp = r.rp; if (!rp || !r.u || !a.enrolled) return;
    const why = []; const tr = []; let pct = null, src = '';
    const tp = r.payee || rp; const viaMP = tp.id !== rp.id;
    const t0 = viaMP ? 'RP: ' + rp.name + ', mapped to Master Partner ' + tp.name + '. GSP pays the Master Partner under the Master Partner’s own terms; the Master Partner pays the RP from that under their own agreement, outside GSP. The tier counts all of the Master Partner’s RPs together.' : 'RP: ' + rp.name + ' (' + rp.region + '). All branches of an RP share one count and one rate.';
    why.push(t0); tr.push({ h: 'Who is paid', t: t0 });
    const sch = schemeOf(tp); let basePct = null, baseWhy = '', est = false, baseRef = 'RP1', orderTxt = '';
    if (sch) {
      if (sch.type === 'flat') { basePct = +sch.flat; baseWhy = (sch.name === 'Own flat rate' ? (viaMP ? 'Master Partner’s own flat rate' : 'RP’s own flat rate') : 'Scheme ' + sch.id + ' ' + sch.name) + ': ' + basePct + '% of GSP’s base commission.'; }
      else {
        const win = sch.window || 'CY'; const notes = [];
        const peersAll = A.filter((x) => base[x.id].payee && base[x.id].payee.id === tp.id && base[x.id].u && x.enrolled && !base[x.id].boxed && !base[x.id].lead);
        const wk = windowKey(win, a.intake);
        const inWin = peersAll.filter((x) => windowKey(win, x.intake) === wk && rpCountable(x, win, x.id === a.id ? null : notes)).sort((x, y) => (x.intake + (base[x.id].received || '') + x.id < y.intake + (base[y.id].received || '') + y.id ? -1 : 1));
        let rank = inWin.findIndex((x) => x.id === a.id) + 1; if (!rank) { rank = inWin.length + 1; est = true; }
        const total = Math.max(inWin.length, rank);
        const top = sch.bands[sch.bands.length - 1]; let useN = rank, mode = 'prospective';
        if (sch.retro === 'yes') { useN = total; mode = 'retrospective'; } else if (sch.retro === 'top') { if (total >= top[0]) { useN = total; mode = 'retrospective (top band reached)'; } else mode = 'prospective until the top band'; }
        const b = bandOf(sch.bands, useN); basePct = b.pct; r.rpTier = { rank, total, band: b, mode, wk, est, pending: notes.filter((x) => /pending/.test(x)) };
        baseRef = mode.startsWith('retro') ? 'RP2' : 'RP3';
        const ORDER = '@@ORDER@@'; orderTxt = ', in order: ' + (inWin.map((x, i) => i + 1 + '. ' + x.student + ' (' + monthName(x.intake.slice(0, 7)) + ')' + (x.id === a.id ? ' ← this student' : '')).join('; ') || 'none');
        baseWhy = 'Scheme ' + sch.id + ' ' + sch.name + ' (' + bandTxt(sch.bands) + '), ' + mode + ', counted per ' + (winName[win] || win) + ' by intake (not by the date GSP was paid). Window ' + wk + ': ' + (est ? 'GSP has not received this student’s commission yet, so they would be enrolment ' + rank + ' (estimate). ' : '') + inWin.length + ' enrolment' + (inWin.length === 1 ? '' : 's') + ' GSP has been paid for' + ORDER + '. ' + (mode.startsWith('retro') ? 'The total (' + total + ') sets the band for everyone in the window' : 'This student’s own place (' + rank + ') sets the band') + ': band ' + (b.i + 1) + ' → ' + b.pct + '%.' + (notes.length ? ' ' + notes.join('. ') + '.' : '') + ' GSP leads (50%) and notice boxes are not counted.';
      }
    } else {
      if (S.defaultMode === 'hold') { baseWhy = 'No commission terms for this RP. The line waits in exceptions.'; exc(a, 'RP has no terms', tp.name + ' has no commission terms. Add them to price this line.'); }
      else { basePct = +S.defaultPct; baseWhy = 'No commission terms for this RP: the new-contract default of ' + basePct + '% applies.'; exc(a, 'RP has no terms', tp.name + ' has no commission terms; the default ' + basePct + '% was used. Confirm or add terms.', 'warn'); }
    }
    const baseWhyRp = baseWhy.replace('@@ORDER@@', ''); baseWhy = baseWhy.replace('@@ORDER@@', orderTxt);
    const nt = r.notice;
    const ntTxt = nt && nt.tested.length ? { h: 'Notices considered', t: nt.tested.map(({ n, w }) => n.id + ' ' + n.name + ': ' + (w.length ? 'does not apply (' + w.join('; ') + ')' : 'applies')).join('. ') + '. Notices are matched on the intake start, ' + nice(a.intake) + '.', ref: 'RP4–7' } : null;
    if (a.gspLead && a.enrolReady === false) exc(a, 'Special lead not enrolment-ready', 'GSP gave ' + rp.name + ' this lead, but the application is not marked enrolment-ready, so the 50% special-lead rate does not apply and the RP’s standard terms are used. Confirm.', 'warn');
    if (r.lead) { pct = +S.gspLeadPct; src = 'GSP lead'; const t = 'Special lead: GSP gave the RP a qualified student lead (on the application: GSP lead) and the RP provided an enrolment-ready application (Enrolment-ready). Both hold, so a flat ' + pct + '% of GSP’s base commission. Tiers and notices do not apply, and this student does not count toward the RP’s tier.'; why.push(t); tr.push({ h: 'Special lead', t, ref: 'RP2' }); if (basePct != null) tr.push({ h: 'For reference', t: 'Without the special lead: ' + baseWhy }); }
    else {
      if (a.gspLead) tr.push({ h: 'Special lead', t: 'GSP lead is set, but the application is not marked enrolment-ready: both conditions are needed for the 50% rate, so the RP’s standard terms apply.', ref: 'RP2' });
      const n = nt && nt.pct;
      if (ntTxt) tr.push(ntTxt);
      if (n) {
        let np = null, nw = '';
        if (n.kind === 'tier') {
          const notes = [];
          const peers = A.filter((x) => base[x.id].payee && base[x.id].payee.id === tp.id && x.enrolled && base[x.id].notice && base[x.id].notice.pct && base[x.id].notice.pct.id === n.id && !base[x.id].lead && rpCountable(x, 'CY', x.id === a.id ? null : notes)).sort((x, y) => (x.intake + x.id < y.intake + y.id ? -1 : 1));
          let rank = peers.findIndex((x) => x.id === a.id) + 1, e2 = false; if (!rank) { rank = peers.length + 1; e2 = true; }
          const total = Math.max(peers.length, rank); const b = bandOf(n.bands, n.retro === 'yes' ? total : rank); np = b.pct;
          nw = n.id + ' ' + n.name + ' (' + bandTxt(n.bands) + ', ' + (n.retro === 'yes' ? 'retrospective' : 'prospective') + '): enrolment ' + rank + ' of ' + total + ' under the notice' + (e2 ? ' (estimate)' : '') + ' → ' + np + '%.';
        } else { np = +n.flat; nw = n.id + ' ' + n.name + ': ' + np + '% of GSP’s base commission' + (n.kind === 'flatfixed' ? ' plus ' + n.fixedCur + ' ' + n.fixed + ' per enrolment' : '') + '.'; }
        if (nt.others.length) nw += ' Other notices also cover it (' + nt.others.map((x) => x.id).join(', ') + '); a notice listing the RP beats a region-wide one, then the higher rate wins (proposal).';
        if (n.combine === 'box') { pct = np; src = n.id; why.push('Notice applies on the intake start (' + nice(a.intake) + '). ' + nw, 'The notice is a separate box: this enrolment does not count toward the RP’s standard tier, and the standard rate is not used.'); tr.push({ h: 'Notice', t: nw + ' A separate box: this enrolment does not count toward the RP’s standard tier, and the standard rate is not used' + (basePct != null ? ' (it would have been ' + basePct + '%: ' + baseWhy + ')' : '') + '.', ref: 'RP4–6' }); }
        else if (n.combine === 'highest') { pct = Math.max(np, basePct || 0); src = pct === np ? n.id : 'scheme'; why.push(baseWhyRp, 'Notice: ' + nw, 'Highest wins: ' + pct + '%.'); tr.push({ h: 'Standard terms', t: baseWhy, ref: baseRef }, { h: 'Notice', t: nw + ' Highest wins: ' + Math.max(np, basePct || 0) + '% vs ' + (basePct || 0) + '% → ' + pct + '%.', ref: 'RP4–6' }); }
        else { const sum = (basePct || 0) + np; pct = Math.min(sum, cap); src = 'scheme+' + n.id; why.push(baseWhyRp, 'Notice adds on: ' + nw, 'Total ' + pct + '%' + (sum > cap ? ' (capped)' : '') + '.'); tr.push({ h: 'Standard terms', t: baseWhy, ref: baseRef }, { h: 'Notice adds on', t: nw + ' ' + (basePct || 0) + '% + ' + np + '% = ' + sum + '%' + (sum > cap ? ', over ' + cap + '%: an RP never gets more than ' + cap + '% of GSP’s line (proposal), so ' + pct + '%.' : '.'), ref: 'C1' }); }
        if (n.note) why.push('Open point on this notice: ' + n.note);
      } else { pct = basePct; src = 'scheme'; why.push(baseWhyRp); tr.push({ h: 'Standard terms', t: baseWhy, ref: baseRef }); }
    }
    r.rpPct = pct; r.rpSrc = src; r.rpWhy = why; r.rpTrace = tr;
    const am = S.annuityRp || 'same'; const apct = tp.annuityPct != null && tp.annuityPct !== '' ? +tp.annuityPct : am === 'flat' ? +S.annuityPct : am === 'none' ? 0 : pct;
    r.annPct = apct; r.annWhy = tp.annuityPct != null && tp.annuityPct !== '' ? 'This RP has its own annuity rate: ' + apct + '% of GSP’s commission after the first year.' : am === 'flat' ? 'After the first year, RPs get a flat ' + apct + '% of GSP’s commission (Settings).' : am === 'none' ? 'Commission after the first year is not shared with RPs (Settings).' : 'After the first year the RP’s share is the same as the first year: ' + (pct == null ? '—' : pct + '%') + ' (Settings).';
    const cur = r.u.cur;
    r.lines.forEach((l) => {
      if (l.bonus || l.topup) return;
      const key = 'rp' + l.k; const ov = a.override && a.override[key]; const lp = l.annuity ? apct : pct;
      let ent = lp == null || l.amt == null ? null : r2((l.fullEnt * lp) / 100);
      const got = l.received;
      let earned = ent == null ? null : l.fullEnt === 0 ? 0 : got >= l.fullEnt - 0.005 ? ent : r2((got * lp) / 100);
      if (ov) { ent = +ov.amt; earned = got > 0 || l.fullEnt === 0 ? (l.fullEnt === 0 ? 0 : +ov.amt) : 0; }
      const paid = (a.paidRP && a.paidRP[key]) || 0; const due = earned == null ? null : r2(earned - paid);
      const label = (l.type === 'additional' ? l.label : l.annuity ? 'Commission after year 1: ' + l.label : 'Commission, ' + l.label.charAt(0).toLowerCase() + l.label.slice(1));
      const line = { key, app: a.id, a, r, ip: l, cur, ent, earned, paid, due, ov, kind: 'pct', label, annuity: !!l.annuity, lp, additional: l.type === 'additional' };
      line.payable = due != null && due !== 0 && (due < 0 || earned > 0);
      const waitTop = ent != null && earned != null && earned < ent - 0.005 && l.fullEnt > 0;
      line.st = due == null ? ['Cannot price', 'p-bad'] : due < 0 ? ['To recover from RP', 'p-bad'] : due === 0 && paid ? (waitTop ? ['Paid; top-up waits for the university', 'p-mute'] : ['Paid', 'p-good']) : due === 0 ? (ent > 0 ? ['Waiting for university payment', 'p-mute'] : ['Nothing due', 'p-mute']) : paid ? ['Top-up ready for payout', 'p-warn'] : ['Ready for payout', 'p-warn'];
      const t = [].concat(l.annuity ? [tr[0], { h: 'After the first year', t: r.annWhy + ' (Commission after year 1 does not count toward the RP’s tier or milestones: each student counts once.)' }] : tr);
      t.push({ h: 'GSP’s line', t: 'GSP’s ' + l.label + ' from ' + r.u.name + ': ' + money(l.fullEnt, cur) + ' (before GST' + (l.topups.length ? ', including top-ups' : '') + '). ' + (l.fullEnt === 0 ? 'Nothing: ' + (l.cancelled ? 'not payable after the withdrawal.' : 'the university took it back.') : 'The RP’s share is ' + (lp == null ? '—' : lp + '%') + ': ' + money(l.fullEnt, cur) + ' × ' + (lp == null ? '—' : lp) + '% = ' + money(ent, cur) + '.'), ref: 'RP1' });
      if (ov) t.push({ h: 'Override', t: 'Overridden by ' + (ov.by || 'Finance') + (ov.at ? ' on ' + nice(String(ov.at).slice(0, 10)) : '') + ' to ' + money(+ov.amt, cur) + '.' });
      t.push({ h: 'Received by GSP', t: 'GSP has received ' + money(got, cur) + ' of ' + money(l.fullEnt, cur) + ' from the university for this period. ' + (l.fullEnt === 0 ? '' : got <= 0 ? 'Nothing is payable to the RP until it does: the RP is paid only after GSP receives the money.' : waitTop ? 'So the RP is due its share of what GSP has received: ' + money(got, cur) + ' × ' + lp + '% = ' + money(earned, cur) + '. The rest (' + money(r2(ent - earned), cur) + ') waits for the university’s top-up: GSP never pays an RP top-up it is not claiming.' : 'Received in full, so the RP’s whole share is earned.'), ref: l.topups.length ? 'IP2' : null });
      t.push({ h: 'Due now', t: 'Earned ' + money(earned, cur) + ' − already paid to the RP ' + money(paid, cur) + ' = ' + money(due, cur) + '.' + (due < 0 ? ' This is netted against the RP’s next payouts; the credit stays on this student’s line.' : '') });
      line.trace = t;
      if (due < 0 && a.withdrawn && addDays(a.withdrawn.date, +S.legalDays || 90) < today) exc(a, 'Send to Legal', 'Clawback of ' + money(-due, cur) + ' not recovered within ' + (S.legalDays || 90) + ' days of withdrawal. Forward to Legal.');
      out.rp.push(line);
    });
    const n = r.notice && r.notice.pct;
    if (n && n.kind === 'flatfixed' && n.fixed && !r.lead) {
      const key = 'fx1'; const paid = (a.paidRP && a.paidRP[key]) || 0; const anyPaid = r.lines.some((l) => l.paid); const ent = r.counts ? +n.fixed : 0; const due = r2(ent - paid);
      out.rp.push({ key, app: a.id, a, r, ip: null, cur: n.fixedCur || 'AUD', ent, paid, due, kind: 'fixed', label: n.id + ' fixed amount per enrolment', payable: due !== 0 && anyPaid, st: due === 0 && paid ? ['Paid', 'p-good'] : !anyPaid ? ['Waiting for university payment', 'p-mute'] : ['Ready for payout', 'p-warn'], trace: tr.concat([{ h: 'Fixed amount', t: 'The notice pays a fixed ' + money(+n.fixed, n.fixedCur || 'AUD') + ' per enrolment once GSP receives the commission. Fixed AUD amounts are paid in AUD.' }]) });
    }
    /* promotional commission as a % of the tuition fee (RP7) */
    if (!r.lead) (r.notice ? r.notice.tp : []).forEach((N) => {
      const key = 'tp-' + N.id; const paid = (a.paidRP && a.paidRP[key]) || 0; const fee = +a.tuition || 0; const full = r2((fee * +N.flat) / 100);
      const ent = r.nothingEarned ? 0 : full; const earned = r.counts ? ent : r.nothingEarned ? 0 : 0; const due = r2(earned - paid);
      const gspTot = r2(r.lines.filter((l) => !l.bonus && !l.topup).reduce((s, l) => s + (l.fullEnt || 0), 0));
      if (full > gspTot) exc(a, 'Promotion costs more than GSP earns', N.id + ' pays ' + rp.name + ' ' + money(full, cur) + ' (' + N.flat + '% of tuition) on top of its share, more than GSP’s own ' + money(gspTot, cur) + ' for this student. Confirm with the approver.', 'warn');
      out.rp.push({ key, app: a.id, a, r, ip: null, cur, ent, earned, paid, due, kind: 'tuition', label: N.id + ' promotional commission: ' + N.flat + '% of the tuition fee', payable: due !== 0 && (due < 0 || earned > 0), st: due < 0 ? ['To recover from RP', 'p-bad'] : due === 0 && paid ? ['Paid', 'p-good'] : !r.counts ? ['Waiting for university payment', 'p-mute'] : ['Ready for payout', 'p-warn'],
        trace: [tr[0], ntTxt, { h: 'Promotion on tuition', t: N.id + ' ' + N.name + ': ' + N.flat + '% of the student’s final tuition fee (first year), ' + money(fee, cur) + ' × ' + N.flat + '% = ' + money(full, cur) + '. ' + (N.combine === 'box' ? 'It replaces the RP’s share of GSP’s commission.' : 'It is paid on top of the RP’s share of GSP’s commission.') + ' Paid once GSP has received the university’s commission for this student' + (r.counts ? ' (received ' + nice(r.received) + ').' : '; not yet.') + (full > gspTot ? ' It is more than GSP’s own ' + money(gspTot, cur) + ' for this student: flagged for the approver.' : ''), ref: 'RP7' }, { h: 'Due now', t: 'Earned ' + money(earned, cur) + ' − paid ' + money(paid, cur) + ' = ' + money(due, cur) + '.' }].filter(Boolean) });
    });
  });
  /* a tuition-% notice in a box replaces the RP's share: drop those % lines */
  out.rp = out.rp.filter((x) => !(x.kind === 'pct' && x.r.notice && x.r.notice.tp.some((N) => N.combine === 'box') && !x.r.lead));
  /* milestones: lump sums once GSP has been paid for N enrolments under the notice */
  notices.filter((n) => n.kind === 'milestone').forEach((n) => {
    const byRp = {};
    A.forEach((a) => { const r = base[a.id]; if (!r.rp || !a.enrolled || !r.notice || !r.notice.ms.some((m) => m.id === n.id)) return; (byRp[r.rp.id] = byRp[r.rp.id] || []).push(a); });
    Object.entries(byRp).forEach(([rid, list]) => {
      const got = list.filter((a) => base[a.id].counts).sort((x, y) => ((base[x.id].received + x.id) < (base[y.id].received + y.id) ? -1 : 1));
      (n.milestones || []).forEach(([th, amt]) => {
        if (got.length < th) { base[list[0].id].msProgress = (base[list[0].id].msProgress || []).concat([{ n, th, have: got.length, amt }]); return; }
        const a = got[th - 1], key = 'ms-' + n.id + '-' + th, paid = (a.paidRP && a.paidRP[key]) || 0, due = r2(amt - paid);
        const why = ['Notice ' + n.id + ' ' + n.name + ': ' + (n.milestones || []).map((m) => m[0] + ' enrolments → ' + (n.fixedCur || 'AUD') + ' ' + m[1]).join('; ') + '.', 'GSP has now been paid by the university for ' + got.length + ' enrolments under the notice; enrolment ' + th + ' was this student (received ' + nice(base[a.id].received) + ').', 'The bonus is due once commission is received, even after the notice has ended. It is a lump sum and is not split per student.'];
        out.rp.push({ key, app: a.id, a, r: base[a.id], ip: null, cur: n.fixedCur || 'AUD', ent: +amt, paid, due, kind: 'milestone', label: n.id + ' milestone: ' + th + ' paid enrolments', payable: due !== 0, st: due === 0 ? ['Paid', 'p-good'] : ['Ready for payout', 'p-warn'], why, trace: why.map((t, i) => ({ h: ['Milestone notice', 'Count', 'When it is due'][i], t })) });
      });
    });
  });
  /* S2-11: an RP with no active agreement (none accepted yet) is held; a new version waiting holds nothing */
  out.rp.forEach((x) => {
    const rp = x.r.payee || x.r.rp;
    if (!rp || !rp.agreementHeld || !x.payable) return;
    x.payable = false; x.held = 'No active RP agreement';
    x.st = ['Held: no active RP agreement', 'p-bad', ''];
    x.trace = (x.trace || []).concat([{ h: 'Held', t: rp.name + ' has no active agreement yet: commission is held until its signed agreement is accepted, then paid.', ref: 'S2-11' }]);
  });
  /* GST, withholding and AUD views on RP lines */
  out.rp.forEach((x) => {
    const rp = x.r.payee || x.r.rp; x.gstPct = rp && rp.gst ? +S.rpGst || 0 : 0; x.whtPct = rp && S.wht && S.wht[rp.region] ? +S.wht[rp.region] : 0;
    const fx = fxRate(cfg, x.cur, today); x.audEnt = x.ent == null || fx == null ? null : r2(x.ent * fx); x.audDue = x.due == null || fx == null ? null : r2(x.due * fx);
    x.trace = x.trace || [];
    if (x.gstPct) x.trace.push({ h: 'GST', t: 'The RP is GST-registered: ' + x.gstPct + '% GST is added at payout.' });
    if (x.whtPct) x.trace.push({ h: 'Withholding', t: x.whtPct + '% tax is withheld at payout (' + rp.region + ').' });
    const pc = x.kind !== 'pct' && x.kind !== 'tuition' && x.cur === 'AUD' ? 'AUD' : (rp && rp.cur) || 'AUD';
    const run = thursdayOf(today, cfg); const f1 = fxRate(cfg, x.cur, run), f2 = fxRate(cfg, pc, run);
    x.trace.push({ h: 'Payout currency', t: 'Paid in ' + pc + ' in the run on ' + nice(run) + '. All conversion goes through AUD with the week’s rates (AUD per unit): ' + (x.due == null ? '—' : f1 == null || f2 == null ? 'no rate for ' + [f1 == null ? x.cur : null, f2 == null ? pc : null].filter(Boolean).join(' and ') + ' that week, so the run is held.' : money(x.due, x.cur) + (x.cur === 'AUD' ? '' : ' × ' + f1 + ' = ' + money(r2(x.due * f1), 'AUD')) + (pc === 'AUD' ? '.' : ' ÷ ' + f2 + ' = ' + money(r2(r2(x.due * f1) / f2), pc) + '.')), ref: 'IP18' });
  });
  return out;
}

/* the steps as plain strings (for pages that show a list of sentences) */
const traceText = (trace) => (trace || []).filter(Boolean).map((s) => s.h + ': ' + s.t + (s.ref ? ' [' + s.ref + ']' : ''));

/* payout run for the pay day of a date's week (Finance setup's pay day) */
function buildRun(cfg, res, date) {
  const run = { date: thursdayOf(date, cfg), payees: {}, hold: [], lines: [] };
  res.rp.filter((x) => x.payable).forEach((x) => {
    const payee = x.r.payee || x.r.rp; const fixedAud = x.kind !== 'pct' && x.kind !== 'tuition' && x.cur === 'AUD'; const payCur = fixedAud ? 'AUD' : payee.cur || 'AUD';
    const f1 = fxRate(cfg, x.cur, run.date), f2 = fxRate(cfg, payCur, run.date);
    if (f1 == null) run.hold.push(x.cur); if (f2 == null) run.hold.push(payCur);
    const aud = f1 == null ? null : r2(x.due * f1); const pay = aud == null || f2 == null ? null : r2(aud / f2);
    const L = { app: x.app, key: x.key, label: x.label, student: x.a.student, srcCur: x.cur, src: x.due, f1, aud, f2, payCur, pay, gst: r2(((pay || 0) * x.gstPct) / 100), wht: r2(((pay || 0) * x.whtPct) / 100), payee: payee.id };
    run.lines.push(L);
    const p = (run.payees[payee.id] = run.payees[payee.id] || { id: payee.id, name: payee.name, bank: payee.bank || 'AU', byCur: {}, lines: [] }); p.lines.push(L);
    const c = (p.byCur[payCur] = p.byCur[payCur] || { net: 0, gst: 0, wht: 0 }); c.net = r2(c.net + (pay || 0)); c.gst = r2(c.gst + L.gst); c.wht = r2(c.wht + L.wht);
  });
  run.hold = [...new Set(run.hold)];
  Object.values(run.payees).forEach((p) => { p.total = {}; Object.entries(p.byCur).forEach(([c, v]) => { p.total[c] = r2(v.net + v.gst - v.wht); }); p.carry = Object.values(p.total).some((v) => v < 0); });
  return run;
}

/*
 * The RP's estimate before enrolment (agency side): the same engine, run on the application as if it enrolled on
 * its intake, with the RP's other enrolments as they stand. Returns GSP's first-year commission, the RP's share and
 * its rate, in the university's currency.
 */
function estimateFor(cfg, apps, app, today) {
  const a = Object.assign({}, app, { enrolled: app.enrolled || app.intake });
  const res = compute(cfg, Object.assign({}, apps, { [a.id]: a }), today);
  const r = res.apps[a.id]; if (!r || !r.u) return null;
  const gsp = r2(r.lines.filter((l) => !l.annuity && !l.bonus && !l.topup).reduce((s, l) => s + (l.fullEnt || 0), 0));
  const rp = r2(res.rp.filter((x) => x.app === a.id && !x.annuity).reduce((s, x) => s + (x.ent || 0), 0));
  return { cur: r.u.cur, gsp, rp, pct: r.rpPct, est: true, res, r };
}

export { compute, buildRun, estimateFor, thursdayOf, payDayFor, addDays, addMonths, fxRate, fxWeek, windowKey, windowEnd, nice, money, r2, LEVELS, TRIG, DEST, PAY, PAYNAME, CHARGENAME, DEF_REGION_GROUPS, bandTxt, winName, winLabel, DEFYEARS, traceText, regionCovers, pickRate, rateRows, rowLabel, termsAt, monthName };
