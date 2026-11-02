import { renewalDays } from '../../work/renewal';
import { IpCommission } from '../../components/CommissionSummary';
import { dateError } from '../../components/validate';
import { useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SelectMenu } from '../../components/SelectMenu';
import { Field, TextInput, DateInput } from '../../components/forms';
import { PhoneInput } from '../../components/PhoneInput';
import { CopyButton } from '../students/parts';
import { UniMark } from '../courses/parts';
import { coursesOf, searchable, type UniRec } from '../data/catalogue';
import { CONTACT_FOR, DATED, DOC_TYPES, ENDED, EXECUTED, PICKABLE, agreementOf, dateText, daysTo, endsText, executedByHand, isClosed, splitName, stampBy, todayIso, type Contact, type ContactFor, type DocType, type InstitutionPartner, type PartnerDoc, type PartnerStatus } from '../data/records';
import { SYSTEM, acceptOf, audit, change, checkFile, dateTimeText, withLog, type Change, type LogSpec } from '../data/changelog';
import { patch } from '../data/store';
import { AddButton, ChangeLog, ErrorText, Facts, Pick, RecordHead, RecordTabs, Section, SystemInfo, TabPanel } from './parts';
import { PartnerPill, UniPill, statusGroup } from './pills';
import { PartnerForm } from './InstitutionPartners';
import { OBJ, canEdit, canSee, type PageProps } from '../portal/model';

type Tab = 'overview' | 'universities' | 'documents' | 'commission' | 'contacts' | 'log';
const TABS: Tab[] = ['overview', 'universities', 'documents', 'commission', 'contacts', 'log'];

/** What the partner's Change log writes for each field (S2-14): record · part · field. */
const SPEC: LogSpec<InstitutionPartner> = {
  record: 'Partner',
  fields: { name: 'Overview · Partner name', type: 'Overview · Type', rm: 'Overview · Relationship manager', country: 'Overview · Country', state: 'Overview · State', city: 'Overview · City', status: 'Status', docs: 'Document', contacts: 'Contact' },
};
const UNI_SPEC: LogSpec<UniRec> = { record: 'University', fields: { status: 'Status' } };

/** A placeholder download of a stored file (files are opened through short-lived links in the product). */
export function downloadFile(name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`${name}\n\nPrototype: the stored file opens here, through a short-lived link.`], { type: 'text/plain' }));
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * An institution partner's page (slice 2 PRD): the status with Change, Overview (details, agreement, System
 * information, End partnership), Universities, Documents, Commission (read-only), Contacts and the Change log.
 * Edited by Institution and Admin (matrix: Institution partners); the Documents tab follows IP documents and IP changes.
 */
export function PartnerPage(props: PageProps & { p: InstitutionPartner; tab?: string; backLabel: string; onBack: () => void; appsByUni: Record<string, number> }) {
  const { p, tab: start, backLabel, onBack, db, set, open, say, me, appsByUni } = props;
  const role = props.role ?? 'Institution';
  const edit = canEdit(props, OBJ.ips);
  const seeDocs = canSee(props, OBJ.ipDocs);
  const editDocs = canEdit(props, OBJ.ipDocs);
  const tabs = TABS.filter((t) => t !== 'documents' || seeDocs);
  const [tab, setTab] = useState<Tab>(tabs.includes(start as Tab) ? (start as Tab) : 'overview');
  const [status, setStatus] = useState<PartnerStatus>(p.status);
  const [ending, setEnding] = useState<{ to: PartnerStatus; end: boolean } | null>(null);
  const [changing, setChanging] = useState(false);
  const [editing, setEditing] = useState(false);
  const unis = db.unis.filter((u) => u.ip === p.id);
  const active = unis.filter((u) => u.status !== 'Ended');
  const a = agreementOf(p);
  const live = unis.reduce((n, u) => n + (u.status === 'Live' ? coursesOf(db.courses, u.id).filter(searchable).length : 0), 0);
  const apps = unis.reduce((n, u) => n + (appsByUni[u.id] ?? 0), 0);

  /** Saves the partner, stamps the part, and writes the Change log. */
  const save = (part: string, fn: (x: InstitutionPartner) => InstitutionPartner, extra: Change[] = []) => set((d) => ({ ...d, ips: patch(d.ips, p.id, (x) => withLog(SPEC, x, { ...fn(x), stamps: { ...x.stamps, [part]: stampBy(me) } }, me, role, extra)) }));

  /**
   * A status set by hand: Closed asks first. Closed → not Closed changes none of its universities (S2C-19): the
   * reopen is stamped on the partner (`reopenedAt`), and work rule T70 gives IP Ops a task to activate each one.
   */
  const saveStatus = (s: PartnerStatus) => {
    if (isClosed(s) && !isClosed(p.status) && active.length) return setEnding({ to: s, end: false });
    const reopen = isClosed(p.status) && !isClosed(s);
    set((d) => ({
      ...d,
      ips: patch(d.ips, p.id, (x) => withLog(SPEC, x, { ...x, status: s, ...(reopen ? { reopenedAt: Date.now() } : {}), stamps: { ...x.stamps, status: stampBy(me) } }, me, role)),
    }));
    audit('Institution partners', `ip.status_changed: ${p.name}, ${p.status} → ${s}${reopen ? '; reopened, universities unchanged' : ''}`, me, role);
    setChanging(false);
    say(reopen && unis.some((u) => u.status !== 'Live') ? `Status saved: ${s}. IP Ops gets a task to activate each of its universities.` : `Status saved: ${s}.`);
  };
  /** End partnership (a confirmation, no reason: S2C-8), or a Closed status picked by hand: its universities become Ended and leave course search. */
  const endWith = (s: PartnerStatus) => {
    set((d) => ({
      ...d,
      ips: patch(d.ips, p.id, (x) => withLog(SPEC, x, { ...x, status: s, reopenedAt: undefined, stamps: { ...x.stamps, status: stampBy(me) } }, me, role)),
      unis: d.unis.map((u) => (u.ip === p.id && u.status !== 'Ended' ? withLog(UNI_SPEC, u, { ...u, status: 'Ended', stamps: { ...u.stamps, status: stampBy(me) } }, me, role) : u)),
    }));
    audit('Institution partners', `ip.status_changed: ${p.name}, ${p.status} → ${s}; ${active.length} universities ended`, me, role);
    setStatus(s);
    setEnding(null);
    setChanging(false);
    say(`${p.name}: ${s}. Its universities have ended.`);
  };

  return (
    <div className="ipage irecord">
      <RecordHead
        back={backLabel}
        onBack={onBack}
        title={p.name}
        sub={`${p.type} · ${unis.length === 1 ? '1 university' : `${unis.length} universities`} · relationship manager ${p.rm === me ? `${p.rm} (you)` : p.rm || 'not set'}`}
        updated={p.stamps.status}
        status={
          <div className="ipstatus">
            <span className="ipstatus__k" id="ipst-label">
              Status
            </span>
            {changing ? (
              <>
                <div className="ipstatus__pick">
                  {/* Agreement ended is set only by job J1 (slice 2 PRD) */}
                  <SelectMenu id="ipst" label="Status" value={status} options={[...PICKABLE, ...(p.status === ENDED ? [ENDED] : [])].map((s) => ({ value: s, label: s, group: statusGroup(s as PartnerStatus), note: s === p.status ? 'now' : undefined }))} onChange={(v) => setStatus(v as PartnerStatus)} />
                </div>
                <Button variant="secondary" size="sm" onClick={() => (setStatus(p.status), setChanging(false))}>
                  Cancel
                </Button>
                <Button size="sm" disabled={status === p.status || status === ENDED} onClick={() => saveStatus(status)}>
                  Save
                </Button>
              </>
            ) : (
              <>
                <PartnerPill p={p} />
                {edit && (
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setChanging(true)}>
                    Change<span className="vh"> status</span>
                  </Button>
                )}
              </>
            )}
            {a && p.status === EXECUTED && daysTo(a.end) >= 0 && daysTo(a.end) <= renewalDays() && <span className="ipstatus__end irhead__k is-warn">{endsText(a.end)}</span>}
            {executedByHand(p) && <span className="ipstatus__end irhead__k">Set by hand after its end date: counts as in date (Decision A)</span>}
          </div>
        }
      />

      <RecordTabs
        id="iptab"
        label="Partner"
        tab={tab}
        setTab={setTab}
        tabs={(
          [
            { key: 'overview', label: 'Overview' },
            { key: 'universities', label: 'Universities', n: unis.length },
            { key: 'documents', label: 'Documents', n: p.docs.length },
            { key: 'commission', label: 'Commission' },
            { key: 'contacts', label: 'Contacts', n: p.contacts.length },
            { key: 'log', label: 'Change log', n: p.log.length },
          ] as { key: Tab; label: string; n?: number }[]
        ).filter((t) => tabs.includes(t.key))}
      />

      <TabPanel id="iptab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section
              title="Details"
              id="ip-details"
              updated={p.stamps.details}
              action={
                edit ? (
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditing(true)}>
                    Edit details
                  </Button>
                ) : undefined
              }
            >
              <Facts
                items={[
                  ['Partner name', p.name],
                  ['Type', p.type],
                  ['Relationship manager', p.rm],
                  ['Country', p.country],
                  ...(p.state ? ([['State', p.state]] as [string, string][]) : []),
                  ['City', p.city],
                ]}
              />
            </Section>
            <Section title="Current agreement" id="ip-agreement" note={a ? 'The New agreement or Renewal with the latest end date.' : undefined} action={seeDocs ? <button type="button" className="btn btn--link" onClick={() => setTab('documents')}>Documents</button> : undefined}>
              {a ? (
                <Facts
                  items={[
                    ['Starts', dateText(a.start)],
                    ['Ends', <span key="e">{dateText(a.end)}<span className={`ifacts__sub ${daysTo(a.end) < 0 ? 'is-bad' : ''}`}>{endsText(a.end)}</span></span>],
                  ]}
                />
              ) : (
                <p className="iempty">No agreement yet</p>
              )}
              <div className="inums" role="group" aria-label="With GSP so far">
                {(
                  [
                    ['Universities', unis.length],
                    ['Live courses', live],
                    ['Applications', apps],
                  ] as const
                ).map(([k, n]) => (
                  <p key={k} className="inums__item">
                    <span className="inums__n num">{n.toLocaleString('en-GB')}</span>
                    <span className="inums__k">{k}</span>
                  </p>
                ))}
              </div>
            </Section>
            {edit && !isClosed(p.status) && (
              <div className="iend">
                <p className="iend__t">Ending the partnership sets Terminated by GSP and ends its universities: they leave course search. Applications already made carry on.</p>
                <Button variant="secondary" size="sm" onClick={() => setEnding({ to: 'Terminated by GSP', end: true })}>
                  End partnership
                </Button>
              </div>
            )}
            {p.closedNote && <p className="irsec__note">Reason: {p.closedNote}</p>}
            <SystemInfo created={p.created} log={p.log} />
          </>
        )}

        {tab === 'universities' && (
          <Section title="Universities" id="ip-unis">
            {unis.length ? (
              <div className="stab-wrap">
                <table className="itab">
                  <thead>
                    <tr>
                      <th scope="col">University</th>
                      <th scope="col">Campuses</th>
                      <th scope="col">Courses</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unis.map((u) => {
                      const go = () => open({ section: 'universities', id: u.id, back: { section: 'ips', id: p.id, tab: 'universities', label: p.name } });
                      const cs = coursesOf(db.courses, u.id);
                      return (
                        <tr key={u.id} className="irow" onClick={go}>
                          <td>
                            <span className="irow__lead">
                              <UniMark u={u} />
                              <span>
                                <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), go())}>
                                  {u.name}
                                </button>
                                <span className="irow__sub">{u.country}</span>
                              </span>
                            </span>
                          </td>
                          <td className="num">{u.campuses.length - u.inactive.length}</td>
                          <td>
                            <span className="num">{cs.filter(searchable).length}</span> live · <span className="num">{cs.length}</span> in all
                          </td>
                          <td>
                            <UniPill s={u.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="iempty">No universities yet. Each university picks its partner on its own page.</p>
            )}
          </Section>
        )}

        {tab === 'documents' && seeDocs && <Documents p={p} me={me} role={role} edit={editDocs} save={save} say={say} />}

        {tab === 'commission' && (
          <Section title="Commission" id="ip-commission" note="Set by Finance in Commissions (a later slice). Read only here.">
            <IpCommission unis={unis} />
          </Section>
        )}

        {tab === 'contacts' && <Contacts list={p.contacts} edit={edit} save={(fn) => save('contacts', (x) => ({ ...x, contacts: fn(x.contacts) }))} say={say} id="ip-contacts" note="Who to talk to at the partner. Each university has its own contacts too." />}
        {tab === 'log' && <ChangeLog log={p.log} id="ip-log" />}
      </TabPanel>

      <ConfirmDialog
        open={!!ending}
        title={ending?.end ? `End the partnership with ${p.name}?` : `Set ${p.name} to ${ending?.to}?`}
        confirm={ending?.end ? 'End partnership' : 'Save status'}
        danger
        onConfirm={() => ending && endWith(ending.to)}
        onCancel={() => {
          setEnding(null);
          setStatus(p.status);
        }}
      >
        {ending?.end ? (
          <p>
            Its status becomes Terminated by GSP. Its {active.length} {active.length === 1 ? 'university becomes' : 'universities become'} Ended and leave course search. Applications already made carry on.
          </p>
        ) : (
          <p>
            Its {active.length} {active.length === 1 ? 'university becomes' : 'universities become'} Ended and leave course search.
          </p>
        )}
      </ConfirmDialog>

      <PartnerForm
        open={editing}
        p={p}
        me={me}
        taken={(n) => db.ips.some((x) => x.id !== p.id && x.name.toLowerCase() === n.trim().toLowerCase())}
        onCancel={() => setEditing(false)}
        onSave={(f) => {
          save('details', (x) => ({ ...x, name: f.name, type: f.type, rm: f.rm, country: f.country, state: f.state, city: f.city }));
          setEditing(false);
          say(`${f.name} saved.`);
        }}
      />
    </div>
  );
}

type DocDraft = { type: DocType | ''; file: File | null; start: string; end: string };
/** Documents: PDF, Word (.doc, .docx) or image (JPG, PNG), up to 20 MB (slice 2 PRD). */
const DOC_KINDS = ['pdf', 'word', 'jpg', 'png'] as const;
export const FILE_TYPES = acceptOf([...DOC_KINDS]);

/**
 * The partner's documents (slice 2 PRD): Type (Current on the current agreement), File, Starts, Ends, Uploaded by and
 * on, Download; newest first. Never edited: a correction is a new document. Removing one uploaded by mistake asks
 * first (proposal, S2C-7); the current agreement is worked out again. A New agreement or Renewal whose end date is
 * today or later moves an Agreement ended partner back to Agreement executed (System).
 */
function Documents({ p, me, role, edit, save, say }: { p: InstitutionPartner; me: string; role: string; edit: boolean; save: (part: string, fn: (x: InstitutionPartner) => InstitutionPartner, extra?: Change[]) => void; say: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState<DocDraft>({ type: '', file: null, start: '', end: '' });
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [removing, setRemoving] = useState<PartnerDoc | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const a = agreementOf(p);
  const dated = !!v.type && DATED.includes(v.type as DocType);
  const err = {
    type: !v.type ? 'Pick a type.' : null,
    file: fileErr ?? (!v.file ? 'Choose a file.' : null),
    start: dated ? dateError(v.start, { what: 'start date', required: true }) : null,
    end: dated ? dateError(v.end, { what: 'end date', required: true }) || (v.start && v.end && v.end <= v.start ? 'End date must be after the start date.' : null) : null,
  };
  const show = (k: keyof typeof err) => (tried || (k === 'file' && fileErr) ? err[k] : null);
  const close = () => {
    setAdding(false);
    setTried(false);
    setFileErr(null);
    setV({ type: '', file: null, start: '', end: '' });
  };
  const add = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const type = v.type as DocType;
    const d: PartnerDoc = { id: `doc-${Date.now().toString(36)}`, type, file: v.file!.name, start: dated ? v.start : '', end: dated ? v.end : '', added: todayIso(), by: me, at: Date.now() };
    // a New agreement or Renewal that ends today or later brings an ended partner back (System)
    const back = dated && p.status === ENDED && daysTo(d.end) >= 0 && (!a || d.end >= a.end);
    save('documents', (x) => ({ ...x, docs: [d, ...x.docs], ...(back ? { status: EXECUTED as PartnerStatus } : {}) }), back ? [change(SYSTEM, SYSTEM, 'Partner · Status', ENDED, EXECUTED)] : []);
    if (dated) audit('Institution partners', `ip.agreement_uploaded: ${p.name}, ${type} ${dateText(d.start)} to ${dateText(d.end)}. Bell to Finance; task T39 "Add the commission terms"`, me, role);
    if (back) audit('Institution partners', `ip.status_changed: ${p.name}, Agreement ended → Agreement executed (System, ${type})`, SYSTEM, SYSTEM);
    say(back ? `${type} added. ${p.name} is Agreement executed again; resume its Paused universities on each one.` : dated ? `${type} added. Finance is asked to add the commission terms.` : `${type} added.`);
    close();
  };
  const docs = [...p.docs].sort((x, y) => (y.at ?? 0) - (x.at ?? 0));
  return (
    <Section title="Documents" id="ip-docs" updated={p.stamps.documents} note="Only a New agreement or a Renewal has a start and end date. Documents are never edited: a correction is a new document." action={edit && !adding ? <AddButton onClick={() => setAdding(true)}>Add a document</AddButton> : undefined}>
      {adding && (
        <div className="iaddform">
          <div className="iaddform__grid">
            <Field id="ipd-type" label="Type" required error={show('type')}>
              <Pick id="ipd-type" label="Type" value={v.type} placeholder="Pick a type" invalid={!!show('type')} options={DOC_TYPES} onChange={(t) => setV({ ...v, type: t as DocType, ...(DATED.includes(t as DocType) ? {} : { start: '', end: '' }) })} />
            </Field>
            <Field id="ipd-file" label="File" required error={show('file')} hint="PDF, Word or an image (JPG, PNG), up to 20 MB">
              <button id="ipd-file" type="button" className={`ipick ${show('file') ? 'is-invalid' : ''}`} onClick={() => pick.current?.click()}>
                <Icon name={v.file ? 'file' : 'upload'} size={18} />
                <span className="ipick__t">{v.file?.name || 'Choose a file'}</span>
              </button>
            </Field>
            {dated && (
              <>
                <Field id="ipd-start" label="Start date" required error={show('start')}>
                  <DateInput id="ipd-start" value={v.start} invalid={!!show('start')} onChange={(start) => setV({ ...v, start })} />
                </Field>
                <Field id="ipd-end" label="End date" required error={show('end')}>
                  <DateInput id="ipd-end" value={v.end} invalid={!!show('end')} onChange={(end) => setV({ ...v, end })} />
                </Field>
              </>
            )}
          </div>
          <input
            ref={pick}
            type="file"
            accept={FILE_TYPES}
            className="vh"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="ipd-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const bad = checkFile(f, [...DOC_KINDS], 20);
              setFileErr(bad);
              setV((x) => ({ ...x, file: bad ? null : f }));
            }}
          />
          <div className="iaddform__acts">
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" onClick={add}>
              Add document
            </Button>
          </div>
        </div>
      )}
      {docs.length ? (
        <div className="stab-wrap">
          <table className="itab">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">File</th>
                <th scope="col">Starts</th>
                <th scope="col">Ends</th>
                <th scope="col">Uploaded by and on</th>
                <th scope="col">
                  <span className="vh">Download or remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.type}
                    {a && a.file === d.file && a.end === d.end && <span className="dpill dpill--verified">Current</span>}
                  </td>
                  <td>
                    <span className="ifile">
                      <Icon name="file" size={16} />
                      {d.file}
                    </span>
                  </td>
                  <td className="num">{d.start ? dateText(d.start) : '—'}</td>
                  <td className="num">{d.end ? dateText(d.end) : '—'}</td>
                  <td>
                    {d.by}
                    <span className="irow__sub num">{d.at ? dateTimeText(d.at) : dateText(d.added)}</span>
                  </td>
                  <td>
                    <span className="irowacts">
                      <button type="button" className="btn btn--link" onClick={() => downloadFile(d.file)}>
                        Download<span className="vh"> {d.file}</span>
                      </button>
                      {edit && (
                        <button type="button" className="btn btn--link idanger" onClick={() => setRemoving(d)}>
                          Remove<span className="vh"> {d.file}</span>
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">No documents yet.</p>
      )}
      {a && <p className="irsec__foot">A renewal reminder goes to {p.rm} {renewalDays()} days before the end date (T38, E20).</p>}
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.file}?`}
        confirm="Remove document"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) save('documents', (x) => ({ ...x, docs: x.docs.filter((y) => y.id !== removing.id) }));
          say(`${removing?.file} removed. The current agreement is worked out again.`);
          setRemoving(null);
        }}
      >
        <p>For a document uploaded by mistake. The Change log keeps the removal, and the current agreement is worked out again; if that puts its end date in the past, the daily job acts the next night.</p>
      </ConfirmDialog>
    </Section>
  );
}

type ContactDraft = { first: string; last: string; title: string; for: ContactFor | ''; dial: string; phone: string; email: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits = (s: string) => s.replace(/\D/g, '').length;

/**
 * Contacts (slice 2 PRD), the partner's and each university's: first and last name, title, For (one value, no
 * default), phone with its country code, email. Each is editable and removable; Remove contact asks to confirm.
 */
export function Contacts({ list, edit, save, say, id, note }: { list: Contact[]; edit: boolean; save: (fn: (l: Contact[]) => Contact[]) => void; say: (m: string) => void; id: string; note: string }) {
  const blank: ContactDraft = { first: '', last: '', title: '', for: '', dial: '+61', phone: '', email: '' };
  const [form, setForm] = useState<Contact | 'new' | null>(null);
  const [v, setV] = useState<ContactDraft>(blank);
  const [tried, setTried] = useState(false);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const openForm = (c: Contact | 'new') => {
    setForm(c);
    setTried(false);
    if (c === 'new') setV(blank);
    else {
      const n = splitName(c);
      const [dial, ...rest] = (c.phone ?? '').split(' ');
      setV({ first: n.first, last: n.last, title: c.title, for: c.for, dial: c.phone ? dial : '+61', phone: rest.join(' '), email: c.email });
    }
  };
  const err = {
    first: !v.first.trim() ? 'Enter the first name.' : null,
    last: !v.last.trim() ? 'Enter the last name.' : null,
    for: !v.for ? 'Pick what they’re for.' : null,
    phone: v.phone.trim() && (digits(v.phone) < 7 || digits(v.phone) > 13) ? 'Enter a phone number with its country code.' : null,
    email: !v.email.trim() ? 'Enter the email.' : !EMAIL.test(v.email.trim()) ? 'Enter a valid email, like name@university.edu.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const submit = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const c = { first: v.first.trim(), last: v.last.trim(), name: `${v.first.trim()} ${v.last.trim()}`, title: v.title.trim(), for: v.for as ContactFor, email: v.email.trim(), phone: v.phone.trim() ? `${v.dial} ${v.phone.trim()}` : '' };
    if (form && form !== 'new') save((l) => l.map((y) => (y.id === form.id ? { ...y, ...c } : y)));
    else save((l) => [...l, { id: `ct-${Date.now().toString(36)}`, ...c }]);
    say(form === 'new' ? `${c.name} added.` : `${c.name} saved.`);
    setForm(null);
  };
  return (
    <Section title="Contacts" id={id} note={note} action={edit ? <AddButton onClick={() => openForm('new')}>Add a contact</AddButton> : undefined}>
      {list.length ? (
        <div className="stab-wrap">
          <table className="itab">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">For</th>
                <th scope="col">Phone</th>
                <th scope="col">Email</th>
                {edit && (
                  <th scope="col">
                    <span className="vh">Edit or remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    {c.title && <span className="irow__sub">{c.title}</span>}
                  </td>
                  <td>{c.for}</td>
                  <td className="num">{c.phone || <span className="muted">—</span>}</td>
                  <td>
                    <span className="ifacts__copy">
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                      <CopyButton text={c.email} what="Email" onDone={say} />
                    </span>
                  </td>
                  {edit && (
                    <td>
                      <span className="irowacts">
                        <button type="button" className="btn btn--link" onClick={() => openForm(c)}>
                          Edit<span className="vh"> {c.name}</span>
                        </button>
                        <button type="button" className="btn btn--link idanger" onClick={() => setRemoving(c)}>
                          Remove contact<span className="vh"> {c.name}</span>
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">
          No contacts yet.{' '}
          {edit && (
            <button type="button" className="btn btn--link" onClick={() => openForm('new')}>
              Add a contact
            </button>
          )}
        </p>
      )}
      <Sheet
        open={!!form}
        onClose={() => setForm(null)}
        center
        className="iform"
        title={form === 'new' ? 'Add a contact' : 'Edit contact'}
        footer={
          <div className="asf">
            <div className="asf__acts">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button onClick={submit}>Save</Button>
            </div>
          </div>
        }
      >
        <div className="iform__grid">
          <Field id={`${id}-first`} label="First name" required error={show('first')}>
            <TextInput id={`${id}-first`} maxLength={60} value={v.first} invalid={!!show('first')} onChange={(e) => setV({ ...v, first: e.target.value })} />
          </Field>
          <Field id={`${id}-last`} label="Last name" required error={show('last')}>
            <TextInput id={`${id}-last`} maxLength={60} value={v.last} invalid={!!show('last')} onChange={(e) => setV({ ...v, last: e.target.value })} />
          </Field>
          <Field id={`${id}-title`} label="Title" optional>
            <TextInput id={`${id}-title`} maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Like: Head of International Partnerships" />
          </Field>
          <Field id={`${id}-for`} label="For" required error={show('for')}>
            <Pick id={`${id}-for`} label="For" value={v.for} placeholder="Pick one" invalid={!!show('for')} options={CONTACT_FOR} onChange={(f) => setV({ ...v, for: f as ContactFor })} />
          </Field>
          <Field id={`${id}-phone`} label="Phone" optional error={show('phone')}>
            <PhoneInput id={`${id}-phone`} dial={v.dial} number={v.phone} invalid={!!show('phone')} onDial={(dial) => setV((x) => ({ ...x, dial }))} onNumber={(phone) => setV((x) => ({ ...x, phone }))} />
          </Field>
          <Field id={`${id}-email`} label="Email" required error={show('email')}>
            <TextInput id={`${id}-email`} type="email" value={v.email} invalid={!!show('email')} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </Field>
        </div>
        {tried && Object.values(err).some(Boolean) && <ErrorText>Fix what’s marked, then save.</ErrorText>}
      </Sheet>
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name}?`}
        confirm="Remove contact"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) save((l) => l.filter((y) => y.id !== removing.id));
          say(`${removing?.name} removed.`);
          setRemoving(null);
        }}
      >
        <p>The Change log keeps the removal.</p>
      </ConfirmDialog>
    </Section>
  );
}

