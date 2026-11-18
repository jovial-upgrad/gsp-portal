/**
 * Targets (Jovial, 18 Nov): what the business aims for, by BDM, sales region, destination, university or IP, per
 * month or quarter of the course start, for each stage (applications, submitted, offers, deposits, CoE/CAS,
 * enrolments) and revenue. The business shares them as a table; Admin uploads it as a CSV into a named version
 * (AOP, SL Offsite, a revision …); one version is current, and the dashboards compare with it.
 */
import { DESTINATIONS, UNIVERSITIES } from '../data/courses';
import type { Reporting } from './data';
import { peopleOf } from '../admin/data/config';

/** Who a target is for. */
/** Jovial, 18 Nov: Company is the business's own target; BDM is the application BDM. */
/** Jovial, 18 Nov: no IP level (no dashboard compares against it). */
export const TARGET_LEVELS = ['Company', 'Sales region', 'BDM', 'Destination', 'University'] as const;
export type TargetLevel = (typeof TARGET_LEVELS)[number];
/** What a target counts: a milestone of the dashboards (by its key), or revenue in AUD. */
export const TARGET_METRICS: { col: string; key: string }[] = [
  { col: 'Applications', key: 'received' },
  { col: 'Submitted', key: 'submitted' },
  { col: 'Offers', key: 'offer' },
  { col: 'Deposits', key: 'deposit' },
  { col: 'CoE/CAS', key: 'enroldoc' },
  { col: 'Enrolments', key: 'enrolled' },
  { col: 'Revenue (AUD)', key: 'revenue' },
];
/** The financial year's quarters (April to March), as the business names them. */
export const QUARTERS: [string, number[]][] = [
  ['AMJ', [4, 5, 6]],
  ['JAS', [7, 8, 9]],
  ['OND', [10, 11, 12]],
  ['JFM', [1, 2, 3]],
];

export type TargetRow = { level: TargetLevel; name: string; period: string; months: string[]; values: Record<string, number> };
export type TargetVersion = { id: string; name: string; current: boolean; by: string; at: string; rows: TargetRow[] };

/** A period as the file gives it: a month (2027-02 or Feb 2027) or a quarter (OND 26, JFM'27). */
export function readPeriod(raw: string): { label: string; months: string[] } | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { label: `${m[1]}-${m[2].padStart(2, '0')}`, months: [`${m[1]}-${m[2].padStart(2, '0')}`] };
  m = s.match(/^([A-Za-z]{3})[\s-]+(\d{4})$/);
  if (m) {
    const k = new Date(`${m[1]} 1, ${m[2]}`).getMonth();
    if (!isNaN(k)) return { label: `${m[2]}-${String(k + 1).padStart(2, '0')}`, months: [`${m[2]}-${String(k + 1).padStart(2, '0')}`] };
  }
  m = s.match(/^([A-Za-z]{3})\s*['’ ]?\s*(\d{2})$/);
  if (m) {
    const q = QUARTERS.find(([k]) => k === m![1].toUpperCase());
    if (q) {
      const yy = 2000 + +m[2];
      return { label: `${q[0]} '${m[2]}`, months: q[1].map((mo) => `${yy}-${String(mo).padStart(2, '0')}`) };
    }
  }
  return null;
}

/** One CSV line's cells (quoted cells may hold commas). */
const split = (l: string) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()).slice(0, -1);

/** The names each level accepts, from the records. */
export function namesFor(d: Reporting, company: string): Record<TargetLevel, string[]> {
  return {
    Company: [company],
    // the people in the sales regions' Recruitment queues (and the queues under them)
    BDM: [...new Set(d.regions.flatMap((r) => {
      const q = d.queues.find((x) => x.id === r.recruitment);
      return q ? peopleOf(q, d.queues).map((id) => d.users.find((u) => u.id === id)?.name ?? '') : [];
    }))].filter(Boolean),
    'Sales region': d.regions.map((r) => r.name),
    Destination: [...DESTINATIONS],
    University: UNIVERSITIES.map((u) => u.name),
  };
}

export type ReadRow = { line: number; row?: TargetRow; error?: string };
/**
 * Reads a targets CSV: columns Level, Name, Period, then one per metric (Applications … Revenue (AUD)); found by
 * their headings, in any order; a metric left out or empty has no target. Each line is checked against the records.
 */
export function readTargets(text: string, names: Record<TargetLevel, string[]>): { rows: ReadRow[]; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: 'The file has no rows.' };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const col = (w: string) => head.findIndex((h) => h === w.toLowerCase());
  const cLevel = col('Level'), cName = col('Name'), cPeriod = col('Period');
  if (cLevel < 0 || cName < 0 || cPeriod < 0) return { rows: [], error: 'The file needs Level, Name and Period columns.' };
  const cMetric = TARGET_METRICS.map((m) => [m, col(m.col)] as const).filter(([, i]) => i >= 0);
  if (!cMetric.length) return { rows: [], error: `The file needs at least one of: ${TARGET_METRICS.map((m) => m.col).join(', ')}.` };
  const seen = new Set<string>();
  return {
    rows: lines.slice(1).map((l, i) => {
      const c = split(l);
      const line = i + 2;
      const level = TARGET_LEVELS.find((x) => x.toLowerCase() === (c[cLevel] ?? '').toLowerCase());
      if (!level) return { line, error: `Level “${c[cLevel] ?? ''}” isn’t one of ${TARGET_LEVELS.join(', ')}.` };
      const name = names[level].find((x) => x.toLowerCase() === (c[cName] ?? '').toLowerCase());
      if (!name) return { line, error: `No ${level === 'BDM' ? 'BDM' : level.toLowerCase()} called “${c[cName] ?? ''}”.` };
      const p = readPeriod(c[cPeriod] ?? '');
      if (!p) return { line, error: `Period “${c[cPeriod] ?? ''}” can’t be read: use a month (2027-02) or a quarter (OND 26).` };
      const values: Record<string, number> = {};
      for (const [m, idx] of cMetric) {
        const v = (c[idx] ?? '').replace(/,/g, '');
        if (!v) continue;
        if (!/^\d+(\.\d+)?$/.test(v)) return { line, error: `${m.col} “${c[idx]}” isn’t a number.` };
        values[m.key] = +v;
      }
      if (!Object.keys(values).length) return { line };
      const k = `${level}|${name}|${p.label}`;
      if (seen.has(k)) return { line, error: `${name} has ${p.label} twice in the file.` };
      seen.add(k);
      return { line, row: { level, name, period: p.label, months: p.months, values } };
    }),
  };
}

const HEAD = () => ['Level', 'Name', 'Period', ...TARGET_METRICS.map((m) => m.col)];
/**
 * The file Admin downloads to fill in (Jovial, 18 Nov): every level and every name the portal knows, one row per quarter
 * of the financial year (by course start), the target columns empty. Rows left empty are skipped on upload; a month
 * (2027-02) can replace a quarter on any row.
 */
export function templateRows(names?: Record<TargetLevel, string[]>, fy?: number, fyStart = 4) {
  if (!names || !fy) return [HEAD()];
  const quarters = QUARTERS.map(([q, mm]) => `${q} ${String(mm[0] >= fyStart ? fy - 1 : fy).slice(2)}`);
  return [HEAD(), ...TARGET_LEVELS.flatMap((lv) => names[lv].map((n) => [lv, n] as const)).flatMap(([lv, n]) => quarters.map((p) => [lv, n, p, ...TARGET_METRICS.map(() => '')]))];
}
/** A version as a CSV, to download or send round. */
export const versionRows = (v: TargetVersion) => [
  HEAD(),
  ...v.rows.map((r) => [r.level, r.name, r.period, ...TARGET_METRICS.map((m) => r.values[m.key] ?? '')]),
];

/** A version's target for someone over some course-start months (a quarter's, summed; a month's share of a quarter isn't guessed). */
export function targetFor(v: TargetVersion | undefined, level: TargetLevel, name: string, key: string, months?: string[]) {
  if (!v) return null;
  const rows = v.rows.filter((r) => r.level === level && r.name === name && r.values[key] !== undefined && (!months || r.months.every((m) => months.includes(m))));
  return rows.length ? rows.reduce((t, r) => t + r.values[key], 0) : null;
}

/** The seeded versions (sample records, as the business might share them). */
const AOP = `Level,Name,Period,Applications,Submitted,Offers,Deposits,CoE/CAS,Enrolments,Revenue (AUD)
Company,{company},OND 26,4200,2700,1850,600,520,400,1600000
Company,{company},JFM 27,5600,3600,2450,800,700,530,2120000
Sales region,India,OND 26,1800,1100,760,240,210,160,640000
Sales region,India,JFM 27,2400,1500,1050,330,290,220,880000
Sales region,Bangladesh,OND 26,700,450,320,110,95,70,290000
Sales region,Bangladesh,JFM 27,1100,700,500,170,150,110,450000
Sales region,Nepal,OND 26,300,190,130,45,40,30,120000
Sales region,Vietnam,JFM 27,280,180,120,40,35,26,105000
BDM,Harsh,OND 26,420,260,180,60,52,40,160000
BDM,Ramandeep Kaur,OND 26,380,240,160,55,48,36,145000
BDM,Riya Shah,OND 26,240,150,100,34,30,22,88000
BDM,Balkaran Singh,OND 26,160,100,70,24,20,15,60000
BDM,Gaurav Hans,OND 26,140,90,60,20,18,13,52000
BDM,Mohd Sohail,OND 26,140,90,60,20,18,13,52000
BDM,Nadia,OND 26,260,160,110,38,33,25,100000
BDM,Aditya Rao,OND 26,220,140,95,32,28,21,84000
BDM,Moufiz Parmar,OND 26,180,110,75,26,22,17,68000
BDM,Sania,OND 26,700,450,320,110,95,70,290000
Destination,Australia,OND 26,1900,1200,840,270,235,180,760000
Destination,UK,OND 26,1100,700,480,150,130,95,360000
University,Flinders University,OND 26,120,80,60,20,18,14,62000`;
const REVISED = AOP.replace('BDM,Harsh,OND 26,420,260,180,60,52,40,160000', 'BDM,Harsh,OND 26,380,240,160,50,45,34,136000').replace('Sales region,India,OND 26,1800,1100,760,240,210,160,640000', 'Sales region,India,OND 26,1500,950,650,200,175,135,540000');

export function sampleTargets(d: Reporting, company: string): TargetVersion[] {
  const names = namesFor(d, company);
  const ver = (id: string, name: string, current: boolean, at: string, csv: string): TargetVersion => ({ id, name, current, by: 'Jovial Lejo', at, rows: readTargets(csv.split('{company}').join(company), names).rows.flatMap((r) => (r.row ? [r.row] : [])) });
  return [ver('tv-aop', 'AOP FY27', false, '2026-04-02', AOP), ver('tv-30oct', 'Revised 30 Oct', true, '2026-10-30', REVISED)];
}
