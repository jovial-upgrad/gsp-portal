import { useRef, type DragEvent } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';

/** Once a part of the profile was filled in from its document: the file itself is kept in Documents. */
export function ReadNote({ text }: { text: string }) {
  return (
    <p className="rfrom">
      <Icon name="checkCircle" size={16} />
      <span>{text}</span>
    </p>
  );
}

/** How long reading a document takes in this prototype; quicker with reduced motion. */
export const readMs = (reduce: boolean | null) => (reduce ? 300 : 1100);

/**
 * Upload a document and the details are read from it (OCR in the real product). Before: what it fills in.
 * While reading: progress. After: the file, where it was saved, and a reminder to check what was read.
 * A file can also be dropped on the box.
 */
export function ReadBox({
  id,
  title,
  text,
  button,
  file,
  reading,
  readTitle = 'Details read',
  readText = 'Check the highlighted fields: they can be edited.',
  savedAs,
  onFile,
  onRemove,
  compact = false,
  docLabel,
}: {
  id: string;
  title: string;
  text: string;
  button: string;
  file?: string | null;
  reading: boolean;
  readTitle?: string;
  readText?: string;
  /** Where the file went, like "Saved in Documents as Passport". */
  savedAs?: string;
  onFile: (f: File) => void;
  onRemove?: () => void;
  compact?: boolean;
  /** Its name as a read-only field, like "Passport copy": a saved section shows "Not added" under it when there's no file. */
  docLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };
  return (
    <div className={`auto ${file ? 'has-file' : ''} ${compact ? 'auto--compact' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      {docLabel && (
        <span className="auto__none">
          <span className="field__label">{docLabel}</span>
          <span className="auto__none-v">Not added</span>
        </span>
      )}
      <span className="auto__icon" aria-hidden="true">
        <Icon name={file && !reading ? 'checkCircle' : 'upload'} size={compact ? 20 : 22} />
      </span>
      <div className="auto__t" aria-live="polite">
        {reading ? (
          <>
            <p className="auto__title">Reading {file ? `“${file}”` : 'the document'}…</p>
            <span className="auto__bar" aria-hidden="true">
              <span />
            </span>
          </>
        ) : file ? (
          <>
            <p className="auto__title">{readTitle}</p>
            <p className="auto__text">{readText}</p>
            <p className="auto__file">
              <Icon name="file" size={14} />
              <span>
                {file}
                {savedAs ? ` · ${savedAs}` : ''}
              </span>
            </p>
          </>
        ) : (
          <>
            <p className="auto__title">{title}</p>
            <p className="auto__text">{text}</p>
          </>
        )}
      </div>
      <input
        ref={ref}
        id={id}
        type="file"
        accept="image/*,.pdf"
        className="vh"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      {file && !reading ? (
        onRemove ? (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => ref.current?.click()}>
            Replace
          </Button>
        )
      ) : (
        <Button variant="secondary" size="sm" disabled={reading} onClick={() => ref.current?.click()}>
          {button}
        </Button>
      )}
    </div>
  );
}
