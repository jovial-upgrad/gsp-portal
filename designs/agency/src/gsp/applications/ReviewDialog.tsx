import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { shortDate } from '../../data/dates';
import type { Application } from '../../data/applications';
import type { Student } from '../../data/students';
import { downloadDoc, Paper } from '../../components/DocView';
import { sendBackReasons, toReview, type Review } from './review';

const MAX = 240;
export const whereFrom = (r: Review, s: Student) =>
  r.on === 'profile' ? `on ${s.first}’s profile` : r.via === 'profile' ? `from ${s.first}’s profile, for this application` : r.via === 'request' ? 'sent for a request' : r.via === 'chat' ? 'shared in the chat' : 'uploaded to this application';

/**
 * One of the RP's documents, opened from Documents: a preview of the file, and the decision. Accept marks it verified; Reject asks why (a reason to start from, then a line in GSP's words)
 * and sends it back to the RP to upload again. Previous and Next (or the arrow keys) move through the list it was
 * opened from; after a decision it moves on to the next one still to review (Nesil, 28 Oct).
 */
export function ReviewDialog({
  r,
  a,
  s,
  rejecting,
  onClose,
  onAccept,
  onReject,
  pos,
  onStep,
}: {
  r: Review | null;
  a: Application;
  s: Student;
  /** Opens straight on the reason (Reject from the list). */
  rejecting: boolean;
  onClose: () => void;
  onAccept: (r: Review) => void;
  onReject: (r: Review, reason: string) => void;
  /** Where it is in the list it was opened from. */
  pos?: { i: number; n: number };
  onStep?: (by: -1 | 1) => void;
}) {
  // the last document stays while the dialog animates out
  const [shown, setShown] = useState<Review | null>(r);
  const [mode, setMode] = useState<'view' | 'reject'>(rejecting ? 'reject' : 'view');
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!r) return;
    setShown(r);
    setMode(rejecting ? 'reject' : 'view');
    setReason('');
    setTried(false);
  }, [r?.key, r?.file, rejecting]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode === 'reject') window.setTimeout(() => area.current?.focus(), 80);
  }, [mode]);
  if (!shown) return null;
  const d = shown;
  const open = toReview(d, a);
  const ok = reason.trim().length >= 5;
  const send = () => {
    setTried(true);
    if (ok) onReject(d, reason.trim());
  };
  const pick = (x: string) => {
    setReason((v) => (v.trim() ? v : `${x}. `));
    window.setTimeout(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  };

  const steps = mode === 'view' && !!pos && pos.n > 1 && !!onStep;
  // the arrow keys move through the list, unless a field has the keys
  const onKey = (e: React.KeyboardEvent) => {
    if (!steps || (e.target as HTMLElement).closest('input, textarea, select, [role="combobox"]')) return;
    if (e.key === 'ArrowLeft' && pos!.i > 0) onStep!(-1);
    else if (e.key === 'ArrowRight' && pos!.i < pos!.n - 1) onStep!(1);
  };

  return (
    <Sheet
      open={!!r}
      onClose={onClose}
      center
      className="grev"
      title={mode === 'reject' ? `Send back the ${d.name.toLowerCase()}?` : d.name}
      sub={
        <>
          <span className="grev__file">{d.file}</span> · {whereFrom(d, s)}
          {d.at ? `, ${shortDate(new Date(d.at))}` : ''}
        </>
      }
      footer={
        mode === 'reject' ? (
          <div className="asf">
            <p className="asf__note">The RP is asked to upload it again, with your reason.</p>
            <div className="asf__acts">
              <Button variant="secondary" onClick={() => (rejecting ? onClose() : setMode('view'))}>
                {rejecting ? 'Cancel' : 'Back'}
              </Button>
              <Button onClick={send} iconRight={<Icon name="arrowRight" size={18} />}>
                Send back to RP
              </Button>
            </div>
          </div>
        ) : open ? (
          <div className="asf">
            <p className="asf__note">Accepting marks it verified{d.on === 'profile' ? `, on ${s.first}’s profile too` : ''}.</p>
            <div className="asf__acts">
              <Button variant="secondary" iconLeft={<Icon name="close" size={16} />} onClick={() => setMode('reject')}>
                Reject
              </Button>
              <Button iconLeft={<Icon name="check" size={16} strokeWidth={2.4} />} onClick={() => onAccept(d)}>
                Accept
              </Button>
            </div>
          </div>
        ) : (
          <div className="asf">
            <p className="asf__note">{d.back ? 'Sent back: with the RP to upload again.' : d.status === 'verified' ? 'Verified.' : 'Not sent to GSP yet.'}</p>
            <div className="asf__acts">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )
      }
    >
      {mode === 'reject' ? (
        <div className="grev__why">
          <p className="grev__k" id="grev-chips">
            Start from a reason
          </p>
          <div className="grev__chips" role="group" aria-labelledby="grev-chips">
            {sendBackReasons().map((x) => (
              <button key={x} type="button" className="gchip" onClick={() => pick(x)}>
                <span className="gchip__in">{x}</span>
              </button>
            ))}
          </div>
          <label className="grev__k" htmlFor="grev-reason">
            Why it’s going back
          </label>
          <div className={`control gstat__area ${tried && !ok ? 'is-invalid' : ''}`}>
            <textarea
              ref={area}
              id="grev-reason"
              className="control__input"
              rows={4}
              maxLength={MAX}
              value={reason}
              placeholder="Like: pages 3 and 4 are missing. Upload all four pages as one file."
              aria-invalid={(tried && !ok) || undefined}
              aria-describedby="grev-hint"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <p id="grev-hint" className={`grev__hint ${tried && !ok ? 'is-bad' : ''}`} role={tried && !ok ? 'alert' : undefined}>
            {tried && !ok ? 'Say why, so the RP knows what to fix.' : `${reason.length} of ${MAX}. The RP sees this in Documents and the chat.`}
          </p>
        </div>
      ) : (
        <div className="grev__body" onKeyDown={onKey}>
          <div className="grev__bar">
            <Button variant="secondary" size="sm" iconLeft={<Icon name="download" size={16} />} onClick={() => downloadDoc(d, s)}>
              Download
            </Button>
            {steps && (
              <span className="grev__steps">
                <button type="button" className="grev__step" aria-label="Previous document" disabled={pos!.i === 0} onClick={() => onStep!(-1)}>
                  <Icon name="arrowLeft" size={16} />
                </button>
                <span className="grev__pos num" aria-live="polite">
                  {pos!.i + 1} of {pos!.n}
                </span>
                <button type="button" className="grev__step" aria-label="Next document" disabled={pos!.i === pos!.n - 1} onClick={() => onStep!(1)}>
                  <Icon name="arrowRight" size={16} />
                </button>
              </span>
            )}
          </div>
          <Paper d={d} s={s} />
        </div>
      )}
    </Sheet>
  );
}
