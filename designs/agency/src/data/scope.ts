import { OWNER_WORD } from './owners';
/**
 * Who's looking, in GSP's roles (W12, 1 Nov): the signed-in GSP person's role and sales regions, so the shared
 * Students and Applications pages can word things for them and, later, show only their regions.
 *
 * Region isolation (for Jovial's rules): `inRegion` is the one place that decides whether the signed-in person sees
 * a record in a sales region. Today it lets everyone see everything (the default: all regions); the rules go there.
 * Every GSP list filters through `byRegion`, so changing `inRegion` changes them all.
 */
import { useSyncExternalStore } from 'react';
import { staffByEmail } from './staff';
import { adminCfg, setAdminCfg } from '../admin/data/store';

/** The portal looking: GSP · Admissions, Recruitment, BAP, Finance, Institution or Admin. */
export type Viewer = 'gsp-admissions' | 'gsp-recruitment' | 'gsp-bap' | 'gsp-finance' | 'gsp-institution' | 'gsp-admin' | 'gsp-viewonly';
export type Scope = { viewer: Viewer; email: string; /** The person's sales regions, from the staff list ('Global' covers all). */ regions: string[]; role: string; /** Looking at every region, read only. */ all?: boolean };

let scope: Scope = { viewer: 'gsp-admissions', email: '', regions: [], role: '' };
const subs = new Set<() => void>();
/** Set by each GSP portal as it draws. */
export function setScope(viewer: Viewer, email: string) {
  // slice 1: the person's role and regions as Admin › GSP users has them now (a change applies from their next request)
  let u: { role: string; regions: string[] } | undefined;
  try {
    u = adminCfg().users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  } catch {
    u = undefined;
  }
  const st = u ?? staffByEmail(email);
  const next = { viewer, email, regions: st?.regions ?? [], role: st?.role ?? '' };
  if (scope.viewer === viewer && scope.email === email && scope.role === next.role && scope.regions.join() === next.regions.join()) return;
  scope = next;
}
export const getScope = () => scope;
export const useScope = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => scope);

/**
 * Region isolation, model D (Jovial, 1 Nov): Admission and Recruitment see their own sales regions in lists,
 * dashboards and My work; anyone else (Ops, Institution, Finance, Admin, View Only) and Global staff see every
 * region. An isolated person can look across every region, read only, and the switch is logged.
 */
export const isIsolated = (s: Scope = scope) => ['Admission', 'Recruitment'].includes(s.role) && !s.regions.includes('Global');
export function setAllRegions(on: boolean, page = 'Applications') {
  if (!!scope.all === on) return;
  scope = { ...scope, all: on };
  if (on) {
    const at = Date.now();
    try {
      setAdminCfg((c) => ({ ...c, log: [{ id: `rv${at}`, at, who: staffByEmail(scope.email)?.first ?? scope.email, role: scope.role, area: page, text: 'Viewed every sales region (read only)', kind: 'change' }, ...c.log] }));
    } catch {
      /* Admin's log not loaded */
    }
  }
  subs.forEach((f) => f());
}
/** Is this region one of the signed-in person's own (ignoring the read-only view of every region)? */
export const isMine = (region: string | undefined, s: Scope = scope) => !isIsolated(s) || !region || s.regions.includes(region);

/**
 * Whether the signed-in person sees a record in this sales region. The hook for region isolation: today every
 * region (no rules yet); `s.regions` holds the person's regions for the rules to use.
 */
export function inRegion(region: string | undefined, s: Scope = scope): boolean {
  // decided 1 Nov (PRD slice 1): no switch to see other regions, so `all` no longer opens them
  return isMine(region, s);
}
/** A list cut to what the signed-in person sees, by each record's sales region. */
export const byRegion = <T,>(list: T[], regionOf: (x: T) => string | undefined, s: Scope = scope) => list.filter((x) => inRegion(regionOf(x), s));

/** GSP's own part of an application is the signed-in person's to do only in Admissions; other roles see it as GSP's. */
export const gspIsMine = (s: Scope = scope) => s.viewer === 'gsp-admissions';
/** Jovial, 1 Nov (Who has it): On GSP, in every GSP role; the one table is data/owners.ts (HC24). */
export const gspWord = () => OWNER_WORD.gsp;
