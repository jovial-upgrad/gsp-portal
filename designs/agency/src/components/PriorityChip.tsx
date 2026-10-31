import { getDb } from '../institution/data/store';
import { courseOf, type Application } from '../data/applications';
import type { Student } from '../data/students';

/**
 * Priority source market (Jovial, 31 Oct): the student comes from a country the university's territory marks as a
 * priority (Institution › University › Territory). Shown to GSP's own people only, never to the RP.
 */
export function isPriority(a: Application, s?: Student) {
  if (!s) return false;
  const u = getDb().unis.find((x) => x.id === courseOf(a).uni.id);
  return !!u && u.territory.priority.includes(s.nationality);
}

export function PriorityChip({ a, s }: { a: Application; s?: Student }) {
  if (!isPriority(a, s)) return null;
  const uni = courseOf(a).uni.name;
  return (
    <span className="prio-chip" title={`${s!.nationality} is a priority source market for ${uni}`}>
      Priority market
    </span>
  );
}
