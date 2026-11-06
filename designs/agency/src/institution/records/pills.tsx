import { PARTNER_STATUSES, isBefore, isClosed, stagesOf, type InstitutionPartner } from '../data/records';
import type { CourseStatus, UniStatus } from '../data/catalogue';
import { Pill, type Tone } from './parts';

/** A partner's status in its colour: being agreed, executed, or closed. An agreement ending or ended shows on its date. */
export function partnerTone(p: InstitutionPartner): Tone {
  const st = stagesOf(p);
  return st.includes('closed') ? 'grey' : st.includes('before') ? 'gsp' : 'ok';
}
export const PartnerPill = ({ p }: { p: InstitutionPartner }) => <Pill tone={partnerTone(p)}>{p.status}</Pill>;
/** Where a status sits, for the status menu's groups. */
export const statusGroup = (s: (typeof PARTNER_STATUSES)[number]) => (isClosed(s) ? 'Closed' : isBefore(s) ? 'Before the agreement' : 'Agreement');

export const UNI_TONE: Record<UniStatus, Tone> = { Live: 'ok', 'Setting up': 'gsp', Paused: 'you', Ended: 'grey' };
export const UniPill = ({ s }: { s: UniStatus }) => <Pill tone={UNI_TONE[s]}>{s}</Pill>;

export const COURSE_TONE: Record<CourseStatus, Tone> = { Live: 'ok', Draft: 'gsp', Hidden: 'grey' };
export const CoursePill = ({ s }: { s: CourseStatus }) => <Pill tone={COURSE_TONE[s]}>{s}</Pill>;
