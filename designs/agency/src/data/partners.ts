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

/** Business documents asked for after sign-up (PM prototype `SU_DOCS` / `DOCRULES`). */
export type DocNeed = { name: string; hint: string; optional?: boolean };
export function businessDocsFor(country: string): DocNeed[] {
  if (country === 'India')
    return [
      { name: 'Business registration certificate', hint: 'Shows your registered business name' },
      { name: 'PAN card', hint: 'Business PAN, not a personal one' },
      { name: 'GST certificate', hint: 'Only if you are GST registered', optional: true },
    ];
  return [
    { name: 'Business registration certificate', hint: 'Shows your registered business name' },
    { name: 'Company profile', hint: 'A short PDF about your agency' },
    { name: 'Owner’s ID', hint: 'Passport or national ID' },
    { name: 'A business reference', hint: 'A letter from someone who knows your work, with their email and phone' },
  ];
}

import { STAFF, fullName, label, type Staff } from './staff';
import { CITIES } from './students';

export type Contact = { name: string; role: string; phone: string; email: string; initials: string };

/**
 * Who looks after a new agency: the Recruitment person on GSP's staff list (data/staff.ts) whose area covers the
 * agency's city or its state; otherwise the one who covers the whole country (Saurabh Chaudhary's area is "India");
 * otherwise the first Recruitment person for that sales region. A referral code (the first three letters of a
 * Recruitment person's first name, like ADI-204) wins over all of these. The staff list has no phone numbers.
 */
const SAME_CITY: Record<string, string> = { calicut: 'kozhikode', trichy: 'tiruchirappalli', vijaywada: 'vijayawada', 'new delhi': 'delhi', 'ho chi minh': 'ho chi minh city', gurugram: 'gurgaon' };
const norm = (x: string) => { const v = x.trim().toLowerCase(); return SAME_CITY[v] ?? v; };
const areasOf = (s: Staff) => s.area.split(',').map(norm).filter(Boolean);
const stateOf = (city: string) => Object.keys(CITIES).find((st) => CITIES[st].some((c) => norm(c) === norm(city)));
const BDMS = STAFF.filter((s) => s.role === 'Recruitment');
const contactOf = (s: Staff, role: string): Contact => ({ name: label(s), initials: initialsOf(fullName(s)), role, phone: '', email: s.email });

const initialsOf = (n: string) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');

/** The GSP partner manager (BDM) a new sign-up is given. A referral code wins over the area rule. */
export function partnerManagerFor(country: string, city: string, referral: string): Contact | null {
  const code = referral.trim().toUpperCase();
  const pre = code.slice(0, 3);
  const byRef = pre.length === 3 ? BDMS.filter((s) => s.first.toUpperCase().startsWith(pre)) : [];
  if (byRef.length === 1) return contactOf(byRef[0], `Partner manager · from referral code ${code}`);
  const inCountry = BDMS.filter((s) => s.regions.includes(country));
  const st = stateOf(city);
  const cityHit = city.trim() && inCountry.find((s) => areasOf(s).includes(norm(city)));
  const stateHit = st && inCountry.find((s) => areasOf(s).includes(norm(st)));
  const whole = inCountry.find((s) => areasOf(s).includes(norm(country)));
  const any = inCountry.find((s) => !s.area) ?? inCountry[0];
  const hit = cityHit || stateHit || whole || any;
  if (!hit) return null;
  const where = cityHit ? `${city.trim()}, ${country}` : stateHit ? `${st}, ${country}` : country;
  return contactOf(hit, `Partner manager · ${where}`);
}

/** Emails that already have a GSP account (sample data from the PM prototype). */
export const EXISTING_EMAILS = ['ananya@horizonoverseas.in', 'lan@saigonbridge.vn', 'rahul@horizonoverseas.in'];

export const emailInUse = (email: string) => EXISTING_EMAILS.includes(email.trim().toLowerCase());
