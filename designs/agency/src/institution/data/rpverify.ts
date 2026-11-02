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
import { activeAgreement, agreementName, openAgreement, todayIso, versionsOf, type RpAgreementVersion } from './agreements';
import type { SignupState } from '../../screens/signup/model';
import { docsFor } from '../../screens/signup/docs';
import { partnerManagerFor } from '../../data/partners';
import { adminCfg } from '../../admin/data/store';
import { NATIONALITY } from '../../admin/data/config';

export type RpEventKind = 'signed-up' | 'sent' | 'verified' | 'sent-back' | 'approved' | 'agreement-draft' | 'agreement-sent' | 'agreement-uploaded' | 'agreement-signed' | 'agreement-sent-back' | 'agreement-withdrawn' | 'status' | 'trained';
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
/**
 * What the status is (Jovial, 2 Nov): from the documents (BAP still has some: Verifying; some went back: Documents
 * sent back), then the agreement (sent to the RP, or its signed copy with RP Ops: Agreement sent), then approved
 * (its first signed agreement accepted: Agreement signed, every module open).
 */
export function statusFrom(r: RecruitmentPartner): RpStatus {
  // GSP's own decisions (Reject, Suspend; Dormant from job J2) aren't worked out from the documents
  if (['Rejected', 'Suspended', 'Dormant'].includes(r.status)) return r.status;
  if (r.approved) return 'Agreement signed';
  if (r.docs.every((d) => d.state === 'Missing')) return 'Not activated';
  if (r.docs.some((d) => d.state === 'With BAP')) return 'Verifying';
  if (r.docs.some((d) => d.state === 'Sent back')) return 'Documents sent back';
  if (openAgreement(r)) return 'Agreement sent';
  return 'Verifying';
}
const required = (r: RecruitmentPartner) => r.docs.filter((d) => !d.optional);
/** Every required document is verified, and the partner isn't approved yet. */
export const docsVerified = (r: RecruitmentPartner) => !r.approved && ['Verifying', 'Not activated', 'Documents sent back', 'Agreement sent'].includes(r.status) && required(r).length > 0 && required(r).every((d) => d.state === 'Verified');
/** Ready for the agreement: documents verified, nothing sent yet (a draft may be waiting). */
export const readyForAgreement = (r: RecruitmentPartner) => docsVerified(r) && !openAgreement(r) && !activeAgreement(r);
/** RP Ops can send an agreement: the first once the documents are verified, a new one any time after; one open at a time. */
export const canSendAgreement = (r: RecruitmentPartner) => !['Rejected', 'Suspended'].includes(r.status) && (docsVerified(r) || !!r.approved) && !openAgreement(r);
/**
 * Approval is accepting the first signed agreement (Jovial, 2 Nov): there's no separate step. "Approve partner"
 * turns on only while a first signed copy waits for RP Ops, and accepts it.
 */
export const canApprove = (r: RecruitmentPartner) => !r.approved && openAgreement(r)?.status === 'Signed copy uploaded';
/** The partners waiting for BAP: documents to check, or a signed copy to review. */
export const rpsToVerify = () => getDb().rps.filter((r) => r.docs.some((d) => d.state === 'With BAP') || openAgreement(r)?.status === 'Signed copy uploaded');

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
/** Changes the RP's record and adds a line to its Activity. */
function rpChange(rpId: string, fn: (r: RecruitmentPartner) => RecruitmentPartner, what: string | null, ev: Omit<RpEvent, 'rpId' | 'rp' | 'at'>) {
  const at = Date.now();
  let name = '';
  setSharedDb((db) => ({ ...db, rps: patch(db.rps, rpId, (r) => ((name = r.name), { ...fn(r), activity: what ? [{ at: stampDay(at), what, time: at }, ...r.activity] : r.activity })) }));
  emit({ ...ev, rpId, rp: name, at });
}
/*
 * The RP agreement's versions (Jovial, 2 Nov; data/agreements.ts). Each step changes the version; its Activity line
 * is worked out from the version (agreementActivity), so nothing here writes one.
 */
const onVersion = (rpId: string, id: string, fn: (v: RpAgreementVersion, r: RecruitmentPartner) => RpAgreementVersion, extra: (r: RecruitmentPartner) => Partial<RecruitmentPartner>, ev: Omit<RpEvent, 'rpId' | 'rp' | 'at'>) =>
  rpChange(rpId, (r) => {
    const next = { ...r, agreements: versionsOf(r).map((v) => (v.id === id ? fn(v, r) : v)) };
    const out = { ...next, ...extra(next) };
    return { ...out, status: statusFrom(out) };
  }, null, ev);
export type NewAgreement = { file: string; size: number; version: string; effectiveFrom?: string; notes?: string };
/** RP Ops uploads an agreement: kept as a draft, or sent to the RP straight away (its Home, its bell and E8). */
export function addAgreement(rpId: string, a: NewAgreement, send: boolean, by: string) {
  const at = Date.now();
  const id = `${rpId}-a${at.toString(36)}`;
  rpChange(rpId, (r) => {
    // a draft waiting is replaced by the new upload
    const keep = versionsOf(r).filter((v) => v.status !== 'Draft');
    const v: RpAgreementVersion = { id, version: a.version, file: a.file, size: a.size, uploadedAt: at, uploadedBy: by, status: send ? 'Sent' : 'Draft', ...(send ? { sentAt: at, sentBy: by } : {}), ...(a.effectiveFrom ? { effectiveFrom: a.effectiveFrom } : {}), ...(a.notes ? { notes: a.notes } : {}) };
    const next = { ...r, agreements: [...keep, v] };
    return { ...next, status: statusFrom(next) };
  }, null, { kind: send ? 'agreement-sent' : 'agreement-draft', by, note: a.version });
  return id;
}
/** RP Ops sends a draft to the RP. */
export const sendAgreement = (rpId: string, id: string, by: string) => onVersion(rpId, id, (v) => ({ ...v, status: 'Sent', sentAt: Date.now(), sentBy: by }), () => ({}), { kind: 'agreement-sent', by });
/** The RP Admin uploads the signed copy with the date it was signed (RPA "Check <RP>'s signed agreement"). Again to replace it until RP Ops decides. */
export const uploadSignedCopy = (rpId: string, id: string, c: { file: string; size: number; on: string }, by: string) =>
  onVersion(rpId, id, (v) => ({ ...v, status: 'Signed copy uploaded', copies: [...(v.copies ?? []), { ...c, at: Date.now(), by }] }), () => ({}), { kind: 'agreement-uploaded', by });
/**
 * RP Ops accepts the signed copy: the version is Accepted, effective from its date or today. The first one is the
 * approval: Agreement signed, every module opens (E10; T58 "Train <RP> on the portal"). A later one takes over from
 * its effective date; the one it replaces reads Superseded from then.
 */
export const acceptSignedCopy = (rpId: string, id: string, by: string) => {
  const at = Date.now();
  onVersion(
    rpId,
    id,
    (v) => ({ ...v, status: 'Accepted', accepted: { by, at }, effectiveFrom: v.effectiveFrom && v.effectiveFrom > todayIso() ? v.effectiveFrom : todayIso() }),
    (r) => (r.approved ? {} : { approved: { at, by } }),
    { kind: 'agreement-signed', by },
  );
};
/** RP Ops sends the signed copy back with a reason, shown to the RP on Home, in its bell and in E9. */
export const sendBackSignedCopy = (rpId: string, id: string, reason: string, by: string) =>
  onVersion(rpId, id, (v) => ({ ...v, status: 'Sent back', returns: [...(v.returns ?? []), { by, at: Date.now(), reason }] }), () => ({}), { kind: 'agreement-sent-back', by, note: reason });
/** RP Ops withdraws a version before it's accepted: the RP has nothing to sign. */
export const withdrawAgreement = (rpId: string, id: string, by: string) => onVersion(rpId, id, (v) => ({ ...v, status: 'Withdrawn', withdrawn: { by, at: Date.now() } }), () => ({}), { kind: 'agreement-withdrawn', by });
export { agreementName };
/** Reject, Suspend and Reactivate (S2-26, S2C-9): Admin, Recruitment and RP Ops; no reason is asked. */
export function setRpStatus(rpId: string, action: 'Reject' | 'Suspend' | 'Reactivate', by: string) {
  rpChange(
    rpId,
    (r) => (action === 'Reject' ? { ...r, status: 'Rejected' } : action === 'Suspend' ? { ...r, status: 'Suspended', before: r.status } : { ...r, status: r.before ?? statusFrom({ ...r, status: 'Verifying' }), before: undefined }),
    action === 'Reject' ? `Rejected by ${by}` : action === 'Suspend' ? `Suspended by ${by}: every user loses access` : `Reactivated by ${by}: every user's access is back`,
    { kind: 'status', by, note: action },
  );
}
/** Where each action is offered (proposal, S2C-9). */
export const rpActions = (s: RpStatus): ('Reject' | 'Suspend' | 'Reactivate')[] =>
  ['Not activated', 'Verifying', 'Documents sent back', 'Agreement sent'].includes(s) ? ['Reject'] : ['Agreement signed', 'Dormant'].includes(s) ? ['Suspend'] : s === 'Suspended' ? ['Reactivate'] : [];
/** RP Ops marks the portal training done (T58 closes, S4-22). */
export const markTrained = (rpId: string, by: string) => rpChange(rpId, (r) => ({ ...r, trained: { at: Date.now(), by } }), `Portal training marked done by ${by} (T58)`, { kind: 'trained', by });
/** GSP edits the RP's record (RP Ops, Recruitment, Admin), with a line in its Activity. */
export const editRp = (rpId: string, fn: (r: RecruitmentPartner) => RecruitmentPartner, what: string, by: string) => rpChange(rpId, fn, `${what} (${by})`, { kind: 'status', by, note: what });

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
