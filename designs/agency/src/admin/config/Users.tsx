import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreMenu, type MenuItem } from '../../components/MoreMenu';
import { MultiPick } from '../../components/MultiPick';
import { PhoneInput } from '../../components/PhoneInput';
import { Field, SelectInput, TextInput, describedBy } from '../../components/forms';
import { NoMatch, PageHead, downloadCsv } from '../../institution/records/parts';
import { GSP_ROLES, type GspRole, type User, type UserStatus } from '../data/config';
import type { Cfg, ConfigProps } from './ConfigPage';
import { History, Pager, usePaged } from './parts';

const STATUSES: UserStatus[] = ['Not sent', 'Link sent', 'Active', 'Deactivated'];
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const ago = (at?: number) => {
  if (!at) return '';
  const d = Math.floor((Date.now() - at) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

/** What a row's menu asks before it acts (Nesil, 3 Nov: every action is confirmed). */
type Ask = { kind: 'mail' | 'deactivate' | 'reactivate' | 'delete'; user: User } | { kind: 'edit'; user: User; next: User; changes: string[]; andSend: boolean };
const FIELD: [keyof User, string][] = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['role', 'Role'],
  ['title', 'Title'],
  ['region', 'Sales region'],
];

/**
 * Create Roles (Nesil, 30 Oct): GSP's people and their roles. Create a role with someone's name, email, phone with
 * the country code, role (6 Nov: every role in the prototype, from RP Admin to GSP · View Only, but RP Admin's backup
 * copy), title and sales region; Send login link emails them a link to set their password. The list filters by
 * a search, role, sales region and login, exports as CSV, and each role can be edited or deleted. 3 Nov (Nesil): 20 a
 * page, and each row's three dots hold Edit, Resend Login Mail, Deactivate User (Reactivate User once deactivated) and
 * Delete User, each asked first. 6 Nov (Nesil): the sales region filter picks several.
 */
export function Users({ cfg, change, say }: ConfigProps) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [region, setRegion] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [edit, setEdit] = useState<User | 'new' | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [draft, setDraft] = useState<User | null>(null);
  const t = q.trim().toLowerCase();
  const rows = cfg.users.filter(
    (u) => (!t || [u.name, u.email, u.title, u.phone].some((x) => x.toLowerCase().includes(t))) && (!role || u.role === role) && (!region.length || region.includes(u.region)) && (!status || u.status === status),
  );
  const pg = usePaged(rows, [q, role, region, status]);
  const onlyAdmin = (u: User) => u.role === 'GSP · Admin' && cfg.users.filter((x) => x.role === 'GSP · Admin' && x.status !== 'Deactivated').length === 1;
  // the row's three dots: Edit, the login mail, deactivate or reactivate, delete (the only Admin can't go)
  const itemsFor = (u: User): MenuItem[] => {
    const out: MenuItem[] = [{ id: 'edit', label: 'Edit', icon: 'edit', onPick: () => setEdit(u) }];
    if (u.status !== 'Deactivated') out.push({ id: 'mail', label: u.status === 'Not sent' ? 'Send Login Mail' : 'Resend Login Mail', icon: 'mail', onPick: () => setAsk({ kind: 'mail', user: u }) });
    if (u.status === 'Deactivated') out.push({ id: 'on', label: 'Reactivate User', icon: 'refresh', onPick: () => setAsk({ kind: 'reactivate', user: u }) });
    else if (!onlyAdmin(u)) out.push({ id: 'off', label: 'Deactivate User', icon: 'lock', onPick: () => setAsk({ kind: 'deactivate', user: u }) });
    if (!onlyAdmin(u)) out.push({ id: 'remove', label: 'Delete User', icon: 'close', danger: true, onPick: () => setAsk({ kind: 'delete', user: u }) });
    return out;
  };
  const clear = () => {
    setQ('');
    setRole('');
    setRegion([]);
    setStatus('');
  };
  const send = (u: User) => {
    change('Create roles', `Sent a login mail to ${u.name} (${u.email})`, (c) => ({ ...c, users: c.users.map((x) => (x.id === u.id ? { ...x, status: x.status === 'Active' ? 'Active' : 'Link sent', sentAt: Date.now() } : x)) }));
    say(`Login mail sent to ${u.email}. Its link works for 7 days.`);
  };
  return (
    <>
      <PageHead title="Create Roles" lead="GSP’s people and their roles. Create a role, then send a login mail so they can sign in.">
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
          Create Role
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
            <MultiPick id="usf-region" label="Sales region" value={region} options={cfg.regions.map((r) => r.name)} onChange={setRegion} empty="All sales regions" search />
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
                {pg.rows.map((u) => (
                  <tr key={u.id} className={u.status === 'Deactivated' ? 'is-off' : ''}>
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
                      <MoreMenu
                        id={`us-${u.id}`}
                        label={`More for ${u.name}`}
                        items={itemsFor(u)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pg={pg} what="users" />
      </section>
      <History log={cfg.log} area="Create roles" />

      <UserDialog
        open={!!edit}
        user={edit === 'new' ? null : edit}
        start={draft}
        users={cfg.users}
        regions={cfg.regions.map((r) => r.name)}
        onClose={() => (setEdit(null), setDraft(null))}
        onSave={(u, andSend) => {
          const was = cfg.users.find((x) => x.id === u.id);
          const next: User = andSend ? { ...u, status: 'Link sent', sentAt: Date.now() } : u;
          if (!was) {
            change('Create roles', `Created ${u.name}: ${u.role}, ${u.region}${andSend ? ', and sent a login mail' : ''}`, (c) => ({ ...c, users: [next, ...c.users] }));
            say(andSend ? `${u.name} added. Login mail sent to ${u.email}; its link works for 7 days.` : `${u.name} added.`);
          } else {
            // an edit is asked first, with what changes (Nesil, 3 Nov)
            const changes = FIELD.filter(([k]) => String(was[k]) !== String(u[k]) || (k === 'phone' && was.dial !== u.dial)).map(([k, name]) => `${name}: ${k === 'phone' ? `${was.dial} ${was.phone}` : was[k] || 'none'} → ${k === 'phone' ? `${u.dial} ${u.phone}` : u[k] || 'none'}`);
            if (!changes.length && !andSend) say('Nothing changed.');
            else setAsk({ kind: 'edit', user: was, next, changes, andSend });
          }
          setEdit(null);
          setDraft(null);
        }}
      />
      <ConfirmDialog
        open={!!ask}
        title={ask ? ASK_TITLE[ask.kind](ask.user) : ''}
        confirm={ask ? ASK_CTA[ask.kind] : ''}
        cancel={ask?.kind === 'edit' ? 'Keep Editing' : 'Cancel'}
        onCancel={() => {
          if (ask?.kind === 'edit') {
            setEdit(ask.user);
            setDraft(ask.next);
          }
          setAsk(null);
        }}
        onConfirm={() => {
          const x = ask!;
          const u = x.user;
          const set = (fn: (y: User) => User) => (c: Cfg) => ({ ...c, users: c.users.map((y) => (y.id === u.id ? fn(y) : y)) });
          if (x.kind === 'edit') {
            change('Create roles', `Edited ${x.next.name}: ${x.changes.join('; ') || 'no field changes'}${x.andSend ? ', and sent a login mail' : ''}`, set(() => x.next));
            say(x.andSend ? `${x.next.name} saved. Login mail sent to ${x.next.email}.` : `${x.next.name} saved.`);
          } else if (x.kind === 'mail') send(u);
          else if (x.kind === 'deactivate') {
            change('Create roles', `Deactivated ${u.name}`, set((y) => ({ ...y, status: 'Deactivated' })));
            say(`${u.name} deactivated. They can’t sign in until you reactivate them.`);
          } else if (x.kind === 'reactivate') {
            change('Create roles', `Reactivated ${u.name}`, set((y) => ({ ...y, status: 'Active' })));
            say(`${u.name} reactivated. They can sign in again.`);
          } else {
            change('Create roles', `Deleted ${u.name} (${u.role})`, (c) => ({
              ...c,
              users: c.users.filter((y) => y.id !== u.id),
              queues: c.queues.map((q) => ({ ...q, lead: q.lead === u.id ? '' : q.lead, members: q.members.filter((m) => m !== u.id) })),
              emails: c.emails.map((g) => ({ ...g, users: g.users.filter((y) => y.id !== u.id) })),
            }));
            say(`${u.name} deleted.`);
          }
          setAsk(null);
        }}
      >
        {ask?.kind === 'edit' ? (
          <>
            <p>{ask.changes.length ? 'These change:' : 'Nothing else changes.'}</p>
            {ask.changes.length > 0 && (
              <ul className="cfg__changes">
                {ask.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            {ask.andSend && <p>A login mail goes to {ask.next.email}.</p>}
          </>
        ) : (
          <p>{ask && ASK_TEXT[ask.kind](ask.user)}</p>
        )}
      </ConfirmDialog>
    </>
  );
}

const ASK_TITLE: Record<Ask['kind'], (u: User) => string> = {
  edit: (u) => `Save changes to ${u.name}?`,
  mail: (u) => `${u.status === 'Not sent' ? 'Send' : 'Resend'} the login mail to ${u.name}?`,
  deactivate: (u) => `Deactivate ${u.name}?`,
  reactivate: (u) => `Reactivate ${u.name}?`,
  delete: (u) => `Delete ${u.name}?`,
};
const ASK_CTA: Record<Ask['kind'], string> = { edit: 'Save Changes', mail: 'Send Login Mail', deactivate: 'Deactivate User', reactivate: 'Reactivate User', delete: 'Delete User' };
const ASK_TEXT: Record<Exclude<Ask['kind'], 'edit'>, (u: User) => string> = {
  mail: (u) => `It goes to ${u.email}, with a link to ${u.status === 'Active' ? 'reset their password' : 'set their password'}. The link works for 7 days${u.status === 'Link sent' ? '; the one sent before stops working' : ''}.`,
  deactivate: () => 'They can’t sign in until you reactivate them. Their queues, email groups and what they did stay as they are.',
  reactivate: () => 'They can sign in again with their password, with the same role, queues and email groups.',
  delete: () => 'They can no longer sign in, and come off every queue and email group they’re in. What they did stays in the log. This can’t be undone.',
};

/** Create or edit a role: name, email, phone with the country code, role, title and sales region. */
function UserDialog({ open, user, start, users, regions, onClose, onSave }: { open: boolean; user: User | null; start?: User | null; users: User[]; regions: string[]; onClose: () => void; onSave: (u: User, andSend: boolean) => void }) {
  const blank = (): User => ({ id: `u${Date.now()}`, name: '', email: '', dial: '+91', phone: '', role: 'GSP · Admissions', title: '', region: '', status: 'Not sent' });
  const [v, setV] = useState<User>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(start ?? user ?? blank());
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
  const save = (andSend: boolean) => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ ...v, name: v.name.trim(), email, title: v.title.trim() }, andSend);
  };
  const sendable = !user || (user.status !== 'Active' && user.status !== 'Deactivated');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={user ? `Edit ${user.name}’s Role` : 'Create Role'}
      sub={user ? undefined : 'They get a login mail when you send it, to set their password.'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {sendable && (
              <Button variant="secondary" onClick={() => save(false)}>
                {user ? 'Save Changes' : 'Save without Sending'}
              </Button>
            )}
            <Button onClick={() => save(sendable)} iconLeft={sendable ? <Icon name="mail" size={18} /> : undefined}>
              {sendable ? 'Save and Send Login Mail' : 'Save Changes'}
            </Button>
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

