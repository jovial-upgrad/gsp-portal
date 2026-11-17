/**
 * Show the working (Jovial, 17 Nov, after the Finance demo): for each line, the terms that priced it (the RP's agreement,
 * its own flat share or the notice that applied; the university's terms version), the tuition fee it was worked out on,
 * and, per student, the fee GSP has invoiced so far. All read from the engine's result and the same pricing rule the
 * lines use (pricing.ts periodsOf): nothing typed.
 */
import type { Application } from '../../data/applications';
import { agreementOn, startOf, termsAt, type Result, type Tx } from './engine';
import { periodsOf } from './pricing';
import { roundMoney, type CommState, type Enrolment, type TermsBody, type UniTerms } from './model';
import { ctxOf } from './store';

/** The terms that priced a line, by name: a notice, an agreement (or the RP's own flat share), or the university's terms. */
export function termsApplied(t: Tx, s: CommState, res: Result): string {
  const a = res.byApp.get(t.app);
  if (t.side === 'uni') return a?.terms ?? 'University terms';
  if (t.notice) return s.notices.find((n) => n.id === t.notice)?.name ?? t.notice;
  const rpTerms = a?.summary.rpTerms ?? '';
  if (rpTerms.startsWith('Notice: ')) return rpTerms.slice('Notice: '.length);
  const rec = s.records.find((r) => r.rp === t.rp);
  if (rec?.ownFlat != null) return 'Own flat share';
  return (a && agreementOn(s, t.rp, a.enrolled)?.name) || rpTerms.split(',')[0] || '—';
}

/** Every name `termsApplied` can give an RP line, from the store: agreements, notices and the own flat share. */
export const appliedOptions = (s: CommState) => [...s.agreements.map((a) => a.name), ...s.notices.map((n) => n.name), ...(s.records.some((r) => r.ownFlat != null) ? ['Own flat share'] : [])];

/**
 * The tuition fee each line was worked out on: a study period's fee (net or gross as the terms say, × its chargeable
 * part), from the application's fees; a GSP → RP line takes its university line's. Lines with no study period (bonuses,
 * fixed amounts) have none.
 */
export function lineFees(res: Result, s: CommState, apps: Pick<Application, 'id' | 'fees' | 'courseId'>[] = []): Map<string, number> {
  const out = new Map<string, number>();
  const ctx = ctxOf();
  for (const a of res.apps) {
    const ap = apps.find((x) => x.id === a.app);
    const en = s.enrolments.find((e) => e.app === a.app);
    const fees = ap?.fees ?? en?.fees;
    const courseId = ap?.courseId ?? en?.course ?? '';
    const c = ctx.course(courseId);
    const tr = s.terms.find((x) => x.uni === a.uni);
    if (!fees?.start || !c || !tr) continue;
    const e: Enrolment = { app: a.app, student: a.student, rp: a.rp, course: courseId, intake: a.intake, enrolled: a.enrolled, fees };
    const T = termsAt<TermsBody>(tr as UniTerms, startOf(e));
    const per = new Map(periodsOf(T, e, c.months, s.settings).periods.map((p) => [p.k, roundMoney(p.fee * p.frac)]));
    const uniLines = res.txs.filter((t) => t.app === a.app && t.side === 'uni' && t.period && t.type === 'Course commission');
    uniLines.forEach((t) => per.has(t.period!) && out.set(t.id, per.get(t.period!)!));
    res.txs.filter((t) => t.app === a.app && t.side === 'rp' && t.matches && out.has(t.matches)).forEach((t) => out.set(t.id, out.get(t.matches!)!));
  }
  return out;
}

/** Per student: the tuition fee of the study periods GSP has invoiced the university for so far. */
export function feeInvoiced(res: Result, fees: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  res.txs.filter((t) => t.side === 'uni' && t.invoice && !t.credited && fees.has(t.id)).forEach((t) => out.set(t.app, roundMoney((out.get(t.app) ?? 0) + fees.get(t.id)!)));
  return out;
}
