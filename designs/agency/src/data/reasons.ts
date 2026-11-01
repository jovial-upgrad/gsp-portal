/**
 * Reasons, one list per kind, in one place (HC23, Jovial 1 Nov), used by every copy of the portal (RP Admin, GSP ·
 * Admissions, the Institution Team, Admin's):
 * - **close**: how an application can close at each stage (GSP's status list);
 * - **withdraw**: why an application is withdrawn;
 * - **sendBack**: why GSP sends a document back, to start the explanation from.
 * `REASON_DEFAULTS` is the starting point for an Admin setting: when GSP · Admin keeps its own lists (adminCfg().reasons,
 * same shape), they're used instead.
 */
import { adminCfg } from '../admin/data/store';

/** How an application can close. Deferred can happen at any stage once it's with the university. */
export type EndKind = 'Not eligible' | 'Student withdrawn' | 'University rejected' | 'Offer declined' | 'Refused after assessment' | 'Rejected by university' | 'Visa refused' | 'Deferred';

export type Reasons = { close: EndKind[][]; withdraw: string[]; sendBack: string[] };
export const REASON_DEFAULTS: Reasons = {
  /** By stage (index, New to Enrolment). */
  close: [
    ['Student withdrawn'],
    ['Not eligible', 'Student withdrawn'],
    ['University rejected', 'Student withdrawn', 'Deferred'],
    ['Offer declined', 'Student withdrawn', 'Deferred'],
    ['Refused after assessment', 'Rejected by university', 'Student withdrawn', 'Deferred'],
    ['Student withdrawn', 'Deferred'],
    ['Visa refused', 'Student withdrawn', 'Deferred'],
    ['Deferred'],
  ],
  withdraw: ['The student chose another offer', 'The student is deferring to a later intake', 'The student isn’t going to study abroad', 'Another reason'],
  sendBack: ['Blurred or hard to read', 'Pages are missing', 'It’s the wrong document', 'The name doesn’t match the passport', 'It has expired'],
};

/** The lists as they are now: Admin's, where it keeps them, else the defaults. */
export function reasons(): Reasons {
  let own: Partial<Reasons> | undefined;
  try {
    own = (adminCfg() as { reasons?: Partial<Reasons> }).reasons;
  } catch {
    own = undefined;
  }
  return { close: own?.close?.length ? own.close : REASON_DEFAULTS.close, withdraw: own?.withdraw?.length ? own.withdraw : REASON_DEFAULTS.withdraw, sendBack: own?.sendBack?.length ? own.sendBack : REASON_DEFAULTS.sendBack };
}
export const closeReasons = (stage: number) => reasons().close[stage] ?? [];
export const withdrawReasons = () => reasons().withdraw;
export const sendBackReasons = () => reasons().sendBack;
