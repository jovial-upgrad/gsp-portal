import { person, label } from '../../data/staff';
import type { IconName } from '../../components/Icon';
import type { Section as InstitutionSection } from '../../institution/portal/model';
import { canOpen } from '../data/menus';
import { PERM_ROLE, type Role } from '../../proto/roles';

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
export type ConfigSection = 'users' | 'regions' | 'permissions' | 'queues' | 'emails' | 'bdm' | 'currency' | 'living' | 'visa' | 'grades' | 'english' | 'routing' | 'documents' | 'logs' | 'security';
export type FinSection = 'fin-uni' | 'fin-rp' | 'fin-run' | 'fin-exc' | 'fin-terms' | 'fin-reports' | 'fin-setup' | 'fin-how';
export type WorkSection = 'mywork' | 'mail' | 'work-sla' | 'work-rules';
export type Section = InstitutionSection | ConfigSection | FinSection | WorkSection;

export type NavItem = { key: Section; label: string; short: string; icon: IconName };
export type NavGroup = { key: string; label: string; icon: IconName; items: NavItem[] };

export const HOME: NavItem = { key: 'home', label: 'Home', short: 'Home', icon: 'home' };

export const GROUPS: NavGroup[] = [
  {
    key: 'user',
    label: 'User modules',
    icon: 'people',
    items: [
      { key: 'courses', label: 'Find courses', short: 'Courses', icon: 'search' },
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
      // Jovial, 1 Nov (O8): one queue editor, Work › Queues, SLA and escalation
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
      { key: 'visa', label: 'Visa and health fees', short: 'Visa fees', icon: 'globe' },
      // slice 3 PRD (S3-4): the eligibility check's two tables
      { key: 'grades', label: 'Grade conversion', short: 'Grades', icon: 'cap' },
      { key: 'english', label: 'English test equivalence', short: 'English', icon: 'chat' },
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
      // Jovial, 1 Nov (HC52): the sign-in rules every GSP portal follows
      { key: 'security', label: 'Sign-in security', short: 'Security', icon: 'key' },
    ],
  },
];

export const NAV: NavItem[] = [HOME, ...GROUPS.flatMap((g) => g.items)];
export const groupOf = (k: Section) => GROUPS.find((g) => g.items.some((i) => i.key === k));

/** On phones the tab bar has room for five. */
export const TABS: Section[] = ['home', 'applications', 'universities', 'routing', 'logs'];

// the records pages are GSP · Institution's own
export type { Focus, PageProps, RecordSection, Target } from '../../institution/portal/model';

/**
 * The roles that use this portal (Jovial, 31 Oct), each with its own menu, phone tabs and signed-in person.
 * Admin keeps the configuration; Recruitment and BAP get the recruitment partners and the user modules; Finance
 * gets commissions.
 */
export type Variant = 'admin' | 'recruitment' | 'bap' | 'finance';
export type VariantSpec = { brand: string; home: NavItem; flat: NavItem[]; groups: NavGroup[]; tabs: Section[]; user: { name: string; first: string; role: string; email: string } };
const it = (key: Section, label: string, short: string, icon: IconName): NavItem => ({ key, label, short, icon });
/** The person each role signs in as, from the staff list. */
const me = (local: string) => { const s = person(`${local}@upgrad.com`); return { name: label(s), first: s.first, role: s.role, email: s.email }; };
const SPECS: Record<Variant, VariantSpec> = {
  admin: {
    brand: 'Admin',
    home: HOME,
    flat: [it('mywork', 'My work', 'My work', 'checkCircle'), it('mail', 'Mail', 'Mail', 'mail')],
    groups: [...GROUPS, { key: 'work', label: 'Work', icon: 'clock', items: [it('work-sla', 'Queues, SLA and escalation', 'SLA', 'clock'), it('work-rules', 'Task rules', 'Rules', 'sliders')] }],
    tabs: TABS, user: me('jovial.lejo') },
  recruitment: {
    brand: 'Recruitment',
    home: HOME,
    flat: [it('mywork', 'My work', 'My work', 'checkCircle'), it('rps', 'Recruitment partners', 'RPs', 'partner'), it('students', 'Students', 'Students', 'people'), it('applications', 'Applications', 'Applications', 'doc'), it('courses', 'Find courses', 'Courses', 'search'), it('announcements', 'Announcements', 'News', 'megaphone')],
    groups: [],
    tabs: ['home', 'rps', 'applications', 'students', 'courses'],
    user: me('saurabh.chaudhary'),
  },
  bap: {
    brand: 'BAP',
    home: HOME,
    flat: [it('mywork', 'My work', 'My work', 'checkCircle'), it('mail', 'Mail', 'Mail', 'mail'), it('rps', 'Recruitment partners', 'RPs', 'partner'), it('applications', 'Applications', 'Applications', 'doc'), it('courses', 'Find courses', 'Courses', 'search')],
    groups: [],
    tabs: ['home', 'rps', 'applications', 'courses'],
    user: me('garima.bhardwaj'),
  },
  finance: {
    brand: 'Finance',
    home: HOME,
    flat: [it('mywork', 'My work', 'My work', 'checkCircle'), it('mail', 'Mail', 'Mail', 'mail'), it('applications', 'Applications', 'Applications', 'doc')],
    groups: [
      { key: 'fin-money', label: 'Commissions', icon: 'wallet', items: [it('fin-uni', 'University invoices', 'Invoices', 'doc'), it('fin-rp', 'RP commission', 'RPs', 'partner'), it('fin-run', 'Payout run', 'Payouts', 'wallet'), it('fin-exc', 'Exceptions', 'Exceptions', 'alert'), it('fin-reports', 'Reports', 'Reports', 'download')] },
      { key: 'fin-setup', label: 'Setup', icon: 'sliders', items: [it('fin-terms', 'Commission terms', 'Terms', 'key'), it('fin-setup', 'Finance setup', 'Setup', 'sliders'), it('fin-how', 'How Finance works', 'How', 'info')] },
      { key: 'fin-records', label: 'Records', icon: 'building', items: [it('rps', 'Recruitment partners', 'RPs', 'partner'), it('universities', 'Universities', 'Universities', 'building')] },
    ],
    tabs: ['home', 'fin-run', 'fin-uni', 'applications', 'fin-terms'],
    user: me('suman1.verma'),
  },
};

/** The Role menu's role for each variant. */
const ROLE_OF: Record<Variant, Role> = { admin: 'gsp-admin', recruitment: 'gsp-recruitment', bap: 'gsp-bap', finance: 'gsp-finance' };
/**
 * Each variant's menu, cut to what its permission role can open in GSP · Admin › Permission roles (Jovial, 1 Nov,
 * HC47): GSP · Recruitment is Recruitment, BAP is Recruitment Ops, Finance is Finance, Admin is Admin. A group with
 * nothing left goes. Read fresh each time, so a change in Admin shows when the role's portal next draws.
 */
const cut = (v: Variant): VariantSpec => {
  const spec = SPECS[v];
  const ok = (k: Section) => canOpen(PERM_ROLE[ROLE_OF[v]], k);
  return {
    ...spec,
    flat: spec.flat.filter((i) => ok(i.key)),
    groups: spec.groups.map((g) => ({ ...g, items: g.items.filter((i) => ok(i.key)) })).filter((g) => g.items.length),
    tabs: spec.tabs.filter(ok),
  };
};
export const VARIANTS: Record<Variant, VariantSpec> = {
  get admin() { return cut('admin'); },
  get recruitment() { return cut('recruitment'); },
  get bap() { return cut('bap'); },
  get finance() { return cut('finance'); },
};
