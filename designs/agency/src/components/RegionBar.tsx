import { isIsolated, setAllRegions, useScope } from '../data/scope';

/**
 * Region isolation, model D (Jovial, 1 Nov): an Admission or Recruitment person's lists show their own sales
 * regions; they can look across every region, read only, and the switch is logged in Admin › Logs.
 */
export function RegionBar({ page }: { page: string }) {
  const s = useScope();
  if (!isIsolated(s)) return null;
  return (
    <p className={`regionbar ${s.all ? 'is-all' : ''}`} role="status">
      {s.all ? (
        <>
          <strong>Every sales region, read only.</strong> You can open anything; only your regions ({s.regions.join(', ')}) can be changed. This view is logged.
        </>
      ) : (
        <>
          Showing your sales {s.regions.length === 1 ? 'region' : 'regions'}: <strong>{s.regions.join(', ')}</strong>.
        </>
      )}{' '}
      <button type="button" className="btn btn--link" onClick={() => setAllRegions(!s.all, page)}>
        {s.all ? 'Back to my regions' : 'Look across every region (read only)'}
      </button>
    </p>
  );
}
