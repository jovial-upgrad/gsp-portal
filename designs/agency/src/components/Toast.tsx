import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from './Icon';
import './toast.css';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** One notification: a title, a line (which can hold a link), and its icon's tone. A new key shows a new one. */
export type ToastMsg = {
  key: number;
  title: string;
  text?: ReactNode;
  icon: IconName;
  tone?: 'ok' | 'star' | 'plain';
  /** A reversible change offers Undo here instead of asking first (QC, 1 Nov, rule 4). */
  action?: { label: string; onClick: () => void };
};

/**
 * Every notification the portal shows (Nesil, 29 Oct): one card in the bottom-left corner of the page, beside the
 * menu and clear of everything in the bottom right, with an icon, a title and a line. It goes by itself after a few
 * seconds, or with ×. Screen readers hear it as it comes.
 */
export function Toast({ t, onClose, ms = 6000 }: { t: ToastMsg | null; onClose: () => void; ms?: number }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!t) return;
    // Undo stays long enough to reach
    const id = window.setTimeout(onClose, t.action ? Math.max(ms, 10000) : ms);
    return () => window.clearTimeout(id);
  }, [t?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {t && (
          <motion.div
            key={t.key}
            className={`toast toast--${t.tone ?? 'plain'}`}
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -12, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: reduce ? 0 : -8 }}
            transition={{ duration: 0.22, ease }}
          >
            <span className="toast__icon" aria-hidden="true">
              <Icon name={t.icon} size={18} />
            </span>
            <div className="toast__t">
              <p className="toast__title">{t.title}</p>
              {t.text && <p className="toast__text">{t.text}</p>}
            </div>
            {t.action && (
              <button
                type="button"
                className="toast__act"
                onClick={() => {
                  t.action!.onClick();
                  onClose();
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="icon-btn toast__x" aria-label="Close this message" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- one notification for pages without their own (Finance, Work): notify() from anywhere ---------- */

type Note = { title: string; text?: ReactNode; tone?: ToastMsg['tone']; icon?: IconName; undo?: () => void };
let push: ((n: Note) => void) | null = null;

/**
 * Shows a notification in the bottom-left card, the same as every other page's. A confirmation, never a validation
 * error (those go under their field). With `undo`, the card has Undo.
 */
export function notify(n: Note | string) {
  const x = typeof n === 'string' ? { title: n } : n;
  push?.(x);
}

/** Where notify() shows; mounted once, beside the app. */
export function ToastHost() {
  const [t, setT] = useState<ToastMsg | null>(null);
  useEffect(() => {
    push = (n) =>
      setT({
        key: Date.now() + Math.random(),
        title: n.title,
        text: n.text,
        tone: n.tone ?? (n.undo ? 'plain' : 'ok'),
        icon: n.icon ?? (n.undo ? 'info' : 'checkCircle'),
        action: n.undo ? { label: 'Undo', onClick: n.undo } : undefined,
      });
    return () => {
      push = null;
    };
  }, []);
  return <Toast t={t} onClose={() => setT(null)} />;
}
