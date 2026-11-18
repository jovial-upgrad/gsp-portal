import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Field, SelectInput, TextInput } from '../components/forms';
import { PageHead } from '../institution/records/parts';
import { MultiPick } from '../components/MultiPick';
import { RP_STATUSES } from '../institution/data/records';
import type { InsightSettings } from './metrics';
import { Card } from './parts';

const nums = (t: string) => t.split(/[,\s]+/).filter(Boolean).map(Number);
const okNums = (t: string, min = 0) => nums(t).length > 0 && nums(t).every((x, i, l) => Number.isFinite(x) && x >= min && (!i || x > l[i - 1]));

/**
 * Admin › Dashboards › Settings (Jovial, 18 Nov): what every dashboard counts with: idle days, age buckets, the
 * financial year, the incentive and thresholds. Jovial, 18 Nov (later): no Stages (the lifecycle's names are used), no
 * Outcomes (Drop = closed; a rejection is marked on Admin's Closing reasons), no deposit deadlines (each course
 * intake has its own), and the incentive currency is picked from Currency exchange.
 */
export function DashSettings({ s, set, me, say, currencies }: { s: InsightSettings; set: (s: InsightSettings) => void; me: string; say: (t: string) => void; currencies: string[] }) {
  const [v, setV] = useState(() => draft(s));
  const [tried, setTried] = useState(false);
  useEffect(() => setV(draft(s)), [s]);
  const put = <K extends keyof ReturnType<typeof draft>>(k: K) => (x: ReturnType<typeof draft>[K]) => setV({ ...v, [k]: x });
  const err = {
    idle: !(+v.idleDays >= 1) ? 'At least 1 day.' : null,
    steps: !okNums(v.idleSteps, 1) ? 'Whole days, smallest first, like 3, 5, 7.' : null,
    age: !okNums(v.ageBuckets) || nums(v.ageBuckets)[0] !== 0 ? 'Start at 0, then each bucket’s first day, like 0, 3, 6, 11.' : null,
    ar: !okNums(v.arBuckets, 1) ? 'Days, smallest first, like 30, 60, 90.' : null,
    dl: !okNums(v.deadlineWindows, 1) ? 'Days, smallest first, like 7, 15, 30.' : null,
    amt: !(+v.amount >= 0) ? 'A number.' : null,
    prio: !(+v.priorityTarget >= 0 && +v.priorityTarget <= 100) ? '0 to 100.' : null,
    months: !(+v.analysisMonths >= 1) || !(+v.forecastMonths >= 1) ? 'At least 1 month.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    set({
      ...s,
      idleDays: +v.idleDays,
      idleSteps: nums(v.idleSteps),
      ageBuckets: nums(v.ageBuckets),
      arBuckets: nums(v.arBuckets),
      deadlineWindows: nums(v.deadlineWindows),
      fyStartMonth: +v.fyStartMonth,
      incentive: { ...s.incentive, amount: +v.amount, currency: v.currency.trim() || s.incentive.currency, milestone: v.milestone },
      priorityTarget: +v.priorityTarget,
      analysisMonths: +v.analysisMonths,
      marginPerStudent: +v.marginPerStudent,
      bigRpEnrolments: +v.bigRpEnrolments,
      forecastMonths: +v.forecastMonths,
      registeredStatuses: v.registered,
    });
    say(`Dashboard settings saved by ${me}.`);
  };
  const months = Array.from({ length: 12 }, (_, i) => [String(i + 1), new Date(2026, i, 1).toLocaleDateString('en-GB', { month: 'long' })] as [string, string]);
  return (
    <div className="ins">
      <PageHead title="Dashboard settings" lead="What every dashboard counts with. A change shows on every dashboard at once.">
        <Button onClick={save}>Save settings</Button>
      </PageHead>
      <Card title="Waiting and ageing">
        <div className="iform__grid">
          <Field id="ds-idle" label="Idle after (days)" required error={show('idle')} hint="No status change for this long counts as idle.">
            <TextInput id="ds-idle" inputMode="numeric" value={v.idleDays} onChange={(e) => put('idleDays')(e.target.value)} />
          </Field>
          <Field id="ds-steps" label="Idle filter steps (days)" required error={show('steps')}>
            <TextInput id="ds-steps" value={v.idleSteps} onChange={(e) => put('idleSteps')(e.target.value)} />
          </Field>
          <Field id="ds-age" label="Age buckets (first day of each)" required error={show('age')}>
            <TextInput id="ds-age" value={v.ageBuckets} onChange={(e) => put('ageBuckets')(e.target.value)} />
          </Field>
          <Field id="ds-ar" label="Receivables buckets (days past due)" required error={show('ar')}>
            <TextInput id="ds-ar" value={v.arBuckets} onChange={(e) => put('arBuckets')(e.target.value)} />
          </Field>
          <Field id="ds-dl" label="Deadline report windows (days)" required error={show('dl')}>
            <TextInput id="ds-dl" value={v.deadlineWindows} onChange={(e) => put('deadlineWindows')(e.target.value)} />
          </Field>
        </div>
      </Card>
      <Card title="Periods, targets and incentives">
        <div className="iform__grid">
          <Field id="ds-fy" label="Financial year starts in">
            <SelectInput id="ds-fy" value={v.fyStartMonth} onChange={(e) => put('fyStartMonth')(e.target.value)}>
              {months.map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="ds-prio" label="Priority IP share target (%)" required error={show('prio')}>
            <TextInput id="ds-prio" inputMode="numeric" value={v.priorityTarget} onChange={(e) => put('priorityTarget')(e.target.value)} />
          </Field>
          <Field id="ds-amt" label="Incentive per admission (default)" required error={show('amt')} hint="Potential to earn starts from it; the page can try other amounts.">
            <TextInput id="ds-amt" inputMode="numeric" value={v.amount} onChange={(e) => put('amount')(e.target.value)} />
          </Field>
          <Field id="ds-cur" label="Incentive currency">
            <SelectInput id="ds-cur" value={v.currency} onChange={(e) => put('currency')(e.target.value)}>
              {[...new Set([v.currency, ...currencies])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="ds-adm" label="An admission is">
            <SelectInput id="ds-adm" value={v.milestone} onChange={(e) => put('milestone')(e.target.value)}>
              {s.milestones.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="ds-win" label="IP / RP analysis window (months)" required error={show('months')}>
            <TextInput id="ds-win" inputMode="numeric" value={v.analysisMonths} onChange={(e) => put('analysisMonths')(e.target.value)} />
          </Field>
          <Field id="ds-mps" label="Good margin per student (AUD)">
            <TextInput id="ds-mps" inputMode="numeric" value={v.marginPerStudent} onChange={(e) => put('marginPerStudent')(e.target.value)} />
          </Field>
          <Field id="ds-big" label="A big RP gives at least (enrolments a year)">
            <TextInput id="ds-big" inputMode="numeric" value={v.bigRpEnrolments} onChange={(e) => put('bigRpEnrolments')(e.target.value)} />
          </Field>
          <Field id="ds-reg" label="Registered RPs: record statuses" className="iform__wide" hint="Active RPs (Leadership pack) counts RPs in these statuses.">
            <MultiPick id="ds-reg" label="Registered statuses" value={v.registered} options={[...RP_STATUSES]} onChange={put('registered')} empty="None" />
          </Field>
          <Field id="ds-fc" label="Forecast learns from the last (months)" required error={show('months')}>
            <TextInput id="ds-fc" inputMode="numeric" value={v.forecastMonths} onChange={(e) => put('forecastMonths')(e.target.value)} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
function draft(s: InsightSettings) {
  return {
    idleDays: String(s.idleDays),
    idleSteps: s.idleSteps.join(', '),
    ageBuckets: s.ageBuckets.join(', '),
    arBuckets: s.arBuckets.join(', '),
    deadlineWindows: s.deadlineWindows.join(', '),
    fyStartMonth: String(s.fyStartMonth),
    amount: String(s.incentive.amount),
    currency: s.incentive.currency,
    milestone: s.incentive.milestone,
    priorityTarget: String(s.priorityTarget),
    analysisMonths: String(s.analysisMonths),
    marginPerStudent: String(s.marginPerStudent),
    bigRpEnrolments: String(s.bigRpEnrolments),
    forecastMonths: String(s.forecastMonths),
    registered: [...s.registeredStatuses],
  };
}
