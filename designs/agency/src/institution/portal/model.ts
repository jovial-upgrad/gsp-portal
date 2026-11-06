import type { IconName } from '../../components/Icon';
import type { Db, SetDb } from '../data/store';
import { canEditObject, canSeeObject, levelFor, liveKeys, liveMenu } from '../../admin/data/menus';
import { PERM_ROLE, currentRole } from '../../proto/roles';
/** IP Ops reuses this portal (S1-1): the menu follows whichever role is on show. */
const permNow = () => (currentRole() === 'gsp-ip-ops' ? PERM_ROLE['gsp-ip-ops'] : PERM_ROLE['institution-partner']);

/**
 * The Institution Team's pages (29 Oct), in Nesil's order. It keeps GSP Team's Students, Applications and Course
 * search, and adds the records it looks after: recruitment partners, institution partners, universities and
 * courses. 29 Oct (2nd round), from the PM prototype's IP team: Announcements, after Courses; Home is the team's
 * queue. `profile` is the account page, opened from the initials on phones.
 */
export type Section = 'home' | 'mywork' | 'students' | 'applications' | 'courses' | 'rps' | 'ips' | 'universities' | 'catalogue' | 'announcements' | 'mps' | 'profile';

const ALL_NAV: { key: Section; label: string; short: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', short: 'Home', icon: 'home' },
  // slice 4 PRD: My work is in every GSP role's menu, first after Home
  { key: 'mywork', label: 'My work', short: 'My work', icon: 'checkCircle' },
  { key: 'students', label: 'Students', short: 'Students', icon: 'people' },
  { key: 'applications', label: 'Applications', short: 'Applications', icon: 'doc' },
  { key: 'courses', label: 'Find courses', short: 'Courses', icon: 'search' },
  { key: 'rps', label: 'Recruitment partners', short: 'RPs', icon: 'partner' },
  { key: 'mps', label: 'Master Partners', short: 'MPs', icon: 'people' },
  { key: 'ips', label: 'Institution partners', short: 'Partners', icon: 'briefcase' },
  { key: 'universities', label: 'Universities', short: 'Universities', icon: 'building' },
  { key: 'catalogue', label: 'Courses', short: 'Courses', icon: 'cap' },
  { key: 'announcements', label: 'Announcements', short: 'News', icon: 'mail' },
];

/** GSP · Institution's menu, cut to what Institution can open in GSP · Admin › Permission roles (HC47). */
export const NAV = liveMenu(ALL_NAV, permNow);

/** On phones the tab bar has room for five: the records first, then Home. */
export const TABS: Section[] = liveKeys<Section>(['home', 'applications', 'universities', 'catalogue', 'ips'], permNow);

/** The pages that hold records. */
export type RecordSection = 'universities' | 'catalogue' | 'ips' | 'rps' | 'announcements' | 'mps';
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
  /** The signed-in person's permission role (slice 1 names: Admin, RP Ops, IP Ops, Institution…), for the Owner rules. */
  role?: string;
};

/** A role's level on a matrix row: E edit, V view, N no access (slice 1's one helper, admin/data/menus.ts). */
export const levelOf = (role: string | undefined, object: string): 'E' | 'V' | 'N' => levelFor(role, object);
/** Slice 2 Owner rules: the roles with Edit on a row create, edit and delete; the rest only read; No access doesn't see it. */
export const canEdit = (p: { role?: string }, object: string) => canEditObject(p.role, object);
export const canSee = (p: { role?: string }, object: string) => canSeeObject(p.role, object);
/** The matrix rows the records pages read (Jovial's Permission Roles sheet, 6 Nov). */
export const OBJ = {
  ips: 'Institution Partners › Record',
  ipDocs: 'Institution Partners › Documents',
  ipComm: 'Institution Partners › Commission',
  unis: 'Universities › Record',
  campuses: 'Universities › Record',
  logins: 'Universities › Submission & Contacts',
  submission: 'Universities › Submission & Contacts',
  microsites: 'Universities › Record',
  qs: 'Universities › Update QS Rankings',
  scholarships: 'Universities › Scholarships',
  territory: 'Universities › Territory',
  courses: 'Courses › Record',
  academic: 'Courses › Academic',
  english: 'Courses › English',
  anns: 'Announcements › Record',
  rp: 'Recruitment Partners › Record',
  rpDocs: 'Recruitment Partners › Documents',
  rpIssued: 'Recruitment Partners › Agreement',
  rpBranches: 'Recruitment Partners › Branches',
  rpTeam: 'Recruitment Partners › Teams',
  rpComm: 'Recruitment Partners › Commission',
  mps: 'Master Partners › Record',
  mpDocs: 'Master Partners › Documents',
  mpComm: 'Master Partners › Commission',
} as const;
