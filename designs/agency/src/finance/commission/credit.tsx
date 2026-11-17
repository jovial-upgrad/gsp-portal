import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Field, TextInput } from '../../components/forms';
import { todayIso } from '../../institution/data/records';
import { useAsk } from '../../institution/records/parts';
import { numOf, numText } from './parts';
import type { Result, Tx } from './engine';
import { creditAndReinvoice, studentWithdrew } from './store';
import { ACTION_FROM, dayText, groupOf, money, roundMoney } from './model';

type AskFn = ReturnType<typeof useAsk>['ask'];

/** The lines a credit note can reverse (17 Nov): invoiced and not paid yet. Paid lines take a clawback instead. */
export const CREDITABLE: readonly string[] = ACTION_FROM.record.filter((s) => s !== 'Part paid');
/** Ticked lines a credit note can take: University → GSP, invoiced, one university, the line itself (not an Adjustment). */
export const canCredit = (sel: Tx[]) => sel.length > 0 && sel.every((t) => t.side === 'uni' && !!t.invoice && CREDITABLE.includes(t.status) && !t.adjusts && t.amount > 0) && new Set(sel.map((t) => t.uni)).size === 1;
/** A line's kept Adjustments on invoices: the credit note reverses them with it. */
const adjustmentsOf = (res: Result, t: Tx) => res.txs.filter((x) => x.adjusts === t.id && !!x.invoice && !x.credited).map((x) => x.id);

/** The fee a line was worked out on (the application's tuition fee a year, as Key details has it). */
const feeOf = (res: Result, t: Tx) => res.byApp.get(t.app)?.summary.fee;

/** One row of a university's statement, read from its CSV. */
type StatementRow = { app: string; period: number | null; fee: number | null; amount: number | null };
/**
 * Reads a university's statement (CSV): one row per student and study period, with the GSP application ID, the study
 * period, the fee and the commission the university works out. Columns are found by their headings.
 */
export function readStatement(text: string): { rows: StatementRow[]; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: 'The file has no rows.' };
  const split = (l: string) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()).slice(0, -1);
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const col = (...words: string[]) => head.findIndex((h) => words.some((w) => h.includes(w)));
  const cApp = col('application', 'gsp id', 'gsp-', 'app id');
  const cPer = col('study period', 'period', 'term', 'semester');
  const cFee = col('fee', 'tuition');
  const cAmt = col('commission', 'amount');
  if (cApp < 0 || cAmt < 0) return { rows: [], error: 'The file needs an application ID column and a commission column.' };
  const n = (x?: string) => (x == null || x === '' ? null : Number(x.replace(/[^0-9.-]/g, '')));
  return {
    rows: lines.slice(1).map((l) => {
      const c = split(l);
      return { app: (c[cApp] ?? '').toUpperCase(), period: cPer >= 0 ? n(c[cPer]) : null, fee: cFee >= 0 ? n(c[cFee]) : null, amount: n(c[cAmt]) };
    }),
  };
}

/**
 * Credit and re-invoice (Jovial, 17 Nov, after the Finance demo): the university's statement gives different amounts for
 * lines GSP has invoiced, and the month is closed in Xero. GSP never edits the invoice: a credit note reverses the lines
 * in full, and a new invoice carries the revised amounts. Finance uploads the statement or types the amounts.
 */
export function CreditSheet({ txs, res, by, taken, onClose, onDone, ask }: { txs: Tx[] | null; res: Result; by: string; taken: string[]; onClose: () => void; onDone: (msg: string) => void; ask: AskFn }) {
  const [amt, setAmt] = useState<Record<string, number | null>>({});
  const [fee, setFee] = useState<Record<string, number | null>>({});
  const [reason, setReason] = useState('');
  const [xero, setXero] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setAmt(Object.fromEntries((txs ?? []).map((t) => [t.id, t.amount])));
    setFee({});
    setReason('');
    setXero('');
    setNote('');
    setTried(false);
  }, [txs]);
  const cur = txs?.[0]?.currency ?? '';
  const invoices = useMemo(() => [...new Set((txs ?? []).map((t) => t.invoice!))], [txs]);
  if (!txs) return null;
  const read = async (f: File | undefined) => {
    if (!f) return;
    const { rows, error } = readStatement(await f.text());
    if (error) return setNote(error);
    let hit = 0;
    const a = { ...amt };
    const fe = { ...fee };
    rows.forEach((r) => {
      const t = txs.find((x) => x.app === r.app && (r.period == null || x.period === r.period));
      if (!t || r.amount == null) return;
      hit++;
      a[t.id] = r.amount;
      if (r.fee != null) fe[t.id] = r.fee;
    });
    setAmt(a);
    setFee(fe);
    setNote(`${f.name}: ${hit} of ${rows.length} ${rows.length === 1 ? 'row matches' : 'rows match'} the ticked lines${rows.length - hit ? `; ${rows.length - hit} didn’t (another student or study period)` : ''}.`);
  };
  const lineErr = (t: Tx) => (amt[t.id] == null || Number.isNaN(amt[t.id]!) || amt[t.id]! < 0 ? 'Enter the new amount (0 or more).' : null);
  const err = { lines: txs.some(lineErr) ? 'Check each line.' : null, reason: reason.trim() ? null : 'Say why (for example, the university’s statement of 12 Nov).', xero: !xero.trim() ? 'Enter the new invoice’s number from Xero.' : taken.includes(xero.trim()) ? 'That number is already used.' : null };
  const was = roundMoney(txs.reduce((n, t) => n + t.amount, 0), cur);
  const now = roundMoney(txs.reduce((n, t) => n + (amt[t.id] ?? 0), 0), cur);
  const go = () => {
    setTried(true);
    if (err.lines || err.reason || err.xero) return;
    ask(
      `Credit ${invoices.join(', ')} and invoice ${money(now, cur)}?`,
      'Credit and re-invoice',
      <p>
        {invoices.map((i) => `CN-${i}`).join(', ')} {invoices.length === 1 ? 'reverses' : 'reverse'} {txs.length} {txs.length === 1 ? 'line' : 'lines'} ({money(was, cur)}). A new invoice to {txs[0].uniName}, dated {dayText(todayIso())}, carries {money(now, cur)}. The RP lines follow the new amounts.
      </p>,
      () => {
        const made = creditAndReinvoice(
          txs.map((t) => ({ tx: t.id, invoice: t.invoice!, uni: t.uni, amount: amt[t.id] === t.amount ? undefined : amt[t.id]!, fee: fee[t.id] ?? undefined, also: adjustmentsOf(res, t) })),
          reason.trim(),
          by,
          true,
          xero.trim(),
        );
        onDone(`${made.length ? made.join(', ') : 'Credit note'} issued; the new amounts are invoiced.`);
      },
    );
  };
  return (
    <Sheet
      open
      onClose={onClose}
      center
      expandable
      className="iform"
      title="Credit and re-invoice"
      sub={`${txs.length} ${txs.length === 1 ? 'line' : 'lines'} on ${invoices.join(', ')} to ${txs[0].uniName}: ${money(was, cur)} → ${money(now, cur)}`}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={go}>Credit and re-invoice</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="ccn-file" label="University’s statement (optional)" className="iform__wide" hint="A CSV with the GSP application ID, the study period, the fee and the commission. Matching rows fill in the amounts below.">
          <input id="ccn-file" type="file" accept=".csv,text/csv" onChange={(e) => void read(e.target.files?.[0])} />
        </Field>
        {note && (
          <p className="iform__wide cmuted" role="status">
            {note}
          </p>
        )}
        {txs.map((t) => (
          <div key={t.id} className="iform__wide cpay__line">
            <Field id={`ccn-${t.id}`} label={`${t.id} · ${t.student}${t.period ? `, study period ${t.period}` : ''}: new amount (${t.currency})`} required error={tried ? lineErr(t) : null} hint={`Invoiced at ${money(t.amount, t.currency)}${feeOf(res, t) ? ` on a fee of ${money(feeOf(res, t)!, t.currency)} a year` : ''}`}>
              <TextInput id={`ccn-${t.id}`} inputMode="decimal" value={numText(amt[t.id] ?? null)} invalid={tried && !!lineErr(t)} onChange={(e) => setAmt((x) => ({ ...x, [t.id]: numOf(e.target.value) }))} />
            </Field>
            <Field id={`ccn-fee-${t.id}`} label="Fee the university used (optional)">
              <TextInput id={`ccn-fee-${t.id}`} inputMode="decimal" value={numText(fee[t.id] ?? null)} onChange={(e) => setFee((x) => ({ ...x, [t.id]: numOf(e.target.value) }))} />
            </Field>
          </div>
        ))}
        <Field id="ccn-xero" label="New invoice number (from Xero)" required error={tried ? err.xero : null} hint="Raise the new invoice in Xero, then enter its number.">
          <TextInput id="ccn-xero" value={xero} invalid={tried && !!err.xero} onChange={(e) => setXero(e.target.value)} />
        </Field>
        <Field id="ccn-why" label="Why" required className="iform__wide" error={tried ? err.reason : null}>
          <TextInput id="ccn-why" value={reason} invalid={tried && !!err.reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/**
 * Student withdrew (17 Nov): the university says the student left, usually in reply to an invoice. Finance records the
 * date; the application's stage stays. Lines after the date become Not payable, and the invoiced ones are credited.
 */
export function WithdrawSheet({ app, res, by, onClose, onDone, ask }: { app: string | null; res: Result; by: string; onClose: () => void; onDone: (msg: string) => void; ask: AskFn }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setDate(todayIso());
    setReason('');
    setTried(false);
  }, [app]);
  if (!app) return null;
  const a = res.byApp.get(app);
  const mine = res.txs.filter((t) => t.app === app && t.side === 'uni');
  const credit = mine.filter((t) => !!t.invoice && CREDITABLE.includes(t.status) && !t.adjusts && !!t.trigger && t.trigger > date && !t.credited);
  const nopay = mine.filter((t) => !t.invoice && !!t.trigger && t.trigger > date && groupOf(t.side, t.status) !== 'paid' && !t.credited);
  const err = { date: !date ? 'Choose the date.' : date > todayIso() ? 'It can’t be in the future.' : null, reason: reason.trim() ? null : 'Say what the university told you.' };
  const go = () => {
    setTried(true);
    if (err.date || err.reason) return;
    ask(
      `Record that ${a?.student ?? app} withdrew on ${dayText(date)}?`,
      'Record withdrawal',
      <p>
        {nopay.length} {nopay.length === 1 ? 'line becomes' : 'lines become'} Not payable{credit.length ? `, and ${credit.length} invoiced ${credit.length === 1 ? 'line is' : 'lines are'} credited (${[...new Set(credit.map((t) => `CN-${t.invoice}`))].join(', ')})` : ''}. Lines already paid stay; record a clawback if the university takes money back. The application’s stage doesn’t change.
      </p>,
      () => {
        studentWithdrew(
          app,
          date,
          reason.trim(),
          by,
          credit.map((t) => ({ tx: t.id, invoice: t.invoice!, uni: t.uni, also: adjustmentsOf(res, t) })),
        );
        onDone(`Withdrawal recorded for ${a?.student ?? app}.`);
      },
    );
  };
  return (
    <Sheet
      open
      onClose={onClose}
      center
      className="iform"
      title="Student withdrew"
      sub={a ? `${a.student} · ${a.uniName}` : app}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={go}>Record withdrawal</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="cwd-date" label="Withdrew on" required error={tried ? err.date : null} hint="Lines with a later trigger date aren’t payable.">
          <TextInput id="cwd-date" type="date" value={date} invalid={tried && !!err.date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="cwd-why" label="What the university said" required className="iform__wide" error={tried ? err.reason : null}>
          <TextInput id="cwd-why" value={reason} invalid={tried && !!err.reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/**
 * Raise invoice (Jovial, 17 Nov): Xero gives the invoice number. Finance raises it in Xero and enters the number here;
 * the lines go on it and it's sent from the portal as before.
 */
export function XeroSheet({ open, title, sub, body, taken, go, onClose }: { open: boolean; title: string; sub?: string; body: ReactNode; taken: string[]; go: (number: string) => void; onClose: () => void }) {
  const [n, setN] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setN('');
    setTried(false);
  }, [open]);
  if (!open) return null;
  const err = !n.trim() ? 'Enter the invoice number from Xero.' : taken.includes(n.trim()) ? 'That number is already used.' : null;
  const submit = () => {
    setTried(true);
    if (!err) go(n.trim());
  };
  return (
    <Sheet
      open
      onClose={onClose}
      center
      className="iform"
      title={title}
      sub={sub}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit}>Raise invoice</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <div className="iform__wide">{body}</div>
        <Field id="cxero-no" label="Invoice number (from Xero)" required error={tried ? err : null} hint="Raise the invoice in Xero, then enter its number here.">
          <TextInput id="cxero-no" value={n} invalid={tried && !!err} onChange={(e) => setN(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
