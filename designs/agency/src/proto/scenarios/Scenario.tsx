/**
 * Commission scenarios (Jovial, 12 Nov): so Deepesh can watch the rules run. The Prototype panel loads one of the
 * sandbox's cases (cases.ts) as its own world: its university terms, RP agreements, notices, groups, students and what
 * was invoiced and paid become the commission store's records, and the prototype's engine works out every line from
 * them, for Finance's Commission lines and the RP's Earnings alike. The clock moves the date on so lines fall due.
 * The case's checks (worked out by hand in the sandbox) show beside the engine's answers. Prototype only.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Icon } from '../../components/Icon';
import { clockOn, dateText, setClock, subscribeClock } from '../../institution/data/records';
import { enterWorld, leaveWorld, setEarnAs, useWorld, type World } from '../../finance/commission/store';
import type { Role } from '../roles';
import { SCENARIOS, caseWorld, runChecks, skipOf } from './run';
import './scenario.css';

type Case = (typeof SCENARIOS)[number];
const caseOf = (id: string): Case | undefined => SCENARIOS.find((c: Case) => c.id === id);
const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const plusMonths = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 10);
};
const show = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? JSON.stringify(v) : String(v));

/** Loads a case's world into the stores (its records only: the engine works out the rest), on the case's own date. */
export function openScenario(id: string) {
  const c = caseOf(id);
  if (!c) return closeScenario();
  const { state, ctx } = caseWorld(c);
  const courses = new Map(state.enrolments.map((e: { course: string }) => [e.course, ctx.course(e.course)]));
  const w: World = { id: c.id, unis: ctx.unis, rps: ctx.rps, courses };
  setClock(c.today);
  enterWorld(state, w);
  // the RP on the case's focus student, else its first RP: whose Earnings RP Admin sees
  const focus = c.apps[c.focus];
  setEarnAs(focus?.rp ?? ctx.rps[0]?.id ?? '');
}
export function closeScenario() {
  setClock(null);
  setEarnAs('');
  leaveWorld();
}

/** The Prototype panel's picker. */
export function ScenarioPick() {
  const w = useWorld();
  const groups = useMemo(() => {
    const by = new Map<string, Case[]>();
    SCENARIOS.forEach((c: Case) => by.set(c.tab, [...(by.get(c.tab) ?? []), c]));
    return [...by.entries()];
  }, []);
  const label: Record<string, string> = { IP: 'University terms', RP: 'RP terms', Combination: 'Combinations' };
  return (
    <>
      <p className="proto__label" id="proto-scen">
        Commission scenario
      </p>
      <p className="proto__note">One of the sandbox’s cases as its own world: its terms, RPs, notices and students, worked out by the prototype’s engine.</p>
      <select className="proto__select" aria-labelledby="proto-scen" value={w?.id ?? ''} onChange={(e) => (e.target.value ? openScenario(e.target.value) : closeScenario())}>
        <option value="">None: the prototype’s own data</option>
        {groups.map(([tab, list]) => (
          <optgroup key={tab} label={label[tab] ?? tab}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.title.trim()}
                {skipOf(c) ? ' (not in this release)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </>
  );
}

/** The bar on screen while a scenario is open: what it sets up, its date and clock, the checks, and where to look. */
export function ScenarioBar({ role, onRole }: { role: Role; onRole: (r: Role) => void }) {
  const w = useWorld();
  const today = useSyncExternalStore(subscribeClock, clockOn, clockOn);
  const [open, setOpen] = useState(false);
  const c = w ? caseOf(w.id) : undefined;
  const res = useMemo(() => (c ? runChecks(c) : null), [c]);
  if (!c || !today || !res) return null;
  const done = res.checks.filter((k: { skip?: string }) => !k.skip);
  const ok = done.filter((k: { ok?: boolean }) => k.ok).length;
  const rpName = w!.rps.find((r) => r.id === (c.apps[c.focus]?.rp ?? w!.rps[0]?.id))?.name;
  return (
    <section className={`scen ${open ? 'is-open' : ''}`} aria-label="Commission scenario">
      <div className="scen__head">
        <div className="scen__t">
          <p className="scen__kicker">
            Scenario {c.id} · {c.sheetNo ?? c.tab}
          </p>
          <p className="scen__title">{c.title.trim()}</p>
        </div>
        <button type="button" className="scen__icon" aria-expanded={open} aria-label={open ? 'Fold the scenario' : 'Open the scenario'} onClick={() => setOpen(!open)}>
          <Icon name="chevronDown" size={18} />
        </button>
        <button type="button" className="scen__icon" aria-label="Leave the scenario" onClick={closeScenario}>
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="scen__clock" role="group" aria-label="Date">
        <span className="scen__date">
          <Icon name="calendar" size={16} /> {dateText(today)}
        </span>
        <button type="button" onClick={() => setClock(plusMonths(today, -1))}>−1 month</button>
        <button type="button" onClick={() => setClock(plusDays(today, 7))}>+1 week</button>
        <button type="button" onClick={() => setClock(plusMonths(today, 1))}>+1 month</button>
        {today !== c.today && (
          <button type="button" onClick={() => setClock(c.today)}>
            Case date
          </button>
        )}
      </div>

      <div className="scen__go" role="group" aria-label="Look at it as">
        <button type="button" aria-pressed={role === 'gsp-finance'} onClick={() => onRole('gsp-finance')}>
          GSP · Finance <span>Commission lines, Setup</span>
        </button>
        <button type="button" aria-pressed={role === 'rp-admin'} onClick={() => onRole('rp-admin')}>
          RP Admin <span>Earnings{rpName ? `, as ${rpName}` : ''}</span>
        </button>
      </div>


      <button type="button" className="scen__more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide what it sets up and the checks' : `What it sets up, and the checks: ${res.skipped ? 'not in this release' : `${ok} of ${done.length} match`}`}
      </button>

      {open && (
        <div className="scen__body">
          {res.skipped ? (
            <p className="scen__skip">Not in this release: {res.skipped}</p>
          ) : null}
          {c.sheet && <p className="scen__sheet">{c.sheet}</p>}
          {c.terms?.length ? (
            <>
              <p className="scen__h">Set up in this world</p>
              <ul className="scen__list">
                {c.terms.map((t: string) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          ) : null}

          {!res.skipped && (
            <>
              <p className="scen__h">
                Checks on {dateText(c.today)}: {ok} of {done.length} match{res.checks.length > done.length ? `, ${res.checks.length - done.length} not in this release` : ''}
              </p>
              <ul className="scen__checks">
                {res.checks.map((k: { what: string; exp: unknown; got?: unknown; ok?: boolean; skip?: string; calc?: string; today?: string }, i: number) => (
                  <li key={i} className={k.skip ? 'is-skip' : k.ok ? 'is-ok' : 'is-bad'}>
                    <span className="scen__mark" aria-hidden="true">
                      {k.skip ? '–' : k.ok ? <Icon name="check" size={14} strokeWidth={2.4} /> : '!'}
                    </span>
                    <span>
                      <b>{k.what}</b>
                      {k.today ? ` (on ${dateText(k.today)})` : ''}
                      <br />
                      {k.skip ? (
                        <span className="scen__soft">{k.skip}</span>
                      ) : (
                        <span className="scen__soft">
                          By hand: {show(k.exp)}
                          {k.calc ? ` (${k.calc})` : ''} · Engine: {show(k.got)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
