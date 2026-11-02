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

/**
 * How an application ends (slice 3 PRD, Closing). The close reasons by stage; **Withdrawn**, the end of a withdrawal
 * (More › Withdraw, S3-26: not a close reason); and at New, S3-31's proposal (open: built until it's answered).
 * 'Student withdrawn' is the old name of Withdrawn, kept only to read older saved applications.
 */
export type EndKind =
  | 'Not eligible'
  | 'Student not eligible'
  | 'Created by mistake or duplicate'
  | 'University rejected'
  | 'Offer declined'
  | 'Refused after assessment'
  | 'Rejected by university'
  | 'Visa refused'
  | 'Deferred'
  | 'Withdrawn'
  | 'Student withdrawn';
/** A withdrawal, under either name. */
export const isWithdrawal = (k?: string) => k === 'Withdrawn' || k === 'Student withdrawn';

export type Reasons = { close: EndKind[][]; withdraw: string[]; sendBack: string[] };
export const REASON_DEFAULTS: Reasons = {
  /** By stage (index, New to Enrolment). */
  // the slice 3 PRD's table (a student withdrawing uses More › Withdraw, so it isn't a close reason, S3-26);
  // New: S3-31's proposal, open (asked 2 Nov), built until it's answered
  close: [
    ['Created by mistake or duplicate', 'Student not eligible'],
    ['Not eligible'],
    ['University rejected', 'Deferred'],
    ['Offer declined', 'Deferred'],
    ['Refused after assessment', 'Rejected by university', 'Deferred'],
    ['Deferred'],
    ['Visa refused', 'Deferred'],
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
