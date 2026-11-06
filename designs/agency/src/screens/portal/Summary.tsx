import { motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from '../../components/Icon';
import { STAGES, clock, courseOf, isOpen, needsYou, stageOf, statusText, type Application } from '../../data/applications';
import { fullName, sampleStudents, type Student } from '../../data/students';
import type { Section } from './model';

const ease = [0.2, 0.8, 0.2, 1] as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Home once everything is open (Nesil, 4 Nov: "a summary of the information we have, a quick snapshot of the
 * important things"). In order: what needs the agency now; the numbers at a glance (each one opens its page);
 * applications by stage, as one bar; then the shortcuts to start something. The GSP contact sits beside it
 * (4 Nov: no "Latest from universities" any more).
 */
export function Summary({
  apps,
  students,
  go,
  onOpenApp,
}: {
  apps: Application[];
  students: Student[];
  go: (k: Section) => void;
  onOpenApp: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const open = apps.filter(isOpen);
  const mine = open.filter(needsYou).sort((a, b) => Number(clock(b).late) - Number(clock(a).late) || a.since - b.since);
  const offers = open.filter((a) => stageOf(a) >= 3 && stageOf(a) <= 5).length;
  const enrolled = apps.filter((a) => a.status === 'enrolled').length;
  // an application shared from GSP's side can name a student the agency's list doesn't have yet: the sample pool knows them
  const pool = sampleStudents('');
  const nameOf = (id: string) => {
    const s = students.find((x) => x.id === id) ?? pool.find((x) => x.id === id);
    return s ? fullName(s) : 'Student removed';
  };
  const byStage = STAGES.map((st, i) => ({ st, n: open.filter((a) => stageOf(a) === i).length }));
  const rise = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease, delay: 0.08 + i * 0.06 } });

  return (
    <div className="hsum">
      <motion.ul className="hsum__kpis" aria-label="At a glance" {...rise(0)}>
        <Kpi icon="alert" tone="you" n={mine.length} label="Pending on you" note={mine.length ? 'Applications waiting for you' : 'Nothing waiting'} onClick={() => go('applications')} />
        <Kpi icon="doc" n={open.length} label="Applications in progress" note={enrolled ? `${enrolled} enrolled so far` : 'With you, GSP or the university'} onClick={() => go('applications')} />
        <Kpi icon="award" n={offers} label="Offers" note="Offer, verification or acceptance" onClick={() => go('applications')} />
        <Kpi icon="people" n={students.length} label="Students" note={students.length ? `${plural(new Set(apps.map((a) => a.studentId)).size, 'student')} applying` : 'Add your first student'} onClick={() => go('students')} />
      </motion.ul>

      {/* 4 Nov (later): only when something is waiting for the agency */}
      {mine.length > 0 && (
      <motion.section className="card hsum__card" aria-labelledby="hs-you" {...rise(1)}>
        <div className="hsum__head">
          <h2 id="hs-you" className="hsum__title">
            Needs you now
          </h2>
          <button type="button" className="btn btn--link" onClick={() => go('applications')}>
            See all {mine.length}
          </button>
        </div>
          <ul className="hsum__todo">
            {mine.slice(0, 4).map((a) => {
              const c = courseOf(a);
              const late = clock(a).late;
              return (
                <li key={a.id}>
                  {/* 4 Nov (later): the name lines up with the heading, its status a tag on the same line on the right,
                      the course the full width under it, the arrow under See all */}
                  <button type="button" className="hsum__row" onClick={() => onOpenApp(a.id)}>
                    <span className="hsum__who">{nameOf(a.studentId)}</span>
                    <span className="hsum__tags">
                      {late && <span className="hsum__late">Taking longer than usual</span>}
                      <span className="who who--you">{statusText(a)}</span>
                    </span>
                    <span className="hsum__what">
                      {c.name} · {c.uni.name}
                    </span>
                    <Icon name="arrowRight" size={18} className="hsum__go" />
                  </button>
                </li>
              );
            })}
          </ul>
      </motion.section>
      )}

      {open.length > 0 && (
        <motion.section className="card hsum__card" aria-labelledby="hs-stage" {...rise(2)}>
          <div className="hsum__head">
            <h2 id="hs-stage" className="hsum__title">
              Applications by stage
            </h2>
            <span className="hsum__meta num">{plural(open.length, 'application')} in progress</span>
          </div>
          <div className="hsum__bar" role="img" aria-label={byStage.filter((s) => s.n).map((s) => `${s.st}: ${s.n}`).join(', ')}>
            {byStage.map((s, i) =>
              s.n ? (
                <motion.span
                  key={s.st}
                  className={`hsum__seg hsum__seg--${i}`}
                  style={{ flexGrow: s.n }}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, ease, delay: 0.2 + i * 0.04 }}
                />
              ) : null,
            )}
          </div>
          <ul className="hsum__legend">
            {byStage.map((s, i) => (
              <li key={s.st} className={s.n ? '' : 'is-zero'}>
                <span className={`hsum__key hsum__seg--${i}`} aria-hidden="true" />
                {s.st} <span className="num">{s.n}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <motion.section className="hsum__start" aria-labelledby="hs-start" {...rise(3)}>
        <h2 id="hs-start" className="hsum__title">
          Start something
        </h2>
        <ul className="stiles">
          <Start icon="people" title="Add a student" text="Fill their details once and reuse them for every application." onClick={() => go('students')} />
          <Start icon="search" title="Find a course" text="Search by subject, country and intake, with entry requirements." onClick={() => go('courses')} />
          <Start icon="doc" title="Start an application" text="Pick a student and a course, and GSP takes it from there." onClick={() => go('applications')} />
        </ul>
      </motion.section>
    </div>
  );
}

function Kpi({ icon, n, label, note, tone, onClick }: { icon: IconName; n: number; label: string; note: string; tone?: 'you'; onClick: () => void }) {
  return (
    <li>
      <button type="button" className={`hkpi ${tone === 'you' && n > 0 ? 'is-you' : ''}`} onClick={onClick}>
        <span className="hkpi__icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <span className="hkpi__n num">{n}</span>
        <span className="hkpi__label">{label}</span>
        <span className="hkpi__note">{note}</span>
      </button>
    </li>
  );
}

function Start({ icon, title, text, onClick }: { icon: IconName; title: string; text: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="stile" onClick={onClick}>
        <span className="stile__icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className="stile__title">{title}</span>
        <span className="stile__text">{text}</span>
        <Icon name="arrowRight" size={18} className="stile__go" />
      </button>
    </li>
  );
}
