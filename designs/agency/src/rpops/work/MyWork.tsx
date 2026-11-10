import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Toast, type ToastMsg } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { useCompleteTask } from '../../components/CompleteTask';
import { Checkbox, Field } from '../../components/forms';
import { MultiPick } from '../../components/MultiPick';
import { SearchPick } from '../../institution/records/SearchPick';
import { Pager, usePaged } from '../../admin/config/parts';
import { LEADER, QUEUE, STANDING, TEAM, dueDate, sampleRwTasks, standingOf, whShort, whText, type RwTask, type Standing } from './data';
import { GSP_USER } from '../user';
import './work.css';

type View = 'mine' | 'team' | 'waiting';

const Pill = ({ s }: { s: Standing }) => <span className={`rw-pill rw-pill--${s}`}>{STANDING[s]}</span>;

/** The line under a task's SLA pill. */
const slaLine = (t: RwTask) => {
  const left = t.sla - t.waited;
  if (t.done) return left < 0 ? `Done ${whText(left)} late` : 'Done in time';
  if (left < 0) return `Late by ${whText(left)}`;
  return left < 9 ? `Due in ${whText(left)}` : `Due ${dueDate(left)}`;
};

/**
 * My work, GSP · RP Ops (Nesil, 5 Nov; after the reference): GSP · Admissions' My work, this role's own copy. The RP
 * Ops queue's tasks on recruitment partners: **Assigned to me**, **My team** and **Waiting on others**, with a Queues
 * filter. A task's record is the RP and its region. Tick tasks to assign them together.
 */
export function MyWork() {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const say = (title: string) => setToast({ key: Date.now(), title, icon: 'check', tone: 'ok' });
  const ME = GSP_USER.name;
  const [tasks, setTasks] = useState(sampleRwTasks);
  // Q36 (Jovial, 10 Nov): a Done rule's task completes with a click; any other completes early with a note
  const completer = useCompleteTask((id, note) => {
    const t = tasks.find((x) => x.id === id);
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: true, note } : x)));
    if (t) say(`Completed: ${t.title}.`);
  });
  const waits: { id: string }[] = [];
  const [qs, setQs] = useState<string[]>([]);
  const [view, setView] = useState<View>('mine');
  const [sts, setSts] = useState<string[]>([]);
  const [whos, setWhos] = useState<string[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [assigning, setAssigning] = useState<RwTask[] | null>(null);
  const NOONE = 'Not assigned';
  const open = tasks.filter((t) => !t.done);
  const mine = open.filter((t) => t.assignee === ME);
  const left = (t: RwTask) => t.sla - t.waited;
  const base = view === 'mine' ? tasks.filter((t) => t.assignee === ME) : tasks;
  const list = base
    .filter((t) => (sts.length ? sts.includes(STANDING[standingOf(t)]) : !t.done))
    .filter((t) => !qs.length || qs.includes(t.queue))
    .filter((t) => view !== 'team' || !whos.length || whos.includes(t.assignee || NOONE))
    // breached first, then soonest due; completed last
    .sort((a, b) => Number(!!a.done) - Number(!!b.done) || left(a) - left(b));
  const keys = [view, qs.join(), sts.join(), whos.join()];
  const pg = usePaged(list, keys);
  useEffect(() => setTicked([]), keys); // eslint-disable-line react-hooks/exhaustive-deps
  const tickable = list.filter((t) => !t.done).map((t) => t.id);
  const allTicked = tickable.length > 0 && tickable.every((id) => ticked.includes(id));
  const late = mine.filter((t) => standingOf(t) === 'late').length;
  const soon = mine.filter((t) => standingOf(t) === 'soon').length;
  const filtered = qs.length + sts.length + whos.length > 0;
  const assign = (ids: string[], who: string) => {
    setTasks((ts) => ts.map((x) => (ids.includes(x.id) ? { ...x, assignee: who } : x)));
    say(ids.length === 1 ? `Assigned to ${who}.` : `${ids.length} tasks assigned to ${who}.`);
    setTicked([]);
    setAssigning(null);
  };
  return (
    <div className="ipage rw">
      <header className="rw-head">
        <h1 className="rw-title">My work</h1>
        <p className="rw-lead">Tasks waiting on you and your team, soonest due first.</p>
      </header>
      <div className="rw-tiles" role="group" aria-label="Your work">
        {(
          [
            [mine.length, 'Assigned to me', late ? `${late} breached` : 'None breached', ''],
            [soon, 'Due soon', 'Yours, within a working day', ''],
            [late, 'Breached', 'Yours, past the SLA', late ? 'is-bad' : ''],
          ] as [number, string, string, string][]
        ).map(([n, k, sub, cls]) => (
          <div key={k} className={`card rw-tile ${cls}`}>
            <span className="rw-tile__n num">{n}</span>
            <span className="rw-tile__k">{k}</span>
            <span className="rw-tile__sub">{sub}</span>
          </div>
        ))}
      </div>
      <div className="card rw-list">
        <div className="rw-tools">
          <div className="rw-views" role="group" aria-label="Show">
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
            <div className="rw-filters">
              <div className="rw-filter">
                <MultiPick id="rw-queues" label="Queues" value={qs} options={[QUEUE]} onChange={setQs} empty="All queues" />
              </div>
              <div className="rw-filter">
                <MultiPick id="rw-status" label="SLA status" value={sts} options={Object.values(STANDING)} onChange={setSts} empty="Any SLA status" />
              </div>
              {view === 'team' && (
                <div className="rw-filter">
                  <MultiPick id="rw-assigned" label="Assigned to" value={whos} options={[NOONE, ...TEAM]} onChange={setWhos} empty="Anyone" search />
                </div>
              )}
              {filtered && (
                <button type="button" className="btn btn--link" onClick={() => (setQs([]), setSts([]), setWhos([]))}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
        {view === 'waiting' ? (
          <div className="rw-empty-box">
            <p className="rw-empty-t">Nothing is waiting on others</p>
            <p className="rw-muted">Records waiting on an RP or a university show here, with their timer.</p>
          </div>
        ) : list.length ? (
          <>
            {ticked.length > 0 && (
              <div className="rw-bulk" role="status">
                <span>
                  <span className="num rw-strong rw-inline">{ticked.length}</span> ticked
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
              <table className="itab rw-tab">
                <colgroup>
                  <col className="rw-c-tick" />
                  <col />
                  <col className="rw-c-rec" />
                  <col className="rw-c-q" />
                  <col className="rw-c-who" />
                  <col className="rw-c-n" />
                  <col className="rw-c-sla" />
                  <col className="rw-c-act" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="rw-tick">
                      <Checkbox id="rw-tick-all" checked={allTicked} onChange={(on) => setTicked(on ? tickable : [])}>
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
                      <td className="rw-tick">
                        {!t.done && (
                          <Checkbox id={`rw-tick-${t.id}`} checked={ticked.includes(t.id)} onChange={(on) => setTicked((x) => (on ? [...x, t.id] : x.filter((y) => y !== t.id)))}>
                            <span className="vh">Tick {t.title}</span>
                          </Checkbox>
                        )}
                      </td>
                      <td>
                        <span className="rw-strong">{t.title}</span>
                        <span className="rw-sub">
                          {t.rule}
                        </span>
                      </td>
                      <td>
                        RP
                        <span className="rw-sub">{t.region}</span>
                      </td>
                      <td>{t.queue}</td>
                      <td>{t.assignee || <span className="rw-muted">Not assigned</span>}</td>
                      <td className="num rw-nowrap">{whShort(t.waited)}</td>
                      <td>
                        <Pill s={standingOf(t)} />
                        <span className="rw-sub">{slaLine(t)}</span>
                      </td>
                      <td className="rw-acts">
                        {!t.done && (
                          <>
                            <button type="button" className="btn btn--link" onClick={() => setAssigning([t])}>
                              {t.assignee ? 'Reassign' : 'Assign'}
                              <span className="vh"> {t.title}</span>
                            </button>
                            {t.assignee === ME && (
                              <button
                                type="button"
                                className="btn btn--link rw-complete"
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
          <div className="rw-empty-box">
            <p className="rw-empty-t">{filtered ? 'No tasks match these filters.' : view === 'mine' ? 'Nothing assigned to you' : 'No open tasks'}</p>
            {!filtered && <p className="rw-muted">New tasks appear here when a task rule fires.</p>}
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
function AssignSheet({ tasks, onClose, onSave }: { tasks: RwTask[] | null; onClose: () => void; onSave: (ids: string[], who: string) => void }) {
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
      className="iform rw-sheet"
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
      <Field id="rw-who" label={`People in ${QUEUE}`} required>
        <SearchPick id="rw-who" label={`People in ${QUEUE}`} value={who} placeholder="Search for a person" options={TEAM.map((p) => ({ value: p, label: p === LEADER ? `${p} (leader)` : p === GSP_USER.name ? `${p} (you)` : p }))} onChange={setWho} />
      </Field>
    </Sheet>
  );
}
