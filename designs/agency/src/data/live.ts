import { useEffect, useSyncExternalStore } from 'react';
import type { Application, EndKind, StatusKey } from './applications';

/**
 * Status changes that reach every module (Jovial, 31 Oct: one data set). Each portal keeps its own working copy of
 * the applications; a status set from anywhere outside it (a Mail conversation confirmed, say) lands here and every
 * portal applies it to its copy, now and whenever it opens. Kept in this browser, so other tabs see it too.
 * In the real build this is the application record itself.
 */
export type LiveStatus = { status: StatusKey; at: number; by: string; end?: EndKind; note?: string };
const KEY = 'gsp-live-v1';
let state: Record<string, LiveStatus> = read();
const subs = new Set<() => void>();

function read(): Record<string, LiveStatus> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: this window still has it */
  }
  subs.forEach((f) => f());
}
try {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = read();
      subs.forEach((f) => f());
    }
  });
} catch {
  /* no window */
}

/** Set an application's status from outside its portal. */
export function setLiveStatus(id: string, s: LiveStatus) {
  state = { ...state, [id]: s };
  emit();
}
export const liveStatus = (id: string) => state[id];
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export const useLive = () => useSyncExternalStore(subscribe, () => state);
/** For stores outside React (Finance's): called on every change. */
export const onLiveChange = (f: () => void) => subscribe(f);

/** The application with any status set elsewhere applied. */
export function withLive<T extends Pick<Application, 'id' | 'status' | 'since' | 'history'> & Partial<Pick<Application, 'end'>>>(a: T, live = state): T {
  const l = live[a.id];
  if (!l || (l.status === a.status && a.since >= l.at)) return a;
  if (a.since > l.at) return a; // changed here since
  return {
    ...a,
    status: l.status,
    since: l.at,
    ...(l.end ? { end: { kind: l.end, reason: l.note ?? '', stage: 2, at: l.at } } : {}),
    history: [...a.history, { at: l.at, who: 'gsp', text: `Status moved to “${l.note || l.status}” from a university email`, by: l.by }],
  };
}
/** Keeps a portal's applications up to date with statuses set elsewhere. */
export function useLiveApps(setApps: (f: (list: Application[]) => Application[]) => void) {
  const live = useLive();
  useEffect(() => {
    setApps((list) => {
      let changed = false;
      const next = list.map((a) => {
        const b = withLive(a, live);
        if (b !== a) changed = true;
        return b;
      });
      return changed ? next : list;
    });
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
}
