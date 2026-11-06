import { useMemo, useState } from 'react';
import { EditOnly, ViewOnlyProvider, useHides, useShows, useViewOnly } from '../../proto/viewOnly';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { PhoneInput } from '../../components/PhoneInput';
import { MultiPick } from '../../components/MultiPick';
import { Paper } from '../../components/DocView';
import { COUNTRIES, TOP_MARKETS, countryByName } from '../../data/partners';
import { CITIES } from '../../data/students';
import { CopyButton } from '../../institution/students/parts';
import { dateText, dateTimeText, nowIso, todayIso, type LogLine, type RpStatus } from '../../institution/data/records';
import { Facts, NoMatch, Pill, RecordHead, RecordTabs, Section, SystemInfo, TabPanel, type Tone } from '../../institution/records/parts';
import { fmtSize } from '../../screens/signup/docs';
import { BDMS, bdmFor, stampOf, type FileMeta, type OpsRp } from './data';
import { MP_STATUSES, nextCode, regionsOf, type MasterPartner, type MpStatus } from './masters';
import { Confirm } from './Confirm';
import { Pick } from './Pick';
import { Places } from './Places';
import { FileDrop, Foot, OpsHead, useOpsRecord, type OpsFocus, type OpsTarget } from './parts';

const MP_TONE: Record<MpStatus, Tone> = { Active: 'ok', Inactive: 'grey' };
const MpPill = ({ s }: { s: MpStatus }) => <Pill tone={MP_TONE[s]}>{s}</Pill>;
const RP_TONE: Record<RpStatus, Tone> = { 'Not activated': 'you', Verifying: 'gsp', 'Documents sent back': 'you', Activated: 'uni', 'Agreement signed': 'ok', Rejected: 'bad', Suspended: 'bad', Dormant: 'grey' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (l: string[]) => l.join(', ');
/** Where it is, short: "Pune, India", or its countries when it covers more than one city. */
const placeOf = (m: MasterPartner) => (m.cities.length === 1 && m.countries.length === 1 ? `${m.cities[0]}, ${m.countries[0]}` : list(m.countries));
/** Its header: code, where it is, and its sales regions when they aren't just its countries. */
const headOf = (m: MasterPartner) => [m.code, placeOf(m), list(regionsOf(m)) !== list(m.countries) && list(regionsOf(m))].filter(Boolean).join(' · ');
/** Every country, GSP's main markets first. */
const COUNTRY_NAMES = [...TOP_MARKETS, ...COUNTRIES.map((c) => c.name).filter((n) => !TOP_MARKETS.includes(n))];

type SetMps = (fn: (l: MasterPartner[]) => MasterPartner[]) => void;

/**
 * Master Partners (Nesil, 4 Nov, RP Ops only): the list, New Master Partner, and a Master Partner's page with
 * **Overview** (its details and System information), **RPs** (Link an RP; one Master Partner per RP), **Documents**
 * (RP Ops uploads them; nothing to check or sign), **Commission** (its terms) and **Logs**.
 * 4 Nov (later): no lines under titles or fields; the list has Sales region (filter and column), and filters take
 * several; the form has no Notes, BDM for Recruitment, and Country, State and City, several of each (City optional);
 * Set inactive is red, and removing a document asks first.
 */
export function MasterPartners({
  mps,
  setMps,
  rps,
  link,
  focus,
  navKey,
  open,
  scrollTop,
  say,
  me,
}: {
  mps: MasterPartner[];
  setMps: SetMps;
  rps: OpsRp[];
  /** Link an RP to a Master Partner (or unlink it, with null): both records note it. */
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
  const [countries, setCountries] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const under = (id: string) => rps.filter((r) => r.mp === id);
  const rows = mps.filter((m) => {
    const t = q.trim().toLowerCase();
    if (t && ![m.name, m.code, ...m.cities].some((x) => x.toLowerCase().includes(t))) return false;
    if (status.length && !status.includes(m.status)) return false;
    if (countries.length && !m.countries.some((c) => countries.includes(c))) return false;
    if (regions.length && !regionsOf(m).some((x) => regions.includes(x))) return false;
    return true;
  });
  const clear = () => (setQ(''), setStatus([]), setCountries([]), setRegions([]));

  const shown = cur ? mps.find((m) => m.id === cur.id) : undefined;
  if (cur && shown)
    return (
      <MpPage
        key={shown.id}
        m={shown}
        tab={cur.tab}
        backLabel={cur.back?.label ?? 'Master Partners'}
        onBack={back}
        rps={rps}
        mps={mps}
        link={link}
        open={open}
        say={say}
        me={me}
        update={(fn) => setMps((l) => l.map((x) => (x.id === shown.id ? fn(x) : x)))}
      />
    );

  return (
    <div className="ipage">
      <OpsHead title="Master Partners">
        <EditOnly>
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding(true)}>
            New Master Partner
          </Button>
        </EditOnly>
      </OpsHead>

      <section className="card stable" aria-labelledby="omp-count">
        <div className="stools ops-tools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search Master Partners</span>
              <input id="omp-q" type="search" placeholder="Name, code or city" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <MultiPick id="omp-status" label="Status" value={status} options={MP_STATUSES} onChange={setStatus} empty="All statuses" all="All statuses" />
            <MultiPick id="omp-country" label="Country" value={countries} options={[...new Set(mps.flatMap((m) => m.countries))].sort()} onChange={setCountries} empty="All countries" all="All countries" search />
            <MultiPick id="omp-region" label="Sales region" value={regions} options={[...new Set(mps.flatMap(regionsOf))].sort()} onChange={setRegions} empty="All sales regions" all="All sales regions" />
          </div>
          <p className="stools__count" id="omp-count" role="status">
            <span>
              <span className="num">{rows.length === mps.length ? mps.length : `${rows.length} of ${mps.length}`}</span> {mps.length === 1 ? 'Master Partner' : 'Master Partners'}
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          mps.length === 0 ? (
            <p className="muted ops-empty ops-empty--pad">No Master Partners yet. New Master Partner adds one.</p>
          ) : (
            <NoMatch what="Master Partners" onClear={clear} />
          )
        ) : (
          <div className="stab-wrap">
            <table className="itab ops-mps">
              <thead>
                <tr>
                  <th scope="col">Master Partner</th>
                  <th scope="col">Country</th>
                  <th scope="col">Sales region</th>
                  <th scope="col">BDM</th>
                  <th scope="col" className="num">
                    RPs
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="irow" onClick={() => show(m.id)}>
                    <td>
                      <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(m.id))}>
                        {m.name}
                      </button>
                      <span className="irow__sub">
                        {[m.code, ...m.cities].join(' · ')}
                      </span>
                    </td>
                    <td>{list(m.countries)}</td>
                    <td>{list(regionsOf(m))}</td>
                    <td>{m.recruitment}</td>
                    <td className="num">{under(m.id).length}</td>
                    <td>
                      <MpPill s={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MpForm
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(v) => {
          const at = nowIso();
          const m: MasterPartner = { ...v, id: `mp-${Date.now()}`, code: nextCode(mps), status: 'Active', share: 80, shareFrom: todayIso(), docs: [], created: { by: me, at }, last: { by: me, at }, log: [] };
          setMps((l) => [m, ...l]);
          setAdding(false);
          say(`${m.name} added as ${m.code}.`);
          show(m.id);
        }}
      />
    </div>
  );
}

type Tab = 'overview' | 'rps' | 'documents' | 'commission' | 'log';
type Pop = { kind: 'edit' } | { kind: 'link' } | { kind: 'unlink'; r: OpsRp } | { kind: 'upload' } | { kind: 'remove-doc'; d: MasterPartner['docs'][number] } | { kind: 'terms' } | { kind: 'status' } | { kind: 'preview'; name: string; file: string };
const PART: Record<string, string> = { details: 'Details', rps: 'RPs', documents: 'Documents', commission: 'Commission', status: 'Status' };
const PART_ICON: Record<string, 'edit' | 'partner' | 'file' | 'wallet' | 'checkCircle'> = { details: 'edit', rps: 'partner', documents: 'file', commission: 'wallet', status: 'checkCircle' };

/** A Master Partner, as RP Ops keeps it. */
function MpPage({
  m,
  tab: start,
  backLabel,
  onBack,
  rps,
  mps,
  link,
  open,
  say,
  me,
  update,
}: {
  m: MasterPartner;
  tab?: string;
  backLabel: string;
  onBack: () => void;
  rps: OpsRp[];
  mps: MasterPartner[];
  link: (rpId: string, mpId: string | null) => void;
  open: (t: OpsTarget) => void;
  say: (m: string) => void;
  me: string;
  update: (fn: (m: MasterPartner) => MasterPartner) => void;
}) {
  const tabs: Tab[] = ['overview', 'rps', 'documents', 'commission', 'log'];
  const [tab, setTab] = useState<Tab>(tabs.includes(start as Tab) ? (start as Tab) : 'overview');
  const [pop, setPop] = useState<Pop | null>(null);
  // GSP · Global Ops (6 Nov): no Documents or Commission
  const noDocs = useHides('mp.documents');
  const noCommission = useHides('mp.commission');
  // GSP · Finance (6 Nov): commission terms to change when the rest of the page is view only
  const commissionEdit = useShows('mp.commission.edit');
  const viewOnly = useViewOnly();
  const close = () => setPop(null);
  const mine = rps.filter((r) => r.mp === m.id);
  /** A change: the record's last-modified stamp and a line in its Logs. */
  const change = (part: string, what: string, fn: (x: MasterPartner) => MasterPartner = (x) => x) =>
    update((x) => {
      const at = nowIso();
      const line: LogLine = { id: `mpl-${Date.now()}`, at, by: me, part, what };
      return { ...fn(x), last: { by: me, at }, log: [...x.log, line] };
    });
  // newest first; changes in the same minute keep their order (the later one on top)
  const lines = [...m.log].reverse().sort((a, b) => b.at.localeCompare(a.at));
  const none = <span className="muted">—</span>;

  return (
    <div className="ipage irecord ops-page">
      <RecordHead
        back={backLabel}
        onBack={onBack}
        title={m.name}
        sub={headOf(m)}
        status={
          <span className="ops-headacts">
            <MpPill s={m.status} />
            <EditOnly>
              <Button variant="secondary" className={m.status === 'Active' ? 'ops-danger-line' : ''} onClick={() => (m.status === 'Active' ? setPop({ kind: 'status' }) : (change('status', 'Set active', (x) => ({ ...x, status: 'Active' })), say(`${m.name} is active again.`)))}>
                {m.status === 'Active' ? 'Set inactive' : 'Set active'}
              </Button>
            </EditOnly>
          </span>
        }
      />
      <RecordTabs
        id="omptab"
        label="Master Partner"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'rps', label: 'RPs', n: mine.length },
          ...(noDocs ? [] : [{ key: 'documents' as Tab, label: 'Documents', n: m.docs.length }]),
          ...(noCommission ? [] : [{ key: 'commission' as Tab, label: 'Commission' }]),
          { key: 'log', label: 'Logs', n: m.log.length + 1 },
        ]}
      />
      <TabPanel id="omptab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section
              title="Details"
              id="omp-details"
              action={
                <EditOnly>
                  <Button variant="secondary" iconLeft={<Icon name="edit" size={18} />} onClick={() => setPop({ kind: 'edit' })}>
                    Edit<span className="vh"> the details</span>
                  </Button>
                </EditOnly>
              }
            >
              <Facts
                items={[
                  ['Name', m.name],
                  ['Code', <span key="c" className="num">{m.code}</span>],
                  ['Country', list(m.countries)],
                  ['State or province', m.states.length ? list(m.states) : none],
                  ['City', m.cities.length ? list(m.cities) : none],
                  ['Contact', m.contact.name],
                  [
                    'Contact email',
                    <span key="e" className="ifacts__copy">
                      <a href={`mailto:${m.contact.email}`}>{m.contact.email}</a>
                      <CopyButton text={m.contact.email} what="Email" onDone={say} />
                    </span>,
                  ],
                  ['Contact phone', <span key="p" className="num">{m.contact.phone}</span>],
                  ...(noCommission ? [] : ([['Commissions email', m.cemail]] as [string, string | undefined][])),
                  ['BDM', m.recruitment],
                  ['Sales region', list(regionsOf(m))],
                ]}
              />
            </Section>
            <SystemInfo id="omp-system" created={m.created} last={m.last} />
          </>
        )}

        {tab === 'rps' && (
          <Section
            title="RPs"
            id="omp-rps"
            action={
              <EditOnly>
                <Button variant="secondary" iconLeft={<Icon name="plus" size={18} />} disabled={m.status !== 'Active'} onClick={() => setPop({ kind: 'link' })}>
                  Link an RP
                </Button>
              </EditOnly>
            }
          >
            {m.status !== 'Active' && <p className="muted ops-empty">Inactive: set it active to link more RPs.</p>}
            {mine.length === 0 ? (
              <p className="muted ops-empty">No RPs linked yet.</p>
            ) : (
              <div className="stab-wrap">
                <table className="itab ops-tab">
                  <thead>
                    <tr>
                      <th scope="col">RP</th>
                      <th scope="col">Status</th>
                      <th scope="col">Linked on</th>
                      <th scope="col">
                        <span className="vh">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button type="button" className="btn btn--link ops-strong" onClick={() => open({ section: 'rps', id: r.id, back: { section: 'mps', id: m.id, tab: 'rps', label: m.name } })}>
                            {r.name}
                          </button>
                          <span className="irow__sub">
                            {r.code} · {r.city}, {r.country}
                          </span>
                        </td>
                        <td>
                          <Pill tone={RP_TONE[r.status]}>{r.status}</Pill>
                        </td>
                        <td className="num">{r.mpSince ? dateText(r.mpSince) : none}</td>
                        <td className="ops-end">
                          <EditOnly>
                            <button type="button" className="btn btn--link idanger" onClick={() => setPop({ kind: 'unlink', r })}>
                              Unlink<span className="vh"> {r.name}</span>
                            </button>
                          </EditOnly>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {tab === 'documents' && !noDocs && (
          <Section
            title="Documents"
            id="omp-docs"
            action={
              <EditOnly>
                <Button variant="secondary" iconLeft={<Icon name="upload" size={18} />} onClick={() => setPop({ kind: 'upload' })}>
                  Upload a document
                </Button>
              </EditOnly>
            }
          >
            {m.docs.length === 0 ? (
              <p className="muted ops-empty">No documents yet.</p>
            ) : (
              <ul className="ops-docs">
                {[...m.docs].reverse().map((d) => (
                  <li key={d.id} className="ops-doc">
                    <Icon name="file" size={18} />
                    <span className="ops-doc__t">
                      <span className="ops-doc__name">{d.name}</span>
                      <span className="ops-doc__meta">
                        {d.file.name} · {fmtSize(d.file.size)} · Uploaded by {d.by}, {stampOf(d.at)}
                      </span>
                    </span>
                    <span className="ops-doc__acts">
                      <button type="button" className="btn btn--link" onClick={() => setPop({ kind: 'preview', name: d.name, file: d.file.name })}>
                        Preview<span className="vh"> {d.name}</span>
                      </button>
                      <EditOnly>
                        <button type="button" className="btn btn--link idanger" onClick={() => setPop({ kind: 'remove-doc', d })}>
                          Remove<span className="vh"> {d.name}</span>
                        </button>
                      </EditOnly>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {tab === 'commission' && !noCommission && (
          // GSP · Finance (6 Nov): commission terms stay changeable when the rest of the page is view only
          <ViewOnlyProvider on={viewOnly && !commissionEdit}>
            <Section
              title="Commission terms"
              id="omp-terms"
              action={
                <EditOnly>
                  <Button variant="secondary" iconLeft={<Icon name="edit" size={18} />} onClick={() => setPop({ kind: 'terms' })}>
                    Edit<span className="vh"> the commission terms</span>
                  </Button>
                </EditOnly>
              }
            >
              <Facts
                items={[
                  ['Share of GSP’s commission', <span key="s" className="num">{m.share}%</span>],
                  ['From', <span key="f" className="num">{dateText(m.shareFrom)}</span>],
                  ['Paid to', `${m.name} only`],
                  ['Statements go to', m.cemail],
                  ['RPs under it', <span key="n" className="num">{mine.length}</span>],
                ]}
              />
            </Section>
          </ViewOnlyProvider>
        )}

        {tab === 'log' && (
          <Section title="Logs" id="omp-log">
            <ol className="aact ilogs">
              {[...lines, { id: 'added', at: m.created.at, by: m.created.by, part: '', what: `Added as ${m.code}` }].map((l) => (
                <li key={l.id} className="aact__item aact__item--gsp">
                  <span className="aact__icon" aria-hidden="true">
                    <Icon name={l.part ? PART_ICON[l.part] ?? 'edit' : 'plus'} size={16} />
                  </span>
                  <span className="aact__t">
                    <span className="aact__text">{l.what}</span>
                    <span className="aact__meta">
                      {l.part ? `${PART[l.part] ?? l.part} · ` : ''}
                      {l.by} · <span className="num">{dateTimeText(l.at)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </TabPanel>

      {/* the pop-ups */}
      <MpForm
        open={pop?.kind === 'edit'}
        edit={m}
        onClose={close}
        onSave={(v) => {
          const changed = (['name', 'countries', 'states', 'cities', 'contact', 'cemail', 'recruitment'] as const).some((k) => JSON.stringify(v[k]) !== JSON.stringify(m[k]));
          if (changed) {
            change('details', 'Edited the details', (x) => ({ ...x, ...v }));
            say('Details saved.');
          }
          close();
        }}
      />
      <LinkSheet
        open={pop?.kind === 'link'}
        m={m}
        rps={rps}
        mps={mps}
        onClose={close}
        onLink={(id) => {
          const r = rps.find((x) => x.id === id)!;
          link(id, m.id);
          say(`${r.name} linked to ${m.name}.`);
          close();
        }}
      />
      <Confirm
        open={pop?.kind === 'unlink'}
        title={pop?.kind === 'unlink' ? `Unlink ${pop.r.name}?` : ''}
        confirm="Unlink"
        onCancel={close}
        onConfirm={() => {
          if (pop?.kind === 'unlink') {
            link(pop.r.id, null);
            say(`${pop.r.name} unlinked.`);
          }
          close();
        }}
      >
        <p>From now, its new applications pay the RP itself. Earlier ones stay as they were.</p>
      </Confirm>
      <Confirm
        open={pop?.kind === 'status'}
        title={`Set ${m.name} inactive?`}
        confirm="Set inactive"
        onCancel={close}
        onConfirm={() => {
          change('status', 'Set inactive', (x) => ({ ...x, status: 'Inactive' }));
          say(`${m.name} is inactive.`);
          close();
        }}
      >
        <p>No more RPs can be linked to it.{mine.length ? ` The ${plural(mine.length, 'RP')} under it stay linked.` : ''}</p>
      </Confirm>
      <Confirm
        open={pop?.kind === 'remove-doc'}
        title={pop?.kind === 'remove-doc' ? `Remove ${pop.d.name}?` : ''}
        confirm="Remove"
        onCancel={close}
        onConfirm={() => {
          if (pop?.kind === 'remove-doc') {
            const d = pop.d;
            change('documents', `Removed ${d.name}`, (x) => ({ ...x, docs: x.docs.filter((y) => y.id !== d.id) }));
            say(`${d.name} removed.`);
          }
          close();
        }}
      >
        <p>{pop?.kind === 'remove-doc' ? `${pop.d.file.name} is deleted from the record.` : ''}</p>
      </Confirm>
      <UploadSheet
        open={pop?.kind === 'upload'}
        onClose={close}
        onSave={(name, file) => {
          change('documents', `Uploaded ${name}`, (x) => ({ ...x, docs: [...x.docs, { id: `mpd-${Date.now()}`, name, file, by: me, at: Date.now() }] }));
          say(`${name} uploaded.`);
          close();
        }}
      />
      <TermsSheet
        open={pop?.kind === 'terms'}
        m={m}
        onClose={close}
        onSave={(share, from) => {
          if (share !== m.share || from !== m.shareFrom) {
            change('commission', `Share of GSP’s commission set to ${share}% from ${dateText(from)}`, (x) => ({ ...x, share, shareFrom: from }));
            say('Commission terms saved.');
          }
          close();
        }}
      />
      <Sheet open={pop?.kind === 'preview'} onClose={close} center className="iform" title={pop?.kind === 'preview' ? pop.name : ''} sub={pop?.kind === 'preview' ? pop.file : undefined}>
        {pop?.kind === 'preview' && <Paper d={{ name: pop.name, file: pop.file }} />}
      </Sheet>
    </div>
  );
}

type FormValue = Pick<MasterPartner, 'name' | 'countries' | 'states' | 'cities' | 'contact' | 'cemail' | 'recruitment'>;

/** Only what's still in the list: a state of a country no longer picked goes (one typed in stays). */
const keep = (picked: string[], now: string[], known: string[]) => picked.filter((x) => now.includes(x) || !known.includes(x));
const ALL_STATES = COUNTRIES.flatMap((c) => c.states);
const ALL_CITIES = Object.values(CITIES).flat();

/**
 * New Master Partner, and Edit, the same form (Nesil, 4 Nov, later): Name; Country, State or province and City, each
 * several picked from a list (a state or city not in it can be typed in), City optional; the contact; Commissions
 * email; BDM, filled from BDM assignment once a country is in and changeable. Its code and sales region are set by
 * the system.
 */
function MpForm({ open, edit, onClose, onSave }: { open: boolean; edit?: MasterPartner; onClose: () => void; onSave: (v: FormValue) => void }) {
  const blank = { name: '', countries: [] as string[], states: [] as string[], cities: [] as string[], cname: '', email: '', dial: '+91', number: '', cemail: '', recruitment: '' };
  const fromEdit = (m: MasterPartner) => {
    const [dial, ...rest] = m.contact.phone.split(' ');
    return { name: m.name, countries: m.countries, states: m.states, cities: m.cities, cname: m.contact.name, email: m.contact.email, dial, number: rest.join(' '), cemail: m.cemail, recruitment: m.recruitment };
  };
  const [v, setV] = useState(blank);
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setV(edit ? fromEdit(edit) : blank), setTried(false));
  }
  const set = (p: Partial<typeof blank>) => setV((x) => ({ ...x, ...p }));
  const statesOf = (countries: string[]) => countries.flatMap((c) => countryByName(c)?.states ?? []);
  // the cities of the states picked, or of every state of the countries picked
  const citiesOf = (countries: string[], states: string[]) => (states.length ? states : statesOf(countries)).flatMap((x) => CITIES[x] ?? []);
  const stateOptions = useMemo(() => statesOf(v.countries), [v.countries]); // eslint-disable-line react-hooks/exhaustive-deps
  const cityOptions = useMemo(() => citiesOf(v.countries, v.states), [v.countries, v.states]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickCountries = (countries: string[]) => {
    const states = keep(v.states, statesOf(countries), ALL_STATES);
    const first = countries[0];
    set({ countries, states, cities: keep(v.cities, citiesOf(countries, states), ALL_CITIES), dial: !v.number && first ? countryByName(first)?.dial ?? v.dial : v.dial });
  };
  const pickStates = (states: string[]) => set({ states, cities: keep(v.cities, citiesOf(v.countries, states), ALL_CITIES) });
  // the BDM comes from BDM assignment once a country is in; it can be changed
  const auto = bdmFor(v.countries[0] ?? '', v.cities[0], v.states[0]);
  const recruitment = v.recruitment || auto;
  const digits = v.number.replace(/\D/g, '');
  const err = {
    name: !v.name.trim() ? 'Enter the Master Partner’s name.' : null,
    countries: !v.countries.length ? 'Choose at least one country.' : null,
    cname: !v.cname.trim() ? 'Enter the contact’s name.' : null,
    email: !v.email.trim() ? 'Enter the contact’s email.' : !EMAIL.test(v.email.trim()) ? 'Enter an email like name@example.com.' : null,
    phone: !digits ? 'Enter the contact’s phone number.' : digits.length < 6 ? 'Enter the whole number.' : null,
    cemail: !v.cemail.trim() ? 'Enter where the statements go.' : !EMAIL.test(v.cemail.trim()) ? 'Enter an email like name@example.com.' : null,
    recruitment: !recruitment ? 'Choose a BDM.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) {
      window.setTimeout(() => document.querySelector<HTMLElement>('.ops-mpform [aria-invalid="true"]')?.focus(), 0);
      return;
    }
    onSave({ name: v.name.trim(), countries: v.countries, states: v.states, cities: v.cities, contact: { name: v.cname.trim(), email: v.email.trim(), phone: `${v.dial} ${v.number.trim()}` }, cemail: v.cemail.trim(), recruitment });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title={edit ? 'Edit the details' : 'New Master Partner'}
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
      <div className="ops-form ops-form--2 ops-mpform">
        <Field id="mp-name" label="Name" required error={show('name')} className="ops-wide">
          <TextInput id="mp-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="mp-country" label="Country" required error={show('countries')}>
          <Places id="mp-country" label="Country" value={v.countries} options={COUNTRY_NAMES} onChange={pickCountries} empty="Choose countries" invalid={!!show('countries')} />
        </Field>
        <Field id="mp-state" label="State or province" optional>
          <Places id="mp-state" label="State or province" value={v.states} options={stateOptions} onChange={pickStates} empty={v.countries.length ? 'All states' : 'Choose a country first'} disabled={!v.countries.length} free />
        </Field>
        <Field id="mp-city" label="City" optional>
          <Places id="mp-city" label="City" value={v.cities} options={cityOptions} onChange={(cities) => set({ cities })} empty={v.countries.length ? 'All cities' : 'Choose a country first'} disabled={!v.countries.length} free />
        </Field>
        <span className="ops-gap" aria-hidden="true" />
        <Field id="mp-cname" label="Contact name" required error={show('cname')}>
          <TextInput id="mp-cname" value={v.cname} invalid={!!show('cname')} onChange={(e) => set({ cname: e.target.value })} />
        </Field>
        <Field id="mp-email" label="Contact email" required error={show('email')}>
          <TextInput id="mp-email" type="email" value={v.email} invalid={!!show('email')} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field id="mp-phone" label="Contact phone" required error={show('phone')}>
          <PhoneInput id="mp-phone" dial={v.dial} number={v.number} invalid={!!show('phone')} onDial={(dial) => set({ dial })} onNumber={(number) => set({ number })} />
        </Field>
        <Field id="mp-cemail" label="Commissions email" required error={show('cemail')}>
          <TextInput id="mp-cemail" type="email" value={v.cemail} invalid={!!show('cemail')} onChange={(e) => set({ cemail: e.target.value })} />
        </Field>
        <Field id="mp-rec" label="BDM" required error={show('recruitment')}>
          <SelectInput id="mp-rec" value={recruitment} placeholder="Choose a BDM" invalid={!!show('recruitment')} onChange={(e) => set({ recruitment: e.target.value })}>
            {[...new Set([auto, ...BDMS].filter(Boolean))].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}

/** Link an RP: searchable by name or code; one already under another Master Partner says so, and linking moves it here. */
function LinkSheet({ open, m, rps, mps, onClose, onLink }: { open: boolean; m: MasterPartner; rps: OpsRp[]; mps: MasterPartner[]; onClose: () => void; onLink: (id: string) => void }) {
  const [id, setId] = useState('');
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setId(''), setTried(false));
  }
  const under = (r: OpsRp) => mps.find((x) => x.id === r.mp)?.name;
  const options = rps.filter((r) => r.mp !== m.id).map((r) => ({ value: r.id, label: r.name, note: [r.code, `${r.city}, ${r.country}`, under(r) && `under ${under(r)}`].filter(Boolean).join(' · ') }));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title="Link an RP"
      footer={
        <Foot onClose={onClose}>
          <EditOnly>
            <Button
              onClick={() => {
                setTried(true);
                if (id) onLink(id);
              }}
            >
              Link
            </Button>
          </EditOnly>
        </Foot>
      }
    >
      <Field id="mp-link" label="RP" required error={tried && !id ? 'Choose the RP to link.' : null}>
        <Pick id="mp-link" label="RPs" value={id} options={options} placeholder="RP name or code" invalid={tried && !id} describedBy={tried && !id ? 'mp-link-error' : undefined} onChange={setId} />
      </Field>
    </Sheet>
  );
}

/** Upload a document: the file and what it is. RP Ops keeps it; nobody checks it. */
function UploadSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string, file: FileMeta) => void }) {
  const [file, setFile] = useState<FileMeta | null>(null);
  const [name, setName] = useState('');
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setFile(null), setName(''), setFileErr(null), setTried(false));
  }
  const err = { file: !file ? 'Choose the file.' : null, name: !name.trim() ? 'Say what the document is.' : null };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title="Upload a document"
      footer={
        <Foot onClose={onClose}>
          <EditOnly>
            <Button
              onClick={() => {
                setTried(true);
                if (file && name.trim()) onSave(name.trim(), file);
              }}
            >
              Upload
            </Button>
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
        <Field id="mp-doc-file" label="File" required error={fileErr ?? (tried ? err.file : null)}>
          <FileDrop
            id="mp-doc-file"
            file={file}
            label="Drop the document here, or choose a file"
            kinds="PDF, JPG or PNG"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            test={(f) => /\.(pdf|jpe?g|png)$/i.test(f.name)}
            invalid={!!fileErr || (tried && !!err.file)}
            error={setFileErr}
            onFile={(f) => {
              setFile(f);
              if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
            }}
          />
        </Field>
        <Field id="mp-doc-name" label="What it is" required error={tried ? err.name : null}>
          <TextInput id="mp-doc-name" value={name} placeholder="Like Business registration certificate" invalid={tried && !!err.name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Its commission terms: its share of GSP's commission, and from when. */
function TermsSheet({ open, m, onClose, onSave }: { open: boolean; m: MasterPartner; onClose: () => void; onSave: (share: number, from: string) => void }) {
  const [share, setShare] = useState(String(m.share));
  const [from, setFrom] = useState(m.shareFrom);
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setShare(String(m.share)), setFrom(m.shareFrom), setTried(false));
  }
  const n = Number(share);
  const err = { share: !share.trim() || !Number.isFinite(n) || n <= 0 || n > 100 ? 'Enter a share from 1 to 100.' : null, from: !from ? 'Choose the date.' : null };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title="Edit the commission terms"
      footer={
        <Foot onClose={onClose}>
          <EditOnly>
            <Button
              onClick={() => {
                setTried(true);
                if (!err.share && !err.from) onSave(Math.round(n * 10) / 10, from);
              }}
            >
              Save
            </Button>
          </EditOnly>
        </Foot>
      }
    >
      <div className="ops-form ops-form--2">
        <Field id="mp-share" label="Share of GSP’s commission (%)" required error={tried ? err.share : null}>
          <TextInput id="mp-share" inputMode="decimal" value={share} invalid={tried && !!err.share} onChange={(e) => setShare(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Field id="mp-from" label="From" required error={tried ? err.from : null}>
          <TextInput id="mp-from" type="date" value={from} invalid={tried && !!err.from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
