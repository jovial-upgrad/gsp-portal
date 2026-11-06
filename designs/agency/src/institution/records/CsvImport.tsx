import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { downloadCsv } from './parts';

/** Reads a CSV file's text into rows of cells: quoted cells can hold commas, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

/** Matches names however they're typed: case, spaces and curly or straight apostrophes. */
export const same = (a: string, b: string) => a.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/** What a file gave: the rows to apply, how many stay as they are, and each row that couldn't be read, with why. `bad` when it isn't the template's shape. */
export type CsvRead<R> = { ok: R[]; same?: number; problems: string[]; bad?: boolean };
/** A file that can't be read (4 Nov, Nesil's words). */
export const INVALID = 'Invalid format, upload again.';

/**
 * Uploading a CSV (3 Nov): download the template, fill it in, choose the file. What it read shows before anything
 * changes: how many rows apply, and each row that couldn't be read, with why. Save applies them.
 */
export function CsvImport<R>({
  open,
  title,
  sub,
  template,
  columns,
  read,
  saveLabel,
  readyText,
  onCancel,
  onSave,
}: {
  open: boolean;
  title: string;
  sub?: ReactNode;
  /** The template's file name and rows, its headings first. */
  template: { name: string; rows: (string | number)[][] };
  /** What each column takes, shown under the template. */
  columns: ReactNode;
  read: (rows: string[][]) => CsvRead<R>;
  /** "Update 4 rankings", from how many rows apply. */
  saveLabel: (n: number) => string;
  /** "4 rankings change.", once the file is read. */
  readyText: (n: number) => string;
  onCancel: () => void;
  onSave: (rows: R[]) => void;
}) {
  const [file, setFile] = useState<{ name: string; got: CsvRead<R> } | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setBad(null);
  }, [open]);

  // 4 Nov: a file that isn't a CSV, is empty, or isn't the template's shape can't be read
  const take = (f: File | undefined) => {
    if (!f) return;
    const fail = () => (setFile(null), setBad(INVALID));
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') return fail();
    const r = new FileReader();
    r.onload = () => {
      const rows = parseCsv(String(r.result ?? ''));
      if (rows.length < 2) return fail();
      const got = read(rows);
      if (got.bad) return fail();
      setBad(null);
      setFile({ name: f.name, got });
    };
    r.onerror = fail;
    r.readAsText(f);
  };
  const n = file?.got.ok.length ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform icsv"
      title={title}
      sub={sub}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={!n} onClick={() => file && onSave(file.got.ok)}>
              {n ? saveLabel(n) : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      <ol className="icsv__steps">
        <li className="icsv__step">
          <div className="icsv__k">
            <span className="icsv__n num" aria-hidden="true">
              1
            </span>
            <h3 className="icsv__t">Download the template</h3>
          </div>
          <div className="icsv__tpl">
            <span className="ifile">
              <Icon name="file" size={18} />
              <span className="ifile__t">{template.name}</span>
            </span>
            <Button variant="secondary" size="sm" iconLeft={<Icon name="download" size={16} />} onClick={() => downloadCsv(template.name, template.rows)}>
              Download template
            </Button>
          </div>
          <div className="icsv__cols">{columns}</div>
        </li>
        <li className="icsv__step">
          <div className="icsv__k">
            <span className="icsv__n num" aria-hidden="true">
              2
            </span>
            <h3 className="icsv__t">Upload the filled-in file</h3>
          </div>
          <button
            type="button"
            className={`idrop ${over ? 'is-over' : ''} ${bad ? 'is-invalid' : ''}`}
            onClick={() => pick.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setOver(true))}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              take(e.dataTransfer.files?.[0]);
            }}
          >
            <Icon name={file ? 'file' : 'upload'} size={20} />
            <span className="idrop__t">{file ? file.name : 'Choose a CSV file, or drop it here'}</span>
            {file && <span className="idrop__s">Choose another</span>}
          </button>
          <input
            ref={pick}
            type="file"
            accept=".csv,text/csv"
            className="vh"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="icsv-input"
            onChange={(e) => {
              take(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {bad && (
            <p className="field__msg field__msg--error" role="alert">
              <Icon name="alert" size={16} />
              <span>{bad}</span>
            </p>
          )}
          {file && (
            <div className="icsv__got" role="status">
              <p className={`icsv__sum ${n ? 'is-ok' : ''}`}>
                <Icon name={n ? 'checkCircle' : 'info'} size={18} />
                <span>
                  {n ? readyText(n) : 'Nothing to change.'}
                  {file.got.same ? ` ${file.got.same} already as they are.` : ''}
                  {file.got.problems.length ? ` ${file.got.problems.length} ${file.got.problems.length === 1 ? 'row was' : 'rows were'} left out:` : ''}
                </span>
              </p>
              {file.got.problems.length > 0 && (
                <ul className="icsv__probs">
                  {file.got.problems.slice(0, 8).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                  {file.got.problems.length > 8 && <li>And {file.got.problems.length - 8} more.</li>}
                </ul>
              )}
            </div>
          )}
        </li>
      </ol>
    </Sheet>
  );
}
