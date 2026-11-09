import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { PreviewSheet } from '../../components/DocView';
import { Sheet } from '../../components/Sheet';
import { downloadInvoice, invoiceHtml, type InvoiceDoc } from './invoice';
import { TextInput } from '../../components/forms';
import { Fold, Pill } from '../../institution/records/parts';
import type { Tx } from './engine';
import { STATUS_TONE, dayText, money, sizeText, type Band, type FileRef, type Log, type TxStatus } from './model';
import './commission.css';

/**
 * Where Commissions goes from a Commission tab (Jovial, 9 Nov): its role's portal gives this, so only Commissions (GSP ·
 * Finance) sees "Edit in Setup" and "Add RP record"; every other role reads the tabs without them.
 */
export type CommNav = { setup: (tab: SetupTab, open?: string) => void; rp?: (id: string) => void; app?: (id: string) => void };
export type SetupTab = 'rps' | 'agreements' | 'notices' | 'terms';
const NavCtx = createContext<CommNav | null>(null);
export const CommNavProvider = ({ nav, children }: { nav: CommNav; children: ReactNode }) => <NavCtx.Provider value={nav}>{children}</NavCtx.Provider>;
export const useCommNav = () => useContext(NavCtx);

export const StatusPill = ({ s }: { s: TxStatus }) => <Pill tone={STATUS_TONE[s]}>{s}</Pill>;

/** A file and its Preview, as the Commission tabs and Setup show an agreement, a notice or a contract. */
export function DocLine({ file, label }: { file: FileRef | null; label: string }) {
  const [open, setOpen] = useState(false);
  if (!file) return <span className="muted">No document uploaded</span>;
  return (
    <span className="cdoc">
      <Icon name="file" size={18} />
      <span className="cdoc__t">
        {file.name}
        <span className="cdoc__sub">{sizeText(file.size)}</span>
      </span>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(true)}>
        <Icon name="eye" size={16} /> Preview<span className="vh"> {file.name}</span>
      </button>
      <PreviewSheet d={{ name: label, file: file.name }} open={open} onClose={() => setOpen(false)} />
    </span>
  );
}

/**
 * Picks a file (Choose a file), checked as it's picked: too large shows "The file is over {n} MB." `accept` limits the
 * types (PDF, or PDF, JPG and PNG).
 */
export function FilePick({ id, value, onChange, accept, maxMb, invalid, onTooBig }: { id: string; value: FileRef | null; onChange: (f: FileRef | null) => void; accept: string; maxMb: number; invalid?: boolean; onTooBig: (big: boolean) => void }) {
  const pick = useRef<HTMLInputElement>(null);
  return (
    <>
      <button id={id} type="button" className={`ipick ${invalid ? 'is-invalid' : ''}`} onClick={() => pick.current?.click()}>
        <Icon name={value ? 'file' : 'upload'} size={18} />
        <span className="ipick__t">{value ? `${value.name} · ${sizeText(value.size)}` : 'Choose a file'}</span>
      </button>
      <input
        ref={pick}
        type="file"
        accept={accept}
        className="vh"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={`${id}-input`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const big = f.size > maxMb * 1024 * 1024;
          onTooBig(big);
          onChange(big ? null : { name: f.name, size: f.size });
        }}
      />
    </>
  );
}

/** A number typed in a field: empty is null. */
export const numOf = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));
export const numText = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '' : String(n));

/** Bands are valid: at least one, each a share from 0 to 100, following on with no gaps, only the last open-ended. */
export function bandsError(b: Band[]): string | null {
  if (!b.length) return 'Add at least one band.';
  if (b.some((x) => !(x.pct > 0 && x.pct <= 100))) return 'A number from 0 to 100.';
  for (let i = 0; i < b.length; i++) {
    const x = b[i];
    if (!Number.isInteger(x.from) || x.from < 1 || (x.to !== null && (!Number.isInteger(x.to) || x.to < x.from))) return 'The bands must follow on without gaps.';
    if (i > 0 && (b[i - 1].to === null || x.from !== b[i - 1].to! + 1)) return 'The bands must follow on without gaps.';
    if (x.to === null && i < b.length - 1) return 'The bands must follow on without gaps.';
  }
  if (b[0].from !== 1) return 'The bands must follow on without gaps.';
  return null;
}

/** Bands as rows of From, To and Share (or Rate): Add band, × on each. */
export function BandsEditor({ id, bands, onChange, unit = 'Share (%)', invalid }: { id: string; bands: Band[]; onChange: (b: Band[]) => void; unit?: string; invalid?: boolean }) {
  const set = (i: number, p: Partial<Band>) => onChange(bands.map((b, j) => (j === i ? { ...b, ...p } : b)));
  return (
    <div className="cbands" id={id}>
      {bands.length > 0 && (
        <div className="cbands__head" aria-hidden="true">
          <span>From</span>
          <span>To</span>
          <span>{unit}</span>
          <span />
        </div>
      )}
      {bands.map((b, i) => (
        <div key={i} className="cbands__row">
          <TextInput id={`${id}-from-${i}`} aria-label={`Band ${i + 1}: from (enrolments)`} inputMode="numeric" value={numText(b.from)} invalid={invalid} onChange={(e) => set(i, { from: numOf(e.target.value) ?? NaN })} />
          <TextInput id={`${id}-to-${i}`} aria-label={`Band ${i + 1}: to (enrolments; empty: and above)`} inputMode="numeric" placeholder="and above" value={numText(b.to)} invalid={invalid} onChange={(e) => set(i, { to: numOf(e.target.value) })} />
          <TextInput id={`${id}-pct-${i}`} aria-label={`Band ${i + 1}: ${unit}`} inputMode="decimal" value={numText(b.pct)} invalid={invalid} onChange={(e) => set(i, { pct: numOf(e.target.value) ?? NaN })} />
          <button type="button" className="icon-btn" aria-label={`Remove band ${i + 1}`} onClick={() => onChange(bands.filter((_, j) => j !== i))}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--secondary btn--sm iadd"
        onClick={() => {
          const last = bands[bands.length - 1];
          onChange([...bands.map((b, j) => (j === bands.length - 1 && b.to === null ? { ...b, to: b.from + 9 } : b)), { from: last ? (last.to ?? last.from + 9) + 1 : 1, to: null, pct: NaN }]);
        }}
      >
        <Icon name="plus" size={16} /> Add band
      </button>
    </div>
  );
}

/** A Setup tab's foot (9 Nov): Logs ({n}), newest first. */
export function LogsFold({ id, logs }: { id: string; logs: Log[] }) {
  return (
    <Fold title="Logs" id={id} count={logs.length}>
      {logs.length ? (
        <ol className="clogs">
          {logs.map((l) => (
            <li key={l.id}>
              <span>{l.text}</span>
              <span className="clogs__at num">{new Date(l.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="iempty">Nothing changed here yet.</p>
      )}
    </Fold>
  );
}

/**
 * A commission item's transactions (an application's Commission tab, and the RP's Earnings): Transaction ID, Type,
 * What it's for, Due, Amount, Status, and on GSP → RP the invoice it's on. `amountNote`: the info icon on Amount.
 */
export function TxTable({ txs, rp, rpView, amountNote, caption, app }: { txs: Tx[]; rp?: boolean; rpView?: boolean; amountNote?: string; caption: string; app?: boolean }) {
  return (
    <div className="stab-wrap">
      <table className="itab ctab">
        <caption className="vh">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Transaction ID</th>
            {app && <th scope="col">Application</th>}
            <th scope="col">Type</th>
            <th scope="col">What it’s for</th>
            <th scope="col">Due</th>
            <th scope="col" className="ctab__num">
              <span className="cinfo">
                Amount
                {amountNote && (
                  <span className="cinfo__i" tabIndex={0} role="note" aria-label={amountNote} title={amountNote}>
                    <Icon name="info" size={14} />
                    <span className="cinfo__tip" aria-hidden="true">
                      {amountNote}
                    </span>
                  </span>
                )}
              </span>
            </th>
            <th scope="col">Status</th>
            {rp && <th scope="col">Invoice</th>}
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => (
            <tr key={t.id}>
              <td className="num">{t.id}</td>
              {app && (
                <td>
                  <span className="num">{t.app}</span> · {t.student}
                  <span className="iw-sub">{t.uniName}</span>
                </td>
              )}
              <td>{t.type}</td>
              <td>
                {/* the RP's own view: what it's for in plain words, never GSP's rate or amount (9 Nov) */}
                {rpView ? t.rpWhat : t.what}
                {t.override && !rpView && <span className="iw-sub">Overridden by {t.override.by}: {t.override.reason}</span>}
              </td>
              <td className="num iw-nowrap">{t.due ? dayText(t.due) : <span className="muted">Waiting for the date</span>}</td>
              <td className="num ctab__num">{money(t.amount, t.currency)}</td>
              <td>
                <StatusPill s={t.status} />
              </td>
              {rp && <td>{t.invoice ?? <span className="muted">—</span>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Commissions' way into Setup from a Commission tab: shown only where the portal gives it. */
export function SetupButton({ tab, open, children = 'Edit in Setup' }: { tab: SetupTab; open?: string; children?: ReactNode }) {
  const nav = useCommNav();
  if (!nav) return null;
  return (
    <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => nav.setup(tab, open)}>
      {children}
    </Button>
  );
}

/** An invoice in a preview, with Download (a printable page). */
export function InvoiceSheet({ doc, onClose }: { doc: InvoiceDoc | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!doc}
      onClose={onClose}
      center
      expandable
      className="cinvoice"
      title={doc ? `${doc.title} ${doc.number}` : ''}
      sub={doc ? `${doc.from.name} to ${doc.to.name}` : undefined}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button iconLeft={<Icon name="download" size={16} />} onClick={() => doc && downloadInvoice(doc)}>
              Download
            </Button>
          </div>
        </div>
      }
    >
      {doc && <iframe className="cinvoice__frame" title={`${doc.title} ${doc.number}`} srcDoc={invoiceHtml(doc)} />}
    </Sheet>
  );
}
