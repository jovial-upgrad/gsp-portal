/**
 * The RP's three roles (PRD slice 1, Roles): fixed by role, not in Admin's matrix.
 * - **RP Admin**: the whole RP, every branch, student and application, earnings; the team, branches and bank details.
 * - **Branch Admin**: one branch's students and applications; manages that branch's counsellors.
 * - **Counsellor**: only the students and applications assigned to them; chat only on those.
 * Only an RP Admin or Branch Admin changes a student's counsellor; earnings are the RP Admin's only.
 */
import { rpTeam } from './rpteam';
import type { Student } from './students';

type Acc = { name: string; email: string; agency: string; role?: string };

/** Which of the agency's students this person sees. */
export function rpSees(acc: Acc): (s: Student) => boolean {
  if (!acc.role || acc.role === 'RP Admin') return () => true;
  // the agency's team as its record has it (students name their counsellor by these ids)
  const team = rpTeam(acc.agency);
  const me = team.find((m) => m.email === acc.email) ?? team[0];
  if (!me) return () => true;
  if (acc.role === 'Counsellor') return (s) => s.counsellor === me.id;
  // Branch Admin: students whose counsellor works in their branch
  const branch = me.branch ?? 'hq';
  const inBranch = new Set(team.filter((m) => (m.branch ?? 'hq') === branch).map((m) => m.id));
  return (s) => inBranch.has(s.counsellor);
}
/** Earnings are visible to the RP Admin only. */
export const seesEarnings = (acc: { role?: string }) => !acc.role || acc.role === 'RP Admin';
