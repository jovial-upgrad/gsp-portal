import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { University } from '../../data/courses';

/** A photo, described for screen readers (no caption shows); one without an image is a placeholder with its file name. */
export type Photo = { src?: string; caption: string; author?: string; license?: string; source?: string };

const MAX = 10;

/**
 * The university's photos (up to 10), from the Pictures on its record (Jovial, 1 Nov, HC11). None on the record: no
 * photos, and no samples in their place. A picture uploaded in the prototype keeps only its name, so it shows as a
 * placeholder with that name.
 */
export function photosOf(u: University): Photo[] {
  return (u.pictures ?? []).slice(0, MAX).map((p) => ({ src: p.src, caption: `${u.name}: ${p.name}` }));
}

/**
 * Campus life: up to 10 photos in a row of equal tiles, three in view on a wide screen; the arrows (or a swipe,
 * or Shift and the wheel) move along it a screenful at a time. No captions (Nesil, 27 Oct); a photo's credit
 * shows under it when it has one.
 */
export function CampusLife({ list }: { list: Photo[] }) {
  const row = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: list.length <= 3 });
  const measure = () => {
    const el = row.current;
    if (el) setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(() => {
    measure();
    const el = row.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list.length]);
  const move = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth, behavior: 'smooth' });

  return (
    <div className="cs-life">
      <ul ref={row} className="cs-life__row" onScroll={measure} aria-label={`${list.length} campus photos`}>
        {list.map((p, i) => (
          <li key={(p.src ?? p.caption) + i} className="cs-photo">
            {p.src ? (
              <img className="cs-photo__img" src={p.src} alt={p.caption} loading="lazy" decoding="async" />
            ) : (
              <span className="cs-photo__img cs-photo__ph" role="img" aria-label={p.caption}>
                <Icon name="file" size={24} />
                <span>{p.caption.split(': ').slice(1).join(': ')}</span>
              </span>
            )}
            {p.author && (
              <p className="cs-photo__credit">
                {p.source ? (
                  <a href={p.source} target="_blank" rel="noreferrer">
                    Photo: {p.author}
                    {p.license ? `, ${p.license}` : ''}
                    <span className="vh"> (opens in a new tab)</span>
                  </a>
                ) : (
                  `Photo: ${p.author}`
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!(edge.start && edge.end) && (
        <>
          <button type="button" className="cs-life__arrow is-prev" aria-label="Previous photos" disabled={edge.start} onClick={() => move(-1)}>
            <Icon name="arrowLeft" size={18} />
          </button>
          <button type="button" className="cs-life__arrow is-next" aria-label="More photos" disabled={edge.end} onClick={() => move(1)}>
            <Icon name="arrowRight" size={18} />
          </button>
        </>
      )}
    </div>
  );
}
