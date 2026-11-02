import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Where a popup drawn under (or over) a field sits, in the coordinates of the element it renders into. */
export type PopupAt = { top?: number; bottom?: number; left: number; width: number; max: number; up: boolean };

/**
 * The element a field's popup renders into: the overlay layer (#layer), so a dialog never clips it, or the page
 * itself for controls outside the app (the prototype panel), which sit above the layer.
 */
export function popupHost(anchor: HTMLElement | null, host: 'layer' | 'body' = 'layer'): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (host === 'body') return document.body;
  const layer = document.getElementById('layer');
  return layer && anchor && !anchor.closest('.proto, .split') ? layer : document.body;
}

/**
 * Places a popup under its field, as wide as it (or `minWidth`), above it only when the room below is short and
 * there's more above. Follows the field on scroll and resize while open; `onAway` runs on a press outside both.
 */
export function useAnchoredPopup(
  anchor: RefObject<HTMLElement | null>,
  popup: RefObject<HTMLElement | null>,
  open: boolean,
  { host = 'layer', minWidth = 0, want = 320, onAway, alignEnd = false }: { host?: 'layer' | 'body'; minWidth?: number; want?: number; onAway?: () => void; alignEnd?: boolean } = {},
) {
  const [at, setAt] = useState<PopupAt | null>(null);
  const into = popupHost(anchor.current, host);
  const place = () => {
    const a = anchor.current;
    if (!a || !into) return;
    const r = a.getBoundingClientRect();
    const box = into === document.body ? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth } : into.getBoundingClientRect();
    const below = box.bottom - r.bottom - 12;
    const above = r.top - box.top - 12;
    const up = below < Math.min(want, 220) && above > below;
    const max = Math.max(160, Math.min(want, up ? above : below));
    const width = Math.max(r.width, minWidth);
    let left = alignEnd ? r.right - box.left - width : r.left - box.left;
    left = Math.max(8, Math.min(left, box.right - box.left - width - 8));
    setAt({ ...(up ? { bottom: box.bottom - r.top + 6 } : { top: r.bottom - box.top + 6 }), left, width, max, up });
  };
  useLayoutEffect(() => {
    if (open) place();
    else setAt(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchor.current?.contains(t) && !popup.current?.contains(t)) onAway?.();
    };
    const move = (e: Event) => {
      // scrolling inside the popup itself doesn't move it
      if (e.type === 'scroll' && popup.current?.contains(e.target as Node)) return;
      place();
    };
    document.addEventListener('mousedown', away);
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const fixed = into === (typeof document === 'undefined' ? null : document.body);
  const style = at
    ? { position: fixed ? ('fixed' as const) : ('absolute' as const), top: at.top ?? 'auto', bottom: at.bottom ?? 'auto', left: at.left, width: at.width, maxHeight: at.max, zIndex: fixed ? 400 : undefined }
    : undefined;
  return { at, into, style };
}
