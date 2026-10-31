/**
 * What GSP Admin configures (Nesil, 30 Oct). Taken from the PM prototype's Super Admin › Settings wherever it has
 * them (sales regions, permissions, queues, BDM assignment, application routing, document rules, the download log);
 * the currency exchange, living costs and filters tables aren't in it, so they're built from the figures this
 * prototype already uses (course search's rates, the course dialog's visa figures, course search's filters).
 * Every change is logged (`log`), and Logs shows them with the download log. Sample data.
 */
import { SALES_REGIONS } from '../../institution/data/announcements';
import { CURRENCY, type Destination } from '../../data/courses';
import { INR_PER } from '../../screens/courses/search';

export type LogEntry = { id: string; at: number; who: string; area: string; text: string; kind: 'change' | 'download'; role?: string; filters?: string; size?: string; format?: string };

/* ---------- sales regions (PM: Settings › Sales regions and Admissions contacts) ---------- */
export type Region = { name: string; contact: string };
/** Countries that make up a region, where it isn't the country itself (PM: salesRegionOf). */
export const REGION_COUNTRIES: Record<string, string[]> = {
  'Indonesia, Malaysia and Thailand': ['Indonesia', 'Malaysia', 'Thailand'],
  'Myanmar and Bhutan': ['Myanmar', 'Bhutan'],
  Africa: ['Nigeria', 'Kenya', 'Ghana', 'Egypt', 'South Africa', 'Uganda', 'Ethiopia', 'Tanzania', 'and 46 more'],
  'Latin America and Europe': ['Brazil', 'Colombia', 'Mexico', 'Peru', 'United Kingdom', 'Germany', 'France', 'Spain', 'and 46 more'],
  'Rest of world': ['Every country not in another region'],
  Direct: ['Students who apply to GSP without a recruitment partner'],
  Global: ['Every region: for GSP people who cover them all'],
};
const CONTACT: Record<string, string> = {
  India: 'Ramish', Nepal: 'Supriya', 'Sri Lanka': 'Subbhodya', Bangladesh: 'Kamrun', Pakistan: 'Kamrun', Africa: 'Kamrun',
  'Latin America and Europe': 'Valentina', Vietnam: 'Truc', 'Indonesia, Malaysia and Thailand': 'Truc', 'Myanmar and Bhutan': 'Truc', Philippines: 'Truc',
  Australia: 'Jo', China: 'Jo',
};
export const sampleRegions = (): Region[] => SALES_REGIONS.map((name) => ({ name, contact: CONTACT[name] ?? '' }));
/** The regions a queue or a routing can point to (not Global, which only GSP people cover). */
export const workRegions = (rs: Region[]) => rs.filter((r) => r.name !== 'Global' && r.name !== 'Direct');

/* ---------- GSP users and their roles (Nesil, 30 Oct: Create roles; people from the PM's samples) ---------- */
/** The roles a GSP user can have (Nesil's list). */
export const GSP_ROLES = ['Admin', 'Recruitment', 'Recruitment Ops', 'Admission', 'Admission Ops', 'Institution', 'Institution Ops', 'Finance'] as const;
export type GspRole = (typeof GSP_ROLES)[number];
/** Not sent: added, no link yet; Link sent: waiting for them to set a password; Active: they've signed in. */
export type UserStatus = 'Not sent' | 'Link sent' | 'Active';
export type User = { id: string; name: string; email: string; dial: string; phone: string; role: GspRole; title: string; region: string; status: UserStatus; sentAt?: number };
const DAY = 86_400_000;
const u = (name: string, role: GspRole, title: string, region: string, dial: string, phone: string, status: UserStatus = 'Active'): User => ({
  id: `u-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  name,
  email: `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@gsp.upgrad.com`,
  dial,
  phone,
  role,
  title,
  region,
  status,
  sentAt: status === 'Link sent' ? Date.now() - 2 * DAY : undefined,
});
export const sampleUsers = (): User[] => [
  u('Ishaan Verma', 'Admin', 'GSP Admin', 'Global', '+91', '98110 20031'),
  u('Megha Malhotra', 'Admission Ops', 'Admissions Head', 'India', '+91', '98110 40552'),
  u('Ramish', 'Admission', 'Admissions Officer', 'India', '+91', '98450 11872'),
  u('Supriya', 'Admission', 'Admissions Officer', 'Nepal', '+977', '980 114 2290'),
  u('Subbhodya', 'Admission', 'Admissions Officer', 'Sri Lanka', '+94', '77 410 2283'),
  u('Kamrun', 'Admission', 'Admissions Officer', 'Bangladesh', '+880', '1711 409 118'),
  u('Valentina', 'Admission', 'Admissions Officer', 'Latin America and Europe', '+44', '7700 900 412'),
  u('Truc', 'Admission', 'Admissions Officer', 'Vietnam', '+84', '90 812 3341'),
  u('Thi Tuyet Hoa Nguyen', 'Admission', 'Admissions Officer', 'Vietnam', '+84', '90 812 7710', 'Link sent'),
  u('Jo', 'Admission', 'Admissions Officer', 'Australia', '+61', '412 300 118'),
  u('Meera Pillai', 'Admission Ops', 'Admission Ops Lead', 'Global', '+91', '98450 30021'),
  u('Saurabh', 'Recruitment', 'Recruitment Head', 'India', '+91', '98110 77201'),
  u('Nadia', 'Recruitment', 'BDM', 'India', '+91', '98950 22018'),
  u('Harsh', 'Recruitment', 'BDM', 'India', '+91', '98110 41870'),
  u('Aditya Rao', 'Recruitment', 'BDM', 'India', '+91', '98110 40217'),
  u('Sania', 'Recruitment', 'BDM', 'Bangladesh', '+880', '1711 409 552'),
  u('Faisal', 'Recruitment', 'BDM', 'Africa', '+880', '1711 420 019'),
  u('Tina', 'Recruitment', 'BDM', 'Vietnam', '+84', '90 812 0042'),
  u('Arielle', 'Recruitment', 'BDM', 'Philippines', '+63', '917 300 2281'),
  u('Camilo', 'Recruitment', 'BDM', 'Latin America and Europe', '+44', '7700 900 177'),
  u('Kanchani', 'Recruitment', 'BDM', 'Sri Lanka', '+94', '77 410 9921', 'Not sent'),
  u('Anil Shrestha', 'Recruitment', 'BDM', 'Nepal', '+977', '980 114 2271'),
  u('Judy', 'Recruitment', 'BDM', 'Australia', '+61', '412 300 771'),
  u('Leena Thomas', 'Recruitment Ops', 'Partner Verification Lead', 'Global', '+91', '98450 66120'),
  u('Lalaine Dizon', 'Institution', 'Relationship Manager', 'Global', '+63', '917 300 4410'),
  u('Namita Nath', 'Institution', 'Relationship Manager', 'Global', '+91', '98110 55093'),
  u('Raj Shamani', 'Institution', 'Relationship Manager', 'Global', '+91', '98110 70014'),
  u('Kavya Menon', 'Institution', 'Relationship Manager', 'Global', '+91', '98450 88110', 'Link sent'),
  u('Riya Sen', 'Institution Ops', 'Course Data Analyst', 'Global', '+91', '98110 31188'),
  u('Arjun Mehta', 'Institution Ops', 'Course Data Analyst', 'Global', '+91', '98450 41022'),
  u('Lav Likhi', 'Finance', 'Commissions Manager', 'Global', '+91', '98110 60075'),
];

/* ---------- permission roles × objects (PM: Settings › Permissions, decided 25 Oct) ---------- */
export const LEVELS = [
  ['N', 'No access'],
  ['V', 'View'],
  ['VX', 'View + export'],
  ['E', 'Edit'],
  ['EX', 'Edit + export'],
  ['M', 'Manage'],
] as const;
export type Level = (typeof LEVELS)[number][0];
export const ROLES = ['Admissions', 'Admissions Head', 'BAP', 'Data team', 'IP team', 'Recruitment (BDM)', 'Recruitment Head', 'Commissions & Finance', 'Super Admin', 'Leadership', 'RP admin', 'RP branch manager', 'RP counsellor', 'Master Partner admin'] as const;
/** Each object's level for each role, in ROLES' order (the PM's defaults). */
const P: [string, string][] = [
  ['Students', 'E EX VX VX VX V VX VX M VX EX E E V'],
  ['Student documents', 'E E VX VX VX V VX VX M V E E E V'],
  ['Applications', 'EX M VX VX VX V VX VX M VX EX E E V'],
  ['Application documents and checks', 'E M VX VX VX V VX VX M V E E E V'],
  ['Drafts to universities and placed emails', 'E M VX VX VX V VX VX M V N N N N'],
  ['Chat threads', 'E E E E E E E E M V E E E V'],
  ['Recruitment partner profile and status', 'V V M VX VX V EX V M VX E V N V'],
  ['RP onboarding documents', 'V V M V V V VX V M V E N N N'],
  ['Documents issued to RPs', 'V V M V V V VX E M V V N N V'],
  ['RP branches and team', 'V V M V V V E VX M V M E N N'],
  ['Master Partners', 'V V M V V V VX V M V N N N V'],
  ['Institution partners', 'V V V V M V V V M VX N N N N'],
  ['IP documents and IP changes', 'V V V V E N V V M V N N N N'],
  ['Universities', 'V V V E M V V V M VX V V V V'],
  ['University portal logins', 'V VX V E E N V V M V N N N N'],
  ['Campuses', 'V V V E E V V V M V V V V V'],
  ['Admission requirements', 'V V V M E V V V M V V V V V'],
  ['Announcements', 'V V V E E V V V M V V V V V'],
  ['University microsites', 'V V V E E V V V M V V V V V'],
  ['Courses, intakes and entry rules', 'V V V M E V V V M VX V V V V'],
  ['Held changes', 'V V V M E N V V M V N N N N'],
  ['Commission terms', 'N N N N V N V M M V N N N N'],
  ['Commission lines', 'N N N N N N N M M VX V N N V'],
  ['Invoices and receipts', 'N N N N N N V M M V N N N N'],
  ['Payout runs and statements', 'N N N N N N V M M V V N N V'],
  ['RP bank details', 'N N N N N N V M M V E N N E'],
  ['Overview dashboard', 'N V N N N N V V M V N N N N'],
  ['GSP users and roles', 'N N N N N N N N M V N N N N'],
  ['Settings', 'N N N N N N N N M V N N N N'],
  ['Download log and audit logs', 'N N N N N N N N M V N N N N'],
];
export const OBJECTS = P.map(([o]) => o);
export type Perms = Record<string, Record<string, Level>>;
export const samplePerms = (): Perms =>
  Object.fromEntries(P.map(([o, ls]) => [o, Object.fromEntries(ls.split(' ').map((l, i) => [ROLES[i], l as Level]))]));

/* ---------- queues (Nesil, 30 Oct: a name, a leader and members, from the PM's queues) ---------- */
export type Queue = { id: string; name: string; lead: string; members: string[] };
const byName = (users: User[], names: string[]) => names.map((n) => users.find((x) => x.name === n)?.id).filter((x): x is string => !!x);
export const sampleQueues = (users: User[]): Queue[] =>
  (
    [
      ['India Admissions', 'Megha Malhotra', ['Ramish']],
      ['Vietnam Admissions', 'Truc', ['Thi Tuyet Hoa Nguyen']],
      ['Nepal Admissions', 'Supriya', []],
      ['Bangladesh Admissions', 'Kamrun', []],
      ['Australia Admissions', 'Jo', []],
      ['India Recruitment', 'Saurabh', ['Nadia', 'Harsh', 'Aditya Rao']],
      ['Vietnam Recruitment', 'Tina', []],
      ['RP Ops', 'Leena Thomas', []],
      ['Institution', 'Lalaine Dizon', ['Namita Nath', 'Raj Shamani', 'Kavya Menon']],
      ['Data team', 'Riya Sen', ['Arjun Mehta']],
      ['Finance', 'Lav Likhi', []],
      ['Admission Ops', 'Meera Pillai', ['Megha Malhotra']],
    ] as [string, string, string[]][]
  ).map(([name, lead, members], i) => ({ id: `q${i + 1}`, name, lead: byName(users, [lead])[0] ?? '', members: byName(users, members) }));

/* ---------- email groups (Nesil, 30 Oct): shared inboxes, and who can see or send from them ---------- */
export type EmailPerm = 'view' | 'send';
export type EmailGroup = { id: string; email: string; sync: boolean; since: string; users: { id: string; perm: EmailPerm }[] };
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
export const sampleEmails = (users: User[]): EmailGroup[] => {
  const ids = (names: string[], send: string[] = []) => byName(users, names).map((id) => ({ id, perm: (byName(users, send).includes(id) ? 'send' : 'view') as EmailPerm }));
  return [
    { id: 'e1', email: 'admissions.india@gsp.upgrad.com', sync: true, since: iso(90), users: ids(['Megha Malhotra', 'Ramish', 'Meera Pillai'], ['Megha Malhotra', 'Ramish']) },
    { id: 'e2', email: 'admissions.vietnam@gsp.upgrad.com', sync: true, since: iso(60), users: ids(['Truc', 'Thi Tuyet Hoa Nguyen'], ['Truc']) },
    { id: 'e3', email: 'institutions@gsp.upgrad.com', sync: true, since: iso(120), users: ids(['Lalaine Dizon', 'Namita Nath', 'Raj Shamani', 'Kavya Menon'], ['Lalaine Dizon']) },
    { id: 'e4', email: 'partners@gsp.upgrad.com', sync: false, since: iso(0), users: ids(['Leena Thomas', 'Saurabh'], ['Leena Thomas']) },
    { id: 'e5', email: 'commissions@gsp.upgrad.com', sync: true, since: iso(30), users: ids(['Lav Likhi'], ['Lav Likhi']) },
  ];
};

/* ---------- BDM assignment (PM: Settings › BDM assignment) ---------- */
export type BdmRow = { id: string; country: string; area: string; bdm: string; fallback?: boolean };
let n = 0;
const row = (country: string, area: string, bdm: string, fallback = false): BdmRow => ({ id: `b${++n}`, country, area, bdm, fallback });
export const sampleBdm = (): BdmRow[] => [
  row('India', 'Kerala', 'Nadia'),
  row('India', 'Haryana, Delhi', 'Harsh'),
  row('India', 'Ludhiana, Amritsar, Jalandhar', 'Ramandeep'),
  row('India', 'Karnataka, Andhra Pradesh, Telangana', 'Aditya'),
  row('India', 'Rest of India', 'Saurabh'),
  row('Bangladesh', 'Dhaka', 'Sania'),
  row('Bangladesh', 'Rest of Bangladesh', 'Faisal'),
  row('Vietnam', 'Ho Chi Minh City', 'Tina'),
  row('Vietnam', 'Rest of Vietnam', 'Hoang'),
  row('Philippines', 'All', 'Arielle'),
  row('Myanmar', 'All', 'Nilar'),
  row('Indonesia', 'All', 'Rifaldo'),
  row('Malaysia', 'All', 'Rifaldo'),
  row('Pakistan', 'All', 'Ali'),
  row('Latin America and Europe', 'All countries', 'Camilo'),
  row('Africa', 'All countries', 'Faisal'),
  row('Sri Lanka', 'All', 'Kanchani'),
  row('Nepal', 'All', 'Anil Shrestha'),
  row('Australia', 'All', 'Judy'),
  row('Thailand', 'All', 'Rifaldo'),
  row('Bhutan', 'All', 'Nilar'),
  row('China', 'All', 'Judy'),
  row('All other countries', 'All', 'Ali', true),
];
export const REGION_ROWS = ['Latin America and Europe', 'Africa'];

/* ---------- currency exchange (not in the PM prototype: course search's sample rates) ---------- */
export type Rate = { code: string; name: string; perInr: number; usedFor: string; updated: number };
export const sampleRates = (): Rate[] => {
  const name: Record<string, string> = { AUD: 'Australian dollar', GBP: 'Pound sterling', CAD: 'Canadian dollar', NZD: 'New Zealand dollar', EUR: 'Euro', USD: 'US dollar' };
  const dests = (code: string) => (Object.entries(CURRENCY) as [Destination, string][]).filter(([, c]) => c === code).map(([d]) => d).join(', ');
  return Object.entries(INR_PER).map(([code, perInr], i) => ({ code, name: name[code] ?? code, perInr, usedFor: dests(code), updated: Date.now() - (i + 2) * DAY }));
};

/* ---------- living costs (not in the PM prototype: the visa figures the course dialog uses) ---------- */
export type Living = { country: Destination; currency: string; perYear: number; basis: string; updated: number };
export const sampleLiving = (): Living[] => [
  { country: 'Australia', currency: 'AUD', perYear: 29710, basis: 'Department of Home Affairs, student visa', updated: Date.now() - 12 * DAY },
  { country: 'UK', currency: 'GBP', perYear: 12006, basis: 'UKVI, 9 months outside London', updated: Date.now() - 30 * DAY },
  { country: 'Canada', currency: 'CAD', perYear: 20635, basis: 'IRCC, study permit', updated: Date.now() - 40 * DAY },
  { country: 'New Zealand', currency: 'NZD', perYear: 20000, basis: 'Immigration New Zealand', updated: Date.now() - 55 * DAY },
  { country: 'Ireland', currency: 'EUR', perYear: 12000, basis: 'Irish Immigration Service', updated: Date.now() - 60 * DAY },
  { country: 'USA', currency: 'USD', perYear: 18000, basis: 'GSP estimate (each university sets its own)', updated: Date.now() - 70 * DAY },
];

/* ---------- application routing (PM: Settings › Application routing) ---------- */
export type RouteRule = { id: 'direct' | 'list' | 'keep' | 'onshore' | 'nat' | 'fb'; title: string; when: string; region: string; bdm: string; on: boolean };
export const sampleRules = (): RouteRule[] => [
  { id: 'direct', title: 'Direct application', when: 'The application has no RP (the student applied to GSP directly).', region: 'Direct', bdm: 'Direct region default BDM', on: true },
  { id: 'list', title: 'RP is on a regional list', when: 'The RP is on one of the regional RP lists. Every application from that RP goes to the list’s region, onshore included. Nationality is not used.', region: 'The list’s region', bdm: 'The RP’s BDM', on: true },
  { id: 'keep', title: 'Onshore, RP has no Australian branch', when: 'Onshore application, the RP’s sales region is Vietnam or Latin America and Europe, and the RP has no branch in Australia.', region: 'The RP’s own region', bdm: 'The RP’s BDM', on: true },
  { id: 'onshore', title: 'Onshore application', when: 'The student’s current country is Australia and the destination is Australia.', region: 'Australia', bdm: 'Judy (region default)', on: true },
  { id: 'nat', title: 'Student’s nationality', when: 'The student’s nationality is in the country map (152 countries mapped).', region: 'The nationality’s region', bdm: 'That region’s default BDM', on: true },
  { id: 'fb', title: 'Fallback', when: 'Nothing above matched, for example a nationality that is not in the map.', region: 'Direct', bdm: 'That region’s default BDM', on: true },
];
export const REGION_BDM: Record<string, string> = {
  India: 'Nadia', Bangladesh: 'Sania', Nepal: 'Anil Shrestha', 'Sri Lanka': 'Kanchani', Vietnam: 'Tina', Pakistan: 'Ali', 'Indonesia, Malaysia and Thailand': 'Rifaldo',
  'Myanmar and Bhutan': 'Nilar', Australia: 'Judy', Philippines: 'Arielle', Africa: 'Faisal', 'Latin America and Europe': 'Camilo', China: 'Judy',
};
/** The PM's sample RPs, for the regional lists and the test. */
export type RoutingRp = { name: string; region: string; auBranch: boolean; bdm: string };
export const ROUTING_RPS: RoutingRp[] = [
  { name: 'BrightPath Overseas', region: 'India', auBranch: false, bdm: 'Aditya' },
  { name: 'Horizon Overseas', region: 'India', auBranch: true, bdm: 'Harsh' },
  { name: 'Kathmandu Study Hub', region: 'Nepal', auBranch: false, bdm: 'Anil Shrestha' },
  { name: 'Dhaka Global Education', region: 'Bangladesh', auBranch: false, bdm: 'Sania' },
  { name: 'Saigon Study Link', region: 'Vietnam', auBranch: false, bdm: 'Tina' },
  { name: 'Mekong Edu Partners', region: 'Vietnam', auBranch: true, bdm: 'Hoang' },
  { name: 'Andes Education Group', region: 'Latin America and Europe', auBranch: false, bdm: 'Camilo' },
  { name: 'Manila Abroad Consultancy', region: 'Philippines', auBranch: false, bdm: 'Arielle' },
  { name: 'Colombo Pathways', region: 'Sri Lanka', auBranch: false, bdm: 'Kanchani' },
  { name: 'Lagos Study Partners', region: 'Africa', auBranch: false, bdm: 'Faisal' },
];
export const sampleLists = (): Record<string, string[]> => ({ Vietnam: ['Saigon Study Link', 'Mekong Edu Partners'], 'Latin America and Europe': ['Andes Education Group'], Philippines: ['Manila Abroad Consultancy'] });
/** Nationality to region, for the test (the PM maps 152 countries; these are the ones the test offers). */
export const NATIONALITY: Record<string, string> = {
  India: 'India', Nepal: 'Nepal', Bangladesh: 'Bangladesh', 'Sri Lanka': 'Sri Lanka', Pakistan: 'Pakistan', Vietnam: 'Vietnam', Philippines: 'Philippines', China: 'China',
  Indonesia: 'Indonesia, Malaysia and Thailand', Malaysia: 'Indonesia, Malaysia and Thailand', Thailand: 'Indonesia, Malaysia and Thailand', Myanmar: 'Myanmar and Bhutan', Bhutan: 'Myanmar and Bhutan',
  Nigeria: 'Africa', Kenya: 'Africa', Ghana: 'Africa', Brazil: 'Latin America and Europe', Colombia: 'Latin America and Europe', Germany: 'Latin America and Europe',
  'United Arab Emirates': '', Canada: '', 'United States': '',
};
export const DESTINATIONS = ['Australia', 'United Kingdom', 'Canada', 'United States', 'New Zealand', 'Ireland'];

/** Runs the rules from the top: the first that matches sets the region and BDM (PM: routing with its trace). */
export function route(rules: RouteRule[], lists: Record<string, string[]>, a: { rp: string; nationality: string; now: string; dest: string }) {
  const rp = ROUTING_RPS.find((r) => r.name === a.rp);
  const listRegion = rp && Object.entries(lists).find(([, l]) => l.includes(rp.name))?.[0];
  const onshore = a.now === 'Australia' && a.dest === 'Australia';
  const test: Record<RouteRule['id'], () => { region: string; bdm: string; why: string } | null> = {
    direct: () => (!rp ? { region: 'Direct', bdm: REGION_BDM.Direct ?? 'Not set', why: 'No RP: the student applied to GSP directly' } : null),
    list: () => (listRegion ? { region: listRegion, bdm: rp!.bdm, why: `${rp!.name} is on the ${listRegion} list` } : null),
    keep: () => (rp && onshore && ['Vietnam', 'Latin America and Europe'].includes(rp.region) && !rp.auBranch ? { region: rp.region, bdm: rp.bdm, why: `Onshore, and ${rp.name} (${rp.region}) has no Australian branch` } : null),
    onshore: () => (onshore ? { region: 'Australia', bdm: REGION_BDM.Australia, why: 'The student is in Australia and applying to Australia' } : null),
    nat: () => (NATIONALITY[a.nationality] ? { region: NATIONALITY[a.nationality], bdm: REGION_BDM[NATIONALITY[a.nationality]] ?? 'Not set', why: `${a.nationality} maps to ${NATIONALITY[a.nationality]}` } : null),
    fb: () => ({ region: 'Direct', bdm: 'Not set', why: 'Nothing above matched' }),
  };
  let hit: { region: string; bdm: string; why: string; rule: RouteRule; n: number } | null = null;
  const trace = rules.map((r, i) => {
    if (hit) return { r, state: 'Skipped' as const, why: 'Not checked: an earlier rule matched' };
    if (!r.on && r.id !== 'fb') return { r, state: 'Off' as const, why: 'Rule is switched off' };
    const x = test[r.id]();
    if (x) {
      hit = { ...x, rule: r, n: i + 1 };
      return { r, state: 'Match' as const, why: x.why };
    }
    return { r, state: 'No' as const, why: 'Does not apply' };
  });
  return { hit: hit as { region: string; bdm: string; why: string; rule: RouteRule; n: number } | null, trace, source: rp ? rp.region : 'Direct' };
}

/* ---------- document configuration (PM: Settings › Document rules and Agency documents) ---------- */
export const STAGES = ['New', 'Pre-Screening', 'Application', 'Offer', 'Verification', 'Acceptance', 'Visa', 'Enrolled'] as const;
export type DocRule = { id: string; doc: string; stage: (typeof STAGES)[number]; when: string; setting: 'Mandatory' | 'Optional'; by: 'RP' | 'GSP'; on: boolean };
let d = 0;
const dr = (doc: string, stage: DocRule['stage'], when: string, setting: DocRule['setting'], by: DocRule['by']): DocRule => ({ id: `d${++d}`, doc, stage, when, setting, by, on: true });
export const sampleDocRules = (): DocRule[] => [
  dr('Passport', 'New', 'Always', 'Mandatory', 'RP'),
  dr('Class 10 marksheet', 'New', 'Any study level', 'Mandatory', 'RP'),
  dr('Class 12 marksheet', 'New', 'Any study level', 'Mandatory', 'RP'),
  dr('UG degree and transcripts', 'New', 'Postgraduate or Doctorate', 'Mandatory', 'RP'),
  dr('PG degree and transcripts', 'New', 'Doctorate', 'Mandatory', 'RP'),
  dr('SOP', 'New', 'University in the UK', 'Mandatory', 'RP'),
  dr('LORs', 'New', 'University in the UK', 'Mandatory', 'RP'),
  dr('University application form, filled', 'New', 'The university has its own form', 'Mandatory', 'RP'),
  dr('IP transfer proof', 'New', 'Australia, already in the destination', 'Optional', 'RP'),
  dr('RPL proof', 'New', 'Australia, already in the destination', 'Optional', 'RP'),
  dr('Conditional offer letter', 'Offer', 'Always', 'Mandatory', 'GSP'),
  dr('Financial documents', 'Verification', 'Always', 'Optional', 'RP'),
  dr('GS outcome', 'Verification', 'University in Australia', 'Mandatory', 'GSP'),
  dr('Unconditional offer letter', 'Offer', 'Always', 'Mandatory', 'GSP'),
  dr('Pre-visa approval (AIP / EMGS)', 'Acceptance', 'University in New Zealand or Malaysia', 'Mandatory', 'RP'),
  dr('Deposit receipt', 'Acceptance', 'Always', 'Mandatory', 'RP'),
  dr('Acceptance letter (CoE, CAS, I-20, LOA and PAL)', 'Acceptance', 'Always', 'Mandatory', 'GSP'),
  dr('Visa lodgement proof', 'Visa', 'Always', 'Mandatory', 'RP'),
  dr('Visa outcome', 'Visa', 'Always', 'Mandatory', 'RP'),
  dr('Proof of enrolment', 'Enrolled', 'Always', 'Mandatory', 'GSP'),
];
export type RpDocRule = { id: string; applies: 'Only these countries' | 'All countries except' | 'All countries'; countries: string[]; docs: string[] };
export const sampleRpDocs = (): RpDocRule[] => [
  { id: 'r1', applies: 'Only these countries', countries: ['India'], docs: ['Business registration certificate', 'PAN card', 'GST certificate (if registered)'] },
  { id: 'r2', applies: 'All countries except', countries: ['India'], docs: ['Business registration certificate', 'Company profile', 'Owner’s ID', 'Reference (name, email, phone)'] },
];

/* ---------- filters (not in the PM prototype: course search's own filters) ---------- */
export type FilterSet = { page: string; filters: { id: string; label: string; shown: boolean }[] };
export const sampleFilters = (): FilterSet[] => [
  {
    page: 'Course search',
    filters: ['University', 'Tuition a year, up to', 'IELTS needed, up to', 'Intake open now', 'Deadline within 45 days', 'Scholarship available', 'No application fee', 'English test can wait or be waived', 'Post-study work visa', 'Shortlisted only'].map((label, i) => ({ id: `c${i}`, label, shown: true })),
  },
  {
    page: 'Applications',
    filters: ['Destination', 'Counsellor', 'Intake', 'Stage', 'Status', 'University', 'Started between'].map((label, i) => ({ id: `a${i}`, label, shown: i < 3 || i === 4 })),
  },
  {
    page: 'Students',
    filters: ['Status', 'Counsellor', 'Nationality', 'Highest education', 'Added between'].map((label, i) => ({ id: `s${i}`, label, shown: i < 2 })),
  },
];

/* ---------- logs (PM: Download log; plus every change here) ---------- */
const at = (daysAgo: number, h: number, m: number) => {
  const x = new Date(Date.now() - daysAgo * DAY);
  x.setHours(h, m, 0, 0);
  return x.getTime();
};
export const sampleLog = (): LogEntry[] => [
  { id: 'l1', at: Date.now() - 3 * 3_600_000, who: 'Jovial Lejo', area: 'BDM assignment', text: 'Edited India · Kerala → Nadia', kind: 'change', role: 'Super Admin' },
  { id: 'l2', at: at(1, 12, 41), who: 'Megha Malhotra', area: 'Applications', text: 'Applications list', kind: 'download', role: 'Admissions', filters: 'India · status = With university', size: '312 rows', format: 'CSV' },
  { id: 'l3', at: at(1, 11, 2), who: 'Ananya Rao', area: 'Course search', text: 'Course shortlist', kind: 'download', role: 'RP admin', filters: '8 courses · 6 fields', size: '8 rows', format: 'CSV' },
  { id: 'l4', at: at(2, 18, 20), who: 'Lav Likhi', area: 'Commissions', text: 'Confirmed commissions', kind: 'download', role: 'Commissions & Finance', filters: 'Oct 2026', size: '1,204 rows', format: 'XLSX' },
  { id: 'l5', at: at(2, 15, 5), who: 'Jovial Lejo', area: 'Application routing', text: 'Moved “Onshore, RP has no Australian branch” above “Onshore application”', kind: 'change', role: 'Super Admin' },
  { id: 'l6', at: at(2, 10, 15), who: 'Lalaine Dizon', area: 'Universities', text: 'Universities', kind: 'download', role: 'IP team', filters: 'Australia', size: '86 rows', format: 'CSV' },
  { id: 'l7', at: at(3, 16, 40), who: 'Jovial Lejo', area: 'Permission roles', text: 'Recruitment Head: RP branches and team → Edit', kind: 'change', role: 'Super Admin' },
];
