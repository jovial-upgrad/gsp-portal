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
import { compute } from './engine';
import { withLive } from '../data/live';

const LEVEL = { 'Master’s degree': 'PG', 'Postgraduate diploma': 'PG', 'PhD or research': 'RES', 'Bachelor’s degree': 'UG', Diploma: 'DIP', Foundation: 'FDN' };
const CUR = { India: 'INR', Bangladesh: 'BDT', Nepal: 'NPR', 'Sri Lanka': 'LKR' };
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => iso(Date.parse(d + 'T00:00:00Z') + n * 864e5);

/** Finance's terms with every university and RP the data set uses. */
export function withDatasetTerms(cfg0) {
  const cfg = structuredClone(cfg0);
  for (const t of DATASET.sampleTerms) if (!cfg.unis.some((u) => u.id === t.id)) cfg.unis.push(t);
  for (const r of DATASET.rps) {
    const have = cfg.rps.find((x) => x.id === r.id);
    if (have) { have.name = r.name; continue; } // one name per RP, everywhere
    cfg.rps.push({ id: r.id, name: r.name, region: r.region, scheme: '', flat: null, gst: false, cur: CUR[r.region] ?? 'AUD', bank: CUR[r.region] ? 'Local' : 'AU', payee: '', sample: false, note: 'No signed RP terms on file yet: Finance’s default applies.', mp: false, annuityPct: null, bankVerified: true });
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
      level: LEVEL[c.level] ?? 'PG', intake: start, ...(census ? { census } : {}), tuition: c.tuition, scholarship: c.scholarship, enrolled: start,
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
  // the RP is paid on the first payout day a week after the university pays
  res = compute(cfg, apps, today);
  res.rp.forEach((l) => {
    if (l.ip && l.ip.paid && addDays(l.ip.paid.date, 14) <= today) apps[l.app].paidRP[l.key] = l.ent;
  });
  return apps;
}
