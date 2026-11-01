import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field } from '../../components/forms';
import { SelectMenu, type MenuOption } from '../../components/SelectMenu';
import { CLOSE_AT, STAGES, STATUS, STATUS_ORDER, destOf, stageOf, statusText, type Application, type EndKind, type StatusKey } from '../../data/applications';

/** Where the application goes: a status, or closed at a stage, and how. */
export type StatusPick = { k: StatusKey; visaBy?: 'you' | 'gsp' } | { end: EndKind; stage: number };

/**
 * Changing the status by hand: GSP's team moves every status but the first (New to Pre-screening happens when
 * the RP sends the documents). Two fields (Nesil, 28 Oct): the **stage**, then the **status** within it (its
 * statuses, then how it can close: not eligible, rejected, declined, refused, withdrawn, deferred). Both drop
 * down from the field and start at where the application is now. No remarks; the change goes into Activity.
 * Closing asks first.
 */
export function StatusDialog({ open, a, onCancel, onConfirm }: { open: boolean; a: Application; onCancel: () => void; onConfirm: (to: StatusPick) => void }) {
  const d = destOf(a);
  const [stage, setStage] = useState<number>(stageOf(a));
  const [k, setK] = useState<string>(a.status);
  const [tried, setTried] = useState(false);
  const [closing, setClosing] = useState<{ end: EndKind; stage: number } | null>(null);
  // Jovial, 1 Nov: only stage and status, and who lodges the visa when it moves to Visa lodgement pending
  const [visaBy, setVisaBy] = useState<'you' | 'gsp'>(a.visaBy ?? 'you');
  useEffect(() => {
    if (!open) return;
    setStage(stageOf(a));
    setK(a.status);
    setTried(false);
    setClosing(null);
    setVisaBy(a.visaBy ?? 'you');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const stages: MenuOption[] = STAGES.map((st, i) => ({ value: String(i), label: `${i + 1}. ${st}`, note: i === stageOf(a) ? 'Now' : undefined }));
  const statuses: MenuOption[] = [
    ...STATUS_ORDER.filter((x) => STATUS[x].stage === stage).map((x) => ({ value: x, label: STATUS[x].text(d), note: x === a.status ? 'Now' : undefined })),
    ...CLOSE_AT[stage].map((kind) => ({ value: `end:${stage}:${kind}`, label: `Closed: ${kind}`, group: 'Close the application' })),
  ];
  const okStatus = !!k && k !== a.status;
  const go = () => {
    setTried(true);
    if (!okStatus) return;
    const [, at, kind] = k.split(':');
    if (k.startsWith('end:')) setClosing({ end: kind as EndKind, stage: Number(at) });
    else onConfirm({ k: k as StatusKey, ...(k === 'visa' ? { visaBy } : {}) });
  };
  return (
    <>
      <Sheet
        open={open}
        onClose={onCancel}
        center
        className="gstat"
        title="Change status"
        sub={`Now: ${statusText(a)}, at ${STAGES[stageOf(a)]}.`}
        footer={
          <div className="asf">
            <p className="asf__note">The change goes into Activity.</p>
            <div className="asf__acts">
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={go}>Change status</Button>
            </div>
          </div>
        }
      >
        <div className="gstat__form">
          <Field id="gstat-stage" label="Stage">
            <SelectMenu
              id="gstat-stage"
              label="Stages"
              value={String(stage)}
              options={stages}
              onChange={(v) => {
                const to = Number(v);
                setStage(to);
                // back on the stage it's at, the status is the one it has; on another, pick one
                setK(to === stageOf(a) ? a.status : '');
                setTried(false);
              }}
            />
          </Field>
          <Field id="gstat-status" label="Status" error={tried && !okStatus ? (k === a.status ? 'That’s the status it’s at now. Pick another.' : 'Pick a status.') : null}>
            <SelectMenu
              id="gstat-status"
              label={`Statuses at ${STAGES[stage]}`}
              value={k}
              options={statuses}
              placeholder="Pick a status"
              invalid={tried && !okStatus}
              describedBy={tried && !okStatus ? 'gstat-status-error' : undefined}
              onChange={(v) => {
                setK(v);
                setTried(false);
              }}
            />
          </Field>
          {k === 'visa' && (
            <fieldset className="gstat__who">
              <legend>Who lodges the visa?</legend>
              {(
                [
                  ['you', 'The RP', 'The RP lodges it and uploads the lodgement proof.'],
                  ['gsp', 'GSP', 'GSP lodges it on the RP’s behalf: the application stays with GSP.'],
                ] as const
              ).map(([v, l, h]) => (
                <label key={v} className="gstat__radio">
                  <input type="radio" name="gstat-visa" value={v} checked={visaBy === v} onChange={() => setVisaBy(v)} />
                  <span>
                    {l}
                    <small>{h}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </Sheet>
      <ConfirmDialog
        open={!!closing}
        title={`Close ${a.id}?`}
        confirm="Close application"
        danger
        onCancel={() => setClosing(null)}
        onConfirm={() => {
          if (closing) onConfirm(closing);
          setClosing(null);
        }}
      >
        {closing && (
          <p>
            It closes as <strong>{closing.end.toLowerCase()}</strong>, at {STAGES[closing.stage]}. GSP and the RP both see it closed, and what’s still asked for goes.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
