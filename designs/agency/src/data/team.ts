import { partnerManagerFor, type Contact } from './partners';
import type { Member, TeamRole } from './students';

/**
 * The roles (RP Admin only, Nesil 29 Oct). An RP Admin sees and manages everything; a Branch Admin, their branch;
 * a Counsellor, only their own students and applications.
 */
export const TEAM_ROLES: TeamRole[] = ['RP Admin', 'Branch Admin', 'Counsellor'];

/** One of the agency's offices. The head office is the one it registered with; it can't be removed. */
export type Branch = { id: string; name: string; country: string; state: string; city: string; main?: boolean };

/** The agency's branches (sample): the head office it registered with, and one more. */
export const sampleBranches = (): Branch[] => [
  { id: 'hq', name: 'Bengaluru head office', country: 'India', state: 'Karnataka', city: 'Bengaluru', main: true },
  { id: 'mumbai', name: 'Mumbai', country: 'India', state: 'Maharashtra', city: 'Mumbai' },
];

/**
 * Who looks after a branch for GSP, set by the system: the partner manager for its city when GSP has one there,
 * otherwise the agency's own (GSP can change it later).
 */
export const branchBdm = (b: Pick<Branch, 'country' | 'city'>, agency: Contact | null): Contact | null =>
  (b.city ? partnerManagerFor(b.country, b.city, '') : null) ?? agency;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
/** An RP Admin can't be removed while they're the only one. */
export const lastAdmin = (team: Member[], m: Member) => m.role === 'RP Admin' && team.filter((x) => x.role === 'RP Admin').length === 1;
