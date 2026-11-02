// @ts-nocheck -- with the finance API.
import { DEFYEARS } from './engine';

/*
 * Finance's defaults (Jovial, 1 Nov, HC43, HC44, HC45), set on Finance setup › Defaults and FX, in cfg.settings:
 * the estimate for a university with no terms yet, each level's default course length, the payout currency for
 * RPs in each sales region (one table: RPs with no signed terms are paid in it), and withholding per sales region.
 */
export const FIN_DEFAULTS = {
  estimate: { inst: 2, payDays: 30, trigger: 'census', studentType: 'New' },
  courseYears: { ...DEFYEARS },
  payoutCur: { India: 'INR', Bangladesh: 'BDT', Nepal: 'NPR', 'Sri Lanka': 'LKR', Vietnam: 'VND' },
  wht: {},
};
export const settingsOf = cfg => {
  const S = (cfg && cfg.settings) || {};
  return { ...FIN_DEFAULTS, ...S, estimate: { ...FIN_DEFAULTS.estimate, ...(S.estimate || {}) }, courseYears: { ...FIN_DEFAULTS.courseYears, ...(S.courseYears || {}) }, payoutCur: S.payoutCur || FIN_DEFAULTS.payoutCur, wht: S.wht || {} };
};
/** The payout currency for an RP in a sales region (HC44): Finance setup's table, AUD where it has none. */
export const payoutCurOf = (cfg, region) => settingsOf(cfg).payoutCur[region] || 'AUD';

/** A commission notice's source document, and the student types an estimate prices (Finance's vocabulary). */
export const NOTICE_SOURCES = ['Notice', 'Addendum', 'Flyer', 'Email approval'] as const;
export const STUDENT_TYPES = ['New', 'Continuing', 'Transfer'] as const;
