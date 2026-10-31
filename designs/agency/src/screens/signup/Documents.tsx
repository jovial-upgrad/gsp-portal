import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { DocNeed } from '../../data/partners';
import { FILE_RULES, RULES_SHORT, checkFile, fmtSize, type DocSlot } from './docs';
import type { SignupState } from './model';

type SetState = (fn: (s: SignupState) => SignupState) => void;
const UPLOAD_MS = 1200;
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * Photo thumbnails for the session, shared by the upload and "sent" screens. They're small data: images drawn
 * on a canvas, not blob: URLs, because sandboxed previews and strict content policies refuse blob: images.
 */
export const previews = new Map<string, string>();

async function thumbnailOf(file: File): Promise<string | null> {
  try {
    const dataUrl = await new Promise<string>((done, fail) => {
      const r = new FileReader();
      r.onload = () => done(String(r.result));
      r.onerror = () => fail(r.error);
      r.readAsDataURL(file);
    });
    const img = new Image();
    await new Promise((done, fail) => {
      img.onload = done;
      img.onerror = fail;
      img.src = dataUrl;
    });
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    try {
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
      return dataUrl; // a canvas the browser won't export: the full image still works as a thumbnail
    }
  } catch {
    return null; // unreadable image: the row shows the document icon
  }
}

/** A file's thumbnail, or the document icon when there's no photo (or it won't load). */
export function Thumb({ src }: { src?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="dfile__thumb" aria-hidden="true">
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : <Icon name="doc" size={18} />}
    </span>
  );
}

/**
 * Choosing, checking and "uploading" files into document slots, shared by registration and the portal.
 * A slot GSP sent back keeps GSP's reason while it's replaced, so removing the new file brings the reason back.
 */
export function useDocUploads(set: SetState) {
  const timers = useRef(new Map<string, number>());
  const uploads = useRef(new Map<string, number>()); // latest upload per slot, so a late thumbnail can't land on a newer file
  const [, thumbReady] = useState(0);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const patch = (name: string, slot: DocSlot) =>
    set((p) => ({ ...p, docs: { ...p.docs, [name]: { ...slot, reason: p.docs[name]?.reason } } }));

  const drop = (name: string) => {
    window.clearTimeout(timers.current.get(name));
    uploads.current.set(name, (uploads.current.get(name) ?? 0) + 1);
    previews.delete(name);
  };

  const onFile = (doc: DocNeed, file: File) => {
    const meta = { name: file.name, size: file.size, type: file.type };
    const error = checkFile(meta);
    drop(doc.name);
    if (error) return patch(doc.name, { status: 'error', error });
    if (file.type.startsWith('image/')) {
      const id = uploads.current.get(doc.name);
      thumbnailOf(file).then((url) => {
        if (!url || uploads.current.get(doc.name) !== id) return;
        previews.set(doc.name, url);
        thumbReady((n) => n + 1);
      });
    }
    patch(doc.name, { status: 'uploading', file: meta });
    timers.current.set(
      doc.name,
      window.setTimeout(() => patch(doc.name, { status: 'uploaded', file: meta }), UPLOAD_MS),
    );
  };
  const clear = (doc: DocNeed) => {
    drop(doc.name);
    set((p) => {
      const reason = p.docs[doc.name]?.reason;
      return { ...p, docs: { ...p.docs, [doc.name]: reason ? { status: 'sent-back', reason } : { status: 'empty' } } };
    });
  };
  return { onFile, clear };
}

/** One document: what it is, then a drop zone, the file on its way up, the file in place, or GSP's verdict. */
export function DocSlotRow({
  doc,
  slot,
  preview,
  missing,
  locked,
  onFile,
  onClear,
}: {
  doc: DocNeed;
  slot: DocSlot;
  preview?: string;
  missing: boolean;
  locked: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const id = slug(doc.name);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { status, file } = slot;
  // "missing" only speaks for a slot that's actually empty (or sent back), never one that's uploading
  const error =
    status === 'error'
      ? slot.error
      : missing && status === 'sent-back'
        ? 'Upload a new file to replace this one.'
        : missing && status === 'empty'
          ? 'Upload this document to continue.'
          : null;
  const zone = status === 'empty' || status === 'error' || status === 'sent-back';
  const pick = () => input.current?.click();

  return (
    <li className={`dslot dslot--${status} ${error ? 'is-invalid' : ''}`}>
      <div className="dslot__head">
        <div className="dslot__text">
          <p className="dslot__name">{doc.name}</p>
          <p className="dslot__hint">{doc.hint}</p>
        </div>
        {/* a document GSP sent back says so until its new file has gone to GSP */}
        {slot.reason && status !== 'uploaded' && status !== 'uploading' ? (
          <span className="pill pill--bad">Not verified</span>
        ) : slot.reason ? (
          <span className="dslot__need is-new">New file</span>
        ) : (
          <span className={`dslot__need ${doc.optional ? 'is-optional' : ''}`}>{doc.optional ? 'If registered' : 'Required'}</span>
        )}
      </div>

      {(status === 'sent-back' || status === 'error') && slot.reason && (
        <p className="dslot__reason">
          <Icon name="alert" size={16} />
          <span>
            <strong>Why it wasn’t verified</strong>
            {slot.reason}
          </span>
        </p>
      )}

      {file && !zone && (
        <div className="dfile">
          <Thumb key={preview ?? 'none'} src={preview} />
          <span className="dfile__text">
            <span className="dfile__name">{file.name}</span>
            <span className="dfile__meta">
              {fmtSize(file.size)}
              {status === 'uploading' && ' · Uploading…'}
              {status === 'uploaded' && ' '}
              {status === 'uploaded' && (
                <span className="dfile__ok">
                  <Icon name="check" size={14} strokeWidth={2.4} />
                  Uploaded
                </span>
              )}
            </span>
            {status === 'uploading' && (
              <span className="dfile__bar" aria-hidden="true">
                <span style={{ animationDuration: `${UPLOAD_MS}ms` }} />
              </span>
            )}
          </span>
          <span className="dfile__end">
            {status === 'uploading' && (
              <button type="button" className="icon-btn" aria-label={`Cancel uploading ${file.name}`} onClick={onClear}>
                <Icon name="close" size={16} />
              </button>
            )}
            {status === 'uploaded' && (
              <>
                <button type="button" className="btn btn--link dfile__replace" onClick={pick} disabled={locked}>
                  Replace
                </button>
                <button type="button" className="icon-btn" aria-label={`Remove ${file.name}`} onClick={onClear} disabled={locked}>
                  <Icon name="close" size={16} />
                </button>
              </>
            )}
            {status === 'checking' && <span className="who who--gsp">Verifying</span>}
            {status === 'accepted' && <span className="pill pill--ok">Verified</span>}
          </span>
        </div>
      )}

      {zone && (
        <label
          htmlFor={`doc-${id}`}
          className={`dzone ${over ? 'is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped && !locked) onFile(dropped);
          }}
        >
          <span className="dzone__icon" aria-hidden="true">
            <Icon name="upload" size={18} />
          </span>
          <span className="dzone__text">
            <span>
              <span className="dzone__cta">{status === 'sent-back' ? 'Choose a new file' : 'Choose a file'}</span> or drop it here
            </span>
            <span className="dzone__rule">{RULES_SHORT}</span>
          </span>
        </label>
      )}

      <input
        ref={input}
        id={`doc-${id}`}
        type="file"
        className="vh"
        accept={FILE_RULES.accept}
        disabled={locked}
        aria-label={`Choose a file for ${doc.name}`}
        aria-describedby={error ? `doc-${id}-err` : 'doc-rules'}
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          if (chosen) onFile(chosen);
          e.target.value = ''; // so choosing the same file again still counts
        }}
      />
      {error && (
        <p id={`doc-${id}-err`} className="field__msg field__msg--error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
    </li>
  );
}
