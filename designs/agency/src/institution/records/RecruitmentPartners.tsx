import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectInput } from '../../components/forms';
import { Paper } from '../../components/DocView';
import { CopyButton } from '../students/parts';
import { RP_STATUSES, dateText, type RecruitmentPartner, type RpDoc, type RpStatus } from '../data/records';
import { Facts, NoMatch, PageHead, Pill, RecordHead, RecordTabs, Section, TabPanel, Tiles, downloadCsv, useRecord, type Tone } from './parts';
import type { PageProps } from '../portal/model';

const TONE: Record<RpStatus, Tone> = { 'Not activated': 'you', Verifying: 'gsp', 'Documents sent back': 'you', Activated: 'uni', 'Agreement signed': 'ok', Rejected: 'bad', Suspended: 'bad', Dormant: 'grey' };
const RpPill = ({ s }: { s: RpStatus }) => <Pill tone={TONE[s]}>{s}</Pill>;
const DOC_TONE: Record<RpDoc['state'], Tone> = { 'With BAP': 'gsp', Verified: 'ok', 'Sent back': 'you', Missing: 'grey' };
const TILES: { key: RpStatus; label: string; tone: Tone }[] = [
  { key: 'Verifying', label: 'Waiting for BAP', tone: 'gsp' },
  { key: 'Not activated', label: 'Not activated', tone: 'you' },
  { key: 'Documents sent back', label: 'Sent back', tone: 'you' },
  { key: 'Activated', label: 'Not signed yet', tone: 'uni' },
  { key: 'Agreement signed', label: 'Agreement signed', tone: 'ok' },
];
const missingOf = (r: RecruitmentPartner) => r.docs.filter((d) => d.state === 'Missing').length;
const sinceText = (iso: string) => (iso.slice(0, 4) === String(new Date().getFullYear()) ? dateText(iso, true) : dateText(iso));

/**
 * Recruitment partners (29 Oct; 6th round, as in the PM prototype's IP team): every recruitment partner and where it is
 * in onboarding, from Not activated to Agreement signed (or Rejected, Suspended, Dormant). BAP works the Verifying
 * ones. The Institution Team can look and export, and changes nothing. No automated checks.
 */
export function RecruitmentPartners(props: PageProps) {
  const { db, focus, navKey, open, scrollTop, say } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<RpStatus | ''>('');
  const [country, setCountry] = useState('');
  const [bdm, setBdm] = useState('');
  const rps = db.rps;
  const rows = rps.filter((r) => {
    const t = q.trim().toLowerCase();
    if (t && ![r.name, r.city, r.code, r.contact.name].some((x) => x.toLowerCase().includes(t))) return false;
    if (status && r.status !== status) return false;
    if (country && r.country !== country) return false;
    if (bdm && r.bdm !== bdm) return false;
    return true;
  });
  const clear = () => {
    setQ('');
    setStatus('');
    setCountry('');
    setBdm('');
  };

  const shown = cur ? rps.find((r) => r.id === cur.id) : undefined;
  if (cur && shown) return <RpPage key={shown.id} r={shown} tab={cur.tab} onBack={back} say={say} />;

  return (
    <div className="ipage">
      <p className="iviewonly">
        <Icon name="eye" size={16} /> View only: the Institution Team can see recruitment partners and export them, but not change them.
      </p>
      <PageHead title="Recruitment partners" lead="Every recruitment partner and where it is in onboarding. BAP works the Verifying ones.">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            downloadCsv('recruitment-partners.csv', [['Recruitment partner', 'Code', 'City', 'Country', 'Status', 'Since', 'BDM', 'Contact', 'Email', 'Phone', 'Documents missing'], ...rows.map((r) => [r.name, r.code, r.city, r.country, r.status, r.since, r.bdm, r.contact.name, r.contact.email, r.contact.phone, missingOf(r)])]);
            say(`${rows.length} recruitment partners exported.`);
          }}
        >
          Export as CSV
        </Button>
      </PageHead>

      <Tiles label="Where each partner is" value={status} onPick={setStatus} items={TILES.map((t) => ({ ...t, n: rps.filter((r) => r.status === t.key).length }))} />

      <section className="card stable" aria-labelledby="irp-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search recruitment partners</span>
              <input id="irp-q" type="search" placeholder="Name, city, code or contact" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <SelectInput id="irp-status" aria-label="Status" value={status} placeholder="All statuses" allowEmpty onChange={(e) => setStatus(e.target.value as RpStatus | '')}>
              {RP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="irp-country" aria-label="Country" value={country} placeholder="All countries" allowEmpty onChange={(e) => setCountry(e.target.value)}>
              {[...new Set(rps.map((r) => r.country))].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="irp-bdm" aria-label="BDM" value={bdm} placeholder="All BDMs" allowEmpty onChange={(e) => setBdm(e.target.value)}>
              {[...new Set(rps.map((r) => r.bdm))].sort().map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </SelectInput>
          </div>
          <p className="stools__count" id="irp-count" role="status">
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
                  <th scope="col">BDM</th>
                  <th scope="col">Since</th>
                  <th scope="col">Documents</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const miss = missingOf(r);
                  return (
                    <tr key={r.id} className="irow" onClick={() => show(r.id)}>
                      <td>
                        <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(r.id))}>
                          {r.name}
                        </button>
                        <span className="irow__sub">
                          {r.city}, {r.country} · {r.code}
                        </span>
                      </td>
                      <td>{r.bdm}</td>
                      <td className="num">{sinceText(r.since)}</td>
                      <td>{miss ? <span className="irow__sub is-warn">{miss === 1 ? '1 document missing' : `${miss} documents missing`}</span> : <span className="muted">All in</span>}</td>
                      <td>
                        <RpPill s={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type Tab = 'overview' | 'documents' | 'activity';

/** A recruitment partner, to look at: its details and who looks after it, its documents, and what's happened. */
function RpPage({ r, tab: start, onBack, say }: { r: RecruitmentPartner; tab?: string; onBack: () => void; say: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>(start === 'documents' || start === 'activity' ? start : 'overview');
  const [doc, setDoc] = useState<RpDoc | null>(null);
  return (
    <div className="ipage irecord">
      <p className="iviewonly">
        <Icon name="eye" size={16} /> View only: the Institution Team can see this but not change it.
      </p>
      <RecordHead back="Recruitment partners" onBack={onBack} title={r.name} sub={`${r.city}, ${r.country} · ${r.code}`} status={<RpPill s={r.status} />} />
      <RecordTabs
        id="irptab"
        label="Recruitment partner"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'documents', label: 'Documents', n: r.docs.length },
          { key: 'activity', label: 'Activity', n: r.activity.length },
        ]}
      />
      <TabPanel id="irptab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section title="Details" id="irp-details">
              <Facts
                items={[
                  // the contact as separate fields, so each lines up (29 Oct, 7th round)
                  ['Contact person', r.contact.name],
                  [
                    'Email',
                    <span key="e" className="ifacts__copy">
                      <a href={`mailto:${r.contact.email}`}>{r.contact.email}</a>
                      <CopyButton text={r.contact.email} what="Email" onDone={say} />
                    </span>,
                  ],
                  ['Phone', <span key="p" className="num">{r.contact.phone}</span>],
                  ['City', r.city],
                  ['Found us through', r.foundUs],
                ]}
              />
            </Section>
            <Section title="GSP contacts and mapping" id="irp-gsp">
              <Facts
                items={[
                  ['BDM', r.bdm],
                  ['Admissions contact', r.admissions],
                  ['Master Partner', r.masterPartner],
                ]}
              />
            </Section>
          </>
        )}
        {tab === 'documents' && (
          <Section title="Documents" id="irp-docs">
            <ul className="ilist">
              {r.docs.map((d) => (
                <li key={d.name} className="ilist__item">
                  <Icon name="file" size={18} />
                  <span className="ilist__t">{d.name}</span>
                  {d.state !== 'Missing' && (
                    <button type="button" className="btn btn--link" onClick={() => setDoc(d)}>
                      Preview<span className="vh"> {d.name}</span>
                    </button>
                  )}
                  <Pill tone={DOC_TONE[d.state]}>{d.state}</Pill>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {tab === 'activity' && (
          <Section title="Timeline" id="irp-activity">
            <ol className="ilog">
              {r.activity.map((e, i) => (
                <li key={i} className="ilog__item">
                  <span className="ilog__at num">{sinceText(e.at)}</span>
                  <span className="ilog__what">{e.what}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </TabPanel>
      <Sheet open={!!doc} onClose={() => setDoc(null)} center className="iform" title={doc?.name ?? ''} sub={doc?.file}>
        {doc && <Paper d={{ name: doc.name, file: doc.file }} />}
      </Sheet>
    </div>
  );
}
