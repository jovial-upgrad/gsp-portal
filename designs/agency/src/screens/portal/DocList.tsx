import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from '../../components/Icon';
import type { DocNeed } from '../../data/partners';
import { Thumb, previews, slug } from '../signup/Documents';
import { FILE_RULES, fmtSize, inSentence, type DocSlot } from '../signup/docs';

const UPLOAD_MS = 1200;
const hasFile = (slot: DocSlot) => slot.status === 'uploading' || slot.status === 'uploaded';

/**
 * The business documents while registering (Nesil, 4 Nov: the old cards all looked alike, so it wasn't clear what
 * was still to upload, where, and what was done). Three groups, each said in words: **To upload** (each with its own
 * Upload button, the whole row a drop target), **Optional**, and **Uploaded** (the file, with Replace and Remove).
 * A bar and a count above say how many of the required ones are in. Documents move between groups as they're added.
 */
export function DocList({
  docs,
  slots,
  tried,
  missing,
  locked,
  onFile,
  onClear,
}: {
  docs: DocNeed[];
  slots: Record<string, DocSlot>;
  /** They tried to send with something missing. */
  tried: boolean;
  missing: DocNeed[];
  locked: boolean;
  onFile: (d: DocNeed, f: File) => void;
  onClear: (d: DocNeed) => void;
}) {
  const reduce = useReducedMotion();
  const slot = (d: DocNeed): DocSlot => slots[d.name] ?? { status: 'empty' };
  const todo = docs.filter((d) => !d.optional && !hasFile(slot(d)));
  const optional = docs.filter((d) => d.optional && !hasFile(slot(d)));
  const done = docs.filter((d) => hasFile(slot(d)));
  const required = docs.filter((d) => !d.optional);
  const inCount = required.length - missing.length;
  const layout = reduce ? {} : { layout: 'position' as const, transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const } };
  const row = (d: DocNeed) => (
    <motion.li key={d.name} {...layout}>
      {hasFile(slot(d)) ? (
        <DoneRow doc={d} slot={slot(d)} locked={locked} onFile={(f) => onFile(d, f)} onClear={() => onClear(d)} />
      ) : (
        <TodoRow doc={d} slot={slot(d)} missing={tried && missing.includes(d)} locked={locked} onFile={(f) => onFile(d, f)} />
      )}
    </motion.li>
  );

  return (
    <div className="dl">
      <div className="dl__top">
        <p className="dl__count">
          <strong className="num">
            {inCount} of {required.length}
          </strong>{' '}
          required documents uploaded
        </p>
        <span className="dl__bar" aria-hidden="true">
          {required.map((d, i) => (
            <span key={d.name} className={i < inCount ? 'is-on' : ''} />
          ))}
        </span>
        <p className="dl__rules" id="doc-rules">
          PDF, JPG or PNG, up to {FILE_RULES.maxMB} MB each. For photos, fit the whole page in the frame and keep the text sharp.
        </p>
      </div>
      <AnimatePresence initial={false}>
        {todo.length > 0 && (
          <motion.section key="todo" className="dl__group" aria-labelledby="dl-todo" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h4 id="dl-todo" className="dl__h">
              <Icon name="upload" size={16} /> To upload <span className="dl__n num">{todo.length}</span>
            </h4>
            <ul className="dl__list">{todo.map(row)}</ul>
          </motion.section>
        )}
      </AnimatePresence>
      {optional.length > 0 && (
        <section className="dl__group" aria-labelledby="dl-opt">
          <h4 id="dl-opt" className="dl__h">
            Optional <span className="dl__h-note">Upload only if it applies to you</span>
          </h4>
          <ul className="dl__list">{optional.map(row)}</ul>
        </section>
      )}
      <AnimatePresence initial={false}>
        {done.length > 0 && (
          <motion.section key="done" className="dl__group dl__group--done" aria-labelledby="dl-done" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h4 id="dl-done" className="dl__h">
              <Icon name="checkCircle" size={16} /> Uploaded <span className="dl__n num">{done.length}</span>
            </h4>
            <ul className="dl__list">{done.map(row)}</ul>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A document still to upload: what it is, its own Upload button, and the whole row takes a dropped file. */
function TodoRow({ doc, slot, missing, locked, onFile }: { doc: DocNeed; slot: DocSlot; missing: boolean; locked: boolean; onFile: (f: File) => void }) {
  const id = slug(doc.name);
  const [over, setOver] = useState(false);
  const error = slot.status === 'error' ? slot.error : missing ? 'Upload this document to continue.' : null;
  return (
    <div
      className={`ldoc ldoc--todo ${error ? 'is-invalid' : ''} ${over ? 'is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!locked) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f && !locked) onFile(f);
      }}
    >
      <span className="ldoc__mark" aria-hidden="true">
        <Icon name="doc" size={18} />
      </span>
      <div className="ldoc__text">
        <p className="ldoc__name">
          {doc.name}
          <span className={`ldoc__need ${doc.optional ? 'is-optional' : ''}`}>{doc.optional ? 'If registered' : 'Required'}</span>
        </p>
        <p className="ldoc__hint">{doc.hint}</p>
        {error && (
          <p id={`doc-${id}-err`} className="ldoc__err" role="alert">
            <Icon name="alert" size={15} />
            <span>{error}</span>
          </p>
        )}
      </div>
      <label htmlFor={`doc-${id}`} className={`btn btn--${doc.optional ? 'ghost' : 'secondary'} btn--sm ldoc__up ${locked ? 'is-disabled' : ''}`}>
        <Icon name="upload" size={16} />
        <span className="btn__label">Upload</span>
      </label>
      <FileInput id={id} doc={doc} locked={locked} error={!!error} onFile={onFile} />
      {over && (
        <span className="ldoc__drop" aria-hidden="true">
          Drop to upload your {inSentence(doc.name)}
        </span>
      )}
    </div>
  );
}

/** A document that's in (or on its way up): its file, then Replace and Remove. */
function DoneRow({ doc, slot, locked, onFile, onClear }: { doc: DocNeed; slot: DocSlot; locked: boolean; onFile: (f: File) => void; onClear: () => void }) {
  const id = slug(doc.name);
  const file = slot.file!;
  const up = slot.status === 'uploading';
  const preview = previews.get(doc.name);
  return (
    <div className={`ldoc ldoc--done ${up ? 'is-uploading' : ''}`}>
      <span className="ldoc__mark is-done" aria-hidden="true">
        {up ? <span className="ldoc__spin" /> : <Icon name="check" size={16} strokeWidth={2.6} />}
      </span>
      <div className="ldoc__text">
        <p className="ldoc__name">{doc.name}</p>
        <p className="ldoc__file">
          <Thumb key={preview ?? 'none'} src={preview} />
          <span className="ldoc__fname">{file.name}</span>
          <span className="ldoc__meta">
            {fmtSize(file.size)}
            {up ? ' · Uploading…' : ''}
          </span>
        </p>
        {up && (
          <span className="dfile__bar ldoc__bar" aria-hidden="true">
            <span style={{ animationDuration: `${UPLOAD_MS}ms` }} />
          </span>
        )}
      </div>
      <div className="ldoc__acts">
        {up ? (
          <button type="button" className="icon-btn" aria-label={`Cancel uploading ${file.name}`} onClick={onClear}>
            <Icon name="close" size={16} />
          </button>
        ) : (
          <>
            <label htmlFor={`doc-${id}`} className={`btn btn--link ldoc__replace ${locked ? 'is-disabled' : ''}`}>
              Replace<span className="vh"> {doc.name}</span>
            </label>
            <button type="button" className="icon-btn" aria-label={`Remove ${file.name}`} onClick={onClear} disabled={locked}>
              <Icon name="trash" size={16} />
            </button>
          </>
        )}
      </div>
      <FileInput id={id} doc={doc} locked={locked || up} error={false} onFile={onFile} />
    </div>
  );
}

function FileInput({ id, doc, locked, error, onFile }: { id: string; doc: DocNeed; locked: boolean; error: boolean; onFile: (f: File) => void }) {
  return (
    <input
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
  );
}
