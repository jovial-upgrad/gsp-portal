import type { IconName } from '../../components/Icon';
import type { Section as InstitutionSection } from '../../institution/portal/model';

/**
 * GSP Admin's pages (Nesil, 30 Oct), in groups. **User modules** (Course search, Students, Applications) and
 * **Institution** (Recruitment partners, Institution partners, Universities, Courses, Announcements) are the very
 * pages GSP · Institution has, from its folder: a change there shows here too, unless a page gets its own setting
 * here later. The rest are GSP Admin's own configuration: **User roles** (Create roles, Sales regions, Permission
 * roles, Emails), **Work** (9 Nov: Queues and Working Days; Task rules),
 * **Recruitment** (BDM assignment), **Course configuration** (Currency exchange, Living costs), **Application
 * configuration** (Application routing, Document configuration) and **Other configurations** (Filters, Logs).
 * Home (the queue) stays first; `profile` is the account page, opened from the initials on phones.
 */
export type ConfigSection = 'mywork' | 'users' | 'regions' | 'permissions' | 'queues' | 'tasks' | 'emails' | 'bdm' | 'currency' | 'living' | 'tags' | 'levels' | 'grades' | 'english' | 'routing' | 'documents' | 'logs';
/** 9 Nov (Jovial): Commission lines, where Admin can override a line and export (the PRD's Commissions tab). */
/** 18 Nov (Jovial): Dashboards, round 1: the Overview and Targets. */
export type Section = InstitutionSection | ConfigSection | 'commlines' | 'commsetup' | 'dash' | 'targets' | 'dadm' | 'dsales' | 'dfin' | 'dlead' | 'dset';

export type NavItem = { key: Section; label: string; short: string; icon: IconName };
export type NavGroup = { key: string; label: string; icon: IconName; items: NavItem[] };

export const HOME: NavItem = { key: 'home', label: 'Home', short: 'Home', icon: 'home' };
/** GSP's shared inboxes (Nesil, 3 Nov): on its own under Home, as in every GSP role. */
export const INBOX: NavItem = { key: 'inbox', label: 'Inbox', short: 'Inbox', icon: 'inbox' };
/** The signed-in person's tasks (Nesil, 5 Nov): on its own under Inbox. */
export const MY_WORK: NavItem = { key: 'mywork', label: 'My Work', short: 'My Work', icon: 'check' };

export const GROUPS: NavGroup[] = [
  {
    key: 'user',
    label: 'User Modules',
    icon: 'people',
    items: [
      { key: 'courses', label: 'Course Search', short: 'Search', icon: 'search' },
      { key: 'students', label: 'Students', short: 'Students', icon: 'people' },
      { key: 'applications', label: 'Applications', short: 'Applications', icon: 'doc' },
    ],
  },
  {
    key: 'institution',
    // 18 Nov (Jovial): Partners
    label: 'Partners',
    icon: 'building',
    items: [
      { key: 'rps', label: 'Recruitment Partners', short: 'RPs', icon: 'partner' },
      // 18 Nov (Jovial): Master Partners, as in Nesil's GSP · Admin (11 Nov)
      { key: 'mps', label: 'Master Partners', short: 'Masters', icon: 'building' },
      { key: 'ips', label: 'Institution Partners', short: 'Partners', icon: 'briefcase' },
      { key: 'universities', label: 'Universities', short: 'Universities', icon: 'building' },
      { key: 'catalogue', label: 'Courses', short: 'Courses', icon: 'cap' },
      { key: 'announcements', label: 'Announcements', short: 'News', icon: 'megaphone' },
    ],
  },
  {
    key: 'dashboards',
    label: 'Dashboards',
    icon: 'chart',
    items: [
      { key: 'dash', label: 'Overview', short: 'Overview', icon: 'chart' },
      { key: 'dadm', label: 'Admissions', short: 'Admissions', icon: 'doc' },
      { key: 'dsales', label: 'Sales', short: 'Sales', icon: 'partner' },
      { key: 'dfin', label: 'Finance', short: 'Finance', icon: 'wallet' },
      { key: 'dlead', label: 'Leadership', short: 'Leadership', icon: 'briefcase' },
      { key: 'targets', label: 'Targets', short: 'Targets', icon: 'award' },
      { key: 'dset', label: 'Dashboard settings', short: 'Settings', icon: 'sliders' },
    ],
  },
  {
    key: 'commissions',
    label: 'Commissions',
    icon: 'wallet',
    // 18 Nov (Jovial): Commission lines and Setup, as in GSP · Finance
    items: [
      { key: 'commlines', label: 'Commission Lines', short: 'Lines', icon: 'wallet' },
      { key: 'commsetup', label: 'Setup', short: 'Setup', icon: 'sliders' },
    ],
  },
  {
    key: 'roles',
    label: 'User Roles',
    icon: 'shield',
    items: [
      { key: 'users', label: 'Create Roles', short: 'Users', icon: 'user' },
      { key: 'regions', label: 'Sales Regions', short: 'Regions', icon: 'globe' },
      { key: 'permissions', label: 'Permission Roles', short: 'Roles', icon: 'key' },
      { key: 'emails', label: 'Emails', short: 'Emails', icon: 'mail' },
    ],
  },
  {
    // 5 Nov (Nesil): where work goes and when it's due; Queues moved here from User Roles
    key: 'work',
    label: 'Work',
    icon: 'briefcase',
    items: [
      { key: 'queues', label: 'Queues and Working Days', short: 'Queues', icon: 'inbox' },
      { key: 'tasks', label: 'Task Rules', short: 'Tasks', icon: 'check' },
    ],
  },
  {
    key: 'recruitment',
    label: 'Recruitment',
    icon: 'partner',
    items: [{ key: 'bdm', label: 'BDM Assignment', short: 'BDMs', icon: 'user' }],
  },
  {
    key: 'course',
    label: 'Course Configuration',
    icon: 'cap',
    items: [
      { key: 'currency', label: 'Currency Exchange', short: 'Currency', icon: 'wallet' },
      { key: 'living', label: 'Living Costs and Fees', short: 'Living', icon: 'home' },
      { key: 'tags', label: 'Course Tags', short: 'Tags', icon: 'tag' },
      { key: 'levels', label: 'Program Level Configuration', short: 'Levels', icon: 'cap' },
      { key: 'grades', label: 'Grade Conversion', short: 'Grades', icon: 'award' },
      { key: 'english', label: 'English Test Equivalence', short: 'English', icon: 'chat' },
    ],
  },
  {
    key: 'application',
    label: 'Application Configuration',
    icon: 'doc',
    items: [
      { key: 'routing', label: 'Application Routing', short: 'Routing', icon: 'share' },
      { key: 'documents', label: 'Document Configuration', short: 'Documents', icon: 'folder' },
    ],
  },
  {
    key: 'other',
    label: 'Other Configurations',
    icon: 'sliders',
    items: [
      { key: 'logs', label: 'Logs', short: 'Logs', icon: 'clock' },
    ],
  },
];

export const NAV: NavItem[] = [HOME, INBOX, MY_WORK, ...GROUPS.flatMap((g) => g.items)];
export const groupOf = (k: Section) => GROUPS.find((g) => g.items.some((i) => i.key === k));

/** On phones the tab bar has room for five. */
export const TABS: Section[] = ['home', 'applications', 'universities', 'routing', 'logs'];

// the records pages are GSP · Institution's own
export type { Focus, PageProps, RecordSection, Target } from '../../institution/portal/model';
