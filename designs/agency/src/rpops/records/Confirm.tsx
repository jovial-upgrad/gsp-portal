import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import '../../components/confirm.css';

/**
 * RP Ops asks first before every remove, delete, unlink and Set inactive (Nesil, 4 Nov, later): the shared
 * ConfirmDialog, with its action in red when it takes something away (`danger`). Cancel is focused first; Esc and the
 * scrim cancel; focus stays inside and goes back to what opened it. Buttons on the right.
 */
export function Confirm({
  open,
  title,
  children,
  confirm,
  cancel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirm: string;
  cancel?: string;
  danger?: boolean;
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
    if (e.key === 'Escape') return onCancel();
    if (e.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
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
            aria-labelledby="ops-confirm-title"
            aria-describedby={children ? 'ops-confirm-text' : undefined}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h2 id="ops-confirm-title" className="confirm__title">
              {title}
            </h2>
            {children && (
              <div id="ops-confirm-text" className="confirm__text">
                {children}
              </div>
            )}
            <div className="confirm__acts">
              <Button variant="secondary" ref={cancelRef} onClick={onCancel}>
                {cancel}
              </Button>
              <Button className={danger ? 'ops-danger' : ''} onClick={onConfirm}>
                {confirm}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    layer,
  );
}
