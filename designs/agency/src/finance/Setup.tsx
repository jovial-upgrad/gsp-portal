// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Finance setup: every rule Finance works by, editable.
 * Payout run · Approvals · Exceptions · Recurring jobs · Defaults and FX.
 * Changes go through maker-checker like any other settings change (unless turned off here).
 */
import React, { useState } from 'react';
import { update, getState } from './store';
import { can } from './access';
import { Page, Card, Select, Table, Button, LinkButton, Field, Input, Num, Notice, Empty, toast } from './kit';
import { useCheck, numError } from '../components/validate';
import { useUnsaved } from '../components/unsaved';
import { PersonaBar, usePersona } from './persona';
import { useComm, opsOf, DAYS, proposeChange, applyChange, impactOf, aud } from './shared';
import { Settings } from './Terms';

const PAGES = [['gspx-fin-home', 'Home'], ['gspx-fin-uni', 'University invoices'], ['gspx-fin-rp', 'RP commission'], ['gspx-fin-run', 'Payout run'], ['gspx-fin-exc', 'Exceptions'], ['gspx-fin-terms', 'Commission terms'], ['gspx-fin-reports', 'Reports'], ['gspx-fin-setup', 'Finance setup'], ['gspx-mail', 'Mail'], ['gspx-mywork', 'My work']];
const METRICS = [['', 'None'], ['fx', 'FX rates missing'], ['run', 'Payout run status'], ['invoices', 'Lines ready to invoice'], ['overdue', 'Payments waiting'], ['exceptions', 'Exceptions'], ['checks', 'Changes to check'], ['mail', 'Commission mailbox'], ['annuity', 'Annuity due'], ['ending', 'Contracts and notices ending']];
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
  const queues = [['q-finance', 'Finance'], ['officer', 'The application’s admission officer'], ['q-institution', 'Institution'], ['q-rp-ops', 'Recruitment Ops'], ['q-adm-ops', 'Admission Ops'], ['legal', 'Legal']];
  const finance = s.users.filter(u => u.role === 'finance');
  // QC, 1 Nov: no negative or empty days, a prefix and names that aren't blank; checked when left and on Send
  const slaErr = d.exceptions.map(x => numError(x.sla, { what: `SLA for ${x.type}`, min: 1, max: 60, int: true, required: true }));
  const dayErr = d.jobs.map(j => j.freq === 'monthly' ? numError(j.day, { what: `day of the month for ${j.name || 'the job'}`, min: 1, max: 28, int: true, required: true }) : null);
  const errors = {
    pre: !String(d.rctiPrefix || '').trim() ? 'Enter what invoice numbers start with, like RCTI-.' : null,
    days: d.rpApproves ? numError(d.rpApproveDays, { what: 'working days to approve', min: 1, max: 30, int: true, required: true }) : null,
    adm: numError(d.adminAbove, { what: 'amount that needs an Admin', min: 0 }),
    batch: d.batches.some(b => !String(b.name).trim()) ? 'Give every batch a name.' : null,
    sla: slaErr.find(Boolean) || null,
    jobs: d.jobs.some(j => !String(j.name).trim()) ? 'Give every job a name.' : dayErr.find(Boolean) || null,
  };
  const page = React.useRef(null);
  const v = useCheck(errors, () => page.current);
  useUnsaved(canEdit && changed, changed, { onDiscard: () => setD(structuredClone(saved)), region: page, what: 'Finance setup', esc: false });

  const save = () => {
    if (!v.submit()) return;
    const after = { ...cfg.settings, ops: d };
    if (!saved.makerChecker.settings) {
      update(x => applyChange(x, { area: 'settings', target: 'settings', after }), `${user.name} changed Finance setup (no check needed)`);
      toast('Finance setup saved'); v.reset(); return;
    }
    proposeChange({ area: 'settings', id: 'settings', before: cfg.settings, after, summary: 'Finance setup (payout run, approvals, exceptions, jobs)', impact: impactOf(cfg, c.apps, c.today, 'settings', 'settings', after), user });
    toast('Sent for checking', { text: 'It applies once a second Finance person approves it.' });
    setD(structuredClone(saved)); v.reset();
  };
  const propose = (area, id, before, after, summary) => {
    if (!saved.makerChecker.settings) { update(x => applyChange(x, { area, target: id, after }), `${user.name} changed ${summary}`); toast('Settings saved'); return; }
    proposeChange({ area, id, before, after, summary, impact: impactOf(cfg, c.apps, c.today, area, id, after), user }); toast('Sent for checking.');
  };
  const row = (k, i, patch) => set(k, d[k].map((x, j) => j === i ? { ...x, ...patch } : x));

  return (
    <Page title="Finance setup" top={<PersonaBar />}
      lead="How Finance works, as settings: pay day, batches, approvals, where exceptions go and the recurring jobs on Finance home. Changes are checked by a second person."
      actions={canEdit && <div className="gspx-acts">{changed && <Button onClick={() => { setD(structuredClone(saved)); v.reset(); }}>Cancel</Button>}<Button kind="primary" disabled={!changed} onClick={save}>{saved.makerChecker.settings ? 'Send for checking' : 'Save'}</Button></div>}>
      <div ref={page} className="gspx-stack">
      {!canEdit && <Notice>Read only. Finance and Admin change these.</Notice>}
      {pending && <Notice tone="warn">A settings change is waiting for a second person on Commission terms.</Notice>}

      <Card>
        <h2 className="gspx-h3">Payout run</h2>
        <div className="gspx-form2">
          <Select id="o-day" label="Pay day" required disabled={!canEdit} value={String(d.payDay)} onChange={v => set('payDay', Number(v))} options={[1, 2, 3, 4, 5].map(n => [String(n), DAYS[n]])} />
          <Field id="o-pre" label="Invoice number starts with" required error={v.err('pre')}><Input id="o-pre" value={d.rctiPrefix} onBlur={v.blur('pre')} onChange={x => set('rctiPrefix', x)} disabled={!canEdit} /></Field>
          <Field id="o-days" label="RPs approve their invoice within (working days)" required={d.rpApproves} error={v.err('days')}><Input id="o-days" type="number" value={d.rpApproveDays} onBlur={v.blur('days')} onChange={x => set('rpApproveDays', x)} disabled={!canEdit || !d.rpApproves} /></Field>
        </div>
        <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={d.rpApproves} onChange={e => set('rpApproves', e.target.checked)} /> RPs approve the invoice GSP raises for them (recipient-created tax invoice) before they’re paid</label>
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
        <p className="muted">Each RP’s account type is on its RP terms. A batch holds every RP with that account type.</p>
      </Card>

      <Card>
        <h2 className="gspx-h3">Approvals</h2>
        <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={d.makerChecker.terms} onChange={e => set('makerChecker', { ...d.makerChecker, terms: e.target.checked })} /> A second person checks changes to universities, RP terms, schemes and notices</label>
        <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={d.makerChecker.settings} onChange={e => set('makerChecker', { ...d.makerChecker, settings: e.target.checked })} /> A second person checks changes to defaults, FX and this page</label>
        <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={d.makerChecker.run} onChange={e => set('makerChecker', { ...d.makerChecker, run: e.target.checked })} /> The person who prepares a payout run can’t approve it</label>
        <div className="gspx-form2">
          <Field id="o-adm" label="Runs above this also need an Admin (AUD)" hint="Leave blank for no limit" error={v.err('adm')}><Input id="o-adm" type="number" value={d.adminAbove ?? ''} onBlur={v.blur('adm')} onChange={x => set('adminAbove', x === '' ? null : x)} disabled={!canEdit} /></Field>
        </div>
        <p className="muted">Who can do what in Finance (create, read, change, delete) is set in GSP · Admin › User roles › Permission roles.</p>
      </Card>

      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Exceptions</h2><p className="muted">What each exception does and who fixes it. Each one raises a task with this SLA.</p></div>
        <Table head={['Exception', 'Blocks payment', 'Goes to', 'SLA (working days)']}>
          {d.exceptions.map((x, i) => (
            <tr key={x.type} className="irow">
              <td className="cfg__strong">{x.type}</td>
              <td><input type="checkbox" aria-label={`${x.type} blocks payment`} disabled={!canEdit} checked={x.blocks} onChange={e => row('exceptions', i, { blocks: e.target.checked })} /></td>
              <td><Select id={`ex-${i}`} label={`${x.type}: goes to`} hideLabel disabled={!canEdit} value={x.to} onChange={y => row('exceptions', i, { to: y })} options={queues} /></td>
              <td><Num label={`${x.type}: SLA (working days)`} disabled={!canEdit} value={x.sla} error={(v.err('sla') && slaErr[i]) || undefined} onBlur={v.blur('sla')} onChange={y => row('exceptions', i, { sla: y })} /></td>
            </tr>))}
        </Table>
        {v.err('sla') && <p className="field__msg field__msg--error gspx-pad" role="alert">{v.err('sla')}</p>}
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
