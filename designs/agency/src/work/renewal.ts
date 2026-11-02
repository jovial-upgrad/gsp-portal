/**
 * When an agreement's renewal starts (Jovial, 1 Nov, HC41): the days before its end date that Task rule T38
 * ("Agreement ending", Admin › Work › Task rules) has now. No imports, so the Institution Team's records can read it
 * without loading the work store: it reads what the work store saved (work/store.ts KEY), else the rule's seed.
 */
export const WORK_KEY = 'gsp-work-v8'; // v8: RP agreement tasks (RPA, T58) worked out from the RP records (Jovial, 2 Nov)
export const RENEWAL_SEED_DAYS = 60;
export function renewalDays(): number {
  try {
    const s = JSON.parse(localStorage.getItem(WORK_KEY) || 'null');
    const r = s?.rules?.find((x: { row?: string }) => x.row === 'T38');
    if (r && r.on !== false && Number(r.days) > 0) return Number(r.days);
  } catch {
    /* storage blocked */
  }
  return RENEWAL_SEED_DAYS;
}
