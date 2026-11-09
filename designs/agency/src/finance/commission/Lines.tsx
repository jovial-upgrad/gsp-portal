import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { MoreMenu } from '../../components/MoreMenu';
import { Sheet } from '../../components/Sheet';
import { Checkbox, Field, SelectInput, TextInput } from '../../components/forms';
import { PreviewSheet } from '../../components/DocView';
import { Filter, PageHead, Pager, RecordTabs, downloadCsv, useAsk, usePaged } from '../../institution/records/parts';
import { todayIso } from '../../institution/data/records';
import type { Application } from '../../data/applications';
import type { Student } from '../../data/students';
import { InvoiceSheet, StatusPill, numOf, numText } from './parts';
import { sumBy, totalsText, type Tx } from './engine';
import { blankView, csvRows, filterLines, viewText, type LineView } from './lines';
import { uniInvoice, type InvoiceDoc } from './invoice';
import { acceptRpInvoice, ctxRps, ctxUnis, logDownload, markPaid, overrideLine, raiseInvoice, recordPayment, requestInvoice, rpName, sendBackRpInvoice, uniName, useComm, useLines } from './store';
import { ACTION_FROM, LINE_TABS, SIDES, STATUSES_OF, TX_TYPES, YES_NO, dayText, groupOf, money, type Side } from './model';
import '../../institution/work/work.css';

type Who = { name: string; email: string; role: string; region: string };

/**
 * Commission lines (Jovial, 9 Nov: the PRD's Commissions tab): every transaction as its own line, with its commission
 * item and application. A switch between **Universities** (University → GSP) and **RPs** (GSP → RP); status tabs
 * **All**, **Estimate**, **In progress** and **Paid** with counts; filters, a search and Due between; **Export CSV** of
 * the lines shown. Ticked lines: Raise invoice and Record payment (Universities), Request invoice and Mark paid (RPs).
 * RPs only: **Invoices to check**, each uploaded RP invoice to Accept or Send back. Each line's three dots: Override
 * (Commissions and Admin), History, and the application.
 */
export function Lines({ apps, students, who, say, onOpenApp }: { apps: Application[]; students: Student[]; who: Who; say: (m: string) => void; onOpenApp?: (id: string) => void }) {
  const s = useComm();
  const res = useLines(apps, students);
  const [v, setV] = useState<LineView>(() => blankView('uni'));
  const [ticked, setTicked] = useState<string[]>([]);
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [paying, setPaying] = useState<Tx[] | null>(null);
  const [paidOut, setPaidOut] = useState<Tx[] | null>(null);
  const [over, setOver] = useState<Tx | null>(null);
  const [history, setHistory] = useState<Tx | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; file: string } | null>(null);
  const { ask, dialog } = useAsk();
  const set = (p: Partial<LineView>) => setV((x) => ({ ...x, ...p }));
  const side = v.side;
  const shown = useMemo(() => filterLines(res.txs, v), [res, v]);
  const tabCount = (k: LineView['tab']) => filterLines(res.txs, { ...v, tab: k }).length;
  const pg = usePaged(shown, [JSON.stringify(v)]);
  useEffect(() => setTicked([]), [JSON.stringify(v)]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = shown.filter((t) => ticked.includes(t.id));
  const filtered = v.who.length + v.regions.length + v.types.length + v.statuses.length > 0 || !!v.from || !!v.to || !!v.q;
  const clear = () => setV((x) => ({ ...blankView(x.side), tab: x.tab }));
  const onlyOne = (k: 'uni' | 'rp') => new Set(sel.map((t) => t[k])).size === 1;
  const all = (st: readonly string[]) => sel.length > 0 && sel.every((t) => st.includes(t.status));

  // what the ticked lines allow, and why not
  const raise = all(ACTION_FROM.raise) && onlyOne('uni');
  const record = all(ACTION_FROM.record) && onlyOne('uni');
  const request = all(ACTION_FROM.request) && onlyOne('rp');
  const pay = all(ACTION_FROM.pay) && onlyOne('rp');

  const whoOptions = side === 'uni' ? [...new Set(res.txs.filter((t) => t.side === 'uni').map((t) => t.uni))] : [...new Set(res.txs.filter((t) => t.side === 'rp').map((t) => t.rp))];
  const regions = [...new Set(ctxRps().map((r) => r.region))].sort();
  const toCheck = s.rpInvoices.filter((i) => i.state === 'To check');

  const exportCsv = () => {
    downloadCsv('commission-lines.csv', csvRows(shown));
    logDownload({ who: who.name, email: who.email, role: who.role, region: who.region, filters: viewText(v, (id) => (side === 'uni' ? uniName(id) : rpName(id))), records: shown.length });
    say(`commission-lines.csv downloaded: ${shown.length} ${shown.length === 1 ? 'line' : 'lines'}.`);
  };
  const doRaise = () => {
    const uni = sel[0].uni;
    const ids = sel.map((t) => t.id);
    const number = raiseInvoice(uni, ids, who.name);
    const u = ctxUnis().find((x) => x.id === uni)!;
    setInv(uniInvoice({ ...s, invoices: [...s.invoices] }, { number, date: todayIso(), uni }, sel, { name: u.name, country: u.country }));
    setTicked([]);
    say(`Invoice ${number} raised for ${ids.length} ${ids.length === 1 ? 'line' : 'lines'}.`);
  };
  const doRequest = () => {
    const rp = sel[0].rp;
    requestInvoice(rp, sel.map((t) => t.id), who.name);
    say(`Invoice requested from ${rpName(rp)} for ${sel.length} ${sel.length === 1 ? 'line' : 'lines'}.`);
    setTicked([]);
  };

  return (
    <div className="ipage clines">
      <PageHead title="Commission lines" lead="Every transaction GSP gets from universities and pays to RPs.">
        <Button variant="secondary" iconLeft={<Icon name="download" size={18} />} onClick={exportCsv}>
          Export CSV
        </Button>
      </PageHead>

      <div className="clines__switch" role="group" aria-label="Lines">
        {(['uni', 'rp'] as Side[]).map((k) => (
          <button key={k} type="button" className="ichip" aria-pressed={side === k} onClick={() => setV(blankView(k))}>
            {k === 'uni' ? 'Universities' : 'RPs'} <span className="num">{res.txs.filter((t) => t.side === k).length}</span>
          </button>
        ))}
      </div>

      {side === 'rp' && (
        <section className="card irsec clines__check" aria-labelledby="clines-check">
          <div className="irsec__head">
            <div className="irsec__t">
              <h2 className="irsec__title" id="clines-check">
                Invoices to check <span className="num cmuted">({toCheck.length})</span>
              </h2>
              <p className="irsec__note">Invoices RPs uploaded for the lines GSP requested.</p>
            </div>
          </div>
          {toCheck.length ? (
            <ul className="clines__inv">
              {toCheck.map((i) => {
                const txs = i.txs.map((id) => res.byId.get(id)).filter((x): x is Tx => !!x);
                return (
                  <li key={i.id}>
                    <Icon name="file" size={18} />
                    <span className="cinv__t">
                      <span className="iw-strong">{i.file.name}</span>
                      <span className="iw-sub">
                        {rpName(i.rp)} · {txs.map((t) => t.id).join(', ')} · {totalsText(sumBy(txs))} · sent {dayText(new Date(i.at).toISOString())}
                      </span>
                    </span>
                    <span className="cinv__acts">
                      <Button variant="secondary" size="sm" iconLeft={<Icon name="eye" size={16} />} onClick={() => setPreview({ name: `${rpName(i.rp)}: invoice`, file: i.file.name })}>
                        Preview<span className="vh"> {i.file.name}</span>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setBack(i.id)}>
                        Send back
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          acceptRpInvoice(i.id, who.name);
                          say(`${i.file.name} accepted: ${txs.length} ${txs.length === 1 ? 'line' : 'lines'} Invoice received.`);
                        }}
                      >
                        Accept
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="iempty">No invoices to check.</p>
          )}
        </section>
      )}

      <RecordTabs id="clines-tabs" label="Status" tab={v.tab} setTab={(tab) => set({ tab })} tabs={LINE_TABS.map((t) => ({ key: t.key, label: t.label, n: tabCount(t.key) }))} />

      <section className="card stable" aria-labelledby="clines-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search lines</span>
              <input id="clines-q" type="search" placeholder="Student, GSP ID, transaction ID or invoice number" value={v.q} onChange={(e) => set({ q: e.target.value })} />
            </label>
            <Filter id="clines-who" label={side === 'uni' ? 'University' : 'RP'} all={side === 'uni' ? 'All universities' : 'All RPs'} value={v.who} options={whoOptions} labels={side === 'uni' ? uniName : rpName} onChange={(who) => set({ who })} search />
            <Filter id="clines-region" label="Sales region" all="All regions" value={v.regions} options={regions} onChange={(regions) => set({ regions })} />
            <Filter id="clines-type" label="Type" all="All types" value={v.types} options={TX_TYPES} onChange={(types) => set({ types })} />
            <Filter id="clines-status" label="Status" all="All statuses" value={v.statuses} options={STATUSES_OF[side]} onChange={(statuses) => set({ statuses })} />
            <div className="clines__dates" role="group" aria-label="Due between">
              <TextInput id="clines-from" type="date" aria-label="Due from" value={v.from} onChange={(e) => set({ from: e.target.value })} />
              <span className="cmuted">to</span>
              <TextInput id="clines-to" type="date" aria-label="Due to" value={v.to} onChange={(e) => set({ to: e.target.value })} />
            </div>
            {filtered && (
              <button type="button" className="btn btn--link" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
          <p className="stools__count" id="clines-count" role="status">
            <span className="num">{shown.length}</span> {shown.length === 1 ? 'line' : 'lines'} · {totalsText(sumBy(shown.filter((t) => groupOf(t.side, t.status) !== 'none')))}
          </p>
        </div>

        {sel.length > 0 && (
          <div className="iw-bulk clines__acts" role="status">
            <span>
              <span className="num iw-strong iw-inline">{sel.length}</span> ticked · {totalsText(sumBy(sel))}
            </span>
            {side === 'uni' ? (
              <>
                <Button size="sm" disabled={!raise} onClick={doRaise}>
                  Raise invoice
                </Button>
                <Button size="sm" variant="secondary" disabled={!record} onClick={() => setPaying(sel)}>
                  Record payment
                </Button>
                {!raise && !record && <span className="cmuted">Tick {ACTION_FROM.raise.join(' or ')} lines of one university to raise an invoice, or its {ACTION_FROM.record.join(' or ')} lines to record a payment.</span>}
              </>
            ) : (
              <>
                <Button size="sm" disabled={!request} onClick={doRequest}>
                  Request invoice
                </Button>
                <Button size="sm" variant="secondary" disabled={!pay} onClick={() => setPaidOut(sel)}>
                  Mark paid
                </Button>
                {!request && !pay && <span className="cmuted">Tick {ACTION_FROM.request.join(' or ')} lines of one RP to request its invoice, or its {ACTION_FROM.pay.join(' or ')} lines to mark them paid.</span>}
              </>
            )}
            <button type="button" className="btn btn--link" onClick={() => setTicked([])}>
              Clear
            </button>
          </div>
        )}

        {shown.length ? (
          <div className="stab-wrap">
            <table className="itab">
              <thead>
                <tr>
                  <th scope="col" className="iw-tick">
                    <Checkbox id="clines-all" checked={pg.rows.length > 0 && pg.rows.every((t) => ticked.includes(t.id))} onChange={(on) => setTicked(on ? [...new Set([...ticked, ...pg.rows.map((t) => t.id)])] : ticked.filter((x) => !pg.rows.some((t) => t.id === x)))}>
                      <span className="vh">Tick every line on this page</span>
                    </Checkbox>
                  </th>
                  <th scope="col">Transaction</th>
                  <th scope="col">Commission item</th>
                  <th scope="col">Application</th>
                  <th scope="col">{side === 'uni' ? 'University' : 'RP'}</th>
                  <th scope="col">Due</th>
                  <th scope="col" className="ctab__num">
                    Amount
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((t) => {
                  const canOpen = !!onOpenApp && apps.some((a) => a.id === t.app);
                  return (
                    <tr key={t.id} className={ticked.includes(t.id) ? 'is-ticked' : ''}>
                      <td className="iw-tick">
                        <Checkbox id={`clines-t-${t.id}`} checked={ticked.includes(t.id)} onChange={(on) => setTicked((x) => (on ? [...x, t.id] : x.filter((y) => y !== t.id)))}>
                          <span className="vh">Tick {t.id}</span>
                        </Checkbox>
                      </td>
                      <td>
                        <span className="iw-strong num">{t.id}</span>
                        <span className="iw-sub">{t.type}</span>
                      </td>
                      <td>
                        {SIDES[t.side]}
                        <span className="iw-sub">{t.what}</span>
                      </td>
                      <td>
                        {canOpen ? (
                          <button type="button" className="btn btn--link num" onClick={() => onOpenApp!(t.app)}>
                            {t.app}
                          </button>
                        ) : (
                          <span className="num">{t.app}</span>
                        )}{' '}
                        · {t.student}
                        <span className="iw-sub">
                          {t.uniName} · {t.course}
                        </span>
                      </td>
                      <td>
                        {side === 'uni' ? t.uniName : t.rpName}
                        <span className="iw-sub">{side === 'uni' ? t.invoice ?? '' : t.region}</span>
                      </td>
                      <td className="num iw-nowrap">{dayText(t.due)}</td>
                      <td className="num ctab__num">{money(t.amount, t.currency)}</td>
                      <td>
                        <StatusPill s={t.status} />
                        {t.override && (
                          <span className="iw-sub">
                            Overridden by {t.override.by}, {dayText(new Date(t.override.at).toISOString())}: {t.override.reason}
                          </span>
                        )}
                      </td>
                      <td className="iw-acts">
                        <MoreMenu
                          id={`clines-m-${t.id}`}
                          label={`More for ${t.id}`}
                          items={[
                            { id: 'override', label: 'Override', icon: 'edit', onPick: () => setOver(t) },
                            { id: 'history', label: 'History', icon: 'clock', onPick: () => setHistory(t) },
                            ...(canOpen ? [{ id: 'app', label: 'Open application', icon: 'external' as const, onPick: () => onOpenApp!(t.app) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="snone">
            <p className="snone__title">No lines here</p>
            <p className="snone__text">{filtered ? 'Try another search, or clear the filters.' : 'Lines show once a student enrols.'}</p>
            {filtered && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
        )}
        <Pager pg={pg} what="lines" />
      </section>

      <InvoiceSheet doc={inv} onClose={() => setInv(null)} />
      <PaymentSheet
        txs={paying}
        onClose={() => setPaying(null)}
        ask={ask}
        onDone={(amount, date) => {
          const t = paying![0];
          recordPayment(t.uni, paying!.map((x) => x.id), amount, t.currency, date, who.name);
          say(`${money(amount, t.currency)} from ${t.uniName} recorded: ${paying!.length} ${paying!.length === 1 ? 'line' : 'lines'} Paid.`);
          setPaying(null);
          setTicked([]);
        }}
      />
      <PaidSheet
        txs={paidOut}
        onClose={() => setPaidOut(null)}
        ask={ask}
        onDone={(date) => {
          markPaid(paidOut![0].rp, paidOut!.map((x) => x.id), date, who.name);
          say(`${paidOut!.length} ${paidOut!.length === 1 ? 'line' : 'lines'} marked paid to ${paidOut![0].rpName}.`);
          setPaidOut(null);
          setTicked([]);
        }}
      />
      <OverrideSheet
        t={over}
        onClose={() => setOver(null)}
        onSave={(o, was, now) => {
          overrideLine(over!.id, o, was, now, who.name);
          say(`${over!.id} overridden.`);
          setOver(null);
        }}
      />
      <SendBack
        open={!!back}
        file={s.rpInvoices.find((i) => i.id === back)?.file.name ?? ''}
        onClose={() => setBack(null)}
        onSend={(reason) => {
          const i = s.rpInvoices.find((x) => x.id === back)!;
          sendBackRpInvoice(i.id, reason, who.name);
          say(`${i.file.name} sent back to ${rpName(i.rp)}.`);
          setBack(null);
        }}
      />
      <HistorySheet t={history} onClose={() => setHistory(null)} />
      {preview && <PreviewSheet d={preview} open onClose={() => setPreview(null)} />}
      {dialog}
    </div>
  );
}

type AskFn = ReturnType<typeof useAsk>['ask'];
function Foot({ onClose, label, onGo }: { onClose: () => void; label: string; onGo: () => void }) {
  return (
    <div className="asf">
      <div className="asf__acts">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onGo}>{label}</Button>
      </div>
    </div>
  );
}

/** Record payment: the amount and the day it came in, then asked. */
function PaymentSheet({ txs, onClose, onDone, ask }: { txs: Tx[] | null; onClose: () => void; onDone: (amount: number, date: string) => void; ask: AskFn }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [tried, setTried] = useState(false);
  const total = txs ? txs.reduce((n, t) => n + t.amount, 0) : 0;
  useEffect(() => {
    setAmount(txs ? Math.round(total * 100) / 100 : null);
    setDate(todayIso());
    setTried(false);
  }, [txs]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = txs?.[0]?.currency ?? '';
  const err = { amount: !(amount !== null && amount > 0) ? 'Enter the amount received.' : null, date: !date ? 'Choose the date.' : date > todayIso() ? 'It can’t be in the future.' : null };
  const go = () => {
    setTried(true);
    if (err.amount || err.date || !txs) return;
    ask(`Record ${money(amount!, cur)} received from ${txs[0].uniName} on ${dayText(date)}?`, 'Record payment', <p>{txs.length} {txs.length === 1 ? 'line becomes' : 'lines become'} Paid, and the matching RP lines Ready to pay.</p>, () => onDone(amount!, date));
  };
  return (
    <Sheet open={!!txs} onClose={onClose} center className="iform" title="Record payment" sub={txs ? `${txs.length} ${txs.length === 1 ? 'line' : 'lines'} from ${txs[0].uniName}: ${money(Math.round(total * 100) / 100, cur)}` : undefined} footer={<Foot onClose={onClose} label="Record payment" onGo={go} />}>
      <div className="iform__grid">
        <Field id="cpay-amount" label={`Amount received (${cur})`} required error={tried ? err.amount : null}>
          <TextInput id="cpay-amount" inputMode="decimal" value={numText(amount)} invalid={tried && !!err.amount} onChange={(e) => setAmount(numOf(e.target.value))} />
        </Field>
        <Field id="cpay-date" label="Date received" required error={tried ? err.date : null}>
          <TextInput id="cpay-date" type="date" value={date} invalid={tried && !!err.date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Mark paid: the day GSP paid, then asked. */
function PaidSheet({ txs, onClose, onDone, ask }: { txs: Tx[] | null; onClose: () => void; onDone: (date: string) => void; ask: AskFn }) {
  const [date, setDate] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setDate(todayIso());
    setTried(false);
  }, [txs]);
  const err = !date ? 'Choose the date.' : date > todayIso() ? 'It can’t be in the future.' : null;
  const go = () => {
    setTried(true);
    if (err || !txs) return;
    ask(`Mark ${txs.length} ${txs.length === 1 ? 'line' : 'lines'} paid to ${txs[0].rpName}: ${totalsText(sumBy(txs))}?`, 'Mark paid', <p>Paid on {dayText(date)}. {txs[0].rpName} is told.</p>, () => onDone(date));
  };
  return (
    <Sheet open={!!txs} onClose={onClose} center className="iform" title="Mark paid" sub={txs ? `${txs.length} ${txs.length === 1 ? 'line' : 'lines'} to ${txs[0].rpName}: ${totalsText(sumBy(txs))}` : undefined} footer={<Foot onClose={onClose} label="Mark paid" onGo={go} />}>
      <div className="iform__grid">
        <Field id="cpaid-date" label="Date paid" required error={tried ? err : null}>
          <TextInput id="cpaid-date" type="date" value={date} invalid={tried && !!err} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Override one line: amount, due date, hold, and why (required). */
function OverrideSheet({ t, onClose, onSave }: { t: Tx | null; onClose: () => void; onSave: (o: { amount: number | null; due: string | null; hold: boolean; reason: string }, was: string, now: string) => void }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [due, setDue] = useState('');
  const [hold, setHold] = useState(false);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!t) return;
    setAmount(t.amount);
    setDue(t.due);
    setHold(!!t.override?.hold);
    setReason('');
    setTried(false);
  }, [t]);
  if (!t) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const err = { amount: !(amount !== null && amount >= 0) ? 'Enter the amount.' : null, due: !due ? 'Choose the date.' : null, reason: !reason.trim() ? 'Say why.' : null };
  const desc = (a: number, d: string, h: boolean) => `${money(a, t.currency)}, due ${dayText(d)}${h ? ', held' : ''}`;
  const go = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ amount: amount === t.base.amount ? null : amount, due: due === t.base.due ? null : due, hold, reason: reason.trim() }, desc(t.amount, t.due, !!t.override?.hold), desc(amount!, due, hold));
  };
  return (
    <Sheet open onClose={onClose} center className="iform" title={`Override ${t.id}`} sub={`${SIDES[t.side]} · ${t.what}`} footer={<Foot onClose={onClose} label="Save" onGo={go} />}>
      <div className="iform__grid">
        <Field id="cov-amount" label={`Amount (${t.currency})`} required error={tried ? err.amount : null} hint={`Worked out: ${money(t.base.amount, t.currency)}`}>
          <TextInput id="cov-amount" inputMode="decimal" value={numText(amount)} invalid={tried && !!err.amount} onChange={(e) => setAmount(numOf(e.target.value))} />
        </Field>
        <Field id="cov-due" label="Due date" required error={tried ? err.due : null} hint={`Worked out: ${dayText(t.base.due)}`}>
          <TextInput id="cov-due" type="date" value={due} invalid={tried && !!err.due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field id="cov-hold" label="Hold" hint="A held line never becomes ready by itself until the hold is taken off.">
          <SelectInput id="cov-hold" value={hold ? 'Yes' : 'No'} onChange={(e) => setHold(e.target.value === 'Yes')}>
            {YES_NO.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="cov-reason" label="Reason" required error={tried ? err.reason : null} className="iform__wide">
          <TextInput id="cov-reason" value={reason} invalid={tried && !!err.reason} placeholder="Like: the university paid a lower rate for this intake" onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Send back an RP's invoice, with why (required): its lines go back to Invoice requested and the RP is told. */
function SendBack({ open, file, onClose, onSend }: { open: boolean; file: string; onClose: () => void; onSend: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setReason('');
    setTried(false);
  }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title={`Send back ${file}?`}
      sub="Its lines go back to Invoice requested, and the RP is told why."
      footer={
        <Foot
          onClose={onClose}
          label="Send back"
          onGo={() => {
            setTried(true);
            if (reason.trim()) onSend(reason.trim());
          }}
        />
      }
    >
      <Field id="cback-reason" label="Reason" required error={tried && !reason.trim() ? 'Say why it’s sent back.' : null}>
        <div className="control iform__area">
          <textarea id="cback-reason" className="control__input" rows={3} value={reason} placeholder="Like: the total doesn’t match the lines" onChange={(e) => setReason(e.target.value)} />
        </div>
      </Field>
    </Sheet>
  );
}

/** A line's history: who did what to it, when. */
function HistorySheet({ t, onClose }: { t: Tx | null; onClose: () => void }) {
  const s = useComm();
  const seeded: string[] = t
    ? [
        ...s.invoices.filter((i) => i.txs.includes(t.id)).map((i) => `${i.by} raised invoice ${i.number} on ${dayText(i.date)}`),
        ...s.receipts.filter((r) => r.txs.includes(t.id)).map((r) => `${r.by} recorded the payment from ${uniName(r.uni)}, received ${dayText(r.date)}`),
        ...s.requests.filter((r) => r.txs.includes(t.id)).map((r) => `${r.by} requested ${rpName(r.rp)}’s invoice on ${dayText(r.date)}`),
        ...s.rpInvoices.filter((i) => i.txs.includes(t.id)).map((i) => `${i.by} sent ${i.file.name}${i.decided ? `; ${i.state.toLowerCase()} by ${i.decided.by}${i.reason ? `: ${i.reason}` : ''}` : ''}`),
        ...s.rpPayments.filter((p) => p.txs.includes(t.id)).map((p) => `${p.by} marked it paid on ${dayText(p.date)}`),
        ...s.overrides.filter((o) => o.tx === t.id).map((o) => `${o.by} overrode it: ${o.reason}`),
      ]
    : [];
  // each line's history is read from the records of what people did to it
  const shown = seeded;
  return (
    <Sheet open={!!t} onClose={onClose} center className="iform" title={t ? `${t.id}: history` : ''} sub={t ? `${SIDES[t.side]} · ${t.what}` : undefined}>
      {t && (shown.length ? (
        <ol className="clogs">
          {shown.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      ) : (
        <p className="iempty">Nothing done to this line yet: its status comes from {t.side === 'uni' ? 'its trigger date' : 'its university line'}.</p>
      ))}
    </Sheet>
  );
}

