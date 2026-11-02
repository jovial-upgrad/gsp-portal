// @ts-nocheck -- uses the ported commission engine; typed with the finance API.
/**
 * Finance's applications are the data set's (Jovial, 31 Oct): every enrolled application any portal shows, with
 * the university and the RP found by id (data/dataset.ts). What has been invoiced and paid follows the dates:
 * a line is invoiced when its trigger date passes, the university pays after its payment days, and the RP is
 * paid on the first payout day a week after that. A few applications are held back to show Finance's exceptions.
 * Finance's terms gain sample terms for catalogue universities with no contract loaded, and RP terms rows for RPs
 * with none (Finance's default applies to those).
 */
import DATASET from '../data/dataset.json';
import { sampleApplications, courseOf, startOf, censusOf } from '../data/applications';
import { sampleStudents } from '../data/students';
import { UNI_TERMS, rpByName, dataApp } from '../data/dataset';
import { compute, thursdayOf } from './engine';
import { settingsOf } from './defaults';
import { withLive, finalFeeOf } from '../data/live';
import { getDb } from '../institution/data/store';
import { agreementOf, statusNow } from '../institution/data/records';
import { activeAgreement, commissionHeld } from '../institution/data/agreements';

/**
 * One source for each university's agreement and territory (W8, 1 Nov): the Institution Team's records. Finance's
 * terms take the agreement's end date from the university's Institution partner (the New agreement or Renewal that
 * ends last) and its territory from the university's record, so Finance and Institution never disagree (CQU,
 * Adelaide, Deakin). Finance's own rates and payment terms stay Finance's.
 */
export function withInstitution(cfg) {
  const db = getDb();
  const ips = new Map(db.ips.map((p) => [p.id, p]));
  for (const u of db.unis) {
    const fid = UNI_TERMS[u.id];
    const fu = fid && cfg.unis.find((x) => x.id === fid);
    if (!fu) continue;
    const p = ips.get(u.ip);
    const a = p ? agreementOf(p) : null;
    const t = u.territory;
    const terr = t.mode === 'only' ? `${t.countries.join(', ')} only` : t.mode === 'except' ? `All countries but ${t.countries.join(', ')}` : t.blocked.length ? 'All countries' : 'All countries';
    fu.ends = a?.end ?? '';
    fu.agreement = { partner: p?.name ?? '', status: p ? statusNow(p) : '', start: a?.start ?? '', end: a?.end ?? '' };
    fu.territory = terr + (t.blocked.length ? `, not ${t.blocked.map((b) => `${b.state} (${b.country})`).join(', ')}` : '');
    // the open points that came from the terms sheet's own dates and territory are the records' now
    if (/^Territory:|Contract end date has passed/.test(fu.flag || '')) fu.flag = a && a.end < new Date().toISOString().slice(0, 10) ? 'Agreement ended: renewal needed (Institution partner record)' : '';
  }
  // the RP's own agreement (S2-11; Jovial, 2 Nov): commission is held while it has no active agreement. A new version
  // waiting for its signature holds nothing: the active one still applies.
  for (const fr of cfg.rps) {
    const rec = db.rps.find((x) => x.id === (fr.id === 'R-TEST' ? 'rp-test' : `rp-${String(fr.id).toLowerCase()}`));
    if (!rec) { delete fr.agreementHeld; continue; }
    const act = activeAgreement(rec);
    fr.rpAgreement = act ? { version: act.version, from: act.effectiveFrom } : null;
    if (commissionHeld(rec)) fr.agreementHeld = true;
    else delete fr.agreementHeld;
  }
  return cfg;
}

const LEVEL = { 'Master’s degree': 'PG', 'Postgraduate diploma': 'PG', 'PhD or research': 'RES', 'Bachelor’s degree': 'UG', Diploma: 'DIP', Foundation: 'FDN' };
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => iso(Date.parse(d + 'T00:00:00Z') + n * 864e5);

/** Finance's terms with every university and RP the data set uses. */
export function withDatasetTerms(cfg0) {
  const cfg = structuredClone(cfg0);
  // the payout currency by sales region: Finance setup's one table (HC44)
  const CUR = settingsOf(cfg).payoutCur;
  for (const t of DATASET.sampleTerms) if (!cfg.unis.some((u) => u.id === t.id)) cfg.unis.push(t);
  withInstitution(cfg);
  for (const r of DATASET.rps) {
    const have = cfg.rps.find((x) => x.id === r.id);
    if (have) { have.name = r.name; continue; } // one name per RP, everywhere
    cfg.rps.push({ id: r.id, name: r.name, region: r.region, scheme: '', flat: null, gst: false, cur: CUR[r.region] ?? 'AUD', bank: CUR[r.region] ? 'Local' : 'AU', curFromTable: true, payee: '', sample: false, note: 'No signed RP terms on file yet: Finance’s default applies.', mp: false, annuityPct: null, bankVerified: true });
  }
  return cfg;
}

/** Finance's copy of every enrolled application, priced and paid up to `today`. */
export function datasetFinanceApps(cfg, today) {
  const studs = sampleStudents('');
  const apps = {};
  const pay = {};
  for (const a0 of sampleApplications()) {
    // with any status set elsewhere: an application Mail marked enrolled is Finance's from then
    const a = withLive(a0);
    const d = dataApp(a.id);
    const withdrawn = d && d.withdrawn;
    if (a.status !== 'enrolled' && !withdrawn) continue;
    const c = courseOf(a);
    const st = studs.find((x) => x.id === a.studentId);
    const rp = a.rp ? rpByName(a.rp) : null;
    // the course's start and census: Finance's own record for its enrolments, otherwise the catalogue's intake dates
    const start = (d && d.intakeDate) || iso(startOf(a));
    const census = d && d.intakeDate ? undefined : iso(censusOf(a));
    apps[a.id] = {
      id: a.id, student: st ? `${st.first} ${st.last}` : a.studentId, rp: rp ? rp.id : 'R-TEST', uni: UNI_TERMS[c.uni.id] ?? `none-${c.uni.id}`,
      level: LEVEL[c.level] ?? 'PG', intake: start, ...(census ? { census } : {}), tuition: finalFeeOf(a.id, c.tuition), scholarship: 0, enrolled: start,
      studentType: (d && d.fin && d.fin.studentType) || 'New', nationality: st ? st.nationality : 'India', courseYears: d && d.fin && d.fin.courseYears,
      inv: {}, paidIP: {}, paidRP: {}, gspLead: !!(d && d.fin && d.fin.gspLead), ...(withdrawn ? { withdrawn } : {}),
    };
    pay[a.id] = (d && d.fin && d.fin.pay) || 'auto';
  }
  // invoices and university payments, by date
  let res = compute(cfg, apps, today);
  for (const id of Object.keys(apps)) {
    const x = apps[id];
    const u = cfg.unis.find((y) => y.id === x.uni);
    const r = res.apps[id];
    if (!u || !r) continue;
    const due = r.lines.filter((l) => l.date <= today);
    const latest = due.length ? due[due.length - 1].key : null;
    r.lines.forEach((l, i) => {
      if (l.date > today) return;
      if (pay[id] === 'ready' && l.key === latest) {
        // paid by the university this week: the RP's share goes in the next payout run
        x.inv[l.key] = l.date;
        x.paidIP[l.key] = { date: addDays(today, -3), amt: l.ent };
        return;
      }
      x.inv[l.key] = l.date;
      const paidOn = addDays(l.date, u.payDays || 30);
      const mode = pay[id];
      if (mode === 'overdue' || mode === 'invoiced' || paidOn > today) return;
      x.paidIP[l.key] = { date: paidOn, amt: mode === 'short' && i === 0 ? Math.round(l.ent * 0.8 * 100) / 100 : l.ent };
    });
  }
  // the RP is paid on the first pay day (Finance setup) a week after the university pays, once that day has come (W13)
  res = compute(cfg, apps, today);
  const thursdayAfter = (d) => thursdayOf(d, cfg); // Finance setup's pay day (HC34)
  res.rp.forEach((l) => {
    if (l.ip && l.ip.paid && thursdayAfter(addDays(l.ip.paid.date, 7)) <= today) apps[l.app].paidRP[l.key] = l.ent;
  });
  // W27: a student who withdrew after enrolling, with a refund: the RP had been paid on the payout day before the
  // withdrawal, so that commission is now recovered (the clawback line on the RP's Earnings)
  const gone = Object.values(apps).filter((a) => a.withdrawn && a.withdrawn.refund);
  if (gone.length) {
    const before = compute(cfg, Object.fromEntries(Object.entries(apps).map(([k, a]) => [k, a.withdrawn && a.withdrawn.refund ? { ...a, withdrawn: undefined } : a])), today);
    before.rp.forEach((l) => {
      const a = apps[l.app];
      if (!a.withdrawn || !a.withdrawn.refund || !l.ip || !l.ip.paid) return;
      const paidDay = thursdayAfter(addDays(l.ip.paid.date, 7));
      if (paidDay < a.withdrawn.date && l.ent) a.paidRP[l.key] = l.ent;
    });
  }
  return apps;
}
