/**
 * One record of each RP's team (W21, 1 Nov): the people the RP's own Profile lists are the people GSP sees as the
 * RP contact on an application and on the Recruitment partners page, with the same email and phone. The sample
 * agency (GSP test agency) keeps its Profile's team (data/students.ts `teamFor`); every other RP's team comes from the
 * data set (scripts/gen_dataset.py: an admin and a counsellor, invented names).
 */
import { RPS, rpByName } from './dataset';
import { teamFor, type Member } from './students';

/** The prototype's own agency, signed in as RP Admin. */
export const TEST_AGENCY = 'GSP test agency';
/** Who signs in to it (screens/signin/model.ts SAMPLE_ACCOUNT). */
export const TEST_ADMIN = { name: 'Nesil Noble', email: 'nesil@upgard.com' };

/** An RP's team, by its name; the sample agency's when none is given. Ids are unique across RPs ("16018:1"). */
export function rpTeam(rp?: string): Member[] {
  if (!rp || rp === TEST_AGENCY) return teamFor(TEST_ADMIN.name, TEST_ADMIN.email).map((m) => ({ ...m, rp: TEST_AGENCY }));
  const r = rpByName(rp);
  return (r?.team ?? []).map((p, i) => ({ id: `${r!.id}:${i}`, name: p.name, role: p.role, email: p.email, dial: p.dial, phone: p.phone, branch: 'hq', rp }));
}
/** Everyone on every RP's team, for GSP's lists (a student's counsellor is one of them). */
export const allRpMembers = (): Member[] => [...rpTeam(), ...RPS.filter((r) => r.team?.length).flatMap((r) => rpTeam(r.name))];
/** The RP's main contact: its RP Admin. */
export const rpAdmin = (rp?: string) => rpTeam(rp).find((m) => m.role === 'RP Admin') ?? rpTeam(rp)[0];
/** "+91 98450 12345" */
export const phoneOf = (m?: Pick<Member, 'dial' | 'phone'>) => (m?.phone ? `${m.dial ?? ''} ${m.phone}`.trim() : '');
