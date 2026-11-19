import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { todayIso } from '../../institution/data/records';
import { useAsk } from '../../institution/records/parts';
import { numOf, numText } from './parts';
import { FeeRows } from './AppFees';
import type { Application } from '../../data/applications';
import type { Result, Tx } from './engine';
import { addLines, commState, creditAndReinvoice, studentWithdrew } from './store';
import { ACTION_FROM, ADDABLE_TYPES, MINUS_TYPES, SIDES, SIDE_KEYS, TX_TYPES, dayText, groupOf, money, roundMoney } from './model';

type AskFn = ReturnType<typeof useAsk>['ask'];

/** The lines a credit note can reverse (17 Nov): invoiced and not paid yet. Paid lines take a clawback instead. */
export const CREDITABLE: readonly string[] = ACTION_FROM.record.filter((s) => s !== 'Part paid');
/** Ticked lines a credit note can take: University → GSP, invoiced, one institution partner and currency, the line itself (not an Adjustment). */
export const canCredit = (sel: Tx[], payerOf: (uni: string) => string = (u) => u) => sel.length > 0 && sel.every((t) => t.side === 'uni' && !!t.invoice && CREDITABLE.includes(t.status) && !t.adjusts && t.amount > 0) && new Set(sel.map((t) => `${payerOf(t.uni)}|${t.currency}`)).size === 1;
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
/** One CSV line's cells (quoted cells may hold commas). */
const split = (l: string) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()).slice(0, -1);
export function readStatement(text: string): { rows: StatementRow[]; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: 'The file has no rows.' };
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
export function CreditSheet({ txs, res, by, taken, onClose, onDone, ask, initial, why }: { txs: Tx[] | null; res: Result; by: string; taken: string[]; onClose: () => void; onDone: (msg: string) => void; ask: AskFn; initial?: Record<string, number>; why?: string }) {
  const [amt, setAmt] = useState<Record<string, number | null>>({});
  const [fee, setFee] = useState<Record<string, number | null>>({});
  const [reason, setReason] = useState('');
  const [xero, setXero] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setAmt(Object.fromEntries((txs ?? []).map((t) => [t.id, initial?.[t.id] ?? t.amount])));
    setFee({});
    setReason(why ?? '');
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
  const err = { lines: txs.some(lineErr) ? 'Check each line.' : null, reason: reason.trim() ? null : 'Say why (for example, the university’s statement of 12 Nov).', xero: !xero.trim() ? 'Enter the new invoice’s number from Xero.' : taken.includes(withPrefix(xero, commState().settings.invPrefix)) ? 'That number is already used.' : null };
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
          txs.map((t) => ({ tx: t.id, invoice: t.invoice!, uni: t.uni, amount: amt[t.id] === t.amount ? undefined : amt[t.id]!, also: adjustmentsOf(res, t) })),
          reason.trim(),
          by,
          true,
          withPrefix(xero, commState().settings.invPrefix),
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
  const [proof, setProof] = useState<{ name: string; size: number } | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setDate(todayIso());
    setReason('');
    setProof(null);
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
          proof ?? undefined,
        );
        onDone(`Withdrawal recorded for ${a?.student ?? app}${proof ? `; ${proof.name} is in the application’s Documents` : ''}.`);
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
        <Field id="cwd-file" label="Proof from the university" optional className="iform__wide" hint="Its email or statement. It goes in the application’s Documents (Suman, 18 Nov).">
          <input id="cwd-file" type="file" onChange={(e) => {
            const f = e.target.files?.[0];
            setProof(f ? { name: f.name, size: f.size } : null);
          }} />
        </Field>
      </div>
    </Sheet>
  );
}

/** One row of a withdrawals file: application ID, the date the student withdrew, and what the university said. */
type WithdrawRow = { app: string; date: string; reason: string };
/** Reads a withdrawals CSV (17 Nov); columns are found by their headings. Dates as YYYY-MM-DD or DD/MM/YYYY. */
export function readWithdrawals(text: string): { rows: WithdrawRow[]; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: 'The file has no rows.' };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const col = (...words: string[]) => head.findIndex((h) => words.some((w) => h.includes(w)));
  const cApp = col('application', 'gsp id', 'gsp-', 'app id');
  const cDate = col('withdr', 'date');
  const cWhy = col('reason', 'said', 'note', 'comment');
  if (cApp < 0 || cDate < 0) return { rows: [], error: 'The file needs an application ID column and a withdrew-on date column.' };
  const iso = (d: string) => {
    const m = d.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : d.slice(0, 10);
  };
  return { rows: lines.slice(1).map((l) => split(l)).map((c) => ({ app: (c[cApp] ?? '').toUpperCase(), date: iso(c[cDate] ?? ''), reason: cWhy >= 0 ? c[cWhy] ?? '' : '' })) };
}

/** What recording a withdrawal on a date does to an application's University → GSP lines. */
const withdrawEffect = (res: Result, app: string, date: string) => {
  const mine = res.txs.filter((t) => t.app === app && t.side === 'uni');
  return {
    credit: mine.filter((t) => !!t.invoice && CREDITABLE.includes(t.status) && !t.adjusts && !!t.trigger && t.trigger > date && !t.credited),
    nopay: mine.filter((t) => !t.invoice && !!t.trigger && t.trigger > date && groupOf(t.side, t.status) !== 'paid' && !t.credited),
  };
};

/**
 * Students withdrew, in bulk (Jovial, 17 Nov: "much needed"): universities send a list of students who left. Finance
 * uploads it as a CSV; each row is checked against the applications, and the matched ones are recorded in one go, each
 * exactly as Student withdrew on one application does.
 */
export function BulkWithdrawSheet({ open, res, by, onClose, onDone, ask }: { open: boolean; res: Result; by: string; onClose: () => void; onDone: (msg: string) => void; ask: AskFn }) {
  const [rows, setRows] = useState<WithdrawRow[]>([]);
  const [why, setWhy] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setRows([]);
    setWhy('');
    setNote('');
    setTried(false);
  }, [open]);
  if (!open) return null;
  const check = (r: WithdrawRow) =>
    !res.byApp.has(r.app) ? 'No application with this ID has commission lines.' : !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? 'The date can’t be read.' : r.date > todayIso() ? 'The date is in the future.' : !(r.reason || why.trim()) ? 'No reason: add one below.' : rows.filter((x) => x.app === r.app).length > 1 ? 'The application is in the file twice.' : null;
  const good = rows.filter((r) => !check(r));
  const read = async (f: File | undefined) => {
    if (!f) return;
    const { rows: got, error } = readWithdrawals(await f.text());
    setRows(got);
    setNote(error ?? `${got.length} ${got.length === 1 ? 'row' : 'rows'} read.`);
  };
  const go = () => {
    setTried(true);
    if (!good.length) return;
    const eff = good.map((r) => withdrawEffect(res, r.app, r.date));
    const nNo = eff.reduce((n, e) => n + e.nopay.length, 0);
    const nCr = eff.reduce((n, e) => n + e.credit.length, 0);
    ask(
      `Record ${good.length} ${good.length === 1 ? 'withdrawal' : 'withdrawals'}?`,
      'Record withdrawals',
      <p>
        {nNo} {nNo === 1 ? 'line becomes' : 'lines become'} Not payable{nCr ? `, and ${nCr} invoiced ${nCr === 1 ? 'line is' : 'lines are'} credited` : ''}. {rows.length - good.length ? `${rows.length - good.length} ${rows.length - good.length === 1 ? 'row is' : 'rows are'} left out. ` : ''}Lines already paid stay; record a clawback if the university takes money back.
      </p>,
      () => {
        good.forEach((r, i) =>
          studentWithdrew(
            r.app,
            r.date,
            (r.reason || why).trim(),
            by,
            eff[i].credit.map((t) => ({ tx: t.id, invoice: t.invoice!, uni: t.uni, also: adjustmentsOf(res, t) })),
          ),
        );
        onDone(`${good.length} ${good.length === 1 ? 'withdrawal' : 'withdrawals'} recorded.`);
      },
    );
  };
  return (
    <Sheet
      open
      onClose={onClose}
      center
      className="iform"
      title="Students withdrew"
      sub="Upload the university’s list"
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={go} disabled={!good.length}>
              Record {good.length || ''} {good.length === 1 ? 'withdrawal' : 'withdrawals'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="cbw-file" label="Withdrawals file" required className="iform__wide" hint="A CSV with the GSP application ID, the date the student withdrew and what the university said." error={tried && !rows.length ? 'Choose a file.' : null}>
          <input id="cbw-file" type="file" accept=".csv,text/csv" onChange={(e) => void read(e.target.files?.[0])} />
        </Field>
        {note && (
          <p className="iform__wide cmuted" role="status">
            {note}
          </p>
        )}
        <Field id="cbw-why" label="Reason for rows without one" className="iform__wide">
          <TextInput id="cbw-why" value={why} onChange={(e) => setWhy(e.target.value)} />
        </Field>
        {rows.length > 0 && (
          <table className="iform__wide cbw">
            <thead>
              <tr>
                <th>Application</th>
                <th>Student</th>
                <th>Withdrew on</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const bad = check(r);
                const a = res.byApp.get(r.app);
                const e = bad ? null : withdrawEffect(res, r.app, r.date);
                return (
                  <tr key={i} className={bad ? 'cbw--bad' : undefined}>
                    <td>{r.app || '—'}</td>
                    <td>{a ? `${a.student} · ${a.uniName}` : '—'}</td>
                    <td>{/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? dayText(r.date) : r.date || '—'}</td>
                    <td>{bad ?? `${e!.nopay.length} Not payable${e!.credit.length ? `, ${e!.credit.length} credited` : ''}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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
  // Suman, 18 Nov: the invoice prefix (a Commission setting) goes before the number from Xero
  const full = withPrefix(n, commState().settings.invPrefix);
  const err = !n.trim() ? 'Enter the invoice number from Xero.' : taken.includes(full) ? 'That number is already used.' : null;
  const submit = () => {
    setTried(true);
    if (!err) go(full);
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
        <Field id="cxero-no" label="Invoice number (from Xero)" required error={tried ? err : null} hint={`Raise the invoice in Xero, then enter its number here.${commState().settings.invPrefix ? ` It’s saved as ${full || `${commState().settings.invPrefix}…`}.` : ''}`}>
          <TextInput id="cxero-no" value={n} invalid={tried && !!err} onChange={(e) => setN(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

type Draft = { side: 'uni' | 'rp' | ''; type: (typeof TX_TYPES)[number]; amount: number | null; period: number | null; date: string };
/**
 * Add lines (Jovial, 17 Nov, after the Finance demo): what the rules don't make, added to an application by hand, one
 * or several at once, with why. A University → GSP line gives the RP its usual share.
 */
export function AddLinesSheet({ app, res, by, onClose, onDone, ask, side }: { app: string | null; res: Result; by: string; onClose: () => void; onDone: (msg: string) => void; ask: AskFn; side?: 'uni' | 'rp' }) {
  // Jovial and Suman, 19 Nov: the side follows where Add lines was opened from (an RP line: GSP → RP); otherwise it's chosen
  const blank = (): Draft => ({ side: side ?? '', type: TX_TYPES[0], amount: null, period: null, date: todayIso() });
  const [rows, setRows] = useState<Draft[]>([blank()]);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setRows([blank()]);
    setReason('');
    setTried(false);
  }, [app, side]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!app) return null;
  const a = res.byApp.get(app);
  const cur = a?.summary.currency ?? '';
  const rowErr = (r: Draft) => (!r.side ? 'Choose the side.' : r.amount == null || Number.isNaN(r.amount) || r.amount === 0 ? 'Enter the amount (a minus for a credit).' : !r.date ? 'Choose the date it’s due from.' : null);
  const err = { rows: rows.some(rowErr) ? 'Check each line.' : null, reason: reason.trim() ? null : 'Say why the rules don’t make this line.' };
  const set = (i: number, p: Partial<Draft>) => setRows((x) => x.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const go = () => {
    setTried(true);
    if (err.rows || err.reason) return;
    ask(`Add ${rows.length} ${rows.length === 1 ? 'line' : 'lines'} to ${a?.student ?? app}?`, 'Add', <p>{rows.map((r) => `${r.side ? SIDES[r.side] : ''}: ${r.type === 'Clawback' && r.side === 'rp' ? 'Clawback (a recovery)' : r.type}, ${money(MINUS_TYPES.includes(r.type) ? -Math.abs(r.amount!) : r.amount!, cur)}`).join('; ')}. They’re worked like any other line, and logged with why.{rows.some((r) => r.type === 'Clawback' && r.side === 'rp') ? ' A clawback from the RP is taken off its next invoice request.' : ''}</p>, () => {
      addLines(app, rows.map((r) => ({ side: r.side as 'uni' | 'rp', type: r.type, amount: r.amount!, period: r.period ?? undefined, date: r.date })), reason.trim(), by);
      onDone(`${rows.length} ${rows.length === 1 ? 'line' : 'lines'} added to ${app}.`);
    });
  };
  return (
    <Sheet
      open
      onClose={onClose}
      center
      expandable
      className="iform"
      title="Add lines"
      sub={a ? `${a.student} · ${a.uniName}, in ${cur}` : app}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={go}>Add</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        {rows.map((r, i) => (
          <div key={i} className="iform__wide cadd__row">
            <Field id={`cadd-side-${i}`} label="Side" required>
              <SelectInput id={`cadd-side-${i}`} value={r.side} placeholder="Choose the side" invalid={tried && !r.side} onChange={(e) => set(i, { side: e.target.value as Draft['side'] })}>
                {SIDE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {SIDES[k]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id={`cadd-type-${i}`} label="Type" required>
              <SelectInput id={`cadd-type-${i}`} value={r.type} onChange={(e) => set(i, { type: e.target.value as Draft['type'] })}>
                {ADDABLE_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id={`cadd-amt-${i}`} label={`Amount (${cur})`} required error={tried ? rowErr(r) : null} hint={MINUS_TYPES.includes(r.type) ? (r.side === 'rp' ? 'Always a minus: taken off the RP’s next invoice.' : 'Always a minus.') : undefined}>
              <TextInput id={`cadd-amt-${i}`} inputMode="decimal" value={numText(r.amount)} invalid={tried && !!rowErr(r)} onChange={(e) => set(i, { amount: numOf(e.target.value) })} />
            </Field>
            <Field id={`cadd-per-${i}`} label="Study period" optional>
              <TextInput id={`cadd-per-${i}`} inputMode="numeric" value={numText(r.period)} onChange={(e) => set(i, { period: numOf(e.target.value) })} />
            </Field>
            <Field id={`cadd-date-${i}`} label="Due from" required>
              <TextInput id={`cadd-date-${i}`} type="date" value={r.date} onChange={(e) => set(i, { date: e.target.value })} />
            </Field>
            {rows.length > 1 && (
              <button type="button" className="btn btn--link" onClick={() => setRows((x) => x.filter((_, k) => k !== i))}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn--link iform__wide" onClick={() => setRows((x) => [...x, blank()])}>
          Add another line
        </button>
        <Field id="cadd-why" label="Why" required className="iform__wide" error={tried ? err.reason : null}>
          <TextInput id="cadd-why" value={reason} invalid={tried && !!err.reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** An application's own commission actions (17 Nov), on its Commission tab: Add lines and Student withdrew. Finance only. */
export function AppActions({ app, res, by }: { app: string; res: Result; by: string }) {
  const { ask, dialog } = useAsk();
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [msg, setMsg] = useState('');
  const left = (commState().withdrawals ?? []).find((w) => w.app === app);
  return (
    <div className="capp-acts">
      <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
        Add lines
      </Button>
      {left ? (
        <span className="cmuted">
          Withdrew {dayText(left.date)}, recorded by {left.by}: {left.reason}
        </span>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setLeaving(true)}>
          Student withdrew
        </Button>
      )}
      {msg && (
        <span className="cmuted" role="status">
          {msg}
        </span>
      )}
      {adding && <AddLinesSheet app={app} res={res} by={by} ask={ask} onClose={() => setAdding(false)} onDone={(m) => (setMsg(m), setAdding(false))} />}
      {leaving && <WithdrawSheet app={app} res={res} by={by} ask={ask} onClose={() => setLeaving(false)} onDone={(m) => (setMsg(m), setLeaving(false))} />}
      {dialog}
    </div>
  );
}

/**
 * Key details from Commission lines (Jovial, 17 Nov): the application's commission Key details beside the line, to see
 * and change without leaving the page. Changes go on the application and its log, as they do there. Another RP's
 * enrolment the portal doesn't hold shows its details read only.
 */
export function KeyDetailsSheet({ app, res, apps, setApps, by, onClose, say }: { app: string | null; res: Result; apps: Application[]; setApps?: (fn: (l: Application[]) => Application[]) => void; by: string; onClose: () => void; say: (m: string) => void }) {
  if (!app) return null;
  const a = apps.find((x) => x.id === app);
  const l = res.byApp.get(app);
  const update = (fn: (x: Application) => Application) => setApps?.((list) => list.map((x) => (x.id === app ? fn(x) : x)));
  const log = (text: string) => update((x) => ({ ...x, history: [...x.history, { at: Date.now(), who: 'gsp', text, by }] }));
  const m = l?.summary;
  return (
    <Sheet open onClose={onClose} center expandable className="iform" title="Key details" sub={l ? `${app} · ${l.student} · ${l.uniName}` : app}>
      {a && setApps ? (
        <dl className="cdl ckeys">
          <FeeRows a={a} me={by} currency={m?.currency ?? ''} update={update} log={log} say={say} />
        </dl>
      ) : (
        <div className="iform__grid">
          <p className="iform__wide cmuted">This enrolment isn’t an application in this portal; its details as recorded:</p>
          {m && (
            <ul className="iform__wide">
              <li>Tuition fee a year: {m.fee != null ? money(m.fee, m.currency) : 'Not added yet'}</li>
              <li>Scholarship a year: {m.scholarship != null ? money(m.scholarship, m.currency) : 'Not added yet'}</li>
              <li>Paid: {m.payUnit ?? '—'}, for {m.chargeable ?? '—'}</li>
              <li>Earned on: {m.trigger ?? '—'}</li>
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Suman, 18 Nov: an invoice number with the invoice prefix in front, unless it was typed with it. */
export const withPrefix = (n: string, prefix?: string) => {
  const x = n.trim();
  return !x || !prefix || x.toUpperCase().startsWith(prefix.toUpperCase()) ? x : `${prefix}${x}`;
};
