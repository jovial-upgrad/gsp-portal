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
import { NATIONALITY, REGION_BDM, route, type RoutingRp } from '../admin/data/config';
import { adminCfg } from '../admin/data/store';
import { getDb } from '../institution/data/store';
import { RPS, rpByName } from './dataset';
import { STAFF } from './staff';

/** The catalogue's short names for some countries, as the nationality map names them. */
const ALIAS: Record<string, string> = { UK: 'United Kingdom', USA: 'United States' };
/**
 * Country to sales region (HC42, 1 Nov): Admin's nationality map (Admin › Sales regions), as it is now, with the
 * catalogue's short names (UK, USA) read as the map's. Anything not in it is Rest of world.
 */
export const COUNTRY_REGION: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, k) => (typeof k === 'string' ? NATIONALITY[ALIAS[k] ?? k] : undefined),
  has: (_, k) => typeof k === 'string' && (ALIAS[k] ?? k) in NATIONALITY,
  ownKeys: () => Reflect.ownKeys(NATIONALITY),
  getOwnPropertyDescriptor: (_, k) => (typeof k === 'string' && k in NATIONALITY ? { value: NATIONALITY[k], enumerable: true, configurable: true, writable: false } : undefined),
});
export const regionOfCountry = (country: string) => COUNTRY_REGION[country] ?? 'Rest of world';

/**
 * Every recruitment partner as the routing rules see it (HC49, 1 Nov): the RP records (GSP · Institution ›
 * Recruitment partners, with every RP an application is with), each with its sales region (a regional list wins,
 * then its head office's country), whether it has a branch in Australia, and its BDM.
 */
let rpCache: { key: unknown[]; list: RoutingRp[] } | null = null;
export function routingRps(): RoutingRp[] {
  let recs: { name: string; country: string; bdm: string }[] = [];
  let lists: unknown = null;
  try {
    recs = getDb().rps;
    lists = adminCfg().lists;
  } catch {
    recs = [];
  }
  if (rpCache && rpCache.key[0] === recs && rpCache.key[1] === lists) return rpCache.list;
  const seen = new Set<string>();
  const out: RoutingRp[] = [];
  for (const r of recs) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    const data = rpByName(r.name) ?? rpByName(`Sample: ${r.name}`);
    const region = rpRegion(r.name, data?.region ?? regionOfCountry(r.country));
    out.push({ name: r.name, region, auBranch: r.country === 'Australia', bdm: r.bdm || REGION_BDM[region] || '' });
  }
  for (const d of RPS) if (!seen.has(d.name) && !seen.has(d.name.replace(/^Sample: /, ''))) out.push({ name: d.name, region: rpRegion(d.name, d.region), auBranch: d.region === 'Australia', bdm: REGION_BDM[d.region] ?? '' });
  out.sort((a, b) => a.name.localeCompare(b.name));
  rpCache = { key: [recs, lists], list: out };
  return out;
}

/** The signed-in sample agency: head office in Bengaluru, a branch in Mumbai, both India. */
export const TEST_AGENCY = { name: 'GSP test agency', country: 'India', branches: [{ name: 'Bengaluru head office', country: 'India' }, { name: 'Mumbai', country: 'India' }] };

/** An RP's sales region: a regional list wins, then its head office's country. */
export function rpRegion(rp?: string, own?: string) {
  if (!rp || rp === TEST_AGENCY.name) return regionOfCountry(TEST_AGENCY.country);
  let lists: Record<string, string[]> = {};
  try {
    lists = adminCfg().lists;
  } catch {
    /* Admin not loaded */
  }
  const listed = Object.entries(lists).find(([, l]) => l.includes(rp))?.[0];
  return listed ?? own ?? rpByName(rp)?.region ?? 'Rest of world';
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
  // the RP from its record (HC49); the sample agency, which has no record there, from its head office
  const rec = routingRps().find((x) => x.name === rp);
  const region = rec?.region ?? rpRegion(rp);
  const r = route(cfg.rules, cfg.lists, { rp, nationality: p.nationality, now: p.livesIn, dest: p.dest === 'UK' ? 'United Kingdom' : p.dest, rpInfo: rec ?? { name: rp, region, auBranch: false, bdm: cfg.regionBdm[region] ?? REGION_BDM[region] ?? '' } }, cfg.regionBdm, cfg.nationality);
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
