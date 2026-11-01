import { adminCfg } from '../admin/data/store';
import geoJson from './geo.json';

export type Country = { name: string; iso: string; dial: string; states: string[] };
export const COUNTRIES = geoJson as Country[];

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
  const rule = adminCfg().rpDocs.find((r) =>
    r.applies === 'All countries' ? true : r.applies === 'Only these countries' ? r.countries.includes(country) : !r.countries.includes(country),
  );
  return (rule?.docs ?? []).map((d) => ({
    name: d.replace(/\s*\(if [^)]*\)/i, ''),
    hint: HINT.find(([re]) => re.test(d))?.[1] ?? '',
    optional: /\(if /i.test(d) || undefined,
  }));
}

import { STAFF, fullName, label, type Staff } from './staff';
import { CITIES } from './students';

export type Contact = { name: string; role: string; phone: string; email: string; initials: string };

/**
 * Who looks after a new agency (Jovial, 31 Oct): GSP · Admin › BDM assignment, which starts from the staff list's
 * areas. Most specific match first: the agency's city, then its state, then the rest of its country, then all other
 * countries. A referral code (the first three letters of a Recruitment person's first name, like ADI-204) wins.
 * The staff list has no phone numbers.
 */
const SAME_CITY: Record<string, string> = { calicut: 'kozhikode', trichy: 'tiruchirappalli', vijaywada: 'vijayawada', 'new delhi': 'delhi', 'ho chi minh': 'ho chi minh city', gurugram: 'gurgaon' };
const norm = (x: string) => { const v = x.trim().toLowerCase(); return SAME_CITY[v] ?? v; };
const stateOf = (city: string) => Object.keys(CITIES).find((st) => CITIES[st].some((c) => norm(c) === norm(city)));
const contactOf = (s: Staff, role: string): Contact => ({ name: label(s), initials: initialsOf(fullName(s)), role, phone: s.phone ? `${s.dial} ${s.phone}` : '', email: s.email });
const byLabel = (n: string) => STAFF.find((x) => label(x) === n);

const initialsOf = (n: string) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');

/** The GSP partner manager (BDM) a new sign-up is given. A referral code wins over the assignment table. */
export function partnerManagerFor(country: string, city: string, referral: string, state = ''): Contact | null {
  const code = referral.trim().toUpperCase();
  const pre = code.slice(0, 3);
  const byRef = pre.length === 3 ? STAFF.filter((s) => s.role === 'Recruitment' && s.first.toUpperCase().startsWith(pre)) : [];
  if (byRef.length === 1) return contactOf(byRef[0], `Partner manager · from referral code ${code}`);
  const rows = adminCfg().bdm;
  const st = state.trim() || (city.trim() ? stateOf(city) : undefined);
  const areas = (area: string) => area.split(',').map(norm);
  const mine = rows.filter((r) => r.country === country);
  const cityRow = city.trim() && mine.find((r) => areas(r.area).includes(norm(city)));
  const stateRow = st && mine.find((r) => areas(r.area).includes(norm(st)));
  const restRow = mine.find((r) => r.area.startsWith('Rest of') || r.area === 'All' || r.area === 'All countries');
  const hit = cityRow || stateRow || restRow || rows.find((r) => r.fallback);
  const who = hit && byLabel(hit.bdm);
  if (!who) return null;
  const where = cityRow ? `${city.trim()}, ${country}` : stateRow ? `${st}, ${country}` : restRow ? country : 'all other countries';
  return contactOf(who, `Partner manager · ${where}`);
}

/** Emails that already have a GSP account (sample data from the PM prototype). */
export const EXISTING_EMAILS = ['ananya@horizonoverseas.in', 'lan@saigonbridge.vn', 'rahul@horizonoverseas.in'];

export const emailInUse = (email: string) => EXISTING_EMAILS.includes(email.trim().toLowerCase());
