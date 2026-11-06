import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useOnChange } from '../../institution/records/parts';
import { fmtSize } from '../../screens/signup/docs';
import type { FileMeta } from './data';

/** RP Ops' record pages: its recruitment partners and its Master Partners. */
export type OpsSection = 'rps' | 'mps';
/** A record to open, on which tab, and where its back link goes when it isn't its own list. */
export type OpsTarget = { section: OpsSection; id: string; tab?: string; back?: OpsTarget & { label: string } };
export type OpsFocus = OpsTarget & { key: number };

/** Which record a list page has open (as GSP · Institution's pages work): set when another page opens one, cleared by the menu. */
export function useOpsRecord(focus: OpsFocus | null, navKey: number, scrollTop: () => void, open: (t: OpsTarget) => void) {
  type Cur = Omit<OpsTarget, 'section'>;
  const [cur, setCur] = useState<Cur | null>(focus ? { id: focus.id, tab: focus.tab, back: focus.back } : null);
  const seen = useRef(focus?.key);
  useEffect(() => {
    if (!focus || focus.key === seen.current) return;
    seen.current = focus.key;
    setCur({ id: focus.id, tab: focus.tab, back: focus.back });
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useOnChange(navKey, () => setCur(null));
  return {
    cur,
    show: (id: string, tab?: string) => {
      setCur({ id, tab });
      scrollTop();
    },
    back: () => {
      if (cur?.back) open(cur.back);
      else {
        setCur(null);
        scrollTop();
      }
    },
  };
}

/** A list page's title and its actions on the right, as GSP · Institution's PageHead, with no line under the title (Nesil, 4 Nov, later). */
export function OpsHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="stu__head ihead ops-head">
      <div className="stu__titles">
        <h1 className="page__title">{title}</h1>
      </div>
      {children && <div className="apps__acts ihead__acts">{children}</div>}
    </header>
  );
}

/** A pop-up's buttons: Cancel, then the actions, on the right (as in every GSP pop-up). */
export function Foot({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="asf">
      <div className="asf__acts">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {children}
      </div>
    </div>
  );
}

/** Drop a file or choose one; once in, its name and size with Replace. `accept` and `kinds` say what it takes. */
export function FileDrop({
  id,
  file,
  onFile,
  error,
  invalid,
  label,
  kinds,
  accept,
  test,
  maxMB = 20,
}: {
  id: string;
  file: FileMeta | null;
  onFile: (f: FileMeta) => void;
  error: (msg: string | null) => void;
  invalid?: boolean;
  label: string;
  kinds: string;
  accept: string;
  test: (f: File) => boolean;
  maxMB?: number;
}) {
  const [over, setOver] = useState(false);
  const take = (f: File) => {
    if (!test(f)) return error(`“${f.name}” can’t be used here. Upload a ${kinds} file.`);
    if (f.size > maxMB * 1024 * 1024) return error(`“${f.name}” is ${fmtSize(f.size)}. Upload one under ${maxMB} MB.`);
    error(null);
    onFile({ name: f.name, size: f.size });
  };
  return (
    <>
      <input
        id={id}
        type="file"
        className="vh ops-filein"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) take(f);
          e.target.value = '';
        }}
      />
      {file ? (
        <div className="ops-file">
          <span className="ops-file__icon" aria-hidden="true">
            <Icon name="file" size={18} />
          </span>
          <span className="ops-file__t">
            <span className="ops-strong">{file.name}</span>
            <span className="muted num">{fmtSize(file.size)}</span>
          </span>
          <label htmlFor={id} className="btn btn--secondary btn--sm">
            Replace
          </label>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`ops-drop ${over ? 'is-over' : ''} ${invalid ? 'is-invalid' : ''}`}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) take(f);
          }}
        >
          <span className="ops-drop__icon" aria-hidden="true">
            <Icon name="upload" size={20} />
          </span>
          <span className="ops-drop__t">
            <span className="ops-strong">{label}</span>
            <span className="muted">
              {kinds}, up to {maxMB} MB
            </span>
          </span>
          <span className="btn btn--secondary btn--sm" aria-hidden="true">
            Choose file
          </span>
        </label>
      )}
    </>
  );
}
