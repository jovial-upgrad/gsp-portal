import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from './Icon';
import './toast.css';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** One notification: a title, a line (which can hold a link), and its icon's tone. A new key shows a new one. */
export type ToastMsg = { key: number; title: string; text?: ReactNode; icon: IconName; tone?: 'ok' | 'star' | 'plain' };

/**
 * Every notification the portal shows (Nesil, 29 Oct): one card in the bottom-left corner of the page, beside the
 * menu and clear of everything in the bottom right, with an icon, a title and a line. It goes by itself after a few
 * seconds, or with ×. Screen readers hear it as it comes.
 */
export function Toast({ t, onClose, ms = 6000 }: { t: ToastMsg | null; onClose: () => void; ms?: number }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!t) return;
    const id = window.setTimeout(onClose, ms);
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
            <button type="button" className="icon-btn toast__x" aria-label="Close this message" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
