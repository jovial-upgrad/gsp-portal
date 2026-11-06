/**
 * What the Institution Team keeps (29 Oct): the institution partners GSP has agreements with, the universities under
 * them and their courses (GSP's catalogue, the one Course search reads, in catalogue.ts), and the recruitment
 * partners (RPs) who send students. Sample data; the team's changes are kept in its own portal, so RP Admin and GSP
 * Team never see them.
 *
 * 29 Oct (2nd round), from the PM prototype's IP team: a partner has a type, a relationship manager and a status the
 * team sets by hand; its agreement dates come from its documents; its commission is set up by Commissions and Finance.
 * 29 Oct (4th round, Nesil): the types are Direct and Third-party (no Aggregator), and either can have several
 * universities; nothing is automated, so the team enters everything by hand. 29 Oct (7th round): no legal entity;
 * each part of a record says who last changed it, and when.
 */
import { UNIVERSITIES, type Destination } from '../../data/courses';

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A record is checked against the institution's own site every four weeks; then it's due again. */
export const CHECK_DAYS = 28;
/** "30 Sep" as a date: this year's, or last year's if that's still to come. */
export function checkedAt(d: string) {
  const [day, mon, year] = d.split(' ');
  const now = new Date();
  const y = year ? Number(year) : now.getFullYear();
  const t = new Date(y, Math.max(0, MONTHS.indexOf(mon)), Number(day)).getTime();
  return !year && t > now.getTime() ? new Date(y - 1, MONTHS.indexOf(mon), Number(day)).getTime() : t;
}
export const daysSince = (d: string) => Math.floor((Date.now() - checkedAt(d)) / DAY);
export const isDue = (d: string) => daysSince(d) >= CHECK_DAYS;
/** Today, as records write it: "29 Oct". */
export const today = () => {
  const n = new Date();
  return `${n.getDate()} ${MONTHS[n.getMonth()]}`;
};
/** "Checked 30 Sep · 29 days ago", or "today". */
export const checkedText = (d: string) => {
  const n = daysSince(d);
  return `${d}${n <= 0 ? ', today' : n === 1 ? ', yesterday' : `, ${n} days ago`}`;
};

/* ---------- dates: kept as "2027-06-30", shown as "30 Jun 2027" ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Today and n days from it, as "2026-10-29". */
export const todayIso = () => isoOf(new Date());
export const inDays = (n: number) => isoOf(new Date(Date.now() + n * DAY));
const at = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
/** "30 Jun 2027"; with `short`, "30 Jun". */
export const dateText = (iso: string, short = false) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return short ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
};
/** Whole days from today to the date: negative once it's passed. */
export const daysTo = (iso: string) => Math.round((at(iso) - at(todayIso())) / DAY);
export const daysAgo = (iso: string) => -daysTo(iso);
/** "Ends in 31 days", "Ends in about 14 months", "Ended 8 months ago". */
export const endsText = (iso: string) => {
  const n = daysTo(iso);
  if (n < 0) return -n < 60 ? `Ended ${-n} ${-n === 1 ? 'day' : 'days'} ago` : `Ended about ${Math.round(-n / 30)} months ago`;
  if (n === 0) return 'Ends today';
  return n <= 60 ? `Ends in ${n} ${n === 1 ? 'day' : 'days'}` : n < 700 ? `Ends in about ${Math.round(n / 30.4)} months` : `Ends in about ${Math.round(n / 365)} years`;
};
/** "today", "yesterday", "3 days" for how long something has waited. */
export const waitedText = (iso: string) => {
  const n = daysAgo(iso);
  return n <= 0 ? 'Today' : n === 1 ? '1 day' : `${n} days`;
};

/* ---------- who changed what (29 Oct, 7th round) ---------- */

/** Who last changed a part of a record, and when: shown small, in italics, where it changed. */
export type Stamp = { by: string; at: string };
/** A record's stamps, one for each part that can change (its status, details, documents…). */
export type Stamps = Partial<Record<string, Stamp>>;
/** Now, as "2026-11-03T10:40": a stamp keeps the time too, for System information. */
export const nowIso = () => {
  const d = new Date();
  return `${isoOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const stampBy = (by: string): Stamp => ({ by, at: nowIso() });
/** "1 Jan 2026, 10:00"; just the date when no time was kept. */
export const dateTimeText = (iso: string) => (iso.length > 10 ? `${dateText(iso)}, ${iso.slice(11, 16)}` : dateText(iso));
/** One line of a record's Logs tab (3 Nov): who changed which part of it, what, and when. Newest first. */
export type LogLine = { id: string; at: string; by: string; part: string; what: string };
let lid = 0;
export const logLine = (by: string, part: string, what: string, at = nowIso()): LogLine => ({ id: `log-${(++lid).toString(36)}`, at, by, part, what });
/** The latest of a record's stamps, or when it was created. */
export const lastStamp = (stamps: Stamps, created: Stamp): Stamp =>
  Object.values(stamps).reduce<Stamp>((a, b) => (b && b.at > a.at ? b : a), created);

/* ---------- the team ---------- */

/** The Institution Team's members, who look after partners as relationship managers. */
export const TEAM = ['Raj Shamani', 'Kavya Menon', 'Arjun Mehta', 'Leena Thomas'] as const;

/* ---------- institution partners: who GSP has an agreement with ---------- */

export const PARTNER_TYPES = ['Direct', 'Third-party'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

/** Where a partner is with GSP. The team sets it by hand, in any order; nothing moves it on its own. */
export const BEFORE = ['Prospect', 'Met with', 'Proposal sent', 'Application submitted', 'Application received', 'Verbal approval', 'Agreement received'] as const;
export const EXECUTED = 'Agreement executed';
export const CLOSED = ['Not interested', 'Did not proceed', 'Terminated by GSP', 'Terminated by the institution', 'Merged with another partner'] as const;
export const PARTNER_STATUSES = [...BEFORE, EXECUTED, ...CLOSED] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const isClosed = (s: PartnerStatus) => (CLOSED as readonly string[]).includes(s);
export const isBefore = (s: PartnerStatus) => (BEFORE as readonly string[]).includes(s);

export const DOC_TYPES = ['New agreement', 'Renewal', 'Commission change', 'Territory expansion', 'Sector expansion', 'Campus expansion'] as const;
export type DocType = (typeof DOC_TYPES)[number];
/** Only these carry the agreement's dates. */
export const DATED: DocType[] = ['New agreement', 'Renewal'];
export type PartnerDoc = { id: string; type: DocType; file: string; start: string; end: string; added: string; by: string };

export const CONTACT_FOR = ['Agreement and renewal', 'Finance and invoices', 'Marketing', 'Admissions'] as const;
export type ContactFor = (typeof CONTACT_FOR)[number];
/** 3 Nov: first and last name, title, what they're for, a phone with its country code (optional) and email. */
export type Contact = { id: string; first: string; last: string; title: string; for: ContactFor; dial: string; phone: string; email: string };
export const contactName = (c: Contact) => `${c.first} ${c.last}`.trim();
/** The dial code a contact's phone starts with, from where the partner or university is. */
export const DIAL: Record<string, string> = { Australia: '+61', UK: '+44', Canada: '+1', 'New Zealand': '+64', Ireland: '+353', USA: '+1' };
const PHONE_SHAPE: Record<string, string> = { '+61': '4## ### ###', '+44': '7### ######', '+1': '### ### ####', '+64': '21 ### ####', '+353': '8# ### ####' };
/** A sample mobile number in the country's shape, the same every time for the same email. */
const samplePhone = (dial: string, seed: string) => {
  let h = [...seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return (PHONE_SHAPE[dial] ?? '### ### ####').replace(/#/g, () => String((h = (h * 1103515245 + 12345) >>> 0) % 10));
};
/** Fills in a sample contact's dial code and phone (the first two at each place have one). */
export const withPhones = (list: Contact[], country: string): Contact[] =>
  list.map((c, i) => (c.dial ? c : { ...c, dial: DIAL[country] ?? '+61', phone: i < 2 ? samplePhone(DIAL[country] ?? '+61', c.email) : '' }));

/** Set up from the agreement by Commissions and Finance; a second person activates it. */
export type Commission = { rate: number; bonus: string; invoicing: string; state: 'Active' | 'Waiting for Finance' };

export type InstitutionPartner = {
  id: string;
  name: string;
  type: PartnerType;
  /** Where it's based. */
  country: string;
  website: string;
  /** Its relationship manager, from the team. */
  rm: string;
  status: PartnerStatus;
  docs: PartnerDoc[];
  commission: Commission | null;
  contacts: Contact[];
  added: string;
  /** Why it closed, when it did. */
  closedNote?: string;
  /** Who added it, and when (3 Nov: System information). */
  created: Stamp;
  /** Who last changed its status, details, documents and contacts. */
  stamps: Stamps;
};

/** The agreement as it stands: the New agreement or Renewal that ends last sets the dates. */
export function agreementOf(p: InstitutionPartner) {
  const d = p.docs.filter((x) => DATED.includes(x.type) && x.end).sort((a, b) => b.end.localeCompare(a.end))[0];
  return d ? { start: d.start, end: d.end, file: d.file, type: d.type } : null;
}
/** Where each partner sits for the page's tiles; an executed agreement can also be ending or have ended. */
export type Stage = 'executed' | 'before' | 'ending' | 'ended' | 'closed';
export function stagesOf(p: InstitutionPartner): Stage[] {
  if (isClosed(p.status)) return ['closed'];
  if (p.status !== EXECUTED) return ['before'];
  const a = agreementOf(p);
  if (!a) return ['executed'];
  const n = daysTo(a.end);
  return n < 0 ? ['ended'] : n <= 60 ? ['executed', 'ending'] : ['executed'];
}
/** Its universities can go live only while its agreement is executed and in date. */
export const canGoLive = (p: InstitutionPartner | undefined) => !!p && p.status === EXECUTED && (agreementOf(p) ? daysTo(agreementOf(p)!.end) >= 0 : false);

let n = 0;
const nid = (p: string) => `${p}-${(++n).toString(36)}`;
const doc = (type: DocType, file: string, start: string, end: string, added: string, by = 'Raj Shamani'): PartnerDoc => ({ id: nid('doc'), type, file, start, end, added, by });
const contact = (name: string, title: string, f: ContactFor, email: string): Contact => {
  const [first, ...rest] = name.split(' ');
  return { id: nid('ct'), first, last: rest.join(' '), title, for: f, dial: '', phone: '', email };
};
const uni = (id: string) => UNIVERSITIES.find((x) => x.id === id)!;
const fileName = (name: string) => name.replace(/^University of /, '').replace(/ University$/, '').replace(/[^A-Za-z]+/g, '_');

/** A university's own agreement with GSP. */
function direct(id: string, rm: string, start: string, end: string, contacts: Contact[], extra: Partial<InstitutionPartner> = {}): InstitutionPartner {
  const u = uni(id);
  const file = `${fileName(u.name)}_GSP_agreement_${start.slice(0, 4)}.pdf`;
  return {
    id: `ip-${id}`,
    name: u.name,
    type: 'Direct',
    country: u.country,
    website: u.website ?? '',
    rm,
    status: EXECUTED,
    docs: [doc('New agreement', file, start, end, start)],
    commission: { rate: u.rate, bonus: u.rate >= 15 ? '+2% above 40 enrolments a year' : 'None', invoicing: 'After census; claim within 6 months', state: 'Active' },
    contacts,
    added: start,
    created: { by: rm, at: `${start}T10:00` },
    stamps: {},
    ...extra,
  };
}

/**
 * Every university in the catalogue sits under one of these. Most are direct agreements; three third-party groups
 * cover several each. A few are still being agreed, and one didn't go ahead. Dates that matter for the tiles (an
 * agreement ending soon, one that ended) are set from today.
 */
export const samplePartners = (): InstitutionPartner[] => rawPartners().map((p) => ({ ...p, contacts: withPhones(p.contacts, p.country) }));
const rawPartners = (): InstitutionPartner[] => [
  direct('flinders', 'Raj Shamani', '2025-01-01', '2027-12-31', [contact('Sarah Lim', 'International partnerships', 'Agreement and renewal', 'partnerships@flinders.edu.au')], {
    docs: [doc('New agreement', 'Flinders_GSP_agreement_2025.pdf', '2025-01-01', '2027-12-31', '2025-01-01'), doc('Commission change', 'Flinders_rate_variation_2027.pdf', '2027-01-01', '', inDays(-12), 'Kavya Menon')],
    stamps: { documents: { by: 'Kavya Menon', at: inDays(-12) }, contacts: { by: 'Raj Shamani', at: inDays(-30) } },
  }),
  direct('adelaide', 'Raj Shamani', '2026-01-01', '2028-12-31', [contact('Tom Nguyen', 'Agent relations', 'Agreement and renewal', 'partnerships@adelaideuni.edu.au'), contact('Megan Price', 'Accounts', 'Finance and invoices', 'accounts@adelaideuni.edu.au')]),
  direct('deakin', 'Kavya Menon', '2025-07-01', '2027-06-30', [contact('Hannah Clarke', 'International partnerships manager', 'Agreement and renewal', 'partnerships@deakin.edu.au')]),
  direct('newcastle', 'Arjun Mehta', '2025-03-01', '2028-02-29', [contact('Priya Raman', 'Agent manager, South Asia', 'Agreement and renewal', 'partnerships@newcastle.edu.au')]),
  direct('uow', 'Kavya Menon', '2025-01-01', '2027-12-31', [contact('Liam Foster', 'Partnerships officer', 'Agreement and renewal', 'partnerships@uow.edu.au')]),
  direct('cqu', 'Arjun Mehta', '2025-01-01', '2027-12-31', [contact('Grace Wu', 'International recruitment', 'Agreement and renewal', 'partnerships@cqu.edu.au')]),
  direct('vu', 'Raj Shamani', '2025-01-01', '2027-12-31', [contact('Daniel Ross', 'Agent relations', 'Agreement and renewal', 'partnerships@vu.edu.au')]),
  direct('rmit', 'Leena Thomas', '2025-05-01', '2028-04-30', [contact('Emily Hart', 'Agent partnerships', 'Agreement and renewal', 'partnerships@rmit.edu.au')]),
  direct('feduni', 'Leena Thomas', '2025-01-01', '2027-12-31', [contact('Mark Elliot', 'International office', 'Agreement and renewal', 'partnerships@federation.edu.au')]),
  // ending inside 60 days: the reminder has gone to the relationship manager
  direct('coventry', 'Raj Shamani', '2023-12-01', inDays(32), [contact('Priyanka Shah', 'Regional manager, South Asia', 'Agreement and renewal', 'partnerships@coventry.ac.uk')]),
  direct('herts', 'Kavya Menon', '2024-01-15', inDays(47), [contact('Olivia Grant', 'Agent manager', 'Agreement and renewal', 'partnerships@herts.ac.uk')]),
  direct('northumbria', 'Arjun Mehta', '2025-09-01', '2027-08-31', [contact('James Holt', 'Partnerships officer', 'Agreement and renewal', 'partnerships@northumbria.ac.uk')]),
  direct('leeds', 'Leena Thomas', '2025-09-01', '2028-08-31', [contact('Rachel Moore', 'International partnerships', 'Agreement and renewal', 'partnerships@leeds.ac.uk')]),
  direct('birmingham', 'Leena Thomas', '2025-09-01', '2028-08-31', [contact('Oliver Bennett', 'Agent relations', 'Agreement and renewal', 'partnerships@bham.ac.uk')]),
  direct('windsor', 'Arjun Mehta', '2025-05-01', '2027-04-30', [contact('Marc Tremblay', 'International recruitment', 'Agreement and renewal', 'partnerships@uwindsor.ca')]),
  direct('fanshawe', 'Arjun Mehta', '2026-01-01', '2028-12-31', [contact('Sarah Kim', 'Agent relations', 'Agreement and renewal', 'partnerships@fanshawec.ca')]),
  // ended, not renewed: its university is paused
  direct('massey', 'Leena Thomas', '2023-03-01', inDays(-243), [contact('Aroha Ngata', 'International office', 'Agreement and renewal', 'partnerships@massey.ac.nz')]),
  direct('waikato', 'Leena Thomas', '2025-02-01', '2028-01-31', [contact('Ben Walker', 'International partnerships', 'Agreement and renewal', 'partnerships@waikato.ac.nz')]),
  direct('lincoln', 'Leena Thomas', '2025-02-01', '2028-01-31', [contact('Hana Sato', 'Agent relations', 'Agreement and renewal', 'partnerships@lincoln.ac.nz')]),
  direct('griffith', 'Kavya Menon', '2025-09-01', '2027-08-31', [contact('Ciaran Doyle', 'International office', 'Agreement and renewal', 'partnerships@griffith.ie')]),
  direct('dbs', 'Kavya Menon', '2025-09-01', '2027-08-31', [contact('Aoife Kelly', 'Agent relations', 'Agreement and renewal', 'partnerships@dbs.ie')]),
  direct('ul', 'Kavya Menon', '2025-09-01', '2027-08-31', [contact('Ciara Byrne', 'International partnerships', 'Agreement and renewal', 'partnerships@ul.ie')]),
  {
    id: 'ip-southbridge',
    name: 'Southbridge Pathways',
    type: 'Third-party',
    country: 'Australia',
    website: 'southbridgepathways.com.au',
    rm: 'Raj Shamani',
    status: EXECUTED,
    docs: [doc('New agreement', 'Southbridge_GSP_agreement_2025.pdf', '2025-02-01', '2027-01-31', '2025-02-01'), doc('Campus expansion', 'Southbridge_UniSC_Moreton_Bay.pdf', '2026-02-01', '2027-01-31', '2026-01-20', 'Kavya Menon')],
    commission: { rate: 15, bonus: '+1% above 60 enrolments a year', invoicing: 'After census; claim within 6 months', state: 'Active' },
    contacts: [contact('Mia Collins', 'Partner manager', 'Agreement and renewal', 'mia.collins@southbridgepathways.com.au'), contact('Jack Turner', 'Accounts', 'Finance and invoices', 'accounts@southbridgepathways.com.au')],
    added: '2025-02-01',
    created: { by: 'Raj Shamani', at: '2025-02-01T10:00' },
    stamps: {},
  },
  {
    id: 'ip-northgate',
    name: 'Northgate University Group',
    type: 'Third-party',
    country: 'UK',
    website: 'northgategroup.ac.uk',
    rm: 'Arjun Mehta',
    status: EXECUTED,
    docs: [doc('New agreement', 'Northgate_GSP_agreement_2024.pdf', '2024-10-01', '2026-09-30', '2024-10-01', 'Arjun Mehta'), doc('Renewal', 'Northgate_GSP_renewal_2026.pdf', '2026-10-01', '2028-09-30', '2026-09-12', 'Arjun Mehta')],
    commission: { rate: 13, bonus: 'None', invoicing: 'After the first term’s fee is paid', state: 'Waiting for Finance' },
    contacts: [contact('Daniel Price', 'Head of agent partnerships', 'Agreement and renewal', 'd.price@northgategroup.ac.uk')],
    added: '2024-10-01',
    created: { by: 'Arjun Mehta', at: '2024-10-01T10:00' },
    stamps: {},
  },
  {
    id: 'ip-campusconnect',
    name: 'Campus Connect Global',
    type: 'Third-party',
    country: 'Canada',
    website: 'campusconnectglobal.com',
    rm: 'Leena Thomas',
    status: EXECUTED,
    docs: [doc('New agreement', 'CampusConnect_GSP_agreement_2025.pdf', '2025-06-01', '2028-05-31', '2025-06-01', 'Leena Thomas'), doc('Territory expansion', 'CampusConnect_Nepal_Bangladesh.pdf', '2026-03-01', '2028-05-31', '2026-02-18', 'Leena Thomas')],
    commission: { rate: 12, bonus: 'Tiered: 14% above 100 enrolments a year', invoicing: 'Monthly, after census', state: 'Active' },
    contacts: [contact('Noah Gill', 'Partner success', 'Agreement and renewal', 'partners@campusconnectglobal.com'), contact('Ravi Nair', 'Billing', 'Finance and invoices', 'billing@campusconnectglobal.com')],
    added: '2025-06-01',
    created: { by: 'Leena Thomas', at: '2025-06-01T10:00' },
    stamps: {},
  },
  // still being agreed: a direct prospect, with its university already set up and waiting to go live
  {
    id: 'ip-utas',
    name: 'University of Tasmania',
    type: 'Direct',
    country: 'Australia',
    website: 'utas.edu.au',
    rm: 'Raj Shamani',
    status: 'Verbal approval',
    docs: [],
    commission: null,
    contacts: [contact('Chloe Martin', 'International partnerships', 'Agreement and renewal', 'partnerships@utas.edu.au')],
    added: inDays(-40),
    created: { by: 'Raj Shamani', at: `${inDays(-40)}T10:00` },
    stamps: {},
  },
  { id: 'ip-kingsway', name: 'Kingsway Pathway Colleges', type: 'Third-party', country: 'UK', website: 'kingswaypathways.co.uk', rm: 'Arjun Mehta', status: 'Proposal sent', docs: [], commission: null, contacts: [], added: inDays(-21), created: { by: 'Arjun Mehta', at: `${inDays(-21)}T10:00` }, stamps: {} },
  { id: 'ip-edvance', name: 'Edvance Network', type: 'Third-party', country: 'Australia', website: 'edvancenetwork.com', rm: 'Kavya Menon', status: 'Met with', docs: [], commission: null, contacts: [], added: inDays(-9), created: { by: 'Kavya Menon', at: `${inDays(-9)}T10:00` }, stamps: {} },
  { id: 'ip-harbour', name: 'Pacific Harbour Group', type: 'Third-party', country: 'New Zealand', website: 'pacificharbour.ac.nz', rm: 'Leena Thomas', status: 'Did not proceed', docs: [], commission: null, contacts: [], added: '2025-11-03', closedNote: 'Wanted exclusivity in India.', created: { by: 'Leena Thomas', at: '2025-11-03T10:00' }, stamps: {} },
];

/** Which partner each university sits under. */
export const PARTNER_OF: Record<string, string> = {
  murdoch: 'ip-southbridge',
  canberra: 'ip-southbridge',
  unisc: 'ip-southbridge',
  abertay: 'ip-northgate',
  greenwich: 'ip-northgate',
  ulster: 'ip-northgate',
  algoma: 'ip-campusconnect',
  tru: 'ip-campusconnect',
  pace: 'ip-campusconnect',
  usf: 'ip-campusconnect',
};
export const partnerIdOf = (uniId: string) => PARTNER_OF[uniId] ?? `ip-${uniId}`;

/* ---------- recruitment partners: the agencies that send students ---------- */

/**
 * As the PM prototype's IP team sees them (29 Oct, 6th round): every recruitment partner and where it is in onboarding.
 * BAP works the Verifying ones; the Institution Team looks and exports, and changes nothing. No automated checks.
 */
export const RP_STATUSES = ['Not activated', 'Verifying', 'Documents sent back', 'Activated', 'Agreement signed', 'Rejected', 'Suspended', 'Dormant'] as const;
export type RpStatus = (typeof RP_STATUSES)[number];
export type RpDoc = { name: string; state: 'With BAP' | 'Verified' | 'Sent back' | 'Missing'; file: string };
export type RecruitmentPartner = {
  id: string;
  /** "AG-1042". */
  code: string;
  name: string;
  city: string;
  country: string;
  status: RpStatus;
  since: string;
  contact: { name: string; email: string; phone: string };
  foundUs: string;
  bdm: string;
  admissions: string;
  masterPartner: string;
  docs: RpDoc[];
  activity: { at: string; what: string }[];
};

const DOCS = ['Business registration certificate', 'Company profile', 'Owner’s ID', 'Business reference'];
const docs = (state: RpDoc['state'], missing = 0): RpDoc[] => DOCS.map((name, i) => ({ name, state: i >= DOCS.length - missing ? 'Missing' : state, file: `${name.replace(/[^A-Za-z]+/g, '_')}.pdf` }));
const rp = (id: string, code: number, name: string, city: string, country: string, status: RpStatus, since: string, contact: RecruitmentPartner['contact'], foundUs: string, bdm: string, admissions: string, d: RpDoc[], activity: RecruitmentPartner['activity'], masterPartner = 'None'): RecruitmentPartner => ({ id, code: `AG-${code}`, name, city, country, status, since, contact, foundUs, bdm, admissions, masterPartner, docs: d, activity });

export const sampleRps = (): RecruitmentPartner[] => [
  rp('rp-dhaka', 1042, 'Dhaka Global Education', 'Dhaka', 'Bangladesh', 'Verifying', inDays(-8), { name: 'Nusrat Jahan', email: 'nusrat@dhakaglobaledu.com', phone: '+880 1711 552 019' }, 'Event or fair', 'Rafiq Ahmed', 'Sania Akter', docs('With BAP'), [{ at: inDays(-7), what: 'All documents uploaded' }, { at: inDays(-8), what: 'Signed up' }]),
  rp('rp-eduvista', 1043, 'EduVista Consultants', 'Hyderabad', 'India', 'Verifying', inDays(-9), { name: 'Kiran Reddy', email: 'kiran@eduvista.in', phone: '+91 98490 11220' }, 'Google search', 'Aditya Rao', 'Megha Malhotra', docs('With BAP'), [{ at: inDays(-8), what: 'All documents uploaded' }, { at: inDays(-9), what: 'Signed up' }]),
  rp('rp-lanka', 1044, 'Lanka Study Hub', 'Colombo', 'Sri Lanka', 'Not activated', inDays(-12), { name: 'Ruwan Silva', email: 'ruwan@lankastudyhub.lk', phone: '+94 77 220 5531' }, 'Another agency', 'Dilini Perera', 'Nimali Fernando', docs('With BAP', 3), [{ at: inDays(-12), what: 'Signed up' }]),
  rp('rp-colombo', 1045, 'Colombo EduConnect', 'Colombo', 'Sri Lanka', 'Documents sent back', inDays(-20), { name: 'Shanika Perera', email: 'shanika@colomboeduconnect.lk', phone: '+94 77 410 8821' }, 'Social media', 'Dilini Perera', 'Nimali Fernando', [...docs('Verified').slice(0, 2), { name: 'Owner’s ID', state: 'Sent back', file: 'Owners_ID.pdf' }, { name: 'Business reference', state: 'Verified', file: 'Business_reference.pdf' }], [{ at: inDays(-15), what: 'Owner’s ID sent back: the photo page is cut off' }, { at: inDays(-18), what: 'All documents uploaded' }, { at: inDays(-20), what: 'Signed up' }]),
  rp('rp-kathmandu', 1031, 'Kathmandu Study Link', 'Kathmandu', 'Nepal', 'Activated', inDays(-26), { name: 'Bikash Thapa', email: 'bikash@kathmandustudylink.com.np', phone: '+977 980 221 4410' }, 'GSP team member', 'Sujan Shrestha', 'Supriya Shrestha', docs('Verified'), [{ at: inDays(-20), what: 'Activated: agreement sent to sign' }, { at: inDays(-24), what: 'All documents verified' }, { at: inDays(-26), what: 'Signed up' }]),
  rp('rp-brightpath', 1029, 'BrightPath Overseas', 'Bengaluru', 'India', 'Activated', inDays(-31), { name: 'Asha Menon', email: 'asha.menon@brightpathoverseas.com', phone: '+91 98872 44114' }, 'A university', 'Aditya Rao', 'Megha Malhotra', docs('Verified'), [{ at: inDays(-27), what: 'Activated: agreement sent to sign' }, { at: inDays(-29), what: 'All documents verified' }, { at: inDays(-31), what: 'Signed up' }]),
  rp('rp-horizon', 1003, 'Horizon Overseas', 'Mumbai', 'India', 'Agreement signed', '2024-08-04', { name: 'Ananya Rao', email: 'ananya@horizonoverseas.in', phone: '+91 98200 11873' }, 'GSP team member', 'Sneha Kulkarni', 'Megha Malhotra', docs('Verified'), [{ at: '2024-08-19', what: 'Agreement signed' }, { at: '2024-08-12', what: 'Activated' }, { at: '2024-08-04', what: 'Signed up' }]),
  rp('rp-saigon', 1011, 'Saigon Bridge Education', 'Ho Chi Minh City', 'Vietnam', 'Agreement signed', '2025-01-19', { name: 'Lan Tran', email: 'lan@saigonbridge.vn', phone: '+84 90 811 2044' }, 'Event or fair', 'Tina Huynh', 'Thi Tuyet Hoa Nguyen', docs('Verified'), [{ at: '2025-02-02', what: 'Agreement signed' }, { at: '2025-01-19', what: 'Signed up' }]),
  rp('rp-delhi', 1007, 'Capital Career Abroad', 'Delhi', 'India', 'Agreement signed', '2024-11-10', { name: 'Manish Gupta', email: 'manish@capitalcareerabroad.in', phone: '+91 98110 77310' }, 'Another agency', 'Rohit Malhotra', 'Megha Malhotra', docs('Verified'), [{ at: '2024-11-25', what: 'Agreement signed' }, { at: '2024-11-10', what: 'Signed up' }]),
  rp('rp-hanoi', 1015, 'Lotus Study Abroad', 'Hanoi', 'Vietnam', 'Agreement signed', '2025-04-08', { name: 'Mai Pham', email: 'mai@lotusstudy.vn', phone: '+84 90 812 7731' }, 'Social media', 'Tina Huynh', 'Thi Tuyet Hoa Nguyen', docs('Verified'), [{ at: '2025-04-20', what: 'Agreement signed' }, { at: '2025-04-08', what: 'Signed up' }], 'Saigon Bridge Education'),
  rp('rp-pokhara', 1019, 'Himalayan Study Centre', 'Pokhara', 'Nepal', 'Agreement signed', '2025-03-12', { name: 'Anjali Gurung', email: 'anjali@himalayanstudy.com.np', phone: '+977 985 612 3301' }, 'GSP team member', 'Sujan Shrestha', 'Supriya Shrestha', docs('Verified'), [{ at: '2025-03-28', what: 'Agreement signed' }, { at: '2025-03-12', what: 'Signed up' }]),
  rp('rp-manila', 1021, 'Manila Study Link', 'Manila', 'Philippines', 'Agreement signed', '2025-03-12', { name: 'Paolo Reyes', email: 'paolo@manilastudylink.ph', phone: '+63 917 555 0142' }, 'Google search', 'Arielle Santos', 'Joy Castillo', docs('Verified'), [{ at: '2025-03-30', what: 'Agreement signed' }, { at: '2025-03-12', what: 'Signed up' }]),
  rp('rp-pune', 1009, 'Global Reach Education', 'Pune', 'India', 'Dormant', '2025-08-04', { name: 'Sameer Joshi', email: 'sameer@globalreachedu.in', phone: '+91 98220 44190' }, 'Another agency', 'Sneha Kulkarni', 'Megha Malhotra', docs('Verified'), [{ at: inDays(-60), what: 'Dormant: no applications for six months' }, { at: '2025-08-20', what: 'Agreement signed' }, { at: '2025-08-04', what: 'Signed up' }]),
  rp('rp-lagos', 1024, 'Lagos Edu Partners', 'Lagos', 'Nigeria', 'Suspended', '2025-05-06', { name: 'Chidi Okafor', email: 'chidi@lagosedupartners.ng', phone: '+234 803 555 0199' }, 'Event or fair', 'Faisal Ahmed', 'Ifeoma Nwosu', docs('Verified'), [{ at: inDays(-40), what: 'Suspended while GSP looks into two applications' }, { at: '2025-05-20', what: 'Agreement signed' }, { at: '2025-05-06', what: 'Signed up' }]),
  rp('rp-chittagong', 1046, 'Chittagong Edu Point', 'Chittagong', 'Bangladesh', 'Rejected', inDays(-45), { name: 'Tanvir Hasan', email: 'tanvir@ctgedupoint.com', phone: '+880 1819 220 433' }, 'Social media', 'Rafiq Ahmed', 'Sania Akter', docs('Sent back'), [{ at: inDays(-38), what: 'Rejected: the registration couldn’t be confirmed' }, { at: inDays(-45), what: 'Signed up' }]),
];

export type { Destination };
