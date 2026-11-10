import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { MoreMenu } from '../../components/MoreMenu';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { MultiPick } from '../../components/MultiPick';
import { NoMatch, PageHead, RecordTabs, TabPanel } from '../../institution/records/parts';
import type { Queue, User } from '../data/config';
import {
  AFTER_UNITS,
  DEFAULT_TZ,
  REGIONAL,
  REGION_ADMISSIONS,
  REGION_RECRUITMENT,
  RULE_CATS,
  RULE_SHARING,
  RULE_SHARINGS,
  SHARING,
  SHARINGS,
  SLA_MAX,
  SLA_UNITS,
  SPAN_UNITS,
  TIME_ZONES,
  WEEKDAYS,
  dayHours,
  daysShort,
  spanShort,
  spanText,
  spansShort,
  spansText,
  whenText,
  type Calendar,
  type Destination,
  type Holiday,
  type RuleCat,
  type RuleSharing,
  type Sharing,
  type Span,
  type SpanUnit,
  type TaskRule,
} from '../data/work';
import type { ConfigProps } from './ConfigPage';
import { History, Panel } from './parts';

/** "Each region’s Admissions queue", or a queue's name. */
const destName = (to: Destination, queues: Queue[]) => REGIONAL[to]?.label ?? queues.find((q) => q.id === to)?.name ?? '—';
const time12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
const dayOf = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
const dateOf = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** What sends work to a queue: the task rules that name it, and the sales regions whose own queue it is (for the rules that go to each region's queue). */
const usersOf = (q: Queue, cfg: ConfigProps['cfg']) => {
  const rules = cfg.taskRules.filter((r) => r.to === q.id).map((r) => r.code);
  const regional = Object.entries(REGIONAL).filter(([to, x]) => cfg.taskRules.some((r) => r.to === to) && (q.name.endsWith(` ${x.suffix}`) || q.name === x.fallback));
  const regions = cfg.regions
    .filter((r) => r.queue === q.id || regional.some(([, x]) => q.name === `${r.name} ${x.suffix}`))
    .map((r) => r.name);
  return [...rules, ...regions];
};

type Tab = 'queues' | 'days';

/**
 * Queues and Working Days (Jovial, 9 Nov; Work, in GSP · Admin): **Queues** (who leads each, who's in it, how a new
 * task is shared) and **Working Days** (the calendars every SLA counts on). No kinds of work, reminders or escalation:
 * each task rule says where its task goes and its SLA. Each change is logged.
 */
export function QueuesSla(props: ConfigProps) {
  const { cfg } = props;
  const [tab, setTab] = useState<Tab>('queues');
  const [edit, setEdit] = useState<Queue | 'new' | null>(null);
  const [editCal, setEditCal] = useState<Calendar | 'new' | null>(null);
  return (
    <>
      <PageHead title="Queues and Working Days" lead="Who works each queue, and the working days that SLAs count.">
        {tab === 'queues' && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
            Create Queue
          </Button>
        )}
        {tab === 'days' && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEditCal('new')}>
            Add Calendar
          </Button>
        )}
      </PageHead>
      <RecordTabs
        id="wktab"
        label="Queues and Working Days"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'queues', label: 'Queues', n: cfg.queues.length },
          { key: 'days', label: 'Working Days', n: cfg.calendars.length },
        ]}
      />
      <TabPanel id="wktab" tab={tab}>
        {tab === 'queues' ? <QueuesTab {...props} onEdit={setEdit} /> : <DaysTab {...props} onEdit={setEditCal} />}
      </TabPanel>
      <CalendarSheet
        open={!!editCal}
        cal={editCal === 'new' ? null : editCal}
        cals={cfg.calendars}
        regions={cfg.regions.map((r) => r.name)}
        onClose={() => setEditCal(null)}
        onSave={(k) => {
          const isNew = !cfg.calendars.some((x) => x.id === k.id);
          props.change('Working days', `${isNew ? 'Added' : 'Edited'} the calendar ${k.name}: ${daysShort(k.days)}, ${time12(k.from)} to ${time12(k.to)} ${k.tz}${k.regions.length ? `; ${k.regions.join(', ')}` : ''}`, (c) => {
            const others = c.calendars.filter((x) => x.id !== k.id).map((x) => ({ ...x, regions: x.regions.filter((r) => !k.regions.includes(r)) }));
            return { ...c, calendars: isNew ? [...others, k] : c.calendars.map((x) => (x.id === k.id ? k : others.find((o) => o.id === x.id)!)) };
          });
          props.say(`${k.name} ${isNew ? 'added' : 'saved'}.`);
          setEditCal(null);
        }}
      />
      <QueueSheet
        open={!!edit}
        queue={edit === 'new' ? null : edit}
        queues={cfg.queues}
        users={cfg.users}
        onClose={() => setEdit(null)}
        onSave={(q) => {
          const isNew = !cfg.queues.some((x) => x.id === q.id);
          const lead = cfg.users.find((u) => u.id === q.lead)?.name ?? '';
          const n = q.members.length + 1;
          props.change('Queues', `${isNew ? 'Created' : 'Edited'} queue ${q.name}: leader ${lead}, ${n} ${n === 1 ? 'member' : 'members'}, ${SHARING[q.sharing].label}`, (c) => ({ ...c, queues: isNew ? [...c.queues, q] : c.queues.map((x) => (x.id === q.id ? q : x)) }));
          props.say(`${q.name} ${isNew ? 'created' : 'saved'}.`);
          setEdit(null);
        }}
      />
    </>
  );
}

/** The queues: one table, searched by queue or person. */
function QueuesTab({ cfg, change, say, onEdit }: ConfigProps & { onEdit: (q: Queue) => void }) {
  const [q, setQ] = useState('');
  const [removing, setRemoving] = useState<Queue | null>(null);
  const who = (id: string) => cfg.users.find((u) => u.id === id);
  const s = q.trim().toLowerCase();
  const match = (x: Queue) => !s || [x.name, who(x.lead)?.name ?? '', ...x.members.map((m) => who(m)?.name ?? '')].some((t) => t.toLowerCase().includes(s));
  const shown = cfg.queues.filter(match);
  const admin = cfg.queues.find((x) => x.id === 'q-admin');
  const moving = removing ? cfg.tasks.filter((t) => t.queue === removing.id && !t.done).length : 0;
  const tryDelete = (x: Queue) => {
    const used = usersOf(x, cfg);
    if (used.length) say(`${x.name} can’t be deleted: ${used.join(', ')} ${used.length === 1 ? 'goes' : 'go'} to it.`);
    else setRemoving(x);
  };
  return (
    <>
      <div className="card stable wk-tools">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search queues</span>
              <input id="wk-q" type="search" placeholder="Search queues" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <p className="stools__count" role="status">
            <span>
              <span className="num">{shown.length === cfg.queues.length ? cfg.queues.length : `${shown.length} of ${cfg.queues.length}`}</span> queues
            </span>
          </p>
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="card">
          <NoMatch what="queues" onClear={() => setQ('')} />
        </div>
      ) : (
        <Panel flush>
          <div className="stab-wrap">
            <table className="itab cfg__tab wk-queues">
              <colgroup>
                <col className="wk-c-name" />
                <col className="wk-c-lead" />
                <col className="wk-c-members" />
                <col className="wk-c-share" />
                <col className="cfg__actcol" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Queue</th>
                  <th scope="col">Leader</th>
                  <th scope="col">Members</th>
                  <th scope="col">Shared by</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => {
                  const lead = who(x.lead);
                  const members = x.members.map(who).filter((u): u is User => !!u);
                  return (
                    <tr key={x.id}>
                      <td>
                        <span className="cfg__strong">{x.name}</span>
                      </td>
                      <td>{lead ? <span className="cfg__strong">{lead.name}</span> : <span className="cfg__warn">No leader</span>}</td>
                      <td>
                        {members.length ? (
                          <span className="wk-people" title={members.map((m) => m.name).join(', ')}>
                            {members.slice(0, 3).map((m) => (
                              <span key={m.id} className="cfg__chip cfg__chip--plain">
                                {m.name}
                              </span>
                            ))}
                            {members.length > 3 && <span className="wk-more">+{members.length - 3}</span>}
                          </span>
                        ) : (
                          <span className="cfg__muted">Just the leader</span>
                        )}
                      </td>
                      <td>{SHARING[x.sharing].label}</td>
                      <td className="cfg__acts">
                        <MoreMenu
                          id={`wq-${x.id}`}
                          label={`More for ${x.name}`}
                          items={[
                            { id: 'edit', label: 'Edit Queue', icon: 'edit', onPick: () => onEdit(x) },
                            ...(x.id !== admin?.id ? [{ id: 'remove', label: 'Delete Queue', icon: 'close' as IconName, danger: true, onPick: () => tryDelete(x) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <History log={cfg.log} area="Queues" />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}?`}
        confirm="Delete Queue"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const x = removing!;
          change('Queues', `Deleted queue ${x.name}${moving && admin ? `; its ${moving} open ${moving === 1 ? 'task' : 'tasks'} moved to ${admin.name}` : ''}`, (c) => ({
            ...c,
            queues: c.queues.filter((y) => y.id !== x.id),
            tasks: admin ? c.tasks.map((t) => (t.queue === x.id && !t.done ? { ...t, queue: admin.id, assignee: c.users.find((u) => u.id === admin.lead)?.name ?? t.assignee } : t)) : c.tasks,
          }));
          say(`${x.name} deleted.`);
          setRemoving(null);
        }}
      >
        <p>{moving && admin ? `Its ${moving} open ${moving === 1 ? 'task moves' : 'tasks move'} to the ${admin.name} queue.` : 'It has no open tasks.'}</p>
      </ConfirmDialog>
    </>
  );
}

/** Create or edit a queue: its name, leader, how a new task is shared and its members, listed under the form. */
function QueueSheet({ open, queue, queues, users, onClose, onSave }: { open: boolean; queue: Queue | null; queues: Queue[]; users: User[]; onClose: () => void; onSave: (q: Queue) => void }) {
  const [name, setName] = useState('');
  const [lead, setLead] = useState('');
  const [sharing, setSharing] = useState<Sharing>('fewest');
  const [members, setMembers] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(queue?.name ?? '');
    setLead(queue?.lead ?? '');
    setSharing(queue?.sharing ?? 'fewest');
    setMembers((queue?.members ?? []).map((id) => users.find((u) => u.id === id)?.name ?? '').filter(Boolean));
    setTried(false);
  }, [open, queue?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = name.trim();
  const leadName = users.find((u) => u.id === lead)?.name;
  const err = {
    name: !v ? 'Name the queue.' : v.length > 60 ? 'Keep it to 60 characters.' : queues.some((x) => x.id !== queue?.id && x.name.toLowerCase() === v.toLowerCase()) ? 'There’s already a queue with this name.' : null,
    lead: !lead ? 'Choose a leader.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const picked = members.filter((n) => n !== leadName);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const ids = members.filter((n) => n !== leadName).map((n) => users.find((u) => u.name === n)?.id).filter((x): x is string => !!x);
    onSave({ id: queue?.id ?? `q-${Date.now()}`, name: v, lead, sharing, members: ids });
  };
  const active = users.filter((u) => u.status !== 'Deactivated');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet wk-sheet"
      title={queue ? `Edit ${queue.name}` : 'Create Queue'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{queue ? 'Save Changes' : 'Create Queue'}</Button>
          </div>
        </div>
      }
    >
      <p className="ireq">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required
      </p>
      <div className="wk-form">
        <Field id="wq-name" label="Queue name" required error={show('name')}>
          <TextInput id="wq-name" value={name} maxLength={60} invalid={!!show('name')} placeholder="Like: India Admissions" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="wq-lead" label="Leader" required error={show('lead')} hint="Sees the queue’s tasks and can assign them.">
          <SelectInput id="wq-lead" value={lead} placeholder="Choose one person" invalid={!!show('lead')} aria-describedby="wq-lead-hint" onChange={(e) => setLead(e.target.value)}>
            {active.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="wq-share" label="Shared by" required hint={SHARING[sharing].hint}>
          <SelectInput id="wq-share" value={sharing} aria-describedby="wq-share-hint" onChange={(e) => setSharing(e.target.value as Sharing)}>
            {SHARINGS.map((k) => (
              <option key={k} value={k}>
                {SHARING[k].label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="wq-members" label="Members" hint="The leader is always in it.">
          <MultiPick id="wq-members" label="Members" value={members} options={active.filter((u) => u.id !== lead).map((u) => u.name)} onChange={setMembers} empty="Just the leader" search />
        </Field>
      </div>
      <section className="wk-picked" aria-labelledby="wq-picked">
        <h3 id="wq-picked" className="wk-picked__t">
          In this queue <span className="num">{(leadName ? 1 : 0) + picked.length}</span>
        </h3>
        {leadName || picked.length ? (
          <ul className="wk-picked__list">
            {leadName && (
              <li>
                <span className="cfg__strong">{leadName}</span>
                <span className="cfg__muted">Leader</span>
              </li>
            )}
            {picked.map((n) => (
              <li key={n}>
                <span>{n}</span>
                <button type="button" className="wk-picked__x" aria-label={`Take ${n} out`} onClick={() => setMembers((m) => m.filter((x) => x !== n))}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cfg__muted">No one yet. Choose a leader and members.</p>
        )}
      </section>
    </Sheet>
  );
}

const hoursText = (h: number) => `${h} working ${h === 1 ? 'hour' : 'hours'} a day`;

/**
 * Working Days (Nesil, 5 Nov, later; 9 Nov: each calendar has its own time zone): one card a calendar, with its days,
 * hours, time zone, sales regions and holidays. Add Calendar and each card's three dots (Edit, Delete) use a pop-up;
 * holidays are added and removed on the card. The first calendar is the default and can't be deleted.
 */
function DaysTab({ cfg, change, say, onEdit }: ConfigProps & { onEdit: (c: Calendar) => void }) {
  const [adding, setAdding] = useState<Calendar | null>(null);
  const [removing, setRemoving] = useState<{ cal: Calendar; h: Holiday } | null>(null);
  const [deleting, setDeleting] = useState<Calendar | null>(null);
  const def = cfg.calendars[0];
  const covered = new Set(cfg.calendars.flatMap((c) => c.regions));
  const loose = cfg.regions.map((r) => r.name).filter((n) => !covered.has(n));
  return (
    <>
      <p className="wk-tz">
        <Icon name="clock" size={18} />
        <span>
          Every SLA counts the working hours of its record’s sales region. A record with no region uses <strong>{def?.name}</strong>.
        </span>
      </p>
      <div className="wk-cals">
        {cfg.calendars.map((c, i) => {
          const hols = [...c.holidays].sort((a, b) => a.date.localeCompare(b.date));
          const regs = i === 0 ? [...c.regions, ...loose] : c.regions;
          return (
            <section key={c.id} className="card wk-cal" aria-labelledby={`wc-${c.id}`}>
              <header className="wk-cal__head">
                <div>
                  <h3 id={`wc-${c.id}`} className="wk-cal__name">
                    {c.name}
                    {i === 0 && <span className="cfg__chip cfg__chip--plain wk-cal__def">Default</span>}
                  </h3>
                  <p className="wk-cal__sum num">
                    {daysShort(c.days)} · {time12(c.from)} to {time12(c.to)} {c.tz} · {hoursText(dayHours(c.from, c.to))}
                  </p>
                </div>
                <MoreMenu
                  id={`wc-more-${c.id}`}
                  label={`More for ${c.name}`}
                  items={[{ id: 'edit', label: 'Edit Calendar', icon: 'edit', onPick: () => onEdit(c) }, ...(i === 0 ? [] : [{ id: 'remove', label: 'Delete Calendar', icon: 'close' as IconName, danger: true, onPick: () => setDeleting(c) }])]}
                />
              </header>
              <div className="wk-cal__body">
              <div className="wk-cal__part">
                <h4 className="wk-cal__t">Working days</h4>
              <ol className="wk-cal__week" aria-label="Working days">
                {WEEKDAYS.map((d, j) => (
                  <li key={d} className={c.days[j] ? 'is-on' : ''}>
                    <span aria-hidden="true">{d.slice(0, 1)}</span>
                    <span className="vh">{`${d}: ${c.days[j] ? 'working' : 'off'}`}</span>
                  </li>
                ))}
              </ol>
              </div>
              <div className="wk-cal__part">
                <h4 className="wk-cal__t">
                  Sales regions <span className="num">{regs.length}</span>
                </h4>
                {regs.length ? (
                  <p className="wk-cal__regs">
                    {regs.map((r) => (
                      <span key={r} className="cfg__chip cfg__chip--plain">
                        {r}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="cfg__muted">No regions yet.</p>
                )}
              </div>
              <div className="wk-cal__part">
                <div className="wk-cal__row">
                  <h4 className="wk-cal__t">
                    Holidays <span className="num">{hols.length}</span>
                  </h4>
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={14} />} onClick={() => setAdding(c)}>
                    Add Holiday<span className="vh"> to {c.name}</span>
                  </Button>
                </div>
                {hols.length ? (
                  <ul className="wk-hols">
                    {hols.map((h) => (
                      <li key={h.id}>
                        <span className="wk-hols__date num">{dateOf(h.date)}</span>
                        <span className="wk-hols__day">{dayOf(h.date).slice(0, 3)}</span>
                        <span className="wk-hols__name">{h.name}</span>
                        <button type="button" className="wk-picked__x" aria-label={`Remove ${h.name}, ${dateOf(h.date)}, from ${c.name}`} onClick={() => setRemoving({ cal: c, h })}>
                          <Icon name="close" size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cfg__muted">No holidays yet.</p>
                )}
              </div>
              </div>
            </section>
          );
        })}
      </div>
      <History log={cfg.log} area="Working days" />
      <HolidaySheet
        open={!!adding}
        cal={adding}
        onClose={() => setAdding(null)}
        onSave={(h) => {
          const c = adding!;
          change('Working days', `${c.name}: added the holiday ${h.name}, ${dateOf(h.date)}`, (x) => ({ ...x, calendars: x.calendars.map((y) => (y.id === c.id ? { ...y, holidays: [...y.holidays, h] } : y)) }));
          say(`${h.name} added to ${c.name}.`);
          setAdding(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.h.name}?`}
        confirm="Remove Holiday"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const { cal, h } = removing!;
          change('Working days', `${cal.name}: removed the holiday ${h.name}, ${dateOf(h.date)}`, (x) => ({ ...x, calendars: x.calendars.map((y) => (y.id === cal.id ? { ...y, holidays: y.holidays.filter((z) => z.id !== h.id) } : y)) }));
          say(`${h.name} removed.`);
          setRemoving(null);
        }}
      >
        <p>{removing && `${dateOf(removing.h.date)} becomes a working day on ${removing.cal.name}: SLAs count it again.`}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        confirm="Delete Calendar"
        cancel="Keep"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const c = deleting!;
          change('Working days', `Deleted the calendar ${c.name}${c.regions.length ? `; ${c.regions.join(', ')} moved to ${def.name}` : ''}`, (x) => ({ ...x, calendars: x.calendars.filter((y) => y.id !== c.id).map((y, j) => (j === 0 ? { ...y, regions: [...y.regions, ...c.regions] } : y)) }));
          say(`${c.name} deleted.`);
          setDeleting(null);
        }}
      >
        <p>{deleting && (deleting.regions.length ? `${deleting.regions.join(', ')} ${deleting.regions.length === 1 ? 'moves' : 'move'} to ${def.name}, with its days, hours and holidays.` : 'No region is on it.')}</p>
      </ConfirmDialog>
    </>
  );
}

/** Add or edit a calendar: its name, time zone, working days, hours and sales regions. */
function CalendarSheet({ open, cal, cals, regions, onClose, onSave }: { open: boolean; cal: Calendar | null; cals: Calendar[]; regions: string[]; onClose: () => void; onSave: (c: Calendar) => void }) {
  const [name, setName] = useState('');
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [days, setDays] = useState<boolean[]>([]);
  const [from, setFrom] = useState('09:30');
  const [to, setTo] = useState('18:30');
  const [regs, setRegs] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(cal?.name ?? '');
    setTz(cal?.tz ?? DEFAULT_TZ);
    setDays(cal ? [...cal.days] : [true, true, true, true, true, false, false]);
    setFrom(cal?.from ?? '09:30');
    setTo(cal?.to ?? '18:30');
    setRegs(cal?.regions ?? []);
    setTried(false);
  }, [open, cal?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = name.trim();
  const hrs = from && to ? dayHours(from, to) : 0;
  const err = {
    name: !v ? 'Name the calendar.' : v.length > 40 ? 'Keep it to 40 characters.' : cals.some((x) => x.id !== cal?.id && x.name.toLowerCase() === v.toLowerCase()) ? 'There’s already a calendar with this name.' : null,
    days: !days.some(Boolean) ? 'Pick at least one working day.' : null,
    hours: !from || !to ? 'Set when the day starts and ends.' : hrs === 0 ? 'The day can’t start and end at the same time.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const moving = regs.filter((r) => cals.some((x) => x.id !== cal?.id && x.regions.includes(r)));
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ id: cal?.id ?? `cal-${Date.now()}`, name: v, tz, days, from, to, regions: regs, holidays: cal?.holidays ?? [] });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet wk-sheet"
      title={cal ? `Edit ${cal.name}` : 'Add Calendar'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{cal ? 'Save Changes' : 'Add Calendar'}</Button>
          </div>
        </div>
      }
    >
      <p className="ireq">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required
      </p>
      <div className="wk-form">
        <div className="wk-form__wide">
          <Field id="wc-name" label="Calendar name" required error={show('name')}>
            <TextInput id="wc-name" value={name} maxLength={40} invalid={!!show('name')} placeholder="Like: Saturday to Wednesday" onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="wk-form__wide">
          <Field id="wc-tz" label="Time zone" required hint="The working day and holidays are in this zone.">
            <SelectInput id="wc-tz" value={tz} aria-describedby="wc-tz-hint" onChange={(e) => setTz(e.target.value)}>
              {TIME_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <fieldset className="wk-form__wide wk-days">
          <legend className="field__label">
            Working days<span className="field__req" aria-hidden="true">*</span>
          </legend>
          <div className="wk-week__days">
            {WEEKDAYS.map((d, i) => (
              <button key={d} type="button" className="ichip" aria-pressed={!!days[i]} aria-label={d} onClick={() => setDays((x) => x.map((on, j) => (j === i ? !on : on)))}>
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
          {show('days') && <p className="field__msg field__msg--error">{err.days}</p>}
        </fieldset>
        <Field id="wc-from" label="Day starts" required error={show('hours')}>
          <TextInput id="wc-from" type="time" value={from} invalid={!!show('hours')} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="wc-to" label="Day ends" required hint={hrs ? `${hrs} working ${hrs === 1 ? 'hour' : 'hours'} a day${to < from ? ', past midnight' : ''}.` : undefined}>
          <TextInput id="wc-to" type="time" value={to} aria-describedby="wc-to-hint" onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="wk-form__wide">
          <Field id="wc-regs" label="Sales regions" hint={moving.length ? `${moving.join(', ')} ${moving.length === 1 ? 'moves' : 'move'} here from ${moving.length === 1 ? 'its' : 'their'} calendar.` : 'A region is on one calendar.'}>
            <MultiPick id="wc-regs" label="Sales regions" value={regs} options={regions} onChange={setRegs} empty="No regions yet" search />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

function HolidaySheet({ open, cal, onClose, onSave }: { open: boolean; cal: Calendar | null; onClose: () => void; onSave: (h: Holiday) => void }) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) (setDate(''), setName(''), setTried(false));
  }, [open]);
  const err = { date: !date ? 'Pick a date.' : cal?.holidays.some((h) => h.date === date) ? 'That day is a holiday already.' : null, name: !name.trim() ? 'Name the holiday.' : null };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={`Add Holiday to ${cal?.name ?? ''}`}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!err.date && !err.name) onSave({ id: `h${Date.now()}`, date, name: name.trim() });
              }}
            >
              Add Holiday
            </Button>
          </div>
        </div>
      }
    >
      <div className="wk-form">
        <Field id="wh-date" label="Date" required error={tried ? err.date : null}>
          <TextInput id="wh-date" type="date" value={date} invalid={tried && !!err.date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="wh-name" label="Holiday" required error={tried ? err.name : null}>
          <TextInput id="wh-name" value={name} placeholder="Like: Diwali" invalid={tried && !!err.name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** "Fewest open", or for the queue's own way, the queue's ("Fewest open, the queue’s way"). */
const sharedText = (r: Pick<TaskRule, 'sharing' | 'to'>, queues: Queue[]) => {
  if (r.sharing !== 'queue') return RULE_SHARING[r.sharing];
  const q = queues.find((x) => x.id === r.to);
  return q ? `${SHARING[q.sharing].label}, the queue’s way` : RULE_SHARING.queue;
};
/** When a rule's task starts: after a time, at an event, or at once. */
const afterShort = (r: TaskRule) => (r.afterEvent ? r.afterEvent.replace(/^the /, '') : spanShort(r.after));
const afterText = (r: TaskRule) => (r.afterEvent ? `at ${r.afterEvent}` : r.after ? `after ${spanText(r.after)}` : 'at once');
/** The regional destination a rule group can also pick. */
const regionalFor = (r: TaskRule) => (r.record === 'Application' ? REGION_ADMISSIONS : r.record === 'RP' ? REGION_RECRUITMENT : null);

/**
 * Task Rules (Jovial, 9 Nov): the only rules that make tasks, by group in tabs with counts; one table a group (ID;
 * when, and the task; where it goes and how it's shared; when it starts; SLA; when the RP is reminded; on or off).
 * Edit opens a short pop-up. A rule that is off is greyed.
 */
export function TaskRules({ cfg, change, say }: ConfigProps) {
  const openOf = (code: string) => cfg.tasks.filter((t) => t.rule === code && !t.done).length;
  const [cat, setCat] = useState<string>('all');
  const [editing, setEditing] = useState<TaskRule | null>(null);
  const keyOf = (c: RuleCat) => `c${RULE_CATS.indexOf(c)}`;
  const shown = RULE_CATS.filter((c) => cat === 'all' || keyOf(c) === cat);
  return (
    <>
      <PageHead title="Task Rules" lead="The rules that make every task. Times count on the record’s working calendar." />
      <RecordTabs
        id="trtab"
        label="Task rules"
        tab={cat}
        setTab={setCat}
        tabs={[{ key: 'all', label: 'All', n: cfg.taskRules.length }, ...RULE_CATS.map((c) => ({ key: keyOf(c), label: c, n: cfg.taskRules.filter((r) => r.cat === c).length }))]}
      />
      <TabPanel id="trtab" tab={cat}>
        {shown.map((c) => {
          const rows = cfg.taskRules.filter((r) => r.cat === c);
          if (!rows.length) return null;
          return (
            <Panel key={c} flush title={`${c} · ${rows.length}`}>
              <div className="stab-wrap">
                <table className="itab cfg__tab wk-trules">
                  <colgroup>
                    <col className="wk-tr-code" />
                    <col className="wk-tr-when" />
                    <col className="wk-tr-to" />
                    <col className="wk-tr-n" />
                    <col className="wk-tr-n" />
                    <col className="wk-tr-n" />
                    <col className="wk-tr-on" />
                    <col className="wk-tr-act" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">When, and the task</th>
                      <th scope="col">Goes to</th>
                      <th scope="col">Starts after</th>
                      <th scope="col">SLA</th>
                      <th scope="col">RP reminded</th>
                      <th scope="col">On</th>
                      <th scope="col">
                        <span className="vh">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={r.on ? '' : 'is-off'}>
                        <td className="num cfg__strong">{r.code}</td>
                        <td>
                          <span className="cfg__strong">{whenText(r)}</span>
                          <span className="cfg__sub">{r.task}</span>
                        </td>
                        <td>
                          {destName(r.to, cfg.queues)}
                          <span className="cfg__sub">{sharedText(r, cfg.queues)}</span>
                        </td>
                        <td className="num">{afterShort(r)}</td>
                        <td className="num">{spanShort(r.sla)}</td>
                        <td className="num">{spansShort(r.remind ?? [])}</td>
                        <td>
                          <Switch
                            id={`wt-on-${r.id}`}
                            checked={r.on}
                            onChange={(on) => {
                              change('Task rules', `${r.code} ${r.name} switched ${on ? 'on' : 'off'}`, (x) => ({ ...x, taskRules: x.taskRules.map((y) => (y.id === r.id ? { ...y, on } : y)) }));
                              // Q37 (Jovial, 10 Nov): off makes no new tasks; the open ones stay until they close
                              say(on ? `${r.code} ${r.name}: on.` : `${r.code} ${r.name}: off. No new tasks; its ${openOf(r.code)} open ${openOf(r.code) === 1 ? 'task stays' : 'tasks stay'} until ${openOf(r.code) === 1 ? 'it closes' : 'they close'}.`);
                            }}
                          >
                            <span className="vh">
                              {r.code} {r.name}
                            </span>
                          </Switch>
                        </td>
                        <td className="cfg__acts">
                          <button type="button" className="btn btn--link wk-tr-edit" onClick={() => setEditing(r)}>
                            Edit<span className="vh"> {r.code}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        })}
      </TabPanel>
      <History log={cfg.log} area="Task rules" />
      <RuleSheet
        rule={editing}
        queues={cfg.queues}
        onClose={() => setEditing(null)}
        onSave={(r) => {
          const remind = r.remind?.length ? spansText(r.remind) : 'never';
          change('Task rules', `${r.code} ${r.name}: goes to ${destName(r.to, cfg.queues)}, starts ${afterText(r)}, SLA ${spanText(r.sla)}, RP reminded after ${remind}, shared to ${sharedText(r, cfg.queues)}`, (x) => ({ ...x, taskRules: x.taskRules.map((y) => (y.id === r.id ? r : y)) }));
          say(`${r.code} saved.`);
          setEditing(null);
        }}
      />
    </>
  );
}

/** A length of time, or none: a number (empty: none, unless required) and its unit. */
function SpanField({ id, label, value, unit, units, onValue, onUnit, required, error, hint, many }: { id: string; label: string; value: string; unit: SpanUnit; units: SpanUnit[]; onValue: (v: string) => void; onUnit: (u: SpanUnit) => void; required?: boolean; error?: string | null; hint?: string; many?: boolean }) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <span className="wk-due">
        <TextInput id={id} inputMode="numeric" value={value} placeholder={required ? '' : 'None'} invalid={!!error} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onValue(many ? e.target.value.replace(/[^\d, ]/g, '') : e.target.value.replace(/\D/g, '').slice(0, 3))} />
        <SelectInput id={`${id}-unit`} aria-label={`${label}: unit`} value={unit} onChange={(e) => onUnit(e.target.value as SpanUnit)}>
          {units.map((u) => (
            <option key={u} value={u}>
              {SPAN_UNITS[u]}
            </option>
          ))}
        </SelectInput>
      </span>
    </Field>
  );
}

/**
 * Edit a task rule (9 Nov): When, Task and Closes when read only; then where it goes, when it starts, its SLA, when
 * the RP is reminded (only on rules where the RP owes something), how it's shared and On, with a summary line.
 */
function RuleSheet({ rule, queues, onClose, onSave }: { rule: TaskRule | null; queues: Queue[]; onClose: () => void; onSave: (r: TaskRule) => void }) {
  const blank = { to: '', param: '', after: '', afterU: 'hours' as SpanUnit, sla: '', slaU: 'hours' as SpanUnit, remind: '', remindU: 'days' as SpanUnit, sharing: 'queue' as RuleSharing, on: true };
  const [v, setV] = useState(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!rule) return;
    setV({
      to: rule.to,
      param: rule.param ? String(rule.param.n) : '',
      after: rule.after ? String(rule.after.n) : '',
      afterU: rule.after?.unit ?? 'hours',
      sla: String(rule.sla?.n ?? ''),
      slaU: rule.sla?.unit ?? 'hours',
      remind: (rule.remind ?? []).map((x) => x?.n).join(', '),
      remindU: rule.remind?.[0]?.unit ?? 'days',
      sharing: rule.sharing,
      on: rule.on,
    });
    setTried(false);
  }, [rule?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const whole = (s: string) => /^\d+$/.test(s.trim());
  const nums = v.remind.split(/[,\s]+/).filter(Boolean);
  const max = SLA_MAX[v.slaU];
  const err = {
    to: !v.to ? 'Choose where it goes.' : null,
    param: rule?.param && !(whole(v.param) && Number(v.param) > 0) ? 'A whole number.' : null,
    after: v.after && !whole(v.after) ? 'A whole number.' : null,
    sla: !whole(v.sla) || Number(v.sla) < 1 || Number(v.sla) > max ? `A whole number from 1 to ${max}.` : null,
    remind: nums.some((n) => !whole(n) || Number(n) < 1) ? 'A whole number.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const span = (n: string, unit: SpanUnit): Span => (n && Number(n) > 0 ? { n: Number(n), unit } : null);
  const next: TaskRule | null = rule
    ? {
        ...rule,
        to: v.to,
        param: rule.param ? { ...rule.param, n: Number(v.param) || rule.param.n } : undefined,
        after: rule.afterEvent ? null : span(v.after, v.afterU),
        sla: span(v.sla, v.slaU) ?? rule.sla,
        remind: rule.remind ? nums.map((n) => span(n, v.remindU)).filter((x): x is NonNullable<Span> => !!x) : null,
        sharing: v.sharing,
        on: v.on,
      }
    : null;
  const dirty = !!rule && JSON.stringify(next) !== JSON.stringify(rule);
  const regional = rule ? regionalFor(rule) : null;
  const sharings = RULE_SHARINGS.filter((s) => s !== 'officer' || rule?.record === 'Application');
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean) || !next) return;
    onSave(next);
  };
  return (
    <Sheet
      open={!!rule}
      onClose={onClose}
      center
      className="iform cfg__sheet wk-sheet"
      title={rule ? `Edit ${rule.code}: ${rule.name}` : ''}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!dirty} onClick={save}>
              Save Changes
            </Button>
          </div>
        </div>
      }
    >
      {rule && next && (
        <>
          <dl className="wk-built">
            <div>
              <dt>When</dt>
              <dd>{whenText(next)}</dd>
            </div>
            <div>
              <dt>Task</dt>
              <dd>{rule.task}</dd>
            </div>
            <div>
              <dt>Closes when</dt>
              <dd>{rule.closes}</dd>
            </div>
          </dl>
          <p className="ireq">
            <span className="field__req" aria-hidden="true">
              *
            </span>{' '}
            Required
          </p>
          <div className="wk-form">
            <Field id="wt-to" label="Goes to" required error={show('to')} hint="Every task from this rule lands here.">
              <SelectInput id="wt-to" value={v.to} placeholder="Choose a queue" invalid={!!show('to')} aria-describedby="wt-to-hint" onChange={(e) => set({ to: e.target.value })}>
                {regional && <option value={regional}>{REGIONAL[regional].label}</option>}
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {rule.param && (
              <Field id="wt-param" label={rule.param.label} required error={show('param')}>
                <TextInput id="wt-param" inputMode="numeric" value={v.param} invalid={!!show('param')} onChange={(e) => set({ param: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
              </Field>
            )}
            {rule.afterEvent ? (
              <Field id="wt-after" label="Task starts after">
                <TextInput id="wt-after" value={rule.afterEvent} readOnly />
              </Field>
            ) : (
              <SpanField id="wt-after" label="Task starts after" value={v.after} unit={v.afterU} units={AFTER_UNITS} error={show('after')} onValue={(x) => set({ after: x })} onUnit={(u) => set({ afterU: u })} hint="Empty: at once." />
            )}
            <SpanField id="wt-sla" label="SLA" required value={v.sla} unit={v.slaU} units={SLA_UNITS} error={show('sla')} onValue={(x) => set({ sla: x })} onUnit={(u) => set({ slaU: u })} />
            {rule.remind && (
              <SpanField id="wt-remind" label="RP reminded after" many value={v.remind} unit={v.remindU} units={SLA_UNITS} error={show('remind')} onValue={(x) => set({ remind: x })} onUnit={(u) => set({ remindU: u })} hint="Empty: no reminder. The RP gets the Reminder email." />
            )}
            <Field id="wt-share" label="How it’s shared" required>
              <SelectInput id="wt-share" value={v.sharing} onChange={(e) => set({ sharing: e.target.value as RuleSharing })}>
                {sharings.map((s) => (
                  <option key={s} value={s}>
                    {RULE_SHARING[s]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="wk-form__wide">
              <Switch id="wt-on" checked={v.on} onChange={(on) => set({ on })}>
                On
              </Switch>
            </div>
          </div>
          <p className="wk-words">{`“${rule.task}” goes to ${v.to ? destName(v.to, queues).replace(/^Each/, 'each') : '—'}, ${sharedText(next, queues).replace(/^The/, 'the')}, due in ${spanText(next.sla)}.`}</p>
        </>
      )}
    </Sheet>
  );
}
