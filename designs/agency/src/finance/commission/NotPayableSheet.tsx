import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Field, SelectInput, TextInput } from '../../components/forms';
import type { Tx } from './engine';
import { money } from './model';

/**
 * Mark not payable (Jovial, 17 Nov, the Finance demo): Finance takes a line out by hand, the university having said the
 * student didn't pay or isn't commissionable, say. The reasons come from Commission Settings; the last one (Other) asks
 * for Finance's own words. Logged; the line says why.
 */
export function NotPayableSheet({ t, reasons, onClose, onDone }: { t: Tx | null; reasons: string[]; onClose: () => void; onDone: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [words, setWords] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setReason('');
    setWords('');
    setTried(false);
  }, [t]);
  if (!t) return null;
  const other = !!reason && reason === reasons[reasons.length - 1];
  const err = { reason: !reason ? 'Choose the reason.' : null, words: other && !words.trim() ? 'Say why, in a few words.' : null };
  const go = () => {
    setTried(true);
    if (err.reason || err.words) return;
    onDone(other ? `${reason}: ${words.trim()}` : reason);
  };
  return (
    <Sheet
      open
      onClose={onClose}
      center
      className="iform"
      title={`Mark ${t.id} not payable`}
      sub={`${t.student} · ${money(t.amount, t.currency)}. It counts toward nothing, can’t be invoiced or requested, and says why. You can lift it later.`}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={go}>Mark not payable</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="cnp-why" label="Why" required error={tried ? err.reason : null}>
          <SelectInput id="cnp-why" value={reason} placeholder="Choose the reason" invalid={tried && !!err.reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectInput>
        </Field>
        {other && (
          <Field id="cnp-words" label="In a few words" required error={tried ? err.words : null} className="iform__wide">
            <TextInput id="cnp-words" value={words} invalid={tried && !!err.words} onChange={(e) => setWords(e.target.value)} />
          </Field>
        )}
      </div>
    </Sheet>
  );
}
