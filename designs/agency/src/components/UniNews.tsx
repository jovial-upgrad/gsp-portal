import { getDb } from '../institution/data/store';
import { statusOf } from '../institution/data/announcements';
import type { Course } from '../data/courses';

/**
 * The university's live announcements on a course's details (Jovial, 31 Oct): the ones the Institution Team
 * published about this university, for this course's level and study area (or for all), that the viewer is in the
 * audience for. Newest first.
 */
export function uniNews(c: Course, audience: 'RP' | 'GSP') {
  return getDb()
    .anns.filter((a) => statusOf(a) === 'Live' && a.unis.includes(c.uni.id))
    .filter((a) => (!a.levels.length || a.levels.includes(c.level)) && (!a.areas.length || a.areas.includes(c.area)))
    .filter((a) => audience === 'GSP' || a.userTypes.includes('RP'))
    .sort((x, y) => (x.publish < y.publish ? 1 : -1));
}
const plain = (md: string) => md.replace(/[#*_>`[\]]/g, '').replace(/\(https?:[^)]*\)/g, '').split('\n').find((l) => l.trim()) ?? '';
const day = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function UniNews({ c, audience }: { c: Course; audience: 'RP' | 'GSP' }) {
  const list = uniNews(c, audience);
  if (!list.length) return null;
  return (
    <section className="cs-news" aria-labelledby="cs-news-h">
      <h3 id="cs-news-h" className="cs-news__h">
        From {c.uni.name}
      </h3>
      <ul className="cs-news__list">
        {list.map((a) => (
          <li key={a.id} className="cs-news__item">
            <p className="cs-news__title">{a.title}</p>
            <p className="cs-news__body">{plain(a.body)}</p>
            <p className="cs-news__meta">
              {a.category} · {day(a.publish)}
              {a.expires ? ` · until ${day(a.expires)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
