/**
 * Menus from Admin › Permission roles (Jovial, 1 Nov, HC47): each GSP role's menu shows only what its permission
 * role can see. No access hides the menu item; View opens it read only where the page can be (Finance and Work read
 * the same matrix for their edit actions, finance/access.ts). Each item is a line of Admin's matrix.
 */
import { adminCfg } from './store';
import { PERM_ROLE, currentRole } from '../../proto/roles';

/** The permission object each menu item opens. Items not here (Home, Profile, How Finance works) are always there. */
const OBJECT_OF: Record<string, string> = {
  mywork: 'My Work',
  mail: 'Mail',
  applications: 'Applications › List',
  students: 'Students › List',
  courses: 'Find Courses',
  catalogue: 'Courses › List',
  rps: 'Recruitment Partners › List',
  mps: 'Master Partners › List',
  ips: 'Institution Partners › List',
  universities: 'Universities › List',
  announcements: 'Announcements › List',
  // Admin's pages (Jovial's sheet, 6 Nov): User Roles; Recruitment Assignment; Course, Application and Other Configurations; Work
  users: 'User Roles',
  permissions: 'User Roles',
  regions: 'User Roles',
  emails: 'User Roles',
  bdm: 'Recruitment Assignment',
  tags: 'Course Configuration',
  levels: 'Course Configuration',
  grades: 'Course Configuration',
  english: 'Course Configuration',
  documents: 'Application Configuration',
  reasons: 'Application Configuration',
  routing: 'Application Configuration',
  education: 'Application Configuration',
  currency: 'Other Configurations',
  living: 'Other Configurations',
  security: 'Other Configurations',
  logs: 'Other Configurations',
  // Finance: the university side is Institution Partners › Commission, the RP side Recruitment Partners › Commission
  'fin-uni': 'Institution Partners › Commission',
  'fin-rp': 'Recruitment Partners › Commission',
  'fin-run': 'Recruitment Partners › Commission',
  'fin-exc': 'Applications › Commission',
  'fin-reports': 'Applications › Commission',
  'fin-scen': 'Applications › Commission',
  'fin-terms': 'Institution Partners › Commission',
  'fin-setup': 'Institution Partners › Commission',
  'work-sla': 'Work',
  'work-rules': 'Work',
  'work-mail': 'Work',
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
