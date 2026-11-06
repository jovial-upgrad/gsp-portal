import type { IconName } from '../../components/Icon';
import type { Feature } from '../../proto/viewOnly';

/**
 * GSP · Recruitment's pages (Nesil, 6 Nov, from the access sheet: E edit, V view, – not shown): GSP · Institution's,
 * without Inbox (Mail –), Universities, Courses or Announcements, and with RP Ops' Recruitment partners and Master
 * Partners. E: My work, Course search (commission –), Recruitment partners (list, record, branches, team; its documents,
 * agreements and commission V), an application's Chat. V: Students, Applications (Documents and Commission V; Mail and
 * Submission –), Master Partners, Institution partners. Home is RP Ops' queue of partners.
 */
export type Section = 'home' | 'work' | 'students' | 'applications' | 'courses' | 'rps' | 'mps' | 'ips' | 'profile';

export type NavItem = { key: Section; label: string; short: string; icon: IconName };

export const NAV: NavItem[] = [
  { key: 'home', label: 'Home', short: 'Home', icon: 'home' },
  { key: 'work', label: 'My work', short: 'My work', icon: 'check' },
  { key: 'students', label: 'Students', short: 'Students', icon: 'people' },
  { key: 'applications', label: 'Applications', short: 'Applications', icon: 'doc' },
  { key: 'courses', label: 'Course search', short: 'Search', icon: 'search' },
  { key: 'rps', label: 'Recruitment partners', short: 'RPs', icon: 'partner' },
  { key: 'mps', label: 'Master Partners', short: 'Masters', icon: 'building' },
  { key: 'ips', label: 'Institution partners', short: 'Partners', icon: 'briefcase' },
];

/** On phones the tab bar has room for five. */
export const TABS: Section[] = ['home', 'work', 'applications', 'courses', 'rps'];

/** The pages to look at; the rest can be used (with what's hidden or view only below). */
export const VIEW: Section[] = ['students', 'applications', 'mps', 'ips'];

/** What Recruitment leaves out or keeps view only, and what it adds or re-opens (src/proto/viewOnly.tsx). */
export const HIDE: Feature[] = ['courses.commission', 'app.mail', 'app.submission', 'app.commission.view', 'rp.documents.view', 'rp.commission.view'];
export const SHOW: Feature[] = ['app.commission', 'app.chat.edit', 'rp.commission'];
