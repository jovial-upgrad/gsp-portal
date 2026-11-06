import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { MultiPick } from '../../components/MultiPick';
import { Pill, Tiles, type Tone } from '../../institution/records/parts';
import { regionOf, type OpsRp } from './data';
import { tasksOf, waited, type OpsTask, type TaskKind } from './queue';
import type { OpsTarget } from './parts';

const ease = [0.2, 0.8, 0.2, 1] as const;
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const TILES: { key: TaskKind; label: string; tone: Tone }[] = [
  { key: 'verify', label: 'Documents to verify', tone: 'gsp' },
  { key: 'send', label: 'Agreements to send', tone: 'uni' },
  { key: 'check', label: 'Signed copies to check', tone: 'ok' },
  { key: 'rp', label: 'Waiting on the RP', tone: 'grey' },
  { key: 'new', label: 'Not activated', tone: 'you' },
];

/**
 * RP Ops' Home (Nesil, 4 Nov, later), in the style of GSP · Institution's: its queue, oldest first. The tiles count
 * each kind and filter to it; Sales region and BDM narrow it. A row opens the partner where it's done.
 */
export function OpsHome({ first, rps, open }: { first: string; rps: OpsRp[]; open: (t: OpsTarget) => void }) {
  const reduce = useReducedMotion();
  const tasks = useMemo(() => tasksOf(rps), [rps]);
  const [kind, setKind] = useState<TaskKind | ''>('');
  const [regions, setRegions] = useState<string[]>([]);
  const [bdms, setBdms] = useState<string[]>([]);
  const rows = tasks.filter((t) => (!kind || t.kind === kind) && (!regions.length || regions.includes(regionOf(t.rp.country))) && (!bdms.length || bdms.includes(t.rp.recruitment)));
  const go = (t: OpsTask) => open({ section: 'rps', id: t.rp.id, tab: t.tab });

  return (
    <div className="ipage ihome">
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">
            {greeting()}, {first}
          </h1>
        </div>
      </header>

      <Tiles label="What’s waiting" value={kind} onPick={setKind} items={TILES.map((t) => ({ ...t, n: tasks.filter((x) => x.kind === t.key).length }))} />

      <motion.section className="card stable" aria-labelledby="oq-count" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: 0.08 }}>
        <div className="stools ops-tools">
          <div className="stools__row">
            <MultiPick id="oq-region" label="Sales region" value={regions} options={[...new Set(tasks.map((t) => regionOf(t.rp.country)))].sort()} onChange={setRegions} empty="All sales regions" all="All sales regions" />
            <MultiPick id="oq-bdm" label="BDM" value={bdms} options={[...new Set(tasks.map((t) => t.rp.recruitment))].sort()} onChange={setBdms} empty="All BDMs" all="All BDMs" search />
          </div>
          <p className="stools__count" id="oq-count" role="status">
            <span>
              <span className="num">{rows.length === tasks.length ? tasks.length : `${rows.length} of ${tasks.length}`}</span> {tasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="snone">
            <p className="snone__title">{tasks.length ? 'Nothing here' : 'Nothing waiting'}</p>
            {tasks.length > 0 && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => (setKind(''), setRegions([]), setBdms([]))}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="stab-wrap">
            <table className="itab itab--queue">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Recruitment partner</th>
                  <th scope="col">Sales region</th>
                  <th scope="col">BDM</th>
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
                    <td>
                      {t.rp.name}
                      <span className="irow__sub">
                        {t.rp.code} · {t.rp.city}, {t.rp.country}
                      </span>
                    </td>
                    <td>{regionOf(t.rp.country)}</td>
                    <td>{t.rp.recruitment}</td>
                    <td>
                      <span className="iwait">
                        <span className="num">{waited(t.since)}</span>
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
    </div>
  );
}
