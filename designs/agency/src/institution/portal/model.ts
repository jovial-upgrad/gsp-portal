import type { IconName } from '../../components/Icon';
import type { Db, SetDb } from '../data/store';

/**
 * The Institution Team's pages (29 Oct), in Nesil's order. It keeps GSP Team's Students, Applications and Course
 * search, and adds the records it looks after: recruitment partners, institution partners, universities and
 * courses. 29 Oct (2nd round), from the PM prototype's IP team: Announcements, after Courses; Home is the team's
 * queue. `profile` is the account page, opened from the initials on phones.
 */
export type Section = 'home' | 'students' | 'applications' | 'courses' | 'rps' | 'ips' | 'universities' | 'catalogue' | 'announcements' | 'profile';

export const NAV: { key: Section; label: string; short: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', short: 'Home', icon: 'home' },
  { key: 'students', label: 'Students', short: 'Students', icon: 'people' },
  { key: 'applications', label: 'Applications', short: 'Applications', icon: 'doc' },
  { key: 'courses', label: 'Course search', short: 'Search', icon: 'search' },
  { key: 'rps', label: 'Recruitment partners', short: 'RPs', icon: 'partner' },
  { key: 'ips', label: 'Institution partners', short: 'Partners', icon: 'briefcase' },
  { key: 'universities', label: 'Universities', short: 'Universities', icon: 'building' },
  { key: 'catalogue', label: 'Courses', short: 'Courses', icon: 'cap' },
  { key: 'announcements', label: 'Announcements', short: 'News', icon: 'mail' },
];

/** On phones the tab bar has room for five: the records first, then Home. */
export const TABS: Section[] = ['home', 'applications', 'universities', 'catalogue', 'ips'];

/** The pages that hold records. */
export type RecordSection = 'universities' | 'catalogue' | 'ips' | 'rps' | 'announcements';
/** A record to open, on which tab, and where its back link goes when it isn't its own list. */
export type Target = { section: RecordSection; id: string; tab?: string; back?: Target & { label: string } };
/** A record opened from somewhere else (Home's queue, another record): a new key each time. */
export type Focus = Target & { key: number };

/** What every records page gets from the portal. */
export type PageProps = {
  db: Db;
  set: SetDb;
  focus: Focus | null;
  navKey: number;
  /** Opens a record on any records page. */
  open: (t: Target) => void;
  /** A short confirmation, shown for a moment and read out. */
  say: (m: string) => void;
  scrollTop: () => void;
  /** Who's signed in. */
  me: string;
  /** GSP · BAP (and Admin) verify new recruitment partners' documents on Recruitment partners (W4). */
  canVerify?: boolean;
};
