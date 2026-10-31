import { fmtDate } from '../../data/format';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from '../../components/Icon';
import { UNIVERSITIES } from '../../data/courses';
import { GlassRim } from '../../components/GlassRim';
import { Toast, type ToastMsg } from '../../components/Toast';
import { NOTE_KINDS, noticesFor, notesFor, notesFromChange, type Note, type NoteKind, type NoteTarget, type Notice } from '../../data/inbox';
import { courseOf, type Application } from '../../data/applications';
import { fullName, type Student } from '../../data/students';
import type { Announcement } from '../../institution/data/announcements';
import { ANN_CATEGORIES } from '../../institution/data/announcements';
import { UniMark } from '../courses/parts';
import './inbox.css';

const ease = [0.2, 0.8, 0.2, 1] as const;
const NOTE_ICON: Record<NoteKind, IconName> = { system: 'info', chat: 'chat', mail: 'mail' };

/** "Just now", "40 min ago", "3 h ago", "Yesterday", "3 days ago", then the date. */
function agoLabel(at: number) {
  const min = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (min < 2) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return fmtDate(at, { list: true });
}
const isToday = (at: number) => new Date(at).toDateString() === new Date().toDateString();
/** "Deakin", "Wollongong", "RMIT": a university's name without "University (of)". */
const shortName = (name: string) => name.replace(/University of |\s*University/g, '').trim();

/**
 * Everything a portal needs for its bell and megaphone (30 Oct; every role): the sample notifications for its role
 * and state, plus real ones from the other role while connected (`onIncoming`, for `useLinkedData`), and the
 * announcements it's sent. A change from the other role while the portal is open also shows as the bottom-left
 * notification, with Open.
 */
export function useInbox(o: {
  role: 'rp' | 'gsp';
  access: 'setup' | 'verifying' | 'all';
  agency: string;
  country?: string;
  apps: Application[];
  students: Student[];
  /** Announcements in the Institution Team's model, and its universities' names. */
  anns: { list: Announcement[]; names: Record<string, string> };
  onOpen: (t: NoteTarget) => void;
  onCourses: (university: string) => void;
}) {
  const [readIds, setReadIds] = useState<string[]>([]);
  const [live, setLive] = useState<Note[]>([]);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const sample = useMemo(
    () => notesFor(o.role, { access: o.access, agency: o.agency, apps: o.apps.map((a) => a.id), students: o.students.map((s) => s.id) }),
    [o.access, o.agency, o.apps.length, o.students.length], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const notes = useMemo(() => [...live, ...sample], [live, sample]);
  const notices = useMemo(() => noticesFor(o.role, o.anns.list, o.anns.names, o.country), [o.anns, o.role, o.country]);

  const open = (n: Note) => {
    setReadIds((l) => [...new Set([...l, n.id])]);
    setToast(null);
    if (n.to) o.onOpen(n.to);
  };
  const onIncoming = (before: Application | undefined, after: Application) => {
    const s = o.students.find((x) => x.id === after.studentId);
    const c = courseOf(after);
    const got = notesFromChange(o.role, before, after, { student: s ? fullName(s) : 'A new student', uni: c?.uni.name ?? 'the university', agency: o.agency });
    if (!got.length) return;
    setLive((l) => [...got.filter((n) => !l.some((x) => x.id === n.id)), ...l]);
    const n = got[got.length - 1];
    setToast({
      key: Date.now(),
      title: n.title,
      icon: NOTE_ICON[n.kind],
      text: (
        <>
          {n.text}{' '}
          <button type="button" className="toast__link" onClick={() => open(n)}>
            Open
          </button>
        </>
      ),
    });
  };

  const buttons = (glass: boolean) => (
    <InboxButtons glass={glass} notes={notes} anns={notices} read={readIds} setRead={setReadIds} onOpen={o.onOpen} onCourses={o.onCourses} />
  );
  return { corner: buttons(true), top: buttons(false), toast: <Toast t={toast} ms={7000} onClose={() => setToast(null)} />, onIncoming };
}

/**
 * The portal's bell and megaphone (Nesil, 30 Oct; every role): on wide screens two circles of liquid glass at the top
 * right, in a strip the page never scrolls behind; on phones, in the glass top bar. Each shows how many are unread and
 * opens a glass panel under it. **Notifications**: what the system did, chat messages and emails, filtered by All,
 * System, Chat or Mail; picking one opens what it's about. **Announcements**: what GSP's Institution Team publishes
 * about its universities, filtered by its categories; Search Deakin courses opens course search with the university
 * in the box. Opening a notification marks it read; announcements count as read once their panel closes. Mark all as
 * read clears the count at once.
 */
export function InboxButtons({
  notes,
  anns,
  read,
  setRead,
  onOpen,
  onCourses,
  glass = false,
}: {
  notes: Note[];
  anns: Notice[];
  /** Ids read in this session (on top of the ones that start read). */
  read: string[];
  setRead: (fn: (l: string[]) => string[]) => void;
  onOpen: (t: NoteTarget) => void;
  onCourses: (search: string) => void;
  /** Each button its own glass circle (wide screens); the phone top bar is glass already. */
  glass?: boolean;
}) {
  const [open, setOpen] = useState<'notes' | 'anns' | null>(null);
  const notesBtn = useRef<HTMLButtonElement>(null);
  const annsBtn = useRef<HTMLButtonElement>(null);
  const isRead = (x: { id: string; read?: boolean }) => !!x.read || read.includes(x.id);
  const unreadNotes = notes.filter((n) => !isRead(n)).length;
  const unreadAnns = anns.filter((a) => !isRead(a)).length;
  const markRead = (ids: string[]) => setRead((l) => [...new Set([...l, ...ids])]);
  const close = (refocus = true) => {
    const btn = open === 'notes' ? notesBtn.current : annsBtn.current;
    setOpen(null);
    if (refocus) btn?.focus({ preventScroll: true });
  };
  // announcements have nothing to open: the ones shown count as read once the panel closes (they stay marked new while it's open)
  const was = useRef(open);
  useEffect(() => {
    if (was.current === 'anns' && open !== 'anns') markRead(anns.map((a) => a.id));
    was.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const button = (k: 'notes' | 'anns', ref: React.RefObject<HTMLButtonElement>, icon: IconName, name: string, n: number) => (
    <button
      ref={ref}
      type="button"
      className={`ibtn ${glass ? 'ibtn--glass glass' : ''} ${open === k ? 'is-open' : ''}`}
      aria-label={n ? `${name}, ${n} unread` : name}
      aria-haspopup="dialog"
      aria-expanded={open === k}
      aria-controls={open === k ? `inbox-${k}` : undefined}
      onClick={() => setOpen((o) => (o === k ? null : k))}
    >
      {glass && <GlassRim />}
      <Icon name={icon} size={20} />
      {n > 0 && (
        <span className="ibtn__n num" aria-hidden="true">
          {n > 9 ? '9+' : n}
        </span>
      )}
    </button>
  );

  // the categories that have something, in the Institution Team's order
  const annKinds = ANN_CATEGORIES.filter((c) => anns.some((a) => a.kind === c)).map((c): [string, string] => [c, c]);

  return (
    <div className="ibtns">
      {button('notes', notesBtn, 'bell', 'Notifications', unreadNotes)}
      {button('anns', annsBtn, 'megaphone', 'Announcements', unreadAnns)}
      <Panel
        id="inbox-notes"
        anchor={open === 'notes' ? notesBtn.current : null}
        title="Notifications"
        kinds={NOTE_KINDS}
        items={notes}
        isRead={isRead}
        onAllRead={() => markRead(notes.map((n) => n.id))}
        onClose={close}
        empty={(k) => (k ? `No ${NOTE_KINDS.find(([x]) => x === k)?.[1].toLowerCase()} notifications.` : 'No notifications yet.')}
        row={(n) => (
          <button
            type="button"
            className={`inote ${isRead(n) ? '' : 'is-new'}`}
            onClick={() => {
              markRead([n.id]);
              close(false);
              if (n.to) onOpen(n.to);
            }}
          >
            <span className={`inote__icon inote__icon--${n.kind}`} aria-hidden="true">
              <Icon name={NOTE_ICON[n.kind]} size={18} />
            </span>
            <span className="inote__t">
              <span className="inote__title">
                {!isRead(n) && <span className="vh">Unread: </span>}
                {n.title}
              </span>
              <span className="inote__text">{n.text}</span>
              <span className="inote__meta">
                {NOTE_KINDS.find(([k]) => k === n.kind)?.[1]} · {agoLabel(n.at)}
              </span>
            </span>
            {!isRead(n) && <span className="inote__dot" aria-hidden="true" />}
          </button>
        )}
      />
      <Panel
        id="inbox-anns"
        anchor={open === 'anns' ? annsBtn.current : null}
        title="Announcements"
        sub="From GSP, about its universities"
        kinds={annKinds}
        items={anns}
        isRead={isRead}
        onAllRead={() => markRead(anns.map((a) => a.id))}
        onClose={close}
        empty={(k) => (k ? `Nothing in ${k} now.` : 'No announcements now.')}
        row={(a) => {
          const u = UNIVERSITIES.find((x) => x.id === a.uni);
          return (
            <div className={`iann ${isRead(a) ? '' : 'is-new'}`}>
              {u ? (
                <UniMark u={u} />
              ) : (
                <span className="inote__icon" aria-hidden="true">
                  <Icon name="megaphone" size={18} />
                </span>
              )}
              <div className="inote__t">
                <span className="inote__meta">
                  {a.uniName} · {a.tag}
                </span>
                <span className="inote__title">
                  {!isRead(a) && <span className="vh">New: </span>}
                  {a.title}
                </span>
                {a.text && <span className="inote__text">{a.text}</span>}
                <span className="iann__foot">
                  <span className="inote__meta">{agoLabel(a.at)}</span>
                  {u && (
                    <button
                      type="button"
                      className="iann__link"
                      onClick={() => {
                        markRead([a.id]);
                        close(false);
                        onCourses(u.name);
                      }}
                    >
                      Search {shortName(u.name)} courses
                      <Icon name="arrowRight" size={14} />
                    </button>
                  )}
                </span>
              </div>
              {!isRead(a) && <span className="inote__dot" aria-hidden="true" />}
            </div>
          );
        }}
      />
    </div>
  );
}

/**
 * The panel under a button: its title, Mark all as read, a pick of one (All and each kind, as pills that wrap, with unread counts),
 * then Today and Earlier. It renders into the overlay layer; Esc, a click outside or the button again closes it.
 */
function Panel<K extends string, T extends { id: string; kind: K; at: number; read?: boolean }>({
  id,
  anchor,
  title,
  sub,
  kinds,
  items,
  isRead,
  onAllRead,
  onClose,
  empty,
  row,
}: {
  id: string;
  anchor: HTMLElement | null;
  title: string;
  sub?: string;
  kinds: [K, string][];
  items: T[];
  isRead: (x: T) => boolean;
  onAllRead: () => void;
  onClose: (refocus?: boolean) => void;
  empty: (k: K | '') => string;
  row: (x: T) => ReactNode;
}) {
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<K | ''>('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');

  const place = () => {
    const b = anchor?.getBoundingClientRect();
    const l = layer?.getBoundingClientRect();
    if (!b || !l) return;
    // phones: the width of the screen, under the top bar; otherwise its right edge lines up with the button's
    const width = Math.min(420, l.width - 16);
    const left = l.width < 560 ? 8 : Math.max(8, Math.min(b.right - l.left - width, l.width - width - 8));
    setPos({ top: b.bottom - l.top + 8, left, width });
  };
  useLayoutEffect(() => {
    if (!anchor) return;
    setKind('');
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!anchor) return;
    const t = window.setTimeout(() => box.current?.focus({ preventScroll: true }), 30);
    const away = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!box.current?.contains(el) && !anchor.contains(el)) onClose(false);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = [...items].sort((a, b) => b.at - a.at).filter((x) => !kind || x.kind === kind);
  const unread = (k: K | '') => items.filter((x) => (!k || x.kind === k) && !isRead(x)).length;
  const groups: [string, T[]][] = [
    ['Today', list.filter((x) => isToday(x.at))],
    ['Earlier', list.filter((x) => !isToday(x.at))],
  ];

  if (!layer) return null;
  return createPortal(
    <AnimatePresence>
      {anchor && pos && (
        <motion.div
          ref={box}
          id={id}
          className="inbox glass"
          role="dialog"
          aria-labelledby={`${id}-title`}
          tabIndex={-1}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease }}
        >
          <GlassRim />
          <div className="inbox__head">
            <div className="inbox__lead">
              <h2 id={`${id}-title`} className="inbox__title">
                {title}
              </h2>
              {sub && <p className="inbox__sub">{sub}</p>}
            </div>
            {unread('') > 0 && (
              <button type="button" className="inbox__all" onClick={onAllRead}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="ichips" role="group" aria-label={`Show ${title.toLowerCase()}`}>
            {([['', 'All'], ...kinds] as [K | '', string][]).map(([k, label]) => (
              <button key={k || 'all'} type="button" className="ichip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {label}
                {unread(k) > 0 && (
                  <span className="ichip__n num">
                    {unread(k)}
                    <span className="vh"> unread</span>
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="inbox__body">
            {list.length ? (
              groups
                .filter(([, l]) => l.length)
                .map(([g, l]) => (
                  <section key={g} className="inbox__group" aria-label={g}>
                    <h3 className="inbox__k">{g}</h3>
                    <ul className="inbox__list">
                      {l.map((x) => (
                        <li key={x.id}>{row(x)}</li>
                      ))}
                    </ul>
                  </section>
                ))
            ) : (
              <p className="inbox__none">{empty(kind)}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    layer,
  );
}
