/**
 * The recruitment partners the Institution Team works for (30 Oct): when the team adds a student or an application,
 * it says whose it is: the ones whose agreement is signed, from its own Recruitment partners page.
 * The prototype's own agency, signed in as RP Admin, is the GSP test agency (Finance's R-TEST): the students without
 * an RP are its own.
 */
import type { Student } from '../data/students';
import { sampleRps } from './data/records';

export type Rp = { name: string; city: string; country: string };

export const HOME_RP = 'GSP test agency';
export const RPS: Rp[] = [
  { name: HOME_RP, city: 'Bengaluru', country: 'India' },
  ...sampleRps()
    .filter((r) => r.status === 'Agreement signed' && r.name !== HOME_RP)
    .map((r) => ({ name: r.name, city: r.city, country: r.country }))
    .sort((a, b) => a.name.localeCompare(b.name)),
];
/** A student's recruitment partner: the one GSP picked, or the prototype's agency for the samples. */
export const rpOf = (s: Student) => s.rp ?? HOME_RP;
export const rpLabel = (r: Rp) => (r.city ? `${r.name} · ${r.city}` : `${r.name} · ${r.country}`);
