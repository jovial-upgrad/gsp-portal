import { useMemo, useState } from 'react';
import { EditOnly } from '../../proto/viewOnly';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { AREAS, DESTINATIONS, LEVELS, money } from '../../data/courses';
import { COURSE_STATUSES, type CourseRec, type CourseStatus } from '../data/catalogue';
import { Filter, NoMatch, PageHead, Pager, Tiles, passes, usePaged, useRecord } from './parts';
import { COURSE_TONE, CoursePill } from './pills';
import { CoursePage } from './CoursePage';
import { CourseColumns, CourseForm, blankCourse, courseTemplate, newCourse, readCourses, type CourseDraft } from './CourseForm';
import { CsvImport } from './CsvImport';
import { logLine, stampBy } from '../data/records';
import type { PageProps } from '../portal/model';

const SUB: Record<CourseStatus, string> = { Live: 'In Course search', Draft: 'Not in search yet', Hidden: 'Taken out of search' };

/**
 * Courses (29 Oct; 2nd round from the PM prototype's IP team): every course, where its details came from, and its
 * status (Live, Draft or Hidden: no Needs a check since the 5th round). 6th round, as in the PM prototype and with
 * no bots: nothing is held back for approval, and everything is entered by the team. A course is added with its
 * basics, as a draft, and filled in on its page. 4 Nov: 20 a page, with the pages under it (no Show more); every
 * filter picks several, and Study area is one of them.
 */
export function Catalogue(props: PageProps) {
  const { db, set, focus, navKey, open, say, scrollTop, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const [q, setQ] = useState('');
  const [uni, setUni] = useState<string[]>([]);
  const [level, setLevel] = useState<string[]>([]);
  const [area, setArea] = useState<string[]>([]);
  const [country, setCountry] = useState<string[]>([]);
  const [status, setStatus] = useState<CourseStatus | ''>('');
  const [form, setForm] = useState<CourseDraft | null>(null);
  const [importing, setImporting] = useState(false);

  const courses = db.courses;
  const byId = useMemo(() => new Map(db.unis.map((u) => [u.id, u])), [db.unis]);
  const live = (c: CourseRec): CourseRec => ({ ...c, uni: byId.get(c.uni.id) ?? c.uni });
  const rows = useMemo(
    () =>
      courses.filter((c) => {
        const t = q.trim().toLowerCase();
        if (t && !`${c.name} ${c.uni.name} ${c.campus.city} ${c.code}`.toLowerCase().includes(t)) return false;
        if (!passes(uni, c.uni.id) || !passes(level, c.level) || !passes(area, c.area) || !passes(country, c.uni.country)) return false;
        if (status && c.status !== status) return false;
        return true;
      }),
    [courses, q, uni, level, area, country, status],
  );
  const pg = usePaged(rows, [q, uni, level, area, country, status]);
  // the universities in the countries picked
  const uniOptions = db.unis.filter((u) => passes(country, u.country));
  const uniName = (id: string) => byId.get(id)?.name ?? id;
  const clear = () => {
    setQ('');
    setUni([]);
    setLevel([]);
    setArea([]);
    setCountry([]);
    setStatus('');
  };

  const shown = cur ? courses.find((c) => c.id === cur.id) : undefined;

  /** Adds the courses, and a line to each university's Logs tab. */
  const addAll = (recs: CourseRec[], what: (n: string[]) => string) => {
    const byUni = new Map<string, string[]>();
    recs.forEach((r) => byUni.set(r.uni.id, [...(byUni.get(r.uni.id) ?? []), r.name]));
    set((d) => ({
      ...d,
      courses: [...recs, ...d.courses],
      unis: d.unis.map((u) => (byUni.has(u.id) ? { ...u, stamps: { ...u.stamps, courses: stampBy(me) }, log: [logLine(me, 'courses', what(byUni.get(u.id)!)), ...u.log] } : u)),
    }));
  };
  const save = (f: CourseDraft) => {
    const rec = newCourse(f, db.unis, courses, me);
    addAll([rec], ([n]) => `Added ${n} as a draft`);
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
        <EditOnly>
          <Button variant="secondary" iconLeft={<Icon name="upload" size={18} />} onClick={() => setImporting(true)}>
            Import CSV
          </Button>
        </EditOnly>
        <EditOnly>
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setForm({ ...blankCourse, uni: uni.length === 1 ? uni[0] : '' })}>
            Add a course
          </Button>
        </EditOnly>
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
            <Filter
              id="icrs-country"
              label="Country"
              all="All countries"
              value={country}
              options={DESTINATIONS}
              onChange={(l) => {
                setCountry(l);
                // a university outside the countries picked no longer applies
                setUni((x) => x.filter((id) => passes(l, byId.get(id)?.country ?? '')));
              }}
            />
            <Filter id="icrs-uni" label="University" all="All universities" value={uni} options={uniOptions.map((u) => u.id)} onChange={setUni} labels={uniName} search />
            <Filter id="icrs-level" label="Program level" all="All levels" value={level} options={LEVELS} onChange={setLevel} />
            <Filter id="icrs-area" label="Study area" all="All study areas" value={area} options={AREAS} onChange={setArea} search />
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
                  {pg.rows.map((raw) => {
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
                          <span className="irow__sub">{c.checked}</span>
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
            <Pager pg={pg} what="courses" />
          </>
        )}
      </section>

      {formSheet}
      <CsvImport
        open={importing}
        title="Import courses from a CSV"
        template={{ name: 'courses-template.csv', rows: courseTemplate(true) }}
        columns={<CourseColumns />}
        read={(rows) => readCourses(rows, db.unis, courses)}
        saveLabel={(n) => `Add ${n} ${n === 1 ? 'course' : 'courses'}`}
        readyText={(n) => `${n} ${n === 1 ? 'course' : 'courses'} to add as drafts.`}
        onCancel={() => setImporting(false)}
        onSave={(list) => {
          const recs = list.map((f) => newCourse(f, db.unis, courses, me, 'CSV upload'));
          addAll(recs, (names) => `Added ${names.length} ${names.length === 1 ? 'course' : 'courses'} as drafts from a CSV upload: ${names.join(', ')}`);
          setImporting(false);
          clear();
          setStatus('Draft');
          say(recs.length === 1 ? `${recs[0].name} added as a draft.` : `${recs.length} courses added as drafts.`);
        }}
      />
    </div>
  );
}
