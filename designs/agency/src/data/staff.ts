/**
 * GSP's people: the one list (Jovial, 31 Oct). Every GSP user anywhere in the prototype comes from here: Admin ›
 * Users, every person picker, the signed-in person in each role, queue leaders and members, task owners, Mail,
 * Finance's makers and checkers, BDMs and the contacts RPs see. No other file lists a GSP person.
 *
 * staff.json is the CRM's user export of 31 Oct 2026 (First name, Last name, Email, Permission role, Sales region,
 * and for Recruitment the area each BDM covers), as given. Only the sales regions are mapped to the portal's names
 * ("LatAM Europe" → "Latin America and Europe", "Indonesia-Malaysia-Thailand" → "Indonesia, Malaysia and Thailand",
 * "Myanmar" or "Bhutan" → "Myanmar and Bhutan"); `region` keeps the export's text.
 * Jovial's answers (31 Oct, Pending Questions sheet): one Sumit Singh (sumit.singh); Faryal Abbas in Recruitment only;
 * Kartik Sharma in Recruitment Ops; Caixia Qiu also covers China; Myanmar and Bhutan are separate regions. Phone
 * numbers and job titles aren't in the export: they're made up, as asked.
 * To change who's on the team, replace staff.json with a new export.
 */
import RAW from './staff.json';

export type StaffRole = 'Admin' | 'Admission' | 'Admission Ops' | 'Recruitment' | 'Recruitment Ops' | 'Institution' | 'Institution Ops' | 'Finance' | 'View Only';
export type Staff = {
  /** From the email address, so it never changes: u-ramish-jafery */
  id: string;
  first: string;
  last: string;
  email: string;
  role: StaffRole;
  /** The export's sales region text */
  region: string;
  /** The same, as the portal's sales regions */
  regions: string[];
  /** Recruitment: the cities or states the BDM covers, as in the export ('' when none) */
  area: string;
  /** Not in the export (Jovial, 31 Oct: "show both, create random"): sample phone numbers and job titles. */
  dial: string;
  phone: string;
  title: string;
};

export const STAFF: Staff[] = RAW as Staff[];

/** "Ramish Jafery" */
export const fullName = (s: Pick<Staff, 'first' | 'last'>) => `${s.first} ${s.last}`.trim();
const COUNT = new Map<string, number>();
(RAW as Staff[]).forEach((s) => COUNT.set(fullName(s), (COUNT.get(fullName(s)) ?? 0) + 1));
/**
 * The name shown in lists and pickers. Where two people share a name (the export has two Sumit Singhs), the email
 * name is added so a picker can tell them apart: "Sumit Singh (sumitkumar.singh)".
 */
export const label = (s: Staff) => ((COUNT.get(fullName(s)) ?? 0) > 1 ? `${fullName(s)} (${s.email.split('@')[0]})` : fullName(s));

const BY_ID = new Map(STAFF.map((s) => [s.id, s]));
const BY_EMAIL = new Map(STAFF.map((s) => [s.email.toLowerCase(), s]));

export const staffById = (id: string) => BY_ID.get(id);
export const staffByEmail = (email: string) => BY_EMAIL.get(email.toLowerCase());
/** A person by email; throws if they're not on the list, so a sample can't quietly name someone who isn't. */
export function person(email: string): Staff {
  const s = staffByEmail(email);
  if (!s) throw new Error(`${email} is not on GSP's staff list (data/staff.json)`);
  return s;
}
/** A person's name by email, for sample records that store a name. */
export const nameOf = (email: string) => label(person(email));
/** A person's id by email. */
export const idOf = (email: string) => person(email).id;
/** The label for an id, or '' */
export const labelOfId = (id: string) => { const s = BY_ID.get(id); return s ? label(s) : ''; };

export const staffIn = (role: StaffRole) => STAFF.filter((s) => s.role === role);
/** People who cover a sales region (Global people cover every region). */
export const staffFor = (region: string, role?: StaffRole) =>
  STAFF.filter((s) => (!role || s.role === role) && (s.regions.includes(region) || s.regions.includes('Global')));
