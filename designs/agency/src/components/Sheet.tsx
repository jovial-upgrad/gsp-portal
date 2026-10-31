import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from './Icon';
import { askDiscard } from './unsaved';
import { RequiredNote } from './forms';
import './sheet.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A sheet over the page: from the right on wide screens (centred for a short form, or as `modal` a larger dialog in the
 * centre), from the bottom on phones.
 * It renders into the overlay layer (#layer), which sits over the app or the phone frame, so it never
 * scrolls away with the page. Focus moves in, stays in, and goes back to what opened it; Esc and the scrim close it.
 */
export function Sheet({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  lead,
  nav,
  band,
  wide = false,
  modal = false,
  center = false,
  expandable = false,
  className = '',
  style,
  dirty = false,
  what,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Above the title, such as a logo. */
  lead?: ReactNode;
  /** Under the header and outside the scrolling body, such as tabs. */
  nav?: ReactNode;
  /** Under the header and before the nav, the full width of the panel, such as a strip of key facts. */
  band?: ReactNode;
  /** A wider panel on big screens, for detail pages. */
  wide?: boolean;
  /** On big screens, a dialog in the middle of the window instead of a panel at the side. It scrolls as one, header
   *  and all, with its close button kept in the corner; give the nav `position: sticky` to keep it in view. */
  modal?: boolean;
  /** Centred on big screens instead of from the right, for a form you fill in one go. */
  center?: boolean;
  /** With `center` or `modal`: a button beside Close makes the dialog fill the window, with a margin all round, and back. */
  expandable?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Changes nobody saved: Esc, Close and the scrim ask "Discard changes?" first (QC, 1 Nov). */
  dirty?: boolean;
  /** What the changes are to, for that question ("the queue"). */
  what?: string;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');
  const [full, setFull] = useState(false);
  // "* Required" once, at the top, when the form has a required field
  const [req, setReq] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setReq(!!panel.current?.querySelector('.sheet__body .field__req')), 40);
    return () => window.clearTimeout(t);
  });
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const tryClose = () => {
    if (!dirtyRef.current) return onClose();
    void askDiscard(what).then((ok) => ok && onClose());
  };

  // it opens at its normal size every time
  useEffect(() => {
    if (!open) setFull(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // opened from a menu (a row's More menu): focus goes back to the menu's button, as the item itself goes away
    const at = document.activeElement as HTMLElement | null;
    opener.current = at?.closest('[role=menu]') ? (document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]') ?? at) : at;
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>('.sheet__close')?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      opener.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      // a menu or picker open inside the sheet closes first
      if (e.defaultPrevented) return;
      tryClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
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
  // the layer is as wide as the app (or the phone frame): phones get a bottom sheet
  const phone = layer.clientWidth <= 900;
  const sizer = expandable && (center || modal) && !phone && (
    <button type="button" className="icon-btn sheet__size" aria-label={full ? 'Back to normal size' : 'Expand to full page'} title={full ? 'Back to normal size' : 'Expand to full page'} onClick={() => setFull((f) => !f)}>
      <Icon name={full ? 'collapse' : 'expand'} size={18} />
    </button>
  );
  const close = (
    <button type="button" className="icon-btn sheet__close" aria-label="Close" onClick={tryClose}>
      <Icon name="close" size={18} />
    </button>
  );
  const inner = (
    <>
      <header className="sheet__head">
        <div className="sheet__heading">
          {lead}
          <h2 id="sheet-title" className="sheet__title">
            {title}
          </h2>
          {sub && <p className="sheet__sub">{sub}</p>}
        </div>
        {!modal &&
          (sizer ? (
            <div className="sheet__acts">
              {sizer}
              {close}
            </div>
          ) : (
            close
          ))}
      </header>
      {band}
      {nav}
      <div className="sheet__body">
        {req && <RequiredNote className="sheet__req" />}
        {children}
      </div>
      {footer && <footer className="sheet__foot">{footer}</footer>}
    </>
  );
  const from = phone ? { y: 48 } : modal ? { y: 18, scale: 0.98 } : center ? { y: 12, scale: 0.97 } : { x: 40 };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`sheet-wrap ${modal ? 'is-modal' : ''} ${center ? 'sheet-wrap--center' : ''} ${full ? 'is-full' : ''}`} onKeyDown={onKey}>
          <motion.div
            className="sheet__scrim"
            aria-hidden="true"
            onClick={tryClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
          />
          <motion.div
            ref={panel}
            className={`sheet ${wide ? 'sheet--wide' : ''} ${modal ? 'sheet--modal' : ''} ${center ? 'sheet--center' : ''} ${full ? 'is-full' : ''} ${className}`}
            style={style}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            initial={reduce ? { opacity: 0 } : { opacity: 0, ...from }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, ...from }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="sheet__grab" aria-hidden="true" />
            {/* a modal keeps its buttons in the corner while it scrolls */}
            {modal &&
              (sizer ? (
                <div className="sheet__acts sheet__acts--corner">
                  {sizer}
                  {close}
                </div>
              ) : (
                close
              ))}
            {modal ? <div className="sheet__scroll">{inner}</div> : inner}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    layer,
  );
}
