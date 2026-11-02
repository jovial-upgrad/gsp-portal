import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, TextInput } from '../../components/forms';
import { useCheck } from '../../components/validate';
import { COUNTRIES, countryByName, CITIES } from '../../data/partners';
import { PageHead } from '../../institution/records/parts';
import { MultiPick } from '../../institution/records/MultiPick';
import type { BdmRow } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History } from './parts';
import { Loaded, NoResults, Pick, SaveBanner, ViewOnlyNote, istDate, trySave, type SaveResult } from './states';

const FALLBACK = 'All other countries';
const placesOf = (r: BdmRow) => r.area.split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Recruitment assignment (PRD slice 1; Admin › Recruitment › Recruitment assignment): when a new RP or branch is created, it gets a
 * BDM from this table, the most specific match first (city, then state, then country, then the fallback row, "All
 * other countries", which can't be deleted). The RP's partner manager comes from it; the admissions contact comes
 * from the region. Changing a row affects new branches only; an existing RP's BDM changes on its record.
 */
export function Bdm({ cfg, change, say, canEdit }: ConfigProps) {
  const [edit, setEdit] = useState<BdmRow | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [bdm, setBdm] = useState('');
  const bdms = cfg.users.filter((u) => u.role === 'Recruitment' && u.status === 'Active').map((u) => u.name).sort();
  const t = q.trim().toLowerCase();
  const rows = cfg.bdm.filter((r) => (!t || [r.country, r.area, r.bdm].some((x) => x.toLowerCase().includes(t))) && (!country || r.country === country) && (!bdm || r.bdm === bdm));
  const clear = () => (setQ(''), setCountry(''), setBdm(''));
  const countries = [...new Set(cfg.bdm.map((r) => r.country))].sort();
  return (
    <>
      <PageHead title="Recruitment assignment" lead="A new RP or branch gets its Recruitment contact from this table: one per state or city, and a specific city wins over All / Rest of the country. With no row for the place, the sales region’s default recruitment contact applies, then All other countries. Changing a row affects new branches only; an existing RP’s contact changes on its record.">
        {canEdit && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
            Add row
          </Button>
        )}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      <Loaded page="Recruitment assignment" cols={5}>
        <section className="card stable">
          <div className="stools">
            <div className="stools__row">
              <label className="ssearch">
                <Icon name="search" size={18} />
                <span className="vh">Search Recruitment assignment</span>
                <input id="bd-q" type="search" placeholder="Country, state, city or person" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <Pick id="bd-fc" label="Country" value={country} empty="All countries" options={countries} onChange={setCountry} />
              <Pick id="bd-fb" label="Recruitment" value={bdm} empty="Everyone" options={[...new Set(cfg.bdm.map((r) => r.bdm))].sort()} onChange={setBdm} />
            </div>
            <p className="stools__count" role="status">
              <span className="num">{rows.length === cfg.bdm.length ? cfg.bdm.length : `${rows.length} of ${cfg.bdm.length}`}</span> rows
            </p>
          </div>
          {!rows.length ? (
            <NoResults thing="rows" onClear={clear} />
          ) : (
            <div className="stab-wrap">
              <table className={`itab cfg__tab ${canEdit ? 'cfg__click' : ''}`}>
                <thead>
                  <tr>
                    <th scope="col">Country or region</th>
                    <th scope="col">States or cities</th>
                    <th scope="col">Recruitment</th>
                    <th scope="col">Note</th>
                    <th scope="col">Last changed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={canEdit ? () => setEdit(r) : undefined}>
                      <td>
                        {canEdit ? (
                          <button type="button" className="cfg__rowlink" onClick={(e) => (e.stopPropagation(), setEdit(r))}>
                            {r.country}
                          </button>
                        ) : (
                          <span className="cfg__strong">{r.country}</span>
                        )}
                        {r.fallback && <span className="cfg__sub">Fallback row</span>}
                      </td>
                      <td className="cfg__muted">{r.area}</td>
                      <td className="cfg__strong">{r.bdm}</td>
                      <td className="cfg__muted">{r.note || '–'}</td>
                      <td className="cfg__muted">
                        {r.changedAt ? istDate(r.changedAt) : '–'}
                        {r.changedBy && <span className="cfg__sub">{r.changedBy}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Loaded>
      <History log={cfg.log} area="Recruitment assignment" />
      <BdmDialog
        open={!!edit}
        row={edit === 'new' ? null : edit}
        rows={cfg.bdm}
        bdms={bdms}
        onClose={() => setEdit(null)}
        onDelete={(r) => {
          change('Recruitment assignment', `Deleted ${r.country} · ${r.area} (${r.bdm})`, (c) => ({ ...c, bdm: c.bdm.filter((x) => x.id !== r.id) }));
          say('Row deleted.');
          setEdit(null);
        }}
        onSave={(r, was) => {
          const stamp = { changedAt: Date.now(), changedBy: cfg.users.find((u) => u.role === 'Admin')?.name ?? 'Admin' };
          change('Recruitment assignment', was ? `${was.country} · ${was.area}: ${[was.country !== r.country && `country ${was.country} → ${r.country}`, was.area !== r.area && `states or cities ${was.area} → ${r.area}`, was.bdm !== r.bdm && `BDM ${was.bdm} → ${r.bdm}`, (was.note ?? '') !== (r.note ?? '') && `note ${was.note || '–'} → ${r.note || '–'}`].filter(Boolean).join('; ')}` : `Added ${r.country} · ${r.area} → ${r.bdm}`, (c) => {
            const next = { ...r, ...stamp };
            if (was) return { ...c, bdm: c.bdm.map((x) => (x.id === r.id ? next : x)) };
            const at = c.bdm.findIndex((x) => x.fallback);
            return { ...c, bdm: [...c.bdm.slice(0, at), next, ...c.bdm.slice(at)] };
          });
          say('Saved.');
          setEdit(null);
        }}
      />
    </>
  );
}

/** Add or edit a row (PRD slice 1, Recruitment assignment › Fields); Edit has Delete row (not on the fallback row). */
function BdmDialog({ open, row, rows, bdms, onClose, onSave, onDelete }: { open: boolean; row: BdmRow | null; rows: BdmRow[]; bdms: string[]; onClose: () => void; onSave: (r: BdmRow, was: BdmRow | null) => void; onDelete: (r: BdmRow) => void }) {
  const [country, setCountry] = useState('');
  const [places, setPlaces] = useState<string[]>([]);
  const [bdm, setBdm] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const fallback = !!row?.fallback;
  useEffect(() => {
    if (!open) return;
    setCountry(row?.country ?? '');
    setPlaces(row ? placesOf(row) : []);
    setBdm(row?.bdm ?? '');
    setNote(row?.note ?? '');
    setStart(JSON.stringify([row?.country ?? '', row ? placesOf(row) : [], row?.bdm ?? '', row?.note ?? '']));
    setResult(null);
    c.reset();
  }, [open, row?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const states = countryByName(country)?.states ?? [];
  const ALL = 'All';
  const REST = `Rest of ${country}`;
  // one Recruitment contact per state or city (Jovial, 2 Nov): a place in another row of the country is refused;
  // All and Rest of <country> are the same place (the country's fallback), so only one row can have either
  const keyOf = (p: string) => (p === ALL || p === REST || p.startsWith('Rest of ') ? '*' : p.toLowerCase());
  const owner = useMemo(() => {
    const m = new Map<string, string>();
    rows.filter((r) => r.id !== row?.id && r.country === country).forEach((r) => placesOf(r).forEach((p) => m.set(keyOf(p), r.bdm)));
    return m;
  }, [rows, row?.id, country]); // eslint-disable-line react-hooks/exhaustive-deps
  const clash = places.find((p) => owner.has(keyOf(p)));
  const c = useCheck({
    country: fallback ? null : !country ? 'Pick a country.' : null,
    places: fallback ? null : !places.length ? 'Pick at least one state or city, or All.' : clash ? `${clash === ALL || clash === REST ? `All / Rest of ${country}` : clash} already has a Recruitment contact (${owner.get(keyOf(clash))}). One per state or city.` : null,
    bdm: !bdm ? 'Pick a Recruitment user.' : null,
  });
  const dirty = JSON.stringify([country, places, bdm, note]) !== start;
  // "All" and "Rest of <country>" can't sit with other values
  const pick = (next: string[]) => {
    const added = next.filter((p) => !places.includes(p));
    if (added.includes(ALL)) return setPlaces([ALL]);
    if (added.includes(REST)) return setPlaces([REST]);
    setPlaces(next.filter((p) => p !== ALL && p !== REST));
  };
  const options = country ? [ALL, REST, ...new Set([...states, ...states.flatMap((st) => CITIES[st] ?? []), ...places.filter((p) => p !== ALL && p !== REST)])] : [];
  const save = () => {
    if (!c.submit()) return;
    const r = trySave();
    if (r !== 'ok') return setResult(r);
    onSave(fallback ? { ...row!, bdm, note: note.trim() || undefined } : { id: row?.id ?? `b${Date.now()}`, country, area: places.join(', '), bdm, note: note.trim() || undefined }, row);
  };
  return (
    <>
      <Sheet
        open={open && !confirm}
        onClose={onClose}
        dirty={dirty}
        what={row ? 'this row' : 'the new row'}
        center
        className="iform cfg__sheet"
        title={row ? 'Edit row' : 'Add row'}
        sub={fallback ? 'The fallback row (All other countries) catches every country not matched above. Only its Recruitment contact and note can change; it can’t be deleted.' : undefined}
        footer={
          <div className="asf">
            {row && !fallback && (
              <Button variant="secondary" className="btn--danger" iconLeft={<Icon name="close" size={16} />} onClick={() => setConfirm(true)}>
                Delete row
              </Button>
            )}
            <div className="asf__acts">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={!!row && !dirty}>
                {row ? 'Save' : 'Add row'}
              </Button>
            </div>
          </div>
        }
      >
        <SaveBanner result={result} onReload={onClose} />
        <div className="cfg__form">
          {fallback ? (
            <div className="field">
              <span className="field__label">Country or region</span>
              <p className="cfg__strong">{FALLBACK}</p>
            </div>
          ) : (
            <>
              <Field id="bd-country" label="Country or region" required error={c.err('country')}>
                <Pick id="bd-country" label="Country or region" value={country} placeholder="Pick a country" options={COUNTRIES.map((x) => x.name)} invalid={!!c.err('country')} onChange={(x) => (setCountry(x), setPlaces([]), c.blur('country')())} />
              </Field>
              <Field id="bd-places" label="States or cities" required error={c.err('places')} hint={country ? `All, Rest of ${country}, or the states and cities this person covers. A state or city can be in only one row of a country.` : 'Pick a country first.'}>
                <MultiPick id="bd-places" label="States or cities" invalid={!!c.err('places')} onClose={c.blur('places')} value={places} options={options} empty={country ? 'Pick states or cities, or All' : 'Pick a country first'} search onChange={pick} />
              </Field>
            </>
          )}
          <Field id="bd-bdm" label="Recruitment" required error={c.err('bdm')} hint="Active Recruitment users only.">
            <Pick id="bd-bdm" label="Recruitment" value={bdm} placeholder="Pick a Recruitment user" options={[...new Set([...bdms, bdm].filter(Boolean))]} invalid={!!c.err('bdm')} onChange={(x) => (setBdm(x), c.blur('bdm')())} />
          </Field>
          <Field id="bd-note" label="Note" optional hint="Like: Govind Tiwari, Saikat Bhowmik and Ronak Patel also cover it">
            <TextInput id="bd-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Sheet>
      <ConfirmDialog
        open={open && confirm}
        title="Delete this row?"
        confirm="Delete row"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (row) onDelete(row);
        }}
      >
        <p>{row && `${row.country} · ${row.area} → ${row.bdm}. New branches there fall to the next match. Existing branches keep their Recruitment contact.`}</p>
      </ConfirmDialog>
    </>
  );
}

