/**
 * Who has an application, in words: one table (HC24, Jovial 1 Nov), the same in every role (RP Admin, GSP ·
 * Admissions, the Institution Team, Admin, My work). The data's owners are the RP (`you`), GSP and the university.
 */
export type OwnerKey = 'you' | 'gsp' | 'uni' | 'done' | 'end' | 'wd';
/** A finished application shows one pill instead: Enrolled, Closed or Withdrawn (S3-27). */
export const OWNER_WORD: Record<OwnerKey, string> = { you: 'On RP', gsp: 'On GSP', uni: 'On university', done: 'Enrolled', end: 'Closed', wd: 'Withdrawn' };
/** The short tag (an application's header corner, the journey): the same words. */
export const OWNER_TAG = OWNER_WORD;

/**
 * The RP's own portal says it from the RP's side (Jovial, 1 Nov, Who has it WH1: "The RP sees it in Pending on you"):
 * Pending on you, With GSP, With university.
 */
export const RP_OWNER_WORD: Record<OwnerKey, string> = { you: 'Pending on you', gsp: 'With GSP', uni: 'With university', done: 'Enrolled', end: 'Closed', wd: 'Withdrawn' };
export const RP_OWNER_TAG = RP_OWNER_WORD;
