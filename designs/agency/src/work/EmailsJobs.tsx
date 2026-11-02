// @ts-nocheck -- typed when the work API is designed.
/*
 * Admin › Work › Emails and daily jobs (slice 4 PRD, Emails and Daily jobs): every email the portal sends (21
 * templates, the rules they all follow, a preview), the emails sent as the work stands now, and the nine daily jobs
 * with when each runs next (IST). Read-only: templates are code, their wording is Jovial's to approve; who can turn
 * an email off is slice 1's Profile › Email preferences, which reads EMAIL_TEMPLATES.
 */
import React, { useMemo, useState } from 'react';
import { useStore, recordById, nameOf, slaOf } from './store';
import { Page, Card, Tabs, Table, Pill, LinkButton, Sheet, Notice } from '../finance/kit';
import { PersonaBar } from './persona';
import { EMAIL_TEMPLATES, EMAIL_RULES, EMAIL_FOOTER, EMAIL_PLACEHOLDERS, JOBS, JOB_RULES } from './mail';
import { now, istStamp, istYmd, istAt, istWeekday } from './clock';
import { calendarOf, isWorkingDay } from './calendars';
import { Pick } from './ui';
import { getDb } from '../institution/data/store';
import { agreementEmails, fill } from '../institution/data/agreements';

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
const sesId = (s) => '0100' + Math.abs([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(16).padStart(8, '0') + '-ses';

/**
 * The emails the portal would have sent by now, from the work as it stands (the prototype sends none: this is what
 * the build's email log shows). E15 per open request, E17 at each RP reminder time, E18 each RP's daily update,
 * E19 each GSP person's morning email, E20 per renewal task (T38), E21 per level 3 escalation.
 */
function sentNow(s) {
  const t = now();
  const out = [];
  const tpl = (id) => EMAIL_TEMPLATES.find((x) => x.id === id);
  for (const r of s.records.filter((x) => x.type === 'Application' && !x.closed)) {
    for (const n of r.needs || []) if (n.at) out.push({ tpl: 'E15', to: `${r.agency} (counsellor, Branch Admin, RP Admins)`, record: r.id, at: n.at, subject: `GSP needs ${n.title} for ${r.student}` });
  }
  for (const k of s.tasks.filter((x) => x.status === 'open')) {
    const rec = recordById(s, k.record) || {};
    if (k.reminded) out.push({ tpl: 'E17', to: rec.agency || 'The RP', record: rec.id, at: k.reminded, subject: `Reminder: ${k.title.replace(/^Chase the RP: /, '')}` });
    if (k.rule === 'T38') out.push({ tpl: 'E20', to: nameOf(s, rec.owner || k.assignee), record: rec.id, at: k.created, subject: `The agreement with ${String(rec.label).split(' (')[0]} ends soon` });
    if (k.esc?.level === 3) for (const u of s.users.filter((x) => x.role === 'admin')) out.push({ tpl: 'E21', to: u.name, record: rec.id, at: slaOf(s, k).due + 5 * DAY, subject: `Late by 5 working days: ${k.title}` });
  }
  // E8, E9, E10: each RP agreement step, from the RPs' agreement versions (data/agreements.ts)
  for (const rp of getDb().rps) for (const m of agreementEmails(rp)) out.push({ tpl: m.tpl, to: `${rp.name} (business email, RP Admins)`, record: rp.id, at: m.at, subject: fill(tpl(m.tpl)?.subject ?? '', m.values) });
  // E18: each agency's daily update at 09:00 IST, when something happened in the 24 hours before
  const today9 = istAt(istYmd(t), '09:00');
  const last9 = t >= today9 ? today9 : today9 - DAY;
  const byRp = new Map();
  for (const r of s.records.filter((x) => x.type === 'Application' && x.since > last9 - DAY && x.since <= last9)) byRp.set(r.agency, (byRp.get(r.agency) || 0) + 1);
  for (const [rp, n] of byRp) out.push({ tpl: 'E18', to: rp, record: null, at: last9, subject: `${n} update${n === 1 ? '' : 's'} on your applications` });
  // E19: 08:30 IST on their working days, to each GSP person with something due today, tomorrow or late
  const cal = calendarOf('Global');
  const digest = s.escalation?.digestTime || '08:30';
  let day = t; for (let k = 0; k < 7 && (!isWorkingDay(cal, day) || istAt(istYmd(day), digest) > t); k++) day -= DAY;
  const sendAt = istAt(istYmd(day), digest);
  const per = new Map();
  for (const k of s.tasks.filter((x) => x.status === 'open' && x.created <= sendAt)) {
    const st = slaOf(s, k);
    const late = st.due < sendAt, soon = st.due - sendAt < 2 * DAY;
    if (!late && !soon) continue;
    const p = per.get(k.assignee) || { due: 0, late: 0 };
    if (late) p.late += 1; else p.due += 1;
    per.set(k.assignee, p);
  }
  for (const [id, p] of per) out.push({ tpl: 'E19', to: nameOf(s, id), record: null, at: sendAt, subject: `Your work today: ${p.due} due, ${p.late} late` });
  return out.filter((x) => x.at <= t).sort((a, b) => b.at - a.at).map((x) => ({ ...x, name: tpl(x.tpl)?.name, id: sesId(`${x.tpl}${x.to}${x.at}${x.record}`) }));
}

export default function EmailsJobs() {
  const s = useStore();
  const [tab, setTab] = useState('emails');
  const [show, setShow] = useState(null);
  const [tplF, setTplF] = useState('');
  const sent = useMemo(() => sentNow(s), [s]);
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
                <td className="num">{istStamp(x.at)}</td><td>{x.tpl} {x.name}</td><td>{x.to}</td><td>{x.record || '—'}</td><td>{x.subject}</td><td className="num">{x.id}</td><td><Pill tone="dpill--verified">Delivered</Pill></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {tab === 'jobs' && (
        <>
          <Notice>The daily jobs run at 01:00 IST and “today” means today’s date in IST (S4-9, S4-27). Jobs that reach a person (the morning email, the RP’s daily update) run every 30 minutes and pick the people whose send time, in IST, has just been reached. The prototype has no jobs: it works every timer out again each minute while a page is open (and when the Prototype clock on My work moves on).</Notice>
          <Card flush>
            <Table head={['#', 'Job', 'Runs (IST)', 'What it checks', 'What it changes', 'Writes', 'Next run']} className="cfg__tab">
              {JOBS.map((j) => (
                <tr key={j.id}>
                  <td className="cfg__strong">{j.id}<span className="cfg__sub">Slice {j.slice}</span></td>
                  <td>{j.name}</td><td>{j.runs}</td><td>{j.checks}</td><td>{j.changes}</td><td>{j.writes}</td>
                  <td className="num">{nextRun(j) ? istStamp(nextRun(j)) : '—'}</td>
                </tr>
              ))}
            </Table>
          </Card>
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
