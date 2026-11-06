import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { FileDrop } from '../../components/FileDrop';
import { DateInput, Field } from '../../components/forms';
import { dateError } from '../../components/validate';
import type { RecruitmentPartner } from '../../institution/data/records';
import { uploadSignedCopy } from '../../institution/data/rpverify';
import {
  AGREEMENT_SHORT,
  SIGNED_FILE,
  activeAgreement,
  agreementName,
  commissionHeld,
  dayText,
  historyOf,
  openAgreement,
  returnOf,
  rpCardCopy,
  signedOf,
  sizeText,
  statusOf,
  statusText,
  todayIso,
  type AgreementStatus,
  type RpAgreementVersion,
} from '../../institution/data/agreements';
import { acceptOf, checkFile, dateTimeText, type FileKind } from '../../institution/data/changelog';
import { downloadFile } from '../../institution/records/PartnerPage';
import './agreement.css';

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Agreement statuses as the portal's pills (amber with you, violet with GSP, green active, grey closed). */
const PILL: Record<AgreementStatus, string> = { Draft: 'pill--neutral', Sent: 'pill--you', 'Signed copy uploaded': 'pill--gsp', Accepted: 'pill--ok', 'Sent back': 'pill--you', Superseded: 'pill--neutral', Withdrawn: 'pill--neutral' };

/** The agreement as a document row: icon, name, when it was sent, its size, and Download at the right. */
function DocRow({ v, onDownload, sub }: { v: RpAgreementVersion; onDownload?: () => void; sub?: string }) {
  return (
    <div className="agr__doc">
      <span className="agr__docic" aria-hidden="true">
        <Icon name="file" size={20} />
      </span>
      <span className="agr__doct">
        <span className="agr__docname">{agreementName(v)}</span>
        <span className="agr__docsub">{sub ?? `${v.sentAt ? `Sent ${dayText(isoDay(v.sentAt))}` : 'Not sent'} · PDF · ${sizeText(v.size)}`}</span>
      </span>
      <Button
        variant="secondary"
        size="sm"
        iconLeft={<Icon name="download" size={16} />}
        onClick={() => {
          downloadFile(v.file);
          onDownload?.();
        }}
      >
        Download<span className="vh"> {agreementName(v)}</span>
      </Button>
    </div>
  );
}

/** Download · Sign · Upload, each done as the RP gets there. */
function Steps({ labels, done }: { labels: string[]; done: number }) {
  return (
    <ol className="agr__steps" aria-label="Steps">
      {labels.map((l, i) => {
        const st = i < done ? 'done' : i === done ? 'now' : 'next';
        return (
          <li key={l} className={`agr__step is-${st}`} aria-current={st === 'now' ? 'step' : undefined}>
            <span className="agr__stepdot" aria-hidden="true">
              {st === 'done' ? <Icon name="check" size={12} strokeWidth={2.6} /> : i + 1}
            </span>
            <span>{l}</span>
            {st === 'done' && <span className="vh">, done</span>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The RP's agreement to sign (Jovial, 2 Nov): on Home and Profile › Agreement, for the RP Admin. One compact card:
 * who has it and what to do; the agreement as a document row with Download; the three steps; one drop zone for the
 * signed copy and the date it was signed (today by default, never after today, never before GSP sent it); Send signed
 * copy. Once sent it says GSP is reviewing it, with Replace; sent back, it shows GSP's reason and asks again.
 * Signing and uploading is the only way an RP acknowledges an agreement.
 */
export function RpAgreementCard({ r, by }: { r: RecruitmentPartner; by: string }) {
  const v = openAgreement(r);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [on, setOn] = useState(todayIso());
  const [tried, setTried] = useState(false);
  const [replacing, setReplacing] = useState(false);
  if (!v) return null;
  const copy = rpCardCopy(r, v);
  const sent = v.sentAt ? isoDay(v.sentAt) : todayIso();
  const today = todayIso();
  const onErr = dateError(on, { what: 'date you signed it', required: true }) ?? (on > today ? 'Not after today.' : on < sent ? `Not before GSP sent it (${dayText(sent)}).` : null);
  const reviewing = v.status === 'Signed copy uploaded' && !replacing;
  const back = v.status === 'Sent back' ? returnOf(v) : null;
  const signed = signedOf(v);
  const done = reviewing ? 3 : file ? 2 : downloaded === v.id || v.status === 'Sent back' || replacing ? 1 : 0;
  const send = () => {
    setTried(true);
    if (!file || fileErr || onErr) return;
    uploadSignedCopy(r.id, v.id, { file: file.name, size: file.size, on }, by);
    setFile(null);
    setTried(false);
    setReplacing(false);
  };
  return (
    <section className="card agr" aria-labelledby={`agr-${v.id}`}>
      <header className="agr__head">
        <span className={`who who--${copy.chipTone}`}>{copy.chip}</span>
        <h2 id={`agr-${v.id}`} className="agr__title">
          {copy.title}
        </h2>
        <p className="agr__line">{copy.line}</p>
      </header>

      <DocRow v={v} onDownload={() => setDownloaded(v.id)} />
      <Steps labels={copy.steps} done={done} />

      {back && (
        <div className="agr__notice" role="alert">
          <Icon name="info" size={18} />
          <p>
            <strong>Sent back by GSP:</strong> {back.reason}
          </p>
        </div>
      )}

      {reviewing && signed ? (
        <div className="agr__doc agr__doc--sent">
          <span className="agr__docic" aria-hidden="true">
            <Icon name="check" size={18} />
          </span>
          <span className="agr__doct">
            <span className="agr__docname">{signed.file}</span>
            <span className="agr__docsub">
              Signed {dayText(signed.on)} · sent {dateTimeText(signed.at)} · {sizeText(signed.size)}
            </span>
          </span>
          <Button variant="secondary" size="sm" onClick={() => setReplacing(true)}>
            Replace
          </Button>
        </div>
      ) : (
        <div className="agr__upload">
          <Field id={`agr-file-${v.id}`} label="Signed copy" required error={(tried || fileErr) && (fileErr ?? (!file ? 'Choose the signed copy.' : null))}>
            <FileDrop
              id={`agr-file-${v.id}`}
              accept={acceptOf(SIGNED_FILE.types as FileKind[])}
              file={file ? `${file.name} · ${sizeText(file.size)}` : undefined}
              invalid={(tried || !!fileErr) && (!!fileErr || !file)}
              label="Drop the signed copy here, or"
              button="Choose a file"
              hint={`PDF, JPG or PNG, up to ${SIGNED_FILE.maxMb} MB`}
              onFiles={([f]) => {
                const bad = checkFile(f, SIGNED_FILE.types as FileKind[], SIGNED_FILE.maxMb);
                setFileErr(bad);
                setFile(bad ? null : { name: f.name, size: f.size });
              }}
              onRemove={() => (setFile(null), setFileErr(null))}
            />
          </Field>
          <div className="agr__date">
            <Field id={`agr-on-${v.id}`} label="Signed on" required error={tried ? onErr : null}>
              <DateInput id={`agr-on-${v.id}`} value={on} min={sent} max={today} invalid={tried && !!onErr} onChange={setOn} />
            </Field>
          </div>
        </div>
      )}

      {(copy.note || !reviewing) && (
        <footer className="agr__foot">
          {copy.note && <p className="agr__note">{copy.note}</p>}
          {!reviewing && (
            <div className="agr__acts">
              {replacing && (
                <Button variant="secondary" onClick={() => (setReplacing(false), setFile(null), setTried(false))}>
                  Cancel
                </Button>
              )}
              <Button disabled={!file || !on} onClick={send}>
                Send signed copy
              </Button>
            </div>
          )}
        </footer>
      )}
    </section>
  );
}

/**
 * Profile › Agreement (RP Admin only; Branch Manager and Counsellor don't see it): the active agreement to download,
 * the one to sign now (the same card as Home), and every version with its status.
 */
export function RpAgreementProfile({ r, by }: { r: RecruitmentPartner; by: string }) {
  const active = activeAgreement(r);
  const list = historyOf(r).filter((v) => v.sentAt);
  return (
    <section className="card pcard agrp" aria-labelledby="pagr-title">
      <div className="pcard__row">
        <div className="pcard__lead">
          <h2 id="pagr-title" className="pcard__title">
            Agreement
          </h2>
          <p className="pcard__text">{active ? `${agreementName(active)}, active from ${dayText(active.effectiveFrom ?? todayIso())}` : 'No agreement active yet'}</p>
        </div>
        {active ? <span className="pill pill--ok">{AGREEMENT_SHORT.Accepted}</span> : <span className="pill pill--you">Not active yet</span>}
      </div>
      {active && <DocRow v={active} sub={`Accepted ${dayText(isoDay(active.accepted!.at))} · PDF · ${sizeText(active.size)}`} />}
      <RpAgreementCard r={r} by={by} />
      {list.length > 0 && (
        <div className="agrp__hist">
          <h3 className="agrp__h">History</h3>
          <ul className="agrp__list">
            {list.map((v) => {
              const s = statusOf(r, v);
              const c = signedOf(v);
              return (
                <li key={v.id} className="agrp__item">
                  <span className="agrp__t">
                    <span className="agr__docname">{agreementName(v)}</span>
                    <span className="agr__docsub">
                      Sent {dayText(isoDay(v.sentAt!))}
                      {c ? ` · signed ${dayText(c.on)}` : ''}
                      {v.accepted ? ` · accepted ${dayText(isoDay(v.accepted.at))}` : ''}
                      {v.withdrawn ? ` · withdrawn ${dayText(isoDay(v.withdrawn.at))}` : ''}
                    </span>
                  </span>
                  <span className={`pill ${PILL[s]}`}>{s === 'Accepted' ? statusText(r, v).replace(/: active from/, ', from') : AGREEMENT_SHORT[s]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Earnings while no agreement is active (S2-11). */
export const HeldNote = ({ r }: { r: RecruitmentPartner }) =>
  commissionHeld(r) ? (
    <div className="page">
      <p className="card irsec" role="status">
        Your commission is held until GSP accepts your signed agreement. It’s paid once it does.
      </p>
    </div>
  ) : null;

/** A Suspended or Rejected RP: every user loses access and can't sign in (S2-12, S2C-9). */
export function AccountClosed({ r }: { r: RecruitmentPartner }) {
  return (
    <div className="page">
      <section className="card locked" role="alert">
        <h1 className="page__title">{r.status === 'Rejected' ? 'This partner account is closed.' : 'This partner account is suspended.'}</h1>
        <p>{r.status === 'Rejected' ? 'This partner account is closed. Contact your Recruitment contact at GSP.' : 'GSP has suspended this partner account: every user has lost access and can’t sign in until GSP reactivates it. Applications in progress carry on. Contact your Recruitment contact at GSP.'}</p>
        {r.bdm && <p>Recruitment contact: {r.bdm}</p>}
      </section>
    </div>
  );
}
