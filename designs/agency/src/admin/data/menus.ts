/**
 * Menus from Admin › Permission roles (Jovial, 1 Nov, HC47): each GSP role's menu shows only what its permission
 * role can see. No access hides the menu item; View opens it read only where the page can be (Finance and Work read
 * the same matrix for their edit actions, finance/access.ts). Each item is a line of Admin's matrix.
 */
import { adminCfg } from './store';
import { PERM_ROLE, currentRole } from '../../proto/roles';

/** The permission object each menu item opens. Items not here (Home, Profile, How Finance works) are always there. */
const OBJECT_OF: Record<string, string> = {
  mywork: 'My work and tasks',
  mail: 'Shared mailboxes',
  applications: 'Applications',
  students: 'Students',
  courses: 'Courses, intakes and entry rules',
  catalogue: 'Courses, intakes and entry rules',
  rps: 'Recruitment partner profile and status',
  // slice 2 PRD: Master Partners (S2-21) and Admin's Course tags (S2-16)
  mps: 'Master Partners',
  tags: 'Settings',
  levels: 'Settings',
  ips: 'Institution partners',
  universities: 'Universities',
  announcements: 'Announcements',
  users: 'GSP users and roles',
  permissions: 'GSP users and roles',
  regions: 'Settings',
  emails: 'Settings',
  bdm: 'Settings',
  currency: 'Settings',
  living: 'Settings',
  // slice 3 PRD (S3-4): the eligibility check's two tables
  grades: 'Settings',
  english: 'Settings',
  routing: 'Settings',
  // lock answers S3C-1 and S3C-21
  education: 'Settings',
  reasons: 'Settings',
  documents: 'Settings',
  security: 'Settings',
  logs: 'Download log and audit logs',
  'fin-uni': 'Invoices and receipts',
  'fin-rp': 'Commission lines',
  'fin-run': 'Payout runs and statements',
  'fin-exc': 'Commission lines',
  'fin-reports': 'Commission lines',
  'fin-scen': 'Commission lines',
  'fin-terms': 'Commission terms',
  'fin-setup': 'Commission terms',
  'work-sla': 'Queues, task rules and SLA',
  'work-rules': 'Queues, task rules and SLA',
  'work-mail': 'Queues, task rules and SLA',
};
export const menuObjectOf = (key: string) => OBJECT_OF[key];
/** A permission role's level on an object: E View + edit, V View, N No access. Admin has everything. */
export function levelFor(permRole: string | null | undefined, object: string): 'E' | 'V' | 'N' {
  if (!permRole || permRole === 'Admin') return 'E';
  try {
    return (adminCfg().perms[object]?.[permRole] as 'E' | 'V' | 'N') ?? 'N';
  } catch {
    return 'E';
  }
}
/**
 * The one permission helper (merge, 2 Nov): every slice's page asks these, by matrix row. Edit shows Add, Edit and
 * row actions; View shows the page read only (View Only sees no actions anywhere); No access hides it.
 */
export const canEditObject = (permRole: string | null | undefined, object: string) => levelFor(permRole, object) === 'E';
export const canSeeObject = (permRole: string | null | undefined, object: string) => levelFor(permRole, object) !== 'N';
/** The same for whoever the prototype shows now (shared pages that don't get a role passed in). RP roles: always Edit. */
export const canEditNow = (object: string) => canEditObject(PERM_ROLE[currentRole()], object);
/** Whether whoever the prototype shows now can see an object at all (View or Edit). */
export const canSeeNow = (object: string) => canSeeObject(PERM_ROLE[currentRole()], object);
/** Whether a role's menu shows this item. */
export const canOpen = (permRole: string | null | undefined, key: string) => !OBJECT_OF[key] || levelFor(permRole, OBJECT_OF[key]) !== 'N';
/** Whether the role can change what this item opens. */
export const canEditIn = (permRole: string | null | undefined, key: string) => !OBJECT_OF[key] || levelFor(permRole, OBJECT_OF[key]) === 'E';

/**
 * A menu list that is always the items the role can open now: the same array everywhere it's read (map, filter,
 * find, spread), cut to Admin's current permissions.
 */
export function liveMenu<T extends { key: string }>(base: T[], permRole: () => string | null): T[] {
  return new Proxy(base, {
    get(t, k) {
      const now = t.filter((x) => canOpen(permRole(), x.key));
      return Reflect.get(now, k);
    },
  });
}
/** The same for a list of keys (phone tabs). */
export function liveKeys<T extends string>(base: T[], permRole: () => string | null): T[] {
  return new Proxy(base, {
    get(t, k) {
      const now = t.filter((x) => canOpen(permRole(), x));
      return Reflect.get(now, k);
    },
  });
}
