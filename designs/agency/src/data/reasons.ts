/**
 * Reasons, one list per kind, in one place (HC23, Jovial 1 Nov), used by every copy of the portal (RP Admin, GSP ·
 * Admissions, the Institution Team, Admin's):
 * - **close**: how an application can close at each stage (GSP's status list);
 * - **withdraw**: why an application is withdrawn;
 * - **sendBack**: why GSP sends a document back, to start the explanation from.
 * Lock answer S3C-21 (Jovial, 2 Nov): **close and withdraw reasons are Admin's**, edited in Admin › Application
 * configuration › Reasons (admin/data/lists.ts); `REASON_DEFAULTS` is only where they start. Removing one stops it
 * being offered; applications closed with it keep it. **Send-back reasons are fixed** (not editable).
 */
import { adminCfg } from '../admin/data/store';
import { reasonListsOf } from '../admin/data/lists';

/**
 * How an application ends (slice 3 PRD, Closing). The close reasons by stage; **Withdrawn**, the end of a withdrawal
 * (More › Withdraw, S3-26: not a close reason); and at New, S3-31's proposal (open: built until it's answered).
 * 'Student withdrawn' is the old name of Withdrawn, kept only to read older saved applications.
 */
export type EndKind =
  /** Admin's own close reasons (S3C-21): any text on its list. */
  | (string & {})
  | 'Not eligible'
  | 'Student not eligible'
  | 'Created by mistake or duplicate'
  | 'University rejected'
  | 'Offer declined'
  | 'Refused after assessment'
  | 'Rejected by university'
  | 'Visa rejected'
  /** The old name of Visa rejected (Jovial, 2 Nov), kept only to read older saved applications. */
  | 'Visa refused'
  | 'Deferred'
  | 'Withdrawn'
  | 'Student withdrawn';
/** A withdrawal, under either name. */
export const isWithdrawal = (k?: string) => k === 'Withdrawn' || k === 'Student withdrawn';
/** A close reason as it reads now: older saved ones under their new name (Visa refused is Visa rejected, Jovial 2 Nov). */
export const endName = (k?: string) => (k === 'Visa refused' ? 'Visa rejected' : k);

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
    ['Visa rejected', 'Deferred'],
    ['Deferred'],
  ],
  withdraw: ['The student chose another offer', 'The student is deferring to a later intake', 'The student isn’t going to study abroad', 'Another reason'],
  sendBack: ['Blurred or hard to read', 'Pages are missing', 'It’s the wrong document', 'The name doesn’t match the passport', 'It has expired'],
};

/** The lists as they are now: Admin's close and withdraw reasons (S3C-21), and the fixed send-back reasons. */
export function reasons(): Reasons {
  let own: { close: string[][]; withdraw: string[] } | undefined;
  try {
    own = reasonListsOf(adminCfg(), REASON_DEFAULTS);
  } catch {
    own = undefined;
  }
  return { close: (own?.close ?? REASON_DEFAULTS.close) as EndKind[][], withdraw: own?.withdraw ?? REASON_DEFAULTS.withdraw, sendBack: REASON_DEFAULTS.sendBack };
}
export const closeReasons = (stage: number) => reasons().close[stage] ?? [];
export const withdrawReasons = () => reasons().withdraw;
export const sendBackReasons = () => reasons().sendBack;
