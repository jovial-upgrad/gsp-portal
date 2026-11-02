import { useEffect, useSyncExternalStore } from 'react';
import type { Application, EndKind, StatusKey } from './applications';

/**
 * Status changes that reach every module (Jovial, 31 Oct: one data set). Each portal keeps its own working copy of
 * the applications; a status set from anywhere outside it (a Mail conversation confirmed, say) lands here and every
 * portal applies it to its copy, now and whenever it opens. Kept in this browser, so other tabs see it too.
 * In the real build this is the application record itself.
 */
export type LiveStatus = { status: StatusKey; at: number; by: string; end?: EndKind; note?: string; via?: 'mail' | 'portal' | 'rp' };
/** What GSP set on an application besides its status (Jovial, 1 Nov): when the offer's conditions went to the RP, and who lodges the visa. */
/** condsSent: false while GSP still has to send the conditions, the time it sent them after. No flag: sent (the sample data). */
export type LiveFlags = { condsSent?: number | false; visaBy?: 'you' | 'gsp'; filed?: { name: string; file: string; at: number; by: string }[]; rpNews?: number; rpWhat?: string; rpSeen?: number; fee?: number; feeBy?: string; feeAt?: number; /** Visa granted: the course start date GSP entered (Jovial, 2 Nov). */ start?: number };
const KEY = 'gsp-live-v1';
const FKEY = 'gsp-live-flags-v1';
let state: Record<string, LiveStatus> = read();
let flags: Record<string, LiveFlags> = readFlags();
function readFlags(): Record<string, LiveFlags> {
  try {
    return JSON.parse(localStorage.getItem(FKEY) || '{}') || {};
  } catch {
    return {};
  }
}
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
    localStorage.setItem(FKEY, JSON.stringify(flags));
  } catch {
    /* storage blocked: this window still has it */
  }
  subs.forEach((f) => f());
}
try {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === FKEY) {
      state = read();
      flags = readFlags();
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
/** Every status set from outside its portal (for stores outside React). */
export const liveAll = () => state;
/** Set what GSP decided on an application besides its status. */
export function setLiveFlags(id: string, f: LiveFlags) {
  flags = { ...flags, [id]: { ...flags[id], ...f } };
  emit();
}
export const liveFlags = () => flags;
export const flagsOf = (id: string): LiveFlags => flags[id] ?? {};
/**
 * The application's final tuition fee (Jovial, 1 Nov): the course's tuition fee until Admissions changes it from the
 * offer letter. The only tuition fee commission is worked out on, in every role and in Finance.
 */
export const finalFeeOf = (id: string, courseFee: number) => flags[id]?.fee ?? courseFee;
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
let snap = { state, flags };
export const useLive = () => useSyncExternalStore(subscribe, () => (snap.state === state && snap.flags === flags ? snap : (snap = { state, flags }))).state;
/** Re-renders on status and flag changes alike. */
export const useLiveAll = () => useSyncExternalStore(subscribe, () => (snap.state === state && snap.flags === flags ? snap : (snap = { state, flags })));
/** For stores outside React (Finance's): called on every change. */
export const onLiveChange = (f: () => void) => subscribe(f);

/** The application with any status set elsewhere applied, and any document Mail filed on it. */
export function withLive<T extends Pick<Application, 'id' | 'status' | 'since' | 'history'> & Partial<Pick<Application, 'end' | 'files'>>>(a: T, live = state): T {
  const b = withStatus(a, live);
  const filed = flags[a.id]?.filed;
  if (!filed?.length || !b.files) return b;
  const missing = filed.filter((f) => !b.files!.some((x) => x.name === f.name && x.file === f.file));
  if (!missing.length) return b;
  return { ...b, files: [...b.files, ...missing.map((f) => ({ name: f.name, file: f.file, from: 'gsp' as const, at: f.at, status: 'verified' as const, via: 'mail' as const }))] };
}
function withStatus<T extends Pick<Application, 'id' | 'status' | 'since' | 'history'> & Partial<Pick<Application, 'end'>>>(a: T, live: Record<string, LiveStatus>): T {
  const l = live[a.id];
  if (!l || (l.status === a.status && a.since >= l.at)) return a;
  if (a.since > l.at) return a; // changed here since
  return {
    ...a,
    status: l.status,
    since: l.at,
    ...(l.end ? { end: { kind: l.end, reason: l.note ?? '', stage: 2, at: l.at } } : {}),
    history: [...a.history, { at: l.at, who: l.via === 'rp' ? 'you' : 'gsp', text: l.via === 'mail' || !l.via ? `Status moved to “${l.note || l.status}” from a university email` : `Status moved to “${l.note || l.status}”`, by: l.by }],
  };
}
/** Keeps a portal's applications up to date with statuses set elsewhere. */
export function useLiveApps(setApps: (f: (list: Application[]) => Application[]) => void) {
  const all = useLiveAll();
  useEffect(() => {
    setApps((list) => {
      let changed = false;
      const next = list.map((a) => {
        const b = withLive(a, all.state);
        if (b !== a) changed = true;
        return b;
      });
      return changed ? next : list;
    });
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps
}
