import type { IconName } from '../../components/Icon';
import type { Section as InstitutionSection } from '../../institution/portal/model';

/**
 * GSP Admin's pages (Nesil, 30 Oct), in groups. **User modules** (Course search, Students, Applications) and
 * **Institution** (Recruitment partners, Institution partners, Universities, Courses, Announcements) are the very
 * pages GSP · Institution has, from its folder: a change there shows here too, unless a page gets its own setting
 * here later. The rest are GSP Admin's own configuration: **User roles** (Create roles, Sales regions, Permission
 * roles, Queues, Emails),
 * **Recruitment** (BDM assignment), **Course configuration** (Currency exchange, Living costs), **Application
 * configuration** (Application routing, Document configuration) and **Other configurations** (Logs).
 * Home (the queue) stays first; `profile` is the account page, opened from the initials on phones.
 */
export type ConfigSection = 'users' | 'regions' | 'permissions' | 'queues' | 'emails' | 'bdm' | 'currency' | 'living' | 'routing' | 'documents' | 'logs';
export type Section = InstitutionSection | ConfigSection;

export type NavItem = { key: Section; label: string; short: string; icon: IconName };
export type NavGroup = { key: string; label: string; icon: IconName; items: NavItem[] };

export const HOME: NavItem = { key: 'home', label: 'Home', short: 'Home', icon: 'home' };

export const GROUPS: NavGroup[] = [
  {
    key: 'user',
    label: 'User modules',
    icon: 'people',
    items: [
      { key: 'courses', label: 'Course search', short: 'Search', icon: 'search' },
      { key: 'students', label: 'Students', short: 'Students', icon: 'people' },
      { key: 'applications', label: 'Applications', short: 'Applications', icon: 'doc' },
    ],
  },
  {
    key: 'institution',
    label: 'Institution',
    icon: 'building',
    items: [
      { key: 'rps', label: 'Recruitment partners', short: 'RPs', icon: 'partner' },
      { key: 'ips', label: 'Institution partners', short: 'Partners', icon: 'briefcase' },
      { key: 'universities', label: 'Universities', short: 'Universities', icon: 'building' },
      { key: 'catalogue', label: 'Courses', short: 'Courses', icon: 'cap' },
      { key: 'announcements', label: 'Announcements', short: 'News', icon: 'megaphone' },
    ],
  },
  {
    key: 'roles',
    label: 'User roles',
    icon: 'shield',
    items: [
      { key: 'users', label: 'Create roles', short: 'Users', icon: 'user' },
      { key: 'regions', label: 'Sales regions', short: 'Regions', icon: 'globe' },
      { key: 'permissions', label: 'Permission roles', short: 'Roles', icon: 'key' },
      { key: 'queues', label: 'Queues', short: 'Queues', icon: 'sliders' },
      { key: 'emails', label: 'Emails', short: 'Emails', icon: 'mail' },
    ],
  },
  {
    key: 'recruitment',
    label: 'Recruitment',
    icon: 'partner',
    items: [{ key: 'bdm', label: 'BDM assignment', short: 'BDMs', icon: 'user' }],
  },
  {
    key: 'course',
    label: 'Course configuration',
    icon: 'cap',
    items: [
      { key: 'currency', label: 'Currency exchange', short: 'Currency', icon: 'wallet' },
      { key: 'living', label: 'Living costs', short: 'Living', icon: 'home' },
    ],
  },
  {
    key: 'application',
    label: 'Application configuration',
    icon: 'doc',
    items: [
      { key: 'routing', label: 'Application routing', short: 'Routing', icon: 'share' },
      { key: 'documents', label: 'Document configuration', short: 'Documents', icon: 'folder' },
    ],
  },
  {
    key: 'other',
    label: 'Other configurations',
    icon: 'sliders',
    items: [
      { key: 'logs', label: 'Logs', short: 'Logs', icon: 'clock' },
    ],
  },
];

export const NAV: NavItem[] = [HOME, ...GROUPS.flatMap((g) => g.items)];
export const groupOf = (k: Section) => GROUPS.find((g) => g.items.some((i) => i.key === k));

/** On phones the tab bar has room for five. */
export const TABS: Section[] = ['home', 'applications', 'universities', 'routing', 'logs'];

// the records pages are GSP · Institution's own
export type { Focus, PageProps, RecordSection, Target } from '../../institution/portal/model';
