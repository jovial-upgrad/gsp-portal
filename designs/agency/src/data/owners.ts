/**
 * Who has an application, in words: one table (HC24, Jovial 1 Nov), the same in every role (RP Admin, GSP ·
 * Admissions, the Institution Team, Admin, My work). The data's owners are the RP (`you`), GSP and the university.
 */
export type OwnerKey = 'you' | 'gsp' | 'uni' | 'done' | 'end';
export const OWNER_WORD: Record<OwnerKey, string> = { you: 'On RP', gsp: 'On GSP', uni: 'On university', done: 'Enrolled', end: 'Closed' };
/** The short tag (an application's header corner, the journey): the same words. */
export const OWNER_TAG = OWNER_WORD;
