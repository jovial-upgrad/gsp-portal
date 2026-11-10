import { useEffect, useState } from 'react';
import { useViewOnly } from '../../proto/viewOnly';
import { Button } from '../../components/Button';
import { Toast, type ToastMsg } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { useCompleteTask } from '../../components/CompleteTask';
import { Checkbox, Field } from '../../components/forms';
import { MultiPick } from '../../components/MultiPick';
import { SearchPick } from '../../institution/records/SearchPick';
import { Pager, usePaged } from '../../admin/config/parts';
import { LEADER, QUEUE, STANDING, TEAM, dueDate, sampleIwTasks, standingOf, whShort, whText, type IwTask, type Standing } from './data';
import { GSP_USER } from '../../institution/user';
import '../../institution/work/work.css';

type View = 'mine' | 'team' | 'waiting';

const Pill = ({ s }: { s: Standing }) => <span className={`iw-pill iw-pill--${s}`}>{STANDING[s]}</span>;

/** The line under a task's SLA pill. */
const slaLine = (t: IwTask) => {
  const left = t.sla - t.waited;
  if (t.done) return left < 0 ? `Done ${whText(left)} late` : 'Done in time';
  if (left < 0) return `Late by ${whText(left)}`;
  return left < 9 ? `Due in ${whText(left)}` : `Due ${dueDate(left)}`;
};

/**
 * My work, GSP · Institution Ops (Nesil, 6 Nov): GSP · Institution's My work, this role's own copy, with the Institution Ops
 * queue's tasks: **Assigned to me**, **My team** and **Waiting on others**, with a Queues filter. A task's record is the
 * university or partner and its region. Tick tasks to assign them together; Mark as completed on your own.
 */
export function MyWork() {
  // view only (6 Nov): the tasks to look at; no ticking, assigning or completing
  const viewOnly = useViewOnly();
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const say = (title: string) => setToast({ key: Date.now(), title, icon: 'check', tone: 'ok' });
  const ME = GSP_USER.name;
  const [tasks, setTasks] = useState(sampleIwTasks);
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
  const [assigning, setAssigning] = useState<IwTask[] | null>(null);
  const NOONE = 'Not assigned';
  const open = tasks.filter((t) => !t.done);
  const mine = open.filter((t) => t.assignee === ME);
  const left = (t: IwTask) => t.sla - t.waited;
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
    <div className="ipage iw">
      <header className="iw-head">
        <h1 className="iw-title">My work</h1>
        <p className="iw-lead">Tasks waiting on you and your team, soonest due first.</p>
      </header>
      <div className="iw-tiles" role="group" aria-label="Your work">
        {(
          [
            [mine.length, 'Assigned to me', late ? `${late} breached` : 'None breached', ''],
            [soon, 'Due soon', 'Yours, within a working day', ''],
            [late, 'Breached', 'Yours, past the SLA', late ? 'is-bad' : ''],
          ] as [number, string, string, string][]
        ).map(([n, k, sub, cls]) => (
          <div key={k} className={`card iw-tile ${cls}`}>
            <span className="iw-tile__n num">{n}</span>
            <span className="iw-tile__k">{k}</span>
            <span className="iw-tile__sub">{sub}</span>
          </div>
        ))}
      </div>
      <div className="card iw-list">
        <div className="iw-tools">
          <div className="iw-views" role="group" aria-label="Show">
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
            <div className="iw-filters">
              <div className="iw-filter">
                <MultiPick id="iw-queues" label="Queues" value={qs} options={[QUEUE]} onChange={setQs} empty="All queues" />
              </div>
              <div className="iw-filter">
                <MultiPick id="iw-status" label="SLA status" value={sts} options={Object.values(STANDING)} onChange={setSts} empty="Any SLA status" />
              </div>
              {view === 'team' && (
                <div className="iw-filter">
                  <MultiPick id="iw-assigned" label="Assigned to" value={whos} options={[NOONE, ...TEAM]} onChange={setWhos} empty="Anyone" search />
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
          <div className="iw-empty-box">
            <p className="iw-empty-t">Nothing is waiting on others</p>
            <p className="iw-muted">Records waiting on a university or a partner show here, with their timer.</p>
          </div>
        ) : list.length ? (
          <>
            {!viewOnly && ticked.length > 0 && (
              <div className="iw-bulk" role="status">
                <span>
                  <span className="num iw-strong iw-inline">{ticked.length}</span> ticked
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
              <table className="itab iw-tab">
                <colgroup>
                  {!viewOnly && <col className="iw-c-tick" />}
                  <col />
                  <col className="iw-c-rec" />
                  <col className="iw-c-q" />
                  <col className="iw-c-who" />
                  <col className="iw-c-n" />
                  <col className="iw-c-sla" />
                  {!viewOnly && <col className="iw-c-act" />}
                </colgroup>
                <thead>
                  <tr>
                    {!viewOnly && (
                      <th scope="col" className="iw-tick">
                        <Checkbox id="iw-tick-all" checked={allTicked} onChange={(on) => setTicked(on ? tickable : [])}>
                          <span className="vh">Tick all {tickable.length} tasks</span>
                        </Checkbox>
                      </th>
                    )}
                    <th scope="col">Task</th>
                    <th scope="col">Record</th>
                    <th scope="col">Queue</th>
                    <th scope="col">Assigned to</th>
                    <th scope="col">Waiting</th>
                    <th scope="col">SLA</th>
                    {!viewOnly && (
                      <th scope="col">
                        <span className="vh">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pg.rows.map((t) => (
                    <tr key={t.id} className={ticked.includes(t.id) ? 'is-ticked' : ''}>
                      {!viewOnly && <td className="iw-tick">
                        {!t.done && (
                          <Checkbox id={`iw-tick-${t.id}`} checked={ticked.includes(t.id)} onChange={(on) => setTicked((x) => (on ? [...x, t.id] : x.filter((y) => y !== t.id)))}>
                            <span className="vh">Tick {t.title}</span>
                          </Checkbox>
                        )}
                      </td>}
                      <td>
                        <span className="iw-strong">{t.title}</span>
                        <span className="iw-sub">
                          {t.rule}
                        </span>
                      </td>
                      <td>
                        {t.rp}
                        <span className="iw-sub">{t.region}</span>
                      </td>
                      <td>{t.queue}</td>
                      <td>{t.assignee || <span className="iw-muted">Not assigned</span>}</td>
                      <td className="num iw-nowrap">{whShort(t.waited)}</td>
                      <td>
                        <Pill s={standingOf(t)} />
                        <span className="iw-sub">{slaLine(t)}</span>
                      </td>
                      {!viewOnly && <td className="iw-acts">
                        {!t.done && (
                          <>
                            <button type="button" className="btn btn--link" onClick={() => setAssigning([t])}>
                              {t.assignee ? 'Reassign' : 'Assign'}
                              <span className="vh"> {t.title}</span>
                            </button>
                            {t.assignee === ME && (
                              <button
                                type="button"
                                className="btn btn--link iw-complete"
                                onClick={() => completer.start(t)}
                              >
                                Mark as completed<span className="vh"> {t.title}</span>
                              </button>
                            )}
                          </>
                        )}
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager pg={pg} what="tasks" />
          </>
        ) : (
          <div className="iw-empty-box">
            <p className="iw-empty-t">{filtered ? 'No tasks match these filters.' : view === 'mine' ? 'Nothing assigned to you' : 'No open tasks'}</p>
            {!filtered && <p className="iw-muted">New tasks appear here when a task rule fires.</p>}
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
function AssignSheet({ tasks, onClose, onSave }: { tasks: IwTask[] | null; onClose: () => void; onSave: (ids: string[], who: string) => void }) {
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
      className="iform iw-sheet"
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
      <Field id="iw-who" label={`People in ${QUEUE}`} required>
        <SearchPick id="iw-who" label={`People in ${QUEUE}`} value={who} placeholder="Search for a person" options={TEAM.map((p) => ({ value: p, label: p === LEADER ? `${p} (leader)` : p === GSP_USER.name ? `${p} (you)` : p }))} onChange={setWho} />
      </Field>
    </Sheet>
  );
}
