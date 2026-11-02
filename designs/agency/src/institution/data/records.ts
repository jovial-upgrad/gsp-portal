import { adminCfg } from '../../admin/data/store';
import { REGION_COUNTRIES } from '../../admin/data/config';
import { renewalDays } from '../../work/renewal';
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
import { nameOf, staffIn, label } from '../../data/staff';
import { partnerManagerFor, businessDocsFor, countryByName } from '../../data/partners';
import { RPS } from '../../data/dataset';
import { phoneOf, rpAdmin } from '../../data/rpteam';
import { NATIONALITY } from '../../admin/data/config';
import { SYSTEM, atIso, change, type Change, type Created } from './changelog';
/** An Institution person's name from the staff list, by the start of their email. */
const IN = (local: string) => nameOf(`${local}@upgrad.com`);
/** The Change log role of the sample's Institution people. */


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
  return n <= renewalDays() ? `Ends in ${n} ${n === 1 ? 'day' : 'days'}` : n < 700 ? `Ends in about ${Math.round(n / 30.4)} months` : `Ends in about ${Math.round(n / 365)} years`;
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
export const stampBy = (by: string): Stamp => ({ by, at: todayIso() });

/* ---------- the team ---------- */

/** The Institution Team's members, who look after partners as relationship managers. */
/** The Institution team: everyone on the staff list with the Institution role. */
export const TEAM: string[] = staffIn('Institution').map(label);

/* ---------- institution partners: who GSP has an agreement with ---------- */

export const PARTNER_TYPES = ['Direct', 'Third-party'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

/** Where a partner is with GSP. The team sets it by hand, in any order; nothing moves it on its own. */
export const BEFORE = ['Prospect', 'Met with', 'Proposal sent', 'Application submitted', 'Application received', 'Verbal approval', 'Agreement received'] as const;
export const EXECUTED = 'Agreement executed';
/** W30 (1 Nov): an executed agreement whose end date has passed, not renewed. */
export const ENDED = 'Agreement ended';
export const CLOSED = ['Not interested', 'Did not proceed', 'Terminated by GSP', 'Terminated by the institution', 'Merged with another IP'] as const;
export const PARTNER_STATUSES = [...BEFORE, EXECUTED, ENDED, ...CLOSED] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const isClosed = (s: PartnerStatus) => (CLOSED as readonly string[]).includes(s);
export const isBefore = (s: PartnerStatus) => (BEFORE as readonly string[]).includes(s);
/** The statuses Change offers (slice 2 PRD): every one except Agreement ended, which only job J1 sets. */
export const PICKABLE = PARTNER_STATUSES.filter((s) => s !== ENDED);

export const DOC_TYPES = ['New agreement', 'Renewal', 'Commission change', 'Territory expansion', 'Sector expansion', 'Campus expansion'] as const;
export type DocType = (typeof DOC_TYPES)[number];
/** Only these carry the agreement's dates. */
export const DATED: DocType[] = ['New agreement', 'Renewal'];
/** `at`: when it was uploaded (date and time); `added` is its day. */
export type PartnerDoc = { id: string; type: DocType; file: string; start: string; end: string; added: string; by: string; at?: number };

export const CONTACT_FOR = ['Agreement and renewal', 'Finance and invoices', 'Marketing', 'Admissions'] as const;
export type ContactFor = (typeof CONTACT_FOR)[number];
/** Slice 2 PRD: first and last name, title, what they're for, phone (with its country code) and email. `name` is the two together. */
export type Contact = { id: string; name: string; first?: string; last?: string; title: string; for: ContactFor; email: string; phone?: string };
/** A contact's first and last name, for older samples that kept one name. */
export const splitName = (c: Contact) => ({ first: c.first ?? c.name.split(' ')[0] ?? '', last: c.last ?? c.name.split(' ').slice(1).join(' ') });

/** Set up from the agreement by Commissions and Finance; a second person activates it. */
export type Commission = { rate: number; bonus: string; invoicing: string; state: 'Active' | 'Waiting for Finance' };

export type InstitutionPartner = {
  id: string;
  name: string;
  type: PartnerType;
  /** Where it's based: any country, its state (where the country has states) and city (slice 2 PRD). */
  country: string;
  state: string;
  city: string;
  /** Not a PRD field: kept for older readers, not shown or edited. */
  website?: string;
  /** Its relationship manager, from the team. */
  rm: string;
  status: PartnerStatus;
  docs: PartnerDoc[];
  commission: Commission | null;
  contacts: Contact[];
  added: string;
  /** Why it closed, when it did. */
  closedNote?: string;
  /** Who last changed its status, details, documents and contacts. */
  stamps: Stamps;
  /** The Change log (S2-14) and System information. */
  log: Change[];
  created: Created;
  /** The end date job J1 last acted on: it acts once per end date (Decision A, S2-28). */
  endedFor?: string;
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
  if (p.status === ENDED) return ['ended'];
  if (p.status !== EXECUTED) return ['before'];
  const a = agreementOf(p);
  if (!a) return ['executed'];
  const n = daysTo(a.end);
  // Decision A (S2-28): Agreement executed set by hand after the end date counts as in date
  return n >= 0 && n <= renewalDays() ? ['executed', 'ending'] : ['executed'];
}
/** The status as it stands: job J1 sets Agreement ended (once per end date), so the status is what's stored. */
export const statusNow = (p: InstitutionPartner): PartnerStatus => p.status;
/**
 * Its universities can go Live or be resumed while the partner is Agreement executed: in date, or set by hand after
 * the end date (Decision A, S2-28).
 */
export const canGoLive = (p: InstitutionPartner | undefined) => !!p && p.status === EXECUTED;
/** Executed by hand after its agreement's end date (Decision A): in date, and J1 leaves it alone for that end date. */
export const executedByHand = (p: InstitutionPartner) => {
  const a = agreementOf(p);
  return p.status === EXECUTED && !!a && daysTo(a.end) < 0;
};

let n = 0;
const nid = (p: string) => `${p}-${(++n).toString(36)}`;

/** The country list's names (ISO 3166) for the destinations the catalogue names shortly. */
export const GEO_NAME: Record<string, string> = { UK: 'United Kingdom', USA: 'United States' };
const AU: Record<string, string> = { SA: 'South Australia', VIC: 'Victoria', NSW: 'New South Wales', QLD: 'Queensland', WA: 'Western Australia', ACT: 'Australian Capital Territory', TAS: 'Tasmania', NT: 'Northern Territory' };
const US: Record<string, string> = { NY: 'New York', FL: 'Florida', KS: 'Kansas' };
/** A sample's state, from its campus address or city (the country list's states). */
export function stateFor(country: string, city: string, address = ''): string {
  const geo = countryByName(GEO_NAME[country] ?? country);
  const states = geo?.states ?? [];
  if (!states.length) return '';
  const au = address.match(/\b(SA|VIC|NSW|QLD|WA|ACT|TAS|NT)\b/);
  if (country === 'Australia' && au) return AU[au[1]];
  const us = address.match(/\b(NY|FL|KS)\b/);
  if (us) return US[us[1]];
  const named = states.find((st) => address.includes(st)) ?? states.find((st) => st === city || st.startsWith(`${city} `) || st === `County ${city}`) ?? states.find((st) => city && st.includes(city));
  return named ?? '';
}
const doc = (type: DocType, file: string, start: string, end: string, added: string, by = IN('kevin.mcewan')): PartnerDoc => ({ id: nid('doc'), type, file, start: DATED.includes(type) ? start : '', end: DATED.includes(type) ? end : '', added, by });
const contact = (name: string, title: string, f: ContactFor, email: string): Contact => ({ id: nid('ct'), name, first: name.split(' ')[0], last: name.split(' ').slice(1).join(' '), title, for: f, email });
const uni = (id: string) => UNIVERSITIES.find((x) => x.id === id)!;
const fileName = (name: string) => name.replace(/^University of /, '').replace(/ University$/, '').replace(/[^A-Za-z]+/g, '_');

/** A university's own agreement with GSP. */
function direct(id: string, rm: string, start: string, end: string, contacts: Contact[], extra: Partial<InstitutionPartner> = {}): RawPartner {
  const u = uni(id);
  const file = `${fileName(u.name)}_GSP_agreement_${start.slice(0, 4)}.pdf`;
  return {
    id: `ip-${id}`,
    name: u.name,
    type: 'Direct',
    country: GEO_NAME[u.country] ?? u.country,
    state: stateFor(u.country, u.campuses[0]?.city ?? '', u.campuses[0]?.address),
    city: u.campuses[0]?.city ?? '',
    rm,
    status: EXECUTED,
    docs: [doc('New agreement', file, start, end, start)],
    commission: { rate: u.rate, bonus: u.rate >= 15 ? '+2% above 40 enrolments a year' : 'None', invoicing: 'After census; claim within 6 months', state: 'Active' },
    contacts,
    added: start,
    stamps: {},
    log: [],
    created: { by: rm, at: atIso(start) },
    ...extra,
  };
}

/**
 * Every university in the catalogue sits under one of these. Most are direct agreements; three third-party groups
 * cover several each. A few are still being agreed, and one didn't go ahead. Dates that matter for the tiles (an
 * agreement ending soon, one that ended) are set from today.
 */
export const samplePartners = (): InstitutionPartner[] => partnerRows().map(filled);
/** Fills what older sample rows leave out: country list name, state, city, Change log and System information. */
const SAMPLE_CITY: Record<string, string> = { 'ip-southbridge': 'Perth', 'ip-northgate': 'London', 'ip-campusconnect': 'Toronto', 'ip-utas': 'Hobart', 'ip-kingsway': 'Manchester', 'ip-edvance': 'Sydney', 'ip-harbour': 'Auckland' };
const SAMPLE_STATE: Record<string, string> = { 'ip-southbridge': 'Western Australia', 'ip-campusconnect': 'Ontario', 'ip-utas': 'Tasmania', 'ip-edvance': 'New South Wales', 'ip-harbour': 'Auckland Region' };
type RawPartner = Omit<InstitutionPartner, 'state' | 'city' | 'log' | 'created'> & Partial<Pick<InstitutionPartner, 'state' | 'city' | 'log' | 'created'>>;
function filled(p: RawPartner): InstitutionPartner {
  const city = p.city || SAMPLE_CITY[p.id] || '';
  const country = GEO_NAME[p.country] ?? p.country;
  const created: Created = p.created ?? { by: p.rm, at: atIso(p.added) };
  const log: Change[] = p.log ?? [];
  return { ...p, country, city, state: p.state || SAMPLE_STATE[p.id] || stateFor(p.country, city), created, log: log.length ? log : [change(created.by, 'Institution', 'Partner created', '—', p.name, created.at)], docs: p.docs.map((d) => ({ ...d, at: d.at ?? atIso(d.added, 11) })) };
}
const partnerRows = (): RawPartner[] => [
  direct('flinders', IN('kevin.mcewan'), '2025-01-01', '2027-12-31', [contact('Sarah Lim', 'International partnerships', 'Agreement and renewal', 'partnerships@flinders.edu.au')], {
    docs: [doc('New agreement', 'Flinders_GSP_agreement_2025.pdf', '2025-01-01', '2027-12-31', '2025-01-01'), doc('Commission change', 'Flinders_rate_variation_2027.pdf', '2027-01-01', '', inDays(-12), IN('catherine.wilson'))],
    stamps: { documents: { by: IN('catherine.wilson'), at: inDays(-12) }, contacts: { by: IN('kevin.mcewan'), at: inDays(-30) } },
  }),
  direct('adelaide', IN('kevin.mcewan'), '2026-01-01', '2028-12-31', [contact('Tom Nguyen', 'Agent relations', 'Agreement and renewal', 'partnerships@adelaideuni.edu.au'), contact('Accounts team', 'Finance', 'Finance and invoices', 'accounts@adelaideuni.edu.au')]),
  direct('deakin', IN('catherine.wilson'), '2025-07-01', '2027-06-30', [contact('Hannah Clarke', 'International partnerships manager', 'Agreement and renewal', 'partnerships@deakin.edu.au')]),
  direct('newcastle', IN('namita.nath'), '2025-03-01', '2028-02-29', [contact('Priya Raman', 'Agent manager, South Asia', 'Agreement and renewal', 'partnerships@newcastle.edu.au')]),
  direct('uow', IN('catherine.wilson'), '2025-01-01', '2027-12-31', [contact('Liam Foster', 'Partnerships officer', 'Agreement and renewal', 'partnerships@uow.edu.au')]),
  direct('cqu', IN('namita.nath'), '2025-01-01', '2027-12-31', [contact('Grace Wu', 'International recruitment', 'Agreement and renewal', 'partnerships@cqu.edu.au')]),
  direct('vu', IN('kevin.mcewan'), '2025-01-01', '2027-12-31', [contact('Daniel Ross', 'Agent relations', 'Agreement and renewal', 'partnerships@vu.edu.au')]),
  direct('rmit', IN('lalaine.dizon'), '2025-05-01', '2028-04-30', [contact('Emily Hart', 'Agent partnerships', 'Agreement and renewal', 'partnerships@rmit.edu.au')]),
  direct('feduni', IN('lalaine.dizon'), '2025-01-01', '2027-12-31', [contact('Mark Elliot', 'International office', 'Agreement and renewal', 'partnerships@federation.edu.au')]),
  // ending inside 60 days: the reminder has gone to the relationship manager
  direct('coventry', IN('kevin.mcewan'), '2023-12-01', inDays(32), [contact('Priyanka Shah', 'Regional manager, South Asia', 'Agreement and renewal', 'partnerships@coventry.ac.uk')]),
  direct('herts', IN('catherine.wilson'), '2024-01-15', inDays(47), [contact('Olivia Grant', 'Agent manager', 'Agreement and renewal', 'partnerships@herts.ac.uk')]),
  direct('northumbria', IN('namita.nath'), '2025-09-01', '2027-08-31', [contact('James Holt', 'Partnerships officer', 'Agreement and renewal', 'partnerships@northumbria.ac.uk')]),
  direct('leeds', IN('lalaine.dizon'), '2025-09-01', '2028-08-31', [contact('Rachel Moore', 'International partnerships', 'Agreement and renewal', 'partnerships@leeds.ac.uk')]),
  direct('birmingham', IN('lalaine.dizon'), '2025-09-01', '2028-08-31', [contact('Oliver Bennett', 'Agent relations', 'Agreement and renewal', 'partnerships@bham.ac.uk')]),
  direct('windsor', IN('namita.nath'), '2025-05-01', '2027-04-30', [contact('Marc Tremblay', 'International recruitment', 'Agreement and renewal', 'partnerships@uwindsor.ca')]),
  direct('fanshawe', IN('namita.nath'), '2026-01-01', '2028-12-31', [contact('Sarah Kim', 'Agent relations', 'Agreement and renewal', 'partnerships@fanshawec.ca')]),
  // ended, not renewed: its university is paused
  // job J1 set it Agreement ended the day after its end date, and paused its university (S2-15)
  direct('massey', IN('lalaine.dizon'), '2023-03-01', inDays(-243), [contact('Aroha Ngata', 'International office', 'Agreement and renewal', 'partnerships@massey.ac.nz')], {
    status: ENDED,
    endedFor: inDays(-243),
    log: [change(SYSTEM, SYSTEM, 'Partner · Status', EXECUTED, ENDED, atIso(inDays(-242), 1)), change(IN('lalaine.dizon'), 'Institution', 'Partner created', '—', 'Massey University', atIso('2023-03-01'))],
  }),
  direct('waikato', IN('lalaine.dizon'), '2025-02-01', '2028-01-31', [contact('Ben Walker', 'International partnerships', 'Agreement and renewal', 'partnerships@waikato.ac.nz')]),
  // Decision A (S2-28): its agreement ended 12 days ago; job J1 set Agreement ended, then Institution set Agreement
  // executed by hand while the renewal is signed. It counts as in date, and J1 leaves it alone for that end date.
  direct('lincoln', IN('lalaine.dizon'), '2024-02-01', inDays(-12), [contact('Hana Sato', 'Agent relations', 'Agreement and renewal', 'partnerships@lincoln.ac.nz')], {
    endedFor: inDays(-12),
    stamps: { status: { by: IN('lalaine.dizon'), at: inDays(-10) } },
    log: [
      change(IN('lalaine.dizon'), 'Institution', 'Partner · Status', ENDED, EXECUTED, atIso(inDays(-10), 15)),
      change(SYSTEM, SYSTEM, 'Partner · Status', EXECUTED, ENDED, atIso(inDays(-11), 1)),
      change(IN('lalaine.dizon'), 'Institution', 'Partner created', '—', 'Lincoln University', atIso('2024-02-01')),
    ],
  }),
  direct('griffith', IN('catherine.wilson'), '2025-09-01', '2027-08-31', [contact('Ciaran Doyle', 'International office', 'Agreement and renewal', 'partnerships@griffith.ie')]),
  direct('dbs', IN('catherine.wilson'), '2025-09-01', '2027-08-31', [contact('Aoife Kelly', 'Agent relations', 'Agreement and renewal', 'partnerships@dbs.ie')]),
  direct('ul', IN('catherine.wilson'), '2025-09-01', '2027-08-31', [contact('Ciara Byrne', 'International partnerships', 'Agreement and renewal', 'partnerships@ul.ie')]),
  {
    id: 'ip-southbridge',
    name: 'Southbridge Pathways',
    type: 'Third-party',
    country: 'Australia',
    website: 'southbridgepathways.com.au',
    rm: IN('kevin.mcewan'),
    status: EXECUTED,
    docs: [doc('New agreement', 'Southbridge_GSP_agreement_2025.pdf', '2025-02-01', '2027-01-31', '2025-02-01'), doc('Campus expansion', 'Southbridge_UniSC_Moreton_Bay.pdf', '2026-02-01', '2027-01-31', '2026-01-20', IN('catherine.wilson'))],
    commission: { rate: 15, bonus: '+1% above 60 enrolments a year', invoicing: 'After census; claim within 6 months', state: 'Active' },
    contacts: [contact('Mia Collins', 'Partner manager', 'Agreement and renewal', 'mia.collins@southbridgepathways.com.au'), contact('Jack Turner', 'Accounts', 'Finance and invoices', 'accounts@southbridgepathways.com.au')],
    added: '2025-02-01',
    stamps: {},
  },
  {
    id: 'ip-northgate',
    name: 'Northgate University Group',
    type: 'Third-party',
    country: 'UK',
    website: 'northgategroup.ac.uk',
    rm: IN('namita.nath'),
    status: EXECUTED,
    docs: [doc('New agreement', 'Northgate_GSP_agreement_2024.pdf', '2024-10-01', '2026-09-30', '2024-10-01', IN('namita.nath')), doc('Renewal', 'Northgate_GSP_renewal_2026.pdf', '2026-10-01', '2028-09-30', '2026-09-12', IN('namita.nath'))],
    commission: { rate: 13, bonus: 'None', invoicing: 'After the first term’s fee is paid', state: 'Waiting for Finance' },
    contacts: [contact('Daniel Price', 'Head of agent partnerships', 'Agreement and renewal', 'd.price@northgategroup.ac.uk')],
    added: '2024-10-01',
    stamps: {},
  },
  {
    id: 'ip-campusconnect',
    name: 'Campus Connect Global',
    type: 'Third-party',
    country: 'Canada',
    website: 'campusconnectglobal.com',
    rm: IN('lalaine.dizon'),
    status: EXECUTED,
    docs: [doc('New agreement', 'CampusConnect_GSP_agreement_2025.pdf', '2025-06-01', '2028-05-31', '2025-06-01', IN('lalaine.dizon')), doc('Territory expansion', 'CampusConnect_Nepal_Bangladesh.pdf', '2026-03-01', '2028-05-31', '2026-02-18', IN('lalaine.dizon'))],
    commission: { rate: 12, bonus: 'Tiered: 14% above 100 enrolments a year', invoicing: 'Monthly, after census', state: 'Active' },
    contacts: [contact('Noah Gill', 'Partner success', 'Agreement and renewal', 'partners@campusconnectglobal.com'), contact('Billing', 'Finance', 'Finance and invoices', 'billing@campusconnectglobal.com')],
    added: '2025-06-01',
    stamps: {},
  },
  // still being agreed: a direct prospect, with its university already set up and waiting to go live
  {
    id: 'ip-utas',
    name: 'University of Tasmania',
    type: 'Direct',
    country: 'Australia',
    website: 'utas.edu.au',
    rm: IN('kevin.mcewan'),
    status: 'Verbal approval',
    docs: [],
    commission: null,
    contacts: [contact('Chloe Martin', 'International partnerships', 'Agreement and renewal', 'partnerships@utas.edu.au')],
    added: inDays(-40),
    stamps: {},
  },
  { id: 'ip-kingsway', name: 'Kingsway Pathway Colleges', type: 'Third-party', country: 'UK', website: 'kingswaypathways.co.uk', rm: IN('namita.nath'), status: 'Proposal sent', docs: [], commission: null, contacts: [], added: inDays(-21), stamps: {} },
  { id: 'ip-edvance', name: 'Edvance Network', type: 'Third-party', country: 'Australia', website: 'edvancenetwork.com', rm: IN('catherine.wilson'), status: 'Met with', docs: [], commission: null, contacts: [], added: inDays(-9), stamps: {} },
  { id: 'ip-harbour', name: 'Pacific Harbour Group', type: 'Third-party', country: 'New Zealand', website: 'pacificharbour.ac.nz', rm: IN('lalaine.dizon'), status: 'Did not proceed', docs: [], commission: null, contacts: [], added: '2025-11-03', closedNote: 'Wanted exclusivity in India.', stamps: {} },
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

/* ---------- job J1 (01:00 Asia/Kolkata): agreements that ended ---------- */

/**
 * Job J1 (S2-15, Decision A): the first day after the current agreement's end date, an Agreement executed partner
 * becomes Agreement ended and its Live universities become Paused, all stamped "System". It acts once per end date,
 * so a partner Institution then sets to Agreement executed by hand, with no Renewal, is left alone.
 */
export function agreementJob<U extends { id: string; ip: string; status: string; log: Change[]; stamps: Stamps }>(ips: InstitutionPartner[], unis: U[]): { ips: InstitutionPartner[]; unis: U[]; ended: string[] } {
  const ended: string[] = [];
  const at = Date.now();
  const out = ips.map((p) => {
    const a = agreementOf(p);
    if (p.status !== EXECUTED || !a || daysTo(a.end) >= 0 || p.endedFor === a.end) return p;
    ended.push(p.id);
    return { ...p, status: ENDED as PartnerStatus, endedFor: a.end, stamps: { ...p.stamps, status: { by: SYSTEM, at: todayIso() } }, log: [change(SYSTEM, SYSTEM, 'Partner · Status', EXECUTED, ENDED, at), ...p.log] };
  });
  const u2 = unis.map((u) => (ended.includes(u.ip) && u.status === 'Live' ? { ...u, status: 'Paused', stamps: { ...u.stamps, status: { by: SYSTEM, at: todayIso() } }, log: [change(SYSTEM, SYSTEM, 'University · Status', 'Live', 'Paused', at), ...u.log] } : u));
  return { ips: out, unis: u2, ended };
}

/* ---------- recruitment partners: the agencies that send students ---------- */

/**
 * As the PM prototype's IP team sees them (29 Oct, 6th round): every recruitment partner and where it is in onboarding.
 * BAP works the Verifying ones; the Institution Team looks and exports, and changes nothing. No automated checks.
 */
export const RP_STATUSES = ['Not activated', 'Verifying', 'Documents sent back', 'Activated', 'Agreement signed', 'Rejected', 'Suspended', 'Dormant'] as const;
export type RpStatus = (typeof RP_STATUSES)[number];
/** `note`: BAP's reason when it sent the document back; `at` and `by`: when and who decided (W4). */
export type RpDoc = { name: string; state: 'With BAP' | 'Verified' | 'Sent back' | 'Missing'; file: string; note?: string; at?: number; by?: string; optional?: boolean };
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
  /** A sign-up made in the RP portal (W5): kept in step with the agency's registration (data/rpverify.ts). */
  signup?: true;
  /** When BAP approved the partner, and who (W4). */
  approved?: { at: number; by: string };
  /** The RP agreement (slice 2 PRD, S2-4): uploaded by RP Ops before approval, sent on approval, signed by the RP. */
  agreement?: RpAgreement;
  /** The status before Suspended, which Reactivate returns to (S2C-9). */
  before?: RpStatus;
  /** T58 "Train <RP> on the portal" marked done by RP Ops (S4-22). */
  trained?: { at: number; by: string };
  /** Notices RP Ops issued (proposal S2C-12; starts T59). */
  notices?: RpNotice[];
  /** Branches GSP added from the RP's record (Recruitment, RP Ops, Admin; matrix RP branches and team). */
  branches?: { id: string; name: string; country: string; state: string; city: string; main?: boolean; bdm?: string }[];
};
/** The RP agreement's state, shown on Activated: Sent (waiting for the RP), Signed copy received (waiting for BAP), Sent back (waiting for the RP). */
export type RpAgreementState = 'Uploaded' | 'Sent' | 'Signed copy received' | 'Sent back' | 'Accepted';
export type RpAgreement = { file: string; version: string; uploadedAt: number; by: string; state: RpAgreementState; sentAt?: number; signed?: { file: string; on: string; at: number }; reason?: string; checked?: { by: string; at: number } };
export type RpNotice = { id: string; subject: string; message: string; file?: string; at: number; by: string };

/** An RP's documents: the ones GSP · Admin's rules ask an agency in its country for (data/partners.ts). */
let docsCountry = 'India';
const docs = (state: RpDoc['state'], missing = 0): RpDoc[] => {
  const names = businessDocsFor(docsCountry).map((d) => d.name);
  return names.map((name, i) => ({ name, state: i >= names.length - missing ? 'Missing' : state, file: `${name.replace(/[^A-Za-z]+/g, '_')}.pdf` }));
};
const rp = (id: string, code: number, name: string, city: string, country: string, status: RpStatus, since: string, contact: RecruitmentPartner['contact'], foundUs: string, bdm: string, admissions: string, d: RpDoc[], activity: RecruitmentPartner['activity'], masterPartner = 'None'): RecruitmentPartner => ({ id, code: `AG-${code}`, name, city, country, status, since, contact, foundUs, bdm, admissions, masterPartner, docs: d, activity });

/** Each RP's BDM and Admissions contact come from the staff list: the BDM by the RP's city (data/partners.ts), the contact as its sales region's (Admin › Sales regions). */
const staffed = (r: RecruitmentPartner): RecruitmentPartner => ({
  ...r,
  // the documents Admin's rules ask an agency in this country for, in the state the sample gave them
  docs: (() => {
    docsCountry = r.country;
    const want = businessDocsFor(r.country).map((d) => d.name);
    return want.map((name, i) => {
      const had = r.docs.find((x) => x.name === name) ?? r.docs[i] ?? r.docs[r.docs.length - 1];
      return { name, state: had ? had.state : 'Missing', file: `${name.replace(/[^A-Za-z]+/g, '_')}.pdf` };
    });
  })(),
  bdm: partnerManagerFor(r.country, r.city, '')?.name ?? '',
  admissions: adminCfg().regions.find((g) => g.name === (NATIONALITY[r.country] || r.country))?.contact ?? '',
});
/** Every other RP GSP's applications are with (data/dataset.ts), by Finance's id: signed partners, so their applications link here. */
const datasetRps = (): RecruitmentPartner[] =>
  RPS.map((r) => {
    // W31: its own city and the date it joined; W21: its contact is its RP Admin, from its one team record
    const admin = rpAdmin(r.name);
    const since = r.since ?? '2025-01-01';
    const test = r.id === 'R-TEST';
    return {
      id: test ? 'rp-test' : `rp-${r.id.toLowerCase()}`,
      code: test ? 'AG-1001' : /^\d+$/.test(r.id) ? `AG-${r.id}` : r.id,
      name: r.name.replace(/^Sample: /, ''),
      city: r.city ?? '',
      country: REGION_COUNTRIES[r.region]?.[0] ?? (r.region === 'Direct' ? 'Australia' : r.region),
      status: 'Agreement signed' as const,
      since,
      contact: { name: admin?.name ?? '', email: admin?.email ?? '', phone: phoneOf(admin) },
      foundUs: test ? 'GSP team member' : '',
      bdm: '',
      admissions: '',
      masterPartner: 'None',
      docs: docs('Verified'),
      activity: [
        { at: since, what: test ? 'Agreement signed; the RP signed in as RP Admin (the prototype’s own agency)' : r.terms ? 'Agreement signed; RP terms with Finance' : 'Agreement signed; no RP terms with Finance yet' },
        { at: since, what: 'Signed up' },
      ],
    };
  });
export const sampleRps = (): RecruitmentPartner[] => [...rpRows(), ...datasetRps()].map(staffed).map(withAgreement);
/** The samples' RP agreements: signed ones accepted; Kathmandu's sent and waiting; Bright Future's signed copy waiting for BAP. */
function withAgreement(r: RecruitmentPartner): RecruitmentPartner {
  const RO = nameOf('garima.bhardwaj@upgrad.com');
  const base = (at: string) => ({ file: `GSP_RP_agreement_${r.code}.pdf`, version: 'v3 · Oct 2026', uploadedAt: atIso(at, 9), by: RO, sentAt: atIso(at, 10) });
  if (r.id === 'rp-kathmandu') return { ...r, approved: { at: atIso(inDays(-20)), by: RO }, agreement: { ...base(inDays(-20)), state: 'Sent' } };
  if (r.id === 'rp-brightfuture') return { ...r, approved: { at: atIso(inDays(-27)), by: RO }, agreement: { ...base(inDays(-27)), state: 'Signed copy received', signed: { file: 'Bright_Future_signed_agreement.pdf', on: inDays(-2), at: atIso(inDays(-2), 15) } } };
  if (['Agreement signed', 'Dormant', 'Suspended'].includes(r.status))
    return { ...r, before: r.status === 'Suspended' ? 'Agreement signed' : r.before, trained: r.status === 'Agreement signed' && r.id !== 'rp-manila' ? { at: atIso(r.since), by: RO } : undefined, agreement: { ...base(r.since), state: 'Accepted', signed: { file: `${r.code}_signed_agreement.pdf`, on: r.since, at: atIso(r.since, 15) }, checked: { by: RO, at: atIso(r.since, 16) } } };
  return r;
}
const rpRows = (): RecruitmentPartner[] => [
  rp('rp-dhaka', 1042, 'Dhaka Global Education', 'Dhaka', 'Bangladesh', 'Verifying', inDays(-8), { name: 'Nusrat Jahan', email: 'nusrat@dhakaglobaledu.com', phone: '+880 1711 552 019' }, 'Event or fair', '', '', docs('With BAP'), [{ at: inDays(-7), what: 'All documents uploaded' }, { at: inDays(-8), what: 'Signed up' }]),
  rp('rp-eduvista', 1043, 'EduVista Consultants', 'Hyderabad', 'India', 'Verifying', inDays(-9), { name: 'Kiran Reddy', email: 'kiran@eduvista.in', phone: '+91 98490 11220' }, 'Google search', '', '', docs('With BAP'), [{ at: inDays(-8), what: 'All documents uploaded' }, { at: inDays(-9), what: 'Signed up' }]),
  rp('rp-lanka', 1044, 'Lanka Study Hub', 'Colombo', 'Sri Lanka', 'Not activated', inDays(-12), { name: 'Ruwan Silva', email: 'ruwan@lankastudyhub.lk', phone: '+94 77 220 5531' }, 'Another agency', '', '', docs('Missing'), [{ at: inDays(-12), what: 'Signed up' }]),
  rp('rp-colombo', 1045, 'Colombo EduConnect', 'Colombo', 'Sri Lanka', 'Documents sent back', inDays(-20), { name: 'Shanika Perera', email: 'shanika@colomboeduconnect.lk', phone: '+94 77 410 8821' }, 'Social media', '', '', [...docs('Verified').slice(0, 2), { name: 'Owner’s ID', state: 'Sent back', file: 'Owners_ID.pdf' }, { name: 'Business reference', state: 'Verified', file: 'Business_reference.pdf' }], [{ at: inDays(-15), what: 'Owner’s ID sent back: the photo page is cut off' }, { at: inDays(-18), what: 'All documents uploaded' }, { at: inDays(-20), what: 'Signed up' }]),
  rp('rp-kathmandu', 1031, 'Kathmandu Study Link', 'Kathmandu', 'Nepal', 'Activated', inDays(-26), { name: 'Bikash Thapa', email: 'bikash@kathmandustudylink.com.np', phone: '+977 980 221 4410' }, 'GSP team member', '', '', docs('Verified'), [{ at: inDays(-20), what: 'Activated: agreement sent to sign' }, { at: inDays(-24), what: 'All documents verified' }, { at: inDays(-26), what: 'Signed up' }]),
  rp('rp-brightfuture', 1029, 'Bright Future Overseas', 'Bengaluru', 'India', 'Activated', inDays(-31), { name: 'Meena Pillai', email: 'meena@brightfutureoverseas.com', phone: '+91 98872 44114' }, 'A university', '', '', docs('Verified'), [{ at: inDays(-27), what: 'Activated: agreement sent to sign' }, { at: inDays(-29), what: 'All documents verified' }, { at: inDays(-31), what: 'Signed up' }]),
  rp('rp-horizon', 1003, 'Horizon Overseas', 'Mumbai', 'India', 'Agreement signed', '2024-08-04', { name: 'Ananya Rao', email: 'ananya@horizonoverseas.in', phone: '+91 98200 11873' }, 'GSP team member', '', '', docs('Verified'), [{ at: '2024-08-19', what: 'Agreement signed' }, { at: '2024-08-12', what: 'Activated' }, { at: '2024-08-04', what: 'Signed up' }]),
  rp('rp-saigon', 1011, 'Saigon Bridge Education', 'Ho Chi Minh City', 'Vietnam', 'Agreement signed', '2025-01-19', { name: 'Lan Tran', email: 'lan@saigonbridge.vn', phone: '+84 90 811 2044' }, 'Event or fair', '', '', docs('Verified'), [{ at: '2025-02-02', what: 'Agreement signed' }, { at: '2025-01-19', what: 'Signed up' }]),
  rp('rp-delhi', 1007, 'Capital Career Abroad', 'Delhi', 'India', 'Agreement signed', '2024-11-10', { name: 'Manish Gupta', email: 'manish@capitalcareerabroad.in', phone: '+91 98110 77310' }, 'Another agency', '', '', docs('Verified'), [{ at: '2024-11-25', what: 'Agreement signed' }, { at: '2024-11-10', what: 'Signed up' }]),
  rp('rp-hanoi', 1015, 'Lotus Study Abroad', 'Hanoi', 'Vietnam', 'Agreement signed', '2025-04-08', { name: 'Mai Pham', email: 'mai@lotusstudy.vn', phone: '+84 90 812 7731' }, 'Social media', '', '', docs('Verified'), [{ at: '2025-04-21', what: 'Linked to Master Partner Mekong Education Network' }, { at: '2025-04-20', what: 'Agreement signed' }, { at: '2025-04-08', what: 'Signed up' }], 'Mekong Education Network'),
  rp('rp-pokhara', 1019, 'Himalayan Study Centre', 'Pokhara', 'Nepal', 'Agreement signed', '2025-03-12', { name: 'Anjali Gurung', email: 'anjali@himalayanstudy.com.np', phone: '+977 985 612 3301' }, 'GSP team member', '', '', docs('Verified'), [{ at: '2025-03-28', what: 'Agreement signed' }, { at: '2025-03-12', what: 'Signed up' }]),
  rp('rp-manila', 1021, 'Manila Study Link', 'Manila', 'Philippines', 'Agreement signed', '2025-03-12', { name: 'Paolo Reyes', email: 'paolo@manilastudylink.ph', phone: '+63 917 555 0142' }, 'Google search', '', '', docs('Verified'), [{ at: '2025-03-30', what: 'Agreement signed' }, { at: '2025-03-12', what: 'Signed up' }]),
  rp('rp-pune', 1009, 'Global Reach Education', 'Pune', 'India', 'Dormant', '2025-08-04', { name: 'Sameer Joshi', email: 'sameer@globalreachedu.in', phone: '+91 98220 44190' }, 'Another agency', '', '', docs('Verified'), [{ at: inDays(-60), what: 'Dormant: no applications for six months' }, { at: '2025-08-20', what: 'Agreement signed' }, { at: '2025-08-04', what: 'Signed up' }]),
  rp('rp-lagos', 1024, 'Lagos Edu Partners', 'Lagos', 'Nigeria', 'Suspended', '2025-05-06', { name: 'Chidi Okafor', email: 'chidi@lagosedupartners.ng', phone: '+234 803 555 0199' }, 'Event or fair', '', '', docs('Verified'), [{ at: inDays(-40), what: 'Suspended while GSP looks into two applications' }, { at: '2025-05-20', what: 'Agreement signed' }, { at: '2025-05-06', what: 'Signed up' }]),
  rp('rp-chittagong', 1046, 'Chittagong Edu Point', 'Chittagong', 'Bangladesh', 'Rejected', inDays(-45), { name: 'Tanvir Hasan', email: 'tanvir@ctgedupoint.com', phone: '+880 1819 220 433' }, 'Social media', '', '', docs('Sent back'), [{ at: inDays(-38), what: 'Rejected: the registration couldn’t be confirmed' }, { at: inDays(-45), what: 'Signed up' }]),
];

export type { Destination };
