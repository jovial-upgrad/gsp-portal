import { RpCommission } from '../../components/CommissionSummary';
import { byRegion, getScope, isIsolated } from '../../data/scope';
import { regionOfCountry } from '../../data/regions';
import { useMemo, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, TextInput } from '../../components/forms';
import { CountryCombobox } from '../../components/CountryCombobox';
import { PhoneInput } from '../../components/PhoneInput';
import { Paper } from '../../components/DocView';
import { CopyButton } from '../students/parts';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { countryByName, partnerManagerFor } from '../../data/partners';
import { rpBranches, rpTeam } from '../../data/rpteam';
import { staffIn, label } from '../../data/staff';
import { RP_STATUSES, dateText, type RecruitmentPartner, type RpDoc, type RpStatus } from '../data/records';
import { acceptRpAgreement, approveRp, canApprove, docsVerified, editRp, issueNotice, markTrained, rpActions, sendBackRpAgreement, sendBackRpDoc, setRpStatus, uploadRpAgreement, verifyRpDoc } from '../data/rpverify';
import { acceptOf, audit, checkFile, dateTimeText } from '../data/changelog';
import { mpRegion } from '../data/masters';
import { Facts, Gone, NoMatch, PageHead, Pick, Pill, RecordHead, RecordTabs, Section, TabPanel, Tiles, downloadCsv, usePager, useRecord, type Tone } from './parts';
import { downloadFile } from './PartnerPage';
import { OBJ, canEdit, canSee, type PageProps } from '../portal/model';

const TONE: Record<RpStatus, Tone> = { 'Not activated': 'you', Verifying: 'gsp', 'Documents sent back': 'you', Activated: 'uni', 'Agreement signed': 'ok', Rejected: 'bad', Suspended: 'bad', Dormant: 'grey' };
export const RpPill = ({ s }: { s: RpStatus }) => <Pill tone={TONE[s]}>{s}</Pill>;
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
/** An RP's sales region: from its head office country through the map (slice 1). */
export const rpRegion = (r: Pick<RecruitmentPartner, 'country'>) => regionOfCountry(r.country);

/**
 * Recruitment partners (slice 2 PRD, BAP and RP records): tiles Waiting for BAP, Not activated, Sent back, Not signed
 * yet, Agreement signed; search by name, city, code or contact; filters status, country, BDM; Export as CSV (logged as
 * a download). Admission and Recruitment see only RPs in their own sales regions (S4-24), in lists, counts, exports and
 * direct links. Every other role with View reads the same list and record.
 */
export function RecruitmentPartners(props: PageProps) {
  const { db, focus, navKey, open, scrollTop, say, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<RpStatus | ''>('');
  const [country, setCountry] = useState('');
  const [bdm, setBdm] = useState('');
  // region isolation is per user (slice 1, S4-24)
  const rps = useMemo(() => byRegion(db.rps, rpRegion), [db.rps]);
  const rows = rps.filter((r) => {
    const t = q.trim().toLowerCase();
    if (t && ![r.name, r.city, r.code, r.contact.name, r.contact.email].some((x) => x.toLowerCase().includes(t))) return false;
    if (status && r.status !== status) return false;
    if (country && r.country !== country) return false;
    if (bdm && r.bdm !== bdm) return false;
    return true;
  });
  const { page, pager } = usePager(rows, [q, status, country, bdm]);
  const clear = () => {
    setQ('');
    setStatus('');
    setCountry('');
    setBdm('');
  };

  if (cur) {
    const shown = rps.find((r) => r.id === cur.id);
    if (!shown) return <Gone denied={db.rps.some((r) => r.id === cur.id)} back={cur.back?.label ?? 'Recruitment partners'} onBack={back} />;
    return <RpPage key={shown.id} r={shown} tab={cur.tab} onBack={back} {...props} />;
  }

  return (
    <div className="ipage">
      <PageHead title="Recruitment partners" lead={`Every recruitment partner and where it is in onboarding${isIsolated() ? ', in your sales regions' : ''}. BAP (RP Ops) verifies new ones.`}>
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            downloadCsv('recruitment-partners.csv', [['Recruitment partner', 'Code', 'City', 'Country', 'Status', 'Since', 'BDM', 'Contact', 'Email', 'Phone', 'Documents missing'], ...rows.map((r) => [r.name, r.code, r.city, r.country, r.status, r.since, r.bdm, r.contact.name, r.contact.email, r.contact.phone, missingOf(r)])]);
            audit('Recruitment partners', 'Recruitment partners', me, props.role ?? '', 'download', { size: `${rows.length} rows`, format: 'CSV', filters: [status, country, bdm, q].filter(Boolean).join(', ') || 'None' });
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
            <Pick id="irp-status" label="Status" value={status} all="All statuses" options={RP_STATUSES} onChange={(v) => setStatus(v as RpStatus | '')} />
            <Pick id="irp-country" label="Country" value={country} all="All countries" options={[...new Set(rps.map((r) => r.country))].sort()} onChange={setCountry} />
            <Pick id="irp-bdm" label="BDM" value={bdm} all="All BDMs" options={[...new Set(rps.map((r) => r.bdm).filter(Boolean))].sort()} onChange={setBdm} />
          </div>
          <p className="stools__count" id="irp-count" role="status">
            <span>
              <span className="num">{rows.length === rps.length ? rps.length : `${rows.length} of ${rps.length}`}</span> recruitment partners
            </span>
          </p>
        </div>
        {rps.length === 0 ? (
          <p className="iempty">No recruitment partners yet. They join through Become a GSP partner.</p>
        ) : rows.length === 0 ? (
          <NoMatch onClear={clear} />
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
                {page.map((r) => {
                  const miss = missingOf(r);
                  return (
                    <tr key={r.id} className="irow" onClick={() => show(r.id)}>
                      <td>
                        <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(r.id))}>
                          {r.name}
                        </button>
                        <span className="irow__sub">
                          {[r.city, r.country].filter(Boolean).join(', ')} · {r.code}
                        </span>
                      </td>
                      <td>{r.bdm || <span className="muted">Not set</span>}</td>
                      <td className="num">{sinceText(r.since)}</td>
                      <td>{miss ? <span className="is-warn">{miss === 1 ? '1 document missing' : `${miss} documents missing`}</span> : 'All in'}</td>
                      <td>
                        <RpPill s={r.status} />
                        {r.status === 'Activated' && r.agreement && <span className="irow__sub">Agreement: {r.agreement.state}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pager}
      </section>
    </div>
  );
}

type Tab = 'overview' | 'documents' | 'commission' | 'activity';
type Ask = { kind: 'reject' | 'suspend' | 'reactivate' | 'approve' | 'accept' | 'trained' | 'unlink' } | null;

/**
 * An RP's record (slice 2 PRD): Overview (details, GSP contacts and mapping, Branches and team), Commission (terms
 * read-only; RP Ops, Finance and Admin change bank details), Documents (onboarding documents and the RP agreement) and
 * Activity. BAP (RP Ops) verifies or sends back each document, uploads the agreement, approves, then accepts or sends
 * back the signed copy. Admin, Recruitment and RP Ops Reject, Suspend and Reactivate (S2-26; offered as S2C-9 proposes).
 */
function RpPage(props: PageProps & { r: RecruitmentPartner; tab?: string; onBack: () => void }) {
  const { r, tab: start, onBack, say, me, db } = props;
  const role = props.role ?? '';
  const editProfile = canEdit(props, OBJ.rp);
  const checkDocs = canEdit(props, OBJ.rpDocs);
  const seeDocs = canSee(props, OBJ.rpDocs);
  const issueDocs = canEdit(props, OBJ.rpIssued) && role !== 'Finance';
  const editTeam = canEdit(props, OBJ.rpTeam);
  const editMp = canEdit(props, OBJ.mps);
  const [tab, setTab] = useState<Tab>(start === 'documents' || start === 'activity' || start === 'commission' ? start : checkDocs && r.docs.some((d) => d.state === 'With BAP') ? 'documents' : 'overview');
  const [doc, setDoc] = useState<{ name: string; file: string } | null>(null);
  const [backDoc, setBackDoc] = useState<RpDoc | null>(null);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState<Ask>(null);
  const [agrBack, setAgrBack] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [branching, setBranching] = useState(false);
  const [noticing, setNoticing] = useState(false);
  const [linking, setLinking] = useState(false);
  const toCheck = r.docs.filter((d) => d.state === 'With BAP').length;
  const verified = docsVerified(r);
  const ready = canApprove(r);
  const acts = editProfile ? rpActions(r.status) : [];
  const mp = db.mps.find((m) => m.rps.some((l) => l.rpId === r.id));
  const branches = [...rpBranches(r.name), ...(r.branches ?? [])];
  const team = rpTeam(r.name);
  const banner = checkDocs && (toCheck > 0 || verified || r.agreement?.state === 'Signed copy received');

  return (
    <div className="ipage irecord">
      <RecordHead
        back="Recruitment partners"
        onBack={onBack}
        title={r.name}
        sub={[r.city, r.country].filter(Boolean).join(', ') + ` · ${r.code}`}
        status={
          <>
            <RpPill s={r.status} />
            {r.status === 'Activated' && r.agreement && <span className="irhead__k">Agreement: {r.agreement.state === 'Sent' ? 'Sent (waiting for the RP)' : r.agreement.state === 'Signed copy received' ? 'Signed copy received (waiting for BAP)' : r.agreement.state === 'Sent back' ? 'Sent back (waiting for the RP)' : r.agreement.state}</span>}
          </>
        }
      >
        {(acts.length > 0 || (checkDocs && r.status === 'Agreement signed' && !r.trained) || issueDocs) && (
          <div className="istatus">
            <p className="istatus__note">
              {r.status === 'Suspended'
                ? 'Suspended: every user of this RP has lost access and can’t sign in. GSP carries on with its applications in progress; their commission is paid.'
                : r.status === 'Rejected'
                  ? 'Rejected: final. Its users can’t sign in.'
                  : r.status === 'Activated'
                    ? 'Commission on enrolments is held until the agreement is signed.'
                    : ' '}
            </p>
            <div className="istatus__acts">
              {checkDocs && r.status === 'Agreement signed' && !r.trained && (
                <Button size="sm" variant="secondary" onClick={() => setAsk({ kind: 'trained' })}>
                  Mark training done
                </Button>
              )}
              {issueDocs && !['Rejected'].includes(r.status) && (
                <Button size="sm" variant="secondary" onClick={() => setNoticing(true)}>
                  Issue a notice
                </Button>
              )}
              {acts.map((a) => (
                <Button key={a} size="sm" variant="secondary" onClick={() => setAsk({ kind: a.toLowerCase() as 'reject' })}>
                  {a}
                </Button>
              ))}
            </div>
          </div>
        )}
      </RecordHead>
      {banner && (
        <div className="card irsec">
          <p className="irsec__note">
            {r.agreement?.state === 'Signed copy received'
              ? 'The RP uploaded its signed agreement. Preview it, then accept it or send it back.'
              : ready
                ? 'Every required document is verified and the agreement is uploaded. Approve the partner to activate it and send it the agreement.'
                : verified
                  ? 'Every required document is verified. Upload the RP agreement on Documents, then approve the partner.'
                  : `${toCheck === 1 ? '1 document' : `${toCheck} documents`} to check. Verify each one, or send it back with a reason.`}
          </p>
          <div className="irowacts">
            {tab !== 'documents' && (
              <Button variant="secondary" size="sm" onClick={() => setTab('documents')}>
                Documents
              </Button>
            )}
            <Button size="sm" disabled={!ready} title={!ready ? 'On once every required document is verified and the agreement is uploaded.' : undefined} onClick={() => setAsk({ kind: 'approve' })}>
              Approve partner
            </Button>
          </div>
        </div>
      )}
      <RecordTabs
        id="irptab"
        label="Recruitment partner"
        tab={tab}
        setTab={setTab}
        tabs={(
          [
            { key: 'overview', label: 'Overview' },
            { key: 'commission', label: 'Commission' },
            { key: 'documents', label: 'Documents', n: r.docs.length + (r.agreement ? 1 : 0) },
            { key: 'activity', label: 'Activity', n: r.activity.length },
          ] as { key: Tab; label: string; n?: number }[]
        ).filter((t) => t.key !== 'documents' || seeDocs)}
      />
      <TabPanel id="irptab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section
              title="Details"
              id="irp-details"
              note={r.approved ? 'Verified: GSP changes these from here. A country change re-routes the RP’s sales region (S2-8).' : 'The RP changes these until it’s verified.'}
              action={
                editProfile && r.approved ? (
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditing(true)}>
                    Edit details
                  </Button>
                ) : undefined
              }
            >
              <Facts
                items={[
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
                  ['City', r.city],
                  ['Country', r.country],
                  ['How they found GSP', r.foundUs],
                  ['Onboarded on', dateText(r.since)],
                ]}
              />
            </Section>
            <Section title="GSP contacts and mapping" id="irp-gsp">
              <Facts
                items={[
                  [
                    'BDM',
                    <span key="b" className="irowacts">
                      {r.bdm || <span className="muted">Not set</span>}
                      {editProfile && <BdmPick r={r} me={me} say={say} />}
                    </span>,
                  ],
                  ['Admissions contact', r.admissions],
                  ['Sales region', rpRegion(r)],
                  [
                    'Master Partner',
                    <span key="m" className="irowacts">
                      {mp ? (
                        <button type="button" className="btn btn--link" onClick={() => props.open({ section: 'mps', id: mp.id, back: { section: 'rps', id: r.id, label: r.name } })}>
                          {mp.name}
                        </button>
                      ) : (
                        'None'
                      )}
                      {editMp && (mp ? <button type="button" className="btn btn--link idanger" onClick={() => setAsk({ kind: 'unlink' })}>Unlink</button> : <button type="button" className="btn btn--link" onClick={() => setLinking(true)}>Link a Master Partner</button>)}
                    </span>,
                  ],
                ]}
              />
            </Section>
            <Section
              title="Branches and team"
              id="irp-team"
              note="The same people the RP’s Profile lists, as GSP sees them on applications."
              action={editTeam ? <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => setBranching(true)}>Add branch</Button> : undefined}
            >
              {branches.length ? (
                <div className="stab-wrap">
                  <table className="itab">
                    <thead>
                      <tr>
                        <th scope="col">Branch</th>
                        <th scope="col">City and country</th>
                        <th scope="col">Branch BDM</th>
                        <th scope="col">Team</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map((b) => (
                        <tr key={b.id}>
                          <td>
                            {b.name}
                            {b.main && <span className="irow__sub">Head office</span>}
                          </td>
                          <td>{[b.city, b.state, b.country].filter(Boolean).join(', ')}</td>
                          <td>{(('bdm' in b && typeof b.bdm === 'string' && b.bdm) as string) || partnerManagerFor(b.country, b.city, '')?.name || r.bdm || '—'}</td>
                          <td className="num">{team.filter((m) => (m.branch ?? 'hq') === b.id || (b.main && !m.branch)).length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="iempty">No branches yet: the head office is made from the business details on verification.</p>
              )}
              {team.length > 0 && (
                <ul className="ilist">
                  {team.map((m) => (
                    <li key={m.id} className="ilist__item">
                      <Icon name="user" size={18} />
                      <span className="ilist__t">
                        {m.name}
                        <span className="irow__sub">
                          {m.role} · {m.email}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            {(r.notices ?? []).length > 0 && (
              <Section title="Notices" id="irp-notices">
                <ul className="ilist">
                  {r.notices!.map((n) => (
                    <li key={n.id} className="ilist__item">
                      <Icon name="mail" size={18} />
                      <span className="ilist__t">
                        {n.subject}
                        <span className="irow__sub">
                          {n.by} · {dateTimeText(n.at)}
                          {n.file ? ` · ${n.file}` : ''}
                        </span>
                        <span className="irow__sub">{n.message}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
        {tab === 'commission' && (
          <Section title="Commission" id="irp-commission" note="Terms are set by Finance in Commissions (read only here).">
            {/* Jovial, 1 Nov: read-only terms; RP Ops and Finance can change the bank details */}
            <RpCommission name={r.name} canBank={['RP Ops', 'Finance', 'Admin'].includes(role) || ['gsp-bap', 'gsp-finance', 'gsp-admin'].includes(getScope().viewer)} />
            {r.status !== 'Agreement signed' && <p className="irsec__note">Commission on applications enrolled before the agreement is signed is held, and paid once it is (S2-11).</p>}
          </Section>
        )}
        {tab === 'documents' && seeDocs && (
          <>
            <Section title="Onboarding documents" id="irp-docs" note="Each decision records who and when; the RP’s portal shows it at once.">
              <ul className="ilist">
                {r.docs.map((d) => (
                  <li key={d.name} className="ilist__item">
                    <Icon name="file" size={18} />
                    <span className="ilist__t">
                      {d.name}
                      {d.optional && <span className="irow__sub">Optional</span>}
                      {d.at && d.by && <span className="irow__sub">{d.state} by {d.by}, {dateTimeText(d.at)}</span>}
                    </span>
                    {d.state !== 'Missing' && (
                      <button type="button" className="btn btn--link" onClick={() => setDoc({ name: d.name, file: d.file })}>
                        Preview<span className="vh"> {d.name}</span>
                      </button>
                    )}
                    <Pill tone={DOC_TONE[d.state]}>{d.state}</Pill>
                    {checkDocs && d.state === 'With BAP' && (
                      <span className="irowacts">
                        <Button size="sm" variant="secondary" onClick={() => (verifyRpDoc(r.id, d.name, me), audit('Recruitment partners', `rp.document_verified: ${r.name}, ${d.name}`, me, role), say(`${d.name} verified.`))}>
                          Verify<span className="vh"> {d.name}</span>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => (setNote(''), setBackDoc(d))}>
                          Send back<span className="vh"> {d.name}</span>
                        </Button>
                      </span>
                    )}
                    {d.state === 'Sent back' && d.note && <span className="ilist__note">{d.note}</span>}
                  </li>
                ))}
              </ul>
            </Section>
            <Section
              title="RP agreement"
              id="irp-agreement"
              note="RP Ops uploads it before approving; approval sends it to the RP, in its portal and by email. The RP Admin uploads the signed copy; BAP accepts it or sends it back."
              action={
                issueDocs && !r.approved ? (
                  <Button variant="secondary" size="sm" disabled={!verified} title={!verified ? 'Turns on once every required document is verified.' : undefined} iconLeft={<Icon name="upload" size={16} />} onClick={() => setUploading(true)}>
                    {r.agreement ? 'Replace' : 'Upload agreement'}
                  </Button>
                ) : undefined
              }
            >
              {r.agreement ? (
                <>
                  <Facts
                    items={[
                      ['Agreement file', <span key="f" className="irowacts"><span className="ifile"><Icon name="file" size={16} />{r.agreement.file}</span><button type="button" className="btn btn--link" onClick={() => downloadFile(r.agreement!.file)}>Download</button></span>],
                      ['Version or date', r.agreement.version],
                      ['Uploaded', `${r.agreement.by}, ${dateTimeText(r.agreement.uploadedAt)}`],
                      ['Sent on', r.agreement.sentAt ? dateTimeText(r.agreement.sentAt) : 'Not yet: sent when the partner is approved'],
                      ['State', r.agreement.state],
                      ['Signed copy', r.agreement.signed ? <span key="s" className="irowacts">{r.agreement.signed.file}<button type="button" className="btn btn--link" onClick={() => setDoc({ name: 'Signed agreement', file: r.agreement!.signed!.file })}>Preview</button></span> : null],
                      ['Signed on', r.agreement.signed ? dateText(r.agreement.signed.on) : null],
                      ...(r.agreement.reason ? ([['Send-back reason', r.agreement.reason]] as [string, string][]) : []),
                      ['Checked by', r.agreement.checked ? `${r.agreement.checked.by}, ${dateTimeText(r.agreement.checked.at)}` : null],
                    ]}
                  />
                  {issueDocs && r.agreement.state === 'Signed copy received' && (
                    <div className="irowacts">
                      <Button size="sm" onClick={() => setAsk({ kind: 'accept' })}>
                        Accept
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => (setNote(''), setAgrBack(true))}>
                        Send back
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="iempty">No agreement uploaded yet.{issueDocs && !verified ? ' Upload turns on once every required document is verified.' : ''}</p>
              )}
            </Section>
          </>
        )}
        {tab === 'activity' && (
          <Section title="Activity" id="irp-activity">
            <ol className="ilog">
              {r.activity.map((e, i) => (
                <li key={i} className="ilog__item">
                  <span className="ilog__at num">{dateText(e.at)}</span>
                  <span className="ilog__what">{e.what}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </TabPanel>

      <ConfirmDialog
        open={!!backDoc}
        title={`Send back the ${backDoc?.name.toLowerCase() ?? 'document'}?`}
        confirm="Send back"
        onCancel={() => setBackDoc(null)}
        onConfirm={() => {
          if (!backDoc || !note.trim()) return;
          sendBackRpDoc(r.id, backDoc.name, note.trim(), me);
          audit('Recruitment partners', `rp.document_sent_back: ${r.name}, ${backDoc.name} (E7)`, me, role);
          say(`${backDoc.name} sent back to ${r.name}.`);
          setBackDoc(null);
        }}
      >
        <Field id="irp-note" label="Reason" required hint="Shown to the RP." error={!note.trim() ? 'Enter the reason.' : null}>
          <div className="control iform__area">
            <textarea id="irp-note" className="control__input" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={agrBack}
        title="Send back the signed copy?"
        confirm="Send back"
        onCancel={() => setAgrBack(false)}
        onConfirm={() => {
          if (!note.trim()) return;
          sendBackRpAgreement(r.id, note.trim(), me);
          audit('Recruitment partners', `rp.agreement_sent_back: ${r.name} (E9)`, me, role);
          say('Signed copy sent back to the RP.');
          setAgrBack(false);
        }}
      >
        <Field id="irp-agr-note" label="Send-back reason" required hint="Shown to the RP on Home and in E9." error={!note.trim() ? 'Enter the send-back reason.' : null}>
          <div className="control iform__area">
            <textarea id="irp-agr-note" className="control__input" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!ask}
        title={
          ask?.kind === 'approve'
            ? `Approve ${r.name}?`
            : ask?.kind === 'accept'
              ? 'Accept the signed agreement?'
              : ask?.kind === 'trained'
                ? 'Mark the portal training done?'
                : ask?.kind === 'unlink'
                  ? `Unlink ${r.name} from ${mp?.name}?`
                  : `${ask?.kind === 'reject' ? 'Reject' : ask?.kind === 'suspend' ? 'Suspend' : 'Reactivate'} ${r.name}?`
        }
        confirm={ask?.kind === 'approve' ? 'Approve partner' : ask?.kind === 'accept' ? 'Accept' : ask?.kind === 'trained' ? 'Mark done' : ask?.kind === 'unlink' ? 'Unlink' : ask?.kind === 'reject' ? 'Reject' : ask?.kind === 'suspend' ? 'Suspend' : 'Reactivate'}
        danger={ask?.kind === 'reject' || ask?.kind === 'suspend' || ask?.kind === 'unlink'}
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          const k = ask?.kind;
          setAsk(null);
          if (k === 'approve') {
            approveRp(r.id, me);
            audit('Recruitment partners', `rp.approved and rp.agreement_sent: ${r.name} (E8)`, me, role);
            say(`${r.name} approved: Activated, and the agreement went to the RP.`);
          } else if (k === 'accept') {
            acceptRpAgreement(r.id, me);
            audit('Recruitment partners', `rp.agreement_signed: ${r.name} (E10, T58 "Train ${r.name} on the portal")`, me, role);
            say(`${r.name}: Agreement signed. Commissions start.`);
          } else if (k === 'trained') {
            markTrained(r.id, me);
            say('Training marked done.');
          } else if (k === 'unlink' && mp) {
            props.set((d) => ({ ...d, mps: d.mps.map((m) => (m.id === mp.id ? { ...m, rps: m.rps.filter((l) => l.rpId !== r.id) } : m)), rps: d.rps.map((x) => (x.id === r.id ? { ...x, masterPartner: 'None', activity: [{ at: new Date().toISOString().slice(0, 10), what: `Unlinked from Master Partner ${mp.name} (${me})` }, ...x.activity] } : x)) }));
            audit('Master Partners', `master_partner.rp_linked: ${r.name} unlinked from ${mp.name} (E12)`, me, role);
            say(`${r.name} unlinked from ${mp.name}.`);
          } else if (k) {
            const a = (k === 'reject' ? 'Reject' : k === 'suspend' ? 'Suspend' : 'Reactivate') as 'Reject';
            setRpStatus(r.id, a, me);
            audit('Recruitment partners', `rp.status_changed: ${r.name}, ${a} (E11${a !== 'Reject' ? ' to every user of the RP' : ''})`, me, role);
            say(`${r.name}: ${a === 'Reject' ? 'Rejected' : a === 'Suspend' ? 'Suspended' : 'Reactivated'}.`);
          }
        }}
      >
        <p>
          {ask?.kind === 'approve'
            ? 'Every required document is verified and the agreement is uploaded. The partner is Activated, its portal opens fully, and the agreement goes to it on its Home and by email.'
            : ask?.kind === 'accept'
              ? 'The RP becomes Agreement signed and earns commission. Held commission is paid.'
              : ask?.kind === 'trained'
                ? 'Closes the task "Train the RP on the portal" (T58).'
                : ask?.kind === 'unlink'
                  ? 'Applications created from now on don’t pay the Master Partner. Earlier ones stay as they were.'
                  : ask?.kind === 'reject'
                    ? 'Rejected is final. Its users can’t sign in: “This partner account is closed. Contact your partner manager.”'
                    : ask?.kind === 'suspend'
                      ? 'Every user of the RP loses platform access and can’t sign in. GSP carries on processing its applications in progress, and their commission is paid.'
                      : 'It goes back to its last status, and every user’s access comes back.'}
        </p>
      </ConfirmDialog>
      <Sheet open={!!doc} onClose={() => setDoc(null)} center className="iform" title={doc?.name ?? ''} sub={doc?.file}>
        {doc && <Paper d={{ name: doc.name, file: doc.file }} />}
      </Sheet>
      <AgreementUpload open={uploading} onCancel={() => setUploading(false)} onSave={(file, version) => (uploadRpAgreement(r.id, file, version, me), audit('Recruitment partners', `RP agreement uploaded for ${r.name} (${version})`, me, role), setUploading(false), say('Agreement uploaded.'))} />
      <EditRp open={editing} r={r} onCancel={() => setEditing(false)} onSave={(f) => (editRp(r.id, (x) => ({ ...x, ...f }), f.country !== r.country ? `Details changed; country ${r.country} → ${f.country}, sales region re-routed to ${regionOfCountry(f.country)}` : 'Details changed', me), setEditing(false), say(`${f.name} saved.`))} />
      <AddBranch open={branching} r={r} taken={(n) => branches.some((b) => b.name.toLowerCase() === n.trim().toLowerCase())} onCancel={() => setBranching(false)} onSave={(b) => (editRp(r.id, (x) => ({ ...x, branches: [...(x.branches ?? []), b] }), `Branch ${b.name} added`, me), setBranching(false), say(`${b.name} added.`))} />
      <Notice open={noticing} onCancel={() => setNoticing(false)} onSave={(n) => (issueNotice(r.id, n, me), audit('Recruitment partners', `rp.notice_issued: ${r.name}, ${n.subject} (T59)`, me, role), setNoticing(false), say('Notice issued: it goes to the RP’s bell and its RP Admins by email.'))} />
      <LinkMp open={linking} r={r} mps={db.mps.filter((m) => m.status === 'Active' && (!isIsolated() || byRegion([m], mpRegion).length))} onCancel={() => setLinking(false)} onSave={(mpId) => {
        const m = db.mps.find((x) => x.id === mpId)!;
        props.set((d) => ({ ...d, mps: d.mps.map((x) => (x.id === mpId ? { ...x, rps: [...x.rps, { rpId: r.id, at: Date.now(), by: me }] } : x)), rps: d.rps.map((x) => (x.id === r.id ? { ...x, masterPartner: m.name, activity: [{ at: new Date().toISOString().slice(0, 10), what: `Linked to Master Partner ${m.name} (${me})` }, ...x.activity] } : x)) }));
        audit('Master Partners', `master_partner.rp_linked: ${r.name} linked to ${m.name} (E12; bell to its BDM and Finance)`, me, role);
        setLinking(false);
        say(`${r.name} linked to ${m.name}. Applications created from now pay it.`);
      }} />
    </div>
  );
}

/** The BDM, changed by Recruitment, RP Ops and Admin (slice 2 PRD): a GSP user with the Recruitment role. */
function BdmPick({ r, me, say }: { r: RecruitmentPartner; me: string; say: (m: string) => void }) {
  const [on, setOn] = useState(false);
  const [v, setV] = useState(r.bdm);
  if (!on)
    return (
      <button type="button" className="btn btn--link" onClick={() => (setV(r.bdm), setOn(true))}>
        Change
      </button>
    );
  return (
    <span className="irowacts">
      <Pick id="irp-bdm-pick" label="BDM" value={v} placeholder="Pick a BDM" options={staffIn('Recruitment').map(label)} onChange={setV} />
      <Button size="sm" variant="secondary" onClick={() => setOn(false)}>
        Cancel
      </Button>
      <Button size="sm" disabled={!v || v === r.bdm} onClick={() => (editRp(r.id, (x) => ({ ...x, bdm: v }), `BDM ${r.bdm || '—'} → ${v}`, me), setOn(false), say('BDM saved.'))}>
        Save
      </Button>
    </span>
  );
}

function AgreementUpload({ open, onCancel, onSave }: { open: boolean; onCancel: () => void; onSave: (file: string, version: string) => void }) {
  const [file, setFile] = useState('');
  const [version, setVersion] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const e = { file: err ?? (!file ? 'Choose a file.' : null), version: !version.trim() ? 'Enter the version or date.' : null };
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Upload the RP agreement"
      sub="PDF, up to 20 MB. It goes to the RP when the partner is approved."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => (setTried(true), !e.file && !e.version && (onSave(file, version.trim()), setFile(''), setVersion(''), setTried(false)))}>Upload</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="irp-agr-file" label="Agreement file" required error={tried || err ? e.file : null}>
          <button id="irp-agr-file" type="button" className={`ipick ${(tried || err) && e.file ? 'is-invalid' : ''}`} onClick={() => pick.current?.click()}>
            <Icon name={file ? 'file' : 'upload'} size={18} />
            <span className="ipick__t">{file || 'Choose a file'}</span>
          </button>
          <input ref={pick} type="file" accept={acceptOf(['pdf'])} className="vh" tabIndex={-1} aria-hidden="true" data-testid="irp-agr-input" onChange={(ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (!f) return;
            const bad = checkFile(f, ['pdf'], 20);
            setErr(bad);
            setFile(bad ? '' : f.name);
          }} />
        </Field>
        <Field id="irp-agr-ver" label="Version or date" required error={tried ? e.version : null} hint="Like “v3” or “Oct 2026”.">
          <TextInput id="irp-agr-ver" value={version} maxLength={40} invalid={tried && !!e.version} onChange={(x) => setVersion(x.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

type RpEdit = { name: string; city: string; country: string; contact: RecruitmentPartner['contact'] };
/** Details GSP changes after verification: name, city, country (re-routes the region, S2-8), contact. */
function EditRp({ open, r, onCancel, onSave }: { open: boolean; r: RecruitmentPartner; onCancel: () => void; onSave: (f: RpEdit) => void }) {
  const [v, setV] = useState<RpEdit>({ name: r.name, city: r.city, country: r.country, contact: r.contact });
  const [dial, setDial] = useState(r.contact.phone.split(' ')[0] || '+91');
  const [num, setNum] = useState(r.contact.phone.split(' ').slice(1).join(' '));
  const [tried, setTried] = useState(false);
  const e = {
    name: !v.name.trim() ? 'Enter the name.' : null,
    city: !v.city.trim() ? 'Enter the city.' : null,
    country: !countryByName(v.country) ? 'Pick a country.' : null,
    cname: !v.contact.name.trim() ? 'Enter the contact name.' : null,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact.email) ? 'Enter a valid email, like name@agency.com.' : null,
    phone: num.replace(/\D/g, '').length < 7 || num.replace(/\D/g, '').length > 13 ? '7 to 13 digits.' : null,
  };
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Edit details"
      sub="A country change re-routes the RP’s sales region."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => (setTried(true), !Object.values(e).some(Boolean) && onSave({ ...v, name: v.name.trim(), city: v.city.trim(), contact: { ...v.contact, phone: `${dial} ${num.trim()}` } }))}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="irpe-name" label="Name" required error={tried ? e.name : null} className="iform__wide">
          <TextInput id="irpe-name" value={v.name} maxLength={160} invalid={tried && !!e.name} onChange={(x) => setV({ ...v, name: x.target.value })} />
        </Field>
        <Field id="irpe-country" label="Country" required error={tried ? e.country : null}>
          <CountryCombobox id="irpe-country" value={v.country} invalid={tried && !!e.country} onChange={(country) => setV({ ...v, country })} />
        </Field>
        <Field id="irpe-city" label="City" required error={tried ? e.city : null}>
          <TextInput id="irpe-city" value={v.city} invalid={tried && !!e.city} onChange={(x) => setV({ ...v, city: x.target.value })} />
        </Field>
        <Field id="irpe-cname" label="Contact name" required error={tried ? e.cname : null}>
          <TextInput id="irpe-cname" value={v.contact.name} invalid={tried && !!e.cname} onChange={(x) => setV({ ...v, contact: { ...v.contact, name: x.target.value } })} />
        </Field>
        <Field id="irpe-email" label="Contact email" required error={tried ? e.email : null}>
          <TextInput id="irpe-email" type="email" value={v.contact.email} invalid={tried && !!e.email} onChange={(x) => setV({ ...v, contact: { ...v.contact, email: x.target.value } })} />
        </Field>
        <Field id="irpe-phone" label="Contact phone" required error={tried ? e.phone : null}>
          <PhoneInput id="irpe-phone" dial={dial} number={num} invalid={tried && !!e.phone} onDial={setDial} onNumber={setNum} />
        </Field>
      </div>
    </Sheet>
  );
}

type NewBranch = { id: string; name: string; country: string; state: string; city: string; bdm?: string };
/** Add branch from the RP's record (Recruitment for RPs in its regions, RP Ops, Admin): its BDM comes from BDM assignment. */
export function AddBranch({ open, r, taken, onCancel, onSave }: { open: boolean; r: Pick<RecruitmentPartner, 'name'>; taken: (n: string) => boolean; onCancel: () => void; onSave: (b: NewBranch) => void }) {
  const [v, setV] = useState({ name: '', country: '', state: '', city: '' });
  const [tried, setTried] = useState(false);
  const states = countryByName(v.country)?.states ?? [];
  const e = {
    name: !v.name.trim() ? 'Enter the branch name.' : taken(v.name) ? `${r.name} already has a branch with this name.` : null,
    country: !countryByName(v.country) ? 'Pick a country.' : null,
    state: states.length && !v.state ? 'Pick a state.' : null,
    city: !v.city.trim() ? 'Enter the city.' : null,
  };
  const bdm = v.country && v.city ? partnerManagerFor(v.country, v.city, '')?.name : undefined;
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Add branch"
      sub="The branch’s sales region comes from its country; its BDM from BDM assignment."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => (setTried(true), !Object.values(e).some(Boolean) && (onSave({ id: `br-${Date.now().toString(36)}`, name: v.name.trim(), country: v.country, state: v.state, city: v.city.trim(), bdm }), setV({ name: '', country: '', state: '', city: '' }), setTried(false)))}>Add branch</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="iab-name" label="Branch name" required error={tried ? e.name : null} className="iform__wide">
          <TextInput id="iab-name" value={v.name} maxLength={80} invalid={tried && !!e.name} onChange={(x) => setV({ ...v, name: x.target.value })} />
        </Field>
        <Field id="iab-country" label="Country" required error={tried ? e.country : null}>
          <CountryCombobox id="iab-country" value={v.country} invalid={tried && !!e.country} onChange={(country) => setV({ ...v, country, state: '' })} />
        </Field>
        {states.length > 0 && (
          <Field id="iab-state" label="State" required error={tried ? e.state : null}>
            <Pick id="iab-state" label="State" value={v.state} placeholder="Pick a state" invalid={tried && !!e.state} options={states} onChange={(state) => setV({ ...v, state })} />
          </Field>
        )}
        <Field id="iab-city" label="City" required error={tried ? e.city : null}>
          <TextInput id="iab-city" value={v.city} invalid={tried && !!e.city} onChange={(x) => setV({ ...v, city: x.target.value })} />
        </Field>
        <Field id="iab-bdm" label="Branch BDM" hint="Set by the system from BDM assignment.">
          <TextInput id="iab-bdm" value={bdm ?? '—'} readOnly />
        </Field>
      </div>
    </Sheet>
  );
}

/** Issue a notice (proposal S2C-12): subject, message, optional PDF up to 20 MB. */
function Notice({ open, onCancel, onSave }: { open: boolean; onCancel: () => void; onSave: (n: { subject: string; message: string; file?: string }) => void }) {
  const [v, setV] = useState({ subject: '', message: '', file: '' });
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const e = { subject: !v.subject.trim() ? 'Enter the subject.' : null, message: !v.message.trim() ? 'Enter the message.' : null };
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Issue a notice"
      sub="It goes to the RP’s bell and its RP Admins by email, shows on its Activity, and starts the task “Follow up the notice” (T59, 3 working days)."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => (setTried(true), !e.subject && !e.message && !err && (onSave({ subject: v.subject.trim(), message: v.message.trim(), file: v.file || undefined }), setV({ subject: '', message: '', file: '' }), setTried(false)))}>Issue notice</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="irn-subject" label="Subject" required error={tried ? e.subject : null} className="iform__wide">
          <TextInput id="irn-subject" value={v.subject} maxLength={120} invalid={tried && !!e.subject} onChange={(x) => setV({ ...v, subject: x.target.value })} />
        </Field>
        <Field id="irn-message" label="Message" required error={tried ? e.message : null} className="iform__wide">
          <div className="control iform__area">
            <textarea id="irn-message" className="control__input" rows={4} maxLength={2000} value={v.message} onChange={(x) => setV({ ...v, message: x.target.value })} />
          </div>
        </Field>
        <Field id="irn-file" label="PDF" optional error={err} hint="Up to 20 MB." className="iform__wide">
          <button id="irn-file" type="button" className="ipick" onClick={() => pick.current?.click()}>
            <Icon name={v.file ? 'file' : 'upload'} size={18} />
            <span className="ipick__t">{v.file || 'Choose a PDF'}</span>
          </button>
          <input ref={pick} type="file" accept={acceptOf(['pdf'])} className="vh" tabIndex={-1} aria-hidden="true" onChange={(ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (!f) return;
            const bad = checkFile(f, ['pdf'], 20);
            setErr(bad);
            setV((x) => ({ ...x, file: bad ? '' : f.name }));
          }} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Link the RP to a Master Partner (S2-22, S2-23): Active ones only; applications created after the link pay it. */
function LinkMp({ open, r, mps, onCancel, onSave }: { open: boolean; r: RecruitmentPartner; mps: PageProps['db']['mps']; onCancel: () => void; onSave: (id: string) => void }) {
  const [v, setV] = useState('');
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title={`Link ${r.name} to a Master Partner`}
      sub="Applications created from now on pay the Master Partner. Earlier ones stay as they were."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={!v} onClick={() => (onSave(v), setV(''))}>
              Link
            </Button>
          </div>
        </div>
      }
    >
      <Field id="irp-mp" label="Master Partner" required>
        <Pick id="irp-mp" label="Master Partner" value={v} placeholder="Pick a Master Partner" options={mps.map((m) => ({ value: m.id, label: m.name, note: m.code }))} onChange={setV} />
      </Field>
    </Sheet>
  );
}
