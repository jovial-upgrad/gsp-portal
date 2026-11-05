// @ts-nocheck -- typed when the mail API is designed.
/**
 * Where a mail to gsp.admissions@ goes and what happens to it, worked out from its mail type (Mail › How mail is
 * handled, the 23 Admissions mail types) and the application it's linked to. One function, so the conversation, the
 * list, Filed and the "How mail is handled" table all say the same thing.
 */
import { regionQueueId } from './seed';
import { recordById, queueById, nameOf } from './store';

export const typeOf = (M, id) => (M.types || []).find((t) => t.id === id) || (id === 'box' ? M.boxType : null);

/** The forward target of a forwarded mail: the first `forward` whose words appear in the subject, else the catch-all. */
export function forwardOf(M, type, text) {
  const low = String(text || '').toLowerCase();
  const hit = (type.forward || []).find((f) => !f.when || (M.forwardWords?.[f.when] || []).some((w) => low.includes(w)));
  if (!hit) return null;
  const box = M.mailboxes.find((b) => b.id === hit.to);
  if (box) return { name: `${box.name} inbox`, address: box.addresses[0] };
  const t = (M.forwardTargets || []).find((x) => x.id === hit.to);
  return t ? { name: t.name, address: t.address } : null;
}

/**
 * route(s, item, typeId) → { queue, owner, where, outcome }
 *   where: what the "Goes to" line says; outcome: what the system did (auto types) or will do once confirmed.
 */
export function route(s, item, typeId) {
  const M = s.mail;
  const type = typeOf(M, typeId ?? item.intent ?? item.type);
  if (!type) return { where: 'Not typed yet', outcome: '' };
  const rec = item.record ? recordById(s, item.record) : null;
  const global = queueById(s, 'q-adm-global');
  const box = M.mailboxes.find((b) => b.id === (item.mailbox || 'mb-adm'));
  if (box && box.id !== 'mb-adm') {
    const q = queueById(s, box.queue);
    return { queue: q, owner: q?.leader, where: `${q?.name || box.name} (this mailbox’s queue)`, outcome: '' };
  }
  const regional = rec ? queueById(s, regionQueueId(rec.region)) : null;
  switch (type.act) {
    case 'stop': return { where: 'Nobody', outcome: 'GSP’s own notification: filed, and to be stopped at source.' };
    case 'file': return { where: 'Nobody', outcome: rec ? `Filed on ${rec.id}${item.ref ? `; university reference ${item.ref} saved` : ''}.` : 'Filed.' };
    case 'thread': return { where: 'Nobody', outcome: rec ? `Threaded on ${rec.id}.` : 'Filed on its thread.' };
    case 'private': return { where: item.forUser ? `${nameOf(s, item.forUser)} only` : 'The person who asked', outcome: `Shown only to ${item.forUser ? nameOf(s, item.forUser) : 'the person who asked'}, who asked for it. Not filed.` };
    case 'flag':
      return rec && item.sentBy
        ? { owner: item.sentBy, where: `${nameOf(s, item.sentBy)} (sent the mail)`, outcome: `${item.address || 'The address'} marked Bounced on the contact. ${nameOf(s, item.sentBy)}, who sent the mail, got one notice.` }
        : { queue: global, where: `${global?.name || 'Global Ops'}: Check bounced mail`, outcome: 'Not matched to a mail GSP sent: a task “Check bounced mail” for Global Ops.' };
    case 'forward': {
      const f = forwardOf(M, type, `${item.subject} ${item.summary || ''}`);
      return { where: f ? f.name : 'Not set', outcome: f ? `Forwarded to the ${f.name}${f.address ? ` <${f.address}>` : ' (address not set yet)'}.` : 'No forward set.' };
    }
    default: {
      if (!rec) return { queue: global, owner: global?.leader, where: `${global?.name || 'Global Ops'}: link to an application`, outcome: '' };
      const q = regional || global;
      return { queue: q, owner: rec.officer || q?.leader, where: `${q?.name}${rec.officer ? ` → ${nameOf(s, rec.officer)}` : ''}`, outcome: '' };
    }
  }
}
