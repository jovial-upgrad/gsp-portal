import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { MoreMenu } from '../../components/MoreMenu';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { MultiPick } from '../../institution/records/MultiPick';
import { SearchPick } from '../../institution/records/SearchPick';
import { NoMatch, PageHead, RecordTabs, TabPanel } from '../../institution/records/parts';
import { FIXED_REGIONS, LEVELS, OBJECTS, REGION_COUNTRIES, ROLES, workRegions, type Level, type Perms, type Queue, type Region, type User } from '../data/config';
import { nationalityOf, type NationalityRow } from '../data/nationalities';
import { COUNTRIES } from '../../data/partners';
import { SelectMenu } from '../../components/SelectMenu';
import type { ConfigProps } from './ConfigPage';
import { EditActions, History, PER_PAGE, Pager, Panel, useAsk, usePaged } from './parts';

/** "Nigeria, Kenya, Ghana and 50 more": a long list cut short for the table. */
const short = (list: string[], n = 3) => (list.length <= n + 1 ? list.join(', ') : `${list.slice(0, n).join(', ')} and ${list.length - n} more`);

/**
 * Sales Regions (PM: Settings › Sales regions, with Admissions contacts; Nesil, 30 Oct: add, edit and delete): GSP's
 * internal regions. 3 Nov (Nesil): each has its countries, Admission contact, BDM contact and admission queues, all
 * needed; the columns are spaced evenly. Rest of world, Direct and Global are GSP's own and stay as they are; a region
 * that's deleted leaves its users with no region until they're given one.
 * 4 Nov (Nesil): two tabs, **Sales Regions** (this) and **Nationality Map** (which region each student nationality
 * goes to). Renaming a region moves its nationalities with it; deleting one leaves them not mapped.
 */
export function Regions(props: ConfigProps) {
  const { cfg, change, say } = props;
  const [tab, setTab] = useState<'regions' | 'nationality'>('regions');
  const [edit, setEdit] = useState<Region | 'new' | null>(null);
  const [removing, setRemoving] = useState<Region | null>(null);
  const [addingNat, setAddingNat] = useState(false);
  const usersIn = (r: string) => cfg.users.filter((u) => u.region === r).length;
  const queueName = (id: string) => cfg.queues.find((q) => q.id === id)?.name;
  const natIn = (r: string) => cfg.nationalities.filter((n) => n.region === r).length;
  return (
    <>
      <PageHead title="Sales Regions" lead="GSP’s sales regions, and where each nationality goes.">
        {tab === 'regions' ? (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
            Add Sales Region
          </Button>
        ) : (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAddingNat(true)}>
            Add Nationality
          </Button>
        )}
      </PageHead>
      <RecordTabs
        id="rgtab"
        label="Sales Regions"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'regions', label: 'Sales Regions', n: cfg.regions.length },
          { key: 'nationality', label: 'Nationality Map', n: cfg.nationalities.filter((n) => n.region).length },
        ]}
      />
      <TabPanel id="rgtab" tab={tab}>
        {tab === 'nationality' ? (
          <NationalityMap {...props} adding={addingNat} setAdding={setAddingNat} />
        ) : (
          <>
            <Panel flush>
              <div className="stab-wrap">
                <table className="itab cfg__tab cfg__tab--even">
                  <colgroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <col key={i} />
                    ))}
                    <col className="cfg__actcol" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Sales region</th>
                      <th scope="col">Countries</th>
                      <th scope="col">Admission contact</th>
                      <th scope="col">BDM contact</th>
                      <th scope="col">Admission queue</th>
                      <th scope="col">Users</th>
                      <th scope="col">
                        <span className="vh">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.regions.map((r) => {
                      const fixed = FIXED_REGIONS.includes(r.name);
                      const q = queueName(r.queue);
                      // 4 Nov (Nesil): an empty value is a dash, and GSP's own regions carry no tag
                      const dash = <span className="cfg__muted">—</span>;
                      const countries = r.countries.length ? short(r.countries) : (REGION_COUNTRIES[r.name] ?? []).join(', ');
                      return (
                        <tr key={r.name}>
                          <td className="cfg__strong">{r.name}</td>
                          <td className="cfg__muted" title={r.countries.join(', ') || undefined}>
                            {countries || '—'}
                          </td>
                          <td>{r.contact || dash}</td>
                          <td>{r.bdm || dash}</td>
                          <td>{q || dash}</td>
                          <td className="num">{usersIn(r.name)}</td>
                          <td className="cfg__acts">
                            {!fixed && (
                              <MoreMenu
                                id={`rg-${r.name}`}
                                label={`More for ${r.name}`}
                                items={[
                                  { id: 'edit', label: 'Edit Sales Region', icon: 'edit', onPick: () => setEdit(r) },
                                  { id: 'remove', label: 'Delete Sales Region', icon: 'close', danger: true, onPick: () => setRemoving(r) },
                                ]}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
            <History log={cfg.log} area="Sales regions" />
          </>
        )}
      </TabPanel>
      <RegionDialog
        open={!!edit}
        region={edit === 'new' ? null : edit}
        regions={cfg.regions}
        users={cfg.users}
        queues={cfg.queues}
        onClose={() => setEdit(null)}
        onSave={(r) => {
          const was = edit === 'new' ? null : edit;
          const facts = `${r.countries.length} ${r.countries.length === 1 ? 'country' : 'countries'}, Admission contact ${r.contact}, BDM contact ${r.bdm}, admission queue ${queueName(r.queue) ?? ''}`;
          if (!was) {
            change('Sales regions', `Added ${r.name}: ${facts}`, (c) => {
              const at = c.regions.findIndex((x) => FIXED_REGIONS.includes(x.name));
              return { ...c, regions: [...c.regions.slice(0, at), r, ...c.regions.slice(at)] };
            });
            say(`${r.name} added.`);
          } else {
            const renamed = was.name !== r.name;
            change('Sales regions', `${renamed ? `Renamed ${was.name} to ${r.name}; ` : `Edited ${r.name}: `}${facts}`, (c) => ({
              ...c,
              regions: c.regions.map((x) => (x.name === was.name ? r : x)),
              users: renamed ? c.users.map((u) => (u.region === was.name ? { ...u, region: r.name } : u)) : c.users,
              nationalities: renamed ? c.nationalities.map((n) => (n.region === was.name ? { ...n, region: r.name } : n)) : c.nationalities,
              calendars: renamed ? c.calendars.map((k) => ({ ...k, regions: k.regions.map((x) => (x === was.name ? r.name : x)) })) : c.calendars,
            }));
            say(`${r.name} saved.${renamed ? ' Its users moved with it.' : ''}`);
          }
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}?`}
        confirm="Delete Sales Region"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing!;
          change('Sales regions', `Deleted ${r.name}`, (c) => ({
            ...c,
            regions: c.regions.filter((x) => x.name !== r.name),
            calendars: c.calendars.map((k) => ({ ...k, regions: k.regions.filter((x) => x !== r.name) })),
            users: c.users.map((u) => (u.region === r.name ? { ...u, region: '' } : u)),
            nationalities: c.nationalities.map((n) => (n.region === r.name ? { ...n, region: '' } : n)),
          }));
          say(`${r.name} deleted.`);
          setRemoving(null);
        }}
      >
        <p>{removing && (usersIn(removing.name) ? `${usersIn(removing.name)} ${usersIn(removing.name) === 1 ? 'user is' : 'users are'} in it; they’ll have no sales region until you give them one in Create Roles.` : 'Nobody is in it.')}</p>
        {removing && natIn(removing.name) > 0 && (
          <p>
            {natIn(removing.name)} {natIn(removing.name) === 1 ? 'nationality goes' : 'nationalities go'} to it on the Nationality Map; they won’t be mapped, so their applications fall to the Fallback until you map them again.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

/**
 * Nationality Map (Nesil, 4 Nov; the PM's "Nationality to region" map): which sales region each student nationality
 * goes to. Application Routing's "Student's nationality" rule reads it; one that isn't mapped falls to the Fallback.
 * Only a student's nationality reads it: an RP's and a branch's region come from each region's countries. A search
 * (nationality, country or region), 20 a page, and Edit then Save Changes, as every Admin setting. 4 Nov (later):
 * **Add Nationality** (a country and its sales region, each searched and picked) and Delete on each row, asked first.
 */
function NationalityMap({ cfg, change, say, adding, setAdding }: ConfigProps & { adding: boolean; setAdding: (v: boolean) => void }) {
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [ask, asking] = useAsk();
  const regionOf = (n: NationalityRow) => draft?.[n.country] ?? n.region;
  const s = q.trim().toLowerCase();
  const rows = cfg.nationalities.filter((n) => !s || [n.nationality, n.country, regionOf(n) || 'not mapped'].some((x) => x.toLowerCase().includes(s)));
  const pg = usePaged(rows, [s]);
  const mapped = cfg.nationalities.filter((n) => n.region).length;
  const ruleNo = (id: string) => cfg.rules.findIndex((r) => r.id === id) + 1;
  const regions = workRegions(cfg.regions).map((r) => r.name);
  const changed = draft ? cfg.nationalities.filter((n) => draft[n.country] !== undefined && draft[n.country] !== n.region) : [];
  const save = () => {
    const d = draft!;
    const list = changed.map((n) => `${n.nationality} to ${d[n.country] || 'not mapped'}`);
    change('Nationality map', `Changed ${changed.length} ${changed.length === 1 ? 'nationality' : 'nationalities'}: ${list.slice(0, 6).join('; ')}${list.length > 6 ? ` and ${list.length - 6} more` : ''}`, (c) => ({
      ...c,
      nationalities: c.nationalities.map((n) => (d[n.country] !== undefined ? { ...n, region: d[n.country] } : n)),
    }));
    say(`${changed.length} ${changed.length === 1 ? 'nationality' : 'nationalities'} saved.`);
    setDraft(null);
  };
  return (
    <>
      <Panel
        flush
        title="Nationality Map"
        note={`${mapped} of ${cfg.nationalities.length} nationalities mapped. Routing rule ${ruleNo('nat')} (Student’s nationality) reads it; a nationality that isn’t mapped falls to rule ${ruleNo('fb')}, Fallback. Only a student’s nationality reads it: an RP’s and a branch’s region come from each region’s countries.`}
        action={<EditActions editing={!!draft} dirty={changed.length > 0} onEdit={() => setDraft({})} onCancel={() => setDraft(null)} onSave={save} />}
      >
        <div className="stools cfg__natools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search nationalities</span>
              <input id="nat-q" type="search" placeholder="Search a nationality or region" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <p className="stools__count" id="nat-count" role="status">
            <span>
              <span className="num">{rows.length === cfg.nationalities.length ? cfg.nationalities.length : `${rows.length} of ${cfg.nationalities.length}`}</span> nationalities
              {draft && changed.length > 0 && (
                <>
                  {' '}
                  · <span className="num">{changed.length}</span> changed
                </>
              )}
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <NoMatch what="nationalities" onClear={() => setQ('')} />
        ) : (
          <div className="stab-wrap">
            <table className="itab cfg__tab cfg__nat">
              <thead>
                <tr>
                  <th scope="col">Nationality</th>
                  <th scope="col">Sales region</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((n) => {
                  const r = regionOf(n);
                  return (
                    <tr key={n.country} className={draft && draft[n.country] !== undefined && draft[n.country] !== n.region ? 'is-changed' : ''}>
                      <td>
                        <span className="cfg__strong">{n.nationality}</span>
                        {n.nationality !== n.country && <span className="irow__sub">{n.country}</span>}
                      </td>
                      <td>
                        {draft ? (
                          <SelectInput id={`nat-${n.country}`} aria-label={`Sales region for ${n.nationality}`} value={r} onChange={(e) => setDraft((x) => ({ ...x, [n.country]: e.target.value }))}>
                            <option value="">Not mapped</option>
                            {[...new Set([...regions, ...(r ? [r] : [])])].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </SelectInput>
                        ) : r ? (
                          r
                        ) : (
                          <span className="cfg__muted">Not mapped: falls to the Fallback</span>
                        )}
                      </td>
                      <td className="cfg__linkacts">
                        <button
                          type="button"
                          className="cfg__linkbtn is-danger"
                          aria-label={`Delete ${n.nationality}`}
                          onClick={() =>
                            ask({
                              title: `Delete ${n.nationality}?`,
                              confirm: 'Delete Nationality',
                              body: `${n.nationality} students’ applications fall to rule ${ruleNo('fb')}, Fallback, until you add it again.`,
                              run: () => {
                                change('Nationality map', `Deleted ${n.nationality} (${n.country}${n.region ? `, ${n.region}` : ''})`, (c) => ({ ...c, nationalities: c.nationalities.filter((x) => x.country !== n.country) }));
                                setDraft((d) => d && Object.fromEntries(Object.entries(d).filter(([k]) => k !== n.country)));
                                say(`${n.nationality} deleted.`);
                              },
                            })
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager pg={pg} what="nationalities" />
      </Panel>
      <History log={cfg.log} area="Nationality map" />
      {asking}
      <NationalityDialog
        open={adding}
        rows={cfg.nationalities}
        regions={regions}
        onClose={() => setAdding(false)}
        onSave={(row) => {
          change('Nationality map', `Added ${row.nationality} (${row.country}) to ${row.region}`, (c) => ({ ...c, nationalities: [...c.nationalities, row].sort((a, b) => a.nationality.localeCompare(b.nationality)) }));
          say(`${row.nationality} added: ${row.region}.`);
          // show the page it's on
          if (s) setQ(row.nationality);
          else pg.setPage(Math.floor([...cfg.nationalities, row].sort((a, b) => a.nationality.localeCompare(b.nationality)).findIndex((x) => x.country === row.country) / PER_PAGE) + 1);
          setAdding(false);
        }}
      />
    </>
  );
}

/** Add a nationality: its country and its sales region, each searched and picked from a list. */
function NationalityDialog({ open, rows, regions, onClose, onSave }: { open: boolean; rows: NationalityRow[]; regions: string[]; onClose: () => void; onSave: (r: NationalityRow) => void }) {
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setCountry('');
    setRegion('');
    setTried(false);
  }, [open]);
  // a country is on the map once
  const have = new Set(rows.map((r) => r.country));
  const countries = COUNTRIES.map((c) => c.name).filter((c) => !have.has(c));
  const err = { country: !country ? 'Pick the country.' : null, region: !region ? 'Pick its sales region.' : null };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ country, nationality: nationalityOf(country), region });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title="Add Nationality"
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Add Nationality</Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="na-country" label="Country" required error={show('country')}>
          <SearchPick id="na-country" label="Country" value={country} options={countries.map((c) => ({ value: c, label: c, note: nationalityOf(c) !== c ? nationalityOf(c) : undefined }))} onChange={setCountry} invalid={!!show('country')} describedBy={show('country') ? 'na-country-error' : undefined} placeholder="Search a country" />
        </Field>
        <Field id="na-region" label="Sales region" required error={show('region')}>
          <SearchPick id="na-region" label="Sales region" value={region} options={regions.map((r) => ({ value: r, label: r }))} onChange={setRegion} invalid={!!show('region')} describedBy={show('region') ? 'na-region-error' : undefined} placeholder="Search a sales region" />
        </Field>
      </div>
    </Sheet>
  );
}

/** Add or edit a sales region: its name, countries, Admission contact, BDM contact and admission queue (one, since
 *  4 Nov), all needed. */
function RegionDialog({ open, region, regions, users, queues, onClose, onSave }: { open: boolean; region: Region | null; regions: Region[]; users: User[]; queues: Queue[]; onClose: () => void; onSave: (r: Region) => void }) {
  const [name, setName] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [contact, setContact] = useState('');
  const [bdm, setBdm] = useState('');
  const [queue, setQueue] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(region?.name ?? '');
    setCountries(region?.countries ?? []);
    setContact(region?.contact ?? '');
    setBdm(region?.bdm ?? '');
    setQueue(queues.some((q) => q.id === region?.queue) ? region!.queue : '');
    setTried(false);
  }, [open, region?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = name.trim();
  // a country is in one region: the others' countries aren't offered
  const elsewhere = new Set(regions.filter((r) => r.name !== region?.name).flatMap((r) => r.countries));
  const countryOptions = COUNTRIES.map((c) => c.name).filter((c) => !elsewhere.has(c));
  const admissions = users.filter((u) => u.role === 'GSP · Admissions' && u.status !== 'Deactivated');
  const bdms = users.filter((u) => u.role === 'GSP · Recruitment' && u.status !== 'Deactivated');
  const admissionQueues = queues.filter((q) => /admission/i.test(q.name));
  const err = {
    name: v.length < 2 ? 'Name the region, like Middle East.' : regions.some((r) => r.name !== region?.name && r.name.toLowerCase() === v.toLowerCase()) ? 'There’s already a region with this name.' : null,
    countries: !countries.length ? 'Pick its countries.' : null,
    contact: !contact ? 'Pick its Admission contact.' : null,
    bdm: !bdm ? 'Pick its BDM contact.' : null,
    queue: !queue ? 'Pick its admission queue.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ name: v, countries, contact, bdm, queue });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={region ? `Edit ${region.name}` : 'Add Sales Region'}
      sub="Everything here is needed."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{region ? 'Save Changes' : 'Add Sales Region'}</Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="rg-name" label="Name" required error={show('name')}>
          <TextInput id="rg-name" value={name} invalid={!!show('name')} placeholder="Like: Middle East" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="rg-countries" label="Countries" required error={show('countries')} hint="A country is in one region, so those in another aren’t listed.">
          <MultiPick id="rg-countries" label="Countries" value={countries} options={countryOptions} onChange={setCountries} empty="Choose countries" search />
        </Field>
        <Field id="rg-contact" label="Admission contact" required error={show('contact')} hint="Its recruitment partners see this person on every page.">
          <SelectInput id="rg-contact" value={contact} placeholder="Choose one person" invalid={!!show('contact')} onChange={(e) => setContact(e.target.value)}>
            {admissions.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name} · {u.title || u.role}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="rg-bdm" label="BDM contact" required error={show('bdm')}>
          <SelectInput id="rg-bdm" value={bdm} placeholder="Choose one person" invalid={!!show('bdm')} onChange={(e) => setBdm(e.target.value)}>
            {[...new Set([...bdms.map((u) => u.name), ...(region?.bdm ? [region.bdm] : [])])].map((n) => (
              <option key={n} value={n}>
                {n}
                {bdms.find((u) => u.name === n) ? ` · ${bdms.find((u) => u.name === n)!.title || 'Recruitment'}` : ''}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="rg-queue" label="Admission queue" required error={show('queue')}>
          <SelectInput id="rg-queue" value={queue} placeholder="Choose one queue" invalid={!!show('queue')} onChange={(e) => setQueue(e.target.value)}>
            {admissionQueues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}

const GROUPS: [string, number, number][] = [
  ['Students and applications', 0, 6],
  ['Recruitment partners', 6, 11],
  ['Institutions and courses', 11, 21],
  ['Commissions', 21, 26],
  ['GSP', 26, 30],
];
const LEVEL_NAME = Object.fromEntries(LEVELS) as Record<Level, string>;

/**
 * Permission Roles (PM: Settings › Permissions, decided 25 Oct): what each role can do with each object, from No
 * access to Manage. 3 Nov (Nesil): pick the role from a dropdown (no side-by-side view); the page reads as it is until
 * Edit, then Save Changes. Super Admin manages all and can't be changed. 4 Nov (Nesil): three levels, No Access, View
 * and View and Edit; each group is a section that opens and closes.
 */
export function Permissions({ cfg, change, say }: ConfigProps) {
  const [role, setRole] = useState<string>(ROLES[0]);
  const [draft, setDraft] = useState<Perms | null>(null);
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const fixed = role === 'Super Admin';
  const perms = draft ?? cfg.perms;
  const diff = draft ? OBJECTS.filter((o) => draft[o][role] !== cfg.perms[o][role]) : [];
  return (
    <>
      <PageHead title="Permission Roles" lead="What each role can see and change. Super Admin can do everything." />
      <Panel
        flush
        title={role}
        note={fixed ? 'Super Admin manages everything; it can’t be changed.' : draft ? 'Change the levels, then save. Scope (sales region, recruitment partner, branch) still limits which records they see.' : 'Edit to change what this role can do. It applies to everyone with the role, on their next page load.'}
        action={
          <div className="cfg__permbar">
            <div className="cfg__rolepick">
              <label htmlFor="pr-role" className="mbx__k">
                Role
              </label>
              <SelectMenu id="pr-role" label="Role" value={role} options={ROLES.map((r) => ({ value: r, label: r }))} onChange={(r) => (draft ? say('Save or cancel your changes first.') : setRole(r))} />
            </div>
            <EditActions
              editing={!!draft}
              dirty={diff.length > 0}
              disabled={fixed}
              onEdit={() => setDraft(cfg.perms)}
              onCancel={() => setDraft(null)}
              onSave={() => {
                const d = draft!;
                change('Permission roles', `${role}: ${diff.map((o) => `${o} → ${LEVEL_NAME[d[o][role]]}`).join('; ')}`, (c) => ({ ...c, perms: Object.fromEntries(OBJECTS.map((o) => [o, { ...c.perms[o], [role]: d[o][role] }])) }));
                say(`${role}: ${diff.length} ${diff.length === 1 ? 'change' : 'changes'} saved. Applies on their next page load.`);
                setDraft(null);
              }}
            />
          </div>
        }
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__perm">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Access</th>
              </tr>
            </thead>
            {GROUPS.map(([g, a, b], gi) => (
              <tbody key={g}>
                <tr className="cfg__grouprow">
                  <th scope="rowgroup" colSpan={2}>
                    <button type="button" className="cfg__groupt-btn" aria-expanded={!shut[g]} aria-controls={OBJECTS.slice(a, b).map((_, i) => `pr-row-${gi}-${i}`).join(' ')} onClick={() => setShut((x) => ({ ...x, [g]: !x[g] }))}>
                      <span>{g}</span>
                      <Icon name="chevronDown" size={20} className={`cfg__groupchev ${shut[g] ? 'is-shut' : ''}`} />
                    </button>
                  </th>
                </tr>
                {OBJECTS.slice(a, b).map((o, i) => (
                  <tr key={o} id={`pr-row-${gi}-${i}`} hidden={!!shut[g]} className={draft && draft[o][role] !== cfg.perms[o][role] ? 'is-changed' : ''}>
                    <td>{o}</td>
                    <td className="cfg__levelcell">
                      {fixed ? (
                        <span className="cfg__lv cfg__lv--E">View and Edit</span>
                      ) : draft ? (
                        <SelectInput id={`pr-${o}`} aria-label={`${role}: ${o}`} value={perms[o][role]} onChange={(e) => setDraft((d) => ({ ...d!, [o]: { ...d![o], [role]: e.target.value as Level } }))}>
                          {LEVELS.map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </SelectInput>
                      ) : (
                        <span className={`cfg__lv cfg__lv--${perms[o][role]}`}>{LEVEL_NAME[perms[o][role]]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Permission roles" />
    </>
  );
}
