// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * Admin › Work › Queues, SLA and escalation (slice 4 PRD): Queues, Kinds of work, Working days, Reminders and
 * escalation. The only queue editor (S4-1). Admin and Global Ops edit; every other GSP role views. Every change is in
 * the page's Change history and Admin's Audit log. All times are IST (S4-27).
 * Routing (5 Nov) is one setting: each kind of work's Goes to (Kinds of work). A queue's "What lands in this queue"
 * and the Receives column are worked out from it; a queue can't be deleted while a kind goes to it.
 */
import React, { useState } from 'react';
import { useStore, update, logChange, nameOf, SHARE, SHARE_HELP, removeQueue, saveKind, goesToName, goesToOptions, goesToValid, kindsGoingTo, receivesOf, ROUTED } from './store';
import { can } from '../finance/access';
import { Page, Card, Tabs, Table, Pill, Button, LinkButton, Sheet, Field, Input, Num, Chip, Notice, toast, NumberInput, DateField } from '../finance/kit';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useCheck, numError, dupError, dateError } from '../components/validate';
import { fmtDate, fmtWhen } from '../data/format';
import { PersonaBar, usePersona } from './persona';
import { useCalendars, getCalendars, setCalendars, daysText, clockText, regionsOn, putRegionsOn, dayOf, DEFAULT_START, DEFAULT_END } from './calendars';
import { salesRegionNames } from '../admin/data/config';
import { MultiPick } from '../institution/records/MultiPick';
import { Pick, TimePick } from './ui';

const ADMIN_Q = 'q-admin';
/** Where the page opens next (another page's link, like Task rules' "Change it in Kinds of work"): a tab and a kind to edit. */
export const queuesNav = { tab: null, kind: null };

export default function Queues() {
  const s = useStore();
  const { user, role } = usePersona();
  const [tab, setTab] = useState(() => queuesNav.tab || 'queues');
  const [kindOpen, setKindOpen] = useState(() => queuesNav.kind);
  React.useEffect(() => { queuesNav.tab = null; queuesNav.kind = null; }, []);
  const may = a => can(s.matrix, role.id, 'queues', a);
  const openKind = id => { setKindOpen(id || null); setTab('kinds'); };
  return (
    <Page cfg title="Queues, SLA and escalation" top={<PersonaBar />}
      lead="A queue is a team’s inbox: a name, one leader, members, and how work is shared. Every task belongs to exactly one queue: the one its kind of work goes to. Set where each kind of work goes and what it’s due in, the working days every SLA counts on, and who is told when a task is late. All times are IST."
      actions={tab === 'queues' && may('C') ? <QueueButton by={user} /> : tab === 'kinds' && may('C') ? <KindButton by={user} /> : null}>
      {!may('U') && <Notice>{role.name} can see this page but not change it.</Notice>}
      <Tabs label="Section" value={tab} onChange={setTab}
        options={[['queues', `Queues (${s.queues.length})`], ['kinds', `Kinds of work (${s.kinds.length})`], ['calendars', 'Working days'], ['escalation', 'Reminders and escalation']]} />
      {tab === 'queues' && <QueueList may={may} by={user} openKind={openKind} />}
      {tab === 'kinds' && <KindList may={may} by={user} openId={kindOpen} onOpened={() => setKindOpen(null)} />}
      {tab === 'calendars' && <Calendars may={may} by={user} />}
      {tab === 'escalation' && <Escalation may={may} by={user} />}
      <ChangeLog />
    </Page>
  );
}

function QueueButton({ by }) {
  const [open, setOpen] = useState(false);
  return <><Button kind="primary" onClick={() => setOpen(true)}>Create queue</Button>{open && <QueueSheet onClose={() => setOpen(false)} by={by} />}</>;
}

function QueueList({ may, by, openKind }) {
  const s = useStore();
  const [edit, setEdit] = useState(null);
  // a leader is required on save: only a queue saved before that can have none
  const noLead = s.queues.filter(q => !q.leader);
  return (
    <>
      {noLead.length > 0 && <Notice tone="warn">No leader: {noLead.map(q => q.name).join(', ')}. Escalations from these queues go to the Admin queue.</Notice>}
      <Card flush>
        <Table head={['Queue', 'Leader', 'Members', 'How work is shared', 'Receives', '']} className="cfg__tab">
          {s.queues.map(q => (
            <tr key={q.id}>
              <td className="cfg__strong">{q.name}{q.id === ADMIN_Q && <span className="cfg__sub">Tasks with no queue and level 3 escalations</span>}{q.id === 'q-adm-global' && <span className="cfg__sub">The Global Ops team’s queue</span>}</td>
              <td>{q.leader ? <span className="cfg__strong">{nameOf(s, q.leader)}</span> : <Pill tone="dpill--bad">Not set</Pill>}</td>
              <td>{(q.members || []).length ? <div className="cfg__chips">{q.members.slice(0, 6).map(m => <Chip key={m}>{nameOf(s, m)}</Chip>)}{q.members.length > 6 && <span className="muted">+{q.members.length - 6} more</span>}</div> : <span className="cfg__muted">Just the leader</span>}</td>
              <td>{SHARE[q.assign] || SHARE['fewest-open']}</td>
              <td>{(() => { const names = receivesOf(s, q).all.map(k => k.name); return names.length ? <span className="gspx-wrap" title={names.join(', ')}>{names.slice(0, 2).join(', ')}{names.length > 2 ? <span className="muted"> +{names.length - 2} more</span> : null}</span> : <span className="cfg__muted">Nothing yet</span>; })()}</td>
              <td className="cfg__acts">{may('U') && <LinkButton aria-label={`Edit ${q.name}`} onClick={() => setEdit(q)}>Edit</LinkButton>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && <QueueSheet queue={edit} onClose={() => setEdit(null)} by={by} canDelete={may('D') && edit.id !== ADMIN_Q} openKind={id => { setEdit(null); openKind(id); }} />}
    </>
  );
}

/**
 * A queue (slice 4 PRD, A queue): name, leader, members and how work is shared. No type, no regions (S4-24). What
 * lands in it is read-only here (5 Nov): the kinds of work whose Goes to is this queue, set in Kinds of work.
 */
function QueueSheet({ queue, onClose, by, canDelete, openKind }) {
  const s = useStore();
  const isNew = !queue;
  const init = React.useRef(queue ? (({ kinds, ...q }) => structuredClone(q))(queue) : { id: 'q-' + Date.now(), name: '', leader: '', members: [], assign: 'fewest-open' });
  const [v, setV] = useState(() => structuredClone(init.current));
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const gsp = s.users.filter(u => !['rp-admin', 'branch-admin', 'counsellor'].includes(u.role) && s.roles.some(r => r.id === u.role));
  const label = u => `${u.name} · ${s.roles.find(r => r.id === u.role).name}`;
  const [sure, setSure] = useState(false);
  const errors = {
    name: !v.name.trim() ? 'Enter the queue name, like India Admissions.' : v.name.trim().length > 60 ? 'Keep the name to 60 characters or fewer.' : dupError(v.name, s.queues.filter(q => q.id !== v.id).map(q => q.name), 'There’s already a queue with this name.'),
    leader: !v.leader ? 'Choose the queue’s leader.' : null,
  };
  const c = useCheck(errors);
  const dirty = JSON.stringify(v) !== JSON.stringify(init.current);
  const open = s.tasks.filter(t => t.queue === v.id && t.status === 'open').length;
  const save = () => {
    if (!c.submit()) return;
    const { kinds, ...rest } = v;
    const x = { ...rest, name: v.name.trim(), members: (v.members || []).filter(m => m !== v.leader) };
    update(d => { const i = d.queues.findIndex(q => q.id === x.id); if (i >= 0) d.queues[i] = x; else d.queues.push(x); });
    logChange(isNew ? 'queue.created' : 'queue.edited', `${by.name} ${isNew ? 'created' : 'edited'} queue ${x.name}: leader ${x.leader ? nameOf(s, x.leader) : 'not set'}, ${x.members.length} member${x.members.length === 1 ? '' : 's'}, ${SHARE[x.assign]}`, by.name);
    toast(isNew ? 'Queue created' : 'Applies to new work from now'); onClose();
  };
  const remove = () => {
    const r = removeQueue(v.id, by.name);
    if (r.refused?.length) { toast('Queue not deleted', { text: `${r.refused.map(k => k.name).join(', ')} still ${r.refused.length === 1 ? 'goes' : 'go'} to it.` }); return; }
    toast('Queue deleted', { text: r.open ? 'Its open tasks moved to the Admin queue.' : undefined }); onClose();
  };
  const gets = isNew ? { direct: [], region: [], recruitment: [], all: [] } : receivesOf(s, v);
  const blocking = isNew ? [] : kindsGoingTo(s, v.id);
  const app = gets.all.some(k => k.record === 'Application');
  const kindLink = k => <LinkButton aria-label={`${k.name} in Kinds of work`} onClick={() => openKind(k.id)}>{k.name}</LinkButton>;
  const routedName = id => ROUTED.find(x => x.id === id)?.name.replace(/^The/, 'the');
  return (
    <>
    <Sheet wide title={isNew ? 'Create queue' : `Edit ${queue.name}`} onClose={onClose} dirty={dirty} what={isNew ? 'the new queue' : queue.name}
      footer={<>{!isNew && canDelete && <Button kind="danger-quiet" onClick={() => setSure(true)}>Delete queue</Button>}<span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={!isNew && !dirty} onClick={save}>{isNew ? 'Create queue' : 'Save'}</Button></>}>
      <div className="cfg__form gspx-form2">
        <Field id="q-name" label="Queue name" required error={c.err('name')} hint="Up to 60 characters."><Input id="q-name" value={v.name} maxLength={60} onBlur={c.blur('name')} onChange={x => set('name', x)} placeholder="Like: India Admissions" /></Field>
        <Pick id="q-lead" label="Leader" required error={c.err('leader')} hint="Gets escalations, covers people on leave, can assign. Every queue has one." value={v.leader || ''} onChange={x => set('leader', x)} placeholder="Choose one person" options={gsp.map(u => [u.id, label(u)])} />
        <Pick id="q-assign" label="How work is shared" required value={v.assign in SHARE ? v.assign : 'fewest-open'} onChange={x => set('assign', x)} options={Object.entries(SHARE)} hint={SHARE_HELP[v.assign] || SHARE_HELP['fewest-open']} />
        <div className="field"><span className="field__label">Members</span>
          <MultiPick id="q-members" label="Members" search empty="Just the leader" value={gsp.filter(u => (v.members || []).includes(u.id) && u.id !== v.leader).map(label)} options={gsp.filter(u => u.id !== v.leader).map(label)}
            onChange={l => set('members', gsp.filter(u => l.includes(label(u))).map(u => u.id))} />
          <p className="field__msg">The leader is a member anyway. A deactivated user stays listed until deleted, but gets no new work. Anyone can be in any queue: each person sees only records in their own sales regions.</p>
        </div>
      </div>
      <section className="field" aria-labelledby="q-kinds">
        <span className="field__label" id="q-kinds">What lands in this queue</span>
        {gets.all.length ? <ul className="gspx-list">
          {gets.direct.map(k => <li key={k.id}>{kindLink(k)}</li>)}
          {gets.region.length > 0 && <li>As a region’s Admissions queue, the kinds that go to {routedName('region')}: {gets.region.map((k, i) => <React.Fragment key={k.id}>{i ? ', ' : ''}{kindLink(k)}</React.Fragment>)}</li>}
          {gets.recruitment.length > 0 && <li>As a region’s Recruitment queue, the kinds that go to {routedName('recruitment')}: {gets.recruitment.map((k, i) => <React.Fragment key={k.id}>{i ? ', ' : ''}{kindLink(k)}</React.Fragment>)}</li>}
        </ul> : <p className="muted">{isNew ? 'Nothing yet: once the queue is created, pick it as a kind of work’s Goes to.' : 'Nothing: no kind of work goes to this queue.'}</p>}
        <p className="field__msg">Set in Kinds of work: each kind of work’s Goes to says which queue its tasks land in.</p>
      </section>
      {app && <p className="muted">One officer end to end: every task on an application goes to its officer, whom routing picks by Fewest open when the RP sends the documents.</p>}
    </Sheet>
    {blocking.length ? (
      <ConfirmDialog open={sure} title={`${v.name} can’t be deleted`} cancel="Close" onCancel={() => setSure(false)}>
        <p>{blocking.length === 1 ? 'A kind of work goes to it' : `${blocking.length} kinds of work go to it`}: {blocking.map(k => k.name).join(', ')}. Change {blocking.length === 1 ? 'its' : 'their'} Goes to in Kinds of work first.</p>
      </ConfirmDialog>
    ) : (
      <ConfirmDialog open={sure} danger title={`Delete ${v.name || 'this queue'}?`} confirm="Delete queue" onCancel={() => setSure(false)} onConfirm={() => { setSure(false); remove(); }}>
        <p>Its {open} open {open === 1 ? 'task moves' : 'tasks move'} to the Admin queue. This can’t be undone.</p>
      </ConfirmDialog>
    )}
    </>
  );
}

function KindButton({ by }) {
  const [open, setOpen] = useState(false);
  return <><Button kind="primary" onClick={() => setOpen(true)}>Add kind of work</Button>{open && <KindSheet onClose={() => setOpen(false)} by={by} />}</>;
}
function KindList({ may, by, openId, onOpened }) {
  const s = useStore();
  const [edit, setEdit] = useState(() => (openId ? s.kinds.find(k => k.id === openId) || null : null));
  React.useEffect(() => { if (openId) { const k = s.kinds.find(x => x.id === openId); if (k) setEdit(k); onOpened(); } }, [openId]);
  return (
    <Card flush>
      <Table head={['Kind of work', 'Record', 'SLA', 'Goes to', '']} className="cfg__tab">
        {s.kinds.map(k => { const to = goesToName(s, k.goesTo); return (
          <tr key={k.id}>
            <td className="cfg__strong">{k.name}</td><td>{k.record}</td>
            <td className="num">{k.sla} wh</td>
            <td>{to || <Pill tone="dpill--bad">Queue deleted</Pill>}</td>
            <td className="cfg__acts">{may('U') && <LinkButton aria-label={`Edit ${k.name}`} onClick={() => setEdit(k)}>Edit</LinkButton>}</td>
          </tr>); })}
      </Table>
      <p className="gspx-pad muted">Every task goes where its kind of work goes; a task rule has no queue of its own. A new Goes to applies to new tasks: open tasks stay in their queue. A task’s SLA, first match wins: the task rule’s own SLA; else its kind of work’s; else 18 working hours. A task keeps the SLA hours it was created with (S4-11).</p>
      {edit && <KindSheet kind={edit} onClose={() => setEdit(null)} by={by} canDelete={may('D')} />}
    </Card>
  );
}
function KindSheet({ kind, onClose, by, canDelete }) {
  const s = useStore();
  const init = React.useRef(kind ? { ...kind } : { id: 'k-' + Date.now(), name: '', record: 'Application', sla: 9, goesTo: '' });
  const [v, setV] = useState(() => ({ ...init.current }));
  const [sure, setSure] = useState(false);
  const used = kind && s.rules.some(r => r.kind === kind.id);
  const open = kind ? s.tasks.filter(t => t.kind === kind.id && t.status === 'open').length : 0;
  const errors = {
    name: !v.name.trim() ? 'Enter the name of the kind of work.' : dupError(v.name, s.kinds.filter(k => k.id !== v.id).map(k => k.name), 'There’s already a kind of work with this name.'),
    sla: numError(v.sla, { what: 'SLA', min: 1, max: 540, int: true, required: true }),
    goesTo: !v.goesTo ? 'Choose where its tasks go.' : !goesToValid(s, v, v.goesTo) ? 'Choose again: that isn’t open to this record.' : null,
  };
  const c = useCheck(errors);
  const dirty = JSON.stringify(v) !== JSON.stringify(init.current);
  const save = () => {
    if (!c.submit()) return;
    saveKind({ ...v, name: v.name.trim() }, by.name);
    const moved = kind && kind.goesTo !== v.goesTo;
    toast(kind ? 'Kind of work saved' : 'Kind of work added', { text: moved ? `New tasks go to ${goesToName(s, v.goesTo)}; open tasks stay where they are.` : undefined }); onClose();
  };
  return (
    <>
    <Sheet title={kind ? `Edit ${kind.name}` : 'Add kind of work'} onClose={onClose} dirty={dirty} what={kind ? kind.name : 'the new kind of work'}
      footer={<>{kind && canDelete && <Button kind="danger-quiet" disabled={used} aria-describedby={used ? 'k-used' : undefined} onClick={() => setSure(true)}>Delete kind of work</Button>}<span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button>
        <Button kind="primary" disabled={!!kind && !dirty} onClick={save}>{kind ? 'Save' : 'Add kind of work'}</Button></>}>
      <div className="cfg__form">
        <Field id="k-name" label="Name" required error={c.err('name')}><Input id="k-name" value={v.name} onBlur={c.blur('name')} onChange={x => setV({ ...v, name: x })} /></Field>
        <Pick id="k-rec" label="Record it is about" required value={v.record} onChange={x => setV(o => ({ ...o, record: x, goesTo: goesToValid(s, { record: x }, o.goesTo) ? o.goesTo : '' }))} options={[...new Set([...s.kinds.map((k) => k.record), ...s.rules.map((r) => r.record)].filter(Boolean))]} />
        <Pick id="k-to" label="Goes to" required error={c.err('goesTo')} value={v.goesTo || ''} placeholder="Choose a queue" onChange={x => (setV(o => ({ ...o, goesTo: x })), c.blur('goesTo')())} options={goesToOptions(s, v.record)}
          hint={kind && kind.goesTo !== v.goesTo && open ? `Applies to new tasks. Its ${open} open ${open === 1 ? 'task stays' : 'tasks stay'} where ${open === 1 ? 'it is' : 'they are'}.` : 'Every task of this kind lands here, from every task rule of this kind.'} />
        <Field id="k-sla" label="SLA (whole working hours, 1 to 540)" required error={c.err('sla')} hint="Counted on the working calendar of the record's sales region. 1 working day = 9 working hours."><NumberInput id="k-sla" decimal={false} min={1} max={540} steppers value={v.sla} onBlur={c.blur('sla')} onChange={x => setV({ ...v, sla: x })} /></Field>
        {used && <p className="field__msg" id="k-used">A task rule uses it, so it can’t be deleted.</p>}
      </div>
    </Sheet>
    <ConfirmDialog open={sure} danger title={`Delete ${v.name}?`} confirm="Delete kind of work" onCancel={() => setSure(false)}
      onConfirm={() => { setSure(false); update(d => { d.kinds = d.kinds.filter(k => k.id !== v.id); }); logChange('kind.deleted', `${by.name} deleted kind of work ${v.name}`, by.name); toast('Kind of work deleted'); onClose(); }}>
      <p>No task rule uses it. This can’t be undone.</p>
    </ConfirmDialog>
    </>
  );
}

const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
/**
 * Working days (slice 4 PRD, Working calendars; S4-25, S4-27): Admin adds calendars and picks one for each sales
 * region. Each has a name, its working days, the day's start and end (IST), its holidays and the sales regions on
 * it. A region is on exactly one calendar; picking it for another moves it (slice 1's Working calendar on the sales
 * region shows the same). A calendar change re-works the due time of open tasks (S4-11). RP Home's working hours read these.
 */
function Calendars({ may, by }) {
  const cals = useCalendars();
  useStore();
  const [hol, setHol] = useState({});
  const [tried, setTried] = useState({});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const regions = [...new Set([...salesRegionNames(), 'Global'])];
  const holErr = i => { const h = hol[i] || {}; return { d: dateError(h.d || '', { what: 'holiday date', required: true }), n: !(h.n || '').trim() ? 'Enter the holiday name.' : null }; };
  const log = (event, text) => logChange(event, text, by.name);
  const edit = (i, fn, event, text) => { setCalendars(x => { fn(x[i], x); return x; }); log(event, text); };
  // a day that ends at or before its start runs past midnight IST (Jovial, 4 Nov); only an equal start and end is wrong
  const hoursErr = c => ((c.end || DEFAULT_END) === (c.start || DEFAULT_START) ? 'The day can’t start and end at the same time.' : null);
  return (
    <>
    <Notice>Time zone: one for everything, IST (Asia/Kolkata). There is no time zone per sales region or per calendar: an SLA counts the calendar’s hours in IST, and due times, reminders and daily jobs all count in IST (S4-27). A record with no region uses the calendar that lists Global.</Notice>
    {may('C') && <div className="gspx-inline"><Button kind="primary" onClick={() => setAdding(true)}>Add a calendar</Button></div>}
    <div className="gspx-grid2">
      {cals.map((c, i) => (
        <Card key={c.id}>
          {may('U') ? <Field id={`cn-${i}`} label="Calendar name" required error={!String(c.name).trim() ? 'Enter the calendar’s name.' : null}><Input id={`cn-${i}`} value={c.name} onChange={x => setCalendars(l => { l[i].name = x; return l; })} onBlur={() => log('calendar.changed', `${by.name} renamed a calendar to ${c.name}`)} /></Field>
            : <h3 className="gspx-h3">{c.name}</h3>}
          <p className="muted">{daysText(c.days)}, {clockText(c.start || DEFAULT_START)} to {clockText(c.end || DEFAULT_END)}{dayOf(c).overnight ? ' the next day' : ''} IST · {dayOf(c).hours} working hours a day</p>
          <div className="iseg" role="group" aria-label={`Working days for ${c.name}`}>
            {DAYS.map(([d, t]) => <button key={d} type="button" className="ichip" disabled={!may('U')} aria-pressed={String(c.days.includes(d))}
              onClick={() => { if (c.days.length === 1 && c.days.includes(d)) { toast('A calendar needs at least one working day.'); return; } edit(i, cal => { cal.days = cal.days.includes(d) ? cal.days.filter(y => y !== d) : [...cal.days, d]; }, 'calendar.changed', `${by.name} changed working days for ${c.name}`); }}>{t}</button>)}
          </div>
          <div className="gspx-inline">
            {may('U') ? <>
              <TimePick id={`cs-${i}`} label="Day starts" value={c.start || DEFAULT_START} error={hoursErr(c)} onChange={x => edit(i, cal => { cal.start = x; }, 'calendar.changed', `${by.name} set ${c.name}’s day to start at ${x} IST`)} />
              <TimePick id={`ce-${i}`} label="Day ends" value={c.end || DEFAULT_END} onChange={x => edit(i, cal => { cal.end = x; }, 'calendar.changed', `${by.name} set ${c.name}’s day to end at ${x} IST`)} />
            </> : null}
          </div>
          {may('U') && <p className="muted gspx-small">An end earlier than the start runs past midnight: the day belongs to the day it starts on, so a holiday on that date takes out that night.</p>}
          <div className="field"><span className="field__label">Sales regions on it</span>
            {may('U') ? <MultiPick id={`cr-${i}`} label={`Sales regions on ${c.name}`} value={regionsOn(c, regions)} options={regions} empty="No regions" search
              onChange={l => { putRegionsOn(c.id, l); log('calendar.changed', `${by.name} set the regions on ${c.name}: ${l.join(', ') || 'none'}`); }} />
              : <p className="muted">{regionsOn(c, regions).join(', ') || 'No regions'}</p>}
          </div>
          <h4 className="gspx-h4">Holidays</h4>
          <ul className="gspx-list">{c.holidays.map(([d, n], j) => <li key={j}><span className="num">{fmtDate(d)}</span> {n} {may('U') && <LinkButton aria-label={`Remove ${n}`} onClick={() => {
            edit(i, cal => { cal.holidays.splice(j, 1); }, 'holiday.removed', `${by.name} removed holiday ${n} from ${c.name}`);
            toast('Holiday removed', { text: `${n}, ${fmtDate(d)}`, undo: () => edit(i, cal => { cal.holidays.splice(j, 0, [d, n]); }, 'holiday.added', `${by.name} put back holiday ${n}`) });
          }}>Remove</LinkButton>}</li>)}</ul>
          {may('U') && <><div className="gspx-inline">
            <Field id={`hd-${i}`} label="Holiday date" required error={tried[i] ? holErr(i).d : null}><DateField id={`hd-${i}`} value={(hol[i] || {}).d || ''} onChange={x => setHol({ ...hol, [i]: { ...(hol[i] || {}), d: x } })} /></Field>
            <Field id={`hn-${i}`} label="Holiday name" required error={tried[i] ? holErr(i).n : null}><Input id={`hn-${i}`} value={(hol[i] || {}).n || ''} onChange={x => setHol({ ...hol, [i]: { ...(hol[i] || {}), n: x } })} placeholder="Like: Diwali" /></Field>
          </div>
          <div className="gspx-inline"><Button size="sm" onClick={() => { const h = hol[i] || {}; const e = holErr(i); if (e.d || e.n) { setTried({ ...tried, [i]: true }); window.setTimeout(() => document.getElementById(e.d ? `hd-${i}` : `hn-${i}`)?.focus(), 30); return; } edit(i, cal => { cal.holidays.push([h.d, h.n.trim()]); cal.holidays.sort((a, b) => (a[0] < b[0] ? -1 : 1)); }, 'holiday.added', `${by.name} added holiday ${h.n} to ${c.name}`); setHol({ ...hol, [i]: {} }); setTried({ ...tried, [i]: false }); toast('Holiday added', { text: `${h.n.trim()}, ${fmtDate(h.d)}` }); }}>Add holiday</Button>
            {may('D') && cals.length > 1 && <Button size="sm" kind="danger-quiet" onClick={() => setRemoving(c)}>Delete calendar</Button>}</div></>}
        </Card>
      ))}
    </div>
    {adding && <NewCalendar by={by} regions={regions} onClose={() => setAdding(false)} />}
    <ConfirmDialog open={!!removing} danger title={`Delete ${removing?.name}?`} confirm="Delete calendar" onCancel={() => setRemoving(null)}
      onConfirm={() => { const r = removing; const moved = regionsOn(r, regions); setRemoving(null); const to = cals.find(y => y.id !== r.id); setCalendars(x => x.filter(y => y.id !== r.id)); if (moved.length) putRegionsOn(to.id, [...regionsOn(to, regions), ...moved]); log('calendar.changed', `${by.name} deleted calendar ${r.name}`); toast('Calendar deleted', { text: moved.length ? `Its regions moved to ${to.name}.` : '' }); }}>
      <p>{removing && regionsOn(removing, regions).length ? `${regionsOn(removing, regions).join(', ')} move to ${cals.find(y => y.id !== removing.id)?.name}.` : 'No region uses it.'} SLA clocks count on the new calendar from now.</p>
    </ConfirmDialog>
    </>
  );
}

function NewCalendar({ by, regions, onClose }) {
  const init = React.useRef({ name: '', days: [1, 2, 3, 4, 5], start: DEFAULT_START, end: DEFAULT_END, regions: [] });
  const [v, setV] = useState(() => ({ ...init.current }));
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const cals = getCalendars();
  const errors = {
    name: !v.name.trim() ? 'Enter the calendar’s name, like Saturday to Wednesday.' : dupError(v.name, cals.map(c => c.name), 'There’s already a calendar with this name.'),
    days: v.days.length ? null : 'Pick at least one working day.',
    hours: v.end === v.start ? 'The day can’t start and end at the same time.' : null,
  };
  const c = useCheck(errors);
  const dirty = JSON.stringify(v) !== JSON.stringify(init.current);
  const save = () => {
    if (!c.submit()) return;
    const id = 'cal-' + Date.now().toString(36);
    setCalendars(x => [...x, { id, name: v.name.trim(), days: v.days, start: v.start, end: v.end, holidays: [], regions: [] }]);
    if (v.regions.length) putRegionsOn(id, v.regions);
    logChange('calendar.changed', `${by.name} added calendar ${v.name.trim()}`, by.name);
    toast('Calendar added', { text: v.regions.length ? `${v.regions.join(', ')} count on it from now.` : 'Pick the regions that use it.' });
    onClose();
  };
  return (
    <Sheet title="Add a calendar" onClose={onClose} dirty={dirty} what="the new calendar"
      footer={<><span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={save}>Add calendar</Button></>}>
      <div className="cfg__form">
        <Field id="nc-name" label="Calendar name" required error={c.err('name')}><Input id="nc-name" value={v.name} onBlur={c.blur('name')} onChange={x => set('name', x)} placeholder="Like: Saturday to Wednesday" /></Field>
        <div className="field"><span className="field__label">Working days</span>
          <div className="iseg" role="group" aria-label="Working days">
            {DAYS.map(([d, t]) => <button key={d} type="button" className="ichip" aria-pressed={String(v.days.includes(d))} onClick={() => set('days', v.days.includes(d) ? v.days.filter(y => y !== d) : [...v.days, d])}>{t}</button>)}
          </div>
          {c.err('days') && <p className="field__msg field__msg--error" role="alert">{c.err('days')}</p>}
        </div>
        <div className="gspx-inline">
          <TimePick id="nc-start" label="Day starts" value={v.start} error={c.err('hours')} onChange={x => set('start', x)} />
          <TimePick id="nc-end" label="Day ends" value={v.end} onChange={x => set('end', x)} />
        </div>
        <p className="muted">{v.end && v.start && v.end !== v.start ? (v.end < v.start ? `Runs past midnight: ${clockText(v.start)} to ${clockText(v.end)} the next day IST, ${dayOf(v).hours} working hours.` : `${dayOf(v).hours} working hours a day, IST.`) : 'Times are IST. An end earlier than the start runs past midnight.'}</p>
        <div className="field"><span className="field__label">Sales regions on it</span>
          <MultiPick id="nc-regions" label="Sales regions on it" value={v.regions} options={regions} empty="No regions yet" search onChange={l => set('regions', l)} />
        </div>
        <p className="muted">A region is on one calendar: picking one here moves it from its calendar now.</p>
      </div>
    </Sheet>
  );
}

/** Reminders and escalation (slice 4 PRD, Breach and escalation): one ladder for every task; numbers are working days, 0 to 60. */
function Escalation({ may, by }) {
  const s = useStore(); const e = s.escalation;
  const set = (k, x, what) => { update(d => { d.escalation[k] = x; }); logChange('escalation.changed', `${by.name} set ${what} to ${x}`, by.name); };
  const num = (k, label) => may('U') ? <Num label={`${label} (working days)`} value={e[k]} onChange={x => { if (!numError(x, { what: '', min: 0, max: 60, int: true, required: true })) set(k, x, label); }} /> : <b>{e[k]}</b>;
  return (
    <Card flush>
      <Table head={['When', 'Who is told', 'How', 'Task line']} className="cfg__tab">
        <tr><td className="cfg__strong">A task is created</td><td>The assignee</td><td>Bell (“My work: a task for you”) and the task in My work</td><td>—</td></tr>
        <tr><td className="cfg__strong">{num('remindBefore', 'Remind before')} working day(s) before due, only on tasks with an SLA of 18 working hours or more (S4-18)</td><td>The assignee</td><td>Bell and the morning email</td><td>—</td></tr>
        <tr><td className="cfg__strong">Due, and breached (level 1)</td><td>The assignee and the queue’s leader</td><td>Bell, morning email, red pill</td><td>“&lt;leader&gt; (leader) told”</td></tr>
        <tr><td className="cfg__strong">Late by {num('opsAfter', 'Ops after')} working days (level 2, “Ops after”)</td><td>The team’s Ops queue: Global Admissions for regional Admissions and Global Admissions tasks, RP Ops for RP Ops and Recruitment, IP Ops for Institution and IP Ops, Finance for Finance, else the Admin queue</td><td>The task shows in that queue’s My work too, for all its members</td><td>“Escalated to &lt;queue&gt;”</td></tr>
        <tr><td className="cfg__strong">Late by {num('adminAfter', 'Admin after')} working days (level 3, “Admin after”)</td><td>The Admin queue</td><td>Bell; email E21 to every Admin; dashboard alert (slice 6)</td><td>“Escalated to Admin”</td></tr>
      </Table>
      <p className="gspx-pad muted">Escalation doesn’t make a new task and doesn’t change the assignee: the same task is shown to more people (rule T51). The morning email (E19) goes at {may('U') ? <span className="gspx-inline-pick"><TimePick id="esc-digest" label="Morning email time" hideLabel value={e.digestTime} onChange={x => set('digestTime', x, 'the morning email time')} /></span> : <b>{e.digestTime} IST</b>}: one email with everything due or breached, not one per task.</p>
    </Card>
  );
}

/** The settings pages' Change history (the last 20 changes: when and what), from the same log as Admin's Audit log. */
export function ChangeLog() {
  const s = useStore();
  const list = s.log.filter(l => /^(queue|kind|rule|calendar|holiday|escalation)\./.test(l.event || ''));
  if (!list.length) return null;
  return (
    <details className="gspx-log"><summary>Change history ({Math.min(20, list.length)})</summary>
      <ul>{list.slice(0, 20).map((l, i) => <li key={i}><span className="num muted">{fmtWhen(l.at)}</span> {l.text} <span className="muted">· {l.event}</span></li>)}</ul>
    </details>
  );
}
