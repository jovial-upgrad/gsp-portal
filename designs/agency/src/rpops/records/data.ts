/**
 * RP Ops' recruitment partners (Nesil, 4 Nov): the Institution Team's records of them, plus what RP Ops does with
 * them. It verifies or sends back each onboarding document (with a note), keeps the GSP side (the BDM, the Master
 * Partner), edits the details, keeps the branches and the team (as the RP Admin's Profile does), and sends the
 * partner agreement: RP Ops uploads each version and sends it, the RP Admin signs it and uploads the signed copy, and
 * RP Ops accepts it or sends it back. Accepting the first one approves the partner. One agreement is active at a
 * time. These stay in RP Ops' portal. 4 Nov (later): no first call.
 */
import { partnerManagerFor } from '../../data/partners';
import type { TeamRole } from '../../data/students';
import { sampleRps, todayIso, type RecruitmentPartner, type RpDoc } from '../../institution/data/records';

const DAY = 86_400_000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "4 Nov 2026" from "2026-11-04". */
export const dayOf = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
};
/** "4 Nov 2026, 13:37" */
export const stampOf = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** A document, with who decided on it and when, and why when it was sent back. */
export type OpsDoc = RpDoc & { by?: string; at?: number; reason?: string };
export type FileMeta = { name: string; size: number };
export type AgreementStatus = 'draft' | 'sent' | 'signed' | 'sent-back' | 'accepted' | 'replaced';
export type OpsAgreement = {
  id: string;
  /** What the RP sees, like "v4 · Nov 2026". */
  version: string;
  file: FileMeta;
  notes?: string;
  /** YYYY-MM-DD; empty: the day the signed copy is accepted. */
  effective?: string;
  status: AgreementStatus;
  sent?: { at: number; by: string };
  /** The signed copy the RP Admin uploaded. */
  signed?: { file: FileMeta; on: string; by: string; at: number };
  decision?: { by: string; at: number; reason?: string };
};
/** One of the RP's offices, with its BDM (set by the system from BDM assignment). The head office comes from the business details. */
export type Branch = { id: string; name: string; country: string; state: string; city: string; contact: string; head?: boolean };
/** Someone on the RP's team, as its Profile lists them: their contact, role and branch; `invited` until they accept. */
export type OpsMember = { id: string; name: string; email: string; dial: string; phone: string; role: TeamRole; branch?: string; invited?: boolean };
/** How GSP pays a recruitment partner (GSP · Finance, 6 Nov). */
export type RpCommission = { plan: (typeof RP_PLANS)[number]; share: number; cycle: (typeof RP_CYCLES)[number]; tax?: string; bank?: string; hold: boolean; holdWhy?: string; by?: string; at?: number };
export const RP_PLANS = ['Standard', 'Tiered', 'Custom'] as const;
export const RP_CYCLES = ['Monthly', 'Per intake', 'On enrolment'] as const;

export type OpsRp = Omit<RecruitmentPartner, 'docs'> & {
  docs: OpsDoc[];
  state?: string;
  owner?: string;
  cemail?: string;
  /** Its BDM at GSP (from Recruitment assignment), changed by RP Ops when needed. */
  recruitment: string;
  agreements: OpsAgreement[];
  branches: Branch[];
  team: OpsMember[];
  /** The Master Partner it's linked to (at most one), and since when: applications created after the link pay it. */
  mp?: string;
  mpSince?: string;
  /** GSP · Finance's commission terms for the partner (6 Nov); until saved, the standard terms. */
  commission?: RpCommission;
  /** What RP Ops did, newest last, with the time. */
  log: { at: number; what: string }[];
};

/** The sales region a country falls in (GSP · Admin's Sales Regions, sample). */
const REGIONS: Record<string, string> = { India: 'India', Bangladesh: 'Bangladesh', Nepal: 'Nepal', 'Sri Lanka': 'Sri Lanka', Vietnam: 'Vietnam', Philippines: 'Philippines', Pakistan: 'Pakistan', Nigeria: 'Africa' };
export const regionOf = (country: string) => REGIONS[country] ?? 'Rest of world';
/** The BDM for a place, from BDM assignment (the same rule as a new agency's): the city's, else the state's or the country's. */
export const bdmFor = (country: string, city = '', state = '') => (country ? partnerManagerFor(country, city, '', state)?.name ?? '' : '');
/** GSP's BDMs, to change one to. */
export const BDMS = ['Aditya Rao', 'Sneha Kulkarni', 'Rohit Malhotra', 'Saurabh Chaudhary', 'Ankita Sen', 'Meera Pillai', 'Sujan Shrestha', 'Rafiq Ahmed', 'Dilini Perera', 'Tran Minh', 'Tina Huynh'];

const agreementFile = (v: number, month: string) => ({ name: `GSP-Partner-Agreement-v${v}-${month.replace(' ', '-')}.pdf`, size: 902_000 + v * 41_000 });
const signedFile = (code: string, v: number) => ({ name: `${code}-agreement-v${v}-signed.pdf`, size: 1_380_000 + v * 52_000 });

/** The Institution Team's sample partners, with RP Ops' side added. */
export function sampleOps(): OpsRp[] {
  const now = Date.now();
  const extra: Record<string, Partial<OpsRp>> = {
    'rp-brightpath': { state: 'Karnataka', owner: 'Asha Menon', cemail: 'accounts@brightpathoverseas.com' },
    'rp-eduvista': { state: 'Telangana' },
    'rp-horizon': { state: 'Maharashtra', owner: 'Ananya Rao', cemail: 'accounts@horizonoverseas.in' },
    'rp-delhi': { state: 'Delhi', owner: 'Manish Gupta', cemail: 'finance@capitalcareerabroad.in' },
    'rp-kathmandu': { state: 'Bagmati Zone', owner: 'Bikash Thapa' },
    'rp-saigon': { state: 'Hồ Chí Minh' },
    'rp-hanoi': { state: 'Hà Nội' },
    // under a Master Partner (see masters.ts)
    'rp-pokhara': { state: 'Gandaki Zone', mp: 'mp-1001', mpSince: '2026-01-10' },
  };
  return sampleRps().map((r) => {
    const live = r.status === 'Activated' || r.status === 'Agreement signed' || r.status === 'Dormant' || r.status === 'Suspended';
    const decided = Date.parse(`${r.since}T11:20:00`) + 2 * DAY;
    // decisions on the documents: earlier ones by a colleague; EduVista's first one this morning
    const docs: OpsDoc[] = r.docs.map((d, i) =>
      r.id === 'rp-eduvista' && i === 0
        ? { ...d, state: 'Verified', by: 'Garima Bhardwaj', at: now - 2 * 3_600_000 }
        : d.state === 'Verified'
          ? { ...d, by: 'Garima Bhardwaj', at: decided }
          : d.state === 'Sent back'
            ? { ...d, by: 'Garima Bhardwaj', at: decided, reason: d.name === 'Owner’s ID' ? 'The photo page is cut off: the number and the date of birth can’t be read.' : 'This isn’t the document asked for. Upload the one named here.' }
            : d,
    );
    const agreements: OpsAgreement[] =
      r.id === 'rp-horizon'
        ? [
            { id: 'h2', version: 'v2 · Aug 2024', file: agreementFile(2, 'Aug 2024'), status: 'accepted', effective: '2024-08-10', sent: { at: Date.parse('2024-08-08T10:05:00'), by: 'Garima Bhardwaj' }, signed: { file: signedFile(r.code, 2), on: '2024-08-09', by: 'Ananya Rao', at: Date.parse('2024-08-09T16:40:00') }, decision: { by: 'Garima Bhardwaj', at: Date.parse('2024-08-10T09:15:00') } },
            { id: 'h3', version: 'v3 · Nov 2026', file: agreementFile(3, 'Nov 2026'), notes: 'Commission tiers updated for 2027.', status: 'accepted', effective: '2026-12-01', sent: { at: now - 6 * 3_600_000, by: 'Garima Bhardwaj' }, signed: { file: signedFile(r.code, 3), on: todayIso(), by: 'Ananya Rao', at: now - 5 * 3_600_000 }, decision: { by: 'Garima Bhardwaj', at: now - 4 * 3_600_000 } },
          ]
        : r.status === 'Agreement signed'
          ? [{ id: `${r.id}-a2`, version: 'v2 · Aug 2024', file: agreementFile(2, 'Aug 2024'), status: 'accepted', effective: r.since, sent: { at: Date.parse(`${r.since}T10:00:00`), by: 'Garima Bhardwaj' }, signed: { file: signedFile(r.code, 2), on: r.since, by: r.contact.name, at: Date.parse(`${r.since}T15:00:00`) }, decision: { by: 'Garima Bhardwaj', at: Date.parse(`${r.since}T17:30:00`) } }]
          : r.id === 'rp-kathmandu'
            ? [{ id: 'k3', version: 'v3 · Nov 2026', file: agreementFile(3, 'Nov 2026'), status: 'sent', sent: { at: now - 2 * DAY, by: 'Garima Bhardwaj' } }]
            : [];
    const more = extra[r.id] ?? {};
    const state = more.state ?? '';
    // the head office comes from the business details once the partner is verified; a few have more branches
    const head: Branch = { id: `${r.id}-head`, name: r.city, country: r.country, state, city: r.city, contact: r.bdm, head: true };
    const branches: Branch[] = live ? [head, ...(BRANCHES[r.id] ?? []).map((b, i) => ({ ...b, id: `${r.id}-b${i + 1}`, contact: bdmFor(b.country, b.city, b.state) || r.bdm }))] : [];
    // the RP Admin who signed up, then the people they added
    const [dial, ...rest] = r.contact.phone.split(' ');
    const domain = r.contact.email.split('@')[1];
    const team: OpsMember[] = [
      { id: `${r.id}-m0`, name: r.contact.name, email: r.contact.email, dial, phone: rest.join(' '), role: 'RP Admin', branch: live ? head.id : undefined },
      ...(live ? (TEAM[r.id] ?? []) : []).map(([name, role, branch, phone, invited], i) => ({
        id: `${r.id}-m${i + 1}`,
        name,
        email: `${name.split(' ')[0].toLowerCase()}@${domain}`,
        dial,
        phone,
        role,
        branch: branch ? branches[branch]?.id ?? head.id : head.id,
        invited: invited || undefined,
      })),
    ];
    return { ...r, docs, recruitment: r.bdm, agreements, branches, team, log: [], ...more };
  });
}

/** More branches for a few sample partners (the head office comes first). */
const BRANCHES: Record<string, Omit<Branch, 'id' | 'contact'>[]> = {
  'rp-brightpath': [{ name: 'Mysuru', country: 'India', state: 'Karnataka', city: 'Mysuru' }],
  'rp-horizon': [
    { name: 'Pune', country: 'India', state: 'Maharashtra', city: 'Pune' },
    { name: 'Nashik', country: 'India', state: 'Maharashtra', city: 'Nashik' },
  ],
  'rp-kathmandu': [{ name: 'Lalitpur', country: 'Nepal', state: 'Bagmati Zone', city: 'Lalitpur' }],
  'rp-saigon': [{ name: 'Da Nang', country: 'Vietnam', state: 'Đà Nẵng', city: 'Da Nang' }],
};
/** Their teams after the RP Admin: name, role, which branch (its place in the list; the head office when 0), phone, still invited. */
const TEAM: Record<string, [string, TeamRole, number, string, boolean?][]> = {
  'rp-brightpath': [
    ['Karthik Nair', 'Counsellor', 0, '98450 22113'],
    ['Divya Shetty', 'Branch Admin', 1, '98201 76420'],
    ['Rahul Hegde', 'Counsellor', 1, '99001 34512', true],
  ],
  'rp-horizon': [
    ['Vikram Desai', 'Branch Admin', 1, '98221 40087'],
    ['Priya Nair', 'Counsellor', 0, '98190 55231'],
    ['Rohit Kulkarni', 'Counsellor', 1, '97300 12984'],
    ['Sneha Patil', 'Counsellor', 2, '98600 77412'],
  ],
  'rp-delhi': [['Neha Sharma', 'Counsellor', 0, '98111 20456']],
  'rp-kathmandu': [['Sita Karki', 'Counsellor', 1, '980 114 5521']],
  'rp-saigon': [
    ['Minh Nguyen', 'Branch Admin', 1, '90 822 3141'],
    ['Thu Le', 'Counsellor', 0, '90 711 5620'],
  ],
  'rp-hanoi': [['Quang Do', 'Counsellor', 0, '90 845 1102']],
  'rp-manila': [['Bea Santos', 'Counsellor', 0, '917 555 0187', true]],
};

/** The agreement in force today, the next one (accepted, starting later), and the one still moving. */
export function agreementsOf(r: OpsRp) {
  const today = todayIso();
  const accepted = r.agreements.filter((a) => a.status === 'accepted');
  const active = accepted.filter((a) => (a.effective ?? '') <= today).sort((a, b) => (b.effective ?? '').localeCompare(a.effective ?? ''))[0];
  const next = accepted.filter((a) => (a.effective ?? '') > today).sort((a, b) => (a.effective ?? '').localeCompare(b.effective ?? ''))[0];
  const moving = r.agreements.find((a) => a.status === 'draft' || a.status === 'sent' || a.status === 'signed' || a.status === 'sent-back');
  return { active, next, moving };
}

/** Every onboarding document the RP sent is verified. */
export const allVerified = (r: OpsRp) => r.docs.length > 0 && r.docs.every((d) => d.state === 'Verified');
