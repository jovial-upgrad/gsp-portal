import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { DESTINATIONS, FLAG, type Destination } from '../../data/courses';
import { PARTNER_STATUSES, PARTNER_TYPES, TEAM, agreementOf, dateText, endsText, inDays, stagesOf, statusNow, type InstitutionPartner, type PartnerStatus, type PartnerType, type Stage } from '../data/records';
import { NoMatch, PageHead, Tiles, useRecord, type Tone } from './parts';
import { PartnerPill, statusGroup } from './pills';
import { PartnerPage } from './PartnerPage';
import type { PageProps } from '../portal/model';

const TILES: { key: Stage; label: string; sub: string; tone: Tone }[] = [
  { key: 'executed', label: 'Agreement executed', sub: 'Its universities can go live', tone: 'ok' },
  { key: 'before', label: 'Before agreement', sub: 'Prospect to agreement received', tone: 'gsp' },
  { key: 'ending', label: 'Ending in 60 days', sub: 'Renewal reminder sent', tone: 'you' },
  { key: 'ended', label: 'Agreement ended', sub: 'End date passed, not renewed', tone: 'bad' },
  { key: 'closed', label: 'Closed', sub: 'Didn’t go ahead, ended or merged', tone: 'grey' },
];

/**
 * Institution partners (29 Oct; 2nd round from the PM prototype's IP team): who GSP has an agreement with, or is
 * working towards one. Each is Direct or Third-party (29 Oct, 4th round: no Aggregator), has a relationship manager in
 * the team, and a status the team sets by hand. Universities join a partner from their own page, any number of them,
 * and each goes live on its own.
 */
export function InstitutionPartners(props: PageProps & { appsByUni: Record<string, number> }) {
  const { db, set, focus, navKey, open, say, scrollTop, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [rm, setRm] = useState('');
  const [stage, setStage] = useState<Stage | ''>('');
  const [adding, setAdding] = useState(false);

  const ips = db.ips;
  const uniName = (id: string) => db.unis.find((u) => u.id === id)?.name ?? '';
  const unisOf = (p: InstitutionPartner) => db.unis.filter((u) => u.ip === p.id);
  const rows = ips.filter((p) => {
    const t = q.trim().toLowerCase();
    if (t && ![p.name, ...p.contacts.map((c) => c.name), ...unisOf(p).map((u) => u.name)].some((x) => x.toLowerCase().includes(t))) return false;
    if (type && p.type !== type) return false;
    if (status && statusNow(p) !== status) return false;
    if (rm && p.rm !== rm) return false;
    if (stage && !stagesOf(p).includes(stage)) return false;
    return true;
  });
  const clear = () => {
    setQ('');
    setType('');
    setStatus('');
    setRm('');
    setStage('');
  };

  const shown = cur ? ips.find((p) => p.id === cur.id) : undefined;
  if (cur && shown)
    return <PartnerPage key={shown.id} p={shown} tab={cur.tab} backLabel={cur.back?.label ?? 'Institution partners'} onBack={back} {...props} />;

  return (
    <div className="ipage">
      <PageHead title="Institution partners" lead="Who GSP has an agreement with, or is working towards one. Each partner has one or more universities.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding(true)}>
          Add a partner
        </Button>
      </PageHead>

      <Tiles label="Where each partner is" value={stage} onPick={setStage} items={TILES.map((t) => ({ ...t, n: ips.filter((p) => stagesOf(p).includes(t.key)).length }))} />

      <section className="card stable" aria-labelledby="iip-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search institution partners</span>
              <input id="iip-q" type="search" placeholder="Partner, university or contact" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <SelectInput id="iip-type" aria-label="Type" value={type} placeholder="All types" allowEmpty onChange={(e) => setType(e.target.value)}>
              {PARTNER_TYPES.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="iip-status" aria-label="Status" value={status} placeholder="All statuses" allowEmpty onChange={(e) => setStatus(e.target.value)}>
              {PARTNER_STATUSES.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="iip-rm" aria-label="Relationship manager" value={rm} placeholder="All managers" allowEmpty onChange={(e) => setRm(e.target.value)}>
              {TEAM.map((k) => (
                <option key={k} value={k}>
                  {k === me ? `${k} (you)` : k}
                </option>
              ))}
            </SelectInput>
          </div>
          <p className="stools__count" id="iip-count" role="status">
            <span>
              <span className="num">{rows.length === ips.length ? ips.length : `${rows.length} of ${ips.length}`}</span> {ips.length === 1 ? 'partner' : 'partners'}
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <NoMatch what="partners" onClear={clear} />
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
                {rows.map((p) => {
                  const us = unisOf(p);
                  const a = agreementOf(p);
                  const st = stagesOf(p);
                  return (
                    <tr key={p.id} className="irow" onClick={() => show(p.id)}>
                      <td>
                        <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(p.id))}>
                          {p.name}
                        </button>
                        <span className="irow__sub">
                          {FLAG[p.country as Destination] && <span aria-hidden="true">{FLAG[p.country as Destination]} </span>}
                          {p.country}
                        </span>
                      </td>
                      <td>{p.type}</td>
                      <td>
                        <span className="num">{us.length}</span>
                        {us.length === 1 && p.type !== 'Direct' && <span className="irow__sub">{uniName(us[0].id)}</span>}
                      </td>
                      <td>{p.rm === me ? `${p.rm} (you)` : p.rm}</td>
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
      </section>

      <AddPartner
        open={adding}
        me={me}
        taken={(n) => ips.some((p) => p.name.toLowerCase() === n.trim().toLowerCase())}
        onCancel={() => setAdding(false)}
        onAdd={(p) => {
          set((d) => ({ ...d, ips: [p, ...d.ips] }));
          setAdding(false);
          clear();
          show(p.id);
          say(`${p.name} added.`);
        }}
      />
    </div>
  );
}

type Draft = { name: string; type: PartnerType | ''; status: PartnerStatus | ''; rm: string; country: Destination | ''; website: string };

/**
 * Adding a partner (29 Oct, 4th round): one form of who it is and where it stands, with its status picked here.
 * No agreement upload: its documents are added on its page, and nothing is read from them for you.
 */
function AddPartner({ open, me, taken, onCancel, onAdd }: { open: boolean; me: string; taken: (n: string) => boolean; onCancel: () => void; onAdd: (p: InstitutionPartner) => void }) {
  const blank: Draft = { name: '', type: '', status: '', rm: me, country: '', website: '' };
  const [v, setV] = useState<Draft>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV({ ...blank, rm: me });
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Draft>) => setV((x) => ({ ...x, ...p }));
  const err = {
    name: !v.name.trim() ? 'Enter the partner’s name.' : taken(v.name) ? 'That partner is already here.' : null,
    type: !v.type ? 'Pick the type.' : null,
    status: !v.status ? 'Pick where it stands.' : null,
    rm: !v.rm ? 'Pick who looks after it.' : null,
    country: !v.country ? 'Pick the country.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const name = v.name.trim();
    onAdd({ id: `ip-${Date.now().toString(36)}`, name, type: v.type as PartnerType, country: v.country, website: v.website.trim().replace(/^https?:\/\//, ''), rm: v.rm, status: v.status as PartnerStatus, docs: [], commission: null, contacts: [], added: inDays(0), stamps: {} });
  };
  const groups = [...new Set(PARTNER_STATUSES.map(statusGroup))];

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Add an institution partner"
      sub="Its agreement and contacts are added on its page."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="ip-name" label="Partner name" required error={show('name')} className="iform__wide">
          <TextInput id="ip-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} placeholder="Like: Southbridge Pathways" />
        </Field>
        <Field id="ip-type" label="Type" required error={show('type')}>
          <SelectInput id="ip-type" value={v.type} placeholder="Pick a type" invalid={!!show('type')} onChange={(e) => set({ type: e.target.value as PartnerType })}>
            {PARTNER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ip-status" label="Status" required error={show('status')}>
          <SelectInput id="ip-status" value={v.status} placeholder="Pick a status" invalid={!!show('status')} onChange={(e) => set({ status: e.target.value as PartnerStatus })}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {PARTNER_STATUSES.filter((x) => statusGroup(x) === g).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectInput>
        </Field>
        <Field id="ip-rm" label="Relationship manager" required error={show('rm')}>
          <SelectInput id="ip-rm" value={v.rm} invalid={!!show('rm')} onChange={(e) => set({ rm: e.target.value })}>
            {TEAM.map((k) => (
              <option key={k} value={k}>
                {k === me ? `${k} (you)` : k}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ip-country" label="Country" required error={show('country')}>
          <SelectInput id="ip-country" value={v.country} placeholder="Pick a country" invalid={!!show('country')} onChange={(e) => set({ country: e.target.value as Destination })}>
            {DESTINATIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ip-web" label="Website" optional className="iform__wide">
          <TextInput id="ip-web" value={v.website} onChange={(e) => set({ website: e.target.value })} placeholder="Like: southbridgepathways.com.au" />
        </Field>
      </div>
    </Sheet>
  );
}
