/**
 * "About how much" for a course (Jovial, 11 Nov, Q101/R104): Find courses and Earnings show what an RP would earn on a
 * course, worked out the way the engine prices a line, from the records only: the university's terms in force today
 * (its rate for the course's level, or the most specific rate row, or a fixed amount, on the fee basis it says), then
 * the RP's own terms (its own flat share, a share notice it's on, else its agreement's band reached so far). GSP's views
 * (no RP) get GSP's own amount. None when the university has no terms, or the RP isn't shown course commission.
 */
import { CURRENCY, setEarnOf, type Course } from '../../data/courses';
import { agreementOn, bandStanding, noticeCovers, termsAt } from './engine';
import { pickRate } from './pricing';
import { commState, ctxOf, ctxRps, ctxUnis } from './store';
import type { AgreementTerms, CommState, Level, TermsBody } from './model';

export type Estimate = { amount: number; currency: string; pctOfFee: number; share: number | null; basis: 'net' | 'gross'; next?: { more: number; amount: number; pctOfFee: number } };

export function estimateFor(s: CommState, c: Course, rpId: string | null, today: string): Estimate | null {
  const rec = s.terms.find((t) => t.uni === c.uni.id);
  if (!rec) return null;
  const T = termsAt<TermsBody>(rec as never, today);
  const S = s.settings;
  const rp = rpId ? ctxRps().find((r) => r.id === rpId) : undefined;
  const { best } = pickRate(T, { level: c.level as Level, course: c.name, campus: c.campus.name, nationality: rp?.country, start: today }, 1, S);
  if (!best) return null;
  const gross = c.tuition;
  const net = c.tuition - (c.scholarship ?? 0);
  const fee = T.feeBasis === 'Tuition before scholarship' ? gross : net;
  const gsp = best.amt != null ? best.amt : (fee * (best.pct ?? 0)) / 100;
  const currency = T.currency || CURRENCY[c.uni.country as keyof typeof CURRENCY] || c.currency;
  const basis = T.feeBasis === 'Tuition before scholarship' ? 'gross' : 'net';
  const out = (share: number) => ({ amount: Math.round((gsp * share) / 100 / 10) * 10, pctOfFee: Math.round(((gsp * share) / 100 / Math.max(1, fee)) * 10000) / 100 });
  if (!rpId) return { ...out(100), currency, share: null, basis };
  const r = s.records.find((x) => x.rp === rpId);
  const view = r?.view ?? S.rpView;
  if (!view.kinds.includes('Course commission')) return null;
  const ag = agreementOn(s, rpId, today);
  if (!r || !ag) return null;
  const A = termsAt<AgreementTerms>(ag, today);
  const ctx = ctxOf(today);
  const uni = ctxUnis().find((u) => u.id === c.uni.id);
  // a share notice it's on today, for this course (a listed RP's notice first, then the higher share)
  const notice = uni
    ? s.notices
        .filter((n) => (n.benefit === 'Share' || n.benefit === 'Tiered share' || n.benefit === 'Share plus amount per enrolment') && noticeCovers(n, { app: '', student: '', rp: rpId, course: c.id, intake: '', enrolled: today, nationality: rp?.country } as never, uni, c.level as Level, rp, S.regionGroups))
        .sort((a, b) => (b.rps.length ? 1 : 0) - (a.rps.length ? 1 : 0) || (b.share ?? b.bands[0]?.pct ?? 0) - (a.share ?? a.bands[0]?.pct ?? 0))[0]
    : undefined;
  const stand = bandStanding(s, ctx, rpId);
  let share = r.ownFlat != null ? r.ownFlat : A.shareType === 'Flat' ? A.share ?? 0 : stand?.share ?? A.bands[0]?.pct ?? 0;
  const ns = notice ? (notice.benefit === 'Tiered share' ? notice.bands[0]?.pct ?? 0 : notice.share ?? 0) : 0;
  if (notice) share = notice.combine === 'Separate box' ? ns : notice.combine === 'Adds on top' ? share + ns : Math.max(share, ns);
  const next = !notice && r.ownFlat == null && stand?.next ? { more: stand.next.more, ...out(stand.next.share) } : undefined;
  return { ...out(share), currency, share, basis, next };
}

/** For the portals' Find courses: the RP in context (none in GSP's roles). */
let current: string | null = null;
export const setEstimateRp = (rpId: string | null) => {
  current = rpId;
};
export const estimateOf = (c: Course) => estimateFor(commState(), c, current, ctxOf().today);
// Find courses, the course page, Compare and an application's earnings read the estimate through data/courses.ts
setEarnOf(estimateOf);
