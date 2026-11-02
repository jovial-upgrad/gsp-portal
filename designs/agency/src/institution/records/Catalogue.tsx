import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { money } from '../../data/courses';
import { COURSE_STATUSES, type CourseRec, type CourseStatus } from '../data/catalogue';
import { dateText } from '../data/records';
import { Empty, Gone, NoMatch, PageHead, Pick, Tiles, usePager, useRecord } from './parts';
import { COURSE_TONE, CoursePill } from './pills';
import { CoursePage } from './CoursePage';
import { CsvImport } from './CsvImport';
import { OBJ, canEdit, type PageProps } from '../portal/model';

/** The soonest intake that isn't Closed, as the lists show it ("—" if none). */
export const nextIntake = (c: CourseRec) => {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const key = (m: string) => {
    const [mo, y] = m.split(' ');
    return Number(y) * 12 + MON.indexOf(mo);
  };
  return [...c.intakes].filter((i) => i.status !== 'closed').sort((a, b) => key(a.month) - key(b.month))[0]?.month ?? '—';
};
/** "55% · IELTS 6.5": the summary academic minimum and IELTS Academic overall. */
export const entryText = (c: CourseRec) => (c.academic > 0 || c.ielts[0] > 0 ? [c.academic > 0 ? `${c.academic}%` : '', c.ielts[0] > 0 ? `IELTS ${c.ielts[0]}` : ''].filter(Boolean).join(' · ') : '');

const SUB: Record<CourseStatus, string> = { Live: 'In Course search', Draft: 'Not in search yet', Hidden: 'Taken out of search' };

/**
 * Courses (29 Oct; 2nd round from the PM prototype's IP team): every course, where its details came from, and its
 * status (Live, Draft or Hidden: no Needs a check since the 5th round). 6th round, as in the PM prototype and with
 * no bots: nothing is held back for approval, and everything is entered by the team. A course is added with its
 * basics, as a draft, and filled in on its page. A long list, so it shows 40 at a time.
 */
export function Catalogue(props: PageProps) {
  const { db, set, focus, navKey, open, scrollTop, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const edit = canEdit(props, OBJ.courses);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState('');
  const [uni, setUni] = useState('');
  const [level, setLevel] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState<CourseStatus | ''>('');
  const courses = useMemo(() => [...db.courses].sort((a, b) => a.name.localeCompare(b.name)), [db.courses]);
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
  const { page, pager } = usePager(rows, [q, uni, level, country, status]);
  const clear = () => {
    setQ('');
    setUni('');
    setLevel('');
    setCountry('');
    setStatus('');
  };

  if (cur) {
    const shown = db.courses.find((c) => c.id === cur.id);
    if (!shown) return <Gone back={cur.back?.label ?? 'Courses'} onBack={back} />;
    return <CoursePage key={shown.id} c={live(shown)} tab={cur.tab} backLabel={cur.back?.label ?? 'Courses'} onBack={back} {...props} />;
  }

  return (
    <div className="ipage">
      <PageHead title="Courses" lead="Every course, where its details came from, and its status. Add a course from its university’s Courses tab.">
        {edit && (
          <Button variant="secondary" iconLeft={<Icon name="upload" size={18} />} onClick={() => setImporting(true)}>
            Import CSV
          </Button>
        )}
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
            <Pick id="icrs-country" label="Country" value={country} all="All countries" options={[...new Set(db.unis.map((u) => u.country))].sort()} onChange={setCountry} />
            <Pick id="icrs-uni" label="University" value={uni} all="All universities" options={db.unis.filter((u) => !country || u.country === country).map((u) => ({ value: u.id, label: u.name }))} onChange={setUni} />
            <Pick id="icrs-level" label="Program level" value={level} all="All levels" options={db.levels.map((l) => l.name)} onChange={setLevel} />
          </div>
          <p className="stools__count" id="icrs-count" role="status">
            <span>
              <span className="num">{rows.length === courses.length ? courses.length.toLocaleString('en-GB') : `${rows.length.toLocaleString('en-GB')} of ${courses.length.toLocaleString('en-GB')}`}</span> courses
            </span>
          </p>
        </div>
        {courses.length === 0 ? (
          <Empty text="No courses yet. Add one from its university’s Courses tab, or import a CSV." />
        ) : rows.length === 0 ? (
          <NoMatch onClear={clear} />
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
                            {c.uni.name} · {c.campus.name}
                          </span>
                        </td>
                        <td className="num">{c.tuition > 0 ? money(c.tuition, c.currency) : <span className="muted">Not set</span>}</td>
                        <td>{nextIntake(c)}</td>
                        <td className="num">{entryText(c) || <span className="muted">Not set</span>}</td>
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
            {pager}
          </>
        )}
      </section>

      <CsvImport
        open={importing}
        unis={db.unis}
        courses={db.courses}
        me={me}
        role={props.role ?? 'Institution'}
        onClose={() => setImporting(false)}
        onLoad={(recs) => recs.length && set((d) => ({ ...d, courses: [...recs, ...d.courses] }))}
      />
    </div>
  );
}
