import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Checkbox } from '../../../components/forms';
import { Icon } from '../../../components/Icon';
import type { Student, Work as Job } from '../../../data/students';
import { parseMonth, typeMonth } from '../../../data/dates';
import { ReadBox, ReadNote, filledAt, filledText, readMs } from '../ReadBox';
import { Txt, type Update } from './fields';
import { fillFromResume, saveResume } from './read';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** Months between two months, counting both. */
const monthsOf = (j: Job) => {
  const a = parseMonth(j.from);
  const b = j.current ? new Date() : parseMonth(j.to);
  return a && b && b >= a ? (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1 : 0;
};
const span = (m: number) => {
  const y = Math.floor(m / 12);
  const r = m % 12;
  return [y && `${y} ${y === 1 ? 'year' : 'years'}`, r && `${r} ${r === 1 ? 'month' : 'months'}`].filter(Boolean).join(' ') || 'Less than a month';
};

/**
 * Work experience: optional. The first time, before there's a CV or a job, uploading the resume reads its jobs in
 * (and keeps it as the CV in Documents); "Add job" at the top of the section adds one by hand. Any number of jobs,
 * with the time worked added up.
 */
export function Work({ s, update }: { s: Student; update: Update }) {
  const reduce = useReducedMotion();
  const [reading, setReading] = useState(false);
  const total = s.work.reduce((n, j) => n + monthsOf(j), 0);
  const readFile = (file: File) => {
    setReading(true);
    update((p) => saveResume(p, file.name));
    window.setTimeout(() => {
      update((p) => fillFromResume(p));
      setReading(false);
    }, readMs(reduce));
  };
  const setJob = (id: string, patch: Partial<Job>) =>
    update((p) => ({ ...p, work: p.work.map((j) => (j.id === id ? { ...j, ...patch } : j)), read: p.read.filter((k) => !Object.keys(patch).some((f) => k === `work.${id}.${f}`)) }));
  const read = (id: string, f: keyof Job) => (s.read.includes(`work.${id}.${f}`) ? 'resume' : null);
  // autofill is one-time (1 Nov): once the resume filled this in, jobs are corrected or added by hand
  const filled = filledAt(s, 'cv');
  const remove = (id: string) => update((p) => ({ ...p, work: p.work.filter((j) => j.id !== id) }));

  return (
    <div className="rsec">
      {reading || (!filled && !s.docs.cv && s.work.length === 0) ? (
        <ReadBox
          id="rw-file"
          title="Fill this in from the resume"
          text="Upload the student’s resume or CV and we add the jobs on it for you to check. It’s kept as their CV in Documents."
          button="Upload resume"
          file={s.docs.cv?.file}
          reading={reading}
          onFile={readFile}
        />
      ) : (
        filled && <ReadNote text={filledText('resume', filled)} />
      )}
      {s.work.length > 0 && total > 0 && (
        <p className="rtotal">
          <Icon name="clock" size={16} />
          <span>
            <strong>{span(total)}</strong> of work experience in all
          </span>
        </p>
      )}
      {s.work.map((j, i) => {
        const from = parseMonth(j.from);
        const to = parseMonth(j.to);
        const id = (f: string) => `rw-${j.id}-${f}`;
        return (
          <motion.section key={j.id} className="card rlevel" aria-label={`Job ${i + 1}`} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }}>
            <header className="rlevel__head">
              <h3 className="rlevel__title">{j.org.trim() || `Job ${i + 1}`}</h3>
              {monthsOf(j) > 0 && <span className="rlevel__state is-plain">{span(monthsOf(j))}</span>}
              <button type="button" className="icon-btn rlevel__remove" aria-label={`Remove ${j.org.trim() || `job ${i + 1}`}`} title="Remove" onClick={() => remove(j.id)}>
                <Icon name="close" size={16} />
              </button>
            </header>
            <div className="grid2">
              <Txt id={id('org')} label="Organisation" value={j.org} read={read(j.id, 'org')} onChange={(v) => setJob(j.id, { org: v })} />
              <Txt id={id('role')} label="Role" value={j.role} read={read(j.id, 'role')} onChange={(v) => setJob(j.id, { role: v })} />
              <Txt id={id('from')} label="From" value={j.from} read={read(j.id, 'from')} placeholder="MM/YYYY" inputMode="numeric" format={typeMonth} onChange={(v) => setJob(j.id, { from: v })} error={j.from && !from ? 'Enter the month as MM/YYYY, like 08/2022.' : null} />
              <Txt
                id={id('to')}
                label="To"
                value={j.current ? '' : j.to}
                read={j.current ? null : read(j.id, 'to')}
                placeholder={j.current ? 'Now' : 'MM/YYYY'}
                inputMode="numeric"
                disabled={j.current}
                format={typeMonth}
                onChange={(v) => setJob(j.id, { to: v })}
                error={j.to && !to ? 'Enter the month as MM/YYYY, like 06/2024.' : from && to && to < from ? 'This is before the start.' : null}
              />
            </div>
            <Checkbox id={id('current')} checked={j.current} onChange={(v) => setJob(j.id, { current: v, to: v ? '' : j.to })}>
              Currently working here
            </Checkbox>
          </motion.section>
        );
      })}
      {s.work.length === 0 && (
        <div className="rempty">
          <p className="rempty__title">No work experience added</p>
          <p className="rempty__text">Upload a resume above, or use Add job at the top.</p>
        </div>
      )}
    </div>
  );
}
