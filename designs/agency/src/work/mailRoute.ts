// @ts-nocheck -- typed when the mail API is designed.
/**
 * Where a mail to gsp.admissions@ goes (Jovial, 5 Nov, kept simple): linked to its application, forwarded to the
 * inbox that handles it, not kept (GSP's own notifications, auto-replies, bounces, codes), or, when none of these,
 * to Global Ops to link by hand. Rules: Mail's `routes` (work/mail.ts MAIL_ROUTES).
 */
import { recordById, queueById } from './store';

/** The inbox a forward rule sends to: one of the portal's mailboxes, or another address. */
export function targetOf(M, to) {
  const box = M.mailboxes.find((b) => b.id === to);
  if (box) return { id: to, name: `${box.name} inbox`, address: box.addresses[0] };
  const t = (M.forwardTargets || []).find((x) => x.id === to);
  return t ? { id: to, name: t.name, address: t.address } : null;
}

/** The forward rule a mail's words match, if any. */
export function forwardRuleOf(M, item) {
  const low = `${item.subject || ''} ${(item.messages || []).map((m) => m.body).join(' ')}`.toLowerCase();
  return (M.routes?.forward || []).find((f) => f.words.some((w) => low.includes(w))) || null;
}

/** routeOf(s, item) → { kind: 'linked' | 'forward' | 'drop' | 'unlinked', text } */
export function routeOf(s, item) {
  const M = s.mail;
  if (item.drop) { const d = (M.routes?.drop || []).find((x) => x.id === item.drop); return { kind: 'drop', text: `Not kept: ${d ? d.name.toLowerCase() : 'not about an application'}${d?.why ? ` (${d.why})` : ''}.` }; }
  if (item.forwardedTo) { const t = targetOf(M, item.forwardedTo); return { kind: 'forward', target: t, text: `Forwarded to the ${t?.name}${t?.address ? ` <${t.address}>` : ' (address not set yet)'}.` }; }
  const rec = item.record ? recordById(s, item.record) : null;
  if (rec) return { kind: 'linked', rec, text: `Linked to ${rec.student ? `${rec.student} · ` : ''}${rec.id}: it’s in the application’s Mail tab.` };
  const f = forwardRuleOf(M, item);
  if (f) { const t = targetOf(M, f.to); return { kind: 'forward', target: t, rule: f, text: `${f.name}: forwarded to the ${t?.name}${t?.address ? ` <${t.address}>` : ' (address not set yet)'}.` }; }
  const q = queueById(s, M.routes?.unlinked);
  return { kind: 'unlinked', text: `No application found: ${q?.name || 'Global Ops'} links it.` };
}
