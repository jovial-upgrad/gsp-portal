import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { DateInput, Field, Switch, TextInput } from '../../components/forms';
import { useCheck, isEmail, dateError } from '../../components/validate';
import { fmtDate } from '../../data/format';
import { PageHead } from '../../institution/records/parts';
import { MultiPick } from '../../institution/records/MultiPick';
import { useStore } from '../../work/store';
import type { EmailGroup, EmailPerm } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';
import { Empty, Loaded, Pick, SaveBanner, ViewOnlyNote, istDay, trySave, type SaveResult } from './states';

const PERM: Record<EmailPerm, string> = { view: 'Can view', send: 'Can send' };
type WorkQueue = { id: string; name: string; leader: string; members: string[] };

/**
 * Shared mailboxes (PRD slice 1; Admin › User roles › Emails): GSP's shared inboxes the portal syncs, and who can use
 * each one. Each has an email (locked after the first save), what it's for, email sync and the date it syncs from,
 * its queues (from Admin › Work: their members get Can view and Can send, following the queue's membership) and the
 * people Admin adds by hand (Can view, the default, or Can send). A mailbox can't be deleted in this release
 * (proposal S1C-12): switch sync off to stop it. Reading and acting on the mail is Mail, a later slice.
 */
export function Emails({ cfg, change, say, canEdit }: ConfigProps) {
  const [cur, setCur] = useState(cfg.emails[0]?.id ?? '');
  const [edit, setEdit] = useState<EmailGroup | 'new' | null>(null);
  const work = useStore() as { queues: WorkQueue[] };
  const queues = (work.queues ?? []).filter((q) => q.id !== 'q-fallback');
  const g = cfg.emails.find((x) => x.id === cur) ?? cfg.emails[0];
  const viaQueues = (m: EmailGroup) => [...new Set(queues.filter((q) => (m.queues ?? []).includes(q.name)).flatMap((q) => [q.leader, ...q.members]).filter(Boolean))];
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
                  const n = new Set([...viaQueues(x), ...x.users.map((u) => u.id)]).size;
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
            {g && <Access key={g.id} g={g} cfg={cfg} queues={queues} change={change} say={say} canEdit={canEdit} />}
          </div>
        )}
      </Loaded>
      <History log={cfg.log} area="Emails" />

      <MailboxDialog
        open={!!edit}
        box={edit === 'new' ? null : edit}
        boxes={cfg.emails}
        queues={queues.map((q) => q.name)}
        onClose={() => setEdit(null)}
        onSave={(x) => {
          const was = cfg.emails.find((y) => y.id === x.id);
          if (!was) change('Emails', `Added ${x.email} (${x.for || 'no purpose'}): ${x.sync ? `syncs from ${fmtDate(x.since)}` : 'sync off'}; queues ${x.queues.join(', ') || 'none'}`, (c) => ({ ...c, emails: [...c.emails, { ...x, savedAt: Date.now() }] }));
          else {
            const diffs = (
              [
                ['for', was.for || '–', x.for || '–'],
                ['email sync', was.sync ? 'On' : 'Off', x.sync ? 'On' : 'Off'],
                ['sync from', fmtDate(was.since), fmtDate(x.since)],
                ['queues', was.queues.join(', ') || 'none', x.queues.join(', ') || 'none'],
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
function MailboxDialog({ open, box, boxes, queues, onClose, onSave }: { open: boolean; box: EmailGroup | null; boxes: EmailGroup[]; queues: string[]; onClose: () => void; onSave: (g: EmailGroup) => void }) {
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
        <Field id="eg-for" label="For" optional>
          <TextInput id="eg-for" value={v.for} maxLength={80} placeholder="Like: Partner onboarding" onChange={(e) => setV((x) => ({ ...x, for: e.target.value }))} />
        </Field>
        <Switch id="eg-sync" checked={v.sync} onChange={(sync) => setV((x) => ({ ...x, sync }))}>
          Email sync
        </Switch>
        {v.sync && (
          <Field id="eg-since" label="Sync from" required error={c.err('since')} hint="Mail before this date isn’t read.">
            <DateInput id="eg-since" value={v.since} invalid={!!c.err('since')} onBlur={c.blur('since')} onChange={(since) => setV((x) => ({ ...x, since }))} />
          </Field>
        )}
        <Field id="eg-queues" label="Queues" optional hint="From Admin › Work. Their members get the mailbox, Can view and Can send, and follow the queue’s membership.">
          <MultiPick id="eg-queues" label="Queues" value={v.queues} options={queues} empty="No queues" search onChange={(l) => setV((x) => ({ ...x, queues: l }))} />
        </Field>
      </div>
    </Sheet>
  );
}

/**
 * Who can use a mailbox: everyone in its queues (Can view and Can send, following membership), and the people Admin
 * adds by hand with Add a person (Can view, or Can send). Read only until Edit; removing someone takes them off at
 * once, and drafts they started stay with the mailbox.
 */
function Access({ g, cfg, queues, change, say, canEdit }: { g: EmailGroup; cfg: ConfigProps['cfg']; queues: WorkQueue[]; change: ConfigProps['change']; say: (m: string) => void; canEdit: boolean }) {
  const d = useDraft(g.users, `who can use ${g.email}`);
  const [adding, setAdding] = useState('');
  const [result, setResult] = useState<SaveResult | null>(null);
  const ed = d.editing;
  const list = d.value;
  const userOf = (id: string) => cfg.users.find((u) => u.id === id);
  const fromQueues = queues.filter((q) => g.queues.includes(q.name));
  const queueIds = new Set(fromQueues.flatMap((q) => [q.leader, ...q.members]).filter(Boolean));
  const notIn = cfg.users.filter((u) => u.status === 'Active' && !list.some((x) => x.id === u.id) && !queueIds.has(u.id));
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
          <b>{g.email}</b>. Can view: read only. Can send: reply and send from this address. People added by hand start as Can view.
        </>
      }
      action={canEdit && <EditBar name={`who can use ${g.email}`} editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (setAdding(''), setResult(null), d.stop())} onSave={save} />}
      flush
    >
      {ed && <SaveBanner result={result} onReload={d.stop} />}
      <div className="cfg__foot">
        <p className="cfg__k">From its queues</p>
        {fromQueues.length ? (
          <div className="cfg__chips">
            {fromQueues.map((q) => (
              <span key={q.id} className="cfg__chip cfg__chip--plain">
                {q.name} · {[q.leader, ...q.members].filter(Boolean).length} people, Can send
              </span>
            ))}
          </div>
        ) : (
          <p className="cfg__muted">No queues.</p>
        )}
      </div>
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
      <p className="cfg__k cfg__foot">Added by hand</p>
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
              {list.map((x) => {
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
                        <Pick id={`ep-${g.id}-${x.id}`} label={`${u.name}: access`} value={x.perm} options={[['view', 'Can view'], ['send', 'Can send']]} onChange={(val) => d.set((l) => l.map((z) => (z.id === x.id ? { ...z, perm: val as EmailPerm } : z)))} />
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
        </div>
      ) : (
        !fromQueues.length && <Empty>No one can use this mailbox yet.</Empty>
      )}
      {!list.length && fromQueues.length > 0 && <p className="cfg__muted cfg__foot">Nobody added by hand.</p>}
    </Panel>
  );
}
