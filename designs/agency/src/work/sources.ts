// @ts-nocheck -- typed with the work API.
/**
 * Records other modules own that the task rules read (work/recordRules.ts), registered by those modules so the work
 * store has no import cycle: Finance's commission lines, changes waiting for a checker and payout runs (finance/store.ts).
 */
const SOURCES = {};
export const registerSource = (name, read) => void (SOURCES[name] = read);
export const readSource = (name) => {
  try { return SOURCES[name]?.() ?? null; } catch { return null; }
};
