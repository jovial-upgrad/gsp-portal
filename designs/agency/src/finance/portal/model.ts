import type { IconName } from '../../components/Icon';
import type { Feature } from '../../proto/viewOnly';

/**
 * GSP · Finance's pages (Nesil, 6 Nov): GSP · Institution's, without Announcements and with RP Ops' Recruitment partners
 * and Master Partners (they hold the agreements, branches, team and commission terms). Inbox, My work, Students and
 * Course search can be used (a student's documents only looked at, Course search without commission); everything
 * else is to look at, except each record's commission. `profile` is the account page, opened from the initials.
 */
export type Section = 'home' | 'inbox' | 'work' | 'students' | 'applications' | 'courses' | 'rps' | 'mps' | 'ips' | 'universities' | 'catalogue' | 'profile';

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
];

/** On phones the tab bar has room for five. */
export const TABS: Section[] = ['home', 'inbox', 'work', 'applications', 'rps'];

/** The pages Finance can use; every other page is to look at (with its commission still changeable). */
export const EDIT: Section[] = ['inbox', 'work', 'students', 'courses', 'profile'];

/** What Finance leaves out of the pages it shares, and what it adds (src/proto/viewOnly.tsx). */
export const HIDE: Feature[] = ['app.chat', 'app.mail', 'app.documents', 'app.submission', 'courses.commission', 'student.documents.view', 'uni.qs', 'uni.scholarships', 'uni.territory', 'uni.submission'];
export const SHOW: Feature[] = ['app.commission', 'rp.commission', 'mp.commission.edit'];
