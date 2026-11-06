import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { University } from '../../data/courses';
import photos from '../../data/campus-photos.json';
import sample1 from '../../assets/campus/sample-1.webp';
import sample2 from '../../assets/campus/sample-2.webp';
import sample3 from '../../assets/campus/sample-3.webp';
import sample4 from '../../assets/campus/sample-4.webp';
import sample5 from '../../assets/campus/sample-5.webp';

/** A photo, described for screen readers (no caption shows); a university's own photos also carry their credit, linked to where they're from. */
export type Photo = { src: string; caption: string; author?: string; license?: string; source?: string };
type OwnPhoto = Omit<Photo, 'src'> & { file: string };

const MAX = 10;
const FILES = import.meta.glob('../../assets/campus/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

/** Sample photos every university shows until it has its own (Nesil, 27 Oct). */
const SAMPLES: Photo[] = [
  { src: sample1, caption: 'Students on the campus lawn' },
  { src: sample2, caption: 'Walking between classes' },
  { src: sample3, caption: 'Students on campus' },
  { src: sample4, caption: 'Study spaces in the library' },
  { src: sample5, caption: 'Graduation day' },
];

/** The university's photos (up to 10): its own, or the shared samples until it has some. */
export function photosOf(u: University): Photo[] {
  const own = ((photos as Record<string, OwnPhoto[]>)[u.id] ?? [])
    .map(({ file, ...p }) => ({ ...p, src: FILES[`../../assets/campus/${file}`] }))
    .filter((p) => p.src);
  return (own.length ? own : SAMPLES).slice(0, MAX);
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
          <li key={p.src + i} className="cs-photo">
            <img className="cs-photo__img" src={p.src} alt={p.caption} loading="lazy" decoding="async" />
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
