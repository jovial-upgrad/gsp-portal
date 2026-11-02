import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { FileDrop } from '../../components/FileDrop';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DateInput, Field, TextInput } from '../../components/forms';
import { dateError } from '../../components/validate';
import type { RecruitmentPartner } from '../data/records';
import {
  AGREEMENT_FILE,
  AGREEMENT_SHORT,
  AGREEMENT_TONE,
  WITHDRAWABLE,
  activeAgreement,
  dayText,
  draftAgreement,
  historyOf,
  openAgreement,
  returnOf,
  signedOf,
  sizeText,
  statusOf,
  statusText,
  todayIso,
  upcomingAgreement,
  type RpAgreementVersion,
} from '../data/agreements';
import { acceptSignedCopy, addAgreement, canSendAgreement, docsVerified, sendAgreement, sendBackSignedCopy, withdrawAgreement, type NewAgreement } from '../data/rpverify';
import { acceptOf, audit, checkFile, dateTimeText, type FileKind } from '../data/changelog';
import { Facts, Pill, Section } from './parts';
import { downloadFile } from './PartnerPage';

type Ask = { kind: 'accept' | 'back' | 'withdraw' | 'send'; v: RpAgreementVersion } | null;

/**
 * RP Ops' agreement actions on an RP's record (Jovial, 2 Nov): send an agreement (the first, or a new one later),
 * send a draft, accept or send back the signed copy, withdraw one not yet accepted. Each is confirmed, logged in
 * Admin's log, and changes the version (the record's Activity is worked out from it).
 */
export function useAgreementActions({ r, me, role, say }: { r: RecruitmentPartner; me: string; role: string; say: (m: string) => void }) {
  const [ask, setAsk] = useState<Ask>(null);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const active = activeAgreement(r);
  const first = !r.approved;
  const close = () => (setAsk(null), setReason(''), setTried(false));
  const ui = (
    <>
      <ConfirmDialog
        open={ask?.kind === 'accept'}
        title={first ? `Accept the signed agreement and approve ${r.name}?` : `Accept the signed copy of ${ask?.v.version ?? ''}?`}
        confirm={first ? 'Accept and approve' : 'Accept'}
        onCancel={close}
        onConfirm={() => {
          if (!ask) return;
          acceptSignedCopy(r.id, ask.v.id, me);
          audit('Recruitment partners', `rp.agreement_accepted: ${r.name}, ${ask.v.version}${first ? ' (rp.approved, E10; T58 "Train the RP on the portal")' : ' (E10)'}`, me, role);
          say(first ? `${r.name} approved: Agreement signed. Every module is open.` : `${ask.v.version} accepted. It’s active from ${dayText(ask.v.effectiveFrom && ask.v.effectiveFrom > todayIso() ? ask.v.effectiveFrom : todayIso())}.`);
          close();
        }}
      >
        <p>
          {first
            ? 'The RP becomes Agreement signed: Applications, Students, Earnings, Profile and Select student in Find courses open, and held commission is paid.'
            : `${ask?.v.version ?? 'It'} becomes the active agreement from ${dayText(ask?.v.effectiveFrom && ask.v.effectiveFrom > todayIso() ? ask.v.effectiveFrom : todayIso())}${active ? `; ${active.version} is superseded then` : ''}.`}
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={ask?.kind === 'back'}
        title="Send back the signed copy?"
        confirm="Send back"
        onCancel={close}
        onConfirm={() => {
          setTried(true);
          if (!ask || !reason.trim()) return;
          sendBackSignedCopy(r.id, ask.v.id, reason.trim(), me);
          audit('Recruitment partners', `rp.agreement_sent_back: ${r.name}, ${ask.v.version} (E9)`, me, role);
          say('Signed copy sent back to the RP.');
          close();
        }}
      >
        <Field id="irp-agr-note" label="Reason" required hint="Shown to the RP on Home, in its bell and in E9." error={tried && !reason.trim() ? 'Enter the reason.' : null}>
          <div className="control iform__area">
            <textarea id="irp-agr-note" className="control__input" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={ask?.kind === 'withdraw'}
        title={`Withdraw ${ask?.v.version ?? 'the agreement'}?`}
        confirm="Withdraw"
        danger
        onCancel={close}
        onConfirm={() => {
          if (!ask) return;
          withdrawAgreement(r.id, ask.v.id, me);
          audit('Recruitment partners', `rp.agreement_withdrawn: ${r.name}, ${ask.v.version}`, me, role);
          say(`${ask.v.version} withdrawn.`);
          close();
        }}
      >
        <p>{ask?.v.status === 'Draft' ? 'The draft is kept in the history as withdrawn.' : `The RP no longer has it to sign.${active ? ` ${active.version} stays active.` : ''}`}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={ask?.kind === 'send'}
        title={`Send ${ask?.v.version ?? 'the draft'} to ${r.name}?`}
        confirm="Send to the RP"
        onCancel={close}
        onConfirm={() => {
          if (!ask) return;
          sendAgreement(r.id, ask.v.id, me);
          audit('Recruitment partners', `rp.agreement_sent: ${r.name}, ${ask.v.version} (E8)`, me, role);
          say(`${ask.v.version} sent to ${r.name}.`);
          close();
        }}
      >
        <p>It goes to the RP Admin’s Home, bell and email to sign and upload.{active ? ` ${active.version} stays active until it’s accepted.` : ''}</p>
      </ConfirmDialog>
      <SendAgreement
        open={sending}
        r={r}
        onCancel={() => setSending(false)}
        onSave={(a, send) => {
          addAgreement(r.id, a, send, me);
          audit('Recruitment partners', `${send ? 'rp.agreement_sent' : 'rp.agreement_draft'}: ${r.name}, ${a.version}${send ? ' (E8)' : ''}`, me, role);
          say(send ? `${a.version} sent to ${r.name}.` : `${a.version} saved as a draft.`);
          setSending(false);
        }}
      />
    </>
  );
  return {
    ui,
    accept: (v: RpAgreementVersion) => setAsk({ kind: 'accept', v }),
    sendBack: (v: RpAgreementVersion) => setAsk({ kind: 'back', v }),
    withdraw: (v: RpAgreementVersion) => setAsk({ kind: 'withdraw', v }),
    sendDraft: (v: RpAgreementVersion) => setAsk({ kind: 'send', v }),
    upload: () => setSending(true),
  };
}
export type AgreementActions = ReturnType<typeof useAgreementActions>;

/** Why "Send agreement" is off, for its tooltip (null: it's on). */
export function sendOffWhy(r: RecruitmentPartner) {
  if (canSendAgreement(r)) return null;
  if (['Rejected', 'Suspended'].includes(r.status)) return `Not while the partner is ${r.status}.`;
  const o = openAgreement(r);
  if (o) return `${o.version} is still open. Withdraw it, or wait until it’s accepted.`;
  return 'Turns on once every required document is verified.';
}

/**
 * The RP agreement on the record's Documents tab: the active one, the one open now with its actions, and every
 * version with its status, dates, signed copy and decision. RP Ops (and Admin) act; other roles read.
 */
export function AgreementSection({ r, act, canAct, onPreview }: { r: RecruitmentPartner; act: AgreementActions; canAct: boolean; onPreview: (name: string, file: string) => void }) {
  const active = activeAgreement(r);
  const next = upcomingAgreement(r);
  const open = openAgreement(r);
  const draft = draftAgreement(r);
  const list = historyOf(r);
  const off = sendOffWhy(r);
  const firstSend = !r.approved && !active;
  return (
    <Section
      title="RP agreement"
      id="irp-agreement"
      note="RP Ops uploads each agreement and sends it; the RP Admin signs it and uploads the signed copy; RP Ops accepts it or sends it back. Accepting the first one approves the partner. One agreement is active at a time."
      action={
        canAct ? (
          <Button variant="secondary" size="sm" disabled={!!off} title={off ?? undefined} iconLeft={<Icon name="upload" size={16} />} onClick={act.upload}>
            {firstSend ? 'Send agreement' : 'Send new agreement'}
          </Button>
        ) : undefined
      }
    >
      <Facts
        items={[
          ['Active agreement', active ? `${active.version}, from ${dayText(active.effectiveFrom ?? todayIso())}` : 'None accepted yet: commission is held'],
          ...(next ? ([['Next', `${next.version}, accepted, active from ${dayText(next.effectiveFrom!)}`]] as [string, string][]) : []),
          ['Open now', open ? `${open.version}: ${statusText(r, open)}` : draft ? `${draft.version}: draft, not sent` : 'Nothing open'],
        ]}
      />
      {canAct && open?.status === 'Signed copy uploaded' && (
        <div className="iagr__review">
          <p className="irsec__note">
            {r.contact.name || 'The RP'} uploaded the signed copy of {open.version} on {dateTimeText(signedOf(open)!.at)}. Preview it, then accept it or send it back.
          </p>
          <div className="irowacts">
            <Button size="sm" variant="secondary" onClick={() => onPreview(`Signed copy of ${open.version}`, signedOf(open)!.file)}>
              Preview signed copy
            </Button>
            <Button size="sm" onClick={() => act.accept(open)}>
              {r.approved ? 'Accept' : 'Accept and approve'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => act.sendBack(open)}>
              Send back
            </Button>
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <p className="iempty">No agreement yet.{canAct && !docsVerified(r) && !r.approved ? ' Send agreement turns on once every required document is verified.' : ''}</p>
      ) : (
        <div className="stab-wrap">
          <table className="itab iagr__tab">
            <caption className="vh">Every version of {r.name}’s agreement, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Sent</th>
                <th scope="col">Signed copy</th>
                <th scope="col">Decision</th>
                <th scope="col">Effective from</th>
                {canAct && <th scope="col"><span className="vh">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((v) => {
                const s = statusOf(r, v);
                const c = signedOf(v);
                const back = returnOf(v);
                return (
                  <tr key={v.id}>
                    <td>
                      <button type="button" className="btn btn--link" onClick={() => downloadFile(v.file)}>
                        {v.version}
                        <span className="vh"> download</span>
                      </button>
                      <span className="irow__sub">
                        {v.file} · {sizeText(v.size)}
                      </span>
                      {v.notes && <span className="irow__sub">{v.notes}</span>}
                    </td>
                    <td>
                      <Pill tone={AGREEMENT_TONE[s]}>{AGREEMENT_SHORT[s]}</Pill>
                      {s === 'Accepted' && (v.effectiveFrom ?? '') > todayIso() && <span className="irow__sub">{statusText(r, v)}</span>}
                    </td>
                    <td className="num">
                      {v.sentAt ? dateTimeText(v.sentAt) : <span className="muted">Not sent</span>}
                      <span className="irow__sub">{v.sentBy ?? v.uploadedBy}</span>
                    </td>
                    <td>
                      {c ? (
                        <>
                          <button type="button" className="btn btn--link" onClick={() => onPreview(`Signed copy of ${v.version}`, c.file)}>
                            Preview<span className="vh"> the signed copy of {v.version}</span>
                          </button>
                          <span className="irow__sub">
                            Signed {dayText(c.on)} · uploaded by {c.by}, {dateTimeText(c.at)}
                          </span>
                        </>
                      ) : (
                        <span className="muted">None yet</span>
                      )}
                    </td>
                    <td>
                      {v.accepted ? (
                        <>
                          Accepted by {v.accepted.by}
                          <span className="irow__sub">{dateTimeText(v.accepted.at)}</span>
                        </>
                      ) : v.withdrawn ? (
                        <>
                          Withdrawn by {v.withdrawn.by}
                          <span className="irow__sub">{dateTimeText(v.withdrawn.at)}</span>
                        </>
                      ) : back && v.status === 'Sent back' ? (
                        <>
                          Sent back by {back.by}
                          <span className="irow__sub">{back.reason}</span>
                        </>
                      ) : (
                        <span className="muted">Not yet</span>
                      )}
                      {v.accepted && (v.returns?.length ?? 0) > 0 && <span className="irow__sub">Sent back {v.returns!.length === 1 ? 'once' : `${v.returns!.length} times`} before</span>}
                    </td>
                    <td className="num">{v.effectiveFrom ? dayText(v.effectiveFrom) : <span className="muted">On acceptance</span>}</td>
                    {canAct && (
                      <td>
                        <span className="irowacts">
                          {v.status === 'Draft' && (
                            <Button size="sm" variant="secondary" disabled={!!openAgreement(r)} title={openAgreement(r) ? 'Another version is still open.' : undefined} onClick={() => act.sendDraft(v)}>
                              Send<span className="vh"> {v.version}</span>
                            </Button>
                          )}
                          {WITHDRAWABLE.includes(v.status) && (
                            <Button size="sm" variant="ghost" onClick={() => act.withdraw(v)}>
                              Withdraw<span className="vh"> {v.version}</span>
                            </Button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/** RP Ops uploads an agreement (PDF) with its version, an optional effective date and notes; Save draft or Send to the RP. */
function SendAgreement({ open, r, onCancel, onSave }: { open: boolean; r: RecruitmentPartner; onCancel: () => void; onSave: (a: NewAgreement, send: boolean) => void }) {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [version, setVersion] = useState('');
  const [from, setFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const active = activeAgreement(r);
  const today = todayIso();
  const e = {
    file: fileErr ?? (!file ? 'Choose the agreement file.' : null),
    version: !version.trim() ? 'Enter the version, like “v4 · Nov 2026”.' : historyOf(r).some((v) => v.version.toLowerCase() === version.trim().toLowerCase() && v.status !== 'Draft') ? 'This RP already has a version with this name.' : null,
    from: from ? dateError(from, { what: 'effective from date' }) ?? (from < today ? 'Today or later.' : null) : null,
  };
  const reset = () => (setFile(null), setFileErr(null), setVersion(''), setFrom(''), setNotes(''), setTried(false));
  const save = (send: boolean) => {
    setTried(true);
    if (e.file || e.version || e.from || !file) return;
    onSave({ file: file.name, size: file.size, version: version.trim(), effectiveFrom: from || undefined, notes: notes.trim() || undefined }, send);
    reset();
  };
  return (
    <Sheet
      open={open}
      onClose={() => (reset(), onCancel())}
      center
      className="iform"
      title={active || r.approved ? 'Send a new agreement' : 'Send the agreement'}
      sub={active ? `It goes to the RP to sign and upload. ${active.version} stays active, and every module stays open, until this one is accepted.` : 'It goes to the RP to sign and upload. Accepting the signed copy approves the partner.'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={() => (reset(), onCancel())}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => save(false)}>
              Save draft
            </Button>
            <Button onClick={() => save(true)}>Send to the RP</Button>
          </div>
        </div>
      }
    >
      <div className="iform__stack">
        <Field id="irp-agr-file" label="Agreement" required error={tried || fileErr ? e.file : null}>
          <FileDrop
            id="irp-agr-file"
            accept={acceptOf(AGREEMENT_FILE.types as FileKind[])}
            file={file ? `${file.name} · ${sizeText(file.size)}` : undefined}
            invalid={(tried || !!fileErr) && !!e.file}
            label="Drop the agreement here, or"
            hint={`PDF, up to ${AGREEMENT_FILE.maxMb} MB`}
            onFiles={([f]) => {
              const bad = checkFile(f, AGREEMENT_FILE.types as FileKind[], AGREEMENT_FILE.maxMb);
              setFileErr(bad);
              setFile(bad ? null : { name: f.name, size: f.size });
            }}
            onRemove={() => (setFile(null), setFileErr(null))}
          />
        </Field>
        <Field id="irp-agr-ver" label="Version" required error={tried ? e.version : null} hint="What the RP sees, like “v4 · Nov 2026”.">
          <TextInput id="irp-agr-ver" value={version} maxLength={40} invalid={tried && !!e.version} onChange={(x) => setVersion(x.target.value)} />
        </Field>
        <Field id="irp-agr-from" label="Effective from (optional)" error={tried ? e.from : null} hint="Empty: the day the signed copy is accepted.">
          <DateInput id="irp-agr-from" value={from} min={today} invalid={tried && !!e.from} onChange={setFrom} />
        </Field>
        <Field id="irp-agr-notes" label="Notes (optional)" hint="For GSP: what changed in this version.">
          <div className="control iform__area">
            <textarea id="irp-agr-notes" className="control__input" rows={2} maxLength={500} value={notes} onChange={(x) => setNotes(x.target.value)} />
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
