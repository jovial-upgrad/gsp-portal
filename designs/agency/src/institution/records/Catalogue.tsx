import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectInput } from '../../components/forms';
import { DESTINATIONS, LEVELS, money } from '../../data/courses';
import { COURSE_STATUSES, type CourseRec, type CourseStatus } from '../data/catalogue';
import { dateText } from '../data/records';
import { NoMatch, PAGE, PageHead, Tiles, useRecord } from './parts';
import { COURSE_TONE, CoursePill } from './pills';
import { CoursePage } from './CoursePage';
import { CourseForm, blankCourse, newCourse, type CourseDraft } from './CourseForm';
import type { PageProps } from '../portal/model';

const SUB: Record<CourseStatus, string> = { Live: 'In Course search', Draft: 'Not in search yet', Hidden: 'Taken out of search' };

/**
 * Courses (29 Oct; 2nd round from the PM prototype's IP team): every course, where its details came from, and its
 * status (Live, Draft or Hidden: no Needs a check since the 5th round). 6th round, as in the PM prototype and with
 * no bots: nothing is held back for approval, and everything is entered by the team. A course is added with its
 * basics, as a draft, and filled in on its page. A long list, so it shows 40 at a time.
 */
export function Catalogue(props: PageProps) {
  const { db, set, focus, navKey, open, say, scrollTop } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const [q, setQ] = useState('');
  const [uni, setUni] = useState('');
  const [level, setLevel] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState<CourseStatus | ''>('');
  const [shownN, setShownN] = useState(PAGE);
  const [form, setForm] = useState<CourseDraft | null>(null);
  useEffect(() => setShownN(PAGE), [q, uni, level, country, status]);

  const courses = db.courses;
  const byId = useMemo(() => new Map(db.unis.map((u) => [u.id, u])), [db.unis]);
  const live = (c: CourseRec): CourseRec => ({ ...c, uni: byId.get(c.uni.id) ?? c.uni });
  const rows = useMemo(
    () =>
      courses.filter((c) => {
        const t = q.trim().toLowerCase();
        if (t && !`${c.name} ${c.uni.name} ${c.campus.city} ${c.code}`.toLowerCase().includes(t)) return false;
        if (uni && c.uni.id !== uni) return false;
        if (level && c.level !== level) return false;
        if (country && c.uni.country !== country) return false;
        if (status && c.status !== status) return false;
        return true;
      }),
    [courses, q, uni, level, country, status],
  );
  const page = rows.slice(0, shownN);
  const clear = () => {
    setQ('');
    setUni('');
    setLevel('');
    setCountry('');
    setStatus('');
  };

  const shown = cur ? courses.find((c) => c.id === cur.id) : undefined;

  const save = (f: CourseDraft) => {
    const rec = newCourse(f, db.unis, courses);
    set((d) => ({ ...d, courses: [rec, ...d.courses] }));
    setForm(null);
    clear();
    say(`${rec.name} saved as a draft. Fill in its intakes, fees, academic and English, then publish it.`);
    show(rec.id);
  };

  const formSheet = <CourseForm f={form} unis={db.unis} courses={courses} onCancel={() => setForm(null)} onSave={save} />;
  if (cur && shown) return <CoursePage key={shown.id} c={live(shown)} tab={cur.tab} backLabel={cur.back?.label ?? 'Courses'} onBack={back} {...props} />;

  return (
    <div className="ipage">
      <PageHead title="Courses" lead="Every course, where its details came from, and its status. Open one to edit it.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setForm({ ...blankCourse, uni })}>
          Add a course
        </Button>
      </PageHead>

      <Tiles label="Where each course is" value={status} onPick={setStatus} items={COURSE_STATUSES.map((s) => ({ key: s, label: s, sub: SUB[s], tone: COURSE_TONE[s], n: courses.filter((c) => c.status === s).length }))} />

      <section className="card stable" aria-labelledby="icrs-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search courses</span>
              <input id="icrs-q" type="search" placeholder="Course, university, city or code" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <SelectInput id="icrs-country" aria-label="Country" value={country} placeholder="All countries" allowEmpty onChange={(e) => setCountry(e.target.value)}>
              {DESTINATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="icrs-uni" aria-label="University" value={uni} placeholder="All universities" allowEmpty onChange={(e) => setUni(e.target.value)}>
              {db.unis
                .filter((u) => !country || u.country === country)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </SelectInput>
            <SelectInput id="icrs-level" aria-label="Program level" value={level} placeholder="All levels" allowEmpty onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </SelectInput>
          </div>
          <p className="stools__count" id="icrs-count" role="status">
            <span>
              <span className="num">{rows.length === courses.length ? courses.length.toLocaleString('en-GB') : `${rows.length.toLocaleString('en-GB')} of ${courses.length.toLocaleString('en-GB')}`}</span> courses
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <NoMatch what="courses" onClear={clear} />
        ) : (
          <>
            <div className="stab-wrap">
              <table className="itab itab--crs">
                <thead>
                  <tr>
                    <th scope="col">Course</th>
                    <th scope="col">Tuition a year</th>
                    <th scope="col">Next intake</th>
                    <th scope="col">Entry</th>
                    <th scope="col">Source</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((raw) => {
                    const c = live(raw);
                    return (
                      <tr key={c.id} className="irow" onClick={() => show(c.id)}>
                        <td>
                          <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(c.id))}>
                            {c.name}
                          </button>
                          <span className="irow__sub">
                            {c.uni.name} · {c.campus.city}
                          </span>
                        </td>
                        <td className="num">{c.tuition > 0 ? money(c.tuition, c.currency) : <span className="muted">Not added</span>}</td>
                        <td>{c.intakes[0]?.month ?? <span className="muted">Not added</span>}</td>
                        <td className="num">{c.academic > 0 && c.ielts[0] > 0 ? `${c.academic}% · IELTS ${c.ielts[0]}` : <span className="muted">Not added</span>}</td>
                        <td>
                          {c.source}
                          <span className="irow__sub">Checked {dateText(c.checked)}</span>
                        </td>
                        <td>
                          <CoursePill s={c.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > shownN && (
              <div className="imore">
                <Button variant="secondary" onClick={() => setShownN((n) => n + PAGE)}>
                  Show {Math.min(PAGE, rows.length - shownN)} more
                </Button>
                <span className="imore__n">
                  Showing <span className="num">{shownN}</span> of <span className="num">{rows.length.toLocaleString('en-GB')}</span>
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {formSheet}
    </div>
  );
}
