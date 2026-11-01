// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * Queues and SLA (Admin): queues, kinds of work, SLA targets, working calendars
 * and the escalation ladder. Everything here can be created, edited and deleted.
 */
import React, { useState } from 'react';
import { useStore, update, nameOf, kindById, QUEUE_ASSIGN, QUEUE_ASSIGN_HELP } from './store';
import { can } from '../finance/access';
import { Page, Card, Tabs, Select, Table, Pill, Button, LinkButton, Sheet, Field, Input, Num, Chip, Notice, toast } from '../finance/kit';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useCheck, numError, dupError, dateError } from '../components/validate';
import { fmtDate, fmtWhen } from '../data/format';
import { PersonaBar, usePersona } from './persona';
import { useCalendars, getCalendars, setCalendars, daysText, clockText, DEFAULT_START, DEFAULT_END } from './calendars';
import { salesRegionNames } from '../admin/data/config';
import { MultiPick } from '../institution/records/MultiPick';
import { STAGES as APP_STAGES, STATUS, STATUS_ORDER, phaseOf } from '../data/applications';

/** The Before or After submission group of a status row (engineering review, 1 Nov), from the status data. */
const phaseFor = (r) => { const k = STATUS_ORDER.find(x => APP_STAGES[STATUS[x].stage] === r.stage && STATUS[x].text('Australia') === r.status); return k ? phaseOf(k) : undefined; };

const STAGES = ['New', 'Pre-screening', 'Application', 'Offer', 'Verification', 'Acceptance', 'Visa', 'Enrolment'];

export default function Queues() {
  const s = useStore();
  const { user, role } = usePersona();
  const [tab, setTab] = useState('queues');
  const may = a => can(s.matrix, role.id, 'queues', a);
  return (
    <Page cfg title="Queues and SLA" top={<PersonaBar />}
      lead="A queue is a team’s inbox. Set who is in it, how work is shared, what lands in it and how fast it must be done."
      actions={tab === 'queues' && may('C') ? <QueueButton by={user} /> : tab === 'kinds' && may('C') ? <KindButton by={user} /> : null}>
      {!may('U') && <Notice>{role.name} can see this page but not change it.</Notice>}
      <Tabs label="Section" value={tab} onChange={setTab}
        options={[['queues', `Queues (${s.queues.length})`], ['kinds', `Kinds of work (${s.kinds.length})`], ['sla', 'SLA by status'], ['calendars', 'Working days'], ['escalation', 'Reminders and escalation']]} />
      {tab === 'queues' && <QueueList may={may} by={user} />}
      {tab === 'kinds' && <KindList may={may} by={user} />}
      {tab === 'sla' && <StatusSla may={may} by={user} />}
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
          {noLead.length > 0 && <>No leader: {noLead.map(q => q.name).join(', ')}. Escalations from these queues go to Fallback. </>}
          {gaps.length > 0 && <>Not received by any queue: {gaps.map(k => k.name).join(', ')}.</>}
        </Notice>
      )}
      <Card flush>
        <Table head={['Queue', 'Leader', 'Members', 'How work is shared', 'SLA', 'Receives', '']} className="cfg__tab">
          {s.queues.map(q => (
            <tr key={q.id}>
              <td className="cfg__strong">{q.name}<span className="cfg__sub">{q.kind === 'region' ? `Sales region: ${q.region}` : 'Team queue, every region'}</span></td>
              <td>{q.leader ? <span className="cfg__strong">{nameOf(s, q.leader)}</span> : <Pill tone="dpill--bad">Not set</Pill>}</td>
              <td>{(q.members || []).length ? <div className="cfg__chips">{q.members.map(m => <Chip key={m}>{nameOf(s, m)}</Chip>)}</div> : <span className="cfg__muted">Just the leader</span>}</td>
              <td>{QUEUE_ASSIGN[q.assign] || QUEUE_ASSIGN['fewest-open']}{q.handover && <span className="cfg__sub">Handover: {q.handover.map(h => `${h.from}–${h.to}`).join(' → ')}</span>}{q.makerChecker && <span className="cfg__sub">Maker-checker on</span>}</td>
              <td className="num">{q.sla} working hour{q.sla === 1 ? '' : 's'}</td>
              <td>{(() => { const names = (q.kinds || []).map(k => (kindById(s, k) || {}).name).filter(Boolean); return names.length ? <span className="gspx-wrap" title={names.join(', ')}>{names.slice(0, 2).join(', ')}{names.length > 2 ? <span className="muted"> +{names.length - 2} more</span> : null}</span> : <span className="cfg__muted">Nothing yet</span>; })()}</td>
              <td className="cfg__acts">{may('U') && <LinkButton aria-label={`Edit ${q.name}`} onClick={() => setEdit(q)}>Edit</LinkButton>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && <QueueSheet queue={edit} onClose={() => setEdit(null)} by={by} canDelete={may('D')} />}
    </>
  );
}

function QueueSheet({ queue, onClose, by, canDelete }) {
  const s = useStore();
  const isNew = !queue;
  const init = React.useRef(queue ? structuredClone(queue) : { id: 'q-' + Date.now(), name: '', kind: 'team', region: '', leader: '', members: [], assign: 'fewest-open', cover: 'leader', sla: 9, kinds: [], handover: null });
  const [v, setV] = useState(() => structuredClone(init.current));
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const gsp = s.users.filter(u => !['rp-admin', 'branch-admin', 'counsellor'].includes(u.role));
  const [sure, setSure] = useState(false);
  const errors = {
    name: !v.name.trim() ? 'Enter the queue name, like India Admissions.' : dupError(v.name, s.queues.filter(q => q.id !== v.id).map(q => q.name), 'There’s already a queue with this name.'),
    region: v.kind === 'region' && !v.region ? 'Choose the sales region.' : null,
    sla: numError(v.sla, { what: 'default SLA', min: 1, max: 540, int: true, required: true }),
  };
  const c = useCheck(errors);
  const dirty = JSON.stringify(v) !== JSON.stringify(queue || init.current);
  const open = s.tasks.filter(t => t.queue === v.id && t.status !== 'done').length;
  const save = () => {
    if (!c.submit()) return;
    update(d => { const i = d.queues.findIndex(q => q.id === v.id); if (i >= 0) d.queues[i] = v; else d.queues.push(v); }, `${by.name} ${isNew ? 'created' : 'edited'} queue ${v.name}`);
    toast(isNew ? 'Queue created' : 'Queue saved', { text: isNew ? undefined : 'Applies to new work from now.' }); onClose();
  };
  const remove = () => { update(d => { d.queues = d.queues.filter(q => q.id !== v.id); d.tasks.forEach(t => { if (t.queue === v.id) t.queue = 'q-fallback'; }); }, `${by.name} deleted queue ${v.name}`); toast('Queue deleted', { text: 'Its open tasks moved to Fallback.' }); onClose(); };
  const toggle = (k, id) => set(k, (v[k] || []).includes(id) ? v[k].filter(x => x !== id) : [...(v[k] || []), id]);
  return (
    <>
    <Sheet wide title={isNew ? 'Create queue' : `Edit ${queue.name}`} onClose={onClose} dirty={dirty} what={isNew ? 'the new queue' : queue.name}
      footer={<>{!isNew && canDelete && <Button kind="danger-quiet" onClick={() => setSure(true)}>Delete queue</Button>}<span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={!isNew && !dirty} onClick={save}>{isNew ? 'Create queue' : 'Save'}</Button></>}>
      <div className="cfg__form gspx-form2">
        <Field id="q-name" label="Queue name" required error={c.err('name')}><Input id="q-name" value={v.name} onBlur={c.blur('name')} onChange={x => set('name', x)} placeholder="Like: India Admissions" /></Field>
        <Select id="q-kind" label="Type" required value={v.kind} onChange={x => set('kind', x)} options={[['team', 'Team queue (every region)'], ['region', 'Regional queue (one sales region)']]} />
        {v.kind === 'region' && <Select id="q-region" label="Sales region" required error={c.err('region')} onBlur={c.blur('region')} value={v.region} onChange={x => set('region', x)} placeholder="Choose" options={s.regions} />}
        <Select id="q-lead" label="Leader (gets escalations, can assign)" value={v.leader || ''} onChange={x => set('leader', x)} placeholder="Choose one person" options={gsp.map(u => [u.id, `${u.name} · ${s.roles.find(r => r.id === u.role).name}`])} />
        <Select id="q-assign" label="How work is shared" required value={v.assign in QUEUE_ASSIGN ? v.assign : 'fewest-open'} onChange={x => set('assign', x)} options={Object.entries(QUEUE_ASSIGN)} hint={QUEUE_ASSIGN_HELP[v.assign] || QUEUE_ASSIGN_HELP['fewest-open']} />
        <Field id="q-sla" label="Default SLA (working hours)" required error={c.err('sla')} hint="Used when the kind of work has no SLA of its own."><Input id="q-sla" type="number" value={v.sla} onBlur={c.blur('sla')} onChange={x => set('sla', x)} /></Field>
        <label className="gspx-check"><input type="checkbox" checked={!!v.makerChecker} onChange={e => set('makerChecker', e.target.checked)} /> Maker-checker: never give a checking task to the person who made the change</label>
      </div>
      <Field id="q-members" label="Members" hint="The leader is in the queue anyway.">
        <div className="gspx-checks">{gsp.map(u => <label key={u.id} className="gspx-check"><input type="checkbox" checked={(v.members || []).includes(u.id)} onChange={() => toggle('members', u.id)} /> {u.name}</label>)}</div>
      </Field>
      <Field id="q-kinds" label="What lands in this queue">
        <div className="gspx-checks">{s.kinds.map(k => { const other = s.queues.find(q => q.id !== v.id && (q.kinds || []).includes(k.id) && q.kind === 'team' && v.kind === 'team'); return <label key={k.id} className="gspx-check"><input type="checkbox" checked={(v.kinds || []).includes(k.id)} onChange={() => toggle('kinds', k.id)} /> {k.name}{other ? <span className="muted"> (also {other.name})</span> : null}</label>; })}</div>
      </Field>
      {v.kind === 'region' && (
        <Field id="q-hand" label="Who works on each stage">
          <div className="gspx-radio">
            <label className="gspx-check"><input type="radio" name="q-hand" checked={!v.handover} onChange={() => set('handover', null)} /> One officer end to end, including the GSP check and payment proof</label>
            <label className="gspx-check"><input type="radio" name="q-hand" checked={!!v.handover} onChange={() => set('handover', [{ from: 'New', to: 'Offer', people: [] }, { from: 'Verification', to: 'Enrolment', people: [] }])} /> Hand over between stages</label>
          </div>
          {v.handover && v.handover.map((h, i) => (
            <div key={i} className="gspx-step">
              <b>Step {i + 1}</b>
              <Select id={`h-from-${i}`} label="From" hideLabel value={h.from} onChange={x => set('handover', v.handover.map((y, j) => j === i ? { ...y, from: x } : y))} options={STAGES} />
              <span className="muted">to</span>
              <Select id={`h-to-${i}`} label="To" hideLabel value={h.to} onChange={x => set('handover', v.handover.map((y, j) => j === i ? { ...y, to: x } : y))} options={STAGES} />
              <Select id={`h-p-${i}`} label="Officer" hideLabel value={(h.people || [])[0] || ''} placeholder="Anyone in the queue" onChange={x => set('handover', v.handover.map((y, j) => j === i ? { ...y, people: x ? [x] : [] } : y))} options={[v.leader, ...(v.members || [])].filter(Boolean).map(id => [id, nameOf(s, id)])} />
              {v.handover.length > 1 && <LinkButton aria-label={`Remove step ${i + 1}`} onClick={() => set('handover', v.handover.filter((_, j) => j !== i))}>Remove</LinkButton>}
            </div>
          ))}
          {v.handover && <LinkButton onClick={() => set('handover', [...v.handover, { from: 'Visa', to: 'Enrolment', people: [] }])}>Add a step</LinkButton>}
        </Field>
      )}
    </Sheet>
    <ConfirmDialog open={sure} danger title={`Delete ${v.name || 'this queue'}?`} confirm="Delete queue" onCancel={() => setSure(false)} onConfirm={() => { setSure(false); remove(); }}>
      <p>{open ? `Its ${open} open ${open === 1 ? 'task moves' : 'tasks move'} to Fallback, and` : 'Nothing is open in it.'} {open ? 'new' : 'New'} work stops landing in it. This can’t be undone.</p>
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
            <td className="num">{k.sla} working hour{k.sla === 1 ? '' : 's'}</td>
            <td>{qs.length ? (qs.every(q => q.kind === 'region') && qs.length > 3 ? `Every regional Admissions queue (${qs.length})` : qs.map(q => q.name).join(', ')) : <Pill tone="dpill--bad">No queue</Pill>}</td>
            <td className="cfg__acts">{may('U') && <LinkButton aria-label={`Edit ${k.name}`} onClick={() => setEdit(k)}>Edit</LinkButton>}</td>
          </tr>); })}
      </Table>
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
    update(d => { const i = d.kinds.findIndex(k => k.id === v.id); if (i >= 0) d.kinds[i] = v; else d.kinds.push(v); }, `${by.name} saved kind ${v.name}`);
    toast(kind ? 'Kind of work saved' : 'Kind of work added'); onClose();
  };
  return (
    <>
    <Sheet title={kind ? `Edit ${kind.name}` : 'Add kind of work'} onClose={onClose} dirty={dirty} what={kind ? kind.name : 'the new kind of work'}
      footer={<>{kind && canDelete && <Button kind="danger-quiet" disabled={used} aria-describedby={used ? 'k-used' : undefined} onClick={() => setSure(true)}>Delete kind of work</Button>}<span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button>
        <Button kind="primary" disabled={!!kind && !dirty} onClick={save}>{kind ? 'Save' : 'Add kind of work'}</Button></>}>
      <div className="cfg__form">
        <Field id="k-name" label="Name" required error={c.err('name')}><Input id="k-name" value={v.name} onBlur={c.blur('name')} onChange={x => setV({ ...v, name: x })} /></Field>
        <Select id="k-rec" label="Record it is about" required value={v.record} onChange={x => setV({ ...v, record: x })} options={['Application', 'RP', 'Institution partner', 'University', 'Course', 'Announcement', 'Commission', 'Email', 'Any']} />
        <Field id="k-sla" label="SLA (working hours)" required error={c.err('sla')}><Input id="k-sla" type="number" value={v.sla} onBlur={c.blur('sla')} onChange={x => setV({ ...v, sla: x })} /></Field>
        {used && <p className="field__msg" id="k-used">It is used by a queue or task rule, so it can’t be deleted.</p>}
      </div>
    </Sheet>
    <ConfirmDialog open={sure} danger title={`Delete ${v.name}?`} confirm="Delete kind of work" onCancel={() => setSure(false)}
      onConfirm={() => { setSure(false); update(d => { d.kinds = d.kinds.filter(k => k.id !== v.id); }, `${by.name} deleted kind ${v.name}`); toast('Kind of work deleted'); onClose(); }}>
      <p>No queue or task rule uses it. This can’t be undone.</p>
    </ConfirmDialog>
    </>
  );
}

function StatusSla({ may, by }) {
  const s = useStore();
  const tone = { GSP: 'dpill--checking', RP: 'dpill--missing', University: '', Student: '', Government: '' };
  return (
    <Card flush>
      <p className="gspx-pad muted">How long each application status may last. When GSP owes the action, the SLA runs on the officer’s task. When the RP, student or university owes it, it is a timer: when it runs out, a chase task is raised. Starting values come from the designer’s “usual days”.</p>
      <Table head={['Stage', 'Status', 'Who owes the action', 'SLA (working hours)']} className="cfg__tab">
        {s.statusSla.map((r, i) => (
          <tr key={i}>
            <td>{r.stage}{phaseFor(r) && <span className="cfg__sub">{phaseFor(r)}</span>}</td><td className="cfg__strong">{r.status}</td><td><Pill tone={tone[r.owner]}>{r.owner}</Pill></td>
            <td>{may('U') ? <SlaCell r={r} i={i} by={by} /> : <span className="num">{r.days}</span>}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

/** One status's SLA: saved as it's typed when it's a whole number of days from 0 to 60; otherwise it says so. */
function SlaCell({ r, i, by }) {
  const [t, setT] = useState(r.days);
  const err = numError(t, { what: `SLA for ${r.status}`, min: 0, max: 540, int: true, required: true });
  return (
    <span className="gspx-errs">
      <Num label={`SLA for ${r.status} (working hours)`} value={t} error={err} onChange={x => { setT(x); if (!numError(x, { what: '', min: 0, max: 540, int: true, required: true })) update(d => { d.statusSla[i].days = x; }, `${by.name} set SLA for “${r.status}” to ${x} working hours`); }} />
      {err && <span className="field__msg field__msg--error" role="alert">{err}</span>}
    </span>
  );
}

const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
/**
 * Working days (Jovial, 1 Nov, HC31): every calendar can be changed, and new ones added: its name, working days,
 * hours (9:30 to 18:30 unless set), holidays, and the sales regions that use it (GSP · Admin › Sales regions). A
 * region is on one calendar; picking it for another moves it. RP Home's working hours read these.
 */
function Calendars({ may, by }) {
  const cals = useCalendars();
  const s = useStore();
  const [hol, setHol] = useState({});
  const [tried, setTried] = useState({});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const regions = salesRegionNames();
  const holErr = i => { const h = hol[i] || {}; return { d: dateError(h.d || '', { what: 'holiday date', required: true }), n: !(h.n || '').trim() ? 'Enter the holiday name.' : null }; };
  const log = text => update(() => {}, text);
  const edit = (i, fn, text) => { setCalendars(x => { fn(x[i], x); return x; }); log(text); };
  const hoursErr = c => !/^\d{2}:\d{2}$/.test(c.start || '') || !/^\d{2}:\d{2}$/.test(c.end || '') ? 'Enter both times.' : (c.end <= c.start ? 'The day ends after it starts.' : null);
  return (
    <>
    {may('C') && <div className="gspx-inline"><Button kind="primary" onClick={() => setAdding(true)}>Add a calendar</Button></div>}
    <div className="gspx-grid2">
      {cals.map((c, i) => (
        <Card key={c.id}>
          {may('U') ? <Field id={`cn-${i}`} label="Calendar name" required error={!String(c.name).trim() ? 'Enter the calendar’s name.' : null}><Input id={`cn-${i}`} value={c.name} onChange={x => setCalendars(l => { l[i].name = x; return l; })} onBlur={() => log(`${by.name} renamed a calendar to ${c.name}`)} /></Field>
            : <h3 className="gspx-h3">{c.name}</h3>}
          <p className="muted">{daysText(c.days)}, {clockText(c.start || DEFAULT_START)} to {clockText(c.end || DEFAULT_END)}</p>
          <div className="iseg" role="group" aria-label={`Working days for ${c.name}`}>
            {DAYS.map(([d, t]) => <button key={d} type="button" className="ichip" disabled={!may('U')} aria-pressed={String(c.days.includes(d))}
              onClick={() => edit(i, cal => { cal.days = cal.days.includes(d) ? cal.days.filter(y => y !== d) : [...cal.days, d]; }, `${by.name} changed working days for ${c.name}`)}>{t}</button>)}
          </div>
          <div className="gspx-inline">
            <Field id={`cs-${i}`} label="Day starts" required error={hoursErr(c)}><Input id={`cs-${i}`} type="time" disabled={!may('U')} value={c.start || DEFAULT_START} onChange={x => edit(i, cal => { cal.start = x; }, `${by.name} set ${c.name}’s day to start at ${x}`)} /></Field>
            <Field id={`ce-${i}`} label="Day ends" required><Input id={`ce-${i}`} type="time" disabled={!may('U')} value={c.end || DEFAULT_END} onChange={x => edit(i, cal => { cal.end = x; }, `${by.name} set ${c.name}’s day to end at ${x}`)} /></Field>
          </div>
          <div className="field"><span className="field__label">Sales regions on it</span>
            {may('U') ? <MultiPick id={`cr-${i}`} label={`Sales regions on ${c.name}`} value={c.regions.filter(r => regions.includes(r))} options={regions} empty="No regions" search
              onChange={l => { setCalendars(x => { x.forEach((y, j) => { if (j === i) y.regions = l; else y.regions = y.regions.filter(r => !l.includes(r)); }); return x; }); log(`${by.name} set the regions on ${c.name}: ${l.join(', ') || 'none'}`); }} />
              : <p className="muted">{c.regions.join(', ') || 'No regions'}</p>}
          </div>
          <h4 className="gspx-h4">Holidays</h4>
          <ul className="gspx-list">{c.holidays.map(([d, n], j) => <li key={j}><span className="num">{fmtDate(d)}</span> {n} {may('U') && <LinkButton aria-label={`Remove ${n}`} onClick={() => {
            // reversible: no question, Undo in the notification (QC, 1 Nov)
            edit(i, cal => { cal.holidays.splice(j, 1); }, `${by.name} removed holiday ${n}`);
            toast('Holiday removed', { text: `${n}, ${fmtDate(d)}`, undo: () => edit(i, cal => { cal.holidays.splice(j, 0, [d, n]); }, `${by.name} put back holiday ${n}`) });
          }}>Remove</LinkButton>}</li>)}</ul>
          {may('U') && <><div className="gspx-inline">
            <Field id={`hd-${i}`} label="Holiday date" required error={tried[i] ? holErr(i).d : null}><Input id={`hd-${i}`} type="date" value={(hol[i] || {}).d || ''} onChange={x => setHol({ ...hol, [i]: { ...(hol[i] || {}), d: x } })} /></Field>
            <Field id={`hn-${i}`} label="Holiday name" required error={tried[i] ? holErr(i).n : null}><Input id={`hn-${i}`} value={(hol[i] || {}).n || ''} onChange={x => setHol({ ...hol, [i]: { ...(hol[i] || {}), n: x } })} placeholder="Like: Diwali" /></Field>
          </div>
          <div className="gspx-inline"><Button size="sm" onClick={() => { const h = hol[i] || {}; const e = holErr(i); if (e.d || e.n) { setTried({ ...tried, [i]: true }); window.setTimeout(() => document.getElementById(e.d ? `hd-${i}` : `hn-${i}`)?.focus(), 30); return; } edit(i, cal => { cal.holidays.push([h.d, h.n.trim()]); cal.holidays.sort((a, b) => (a[0] < b[0] ? -1 : 1)); }, `${by.name} added holiday ${h.n}`); setHol({ ...hol, [i]: {} }); setTried({ ...tried, [i]: false }); toast('Holiday added', { text: `${h.n.trim()}, ${fmtDate(h.d)}` }); }}>Add holiday</Button>
            {may('D') && cals.length > 1 && <Button size="sm" kind="danger-quiet" onClick={() => setRemoving(c)}>Delete calendar</Button>}</div></>}
        </Card>
      ))}
    </div>
    {adding && <NewCalendar by={by} regions={regions} onClose={() => setAdding(false)} log={log} />}
    <ConfirmDialog open={!!removing} danger title={`Delete ${removing?.name}?`} confirm="Delete calendar" onCancel={() => setRemoving(null)}
      onConfirm={() => { const r = removing; setRemoving(null); setCalendars(x => { const left = x.filter(y => y.id !== r.id); left[0].regions = [...new Set([...left[0].regions, ...r.regions])]; return left; }); log(`${by.name} deleted calendar ${r.name}`); toast('Calendar deleted', { text: r.regions.length ? `Its regions moved to ${cals.find(y => y.id !== r.id)?.name}.` : '' }); }}>
      <p>{removing?.regions.length ? `${removing.regions.join(', ')} move to ${cals.find(y => y.id !== removing.id)?.name}.` : 'No region uses it.'} SLA clocks count on the new calendar from now.</p>
    </ConfirmDialog>
    </>
  );
}

function NewCalendar({ by, regions, onClose, log }) {
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
    setCalendars(x => { x.forEach(y => { y.regions = y.regions.filter(r => !v.regions.includes(r)); }); return [...x, { id, name: v.name.trim(), days: v.days, start: v.start, end: v.end, holidays: [], regions: v.regions }]; });
    log(`${by.name} added calendar ${v.name.trim()}`);
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
          <Field id="nc-start" label="Day starts" required error={c.err('hours')}><Input id="nc-start" type="time" value={v.start} onChange={x => set('start', x)} /></Field>
          <Field id="nc-end" label="Day ends" required><Input id="nc-end" type="time" value={v.end} onChange={x => set('end', x)} /></Field>
        </div>
        <MultiPick id="nc-regions" label="Sales regions on it" value={v.regions} options={regions} empty="No regions yet" search onChange={l => set('regions', l)} />
        <p className="muted">A region is on one calendar: picking one here moves it from its calendar now.</p>
      </div>
    </Sheet>
  );
}

function Escalation({ may, by }) {
  const s = useStore(); const e = s.escalation;
  const set = (k, x) => update(d => { d.escalation[k] = x; }, `${by.name} changed escalation: ${k}`);
  const num = (k, label) => may('U') ? <Num label={`${label} (working days)`} value={e[k]} onChange={x => { if (!numError(x, { what: '', min: 0, max: 60, int: true, required: true })) set(k, x); }} /> : <b>{e[k]}</b>;
  return (
    <Card flush>
      <Table head={['When', 'Who is told', 'How']} className="cfg__tab">
        <tr><td className="cfg__strong">A task is created</td><td>The assignee, or every queue member if it is unassigned</td><td>Bell notification and the task in My work</td></tr>
        <tr><td className="cfg__strong">{num('remindBefore', 'Remind days before due')} working day(s) before due</td><td>The assignee</td><td>Bell and the morning email</td></tr>
        <tr><td className="cfg__strong">Due today or breached</td><td>The assignee and the queue leader</td><td>Bell, morning email, red SLA pill</td></tr>
        <tr><td className="cfg__strong">Breached by {num('opsAfter', 'Escalate to Admission Ops after')} working days</td><td>Admission Ops (an escalation task)</td><td>Task in the Admission Ops queue</td></tr>
        <tr><td className="cfg__strong">Breached by {num('adminAfter', 'Escalate to Admin after')} working days</td><td>Admin and the team’s dashboard</td><td>Bell and dashboard alert</td></tr>
      </Table>
      <p className="gspx-pad muted">The morning email goes at {may('U') ? <input className="control__input gspx-num" type="time" aria-label="Morning email time" value={e.digestTime} onChange={x => set('digestTime', x.target.value)} /> : e.digestTime} in each person’s own time zone: one email with everything due, not one per task.</p>
    </Card>
  );
}

export function ChangeLog() {
  const s = useStore();
  if (!s.log.length) return null;
  return (
    <details className="gspx-log"><summary>Change history ({s.log.length})</summary>
      <ul>{s.log.slice(0, 20).map((l, i) => <li key={i}><span className="num muted">{fmtWhen(l.at)}</span> {l.text}</li>)}</ul>
    </details>
  );
}
