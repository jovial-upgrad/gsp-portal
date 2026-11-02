import { useCallback, useMemo } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field } from '../../components/forms';
import { MultiPick } from '../../institution/records/MultiPick';
import { searchCatalogue } from '../../institution/data/store';
import type { Course } from '../../data/courses';

/** Results a page (1 Nov: page numbers, not "Show more"). */
export const PER_PAGE = 20;

/** Page numbers to show: the first, the last, and two either side of the current one; gaps become "…". */
function pagesAround(page: number, pages: number): (number | '…')[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const out: (number | '…')[] = [];
  [...keep]
    .sort((a, b) => a - b)
    .forEach((n, i, all) => {
      if (i && n - all[i - 1] > 1) out.push(n - all[i - 1] === 2 ? n - 1 : '…');
      out.push(n);
    });
  return out;
}

/** Previous, page numbers and Next under the results. */
export function Pager({ page, total, onPage, per: PER_PAGE = 20 }: { page: number; total: number; onPage: (p: number) => void; /** Rows a page: 20 for course results, 25 for the lists (S3C-14). */ per?: number }) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (pages < 2) return null;
  const from = (page - 1) * PER_PAGE + 1;
  const to = Math.min(total, page * PER_PAGE);
  return (
    <nav className="fpager" aria-label="Result pages">
      <Button variant="secondary" size="sm" className="fpager__step" disabled={page <= 1} iconLeft={<Icon name="arrowLeft" size={16} />} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <ol className="fpager__pages">
        {pagesAround(page, pages).map((n, i) =>
          n === '…' ? (
            <li key={`gap-${i}`} className="fpager__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              <button
                type="button"
                className={`fpager__num num ${n === page ? 'is-on' : ''}`}
                aria-current={n === page ? 'page' : undefined}
                aria-label={`Page ${n}`}
                onClick={() => n !== page && onPage(n)}
              >
                {n}
              </button>
            </li>
          ),
        )}
      </ol>
      <Button variant="secondary" size="sm" className="fpager__step" disabled={page >= pages} iconRight={<Icon name="arrowRight" size={16} />} onClick={() => onPage(page + 1)}>
        Next
      </Button>
      <p className="fpager__note num">
        {from === to ? from : `${from}–${to}`} of {total}
      </p>
    </nav>
  );
}

/**
 * The University filter (slice 3 PRD; Jovial, 2 Nov: a multi-select dropdown): the portal's own multi-select over the
 * universities in the current results, A to Z, each with its course count, searchable and 10 at a time. The field
 * names the one picked, or says how many; Clear empties it. Picking several shows courses at any of them; none is
 * "Any university".
 */
export function UniFilter({ id, pool, value, onChange }: { id: string; pool: Course[]; value: string[]; onChange: (uniIds: string[]) => void }) {
  const list = useMemo(() => {
    const by = new Map<string, { id: string; name: string; n: number }>();
    pool.forEach((c) => {
      const u = by.get(c.uni.id);
      if (u) u.n += 1;
      else by.set(c.uni.id, { id: c.uni.id, name: c.uni.name, n: 1 });
    });
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pool]);
  const named = useMemo(() => new Map(list.map((u) => [u.id, u])), [list]);
  // picked universities stay listed (and named) even when the other filters leave them no courses
  const options = useMemo(() => [...list.map((u) => u.id), ...value.filter((v) => !named.has(v))], [list, value, named]);
  const nameOf = useCallback((uid: string) => named.get(uid)?.name ?? searchCatalogue().unis.find((u) => u.id === uid)?.name ?? uid, [named]);
  const countOf = useCallback((uid: string) => String(named.get(uid)?.n ?? 0), [named]);
  return (
    <Field id={id} label="University">
      <MultiPick
        id={id}
        label="University"
        value={value}
        options={options}
        labelOf={nameOf}
        noteOf={countOf}
        empty="Any university"
        summarize={(v) => (v.length === 1 ? nameOf(v[0]) : `${v.length} selected`)}
        search
        pageSize={10}
        onChange={onChange}
      />
    </Field>
  );
}
