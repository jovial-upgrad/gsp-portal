import { useEffect, useState, type DragEvent } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Checkbox, Field, TextInput } from '../../components/forms';
import { SelectMenu, type MenuOption } from '../../components/SelectMenu';
import { CLOSE_AT, ENROL_DOC, ENROL_DOC_LONG, STAGES, STATUS, STATUS_ORDER, courseOf, destOf, stageOf, statusText, type Application, type EndKind, type StatusKey } from '../../data/applications';
import type { Destination } from '../../data/courses';
import './applications.css';

/**
 * Where the application goes: a status, or closed at a stage, and how. A status can bring what it needs with it
 * (4 Nov): the university's reference (or that there's none), the letter that came (an offer letter, the
 * acceptance letter, the visa grant), and who lodges the visa.
 */
export type StatusPick =
  | { k: StatusKey; ref?: string; noRef?: boolean; letter?: { name: string; file: string }; visaBy?: 'you' | 'gsp' }
  | { end: EndKind; stage: number };

/** The acceptance letter, with the destination's own name where it has a short one: "Acceptance letter (CoE)". */
const acceptName = (d: Destination) => (['CoE', 'CAS', 'I-20', 'LOA'].includes(ENROL_DOC[d]) ? `Acceptance letter (${ENROL_DOC[d]})` : 'Acceptance letter');
/** The letter a status needs uploaded with it: its name in the field, and in Documents. The visa grant only when GSP lodged the visa. */
export function letterFor(k: StatusKey, a: Application): { label: string; name: string } | undefined {
  const d = destOf(a);
  if (k === 'conditions') return { label: 'Conditional offer letter', name: 'Conditional offer letter' };
  if (k === 'uol') return { label: 'Unconditional offer letter', name: 'Unconditional offer letter' };
  if (k === 'acceptrec') return { label: acceptName(d), name: ENROL_DOC_LONG[d] };
  if (k === 'startdate' && a.visaBy === 'gsp') return { label: 'Visa grant letter', name: 'Visa grant letter' };
  return undefined;
}

const REF = /^[A-Za-z0-9][A-Za-z0-9/_-]{2,29}$/;
const MAX_MB = 20;
const TYPES = /\.(pdf|jpe?g|png)$/i;
const sizeText = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Changing the status by hand: GSP's team moves every status but the first (New to Pre-screening happens when
 * the RP sends the documents). Two fields (Nesil, 28 Oct): the **stage**, then the **status** within it (its
 * statuses, then how it can close: not eligible, rejected, declined, refused, withdrawn, deferred). Both drop
 * down from the field and start at where the application is now. No remarks; the change goes into Logs (4 Nov: Activity is Logs).
 * Closing asks first. The ways to close are listed under "Close the application", in grey, without "Closed:" (4 Nov).
 *
 * Some statuses ask for more in the same pop-up (Nesil, 4 Nov): Submitted to university, the university
 * reference ID (or No reference ID); the conditional and unconditional offer letters and Acceptance letter
 * received, the letter (PDF, JPG or PNG, up to 20 MB), which goes into Documents; Visa lodgement pending, who
 * lodges the visa (the RP unless GSP is picked); Visa granted, the visa grant, when GSP lodged it.
 */
export function StatusDialog({ open, a, onCancel, onConfirm }: { open: boolean; a: Application; onCancel: () => void; onConfirm: (to: StatusPick) => void }) {
  const d = destOf(a);
  const c = courseOf(a);
  const [stage, setStage] = useState<number>(stageOf(a));
  const [k, setK] = useState<string>(a.status);
  const [tried, setTried] = useState(false);
  const [closing, setClosing] = useState<{ end: EndKind; stage: number } | null>(null);
  const [ref, setRef] = useState('');
  const [noRef, setNoRef] = useState(false);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [bad, setBad] = useState('');
  const [visaBy, setVisaBy] = useState<'you' | 'gsp'>('you');
  useEffect(() => {
    if (!open) return;
    setStage(stageOf(a));
    setK(a.status);
    setTried(false);
    setClosing(null);
    setRef(a.uniRef ?? '');
    setNoRef(false);
    setFile(null);
    setBad('');
    setVisaBy(a.visaBy ?? 'you');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const stages: MenuOption[] = STAGES.map((st, i) => ({ value: String(i), label: `${i + 1}. ${st}`, note: i === stageOf(a) ? 'Now' : undefined }));
  const statuses: MenuOption[] = [
    ...STATUS_ORDER.filter((x) => STATUS[x].stage === stage).map((x) => ({ value: x, label: STATUS[x].text(d), note: x === a.status ? 'Now' : undefined })),
    ...CLOSE_AT[stage].map((kind) => ({ value: `end:${stage}:${kind}`, label: kind, group: 'Close the application', tone: 'end' as const })),
  ];
  const picked = k && !k.startsWith('end:') && k in STATUS ? (k as StatusKey) : undefined;
  const letter = picked ? letterFor(picked, a) : undefined;
  const okStatus = !!k && k !== a.status;
  const clean = ref.trim().toUpperCase();
  const refErr = picked === 'lodged' && !noRef ? (!clean ? 'Add the university reference ID, or tick No reference ID.' : !REF.test(clean) ? 'Use 3 to 30 letters, numbers or dashes, as the university wrote it.' : '') : '';
  const fileErr = letter && !file ? bad || `Upload the ${letter.label.replace(/^[A-Z](?=[a-z])/, (x) => x.toLowerCase())}.` : bad;
  const go = () => {
    setTried(true);
    if (!okStatus) return;
    const [, at, kind] = k.split(':');
    if (k.startsWith('end:')) return setClosing({ end: kind as EndKind, stage: Number(at) });
    if (refErr || (letter && fileErr)) return;
    const to = k as StatusKey;
    onConfirm({
      k: to,
      ...(to === 'lodged' ? (noRef ? { noRef: true } : { ref: clean }) : {}),
      ...(letter && file ? { letter: { name: letter.name, file: file.name } } : {}),
      ...(to === 'visa' ? { visaBy } : {}),
    });
  };
  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!TYPES.test(f.name)) return setBad(`${f.name} can’t be used. Upload a PDF, JPG or PNG.`);
    if (f.size > MAX_MB * 1048576) return setBad(`${f.name} is ${sizeText(f.size)}. Upload one up to ${MAX_MB} MB.`);
    setBad('');
    setFile({ name: f.name, size: f.size });
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
            <p className="asf__note">The change goes into Logs.</p>
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

          {picked === 'lodged' && okStatus && (
            <div className="gstat__more">
              <Field id="gstat-ref" label="University reference ID" required={!noRef} error={tried && refErr ? refErr : null}>
                <TextInput
                  id="gstat-ref"
                  className="gsub__mono"
                  value={noRef ? '' : ref}
                  disabled={noRef}
                  placeholder={noRef ? 'No reference ID' : `Like ${c.uni.id.slice(0, 3).toUpperCase()}-2611407`}
                  invalid={tried && !!refErr}
                  aria-describedby={tried && refErr ? 'gstat-ref-error' : undefined}
                  onChange={(e) => setRef(e.target.value)}
                />
              </Field>
              <Checkbox id="gstat-noref" checked={noRef} onChange={setNoRef}>
                No reference ID
              </Checkbox>
            </div>
          )}

          {picked === 'visa' && okStatus && (
            <div className="field gstat__more">
              <p className="field__label" id="gstat-lodger-l">
                Who lodges the visa?
                <span className="field__req" aria-hidden="true">
                  *
                </span>
                <span className="vh"> (required)</span>
              </p>
              <div className="radios" role="radiogroup" aria-labelledby="gstat-lodger-l">
                {(
                  [
                    ['you', 'The RP'],
                    ['gsp', 'GSP'],
                  ] as const
                ).map(([v, l]) => (
                  <label key={v} className="radio">
                    <input type="radio" name="gstat-lodger" value={v} checked={visaBy === v} onChange={() => setVisaBy(v)} />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {letter && okStatus && (
            <div className="gstat__more">
              <LetterField id="gstat-letter" label={letter.label} file={file} error={tried || bad ? fileErr : ''} onFile={pickFile} onRemove={() => setFile(null)} />
            </div>
          )}
        </div>
      </Sheet>
      <ConfirmDialog
        open={!!closing}
        title={`Close ${a.id}?`}
        confirm="Close application"
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

/** A letter to upload with the status: a drop zone until a file is in, then the file with Replace and Remove. */
function LetterField({ id, label, file, error, onFile, onRemove }: { id: string; label: string; file: { name: string; size: number } | null; error?: string; onFile: (f: File | null) => void; onRemove: () => void }) {
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFile(e.dataTransfer.files?.[0] ?? null);
  };
  const picker = (
    <input
      id={id}
      className="vh"
      type="file"
      accept=".pdf,.jpg,.jpeg,.png"
      aria-describedby={error ? `${id}-error` : undefined}
      onChange={(e) => {
        onFile(e.target.files?.[0] ?? null);
        e.target.value = '';
      }}
    />
  );
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        <span className="field__req" aria-hidden="true">
          *
        </span>
        <span className="vh"> (required)</span>
      </label>
      {file ? (
        <div className="mfile gstat__file">
          <span className="mfile__ic" aria-hidden="true">
            <Icon name="file" size={18} />
          </span>
          <div className="mfile__t">
            <p className="mfile__name">
              <span className="mfile__file">{file.name}</span>
              <span className="mfile__size">{sizeText(file.size)}</span>
            </p>
          </div>
          <span className="mfile__acts">
            <label className="btn btn--secondary btn--sm" htmlFor={id}>
              Replace
            </label>
            <button type="button" className="mfile__x" aria-label={`Remove ${file.name}`} onClick={onRemove}>
              <Icon name="close" size={16} />
            </button>
            {picker}
          </span>
        </div>
      ) : (
        <label
          className={`mdrop ${over ? 'is-over' : ''} ${error ? 'is-bad' : ''}`}
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <span className="mdrop__ic" aria-hidden="true">
            <Icon name="upload" size={20} />
          </span>
          <span className="mdrop__t">
            <span className="mdrop__main">
              Drop the file here, or <span className="mdrop__link">browse</span>
            </span>
            <span className="mdrop__sub">PDF, JPG or PNG · up to {MAX_MB} MB</span>
          </span>
          {picker}
        </label>
      )}
      {error && (
        <p className="field__msg field__msg--error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
