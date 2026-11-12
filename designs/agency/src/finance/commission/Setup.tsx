import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { MoreMenu } from '../../components/MoreMenu';
import { Sheet } from '../../components/Sheet';
import { CURRENCY } from '../../data/courses';
import { NoMatch, PageHead, Pill, RecordTabs, TabPanel, Tiles, useAsk } from '../../institution/records/parts';
import { todayIso } from '../../institution/data/records';
import { DocLine, LogsFold, type SetupTab } from './parts';
import { AgreementForm, GroupForm, NoticeForm, RecordForm, RpPicker, SettingsForm, TermsForm } from './forms';
import { appliesText } from './tabs';
import { noticeStatus, rpsWithoutRecord, unisWithoutTerms } from './engine';
import { acceptedRps, addNoticeRps, ctxRps, ctxUnis, deleteGroup, endNotice, ipName, removeNoticeRp, retireAgreement, rpName, uniName, useComm } from './store';
import { benefitText, bonusText, dayText, pct, ratesText, shareText, bandsText, type Notice } from './model';
import { Facts } from '../../institution/records/parts';

const TABS: { key: SetupTab; label: string }[] = [
  { key: 'rps', label: 'RP records' },
  { key: 'agreements', label: 'Agreements' },
  { key: 'notices', label: 'Notices' },
  { key: 'terms', label: 'University terms' },
  { key: 'groups', label: 'Groups' },
  { key: 'settings', label: 'Settings' },
];
export type SetupStart = { tab: SetupTab; open?: string; key: number };

/** A tab's search box. */
function Search({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="ssearch">
      <Icon name="search" size={18} />
      <span className="vh">Search</span>
      <input id={id} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Card({ count, tools, children }: { count: ReactNode; tools: ReactNode; children: ReactNode }) {
  return (
    <section className="card stable">
      <div className="stools">
        <div className="stools__row">{tools}</div>
        <p className="stools__count" role="status">
          {count}
        </p>
      </div>
      {children}
    </section>
  );
}
const has = (q: string, ...xs: (string | undefined)[]) => !q.trim() || xs.some((x) => (x ?? '').toLowerCase().includes(q.trim().toLowerCase()));

/**
 * Finance › Setup (Jovial, 9 Nov: the PRD's Commissions tab): one page with four tabs, **RP records**, **Agreements**,
 * **Notices** and **University terms**, each with a search box, a table, an Add button and **Logs ({n})** at its foot.
 * Commissions keeps every record the commission engine reads here. `start` opens a tab (and a record's form) from a
 * Commission tab's Edit in Setup.
 */
export function Setup({ me, say, start, openRp }: { me: string; say: (m: string) => void; start?: SetupStart; openRp?: (id: string) => void }) {
  const s = useComm();
  const [tab, setTab] = useState<SetupTab>(start?.tab ?? 'rps');
  const [q, setQ] = useState('');
  const [tile, setTile] = useState<'missing' | ''>('');
  const [recForm, setRecForm] = useState<{ rp: string | null; preset?: string } | null>(null);
  const [agForm, setAgForm] = useState<{ id: string | null } | null>(null);
  const [ntForm, setNtForm] = useState<{ id: string | null } | null>(null);
  const [ntRps, setNtRps] = useState<string | null>(null);
  const [tmForm, setTmForm] = useState<{ uni: string | null; preset?: string } | null>(null);
  const [grForm, setGrForm] = useState<{ id: string | null } | null>(null);
  const [stForm, setStForm] = useState(false);
  const { ask, dialog } = useAsk();
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!start || start.key === seen.current) return;
    seen.current = start.key;
    setTab(start.tab);
    setQ('');
    setTile('');
    const o = start.open;
    if (!o) return;
    const isNew = o.startsWith('new:');
    const id = o.replace(/^new:/, '');
    if (start.tab === 'rps') setRecForm(isNew ? { rp: null, preset: id } : { rp: id });
    if (start.tab === 'terms') setTmForm(isNew ? { uni: null, preset: id } : { uni: id });
  }, [start?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (k: SetupTab) => {
    setTab(k);
    setQ('');
    setTile('');
  };
  const today = todayIso();
  const logs = (area: string) => s.logs.filter((l) => l.area === area);
  const counts: Record<SetupTab, number | undefined> = { rps: s.records.length, agreements: s.agreements.length, notices: s.notices.length, terms: s.terms.length, groups: s.groups.length, settings: undefined };

  /* RP records */
  const rpRows = useMemo(() => {
    const rps = ctxRps();
    return s.records.map((r) => ({ r, rp: rps.find((x) => x.id === r.rp)!, ag: s.agreements.find((a) => a.id === r.agreement), notices: s.notices.filter((n) => n.rps.includes(r.rp)).length })).filter((x) => x.rp);
  }, [s]);
  const withoutRecord = rpsWithoutRecord(s, acceptedRps());

  /* University terms: every university, its terms or Missing */
  const unis = ctxUnis();
  const withoutTerms = unisWithoutTerms(s, unis);

  const rpsTab = (
    <>
      <p className="cline">One record per RP: the agreement it was issued and the notices it may use.</p>
      <Tiles label="RP records" value={tile} onPick={setTile} items={[{ key: 'missing', n: withoutRecord.length, label: `${withoutRecord.length === 1 ? 'RP' : 'RPs'} without a record`, sub: 'An accepted agreement and no record yet', tone: withoutRecord.length ? 'you' : 'grey' }]} />
      <Card
        count={tile ? `${withoutRecord.length} without a record` : `${rpRows.length} records`}
        tools={<Search id="cset-rp-q" value={q} onChange={setQ} placeholder="RP name or RP ID" />}
      >
        {tile ? (
          withoutRecord.filter((r) => has(q, r.name, r.code)).length ? (
            <div className="stab-wrap">
              <table className="itab">
                <thead>
                  <tr>
                    <th scope="col">RP</th>
                    <th scope="col">Sales region</th>
                    <th scope="col">Agreement accepted</th>
                    <th scope="col">
                      <span className="vh">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {withoutRecord
                    .filter((r) => has(q, r.name, r.code))
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="iw-strong">{r.name}</span>
                          <span className="iw-sub num">{r.code}</span>
                        </td>
                        <td>{r.region}</td>
                        <td className="num">{dayText(ctxRps().find((x) => x.id === r.id)!.agreements.find((a) => a.status === 'accepted')?.effective ?? today)}</td>
                        <td className="iw-acts">
                          <button type="button" className="btn btn--link" onClick={() => setRecForm({ rp: null, preset: r.id })}>
                            Add RP record<span className="vh"> for {r.name}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoMatch what="RPs" onClear={() => setQ('')} />
          )
        ) : rpRows.filter((x) => has(q, x.rp.name, x.rp.code)).length ? (
          <div className="stab-wrap">
            <table className="itab">
              <thead>
                <tr>
                  <th scope="col">RP</th>
                  <th scope="col">Sales region</th>
                  <th scope="col">Agreement</th>
                  <th scope="col">Notices</th>
                  <th scope="col">Own terms</th>
                  <th scope="col">From</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rpRows
                  .filter((x) => has(q, x.rp.name, x.rp.code))
                  .map(({ r, rp, ag, notices }) => (
                    <tr key={r.rp}>
                      <td>
                        <span className="iw-strong">{rp.name}</span>
                        <span className="iw-sub num">{rp.code}</span>
                      </td>
                      <td>{rp.region}</td>
                      <td>
                        {ag?.name}
                        {ag?.status === 'Retired' && <span className="iw-sub">Retired</span>}
                      </td>
                      <td className="num">{notices}</td>
                      <td>{[r.ownFlat != null ? `Own flat ${pct(r.ownFlat)}` : '', r.annuityPct != null ? `${pct(r.annuityPct)} after year 1` : ''].filter(Boolean).join(', ') || <span className="cmuted">—</span>}</td>
                      <td className="num iw-nowrap">{dayText(r.from)}</td>
                      <td className="iw-acts">
                        <MoreMenu
                          id={`cset-rp-${r.rp}`}
                          label={`More for ${rp.name}`}
                          items={[
                            { id: 'edit', label: 'Edit', icon: 'edit', onPick: () => setRecForm({ rp: r.rp }) },
                            ...(openRp ? [{ id: 'open', label: 'Open RP', icon: 'external' as const, onPick: () => openRp(r.rp) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NoMatch what="RP records" onClear={() => setQ('')} />
        )}
      </Card>
      <LogsFold id="cset-rp-logs" logs={logs('rps')} />
    </>
  );

  const agRows = s.agreements.filter((a) => has(q, a.name));
  const agTab = (
    <>
      <p className="cline">The agreement variants GSP issues to RPs. Each RP record uses one.</p>
      <Card count={`${agRows.length} agreements`} tools={<Search id="cset-ag-q" value={q} onChange={setQ} placeholder="Agreement" />}>
        {agRows.length ? (
          <div className="stab-wrap">
            <table className="itab">
              <thead>
                <tr>
                  <th scope="col">Agreement</th>
                  <th scope="col">Share</th>
                  <th scope="col">Counted per</th>
                  <th scope="col">Retrospective</th>
                  <th scope="col">RPs</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {agRows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="iw-strong">{a.name}</span>
                      {a.doc && <span className="iw-sub">{a.doc.name}</span>}
                    </td>
                    <td>{shareText(a)}</td>
                    <td>{a.shareType === 'Flat' ? <span className="cmuted">—</span> : a.countedPer}</td>
                    <td>{a.retro ? (a.retroTop ? 'Yes, at the top band' : 'Yes') : 'No'}</td>
                    <td className="num">{s.records.filter((r) => r.agreement === a.id).length}</td>
                    <td>
                      <Pill tone={a.status === 'Active' ? 'ok' : 'grey'}>{a.status}</Pill>
                    </td>
                    <td className="iw-acts">
                      <MoreMenu
                        id={`cset-ag-${a.id}`}
                        label={`More for ${a.name}`}
                        items={[
                          { id: 'edit', label: 'Edit', icon: 'edit', onPick: () => setAgForm({ id: a.id }) },
                          ...(a.status === 'Active'
                            ? [
                                {
                                  id: 'retire',
                                  label: 'Retire',
                                  icon: 'archive' as const,
                                  danger: true,
                                  onPick: () =>
                                    ask(`Retire ${a.name}?`, 'Retire', <p>RPs on it keep it. New RP records can’t pick it.</p>, () => {
                                      retireAgreement(a.id, me);
                                      say(`${a.name} retired.`);
                                    }),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NoMatch what="agreements" onClear={() => setQ('')} />
        )}
      </Card>
      <LogsFold id="cset-ag-logs" logs={logs('agreements')} />
    </>
  );

  const ntRows = s.notices.filter((n) => has(q, n.name, n.doc.name));
  const ntTab = (
    <>
      <p className="cline">Offers for a time, to the RPs listed on each.</p>
      <Card count={`${ntRows.length} notices`} tools={<Search id="cset-nt-q" value={q} onChange={setQ} placeholder="Notice or its file" />}>
        {ntRows.length ? (
          <div className="stab-wrap">
            <table className="itab">
              <thead>
                <tr>
                  <th scope="col">Notice</th>
                  <th scope="col">Period</th>
                  <th scope="col">Applies to</th>
                  <th scope="col">Benefit</th>
                  <th scope="col">RPs</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ntRows.map((n) => {
                  const st = noticeStatus(n, today);
                  return (
                    <tr key={n.id}>
                      <td>
                        <span className="iw-strong">{n.name}</span>
                        <span className="iw-sub">{n.doc.name}</span>
                      </td>
                      <td className="num iw-nowrap">
                        {dayText(n.starts)} to {dayText(n.ends)}
                      </td>
                      <td>{appliesText(n)}</td>
                      <td>{benefitText(n)}</td>
                      <td className="num">{n.rps.length || (n.regions ?? []).join(', ')}</td>
                      <td>
                        <Pill tone={!n.issued ? 'you' : st === 'Active' ? 'ok' : st === 'Upcoming' ? 'uni' : 'grey'}>{st}</Pill>
                      </td>
                      <td className="iw-acts">
                        <MoreMenu
                          id={`cset-nt-${n.id}`}
                          label={`More for ${n.name}`}
                          items={[
                            { id: 'edit', label: 'Edit', icon: 'edit', onPick: () => setNtForm({ id: n.id }) },
                            { id: 'rps', label: 'RPs', icon: 'partner', onPick: () => setNtRps(n.id) },
                            ...(st !== 'Ended'
                              ? [
                                  {
                                    id: 'end',
                                    label: 'End now',
                                    icon: 'close' as const,
                                    danger: true,
                                    onPick: () =>
                                      ask(`End ${n.name} today?`, 'End now', <p>Enrolments after today don’t get it. Earlier ones keep it.</p>, () => {
                                        endNotice(n.id, me);
                                        say(`${n.name} ends today.`);
                                      }),
                                  },
                                ]
                              : []),
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
          <NoMatch what="notices" onClear={() => setQ('')} />
        )}
      </Card>
      <LogsFold id="cset-nt-logs" logs={logs('notices')} />
    </>
  );

  const tmRows = (tile ? withoutTerms : unis).filter((u) => has(q, u.name, ipName(u.ip)));
  const tmTab = (
    <>
      <p className="cline">What each university pays GSP. Entered before the university goes live.</p>
      <Tiles label="University terms" value={tile} onPick={setTile} items={[{ key: 'missing', n: withoutTerms.length, label: `${withoutTerms.length === 1 ? 'university' : 'universities'} without terms`, sub: 'Can’t go live until they’re entered', tone: withoutTerms.length ? 'you' : 'grey' }]} />
      <Card count={`${tmRows.length} universities`} tools={<Search id="cset-tm-q" value={q} onChange={setQ} placeholder="University or partner" />}>
        {tmRows.length ? (
          <div className="stab-wrap">
            <table className="itab">
              <thead>
                <tr>
                  <th scope="col">University</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Rates</th>
                  <th scope="col">Trigger</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Pay within</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tmRows.map((u) => {
                  const t = s.terms.find((x) => x.uni === u.id);
                  const cur = t?.currency || CURRENCY[u.country];
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="iw-strong">{u.name}</span>
                        <span className="iw-sub">{ipName(u.ip) || 'No institution partner'}</span>
                      </td>
                      <td>{cur}</td>
                      <td>{t ? ratesText(t, cur) : <span className="cmuted">—</span>}</td>
                      <td>{t?.trigger ?? <span className="cmuted">—</span>}</td>
                      <td>{t ? `${t.payUnit}, ${t.charge.unit === 'Whole course' ? 'whole course' : `${t.charge.n} ${t.charge.unit.toLowerCase()}`}` : '—'}</td>
                      <td className="num iw-nowrap">{t ? `${t.payDays} days` : '—'}</td>
                      <td>{t ? <Pill tone="ok">Entered</Pill> : <Pill tone="you">Missing</Pill>}</td>
                      <td className="iw-acts">
                        <MoreMenu
                          id={`cset-tm-${u.id}`}
                          label={`More for ${u.name}`}
                          items={[t ? { id: 'edit', label: 'Edit', icon: 'edit', onPick: () => setTmForm({ uni: u.id }) } : { id: 'add', label: 'Add University terms', icon: 'plus', onPick: () => setTmForm({ uni: null, preset: u.id }) }]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <NoMatch what="universities" onClear={() => (setQ(''), setTile(''))} />
        )}
      </Card>
      <LogsFold id="cset-tm-logs" logs={logs('terms')} />
    </>
  );

  const grRows = s.groups.filter((g) => has(q, g.name, ...g.members.map(uniName)));
  const grTab = (
    <>
      <p className="cline">Universities counted together for a tier and GSP’s group bonuses. A university is in at most one group; when its own tier and the group’s both apply, the higher wins.</p>
      <Card count={`${grRows.length} groups`} tools={<Search id="cset-gr-q" value={q} onChange={setQ} placeholder="Group or university" />}>
        {grRows.length ? (
          <div className="stab-wrap">
            <table className="itab">
              <thead>
                <tr>
                  <th scope="col">Group</th>
                  <th scope="col">Universities</th>
                  <th scope="col">Tier</th>
                  <th scope="col">Counted per</th>
                  <th scope="col">Bonus schemes</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {grRows.map((g) => {
                  const home = ctxUnis().find((u) => u.id === g.members[0])?.country;
                  const cur = home ? CURRENCY[home] : '';
                  return (
                    <tr key={g.id}>
                      <td>
                        <span className="iw-strong">{g.name}</span>
                      </td>
                      <td>{g.members.map(uniName).join(', ')}</td>
                      <td>{g.bands.length ? bandsText(g.bands) : <span className="cmuted">—</span>}</td>
                      <td>
                        {g.countedPer}
                        {g.tierPerCountry && <span className="iw-sub">Per source country</span>}
                      </td>
                      <td>{g.bonus.length ? g.bonus.map((b) => `${b.name}: ${bonusText(b, cur)}`).join('; ') : <span className="cmuted">—</span>}</td>
                      <td className="iw-acts">
                        <MoreMenu
                          id={`cset-gr-${g.id}`}
                          label={`More for ${g.name}`}
                          items={[
                            { id: 'edit', label: 'Edit', icon: 'edit', onPick: () => setGrForm({ id: g.id }) },
                            {
                              id: 'delete',
                              label: 'Delete',
                              icon: 'trash',
                              danger: true,
                              onPick: () =>
                                ask(`Delete ${g.name}?`, 'Delete', <p>Its universities are counted on their own from now. Lines already invoiced don’t change.</p>, () => {
                                  deleteGroup(g.id, me);
                                  say(`${g.name} deleted.`);
                                }),
                            },
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
          <NoMatch what="groups" onClear={() => setQ('')} />
        )}
      </Card>
      <LogsFold id="cset-gr-logs" logs={logs('groups')} />
    </>
  );

  const S = s.settings;
  const days = (d: number[]) => (d.length ? `${d.join(', ')} days` : 'None');
  const stTab = (
    <>
      <p className="cline">The rules every commission line follows, for every university and RP. Finance changes them with Edit settings; each change is logged below.</p>
      {(
        [
          ['cset-st-dates', 'Dates and shares', 'How periods are counted, and what to use when a date or a later year’s share is missing.', [
            ['Financial year starts', new Date(Date.UTC(2000, S.fyStart - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })],
            ['Census fallback', `${S.fallbackWeeks} weeks after the study period starts (an estimated date)`],
            ['RP share after year 1', S.annuity.rule === 'Flat %' && S.annuity.pct != null ? `Flat ${pct(S.annuity.pct)}` : S.annuity.rule],
          ]],
          ['cset-st-invoices', 'Invoices and tax', 'What goes on GSP’s invoices to universities, and the file size allowed for uploads.', [
            ['GST on invoices to universities', Object.entries(S.gst).map(([k, n]) => `${k} ${pct(n ?? 0)}`).join(', ') || 'None'],
            ['GSP’s invoice number', S.invoiceFormat],
            ['Invoices to universities go from', S.invoiceFrom],
            ['Largest file', `${S.maxFileMb} MB`],
          ]],
          ['cset-st-reminders', 'Reminders', 'When reminders go out: days after GSP asks the RP for an invoice, or after a payment falls due.', [
            ['Remind the RP to invoice', days(S.reminders.rpInvoice)],
            ['Remind Finance of a university payment', days(S.reminders.uniPayment)],
            ['Remind Finance to pay an RP', days(S.reminders.rpPayment)],
          ]],
          ['cset-st-lists', 'Lists in the forms', 'The choices offered when Finance sets up terms and notices or records a payment.', [
            ['Region groups', Object.entries(S.regionGroups).map(([k, c]) => `${k} (${c.join(', ')})`).join('; ') || 'None', 'wide'],
            ['Notice document types', S.docTypes.join(', ')],
            ['Student types (Australia)', S.studentTypes.join(', ') || 'None'],
            ['Part payment reasons', S.partReasons.join(', '), 'wide'],
          ]],
        ] as [string, string, string, ([string, ReactNode] | [string, ReactNode, 'wide'])[]][]
      ).map(([id, title, note, items]) => (
        <section key={id} className="card irsec" aria-labelledby={id}>
          <div className="irsec__head">
            <div className="irsec__t">
              <h2 className="irsec__title" id={id}>
                {title}
              </h2>
              <p className="irsec__note">{note}</p>
            </div>
          </div>
          <Facts items={items} />
        </section>
      ))}
      <LogsFold id="cset-st-logs" logs={logs('settings')} />
    </>
  );

  const add: Record<SetupTab, [string, () => void, 'plus' | 'edit']> = {
    rps: ['Add RP record', () => setRecForm({ rp: null }), 'plus'],
    agreements: ['Add Agreement', () => setAgForm({ id: null }), 'plus'],
    notices: ['Add Notice', () => setNtForm({ id: null }), 'plus'],
    terms: ['Add University terms', () => setTmForm({ uni: null }), 'plus'],
    groups: ['Add Group', () => setGrForm({ id: null }), 'plus'],
    settings: ['Edit settings', () => setStForm(true), 'edit'],
  };
  const notice = ntRps ? s.notices.find((n) => n.id === ntRps) ?? null : null;
  return (
    <div className="ipage csetup">
      <PageHead title="Setup" lead="Every RP’s and every university’s commission terms, the agreements GSP issues, its notices, university groups and the settings.">
        <Button iconLeft={<Icon name={add[tab][2]} size={18} />} onClick={add[tab][1]}>
          {add[tab][0]}
        </Button>
      </PageHead>
      <RecordTabs id="csetup" label="Setup" tab={tab} setTab={pick} tabs={TABS.map((t) => ({ ...t, n: counts[t.key] }))} />
      <TabPanel id="csetup" tab={tab}>
        {{ rps: rpsTab, agreements: agTab, notices: ntTab, terms: tmTab, groups: grTab, settings: stTab }[tab]}
      </TabPanel>

      <RecordForm
        open={!!recForm}
        rp={recForm?.rp ?? null}
        preset={recForm?.preset}
        me={me}
        onClose={() => setRecForm(null)}
        onAgreements={() => {
          setRecForm(null);
          pick('agreements');
        }}
        onSaved={(rp) => {
          setRecForm(null);
          setTile('');
          say(`${rpName(rp)}: commission record saved.`);
        }}
      />
      <AgreementForm
        open={!!agForm}
        edit={agForm?.id ? s.agreements.find((a) => a.id === agForm.id) ?? null : null}
        me={me}
        onClose={() => setAgForm(null)}
        onSaved={(name) => {
          setAgForm(null);
          say(`${name} saved.`);
        }}
      />
      <NoticeForm
        open={!!ntForm}
        edit={ntForm?.id ? s.notices.find((n) => n.id === ntForm.id) ?? null : null}
        me={me}
        onClose={() => setNtForm(null)}
        onSaved={(name) => {
          const isNew = !ntForm?.id;
          setNtForm(null);
          say(isNew ? `${name} saved. RP Ops issues it to the RPs next.` : `${name} saved.`);
        }}
      />
      <TermsForm
        open={!!tmForm}
        uni={tmForm?.uni ?? null}
        preset={tmForm?.preset}
        me={me}
        onClose={() => setTmForm(null)}
        onSaved={(uni) => {
          setTmForm(null);
          setTile('');
          say(`${uniName(uni)}: terms saved.`);
        }}
      />
      <GroupForm
        open={!!grForm}
        edit={grForm?.id ? s.groups.find((g) => g.id === grForm.id) ?? null : null}
        me={me}
        onClose={() => setGrForm(null)}
        onSaved={(name) => {
          setGrForm(null);
          say(`${name} saved.`);
        }}
      />
      <SettingsForm
        open={stForm}
        me={me}
        onClose={() => setStForm(false)}
        onSaved={() => {
          setStForm(false);
          say('Commission settings saved.');
        }}
      />
      <NoticeRps notice={notice} me={me} onClose={() => setNtRps(null)} say={say} ask={ask} />
      {dialog}
    </div>
  );
}

/** A notice's RP list (its three dots' RPs): Add RPs, by choosing or pasting IDs, and Remove on each (asked first). */
function NoticeRps({ notice, me, onClose, say, ask }: { notice: Notice | null; me: string; onClose: () => void; say: (m: string) => void; ask: (title: string, confirm: string, text: ReactNode, run: () => void) => void }) {
  const [adding, setAdding] = useState<string[]>([]);
  useEffect(() => setAdding([]), [notice?.id]);
  const rps = ctxRps();
  return (
    <Sheet
      open={!!notice}
      onClose={onClose}
      center
      className="iform"
      title={notice ? `${notice.name}: RPs` : ''}
      sub={notice ? `${notice.rps.length} ${notice.rps.length === 1 ? 'RP' : 'RPs'} may use it.` : undefined}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              disabled={!adding.filter((r) => !notice?.rps.includes(r)).length}
              onClick={() => {
                if (!notice) return;
                const fresh = adding.filter((r) => !notice.rps.includes(r));
                addNoticeRps(notice.id, fresh, me);
                setAdding([]);
                say(`${fresh.length} ${fresh.length === 1 ? 'RP' : 'RPs'} added to ${notice.name}.`);
              }}
            >
              Add RPs
            </Button>
          </div>
        </div>
      }
    >
      {notice && (
        <>
          {notice.doc && (
            <p className="cline">
              <DocLine file={notice.doc} label={notice.name} />
            </p>
          )}
          {notice.rps.length ? (
            <ul className="ilist">
              {notice.rps.map((id) => {
                const r = rps.find((x) => x.id === id);
                return (
                  <li key={id} className="ilist__item">
                    <Icon name="partner" size={18} />
                    <span className="ilist__t">
                      {r?.name ?? id}
                      <span className="ilist__sub num">{r?.code}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn--link idanger"
                      onClick={() =>
                        ask(`Remove ${r?.name ?? id} from ${notice.name}?`, 'Remove', <p>Its enrolments stop getting the notice’s benefit.</p>, () => {
                          removeNoticeRp(notice.id, id, me);
                          say(`${r?.name ?? id} removed from ${notice.name}.`);
                        })
                      }
                    >
                      Remove<span className="vh"> {r?.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="iempty">No RPs on this notice yet.</p>
          )}
          <p className="cform__sec">Add RPs</p>
          <RpPicker id="cnt-add" value={adding} onChange={setAdding} />
        </>
      )}
    </Sheet>
  );
}
