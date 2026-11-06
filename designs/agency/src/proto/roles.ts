/**
 * Who the prototype is seen as, for testing (Jovial, 2 Nov): one signed-in person for every role in slice 1, the
 * 9 GSP roles and the 3 RP roles. Keys stay stable (gsp-team is Admission, gsp-bap is RP Ops, institution-partner is
 * Institution); the new ones reuse existing views as decided in S1-1:
 * - **Global Ops** reuses GSP · Admissions with every region and the oversight tab, and works Global Admissions.
 * - **IP Ops** reuses GSP · Institution (the Institution Team's portal, which IP Ops shares).
 * - **View Only** reuses GSP · Admin's pages, read only.
 * - **Branch Manager** and **Counsellor** reuse RP Admin with the lists cut to their branch, or their own students, and
 *   the admin-only actions removed.
 */
export type Role =
  | 'rp-admin'
  | 'rp-branch-admin'
  | 'rp-counsellor'
  | 'gsp-team'
  | 'gsp-global-ops'
  | 'gsp-recruitment'
  | 'gsp-bap'
  | 'gsp-finance'
  | 'institution-partner'
  | 'gsp-ip-ops'
  | 'gsp-admin'
  | 'gsp-view-only';

/** The 12 roles, labelled with slice 1's names, GSP's first in the PRD's order, then the RP's. */
export const ROLES: { key: Role; label: string; note: string }[] = [
  { key: 'gsp-admin', label: 'GSP · Admin', note: 'GSP’s system admins: users, roles, settings, logs; can do everything.' },
  { key: 'gsp-team', label: 'GSP · Admission', note: 'Regional admissions officers: applications in their regions.' },
  { key: 'gsp-global-ops', label: 'GSP · Global Ops', note: 'The central admissions team: the Global Admissions queue, and oversight of every queue and mailbox.' },
  { key: 'gsp-recruitment', label: 'GSP · Recruitment', note: 'Recruitment: their RPs, the RPs’ students and applications.' },
  { key: 'gsp-bap', label: 'GSP · RP Ops', note: 'BAP and partner operations: verifying new RPs and their documents, RP bank details.' },
  { key: 'institution-partner', label: 'GSP · Institution', note: 'The Institution team: institution partners, agreements, universities.' },
  { key: 'gsp-ip-ops', label: 'GSP · IP Ops', note: 'The Data team: courses, intakes, entry rules, announcements.' },
  { key: 'gsp-finance', label: 'GSP · Finance', note: 'Commission terms, invoices, payouts.' },
  { key: 'gsp-view-only', label: 'GSP · View Only', note: 'Leadership and auditors: sees everything, changes nothing.' },
  { key: 'rp-admin', label: 'RP Admin', note: 'The whole RP: every branch, student and application, earnings, the team.' },
  { key: 'rp-branch-admin', label: 'RP · Branch Manager', note: 'One branch’s students and applications; manages that branch’s counsellors.' },
  { key: 'rp-counsellor', label: 'RP · Counsellor', note: 'Only the students and applications assigned to them.' },
];
/** The roles that use GSP Admin's portal, each with its own menu. */
export const ADMIN_LIKE: Role[] = ['gsp-admin', 'gsp-recruitment', 'gsp-bap', 'gsp-finance', 'gsp-view-only'];
/** The roles that use the agency portal (RP Admin's), cut to the person's role. */
export const RP_LIKE: Role[] = ['rp-admin', 'rp-branch-admin', 'rp-counsellor'];
/** The roles that use GSP · Admissions' portal. */
export const ADMISSIONS_LIKE: Role[] = ['gsp-team', 'gsp-global-ops'];
/** The roles that use the Institution Team's portal. */
export const INSTITUTION_LIKE: Role[] = ['institution-partner', 'gsp-ip-ops'];

/** The two roles Side by side shows. */
export const PAIR: Role[] = ['rp-admin', 'gsp-team'];

export const roleOf = (v: string | null): Role => (ROLES.some((r) => r.key === v) ? (v as Role) : 'rp-admin');

/**
 * Each GSP role's permission role in GSP · Admin › Permission roles: its menu and edit rights follow that role's
 * line in the slice 1 matrix. The RP's roles aren't in the matrix; they're fixed by role.
 */
export const PERM_ROLE: Record<Role, string | null> = {
  'rp-admin': null,
  'rp-branch-admin': null,
  'rp-counsellor': null,
  'gsp-team': 'Admission',
  'gsp-global-ops': 'Global Ops',
  'gsp-recruitment': 'Recruitment',
  'gsp-bap': 'RP Ops',
  'gsp-finance': 'Finance',
  'institution-partner': 'Institution',
  'gsp-ip-ops': 'IP Ops',
  'gsp-admin': 'Admin',
  'gsp-view-only': 'View Only',
};
/** The RP role each RP key signs in as (its person is on the test agency's team). */
export const RP_ROLE: Partial<Record<Role, string>> = { 'rp-admin': 'RP Admin', 'rp-branch-admin': 'Branch Manager', 'rp-counsellor': 'Counsellor' };

/** The role the prototype shows now (set by App as the Role menu changes), for pages shared by two roles. */
let current: Role = 'rp-admin';
export const setCurrentRole = (r: Role) => {
  current = r;
};
export const currentRole = () => current;
