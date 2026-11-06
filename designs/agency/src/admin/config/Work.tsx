import { useEffect, useState, type ReactNode } from 'react';
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
  AREAS,
  QUEUE_TYPES,
  REGION_ADMISSIONS,
  REGION_RECRUITMENT,
  SHARING,
  WEEKDAYS,
  dayHours,
  daysShort,
  dueText,
  RULE_CATS,
  RULE_SHARING,
  SPAN_UNITS,
  spanShort,
  spanText,
  type Calendar,
  type Destination,
  type DueUnit,
  type Holiday,
  type QueueType,
  type Sharing,
  type RuleCat,
  type RuleSharing,
  type Span,
  type SpanUnit,
  type TaskRule,
  type WorkKind,
} from '../data/work';
import type { ConfigProps } from './ConfigPage';
import { EditActions, History, Panel } from './parts';

/** "Each region’s Admissions queue", a team queue's name, or the Admin queue when it has none. */
const destName = (to: Destination, queues: Queue[]) =>
  to === REGION_ADMISSIONS ? 'Each region’s Admissions queue' : to === REGION_RECRUITMENT ? 'Each region’s Recruitment queue' : (queues.find((q) => q.id === to)?.name ?? 'Admin (no queue)');
/** The kinds of work that land in a queue. */
const receives = (q: Queue, kinds: WorkKind[]) => kinds.filter((k) => k.to === q.id || (k.to === REGION_ADMISSIONS && q.type === 'Admissions') || (k.to === REGION_RECRUITMENT && q.type === 'Recruitment'));
const TYPE_NOTE: Record<QueueType, string> = {
  Admissions: 'One per sales region: applications land in their region’s queue.',
  Recruitment: 'One per sales region, shared by record owner: each RP’s BDM.',
  Team: 'Teams that work across every region.',
};
const TYPE_TITLE: Record<QueueType, string> = { Admissions: 'Admissions Queues', Recruitment: 'Recruitment Queues', Team: 'Team Queues' };
const time12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
const dayOf = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
const dateOf = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type Tab = 'queues' | 'kinds' | 'days' | 'reminders';

/**
 * Queues, SLA and Escalation (Nesil, 5 Nov; Work, in GSP · Admin): **Queues** (who leads each, who's in it, how its
 * work is shared, what it receives), **Kinds of Work** (which queue each lands in and its SLA), **Working Days** (the
 * week and holidays every SLA counts on, in IST) and **Reminders and Escalation** (who's told, and when). Each change
 * is logged; settings read as they are until Edit.
 */
export function QueuesSla(props: ConfigProps) {
  const { cfg } = props;
  const [tab, setTab] = useState<Tab>('queues');
  const [edit, setEdit] = useState<Queue | 'new' | null>(null);
  const [editKind, setEditKind] = useState<WorkKind | 'new' | null>(null);
  const [editCal, setEditCal] = useState<Calendar | 'new' | null>(null);
  return (
    <>
      <PageHead title="Queues, SLA and Escalation" lead="Where each kind of work goes, when it’s due, and who’s told when it’s late.">
        {tab === 'queues' && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
            Create Queue
          </Button>
        )}
        {tab === 'kinds' && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEditKind('new')}>
            Add Kind of Work
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
        label="Queues, SLA and Escalation"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'queues', label: 'Queues', n: cfg.queues.length },
          { key: 'kinds', label: 'Kinds of Work', n: cfg.kinds.length },
          { key: 'days', label: 'Working Days' },
          { key: 'reminders', label: 'Reminders and Escalation' },
        ]}
      />
      <TabPanel id="wktab" tab={tab}>
        {tab === 'queues' ? <QueuesTab {...props} onEdit={setEdit} /> : tab === 'kinds' ? <KindsTab {...props} onEdit={setEditKind} /> : tab === 'days' ? <DaysTab {...props} onEdit={setEditCal} /> : <RemindersTab {...props} />}
      </TabPanel>
      <CalendarSheet
        open={!!editCal}
        cal={editCal === 'new' ? null : editCal}
        cals={cfg.calendars}
        regions={cfg.regions.map((r) => r.name)}
        onClose={() => setEditCal(null)}
        onSave={(k) => {
          const isNew = !cfg.calendars.some((x) => x.id === k.id);
          props.change('Working days', `${isNew ? 'Added' : 'Edited'} the calendar ${k.name}: ${daysShort(k.days)}, ${time12(k.from)} to ${time12(k.to)} IST${k.regions.length ? `; ${k.regions.join(', ')}` : ''}`, (c) => {
            const others = c.calendars.filter((x) => x.id !== k.id).map((x) => ({ ...x, regions: x.regions.filter((r) => !k.regions.includes(r)) }));
            return { ...c, calendars: isNew ? [...others, k] : c.calendars.map((x) => (x.id === k.id ? k : others.find((o) => o.id === x.id)!)) };
          });
          props.say(`${k.name} ${isNew ? 'added' : 'saved'}.`);
          setEditCal(null);
        }}
      />
      <KindSheet
        open={!!editKind}
        kind={editKind === 'new' ? null : editKind}
        kinds={cfg.kinds}
        queues={cfg.queues}
        rules={cfg.taskRules}
        onClose={() => setEditKind(null)}
        onSave={(k) => {
          const isNew = !cfg.kinds.some((x) => x.id === k.id);
          props.change('Kinds of work', `${isNew ? 'Added' : 'Edited'} ${k.name}: ${destName(k.to, cfg.queues)}, ${dueText(k.due, k.unit)}`, (c) => ({ ...c, kinds: isNew ? [...c.kinds, k] : c.kinds.map((x) => (x.id === k.id ? k : x)) }));
          props.say(`${k.name} ${isNew ? 'added' : 'saved'}.`);
          setEditKind(null);
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
          props.change('Queues', `${isNew ? 'Created' : 'Edited'} ${q.name}: leader ${lead}, ${q.members.length} ${q.members.length === 1 ? 'member' : 'members'}, shared by ${SHARING[q.sharing].label.toLowerCase()}`, (c) => ({ ...c, queues: isNew ? [...c.queues, q] : c.queues.map((x) => (x.id === q.id ? q : x)) }));
          props.say(`${q.name} ${isNew ? 'created' : 'saved'}.`);
          setEdit(null);
        }}
      />
    </>
  );
}

/** The queues, by type: Admissions, Recruitment, then the teams'. */
function QueuesTab({ cfg, change, say, onEdit }: ConfigProps & { onEdit: (q: Queue) => void }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<QueueType | ''>('');
  const [removing, setRemoving] = useState<Queue | null>(null);
  const who = (id: string) => cfg.users.find((u) => u.id === id);
  const s = q.trim().toLowerCase();
  const match = (x: Queue) => (!type || x.type === type) && (!s || [x.name, who(x.lead)?.name ?? '', ...x.members.map((m) => who(m)?.name ?? '')].some((t) => t.toLowerCase().includes(s)));
  const shown = cfg.queues.filter(match);
  const moving = removing ? receives(removing, cfg.kinds) : [];
  return (
    <>
      <div className="card stable wk-tools">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search queues</span>
              <input id="wk-q" type="search" placeholder="Queue or person" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <SelectInput id="wk-type" aria-label="Type" value={type} placeholder="All queues" allowEmpty onChange={(e) => setType(e.target.value as QueueType | '')}>
              <option value="Admissions">Admissions</option>
              <option value="Recruitment">Recruitment</option>
              <option value="Team">Teams</option>
            </SelectInput>
          </div>
          <p className="stools__count" role="status">
            <span>
              <span className="num">{shown.length === cfg.queues.length ? cfg.queues.length : `${shown.length} of ${cfg.queues.length}`}</span> queues
            </span>
          </p>
        </div>
      </div>
      {shown.length === 0 && (
        <div className="card">
          <NoMatch what="queues" onClear={() => (setQ(''), setType(''))} />
        </div>
      )}
      {QUEUE_TYPES.map((t) => {
        const rows = shown.filter((x) => x.type === t);
        if (!rows.length) return null;
        return (
          <Panel key={t} flush title={`${TYPE_TITLE[t]} · ${rows.length}`} note={TYPE_NOTE[t]}>
            <div className="stab-wrap">
              <table className="itab cfg__tab wk-queues">
                <colgroup>
                  <col className="wk-c-name" />
                  <col className="wk-c-lead" />
                  <col className="wk-c-members" />
                  <col className="wk-c-share" />
                  <col className="wk-c-recv" />
                  <col className="cfg__actcol" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Queue</th>
                    <th scope="col">Leader</th>
                    <th scope="col">Members</th>
                    <th scope="col">Shared by</th>
                    <th scope="col">Receives</th>
                    <th scope="col">
                      <span className="vh">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => {
                    const lead = who(x.lead);
                    const members = x.members.map(who).filter((u): u is User => !!u);
                    const got = receives(x, cfg.kinds);
                    return (
                      <tr key={x.id}>
                        <td>
                          <span className="cfg__strong">{x.name}</span>
                          {x.note && <span className="cfg__sub">{x.note}</span>}
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
                        <td>
                          {got.length ? (
                            <span title={got.map((g) => g.name).join(', ')}>
                              {got[0].name}
                              {got.length > 1 && <span className="wk-more"> +{got.length - 1} more</span>}
                            </span>
                          ) : (
                            <span className="cfg__muted">Nothing yet</span>
                          )}
                        </td>
                        <td className="cfg__acts">
                          <MoreMenu
                            id={`wq-${x.id}`}
                            label={`More for ${x.name}`}
                            items={[
                              { id: 'edit', label: 'Edit Queue', icon: 'edit', onPick: () => onEdit(x) },
                              ...(x.id !== 'q-admin' ? [{ id: 'remove', label: 'Delete Queue', icon: 'close' as IconName, danger: true, onPick: () => setRemoving(x) }] : []),
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
        );
      })}
      <History log={cfg.log} area="Queues" />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}?`}
        confirm="Delete Queue"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const x = removing!;
          const regional = x.type !== 'Team';
          const regionsLeft = cfg.regions.filter((r) => r.queue === x.id).map((r) => r.name);
          change('Queues', `Deleted ${x.name}${moving.length ? '; its work moved to Admin' : ''}${regionsLeft.length ? `; ${regionsLeft.join(', ')} left with no admission queue` : ''}`, (c) => ({
            ...c,
            queues: c.queues.filter((y) => y.id !== x.id),
            kinds: regional ? c.kinds : c.kinds.map((k) => (k.to === x.id ? { ...k, to: 'q-admin' } : k)),
            regions: c.regions.map((r) => (r.queue === x.id ? { ...r, queue: '' } : r)),
          }));
          say(`${x.name} deleted.`);
          setRemoving(null);
        }}
      >
        <p>
          {!moving.length
            ? 'Nothing lands in it, so no work moves.'
            : removing?.type === 'Team'
              ? `Its ${moving.length} ${moving.length === 1 ? 'kind of work goes' : 'kinds of work go'} to the Admin queue until you choose another in Kinds of Work.`
              : `Its region’s ${removing?.type} work goes to the Admin queue until you create another queue for it.`}
        </p>
        {removing && cfg.regions.some((r) => r.queue === removing.id) && <p>{`${cfg.regions.filter((r) => r.queue === removing.id).map((r) => r.name).join(', ')} will have no admission queue in Sales Regions.`}</p>}
      </ConfirmDialog>
    </>
  );
}

/** Create or edit a queue (5 Nov): its name and leader, how work is shared and its members; 5 Nov (later): the people picked listed below, no “What lands here”. */
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
    lead: !lead ? 'Choose the leader.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const picked = members.filter((n) => n !== leadName);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const ids = members.filter((n) => n !== leadName).map((n) => users.find((u) => u.name === n)?.id).filter((x): x is string => !!x);
    onSave({ ...(queue ?? { type: 'Team' as QueueType }), id: queue?.id ?? `q-${Date.now()}`, name: v, lead, sharing, members: ids });
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
        <Field id="wq-lead" label="Leader" required error={show('lead')} hint="Gets escalations and covers leave.">
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
            {(Object.keys(SHARING) as Sharing[]).map((k) => (
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

/** Where a kind of work can go: each region's own queue, or a team's. */
const destOptions = (teams: Queue[]) => (
  <>
    <optgroup label="By sales region">
      <option value={REGION_ADMISSIONS}>Each region’s Admissions queue</option>
      <option value={REGION_RECRUITMENT}>Each region’s Recruitment queue</option>
    </optgroup>
    <optgroup label="Teams">
      {teams.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}
        </option>
      ))}
    </optgroup>
  </>
);

/**
 * Kinds of work: the queue each lands in and its SLA. 5 Nov (later, Nesil, after the reference screens): each is added
 * and edited in a pop-up (Add Kind of Work; the three dots' Edit and Delete), and one a task rule uses can't be deleted.
 */
function KindsTab({ cfg, change, say, onEdit }: ConfigProps & { onEdit: (k: WorkKind) => void }) {
  const [removing, setRemoving] = useState<WorkKind | null>(null);
  const usedBy = (k: WorkKind) => cfg.taskRules.filter((r) => r.kind === k.id);
  return (
    <>
      <Panel flush title="Kinds of Work" note="Each lands in one queue and is due within its SLA, counted in working time.">
        <div className="stab-wrap">
          <table className="itab cfg__tab wk-kinds">
            <colgroup>
              <col />
              <col />
              <col />
              <col className="cfg__actcol" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Kind of work</th>
                <th scope="col">Goes to</th>
                <th scope="col">Due in</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            {AREAS.map((a) => {
              const list = cfg.kinds.filter((k) => k.area === a);
              if (!list.length) return null;
              return (
                <tbody key={a}>
                  <tr className="wk-group">
                    <th scope="colgroup" colSpan={4}>
                      {a} <span className="num">{list.length}</span>
                    </th>
                  </tr>
                  {list.map((k) => (
                    <tr key={k.id}>
                      <td className="cfg__strong">{k.name}</td>
                      <td>{destName(k.to, cfg.queues)}</td>
                      <td>
                        <span className="num">{dueText(k.due, k.unit)}</span>
                      </td>
                      <td className="cfg__acts">
                        <MoreMenu
                          id={`wk-${k.id}`}
                          label={`More for ${k.name}`}
                          items={[
                            {
                              id: 'edit',
                              label: 'Edit Kind of Work',
                              icon: 'edit',
                              onPick: () => onEdit(k),
                            },
                            ...(usedBy(k).length
                              ? []
                              : [
                                  {
                                    id: 'remove',
                                    label: 'Delete Kind of Work',
                                    icon: 'close' as IconName,
                                    danger: true,
                                    onPick: () => setRemoving(k),
                                  },
                                ]),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Kinds of work" />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}?`}
        confirm="Delete Kind of Work"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const x = removing!;
          change('Kinds of work', `Deleted ${x.name}`, (c) => ({
            ...c,
            kinds: c.kinds.filter((k) => k.id !== x.id),
          }));
          say(`${x.name} deleted.`);
          setRemoving(null);
        }}
      >
        <p>No new tasks of this kind are made. Open ones keep their queue and SLA.</p>
      </ConfirmDialog>
    </>
  );
}

/** Add or edit a kind of work (5 Nov, later): the kind of work, its area, the queue it goes to and its SLA. */
function KindSheet({
  open,
  kind,
  kinds,
  queues,
  rules,
  onClose,
  onSave,
}: {
  open: boolean;
  kind: WorkKind | null;
  kinds: WorkKind[];
  queues: Queue[];
  rules: TaskRule[];
  onClose: () => void;
  onSave: (k: WorkKind) => void;
}) {
  const [name, setName] = useState('');
  const [area, setArea] = useState<WorkKind['area']>(AREAS[0]);
  const [to, setTo] = useState('');
  const [due, setDue] = useState('1');
  const [unit, setUnit] = useState<DueUnit>('days');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(kind?.name ?? '');
    setArea(kind?.area ?? AREAS[0]);
    setTo(kind?.to ?? '');
    setDue(String(kind?.due ?? 1));
    setUnit(kind?.unit ?? 'days');
    setTried(false);
  }, [open, kind?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = name.trim();
  const n = Number(due);
  const max = unit === 'hours' ? 99 : 60;
  const err = {
    name: !v
      ? 'Name the kind of work.'
      : v.length > 80
        ? 'Keep it to 80 characters.'
        : kinds.some((x) => x.id !== kind?.id && x.name.toLowerCase() === v.toLowerCase())
          ? 'There’s already a kind of work with this name.'
          : null,
    to: !to ? 'Choose where it goes.' : null,
    due: !Number.isInteger(n) || n < 1 || n > max ? `A whole number from 1 to ${max}.` : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const used = kind ? rules.filter((r) => r.kind === kind.id) : [];
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({
      id: kind?.id ?? `k-${Date.now()}`,
      name: v,
      area,
      to,
      due: n,
      unit,
    });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet wk-sheet"
      title={kind ? `Edit ${kind.name}` : 'Add Kind of Work'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{kind ? 'Save Changes' : 'Add Kind of Work'}</Button>
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
      <div className="wk-form wk-form--one">
        <Field id="wkk-name" label="Kind of work" required error={show('name')}>
          <TextInput id="wkk-name" value={name} maxLength={80} invalid={!!show('name')} placeholder="Like: Check offer conditions" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="wkk-area" label="Area" required>
          <SelectInput id="wkk-area" value={area} onChange={(e) => setArea(e.target.value as WorkKind['area'])}>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="wkk-to" label="Goes to" required error={show('to')} hint="Every task of this kind lands here.">
          <SelectInput id="wkk-to" value={to} placeholder="Choose a queue" invalid={!!show('to')} aria-describedby="wkk-to-hint" onChange={(e) => setTo(e.target.value)}>
            {destOptions(queues.filter((q) => q.type === 'Team'))}
          </SelectInput>
        </Field>
        <Field id="wkk-due" label="Due in" required error={show('due')} hint="Counted on the working days of the record’s sales region.">
          <span className="wk-due">
            <Stepper id="wkk-due" label="Due in" value={due} min={1} max={max} invalid={!!show('due')} describedBy="wkk-due-hint" onChange={setDue} />
            <SelectInput id="wkk-unit" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as DueUnit)}>
              <option value="hours">working hours</option>
              <option value="days">working days</option>
            </SelectInput>
          </span>
        </Field>
      </div>
      {used.length > 0 && <p className="cfg__muted wk-used">{`Task rule ${used.map((r) => `“${r.name}”`).join(', ')} uses it, so it can’t be deleted.`}</p>}
    </Sheet>
  );
}

/** A whole number with − and + (Nesil, 5 Nov: Due in, the reminder and the escalation levels). */
function Stepper({ id, value, min, max, label, invalid, onChange, describedBy }: { id: string; value: string; min: number; max: number; label: string; invalid?: boolean; onChange: (v: string) => void; describedBy?: string }) {
  const n = Number(value) || 0;
  const step = (d: number) => onChange(String(Math.max(min, Math.min(max, (n || min) + d))));
  return (
    <div className={`control istepper wk-stepper ${invalid ? 'is-invalid' : ''}`}>
      <button type="button" className="istepper__b" aria-label={`Less: ${label}`} disabled={n <= min} onClick={() => step(-1)}>
        <Icon name="minus" size={18} />
      </button>
      <input id={id} className="control__input istepper__v num" inputMode="numeric" value={value} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, String(max).length))} onBlur={() => value && step(0)} />
      <button type="button" className="istepper__b" aria-label={`More: ${label}`} disabled={n >= max} onClick={() => step(1)}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

const hoursText = (h: number) => `${h} working ${h === 1 ? 'hour' : 'hours'} a day`;

/**
 * Working Days (Nesil, 5 Nov, later; the reference's calendars, designed simpler): one card a calendar, with its days,
 * hours (IST), sales regions and holidays. Add Calendar and each card's three dots (Edit, Delete) use a pop-up;
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
          Every SLA counts the working hours of its record’s sales region, all in <strong>IST</strong>. A record with no region uses <strong>{def?.name}</strong>.
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
                    {daysShort(c.days)} · {time12(c.from)} to {time12(c.to)} IST · {hoursText(dayHours(c.from, c.to))}
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

/** Add or edit a calendar: its name, working days, hours (IST) and sales regions. */
function CalendarSheet({ open, cal, cals, regions, onClose, onSave }: { open: boolean; cal: Calendar | null; cals: Calendar[]; regions: string[]; onClose: () => void; onSave: (c: Calendar) => void }) {
  const [name, setName] = useState('');
  const [days, setDays] = useState<boolean[]>([]);
  const [from, setFrom] = useState('09:30');
  const [to, setTo] = useState('18:30');
  const [regs, setRegs] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(cal?.name ?? '');
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
    hours: !from || !to ? 'Set when the day starts and ends.' : hrs === 0 ? 'The day needs some working hours.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const moving = regs.filter((r) => cals.some((x) => x.id !== cal?.id && x.regions.includes(r)));
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ id: cal?.id ?? `cal-${Date.now()}`, name: v, days, from, to, regions: regs, holidays: cal?.holidays ?? [] });
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
        <Field id="wc-from" label="Day starts (IST)" required error={show('hours')}>
          <TextInput id="wc-from" type="time" value={from} invalid={!!show('hours')} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="wc-to" label="Day ends (IST)" required hint={hrs ? `${hoursText(hrs)}${to < from ? ', past midnight' : ''}.` : undefined}>
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
  const err = { date: !date ? 'Choose the date.' : cal?.holidays.some((h) => h.date === date) ? 'That day is a holiday already.' : null, name: !name.trim() ? 'Name the holiday.' : null };
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

/**
 * Reminders and escalation (5 Nov, later, after the reference): the same steps for every queue, read as they are until
 * Edit; then the reminder, levels 2 and 3 (steppers) and the morning email's time can change, and Save Changes.
 */
function RemindersTab({ cfg, change, say }: ConfigProps) {
  const [draft, setDraft] = useState<{ soon: string; l2: string; l3: string; mail: string } | null>(null);
  const l = cfg.ladder;
  const num = (k: 'soon' | 'l2' | 'l3') => Number(draft ? draft[k] : l[k]);
  const dirty = !!draft && (num('soon') !== l.soon || num('l2') !== l.l2 || num('l3') !== l.l3 || draft.mail !== l.mail);
  const bad = !!draft && (num('l2') >= num('l3') || !num('soon') || !num('l2') || !num('l3') || !draft.mail);
  const days = (n: number) => `${n} working ${n === 1 ? 'day' : 'days'}`;
  const val = (k: 'soon' | 'l2' | 'l3', label: string, max: number) =>
    draft ? <Stepper id={`wr-${k}`} label={label} value={draft[k]} min={1} max={max} onChange={(x) => setDraft((d) => ({ ...d!, [k]: x }))} /> : <strong className="num">{days(l[k])}</strong>;
  const steps: { icon: IconName; tone: string; title: ReactNode; who: string; how: string; line?: string }[] = [
    { icon: 'plus', tone: 'new', title: 'A task is created', who: 'Its assignee, or every member while it waits in the queue', how: 'A bell notification, and the task in their queue' },
    { icon: 'clock', tone: 'soon', title: <>Reminder {val('soon', 'Working days before due', 5)} before it’s due</>, who: 'Its assignee, on tasks with an SLA of 2 working days or more', how: 'A bell notification and the morning email' },
    { icon: 'alert', tone: 'due', title: 'Level 1: due, and not done', who: 'Its assignee and the queue’s leader', how: 'Bell, the morning email, and a red mark on the task', line: '“‹Leader› (leader) told”' },
    { icon: 'arrowRight', tone: 'l2', title: <>Level 2: late by {val('l2', 'Level 2: working days late', 10)}</>, who: 'The team’s Ops queue: Admission Ops for Admissions queues, RP Ops for Recruitment, IP Ops for IP Ops, Finance for Finance; else Admin', how: 'The task shows in that queue too, for all its members', line: '“Escalated to ‹queue›”' },
    { icon: 'arrowRight', tone: 'l3', title: <>Level 3: late by {val('l3', 'Level 3: working days late', 20)}</>, who: 'The Admin queue', how: 'Bell, an email to every Admin, and an alert on Home', line: '“Escalated to Admin”' },
  ];
  const save = () => {
    if (bad) return;
    const n = { soon: num('soon'), l2: num('l2'), l3: num('l3'), mail: draft!.mail };
    change('Reminders and escalation', `Reminder ${days(n.soon)} before due; level 2 at ${days(n.l2)} late, level 3 at ${days(n.l3)} late; morning email at ${time12(n.mail)} IST`, (c) => ({ ...c, ladder: n }));
    say('Reminders and escalation saved.');
    setDraft(null);
  };
  return (
    <>
      <Panel
        title="Reminders and Escalation"
        note="The same for every queue. Days are working days, counted on the record’s calendar."
        action={<EditActions editing={!!draft} dirty={dirty && !bad} onEdit={() => setDraft({ soon: String(l.soon), l2: String(l.l2), l3: String(l.l3), mail: l.mail })} onCancel={() => setDraft(null)} onSave={save} />}
      >
        <ol className={`wk-steps ${draft ? 'is-editing' : ''}`}>
          {steps.map((s, i) => (
            <li key={i} className={`wk-step wk-step--${s.tone}`}>
              <span className="wk-step__mark" aria-hidden="true">
                <Icon name={s.icon} size={16} />
              </span>
              <div className="wk-step__t">
                <p className="wk-step__title">{s.title}</p>
                <dl className="wk-step__dl">
                  <div>
                    <dt>Who’s told</dt>
                    <dd>{s.who}</dd>
                  </div>
                  <div>
                    <dt>How</dt>
                    <dd>{s.how}</dd>
                  </div>
                  <div>
                    <dt>On the task</dt>
                    <dd>{s.line ?? '—'}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ol>
        {draft && num('l2') >= num('l3') && <p className="cfg__warn">Level 3 comes after level 2.</p>}
        <p className="wk-note">Escalation doesn’t make a new task or change who has it: the same task is shown to more people.</p>
        <div className="wk-mail">
          <Icon name="mail" size={18} />
          <span className="wk-mail__t">
            One morning email a day, at{' '}
            {draft ? (
              <span className="wk-mail__time">
                <TextInput id="wr-mail" type="time" aria-label="Morning email time, IST" value={draft.mail} onChange={(e) => setDraft((d) => ({ ...d!, mail: e.target.value }))} />
              </span>
            ) : (
              <strong className="num">{time12(l.mail)}</strong>
            )}{' '}
            IST, with everything due or late: never one email per task.
          </span>
        </div>
      </Panel>
      <History log={cfg.log} area="Reminders and escalation" />
    </>
  );
}

/**
 * Task Rules (Nesil, 5 Nov; later the same day after the reference's Task rules, designed simpler): the rules that make
 * every task, filtered by area, in one table each (when, the task and its kind; where it goes and how it's shared; when
 * it starts, its SLA and the RP reminder; on or off). Edit opens a short pop-up. Then the requests people can raise.
 */
export function TaskRules({ cfg, change, say }: ConfigProps) {
  const [cat, setCat] = useState<RuleCat | ''>('');
  const [editing, setEditing] = useState<TaskRule | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ to: string; type: string } | null>(null);
  const kindOf = (id: string) => cfg.kinds.find((k) => k.id === id);
  const goesTo = (r: TaskRule) => (r.fixed ? 'The team’s Ops queue, then Admin' : destName(kindOf(r.kind)?.to ?? 'q-admin', cfg.queues));
  const shown = cat ? RULE_CATS.filter((c) => c === cat) : RULE_CATS;
  return (
    <>
      <PageHead title="Task Rules" lead="The rules that make every task. Times count on the record’s working calendar." />
      <div className="wk-cats" role="group" aria-label="Show rules for">
        <button type="button" className="ichip" aria-pressed={!cat} onClick={() => setCat('')}>
          All <span className="num">{cfg.taskRules.length}</span>
        </button>
        {RULE_CATS.map((c) => (
          <button key={c} type="button" className="ichip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c} <span className="num">{cfg.taskRules.filter((r) => r.cat === c).length}</span>
          </button>
        ))}
      </div>
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
                    <th scope="col">#</th>
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
                  {rows.map((r) => {
                    const k = kindOf(r.kind);
                    return (
                      <tr key={r.id} className={r.on ? '' : 'is-off'}>
                        <td className="num cfg__strong">{r.code}</td>
                        <td>
                          <span className="cfg__strong">{r.when}</span>
                          <span className="cfg__sub">{r.task}</span>
                        </td>
                        <td>
                          {goesTo(r)}
                          {!r.fixed && <span className="cfg__sub">{r.sharing === 'queue' ? `${SHARING[(cfg.queues.find((q) => q.id === k?.to) ?? cfg.queues.find((q) => q.type === (k?.to === REGION_RECRUITMENT ? 'Recruitment' : 'Admissions')))?.sharing ?? 'fewest'].label} (the queue’s way)` : RULE_SHARING[r.sharing]}</span>}
                        </td>
                        <td className="num">{spanShort(r.after)}</td>
                        <td className="num">{r.fixed ? '—' : r.sla ? spanShort(r.sla) : <span className="cfg__muted" title="Its kind of work’s SLA">{k ? spanShort({ n: k.due, unit: k.unit }) : '—'}</span>}</td>
                        <td className="num">{spanShort(r.remind)}</td>
                        <td>
                          <Switch
                            id={`wt-on-${r.id}`}
                            checked={r.on}
                            onChange={(on) => {
                              change('Task rules', `${r.code} ${r.name} switched ${on ? 'on' : 'off'}`, (x) => ({ ...x, taskRules: x.taskRules.map((y) => (y.id === r.id ? { ...y, on } : y)) }));
                              say(`${r.code} ${r.name}: ${on ? 'on' : 'off'}.`);
                            }}
                          >
                            <span className="vh">
                              {r.code} {r.name}
                            </span>
                          </Switch>
                        </td>
                        <td className="cfg__acts">
                          {!r.fixed && (
                            <button type="button" className="btn btn--link wk-tr-edit" onClick={() => setEditing(r)}>
                              Edit<span className="vh"> {r.code}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
      <Panel flush title="Requests People Can Raise" note="Raised from a record; each lands in its queue.">
        <div className="stab-wrap">
          <table className="itab cfg__tab wk-reqs">
            <thead>
              <tr>
                <th scope="col">Goes to</th>
                <th scope="col">Request types</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.requests.map((r) => (
                <tr key={r.to}>
                  <td className="cfg__strong">{destName(r.to, cfg.queues)}</td>
                  <td>
                    <span className="wk-people">
                      {r.types.map((t) => (
                        <span key={t} className="cfg__chip cfg__chip--plain wk-type">
                          {t}
                          <button type="button" className="wk-type__x" aria-label={`Remove ${t}`} onClick={() => setRemoving({ to: r.to, type: t })}>
                            <Icon name="close" size={12} />
                          </button>
                        </span>
                      ))}
                      {!r.types.length && <span className="cfg__muted">None yet</span>}
                    </span>
                  </td>
                  <td className="cfg__acts">
                    <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={14} />} onClick={() => setAdding(r.to)}>
                      Add Type<span className="vh"> for {destName(r.to, cfg.queues)}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Task rules" />
      <RuleSheet
        rule={editing}
        kinds={cfg.kinds}
        queues={cfg.queues}
        onClose={() => setEditing(null)}
        onSave={(r) => {
          const bits = [r.after ? `starts after ${spanText(r.after)}` : 'starts at once', r.sla ? `SLA ${spanText(r.sla)}` : 'its kind’s SLA', r.remind ? `RP reminded after ${spanText(r.remind)}` : 'no RP reminder', `shared to ${RULE_SHARING[r.sharing].toLowerCase()}`];
          change('Task rules', `${r.code} ${r.name}: ${bits.join(', ')}`, (x) => ({ ...x, taskRules: x.taskRules.map((y) => (y.id === r.id ? r : y)) }));
          say(`${r.code} saved.`);
          setEditing(null);
        }}
      />
      <TypeSheet
        to={adding}
        name={adding ? destName(adding, cfg.queues) : ''}
        taken={cfg.requests.find((r) => r.to === adding)?.types ?? []}
        onClose={() => setAdding(null)}
        onSave={(t) => {
          const to = adding!;
          change('Task rules', `Added the request type “${t}” for ${destName(to, cfg.queues)}`, (c) => ({ ...c, requests: c.requests.map((r) => (r.to === to ? { ...r, types: [...r.types, t] } : r)) }));
          say(`${t} added.`);
          setAdding(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Remove “${removing?.type}”?`}
        confirm="Remove Type"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const x = removing!;
          change('Task rules', `Removed the request type “${x.type}” for ${destName(x.to, cfg.queues)}`, (c) => ({ ...c, requests: c.requests.map((r) => (r.to === x.to ? { ...r, types: r.types.filter((t) => t !== x.type) } : r)) }));
          say(`${x.type} removed.`);
          setRemoving(null);
        }}
      >
        <p>People can’t raise it from now. Requests already raised stay open until they’re closed.</p>
      </ConfirmDialog>
    </>
  );
}

const SHARE_WORDS: Record<RuleSharing, string> = { officer: 'for the application’s officer', queue: 'shared the queue’s way', fewest: 'for whoever has the fewest open', owner: 'for the record’s owner', leader: 'for its leader', pick: 'for a member to pick' };

/** A length of time, or none: a number (empty: none) and its unit. */
function SpanField({ id, label, value, unit, onValue, onUnit, required, error, hint }: { id: string; label: string; value: string; unit: SpanUnit; onValue: (v: string) => void; onUnit: (u: SpanUnit) => void; required?: boolean; error?: string | null; hint?: string }) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <span className="wk-due">
        <TextInput id={id} inputMode="numeric" value={value} placeholder="None" invalid={!!error} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onValue(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        <SelectInput id={`${id}-unit`} aria-label={`${label}: unit`} value={unit} onChange={(e) => onUnit(e.target.value as SpanUnit)}>
          {(Object.keys(SPAN_UNITS) as SpanUnit[]).map((u) => (
            <option key={u} value={u}>
              {SPAN_UNITS[u]}
            </option>
          ))}
        </SelectInput>
      </span>
    </Field>
  );
}

/** Edit a task rule (5 Nov, later): what's built in, at a glance; then when it starts, its SLA, the RP reminder and how it's shared. */
function RuleSheet({ rule, kinds, queues, onClose, onSave }: { rule: TaskRule | null; kinds: WorkKind[]; queues: Queue[]; onClose: () => void; onSave: (r: TaskRule) => void }) {
  const [v, setV] = useState({ after: '', afterU: 'hours' as SpanUnit, sla: '', slaU: 'hours' as SpanUnit, remind: '', remindU: 'hours' as SpanUnit, sharing: 'queue' as RuleSharing });
  useEffect(() => {
    if (rule)
      setV({ after: rule.after ? String(rule.after.n) : '', afterU: rule.after?.unit ?? 'hours', sla: rule.sla ? String(rule.sla.n) : '', slaU: rule.sla?.unit ?? 'hours', remind: rule.remind ? String(rule.remind.n) : '', remindU: rule.remind?.unit ?? 'hours', sharing: rule.sharing });
  }, [rule?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = kinds.find((x) => x.id === rule?.kind);
  const span = (n: string, unit: SpanUnit): Span => (n && Number(n) > 0 ? { n: Number(n), unit } : null);
  const next: TaskRule | null = rule ? { ...rule, after: span(v.after, v.afterU), sla: span(v.sla, v.slaU), remind: span(v.remind, v.remindU), sharing: v.sharing } : null;
  const dirty = !!rule && JSON.stringify(next) !== JSON.stringify(rule);
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const sla = next?.sla ?? (k ? { n: k.due, unit: k.unit } : null);
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
            <Button disabled={!dirty} onClick={() => next && onSave(next)}>
              Save Changes
            </Button>
          </div>
        </div>
      }
    >
      {rule && (
        <>
          <dl className="wk-built">
            <div>
              <dt>When</dt>
              <dd>{rule.when}</dd>
            </div>
            <div>
              <dt>Task</dt>
              <dd>{rule.task}</dd>
            </div>
            <div>
              <dt>Closes when</dt>
              <dd>{rule.closes}</dd>
            </div>
            <div>
              <dt>Goes to</dt>
              <dd>
                {k ? destName(k.to, queues) : 'Admin'}
                <span className="cfg__sub">From its kind of work, {k?.name ?? '—'}: change it in Kinds of Work.</span>
              </dd>
            </div>
          </dl>
          <div className="wk-form">
            <SpanField id="wt-after" label="Task starts after" value={v.after} unit={v.afterU} onValue={(x) => set({ after: x })} onUnit={(u) => set({ afterU: u })} hint="Empty: at once." />
            <SpanField id="wt-sla" label="SLA" value={v.sla} unit={v.slaU} onValue={(x) => set({ sla: x })} onUnit={(u) => set({ slaU: u })} hint={k ? `Empty: its kind of work’s, ${dueText(k.due, k.unit)}.` : 'Empty: its kind of work’s.'} />
            <SpanField id="wt-remind" label="RP reminded after" value={v.remind} unit={v.remindU} onValue={(x) => set({ remind: x })} onUnit={(u) => set({ remindU: u })} hint="Empty: no reminder." />
            <Field id="wt-share" label="How it’s shared" required>
              <SelectInput id="wt-share" value={v.sharing} onChange={(e) => set({ sharing: e.target.value as RuleSharing })}>
                {(Object.keys(RULE_SHARING) as RuleSharing[]).map((s) => (
                  <option key={s} value={s}>
                    {RULE_SHARING[s]}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <p className="wk-words">
            {`${next?.after ? `After ${spanText(next.after)}, “` : '“'}${rule.task}” goes to ${k ? destName(k.to, queues).replace(/^Each/, 'each') : 'Admin'}, ${SHARE_WORDS[v.sharing]}, due in ${sla ? spanText(sla) : '—'}.`}
          </p>
        </>
      )}
    </Sheet>
  );
}

/** Add a request type for a queue. */
function TypeSheet({ to, name, taken, onClose, onSave }: { to: string | null; name: string; taken: string[]; onClose: () => void; onSave: (t: string) => void }) {
  const [v, setV] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (to) (setV(''), setTried(false));
  }, [to]);
  const t = v.trim();
  const err = !t ? 'Name the request type.' : taken.some((x) => x.toLowerCase() === t.toLowerCase()) ? 'It’s on the list already.' : null;
  return (
    <Sheet
      open={!!to}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title="Add Request Type"
      sub={name ? `People can raise it for ${name}.` : undefined}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!err) onSave(t);
              }}
            >
              Add Type
            </Button>
          </div>
        </div>
      }
    >
      <Field id="wt-type" label="Request type" required error={tried ? err : null}>
        <TextInput id="wt-type" value={v} placeholder="Like: Update IP contacts" invalid={tried && !!err} onChange={(e) => setV(e.target.value)} />
      </Field>
    </Sheet>
  );
}
