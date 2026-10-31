/**
 * Who's signed in to GSP · Admissions (testing): Ramish Jafery, India's Admissions contact on GSP's staff list
 * (data/staff.ts). The agency's own data (its name, its admin and counsellors, its students) stays the RP's, since
 * Admissions sees the RP's applications.
 */
import { person, label } from '../data/staff';

const me = person('ramish.jafery@upgrad.com');
export const GSP_USER = { name: label(me), first: me.first, org: 'GSP', role: 'Admissions', email: me.email };
