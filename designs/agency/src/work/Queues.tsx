// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * Admin › Work › Queues, SLA and escalation (slice 4 PRD): Queues, Kinds of work, Working days, Reminders and
 * escalation. The only queue editor (S4-1). Admin and Global Ops edit; every other GSP role views. Every change is in
 * the page's Change history and Admin's Audit log. All times are IST (S4-27).
 */
import React, { useState } from 'react';
import { useStore, update, logChange, nameOf, kindById, SHARE, SHARE_HELP } from './store';
import { can } from '../finance/access';
import { Page, Card, Tabs, Table, Pill, Button, LinkButton, Sheet, Field, Input, Num, Chip, Notice, toast } from '../finance/kit';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useCheck, numError, dupError, dateError } from '../components/validate';
import { fmtDate, fmtWhen } from '../data/format';
import { PersonaBar, usePersona } from './persona';
import { useCalendars, getCalendars, setCalendars, daysText, clockText, regionsOn, putRegionsOn, DEFAULT_START, DEFAULT_END } from './calendars';
import { salesRegionNames } from '../admin/data/config';
import { MultiPick } from '../institution/records/MultiPick';
import { Pick, TimePick, Tick } from './ui';

const ADMIN_Q = 'q-admin';

export default function Queues() {
  const s = useStore();
  const { user, role } = usePersona();
  const [tab, setTab] = useState('queues');
  const may = a => can(s.matrix, role.id, 'queues', a);
  return (
    <Page cfg title="Queues, SLA and escalation" top={<PersonaBar />}
      lead="A queue is a team’s inbox: a name, one leader, members, and how work is shared. Every task belongs to exactly one queue. Set what each kind of work is due in, the working days every SLA counts on, and who is told when a task is late. All times are IST."
      actions={tab === 'queues' && may('C') ? <QueueButton by={user} /> : tab === 'kinds' && may('C') ? <KindButton by={user} /> : null}>
      {!may('U') && <Notice>{role.name} can see this page but not change it.</Notice>}
      <Tabs label="Section" value={tab} onChange={setTab}
        options={[['queues', `Queues (${s.queues.length})`], ['kinds', `Kinds of work (${s.kinds.length})`], ['calendars', 'Working days'], ['escalation', 'Reminders and escalation']]} />
      {tab === 'queues' && <QueueList may={may} by={user} />}
      {tab === 'kinds' && <KindList may={may} by={user} />}
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

function QueueList({ may, by }) {
  const s = useStore();
  const [edit, setEdit] = useState(null);
  const gaps = s.kinds.filter(k => !s.queues.some(q => (q.kinds || []).includes(k.id)));
  const noLead = s.queues.filter(q => !q.leader);
  return (
    <>
      {(gaps.length > 0 || noLead.length > 0) && (
        <Notice tone="warn">
          {noLead.length > 0 && <>No leader: {noLead.map(q => q.name).join(', ')}. Escalations from these queues go to the Admin queue. </>}
          {gaps.length > 0 && <>Not received by any queue: {gaps.map(k => k.name).join(', ')}.</>}
        </Notice>
      )}
      <Card flush>
        <Table head={['Queue', 'Leader', 'Members', 'How work is shared', 'Receives', '']} className="cfg__tab">
          {s.queues.map(q => (
            <tr key={q.id}>
              <td className="cfg__strong">{q.name}{q.id === ADMIN_Q && <span className="cfg__sub">Tasks with no queue and level 3 escalations</span>}{q.id === 'q-adm-global' && <span className="cfg__sub">The Global Ops team’s queue</span>}</td>
              <td>{q.leader ? <span className="cfg__strong">{nameOf(s, q.leader)}</span> : <Pill tone="dpill--bad">Not set</Pill>}</td>
              <td>{(q.members || []).length ? <div className="cfg__chips">{q.members.slice(0, 6).map(m => <Chip key={m}>{nameOf(s, m)}</Chip>)}{q.members.length > 6 && <span className="muted">+{q.members.length - 6} more</span>}</div> : <span className="cfg__muted">Just the leader</span>}</td>
              <td>{SHARE[q.assign] || SHARE['fewest-open']}</td>
              <td>{(() => { const names = (q.kinds || []).map(k => (kindById(s, k) || {}).name).filter(Boolean); return names.length ? <span className="gspx-wrap" title={names.join(', ')}>{names.slice(0, 2).join(', ')}{names.length > 2 ? <span className="muted"> +{names.length - 2} more</span> : null}</span> : <span className="cfg__muted">Nothing yet</span>; })()}</td>
              <td className="cfg__acts">{may('U') && <LinkButton aria-label={`Edit ${q.name}`} onClick={() => setEdit(q)}>Edit</LinkButton>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && <QueueSheet queue={edit} onClose={() => setEdit(null)} by={by} canDelete={may('D') && edit.id !== ADMIN_Q} />}
    </>
  );
}

/** A queue (slice 4 PRD, A queue): name, leader, members, how work is shared, and what it receives. No type, no regions (S4-24). */
function QueueSheet({ queue, onClose, by, canDelete }) {
  const s = useStore();
  const isNew = !queue;
  const init = React.useRef(queue ? structuredClone(queue) : { id: 'q-' + Date.now(), name: '', leader: '', members: [], assign: 'fewest-open', kinds: [] });
  const [v, setV] = useState(() => structuredClone(init.current));
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const gsp = s.users.filter(u => !['rp-admin', 'branch-admin', 'counsellor'].includes(u.role) && s.roles.some(r => r.id === u.role));
  const label = u => `${u.name} · ${s.roles.find(r => r.id === u.role).name}`;
  const [sure, setSure] = useState(false);
  const errors = {
    name: !v.name.trim() ? 'Enter the queue name, like India Admissions.' : v.name.trim().length > 60 ? 'Keep the name to 60 characters or fewer.' : dupError(v.name, s.queues.filter(q => q.id !== v.id).map(q => q.name), 'There’s already a queue with this name.'),
  };
  const c = useCheck(errors);
  const dirty = JSON.stringify(v) !== JSON.stringify(queue || init.current);
  const open = s.tasks.filter(t => t.queue === v.id && t.status === 'open').length;
  const save = () => {
    if (!c.submit()) return;
    const x = { ...v, name: v.name.trim(), members: (v.members || []).filter(m => m !== v.leader) };
    update(d => { const i = d.queues.findIndex(q => q.id === x.id); if (i >= 0) d.queues[i] = x; else d.queues.push(x); });
    logChange(isNew ? 'queue.created' : 'queue.edited', `${by.name} ${isNew ? 'created' : 'edited'} queue ${x.name}: leader ${x.leader ? nameOf(s, x.leader) : 'not set'}, ${x.members.length} member${x.members.length === 1 ? '' : 's'}, ${SHARE[x.assign]}`, by.name);
    toast(isNew ? 'Queue created' : 'Applies to new work from now'); onClose();
  };
  const remove = () => {
    update(d => { d.queues = d.queues.filter(q => q.id !== v.id); d.tasks.forEach(t => { if (t.queue === v.id && t.status === 'open') t.queue = ADMIN_Q; }); });
    logChange('queue.deleted', `${by.name} deleted queue ${v.name}${open ? `; its ${open} open tasks moved to the Admin queue` : ''}`, by.name);
    toast('Queue deleted', { text: open ? 'Its open tasks moved to the Admin queue.' : undefined }); onClose();
  };
  const toggle = (k, id) => set(k, (v[k] || []).includes(id) ? v[k].filter(x => x !== id) : [...(v[k] || []), id]);
  const app = (v.kinds || []).some(k => (kindById(s, k) || {}).record === 'Application');
  return (
    <>
    <Sheet wide title={isNew ? 'Create queue' : `Edit ${queue.name}`} onClose={onClose} dirty={dirty} what={isNew ? 'the new queue' : queue.name}
      footer={<>{!isNew && canDelete && <Button kind="danger-quiet" onClick={() => setSure(true)}>Delete queue</Button>}<span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={!isNew && !dirty} onClick={save}>{isNew ? 'Create queue' : 'Save'}</Button></>}>
      <div className="cfg__form gspx-form2">
        <Field id="q-name" label="Queue name" required error={c.err('name')} hint="Up to 60 characters."><Input id="q-name" value={v.name} maxLength={60} onBlur={c.blur('name')} onChange={x => set('name', x)} placeholder="Like: India Admissions" /></Field>
        <Pick id="q-lead" label="Leader" hint="Gets escalations, covers people on leave, can assign. No leader: escalations go to the Admin queue." value={v.leader || ''} onChange={x => set('leader', x)} placeholder="Choose one person" options={gsp.map(u => [u.id, label(u)])} />
        <Pick id="q-assign" label="How work is shared" required value={v.assign in SHARE ? v.assign : 'fewest-open'} onChange={x => set('assign', x)} options={Object.entries(SHARE)} hint={SHARE_HELP[v.assign] || SHARE_HELP['fewest-open']} />
        <div className="field"><span className="field__label">Members</span>
          <MultiPick id="q-members" label="Members" search empty="Just the leader" value={gsp.filter(u => (v.members || []).includes(u.id) && u.id !== v.leader).map(label)} options={gsp.filter(u => u.id !== v.leader).map(label)}
            onChange={l => set('members', gsp.filter(u => l.includes(label(u))).map(u => u.id))} />
          <p className="field__msg">The leader is a member anyway. A deactivated user stays listed until deleted, but gets no new work. Anyone can be in any queue: each person sees only records in their own sales regions.</p>
        </div>
      </div>
      <Field id="q-kinds" label="What lands in this queue">
        <div className="gspx-checks">{s.kinds.map(k => <Tick key={k.id} id={`qk-${k.id}`} checked={(v.kinds || []).includes(k.id)} onChange={() => toggle('kinds', k.id)}>{k.name}</Tick>)}</div>
      </Field>
      {app && <p className="muted">One officer end to end: every task on an application goes to its officer, whom routing picks by Fewest open when the RP sends the documents.</p>}
    </Sheet>
    <ConfirmDialog open={sure} danger title={`Delete ${v.name || 'this queue'}?`} confirm="Delete queue" onCancel={() => setSure(false)} onConfirm={() => { setSure(false); remove(); }}>
      <p>Its {open} open {open === 1 ? 'task moves' : 'tasks move'} to the Admin queue, and new work stops landing in it. This can’t be undone.</p>
    </ConfirmDialog>
    </>
  );
}

function KindButton({ by }) {
  const [open, setOpen] = useState(false);
  return <><Button kind="primary" onClick={() => setOpen(true)}>Add kind of work</Button>{open && <KindSheet onClose={() => setOpen(false)} by={by} />}</>;
}
function KindList({ may, by }) {
  const s = useStore();
  const [edit, setEdit] = useState(null);
  return (
    <Card flush>
      <Table head={['Kind of work', 'Record', 'SLA', 'Goes to', '']} className="cfg__tab">
        {s.kinds.map(k => { const qs = s.queues.filter(q => (q.kinds || []).includes(k.id)); return (
          <tr key={k.id}>
            <td className="cfg__strong">{k.name}</td><td>{k.record}</td>
            <td className="num">{k.sla} wh</td>
            <td>{qs.length ? (qs.length > 3 ? `${qs.slice(0, 2).map(q => q.name).join(', ')} +${qs.length - 2} more` : qs.map(q => q.name).join(', ')) : <Pill tone="dpill--bad">No queue</Pill>}</td>
            <td className="cfg__acts">{may('U') && <LinkButton aria-label={`Edit ${k.name}`} onClick={() => setEdit(k)}>Edit</LinkButton>}</td>
          </tr>); })}
      </Table>
      <p className="gspx-pad muted">A task’s SLA, first match wins: the task rule’s own SLA; else its kind of work’s; else 18 working hours. A task keeps the SLA hours it was created with (S4-11).</p>
      {edit && <KindSheet kind={edit} onClose={() => setEdit(null)} by={by} canDelete={may('D')} />}
    </Card>
  );
}
function KindSheet({ kind, onClose, by, canDelete }) {
  const s = useStore();
  const init = React.useRef(kind ? { ...kind } : { id: 'k-' + Date.now(), name: '', record: 'Application', sla: 9 });
  const [v, setV] = useState(() => ({ ...init.current }));
  const [sure, setSure] = useState(false);
  const used = kind && (s.queues.some(q => (q.kinds || []).includes(kind.id)) || s.rules.some(r => r.kind === kind.id));
  const errors = {
    name: !v.name.trim() ? 'Enter the name of the kind of work.' : dupError(v.name, s.kinds.filter(k => k.id !== v.id).map(k => k.name), 'There’s already a kind of work with this name.'),
    sla: numError(v.sla, { what: 'SLA', min: 1, max: 540, int: true, required: true }),
  };
  const c = useCheck(errors);
  const dirty = JSON.stringify(v) !== JSON.stringify(init.current);
  const save = () => {
    if (!c.submit()) return;
    update(d => { const i = d.kinds.findIndex(k => k.id === v.id); if (i >= 0) d.kinds[i] = v; else d.kinds.push(v); });
    logChange('kind.saved', `${by.name} saved kind of work ${v.name} (${v.sla} wh)`, by.name);
    toast(kind ? 'Kind of work saved' : 'Kind of work added'); onClose();
  };
  return (
    <>
    <Sheet title={kind ? `Edit ${kind.name}` : 'Add kind of work'} onClose={onClose} dirty={dirty} what={kind ? kind.name : 'the new kind of work'}
      footer={<>{kind && canDelete && <Button kind="danger-quiet" disabled={used} aria-describedby={used ? 'k-used' : undefined} onClick={() => setSure(true)}>Delete kind of work</Button>}<span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button>
        <Button kind="primary" disabled={!!kind && !dirty} onClick={save}>{kind ? 'Save' : 'Add kind of work'}</Button></>}>
      <div className="cfg__form">
        <Field id="k-name" label="Name" required error={c.err('name')}><Input id="k-name" value={v.name} onBlur={c.blur('name')} onChange={x => setV({ ...v, name: x })} /></Field>
        <Pick id="k-rec" label="Record it is about" required value={v.record} onChange={x => setV({ ...v, record: x })} options={['Application', 'RP', 'Institution partner', 'University', 'Course', 'Announcement', 'Commission', 'Email', 'Setting', 'Any']} />
        <Field id="k-sla" label="SLA (whole working hours, 1 to 540)" required error={c.err('sla')} hint="A working day is 9 hours, 9:30 to 18:30 IST."><Input id="k-sla" type="number" value={v.sla} onBlur={c.blur('sla')} onChange={x => setV({ ...v, sla: x })} /></Field>
        {used && <p className="field__msg" id="k-used">A queue or task rule uses it, so it can’t be deleted.</p>}
      </div>
    </Sheet>
    <ConfirmDialog open={sure} danger title={`Delete ${v.name}?`} confirm="Delete kind of work" onCancel={() => setSure(false)}
      onConfirm={() => { setSure(false); update(d => { d.kinds = d.kinds.filter(k => k.id !== v.id); }); logChange('kind.deleted', `${by.name} deleted kind of work ${v.name}`, by.name); toast('Kind of work deleted'); onClose(); }}>
      <p>No queue or task rule uses it. This can’t be undone.</p>
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
  const hoursErr = c => (c.end <= c.start ? 'The day ends after it starts.' : null);
  return (
    <>
    <Notice>Time zone: one for everything, IST (Asia/Kolkata). There is no time zone per sales region or per calendar: an SLA counts the calendar’s hours in IST, and due times, reminders and daily jobs all count in IST (S4-27). A record with no region uses the calendar that lists Global.</Notice>
    {may('C') && <div className="gspx-inline"><Button kind="primary" onClick={() => setAdding(true)}>Add a calendar</Button></div>}
    <div className="gspx-grid2">
      {cals.map((c, i) => (
        <Card key={c.id}>
          {may('U') ? <Field id={`cn-${i}`} label="Calendar name" required error={!String(c.name).trim() ? 'Enter the calendar’s name.' : null}><Input id={`cn-${i}`} value={c.name} onChange={x => setCalendars(l => { l[i].name = x; return l; })} onBlur={() => log('calendar.changed', `${by.name} renamed a calendar to ${c.name}`)} /></Field>
            : <h3 className="gspx-h3">{c.name}</h3>}
          <p className="muted">{daysText(c.days)}, {clockText(c.start || DEFAULT_START)} to {clockText(c.end || DEFAULT_END)} IST</p>
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
            <Field id={`hd-${i}`} label="Holiday date" required error={tried[i] ? holErr(i).d : null}><Input id={`hd-${i}`} type="date" value={(hol[i] || {}).d || ''} onChange={x => setHol({ ...hol, [i]: { ...(hol[i] || {}), d: x } })} /></Field>
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
    hours: v.end <= v.start ? 'The day ends after it starts.' : null,
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
        <MultiPick id="nc-regions" label="Sales regions on it" value={v.regions} options={regions} empty="No regions yet" search onChange={l => set('regions', l)} />
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
