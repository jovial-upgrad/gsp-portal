// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Roles, access (create / read / update / delete) and data scope.
 * This is the single source of truth for who can see and change what.
 * In the real build this table lives on the server; the UI only reads it.
 */

export const ROLES = [
  { id: 'rp-admin', name: 'RP Admin', side: 'RP', scope: 'agency',
    about: 'Runs the agency: every branch, every counsellor, students, applications, earnings and the team.' },
  { id: 'branch-admin', name: 'Branch Admin', side: 'RP', scope: 'branch',
    about: 'Runs one branch: its counsellors, students and applications.' },
  { id: 'counsellor', name: 'Counsellor', side: 'RP', scope: 'own',
    about: 'Works their own students and applications.' },
  { id: 'recruitment-ops', name: 'Recruitment Ops', side: 'GSP', scope: 'global',
    about: 'Verifies new recruitment partners and their documents (was BAP).' },
  { id: 'recruitment', name: 'Recruitment', side: 'GSP', scope: 'regions',
    about: 'BDMs: own their RPs and branches in their sales regions.' },
  { id: 'institution-ops', name: 'Institution Ops', side: 'GSP', scope: 'global',
    about: 'Keeps course data, intakes and fees current (was Data team).' },
  { id: 'institution', name: 'Institution', side: 'GSP', scope: 'global',
    about: 'Account managers for institution partners and universities.' },
  { id: 'admission-ops', name: 'Admission Ops', side: 'GSP', scope: 'global',
    about: 'Quality checks, announcements and SLA watch across every region.' },
  { id: 'admission', name: 'Admission', side: 'GSP', scope: 'regions',
    about: 'Admissions officers: work applications in their sales regions.' },
  { id: 'finance', name: 'Finance', side: 'GSP', scope: 'global',
    about: 'Commission terms, invoices, receipts and payouts.' },
  { id: 'view-only', name: 'View Only', side: 'GSP', scope: 'global',
    about: 'Sees everything, changes nothing. For leadership and auditors.' },
  { id: 'admin', name: 'Admin', side: 'GSP', scope: 'global',
    about: 'Configuration, users and roles. Can do everything.' },
];

export const SCOPES = {
  global: 'Every region',
  regions: 'Their sales regions only',
  agency: 'Their whole agency',
  branch: 'Their branch only',
  own: 'Their own students only',
};

/* Modules, grouped as on the permission page. */
export const MODULES = [
  { group: 'Students and applications', items: [
    ['students', 'Students'],
    ['student-docs', 'Student documents'],
    ['applications', 'Applications'],
    ['app-status', 'Application status changes'],
    ['app-docs', 'Application documents and checks'],
    ['submission', 'Submission and university mail'],
    ['chat', 'Chat with RPs'],
  ] },
  { group: 'Recruitment partners', items: [
    ['rp-profile', 'RP profile and status'],
    ['rp-docs', 'RP onboarding documents'],
    ['rp-team', 'RP branches and team'],
    ['bdm', 'BDM assignment'],
  ] },
  { group: 'Institutions and courses', items: [
    ['ip', 'Institution partners and agreements'],
    ['universities', 'Universities'],
    ['courses', 'Courses, intakes and fees'],
    ['announcements', 'Announcements'],
  ] },
  { group: 'Commissions', items: [
    ['comm-terms', 'Commission terms'],
    ['comm-lines', 'Commission lines and ledgers'],
    ['invoices', 'Invoices and receipts'],
    ['payouts', 'Payout runs'],
    ['earnings', 'RP earnings and statements'],
    ['bank', 'RP bank details'],
  ] },
  { group: 'Work', items: [
    ['tasks', 'Tasks in my queues'],
    ['queues', 'Queues, task rules and SLA'],
    ['mail', 'Shared mailboxes'],
    ['dashboards', 'Dashboards'],
  ] },
  { group: 'Administration', items: [
    ['users', 'Users, roles and access'],
    ['regions', 'Sales regions and routing'],
    ['logs', 'Logs and exports'],
  ] },
];

export const MODULE_NAME = Object.fromEntries(MODULES.flatMap(g => g.items));

/*
 * Default matrix. Each cell is a string of the actions allowed:
 * C create, R read, U update, D delete. '' means no access.
 */
const ALL = 'CRUD', R = 'R', RU = 'RU', CRU = 'CRU', N = '';
const row = o => o;
export const DEFAULT_MATRIX = {
  'rp-admin': row({ students: ALL, 'student-docs': ALL, applications: CRU, 'app-status': N, 'app-docs': CRU, submission: N, chat: CRU, 'rp-profile': RU, 'rp-docs': CRU, 'rp-team': ALL, bdm: N, ip: N, universities: R, courses: R, announcements: R, 'comm-terms': N, 'comm-lines': N, invoices: N, payouts: N, earnings: RU, bank: RU, tasks: N, queues: N, mail: N, dashboards: R, users: N, regions: N, logs: N }),
  'branch-admin': row({ students: ALL, 'student-docs': ALL, applications: CRU, 'app-status': N, 'app-docs': CRU, submission: N, chat: CRU, 'rp-profile': R, 'rp-docs': R, 'rp-team': RU, bdm: N, ip: N, universities: R, courses: R, announcements: R, 'comm-terms': N, 'comm-lines': N, invoices: N, payouts: N, earnings: R, bank: N, tasks: N, queues: N, mail: N, dashboards: R, users: N, regions: N, logs: N }),
  counsellor: row({ students: CRU, 'student-docs': CRU, applications: CRU, 'app-status': N, 'app-docs': CRU, submission: N, chat: CRU, 'rp-profile': R, 'rp-docs': N, 'rp-team': R, bdm: N, ip: N, universities: R, courses: R, announcements: R, 'comm-terms': N, 'comm-lines': N, invoices: N, payouts: N, earnings: N, bank: N, tasks: N, queues: N, mail: N, dashboards: N, users: N, regions: N, logs: N }),
  'recruitment-ops': row({ students: N, 'student-docs': N, applications: N, 'app-status': N, 'app-docs': N, submission: N, chat: N, 'rp-profile': RU, 'rp-docs': RU, 'rp-team': RU, bdm: R, ip: N, universities: R, courses: R, announcements: R, 'comm-terms': N, 'comm-lines': N, invoices: N, payouts: N, earnings: N, bank: RU, tasks: RU, queues: R, mail: RU, dashboards: R, users: N, regions: R, logs: N }),
  recruitment: row({ students: R, 'student-docs': N, applications: R, 'app-status': N, 'app-docs': N, submission: N, chat: R, 'rp-profile': RU, 'rp-docs': R, 'rp-team': RU, bdm: R, ip: N, universities: R, courses: R, announcements: R, 'comm-terms': N, 'comm-lines': N, invoices: N, payouts: N, earnings: R, bank: N, tasks: RU, queues: R, mail: R, dashboards: R, users: N, regions: R, logs: N }),
  'institution-ops': row({ students: N, 'student-docs': N, applications: N, 'app-status': N, 'app-docs': N, submission: N, chat: N, 'rp-profile': N, 'rp-docs': N, 'rp-team': N, bdm: N, ip: R, universities: RU, courses: ALL, announcements: CRU, 'comm-terms': N, 'comm-lines': N, invoices: N, payouts: N, earnings: N, bank: N, tasks: RU, queues: R, mail: RU, dashboards: R, users: N, regions: N, logs: N }),
  institution: row({ students: N, 'student-docs': N, applications: R, 'app-status': N, 'app-docs': N, submission: R, chat: N, 'rp-profile': R, 'rp-docs': N, 'rp-team': N, bdm: N, ip: ALL, universities: ALL, courses: CRU, announcements: ALL, 'comm-terms': R, 'comm-lines': N, invoices: N, payouts: N, earnings: N, bank: N, tasks: RU, queues: R, mail: RU, dashboards: R, users: N, regions: N, logs: N }),
  'admission-ops': row({ students: RU, 'student-docs': RU, applications: RU, 'app-status': RU, 'app-docs': RU, submission: RU, chat: CRU, 'rp-profile': R, 'rp-docs': N, 'rp-team': R, bdm: N, ip: R, universities: R, courses: R, announcements: ALL, 'comm-terms': N, 'comm-lines': R, invoices: N, payouts: N, earnings: N, bank: N, tasks: CRU, queues: RU, mail: RU, dashboards: R, users: R, regions: R, logs: R }),
  admission: row({ students: CRU, 'student-docs': CRU, applications: CRU, 'app-status': RU, 'app-docs': CRU, submission: CRU, chat: CRU, 'rp-profile': R, 'rp-docs': N, 'rp-team': R, bdm: N, ip: R, universities: R, courses: R, announcements: R, 'comm-terms': N, 'comm-lines': R, invoices: N, payouts: N, earnings: N, bank: N, tasks: CRU, queues: R, mail: CRU, dashboards: R, users: N, regions: R, logs: N }),
  finance: row({ students: R, 'student-docs': N, applications: R, 'app-status': N, 'app-docs': N, submission: N, chat: N, 'rp-profile': R, 'rp-docs': N, 'rp-team': R, bdm: N, ip: R, universities: R, courses: R, announcements: R, 'comm-terms': ALL, 'comm-lines': CRU, invoices: ALL, payouts: ALL, earnings: R, bank: RU, tasks: CRU, queues: R, mail: CRU, dashboards: R, users: N, regions: N, logs: R }),
  'view-only': row(Object.fromEntries(MODULES.flatMap(g => g.items).map(([k]) => [k, R]))),
  admin: row(Object.fromEntries(MODULES.flatMap(g => g.items).map(([k]) => [k, ALL]))),
};

export const ACTIONS = [['C', 'Create'], ['R', 'Read'], ['U', 'Update'], ['D', 'Delete']];

/* can(matrix, roleId, moduleId, action) — action is 'C' | 'R' | 'U' | 'D' */
export function can(matrix, roleId, moduleId, action = 'R') {
  return ((matrix[roleId] || {})[moduleId] || '').includes(action);
}

/*
 * Data scope: which records a user may see.
 * GSP: global roles see every region; regional roles see records whose region
 * is one of theirs. RP: agency, branch or own records.
 * Every record carries `region` (GSP side) and, for RP records, `agency`,
 * `branch` and `owner`.
 */
export function inScope(user, record, roles = ROLES) {
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
  const role = ROLES.find(r => r.id === user.role);
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
