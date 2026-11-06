/**
 * Announcements (29 Oct, 2nd round, from the PM prototype's IP team): news the team publishes to recruitment partners
 * about its universities, shown in the RP portal's top bar, on matching course cards and on the university's page.
 * Each has a publish date and an expiry; it can go out by email too. In this prototype what the team publishes stays in
 * its portal; RP Admin's and GSP Team's megaphone (30 Oct) read this model, each its own copy of the samples. 29 Oct (6th round): the PM prototype's fields only (a subcategory, the
 * recipients by user type, role, country and sales region, a formatted description with images or PDFs).
 * 29 Oct (7th round): it publishes on a date, with no time, and says who last changed it, and when.
 * Jovial, 2 Nov (S2C-15): a Scheduled or Live announcement can be edited, and every edit is written to its Change
 * log; only the emails sent are counted ("N sent"), not opens. S2C-18: it goes live at the first job run (J9) on its
 * publish date, just after midnight IST, and shows through its expiry date (IST).
 */
import type { Area, Level } from '../../data/courses';
import { inDays, type Stamp } from './records';
import type { Change } from './changelog';
import { nameOf } from '../../data/staff';
import { ROLES as GSP_PERMISSION_ROLES, salesRegionNames } from '../../admin/data/config';
/** An Institution person's name from the staff list, by the start of their email. */
const IN = (local: string) => nameOf(`${local}@upgrad.com`);


export const ANN_CATEGORIES = ['Promotion', 'Scholarship', 'Key Dates', 'Admission', 'Fees & Commission', 'Student Service', 'System Updates'] as const;
/** Only some categories have subcategories. */
export const SUBCATEGORIES: Partial<Record<(typeof ANN_CATEGORIES)[number], string[]>> = {
  Admission: ['Assessment', 'Process Updates', 'Exception/Exclusion', 'Territory Updates', 'New Courses', 'New Intakes', 'Design Templates'],
  'System Updates': ['New feature', 'Improvement', 'Fix'],
};
/** Slice 2 PRD (S2-24): Master Partners have no users, so they're not a recipient. */
export const USER_TYPES = ['GSP', 'RP'] as const;
/** Who an announcement can go to (slice 2 PRD): GSP's nine permission roles (slice 1 names) and the three RP roles. No Master Partner (S2-24). */
export const GSP_ROLES = ['Admin', 'Admission', 'Global Ops', 'Recruitment', 'RP Ops', 'Institution', 'IP Ops', 'Finance', 'View Only'] as const;
export const RP_ROLES = ['RP Admin', 'Branch Manager', 'Counsellor'] as const;
export const PERMISSION_ROLES = [...GSP_ROLES, ...RP_ROLES] as const;
void GSP_PERMISSION_ROLES;
/** The sales regions (HC38, 1 Nov): GSP · Admin › Sales regions, the only list, read each time it's listed. */
export const SALES_REGIONS: Iterable<string> = { [Symbol.iterator]: () => salesRegionNames()[Symbol.iterator]() };
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
  /** Images or PDFs attached to it, by file name. */
  files: string[];
  /** The stored file behind each attached image (file name → its address in file storage); PDFs open by name. */
  media?: Record<string, string>;
  /** GSP Assist's one-line summary, written once by job J9 when the announcement goes live and saved with it. */
  summary?: string;
  email: boolean;
  /** Who gets it: user types (at least one), and their roles, countries and sales regions (empty for all). */
  userTypes: string[];
  roles: string[];
  countries: string[];
  regions: string[];
  author: string;
  draft: boolean;
  withdrawn: boolean;
  /** Emails sent, once it's out (S2C-15: only "N sent" is shown; opens aren't tracked). */
  sent: number;
  /** Its Change log (S2C-15): every save of a Scheduled or Live announcement, field by field. */
  log?: Change[];
  /** Who last changed it, and when. */
  updated?: Stamp;
  /** System information (slice 2 PRD): created on; created by is the author. */
  createdAt?: string;
};

export function statusOf(a: Announcement, now = Date.now()): AnnStatus {
  if (a.draft) return 'Draft';
  if (a.withdrawn) return 'Withdrawn';
  // IST days (S2C-18): live from the first job run on the publish date, just after midnight IST; through the expiry date
  if (new Date(`${a.expires}T23:59:59+05:30`).getTime() < now) return 'Expired';
  if (new Date(`${a.publish.slice(0, 10)}T00:00:00+05:30`).getTime() > now) return 'Scheduled';
  return 'Live';
}

/** Is this attached file an image (shown as a picture) or a document (a chip that opens it)? */
export const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(name);

/**
 * GSP Assist's summary of one announcement (Jovial, 4 Nov): written once, when job J9 makes it live, and saved on
 * it, so everyone sees the same line. The real build asks the model for one plain sentence (under 25 words) from the
 * title and description; this prototype stands in with the description's first sentence until J9 has saved one.
 */
export function summaryOf(a: Announcement): string {
  if (a.summary) return a.summary;
  const text = a.body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();
  const first = text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text;
  return first || a.title;
}


/** A seeded announcement's attached image, as the file storage would hold it (sample records only). */
const sampleImage = (from: string, to: string, line: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="520" cy="70" r="120" fill="#fff" opacity=".12"/><text x="36" y="310" font-family="Figtree,Arial" font-size="40" font-weight="700" fill="#fff">${line}</text></svg>`,
  );

export const sampleAnnouncements = (): Announcement[] => [
  {
    id: 'AN-114',
    title: 'Flinders: virtual open day for partners on 21 November',
    category: 'Promotion', subcategory: '',
    unis: ['flinders'],
    levels: [],
    areas: [],
    userTypes: ['RP'],
    roles: [],
    countries: [],
    regions: [],
    publish: inDays(-2),
    expires: inDays(17),
    body: 'Flinders runs a virtual open day for partners on 21 November, with course talks and a Q&A with admissions. Register by 18 November.',
    files: ['Open day poster.png', 'Open day campus.png', 'Open day agenda.pdf'],
    media: { 'Open day poster.png': sampleImage('#0B2A5B', '#2F6FD0', 'Open day · 21 November'), 'Open day campus.png': sampleImage('#17703F', '#0AA6C9', 'Bedford Park') },
    email: true,
    author: IN('kevin.mcewan'),
    draft: false,
    withdrawn: false,
    sent: 211,
  },
  {
    id: 'AN-115',
    title: 'Flinders: Business and Analytics masters add a July intake',
    category: 'Admission', subcategory: 'New Intakes',
    unis: ['flinders'],
    levels: ['Master’s degree'],
    areas: ['Business and management', 'Data and analytics'],
    userTypes: ['RP'],
    roles: [],
    countries: [],
    regions: [],
    publish: inDays(-5),
    expires: inDays(80),
    body: 'Business and Data and Analytics masters at Bedford Park now take students in July 2027 as well as February. Applications open on 1 December.',
    files: ['July 2027 intake.png', 'Course list July 2027.pdf'],
    media: { 'July 2027 intake.png': sampleImage('#C2246B', '#7A2E91', 'New: July 2027 intake') },
    email: false,
    author: IN('kevin.mcewan'),
    draft: false,
    withdrawn: false,
    sent: 0,
  },
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
    sent: 186,
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
    sent: 0,
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
    sent: 254,
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
    sent: 0,
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
    sent: 0,
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
    sent: 240,
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
    sent: 0,
  },
];
