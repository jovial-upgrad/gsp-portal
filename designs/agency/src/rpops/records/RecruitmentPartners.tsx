import { useState, type ReactNode } from 'react';
import { EditOnly, ViewOnlyProvider, useHides, useShows, useViewOnly } from '../../proto/viewOnly';
import { RpCommissionTab } from '../../finance/commission/tabs';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { CountryCombobox } from '../../components/CountryCombobox';
import { PhoneInput } from '../../components/PhoneInput';
import { MultiPick } from '../../components/MultiPick';
import { Paper } from '../../components/DocView';
import { FOUND_US, countryByName } from '../../data/partners';
import { CITIES } from '../../data/students';
import { CopyButton } from '../../institution/students/parts';
import { RP_STATUSES, dateText, todayIso, type RpStatus } from '../../institution/data/records';
import { Facts, NoMatch, Pill, RecordHead, RecordTabs, Section, TabPanel, Tiles, downloadCsv, type Tone } from '../../institution/records/parts';
import { fmtSize } from '../../screens/signup/docs';
import { BDMS, agreementsOf, allVerified, dayOf, regionOf, stampOf, type FileMeta, type OpsAgreement, type OpsDoc, type OpsRp } from './data';
import type { MasterPartner } from './masters';
import { Confirm } from './Confirm';
import { TeamSections } from './Team';
import { FileDrop, Foot, OpsHead, useOpsRecord, type OpsFocus, type OpsTarget } from './parts';

const TONE: Record<RpStatus, Tone> = { 'Not activated': 'you', Verifying: 'gsp', 'Documents sent back': 'you', Activated: 'uni', 'Agreement signed': 'ok', Rejected: 'bad', Suspended: 'bad', Dormant: 'grey' };
const RpPill = ({ s }: { s: RpStatus }) => <Pill tone={TONE[s]}>{s}</Pill>;
const DOC_TONE: Record<OpsDoc['state'], Tone> = { 'With BAP': 'gsp', Verified: 'ok', 'Sent back': 'you', Missing: 'grey' };
/** What RP Ops reads for each document's state: one with GSP is RP Ops' to verify. */
const DOC_LABEL: Record<OpsDoc['state'], string> = { 'With BAP': 'To verify', Verified: 'Verified', 'Sent back': 'Sent back', Missing: 'Missing' };
const TILES: { key: RpStatus; label: string; tone: Tone }[] = [
  { key: 'Verifying', label: 'To verify', tone: 'gsp' },
  { key: 'Not activated', label: 'Not activated', tone: 'you' },
  { key: 'Documents sent back', label: 'Sent back', tone: 'you' },
  { key: 'Activated', label: 'Not signed yet', tone: 'uni' },
  { key: 'Agreement signed', label: 'Agreement signed', tone: 'ok' },
];
const PDF_MB = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type SetRps = (fn: (l: OpsRp[]) => OpsRp[]) => void;

/**
 * RP Ops' Recruitment partners (Nesil, 4 Nov): GSP · Institution's list (which stays view only there), and a partner's
 * page where RP Ops acts. **Overview**: the details the RP gave (Edit, in a pop-up), the GSP side (BDM, with Change;
 * Admissions contact; sales region; Master Partner, with Link a Master Partner), then **Branches** and **Team**, each
 * added to, edited and removed here. **Documents**: each onboarding document to verify or send back (with a note why),
 * then the RP agreement, which can be sent once every document is verified. **Logs**: what happened.
 * 4 Nov (later): no lines under titles or fields; the list filters by status, sales region and BDM, several of each;
 * no first call; every remove and delete asks first.
 */
export function RecruitmentPartners({
  rps,
  setRps,
  mps,
  link,
  focus,
  navKey,
  open,
  scrollTop,
  say,
  me,
}: {
  rps: OpsRp[];
  setRps: SetRps;
  /** The Master Partners an RP can be linked to (Master Partners page). */
  mps: MasterPartner[];
  link: (rpId: string, mpId: string | null) => void;
  focus: OpsFocus | null;
  navKey: number;
  open: (t: OpsTarget) => void;
  scrollTop: () => void;
  say: (m: string) => void;
  me: string;
}) {
  const { cur, show, back } = useOpsRecord(focus, navKey, scrollTop, open);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [bdms, setBdms] = useState<string[]>([]);
  const rows = rps.filter((r) => {
    const t = q.trim().toLowerCase();
    if (t && ![r.name, r.city, r.code, r.contact.name].some((x) => x.toLowerCase().includes(t))) return false;
    if (status.length && !status.includes(r.status)) return false;
    if (regions.length && !regions.includes(regionOf(r.country))) return false;
    if (bdms.length && !bdms.includes(r.recruitment)) return false;
    return true;
  });
  const clear = () => (setQ(''), setStatus([]), setRegions([]), setBdms([]));

  const shown = cur ? rps.find((r) => r.id === cur.id) : undefined;
  if (cur && shown)
    return (
      <RpPage
        key={shown.id}
        r={shown}
        tab={cur.tab}
        backLabel={cur.back?.label ?? 'Recruitment partners'}
        onBack={back}
        say={say}
        me={me}
        mps={mps}
        link={link}
        open={open}
        update={(fn) => setRps((l) => l.map((x) => (x.id === shown.id ? fn(x) : x)))}
      />
    );

  return (
    <div className="ipage">
      <OpsHead title="Recruitment partners">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            downloadCsv('recruitment-partners.csv', [['Recruitment partner', 'Code', 'City', 'Country', 'Sales region', 'BDM', 'Since', 'Status', 'Contact', 'Email', 'Phone'], ...rows.map((r) => [r.name, r.code, r.city, r.country, regionOf(r.country), r.recruitment, r.since, r.status, r.contact.name, r.contact.email, r.contact.phone])]);
            say(`${rows.length} recruitment partners exported.`);
          }}
        >
          Export as CSV
        </Button>
      </OpsHead>

      <Tiles label="Where each partner is" value={status.length === 1 ? (status[0] as RpStatus) : ''} onPick={(k) => setStatus(k ? [k] : [])} items={TILES.map((t) => ({ ...t, n: rps.filter((r) => r.status === t.key).length }))} />

      <section className="card stable" aria-labelledby="orp-count">
        <div className="stools ops-tools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search recruitment partners</span>
              <input id="orp-q" type="search" placeholder="Name, city, code or contact" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <MultiPick id="orp-status" label="Status" value={status} options={[...RP_STATUSES]} onChange={setStatus} empty="All statuses" all="All statuses" />
            <MultiPick id="orp-region" label="Sales region" value={regions} options={[...new Set(rps.map((r) => regionOf(r.country)))].sort()} onChange={setRegions} empty="All sales regions" all="All sales regions" />
            <MultiPick id="orp-bdm" label="BDM" value={bdms} options={[...new Set(rps.map((r) => r.recruitment))].sort()} onChange={setBdms} empty="All BDMs" all="All BDMs" search />
          </div>
          <p className="stools__count" id="orp-count" role="status">
            <span>
              <span className="num">{rows.length === rps.length ? rps.length : `${rows.length} of ${rps.length}`}</span> recruitment partners
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <NoMatch what="recruitment partners" onClear={clear} />
        ) : (
          <div className="stab-wrap">
            <table className="itab itab--rp">
              <thead>
                <tr>
                  <th scope="col">Recruitment partner</th>
                  <th scope="col">Sales region</th>
                  <th scope="col">BDM</th>
                  <th scope="col">Since</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="irow" onClick={() => show(r.id)}>
                    <td>
                      <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(r.id))}>
                        {r.name}
                      </button>
                      <span className="irow__sub">
                        {r.city}, {r.country} · {r.code}
                      </span>
                    </td>
                    <td>{regionOf(r.country)}</td>
                    <td>{r.recruitment}</td>
                    <td className="num ops-nowrap">{dateText(r.since)}</td>
                    <td>
                      <RpPill s={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type Tab = 'overview' | 'documents' | 'commission' | 'logs';
type Pop =
  | { kind: 'details' }
  | { kind: 'recruitment' }
  | { kind: 'master' }
  | { kind: 'doc-back'; doc: OpsDoc }
  | { kind: 'delete-draft'; a: OpsAgreement }
  | { kind: 'send'; draft?: OpsAgreement }
  | { kind: 'agr-back'; a: OpsAgreement }
  | { kind: 'preview'; name: string; file: string };

/** A recruitment partner, as RP Ops works it. */
function RpPage({
  r,
  tab: start,
  backLabel,
  onBack,
  say,
  me,
  mps,
  link,
  open,
  update,
}: {
  r: OpsRp;
  tab?: string;
  backLabel: string;
  onBack: () => void;
  say: (m: string) => void;
  me: string;
  mps: MasterPartner[];
  link: (rpId: string, mpId: string | null) => void;
  open: (t: OpsTarget) => void;
  update: (fn: (r: OpsRp) => OpsRp) => void;
}) {
  const [tab, setTab] = useState<Tab>(start === 'documents' || start === 'logs' ? start : 'overview');
  const [pop, setPop] = useState<Pop | null>(null);
  const showCommission = useShows('rp.commission');
  // GSP · Global Ops (6 Nov): no Documents (and agreements), no commission details
  const noDocs = useHides('rp.documents');
  const noCommissionEmail = useHides('rp.commission-email');
  // GSP · Recruitment (6 Nov): documents and agreements, and commission, to look at in an editable record
  const docsView = useHides('rp.documents.view');
  const commissionView = useHides('rp.commission.view');
  const viewOnly = useViewOnly();
  // GSP · Admissions (6 Nov): no Master Partners, so no Master Partner line
  const noMaster = useHides('rp.master');
  const close = () => setPop(null);
  const now = () => Date.now();
  const log = (x: OpsRp, what: string): OpsRp => ({ ...x, log: [...x.log, { at: now(), what }] });
  const { active, next, moving } = agreementsOf(r);
  const master = mps.find((m) => m.id === r.mp);
  const ready = allVerified(r);
  const logs = [...r.activity.map((e) => ({ when: dateText(e.at), what: e.what, t: Date.parse(e.at) })), ...r.log.map((e) => ({ when: stampOf(e.at), what: e.what, t: e.at }))].sort((a, b) => b.t - a.t);

  // documents: verify, or send back with a note; the partner's status follows
  const statusAfterDocs = (docs: OpsDoc[], was: RpStatus): RpStatus =>
    docs.some((d) => d.state === 'Sent back') ? 'Documents sent back' : docs.every((d) => d.state === 'Verified') ? (was === 'Agreement signed' ? was : 'Activated') : was;
  const decide = (d: OpsDoc, state: 'Verified' | 'Sent back', reason?: string) => {
    update((x) => {
      const docs = x.docs.map((y) => (y.name === d.name ? { ...y, state, by: me, at: now(), reason } : y));
      return log({ ...x, docs, status: statusAfterDocs(docs, x.status) }, state === 'Verified' ? `${d.name} verified by ${me}` : `${d.name} sent back by ${me}: ${reason}`);
    });
    say(state === 'Verified' ? `${d.name} verified.` : `${d.name} sent back to ${r.name}.`);
  };

  // the agreement
  const setAgreement = (id: string, fn: (a: OpsAgreement) => OpsAgreement) => update((x) => ({ ...x, agreements: x.agreements.map((a) => (a.id === id ? fn(a) : a)) }));
  const accept = (a: OpsAgreement) => {
    const effective = a.effective || todayIso();
    update((x) => {
      const first = !x.agreements.some((y) => y.status === 'accepted');
      // a newer one in force now replaces the one before it
      const agreements = x.agreements.map((y): OpsAgreement => {
        if (y.id === a.id) return { ...y, status: 'accepted', effective, decision: { by: me, at: now() } };
        return y.status === 'accepted' && effective <= todayIso() && (y.effective ?? '') <= effective ? { ...y, status: 'replaced' } : y;
      });
      return log({ ...x, agreements, status: first ? 'Agreement signed' : x.status }, `Agreement ${a.version} accepted by ${me}${effective > todayIso() ? `, active from ${dayOf(effective)}` : ''}${first ? '; partner approved' : ''}`);
    });
    say(effective > todayIso() ? `Accepted: active from ${dayOf(effective)}.` : 'Accepted: the agreement is active.');
  };
  // prototype only: the RP Admin signs it and uploads the signed copy
  const rpUploads = (a: OpsAgreement) => {
    setAgreement(a.id, (y) => ({ ...y, status: 'signed', signed: { file: { name: `${r.code}-agreement-${y.version.split(' ')[0]}-signed.pdf`, size: 1_420_000 }, on: todayIso(), by: r.contact.name, at: now() } }));
    update((x) => log(x, `Signed copy of ${a.version} uploaded by ${r.contact.name}`));
  };

  const facts = (items: [string, ReactNode][]) => <Facts items={items} />;
  const none = <span className="muted">—</span>;

  return (
    <div className="ipage irecord ops-page">
      <RecordHead back={backLabel} onBack={onBack} title={r.name} sub={`${r.city}, ${r.country} · ${r.code}`} status={<RpPill s={r.status} />} />
      <RecordTabs
        id="orptab"
        label="Recruitment partner"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          ...(noDocs ? [] : [{ key: 'documents' as Tab, label: 'Documents', n: r.docs.length, badge: r.docs.filter((d) => d.state === 'With BAP').length || undefined }]),
          // GSP · Finance (6 Nov): the commission terms, the one tab it changes
          ...(showCommission ? [{ key: 'commission' as Tab, label: 'Commission' }] : []),
          { key: 'logs', label: 'Logs', n: logs.length },
        ]}
      />
      <TabPanel id="orptab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section
              title="Details"
              id="orp-details"
              action={
                <EditOnly>
                  <Button variant="secondary" iconLeft={<Icon name="edit" size={18} />} onClick={() => setPop({ kind: 'details' })}>
                    Edit<span className="vh"> the details</span>
                  </Button>
                </EditOnly>
              }
            >
              {facts([
                ['Code', <span key="c" className="num">{r.code}</span>],
                ['Name', r.name],
                ['Contact person', r.contact.name],
                [
                  'Email',
                  <span key="e" className="ifacts__copy">
                    <a href={`mailto:${r.contact.email}`}>{r.contact.email}</a>
                    <CopyButton text={r.contact.email} what="Email" onDone={say} />
                  </span>,
                ],
                ['Phone', <span key="p" className="num">{r.contact.phone}</span>],
                ['Country', r.country],
                ['State or province', r.state || none],
                ['City', r.city],
                ['Owner', r.owner || none],
                ...(noCommissionEmail ? [] : ([['Commission statements', r.cemail || none]] as [string, React.ReactNode][])),
                ['How they found GSP', r.foundUs],
                ['Onboarded on', <span key="o" className="num">{dateText(r.since)}</span>],
              ])}
            </Section>
            <Section title="GSP contacts and mapping" id="orp-gsp">
              {facts([
                [
                  'BDM',
                  <span key="r" className="ops-inline">
                    {r.recruitment}
                    <EditOnly>
                      <button type="button" className="btn btn--link" onClick={() => setPop({ kind: 'recruitment' })}>
                        Change<span className="vh"> the BDM</span>
                      </button>
                    </EditOnly>
                  </span>,
                ],
                ['Admissions contact', r.admissions],
                ['Sales region', regionOf(r.country)],
                ...(noMaster ? [] : ([
                  [
                    'Master Partner',
                    <span key="m" className="ops-inline">
                      {master ? (
                        <button type="button" className="btn btn--link ops-strong" onClick={() => open({ section: 'mps', id: master.id, back: { section: 'rps', id: r.id, label: r.name } })}>
                          {master.name}
                        </button>
                      ) : (
                        <span className="muted">None</span>
                      )}
                      <EditOnly>
                        <button type="button" className="btn btn--link" onClick={() => setPop({ kind: 'master' })}>
                          {master ? 'Change' : 'Link a Master Partner'}
                          {master && <span className="vh"> the Master Partner</span>}
                        </button>
                      </EditOnly>
                    </span>,
                  ]
                ] as [string, React.ReactNode][])),
              ])}
            </Section>
            <TeamSections r={r} update={update} log={(x, what) => log(x, `${what} by ${me}`)} say={say} />
          </>
        )}

        {tab === 'documents' && !noDocs && (
          <ViewOnlyProvider on={viewOnly || docsView}>
            <>
              <Section title="Onboarding documents" id="orp-docs">
                <ul className="ops-docs">
                  {r.docs.map((d) => (
                    <li key={d.name} className="ops-doc">
                      <Icon name="file" size={18} />
                      <span className="ops-doc__t">
                        <span className="ops-doc__name">{d.name}</span>
                        {d.state === 'Verified' && d.by && d.at && <span className="ops-doc__meta">Verified by {d.by}, {stampOf(d.at)}</span>}
                        {d.state === 'Sent back' && d.by && d.at && (
                          <span className="ops-doc__meta is-back">
                            Sent back by {d.by}, {stampOf(d.at)}
                            {d.reason ? `: ${d.reason}` : ''}
                          </span>
                        )}
                        {d.state === 'Missing' && <span className="ops-doc__meta">Not uploaded yet</span>}
                      </span>
                      <span className="ops-doc__acts">
                        {d.state !== 'Missing' && (
                          <button type="button" className="btn btn--link" onClick={() => setPop({ kind: 'preview', name: d.name, file: d.file })}>
                            Preview<span className="vh"> {d.name}</span>
                          </button>
                        )}
                        <Pill tone={DOC_TONE[d.state]}>{DOC_LABEL[d.state]}</Pill>
                        {d.state === 'With BAP' && (
                          <>
                            <EditOnly>
                              <Button variant="secondary" size="sm" onClick={() => decide(d, 'Verified')}>
                                Verify<span className="vh"> {d.name}</span>
                              </Button>
                            </EditOnly>
                            <EditOnly>
                              <Button variant="secondary" size="sm" onClick={() => setPop({ kind: 'doc-back', doc: d })}>
                                Send back<span className="vh"> {d.name}</span>
                              </Button>
                            </EditOnly>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
  
              <Section
                title="RP agreement"
                id="orp-agr"
                action={
                  <EditOnly>
                    <Button variant="secondary" iconLeft={<Icon name="upload" size={18} />} disabled={!ready || !!moving} onClick={() => setPop({ kind: 'send' })}>
                      {r.agreements.length ? 'Send new agreement' : 'Send agreement'}
                    </Button>
                  </EditOnly>
                }
              >
                {facts([
                  ['Active agreement', active ? `${active.version}, since ${dayOf(active.effective!)}` : 'None accepted yet: commission is held'],
                  ...(next ? ([['Next', `${next.version}, active from ${dayOf(next.effective!)}`]] as [string, ReactNode][]) : []),
                  ['Open now', moving ? openText(moving) : 'Nothing open'],
                ])}
                {r.agreements.length === 0 ? (
                  <p className="muted ops-empty">{ready ? 'No agreement yet.' : 'No agreement yet. Verify every document to send one.'}</p>
                ) : (
                  <div className="stab-wrap ops-agr">
                    <table className="itab ops-tab">
                      <thead>
                        <tr>
                          <th scope="col">Version</th>
                          <th scope="col">Status</th>
                          <th scope="col">Sent</th>
                          <th scope="col">Signed copy</th>
                          <th scope="col">Decision</th>
                          <th scope="col">Effective from</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...r.agreements].reverse().map((a) => (
                          <tr key={a.id}>
                            <td>
                              <button type="button" className="btn btn--link ops-strong" onClick={() => setPop({ kind: 'preview', name: `Agreement ${a.version}`, file: a.file.name })}>
                                {a.version}
                              </button>
                              <span className="irow__sub">
                                {a.file.name} · {fmtSize(a.file.size)}
                              </span>
                              {a.notes && <span className="irow__sub">{a.notes}</span>}
                            </td>
                            <td>
                              <AgrPill a={a} />
                            </td>
                            <td>{a.sent ? <Stamp t={a.sent.at} by={a.sent.by} /> : <span className="muted">Not sent</span>}</td>
                            <td>
                              {a.signed ? (
                                <span className="ops-stack">
                                  <button type="button" className="btn btn--link" onClick={() => setPop({ kind: 'preview', name: `Signed agreement ${a.version}`, file: a.signed!.file.name })}>
                                    Preview<span className="vh"> the signed copy of {a.version}</span>
                                  </button>
                                  <span className="muted">
                                    Signed {dayOf(a.signed.on)} · uploaded by {a.signed.by}, {stampOf(a.signed.at)}
                                  </span>
                                </span>
                              ) : a.status === 'sent' || a.status === 'sent-back' ? (
                                <span className="ops-stack">
                                  <span className="muted">Waiting for the RP</span>
                                  <EditOnly>
                                    <button type="button" className="ops-proto" onClick={() => rpUploads(a)}>
                                      Prototype: the RP uploads the signed copy
                                    </button>
                                  </EditOnly>
                                </span>
                              ) : (
                                none
                              )}
                            </td>
                            <td>
                              {a.status === 'signed' ? (
                                <span className="ops-acts">
                                  <EditOnly>
                                    <Button size="sm" onClick={() => accept(a)}>
                                      Accept
                                    </Button>
                                  </EditOnly>
                                  <EditOnly>
                                    <Button variant="secondary" size="sm" onClick={() => setPop({ kind: 'agr-back', a })}>
                                      Send back
                                    </Button>
                                  </EditOnly>
                                </span>
                              ) : a.status === 'draft' ? (
                                <span className="ops-acts">
                                  <EditOnly>
                                    <Button size="sm" onClick={() => setPop({ kind: 'send', draft: a })}>
                                      Send
                                    </Button>
                                  </EditOnly>
                                  <EditOnly>
                                    <Button variant="secondary" size="sm" className="ops-danger-line" onClick={() => setPop({ kind: 'delete-draft', a })}>
                                      Delete draft
                                    </Button>
                                  </EditOnly>
                                </span>
                              ) : a.decision ? (
                                <span className="ops-stack">
                                  <span>
                                    {a.status === 'sent-back' ? 'Sent back' : 'Accepted'} by {a.decision.by}
                                  </span>
                                  <span className="muted">{stampOf(a.decision.at)}</span>
                                  {a.decision.reason && <span className="ops-why">{a.decision.reason}</span>}
                                </span>
                              ) : (
                                none
                              )}
                            </td>
                            <td className="num">{a.effective ? dayOf(a.effective) : <span className="muted">On acceptance</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </>
          </ViewOnlyProvider>
        )}

        {tab === 'commission' && showCommission && (
          // 9 Nov (Jovial): the RP's commission record, read only; Commissions changes it in Setup
          <ViewOnlyProvider on={commissionView}>
            <RpCommissionTab rp={r} me={me} />
          </ViewOnlyProvider>
        )}
        {tab === 'logs' && (
          <Section title="Logs" id="orp-logs">
            <ol className="ilog">
              {logs.map((e, i) => (
                <li key={i} className="ilog__item">
                  <span className="ilog__at num">{e.when}</span>
                  <span className="ilog__what">{e.what}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </TabPanel>

      {/* the pop-ups */}
      <Sheet open={pop?.kind === 'preview'} onClose={close} center className="iform" title={pop?.kind === 'preview' ? pop.name : ''} sub={pop?.kind === 'preview' ? pop.file : undefined}>
        {pop?.kind === 'preview' && <Paper d={{ name: pop.name, file: pop.file }} />}
      </Sheet>
      <DetailsSheet
        open={pop?.kind === 'details'}
        r={r}
        onClose={close}
        onSave={(v) => {
          const changed = JSON.stringify({ ...r, ...v }) !== JSON.stringify(r);
          if (changed) {
            update((x) => log({ ...x, ...v }, `Details edited by ${me}`));
            say('Details saved.');
          }
          close();
        }}
      />
      <PickSheet
        open={pop?.kind === 'recruitment'}
        title="Change the BDM"
        label="BDM"
        options={BDMS}
        value={r.recruitment}
        cta="Save"
        onClose={close}
        onSave={(v) => {
          if (v !== r.recruitment) {
            update((x) => log({ ...x, recruitment: v }, `BDM changed to ${v} by ${me}`));
            say(`${v} is the BDM now.`);
          }
          close();
        }}
      />
      <PickSheet
        open={pop?.kind === 'master'}
        title={master ? 'Change the Master Partner' : 'Link a Master Partner'}
        label="Master Partner"
        options={['None', ...mps.filter((m) => m.status === 'Active').map((m) => m.name)]}
        value={master?.name ?? 'None'}
        cta={master ? 'Save' : 'Link'}
        onClose={close}
        onSave={(v) => {
          const to = mps.find((m) => m.name === v);
          if ((to?.id ?? null) !== (master?.id ?? null)) {
            link(r.id, to?.id ?? null);
            say(to ? `Linked to ${to.name}.` : 'No Master Partner now.');
          }
          close();
        }}
      />
      <Confirm
        open={pop?.kind === 'delete-draft'}
        title={pop?.kind === 'delete-draft' ? `Delete the draft ${pop.a.version}?` : ''}
        confirm="Delete draft"
        onCancel={close}
        onConfirm={() => {
          if (pop?.kind === 'delete-draft') {
            const a = pop.a;
            update((x) => log({ ...x, agreements: x.agreements.filter((y) => y.id !== a.id) }, `Draft agreement ${a.version} deleted by ${me}`));
            say('Draft deleted.');
          }
          close();
        }}
      >
        <p>Its file goes too. The RP never saw it.</p>
      </Confirm>
      <ReasonSheet
        open={pop?.kind === 'doc-back'}
        title={pop?.kind === 'doc-back' ? `Send back the ${pop.doc.name.charAt(0).toLowerCase()}${pop.doc.name.slice(1)}` : ''}
        cta="Reject and send back"
        onClose={close}
        onSave={(reason) => {
          if (pop?.kind === 'doc-back') decide(pop.doc, 'Sent back', reason);
          close();
        }}
      />
      <ReasonSheet
        open={pop?.kind === 'agr-back'}
        title={pop?.kind === 'agr-back' ? `Send back the signed copy of ${pop.a.version}` : ''}
        cta="Reject and send back"
        onClose={close}
        onSave={(reason) => {
          if (pop?.kind === 'agr-back') {
            const a = pop.a;
            setAgreement(a.id, (y) => ({ ...y, status: 'sent-back', signed: undefined, decision: { by: me, at: now(), reason } }));
            update((x) => log(x, `Signed copy of ${a.version} sent back by ${me}: ${reason}`));
            say('Sent back to the RP.');
          }
          close();
        }}
      />
      <SendSheet
        open={pop?.kind === 'send'}
        draft={pop?.kind === 'send' ? pop.draft : undefined}
        onClose={close}
        onSave={(a, send) => {
          update((x) => {
            const id = a.id || `a${Date.now()}`;
            const next: OpsAgreement = { ...a, id, status: send ? 'sent' : 'draft', sent: send ? { at: now(), by: me } : undefined };
            const agreements = x.agreements.some((y) => y.id === id) ? x.agreements.map((y) => (y.id === id ? next : y)) : [...x.agreements, next];
            return send ? log({ ...x, agreements }, `Agreement ${a.version} sent to ${x.name} by ${me}`) : { ...x, agreements };
          });
          say(send ? `Sent to ${r.name} to sign.` : 'Draft saved.');
          close();
        }}
      />
    </div>
  );
}

const openText = (a: OpsAgreement) =>
  a.status === 'draft' ? `${a.version}: a draft, not sent` : a.status === 'sent' ? `${a.version}: with the RP to sign` : a.status === 'signed' ? `${a.version}: signed copy in, to check` : `${a.version}: sent back, waiting for a new signed copy`;

function AgrPill({ a }: { a: OpsAgreement }) {
  const later = a.status === 'accepted' && (a.effective ?? '') > todayIso();
  const [tone, label]: [Tone, string] =
    a.status === 'accepted' ? ['ok', later ? 'Accepted' : 'Accepted (active)'] : a.status === 'signed' ? ['you', 'Signed copy in'] : a.status === 'sent' ? ['gsp', 'With the RP'] : a.status === 'sent-back' ? ['you', 'Sent back'] : a.status === 'replaced' ? ['grey', 'Replaced'] : ['grey', 'Draft'];
  return (
    <span className="ops-stack">
      <Pill tone={tone}>{label}</Pill>
      {later && <span className="muted">Active from {dayOf(a.effective!)}</span>}
    </span>
  );
}

const Stamp = ({ t, by }: { t: number; by: string }) => (
  <span className="ops-stack">
    <span className="num">{stampOf(t)}</span>
    <span className="muted">{by}</span>
  </span>
);

function PickSheet({ open, title, label, options, value, cta, onClose, onSave }: { open: boolean; title: string; label: string; options: string[]; value: string; cta: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) setV(value);
  }
  return (
    <Sheet open={open} onClose={onClose} center className="iform" title={title} footer={<Foot onClose={onClose}><Button onClick={() => onSave(v)}>{cta}</Button></Foot>}>
      <Field id="ops-pick" label={label}>
        <SelectInput id="ops-pick" value={v} onChange={(e) => setV(e.target.value)}>
          {[...new Set([value, ...options])].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </SelectInput>
      </Field>
    </Sheet>
  );
}

/** Sending something back always says why (Nesil, 4 Nov). */
function ReasonSheet({ open, title, cta, onClose, onSave }: { open: boolean; title: string; cta: string; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setReason(''), setTried(false));
  }
  const err = !reason.trim() ? 'Write why it’s sent back: the RP sees this note.' : null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title={title}
      footer={
        <Foot onClose={onClose}>
          <Button
            onClick={() => {
              setTried(true);
              if (!err) onSave(reason.trim());
            }}
          >
            {cta}
          </Button>
        </Foot>
      }
    >
      <Field id="ops-why" label="Why it’s sent back" required error={tried ? err : null}>
        <div className="control iform__area">
          <textarea id="ops-why" className="control__input" rows={4} value={reason} placeholder="What’s wrong, and what to upload instead" aria-invalid={(tried && !!err) || undefined} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Field>
    </Sheet>
  );
}

/** Send the agreement (as in the reference): the file, its version, when it takes effect and what changed. */
function SendSheet({ open, draft, onClose, onSave }: { open: boolean; draft?: OpsAgreement; onClose: () => void; onSave: (a: OpsAgreement, send: boolean) => void }) {
  const blank = { file: null as FileMeta | null, version: '', effective: '', notes: '' };
  const [v, setV] = useState(blank);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setV(draft ? { file: draft.file, version: draft.version, effective: draft.effective ?? '', notes: draft.notes ?? '' } : blank), setTried(false), setFileErr(null));
  }
  const err = { file: !v.file ? 'Upload the agreement.' : null, version: !v.version.trim() ? 'Enter the version the RP sees.' : null };
  const save = (send: boolean) => {
    setTried(true);
    if (send && Object.values(err).some(Boolean)) return;
    if (!send && !v.file) return;
    onSave({ id: draft?.id ?? '', version: v.version.trim() || 'Draft', file: v.file!, notes: v.notes.trim() || undefined, effective: v.effective || undefined, status: 'draft' }, send);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title="Send the agreement"
      footer={
        <Foot onClose={onClose}>
          <EditOnly>
            <Button variant="secondary" onClick={() => save(false)}>
              Save draft
            </Button>
          </EditOnly>
          <EditOnly>
            <Button onClick={() => save(true)}>Send to the RP</Button>
          </EditOnly>
        </Foot>
      }
    >
      <p className="ireq">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required
      </p>
      <div className="ops-form">
        <Field id="ops-agr-file" label="Agreement" required error={fileErr ?? (tried ? err.file : null)}>
          <FileDrop
            id="ops-agr-file"
            file={v.file}
            label="Drop the agreement here, or choose a file"
            kinds="PDF"
            accept=".pdf,application/pdf"
            test={(f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf'}
            maxMB={PDF_MB}
            invalid={!!fileErr || (tried && !!err.file)}
            error={setFileErr}
            onFile={(f) => setV((p) => ({ ...p, file: f }))}
          />
        </Field>
        <Field id="ops-agr-version" label="Version" required error={tried ? err.version : null}>
          <TextInput id="ops-agr-version" value={v.version} placeholder="Like v4 · Nov 2026" invalid={tried && !!err.version} onChange={(e) => setV({ ...v, version: e.target.value })} />
        </Field>
        <Field id="ops-agr-from" label="Effective from" optional>
          <TextInput id="ops-agr-from" type="date" value={v.effective} onChange={(e) => setV({ ...v, effective: e.target.value })} />
        </Field>
        <Field id="ops-agr-notes" label="Notes" optional>
          <div className="control iform__area">
            <textarea id="ops-agr-notes" className="control__input" rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

type DetailsValue = Pick<OpsRp, 'name' | 'contact' | 'country' | 'state' | 'city' | 'owner' | 'cemail' | 'foundUs'>;

/** Edit the details (Nesil, 4 Nov, later): what the Details section shows, but the code and onboarding date, which the system sets. */
function DetailsSheet({ open, r, onClose, onSave }: { open: boolean; r: OpsRp; onClose: () => void; onSave: (v: DetailsValue) => void }) {
  const fromRp = () => {
    const [dial, ...rest] = r.contact.phone.split(' ');
    return { name: r.name, cname: r.contact.name, email: r.contact.email, dial, number: rest.join(' '), country: r.country, state: r.state ?? '', city: r.city, owner: r.owner ?? '', cemail: r.cemail ?? '', foundUs: r.foundUs };
  };
  const [v, setV] = useState(fromRp);
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setV(fromRp()), setTried(false));
  }
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const states = countryByName(v.country)?.states ?? [];
  const cities = CITIES[v.state] ?? [];
  const digits = v.number.replace(/\D/g, '');
  const err = {
    name: !v.name.trim() ? 'Enter the partner’s name.' : null,
    cname: !v.cname.trim() ? 'Enter the contact person.' : null,
    email: !EMAIL.test(v.email.trim()) ? 'Enter an email like name@example.com.' : null,
    phone: digits.length < 6 ? 'Enter the whole phone number.' : null,
    country: !v.country ? 'Choose the country.' : null,
    city: !v.city.trim() ? 'Enter the city.' : null,
    cemail: v.cemail.trim() && !EMAIL.test(v.cemail.trim()) ? 'Enter an email like name@example.com.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) {
      window.setTimeout(() => document.querySelector<HTMLElement>('.ops-rpform [aria-invalid="true"]')?.focus(), 0);
      return;
    }
    onSave({
      name: v.name.trim(),
      contact: { name: v.cname.trim(), email: v.email.trim(), phone: `${v.dial} ${v.number.trim()}` },
      country: v.country,
      state: v.state || undefined,
      city: v.city.trim(),
      owner: v.owner.trim() || undefined,
      cemail: v.cemail.trim() || undefined,
      foundUs: v.foundUs,
    });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title="Edit the details"
      footer={
        <Foot onClose={onClose}>
          <EditOnly>
            <Button onClick={save}>Save</Button>
          </EditOnly>
        </Foot>
      }
    >
      <p className="ireq">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required
      </p>
      <div className="ops-form ops-form--2 ops-rpform">
        <Field id="orp-e-name" label="Name" required error={show('name')} className="ops-wide">
          <TextInput id="orp-e-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="orp-e-cname" label="Contact person" required error={show('cname')}>
          <TextInput id="orp-e-cname" value={v.cname} invalid={!!show('cname')} onChange={(e) => set({ cname: e.target.value })} />
        </Field>
        <Field id="orp-e-email" label="Email" required error={show('email')}>
          <TextInput id="orp-e-email" type="email" value={v.email} invalid={!!show('email')} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field id="orp-e-phone" label="Phone" required error={show('phone')}>
          <PhoneInput id="orp-e-phone" dial={v.dial} number={v.number} invalid={!!show('phone')} onDial={(dial) => set({ dial })} onNumber={(number) => set({ number })} />
        </Field>
        <Field id="orp-e-owner" label="Owner" optional>
          <TextInput id="orp-e-owner" value={v.owner} onChange={(e) => set({ owner: e.target.value })} />
        </Field>
        <Field id="orp-e-country" label="Country" required error={show('country')}>
          <CountryCombobox id="orp-e-country" value={v.country} invalid={!!show('country')} onChange={(name) => name !== v.country && set({ country: name, state: '' })} />
        </Field>
        <Field id="orp-e-state" label="State or province" optional>
          {states.length ? (
            <SelectInput id="orp-e-state" value={v.state} placeholder="Choose one" allowEmpty onChange={(e) => set({ state: e.target.value })}>
              {states.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </SelectInput>
          ) : (
            <TextInput id="orp-e-state" value={v.state} onChange={(e) => set({ state: e.target.value })} />
          )}
        </Field>
        <Field id="orp-e-city" label="City" required error={show('city')}>
          <TextInput id="orp-e-city" value={v.city} list={cities.length ? 'orp-e-cities' : undefined} invalid={!!show('city')} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        {cities.length > 0 && (
          <datalist id="orp-e-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
        <span className="ops-gap" aria-hidden="true" />
        <Field id="orp-e-cemail" label="Commission statements" optional error={show('cemail')}>
          <TextInput id="orp-e-cemail" type="email" value={v.cemail} placeholder="Email" invalid={!!show('cemail')} onChange={(e) => set({ cemail: e.target.value })} />
        </Field>
        <Field id="orp-e-found" label="How they found GSP" required>
          <SelectInput id="orp-e-found" value={v.foundUs} onChange={(e) => set({ foundUs: e.target.value })}>
            {[...new Set([v.foundUs, ...FOUND_US])].filter(Boolean).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}
