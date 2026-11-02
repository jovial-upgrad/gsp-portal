/**
 * What GSP Admin configures (Nesil, 30 Oct). Taken from the PM prototype's Super Admin › Settings wherever it has
 * them (sales regions, permissions, queues, Recruitment assignment, application routing, document rules, the download log);
 * the currency exchange, living costs and filters tables aren't in it, so they're built from the figures this
 * prototype already uses (course search's rates, the course dialog's visa figures, course search's filters).
 * Every change is logged (`log`), and Logs shows them with the download log. Sample data.
 */
import { CURRENCY, type Destination } from '../../data/courses';
import COMM from '../../finance/comm.json';
import { STAFF, label, nameOf } from '../../data/staff';
/** A GSP person's name, by the start of their email: N('ramish.jafery'). Throws if they're not on the staff list. */
const N = (local: string) => nameOf(`${local}@upgrad.com`);

/**
 * One audit log entry (PRD slice 1, Audit). Kinds: a Change (any setting saved, a user created or changed, a login
 * email sent, a Fetch with AI run), a Download (any export), a Job run (slice 4's daily jobs) and an Email (every
 * email sent). Kept forever; nobody edits or deletes one. `role` is the actor's role at the time.
 */
export type LogEntry = {
  id: string;
  at: number;
  who: string;
  area: string;
  text: string;
  kind: 'change' | 'download' | 'job' | 'email';
  role?: string;
  filters?: string;
  size?: string;
  format?: string;
  /** Job runs: when it ended, records checked and changed, emails sent, any error with its record. */
  end?: number;
  checked?: number;
  changed?: number;
  sent?: number;
  error?: string;
  /** Emails: to whom, about which record, Amazon SES's message id, delivered or bounced. */
  to?: string;
  record?: string;
  ses?: string;
  delivered?: boolean;
};

/* ---------- sales regions (PM: Settings › Sales regions and Admissions contacts) ---------- */
/**
 * A sales region (Jovial, 1 Nov, HC38/HC42/HC48/HC50): Admin › Sales regions is the only list of sales regions
 * anywhere, and each region keeps the countries it's made of (editable there). Every country list by region in the
 * prototype reads this one.
 */
/** `calendarId`: the region's working calendar (Admin › Work › Working days, work/calendars.ts); the same setting as Sales regions' Working calendar picker. */
export type Region = { name: string; contact: string; countries: string[]; calendarId?: string };
/** The three system regions (PRD slice 1): no Delete; their names and countries are fixed. */
export const SYSTEM_REGIONS = ['Rest of world', 'Direct', 'Global'];
export const isSystemRegion = (name: string) => SYSTEM_REGIONS.includes(name);
/** The sales regions as the slice 1 PRD seeds them (17), in order: the seed for Admin › Sales regions. */
const SEED_REGION_NAMES = ['India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Vietnam', 'Pakistan', 'Indonesia Malaysia & Thailand', 'Myanmar', 'Bhutan', 'Australia', 'Philippines', 'Africa', 'Latin America & Europe', 'China', 'Rest of world', 'Direct', 'Global'];
/**
 * Countries that make up a region, where it isn't the country itself, as the PRD's seed table lists them (named as
 * the country list names them: Cape Verde, Cote D'Ivoire (Ivory Coast), Swaziland, The Gambia, Czech Republic,
 * Sao Tome and Principe). Non-EU Europe (UK, Switzerland, Norway…) is in Latin America & Europe; the Caribbean stays Rest of world;
 * North Africa stays Africa (S1C-6).
 */
const SEED_COUNTRIES: Record<string, string[]> = {
  'Indonesia Malaysia & Thailand': ['Indonesia', 'Malaysia', 'Thailand'],
  Africa: ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cape Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros', 'Congo', "Cote D'Ivoire (Ivory Coast)", 'Democratic Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Swaziland', 'Ethiopia', 'Gabon', 'The Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'],
  'Latin America & Europe': [
    'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Costa Rica', 'Cuba', 'Dominican Republic', 'Ecuador', 'El Salvador', 'Guatemala', 'Haiti', 'Honduras', 'Mexico', 'Nicaragua', 'Panama', 'Paraguay', 'Peru', 'Uruguay', 'Venezuela',
    'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
    // non-EU Europe (S1C-6)
    'United Kingdom', 'Switzerland', 'Norway', 'Iceland', 'Liechtenstein', 'Andorra', 'Monaco', 'San Marino', 'Vatican City State (Holy See)', 'Albania', 'Bosnia and Herzegovina', 'Kosovo', 'Macedonia', 'Montenegro', 'Serbia', 'Moldova', 'Ukraine', 'Belarus',
  ],
  // every country not in another region; students who apply without an RP; GSP people who cover every region
  'Rest of world': [],
  Direct: [],
  Global: [],
};
/** Each region's Admissions contact (Jovial's sheet, 31 Oct). */
const CONTACT: Record<string, string> = {
  India: N('ramish.jafery'), Bangladesh: N('kamrun.nahar'), Nepal: N('supriya.shrestha'), 'Sri Lanka': N('subodya.suraweera'), Vietnam: N('truc.nguyen'), Pakistan: N('sabrina.hyder'),
  'Indonesia Malaysia & Thailand': N('truc.nguyen'), Myanmar: N('truc.nguyen'), Bhutan: N('truc.nguyen'), Australia: N('jo.qiu'), Philippines: N('kimberly.olaes'), Africa: N('kamrun.nahar'),
  'Latin America & Europe': N('valentina.castillo'), China: N('jo.qiu'), 'Rest of world': N('tasha.tandon'), Direct: N('tasha.tandon'), Global: N('tasha.tandon'),
};
export const sampleRegions = (): Region[] => SEED_REGION_NAMES.map((name) => ({ name, contact: CONTACT[name] ?? '', countries: SEED_COUNTRIES[name] ?? [name] }));
/** Regions with no countries of their own: what they stand for, said where the countries would be. */
export const REGION_MEANS: Record<string, string> = { 'Rest of world': 'Every country not in another region', Direct: 'Students who apply to GSP without a recruitment partner', Global: 'Every region: for GSP people who cover them all' };
/** Nationality to sales region (Jovial, 1 Nov, HC42): editable on Admin › Sales regions. Seeded from the regions' countries; UAE, Canada and the US go to Rest of world (31 Oct). */
export const sampleNationality = (): Record<string, string> => ({
  ...Object.fromEntries(sampleRegions().flatMap((r) => r.countries.map((c) => [c, r.name]))),
  'United Arab Emirates': 'Rest of world', Canada: 'Rest of world', 'United States': 'Rest of world',
});
/** When each nationality's row was last changed (system): the seed's day for the seeded rows. */
export const sampleNationalityChanged = (): Record<string, number> => Object.fromEntries(Object.keys(sampleNationality()).map((k) => [k, Date.parse('2026-11-01T09:00:00+05:30')]));

/**
 * Admin's settings as they are now, for the few readers that can't wait for the store (admin/data/store.ts sets
 * `live.cfg` as it loads). Before then, the seeds.
 */
export const live: { cfg?: () => { regions: Region[]; nationality: Record<string, string>; regionQueue: Record<string, string>; queues: Queue[]; lists: Record<string, string[]> } | null } = {};
/** A record that always reads the current value (a nationality map that follows Admin's edits). */
function liveRecord<T>(get: () => Record<string, T>): Record<string, T> {
  return new Proxy({} as Record<string, T>, {
    get: (_, k) => (typeof k === 'string' ? get()[k] : undefined),
    has: (_, k) => typeof k === 'string' && k in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_, k) => {
      const o = get();
      return typeof k === 'string' && k in o ? { value: o[k], enumerable: true, configurable: true, writable: false } : undefined;
    },
  });
}
/** Nationality to sales region, as Admin › Sales regions has it now. */
export const NATIONALITY: Record<string, string> = liveRecord(() => live.cfg?.()?.nationality ?? sampleNationality());
/** Countries that make up each sales region, as Admin › Sales regions has them now (one map for every country list by region). */
export const REGION_COUNTRIES: Record<string, string[]> = liveRecord(() => Object.fromEntries((live.cfg?.()?.regions ?? sampleRegions()).map((r) => [r.name, r.countries ?? []])));
/** The sales region names, as Admin › Sales regions has them now. */
/**
 * Where a place is (S1F-2 proposal, 3 Nov): the sales region whose Countries list the country, else Rest of world.
 * An RP's head office and each branch read this; only a student's nationality reads the Nationality map.
 */
export const placeRegion = (country: string): string => {
  const c = ({ UK: 'United Kingdom', USA: 'United States' } as Record<string, string>)[country] ?? country;
  return Object.entries(REGION_COUNTRIES).find(([, list]) => list.includes(c))?.[0] ?? 'Rest of world';
};
export const salesRegionNames = () => (live.cfg?.()?.regions ?? sampleRegions()).map((r) => r.name);
/** The regions a queue or a routing can point to (not Global, which only GSP people cover). */
export const workRegions = (rs: Region[]) => rs.filter((r) => r.name !== 'Global' && r.name !== 'Direct');

/* ---------- GSP users and their roles (Nesil, 30 Oct: Create roles; people from the PM's samples) ---------- */
/** The roles a GSP user can have (Nesil's list). */
export const GSP_ROLES = ['Admin', 'Admission', 'Global Ops', 'Recruitment', 'RP Ops', 'Institution', 'IP Ops', 'Finance', 'View Only'] as const;
export type GspRole = (typeof GSP_ROLES)[number];
/**
 * Login status (PRD slice 1, GSP users): Link sent (created; the login email's link works for 7 days), Active (has
 * signed in at least once), Deactivated (can't sign in; kept for history).
 */
export type UserStatus = 'Link sent' | 'Active' | 'Deactivated';
/**
 * A GSP user (PRD slice 1). `id` is stable (never the email). `role` is '' only while a new user is being created.
 * No Area field (Jovial, S1C-3): every Recruitment user has just their sales regions; where someone is the default
 * recruitment contact for a state or city is a setting (Admin › Recruitment assignment), not part of the user.
 */
export type User = {
  id: string;
  name: string;
  email: string;
  dial: string;
  phone: string;
  role: GspRole;
  title: string;
  region: string;
  regions: string[];
  status: UserStatus;
  /** When the current login email went out (Link sent). */
  sentAt?: number;
  createdAt?: number;
  lastSignIn?: number;
  deactivatedAt?: number;
};
const DAY = 86_400_000;
/** How long the Set up your account link works. */
export const LINK_DAYS = 7;
/** A Link sent user's link has run out. */
export const linkExpired = (u: Pick<User, 'status' | 'sentAt'>, now = Date.now()) => u.status === 'Link sent' && !!u.sentAt && now - u.sentAt > LINK_DAYS * DAY;
/**
 * Whether a Set up your account link opens the new-password step (S1C-5): only for a Link sent user whose link is the
 * latest one sent and hasn't run out. Deactivating someone revokes their link at once (BR-9, NFR-4): it opens the
 * expired step even after they're reactivated, since Reactivate sends a new link.
 */
export const linkWorks = (u: Pick<User, 'status' | 'sentAt'> | undefined, issuedAt?: number, now = Date.now()) =>
  !!u && u.status === 'Link sent' && !!u.sentAt && (issuedAt == null || issuedAt === u.sentAt) && !linkExpired(u, now);
/** A seeded day and hour, so the samples read the same every day of the review. */
const daysAgo = (d: number, h = 10) => Date.now() - d * DAY - (h % 24) * 3_600_000;
/** Seeded login states, to show each (the rest have signed in): new users waiting, one link about to run out, one run out, one deactivated. */
const SEED_STATE: Record<string, Partial<User>> = {
  'prakriti.nanda@upgrad.com': { status: 'Link sent', sentAt: daysAgo(2) },
  'riya1.shah@upgrad.com': { status: 'Link sent', sentAt: daysAgo(6, 14) },
  'khushal.doriya@upgrad.com': { status: 'Link sent', sentAt: daysAgo(9) },
  'dzung.hoang@upgrad.com': { status: 'Deactivated', deactivatedAt: Date.parse('2026-10-24T11:00:00+05:30') },
};
/** GSP's people: every user comes from the staff list (data/staff.ts, Jovial's export of 31 Oct). The export has no phone numbers or titles. */
export const sampleUsers = (): User[] =>
  STAFF.map((s, i): User => {
    const seed = SEED_STATE[s.email] ?? {};
    const status = seed.status ?? 'Active';
    return {
      id: s.id, name: label(s), email: s.email, dial: s.dial, phone: s.phone, role: s.role, title: s.title, region: s.regions.join(', '), regions: s.regions, status,
      createdAt: status === 'Link sent' ? seed.sentAt : Date.parse('2026-10-31T18:00:00+05:30') - (i % 40) * DAY,
      lastSignIn: status === 'Active' ? daysAgo(i % 9, 9 + (i % 8)) : status === 'Deactivated' ? Date.parse('2026-10-22T16:40:00+05:30') : undefined,
      ...seed,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

/* ---------- permission roles × objects (PRD slice 1, Permission model) ---------- */
/** Three levels: No access (—), View, and View + edit (Edit). */
export const LEVELS = [
  ['N', 'No access'],
  ['V', 'View'],
  ['E', 'View + edit'],
] as const;
export type Level = (typeof LEVELS)[number][0];
/** The matrix's short words for each level (—, View, Edit). */
export const LEVEL_SHORT: Record<Level, string> = { N: '—', V: 'View', E: 'Edit' };
/** GSP's nine roles, fixed in code, in the PRD matrix's order. */
export const ROLES = ['Admin', 'Admission', 'Global Ops', 'Recruitment', 'RP Ops', 'Institution', 'IP Ops', 'Finance', 'View Only'] as const;
const COLS = ROLES;
/** Each object's level for each role, in the order of ROLES: the PRD's matrix as set on 1 Nov (Jovial's Permissions tab). */
const P: [string, string][] = [
  ['Students', 'E E E V V V V V V'],
  ['Student documents', 'E E E V V V V V V'],
  ['Applications', 'E E E V V V V V V'],
  ['Application documents and checks', 'E E E V V V V V V'],
  ['Drafts to universities and placed emails', 'E E E V V V V V V'],
  ['Chat threads', 'E E E E E V V V V'],
  ['Recruitment partner profile and status', 'E V V E E V V V V'],
  ['RP onboarding documents', 'E N N V E N N V V'],
  ['Documents issued to RPs', 'E N N V E N N E V'],
  ['RP branches and team', 'E N N E E V V V V'],
  ['Master Partners', 'E N N V E V V V V'],
  ['Institution partners', 'E V V V V E V V V'],
  ['IP documents and IP changes', 'E N N N N E V V V'],
  ['Universities', 'E V V V V E E V V'],
  ['University portal logins', 'E V E N N E E V V'],
  ['Campuses', 'E V V N N E E V V'],
  ['Admission requirements', 'E V E N N E E V V'],
  ['Announcements', 'E V E N N E E V V'],
  ['University microsites', 'E V V V V E E V V'],
  ['Courses, intakes and entry rules', 'E V V V V E E V V'],
  ['Commission terms', 'E N N V V V V E V'],
  ['Commission lines', 'E N N N N N N E V'],
  ['Invoices and receipts', 'E N N V N N N E V'],
  ['Payout runs and statements', 'E N N V N N N E V'],
  ['RP bank details', 'E N N V E N N E V'],
  ['Overview dashboard', 'E V V V V V V V V'],
  ['GSP users and roles', 'E N N N N N N N V'],
  ['Settings', 'E N N N N N N N V'],
  ['Download log and audit logs', 'E N N N N N N N V'],
  ['My work and tasks', 'E E E E E E E E V'],
  ['Shared mailboxes', 'E E E V E E E E V'],
  ['Queues, task rules and SLA', 'E V E V V V V V V'],
  ['Every queue and mailbox (oversight)', 'E N E N N N N N V'],
];
export const OBJECTS = P.map(([o]) => o);
/** The object that decides who sees every mailbox and every queue's tasks, not only their own (HC30). */
export const OVERSIGHT_OBJECT = 'Every queue and mailbox (oversight)';
export type Perms = Record<string, Record<string, Level>>;
export const samplePerms = (): Perms =>
  Object.fromEntries(P.map(([o, ls]) => [o, Object.fromEntries(ls.split(' ').map((l, i) => [COLS[i], l]))])) as Perms;

/* ---------- sign-in security (Jovial, 1 Nov, HC52): every GSP sign-in reads it ---------- */
export type Security = { maxAttempts: number; lockMinutes: number; resendSeconds: number };
/**
 * Decided 1 Nov (S1-6): 3 wrong passwords, a 10-minute pause, 30 seconds before a new code. Pre-decided values, not
 * configurable in Admin (Jovial, S1C-11): Admin › Sign-in security shows them read only.
 */
export const SECURITY: Readonly<Security> = Object.freeze({ maxAttempts: 3, lockMinutes: 10, resendSeconds: 30 });
export const sampleSecurity = (): Security => ({ ...SECURITY });
/** A code works for this long, and once (S1-6: engineering's; not editable). */
export const CODE_MINUTES = 10;
/** Wrong codes before a code stops working; codes an hour per account (proposal). */
export const MAX_WRONG_CODES = 5;
export const CODES_PER_HOUR = 5;

/* ---------- queues (Nesil, 30 Oct: a name, a leader and members, from the PM's queues) ---------- */
export type Queue = { id: string; name: string; lead: string; members: string[] };
const byName = (users: User[], names: string[]) => names.map((n) => users.find((x) => x.name === n)?.id).filter((x): x is string => !!x);
/**
 * Admin's copy of the queue names and leaders, kept only to seed the settings that point to a queue by name (a sales
 * region's Admissions queue, a mailbox's queues). Queues are edited in one place, Admin › Work › Queues, SLA and
 * escalation (S4-1); there is no queue editor under User roles. Global Ops and Global Admissions are one queue,
 * Global Admissions, worked by the Global Ops team (S4-20).
 */
export const sampleQueues = (users: User[]): Queue[] => {
  const region = (r: string) => users.filter((u) => u.role === 'Admission' && u.regions.includes(r)).map((u) => u.name);
  const role = (r: GspRole) => users.filter((u) => u.role === r).map((u) => u.name);
  return (
    [
      ['India Admissions', N('ramish.jafery'), region('India')],
      ['Bangladesh Admissions', N('kamrun.nahar'), region('Bangladesh')],
      ['Africa Admissions', N('kamrun.nahar'), region('Africa')],
      ['Pakistan Admissions', N('sabrina.hyder'), region('Pakistan')],
      ['Nepal Admissions', N('supriya.shrestha'), region('Nepal')],
      ['Sri Lanka Admissions', N('subodya.suraweera'), region('Sri Lanka')],
      ['SEA Admissions', N('truc.nguyen'), [...new Set(SEA.flatMap(region))]],
      ['Philippines Admissions', N('kimberly.olaes'), region('Philippines')],
      ['Australia Admissions', N('jo.qiu'), region('Australia')],
      ['China Admissions', N('jo.qiu'), region('China')],
      ['Latin America & Europe Admissions', N('valentina.castillo'), region('Latin America & Europe')],
      ['Global Admissions', N('tasha.tandon'), role('Global Ops')],
      ['RP Ops', N('garima.bhardwaj'), role('RP Ops')],
      ['Institution', N('matt.beazley'), role('Institution')],
      ['IP Ops', N('gauri.bhardwaj'), role('IP Ops')],
      ['Finance', N('suman1.verma'), role('Finance')],
      ['Admin', N('jovial.lejo'), role('Admin')],
    ] as [string, string, string[]][]
  ).map(([name, lead, members], i) => {
    const leadId = byName(users, [lead])[0] ?? '';
    return { id: `q${i + 1}`, name, lead: leadId, members: byName(users, members).filter((id) => id !== leadId) };
  });
};

/* ---------- shared mailboxes (PRD slice 1, Shared mailboxes) ---------- */
/** Can view: read only. Can send: reply and send from this address. */
export type EmailPerm = 'view' | 'send';
/**
 * A shared mailbox: its address (locked after the first save), what it's for, whether the portal syncs it and from
 * when, the queues whose members get it (Can view and Can send, following the queue's membership), and the people
 * Admin adds by hand (each Can view, the default, or Can send). A mailbox can't be deleted in this release
 * (proposal S1C-12): switch sync off to stop it.
 */
export type EmailGroup = { id: string; email: string; for: string; sync: boolean; since: string; queues: string[]; users: { id: string; perm: EmailPerm }[]; savedAt?: number };
/** The queue names that stand for "every regional Admissions queue" (all but Global Admissions). */
export const isRegionalAdmissions = (name: string) => / Admissions$/.test(name) && name !== 'Global Admissions';
/** The seeded mailboxes, as the PRD lists them: what each is for and its queues (S1C-14: admin.gsp@ is the Admin queue's; Admin forwards anything for RP Ops). */
export const MAILBOX_SEED: [string, string, string[] | 'admissions'][] = [
  ['gsp.admissions@upgrad.com', 'Application conversations with RPs and universities', 'admissions'],
  ['bap.gsp@upgrad.com', 'Partner onboarding', ['RP Ops']],
  ['admin.gsp@upgrad.com', 'New users, role changes, admin requests', ['Admin']],
  ['commissions.gsp@upgrad.com', 'Commission conversations', ['Finance']],
  ['data-team.gsp@upgrad.com', 'Course update requests', ['IP Ops']],
];
/**
 * Access is per user (Jovial, 2 Nov): each mailbox lists its people, each View or View and send; not per queue or
 * region. The seed gives the people of the queues each mailbox fed before (as records), View and send.
 */
export const sampleEmails = (users: User[]): EmailGroup[] => {
  const qs0 = sampleQueues(users);
  return MAILBOX_SEED.map(([email, what, qs], i) => {
    const names = qs === 'admissions' ? [...qs0.map((q) => q.name).filter(isRegionalAdmissions), 'Global Admissions'] : qs;
    const ids = [...new Set(qs0.filter((q) => names.includes(q.name)).flatMap((q) => [q.lead, ...q.members]).filter(Boolean))];
    return {
      id: `e${i + 1}`,
      email,
      for: what,
      sync: true,
      since: ['2026-01-05', '2026-03-02', '2026-03-02', '2026-04-01', '2026-06-15'][i],
      queues: [],
      users: ids.map((id) => ({ id, perm: 'send' as EmailPerm })),
    };
  });
};

/**
 * The shared mailboxes a person can send from (S3F-1 proposal; slice 1 AC-40): those where Admin gave them View and
 * send. The Admissions mailbox (the first seeded, application conversations) comes first, then the rest in Admin's order.
 */
export function sendableMailboxes(c: { emails: EmailGroup[]; users: User[] }, email: string): EmailGroup[] {
  const u = c.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u) return [];
  const mine = c.emails.filter((m) => m.users.some((x) => x.id === u.id && x.perm === 'send'));
  const first = MAILBOX_SEED[0][0];
  return [...mine.filter((m) => m.email === first), ...mine.filter((m) => m.email !== first)];
}
/** A person's access to one shared mailbox by its address (B-6: per person, View or View and send), or null. */
export function mailboxAccess(c: { emails: EmailGroup[]; users: User[] }, email: string, address: string): EmailPerm | null {
  const u = c.users.find((x) => x.email.toLowerCase() === String(email || '').toLowerCase());
  const m = c.emails.find((x) => x.email.toLowerCase() === address.toLowerCase());
  return (u && m?.users.find((x) => x.id === u.id)?.perm) || null;
}
/** A new mail's subject to a university (S3F-1 proposal, as the 1 pm brief): "<GSP ID> · <university reference>". */
export const uniMailSubject = (a: { id: string; uniRef?: string }) => [a.id, a.uniRef].filter(Boolean).join(' · ');

/* ---------- Recruitment assignment (PRD slice 1, Recruitment assignment) ---------- */
/**
 * A row: a country (or "All other countries", the fallback row only), its states or cities ("All", "Rest of
 * <country>", or a list), the BDM, an optional note, and when and who last changed it.
 */
export type BdmRow = { id: string; country: string; area: string; bdm: string; fallback?: boolean; note?: string; changedAt?: number; changedBy?: string };
let n = 0;
const row = (country: string, area: string, bdm: string, fallback = false, note = ''): BdmRow => ({ id: `b${++n}`, country, area, bdm, fallback, note: note || undefined, changedAt: Date.parse('2026-10-31T20:00:00+05:30'), changedBy: 'Seeded from the staff export' });
/** Where several BDMs share an area, who owns it for new RPs, and who else covers it (the PRD's example: Ahmedabad, Riya Shah). */
const AREA_OWNER: Record<string, string> = { ahmedabad: 'riya1.shah@upgrad.com' };
/**
 * Recruitment assignment from the staff export's BDM areas (31 Oct): each Recruitment person's cities or states is a row for
 * their country; whoever covers the whole country takes "Rest of <country>" (or "All" when nobody else is named).
 * A region of several countries gets a row per country. Anything else goes to the fallback row (Ali Butt).
 */
export const sampleBdm = (): BdmRow[] => {
  n = 0;
  const out: BdmRow[] = [];
  // the fallback person (Ali Butt: Rest of world and Direct) has no country rows of their own
  const rec = STAFF.filter((x) => x.role === 'Recruitment' && !x.regions.includes('Global') && !x.regions.every(isSystemRegion));
  const regions = [...new Set(rec.flatMap((x) => x.regions))];
  const countriesOf = (reg: string) => (REGION_COUNTRIES[reg]?.length ? REGION_COUNTRIES[reg] : [reg]);
  for (const reg of regions) {
    const ppl = rec.filter((x) => x.regions.includes(reg));
    // the person whose area is the whole region (Saurabh Chaudhary: India) owns the rest of it, before anyone with no area (W7)
    const whole = ppl.find((x) => x.area === reg) ?? ppl.find((x) => !x.area) ?? ppl[0];
    const multi = countriesOf(reg).length > 1;
    for (const country of countriesOf(reg)) {
      if (out.some((r) => r.country === country)) continue;
      const placed: string[] = [];
      if (!multi)
        for (const x of ppl) {
          if (!x.area || x.area === reg) continue;
          const areas = x.area.split(',').map((a) => a.trim()).filter((a) => a && !placed.includes(a.toLowerCase()) && (!AREA_OWNER[a.toLowerCase()] || AREA_OWNER[a.toLowerCase()] === x.email));
          if (!areas.length) continue;
          areas.forEach((a) => placed.push(a.toLowerCase()));
          // the others who also cover the owner's city go in the note
          const also = areas.flatMap((a) => (AREA_OWNER[a.toLowerCase()] === x.email ? ppl.filter((y) => y !== x && y.area.toLowerCase().split(',').map((z) => z.trim()).includes(a.toLowerCase())).map((y) => label(y)) : []));
          out.push(row(country, areas.join(', '), label(x), false, also.length ? `${also.join(', ')} also cover it` : ''));
        }
      out.push(row(country, placed.length ? `Rest of ${country}` : 'All', label(whole)));
    }
  }
  // a region with a default recruitment contact but nobody based there (Bhutan: Ishwor Acharya) gets its own rows
  for (const [reg, who] of Object.entries(REGION_BDM)) {
    if (isSystemRegion(reg)) continue;
    for (const country of countriesOf(reg)) if (!out.some((r) => r.country === country)) out.push(row(country, 'All', who));
  }
  out.push(row('All other countries', 'All', N('ali.butt'), true));
  return out;
};

/* ---------- currency exchange: the one source (Jovial, 31 Oct). Course search and Finance both read it ---------- */
/** One unit of a currency in Australian dollars (Finance's base). Course search's rupee budget is worked out from these. */
export type Rate = { code: string; name: string; aud: number; usedFor: string; updated: number };
/** A week's rates, as Finance prices a line paid that week: { week: '2026-10-26', GBP: 1.95, … } */
export type FxWeek = { week: string; [code: string]: number | string };
const CUR_NAME: Record<string, string> = { AUD: 'Australian dollar', GBP: 'Pound sterling', CAD: 'Canadian dollar', NZD: 'New Zealand dollar', EUR: 'Euro', USD: 'US dollar', INR: 'Indian rupee', NPR: 'Nepalese rupee', BDT: 'Bangladeshi taka', LKR: 'Sri Lankan rupee', VND: 'Vietnamese dong' };
/** Course search's old rupee rates, for the currencies Finance's weekly table didn't have (CAD, EUR). */
const SEED_INR: Record<string, number> = { CAD: 62, EUR: 95 };
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
/**
 * Finance's weekly table from its sheet, with CAD and EUR added, carried up to this week (each week a copy of the
 * last, as the saved weeks would be). Nothing is saved for next week: Admin enters it, and on Friday T50 asks if not.
 */
export const sampleFxWeeks = (): FxWeek[] => {
  const rows = (COMM.cfg.settings.fx as FxWeek[]).map((w) => ({ ...w, AUD: 1, ...Object.fromEntries(Object.entries(SEED_INR).map(([c, inr]) => [c, Math.round(inr * Number(w.INR) * 10000) / 10000])) }));
  const today = isoDay(Date.now());
  let last = rows[rows.length - 1];
  while (isoDay(Date.parse(last.week + 'T00:00:00Z') + 7 * DAY) <= today) {
    last = { ...last, week: isoDay(Date.parse(last.week + 'T00:00:00Z') + 7 * DAY) };
    rows.push(last);
  }
  return fillFx(rows);
};
/**
 * Every week has every currency (W14, 1 Nov): a week the sheet left a currency out of (VND from 26 Oct) carries the
 * week before's rate, so Finance never counts a rate Admin shows as missing. With Admin's rates, the week in force
 * also takes any currency only the rates table has.
 */
export function fillFx(weeks: FxWeek[], rates?: Pick<Rate, 'code' | 'aud'>[]): FxWeek[] {
  const out: FxWeek[] = [];
  let prev: FxWeek | undefined;
  for (const w of [...weeks].sort((a, b) => (a.week < b.week ? -1 : 1))) {
    const row: FxWeek = { ...w };
    if (prev) for (const [k, v] of Object.entries(prev)) if (k !== 'week' && (row[k] === undefined || row[k] === '' || row[k] === null)) row[k] = v;
    out.push(row);
    prev = row;
  }
  const now = isoDay(Date.now());
  const cur = [...out].filter((w) => w.week <= now).pop();
  if (cur && rates) for (const r of rates) if (r.aud && (cur[r.code] === undefined || cur[r.code] === '')) cur[r.code] = r.aud;
  return out;
}
/** The week's row in force on a day. */
export const fxWeekOn = (weeks: FxWeek[], day = isoDay(Date.now())) => [...weeks].sort((a, b) => (a.week < b.week ? -1 : 1)).filter((w) => w.week <= day).pop();
export const sampleRates = (): Rate[] => {
  const w = fxWeekOn(sampleFxWeeks())!;
  const dests = (code: string) => (Object.entries(CURRENCY) as [Destination, string][]).filter(([, c]) => c === code).map(([d]) => d);
  return Object.keys(CUR_NAME).map((code, i) => {
    const used = [...dests(code).map((d) => `Course search: ${d}`), ...(code === 'INR' ? ['Course search budgets in lakhs'] : [])];
    return { code, name: CUR_NAME[code], aud: Number(w[code] ?? (code === 'VND' ? 0.0000585 : 0)), usedFor: used.join('; '), updated: Date.now() - (i % 4 + 1) * DAY };
  });
};
/** Rupees for one unit of a currency, from the rates (for course search's budget in lakhs). */
export const inrPerFrom = (rates: Rate[], code: string) => {
  const a = rates.find((r) => r.code === code)?.aud;
  const inr = rates.find((r) => r.code === 'INR')?.aud;
  return a && inr ? a / inr : undefined;
};

/* ---------- living costs and fees (PRD slice 1, Configuration tables) ---------- */
/**
 * One row per destination: its currency (read only, from the destination), the living expense a year, the visa fee
 * (paid once), health insurance a year, where Admin found the figures (Note), and when it was last changed. The
 * course page's Costs reads it for the course's length (1 year when the length is in credits).
 */
export type Living = { country: string; currency: string; perYear: number; visa: number; health: number; note: string; updated: number; by?: string; basis?: string };
/** Each destination country's currency (ISO 4217): the destinations a row can be added for. */
export const DEST_CURRENCY: Record<string, string> = {
  Australia: 'AUD', UK: 'GBP', Canada: 'CAD', 'New Zealand': 'NZD', Ireland: 'EUR', USA: 'USD',
  Germany: 'EUR', France: 'EUR', Netherlands: 'EUR', Spain: 'EUR', Italy: 'EUR', Austria: 'EUR', Belgium: 'EUR', Finland: 'EUR', Portugal: 'EUR', Malta: 'EUR', Cyprus: 'EUR', Latvia: 'EUR', Lithuania: 'EUR',
  Sweden: 'SEK', Denmark: 'DKK', Poland: 'PLN', 'Czech Republic': 'CZK', Hungary: 'HUF', Switzerland: 'CHF', Norway: 'NOK',
  Singapore: 'SGD', Malaysia: 'MYR', Japan: 'JPY', 'South Korea': 'KRW', 'Hong Kong': 'HKD', China: 'CNY', 'United Arab Emirates': 'AED', Mauritius: 'MUR', 'South Africa': 'ZAR',
};
const L = (country: string, perYear: number, visa: number, health: number, note: string, days: number): Living => ({ country, currency: DEST_CURRENCY[country], perYear, visa, health, note, updated: Date.now() - days * DAY, by: N('jovial.lejo') });
export const sampleLiving = (): Living[] => [
  L('Australia', 29710, 2000, 700, 'Department of Home Affairs; OSHC providers', 12),
  L('UK', 12006, 524, 776, 'UKVI, 9 months outside London; Immigration Health Surcharge', 30),
  L('Canada', 20635, 235, 900, 'IRCC, study permit; provincial health plans', 40),
  L('New Zealand', 20000, 850, 700, 'Immigration New Zealand', 55),
  L('Ireland', 12000, 300, 500, 'Irish Immigration Service', 60),
  L('USA', 18000, 535, 2500, 'US Department of State; university health plans', 70),
];
/** An older saved row (before visa and health sat on it) gets the seed's figures. */
export const withFees = (l: Partial<Living> & { country: string }): Living => {
  const seed = sampleLiving().find((x) => x.country === l.country);
  return { currency: DEST_CURRENCY[l.country] ?? l.currency ?? '', perYear: 0, visa: seed?.visa ?? 0, health: seed?.health ?? 0, note: l.basis ?? seed?.note ?? '', updated: Date.now(), ...l } as Living;
};
/** Kept for older readers: visa and health fees as separate lines, from Living costs and fees. */
export type VisaFee = { id: string; country: string; currency: string; label: string; amount: number; per: 'once' | 'year'; basis: string; updated: number };
export const visaFeesOf = (living: Living[]): VisaFee[] =>
  living.flatMap((l) => [
    { id: `vf-${l.country}-v`, country: l.country, currency: l.currency, label: 'Visa fee', amount: l.visa, per: 'once' as const, basis: l.note, updated: l.updated },
    { id: `vf-${l.country}-h`, country: l.country, currency: l.currency, label: 'Health insurance', amount: l.health, per: 'year' as const, basis: l.note, updated: l.updated },
  ]);
export const sampleVisaFees = (): VisaFee[] => visaFeesOf(sampleLiving());

/* ---------- application routing (PRD slice 1, Application routing) ---------- */
export type RouteRule = { id: 'direct' | 'list' | 'keep' | 'onshore' | 'nat' | 'fb'; title: string; when: string; region: string; bdm: string; on: boolean };
/** The six rules, in code: Admin owns each one's On or Off (not the Fallback) and the order (the Fallback stays last). */
export const sampleRules = (): RouteRule[] => [
  { id: 'direct', title: 'Direct application', when: 'The application has no RP', region: 'Direct', bdm: 'Direct’s default recruitment contact', on: true },
  { id: 'list', title: 'RP is on a regional list', when: 'The RP is on one of the regional RP lists (nationality not used; Australia included)', region: 'The list’s region', bdm: 'The RP’s Recruitment contact', on: true },
  { id: 'keep', title: 'Student in Australia, RP has no Australian branch', when: 'Student in Australia, applying to Australia, RP’s region is Vietnam or Latin America & Europe, and the RP has no Australian branch', region: 'The RP’s region', bdm: 'The RP’s Recruitment contact', on: true },
  { id: 'onshore', title: 'Student in Australia, applying to Australia', when: 'Student in Australia, applying to Australia', region: 'Australia', bdm: 'Australia’s default recruitment contact', on: true },
  { id: 'nat', title: 'Student’s nationality', when: 'The nationality is in the country map', region: 'That region', bdm: 'That region’s default recruitment contact', on: true },
  { id: 'fb', title: 'Fallback', when: 'Nothing above matched', region: 'Direct', bdm: 'Direct’s default recruitment contact', on: true },
];
/** Each region's default recruitment contact (PRD seed table, from Jovial's Sales regions tab, 1 Nov). */
export const REGION_BDM: Record<string, string> = {
  India: N('saurabh.chaudhary'), Bangladesh: N('gsp.bangladesh'), Nepal: N('anil.shrestha'), 'Sri Lanka': N('kanchani.jayawardhana'), Vietnam: N('quan.hoang'), Pakistan: N('faryal.abbas+BDM'),
  'Indonesia Malaysia & Thailand': N('rifaldo.marbun'), Myanmar: N('nilar.win'), Bhutan: N('ishwor.acharya'), Australia: N('judy.tan'), Philippines: N('arielle.sevilleno'),
  Africa: N('gsp.bangladesh'), 'Latin America & Europe': N('camilo.penaranda'), China: N('annie.gu'), 'Rest of world': N('ali.butt'), Direct: N('ali.butt'), Global: N('ali.butt'),
};
/** Each region's Admissions queue at the start, by queue name (PRD seed table): South-East Asia shares one; the three system regions → Global Admissions. */
const SEA = ['Vietnam', 'Indonesia Malaysia & Thailand', 'Myanmar', 'Bhutan'];
export const seedQueueName = (region: string) => (isSystemRegion(region) ? 'Global Admissions' : SEA.includes(region) ? 'SEA Admissions' : `${region} Admissions`);
/**
 * A region's Admissions queue, by name (S4-1): the queue picked for it on Admin › User roles › Sales regions, from
 * Admin › Work's queues. A region whose queue was deleted, or that has none, falls back to Global Admissions.
 */
export const regionQueueName = (region: string) => {
  const c = live.cfg?.();
  if (!c) return seedQueueName(region);
  const v = c.regionQueue[region];
  // older saved settings stored Admin's own queue id (q12); newer ones store the Work queue's name
  return (v && (c.queues.find((q) => q.id === v)?.name ?? v)) || 'Global Admissions';
};
/** An RP as the routing rules see it: its sales region, whether it has an Australian branch, and its BDM. From the RP records (data/regions.ts routingRps). */
export type RoutingRp = { name: string; region: string; auBranch: boolean; bdm: string };
/** The regional RP lists at the start: real RPs from the records (seeded: Vietnam, Latin America & Europe, Philippines). */
export const sampleLists = (): Record<string, string[]> => ({ Vietnam: ['Edunetwork Australia', 'IEMC Global Pty Ltd'], 'Latin America & Europe': ['Latin Education and Migration'], Philippines: ['Pathway To Aus'] });

/** One rule in the test's trace: Matched, No, Not reached, or Off. */
export type TraceState = 'Matched' | 'No' | 'Not reached' | 'Off';
/** Runs the rules from the top: the first that matches sets the region and BDM (with every rule's trace). */
export function route(rules: RouteRule[], lists: Record<string, string[]>, a: { rp: string; nationality: string; now: string; dest: string; rpInfo?: RoutingRp }, defaults: Record<string, string> = REGION_BDM, nationality: Record<string, string> = NATIONALITY) {
  // the RP from its record: the caller says where it is (data/regions.ts routingRps)
  const rp = a.rp ? a.rpInfo : undefined;
  const listRegion = rp && Object.entries(lists).find(([, l]) => l.includes(rp.name))?.[0];
  const onshore = a.now === 'Australia' && a.dest === 'Australia';
  const test: Record<RouteRule['id'], () => { region: string; bdm: string; why: string } | null> = {
    direct: () => (!rp ? { region: 'Direct', bdm: defaults.Direct || 'Not set', why: 'The application has no RP' } : null),
    list: () => (listRegion ? { region: listRegion, bdm: rp!.bdm, why: `${rp!.name} is on the ${listRegion} list` } : null),
    keep: () => (rp && onshore && ['Vietnam', 'Latin America & Europe'].includes(rp.region) && !rp.auBranch ? { region: rp.region, bdm: rp.bdm, why: `Student in Australia, and ${rp.name} (${rp.region}) has no Australian branch` } : null),
    onshore: () => (onshore ? { region: 'Australia', bdm: defaults.Australia || 'Not set', why: 'The student is in Australia and applying to Australia' } : null),
    nat: () => (nationality[a.nationality] ? { region: nationality[a.nationality], bdm: defaults[nationality[a.nationality]] || 'Not set', why: `${a.nationality} is in the map: ${nationality[a.nationality]}` } : null),
    fb: () => ({ region: 'Direct', bdm: defaults.Direct || 'Not set', why: 'Nothing above matched' }),
  };
  let hit: { region: string; bdm: string; why: string; rule: RouteRule; n: number } | null = null;
  const trace = rules.map((r, i): { r: RouteRule; state: TraceState; why: string } => {
    if (hit) return { r, state: 'Not reached', why: 'An earlier rule matched' };
    if (!r.on && r.id !== 'fb') return { r, state: 'Off', why: 'Switched off' };
    const x = test[r.id]();
    if (x) {
      hit = { ...x, rule: r, n: i + 1 };
      return { r, state: 'Matched', why: x.why };
    }
    return { r, state: 'No', why: 'Doesn’t apply' };
  });
  return { hit: hit as { region: string; bdm: string; why: string; rule: RouteRule; n: number } | null, trace, source: rp ? rp.region : 'Direct' };
}

/* ---------- document configuration (PRD slice 1, Document configuration) ---------- */
/** Slice 3's 8 stages. */
export const STAGES = ['New', 'Pre-screening', 'Application', 'Offer', 'Verification', 'Acceptance', 'Visa', 'Enrolment'] as const;
export type DocRule = { id: string; doc: string; stage: (typeof STAGES)[number]; when: string; setting: 'Mandatory' | 'Optional'; by: 'RP' | 'GSP'; on: boolean; cond?: DocCond; /** An application has asked for it: it can only be switched off (proposal S1C-12). */ asked?: boolean };
/** When a document rule applies: Program levels, university countries, where the student is, and an other condition. Empty = any. */
export type DocCond = { levels: string[]; countries: string[]; where: string; other: string };
/** Slice 2's Program levels (Admin › Program levels, S2-17). */
export const DOC_LEVELS = ['Foundation', 'Diploma', 'Bachelor’s degree', 'Postgraduate diploma', 'Master’s degree', 'PhD or research'];
/** The catalogue's short names for two countries (its universities say UK and USA). */
const CAT_NAME: Record<string, string> = { 'United Kingdom': 'UK', 'United States': 'USA' };
const LIST_NAME: Record<string, string> = { UK: 'United Kingdom', USA: 'United States' };
export const DOC_WHERE = ['Anywhere', 'Already in the destination', 'Outside it'];
const or = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} or ${l[l.length - 1]}` : l[0] ?? '');
export const whenText = (c: DocCond) =>
  [c.levels.length && or(c.levels), c.countries.length && `University in ${or(c.countries.map((x) => CAT_NAME[x] ?? x).map((x) => (x === 'UK' || x === 'USA' ? `the ${x}` : x)))}`, c.where === 'Already in the destination' ? 'already in the destination' : c.where === 'Outside it' || c.where === 'Outside the destination' ? 'outside the destination' : '', c.other.trim()].filter(Boolean).join(', ') || 'Always';
/**
 * The rule's conditions, for matching against a course: its countries as the catalogue names them (UK, USA), and
 * "Outside it" as the readers know it. Read from the rule's sentence for rules made before conditions were stored.
 */
export function condOf(r: DocRule): DocCond {
  const c0 = r.cond ?? { levels: [], countries: [], where: 'Anywhere', other: '' };
  return { ...c0, countries: c0.countries.map((x) => CAT_NAME[x] ?? x), where: c0.where === 'Outside it' ? 'Outside the destination' : c0.where };
}
/** The rule's conditions as Admin edits them (country list names). */
export const editCond = (r: DocRule): DocCond => {
  const c = r.cond ?? { levels: [], countries: [], where: 'Anywhere', other: '' };
  return { ...c, countries: c.countries.map((x) => LIST_NAME[x] ?? x) };
};
let d = 0;
const dr = (doc: string, cond: Partial<DocCond>, setting: DocRule['setting']): DocRule => {
  const c: DocCond = { levels: [], countries: [], where: 'Anywhere', other: '', ...cond };
  return { id: `d${++d}`, doc, stage: 'New', when: whenText(c), setting, by: 'RP', on: true, cond: c, asked: true };
};
/**
 * The 10 application document rules (PRD slice 1): the full set, all asked at New and uploaded by the RP. GSP's own
 * uploads on a status change (the offer letters, one Acceptance letter for every destination, the visa grant) are
 * slice 3's (S3-9, S3-23): no CoE, CAS, I-20, LOA or Offer of place here.
 */
export const sampleDocRules = (): DocRule[] => {
  d = 0;
  return [
    dr('Passport', {}, 'Mandatory'),
    { ...dr('Class 10 marksheet', {}, 'Mandatory'), when: 'Any program level' },
    { ...dr('Class 12 marksheet', {}, 'Mandatory'), when: 'Any program level' },
    dr('UG degree and transcripts', { levels: ['Postgraduate diploma', 'Master’s degree', 'PhD or research'] }, 'Mandatory'),
    dr('PG degree and transcripts', { levels: ['PhD or research'] }, 'Mandatory'),
    dr('SOP', { countries: ['United Kingdom'] }, 'Mandatory'),
    dr('LORs', { countries: ['United Kingdom'] }, 'Mandatory'),
    dr('University application form, filled', { other: 'The university has its own form' }, 'Mandatory'),
    dr('IP transfer proof', { countries: ['Australia'], where: 'Already in the destination' }, 'Optional'),
    dr('RPL proof', { countries: ['Australia'], where: 'Already in the destination' }, 'Optional'),
  ];
};
/** A recruitment partner document: its name and whether it's needed. */
export type RpDoc = { name: string; setting: 'Mandatory' | 'Optional' };
export type RpDocRule = { id: string; name?: string; applies: 'Only these countries' | 'All countries except' | 'All countries'; countries: string[]; docs: RpDoc[] };
/** Older saved rules kept documents as plain names ("GST certificate (if registered)" was the optional one). */
export const rpDocsOf = (r: { docs: (RpDoc | string)[] }): RpDoc[] => r.docs.map((x) => (typeof x === 'string' ? { name: x.replace(/\s*\(if [^)]*\)/i, ''), setting: /\(if /i.test(x) ? 'Optional' : 'Mandatory' } : x));
export const sampleRpDocs = (): RpDocRule[] => [
  { id: 'r1', name: 'India', applies: 'Only these countries', countries: ['India'], docs: [{ name: 'Business registration certificate', setting: 'Mandatory' }, { name: 'PAN card', setting: 'Mandatory' }, { name: 'GST certificate', setting: 'Optional' }] },
  { id: 'r2', name: 'Everywhere else', applies: 'All countries', countries: [], docs: [{ name: 'Business registration certificate', setting: 'Mandatory' }, { name: 'Company profile', setting: 'Mandatory' }, { name: 'Owner’s ID', setting: 'Mandatory' }, { name: 'Reference (name, email, phone)', setting: 'Mandatory' }] },
];
/** The rule a recruitment partner gets: the first that names its head-office country, else the All countries rule. */
export const rpRuleFor = (rules: RpDocRule[], country: string) =>
  rules.find((r) => (r.applies === 'Only these countries' && r.countries.includes(country)) || (r.applies === 'All countries except' && !r.countries.includes(country))) ?? rules.find((r) => r.applies === 'All countries');

/* ---------- filters (not in the PM prototype: course search's own filters) ---------- */
export type FilterSet = { page: string; filters: { id: string; label: string; shown: boolean }[] };
export const sampleFilters = (): FilterSet[] => [
  {
    page: 'Course search',
    // Regression 6 (2 Nov): no "Deadline within" filter; Countdown only sets "closes in N days"
    filters: ['University', 'Tuition a year, up to', 'IELTS needed, up to', 'Intake open now', 'Scholarship available', 'No application fee', 'English test can wait or be waived', 'Post-study work visa', 'Shortlisted only'].map((label, i) => ({ id: `c${i}`, label, shown: true })),
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

/* ---------- logs (PRD slice 1, Audit: change log and download log) ---------- */
/**
 * The log starts empty (Jovial, 2 Nov: nothing hard-coded): Change history entries are written by saves, download
 * entries by exports (data/downloads.ts), and the daily jobs' runs are worked out on Work › Emails and daily jobs.
 */
export const sampleLog = (): LogEntry[] => [];
