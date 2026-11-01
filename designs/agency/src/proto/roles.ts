/**
 * Who the prototype is seen as, for testing: the recruitment partner's admin (the agency portal), GSP's own
 * team, or GSP's Institution Team (GSP · Institution), the GSP Team members a GSP admin gives access to keep the
 * institutions' records. GSP Team starts as a copy of the agency portal (src/gsp) so it can change without touching
 * RP Admin; the Institution Team started as a copy of GSP Team (src/institution) and never touches either. GSP
 * Admin (GSP · Admin, 30 Oct) builds on the Institution Team (src/admin), with its own configuration.
 */
export type Role = 'rp-admin' | 'gsp-team' | 'gsp-recruitment' | 'gsp-bap' | 'gsp-finance' | 'institution-partner' | 'gsp-admin';

/**
 * Jovial, 31 Oct: seven roles. GSP Team is now **GSP · Admissions** (its key stays `gsp-team`). GSP · Recruitment,
 * GSP · BAP and GSP · Finance are new: each is GSP Admin's portal (src/admin/portal) with its own menu and its own
 * signed-in person (see admin/portal/variants.ts).
 */
export const ROLES: { key: Role; label: string; note: string }[] = [
  { key: 'rp-admin', label: 'RP Admin', note: 'The recruitment partner’s admin: the agency portal.' },
  { key: 'gsp-team', label: 'GSP · Admissions', note: 'GSP’s Admissions team: GSP’s side of every application.' },
  { key: 'gsp-recruitment', label: 'GSP · Recruitment', note: 'BDMs: their recruitment partners, students and applications.' },
  { key: 'gsp-bap', label: 'GSP · BAP', note: 'Partner verification: new recruitment partners and their documents.' },
  { key: 'gsp-finance', label: 'GSP · Finance', note: 'Commission terms, university invoices and RP payouts.' },
  { key: 'institution-partner', label: 'GSP · Institution', note: 'GSP’s Institution Team: universities, courses and partners.' },
  { key: 'gsp-admin', label: 'GSP · Admin', note: 'GSP’s admins: configuration, and the Institution Team’s pages.' },
];
/** The roles that use GSP Admin's portal, each with its own menu. */
export const ADMIN_LIKE: Role[] = ['gsp-admin', 'gsp-recruitment', 'gsp-bap', 'gsp-finance'];

/** The two roles Side by side shows. */
export const PAIR: Role[] = ['rp-admin', 'gsp-team'];

export const roleOf = (v: string | null): Role => (ROLES.some((r) => r.key === v) ? (v as Role) : 'rp-admin');

/**
 * Each GSP role's permission role in GSP · Admin › Permission roles (Jovial, 1 Nov, HC47): its menu and edit rights
 * follow that role's line in the matrix. RP Admin is the agency's own portal, not GSP's.
 */
export const PERM_ROLE: Record<Role, string | null> = {
  'rp-admin': null,
  'gsp-team': 'Admission',
  'gsp-recruitment': 'Recruitment',
  'gsp-bap': 'Recruitment Ops',
  'gsp-finance': 'Finance',
  'institution-partner': 'Institution',
  'gsp-admin': 'Admin',
};
