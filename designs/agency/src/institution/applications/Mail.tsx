import { useEffect, useRef, useState } from 'react';
import { EditOnly } from '../../proto/viewOnly';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DocButtons } from '../../components/DocView';
import type { University } from '../../data/courses';
import { shortDate } from '../../data/dates';
import { courseOf, type Application } from '../../data/applications';
import { APPLICATION_MAILBOX, appSubjectTag, groupOf, withAppTag } from '../../data/mailbox';
import { UniMark } from '../courses/parts';
import { AssistMark, Thinking } from './parts';
import { longDate, summaryOf, type Desk, type Mail } from './desk';

const ease = [0.2, 0.8, 0.2, 1] as const;
const time = (t: number) =>
  new Date(t).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
const when = (t: number) => (new Date(t).toDateString() === new Date().toDateString() ? time(t) : shortDate(new Date(t)));

type View =
  | { mode: 'list' }
  | { mode: 'read'; id: string }
  | {
      mode: 'compose';
      kind: 'new' | 'reply' | 'forward';
      of?: string;
      draft?: string;
    };
type Draft = { to: string; subject: string; body: string; files: string[] };

/**
 * Mail: the university's mail about this application, and what GSP sent back. Open one to read it, reply,
 * forward it, or have GSP Assist summarise it; write a new one, or keep it as a draft.
 */
export function MailTab({
  a,
  desk,
  setDesk,
  onLog,
  say,
}: {
  a: Application;
  desk: Desk;
  setDesk: (fn: (d: Desk) => Desk) => void;
  /** Adds a line to the application's activity. */
  onLog: (text: string) => void;
  say: (m: string) => void;
}) {
  const c = courseOf(a);
  // mail from an application record goes out only from the GSP Admission inbox, as that inbox (Jovial, 10 Nov, Q29)
  const box = groupOf(APPLICATION_MAILBOX)!;
  const g = { name: box.name, email: box.email };
  const me = box.email;
  const [view, setView] = useState<View>({ mode: 'list' });
  const mails = [...desk.mails].sort((x, y) => y.at - x.at);
  const open = view.mode === 'read' ? mails.find((m) => m.id === view.id) : undefined;

  const read = (m: Mail) => {
    if (m.box === 'draft') return setView({ mode: 'compose', kind: 'new', draft: m.id });
    if (!m.read)
      setDesk((d) => ({
        ...d,
        mails: d.mails.map((x) => (x.id === m.id ? { ...x, read: true } : x)),
      }));
    setView({ mode: 'read', id: m.id });
  };

  // what the composer starts with: blank, a reply quoting the mail, a forward carrying it and its files, or a saved draft
  const start = (v: Extract<View, { mode: 'compose' }>): Draft => {
    const d = v.draft ? desk.mails.find((m) => m.id === v.draft) : undefined;
    if (d)
      return {
        to: d.to.join(', '),
        subject: d.subject,
        body: d.body,
        files: d.files ?? [],
      };
    const m = v.of ? desk.mails.find((x) => x.id === v.of) : undefined;
    if (m && v.kind === 'reply')
      return {
        to: m.box === 'sent' ? m.to.join(', ') : m.from.email,
        subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`,
        body: `\n\nOn ${longDate(m.at)}, ${m.from.name} wrote:\n${m.body
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n')}`,
        files: [],
      };
    if (m && v.kind === 'forward')
      return {
        to: '',
        subject: /^fwd:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`,
        body: `\n\n---------- Forwarded message ----------\nFrom: ${m.from.name} <${m.from.email}>\nDate: ${longDate(m.at)}\nSubject: ${m.subject}\n\n${m.body}`,
        files: m.files ?? [],
      };
    return { to: '', subject: `${appSubjectTag(a)} · `, body: '', files: [] };
  };

  const save = (v: Extract<View, { mode: 'compose' }>, d: Draft, box: 'sent' | 'draft') => {
    const now = Date.now();
    const mail: Mail = {
      id: v.draft ?? `${a.id}-x${now}`,
      at: now,
      from: { name: g.name, email: me },
      to: d.to.split(/[,;\s]+/).filter(Boolean),
      subject: withAppTag(a, d.subject),
      body: d.body,
      files: d.files,
      box,
      read: true,
    };
    setDesk((x) => ({
      ...x,
      mails: [...x.mails.filter((m) => m.id !== mail.id), mail],
    }));
    if (box === 'sent') {
      onLog(`GSP emailed ${mail.to.join(', ')}: “${mail.subject}”`);
      say(`Sent to ${mail.to.join(', ')}.`);
      setView({ mode: 'read', id: mail.id });
    } else {
      say('Saved as a draft.');
      setView({ mode: 'list' });
    }
  };
  const discard = (v: Extract<View, { mode: 'compose' }>) => {
    if (v.draft)
      setDesk((x) => ({
        ...x,
        mails: x.mails.filter((m) => m.id !== v.draft),
      }));
    setView(v.of ? { mode: 'read', id: v.of } : { mode: 'list' });
  };

  return (
    <section className="card gmail" aria-labelledby="gmail-title">
      <AnimatePresence mode="wait" initial={false}>
        {view.mode === 'compose' ? (
          <Composer
            key={`c-${view.kind}-${view.of ?? view.draft ?? 'new'}`}
            v={view}
            init={start(view)}
            from={me}
            onSend={(d) => save(view, d, 'sent')}
            onDraft={(d) => save(view, d, 'draft')}
            onDiscard={() => discard(view)}
          />
        ) : open ? (
          <Reader
            key={`r-${open.id}`}
            m={open}
            uni={c.uni}
            onBack={() => setView({ mode: 'list' })}
            onReply={() => setView({ mode: 'compose', kind: 'reply', of: open.id })}
            onForward={() => setView({ mode: 'compose', kind: 'forward', of: open.id })}
          />
        ) : (
          <motion.div key="list" className="gmail__list-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            <header className="gmail__head">
              <div>
                <h2 id="gmail-title" className="acard__title">
                  Mail
                </h2>
                <p className="acard__text">
                  With {c.uni.name}, about this application
                  {mails.length ? ` · ${mails.length === 1 ? '1 mail' : `${mails.length} mails`}` : ''}
                </p>
              </div>
              <EditOnly>
              <Button size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setView({ mode: 'compose', kind: 'new' })}>
                New mail
              </Button>
              </EditOnly>
            </header>
            {mails.length === 0 ? (
              <div className="gmail__empty">
                <span className="gmail__empty-ic" aria-hidden="true">
                  <Icon name="mail" size={22} />
                </span>
                <p className="gmail__empty-t">No mail yet</p>
                <p className="acard__text">{c.uni.name}’s mail about this application lands here once it’s submitted.</p>
              </div>
            ) : (
              <ul className="gmail__items">
                {mails.map((m) => {
                  const ours = m.box !== 'in';
                  return (
                    <li key={m.id}>
                      <button type="button" className={`gmail__item ${m.read ? '' : 'is-unread'}`} onClick={() => read(m)}>
                        <span className="gmail__av" aria-hidden="true">
                          {ours ? (
                            m.from.name
                              .split(' ')
                              .map((p) => p[0])
                              .join('')
                          ) : (
                            <UniMark u={c.uni} />
                          )}
                        </span>
                        <span className="gmail__t">
                          <span className="gmail__row">
                            <span className="gmail__from">
                              {m.box === 'in' ? m.from.name : `To: ${m.to.join(', ') || '(no one yet)'}`}
                              {m.box === 'draft' && <span className="gmail__tag gmail__tag--draft">Draft</span>}
                              {m.box === 'sent' && <span className="gmail__tag">Sent</span>}
                            </span>
                            <span className="gmail__when">{when(m.at)}</span>
                          </span>
                          <span className="gmail__subject">
                            {!m.read && (
                              <>
                                <span className="gmail__dot" aria-hidden="true" />
                                <span className="vh">Unread: </span>
                              </>
                            )}
                            {m.subject}
                          </span>
                          <span className="gmail__snip">
                            {m.files?.length ? <Icon name="attach" size={14} /> : null}
                            {m.body.replace(/\s+/g, ' ').trim().slice(0, 140)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** One mail: who it's from and to, when, its actions, GSP Assist's summary on request, and the text. */
function Reader({ m, uni, onBack, onReply, onForward }: { m: Mail; uni: University; onBack: () => void; onReply: () => void; onForward: () => void }) {
  const reduce = useReducedMotion();
  const [sum, setSum] = useState<'idle' | 'busy' | 'done'>('idle');
  const t = useRef<number>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  const summarise = () => {
    setSum('busy');
    t.current = window.setTimeout(() => setSum('done'), reduce ? 150 : 1100);
  };
  return (
    <motion.article
      key={m.id}
      className="gmail__read"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease }}
    >
      <button type="button" className="gmail__back" onClick={onBack}>
        <Icon name="arrowLeft" size={16} />
        All mail
      </button>
      <h2 className="gmail__title">{m.subject}</h2>
      <div className="gmail__meta">
        <span className="gmail__av gmail__av--lg" aria-hidden="true">
          {m.box === 'in' ? (
            <UniMark u={uni} />
          ) : (
            m.from.name
              .split(' ')
              .map((p) => p[0])
              .join('')
          )}
        </span>
        <div className="gmail__who">
          <p>
            <strong>{m.from.name}</strong> <span className="muted">&lt;{m.from.email}&gt;</span>
          </p>
          <p className="muted">To: {m.to.join(', ')}</p>
        </div>
        <p className="gmail__date muted">
          {longDate(m.at)}, {time(m.at)}
        </p>
      </div>
      <div className="gmail__acts">
        <EditOnly>
        <Button size="sm" variant="secondary" iconLeft={<Icon name="arrowLeft" size={16} />} onClick={onReply}>
          Reply
        </Button>
        <Button size="sm" variant="secondary" iconLeft={<Icon name="arrowRight" size={16} />} onClick={onForward}>
          Forward
        </Button>
        </EditOnly>
        {sum === 'idle' && (
          <button type="button" className="gmail__sum-btn" onClick={summarise}>
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
              <Thinking text="Reading the mail…" />
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
      <div className="gmail__body">{m.body}</div>
      {m.files?.length ? (
        <p className="gmail__files">
          {m.files.map((f) => (
            <span key={f} className="msg__file">
              <Icon name="file" size={16} />
              {f}
              <DocButtons d={{ name: f, file: f }} />
            </span>
          ))}
        </p>
      ) : null}
    </motion.article>
  );
}

/** Writing a mail: to, subject and text, with what a forward carries. Send it, keep it as a draft, or discard it. */
function Composer({
  v,
  init,
  from,
  onSend,
  onDraft,
  onDiscard,
}: {
  v: Extract<View, { mode: 'compose' }>;
  init: Draft;
  from: string;
  onSend: (d: Draft) => void;
  onDraft: (d: Draft) => void;
  onDiscard: () => void;
}) {
  const reduce = useReducedMotion();
  const [d, setD] = useState<Draft>(init);
  const [tried, setTried] = useState(false);
  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    // a reply starts at the top of the text; anything else at the address
    const el = v.kind === 'reply' ? bodyRef.current : toRef.current;
    window.setTimeout(() => {
      el?.focus();
      if (el === bodyRef.current) bodyRef.current?.setSelectionRange(0, 0);
    }, 60);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toOk =
    d.to
      .split(/[,;\s]+/)
      .filter(Boolean)
      .every((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) && d.to.trim() !== '';
  const ok = toOk && d.subject.trim() !== '' && d.body.trim() !== '';
  const title = v.draft ? 'Draft' : v.kind === 'reply' ? 'Reply' : v.kind === 'forward' ? 'Forward' : 'New mail';
  return (
    <motion.form
      key="compose"
      className="gmail__compose"
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
      <h2 className="gmail__title">{title}</h2>
      <div className="gmail__fields">
        <div className="gmail__field">
          <span className="gmail__label">From</span>
          <span className="gmail__from-me">{from}</span>
        </div>
        <label className="gmail__field" htmlFor="gm-to">
          <span className="gmail__label">To</span>
          <input
            ref={toRef}
            id="gm-to"
            className={`gmail__input ${tried && !toOk ? 'is-bad' : ''}`}
            value={d.to}
            placeholder="name@university.edu"
            onChange={(e) => setD({ ...d, to: e.target.value })}
          />
        </label>
        <label className="gmail__field" htmlFor="gm-subject">
          <span className="gmail__label">Subject</span>
          <input id="gm-subject" className={`gmail__input ${tried && !d.subject.trim() ? 'is-bad' : ''}`} value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} />
        </label>
      </div>
      <label className="vh" htmlFor="gm-body">
        Message
      </label>
      <textarea ref={bodyRef} id="gm-body" className={`gmail__text ${tried && !d.body.trim() ? 'is-bad' : ''}`} value={d.body} rows={10} onChange={(e) => setD({ ...d, body: e.target.value })} />
      {d.files.length > 0 && (
        <p className="gmail__files">
          {d.files.map((f) => (
            <span key={f} className="msg__file">
              <Icon name="file" size={16} />
              {f}
              <DocButtons d={{ name: f, file: f }} />
            </span>
          ))}
        </p>
      )}
      {tried && !ok && (
        <p className="gmail__err" role="alert">
          <Icon name="alert" size={14} />
          {!toOk ? 'Add who it’s to, as an email address.' : !d.subject.trim() ? 'Add a subject.' : 'Write the message.'}
        </p>
      )}
      <div className="gmail__compose-acts">
        <Button type="submit" iconRight={<Icon name="arrowRight" size={16} />}>
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
