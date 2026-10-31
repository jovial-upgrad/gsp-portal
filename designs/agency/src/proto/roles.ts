/**
 * Who the prototype is seen as, for testing: the recruitment partner's admin (the agency portal), GSP's own
 * team, or GSP's Institution Team (GSP · Institution), the GSP Team members a GSP admin gives access to keep the
 * institutions' records. GSP Team starts as a copy of the agency portal (src/gsp) so it can change without touching
 * RP Admin; the Institution Team started as a copy of GSP Team (src/institution) and never touches either. GSP
 * Admin (GSP · Admin, 30 Oct) builds on the Institution Team (src/admin), with its own configuration.
 */
export type Role = 'rp-admin' | 'gsp-team' | 'institution-partner' | 'gsp-admin';

export const ROLES: { key: Role; label: string; note: string }[] = [
  { key: 'rp-admin', label: 'RP Admin', note: 'The recruitment partner’s admin: the agency portal.' },
  { key: 'gsp-team', label: 'GSP Team', note: 'GSP’s own team: GSP’s side of every application.' },
  { key: 'institution-partner', label: 'GSP · Institution', note: 'GSP’s Institution Team: universities, courses and partners.' },
  { key: 'gsp-admin', label: 'GSP · Admin', note: 'GSP’s admins: configuration, and the Institution Team’s pages.' },
];

/** The two roles Side by side shows. */
export const PAIR: Role[] = ['rp-admin', 'gsp-team'];

export const roleOf = (v: string | null): Role => (v === 'gsp-team' || v === 'institution-partner' || v === 'gsp-admin' ? v : 'rp-admin');
