import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreMenu } from '../../components/MoreMenu';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { COUNTRIES, countryByName } from '../../data/partners';
import { MultiPick } from '../../institution/records/MultiPick';
import { PageHead } from '../../institution/records/parts';
import { REGION_ROWS, type BdmRow } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History, PER_PAGE, Pager, Panel, usePaged } from './parts';

const listOf = (a: string) => (a ? a.split(',').map((x) => x.trim()) : []);
/** Where a row applies: its states, then its cities; neither is the whole country (or region). */
const where = (r: BdmRow) => [r.state, r.city].filter(Boolean).join(' · ') || (REGION_ROWS.includes(r.country) ? 'All countries' : 'All');
const label = (r: BdmRow) => `${r.country} · ${where(r)} → ${r.bdm}`;
const isRest = (a: string) => a.startsWith('Rest of');
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The main cities BDMs are assigned by, in the markets GSP recruits from most (the country list has states only). */
const CITIES: Record<string, string[]> = {
  India: ['Ahmedabad', 'Amritsar', 'Bengaluru', 'Chandigarh', 'Chennai', 'Hyderabad', 'Jalandhar', 'Kochi', 'Kolkata', 'Ludhiana', 'Mumbai', 'New Delhi', 'Pune'],
  Bangladesh: ['Chattogram', 'Dhaka', 'Khulna', 'Sylhet'],
  Nepal: ['Biratnagar', 'Kathmandu', 'Lalitpur', 'Pokhara'],
  'Sri Lanka': ['Colombo', 'Galle', 'Kandy', 'Jaffna'],
  Vietnam: ['Da Nang', 'Hai Phong', 'Hanoi', 'Ho Chi Minh City'],
  Philippines: ['Cebu City', 'Davao City', 'Manila', 'Quezon City'],
  Pakistan: ['Islamabad', 'Karachi', 'Lahore'],
  Nigeria: ['Abuja', 'Ibadan', 'Lagos', 'Port Harcourt'],
};

/**
 * BDM Assignment (PM: Settings › BDM assignment): every branch gets a BDM from this table by its location, most
 * specific match first (city, then state, then country, then All other countries). A referral code overrides it for
 * a new recruitment partner's head office. Changes apply to new branches only. The fallback row can't go. 3 Nov
 * (Nesil): 20 rows a page, and the row's states or cities picked from one searchable list. 4 Nov (Nesil): **State**
 * and **City** are two fields, both optional, and two columns.
 */
export function Bdm({ cfg, change, say }: ConfigProps) {
  const [edit, setEdit] = useState<BdmRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<BdmRow | null>(null);
  const bdms = [...new Set(cfg.bdm.map((r) => r.bdm))].sort();
  const pg = usePaged(cfg.bdm);
  return (
    <>
      <PageHead title="BDM Assignment" lead="A new branch gets its BDM from the most specific row that matches where it is.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
          Add Row
        </Button>
      </PageHead>
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__click">
            <thead>
              <tr>
                <th scope="col">Country or region</th>
                <th scope="col">State</th>
                <th scope="col">City</th>
                <th scope="col">BDM</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pg.rows.map((r) => (
                <tr key={r.id} onClick={() => setEdit(r)}>
                  <td>
                    <button type="button" className="cfg__rowlink" onClick={(e) => (e.stopPropagation(), setEdit(r))}>
                      {r.country}
                    </button>
                  </td>
                  <td className="cfg__muted">{r.state || (r.city ? '—' : REGION_ROWS.includes(r.country) ? 'All countries' : 'All')}</td>
                  <td className="cfg__muted">{r.city || '—'}</td>
                  <td className="cfg__strong">{r.bdm}</td>
                  <td className="cfg__acts" onClick={(e) => e.stopPropagation()}>
                    {r.fallback ? (
                      <span className="cfg__tag">Fallback</span>
                    ) : (
                      <MoreMenu
                        id={`bdm-${r.id}`}
                        label={`More for ${r.country} · ${where(r)}`}
                        items={[
                          { id: 'edit', label: 'Edit Row', icon: 'edit', onPick: () => setEdit(r) },
                          { id: 'remove', label: 'Remove Row', icon: 'close', danger: true, onPick: () => setRemoving(r) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pg={pg} what="rows" />
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
          // a new row goes just above the fallback: show the page it's on
          if (isNew) pg.setPage(Math.ceil(cfg.bdm.length / PER_PAGE));
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title="Remove this row?"
        confirm="Remove Row"
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

/**
 * Add or edit a row: the country or region, its **states** and its **cities** (4 Nov: two fields, both optional, each a
 * searchable list to pick several from; neither for the whole country, or "Rest of" it, among the states, for
 * everywhere not in another row), and the BDM. With both, the row is those cities in those states.
 */
function BdmDialog({ open, row, rows, bdms, onClose, onSave }: { open: boolean; row: BdmRow | null; rows: BdmRow[]; bdms: string[]; onClose: () => void; onSave: (r: BdmRow, isNew: boolean) => void }) {
  const [country, setCountry] = useState('');
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [bdm, setBdm] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setCountry(row?.country ?? '');
    setStates(row ? listOf(row.state) : []);
    setCities(row ? listOf(row.city) : []);
    setBdm(row?.bdm ?? '');
    setTried(false);
  }, [open, row?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const fallback = !!row?.fallback;
  const isRegion = REGION_ROWS.includes(country);
  const rest = `Rest of ${country}`;
  // what's picked stays on the list, even when the country list names it differently
  const stateOptions = country && !isRegion ? [rest, ...[...new Set([...(countryByName(country)?.states ?? []), ...states.filter((s) => s !== rest)])].sort((a, b) => a.localeCompare(b))] : [];
  // the cities another row already has, so they can't be picked twice
  const taken = new Set(rows.filter((r) => r.id !== row?.id && r.country === country).flatMap((r) => listOf(r.city)));
  const cityOptions = country && !isRegion ? [...new Set([...(CITIES[country] ?? []).filter((c) => !taken.has(c)), ...cities])].sort((a, b) => a.localeCompare(b)) : [];
  const isRestRow = states.includes(rest);
  const overlap = rows.find((r) => {
    if (r.id === row?.id || r.country !== country) return false;
    const rs = listOf(r.state);
    const rc = listOf(r.city);
    if (!cities.length && !rc.length) return same(rs, states) || rs.some((s) => states.includes(s) && !isRest(s));
    return rc.some((c) => cities.includes(c));
  });
  const err = {
    country: !country ? 'Choose a country or region.' : null,
    bdm: !bdm.trim() ? 'Choose a BDM.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (fallback ? err.bdm : Object.values(err).some(Boolean)) return;
    onSave(fallback ? { ...row!, bdm: bdm.trim() } : { id: row?.id ?? `b${Date.now()}`, country, state: isRegion ? '' : states.join(', '), city: isRegion || isRestRow ? '' : cities.join(', '), bdm: bdm.trim() }, !row);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={row ? 'Edit Row' : 'Add Row'}
      sub={fallback ? 'Fallback row: catches every country not matched above. Only the BDM can change.' : undefined}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{row ? 'Save Changes' : 'Add Row'}</Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        {!fallback && (
          <>
            <Field id="bd-country" label="Country or region" required error={show('country')}>
              <SelectInput id="bd-country" value={country} placeholder="Choose" invalid={!!show('country')} onChange={(e) => (setCountry(e.target.value), setStates([]), setCities([]))}>
                {[...REGION_ROWS, ...COUNTRIES.map((c) => c.name)].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="bd-state" label="State" optional hint={!country ? 'Choose the country first.' : isRegion ? 'A region row covers the whole region.' : undefined}>
              {country && !isRegion ? (
                <MultiPick
                  id="bd-state"
                  label="State"
                  value={states}
                  options={stateOptions}
                  // "Rest of" stands alone: picking it clears the states and cities, and picking a state clears it
                  onChange={(next) => {
                    if (next.includes(rest) && !states.includes(rest)) {
                      setStates([rest]);
                      setCities([]);
                    } else setStates(next.filter((p) => p !== rest || next.length === 1));
                  }}
                  empty={`All of ${country}`}
                  all={`All of ${country}`}
                  search
                />
              ) : (
                <TextInput id="bd-state" value={isRegion ? 'All countries' : ''} placeholder="Choose the country first" disabled readOnly />
              )}
            </Field>
            {!isRegion && (
              <Field id="bd-city" label="City" optional hint={!country ? 'Choose the country first.' : undefined}>
                {country && !isRestRow && (cityOptions.length > 0 || cities.length > 0) ? (
                  <MultiPick id="bd-city" label="City" value={cities} options={cityOptions} onChange={setCities} empty={states.length ? 'Any city' : `All of ${country}`} search />
                ) : (
                  <TextInput id="bd-city" value="" placeholder={country ? 'Any city' : 'Choose the country first'} disabled readOnly />
                )}
              </Field>
            )}
          </>
        )}
        <Field id="bd-bdm" label="BDM" required error={show('bdm')} hint="Pick one, or type a new name.">
          <TextInput id="bd-bdm" list="bd-bdms" value={bdm} invalid={!!show('bdm')} placeholder="Choose or type" onChange={(e) => setBdm(e.target.value)} />
        </Field>
        <datalist id="bd-bdms">
          {bdms.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        {!fallback && overlap && (
          <p className="cfg__warnbox">
            <Icon name="alert" size={16} /> Overlaps an existing row: {label(overlap)}. The more specific row wins.
          </p>
        )}
      </div>
    </Sheet>
  );
}
