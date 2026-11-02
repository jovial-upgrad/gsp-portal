/**
 * Two of Admin's lists, kept in Admin's settings store like the rest (so a save is logged and every role reads it):
 *
 * - **Highest education** (lock answer S3C-1, Jovial, 2 Nov): Admin › Course configuration › Highest education. The
 *   one ordered list students and courses pick from (data/education.ts reads it here); its order drives the level check.
 * - **Close and withdraw reasons** (lock answer S3C-21): Admin › Application configuration › Reasons. Close reasons by
 *   stage and the withdraw reasons; data/reasons.ts reads them here. Send-back (reject) reasons stay fixed.
 */
import { adminCfg, type Cfg } from './store';
import { SEED_EDUCATION, setEducationReader, type EducationLevel } from '../../data/education';

/* ---------- Highest education ---------- */

export type EduListCfg = Cfg & { education?: EducationLevel[] };
export const educationOf = (c: Cfg): EducationLevel[] => (c as EduListCfg).education ?? SEED_EDUCATION;
export const withEducation = (c: Cfg, education: EducationLevel[]): Cfg => ({ ...c, education }) as EduListCfg;
setEducationReader(() => educationOf(adminCfg()));

/* ---------- Close and withdraw reasons ---------- */

/** What Admin edits: the close reasons by stage (index, New to Enrolment) and the withdraw reasons. */
export type ReasonLists = { close: string[][]; withdraw: string[] };
type ReasonCfg = Cfg & { reasons?: Partial<ReasonLists> & { sendBack?: string[] } };
/** A reason's text: 1 to 60 characters, unique in its list (S3C-21). */
export const REASON_MAX = 60;
export const reasonListsOf = (c: Cfg, seed: ReasonLists): ReasonLists => {
  const own = (c as ReasonCfg).reasons;
  return { close: own?.close?.length ? own.close : seed.close, withdraw: own?.withdraw?.length ? own.withdraw : seed.withdraw };
};
export const withReasonLists = (c: Cfg, r: ReasonLists): Cfg => ({ ...c, reasons: { close: r.close, withdraw: r.withdraw } }) as ReasonCfg;
/** A new reason's problem in its list, or null. */
export function reasonError(text: string, list: string[], self?: number): string | null {
  const t = text.trim();
  if (!t) return 'Type the reason.';
  if (t.length > REASON_MAX) return `Up to ${REASON_MAX} characters.`;
  if (list.some((x, i) => i !== self && x.trim().toLowerCase() === t.toLowerCase())) return `${t} is in this list already.`;
  return null;
}
