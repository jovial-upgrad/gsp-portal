import { useEffect, useRef, useState } from 'react';
import { useCheck, dupError } from '../../components/validate';
import { leave, useUnsaved } from '../../components/unsaved';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { MoreMenu } from '../../components/MoreMenu';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { MultiPick } from '../../institution/records/MultiPick';
import { PageHead } from '../../institution/records/parts';
import { LEVELS, OBJECTS, REGION_MEANS, ROLES, type Level, type Queue, type Region, type User } from '../data/config';
import { COUNTRIES } from '../../data/partners';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';

/**
 * Sales regions (PM: Settings › Sales regions, with Admissions contacts; Nesil, 30 Oct: add, edit and delete): GSP's
 * internal regions, the countries in each, and its Admissions contact. Global stays; a region that's deleted leaves
 * its users with no region until they're given one.
 */
export function Regions({ cfg, change, say }: ConfigProps) {
  const [edit, setEdit] = useState<Region | 'new' | null>(null);
  const [removing, setRemoving] = useState<Region | null>(null);
  const usersIn = (r: string) => cfg.users.filter((u) => u.region === r).length;
  return (
    <>
      <PageHead title="Sales regions" lead="Internal sales regions. A GSP user belongs to one, or to Global; so does an RP. Every region has an Admissions contact, whom its recruitment partners see on every page.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
          Add sales region
        </Button>
      </PageHead>
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Sales region</th>
                <th scope="col">Admissions contact</th>
                <th scope="col">Users</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.regions.map((r) => {
                const fixed = r.name === 'Global';
                return (
                  <tr key={r.name}>
                    <td className="cfg__strong">
                      {r.name}
                      <span className="cfg__sub">{r.countries?.length ? (r.countries.length === 1 && r.countries[0] === r.name ? 'The country itself' : `${r.countries.length} countries: ${r.countries.slice(0, 4).join(', ')}${r.countries.length > 4 ? '…' : ''}`) : REGION_MEANS[r.name] ?? 'No countries yet'}</span>
                    </td>
                    <td>{fixed ? <span className="cfg__muted">–</span> : r.contact || <span className="cfg__muted">Not set</span>}</td>
                    <td className="num">{usersIn(r.name)}</td>
                    <td className="cfg__acts">
                      {!fixed && (
                        <MoreMenu
                          id={`rg-${r.name}`}
                          label={`More for ${r.name}`}
                          items={[
                            { id: 'edit', label: 'Edit sales region', icon: 'edit', onPick: () => setEdit(r) },
                            { id: 'remove', label: 'Delete sales region', icon: 'close', danger: true, onPick: () => setRemoving(r) },
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
      <NationalityMap cfg={cfg} change={change} say={say} />
      <History log={cfg.log} area="Sales regions" />
      <RegionDialog
        open={!!edit}
        region={edit === 'new' ? null : edit}
        regions={cfg.regions}
        contacts={cfg.users.filter((u) => (u.role === 'Admission' || u.role === 'Global Ops') && u.status !== 'Deactivated').map((u) => u.name)}
        onClose={() => setEdit(null)}
        onSave={(r) => {
          const was = edit === 'new' ? null : edit;
          if (!was) {
            change('Sales regions', `Added ${r.name}${r.contact ? `, Admissions contact ${r.contact}` : ''}`, (c) => {
              const at = c.regions.findIndex((x) => x.name === 'Global');
              return { ...c, regions: [...c.regions.slice(0, at), r, ...c.regions.slice(at)] };
            });
            say(`Sales region added: ${r.name}.`);
          } else {
            const renamed = was.name !== r.name;
            const re = (x: string) => (x === was.name ? r.name : x);
            const rekey = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).map(([k, x]) => [re(k), x]));
            const what = renamed ? `Renamed ${was.name} to ${r.name}` : JSON.stringify(was.countries) !== JSON.stringify(r.countries) ? `${r.name}: countries → ${r.countries.join(', ') || 'none'}` : `${r.name}: Admissions contact → ${r.contact || 'Not set'}`;
            change('Sales regions', what, (c) => ({
              ...c,
              regions: c.regions.map((x) => (x.name === was.name ? r : x)),
              users: renamed ? c.users.map((u) => (u.region === was.name ? { ...u, region: r.name, regions: u.regions.map(re) } : u)) : c.users,
              // a renamed region keeps its nationalities, lists, BDM and queue
              nationality: renamed ? Object.fromEntries(Object.entries(c.nationality).map(([k, x]) => [k, re(x)])) : c.nationality,
              lists: renamed ? rekey(c.lists) : c.lists,
              regionBdm: renamed ? rekey(c.regionBdm) : c.regionBdm,
              regionQueue: renamed ? rekey(c.regionQueue) : c.regionQueue,
            }));
            say(`Sales region saved.${renamed ? ' Its users moved with it.' : ''}`);
          }
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}?`}
        confirm="Delete sales region"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing!;
          change('Sales regions', `Deleted ${r.name}`, (c) => ({ ...c, regions: c.regions.filter((x) => x.name !== r.name), users: c.users.map((u) => (u.region === r.name ? { ...u, region: '' } : u)) }));
          say(`${r.name} deleted.`);
          setRemoving(null);
        }}
      >
        <p>{removing && (usersIn(removing.name) ? `${usersIn(removing.name)} ${usersIn(removing.name) === 1 ? 'user is' : 'users are'} in it; they’ll have no sales region until you give them one in Create roles.` : 'Nobody is in it.')}</p>
      </ConfirmDialog>
    </>
  );
}

/** Add or edit a sales region: its name and its Admissions contact. */
function RegionDialog({ open, region, regions, contacts, onClose, onSave }: { open: boolean; region: Region | null; regions: Region[]; contacts: string[]; onClose: () => void; onSave: (r: Region) => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const v = name.trim();
  const c = useCheck({
    name: v.length < 2 ? 'Enter the sales region’s name, like Middle East.' : dupError(v, regions.filter((r) => r.name !== region?.name).map((r) => r.name), 'There’s already a sales region with this name.'),
    contact: !contact ? 'Choose its Admissions contact.' : null,
  });
  useEffect(() => {
    if (!open) return;
    setName(region?.name ?? '');
    setContact(region?.contact ?? '');
    setCountries(region?.countries ?? []);
    c.reset();
  }, [open, region?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  // QC, 1 Nov: Save waits for a change; closing with one asks first
  const dirty = name !== (region?.name ?? '') || contact !== (region?.contact ?? '') || JSON.stringify(countries) !== JSON.stringify(region?.countries ?? []);
  const save = () => {
    if (c.submit()) onSave({ name: v, contact, countries });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      what={region ? region.name : 'the new sales region'}
      center
      className="iform cfg__sheet"
      title={region ? `Edit ${region.name}` : 'Add sales region'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!!region && !dirty}>
              {region ? 'Save' : 'Add sales region'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="rg-name" label="Sales region" required error={c.err('name')}>
          <TextInput id="rg-name" value={name} placeholder="Like: Middle East" onBlur={c.blur('name')} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="rg-contact" label="Admissions contact" required error={c.err('contact')} hint="Its recruitment partners see this person on every page.">
          <SelectInput id="rg-contact" value={contact} placeholder="Choose" onBlur={c.blur('contact')} onChange={(e) => setContact(e.target.value)}>
            {[...new Set([...contacts, contact].filter(Boolean))].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </SelectInput>
        </Field>
        <MultiPick id="rg-countries" label="Countries in it" value={countries} options={COUNTRIES.map((x) => x.name)} empty={REGION_MEANS[v] ?? 'No countries'} search onChange={setCountries} />
        <p className="cfg__note">Every list of countries by sales region reads these: country pickers, BDM assignment and the RP records. A student’s nationality is mapped below, on its own.</p>
      </div>
    </Sheet>
  );
}

/**
 * Nationality to sales region (Jovial, 1 Nov, HC42): which sales region a student's nationality routes to
 * (Application routing's nationality rule, and every country's region in data/regions.ts). Edit, then Save.
 */
function NationalityMap({ cfg, change, say }: Pick<ConfigProps, 'cfg' | 'change' | 'say'>) {
  const d = useDraft(cfg.nationality, 'the nationality map');
  const [q, setQ] = useState('');
  const [add, setAdd] = useState({ country: '', region: '' });
  const map = d.value;
  const names = cfg.regions.filter((r) => r.name !== 'Global').map((r) => r.name);
  const t = q.trim().toLowerCase();
  const rows = Object.entries(map).filter(([k, x]) => !t || k.toLowerCase().includes(t) || x.toLowerCase().includes(t)).sort(([a], [b]) => a.localeCompare(b));
  const free = COUNTRIES.map((x) => x.name).filter((x) => !(x in map));
  return (
    <Panel
      flush
      title="Nationality to sales region"
      note={`${Object.keys(map).length} nationalities mapped. Application routing’s nationality rule reads this; a nationality not in it goes to Rest of world.`}
      action={
        <EditBar
          editing={d.editing}
          dirty={d.dirty}
          name="nationality map"
          onEdit={d.start}
          onCancel={d.stop}
          onSave={() => {
            const n = Object.keys(map).length;
            change('Sales regions', `Saved the nationality map (${n} nationalities)`, (c) => ({ ...c, nationality: map }));
            say('Nationality map saved. New applications route by it.');
            d.stop();
          }}
        />
      }
    >
      <div className="stools">
        <div className="stools__row">
          <TextInput id="nm-q" aria-label="Search nationalities" placeholder="Search a nationality or region" value={q} onChange={(e) => setQ(e.target.value)} />
          {d.editing && (
            <>
              <SelectInput id="nm-add-c" aria-label="Nationality to add" value={add.country} placeholder="Nationality to add" onChange={(e) => setAdd({ ...add, country: e.target.value })}>
                {free.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </SelectInput>
              <SelectInput id="nm-add-r" aria-label="Its sales region" value={add.region} placeholder="Sales region" onChange={(e) => setAdd({ ...add, region: e.target.value })}>
                {names.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </SelectInput>
              <Button
                variant="secondary"
                disabled={!add.country || !add.region}
                onClick={() => {
                  d.set((m) => ({ ...m, [add.country]: add.region }));
                  setAdd({ country: '', region: '' });
                }}
              >
                Add
              </Button>
            </>
          )}
        </div>
        <p className="stools__count" role="status">
          <span className="num">{rows.length}</span> shown
        </p>
      </div>
      <div className="stab-wrap cfg__scroll">
        <table className="itab cfg__tab">
          <thead>
            <tr>
              <th scope="col">Nationality</th>
              <th scope="col">Sales region</th>
              {d.editing && (
                <th scope="col">
                  <span className="vh">Remove</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, x]) => (
              <tr key={k}>
                <td className="cfg__strong">{k}</td>
                <td>
                  {d.editing ? (
                    <SelectInput id={`nm-${k}`} aria-label={`${k}: sales region`} value={x} onChange={(e) => d.set((m) => ({ ...m, [k]: e.target.value }))}>
                      {[...new Set([...names, x])].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </SelectInput>
                  ) : (
                    x
                  )}
                </td>
                {d.editing && (
                  <td className="cfg__acts">
                    <Button
                      variant="link"
                      aria-label={`Remove ${k}`}
                      onClick={() =>
                        d.set((m) => {
                          const next = { ...m };
                          delete next[k];
                          return next;
                        })
                      }
                    >
                      Remove
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const GROUPS: [string, number, number][] = [
  ['Students and applications', 0, 6],
  ['Recruitment partners', 6, 11],
  ['Institutions and courses', 11, 20],
  ['Commissions', 20, 25],
  ['GSP', 25, 29],
  ['Work', 29, 33],
];
const LEVEL_NAME = Object.fromEntries(LEVELS) as Record<Level, string>;

/**
 * Permission roles (Jovial, 31 Oct): GSP's nine roles. Pick a role, pick what it's about, and choose No access, View
 * or View + edit; the role's whole list is below, and picking a line there fills the form. Admin can do everything.
 * Scope (sales region, recruitment partner, branch) still limits which records a person sees.
 */
export function Permissions({ cfg, change, say }: ConfigProps) {
  const [role, setRole] = useState<string>('Admission');
  const [obj, setObj] = useState<string>(OBJECTS[0]);
  const [lvl, setLvl] = useState<Level>(cfg.perms[OBJECTS[0]]?.['Admission'] ?? 'N');
  const fixed = role === 'Admin';
  const current = cfg.perms[obj]?.[role] ?? 'N';
  // QC, 1 Nov: an access level picked but not saved is a change; leaving it, or picking another line, asks first
  const dirty = !fixed && lvl !== current;
  const form = useRef<HTMLDivElement>(null);
  useUnsaved(dirty, dirty, { onDiscard: () => setLvl(current), region: form, what: `${role}’s access to ${obj}`, esc: false });
  const pick = (r: string, o: string) =>
    leave(() => {
      setRole(r);
      setObj(o);
      setLvl(cfg.perms[o]?.[r] ?? 'N');
    });
  return (
    <>
      <PageHead title="Permission roles" lead="What each role can see and change. A role sees only what it has access to; View means it can’t change anything. Admin can do everything." />
      <Panel title="Change access">
        <div className="cfg__permform" ref={form}>
          <Field id="pm-role" label="Role" required>
            <SelectInput id="pm-role" value={role} onChange={(e) => pick(e.target.value, obj)}>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </SelectInput>
          </Field>
          <Field id="pm-obj" label="What" required>
            <SelectInput id="pm-obj" value={obj} onChange={(e) => pick(role, e.target.value)}>
              {GROUPS.map(([g, a, b]) => (
                <optgroup key={g} label={g}>
                  {OBJECTS.slice(a, b).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </optgroup>
              ))}
            </SelectInput>
          </Field>
          <fieldset className="cfg__radios cfg__levels" disabled={fixed}>
            <legend>Access</legend>
            {LEVELS.map(([k, label]) => (
              <label key={k} className="cfg__radio">
                <input type="radio" name="pm-level" checked={(fixed ? 'E' : lvl) === k} onChange={() => setLvl(k)} />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="cfg__permsave">
            {fixed ? (
              <span className="cfg__muted">Admin has every access; it can’t be changed.</span>
            ) : (
              <Button
                disabled={lvl === current}
                onClick={() => {
                  change('Permission roles', `${role}: ${obj} → ${LEVEL_NAME[lvl]}`, (c) => ({ ...c, perms: { ...c.perms, [obj]: { ...c.perms[obj], [role]: lvl } } }));
                  say(`Access saved: ${role}, ${obj} → ${LEVEL_NAME[lvl]}. It applies on their next page load.`);
                }}
              >
                Save
              </Button>
            )}
          </div>
        </div>
      </Panel>
      <Panel flush title={`${role}’s access`} note="Pick a line to change it above.">
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__click">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Access</th>
              </tr>
            </thead>
            {GROUPS.map(([g, a, b]) => (
              <tbody key={g}>
                <tr className="cfg__grouprow">
                  <th scope="rowgroup" colSpan={2}>
                    {g}
                  </th>
                </tr>
                {OBJECTS.slice(a, b).map((o) => {
                  const l = fixed ? 'E' : cfg.perms[o]?.[role] ?? 'N';
                  return (
                    <tr key={o} aria-selected={o === obj} className={o === obj ? 'is-picked' : undefined} onClick={() => pick(role, o)}>
                      <td>
                        <button type="button" className="cfg__rowlink" onClick={(e) => (e.stopPropagation(), pick(role, o))}>
                          {o}
                        </button>
                      </td>
                      <td>
                        <span className={`cfg__lv cfg__lv--${l}`}>{LEVEL_NAME[l]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Permission roles" />
    </>
  );
}

/**
 * Queues (Nesil, 30 Oct, from the PM's queues): each queue has a name, one leader and its members. Create a queue
 * with a leader picked from GSP's users and its members picked from a list; edit or delete it.
 */
export function Queues({ cfg, change, say }: ConfigProps) {
  const [edit, setEdit] = useState<Queue | 'new' | null>(null);
  const [removing, setRemoving] = useState<Queue | null>(null);
  const who = (id: string) => cfg.users.find((u) => u.id === id);
  return (
    <>
      <PageHead title="Queues" lead="A queue is a team’s inbox: work lands in it, its members pick it up, and its leader keeps it moving and covers when someone’s away.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
          Create queue
        </Button>
      </PageHead>
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Queue name</th>
                <th scope="col">Queue leader</th>
                <th scope="col">Queue members</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.queues.map((q) => {
                const lead = who(q.lead);
                const members = q.members.map(who).filter((u): u is NonNullable<typeof u> => !!u);
                return (
                  <tr key={q.id}>
                    <td className="cfg__strong">{q.name}</td>
                    <td>
                      {lead ? (
                        <span className="cfg__strong">{lead.name}</span>
                      ) : (
                        <span className="cfg__warn">No leader</span>
                      )}
                    </td>
                    <td>
                      {members.length ? (
                        <div className="cfg__chips">
                          {members.map((m) => (
                            <span key={m.id} className="cfg__chip cfg__chip--plain">
                              {m.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="cfg__muted">Just the leader</span>
                      )}
                    </td>
                    <td className="cfg__acts">
                      <MoreMenu
                        id={`qu-${q.id}`}
                        label={`More for ${q.name}`}
                        items={[
                          { id: 'edit', label: 'Edit queue', icon: 'edit', onPick: () => setEdit(q) },
                          { id: 'remove', label: 'Delete queue', icon: 'close', danger: true, onPick: () => setRemoving(q) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Queues" />
      <QueueDialog
        open={!!edit}
        queue={edit === 'new' ? null : edit}
        queues={cfg.queues}
        users={cfg.users}
        onClose={() => setEdit(null)}
        onSave={(q) => {
          const isNew = !cfg.queues.some((x) => x.id === q.id);
          const lead = who(q.lead)?.name ?? '';
          change('Queues', `${isNew ? 'Created' : 'Edited'} ${q.name}: leader ${lead}, ${q.members.length} ${q.members.length === 1 ? 'member' : 'members'}`, (c) => ({ ...c, queues: isNew ? [...c.queues, q] : c.queues.map((x) => (x.id === q.id ? q : x)) }));
          say(`${q.name} ${isNew ? 'created' : 'saved'}.`);
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}?`}
        confirm="Delete queue"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const q = removing!;
          change('Queues', `Deleted ${q.name}`, (c) => ({ ...c, queues: c.queues.filter((x) => x.id !== q.id) }));
          say(`${q.name} deleted.`);
          setRemoving(null);
        }}
      >
        <p>Work in it goes back to whoever it was assigned to; new work stops landing in it.</p>
      </ConfirmDialog>
    </>
  );
}

/** Create or edit a queue: its name, one leader (a single pick) and its members (several). */
function QueueDialog({ open, queue, queues, users, onClose, onSave }: { open: boolean; queue: Queue | null; queues: Queue[]; users: User[]; onClose: () => void; onSave: (q: Queue) => void }) {
  const [name, setName] = useState('');
  const [lead, setLead] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(queue?.name ?? '');
    setLead(queue?.lead ?? '');
    setMembers((queue?.members ?? []).map((id) => users.find((u) => u.id === id)?.name ?? '').filter(Boolean));
    setTried(false);
  }, [open, queue?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = name.trim();
  const leadName = users.find((u) => u.id === lead)?.name;
  const err = {
    name: v.length < 2 ? 'Name the queue, like India Admissions.' : queues.some((q) => q.id !== queue?.id && q.name.toLowerCase() === v.toLowerCase()) ? 'There’s already a queue with this name.' : null,
    lead: !lead ? 'Pick the queue leader.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const ids = members.filter((n) => n !== leadName).map((n) => users.find((u) => u.name === n)?.id).filter((x): x is string => !!x);
    onSave({ id: queue?.id ?? `q${Date.now()}`, name: v, lead, members: ids });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={queue ? `Edit ${queue.name}` : 'Create queue'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{queue ? 'Save' : 'Create queue'}</Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="qu-name" label="Queue name" required error={show('name')}>
          <TextInput id="qu-name" value={name} invalid={!!show('name')} placeholder="Like: India Admissions" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="qu-lead" label="Queue leader" required error={show('lead')}>
          <SelectInput id="qu-lead" value={lead} placeholder="Choose one person" invalid={!!show('lead')} onChange={(e) => setLead(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="qu-members" label="Queue members" optional hint="Pick as many as you need. The leader is in the queue anyway.">
          <MultiPick id="qu-members" label="Queue members" value={members} options={users.filter((u) => u.id !== lead).map((u) => u.name)} onChange={setMembers} empty="Choose members" search />
        </Field>
      </div>
    </Sheet>
  );
}
