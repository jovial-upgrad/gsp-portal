import { RpCommission } from '../../components/CommissionSummary';
import { canEditObject } from '../../admin/data/menus';
import { fmtDate } from '../../data/format';
import { byRegion, isIsolated } from '../../data/scope';
import { regionOfCountry } from '../../data/regions';
import { useMemo, useState } from 'react';
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
import { RP_STATUSES, RP_STATUS_TONE, dateText, type RecruitmentPartner, type RpDoc, type RpStatus } from '../data/records';
import { activeAgreement, agreementActivity, agreementLine, commissionHeld, openAgreement, signedOf, versionsOf } from '../data/agreements';
import { AgreementSection, sendOffWhy, useAgreementActions } from './RpAgreements';
import { atIso } from '../data/changelog';
import { canApprove, docsVerified, editRp, markTrained, readyForAgreement, rpActions, sendBackRpDoc, setRpStatus, verifyRpDoc } from '../data/rpverify';
import { audit, dateTimeText } from '../data/changelog';
import { mpRegion } from '../data/masters';
import { Facts, Gone, NoMatch, PageHead, Pick, Pill, RecordHead, RecordTabs, Section, TabPanel, Tiles, downloadCsv, usePager, useRecord, type Tone } from './parts';
import { OBJ, canEdit, canSee, type PageProps } from '../portal/model';

export const RpPill = ({ s }: { s: RpStatus }) => <Pill tone={RP_STATUS_TONE[s] as Tone}>{s}</Pill>;
const DOC_TONE: Record<RpDoc['state'], Tone> = { 'With BAP': 'gsp', Verified: 'ok', 'Sent back': 'you', Missing: 'grey' };
const TILES: { key: RpStatus; label: string; tone: Tone }[] = [
  { key: 'Verifying', label: 'Waiting for BAP', tone: 'gsp' },
  { key: 'Not activated', label: 'Not activated', tone: 'you' },
  { key: 'Documents sent back', label: 'Sent back', tone: 'you' },
  { key: 'Agreement sent', label: 'Agreement sent', tone: 'uni' },
  { key: 'Agreement signed', label: 'Agreement signed', tone: 'ok' },
];
const missingOf = (r: RecruitmentPartner) => r.docs.filter((d) => d.state === 'Missing').length;
const sinceText = (iso: string) => (iso.slice(0, 4) === String(new Date().getFullYear()) ? dateText(iso, true) : dateText(iso));
/** An RP's sales region: from its head office country through the map (slice 1). */
export const rpRegion = (r: Pick<RecruitmentPartner, 'country'>) => regionOfCountry(r.country);

/**
 * Recruitment partners (slice 2 PRD, BAP and RP records): tiles Waiting for BAP, Not activated, Sent back, Not signed
 * yet, Agreement signed; search by name, city, code or contact; filters status, country, BDM; Export as CSV (logged as
 * a download). Every GSP role but Admin sees only RPs in its own sales regions (Regression 31), in lists, counts, exports
 * and direct links.
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
    if (!shown) return <Gone back={cur.back?.label ?? 'Recruitment partners'} onBack={back} />;
    return <RpPage key={shown.id} r={shown} tab={cur.tab} onBack={back} {...props} />;
  }

  return (
    <div className="ipage">
      <PageHead title="Recruitment partners" lead={`Every recruitment partner and where it is in onboarding${isIsolated() ? ', in your sales regions' : ''}. BAP (RP Ops) verifies new ones.`}>
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            downloadCsv('recruitment-partners.csv', [['Recruitment partner', 'Code', 'City', 'Country', 'Status', 'Since', 'Recruitment', 'Contact', 'Email', 'Phone', 'Documents missing'], ...rows.map((r) => [r.name, r.code, r.city, r.country, r.status, r.since, r.bdm, r.contact.name, r.contact.email, r.contact.phone, missingOf(r)])]);
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
            <Pick id="irp-bdm" label="Recruitment" value={bdm} all="All Recruitment" options={[...new Set(rps.map((r) => r.bdm).filter(Boolean))].sort()} onChange={setBdm} />
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
                  <th scope="col">Recruitment</th>
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
                        {agreementLine(r) && <span className="irow__sub">{agreementLine(r)}</span>}
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
type Ask = { kind: 'reject' | 'suspend' | 'reactivate' | 'trained' | 'unlink' } | null;

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
  // the RP agreement: Finance, RP Ops and Admin all edit it (Jovial, S2C-10), as the matrix's Documents issued to RPs says
  const issueDocs = canEdit(props, OBJ.rpIssued);
  const editTeam = canEdit(props, OBJ.rpTeam);
  const editMp = canEdit(props, OBJ.mps);
  const [tab, setTab] = useState<Tab>(start === 'documents' || start === 'activity' || start === 'commission' ? start : checkDocs && r.docs.some((d) => d.state === 'With BAP') ? 'documents' : 'overview');
  const [doc, setDoc] = useState<{ name: string; file: string } | null>(null);
  const [backDoc, setBackDoc] = useState<RpDoc | null>(null);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState<Ask>(null);
  const [editing, setEditing] = useState(false);
  const [branching, setBranching] = useState(false);
  const [linking, setLinking] = useState(false);
  const toCheck = r.docs.filter((d) => d.state === 'With BAP').length;
  const verified = docsVerified(r);
  const ready = canApprove(r);
  const agr = useAgreementActions({ r, me, role, say });
  const open = openAgreement(r);
  const toReview = open?.status === 'Signed copy uploaded' ? open : null;
  const acts = editProfile ? rpActions(r.status) : [];
  const mp = db.mps.find((m) => m.rps.some((l) => l.rpId === r.id));
  const branches = [...rpBranches(r.name), ...(r.branches ?? [])];
  const team = rpTeam(r.name);
  const banner = checkDocs && (toCheck > 0 || !!toReview || (!r.approved && (verified || !!open)));

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
            {agreementLine(r) && <span className="irhead__k">{agreementLine(r)}</span>}
          </>
        }
      >
        {(acts.length > 0 || (checkDocs && r.status === 'Agreement signed' && !r.trained)) && (
          <div className="istatus">
            <p className="istatus__note">
              {r.status === 'Suspended'
                ? 'Suspended: every user of this RP has lost access and can’t sign in. GSP carries on with its applications in progress; their commission is paid.'
                : r.status === 'Rejected'
                  ? 'Rejected: final. Its users can’t sign in.'
                  : r.status === 'Agreement sent' && commissionHeld(r)
                    ? 'Commission on enrolments is held until the signed agreement is accepted.'
                    : ' '}
            </p>
            <div className="istatus__acts">
              {checkDocs && r.status === 'Agreement signed' && !r.trained && (
                <Button size="sm" variant="secondary" onClick={() => setAsk({ kind: 'trained' })}>
                  Mark training done
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
            {toReview
              ? `${r.contact.name || 'The RP'} uploaded the signed copy of ${toReview.version}. Preview it, then accept it${r.approved ? '' : ' to approve the partner'} or send it back.`
              : toCheck > 0
                ? `${toCheck === 1 ? '1 document' : `${toCheck} documents`} to check. Verify each one, or send it back with a reason.`
                : open
                  ? `${open.version} is with the RP to sign and upload. Approve partner turns on once its signed copy is in.`
                  : 'Every required document is verified. Send the agreement: the RP signs it and uploads the signed copy, and accepting that approves the partner.'}
          </p>
          <div className="irowacts">
            {tab !== 'documents' && (
              <Button variant="secondary" size="sm" onClick={() => setTab('documents')}>
                Documents
              </Button>
            )}
            {toReview && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setDoc({ name: `Signed copy of ${toReview.version}`, file: signedOf(toReview)!.file })}>
                  Preview signed copy
                </Button>
                <Button variant="secondary" size="sm" onClick={() => agr.sendBack(toReview)}>
                  Send back
                </Button>
              </>
            )}
            {readyForAgreement(r) && issueDocs && (
              <Button variant="secondary" size="sm" disabled={!!sendOffWhy(r)} title={sendOffWhy(r) ?? undefined} onClick={agr.upload}>
                Send agreement
              </Button>
            )}
            {toReview && r.approved ? (
              <Button size="sm" onClick={() => agr.accept(toReview)}>
                Accept
              </Button>
            ) : (
              !r.approved && (
                <Button size="sm" disabled={!ready} title={!ready ? 'Approval comes with the signed agreement: this turns on once the RP uploads its signed copy, and accepting it approves the partner.' : undefined} onClick={() => toReview && agr.accept(toReview)}>
                  Approve partner
                </Button>
              )
            )}
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
            { key: 'documents', label: 'Documents', n: r.docs.length + versionsOf(r).length },
            { key: 'activity', label: 'Activity', n: r.activity.length + agreementActivity(r).length },
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
                  ['State or province', r.state || '—'],
                  ['Country', r.country],
                  ['Owner', r.owner ? `${r.owner.name}${r.owner.name !== r.contact.name ? ` · ${r.owner.email}${r.owner.phone ? ` · ${r.owner.phone}` : ''}` : ' (the contact person)'}` : '—'],
                  ['Commission statements', r.commissionEmail || '—'],
                  ['How they found GSP', r.foundUs || '—'],
                  ...(r.referral ? ([['Referred by', r.referral]] as [string, string][]) : []),
                  ['Onboarded on', dateText(r.since)],
                ]}
              />
            </Section>
            <Section title="GSP contacts and mapping" id="irp-gsp">
              <Facts
                items={[
                  [
                    'Recruitment',
                    <span key="b" className="irowacts">
                      {r.bdm || <span className="muted">Not set</span>}
                      {editProfile && <BdmPick r={r} me={me} say={say} />}
                    </span>,
                  ],
                  // W23 (slice 4): the Recruitment contact's first call with a new RP; logging it closes the task
                  [
                    'First call',
                    <span key="fc" className="irowacts">
                      {r.firstCall ? `${fmtDate(r.firstCall.at)} · ${r.firstCall.by}` : <span className="muted">Not logged yet</span>}
                      {editProfile && !r.firstCall && (
                        <button type="button" className="btn btn--link" onClick={() => (editRp(r.id, (x) => ({ ...x, firstCall: { at: Date.now(), by: me } }), 'First call logged', me), say('First call logged.'))}>
                          Log the first call
                        </button>
                      )}
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
                        <th scope="col">Branch recruitment contact</th>
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
          </>
        )}
        {tab === 'commission' && (
          <Section title="Commission" id="irp-commission" note="Terms are set by Finance in Commissions (read only here).">
            {/* Jovial, 1 Nov: read-only terms; RP Ops and Finance can change the bank details */}
            <RpCommission name={r.name} canBank={canEditObject(role, 'RP bank details')} />
            {commissionHeld(r) && <p className="irsec__note">No agreement is active yet: commission on applications enrolled now is held, and paid once the signed agreement is accepted (S2-11).</p>}
            {activeAgreement(r) && openAgreement(r) && <p className="irsec__note">A new agreement is with the RP; {activeAgreement(r)!.version} stays active, so nothing is held.</p>}
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
            <AgreementSection r={r} act={agr} canAct={issueDocs} onPreview={(name, file) => setDoc({ name, file })} />
          </>
        )}
        {tab === 'activity' && (
          <Section title="Activity" id="irp-activity">
            <ol className="ilog">
              {[...r.activity.map((e) => ({ t: e.time ?? atIso(e.at, 0), time: e.time, at: e.at, what: e.what })), ...agreementActivity(r).map((e) => ({ t: e.at, time: e.at, at: '', what: e.what }))]
                .sort((a, b) => b.t - a.t)
                .map((e, i) => (
                  <li key={i} className="ilog__item">
                    <span className="ilog__at num">{e.time ? dateTimeText(e.time) : dateText(e.at)}</span>
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
        open={!!ask}
        title={
          ask?.kind === 'trained'
                ? 'Mark the portal training done?'
                : ask?.kind === 'unlink'
                  ? `Unlink ${r.name} from ${mp?.name}?`
                  : `${ask?.kind === 'reject' ? 'Reject' : ask?.kind === 'suspend' ? 'Suspend' : 'Reactivate'} ${r.name}?`
        }
        confirm={ask?.kind === 'trained' ? 'Mark done' : ask?.kind === 'unlink' ? 'Unlink' : ask?.kind === 'reject' ? 'Reject' : ask?.kind === 'suspend' ? 'Suspend' : 'Reactivate'}
        danger={ask?.kind === 'reject' || ask?.kind === 'suspend' || ask?.kind === 'unlink'}
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          const k = ask?.kind;
          setAsk(null);
          if (k === 'trained') {
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
          {ask?.kind === 'trained'
                ? 'Closes the task "Train the RP on the portal" (T58).'
                : ask?.kind === 'unlink'
                  ? 'Applications created from now on don’t pay the Master Partner. Earlier ones stay as they were.'
                  : ask?.kind === 'reject'
                    ? 'Rejected is final. Its users can’t sign in: “This partner account is closed. Contact your Recruitment contact at GSP.”'
                    : ask?.kind === 'suspend'
                      ? 'Every user of the RP loses platform access and can’t sign in. GSP carries on processing its applications in progress, and their commission is paid.'
                      : 'It goes back to its last status, and every user’s access comes back.'}
        </p>
      </ConfirmDialog>
      <Sheet open={!!doc} onClose={() => setDoc(null)} center className="iform" title={doc?.name ?? ''} sub={doc?.file}>
        {doc && <Paper d={{ name: doc.name, file: doc.file }} />}
      </Sheet>
      {agr.ui}
      <EditRp open={editing} r={r} onCancel={() => setEditing(false)} onSave={(f) => (editRp(r.id, (x) => ({ ...x, ...f }), f.country !== r.country ? `Details changed; country ${r.country} → ${f.country}, sales region re-routed to ${regionOfCountry(f.country)}` : 'Details changed', me), setEditing(false), say(`${f.name} saved.`))} />
      <AddBranch open={branching} r={r} taken={(n) => branches.some((b) => b.name.toLowerCase() === n.trim().toLowerCase())} onCancel={() => setBranching(false)} onSave={(b) => (editRp(r.id, (x) => ({ ...x, branches: [...(x.branches ?? []), b] }), `Branch ${b.name} added`, me), setBranching(false), say(`${b.name} added.`))} />
      <LinkMp open={linking} r={r} mps={db.mps.filter((m) => m.status === 'Active' && (!isIsolated() || byRegion([m], mpRegion).length))} onCancel={() => setLinking(false)} onSave={(mpId) => {
        const m = db.mps.find((x) => x.id === mpId)!;
        props.set((d) => ({ ...d, mps: d.mps.map((x) => (x.id === mpId ? { ...x, rps: [...x.rps, { rpId: r.id, at: Date.now(), by: me }] } : x)), rps: d.rps.map((x) => (x.id === r.id ? { ...x, masterPartner: m.name, activity: [{ at: new Date().toISOString().slice(0, 10), what: `Linked to Master Partner ${m.name} (${me})` }, ...x.activity] } : x)) }));
        audit('Master Partners', `master_partner.rp_linked: ${r.name} linked to ${m.name} (E12; bell to its Recruitment contact and Finance)`, me, role);
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
      <Pick id="irp-bdm-pick" label="Recruitment" value={v} placeholder="Pick a Recruitment user" options={staffIn('Recruitment').map(label)} onChange={setV} />
      <Button size="sm" variant="secondary" onClick={() => setOn(false)}>
        Cancel
      </Button>
      <Button size="sm" disabled={!v || v === r.bdm} onClick={() => (editRp(r.id, (x) => ({ ...x, bdm: v }), `Recruitment ${r.bdm || '—'} → ${v}`, me), setOn(false), say('Recruitment contact saved.'))}>
        Save
      </Button>
    </span>
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
/** Add branch from the RP's record (Recruitment for RPs in its regions, RP Ops, Admin): its BDM comes from Recruitment assignment. */
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
      sub="The branch’s sales region comes from its country; its Recruitment contact from Recruitment assignment."
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
        <Field id="iab-bdm" label="Branch recruitment contact" hint="Set by the system from Recruitment assignment.">
          <TextInput id="iab-bdm" value={bdm ?? '—'} readOnly />
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
