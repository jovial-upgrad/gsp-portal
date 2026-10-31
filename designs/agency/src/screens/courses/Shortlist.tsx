import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from '../../components/Icon';
import { Toast } from '../../components/Toast';
import { fullName, type Student } from '../../data/students';

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * Shortlisting with no student picked in the search: a short list of the agency's students drops from the star
 * (or the course dialog's Shortlist), with a box to find one. Each row is ticked when the course is on that
 * student's shortlist; picking a row adds it or takes it off. Arrows move, Enter or Space picks, Esc closes and
 * focus goes back to the star. It renders into the overlay layer, so a card or a dialog never clips it.
 */
export function StudentPick({
  anchor,
  course,
  students,
  has,
  onToggle,
  onClose,
}: {
  anchor: HTMLElement | null;
  course: string;
  students: Student[];
  /** The course is on this student's shortlist. */
  has: (s: Student) => boolean;
  onToggle: (s: Student) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');
  const list = students.filter((s) => fullName(s).toLowerCase().includes(q.trim().toLowerCase()));

  const place = () => {
    const b = anchor?.getBoundingClientRect();
    const l = layer?.getBoundingClientRect();
    if (!b || !l) return;
    const w = 300;
    const h = Math.min(360, 120 + students.length * 44);
    const up = b.bottom + h + 8 > l.bottom && b.top - h - 8 > l.top;
    const left = Math.max(8, Math.min(b.right - l.left - w, l.width - w - 8));
    setPos({ top: up ? b.top - l.top - 6 : b.bottom - l.top + 6, left, up });
  };
  useLayoutEffect(() => {
    if (!anchor) return;
    place();
    const on = () => place();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!anchor) return;
    setQ('');
    setActive(0);
    const t = window.setTimeout(() => input.current?.focus(), 20);
    const away = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!box.current?.contains(el) && !anchor.contains(el)) onClose();
    };
    // Esc closes it wherever focus is, and leaves a dialog under it open
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
      anchor.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc, true);
    };
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    onClose();
    anchor?.focus({ preventScroll: true });
  };
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (list[active]) onToggle(list[active]);
    } else if (e.key === 'Tab') close();
  };

  if (!layer) return null;
  return createPortal(
    <AnimatePresence>
      {anchor && pos && (
        <motion.div
          ref={box}
          className={`spick ${pos.up ? 'is-up' : ''}`}
          style={{ top: pos.top, left: pos.left }}
          role="dialog"
          aria-label={`Shortlist ${course} for a student`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: pos.up ? 4 : -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease }}
          onKeyDown={onKey}
        >
          <p className="spick__k">Shortlist for</p>
          <label className="spick__find">
            <Icon name="search" size={16} />
            <span className="vh">Find a student</span>
            <input
              ref={input}
              value={q}
              placeholder="Find a student"
              role="combobox"
              aria-expanded="true"
              aria-controls="spick-list"
              aria-activedescendant={list[active] ? `spick-${list[active].id}` : undefined}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
            />
          </label>
          <ul id="spick-list" className="spick__list" role="listbox" aria-multiselectable="true" aria-label="Students">
            {list.map((s, i) => {
              const on = has(s);
              return (
                <li
                  key={s.id}
                  id={`spick-${s.id}`}
                  role="option"
                  aria-selected={on}
                  className={`spick__opt ${i === active ? 'is-active' : ''} ${on ? 'is-on' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  // the find box keeps focus, so typing and arrows carry on
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onToggle(s)}
                >
                  <span className="spick__box" aria-hidden="true">
                    {on && <Icon name="check" size={12} strokeWidth={2.8} />}
                  </span>
                  <span className="spick__name">{fullName(s)}</span>
                  <span className="spick__where">{s.state ? `${s.state}, ${s.country || s.nationality}` : s.country || s.nationality}</span>
                </li>
              );
            })}
            {!list.length && <li className="spick__none">{students.length ? 'No student by that name.' : 'No students yet. Add one in Students.'}</li>}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>,
    layer,
  );
}

export type Nudge = { key: number; on: boolean; student: Student; course: string };

/**
 * After shortlisting for a student, as every notification shows (bottom left): "Shortlisted for Priya Raman", with the
 * course and a link to the shortlist on their profile; or "Taken off Priya Raman's shortlist".
 */
export function ShortNudge({ n, onView, onClose }: { n: Nudge | null; onView: (s: Student) => void; onClose: () => void }) {
  return (
    <Toast
      ms={7000}
      onClose={onClose}
      t={
        n && {
          key: n.key,
          icon: 'star',
          tone: n.on ? 'star' : 'plain',
          title: n.on ? `Shortlisted for ${fullName(n.student)}` : `Taken off ${fullName(n.student)}’s shortlist`,
          text: (
            <>
              {n.course}.{' '}
              <button type="button" className="toast__link" onClick={() => onView(n.student)}>
                View shortlisted courses in {n.student.first}’s profile
              </button>
            </>
          ),
        }
      }
    />
  );
}
