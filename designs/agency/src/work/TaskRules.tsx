// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * Admin › Work › Task rules (slice 4 PRD, Every timer). The rules are data the work service reads (S4-13): Admin and
 * Global Ops change a rule's on or off, when its task starts, its SLA, the RP reminder, its queue and how it's shared.
 * The trigger ("When"), the task's title and "Closes when" are code: read-only here. There is no New task rule and
 * no Delete. Rule numbers are the rows of Jovial's Task triggers sheet.
 */
import React, { useState } from 'react';
import { useStore, update, logChange, queueById, kindById, RULE_SHARE, SHARE } from './store';
import { can } from '../finance/access';
import { Page, Card, Segmented, Table, Pill, Button, LinkButton, Sheet, Field, Input, Notice, toast, NumberInput } from '../finance/kit';
import { useCheck, numError } from '../components/validate';
import { PersonaBar, usePersona } from './persona';
import { ChangeLog } from './Queues';
import { RULE_GROUPS } from './seed';
import { timeText } from './engine';
import { Pick } from './ui';
import { now } from './clock';

/** The record types the rules are about, from the rules themselves (no fixed list). */
export const recordTypes = (rules) => [...new Set(rules.map((r) => r.record).filter(Boolean))];
export const triggersOf = (rules, record) => [...new Set(rules.filter(r => r.record === record).map(r => r.when))];

const UNITS = [['wh', 'working hours'], ['d', 'working days'], ['days', 'calendar days']];
const destName = (s, to) => to === 'region' ? 'The application’s regional Admissions queue' : to === 'recruitment' ? 'The RP’s region’s Recruitment queue' : to === 'ops' ? 'The team’s Ops queue, then Admin' : (queueById(s, to) || {}).name || 'Queue deleted';
const shareName = (s, r) => r.share === 'officer' ? 'The application’s officer' : r.share ? RULE_SHARE[r.share] : `${SHARE[(queueById(s, r.queue) || {}).assign] || 'Fewest open'} (the queue’s way)`;
const whenText = r => String(r.when).replace('<days>', r.days ?? '');

export default function TaskRules() {
  const s = useStore();
  const { user, role } = usePersona();
  const [group, setGroup] = useState('');
  const [edit, setEdit] = useState(null);
  const may = a => can(s.matrix, role.id, 'queues', a);
  const groups = RULE_GROUPS.filter(g => !group || g === group);
  const switchRule = r => {
    update(d => { const x = d.rules.find(y => y.id === r.id); x.on = !x.on; x.offAt = x.on ? null : now(); });
    logChange('rule.switched', `${user.name} switched ${r.row} “${r.name}” ${r.on ? 'off' : 'on'}`, user.name);
    toast(r.on ? `${r.row} is off` : `${r.row} is on`, { text: r.on ? 'It makes no new tasks. Tasks it has open stay until they clear.' : 'It makes tasks again from now.' });
  };
  return (
    <Page cfg title="Task rules" top={<PersonaBar />}
      lead="The rules that make every task: what each watches, when its task starts, the task people see, where it goes, its SLA, when the RP is reminded and when it closes on its own. “Task starts after” is how long the condition must hold first. Times are working hours (wh) or working days (d, 9 wh) on the record’s region’s calendar, in IST.">
      {!may('U') && <Notice>{role.name} can see the rules but not change them.</Notice>}
      <Notice>Admin and Global Ops can change a rule’s on or off, when its task starts, its SLA, the RP reminder, its queue and how it’s shared. What a rule watches and when it closes are built in. A change applies to new tasks; open tasks keep the SLA they were made with (S4-11).</Notice>
      <Segmented label="Rules for" value={group} onChange={setGroup} options={[['', `All (${s.rules.length})`], ...RULE_GROUPS.map(g => [g, `${g.split(',')[0]} (${s.rules.filter(r => r.group === g).length})`])]} />
      {groups.map(g => {
        const rows = s.rules.filter(r => r.group === g);
        if (!rows.length) return null;
        return (
          <Card flush key={g}>
            <h2 className="gspx-h3 gspx-pad">{g}{g === 'Applications' ? ' (queue: the application’s regional Admissions queue, assignee the officer, unless it says otherwise)' : g === 'Admin' ? ' (T60 to T68: proposal, S4-28)' : g === 'Commission' ? ' (slice 5 owns what each task does)' : g === 'Email' ? ' (Mail, later slice)' : ''}</h2>
            <Table head={['#', 'When', 'Task starts after', 'Task', 'Goes to', 'SLA', 'RP reminded', 'Closes when', 'On', '']} className="cfg__tab">
              {rows.map(r => {
                const missing = !['region', 'recruitment', 'ops'].includes(r.queue) && !queueById(s, r.queue);
                return (
                  <tr key={r.id} className={r.on ? '' : 'gspx-off'}>
                    <td className="cfg__strong">{r.label || r.row}{r.proposal && <span className="cfg__sub">Proposal</span>}</td>
                    <td>{whenText(r)}</td>
                    <td className="num">{timeText(r.after)}</td>
                    <td>{r.task}<span className="cfg__sub">{(kindById(s, r.kind) || {}).name}</span></td>
                    <td>{missing ? <Pill tone="dpill--bad">Queue deleted</Pill> : destName(s, r.queue)}{!r.ladder && <span className="cfg__sub">{shareName(s, r)}</span>}</td>
                    <td className="num">{r.ladder ? '—' : timeText(r.sla)}</td>
                    <td className="num">{r.remind2 !== undefined ? `${timeText(r.remind)}, ${timeText(r.remind2)}` : timeText(r.remind)}</td>
                    <td><span className="cfg__sub gspx-wrap">{r.closes}</span></td>
                    <td><button type="button" role="switch" aria-checked={String(r.on)} aria-label={`${r.row} ${r.name} on`} className="switch__track" disabled={!may('U')} onClick={() => switchRule(r)}><span className="switch__knob" aria-hidden="true" /></button></td>
                    <td className="cfg__acts">{may('U') && !r.ladder && <LinkButton aria-label={`Edit ${r.row} ${r.name}`} onClick={() => setEdit(r)}>Edit</LinkButton>}</td>
                  </tr>);
              })}
            </Table>
          </Card>
        );
      })}
      <ChangeLog />
      {edit && <RuleSheet rule={edit} onClose={() => setEdit(null)} by={user} />}
    </Page>
  );
}

/** A time a rule waits or gives: a number and its unit, or none. */
/** A number and its unit on one line, under one label (Jovial, 4 Nov: the unit had its own label below). */
function TimeField({ id, label, value, onChange, error, none, hint, required = false }) {
  if (value?.text) return <Field id={id} label={label} hint="Built in: the date comes from the record."><p className="cfg__strong" id={id}>{value.text}</p></Field>;
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <div className="rtime">
        <NumberInput id={id} value={value ? value.n : ''} placeholder={none ? 'None' : ''} onChange={x => onChange(x === '' ? (none ? null : { n: '', u: value?.u || 'wh' }) : { n: x, u: value?.u || 'wh' })} />
        <Pick id={`${id}-u`} label={`${label}: unit`} hideLabel value={value?.u || 'wh'} onChange={u => onChange(value ? { ...value, u } : { n: 1, u })} options={UNITS} />
      </div>
    </Field>
  );
}
/** A rule's built-in parts (code, not editable), with the placeholder words in brackets. */
const plain = (t) => String(t ?? '').replace(/<([^>]+)>/g, '[$1]');

function RuleSheet({ rule, onClose, by }) {
  const s = useStore();
  const init = React.useRef(structuredClone(rule));
  const [v, setV] = useState(() => structuredClone(rule));
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const bad = (t, what, req) => (t == null ? (req ? `Enter the ${what}.` : null) : numError(t.n, { what, min: t.u === 'days' ? 1 : 0, max: t.u === 'wh' ? 540 : 365, int: true, required: true }));
  const errors = {
    after: v.after?.text ? null : bad(v.after, 'time before the task starts', false),
    sla: bad(v.sla, 'SLA', true),
    remind: bad(v.remind, 'reminder time', false),
    remind2: v.remind2 !== undefined ? bad(v.remind2, 'second reminder time', false) : null,
    days: v.days != null ? numError(v.days, { what: 'days before', min: 1, max: 365, int: true, required: true }) : null,
  };
  const c = useCheck(errors);
  const dirty = JSON.stringify(v) !== JSON.stringify(init.current);
  const dest = [
    ...(v.record === 'Application' || v.queue === 'region' ? [['region', 'The application’s regional Admissions queue']] : []),
    ...(v.record === 'RP' ? [['recruitment', 'The RP’s region’s Recruitment queue']] : []),
    ...s.queues.filter(q => !q.id.startsWith('q-adm-') || q.id === 'q-adm-global').filter(q => !q.id.startsWith('q-rec-')).map(q => [q.id, q.name]),
  ];
  const shares = Object.entries(RULE_SHARE).filter(([k]) => (k === 'officer' ? v.queue === 'region' : true)).map(([k, l]) => [k, l]);
  const save = () => {
    if (!c.submit()) return;
    update(d => { const i = d.rules.findIndex(r => r.id === v.id); d.rules[i] = v; });
    const what = ['after', 'sla', 'remind', 'remind2', 'queue', 'share', 'days'].filter(k => JSON.stringify(v[k]) !== JSON.stringify(init.current[k])).join(', ');
    logChange('rule.edited', `${by.name} edited ${v.row} “${v.name}”: ${what}`, by.name);
    toast('Rule saved', { text: 'Applies to new tasks from now.' }); onClose();
  };
  return (
    <Sheet wide title={`Edit ${v.label || v.row}: ${v.name}`} onClose={onClose} dirty={dirty} what={`${v.row}`}
      footer={<><span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={!dirty} onClick={save}>Save</Button></>}>
      <section className="rbuilt" aria-labelledby="rbuilt-t">
        <p className="rbuilt__k" id="rbuilt-t">Built in (can't be changed here)</p>
        <dl className="rbuilt__dl">
          <dt>When</dt><dd>{plain(whenText(v))}</dd>
          <dt>Task people see</dt><dd>{plain(v.task)}</dd>
          <dt>Closes when</dt><dd>{plain(v.closes)}</dd>
          <dt>Kind of work</dt><dd>{(kindById(s, v.kind) || {}).name}</dd>
        </dl>
      </section>
      <div className="cfg__form gspx-form2">
        {v.days != null && <Field id="r-days" label="Days before the agreement ends" required error={c.err('days')} hint="Slice 2’s renewal reminder reads these days."><NumberInput id="r-days" decimal={false} min={1} steppers value={v.days} onChange={x => set('days', x === '' ? '' : Number(x))} /></Field>}
        <TimeField id="r-after" label="Task starts after" none value={v.after} error={c.err('after')} onChange={x => set('after', x)} hint="Empty: at once." />
        <TimeField id="r-sla" label="SLA" required value={v.sla} error={c.err('sla')} onChange={x => set('sla', x)} hint="Counted on the working calendar of the record's sales region. 1 working day = 9 working hours." />
        <TimeField id="r-remind" label="RP reminded after" none value={v.remind} error={c.err('remind')} onChange={x => set('remind', x)} hint="When the RP gets an automatic reminder (bell and email) during the wait. Empty: none." />
        {v.remind2 !== undefined && <TimeField id="r-remind2" label="RP reminded again after" none value={v.remind2} error={c.err('remind2')} onChange={x => set('remind2', x)} hint="A second reminder, counted from the same start. Empty: none." />}
        <Pick id="r-to" label="Goes to" required value={v.queue} onChange={x => setV(o => ({ ...o, queue: x, share: x !== 'region' && o.share === 'officer' ? null : o.share }))} options={dest} />
        <Pick id="r-share" label="How it’s shared" required value={v.share ?? ''} onChange={x => set('share', x || null)} options={shares} />
      </div>
      <p className="gspx-sentence"><b>In words: </b>when “{whenText(v).toLowerCase()}”{v.after ? `, for ${timeText(v.after)}` : ''}, make “{plain(v.task)}” in {destName(s, v.queue).replace(/^The/, 'the')}, shared {shareName(s, v).replace(/^The/, 'to the').toLowerCase()}, due in {timeText(v.sla)}{v.remind ? `; the RP is reminded after ${timeText(v.remind)}` : ''}. It closes when {String(v.closes).charAt(0).toLowerCase() + String(v.closes).slice(1)}.</p>
    </Sheet>
  );
}
