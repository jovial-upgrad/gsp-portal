import { partnerManagerFor, type Contact } from './partners';
import { rpBranches } from './rpteam';
import type { Member, TeamRole } from './students';

/**
 * The roles (RP Admin only, Nesil 29 Oct). An RP Admin sees and manages everything; a Branch Manager, their branch;
 * a Counsellor, only their own students and applications.
 */
export const TEAM_ROLES: TeamRole[] = ['RP Admin', 'Branch Manager', 'Counsellor'];

/** One of the agency's offices. The head office is the one it registered with; it can't be removed. */
export type Branch = { id: string; name: string; country: string; state: string; city: string; main?: boolean };

/** The agency's branches: the test agency's record (HC13: its head office and Mumbai, in the data set). */
export const sampleBranches = (): Branch[] => rpBranches();

/**
 * Who looks after a branch for GSP, set by the system: the partner manager for its city when GSP has one there,
 * otherwise the agency's own (GSP can change it later).
 */
export const branchBdm = (b: Pick<Branch, 'country' | 'city'>, agency: Contact | null): Contact | null =>
  (b.city ? partnerManagerFor(b.country, b.city, '') : null) ?? agency;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
/** An RP Admin can't be removed while they're the only one. */
export const lastAdmin = (team: Member[], m: Member) => m.role === 'RP Admin' && team.filter((x) => x.role === 'RP Admin').length === 1;
