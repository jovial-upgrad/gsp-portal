import { UPLOAD } from '../../data/uploads';
import { DateInput } from '../../components/forms';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { shortDate } from '../../data/dates';
import type { Student } from '../../data/students';
import { courseOf, type Application, type Cond, type Msg, type Need } from '../../data/applications';
import { DocButtons } from '../../components/DocView';
import { GSP_USER } from '../user';
import { AssistLabel } from './parts';
import { CondDialog, condViews } from '../../screens/applications/Conditions';

const ease = [0.2, 0.8, 0.2, 1] as const;
const time = (t: number) =>
  new Date(t).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
const when = (t: number) => (new Date(t).toDateString() === new Date().toDateString() ? time(t) : `${shortDate(new Date(t))}, ${time(t)}`);
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('');

/**
 * The chat, from GSP's side: free text between GSP's admissions team and the RP, with GSP's messages on the
 * right and the RP's on the left, and the university's emails where they fell. GSP Assist's replies to the RP
 * aren't shown here, though its mark heads the chat. Two templates: **Request document**, a title and a line on
 * what's needed, sent to the RP, which becomes a request card here and a "With RP" item in Documents; and
 * **Request conditions**, an offer's conditions as a form. A conditions card opens the form to view.
 */
export type AskSeed = { key: number; title: string; text: string };

export function Chat({
  a,
  s,
  agency,
  update,
  onShare,
  ask,
  focusKey,
  say,
}: {
  a: Application;
  s: Student;
  agency: string;
  update: (fn: (a: Application) => Application) => void;
  onShare: (file: string) => void;
  /** A request started elsewhere (a missing document in Documents): opens the template, filled in. */
  ask?: AskSeed;
  /** Changes when something asks to write in the chat, which puts the cursor in the message box. */
  focusKey?: number;
  say: (m: string) => void;
}) {
  const reduce = useReducedMotion();
  // GSP's messages are the signed-in person's
  const g = GSP_USER;
  // GSP Assist answers the RP in the RP's portal; GSP's team sees the people only
  const msgs = a.chat.filter((m) => m.from !== 'ai');
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(!!ask);
  // the other template: an offer's conditions, as a form of questions and documents
  const [conding, setConding] = useState(false);
  const [seed, setSeed] = useState(ask);
  // a conditions form opened from its card
  const [viewing, setViewing] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!ask) return;
    setSeed(ask);
    setAsking(true);
  }, [ask?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focusKey) window.setTimeout(() => box.current?.focus(), 240);
  }, [focusKey]);
  useEffect(() => {
    list.current?.scrollTo({
      top: list.current.scrollHeight,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [a.chat.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = (m: Omit<Msg, 'id' | 'at' | 'from' | 'name'>) => {
    const now = Date.now();
    // the RP sees a new message as unread until it opens the chat
    update((x) => ({
      ...x,
      unread: (x.unread ?? 0) + 1,
      chat: [
        ...x.chat,
        {
          id: `m${now}${Math.round(Math.random() * 1000)}`,
          at: now,
          from: 'gsp',
          name: g.name,
          ...m,
        },
      ],
    }));
  };
  const send = () => {
    const v = text.trim();
    if (!v) return;
    post({ text: v });
    setText('');
    say('Sent to the RP.');
  };
  const attach = (f: File | null) => {
    if (!f) return;
    post({ text: text.trim(), files: [f.name] });
    setText('');
    onShare(f.name);
    say(`${f.name} shared with the RP.`);
  };
  const request = (r: { title: string; text: string; due?: number }) => {
    const now = Date.now();
    const need: Need = {
      id: `req-${now}`,
      title: r.title,
      why: r.text,
      request: { by: g.name, at: now },
      due: r.due,
    };
    update((x) => ({
      ...x,
      unread: (x.unread ?? 0) + 1,
      needs: [...x.needs, need],
      chat: [
        ...x.chat,
        {
          id: `m${now}`,
          at: now,
          from: 'gsp',
          name: g.name,
          text: '',
          request: need.id,
          requestName: need.title,
        },
      ],
      history: [
        ...x.history,
        {
          at: now,
          who: 'gsp',
          text: `Asked the RP for the ${r.title.toLowerCase()}`,
          by: g.name,
        },
      ],
    }));
    setAsking(false);
    setSeed(undefined);
    say(`${r.title} requested from the RP.`);
  };
  const requestConds = (r: { title: string; items: Pick<Cond, 'text'>[]; due?: number }) => {
    const now = Date.now();
    const need: Need = {
      id: `conds-${now}`,
      title: r.title,
      why: `${r.items.length === 1 ? 'One condition' : `${r.items.length} conditions`} from ${courseOf(a).uni.name}’s offer. Answer them all, then send them to GSP.`,
      source: 'Conditional offer letter',
      request: { by: g.name, at: now },
      due: r.due,
      ...(a.status === 'conditions' ? { step: 'conditions' as const } : {}),
      form: r.items.map((x, i) => ({ id: `c${i + 1}`, kind: 'question' as const, text: x.text, source: `Condition ${i + 1}` })),
    };
    update((x) => ({
      ...x,
      unread: (x.unread ?? 0) + 1,
      needs: [...x.needs, need],
      chat: [...x.chat, { id: `m${now}`, at: now, from: 'gsp', name: g.name, text: '', request: need.id, requestName: need.title }],
      history: [...x.history, { at: now, who: 'gsp', text: `Sent ${r.items.length === 1 ? '1 condition' : `${r.items.length} conditions`} to answer: ${r.title}`, by: g.name }],
    }));
    setConding(false);
    say(`${r.title} sent to the RP.`);
  };

  return (
    <section className="card achat gchat" aria-labelledby="achat-title">
      <header className="achat__head">
        <div className="achat__titles">
          <AssistLabel eyebrow />
          <h2 id="achat-title" className="acard__title">
            Chat with {agency}
          </h2>
          <p className="acard__text">About {s.first}’s application. Your messages go to the RP.</p>
        </div>
      </header>

      <ol className="achat__list" ref={list} aria-live="polite" aria-relevant="additions">
        {msgs.length === 0 && (
          <li className="achat__empty">
            <p>No messages yet. Write to the RP, or request a document.</p>
          </li>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            // GSP's own on the right; the RP's and the university's on the left
            const side = m.from === 'gsp' ? 'you' : m.from === 'you' ? 'rp' : m.from;
            return (
              <motion.li
                key={m.id}
                className={`msg msg--${side}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease }}
              >
                {side !== 'you' && (
                  <span className="msg__av" aria-hidden="true">
                    {m.from === 'uni' ? <Icon name="building" size={16} /> : initials(m.name)}
                  </span>
                )}
                <div className="msg__body">
                  <p className="msg__who">
                    {m.from === 'gsp' ? (m.name === g.name ? 'You' : m.name) : m.name}
                    {m.from === 'gsp' && m.name !== g.name && <span className="msg__role"> · GSP</span>}
                    {m.from === 'you' && <span className="msg__role"> · RP</span>}
                    {m.via === 'email' && <span className="msg__role"> · by email</span>}
                    <span className="msg__time"> · {when(m.at)}</span>
                  </p>
                  <div className="msg__bubble">
                    {m.text && <p>{m.text}</p>}
                    {m.files?.map((f) => (
                      <span key={f} className="msg__file">
                        <Icon name="file" size={16} />
                        {f}
                        <DocButtons d={{ name: f, file: f }} s={s} />
                      </span>
                    ))}
                    {m.request && <RequestCard a={a} s={s} id={m.request} name={m.requestName} onView={setViewing} />}
                    {m.cites && m.cites.length > 0 && (
                      <p className="msg__cites">
                        <span className="vh">Sources: </span>
                        {m.cites.map((x) => (
                          <span key={x} className="msg__cite">
                            <Icon name="doc" size={12} />
                            {x}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      <div className="gchat__foot">
        <AnimatePresence initial={false}>
          {conding && <CondRequestForm key="conds" onSend={requestConds} onCancel={() => setConding(false)} />}
          {asking && (
            <RequestForm
              key={`req-${seed?.key ?? 0}`}
              init={seed}
              onSend={request}
              onCancel={() => {
                setAsking(false);
                setSeed(undefined);
              }}
            />
          )}
        </AnimatePresence>
        {!asking && !conding && (
          <div className="gchat__tools">
            <button
              type="button"
              className="gchat__tpl"
              aria-expanded={asking}
              onClick={() => {
                setSeed(undefined);
                setAsking(true);
              }}
            >
              <Icon name="doc" size={18} />
              Request document
            </button>
            <button type="button" className="gchat__tpl" aria-expanded={conding} onClick={() => setConding(true)}>
              <Icon name="edit" size={18} />
              Request conditions
            </button>
          </div>
        )}
        {!asking && !conding && (
          <form
            className="achat__compose"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="achat__attach" htmlFor="achat-file" title="Attach a document">
              <Icon name="attach" size={20} />
              <span className="vh">Attach a document</span>
            </label>
            <input
              id="achat-file"
              className="vh"
              type="file"
              accept={UPLOAD.accept}
              onChange={(e) => {
                attach(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <label className="vh" htmlFor="achat-input">
              Message
            </label>
            <textarea
              ref={box}
              id="achat-input"
              rows={1}
              value={text}
              placeholder={`Message ${agency}`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button type="submit" disabled={!text.trim()} aria-label="Send" iconLeft={<Icon name="arrowRight" size={18} />}>
              Send
            </Button>
          </form>
        )}
      </div>
      <CondDialog v={viewing ? condViews(a).find((v) => v.id === viewing) ?? null : null} s={s} onClose={() => setViewing(null)} />
    </section>
  );
}

/** The Request document template: what the document is, what's needed, and when by (optional). */
function RequestForm({ init, onSend, onCancel }: { init?: AskSeed; onSend: (r: { title: string; text: string; due?: number }) => void; onCancel: () => void }) {
  const reduce = useReducedMotion();
  const [title, setTitle] = useState(init?.title ?? '');
  const [text, setText] = useState(init?.text ?? '');
  const [due, setDue] = useState('');
  const [tried, setTried] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    window.setTimeout(() => ref.current?.focus(), 60);
  }, []);
  const dueOk = !due || /^\d{4}-\d{2}-\d{2}$/.test(due);
  const ok = title.trim().length > 1 && dueOk; // what's needed is optional (Jovial, 1 Nov)
  return (
    <motion.form
      className="greq"
      aria-label="Request a document"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease }}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (ok)
          onSend({
            title: title.trim(),
            text: text.trim(),
            due: due ? new Date(`${due}T23:59:00`).getTime() : undefined,
          });
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="greq__head">
        <p className="greq__k">
          <Icon name="doc" size={16} /> Request a document from the RP
        </p>
        <button type="button" className="proto__close" aria-label="Close the request" onClick={onCancel}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <label className="greq__field" htmlFor="greq-title">
        <span className="greq__label">Title</span>
        <span className={`control ${tried && title.trim().length < 2 ? 'is-invalid' : ''}`}>
          <input ref={ref} id="greq-title" className="control__input" value={title} placeholder="Like: Gap explanation document" onChange={(e) => setTitle(e.target.value)} />
        </span>
      </label>
      <label className="greq__field" htmlFor="greq-text">
        <span className="greq__label">What’s needed</span>
        <span className="control gstat__area">
          <textarea id="greq-text" className="control__input" rows={3} value={text} placeholder="What it should show, and why the university needs it" onChange={(e) => setText(e.target.value)} />
        </span>
      </label>
      <label className="greq__field greq__field--due" htmlFor="greq-due">
        <span className="greq__label">
          Due
        </span>
        <DateInput id="greq-due" value={due} invalid={(tried || due.length >= 10) && !dueOk} onChange={setDue} />
      </label>
      {tried && !ok && (
        <p className="gmail__err" role="alert">
          <Icon name="alert" size={14} />
          {title.trim().length < 2 ? 'Enter the title.' : 'Enter the due date as DD/MM/YYYY, like 05/11/2026.'}
        </p>
      )}
      <div className="greq__acts">
        <Button type="submit" size="sm" iconRight={<Icon name="arrowRight" size={16} />}>
          Send request
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </motion.form>
  );
}

/** A document request as GSP sees it: with the RP until they upload it, then in Documents. Conditions come as a form: the card opens it, with the RP's answers once sent. */
function RequestCard({ a, s, id, name, onView }: { a: Application; s: Student; id: string; name?: string; onView: (id: string) => void }) {
  const n = a.needs.find((x) => x.id === id);
  const done = !n ? a.files.find((f) => f.req === id) : undefined;
  const answered = !n ? a.conds?.find((x) => x.id === id) : undefined;
  if (n?.form || answered) {
    const count = (n?.form ?? answered!.items).length;
    return (
      <button type="button" className={`areq areq--form areq--open ${n ? '' : 'is-done'}`} onClick={() => onView(id)} aria-label={`View ${n?.title ?? answered?.title}`}>
        <span className="areq__ic" aria-hidden="true">
          <Icon name={n ? 'edit' : 'check'} size={16} strokeWidth={n ? 1.6 : 2.4} />
        </span>
        <span className="areq__t">
          <span className="areq__k">{n ? 'Conditions to answer' : 'Conditions answered'}</span>
          <span className="areq__title">{n?.title ?? answered?.title}</span>
          <span className="areq__why">
            {count === 1 ? '1 condition' : `${count} conditions`}
            {n ? ` for the RP to answer.${n.due ? ` Due ${shortDate(new Date(n.due))}.` : ''}` : `, answered by the RP ${shortDate(new Date(answered!.sent))}.`}
          </span>
          <span className="areq__view">
            View {n ? 'the conditions' : 'the answers'}
            <Icon name="arrowRight" size={14} />
          </span>
        </span>
        {n && <span className="who who--you">With RP</span>}
      </button>
    );
  }
  return (
    <div className={`areq ${n ? '' : 'is-done'}`}>
      <span className="areq__ic" aria-hidden="true">
        <Icon name={n ? 'doc' : 'check'} size={16} strokeWidth={n ? 1.6 : 2.4} />
      </span>
      <div className="areq__t">
        <p className="areq__k">Document request</p>
        <p className="areq__title">{n?.title ?? done?.name ?? name ?? 'Document'}</p>
        {n ? (
          <p className="areq__why">
            {n.why}
            {n.due ? ` Due ${shortDate(new Date(n.due))}.` : ''}
          </p>
        ) : (
          <p className="areq__why">{done ? `Uploaded: ${done.file}. In Documents.` : 'No longer needed.'}</p>
        )}
        {done && <DocButtons d={{ name: done.name, file: done.file }} s={s} />}
      </div>
      {n && <span className="who who--you">{n.file ? 'Uploaded, to check' : 'With RP'}</span>}
    </div>
  );
}

/**
 * The Request conditions template: an offer's conditions as a form for the RP, each a question to answer (always
 * a question: Nesil, 28 Oct), and when they're due (optional). The RP answers them all and sends them back together.
 */
function CondRequestForm({ onSend, onCancel }: { onSend: (r: { title: string; items: Pick<Cond, 'text'>[]; due?: number }) => void; onCancel: () => void }) {
  const reduce = useReducedMotion();
  const [title, setTitle] = useState('Offer conditions');
  const [items, setItems] = useState<Pick<Cond, 'text'>[]>([{ text: '' }]);
  const [due, setDue] = useState('');
  const [tried, setTried] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    window.setTimeout(() => first.current?.focus(), 60);
  }, []);
  const dueOk = !due || /^\d{4}-\d{2}-\d{2}$/.test(due);
  const ok = title.trim().length > 1 && items.every((x) => x.text.trim().length >= 5) && dueOk;
  const set = (i: number, patch: Partial<Pick<Cond, 'text'>>) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <motion.form
      className="greq gcond"
      aria-label="Request conditions"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease }}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (ok) onSend({ title: title.trim(), items: items.map((x) => ({ ...x, text: x.text.trim() })), due: due ? new Date(`${due}T23:59:00`).getTime() : undefined });
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="greq__head">
        <p className="greq__k">
          <Icon name="edit" size={16} /> Request conditions from the RP
        </p>
        <button type="button" className="proto__close" aria-label="Close the conditions" onClick={onCancel}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <label className="greq__field" htmlFor="gcond-title">
        <span className="greq__label">Title</span>
        <span className={`control ${tried && title.trim().length < 2 ? 'is-invalid' : ''}`}>
          <input id="gcond-title" className="control__input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </span>
      </label>
      <ol className="gcond__list">
        {items.map((x, i) => (
          <li key={i} className="gcond__row">
            <span className="gcond__n num" aria-hidden="true">
              {i + 1}
            </span>
            <span className={`control gcond__text ${tried && x.text.trim().length < 5 ? 'is-invalid' : ''}`}>
              <input
                ref={i === 0 ? first : undefined}
                id={`gcond-${i}`}
                className="control__input"
                value={x.text}
                aria-label={`Condition ${i + 1}`}
                placeholder={i === 0 ? 'Like: why this course and this university?' : 'A question for the student'}
                onChange={(e) => set(i, { text: e.target.value })}
              />
            </span>
            {items.length > 1 && (
              <button type="button" className="proto__close" aria-label={`Remove condition ${i + 1}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
                <Icon name="close" size={16} />
              </button>
            )}
          </li>
        ))}
      </ol>
      <Button type="button" size="sm" variant="ghost" iconLeft={<Icon name="plus" size={16} />} onClick={() => setItems((l) => [...l, { text: '' }])}>
        Add a condition
      </Button>
      <label className="greq__field greq__field--due" htmlFor="gcond-due">
        <span className="greq__label">
          Due
        </span>
        <DateInput id="gcond-due" value={due} invalid={(tried || due.length >= 10) && !dueOk} onChange={setDue} />
      </label>
      {tried && !ok && (
        <p className="gmail__err" role="alert">
          <Icon name="alert" size={14} />
          {title.trim().length < 2 ? 'Enter the title.' : !items.every((x) => x.text.trim().length >= 5) ? 'Write each condition in a few words.' : 'Enter the due date as DD/MM/YYYY, like 05/11/2026.'}
        </p>
      )}
      <div className="greq__acts">
        <Button type="submit" size="sm" iconRight={<Icon name="arrowRight" size={16} />}>
          Send conditions
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </motion.form>
  );
}
