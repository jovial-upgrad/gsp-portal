import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useViewOnly } from '../proto/viewOnly';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from './Icon';
import './counsellor.css';

export type PickerMember = { id: string; name: string };

const initials = (n: string) =>
  n
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/**
 * The counsellor as a name with a pencil beside it. The pencil opens a short list of the team; picking
 * someone else hands the choice back (the page confirms it first, since it changes who sees the student).
 * The list is a listbox: arrows move, Enter or Space picks, Esc closes and focus returns to the pencil.
 * It renders into the overlay layer so a table that scrolls sideways never clips it.
 */
export function CounsellorPicker({
  id,
  value,
  team,
  label,
  counts,
  onPick,
  size = 'sm',
}: {
  id: string;
  value: string;
  team: PickerMember[];
  /** Names the pencil for screen readers: "Change counsellor for Priya Raman". */
  label: string;
  /** How many students each counsellor has, shown beside their name in the list. */
  counts?: Record<string, number>;
  onPick: (id: string) => void;
  size?: 'sm' | 'md';
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = team.find((m) => m.id === value);
  const viewOnly = useViewOnly();
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');

  const place = () => {
    const b = btn.current?.getBoundingClientRect();
    const l = layer?.getBoundingClientRect();
    if (!b || !l) return;
    const w = 264;
    const h = 56 + team.length * 48;
    const up = b.bottom + h + 8 > l.bottom && b.top - h - 8 > l.top;
    const left = Math.max(8, Math.min(b.right - l.left - w + 6, l.width - w - 8));
    setPos({ top: up ? b.top - l.top - 6 : b.bottom - l.top + 6, left, up });
  };
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const on = () => place();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // the list takes focus on the person who has the student now
  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, team.findIndex((m) => m.id === value)));
    const t = window.setTimeout(() => list.current?.focus(), 10);
    const away = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!list.current?.parentElement?.contains(el) && !btn.current?.contains(el)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    setOpen(false);
    btn.current?.focus({ preventScroll: true });
  };
  const pick = (m: PickerMember) => {
    close();
    if (m.id !== value) onPick(m.id);
  };
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // Tab carries on from the pencil, not from the end of the page
      setOpen(false);
      btn.current?.focus({ preventScroll: true });
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : team.length - 1)) % team.length);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : team.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(team[active]);
    }
  };

  // view only (6 Nov): who it is, with nothing to change
  if (viewOnly) return <span className="cpick__ro">{current?.name ?? 'No one yet'}</span>;
  return (
    <span className={`cpick cpick--${size}`} onClick={(e) => e.stopPropagation()}>
      <span className="cpick__name" title={current?.name}>
        {current ? (
          <>
            {current.name}
            {current.id === 'me' && <span className="cpick__you"> (you)</span>}
          </>
        ) : (
          <span className="cpick__none">No counsellor</span>
        )}
      </span>
      <button
        ref={btn}
        type="button"
        id={id}
        className={`cpick__edit ${open ? 'is-open' : ''}`}
        aria-label={label}
        title="Change counsellor"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="edit" size={16} />
      </button>
      {layer &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                className={`cpop ${pos.up ? 'is-up' : ''}`}
                style={{ top: pos.top, left: pos.left }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: pos.up ? 6 : -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: pos.up ? 4 : -4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <p className="cpop__title" id={`${id}-title`}>
                  Counsellor
                </p>
                <ul
                  ref={list}
                  id={`${id}-list`}
                  className="cpop__list"
                  role="listbox"
                  tabIndex={-1}
                  aria-labelledby={`${id}-title`}
                  aria-activedescendant={`${id}-opt-${active}`}
                  onKeyDown={onKey}
                >
                  {team.map((m, i) => {
                    const on = m.id === value;
                    return (
                      <li
                        key={m.id}
                        id={`${id}-opt-${i}`}
                        role="option"
                        aria-selected={on}
                        className={`cpop__opt ${i === active ? 'is-active' : ''} ${on ? 'is-on' : ''}`}
                        onPointerEnter={() => setActive(i)}
                        onClick={() => pick(m)}
                      >
                        <span className="cpop__av" aria-hidden="true">
                          {initials(m.name)}
                        </span>
                        <span className="cpop__t">
                          <span className="cpop__name">
                            {m.name}
                            {m.id === 'me' ? ' (you)' : ''}
                          </span>
                          {counts && (
                            <span className="cpop__meta">
                              {counts[m.id] ?? 0} {(counts[m.id] ?? 0) === 1 ? 'student' : 'students'}
                            </span>
                          )}
                        </span>
                        {on && <Icon name="check" size={18} className="cpop__tick" />}
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>,
          layer,
        )}
    </span>
  );
}
