// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * Task rules (Admin): what creates a task, where it goes, its SLA and when it
 * closes itself. Rules can be created, edited, switched off and deleted.
 */
import React, { useState } from 'react';
import { useStore, update, queueById, kindById, ASSIGN } from './store';
import { can } from '../finance/access';
import { Page, Card, Segmented, Select, Table, Pill, Button, LinkButton, Sheet, Field, Input, Notice, toast } from '../finance/kit';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useCheck, numError, dupError } from '../components/validate';
import { PersonaBar, usePersona } from './persona';
import { ChangeLog } from './Queues';

/*
 * What a rule can watch, per record (Jovial, 1 Nov, HC29): the triggers the rules themselves have, with their own
 * values (48 working hours, 60 days…), never a typed list that could differ from them. In the real build each one
 * maps to an event or a scheduled check.
 */
export const RECORDS = ['Application', 'RP', 'Institution partner', 'University', 'Course', 'Commission', 'Email', 'Any'];
export const triggersOf = (rules, record) => [...new Set(rules.filter(r => r.record === record).map(r => r.when))];

const DEST = s => [['region', 'The application’s regional Admissions queue'], ['owner', 'Straight to the record owner (officer, BDM, account manager)'], ...s.queues.filter(q => q.kind === 'team').map(q => [q.id, `${q.name} queue`])];
const destName = (s, to) => to === 'region' ? 'Regional Admissions queue' : to === 'owner' ? 'Record owner' : (queueById(s, to) || {}).name || 'Queue deleted';

export default function TaskRules() {
  const s = useStore();
  const { user, role } = usePersona();
  const [rec, setRec] = useState('');
  const [edit, setEdit] = useState(null);
  const may = a => can(s.matrix, role.id, 'queues', a);
  const rows = s.rules.filter(r => !rec || r.record === rec);
  return (
    <Page cfg title="Task rules" top={<PersonaBar />}
      lead="Rules create tasks from the records themselves. Each says what it watches, the task people see, where it goes, its SLA, and when it closes on its own."
      actions={may('C') && <Button kind="primary" onClick={() => setEdit({})}>New task rule</Button>}>
      {!may('U') && <Notice>{role.name} can see the rules but not change them.</Notice>}
      <Segmented label="Record" value={rec} onChange={setRec} options={[['', `All (${s.rules.length})`], ...RECORDS.map(k => [k, `${k} (${s.rules.filter(r => r.record === k).length})`])]} />
      <Card flush>
        <Table head={['Rule', 'When', 'Task', 'Goes to', 'SLA', 'Closes when', 'On', '']} className="cfg__tab">
          {rows.map(r => {
            const missing = r.to !== 'region' && r.to !== 'owner' && !queueById(s, r.to);
            return (
              <tr key={r.id} className={r.on ? '' : 'gspx-off'}>
                <td className="cfg__strong">{r.name}<span className="cfg__sub">{r.record}</span></td>
                <td>{r.when}</td>
                <td>{r.task}<span className="cfg__sub">{(kindById(s, r.kind) || {}).name}</span></td>
                <td>{missing ? <Pill tone="dpill--bad">Queue deleted</Pill> : destName(s, r.to)}<span className="cfg__sub">{ASSIGN[r.who] || ''}</span></td>
                <td className="num">{r.sla}h</td>
                <td><span className="cfg__sub gspx-wrap">{r.closes}</span></td>
                <td><button type="button" role="switch" aria-checked={String(r.on)} aria-label={`${r.name} on`} className="switch__track" disabled={!may('U')}
                  onClick={() => update(d => { const x = d.rules.find(y => y.id === r.id); x.on = !x.on; }, `${user.name} switched “${r.name}” ${r.on ? 'off' : 'on'}`)}><span className="switch__knob" aria-hidden="true" /></button></td>
                <td className="cfg__acts">{may('U') && <LinkButton aria-label={`Edit ${r.name}`} onClick={() => setEdit(r)}>Edit</LinkButton>}</td>
              </tr>);
          })}
        </Table>
      </Card>
      <ChangeLog />
      {edit && <RuleSheet rule={edit.id ? edit : null} onClose={() => setEdit(null)} by={user} canDelete={may('D')} />}
    </Page>
  );
}

function RuleSheet({ rule, onClose, by, canDelete }) {
  const s = useStore();
  const init = React.useRef(rule ? { ...rule } : { id: 'r' + Date.now(), on: true, name: '', record: 'Application', when: triggersOf(s.rules, 'Application')[0] || '', task: '', to: 'region', who: 'owner', kind: s.kinds[0].id, sla: 9, closes: '' });
  const [v, setV] = useState(() => ({ ...init.current }));
  const [sure, setSure] = useState(false);
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const errors = {
    name: !v.name.trim() ? 'Enter the rule name.' : dupError(v.name, s.rules.filter(r => r.id !== v.id).map(r => r.name), 'There’s already a rule with this name.'),
    task: !v.task.trim() ? 'Enter the task people see.' : null,
    sla: numError(v.sla, { what: 'SLA', min: 1, max: 540, int: true, required: true }),
    days: v.days != null ? numError(v.days, { what: 'days before', min: 1, max: 365, int: true, required: true }) : null,
  };
  const c = useCheck(errors);
  const dirty = JSON.stringify(v) !== JSON.stringify(init.current);
  const save = () => {
    if (!c.submit()) return;
    update(d => { const i = d.rules.findIndex(r => r.id === v.id); if (i >= 0) d.rules[i] = v; else d.rules.push(v); }, `${by.name} ${rule ? 'edited' : 'created'} rule “${v.name}”`);
    toast(rule ? 'Rule saved' : 'Rule created', { text: rule ? 'Applies to new tasks from now.' : 'It starts checking records now.' }); onClose();
  };
  const dup = s.rules.find(r => r.id !== v.id && r.on && r.record === v.record && r.when === v.when);
  return (
    <>
    <Sheet wide title={rule ? `Edit “${rule.name}”` : 'New task rule'} onClose={onClose} dirty={dirty} what={rule ? `“${rule.name}”` : 'the new rule'}
      footer={<>{rule && canDelete && <Button kind="danger-quiet" onClick={() => setSure(true)}>Delete rule</Button>}<span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={!!rule && !dirty} onClick={save}>{rule ? 'Save' : 'Create rule'}</Button></>}>
      <div className="cfg__form gspx-form2">
        <Field id="r-name" label="Rule name" required error={c.err('name')}><Input id="r-name" value={v.name} onBlur={c.blur('name')} onChange={x => set('name', x)} placeholder="Like: Branch has no BDM" /></Field>
        <Select id="r-rec" label="Record it watches" required value={v.record} onChange={x => setV(o => ({ ...o, record: x, when: triggersOf(s.rules, x)[0] || '' }))} options={RECORDS} />
        {triggersOf(s.rules, v.record).length ? <Select id="r-when" label="When" required value={v.when} onChange={x => set('when', x)} options={[...new Set([...triggersOf(s.rules, v.record), v.when].filter(Boolean))]} />
          : <Field id="r-when" label="When" required><Input id="r-when" value={v.when} onChange={x => set('when', x)} placeholder="Like: A course is in draft for 7 days" /></Field>}
        {v.days != null && <Field id="r-days" label="Days before" required error={c.err('days')} hint="The rule’s own value: the Institution Team’s renewal reminders read it."><Input id="r-days" type="number" value={v.days} onChange={x => setV(o => ({ ...o, days: x === '' ? '' : Number(x), when: String(o.when).replace(/^\d+/, x) }))} /></Field>}
        <Field id="r-task" label="Task people see" required error={c.err('task')} hint="Write [record] where the record’s name goes."><Input id="r-task" value={v.task} onBlur={c.blur('task')} onChange={x => set('task', x)} placeholder="Like: Chase the university for [record]" /></Field>
        <Select id="r-to" label="Goes to" required value={v.to} onChange={x => set('to', x)} options={DEST(s)} />
        <Select id="r-who" label="Assigned by" required value={v.who} onChange={x => set('who', x)} options={Object.entries(ASSIGN).filter(([k]) => k !== 'owner')} />
        <Select id="r-kind" label="Kind of work" required value={v.kind} onChange={x => setV(o => ({ ...o, kind: x, sla: (kindById(s, x) || {}).sla ?? o.sla }))} options={s.kinds.map(k => [k.id, k.name])} />
        <Field id="r-sla" label="SLA (working hours)" hint="A working day is 9 hours, 9:30 to 18:30." required error={c.err('sla')}><Input id="r-sla" type="number" value={v.sla} onBlur={c.blur('sla')} onChange={x => set('sla', x)} /></Field>
        <Field id="r-close" label="Closes itself when" hint="Leave empty if a person closes it with an outcome."><Input id="r-close" value={v.closes} onChange={x => set('closes', x)} placeholder="Like: A decision is recorded" /></Field>
      </div>
      <p className="gspx-sentence"><b>In words: </b>when “{v.when.toLowerCase()}” on {v.record === 'Any' ? 'any record' : `a${/^[AEIOU]/.test(v.record) ? 'n' : ''} ${v.record.toLowerCase()}`}, create “{v.task || '…'}” in {destName(s, v.to)}, due in {v.sla} working hour{v.sla === 1 ? '' : 's'}. {v.closes ? `It closes itself when ${v.closes.charAt(0).toLowerCase() + v.closes.slice(1)}.` : 'Someone closes it with an outcome.'}</p>
      {dup && <Notice tone="warn">“{dup.name}” already watches the same thing. Both would create a task.</Notice>}
    </Sheet>
    <ConfirmDialog open={sure} danger title={`Delete “${v.name}”?`} confirm="Delete rule" onCancel={() => setSure(false)}
      onConfirm={() => { setSure(false); update(d => { d.rules = d.rules.filter(r => r.id !== v.id); }, `${by.name} deleted rule “${v.name}”`); toast('Rule deleted', { text: 'Open tasks it created stay until they’re done.' }); onClose(); }}>
      <p>It stops creating tasks. Open tasks it created stay until they’re done. This can’t be undone.</p>
    </ConfirmDialog>
    </>
  );
}
