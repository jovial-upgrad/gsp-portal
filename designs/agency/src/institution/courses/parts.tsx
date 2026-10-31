import { daysTo, intakeState, type Campus, type Intake, type University } from '../../data/courses';

/** An intake with its status in words: open and closing in N days, likely open, or closed. */
export function IntakePill({ i }: { i: Intake }) {
  const st = intakeState(i);
  const d = daysTo(i.deadline);
  return (
    <span className={`ipill ipill--${st} ${st === 'open' && d <= 21 ? 'is-soon' : ''}`}>
      {i.month}
      <span className="ipill__note">{st === 'open' ? (d <= 45 ? ` · closes in ${d} ${d === 1 ? 'day' : 'days'}` : ' · open') : st === 'likely' ? ' · likely' : ' · closed'}</span>
    </span>
  );
}

export const duration = (m: number) => (m % 12 === 0 ? `${m / 12} ${m === 12 ? 'year' : 'years'}` : `${m} months`);

/** The university's emblem on a white plate (like a favicon), or its initials when we don't have a logo. */
export function UniMark({ u, big = false }: { u: University; big?: boolean }) {
  if (u.mark)
    return (
      <span className={`umark umark--logo ${big ? 'umark--big' : ''}`} aria-hidden="true">
        <img src={u.mark} alt="" />
      </span>
    );
  const w = u.name.replace(/University of |University|College|The /g, '').trim().split(/\s+/);
  return (
    <span className={`umark ${big ? 'umark--big' : ''}`} aria-hidden="true">
      {(w[0][0] + (w[1]?.[0] ?? w[0][1] ?? '')).toUpperCase()}
    </span>
  );
}

/** The full logo on a white plate, so it reads the same in dark mode. Falls back to the emblem or initials. */
export function UniLogo({ u }: { u: University }) {
  if (!u.logo) return <UniMark u={u} big />;
  return (
    <span className="ulogo">
      <img src={u.logo} alt={`${u.name} logo`} />
    </span>
  );
}

/** "Bruce, Canberra", or just "Dublin" when the campus is named after its city. */
export const campusLabel = (c: Campus) => (c.name === c.city ? c.city : `${c.name}, ${c.city}`);
