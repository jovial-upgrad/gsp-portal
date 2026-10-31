/**
 * The recruitment partners GSP Team works for (30 Oct): when the team adds a student or an application, it says
 * whose it is. The ones whose agreement is signed, as the Institution Team's Recruitment partners page lists them.
 * The prototype's own agency, signed in as RP Admin, is Horizon Overseas: the sample students are all its own.
 */
import type { Student } from '../data/students';

export type Rp = { name: string; city: string; country: string };

export const RPS: Rp[] = [
  { name: 'Capital Career Abroad', city: 'Delhi', country: 'India' },
  { name: 'Himalayan Study Centre', city: 'Pokhara', country: 'Nepal' },
  { name: 'Horizon Overseas', city: 'Mumbai', country: 'India' },
  { name: 'Lotus Study Abroad', city: 'Hanoi', country: 'Vietnam' },
  { name: 'Manila Study Link', city: 'Manila', country: 'Philippines' },
  { name: 'Saigon Bridge Education', city: 'Ho Chi Minh City', country: 'Vietnam' },
];
export const HOME_RP = 'Horizon Overseas';
/** A student's recruitment partner: the one GSP picked, or the prototype's agency for the samples. */
export const rpOf = (s: Student) => s.rp ?? HOME_RP;
export const rpLabel = (r: Rp) => `${r.name} · ${r.city}`;
