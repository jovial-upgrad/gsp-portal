import { dateError, focusFirstError } from '../../components/validate';
import { useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SelectMenu } from '../../components/SelectMenu';
import { Field, SelectInput, TextInput, DateInput } from '../../components/forms';
import { CopyButton } from '../students/parts';
import { UniMark } from '../courses/parts';
import { DESTINATIONS, type Destination } from '../../data/courses';
import { coursesOf, searchable } from '../data/catalogue';
import { CONTACT_FOR, DATED, DOC_TYPES, EXECUTED, PARTNER_STATUSES, PARTNER_TYPES, TEAM, agreementOf, dateText, daysTo, endsText, inDays, isClosed, stampBy, type ContactFor, type DocType, type InstitutionPartner, type PartnerStatus, type PartnerType } from '../data/records';
import { patch } from '../data/store';
import { AddButton, ErrorText, Facts, RecordHead, RecordTabs, Section, TabPanel } from './parts';
import { PartnerPill, UniPill, statusGroup } from './pills';
import type { PageProps } from '../portal/model';

type Tab = 'overview' | 'universities' | 'documents' | 'commission' | 'contacts';
const TABS: Tab[] = ['overview', 'universities', 'documents', 'commission', 'contacts'];

/**
 * An institution partner's page (29 Oct, 2nd round, after the PM prototype): its status, set by hand at the header's
 * right (4th round); then its details and agreement, its universities (they join from their own page), the documents
 * that carry its dates, the commission Commissions and Finance set up, and who to talk to there.
 */
export function PartnerPage({ p, tab: start, backLabel, onBack, db, set, open, say, me, appsByUni }: PageProps & { p: InstitutionPartner; tab?: string; backLabel: string; onBack: () => void; appsByUni: Record<string, number> }) {
  const [tab, setTab] = useState<Tab>(TABS.includes(start as Tab) ? (start as Tab) : 'overview');
  const [status, setStatus] = useState<PartnerStatus>(p.status);
  const [ending, setEnding] = useState<PartnerStatus | null>(null);
  // the status shows as it is; Change opens its menu (29 Oct, 6th round)
  const [changing, setChanging] = useState(false);
  const [editing, setEditing] = useState(false);
  const unis = db.unis.filter((u) => u.ip === p.id);
  const active = unis.filter((u) => u.status !== 'Ended');
  const a = agreementOf(p);
  const live = unis.reduce((n, u) => n + (u.status === 'Live' ? coursesOf(db.courses, u.id).filter(searchable).length : 0), 0);
  const apps = unis.reduce((n, u) => n + (appsByUni[u.id] ?? 0), 0);
  const upd = (fn: (x: InstitutionPartner) => InstitutionPartner) => set((d) => ({ ...d, ips: patch(d.ips, p.id, fn) }));
  /** Changes a part of the partner and says who did, and when (29 Oct, 7th round). */
  const updPart = (part: string, fn: (x: InstitutionPartner) => InstitutionPartner) => upd((x) => ({ ...fn(x), stamps: { ...x.stamps, [part]: stampBy(me) } }));

  /** A closed status ends the universities under it, after asking. */
  const saveStatus = (s: PartnerStatus) => {
    if (isClosed(s) && active.length && !isClosed(p.status)) {
      setEnding(s);
      return;
    }
    updPart('status', (x) => ({ ...x, status: s }));
    setChanging(false);
    say(`Status saved: ${s}.`);
  };
  const endWith = (s: PartnerStatus) => {
    set((d) => ({
      ...d,
      ips: patch(d.ips, p.id, (x) => ({ ...x, status: s, stamps: { ...x.stamps, status: stampBy(me) } })),
      unis: d.unis.map((u) => (u.ip === p.id && u.status !== 'Ended' ? { ...u, status: 'Ended', stamps: { ...u.stamps, status: stampBy(me) } } : u)),
    }));
    setStatus(s);
    setEnding(null);
    setChanging(false);
    say(`${p.name}: ${s}. Its universities have ended.`);
  };

  return (
    <div className="ipage irecord">
      <RecordHead back={backLabel} onBack={onBack} title={p.name} sub={`${p.type} · ${unis.length === 1 ? '1 university' : `${unis.length} universities`} · relationship manager ${p.rm === me ? `${p.rm} (you)` : p.rm}`} updated={p.stamps.status} status={
          <div className="ipstatus">
            <span className="ipstatus__k" id="ipst-label">
              Status
            </span>
            {changing ? (
              <>
                <div className="ipstatus__pick">
                  <SelectMenu id="ipst" label="Status" value={status} options={PARTNER_STATUSES.map((s) => ({ value: s, label: s, group: statusGroup(s), note: s === p.status ? 'now' : undefined }))} onChange={(v) => setStatus(v as PartnerStatus)} />
                </div>
                <Button variant="secondary" size="sm" onClick={() => (setStatus(p.status), setChanging(false))}>
                  Cancel
                </Button>
                <Button size="sm" disabled={status === p.status} onClick={() => saveStatus(status)}>
                  Save
                </Button>
              </>
            ) : (
              <>
                <PartnerPill p={p} />
                <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setChanging(true)}>
                  Change<span className="vh"> status</span>
                </Button>
              </>
            )}
            {a && p.status === EXECUTED && daysTo(a.end) <= 60 && <span className={`ipstatus__end irhead__k ${daysTo(a.end) < 0 ? 'is-bad' : 'is-warn'}`}>{endsText(a.end)}</span>}
          </div>
        }
      />

      <RecordTabs
        id="iptab"
        label="Partner"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'universities', label: 'Universities', n: unis.length },
          { key: 'documents', label: 'Documents', n: p.docs.length },
          { key: 'commission', label: 'Commission' },
          { key: 'contacts', label: 'Contacts', n: p.contacts.length },
        ]}
      />

      <TabPanel id="iptab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section
              title="Details"
              id="ip-details"
              updated={p.stamps.details}
              action={
                <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditing(true)}>
                  Edit details
                </Button>
              }
            >
              <Facts
                items={[
                  ['Partner name', p.name],
                  ['Type', p.type],
                  ['Relationship manager', p.rm],
                  ['Country', p.country],
                  [
                    'Website',
                    p.website ? (
                      <a href={`https://${p.website}`} target="_blank" rel="noreferrer">
                        {p.website}
                      </a>
                    ) : null,
                  ],
                ]}
              />
            </Section>
            <Section
              title="Agreement"
              id="ip-agreement"
              note={a ? undefined : 'No signed agreement yet. Add it under Documents and its dates show here.'}
              action={
                <button type="button" className="btn btn--link" onClick={() => setTab('documents')}>
                  Documents
                </button>
              }
            >
              {a && (
                <Facts
                  items={[
                    ['Starts', dateText(a.start)],
                    ['Ends', <span key="e">{dateText(a.end)}<span className={`ifacts__sub ${p.status === EXECUTED && endsText(a.end).startsWith('Ended') ? 'is-bad' : ''}`}>{endsText(a.end)}</span></span>],
                    ['Agreement', <span key="f" className="ifile" title={a.file}><Icon name="file" size={16} /><span className="ifile__t">{a.file}</span></span>],
                  ]}
                />
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
            {!isClosed(p.status) && (
              <div className="iend">
                <p className="iend__t">Ending the partnership ends its universities too: they leave Course search. Applications already made carry on.</p>
                <Button variant="secondary" size="sm" onClick={() => setEnding('Terminated by GSP')}>
                  End partnership
                </Button>
              </div>
            )}
            {p.closedNote && <p className="irsec__note">Closed: {p.closedNote}</p>}
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
                          <td className="num">{u.campuses.length}</td>
                          <td>
                            <span className="num">{cs.filter(searchable).length}</span> live
                            <span className="irow__sub">{cs.length} in all</span>
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
              <p className="iempty">No universities yet. On a university’s page, pick {p.name} as its institution partner and it shows here.</p>
            )}
          </Section>
        )}

        {tab === 'documents' && <Documents p={p} me={me} upd={(fn) => updPart('documents', fn)} say={say} />}

        {tab === 'commission' && (
          <Section
            title="Commission"
            id="ip-commission"
            note="Set up from the agreement and applied to every university under this partner. Commissions and Finance set it up, and a second person activates it: the Institution Team can’t change it."
            action={p.commission ? <span className={`dpill ${p.commission.state === 'Active' ? 'dpill--verified' : 'dpill--checking'}`}>{p.commission.state}</span> : undefined}
          >
            {p.commission ? (
              <Facts
                items={[
                  ['Rate', `${p.commission.rate}% of first-year tuition, net of scholarship`],
                  ['Bonus', p.commission.bonus],
                  ['Invoicing', p.commission.invoicing],
                  ['Universities covered', unis.length ? unis.map((u) => u.name).join(', ') : null],
                ]}
              />
            ) : (
              <p className="iempty">No commission yet. Commissions and Finance set it up from the signed agreement.</p>
            )}
          </Section>
        )}

        {tab === 'contacts' && <Contacts p={p} upd={(fn) => updPart('contacts', fn)} say={say} />}
      </TabPanel>

      <ConfirmDialog
        open={!!ending}
        title={`End the partnership with ${p.name}?`}
        confirm="End partnership"
        danger
        onConfirm={() => ending && endWith(ending)}
        onCancel={() => {
          setEnding(null);
          setStatus(p.status);
        }}
      >
        <p>
          Its status becomes <strong>{ending}</strong>, and {active.length === 1 ? 'its university ends' : `its ${active.length} universities end`}: {active.length === 1 ? 'it leaves' : 'they leave'} Course search. Applications already made carry on.
        </p>
      </ConfirmDialog>

      <EditPartner
        p={editing ? p : null}
        taken={(n) => db.ips.some((x) => x.id !== p.id && x.name.toLowerCase() === n.trim().toLowerCase())}
        onCancel={() => setEditing(false)}
        onSave={(f) => {
          updPart('details', (x) => ({ ...x, ...f }));
          setEditing(false);
          say(`${f.name} saved.`);
        }}
      />
    </div>
  );
}

type DocDraft = { type: DocType | ''; file: string; start: string; end: string };
/** A document can be a PDF, a Word file or an image (29 Oct, 4th round). */
export const FILE_TYPES = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.heic,image/*';

/** The partner's documents: each has a type and dates; the dated one that ends last sets the agreement's dates. */
function Documents({ p, me, upd, say }: { p: InstitutionPartner; me: string; upd: (fn: (x: InstitutionPartner) => InstitutionPartner) => void; say: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState<DocDraft>({ type: '', file: '', start: '', end: '' });
  const [tried, setTried] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const a = agreementOf(p);
  const dated = !!v.type && DATED.includes(v.type as DocType);
  const err = {
    type: !v.type ? 'Pick the type.' : null,
    file: !v.file ? 'Choose the file.' : null,
    start: dateError(v.start, { what: 'start date', required: dated }),
    end: dateError(v.end, { what: 'end date', required: dated }) || (v.start && v.end && v.end <= v.start ? 'The end date has to be after the start date.' : null),
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const close = () => {
    setAdding(false);
    setTried(false);
    setV({ type: '', file: '', start: '', end: '' });
  };
  return (
    <Section
      title="Documents"
      id="ip-docs"
      updated={p.stamps.documents}
      note="Every document has a type and its dates. The partner’s dates come from the New agreement or Renewal that ends last. Commissions and Finance read these to set up the commission."
      action={!adding ? <AddButton onClick={() => setAdding(true)}>Add a document</AddButton> : undefined}
    >
      {adding && (
        <div className="iaddform">
          <div className="iaddform__grid">
            <Field id="ipd-type" label="Type" required error={show('type')}>
              <SelectInput id="ipd-type" value={v.type} placeholder="Pick a type" invalid={!!show('type')} onChange={(e) => setV({ ...v, type: e.target.value as DocType })}>
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="ipd-file" label="File" required error={show('file')} hint="PDF, Word or an image">
              <button id="ipd-file" type="button" className={`ipick ${show('file') ? 'is-invalid' : ''}`} onClick={() => pick.current?.click()}>
                <Icon name={v.file ? 'file' : 'upload'} size={18} />
                <span className="ipick__t">{v.file || 'Choose a file'}</span>
              </button>
            </Field>
            <Field id="ipd-start" label="Starts" optional={!dated} required={dated} error={show('start')}>
              <DateInput id="ipd-start" value={v.start} onChange={(start) => setV({ ...v, start })} />
            </Field>
            <Field id="ipd-end" label="Ends" optional={!dated} required={dated} error={show('end')}>
              <DateInput id="ipd-end" value={v.end} onChange={(end) => setV({ ...v, end })} />
            </Field>
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
              if (f) setV((x) => ({ ...x, file: f.name }));
            }}
          />
          <div className="iaddform__acts">
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTried(true);
                if (Object.values(err).some(Boolean)) return focusFirstError();
                const d = { id: `doc-${Date.now().toString(36)}`, type: v.type as DocType, file: v.file, start: v.start, end: v.end, added: inDays(0), by: me };
                upd((x) => ({ ...x, docs: [d, ...x.docs] }));
                say(DATED.includes(d.type) ? `${d.type} added. The agreement’s dates are updated.` : `${d.type} added.`);
                close();
              }}
            >
              Add document
            </Button>
          </div>
        </div>
      )}
      {p.docs.length ? (
        <div className="stab-wrap">
          <table className="itab">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">File</th>
                <th scope="col">Starts</th>
                <th scope="col">Ends</th>
                <th scope="col">Added</th>
                <th scope="col">
                  <span className="vh">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {p.docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.type}
                    {a && a.file === d.file && a.end === d.end && <span className="irow__sub">Sets the partner’s dates</span>}
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
                    <span className="num">{dateText(d.added)}</span>
                    <span className="irow__sub">{d.by}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--link idanger"
                      onClick={() => {
                        upd((x) => ({ ...x, docs: x.docs.filter((y) => y.id !== d.id) }));
                        say(`${d.file} removed.`);
                      }}
                    >
                      Remove<span className="vh"> {d.file}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">No documents yet.</p>
      )}
      {a && <p className="irsec__foot">A renewal reminder goes to {p.rm} 60 days before the end date.</p>}
    </Section>
  );
}

/** Who to talk to at the partner, and about what. Each can be edited (30 Oct), with the same form as adding one. */
function Contacts({ p, upd, say }: { p: InstitutionPartner; upd: (fn: (x: InstitutionPartner) => InstitutionPartner) => void; say: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [v, setV] = useState({ name: '', title: '', for: 'Agreement and renewal' as ContactFor, email: '' });
  const [tried, setTried] = useState(false);
  const err = {
    name: !v.name.trim() ? 'Enter their name.' : null,
    email: !/^\S+@\S+\.\S+$/.test(v.email.trim()) ? 'Enter an email like name@university.edu.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const close = () => {
    setAdding(false);
    setEditing(null);
    setTried(false);
    setV({ name: '', title: '', for: 'Agreement and renewal', email: '' });
  };
  return (
    <Section title="Contacts" id="ip-contacts" updated={p.stamps.contacts} note="Who to talk to at the partner. Admissions contacts for each university are on the university." action={!adding ? <AddButton onClick={() => setAdding(true)}>Add a contact</AddButton> : undefined}>
      {adding && (
        <div className="iaddform">
          <div className="iaddform__grid">
            <Field id="ipc-name" label="Name" required error={show('name')}>
              <TextInput id="ipc-name" value={v.name} invalid={!!show('name')} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </Field>
            <Field id="ipc-title" label="Job title" optional>
              <TextInput id="ipc-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Like: Partnerships manager" />
            </Field>
            <Field id="ipc-for" label="Talk to them about">
              <SelectInput id="ipc-for" value={v.for} onChange={(e) => setV({ ...v, for: e.target.value as ContactFor })}>
                {CONTACT_FOR.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="ipc-email" label="Email" required error={show('email')}>
              <TextInput id="ipc-email" type="email" value={v.email} invalid={!!show('email')} onChange={(e) => setV({ ...v, email: e.target.value })} />
            </Field>
          </div>
          <div className="iaddform__acts">
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTried(true);
                if (Object.values(err).some(Boolean)) return;
                const c = { name: v.name.trim(), title: v.title.trim(), for: v.for, email: v.email.trim() };
                if (editing) upd((x) => ({ ...x, contacts: x.contacts.map((y) => (y.id === editing ? { ...y, ...c } : y)) }));
                else upd((x) => ({ ...x, contacts: [...x.contacts, { id: `ct-${Date.now().toString(36)}`, ...c }] }));
                say(editing ? `${c.name} saved.` : `${c.name} added.`);
                close();
              }}
            >
              {editing ? 'Save contact' : 'Add contact'}
            </Button>
          </div>
        </div>
      )}
      {p.contacts.length ? (
        <ContactTable
          list={p.contacts}
          say={say}
          editing={editing}
          onEdit={(c) => {
            setEditing(c.id);
            setAdding(true);
            setTried(false);
            setV({ name: c.name, title: c.title, for: c.for, email: c.email });
          }}
          onRemove={(id) => upd((x) => ({ ...x, contacts: x.contacts.filter((c) => c.id !== id) }))}
        />
      ) : (
        <p className="iempty">No contacts yet.</p>
      )}
    </Section>
  );
}

/** Contacts as a table, shared with the university's page: each can be edited or removed. */
export function ContactTable({ list, say, onRemove, onEdit, editing }: { list: InstitutionPartner['contacts']; say: (m: string) => void; onRemove: (id: string) => void; onEdit: (c: InstitutionPartner['contacts'][number]) => void; editing?: string | null }) {
  return (
    <div className="stab-wrap">
      <table className="itab">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">About</th>
            <th scope="col">Email</th>
            <th scope="col">
              <span className="vh">Edit or remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id} className={editing === c.id ? 'is-editing' : undefined}>
              <td>
                {c.name}
                {c.title && <span className="irow__sub">{c.title}</span>}
              </td>
              <td>{c.for}</td>
              <td>
                <span className="ifacts__copy">
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                  <CopyButton text={c.email} what="Email" onDone={say} />
                </span>
              </td>
              <td>
                <span className="irowacts">
                  <button type="button" className="btn btn--link" onClick={() => onEdit(c)}>
                    Edit<span className="vh"> {c.name}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--link idanger"
                    onClick={() => {
                      onRemove(c.id);
                      say(`${c.name} removed.`);
                    }}
                  >
                    Remove<span className="vh"> {c.name}</span>
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Edit = { name: string; type: PartnerType; rm: string; country: string; website: string };

function EditPartner({ p, taken, onCancel, onSave }: { p: InstitutionPartner | null; taken: (n: string) => boolean; onCancel: () => void; onSave: (f: Edit) => void }) {
  const [v, setV] = useState<Edit | null>(null);
  const [tried, setTried] = useState(false);
  const [was, setWas] = useState<InstitutionPartner | null>(null);
  if (p && p !== was) {
    setWas(p);
    setV({ name: p.name, type: p.type, rm: p.rm, country: p.country, website: p.website });
    setTried(false);
  }
  if (!p && was) setWas(null);
  const x = v ?? { name: '', type: 'Direct' as PartnerType, rm: '', country: '', website: '' };
  const set = (f: Partial<Edit>) => setV({ ...x, ...f });
  const err = { name: !x.name.trim() ? 'Enter the partner’s name.' : taken(x.name) ? 'That partner is already here.' : null };
  return (
    <Sheet
      open={!!p}
      onClose={onCancel}
      center
      className="iform"
      title="Edit details"
      sub="Its agreement’s dates come from its documents, and its commission from Commissions and Finance."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!err.name) onSave({ ...x, name: x.name.trim(), website: x.website.trim().replace(/^https?:\/\//, '') });
              }}
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="ipe-name" label="Partner name" required error={tried ? err.name : null}>
          <TextInput id="ipe-name" value={x.name} invalid={tried && !!err.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="ipe-type" label="Type">
          <SelectInput id="ipe-type" value={x.type} onChange={(e) => set({ type: e.target.value as PartnerType })}>
            {PARTNER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ipe-rm" label="Relationship manager">
          <SelectInput id="ipe-rm" value={x.rm} onChange={(e) => set({ rm: e.target.value })}>
            {TEAM.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ipe-country" label="Country">
          <SelectInput id="ipe-country" value={x.country} onChange={(e) => set({ country: e.target.value as Destination })}>
            {DESTINATIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ipe-web" label="Website" optional>
          <TextInput id="ipe-web" value={x.website} onChange={(e) => set({ website: e.target.value })} />
        </Field>
      </div>
      {tried && err.name && <ErrorText>{err.name}</ErrorText>}
    </Sheet>
  );
}
