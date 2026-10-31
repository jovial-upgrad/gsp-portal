/**
 * Sample course data for Find courses. Real university names, made-up fees and dates, in the shape the brief
 * and the PM prototype use: intakes with deadlines and a status, English scores, offer time, the commission
 * rate GSP gets (the agency earns 70% of it), and the date each record was last checked.
 * Universities can be closed to students from some countries or states (territory rules).
 */

export const DESTINATIONS = ['Australia', 'UK', 'Canada', 'New Zealand', 'Ireland', 'USA'] as const;
export type Destination = (typeof DESTINATIONS)[number];

export const LEVELS = ['Foundation', 'Diploma', 'Bachelor’s degree', 'Postgraduate diploma', 'Master’s degree', 'PhD or research'] as const;
export type Level = (typeof LEVELS)[number];

export const AREAS = [
  'Business and management',
  'Computing and IT',
  'Data and analytics',
  'Engineering',
  'Health and nursing',
  'Accounting and finance',
  'Law',
  'Arts and design',
] as const;
export type Area = (typeof AREAS)[number];

import canberraLogo from '../assets/unis/canberra.png';
import canberraMark from '../assets/unis/canberra-mark.png';
import uniscLogo from '../assets/unis/unisc.svg';
import uniscMark from '../assets/unis/unisc-mark.svg';

export const CURRENCY: Record<Destination, string> = { Australia: 'AUD', UK: 'GBP', Canada: 'CAD', 'New Zealand': 'NZD', Ireland: 'EUR', USA: 'USD' };
export const FLAG: Record<Destination, string> = { Australia: '🇦🇺', UK: '🇬🇧', Canada: '🇨🇦', 'New Zealand': '🇳🇿', Ireland: '🇮🇪', USA: '🇺🇸' };
/**
 * Each destination's flag colours, for the course card's header: the first is the flag's main colour and carries
 * white text (Ireland's green is deepened for it), the second joins it in the header's wash.
 */
export const FLAG_COLOURS: Record<Destination, [string, string]> = {
  Australia: ['#00008B', '#E4002B'],
  UK: ['#012169', '#C8102E'],
  Canada: ['#D80621', '#D80621'],
  'New Zealand': ['#00247D', '#CC142B'],
  Ireland: ['#0B7A4B', '#FF883E'],
  USA: ['#0A3161', '#B31942'],
};

/**
 * A campus: where it is, what kind of place, and (Australia) whether it's in a regional area for visa purposes,
 * which usually lets graduates stay longer on a post-study work visa.
 */
export type Campus = { name: string; city: string; address?: string; setting?: 'City centre' | 'Suburban' | 'Regional town'; regional?: boolean };

export type University = {
  id: string;
  name: string;
  /** Old or other names people still search by. */
  aka?: string[];
  country: Destination;
  campuses: Campus[];
  /** Filled from PROFILES below. */
  website?: string;
  kind?: string;
  founded?: number;
  about?: string;
  /** The full logo, and its emblem for small spaces (like a favicon). */
  logo?: string;
  mark?: string;
  qs?: number;
  group?: string;
  /** GSP's IP team pushes these for students from some countries: they show first. */
  priorityFor?: string[];
  /** Students the university doesn't take through GSP: a whole country, or some of its states. */
  blocked?: { country: string; states?: string[] }[];
  rate: number;
  offerDays: number;
  checked: string;
  /** Colleges award diplomas and certificates, not degrees. */
  college?: boolean;
};

export const UNIVERSITIES: University[] = [
  { id: 'flinders', name: 'Flinders University', country: 'Australia', campuses: [{ name: 'Bedford Park', city: 'Adelaide' }], qs: 415, rate: 15, offerDays: 6, checked: '30 Sep', priorityFor: ['India'] },
  { id: 'adelaide', name: 'Adelaide University', aka: ['University of Adelaide', 'University of South Australia', 'UniSA'], country: 'Australia', campuses: [{ name: 'City East', city: 'Adelaide' }, { name: 'North Terrace', city: 'Adelaide' }], qs: 82, group: 'Group of Eight', rate: 12, offerDays: 12, checked: '21 Oct' },
  { id: 'deakin', name: 'Deakin University', country: 'Australia', campuses: [{ name: 'Burwood', city: 'Melbourne' }, { name: 'Waurn Ponds', city: 'Geelong' }], qs: 197, rate: 15, offerDays: 8, checked: '14 Oct' },
  { id: 'newcastle', name: 'University of Newcastle', country: 'Australia', campuses: [{ name: 'Callaghan', city: 'Newcastle' }, { name: 'Sydney', city: 'Sydney' }], qs: 179, rate: 15, offerDays: 9, checked: '30 Sep' },
  { id: 'uow', name: 'University of Wollongong', country: 'Australia', campuses: [{ name: 'Wollongong', city: 'Wollongong' }], qs: 162, rate: 15, offerDays: 7, checked: '7 Oct' },
  { id: 'cqu', name: 'CQUniversity', aka: ['Central Queensland University'], country: 'Australia', campuses: [{ name: 'Sydney', city: 'Sydney' }, { name: 'Melbourne', city: 'Melbourne' }, { name: 'Brisbane', city: 'Brisbane' }], rate: 18, offerDays: 4, checked: '21 Oct', blocked: [{ country: 'India', states: ['Punjab'] }] },
  { id: 'vu', name: 'Victoria University', country: 'Australia', campuses: [{ name: 'Footscray Park', city: 'Melbourne' }, { name: 'Sydney', city: 'Sydney' }], rate: 18, offerDays: 5, checked: '30 Sep', blocked: [{ country: 'India', states: ['Punjab', 'Haryana'] }] },
  { id: 'murdoch', name: 'Murdoch University', country: 'Australia', campuses: [{ name: 'Perth', city: 'Perth' }], qs: 591, rate: 16, offerDays: 7, checked: '14 Oct' },
  { id: 'rmit', name: 'RMIT University', country: 'Australia', campuses: [{ name: 'City', city: 'Melbourne' }], qs: 123, rate: 12, offerDays: 14, checked: '7 Oct' },
  { id: 'feduni', name: 'Federation University', aka: ['University of Ballarat'], country: 'Australia', campuses: [{ name: 'Berwick', city: 'Melbourne' }, { name: 'Mt Helen', city: 'Ballarat' }], rate: 20, offerDays: 4, checked: '21 Oct', blocked: [{ country: 'India', states: ['Punjab', 'Haryana', 'Gujarat'] }, { country: 'Nepal' }] },

  { id: 'abertay', name: 'Abertay University', country: 'UK', campuses: [{ name: 'Dundee', city: 'Dundee' }], rate: 15, offerDays: 5, checked: '30 Sep', priorityFor: ['India', 'Bangladesh'] },
  { id: 'coventry', name: 'Coventry University', country: 'UK', campuses: [{ name: 'Coventry', city: 'Coventry' }, { name: 'London', city: 'London' }], qs: 532, rate: 15, offerDays: 6, checked: '14 Oct' },
  { id: 'herts', name: 'University of Hertfordshire', country: 'UK', campuses: [{ name: 'Hatfield', city: 'Hatfield' }], rate: 15, offerDays: 7, checked: '7 Oct' },
  { id: 'northumbria', name: 'Northumbria University', country: 'UK', campuses: [{ name: 'Newcastle', city: 'Newcastle upon Tyne' }, { name: 'London', city: 'London' }], qs: 263, rate: 14, offerDays: 8, checked: '21 Oct' },
  { id: 'greenwich', name: 'University of Greenwich', country: 'UK', campuses: [{ name: 'Greenwich', city: 'London' }], rate: 16, offerDays: 5, checked: '30 Sep', blocked: [{ country: 'Bangladesh' }] },
  { id: 'ulster', name: 'Ulster University', country: 'UK', campuses: [{ name: 'Belfast', city: 'Belfast' }, { name: 'London', city: 'London' }, { name: 'Birmingham', city: 'Birmingham' }], rate: 16, offerDays: 6, checked: '14 Oct' },
  { id: 'leeds', name: 'University of Leeds', country: 'UK', campuses: [{ name: 'Leeds', city: 'Leeds' }], qs: 82, group: 'Russell Group', rate: 10, offerDays: 21, checked: '7 Oct' },
  { id: 'birmingham', name: 'University of Birmingham', country: 'UK', campuses: [{ name: 'Edgbaston', city: 'Birmingham' }], qs: 76, group: 'Russell Group', rate: 10, offerDays: 18, checked: '21 Oct' },

  { id: 'windsor', name: 'University of Windsor', country: 'Canada', campuses: [{ name: 'Windsor', city: 'Windsor, Ontario' }], rate: 15, offerDays: 14, checked: '30 Sep' },
  { id: 'algoma', name: 'Algoma University', country: 'Canada', campuses: [{ name: 'Brampton', city: 'Brampton, Ontario' }, { name: 'Sault Ste. Marie', city: 'Sault Ste. Marie, Ontario' }], rate: 18, offerDays: 10, checked: '14 Oct' },
  { id: 'fanshawe', name: 'Fanshawe College', country: 'Canada', campuses: [{ name: 'London', city: 'London, Ontario' }], rate: 15, offerDays: 9, checked: '7 Oct', college: true },
  { id: 'tru', name: 'Thompson Rivers University', country: 'Canada', campuses: [{ name: 'Kamloops', city: 'Kamloops, British Columbia' }], rate: 15, offerDays: 12, checked: '21 Oct' },

  { id: 'massey', name: 'Massey University', country: 'New Zealand', campuses: [{ name: 'Auckland', city: 'Auckland' }, { name: 'Manawatū', city: 'Palmerston North' }], qs: 230, rate: 15, offerDays: 8, checked: '30 Sep' },
  { id: 'waikato', name: 'University of Waikato', country: 'New Zealand', campuses: [{ name: 'Hamilton', city: 'Hamilton' }, { name: 'Tauranga', city: 'Tauranga' }], qs: 235, rate: 15, offerDays: 9, checked: '14 Oct' },
  { id: 'lincoln', name: 'Lincoln University', country: 'New Zealand', campuses: [{ name: 'Lincoln', city: 'Christchurch' }], qs: 362, rate: 15, offerDays: 10, checked: '7 Oct' },

  { id: 'griffith', name: 'Griffith College', country: 'Ireland', campuses: [{ name: 'Dublin', city: 'Dublin' }], rate: 15, offerDays: 6, checked: '21 Oct', college: true },
  { id: 'dbs', name: 'Dublin Business School', aka: ['DBS'], country: 'Ireland', campuses: [{ name: 'Dublin', city: 'Dublin' }], rate: 16, offerDays: 5, checked: '30 Sep', college: true },
  { id: 'ul', name: 'University of Limerick', country: 'Ireland', campuses: [{ name: 'Limerick', city: 'Limerick' }], qs: 421, rate: 12, offerDays: 14, checked: '14 Oct' },

  { id: 'pace', name: 'Pace University', country: 'USA', campuses: [{ name: 'New York City', city: 'New York' }], rate: 12, offerDays: 14, checked: '7 Oct' },
  { id: 'usf', name: 'University of South Florida', country: 'USA', campuses: [{ name: 'Tampa', city: 'Tampa, Florida' }], qs: 586, rate: 12, offerDays: 18, checked: '21 Oct' },

  // added with their logos; kept last so the courses generated before them stay the same
  { id: 'canberra', name: 'University of Canberra', aka: ['UC'], country: 'Australia', campuses: [{ name: 'Bruce', city: 'Canberra' }], rate: 15, offerDays: 6, checked: '21 Oct', priorityFor: ['India', 'Nepal'] },
  { id: 'unisc', name: 'University of the Sunshine Coast', aka: ['UniSC', 'USC'], country: 'Australia', campuses: [{ name: 'Sunshine Coast', city: 'Sippy Downs' }, { name: 'Moreton Bay', city: 'Petrie' }], rate: 16, offerDays: 5, checked: '14 Oct' },
];

/** Website, type, founding year, a line about the university, logo, and each campus's address and setting (sample data). */
const PROFILES: Record<string, { web: string; kind: string; founded: number; about: string; logo?: string; mark?: string; places: Record<string, [string, Campus['setting'], boolean?]> }> = {
  flinders: { web: 'flinders.edu.au', kind: 'Public university', founded: 1966, about: 'Known for health, nursing and medical research, with a large campus south of Adelaide.', places: { 'Bedford Park': ['Sturt Road, Bedford Park SA 5042', 'Suburban', true] } },
  adelaide: { web: 'adelaideuni.edu.au', kind: 'Public university', founded: 2026, about: 'Formed in 2026 from the University of Adelaide and the University of South Australia.', places: { 'City East': ['Frome Road, Adelaide SA 5000', 'City centre', true], 'North Terrace': ['North Terrace, Adelaide SA 5000', 'City centre', true] } },
  deakin: { web: 'deakin.edu.au', kind: 'Public university', founded: 1974, about: 'A large public university in Victoria, strong in business, IT and health.', places: { Burwood: ['221 Burwood Highway, Burwood VIC 3125', 'Suburban'], 'Waurn Ponds': ['75 Pigdons Road, Waurn Ponds VIC 3216', 'Regional town', true] } },
  newcastle: { web: 'newcastle.edu.au', kind: 'Public university', founded: 1965, about: 'Known for engineering and health, with a bushland campus and a Sydney city campus.', places: { Callaghan: ['University Drive, Callaghan NSW 2308', 'Suburban', true], Sydney: ['55 Elizabeth Street, Sydney NSW 2000', 'City centre'] } },
  uow: { web: 'uow.edu.au', kind: 'Public university', founded: 1975, about: 'A coastal university south of Sydney, strong in engineering, IT and business.', places: { Wollongong: ['Northfields Avenue, Wollongong NSW 2522', 'Suburban', true] } },
  cqu: { web: 'cqu.edu.au', kind: 'Public university', founded: 1967, about: 'Teaches international students mainly on city campuses in Sydney, Melbourne and Brisbane.', places: { Sydney: ['400 Kent Street, Sydney NSW 2000', 'City centre'], Melbourne: ['120 Spencer Street, Melbourne VIC 3000', 'City centre'], Brisbane: ['160 Ann Street, Brisbane QLD 4000', 'City centre'] } },
  vu: { web: 'vu.edu.au', kind: 'Public university', founded: 1916, about: 'Teaches in the block model: one subject at a time, four weeks each.', places: { 'Footscray Park': ['Ballarat Road, Footscray VIC 3011', 'Suburban'], Sydney: ['160 Sussex Street, Sydney NSW 2000', 'City centre'] } },
  murdoch: { web: 'murdoch.edu.au', kind: 'Public university', founded: 1973, about: 'A public university in Perth, known for veterinary science, IT and business.', places: { Perth: ['90 South Street, Murdoch WA 6150', 'Suburban', true] } },
  canberra: { web: 'canberra.edu.au', kind: 'Public university', founded: 1990, about: 'A public university in the national capital, strong in health, IT and teaching.', logo: canberraLogo, mark: canberraMark, places: { Bruce: ['11 Kirinari Street, Bruce ACT 2617', 'Suburban', true] } },
  unisc: { web: 'usc.edu.au', kind: 'Public university', founded: 1996, about: 'Celebrating 30 years in 2026, with campuses across the Sunshine Coast and north of Brisbane.', logo: uniscLogo, mark: uniscMark, places: { 'Sunshine Coast': ['90 Sippy Downs Drive, Sippy Downs QLD 4556', 'Regional town', true], 'Moreton Bay': ['1 Moreton Parade, Petrie QLD 4502', 'Suburban'] } },
  rmit: { web: 'rmit.edu.au', kind: 'Public university', founded: 1887, about: 'A large city university in Melbourne, known for design, engineering and technology.', places: { City: ['124 La Trobe Street, Melbourne VIC 3000', 'City centre'] } },
  feduni: { web: 'federation.edu.au', kind: 'Public university', founded: 2014, about: 'A regional university with roots in Ballarat going back to 1870.', places: { Berwick: ['100 Clyde Road, Berwick VIC 3806', 'Suburban'], 'Mt Helen': ['University Drive, Mount Helen VIC 3350', 'Regional town', true] } },
  abertay: { web: 'abertay.ac.uk', kind: 'Public university', founded: 1994, about: 'A compact city-centre university in Dundee, known for games and cyber security.', places: { Dundee: ['Bell Street, Dundee DD1 1HG', 'City centre'] } },
  coventry: { web: 'coventry.ac.uk', kind: 'Public university', founded: 1992, about: 'A large modern university with a city campus in Coventry and a campus in London.', places: { Coventry: ['Priory Street, Coventry CV1 5FB', 'City centre'], London: ['109 Middlesex Street, London E1 7JF', 'City centre'] } },
  herts: { web: 'herts.ac.uk', kind: 'Public university', founded: 1992, about: 'A university 25 minutes by train from London, known for business and engineering.', places: { Hatfield: ['College Lane, Hatfield AL10 9AB', 'Suburban'] } },
  northumbria: { web: 'northumbria.ac.uk', kind: 'Public university', founded: 1992, about: 'A city university in Newcastle with a London campus for postgraduate study.', places: { Newcastle: ['Sutherland Building, Newcastle upon Tyne NE1 8ST', 'City centre'], London: ['Middlesex Street, London E1 7HT', 'City centre'] } },
  greenwich: { web: 'gre.ac.uk', kind: 'Public university', founded: 1992, about: 'Based at the Old Royal Naval College, a World Heritage Site by the Thames.', places: { Greenwich: ['Old Royal Naval College, Park Row, London SE10 9LS', 'City centre'] } },
  ulster: { web: 'ulster.ac.uk', kind: 'Public university', founded: 1984, about: 'A university in Northern Ireland with branch campuses in London and Birmingham.', places: { Belfast: ['2–24 York Street, Belfast BT15 1AP', 'City centre'], London: ['', 'City centre'], Birmingham: ['', 'City centre'] } },
  leeds: { web: 'leeds.ac.uk', kind: 'Public university', founded: 1904, about: 'A research university in the Russell Group, with a large campus near Leeds city centre.', places: { Leeds: ['Woodhouse Lane, Leeds LS2 9JT', 'City centre'] } },
  birmingham: { web: 'birmingham.ac.uk', kind: 'Public university', founded: 1900, about: 'A research university in the Russell Group, with a parkland campus in Edgbaston.', places: { Edgbaston: ['Edgbaston, Birmingham B15 2TT', 'Suburban'] } },
  windsor: { web: 'uwindsor.ca', kind: 'Public university', founded: 1963, about: 'A university on the US border, across the river from Detroit.', places: { Windsor: ['401 Sunset Avenue, Windsor, Ontario N9B 3P4', 'Suburban'] } },
  algoma: { web: 'algomau.ca', kind: 'Public university', founded: 2008, about: 'A small public university with a growing campus in Brampton, near Toronto.', places: { Brampton: ['24 Queen Street East, Brampton, Ontario', 'City centre'], 'Sault Ste. Marie': ['1520 Queen Street East, Sault Ste. Marie, Ontario', 'Regional town'] } },
  fanshawe: { web: 'fanshawec.ca', kind: 'Public college', founded: 1967, about: 'One of Ontario’s largest colleges, teaching diplomas and graduate certificates.', places: { London: ['1001 Fanshawe College Boulevard, London, Ontario N5Y 5R6', 'Suburban'] } },
  tru: { web: 'tru.ca', kind: 'Public university', founded: 2005, about: 'A university in the British Columbia interior, with many postgraduate diplomas.', places: { Kamloops: ['805 TRU Way, Kamloops, British Columbia V2C 0C8', 'Regional town'] } },
  massey: { web: 'massey.ac.nz', kind: 'Public university', founded: 1927, about: 'Known for distance learning, with campuses in Auckland, Manawatū and Wellington.', places: { Auckland: ['Dairy Flat Highway, Albany, Auckland 0632', 'Suburban'], 'Manawatū': ['Tennent Drive, Palmerston North 4410', 'Regional town'] } },
  waikato: { web: 'waikato.ac.nz', kind: 'Public university', founded: 1964, about: 'A university in the central North Island, with campuses in Hamilton and Tauranga.', places: { Hamilton: ['Gate 1, Knighton Road, Hamilton 3240', 'Suburban'], Tauranga: ['101 Durham Street, Tauranga 3110', 'City centre'] } },
  lincoln: { web: 'lincoln.ac.nz', kind: 'Public university', founded: 1878, about: 'A small specialist university near Christchurch, known for agriculture and land use.', places: { Lincoln: ['Ellesmere Junction Road, Lincoln 7647', 'Regional town'] } },
  griffith: { web: 'griffith.ie', kind: 'Private college', founded: 1974, about: 'Ireland’s largest private college, with degrees awarded by Quality and Qualifications Ireland.', places: { Dublin: ['South Circular Road, Dublin 8', 'City centre'] } },
  dbs: { web: 'dbs.ie', kind: 'Private college', founded: 1975, about: 'A private business school in Dublin city centre.', places: { Dublin: ['13–14 Aungier Street, Dublin 2', 'City centre'] } },
  ul: { web: 'ul.ie', kind: 'Public university', founded: 1972, about: 'A public university on a riverside campus outside Limerick, known for co-op placements.', places: { Limerick: ['Castletroy, Limerick V94 T9PX', 'Suburban'] } },
  pace: { web: 'pace.edu', kind: 'Private university', founded: 1906, about: 'A private university in Lower Manhattan, near the financial district.', places: { 'New York City': ['1 Pace Plaza, New York, NY 10038', 'City centre'] } },
  usf: { web: 'usf.edu', kind: 'Public university', founded: 1956, about: 'A large public research university in Tampa, Florida.', places: { Tampa: ['4202 East Fowler Avenue, Tampa, FL 33620', 'Suburban'] } },
};
/** Each university's emblem for small spaces, from its own website (or Wikipedia), as a 96 px square: `{id}-mark.webp`. */
const MARKS = import.meta.glob('../assets/unis/*-mark.webp', { eager: true, import: 'default' }) as Record<string, string>;

for (const u of UNIVERSITIES) {
  const p = PROFILES[u.id];
  if (!p) continue;
  Object.assign(u, { website: p.web, kind: p.kind, founded: p.founded, about: p.about, logo: p.logo, mark: p.mark ?? MARKS[`../assets/unis/${u.id}-mark.webp`] });
  u.campuses = u.campuses.map((c) => {
    const [address, setting, regional] = p.places[c.name] ?? [];
    return { ...c, address: address || undefined, setting, regional: u.country === 'Australia' ? !!regional : undefined };
  });
}

export type IntakeStatus = 'open' | 'likely' | 'closed';
export type Intake = { month: string; deadline: string; status: IntakeStatus };

export type Course = {
  id: string;
  name: string;
  uni: University;
  campus: Campus;
  level: Level;
  area: Area;
  months: number;
  /** Per year, in the destination's currency. */
  tuition: number;
  currency: string;
  appFee: number;
  deposit: number;
  /** Up to this much off the first year; 0 if none is listed. */
  scholarship: number;
  /** Visa figure for a year's living costs. */
  living: number;
  /** [overall, no band below] */
  ielts: [number, number];
  pte: [number, number];
  toefl: [number, number];
  /** The minimum percentage asked of students from the main markets. */
  academic: number;
  /** The English test can wait (conditional offer) or be waived with Grade 12 English. */
  englishFlex: boolean;
  psw: boolean;
  intakes: Intake[];
  offerDays: number;
  rate: number;
  checked: string;
  /** How it's taught: Full time, Part time, Blended (on campus and online) or Online. */
  mode: StudyMode;
  /** Australia registers every course for international students under a CRICOS code. */
  cricos?: string;
  placement: boolean;
  /** A pathway (foundation, diploma or English) if the student doesn't meet entry yet. */
  pathway: boolean;
  recognition?: string;
  careers: string[];
  scholarshipName?: string;
  /** The scholarship comes with the offer, or needs its own application. */
  scholarshipAuto?: boolean;
  /** What the application needs: document, needed or optional, and when. */
  docs: [string, 'Required' | 'Optional' | 'Can come later', string][];
  /** Costs on top of tuition, approximate. */
  otherFees: [string, number][];
  /** Postgraduate courses: the most backlogs (subjects failed and cleared later) accepted in the student's degree. */
  backlogs?: number;
};

/* ---------- generated, the same every time ---------- */

const SUBJECTS: Record<Area, string[]> = {
  'Business and management': ['Business Administration', 'Business Administration', 'International Business', 'Marketing', 'Project Management', 'Supply Chain Management', 'Human Resource Management'],
  'Computing and IT': ['Information Technology', 'Computer Science', 'Cyber Security', 'Software Engineering', 'Artificial Intelligence'],
  'Data and analytics': ['Data Science', 'Business Analytics', 'Applied Statistics', 'Data Analytics'],
  Engineering: ['Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Engineering Management'],
  'Health and nursing': ['Nursing', 'Public Health', 'Health Administration', 'Physiotherapy'],
  'Accounting and finance': ['Professional Accounting', 'Finance', 'Banking and Finance', 'Financial Technology'],
  Law: ['Law', 'International Law', 'Commercial Law'],
  'Arts and design': ['Graphic Design', 'Media and Communication', 'Architecture', 'Animation'],
};

const TUITION: Record<Destination, Record<Level, number>> = {
  Australia: { Foundation: 26000, Diploma: 24000, 'Bachelor’s degree': 34000, 'Postgraduate diploma': 33000, 'Master’s degree': 38500, 'PhD or research': 36000 },
  UK: { Foundation: 13500, Diploma: 12500, 'Bachelor’s degree': 16800, 'Postgraduate diploma': 15500, 'Master’s degree': 19500, 'PhD or research': 21000 },
  Canada: { Foundation: 18000, Diploma: 17500, 'Bachelor’s degree': 29000, 'Postgraduate diploma': 18500, 'Master’s degree': 26000, 'PhD or research': 24000 },
  'New Zealand': { Foundation: 24000, Diploma: 23000, 'Bachelor’s degree': 33000, 'Postgraduate diploma': 34000, 'Master’s degree': 39000, 'PhD or research': 37000 },
  Ireland: { Foundation: 12000, Diploma: 11500, 'Bachelor’s degree': 15500, 'Postgraduate diploma': 13500, 'Master’s degree': 17500, 'PhD or research': 18000 },
  USA: { Foundation: 22000, Diploma: 21000, 'Bachelor’s degree': 32000, 'Postgraduate diploma': 28000, 'Master’s degree': 34000, 'PhD or research': 33000 },
};

const LIVING: Record<Destination, number> = { Australia: 29710, UK: 12006, Canada: 20635, 'New Zealand': 20000, Ireland: 12000, USA: 18000 };

const MONTHS: Record<Destination, [string, string][]> = {
  Australia: [['Feb 2027', '2026-12-15'], ['Jul 2027', '2027-05-15'], ['Nov 2027', '2027-09-15']],
  UK: [['Jan 2027', '2026-11-30'], ['May 2027', '2027-03-31'], ['Sep 2027', '2027-07-31']],
  Canada: [['Jan 2027', '2026-11-15'], ['May 2027', '2027-03-01'], ['Sep 2027', '2027-06-30']],
  'New Zealand': [['Mar 2027', '2027-01-20'], ['Jul 2027', '2027-05-15']],
  Ireland: [['Jan 2027', '2026-12-01'], ['Sep 2027', '2027-07-15']],
  USA: [['Jan 2027', '2026-11-20'], ['Aug 2027', '2027-06-01']],
};

function nameFor(level: Level, subject: string, u: University) {
  const uk = u.country === 'UK' || u.country === 'Ireland';
  const us = u.country === 'USA';
  if (u.college)
    return level === 'Postgraduate diploma' ? `Postgraduate Diploma in ${subject}` : level === 'Master’s degree' ? `MSc in ${subject}` : level === 'Bachelor’s degree' ? `BA (Hons) in ${subject}` : `Diploma in ${subject}`;
  switch (level) {
    case 'Foundation':
      return `Foundation Year: ${subject}`;
    case 'Diploma':
      return uk ? `Higher National Diploma in ${subject}` : `Diploma of ${subject}`;
    case 'Bachelor’s degree':
      return uk ? `BSc (Hons) ${subject}` : us ? `BS in ${subject}` : `Bachelor of ${subject}`;
    case 'Postgraduate diploma':
      return uk ? `PgDip ${subject}` : `Graduate Diploma in ${subject}`;
    case 'Master’s degree':
      if (subject === 'Business Administration') return 'Master of Business Administration (MBA)';
      return uk ? `MSc ${subject}` : us ? `MS in ${subject}` : `Master of ${subject}`;
    default:
      return uk ? `PhD ${subject}` : `Master of Research (${subject})`;
  }
}

function build(): Course[] {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const out: Course[] = [];
  const seen = new Set<string>();
  // most agency business is master's and bachelor's degrees
  const levels: Level[] = ['Master’s degree', 'Master’s degree', 'Master’s degree', 'Master’s degree', 'Master’s degree', 'Bachelor’s degree', 'Bachelor’s degree', 'Bachelor’s degree', 'Postgraduate diploma', 'Postgraduate diploma', 'Diploma', 'Foundation', 'PhD or research'];
  for (const u of UNIVERSITIES) {
    const count = u.college ? 24 : 72;
    let made = 0;
    let guard = 0;
    while (made < count && guard++ < 600) {
      const area = AREAS[(made + guard) % AREAS.length];
      let level = pick(levels);
      if (u.college && (level === 'PhD or research' || level === 'Foundation')) level = 'Postgraduate diploma';
      const subject = pick(SUBJECTS[area]);
      const name = nameFor(level, subject, u);
      const campus = pick(u.campuses);
      const key = `${u.id}|${name}|${campus.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      made++;
      const tuition = Math.round((TUITION[u.country][level] * (0.86 + rnd() * 0.36)) / 50) * 50;
      const ieltsBase = level === 'Foundation' || level === 'Diploma' ? 5.5 : /Nursing|Physiotherapy|Law/.test(subject) ? 7 : level === 'Bachelor’s degree' ? 6 : 6.5;
      const ielts: [number, number] = [ieltsBase, ieltsBase - 0.5];
      const months = MONTHS[u.country];
      const intakes = months.slice(0, 1 + Math.floor(rnd() * months.length)).map(([month, deadline], i) => ({ month, deadline, status: (i === 0 ? 'open' : 'likely') as IntakeStatus }));
      const schol = rnd() < 0.45 ? pick([10, 15, 20, 25, 30]) : 0;
      const base: Omit<Course, keyof Extras> = {
        id: `${u.id}-${made}`,
        name,
        uni: u,
        campus,
        level,
        area,
        months: level === 'Foundation' || level === 'Diploma' || level === 'Postgraduate diploma' ? 12 : level === 'Bachelor’s degree' ? (u.country === 'UK' ? 36 : u.country === 'USA' || u.country === 'Canada' ? 48 : 36) : level === 'Master’s degree' ? (u.country === 'UK' || u.country === 'Ireland' ? 12 : u.country === 'USA' ? 24 : pick([18, 24])) : 36,
        tuition,
        currency: CURRENCY[u.country],
        appFee: u.country === 'UK' || u.country === 'Ireland' || rnd() < 0.4 ? 0 : u.country === 'USA' ? 85 : u.country === 'Canada' ? 120 : 150,
        deposit: u.country === 'UK' ? pick([3000, 4000, 5000]) : Math.round((tuition * 0.25) / 500) * 500,
        scholarship: Math.round((tuition * schol) / 100 / 50) * 50,
        living: LIVING[u.country],
        ielts,
        pte: [ieltsBase >= 7 ? 65 : ieltsBase >= 6.5 ? 58 : ieltsBase >= 6 ? 50 : 42, ieltsBase >= 6.5 ? 50 : 36],
        toefl: [ieltsBase >= 7 ? 94 : ieltsBase >= 6.5 ? 79 : ieltsBase >= 6 ? 60 : 46, ieltsBase >= 6.5 ? 18 : 12],
        academic: level === 'PhD or research' ? 65 : level === 'Master’s degree' ? Math.round(55 + rnd() * 15) : level === 'Bachelor’s degree' ? Math.round(55 + rnd() * 15) : 50,
        englishFlex: rnd() < 0.3,
        psw: u.country !== 'USA' ? rnd() < 0.85 : false,
        intakes,
        offerDays: Math.max(2, u.offerDays + Math.round(rnd() * 4 - 2)),
        rate: u.rate,
        checked: u.checked,
      };
      out.push({ ...base, ...extrasFor(base) });
    }
  }
  return out;
}

/* ---------- the detail a course page needs (its own random stream, so adding it changed no other data) ---------- */

export type StudyMode = 'Full time' | 'Part time' | 'Blended' | 'Online';
/** Most courses for international students are full time; a few are blended, part time or online. From the course's id, so no other data moves. */
function modeOf(id: string): StudyMode {
  let h = 0;
  for (const ch of `${id}:mode`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = h % 100;
  return n < 72 ? 'Full time' : n < 84 ? 'Blended' : n < 94 ? 'Part time' : 'Online';
}

type Extras = Pick<Course, 'mode' | 'cricos' | 'placement' | 'pathway' | 'recognition' | 'careers' | 'scholarshipName' | 'scholarshipAuto' | 'docs' | 'otherFees' | 'backlogs'>;

/** How many backlogs universities in each destination usually accept from Indian students on postgraduate courses. */
const BACKLOGS: Record<Destination, number[]> = { UK: [10, 12, 15], Australia: [5, 8, 10], Canada: [5, 6, 8], 'New Zealand': [5, 8], Ireland: [8, 10, 12], USA: [5, 8, 10] };

const CAREERS: Record<Area, string[]> = {
  'Business and management': ['Business analyst', 'Operations manager', 'Marketing manager', 'Management consultant', 'Product manager'],
  'Computing and IT': ['Software developer', 'Cyber security analyst', 'Cloud engineer', 'IT project manager', 'Systems analyst'],
  'Data and analytics': ['Data analyst', 'Data scientist', 'Business intelligence analyst', 'Machine learning engineer'],
  Engineering: ['Site engineer', 'Design engineer', 'Project engineer', 'Engineering manager'],
  'Health and nursing': ['Registered nurse', 'Health services manager', 'Public health officer', 'Clinical coordinator'],
  'Accounting and finance': ['Accountant', 'Financial analyst', 'Auditor', 'Tax consultant'],
  Law: ['Legal adviser', 'Compliance officer', 'Policy adviser', 'Contracts manager'],
  'Arts and design': ['Graphic designer', 'UX designer', 'Content producer', 'Art director'],
};

/** Professional bodies that accredit courses, by area and country. */
const BODIES: Partial<Record<Area, Partial<Record<Destination, string>>>> = {
  'Accounting and finance': { Australia: 'CPA Australia and CA ANZ', UK: 'ACCA and CIMA (exemptions)', Canada: 'CPA Canada', 'New Zealand': 'CA ANZ', Ireland: 'ACCA (exemptions)' },
  Engineering: { Australia: 'Engineers Australia', UK: 'Engineering Council (IET or IMechE)', Canada: 'Engineers Canada', 'New Zealand': 'Engineering New Zealand', Ireland: 'Engineers Ireland', USA: 'ABET' },
  'Computing and IT': { Australia: 'Australian Computer Society (ACS)', UK: 'BCS, The Chartered Institute for IT', 'New Zealand': 'IT Professionals NZ', Canada: 'CIPS', USA: 'ABET' },
};
const NURSING: Partial<Record<Destination, string>> = { Australia: 'ANMAC: graduates can register with AHPRA', UK: 'Nursing and Midwifery Council (NMC)', 'New Zealand': 'Nursing Council of New Zealand', Ireland: 'NMBI' };

const SCHOLARSHIPS = ['International Merit Scholarship', 'Global Excellence Scholarship', 'Vice-Chancellor’s International Scholarship', 'South Asia Achievers Scholarship'];

/** Costs on top of tuition, by country (approximate, for a single student). */
const OTHER_FEES: Record<Destination, [string, number][]> = {
  Australia: [['Overseas Student Health Cover, a year', 700], ['Student visa, once', 2000]],
  UK: [['Immigration Health Surcharge, a year', 776], ['Student visa, once', 524]],
  Canada: [['Health insurance, a year', 900], ['Study permit and biometrics, once', 235]],
  'New Zealand': [['Health and travel insurance, a year', 700], ['Student visa, once', 850]],
  Ireland: [['Health insurance, a year', 500], ['Immigration registration, a year', 300]],
  USA: [['Health insurance, a year', 2500], ['SEVIS and visa fees, once', 535]],
};

function extrasFor(c: Omit<Course, keyof Extras>): Extras {
  let x = [...c.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0 || 1;
  const rnd = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
  const pg = c.level === 'Master’s degree' || c.level === 'Postgraduate diploma' || c.level === 'PhD or research';
  const degree = c.level === 'Bachelor’s degree' || c.level === 'Master’s degree';
  const dest = c.uni.country;
  const nursing = /Nursing/.test(c.name);
  const body = nursing ? NURSING[dest] : BODIES[c.area]?.[dest];
  const careers = [...CAREERS[c.area]].sort(() => rnd() - 0.5).slice(0, 3);
  const docs: Extras['docs'] = [
    ['Passport', 'Required', 'With the application'],
    [pg ? 'Bachelor’s transcripts and degree certificate' : c.level === 'Foundation' ? 'Class 10 and 11 mark sheets' : 'Class 10 and 12 mark sheets', 'Required', 'With the application'],
    ['English test score', c.englishFlex ? 'Can come later' : 'Required', c.englishFlex ? 'GSP asks for it before the offer is final' : 'With the application'],
    ['Statement of purpose', pg ? 'Required' : 'Optional', 'With the application'],
    ['CV', pg ? 'Required' : 'Optional', 'With the application'],
  ];
  if (/MBA/.test(c.name)) docs.push(['Work experience letters, 2 years or more', 'Required', 'With the application']);
  if (c.area === 'Arts and design') docs.push(['Portfolio', 'Required', 'With the application']);
  if (c.level === 'PhD or research') docs.push(['Research proposal', 'Required', 'With the application']);
  if (pg) docs.push(['Two references', 'Optional', 'GSP asks for them if the university wants them']);
  docs.push(['Gap explanation document', 'Optional', 'GSP asks for it if there’s a gap in study']);
  docs.push(['Financial documents', 'Required', dest === 'UK' ? 'GSP asks for them after the offer, before the CAS' : 'GSP asks for them after the offer, for the visa']);
  return {
    mode: modeOf(c.id),
    cricos: dest === 'Australia' ? `0${String(10000 + Math.floor(rnd() * 89999))}${'ABCDEFGHJKM'[Math.floor(rnd() * 11)]}` : undefined,
    placement: nursing || /Physiotherapy/.test(c.name) || (c.level !== 'Foundation' && rnd() < 0.35),
    pathway: degree && rnd() < 0.55,
    recognition: body && degree && (nursing || rnd() < 0.75) ? body : undefined,
    careers,
    scholarshipName: c.scholarship ? SCHOLARSHIPS[Math.floor(rnd() * SCHOLARSHIPS.length)] : undefined,
    scholarshipAuto: c.scholarship ? rnd() < 0.6 : undefined,
    docs,
    otherFees: OTHER_FEES[dest],
    // drawn last, so the values above stay as they were
    backlogs: pg ? (c.level === 'PhD or research' ? 3 : BACKLOGS[dest][Math.floor(rnd() * BACKLOGS[dest].length)]) : undefined,
  };
}

export const COURSES: Course[] = build();

/** What the agency earns: 70% of GSP's commission on first-year tuition after any scholarship. */
export const earnOf = (c: Course) => Math.round(((c.tuition - c.scholarship) * c.rate * 0.7) / 100 / 10) * 10;

export const money = (n: number, cur: string) => `${cur} ${n.toLocaleString('en-GB')}`;

/** Days from today to a date (negative once it's passed). */
export const daysTo = (iso: string) => Math.ceil((new Date(iso + 'T23:59:59').getTime() - Date.now()) / 86_400_000);

/** An intake is open until its deadline passes. */
export const intakeState = (i: Intake): IntakeStatus => (daysTo(i.deadline) < 0 ? 'closed' : i.status);

/** Does the university take students from this country and state through GSP? */
export function blockedFor(u: University, country: string, state: string) {
  return (u.blocked ?? []).some((b) => b.country === country && (!b.states || b.states.includes(state)));
}

/* ---------- scholarships: the course's own, then what the university offers every international student ---------- */

/** A scholarship as the course page lists it: how much, who it's for, and whether it comes with the offer or needs its own application. */
export type Scholarship = { name: string; amount: string; per: string; who: string; auto: boolean; from: 'course' | 'university' };

/** The university's own awards, from its id, so no other data moves (sample data until GSP's scholarship feed is in). */
export function scholarshipsOf(c: Course): Scholarship[] {
  let h = 0;
  for (const ch of `${c.uni.id}:schol`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const round = (v: number) => Math.max(500, Math.round(v / 500) * 500);
  const list: Scholarship[] = [];
  if (c.scholarship)
    list.push({
      name: c.scholarshipName ?? 'Course scholarship',
      amount: `Up to ${money(c.scholarship, c.currency)}`,
      per: 'off the first year',
      who: 'Students who meet entry for this course',
      auto: !!c.scholarshipAuto,
      from: 'course',
    });
  const uni: Scholarship[] = [
    { name: 'Early acceptance bursary', amount: money(round(c.tuition * 0.06), c.currency), per: 'off the first year', who: 'Pay the deposit within 30 days of the offer', auto: true, from: 'university' },
    { name: 'High achiever award', amount: `Up to ${money(round(c.tuition * 0.25), c.currency)}`, per: 'off the first year', who: `${Math.min(c.academic + 15, 90)}% or more in the last qualification`, auto: false, from: 'university' },
    { name: 'Family discount', amount: '10% off tuition', per: 'every year of the course', who: 'A brother, sister, parent or partner studied here', auto: false, from: 'university' },
  ];
  // one or two of them, the same for every course at the university
  const n = 1 + (h % 2);
  for (let i = 0; i < n; i++) list.push(uni[(h + i) % uni.length]);
  return list;
}
