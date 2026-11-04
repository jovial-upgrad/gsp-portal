import { useState } from 'react';
import { fmtDate } from '../data/format';
import { getDb } from '../institution/data/store';
import { statusOf, summaryOf, isImage, type Announcement } from '../institution/data/announcements';
import type { Course } from '../data/courses';
import { Icon } from './Icon';

/**
 * The university's live announcements on a course's details (Jovial, 31 Oct; 4 Nov): the ones the Institution Team
 * published about this university, for this course's program level and study area (or for all), that the viewer is
 * in the audience for. Newest first. Linked to the course by university, program level and study area only.
 */
export function uniNews(c: Course, audience: 'RP' | 'GSP') {
  return getDb()
    .anns.filter((a) => statusOf(a) === 'Live' && a.unis.includes(c.uni.id))
    .filter((a) => (!a.levels.length || a.levels.includes(c.level)) && (!a.areas.length || a.areas.includes(c.area)))
    .filter((a) => audience === 'GSP' || a.userTypes.includes('RP'))
    .sort((x, y) => (x.publish < y.publish ? 1 : -1));
}
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[#*_>`[\]]/g, '').replace(/\(https?:[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
const day = (iso: string) => fmtDate(iso);
/** How many show before "Show N more". */
const FIRST = 2;

/**
 * Jovial, 4 Nov: with two or more announcements, GSP Assist's summary sits on top: one line per announcement (written
 * once at go-live, job J9), numbered to match the list. Each announcement shows its images (the first as a picture,
 * "+N" for the rest, all in a viewer) and its PDFs as chips.
 */
export function UniNews({ c, audience }: { c: Course; audience: 'RP' | 'GSP' }) {
  const list = uniNews(c, audience);
  const [all, setAll] = useState(false);
  const [view, setView] = useState<{ a: Announcement; i: number } | null>(null);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, FIRST);
  return (
    <div className="cs-newswrap">
      {list.length > 1 && (
        <section className="cs-ai" aria-labelledby="cs-ai-h">
          <p id="cs-ai-h" className="cs-ai__h">
            <span className="cs-ai__spark" aria-hidden="true" />
            <b>GSP Assist</b> · What’s new at {c.uni.name} for this course
            <small>From {list.length} announcements</small>
          </p>
          <ol className="cs-ai__list">
            {list.map((a, i) => (
              <li key={a.id}>
                {summaryOf(a)}
                <span className="cs-ai__ref" aria-label={`announcement ${i + 1}`}>
                  {i + 1}
                </span>
              </li>
            ))}
          </ol>
          <p className="cs-ai__foot">Written by GSP Assist from the announcements below. Check them before advising a student.</p>
        </section>
      )}
      <section className="cs-news" aria-labelledby="cs-news-h">
        <div className="cs-news__top">
          <h3 id="cs-news-h" className="cs-news__h">
            From {c.uni.name}
          </h3>
          {list.length > 1 && <span className="cs-news__n">{list.length} live announcements</span>}
        </div>
        <ul className="cs-news__list">
          {shown.map((a) => {
            const n = list.indexOf(a) + 1;
            const pics = a.files.filter((f) => isImage(f) && a.media?.[f]);
            const docs = a.files.filter((f) => !pics.includes(f));
            return (
              <li key={a.id} className={`cs-news__item ${pics.length ? 'has-pic' : ''}`}>
                <div>
                  <p className="cs-news__title">
                    {list.length > 1 && <span className="cs-news__num">{n}</span>}
                    {a.title}
                  </p>
                  <p className="cs-news__body">{plain(a.body)}</p>
                  <p className="cs-news__meta">
                    <span className="cs-news__cat">{a.category}</span>
                    {day(a.publish)}
                    {a.expires ? ` · until ${day(a.expires)}` : ''}
                    {docs.map((f) => (
                      <span key={f} className="cs-news__file">
                        <Icon name="file" size={13} /> {f}
                      </span>
                    ))}
                  </p>
                </div>
                {pics.length > 0 && (
                  <button type="button" className="cs-news__pic" style={{ backgroundImage: `url("${a.media![pics[0]]}")` }} aria-label={`See ${pics.length === 1 ? 'the image' : `the ${pics.length} images`} for ${a.title}`} onClick={() => setView({ a, i: 0 })}>
                    {pics.length > 1 && <i>+{pics.length - 1}</i>}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {list.length > FIRST && (
          <button type="button" className="cs-news__more" aria-expanded={all} onClick={() => setAll((x) => !x)}>
            {all ? 'Show fewer' : `Show ${list.length - FIRST} more announcement${list.length - FIRST === 1 ? '' : 's'}`}
            <Icon name="chevronDown" size={16} className={all ? 'is-up' : ''} />
          </button>
        )}
      </section>
      {view && <Viewer a={view.a} start={view.i} onClose={() => setView(null)} />}
    </div>
  );
}

function Viewer({ a, start, onClose }: { a: Announcement; start: number; onClose: () => void }) {
  const pics = a.files.filter((f) => isImage(f) && a.media?.[f]);
  const [i, setI] = useState(start);
  return (
    <div className="cs-view" role="dialog" aria-modal="true" aria-label={`Images: ${a.title}`} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <button type="button" className="cs-view__bg" aria-label="Close" onClick={onClose} />
      <figure className="cs-view__fig">
        <img src={a.media![pics[i]]} alt={pics[i]} />
        <figcaption>
          {pics[i]} · {i + 1} of {pics.length}
        </figcaption>
        <div className="cs-view__acts">
          {pics.length > 1 && (
            <>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setI((i + pics.length - 1) % pics.length)}>Previous</button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setI((i + 1) % pics.length)}>Next</button>
            </>
          )}
          <button type="button" className="btn btn--primary btn--sm" autoFocus onClick={onClose}>Close</button>
        </div>
      </figure>
    </div>
  );
}
