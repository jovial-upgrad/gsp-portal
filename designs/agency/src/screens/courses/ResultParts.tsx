import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Checkbox, SearchInput } from '../../components/forms';
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

const SHOW = 8;

/**
 * The University filter (slice 3 PRD): the universities in the current results, searchable, A to Z, with a count
 * each; the first 8, then "Show N more universities". Picking several shows courses at any of them; none is
 * "Any university".
 */
export function UniFilter({ id, pool, value, onChange }: { id: string; pool: Course[]; value: string[]; onChange: (uniIds: string[]) => void }) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [q]);
  const list = useMemo(() => {
    const by = new Map<string, { id: string; name: string; n: number }>();
    pool.forEach((c) => {
      const u = by.get(c.uni.id);
      if (u) u.n += 1;
      else by.set(c.uni.id, { id: c.uni.id, name: c.uni.name, n: 1 });
    });
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pool]);
  const words = q.trim().toLowerCase();
  const found = words ? list.filter((u) => u.name.toLowerCase().includes(words)) : list;
  const shown = all ? found : found.slice(0, SHOW);
  const left = found.length - shown.length;
  const toggle = (uid: string, on: boolean) => onChange(on ? [...value, uid] : value.filter((x) => x !== uid));
  return (
    <fieldset className="funi">
      <legend className="field__label">University</legend>
      <SearchInput id={`${id}-q`} label="Find a university" placeholder="Find a university" value={q} onChange={setQ} className="funi__search" />
      <p className="funi__any">{value.length ? `${value.length} picked · ` : 'Any university'}{value.length > 0 && (
        <button type="button" className="btn btn--link" onClick={() => onChange([])}>
          Any university
        </button>
      )}</p>
      <div className="funi__list">
        {shown.map((u) => (
          <Checkbox key={u.id} id={`${id}-${u.id}`} checked={value.includes(u.id)} onChange={(on) => toggle(u.id, on)}>
            {u.name} <span className="funi__n num">({u.n})</span>
          </Checkbox>
        ))}
        {words && !found.length && <p className="funi__none">No university in these results matches “{q.trim()}”.</p>}
      </div>
      {left > 0 && (
        <button type="button" className="btn btn--link funi__more" onClick={() => setAll(true)}>
          Show {left} more {left === 1 ? 'university' : 'universities'}
        </button>
      )}
    </fieldset>
  );
}
