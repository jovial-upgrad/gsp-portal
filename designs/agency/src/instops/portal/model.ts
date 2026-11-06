import type { IconName } from '../../components/Icon';
import type { Feature } from '../../proto/viewOnly';

/**
 * GSP · Institution Ops' pages (Nesil, 6 Nov, from the access sheet: E edit, V view, – not shown): GSP · Institution's,
 * without Students, Applications, Recruitment partners or Master Partners. E: My work, Inbox, Course search (no
 * commission; with no students, no student picker, shortlist or Apply), Universities, Courses, Announcements.
 * V: Institution partners (Documents and Commission too). Home is GSP · Institution's.
 */
export type Section = 'home' | 'inbox' | 'work' | 'courses' | 'ips' | 'universities' | 'catalogue' | 'announcements' | 'profile' | Hidden;
/** Pages the shared code can link to (a notification about an application, a partner) that Institution Ops doesn't have: they open Home. */
export type Hidden = 'students' | 'applications' | 'rps' | 'mps';
export const HIDDEN: Section[] = ['students', 'applications', 'rps', 'mps'];

export type NavItem = { key: Section; label: string; short: string; icon: IconName };

export const NAV: NavItem[] = [
  { key: 'home', label: 'Home', short: 'Home', icon: 'home' },
  { key: 'inbox', label: 'Inbox', short: 'Inbox', icon: 'inbox' },
  { key: 'work', label: 'My work', short: 'My work', icon: 'check' },
  { key: 'courses', label: 'Course search', short: 'Search', icon: 'search' },
  { key: 'ips', label: 'Institution partners', short: 'Partners', icon: 'briefcase' },
  { key: 'universities', label: 'Universities', short: 'Universities', icon: 'building' },
  { key: 'catalogue', label: 'Courses', short: 'Courses', icon: 'cap' },
  { key: 'announcements', label: 'Announcements', short: 'News', icon: 'mail' },
];

/** On phones the tab bar has room for five. */
export const TABS: Section[] = ['home', 'inbox', 'universities', 'catalogue', 'announcements'];

/** The pages to look at; the rest can be used. */
export const VIEW: Section[] = ['ips'];

/** What Institution Ops leaves out of the pages it shares (src/proto/viewOnly.tsx). */
export const HIDE: Feature[] = ['courses.commission', 'courses.students'];
export const SHOW: Feature[] = [];
