// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Finance setup: every rule Finance works by, editable.
 * Payout run · Approvals · Exceptions · Recurring jobs · Defaults and FX.
 * Changes go through maker-checker like any other settings change (unless turned off here).
 */
import React, { useState } from 'react';
import { update, getState } from './store';
import { can } from './access';
import { Page, Card, Select, Table, Button, LinkButton, Field, Input, Num, Notice, Empty, toast, NumberInput } from './kit';
import { useCheck, numError } from '../components/validate';
import { useUnsaved } from '../components/unsaved';
import { PersonaBar, usePersona } from './persona';
import { useComm, opsOf, DAYS, proposeChange, applyChange, impactOf, aud, ENGINE_EXCEPTIONS } from './shared';
import { Settings } from './Terms';

const PAGES = [['gspx-fin-home', 'Home'], ['gspx-fin-uni', 'University invoices'], ['gspx-fin-rp', 'RP commission'], ['gspx-fin-run', 'RP invoices and payout'], ['gspx-fin-exc', 'Exceptions'], ['gspx-fin-terms', 'Commission terms'], ['gspx-fin-reports', 'Reports'], ['gspx-fin-setup', 'Finance setup'], ['gspx-mail', 'Mail'], ['gspx-mywork', 'My work']];
const METRICS = [['', 'None'], ['fx', 'FX rates missing'], ['run', 'RP invoices to check and pay'], ['invoices', 'Lines ready to invoice'], ['overdue', 'Payments waiting'], ['exceptions', 'Exceptions'], ['mail', 'Commission mailbox'], ['annuity', 'Annuity due'], ['ending', 'Contracts and notices ending']];
const FREQ = [['daily', 'Every working day'], ['weekly', 'Weekly'], ['payday', 'Every pay day'], ['monthly', 'Monthly']];

export default function Setup() {
  const { s, c, cfg } = useComm();
  const { user, role } = usePersona();
  const canEdit = can(s.matrix, role.id, 'comm-terms', 'U');
  const saved = opsOf(cfg);
  const [d, setD] = useState(() => structuredClone(saved));
  const set = (k, v) => setD(x => ({ ...x, [k]: v }));
  const changed = JSON.stringify(d) !== JSON.stringify(saved);
  const pending = c.checks.some(k => k.status === 'waiting' && k.area === 'settings');
  // where an exception goes: the Work queues (Work › Queues, SLA and escalation; HC46), the officer, or Legal
  const queues = [...s.queues.filter(q => q.kind === 'team').map(q => [q.id, q.name]), ['officer', 'The application’s admission officer'], ['legal', 'Legal']];
  const [newExc, setNewExc] = useState('');
  const finance = s.users.filter(u => u.role === 'finance');
  // QC, 1 Nov: no negative or empty days, a prefix and names that aren't blank; checked when left and on Send
  const slaErr = d.exceptions.map(x => numError(x.sla, { what: `SLA for ${x.type}`, min: 1, max: 60, int: true, required: true }));
  const dayErr = d.jobs.map(j => j.freq === 'monthly' ? numError(j.day, { what: `day of the month for ${j.name || 'the job'}`, min: 1, max: 28, int: true, required: true }) : null);
  const errors = {
    pre: !String(d.rctiPrefix || '').trim() ? 'Enter what system invoice references start with, like INV.' : null,
    cut: numError(d.cycle.cutoffDay, { what: 'cut-off day', min: 1, max: 31, int: true, required: true }),
    payby: numError(d.cycle.payByDay, { what: 'pay-by day', min: 1, max: 28, int: true, required: true }),
    lists: ['invoiceChecks', 'sendBackReasons', 'diffReasons'].some(k => !d[k].some(x => x.trim())) ? 'Each list needs at least one line.' : null,
    ents: d.entities.some(e => !String(e.name).trim() || !String(e.prefix).trim()) ? 'Give every entity a name and a number prefix.' : null,
    batch: d.batches.some(b => !String(b.name).trim()) ? 'Give every batch a name.' : null,
    sla: slaErr.find(Boolean) || null,
    jobs: d.jobs.some(j => !String(j.name).trim()) ? 'Give every job a name.' : dayErr.find(Boolean) || null,
    ahead: ['annuity', 'notices', 'contracts'].map(k => numError(d.lookAhead[k], { what: 'days to look ahead', min: 1, max: 365, int: true, required: true })).find(Boolean) || null,
  };
  const page = React.useRef(null);
  const v = useCheck(errors, () => page.current);
  useUnsaved(canEdit && changed, changed, { onDiscard: () => setD(structuredClone(saved)), region: page, what: 'Finance setup', esc: false });

  const save = () => {
    if (!v.submit()) return;
    const clean = k => d[k].map(x => x.trim()).filter(Boolean);
    const after = { ...cfg.settings, ops: { ...d, invoiceChecks: clean('invoiceChecks'), sendBackReasons: clean('sendBackReasons'), diffReasons: clean('diffReasons') } };
    update(x => applyChange(x, { area: 'settings', target: 'settings', after }), `${user.name} changed Finance setup`);
    toast('Finance setup saved'); v.reset();
  };
  const propose = (area, id, before, after, summary) => { update(x => applyChange(x, { area, target: id, after }), `${user.name} changed ${summary}`); toast('Settings saved'); };
  const lines = k => d[k].join('\n');
  const setLines = (k, t) => set(k, t.split('\n'));
  const nums = t => t.split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x) && x >= 0);
  const row = (k, i, patch) => set(k, d[k].map((x, j) => j === i ? { ...x, ...patch } : x));

  return (
    <Page title="Finance setup" top={<PersonaBar />}
      lead="How Finance works, as settings: the monthly pay cycle, RP and university invoices, where exceptions go and the recurring jobs on Finance home. One Finance person saves them; they apply at once."
      actions={canEdit && <div className="gspx-acts">{changed && <Button onClick={() => { setD(structuredClone(saved)); v.reset(); }}>Cancel</Button>}<Button kind="primary" disabled={!changed} onClick={save}>Save</Button></div>}>
      <div ref={page} className="gspx-stack">
      {!canEdit && <Notice>Read only. Finance and Admin change these.</Notice>}

      <Card>
        <h2 className="gspx-h3">Monthly pay cycle</h2>
        <div className="gspx-form2">
          <Field id="o-cut" label="Cut-off: day of the month" required error={v.err('cut')} hint="Lines ready by this day go on that month’s invoice. 31 means the last day."><NumberInput id="o-cut" decimal={false} min={1} max={31} steppers value={d.cycle.cutoffDay} onBlur={v.blur('cut')} onChange={x => set('cycle', { ...d.cycle, cutoffDay: x })} disabled={!canEdit} /></Field>
          <Field id="o-payby" label="Pay by: day of the next month" required error={v.err('payby')}><NumberInput id="o-payby" decimal={false} min={1} max={28} steppers value={d.cycle.payByDay} onBlur={v.blur('payby')} onChange={x => set('cycle', { ...d.cycle, payByDay: x })} disabled={!canEdit} /></Field>
          <Field id="o-pre" label="System invoice references start with" required error={v.err('pre')}><Input id="o-pre" value={d.rctiPrefix} onBlur={v.blur('pre')} onChange={x => set('rctiPrefix', x)} disabled={!canEdit} /></Field>
          <Field id="o-rem" label="Remind RPs to invoice (days after the cut-off)" hint="Comma separated, like 3, 7, 14"><Input id="o-rem" value={d.invoiceReminders.join(', ')} onChange={x => set('invoiceReminders', nums(x))} disabled={!canEdit} /></Field>
        </div>
        <h3 className="gspx-h4">Payment batches</h3>
        <Table head={['Batch name', 'Bank accounts', '']}>
          {d.batches.map((b, i) => (
            <tr key={b.id} className="irow">
              <td><Input id={`b-${i}`} aria-label={`Batch ${i + 1} name`} value={b.name} error={(v.err('batch') && !String(b.name).trim()) || undefined} onBlur={v.blur('batch')} onChange={x => row('batches', i, { name: x })} disabled={!canEdit} /></td>
              <td><Select id={`bb-${i}`} label={`Batch ${i + 1}: bank accounts`} hideLabel disabled={!canEdit} value={b.bank} onChange={v => row('batches', i, { bank: v })} options={[['AU', 'Australian accounts'], ['Local', 'Local accounts']]} /></td>
              <td>{canEdit && d.batches.length > 1 && <LinkButton aria-label={`Remove ${b.name || `batch ${i + 1}`}`} onClick={() => set('batches', d.batches.filter((_, j) => j !== i))}>Remove</LinkButton>}</td>
            </tr>))}
        </Table>
        {v.err('batch') && <p className="field__msg field__msg--error" role="alert">{v.err('batch')}</p>}
      </Card>

      <Card>
        <h2 className="gspx-h3">RP invoices</h2>
        <p className="muted">The RP downloads the system invoice, adds its own number and date, signs and uploads it. Finance ticks each check before approving, or sends it back with one of the reasons.</p>
        <div className="gspx-form2">
          <Field id="o-chk" label="Checks on an uploaded invoice" hint="One per line"><textarea id="o-chk" className="gspx-textarea" rows={5} value={lines('invoiceChecks')} onChange={e => setLines('invoiceChecks', e.target.value)} disabled={!canEdit} /></Field>
          <Field id="o-sb" label="Reasons to send one back" hint="One per line"><textarea id="o-sb" className="gspx-textarea" rows={5} value={lines('sendBackReasons')} onChange={e => setLines('sendBackReasons', e.target.value)} disabled={!canEdit} /></Field>
        </div>
        {v.err('lists') && <p className="field__msg field__msg--error" role="alert">{v.err('lists')}</p>}
      </Card>

      <Card>
        <h2 className="gspx-h3">University invoices and upGrad entities</h2>
        <p className="muted">The entity that invoices universities in each destination and pays RPs in each sales region, and its number prefix.</p>
        <Table head={['Entity', 'Number prefix', 'Invoices universities in', 'Pays RPs in']}>
          {d.entities.map((e, i) => (
            <tr key={e.id} className="irow">
              <td><Input id={`e-n-${i}`} aria-label={`Entity ${i + 1} name`} value={e.name} onChange={x => row('entities', i, { name: x })} disabled={!canEdit} /></td>
              <td><Input id={`e-p-${i}`} aria-label={`Entity ${i + 1} prefix`} value={e.prefix} onChange={x => row('entities', i, { prefix: x })} disabled={!canEdit} /></td>
              <td><Input id={`e-d-${i}`} aria-label={`Entity ${i + 1} destinations`} value={e.destinations.join(', ')} onChange={x => row('entities', i, { destinations: x.split(',').map(y => y.trim().toUpperCase()).filter(Boolean) })} disabled={!canEdit} /></td>
              <td><Input id={`e-r-${i}`} aria-label={`Entity ${i + 1} RP regions`} value={e.rpRegions.join(', ')} onChange={x => row('entities', i, { rpRegions: x.split(',').map(y => y.trim()).filter(Boolean) })} disabled={!canEdit} /></td>
            </tr>))}
        </Table>
        {v.err('ents') && <p className="field__msg field__msg--error" role="alert">{v.err('ents')}</p>}
        <div className="gspx-form2">
          <Field id="o-od" label="Remind universities (days after the due date)" hint="Comma separated, like 0, 7, 14"><Input id="o-od" value={d.overdueReminders.join(', ')} onChange={x => set('overdueReminders', nums(x))} disabled={!canEdit} /></Field>
          <Field id="o-dr" label="Reasons for a payment difference" hint="One per line"><textarea id="o-dr" className="gspx-textarea" rows={5} value={lines('diffReasons')} onChange={e => setLines('diffReasons', e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </Card>

      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Exceptions</h2><p className="muted">What each exception does and who fixes it. Each one raises a task with this SLA.</p></div>
        <Table head={['Exception', 'Blocks payment', 'Goes to', 'SLA (working days)', '']}>
          {d.exceptions.map((x, i) => (
            <tr key={x.type} className="irow">
              <td className="cfg__strong">{x.type}<span className="irow__sub">{ENGINE_EXCEPTIONS.includes(x.type) ? 'Raised by the commission engine' : 'Raised by hand'}</span></td>
              <td><input type="checkbox" aria-label={`${x.type} blocks payment`} disabled={!canEdit} checked={x.blocks} onChange={e => row('exceptions', i, { blocks: e.target.checked })} /></td>
              <td><Select id={`ex-${i}`} label={`${x.type}: goes to`} hideLabel disabled={!canEdit} value={x.to} onChange={y => row('exceptions', i, { to: y })} options={queues} /></td>
              <td><Num label={`${x.type}: SLA (working days)`} disabled={!canEdit} value={x.sla} error={(v.err('sla') && slaErr[i]) || undefined} onBlur={v.blur('sla')} onChange={y => row('exceptions', i, { sla: y })} /></td>
              <td>{canEdit && !ENGINE_EXCEPTIONS.includes(x.type) && <LinkButton aria-label={`Remove ${x.type}`} onClick={() => set('exceptions', d.exceptions.filter((_, j) => j !== i))}>Remove</LinkButton>}</td>
            </tr>))}
        </Table>
        {canEdit && <div className="gspx-pad gspx-inline">
          <Field id="ex-new" label="Add an exception type"><Input id="ex-new" value={newExc} onChange={setNewExc} placeholder="Like: Duplicate enrolment" /></Field>
          <Button disabled={!newExc.trim() || d.exceptions.some(x => x.type.toLowerCase() === newExc.trim().toLowerCase())} onClick={() => { set('exceptions', [...d.exceptions, { type: newExc.trim(), blocks: false, sla: 2, to: 'q-finance' }]); setNewExc(''); }}>Add</Button>
        </div>}
        {v.err('sla') && <p className="field__msg field__msg--error gspx-pad" role="alert">{v.err('sla')}</p>}
      </Card>

      <Card>
        <h2 className="gspx-h3">Look-ahead</h2>
        <p className="muted">How far ahead Finance home and Commission terms look for what’s coming up.</p>
        <div className="gspx-form2">
          <Field id="la-ann" label="Annuity lines due within (days)" required error={v.err('ahead')}><NumberInput id="la-ann" decimal={false} min={0} steppers value={d.lookAhead.annuity} disabled={!canEdit} onBlur={v.blur('ahead')} onChange={x => set('lookAhead', { ...d.lookAhead, annuity: x === '' ? '' : Number(x) })} /></Field>
          <Field id="la-not" label="Notices ending within (days)" required><NumberInput id="la-not" decimal={false} min={0} steppers value={d.lookAhead.notices} disabled={!canEdit} onBlur={v.blur('ahead')} onChange={x => set('lookAhead', { ...d.lookAhead, notices: x === '' ? '' : Number(x) })} /></Field>
          <Field id="la-con" label="Contracts ending within (days)" required><NumberInput id="la-con" decimal={false} min={0} steppers value={d.lookAhead.contracts} disabled={!canEdit} onBlur={v.blur('ahead')} onChange={x => set('lookAhead', { ...d.lookAhead, contracts: x === '' ? '' : Number(x) })} /></Field>
        </div>
      </Card>

      <Card flush>
        <div className="stools"><div className="stools__row"><div className="gspx-grow"><h2 className="gspx-h3">Recurring jobs</h2><p className="muted">These make Finance home’s list for each day.</p></div>
          {canEdit && <Button onClick={() => set('jobs', [...d.jobs, { id: 'j-' + Date.now().toString(36), name: 'New job', freq: 'weekly', day: 1, who: '', page: 'gspx-fin-home', metric: '' }])}>Add job</Button>}</div></div>
        <Table head={['Job', 'How often', 'Day', 'Who', 'Opens', 'Shows', '']} empty={!d.jobs.length && <Empty title="No jobs" />}>
          {d.jobs.map((j, i) => (
            <tr key={j.id} className="irow">
              <td><Input id={`j-${i}`} aria-label={`Job ${i + 1} name`} value={j.name} error={(v.err('jobs') && !String(j.name).trim()) || undefined} onBlur={v.blur('jobs')} onChange={y => row('jobs', i, { name: y })} disabled={!canEdit} /></td>
              <td><Select id={`jf-${i}`} label={`${j.name || `Job ${i + 1}`}: how often`} hideLabel disabled={!canEdit} value={j.freq} onChange={y => row('jobs', i, { freq: y })} options={FREQ} /></td>
              <td>{j.freq === 'weekly' ? <Select id={`jd-${i}`} label={`${j.name || `Job ${i + 1}`}: day`} hideLabel disabled={!canEdit} value={String(j.day)} onChange={y => row('jobs', i, { day: Number(y) })} options={[1, 2, 3, 4, 5].map(n => [String(n), DAYS[n]])} />
                : j.freq === 'monthly' ? <Num label={`${j.name || `Job ${i + 1}`}: day of the month (1 to 28)`} disabled={!canEdit} value={j.day} error={(v.err('jobs') && dayErr[i]) || undefined} onBlur={v.blur('jobs')} onChange={y => row('jobs', i, { day: y })} /> : <span className="muted">—</span>}</td>
              <td><Select id={`jw-${i}`} label={`${j.name || `Job ${i + 1}`}: who`} hideLabel disabled={!canEdit} value={j.who} onChange={y => row('jobs', i, { who: y })} options={[['', 'Anyone in Finance'], ...finance.map(u => [u.id, u.name])]} /></td>
              <td><Select id={`jp-${i}`} label={`${j.name || `Job ${i + 1}`}: opens`} hideLabel disabled={!canEdit} value={j.page} onChange={y => row('jobs', i, { page: y })} options={PAGES} /></td>
              <td><Select id={`jm-${i}`} label={`${j.name || `Job ${i + 1}`}: shows`} hideLabel disabled={!canEdit} value={j.metric} onChange={y => row('jobs', i, { metric: y })} options={METRICS} /></td>
              <td>{canEdit && <LinkButton aria-label={`Remove ${j.name || `job ${i + 1}`}`} onClick={() => set('jobs', d.jobs.filter((_, k) => k !== i))}>Remove</LinkButton>}</td>
            </tr>))}
        </Table>
        {v.err('jobs') && <p className="field__msg field__msg--error gspx-pad" role="alert">{v.err('jobs')}</p>}
      </Card>

      </div>
      <h2 className="gspx-h3">Defaults and FX</h2>
      <Settings c={c} canEdit={canEdit} propose={propose} />
    </Page>
  );
}
