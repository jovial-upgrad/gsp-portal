import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { MoreMenu } from '../../components/MoreMenu';
import { Sheet } from '../../components/Sheet';
import { Checkbox, Field, SelectInput, TextInput } from '../../components/forms';
import { PreviewSheet } from '../../components/DocView';
import { Filter, PageHead, Pager, RecordTabs, Tiles, downloadCsv, useAsk, usePaged } from '../../institution/records/parts';
import { todayIso } from '../../institution/data/records';
import type { Application } from '../../data/applications';
import type { Student } from '../../data/students';
import { InvoiceSheet, StatusPill, numOf, numText, useCommNav, type SetupTab } from './parts';
import { addDays, setOff, sumBy, totalsText, type Tx } from './engine';
import { blankView, csvRows, filterLines, viewText, type LineView } from './lines';
import { debitNote, uniInvoice, type InvoiceDoc } from './invoice';
import { recordClawback, acceptRpInvoice, closePeriod, commWork, confirmContinuing, ctxRps, ctxUnis, logDownload, markPaid, overrideLine, raiseInvoice, recordLump, recordPayment, recordRepayment, requestInvoice, rpName, sendDebitNote, sendBackRpInvoice, sendUniInvoice, uniCurrency, uniFinanceContact, uniName, useComm, useLines, writeOff } from './store';
import { ACTION_FROM, EXCEPTIONS, IN_REVIEW, LINE_TABS, OVERDUE_UNI, PART_PAID, READY_UNI, TO_PAY, SIDES, STATUSES_OF, TX_TYPES, YES_NO, dayText, groupOf, money, roundMoney, type Side, type TxStatus, TO_RECOVER, READY_RP, ASKED_RP } from './model';
import { Unlocks } from './Unlocks';
import '../../institution/work/work.css';

type Who = { name: string; email: string; role: string; region: string };

/**
 * Commission lines (Jovial, 9 Nov: the PRD's Commissions tab): every transaction as its own line, with its commission
 * item and application. A switch between **Universities** (University → GSP) and **RPs** (GSP → RP); status tabs
 * **All**, **Estimate**, **In progress** and **Paid** with counts; filters, a search and Due between; **Export CSV** of
 * the lines shown. Ticked lines: Raise invoice and Record payment (Universities), Request invoice and Mark paid (RPs):
 * R112 (13 Nov) brings Request invoice back; the RP sees a line only once its invoice is asked for (but its first payment,
 * as an estimate).
 * RPs only: **Invoices to check**, each uploaded RP invoice to Accept or Send back. Each line's three dots: Override
 * (Commissions and Admin), History, and the application.
 *
 * Finance's to-do (Jovial, 10 Nov, D1): worklist tiles (Ready to invoice, Overdue, Part paid, Invoices to check, Approved
 * to pay, To confirm) that filter the lines; **Exceptions** (lines that can't be priced safely, held, each a T82 task);
 * **Tier periods to close** (no task: T82–T85 dropped 11 Nov) and **Students to confirm** (D19); **Record lump sum** against a university;
 * and GSP's invoice sent to the university's finance contact through Mail (D17).
 */
export function Lines({ apps, students, who, say, onOpenApp }: { apps: Application[]; students: Student[]; who: Who; say: (m: string) => void; onOpenApp?: (id: string) => void }) {
  const s = useComm();
  const res = useLines(apps, students);
  const [v, setV] = useState<LineView>(() => blankView('uni'));
  const [ticked, setTicked] = useState<string[]>([]);
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [paying, setPaying] = useState<Tx[] | null>(null);
  const [paidOut, setPaidOut] = useState<Tx[] | null>(null);
  const [paidOff, setPaidOff] = useState<Record<string, number>>({});
  const [over, setOver] = useState<Tx | null>(null);
  const [writing, setWriting] = useState<Tx | null>(null);
  const [clawing, setClawing] = useState<Tx | null>(null);
  const [history, setHistory] = useState<Tx | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; file: string } | null>(null);
  const [lump, setLump] = useState(false);
  const [tile, setTile] = useState<TileKey | ''>('');
  // Jovial, 12 Nov: two tabs, To do (the tiles and worklists) and All lines (the table)
  const [page, setPage] = useState<'todo' | 'lines' | 'unlocks'>('todo');
  const nav = useCommNav();
  const work = useMemo(() => commWork(s), [s]);
  const { ask, dialog } = useAsk();
  const set = (p: Partial<LineView>) => setV((x) => ({ ...x, ...p }));
  const side = v.side;
  const shown = useMemo(() => filterLines(res.txs, v), [res, v]);
  const tabCount = (k: LineView['tab']) => filterLines(res.txs, { ...v, tab: k }).length;
  const pg = usePaged(shown, [JSON.stringify(v)]);
  useEffect(() => setTicked([]), [JSON.stringify(v)]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = shown.filter((t) => ticked.includes(t.id));
  const filtered = v.who.length + v.regions.length + v.types.length + v.statuses.length > 0 || !!v.from || !!v.to || !!v.q || !!v.lapsed;
  const clear = () => setV((x) => ({ ...blankView(x.side), tab: x.tab }));
  const onlyOne = (k: 'uni' | 'rp') => new Set(sel.map((t) => t[k])).size === 1;
  const all = (st: readonly string[]) => sel.length > 0 && sel.every((t) => st.includes(t.status));

  // what the ticked lines allow, and why not
  // Jovial, 13 Nov: a credit (a negative line) is never invoiced on its own: it goes on GSP's next invoice to that
  // university as a minus line, so an invoice needs at least one line that isn't a credit
  const raise = all(ACTION_FROM.raise) && onlyOne('uni') && sel.some((t) => t.amount > 0);
  const creditsOf = (uni: string) => res.txs.filter((t) => t.side === 'uni' && t.uni === uni && t.status === READY_UNI && t.amount < 0);
  const record = all(ACTION_FROM.record) && onlyOne('uni');
  const pay = all(ACTION_FROM.pay) && onlyOne('rp');
  // R112: lines of a kind the RP isn't shown ("What the RP sees") can't be asked for
  const hiddenSel = sel.filter((t) => t.side === 'rp' && t.rpKind === false);
  const request = all(ACTION_FROM.request) && onlyOne('rp') && !hiddenSel.length;

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
    const credits = creditsOf(uni).filter((t) => !sel.some((x) => x.id === t.id));
    const lines = [...sel, ...credits];
    const ids = lines.map((t) => t.id);
    const contact = uniFinanceContact(uni);
    // D7: who entered each fee, and when, as the line's working says it
    const fees = lines.map((t) => [t.id, t.trace?.find((x) => x.h === 'Fee basis')?.t ?? ''] as const).filter(([, f]) => f);
    ask(
      `Raise an invoice to ${uniName(uni)} for ${ids.length} ${ids.length === 1 ? 'line' : 'lines'}?`,
      contact ? 'Raise and send' : 'Raise',
      <>
        <p>{totalsText(sumBy(lines))}{lines.some((t) => t.gst) ? ', plus GST' : ''}{credits.length ? `, after ${credits.length} ${credits.length === 1 ? 'credit' : 'credits'} (${totalsText(sumBy(credits))}) that ${credits.length === 1 ? 'goes' : 'go'} on this invoice` : ''}. {contact ? `It goes from ${s.settings.invoiceFrom} to ${contact.email} (${contact.first} ${contact.last}, Finance and invoices), through Mail.` : 'The university has no Finance and invoices contact: download the invoice and send it yourself.'}</p>
        {fees.length > 0 && (
          <ul className="cline">
            {fees.map(([id, f]) => (
              <li key={id}>
                <span className="num">{id}</span>: {f}
              </li>
            ))}
          </ul>
        )}
      </>,
      () => {
        const number = raiseInvoice(uni, ids, who.name);
        if (contact) sendUniInvoice(number, who.name);
        const u = ctxUnis().find((x) => x.id === uni)!;
        setInv(uniInvoice({ ...s, invoices: [...s.invoices] }, { number, date: todayIso(), uni }, lines, { name: u.name, country: u.country }));
        setTicked([]);
        say(`Invoice ${number} raised for ${ids.length} ${ids.length === 1 ? 'line' : 'lines'}${contact ? ` and sent to ${contact.email}` : ''}.`);
      },
    );
  };
  /** Q132: GSP's invoice as it was raised (its number, date and lines), to look at again. */
  const viewInvoice = (number: string) => {
    const i = s.invoices.find((x) => x.number === number);
    const u = i && ctxUnis().find((x) => x.id === i.uni);
    if (!i || !u) return;
    setInv(uniInvoice(s, { number: i.number, date: i.date, uni: i.uni }, i.txs.map((id) => res.byId.get(id)).filter((x): x is Tx => !!x), { name: u.name, country: u.country }));
  };
  /** Q132: the same invoice sent again to the university's Finance contact (no new number or due date). */
  const resend = (number: string) => {
    const i = s.invoices.find((x) => x.number === number);
    if (!i) return;
    const contact = uniFinanceContact(i.uni);
    ask(
      `Send invoice ${number} to ${uniName(i.uni)} again?`,
      contact ? 'Send again' : 'Download',
      <p>{contact ? `The same invoice, dated ${dayText(i.date)}, goes from ${s.settings.invoiceFrom} to ${contact.email} (${contact.first} ${contact.last}) through Mail. Its number and due date don’t change; the send is logged on its lines.` : `${uniName(i.uni)} has no Finance and invoices contact: download the invoice and send it yourself.`}</p>,
      () => {
        if (contact) {
          sendUniInvoice(number, who.name, true);
          say(`Invoice ${number} sent again to ${contact.email}.`);
        } else viewInvoice(number);
      },
    );
  };
  // the worklist tiles (D1): each picks the side and the statuses it counts
  // R105: lines past their claim window, still unclaimed; nothing closes, Finance adjusts the books (Xero)
  const lapsed = (sd: Side) => res.txs.filter((t) => t.side === sd && t.claimLapsed).length;
  /** Q118/Q125: recoveries with nothing to set them against for the Settings' days, by RP. */
  const chaseDays = s.settings.recoveryChaseDays ?? 90;
  const toChase = res.txs.filter((t) => t.side === 'rp' && t.status === TO_RECOVER && !!t.trigger && addDays(t.trigger, chaseDays) <= todayIso());
  const chaseRps = [...new Set(toChase.map((t) => t.rp))];
  const TILE: Record<TileKey, { side: Side; statuses: TxStatus[]; label: string; n: number; tone: 'you' | 'bad' | 'uni' | 'gsp'; lapsed?: boolean }> = {
    ready: { side: 'uni', statuses: [READY_UNI], label: READY_UNI, n: res.txs.filter((t) => t.side === 'uni' && t.status === READY_UNI && t.amount >= 0).length, tone: 'you' },
    overdue: { side: 'uni', statuses: [OVERDUE_UNI], label: OVERDUE_UNI, n: res.txs.filter((t) => t.side === 'uni' && t.status === OVERDUE_UNI).length, tone: 'bad' },
    part: { side: 'uni', statuses: [PART_PAID], label: PART_PAID, n: res.txs.filter((t) => t.side === 'uni' && t.status === PART_PAID).length, tone: 'uni' },
    request: { side: 'rp', statuses: [READY_RP], label: 'Invoices to request', n: res.txs.filter((t) => t.side === 'rp' && t.status === READY_RP).length, tone: 'you' },
    check: { side: 'rp', statuses: [IN_REVIEW], label: 'Invoices to check', n: toCheck.length, tone: 'you' },
    approved: { side: 'rp', statuses: [...TO_PAY], label: 'Approved to pay', n: res.txs.filter((t) => t.side === 'rp' && (TO_PAY as readonly string[]).includes(t.status)).length, tone: 'gsp' },
    confirm: { side: 'uni', statuses: [], label: 'To confirm', n: work.confirm.length, tone: 'you' },
    chase: { side: 'rp', statuses: [], label: 'Recoveries to chase', n: toChase.length, tone: 'bad' },
    recover: { side: 'rp', statuses: [TO_RECOVER], label: TO_RECOVER, n: res.txs.filter((t) => t.side === 'rp' && t.status === TO_RECOVER).length, tone: 'you' },
    lapsed: { side: lapsed('rp') || !lapsed('uni') ? 'rp' : 'uni', statuses: [], label: 'Past the claim window', n: lapsed('rp') + lapsed('uni'), tone: 'bad', lapsed: true },
  };
  const pickTile = (k: TileKey | '') => {
    setTile(k);
    if (!k) return setV((x) => blankView(x.side));
    // a worklist on To do: go to it; anything else opens All lines, filtered
    if (k === 'confirm' || k === 'check' || k === 'chase') return void document.getElementById(k === 'confirm' ? 'clines-confirm' : k === 'check' ? 'clines-check' : 'clines-chase')?.scrollIntoView({ block: 'start' });
    setV({ ...blankView(TILE[k].side), statuses: TILE[k].statuses, lapsed: TILE[k].lapsed });
    setPage('lines');
  };
  const todoN = (Object.keys(TILE) as TileKey[]).reduce((n, k) => n + TILE[k].n, 0) + res.exceptions.length + work.periods.length;
  // R106, R112: the RP's recoveries not yet asked for go with its next invoice request, by themselves
  const recoveriesOf = (rp: string) => res.txs.filter((t) => t.side === 'rp' && t.rp === rp && t.status === TO_RECOVER && !t.requested);
  const doRequest = () => {
    const rp = sel[0].rp;
    const lines = [...sel];
    // Q124: only a recovery in the currency of a line asked for goes with it; another waits
    const rec = recoveriesOf(rp).filter((t) => !lines.some((x) => x.id === t.id) && lines.some((x) => x.currency === t.currency));
    ask(
      `Ask ${rpName(rp)} for its invoice for ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}?`,
      'Request invoice',
      <p>
        {totalsText(sumBy(lines))}
        {rec.length ? `, less ${rec.length} ${rec.length === 1 ? 'recovery' : 'recoveries'} (${totalsText(sumBy(rec))}) that ${rec.length === 1 ? 'goes' : 'go'} with it` : ''}. {rpName(rp)} sees {lines.length === 1 ? 'it' : 'them'} on Earnings › Invoices to send and is told (N16{rec.length ? ', and N26 for the recovery' : ''}); reminders follow at {(s.settings.reminders?.rpInvoice ?? []).join(', ')} days.
      </p>,
      () => {
        requestInvoice(rp, [...lines, ...rec].map((t) => t.id), who.name);
        setTicked([]);
        say(`Invoice requested from ${rpName(rp)} for ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}${rec.length ? `, less ${rec.length} ${rec.length === 1 ? 'recovery' : 'recoveries'}` : ''}.`);
      },
    );
  };
  /**
   * Mark paid (Jovial, 13 Nov): the RP's recoveries asked for with its invoice, and (Q117) any recovery on a line being
   * paid now, come off this payment, each only up to what's paid in its currency (Q123, Q124); the rest stays To recover.
   */
  const startPay = () => {
    const rp = sel[0].rp;
    const clawedLine = (r: Tx) => res.byId.get(r.matches ?? '')?.claws;
    const cands = res.txs.filter((t) => t.side === 'rp' && t.rp === rp && t.status === TO_RECOVER && !sel.some((x) => x.id === t.id) && (!!t.requested || sel.some((x) => x.matches && x.matches === clawedLine(t))));
    const off = setOff(sel, cands);
    setPaidOff(Object.fromEntries(off));
    setPaidOut([...sel, ...cands.filter((t) => off.has(t.id)).map((t) => ({ ...t, amount: -off.get(t.id)! }))]);
  };
  const fixIn = (type: string): SetupTab | null => (EXCEPTIONS.find((x) => x.type === type)?.fix as SetupTab | undefined) ?? null;

  return (
    <div className="ipage clines">
      <PageHead title="Commission lines" lead="Every transaction GSP gets from universities and pays to RPs: Finance’s to-do.">
        <Button variant="secondary" iconLeft={<Icon name="plus" size={18} />} onClick={() => setLump(true)}>
          Record lump sum
        </Button>
        <Button variant="secondary" iconLeft={<Icon name="download" size={18} />} onClick={exportCsv}>
          Export CSV
        </Button>
      </PageHead>

      <RecordTabs
        id="clines-page"
        label="Commission lines"
        tab={page}
        setTab={(k) => (setPage(k), k === 'todo' && setTile(''))}
        tabs={[
          { key: 'todo', label: 'To do', n: todoN },
          { key: 'lines', label: 'All lines', n: res.txs.length },
          // Jovial, 13 Nov: what the next enrolments unlock, per university, with its splits
          { key: 'unlocks', label: 'Tiers to unlock', n: res.unlocks.filter((u) => u.bands.some((b) => b.more > 0)).length },
        ]}
      />

      {page === 'todo' && (
        <>
      <Tiles label="To do" value={tile} onPick={pickTile} items={(Object.keys(TILE) as TileKey[]).map((k) => ({ key: k, n: TILE[k].n, label: TILE[k].label, tone: TILE[k].n ? TILE[k].tone : 'grey' }))} />

      {work.confirm.length > 0 && (
        <section className="card irsec" aria-labelledby="clines-confirm">
          <div className="irsec__head">
            <div className="irsec__t">
              <h2 className="irsec__title" id="clines-confirm">
                Students to confirm <span className="num cmuted">({work.confirm.length})</span>
              </h2>
              <p className="irsec__note">A study period after the first is invoiced only once Finance confirms the student continues (D19).</p>
            </div>
            {work.confirm.length > 1 && (
              <Button size="sm" onClick={() => ask(`Confirm ${work.confirm.length} students continue?`, 'Confirm', <p>Their study periods become ready to invoice.</p>, () => (confirmContinuing(work.confirm, who.name), say(`${work.confirm.length} students confirmed.`)))}>
                Confirm all
              </Button>
            )}
          </div>
          {work.confirm.length ? (
            <ul className="clines__inv">
              {work.confirm.map((c) => (
                <li key={`${c.app}-${c.period}`}>
                  <Icon name="user" size={18} />
                  <span className="cinv__t">
                    <span className="iw-strong">
                      {c.student} · study period {c.period}
                    </span>
                    <span className="iw-sub">
                      <span className="num">{c.app}</span> · {c.uni} · from {dayText(c.since)} · <span className="num">{c.tx}</span>
                    </span>
                  </span>
                  <span className="cinv__acts">
                    <Button
                      size="sm"
                      onClick={() =>
                        ask(
                          `Confirm ${c.student} continues into study period ${c.period}?`,
                          'Confirm',
                          <p>Its University → GSP line ({c.tx}) becomes ready to invoice on its trigger date. Lines already invoiced don’t change.</p>,
                          () => (confirmContinuing([c], who.name), say(`${c.student} confirmed for study period ${c.period}.`)),
                        )
                      }
                    >
                      Confirm continuing<span className="vh"> {c.student}</span>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="iempty">No students to confirm.</p>
          )}
        </section>
      )}

      {res.exceptions.length > 0 && (
        <section className="card irsec" aria-labelledby="clines-exc">
          <div className="irsec__head">
            <div className="irsec__t">
              <h2 className="irsec__title" id="clines-exc">
                Exceptions <span className="num cmuted">({res.exceptions.length})</span>
              </h2>
              <p className="irsec__note">Lines that can’t be priced safely. Held ones wait until it’s fixed; each is a task in My work, to work within 2 working days.</p>
            </div>
          </div>
          <ul className="clines__inv">
            {res.exceptions.map((x) => {
              const tab = fixIn(x.type);
              const l = res.byApp.get(x.app);
              return (
                <li key={`${x.app}-${x.type}`}>
                  <Icon name="alert" size={18} />
                  <span className="cinv__t">
                    <span className="iw-strong">
                      {x.type}
                      {x.hold ? ' · held' : ''}
                    </span>
                    <span className="iw-sub">
                      <span className="num">{x.app}</span>
                      {l ? ` · ${l.student} · ${l.uniName}` : ''}: {x.text}
                    </span>
                  </span>
                  <span className="cinv__acts">
                    {tab && nav && (
                      <Button variant="secondary" size="sm" onClick={() => nav.setup(tab, tab === 'terms' && l ? l.uni : undefined)}>
                        Fix in Setup
                      </Button>
                    )}
                    {onOpenApp && apps.some((a) => a.id === x.app) && (
                      <Button variant="secondary" size="sm" onClick={() => onOpenApp(x.app)}>
                        Open application
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {work.periods.length > 0 && (
        <section className="card irsec" aria-labelledby="clines-close">
          <div className="irsec__head">
            <div className="irsec__t">
              <h2 className="irsec__title" id="clines-close">
                Tier periods to close <span className="num cmuted">({work.periods.length})</span>
              </h2>
              <p className="irsec__note">The count is final once closed: credits and top-ups for the period fall due at its end (Q68).</p>
            </div>
          </div>
          <ul className="clines__inv">
            {work.periods.map((p) => (
              <li key={`${p.scope}-${p.window}`}>
                <Icon name="clock" size={18} />
                <span className="cinv__t">
                  <span className="iw-strong">
                    {p.scope} · {p.window}
                  </span>
                  <span className="iw-sub">
                    Ended {dayText(p.ends)} · {p.count} {p.count === 1 ? 'student' : 'students'} counted
                  </span>
                </span>
                <span className="cinv__acts">
                  <Button size="sm" onClick={() => ask(`Close ${p.scope}’s ${p.window} tier period?`, 'Close period', <p>{p.count} {p.count === 1 ? 'student' : 'students'} counted. Lines already invoiced keep their amounts; differences become Adjustment lines.</p>, () => (closePeriod(p.scope, p.window, who.name), say(`${p.scope} ${p.window} closed.`)))}>
                    Close period<span className="vh"> {p.scope} {p.window}</span>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(s.lumps ?? []).length > 0 && (
        <section className="card irsec" aria-labelledby="clines-lumps">
          <div className="irsec__head">
            <div className="irsec__t">
              <h2 className="irsec__title" id="clines-lumps">
                Lump sums <span className="num cmuted">({s.lumps.length})</span>
              </h2>
              <p className="irsec__note">Money a university paid that isn’t one student’s line: a volume bonus, a tier true-up.</p>
            </div>
          </div>
          <ul className="clines__inv">
            {s.lumps.map((l) => (
              <li key={l.id}>
                <Icon name="wallet" size={18} />
                <span className="cinv__t">
                  <span className="iw-strong">
                    {uniName(l.uni)} · {money(l.amount, l.currency)}
                  </span>
                  <span className="iw-sub">
                    {l.reason} · {dayText(l.date)} · {l.by}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toCheck.length > 0 && (
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
                        onClick={() =>
                          ask(
                            `Accept ${rpName(i.rp)}’s invoice ${i.file.name}?`,
                            'Accept',
                            <p>
                              {txs.length} {txs.length === 1 ? 'line becomes' : 'lines become'} Approved, to pay within the agreement’s days. {rpName(i.rp)} is told (N20).
                            </p>,
                            () => (acceptRpInvoice(i.id, who.name), say(`${i.file.name} accepted: ${txs.length} ${txs.length === 1 ? 'line' : 'lines'} Approved.`)),
                          )
                        }
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

      {chaseRps.length > 0 && (
        <section className="card irsec clines__check" aria-labelledby="clines-chase">
          <div className="irsec__head">
            <div className="irsec__t">
              <h2 className="irsec__title" id="clines-chase">
                Recoveries to chase <span className="num cmuted">({toChase.length})</span>
              </h2>
              <p className="irsec__note">An RP’s share of a university’s clawback with no payment from GSP to set it against for {chaseDays} days or more (Settings). Send the RP a debit note; record it when the RP pays back.</p>
            </div>
          </div>
          <ul className="clines__inv">
            {chaseRps.map((rp) => {
              const txs = toChase.filter((t) => t.rp === rp);
              const fresh = txs.filter((t) => !t.debitNote);
              const left = sumBy(txs.map((t) => ({ ...t, amount: -t.amount - (t.recovered ?? 0) })));
              const r = ctxRps().find((x) => x.id === rp);
              return (
                <li key={rp}>
                  <Icon name="file" size={18} />
                  <span className="cinv__t">
                    <span className="iw-strong">{rpName(rp)}</span>
                    <span className="iw-sub">
                      {txs.map((t) => `${t.id}${t.debitNote ? ` (debit note ${t.debitNote})` : ''}`).join(', ')} · {totalsText(left)} to recover
                    </span>
                  </span>
                  <span className="cinv__acts">
                    {fresh.length > 0 && r && (
                      <Button
                        size="sm"
                        onClick={() =>
                          ask(
                            `Send ${rpName(rp)} a debit note for ${fresh.length} ${fresh.length === 1 ? 'recovery' : 'recoveries'}?`,
                            'Send debit note',
                            <p>{totalsText(sumBy(fresh.map((t) => ({ ...t, amount: -t.amount - (t.recovered ?? 0) }))))} to pay back. {rpName(rp)} is told (N27) and can download it on Earnings.</p>,
                            () => {
                              const number = sendDebitNote(rp, fresh.map((t) => t.id), who.name);
                              setInv(debitNote(s, r, number, fresh, todayIso()));
                              say(`Debit note ${number} sent to ${rpName(rp)}.`);
                            },
                          )
                        }
                      >
                        Send debit note<span className="vh"> to {rpName(rp)}</span>
                      </Button>
                    )}
                    {txs
                      .filter((t) => t.debitNote)
                      .map((t) => (
                        <Button
                          key={t.id}
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            ask(
                              `Record ${rpName(rp)} paying back ${t.id}?`,
                              'Record repayment',
                              <p>{money(-t.amount - (t.recovered ?? 0), t.currency)}, paid back today against debit note {t.debitNote}. The line becomes Recovered.</p>,
                              () => (recordRepayment(rp, t.id, roundMoney(-t.amount - (t.recovered ?? 0), t.currency), todayIso(), who.name), say(`${t.id} recorded as paid back.`)),
                            )
                          }
                        >
                          Paid back {t.id}
                        </Button>
                      ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {todoN === 0 && (
        <div className="snone">
          <p className="snone__title">Nothing to do</p>
          <p className="snone__text">No line needs Finance now. All lines has every line.</p>
        </div>
      )}
        </>
      )}

      {page === 'unlocks' && <Unlocks res={res} apps={apps} students={students} />}

      {page === 'lines' && (
        <>
      <div className="clines__switch" role="group" aria-label="Lines">
        {(['uni', 'rp'] as Side[]).map((k) => (
          <button key={k} type="button" className="ichip" aria-pressed={side === k} onClick={() => (setTile(''), setV(blankView(k)))}>
            {k === 'uni' ? 'Universities' : 'RPs'} <span className="num">{res.txs.filter((t) => t.side === k).length}</span>
          </button>
        ))}
      </div>

      <div className="clines__switch" role="group" aria-label="Status">
        {LINE_TABS.map((t) => (
          <button key={t.key} type="button" className="ichip" aria-pressed={v.tab === t.key} onClick={() => set({ tab: t.key })}>
            {t.label} <span className="num">{tabCount(t.key)}</span>
          </button>
        ))}
      </div>

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
                {!raise && !record && (
                  <span className="cmuted">
                    {sel.length && sel.every((t) => t.amount < 0) ? 'A credit goes on GSP’s next invoice to the university, not on its own: tick a line to invoice and it’s added.' : `Tick ${ACTION_FROM.raise.join(' or ')} lines of one university to raise an invoice, or its ${ACTION_FROM.record.join(' or ')} lines to record a payment.`}
                  </span>
                )}
              </>
            ) : (
              <>
                <Button size="sm" disabled={!request} onClick={doRequest}>
                  Request invoice
                </Button>
                <Button size="sm" variant="secondary" disabled={!pay} onClick={startPay}>
                  Mark paid
                </Button>
                {hiddenSel.length > 0 ? (
                  <span className="cmuted">
                    {hiddenSel.map((t) => t.id).join(', ')} {hiddenSel.length === 1 ? 'is a kind' : 'are kinds'} of commission {sel[0].rpName} isn’t shown (What the RP sees), so {hiddenSel.length === 1 ? 'it' : 'they'} can’t be asked for.
                  </span>
                ) : (
                  !request &&
                  !pay && (
                    <span className="cmuted">
                      {sel.every((t) => t.status === ASKED_RP) && onlyOne('rp')
                        ? `Waiting for ${sel[0].rpName}’s invoice, asked for on ${dayText(sel.map((t) => t.requested ?? '').sort()[0])}. Reminders go at ${(s.settings.reminders?.rpInvoice ?? []).join(', ')} days; when it arrives, it’s in To do › Invoices to check.`
                        : `Tick ${ACTION_FROM.request.join(' or ')} lines of one RP to ask for its invoice, or its ${ACTION_FROM.pay.join(' or ')} lines to mark them paid.`}
                    </span>
                  )
                )}
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
                        <span className="iw-sub">
                          {side === 'uni' ? t.invoice ?? '' : t.region}
                          {side === 'uni' && t.invoice && s.invoices.find((i) => i.number === t.invoice)?.sent ? ` · sent to ${s.invoices.find((i) => i.number === t.invoice)!.sent!.to}` : ''}
                        </span>
                      </td>
                      <td className="num iw-nowrap">{dayText(t.due)}</td>
                      <td className="num ctab__num">{money(t.amount, t.currency)}</td>
                      <td>
                        <StatusPill s={t.status} />
                        {t.heldWhy && <span className="iw-sub">{t.heldWhy}</span>}
                        {t.toConfirm && <span className="iw-sub">Waiting for Finance to confirm the student continues</span>}
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
                            // a Paid line never changes (9 Nov): no override
                            ...(groupOf(t.side, t.status) === 'paid' ? [] : [{ id: 'override', label: 'Override', icon: 'edit' as const, onPick: () => setOver(t) }]),
                            ...(t.status === PART_PAID ? [{ id: 'writeoff', label: 'Write off the rest', icon: 'minus' as const, onPick: () => setWriting(t) }] : []),
                            // R106: a university takes back commission it paid on this line
                            // Q132 (Jovial, 13 Nov): the invoice a line is on, to look at again or send again (same number, same due date)
                            ...(t.side === 'uni' && t.invoice ? [{ id: 'view-inv', label: 'View invoice', icon: 'eye' as const, onPick: () => viewInvoice(t.invoice!) }] : []),
                            ...(t.side === 'uni' && t.invoice && (ACTION_FROM.record as readonly string[]).includes(t.status) ? [{ id: 'resend', label: 'Send again', icon: 'send' as const, onPick: () => resend(t.invoice!) }] : []),
                            ...(t.side === 'uni' && t.type !== 'Clawback' && (groupOf(t.side, t.status) === 'paid' || t.status === PART_PAID) ? [{ id: 'clawback', label: 'Record clawback', icon: 'minus' as const, onPick: () => setClawing(t) }] : []),
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
        </>
      )}

      <InvoiceSheet doc={inv} onClose={() => setInv(null)} />
      <PaymentSheet
        txs={paying}
        onClose={() => setPaying(null)}
        ask={ask}
        reasons={s.settings.partReasons}
        onDone={(paid, short, date) => {
          const t = paying![0];
          const amount = roundMoney(Object.values(paid).reduce((n, x) => n + x, 0), t.currency);
          recordPayment(t.uni, paying!.map((x) => x.id), amount, t.currency, date, who.name, paid, short);
          const nShort = Object.keys(short).length;
          say(`${money(amount, t.currency)} from ${t.uniName} recorded: ${paying!.length - nShort} Paid${nShort ? `, ${nShort} Part paid` : ''}.`);
          setPaying(null);
          setTicked([]);
        }}
      />
      <WriteOffSheet
        t={writing}
        reasons={s.settings.partReasons}
        ask={ask}
        onClose={() => setWriting(null)}
        onDone={(amount, reason) => {
          writeOff(writing!.id, amount, writing!.currency, reason, who.name);
          say(`${money(amount, writing!.currency)} written off on ${writing!.id}.`);
          setWriting(null);
        }}
      />
      <ClawbackSheet
        t={clawing}
        already={(s.clawbacks ?? []).filter((c) => c.tx === clawing?.id).reduce((n, c) => n + c.amount, 0)}
        ask={ask}
        onClose={() => setClawing(null)}
        onDone={(amount, reason, date) => {
          recordClawback(clawing!.id, amount, clawing!.currency, reason, date, who.name);
          say(`Clawback of ${money(amount, clawing!.currency)} recorded on ${clawing!.id}. The RP’s share is set against its next payment.`);
          setClawing(null);
        }}
      />
      <PaidSheet
        txs={paidOut}
        onClose={() => setPaidOut(null)}
        ask={ask}
        onDone={(date) => {
          markPaid(paidOut![0].rp, paidOut!.map((x) => x.id), date, who.name, paidOff);
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
      <LumpSheet
        open={lump}
        onClose={() => setLump(false)}
        onSave={(uni, amount, reason, date) => {
          const cur = uniCurrency(uni);
          recordLump(uni, amount, cur, reason, date, who.name);
          say(`${money(amount, cur)} from ${uniName(uni)} recorded.`);
          setLump(false);
        }}
      />
      {preview && <PreviewSheet d={preview} open onClose={() => setPreview(null)} />}
      {dialog}
    </div>
  );
}

type TileKey = 'ready' | 'overdue' | 'part' | 'request' | 'check' | 'chase' | 'approved' | 'confirm' | 'recover' | 'lapsed';
type AskFn = ReturnType<typeof useAsk>['ask'];

/** Record lump sum: a university, the amount (in its currency), why, and the day it came in. */
function LumpSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (uni: string, amount: number, reason: string, date: string) => void }) {
  const s = useComm();
  const [uni, setUni] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayIso());
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setUni('');
    setAmount(null);
    setReason('');
    setDate(todayIso());
    setTried(false);
  }, [open]);
  const unis = ctxUnis().filter((u) => s.terms.some((t) => t.uni === u.id));
  const err = { uni: !uni ? 'Choose the university.' : null, amount: !(amount !== null && amount > 0) ? 'Enter the amount.' : null, reason: !reason.trim() ? 'Say what it’s for.' : null, date: !date || date > todayIso() ? 'A day up to today.' : null };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Sheet open={open} onClose={onClose} center className="iform" title="Record lump sum" sub="A payment that isn’t one student’s line. It’s logged against the university." footer={<Foot onClose={onClose} label="Record" onGo={() => (setTried(true), !Object.values(err).some(Boolean) && onSave(uni, amount!, reason.trim(), date))} />}>
      <div className="iform__grid">
        <Field id="clump-uni" label="University" required error={show('uni')}>
          <SelectInput id="clump-uni" value={uni} placeholder="Choose the university" invalid={!!show('uni')} onChange={(e) => setUni(e.target.value)}>
            {unis.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="clump-amt" label={`Amount${uni ? ` (${uniCurrency(uni)})` : ''}`} required error={show('amount')}>
          <TextInput id="clump-amt" inputMode="decimal" value={numText(amount)} invalid={!!show('amount')} onChange={(e) => setAmount(numOf(e.target.value))} />
        </Field>
        <Field id="clump-why" label="What it’s for" required error={show('reason')} className="iform__wide">
          <TextInput id="clump-why" value={reason} invalid={!!show('reason')} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field id="clump-date" label="Received on" required error={show('date')}>
          <TextInput id="clump-date" type="date" value={date} invalid={!!show('date')} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
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

/**
 * Record payment (Jovial, 10 Nov, Q44): what came in for each line (its outstanding amount to start with) and the day,
 * then asked. A line paid less needs a reason from Settings' list; it becomes Part paid, and its RP line is ready for
 * its share of what came in.
 */
function PaymentSheet({ txs, reasons, onClose, onDone, ask }: { txs: Tx[] | null; reasons: string[]; onClose: () => void; onDone: (paid: Record<string, number>, short: Record<string, string>, date: string) => void; ask: AskFn }) {
  const [paid, setPaid] = useState<Record<string, number | null>>({});
  const [short, setShort] = useState<Record<string, string>>({});
  const [date, setDate] = useState('');
  const [tried, setTried] = useState(false);
  const owed = (t: Tx) => roundMoney(t.amount - (t.received ?? 0), t.currency);
  useEffect(() => {
    setPaid(Object.fromEntries((txs ?? []).map((t) => [t.id, owed(t)])));
    setShort({});
    setDate(todayIso());
    setTried(false);
  }, [txs]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = txs?.[0]?.currency ?? '';
  const total = roundMoney((txs ?? []).reduce((n, t) => n + (paid[t.id] ?? 0), 0), cur);
  const isShort = (t: Tx) => (paid[t.id] ?? 0) < owed(t) - 0.005;
  const lineErr = (t: Tx) => {
    const v = paid[t.id];
    if (v === null || v === undefined || Number.isNaN(v) || v < 0) return 'Enter what came in (0 or more).';
    if (v > owed(t) + 0.005) return `More than the ${money(owed(t), t.currency)} still owed.`;
    if (isShort(t) && !short[t.id]) return 'Choose why it’s less.';
    return null;
  };
  const err = { lines: (txs ?? []).some(lineErr) ? 'Check each line.' : total <= 0 ? 'Enter what came in.' : null, date: !date ? 'Choose the date.' : date > todayIso() ? 'It can’t be in the future.' : null };
  const go = () => {
    setTried(true);
    if (err.lines || err.date || !txs) return;
    const nShort = txs.filter(isShort).length;
    const body = <p>{txs.length - nShort} {txs.length - nShort === 1 ? 'line becomes' : 'lines become'} Paid{nShort ? `, ${nShort} Part paid` : ''}, and the matching RP lines Ready to request for their share of what came in.</p>;
    ask(`Record ${money(total, cur)} received from ${txs[0].uniName} on ${dayText(date)}?`, 'Record payment', body, () =>
      onDone(Object.fromEntries(txs.filter((t) => (paid[t.id] ?? 0) > 0).map((t) => [t.id, roundMoney(paid[t.id] ?? 0, cur)])), Object.fromEntries(txs.filter(isShort).map((t) => [t.id, short[t.id]])), date),
    );
  };
  return (
    <Sheet open={!!txs} onClose={onClose} center expandable className="iform" title="Record payment" sub={txs ? `${txs.length} ${txs.length === 1 ? 'line' : 'lines'} from ${txs[0].uniName}: ${money(total, cur)} received` : undefined} footer={<Foot onClose={onClose} label="Record payment" onGo={go} />}>
      <div className="iform__grid">
        {(txs ?? []).map((t) => (
          <div key={t.id} className="iform__wide cpay__line">
            <Field id={`cpay-${t.id}`} label={`${t.id} · ${t.student}: received (${t.currency})`} required error={tried ? lineErr(t) : null} hint={`Still owed: ${money(owed(t), t.currency)}`}>
              <TextInput id={`cpay-${t.id}`} inputMode="decimal" value={numText(paid[t.id] ?? null)} invalid={tried && !!lineErr(t)} onChange={(e) => setPaid((x) => ({ ...x, [t.id]: numOf(e.target.value) }))} />
            </Field>
            {isShort(t) && (
              <Field id={`cpay-why-${t.id}`} label="Why it’s less" required>
                <SelectInput id={`cpay-why-${t.id}`} value={short[t.id] ?? ''} placeholder="Choose the reason" invalid={tried && !short[t.id]} onChange={(e) => setShort((x) => ({ ...x, [t.id]: e.target.value }))}>
                  {reasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
          </div>
        ))}
        <Field id="cpay-date" label="Date received" required error={tried ? err.date : null}>
          <TextInput id="cpay-date" type="date" value={date} invalid={tried && !!err.date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Write off the rest of a line paid short (Q44): the reason from Settings' list; the line counts as Paid. */
function WriteOffSheet({ t, reasons, onClose, onDone, ask }: { t: Tx | null; reasons: string[]; onClose: () => void; onDone: (amount: number, reason: string) => void; ask: AskFn }) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setReason(t?.short ?? '');
    setTried(false);
  }, [t]);
  if (!t) return null;
  const rest = roundMoney(t.amount - (t.received ?? 0), t.currency);
  const go = () => {
    setTried(true);
    if (!reason) return;
    ask(`Write off ${money(rest, t.currency)} on ${t.id}?`, 'Write off', <p>The line counts as Paid at {money(t.received ?? 0, t.currency)}. Its RP line stays at its share of what came in.</p>, () => onDone(rest, reason));
  };
  return (
    <Sheet open onClose={onClose} center className="iform" title={`Write off the rest of ${t.id}`} sub={`${t.uniName} paid ${money(t.received ?? 0, t.currency)} of ${money(t.amount, t.currency)}`} footer={<Foot onClose={onClose} label="Write off" onGo={go} />}>
      <div className="iform__grid">
        <Field id="cwo-why" label="Why" required error={tried && !reason ? 'Choose the reason.' : null}>
          <SelectInput id="cwo-why" value={reason} placeholder="Choose the reason" invalid={tried && !reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}

/** Record clawback (R106): how much the university took back on the line, why, and when. */
function ClawbackSheet({ t, already, onClose, onDone, ask }: { t: Tx | null; already: number; onClose: () => void; onDone: (amount: number, reason: string, date: string) => void; ask: AskFn }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setAmount(null);
    setReason('');
    setDate(todayIso());
    setTried(false);
  }, [t]);
  if (!t) return null;
  const most = roundMoney((t.received ?? t.amount) - already, t.currency);
  const err = {
    amount: amount === null || !(amount > 0) ? 'Enter the amount taken back.' : amount > most + 0.005 ? `At most ${money(most, t.currency)}, what’s left of what was paid.` : null,
    reason: !reason.trim() ? 'Say why, as the university does.' : null,
    date: !date ? 'Choose the date.' : date > todayIso() ? 'It can’t be in the future.' : null,
  };
  const go = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    ask(`Record a clawback of ${money(amount!, t.currency)} on ${t.id}?`, 'Record clawback', <p>{t.uniName} took it back. The RP’s share of it is set against its next payment from GSP, and the RP is told.</p>, () => onDone(amount!, reason.trim(), date));
  };
  return (
    <Sheet open onClose={onClose} center className="iform" title={`Record clawback on ${t.id}`} sub={`${t.uniName} · ${t.student} · paid ${money(t.received ?? t.amount, t.currency)}`} footer={<Foot onClose={onClose} label="Record clawback" onGo={go} />}>
      <div className="iform__grid">
        <Field id="ccb-amount" label={`Amount taken back (${t.currency})`} required error={tried ? err.amount : null}>
          <TextInput id="ccb-amount" inputMode="decimal" value={amount ?? ''} invalid={tried && !!err.amount} onChange={(e) => setAmount(e.target.value.trim() === '' ? null : Number(e.target.value.replace(/,/g, '')))} />
        </Field>
        <Field id="ccb-date" label="Date" required error={tried ? err.date : null}>
          <TextInput id="ccb-date" type="date" value={date} invalid={tried && !!err.date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="ccb-why" label="Why" required error={tried ? err.reason : null} className="iform__wide" hint="Shown to the RP with its recovery.">
          <TextInput id="ccb-why" value={reason} placeholder="Like: the student withdrew in the first semester" invalid={tried && !!err.reason} onChange={(e) => setReason(e.target.value)} />
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

/** Send back an RP's invoice, with why (free text, required): its lines show Sent back and the RP is told (N19). */
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
      sub="Its lines show Sent back, and the RP is told why."
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

