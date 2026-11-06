import { isOpen, ownerOf, type AppOwner, type Application } from '../../data/applications';

/**
 * Who has an application, as GSP's team sees it. The data's owners are the agency (`you` in the agency
 * portal), GSP and the university: here GSP is "you", and the agency is the RP. The owner colours stay with
 * the party (amber the agency, violet GSP, blue the university), whichever portal shows them.
 */
export const OWNER_WORD: Record<AppOwner, string> = { you: 'With RP', gsp: 'Pending on you', uni: 'With university', done: 'Enrolled', end: 'Closed' };
/** The short tag: in the application's header corner and the journey. */
export const OWNER_TAG: Record<AppOwner, string> = { you: 'With RP', gsp: 'Pending on you', uni: 'University', done: 'Done', end: 'Closed' };
/** Pending on GSP: an open application whose current status is GSP's. */
export const pendingFromGsp = (a: Application) => isOpen(a) && ownerOf(a) === 'gsp';
