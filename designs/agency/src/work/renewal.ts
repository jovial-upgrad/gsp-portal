/**
 * When an agreement's renewal starts (Jovial, 1 Nov, HC41): the days before its end date that Task rule T38
 * ("Agreement ending", Admin › Work › Task rules) has now. No imports, so the Institution Team's records can read it
 * without loading the work store: it reads what the work store saved (work/store.ts KEY), else the rule's seed.
 */
export const WORK_KEY = 'gsp-work-v14'; // v14 (5 Nov): Mail follows the 23 Admissions mail types (Pending Questions), each with what happens and where it goes; // v13 (5 Nov): a kind of work's Goes to is the only routing (no queue on a rule, no kinds on a queue); // v12 (4 Nov): T15 for Tuition paid and Deposit paid, payment proof pending; // v11 (3 Nov): nothing seeded; every task from a rule (recordRules.ts), job runs and bounces as testing aids; // v10 (2 Nov, lock answers merged): T7 and T52 back, T71 tell the university about a withdrawal (T69 stays the agreement reminders, T70 the reopened partner's universities); // v9 (2 Nov, lock answers): T43 and T59 removed; T69 agreement not signed, T70 university to reactivate; // v8: RP agreement tasks (RPA, T58) worked out from the RP records (Jovial, 2 Nov)
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
