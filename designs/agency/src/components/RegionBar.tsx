import { isIsolated, useScope } from '../data/scope';

/**
 * Region isolation, model D (PRD slice 1): an Admission or Recruitment person's lists show only their own sales
 * regions. Isolation is per person (S4-24). There is no switch to see other regions (decided 1 Nov): records outside
 * them aren't in lists, search, counts, exports or reachable by a direct link.
 */
export function RegionBar({ page: _page }: { page: string }) {
  const s = useScope();
  if (!isIsolated(s)) return null;
  return (
    <p className="regionbar" role="status">
      {s.regions.length ? (
        <>
          Showing your sales {s.regions.length === 1 ? 'region' : 'regions'}: <strong>{s.regions.join(', ')}</strong>.
        </>
      ) : (
        <>You have no sales region yet, so no records show. Ask a GSP Admin to give you one.</>
      )}
    </p>
  );
}
