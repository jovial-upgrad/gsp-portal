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
import { EditActions, History, Panel, useAsk } from './parts';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const dateText = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
// 4 Nov (Nesil): View only, or View and Send
const PERM: Record<EmailPerm, string> = { view: 'View only', send: 'View and Send' };

/**
 * Emails (Nesil, 30 Oct): GSP's email groups, the shared inboxes it syncs. **Add email group**: its address, what it's
 * for, whether it syncs, and the date the sync starts from. **Who can use it**: pick a group to see its people and
 * whether each can only view it or send from it too. 3 Nov (Nesil): it reads as it is until **Edit**; then people can
 * be added or taken off and their access changed, and **Save Changes** keeps it. 4 Nov (Nesil): access is View only
 * or View and Send, and taking someone off is asked first.
 */
export function Emails({ cfg, change, say }: ConfigProps) {
  const [cur, setCur] = useState(cfg.emails[0]?.id ?? '');
  const [edit, setEdit] = useState<EmailGroup | 'new' | null>(null);
  const [removing, setRemoving] = useState<EmailGroup | null>(null);
  const [draft, setDraft] = useState<EmailGroup['users'] | null>(null);
  const [adding, setAdding] = useState<string[]>([]);
  const [ask, asking] = useAsk();
  const g = cfg.emails.find((x) => x.id === cur) ?? cfg.emails[0];
  useEffect(() => {
    setAdding([]);
    setDraft(null);
  }, [g?.id]);
  const nameOf = (id: string) => cfg.users.find((u) => u.id === id);
  const people = draft ?? g?.users ?? [];
  const notIn = g ? cfg.users.filter((u) => !people.some((x) => x.id === u.id) && u.status !== 'Deactivated') : [];
  const dirty = !!draft && !!g && JSON.stringify(draft) !== JSON.stringify(g.users);
  const pick = (id: string) => (draft ? say('Save or cancel the changes to this group first.') : setCur(id));
  const saveDraft = () => {
    const before = new Map(g.users.map((x) => [x.id, x.perm]));
    const after = new Map(draft!.map((x) => [x.id, x.perm]));
    const nm = (id: string) => nameOf(id)?.name ?? id;
    const added = draft!.filter((x) => !before.has(x.id)).map((x) => `added ${nm(x.id)} (${PERM[x.perm]})`);
    const gone = g.users.filter((x) => !after.has(x.id)).map((x) => `took ${nm(x.id)} off`);
    const moved = draft!.filter((x) => before.has(x.id) && before.get(x.id) !== x.perm).map((x) => `${nm(x.id)} → ${PERM[x.perm]}`);
    const text = [...added, ...gone, ...moved];
    change('Emails', `${g.email}: ${text.join('; ')}`, (c) => ({ ...c, emails: c.emails.map((x) => (x.id === g.id ? { ...x, users: draft! } : x)) }));
    say(`${g.email}: ${text.length} ${text.length === 1 ? 'change' : 'changes'} saved.`);
    setDraft(null);
    setAdding([]);
  };
  return (
    <>
      <PageHead title="Emails" lead="GSP’s shared mailboxes, and who can view each one or send from it.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
          Add Email Group
        </Button>
      </PageHead>
      <div className="cfg__emails">
        <Panel title="Email Groups" note={`${cfg.emails.length} ${cfg.emails.length === 1 ? 'group' : 'groups'}. Pick one to see who can use it.`}>
          <ul className="cfg__groups" role="listbox" aria-label="Email groups">
            {cfg.emails.map((x) => (
              <li key={x.id} className={`cfg__group ${x.id === g?.id ? 'is-on' : ''}`}>
                <button type="button" role="option" aria-selected={x.id === g?.id} className="cfg__groupbtn" onClick={() => pick(x.id)}>
                  <span className="cfg__groupicon" aria-hidden="true">
                    <Icon name="mail" size={18} />
                  </span>
                  <span className="cfg__groupt">
                    <span className="cfg__strong">{x.email}</span>
                    {x.purpose && <span className="cfg__sub cfg__purpose">{x.purpose}</span>}
                    <span className="cfg__sub">
                      {x.sync ? `Syncing from ${dateText(x.since)}` : 'Not syncing'} · {x.users.length} {x.users.length === 1 ? 'person' : 'people'}
                    </span>
                  </span>
                </button>
                <MoreMenu
                  id={`em-${x.id}`}
                  label={`More for ${x.email}`}
                  items={[
                    { id: 'edit', label: 'Edit Email Group', icon: 'edit', onPick: () => setEdit(x) },
                    { id: 'remove', label: 'Delete Email Group', icon: 'close', danger: true, onPick: () => setRemoving(x) },
                  ]}
                />
              </li>
            ))}
            {!cfg.emails.length && <li className="cfg__note">No email groups yet. Add one.</li>}
          </ul>
        </Panel>

        {g && (
          <Panel
            title="Who Can Use It"
            note={
              <>
                <b>{g.email}</b>
                {g.purpose ? ` · ${g.purpose}` : ''}. {g.sync ? `Syncing from ${dateText(g.since)}.` : 'Not syncing.'}
              </>
            }
            action={<EditActions editing={!!draft} dirty={dirty} onEdit={() => setDraft(g.users)} onCancel={() => (setDraft(null), setAdding([]))} onSave={saveDraft} />}
            flush
          >
            {draft && (
              <div className="cfg__foot cfg__addusers">
                <MultiPick id={`eu-${g.id}`} label="People to add" value={adding} options={notIn.map((u) => u.name)} onChange={setAdding} empty="Pick people" search />
                <Button
                  variant="secondary"
                  iconLeft={<Icon name="plus" size={16} />}
                  disabled={!adding.length}
                  onClick={() => {
                    const ids = adding.map((n) => cfg.users.find((u) => u.name === n)?.id).filter((x): x is string => !!x);
                    setDraft((d) => [...d!, ...ids.map((id) => ({ id, perm: 'view' as EmailPerm }))]);
                    setAdding([]);
                  }}
                >
                  Add People
                </Button>
              </div>
            )}
            {people.length ? (
              <div className="stab-wrap">
                <table className="itab cfg__tab">
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Role</th>
                      <th scope="col">Access</th>
                      {draft && (
                        <th scope="col">
                          <span className="vh">Take off</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((x) => {
                      const u = nameOf(x.id);
                      if (!u) return null;
                      const isNew = !!draft && !g.users.some((y) => y.id === x.id);
                      return (
                        <tr key={x.id} className={isNew ? 'is-changed' : ''}>
                          <td>
                            <span className="cfg__strong">{u.name}</span>
                            <span className="cfg__sub">{u.email}</span>
                          </td>
                          <td className="cfg__muted">{u.role}</td>
                          <td>
                            {draft ? (
                              <SelectInput id={`ep-${g.id}-${x.id}`} aria-label={`${u.name}: access`} value={x.perm} onChange={(e) => setDraft((d) => d!.map((z) => (z.id === x.id ? { ...z, perm: e.target.value as EmailPerm } : z)))}>
                                <option value="view">{PERM.view}</option>
                                <option value="send">{PERM.send}</option>
                              </SelectInput>
                            ) : (
                              <span className={`cfg__access cfg__access--${x.perm}`}>{PERM[x.perm]}</span>
                            )}
                          </td>
                          {draft && (
                            <td className="cfg__acts">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`Take ${u.name} off ${g.email}`}
                                onClick={() =>
                                  ask({
                                    title: `Take ${u.name} off?`,
                                    confirm: 'Take Off',
                                    body: `${u.name} can no longer use ${g.email} once you save.`,
                                    run: () => setDraft((d) => d!.filter((z) => z.id !== x.id)),
                                  })
                                }
                              >
                                <Icon name="close" size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="cfg__empty">{draft ? 'Nobody yet. Pick people above.' : 'Nobody can use this group yet. Edit to add people.'}</p>
            )}
          </Panel>
        )}
      </div>
      <History log={cfg.log} area="Emails" />
      {asking}

      <GroupDialog
        open={!!edit}
        group={edit === 'new' ? null : edit}
        groups={cfg.emails}
        onClose={() => setEdit(null)}
        onSave={(x) => {
          const isNew = !cfg.emails.some((y) => y.id === x.id);
          change('Emails', `${isNew ? 'Added' : 'Edited'} ${x.email}: ${x.sync ? `syncs from ${dateText(x.since)}` : 'no sync'}`, (c) => ({ ...c, emails: isNew ? [...c.emails, x] : c.emails.map((y) => (y.id === x.id ? { ...x, users: y.users } : y)) }));
          say(isNew ? `${x.email} added. Now add who can use it.` : `${x.email} saved.`);
          if (isNew) setCur(x.id);
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.email}?`}
        confirm="Delete Email Group"
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
        <p>It stops syncing, and its {removing?.users.length ?? 0} people can no longer use it. Emails already synced stay where they were filed.</p>
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
      title={group ? 'Edit Email Group' : 'Add Email Group'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!Object.values(err).some(Boolean)) onSave({ ...v, email, purpose: v.purpose?.trim() || undefined });
              }}
            >
              {group ? 'Save Changes' : 'Add Email Group'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="eg-email" label="Email" required error={show('email')}>
          <TextInput id="eg-email" type="email" value={v.email} invalid={!!show('email')} placeholder="name@gsp.upgrad.com" aria-describedby={describedBy('eg-email', show('email'))} onChange={(e) => setV((x) => ({ ...x, email: e.target.value }))} />
        </Field>
        <Field id="eg-purpose" label="What it’s for" optional>
          <TextInput id="eg-purpose" value={v.purpose ?? ''} placeholder="Like: Commission conversations" onChange={(e) => setV((x) => ({ ...x, purpose: e.target.value }))} />
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
