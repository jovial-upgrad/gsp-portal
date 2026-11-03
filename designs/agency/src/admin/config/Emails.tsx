import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { DateInput, Field, Switch, TextInput } from '../../components/forms';
import { useCheck, isEmail, dateError } from '../../components/validate';
import { fmtDate } from '../../data/format';
import { PageHead } from '../../institution/records/parts';
import type { EmailGroup, EmailPerm } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';
import { Empty, Loaded, Pager, Pick, SaveBanner, usePaged, ViewOnlyNote, istDay, trySave, type SaveResult } from './states';

/** Jovial, 2 Nov: View, or View and send, for each person. */
const PERM: Record<EmailPerm, string> = { view: 'View', send: 'View and send' };

/**
 * Shared mailboxes (PRD slice 1; Admin › User roles › Emails): GSP's shared inboxes the portal syncs, and who can use
 * each one. Each has an email (locked after the first save), a note, email sync and the date it syncs from, and its
 * people: access is per user (Jovial, 2 Nov), each View or View and send; not per queue or region. A mailbox can't be
 * deleted in this release (proposal S1C-12): switch sync off to stop it. Reading and acting on the mail is Mail.
 */
export function Emails({ cfg, change, say, canEdit }: ConfigProps) {
  const [cur, setCur] = useState(cfg.emails[0]?.id ?? '');
  const [edit, setEdit] = useState<EmailGroup | 'new' | null>(null);
  const g = cfg.emails.find((x) => x.id === cur) ?? cfg.emails[0];
  return (
    <>
      <PageHead title="Shared mailboxes" lead="GSP’s shared inboxes that the portal syncs, and who can use each one. Reading and acting on the mail is Mail; this page only sets them up.">
        {canEdit && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
            Add mailbox
          </Button>
        )}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      <Loaded page="shared mailboxes" cols={3}>
        {!cfg.emails.length ? (
          <Panel>
            <Empty>No shared mailboxes yet.</Empty>
          </Panel>
        ) : (
          <div className="cfg__emails">
            <Panel title="Mailboxes" note={`${cfg.emails.length} mailboxes. A mailbox can’t be deleted in this release: switch sync off to stop it.`}>
              <ul className="cfg__groups" role="listbox" aria-label="Shared mailboxes">
                {cfg.emails.map((x) => {
                  const n = new Set(x.users.map((u) => u.id)).size;
                  return (
                    <li key={x.id} className={`cfg__group ${x.id === g?.id ? 'is-on' : ''}`}>
                      <button type="button" role="option" aria-selected={x.id === g?.id} className="cfg__groupbtn" onClick={() => setCur(x.id)}>
                        <span className="cfg__groupicon" aria-hidden="true">
                          <Icon name="mail" size={18} />
                        </span>
                        <span className="cfg__groupt">
                          <span className="cfg__strong">{x.email}</span>
                          <span className="cfg__sub">{x.for || '–'}</span>
                          <span className="cfg__sub">
                            {x.sync ? `Syncing from ${fmtDate(x.since)}` : 'Sync off'} · {n} {n === 1 ? 'person' : 'people'}
                          </span>
                        </span>
                      </button>
                      {canEdit && (
                        <button type="button" className="icon-btn" aria-label={`Edit ${x.email}`} onClick={() => setEdit(x)}>
                          <Icon name="edit" size={16} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
            {g && <Access key={g.id} g={g} cfg={cfg} change={change} say={say} canEdit={canEdit} />}
          </div>
        )}
      </Loaded>
      <History log={cfg.log} area="Emails" />

      <MailboxDialog
        open={!!edit}
        box={edit === 'new' ? null : edit}
        boxes={cfg.emails}
        onClose={() => setEdit(null)}
        onSave={(x) => {
          const was = cfg.emails.find((y) => y.id === x.id);
          if (!was) change('Emails', `Added ${x.email} (${x.for || 'no note'}): ${x.sync ? `syncs from ${fmtDate(x.since)}` : 'sync off'}`, (c) => ({ ...c, emails: [...c.emails, { ...x, savedAt: Date.now() }] }));
          else {
            const diffs = (
              [
                ['note', was.for || '–', x.for || '–'],
                ['email sync', was.sync ? 'On' : 'Off', x.sync ? 'On' : 'Off'],
                ['sync from', fmtDate(was.since), fmtDate(x.since)],
              ] as [string, string, string][]
            )
              .filter(([, a, b]) => a !== b)
              .map(([k, a, b]) => `${k} ${a} → ${b}`);
            change('Emails', `${x.email}: ${diffs.join('; ')}`, (c) => ({ ...c, emails: c.emails.map((y) => (y.id === x.id ? x : y)) }));
          }
          say('Saved.');
          setCur(x.id);
          setEdit(null);
        }}
      />
    </>
  );
}

/** Add or edit a mailbox (PRD slice 1, Shared mailboxes › Fields). The email is locked after the first save. */
function MailboxDialog({ open, box, boxes, onClose, onSave }: { open: boolean; box: EmailGroup | null; boxes: EmailGroup[]; onClose: () => void; onSave: (g: EmailGroup) => void }) {
  const today = istDay(Date.now());
  const blank = (): EmailGroup => ({ id: `e${Date.now()}`, email: '', for: '', sync: true, since: today, queues: [], users: [] });
  const [v, setV] = useState<EmailGroup>(blank);
  const [start, setStart] = useState<EmailGroup>(v);
  const [result, setResult] = useState<SaveResult | null>(null);
  const email = v.email.trim().toLowerCase();
  const locked = !!box;
  const c = useCheck({
    email: locked ? null : !isEmail(email) || !email.endsWith('@upgrad.com') ? 'Enter a valid email.' : boxes.some((x) => x.id !== v.id && x.email.toLowerCase() === email) ? 'This mailbox is already set up.' : null,
    since: v.sync ? (!v.since ? 'Pick the date to sync from.' : dateError(v.since) ? 'Pick the date to sync from.' : v.since > today ? 'Pick today or an earlier date.' : null) : null,
  });
  useEffect(() => {
    if (!open) return;
    const x = box ?? blank();
    setV(x);
    setStart(x);
    setResult(null);
    c.reset();
  }, [open, box?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(v) !== JSON.stringify(start);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      what={box ? box.email : 'the new mailbox'}
      center
      className="iform cfg__sheet"
      title={box ? `Edit ${box.email}` : 'Add mailbox'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!!box && !dirty}
              onClick={() => {
                if (!c.submit()) return;
                const r = trySave();
                if (r !== 'ok') return setResult(r);
                onSave({ ...v, email: locked ? v.email : email, for: v.for.trim() });
              }}
            >
              {box ? 'Save' : 'Add mailbox'}
            </Button>
          </div>
        </div>
      }
    >
      <SaveBanner result={result} onReload={onClose} />
      <div className="cfg__form">
        <Field id="eg-email" label="Email" required error={c.err('email')} hint={locked ? 'Locked after the first save.' : 'An @upgrad.com address.'}>
          <TextInput id="eg-email" type="email" value={v.email} disabled={locked} placeholder="name@upgrad.com" invalid={!!c.err('email')} onBlur={c.blur('email')} onChange={(e) => setV((x) => ({ ...x, email: e.target.value }))} />
        </Field>
        <Field id="eg-for" label="Note" optional>
          <TextInput id="eg-for" value={v.for} maxLength={120} placeholder="Like: Partner onboarding" onChange={(e) => setV((x) => ({ ...x, for: e.target.value }))} />
        </Field>
        <Switch id="eg-sync" checked={v.sync} onChange={(sync) => setV((x) => ({ ...x, sync }))}>
          Email sync
        </Switch>
        {v.sync && (
          <Field id="eg-since" label="Sync from" required error={c.err('since')} hint="Mail before this date isn’t read.">
            <DateInput id="eg-since" value={v.since} invalid={!!c.err('since')} onBlur={c.blur('since')} onChange={(since) => setV((x) => ({ ...x, since }))} />
          </Field>
        )}
      </div>
    </Sheet>
  );
}

/**
 * Who can use a mailbox (Jovial, 2 Nov): the people Admin picks, each View or View and send; not per queue or region.
 * Read only until Edit; removing someone takes them off at once, and drafts they started stay with the mailbox.
 */
function Access({ g, cfg, change, say, canEdit }: { g: EmailGroup; cfg: ConfigProps['cfg']; change: ConfigProps['change']; say: (m: string) => void; canEdit: boolean }) {
  const d = useDraft(g.users, `who can use ${g.email}`);
  const [adding, setAdding] = useState('');
  const [result, setResult] = useState<SaveResult | null>(null);
  const ed = d.editing;
  const list = d.value;
  const userOf = (id: string) => cfg.users.find((u) => u.id === id);
  const notIn = cfg.users.filter((u) => u.status === 'Active' && !list.some((x) => x.id === u.id));
  // the people, A to Z, paged like every Admin list (Jovial, 3 Nov)
  const people = list.filter((x) => userOf(x.id)).sort((a, b) => (userOf(a.id)?.name ?? '').localeCompare(userOf(b.id)?.name ?? ''));
  const { shown, pager } = usePaged(people, [g.id]);
  const save = () => {
    const r = trySave();
    if (r !== 'ok') return setResult(r);
    const added = list.filter((x) => !g.users.some((y) => y.id === x.id)).map((x) => `${userOf(x.id)?.name} (${PERM[x.perm]})`);
    const gone = g.users.filter((x) => !list.some((y) => y.id === x.id)).map((x) => userOf(x.id)?.name);
    const moved = list.filter((x) => g.users.some((y) => y.id === x.id && y.perm !== x.perm)).map((x) => `${userOf(x.id)?.name}: ${PERM[x.perm === 'send' ? 'view' : 'send']} → ${PERM[x.perm]}`);
    change('Emails', `${g.email}: ${[added.length && `added ${added.join(', ')}`, gone.length && `removed ${gone.join(', ')}`, ...moved].filter(Boolean).join('; ') || 'no changes'}`, (c) => ({ ...c, emails: c.emails.map((x) => (x.id === g.id ? { ...x, users: list } : x)) }));
    say('Saved.');
    setResult(null);
    d.stop();
  };
  return (
    <Panel
      title="Who can use it"
      note={
        <>
          <b>{g.email}</b>{g.for ? ` · ${g.for}` : ''}. {g.sync ? `Syncing from ${fmtDate(g.since)}.` : 'Sync off.'} View: read only. View and send: reply and send from this address.
        </>
      }
      action={canEdit && <EditBar name={`who can use ${g.email}`} editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (setAdding(''), setResult(null), d.stop())} onSave={save} />}
      flush
    >
      {ed && <SaveBanner result={result} onReload={d.stop} />}
      {ed && (
        <div className="cfg__foot cfg__addusers">
          <Pick id={`eu-${g.id}`} label="Person to add" value={adding} placeholder="Pick a person" options={notIn.map((u) => [u.id, `${u.name} · ${u.role}`] as [string, string])} onChange={setAdding} />
          <Button
            variant="secondary"
            iconLeft={<Icon name="plus" size={16} />}
            disabled={!adding}
            onClick={() => {
              d.set((l) => [...l, { id: adding, perm: 'view' as EmailPerm }]);
              setAdding('');
            }}
          >
            Add a person
          </Button>
        </div>
      )}
      <p className="cfg__k cfg__foot">People</p>
      {list.length ? (
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Role</th>
                <th scope="col">Access</th>
                {ed && (
                  <th scope="col">
                    <span className="vh">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => {
                const u = userOf(x.id);
                if (!u) return null;
                return (
                  <tr key={x.id}>
                    <td>
                      <span className="cfg__strong">{u.name}</span>
                      <span className="cfg__sub">{u.email}</span>
                    </td>
                    <td className="cfg__muted">{u.role}</td>
                    <td>
                      {ed ? (
                        <Pick id={`ep-${g.id}-${x.id}`} label={`${u.name}: access`} value={x.perm} options={Object.entries(PERM) as [string, string][]} onChange={(val) => d.set((l) => l.map((z) => (z.id === x.id ? { ...z, perm: val as EmailPerm } : z)))} />
                      ) : (
                        PERM[x.perm]
                      )}
                    </td>
                    {ed && (
                      <td className="cfg__acts">
                        <button type="button" className="icon-btn" aria-label={`Remove ${u.name} from ${g.email}`} onClick={() => d.set((l) => l.filter((z) => z.id !== x.id))}>
                          <Icon name="close" size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager {...pager} thing="People" />
        </div>
      ) : (
        <Empty>No one can use this mailbox yet.</Empty>
      )}
    </Panel>
  );
}
