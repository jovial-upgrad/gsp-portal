/**
 * What GSP Admin configures (Nesil, 30 Oct). Taken from the PM prototype's Super Admin › Settings wherever it has
 * them (sales regions, permissions, queues, BDM assignment, application routing, document rules, the download log);
 * the currency exchange, living costs and filters tables aren't in it, so they're built from the figures this
 * prototype already uses (course search's rates, the course dialog's visa figures, course search's filters).
 * Every change is logged (`log`), and Logs shows them with the download log. Sample data.
 */
import { ROLES as PROTO_ROLES } from '../../proto/roles';
import { SALES_REGIONS } from '../../institution/data/announcements';
import { AREAS, CURRENCY, LEVELS as PROGRAM_LEVELS, type Destination } from '../../data/courses';
import { INR_PER } from '../../screens/courses/search';
import { REGIONS_OF } from '../../institution/records/CountryPicker';
import type { QueueType, Sharing } from './work';

/** `area` is the source: the page a change was made on, or where a download came from. `records`: how many rows a
 *  download had. */
export type LogEntry = { id: string; at: number; who: string; email?: string; area: string; text: string; kind: 'change' | 'download'; role?: string; region?: string; filters?: string; records?: number; format?: string };

/* ---------- sales regions (PM: Settings › Sales regions and Admissions contacts; Nesil, 3 Nov: countries, BDM
   contact and admission queues, all needed; 4 Nov: one admission queue) ---------- */
export type Region = { name: string; contact: string; countries: string[]; bdm: string; queue: string };
/** The regions GSP keeps itself: they can't be edited or deleted here. */
export const FIXED_REGIONS = ['Rest of world', 'Direct', 'Global'];
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
/** Each region's countries, as the country list names them. */
const COUNTRIES_OF: Record<string, string[]> = {
  'Indonesia, Malaysia and Thailand': ['Indonesia', 'Malaysia', 'Thailand'],
  'Myanmar and Bhutan': ['Myanmar', 'Bhutan'],
  Africa: REGIONS_OF.Africa,
  'Latin America and Europe': [...REGIONS_OF['Latin America'], 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Poland'],
};
export const sampleRegions = (queues: Queue[]): Region[] =>
  SALES_REGIONS.map((name) => ({
    name,
    contact: CONTACT[name] ?? '',
    countries: FIXED_REGIONS.includes(name) ? [] : (COUNTRIES_OF[name] ?? [name]),
    bdm: REGION_BDM[name] ?? '',
    // a region without its own Admissions queue is worked by Admission Ops
    queue: FIXED_REGIONS.includes(name) ? '' : ((queues.find((q) => q.name === `${name} Admissions`) ?? queues.find((q) => q.name === 'Admission Ops'))?.id ?? ''),
  }));
/** The regions a queue or a routing can point to (not Global, which only GSP people cover). */
export const workRegions = (rs: Region[]) => rs.filter((r) => r.name !== 'Global' && r.name !== 'Direct');

/* ---------- GSP users and their roles (Nesil, 30 Oct: Create roles; people from the PM's samples) ---------- */
/** The roles a user can have (Nesil, 6 Nov): every role built in the prototype, but RP Admin's backup copy. */
export const GSP_ROLES: string[] = PROTO_ROLES.filter((r) => r.key !== 'rp-admin-backup').map((r) => r.label);
export type GspRole = string;
/** The roles the samples were written with (Nesil's first eight, 30 Oct), and the prototype role each is now. */
const WAS: Record<string, string> = { Admin: 'GSP · Admin', Admission: 'GSP · Admissions', 'Admission Ops': 'GSP · Admissions', Recruitment: 'GSP · Recruitment', 'Recruitment Ops': 'GSP · RP Ops', Institution: 'GSP · Institution', 'Institution Ops': 'GSP · Institution Ops', Finance: 'GSP · Finance' };
/** Not sent: added, no link yet; Link sent: waiting for them to set a password; Active: they've signed in;
 *  Deactivated (Nesil, 3 Nov): can't sign in until they're reactivated. */
export type UserStatus = 'Not sent' | 'Link sent' | 'Active' | 'Deactivated';
export type User = { id: string; name: string; email: string; dial: string; phone: string; role: GspRole; title: string; region: string; status: UserStatus; sentAt?: number };
const DAY = 86_400_000;
let seq = 0;
/** Several people with the same role, title and region, each with a phone number of their own (sample). */
const team = (role: GspRole, title: string, region: string, dial: string, names: string[]) =>
  names.map((name) => {
    const n = String(41000 + ++seq * 137).padStart(5, '0');
    return u(name, role, title, region, dial, dial === '+91' ? `98${n.slice(0, 3)} ${n.slice(1)}` : `${n.slice(0, 3)} ${n.slice(2)} ${n.slice(1, 4)}`);
  });
const u = (name: string, was: string, title: string, region: string, dial: string, phone: string, status: UserStatus = 'Active'): User => ({
  id: `u-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  name,
  email: `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@gsp.upgrad.com`,
  dial,
  phone,
  role: WAS[was] ?? was,
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
  u('Rohit Bansal', 'Admission', 'Admissions Officer', 'India', '+91', '98450 72093', 'Deactivated'),
  u('Riya Sen', 'Institution Ops', 'Course Data Analyst', 'Global', '+91', '98110 31188'),
  u('Arjun Mehta', 'Institution Ops', 'Course Data Analyst', 'Global', '+91', '98450 41022'),
  u('Lav Likhi', 'Finance', 'Commissions Manager', 'Global', '+91', '98110 60075'),
  // 5 Nov (Nesil's Queues reference): the people in each queue
  ...team('Admission', 'Admissions Officer', 'India', '+91', ['Alfiya Khan', 'Anand Mishra', 'Prachi Pilani', 'Sakshi Shashi', 'Prachi Sharma', 'Piyush Varshney']),
  ...team('Admission', 'Admissions Officer', 'Bangladesh', '+880', ['Humyra Rahman', 'Shabnaj Islam', 'Jannati Nusrat', 'Raihana Kabir Nishi', 'Nigara Rahman', 'Mahfuza Akter']),
  ...team('Admission', 'Admissions Officer', 'Nepal', '+977', ['Swornim Prajapati', 'Alisha Kapali', 'Niruta Dahal', 'Ashmita Shrestha', 'Lalita Baade']),
  ...team('Admission', 'Admissions Officer', 'Sri Lanka', '+94', ['Dasuni De Silva', 'Shevini Fernando', 'Rashmi Arora']),
  ...team('Admission', 'Admissions Officer', 'Vietnam', '+84', ['Le Minh Ngoc Nguyen', 'Nhung Thi Tuyet Dinh', 'Chi Dao', 'Hieu Ngan Do', 'Ngoc Mai']),
  ...team('Admission', 'Admissions Lead', 'Pakistan', '+92', ['Sabrina Hyder']),
  ...team('Admission', 'Admissions Officer', 'Pakistan', '+92', ['Dur E Kashaf Awan']),
  ...team('Admission', 'Admissions Lead', 'Australia', '+61', ['Caixia Qiu']),
  ...team('Admission', 'Admissions Officer', 'Australia', '+61', ['Afroza Khatun Moni', 'Meenu Mishra Dubey', 'Meetu Malhotra', 'Jihan Khansa Pradila']),
  ...team('Admission', 'Admissions Lead', 'Philippines', '+63', ['Kimberly Olaes']),
  ...team('Admission', 'Admissions Officer', 'Philippines', '+63', ['Leigh Penullar', 'Lyka Gutierrez', 'Ryn Enor']),
  ...team('Recruitment', 'BDM', 'Latin America and Europe', '+44', ['Maria Boscan']),
  ...team('Recruitment', 'BDM', 'China', '+86', ['Annie Gu']),
  ...team('Recruitment', 'BDM', 'Rest of world', '+92', ['Ali Butt']),
  ...team('Recruitment Ops', 'Partner Verification Officer', 'Global', '+91', ['Garima Bhardwaj', 'Rohan Desai', 'Nisha Kapoor']),
  ...team('Institution Ops', 'IP Ops Lead', 'Global', '+91', ['Gauri Bhardwaj']),
  ...team('Institution Ops', 'IP Ops Executive', 'Global', '+91', ['Vishakha Prabhakar', 'Neelam Sharma', 'Munmun Kapil', 'Kabir Sethi']),
  ...team('Finance', 'Finance Lead', 'Global', '+91', ['Suman Verma']),
  ...team('Finance', 'Commissions Executive', 'Global', '+91', ['Rhythm Jain', 'Pallavi Thakur', 'Nandini Sharma']),
  ...team('Finance', 'Commissions Executive', 'Global', '+63', ['Joana Cabrera', 'Arcelin Landayan']),
  ...team('Admin', 'Product Manager', 'Global', '+91', ['Jovial Lejo']),
];

/* ---------- permission roles × objects (PM: Settings › Permissions, decided 25 Oct; Nesil, 4 Nov: three levels) ---------- */
export const LEVELS = [
  ['N', 'No Access'],
  ['V', 'View'],
  ['E', 'View and Edit'],
] as const;
export type Level = (typeof LEVELS)[number][0];
/** The PM's six levels folded into the three (4 Nov): export goes with View or Edit, and Manage is View and Edit. */
const FOLD: Record<string, Level> = { N: 'N', V: 'V', VX: 'V', E: 'E', EX: 'E', M: 'E' };
export const ROLES = ['Admissions', 'Admissions Head', 'BAP', 'Data team', 'IP team', 'Recruitment (BDM)', 'Recruitment Head', 'Commissions & Finance', 'Super Admin', 'Leadership', 'RP admin', 'RP branch manager', 'RP counsellor', 'Master Partner admin'] as const;
/** Each object's level for each role, in ROLES' order (the PM's defaults, in its six levels). */
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
  Object.fromEntries(P.map(([o, ls]) => [o, Object.fromEntries(ls.split(' ').map((l, i) => [ROLES[i], FOLD[l]]))]));

/* ---------- queues (Nesil, 30 Oct: a name, a leader and members, from the PM's queues) ---------- */
/** A queue (Nesil, 5 Nov: Work › Queues, SLA and escalation): a team's inbox, with one leader, members (the leader
 *  is always in it), how its work is shared, and its type: each sales region has an Admissions and a Recruitment queue,
 *  and the teams have their own. What lands in it comes from Kinds of work. */
export type Queue = { id: string; name: string; lead: string; members: string[]; type: QueueType; region?: string; sharing: Sharing; note?: string };
const byName = (users: User[], names: string[]) => names.map((n) => users.find((x) => x.name === n)?.id).filter((x): x is string => !!x);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');
/** The regions with their own Admissions and Recruitment queues: every sales region but Direct and Global. */
const QUEUE_REGIONS = SALES_REGIONS.filter((r) => !['Direct', 'Global'].includes(r));
/** Each region's Admissions queue: its leader and members (Nesil's reference, 5 Nov). */
const ADMISSIONS: Record<string, [string, string[]]> = {
  India: ['Ramish', ['Alfiya Khan', 'Anand Mishra', 'Prachi Pilani', 'Sakshi Shashi', 'Prachi Sharma', 'Piyush Varshney', 'Rohit Bansal']],
  Bangladesh: ['Kamrun', ['Humyra Rahman', 'Shabnaj Islam', 'Jannati Nusrat', 'Raihana Kabir Nishi', 'Nigara Rahman', 'Mahfuza Akter']],
  Nepal: ['Supriya', ['Swornim Prajapati', 'Alisha Kapali', 'Niruta Dahal', 'Ashmita Shrestha', 'Lalita Baade']],
  'Sri Lanka': ['Subbhodya', ['Dasuni De Silva', 'Shevini Fernando', 'Rashmi Arora']],
  Vietnam: ['Truc', ['Thi Tuyet Hoa Nguyen', 'Le Minh Ngoc Nguyen', 'Nhung Thi Tuyet Dinh', 'Chi Dao', 'Hieu Ngan Do', 'Ngoc Mai']],
  Pakistan: ['Sabrina Hyder', ['Dur E Kashaf Awan']],
  'Indonesia, Malaysia and Thailand': ['Truc', []],
  'Myanmar and Bhutan': ['Truc', []],
  Australia: ['Caixia Qiu', ['Jo', 'Afroza Khatun Moni', 'Meenu Mishra Dubey', 'Meetu Malhotra', 'Jihan Khansa Pradila']],
  Philippines: ['Kimberly Olaes', ['Leigh Penullar', 'Lyka Gutierrez', 'Ryn Enor']],
  Africa: ['Kamrun', []],
  'Latin America and Europe': ['Valentina', []],
  China: ['Caixia Qiu', []],
};
/** Each region's Recruitment queue: its leader (the region's BDM) and members. */
const RECRUITMENT: Record<string, [string, string[]]> = {
  India: ['Saurabh', ['Nadia', 'Harsh', 'Aditya Rao']],
  Bangladesh: ['Sania', []],
  Nepal: ['Anil Shrestha', []],
  'Sri Lanka': ['Kanchani', []],
  Vietnam: ['Tina', []],
  Pakistan: ['Ali Butt', []],
  'Indonesia, Malaysia and Thailand': ['Tina', []],
  'Myanmar and Bhutan': ['Tina', []],
  Australia: ['Judy', []],
  Philippines: ['Arielle', []],
  Africa: ['Faisal', []],
  'Latin America and Europe': ['Camilo', ['Maria Boscan']],
  China: ['Annie Gu', []],
  'Rest of world': ['Ali Butt', []],
};
export const sampleQueues = (users: User[]): Queue[] => {
  const q = (id: string, name: string, type: QueueType, lead: string, members: string[], sharing: Sharing, region?: string, note?: string): Queue => ({ id, name, type, region, sharing, note, lead: byName(users, [lead])[0] ?? '', members: byName(users, members) });
  return [
    ...QUEUE_REGIONS.filter((r) => ADMISSIONS[r]).map((r) => q(`q-adm-${slug(r)}`, `${r} Admissions`, 'Admissions', ADMISSIONS[r][0], ADMISSIONS[r][1], 'fewest', r)),
    ...QUEUE_REGIONS.filter((r) => RECRUITMENT[r]).map((r) => q(`q-rec-${slug(r)}`, `${r} Recruitment`, 'Recruitment', RECRUITMENT[r][0], RECRUITMENT[r][1], 'owner', r)),
    q('q-rp-ops', 'RP Ops', 'Team', 'Leena Thomas', ['Garima Bhardwaj', 'Rohan Desai', 'Nisha Kapoor'], 'fewest'),
    q('q-ip-ops', 'IP Ops', 'Team', 'Gauri Bhardwaj', ['Vishakha Prabhakar', 'Neelam Sharma', 'Munmun Kapil', 'Kabir Sethi', 'Riya Sen', 'Arjun Mehta'], 'fewest'),
    q('q-finance', 'Finance', 'Team', 'Suman Verma', ['Rhythm Jain', 'Joana Cabrera', 'Arcelin Landayan', 'Lav Likhi', 'Pallavi Thakur', 'Nandini Sharma'], 'fewest'),
    q('q-admission-ops', 'Admission Ops', 'Team', 'Meera Pillai', ['Megha Malhotra'], 'leader', undefined, 'Level 2 escalations on applications'),
    q('q-admin', 'Admin', 'Team', 'Jovial Lejo', [], 'fewest', undefined, 'Tasks with no queue, and level 3 escalations'),
  ];
};

/* ---------- email groups (Nesil, 30 Oct): shared inboxes, and who can see or send from them ---------- */
export type EmailPerm = 'view' | 'send';
export type EmailGroup = { id: string; email: string; purpose?: string; sync: boolean; since: string; users: { id: string; perm: EmailPerm }[] };
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
export const sampleEmails = (users: User[]): EmailGroup[] => {
  const ids = (names: string[], send: string[] = []) => byName(users, names).map((id) => ({ id, perm: (byName(users, send).includes(id) ? 'send' : 'view') as EmailPerm }));
  return [
    { id: 'e1', email: 'admissions.india@gsp.upgrad.com', purpose: 'Application conversations with Indian RPs and universities', sync: true, since: iso(90), users: ids(['Megha Malhotra', 'Ramish', 'Meera Pillai'], ['Megha Malhotra', 'Ramish']) },
    { id: 'e2', email: 'admissions.vietnam@gsp.upgrad.com', purpose: 'Application conversations for Vietnam', sync: true, since: iso(60), users: ids(['Truc', 'Thi Tuyet Hoa Nguyen'], ['Truc']) },
    { id: 'e3', email: 'institutions@gsp.upgrad.com', purpose: 'Agreements and course updates from universities', sync: true, since: iso(120), users: ids(['Lalaine Dizon', 'Namita Nath', 'Raj Shamani', 'Kavya Menon'], ['Lalaine Dizon']) },
    { id: 'e4', email: 'partners@gsp.upgrad.com', purpose: 'Partner onboarding', sync: false, since: iso(0), users: ids(['Leena Thomas', 'Saurabh'], ['Leena Thomas']) },
    { id: 'e5', email: 'commissions@gsp.upgrad.com', purpose: 'Commission conversations', sync: true, since: iso(30), users: ids(['Lav Likhi'], ['Lav Likhi']) },
  ];
};

/* ---------- BDM assignment (PM: Settings › BDM assignment; Nesil, 4 Nov: state and city apart) ---------- */
/** `state` and `city` are lists (comma-separated), '' for none; neither: the whole country. "Rest of India" is a state. */
export type BdmRow = { id: string; country: string; state: string; city: string; bdm: string; fallback?: boolean };
let n = 0;
const row = (country: string, state: string, city: string, bdm: string, fallback = false): BdmRow => ({ id: `b${++n}`, country, state, city, bdm, fallback });
export const sampleBdm = (): BdmRow[] => [
  row('India', 'Kerala', '', 'Nadia'),
  row('India', 'Haryana, Delhi', '', 'Harsh'),
  row('India', 'Punjab', 'Ludhiana, Amritsar, Jalandhar', 'Ramandeep'),
  row('India', 'Karnataka, Andhra Pradesh, Telangana', '', 'Aditya'),
  row('India', 'Rest of India', '', 'Saurabh'),
  row('Bangladesh', '', 'Dhaka', 'Sania'),
  row('Bangladesh', 'Rest of Bangladesh', '', 'Faisal'),
  row('Vietnam', '', 'Ho Chi Minh City', 'Tina'),
  row('Vietnam', 'Rest of Vietnam', '', 'Hoang'),
  row('Philippines', '', '', 'Arielle'),
  row('Myanmar', '', '', 'Nilar'),
  row('Indonesia', '', '', 'Rifaldo'),
  row('Malaysia', '', '', 'Rifaldo'),
  row('Pakistan', '', '', 'Ali'),
  row('Latin America and Europe', '', '', 'Camilo'),
  row('Africa', '', '', 'Faisal'),
  row('Sri Lanka', '', '', 'Kanchani'),
  row('Nepal', '', '', 'Anil Shrestha'),
  row('Australia', '', '', 'Judy'),
  row('Thailand', '', '', 'Rifaldo'),
  row('Bhutan', '', '', 'Nilar'),
  row('China', '', '', 'Judy'),
  row('All other countries', '', '', 'Ali', true),
];
export const REGION_ROWS = ['Latin America and Europe', 'Africa'];

/* ---------- currency exchange (Nesil, 3 Nov): a week's rates, each currency in AUD, Finance's base ---------- */
export type FxRow = { code: string; name: string; aud: number; usedFor: string; updated: number; by: string };
/** A week's rates: each currency in AUD, and one AUD in rupees (the rupee column follows from it). */
export type FxWeek = { week: string; inrPerAud: number; rows: FxRow[] };
const CUR_NAME: Record<string, string> = { AUD: 'Australian dollar', GBP: 'Pound sterling', CAD: 'Canadian dollar', NZD: 'New Zealand dollar', EUR: 'Euro', USD: 'US dollar' };
/** The Monday a date's week starts on, as yyyy-mm-dd. */
export const weekOf = (t: number) => {
  const d = new Date(t);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
/** The last eight weeks, this one first; older weeks drift a little from course search's rates. */
export const sampleFx = (): FxWeek[] => {
  const dests = (code: string) => (Object.entries(CURRENCY) as [Destination, string][]).filter(([, c]) => c === code).map(([d]) => `Course search: ${d}`).join(', ');
  const codes = Object.keys(INR_PER);
  return Array.from({ length: 8 }, (_, w) => {
    const week = weekOf(Date.now() - w * 7 * DAY);
    const wiggle = (i: number) => 1 + (((w * 7 + i * 3) % 9) - 4) / 400;
    const inrPerAud = Math.round(INR_PER.AUD * (1 + ((w % 5) - 2) / 300) * 100) / 100;
    return {
      week,
      inrPerAud,
      rows: codes.map((code, i) => ({
        code,
        name: CUR_NAME[code] ?? code,
        aud: code === 'AUD' ? 1 : Math.round((INR_PER[code] / INR_PER.AUD) * wiggle(i) * 10_000) / 10_000,
        usedFor: dests(code),
        updated: Math.min(new Date(`${week}T12:06:00`).getTime() + (i % 3) * DAY, Date.now() - (i + 1) * 3_600_000),
        by: 'Lav Likhi',
      })),
    };
  });
};

/* ---------- living costs and fees (Nesil, 3 Nov): a year's living costs, the visa fee and a year's health cover;
   4 Nov: a country can be added, and within one, a city's own living costs ---------- */
/** A city's own living costs a year, in its country's currency. */
export type CityCost = { name: string; perYear: number };
/** `visa` and `health` are 0 when not set (a country added with its living costs only). */
export type Living = { country: string; currency: string; perYear: number; visa: number; health: number; basis: string; updated: number; by: string; cities: CityCost[] };
const city = (name: string, perYear: number): CityCost => ({ name, perYear });
export const sampleLiving = (): Living[] => [
  { country: 'Australia', currency: 'AUD', perYear: 29710, visa: 2000, health: 700, basis: 'Department of Home Affairs; OSHC providers', updated: Date.now() - 12 * DAY, by: 'Jovial Lejo', cities: [city('Sydney', 33000), city('Melbourne', 31000)] },
  { country: 'UK', currency: 'GBP', perYear: 12006, visa: 524, health: 776, basis: 'UKVI, 9 months outside London; Immigration Health Surcharge', updated: Date.now() - 30 * DAY, by: 'Jovial Lejo', cities: [city('London', 13347)] },
  { country: 'Canada', currency: 'CAD', perYear: 20635, visa: 235, health: 900, basis: 'IRCC, study permit; provincial health plans', updated: Date.now() - 40 * DAY, by: 'Jovial Lejo', cities: [city('Toronto', 24000), city('Vancouver', 24500)] },
  { country: 'New Zealand', currency: 'NZD', perYear: 20000, visa: 850, health: 700, basis: 'Immigration New Zealand', updated: Date.now() - 55 * DAY, by: 'Jovial Lejo', cities: [] },
  { country: 'Ireland', currency: 'EUR', perYear: 12000, visa: 300, health: 500, basis: 'Irish Immigration Service', updated: Date.now() - 60 * DAY, by: 'Jovial Lejo', cities: [city('Dublin', 14500)] },
  { country: 'USA', currency: 'USD', perYear: 18000, visa: 535, health: 2500, basis: 'US Department of State; university health plans', updated: Date.now() - 70 * DAY, by: 'Jovial Lejo', cities: [] },
];

/* ---------- course tags, program levels and study areas (Nesil, 3 Nov) ---------- */
/** `was`: its earlier names, so a renamed tag still counts its courses. */
export type Tag = { name: string; on: boolean; was?: string[] };
export const sampleTags = (names: readonly string[]): Tag[] => names.map((name) => ({ name, on: true }));
/** 6 Nov (Nesil): no application form level any more. `was`: its earlier names, so a renamed level or area still counts its courses. */
export type ProgramLevel = { name: string; on: boolean; was?: string[] };
export const sampleLevels = (): ProgramLevel[] => PROGRAM_LEVELS.map((name) => ({ name, on: true }));
export type StudyArea = { name: string; on: boolean; was?: string[] };
export const sampleAreas = (): StudyArea[] => AREAS.map((name) => ({ name, on: true }));

/* ---------- grade conversion and English test equivalence (Nesil, 3 Nov, after the reference screens) ---------- */
/** How a grading system becomes a percentage: as it is, times a number, or grade by grade. */
export const GRADE_METHODS = ['As is', 'Multiplier', 'Bands'] as const;
export type GradeMethod = (typeof GRADE_METHODS)[number];
export type Band = { grade: string; pct: number };
export type GradeSystem = { id: string; name: string; countries: string[]; method: GradeMethod; factor?: number; bands?: Band[]; on: boolean };
const gs = (name: string, countries: string[], method: GradeMethod, values?: number | Band[]): GradeSystem => ({
  id: `g-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name,
  countries,
  method,
  factor: typeof values === 'number' ? values : undefined,
  bands: Array.isArray(values) ? values : undefined,
  on: true,
});
const b = (grade: string, pct: number): Band => ({ grade, pct });
export const sampleGrades = (): GradeSystem[] => [
  gs('Percentage', ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka'], 'As is'),
  gs('CGPA out of 10', ['India'], 'Multiplier', 9.5),
  gs('GPA out of 4', ['Nepal', 'United States'], 'Multiplier', 25),
  gs('GPA out of 5', ['Bangladesh'], 'Bands', [b('5.00', 80), b('4.00', 70), b('3.50', 60), b('3.00', 50)]),
  gs('Division', ['India', 'Pakistan'], 'Bands', [b('First', 60), b('Second', 45), b('Third', 33)]),
  gs('UK degree class', ['United Kingdom', 'Sri Lanka'], 'Bands', [b('First', 70), b('2:1', 60), b('2:2', 50), b('Third', 40)]),
  gs('10-point scale', ['Vietnam'], 'Multiplier', 10),
  gs('GWA, 1.0 to 5.0', ['Philippines'], 'Bands', [b('1.0', 97), b('1.5', 91), b('2.0', 85), b('2.5', 80), b('3.0', 75)]),
];
/** A row of equal scores, one a test. */
export const ENGLISH_TESTS = [
  ['ielts', 'IELTS Academic'],
  ['toefl', 'TOEFL iBT'],
  ['pte', 'PTE Academic'],
  ['duolingo', 'Duolingo English Test'],
] as const;
export type EnglishRow = { id: string; ielts: number; toefl: number; pte: number; duolingo: number };
export const sampleEnglish = (): EnglishRow[] =>
  (
    [
      [5.5, 46, 42, 95],
      [6.0, 60, 50, 105],
      [6.5, 79, 58, 115],
      [7.0, 94, 65, 125],
      [7.5, 102, 73, 135],
    ] as const
  ).map(([ielts, toefl, pte, duolingo], i) => ({ id: `en${i + 1}`, ielts, toefl, pte, duolingo }));

/* ---------- application routing (PM: Settings › Application routing) ---------- */
export type RouteRule = { id: 'direct' | 'list' | 'keep' | 'onshore' | 'nat' | 'fb'; title: string; when: string; region: string; bdm: string; on: boolean };
export const sampleRules = (): RouteRule[] => [
  { id: 'direct', title: 'Direct application', when: 'The application has no RP (the student applied to GSP directly).', region: 'Direct', bdm: 'Direct region default BDM', on: true },
  { id: 'list', title: 'RP is on a regional list', when: 'The RP is on one of the regional RP lists. Every application from that RP goes to the list’s region, onshore included. Nationality is not used.', region: 'The list’s region', bdm: 'The RP’s BDM', on: true },
  { id: 'keep', title: 'Onshore, RP has no Australian branch', when: 'Onshore application, the RP’s sales region is Vietnam or Latin America and Europe, and the RP has no branch in Australia.', region: 'The RP’s own region', bdm: 'The RP’s BDM', on: true },
  { id: 'onshore', title: 'Onshore application', when: 'The student’s current country is Australia and the destination is Australia.', region: 'Australia', bdm: 'Judy (region default)', on: true },
  { id: 'nat', title: 'Student’s nationality', when: 'The student’s nationality is mapped to a region (Sales Regions › Nationality Map).', region: 'The nationality’s region', bdm: 'That region’s default BDM', on: true },
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
/** The nationalities the test offers; their regions come from the Nationality Map (Sales Regions, 4 Nov). */
export const TEST_NATIONALITIES = ['India', 'Nepal', 'Bangladesh', 'Sri Lanka', 'Pakistan', 'Vietnam', 'Philippines', 'China', 'Indonesia', 'Malaysia', 'Thailand', 'Myanmar', 'Bhutan', 'Nigeria', 'Kenya', 'Ghana', 'Brazil', 'Colombia', 'Germany', 'United Arab Emirates', 'Canada', 'United States'];
export const DESTINATIONS = ['Australia', 'United Kingdom', 'Canada', 'United States', 'New Zealand', 'Ireland'];

/** Runs the rules from the top: the first that matches sets the region and BDM (PM: routing with its trace). */
export function route(rules: RouteRule[], lists: Record<string, string[]>, a: { rp: string; nationality: string; now: string; dest: string }, nationalities: Record<string, string>) {
  const rp = ROUTING_RPS.find((r) => r.name === a.rp);
  const listRegion = rp && Object.entries(lists).find(([, l]) => l.includes(rp.name))?.[0];
  const onshore = a.now === 'Australia' && a.dest === 'Australia';
  const test: Record<RouteRule['id'], () => { region: string; bdm: string; why: string } | null> = {
    direct: () => (!rp ? { region: 'Direct', bdm: REGION_BDM.Direct ?? 'Not set', why: 'No RP: the student applied to GSP directly' } : null),
    list: () => (listRegion ? { region: listRegion, bdm: rp!.bdm, why: `${rp!.name} is on the ${listRegion} list` } : null),
    keep: () => (rp && onshore && ['Vietnam', 'Latin America and Europe'].includes(rp.region) && !rp.auBranch ? { region: rp.region, bdm: rp.bdm, why: `Onshore, and ${rp.name} (${rp.region}) has no Australian branch` } : null),
    onshore: () => (onshore ? { region: 'Australia', bdm: REGION_BDM.Australia, why: 'The student is in Australia and applying to Australia' } : null),
    nat: () => (nationalities[a.nationality] ? { region: nationalities[a.nationality], bdm: REGION_BDM[nationalities[a.nationality]] ?? 'Not set', why: `${a.nationality} maps to ${nationalities[a.nationality]} on the Nationality Map` } : null),
    fb: () => ({ region: 'Direct', bdm: 'Not set', why: nationalities[a.nationality] ? 'Nothing above matched' : `Nothing above matched (${a.nationality} isn’t on the Nationality Map)` }),
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
/**
 * An application document rule. 4 Nov (Nesil): when it applies is four lists, each picked from several (an empty one
 * is any): the **program levels**, the **study areas**, the **university's country** and the **student's current
 * country**; `note` is a condition the team checks by hand (the university has its own form).
 */
export type DocRule = { id: string; doc: string; stage: (typeof STAGES)[number]; levels: string[]; areas: string[]; uni: string[]; now: string[]; note?: string; setting: 'Mandatory' | 'Optional'; by: 'RP' | 'GSP'; on: boolean };
/** The universities' countries a rule can name. */
export const DOC_UNI_COUNTRIES = ['Australia', 'UK', 'Canada', 'USA', 'New Zealand', 'Ireland', 'Malaysia'];
type When = Partial<Pick<DocRule, 'levels' | 'areas' | 'uni' | 'now' | 'note'>>;
let d = 0;
const dr = (doc: string, stage: DocRule['stage'], when: When, setting: DocRule['setting'], by: DocRule['by']): DocRule => ({ id: `d${++d}`, doc, stage, levels: [], areas: [], uni: [], now: [], ...when, setting, by, on: true });
const PG_UP = ['Postgraduate diploma', 'Master’s degree', 'PhD or research'];
export const sampleDocRules = (): DocRule[] => [
  dr('Passport', 'New', {}, 'Mandatory', 'RP'),
  dr('Class 10 marksheet', 'New', {}, 'Mandatory', 'RP'),
  dr('Class 12 marksheet', 'New', {}, 'Mandatory', 'RP'),
  dr('UG degree and transcripts', 'New', { levels: PG_UP }, 'Mandatory', 'RP'),
  dr('PG degree and transcripts', 'New', { levels: ['PhD or research'] }, 'Mandatory', 'RP'),
  dr('SOP', 'New', { uni: ['UK'] }, 'Mandatory', 'RP'),
  dr('LORs', 'New', { uni: ['UK'] }, 'Mandatory', 'RP'),
  dr('University application form, filled', 'New', { note: 'The university has its own form' }, 'Mandatory', 'RP'),
  dr('IP transfer proof', 'New', { uni: ['Australia'], now: ['Australia'] }, 'Optional', 'RP'),
  dr('RPL proof', 'New', { uni: ['Australia'], now: ['Australia'] }, 'Optional', 'RP'),
  dr('Conditional offer letter', 'Offer', {}, 'Mandatory', 'GSP'),
  dr('Financial documents', 'Verification', {}, 'Optional', 'RP'),
  dr('GS outcome', 'Verification', { uni: ['Australia'] }, 'Mandatory', 'GSP'),
  dr('Unconditional offer letter', 'Offer', {}, 'Mandatory', 'GSP'),
  dr('Pre-visa approval (AIP / EMGS)', 'Acceptance', { uni: ['New Zealand', 'Malaysia'] }, 'Mandatory', 'RP'),
  dr('Deposit receipt', 'Acceptance', {}, 'Mandatory', 'RP'),
  dr('Acceptance letter (CoE, CAS, I-20, LOA and PAL)', 'Acceptance', {}, 'Mandatory', 'GSP'),
  dr('Visa lodgement proof', 'Visa', {}, 'Mandatory', 'RP'),
  dr('Visa outcome', 'Visa', {}, 'Mandatory', 'RP'),
  dr('Proof of enrolment', 'Enrolled', {}, 'Mandatory', 'GSP'),
];
const the = (c: string) => (c === 'UK' || c === 'USA' ? `the ${c}` : c);
const or = (l: string[]) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} or ${l[l.length - 1]}`);
/** When a rule applies, as the table reads it: "Program level: Master’s degree; University in the UK", or Always. */
export const whenText = (r: DocRule) =>
  [
    r.levels.length && `Program level: ${r.levels.join(', ')}`,
    r.areas.length && `Study area: ${r.areas.join(', ')}`,
    r.uni.length && `University in ${or(r.uni.map(the))}`,
    r.now.length && `Student now in ${or(r.now.map(the))}`,
    r.note,
  ]
    .filter(Boolean)
    .join('; ') || 'Always';
const any = (l: string[], v: string) => !l.length || l.includes(v);
/** Whether a rule asks an application for its document: each list it sets must hold the application's value. */
export const docRuleApplies = (r: DocRule, a: { level: string; area: string; uni: string; now: string }) => r.on && any(r.levels, a.level) && any(r.areas, a.area) && any(r.uni, a.uni) && any(r.now, a.now);

/**
 * Request categories (Nesil, 4 Nov): what GSP asks a recruitment partner for on an application, from the requests GSP
 * already makes: a document it needs (the chat's Request document), more the university asks for (Additional
 * documents requested), an offer's conditions (Request conditions), an assessment or interview, the tuition or deposit
 * payment, and the visa lodgement proof.
 */
export const sampleCategories = (): string[] => ['Missing document', 'Additional documents for the university', 'Offer conditions', 'University assessment or interview', 'Tuition or deposit receipt', 'Visa lodgement proof'];
export type RpDocRule = { id: string; applies: 'Only these countries' | 'All countries except' | 'All countries'; countries: string[]; docs: string[] };
export const sampleRpDocs = (): RpDocRule[] => [
  { id: 'r1', applies: 'Only these countries', countries: ['India'], docs: ['Business registration certificate', 'PAN card', 'GST certificate (if registered)'] },
  { id: 'r2', applies: 'All countries except', countries: ['India'], docs: ['Business registration certificate', 'Company profile', 'Owner’s ID', 'Reference (name, email, phone)'] },
];

/* ---------- logs (PM: Download log; plus every change here; Nesil, 4 Nov: who by email, and each one's sales
   region) ---------- */
const at = (daysAgo: number, h: number, m: number) => {
  const x = new Date(Date.now() - daysAgo * DAY);
  x.setHours(h, m, 0, 0);
  return x.getTime();
};
const JOVIAL = { who: 'Jovial Lejo', email: 'jovial.lejo@gsp.upgrad.com', role: 'Super Admin', region: 'Global' };
const MEGHA = { who: 'Megha Malhotra', email: 'megha.malhotra@gsp.upgrad.com', role: 'Admissions Head', region: 'India' };
const RAMISH = { who: 'Ramish', email: 'ramish@gsp.upgrad.com', role: 'Admissions', region: 'India' };
const KAMRUN = { who: 'Kamrun', email: 'kamrun@gsp.upgrad.com', role: 'Admissions', region: 'Bangladesh' };
const TRUC = { who: 'Truc', email: 'truc@gsp.upgrad.com', role: 'Admissions', region: 'Vietnam' };
const ANANYA = { who: 'Ananya Rao', email: 'ananya@horizonoverseas.in', role: 'RP admin', region: 'India' };
const LAN = { who: 'Lan Nguyen', email: 'lan@saigonbridge.vn', role: 'RP admin', region: 'Vietnam' };
const LAV = { who: 'Lav Likhi', email: 'lav.likhi@gsp.upgrad.com', role: 'Commissions & Finance', region: 'Global' };
const LALAINE = { who: 'Lalaine Dizon', email: 'lalaine.dizon@gsp.upgrad.com', role: 'IP team', region: 'Global' };
const RIYA = { who: 'Riya Sen', email: 'riya.sen@gsp.upgrad.com', role: 'Data team', region: 'Global' };
const SAURABH = { who: 'Saurabh', email: 'saurabh@gsp.upgrad.com', role: 'Recruitment Head', region: 'India' };
const TINA = { who: 'Tina', email: 'tina@gsp.upgrad.com', role: 'Recruitment (BDM)', region: 'Vietnam' };
const LEENA = { who: 'Leena Thomas', email: 'leena.thomas@gsp.upgrad.com', role: 'BAP', region: 'Global' };
const dl = (id: string, t: number, p: typeof JOVIAL, area: string, text: string, records: number, format: string, filters: string): LogEntry => ({ id, at: t, ...p, area, text, kind: 'download', records, format, filters });
export const sampleLog = (): LogEntry[] => [
  { id: 'l1', at: Date.now() - 3 * 3_600_000, ...JOVIAL, area: 'BDM assignment', text: 'Edited India · Kerala → Nadia', kind: 'change' },
  dl('l2', at(0, 10, 12), RAMISH, 'Applications', 'Applications list', 46, 'CSV', 'India · Ready to submit'),
  dl('l3', at(0, 9, 30), TRUC, 'Students', 'Students list', 128, 'CSV', 'Vietnam · Added this month'),
  dl('l4', at(1, 16, 5), SAURABH, 'Recruitment partners', 'Recruitment partners', 214, 'CSV', 'India · Agreement signed'),
  dl('l5', at(1, 12, 41), MEGHA, 'Applications', 'Applications list', 312, 'CSV', 'India · With university'),
  dl('l6', at(1, 11, 2), ANANYA, 'Course search', 'Course shortlist', 8, 'CSV', '8 courses · 6 fields'),
  dl('l7', at(1, 9, 48), TINA, 'Recruitment partners', 'Recruitment partners', 37, 'CSV', 'Vietnam'),
  dl('l8', at(2, 18, 20), LAV, 'Commissions', 'Confirmed commissions', 1204, 'XLSX', 'Oct 2026'),
  { id: 'l9', at: at(2, 15, 5), ...JOVIAL, area: 'Application routing', text: 'Moved “Onshore, RP has no Australian branch” above “Onshore application”', kind: 'change' },
  dl('l10', at(2, 10, 15), LALAINE, 'Universities', 'Universities', 86, 'CSV', 'Australia'),
  dl('l11', at(2, 9, 2), KAMRUN, 'Applications', 'Applications list', 58, 'CSV', 'Bangladesh · Offer'),
  dl('l12', at(3, 17, 22), RIYA, 'Courses', 'Courses', 2410, 'CSV', 'Live courses'),
  { id: 'l13', at: at(3, 16, 40), ...JOVIAL, area: 'Permission roles', text: 'Recruitment Head: RP branches and team → View and Edit', kind: 'change' },
  dl('l14', at(3, 11, 18), LAN, 'Course search', 'Course comparison', 4, 'PDF', '4 courses'),
  dl('l15', at(4, 15, 51), LEENA, 'Recruitment partners', 'Partners to verify', 19, 'CSV', 'Documents to check'),
  dl('l16', at(4, 12, 7), LAV, 'Commissions', 'Payout statement', 342, 'XLSX', 'Sep 2026'),
  dl('l17', at(5, 14, 33), ANANYA, 'Students', 'Students list', 64, 'CSV', 'Horizon Overseas'),
  dl('l18', at(5, 10, 40), MEGHA, 'Students', 'Students list', 590, 'CSV', 'India'),
  dl('l19', at(6, 16, 12), RIYA, 'Universities', 'Universities', 312, 'CSV', 'All countries'),
  dl('l20', at(6, 11, 25), TRUC, 'Applications', 'Applications list', 77, 'CSV', 'Vietnam · Visa'),
  dl('l21', at(7, 17, 3), SAURABH, 'Applications', 'Applications list', 940, 'XLSX', 'India · This intake'),
  dl('l22', at(8, 9, 55), LALAINE, 'Courses', 'Courses', 1180, 'CSV', 'UK'),
  dl('l23', at(9, 13, 16), KAMRUN, 'Students', 'Students list', 210, 'CSV', 'Bangladesh'),
  { id: 'l24', at: at(10, 12, 0), ...JOVIAL, area: 'Sales regions', text: 'Edited Vietnam: BDM contact Tina', kind: 'change' },
];
