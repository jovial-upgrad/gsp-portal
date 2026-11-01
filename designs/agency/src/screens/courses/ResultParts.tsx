import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SearchInput } from '../../components/forms';
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
export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
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

const SHOW = 10;

/**
 * The University filter (1 Nov): only the universities in the results, A to Z, with how many courses each,
 * a box to find one, and ten at a time with "Show more".
 */
export function UniFilter({ id, pool, value, onChange }: { id: string; pool: Course[]; value: string; onChange: (uniId: string) => void }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(SHOW);
  useEffect(() => setLimit(SHOW), [q]);
  const all = useMemo(() => {
    const by = new Map<string, { id: string; name: string; n: number }>();
    pool.forEach((c) => {
      const u = by.get(c.uni.id);
      if (u) u.n += 1;
      else by.set(c.uni.id, { id: c.uni.id, name: c.uni.name, n: 1 });
    });
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pool]);
  const words = q.trim().toLowerCase();
  const found = words ? all.filter((u) => u.name.toLowerCase().includes(words)) : all;
  // the one picked stays in view, first, whatever the box says
  const picked = all.find((u) => u.id === value);
  const rest = found.filter((u) => u.id !== value);
  const shown = rest.slice(0, limit);
  const left = rest.length - shown.length;
  const name = `${id}-pick`;

  const option = (key: string, uid: string, label: string, n?: number) => (
    <div className="check check--radio" key={key}>
      <input id={`${id}-${key}`} type="radio" name={name} className="check__input" checked={value === uid} onChange={() => onChange(uid)} />
      <label htmlFor={`${id}-${key}`} className="check__label">
        <span className="check__box" aria-hidden="true" />
        <span>
          {label}
          {n !== undefined && <span className="funi__n num"> ({n})</span>}
        </span>
      </label>
    </div>
  );

  return (
    <fieldset className="funi">
      <legend className="field__label">University</legend>
      {all.length > SHOW && <SearchInput id={`${id}-q`} label="Find a university" placeholder="Find a university" value={q} onChange={setQ} className="funi__search" />}
      <div className="funi__list">
        {option('any', '', 'Any university')}
        {picked && option(picked.id, picked.id, picked.name, picked.n)}
        {shown.map((u) => option(u.id, u.id, u.name, u.n))}
        {words && !found.length && <p className="funi__none">No university in these results matches “{q.trim()}”.</p>}
      </div>
      {left > 0 && (
        <button type="button" className="btn btn--link funi__more" onClick={() => setLimit((l) => l + SHOW)}>
          Show {Math.min(SHOW, left)} more <span className="vh">universities</span>
        </button>
      )}
    </fieldset>
  );
}

/**
 * Of a filter's "up to" values, the ones worth offering for these results (1 Nov): each lets in at least one more
 * course than the one before it, and none lets in every course (that's "Any"). The one in use always stays.
 */
export function capsIn(caps: number[], values: number[], current = 0): { cap: number; n: number }[] {
  const out: { cap: number; n: number }[] = [];
  [...new Set([...caps, ...(current ? [current] : [])])]
    .sort((a, b) => a - b)
    .forEach((cap) => {
      const n = values.filter((v) => v <= cap).length;
      const prev = out.length ? out[out.length - 1].n : 0;
      if (cap === current || (n > prev && n < values.length)) out.push({ cap, n });
    });
  return out;
}
