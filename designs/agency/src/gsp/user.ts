/**
 * Who's signed in to GSP · Admissions (testing): Ramish Jafery, India's Admissions contact on GSP's staff list
 * (data/staff.ts). The agency's own data (its name, its admin and counsellors, its students) stays the RP's, since
 * Admissions sees the RP's applications.
 *
 * Jovial, 2 Nov: GSP · Global Ops reuses this portal (S1-1) as Rhea Menon (a pseudonym), Global Ops, in her own sales regions (only Admin sees every region, Regression 31).
 */
import { person, label } from '../data/staff';
import { currentRole } from '../proto/roles';

const of = (email: string, role: string) => {
  const me = person(email);
  return { name: label(me), first: me.first, org: 'GSP', role, email: me.email };
};
const ADMISSION = of('ramish.jafery@upgrad.com', 'Admissions');
const GLOBAL_OPS = of('rhea.menon@upgrad.com', 'Global Ops');
/** Read as each screen draws: the person for the role on show. */
export const GSP_USER = { ...ADMISSION };
/** Signs in as the role's person (App calls this as the Role menu changes). */
export const actAsGspRole = () => Object.assign(GSP_USER, currentRole() === 'gsp-global-ops' ? GLOBAL_OPS : ADMISSION);
/** The permission role whose line in Admin's matrix this portal follows now. */
export const gspPermRole = () => (currentRole() === 'gsp-global-ops' ? 'Global Ops' : 'Admission');
/** The Role menu key this portal is showing (for My work's persona). */
export const gspRoleKey = () => (currentRole() === 'gsp-global-ops' ? 'gsp-global-ops' : 'gsp-team');
