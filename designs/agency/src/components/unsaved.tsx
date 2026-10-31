import { useEffect, useRef, useState, type RefObject } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

/*
 * One unsaved-changes guard (QC, 1 Nov, rule 2). While a form has changes nobody saved, leaving it asks first:
 * "Discard changes?" with Keep editing (focused, the safe choice) and a red Discard. Leaving is the menu, a back
 * link, a record's own links marked `data-leave`, Esc, or a sheet's Close and scrim (Sheet's `dirty`).
 * Cancel and Discard buttons a person presses on purpose don't ask again.
 */

type Guard = {
  dirty: () => boolean;
  /** The form's area: clicks inside it aren't leaving, except on [data-leave] and back links. */
  region?: () => HTMLElement | null;
  discard: () => void;
  what?: string;
};
const guards = new Set<Guard>();
let asker: ((what?: string) => Promise<boolean>) | null = null;

/** Asks "Discard changes?"; true when Discard is picked. */
export function askDiscard(what?: string): Promise<boolean> {
  return asker ? asker(what) : Promise.resolve(true);
}

/** Runs `go` now if nothing is unsaved, else after "Discard" (throwing the changes away first). */
export function leave(go: () => void) {
  const g = [...guards].find((x) => x.dirty());
  if (!g) return go();
  void askDiscard(g.what).then((ok) => {
    if (!ok) return;
    g.discard();
    guards.delete(g);
    go();
  });
}

/**
 * Guards a form while `active` (being edited). `dirty` says whether there's anything to lose; `onDiscard` throws the
 * changes away (and closes the editor). `region` is the form's area. Esc inside the region, with nothing open over
 * it, discards too, asking first when there are changes.
 */
export function useUnsaved(active: boolean, dirty: boolean, o: { onDiscard: () => void; region?: RefObject<HTMLElement | null>; what?: string; esc?: boolean }) {
  const latest = useRef({ dirty, o });
  latest.current = { dirty, o };
  useEffect(() => {
    if (!active) return;
    const g: Guard & { esc?: boolean } = {
      dirty: () => latest.current.dirty,
      region: () => latest.current.o.region?.current ?? null,
      discard: () => latest.current.o.onDiscard(),
      what: latest.current.o.what,
      esc: o.esc !== false,
    };
    guards.add(g);
    return () => {
      guards.delete(g);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** What counts as leaving the page: the main menu (not a group that only opens its submenu), its flyout, back links, a record's other tabs. */
const LEAVE = 'nav[aria-label="Main"] button:not([aria-haspopup]), nav[aria-label="Main"] a, .pfly__item, .rback, [data-leave], .itabs [role=tab]:not([aria-selected="true"])';

/** Shows the question, and catches leaving while a guard has changes. Mounted once, beside the app. */
export function UnsavedHost() {
  const [q, setQ] = useState<{ what?: string; done: (ok: boolean) => void } | null>(null);
  useEffect(() => {
    asker = (what) => new Promise<boolean>((done) => setQ({ what, done }));
    let passing = false;
    const onClick = (e: MouseEvent) => {
      if (passing) return;
      const el = (e.target as Element | null)?.closest?.(LEAVE) as HTMLElement | null;
      if (!el || el.closest('.proto, .confirm-wrap')) return;
      const always = el.matches('.rback, [data-leave]');
      const g = [...guards].find((x) => x.dirty() && (always || !x.region?.()?.contains(el)));
      if (!g) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      void askDiscard(g.what).then((ok) => {
        if (!ok) return;
        g.discard();
        guards.delete(g);
        passing = true;
        el.click();
        passing = false;
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // a sheet, a dialog or a menu open over the page handles its own Esc
      if (document.querySelector('.sheet-wrap, .confirm-wrap, [role=menu]')) return;
      const at = document.activeElement;
      const g = [...guards].find((x) => (x as Guard & { esc?: boolean }).esc && at && x.region?.()?.contains(at));
      if (!g) return;
      e.preventDefault();
      if (!g.dirty()) return g.discard();
      void askDiscard(g.what).then((ok) => ok && g.discard());
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      asker = null;
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const answer = (ok: boolean) => {
    q?.done(ok);
    setQ(null);
  };
  return (
    <ConfirmDialog open={!!q} title="Discard changes?" confirm="Discard" cancel="Keep editing" danger onConfirm={() => answer(true)} onCancel={() => answer(false)}>
      <p>{q?.what ? `Your changes to ${q.what} aren’t saved.` : 'Your changes aren’t saved.'} Discarding them can’t be undone.</p>
    </ConfirmDialog>
  );
}
