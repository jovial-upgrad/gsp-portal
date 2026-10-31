import { useEffect, useRef, useSyncExternalStore } from 'react';
import { STATUS, type Application } from '../data/applications';
import type { Student } from '../data/students';

/**
 * Connecting RP Admin and GSP Team (testing only). Each role's portal keeps its own copy of the applications and
 * students; connected ones are kept the same in both: one application (with its student) or all of them. A change
 * in one role shows in the other at once, in this window when the role is switched, and live in the other pane of
 * Side by side or another tab. The latest change wins.
 */
export type LinkMode = 'off' | 'one' | 'all';
export type Link = { mode: LinkMode; app: string };

type Item = { key: string; v: unknown; at: number };
type Msg = ({ kind: 'gsp-link'; from: string; type: 'mode'; link: Link } | { kind: 'gsp-link'; from: string; type: 'data'; items: Item[] } | { kind: 'gsp-link'; from: string; type: 'hello' }) & { ver?: string };

const KEY = 'gsp-proto-link';
const ME = Math.random().toString(36).slice(2);
/**
 * Only copies of the same build sync. Every downloaded copy shares the browser's storage, so an older copy left
 * open in another tab would otherwise send applications this build can't read (a status it no longer has).
 */
const VER = __BUILD__;

function readLink(): Link {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Link | null;
    if (v && (v.mode === 'one' || v.mode === 'all' || v.mode === 'off')) return { mode: v.mode, app: v.app || '' };
  } catch {
    /* storage unavailable: not connected */
  }
  return { mode: 'off', app: '' };
}

let link: Link = readLink();
/** The connected copies, by `app:<id>` or `stu:<id>`, with when each last changed. */
let entries: Record<string, Item> = {};
/** When this window last changed each one itself, so the newer copy wins when two meet. */
const localAt: Record<string, number> = {};
let snapshot = { link, entries, rev: 0 };
const subs = new Set<() => void>();
const sinks = new Set<(m: Msg) => void>();
const notify = () => {
  snapshot = { link, entries, rev: snapshot.rev + 1 };
  subs.forEach((f) => f());
};

let channel: BroadcastChannel | null = null;
function send(msg: Msg) {
  const m: Msg = { ...msg, ver: VER };
  try {
    if (window.parent !== window) window.parent.postMessage(m, '*');
  } catch {
    /* no parent to tell */
  }
  try {
    channel?.postMessage(m);
  } catch {
    /* channel closed */
  }
  sinks.forEach((f) => f(m));
}

function receive(m: Msg) {
  if (!m || m.kind !== 'gsp-link' || m.from === ME || m.ver !== VER) return;
  if (m.type === 'hello') {
    if (Object.keys(entries).length) send({ kind: 'gsp-link', from: ME, type: 'data', items: Object.values(entries) });
    return;
  }
  if (m.type === 'mode') {
    if (m.link.mode === link.mode && m.link.app === link.app) return;
    link = m.link;
    entries = {};
    notify();
    return;
  }
  let changed = false;
  const next = { ...entries };
  for (const it of m.items) {
    const have = next[it.key];
    if (!have || it.at > have.at) {
      next[it.key] = it;
      changed = true;
    }
  }
  if (changed) {
    entries = next;
    notify();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => receive(e.data as Msg));
  try {
    channel = new BroadcastChannel(KEY);
    channel.onmessage = (e) => receive(e.data as Msg);
  } catch {
    channel = null;
  }
  // another tab changed the connection
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const v = readLink();
    if (v.mode !== link.mode || v.app !== link.app) receive({ kind: 'gsp-link', from: 'storage', type: 'mode', link: v, ver: VER });
  });
  // a window that opens connected asks the others for what's changed so far
  if (link.mode !== 'off') window.setTimeout(() => send({ kind: 'gsp-link', from: ME, type: 'hello' }), 400);
}

export const getLink = () => snapshot;
export function subscribeLink(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
/** Side by side passes messages between its two panes. */
export function addLinkSink(f: (m: Msg) => void) {
  sinks.add(f);
  return () => {
    sinks.delete(f);
  };
}
export const isLinkMsg = (d: unknown): d is Msg => !!d && (d as Msg).kind === 'gsp-link';

export function setLink(next: Link) {
  if (next.mode === link.mode && next.app === link.app) return;
  link = next;
  entries = {};
  try {
    localStorage.setItem(KEY, JSON.stringify(link));
  } catch {
    /* not kept */
  }
  notify();
  send({ kind: 'gsp-link', from: ME, type: 'mode', link });
}

const snapshotOf = (apps: Application[], students: Student[]) => {
  const m = new Map<string, unknown>();
  for (const a of apps) m.set(`app:${a.id}`, a);
  for (const s of students) m.set(`stu:${s.id}`, s);
  return m;
};

export const useLink = () => useSyncExternalStore(subscribeLink, getLink, getLink).link;

/**
 * Keeps a portal's connected applications and students the same as the other role's. Changes made here go out;
 * changes from the other role come in. A portal that opens takes what's connected so far.
 */
export function useLinkedData(
  apps: Application[],
  setApps: (fn: (l: Application[]) => Application[]) => void,
  students: Student[],
  setStudents: (fn: (l: Student[]) => Student[]) => void,
  /** Each application the other role changed or started, as this portal had it and as it comes in (for notifications). */
  onIncoming?: (before: Application | undefined, after: Application) => void,
) {
  const snap = useSyncExternalStore(subscribeLink, getLink, getLink);
  const { link: l } = snap;
  // what this portal last had, so only its own changes go out
  const seen = useRef<Map<string, unknown> | null>(null);
  if (!seen.current) seen.current = snapshotOf(apps, students);

  const appOn = (a: Application) => l.mode === 'all' || (l.mode === 'one' && a.id === l.app);
  // an application this build can't show (a status it doesn't have) is left out
  const readable = (v: unknown) => !!v && (v as Application).status in STATUS;
  const stuOn = (s: Student) => l.mode === 'all' || (l.mode === 'one' && apps.some((a) => a.id === l.app && a.studentId === s.id));

  // in: the connected copies replace this portal's
  useEffect(() => {
    if (l.mode === 'off') return;
    const e = snap.entries;
    if (onIncoming)
      for (const it of Object.values(e)) {
        if (!it.key.startsWith('app:') || !readable(it.v)) continue;
        const have = apps.find((a) => `app:${a.id}` === it.key);
        if (have ? appOn(have) && it.v !== have : l.mode === 'all') onIncoming(have, it.v as Application);
      }
    setApps((list) => {
      let changed = false;
      const next = list.map((a) => {
        const it = e[`app:${a.id}`];
        if (it && appOn(a) && it.v !== a && readable(it.v)) {
          changed = true;
          return it.v as Application;
        }
        return a;
      });
      // an application started in the other role
      for (const it of Object.values(e)) {
        if (!it.key.startsWith('app:') || next.some((a) => `app:${a.id}` === it.key)) continue;
        if (l.mode !== 'all' || !readable(it.v)) continue;
        next.unshift(it.v as Application);
        changed = true;
      }
      return changed ? next : list;
    });
    setStudents((list) => {
      let changed = false;
      const next = list.map((s) => {
        const it = e[`stu:${s.id}`];
        if (it && stuOn(s) && it.v !== s) {
          changed = true;
          return it.v as Student;
        }
        return s;
      });
      // a student added in the other role, with their first application
      if (l.mode === 'all')
        for (const it of Object.values(e)) {
          if (!it.key.startsWith('stu:') || next.some((s) => `stu:${s.id}` === it.key)) continue;
          next.unshift(it.v as Student);
          changed = true;
        }
      return changed ? next : list;
    });
  }, [snap.rev]); // eslint-disable-line react-hooks/exhaustive-deps

  // out: what changed here since last time; and, when the connection starts, everything connected
  const last = useRef(l);
  useEffect(() => {
    const started = last.current.mode !== l.mode || last.current.app !== l.app;
    last.current = l;
    if (l.mode === 'off') {
      seen.current = snapshotOf(apps, students);
      return;
    }
    const now = Date.now();
    const out: Item[] = [];
    const take = (key: string, v: unknown) => {
      const mine = seen.current!.get(key) !== v && snap.entries[key]?.v !== v;
      if (mine) localAt[key] = now;
      if (mine || (started && !snap.entries[key])) out.push({ key, v, at: localAt[key] ?? 0 });
      seen.current!.set(key, v);
    };
    for (const a of apps) if (appOn(a)) take(`app:${a.id}`, a);
    for (const s of students) if (stuOn(s)) take(`stu:${s.id}`, s);
    if (!out.length) return;
    entries = { ...entries };
    for (const it of out) if (!entries[it.key] || it.at >= entries[it.key].at) entries[it.key] = it;
    snapshot = { link, entries, rev: snapshot.rev };
    send({ kind: 'gsp-link', from: ME, type: 'data', items: out });
  }, [apps, students, l.mode, l.app]); // eslint-disable-line react-hooks/exhaustive-deps
}
