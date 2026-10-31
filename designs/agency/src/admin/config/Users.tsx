import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreMenu } from '../../components/MoreMenu';
import { PhoneInput } from '../../components/PhoneInput';
import { Field, SelectInput, TextInput, describedBy } from '../../components/forms';
import { NoMatch, PageHead, downloadCsv } from '../../institution/records/parts';
import { GSP_ROLES, type GspRole, type User, type UserStatus } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History } from './parts';

const STATUSES: UserStatus[] = ['Link sent', 'Active', 'Deactivated'];
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const ago = (at?: number) => {
  if (!at) return '';
  const d = Math.floor((Date.now() - at) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

/**
 * Create roles (Nesil, 30 Oct): GSP's people and their roles. Create a role with someone's name, email, phone with
 * the country code, role (Admin, Recruitment, Recruitment Ops, Admission, Admission Ops, Institution, Institution Ops
 * or Finance), title and sales region; Send login link emails them a link to set their password. The list filters by
 * a search, role, sales region and login, exports as CSV, and each role can be edited or deleted.
 */
export function Users({ cfg, change, say }: ConfigProps) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('');
  const [edit, setEdit] = useState<User | 'new' | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const t = q.trim().toLowerCase();
  const rows = cfg.users.filter(
    (u) => (!t || [u.name, u.email, u.title, u.phone].some((x) => x.toLowerCase().includes(t))) && (!role || u.role === role) && (!region || u.region === region) && (!status || u.status === status),
  );
  const clear = () => {
    setQ('');
    setRole('');
    setRegion('');
    setStatus('');
  };
  const send = (u: User) => {
    change('Create roles', `Sent a login email to ${u.name} (${u.email})`, (c) => ({ ...c, users: c.users.map((x) => (x.id === u.id ? { ...x, status: x.status === 'Active' ? 'Active' : 'Link sent', sentAt: Date.now() } : x)) }));
    say(`Login email sent to ${u.email}. The link works for 7 days.`);
  };
  /* Jovial, 31 Oct: deactivate (they can't sign in; they stay on record) or activate again. */
  const setActive = (u: User, on: boolean) => {
    change('Create roles', `${on ? 'Activated' : 'Deactivated'} ${u.name}`, (c) => ({ ...c, users: c.users.map((x) => (x.id === u.id ? { ...x, status: on ? 'Link sent' : 'Deactivated', sentAt: on ? Date.now() : x.sentAt } : x)) }));
    say(on ? `${u.name} is active again. A new login email went to ${u.email}.` : `${u.name} is deactivated and can’t sign in. They stay in queues and email groups until you change them.`);
  };
  return (
    <>
      <PageHead title="Create roles" lead="GSP’s people and their roles. Create a role for someone, then send them a login link to set their password and sign in.">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            downloadCsv('gsp-users.csv', [['Name', 'Email', 'Phone', 'Role', 'Title', 'Sales region', 'Login'], ...rows.map((u) => [u.name, u.email, `${u.dial} ${u.phone}`, u.role, u.title, u.region, u.status])]);
            change('Create roles', `Exported ${rows.length} users as CSV`, (c) => c);
            say(`${rows.length} users exported as CSV.`);
          }}
        >
          Export as CSV
        </Button>
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
          Create user
        </Button>
      </PageHead>

      <section className="card stable" aria-labelledby="usf-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search users</span>
              <input id="usf-q" type="search" placeholder="Name, email, title or phone" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <SelectInput id="usf-role" aria-label="Role" value={role} placeholder="All roles" allowEmpty onChange={(e) => setRole(e.target.value)}>
              {GSP_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </SelectInput>
            <SelectInput id="usf-region" aria-label="Sales region" value={region} placeholder="All sales regions" allowEmpty onChange={(e) => setRegion(e.target.value)}>
              {cfg.regions.map((r) => (
                <option key={r.name}>{r.name}</option>
              ))}
            </SelectInput>
            <SelectInput id="usf-status" aria-label="Login" value={status} placeholder="Any login" allowEmpty onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SelectInput>
          </div>
          <p className="stools__count" id="usf-count" role="status">
            <span>
              <span className="num">{rows.length === cfg.users.length ? cfg.users.length : `${rows.length} of ${cfg.users.length}`}</span> users
            </span>
            {rows.length !== cfg.users.length && (
              <button type="button" className="cfg__linkbtn" onClick={clear}>
                Clear filters
              </button>
            )}
          </p>
        </div>
        {rows.length === 0 ? (
          <NoMatch what="users" onClear={clear} />
        ) : (
          <div className="stab-wrap">
            <table className="itab cfg__tab">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Role</th>
                  <th scope="col">Title</th>
                  <th scope="col">Sales region</th>
                  <th scope="col">Login</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className={u.status === 'Deactivated' ? 'is-off' : undefined}>
                    <td>
                      <span className="cfg__strong">{u.name}</span>
                      <span className="cfg__sub">{u.email}</span>
                    </td>
                    <td className="cfg__muted num cfg__nowrap">
                      {u.dial} {u.phone}
                    </td>
                    <td>{u.role}</td>
                    <td className="cfg__muted">{u.title || '–'}</td>
                    <td className="cfg__muted">{u.region || 'Not set'}</td>
                    <td>
                      <span className={`cfg__login cfg__login--${u.status.replace(' ', '-').toLowerCase()}`}>{u.status}</span>
                      {u.status === 'Link sent' && <span className="cfg__sub">Sent {ago(u.sentAt)}</span>}
                    </td>
                    <td className="cfg__acts">
                      <span className="cfg__rowacts">
                        {u.status !== 'Deactivated' && (
                          <Button variant="secondary" size="sm" iconLeft={<Icon name="mail" size={16} />} onClick={() => send(u)}>
                            Resend login email
                          </Button>
                        )}
                        <MoreMenu
                          id={`us-${u.id}`}
                          label={`More for ${u.name}`}
                          items={[
                            { id: 'edit', label: 'Edit role', icon: 'edit', onPick: () => setEdit(u) },
                            ...(u.status === 'Deactivated'
                              ? [{ id: 'activate', label: 'Activate', icon: 'check' as const, onPick: () => setActive(u, true) }]
                              : u.role === 'Admin' && cfg.users.filter((x) => x.role === 'Admin' && x.status !== 'Deactivated').length === 1
                                ? []
                                : [{ id: 'deactivate', label: 'Deactivate', icon: 'lock' as const, onPick: () => setActive(u, false) }]),
                            ...(u.role === 'Admin' && cfg.users.filter((x) => x.role === 'Admin').length === 1 ? [] : [{ id: 'remove', label: 'Delete role', icon: 'close' as const, danger: true, onPick: () => setRemoving(u) }]),
                          ]}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <History log={cfg.log} area="Create roles" />

      <UserDialog
        open={!!edit}
        user={edit === 'new' ? null : edit}
        users={cfg.users}
        regions={cfg.regions.map((r) => r.name)}
        onClose={() => setEdit(null)}
        onSave={(u) => {
          const isNew = !cfg.users.some((x) => x.id === u.id);
          const next: User = isNew ? { ...u, status: 'Link sent', sentAt: Date.now() } : u;
          change('Create roles', `${isNew ? 'Created' : 'Edited'} ${u.name}: ${u.role}, ${u.region}${isNew ? ', and sent a login email' : ''}`, (c) => ({ ...c, users: isNew ? [next, ...c.users] : c.users.map((x) => (x.id === u.id ? next : x)) }));
          say(isNew ? `${u.name} created. A login email went to ${u.email}; the link works for 7 days.` : `${u.name} saved.`);
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}’s role?`}
        confirm="Delete"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const u = removing!;
          change('Create roles', `Deleted ${u.name} (${u.role})`, (c) => ({
            ...c,
            users: c.users.filter((x) => x.id !== u.id),
            queues: c.queues.map((q) => ({ ...q, lead: q.lead === u.id ? '' : q.lead, members: q.members.filter((m) => m !== u.id) })),
            emails: c.emails.map((g) => ({ ...g, users: g.users.filter((x) => x.id !== u.id) })),
          }));
          say(`${u.name} removed.`);
          setRemoving(null);
        }}
      >
        <p>They can no longer sign in, and come off every queue and email group they’re in. What they did stays in the log.</p>
      </ConfirmDialog>
    </>
  );
}

/** Create or edit a role: name, email, phone with the country code, role, title and sales region. */
function UserDialog({ open, user, users, regions, onClose, onSave }: { open: boolean; user: User | null; users: User[]; regions: string[]; onClose: () => void; onSave: (u: User) => void }) {
  const blank = (): User => ({ id: `u${Date.now()}`, name: '', email: '', dial: '+91', phone: '', role: 'Admission', title: '', region: '', status: 'Not sent' });
  const [v, setV] = useState<User>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(user ?? blank());
    setTried(false);
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<User>) => setV((x) => ({ ...x, ...p }));
  const email = v.email.trim().toLowerCase();
  const err = {
    name: v.name.trim().length < 2 ? 'Enter their full name.' : null,
    email: !isEmail(email) ? 'Enter their email, like name@gsp.upgrad.com.' : users.some((x) => x.id !== v.id && x.email.toLowerCase() === email) ? 'Someone already has this email.' : null,
    phone: v.phone.replace(/\D/g, '').length < 7 ? 'Enter their phone number.' : null,
    region: !v.region ? 'Pick their sales region.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ ...v, name: v.name.trim(), email, title: v.title.trim() });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={user ? `Edit ${user.name}’s role` : 'Create a user'}
      sub={user ? undefined : 'They get a login email straight away, to set their password and sign in.'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{user ? 'Save' : 'Create user'}</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="us-name" label="Name" required error={show('name')}>
          <TextInput id="us-name" value={v.name} invalid={!!show('name')} aria-describedby={describedBy('us-name', show('name'))} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="us-email" label="Email" required error={show('email')}>
          <TextInput id="us-email" type="email" value={v.email} invalid={!!show('email')} aria-describedby={describedBy('us-email', show('email'))} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field id="us-phone" label="Phone number" required error={show('phone')}>
          <PhoneInput id="us-phone" dial={v.dial} number={v.phone} invalid={!!show('phone')} describedBy={describedBy('us-phone', show('phone'))} onDial={(d) => set({ dial: d })} onNumber={(n) => set({ phone: n })} />
        </Field>
        <Field id="us-title" label="Title" optional>
          <TextInput id="us-title" value={v.title} placeholder="Like: Admissions Officer" onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field id="us-role" label="Role" required>
          <SelectInput id="us-role" value={v.role} onChange={(e) => set({ role: e.target.value as GspRole })}>
            {GSP_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="us-region" label="Sales region" required error={show('region')}>
          <SelectInput id="us-region" value={v.region} placeholder="Choose" invalid={!!show('region')} onChange={(e) => set({ region: e.target.value })}>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}

