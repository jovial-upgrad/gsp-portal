import { useRef, useState } from 'react';
import { EditOnly, useHides } from '../../proto/viewOnly';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SelectMenu } from '../../components/SelectMenu';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { UniMark } from '../courses/parts';
import { DESTINATIONS, type Destination } from '../../data/courses';
import { coursesOf, searchable } from '../data/catalogue';
import { DATED, DOC_TYPES, EXECUTED, PARTNER_STATUSES, PARTNER_TYPES, TEAM, agreementOf, dateText, daysTo, endsText, inDays, isClosed, lastStamp, stampBy, type DocType, type InstitutionPartner, type PartnerStatus, type PartnerType } from '../data/records';
import { patch } from '../data/store';
import { AddButton, ErrorText, Facts, Pager, RecordHead, RecordTabs, Section, SystemInfo, TabPanel, useAsk, usePaged } from './parts';
import { useContacts } from './Contacts';
import { PartnerPill, UniPill, statusGroup } from './pills';
import type { PageProps } from '../portal/model';

type Tab = 'overview' | 'universities' | 'documents' | 'commission' | 'contacts';
const TABS: Tab[] = ['overview', 'universities', 'documents', 'commission', 'contacts'];

/**
 * An institution partner's page (29 Oct, 2nd round, after the PM prototype): its status, set by hand at the header's
 * right (4th round); then its details and agreement, its universities (they join from their own page), the documents
 * that carry its dates, the commission Commissions and Finance set up, and who to talk to there. 3 Nov: Overview opens
 * on its universities, live courses and applications as three cards, and ends with System information; no End
 * partnership button there (a closed status still ends its universities, after asking). 4 Nov: a document can be
 * edited; removing a document or a contact asks first; no lines under the sections' titles.
 */
export function PartnerPage({ p, tab: start, backLabel, onBack, db, set, open, say, me, appsByUni }: PageProps & { p: InstitutionPartner; tab?: string; backLabel: string; onBack: () => void; appsByUni: Record<string, number> }) {
  const [tab, setTab] = useState<Tab>(TABS.includes(start as Tab) ? (start as Tab) : 'overview');
  // GSP · Global Ops (6 Nov): no Commission
  const noCommission = useHides('ip.commission');
  const [status, setStatus] = useState<PartnerStatus>(p.status);
  const [ending, setEnding] = useState<PartnerStatus | null>(null);
  // the status shows as it is; Change opens its menu (29 Oct, 6th round)
  const [changing, setChanging] = useState(false);
  const [editing, setEditing] = useState(false);
  const unis = db.unis.filter((u) => u.ip === p.id);
  const unisPg = usePaged(unis);
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
                <EditOnly>
                  <Button size="sm" disabled={status === p.status} onClick={() => saveStatus(status)}>
                    Save
                  </Button>
                </EditOnly>
              </>
            ) : (
              <>
                <PartnerPill p={p} />
                <EditOnly>
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setChanging(true)}>
                    Change<span className="vh"> status</span>
                  </Button>
                </EditOnly>
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
          ...(noCommission ? [] : [{ key: 'commission' as Tab, label: 'Commission' }]),
          { key: 'contacts', label: 'Contacts', n: p.contacts.length },
        ]}
      />

      <TabPanel id="iptab" tab={tab}>
        {tab === 'overview' && (
          <>
            <div className="istats" role="group" aria-label="With GSP so far">
              {(
                [
                  ['Universities', unis.length],
                  ['Live courses', live],
                  ['Applications', apps],
                ] as const
              ).map(([k, n]) => (
                <p key={k} className="card istat">
                  <span className="istat__n num">{n.toLocaleString('en-GB')}</span>
                  <span className="istat__k">{k}</span>
                </p>
              ))}
            </div>
            <Section
              title="Details"
              id="ip-details"
              updated={p.stamps.details}
              action={
                <EditOnly>
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditing(true)}>
                    Edit details
                  </Button>
                </EditOnly>
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
              action={
                <button type="button" className="btn btn--link" onClick={() => setTab('documents')}>
                  Documents
                </button>
              }
            >
              {!a && <p className="iempty">No signed agreement yet.</p>}
              {a && (
                <Facts
                  items={[
                    ['Starts', dateText(a.start)],
                    ['Ends', <span key="e">{dateText(a.end)}<span className={`ifacts__sub ${p.status === EXECUTED && endsText(a.end).startsWith('Ended') ? 'is-bad' : ''}`}>{endsText(a.end)}</span></span>],
                    ['Agreement', <span key="f" className="ifile" title={a.file}><Icon name="file" size={16} /><span className="ifile__t">{a.file}</span></span>],
                  ]}
                />
              )}
            </Section>
            {p.closedNote && <p className="irsec__note">Closed: {p.closedNote}</p>}
            <SystemInfo id="ip-system" created={p.created} last={lastStamp(p.stamps, p.created)} />
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
                    {unisPg.rows.map((u) => {
                      const go =() => open({ section: 'universities', id: u.id, back: { section: 'ips', id: p.id, tab: 'universities', label: p.name } });
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
                                <span className="irow__sub">
                                  {u.country}
                                  {u.state && ` · ${u.state}`}
                                </span>
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
            <Pager pg={unisPg} what="universities" />
          </Section>
        )}

        {tab === 'documents' && <Documents p={p} me={me} upd={(fn) => updPart('documents', fn)} say={say} />}

        {tab === 'commission' && !noCommission && (
          <Section
            title="Commission"
            id="ip-commission"
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

/**
 * The partner's documents: each has a type and dates; the dated one that ends last sets the agreement's dates. 4 Nov:
 * each can be edited (its type, file and dates) in the same form as adding one, and removing one asks first.
 */
function Documents({ p, me, upd, say }: { p: InstitutionPartner; me: string; upd: (fn: (x: InstitutionPartner) => InstitutionPartner) => void; say: (m: string) => void }) {
  // the form: adding a document, or editing one (by its id)
  const [form, setForm] = useState<'new' | string | null>(null);
  const [v, setV] = useState<DocDraft>({ type: '', file: '', start: '', end: '' });
  const [tried, setTried] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const { ask, dialog } = useAsk();
  const a = agreementOf(p);
  const pg = usePaged(p.docs);
  const editing = form && form !== 'new' ? p.docs.find((d) => d.id === form) : undefined;
  const dated = !!v.type && DATED.includes(v.type as DocType);
  const err = {
    type: !v.type ? 'Pick the type.' : null,
    file: !v.file ? 'Choose the file.' : null,
    start: dated && !v.start ? 'Enter when it starts.' : null,
    end: dated && !v.end ? 'Enter when it ends.' : v.start && v.end && v.end <= v.start ? 'It has to end after it starts.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const close = () => {
    setForm(null);
    setTried(false);
    setV({ type: '', file: '', start: '', end: '' });
  };
  const edit = (d: InstitutionPartner['docs'][number]) => {
    setForm(d.id);
    setTried(false);
    setV({ type: d.type, file: d.file, start: d.start, end: d.end });
  };
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const f = { type: v.type as DocType, file: v.file, start: v.start, end: v.end };
    if (editing) {
      upd((x) => ({ ...x, docs: x.docs.map((y) => (y.id === editing.id ? { ...y, ...f } : y)) }));
      say(DATED.includes(f.type) || DATED.includes(editing.type) ? `${f.type} saved. The agreement’s dates are updated.` : `${f.type} saved.`);
    } else {
      const d = { id: `doc-${Date.now().toString(36)}`, ...f, added: inDays(0), by: me };
      upd((x) => ({ ...x, docs: [d, ...x.docs] }));
      say(DATED.includes(d.type) ? `${d.type} added. The agreement’s dates are updated.` : `${d.type} added.`);
    }
    close();
  };
  return (
    <Section title="Documents" id="ip-docs" updated={p.stamps.documents} action={!form ? <AddButton onClick={() => (close(), setForm('new'))}>Add a document</AddButton> : undefined}>
      {form && (
        <div className="iaddform" role="group" aria-label={editing ? `Edit ${editing.file}` : 'Add a document'}>
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
              <TextInput id="ipd-start" type="date" value={v.start} invalid={!!show('start')} onChange={(e) => setV({ ...v, start: e.target.value })} />
            </Field>
            <Field id="ipd-end" label="Ends" optional={!dated} required={dated} error={show('end')}>
              <TextInput id="ipd-end" type="date" value={v.end} invalid={!!show('end')} onChange={(e) => setV({ ...v, end: e.target.value })} />
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
            <Button size="sm" onClick={save}>
              {editing ? 'Save' : 'Add document'}
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
                  <span className="vh">Edit or remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((d) => (
                <tr key={d.id} className={editing?.id === d.id ? 'is-editing' : ''}>
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
                    <span className="irowacts">
                      <EditOnly>
                        <button type="button" className="btn btn--link" onClick={() => edit(d)}>
                          Edit<span className="vh"> {d.file}</span>
                        </button>
                      </EditOnly>
                      <EditOnly>
                        <button
                          type="button"
                          className="btn btn--link idanger"
                          onClick={() =>
                            ask(
                              `Remove ${d.file}?`,
                              'Remove',
                              <p>{a && a.file === d.file && a.end === d.end ? 'It sets the partner’s dates now. Once it’s gone, they come from the New agreement or Renewal that ends last.' : `It leaves ${p.name}’s documents.`}</p>,
                              () => {
                                if (form === d.id) close();
                                upd((x) => ({ ...x, docs: x.docs.filter((y) => y.id !== d.id) }));
                                say(`${d.file} removed.`);
                              },
                            )
                          }
                        >
                          Remove<span className="vh"> {d.file}</span>
                        </button>
                      </EditOnly>
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
      <Pager pg={pg} what="documents" />
      {a && <p className="irsec__foot">A renewal reminder goes to {p.rm} 60 days before the end date.</p>}
      {dialog}
    </Section>
  );
}

/** Who to talk to at the partner, and about what. 3 Nov: added and edited in a pop-up, the same one as a university's. */
function Contacts({ p, upd, say }: { p: InstitutionPartner; upd: (fn: (x: InstitutionPartner) => InstitutionPartner) => void; say: (m: string) => void }) {
  const c = useContacts(p.contacts, (fn) => upd((x) => ({ ...x, contacts: fn(x.contacts) })), say);
  return (
    <Section title="Contacts" id="ip-contacts" updated={p.stamps.contacts} action={<AddButton onClick={c.add}>Add a contact</AddButton>}>
      {p.contacts.length ? c.table : <p className="iempty">No contacts yet.</p>}
      {c.form(p.country)}
    </Section>
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
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <EditOnly>
              <Button
                onClick={() => {
                  setTried(true);
                  if (!err.name) onSave({ ...x, name: x.name.trim(), website: x.website.trim().replace(/^https?:\/\//, '') });
                }}
              >
                Save
              </Button>
            </EditOnly>
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
