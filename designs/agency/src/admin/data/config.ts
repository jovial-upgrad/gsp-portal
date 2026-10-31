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
  India: 'Ramish', Nepal: 'Supriya', 'Sri Lanka': 'Subodhya', Bangladesh: 'Kamrun', Pakistan: 'Sabrina', Africa: 'Kamrun', 'Rest of world': 'Tasha', Direct: 'Tasha',
  'Latin America and Europe': 'Valentina', Vietnam: 'Truc', 'Indonesia, Malaysia and Thailand': 'Truc', 'Myanmar and Bhutan': 'Truc', Philippines: 'Truc',
  Australia: 'Jo', China: 'Jo',
};
export const sampleRegions = (): Region[] => SALES_REGIONS.map((name) => ({ name, contact: CONTACT[name] ?? '' }));
/** The regions a queue or a routing can point to (not Global, which only GSP people cover). */
export const workRegions = (rs: Region[]) => rs.filter((r) => r.name !== 'Global' && r.name !== 'Direct');

/* ---------- GSP users and their roles (Nesil, 30 Oct: Create roles; people from the PM's samples) ---------- */
/** The roles a GSP user can have (Nesil's list). */
export const GSP_ROLES = ['Admin', 'Admission', 'Admission Ops', 'Recruitment', 'Recruitment Ops', 'Institution', 'Institution Ops', 'Finance', 'View Only'] as const;
export type GspRole = (typeof GSP_ROLES)[number];
/** Link sent: waiting for them to set a password; Active: they've signed in; Deactivated: can't sign in (Jovial, 31 Oct). */
export type UserStatus = 'Not sent' | 'Link sent' | 'Active' | 'Deactivated';
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
/** GSP's people (Jovial's list, 30 and 31 Oct). */
export const sampleUsers = (): User[] => [
  u('Jovial', 'Admin', 'Product Manager', 'Global', '+91', '98110 20031'),
  u('Suman', 'Finance', 'Finance', 'Global', '+61', '412 300 201'),
  u('Lav', 'Finance', 'Finance', 'Global', '+91', '98110 60075'),
  u('Myleeta', 'View Only', 'Leadership', 'Global', '+61', '412 300 990'),
  u('Ramish', 'Admission', 'Admissions Head, India', 'India', '+91', '98450 11872'),
  u('Satinder', 'Admission', 'Admissions Officer', 'India', '+91', '98450 22140'),
  u('Kamrun', 'Admission', 'Admissions Head, Bangladesh and Africa', 'Bangladesh', '+880', '1711 409 118'),
  u('Sabrina', 'Admission', 'Admissions Officer', 'Pakistan', '+92', '300 412 7781'),
  u('Supriya', 'Admission', 'Admissions Lead, Nepal', 'Nepal', '+977', '980 114 2290'),
  u('Subodhya', 'Admission', 'Admissions Lead, Sri Lanka', 'Sri Lanka', '+94', '77 410 2283'),
  u('Truc', 'Admission', 'Admissions Lead, South-East Asia', 'Vietnam', '+84', '90 812 3341'),
  u('Jo', 'Admission', 'Admissions Lead, Australia and China', 'Australia', '+61', '412 300 118'),
  u('Valentina', 'Admission', 'Admissions Lead, Latin America and Europe', 'Latin America and Europe', '+44', '7700 900 412'),
  u('Tasha', 'Admission Ops', 'Admission Ops Head', 'Global', '+61', '412 300 455'),
  u('Rajinder', 'Admission Ops', 'Admission Ops', 'Global', '+91', '98450 30021'),
  u('Ashu', 'Admission Ops', 'Admission Ops', 'Global', '+91', '98450 30388', 'Link sent'),
  u('Ali', 'Recruitment', 'Recruitment Head, Rest of world', 'Rest of world', '+971', '50 412 7710'),
  u('Saurabh', 'Recruitment', 'Recruitment Head, India', 'India', '+91', '98110 77201'),
  u('Faisal', 'Recruitment', 'Recruitment Head, Bangladesh', 'Bangladesh', '+880', '1711 420 019'),
  u('Quan', 'Recruitment', 'Recruitment Head, Vietnam', 'Vietnam', '+84', '90 812 0042'),
  u('Harsh', 'Recruitment', 'BDM', 'India', '+91', '98110 41870'),
  u('Sania', 'Recruitment', 'BDM', 'Bangladesh', '+880', '1711 409 552'),
  u('Ramandeep', 'Recruitment', 'BDM', 'India', '+91', '98110 40217'),
  u('Arielle', 'Recruitment', 'BDM', 'Philippines', '+63', '917 300 2281'),
  u('Kanchani', 'Recruitment', 'BDM', 'Sri Lanka', '+94', '77 410 9921', 'Link sent'),
  u('Rifaldo', 'Recruitment', 'BDM', 'Indonesia, Malaysia and Thailand', '+62', '812 300 4410'),
  u('Mayank', 'Recruitment', 'BDM', 'India', '+91', '98950 22018'),
  u('Nilar', 'Recruitment', 'BDM', 'Myanmar and Bhutan', '+95', '9 412 300 71'),
  u('Garima', 'Recruitment Ops', 'Recruitment Ops Head', 'Global', '+91', '98450 66120'),
  u('Kartik', 'Recruitment Ops', 'Recruitment Ops', 'Global', '+91', '98450 66231'),
  u('Rishabh', 'Recruitment Ops', 'Recruitment Ops', 'Global', '+91', '98450 66342'),
  u('Shara', 'Recruitment Ops', 'Recruitment Ops', 'Global', '+91', '98450 66453'),
  u('Matt', 'Institution', 'Institution Head', 'Global', '+61', '412 300 771'),
  u('Catherine', 'Institution', 'Relationship Manager', 'Global', '+61', '412 300 772'),
  u('Kevin', 'Institution', 'Relationship Manager', 'Global', '+61', '412 300 773'),
  u('Namita', 'Institution', 'Relationship Manager', 'Global', '+91', '98110 55093'),
  u('Lalaine', 'Institution', 'Relationship Manager', 'Global', '+63', '917 300 4410'),
  u('Gauri', 'Institution Ops', 'Institution Ops Head', 'Global', '+91', '98110 31188'),
  u('Munmun', 'Institution Ops', 'Course Data', 'Global', '+91', '98450 41022'),
  u('Neelam', 'Institution Ops', 'Course Data', 'Global', '+91', '98450 41133'),
  u('Vishakha', 'Institution Ops', 'Course Data', 'Global', '+91', '98450 41244', 'Not sent'),
];

/* ---------- permission roles × objects (PM: Settings › Permissions, decided 25 Oct) ---------- */
/** Jovial, 31 Oct: just three levels. */
export const LEVELS = [
  ['N', 'No access'],
  ['V', 'View'],
  ['E', 'View + edit'],
] as const;
export type Level = (typeof LEVELS)[number][0];
/** The PM's fourteen roles, which the defaults below were set for. */
const PM_ROLES = ['Admissions', 'Admissions Head', 'BAP', 'Data team', 'IP team', 'Recruitment (BDM)', 'Recruitment Head', 'Commissions & Finance', 'Super Admin', 'Leadership', 'RP admin', 'RP branch manager', 'RP counsellor', 'Master Partner admin'] as const;
/** Jovial, 31 Oct: GSP's nine roles, each taking the PM role it replaces (View Only takes Leadership, view only). */
export const ROLES = ['Admin', 'Admission', 'Admission Ops', 'Recruitment', 'Recruitment Ops', 'Institution', 'Institution Ops', 'Finance', 'View Only'] as const;
const FROM: Record<(typeof ROLES)[number], (typeof PM_ROLES)[number]> = {
  Admin: 'Super Admin', Admission: 'Admissions', 'Admission Ops': 'Admissions Head', Recruitment: 'Recruitment Head', 'Recruitment Ops': 'BAP',
  Institution: 'IP team', 'Institution Ops': 'Data team', Finance: 'Commissions & Finance', 'View Only': 'Leadership',
};
const three = (l: string): 'N' | 'V' | 'E' => (l === 'N' ? 'N' : l === 'V' || l === 'VX' ? 'V' : 'E');
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
  Object.fromEntries(
    P.map(([o, ls]) => {
      const pm = Object.fromEntries(ls.split(' ').map((l, i) => [PM_ROLES[i], l]));
      return [o, Object.fromEntries(ROLES.map((r) => [r, r === 'View Only' ? (pm[FROM[r]] === 'N' ? 'N' : 'V') : three(pm[FROM[r]])]))];
    }),
  ) as Perms;

/* ---------- queues (Nesil, 30 Oct: a name, a leader and members, from the PM's queues) ---------- */
export type Queue = { id: string; name: string; lead: string; members: string[] };
const byName = (users: User[], names: string[]) => names.map((n) => users.find((x) => x.name === n)?.id).filter((x): x is string => !!x);
export const sampleQueues = (users: User[]): Queue[] =>
  (
    [
      ['India Admissions', 'Ramish', ['Satinder']],
      ['Bangladesh Admissions', 'Kamrun', []],
      ['Africa Admissions', 'Kamrun', []],
      ['Pakistan Admissions', 'Sabrina', []],
      ['Nepal Admissions', 'Supriya', []],
      ['Sri Lanka Admissions', 'Subodhya', []],
      ['Vietnam Admissions', 'Truc', []],
      ['Philippines Admissions', 'Truc', []],
      ['Myanmar and Bhutan Admissions', 'Truc', []],
      ['Indonesia, Malaysia and Thailand Admissions', 'Truc', []],
      ['Australia Admissions', 'Jo', []],
      ['China Admissions', 'Jo', []],
      ['Latin America and Europe Admissions', 'Valentina', []],
      ['Global Admissions', 'Tasha', ['Rajinder', 'Ashu']],
      ['Admission Ops', 'Tasha', ['Rajinder', 'Ashu']],
      ['Recruitment Ops', 'Garima', ['Kartik', 'Rishabh', 'Shara']],
      ['Institution', 'Matt', ['Catherine', 'Kevin', 'Namita', 'Lalaine']],
      ['Institution Ops', 'Gauri', ['Munmun', 'Neelam', 'Vishakha']],
      ['Finance', 'Suman', ['Lav']],
    ] as [string, string, string[]][]
  ).map(([name, lead, members], i) => ({ id: `q${i + 1}`, name, lead: byName(users, [lead])[0] ?? '', members: byName(users, members) }));

/* ---------- email groups (Nesil, 30 Oct): shared inboxes, and who can see or send from them ---------- */
export type EmailPerm = 'view' | 'send';
export type EmailGroup = { id: string; email: string; sync: boolean; since: string; users: { id: string; perm: EmailPerm }[] };
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
export const sampleEmails = (users: User[]): EmailGroup[] => {
  const ids = (names: string[], send: string[] = []) => byName(users, names).map((id) => ({ id, perm: (byName(users, send).includes(id) ? 'send' : 'view') as EmailPerm }));
  return [
    { id: 'e1', email: 'admissions@globalstudypartners.com', sync: true, since: iso(300), users: ids(['Ramish', 'Satinder', 'Kamrun', 'Sabrina', 'Supriya', 'Subodhya', 'Jo', 'Valentina', 'Tasha', 'Rajinder', 'Ashu'], ['Ramish', 'Satinder', 'Kamrun', 'Sabrina', 'Supriya', 'Subodhya', 'Jo', 'Valentina', 'Tasha']) },
    { id: 'e2', email: 'gsp.admissions@upgrad.com', sync: true, since: iso(300), users: ids(['Ramish', 'Satinder', 'Tasha'], ['Ramish', 'Tasha']) },
    { id: 'e3', email: 'admissionsph@globalstudypartners.com', sync: true, since: iso(200), users: ids(['Truc', 'Tasha'], ['Truc']) },
    { id: 'e4', email: 'partners@gsp.upgrad.com', sync: false, since: iso(0), users: ids(['Garima', 'Kartik', 'Rishabh', 'Shara'], ['Garima']) },
    { id: 'e5', email: 'commissions@gsp.upgrad.com', sync: true, since: iso(30), users: ids(['Suman', 'Lav'], ['Suman', 'Lav']) },
  ];
};

/* ---------- BDM assignment (PM: Settings › BDM assignment) ---------- */
export type BdmRow = { id: string; country: string; area: string; bdm: string; fallback?: boolean };
let n = 0;
const row = (country: string, area: string, bdm: string, fallback = false): BdmRow => ({ id: `b${++n}`, country, area, bdm, fallback });
export const sampleBdm = (): BdmRow[] => [
  row('India', 'Kerala', 'Mayank'),
  row('India', 'Haryana, Delhi', 'Harsh'),
  row('India', 'Ludhiana, Amritsar, Jalandhar', 'Ramandeep'),
  row('India', 'Karnataka, Andhra Pradesh, Telangana', 'Harsh'),
  row('India', 'Rest of India', 'Saurabh'),
  row('Bangladesh', 'Dhaka', 'Sania'),
  row('Bangladesh', 'Rest of Bangladesh', 'Faisal'),
  row('Vietnam', 'Ho Chi Minh City', 'Quan'),
  row('Vietnam', 'Rest of Vietnam', 'Quan'),
  row('Philippines', 'All', 'Arielle'),
  row('Myanmar', 'All', 'Nilar'),
  row('Indonesia', 'All', 'Rifaldo'),
  row('Malaysia', 'All', 'Rifaldo'),
  row('Pakistan', 'All', 'Ali'),
  row('Latin America and Europe', 'All countries', 'Ali'),
  row('Africa', 'All countries', 'Faisal'),
  row('Sri Lanka', 'All', 'Kanchani'),
  row('Nepal', 'All', 'Ali'),
  row('Australia', 'All', 'Ali'),
  row('Thailand', 'All', 'Rifaldo'),
  row('Bhutan', 'All', 'Nilar'),
  row('China', 'All', 'Ali'),
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
export type Living = { country: string; currency: string; perYear: number; basis: string; updated: number };
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
  { id: 'onshore', title: 'Onshore application', when: 'The student’s current country is Australia and the destination is Australia.', region: 'Australia', bdm: 'Australia’s default BDM', on: true },
  { id: 'nat', title: 'Student’s nationality', when: 'The student’s nationality is in the country map (152 countries mapped).', region: 'The nationality’s region', bdm: 'That region’s default BDM', on: true },
  { id: 'fb', title: 'Fallback', when: 'Nothing above matched, for example a nationality that is not in the map.', region: 'Direct', bdm: 'That region’s default BDM', on: true },
];
/** Each region's default application BDM (Jovial, 31 Oct: Rest of world and Direct → Ali). */
export const REGION_BDM: Record<string, string> = {
  India: 'Saurabh', Bangladesh: 'Sania', Pakistan: 'Ali', Africa: 'Faisal', Nepal: 'Ali', 'Sri Lanka': 'Kanchani', Vietnam: 'Quan', Philippines: 'Arielle',
  'Myanmar and Bhutan': 'Nilar', 'Indonesia, Malaysia and Thailand': 'Rifaldo', Australia: 'Ali', China: 'Ali', 'Latin America and Europe': 'Ali', 'Rest of world': 'Ali', Direct: 'Ali',
};
/** Each region's Admissions queue, by queue name (Jovial, 31 Oct: Rest of world and Direct → Global Admissions). */
export const regionQueueName = (region: string) => (region === 'Rest of world' || region === 'Direct' ? 'Global Admissions' : `${region} Admissions`);
/** The PM's sample RPs, for the regional lists and the test. */
export type RoutingRp = { name: string; region: string; auBranch: boolean; bdm: string };
export const ROUTING_RPS: RoutingRp[] = [
  { name: 'BrightPath Overseas', region: 'India', auBranch: false, bdm: 'Harsh' },
  { name: 'Horizon Overseas', region: 'India', auBranch: true, bdm: 'Harsh' },
  { name: 'Kathmandu Study Hub', region: 'Nepal', auBranch: false, bdm: 'Ali' },
  { name: 'Dhaka Global Education', region: 'Bangladesh', auBranch: false, bdm: 'Sania' },
  { name: 'Saigon Study Link', region: 'Vietnam', auBranch: false, bdm: 'Quan' },
  { name: 'Mekong Edu Partners', region: 'Vietnam', auBranch: true, bdm: 'Quan' },
  { name: 'Andes Education Group', region: 'Latin America and Europe', auBranch: false, bdm: 'Ali' },
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
export function route(rules: RouteRule[], lists: Record<string, string[]>, a: { rp: string; nationality: string; now: string; dest: string }, defaults: Record<string, string> = REGION_BDM) {
  const rp = ROUTING_RPS.find((r) => r.name === a.rp);
  const listRegion = rp && Object.entries(lists).find(([, l]) => l.includes(rp.name))?.[0];
  const onshore = a.now === 'Australia' && a.dest === 'Australia';
  const test: Record<RouteRule['id'], () => { region: string; bdm: string; why: string } | null> = {
    direct: () => (!rp ? { region: 'Direct', bdm: defaults.Direct || 'Not set', why: 'No RP: the student applied to GSP directly' } : null),
    list: () => (listRegion ? { region: listRegion, bdm: rp!.bdm, why: `${rp!.name} is on the ${listRegion} list` } : null),
    keep: () => (rp && onshore && ['Vietnam', 'Latin America and Europe'].includes(rp.region) && !rp.auBranch ? { region: rp.region, bdm: rp.bdm, why: `Onshore, and ${rp.name} (${rp.region}) has no Australian branch` } : null),
    onshore: () => (onshore ? { region: 'Australia', bdm: defaults.Australia || 'Not set', why: 'The student is in Australia and applying to Australia' } : null),
    nat: () => (NATIONALITY[a.nationality] ? { region: NATIONALITY[a.nationality], bdm: defaults[NATIONALITY[a.nationality]] || 'Not set', why: `${a.nationality} maps to ${NATIONALITY[a.nationality]}` } : null),
    fb: () => ({ region: 'Direct', bdm: defaults.Direct || 'Not set', why: 'Nothing above matched' }),
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
export type DocRule = { id: string; doc: string; stage: (typeof STAGES)[number]; when: string; setting: 'Mandatory' | 'Optional'; by: 'RP' | 'GSP'; on: boolean; cond?: DocCond };
/** When a document rule applies (Jovial, 31 Oct: configurable): study levels, university countries, where the student is, and anything else. Empty = any. */
export type DocCond = { levels: string[]; countries: string[]; where: string; other: string };
export const DOC_LEVELS = ['Foundation', 'Diploma', 'Undergraduate', 'Postgraduate', 'Doctorate'];
export const DOC_COUNTRIES = ['Australia', 'UK', 'Canada', 'USA', 'New Zealand', 'Ireland', 'Malaysia'];
export const DOC_WHERE = ['Anywhere', 'Already in the destination', 'Outside the destination'];
const or = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} or ${l[l.length - 1]}` : l[0] ?? '');
export const whenText = (c: DocCond) =>
  [c.levels.length && or(c.levels), c.countries.length && `University in ${or(c.countries.map((x) => (x === 'UK' || x === 'USA' ? `the ${x}` : x)))}`, c.where !== 'Anywhere' && c.where.toLowerCase(), c.other.trim()].filter(Boolean).join(', ') || 'Always';
/** The rule's conditions, read from its sentence for rules made before conditions were stored. */
export function condOf(r: DocRule): DocCond {
  if (r.cond) return r.cond;
  const w = r.when;
  const c: DocCond = { levels: DOC_LEVELS.filter((l) => w.includes(l)), countries: DOC_COUNTRIES.filter((x) => w.includes(x)), where: DOC_WHERE.find((x) => w.toLowerCase().includes(x.toLowerCase())) ?? 'Anywhere', other: '' };
  if (!c.levels.length && !c.countries.length && c.where === 'Anywhere' && !/^(Always|Any study level)$/.test(w)) c.other = w;
  return c;
}
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
  { id: 'l1', at: Date.now() - 3 * 3_600_000, who: 'Jovial', area: 'BDM assignment', text: 'Edited India · Kerala → Mayank', kind: 'change', role: 'Admin' },
  { id: 'l2', at: at(1, 12, 41), who: 'Ramish', area: 'Applications', text: 'Applications list', kind: 'download', role: 'Admission', filters: 'India · Status: With university', size: '312 rows', format: 'CSV' },
  { id: 'l3', at: at(1, 11, 2), who: 'Saurabh', area: 'Course search', text: 'Course shortlist', kind: 'download', role: 'Recruitment', filters: 'Australia · Master’s · Data science', size: '8 rows', format: 'CSV' },
  { id: 'l4', at: at(2, 18, 20), who: 'Lav', area: 'Commissions', text: 'RP ledger', kind: 'download', role: 'Finance', filters: 'Oct 2026', size: '1,204 rows', format: 'CSV' },
  { id: 'l5', at: at(2, 15, 5), who: 'Jovial', area: 'Application routing', text: 'Moved “Onshore, RP has no Australian branch” above “Onshore application”', kind: 'change', role: 'Admin' },
  { id: 'l6', at: at(2, 10, 15), who: 'Lalaine', area: 'Universities', text: 'Universities', kind: 'download', role: 'Institution', filters: 'Country: Australia', size: '86 rows', format: 'CSV' },
  { id: 'l7', at: at(3, 16, 40), who: 'Kamrun', area: 'Students', text: 'Students', kind: 'download', role: 'Admission', filters: 'Bangladesh · Added in October', size: '214 rows', format: 'CSV' },
  { id: 'l8', at: at(4, 9, 55), who: 'Suman', area: 'Commissions', text: 'University ledger', kind: 'download', role: 'Finance', filters: 'Status: Payment overdue', size: '37 rows', format: 'CSV' },
  { id: 'l9', at: at(6, 14, 30), who: 'Garima', area: 'Recruitment partners', text: 'Recruitment partners', kind: 'download', role: 'Recruitment Ops', filters: 'Status: Verification pending', size: '52 rows', format: 'CSV' },
  { id: 'l10', at: at(9, 17, 10), who: 'Myleeta', area: 'Applications', text: 'Applications list', kind: 'download', role: 'View Only', filters: 'None', size: '41,805 rows', format: 'CSV' },
];
