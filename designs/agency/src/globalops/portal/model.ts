import type { IconName } from '../../components/Icon';
import type { Feature } from '../../proto/viewOnly';

/**
 * GSP · Global Ops' pages (Nesil, 6 Nov, from the access sheet): GSP · Institution's, with RP Ops' Master Partners (and
 * its Recruitment partners, so the two open each other). E: My work, Inbox, Course search (no commission), Students,
 * Applications (no commission), a university's record (Territory to look at; Scholarships and Submission and contacts
 * to change), Announcements. V: Recruitment partners and Master Partners (no Documents, agreements, branches, team or
 * commission), Institution partners (no Commission), the Universities list (no Update QS ranking or Add), Courses (its
 * Academic and English rules to change). `profile` is the account page, opened from the initials.
 */
export type Section = 'home' | 'inbox' | 'work' | 'students' | 'applications' | 'courses' | 'rps' | 'mps' | 'ips' | 'universities' | 'catalogue' | 'announcements' | 'profile';

export type NavItem = { key: Section; label: string; short: string; icon: IconName };

export const NAV: NavItem[] = [
  { key: 'home', label: 'Home', short: 'Home', icon: 'home' },
  { key: 'inbox', label: 'Inbox', short: 'Inbox', icon: 'inbox' },
  { key: 'work', label: 'My work', short: 'My work', icon: 'check' },
  { key: 'students', label: 'Students', short: 'Students', icon: 'people' },
  { key: 'applications', label: 'Applications', short: 'Applications', icon: 'doc' },
  { key: 'courses', label: 'Course search', short: 'Search', icon: 'search' },
  { key: 'rps', label: 'Recruitment partners', short: 'RPs', icon: 'partner' },
  { key: 'mps', label: 'Master Partners', short: 'Masters', icon: 'building' },
  { key: 'ips', label: 'Institution partners', short: 'Partners', icon: 'briefcase' },
  { key: 'universities', label: 'Universities', short: 'Universities', icon: 'building' },
  { key: 'catalogue', label: 'Courses', short: 'Courses', icon: 'cap' },
  { key: 'announcements', label: 'Announcements', short: 'News', icon: 'mail' },
];

/** On phones the tab bar has room for five. */
export const TABS: Section[] = ['home', 'inbox', 'work', 'applications', 'universities'];

/** The pages to look at; the rest can be used (with what's hidden or view only below). */
export const VIEW: Section[] = ['rps', 'mps', 'ips', 'catalogue'];

/** What Global Ops leaves out of the pages it shares, and what it adds (src/proto/viewOnly.tsx). */
export const HIDE: Feature[] = [
  'courses.commission',
  'app.base-commission',
  'rp.documents',
  'rp.branches',
  'rp.team',
  'rp.commission-email',
  'mp.documents',
  'mp.commission',
  'ip.commission',
  'uni.qs-update',
  'uni.add',
  'uni.territory.view',
];
export const SHOW: Feature[] = ['course.academic', 'course.english'];
