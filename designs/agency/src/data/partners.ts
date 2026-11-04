import { adminCfg } from '../admin/data/store';
import { rpDocsOf, rpRuleFor } from '../admin/data/config';
import geoJson from './geo.json';

/** A country, its states, and (in GSP's main markets) the cities of its states most students and agencies are in. */
export type Country = { name: string; iso: string; dial: string; states: string[]; cities?: Record<string, string[]> };
export const COUNTRIES = geoJson as Country[];
/** A state's cities (HC14: one list, in geo.json); none where the city is typed. */
export const citiesOf = (country: string, state: string) => countryByName(country)?.cities?.[state] ?? [];
/** Every state's cities, by state, across the countries that have them (Bdm's place list reads this). */
export const CITIES: Record<string, string[]> = Object.assign({}, ...[...COUNTRIES].reverse().map((c) => c.cities ?? {}));

/** Markets GSP recruits from most, shown first in the country picker (PM prototype `TOP`). */
export const TOP_MARKETS = ['India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Vietnam', 'Philippines', 'Nigeria'];

export const countryByName = (name: string) => COUNTRIES.find((c) => c.name === name);

export const CITY_EXAMPLE: Record<string, string> = {
  India: 'Bengaluru',
  Bangladesh: 'Dhaka',
  Nepal: 'Kathmandu',
  'Sri Lanka': 'Colombo',
  Vietnam: 'Ho Chi Minh City',
  Philippines: 'Manila',
  Nigeria: 'Lagos',
  Pakistan: 'Lahore',
  Indonesia: 'Jakarta',
};

/** Sign-up options for "How did you find us?" (PM prototype). */
export const FOUND_US = [
  'GSP team member',
  'Another agency',
  'A university',
  'Event or fair',
  'Google search',
  'Social media',
  'Other',
];

/**
 * Business documents asked for after sign-up (Jovial, 31 Oct): GSP · Admin › Document configuration's recruitment
 * partner rules, by the agency's country (India's own list; another for everyone else). A document whose name says
 * "if …" is optional.
 */
export type DocNeed = { name: string; hint: string; optional?: boolean };
const HINT: [RegExp, string][] = [
  [/registration/i, 'Shows your registered business name'],
  [/PAN/, 'Business PAN, not a personal one'],
  [/GST/, 'Only if you are GST registered'],
  [/profile/i, 'A short PDF about your agency'],
  [/ID/, 'Passport or national ID'],
  [/reference/i, 'Someone who knows your work: their name, email and phone'],
];
export function businessDocsFor(country: string): DocNeed[] {
  // slice 1 PRD: the first rule that names the country, else the All countries rule; each document Mandatory or Optional
  const rule = rpRuleFor(adminCfg().rpDocs, country);
  return (rule ? rpDocsOf(rule) : []).map((d) => ({
    name: d.name,
    hint: HINT.find(([re]) => re.test(d.name))?.[1] ?? '',
    optional: d.setting === 'Optional' || undefined,
  }));
}

import { STAFF, fullName, label, type Staff } from './staff';

export type Contact = { name: string; role: string; phone: string; email: string; initials: string };

/**
 * Who looks after a new agency (Jovial, 31 Oct): GSP · Admin › Recruitment assignment, which starts from the staff list's
 * areas. Most specific match first: the agency's city, then its state, then the rest of its country, then all other
 * countries. A referral code (the first three letters of a Recruitment person's first name, like ADI-204) wins.
 * The staff list has no phone numbers.
 */
const SAME_CITY: Record<string, string> = { calicut: 'kozhikode', trichy: 'tiruchirappalli', vijaywada: 'vijayawada', 'new delhi': 'delhi', 'ho chi minh': 'ho chi minh city', gurugram: 'gurgaon' };
const norm = (x: string) => { const v = x.trim().toLowerCase(); return SAME_CITY[v] ?? v; };
const stateOf = (city: string) => Object.keys(CITIES).find((st) => CITIES[st].some((c) => norm(c) === norm(city)));
const contactOf = (s: Staff, role: string): Contact => ({ name: label(s), initials: initialsOf(fullName(s)), role, phone: s.phone ? `${s.dial} ${s.phone}` : '', email: s.email });
const byLabel = (n: string) => STAFF.find((x) => label(x) === n);
/** A GSP person on the staff list, by the name a record keeps (an RP's Recruitment contact), as a contact; null when not on the list. */
export const staffContact = (name: string | undefined, role: string): Contact | null => {
  const who = name ? byLabel(name) : undefined;
  return who ? contactOf(who, role) : null;
};

const initialsOf = (n: string) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');

/** The GSP partner manager (BDM) a new sign-up is given. A referral code wins over the assignment table. */
export function partnerManagerFor(country: string, city: string, referral: string, state = ''): Contact | null {
  const code = referral.trim().toUpperCase();
  const pre = code.slice(0, 3);
  const byRef = pre.length === 3 ? STAFF.filter((s) => s.role === 'Recruitment' && s.first.toUpperCase().startsWith(pre)) : [];
  if (byRef.length === 1) return contactOf(byRef[0], `Recruitment · from referral code ${code}`);
  const rows = adminCfg().bdm;
  const st = state.trim() || (city.trim() ? stateOf(city) : undefined);
  const areas = (area: string) => area.split(',').map(norm);
  const mine = rows.filter((r) => r.country === country);
  const cityRow = city.trim() && mine.find((r) => areas(r.area).includes(norm(city)));
  const stateRow = st && mine.find((r) => areas(r.area).includes(norm(st)));
  const restRow = mine.find((r) => r.area.startsWith('Rest of') || r.area === 'All' || r.area === 'All countries');
  // Jovial, 2 Nov: a specific city wins over All / Rest of the country; with no row for the place, the sales
  // region's default recruitment contact (Admin › Sales regions); then All other countries
  const cfg = adminCfg();
  const regionName = cfg.regions.find((g) => g.countries.includes(country))?.name;
  const regionDefault = regionName ? cfg.regionBdm[regionName] : undefined;
  const hit = cityRow || stateRow || restRow;
  const name = hit?.bdm ?? regionDefault ?? rows.find((r) => r.fallback)?.bdm;
  const who = name && byLabel(name);
  if (!who) return null;
  const where = cityRow ? `${city.trim()}, ${country}` : stateRow ? `${st}, ${country}` : restRow ? country : regionDefault ? `${regionName}, by default` : 'all other countries';
  return contactOf(who, `Recruitment · ${where}`);
}

/* Emails that already have a GSP account: screens/signup/model.ts emailInUse, from the sign-in accounts and the RP teams (HC35). */
