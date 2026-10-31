import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Icon } from '../../components/Icon';
import { SelectInput } from '../../components/forms';
import { ANYONE, TASK_TYPES, tasksFor, type Task } from '../data/queue';
import { waitedText } from '../data/records';
import { Pill, Tiles } from './parts';
import type { PageProps } from '../portal/model';

const ease = [0.2, 0.8, 0.2, 1] as const;
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/**
 * The Institution Team's Home (29 Oct; 2nd round, after the PM prototype's My queues): the team's queue. Every task
 * waiting on it, made from the records as they stand (agreements to renew, universities to get
 * live, draft courses), oldest first. A task leaves the queue when it's done.
 */
export function TeamHome({ first, db, open, me }: Pick<PageProps, 'db' | 'open' | 'me'> & { first: string }) {
  const reduce = useReducedMotion();
  const tasks = useMemo(() => tasksFor(db.ips, db.unis, db.courses), [db]);
  const [tile, setTile] = useState<'open' | 'late' | 'mine' | ''>('');
  const [type, setType] = useState('');
  const [mine, setMine] = useState(false);
  const isMine = (t: Task) => t.who === me;
  const rows = tasks.filter((t) => {
    if (tile === 'late' && !t.late) return false;
    if ((tile === 'mine' || mine) && !isMine(t)) return false;
    if (type && t.type !== type) return false;
    return true;
  });
  const mineN = tasks.filter(isMine);
  const go = (t: Task) => open({ ...t.open, back: undefined });

  return (
    <div className="ipage ihome">
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">
            {greeting()}, {first}
          </h1>
          <p className="stu__lead">Every task waiting on the Institution Team. Do the oldest first; a task leaves the queue when it’s done.</p>
        </div>
      </header>

      <Tiles
        label="The queue"
        value={tile}
        onPick={(k) => {
          setTile(k);
          if (k !== 'mine') setMine(false);
        }}
        items={[
          { key: 'open', label: 'Open tasks', sub: 'For the Institution Team', tone: 'gsp', n: tasks.length },
          { key: 'late', label: 'Late', sub: 'Waiting longer than usual', tone: 'bad', n: tasks.filter((t) => t.late).length },
          { key: 'mine', label: 'Yours', sub: `${mineN.filter((t) => t.late).length} late`, tone: 'you', n: mineN.length },
        ]}
      />

      <motion.section className="card stable" aria-labelledby="iq-count" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: 0.08 }}>
        <div className="stools">
          <div className="stools__row">
            <SelectInput id="iq-type" aria-label="Task type" value={type} placeholder="All tasks" allowEmpty onChange={(e) => setType(e.target.value)}>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
            <div className="iseg" role="group" aria-label="Whose tasks">
              <button type="button" className="ichip" aria-pressed={!mine && tile !== 'mine'} onClick={() => (setMine(false), tile === 'mine' && setTile(''))}>
                Everyone
              </button>
              <button type="button" className="ichip" aria-pressed={mine || tile === 'mine'} onClick={() => setMine(true)}>
                Yours
              </button>
            </div>
          </div>
          <p className="stools__count" id="iq-count" role="status">
            <span>
              <span className="num">{rows.length === tasks.length ? tasks.length : `${rows.length} of ${tasks.length}`}</span> {tasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="snone">
            <p className="snone__title">{tasks.length ? 'Nothing here' : 'Nothing waiting'}</p>
            <p className="snone__text">{tasks.length ? 'No tasks match. Try all tasks, or everyone’s.' : 'Every record is up to date.'}</p>
          </div>
        ) : (
          <div className="stab-wrap">
            <table className="itab itab--queue">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">For</th>
                  <th scope="col">Assigned to</th>
                  <th scope="col">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="irow" onClick={() => go(t)}>
                    <td>
                      <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), go(t))}>
                        {t.type}
                      </button>
                      <span className="irow__sub">{t.sub}</span>
                    </td>
                    <td>{t.item}</td>
                    <td>{t.who === me ? 'You' : t.who === ANYONE ? <span className="muted">Anyone in the team</span> : t.who}</td>
                    <td>
                      <span className="iwait">
                        <span className="num">{waitedText(t.since)}</span>
                        {t.late && <Pill tone="bad">Late</Pill>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>
      <p className="ihome__foot">
        <Icon name="info" size={16} /> Tasks come from the records themselves: add the renewal, get the university live or publish the draft, and the task goes.
      </p>
    </div>
  );
}
