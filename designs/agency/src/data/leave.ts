import { useSyncExternalStore } from 'react';
/**
 * Leave (Jovial, 1 Nov): each GSP person sets their own leave on their Profile. While on leave, new applications
 * skip them and their open work is covered by their queue's leader. Kept in this browser; in the real build it's
 * part of the user record.
 */
export type Leave = { from: string; to: string; note?: string };
const KEY = 'gsp-leave-v1';
let state: Record<string, Leave[]> = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } })();
const subs = new Set<() => void>();
const today = () => new Date().toISOString().slice(0, 10);
export const leaveOf = (id: string) => state[id] ?? [];
export function setLeave(id: string, list: Leave[]) { state = { ...state, [id]: list }; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* blocked */ } subs.forEach((f) => f()); }
export const onLeave = (id: string, d = today()) => leaveOf(id).some((l) => l.from <= d && d <= l.to);
export const subscribeLeave = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useLeave = () => useSyncExternalStore(subscribeLeave, () => state);
