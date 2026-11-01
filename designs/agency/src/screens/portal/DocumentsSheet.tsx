import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import type { Contact } from '../../data/partners';
import type { SignupState } from '../signup/model';
import { DocSlotRow, Thumb, previews, slug, useDocUploads } from '../signup/Documents';
import { FILE_RULES, fmtSize, inSentence, returnedDocs, stillToReplace, type DocSlot } from '../signup/docs';
import { expectedBy, phaseOf, resend, sentDocs, whenLabel } from './model';

type SetState = (fn: (s: SignupState) => SignupState) => void;
const noop: SetState = () => undefined;
const extOf = (name: string) => (name.split('.').pop() ?? '').toUpperCase();

/** Each document's status in words, in the colour of who has it. */
function Status({ slot, optional }: { slot: DocSlot; optional?: boolean }) {
  switch (slot.status) {
    case 'checking':
      return <span className="pill pill--gsp">Verifying</span>;
    case 'accepted':
      return <span className="pill pill--ok">Verified</span>;
    case 'sent-back':
      return <span className="pill pill--bad">Not verified</span>;
    default:
      return <span className="pill pill--neutral">{optional ? 'Not sent' : 'Missing'}</span>;
  }
}

/**
 * What the partner sent GSP, file by file, and where each one is, in a dialog in the middle of the window
 * (from the bottom on phones).
 * While GSP verifies, it's read-only. When GSP sends documents back, each one shows GSP's note and takes a
 * new file here, and "Send to GSP again" (only once every sent-back document has a new file) starts verification again.
 */
export function DocumentsSheet({
  open,
  onClose,
  join,
  set,
  manager,
}: {
  open: boolean;
  onClose: () => void;
  join: SignupState;
  set?: SetState;
  manager: Contact | null;
}) {
  const f = join.form;
  const phase = phaseOf(join);
  const rows = sentDocs(join);
  // replacing: the documents GSP couldn't verify come first (and stay first once they have a new file), then the verified ones
  const rank = (slot: DocSlot) => (slot.reason ? 0 : slot.status === 'accepted' ? 1 : 2);
  const toFix = [...rows].sort((a, b) => rank(a.slot) - rank(b.slot));
  const needs = rows.map((r) => r.need);
  const back = returnedDocs(needs, join.docs);
  const left = stillToReplace(needs, join.docs);
  const uploading = rows.some((r) => r.slot.status === 'uploading');
  const one = back.length === 1;
  const who = manager?.name.split(' ')[0];
  const { onFile, clear } = useDocUploads(set ?? noop);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => setTried(false), [open, phase]);

  const sendAgain = () => {
    if (uploading || left.length) {
      setTried(true);
      const el = left[0] ? document.getElementById(`doc-${slug(left[0].name)}`) : null;
      el?.focus({ preventScroll: true });
      el?.closest('.dslot')?.scrollIntoView({ block: 'center' });
      return;
    }
    setSending(true);
    timer.current = window.setTimeout(() => {
      set?.(resend);
      setSending(false);
      // the button is gone once they're sent: focus goes to the sheet's close button, and the status says what happened
      document.querySelector<HTMLElement>('.sheet__close')?.focus();
    }, 1000);
  };

  const count = uploading
    ? 'Wait for the upload to finish.'
    : left.length === 0
      ? one
        ? 'The new file is ready to send.'
        : 'The new files are ready to send.'
      : tried || left.length === back.length
        ? `Upload a new ${left.map((d) => inSentence(d.name)).join(' and ')} to send ${left.length === 1 ? 'it' : 'them'} again.`
        : `${back.length - left.length} of ${back.length} replaced. Upload a new ${left.map((d) => inSentence(d.name)).join(' and ')}.`;

  const contactLine = manager && (
    <>
      {' '}
      Questions? {manager.phone ? <>Call {who} on <span className="num">{manager.phone}</span>.</> : <>Email {who} at {manager.email}.</>}
    </>
  );

  const footer =
    phase === 'sent-back' ? (
      <div className="sheet-send">
        <p className={`docs__count ${tried && (left.length || uploading) ? 'is-error' : left.length === 0 && !uploading ? 'is-ok' : ''}`} role="status">
          {left.length === 0 && !uploading && <Icon name="checkCircle" size={16} />}
          {count}
        </p>
        <Button block loading={sending} onClick={sendAgain} iconRight={<Icon name="arrowRight" size={18} />}>
          {sending ? 'Sending to GSP…' : 'Send to GSP again'}
        </Button>
      </div>
    ) : (
      <p className="sheet-note">
        <Icon name="info" size={16} />
        <span>
          {phase === 'verifying'
            ? 'You can’t change documents while GSP verifies them. If one needs replacing, GSP tells you here and by email, with the reason.'
            : 'Need to update a document later, like a renewed certificate? Ask your GSP contact.'}
          {contactLine}
        </span>
      </p>
    );

  return (
    <Sheet open={open} onClose={onClose} center title="Business documents" sub={`${f.biz} · ${f.country}`} footer={footer}>
      <div className={`dstatus ${phase === 'sent-back' ? 'is-you' : phase === 'verifying' ? 'is-gsp' : 'is-ok'}`} aria-live="polite">
        {phase === 'sent-back' ? (
          <>
            <span className="who who--you">Needs your attention</span>
            <p className="dstatus__title">{one ? 'GSP couldn’t verify 1 document' : `GSP couldn’t verify ${back.length} documents`}</p>
          </>
        ) : phase === 'verifying' ? (
          <>
            <span className="who who--gsp">With GSP</span>
            <p className="dstatus__title">GSP is verifying your documents</p>
            <p className="dstatus__text">
              {(join.rounds ?? 1) > 1 ? 'Sent again' : 'Sent'} {whenLabel(join.sentAt)}. Expect it by{' '}
              <span className="num">{expectedBy(join.sentAt, join.form.country)}</span>.
            </p>
          </>
        ) : (
          <>
            <span className="who who--ok">Verified</span>
            <p className="dstatus__title">GSP verified your documents</p>
            <p className="dstatus__text">Verified {whenLabel(join.verifiedAt)}. Students, applications and earnings are open.</p>
          </>
        )}
      </div>

      {phase === 'sent-back' ? (
        <>
          <p className="docs__rules sheet-rules" id="doc-rules">
            <Icon name="info" size={16} />
            <span>
              <strong>PDF, JPG or PNG, up to {FILE_RULES.maxMB} MB each.</strong> For photos, fit the whole page in the frame and keep the text sharp.
            </span>
          </p>
          <ul className="dslots" aria-label="Documents">
            {toFix.map(({ need, slot }) => (
              <DocSlotRow
                key={need.name}
                doc={need}
                slot={slot}
                preview={previews.get(need.name)}
                missing={tried && left.includes(need)}
                locked={sending}
                onFile={(file) => onFile(need, file)}
                onClear={() => clear(need)}
              />
            ))}
          </ul>
        </>
      ) : (
        <ul className="sdocs" aria-label="Documents">
          {rows.map(({ need, slot }) => {
            const file = slot.file;
            const preview = previews.get(need.name);
            return (
              <li key={need.name} className={`sdoc ${file ? '' : 'is-empty'}`}>
                <Thumb key={preview ?? 'none'} src={preview} />
                <div className="sdoc__text">
                  <p className="sdoc__name">{need.name}</p>
                  {file ? (
                    <>
                      <p className="sdoc__file">{file.name}</p>
                      <p className="sdoc__meta">
                        {extOf(file.name)} · {fmtSize(file.size)}
                      </p>
                    </>
                  ) : (
                    <p className="sdoc__meta">{need.optional ? `Optional. ${need.hint}.` : need.hint}</p>
                  )}
                </div>
                <Status slot={slot} optional={need.optional} />
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
