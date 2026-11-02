import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Checkbox, Field, TextInput } from '../../components/forms';
import { SelectMenu, type MenuOption } from '../../components/SelectMenu';
import { CLOSE_AT, REUPLOAD_AT, STAGES, STATUS, STATUS_ORDER, destOf, phaseOf, stageOf, statusText, type Application, type EndKind, type StatusKey } from '../../data/applications';
import { REF_FORMAT_ERROR, mandatoryUpload, refClash, refClashError, refFormat } from '../../data/appRules';
import { UPLOAD, sizeText, uploadError } from '../../data/uploads';
import type { Student } from '../../data/students';

/**
 * Where the application goes: a status (with what it needs: the university reference or No reference ID, GSP's
 * mandatory upload, who lodges the visa), or closed at a stage with a reason.
 */
export type StatusPick = { k: StatusKey; visaBy?: 'you' | 'gsp'; ref?: string; noRef?: boolean; upload?: { name: string; file: string } } | { end: EndKind; stage: number };

/**
 * Change status (slice 3 PRD, Moving and What Change status offers). Stage first, then the status: every status of
 * that stage except Waiting for documents and Document re-upload pending (a reject is the only way there, S3-25),
 * then that stage's close reasons. Any stage can be picked, forward or back. Then what the new status needs:
 * - **Submitted to university**: the university reference ID, or a tick on No reference ID; the reference can't be on
 *   another application at the same university (S3-22).
 * - **A status that needs a GSP document** (S3-9): the conditional offer letter, the unconditional offer letter, the
 *   Acceptance letter (S3-23), the visa grant when GSP lodged the visa; uploaded first, it goes to Documents by GSP.
 * - **Visa lodgement pending**: who lodges the visa, the RP or GSP (no default).
 * Additional documents requested and Tuition or deposit pending keep the plain popup and send nothing (S3-24).
 * **Change status** stays off until the status differs from the current one and what it needs is done. Closing
 * asks for the confirm. The RP never sees Change.
 */
export function StatusDialog({ open, a, all = [], students = [], onCancel, onConfirm }: { open: boolean; a: Application; /** Every application, for the reference check. */ all?: Application[]; students?: Student[]; onCancel: () => void; onConfirm: (to: StatusPick) => void }) {
  const d = destOf(a);
  const [stage, setStage] = useState<number>(stageOf(a));
  const [k, setK] = useState<string>(a.status);
  const [closing, setClosing] = useState<{ end: EndKind; stage: number } | null>(null);
  const [visaBy, setVisaBy] = useState<'you' | 'gsp' | ''>('');
  const [ref, setRef] = useState('');
  const [noRef, setNoRef] = useState(false);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileErr, setFileErr] = useState('');
  const [left, setLeft] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!open) return;
    setStage(stageOf(a));
    setK(a.status);
    setClosing(null);
    setVisaBy('');
    setRef('');
    setNoRef(false);
    setFile(null);
    setFileErr('');
    setLeft({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const reupload = new Set(REUPLOAD_AT.filter(Boolean));
  const stages: MenuOption[] = STAGES.map((st, i) => ({ value: String(i), label: `${i + 1}. ${st}`, note: i === stageOf(a) ? 'Now' : undefined }));
  const statuses: MenuOption[] = [
    ...STATUS_ORDER.filter((x) => STATUS[x].stage === stage && x !== 'docs' && !reupload.has(x)).map((x) => ({ value: x, label: STATUS[x].text(d), note: x === a.status ? 'Now' : undefined, group: phaseOf(x) })),
    ...CLOSE_AT[stage].map((kind) => ({ value: `end:${stage}:${kind}`, label: kind, group: 'Close the application' })),
  ];
  const isEnd = k.startsWith('end:');
  const key = (isEnd ? '' : k) as StatusKey | '';
  // what the status needs
  const lodgeBy = (a.visaBy ?? 'you') as 'you' | 'gsp';
  const doc = key ? mandatoryUpload(key, key === 'startdate' ? lodgeBy : undefined) : undefined;
  const refText = ref.trim().toUpperCase();
  const clash = key === 'lodged' && !noRef && refFormat(refText) ? refClash(all, a, refText) : undefined;
  const refErr = key !== 'lodged' || noRef ? null : !refText ? 'Enter the university reference ID, or tick No reference ID.' : !refFormat(refText) ? REF_FORMAT_ERROR : clash ? refClashError(clash, students) : null;
  const docErr = doc && !file ? `Upload the ${doc.charAt(0).toLowerCase()}${doc.slice(1)} to change the status.` : null;
  const visaErr = key === 'visa' && !visaBy ? 'Pick who lodges the visa.' : null;
  const statusErr = !k ? 'Pick a status.' : null;
  const differs = !!k && k !== a.status;
  const ready = differs && !refErr && !docErr && !visaErr;
  const go = () => {
    if (!ready) return;
    const [, at, kind] = k.split(':');
    if (isEnd) setClosing({ end: kind as EndKind, stage: Number(at) });
    else onConfirm({ k: key as StatusKey, ...(key === 'visa' ? { visaBy: visaBy as 'you' | 'gsp' } : {}), ...(key === 'lodged' ? (noRef ? { noRef: true } : { ref: refText }) : {}), ...(doc && file ? { upload: { name: doc, file: file.name } } : {}) });
  };
  const leave = (f: string) => () => setLeft((l) => ({ ...l, [f]: true }));
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
              <Button onClick={go} disabled={!ready}>
                Change status
              </Button>
            </div>
          </div>
        }
      >
        <div className="gstat__form">
          <Field id="gstat-stage" label="Stage" required>
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
              }}
            />
          </Field>
          <Field id="gstat-status" label="Status" required error={left.status ? statusErr : null}>
            <SelectMenu id="gstat-status" label={`Statuses at ${STAGES[stage]}`} value={k} options={statuses} placeholder="Pick a status" invalid={!!left.status && !!statusErr} describedBy={left.status && statusErr ? 'gstat-status-error' : undefined} onChange={(v) => (setK(v), setLeft((l) => ({ ...l, status: true })))} />
          </Field>

          {key === 'lodged' && (
            <div className="gstat__extra">
              <Field id="gstat-ref" label="University reference ID" required={!noRef} error={left.ref ? refErr : null} hint="3 to 30 letters, digits, / _ -. Saved in upper case.">
                <TextInput id="gstat-ref" value={ref} disabled={noRef} placeholder="For example LEE-2027-118342" maxLength={30} invalid={!!left.ref && !!refErr} onBlur={leave('ref')} onChange={(e) => setRef(e.target.value)} />
              </Field>
              <Checkbox id="gstat-noref" checked={noRef} onChange={(v) => (setNoRef(v), setLeft((l) => ({ ...l, ref: true })))} hint="Tick when the university gives none. Add it later from Key details.">
                No reference ID
              </Checkbox>
            </div>
          )}

          {doc && (
            <div className="gstat__extra">
              <p className="field__label" id="gstat-doc-label">
                {doc}
                <span className="field__req" aria-hidden="true">
                  {' '}*
                </span>
              </p>
              {file ? (
                <div className="gstat__file">
                  <Icon name="file" size={18} />
                  <span className="gstat__fname">
                    {file.name}
                    <span className="gstat__hint"> · {sizeText(file.size)} · uploaded just now</span>
                  </span>
                  <label className="btn btn--ghost btn--sm" htmlFor="gstat-file">
                    Replace
                  </label>
                </div>
              ) : (
                <label className={`btn btn--secondary btn--sm gstat__pick ${left.doc && docErr ? 'is-invalid' : ''}`} htmlFor="gstat-file">
                  <Icon name="upload" size={16} /> Upload the {doc.charAt(0).toLowerCase() + doc.slice(1)}
                </label>
              )}
              <input
                id="gstat-file"
                className="vh"
                type="file"
                accept={UPLOAD.accept}
                aria-labelledby="gstat-doc-label"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  setLeft((l) => ({ ...l, doc: true }));
                  if (!f) return;
                  const err = uploadError(f);
                  setFileErr(err);
                  if (!err) setFile({ name: f.name, size: f.size });
                }}
              />
              <p className="gstat__hint">Mandatory for this status ({UPLOAD.short}). Added to Documents by GSP; the RP sees it.</p>
              {(fileErr || (left.doc && docErr)) && (
                <p className="gstat__err" role="alert">
                  {fileErr || docErr}
                </p>
              )}
            </div>
          )}

          {key === 'conditions' && (
            <p className="gstat__info">
              <Icon name="info" size={16} />
              <span>This doesn’t send the offer’s conditions. Send them from the chat with Request conditions; until then the application is On GSP.</span>
            </p>
          )}
          {(key === 'moreinfo' || key === 'deposit') && (
            <p className="gstat__info">
              <Icon name="info" size={16} />
              <span>This doesn’t send a request. Ask the RP for {key === 'deposit' ? 'the payment proof' : 'what the university needs'} with Request a document or in the chat; the application is On RP while that request is open.</span>
            </p>
          )}
          {key === 'startdate' && lodgeBy === 'you' && (
            <p className="gstat__info">
              <Icon name="info" size={16} />
              <span>The RP lodged the visa, so there’s no upload here. Ask the RP for the visa grant with Request a document.</span>
            </p>
          )}

          {key === 'visa' && (
            <fieldset className="gstat__who">
              <legend>
                Who lodges the visa? <span className="field__req" aria-hidden="true">*</span>
              </legend>
              {(
                [
                  ['you', 'The RP', 'The RP lodges it: the visa lodgement proof is requested from the RP, under the officer’s name.'],
                  ['gsp', 'GSP', 'GSP lodges it on the RP’s behalf: the application stays On GSP.'],
                ] as const
              ).map(([v, l, h]) => (
                <div key={v} className="check check--radio">
                  <input id={`gstat-visa-${v}`} type="radio" name="gstat-visa" className="check__input" checked={visaBy === v} onChange={() => setVisaBy(v)} />
                  <label htmlFor={`gstat-visa-${v}`} className="check__label">
                    <span className="check__box" aria-hidden="true" />
                    <span>
                      {l}
                      <span className="check__hint">{h}</span>
                    </span>
                  </label>
                </div>
              ))}
              {left.visa && visaErr && <p className="gstat__err">{visaErr}</p>}
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
            It closes as {closing.end}, at {STAGES[closing.stage]}. GSP and the RP both see it closed and read-only, and what’s still asked for goes.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
