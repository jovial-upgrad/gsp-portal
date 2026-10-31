/**
 * Announcements (29 Oct, 2nd round, from the PM prototype's IP team): news the team publishes to recruitment partners
 * about its universities, shown in the RP portal's top bar, on matching course cards and on the university's page.
 * Each has a publish date and an expiry; it can go out by email too. In this prototype what the team publishes stays in
 * its portal; RP Admin's and GSP Team's megaphone (30 Oct) read this model, each its own copy of the samples. 29 Oct (6th round): the PM prototype's fields only (a subcategory, the
 * recipients by user type, role, country and sales region, a formatted description with images or PDFs), and no log.
 * 29 Oct (7th round): it publishes on a date, with no time, and says who last changed it, and when.
 */
import type { Area, Level } from '../../data/courses';
import { inDays, type Stamp } from './records';
import { nameOf } from '../../data/staff';
/** An Institution person's name from the staff list, by the start of their email. */
const IN = (local: string) => nameOf(`${local}@upgrad.com`);


export const ANN_CATEGORIES = ['Promotion', 'Scholarship', 'Key Dates', 'Admission', 'Fees & Commission', 'Student Service', 'System Updates'] as const;
/** Only some categories have subcategories. */
export const SUBCATEGORIES: Partial<Record<(typeof ANN_CATEGORIES)[number], string[]>> = {
  Admission: ['Assessment', 'Process Updates', 'Exception/Exclusion', 'Territory Updates', 'New Courses', 'New Intakes', 'Design Templates'],
  'System Updates': ['New feature', 'Improvement', 'Fix'],
};
export const USER_TYPES = ['GSP', 'RP', 'MP'] as const;
export const PERMISSION_ROLES = ['Admissions', 'Admissions Head', 'BAP', 'Data', 'IP', 'Recruitment', 'Recruitment Head', 'Commissions & Finance', 'Super Admin', 'Leadership', 'Master Partner admin', 'RP admin', 'RP branch manager', 'RP counsellor'] as const;
export const SALES_REGIONS = ['India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Vietnam', 'Pakistan', 'Indonesia, Malaysia and Thailand', 'Myanmar and Bhutan', 'Australia', 'Philippines', 'Africa', 'Latin America and Europe', 'China', 'Rest of world', 'Direct', 'Global'] as const;
export type AnnCategory = (typeof ANN_CATEGORIES)[number];
export const ANN_STATUSES = ['Draft', 'Scheduled', 'Live', 'Expired', 'Withdrawn'] as const;
export type AnnStatus = (typeof ANN_STATUSES)[number];

export type Announcement = {
  /** "AN-112". */
  id: string;
  title: string;
  category: AnnCategory;
  subcategory: string;
  /** Universities it's about; empty for news about the portal itself. */
  unis: string[];
  /** Empty for every level and every area. */
  levels: Level[];
  areas: Area[];
  /** "2026-10-20": the day it publishes. */
  publish: string;
  /** "2026-12-15". */
  expires: string;
  /** Formatted: bold, italics, lists, headings and links. */
  body: string;
  /** Images or PDFs attached to it. */
  files: string[];
  email: boolean;
  /** Who gets it: user types (at least one), and their roles, countries and sales regions (empty for all). */
  userTypes: string[];
  roles: string[];
  countries: string[];
  regions: string[];
  author: string;
  draft: boolean;
  withdrawn: boolean;
  /** Recruitment partners who've seen it, and emails sent and opened, once it's out. */
  reached: number;
  sent: number;
  opened: number;
  /** Who last changed it, and when. */
  updated?: Stamp;
};

export function statusOf(a: Announcement, now = Date.now()): AnnStatus {
  if (a.draft) return 'Draft';
  if (a.withdrawn) return 'Withdrawn';
  if (new Date(`${a.expires}T23:59:59`).getTime() < now) return 'Expired';
  if (new Date(`${a.publish.slice(0, 10)}T00:00:00`).getTime() > now) return 'Scheduled';
  return 'Live';
}


export const sampleAnnouncements = (): Announcement[] => [
  {
    id: 'AN-111',
    title: 'Flinders: February intake applications close 15 December',
    category: 'Key Dates', subcategory: '',
    unis: ['flinders'],
    levels: [],
    areas: [],
    userTypes: ['RP'],
    roles: [],
    countries: [],
    regions: [],
    publish: inDays(-9),
    expires: inDays(47),
    body: 'Flinders University has moved its last date for February applications to 15 December. Offers already made are not affected.',
    files: [],
    email: true,
    author: IN('kevin.mcewan'),
    draft: false,
    withdrawn: false,
    reached: 214,
    sent: 186,
    opened: 121,
    updated: { by: IN('kevin.mcewan'), at: inDays(-3) },
  },
  {
    id: 'AN-110',
    title: 'Deakin: new Master of Cyber Security at Burwood',
    category: 'Admission',
    subcategory: 'New Courses',
    unis: ['deakin'],
    levels: ['Master’s degree'],
    areas: ['Computing and IT'],
    userTypes: ['RP'],
    roles: [],
    countries: [],
    regions: [],
    publish: inDays(-11),
    expires: inDays(94),
    body: 'Deakin University has added a Master of Cyber Security at its Burwood campus, for the March and July intakes.',
    files: [],
    email: false,
    author: IN('catherine.wilson'),
    draft: false,
    withdrawn: false,
    reached: 162,
    sent: 0,
    opened: 0,
  },
  {
    id: 'AN-109',
    title: 'Flinders: up to 25% off tuition for Nursing',
    category: 'Scholarship', subcategory: '',
    unis: ['flinders'],
    levels: ['Bachelor’s degree', 'Master’s degree'],
    areas: ['Health and nursing'],
    userTypes: ['RP'],
    roles: [],
    countries: ['India', 'Nepal', 'Sri Lanka'],
    regions: [],
    publish: inDays(-19),
    expires: inDays(123),
    body: 'The Flinders International Excellence Scholarship now covers Nursing: 15% to 25% off tuition each year for students with 70% or more in their last qualification.',
    files: [],
    email: true,
    author: IN('kevin.mcewan'),
    draft: false,
    withdrawn: false,
    reached: 301,
    sent: 254,
    opened: 190,
  },
  {
    id: 'AN-112',
    title: 'Canberra: partner webinar on the February intake',
    category: 'Promotion', subcategory: '',
    unis: ['canberra'],
    levels: [],
    areas: [],
    userTypes: ['RP'],
    roles: [],
    countries: [],
    regions: [],
    publish: inDays(3),
    expires: inDays(7),
    body: 'Join the University of Canberra’s international team for a 45-minute webinar on courses, scholarships and dates for February.',
    files: [],
    email: true,
    author: IN('kevin.mcewan'),
    draft: false,
    withdrawn: false,
    reached: 0,
    sent: 0,
    opened: 0,
  },
  {
    id: 'AN-113',
    title: 'Coventry: tuition deposit lowered to GBP 3,000',
    category: 'Fees & Commission', subcategory: '',
    unis: ['coventry'],
    levels: [],
    areas: [],
    userTypes: ['RP'],
    roles: [],
    countries: [],
    regions: [],
    publish: inDays(5),
    expires: inDays(60),
    body: '',
    files: [],
    email: false,
    author: IN('namita.nath'),
    draft: true,
    withdrawn: false,
    reached: 0,
    sent: 0,
    opened: 0,
  },
  {
    id: 'AN-104',
    title: 'Massey: applications paused',
    category: 'Admission',
    subcategory: 'Process Updates',
    unis: ['massey'],
    levels: [],
    areas: [],
    userTypes: ['RP'],
    roles: [],
    countries: [],
    regions: [],
    publish: inDays(-240),
    expires: inDays(-150),
    body: 'GSP isn’t taking new applications for Massey University for now. Applications already made carry on.',
    files: [],
    email: true,
    author: IN('lalaine.dizon'),
    draft: false,
    withdrawn: false,
    reached: 288,
    sent: 240,
    opened: 171,
  },
  {
    id: 'AN-107',
    title: 'Griffith College: September intake extended',
    category: 'Key Dates', subcategory: '',
    unis: ['griffith'],
    levels: [],
    areas: [],
    userTypes: ['RP'],
    roles: [],
    countries: [],
    regions: [],
    publish: inDays(-30),
    expires: inDays(20),
    body: 'Griffith College has extended its September intake for late arrivals.',
    files: [],
    email: false,
    author: IN('catherine.wilson'),
    draft: false,
    withdrawn: true,
    reached: 95,
    sent: 0,
    opened: 0,
  },
];
