import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './tooltip.css';

/**
 * The portal's tooltip (Jovial, 2 Nov: no system UI). Any element with a `title` shows it in the portal's own
 * tooltip, not the browser's: on hover or keyboard focus the title moves to `data-tip` (so the browser has nothing
 * to show), and the text appears above the element after a short pause. Screen readers keep it as the element's
 * description. Escape, scrolling or leaving hides it. One host for the whole portal, so every `title` is covered.
 */
export function TooltipHost() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  useEffect(() => {
    let timer = 0;
    let on: Element | null = null;
    const take = (el: Element) => {
      const t = el.getAttribute('title');
      if (t === null) return el.getAttribute('data-tip');
      el.removeAttribute('title');
      if (t) {
        el.setAttribute('data-tip', t);
        if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !(el.textContent || '').trim()) el.setAttribute('aria-label', t);
        else if (!el.hasAttribute('aria-describedby') && el.getAttribute('aria-label') !== t) el.setAttribute('aria-description', t);
      }
      return t;
    };
    const find = (t: EventTarget | null) => (t instanceof Element ? t.closest('[title]:not(iframe), [data-tip]') : null);
    const show = (e: Event, delay: number) => {
      const el = find(e.target);
      if (el === on) return;
      window.clearTimeout(timer);
      on = el;
      if (!el) return setTip(null);
      const text = take(el);
      if (!text) return setTip(null);
      timer = window.setTimeout(() => {
        if (on !== el || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        const below = r.top < 48;
        setTip({ text, x: Math.min(window.innerWidth - 12, Math.max(12, r.left + r.width / 2)), y: below ? r.bottom + 8 : r.top - 8, below });
      }, delay);
    };
    const hide = () => {
      window.clearTimeout(timer);
      on = null;
      setTip(null);
    };
    const over = (e: Event) => show(e, 450);
    const focus = (e: Event) => {
      if ((e.target as Element)?.matches?.(':focus-visible')) show(e, 150);
      else hide();
    };
    const out = (e: Event) => {
      const to = (e as PointerEvent).relatedTarget as Node | null;
      if (on && to && on.contains(to)) return;
      if (on && !find(to)) hide();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('pointerover', over, true);
    document.addEventListener('pointerout', out, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('focusout', hide, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerover', over, true);
      document.removeEventListener('pointerout', out, true);
      document.removeEventListener('focusin', focus, true);
      document.removeEventListener('focusout', hide, true);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);
  if (!tip || typeof document === 'undefined') return null;
  return createPortal(
    <div className={`ptip ${tip.below ? 'is-below' : ''}`} role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>,
    document.body,
  );
}
