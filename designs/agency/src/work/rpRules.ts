// @ts-nocheck -- typed with the work API.
/**
 * The RP rules' automatic work (slice 4 PRD; Jovial, 2 Nov): tasks worked out from the recruitment partners' own
 * records, the same way the application rules work from applications (work/engine.ts). A task exists while its
 * condition holds and closes itself when the record moves on; nothing is stored for it but what the store keeps
 * for every task (its assignee, its SLA hours).
 *
 * - RPA "Check <RP>'s signed agreement": a signed copy waiting for RP Ops (one task per copy uploaded).
 * - T58 "Train <RP> on the portal": the RP's first agreement accepted, training not marked done.
 * - T69 "Chase <RP> for its signed agreement" (L-5): an agreement Sent and no signed copy uploaded, after the rule's
 *   wait (10 working days on the RP's region's calendar). Its two RP reminders (3 and 7 working days: `remind`,
 *   `remind2`) reach the RP Admins' bell and email E22 (agreementReminders below).
 * - T70 "Activate <university>" (S2C-19): an institution partner reopened by hand from Closed; one task per
 *   university under it that isn't Live, closing when it is (ipTasks below).
 *
 * The rules are data (Admin › Work › Task rules: on/off, SLA, queue, sharing); only the condition is code here.
 */
import { openAgreement, signedOf } from '../institution/data/agreements';
import { regionOfCountry } from '../data/regions';
import { recruitmentQueueId } from './seed';
import { ruleLive, timeHours, afterFrom } from './engine';
import { calendarOf } from './calendars';
import { isClosed } from '../institution/data/records';
import { NATIONALITY } from '../admin/data/config';

/** When an agreement was sent, for the one Sent and still not signed (T69), else null. */
const unsignedSince = (r) => {
  const v = openAgreement(r);
  return v && v.status === 'Sent' && v.sentAt ? v : null;
};

export const RP_LOGIC = {
  RPA: (r) => {
    const v = openAgreement(r);
    const c = v && v.status === 'Signed copy uploaded' ? signedOf(v) : null;
    return c ? { key: `${v.id}-${c.at}`, since: c.at } : null;
  },
  T58: (r) => (r.approved && r.status === 'Agreement signed' && !r.trained ? { key: 'first', since: r.approved.at } : null),
  T69: (r, rule) => {
    const v = unsignedSince(r);
    return v ? { key: v.id, since: afterFrom(calendarOf(regionOfCountry(r.country)), v.sentAt, rule.after) } : null;
  },
};

/**
 * T69's reminders to the RP (L-5): one at each of the rule's RP reminder times (`remind`, then `remind2`) after the
 * agreement was sent, in working days on the RP's region's calendar, once that time has come and while the
 * agreement is still Sent. The RP Admins get each in the bell and as email E22. Rule off or no time set: none.
 */
export function agreementReminders(r, rules, now = Date.now()) {
  const rule = (rules || []).find((x) => x.row === 'T69');
  const v = unsignedSince(r);
  if (!rule || !v || !ruleLive(rule, v.sentAt)) return [];
  const cal = calendarOf(regionOfCountry(r.country));
  return [rule.remind, rule.remind2]
    .filter((t) => t && Number(t.n) > 0)
    .map((t, i) => ({ id: `agr-${v.id}-remind-${i + 1}`, n: i + 1, at: afterFrom(cal, v.sentAt, t), version: v.version, after: t }))
    .filter((x) => x.at <= now);
}

/** The RP as My work shows it (a task's record). */
export const rpRecord = (r) => ({ id: r.id, type: 'RP', label: r.name, region: regionOfCountry(r.country), agency: r.name, page: 'rps' });

/** The tasks the RP rules make right now. */
export function rpTasks(s, rps, now) {
  const out = [];
  for (const rp of rps) {
    for (const [row, when] of Object.entries(RP_LOGIC)) {
      const r = s.rules.find((x) => x.row === row);
      const hit = r && when(rp, r);
      if (!hit || !ruleLive(r, hit.since) || now < hit.since) continue;
      const id = `R-${rp.id}-${row}-${hit.key}`;
      if (s.closed?.[id]) continue;
      const region = regionOfCountry(rp.country);
      const queue = r.queue === 'recruitment' ? recruitmentQueueId(region, s.queues) : r.queue;
      out.push({
        id, rule: row, row, kind: r.kind, record: rp.id, queue, assignee: null, share: r.share && r.share !== 'officer' ? r.share : null, created: hit.since, status: 'open', auto: true,
        title: r.task.replace('<RP>', rp.name), slaHours: s.frozen?.[id] ?? timeHours(r.sla), closes: r.closes,
      });
    }
  }
  return out;
}

/** A university as My work shows it (T70's record). */
export const uniRecord = (u, p) => ({ id: u.id, type: 'University', label: u.name, region: 'Global', page: 'universities', partner: p?.name });

/** The tasks T70 makes right now: each university not Live under a partner reopened from Closed (S2C-19). */
export function ipTasks(s, ips, unis, now) {
  const out = [];
  const r = s.rules.find((x) => x.row === 'T70');
  if (!r) return out;
  for (const p of ips || []) {
    if (!p.reopenedAt || isClosed(p.status) || !ruleLive(r, p.reopenedAt) || now < p.reopenedAt) continue;
    for (const u of (unis || []).filter((x) => x.ip === p.id && x.status !== 'Live')) {
      const id = `R-${u.id}-T70-${p.reopenedAt}`;
      if (s.closed?.[id]) continue;
      out.push({
        id, rule: 'T70', row: 'T70', kind: r.kind, record: u.id, queue: r.queue, assignee: null, share: r.share && r.share !== 'officer' ? r.share : null, created: p.reopenedAt, status: 'open', auto: true,
        title: r.task.replace('<university>', u.name).replace('<partner>', p.name), slaHours: s.frozen?.[id] ?? timeHours(r.sla), closes: r.closes,
      });
    }
  }
  return out;
}

/**
 * T62 (S1C-13): a student's nationality that isn't in Admin's nationality map gives the Admin queue a task to map it,
 * one per nationality, closing itself once it's mapped. Worked out from the students, like every other task.
 */
export function nationalityTasks(s, students, now) {
  const r = s.rules.find((x) => x.row === 'T62');
  if (!r || !ruleLive(r, now)) return [];
  const missing = [...new Set((students || []).map((x) => x.nationality).filter((n) => n && !(n in NATIONALITY)))];
  return missing.map((n) => {
    const id = `R-nat-${n}-T62`;
    if (s.closed?.[id]) return null;
    const since = Math.min(...students.filter((x) => x.nationality === n).map((x) => x.added ?? now));
    return { id, rule: 'T62', row: 'T62', kind: r.kind, record: 'set-nationality', queue: r.queue, assignee: null, share: r.share && r.share !== 'officer' ? r.share : null, created: Number.isFinite(since) ? since : now, status: 'open', auto: true, title: r.task.replace('<nationality>', n), slaHours: s.frozen?.[id] ?? timeHours(r.sla), closes: r.closes };
  }).filter(Boolean);
}
