// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * Task rules (Admin): what creates a task, where it goes, its SLA and when it
 * closes itself. Rules can be created, edited, switched off and deleted.
 */
import React, { useState } from 'react';
import { useStore, update, queueById, kindById, ASSIGN } from './store';
import { can } from '../finance/access';
import { Page, Card, Segmented, Select, Table, Pill, Button, LinkButton, Sheet, Field, Input, Notice, toast } from '../finance/kit';
import { PersonaBar, usePersona } from './persona';
import { ChangeLog } from './Queues';

/* What a rule can watch, per record. In the real build each line maps to an event or a scheduled check. */
export const TRIGGERS = {
  Application: ['Status becomes Pending verification', 'Status becomes Ready to submit', 'Submitted to university for longer than its SLA', 'Status becomes Finance and background check', 'Status becomes Payment proof under review', 'Documents verified and ready to submit', 'Visa granted and start date within 14 days', 'Census date passed and enrolment not confirmed', 'Deferred and the new intake is 30 days away'],
  RP: ['All onboarding documents uploaded', 'Not activated for 3 days', 'Documents sent back and not re-uploaded for 5 days', 'No application in 90 days', 'Bank details changed'],
  'Institution partner': ['60 days before the agreement ends', '30 days before the agreement ends', 'Agreement signed'],
  University: ['Set up for 14 days and not live', 'Paused for 30 days'],
  Course: ['A course is in draft for 7 days', 'Fees valid until date is 30 days away', 'Intake has no census date 60 days before start'],
  Commission: ['An agreement is signed and no terms are entered', 'Terms, a notice or a scheme changed', 'An enrolment cannot be priced', 'Thursday payout run is due', 'Weekly FX rate is missing'],
  Email: ['An email is matched to an application', 'AI confidence below 80%', 'An RP email is not answered in 1 working day'],
  Any: ['A task is overdue by 2 working days'],
};

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
      <Segmented label="Record" value={rec} onChange={setRec} options={[['', `All (${s.rules.length})`], ...Object.keys(TRIGGERS).map(k => [k, `${k} (${s.rules.filter(r => r.record === k).length})`])]} />
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
                <td className="num">{r.sla}d</td>
                <td><span className="cfg__sub gspx-wrap">{r.closes}</span></td>
                <td><button type="button" role="switch" aria-checked={String(r.on)} aria-label={`${r.name} on`} className="switch__track" disabled={!may('U')}
                  onClick={() => update(d => { const x = d.rules.find(y => y.id === r.id); x.on = !x.on; }, `${user.name} switched “${r.name}” ${r.on ? 'off' : 'on'}`)}><span className="switch__knob" aria-hidden="true" /></button></td>
                <td className="cfg__acts">{may('U') && <LinkButton onClick={() => setEdit(r)}>Edit</LinkButton>}</td>
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
  const [v, setV] = useState(() => rule ? { ...rule } : { id: 'r' + Date.now(), on: true, name: '', record: 'Application', when: TRIGGERS.Application[0], task: '', to: 'region', who: 'owner', kind: s.kinds[0].id, sla: 1, closes: '' });
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const save = () => {
    if (!v.name.trim() || !v.task.trim()) { toast('Give the rule a name and the task text.'); return; }
    update(d => { const i = d.rules.findIndex(r => r.id === v.id); if (i >= 0) d.rules[i] = v; else d.rules.push(v); }, `${by.name} ${rule ? 'edited' : 'created'} rule “${v.name}”`);
    toast(rule ? 'Saved. Applies to new tasks from now.' : 'Rule created. It starts checking records now.'); onClose();
  };
  const dup = s.rules.find(r => r.id !== v.id && r.on && r.record === v.record && r.when === v.when);
  return (
    <Sheet wide title={rule ? `Edit “${rule.name}”` : 'New task rule'} onClose={onClose}
      footer={<>{rule && canDelete && <Button onClick={() => { update(d => { d.rules = d.rules.filter(r => r.id !== v.id); }, `${by.name} deleted rule “${v.name}”`); toast('Rule deleted. Open tasks it created stay until done.'); onClose(); }}>Delete rule</Button>}<span className="gspx-grow" /><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={save}>{rule ? 'Save' : 'Create rule'}</Button></>}>
      <div className="cfg__form gspx-form2">
        <Field id="r-name" label="Rule name" required><Input id="r-name" value={v.name} onChange={x => set('name', x)} placeholder="Like: Branch has no BDM" /></Field>
        <Select id="r-rec" label="Record it watches" value={v.record} onChange={x => setV(o => ({ ...o, record: x, when: TRIGGERS[x][0] }))} options={Object.keys(TRIGGERS)} />
        <Select id="r-when" label="When" value={v.when} onChange={x => set('when', x)} options={TRIGGERS[v.record]} />
        <Field id="r-task" label="Task people see" required hint="Write [record] where the record’s name goes."><Input id="r-task" value={v.task} onChange={x => set('task', x)} placeholder="Like: Chase the university for [record]" /></Field>
        <Select id="r-to" label="Goes to" value={v.to} onChange={x => set('to', x)} options={DEST(s)} />
        <Select id="r-who" label="Assigned by" value={v.who} onChange={x => set('who', x)} options={Object.entries(ASSIGN).filter(([k]) => k !== 'owner')} />
        <Select id="r-kind" label="Kind of work" value={v.kind} onChange={x => setV(o => ({ ...o, kind: x, sla: (kindById(s, x) || {}).sla ?? o.sla }))} options={s.kinds.map(k => [k.id, k.name])} />
        <Field id="r-sla" label="SLA (working days)"><Input id="r-sla" type="number" min="0" value={v.sla} onChange={x => set('sla', x)} /></Field>
        <Field id="r-close" label="Closes itself when" hint="Leave empty if a person closes it with an outcome."><Input id="r-close" value={v.closes} onChange={x => set('closes', x)} placeholder="Like: A decision is recorded" /></Field>
      </div>
      <p className="gspx-sentence"><b>In words: </b>when “{v.when.toLowerCase()}” on {v.record === 'Any' ? 'any record' : `a${/^[AEIOU]/.test(v.record) ? 'n' : ''} ${v.record.toLowerCase()}`}, create “{v.task || '…'}” in {destName(s, v.to)}, due in {v.sla} working day{v.sla === 1 ? '' : 's'}. {v.closes ? `It closes itself when ${v.closes.charAt(0).toLowerCase() + v.closes.slice(1)}.` : 'Someone closes it with an outcome.'}</p>
      {dup && <Notice tone="warn">“{dup.name}” already watches the same thing. Both would create a task.</Notice>}
    </Sheet>
  );
}
