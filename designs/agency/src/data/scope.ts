/**
 * Who's looking, in GSP's roles (W12, 1 Nov): the signed-in GSP person's role and sales regions, so the shared
 * Students and Applications pages can word things for them and, later, show only their regions.
 *
 * Region isolation (for Jovial's rules): `inRegion` is the one place that decides whether the signed-in person sees
 * a record in a sales region. Today it lets everyone see everything (the default: all regions); the rules go there.
 * Every GSP list filters through `byRegion`, so changing `inRegion` changes them all.
 */
import { staffByEmail } from './staff';

/** The portal looking: GSP · Admissions, Recruitment, BAP, Finance, Institution or Admin. */
export type Viewer = 'gsp-admissions' | 'gsp-recruitment' | 'gsp-bap' | 'gsp-finance' | 'gsp-institution' | 'gsp-admin';
export type Scope = { viewer: Viewer; email: string; /** The person's sales regions, from the staff list ('Global' covers all). */ regions: string[] };

let scope: Scope = { viewer: 'gsp-admissions', email: '', regions: [] };
/** Set by each GSP portal as it draws. */
export function setScope(viewer: Viewer, email: string) {
  if (scope.viewer === viewer && scope.email === email) return;
  scope = { viewer, email, regions: staffByEmail(email)?.regions ?? [] };
}
export const getScope = () => scope;

/**
 * Whether the signed-in person sees a record in this sales region. The hook for region isolation: today every
 * region (no rules yet); `s.regions` holds the person's regions for the rules to use.
 */
export function inRegion(region: string | undefined, s: Scope = scope): boolean {
  void region;
  void s;
  return true;
}
/** A list cut to what the signed-in person sees, by each record's sales region. */
export const byRegion = <T,>(list: T[], regionOf: (x: T) => string | undefined, s: Scope = scope) => list.filter((x) => inRegion(regionOf(x), s));

/** GSP's own part of an application is the signed-in person's to do only in Admissions; other roles see it as GSP's. */
export const gspIsMine = (s: Scope = scope) => s.viewer === 'gsp-admissions';
/** "Pending on you" for Admissions; "With GSP" for every other GSP role. */
export const gspWord = () => (gspIsMine() ? 'Pending on you' : 'With GSP');
