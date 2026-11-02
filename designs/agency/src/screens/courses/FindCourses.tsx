import { TOP_MARKETS } from '../../data/partners';
import { fmtDate } from '../../data/format';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, Form, Switch } from '../../components/forms';
import { SelectMenu } from '../../components/SelectMenu';
import { RangeSlider } from '../../components/RangeSlider';
import { MultiPick } from '../../institution/records/MultiPick';
import { Sheet } from '../../components/Sheet';
import { COUNTRIES } from '../../data/partners';
import { fullName, type Student } from '../../data/students';
import { searchCatalogue } from '../../institution/data/store';
import { FLAG, FLAG_COLOURS, durationText, earnOf, feeAYear, intakeState, money, totalTuition, type Course } from '../../data/courses';
import {
  ANY_DUR,
  AREAS,
  DESTINATIONS,
  DUR_STOPS,
  LEVELS,
  NEED_LABEL,
  NO_FILTERS,
  POPULAR,
  SORTS,
  currencyOf,
  intakeMonths,
  missingNeed,
  needOk,
  results,
  runSearch,
  soFar,
  campusState,
  passes,
  tagList,
  totalIn,
  type CourseSearch,
  type Filters,
  type Need,
} from './search';
import { CourseSheet } from './CourseSheet';
import { PER_PAGE, Pager, UniFilter } from './ResultParts';
import { StudentPick, ShortNudge, type Nudge } from './Shortlist';
import { CompareBar, CompareSheet, DownloadSheet, MAX_PICK, type Sender } from './Compare';
import { UniMark, campusLabel } from './parts';
import './courses.css';

type SetSearch = (fn: (s: CourseSearch) => CourseSearch) => void;
const ease = [0.2, 0.8, 0.2, 1] as const;
// one markets list (HC36)
const TOP = TOP_MARKETS;

/**
 * Find courses. Optionally for one of the agency's students (their country and state then decide what they can
 * apply to), one search box (course, university or city, in plain words, typos allowed), and the five things the
 * brief needs before results mean anything: destination, the student's country and state, level and area, plus
 * the intake, if they have one in mind.
 * After the first search, results follow every change. Filters on the left (a sheet on phones), results on the right.
 */
export function FindCourses({
  s,
  set,
  canApply,
  agency,
  onApply,
  students = [],
  home,
  onShortlist,
  onOpenShortlist,
  from,
  gsp = false,
}: {
  s: CourseSearch;
  set: SetSearch;
  /** While GSP verifies the agency, applying waits. */
  canApply: boolean;
  agency: string;
  onApply: (c: Course) => void;
  /** The agency's students, to search for one of them. None while GSP verifies the agency. */
  students?: Student[];
  /** The agency's own country and state: where a search that isn't for a student starts. */
  home: { country: string; state: string };
  /** Shortlisting keeps the course on the student's profile. */
  onShortlist?: (studentId: string, ids: string[]) => void;
  /** Opens a student's shortlist on their profile, from the nudge after shortlisting. */
  onOpenShortlist?: (studentId: string) => void;
  /** Who a downloaded PDF is from. */
  from?: Sender;
  /** A GSP role: no Student view and no commission (W26); universities hidden from an RP still show. */
  gsp?: boolean;
}) {
  const reduce = useReducedMotion();
  // GSP's people see the page as Student view would: no commission anywhere (W26)
  if (gsp && !s.studentView) s = { ...s, studentView: true };
  const r = useMemo(() => results(s, !gsp), [s, gsp]);
  const cur = currencyOf(s.need);
  const [open, setOpen] = useState<Course | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // on phones, once results show, the five fields fold into one line that opens again with "Change"
  const [editNeed, setEditNeed] = useState(false);
  const [focused, setFocused] = useState(false);
  const ready = s.searched && needOk(s.need);
  const missing = missingNeed(s.need);
  const tried = s.searched && !ready;

  const setNeed = (k: keyof Need, v: string) =>
    set((p) => ({ ...p, need: { ...p.need, [k]: v, ...(k === 'country' ? { state: '' } : {}) }, shown: 20, ...(k === 'dest' ? { filters: { ...p.filters, unis: [], fee: null, destState: '', intake: '' } } : {}) }));
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    set((p) => ({ ...p, filters: { ...p.filters, [k]: v, ...(k === 'fee' ? { feeLakh: undefined } : {}) }, shown: 20 }));
  // shortlists belong to students (29 Oct): with one picked, the star is theirs; with none, it lists who to shortlist for
  const student = students.find((x) => x.id === s.studentId);
  const [pickFor, setPickFor] = useState<{ c: Course; anchor: HTMLElement } | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const shortIds = student ? student.shortlist ?? [] : [...new Set(students.flatMap((x) => x.shortlist ?? []))];
  // the stars follow the students' lists: the picked student's, or everyone's
  useEffect(() => {
    if (students.length && shortIds.join() !== s.shortlist.join()) set((p) => ({ ...p, shortlist: shortIds }));
  }, [shortIds.join(), students.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const isShort = (id: string) => s.shortlist.includes(id);
  const toggleFor = (st: Student, c: Course) => {
    const has = !!st.shortlist?.includes(c.id);
    onShortlist?.(st.id, has ? st.shortlist!.filter((x) => x !== c.id) : [...(st.shortlist ?? []), c.id]);
    setNudge({ key: Date.now(), on: !has, student: st, course: `${c.name}, ${c.uni.name}` });
  };
  const onStar = (c: Course, anchor: HTMLElement) => {
    if (student) toggleFor(student, c);
    else if (students.length) setPickFor((p) => (p?.c.id === c.id ? null : { c, anchor }));
  };
  // shortlists are students' (Jovial, 1 Nov): with no students yet, Shortlist is off, and says why
  const shortOff = students.length ? undefined : 'Add a student first';
  // up to five courses, ticked to compare or download together
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [downloading, setDownloading] = useState<{ compare: boolean } | null>(null);
  const pickedCourses = picked.map((id) => searchCatalogue().courses.find((c) => c.id === id)).filter((c): c is Course => !!c);
  const togglePick = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < MAX_PICK ? [...l, id] : l));
  const search = () => set((p) => runSearch(p));
  // a student, optionally: their country and state decide what they can apply to; none goes back to the agency's
  const pickStudent = (id: string) => {
    const st = students.find((x) => x.id === id);
    set((p) =>
      st
        ? { ...p, student: fullName(st), studentId: st.id, shortlist: st.shortlist ?? [], need: { ...p.need, country: st.country || st.nationality, state: st.state }, shown: 20 }
        : { ...p, student: undefined, studentId: undefined, need: { ...p.need, country: home.country, state: home.state }, shown: 20 },
    );
  };
  const months = intakeMonths(s.need);
  const active = activeFilters(s);
  // what each filter offers comes from the results, less that filter (1 Nov)
  const facet = (k: keyof Filters) => r.pool.filter((c) => passes(c, s.filters, cur, k));
  // results in pages of 20 (1 Nov); `shown` keeps the page, so every change of search or filter goes back to page 1
  const pages = Math.max(1, Math.ceil(r.list.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Math.ceil(s.shown / PER_PAGE)));
  const top = useRef<HTMLElement>(null);
  const toPage = (n: number) => {
    set((p) => ({ ...p, shown: n * PER_PAGE }));
    top.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="find">
      <header className="find__head">
        <div className="find__titles">
          <h1 className="page__title">Find courses</h1>
          <p className="find__lead">Search courses your student can be offered.</p>
        </div>
        {!gsp && <div className="find__view">
          <Switch id="fc-view" checked={s.studentView} onChange={(v) => set((p) => ({ ...p, studentView: v }))}>
            Student view
          </Switch>
          <p className="find__view-note">Hides every commission figure while you share your screen.</p>
        </div>}
      </header>

      <Form className="card fsearch" onSubmit={search} aria-label="Search courses">
        <div className="fsearch__row">
          {/* optionally, one of the agency's students: their country and state then fill the bar below */}
          {/* picking a student waits until GSP verifies the agency (1 Nov); it says why */}
          <div className={`fsearch__who ${s.studentId ? '' : 'is-empty'} ${canApply ? '' : 'is-disabled'}`} title={canApply ? undefined : STUDENT_WAIT}>
            <Icon name="user" size={20} />
            <select
              id="fc-student"
              className="fsearch__who-select"
              aria-label="Student this search is for"
              aria-describedby={canApply ? undefined : 'fc-student-why'}
              disabled={!canApply}
              value={canApply ? s.studentId ?? '' : ''}
              onChange={(e) => pickStudent(e.target.value)}
            >
              <option value="">Select student</option>
              {/* with none to pick, the list still opens and says why */}
              {canApply && !students.length && (
                <option value="none" disabled>
                  No students yet: add them in Students
                </option>
              )}
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {fullName(st)} · {st.state ? `${st.state}, ` : ''}
                  {st.country || st.nationality}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={18} />
          </div>
          <div className="fsearch__box">
            <Icon name="search" size={20} />
            <input
              id="fc-q"
              type="search"
              className="fsearch__input"
              aria-label="Search by course, university or city, in your own words"
              value={s.text}
              autoComplete="off"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                const text = e.target.value;
                set((p) => ({ ...p, text }));
              }}
            />
            {!s.text && <RotatingHint paused={focused} />}
          </div>
          <Button type="submit" className="fsearch__go">
            Search
          </Button>
        </div>
        {!canApply && (
          <p id="fc-student-why" className="fsearch__why">
            {STUDENT_WAIT}
          </p>
        )}

        {ready && (
          <div className={`fneed__summary ${editNeed ? 'is-hidden' : ''}`}>
            <p className="fneed__sum-text">
              {[s.need.dest, `${s.need.state}, ${s.need.country}`, s.need.level, s.need.area, s.filters.intake ? `${s.filters.intake} intake` : 'Any intake'].join(' · ')}
            </p>
            <button type="button" className="btn btn--link" aria-expanded={editNeed} onClick={() => setEditNeed(true)}>
              Change
            </button>
          </div>
        )}
        {/* the five things the brief needs before results mean anything, as one slim bar */}
        <fieldset className={`fseg ${ready && !editNeed ? 'is-folded' : ''}`}>
          <legend className="vh">Who the course is for (the first five are needed; the intake is optional)</legend>
          <Segment id="fc-dest" label="Destination" value={s.need.dest} options={[...DESTINATIONS]} onChange={(v) => setNeed('dest', v)} error={tried && !s.need.dest} />
          <Segment
            id="fc-country"
            label="Student’s country"
            value={s.need.country}
            options={[...TOP, ...COUNTRIES.map((c) => c.name).filter((n) => !TOP.includes(n)).sort()]}
            onChange={(v) => setNeed('country', v)}
            error={tried && !s.need.country}
          />
          <Segment
            id="fc-state"
            label="State or province"
            value={s.need.state}
            options={statesOf(s.need.country)}
            onChange={(v) => setNeed('state', v)}
            error={tried && !s.need.state}
            disabled={!s.need.country}
          />
          <Segment id="fc-level" label="Program Level" value={s.need.level} options={[...LEVELS]} onChange={(v) => setNeed('level', v)} error={tried && !s.need.level} />
          <Segment id="fc-area" label="Study Area" value={s.need.area} options={[...AREAS]} onChange={(v) => setNeed('area', v)} error={tried && !s.need.area} />
          <Segment id="fc-intake" label="Intake" value={s.filters.intake} options={s.filters.intake && !months.includes(s.filters.intake) ? [s.filters.intake, ...months] : months} onChange={(v) => setFilter('intake', v)} optional />
        </fieldset>
      </Form>

      {!ready ? (
        <motion.section
          className="card flanding"
          aria-labelledby="fl-title"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease }}
        >
          {tried ? (
            <div className="flanding__need" role="status">
              <Icon name="info" size={18} />
              <div>
                <h2 id="fl-title" className="flanding__title">
                  Choose the {list(missing.map((k) => NEED_LABEL[k]))} to see courses
                </h2>
                <p className="flanding__text">
                  <span className="num">{soFar(s.need).toLocaleString('en-GB')}</span> courses match so far.
                </p>
              </div>
            </div>
          ) : (
            <h2 id="fl-title" className="flanding__title">
              Start with a popular search
            </h2>
          )}
          <ul className="fpop" aria-label="Popular searches">
            {POPULAR.map(([label, text]) => (
              <li key={label}>
                <button type="button" className="chip-btn" onClick={() => set((p) => runSearch({ ...p, text, filters: { ...NO_FILTERS }, need: { ...p.need, dest: '', level: '', area: '' } }))}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      ) : (
        <div className="fres">
          <aside className="card ffilters" aria-label="Filters">
            <FilterPanel s={s} facet={facet} setFilter={setFilter} clear={() => set((p) => ({ ...p, filters: { ...NO_FILTERS }, shown: 20 }))} />
          </aside>


          <section className="flist" aria-labelledby="fc-count" ref={top}>
            <div className="fbar">
              <p className="fbar__count" id="fc-count" role="status">
                <strong className="num">
                  {r.list.length} {r.list.length === 1 ? 'course' : 'courses'}
                </strong>
                {r.uni && <> at {r.uni.name}</>}
              </p>
              <Button variant="secondary" size="sm" className="fbar__filters" iconLeft={<Icon name="sliders" size={16} />} onClick={() => setFiltersOpen(true)}>
                Filters{active.length ? ` · ${active.length}` : ''}
              </Button>
              <div className="fbar__sort">
                <span id="fc-sort-k">Sort</span>
                <span className="fbar__pick fbar__pick--menu">
                  <SelectMenu id="fc-sort" label="Sort" describedBy="fc-sort-k" value={s.sort} options={SORTS.map(([k, t]) => ({ value: k, label: t }))} onChange={(v) => set((p) => ({ ...p, sort: v as CourseSearch['sort'], shown: 20 }))} />
                </span>
              </div>
            </div>

            {r.alias && (
              <p className="fnote">
                <Icon name="info" size={16} />
                <span>
                  <strong>{r.uni?.name}</strong> was called {r.alias}. Showing its courses.
                </span>
              </p>
            )}
            {r.hidden > 0 && (
              <p className="fnote">
                <Icon name="info" size={16} />
                <span>
                  <strong className="num">
                    {r.hidden} {r.hidden === 1 ? 'course is' : 'courses are'} hidden by university territory rules:
                  </strong>{' '}
                  {list(r.hiddenBy)}.
                </span>
              </p>
            )}

            {active.length > 0 && (
              <ul className="fchips" aria-label="Filters in use">
                {active.map((a) => (
                  <li key={a.key}>
                    <button type="button" className="fchip" onClick={() => set((p) => ({ ...p, filters: { ...p.filters, ...a.clear(p.filters), ...(a.key === 'fee' ? { feeLakh: undefined } : {}) }, shown: 20 }))} aria-label={`Remove filter: ${a.label}`}>
                      {a.label}
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" className="btn btn--link fchips__clear" onClick={() => set((p) => ({ ...p, filters: { ...NO_FILTERS }, shown: 20 }))}>
                    Clear filters
                  </button>
                </li>
              </ul>
            )}

            {s.failed ? (
              <div className="card fempty" role="alert">
                <h2 className="fempty__title">Courses didn’t load. Try again.</h2>
                <Button variant="secondary" size="sm" onClick={() => set((p) => ({ ...p, failed: false }))}>
                  Try again
                </Button>
              </div>
            ) : r.list.length === 0 ? (
              <div className="card fempty">
                <h2 className="fempty__title">No courses match these filters</h2>
                <p className="fempty__text">Widen the tuition fee or duration, or clear a filter.</p>
                <Button variant="secondary" size="sm" onClick={() => set((p) => ({ ...p, filters: { ...NO_FILTERS, intake: p.filters.intake } }))}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <ul className="clist">
                {r.list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((c, i) => (
                  <CourseCard
                    key={c.id}
                    c={c}
                    i={i}
                    s={s}
                    gsp={gsp}
                    shortlisted={isShort(c.id)}
                    shortFor={student?.first}
                    onShort={(el) => onStar(c, el)}
                    shortOff={shortOff}
                    picked={picked.includes(c.id)}
                    pickable={picked.includes(c.id) || picked.length < MAX_PICK}
                    onPick={() => togglePick(c.id)}
                    onOpen={() => setOpen(c)}
                    canApply={canApply}
                    agency={agency}
                    onApply={onApply}
                  />
                ))}
              </ul>
            )}
            <Pager page={page} total={r.list.length} onPage={toPage} />
            {!s.failed && picked.length > 0 && <CompareBar n={picked.length} onClear={() => setPicked([])} onCompare={() => setComparing(true)} onDownload={() => setDownloading({ compare: false })} />}
          </section>
        </div>
      )}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <Button block onClick={() => setFiltersOpen(false)}>
            Show {r.list.length} {r.list.length === 1 ? 'course' : 'courses'}
          </Button>
        }
      >
        <FilterPanel s={s} facet={facet} setFilter={setFilter} clear={() => set((p) => ({ ...p, filters: { ...NO_FILTERS }, shown: 20 }))} idPrefix="m-" inSheet />
      </Sheet>

      <CourseSheet
        c={open}
        s={s}
        onClose={() => setOpen(null)}
        shortlisted={!!open && isShort(open.id)}
        onShort={(el) => open && onStar(open, el)}
        shortOff={shortOff}
        canApply={canApply}
        agency={agency}
        onApply={() => open && onApply(open)}
        onPick={setOpen}
        student={student}
      />
      <CompareSheet
        open={comparing}
        list={pickedCourses}
        country={s.need.country}
        onClose={() => setComparing(false)}
        onRemove={(id) => {
          setPicked((l) => l.filter((x) => x !== id));
          if (picked.length <= 1) setComparing(false);
        }}
        onDownload={() => {
          // one dialog at a time: the download, then back to the comparison when it closes
          setComparing(false);
          setDownloading({ compare: true });
        }}
      />
      <DownloadSheet
        open={!!downloading}
        list={pickedCourses}
        country={s.need.country}
        compare={!!downloading?.compare}
        from={from ?? { org: agency, name: '', email: '' }}
        onClose={() => {
          if (downloading?.compare && picked.length > 1) setComparing(true);
          setDownloading(null);
        }}
      />
      <StudentPick
        anchor={pickFor?.anchor ?? null}
        course={pickFor ? `${pickFor.c.name}, ${pickFor.c.uni.name}` : ''}
        students={students}
        has={(st) => !!pickFor && !!st.shortlist?.includes(pickFor.c.id)}
        onToggle={(st) => pickFor && toggleFor(st, pickFor.c)}
        onClose={() => setPickFor(null)}
      />
      <ShortNudge n={nudge} onView={(st) => onOpenShortlist?.(st.id)} onClose={() => setNudge(null)} />
    </div>
  );
}

/* ---------- pieces ---------- */

/** One part of the "who is it for" bar: a small label with a red asterisk over the chosen value. */
function Segment({
  id,
  label,
  value,
  options,
  onChange,
  error,
  disabled,
  optional,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  error?: boolean;
  disabled?: boolean;
  /** No asterisk, and "Any" can be chosen again. */
  optional?: boolean;
}) {
  return (
    <div className={`fseg__item ${value || optional ? '' : 'is-empty'} ${error ? 'is-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <label className="fseg__label" htmlFor={id}>
        {label}
        {!optional && (
          <>
            <span className="field__req" aria-hidden="true">
              *
            </span>
            <span className="vh"> (required)</span>
          </>
        )}
      </label>
      <select id={id} className="fseg__select" value={value} disabled={disabled} aria-invalid={error || undefined} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled={!optional}>
          {optional ? 'Any' : 'Choose'}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={16} className="fseg__chev" />
    </div>
  );
}

/** Examples that take turns in the empty search box, so people see they can type it as they'd say it. */
const HINTS = ['Course, university or city', 'MBA in UK under 25 lakhs', 'Data science in Australia, Feb intake', 'Masters in Canada with scholarship', 'Nursing in Australia, no IELTS'];
function RotatingHint({ paused }: { paused: boolean }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [turns, setTurns] = useState(0);
  // two rounds, then it rests on the first; it pauses while the box has focus, and never moves under reduced motion
  const live = !reduce && !paused && turns < HINTS.length * 2;
  useEffect(() => {
    if (!live) return;
    const t = window.setTimeout(() => {
      setI((x) => (x + 1) % HINTS.length);
      setTurns((n) => n + 1);
    }, 2600);
    return () => window.clearTimeout(t);
  }, [live, i]);
  const at = turns >= HINTS.length * 2 ? 0 : i;
  const text = HINTS[at];
  return (
    <span className="fsearch__ph" aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={text}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease }}
        >
          {at === 0 ? text : `Try “${text}”`}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function statesOf(country: string) {
  const c = COUNTRIES.find((x) => x.name === country);
  return c && c.states.length ? c.states : country ? ['Whole country'] : [];
}

/** Why Select student is off before verification. */
const STUDENT_WAIT = 'Select student opens once GSP verifies your agency.';

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Money without the currency code, for the slider's ends ("39,700"). */
const amount = (n: number) => Math.round(n).toLocaleString('en-GB');

/** The filters in use, as removable chips; each says how to take itself off. */
function activeFilters(s: CourseSearch) {
  const f = s.filters;
  const cur = currencyOf(s.need);
  const out: { key: keyof Filters; label: string; clear: (f: Filters) => Partial<Filters> }[] = [];
  if (f.fee)
    out.push({
      key: 'fee',
      label: f.feeLakh ? `Tuition fee up to ₹${f.feeLakh} lakh (≈ ${money(f.fee[1], cur)})` : `Tuition fee ${money(f.fee[0], cur)} to ${money(f.fee[1], cur)}`,
      clear: () => ({ fee: null }),
    });
  f.tags.forEach((t) => out.push({ key: 'tags', label: t, clear: (x) => ({ tags: x.tags.filter((y) => y !== t) }) }));
  if (f.dur[0] !== ANY_DUR[0] || f.dur[1] !== ANY_DUR[1]) out.push({ key: 'dur', label: `Duration ${DUR_STOPS[f.dur[0]]} to ${DUR_STOPS[f.dur[1]]}`, clear: () => ({ dur: ANY_DUR }) });
  f.unis.forEach((id) => {
    const u = searchCatalogue().unis.find((x) => x.id === id);
    out.push({ key: 'unis', label: u?.name ?? 'University', clear: (x) => ({ unis: x.unis.filter((y) => y !== id) }) });
  });
  if (f.destState) out.push({ key: 'destState', label: f.destState, clear: () => ({ destState: '' }) });
  return out;
}

/**
 * The left panel: five filters, and no others (slice 3 PRD): **Tuition fee** (two handles, the total fee, bounds the
 * lowest and highest total fees in the results), **Tags** (Admin's list; all of the ones picked, S3C-4), **Duration**
 * (two handles, <1 year to 5+ years; courses in credits match every range), **University** (any of the ones picked)
 * and **Destination state or province**. Each offers what the results less that filter hold (1 Nov). Clear resets them.
 */
function FilterPanel({
  s,
  facet,
  setFilter,
  clear,
  idPrefix = '',
  inSheet = false,
}: {
  s: CourseSearch;
  /** The results less one filter: what that filter can offer. */
  facet: (k: keyof Filters) => Course[];
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  clear: () => void;
  idPrefix?: string;
  /** In the phone sheet, the sheet's own header says "Filters". */
  inSheet?: boolean;
}) {
  const f = s.filters;
  const cur = currencyOf(s.need);
  const id = (x: string) => `${idPrefix}ff-${x}`;
  // the fee range: the lowest and highest total fees in the results (S3-20), rounded out to a step
  const fees = facet('fee').map((c) => totalIn(c, cur));
  const step = 500;
  const lo = fees.length ? Math.floor(Math.min(...fees) / step) * step : 0;
  const hi = fees.length ? Math.ceil(Math.max(...fees) / step) * step : 0;
  const fee: [number, number] = f.fee ? [Math.max(lo, Math.min(f.fee[0], hi)), Math.min(hi, Math.max(f.fee[1], lo))] : [lo, hi];
  const statePool = facet('destState');
  const states = [...new Set(statePool.map(campusState).filter(Boolean))].sort();
  return (
    <div className="fpanel">
      <div className={`fpanel__head ${inSheet ? 'is-sheet' : ''}`}>
        {!inSheet && <h2 className="fpanel__title">Filters</h2>}
        <button type="button" className="btn btn--link fpanel__clear" onClick={clear}>
          Clear
        </button>
      </div>
      <div className="fpanel__f">
        <p className="field__label" id={id('fee-label')}>
          Tuition fee{cur ? ` (${cur}, whole course)` : ' (whole course)'}
        </p>
        <RangeSlider id={id('fee')} label="Tuition fee" min={lo} max={hi} step={step} value={fee} format={amount} onChange={(v) => setFilter('fee', v[0] <= lo && v[1] >= hi ? null : v)} />
      </div>
      <Field id={id('tags')} label="Tags">
        <MultiPick id={id('tags')} label="Tags" value={f.tags} options={tagList().map((t) => t)} empty="Any tags" search onChange={(v) => setFilter('tags', v)} />
      </Field>
      {f.tags.length > 1 && <p className="fpanel__note">Courses with all {f.tags.length} tags.</p>}
      <div className="fpanel__f">
        <p className="field__label" id={id('dur-label')}>
          Duration
        </p>
        <RangeSlider id={id('dur')} label="Duration" min={0} max={DUR_STOPS.length - 1} value={f.dur} stops={DUR_STOPS} onChange={(v) => setFilter('dur', v)} />
        {f.dur[0] === ANY_DUR[0] && f.dur[1] === ANY_DUR[1] ? <p className="fpanel__note">Any length</p> : <p className="fpanel__note">Courses in credits match every range.</p>}
      </div>
      <UniFilter key={`${s.need.dest}|${s.keyword}`} id={id('uni')} pool={facet('unis')} value={f.unis} onChange={(v) => setFilter('unis', v)} />
      <Field id={id('state')} label="Destination state or province">
        <SelectMenu
          id={id('state')}
          label="Destination state or province"
          value={f.destState}
          options={[{ value: '', label: 'Any state or province' }, ...states.map((x) => ({ value: x, label: x, note: String(statePool.filter((c) => campusState(c) === x).length) }))]}
          onChange={(v) => setFilter('destState', v)}
        />
      </Field>
    </div>
  );
}

function CourseCard({
  c,
  i,
  s,
  gsp: _gsp = false,
  shortlisted,
  shortFor,
  onShort,
  shortOff,
  picked,
  pickable,
  onPick,
  onOpen,
  canApply,
  agency,
  onApply,
}: {
  c: Course;
  i: number;
  s: CourseSearch;
  gsp?: boolean;
  shortlisted: boolean;
  /** The student picked in the search: the star shortlists for them; with none, it asks who for. */
  shortFor?: string;
  onShort: (anchor: HTMLElement) => void;
  /** Why Shortlist is off (no students yet), when it is. */
  shortOff?: string;
  /** Ticked to compare or download, and whether another can be ticked (up to five). */
  picked: boolean;
  pickable: boolean;
  onPick: () => void;
  onOpen: () => void;
  canApply: boolean;
  agency: string;
  onApply: (c: Course) => void;
}) {
  const reduce = useReducedMotion();
  const [why, setWhy] = useState(false);
  // slice 3 PRD, Results: the total tuition fee with the fee a year underneath (S3-20), the application fee or Free,
  // the duration ("36 credits"), the QS rank or "—", and the base commission (≈; hidden in Student view)
  const facts: [string, string, string?, string?][] = [
    ['Tuition fee', money(totalTuition(c), c.currency), undefined, `${money(feeAYear(c), c.currency)} a year`],
    ['Application fee', c.appFee ? money(c.appFee, c.currency) : 'Free'],
    ['Duration', durationText(c)],
    ['QS rank', c.uni.qs ? `#${c.uni.qs}` : '—'],
  ];
  if (!s.studentView) facts.push(['Base commission', `≈ ${money(earnOf(c), c.currency)}`, 'earn']);
  // up to two intakes, closed ones left out: "Mar 2027 · Open"
  const intakes = c.intakes.filter((x) => intakeState(x) !== 'closed').slice(0, 2);
  const STATE: Record<string, string> = { open: 'Open', likely: 'Likely', late: 'Late' };

  return (
    <motion.li
      className={`card course ${picked ? 'is-picked' : ''}`}
      style={{ '--flag-1': FLAG_COLOURS[c.uni.country][0], '--flag-2': FLAG_COLOURS[c.uni.country][1] } as CSSProperties}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease, delay: Math.min(i, 6) * 0.03 }}
    >
      {/* the header carries the destination: washed in its flag's colours, the country named beside the intakes */}
      <div className="course__top">
        <div className="course__head">
          <UniMark u={c.uni} />
          <div className="course__titles">
            <h3 className="course__name">
              <button type="button" className="course__open" onClick={onOpen}>
                {c.name}
              </button>
            </h3>
            <p className="course__uni">
              {c.uni.name} · {campusLabel(c.campus)}
            </p>
          </div>
          {/* Compare sits beside the star (Nesil, 29 Oct) */}
          <label className={`ccmp ccmp--head ${picked ? 'is-on' : ''} ${pickable ? '' : 'is-off'}`} title={pickable ? undefined : `Up to ${MAX_PICK} courses`}>
            <input type="checkbox" className="vh" checked={picked} disabled={!pickable} onChange={onPick} aria-label={`Compare ${c.name}, ${c.uni.name}`} />
            <span className="ccmp__box" aria-hidden="true">
              <Icon name="check" size={12} strokeWidth={2.8} />
            </span>
            <span aria-hidden="true">Compare</span>
          </label>
          <button
            type="button"
            className={`star ${shortlisted ? 'is-on' : ''}`}
            aria-pressed={shortlisted}
            disabled={!!shortOff}
            aria-label={shortOff ? `Shortlist ${c.name}, ${c.uni.name}: ${shortOff.toLowerCase()}` : shortFor ? `Shortlist ${c.name}, ${c.uni.name}, for ${shortFor}` : `Shortlist ${c.name}, ${c.uni.name}, for a student`}
            title={shortOff ?? (shortlisted ? (shortFor ? `Shortlisted for ${shortFor}` : 'Shortlisted') : shortFor ? `Shortlist for ${shortFor}` : 'Shortlist for a student')}
            onClick={(e) => onShort(e.currentTarget)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
            </svg>
          </button>
        </div>

        <div className="course__meta">
          <span className="course__country">
            <span className="course__country-flag" aria-hidden="true">
              {FLAG[c.uni.country]}
            </span>
            {c.uni.country}
          </span>
          <div className="course__intakes" aria-label="Intakes">
            {intakes.map((x) => (
              <span key={x.month} className={`ipill ${intakeState(x) === 'open' ? 'ipill--open' : 'ipill--soft'}`}>
                {x.month} · {STATE[intakeState(x)]}
              </span>
            ))}
            {!intakes.length && <span className="ipill ipill--closed">No open intake</span>}
          </div>
        </div>
      </div>

      <dl className={`course__facts ${s.studentView ? 'is-4' : ''}`}>
        {facts.map(([k, v, cls, sub]) => (
          <div key={k} className={cls ? `is-${cls}` : undefined}>
            <dt>{k}</dt>
            <dd className="num">
              {v}
              {sub && <span className="course__sub">{sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="course__foot">
        <div className="course__tags">
          {/* the course record's date it was last checked (HC3) */}
          <span className="course__checked">Last updated {fmtDate(c.checked)}</span>
        </div>
        <div className="course__acts">
          <Button variant="secondary" size="sm" onClick={onOpen}>
            Details
          </Button>
          <Button size="sm" iconLeft={canApply ? undefined : <Icon name="lock" size={14} />} aria-describedby={why ? `why-${c.id}` : undefined} onClick={() => (canApply ? onApply(c) : setWhy((w) => !w))}>
            Apply
          </Button>
        </div>
      </div>
      {why && !canApply && (
        <p className="course__why" id={`why-${c.id}`} role="status">
          Applications open once GSP verifies {agency || 'your agency'}. Shortlist it for now.
        </p>
      )}
    </motion.li>
  );
}
