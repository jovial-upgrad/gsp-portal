/**
 * The recruitment partners the Institution Team works for (30 Oct): when the team adds a student or an application,
 * it says whose it is: the ones whose agreement is signed, from its own Recruitment partners page.
 * The prototype's own agency, signed in as RP Admin, is Horizon Overseas: the sample students are all its own.
 */
import type { Student } from '../data/students';
import { sampleRps } from './data/records';

export type Rp = { name: string; city: string; country: string };

export const RPS: Rp[] = sampleRps()
  .filter((r) => r.status === 'Agreement signed')
  .map((r) => ({ name: r.name, city: r.city, country: r.country }))
  .sort((a, b) => a.name.localeCompare(b.name));
export const HOME_RP = 'Horizon Overseas';
/** A student's recruitment partner: the one GSP picked, or the prototype's agency for the samples. */
export const rpOf = (s: Student) => s.rp ?? HOME_RP;
export const rpLabel = (r: Rp) => `${r.name} · ${r.city}`;
