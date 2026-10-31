import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from './Icon';
import './menu.css';

/** With `checked`, the menu is a choice of one (like a sort): the picked item shows a tick. */
export type MenuItem = { id: string; label: string; icon?: IconName; danger?: boolean; checked?: boolean; onPick: () => void };

/**
 * A "more" button (three dots, or another icon) that opens a short menu of actions or a choice of one.
 * With `text`, it's a small secondary button with that label instead (like "Add test"). With `word`, the round
 * button grows into a pill with the word beside its icon (like "••• More"); `label` still names it in full for
 * screen readers. Arrows move, Enter or Space picks, Esc closes and focus returns to the button. It renders
 * into the overlay layer so no card clips it.
 */
export function MoreMenu({
  id,
  label,
  items,
  icon = 'more',
  text,
  word,
  className = '',
}: {
  id: string;
  label: string;
  items: MenuItem[];
  icon?: IconName;
  text?: string;
  word?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');

  const place = () => {
    const b = btn.current?.getBoundingClientRect();
    const l = layer?.getBoundingClientRect();
    if (!b || !l) return;
    // it opens above the button when there's no room below it (a row at the foot of the page)
    const h = menu.current?.offsetHeight ?? items.length * 44 + 14;
    const up = b.bottom + 6 + h > l.bottom - 8 && b.top - 6 - h >= l.top + 8;
    setPos({ top: up ? b.top - l.top - 6 - h : b.bottom - l.top + 6, right: Math.max(8, l.right - b.right), up });
  };
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    // a choice opens on the picked item
    setActive(Math.max(0, items.findIndex((it) => it.checked)));
    const t = window.setTimeout(() => (menu.current?.querySelector('[role^=menuitem]') as HTMLElement | null)?.focus(), 10);
    const away = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!menu.current?.contains(el) && !btn.current?.contains(el)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [open]);
  useEffect(() => {
    if (open) (menu.current?.querySelectorAll('[role^=menuitem]')[active] as HTMLElement | undefined)?.focus();
  }, [active, open]);

  const close = () => {
    setOpen(false);
    btn.current?.focus({ preventScroll: true });
  };
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
      btn.current?.focus({ preventScroll: true });
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : items.length - 1);
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        id={id}
        className={text ? `btn btn--secondary btn--sm mmore-text ${open ? 'is-open' : ''} ${className}` : `mmore ${word ? 'mmore--text' : ''} ${open ? 'is-open' : ''} ${className}`}
        aria-label={text ? undefined : label}
        title={text ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {text ? (
          <>
            <Icon name={icon} size={16} />
            <span className="btn__label">{text}</span>
            <Icon name="chevronDown" size={16} className="mmore-text__chev" />
          </>
        ) : (
          <>
            <Icon name={icon} size={20} />
            {word && <span className="mmore__text">{word}</span>}
          </>
        )}
      </button>
      {layer &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={menu}
                id={`${id}-menu`}
                className="mmenu"
                role="menu"
                aria-labelledby={id}
                style={{ top: pos.top, right: pos.right, transformOrigin: pos.up ? 'bottom right' : undefined }}
                onKeyDown={onKey}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: pos.up ? 6 : -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {items.map((it, i) => (
                  <button
                    key={it.id}
                    type="button"
                    role={it.checked === undefined ? 'menuitem' : 'menuitemradio'}
                    aria-checked={it.checked}
                    tabIndex={i === active ? 0 : -1}
                    className={`mmenu__item ${it.danger ? 'is-danger' : ''}`}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => {
                      setOpen(false);
                      btn.current?.focus({ preventScroll: true });
                      it.onPick();
                    }}
                  >
                    {it.checked !== undefined ? (
                      <span className="mmenu__tick" aria-hidden="true">
                        {it.checked && <Icon name="check" size={16} strokeWidth={2.2} />}
                      </span>
                    ) : (
                      it.icon && <Icon name={it.icon} size={18} />
                    )}
                    {it.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          layer,
        )}
    </>
  );
}
