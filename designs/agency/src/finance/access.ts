// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Roles, access (create / read / update / delete) and data scope, read from GSP · Admin › Permission roles.
 * In the real build Admin's matrix lives on the server; the UI only reads it.
 */

import { adminCfg } from '../admin/data/store';
import { ROLES as PERMISSION_ROLES, OVERSIGHT_OBJECT } from '../admin/data/config';

/*
 * Who can do what (Jovial, 1 Nov, HC46): GSP's roles and their access are GSP · Admin › Permission roles, the one
 * matrix. Finance and Work have no list of their own: each check below is a line of Admin's matrix (No access, View,
 * View + edit). Region isolation (model D) gives Admission and Recruitment their own regions; the rest see all.
 * The RP's roles aren't GSP's to set there: they stay the agency portal's own, below.
 */
const ABOUT = {
  Admin: 'Configuration, users and roles. Can do everything.',
  'View Only': 'Sees everything, changes nothing. For leadership and auditors.',
  Finance: 'Commission terms, invoices, receipts and payouts.',
  Institution: 'Account managers for institution partners and universities.',
  'Institution Ops': 'Keeps course data, intakes and fees current (was Data team).',
  Recruitment: 'BDMs: own their RPs and branches in their sales regions.',
  'Recruitment Ops': 'Verifies new recruitment partners and their documents (was BAP).',
  Admission: 'Admissions officers: work applications in their sales regions.',
  'Admission Ops': 'Quality checks, announcements and SLA watch across every region.',
};
export const roleId = name => String(name).toLowerCase().replace(/ /g, '-');
const RP_ROLES = [
  { id: 'rp-admin', name: 'RP Admin', side: 'RP', scope: 'agency', about: 'Runs the agency: every branch, every counsellor, students, applications, earnings and the team.' },
  { id: 'branch-admin', name: 'Branch Admin', side: 'RP', scope: 'branch', about: 'Runs one branch: its counsellors, students and applications.' },
  { id: 'counsellor', name: 'Counsellor', side: 'RP', scope: 'own', about: 'Works their own students and applications.' },
];
/** GSP's nine roles from Admin › Permission roles, then the RP's three. */
export const gspRoles = () => [
  ...PERMISSION_ROLES.map(name => ({ id: roleId(name), name, side: 'GSP', scope: name === 'Admission' || name === 'Recruitment' ? 'regions' : 'global', about: ABOUT[name] || '' })),
  ...RP_ROLES,
];
export const ROLES = gspRoles();

export const SCOPES = {
  global: 'Every region',
  regions: 'Their sales regions only',
  agency: 'Their whole agency',
  branch: 'Their branch only',
  own: 'Their own students only',
};


/* Each module here is a line of Admin › Permission roles (HC46). */
const OBJECT_OF = {
  students: 'Students', 'student-docs': 'Student documents', applications: 'Applications', 'app-status': 'Applications',
  'app-docs': 'Application documents and checks', submission: 'Drafts to universities and placed emails', chat: 'Chat threads',
  'rp-profile': 'Recruitment partner profile and status', 'rp-docs': 'RP onboarding documents', 'rp-team': 'RP branches and team', bdm: 'Settings',
  ip: 'Institution partners', universities: 'Universities', courses: 'Courses, intakes and entry rules', announcements: 'Announcements',
  'comm-terms': 'Commission terms', 'comm-lines': 'Commission lines', invoices: 'Invoices and receipts', payouts: 'Payout runs and statements',
  earnings: 'Payout runs and statements', bank: 'RP bank details',
  tasks: 'My work and tasks', queues: 'Queues, task rules and SLA', mail: 'Shared mailboxes', dashboards: 'Overview dashboard',
  users: 'GSP users and roles', regions: 'Settings', logs: 'Download log and audit logs',
};
export const objectOf = moduleId => OBJECT_OF[moduleId];
/* The RP's own access (the agency portal's; not GSP's to set in Admin). */
const RP_ACCESS = {
  'rp-admin': { students: 'CRUD', 'student-docs': 'CRUD', applications: 'CRU', 'app-docs': 'CRU', chat: 'CRU', 'rp-profile': 'RU', 'rp-docs': 'CRU', 'rp-team': 'CRUD', universities: 'R', courses: 'R', announcements: 'R', earnings: 'RU', bank: 'RU', dashboards: 'R' },
  'branch-admin': { students: 'CRUD', 'student-docs': 'CRUD', applications: 'CRU', 'app-docs': 'CRU', chat: 'CRU', 'rp-profile': 'R', 'rp-docs': 'R', 'rp-team': 'RU', universities: 'R', courses: 'R', announcements: 'R', earnings: 'R', dashboards: 'R' },
  counsellor: { students: 'CRU', 'student-docs': 'CRU', applications: 'CRU', 'app-docs': 'CRU', chat: 'CRU', 'rp-profile': 'R', 'rp-team': 'R', universities: 'R', courses: 'R', announcements: 'R' },
};
const ACTS = { E: 'CRUD', V: 'R', N: '' };
const nameOfRole = id => PERMISSION_ROLES.find(n => roleId(n) === id);
/** A role's level on a line of Admin's matrix: 'E' View + edit, 'V' View, 'N' No access. Admin has everything. */
export function levelOf(roleIdOrName, object) {
  const name = nameOfRole(roleIdOrName) || roleIdOrName;
  if (name === 'Admin') return 'E';
  let perms = {};
  try { perms = adminCfg().perms || {}; } catch { perms = {}; }
  return (perms[object] || {})[name] || 'N';
}
/** Roles that see every mailbox and every queue's tasks, not only their own (HC30): Admin's oversight line. */
export const oversees = id => levelOf(id, OVERSIGHT_OBJECT) !== 'N';

export const ACTIONS = [['C', 'Create'], ['R', 'Read'], ['U', 'Update'], ['D', 'Delete']];

/*
 * can(_, roleId, moduleId, action): action is 'C' | 'R' | 'U' | 'D'. GSP roles read Admin › Permission roles (View
 * reads, View + edit does everything); the first argument is kept for the callers and not used.
 */
export function can(_matrix, roleId, moduleId, action = 'R') {
  if (RP_ACCESS[roleId]) return (RP_ACCESS[roleId][moduleId] || '').includes(action);
  const obj = OBJECT_OF[moduleId];
  if (!obj) return roleId === 'admin';
  return ACTS[levelOf(roleId, obj)].includes(action);
}

/*
 * Data scope: which records a user may see.
 * GSP: global roles see every region; regional roles see records whose region
 * is one of theirs. RP: agency, branch or own records.
 * Every record carries `region` (GSP side) and, for RP records, `agency`,
 * `branch` and `owner`.
 */
export function inScope(user, record, roles = gspRoles()) {
  const role = roles.find(r => r.id === user.role);
  if (!role) return false;
  if (role.side === 'GSP') {
    if (role.scope === 'global' || (user.regions || []).includes('Global')) return true;
    if (!record.region) return true; // records without a region (universities, IPs) are global
    return (user.regions || []).includes(record.region);
  }
  if (record.agency && record.agency !== user.agency) return false;
  if (role.scope === 'agency') return true;
  if (role.scope === 'branch') return !record.branch || record.branch === user.branch;
  if (role.scope === 'own') return !record.owner || record.owner === user.id;
  return false;
}

export function whyInScope(user, record) {
  const role = gspRoles().find(r => r.id === user.role);
  if (!role) return 'Unknown role';
  if (role.side === 'GSP') {
    if (role.scope === 'global') return `${role.name} sees every region`;
    if ((user.regions || []).includes('Global')) return 'Has the Global region';
    if (!record.region) return 'Not tied to a region';
    return (user.regions || []).includes(record.region)
      ? `${record.region} is one of their regions`
      : `${record.region} is not one of their regions`;
  }
  if (record.agency && record.agency !== user.agency) return 'Another agency';
  if (role.scope === 'agency') return 'Their agency';
  if (role.scope === 'branch') return record.branch === user.branch ? 'Their branch' : 'Another branch';
  return record.owner === user.id ? 'Their own student' : 'Another counsellor’s student';
}
