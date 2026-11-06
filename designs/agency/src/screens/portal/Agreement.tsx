import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, TextInput } from '../../components/forms';
import { downloadDoc } from '../../components/DocView';
import type { Agreement, SignupState } from '../signup/model';
import { FILE_RULES, checkFile, fmtSize } from '../signup/docs';
import { AGREEMENT, agreementOf, expectedBy, whenLabel } from './model';

type SetState = (fn: (s: SignupState) => SignupState) => void;
const ease = [0.2, 0.8, 0.2, 1] as const;
const UPLOAD_MS = 1200;
const isoToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
/** "4 Nov 2026" */
export const dayText = (iso?: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * The partner agreement on Home (Nesil, 4 Nov), under the "verified" strip once GSP has verified the business.
 * **With you**: three steps, in order: download it (with a preview), sign it (the owner, every page where it's
 * marked), upload the signed copy with the date it was signed, then send it. **With GSP**: the copy sent and when
 * to expect an answer. **Sent back**: GSP's reason and the same steps again. Accepted, it becomes a strip, and
 * Earnings opens.
 */
export function AgreementCard({ join, set, onPreview }: { join: SignupState; set: SetState; onPreview: () => void }) {
  const reduce = useReducedMotion();
  const phase = agreementOf(join);
  const a: Agreement = join.agreement ?? { status: 'to-sign' };
  const back = phase === 'sent-back';
  const sending = a.status === 'sending';
  const [tried, setTried] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const up = (patch: Partial<Agreement>) => set((p) => ({ ...p, agreement: { ...(p.agreement ?? { status: 'to-sign' }), ...patch } }));
  // the copy being uploaded; after a send-back, the one sent stays on record until the new one goes
  const draft = a.draft;
  const hasNew = !!draft;

  const onFile = (file: File) => {
    const meta = { name: file.name, size: file.size, type: file.type };
    const error = checkFile(meta);
    if (error) return up({ fileError: error, draft: undefined, uploading: false });
    // the date it was signed starts as today, to change if it was signed earlier
    up({ uploading: true, fileError: null, draft: meta, ...(a.signedOn && !back ? {} : { signedOn: isoToday() }) });
    timers.current.push(window.setTimeout(() => up({ uploading: false }), UPLOAD_MS));
  };
  const remove = () => up({ draft: undefined, uploading: false, fileError: null });

  const dateError = !a.signedOn ? 'Enter the date it was signed.' : a.signedOn > isoToday() ? 'The date it was signed can’t be in the future.' : null;
  const fileMissing = !hasNew || a.uploading;
  const send = () => {
    if (sending) return;
    if (fileMissing || dateError) {
      setTried(true);
      document.getElementById(fileMissing ? 'agr-file' : 'agr-date')?.focus({ preventScroll: true });
      return;
    }
    up({ status: 'sending' });
    timers.current.push(
      window.setTimeout(() => {
        set((p) => ({ ...p, agreement: { ...p.agreement!, status: 'with-gsp', file: p.agreement?.draft, draft: undefined, sentAt: Date.now(), reason: undefined, rounds: (p.agreement?.rounds ?? 0) + 1 } }));
        setTried(false);
      }, 1000),
    );
  };
  const download = () => {
    downloadDoc({ name: AGREEMENT.title, file: AGREEMENT.file });
    up({ downloaded: true });
  };

  const rise = reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease, delay: 0.1 } };

  if (phase === 'with-gsp') {
    return (
      <motion.section className="card agr agr--gsp" aria-labelledby="agr-title" {...rise}>
        <div className="agr__head">
          <span className="who who--gsp">With GSP</span>
          <h2 id="agr-title" className="agr__title">
            GSP is checking your signed agreement
          </h2>
          <p className="agr__text">
            Sent {whenLabel(a.sentAt)}. GSP usually checks it within 1 working day, so expect it by <strong className="num">{expectedBy(a.sentAt)}</strong>.
            Earnings opens once it’s accepted.
          </p>
        </div>
        {a.file && <SignedFile a={a} pill={<span className="pill pill--gsp">Checking</span>} />}
      </motion.section>
    );
  }

  const step1 = !!a.downloaded || back;
  const step3 = hasNew && !a.uploading && !dateError;
  return (
    <motion.section className={`card agr ${back ? 'agr--back' : ''}`} aria-labelledby="agr-title" {...rise}>
      <div className="agr__head">
        <span className="who who--you">{back ? 'Needs your attention' : 'With you'}</span>
        <h2 id="agr-title" className="agr__title">
          {back ? 'Your signed agreement wasn’t accepted' : 'Sign your partner agreement'}
        </h2>
        <p className="agr__text">
          {back
            ? 'Sign it again where GSP says, then upload the new signed copy. Earnings opens once GSP accepts it.'
            : 'Download it, sign it, then upload the signed copy. GSP checks it, and Earnings opens once it’s accepted.'}
        </p>
        {back && a.reason && (
          <p className="agr__why">
            <Icon name="alert" size={16} />
            <span>
              <strong>Why it wasn’t accepted</strong>
              {a.reason}
            </span>
          </p>
        )}
      </div>

      <ol className="agr__steps">
        <li className={`agr__step ${step1 ? 'is-done' : 'is-now'}`}>
          <span className="agr__num" aria-hidden="true">
            {step1 ? <Icon name="check" size={14} strokeWidth={2.8} /> : '1'}
          </span>
          <div className="agr__body">
            <p className="agr__step-t">Download the agreement</p>
            <div className="agr__doc">
              <span className="agr__doc-icon" aria-hidden="true">
                <Icon name="doc" size={20} />
              </span>
              <span className="agr__doc-text">
                <span className="agr__doc-name">
                  {AGREEMENT.title} · {AGREEMENT.version}
                </span>
                <span className="agr__doc-meta">
                  Sent {whenLabel(join.verifiedAt)} · PDF · {fmtSize(AGREEMENT.size)}
                </span>
              </span>
              <span className="agr__doc-acts">
                <Button variant="ghost" size="sm" iconLeft={<Icon name="eye" size={16} />} onClick={onPreview}>
                  Preview
                </Button>
                <Button variant="secondary" size="sm" iconLeft={<Icon name="download" size={16} />} onClick={download}>
                  Download
                </Button>
              </span>
            </div>
          </div>
        </li>
        <li className={`agr__step ${hasNew ? 'is-done' : step1 ? 'is-now' : ''}`}>
          <span className="agr__num" aria-hidden="true">
            {hasNew ? <Icon name="check" size={14} strokeWidth={2.8} /> : '2'}
          </span>
          <div className="agr__body">
            <p className="agr__step-t">{back ? 'Sign it again' : 'Sign it'}</p>
            <p className="agr__step-d">The owner signs every page where it’s marked, with their full name and the date. Print and scan it, or sign it digitally.</p>
          </div>
        </li>
        <li className={`agr__step ${step3 ? 'is-done' : step1 ? 'is-now' : ''}`}>
          <span className="agr__num" aria-hidden="true">
            {step3 ? <Icon name="check" size={14} strokeWidth={2.8} /> : '3'}
          </span>
          <div className="agr__body">
            <p className="agr__step-t">Upload the signed copy</p>
            {draft ? (
              <div className={`agr__up is-in ${a.uploading ? 'is-uploading' : ''}`}>
                <span className="agr__doc-icon is-ok" aria-hidden="true">
                  {a.uploading ? <span className="ldoc__spin" /> : <Icon name="check" size={16} strokeWidth={2.6} />}
                </span>
                <span className="agr__doc-text">
                  <span className="agr__doc-name">{draft.name}</span>
                  <span className="agr__doc-meta">
                    {fmtSize(draft.size)}
                    {a.uploading ? ' · Uploading…' : ' · Uploaded'}
                  </span>
                </span>
                <span className="agr__doc-acts">
                  {!a.uploading && (
                    <label htmlFor="agr-file" className="btn btn--link agr__replace">
                      Replace
                    </label>
                  )}
                  <button type="button" className="icon-btn" aria-label={a.uploading ? 'Cancel the upload' : `Remove ${draft.name}`} onClick={remove} disabled={sending}>
                    <Icon name={a.uploading ? 'close' : 'trash'} size={16} />
                  </button>
                </span>
              </div>
            ) : (
              <label
                htmlFor="agr-file"
                className={`agr__up agr__zone ${over ? 'is-over' : ''} ${(tried && fileMissing) || a.fileError ? 'is-invalid' : ''}`}
                onDragOver={(e) => (e.preventDefault(), setOver(true))}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) onFile(f);
                }}
              >
                <span className="agr__doc-icon" aria-hidden="true">
                  <Icon name="upload" size={18} />
                </span>
                <span className="agr__doc-text">
                  <span className="agr__doc-name">Drop the signed copy here, or choose a file</span>
                  <span className="agr__doc-meta">The whole agreement, every page. PDF, JPG or PNG, up to {FILE_RULES.maxMB} MB.</span>
                </span>
                <span className="btn btn--secondary btn--sm agr__choose" aria-hidden="true">
                  Choose a file
                </span>
              </label>
            )}
            <input
              ref={input}
              id="agr-file"
              type="file"
              className="vh"
              accept={FILE_RULES.accept}
              disabled={sending}
              aria-label="Choose the signed copy of the agreement"
              aria-describedby={(tried && fileMissing) || a.fileError ? 'agr-file-err' : undefined}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = '';
              }}
            />
            {(a.fileError || (tried && fileMissing && !a.uploading)) && (
              <p id="agr-file-err" className="ldoc__err" role="alert">
                <Icon name="alert" size={15} />
                <span>{a.fileError ?? 'Upload the signed copy to send it.'}</span>
              </p>
            )}
            <div className="agr__date">
              <Field id="agr-date" label="Signed on" required error={tried ? dateError : null}>
                <TextInput id="agr-date" type="date" value={a.signedOn ?? ''} max={isoToday()} invalid={tried && !!dateError} onChange={(e) => up({ signedOn: e.target.value })} />
              </Field>
            </div>
          </div>
        </li>
      </ol>

      <div className="agr__foot">
        <Button loading={sending} onClick={send} iconRight={<Icon name="arrowRight" size={18} />}>
          {sending ? 'Sending to GSP…' : back ? 'Send it again' : 'Send signed copy'}
        </Button>
      </div>
      {back && a.file && (
        <div className="agr__old">
          <p className="agr__old-k">You sent</p>
          <SignedFile a={a} pill={<span className="pill pill--bad">Not accepted</span>} />
        </div>
      )}
    </motion.section>
  );
}

function SignedFile({ a, pill }: { a: Agreement; pill: React.ReactNode }) {
  return (
    <div className="agr__doc agr__signed">
      <span className="agr__doc-icon" aria-hidden="true">
        <Icon name="doc" size={20} />
      </span>
      <span className="agr__doc-text">
        <span className="agr__doc-name">{a.file!.name}</span>
        <span className="agr__doc-meta">
          Signed on {dayText(a.signedOn)} · {fmtSize(a.file!.size)}
        </span>
      </span>
      {pill}
    </div>
  );
}

/**
 * A strip, once something's done (Nesil, 4 Nov): the business verified, or the agreement accepted. One line with
 * its action, and it can be put away.
 */
export function DoneStrip({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  return (
    <AnimatePresence initial={false}>
      {!hidden && (
        <motion.section
          className="okstrip"
          aria-label={title}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.28, ease }}
        >
          <span className="okstrip__mark" aria-hidden="true">
            <motion.svg viewBox="0 0 24 24" width="16" height="16">
              <motion.path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease, delay: 0.25 }} />
            </motion.svg>
          </span>
          <p className="okstrip__text">
            <strong>{title}</strong> <span>{text}</span>
          </p>
          <button type="button" className="btn btn--link okstrip__go" onClick={onAction}>
            {action}
          </button>
          <button type="button" className="icon-btn okstrip__close" aria-label={`Hide: ${title}`} onClick={() => setHidden(true)}>
            <Icon name="close" size={16} />
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
