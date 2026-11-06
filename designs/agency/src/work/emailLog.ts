// @ts-nocheck -- typed when the work API is designed.
/**
 * The email log (slice 4 PRD, Emails; slice 1 NFR-8): every email the portal would have sent by now, worked out from
 * the work as it stands (the prototype sends none: this is the log the build keeps): template, to, record, time, SES
 * message id, delivered or bounced. Admin › Work › Emails and daily jobs shows it; task T66 counts its bounces.
 *
 * Bounces are a testing aid: the Prototype bar on Emails and daily jobs marks a person's address as bouncing from a
 * moment (s.bounces), as SES would report; every email to that address from then on is Bounced until it changes.
 */
import { recordById, nameOf, slaOf } from './store';
import { EMAIL_TEMPLATES } from './mail';
import { now, istYmd, istAt } from './clock';
import { calendarOf, isWorkingDay } from './calendars';
import { getDb } from '../institution/data/store';
import { agreementEmails, fill } from '../institution/data/agreements';
import { agreementReminders } from './rpRules';
import { JOBS_FROM } from './jobs';

const DAY = 864e5;
const sesId = (s) => '0100' + Math.abs([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(16).padStart(8, '0') + '-ses';

/**
 * The emails the portal would have sent by now, from the work as it stands (the prototype sends none: this is what
 * the build's email log shows). E15 per open request, E17 at each RP reminder time, E18 each RP's daily update,
 * E19 each GSP person's morning email, E20 per renewal task (T38), E21 per level 3 escalation.
 */
export function emailLog(s, t = now()) {
  const out = [];
  const tpl = (id) => EMAIL_TEMPLATES.find((x) => x.id === id);
  for (const r of s.records.filter((x) => x.type === 'Application' && !x.closed)) {
    // E23 (4 Nov): each upload the RP made against a GSP request, to the application's officer
    for (const u of r.uploads || []) if (r.officer) out.push({ tpl: 'E23', to: nameOf(s, r.officer), toId: r.officer, record: r.id, at: u.at, subject: fill(tpl('E23')?.subject ?? '', { RP: r.agency, document: u.name, student: r.student }) });
    for (const n of r.needs || []) if (n.at) out.push({ tpl: 'E15', to: `${r.agency} (counsellor, Branch Manager, RP Admins)`, record: r.id, at: n.at, subject: `GSP needs ${n.title} for ${r.student}` });
  }
  for (const k of s.tasks.filter((x) => x.status === 'open')) {
    const rec = recordById(s, k.record) || {};
    if (k.reminded) out.push({ tpl: 'E17', to: rec.agency || 'The RP', record: rec.id, at: k.reminded, subject: `Reminder: ${k.title.replace(/^Chase the RP: /, '')}` });
    if (k.rule === 'T38') out.push({ tpl: 'E20', to: nameOf(s, rec.owner || k.assignee), toId: rec.owner || k.assignee, record: rec.id, at: k.created, subject: `The agreement with ${String(rec.label).split(' (')[0]} ends soon` });
    if (k.esc?.level === 3) for (const u of s.users.filter((x) => x.role === 'admin')) out.push({ tpl: 'E21', to: u.name, toId: u.id, record: rec.id, at: slaOf(s, k).due + 5 * DAY, subject: `Late by 5 working days: ${k.title}` });
  }
  // E8, E9, E10: each RP agreement step, from the RPs' agreement versions (data/agreements.ts)
  for (const rp of getDb().rps) for (const m of agreementEmails(rp)) out.push({ tpl: m.tpl, to: `${rp.name} (business email, RP Admins)`, record: rp.id, at: m.at, subject: fill(tpl(m.tpl)?.subject ?? '', m.values) });
  // E22: T69's agreement reminders (L-5), at the rule's RP reminder times
  for (const rp of getDb().rps) for (const m of agreementReminders(rp, s.rules, t)) out.push({ tpl: 'E22', to: `${rp.name} (RP Admins)`, record: rp.id, at: m.at, subject: fill(tpl('E22')?.subject ?? '', { agency: rp.name, version: m.version }) });
  // E18: each agency's daily update at 09:00 IST, when something happened in the 24 hours before
  const today9 = istAt(istYmd(t), '09:00');
  const last9 = t >= today9 ? today9 : today9 - DAY;
  const byRp = new Map();
  for (const r of s.records.filter((x) => x.type === 'Application' && x.since > last9 - DAY && x.since <= last9)) byRp.set(r.agency, (byRp.get(r.agency) || 0) + 1);
  for (const [rp, n] of byRp) out.push({ tpl: 'E18', to: rp, record: null, at: last9, subject: `${n} update${n === 1 ? '' : 's'} on your applications` });
  // E19: 08:30 IST on their working days, to each GSP person with something due today, tomorrow or late
  const cal = calendarOf('Global');
  const digest = s.escalation?.digestTime || '08:30';
  // each working day's morning email since the jobs started (J6), up to the last 7, from the work open then
  for (let k = 0; k < 8; k++) {
    const day = t - k * DAY;
    const sendAt = istAt(istYmd(day), digest);
    if (sendAt > t || sendAt < JOBS_FROM || !isWorkingDay(cal, day)) continue;
    const per = new Map();
    for (const x of s.tasks.filter((y) => y.status === 'open' && y.created <= sendAt)) {
      const st = slaOf(s, x);
      const late = st.due < sendAt, soon = st.due - sendAt < 2 * DAY;
      if (!late && !soon) continue;
      const p = per.get(x.assignee) || { due: 0, late: 0 };
      if (late) p.late += 1; else p.due += 1;
      per.set(x.assignee, p);
    }
    for (const [id, p] of per) out.push({ tpl: 'E19', to: nameOf(s, id), toId: id, record: null, at: sendAt, subject: `Your work today: ${p.due} due, ${p.late} late` });
  }
  const bounced = (x) => {
    const b = x.toId && (s.bounces || {})[x.toId];
    const u = b && s.users.find((y) => y.id === x.toId);
    return !!b && x.at >= b.from && (!u || u.email === b.email);
  };
  return out.filter((x) => x.at <= t).sort((a, b) => b.at - a.at).map((x) => ({ ...x, name: tpl(x.tpl)?.name, id: sesId(`${x.tpl}${x.to}${x.at}${x.record}`), result: bounced(x) ? 'Bounced' : 'Delivered' }));
}

