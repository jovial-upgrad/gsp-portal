import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { GlassRim } from './GlassRim';
import { Icon } from './Icon';
import './menu.css';

/**
 * Who's signed in, at the foot of the sidebar. Clicking it opens a glass menu above it with their email, agency
 * and role, and Sign out. Enter, Space or the arrows open it; Esc closes it and focus returns to the button. It renders into
 * the overlay layer so the sidebar doesn't clip it.
 */
export function AccountMenu({ name, org, email, onSignOut }: { name: string; org: string; email: string; onSignOut: () => void }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('');

  const place = () => {
    const b = btn.current?.getBoundingClientRect();
    const l = layer?.getBoundingClientRect();
    if (b && l) setPos({ bottom: l.bottom - b.top + 8, left: b.left - l.left, width: b.width });
  };
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => (pop.current?.querySelector('[role=menuitem]') as HTMLElement | null)?.focus(), 10);
    const away = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!pop.current?.contains(el) && !btn.current?.contains(el)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [open]);

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
      close();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      // one item for now: the keys keep focus on it, as a longer menu would move between items
      e.preventDefault();
      (pop.current?.querySelector('[role=menuitem]') as HTMLElement | null)?.focus();
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        id="account"
        className={`acct ${open ? 'is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'account-menu' : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="acct__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="acct__who">
          <span className="acct__name">{name}</span>
          <span className="acct__org">{org}</span>
        </span>
        <Icon name="chevronDown" size={16} className="acct__chev" />
      </button>
      {layer &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={pop}
                className="acctmenu glass"
                style={{ bottom: pos.bottom, left: pos.left, width: pos.width }}
                onKeyDown={onKey}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <GlassRim />
                <p className="acctmenu__head">
                  <span className="acctmenu__label">Signed in as</span>
                  <span className="acctmenu__mail">{email}</span>
                  {/* in full here, since a long agency name or role is cut short beside the name */}
                  <span className="acctmenu__label">{org}</span>
                </p>
                <div id="account-menu" role="menu" aria-labelledby="account" className="acctmenu__items">
                  <button type="button" role="menuitem" className="mmenu__item" onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}>
                    <Icon name="logout" size={18} />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          layer,
        )}
    </>
  );
}
