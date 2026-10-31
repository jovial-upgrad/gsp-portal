/**
 * Who's signed in to the Institution Team (GSP · Institution, 29 Oct): Raj Shamani by default, on GSP's Institution
 * Team; whoever signs in, after that (Kavya Menon, once she's set up her password). A GSP admin gives team members
 * access; they sign in with their GSP email (see signin/model.ts). The agency's own data in the copied Students and
 * Applications (its name, admin and counsellors) stays the RP's.
 */
import { TEAM_MEMBER, type Member } from './signin/model';

const of = (m: Member) => ({ name: m.name, first: m.first, org: m.org, role: m.role, email: m.email });
/** Read as each screen draws, so signing in as someone else shows them everywhere. */
export const GSP_USER = of(TEAM_MEMBER);
export const signInAs = (m: Member) => Object.assign(GSP_USER, of(m));
