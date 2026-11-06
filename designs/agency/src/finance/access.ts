// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Roles, access (create / read / update / delete) and data scope, read from GSP · Admin › Permission roles.
 * In the real build Admin's matrix lives on the server; the UI only reads it.
 */

import { levelFor } from '../admin/data/menus';
import { ROLES as PERMISSION_ROLES } from '../admin/data/config';

/*
 * Who can do what (Jovial, 1 Nov, HC46): GSP's roles and their access are GSP · Admin › Permission roles, the one
 * matrix. Finance and Work have no list of their own: each check below is a line of Admin's matrix (No access, View,
 * View + edit). Region isolation (Regression 31): only Admin sees every region; every other GSP role sees the regions on the person.
 * The RP's roles aren't GSP's to set there: they stay the agency portal's own, below.
 */
// each role's main work, as the slice 1 PRD's Roles table has it
const ABOUT = {
  Admin: 'Users, roles, settings, logs; can do everything.',
  'View Only': 'Sees everything, changes nothing.',
  Finance: 'Commission terms, invoices, payouts.',
  Institution: 'Institution partners, agreements, universities.',
  'IP Ops': 'Courses, intakes, entry rules, announcements.',
  Recruitment: 'Their RPs, the RPs’ students and applications.',
  'RP Ops': 'Verifying new RPs and their documents, RP bank details.',
  Admission: 'Applications in their regions: verify, submit, offers, visa, enrolment.',
  'Global Ops': 'Works the Global Admissions queue (Direct, Rest of world and Global applications, unmatched email, escalations from the regional queues); oversight of every queue and mailbox.',
};
export const roleId = name => String(name).toLowerCase().replace(/ /g, '-');
const RP_ROLES = [
  { id: 'rp-admin', name: 'RP Admin', side: 'RP', scope: 'agency', about: 'Runs the agency: every branch, every counsellor, students, applications, earnings and the team.' },
  { id: 'branch-admin', name: 'Branch Manager', side: 'RP', scope: 'branch', about: 'Runs one branch: its counsellors, students and applications.' },
  { id: 'counsellor', name: 'Counsellor', side: 'RP', scope: 'own', about: 'Works their own students and applications.' },
];
/** GSP's nine roles from Admin › Permission roles, then the RP's three. */
export const gspRoles = () => [
  ...PERMISSION_ROLES.map(name => ({ id: roleId(name), name, side: 'GSP', scope: name === 'Admin' ? 'global' : 'regions', about: ABOUT[name] || '' })),
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


/* Each module here is a line of Admin › Permission roles (HC46; the objects from Jovial's sheet, 6 Nov). */
const OBJECT_OF = {
  students: 'Students › Record', 'student-docs': 'Students › Documents', applications: 'Applications › Record', 'app-status': 'Applications › Record',
  'app-docs': 'Applications › Documents', submission: 'Applications › Submission', chat: 'Applications › Chat',
  'rp-profile': 'Recruitment Partners › Record', 'rp-docs': 'Recruitment Partners › Documents', 'rp-team': 'Recruitment Partners › Teams', bdm: 'Recruitment Assignment',
  ip: 'Institution Partners › Record', universities: 'Universities › Record', courses: 'Courses › Record', announcements: 'Announcements › Record',
  // commissions: Finance edits every commission tab (6 Nov); an application's lines are its Commission tab
  'comm-terms': 'Institution Partners › Commission', 'comm-lines': 'Applications › Commission', invoices: 'Institution Partners › Commission',
  payouts: 'Recruitment Partners › Commission', earnings: 'Applications › Commission', bank: 'Recruitment Partners › Record',
  tasks: 'My Work', queues: 'Work', mail: 'Mail',
  users: 'User Roles', regions: 'User Roles', logs: 'Other Configurations',
};
export const objectOf = moduleId => OBJECT_OF[moduleId];
/*
 * The RP's roles read the same matrix for the objects it has a column for (students, applications and their parts,
 * Find Courses). The agency's own pages (its profile, documents, team, earnings and bank details) aren't GSP objects:
 * they stay fixed by role.
 */
const RP_MATRIX_NAME = { 'rp-admin': 'RP Admin', 'branch-admin': 'Branch Manager', counsellor: 'Counsellor' };
const RP_OWN = {
  'rp-admin': { 'rp-profile': 'RU', 'rp-docs': 'CRU', 'rp-team': 'CRUD', earnings: 'RU', bank: 'RU', dashboards: 'R', announcements: 'R' },
  'branch-admin': { 'rp-profile': 'R', 'rp-docs': 'R', 'rp-team': 'RU', dashboards: 'R', announcements: 'R' },
  counsellor: { 'rp-profile': 'R', 'rp-team': 'R', announcements: 'R' },
};
/* The RP sees universities and courses through Find Courses. */
const RP_OBJECT_OF = { ...OBJECT_OF, universities: 'Find Courses', courses: 'Find Courses' };
const ACTS = { E: 'CRUD', V: 'R', N: '' };
const nameOfRole = id => PERMISSION_ROLES.find(n => roleId(n) === id);
/** A role's level on a line of Admin's matrix: 'E' View + edit, 'V' View, 'N' No access. Admin has everything. */
export function levelOf(roleIdOrName, object) {
  // the one helper (admin/data/menus.ts), by the role's matrix name
  return levelFor(nameOfRole(roleIdOrName) || roleIdOrName, object);
}
/**
 * Roles that see every mailbox and every queue's tasks, not only their own (HC30): those with access to Work (the
 * queue and task-rule settings). The matrix has no separate oversight line (6 Nov).
 */
export const oversees = id => levelOf(id, 'Work') !== 'N';

export const ACTIONS = [['C', 'Create'], ['R', 'Read'], ['U', 'Update'], ['D', 'Delete']];

/*
 * can(_, roleId, moduleId, action): action is 'C' | 'R' | 'U' | 'D'. GSP roles read Admin › Permission roles (View
 * reads, View + edit does everything); the first argument is kept for the callers and not used.
 */
export function can(_matrix, roleId, moduleId, action = 'R') {
  if (RP_MATRIX_NAME[roleId]) {
    const own = RP_OWN[roleId][moduleId];
    if (own !== undefined) return own.includes(action);
    const o = RP_OBJECT_OF[moduleId];
    return !!o && ACTS[levelFor(RP_MATRIX_NAME[roleId], o)].includes(action);
  }
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
