import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { STATUS_ORDER, courseOf, statusText, type Application, type StatusKey } from '../data/applications';
import { sampleAppCountGroups, type AppCountGroup } from '../admin/data/config';
import { Sheet } from './Sheet';

/**
 * The portal's applications, for the counts on an RP's, an institution partner's and a university's page (Suman and
 * Jovial, 18 Nov). Each portal publishes the list it holds; the counts read it, so they follow every change.
 */
let list: Application[] = [];
const subs = new Set<() => void>();
export const usePublishApps = (apps: Application[]) =>
  useEffect(() => {
    list = apps;
    subs.forEach((f) => f());
  }, [apps]);
const useAppList = () => useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => list);

/** Which group an application falls in: closed, or the last group whose first status it has reached. */
export function groupOf(a: Application, groups: AppCountGroup[]): string | undefined {
  if (a.status === 'closed') return groups.find((g) => g.closed)?.label;
  const at = STATUS_ORDER.indexOf(a.status as StatusKey);
  let hit: string | undefined;
  groups.filter((g) => !g.closed).forEach((g) => {
    if (!g.from || STATUS_ORDER.indexOf(g.from as StatusKey) <= at) hit = g.label;
  });
  return hit;
}

/**
 * Four counts, each opening the applications behind it, on one slim line (Jovial, 18 Nov: the record's details show
 * without scrolling). `match`: the applications this page is about; `facts`: other counts shown first on the line.
 */
export function AppCounts({ id, match, facts = [] }: { id: string; match: (a: Application) => boolean; facts?: (readonly [string, number])[] }) {
  const apps = useAppList();
  const groups = useMemo(sampleAppCountGroups, []);
  const mine = useMemo(() => apps.filter(match), [apps, match]);
  const by = useMemo(() => {
    const m = new Map<string, Application[]>(groups.map((g) => [g.label, []]));
    mine.forEach((a) => {
      const g = groupOf(a, groups);
      if (g) m.get(g)!.push(a);
    });
    return m;
  }, [mine, groups]);
  const [open, setOpen] = useState<string | null>(null);
  const shown = open ? by.get(open) ?? [] : [];
  return (
    <>
      <div className="card appstrip" role="group" aria-label="Applications" id={id}>
        {facts.map(([k, n]) => (
          <p key={k} className="appstrip__i">
            <span className="appstrip__n num">{n.toLocaleString('en-GB')}</span> {k}
          </p>
        ))}
        <span className="appstrip__t">Applications by where they are</span>
        {groups.map((g) => (
          <button key={g.label} type="button" id={`${id}-${g.label.replace(/\W+/g, '-').toLowerCase()}`} className="appstrip__i appstrip__btn" onClick={() => setOpen(g.label)} disabled={!by.get(g.label)?.length} title={`Open the ${g.label.toLowerCase()} applications`}>
            <span className="appstrip__n num">{(by.get(g.label)?.length ?? 0).toLocaleString('en-GB')}</span> {g.label}
          </button>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={`${open ?? ''}: ${shown.length} ${shown.length === 1 ? 'application' : 'applications'}`}>
        <ul className="appcounts__list">
          {shown.map((a) => (
            <li key={a.id}>
              <span className="iw-strong num">{a.id}</span>
              <span className="iw-sub">
                {courseOf(a).name} · {courseOf(a).uni.name} · {a.intake} · {statusText(a)}
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
