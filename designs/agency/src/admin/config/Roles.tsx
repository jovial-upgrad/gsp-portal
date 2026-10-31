import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { MoreMenu } from '../../components/MoreMenu';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { MultiPick } from '../../institution/records/MultiPick';
import { PageHead } from '../../institution/records/parts';
import { LEVELS, OBJECTS, REGION_COUNTRIES, ROLES, type Level, type Queue, type Region, type User } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History, Panel } from './parts';

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
      <PageHead title="Sales regions" lead="Internal sales regions. A GSP user belongs to one, or to Global; so does an RP. Each region has its Admissions contact, whom its recruitment partners see on every page.">
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
                <th scope="col">Countries</th>
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
                    <td className="cfg__strong">{r.name}</td>
                    <td className="cfg__muted">{(REGION_COUNTRIES[r.name] ?? [r.name]).join(', ')}</td>
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
      <History log={cfg.log} area="Sales regions" />
      <RegionDialog
        open={!!edit}
        region={edit === 'new' ? null : edit}
        regions={cfg.regions}
        onClose={() => setEdit(null)}
        onSave={(r) => {
          const was = edit === 'new' ? null : edit;
          if (!was) {
            change('Sales regions', `Added ${r.name}${r.contact ? `, Admissions contact ${r.contact}` : ''}`, (c) => {
              const at = c.regions.findIndex((x) => x.name === 'Global');
              return { ...c, regions: [...c.regions.slice(0, at), r, ...c.regions.slice(at)] };
            });
            say(`${r.name} added.`);
          } else {
            const renamed = was.name !== r.name;
            change('Sales regions', renamed ? `Renamed ${was.name} to ${r.name}` : `${r.name}: Admissions contact → ${r.contact || 'Not set'}`, (c) => ({
              ...c,
              regions: c.regions.map((x) => (x.name === was.name ? r : x)),
              users: renamed ? c.users.map((u) => (u.region === was.name ? { ...u, region: r.name } : u)) : c.users,
            }));
            say(`${r.name} saved.${renamed ? ' Its users moved with it.' : ''}`);
          }
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}?`}
        confirm="Delete"
        cancel="Keep"
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
function RegionDialog({ open, region, regions, onClose, onSave }: { open: boolean; region: Region | null; regions: Region[]; onClose: () => void; onSave: (r: Region) => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(region?.name ?? '');
    setContact(region?.contact ?? '');
    setTried(false);
  }, [open, region?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = name.trim();
  const err = v.length < 2 ? 'Name the region, like Middle East.' : regions.some((r) => r.name !== region?.name && r.name.toLowerCase() === v.toLowerCase()) ? 'There’s already a region with this name.' : null;
  const save = () => {
    setTried(true);
    if (!err) onSave({ name: v, contact: contact.trim() });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={region ? `Edit ${region.name}` : 'Add sales region'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{region ? 'Save' : 'Add sales region'}</Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="rg-name" label="Sales region" required error={tried ? err : null}>
          <TextInput id="rg-name" value={name} invalid={tried && !!err} placeholder="Like: Middle East" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="rg-contact" label="Admissions contact" optional hint="Its recruitment partners see this person on every page.">
          <TextInput id="rg-contact" value={contact} placeholder="Not set" onChange={(e) => setContact(e.target.value)} />
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
 * Permission roles (PM: Settings › Permissions, decided 25 Oct): what each role can do with each object, from No
 * access to Manage. Pick a role to change its column; every role side by side to compare. Super Admin manages all.
 */
export function Permissions({ cfg, change, say }: ConfigProps) {
  const [role, setRole] = useState<string>(ROLES[0]);
  const [all, setAll] = useState(false);
  const fixed = role === 'Super Admin';
  return (
    <>
      <PageHead
        title="Permission roles"
        lead="What each role can see and change. Every GSP role gets the same menu and screens; a role sees only what it has access to, and View means no changes. RPs see only their own records. Super Admin can do everything."
      >
        <Button variant="secondary" iconLeft={<Icon name={all ? 'user' : 'people'} size={16} />} onClick={() => setAll((x) => !x)}>
          {all ? 'One role at a time' : 'Every role side by side'}
        </Button>
      </PageHead>
      {!all && (
        <div className="cfg__roles" role="group" aria-label="Permission role">
          {ROLES.map((r) => (
            <button key={r} type="button" className="ichip" aria-pressed={role === r} onClick={() => setRole(r)}>
              {r}
            </button>
          ))}
        </div>
      )}
      <Panel flush note={!all ? (fixed ? 'Super Admin manages everything; it can’t be changed.' : `Change a level to change it for everyone with the ${role} role, at once. Scope (sales region, recruitment partner, branch) still limits which records they see.`) : undefined} title={all ? undefined : role}>
        <div className="stab-wrap">
          <table className={`itab cfg__tab ${all ? 'cfg__matrix' : ''}`}>
            <thead>
              <tr>
                <th scope="col">What</th>
                {all ? (
                  ROLES.map((r) => (
                    <th key={r} scope="col" className="cfg__rot">
                      <span>{r}</span>
                    </th>
                  ))
                ) : (
                  <th scope="col">Access</th>
                )}
              </tr>
            </thead>
            {GROUPS.map(([g, a, b]) => (
              <tbody key={g}>
                <tr className="cfg__grouprow">
                  <th scope="rowgroup" colSpan={all ? ROLES.length + 1 : 2}>
                    {g}
                  </th>
                </tr>
                {OBJECTS.slice(a, b).map((o) => (
                  <tr key={o}>
                    <td>{o}</td>
                    {all ? (
                      ROLES.map((r) => (
                        <td key={r} className="cfg__lvl">
                          <span className={`cfg__lv cfg__lv--${cfg.perms[o][r]}`} title={`${r}: ${LEVEL_NAME[cfg.perms[o][r]]}`}>
                            {cfg.perms[o][r]}
                          </span>
                        </td>
                      ))
                    ) : (
                      <td className="cfg__levelcell">
                        {fixed ? (
                          <span className="cfg__lv cfg__lv--M">Manage</span>
                        ) : (
                          <SelectInput
                            id={`pr-${o}`}
                            aria-label={`${role}: ${o}`}
                            value={cfg.perms[o][role]}
                            onChange={(e) => {
                              const l = e.target.value as Level;
                              change('Permission roles', `${role}: ${o} → ${LEVEL_NAME[l]}`, (c) => ({ ...c, perms: { ...c.perms, [o]: { ...c.perms[o], [role]: l } } }));
                              say(`${role}: ${o} → ${LEVEL_NAME[l]}. Applies on their next page load.`);
                            }}
                          >
                            {LEVELS.map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </SelectInput>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        {all && (
          <p className="cfg__legend">
            {LEVELS.map(([k, label]) => (
              <span key={k}>
                <span className={`cfg__lv cfg__lv--${k}`}>{k}</span> {label}
              </span>
            ))}
          </p>
        )}
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
                        <>
                          <span className="cfg__strong">{lead.name}</span>
                          <span className="cfg__sub">{lead.title || lead.role}</span>
                        </>
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
        confirm="Delete"
        cancel="Keep"
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
                {u.name} · {u.role}
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
