import { useEffect, useMemo, useState } from 'react';
import { USER_STATUSES } from '../data/config';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreMenu, type MenuItem } from '../../components/MoreMenu';
import { PhoneInput } from '../../components/PhoneInput';
import { Field, TextInput } from '../../components/forms';
import { useCheck, isEmail, phoneError } from '../../components/validate';
import { PageHead, Tiles, downloadCsv } from '../../institution/records/parts';
import { GSP_ROLES, linkExpired, type GspRole, type User, type UserStatus } from '../data/config';
import { update as updateWork } from '../../work/store';
import type { ConfigProps } from './ConfigPage';
import { History } from './parts';
import { MultiPick } from '../../institution/records/MultiPick';
import { Loaded, NoResults, PAGE_SIZE, Pager, Pick, SaveBanner, ViewOnlyNote, ago, istDate, trySave, type SaveResult } from './states';

const STATUSES: UserStatus[] = [...USER_STATUSES];

/** What the Login column says under the status (PRD slice 1, Login status). */
function loginLine(u: User, now = Date.now()) {
  if (u.status === 'Link sent') return linkExpired(u, now) ? <span className="cfg__sub cfg__expired">Link expired</span> : <span className="cfg__sub">Sent {ago(u.sentAt, now)}</span>;
  if (u.status === 'Active') return <span className="cfg__sub">{u.lastSignIn ? `Signed in ${ago(u.lastSignIn, now)}` : 'Signed in'}</span>;
  return <span className="cfg__sub">Deactivated {u.deactivatedAt ? istDate(u.deactivatedAt) : ''}</span>;
}

/**
 * GSP users (PRD slice 1; screen Admin › User roles › Create roles): a list of GSP people, with Create user and Edit
 * in a dialog. Login status Link sent, Active or Deactivated; Resend login email, Deactivate, Reactivate and Delete
 * user. Sorted A to Z, 50 a page; tiles that filter; search by name, email or phone; filters by role, sales region
 * and login status; Export as CSV of what the filters show (logged as a download). Admin edits; View Only views.
 */
export function Users({ cfg, change, say, canEdit }: ConfigProps) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<User | 'new' | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const now = Date.now();
  const t = q.trim().toLowerCase();
  const digits = t.replace(/\D/g, '');
  const sorted = useMemo(() => [...cfg.users].sort((a, b) => a.name.localeCompare(b.name)), [cfg.users]);
  const rows = sorted.filter(
    (u) =>
      (!t || [u.name, u.email].some((x) => x.toLowerCase().includes(t)) || (digits.length >= 3 && `${u.dial}${u.phone}`.replace(/\D/g, '').includes(digits))) &&
      (!role || u.role === role) &&
      (!region || (region === 'No sales region' ? !u.regions.length : u.regions.includes(region))) &&
      (!status || u.status === status),
  );
  useEffect(() => setPage(0), [q, role, region, status]);
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const filtered = Boolean(q || role || region || status);
  const clear = () => {
    setQ('');
    setRole('');
    setRegion('');
    setStatus('');
  };
  const activeAdmins = cfg.users.filter((x) => x.role === 'Admin' && x.status === 'Active');
  const lastAdmin = (u: User) => u.role === 'Admin' && u.status === 'Active' && activeAdmins.length <= 1;
  const send = (u: User) => {
    change('Create roles', `Resent the login email to ${u.name} (${u.email}); the old link stopped working`, (c) => ({ ...c, users: c.users.map((x) => (x.id === u.id ? { ...x, sentAt: Date.now() } : x)) }));
    say(`Login email sent to ${u.email}.`);
  };
  const reactivate = (u: User) => {
    change('Create roles', `Reactivated ${u.name}: Deactivated → Link sent; login email sent`, (c) => ({ ...c, users: c.users.map((x) => (x.id === u.id ? { ...x, status: 'Link sent', sentAt: Date.now(), deactivatedAt: undefined } : x)) }));
    say('User reactivated. Login email sent.');
  };
  const deactivate = (u: User) => {
    change('Create roles', `Deactivated ${u.name}: ${u.status} → Deactivated; sessions ended and login link revoked`, (c) => ({ ...c, users: c.users.map((x) => (x.id === u.id ? { ...x, status: 'Deactivated', deactivatedAt: Date.now(), sentAt: undefined } : x)) }));
    say('User deactivated.');
  };
  const items = (u: User): MenuItem[] => [
    { id: 'edit', label: 'Edit', icon: 'edit', onPick: () => setEdit(u) },
    ...(u.status === 'Link sent' ? [{ id: 'resend', label: 'Resend login email', icon: 'mail' as const, onPick: () => send(u) }] : []),
    ...(u.status === 'Deactivated' ? [{ id: 'reactivate', label: 'Reactivate', icon: 'check' as const, onPick: () => reactivate(u) }] : lastAdmin(u) ? [] : [{ id: 'deactivate', label: 'Deactivate', icon: 'lock' as const, danger: true, onPick: () => setDeactivating(u) }]),
    ...(lastAdmin(u) ? [] : [{ id: 'remove', label: 'Delete user', icon: 'close' as const, danger: true, onPick: () => setRemoving(u) }]),
  ];
  const by = (s: UserStatus) => cfg.users.filter((u) => u.status === s).length;
  return (
    <>
      <PageHead title="GSP users" lead="GSP’s people, their role and sales regions. A new user gets a login email to set their password; the link works for 7 days.">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            // what the filters show; logged as a download (Admin › Logs › Downloads)
            downloadCsv('gsp-users.csv', [['Name', 'Email', 'Phone', 'Role', 'Title', 'Sales regions', 'Login status', 'Last sign-in'], ...rows.map((u) => [u.name, u.email, u.phone ? `${u.dial} ${u.phone}` : '', u.role, u.title, u.regions.join('; ') || 'No sales region', u.status, u.lastSignIn ? istDate(u.lastSignIn) : ''])]);
          }}
        >
          Export as CSV
        </Button>
        {canEdit && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
            Create user
          </Button>
        )}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      <Loaded page="GSP users" cols={6}>
        <Tiles
          label="GSP users by login status"
          value={status as UserStatus | ''}
          onPick={(k) => setStatus(k)}
          items={[
            { key: '' as UserStatus, label: 'GSP users', sub: `${cfg.users.length - by('Active')} not active`, tone: 'gsp' as const, n: cfg.users.length },
            { key: 'Link sent' as UserStatus, label: 'Link sent', sub: 'Waiting to set a password', tone: 'you' as const, n: by('Link sent') },
            { key: 'Active' as UserStatus, label: 'Active', sub: 'Have signed in', tone: 'ok' as const, n: by('Active') },
            { key: 'Deactivated' as UserStatus, label: 'Deactivated', sub: 'Can’t sign in', tone: 'grey' as const, n: by('Deactivated') },
          ]}
        />
        <section className="card stable" aria-labelledby="usf-count">
          <div className="stools">
            <div className="stools__row">
              <label className="ssearch">
                <Icon name="search" size={18} />
                <span className="vh">Search users</span>
                <input id="usf-q" type="search" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <Pick id="usf-role" label="Role" value={role} empty="All roles" options={[...GSP_ROLES]} onChange={setRole} />
              <Pick id="usf-region" label="Sales region" value={region} empty="All sales regions" options={[...cfg.regions.map((r) => r.name), 'No sales region']} onChange={setRegion} />
              <Pick id="usf-status" label="Login status" value={status} empty="Any login status" options={STATUSES} onChange={setStatus} />
            </div>
            <p className="stools__count" id="usf-count" role="status">
              <span>
                <span className="num">{rows.length === cfg.users.length ? cfg.users.length : `${rows.length} of ${cfg.users.length}`}</span> users
              </span>
              {filtered && (
                <button type="button" className="cfg__linkbtn" onClick={clear}>
                  Clear filters
                </button>
              )}
            </p>
          </div>
          {rows.length === 0 ? (
            <NoResults thing="users" onClear={clear} />
          ) : (
            <div className="stab-wrap">
              <table className="itab cfg__tab">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Role</th>
                    <th scope="col">Sales regions</th>
                    <th scope="col">Login</th>
                    {canEdit && (
                      <th scope="col">
                        <span className="vh">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => {
                    return (
                      <tr key={u.id} className={u.status === 'Deactivated' ? 'is-off' : undefined}>
                        <td>
                          <span className="cfg__strong">{u.name}</span>
                          <span className="cfg__sub">{u.email}</span>
                        </td>
                        <td className="cfg__muted num cfg__nowrap">{u.phone ? `${u.dial} ${u.phone}` : '–'}</td>
                        <td>
                          {u.role}
                          {u.title && <span className="cfg__sub">{u.title}</span>}
                        </td>
                        {/* sales regions only, for every role (S1C-3): where a Recruitment user is the default contact is Admin › Recruitment assignment, not the user */}
                        <td className="cfg__muted">{u.regions.join(', ') || 'No sales region'}</td>
                        <td>
                          <span className={`cfg__login cfg__login--${u.status.replace(' ', '-').toLowerCase()}`}>{u.status}</span>
                          {loginLine(u, now)}
                        </td>
                        {canEdit && (
                          <td className="cfg__acts">
                            <MoreMenu id={`us-${u.id}`} label={`More for ${u.name}`} items={items(u)} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pager total={rows.length} page={page} setPage={setPage} thing="Users" />
        </section>
        <History log={cfg.log} area="Create roles" />
      </Loaded>

      <UserDialog
        open={!!edit}
        user={edit === 'new' ? null : edit}
        users={cfg.users}
        regions={cfg.regions.map((r) => r.name)}
        onClose={() => setEdit(null)}
        onSave={(u) => {
          const was = cfg.users.find((x) => x.id === u.id);
          if (!was) {
            const next: User = { ...u, status: 'Link sent', sentAt: Date.now(), createdAt: Date.now() };
            change('Create roles', `Created ${u.name}: ${u.role}, ${u.regions.join(', ')}; login email sent`, (c) => ({ ...c, users: [next, ...c.users] }));
            say('User created. Login email sent.');
          } else {
            const emailChanged = was.email !== u.email;
            const diffs = (
              [
                ['name', was.name, u.name],
                ['email', was.email, u.email],
                ['phone', `${was.dial} ${was.phone}`.trim(), `${u.dial} ${u.phone}`.trim()],
                ['role', was.role, u.role],
                ['title', was.title || '–', u.title || '–'],
                ['sales regions', was.regions.join(', ') || 'none', u.regions.join(', ') || 'none'],
              ] as [string, string, string][]
            )
              .filter(([, a, b]) => a !== b)
              .map(([k, a, b]) => `${k} ${a} → ${b}`);
            change('Create roles', `Edited ${u.name}: ${diffs.join('; ')}${emailChanged ? '; a new login email went out and the old link stopped working' : ''}`, (c) => ({ ...c, users: c.users.map((x) => (x.id === u.id ? { ...u, sentAt: emailChanged ? Date.now() : x.sentAt } : x)) }));
            say(emailChanged ? 'Saved. Login email sent.' : 'Saved.');
          }
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name}?`}
        confirm="Delete user"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const u = removing!;
          change('Create roles', `Deleted ${u.name} (${u.role}); removed from every queue and mailbox`, (c) => ({
            ...c,
            users: c.users.filter((x) => x.id !== u.id),
            queues: c.queues.map((q) => ({ ...q, lead: q.lead === u.id ? '' : q.lead, members: q.members.filter((m) => m !== u.id) })),
            emails: c.emails.map((g) => ({ ...g, users: g.users.filter((x) => x.id !== u.id) })),
          }));
          // off every queue in Admin › Work too (the one queue editor)
          try {
            updateWork((d: { queues: { leader: string; members: string[] }[] }) => {
              d.queues.forEach((q) => {
                q.members = q.members.filter((m) => m !== u.id);
                if (q.leader === u.id) q.leader = '';
              });
            }, `${u.name} was deleted in Admin › GSP users and taken off every queue`, 'queue.edited');
          } catch {
            /* work store not loaded */
          }
          say('User deleted.');
          setRemoving(null);
        }}
      >
        <p>First, everything Deactivate does: they can’t sign in, their sessions end, and their open applications go to their queue’s leader. Then they come off every queue and mailbox. Their past actions keep their name. This can’t be undone.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!deactivating}
        title={`Deactivate ${deactivating?.name}?`}
        confirm="Deactivate"
        danger
        onCancel={() => setDeactivating(null)}
        onConfirm={() => {
          deactivate(deactivating!);
          setDeactivating(null);
        }}
      >
        <p>They can’t sign in, and their sessions end at once. Their open tasks show as their queue leader’s, and each of their open applications goes to its queue’s leader, who gives it a new officer. They stay listed on queues and mailboxes, but get no new work, until deleted.</p>
      </ConfirmDialog>
    </>
  );
}

/** Create or edit a user (PRD slice 1, GSP users › Fields). */
function UserDialog({ open, user, users, regions, onClose, onSave }: { open: boolean; user: User | null; users: User[]; regions: string[]; onClose: () => void; onSave: (u: User) => void }) {
  const blank = (): User => ({ id: `u-${Date.now().toString(36)}`, name: '', email: '', dial: '+91', phone: '', role: '' as GspRole, title: '', region: '', regions: [], status: 'Link sent' });
  const [v, setV] = useState<User>(blank);
  const [start, setStart] = useState<User>(blank);
  const [result, setResult] = useState<SaveResult | null>(null);
  const set = (p: Partial<User>) => setV((x) => ({ ...x, ...p }));
  const email = v.email.trim().toLowerCase();
  // email: read-only once the user is created (Jovial, 2 Nov)
  const emailLocked = !!user;
  const c = useCheck({
    name: v.name.trim().length < 2 || v.name.trim().length > 100 ? 'Enter their full name.' : null,
    email: emailLocked
      ? null
      : // any valid email, no domain rule (Jovial, S1C-2)
        !email || email.length > 254 || !isEmail(email)
        ? 'Enter a valid email, like name@example.com.'
        : users.some((x) => x.id !== v.id && x.email.toLowerCase() === email)
          ? 'Someone already has this email.'
          : null,
    // required (Jovial, 2 Nov)
    phone: phoneError(v.dial, v.phone, { required: true }),
    role: !v.role ? 'Pick their role.' : null,
    title: v.title.trim().length > 60 ? 'Keep the title under 60 characters.' : null,
    region: !v.regions.length ? 'Pick their sales region.' : null,
  });
  useEffect(() => {
    if (!open) return;
    const x = user ?? blank();
    setV(x);
    setStart(x);
    setResult(null);
    c.reset();
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(v) !== JSON.stringify(start);
  const save = () => {
    if (!c.submit()) return;
    const r = trySave();
    if (r !== 'ok') return setResult(r);
    onSave({ ...v, name: v.name.trim(), email: emailLocked ? v.email : email, title: v.title.trim(), region: v.regions.join(', ') });
  };
  // Global can't sit with other regions: picking Global clears the others, and picking a region clears Global
  const pickRegions = (next: string[]) => {
    const added = next.filter((r) => !v.regions.includes(r));
    const rs = added.includes('Global') ? ['Global'] : added.length ? next.filter((r) => r !== 'Global') : next;
    set({ regions: rs, region: rs.join(', ') });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      what={user ? `${user.name}’s details` : 'the new user'}
      center
      className="iform cfg__sheet"
      title={user ? `Edit ${user.name}` : 'Create user'}
      sub={user ? 'Their email can’t be changed once the user is created.' : 'They get the Set up your account email straight away; the link works for 7 days.'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!!user && !dirty}>
              {user ? 'Save' : 'Create user'}
            </Button>
          </div>
        </div>
      }
    >
      <SaveBanner result={result} onReload={onClose} />
      {user && (
        <p className="cfg__note">
          User ID {user.id} (never changes) · Login {user.status} · Created {user.createdAt ? istDate(user.createdAt) : '–'} · Last sign-in {user.lastSignIn ? istDate(user.lastSignIn) : '–'}
        </p>
      )}
      <div className="iform__grid">
        <Field id="us-name" label="Name" required error={c.err('name')}>
          <TextInput id="us-name" value={v.name} maxLength={100} autoComplete="off" invalid={!!c.err('name')} onBlur={c.blur('name')} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="us-email" label="Email" required error={c.err('email')}>
          <TextInput id="us-email" type="email" value={v.email} maxLength={254} placeholder="name@upgrad.com" autoComplete="off" readOnly={emailLocked} invalid={!!c.err('email')} onBlur={c.blur('email')} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field id="us-phone" label="Phone" required error={c.err('phone')}>
          <PhoneInput id="us-phone" dial={v.dial} number={v.phone} invalid={!!c.err('phone')} describedBy={c.err('phone') ? 'us-phone-error' : undefined} onBlur={c.blur('phone')} onDial={(d) => set({ dial: d })} onNumber={(n) => set({ phone: n.replace(/\D/g, '') })} />
        </Field>
        <Field id="us-role" label="Role" required error={c.err('role')}>
          <Pick id="us-role" label="Role" value={v.role} placeholder="Pick their role" options={[...GSP_ROLES]} invalid={!!c.err('role')} describedBy={c.err('role') ? 'us-role-error' : undefined} onChange={(r) => (set({ role: r as GspRole }), c.blur('role')())} />
        </Field>
        {/* optional free text; two people can have the same title (Jovial, 2 Nov) */}
        <Field id="us-title" label="Title" error={c.err('title')}>
          <TextInput id="us-title" value={v.title} placeholder="Like: Admissions Officer" invalid={!!c.err('title')} onBlur={c.blur('title')} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field id="us-region" label="Sales regions" required error={c.err('region')} hint="One or more. Only Admin has Global by default; give it to anyone else here.">
          <MultiPick id="us-region" label="Sales regions" value={v.regions} options={regions} invalid={!!c.err('region')} onClose={c.blur('region')} onChange={pickRegions} empty="Pick their sales regions" />
        </Field>
      </div>
    </Sheet>
  );
}
