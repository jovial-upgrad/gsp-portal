import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from '../../components/Icon';
import { GlassRim } from '../../components/GlassRim';
import type { NavGroup, Section } from './model';

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * A group's pages (Nesil, 30 Oct, after a reference): picking a group in the menu opens a small glass menu beside the
 * sidebar, level with the group, listing its pages with their icons; the page on screen is marked. Arrows move,
 * Enter or Space opens a page, Esc or a click elsewhere closes it and focus goes back to the group. It renders into
 * the overlay layer, so nothing clips it.
 */
export function Flyout({ group, anchor, section, onPick, onClose }: { group: NavGroup | null; anchor: HTMLElement | null; section: Section; onPick: (k: Section) => void; onClose: (refocus?: boolean) => void }) {
  const reduce = useReducedMotion();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');
  const open = !!group && !!anchor;

  const place = () => {
    const b = anchor?.getBoundingClientRect();
    const side = anchor?.closest('.shell__side')?.getBoundingClientRect();
    const l = layer?.getBoundingClientRect();
    if (!b || !l) return;
    const h = box.current?.offsetHeight ?? (group?.items.length ?? 3) * 44 + 56;
    const top = Math.max(8, Math.min(b.top - l.top - 8, l.height - h - 8));
    setPos({ top, left: (side?.right ?? b.right) - l.left + 10 });
  };
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, group?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const items = () => [...(box.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const t = window.setTimeout(() => (items().find((x) => x.getAttribute('aria-current') === 'page') ?? items()[0])?.focus(), 20);
    const away = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!box.current?.contains(el) && !anchor!.contains(el)) onClose(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [open, group?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(box.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onClose(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === 'Tab') onClose(false);
  };

  if (!layer) return null;
  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          key={group.key}
          ref={box}
          className="pfly glass"
          role="menu"
          aria-label={group.label}
          style={{ top: pos.top, left: pos.left }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: -6, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, ease }}
          onKeyDown={onKey}
        >
          <GlassRim />
          <p className="pfly__title" aria-hidden="true">
            {group.label}
          </p>
          {group.items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className={`pfly__item ${section === it.key ? 'is-active' : ''}`}
              aria-current={section === it.key ? 'page' : undefined}
              onClick={() => onPick(it.key)}
            >
              <Icon name={it.icon} size={20} />
              <span>{it.label}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    layer,
  );
}
