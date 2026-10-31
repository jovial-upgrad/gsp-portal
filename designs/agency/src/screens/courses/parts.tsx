import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { intakeState, type Campus, type Intake, type University } from '../../data/courses';

/** An intake: its month, and "closed" once it's closed. No countdown or "likely" on the card (Nesil, 27 Oct); the course page has the dates. */
export function IntakePill({ i }: { i: Intake }) {
  const closed = intakeState(i) === 'closed';
  return (
    <span className={`ipill ${closed ? 'ipill--closed' : 'ipill--open'}`}>
      {i.month}
      {closed && <span className="ipill__note"> · closed</span>}
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

/** A part of the course dialog on its own card: an icon chip, a title, and on the right a line on whom it's for. */
export function Box({ id, icon, title, meta, children }: { id: string; icon: IconName; title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="cbox" aria-labelledby={id}>
      <header className="cbox__head">
        <span className="cbox__icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <h3 id={id} className="cbox__title">
          {title}
        </h3>
        {meta && <span className="cbox__meta">{meta}</span>}
      </header>
      <div className="cbox__body">{children}</div>
    </section>
  );
}

/** A labelled figure on a tile: an English score, an entry requirement, a university fact. */
export function Tile({ k, v, sub }: { k: string; v: ReactNode; sub?: string }) {
  return (
    <div className="cm-tile">
      <dt>{k}</dt>
      <dd className="cm-tile__v">{v}</dd>
      {sub && <dd className="cm-tile__sub">{sub}</dd>}
    </div>
  );
}
