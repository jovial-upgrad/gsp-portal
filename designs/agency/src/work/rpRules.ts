// @ts-nocheck -- typed with the work API.
/**
 * The RP rules' automatic work (slice 4 PRD; Jovial, 2 Nov): tasks worked out from the recruitment partners' own
 * records, the same way the application rules work from applications (work/engine.ts). A task exists while its
 * condition holds and closes itself when the record moves on; nothing is stored for it but what the store keeps
 * for every task (its assignee, its SLA hours).
 *
 * - RPA "Check <RP>'s signed agreement": a signed copy waiting for RP Ops (one task per copy uploaded).
 * - T58 "Train <RP> on the portal": the RP's first agreement accepted, training not marked done.
 *
 * The rules are data (Admin › Work › Task rules: on/off, SLA, queue, sharing); only the condition is code here.
 */
import { openAgreement, signedOf } from '../institution/data/agreements';
import { regionOfCountry } from '../data/regions';
import { recruitmentQueueId } from './seed';
import { ruleLive, timeHours } from './engine';

export const RP_LOGIC = {
  RPA: (r) => {
    const v = openAgreement(r);
    const c = v && v.status === 'Signed copy uploaded' ? signedOf(v) : null;
    return c ? { key: `${v.id}-${c.at}`, since: c.at } : null;
  },
  T58: (r) => (r.approved && r.status === 'Agreement signed' && !r.trained ? { key: 'first', since: r.approved.at } : null),
};

/** The RP as My work shows it (a task's record). */
export const rpRecord = (r) => ({ id: r.id, type: 'RP', label: r.name, region: regionOfCountry(r.country), agency: r.name, page: 'rps' });

/** The tasks the RP rules make right now. */
export function rpTasks(s, rps, now) {
  const out = [];
  for (const rp of rps) {
    for (const [row, when] of Object.entries(RP_LOGIC)) {
      const r = s.rules.find((x) => x.row === row);
      const hit = r && when(rp);
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
