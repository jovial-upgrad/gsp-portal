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

export type Contact = { name: string; role: string; phone: string; email: string; initials: string };

/** Who looks after a new agency, by country and city (PM prototype `BDM_RULE`). Phones are sample data. */
const BDM_RULE: Record<string, Record<string, string>> = {
  India: { Bengaluru: 'Aditya Rao', Hyderabad: 'Aditya Rao', Mumbai: 'Sneha Kulkarni', Delhi: 'Rohit Malhotra', Lucknow: 'Rohit Malhotra' },
  Nepal: { Kathmandu: 'Sujan Shrestha' },
  Bangladesh: { Dhaka: 'Rafiq Ahmed' },
  'Sri Lanka': { Colombo: 'Dilini Perera' },
  Vietnam: { 'Ho Chi Minh City': 'Tran Minh', Hanoi: 'Tina Huynh' },
};
const PEOPLE: Record<string, Omit<Contact, 'name' | 'initials' | 'role'>> = {
  'Aditya Rao': { phone: '+91 98110 40217', email: 'aditya.rao@gsp.upgrad.com' },
  'Sneha Kulkarni': { phone: '+91 98200 31876', email: 'sneha.kulkarni@gsp.upgrad.com' },
  'Rohit Malhotra': { phone: '+91 98110 40021', email: 'rohit.malhotra@gsp.upgrad.com' },
  'Sujan Shrestha': { phone: '+977 980 114 2271', email: 'sujan.shrestha@gsp.upgrad.com' },
  'Rafiq Ahmed': { phone: '+880 1711 409 552', email: 'rafiq.ahmed@gsp.upgrad.com' },
  'Dilini Perera': { phone: '+94 77 341 8820', email: 'dilini.perera@gsp.upgrad.com' },
  'Tran Minh': { phone: '+84 90 812 4471', email: 'tran.minh@gsp.upgrad.com' },
  'Tina Huynh': { phone: '+84 90 812 4410', email: 'tina.huynh@gsp.upgrad.com' },
};
const REFERRAL_OWNERS: Record<string, string> = { ADI: 'Aditya Rao', SNE: 'Sneha Kulkarni', ROH: 'Rohit Malhotra' };

const initialsOf = (n: string) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');

/** The GSP partner manager (BDM) a new sign-up is given. A referral code wins over the city rule. */
export function partnerManagerFor(country: string, city: string, referral: string): Contact | null {
  const code = referral.trim().toUpperCase();
  const byRef = REFERRAL_OWNERS[code.slice(0, 3)];
  const cityKey = Object.keys(BDM_RULE[country] || {}).find((c) => c.toLowerCase() === city.trim().toLowerCase());
  const name = byRef || (cityKey ? BDM_RULE[country][cityKey] : undefined);
  if (!name) return null;
  return {
    name,
    initials: initialsOf(name),
    role: byRef ? `Partner manager · from referral code ${code}` : `Partner manager · ${cityKey}, ${country}`,
    ...PEOPLE[name],
  };
}

/** Emails that already have a GSP account (sample data from the PM prototype). */
export const EXISTING_EMAILS = ['ananya@horizonoverseas.in', 'lan@saigonbridge.vn', 'rahul@horizonoverseas.in'];

export const emailInUse = (email: string) => EXISTING_EMAILS.includes(email.trim().toLowerCase());
