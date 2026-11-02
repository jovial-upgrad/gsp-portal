import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CountryCombobox } from '../../components/CountryCombobox';
import { PhoneInput } from '../../components/PhoneInput';
import { Field, TextInput } from '../../components/forms';
import { RpCommission } from '../../components/CommissionSummary';
import { countryByName, partnerManagerFor } from '../../data/partners';
import { staffIn, label } from '../../data/staff';
import { byRegion, isIsolated } from '../../data/scope';
import { dateText } from '../data/records';
import { acceptOf, audit, change, checkFile, dateTimeText, withLog, type LogSpec } from '../data/changelog';
import { mpRegion, nextMpCode, type MasterPartner, type MpStatus } from '../data/masters';
import { ChangeLog, Empty, Facts, Gone, NoMatch, PageHead, Pick, Pill, RecordHead, RecordTabs, Section, SystemInfo, TabPanel, usePager, useRecord } from './parts';
import { SearchPick } from './SearchPick';
import { RpPill } from './RecruitmentPartners';
import { downloadFile } from './PartnerPage';
import { OBJ, canEdit, type PageProps } from '../portal/model';

const SPEC: LogSpec<MasterPartner> = {
  record: 'Master Partner',
  fields: { name: 'Overview · Name', country: 'Overview · Country', state: 'Overview · State or province', city: 'Overview · City', contact: 'Overview · Contact', commissionsEmail: 'Overview · Commissions email', bdm: 'Overview · Recruitment', status: 'Status', notes: 'Overview · Notes', docs: 'Documents · Document', rps: 'RPs' },
  fmt: { contact: (v) => { const c = v as MasterPartner['contact']; return `${c.name}, ${c.email}, ${c.dial} ${c.phone}`; }, rps: (v) => `${(v as unknown[]).length} RPs` },
};

/**
 * Master Partners (slice 2 PRD, S2-21 to S2-25): GSP · BAP › Master Partners. An aggregator that brings several RPs
 * under it; its own record, created by RP Ops. No Master Partner portal and no users. List: search by name, code or
 * city; filters Status and Country; columns Master Partner (code · city), Country, BDM, RPs, Status. Admin and RP Ops
 * edit; Recruitment views its sales regions only; Institution, IP Ops, Finance and View Only view.
 */
export function MasterPartners(props: PageProps) {
  const { db, set, focus, navKey, open, say, scrollTop, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const edit = canEdit(props, OBJ.mps);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const [adding, setAdding] = useState(false);
  const mps = useMemo(() => byRegion([...db.mps].sort((a, b) => a.name.localeCompare(b.name)), mpRegion), [db.mps]);
  const rows = mps.filter((m) => {
    const t = q.trim().toLowerCase();
    if (t && ![m.name, m.code, m.city].some((x) => x.toLowerCase().includes(t))) return false;
    if (status && m.status !== status) return false;
    if (country && m.country !== country) return false;
    return true;
  });
  const { page, pager } = usePager(rows, [q, status, country]);
  const clear = () => (setQ(''), setStatus(''), setCountry(''));

  if (cur) {
    const m = mps.find((x) => x.id === cur.id);
    if (!m) return <Gone denied={db.mps.some((x) => x.id === cur.id)} back={cur.back?.label ?? 'Master Partners'} onBack={back} />;
    return <MpPage key={m.id} m={m} tab={cur.tab} onBack={back} backLabel={cur.back?.label ?? 'Master Partners'} {...props} />;
  }
  return (
    <div className="ipage">
      <PageHead title="Master Partners" lead={`Aggregators that bring several RPs under them. GSP pays the Master Partner for its RPs’ applications, on its own commission terms${isIsolated() ? '. In your sales regions' : ''}.`}>
        {edit && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding(true)}>
            New Master Partner
          </Button>
        )}
      </PageHead>
      <section className="card stable" aria-labelledby="imp-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search Master Partners</span>
              <input id="imp-q" type="search" placeholder="Name, code or city" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <Pick id="imp-status" label="Status" value={status} all="All statuses" options={['Active', 'Inactive']} onChange={setStatus} />
            <Pick id="imp-country" label="Country" value={country} all="All countries" options={[...new Set(mps.map((m) => m.country))].sort()} onChange={setCountry} />
          </div>
          <p className="stools__count" id="imp-count" role="status">
            <span>
              <span className="num">{rows.length === mps.length ? mps.length : `${rows.length} of ${mps.length}`}</span> Master Partners
            </span>
          </p>
        </div>
        {mps.length === 0 ? (
          <Empty text="No Master Partners yet." action={edit ? 'New Master Partner.' : undefined} onAction={() => setAdding(true)} />
        ) : rows.length === 0 ? (
          <NoMatch onClear={clear} />
        ) : (
          <div className="stab-wrap">
            <table className="itab">
              <thead>
                <tr>
                  <th scope="col">Master Partner</th>
                  <th scope="col">Country</th>
                  <th scope="col">Recruitment</th>
                  <th scope="col">RPs</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {page.map((m) => (
                  <tr key={m.id} className="irow" onClick={() => show(m.id)}>
                    <td>
                      <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(m.id))}>
                        {m.name}
                      </button>
                      <span className="irow__sub">
                        {m.code} · {m.city}
                      </span>
                    </td>
                    <td>{m.country}</td>
                    <td>{m.bdm || <span className="muted">Not set</span>}</td>
                    <td className="num">{m.rps.length}</td>
                    <td>
                      <Pill tone={m.status === 'Active' ? 'ok' : 'grey'}>{m.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pager}
      </section>
      <MpForm
        open={adding}
        taken={(n) => [...db.mps.map((m) => m.name), ...db.rps.map((r) => r.name)].some((x) => x.toLowerCase() === n.trim().toLowerCase())}
        onCancel={() => setAdding(false)}
        onSave={(f) => {
          const role = props.role ?? 'RP Ops';
          const m: MasterPartner = { id: `mp-${Date.now().toString(36)}`, code: nextMpCode(db.mps), ...f, status: 'Active', docs: [], rps: [], log: [change(me, role, 'Master Partner created', '—', f.name)], created: { by: me, at: Date.now() } };
          set((d) => ({ ...d, mps: [m, ...d.mps] }));
          audit('Master Partners', `master_partner.created: ${m.code} ${m.name}`, me, role);
          setAdding(false);
          show(m.id);
          say(`${m.name} created as ${m.code}.`);
        }}
      />
    </div>
  );
}

type Tab = 'overview' | 'rps' | 'documents' | 'commission' | 'log';
type Fields = Pick<MasterPartner, 'name' | 'country' | 'state' | 'city' | 'contact' | 'commissionsEmail' | 'bdm' | 'notes'>;

function MpPage(props: PageProps & { m: MasterPartner; tab?: string; onBack: () => void; backLabel: string }) {
  const { m, tab: start, onBack, backLabel, db, set, say, me, open } = props;
  const role = props.role ?? 'RP Ops';
  const edit = canEdit(props, OBJ.mps);
  const [tab, setTab] = useState<Tab>((['overview', 'rps', 'documents', 'commission', 'log'] as Tab[]).includes(start as Tab) ? (start as Tab) : 'overview');
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const save = (fn: (x: MasterPartner) => MasterPartner) => set((d) => ({ ...d, mps: d.mps.map((x) => (x.id === m.id ? withLog(SPEC, x, fn(x), me, role) : x)) }));
  const rpOf = (id: string) => db.rps.find((r) => r.id === id);
  const link = (rpId: string, on: boolean) => {
    const r = rpOf(rpId);
    const day = new Date().toISOString().slice(0, 10);
    set((d) => ({
      ...d,
      mps: d.mps.map((x) => (x.id === m.id ? withLog(SPEC, x, { ...x, rps: on ? [...x.rps, { rpId, at: Date.now(), by: me }] : x.rps.filter((l) => l.rpId !== rpId) }, me, role, [change(me, role, `RPs · ${r?.name}`, on ? '—' : 'Linked', on ? 'Linked' : '—')]) : x)),
      rps: d.rps.map((x) => (x.id === rpId ? { ...x, masterPartner: on ? m.name : 'None', activity: [{ at: day, what: `${on ? 'Linked to' : 'Unlinked from'} Master Partner ${m.name} (${me})` }, ...x.activity] } : x)),
    }));
    audit('Master Partners', `master_partner.rp_linked: ${r?.name} ${on ? 'linked to' : 'unlinked from'} ${m.name} (E12 to the RP; bell to its Recruitment contact and Finance)`, me, role);
    say(on ? `${r?.name} linked. Its applications created from now pay ${m.name}.` : `${r?.name} unlinked.`);
  };
  return (
    <div className="ipage irecord">
      <RecordHead
        back={backLabel}
        onBack={onBack}
        title={m.name}
        sub={`${m.code} · ${m.city}, ${m.country} · ${mpRegion(m)}`}
        status={
          <span className="irowacts">
            <Pill tone={m.status === 'Active' ? 'ok' : 'grey'}>{m.status}</Pill>
            {edit && (
              <Button size="sm" variant="secondary" onClick={() => setToggling(true)}>
                {m.status === 'Active' ? 'Set inactive' : 'Set active'}
              </Button>
            )}
          </span>
        }
      />
      <RecordTabs
        id="imptab"
        label="Master Partner"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'rps', label: 'RPs', n: m.rps.length },
          { key: 'documents', label: 'Documents', n: m.docs.length },
          { key: 'commission', label: 'Commission' },
          { key: 'log', label: 'Change log', n: m.log.length },
        ]}
      />
      <TabPanel id="imptab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section title="Details" id="imp-details" note="RP Ops onboards a Master Partner in person, outside the portal. There’s no Master Partner portal and no Master Partner users." action={edit ? <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditing(true)}>Edit</Button> : undefined}>
              <Facts
                items={[
                  ['Name', m.name],
                  ['Code', <span key="c" className="num">{m.code}</span>],
                  ['Country', m.country],
                  ['State or province', m.state || '—'],
                  ['City', m.city],
                  ['Contact', m.contact.name],
                  ['Contact email', m.contact.email],
                  ['Contact phone', <span key="p" className="num">{`${m.contact.dial} ${m.contact.phone}`}</span>],
                  ['Commissions email', m.commissionsEmail],
                  ['Recruitment', m.bdm],
                  ['Sales region', mpRegion(m)],
                  ['Notes', m.notes || '—'],
                ]}
              />
            </Section>
            <SystemInfo created={m.created} log={m.log} />
          </>
        )}
        {tab === 'rps' && (
          <Section
            title="RPs"
            id="imp-rps"
            note="An RP links to at most one Master Partner. Applications created after the link pay the Master Partner; earlier ones stay as they were."
            action={edit ? <Button variant="secondary" size="sm" disabled={m.status !== 'Active'} title={m.status !== 'Active' ? 'Only while the Master Partner is Active.' : undefined} iconLeft={<Icon name="plus" size={16} />} onClick={() => setLinking(true)}>Link an RP</Button> : undefined}
          >
            {m.rps.length ? (
              <div className="stab-wrap">
                <table className="itab">
                  <thead>
                    <tr>
                      <th scope="col">RP</th>
                      <th scope="col">Country</th>
                      <th scope="col">Status</th>
                      <th scope="col">Linked on and by</th>
                      {edit && (
                        <th scope="col">
                          <span className="vh">Unlink</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {m.rps.map((l) => {
                      const r = rpOf(l.rpId);
                      if (!r) return null;
                      return (
                        <tr key={l.rpId}>
                          <td>
                            <button type="button" className="btn btn--link" onClick={() => open({ section: 'rps', id: r.id, back: { section: 'mps', id: m.id, tab: 'rps', label: m.name } })}>
                              {r.name}
                            </button>
                            <span className="irow__sub">{r.code}</span>
                          </td>
                          <td>{r.country}</td>
                          <td>
                            <RpPill s={r.status} />
                          </td>
                          <td>
                            {dateText(new Date(l.at).toISOString())}
                            <span className="irow__sub">{l.by}</span>
                          </td>
                          {edit && (
                            <td>
                              <button type="button" className="btn btn--link idanger" onClick={() => setUnlinking(l.rpId)}>
                                Unlink<span className="vh"> {r.name}</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="iempty">No RPs linked yet.</p>
            )}
          </Section>
        )}
        {tab === 'documents' && (
          <Section title="Documents" id="imp-docs" note="Uploaded by RP Ops. No checking, verification or agreement signing (S2-25)." action={edit ? <Button variant="secondary" size="sm" iconLeft={<Icon name="upload" size={16} />} onClick={() => setUploading(true)}>Upload a document</Button> : undefined}>
            {m.docs.length ? (
              <ul className="ilist">
                {m.docs.map((d) => (
                  <li key={d.id} className="ilist__item">
                    <Icon name="file" size={18} />
                    <span className="ilist__t">
                      {d.name}
                      <span className="irow__sub">
                        {d.file} · {d.by}, {dateTimeText(d.at)}
                      </span>
                    </span>
                    <button type="button" className="btn btn--link" onClick={() => downloadFile(d.file)}>
                      Download<span className="vh"> {d.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="iempty">No documents yet.</p>
            )}
          </Section>
        )}
        {tab === 'commission' && (
          <Section title="Commission" id="imp-commission" note="Finance sets the Master Partner’s terms in Commissions (read only here). Commission tiers count all of its RPs together.">
            <RpCommission name={m.name} canBank={false} />
          </Section>
        )}
        {tab === 'log' && <ChangeLog log={m.log} id="imp-log" />}
      </TabPanel>

      <MpForm open={editing} m={m} taken={(n) => [...db.mps.filter((x) => x.id !== m.id).map((x) => x.name), ...db.rps.map((r) => r.name)].some((x) => x.toLowerCase() === n.trim().toLowerCase())} onCancel={() => setEditing(false)} onSave={(f) => (save((x) => ({ ...x, ...f })), setEditing(false), say(`${f.name} saved.`))} />
      <ConfirmDialog
        open={toggling}
        title={m.status === 'Active' ? `Set ${m.name} inactive?` : `Set ${m.name} active?`}
        confirm={m.status === 'Active' ? 'Set inactive' : 'Set active'}
        onCancel={() => setToggling(false)}
        onConfirm={() => {
          const to: MpStatus = m.status === 'Active' ? 'Inactive' : 'Active';
          save((x) => ({ ...x, status: to }));
          audit('Master Partners', `master_partner.status_changed: ${m.name}, ${m.status} → ${to}`, me, role);
          setToggling(false);
          say(`${m.name} is ${to}.`);
        }}
      >
        <p>{m.status === 'Active' ? 'No new RPs can be linked. Linked RPs stay linked until unlinked.' : 'RPs can be linked again.'}</p>
      </ConfirmDialog>
      <ConfirmDialog open={!!unlinking} title={`Unlink ${rpOf(unlinking ?? '')?.name}?`} confirm="Unlink" danger onCancel={() => setUnlinking(null)} onConfirm={() => (unlinking && link(unlinking, false), setUnlinking(null))}>
        <p>Applications created from now on don’t pay {m.name}. Earlier ones stay as they were.</p>
      </ConfirmDialog>
      <LinkRp open={linking} m={m} rps={byRegion(db.rps, (r) => mpRegion(r))} mps={db.mps} onCancel={() => setLinking(false)} onSave={(id) => (link(id, true), setLinking(false))} />
      <UploadDoc open={uploading} onCancel={() => setUploading(false)} onSave={(name, file) => (save((x) => ({ ...x, docs: [{ id: `mpd-${Date.now().toString(36)}`, name, file, by: me, at: Date.now() }, ...x.docs] })), setUploading(false), say(`${name} uploaded.`))} />
    </div>
  );
}

function LinkRp({ open, m, rps, mps, onCancel, onSave }: { open: boolean; m: MasterPartner; rps: PageProps['db']['rps']; mps: MasterPartner[]; onCancel: () => void; onSave: (id: string) => void }) {
  const [v, setV] = useState('');
  useEffect(() => setV(''), [open]);
  const under = (id: string) => mps.find((x) => x.rps.some((l) => l.rpId === id));
  const picked = rps.find((r) => r.id === v);
  const taken = picked ? under(picked.id) : undefined;
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Link an RP"
      sub={`From now, its new applications pay ${m.name}. Earlier ones stay as they were.`}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={!v || !!taken} onClick={() => onSave(v)}>
              Link
            </Button>
          </div>
        </div>
      }
    >
      <Field id="imp-link" label="RP" required hint="Search by RP name or code." error={taken ? `Already under ${taken.name}: unlink it there first.` : null}>
        <SearchPick id="imp-link" label="Recruitment partners" placeholder="RP name or code" value={v} options={rps.map((r) => { const u = under(r.id); return { value: r.id, label: r.name, note: u ? `${r.code} · already under ${u.name}: unlink it there first` : r.code }; })} onChange={setV} />
      </Field>
    </Sheet>
  );
}

function UploadDoc({ open, onCancel, onSave }: { open: boolean; onCancel: () => void; onSave: (name: string, file: string) => void }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => (setName(''), setFile(''), setErr(null), setTried(false)), [open]);
  const e = { name: !name.trim() ? 'Enter the name.' : null, file: err ?? (!file ? 'Choose a file.' : null) };
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Upload a document"
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => (setTried(true), !e.name && !e.file && onSave(name.trim(), file))}>Upload</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="impd-name" label="Name" required error={tried ? e.name : null}>
          <TextInput id="impd-name" value={name} maxLength={120} invalid={tried && !!e.name} onChange={(x) => setName(x.target.value)} />
        </Field>
        <Field id="impd-file" label="File" required error={tried || err ? e.file : null} hint="PDF, JPG or PNG, up to 20 MB.">
          <button id="impd-file" type="button" className="ipick" onClick={() => pick.current?.click()}>
            <Icon name={file ? 'file' : 'upload'} size={18} />
            <span className="ipick__t">{file || 'Choose a file'}</span>
          </button>
          <input ref={pick} type="file" accept={acceptOf(['pdf', 'jpg', 'png'])} className="vh" tabIndex={-1} aria-hidden="true" onChange={(ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (!f) return;
            const bad = checkFile(f, ['pdf', 'jpg', 'png'], 20);
            setErr(bad);
            setFile(bad ? '' : f.name);
          }} />
        </Field>
      </div>
    </Sheet>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** New Master Partner and Edit (slice 2 PRD Fields). The BDM is filled from Recruitment assignment once the location is in. */
function MpForm({ open, m, taken, onCancel, onSave }: { open: boolean; m?: MasterPartner; taken: (n: string) => boolean; onCancel: () => void; onSave: (f: Fields) => void }) {
  const blank: Fields = { name: '', country: '', state: '', city: '', contact: { name: '', email: '', dial: '+91', phone: '' }, commissionsEmail: '', bdm: '', notes: '' };
  const [v, setV] = useState<Fields>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(m ? { name: m.name, country: m.country, state: m.state, city: m.city, contact: m.contact, commissionsEmail: m.commissionsEmail, bdm: m.bdm, notes: m.notes } : blank);
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (f: Partial<Fields>) => setV((x) => ({ ...x, ...f }));
  const states = countryByName(v.country)?.states ?? [];
  const auto = v.country && v.city ? partnerManagerFor(v.country, v.city, '')?.name ?? '' : '';
  useEffect(() => {
    if (auto && !v.bdm) set({ bdm: auto });
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  const digits = v.contact.phone.replace(/\D/g, '').length;
  const e = {
    name: !v.name.trim() ? 'Enter the name.' : taken(v.name) ? 'An RP or Master Partner already has this name.' : null,
    country: !countryByName(v.country) ? 'Pick a country.' : null,
    state: states.length && !v.state ? 'Pick a state or province.' : null,
    city: !v.city.trim() ? 'Enter the city.' : null,
    cname: !v.contact.name.trim() ? 'Enter the contact name.' : null,
    cemail: !EMAIL.test(v.contact.email.trim()) ? 'Enter a valid email, like name@agency.com.' : null,
    cphone: digits < 7 || digits > 13 ? '7 to 13 digits.' : null,
    commissions: !EMAIL.test(v.commissionsEmail.trim()) ? 'Enter a valid email, like accounts@agency.com.' : null,
    bdm: !v.bdm ? 'Pick a Recruitment user.' : null,
  };
  const show = (k: keyof typeof e) => (tried ? e[k] : null);
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title={m ? `Edit ${m.name}` : 'New Master Partner'}
      sub="Its code (MP-…) and sales region are set by the system."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => (setTried(true), !Object.values(e).some(Boolean) && onSave({ ...v, name: v.name.trim(), city: v.city.trim(), commissionsEmail: v.commissionsEmail.trim(), state: states.length ? v.state : '', notes: v.notes.trim() }))}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="impf-name" label="Name" required error={show('name')} className="iform__wide">
          <TextInput id="impf-name" value={v.name} maxLength={160} invalid={!!show('name')} onChange={(x) => set({ name: x.target.value })} />
        </Field>
        <Field id="impf-country" label="Country" required error={show('country')} hint="Decides its sales region, as for an RP.">
          <CountryCombobox id="impf-country" value={v.country} invalid={!!show('country')} onChange={(country) => set({ country, state: '' })} />
        </Field>
        {states.length > 0 && (
          <Field id="impf-state" label="State or province" required error={show('state')}>
            <Pick id="impf-state" label="State or province" value={v.state} placeholder="Pick one" invalid={!!show('state')} options={states} onChange={(state) => set({ state })} />
          </Field>
        )}
        <Field id="impf-city" label="City" required error={show('city')}>
          <TextInput id="impf-city" value={v.city} invalid={!!show('city')} onChange={(x) => set({ city: x.target.value })} />
        </Field>
        <Field id="impf-cname" label="Contact name" required error={show('cname')}>
          <TextInput id="impf-cname" value={v.contact.name} invalid={!!show('cname')} onChange={(x) => set({ contact: { ...v.contact, name: x.target.value } })} />
        </Field>
        <Field id="impf-cemail" label="Contact email" required error={show('cemail')}>
          <TextInput id="impf-cemail" type="email" value={v.contact.email} invalid={!!show('cemail')} onChange={(x) => set({ contact: { ...v.contact, email: x.target.value } })} />
        </Field>
        <Field id="impf-cphone" label="Contact phone" required error={show('cphone')}>
          <PhoneInput id="impf-cphone" dial={v.contact.dial} number={v.contact.phone} invalid={!!show('cphone')} onDial={(dial) => setV((x) => ({ ...x, contact: { ...x.contact, dial } }))} onNumber={(phone) => setV((x) => ({ ...x, contact: { ...x.contact, phone } }))} />
        </Field>
        <Field id="impf-comm" label="Commissions email" required error={show('commissions')} hint="Where Finance’s statements go; can be the contact email.">
          <TextInput id="impf-comm" type="email" value={v.commissionsEmail} invalid={!!show('commissions')} onChange={(x) => set({ commissionsEmail: x.target.value })} />
        </Field>
        <Field id="impf-bdm" label="Recruitment" required error={show('bdm')} hint={auto ? `From Recruitment assignment: ${auto}.` : 'Filled from Recruitment assignment once the location is in.'}>
          <Pick id="impf-bdm" label="Recruitment" value={v.bdm} placeholder="Pick a Recruitment user" invalid={!!show('bdm')} options={staffIn('Recruitment').map(label)} onChange={(bdm) => set({ bdm })} />
        </Field>
        <Field id="impf-notes" label="Notes" optional className="iform__wide">
          <div className="control iform__area">
            <textarea id="impf-notes" className="control__input" rows={3} maxLength={2000} value={v.notes} onChange={(x) => set({ notes: x.target.value })} />
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
