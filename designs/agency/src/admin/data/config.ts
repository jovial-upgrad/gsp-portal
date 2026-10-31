/**
 * What GSP Admin configures (Nesil, 30 Oct). Taken from the PM prototype's Super Admin › Settings wherever it has
 * them (sales regions, permissions, queues, BDM assignment, application routing, document rules, the download log);
 * the currency exchange, living costs and filters tables aren't in it, so they're built from the figures this
 * prototype already uses (course search's rates, the course dialog's visa figures, course search's filters).
 * Every change is logged (`log`), and Logs shows them with the download log. Sample data.
 */
import { SALES_REGIONS } from '../../institution/data/announcements';
import { CURRENCY, OTHER_FEES, type Destination } from '../../data/courses';
import COMM from '../../finance/comm.json';
import { STAFF, label, nameOf } from '../../data/staff';
/** A GSP person's name, by the start of their email: N('ramish.jafery'). Throws if they're not on the staff list. */
const N = (local: string) => nameOf(`${local}@upgrad.com`);

export type LogEntry = { id: string; at: number; who: string; area: string; text: string; kind: 'change' | 'download'; role?: string; filters?: string; size?: string; format?: string };

/* ---------- sales regions (PM: Settings › Sales regions and Admissions contacts) ---------- */
export type Region = { name: string; contact: string };
/** Countries that make up a region, where it isn't the country itself (PM: salesRegionOf). */
export const REGION_COUNTRIES: Record<string, string[]> = {
  'Indonesia, Malaysia and Thailand': ['Indonesia', 'Malaysia', 'Thailand'],
  Africa: ['Nigeria', 'Kenya', 'Ghana', 'Egypt', 'South Africa', 'Uganda', 'Ethiopia', 'Tanzania', 'and 46 more'],
  'Latin America and Europe': ['Brazil', 'Colombia', 'Mexico', 'Peru', 'United Kingdom', 'Germany', 'France', 'Spain', 'and 46 more'],
  'Rest of world': ['Every country not in another region'],
  Direct: ['Students who apply to GSP without a recruitment partner'],
  Global: ['Every region: for GSP people who cover them all'],
};
/** Each region's Admissions contact (Jovial's sheet, 31 Oct). */
const CONTACT: Record<string, string> = {
  India: N('ramish.jafery'), Bangladesh: N('kamrun.nahar'), Nepal: N('supriya.shrestha'), 'Sri Lanka': N('subodya.suraweera'), Vietnam: N('truc.nguyen'), Pakistan: N('sabrina.hyder'),
  'Indonesia, Malaysia and Thailand': N('truc.nguyen'), Myanmar: N('truc.nguyen'), Bhutan: N('truc.nguyen'), Australia: N('jo.qiu'), Philippines: N('kimberly.olaes'), Africa: N('kamrun.nahar'),
  'Latin America and Europe': N('valentina.castillo'), China: N('jo.qiu'), 'Rest of world': N('tasha.tandon'), Direct: N('tasha.tandon'),
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
export type User = { id: string; name: string; email: string; dial: string; phone: string; role: GspRole; title: string; region: string; regions: string[]; area: string; status: UserStatus; sentAt?: number };
const DAY = 86_400_000;
/** GSP's people: every user comes from the staff list (data/staff.ts, Jovial's export of 31 Oct). The export has no phone numbers or titles. */
export const sampleUsers = (): User[] =>
  STAFF.map((s): User => ({ id: s.id, name: label(s), email: s.email, dial: s.dial, phone: s.phone, role: s.role, title: s.title, region: s.regions.join(', '), regions: s.regions, area: s.area, status: 'Active' })).sort((a, b) => a.name.localeCompare(b.name));

/* ---------- permission roles × objects (PM: Settings › Permissions, decided 25 Oct) ---------- */
/** Jovial, 31 Oct: just three levels. */
export const LEVELS = [
  ['N', 'No access'],
  ['V', 'View'],
  ['E', 'View + edit'],
] as const;
export type Level = (typeof LEVELS)[number][0];
/** Jovial, 31 Oct: GSP's nine roles. */
export const ROLES = ['Admin', 'Admission', 'Admission Ops', 'Recruitment', 'Recruitment Ops', 'Institution', 'Institution Ops', 'Finance', 'View Only'] as const;
/** The columns of the table below, in the order of Jovial's sheet. */
const COLS = ['Admin', 'View Only', 'Finance', 'Institution', 'Institution Ops', 'Recruitment', 'Recruitment Ops', 'Admission', 'Admission Ops'] as const;
/** Each object's level for each role (Jovial's Permissions tab, 31 Oct): N no access, V view, E view + edit. */
const P: [string, string][] = [
  ['Students', 'E V V V V V V E E'],
  ['Student documents', 'E V V V V V V E E'],
  ['Applications', 'E V V V V V V E E'],
  ['Application documents and checks', 'E V V V V V V E E'],
  ['Drafts to universities and placed emails', 'E V V V V V V E E'],
  ['Chat threads', 'E V E E E E E E E'],
  ['Recruitment partner profile and status', 'E V V V V E E V V'],
  ['RP onboarding documents', 'E V V N N E E N N'],
  ['Documents issued to RPs', 'E V E N N V E N N'],
  ['RP branches and team', 'E V V V V E E N N'],
  ['Master Partners', 'E V V V V V E N N'],
  ['Institution partners', 'E V V E V V V V V'],
  ['IP documents and IP changes', 'E V V E V N N N N'],
  ['Universities', 'E V V E E V V V V'],
  ['University portal logins', 'E V V E E N N V E'],
  ['Campuses', 'E V V E E N N V V'],
  ['Admission requirements', 'E V V E E N N V E'],
  ['Announcements', 'E V V E E N N V E'],
  ['University microsites', 'E V V E E V V V V'],
  ['Courses, intakes and entry rules', 'E V V E E V V V V'],
  ['Commission terms', 'E V E V V V E N N'],
  ['Commission lines', 'E V E N N N N N N'],
  ['Invoices and receipts', 'E V E N N V N N N'],
  ['Payout runs and statements', 'E V E N N V N N N'],
  ['RP bank details', 'E V E N N V E N N'],
  ['Overview dashboard', 'E V V V V V V V V'],
  ['GSP users and roles', 'E V N N N N N N N'],
  ['Settings', 'E V N N N N N N N'],
  ['Download log and audit logs', 'E V N N N N N N N'],
];
export const OBJECTS = P.map(([o]) => o);
export type Perms = Record<string, Record<string, Level>>;
export const samplePerms = (): Perms =>
  Object.fromEntries(P.map(([o, ls]) => [o, Object.fromEntries(ls.split(' ').map((l, i) => [COLS[i], l]))])) as Perms;

/* ---------- queues (Nesil, 30 Oct: a name, a leader and members, from the PM's queues) ---------- */
export type Queue = { id: string; name: string; lead: string; members: string[] };
const byName = (users: User[], names: string[]) => names.map((n) => users.find((x) => x.name === n)?.id).filter((x): x is string => !!x);
/**
 * Each regional Admissions queue holds the staff list's Admission people for that region; each team queue holds
 * everyone with that role. The leaders are Admin's choice (Jovial's earlier list).
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
      ['Latin America and Europe Admissions', N('valentina.castillo'), region('Latin America and Europe')],
      ['Global Admissions', N('tasha.tandon'), role('Admission Ops')],
      ['Admission Ops', N('tasha.tandon'), role('Admission Ops')],
      ['Recruitment Ops', N('garima.bhardwaj'), role('Recruitment Ops')],
      ['Institution', N('matt.beazley'), role('Institution')],
      ['Institution Ops', N('gauri.bhardwaj'), role('Institution Ops')],
      ['Finance', N('suman1.verma'), role('Finance')],
    ] as [string, string, string[]][]
  ).map(([name, lead, members], i) => {
    const leadId = byName(users, [lead])[0] ?? '';
    return { id: `q${i + 1}`, name, lead: leadId, members: byName(users, members).filter((id) => id !== leadId) };
  });
};

/* ---------- email groups (Nesil, 30 Oct): shared inboxes, and who can see or send from them ---------- */
export type EmailPerm = 'view' | 'send';
export type EmailGroup = { id: string; email: string; sync: boolean; since: string; users: { id: string; perm: EmailPerm }[] };
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
/**
 * GSP's shared mailboxes (Jovial's Inbox tab, 31 Oct): each feeds one or more queues, and everyone in those queues
 * can see and send from it by default (to be made configurable). Admin sees them all.
 */
export const MAILBOX_QUEUES: Record<string, string[]> = {
  'admin.gsp@upgrad.com': ['Recruitment Ops'], // Jovial, 1 Nov (O6)
  'bap.gsp@upgrad.com': ['Recruitment Ops'],
  'commissions.gsp@upgrad.com': ['Finance'],
  'data-team.gsp@upgrad.com': ['Institution Ops'],
  'gsp.admissions@upgrad.com': ['Each region’s Admissions queue', 'Admission Ops'],
};
export const MAILBOX_WHY: Record<string, string> = {
  'admin.gsp@upgrad.com': 'New users, role changes and other admin requests',
  'bap.gsp@upgrad.com': 'Everything about partner onboarding',
  'commissions.gsp@upgrad.com': 'Commission conversations with RPs and institution partners',
  'data-team.gsp@upgrad.com': 'Course update requests',
  'gsp.admissions@upgrad.com': 'Application conversations with RPs and institution partners',
};
export const sampleEmails = (users: User[]): EmailGroup[] => {
  const queues = sampleQueues(users);
  const inQueue = (name: string) => {
    if (name === 'Each region’s Admissions queue') return queues.filter((q) => q.name.endsWith(' Admissions') && q.name !== 'Global Admissions').flatMap((q) => [q.lead, ...q.members]);
    const q = queues.find((x) => x.name === name);
    return q ? [q.lead, ...q.members] : [];
  };
  return Object.entries(MAILBOX_QUEUES).map(([email, qs], i) => ({
    id: `e${i + 1}`,
    email,
    sync: true,
    since: iso(300 - i * 40),
    users: [...new Set(qs.flatMap(inQueue))].filter(Boolean).map((id) => ({ id, perm: 'send' as EmailPerm })),
  }));
};

/* ---------- BDM assignment (PM: Settings › BDM assignment) ---------- */
export type BdmRow = { id: string; country: string; area: string; bdm: string; fallback?: boolean };
let n = 0;
const row = (country: string, area: string, bdm: string, fallback = false): BdmRow => ({ id: `b${++n}`, country, area, bdm, fallback });
/**
 * BDM assignment from the staff list (Jovial, 31 Oct): each Recruitment person's area (cities or states) is a row for
 * their country; whoever covers a whole country (an area naming the country, or no area) takes "Rest of" it. A
 * region of several countries gets a row per country. Anything else goes to Ali Butt (Global).
 */
const BDM_COUNTRIES: Record<string, string[]> = { 'Indonesia, Malaysia and Thailand': ['Indonesia', 'Malaysia', 'Thailand'] };
/** Where several BDMs share an area, who takes a new RP there (Jovial's sheet, 31 Oct). */
const AREA_OWNER: Record<string, string> = { ahmedabad: 'riya1.shah@upgrad.com' };
export const sampleBdm = (): BdmRow[] => {
  n = 0;
  const out: BdmRow[] = [];
  const rec = STAFF.filter((x) => x.role === 'Recruitment' && !x.regions.includes('Global'));
  const regions = [...new Set(rec.flatMap((x) => x.regions))];
  for (const reg of regions) {
    const ppl = rec.filter((x) => x.regions.includes(reg));
    const countries = BDM_COUNTRIES[reg] ?? [reg];
    // the person whose area is the whole region (Saurabh Chaudhary: India) owns the rest of it, before anyone with no area (W7)
    const whole = ppl.find((x) => x.area === reg) ?? ppl.find((x) => !x.area) ?? ppl[0];
    for (const country of countries) {
      for (const x of ppl) {
        if (!x.area || x.area === reg) continue;
        // an area another BDM owns (Ahmedabad: Riya Shah) stays theirs
        const areas = x.area.split(',').map((a) => a.trim()).filter((a) => !AREA_OWNER[a.toLowerCase()] || AREA_OWNER[a.toLowerCase()] === x.email);
        if (areas.length) out.push(row(country, areas.join(', '), label(x)));
      }
      const some = ppl.some((x) => x.area && x.area !== reg);
      out.push(row(country, some ? `Rest of ${country}` : REGION_ROWS.includes(country) ? 'All countries' : 'All', label(whole)));
    }
  }
  // a region with a default BDM but nobody based there (Bhutan: Ishwor Acharya) gets its own row
  for (const [reg, who] of Object.entries(REGION_BDM)) {
    if (reg === 'Rest of world' || reg === 'Direct') continue;
    for (const country of BDM_COUNTRIES[reg] ?? [reg]) if (!out.some((r) => r.country === country)) out.push(row(country, REGION_ROWS.includes(country) ? 'All countries' : 'All', who));
  }
  out.push(row('All other countries', 'All', N('ali.butt'), true));
  return out;
};
export const REGION_ROWS = ['Latin America and Europe', 'Africa'];

/* ---------- currency exchange: the one source (Jovial, 31 Oct). Course search and Finance both read it ---------- */
/** One unit of a currency in Australian dollars (Finance's base). Course search's rupee budget is worked out from these. */
export type Rate = { code: string; name: string; aud: number; usedFor: string; updated: number };
/** A week's rates, as Finance prices a line paid that week: { week: '2026-10-26', GBP: 1.95, … } */
export type FxWeek = { week: string; [code: string]: number | string };
const CUR_NAME: Record<string, string> = { AUD: 'Australian dollar', GBP: 'Pound sterling', CAD: 'Canadian dollar', NZD: 'New Zealand dollar', EUR: 'Euro', USD: 'US dollar', INR: 'Indian rupee', NPR: 'Nepalese rupee', BDT: 'Bangladeshi taka', LKR: 'Sri Lankan rupee', VND: 'Vietnamese dong' };
const PAYOUT: Record<string, string> = { INR: 'India', NPR: 'Nepal', BDT: 'Bangladesh', LKR: 'Sri Lanka', VND: 'Vietnam' };
/** Course search's old rupee rates, for the currencies Finance's weekly table didn't have (CAD, EUR). */
const SEED_INR: Record<string, number> = { CAD: 62, EUR: 95 };
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Finance's weekly table from its sheet, with CAD and EUR added, carried a month past today (each new week a copy of the last). */
export const sampleFxWeeks = (): FxWeek[] => {
  const rows = (COMM.cfg.settings.fx as FxWeek[]).map((w) => ({ ...w, AUD: 1, ...Object.fromEntries(Object.entries(SEED_INR).map(([c, inr]) => [c, Math.round(inr * Number(w.INR) * 10000) / 10000])) }));
  const end = isoDay(Date.now() + 28 * DAY);
  let last = rows[rows.length - 1];
  while (last.week < end) {
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
    const used = [...dests(code).map((d) => `Course search: ${d}`), ...(PAYOUT[code] ? [`RP payouts: ${PAYOUT[code]}`] : []), ...(code === 'INR' ? ['Course search budgets in lakhs'] : [])];
    return { code, name: CUR_NAME[code], aud: Number(w[code] ?? (code === 'VND' ? 0.0000585 : 0)), usedFor: used.join('; '), updated: Date.now() - (i % 4 + 1) * DAY };
  });
};
/** Rupees for one unit of a currency, from the rates (for course search's budget in lakhs). */
export const inrPerFrom = (rates: Rate[], code: string) => {
  const a = rates.find((r) => r.code === code)?.aud;
  const inr = rates.find((r) => r.code === 'INR')?.aud;
  return a && inr ? a / inr : undefined;
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

/* ---------- visa and health fees (Jovial, 31 Oct: set up like living costs) ---------- */
/** One fee a student pays to study in a destination: the visa, health cover. `per`: once, or every year. */
export type VisaFee = { id: string; country: string; currency: string; label: string; amount: number; per: 'once' | 'year'; basis: string; updated: number };
const FEE_BASIS: Record<string, string> = { Australia: 'Department of Home Affairs; OSHC providers', UK: 'UKVI', Canada: 'IRCC; provincial health plans', 'New Zealand': 'Immigration New Zealand', Ireland: 'Irish Immigration Service', USA: 'US Department of State; university health plans' };
export const sampleVisaFees = (): VisaFee[] =>
  (Object.entries(OTHER_FEES) as [Destination, [string, number][]][]).flatMap(([country, fees], i) =>
    fees.map(([label, amount], j) => ({
      id: `vf${i}${j}`,
      country,
      currency: CURRENCY[country],
      label: label.replace(/, (a year|once)$/, ''),
      amount,
      per: /a year$/.test(label) ? ('year' as const) : ('once' as const),
      basis: FEE_BASIS[country] ?? '',
      updated: Date.now() - (20 + i * 7) * DAY,
    })),
  );

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
/** Each region's default application BDM (Jovial's sheet, 31 Oct). */
export const REGION_BDM: Record<string, string> = {
  India: N('saurabh.chaudhary'), Bangladesh: N('sania.shanta'), Nepal: N('anil.shrestha'), 'Sri Lanka': N('kanchani.jayawardhana'), Vietnam: N('quan.hoang'), Pakistan: N('ali.butt'),
  'Indonesia, Malaysia and Thailand': N('rifaldo.marbun'), Myanmar: N('nilar.win'), Bhutan: N('ishwor.acharya'), Australia: N('judy.tan'), Philippines: N('arielle.sevilleno'),
  Africa: N('gsp.bangladesh'), 'Latin America and Europe': N('camilo.penaranda'), China: N('annie.gu'), 'Rest of world': N('ali.butt'), Direct: N('ali.butt'),
};
/** Each region's Admissions queue, by queue name (Jovial, 31 Oct: Rest of world and Direct → Global Admissions). */
const SEA = ['Vietnam', 'Indonesia, Malaysia and Thailand', 'Myanmar', 'Bhutan'];
/** Each region's Admissions queue, by queue name (Jovial's sheet, 31 Oct): South-East Asia shares one; Rest of world and Direct → Global Admissions. */
export const regionQueueName = (region: string) => (region === 'Rest of world' || region === 'Direct' ? 'Global Admissions' : SEA.includes(region) ? 'SEA Admissions' : region === 'Latin America and Europe' ? 'Latin America and Europe Admissions' : `${region} Admissions`);
/** The PM's sample RPs, for the regional lists and the test. */
export type RoutingRp = { name: string; region: string; auBranch: boolean; bdm: string };
export const ROUTING_RPS: RoutingRp[] = [
  { name: 'BrightPath Overseas', region: 'India', auBranch: false, bdm: N('harsh.solanki') },
  { name: 'Horizon Overseas', region: 'India', auBranch: true, bdm: N('harsh.solanki') },
  { name: 'Kathmandu Study Hub', region: 'Nepal', auBranch: false, bdm: N('ali.butt') },
  { name: 'Dhaka Global Education', region: 'Bangladesh', auBranch: false, bdm: N('sania.shanta') },
  { name: 'Saigon Study Link', region: 'Vietnam', auBranch: false, bdm: N('quan.hoang') },
  { name: 'Mekong Edu Partners', region: 'Vietnam', auBranch: true, bdm: N('quan.hoang') },
  { name: 'Andes Education Group', region: 'Latin America and Europe', auBranch: false, bdm: N('ali.butt') },
  { name: 'Manila Abroad Consultancy', region: 'Philippines', auBranch: false, bdm: N('arielle.sevilleno') },
  { name: 'Colombo Pathways', region: 'Sri Lanka', auBranch: false, bdm: N('kanchani.jayawardhana') },
  { name: 'Lagos Study Partners', region: 'Africa', auBranch: false, bdm: N('gsp.bangladesh') },
];
export const sampleLists = (): Record<string, string[]> => ({ Vietnam: ['Saigon Study Link', 'Mekong Edu Partners'], 'Latin America and Europe': ['Andes Education Group'], Philippines: ['Manila Abroad Consultancy'] });
/** Nationality to region, for the test (the PM maps 152 countries; these are the ones the test offers). */
export const NATIONALITY: Record<string, string> = {
  India: 'India', Nepal: 'Nepal', Bangladesh: 'Bangladesh', 'Sri Lanka': 'Sri Lanka', Pakistan: 'Pakistan', Vietnam: 'Vietnam', Philippines: 'Philippines', China: 'China',
  Indonesia: 'Indonesia, Malaysia and Thailand', Malaysia: 'Indonesia, Malaysia and Thailand', Thailand: 'Indonesia, Malaysia and Thailand', Myanmar: 'Myanmar', Bhutan: 'Bhutan',
  Nigeria: 'Africa', Kenya: 'Africa', Ghana: 'Africa', Brazil: 'Latin America and Europe', Colombia: 'Latin America and Europe', Germany: 'Latin America and Europe',
  'United Arab Emirates': 'Rest of world', Canada: 'Rest of world', 'United States': 'Rest of world',
};
export const DESTINATIONS = ['Australia', 'United Kingdom', 'Canada', 'United States', 'New Zealand', 'Ireland'];

/** Runs the rules from the top: the first that matches sets the region and BDM (PM: routing with its trace). */
export function route(rules: RouteRule[], lists: Record<string, string[]>, a: { rp: string; nationality: string; now: string; dest: string; rpInfo?: RoutingRp }, defaults: Record<string, string> = REGION_BDM) {
  // any RP, not only the test's: the caller says where it is (data/regions.ts)
  const rp = ROUTING_RPS.find((r) => r.name === a.rp) ?? (a.rp ? a.rpInfo : undefined);
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
  // the acceptance document, by destination (Jovial, 31 Oct): the application's status and requests name it from here
  dr('Confirmation of Enrolment (CoE)', 'Acceptance', 'University in Australia', 'Mandatory', 'GSP'),
  dr('Confirmation of Acceptance for Studies (CAS)', 'Acceptance', 'University in the UK', 'Mandatory', 'GSP'),
  dr('Form I-20', 'Acceptance', 'University in the USA', 'Mandatory', 'GSP'),
  dr('Letter of Acceptance (LOA)', 'Acceptance', 'University in Canada', 'Mandatory', 'GSP'),
  dr('Provincial Attestation Letter (PAL)', 'Acceptance', 'University in Canada', 'Mandatory', 'GSP'),
  dr('Offer of Place', 'Acceptance', 'University in New Zealand', 'Mandatory', 'GSP'),
  dr('Letter of acceptance', 'Acceptance', 'University in Ireland', 'Mandatory', 'GSP'),
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
  { id: 'l1', at: Date.now() - 3 * 3_600_000, who: N('jovial.lejo'), area: 'BDM assignment', text: `Edited India · Kerala → ${N('mayank.kansal')}`, kind: 'change', role: 'Admin' },
  { id: 'l2', at: at(1, 12, 41), who: N('ramish.jafery'), area: 'Applications', text: 'Applications list', kind: 'download', role: 'Admission', filters: 'India · Status: With university', size: '312 rows', format: 'CSV' },
  { id: 'l3', at: at(1, 11, 2), who: N('saurabh.chaudhary'), area: 'Course search', text: 'Course shortlist', kind: 'download', role: 'Recruitment', filters: 'Australia · Master’s · Data science', size: '8 rows', format: 'CSV' },
  { id: 'l4', at: at(2, 18, 20), who: N('lav.likhi'), area: 'Commissions', text: 'RP ledger', kind: 'download', role: 'Finance', filters: 'Oct 2026', size: '1,204 rows', format: 'CSV' },
  { id: 'l5', at: at(2, 15, 5), who: N('jovial.lejo'), area: 'Application routing', text: 'Moved “Onshore, RP has no Australian branch” above “Onshore application”', kind: 'change', role: 'Admin' },
  { id: 'l6', at: at(2, 10, 15), who: N('lalaine.dizon'), area: 'Universities', text: 'Universities', kind: 'download', role: 'Institution', filters: 'Country: Australia', size: '86 rows', format: 'CSV' },
  { id: 'l7', at: at(3, 16, 40), who: N('kamrun.nahar'), area: 'Students', text: 'Students', kind: 'download', role: 'Admission', filters: 'Bangladesh · Added in October', size: '214 rows', format: 'CSV' },
  { id: 'l8', at: at(4, 9, 55), who: N('suman1.verma'), area: 'Commissions', text: 'University ledger', kind: 'download', role: 'Finance', filters: 'Status: Payment overdue', size: '37 rows', format: 'CSV' },
  { id: 'l9', at: at(6, 14, 30), who: N('garima.bhardwaj'), area: 'Recruitment partners', text: 'Recruitment partners', kind: 'download', role: 'Recruitment Ops', filters: 'Status: Verification pending', size: '52 rows', format: 'CSV' },
  { id: 'l10', at: at(9, 17, 10), who: N('myleeta.williams'), area: 'Applications', text: 'Applications list', kind: 'download', role: 'View Only', filters: 'None', size: '41,805 rows', format: 'CSV' },
];
