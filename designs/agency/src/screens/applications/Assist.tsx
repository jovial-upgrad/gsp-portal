import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { shortDate } from '../../data/dates';
import type { Student } from '../../data/students';
import { courseOf, gspContact, type Application, type Msg, type Need } from '../../data/applications';
import { DocButtons } from '../../components/DocView';
import { AssistLabel, Thinking } from './parts';

const ease = [0.2, 0.8, 0.2, 1] as const;
const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
const when = (t: number) => (new Date(t).toDateString() === new Date().toDateString() ? time(t) : `${shortDate(new Date(t))}, ${time(t)}`);
const initials = (n: string) =>
  n
    .split(' ')
    .map((p) => p[0])
    .join('');

/** How many conditions, and what kind: all questions now (Nesil, 28 Oct), with documents only in older forms. */
const condCount = (f: { kind: string }[]) => {
  const docs = f.filter((c) => c.kind === 'document').length;
  const n = f.length === 1 ? '1 condition' : `${f.length} conditions`;
  return docs ? `${n}: ${docs} to upload, ${f.length - docs} to answer.` : `${n} to answer.`;
};
/**
 * The chat about an application: free text between the agency and its GSP contact, plus GSP's document
 * requests (a document, or an offer's conditions as a form), which can be answered in place. No GSP Assist here (Nesil, 27 Oct): nothing answers on its own,
 * and older GSP Assist messages don't show. University emails are placed in it automatically. No attachments:
 * documents go in Documents.
 */
export function Assist({
  a,
  s,
  me,
  update,
  onNeedFile,
  onForm,
  say,
}: {
  a: Application;
  s: Student;
  me: string;
  update: (fn: (a: Application) => Application) => void;
  /** A file for a document GSP asked for, uploaded from its request card. */
  onNeedFile: (n: Need, file: string) => void;
  /** An offer's conditions, from their card: the form opens. */
  onForm: (n: Need) => void;
  say: (m: string) => void;
}) {
  const reduce = useReducedMotion();
  const c = courseOf(a);
  const g = gspContact(c.uni.country);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const timers = useRef<number[]>([]);
  const chat = a.chat.filter((m) => m.from !== 'ai');
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [chat.length, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (m: Omit<Msg, 'id' | 'at'>) => {
    const now = Date.now();
    update((x) => ({ ...x, chat: [...x.chat, { ...m, id: `m${now}${Math.round(Math.random() * 1000)}`, at: now }] }));
  };

  /** The message goes to GSP; in the prototype, the contact says they're on it. */
  const send = (q: string) => {
    const v = q.trim();
    if (!v || busy) return;
    const first = !chat.some((m) => m.from === 'gsp' && m.at > Date.now() - 60 * 60_000);
    push({ from: 'you', name: me, text: v });
    setText('');
    setBusy(true);
    timers.current.push(
      window.setTimeout(
        () => {
          push({
            from: 'gsp',
            name: g.name,
            text: first ? `Hi ${me.split(' ')[0]}, ${g.first} here. I’ll look into it and reply here by ${time(Date.now() + 2 * 3_600_000)}.` : 'Thanks, noted. I’ll come back to you here.',
          });
          setBusy(false);
          say(`${g.name} replied.`);
        },
        reduce ? 300 : 2200,
      ),
    );
  };

  return (
    <section className="card achat" aria-labelledby="achat-title">
      <header className="achat__head">
        <div className="achat__titles">
          <AssistLabel eyebrow />
          <h2 id="achat-title" className="acard__title">
            Chat about {s.first}’s application
          </h2>
        </div>
      </header>

      <ol className="achat__list" ref={list} aria-live="polite" aria-relevant="additions">
        {chat.length === 0 && (
          <li className="achat__empty">
            <Icon name="chat" size={28} />
            <p>
              Message {g.first} at GSP about this application: what’s left, when the offer comes, anything else. {g.first} replies here.
            </p>
          </li>
        )}
        <AnimatePresence initial={false}>
          {chat.map((m) => (
            <motion.li
              key={m.id}
              className={`msg msg--${m.from}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24, ease }}
            >
              {m.from !== 'you' && (
                <span className="msg__av" aria-hidden="true">
                  {m.from === 'uni' ? <Icon name="building" size={16} /> : initials(m.name)}
                </span>
              )}
              <div className="msg__body">
                <p className="msg__who">
                  {m.from === 'you' ? 'You' : m.name}
                  {m.from === 'gsp' && <span className="msg__role"> · GSP</span>}
                  {m.via === 'email' && <span className="msg__role"> · by email, placed here automatically</span>}
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
                  {m.request && <RequestCard a={a} s={s} id={m.request} name={m.requestName} onFile={onNeedFile} onForm={onForm} />}
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {busy && (
          <li className="msg msg--gsp msg--typing">
            <span className="msg__av" aria-hidden="true">
              {initials(g.name)}
            </span>
            <div className="msg__body">
              <div className="msg__bubble">
                <span className="msg__typing" role="status">
                  <span className="msg__dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  {g.first} is typing…
                </span>
              </div>
            </div>
          </li>
        )}
      </ol>

      <form
        className="achat__compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label className="vh" htmlFor="achat-input">
          Message
        </label>
        <textarea
          id="achat-input"
          rows={1}
          value={text}
          placeholder="Ask GSP…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <Button type="submit" disabled={!text.trim() || busy} aria-label="Send" iconLeft={<Icon name="arrowRight" size={18} />}>
          Send
        </Button>
      </form>
    </section>
  );
}

/** GSP's document request, answered in place: upload here, or see that it's done (or no longer needed). An offer's conditions come as a form. */
function RequestCard({ a, s, id, name, onFile, onForm }: { a: Application; s: Student; id: string; name?: string; onFile: (n: Need, file: string) => void; onForm: (n: Need) => void }) {
  const n = a.needs.find((x) => x.id === id);
  const done = !n ? a.files.find((f) => f.req === id) : undefined;
  const answered = !n ? a.conds?.find((x) => x.id === id) : undefined;
  const inputId = `req-${id}`;
  if (n?.form || answered)
    return (
      <div className={`areq areq--form ${n ? '' : 'is-done'}`}>
        <span className="areq__ic" aria-hidden="true">
          <Icon name={n ? 'doc' : 'check'} size={16} strokeWidth={n ? 1.6 : 2.4} />
        </span>
        <div className="areq__t">
          <p className="areq__k">Conditions to answer</p>
          <p className="areq__title">{n?.title ?? answered?.title}</p>
          {n ? (
            <p className="areq__why">
              {condCount(n.form!)}
              {n.due ? ` Due ${shortDate(new Date(n.due))}.` : ''}
            </p>
          ) : (
            <p className="areq__why">Answered and sent to GSP, {shortDate(new Date(answered!.sent))}.</p>
          )}
        </div>
        {n && (
          <Button size="sm" onClick={() => onForm(n)} iconRight={<Icon name="arrowRight" size={16} />}>
            Open the form
          </Button>
        )}
      </div>
    );
  return (
    <div className={`areq ${n ? '' : 'is-done'}`}>
      <span className="areq__ic" aria-hidden="true">
        <Icon name={n ? 'upload' : 'check'} size={16} strokeWidth={n ? 1.6 : 2.4} />
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
          <p className="areq__why">{done ? `Uploaded: ${done.file}. Sent to GSP.` : 'No longer needed.'}</p>
        )}
        {done && <DocButtons d={{ name: done.name, file: done.file }} s={s} />}
        {n?.check === 'reading' && <Thinking text="GSP Assist is reading it…" />}
        {n?.check === 'flag' && <p className="areq__flag">{n.note} Replace it, or keep it from Documents.</p>}
      </div>
      {n && n.check !== 'reading' && (
        <>
          <label className="btn btn--primary btn--sm nrow__pick" htmlFor={inputId}>
            <Icon name="upload" size={16} /> {n.file ? 'Replace' : 'Upload'}
          </label>
          <input
            id={inputId}
            className="vh"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            aria-label={`Upload ${n.title}`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(n, f.name);
              e.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}
