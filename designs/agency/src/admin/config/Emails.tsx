import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreMenu } from '../../components/MoreMenu';
import { Checkbox, Field, SelectInput, TextInput, describedBy } from '../../components/forms';
import { PageHead } from '../../institution/records/parts';
import { MultiPick } from '../../institution/records/MultiPick';
import type { EmailGroup, EmailPerm } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History, Panel } from './parts';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const dateText = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const PERM: Record<EmailPerm, string> = { view: 'Only view', send: 'Can send' };

/**
 * Emails (Nesil, 30 Oct): GSP's email groups, the shared inboxes it syncs. **Add email group**: its address, whether
 * it syncs, and the date the sync starts from. **Email group users**: pick a group, add the people who can see it, and
 * set each one to Only view (the default) or Can send.
 */
export function Emails({ cfg, change, say }: ConfigProps) {
  const [cur, setCur] = useState(cfg.emails[0]?.id ?? '');
  const [edit, setEdit] = useState<EmailGroup | 'new' | null>(null);
  const [removing, setRemoving] = useState<EmailGroup | null>(null);
  const [adding, setAdding] = useState<string[]>([]);
  const g = cfg.emails.find((x) => x.id === cur) ?? cfg.emails[0];
  useEffect(() => setAdding([]), [g?.id]);
  const nameOf = (id: string) => cfg.users.find((u) => u.id === id);
  const upd = (what: string, fn: (x: EmailGroup) => EmailGroup) => change('Emails', `${g.email}: ${what}`, (c) => ({ ...c, emails: c.emails.map((x) => (x.id === g.id ? fn(x) : x)) }));
  const notIn = g ? cfg.users.filter((u) => !g.users.some((x) => x.id === u.id)) : [];
  return (
    <>
      <PageHead title="Emails" lead="GSP’s email groups: the shared inboxes it syncs, and who can see each one or send from it. Pick a group to choose its users.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
          Add email group
        </Button>
      </PageHead>
      <div className="cfg__emails">
        <Panel title="Email groups" note={`${cfg.emails.length} groups`}>
          <ul className="cfg__groups" role="listbox" aria-label="Email groups">
            {cfg.emails.map((x) => (
              <li key={x.id} className={`cfg__group ${x.id === g?.id ? 'is-on' : ''}`}>
                <button type="button" role="option" aria-selected={x.id === g?.id} className="cfg__groupbtn" onClick={() => setCur(x.id)}>
                  <span className="cfg__groupicon" aria-hidden="true">
                    <Icon name="mail" size={18} />
                  </span>
                  <span className="cfg__groupt">
                    <span className="cfg__strong">{x.email}</span>
                    <span className="cfg__sub">
                      {x.sync ? `Syncing since ${dateText(x.since)}` : 'Not syncing'} · {x.users.length} {x.users.length === 1 ? 'user' : 'users'}
                    </span>
                  </span>
                </button>
                <MoreMenu
                  id={`em-${x.id}`}
                  label={`More for ${x.email}`}
                  items={[
                    { id: 'edit', label: 'Edit email group', icon: 'edit', onPick: () => setEdit(x) },
                    { id: 'remove', label: 'Delete email group', icon: 'close', danger: true, onPick: () => setRemoving(x) },
                  ]}
                />
              </li>
            ))}
            {!cfg.emails.length && <li className="cfg__note">No email groups yet. Add one.</li>}
          </ul>
        </Panel>

        {g && (
          <Panel
            title="Email group users"
            note={
              <>
                Who can see <b>{g.email}</b>, and who can send from it. New users can only view.
              </>
            }
            flush
          >
            <div className="cfg__foot cfg__addusers">
              <MultiPick id={`eu-${g.id}`} label="Users to add" value={adding} options={notIn.map((u) => u.name)} onChange={setAdding} empty="Choose users" search />
              <Button
                variant="secondary"
                iconLeft={<Icon name="plus" size={16} />}
                disabled={!adding.length}
                onClick={() => {
                  const ids = adding.map((n) => cfg.users.find((u) => u.name === n)?.id).filter((x): x is string => !!x);
                  upd(`added ${adding.join(', ')} (only view)`, (x) => ({ ...x, users: [...x.users, ...ids.map((id) => ({ id, perm: 'view' as EmailPerm }))] }));
                  say(`${adding.length === 1 ? adding[0] : `${adding.length} users`} can now view ${g.email}.`);
                  setAdding([]);
                }}
              >
                Add users
              </Button>
            </div>
            {g.users.length ? (
              <div className="stab-wrap">
                <table className="itab cfg__tab">
                  <thead>
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Role</th>
                      <th scope="col">Permission</th>
                      <th scope="col">
                        <span className="vh">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.users.map((x) => {
                      const u = nameOf(x.id);
                      if (!u) return null;
                      return (
                        <tr key={x.id}>
                          <td>
                            <span className="cfg__strong">{u.name}</span>
                            <span className="cfg__sub">{u.email}</span>
                          </td>
                          <td className="cfg__muted">{u.role}</td>
                          <td>
                            <SelectInput
                              id={`ep-${g.id}-${x.id}`}
                              aria-label={`${u.name}: permission`}
                              value={x.perm}
                              onChange={(e) => {
                                const p = e.target.value as EmailPerm;
                                upd(`${u.name} → ${PERM[p]}`, (y) => ({ ...y, users: y.users.map((z) => (z.id === x.id ? { ...z, perm: p } : z)) }));
                                say(`${u.name} ${p === 'send' ? 'can now send from' : 'can now only view'} ${g.email}.`);
                              }}
                            >
                              <option value="view">Only view</option>
                              <option value="send">Can send</option>
                            </SelectInput>
                          </td>
                          <td className="cfg__acts">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Take ${u.name} off ${g.email}`}
                              onClick={() => {
                                upd(`took ${u.name} off`, (y) => ({ ...y, users: y.users.filter((z) => z.id !== x.id) }));
                                say(`${u.name} can no longer see ${g.email}.`);
                              }}
                            >
                              <Icon name="close" size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="cfg__empty">Nobody can see this group yet. Add users above.</p>
            )}
          </Panel>
        )}
      </div>
      <History log={cfg.log} area="Emails" />

      <GroupDialog
        open={!!edit}
        group={edit === 'new' ? null : edit}
        groups={cfg.emails}
        onClose={() => setEdit(null)}
        onSave={(x) => {
          const isNew = !cfg.emails.some((y) => y.id === x.id);
          change('Emails', `${isNew ? 'Added' : 'Edited'} ${x.email}: ${x.sync ? `syncs from ${dateText(x.since)}` : 'no sync'}`, (c) => ({ ...c, emails: isNew ? [...c.emails, x] : c.emails.map((y) => (y.id === x.id ? x : y)) }));
          say(isNew ? `${x.email} added. Now add who can see it.` : `${x.email} saved.`);
          if (isNew) setCur(x.id);
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.email}?`}
        confirm="Delete"
        cancel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const x = removing!;
          change('Emails', `Deleted ${x.email}`, (c) => ({ ...c, emails: c.emails.filter((y) => y.id !== x.id) }));
          say(`${x.email} deleted.`);
          if (x.id === g?.id) setCur(cfg.emails.find((y) => y.id !== x.id)?.id ?? '');
          setRemoving(null);
        }}
      >
        <p>It stops syncing, and its {removing?.users.length ?? 0} users can no longer see it. Emails already synced stay where they were filed.</p>
      </ConfirmDialog>
    </>
  );
}

/** Add or edit an email group: the address, whether it syncs, and the date the sync starts from. */
function GroupDialog({ open, group, groups, onClose, onSave }: { open: boolean; group: EmailGroup | null; groups: EmailGroup[]; onClose: () => void; onSave: (g: EmailGroup) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState<EmailGroup>({ id: '', email: '', sync: true, since: today, users: [] });
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(group ?? { id: `e${Date.now()}`, email: '', sync: true, since: today, users: [] });
    setTried(false);
  }, [open, group?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const email = v.email.trim().toLowerCase();
  const err = {
    email: !isEmail(email) ? 'Enter the group’s email, like admissions@gsp.upgrad.com.' : groups.some((x) => x.id !== v.id && x.email === email) ? 'There’s already a group with this email.' : null,
    since: v.sync && !v.since ? 'Pick the date the sync starts from.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={group ? 'Edit email group' : 'Add email group'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!Object.values(err).some(Boolean)) onSave({ ...v, email });
              }}
            >
              {group ? 'Save' : 'Add email group'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="eg-email" label="Email" required error={show('email')}>
          <TextInput id="eg-email" type="email" value={v.email} invalid={!!show('email')} placeholder="name@gsp.upgrad.com" aria-describedby={describedBy('eg-email', show('email'))} onChange={(e) => setV((x) => ({ ...x, email: e.target.value }))} />
        </Field>
        <Checkbox id="eg-sync" checked={v.sync} onChange={(sync) => setV((x) => ({ ...x, sync }))} hint="Brings this inbox’s emails into the portal, from the start date on.">
          Email sync
        </Checkbox>
        {v.sync && (
          <Field id="eg-since" label="Sync email start date" required error={show('since')}>
            <TextInput id="eg-since" type="date" value={v.since} max={today} invalid={!!show('since')} onChange={(e) => setV((x) => ({ ...x, since: e.target.value }))} />
          </Field>
        )}
      </div>
    </Sheet>
  );
}
