import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import './filedrop.css';

/**
 * The portal's upload (Jovial, 2 Nov: nothing of the browser's file control shows): a drop zone with a "Choose
 * file" button styled as the portal's Button. Drop a file on it or press the button; the browser's own picker opens
 * from a hidden input underneath. Once a file is in, the zone shows its name with Replace and Remove.
 */
export function FileDrop({
  id,
  accept,
  multiple = false,
  file,
  onFiles,
  onRemove,
  hint,
  invalid,
  describedBy,
  disabled,
  label = 'Drag a file here, or',
  button = 'Choose file',
}: {
  id: string;
  accept?: string;
  multiple?: boolean;
  /** The file that's in (its name), if any. */
  file?: string;
  onFiles: (files: File[]) => void;
  onRemove?: () => void;
  hint?: ReactNode;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  label?: ReactNode;
  button?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (l: FileList | null | undefined) => {
    const files = [...(l ?? [])];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files);
  };
  const choose = () => input.current?.click();
  return (
    <div
      className={`fdrop ${over ? 'is-over' : ''} ${invalid ? 'is-invalid' : ''} ${file ? 'has-file' : ''} ${disabled ? 'is-disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <span className="fdrop__ic" aria-hidden="true">
        <Icon name={file ? 'file' : 'upload'} size={20} />
      </span>
      <span className="fdrop__t">
        {file ? <span className="fdrop__name">{file}</span> : <span className="fdrop__main">{label}</span>}
        {hint && <span className="fdrop__sub">{hint}</span>}
      </span>
      <span className="fdrop__acts">
        <Button id={id} variant="secondary" size="sm" disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={describedBy} onClick={choose}>
          {file ? 'Replace' : button}
        </Button>
        {file && onRemove && (
          <Button variant="ghost" size="sm" disabled={disabled} aria-label={`Remove ${file}`} onClick={onRemove}>
            Remove
          </Button>
        )}
      </span>
      <input
        ref={input}
        type="file"
        className="vh"
        tabIndex={-1}
        aria-hidden="true"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
