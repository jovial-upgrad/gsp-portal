/**
 * One record of each RP's team (W21; HC13, 1 Nov): the people the RP's own Profile lists are the people GSP sees as
 * the RP contact on an application and on the Recruitment partners page, with the same email and phone. Every RP's
 * team, the GSP test agency's included, is in the data set (scripts/gen_dataset.py: the test agency's people and
 * branches as the designer made them; every other RP an admin and a counsellor, invented names).
 */
import { RPS, TEST_RP, rpByName, type DataBranch } from './dataset';
import type { Member } from './students';

/** The prototype's own agency, signed in as RP Admin. */
export const TEST_AGENCY = TEST_RP.name;
/** Who signs in to it (screens/signin/model.ts SAMPLE_ACCOUNT): its RP Admin. */
const admin0 = TEST_RP.team?.find((p) => p.key === 'me') ?? TEST_RP.team?.[0];
export const TEST_ADMIN = { name: admin0?.name ?? '', email: admin0?.email ?? '' };
/** The test agency's country: the default for its forms' country and phone code (HC19). */
export const TEST_COUNTRY = TEST_RP.country ?? '';

/** An RP's team, by its name; the test agency's when none is given. Ids are unique across RPs ("16018:1"); the test agency's are its own ('me', 'karthik'…). */
export function rpTeam(rp?: string): Member[] {
  const r = !rp || rp === TEST_AGENCY ? TEST_RP : rpByName(rp);
  return (r?.team ?? []).map((p, i) => ({ id: p.key ?? `${r!.id}:${i}`, name: p.name, role: p.role, email: p.email, dial: p.dial, phone: p.phone, branch: p.branch ?? 'hq', rp: r!.name }));
}
/**
 * The team an RP Admin manages on Profile, as the person signed in sees it: their RP's team record, with them as
 * its RP Admin ('me'). An agency without a record (a new sign-up) starts with just them.
 */
export function teamFor(me: { name: string; email: string; agency: string }, dial = ''): Member[] {
  const list = rpByName(me.agency) ? rpTeam(me.agency) : [];
  const mine = list.find((m) => m.id === 'me' || m.email === me.email);
  const self: Member = { ...(mine ?? { id: 'me', role: 'RP Admin', branch: 'hq', dial, phone: '' }), id: 'me', name: me.name, email: me.email };
  return [self, ...list.filter((m) => m !== mine).map(({ rp: _rp, ...m }) => m)];
}
/** An RP's branches (the test agency's head office and Mumbai); none for an RP whose record has none. */
export const rpBranches = (rp?: string): DataBranch[] => ((!rp || rp === TEST_AGENCY ? TEST_RP : rpByName(rp))?.branches ?? []).map((b) => ({ ...b }));
/** Everyone on every RP's team, for GSP's lists (a student's counsellor is one of them). */
export const allRpMembers = (): Member[] => RPS.filter((r) => r.team?.length).flatMap((r) => rpTeam(r.name));
/** The RP's main contact: its RP Admin. */
export const rpAdmin = (rp?: string) => rpTeam(rp).find((m) => m.role === 'RP Admin') ?? rpTeam(rp)[0];
/** "+91 98450 12345" */
export const phoneOf = (m?: Pick<Member, 'dial' | 'phone'>) => (m?.phone ? `${m.dial ?? ''} ${m.phone}`.trim() : '');
