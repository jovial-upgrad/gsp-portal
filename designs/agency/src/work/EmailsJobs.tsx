// @ts-nocheck -- typed when the work API is designed.
/*
 * Admin › Work › Emails and daily jobs (slice 4 PRD, Emails and Daily jobs): every email the portal sends (21
 * templates, the rules they all follow, a preview), the emails sent as the work stands now, and the nine daily jobs
 * with when each runs next (IST). Read-only: templates are code, their wording is Jovial's to approve; who can turn
 * an email off is slice 1's Profile › Email preferences, which reads EMAIL_TEMPLATES.
 */
import React, { useMemo, useState } from 'react';
import { useStore, simulateJobFailure, simulateBounces, clearSimulations } from './store';
import { jobRuns, JOB_NAME, JOB_RULES_OF, JOB_SENDS } from './jobs';
import { Page, Card, Tabs, Table, Pill, LinkButton, Sheet, Notice } from '../finance/kit';
import { PersonaBar } from './persona';
import { EMAIL_TEMPLATES, EMAIL_RULES, EMAIL_FOOTER, EMAIL_PLACEHOLDERS, JOBS, JOB_RULES } from './mail';
import { now, istStamp, istYmd, istAt, istWeekday } from './clock';
import { calendarOf, isWorkingDay } from './calendars';
import { Pick } from './ui';
import { getDb } from '../institution/data/store';
import { agreementEmails, fill } from '../institution/data/agreements';
import { agreementReminders } from './rpRules';
import { emailLog } from './emailLog';

const DAY = 864e5;
/** The next time a job runs, IST. */
function nextRun(j, t = now()) {
  if (j.every.minutes) { const m = j.every.minutes * 60000; return Math.ceil((t + 1) / m) * m; }
  const at = (ymd, hm) => istAt(ymd, hm);
  for (let k = 0; k < 8; k++) {
    const day = istYmd(t + k * DAY);
    const wd = istWeekday(t + k * DAY);
    const slots = j.every.daily ? [j.every.daily] : (j.every.weekly || []).filter(([d]) => d === wd).map(([, hm]) => hm);
    for (const hm of slots) if (at(day, hm) > t) return at(day, hm);
  }
  return null;
}
/** The latest runs of every job, newest first: what each found, made and sent since the run before. */
function runLog(s, sent) {
  const t = now();
  const rows = [];
  for (const j of JOBS) {
    const runs = jobRuns(j.id, t, s.jobs, j.every.minutes ? 4 : 3);
    runs.forEach((r, i) => {
      const prev = runs[i + 1]?.at ?? r.at - (j.every.minutes ? j.every.minutes * 60000 : DAY);
      const rules = JOB_RULES_OF[j.id] || [];
      const changed = r.error ? 0 : s.tasks.filter((k) => rules.includes(k.rule) && k.created > prev && k.created <= r.at).length;
      const mails = r.error ? 0 : sent.filter((m) => (JOB_SENDS[j.id] || []).includes(m.tpl) && m.at > prev && m.at <= r.at).length;
      const checked = j.id === 'J4' ? s.tasks.filter((k) => k.status === 'open' && k.created <= r.at).length : rules.length ? s.records.length : s.records.filter((x) => x.type === (j.id === 'J7' || j.id === 'J2' ? 'RP' : 'Application')).length;
      rows.push({ ...r, checked, changed, sent: mails });
    });
  }
  return rows.sort((a, b) => b.at - a.at).slice(0, 40);
}

/**
 * Prototype only (testing aids, not the product): simulate the external events the Admin task rules wait for, a
 * daily job that fails (T65, and Admin Home's warning after 3 failed runs) and an address that bounces (T66).
 */
function SimBar({ s }) {
  const [job, setJob] = useState('J3');
  const [who, setWho] = useState('');
  const people = s.users.filter((u) => u.email && s.roles.some((r) => r.id === u.role && r.side === 'GSP'));
  return (
    <div className="gspx-persona" role="group" aria-label="Prototype: simulate">
      <span className="gspx-persona__k">Prototype: simulate</span>
      <Pick id="sim-job" label="Job" hideLabel value={job} onChange={setJob} options={JOBS.map((j) => [j.id, `${j.id} ${j.name}`])} />
      <LinkButton onClick={() => simulateJobFailure(job, 1)}>Fail its last run</LinkButton>
      <LinkButton onClick={() => simulateJobFailure(job, 3)}>Fail its last 3 runs</LinkButton>
      <Pick id="sim-who" label="Person" hideLabel value={who} placeholder="Pick a person" onChange={setWho} options={people.map((u) => [u.id, u.name])} />
      <LinkButton disabled={!who} onClick={() => who && simulateBounces(who)}>Their emails bounce</LinkButton>
      {(Object.keys(s.jobs?.fail || {}).length > 0 || Object.keys(s.bounces || {}).length > 0) && <LinkButton onClick={clearSimulations}>Clear</LinkButton>}
    </div>
  );
}

export default function EmailsJobs() {
  const s = useStore();
  const [tab, setTab] = useState('emails');
  const [show, setShow] = useState(null);
  const [tplF, setTplF] = useState('');
  const sent = useMemo(() => emailLog(s, now()), [s]);
  const list = tplF ? sent.filter((x) => x.tpl === tplF) : sent;
  return (
    <Page cfg title="Emails and daily jobs" top={<PersonaBar />}
      lead="Every email the portal sends, all from templates the system fills in, and the scheduled jobs that run without a person. All times are IST.">
      <Tabs label="Section" value={tab} onChange={setTab} options={[['emails', `Email templates (${EMAIL_TEMPLATES.length})`], ['sent', `Emails sent (${sent.length})`], ['jobs', `Daily jobs (${JOBS.length})`]]} />
      {tab === 'emails' && (
        <>
          <Card flush>
            <Table head={['Rule', 'Value']} className="cfg__tab">
              {EMAIL_RULES.map(([k, v]) => <tr key={k}><td className="cfg__strong">{k}</td><td>{v}</td></tr>)}
            </Table>
            <p className="gspx-pad muted">Placeholders: {EMAIL_PLACEHOLDERS}. Emails people write to universities and RPs from the shared mailboxes are Mail, not templates.</p>
          </Card>
          <Card flush>
            <Table head={['#', 'Template', 'Sent when', 'To', 'Subject', 'Can be turned off', '']} className="cfg__tab">
              {EMAIL_TEMPLATES.map((e) => (
                <tr key={e.id}>
                  <td className="cfg__strong">{e.id}<span className="cfg__sub">{e.group} · slice {e.slice}</span></td>
                  <td>{e.name}</td><td>{e.when}</td><td>{e.to}</td><td>{e.subject}</td>
                  <td>{e.canTurnOff ? 'Yes, in Profile › Email preferences' : <Pill tone="dpill--checking">No: sign-in needs it</Pill>}</td>
                  <td className="cfg__acts"><LinkButton aria-label={`Preview ${e.id}`} onClick={() => setShow(e)}>Preview</LinkButton></td>
                </tr>
              ))}
            </Table>
            <p className="gspx-pad muted">No other email is sent for a task: creation, due soon, breach and level 2 are bell only, and the morning email gathers them. The RP gets E15 to E18 by email as well as the bell (S4-17).</p>
          </Card>
        </>
      )}
      {tab === 'sent' && (
        <Card flush>
          <div className="stools"><div className="stools__row">
            <Pick id="es-tpl" label="Template" hideLabel value={tplF} onChange={setTplF} options={[['', 'Every template'], ...EMAIL_TEMPLATES.filter((e) => sent.some((x) => x.tpl === e.id)).map((e) => [e.id, `${e.id} ${e.name}`])]} />
          </div><p className="stools__count" role="status"><span className="num">{list.length}</span> emails, newest first</p></div>
          <Notice>The prototype sends no email. This is the log the build keeps (template, to, record, time, SES message ID, delivered or bounced), worked out from the work as it is now.</Notice>
          <Table head={['When (IST)', 'Template', 'To', 'Record', 'Subject', 'SES message ID', 'Result']} className="cfg__tab">
            {list.slice(0, 80).map((x) => (
              <tr key={x.id + x.at}>
                <td className="num">{istStamp(x.at)}</td><td>{x.tpl} {x.name}</td><td>{x.to}</td><td>{x.record || '—'}</td><td>{x.subject}</td><td className="num">{x.id}</td><td><Pill tone={x.result === "Bounced" ? "dpill--bad" : "dpill--verified"}>{x.result}</Pill></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {tab === 'jobs' && (
        <>
          <Notice>The daily jobs run at 01:00 IST and “today” means today’s date in IST (S4-9, S4-27). Jobs that reach a person (the morning email, the RP’s daily update) run every 30 minutes and pick the people whose send time, in IST, has just been reached. In the prototype they run on its clock (My work › Prototype clock moves it on): each run below is worked out from the work as it was then.</Notice>
          <Card flush>
            <Table head={['#', 'Job', 'Runs (IST)', 'What it checks', 'What it changes', 'Writes', 'Last run', 'Next run']} className="cfg__tab">
              {JOBS.map((j) => {
                const last = jobRuns(j.id, now(), s.jobs, 1)[0];
                return (
                  <tr key={j.id}>
                    <td className="cfg__strong">{j.id}<span className="cfg__sub">Slice {j.slice}</span></td>
                    <td>{j.name}</td><td>{j.runs}</td><td>{j.checks}</td><td>{j.changes}</td><td>{j.writes}</td>
                    <td className="num">{last ? <>{istStamp(last.at)}<span className="cfg__sub">{last.error ? <Pill tone="dpill--bad">Failed</Pill> : <Pill tone="dpill--verified">Done</Pill>}</span></> : '—'}</td>
                    <td className="num">{nextRun(j) ? istStamp(nextRun(j)) : '—'}</td>
                  </tr>
                );
              })}
            </Table>
          </Card>
          <Card flush>
            <div className="gspx-pad"><h2 className="gspx-h3">Runs (the log line each run writes)</h2></div>
            <Table head={['Job', 'Start (IST)', 'End (IST)', 'Records checked', 'Records changed', 'Emails sent', 'Result']} className="cfg__tab">
              {runLog(s, sent).map((r) => (
                <tr key={r.job + r.at}>
                  <td className="cfg__strong">{r.job} {JOB_NAME[r.job]}</td><td className="num">{istStamp(r.at)}</td><td className="num">{istStamp(r.end)}</td>
                  <td className="num">{r.checked}</td><td className="num">{r.changed}</td><td className="num">{r.sent}</td>
                  <td>{r.error ? <><Pill tone="dpill--bad">Failed</Pill><span className="cfg__sub">{r.error}</span></> : <Pill tone="dpill--verified">Done</Pill>}</td>
                </tr>
              ))}
            </Table>
          </Card>
          <SimBar s={s} />
          <Card flush>
            <Table head={['Rule for every job', '']} className="cfg__tab">
              {JOB_RULES.map(([k, v]) => <tr key={k}><td className="cfg__strong">{k}</td><td>{v}</td></tr>)}
            </Table>
          </Card>
        </>
      )}
      {show && (
        <Sheet title={`${show.id} · ${show.name}`} sub={`To: ${show.to}`} onClose={() => setShow(null)}>
          <div className="gspx-mailprev">
            <p className="muted">From “upGrad GSP” no-reply@gsp.upgrad.com · no Reply-to</p>
            <p className="cfg__strong">{show.subject}</p>
            <p><b>upGrad GSP</b></p>
            <p>{show.body}</p>
            <p><span className="dpill">Open in the portal: {'{link}'}</span></p>
            <p className="muted">{EMAIL_FOOTER}</p>
            {show.canTurnOff && <p className="muted">You’re getting this because you use the upGrad GSP portal. Email preferences</p>}
          </div>
        </Sheet>
      )}
    </Page>
  );
}
