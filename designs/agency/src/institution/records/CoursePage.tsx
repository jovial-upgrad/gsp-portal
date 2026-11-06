import { useUnsaved } from '../../components/unsaved';
import { notify } from '../../components/Toast';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DateInput, Field } from '../../components/forms';
import { CURRENCY, MIN_EDUCATION, intakeTimes, money, type Destination, type IntakeStatus } from '../../data/courses';
import { COUNTRIES, TOP_MARKETS } from '../../data/partners';
import { sampleApplications } from '../../data/applications';
import { adminCfg } from '../../admin/data/store';
import { UniMark, campusLabel } from '../courses/parts';
import { QUALIFICATIONS, SCALES, SCALE_MAX, UK_CLASS, scoreText, TESTS, TEST_MIN, newRuleId, withSearchFields, type AcademicRule, type CourseRec, type EnglishRule, type IntakeDates, type Qualification, type Scale, type Test, type UniRec } from '../data/catalogue';
import { dateText, daysTo, stampBy } from '../data/records';
import { audit, change, withLog, type LogSpec } from '../data/changelog';
import { liveTags, patch } from '../data/store';
import { ChangeLog, ErrorText, Facts, Pick, RecordHead, RecordTabs, Section, SystemInfo, TabPanel, toggle } from './parts';
import { CoursePill } from './pills';
import { MultiPick } from './MultiPick';
import { BasicsFields, basicsErrors, missingOf, type CourseDraft } from './CourseForm';
import { OBJ, canEdit, type PageProps } from '../portal/model';
import { NumberField } from '../../components/NumberField';

type Tab = 'basics' | 'intakes' | 'fees' | 'academic' | 'english' | 'log';
const TABS: Tab[] = ['basics', 'intakes', 'fees', 'academic', 'english', 'log'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** This year to 3 years ahead (slice 2 PRD). */
const YEARS = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() + i));
const STATUS: Record<IntakeStatus, string> = { open: 'Open', likely: 'Likely', late: 'Late (low likelihood)', closed: 'Closed' };
const COUNTRY_LIST = [...TOP_MARKETS, ...COUNTRIES.map((c) => c.name).filter((n) => !TOP_MARKETS.includes(n))];

/** The course's Change log, field by field (S2-13). */
const SPEC: LogSpec<CourseRec> = {
  record: 'Course',
  fields: {
    code: 'Basics · Course code', cricos: 'Basics · CRICOS course code', name: 'Basics · Course name', campus: 'Basics · Campus', level: 'Basics · Program level', area: 'Basics · Study area', mode: 'Basics · Study mode', durValue: 'Basics · Duration', durUnit: 'Basics · Unit', url: 'Basics · Course page', tags: 'Basics · Tags', checked: 'Basics · Last checked', source: 'Basics · Source',
    intakes: 'Intakes · Intake', dates: 'Intakes · Dates',
    currency: 'Fees · Currency', fullFee: 'Fees · Full course fee', firstYearFee: 'Fees · First-year fee', appFee: 'Fees · Application fee',
    minEducation: 'Academic · Minimum highest education required', minScore: 'Academic · Minimum score in it', minScoreScale: 'Academic · Its grading scale', minBacklogs: 'Academic · Backlogs allowed in it', academicRules: 'Academic · Row', englishRules: 'English · Row', status: 'Status',
  },
  fmt: { campus: (v) => (v as { name: string }).name, dates: () => 'Intake dates' },
};

/** How many applications use each course (S2-20: a course with applications can't be deleted). */
let APPS: Map<string, number> | null = null;
const appsFor = (id: string) => {
  APPS ??= sampleApplications().reduce((m, a) => m.set(a.courseId, (m.get(a.courseId) ?? 0) + 1), new Map<string, number>());
  return APPS.get(id) ?? 0;
};

/** What course search shows for an intake, from its application deadline and Admin's intake timings (slice 1). */
export function searchShows(deadline: string, status: IntakeStatus) {
  if (!deadline) return '—';
  const t = intakeTimes();
  const d = daysTo(deadline);
  if (d < -t.lateDays) return 'Closed';
  if (d < 0) return 'Late (likelihood is low)';
  if (d <= t.countdownDays) return `${STATUS[status]}, closes in ${d} ${d === 1 ? 'day' : 'days'}${d <= t.warnDays && status === 'open' ? ' (closing soon)' : ''}`;
  return STATUS[status];
}

/**
 * A course's page (slice 2 PRD): its status and what moves it (Publish, Hide with Undo, Show again, Delete draft,
 * Delete), then Basics, Intakes, Fees, Academic and English, each read-only with Edit, then Save or Cancel, and a
 * read-only Change log. Edited by Institution, IP Ops and Admin (matrix: Courses, intakes and entry rules), at any status.
 */
export function CoursePage(props: PageProps & { c: CourseRec; tab?: string; backLabel: string; onBack: () => void }) {
  const { c, tab: start, backLabel, onBack, set, say, db, open, me } = props;
  const role = props.role ?? 'Institution';
  const edit = canEdit(props, OBJ.courses);
  const [tab, setTab] = useState<Tab>(TABS.includes(start as Tab) ? (start as Tab) : 'basics');
  const [deleting, setDeleting] = useState(false);
  const u = db.unis.find((x) => x.id === c.uni.id);
  const apps = appsFor(c.id);
  /** Saves a tab (or the status), stamps it, and writes the Change log. Saving a Live course updates course search at once. */
  const save = (fn: (x: CourseRec) => CourseRec, what: string, part: string = tab) => {
    set((d) => ({ ...d, courses: patch(d.courses, c.id, (x) => withLog(SPEC, x, withSearchFields({ ...fn(x), stamps: { ...x.stamps, [part]: stampBy(me) } }), me, role)) }));
    say(what);
  };
  const setStatus = (to: CourseRec['status'], what: string, ev: string) => {
    save((x) => ({ ...x, status: to }), what, 'status');
    audit('Courses', `${ev}: ${c.name} (${c.uni.name}), ${c.status} → ${to}`, me, role);
  };
  /** Hide: at once, with Undo in the toast for 10 seconds. */
  const hide = () => {
    const was = { status: c.status, stamp: c.stamps.status };
    setStatus('Hidden', `${c.name} hidden.`, 'course.status_changed');
    notify({
      title: `${c.name} hidden`,
      text: 'It’s out of course search. Applications already made carry on.',
      undo: () => set((d) => ({ ...d, courses: patch(d.courses, c.id, (x) => withSearchFields({ ...x, status: was.status, stamps: { ...x.stamps, status: was.stamp }, log: [change(me, role, 'Course · Status', 'Hidden', was.status), ...x.log] })) })),
    });
  };
  const missing = missingOf(c);

  const act = !edit ? null : c.status === 'Draft' ? (
    <>
      <Button variant="secondary" size="sm" onClick={() => setDeleting(true)}>
        Delete draft
      </Button>
      <Button size="sm" disabled={missing.length > 0} onClick={() => setStatus('Live', `${c.name} published.`, 'course.published')}>
        Publish
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" size="sm" disabled={apps > 0} title={apps > 0 ? `${apps} applications use this course. Hide it instead.` : undefined} onClick={() => setDeleting(true)}>
        Delete
      </Button>
      {c.status === 'Hidden' ? (
        <Button size="sm" variant="secondary" onClick={() => setStatus('Live', `${c.name} is back in course search.`, 'course.status_changed')}>
          Show again
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={hide}>
          Hide
        </Button>
      )}
    </>
  );

  return (
    <div className="ipage irecord">
      <RecordHead
        back={backLabel}
        onBack={onBack}
        mark={<UniMark u={c.uni} big />}
        title={c.name}
        sub={
          <>
            <button type="button" className="btn btn--link ilink" onClick={() => open({ section: 'universities', id: c.uni.id, tab: 'courses', back: { section: 'catalogue', id: c.id, label: c.name } })}>
              {c.uni.name}
            </button>{' '}
            · {campusLabel(c.campus)} · {c.code ? <span className="num">{c.code}</span> : 'no code yet'} · Source: {c.source}
          </>
        }
        status={<CoursePill s={c.status} />}
        updated={c.stamps.status}
      >
        <div className="istatus">
          <p className="istatus__note">
            {c.status === 'Draft'
              ? missing.length
                ? `A draft. Publish stays off until it has ${missing.join(' and ')}.`
                : 'A draft: not in course search until it’s published.'
              : c.status === 'Hidden'
                ? 'Hidden: not in course search. Applications already made carry on.'
                : u && u.status !== 'Live'
                  ? `Live, and in course search once ${u.name} is Live.`
                  : u && u.inactive.includes(c.campus.name)
                    ? 'Live, but its campus is inactive: it’s in course search again once the campus is active.'
                    : 'Live: in course search.'}
            {c.status !== 'Draft' && apps > 0 && ` ${apps} ${apps === 1 ? 'application uses' : 'applications use'} this course. Hide it instead of deleting it.`}
          </p>
          {act && <div className="istatus__acts">{act}</div>}
        </div>
      </RecordHead>

      <RecordTabs
        id="ictab"
        label="Course"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'basics', label: 'Basics' },
          { key: 'intakes', label: 'Intakes', n: c.intakes.length },
          { key: 'fees', label: 'Fees' },
          { key: 'academic', label: 'Academic', n: c.academicRules.length },
          { key: 'english', label: 'English', n: c.englishRules.length },
          { key: 'log', label: 'Change log', n: c.log.length },
        ]}
      />

      <TabPanel id="ictab" tab={tab}>
        {tab === 'basics' && (
          <>
            <Basics key={c.id} c={c} u={u} courses={db.courses} tags={liveTags(db)} save={save} edit={edit} />
            <SystemInfo created={c.created} log={c.log} />
          </>
        )}
        {tab === 'intakes' && <Intakes key={c.id} c={c} save={save} edit={edit} />}
        {tab === 'fees' && <Fees key={c.id} c={c} save={save} edit={edit} />}
        {tab === 'academic' && <Academic key={c.id} c={c} save={save} edit={canEdit(props, OBJ.academic)} />}
        {tab === 'english' && <English key={c.id} c={c} save={save} edit={canEdit(props, OBJ.english)} />}
        {tab === 'log' && <ChangeLog log={c.log} id="ic-log" />}
      </TabPanel>

      <ConfirmDialog
        open={deleting}
        title={`Delete ${c.name}?`}
        confirm={c.status === 'Draft' ? 'Delete draft' : 'Delete course'}
        danger
        onConfirm={() => {
          setDeleting(false);
          set((d) => ({ ...d, courses: d.courses.filter((x) => x.id !== c.id) }));
          audit('Courses', `course.deleted: ${c.name} (${c.uni.name}), ${c.status}`, me, role);
          say(`${c.name} deleted.`);
          onBack();
        }}
        onCancel={() => setDeleting(false)}
      >
        <p>{c.status === 'Draft' ? 'The draft and everything entered on it go. It was never in course search.' : 'The course is removed and leaves course search. No application uses it.'}</p>
      </ConfirmDialog>
    </div>
  );
}

type Save = (fn: (x: CourseRec) => CourseRec, what: string) => void;

/** Unsaved changes on a tab: Cancel or Save. Leaving with changes asks "Discard your changes?". */
function SaveBar({ show, onDiscard, onSave, error, note }: { show: boolean; onDiscard: () => void; onSave: () => void; error?: string | null; note?: string; cancel?: boolean }) {
  useUnsaved(show && !note, show && !note, { onDiscard, what: "this tab", esc: false });
  if (!show) return null;
  return (
    <div className="isave" role="region" aria-label="Unsaved changes">
      <p className="isave__t">{error ?? note ?? 'Not saved yet.'}</p>
      <Button variant="secondary" size="sm" onClick={onDiscard}>
        Cancel
      </Button>
      <Button size="sm" onClick={onSave} disabled={!!note && !error}>
        Save
      </Button>
    </div>
  );
}

/** Each tab is read-only with Edit; Edit opens the form, Save or Cancel closes it. */
function useEditing() {
  const [editing, setEditing] = useState(false);
  return { editing, open: () => setEditing(true), close: () => setEditing(false) };
}
const EditButton = ({ onClick, what }: { onClick: () => void; what: string }) => (
  <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={onClick}>
    Edit<span className="vh"> {what}</span>
  </Button>
);
const Req = () => (
  <span className="field__req" aria-hidden="true">
    {' '}*
  </span>
);
const Dash = () => <span className="muted">—</span>;
const countriesText = (l: string[]) => (l.length ? l.join(', ') : 'All countries');
const str = (n: number) => (n > 0 ? String(n) : '');
const AddRow = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" className="btn btn--secondary btn--sm iadd iadd--row" onClick={onClick}>
    <Icon name="plus" size={16} /> {children}
  </button>
);
/** "18 months", "1 year", "240 credits" (the Duration table). */
export const durationText = (c: Pick<CourseRec, 'durUnit' | 'durValue' | 'months'>) => (c.durUnit === 'Credits' ? `${c.durValue} credits` : c.months && c.months % 12 === 0 ? `${c.months / 12} ${c.months === 12 ? 'year' : 'years'}` : `${c.months} months`);

function Basics({ c, u, courses, tags, save, edit }: { c: CourseRec; u?: UniRec; courses: CourseRec[]; tags: string[]; save: Save; edit: boolean }) {
  const first = (): CourseDraft & { tags: string[] } => ({ uni: c.uni.id, code: c.code, cricos: c.cricos ?? '', name: c.name, campus: c.campus.name, level: c.level, area: c.area, mode: c.mode, durUnit: c.durUnit, durValue: str(c.durValue), url: c.url, checked: c.checked, source: c.source, tags: c.tags });
  const [v, setV] = useState(first);
  const [tried, setTried] = useState(false);
  const ed = useEditing();
  const set = (p: Partial<ReturnType<typeof first>>) => setV((x) => ({ ...x, ...p }));
  const changed = JSON.stringify(v) !== JSON.stringify(first());
  const err = basicsErrors(v, u, courses, c.id);
  const bad = Object.values(err).some(Boolean);
  const cancel = () => (setV(first()), setTried(false), ed.close());
  return (
    <Section title="Basics" id="ic-basics" updated={c.stamps.basics} action={edit && !ed.editing ? <EditButton onClick={() => (setV(first()), ed.open())} what="basics" /> : undefined}>
      {!ed.editing ? (
        <>
          <Facts
            items={[
              ['Course code', <span key="c" className="num">{c.code}</span>],
              ...(c.uni.country === 'Australia' ? ([['CRICOS course code', c.cricos ? <span key="cr" className="num">{c.cricos}</span> : null]] as [string, ReactNode][]) : []),
              ['Course name', c.name],
              ['University', c.uni.name],
              ['Campus', campusLabel(c.campus)],
              ['Program level', c.level],
              ['Study area', c.area],
              ['Study mode', c.mode],
              ['Duration', c.durValue ? `${c.durValue} ${c.durUnit.toLowerCase()} (${durationText(c)})` : null],
              ['Course page', c.url ? <a key="u" href={c.url} target="_blank" rel="noreferrer">{c.url}</a> : null],
              ['Last checked', c.checked ? dateText(c.checked) : null],
              ['Source', c.source],
              ['Tags', c.tags.length ? c.tags.join(', ') : 'None'],
            ]}
          />
        </>
      ) : (
        <>
          <BasicsFields v={v} set={set} u={u} err={err} show={tried} lockUni idp="icb" />
          <p className="irsec__note">The university can’t change after the course is created.</p>
          <div className="iblock itagblock">
            <h3 className="iblock__title">Tags</h3>
            <p className="irsec__note">From Admin › Course configuration › Course tags. Partners see them on the course in course search, and they’re quick filters there.</p>
            <div className="ichecks__list itaglist">
              {[...new Set([...tags, ...v.tags.filter((t) => !tags.includes(t))])].map((t) => (
                <button key={t} type="button" className="ichip" aria-pressed={v.tags.includes(t)} onClick={() => set({ tags: toggle(v.tags, t) })}>
                  {v.tags.includes(t) && <Icon name="check" size={14} />}
                  {t}
                  {!tags.includes(t) && ' (retired)'}
                </button>
              ))}
            </div>
          </div>
          <SaveBar
            show
            note={!changed ? 'Nothing changed yet.' : undefined}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (bad) return (document.querySelector('#ic-basics ~ * [aria-invalid="true"], .irsec [aria-invalid="true"]') as HTMLElement | null)?.focus();
              const campus = (u?.campuses ?? []).find((x) => x.name === v.campus) ?? c.campus;
              const n = Number(v.durValue);
              const months = v.durUnit === 'Months' ? n : v.durUnit === 'Years' ? n * 12 : v.durUnit === 'Weeks' ? Math.round(n / 4.345) : c.months;
              save((x) => ({ ...x, code: v.code.trim().toUpperCase(), cricos: v.cricos.trim().toUpperCase() || undefined, name: v.name.trim(), campus, level: v.level as CourseRec['level'], area: v.area as CourseRec['area'], mode: v.mode as CourseRec['mode'], durUnit: v.durUnit as CourseRec['durUnit'], durValue: n, months, url: v.url.trim(), checked: v.checked, source: v.source as CourseRec['source'], tags: v.tags }), 'Basics saved.');
              setTried(false);
              ed.close();
            }}
            error={tried && bad ? 'Fix what’s marked, then save.' : null}
          />
        </>
      )}
    </Section>
  );
}

type IntakeRow = { key: string; month: string; year: string; status: IntakeStatus } & IntakeDates & { apply: string };

/** Date order (S2-18): deadlines on or before the batch start; the census date after it. */
function intakeErrors(r: IntakeRow) {
  const e: Partial<Record<'apply' | 'deposit' | 'accept' | 'census', string>> = {};
  if (!r.apply) e.apply = 'Enter the application deadline.';
  if (!r.deposit) e.deposit = 'Enter the deposit deadline.';
  if (r.start) {
    const on = `On or before the batch start (${dateText(r.start)}).`;
    if (r.apply && r.apply > r.start) e.apply = on;
    if (r.deposit && r.deposit > r.start) e.deposit = on;
    if (r.accept && r.accept > r.start) e.accept = on;
    if (r.census && r.census <= r.start) e.census = `After the batch start (${dateText(r.start)}).`;
  }
  return e;
}

function Intakes({ c, save, edit }: { c: CourseRec; save: Save; edit: boolean }) {
  const first = (): IntakeRow[] =>
    c.intakes.map((i, n) => {
      const [m, y] = i.month.split(' ');
      const d = c.dates[i.month] ?? { deposit: '', accept: '', start: '', census: '' };
      return { key: `i${n}`, month: m, year: y, status: i.status, apply: i.deadline, ...d };
    });
  const [rows, setRows] = useState(first);
  const [tried, setTried] = useState(false);
  const ed = useEditing();
  const changed = JSON.stringify(rows) !== JSON.stringify(first());
  const upd = (key: string, p: Partial<IntakeRow>) => setRows((l) => l.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const names = rows.map((r) => `${r.month} ${r.year}`);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  const errs = Object.fromEntries(rows.map((r) => [r.key, intakeErrors(r)]));
  const nErr = Object.values(errs).reduce((n, e) => n + Object.keys(e).length, 0);
  const error = dup ? `This course already has a ${dup} intake.` : nErr ? `${nErr} ${nErr === 1 ? 'date' : 'dates'} to fix.` : null;
  const cancel = () => (setRows(first()), setTried(false), ed.close());
  const add = () => setRows((l) => [...l, { key: `n${Date.now().toString(36)}`, month: MONTHS[(new Date().getMonth() + 3) % 12], year: YEARS[1], status: 'open', apply: '', deposit: '', accept: '', start: '', census: '' }]);
  const cell = (r: IntakeRow, k: 'apply' | 'deposit' | 'accept' | 'start' | 'census', label: string) => {
    const e = tried ? (errs[r.key] as Record<string, string>)[k] : undefined;
    return (
      <td>
        <DateInput id={`ici-${r.key}-${k}`} aria-label={`${label}, ${r.month} ${r.year}`} value={r[k]} invalid={!!e} onChange={(v) => upd(r.key, { [k]: v })} />
        {e && <span className="field__msg field__msg--error">{e}</span>}
      </td>
    );
  };
  const day = (v: string) => (v ? dateText(v) : <Dash />);
  const empty = (
    <p className="iempty">
      No intakes yet. A course needs at least one intake with an application deadline before it can be published.{' '}
      {edit && (
        <button type="button" className="btn btn--link" onClick={() => (ed.open(), add())}>
          Add an intake
        </button>
      )}
    </p>
  );
  return (
    <Section
      title="Intakes"
      id="ic-intakes"
      updated={c.stamps.intakes}
      note="“Likely”: the university runs it every year but hasn’t confirmed it; partners can still apply and GSP submits when it opens."
      action={edit && !ed.editing && c.intakes.length > 0 ? <EditButton onClick={() => (setRows(first()), ed.open())} what="intakes" /> : undefined}
    >
      {!ed.editing ? (
        c.intakes.length ? (
          <div className="stab-wrap">
            <table className="itab itab--view">
              <thead>
                <tr>
                  <th scope="col">Intake</th>
                  <th scope="col">Status</th>
                  <th scope="col">Application deadline</th>
                  <th scope="col">Deposit deadline</th>
                  <th scope="col">Acceptance deadline</th>
                  <th scope="col">Batch start date</th>
                  <th scope="col">Census date</th>
                  <th scope="col">Course search shows</th>
                </tr>
              </thead>
              <tbody>
                {first().map((r) => (
                  <tr key={r.key}>
                    <th scope="row">
                      {r.month} {r.year}
                    </th>
                    <td>{STATUS[r.status]}</td>
                    <td className="num">{day(r.apply)}</td>
                    <td className="num">{day(r.deposit)}</td>
                    <td className="num">{day(r.accept)}</td>
                    <td className="num">{day(r.start)}</td>
                    <td className="num">{day(r.census)}</td>
                    <td>{searchShows(r.apply, r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          empty
        )
      ) : (
        <>
          {rows.length ? (
            <div className="stab-wrap">
              <table className="itab itab--form">
                <thead>
                  <tr>
                    <th scope="col">
                      Intake
                      <Req />
                    </th>
                    <th scope="col">
                      Status
                      <Req />
                    </th>
                    <th scope="col">
                      Application deadline
                      <Req />
                    </th>
                    <th scope="col">
                      Deposit deadline
                      <Req />
                    </th>
                    <th scope="col">Acceptance deadline</th>
                    <th scope="col">Batch start date</th>
                    <th scope="col">Census date</th>
                    <th scope="col">
                      <span className="vh">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const n = Object.keys(errs[r.key]).length;
                    return (
                      <tr key={r.key}>
                        <td>
                          <span className="icell-pair">
                            <Pick id={`ici-${r.key}-m`} label={`Month, intake ${r.month} ${r.year}`} value={r.month} options={MONTHS} onChange={(month) => upd(r.key, { month })} />
                            <Pick id={`ici-${r.key}-y`} label={`Year, intake ${r.month} ${r.year}`} value={r.year} options={[...new Set([...YEARS, r.year])]} onChange={(year) => upd(r.key, { year })} />
                          </span>
                          {tried && n > 0 && <span className="field__msg field__msg--error">{n} {n === 1 ? 'date' : 'dates'} to fix</span>}
                        </td>
                        <td>
                          <Pick id={`ici-${r.key}-s`} label={`Status, ${r.month} ${r.year}`} value={r.status} options={(Object.keys(STATUS) as IntakeStatus[]).map((x) => ({ value: x, label: STATUS[x] }))} onChange={(s) => upd(r.key, { status: s as IntakeStatus })} />
                        </td>
                        {cell(r, 'apply', 'Application deadline')}
                        {cell(r, 'deposit', 'Deposit deadline')}
                        {cell(r, 'accept', 'Acceptance deadline')}
                        {cell(r, 'start', 'Batch start date')}
                        {cell(r, 'census', 'Census date')}
                        <td>
                          <button type="button" className="btn btn--link idanger" onClick={() => setRows((l) => l.filter((x) => x.key !== r.key))}>
                            Remove<span className="vh"> {r.month} {r.year}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="iempty">No intakes yet. A course needs at least one intake with an application deadline before it can be published.</p>
          )}
          <AddRow onClick={add}>Add an intake</AddRow>
          <SaveBar
            show
            note={!changed ? 'Nothing changed yet.' : undefined}
            error={tried ? error : null}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (error) return;
              save(
                (x) => ({
                  ...x,
                  intakes: rows.map((r) => ({ month: `${r.month} ${r.year}`, deadline: r.apply, status: r.status })),
                  dates: Object.fromEntries(rows.map((r) => [`${r.month} ${r.year}`, { deposit: r.deposit, accept: r.accept, start: r.start, census: r.census }])),
                }),
                'Intakes saved.',
              );
              setTried(false);
              ed.close();
            }}
          />
        </>
      )}
    </Section>
  );
}

const money2 = (s: string) => /^\d+(\.\d{1,2})?$/.test(s.trim());

/**
 * Fees (slice 2 PRD): currency from Admin's Currency exchange list (default the university country's, S2C-5); the
 * full course fee is the total tuition fee, with the fee a year under it; first-year fee required for Credits (S2C-5);
 * application fee (empty is free). No fee year (Jovial, S2C-6): fees are updated when the team updates them.
 */
function Fees({ c, save, edit }: { c: CourseRec; save: Save; edit: boolean }) {
  const currencies = useMemo(() => [...new Set([...adminCfg().rates.map((r) => r.code), c.currency])], [c.currency]);
  const first = () => ({ currency: c.currency || CURRENCY[c.uni.country as Destination], full: c.fullFee > 0 ? c.fullFee.toFixed(2) : '', firstYear: c.firstYearFee > 0 ? c.firstYearFee.toFixed(2) : '', appFee: c.appFee > 0 ? c.appFee.toFixed(2) : '' });
  const [v, setV] = useState(first);
  const [tried, setTried] = useState(false);
  const ed = useEditing();
  const set = (p: Partial<ReturnType<typeof first>>) => setV((x) => ({ ...x, ...p }));
  const changed = JSON.stringify(v) !== JSON.stringify(first());
  const credits = c.durUnit === 'Credits';
  const err = {
    full: !v.full.trim() ? 'Enter the full course fee.' : !money2(v.full) || !(Number(v.full) > 0) ? 'An amount above 0, with up to 2 decimals.' : null,
    firstYear: !v.firstYear.trim() ? (credits ? 'Enter the first-year fee.' : null) : !money2(v.firstYear) || !(Number(v.firstYear) > 0) ? 'An amount above 0, with up to 2 decimals.' : Number(v.firstYear) > Number(v.full) ? 'Not more than the full course fee.' : null,
    appFee: v.appFee.trim() && !money2(v.appFee) ? 'An amount with up to 2 decimals.' : null,
  };
  const bad = Object.values(err).some(Boolean);
  const cancel = () => (setV(first()), setTried(false), ed.close());
  const amount = (id: string, label: string, k: 'full' | 'firstYear' | 'appFee', required: boolean, hint?: ReactNode) => (
    <Field id={id} label={label} required={required} optional={!required} hint={hint} error={tried ? err[k] : null}>
      <NumberField id={id} decimal value={v[k]} invalid={tried && !!err[k]} onChange={(_t) => set({ [k]: _t.replace(/[^\d.]/g, '') })} />
    </Field>
  );
  const shown = (n: number) => (n > 0 ? money(n, c.currency) : null);
  const years = credits ? 1 : Math.max(1, c.months / 12);
  const perYear = credits ? c.firstYearFee : c.fullFee / years;
  return (
    <Section title="Fees" id="ic-fees" updated={c.stamps.fees} action={edit && !ed.editing ? <EditButton onClick={() => (setV(first()), ed.open())} what="fees" /> : undefined}>
      {!ed.editing ? (
        <>
          <Facts
            items={[
              ['Currency', c.currency],
              [
                'Full course fee',
                c.fullFee > 0 ? (
                  <span key="f">
                    {money(c.fullFee, c.currency)}
                    {perYear > 0 && <span className="ifacts__sub">{money(Math.round(perYear), c.currency)} a year</span>}
                  </span>
                ) : null,
              ],
              ['First-year fee', shown(c.firstYearFee)],
              ['Application fee', c.appFee > 0 ? money(c.appFee, c.currency) : 'Free'],
            ]}
          />
          <p className="irsec__note">Course search shows the full course fee as the total tuition fee, with the fee a year under it. The application’s final tuition fee starts from the full course fee.</p>
        </>
      ) : (
        <>
          <div className="iaddform__grid">
            <Field id="icf-cur" label="Currency" required hint="From Admin’s Currency exchange list.">
              <Pick id="icf-cur" label="Currency" value={v.currency} options={currencies} onChange={(currency) => set({ currency })} />
            </Field>
            {amount('icf-full', 'Full course fee', 'full', true, 'The tuition for the whole course.')}
            {amount('icf-first', 'First-year fee', 'firstYear', credits, credits ? 'Needed for a Credits course: it’s the fee a year in search.' : 'Not more than the full course fee.')}
            {amount('icf-app', 'Application fee', 'appFee', false, 'Empty means free.')}
          </div>
          <SaveBar
            show
            note={!changed ? 'Nothing changed yet.' : undefined}
            error={tried && bad ? 'Fix what’s marked, then save.' : null}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (bad) return;
              save((x) => ({ ...x, currency: v.currency, fullFee: Number(v.full), firstYearFee: Number(v.firstYear) || 0, appFee: Number(v.appFee) || 0 }), 'Fees saved.');
              setTried(false);
              ed.close();
            }}
          />
        </>
      )}
    </Section>
  );
}

const ukName = (n: number) => UK_CLASS[4 - n] ?? '';
const ukNum = (s: string) => 4 - (UK_CLASS as readonly string[]).indexOf(s);
/** The rows' errors (slice 2 PRD): the minimum on its scale; two rows with the same countries, qualification and board. */
function academicError(rows: AcademicRule[]) {
  for (const [i, r] of rows.entries()) {
    if (!(r.min > 0)) return `Row ${i + 1}: A number greater than 0.`;
    if (r.min > SCALE_MAX[r.scale]) return `Row ${i + 1}: Up to ${SCALE_MAX[r.scale]} on this scale.`;
    const k = JSON.stringify([[...r.countries].sort(), r.qual, r.qual === 'Grade 12' ? r.board.trim().toLowerCase() : '']);
    const j = rows.findIndex((x) => JSON.stringify([[...x.countries].sort(), x.qual, x.qual === 'Grade 12' ? x.board.trim().toLowerCase() : '']) === k);
    if (j < i) return `Row ${i + 1}: This row repeats row ${j + 1}.`;
  }
  return null;
}

/**
 * Academic eligibility (slice 2 PRD): Minimum highest education required at the top (one per course), with the
 * minimum score in it and its grading scale (Jovial, S2C-3: all three required to save this tab and to publish;
 * "Not set" until filled). Slice 3's eligibility compares the student's highest qualification with these. Then one
 * row per student country and qualification (Grade 12: one per board).
 */
function Academic({ c, save, edit }: { c: CourseRec; save: Save; edit: boolean }) {
  const [rows, setRows] = useState<AcademicRule[]>(c.academicRules);
  const minOf = () => ({ ed: c.minEducation ?? '', score: c.minScore !== undefined ? String(c.minScore) : '', scale: (c.minScoreScale ?? '') as Scale | '', backlogs: c.minBacklogs !== undefined && c.minBacklogs !== null ? String(c.minBacklogs) : '' });
  const [min, setMin] = useState(minOf);
  const setM = (p: Partial<ReturnType<typeof minOf>>) => setMin((x) => ({ ...x, ...p }));
  const [tried, setTried] = useState(false);
  const ed = useEditing();
  const changed = JSON.stringify(rows) !== JSON.stringify(c.academicRules) || JSON.stringify(min) !== JSON.stringify(minOf());
  const upd = (id: string, p: Partial<AcademicRule>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const n = Number(min.score);
  const minErr = !min.ed ? 'Pick the minimum highest education.' : null;
  const scaleErr = !min.scale ? 'Pick the grading scale of the minimum score.' : null;
  const scoreErr = !min.score.trim() ? 'Enter the minimum score in it.' : !(n > 0) ? 'A number greater than 0.' : min.scale && n > SCALE_MAX[min.scale] ? `Up to ${SCALE_MAX[min.scale]} on this scale.` : null;
  const error = minErr ?? scaleErr ?? scoreErr ?? academicError(rows);
  const open = () => (setRows(c.academicRules), setMin(minOf()), ed.open());
  const cancel = () => (setRows(c.academicRules), setMin(minOf()), setTried(false), ed.close());
  const minText = (r: AcademicRule) => (r.scale === 'UK class' ? ukName(r.min) : r.min);
  return (
    <Section
      title="Academic eligibility"
      id="ic-academic"
      updated={c.stamps.academic}
      note="Partners see the rows that list their student’s country and the rows with no countries. Backlogs allowed: empty means no limit, 0 means none."
      action={edit && !ed.editing ? <EditButton onClick={open} what="academic eligibility" /> : undefined}
    >
      {!ed.editing ? (
        <>
          <Facts
            items={[
              ['Minimum highest education required', c.minEducation || <span key="ns" className="muted">Not set</span>],
              ['Minimum score in it', c.minScore !== undefined && c.minScoreScale ? scoreText(c.minScore, c.minScoreScale) : <span key="ns2" className="muted">Not set</span>],
              ['Backlogs allowed in it', c.minBacklogs !== undefined && c.minBacklogs !== null ? String(c.minBacklogs) : 'No limit'],
            ]}
          />
          {c.academicRules.length ? (
            <div className="stab-wrap">
              <table className="itab itab--view">
                <thead>
                  <tr>
                    <th scope="col">Countries</th>
                    <th scope="col">Qualification</th>
                    <th scope="col">Board</th>
                    <th scope="col">Grading scale</th>
                    <th scope="col">Minimum</th>
                    <th scope="col">Backlogs allowed</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {c.academicRules.map((r) => (
                    <tr key={r.id}>
                      <td>{countriesText(r.countries)}</td>
                      <td>{r.qual}</td>
                      <td>{r.board || <Dash />}</td>
                      <td>{r.scale}</td>
                      <td className="num">{minText(r)}</td>
                      <td className="num">{r.backlogs === '' ? 'No limit' : r.backlogs}</td>
                      <td>{r.note || <Dash />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="iempty">No academic rows yet.</p>
          )}
        </>
      ) : (
        <>
          <div className="iaddform__grid">
            <Field id="ica-min" label="Minimum highest education required" required error={tried ? minErr : null} hint="One value for the course. Required to save this tab and to publish.">
              <Pick id="ica-min" label="Minimum highest education required" value={min.ed} placeholder="Pick one" invalid={tried && !!minErr} options={MIN_EDUCATION} onChange={(x) => setM({ ed: x })} />
            </Field>
            <Field id="ica-scale" label="Its grading scale" required error={tried ? scaleErr : null}>
              <Pick id="ica-scale" label="Grading scale of the minimum score" value={min.scale} placeholder="Pick a scale" invalid={tried && !!scaleErr} options={SCALES} onChange={(x) => setM({ scale: x as Scale, score: '' })} />
            </Field>
            <Field id="ica-score" label="Minimum score in it" required error={tried ? scoreErr : null} hint="The lowest score the course takes in that highest education.">
              {min.scale === 'UK class' ? (
                <Pick id="ica-score" label="Minimum score in it" value={min.score ? ukName(Number(min.score)) : ''} placeholder="Pick a class" invalid={tried && !!scoreErr} options={[...UK_CLASS]} onChange={(x) => setM({ score: String(ukNum(x)) })} />
              ) : (
                <NumberField id="ica-score" decimal min={0} max={min.scale ? SCALE_MAX[min.scale] : undefined} value={min.score} invalid={tried && !!scoreErr} onChange={(t) => setM({ score: t.replace(/[^\d.]/g, '') })} />
              )}
            </Field>
            <Field id="ica-backlogs" label="Backlogs allowed in it" optional hint="Empty means no limit; 0 means none.">
              <NumberField id="ica-backlogs" min={0} value={min.backlogs} placeholder="No limit" onChange={(t) => setM({ backlogs: t.replace(/\D/g, '') })} />
            </Field>
          </div>
          {rows.length ? (
            <div className="stab-wrap">
              <table className="itab itab--form">
                <thead>
                  <tr>
                    <th scope="col">Countries</th>
                    <th scope="col">
                      Qualification
                      <Req />
                    </th>
                    <th scope="col">Board (Grade 12)</th>
                    <th scope="col">
                      Grading scale
                      <Req />
                    </th>
                    <th scope="col">
                      Minimum
                      <Req />
                    </th>
                    <th scope="col">Backlogs allowed</th>
                    <th scope="col">Note</th>
                    <th scope="col">
                      <span className="vh">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, n) => (
                    <tr key={r.id}>
                      <td className="icell-wide">
                        <MultiPick id={`ica-${r.id}-c`} label={`Countries, row ${n + 1}`} value={r.countries} options={COUNTRY_LIST} onChange={(countries) => upd(r.id, { countries })} empty="All countries" all="All countries" search />
                      </td>
                      <td>
                        <Pick id={`ica-${r.id}-q`} label={`Qualification, row ${n + 1}`} value={r.qual} options={QUALIFICATIONS} onChange={(q) => upd(r.id, { qual: q as Qualification, board: q === 'Grade 12' ? r.board : '' })} />
                      </td>
                      <td>{r.qual === 'Grade 12' ? <input aria-label={`Board, row ${n + 1}`} className="icell" value={r.board} maxLength={120} onChange={(e) => upd(r.id, { board: e.target.value })} placeholder="Like: CBSE" /> : <Dash />}</td>
                      <td>
                        <Pick id={`ica-${r.id}-s`} label={`Grading scale, row ${n + 1}`} value={r.scale} options={SCALES} onChange={(s) => upd(r.id, { scale: s as Scale, min: 0 })} />
                      </td>
                      <td>
                        {r.scale === 'UK class' ? (
                          <Pick id={`ica-${r.id}-uk`} label={`Minimum, row ${n + 1}`} value={ukName(r.min)} placeholder="Pick a class" options={UK_CLASS} onChange={(x) => upd(r.id, { min: ukNum(x) })} />
                        ) : (
                          <input aria-label={`Minimum, row ${n + 1}`} inputMode="decimal" className={`icell icell--num ${tried && !(r.min > 0 && r.min <= SCALE_MAX[r.scale]) ? 'is-invalid' : ''}`} value={r.min || ''} onChange={(e) => upd(r.id, { min: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                        )}
                      </td>
                      <td>
                        <input aria-label={`Backlogs allowed, row ${n + 1}`} inputMode="numeric" className="icell icell--num" value={r.backlogs} placeholder="No limit" onChange={(e) => upd(r.id, { backlogs: e.target.value.replace(/\D/g, '') })} />
                      </td>
                      <td>
                        <input aria-label={`Note, row ${n + 1}`} className="icell" value={r.note} maxLength={120} onChange={(e) => upd(r.id, { note: e.target.value })} />
                      </td>
                      <td>
                        <button type="button" className="btn btn--link idanger" onClick={() => setRows((l) => l.filter((x) => x.id !== r.id))}>
                          Remove<span className="vh"> row {n + 1}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="iempty">No academic rows yet.</p>
          )}
          <AddRow onClick={() => setRows((l) => [...l, { id: newRuleId(), countries: [], qual: 'Applicable to all', board: '', scale: 'Percentage', min: 0, backlogs: '', note: '' }])}>Add a row</AddRow>
          <SaveBar
            show
            note={!changed ? 'Nothing changed yet.' : undefined}
            error={tried ? error : null}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (error) return;
              save((x) => ({ ...x, academicRules: rows, minEducation: min.ed, minScore: Number(min.score), minScoreScale: min.scale || undefined, minBacklogs: min.backlogs === '' ? undefined : Number(min.backlogs) }), 'Academic eligibility saved.');
              setTried(false);
              ed.close();
            }}
          />
        </>
      )}
    </Section>
  );
}

/** Each test's ranges (S2-19): overall, its section or band, and the step. */
const RANGE: Record<Test, { lo: number; hi: number; step: number; secHi: number; text: string }> = {
  'IELTS Academic': { lo: 0, hi: 9, step: 0.5, secHi: 9, text: '0 to 9, in steps of 0.5.' },
  'TOEFL iBT': { lo: 0, hi: 120, step: 1, secHi: 30, text: '0 to 120; sections 0 to 30.' },
  'PTE Academic': { lo: 10, hi: 90, step: 1, secHi: 90, text: '10 to 90.' },
  'Duolingo English Test': { lo: 10, hi: 160, step: 5, secHi: 160, text: '10 to 160, in steps of 5.' },
};
const onStep = (n: number, step: number) => Math.abs(n / step - Math.round(n / step)) < 1e-9;
function englishError(rows: EnglishRule[]) {
  for (const [i, r] of rows.entries()) {
    const g = RANGE[r.test];
    if (!(r.overall >= g.lo && r.overall <= g.hi && onStep(r.overall, g.step)) || r.overall === 0) return `Row ${i + 1}, ${r.test}: ${g.text}`;
    if (r.min && !(r.min >= g.lo && r.min <= g.secHi && onStep(r.min, g.step))) return `Row ${i + 1}, ${TEST_MIN[r.test]}: ${r.test === 'TOEFL iBT' ? '0 to 30.' : g.text}`;
    if (r.min > r.overall) return `Row ${i + 1}: ${TEST_MIN[r.test]} can’t be above Overall.`;
    const k = JSON.stringify([r.test, [...r.countries].sort()]);
    const j = rows.findIndex((x) => JSON.stringify([x.test, [...x.countries].sort()]) === k);
    if (j < i) return `Row ${i + 1}: This row repeats row ${j + 1}.`;
  }
  return null;
}

/** English (slice 2 PRD): one row per test and set of student countries; a country's row overrides the all-countries row. */
function English({ c, save, edit }: { c: CourseRec; save: Save; edit: boolean }) {
  const [rows, setRows] = useState<EnglishRule[]>(c.englishRules);
  const [tried, setTried] = useState(false);
  const ed = useEditing();
  const changed = JSON.stringify(rows) !== JSON.stringify(c.englishRules);
  const upd = (id: string, p: Partial<EnglishRule>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const error = englishError(rows);
  const cancel = () => (setRows(c.englishRules), setTried(false), ed.close());
  return (
    <Section
      title="English"
      id="ic-english"
      updated={c.stamps.english}
      note="For a student from a country, the course uses the test’s row that lists the country; if none, the row with no countries; if neither, it states nothing for that test."
      action={edit && !ed.editing ? <EditButton onClick={() => (setRows(c.englishRules), ed.open())} what="English rows" /> : undefined}
    >
      {!ed.editing ? (
        c.englishRules.length ? (
          <div className="stab-wrap">
            <table className="itab itab--view">
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Countries</th>
                  <th scope="col">Overall</th>
                  <th scope="col">Lowest band or section</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {c.englishRules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.test}</td>
                    <td>{countriesText(r.countries)}</td>
                    <td className="num">{r.overall}</td>
                    <td>{r.min > 0 ? <span className="num">{TEST_MIN[r.test]} {r.min}</span> : <Dash />}</td>
                    <td>{r.note || <Dash />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="iempty">No English rows yet.</p>
        )
      ) : (
        <>
          {rows.length ? (
            <div className="stab-wrap">
              <table className="itab itab--form">
                <thead>
                  <tr>
                    <th scope="col">
                      Test
                      <Req />
                    </th>
                    <th scope="col">Countries</th>
                    <th scope="col">
                      Overall
                      <Req />
                    </th>
                    <th scope="col">Lowest band or section</th>
                    <th scope="col">Note</th>
                    <th scope="col">
                      <span className="vh">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, n) => (
                    <tr key={r.id}>
                      <td>
                        <Pick id={`ice-${r.id}-t`} label={`Test, row ${n + 1}`} value={r.test} options={TESTS} onChange={(t) => upd(r.id, { test: t as Test })} />
                      </td>
                      <td className="icell-wide">
                        <MultiPick id={`ice-${r.id}-c`} label={`Countries, row ${n + 1}`} value={r.countries} options={COUNTRY_LIST} onChange={(countries) => upd(r.id, { countries })} empty="All countries" all="All countries" search />
                      </td>
                      <td>
                        <input aria-label={`Overall, row ${n + 1}`} title={RANGE[r.test].text} inputMode="decimal" className="icell icell--num" value={r.overall || ''} onChange={(e) => upd(r.id, { overall: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                      </td>
                      <td>
                        <input aria-label={`${TEST_MIN[r.test]}, row ${n + 1}`} title={TEST_MIN[r.test]} placeholder={TEST_MIN[r.test]} inputMode="decimal" className="icell icell--num" value={r.min || ''} onChange={(e) => upd(r.id, { min: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                      </td>
                      <td>
                        <input aria-label={`Note, row ${n + 1}`} className="icell" value={r.note} maxLength={120} onChange={(e) => upd(r.id, { note: e.target.value })} />
                      </td>
                      <td>
                        <button type="button" className="btn btn--link idanger" onClick={() => setRows((l) => l.filter((x) => x.id !== r.id))}>
                          Remove<span className="vh"> row {n + 1}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="iempty">No English rows yet.</p>
          )}
          <AddRow onClick={() => setRows((l) => [...l, { id: newRuleId(), countries: [], test: 'IELTS Academic', overall: 0, min: 0, note: '' }])}>Add a row</AddRow>
          <SaveBar
            show
            note={!changed ? 'Nothing changed yet.' : undefined}
            error={tried ? error : null}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (error) return;
              save((x) => ({ ...x, englishRules: rows }), 'English saved.');
              setTried(false);
              ed.close();
            }}
          />
        </>
      )}
      {tried && error && <ErrorText>{error}</ErrorText>}
    </Section>
  );
}
