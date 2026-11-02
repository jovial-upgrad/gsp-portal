/**
 * The RP agreement (Jovial, 2 Nov): a list of versions per RP, each one a contract RP Ops uploads and sends. The RP
 * Admin downloads it, signs it and uploads the signed copy; RP Ops accepts it or sends it back with a reason. Signing
 * and uploading is the only way an RP acknowledges an agreement (Jovial, 2 Nov, 19:25).
 *
 * - The first agreement accepted is the approval: the RP becomes Agreement signed and every module opens.
 * - Exactly one agreement is active at a time: the accepted one whose effective date has come, latest first. A new
 *   version RP Ops sends later leaves the current one active (modules stay open) until it's accepted and its
 *   effective date comes; the one it replaces then reads Superseded. Nothing here runs on a timer: the status is
 *   worked out from the dates every time it's read.
 * - RP Ops can withdraw a version before it's accepted.
 *
 * Every label, tone and line of copy about an agreement comes from here, so the RP list, the RP record, the RP's Home
 * and Profile, BAP's Home, My work, the bell and the emails all say the same thing.
 */
import type { RecruitmentPartner } from './records';

/** Stored: Draft, Sent, Signed copy uploaded, Accepted, Sent back, Withdrawn. Superseded is worked out (see statusOf). */
export const AGREEMENT_STATUSES = ['Draft', 'Sent', 'Signed copy uploaded', 'Accepted', 'Sent back', 'Superseded', 'Withdrawn'] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];
/** What each status reads as. */
export const AGREEMENT_LABEL: Record<AgreementStatus, string> = {
  Draft: 'Draft',
  Sent: 'Sent: waiting for the signed copy',
  'Signed copy uploaded': 'Signed copy uploaded: RP Ops to review',
  Accepted: 'Accepted (active)',
  'Sent back': 'Sent back: waiting for the RP',
  Superseded: 'Superseded',
  Withdrawn: 'Withdrawn',
};
/** The short form, for pills. */
export const AGREEMENT_SHORT: Record<AgreementStatus, string> = { Draft: 'Draft', Sent: 'Sent', 'Signed copy uploaded': 'Signed copy uploaded', Accepted: 'Accepted (active)', 'Sent back': 'Sent back', Superseded: 'Superseded', Withdrawn: 'Withdrawn' };
/** Its colour: amber with the RP, violet with GSP, green active, grey closed (GSP owner colours). */
export const AGREEMENT_TONE: Record<AgreementStatus, 'you' | 'gsp' | 'ok' | 'grey' | 'uni' | 'bad'> = { Draft: 'grey', Sent: 'you', 'Signed copy uploaded': 'gsp', Accepted: 'ok', 'Sent back': 'you', Superseded: 'grey', Withdrawn: 'grey' };
/** The statuses a version is still open in: with the RP or with RP Ops. One at a time per RP. */
export const OPEN_STATUSES: AgreementStatus[] = ['Sent', 'Signed copy uploaded', 'Sent back'];
/** RP Ops can withdraw a version in these (not once it's accepted). */
export const WITHDRAWABLE: AgreementStatus[] = ['Draft', 'Sent', 'Sent back', 'Signed copy uploaded'];
/** The files RP Ops uploads, and the RP's signed copy. */
export const AGREEMENT_FILE = { types: ['pdf'], maxMb: 20 };
export const SIGNED_FILE = { types: ['pdf', 'jpg', 'png'], maxMb: 20 };

export type RpAgreementVersion = {
  id: string;
  /** "v4 · Nov 2026": what RP Ops calls it. */
  version: string;
  file: string;
  /** Bytes. */
  size: number;
  uploadedAt: number;
  uploadedBy: string;
  sentAt?: number;
  sentBy?: string;
  status: Exclude<AgreementStatus, 'Superseded'>;
  /** The RP's signed copies, oldest first: the last one is the one under review (or accepted). */
  copies?: SignedCopy[];
  /** RP Ops' decision on the signed copy. */
  accepted?: { by: string; at: number };
  /** Each time RP Ops sent a signed copy back, oldest first. */
  returns?: { by: string; at: number; reason: string }[];
  withdrawn?: { by: string; at: number };
  /** ISO date. Set by RP Ops when sending, or the acceptance date. */
  effectiveFrom?: string;
  notes?: string;
};

export type SignedCopy = { file: string; size: number; on: string; at: number; by: string };
/** The signed copy as it stands (the last uploaded). */
export const signedOf = (v: RpAgreementVersion) => v.copies?.[v.copies.length - 1] ?? null;
/** The last send-back. */
export const returnOf = (v: RpAgreementVersion) => v.returns?.[v.returns.length - 1] ?? null;

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const versionsOf = (r: RecruitmentPartner) => r.agreements ?? [];
/** Newest first (by when uploaded). */
export const historyOf = (r: RecruitmentPartner) => [...versionsOf(r)].sort((a, b) => b.uploadedAt - a.uploadedAt);

/** The active agreement: accepted, effective date come, the latest such. Null: none accepted yet. */
export function activeAgreement(r: RecruitmentPartner, day = todayIso()): RpAgreementVersion | null {
  const ok = versionsOf(r).filter((v) => v.status === 'Accepted' && (v.effectiveFrom ?? '') <= day);
  ok.sort((a, b) => (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? '') || (b.accepted?.at ?? 0) - (a.accepted?.at ?? 0));
  return ok[0] ?? null;
}
/** Accepted, effective from a later date: it takes over then. */
export const upcomingAgreement = (r: RecruitmentPartner, day = todayIso()) => versionsOf(r).find((v) => v.status === 'Accepted' && (v.effectiveFrom ?? '') > day) ?? null;
/** The version waiting on someone (sent, signed copy uploaded, or sent back): one at a time. */
export const openAgreement = (r: RecruitmentPartner) => historyOf(r).find((v) => OPEN_STATUSES.includes(v.status)) ?? null;
export const draftAgreement = (r: RecruitmentPartner) => historyOf(r).find((v) => v.status === 'Draft') ?? null;
/** A version's status now: an accepted one that a later one has replaced reads Superseded. */
export function statusOf(r: RecruitmentPartner, v: RpAgreementVersion, day = todayIso()): AgreementStatus {
  if (v.status !== 'Accepted') return v.status;
  const act = activeAgreement(r, day);
  if (!act || act.id === v.id || (v.effectiveFrom ?? '') > day) return 'Accepted';
  return 'Superseded';
}
/** The label for an accepted version that isn't in force yet. */
export const statusText = (r: RecruitmentPartner, v: RpAgreementVersion, day = todayIso()) => {
  const s = statusOf(r, v, day);
  return s === 'Accepted' && (v.effectiveFrom ?? '') > day ? `Accepted: active from ${dayText(v.effectiveFrom!)}` : AGREEMENT_LABEL[s];
};
/** Commission (S2-11): held while no agreement is active. A new version waiting doesn't hold anything. */
export const commissionHeld = (r: RecruitmentPartner, day = todayIso()) => !activeAgreement(r, day);

/** The RP's turn: an open version sent to it, or sent back to it. */
export const withRp = (v: RpAgreementVersion | null) => !!v && (v.status === 'Sent' || v.status === 'Sent back');
/** RP Ops' turn: a signed copy to review. */
export const withRpOps = (v: RpAgreementVersion | null) => !!v && v.status === 'Signed copy uploaded';

/** What the RP list, the record's header and BAP's Home say about where the agreement is (null: nothing open). */
export function agreementLine(r: RecruitmentPartner): string | null {
  const o = openAgreement(r);
  if (!o) {
    const d = draftAgreement(r);
    return d ? `Agreement ${d.version}: draft, not sent` : null;
  }
  return `${activeAgreement(r) ? 'New agreement' : 'Agreement'} ${o.version}: ${OPEN_LINE[o.status]}`;
}
const OPEN_LINE: Partial<Record<AgreementStatus, string>> = { Sent: 'sent, waiting for the signed copy', 'Signed copy uploaded': 'signed copy to review', 'Sent back': 'signed copy sent back, waiting for the RP' };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2 Nov 2026". */
export const dayText = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
};
/** "1.2 MB", "340 KB". */
export const sizeText = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
/** What the RP reads as the agreement's name: "Partner agreement · v4 · Nov 2026". */
export const agreementName = (v: RpAgreementVersion) => `Partner agreement · ${v.version}`;

/* ---------- the RP's side: its pending card, its bell ---------- */

/** The card on the RP's Home and Profile › Agreement: its title, line and chip, from the open version. */
export function rpCardCopy(r: RecruitmentPartner, v: RpAgreementVersion) {
  const isNew = !!activeAgreement(r);
  const held = commissionHeld(r);
  return {
    chip: v.status === 'Signed copy uploaded' ? 'With GSP' : 'With you',
    chipTone: v.status === 'Signed copy uploaded' ? 'gsp' : 'you',
    title: v.status === 'Signed copy uploaded' ? 'Signed copy sent · we’re reviewing it' : v.status === 'Sent back' ? 'Upload your signed agreement again' : isNew ? 'New agreement to review and sign' : 'Sign your agreement',
    line: v.status === 'Signed copy uploaded' ? 'GSP checks it and lets you know. You can replace the file until then.' : 'Download it, sign it, then upload the signed copy.',
    note: isNew ? 'Your current agreement stays active until this one is accepted.' : held ? 'Your commission is held until GSP accepts your signed agreement.' : null,
    steps: ['Download', 'Sign', 'Upload'],
  };
}

export type AgreementNote = { id: string; title: string; text: string; at: number };
/** The RP Admin's bell: an agreement to sign, one sent back, one accepted, one withdrawn. Worked out from the versions. */
export function agreementNotes(r: RecruitmentPartner): AgreementNote[] {
  const out: AgreementNote[] = [];
  const sorted = [...versionsOf(r)].sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0));
  sorted.forEach((v, i) => {
    const later = sorted.slice(0, i).some((x) => x.accepted);
    if (v.sentAt) out.push({ id: `agr-${v.id}-sent`, title: later ? 'New agreement to review and sign' : 'Sign your agreement', text: `${agreementName(v)}. Download it, sign it, and upload the signed copy on Home.`, at: v.sentAt });
    for (const b of v.returns ?? []) out.push({ id: `agr-${v.id}-back-${b.at}`, title: 'Your signed agreement was sent back', text: b.reason, at: b.at });
    if (v.accepted) out.push({ id: `agr-${v.id}-ok`, title: 'Your agreement is accepted', text: `${agreementName(v)}, active from ${dayText(v.effectiveFrom ?? todayIso())}.${later ? '' : ' Students, Applications, Earnings and Profile are open.'}`, at: v.accepted.at });
    if (v.withdrawn && v.sentAt) out.push({ id: `agr-${v.id}-wd`, title: 'An agreement was withdrawn', text: `GSP withdrew ${agreementName(v)}. Nothing to sign.`, at: v.withdrawn.at });
  });
  return out;
}

/* ---------- the emails (Admin › Work › Emails and daily jobs): E8, E9, E10 from the versions ---------- */

export type AgreementEmail = { tpl: 'E8' | 'E9' | 'E10'; at: number; values: Record<string, string> };
export function agreementEmails(r: RecruitmentPartner): AgreementEmail[] {
  const out: AgreementEmail[] = [];
  for (const v of versionsOf(r)) {
    const values = { agency: r.name, version: v.version, date: dayText(v.effectiveFrom ?? todayIso()) };
    if (v.sentAt) out.push({ tpl: 'E8', at: v.sentAt, values });
    for (const b of v.returns ?? []) out.push({ tpl: 'E9', at: b.at, values: { ...values, reason: b.reason } });
    if (v.accepted) out.push({ tpl: 'E10', at: v.accepted.at, values });
  }
  return out;
}
/** Fills a template's {placeholders} from the values; the ones it hasn't got stay as they are. */
export const fill = (text: string, values: Record<string, string>) => text.replace(/\{([^{}]+)\}/g, (m, k: string) => values[k] ?? m);

/* ---------- the record's Activity: every step, who and when, from the versions ---------- */

export type AgreementStep = { at: number; what: string };
/** Uploaded, sent, each signed copy, each send-back, accepted (with what it superseded), withdrawn. */
export function agreementActivity(r: RecruitmentPartner, day = todayIso()): AgreementStep[] {
  const out: AgreementStep[] = [];
  const all = versionsOf(r);
  for (const v of all) {
    const n = `${agreementName(v)}`;
    out.push({ at: v.uploadedAt, what: `${n} uploaded by ${v.uploadedBy}${v.status === 'Draft' ? ' (draft)' : ''}` });
    if (v.sentAt) out.push({ at: v.sentAt, what: `${n} sent to the RP by ${v.sentBy ?? v.uploadedBy}: to sign and upload${v.effectiveFrom ? `, effective from ${dayText(v.effectiveFrom)}` : ''}` });
    for (const c of v.copies ?? []) out.push({ at: c.at, what: `Signed copy of ${v.version} uploaded by ${c.by} (signed ${dayText(c.on)}): ${c.file}` });
    for (const b of v.returns ?? []) out.push({ at: b.at, what: `Signed copy of ${v.version} sent back by ${b.by}: ${b.reason}` });
    if (v.accepted) {
      const first = !all.some((x) => x.id !== v.id && x.accepted && x.accepted.at < v.accepted!.at);
      out.push({ at: v.accepted.at, what: `Signed copy of ${v.version} accepted by ${v.accepted.by}: active from ${dayText(v.effectiveFrom ?? day)}${first ? '; the RP is Agreement signed and every module is open' : ''}` });
    }
    if (v.withdrawn) out.push({ at: v.withdrawn.at, what: `${n} withdrawn by ${v.withdrawn.by}` });
    if (statusOf(r, v, day) === 'Superseded') {
      const by = all.filter((x) => x.status === 'Accepted' && (x.effectiveFrom ?? '') > (v.effectiveFrom ?? '') && (x.effectiveFrom ?? '') <= day).sort((a, b) => (a.effectiveFrom ?? '').localeCompare(b.effectiveFrom ?? ''))[0];
      if (by?.effectiveFrom) out.push({ at: new Date(`${by.effectiveFrom}T00:00:00`).getTime(), what: `${v.version} superseded by ${by.version} (System)` });
    }
  }
  return out;
}
