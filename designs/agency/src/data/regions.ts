/**
 * Sales regions, locked (Jovial's Sales region rules, 1 Nov).
 *
 * - **One map, country to sales region**, for a student's nationality, an RP's head office and each branch. Admin's
 *   nationality map (Admin › Application routing) plus the destination countries.
 * - **RP:** its head office's country, through the map, unless the RP is on a regional list, which wins.
 * - **RP branch:** its own country, through the map (an Indian RP's Dhaka branch is Bangladesh), with its own BDM.
 * - **Student:** the sales region of the RP branch that added them; a student who came to GSP directly is Direct.
 * - **Application:** the routing rules, run once when it reaches Pre-screening; "the RP" is the branch that created
 *   it. It changes only when the officer changes the RP, the nationality or where the student lives.
 * - **Region isolation** (model D): Admission and Recruitment see their own regions in lists, dashboards and My work;
 *   searching every region is read-only and logged. Everyone else sees every region.
 * In the real build the server sets and enforces these.
 */
import { NATIONALITY, REGION_BDM, ROUTING_RPS, route } from '../admin/data/config';
import { adminCfg } from '../admin/data/store';
import { TEST_RP, rpByName } from './dataset';
import { STAFF } from './staff';

/** Built on first use: Admin's nationality map loads after this module in some import orders. */
let MAP: Record<string, string> | null = null;
const countryRegion = (): Record<string, string> => (MAP ??= {
  ...NATIONALITY,
  Australia: 'Australia',
  'United Kingdom': 'Latin America and Europe',
  UK: 'Latin America and Europe',
  Ireland: 'Latin America and Europe',
  'New Zealand': 'Rest of world',
  USA: 'Rest of world',
});
export const regionOfCountry = (country: string) => countryRegion()[country] ?? 'Rest of world';

/** The signed-in sample agency: head office in Bengaluru, a branch in Mumbai, both India. */
/** The signed-in sample agency, from its one record in the data set (HC13): its name, country and branches. */
export const TEST_AGENCY = {
  get name() { return TEST_RP.name; },
  get country() { return TEST_RP.country ?? ''; },
  get branches() { return TEST_RP.branches ?? []; },
};

/** An RP's sales region: a regional list wins, then its head office's country. */
export function rpRegion(rp?: string) {
  if (!rp || rp === TEST_AGENCY.name) return regionOfCountry(TEST_AGENCY.country);
  let lists: Record<string, string[]> = {};
  try {
    lists = adminCfg().lists;
  } catch {
    /* Admin not loaded */
  }
  const listed = Object.entries(lists).find(([, l]) => l.includes(rp))?.[0];
  return listed ?? ROUTING_RPS.find((r) => r.name === rp)?.region ?? rpByName(rp)?.region ?? 'Rest of world';
}
/** A branch's sales region: its own country, through the map. */
export const branchRegion = (branch: { country: string }) => regionOfCountry(branch.country);

/** A student's sales region: the RP branch that added them, or Direct. */
export function studentRegion(s: { rp?: string; branch?: string; direct?: boolean }) {
  if (s.direct) return 'Direct';
  if (!s.rp || s.rp === TEST_AGENCY.name) {
    const b = TEST_AGENCY.branches.find((x) => x.name === s.branch) ?? TEST_AGENCY.branches[0];
    return branchRegion(b);
  }
  return rpRegion(s.rp);
}

/** An application's sales region, by Admin's routing rules, with the rule that decided it. */
export function routeApplication(p: { rp?: string; nationality: string; livesIn: string; dest: string }) {
  let cfg;
  try {
    cfg = adminCfg();
  } catch {
    return { region: 'Direct', rule: 0, why: 'Routing not loaded' };
  }
  const rp = p.rp ?? TEST_AGENCY.name;
  const region = rpRegion(rp);
  const r = route(cfg.rules, cfg.lists, { rp, nationality: p.nationality, now: p.livesIn, dest: p.dest === 'UK' ? 'United Kingdom' : p.dest, rpInfo: { name: rp, region, auBranch: false, bdm: REGION_BDM[region] ?? '' } });
  return r.hit ? { region: r.hit.region, rule: r.hit.n, why: r.hit.why, title: r.hit.rule.title } : { region: 'Direct', rule: 0, why: 'Nothing matched' };
}

/* ---------- region isolation (Region isolation tab: model D) ---------- */
const ISOLATED = ['Admission', 'Recruitment'];
/** The regions a GSP person works in, or null for every region. */
export function regionsOf(email?: string): string[] | null {
  const s = STAFF.find((x) => x.email === email);
  if (!s || !ISOLATED.includes(s.role) || s.regions.includes('Global')) return null;
  return s.regions;
}
/** Is a record's region one of this person's? Records without a region are everyone's. */
export const inMyRegions = (email: string | undefined, region?: string) => {
  const mine = regionsOf(email);
  return !mine || !region || mine.includes(region);
};
