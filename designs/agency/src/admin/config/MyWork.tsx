import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Checkbox, Field, SelectInput } from '../../components/forms';
import { PageHead } from '../../institution/records/parts';
import { SearchPick } from '../../institution/records/SearchPick';
import { MultiPick } from '../../components/MultiPick';
import { STANDING, standing, taskStanding, whShort, whText, type Standing, type WorkTask } from '../data/mywork';
import type { ConfigProps } from './ConfigPage';
import { Pager, usePaged } from './parts';

type View = 'mine' | 'all' | 'waiting';

const Pill = ({ s }: { s: Standing }) => <span className={`mw-pill mw-pill--${s}`}>{STANDING[s]}</span>;

/**
 * My Work (Nesil, 5 Nov; Jovial, 9 Nov: every task from a task rule, its rule's ID under its title, no escalation):
 * the signed-in person's tasks at a glance (assigned, due soon, breached), then the tasks, soonest due first: **Assigned to me**, **All
 * work** (an admin sees every queue) or **Waiting on others** (records waiting on an RP or a university), filtered by
 * queues, SLA status (Completed too) and who it's assigned to, each a multi-select. Assign or Reassign picks someone in the task's queue; Mark as Completed closes one of yours whose rule closes on Done. No prototype clock.
 */
export function MyWork({ cfg, change, say, me }: ConfigProps) {
  const [view, setView] = useState<View>('mine');
  const [qs, setQs] = useState<string[]>([]);
  const [sts, setSts] = useState<string[]>([]);
  const [whos, setWhos] = useState<string[]>([]);
  const [assigning, setAssigning] = useState<WorkTask | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [bulk, setBulk] = useState(false);
  const qName = (id: string) => cfg.queues.find((q) => q.id === id)?.name ?? 'Admin';
  const left = (t: WorkTask) => t.sla - t.waited;
  const byDue = (a: WorkTask, b: WorkTask) => left(a) - left(b);
  const open = cfg.tasks.filter((t) => !t.done);
  const mine = open.filter((t) => t.assignee === me);
  const NOONE = 'Not assigned';
  // Completed shows only when it's picked in SLA status; then done tasks come last
  const base = view === 'mine' ? cfg.tasks.filter((t) => t.assignee === me) : cfg.tasks;
  const list = base
    .filter((t) => (sts.length ? sts.includes(STANDING[taskStanding(t)]) : !t.done))
    .filter((t) => !qs.length || qs.includes(qName(t.queue)))
    .filter((t) => !whos.length || whos.includes(t.assignee || NOONE))
    .sort((a, b) => Number(!!a.done) - Number(!!b.done) || byDue(a, b));
  const waits = [...cfg.waits].sort((a, b) => (a.left ?? 1e6) - (b.left ?? 1e6));
  const pg = usePaged(list, [view, qs.join(), sts.join(), whos.join()]);
  // ticks clear when the view or a filter changes; completed tasks can't be ticked
  useEffect(() => setTicked([]), [view, qs.join(), sts.join(), whos.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const tickable = list.filter((t) => !t.done).map((t) => t.id);
  const allTicked = tickable.length > 0 && tickable.every((id) => ticked.includes(id));
  const tick = (id: string, on: boolean) => setTicked((x) => (on ? [...x, id] : x.filter((y) => y !== id)));
  const wpg = usePaged(waits, [view]);
  const late = mine.filter((t) => left(t) < 0).length;
  const soon = mine.filter((t) => standing(left(t)) === 'soon').length;
  const tiles: [number, string, string, string][] = [
    [mine.length, 'Assigned to me', late ? `${late} breached` : 'None breached', ''],
    [soon, 'Due soon', 'Yours, within a working day', ''],
    [late, 'Breached', 'Yours, past the SLA', late ? 'is-bad' : ''],
  ];
  const queueNames = cfg.queues.map((q) => q.name);
  const people = [NOONE, ...[...new Set(cfg.tasks.map((t) => t.assignee).filter(Boolean))].sort()];
  const filtered = qs.length + sts.length + whos.length > 0;
  return (
    <>
      <PageHead title="My Work" lead="Tasks waiting on you and your team, soonest due first." />
      <div className="mw-tiles" role="group" aria-label="Your work">
        {tiles.map(([n, k, sub, cls]) => (
          <div key={k} className={`card mw-tile ${cls}`}>
            <span className="mw-tile__n num">{n}</span>
            <span className="mw-tile__k">{k}</span>
            <span className="mw-tile__sub">{sub}</span>
          </div>
        ))}
      </div>
      <div className="card mw-list">
        <div className="mw-tools">
          <div className="mw-views" role="group" aria-label="Show">
            {(
              [
                ['mine', 'Assigned to me', mine.length],
                ['all', 'All work', open.length],
                ['waiting', 'Waiting on others', cfg.waits.length],
              ] as [View, string, number][]
            ).map(([v, l, n]) => (
              <button key={v} type="button" className="ichip" aria-pressed={view === v} onClick={() => setView(v)}>
                {l} <span className="num">{n}</span>
              </button>
            ))}
          </div>
          {view !== 'waiting' && (
            <div className="mw-filters">
              <div className="mw-filter">
                <MultiPick id="mw-queues" label="Queues" value={qs} options={queueNames} onChange={setQs} empty="All queues" search />
              </div>
              <div className="mw-filter">
                <MultiPick id="mw-status" label="SLA status" value={sts} options={Object.values(STANDING)} onChange={setSts} empty="Any SLA status" />
              </div>
              {view === 'all' && (
                <div className="mw-filter">
                  <MultiPick id="mw-assigned" label="Assigned to" value={whos} options={people} onChange={setWhos} empty="Anyone" search />
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
          <>
            <div className="stab-wrap">
              <table className="itab cfg__tab mw-tab">
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
                    const s = w.left === null ? null : standing(w.left);
                    return (
                      <tr key={w.id}>
                        <td>
                          <span className="cfg__strong">
                            {w.student} · <span className="num">{w.ref}</span>
                          </span>
                          <span className="cfg__sub">
                            {w.uni} · {w.status}
                          </span>
                        </td>
                        <td>{w.on}</td>
                        <td>{w.what}</td>
                        <td className="num">{whShort(w.since)}</td>
                        <td>
                          {s ? (
                            <>
                              <Pill s={s} />
                              <span className="cfg__sub">{w.left! < 0 ? `Late by ${whText(w.left!)}: a chase task is raised` : w.left! <= 9 ? 'Due today' : `Due in ${whText(w.left!)}`}</span>
                            </>
                          ) : (
                            <span className="cfg__muted">No timer</span>
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
              <div className="mw-bulk" role="status">
                <span>
                  <span className="num cfg__strong">{ticked.length}</span> ticked
                </span>
                <Button size="sm" onClick={() => setBulk(true)}>
                  Assign {ticked.length}
                </Button>
                <button type="button" className="btn btn--link" onClick={() => setTicked([])}>
                  Clear
                </button>
              </div>
            )}
            <div className="stab-wrap">
              <table className="itab cfg__tab mw-tab">
                <colgroup>
                  <col className="mw-c-tick" />
                  <col />
                  <col className="mw-c-rec" />
                  <col className="mw-c-q" />
                  <col className="mw-c-who" />
                  <col className="mw-c-n" />
                  <col className="mw-c-sla" />
                  <col className="mw-c-act" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="mw-tick">
                      <Checkbox id="mw-tick-all" checked={allTicked} onChange={(on) => setTicked(on ? tickable : [])}>
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
                  {pg.rows.map((t) => {
                    const l = left(t);
                    const s = taskStanding(t);
                    return (
                      <tr key={t.id} className={ticked.includes(t.id) ? 'is-ticked' : ''}>
                        <td className="mw-tick">
                          {!t.done && (
                            <Checkbox id={`mw-tick-${t.id}`} checked={ticked.includes(t.id)} onChange={(on) => tick(t.id, on)}>
                              <span className="vh">Tick {t.title}</span>
                            </Checkbox>
                          )}
                        </td>
                        <td>
                          <span className="cfg__strong">{t.title}</span>
                          <span className="cfg__sub num">{t.rule}</span>
                        </td>
                        <td>
                          <span className="num">{t.ref}</span>
                          <span className="cfg__sub">
                            {t.about} · {t.region}
                          </span>
                        </td>
                        <td>{qName(t.queue)}</td>
                        <td>{t.assignee || <span className="cfg__muted">Not assigned</span>}</td>
                        <td className="num">{whShort(t.waited)}</td>
                        <td>
                          <Pill s={s} />
                          <span className="cfg__sub">{t.done ? (l < 0 ? `Done ${whText(l)} late` : 'Done in time') : l < 0 ? `Late by ${whText(l)}` : `Due in ${whText(l)}`}</span>
                        </td>
                        <td className="cfg__acts mw-acts">
                          {!t.done && (
                          <>
                          <button type="button" className="btn btn--link" onClick={() => setAssigning(t)}>
                            {t.assignee ? 'Reassign' : 'Assign'}
                            <span className="vh"> {t.title}</span>
                          </button>
                          {t.assignee === me && t.canComplete && (
                            <button
                              type="button"
                              className="btn btn--link mw-complete"
                              onClick={() => {
                                change('My work', '', (c) => ({ ...c, tasks: c.tasks.map((x) => (x.id === t.id ? { ...x, done: true } : x)) }));
                                say(`Completed: ${t.title}.`);
                              }}
                            >
                              Mark as Completed<span className="vh"> {t.title}</span>
                            </button>
                          )}
                          </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager pg={pg} what="tasks" />
          </>
        ) : (
          <div className="cfg__muted mw-empty">
            {filtered ? (
              <p>No tasks match these filters.</p>
            ) : (
              <>
                <p className="cfg__strong">{view === 'mine' ? 'Nothing assigned to you' : 'No open tasks'}</p>
                <p>New tasks appear here when a task rule fires.</p>
              </>
            )}
          </div>
        )}
      </div>
      <BulkSheet
        open={bulk}
        tasks={cfg.tasks.filter((t) => ticked.includes(t.id))}
        cfg={cfg}
        onClose={() => setBulk(false)}
        onSave={(who) => {
          const n = ticked.length;
          change('My work', '', (c) => ({ ...c, tasks: c.tasks.map((x) => (ticked.includes(x.id) ? { ...x, assignee: who } : x)) }));
          say(`${n} ${n === 1 ? 'task' : 'tasks'} assigned to ${who}.`);
          setTicked([]);
          setBulk(false);
        }}
      />
      <AssignSheet
        task={assigning}
        cfg={cfg}
        onClose={() => setAssigning(null)}
        onSave={(who) => {
          const t = assigning!;
          change('My work', '', (c) => ({ ...c, tasks: c.tasks.map((x) => (x.id === t.id ? { ...x, assignee: who } : x)) }));
          say(`${t.title}: assigned to ${who}.`);
          setAssigning(null);
        }}
      />
    </>
  );
}

/** Assign or reassign a task to someone in its queue (the leader first). */
function AssignSheet({ task, cfg, onClose, onSave }: { task: WorkTask | null; cfg: ConfigProps['cfg']; onClose: () => void; onSave: (who: string) => void }) {
  const [who, setWho] = useState('');
  useEffect(() => setWho(task?.assignee ?? ''), [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = cfg.queues.find((x) => x.id === task?.queue);
  const name = (id: string) => cfg.users.find((u) => u.id === id)?.name ?? '';
  const lead = q ? name(q.lead) : '';
  const people = q ? [lead, ...q.members.map(name)].filter(Boolean) : [];
  if (task?.assignee && !people.includes(task.assignee)) people.push(task.assignee);
  return (
    <Sheet
      open={!!task}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={task?.assignee ? 'Reassign Task' : 'Assign Task'}
      sub={task?.title}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!who || who === task?.assignee} onClick={() => onSave(who)}>
              {task?.assignee ? 'Reassign' : 'Assign'}
            </Button>
          </div>
        </div>
      }
    >
      <Field id="mw-who" label={`People in ${q?.name ?? 'the queue'}`} required>
        <SelectInput id="mw-who" value={who} placeholder="Choose one person" onChange={(e) => setWho(e.target.value)}>
          {people.map((p) => (
            <option key={p} value={p}>
              {p === lead ? `${p} (leader)` : p}
            </option>
          ))}
        </SelectInput>
      </Field>
    </Sheet>
  );
}

/** Assign the ticked tasks to one person (5 Nov, later): someone in their queue, or in any of their queues. */
function BulkSheet({ open, tasks, cfg, onClose, onSave }: { open: boolean; tasks: WorkTask[]; cfg: ConfigProps['cfg']; onClose: () => void; onSave: (who: string) => void }) {
  const [who, setWho] = useState('');
  useEffect(() => {
    if (open) setWho('');
  }, [open]);
  const ids = [...new Set(tasks.map((t) => t.queue))];
  const qs = cfg.queues.filter((q) => ids.includes(q.id));
  const name = (id: string) => cfg.users.find((u) => u.id === id)?.name ?? '';
  const leads = new Set(qs.map((q) => name(q.lead)));
  const people = [...new Set(qs.flatMap((q) => [name(q.lead), ...q.members.map(name)]).filter(Boolean))];
  const n = tasks.length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet mw-bulk-sheet"
      title={`Assign ${n} ${n === 1 ? 'Task' : 'Tasks'}`}
      sub="To one person. Only these tasks move."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!who} onClick={() => onSave(who)}>
              Assign
            </Button>
          </div>
        </div>
      }
    >
      <Field id="mw-bulk-who" label={qs.length === 1 ? `People in ${qs[0].name}` : 'Person'} hint={qs.length > 1 ? `Anyone in these ${qs.length} queues.` : undefined} required>
        <SearchPick id="mw-bulk-who" label="Person" value={who} placeholder="Search for a person" options={people.map((p) => ({ value: p, label: leads.has(p) ? `${p} (leader)` : p }))} onChange={setWho} describedBy={qs.length > 1 ? 'mw-bulk-who-hint' : undefined} />
      </Field>
    </Sheet>
  );
}
