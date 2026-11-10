import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Checkbox, Field, SelectInput, TextInput } from '../../components/forms';
import { Toast } from '../../institution/records/parts';
import { todayIso } from '../../institution/data/records';
import type { Application } from '../../data/applications';
import type { Student } from '../../data/students';
import { HOME_RP } from '../../gsp/rps';
import { FilePick, InvoiceSheet, TxTable } from './parts';
import { bandStanding, sumBy, totalsText, type Tx } from './engine';
import { rpInvoice, type InvoiceDoc } from './invoice';
import { ctxOf, ctxRps, enrolmentsOf, saveBank, uploadRpInvoice, useComm, useLines } from './store';
import { BANK_FIELDS, HELD, IN_REVIEW, TO_INVOICE, WAITING_UNI, dayText, groupOf, money, pct, type Bank, type FileRef } from './model';
import '../../institution/work/work.css';

/**
 * Earnings, RP side (Jovial, 9 Nov: the PRD's Commissions tab), RP Admin only: what the RP sees of its commission.
 * A one-line nudge about its bank account; tiles for Expected, Ready to invoice and Paid this year (in each currency), and the RP's band (Q43);
 * **Invoices to send**, the lines GSP asked it to invoice, with GSP's filled-in invoice to download and Upload
 * invoice (one file can cover several lines); and its GSP → RP lines, with how to question an amount (by email:
 * there's no dispute form). Amounts are in each university's currency; the bank currency is for paying only.
 */
export function Earnings({ agency, me, apps, students }: { agency: string; me: string; apps: Application[]; students: Student[] }) {
  const s = useComm();
  const res = useLines(apps, students);
  const rp = ctxRps().find((r) => r.name === agency) ?? ctxRps().find((r) => r.name === HOME_RP)!;
  const bank = s.banks.find((b) => b.rp === rp.id);
  const mine = useMemo(() => res.txs.filter((t) => t.side === 'rp' && t.rp === rp.id).sort((a, b) => b.due.localeCompare(a.due)), [res, rp.id]);
  const [editBank, setEditBank] = useState(false);
  const [upload, setUpload] = useState(false);
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const say = (text: string) => setMsg({ text, key: Date.now() });
  const year = todayIso().slice(0, 4);
  const paidOn = new Map(s.rpPayments.flatMap((p) => p.txs.map((t) => [t, p.date] as const)));
  // the lines GSP asked it to invoice, or sent back to invoice again (Q50)
  const inReview = mine.filter((t) => t.status === IN_REVIEW).length;
  const toSend = mine.filter((t) => (TO_INVOICE as readonly string[]).includes(t.status) && !!t.requested);
  const waiting = (t: Tx) => groupOf('rp', t.status) === 'estimate' || t.status === WAITING_UNI;
  const tiles: [string, Record<string, number>, string][] = [
    ['Expected', sumBy(mine.filter(waiting)), 'Waiting for the universities to pay GSP'],
    ['Ready to invoice', sumBy(mine.filter((t) => groupOf('rp', t.status) === 'progress' && !waiting(t) && !(HELD as readonly string[]).includes(t.status))), 'The universities have paid GSP'],
    [`Paid in ${year}`, sumBy(mine.filter((t) => groupOf('rp', t.status) === 'paid' && (paidOn.get(t.id) ?? '').startsWith(year))), 'Paid to your bank account'],
  ];
  const sentBack = s.rpInvoices.filter((i) => i.rp === rp.id && i.state === 'Sent back' && i.txs.some((t) => toSend.some((x) => x.id === t)));
  const last4 = bank?.number.replace(/\s+/g, '').slice(-4);
  // Q43: where the RP stands in its agreement's bands (a flat share has none)
  const stand = useMemo(() => bandStanding(s, ctxOf(), rp.id, enrolmentsOf(apps, students)), [s, rp.id, apps, students]);
  return (
    <div className="ipage cearn">
      <header className="stu__head ihead">
        <div className="stu__titles">
          <h1 className="page__title">Earnings</h1>
          <p className="stu__lead">The commission {rp.name} earns on each enrolled student, and when GSP pays it.</p>
        </div>
      </header>

      <section className="card cearn__nudge" aria-label="Bank account">
        {bank ? (
          <p>
            <Icon name="wallet" size={18} /> Paid to {bank.bank} <span className="num">····{last4}</span>, {bank.currency}
          </p>
        ) : (
          <p>
            <Icon name="alert" size={18} /> Add your bank account so GSP can pay you.
          </p>
        )}
        <Button size="sm" variant={bank ? 'secondary' : 'primary'} onClick={() => setEditBank(true)}>
          {bank ? 'Change bank account' : 'Add bank account'}
        </Button>
      </section>

      <div className="cearn__tiles" role="group" aria-label="Your commission">
        {tiles.map(([k, m, sub]) => (
          <div key={k} className="card cearn__tile">
            <span className="k">{k}</span>
            <span className="n num">{totalsText(m)}</span>
            <span className="k">{sub}</span>
          </div>
        ))}
        {stand && (
          <div className="card cearn__tile">
            <span className="k">Your band</span>
            <span className="n num">{pct(stand.share)}</span>
            <span className="k">
              {stand.count} {stand.count === 1 ? 'enrolment' : 'enrolments'} in {stand.window}
              {stand.next ? `. ${stand.next.more} more for ${pct(stand.next.share)}` : ', the top band'}
            </span>
          </div>
        )}
      </div>

      <section className="card irsec" aria-labelledby="cearn-send">
        <div className="irsec__head">
          <div className="irsec__t">
            <h2 className="irsec__title" id="cearn-send">
              Invoices to send
            </h2>
            <p className="irsec__note">GSP is ready to pay these. Download GSP’s filled-in invoice and upload it signed, or upload your own. One file can cover several lines.</p>
          </div>
          {toSend.length > 0 && (
            <div className="cearn__acts">
              <Button variant="secondary" size="sm" iconLeft={<Icon name="download" size={16} />} onClick={() => setDoc(rpInvoice(s, rp, toSend, todayIso()))}>
                Download GSP’s invoice
              </Button>
              <Button size="sm" iconLeft={<Icon name="upload" size={16} />} onClick={() => setUpload(true)}>
                Upload invoice
              </Button>
            </div>
          )}
        </div>
        {sentBack.map((i) => (
          <p key={i.id} className="iviewonly">
            <Icon name="alert" size={16} />
            <span>
              GSP sent back {i.file.name}: {i.reason}
            </span>
          </p>
        ))}
        {toSend.length ? (
          <ul className="cearn__send">
            {toSend.map((t) => (
              <li key={t.id}>
                <span>
                  <span className="iw-strong">
                    {t.student} · {t.uniName}
                  </span>
                  <span className="iw-sub num">
                    {t.id} · {t.app}
                  </span>
                </span>
                <span className="num iw-strong">{money(t.amount, t.currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="iempty">Nothing to invoice now. GSP asks once a university has paid.</p>
        )}
        {inReview > 0 && <p className="cline">{inReview === 1 ? 'One line is' : `${inReview} lines are`} on an invoice you sent: GSP is checking it.</p>}
      </section>

      <section className="card irsec" aria-labelledby="cearn-lines">
        <div className="irsec__head">
          <div className="irsec__t">
            <h2 className="irsec__title" id="cearn-lines">
              Commission lines
            </h2>
            <p className="irsec__note">What GSP pays you, line by line, in the university’s currency.</p>
          </div>
        </div>
        {mine.length ? <TxTable txs={mine} rp rpView app caption="Your commission lines" amountNote={`To question an amount, email ${s.settings.disputeEmail} with the transaction ID.`} /> : <p className="iempty">Lines show once one of your students enrols.</p>}
      </section>

      <BankSheet open={editBank} rp={rp} bank={bank} onClose={() => setEditBank(false)} onSave={(b) => (saveBank(b, me), setEditBank(false), say(bank ? 'Bank account changed.' : 'Bank account added.'))} />
      <UploadSheet
        open={upload}
        lines={toSend}
        maxMb={s.settings.maxFileMb}
        onClose={() => setUpload(false)}
        onSend={(file, txs) => {
          uploadRpInvoice(rp.id, file, txs, me);
          setUpload(false);
          say(`Invoice sent to GSP for ${txs.length} ${txs.length === 1 ? 'line' : 'lines'}.`);
        }}
      />
      <InvoiceSheet doc={doc} onClose={() => setDoc(null)} />
      <Toast msg={msg} />
    </div>
  );
}

/** The bank account: every field required, and the currency (the RP's country's to start with). */
function BankSheet({ open, rp, bank, onClose, onSave }: { open: boolean; rp: { id: string; country: string }; bank?: Bank; onClose: () => void; onSave: (b: Omit<Bank, 'updated'>) => void }) {
  const s = useComm();
  const blank = (): Omit<Bank, 'updated'> => ({ rp: rp.id, bank: '', account: '', number: '', swift: '', address: '', currency: s.settings.countryCurrency[rp.country] ?? '' });
  const [v, setV] = useState(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(bank ? { ...bank } : blank());
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = Object.fromEntries([...BANK_FIELDS.map((f) => [f.key, !v[f.key].trim() ? `Enter the ${f.field}.` : null]), ['currency', !v.currency ? 'Choose the currency.' : null]]) as Record<string, string | null>;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title={bank ? 'Change bank account' : 'Add bank account'}
      sub="GSP pays your commission here. A change shows to GSP at once."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (Object.values(err).some(Boolean)) return;
                onSave(v);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        {BANK_FIELDS.map((f) => (
          <Field key={f.key} id={`cbank-${f.key}`} label={f.label} required error={tried ? err[f.key] : null} className={f.key === 'address' ? 'iform__wide' : ''}>
            <TextInput id={`cbank-${f.key}`} value={v[f.key]} invalid={tried && !!err[f.key]} inputMode={f.key === 'number' ? 'numeric' : undefined} onChange={(e) => setV((x) => ({ ...x, [f.key]: e.target.value }))} />
          </Field>
        ))}
        <Field id="cbank-cur" label="Bank currency" required error={tried ? err.currency : null}>
          <SelectInput id="cbank-cur" value={v.currency} placeholder="Choose the currency" invalid={tried && !!err.currency} onChange={(e) => setV((x) => ({ ...x, currency: e.target.value }))}>
            {s.settings.bankCurrencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}

/** Upload invoice: one file (PDF, JPG or PNG), and the requested lines it covers (at least one). */
function UploadSheet({ open, lines, maxMb, onClose, onSend }: { open: boolean; lines: Tx[]; maxMb: number; onClose: () => void; onSend: (f: FileRef, txs: string[]) => void }) {
  const [file, setFile] = useState<FileRef | null>(null);
  const [big, setBig] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setBig(false);
    setTicked(lines.map((t) => t.id));
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = { file: big ? `The file is over ${maxMb} MB.` : !file ? 'Upload the invoice.' : null, lines: !ticked.length ? 'Tick the lines this invoice covers.' : null };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title="Upload invoice"
      sub="Your own invoice, or GSP’s signed."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (err.file || err.lines) return;
                onSend(file!, ticked);
              }}
            >
              Send to GSP
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="cup-file" label="Invoice file" required error={tried ? err.file : null} hint={`PDF, JPG or PNG, up to ${maxMb} MB.`} className="iform__wide">
          <FilePick id="cup-file" value={file} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" maxMb={maxMb} invalid={tried && !!err.file} onTooBig={setBig} onChange={setFile} />
        </Field>
        <Field id="cup-lines" label="Lines it covers" required error={tried ? err.lines : null} className="iform__wide">
          <div className="cearn__ticks" id="cup-lines">
            {lines.map((t) => (
              <Checkbox key={t.id} id={`cup-${t.id}`} checked={ticked.includes(t.id)} onChange={(on) => setTicked((x) => (on ? [...x, t.id] : x.filter((y) => y !== t.id)))} hint={`${t.id} · ${t.uniName} · due ${dayText(t.due)}`}>
                {t.student}: {money(t.amount, t.currency)}
              </Checkbox>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
