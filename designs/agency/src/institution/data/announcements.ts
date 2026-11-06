/**
 * Announcements (29 Oct, 2nd round, from the PM prototype's IP team): news the team publishes to recruitment partners
 * about its universities, shown in the RP portal's top bar, on matching course cards and on the university's page.
 * Each has a publish date and an expiry; it can go out by email too. In this prototype what the team publishes stays in
 * its portal; RP Admin's and GSP Team's megaphone (30 Oct) read this model, each its own copy of the samples. 29 Oct (6th round): the PM prototype's fields only (a subcategory, the
 * recipients by user type, role, country and sales region, a formatted description with images or PDFs), and no log.
 * 29 Oct (7th round): it publishes on a date, with no time, and says who last changed it, and when.
 */
import { COURSES, CURRENCY, LEVELS, UNIVERSITIES, type Area, type Destination, type Level, type University } from '../../data/courses';
import { dateText, inDays, logLine, type LogLine, type Stamp } from './records';
import creative from '../../assets/campus/sample-1.webp';
// 4 Nov: pictures for the sample announcements' image attachments
import walkPhoto from '../../assets/campus/sample-2.webp';
import friendsPhoto from '../../assets/campus/sample-3.webp';
import loungePhoto from '../../assets/campus/sample-4.webp';

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
  /** 4 Nov: who created it, and when (its author, on its publish date, when not kept). */
  created?: Stamp;
  /** 4 Nov: every change, newest first, for its Logs. */
  log?: LogLine[];
  /** 4 Nov: each attached image's picture, by file name, for the preview's creative. */
  art?: Record<string, string>;
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
    files: ['flinders-february-2027-key-dates.pdf'],
    email: true,
    author: 'Raj Shamani',
    draft: false,
    withdrawn: false,
    reached: 214,
    sent: 186,
    opened: 121,
    updated: { by: 'Raj Shamani', at: inDays(-3) },
    // 4 Nov: its Logs
    created: { by: 'Raj Shamani', at: `${inDays(-10)}T16:05` },
    log: [logLine('Raj Shamani', 'status', 'Published', `${inDays(-9)}T09:00`), logLine('Raj Shamani', 'details', 'Changed the description', `${inDays(-3)}T11:40`)],
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
    files: ['deakin-burwood-campus.webp', 'master-of-cyber-security-course-guide.pdf'],
    art: { 'deakin-burwood-campus.webp': walkPhoto },
    email: false,
    author: 'Kavya Menon',
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
    // 4 Nov: a creative, first in its preview
    files: ['flinders-nursing-scholarship.webp', 'flinders-excellence-scholarship-terms.pdf'],
    art: { 'flinders-nursing-scholarship.webp': creative },
    email: true,
    author: 'Raj Shamani',
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
    author: 'Raj Shamani',
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
    author: 'Arjun Mehta',
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
    author: 'Leena Thomas',
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
    author: 'Kavya Menon',
    draft: false,
    withdrawn: true,
    reached: 95,
    sent: 0,
    opened: 0,
  },
];

/* ---------- Every university's recent announcements (3 Nov) ---------- */

/** The months each country's intakes start in. */
const INTAKE_MONTHS: Record<Destination, number[]> = { Australia: [2, 7, 11], UK: [1, 5, 9], Canada: [1, 5, 9], 'New Zealand': [3, 7], Ireland: [1, 9], USA: [1, 8] };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LEVEL_WORD: Record<Level, string> = {
  Foundation: 'foundation',
  Diploma: 'diploma',
  'Bachelor’s degree': 'bachelor’s',
  'Postgraduate diploma': 'postgraduate diploma',
  'Master’s degree': 'master’s',
  'PhD or research': 'research',
};
const AUTHORS = ['Raj Shamani', 'Kavya Menon', 'Arjun Mehta', 'Leena Thomas'];
const SHORT: Record<string, string> = { vu: 'Victoria University', feduni: 'Federation University', cqu: 'CQUniversity', dbs: 'DBS', unisc: 'UniSC' };
const shortName = (u: University) => SHORT[u.id] ?? u.name.replace(/^University of (the )?/, '').replace(/ University$/, '');
const isoIn = (ms: number) => inDays(Math.round((ms - Date.now()) / 86_400_000));

/** The next two intakes at least 45 days off, as "February 2027", with the day each starts. */
function nextIntakes(country: Destination): { name: string; start: number }[] {
  const now = new Date();
  const out: { name: string; start: number }[] = [];
  for (let y = now.getFullYear(); out.length < 2; y++)
    for (const m of INTAKE_MONTHS[country]) {
      const start = new Date(y, m - 1, 1).getTime();
      if (start - Date.now() >= 45 * 86_400_000 && out.length < 2) out.push({ name: `${MONTH_NAMES[m - 1]} ${y}`, start });
    }
  return out;
}

/** What a university's courses are mostly: its commonest program level and study area. */
function mostly(u: University): { level: Level; area: Area } {
  const mine = COURSES.filter((c) => c.uni.id === u.id);
  const top = <T,>(pick: (c: (typeof mine)[number]) => T) => {
    const n = new Map<T, number>();
    for (const c of mine) n.set(pick(c), (n.get(pick(c)) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0][0];
  };
  return { level: mine.length ? top((c) => c.level) : LEVELS[4], area: mine.length ? top((c) => c.area) : ('Business and management' as Area) };
}

type Draft = Pick<Announcement, 'title' | 'category' | 'subcategory' | 'body'> & Partial<Pick<Announcement, 'levels' | 'areas' | 'countries' | 'files' | 'art'>> & { from: number; to: number };

/** Live ones: published in the last six weeks, still running. */
const LIVE: ((x: Ctx) => Draft)[] = [
  (x) => {
    const close = Math.max(x.next.start - 45 * 86_400_000, Date.now() + 12 * 86_400_000);
    return { category: 'Key Dates', subcategory: '', title: `${x.s}: ${x.next.name} applications close ${dateText(isoIn(close), true)}`, body: `${x.u.name} takes applications for its ${x.next.name} intake until ${dateText(isoIn(close))}. Send complete applications at least two weeks before, so offers come in time for the visa.`, from: -6, to: Math.round((close - Date.now()) / 86_400_000) };
  },
  (x) => ({
    category: 'Scholarship',
    subcategory: '',
    title: `${x.s}: ${x.pct}% off tuition in ${x.area}`,
    body: `${x.u.name} is giving ${x.pct}% off the first year’s tuition to ${LEVEL_WORD[x.level]} students in ${x.area} who start in ${x.next.name}. Students need 65% or more in their last qualification; the offer letter says when it applies.`,
    levels: [x.level],
    areas: [x.area],
    files: [`${x.u.id}-scholarship-terms-${x.year}.pdf`],
    from: -14,
    to: 70,
  }),
  (x) => ({
    category: 'Admission',
    subcategory: 'New Intakes',
    title: `${x.s}: new ${x.after.name} intake at ${x.campus}`,
    body: `${x.u.name} is opening a ${x.after.name} intake at its ${x.campus} campus for ${LEVEL_WORD[x.level]} courses. Applications for it open now, alongside the ${x.next.name} intake.`,
    levels: [x.level],
    from: -21,
    to: 90,
  }),
  (x) => ({
    category: 'Admission',
    subcategory: 'Process Updates',
    title: `${x.s}: offers in about ${x.u.offerDays} working days`,
    body: `${x.u.name} now sends offers in about ${x.u.offerDays} working days for complete applications. A missing transcript or an unsigned statement of purpose adds about a week.`,
    from: -27,
    to: 60,
  }),
  (x) => ({
    category: 'Student Service',
    subcategory: '',
    title: `${x.s}: a room for every first-year student`,
    body: `International students who accept their offer by ${dateText(inDays(45))} get a place in student accommodation in ${x.city} for their first year. They book it from their offer email.`,
    files: [`${x.u.id}-student-lounge.webp`, `${x.u.id}-accommodation-guide.pdf`],
    art: { [`${x.u.id}-student-lounge.webp`]: loungePhoto },
    from: -9,
    to: 45,
  }),
  (x) => ({
    category: 'Fees & Commission',
    subcategory: '',
    title: `${x.s}: ${x.year} tuition published`,
    body: `${x.u.name} has published its tuition for ${x.year}. Most courses go up by 3 to 4%. Offers already made keep their fee, and course search shows the new fees as they’re checked.`,
    files: [`${x.u.id}-tuition-fees-${x.year}.pdf`],
    from: -33,
    to: 100,
  }),
  (x) => ({
    category: 'Admission',
    subcategory: 'New Courses',
    title: `${x.s}: a new ${LEVEL_WORD[x.level]} in ${x.area}`,
    body: `${x.u.name} has added a ${LEVEL_WORD[x.level]} course in ${x.area} at ${x.campus}, starting with the ${x.after.name} intake. Its entry rules are the same as the university’s other ${LEVEL_WORD[x.level]} courses in ${x.area}.`,
    levels: [x.level],
    areas: [x.area],
    from: -4,
    to: 120,
  }),
  (x) => ({
    category: 'Key Dates',
    subcategory: '',
    title: `${x.s}: orientation for ${x.next.name}`,
    body: `Orientation for the ${x.next.name} intake starts on ${dateText(isoIn(x.next.start - 7 * 86_400_000))} in ${x.city}. Students should arrive a few days before; the university meets them at the airport if they book a pickup.`,
    files: [`${x.u.id}-orientation-week.webp`],
    art: { [`${x.u.id}-orientation-week.webp`]: friendsPhoto },
    from: -17,
    to: Math.round((x.next.start - Date.now()) / 86_400_000),
  }),
];

/** Ones that ended in the last two months. */
const ENDED: ((x: Ctx) => Draft)[] = [
  (x) => ({ category: 'Promotion', subcategory: '', title: `${x.s}: application fee waived`, body: `${x.u.name} waived its application fee for applications sent through GSP until ${dateText(inDays(-24))}.`, from: -70, to: -24 }),
  (x) => ({ category: 'Promotion', subcategory: '', title: `${x.s}: ${x.cur} ${x.cur === 'GBP' || x.cur === 'EUR' ? '500' : '1,000'} off for an early deposit`, body: `Students who paid their deposit by ${dateText(inDays(-31))} got ${x.cur} ${x.cur === 'GBP' || x.cur === 'EUR' ? '500' : '1,000'} off their first term’s tuition.`, from: -80, to: -31 }),
  (x) => ({ category: 'Admission', subcategory: 'Process Updates', title: `${x.s}: offers a week slower`, body: `Offers from ${x.u.name} were taking a week longer than usual while its admissions team moved to a new system. They’re back to the usual time now.`, from: -58, to: -15 }),
];

type Ctx = { u: University; s: string; city: string; campus: string; next: { name: string; start: number }; after: { name: string; start: number }; level: Level; area: Area; pct: number; year: number; cur: string };

/**
 * Every university's recent announcements, for the course dialog's University tab only (Nesil, 3 Nov: "show 3 or 4"
 * there, with Summarise): two live and one that ended lately for each, and a third live one for every other
 * university. They're kept apart from the team's own, so the megaphone and the Announcements page don't change.
 * Some are for one program level and study area, so a course of that kind shows them as its own.
 */
export function universityNews(): Announcement[] {
  const out: (Announcement & { at: number })[] = [];
  UNIVERSITIES.forEach((u, i) => {
    const [next, after] = nextIntakes(u.country);
    const { level, area } = mostly(u);
    const k = u.campuses[i % u.campuses.length];
    const x: Ctx = { u, s: shortName(u), city: k.city.split(',')[0], campus: k.name, next, after, level, area, pct: [10, 15, 20, 25][i % 4], year: new Date(next.start).getFullYear(), cur: CURRENCY[u.country] };
    const picks = [LIVE[i % LIVE.length](x), LIVE[(i + 3) % LIVE.length](x), ...(i % 2 === 0 ? [LIVE[(i + 5) % LIVE.length](x)] : []), ENDED[i % ENDED.length](x)];
    picks.forEach((d, j) => {
      const shift = (i * 5 + j * 3) % 7; // spread the dates a little between universities
      const sent = 40 + ((i * 37 + j * 11) % 160);
      out.push({
        id: '',
        at: d.from - shift,
        title: d.title,
        category: d.category,
        subcategory: d.subcategory,
        unis: [u.id],
        levels: d.levels ?? [],
        areas: d.areas ?? [],
        publish: inDays(d.from - shift),
        expires: inDays(Math.max(d.to, d.from - shift + 1)),
        body: d.body,
        files: d.files ?? [],
        art: d.art,
        email: j === 0,
        userTypes: ['RP'],
        roles: [],
        countries: d.countries ?? [],
        regions: [],
        author: AUTHORS[(i + j) % AUTHORS.length],
        draft: false,
        withdrawn: false,
        reached: sent + 60,
        sent: j === 0 ? sent : 0,
        opened: j === 0 ? Math.round(sent * 0.6) : 0,
      });
    });
  });
  // numbered oldest first, apart from the team's own
  return out
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...a }, n) => ({ ...a, id: `UN-${String(n + 1).padStart(3, '0')}` }));
}
