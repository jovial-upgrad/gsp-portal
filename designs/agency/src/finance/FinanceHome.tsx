// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Finance home: the GSP · Finance role's first page.
 * Today's jobs (from the recurring jobs list on Finance setup) with live counts,
 * what's waiting on this person, and the week ahead.
 */
import { adminCfg } from '../admin/data/store';
import { istParts } from '../data/dates';
import React, { useContext } from 'react';
import { update, nameOf } from './store';
import { Page, Card, Tiles, Table, Pill, Button, LinkButton, Empty, toast } from './kit';
import { PersonaBar, usePersona, HostContext } from './persona';
import { nice, addDays } from './engine';
import { useComm, liveRun, opsOf, jobDue, DAYS, aud, sum, nav, cycleOf } from './shared';

export default function FinanceHome() {
  const { s, c, cfg, res } = useComm();
  const { user } = usePersona();
  const { openPage } = useContext(HostContext);
  const ops = opsOf(cfg);
  const run = liveRun(c, res);
  const today = c.today;
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();

  /* Live numbers behind each job */
  const fxWeek = [...cfg.settings.fx].sort((a, b) => a.week < b.week ? -1 : 1).filter(w => w.week <= today).pop();
  const fxMissing = fxWeek ? [...new Set([...cfg.unis.map(u => u.cur), ...cfg.rps.map(r => r.cur)].filter(Boolean))].filter(k => k !== 'AUD').filter(k => fxWeek[k] == null || fxWeek[k] === '') : ['all'];
  const ready = res.ip.filter(x => x.l.st[0] === 'Ready to invoice');
  const overdue = res.ip.filter(x => /overdue|Invoiced/.test(x.l.st[0]));
  const mail = s.mail.emails.filter(e => e.mailbox === 'mb-comm' && e.state === 'new');
  const ann = res.ip.filter(x => x.l.annuity && /Ready to invoice|Not yet due/.test(x.l.st[0]) && x.l.date <= addDays(today, opsOf(cfg).lookAhead.annuity));
  const ending = cfg.unis.filter(u => u.ends && u.ends >= today && u.ends <= addDays(today, opsOf(cfg).lookAhead.contracts)).length + cfg.notices.filter(n => n.end && n.end >= today && n.end <= addDays(today, opsOf(cfg).lookAhead.notices)).length;
  const inv = Object.values(c.rpInv || {});
  const toCheck = inv.filter(i => i.status === 'review').length, toPay = inv.filter(i => i.status === 'approved').length;
  const runText = `${toCheck} RP invoices to check, ${toPay} approved to pay by ${nice(cycleOf(cfg, today).payBy)}`;
  const M = {
    fx: [fxMissing.length, fxMissing.length ? `Missing: ${fxMissing.join(', ')}` : 'All rates in'],
    run: [toCheck + toPay, runText],
    invoices: [ready.length, `${ready.length} ready, ${aud(sum(ready, x => x.l.aud))}`],
    overdue: [overdue.length, `${overdue.length} waiting for payment, ${res.ip.filter(x => x.l.st[0] === 'Payment overdue').length} overdue`],
    exceptions: [res.exc.length, `${res.exc.length} open`],
    mail: [mail.length, `${mail.length} to confirm`],
    annuity: [ann.length, `${ann.length} periods due in the next month`],
    ending: [ending, `${ending} contracts or notices ending soon`],
    '': [null, ''],
  };
  const doneKey = j => `${today}|${j.id}`;
  const done = c.jobsDone || {};
  const mine = j => !j.who || j.who === user.id;
  const todays = ops.jobs.filter(j => jobDue(cfg, j, today));
  const week = [];
  for (let i = 1; i <= 7; i++) { const d = addDays(today, i); ops.jobs.filter(j => j.freq !== 'daily' && jobDue(cfg, j, d)).forEach(j => week.push([d, j])); }
  const myTasks = s.tasks.filter(t => t.status === 'open' && t.queue === 'q-finance' && (!t.assignee || t.assignee === user.id));
  const hour = istParts(Date.now()).h;
  const go = (page, f) => { nav.filter = f || null; openPage && openPage(page); };

  const tiles = [
    { id: 'run', n: toCheck, label: 'RP invoices to check', sub: `${toPay} approved, to pay by ${nice(cycleOf(cfg, today).payBy)}`, tone: 'you' },
    { id: 'exc', n: res.exc.length, label: 'Exceptions', sub: 'Stop a line being priced or paid', tone: 'bad' },
    { id: 'od', n: res.ip.filter(x => x.l.st[0] === 'Payment overdue').length, label: 'University payments overdue', sub: aud(sum(res.ip.filter(x => x.l.st[0] === 'Payment overdue'), x => x.l.dueAud)), tone: 'bad' },
  ];
  const tilePage = { run: 'gspx-fin-lines', exc: 'gspx-fin-lines', od: 'gspx-fin-lines' };

  return (
    <Page title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${user.name}`} top={<PersonaBar />}
      lead={`Finance · ${DAYS[dow]} ${nice(today)}. Your jobs for today come from the recurring jobs on Finance setup.`}
      actions={<Button onClick={() => go('gspx-fin-lines')}>Commission lines</Button>}>
      <Tiles items={tiles} value={null} onChange={v => v && go(tilePage[v], v === 'od' ? 'Payment overdue' : null)} />
      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Today</h2></div>
        <Table head={['Job', 'Who', 'Now', '']} empty={!todays.length && <Empty title="No jobs today">Weekends have none. Add or move jobs on Finance setup.</Empty>}>
          {todays.map(j => { const [n, txt] = M[j.metric] || M['']; const isDone = done[doneKey(j)]; return (
            <tr key={j.id} className={'irow' + (isDone ? ' gspx-off' : '')}>
              <td className="cfg__strong">{j.name}<span className="irow__sub">{j.freq === 'daily' ? 'Every working day' : j.freq === 'payday' ? `Every ${DAYS[ops.payDay]}` : j.freq === 'weekly' ? `Every ${DAYS[j.day]}` : `Day ${j.day} of each month`}</span></td>
              <td>{j.who ? nameOf(s, j.who) : 'Anyone in Finance'}</td>
              <td>{n != null && n > 0 && !isDone ? <Pill tone="dpill--checking">{txt}</Pill> : <span className="muted">{isDone ? `Done by ${nameOf(s, isDone)}` : txt || '—'}</span>}</td>
              <td><div className="gspx-acts">
                <Button size="sm" onClick={() => go(j.page)}>Open</Button>
                {mine(j) && !isDone && <LinkButton onClick={() => update(d => { d.comm.jobsDone = { ...(d.comm.jobsDone || {}), [doneKey(j)]: user.id }; }, `${user.name} finished “${j.name}” for ${nice(today)}`) || toast('Marked done for today.')}>Mark done</LinkButton>}
              </div></td>
            </tr>); })}
        </Table>
      </Card>
      <div className="gspx-grid2">
        <Card>
          <h2 className="gspx-h3">Coming up this week</h2>
          {week.length ? <ul className="gspx-list">{week.map(([d, j]) => <li key={d + j.id}><span className="num">{DAYS[new Date(d + 'T00:00:00Z').getUTCDay()].slice(0, 3)} {nice(d).slice(0, -5)}</span> {j.name}{j.who ? ` · ${nameOf(s, j.who)}` : ''}</li>)}</ul> : <p className="muted">Nothing scheduled.</p>}
        </Card>
        <Card>
          <h2 className="gspx-h3">Your tasks in the Finance queue</h2>
          {myTasks.length ? <ul className="gspx-list">{myTasks.slice(0, 6).map(t => <li key={t.id}>{t.title || t.id}{t.maker === user.id ? <span className="muted"> · yours, someone else checks it</span> : null}</li>)}</ul> : <p className="muted">No open tasks.</p>}
        </Card>
      </div>
    </Page>
  );
}
