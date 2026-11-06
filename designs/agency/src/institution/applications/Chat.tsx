import { useEffect, useRef, useState } from 'react';
import { ViewOnlyNote, useViewOnly } from '../../proto/viewOnly';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { shortDate } from '../../data/dates';
import type { Student } from '../../data/students';
import type { Destination } from '../../data/courses';
import { ENROL_DOC_LONG, courseOf, destOf, named, type Application, type Cond, type Msg, type Need } from '../../data/applications';
import { DocButtons } from '../../components/DocView';
import { SelectMenu, type MenuOption } from '../../components/SelectMenu';
import { GSP_USER } from '../user';
import { AssistLabel } from './parts';
import { CondDialog, condViews } from '../../screens/applications/Conditions';
import './applications.css';

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
 * aren't shown here, though its mark heads the chat. Two templates: **Request document**, one or more documents
 * (4 Nov: numbered rows, each a type from a list or Other with its name) and a line on what's needed, sent to the
 * RP, each a request card here and a "With RP" item in Documents; and **Request conditions**, an offer's
 * conditions as a form. A conditions card opens the form to view.
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
  const viewOnly = useViewOnly();
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
  // several documents at once: a request (and its card) for each, with the same note and due date
  const request = (r: { titles: string[]; text: string; due?: number }) => {
    const now = Date.now();
    const needs: Need[] = r.titles.map((title, i) => ({
      id: r.titles.length === 1 ? `req-${now}` : `req-${now}-${i + 1}`,
      title,
      why: r.text,
      request: { by: g.name, at: now },
      due: r.due,
    }));
    const list = needs.map((n) => named(n.title));
    const said = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
    update((x) => ({
      ...x,
      unread: (x.unread ?? 0) + needs.length,
      needs: [...x.needs, ...needs],
      chat: [
        ...x.chat,
        ...needs.map((n, i) => ({
          id: `m${now}-${i + 1}`,
          at: now,
          from: 'gsp' as const,
          name: g.name,
          text: '',
          request: n.id,
          requestName: n.title,
        })),
      ],
      history: [
        ...x.history,
        {
          at: now,
          who: 'gsp',
          text: `Asked the RP for the ${said}`,
          by: g.name,
        },
      ],
    }));
    setAsking(false);
    setSeed(undefined);
    say(needs.length === 1 ? `${needs[0].title} requested from the RP.` : `${needs.length} documents requested from the RP.`);
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
            <p>{viewOnly ? 'No messages yet.' : 'No messages yet. Write to the RP, or request a document.'}</p>
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
              dest={destOf(a)}
              onSend={request}
              onCancel={() => {
                setAsking(false);
                setSeed(undefined);
              }}
            />
          )}
        </AnimatePresence>
        {viewOnly && <ViewOnlyNote>View only: you can read this chat, not write in it.</ViewOnlyNote>}
        {!viewOnly && !asking && !conding && (
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
        {!viewOnly && !asking && !conding && (
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
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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

/** What GSP can ask the RP for (Nesil, 4 Nov), then the application's own documents; Other takes a name. */
const OTHER = '__other';
function requestTypes(d: Destination): MenuOption[] {
  const asked: [string, string][] = [
    ['ITR', 'ITR'],
    ['Loan', 'Loan'],
    ['Marriage certificate', 'Marriage certificate'],
    ['Visa lodgement proof', 'Visa lodgement proof'],
    ['Visa', 'Visa'],
    // the request is named as the destination names it: a CoE, a CAS, an I-20
    [ENROL_DOC_LONG[d], 'Acceptance letter (CoE, CAS, I-20)'],
    ['Bank statement', 'Bank statement'],
  ];
  const own = ['Passport', '10th marksheet', '12th marksheet', 'UG marksheet', 'PG marksheet', 'English test score report', 'Statement of purpose', 'CV', 'Work experience letters', 'Gap explanation document', 'Payment proof', 'Portfolio', 'Research proposal'];
  return [...asked.map(([value, label]) => ({ value, label })), ...own.map((x) => ({ value: x, label: x })), { value: OTHER, label: 'Other (type its name)' }];
}
type Row = { type: string; name: string };

/** The Request document template: the documents (one or more, each a type from the list, or Other with its name), what's needed, and when by (optional). */
function RequestForm({ init, dest, onSend, onCancel }: { init?: AskSeed; dest: Destination; onSend: (r: { titles: string[]; text: string; due?: number }) => void; onCancel: () => void }) {
  const reduce = useReducedMotion();
  const types = requestTypes(dest);
  // a request started from Documents names its document: one of the list's, or an Other
  const first = (): Row => {
    const t = init?.title.trim();
    if (!t) return { type: '', name: '' };
    const hit = types.find((x) => x.value !== OTHER && x.value.toLowerCase() === t.toLowerCase());
    return hit ? { type: hit.value, name: '' } : { type: OTHER, name: t };
  };
  const [rows, setRows] = useState<Row[]>(() => [first()]);
  const [text, setText] = useState(init?.text ?? '');
  const [due, setDue] = useState('');
  const [tried, setTried] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('.smenu__btn')?.focus(), 60);
  }, []);
  const titleOf = (r: Row) => (r.type === OTHER ? r.name.trim() : r.type);
  const titles = rows.map(titleOf);
  // a document already asked for in an earlier row
  const again = (i: number) => !!titles[i] && titles.findIndex((t) => t.toLowerCase() === titles[i].toLowerCase()) < i;
  const noName = (r: Row) => r.type === OTHER && r.name.trim().length < 2;
  const twice = titles.find((_, i) => again(i));
  const err = rows.some((r) => !r.type)
    ? 'Pick a document for each row.'
    : rows.some(noName)
      ? 'Type the name of each other document.'
      : twice
        ? `${twice} is asked for twice.`
        : text.trim().length < 5
          ? 'Say what’s needed.'
          : '';
  const set = (i: number, patch: Partial<Row>) => setRows((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <motion.form
      className="greq greqs"
      aria-label="Request documents"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease }}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!err)
          onSend({
            titles,
            text: text.trim(),
            due: due ? new Date(`${due}T23:59:00`).getTime() : undefined,
          });
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="greq__head">
        <p className="greq__k">
          <Icon name="doc" size={16} /> Request documents from the RP
        </p>
        <button type="button" className="proto__close" aria-label="Close the request" onClick={onCancel}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="greqs__docs" ref={ref}>
        <p className="greq__label" id="greq-docs-l">
          Documents
        </p>
        <ol className="greqs__list" aria-labelledby="greq-docs-l">
          {rows.map((r, i) => (
            <li key={i} className={`greqs__row ${r.type === OTHER ? 'has-name' : ''}`}>
              <span className="gcond__n num" aria-hidden="true">
                {i + 1}
              </span>
              <SelectMenu
                id={`greq-type-${i}`}
                label={`Document ${i + 1}`}
                value={r.type}
                options={types}
                placeholder="Pick a document type"
                invalid={tried && (!r.type || (r.type !== OTHER && again(i)))}
                onChange={(v) => set(i, { type: v })}
              />
              {r.type === OTHER && (
                <span className={`control greqs__name ${tried && (noName(r) || again(i)) ? 'is-invalid' : ''}`}>
                  <input
                    id={`greq-name-${i}`}
                    className="control__input"
                    value={r.name}
                    aria-label={`Document ${i + 1}: its name`}
                    placeholder="The document’s name"
                    onChange={(e) => set(i, { name: e.target.value })}
                  />
                </span>
              )}
              {rows.length > 1 && (
                <button type="button" className="proto__close greqs__x" aria-label={`Remove document ${i + 1}`} onClick={() => setRows((l) => l.filter((_, j) => j !== i))}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </li>
          ))}
        </ol>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          iconLeft={<Icon name="plus" size={16} />}
          onClick={() => {
            const n = rows.length;
            setRows((l) => [...l, { type: '', name: '' }]);
            window.setTimeout(() => document.getElementById(`greq-type-${n}`)?.focus(), 40);
          }}
        >
          Add another document
        </Button>
      </div>
      <label className="greq__field greqs__what" htmlFor="greq-text">
        <span className="greq__label">What’s needed</span>
        <span className={`control gstat__area ${tried && text.trim().length < 5 ? 'is-invalid' : ''}`}>
          <textarea id="greq-text" className="control__input" rows={3} value={text} placeholder="What it should show, and why the university needs it" onChange={(e) => setText(e.target.value)} />
        </span>
      </label>
      <label className="greq__field greq__field--due greqs__due" htmlFor="greq-due">
        <span className="greq__label">
          Due <span className="muted">(optional)</span>
        </span>
        <span className="control">
          <input id="greq-due" className="control__input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </span>
      </label>
      {tried && err && (
        <p className="gmail__err" role="alert">
          <Icon name="alert" size={14} />
          {err}
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
  const ok = title.trim().length > 1 && items.every((x) => x.text.trim().length >= 5);
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
          Due <span className="muted">(optional)</span>
        </span>
        <span className="control">
          <input id="gcond-due" className="control__input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </span>
      </label>
      {tried && !ok && (
        <p className="gmail__err" role="alert">
          <Icon name="alert" size={14} />
          {title.trim().length < 2 ? 'Add a title.' : 'Write each condition in a few words.'}
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
