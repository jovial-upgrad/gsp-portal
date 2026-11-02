import { isIsolated, useScope } from '../data/scope';

/**
 * Region isolation, model D (PRD slice 1): a GSP person's lists show only their own sales regions; only Admin
 * sees every region (Regression 31). Isolation is per person (S4-24). There is no switch to see other regions (decided 1 Nov): records outside
 * them aren't in lists, search, counts, exports or reachable by a direct link.
 */
export function RegionBar({ page: _page }: { page: string }) {
  const s = useScope();
  if (!isIsolated(s)) return null;
  // Jovial, 2 Nov: no "Showing your sales region" line; only a person with no region yet is told why the list is empty
  if (s.regions.length) return null;
  return (
    <p className="regionbar" role="status">
      You have no sales region yet, so no records show. Ask a GSP Admin to give you one.
    </p>
  );
}
