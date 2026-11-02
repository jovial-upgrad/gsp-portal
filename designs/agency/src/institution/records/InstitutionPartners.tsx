import { renewalDays } from '../../work/renewal';
import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, TextInput } from '../../components/forms';
import { CountryCombobox } from '../../components/CountryCombobox';
import { countryByName } from '../../data/partners';
import { staffIn, label } from '../../data/staff';
import { PARTNER_TYPES, PICKABLE, TEAM, agreementOf, dateText, endsText, inDays, stagesOf, statusNow, type InstitutionPartner, type PartnerStatus, type PartnerType, type Stage } from '../data/records';
import { audit, change } from '../data/changelog';
import { Empty, Gone, NoMatch, PageHead, Pick, Tiles, usePager, useRecord, type Tone } from './parts';
import { PartnerPill, statusGroup } from './pills';
import { PartnerPage } from './PartnerPage';
import { OBJ, canEdit, type PageProps } from '../portal/model';

const TILES: { key: Stage; label: string; sub: string; tone: Tone }[] = [
  { key: 'executed', label: 'Agreement executed', sub: 'Its universities can go live', tone: 'ok' },
  { key: 'before', label: 'Before agreement', sub: 'Prospect to Agreement received', tone: 'gsp' },
  { key: 'ending', label: `Ending in ${renewalDays()} days`, sub: 'Renewal reminder sent', tone: 'you' },
  { key: 'ended', label: 'Agreement ended', sub: 'Set by the daily job', tone: 'bad' },
  { key: 'closed', label: 'Closed', sub: 'Didn’t go ahead, ended or merged', tone: 'grey' },
];

/**
 * Institution partners (slice 2 PRD): who GSP has an agreement with, or is working towards one. Tiles filter the list
 * (again clears); search by partner, university or contact name or email; filters Type, Status and Relationship
 * manager; sorted by partner name, 25 a page. Add a partner shows only to Institution and Admin (matrix row
 * Institution partners); everyone else with View reads.
 */
export function InstitutionPartners(props: PageProps & { appsByUni: Record<string, number> }) {
  const { db, set, focus, navKey, open, say, scrollTop, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const edit = canEdit(props, OBJ.ips);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [rm, setRm] = useState('');
  const [stage, setStage] = useState<Stage | ''>('');
  const [adding, setAdding] = useState(false);

  const ips = [...db.ips].sort((a, b) => a.name.localeCompare(b.name));
  const unisOf = (p: InstitutionPartner) => db.unis.filter((u) => u.ip === p.id);
  const rows = ips.filter((p) => {
    const t = q.trim().toLowerCase();
    if (t && ![p.name, ...p.contacts.flatMap((c) => [c.name, c.email]), ...unisOf(p).map((u) => u.name)].some((x) => x.toLowerCase().includes(t))) return false;
    if (type && p.type !== type) return false;
    if (status && statusNow(p) !== status) return false;
    if (rm && p.rm !== rm) return false;
    if (stage && !stagesOf(p).includes(stage)) return false;
    return true;
  });
  const { page, pager } = usePager(rows, [q, type, status, rm, stage]);
  const clear = () => {
    setQ('');
    setType('');
    setStatus('');
    setRm('');
    setStage('');
  };

  if (cur) {
    const shown = db.ips.find((p) => p.id === cur.id);
    if (!shown) return <Gone back={cur.back?.label ?? 'Institution partners'} onBack={back} />;
    return <PartnerPage key={shown.id} p={shown} tab={cur.tab} backLabel={cur.back?.label ?? 'Institution partners'} onBack={back} {...props} />;
  }

  return (
    <div className="ipage">
      <PageHead title="Institution partners" lead="Who GSP has an agreement with, or is working towards one. Each partner has one or more universities.">
        {edit && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding(true)}>
            Add a partner
          </Button>
        )}
      </PageHead>

      <Tiles label="Where each partner is" value={stage} onPick={setStage} items={TILES.map((t) => ({ ...t, n: ips.filter((p) => stagesOf(p).includes(t.key)).length }))} />

      <section className="card stable" aria-labelledby="iip-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search institution partners</span>
              <input id="iip-q" type="search" placeholder="Partner, university, contact or email" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <Pick id="iip-type" label="Type" value={type} all="All types" options={PARTNER_TYPES} onChange={setType} />
            <Pick id="iip-status" label="Status" value={status} all="All statuses" options={[...PICKABLE, 'Agreement ended'].map((s) => ({ value: s, label: s, group: statusGroup(s as PartnerStatus) }))} onChange={setStatus} />
            <Pick id="iip-rm" label="Relationship manager" value={rm} all="All managers" options={TEAM.map((k) => ({ value: k, label: k === me ? `${k} (you)` : k }))} onChange={setRm} />
          </div>
          <p className="stools__count" id="iip-count" role="status">
            <span>
              <span className="num">{rows.length === ips.length ? ips.length : `${rows.length} of ${ips.length}`}</span> {ips.length === 1 ? 'partner' : 'partners'}
            </span>
          </p>
        </div>
        {ips.length === 0 ? (
          <Empty text="No institution partners yet." action={edit ? 'Add a partner.' : undefined} onAction={() => setAdding(true)} />
        ) : rows.length === 0 ? (
          <NoMatch onClear={clear} />
        ) : (
          <div className="stab-wrap">
            <table className="itab itab--ip">
              <thead>
                <tr>
                  <th scope="col">Partner</th>
                  <th scope="col">Type</th>
                  <th scope="col">Universities</th>
                  <th scope="col">Relationship manager</th>
                  <th scope="col">Agreement ends</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {page.map((p) => {
                  const us = unisOf(p);
                  const a = agreementOf(p);
                  const st = stagesOf(p);
                  return (
                    <tr key={p.id} className="irow" onClick={() => show(p.id)}>
                      <td>
                        <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(p.id))}>
                          {p.name}
                        </button>
                        <span className="irow__sub">{[p.country, p.city].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td>{p.type}</td>
                      <td className="num">{us.length}</td>
                      <td>{p.rm === me ? `${p.rm} (you)` : p.rm || <span className="muted">Not set</span>}</td>
                      <td>
                        {a ? (
                          <>
                            <span className="num">{dateText(a.end)}</span>
                            {(st.includes('ending') || st.includes('ended')) && <span className={`irow__sub ${st.includes('ended') ? 'is-bad' : 'is-warn'}`}>{endsText(a.end)}</span>}
                          </>
                        ) : (
                          <span className="muted">No agreement yet</span>
                        )}
                      </td>
                      <td>
                        <PartnerPill p={p} />
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

      <PartnerForm
        open={adding}
        me={me}
        taken={(n) => db.ips.some((p) => p.name.toLowerCase() === n.trim().toLowerCase())}
        onCancel={() => setAdding(false)}
        onSave={(f) => {
          const role = props.role ?? 'Institution';
          const p: InstitutionPartner = { id: `ip-${Date.now().toString(36)}`, ...f, docs: [], commission: null, contacts: [], added: inDays(0), stamps: {}, log: [change(me, role, 'Partner created', '—', f.name)], created: { by: me, at: Date.now() } };
          set((d) => ({ ...d, ips: [p, ...d.ips] }));
          audit('Institution partners', `ip.status_changed: ${p.name} created as ${p.status}`, me, role);
          setAdding(false);
          clear();
          show(p.id);
          say(`${p.name} added.`);
        }}
      />
    </div>
  );
}

export type PartnerFields = { name: string; type: PartnerType; status: PartnerStatus; rm: string; country: string; state: string; city: string };
type Draft = { name: string; type: string; status: string; rm: string; country: string; state: string; city: string };

/** Institution people who aren't deactivated: the relationship managers (slice 2 PRD). */
const MANAGERS = () => staffIn('Institution').map(label);

/**
 * Add a partner and Edit details (slice 2 PRD Fields): partner name (2 to 120, unique ignoring case), type, status
 * (on Add only; any status except Agreement ended), relationship manager (the person adding it when they have the
 * Institution role, else empty), country (every country), state (where the country has states) and city.
 */
export function PartnerForm({ open, me, taken, onCancel, onSave, p }: { open: boolean; me: string; taken: (n: string) => boolean; onCancel: () => void; onSave: (f: PartnerFields) => void; p?: InstitutionPartner }) {
  const blank: Draft = { name: '', type: '', status: '', rm: MANAGERS().includes(me) ? me : '', country: '', state: '', city: '' };
  const first = (): Draft => (p ? { name: p.name, type: p.type, status: p.status, rm: p.rm, country: p.country, state: p.state, city: p.city } : blank);
  const [v, setV] = useState<Draft>(first);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(first());
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (x: Partial<Draft>) => setV((y) => ({ ...y, ...x }));
  const states = countryByName(v.country)?.states ?? [];
  const n = v.name.trim();
  const err = {
    name: !n ? 'Enter the partner name.' : n.length < 2 ? 'Use 2 to 120 characters.' : taken(n) ? 'Another institution partner has this name.' : null,
    type: !v.type ? 'Pick a type.' : null,
    status: p ? null : !v.status ? 'Pick a status.' : v.status === 'Agreement ended' ? 'Any status except Agreement ended.' : null,
    rm: !v.rm ? 'Pick a relationship manager.' : null,
    country: !countryByName(v.country) ? 'Pick a country.' : null,
    state: states.length && !v.state ? 'Pick a state.' : null,
    city: !v.city.trim() ? 'Enter the city.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const changed = JSON.stringify(v) !== JSON.stringify(first());
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return (document.querySelector('.iform [aria-invalid="true"]') as HTMLElement | null)?.focus();
    onSave({ name: n, type: v.type as PartnerType, status: (p?.status ?? v.status) as PartnerStatus, rm: v.rm, country: v.country, state: states.length ? v.state : '', city: v.city.trim() });
  };
  const managers = MANAGERS();
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title={p ? 'Edit details' : 'Add an institution partner'}
      sub={p ? 'Its agreement dates come from its documents.' : 'Its agreement, documents and contacts are added on its page.'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!!p && !changed}>
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="ip-name" label="Partner name" required error={show('name')} className="iform__wide">
          <TextInput id="ip-name" value={v.name} maxLength={120} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} placeholder="Like: Southbridge Pathways" />
        </Field>
        <Field id="ip-type" label="Type" required error={show('type')}>
          <Pick id="ip-type" label="Type" value={v.type} placeholder="Pick a type" invalid={!!show('type')} options={PARTNER_TYPES} onChange={(type) => set({ type })} />
        </Field>
        {!p && (
          <Field id="ip-status" label="Status" required error={show('status')} hint="Any status except Agreement ended.">
            <Pick id="ip-status" label="Status" value={v.status} placeholder="Pick a status" invalid={!!show('status')} options={PICKABLE.map((x) => ({ value: x, label: x, group: statusGroup(x) }))} onChange={(status) => set({ status })} />
          </Field>
        )}
        <Field id="ip-rm" label="Relationship manager" required error={show('rm')} hint="Gets the renewal reminder.">
          <Pick id="ip-rm" label="Relationship manager" value={v.rm} placeholder="Pick a manager" invalid={!!show('rm')} options={[...new Set([...managers, ...(p?.rm ? [p.rm] : [])])].map((k) => ({ value: k, label: k === me ? `${k} (you)` : k }))} onChange={(rm) => set({ rm })} />
        </Field>
        <Field id="ip-country" label="Country" required error={show('country')}>
          <CountryCombobox id="ip-country" value={v.country} invalid={!!show('country')} onChange={(country) => set({ country, state: country === v.country ? v.state : '' })} />
        </Field>
        {states.length > 0 && (
          <Field id="ip-state" label="State" required error={show('state')}>
            <Pick id="ip-state" label="State" value={v.state} placeholder="Pick a state" invalid={!!show('state')} options={states} onChange={(state) => set({ state })} />
          </Field>
        )}
        <Field id="ip-city" label="City" required error={show('city')}>
          <TextInput id="ip-city" value={v.city} maxLength={80} invalid={!!show('city')} onChange={(e) => set({ city: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  );
}
