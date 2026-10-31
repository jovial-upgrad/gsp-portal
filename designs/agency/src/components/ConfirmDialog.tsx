import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';
import './confirm.css';

/**
 * A small centred question before a change that affects someone else: what will happen, then
 * Cancel (focused first, the safe choice) and the action. Esc and the scrim cancel; focus stays
 * inside and goes back to what opened it. It renders into the overlay layer, above any sheet.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirm,
  cancel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirm: string;
  cancel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 20);
    return () => {
      window.clearTimeout(t);
      opener.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    // buttons and any choice the dialog asks for; in a radio group only the picked one takes Tab
    const items = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea')].filter(
      (el) => !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked && box.current!.querySelector(`input[name="${el.name}"]:checked`)),
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!layer) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="confirm-wrap" onKeyDown={onKey}>
          <motion.div className="confirm__scrim" aria-hidden="true" onClick={onCancel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
          <motion.div
            ref={box}
            className="confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-text"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h2 id="confirm-title" className="confirm__title">
              {title}
            </h2>
            <div id="confirm-text" className="confirm__text">
              {children}
            </div>
            <div className="confirm__acts">
              <Button variant="secondary" ref={cancelRef} onClick={onCancel}>
                {cancel}
              </Button>
              <Button onClick={onConfirm}>{confirm}</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    layer,
  );
}
