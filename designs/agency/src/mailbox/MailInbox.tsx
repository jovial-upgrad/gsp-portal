import { useEffect, useMemo, useRef, useState } from 'react';
import { EditOnly, useViewOnly } from '../proto/viewOnly';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { SelectMenu } from '../components/SelectMenu';
import { SelectInput } from '../components/forms';
import { Toast, type ToastMsg } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { Paper, downloadDoc, openDoc } from '../components/DocView';
import { AssistMark, Thinking } from '../screens/applications/parts';
import { shortDate } from '../data/dates';
import { fullName, type Student } from '../data/students';
import { courseOf, type Application } from '../data/applications';
import {
  CATEGORIES,
  MAIL_GROUPS,
  categoryOf,
  SINCE,
  connect,
  disconnect,
  groupOf,
  initials,
  messagesOf,
  peopleOf,
  sizeText,
  summaryOf,
  type Attachment,
  type BoxMail,
  type ThreadMsg,
  type Folder,
  type MailCategory,
  type Mailbox,
} from '../data/mailbox';
import '../gsp/gsp.css';
import './mailbox.css';

const ease = [0.2, 0.8, 0.2, 1] as const;
const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
const when = (t: number) => (new Date(t).toDateString() === new Date().toDateString() ? time(t) : shortDate(new Date(t)));
/** A message's own words: without the quoted mail a reply carries under it. */
const ownText = (body: string) =>
  body
    .split(/\n\nOn [^\n]+ wrote:\n/)[0]
    .split('\n')
    .filter((l) => !/^>/.test(l))
    .join('\n')
    .trim();
const longWhen = (t: number) => `${new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}, ${time(t)}`;
const isMail = (x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
const split = (x: string) => x.split(/[,;\s]+/).filter(Boolean);

const FOLDERS: { key: Folder; label: string; icon: IconName }[] = [
  { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'draft', label: 'Drafts', icon: 'edit' },
  { key: 'archive', label: 'Archive', icon: 'archive' },
];
const EMPTY: Record<Folder, [string, string]> = {
  inbox: ['Nothing new', 'Mail sent to your inboxes lands here.'],
  sent: ['Nothing sent yet', 'Mail you send from these inboxes shows here.'],
  draft: ['No drafts', 'A mail you save without sending waits here.'],
  archive: ['Nothing archived', 'Archive a mail to take it out of the inbox and keep it here.'],
};
const fileIcon = (f: string): IconName => (/\.(png|jpe?g|webp)$/i.test(f) ? 'eye' : /\.(xlsx?|csv)$/i.test(f) ? 'sliders' : /\.ics$/i.test(f) ? 'calendar' : 'file');
const fileKind = (f: string) => (f.split('.').pop() ?? '').toUpperCase();

type Compose = { kind: 'new' | 'reply' | 'all' | 'forward'; of?: string; draft?: string; key: number };
type Draft = { group: string; to: string; cc: string; subject: string; body: string; files: Attachment[] };
type Me = { name: string; email: string };

/**
 * Inbox (Nesil, 3 Nov), in every GSP role but RP Admin: the mail of GSP's shared inboxes this person has connected.
 * Inbox, Sent, Drafts and Archive; filter by email group (All, as in GSP's mail tool today), search, or show only
 * mail with attachments. Open a mail to read it, reply, reply to all, forward or archive it, mark it unread, or have
 * GSP Assist sum it up; a mail about an application opens it. Attachments can be previewed, opened in a new tab or
 * downloaded. **Connect inboxes** adds or removes an email group and the date its mail syncs from.
 */
export function MailInbox({
  box,
  setBox,
  me,
  apps,
  students,
  onOpenApp,
  navKey,
}: {
  box: Mailbox;
  setBox: (fn: (b: Mailbox) => Mailbox) => void;
  me: Me;
  apps: Application[];
  students: Student[];
  onOpenApp?: (id: string) => void;
  /** Picking Inbox in the menu again starts it afresh. */
  navKey?: number;
}) {
  const [folder, setFolder] = useState<Folder>('inbox');
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const [withFiles, setWithFiles] = useState(false);
  // 5 Nov: the categories GSP sorts mail into (All, Not linked, Linked to an application, Forwarded, Others)
  const [cat, setCat] = useState<MailCategory | ''>('');
  // view only (6 Nov): read and search; nothing to send, link, forward, archive or connect
  const viewOnly = useViewOnly();
  const [sel, setSel] = useState<string | null>(null);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const say = (title: string, text?: string, icon: IconName = 'check') => setToast({ key: Date.now(), title, text, icon, tone: 'ok' });
  const paneRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // starting a mail (New mail, Reply, Forward, a draft) brings the writing area into view (Nesil, 3 Nov)
  useEffect(() => {
    if (!compose) return;
    const id = window.setTimeout(() => paneRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }), 40);
    return () => window.clearTimeout(id);
  }, [compose?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFolder('inbox');
    setCat('');
    setSel(null);
    setCompose(null);
  }, [navKey]);

  const connected = box.connected.map((c) => groupOf(c.group)!).filter(Boolean);
  const mine = (m: BoxMail) => box.connected.some((c) => c.group === m.group);
  const inGroup = (m: BoxMail) => mine(m) && (!group || m.group === group);
  const unread = (k?: string) => box.mails.filter((m) => m.folder === 'inbox' && !m.read && mine(m) && (k === undefined ? !group || m.group === group : m.group === k)).length;
  const drafts = box.mails.filter((m) => m.folder === 'draft' && inGroup(m)).length;
  const allUnread = connected.reduce((n, g) => n + unread(g.key), 0);

  const t = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      box.mails
        .filter((m) => m.folder === folder && inGroup(m))
        .filter((m) => !withFiles || m.files?.length)
        .filter((m) => !t || [m.subject, ...messagesOf(m).flatMap((x) => [x.from.name, x.from.email, x.body, ...x.to])].join(' ').toLowerCase().includes(t))
        .sort((a, b) => b.at - a.at),
    [box, folder, group, withFiles, t], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const list = cat ? shown.filter((m) => categoryOf(m) === cat) : shown;
  const inCat = (k: MailCategory) => shown.filter((m) => categoryOf(m) === k).length;
  const open = sel ? box.mails.find((m) => m.id === sel) : undefined;

  const pick = (m: BoxMail) => {
    // view only (6 Nov): a draft opens to read, not to write
    if (m.folder === 'draft' && !viewOnly) {
      setSel(null);
      setCompose({ kind: 'new', draft: m.id, key: Date.now() });
    } else {
      setCompose(null);
      setSel(m.id);
      if (!m.read) setBox((b) => ({ ...b, mails: b.mails.map((x) => (x.id === m.id ? { ...x, read: true } : x)) }));
    }
    // on phones the mail takes the list's place: start it at the top
    if (window.matchMedia('(max-width: 859px)').matches) window.setTimeout(() => paneRef.current?.scrollIntoView({ block: 'start' }), 30);
  };
  const goFolder = (f: Folder) => {
    setFolder(f);
    setSel(null);
    setCompose(null);
  };
  const move = (m: BoxMail, to: Folder) => {
    setBox((b) => ({ ...b, mails: b.mails.map((x) => (x.id === m.id ? { ...x, folder: to } : x)) }));
    setSel(null);
    say(to === 'archive' ? 'Archived' : 'Moved to Inbox', m.subject, to === 'archive' ? 'archive' : 'inbox');
  };
  const markUnread = (m: BoxMail) => {
    setBox((b) => ({ ...b, mails: b.mails.map((x) => (x.id === m.id ? { ...x, read: false } : x)) }));
    setSel(null);
  };
  // 5 Nov: a mail GSP couldn't place is linked to an application, or forwarded to the inbox it belongs in
  const link = (m: BoxMail, appId: string) => {
    setBox((b) => ({ ...b, mails: b.mails.map((x) => (x.id === m.id ? { ...x, app: appId } : x)) }));
    say('Linked to an application', `${appId}: the mail now shows in Linked to an application.`, 'doc');
  };
  const forward = (m: BoxMail, to: string) => {
    const now = Date.now();
    const g = groupOf(to);
    // the inbox it goes to gets its own copy, unread and not linked yet, saying where it came from
    const copy: BoxMail = { ...m, id: `mb-fw-${now}`, group: to, folder: 'inbox', read: false, at: now, app: undefined, forwarded: undefined, other: undefined, via: { from: m.group, by: me.name, at: now } };
    setBox((b) => ({ ...b, mails: [...b.mails.map((x) => (x.id === m.id ? { ...x, forwarded: { to, by: me.name, at: now } } : x)), copy] }));
    say(`Forwarded to ${g?.name}`, box.connected.some((c) => c.group === to) ? 'It’s in that inbox now, as well as here under Forwarded.' : 'Its team has it now. It stays here under Forwarded.', 'forward');
  };

  // what the composer starts with: blank, a reply quoting the mail, a forward carrying its files, or a saved draft
  const start = (c: Compose): Draft => {
    const home = (group || connected[0]?.key) ?? '';
    const d = c.draft ? box.mails.find((m) => m.id === c.draft) : undefined;
    if (d) return { group: d.group, to: d.to.join(', '), cc: (d.cc ?? []).join(', '), subject: d.subject, body: d.body, files: d.files ?? [] };
    const m = c.of ? box.mails.find((x) => x.id === c.of) : undefined;
    if (!m) return { group: home, to: '', cc: '', subject: '', body: '', files: [] };
    const ours = groupOf(m.group)?.email;
    const quote = `\n\nOn ${longWhen(m.at)}, ${m.from.name} wrote:\n${m.body
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n')}`;
    if (c.kind === 'forward')
      return {
        group: m.group,
        to: '',
        cc: '',
        subject: /^fwd:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`,
        body: `\n\n---------- Forwarded message ----------\nFrom: ${m.from.name} <${m.from.email}>\nDate: ${longWhen(m.at)}\nSubject: ${m.subject}\nTo: ${m.to.join(', ')}\n\n${m.body}`,
        files: m.files ?? [],
      };
    const to = m.folder === 'sent' ? m.to : [m.from.email];
    const others = c.kind === 'all' ? [...m.to, ...(m.cc ?? [])].filter((x) => x !== ours && x !== me.email && !to.includes(x)) : [];
    return { group: m.group, to: to.join(', '), cc: others.join(', '), subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`, body: quote, files: [] };
  };

  const save = (c: Compose, d: Draft, folderTo: 'sent' | 'draft') => {
    const g = groupOf(d.group)!;
    const of = c.of ? box.mails.find((m) => m.id === c.of) : undefined;
    const mail: BoxMail = {
      id: c.draft ?? `mb-${Date.now()}`,
      group: g.key,
      folder: folderTo,
      from: { name: me.name, email: g.email },
      to: split(d.to),
      cc: split(d.cc),
      subject: d.subject.trim() || '(No subject)',
      body: d.body,
      at: Date.now(),
      read: true,
      files: d.files,
      app: of?.app,
    };
    // a reply (not a forward) to a mail in the Inbox or Archive joins its thread, as the latest message (5 Nov)
    const joins = folderTo === 'sent' && of && c.kind !== 'forward' && (of.folder === 'inbox' || of.folder === 'archive');
    setBox((b) => ({
      ...b,
      mails: [
        ...b.mails
          .filter((m) => m.id !== mail.id)
          .map((m) =>
            joins && m.id === of!.id
              ? { ...m, thread: messagesOf(m), from: mail.from, to: mail.to, cc: mail.cc, body: ownText(d.body), files: d.files, at: mail.at, read: true }
              : m,
          ),
        mail,
      ],
    }));
    setCompose(null);
    if (folderTo === 'sent') {
      say('Sent', joins ? `Added to the thread, from ${g.name}` : `From ${g.name} to ${mail.to.join(', ')}`, 'send');
      setSel(of && of.folder !== 'draft' ? of.id : null);
    } else {
      say('Saved in Drafts', mail.subject, 'edit');
      setSel(of ? of.id : null);
    }
  };
  // 4 Nov: deleting a saved draft and disconnecting an inbox ask first
  const { ask, dialog } = useConfirm();
  const discard = (c: Compose) => {
    const close = () => {
      setCompose(null);
      setSel(c.of ?? null);
    };
    if (!c.draft) return close();
    ask({
      title: 'Delete this draft?',
      text: 'It leaves Drafts.',
      confirm: 'Delete',
      run: () => {
        setBox((b) => ({ ...b, mails: b.mails.filter((m) => m.id !== c.draft) }));
        say('Draft deleted', undefined, 'close');
        close();
      },
    });
  };

  const reading = !!compose || !!open;
  const noBoxes = connected.length === 0;

  return (
    <div className={`mbx ${reading ? 'is-reading' : ''}`}>
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">Inbox</h1>
          <p className="stu__lead">Mail from GSP’s shared inboxes you’ve connected.</p>
        </div>
        {!viewOnly && (
          <div className="mbx__acts">
            <Button variant="secondary" iconLeft={<Icon name="plus" size={18} />} onClick={() => setConnecting(true)}>
              Connect inboxes
            </Button>
            <Button
              iconLeft={<Icon name="edit" size={16} />}
              disabled={noBoxes}
              onClick={() => {
                setSel(null);
                setCompose({ kind: 'new', key: Date.now() });
              }}
            >
              New mail
            </Button>
          </div>
        )}
      </header>

      {noBoxes ? (
        <section className="card mbx__none">
          <span className="gmail__empty-ic" aria-hidden="true">
            <Icon name="inbox" size={22} />
          </span>
          <h2 className="gmail__empty-t">No inboxes connected</h2>
          <p className="acard__text">{viewOnly ? 'No shared inboxes are connected for you yet.' : 'Connect one of GSP’s shared inboxes to read its mail here and send from it.'}</p>
          {!viewOnly && (
            <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setConnecting(true)}>
              Connect inboxes
            </Button>
          )}
        </section>
      ) : (
        <>
          <div className="mbx__bar">
            <div className="mbx__folders" role="group" aria-label="Folders">
              {FOLDERS.map((f) => {
                const n = f.key === 'inbox' ? unread() : f.key === 'draft' ? drafts : 0;
                return (
                  <button key={f.key} type="button" className="mbx__folder" aria-pressed={folder === f.key} onClick={() => goFolder(f.key)}>
                    <Icon name={f.icon} size={18} />
                    {f.label}
                    {n > 0 && (
                      <span className="mbx__n num">
                        {n}
                        <span className="vh">{f.key === 'inbox' ? ' unread' : ''}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mbx__filters">
              <div className="mbx__group">
                <label htmlFor="mb-group" className="vh">
                  Email group
                </label>
                <SelectMenu
                  id="mb-group"
                  label="Email group"
                  value={group}
                  options={[
                    { value: '', label: 'All inboxes', note: allUnread ? String(allUnread) : undefined },
                    ...connected.map((g) => ({ value: g.key, label: g.name, note: unread(g.key) ? String(unread(g.key)) : undefined })),
                  ]}
                  onChange={(v) => {
                    setGroup(v);
                    setSel(null);
                  }}
                />
              </div>
              <div className="mbx__group mbx__cat">
                <label htmlFor="mb-cat" className="vh">
                  Category
                </label>
                <SelectMenu
                  id="mb-cat"
                  label="Category"
                  value={cat}
                  options={[{ value: '', label: 'All categories', note: String(shown.length) }, ...CATEGORIES.map((c) => ({ value: c.key, label: c.label, note: String(inCat(c.key)) }))]}
                  onChange={(v) => {
                    setCat(v as MailCategory | '');
                    setSel(null);
                  }}
                />
              </div>
              <label className="mbx__search">
                <Icon name="search" size={18} />
                <span className="vh">Search mail</span>
                <input type="search" value={q} placeholder="Search mail" onChange={(e) => setQ(e.target.value)} />
              </label>
              <button type="button" className="mbx__chip" aria-pressed={withFiles} onClick={() => setWithFiles((x) => !x)}>
                <Icon name="attach" size={16} />
                With attachments
              </button>
            </div>
          </div>

          <div className={`card mbx__panes ${reading ? 'is-reading' : ''}`}>
            <section className="mbx__list" aria-labelledby="mb-count">
              <p id="mb-count" className="mbx__count">
                {FOLDERS.find((f) => f.key === folder)!.label}
                {group ? ` · ${groupOf(group)?.name}` : ' · All inboxes'}
                {cat ? ` · ${CATEGORIES.find((c) => c.key === cat)!.label}` : ''}
                <span className="mbx__count-n">{list.length === 1 ? '1 mail' : `${list.length} mails`}</span>
              </p>
              {list.length === 0 ? (
                <div className="gmail__empty mbx__empty">
                  <span className="gmail__empty-ic" aria-hidden="true">
                    <Icon name={t || withFiles ? 'search' : FOLDERS.find((f) => f.key === folder)!.icon} size={22} />
                  </span>
                  {cat && shown.length > 0 ? (
                    <>
                      <p className="gmail__empty-t">{cat === 'unlinked' ? 'Nothing waiting to be linked' : `No mail in ${CATEGORIES.find((c) => c.key === cat)!.label}`}</p>
                      <p className="acard__text">{cat === 'unlinked' ? 'GSP has placed every mail here: linked, forwarded or in Others.' : 'Mail GSP sorts here shows in this list.'}</p>
                    </>
                  ) : t || withFiles ? (
                    <>
                      <p className="gmail__empty-t">No mail matches</p>
                      <button
                        type="button"
                        className="btn btn--link"
                        onClick={() => {
                          setQ('');
                          setWithFiles(false);
                        }}
                      >
                        Clear the search
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="gmail__empty-t">{EMPTY[folder][0]}</p>
                      <p className="acard__text">{EMPTY[folder][1]}</p>
                    </>
                  )}
                </div>
              ) : (
                <ul className="mbx__items">
                  {list.map((m) => {
                    const out = m.folder === 'sent' || m.folder === 'draft';
                    const on = sel === m.id || compose?.draft === m.id;
                    return (
                      <li key={m.id}>
                        <button type="button" className={`mbx__row ${m.read ? '' : 'is-unread'} ${on ? 'is-on' : ''}`} aria-current={on ? 'true' : undefined} onClick={() => pick(m)}>
                          <span className="mbx__av" aria-hidden="true">
                            {initials(out ? me.name : m.from.name)}
                          </span>
                          <span className="mbx__t">
                            <span className="mbx__line">
                              <span className="mbx__from">
                                {!m.read && (
                                  <>
                                    <span className="mbx__dot" aria-hidden="true" />
                                    <span className="vh">Unread: </span>
                                  </>
                                )}
                                {out ? `To: ${m.to.join(', ') || '(no one yet)'}` : m.thread?.length ? peopleOf(m, me.name).join(', ') : m.from.name}
                              </span>
                              <span className="mbx__when">{when(m.at)}</span>
                            </span>
                            <span className="mbx__subject">
                              {m.folder === 'draft' && <span className="gmail__tag gmail__tag--draft">Draft</span>} {m.subject}
                              {m.thread?.length ? (
                                <span className="mbx__n-msgs num" title={`${m.thread.length + 1} messages in this thread`}>
                                  {m.thread.length + 1}
                                  <span className="vh"> messages</span>
                                </span>
                              ) : null}
                            </span>
                            <span className="mbx__snip">{ownText(m.body).replace(/\s+/g, ' ').slice(0, 120)}</span>
                            <span className="mbx__tags">
                              {!group && <span className="mbx__tag">{groupOf(m.group)?.name}</span>}
                              {m.folder !== 'draft' && m.folder !== 'sent' && categoryOf(m) === 'unlinked' && <span className="mbx__tag mbx__tag--todo">Not linked</span>}
                              {m.app && <span className="mbx__tag mbx__tag--app">{m.app}</span>}
                              {m.forwarded && (
                                <span className="mbx__tag">
                                  <Icon name="forward" size={13} />
                                  {groupOf(m.forwarded.to)?.name}
                                </span>
                              )}
                              {m.files?.length ? (
                                <span className="mbx__tag mbx__tag--files">
                                  <Icon name="attach" size={13} />
                                  {m.files.length}
                                  <span className="vh">{m.files.length === 1 ? ' attachment' : ' attachments'}</span>
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="mbx__pane" ref={paneRef}>
              <AnimatePresence mode="wait" initial={false}>
                {compose ? (
                  <Composer
                    key={`c-${compose.key}`}
                    c={compose}
                    init={start(compose)}
                    groups={connected.map((g) => g.key)}
                    onSend={(d) => save(compose, d, 'sent')}
                    onDraft={(d) => save(compose, d, 'draft')}
                    onDiscard={() => discard(compose)}
                  />
                ) : open ? (
                  <Reader
                    key={`r-${open.id}`}
                    m={open}
                    me={me}
                    app={open.app ? apps.find((a) => a.id === open.app) : undefined}
                    students={students}
                    onOpenApp={onOpenApp}
                    onBack={() => setSel(null)}
                    onReply={(kind) => setCompose({ kind, of: open.id, key: Date.now() })}
                    onMove={(to) => move(open, to)}
                    onUnread={() => markUnread(open)}
                    apps={apps}
                    onLink={(id) => link(open, id)}
                    onForward={(to) => forward(open, to)}
                    say={say}
                  />
                ) : (
                  <motion.div key="none" className="gmail__empty mbx__pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                    <span className="gmail__empty-ic" aria-hidden="true">
                      <Icon name="mail" size={22} />
                    </span>
                    <p className="gmail__empty-t">Pick a mail to read it</p>
                    <p className="acard__text">{unread() ? `${unread()} unread in ${group ? groupOf(group)?.name : 'your inboxes'}.` : 'You’re all caught up.'}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}

      <ConnectSheet
        open={connecting}
        box={box}
        onClose={() => setConnecting(false)}
        onConnect={(key, days) => {
          setBox((b) => connect(b, key, days, apps, students, me));
          const g = groupOf(key)!;
          say(`${g.name} connected`, 'Its mail is in your Inbox now.', 'inbox');
        }}
        onDisconnect={(key) =>
          ask({
            title: `Disconnect ${groupOf(key)?.name ?? 'this inbox'}?`,
            text: 'Its mail no longer shows here. Connect it again to bring it back.',
            confirm: 'Disconnect',
            run: () => {
              setBox((b) => disconnect(b, key));
              if (group === key) setGroup('');
              if (open?.group === key) setSel(null);
              say(`${groupOf(key)?.name} disconnected`, 'Its mail no longer shows here.', 'close');
            },
          })
        }
      />
      {dialog}
      <Toast t={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/** One mail: who it's from and to, when, its actions, GSP Assist's summary on request, the text and its files. */
function Reader({
  m,
  me,
  app,
  students,
  onOpenApp,
  onBack,
  onReply,
  onMove,
  onUnread,
  apps,
  onLink,
  onForward,
  say,
}: {
  m: BoxMail;
  me: Me;
  app?: Application;
  students: Student[];
  onOpenApp?: (id: string) => void;
  onBack: () => void;
  onReply: (kind: 'reply' | 'all' | 'forward') => void;
  onMove: (to: Folder) => void;
  onUnread: () => void;
  apps: Application[];
  onLink: (appId: string) => void;
  onForward: (group: string) => void;
  say: (title: string, text?: string, icon?: IconName) => void;
}) {
  const reduce = useReducedMotion();
  const viewOnly = useViewOnly();
  const [sum, setSum] = useState<'idle' | 'busy' | 'done'>('idle');
  const [preview, setPreview] = useState<Attachment | null>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const g = groupOf(m.group);
  const out = m.folder === 'sent';
  const others = [...m.to, ...(m.cc ?? [])].filter((x) => x !== g?.email && x !== me.email);
  const student = app ? students.find((s) => s.id === app.studentId) : undefined;
  const view = (f: Attachment) => {
    if (!openDoc({ name: f.name, file: f.file })) say('This browser won’t open a new tab here', 'Use Preview or Download instead.', 'alert');
  };
  // a thread (5 Nov): the earlier messages fold to a line each; the latest is open
  const msgs = messagesOf(m);
  const earlier = msgs.slice(0, -1);
  const isThread = earlier.length > 0;
  const [unfolded, setUnfolded] = useState<string[]>([]);
  const allOpen = isThread && earlier.every((x) => unfolded.includes(x.id));
  const fold = (id: string) => setUnfolded((u) => (u.includes(id) ? u.filter((x) => x !== id) : [...u, id]));
  const meta = (x: ThreadMsg | BoxMail, big = true) => (
    <div className="gmail__meta">
      <span className={`mbx__av ${big ? 'mbx__av--lg' : ''}`} aria-hidden="true">
        {initials(x.from.name)}
      </span>
      <div className="gmail__who">
        <p>
          <strong>{x.from.name === me.name ? `${x.from.name} (you)` : x.from.name}</strong> <span className="muted">&lt;{x.from.email}&gt;</span>
        </p>
        <p className="muted">To: {x.to.join(', ')}</p>
        {x.cc?.length ? <p className="muted">Cc: {x.cc.join(', ')}</p> : null}
      </div>
      <p className="gmail__date muted">{longWhen(x.at)}</p>
    </div>
  );
  const files = (list: Attachment[] | undefined, id: string) =>
    list?.length ? (
      <section className="mbx__files" aria-labelledby={`mb-files-${id}`}>
        <h3 id={`mb-files-${id}`} className="mbx__files-k">
          {list.length === 1 ? '1 attachment' : `${list.length} attachments`}
        </h3>
        <ul className="mbx__file-list">
          {list.map((f) => (
            <li key={f.file} className="mbx__file">
              <button type="button" className="mbx__file-main" onClick={() => setPreview(f)} aria-label={`Preview ${f.file}`}>
                <span className="mbx__file-ic" aria-hidden="true">
                  <Icon name={fileIcon(f.file)} size={20} />
                </span>
                <span className="mbx__file-t">
                  <span className="mbx__file-name">{f.file}</span>
                  <span className="mbx__file-sub">
                    {f.name} · {fileKind(f.file)} · {sizeText(f.kb)}
                  </span>
                </span>
              </button>
              <span className="mbx__file-acts">
                <button type="button" className="dview__btn" title="Preview" aria-label={`Preview ${f.file}`} onClick={() => setPreview(f)}>
                  <Icon name="eye" size={16} />
                </button>
                <button type="button" className="dview__btn" title="Open in a new tab" aria-label={`Open ${f.file} in a new tab`} onClick={() => view(f)}>
                  <Icon name="external" size={16} />
                </button>
                <button type="button" className="dview__btn" title="Download" aria-label={`Download ${f.file}`} onClick={() => downloadDoc({ name: f.name, file: f.file })}>
                  <Icon name="download" size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    ) : null;
  return (
    <motion.article
      className="gmail__read mbx__read"
      aria-labelledby="mb-subject"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease }}
    >
      <button type="button" className="gmail__back mbx__back" onClick={onBack}>
        <Icon name="arrowLeft" size={16} />
        Back to the list
      </button>
      <div className="mbx__subj">
        <h2 id="mb-subject" className="gmail__title">
          {m.subject}
        </h2>
        <p className="mbx__tags">
          <span className="mbx__tag">{g?.name}</span>
          {isThread && <span className="mbx__tag mbx__tag--thread">{msgs.length} messages</span>}
          {m.folder === 'archive' && <span className="mbx__tag">Archived</span>}
        </p>
      </div>
      {!isThread && meta(m)}
      {app && onOpenApp && (
        <button type="button" className="mbx__app" onClick={() => onOpenApp(app.id)}>
          <Icon name="doc" size={18} />
          <span>
            <span className="mbx__app-k">About application {app.id}</span>
            <span className="mbx__app-v">{student ? fullName(student) : 'Open it'}</span>
          </span>
          <span className="mbx__app-go">
            Open application <Icon name="arrowRight" size={16} />
          </span>
        </button>
      )}
      <div className="gmail__acts mbx__actions">
        <EditOnly>
        <Button size="sm" variant="secondary" iconLeft={<Icon name="reply" size={16} />} onClick={() => onReply('reply')}>
          Reply
        </Button>
        {others.length > 0 && !out && (
          <Button size="sm" variant="secondary" iconLeft={<Icon name="reply" size={16} />} onClick={() => onReply('all')}>
            Reply all
          </Button>
        )}
        <Button size="sm" variant="secondary" iconLeft={<Icon name="forward" size={16} />} onClick={() => onReply('forward')}>
          Forward
        </Button>
        {m.folder === 'inbox' && (
          <Button size="sm" variant="ghost" iconLeft={<Icon name="archive" size={16} />} onClick={() => onMove('archive')}>
            Archive
          </Button>
        )}
        {m.folder === 'archive' && (
          <Button size="sm" variant="ghost" iconLeft={<Icon name="inbox" size={16} />} onClick={() => onMove('inbox')}>
            Move to Inbox
          </Button>
        )}
        {!out && (
          <Button size="sm" variant="ghost" iconLeft={<Icon name="mail" size={16} />} onClick={onUnread}>
            Mark as unread
          </Button>
        )}
        </EditOnly>
        {sum === 'idle' && (
          <button
            type="button"
            className="gmail__sum-btn"
            onClick={() => {
              setSum('busy');
              timer.current = window.setTimeout(() => setSum('done'), reduce ? 150 : 1100);
            }}
          >
            <AssistMark size={16} />
            Summarise
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {sum !== 'idle' && (
          <motion.section
            key="sum"
            className="gmail__sum"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease }}
          >
            <p className="gmail__sum-k">
              <AssistMark size={16} motion={sum === 'busy' ? 'busy' : 'idle'} /> GSP Assist · Summary
            </p>
            {sum === 'busy' ? (
              <Thinking text={isThread ? 'Reading the thread…' : 'Reading the mail…'} />
            ) : (
              <ul className="gmail__sum-list">
                {summaryOf(m).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </motion.section>
        )}
      </AnimatePresence>
      {m.via && (
        <p className="mbx__note">
          <Icon name="forward" size={16} />
          <span>
            Forwarded here from <strong>{groupOf(m.via.from)?.name}</strong> by {m.via.by === me.name ? 'you' : m.via.by}, {when(m.via.at)}
          </span>
        </p>
      )}
      {m.forwarded && (
        <p className="mbx__note">
          <Icon name="forward" size={16} />
          <span>
            Forwarded to <strong>{groupOf(m.forwarded.to)?.name}</strong> by {m.forwarded.by === me.name ? 'you' : m.forwarded.by}, {when(m.forwarded.at)}
          </span>
        </p>
      )}
      {categoryOf(m) === 'unlinked' && (m.folder === 'inbox' || m.folder === 'archive') && !viewOnly && <Unlinked key={m.id} m={m} apps={apps} students={students} onLink={onLink} onForward={onForward} />}
      {isThread ? (
        <section className="mbx__thread" aria-label={`${msgs.length} messages, oldest first`}>
          <div className="mbx__thread-head">
            <span className="mbx__thread-k">{earlier.length === 1 ? '1 earlier message' : `${earlier.length} earlier messages`}</span>
            <button type="button" className="btn btn--link" onClick={() => setUnfolded(allOpen ? [] : earlier.map((x) => x.id))}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          <ol className="mbx__msgs">
            {earlier.map((x) => {
              const on = unfolded.includes(x.id);
              return (
                <li key={x.id} className={`mbx__msg ${on ? 'is-open' : ''}`}>
                  {on ? (
                    <>
                      <button type="button" className="mbx__msg-fold" aria-expanded="true" onClick={() => fold(x.id)}>
                        <span className="vh">Collapse the message from {x.from.name}</span>
                        <Icon name="chevronDown" size={16} />
                      </button>
                      {meta(x, false)}
                      <div className="gmail__body">{ownText(x.body)}</div>
                      {files(x.files, x.id)}
                    </>
                  ) : (
                    <button type="button" className="mbx__msg-line" aria-expanded="false" onClick={() => fold(x.id)}>
                      <span className="mbx__av" aria-hidden="true">
                        {initials(x.from.name)}
                      </span>
                      <span className="mbx__msg-t">
                        <span className="mbx__msg-from">{x.from.name === me.name ? `${x.from.name} (you)` : x.from.name}</span>
                        <span className="mbx__msg-snip">{ownText(x.body).replace(/^(dear|hello|hi)[^\n]*\n+/i, '').replace(/\s+/g, ' ').slice(0, 140)}</span>
                      </span>
                      <span className="mbx__msg-when">
                        {x.files?.length ? (
                          <span className="mbx__msg-att" title={`${x.files.length} attached`}>
                            <Icon name="attach" size={14} />
                            <span className="vh">{x.files.length === 1 ? '1 attachment' : `${x.files.length} attachments`}</span>
                          </span>
                        ) : null}
                        {when(x.at)}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
            <li className="mbx__msg mbx__msg--last is-open" aria-current="true">
              <span className="mbx__msg-latest">Latest</span>
              {meta(m)}
              <div className="gmail__body">{ownText(m.body)}</div>
              {files(m.files, m.id)}
            </li>
          </ol>
        </section>
      ) : (
        <>
          <div className="gmail__body">{m.body}</div>
          {files(m.files, m.id)}
        </>
      )}
      <FileSheet f={preview} onClose={() => setPreview(null)} onView={view} />
    </motion.article>
  );
}

/**
 * The nudge on a mail GSP couldn't place (Nesil, 5 Nov), above its text: link it to an application, or forward it to
 * the inbox it belongs in. Applications whose student the mail names come first. Nothing picked shows an error.
 */
function Unlinked({ m, apps, students, onLink, onForward }: { m: BoxMail; apps: Application[]; students: Student[]; onLink: (id: string) => void; onForward: (group: string) => void }) {
  const [app, setApp] = useState('');
  const [to, setTo] = useState('');
  const [tried, setTried] = useState<'' | 'link' | 'forward'>('');
  const text = [m.subject, ...messagesOf(m).map((x) => x.body)].join(' ').toLowerCase();
  const opts = apps
    .map((a) => {
      const s = students.find((x) => x.id === a.studentId);
      const name = s ? fullName(s) : 'Student';
      const named = !!s && text.includes(name.toLowerCase());
      return { value: a.id, label: `${name} · ${courseOf(a).uni.name}`, note: a.id, group: named ? 'The mail names this student' : 'All applications', named };
    })
    .sort((a, b) => Number(b.named) - Number(a.named) || a.label.localeCompare(b.label))
    .map(({ named: _n, ...o }) => o);
  const boxes = MAIL_GROUPS.filter((g) => g.key !== m.group).map((g) => ({ value: g.key, label: g.name, note: g.email }));
  const id = `mb-nudge-${m.id}`;
  return (
    <section className="mbx__nudge" aria-labelledby={`${id}-t`}>
      <div className="mbx__nudge-head">
        <span className="mbx__nudge-ic" aria-hidden="true">
          <Icon name="attach" size={18} />
        </span>
        <div>
          <h3 id={`${id}-t`} className="mbx__nudge-t">
            Not linked to an application
          </h3>
          <p className="mbx__nudge-text">GSP couldn’t match this mail to an application. Do one of these: link it to an application, or forward it to the inbox it belongs in.</p>
        </div>
      </div>
      <div className="mbx__nudge-grid">
        <div className="mbx__nudge-col">
          <label className="field__label" htmlFor={`${id}-app`}>
            Link it to an application
          </label>
          <div className="mbx__nudge-row">
            <SelectMenu id={`${id}-app`} label="Applications" value={app} options={opts} placeholder="Choose an application" invalid={tried === 'link' && !app} describedBy={tried === 'link' && !app ? `${id}-app-err` : undefined} onChange={setApp} />
            <Button iconLeft={<Icon name="attach" size={16} />} onClick={() => (app ? onLink(app) : setTried('link'))}>
              Link
            </Button>
          </div>
          {tried === 'link' && !app && (
            <p className="field__msg field__msg--error" id={`${id}-app-err`} role="alert">
              <Icon name="alert" size={16} />
              <span>Choose the application this mail is about.</span>
            </p>
          )}
        </div>
        <div className="mbx__or" aria-hidden="true">
          <span>or</span>
        </div>
        <div className="mbx__nudge-col">
          <label className="field__label" htmlFor={`${id}-to`}>
            Forward it to another inbox
          </label>
          <div className="mbx__nudge-row">
            <SelectMenu id={`${id}-to`} label="Inboxes" value={to} options={boxes} placeholder="Choose an inbox" invalid={tried === 'forward' && !to} describedBy={tried === 'forward' && !to ? `${id}-to-err` : undefined} onChange={setTo} />
            <Button variant="secondary" iconLeft={<Icon name="forward" size={16} />} onClick={() => (to ? onForward(to) : setTried('forward'))}>
              Forward
            </Button>
          </div>
          {tried === 'forward' && !to && (
            <p className="field__msg field__msg--error" id={`${id}-to-err`} role="alert">
              <Icon name="alert" size={16} />
              <span>Choose the inbox to forward it to.</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** An attachment, opened: its first page, with Open in a new tab and Download. */
function FileSheet({ f, onClose, onView }: { f: Attachment | null; onClose: () => void; onView: (f: Attachment) => void }) {
  const [last, setLast] = useState<Attachment | null>(f);
  useEffect(() => {
    if (f) setLast(f);
  }, [f]);
  const d = f ?? last;
  return (
    <Sheet
      open={!!f}
      onClose={onClose}
      center
      className="dprev"
      title={d?.name ?? 'Attachment'}
      sub={
        <span className="dprev__file">
          {d?.file} · {d ? sizeText(d.kb) : ''}
        </span>
      }
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="secondary" iconLeft={<Icon name="external" size={16} />} onClick={() => d && onView(d)}>
              Open in a new tab
            </Button>
            <Button iconLeft={<Icon name="download" size={16} />} onClick={() => d && downloadDoc({ name: d.name, file: d.file })}>
              Download
            </Button>
          </div>
        </div>
      }
    >
      {d && <Paper d={{ name: d.name, file: d.file }} />}
    </Sheet>
  );
}

/** Writing a mail: which inbox it goes from, to, cc, subject, text and files. Send it, keep it as a draft, or discard it. */
function Composer({ c, init, groups, onSend, onDraft, onDiscard }: { c: Compose; init: Draft; groups: string[]; onSend: (d: Draft) => void; onDraft: (d: Draft) => void; onDiscard: () => void }) {
  const reduce = useReducedMotion();
  const [d, setD] = useState<Draft>(init);
  const [tried, setTried] = useState(false);
  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // a reply starts at the top of the text; anything else at the address
    const el = c.kind === 'reply' || c.kind === 'all' ? bodyRef.current : toRef.current;
    window.setTimeout(() => {
      el?.focus({ preventScroll: true });
      if (el === bodyRef.current) bodyRef.current?.setSelectionRange(0, 0);
    }, 60);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toOk = split(d.to).length > 0 && split(d.to).every(isMail);
  const ccOk = split(d.cc).every(isMail);
  const ok = toOk && ccOk && d.subject.trim() !== '' && d.body.trim() !== '';
  const title = c.draft ? 'Draft' : c.kind === 'reply' ? 'Reply' : c.kind === 'all' ? 'Reply all' : c.kind === 'forward' ? 'Forward' : 'New mail';
  const err = !toOk ? 'Add who it’s to, as an email address.' : !ccOk ? 'Cc takes email addresses only.' : !d.subject.trim() ? 'Add a subject.' : 'Write the message.';
  return (
    <motion.form
      className="gmail__compose mbx__compose"
      aria-labelledby="mb-compose-title"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease }}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (ok) onSend(d);
      }}
    >
      <h2 id="mb-compose-title" className="gmail__title">
        {title}
      </h2>
      <div className="gmail__fields">
        <label className="gmail__field" htmlFor="mb-from">
          <span className="gmail__label">From</span>
          <span className="mbx__from-pick">
            <SelectInput id="mb-from" value={d.group} onChange={(e) => setD({ ...d, group: e.target.value })} wrapClass="mbx__dd" btnClass="gmail__input mbx__select" anchorTo=".mbx__from-pick" minListWidth={280} noChevron>
              {groups.map((k) => {
                const g = groupOf(k)!;
                return (
                  <option key={k} value={k}>
                    {g.name} ({g.email})
                  </option>
                );
              })}
            </SelectInput>
            <Icon name="chevronDown" size={16} />
          </span>
        </label>
        <label className="gmail__field" htmlFor="mb-to">
          <span className="gmail__label">To</span>
          <input ref={toRef} id="mb-to" className={`gmail__input ${tried && !toOk ? 'is-bad' : ''}`} value={d.to} placeholder="name@university.edu" onChange={(e) => setD({ ...d, to: e.target.value })} />
        </label>
        <label className="gmail__field" htmlFor="mb-cc">
          <span className="gmail__label">Cc</span>
          <input id="mb-cc" className={`gmail__input ${tried && !ccOk ? 'is-bad' : ''}`} value={d.cc} placeholder="Optional" onChange={(e) => setD({ ...d, cc: e.target.value })} />
        </label>
        <label className="gmail__field" htmlFor="mb-subject">
          <span className="gmail__label">Subject</span>
          <input id="mb-subject" className={`gmail__input ${tried && !d.subject.trim() ? 'is-bad' : ''}`} value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} />
        </label>
      </div>
      <label className="vh" htmlFor="mb-body">
        Message
      </label>
      <textarea ref={bodyRef} id="mb-body" className={`gmail__text ${tried && !d.body.trim() ? 'is-bad' : ''}`} value={d.body} rows={10} onChange={(e) => setD({ ...d, body: e.target.value })} />
      <div className="mbx__attach">
        <button type="button" className="btn btn--link mbx__attach-btn" onClick={() => fileRef.current?.click()}>
          <Icon name="attach" size={16} />
          Attach files
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          aria-label="Attach files"
          onChange={(e) => {
            const add = [...(e.target.files ?? [])].map((f) => ({ name: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), file: f.name, kb: Math.max(1, Math.round(f.size / 1024)) }));
            setD((x) => ({ ...x, files: [...x.files.filter((y) => !add.some((a) => a.file === y.file)), ...add] }));
            e.target.value = '';
          }}
        />
        {d.files.length > 0 && (
          <ul className="mbx__chips">
            {d.files.map((f) => (
              <li key={f.file} className="mbx__fchip">
                <Icon name="file" size={14} />
                <span>{f.file}</span>
                <span className="mbx__fchip-kb">{sizeText(f.kb)}</span>
                <button type="button" className="mbx__fchip-x" aria-label={`Remove ${f.file}`} onClick={() => setD((x) => ({ ...x, files: x.files.filter((y) => y.file !== f.file) }))}>
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {tried && !ok && (
        <p className="gmail__err" role="alert">
          <Icon name="alert" size={14} />
          {err}
        </p>
      )}
      <div className="gmail__compose-acts">
        <Button type="submit" iconLeft={<Icon name="send" size={16} />}>
          Send
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDraft(d)}>
          Save draft
        </Button>
        <Button type="button" variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </motion.form>
  );
}

/**
 * Connect inboxes: every GSP email group, with whether it's connected and since when. Connecting one asks how far
 * back its mail syncs; it takes a moment, then its mail is in the Inbox. Disconnecting takes it off the page.
 */
function ConnectSheet({
  open,
  box,
  onClose,
  onConnect,
  onDisconnect,
}: {
  open: boolean;
  box: Mailbox;
  onClose: () => void;
  onConnect: (key: string, days: number) => void;
  onDisconnect: (key: string) => void;
}) {
  const reduce = useReducedMotion();
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState<string[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);
  const on = (k: string) => box.connected.find((c) => c.group === k);
  const n = box.connected.length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform mbx__connect"
      title="Connect inboxes"
      sub="GSP’s shared inboxes. Connect one to read its mail here and send from it."
      footer={
        <div className="asf">
          <p className="mbx__connect-n" role="status">
            <span className="num">{n}</span> of {MAIL_GROUPS.length} connected
          </p>
          <div className="asf__acts">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      }
    >
      <div className="mbx__since">
        <label htmlFor="mb-since" className="mbx__k">
          Bring in mail from
        </label>
        <span className="mbx__from-pick mbx__since-pick">
          <SelectInput id="mb-since" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} wrapClass="mbx__dd" btnClass="mbx__select" anchorTo=".mbx__since-pick" noChevron>
            {SINCE.map((s) => (
              <option key={s.days} value={s.days}>
                {s.label}
              </option>
            ))}
          </SelectInput>
          <Icon name="chevronDown" size={16} />
        </span>
      </div>
      <ul className="mbx__boxes" aria-label="Email groups">
        {MAIL_GROUPS.map((g) => {
          const c = on(g.key);
          const wait = busy.includes(g.key);
          return (
            <li key={g.key} className={`mbx__box ${c ? 'is-on' : ''}`}>
              <span className="mbx__box-ic" aria-hidden="true">
                <Icon name={c ? 'checkCircle' : 'inbox'} size={20} />
              </span>
              <span className="mbx__box-t">
                <span className="mbx__box-name">{g.name}</span>
                <span className="mbx__box-mail">{g.email}</span>
                {c && <span className="mbx__box-since">Connected · mail from {shortDate(new Date(c.since), true)}</span>}
              </span>
              {wait ? (
                <span className="mbx__box-busy" role="status">
                  <span className="btn__spinner" aria-hidden="true" /> Connecting…
                </span>
              ) : c ? (
                <Button size="sm" variant="ghost" onClick={() => onDisconnect(g.key)} aria-label={`Disconnect ${g.name}`}>
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Connect ${g.name}`}
                  onClick={() => {
                    setBusy((b) => [...b, g.key]);
                    timers.current.push(
                      window.setTimeout(
                        () => {
                          setBusy((b) => b.filter((x) => x !== g.key));
                          onConnect(g.key, days);
                        },
                        reduce ? 200 : 1200,
                      ),
                    );
                  }}
                >
                  Connect
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
