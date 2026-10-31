// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Finance setup: every rule Finance works by, editable.
 * Payout run · Approvals · Exceptions · Recurring jobs · Defaults and FX.
 * Changes go through maker-checker like any other settings change (unless turned off here).
 */
import React, { useState } from 'react';
import { update, getState } from './store';
import { can } from './access';
import { Page, Card, Select, Table, Button, LinkButton, Field, Input, Notice, Empty, toast } from './kit';
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

  const save = () => {
    const after = { ...cfg.settings, ops: d };
    if (!saved.makerChecker.settings) {
      update(x => applyChange(x, { area: 'settings', target: 'settings', after }), `${user.name} changed Finance setup (no check needed)`);
      toast('Saved.'); return;
    }
    proposeChange({ area: 'settings', id: 'settings', before: cfg.settings, after, summary: 'Finance setup (payout run, approvals, exceptions, jobs)', impact: impactOf(cfg, c.apps, c.today, 'settings', 'settings', after), user });
    toast('Sent for checking. It applies once a second Finance person approves it.');
  };
  const propose = (area, id, before, after, summary) => {
    if (!saved.makerChecker.settings) { update(x => applyChange(x, { area, target: id, after }), `${user.name} changed ${summary}`); toast('Saved.'); return; }
    proposeChange({ area, id, before, after, summary, impact: impactOf(cfg, c.apps, c.today, area, id, after), user }); toast('Sent for checking.');
  };
  const row = (k, i, patch) => set(k, d[k].map((x, j) => j === i ? { ...x, ...patch } : x));

  return (
    <Page title="Finance setup" top={<PersonaBar />}
      lead="How Finance works, as settings: pay day, batches, approvals, where exceptions go and the recurring jobs on Finance home. Changes are checked by a second person."
      actions={canEdit && <div className="gspx-acts">{changed && <LinkButton onClick={() => setD(structuredClone(saved))}>Undo changes</LinkButton>}<Button kind="primary" disabled={!changed} onClick={save}>{saved.makerChecker.settings ? 'Send for checking' : 'Save'}</Button></div>}>
      {!canEdit && <Notice>Read only. Finance and Admin change these.</Notice>}
      {pending && <Notice tone="warn">A settings change is waiting for a second person on Commission terms.</Notice>}

      <Card>
        <h2 className="gspx-h3">Payout run</h2>
        <div className="gspx-form2">
          <Select id="o-day" label="Pay day" value={String(d.payDay)} onChange={v => set('payDay', Number(v))} options={[1, 2, 3, 4, 5].map(n => [String(n), DAYS[n]])} />
          <Field id="o-pre" label="Invoice number starts with"><Input id="o-pre" value={d.rctiPrefix} onChange={v => set('rctiPrefix', v)} disabled={!canEdit} /></Field>
          <Field id="o-days" label="RPs approve their invoice within (working days)"><Input id="o-days" type="number" value={d.rpApproveDays} onChange={v => set('rpApproveDays', v)} disabled={!canEdit || !d.rpApproves} /></Field>
        </div>
        <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={d.rpApproves} onChange={e => set('rpApproves', e.target.checked)} /> RPs approve the invoice GSP raises for them (recipient-created tax invoice) before they’re paid</label>
        <h3 className="gspx-h4">Payment batches</h3>
        <Table head={['Batch name', 'Bank accounts', '']}>
          {d.batches.map((b, i) => (
            <tr key={b.id} className="irow">
              <td><Input id={`b-${i}`} aria-label="Batch name" value={b.name} onChange={v => row('batches', i, { name: v })} disabled={!canEdit} /></td>
              <td><Select id={`bb-${i}`} label="Bank accounts" hideLabel value={b.bank} onChange={v => row('batches', i, { bank: v })} options={[['AU', 'Australian accounts'], ['Local', 'Local accounts']]} /></td>
              <td>{canEdit && d.batches.length > 1 && <LinkButton onClick={() => set('batches', d.batches.filter((_, j) => j !== i))}>Remove</LinkButton>}</td>
            </tr>))}
        </Table>
        <p className="muted">Each RP’s account type is on its RP terms. A batch holds every RP with that account type.</p>
      </Card>

      <Card>
        <h2 className="gspx-h3">Approvals</h2>
        <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={d.makerChecker.terms} onChange={e => set('makerChecker', { ...d.makerChecker, terms: e.target.checked })} /> A second person checks changes to universities, RP terms, schemes and notices</label>
        <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={d.makerChecker.settings} onChange={e => set('makerChecker', { ...d.makerChecker, settings: e.target.checked })} /> A second person checks changes to defaults, FX and this page</label>
        <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={d.makerChecker.run} onChange={e => set('makerChecker', { ...d.makerChecker, run: e.target.checked })} /> The person who prepares a payout run can’t approve it</label>
        <div className="gspx-form2">
          <Field id="o-adm" label="Runs above this also need an Admin (AUD)" hint="Leave blank for no limit"><Input id="o-adm" type="number" value={d.adminAbove ?? ''} onChange={v => set('adminAbove', v === '' ? null : v)} disabled={!canEdit} /></Field>
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
              <td><Select id={`ex-${i}`} label="Goes to" hideLabel value={x.to} onChange={v => row('exceptions', i, { to: v })} options={queues} /></td>
              <td><input className="gspx-num" type="number" aria-label={`${x.type} SLA`} disabled={!canEdit} value={x.sla} onChange={e => row('exceptions', i, { sla: Number(e.target.value) })} /></td>
            </tr>))}
        </Table>
      </Card>

      <Card flush>
        <div className="stools"><div className="stools__row"><div className="gspx-grow"><h2 className="gspx-h3">Recurring jobs</h2><p className="muted">These make Finance home’s list for each day.</p></div>
          {canEdit && <Button onClick={() => set('jobs', [...d.jobs, { id: 'j-' + Date.now().toString(36), name: 'New job', freq: 'weekly', day: 1, who: '', page: 'gspx-fin-home', metric: '' }])}>Add job</Button>}</div></div>
        <Table head={['Job', 'How often', 'Day', 'Who', 'Opens', 'Shows', '']} empty={!d.jobs.length && <Empty title="No jobs" />}>
          {d.jobs.map((j, i) => (
            <tr key={j.id} className="irow">
              <td><Input id={`j-${i}`} aria-label="Job" value={j.name} onChange={v => row('jobs', i, { name: v })} disabled={!canEdit} /></td>
              <td><Select id={`jf-${i}`} label="How often" hideLabel value={j.freq} onChange={v => row('jobs', i, { freq: v })} options={FREQ} /></td>
              <td>{j.freq === 'weekly' ? <Select id={`jd-${i}`} label="Day" hideLabel value={String(j.day)} onChange={v => row('jobs', i, { day: Number(v) })} options={[1, 2, 3, 4, 5].map(n => [String(n), DAYS[n]])} />
                : j.freq === 'monthly' ? <input className="gspx-num" type="number" min="1" max="28" aria-label="Day of month" disabled={!canEdit} value={j.day} onChange={e => row('jobs', i, { day: Number(e.target.value) })} /> : <span className="muted">—</span>}</td>
              <td><Select id={`jw-${i}`} label="Who" hideLabel value={j.who} onChange={v => row('jobs', i, { who: v })} options={[['', 'Anyone in Finance'], ...finance.map(u => [u.id, u.name])]} /></td>
              <td><Select id={`jp-${i}`} label="Opens" hideLabel value={j.page} onChange={v => row('jobs', i, { page: v })} options={PAGES} /></td>
              <td><Select id={`jm-${i}`} label="Shows" hideLabel value={j.metric} onChange={v => row('jobs', i, { metric: v })} options={METRICS} /></td>
              <td>{canEdit && <LinkButton onClick={() => set('jobs', d.jobs.filter((_, k) => k !== i))}>Remove</LinkButton>}</td>
            </tr>))}
        </Table>
      </Card>

      <h2 className="gspx-h3">Defaults and FX</h2>
      <Settings c={c} canEdit={canEdit} propose={propose} />
    </Page>
  );
}
