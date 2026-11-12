// @ts-nocheck -- the sandbox's plain-JS case shape, translated as tests/unit/scenarios.mjs always did.
/**
 * Commission scenarios (Prototype panel, Jovial 12 Nov): the sandbox's cases (cases.ts, the commissions team's sheet
 * plus the combination cases, every expected value worked out by hand) turned into the prototype's records, so the
 * prototype's own engine works out their lines. Used by the Prototype panel (a case's world loaded into the stores)
 * and by tests/unit/scenarios.mjs (every case's checks against the engine). Prototype only.
 */
import { compute as compute0, settleAll } from '../../finance/commission/engine';
import { sampleComm } from '../../finance/commission/seed';
import { SCENARIOS } from './cases';

export { SCENARIOS };

/** Whole cases the decisions changed. */
export const SKIP = {
  IP18: 'C1: no exchange rates; each line stays in the university’s currency (the case checks AUD conversions)',
  C5: 'C4: no GSP lead 50% in this cut',
  C6: 'C3: no clawback automation; Finance closes a withdrawal after payment by hand with a manual adjustment line (the case recovers paid lines automatically)',
  C7: 'C1/C2: no exchange rates and no payout run (the case pays an RP in INR through a run)',
};
/** Single checks the decisions changed (case id: words in the check's `what`, and why). */
export const SKIP_CHECK = [
  [/./, /payout run|run date|run pays|→ AUD|AUD →|paid in/i, 'C2: no payout run; C1: no exchange rates'],
  [/./, /GST on the RP|RP’s GST|RP invoice tax|withholding/i, 'D8: no RP tax line'],
  [/./, /cap(ped)?|never (more|above) (than )?GSP/i, 'C5: no cap on the RP relative to GSP'],
  [/./, /special lead|lead is not/i, 'C4: no GSP lead 50% in this cut'],
];


/* ---------- the sandbox's words → the prototype's ---------- */
const LEVEL = { UG: 'Bachelor’s degree', PG: 'Master’s degree', RES: 'PhD or research', DIP: 'Diploma', FDN: 'Foundation', VET: 'VET', ELICOS: 'ELICOS', SA: 'Study Abroad' };
const DEFYEARS = { UG: 3, PG: 2, RES: 3, DIP: 1, FDN: 1, VET: 2, ELICOS: 1, SA: 1 };
const COUNTRY = { AU: 'Australia', NZ: 'New Zealand', UK: 'UK', IE: 'Ireland', US: 'USA', CA: 'Canada' };
const TRIGGER = { census: 'Census date', fees: 'Fees paid', withdrawal: 'Withdrawal deadline', enrol: 'Enrolment confirmed' };
const PAY = { year: 'Year', semester: 'Semester', trimester: 'Trimester', term: 'Term', unit: 'Per unit', fees: 'Each fee payment' };
const PER = { year: 1, semester: 2, trimester: 3, term: 4 };
const CHARGE = { course: 'Whole course', year: 'Years', semester: 'Semesters', trimester: 'Trimesters', term: 'Terms', unit: 'Units', fees: 'Fees up to', points: 'Credit points' };
const WINDOW = { CY: 'Calendar year', AY: 'Academic year', FY: 'Financial year', intake: 'Intake' };
const COMBINE = { box: 'Separate box', highest: 'Highest wins', adds: 'Adds on top' };
const PROMO = { highest: 'Highest wins', replace: 'Replaces the rate', additional: 'Additional line' };
const BONUS_PER = { student: 'Per student', threshold: 'At a number', band: 'By count' };
const KIND = (k) => (k === 'pct' ? '%' : 'Amount');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const intakeOf = (d) => `${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const addMonths = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const stamp = { by: 'Scenario', at: 0 };
const file = { name: 'scenario.pdf', size: 1 };
const lvl = (l) => { const x = LEVEL[l]; if (!x) throw new Error(`level ${l}`); return x; };
// only the conditions the case sets: an empty one would read as a condition being added in the forms
const cond = (o) => Object.fromEntries(Object.entries({ from: o.from, to: o.to, intakes: o.intakes, regions: o.regions, courses: o.courses, levels: o.levels?.map(lvl), campuses: o.campuses }).filter(([, v]) => (Array.isArray(v) ? v.length : !!v)));
const bands = (b = []) => b.map(([from, to, pct]) => ({ from, to, pct }));
const scheme = (B) => ({ id: B.id, name: B.name, per: BONUS_PER[B.per ?? 'student'], kind: KIND(B.kind), value: +B.v || 0, threshold: B.threshold ?? null, bands: (B.bands ?? []).map(([from, to, v, k]) => ({ from, to, value: v, kind: KIND(k) })), countedPer: B.window ? WINDOW[B.window] : undefined, retro: B.retro !== false, perCountry: !!B.perCountry, cond: cond(B) });
const tierOf = (t) => (t ? { bands: bands(t.bands), countedPer: WINDOW[t.window ?? 'CY'], yearStart: t.ayStart ?? 1, tierRetro: !!t.retro, tierPerCountry: t.scope === 'country', tierLevels: (t.levels ?? []).map(lvl), bandBonuses: Object.entries(t.bandBonus ?? {}).map(([b, x]) => ({ band: Number(b), kind: KIND(x.kind), value: +x.v })) } : { bands: [], countedPer: 'Calendar year', yearStart: 1, tierRetro: true, tierPerCountry: false, tierLevels: [], bandBonuses: [] });

function termsBody(u) {
  const tier = tierOf(u.tier);
  const charge = u.charge ? { unit: CHARGE[u.charge.unit], n: u.charge.n ?? null } : { unit: 'Years', n: 1 };
  return {
    currency: u.cur,
    rates: Object.fromEntries(Object.entries(u.levels ?? {}).filter(([l]) => LEVEL[l]).map(([l, v]) => [LEVEL[l], v])),
    fixed: Object.fromEntries(Object.entries(u.fixed ?? {}).filter(([l]) => LEVEL[l]).map(([l, v]) => [LEVEL[l], v])),
    feeBasis: u.basis === 'gross' ? 'Tuition before scholarship' : 'Tuition after scholarship',
    rateRows: (u.rates ?? []).map((r) => ({ level: r.level ? lvl(r.level) : undefined, course: r.course, campus: r.campus, region: r.region, period: r.period != null ? String(r.period) : undefined, pct: r.pct ?? null, amt: r.amt ?? null })),
    trigger: TRIGGER[u.trigger ?? 'census'],
    triggerWeeks: u.triggerWeeks ?? null,
    payUnit: u.pay ? PAY[u.pay] : ['Year', 'Semester', 'Trimester', 'Term'][(u.inst ?? 1) - 1],
    charge,
    payDays: u.payDays ?? 30,
    cap: u.cap ?? null,
    ...tier,
    promos: (u.promos ?? []).map((p) => ({ id: p.id, name: p.name, pct: p.pct ?? null, amt: p.amt ?? null, combine: PROMO[p.combine ?? 'highest'], cond: cond(p) })),
    addl: [],
    bonus: (u.bonuses ?? []).map(scheme),
    contract: file,
    notes: '',
  };
}

function world(cfg, apps, today) {
  const base = sampleComm();
  const S = cfg.settings;
  const settings = { ...base.settings, fallbackWeeks: S.fallbackWeeks ?? 4, regionGroups: S.regionGroups ?? {}, gst: { Australia: S.auGst ?? 10 }, annuity: { rule: S.annuityRp === 'flat' ? 'Flat %' : S.annuityRp === 'none' ? 'None' : 'Same as year 1', pct: S.annuityPct ?? null } };
  const unis = cfg.unis.map((u) => ({ id: u.id, name: u.name, country: COUNTRY[u.country] ?? u.country, ip: '', agreement: u.starts || u.ends ? { start: u.starts ?? '1900-01-01', end: u.ends ?? '2999-12-31' } : null }));
  const terms = cfg.unis.map((u) => {
    const body = termsBody(u);
    const vs = (u.versions ?? []).slice().sort((a, b) => (a.from < b.from ? -1 : 1));
    if (!vs.length) return { ...body, uni: u.id, created: stamp, updated: stamp, earlier: [] };
    // terms versioned by effective-from: the latest is in force, the earlier ones until the next one's from
    let cur = u;
    const earlier = [];
    for (const v of vs) {
      earlier.push({ ...termsBody(cur), until: v.from });
      cur = { ...cur, ...v.set };
    }
    return { ...termsBody(cur), uni: u.id, created: stamp, updated: stamp, earlier };
  });
  const groups = (cfg.groups ?? []).map((g) => ({ id: g.id, name: g.name, members: g.members, ...tierOf(g.tier), bonus: (g.bonuses ?? []).map(scheme), notes: '', created: stamp, updated: stamp }));
  const agreements = [];
  const records = [];
  for (const r of cfg.rps) {
    const sch = r.scheme && cfg.schemes.find((x) => x.id === r.scheme);
    const id = `ag-${r.id}`;
    agreements.push({ id, name: sch?.name ?? `${r.flat}% flat`, status: 'Active', shareType: sch ? 'Tiered by enrolments' : 'Flat', share: sch ? null : r.flat ?? S.defaultPct, bands: sch ? bands(sch.bands) : [], countedPer: sch ? WINDOW[sch.window ?? 'CY'] : 'Calendar year', retro: sch ? sch.retro === 'yes' : false, retroTop: sch?.retro === 'top', addl: null, bonuses: [], payDays: 30, details: '', doc: null, created: stamp, updated: stamp, earlier: [] });
    // the RP's terms from its first student's intake (the case doesn't date them)
    const firstIntake = Object.values(apps).filter((a) => a.rp === r.id).map((a) => a.intake).sort()[0];
    records.push({ rp: r.id, agreement: id, from: firstIntake ? `${firstIntake.slice(0, 7)}-01` : today, annuityPct: r.annuityPct ?? null, moves: [], created: stamp, updated: stamp });
  }
  const notices = (cfg.notices ?? []).map((n) => ({
    id: n.id, name: n.name, docType: n.doc, doc: file,
    intakes: n.intakes ?? [], starts: n.start ?? '2000-01-01', ends: n.end ?? '2999-12-31',
    dests: (n.dest ?? []).map((d) => COUNTRY[d] ?? d), unis: n.unis ?? [], levels: (n.levels ?? []).map(lvl),
    benefit: n.kind === 'tuitionPct' ? '% of tuition' : n.kind === 'flatfixed' ? 'Share plus amount per enrolment' : n.kind === 'tier' ? 'Tiered share' : n.kind === 'bonus' ? 'Bonus per enrolment' : n.kind === 'milestone' ? 'Milestone' : 'Share',
    amount: n.kind === 'flatfixed' ? +n.fixed : n.kind === 'bonus' ? +n.amt : null,
    share: n.kind === 'flat' || n.kind === 'flatfixed' ? +n.flat : null,
    tuitionPct: n.kind === 'tuitionPct' ? +n.flat : null,
    bands: bands(n.bands), retro: n.retro === 'yes', combine: COMBINE[n.combine ?? 'highest'],
    milestones: (n.milestones ?? []).map(([count, amount]) => ({ count, amount })),
    rps: n.rps ?? [], regions: n.regions ?? (n.region ? [n.region] : []), removed: [], issued: stamp, created: stamp, updated: stamp,
  }));
  const courses = new Map();
  const enrolments = Object.values(apps).map((a) => {
    const u = cfg.unis.find((x) => x.id === a.uni);
    const years = a.courseYears ?? DEFYEARS[a.level] ?? 1;
    const cid = `${a.uni}|${a.level}|${a.course ?? ''}|${years}`;
    courses.set(cid, { id: cid, name: a.course ?? `${a.level} course`, level: lvl(a.level), months: years * 12, currency: u.cur, uni: a.uni });
    const per = PER[u.pay] ?? (u.pay ? 1 : u.inst ?? 1);
    const n = years * per;
    const starts = Array.from({ length: n }, (_, i) => addMonths(a.intake, Math.round((12 / per) * i)));
    const trig = u.trigger ?? 'census';
    const census = trig === 'census' ? (a.periods ? a.periods.map((p) => p.census ?? '') : a.census ? [a.census] : []) : [];
    return {
      app: a.id, student: a.student, nationality: a.nationality, rp: a.rp ?? '', course: cid, intake: intakeOf(a.intake), enrolled: a.enrolled ?? a.intake, withdrawn: a.withdrawn,
      fees: {
        // the sandbox's tuition is the final fee (after the scholarship); the prototype's is before it
        tuition: a.tuition + (a.scholarship ?? 0), scholarship: a.scholarship ?? 0, start: a.intake, census,
        // the sandbox's Fees paid and Enrolment confirmed are on each period's start
        confirmed: trig === 'enrol' ? starts : [], paid: trig === 'fees' ? starts : [],
        yearFees: a.yearFees ? [a.tuition + (a.scholarship ?? 0), ...a.yearFees.slice(1).map((x) => (x == null ? x : x + (a.scholarship ?? 0)))] : undefined, campus: a.campus,
        units: a.units?.map((x) => ({ name: x.name, fee: +x.fee, census: x.census ?? '' })), feePayments: a.feePayments?.map((x) => ({ date: x.date, amount: +x.amt })),
        points: a.pointsPerYear ?? null, studentType: a.studentType,
      },
    };
  });
  const ctx = { unis, rps: cfg.rps.map((r) => ({ id: r.id, name: r.name, code: r.id, country: r.region, region: r.region, status: 'Active' })), course: (id) => courses.get(id), today };
  const state = { ...base, settings, agreements, records, notices, terms, groups, enrolments, invoices: [], receipts: [], requests: [], rpInvoices: [], rpPayments: [], writeOffs: [], overrides: [], lumps: [], confirms: [], closes: [], logs: [], ids: {}, idSeq: 0, frozen: {}, seen: {}, history: [] };
  return { state, ctx };
}

/* ---------- our lines → the sandbox's keys ---------- */
function sandboxKey(t, T, side) {
  const slot = t.key.split('|').slice(2).join('|');
  const per = { Year: 1, Semester: 2, Trimester: 3, Term: 4 }[T?.payUnit] ?? 0;
  const periodKey = (s) => {
    let m;
    if ((m = /^p(\d+)$/.exec(s))) { const k = +m[1], y = per ? Math.ceil(k / per) : 1, p = per ? k - (y - 1) * per : k; return { ip: y === 1 ? `ip${p}` : `an${y}-${p}`, rp: y === 1 ? `${p}` : `Y${y}-${p}` }; }
    if ((m = /^u(\d+)$/.exec(s))) return { ip: `un${m[1]}`, rp: `U${m[1]}` };
    if ((m = /^f(\d+)$/.exec(s))) return { ip: `fp${m[1]}`, rp: `F${m[1]}` };
    if ((m = /^tb:(.+)$/.exec(s))) { const b = periodKey(m[1]); return b && { ip: `tb-${b.ip}`, rp: `${b.rp}-T` }; }
    if ((m = /^pr:(.+):(\d+)$/.exec(s))) return { ip: `ad-${m[1]}-${m[2]}`, rp: `A${m[2]}-${m[1]}` };
    if ((m = /^bn:(.+)$/.exec(s))) return { ip: `bo-${m[1]}` };
    if ((m = /^gb:(.+)$/.exec(s))) return { ip: `gbo-${m[1]}` };
    if ((m = /^bb:group$/.exec(s))) return { ip: 'ipbg' };
    if ((m = /^bb:/.exec(s))) return { ip: 'ipb' };
    return null;
  };
  if (side === 'uni') return periodKey(slot)?.ip ?? slot;
  let m;
  if ((m = /^m:(.+)$/.exec(slot))) { const b = periodKey(m[1]); return b?.rp ? `rp${b.rp}` : slot; }
  if ((m = /^rt:(.+)$/.exec(slot))) { const b = periodKey(m[1]); return b?.rp ? `rp${b.rp}-top` : slot; }
  if ((m = /^tp:(.+)$/.exec(slot))) return `tp-${m[1]}`;
  if ((m = /^ms:(.+):(\d+)$/.exec(slot))) return `ms-${m[1]}-${m[2]}`;
  return slot;
}
const TYPE = { 'Course commission': 'standard', 'Tier bonus': 'tier', Promotion: 'additional', 'Additional commission': 'additional', Bonus: 'bonus', 'Tier top-up': 'topup', Adjustment: 'topup' };
const EXC = { 'Credit points missing': 'Points missing', 'Units missing': 'Units missing', 'Rate missing': 'Rate missing', 'Contract ended': 'Contract ended', 'Agreement not yet in force': 'Agreement not yet in force', 'Rate rows overlap': 'Rate rows overlap', 'Rate row unreadable': 'Rate row unreadable', 'Student type missing': 'Student type missing', 'Promotion costs more than GSP earns': 'Promotion costs more than GSP earns' };

function view(res, state) {
  const T = (uni) => state.terms.find((t) => t.uni === uni);
  const ip = res.txs.filter((t) => t.side === 'uni').map((t) => ({ app: t.app, l: { key: sandboxKey(t, T(t.uni), 'uni'), ent: t.amount, fullEnt: t.amount, amt: t.amount, gst: t.gst ?? 0, date: t.trigger, type: TYPE[t.type], st: [t.status] }, t }));
  // the RP has earned a line once GSP has its money for it (Q50); before that it's 0 earned
  const EARNED = ['Ready to invoice', 'Invoice in review', 'Approved', 'Overdue to pay', 'Sent back', 'Paid'];
  const rp = res.txs.filter((t) => t.side === 'rp').map((t) => {
    const earned = EARNED.includes(t.status) ? t.amount : 0;
    return { app: t.app, key: sandboxKey(t, T(t.uni), 'rp'), ent: t.amount, fullEnt: t.amount, earned, due: t.status === 'Paid' ? 0 : earned, st: [t.status], t };
  });
  // a kept line raised later: the sandbox shows the rise on the line itself (what's still due, and the top-up's status)
  for (const x of rp) {
    const top = rp.find((y) => y.app === x.app && y.key === `${x.key}-top` && y.st[0] !== 'Paid');
    if (top) Object.assign(x, { due: x.due + top.ent, st: top.st });
  }
  const exc = res.exceptions.map((x) => ({ app: x.app, type: EXC[x.type] ?? x.type }));
  // an application's workings: the tier that set its band (the higher of the university's and its group's)
  const winKey = (w) => w.replace(/^(AY|CY|FY) /, '$1').replace('–', '/');
  const apps = Object.fromEntries(
    res.apps.map((a) => {
      const best = [...a.tiers].sort((x, y) => y.pct - x.pct || (x.who === 'group' ? -1 : 1))[0];
      return [a.app, { uniTier: best && { key: winKey(best.window), total: best.total, rank: best.rank, who: best.who === 'group' ? 'group' : 'college', band: best.band } }];
    }),
  );
  return { ip, rp, exc, apps };
}

/** The sandbox's compute(cfg, apps, today), on the prototype's engine: worked out once, then what was invoiced and paid applied. */
function compute(cfg, apps, today) {
  const { state: s0, ctx } = world(cfg, apps, today);
  let s = settleAll(s0, ctx);
  let r = compute0(s, ctx);
  const V = view(r, s);
  const find = (app, key, side) => (side === 'uni' ? V.ip.find((x) => x.app === app && x.l.key === key)?.t : V.rp.find((x) => x.app === app && x.key === key)?.t);
  const invoices = [], receipts = [], requests = [], rpInvoices = [], rpPayments = [];
  for (const a of Object.values(apps)) {
    for (const [key, inv] of Object.entries(a.inv ?? {})) {
      const t = find(a.id, key, 'uni');
      if (!t) continue;
      invoices.push({ number: `INV-${a.id}-${key}`, uni: t.uni, date: inv, txs: [t.id], by: 'Scenario', at: 1 });
      const p = a.paidIP?.[key];
      if (p) receipts.push({ id: `rc-${a.id}-${key}`, uni: t.uni, txs: [t.id], amount: p.amt ?? null, paid: p.amt != null ? { [t.id]: +p.amt } : {}, short: p.amt != null && +p.amt < t.amount - 0.005 ? { [t.id]: 'Part payment' } : {}, date: p.date, by: 'Scenario', at: 2 });
    }
    // the RP was paid after the university paid GSP: on the student's latest university payment, else the case's date
    const rpDay = Object.values(a.paidIP ?? {}).map((p) => p.date).filter((d) => d && d <= today).sort().pop() ?? today;
    for (const [key] of Object.entries(a.paidRP ?? {})) {
      const t = find(a.id, key, 'rp');
      if (!t) continue;
      requests.push({ id: `rq-${t.id}`, rp: t.rp, txs: [t.id], date: rpDay, by: 'Scenario', at: 3 });
      rpInvoices.push({ id: `ri-${t.id}`, rp: t.rp, file, txs: [t.id], by: 'RP', at: 4, state: 'Accepted', decided: { by: 'Scenario', at: 5 } });
      rpPayments.push({ id: `rpp-${t.id}`, rp: t.rp, txs: [t.id], date: rpDay, by: 'Scenario', at: 6 });
    }
  }
  if (invoices.length || requests.length) {
    s = settleAll({ ...s, invoices, receipts, requests, rpInvoices, rpPayments }, ctx);
    // what was paid then: an RP line paid at an earlier band is kept at the amount paid (the case's own history)
    const frozen = { ...s.frozen };
    for (const a of Object.values(apps))
      for (const [key, amt] of Object.entries(a.paidRP ?? {})) {
        const t = find(a.id, key, 'rp');
        if (t && typeof amt === 'number' && frozen[t.id]) frozen[t.id] = { ...frozen[t.id], amount: amt, base: amt };
      }
    s = settleAll({ ...s, frozen }, ctx);
    r = compute0(s, ctx);
  }
  return { view: view(r, s), state: s, ctx };
}

const WORDS = { 'Ready for payout': 'Ready to invoice', 'Waiting for university payment': 'Waiting for university', 'Top-up ready for payout': 'Ready to invoice', 'Held: agreement not yet in force': 'Held', 'Held: contract ended': 'Held' };
const same0 = (e, g) => (typeof e === 'number' && typeof g === 'number' ? Math.abs(e - g) < 0.005 : JSON.stringify(e) === JSON.stringify(g));
const same = (e, g) => same0(typeof e === 'string' && WORDS[e] ? WORDS[e] : e, g);

/** A case's world on a day: the prototype's records for it (what was invoiced and paid applied) and the context. */
export function caseWorld(c, today = c.today) {
  return compute(c.cfg, c.apps, today);
}

/** Why a whole case is skipped (a 10 Nov decision changed its rule), or ''. */
export const skipOf = (c) => SKIP[c.id] ?? '';

/** A case's checks against the engine: each check's expected value (by hand) and what the engine gives. */
export function runChecks(c) {
  if (SKIP[c.id]) return { skipped: SKIP[c.id], checks: [] };
  const res = {};
  for (const d of [...new Set([c.today, ...c.checks.map((k) => k.today).filter(Boolean)])]) res[d] = compute(c.cfg, c.apps, d).view;
  const checks = c.checks.map((k) => {
    const why = SKIP_CHECK.find(([cid, w]) => cid.test(c.id) && w.test(k.what));
    if (why) return { what: k.what, exp: k.exp, skip: why[2] };
    let got;
    try {
      got = k.got(res[k.today || c.today], { buildRun: () => { throw new Error('no payout run'); }, cfg: c.cfg, today: k.today || c.today });
    } catch (e) {
      got = `error: ${e.message}`;
    }
    return { what: k.what, exp: k.exp, got, ok: same(k.exp, got), calc: k.calc, today: k.today };
  });
  return { skipped: '', checks };
}
