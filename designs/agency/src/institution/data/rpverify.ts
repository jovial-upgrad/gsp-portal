/**
 * Verifying a new recruitment partner (W4/W5, 1 Nov). BAP (GSP · BAP, RP Ops) checks each onboarding
 * document on the RP's record in Recruitment partners: **Verify**, or **Send back** with a note; once every required
 * document is verified, **Approve partner** activates it. The agency's own portal shows each decision.
 *
 * New sign-ups are listed from the moment the account exists (Not activated), then Verifying once the documents go
 * to GSP: the RP portal keeps its registration and this record in step (`syncSignup`, `bapDecisions`).
 *
 * For task rules ("Verify a new RP"): `onRpEvent` tells a listener whenever an RP signs up, sends its documents (to
 * BAP), has a document verified or sent back, or is approved; `rpsToVerify` lists the ones waiting for BAP.
 */
import { getDb, patch, setSharedDb } from './store';
import type { RecruitmentPartner, RpDoc, RpStatus } from './records';
import type { SignupState } from '../../screens/signup/model';
import { docsFor } from '../../screens/signup/docs';
import { partnerManagerFor } from '../../data/partners';
import { adminCfg } from '../../admin/data/store';
import { NATIONALITY } from '../../admin/data/config';

export type RpEventKind = 'signed-up' | 'sent' | 'verified' | 'sent-back' | 'approved';
export type RpEvent = { kind: RpEventKind; rpId: string; rp: string; doc?: string; note?: string; by?: string; at: number };
const listeners = new Set<(e: RpEvent) => void>();
/** Listen for RP onboarding events (sign-up, documents sent, a document verified or sent back, approved). Returns the unsubscribe. */
export function onRpEvent(f: (e: RpEvent) => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}
const emit = (e: RpEvent) => listeners.forEach((f) => f(e));

const stampDay = (t: number) => new Date(t).toISOString().slice(0, 10);
/** What the status is, from the documents: BAP still has some (Verifying), some went back, or all verified (still Verifying until approved). */
function statusFrom(r: RecruitmentPartner): RpStatus {
  if (r.approved) return r.status === 'Agreement signed' ? r.status : 'Activated';
  if (r.docs.every((d) => d.state === 'Missing')) return 'Not activated';
  if (r.docs.some((d) => d.state === 'With BAP')) return 'Verifying';
  if (r.docs.some((d) => d.state === 'Sent back')) return 'Documents sent back';
  return 'Verifying';
}
const required = (r: RecruitmentPartner) => r.docs.filter((d) => !d.optional);
/** Every required document is verified, and the partner isn't approved yet. */
export const canApprove = (r: RecruitmentPartner) => !r.approved && ['Verifying', 'Not activated', 'Documents sent back'].includes(r.status) && required(r).length > 0 && required(r).every((d) => d.state === 'Verified');
/** The partners waiting for BAP: documents to check. */
export const rpsToVerify = () => getDb().rps.filter((r) => r.docs.some((d) => d.state === 'With BAP') || canApprove(r));

function decide(rpId: string, docName: string, fn: (d: RpDoc) => RpDoc, what: string, ev: Omit<RpEvent, 'rpId' | 'rp' | 'at'>) {
  const at = Date.now();
  let name = '';
  setSharedDb((db) => ({
    ...db,
    rps: patch(db.rps, rpId, (r) => {
      name = r.name;
      const next = { ...r, docs: r.docs.map((d) => (d.name === docName ? { ...fn(d), at, by: ev.by } : d)), activity: [{ at: stampDay(at), what }, ...r.activity] };
      return { ...next, status: statusFrom(next) };
    }),
  }));
  emit({ ...ev, rpId, rp: name, at });
}
/** BAP verifies one of the RP's documents. */
export const verifyRpDoc = (rpId: string, doc: string, by: string) => decide(rpId, doc, (d) => ({ ...d, state: 'Verified', note: undefined }), `${doc} verified by ${by}`, { kind: 'verified', doc, by });
/** BAP sends a document back to the RP, with a note saying what to upload instead. */
export const sendBackRpDoc = (rpId: string, doc: string, note: string, by: string) =>
  decide(rpId, doc, (d) => ({ ...d, state: 'Sent back', note }), `${doc} sent back by ${by}: ${note}`, { kind: 'sent-back', doc, note, by });
/** BAP approves the partner once every required document is verified: it's activated, and the agreement goes to sign. */
export function approveRp(rpId: string, by: string) {
  const at = Date.now();
  let name = '';
  setSharedDb((db) => ({
    ...db,
    rps: patch(db.rps, rpId, (r) => {
      name = r.name;
      return { ...r, approved: { at, by }, status: 'Activated', activity: [{ at: stampDay(at), what: `Approved by ${by}: activated, agreement sent to sign` }, ...r.activity] };
    }),
  }));
  emit({ kind: 'approved', rpId, rp: name, by, at });
}

/* ---------- the RP portal's registration and the record, in step ---------- */

const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** The record id for an agency that signed up in the portal. */
export const signupId = (s: SignupState) => `rp-new-${slug(s.form.biz || s.form.email || 'agency')}`;
const sentStages = ['sent', 'sent-back', 'verified'];

/**
 * The RP portal's side: puts the agency's registration on its record (adding it as a new sign-up the first time).
 * BAP's decisions newer than the agency's last send are kept until the portal has taken them in.
 */
export function syncSignup(s: SignupState) {
  if (!s.form.biz.trim() || ['form', 'code', 'creating'].includes(s.stage)) return;
  const id = signupId(s);
  const db = getDb();
  const old = db.rps.find((r) => r.id === id);
  const sent = sentStages.includes(s.stage);
  const sentAt = s.sentAt ?? 0;
  const docs: RpDoc[] = docsFor(s.form.country).map((need) => {
    const slot = s.docs[need.name];
    const prev = old?.docs.find((d) => d.name === need.name);
    const file = slot?.file?.name ?? prev?.file ?? `${need.name.replace(/[^A-Za-z]+/g, '_')}.pdf`;
    // BAP decided after the agency last sent: keep it until the portal takes it in
    if (prev && prev.at && prev.at > sentAt && (prev.state === 'Verified' || prev.state === 'Sent back')) return prev;
    const state: RpDoc['state'] = !sent || !slot?.file ? 'Missing' : slot.status === 'accepted' ? 'Verified' : slot.status === 'sent-back' || (slot.reason && slot.status !== 'checking') ? 'Sent back' : slot.status === 'checking' ? 'With BAP' : 'Missing';
    return { name: need.name, state, file, optional: need.optional, note: state === 'Sent back' ? slot?.reason ?? prev?.note : undefined, at: prev?.at, by: prev?.by };
  });
  const f = s.form;
  const base: RecruitmentPartner = old ?? {
    id,
    code: `AG-${2000 + ([...id].reduce((t, c) => t + c.charCodeAt(0), 0) % 900)}`,
    name: f.biz,
    city: f.city,
    country: f.country,
    status: 'Not activated',
    since: stampDay(Date.now()),
    contact: { name: `${f.first} ${f.last}`.trim(), email: f.email, phone: f.phone ? `${f.dial} ${f.phone}` : '' },
    foundUs: f.src,
    bdm: partnerManagerFor(f.country, f.city, f.ref)?.name ?? '',
    // the region's Admissions contact (Admin › Sales regions)
    admissions: adminCfg().regions.find((g) => g.name === (NATIONALITY[f.country] || f.country))?.contact ?? '',
    masterPartner: 'None',
    docs: [],
    activity: [{ at: stampDay(Date.now()), what: 'Signed up in the partner portal' }],
    signup: true,
  };
  const wasSentBefore = old ? old.docs.some((d) => d.state !== 'Missing') : false;
  const approved = base.approved ?? (s.stage === 'verified' && s.verifiedAt ? { at: s.verifiedAt, by: 'GSP' } : undefined);
  const next: RecruitmentPartner = {
    ...base,
    name: f.biz,
    city: f.city || base.city,
    country: f.country,
    contact: { name: `${f.first} ${f.last}`.trim(), email: f.email, phone: f.phone ? `${f.dial} ${f.phone}` : base.contact.phone },
    foundUs: f.src || base.foundUs,
    docs,
    approved,
    activity: sent && !wasSentBefore ? [{ at: stampDay(sentAt || Date.now()), what: 'Documents sent to GSP for verification' }, ...base.activity] : base.activity,
  };
  next.status = statusFrom(next);
  if (old && JSON.stringify(old) === JSON.stringify(next)) return;
  setSharedDb((d) => ({ ...d, rps: old ? patch(d.rps, id, () => next) : [next, ...d.rps] }));
  if (!old) emit({ kind: 'signed-up', rpId: id, rp: next.name, at: Date.now() });
  if (sent && !wasSentBefore) emit({ kind: 'sent', rpId: id, rp: next.name, at: sentAt || Date.now() });
}

/**
 * The record's side, for the RP portal: BAP's decisions it hasn't taken in yet, applied to the registration (a
 * document verified, or sent back with BAP's note; the partner approved). Null when there's nothing new.
 */
export function bapDecisions(s: SignupState, r: RecruitmentPartner): SignupState | null {
  if (!sentStages.includes(s.stage)) return null;
  const sentAt = s.sentAt ?? 0;
  let changed = false;
  const docs = { ...s.docs };
  for (const d of r.docs) {
    const slot = docs[d.name];
    if (!slot || !d.at || d.at <= sentAt || slot.status !== 'checking') continue;
    if (d.state === 'Verified') {
      docs[d.name] = { ...slot, status: 'accepted', reason: undefined };
      changed = true;
    } else if (d.state === 'Sent back') {
      docs[d.name] = { ...slot, status: 'sent-back', reason: d.note || 'BAP couldn’t verify this document. Upload it again.' };
      changed = true;
    }
  }
  let next: SignupState = { ...s, docs };
  if (r.approved && s.stage !== 'verified' && r.approved.at > sentAt) {
    next = { ...next, stage: 'verified', verifiedAt: r.approved.at, docs: Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, v.file ? { ...v, status: 'accepted' as const, reason: undefined } : v])) };
    changed = true;
  } else if (changed && s.stage === 'sent' && !Object.values(docs).some((v) => v.status === 'checking') && Object.values(docs).some((v) => v.status === 'sent-back')) {
    // BAP has looked at everything and sent some back: the agency's turn
    next = { ...next, stage: 'sent-back', reviewedAt: Date.now() };
  }
  return changed ? next : null;
}
