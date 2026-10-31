import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreMenu } from '../../components/MoreMenu';
import { Field, SelectInput } from '../../components/forms';
import { COUNTRIES, countryByName } from '../../data/partners';
import { PageHead } from '../../institution/records/parts';
import { MultiPick } from '../../institution/records/MultiPick';
import { CITIES } from '../../data/students';
import { REGION_ROWS, type BdmRow } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History, Panel } from './parts';

type Covers = 'whole' | 'some' | 'rest';
const coversOf = (r: BdmRow): Covers => (r.area.startsWith('Rest of') ? 'rest' : r.area === 'All' || r.area === 'All countries' ? 'whole' : 'some');
const label = (r: BdmRow) => `${r.country} · ${r.area} → ${r.bdm}`;

/**
 * BDM assignment (PM: Settings › BDM assignment): every branch gets a BDM from this table by its location, most
 * specific match first (city, then state, then country, then All other countries). A referral code overrides it for
 * a new recruitment partner's head office. Changes apply to new branches only. The fallback row can't go.
 */
export function Bdm({ cfg, change, say }: ConfigProps) {
  const [edit, setEdit] = useState<BdmRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<BdmRow | null>(null);
  const bdms = cfg.users.filter((u) => u.role === 'Recruitment' && u.status !== 'Deactivated').map((u) => u.name).sort();
  return (
    <>
      <PageHead
        title="BDM assignment"
        lead="Every branch has a BDM. A new branch gets one from this table by its location, most specific match first (city, then state, then country, then All other countries). A referral code overrides it for a new recruitment partner’s head office. Changes apply to new branches only."
      >
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
          Add row
        </Button>
      </PageHead>
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__click">
            <thead>
              <tr>
                <th scope="col">Country or region</th>
                <th scope="col">State or city</th>
                <th scope="col">BDM</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.bdm.map((r) => (
                <tr key={r.id} onClick={() => setEdit(r)}>
                  <td>
                    <button type="button" className="cfg__rowlink" onClick={(e) => (e.stopPropagation(), setEdit(r))}>
                      {r.country}
                    </button>
                  </td>
                  <td className="cfg__muted">{r.area}</td>
                  <td className="cfg__strong">{r.bdm}</td>
                  <td className="cfg__acts" onClick={(e) => e.stopPropagation()}>
                    {r.fallback ? (
                      <span className="cfg__tag">Fallback</span>
                    ) : (
                      <MoreMenu
                        id={`bdm-${r.id}`}
                        label={`More for ${r.country} · ${r.area}`}
                        items={[
                          { id: 'edit', label: 'Edit row', icon: 'edit', onPick: () => setEdit(r) },
                          { id: 'remove', label: 'Remove row', icon: 'close', danger: true, onPick: () => setRemoving(r) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cfg__foot cfg__note">Click a row to change its country, states or cities, or BDM. This table is what new sign-ups use; Admissions contacts come from Sales regions.</p>
      </Panel>
      <History log={cfg.log} area="BDM assignment" />
      <BdmDialog
        open={!!edit}
        row={edit === 'new' ? null : edit}
        rows={cfg.bdm}
        bdms={bdms}
        onClose={() => setEdit(null)}
        onSave={(r, isNew) => {
          change('BDM assignment', `${isNew ? 'Added' : 'Edited'} ${label(r)}`, (c) => {
            if (!isNew) return { ...c, bdm: c.bdm.map((x) => (x.id === r.id ? r : x)) };
            const at = c.bdm.findIndex((x) => x.fallback);
            return { ...c, bdm: [...c.bdm.slice(0, at), r, ...c.bdm.slice(at)] };
          });
          say('Saved. Applies to new branches from now on.');
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title="Remove this row?"
        confirm="Remove"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing!;
          change('BDM assignment', `Removed ${label(r)}`, (c) => ({ ...c, bdm: c.bdm.filter((x) => x.id !== r.id) }));
          say('Row removed. New branches there fall back to the next match.');
          setRemoving(null);
        }}
      >
        <p>{removing && `${label(removing)}. New branches there fall back to the next match. Existing branches keep their BDM.`}</p>
      </ConfirmDialog>
    </>
  );
}

/** Add or edit a row: the country or region, what it covers (all of it, some states or cities, or the rest), and the BDM. */
function BdmDialog({ open, row, rows, bdms, onClose, onSave }: { open: boolean; row: BdmRow | null; rows: BdmRow[]; bdms: string[]; onClose: () => void; onSave: (r: BdmRow, isNew: boolean) => void }) {
  const [country, setCountry] = useState('');
  const [covers, setCovers] = useState<Covers>('whole');
  const [places, setPlaces] = useState<string[]>([]);
  const [bdm, setBdm] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setCountry(row?.country ?? '');
    setCovers(row ? coversOf(row) : 'whole');
    setPlaces(row && coversOf(row) === 'some' ? row.area.split(',').map((x) => x.trim()) : []);
    setBdm(row?.bdm ?? '');
    setTried(false);
  }, [open, row?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const fallback = !!row?.fallback;
  const isRegion = REGION_ROWS.includes(country);
  const states = countryByName(country)?.states ?? [];
  const taken = new Set(rows.filter((r) => r.id !== row?.id && r.country === country && coversOf(r) === 'some').flatMap((r) => r.area.split(',').map((x) => x.trim())));
  const area = covers === 'whole' ? (isRegion ? 'All countries' : 'All') : covers === 'rest' ? `Rest of ${country}` : places.join(', ');
  const overlap = rows.find((r) => r.id !== row?.id && r.country === country && (r.area === area || (covers === 'some' && coversOf(r) === 'some' && places.some((p) => r.area.split(',').map((x) => x.trim()).includes(p)))));
  const err = {
    country: !country ? 'Choose a country or region.' : null,
    places: covers === 'some' && !places.length ? 'Pick at least one state or city.' : null,
    bdm: !bdm.trim() ? 'Choose a BDM.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  // states, then each state's main cities (Jovial, 31 Oct: one searchable list to tick)
  const placeOptions = [...new Set([...states, ...states.flatMap((st) => CITIES[st] ?? []), ...places])];
  const save = () => {
    setTried(true);
    if (fallback ? err.bdm : Object.values(err).some(Boolean)) return;
    onSave(fallback ? { ...row!, bdm: bdm.trim() } : { id: row?.id ?? `b${Date.now()}`, country, area, bdm: bdm.trim() }, !row);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={row ? 'Edit BDM row' : 'Add BDM row'}
      sub={fallback ? 'Fallback row: catches every country not matched above. Only the BDM can change.' : undefined}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{row ? 'Save' : 'Add row'}</Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        {!fallback && (
          <>
            <Field id="bd-country" label="Country or region" required error={show('country')}>
              <SelectInput id="bd-country" value={country} placeholder="Choose" invalid={!!show('country')} onChange={(e) => (setCountry(e.target.value), setPlaces([]), setCovers('whole'))}>
                {[...REGION_ROWS, ...COUNTRIES.map((c) => c.name)].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {country && (
              <fieldset className="cfg__radios">
                <legend>Covers</legend>
                {(
                  [
                    ['whole', `The whole ${isRegion ? 'region' : 'country'}`],
                    ...(isRegion ? [] : [['some', 'Only some states or cities']]),
                    ['rest', `Rest of ${country} (everywhere not in another row)`],
                  ] as [Covers, string][]
                ).map(([k, l]) => (
                  <label key={k} className="cfg__radio">
                    <input type="radio" name="bd-covers" checked={covers === k} onChange={() => setCovers(k)} />
                    {l}
                  </label>
                ))}
              </fieldset>
            )}
            {covers === 'some' && (
              <Field id="bd-places" label="States or cities" required error={show('places')} hint="Search and tick as many as this BDM covers. Ones already in another row aren’t offered.">
                <MultiPick id="bd-places" label="States or cities" value={places} options={placeOptions.filter((x) => !taken.has(x) || places.includes(x))} empty="Choose states or cities" search onChange={setPlaces} />
              </Field>
            )}
          </>
        )}
        <Field id="bd-bdm" label="BDM" required error={show('bdm')}>
          <SelectInput id="bd-bdm" value={bdm} placeholder="Choose a BDM" invalid={!!show('bdm')} onChange={(e) => setBdm(e.target.value)}>
            {[...new Set([...bdms, bdm].filter(Boolean))].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </SelectInput>
        </Field>
        {!fallback && overlap && (
          <p className="cfg__warnbox">
            <Icon name="alert" size={16} /> Overlaps an existing row: {label(overlap)}. The more specific row wins.
          </p>
        )}
      </div>
    </Sheet>
  );
}
