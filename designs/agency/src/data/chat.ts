/**
 * The application chat's settings (Jovial, 2 Nov), one place every role reads:
 * - **Request categories**: what GSP can ask for with Request a document, picked from a list. Admin edits it in
 *   GSP · Admin › Document configuration (kept with Admin's settings as `requestCats`); these are the defaults until
 *   Admin changes them. **Other** (type the document's name) is always offered after the list and isn't in it.
 * - **Templates**: the lines the chat posts on its own, with {placeholders}.
 * - **Who can use what**: the RP types text only; attaching, Request a document and Request conditions are GSP's, and
 *   the RP uploads in the chat only against a request.
 */
import { adminCfg, type Cfg } from '../admin/data/store';

export const REQUEST_CATEGORY_DEFAULTS = ['ITR', 'Loan', 'Marriage Certificate', 'Visa Lodgement Proof', 'Visa', 'Acceptance Letter (CoE, CAS, I-20)', 'Bank Statement'];
/** Always offered after the categories: the officer types the document's name. */
export const OTHER_CATEGORY = 'Other';

type ChatCfg = Cfg & { requestCats?: string[] };
/** The categories as they are now: Admin's, else the defaults. */
export function requestCategories(): string[] {
  let own: string[] | undefined;
  try {
    own = (adminCfg() as ChatCfg).requestCats;
  } catch {
    own = undefined;
  }
  return (own?.length ? own : REQUEST_CATEGORY_DEFAULTS).filter((x) => x.trim() && x !== OTHER_CATEGORY);
}
/** Admin's categories, read from a Cfg (Admin's page). */
export const requestCatsOf = (c: Cfg) => ((c as ChatCfg).requestCats?.length ? (c as ChatCfg).requestCats! : REQUEST_CATEGORY_DEFAULTS);
/** Sets the categories (for Admin's `change`, which saves and logs it). */
export const withRequestCats = (c: Cfg, list: string[]): Cfg => ({ ...c, requestCats: list }) as ChatCfg;

/** The lines the chat posts by itself. */
export const CHAT_TEMPLATES = {
  /** When the RP uploads a document GSP requested, under the officer's name (Jovial, 2 Nov). */
  uploadAck: 'Thanks for uploading {document}. We’re reviewing it and will update you here.',
};
export const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_m, k: string) => v[k] ?? '');
export const uploadAckLine = (document: string) => fill(CHAT_TEMPLATES.uploadAck, { document });

/** What each side can do in the chat (Jovial, 2 Nov). */
export const CHAT_RIGHTS = {
  rp: { text: true, attach: false, requestDocument: false, requestConditions: false, uploadAgainstRequest: true },
  gsp: { text: true, attach: true, requestDocument: true, requestConditions: true, uploadAgainstRequest: false },
} as const;
