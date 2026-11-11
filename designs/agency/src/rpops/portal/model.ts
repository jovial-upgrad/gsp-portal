import type { IconName } from '../../components/Icon';

/**
 * RP Ops' pages (Nesil, 4 Nov): GSP · Institution's **Applications**, **Students**, **Course search** and
 * **Recruitment partners**, the very pages from its folder (as GSP · Admin uses them), so they stay the same; a page
 * that needs to differ here later gets its own copy then. **Inbox** sits on top, as in every GSP role (3 Nov).
 * **Recruitment partners** became RP Ops' own copy (4 Nov: verify documents, send the agreement), and **Master
 * Partners** is RP Ops' own page. 4 Nov (later): **Home**, RP Ops' own queue, comes first and the portal opens on it.
 * `profile` is the account page, opened from the initials.
 */
export type Section = 'home' | 'inbox' | 'work' | 'applications' | 'students' | 'courses' | 'rps' | 'mps' | 'ips' | 'notices' | 'profile';

export type NavItem = { key: Section; label: string; short: string; icon: IconName };

export const NAV: NavItem[] = [
  // RP Ops' own (4 Nov, later): what's waiting on it
  { key: 'home', label: 'Home', short: 'Home', icon: 'home' },
  { key: 'inbox', label: 'Inbox', short: 'Inbox', icon: 'inbox' },
  // the signed-in person's tasks (Nesil, 5 Nov), as GSP · Admin's and GSP · Admissions'
  { key: 'work', label: 'My work', short: 'My work', icon: 'check' },
  { key: 'applications', label: 'Applications', short: 'Applications', icon: 'doc' },
  { key: 'students', label: 'Students', short: 'Students', icon: 'people' },
  { key: 'courses', label: 'Course search', short: 'Search', icon: 'search' },
  { key: 'rps', label: 'Recruitment partners', short: 'RPs', icon: 'partner' },
  // RP Ops' own (4 Nov): aggregators that bring several RPs under them
  { key: 'mps', label: 'Master Partners', short: 'Masters', icon: 'building' },
  // 6 Nov (Nesil's access sheet): GSP · Institution's Institution partners, to use (Documents and Commission too)
  { key: 'ips', label: 'Institution partners', short: 'Partners', icon: 'briefcase' },
  // 11 Nov (Jovial, Q107): Finance creates a notice; RP Ops (BAP) issues it to the RPs
  { key: 'notices', label: 'Notices', short: 'Notices', icon: 'send' },
];

/** 6 Nov access sheet: the pages RP Ops only looks at (Mail V, Students V, Applications V). */
export const VIEW: Section[] = ['inbox', 'students', 'applications'];

/** On phones the tab bar has room for five (as GSP · Institution's): Home, Inbox, Applications and RP Ops' own two. */
export const TABS: Section[] = ['home', 'inbox', 'applications', 'rps', 'mps'];

/** Where the portal opens. */
export const FIRST: Section = 'home';
