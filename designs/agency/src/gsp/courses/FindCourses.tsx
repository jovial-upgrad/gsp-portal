import { fmtMoney } from '../../data/format';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Checkbox, Field, Form, SelectInput } from '../../components/forms';
import { Sheet } from '../../components/Sheet';
import { COUNTRIES } from '../../data/partners';
import { fullName, type Student } from '../../data/students';
import { COURSES, FLAG, FLAG_COLOURS, money, type Course } from '../../data/courses';
import {
  AREAS,
  DESTINATIONS,
  FEE_CAPS,
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
  universitiesFor,
  type CourseSearch,
  type Filters,
  type Need,
} from './search';
import { CourseSheet } from './CourseSheet';
import { StudentPick, ShortNudge, type Nudge } from '../../screens/courses/Shortlist';
import { CompareBar, CompareSheet, DownloadSheet, MAX_PICK, type Sender } from '../../screens/courses/Compare';
import { IntakePill, UniMark, campusLabel, duration } from './parts';
import '../../screens/courses/courses.css';

type SetSearch = (fn: (s: CourseSearch) => CourseSearch) => void;
const ease = [0.2, 0.8, 0.2, 1] as const;
const TOP = ['India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Vietnam', 'Pakistan', 'Philippines', 'Nigeria', 'Ghana', 'Kenya'];

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
}) {
  const reduce = useReducedMotion();
  const r = useMemo(() => results(s), [s]);
  const [open, setOpen] = useState<Course | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // on phones, once results show, the five fields fold into one line that opens again with "Change"
  const [editNeed, setEditNeed] = useState(false);
  const [focused, setFocused] = useState(false);
  const ready = s.searched && needOk(s.need);
  const missing = missingNeed(s.need);
  const tried = s.searched && !ready;

  const setNeed = (k: keyof Need, v: string) =>
    set((p) => ({ ...p, need: { ...p.need, [k]: v, ...(k === 'country' ? { state: '' } : {}) }, shown: 20, ...(k === 'dest' ? { filters: { ...p.filters, uni: '', maxFee: 0, intake: '' } } : {}) }));
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    set((p) => ({ ...p, filters: { ...p.filters, [k]: v, ...(k === 'maxFee' ? { feeLakh: undefined } : {}) }, shown: 20 }));
  // shortlists belong to students (29 Oct): with one picked, the star is theirs; with none, it lists who to shortlist for
  const student = students.find((x) => x.id === s.studentId);
  const [pickFor, setPickFor] = useState<{ c: Course; anchor: HTMLElement } | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const shortIds = student ? student.shortlist ?? [] : [...new Set(students.flatMap((x) => x.shortlist ?? []))];
  // the "Shortlisted only" filter follows the students' lists: the picked student's, or everyone's
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
  const pickedCourses = picked.map((id) => COURSES.find((c) => c.id === id)).filter((c): c is Course => !!c);
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

  return (
    <div className="find">
      <header className="find__head">
        <div className="find__titles">
          <h1 className="page__title">Find courses</h1>
          <p className="find__lead">Search courses your student can be offered.</p>
        </div>
        {/* no Student view in GSP's roles: there's no commission here to hide (W26) */}
      </header>

      <Form className="card fsearch" onSubmit={search} aria-label="Search courses">
        <div className="fsearch__row">
          {/* optionally, one of the agency's students: their country and state then fill the bar below */}
          <div className={`fsearch__who ${s.studentId ? '' : 'is-empty'}`}>
            <Icon name="user" size={20} />
            <select id="fc-student" className="fsearch__who-select" aria-label="Student this search is for" value={s.studentId ?? ''} onChange={(e) => pickStudent(e.target.value)}>
              <option value="">Select student</option>
              {/* with none to pick, the list still opens and says why */}
              {!students.length && (
                <option value="none" disabled>
                  {canApply ? 'No students yet: add them in Students' : 'Students open once GSP verifies your agency'}
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
            <FilterPanel s={s} setFilter={setFilter} clear={() => set((p) => ({ ...p, filters: { ...NO_FILTERS }, shown: 20 }))} />
          </aside>


          <section className="flist" aria-labelledby="fc-count">
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
              <label className="fbar__sort">
                <span>Sort</span>
                <span className="fbar__pick">
                  <select className="fbar__select" value={s.sort} onChange={(e) => set((p) => ({ ...p, sort: e.target.value as CourseSearch['sort'] }))}>
                    {SORTS.filter(([k]) => k !== 'earn').map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" size={16} className="fbar__chev" />
                </span>
              </label>
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
                    {r.hidden} {r.hidden === 1 ? 'course' : 'courses'} hidden:
                  </strong>{' '}
                  {list(r.hiddenBy)} {r.hiddenBy.length === 1 ? 'doesn’t' : 'don’t'} take students from {s.need.state}, {s.need.country} through GSP.
                </span>
              </p>
            )}

            {active.length > 0 && (
              <ul className="fchips" aria-label="Filters in use">
                {active.map((a) => (
                  <li key={a.key}>
                    <button type="button" className="fchip" onClick={() => set((p) => ({ ...p, filters: { ...p.filters, [a.key]: NO_FILTERS[a.key], ...(a.key === 'maxFee' ? { feeLakh: undefined } : {}) }, shown: 20 }))} aria-label={`Remove filter: ${a.label}`}>
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

            {r.list.length === 0 ? (
              <div className="card fempty">
                <h2 className="fempty__title">No courses match</h2>
                <p className="fempty__text">
                  {active.length
                    ? `${r.before} ${r.before === 1 ? 'course matches' : 'courses match'} your search before the filters. Remove a filter to see more.`
                    : 'Try a different study area or program level, or check the spelling of the course or university.'}
                </p>
                {active.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => set((p) => ({ ...p, filters: { ...NO_FILTERS } }))}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <ul className="clist">
                {r.list.slice(0, s.shown).map((c, i) => (
                  <CourseCard
                    key={c.id}
                    c={c}
                    i={i}
                    s={s}
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
            {r.list.length > s.shown && (
              <div className="fmore">
                <Button variant="secondary" onClick={() => set((p) => ({ ...p, shown: p.shown + 20 }))}>
                  Show {Math.min(20, r.list.length - s.shown)} more
                </Button>
                <span className="fmore__note num">
                  Showing {s.shown} of {r.list.length}
                </span>
              </div>
            )}
            {picked.length > 0 && <CompareBar n={picked.length} onClear={() => setPicked([])} onCompare={() => setComparing(true)} onDownload={() => setDownloading({ compare: false })} />}
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
        <FilterPanel s={s} setFilter={setFilter} clear={() => set((p) => ({ ...p, filters: { ...NO_FILTERS }, shown: 20 }))} idPrefix="m-" inSheet />
      </Sheet>

      <CourseSheet
        c={open}
        s={s}
        onClose={() => setOpen(null)}
        shortlisted={!!open && isShort(open.id)}
        onShort={(el) => open && onStar(open, el)}
        shortOff={shortOff}
        compared={!!open && picked.includes(open.id)}
        comparable={!!open && (picked.includes(open.id) || picked.length < MAX_PICK)}
        onCompare={() => open && togglePick(open.id)}
        canApply={canApply}
        agency={agency}
        onApply={() => open && onApply(open)}
        onPick={setOpen}
      />
      <CompareSheet
        open={comparing}
        list={pickedCourses}
        // GSP's people never see commission in Find courses: only the RP sees its own (W26)
        agent={false}
        canApply={canApply}
        isShort={isShort}
        onApply={onApply}
        onShort={onStar}
        shortOff={shortOff}
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
        // GSP's people never see commission in Find courses: only the RP sees its own (W26)
        agent={false}
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

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const TOGGLES: [keyof Filters, string][] = [
  ['open', 'Intake open now'],
  ['soon', 'Deadline within 45 days'],
  ['schol', 'Scholarship available'],
  ['noFee', 'No application fee'],
  ['flex', 'English test can wait or be waived'],
  ['psw', 'Post-study work visa'],
];

/** The filters in use, as removable chips. */
function activeFilters(s: CourseSearch) {
  const f = s.filters;
  const cur = currencyOf(s.need);
  const out: { key: keyof Filters; label: string }[] = [];
  if (f.uni) out.push({ key: 'uni', label: universitiesFor(s.need).find((u) => u.id === f.uni)?.name ?? 'University' });
  if (f.maxFee)
    out.push({
      key: 'maxFee',
      label: f.feeLakh ? `Tuition up to ₹${f.feeLakh} lakh (≈ ${fmtMoney(f.maxFee, cur)})` : `Tuition up to ${fmtMoney(f.maxFee, cur)}`,
    });
  if (f.maxIelts) out.push({ key: 'maxIelts', label: `IELTS up to ${f.maxIelts.toFixed(1)}` });
  TOGGLES.forEach(([k, t]) => f[k] && out.push({ key: k, label: t }));
  if (f.shortlisted) out.push({ key: 'shortlisted', label: 'Shortlisted' });
  return out;
}

function FilterPanel({
  s,
  setFilter,
  clear,
  idPrefix = '',
  inSheet = false,
}: {
  s: CourseSearch;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  clear: () => void;
  idPrefix?: string;
  /** In the phone sheet, the sheet's own header says "Filters". */
  inSheet?: boolean;
}) {
  const f = s.filters;
  const cur = currencyOf(s.need);
  const caps = FEE_CAPS[cur] ?? [];
  const id = (x: string) => `${idPrefix}ff-${x}`;
  return (
    <div className="fpanel">
      <div className={`fpanel__head ${inSheet ? 'is-sheet' : ''}`}>
        {!inSheet && <h2 className="fpanel__title">Filters</h2>}
        <button type="button" className="btn btn--link fpanel__clear" onClick={clear}>
          Clear
        </button>
      </div>
      <Field id={id('uni')} label="University">
        <SelectInput id={id('uni')} value={f.uni} placeholder="Any" allowEmpty onChange={(e) => setFilter('uni', e.target.value)}>
          {universitiesFor(s.need).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field id={id('fee')} label={`Tuition a year, up to${cur ? ` (${cur})` : ''}`}>
        <SelectInput id={id('fee')} value={f.maxFee ? String(f.maxFee) : ''} placeholder="Any" allowEmpty onChange={(e) => setFilter('maxFee', +e.target.value || 0)}>
          {[...new Set([...caps, ...(f.maxFee ? [f.maxFee] : [])])]
            .sort((a, b) => a - b)
            .map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString('en-GB')}
              </option>
            ))}
        </SelectInput>
      </Field>
      <Field id={id('ielts')} label="IELTS needed, up to">
        <SelectInput id={id('ielts')} value={f.maxIelts ? String(f.maxIelts) : ''} placeholder="Any" allowEmpty onChange={(e) => setFilter('maxIelts', +e.target.value || 0)}>
          {[5.5, 6, 6.5, 7].map((n) => (
            <option key={n} value={n}>
              {n.toFixed(1)}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="fpanel__checks">
        {TOGGLES.map(([k, t]) => (
          <Checkbox key={k} id={id(k)} checked={!!f[k]} onChange={(v) => setFilter(k, v as never)}>
            {t}
          </Checkbox>
        ))}
        <Checkbox id={id('short')} checked={f.shortlisted} onChange={(v) => setFilter('shortlisted', v)}>
          Shortlisted only <span className="num">({s.shortlist.length})</span>
        </Checkbox>
      </div>
    </div>
  );
}

function CourseCard({
  c,
  i,
  s: _s,
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
  const facts: [string, string, string?, string?][] = [
    ['Tuition a year', money(c.tuition, c.currency)],
    ['Application fee', c.appFee ? money(c.appFee, c.currency) : 'Free'],
    ['Duration', duration(c.months)],
  ];

  const tags = [
    c.scholarship > 0 && `Scholarship up to ${money(c.scholarship, c.currency)}`,
    c.englishFlex && 'English test can wait',
    c.psw && 'Post-study work visa',
    c.uni.group,
  ].filter(Boolean) as string[];

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
            {c.intakes.map((x) => (
              <IntakePill key={x.month} i={x} />
            ))}
          </div>
        </div>
      </div>

      <dl className="course__facts is-4">
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
          {tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          <span className="course__checked">Last updated on {c.checked} 26</span>
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
