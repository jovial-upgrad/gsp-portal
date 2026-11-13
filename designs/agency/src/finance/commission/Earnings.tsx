import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Checkbox, Field, SelectInput, TextInput } from '../../components/forms';
import { RecordTabs, Toast } from '../../institution/records/parts';
import { todayIso } from '../../institution/data/records';
import type { Application } from '../../data/applications';
import type { Student } from '../../data/students';
import { HOME_RP } from '../../gsp/rps';
import { ESTIMATE, FilePick, InvoiceSheet, TxTable } from './parts';
import { addDays, bandStanding, sumBy, totalsText, type RpStanding, type Tx } from './engine';
import { rpInvoice, type InvoiceDoc } from './invoice';
import { ctxOf, ctxRps, enrolmentsOf, uploadRpInvoice, useComm, useEarnAs, useLines } from './store';
import { benefitText, GROUPS, RECOVERED, IN_REVIEW, TO_INVOICE, dayText, groupOf, money, pct, type FileRef } from './model';
import '../../institution/work/work.css';

/**
 * Earnings, RP side (Jovial, 9 Nov; redesigned 11 Nov from Deepesh's review): what the RP earns, in the university's
 * currency, from the lines it's shown (its What the RP sees).
 * - **Quarters**: paid last quarter; this quarter, paid so far and still due; next quarter, expected (GSP's financial
 *   year quarters, Settings' financial year start).
 * - **Month by month / quarter by quarter**: paid (by the day GSP paid) and expected (by the due date), in one currency
 *   at a time when there are several.
 * - **What the next enrolments unlock** (Jovial, 13 Nov): its agreement's bands and bonuses at an enrolment number.
 *   (Still to come, later Coming to you, was dropped the same day: Jovial didn't need it.)
 * - **Applications**: one card each, "x of y paid", what's next; picking one narrows the lines to it.
 * - **Invoices to send** (the lines GSP asked for, with recoveries set against them, R106) and **Commission lines**
 *   with filters. No payment details: GSP and the RP exchange them by email (Q45).
 */
export function Earnings({ agency, me, apps, students }: { agency: string; me: string; apps: Application[]; students: Student[] }) {
  const s = useComm();
  const res = useLines(apps, students);
  const as = useEarnAs();
  const rp = (as && ctxRps().find((r) => r.id === as)) || ctxRps().find((r) => r.name === agency) || ctxRps().find((r) => r.name === HOME_RP) || ctxRps()[0];
  const mine = useMemo(() => res.txs.filter((t) => t.side === 'rp' && t.rp === rp.id && t.rpSees !== false).sort((a, b) => b.due.localeCompare(a.due)), [res, rp.id]);
  const [upload, setUpload] = useState(false);
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const [scale, setScale] = useState<'month' | 'quarter'>('month');
  const [focusApp, setFocusApp] = useState('');
  const [fUni, setFUni] = useState('');
  const [fGroup, setFGroup] = useState('');
  const [q, setQ] = useState('');
  const say = (text: string) => setMsg({ text, key: Date.now() });
  const today = todayIso();
  const paidOn = new Map(s.rpPayments.flatMap((p) => p.txs.map((t) => [t, p.date] as const)));
  const live = mine.filter((t) => groupOf('rp', t.status) !== 'none');
  const isPaid = (t: Tx) => groupOf('rp', t.status) === 'paid';
  /** When a line's money moves: the day GSP paid it, else its due date. */
  const when = (t: Tx) => (isPaid(t) ? paidOn.get(t.id) ?? t.due : t.due);
  // the lines GSP asked it to invoice, or sent back to invoice again (Q50); a recovery asked with them (R106)
  const inReview = mine.filter((t) => t.status === IN_REVIEW).length;
  const toSend = mine.filter((t) => ((TO_INVOICE as readonly string[]).includes(t.status) || t.type === 'Recovery') && t.status !== RECOVERED && !!t.requested && !t.rpInvoice);
  const sentBack = s.rpInvoices.filter((i) => i.rp === rp.id && i.state === 'Sent back' && i.txs.some((t) => toSend.some((x) => x.id === t)));
  // Jovial, 12 Nov: three tabs; it opens on Invoices to send when GSP has asked for an invoice
  const [tab, setTab] = useState<'overview' | 'send' | 'lines'>(() => (toSend.length ? 'send' : 'overview'));
  // Q43: where the RP stands in its agreement's bands (a flat share has none)
  const stand = useMemo(() => bandStanding(s, ctxOf(), rp.id, enrolmentsOf(apps, students)), [s, rp.id, apps, students]);

  // its terms: the agreement now and before (moves), and the issued notices it's on that haven't ended
  const rec = s.records.find((x) => x.rp === rp.id);
  const agName = (id: string) => s.agreements.find((a) => a.id === id)?.name ?? id;
  const myNotices = s.notices.filter((n) => n.issued && n.ends >= today && (n.rps.includes(rp.id) || (!n.rps.length && (n.regions ?? []).some((g) => g === rp.region || (s.settings.regionGroups[g] ?? []).includes(rp.country)))));
  /* quarters: GSP's financial year (Settings), three months each */
  const qStart = (d: string) => {
    const m = Number(d.slice(5, 7));
    const off = (((m - s.settings.fyStart) % 3) + 3) % 3;
    return addMonths(`${d.slice(0, 7)}-01`, -off);
  };
  const thisQ = qStart(today);
  const lastQ = addMonths(thisQ, -3);
  const nextQ = addMonths(thisQ, 3);
  const inQ = (d: string, start: string) => !!d && d >= start && d < addMonths(start, 3);
  const qLabel = (start: string) => `${monthShort(start)} to ${monthShort(addMonths(start, 2))} ${addMonths(start, 2).slice(0, 4)}`;
  const quarters: { key: string; title: string; sub: string; main: Record<string, number>; note: string }[] = [
    { key: 'last', title: 'Last quarter', sub: qLabel(lastQ), main: sumBy(live.filter((t) => isPaid(t) && inQ(when(t), lastQ))), note: 'Paid to you' },
    {
      key: 'this',
      title: 'This quarter',
      sub: qLabel(thisQ),
      main: sumBy(live.filter((t) => isPaid(t) && inQ(when(t), thisQ))),
      note: (() => {
        const due = sumBy(live.filter((t) => !isPaid(t) && inQ(t.due, thisQ)));
        return Object.keys(due).length ? `Paid so far. ${totalsText(due)} more due by ${dayText(addDays(addMonths(thisQ, 3), -1))}` : 'Paid so far';
      })(),
    },
    { key: 'next', title: 'Next quarter', sub: qLabel(nextQ), main: sumBy(live.filter((t) => !isPaid(t) && inQ(t.due, nextQ))), note: `Expected. ${ESTIMATE}` },
  ];

  /* the chart: one currency at a time */
  const currencies = [...new Set(live.map((t) => t.currency))];
  const [curPick, setCurPick] = useState('');
  const cur = currencies.includes(curPick) ? curPick : currencies[0] ?? '';
  const buckets = (() => {
    const step = scale === 'month' ? 1 : 3;
    const first = scale === 'month' ? addMonths(`${today.slice(0, 7)}-01`, -5) : addMonths(thisQ, -9);
    const n = scale === 'month' ? 12 : 6;
    return Array.from({ length: n }, (_, i) => {
      const start = addMonths(first, i * step);
      const end = addMonths(start, step);
      const inB = (d: string) => !!d && d >= start && d < end;
      const paid = live.filter((t) => t.currency === cur && isPaid(t) && inB(when(t))).reduce((x, t) => x + t.amount, 0);
      // not paid and already due: still to come, so it counts in this month (or quarter), not in the past
      const expected = live.filter((t) => t.currency === cur && !isPaid(t) && inB(t.due && t.due < today ? today : t.due)).reduce((x, t) => x + t.amount, 0);
      return { start, label: scale === 'month' ? monthShort(start) : `${monthShort(start)}–${monthShort(addMonths(start, 2))}`, year: start.slice(0, 4), paid, expected, now: today >= start && today < end };
    });
  })();
  const top = Math.max(1, ...buckets.map((b) => b.paid + b.expected));

  /* applications: one card each */
  const cards = useMemo(() => {
    const by = new Map<string, Tx[]>();
    live.forEach((t) => by.set(t.app, [...(by.get(t.app) ?? []), t]));
    return [...by.entries()]
      .map(([app, txs]) => {
        const paid = txs.filter(isPaid);
        const next = txs.filter((t) => !isPaid(t) && t.due).sort((a, b) => a.due.localeCompare(b.due))[0];
        return { app, student: txs[0].student, uni: txs[0].uniName, course: txs[0].course, n: txs.length, paid: paid.length, total: sumBy(txs), got: sumBy(paid), next };
      })
      .sort((a, b) => (a.next?.due ?? '9999').localeCompare(b.next?.due ?? '9999'));
  }, [live]);

  /* the lines, filtered */
  const unis = [...new Set(mine.map((t) => t.uniName))].sort();
  const groups = GROUPS.filter((g) => g.tab);
  const shown = mine.filter((t) => (!focusApp || t.app === focusApp) && (!fUni || t.uniName === fUni) && (!fGroup || groupOf('rp', t.status) === fGroup) && (!q.trim() || [t.student, t.app, t.id].some((x) => x.toLowerCase().includes(q.trim().toLowerCase()))));
  const focus = cards.find((c) => c.app === focusApp);

  return (
    <div className="ipage cearn">
      <header className="stu__head ihead">
        <div className="stu__titles">
          <h1 className="page__title">Earnings</h1>
          <p className="stu__lead">The commission {rp.name} earns on each enrolled student, and when GSP pays it. In each university’s currency.</p>
        </div>
      </header>

      <RecordTabs
        id="cearn-page"
        label="Earnings"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'send', label: 'Invoices to send', n: toSend.length },
          { key: 'lines', label: 'Commission lines', n: mine.length },
        ]}
      />

      {tab === 'overview' && (
        <>
      <div className="cearn__tiles" role="group" aria-label="Your commission by quarter">
        {quarters.map((x) => (
          <div key={x.key} className={`card cearn__tile ${x.key === 'this' ? 'is-now' : ''}`}>
            <span className="k">
              {x.title} · {x.sub}
            </span>
            <span className="n num">{totalsText(x.main) || '—'}</span>
            <span className="k">{x.note}</span>
          </div>
        ))}
      </div>

      {stand && <Unlock st={stand} />}

      {rec && (
        <section className="card irsec" aria-labelledby="cearn-terms">
          <div className="irsec__head">
            <div className="irsec__t">
              <h2 className="irsec__title" id="cearn-terms">
                Your terms
              </h2>
              <p className="irsec__note">Each student is paid on the terms in force on their intake.</p>
            </div>
          </div>
          <ul className="cearn__unis">
            <li>
              <span className="iw-strong">{agName(rec.agreement)}</span>
              <span>From {dayText(rec.from)}{rec.ownFlat != null ? `, at your own ${pct(rec.ownFlat)} of GSP’s commission` : ''}</span>
            </li>
            {[...rec.moves]
              .sort((a, b) => b.from.localeCompare(a.from))
              .map((m, i, all) => (
                <li key={m.from}>
                  <span className="iw-strong">{agName(m.agreement)}</span>
                  <span className="cmuted">
                    {dayText(m.from)} to {dayText(addDays(i === 0 ? rec.from : all[i - 1].from, -1))}: students with an intake then keep these terms
                  </span>
                </li>
              ))}
            {myNotices.map((n) => (
              <li key={n.id}>
                <span className="iw-strong">Notice: {n.name}</span>
                <span>
                  {benefitText(n)}, {dayText(n.starts)} to {dayText(n.ends)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card irsec" aria-labelledby="cearn-chart">
        <div className="irsec__head">
          <div className="irsec__t">
            <h2 className="irsec__title" id="cearn-chart">
              {scale === 'month' ? 'Month by month' : 'Quarter by quarter'}
            </h2>
            <p className="irsec__note">Paid, by the day GSP paid; expected, by the day it’s due. Expected amounts can change until GSP is paid.</p>
          </div>
          <div className="cearn__acts">
            {currencies.length > 1 && (
              <div className="cseg" role="group" aria-label="Currency">
                {currencies.map((c) => (
                  <button key={c} type="button" aria-pressed={c === cur} onClick={() => setCurPick(c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="cseg" role="group" aria-label="By month or quarter">
              <button type="button" aria-pressed={scale === 'month'} onClick={() => setScale('month')}>
                Month
              </button>
              <button type="button" aria-pressed={scale === 'quarter'} onClick={() => setScale('quarter')}>
                Quarter
              </button>
            </div>
          </div>
        </div>
        {live.length ? (
          <>
            <div className="cchart" role="img" aria-label={`${cur} paid and expected ${scale === 'month' ? 'by month' : 'by quarter'}: ${buckets.map((b) => `${b.label} ${b.year}: paid ${money(b.paid, cur)}, expected ${money(b.expected, cur)}`).join('; ')}`}>
              {buckets.map((b) => (
                <div key={b.start} className={`cchart__col ${b.now ? 'is-now' : ''}`} title={`${b.label} ${b.year}: paid ${money(b.paid, cur)}, expected ${money(b.expected, cur)}`}>
                  <div className="cchart__bar">
                    <span className="cchart__exp" style={{ height: `${(b.expected / top) * 100}%` }} />
                    <span className="cchart__paid" style={{ height: `${(b.paid / top) * 100}%` }} />
                  </div>
                  <span className="cchart__x">{b.label}</span>
                </div>
              ))}
            </div>
            <p className="cchart__key">
              <span className="cchart__sw cchart__sw--paid" /> Paid <span className="cchart__sw cchart__sw--exp" /> Expected <span className="cmuted">· {cur} · highest {money(top, cur)}</span>
            </p>
          </>
        ) : (
          <p className="iempty">Shows once one of your students enrols.</p>
        )}
      </section>

        </>
      )}

      {tab === 'send' && (
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
      )}

      {tab === 'lines' && (
        <>
      <section className="card irsec" aria-labelledby="cearn-apps">
        <div className="irsec__head">
          <div className="irsec__t">
            <h2 className="irsec__title" id="cearn-apps">
              Your students
            </h2>
            <p className="irsec__note">Pick one to see its lines.</p>
          </div>
        </div>
        {cards.length ? (
          <ul className="cearn__cards">
            {cards.map((c) => (
              <li key={c.app}>
                <button type="button" className={`card cearn__card ${focusApp === c.app ? 'is-on' : ''}`} aria-pressed={focusApp === c.app} onClick={() => setFocusApp(focusApp === c.app ? '' : c.app)}>
                  <span className="iw-strong">{c.student}</span>
                  <span className="iw-sub">
                    {c.uni} · {c.course}
                  </span>
                  <span className="cearn__prog" aria-hidden="true">
                    <span style={{ width: `${(c.paid / Math.max(1, c.n)) * 100}%` }} />
                  </span>
                  <span className="num">
                    {c.paid} of {c.n} paid · {totalsText(c.got) || '—'} of {totalsText(c.total)}
                  </span>
                  <span className="iw-sub num">{c.next ? `Next: ${money(c.next.amount, c.next.currency)}, due ${dayText(c.next.due)}` : 'All paid'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="iempty">Shows once one of your students enrols.</p>
        )}
      </section>

      <section className="card irsec" aria-labelledby="cearn-lines">
        <div className="irsec__head">
          <div className="irsec__t">
            <h2 className="irsec__title" id="cearn-lines">
              Commission lines
            </h2>
            <p className="irsec__note">{focus ? `${focus.student}, ${focus.uni}: ${focus.paid} of ${focus.n} paid.` : 'What GSP pays you, line by line, in the university’s currency.'}</p>
          </div>
          {focus && (
            <Button variant="secondary" size="sm" onClick={() => setFocusApp('')}>
              Every student
            </Button>
          )}
        </div>
        {mine.length > 0 && (
          <div className="cearn__filters">
            <TextInput id="cearn-q" aria-label="Search by student, application or transaction ID" placeholder="Student, application or transaction ID" value={q} onChange={(e) => setQ(e.target.value)} />
            <SelectInput id="cearn-uni" aria-label="University" placeholder="Every university" allowEmpty value={fUni} onChange={(e) => setFUni(e.target.value)}>
              {unis.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="cearn-status" aria-label="Status" placeholder="Every status" allowEmpty value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </SelectInput>
          </div>
        )}
        {shown.length ? (
          <TxTable txs={shown} rp rpView app caption="Your commission lines" amountNote={`To question an amount, email ${s.settings.disputeEmail} with the transaction ID.`} />
        ) : (
          <p className="iempty">{mine.length ? 'No lines match.' : 'Lines show once one of your students enrols.'}</p>
        )}
      </section>
        </>
      )}

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

/** yyyy-mm-01 moved by whole months; "Nov" for a month. */
function addMonths(d: string, n: number) {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
}
const monthShort = (d: string) => new Date(`${d.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' });

/**
 * What the RP's next enrolments unlock (Jovial, 13 Nov): from its own agreement only (its bands and its bonuses at an
 * enrolment number), counted in the agreement's window: where it stands, how many more reach each band, and whether
 * reaching one raises the enrolments it already has.
 */
function Unlock({ st }: { st: RpStanding }) {
  const nextBand = st.bands.find((b) => b.more > 0 && b.pct > st.share);
  const top = st.bands.length ? Math.max(...st.bands.map((b) => b.from)) : 0;
  const goal = nextBand?.from ?? top;
  const fill = goal ? Math.min(100, (st.count / goal) * 100) : 100;
  const raises = st.retro && (!st.retroTop || (nextBand && nextBand.from === top));
  const bonusesAhead = st.bonuses.filter((b) => b.more > 0).sort((a, b) => a.more - b.more);
  return (
    <section className="card irsec cunlock" aria-labelledby="cearn-unlock">
      <div className="irsec__head">
        <div className="irsec__t">
          <h2 className="irsec__title" id="cearn-unlock">
            {nextBand ? `${nextBand.more} more ${nextBand.more === 1 ? 'enrolment' : 'enrolments'} to reach ${pct(nextBand.pct)}` : st.bands.length ? `You’re in your top band: ${pct(st.share)}` : 'Your next bonus'}
          </h2>
          <p className="irsec__note">
            {st.count} {st.count === 1 ? 'enrolment' : 'enrolments'} counted in {st.window}
            {st.ends ? `, which ends ${dayText(st.ends)}` : ''}. From your agreement, {st.agreement}; a student who withdraws before the university pays doesn’t count.
          </p>
        </div>
      </div>
      {st.bands.length > 0 && (
        <>
          <div className="cunlock__bar" role="img" aria-label={`${st.count} of ${goal} enrolments`}>
            <span style={{ width: `${fill}%` }} />
          </div>
          <ol className="cunlock__bands">
            {st.bands.map((b) => (
              <li key={b.from} className={b.now ? 'is-now' : b.more === 0 ? 'is-done' : ''}>
                <span className="cunlock__pct num">{pct(b.pct)}</span>
                <span className="cunlock__range num">
                  {b.from}
                  {b.to == null ? '+' : `–${b.to}`} enrolments
                </span>
                <span className="cunlock__state">{b.now ? 'You’re here' : b.more === 0 ? 'Reached' : `${b.more} more`}</span>
              </li>
            ))}
          </ol>
          {nextBand && (
            <p className="cunlock__note">
              {raises
                ? `When you reach ${nextBand.from}, every enrolment counted in ${st.window} moves to ${pct(nextBand.pct)}, not just the new ones.`
                : `From your ${ordinalText(nextBand.from)} enrolment in ${st.window}, each new one earns ${pct(nextBand.pct)}; the ones before stay at their band.`}
            </p>
          )}
        </>
      )}
      {bonusesAhead.length > 0 && (
        <ul className="cearn__unis">
          {bonusesAhead.map((b) => (
            <li key={b.desc + b.nth}>
              <span className="iw-strong">{b.desc}</span>
              <span>
                {b.amount.toLocaleString('en-GB')} in the university’s currency, at your {ordinalText(b.nth)} enrolment: {b.more} more
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
const ordinalText = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
