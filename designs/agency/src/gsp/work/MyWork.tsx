import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Toast, type ToastMsg } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { useCompleteTask } from '../../components/CompleteTask';
import { Checkbox, Field } from '../../components/forms';
import { MultiPick } from '../../components/MultiPick';
import { SearchPick } from '../../institution/records/SearchPick';
import { Pager, usePaged } from '../../admin/config/parts';
import { LEADER, ME, QUEUE, STANDING, TEAM, dueDate, sampleGwTasks, sampleGwWaits, standingOf, whShort, whText, type GwTask, type Standing } from './data';
import './work.css';

type View = 'mine' | 'team' | 'waiting';

const Pill = ({ s }: { s: Standing }) => <span className={`gw-pill gw-pill--${s}`}>{STANDING[s]}</span>;

/** The line under a task's SLA pill. */
const slaLine = (t: GwTask) => {
  const left = t.sla - t.waited;
  if (t.done) return left < 0 ? `Done ${whText(left)} late` : 'Done in time';
  if (left < 0) return `Late by ${whText(left)}`;
  return left < 9 ? `Due in ${whText(left)}` : `Due ${dueDate(left)}`;
};

/**
 * My work, GSP · Admissions (Nesil, 5 Nov; after the reference): the same page as GSP · Admin's My Work, this role's
 * own copy, in sentence case. Freddy's tiles, then **Assigned to me**, **My team** (every task in India Admissions)
 * and **Waiting on others**. A task's record is its application (GSP number, university, region); its SLA pauses
 * while the RP answers a request. Tick tasks to assign them together.
 */
export function MyWork() {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const say = (title: string) => setToast({ key: Date.now(), title, icon: 'check', tone: 'ok' });
  const [tasks, setTasks] = useState(sampleGwTasks);
  // Q36 (Jovial, 10 Nov): a Done rule's task completes with a click; any other completes early with a note
  const completer = useCompleteTask((id, note) => {
    const t = tasks.find((x) => x.id === id);
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: true, note } : x)));
    if (t) say(`Completed: ${t.title}.`);
  });
  const [waits] = useState(sampleGwWaits);
  const [view, setView] = useState<View>('mine');
  const [sts, setSts] = useState<string[]>([]);
  const [whos, setWhos] = useState<string[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [assigning, setAssigning] = useState<GwTask[] | null>(null);
  const NOONE = 'Not assigned';
  const open = tasks.filter((t) => !t.done);
  const mine = open.filter((t) => t.assignee === ME);
  const left = (t: GwTask) => t.sla - t.waited;
  const base = view === 'mine' ? tasks.filter((t) => t.assignee === ME) : tasks;
  const list = base
    .filter((t) => (sts.length ? sts.includes(STANDING[standingOf(t)]) : !t.done))
    .filter((t) => view !== 'team' || !whos.length || whos.includes(t.assignee || NOONE))
    // breached first, then soonest due; completed last
    .sort((a, b) => Number(!!a.done) - Number(!!b.done) || left(a) - left(b));
  const keys = [view, sts.join(), whos.join()];
  const pg = usePaged(list, keys);
  const wpg = usePaged(waits, [view]);
  useEffect(() => setTicked([]), keys); // eslint-disable-line react-hooks/exhaustive-deps
  const tickable = list.filter((t) => !t.done).map((t) => t.id);
  const allTicked = tickable.length > 0 && tickable.every((id) => ticked.includes(id));
  const late = mine.filter((t) => standingOf(t) === 'late').length;
  const soon = mine.filter((t) => standingOf(t) === 'soon').length;
  const filtered = sts.length + whos.length > 0;
  const assign = (ids: string[], who: string) => {
    setTasks((ts) => ts.map((x) => (ids.includes(x.id) ? { ...x, assignee: who } : x)));
    say(ids.length === 1 ? `Assigned to ${who}.` : `${ids.length} tasks assigned to ${who}.`);
    setTicked([]);
    setAssigning(null);
  };
  return (
    <div className="ipage gw">
      <header className="gw-head">
        <h1 className="gw-title">My work</h1>
        <p className="gw-lead">Tasks waiting on you and your team, soonest due first.</p>
      </header>
      <div className="gw-tiles" role="group" aria-label="Your work">
        {(
          [
            [mine.length, 'Assigned to me', late ? `${late} breached` : 'None breached', ''],
            [soon, 'Due soon', 'Yours, within a working day', ''],
            [late, 'Breached', 'Yours, past the SLA', late ? 'is-bad' : ''],
          ] as [number, string, string, string][]
        ).map(([n, k, sub, cls]) => (
          <div key={k} className={`card gw-tile ${cls}`}>
            <span className="gw-tile__n num">{n}</span>
            <span className="gw-tile__k">{k}</span>
            <span className="gw-tile__sub">{sub}</span>
          </div>
        ))}
      </div>
      <div className="card gw-list">
        <div className="gw-tools">
          <div className="gw-views" role="group" aria-label="Show">
            {(
              [
                ['mine', 'Assigned to me', mine.length],
                ['team', 'My team', open.length],
                ['waiting', 'Waiting on others', waits.length],
              ] as [View, string, number][]
            ).map(([v, l, n]) => (
              <button key={v} type="button" className="ichip" aria-pressed={view === v} onClick={() => setView(v)}>
                {l} <span className="num">{n}</span>
              </button>
            ))}
          </div>
          {view !== 'waiting' && (
            <div className="gw-filters">
              <div className="gw-filter">
                <MultiPick id="gw-status" label="SLA status" value={sts} options={Object.values(STANDING)} onChange={setSts} empty="Any SLA status" />
              </div>
              {view === 'team' && (
                <div className="gw-filter">
                  <MultiPick id="gw-assigned" label="Assigned to" value={whos} options={[NOONE, ...TEAM]} onChange={setWhos} empty="Anyone" search />
                </div>
              )}
              {filtered && (
                <button type="button" className="btn btn--link" onClick={() => (setSts([]), setWhos([]))}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
        {view === 'waiting' ? (
          <>
            <div className="stab-wrap">
              <table className="itab gw-tab gw-tab--wait">
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Waiting on</th>
                    <th scope="col">For</th>
                    <th scope="col">Since</th>
                    <th scope="col">Timer</th>
                  </tr>
                </thead>
                <tbody>
                  {wpg.rows.map((w) => {
                    const s: Standing | null = w.left === null ? null : w.left < 0 ? 'late' : w.left <= 9 ? 'soon' : 'track';
                    return (
                      <tr key={w.id}>
                        <td>
                          <span className="gw-strong">
                            {w.student} · <span className="num">{w.ref}</span>
                          </span>
                          <span className="gw-sub">
                            {w.uni} · {w.status}
                          </span>
                        </td>
                        <td>{w.on}</td>
                        <td>{w.what}</td>
                        <td className="num gw-nowrap">{whShort(w.since)}</td>
                        <td>
                          {s ? (
                            <>
                              <Pill s={s} />
                              <span className="gw-sub">{w.left! < 0 ? `Late by ${whText(w.left!)}: a chase task is raised` : w.left! <= 9 ? 'Due today' : `Due ${dueDate(w.left!)}`}</span>
                            </>
                          ) : (
                            <span className="gw-muted">No timer</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager pg={wpg} what="records" />
          </>
        ) : list.length ? (
          <>
            {ticked.length > 0 && (
              <div className="gw-bulk" role="status">
                <span>
                  <span className="num gw-strong gw-inline">{ticked.length}</span> ticked
                </span>
                <Button size="sm" onClick={() => setAssigning(tasks.filter((t) => ticked.includes(t.id)))}>
                  Assign {ticked.length}
                </Button>
                <button type="button" className="btn btn--link" onClick={() => setTicked([])}>
                  Clear
                </button>
              </div>
            )}
            <div className="stab-wrap">
              <table className="itab gw-tab">
                <colgroup>
                  <col className="gw-c-tick" />
                  <col />
                  <col className="gw-c-rec" />
                  <col className="gw-c-q" />
                  <col className="gw-c-who" />
                  <col className="gw-c-n" />
                  <col className="gw-c-sla" />
                  <col className="gw-c-act" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="gw-tick">
                      <Checkbox id="gw-tick-all" checked={allTicked} onChange={(on) => setTicked(on ? tickable : [])}>
                        <span className="vh">Tick all {tickable.length} tasks</span>
                      </Checkbox>
                    </th>
                    <th scope="col">Task</th>
                    <th scope="col">Record</th>
                    <th scope="col">Queue</th>
                    <th scope="col">Assigned to</th>
                    <th scope="col">Waiting</th>
                    <th scope="col">SLA</th>
                    <th scope="col">
                      <span className="vh">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pg.rows.map((t) => (
                    <tr key={t.id} className={ticked.includes(t.id) ? 'is-ticked' : ''}>
                      <td className="gw-tick">
                        {!t.done && (
                          <Checkbox id={`gw-tick-${t.id}`} checked={ticked.includes(t.id)} onChange={(on) => setTicked((x) => (on ? [...x, t.id] : x.filter((y) => y !== t.id)))}>
                            <span className="vh">Tick {t.title}</span>
                          </Checkbox>
                        )}
                      </td>
                      <td>
                        <span className="gw-strong">{t.title}</span>
                        <span className="gw-sub">
                          {t.rule}
                        </span>
                      </td>
                      <td>
                        <span className="num">{t.ref}</span>
                        <span className="gw-sub">
                          {t.uni} · {t.region}
                        </span>
                      </td>
                      <td>{t.queue}</td>
                      <td>{t.assignee || <span className="gw-muted">Not assigned</span>}</td>
                      <td className="num gw-nowrap">{whShort(t.waited)}</td>
                      <td>
                        <Pill s={standingOf(t)} />
                        <span className="gw-sub">{slaLine(t)}</span>
                      </td>
                      <td className="gw-acts">
                        {!t.done && (
                          <>
                            <button type="button" className="btn btn--link" onClick={() => setAssigning([t])}>
                              {t.assignee ? 'Reassign' : 'Assign'}
                              <span className="vh"> {t.title}</span>
                            </button>
                            {t.assignee === ME && (
                              <button
                                type="button"
                                className="btn btn--link gw-complete"
                                onClick={() => completer.start(t)}
                              >
                                Mark as completed<span className="vh"> {t.title}</span>
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager pg={pg} what="tasks" />
          </>
        ) : (
          <div className="gw-muted gw-empty">
            {filtered ? (
              <p>No tasks match these filters.</p>
            ) : (
              <>
                <p className="gw-strong">{view === 'mine' ? 'Nothing assigned to you' : 'No open tasks'}</p>
                <p>New tasks appear here when a task rule fires.</p>
              </>
            )}
          </div>
        )}
      </div>
      <AssignSheet tasks={assigning} onClose={() => setAssigning(null)} onSave={assign} />
      {completer.dialog}
      <Toast t={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/** Assign one task, or the ticked ones, to someone in India Admissions (the leader marked). */
function AssignSheet({ tasks, onClose, onSave }: { tasks: GwTask[] | null; onClose: () => void; onSave: (ids: string[], who: string) => void }) {
  const [who, setWho] = useState('');
  const one = tasks?.length === 1 ? tasks[0] : null;
  useEffect(() => setWho(one?.assignee ?? ''), [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = tasks?.length ?? 0;
  const re = !!one?.assignee;
  return (
    <Sheet
      open={!!tasks}
      onClose={onClose}
      center
      className="iform gw-sheet"
      title={one ? (re ? 'Reassign task' : 'Assign task') : `Assign ${n} tasks`}
      sub={one ? one.title : 'To one person. Only these tasks move.'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!who || (!!one && who === one.assignee)} onClick={() => tasks && onSave(tasks.map((t) => t.id), who)}>
              {re ? 'Reassign' : 'Assign'}
            </Button>
          </div>
        </div>
      }
    >
      <Field id="gw-who" label={`People in ${QUEUE}`} required>
        <SearchPick id="gw-who" label={`People in ${QUEUE}`} value={who} placeholder="Search for a person" options={TEAM.map((p) => ({ value: p, label: p === LEADER ? `${p} (leader)` : p === ME ? `${p} (you)` : p }))} onChange={setWho} />
      </Field>
    </Sheet>
  );
}
