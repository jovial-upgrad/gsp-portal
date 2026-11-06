import { useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { EditOnly, ViewOnlyProvider, useShows, useViewOnly } from '../../proto/viewOnly';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { AREAS, LEVELS, type Area, type IntakeStatus, type Level, type StudyMode } from '../../data/courses';
import { COUNTRIES, TOP_MARKETS } from '../../data/partners';
import { UniMark, campusLabel } from '../courses/parts';
import { CURRENCIES, DURATION_UNITS, MIN_EDUCATION, QUALIFICATIONS, SCALES, SOURCES, TAGS, TESTS, TEST_MIN, courseUpdated, newRuleId, withSearchFields, type AcademicRule, type CourseRec, type DurationUnit, type EnglishRule, type IntakeDates, type MinEducation, type Qualification, type Scale, type Source, type Test, type UniRec } from '../data/catalogue';
import { checkedAt, dateText, isoOf, logLine, stampBy } from '../data/records';
import { patch } from '../data/store';
import { Facts, Logs, RecordHead, RecordTabs, Section, SystemInfo, TabPanel, toggle, useAsk } from './parts';
import { CoursePill } from './pills';
import { money } from '../../data/courses';
import { MultiPick } from './MultiPick';
import { missingOf } from './CourseForm';
import type { PageProps } from '../portal/model';

type Tab = 'basics' | 'intakes' | 'fees' | 'academic' | 'english' | 'logs';
const TABS: Tab[] = ['basics', 'intakes', 'fees', 'academic', 'english', 'logs'];
/** Each part of a course as its Logs tab names it. */
const PARTS: Record<string, string> = { status: 'Status', basics: 'Basics', intakes: 'Intakes', fees: 'Fees', academic: 'Academic', english: 'English' };
const CHANGED: Record<string, string> = { basics: 'Changed the basics', intakes: 'Changed the intakes', fees: 'Changed the fees', academic: 'Changed the academic entry and rules', english: 'Changed the English rules' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() + i));
const STATUS: Record<IntakeStatus, string> = { open: 'Open', likely: 'Likely', closed: 'Closed' };
const COUNTRY_LIST = [...TOP_MARKETS, ...COUNTRIES.map((c) => c.name).filter((n) => !TOP_MARKETS.includes(n))];

/**
 * A course's page (29 Oct, 6th round), as the PM prototype's course record: its status and what moves it (Publish or
 * Delete a draft, Hide or Show), then five tabs to fill in and save: Basics, Intakes, Fees, Academic and English.
 * No other fields, no preview, no log, nothing filled in for the team. 29 Oct (7th round): Basics has the university;
 * no post-study work tick; the tables' dropdowns have the portal's own arrow; each tab and the status say who last
 * changed them, and when. 3 Nov: Basics shows what's saved, read-only (with its CRICOS code, last checked and
 * source), and is changed only after Edit; System information under it; a Logs tab lists every change. 4 Nov: the
 * course page is needed; an intake's deposit deadline is optional; Academic has the course's own entry above its
 * rules; removing a saved row asks first; no lines under the tabs' titles.
 */
export function CoursePage({ c, tab: start, backLabel, onBack, set, say, db, open, me }: PageProps & { c: CourseRec; tab?: string; backLabel: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>(TABS.includes(start as Tab) ? (start as Tab) : 'basics');
  // GSP · Global Ops (6 Nov): the course to look at, with its Academic and English rules to change
  const viewOnly = useViewOnly();
  const editAcademic = useShows('course.academic');
  const editEnglish = useShows('course.english');
  const [deleting, setDeleting] = useState(false);
  const u = db.unis.find((x) => x.id === c.uni.id);
  /** Saves a tab (or the status), says who changed it and when, and adds its line to the Logs tab. */
  const save = (fn: (x: CourseRec) => CourseRec, what: string, part: string = tab, log?: string) => {
    set((d) => ({ ...d, courses: patch(d.courses, c.id, (x) => withSearchFields({ ...fn(x), stamps: { ...x.stamps, [part]: stampBy(me) }, log: [logLine(me, part, log ?? CHANGED[part] ?? what), ...x.log] })) }));
    say(what);
  };
  const missing = missingOf(c);

  const act =
    c.status === 'Draft' ? (
      <>
        <EditOnly>
          <Button variant="secondary" size="sm" onClick={() => setDeleting(true)}>
            Delete draft
          </Button>
        </EditOnly>
        <EditOnly>
          <Button size="sm" disabled={missing.length > 0} onClick={() => save((x) => ({ ...x, status: 'Live' }), `${c.name} published.`, 'status', 'Published: Draft → Live')}>
            Publish
          </Button>
        </EditOnly>
      </>
    ) : c.status === 'Hidden' ? (
      <EditOnly>
        <Button size="sm" variant="secondary" onClick={() => save((x) => ({ ...x, status: 'Live' }), `${c.name} is back in Course search.`, 'status', 'Shown again: Hidden → Live')}>
          Show again
        </Button>
      </EditOnly>
    ) : (
      <EditOnly>
        <Button size="sm" variant="secondary" onClick={() => save((x) => ({ ...x, status: 'Hidden' }), `${c.name} is hidden from Course search.`, 'status', 'Hidden: Live → Hidden')}>
          Hide
        </Button>
      </EditOnly>
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
            · {campusLabel(c.campus)} · {c.code ? <span className="num">{c.code}</span> : 'no code yet'}
          </>
        }
        status={<CoursePill s={c.status} />}
        updated={c.stamps.status}
      >
        <div className="istatus">
          <p className="istatus__note">
            {c.status === 'Draft'
              ? missing.length
                ? `A draft. To publish it, add its ${missing.join(', ')}.`
                : 'A draft: not in Course search until it’s published.'
              : c.status === 'Hidden'
                ? 'Hidden: not in Course search. Applications already made carry on.'
                : u && u.status !== 'Live'
                  ? `Live, and in Course search once ${u.name} goes live.`
                  : 'Live: in Course search.'}
          </p>
          <div className="istatus__acts">{act}</div>
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
          { key: 'academic', label: 'Academic' },
          { key: 'english', label: 'English', n: c.englishRules.length },
          { key: 'logs', label: 'Logs', n: c.log.length + 1 },
        ]}
      />

      <TabPanel id="ictab" tab={tab}>
        {tab === 'basics' && (
          <>
            <Basics key={c.id} c={c} unis={db.unis} courses={db.courses} save={save} />
            <SystemInfo id="ic-system" created={c.created} last={courseUpdated(c)} />
          </>
        )}
        {tab === 'intakes' && <Intakes key={c.id} c={c} save={save} />}
        {tab === 'fees' && <Fees key={c.id} c={c} save={save} />}
        {tab === 'academic' && (
          <ViewOnlyProvider on={viewOnly && !editAcademic}>
            <Academic key={c.id} c={c} save={save} />
          </ViewOnlyProvider>
        )}
        {tab === 'english' && (
          <ViewOnlyProvider on={viewOnly && !editEnglish}>
            <English key={c.id} c={c} save={save} />
          </ViewOnlyProvider>
        )}
        {tab === 'logs' && <Logs id="ic-logs" lines={c.log} created={c.created} added={c.source === 'CSV upload' ? 'Added as a draft from a CSV upload' : 'Added the course'} parts={PARTS} />}
      </TabPanel>

      <ConfirmDialog
        open={deleting}
        title={`Delete ${c.name}?`}
        confirm="Delete draft"
        onConfirm={() => {
          setDeleting(false);
          set((d) => ({ ...d, courses: d.courses.filter((x) => x.id !== c.id) }));
          say(`${c.name} deleted.`);
          onBack();
        }}
        onCancel={() => setDeleting(false)}
      >
        <p>The draft and everything entered on it go. It was never in Course search.</p>
      </ConfirmDialog>
    </div>
  );
}

type Save = (fn: (x: CourseRec) => CourseRec, what: string, part?: string, log?: string) => void;

/** A dropdown in a table row, with the portal's own arrow (29 Oct, 7th round): the browser's looked broken beside the rest. */
const CellSelect = ({ className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <SelectInput {...p} wrapClass="icell-sel" btnClass={`icell icell-btn ${className}`} minListWidth={160}>
    {children}
  </SelectInput>
);

/** Unsaved changes on a tab: Discard (or Cancel, when editing what was saved) or Save. */
function SaveBar({ show, onDiscard, onSave, error, cancel = false, note }: { show: boolean; onDiscard: () => void; onSave: () => void; error?: string | null; cancel?: boolean; note?: string }) {
  if (!show) return null;
  return (
    <div className="isave" role="region" aria-label="Unsaved changes">
      <p className="isave__t">{error ?? note ?? 'Not saved yet.'}</p>
      <Button variant="secondary" size="sm" onClick={onDiscard}>
        {cancel ? 'Cancel' : 'Discard'}
      </Button>
      <EditOnly>
        <Button size="sm" onClick={onSave}>
          Save changes
        </Button>
      </EditOnly>
    </div>
  );
}

/**
 * Intakes, Fees, Academic and English (30 Oct): once something is saved the tab shows it, with an Edit button; Edit
 * opens the form, and Save or Cancel closes it. A tab with nothing in it yet opens on the form.
 */
function useEditing(filled: boolean) {
  const [editing, setEditing] = useState(!filled);
  return { editing: editing || !filled, open: () => setEditing(true), close: () => setEditing(false) };
}
const EditButton = ({ onClick, what }: { onClick: () => void; what: string }) => (
  <EditOnly>
    <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={onClick}>
      Edit<span className="vh"> {what}</span>
    </Button>
  </EditOnly>
);
const Req = () => (
  <span className="field__req" aria-hidden="true">
    {' '}*
  </span>
);
const Dash = () => <span className="muted">—</span>;
const countriesText = (l: string[]) => (l.length ? l.join(', ') : 'All countries');

const num = (s: string) => (s.trim() === '' ? 0 : Number(s));
const str = (n: number) => (n > 0 ? String(n) : '');

/** "12 months (1 year)", "2 years", "120 credits". */
export function durationText(c: Pick<CourseRec, 'durUnit' | 'durValue'>) {
  const v = c.durValue;
  if (!v) return '';
  if (c.durUnit === 'Months') return `${v} ${v === 1 ? 'month' : 'months'}${v >= 12 && v % 12 === 0 ? ` (${v / 12} ${v === 12 ? 'year' : 'years'})` : ''}`;
  const unit = c.durUnit.toLowerCase();
  return `${v} ${v === 1 ? unit.replace(/s$/, '') : unit}`;
}
/** The course's last check against the university's page, as "2026-10-31" ('' when never). */
const checkedIso = (d: string) => (d ? isoOf(new Date(checkedAt(d))) : '');
/** Kept as the records keep it: "31 Oct 2026". */
const checkedOf = (iso: string) => (iso ? dateText(iso) : '');

const BASICS: [keyof ReturnType<typeof basicsOf>, string][] = [
  ['code', 'Course code'],
  ['cricos', 'CRICOS course code'],
  ['name', 'Course name'],
  ['uni', 'University'],
  ['campus', 'Campus'],
  ['level', 'Program level'],
  ['area', 'Study area'],
  ['mode', 'Study mode'],
  ['durUnit', 'Duration or credits'],
  ['durValue', 'Duration'],
  ['url', 'Course page'],
  ['checked', 'Last checked'],
  ['source', 'Source'],
  ['tags', 'Tags'],
];
const basicsOf = (c: CourseRec) => ({ code: c.code, cricos: c.cricos ?? '', name: c.name, uni: c.uni.id, campus: c.campus.name, level: c.level, area: c.area, mode: c.mode, durUnit: c.durUnit, durValue: str(c.durValue), url: c.url, checked: checkedIso(c.checked), source: c.source, tags: c.tags });

/**
 * Basics (3 Nov): what's saved, read-only, as Nesil's reference shows it: code, CRICOS course code (Australia), name,
 * university, campus, program level, study area, study mode, duration, course page, last checked, source and tags.
 * Edit opens the form; Save or Cancel closes it.
 */
function Basics({ c, unis, courses, save }: { c: CourseRec; unis: UniRec[]; courses: CourseRec[]; save: Save }) {
  const first = () => basicsOf(c);
  const [v, setV] = useState(first);
  const [tried, setTried] = useState(false);
  const [editing, setEditing] = useState(false);
  const set = (p: Partial<ReturnType<typeof first>>) => setV((x) => ({ ...x, ...p }));
  const changed = JSON.stringify(v) !== JSON.stringify(first());
  const u = unis.find((x) => x.id === v.uni);
  const aus = (u?.country ?? c.uni.country) === 'Australia';
  // the university's active campuses, and the one it's at now
  const campusesOf = (x?: UniRec) => (x?.campuses ?? []).filter((k) => !x?.inactive.includes(k.name) || (x.id === c.uni.id && k.name === c.campus.name));
  const campuses = u ? campusesOf(u) : [c.campus];
  const same = (x: CourseRec) => x.id !== c.id && x.uni.id === v.uni && x.campus.name === v.campus;
  const err = {
    name: !v.name.trim() ? 'Enter the course’s name.' : courses.some((x) => same(x) && x.name.toLowerCase() === v.name.trim().toLowerCase()) ? 'That course is already here, at that campus.' : null,
    code: v.code.trim() && courses.some((x) => same(x) && x.code.toLowerCase() === v.code.trim().toLowerCase()) ? 'Another course at this campus has that code.' : null,
    campus: !campuses.some((k) => k.name === v.campus) ? 'Pick a campus. This university has no active campus yet.' : null,
    durValue: !v.durValue ? 'Enter the duration.' : !(Number(v.durValue) > 0 && Number(v.durValue) <= 500) ? 'A number, like 24.' : null,
    checked: v.checked && v.checked > isoOf(new Date()) ? 'It can’t be later than today.' : null,
    // 4 Nov: the course page is needed
    url: !v.url.trim() ? 'Enter the course’s page on the university website.' : !/^https?:\/\/\S+\.\S+/i.test(v.url.trim()) ? 'Enter the whole link, starting with https://' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const cancel = () => (setV(first()), setTried(false), setEditing(false));
  const shown = (k: keyof ReturnType<typeof first>, x: ReturnType<typeof first>) =>
    k === 'uni' ? unis.find((y) => y.id === x.uni)?.name ?? x.uni : k === 'tags' ? x.tags.join(', ') || 'none' : k === 'checked' ? checkedOf(x.checked) || 'never' : String(x[k] || 'empty');

  if (!editing)
    return (
      <Section title="Basics" id="ic-basics" updated={c.stamps.basics} action={<EditButton onClick={() => (setV(first()), setEditing(true))} what="basics" />}>
        <Facts
          items={[
            ['Course code', c.code ? <span key="cd" className="num">{c.code}</span> : null],
            ...(c.uni.country === 'Australia' ? ([['CRICOS course code', c.cricos ? <span key="cr" className="num">{c.cricos}</span> : null]] as [string, ReactNode][]) : []),
            ['Course name', c.name],
            ['University', c.uni.name],
            ['Campus', campusLabel(c.campus)],
            ['Program level', c.level],
            ['Study area', c.area],
            ['Study mode', c.mode],
            ['Duration', durationText(c) || null],
            [
              'Course page',
              c.url ? (
                <a key="url" href={c.url} target="_blank" rel="noreferrer">
                  {c.url}
                </a>
              ) : null,
            ],
            ['Last checked', c.checked ? <span key="lc" className="num">{checkedOf(checkedIso(c.checked))}</span> : null],
            ['Source', c.source],
            ['Tags', c.tags.length ? c.tags.join(', ') : 'None', 'wide'],
          ]}
        />
      </Section>
    );

  return (
    <Section title="Basics" id="ic-basics" updated={c.stamps.basics}>
      <div className="iaddform__grid">
        <Field id="icb-code" label="Course code" optional error={show('code')}>
          <TextInput id="icb-code" value={v.code} invalid={!!show('code')} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="Like: MBA-HAT-01" />
        </Field>
        {aus && (
          <Field id="icb-cricos" label="CRICOS course code" optional>
            <TextInput id="icb-cricos" value={v.cricos} onChange={(e) => set({ cricos: e.target.value.toUpperCase() })} placeholder="Like: 045884A" />
          </Field>
        )}
        <Field id="icb-name" label="Course name" required error={show('name')}>
          <TextInput id="icb-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="icb-uni" label="University" required>
          <SelectInput
            id="icb-uni"
            value={v.uni}
            onChange={(e) => {
              const to = unis.find((x) => x.id === e.target.value);
              set({ uni: e.target.value, campus: to?.id === c.uni.id ? c.campus.name : campusesOf(to)[0]?.name ?? '' });
            }}
          >
            {[...unis]
              .filter((x) => x.status !== 'Ended' || x.id === c.uni.id)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </SelectInput>
        </Field>
        <Field id="icb-campus" label="Campus" required error={show('campus')}>
          <SelectInput id="icb-campus" value={v.campus} placeholder="No active campus" allowEmpty={!campuses.length} invalid={!!show('campus')} onChange={(e) => set({ campus: e.target.value })}>
            {campuses.map((x) => (
              <option key={x.name} value={x.name}>
                {campusLabel(x)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="icb-level" label="Program level" required>
          <SelectInput id="icb-level" value={v.level} onChange={(e) => set({ level: e.target.value as Level })}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="icb-area" label="Study area" required>
          <SelectInput id="icb-area" value={v.area} onChange={(e) => set({ area: e.target.value as Area })}>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="icb-mode" label="Study mode" required>
          <SelectInput id="icb-mode" value={v.mode} onChange={(e) => set({ mode: e.target.value as StudyMode })}>
            {(['Full time', 'Part time', 'Online', 'Blended'] as StudyMode[]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="icb-unit" label="Duration or credits" required>
          <SelectInput id="icb-unit" value={v.durUnit} onChange={(e) => set({ durUnit: e.target.value as DurationUnit })}>
            {DURATION_UNITS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="icb-dur" label={`Duration (${v.durUnit.toLowerCase()})`} required error={show('durValue')}>
          <TextInput id="icb-dur" inputMode="numeric" value={v.durValue} invalid={!!show('durValue')} onChange={(e) => set({ durValue: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Like: 24" />
        </Field>
        <Field id="icb-checked" label="Last checked" optional error={show('checked')}>
          <TextInput id="icb-checked" type="date" value={v.checked} max={isoOf(new Date())} invalid={!!show('checked')} onChange={(e) => set({ checked: e.target.value })} />
        </Field>
        <Field id="icb-source" label="Source" required>
          <SelectInput id="icb-source" value={v.source} onChange={(e) => set({ source: e.target.value as Source })}>
            {SOURCES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="icb-url" label="Course page on the university website" required error={show('url')} className="iform__wide">
          <TextInput id="icb-url" type="url" value={v.url} invalid={!!show('url')} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
        </Field>
      </div>
      <div className="iblock itagblock">
        <h3 className="iblock__title">Tags</h3>
        <div className="ichecks__list itaglist">
          {TAGS.map((t) => (
            <button key={t} type="button" className="ichip" aria-pressed={v.tags.includes(t)} onClick={() => set({ tags: toggle(v.tags, t) })}>
              {v.tags.includes(t) && <Icon name="check" size={14} />}
              {t}
            </button>
          ))}
        </div>
      </div>
      <SaveBar
        show
        cancel
        onDiscard={cancel}
        note={!changed ? 'Nothing changed yet.' : undefined}
        onSave={() => {
          setTried(true);
          if (Object.values(err).some(Boolean)) return;
          if (!changed) return cancel();
          const campus = campuses.find((x) => x.name === v.campus) ?? c.campus;
          const was = first();
          const log = BASICS.filter(([k]) => JSON.stringify(was[k]) !== JSON.stringify(v[k]))
            .map(([k, label]) => (k === 'tags' || k === 'url' ? `${label} changed` : `${label} ${shown(k, was)} → ${shown(k, v)}`))
            .join('; ');
          save(
            (x) => ({ ...x, code: v.code.trim(), cricos: aus ? v.cricos.trim() || undefined : x.cricos, name: v.name.trim(), uni: u ?? x.uni, campus, level: v.level, area: v.area, mode: v.mode, durUnit: v.durUnit, durValue: num(v.durValue), url: v.url.trim(), checked: v.checked ? checkedOf(v.checked) : '', source: v.source, tags: v.tags }),
            'Basics saved.',
            'basics',
            log,
          );
          setEditing(false);
          setTried(false);
        }}
        error={tried && Object.values(err).some(Boolean) ? 'Fix what’s marked, then save.' : null}
      />
    </Section>
  );
}

type IntakeRow = { key: string; month: string; year: string; status: IntakeStatus } & IntakeDates & { apply: string };

function Intakes({ c, save }: { c: CourseRec; save: Save }) {
  const first = (): IntakeRow[] =>
    c.intakes.map((i, n) => {
      const [m, y] = i.month.split(' ');
      const d = c.dates[i.month] ?? { deposit: '', accept: '', start: '', census: '' };
      return { key: `i${n}`, month: m, year: y, status: i.status, apply: i.deadline, ...d };
    });
  const [rows, setRows] = useState(first);
  const [tried, setTried] = useState(false);
  const ed = useEditing(c.intakes.length > 0);
  const filled = c.intakes.length > 0;
  const changed = JSON.stringify(rows) !== JSON.stringify(first());
  const upd = (key: string, p: Partial<IntakeRow>) => setRows((l) => l.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const names = rows.map((r) => `${r.month} ${r.year}`);
  // 4 Nov: the deposit deadline is optional
  const error = rows.some((r) => !r.apply) ? 'Each intake needs its application deadline.' : new Set(names).size !== names.length ? 'Each intake once only.' : null;
  const cancel = () => (setRows(first()), setTried(false), ed.close());
  const { ask, dialog } = useAsk();
  const saved = new Set(first().map((r) => r.key));
  /** Takes out a row; one that's saved asks first (4 Nov). */
  const removeRow = (r: IntakeRow) => {
    const go = () => setRows((l) => l.filter((x) => x.key !== r.key));
    if (!saved.has(r.key)) return go();
    ask(`Remove the ${r.month} ${r.year} intake?`, 'Remove', <p>It goes when you save. Applications already made for it carry on.</p>, go);
  };
  const cell = (r: IntakeRow, k: 'apply' | 'deposit' | 'accept' | 'start' | 'census', label: string, need = false) => (
    <td>
      <label className="vh" htmlFor={`ici-${r.key}-${k}`}>
        {label}, {r.month} {r.year}
      </label>
      <input id={`ici-${r.key}-${k}`} type="date" className={`icell ${tried && need && !r[k] ? 'is-invalid' : ''}`} value={r[k]} onChange={(e) => upd(r.key, { [k]: e.target.value })} />
    </td>
  );
  const day = (v: string) => (v ? dateText(v) : <Dash />);
  return (
    <Section
      title="Intakes"
      id="ic-intakes"
      updated={c.stamps.intakes}
      action={!ed.editing ? <EditButton onClick={ed.open} what="intakes" /> : undefined}
    >
      {dialog}
      {!ed.editing ? (
        <div className="stab-wrap">
          <table className="itab itab--view">
            <thead>
              <tr>
                <th scope="col">Intake</th>
                <th scope="col">Status</th>
                <th scope="col">Application deadline</th>
                <th scope="col">Deposit deadline</th>
                <th scope="col">Acceptance deadline (CoE, CAS or I-20)</th>
                <th scope="col">Batch start date</th>
                <th scope="col">Census date</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                    <th scope="col">Deposit deadline</th>
                    <th scope="col">Acceptance deadline (CoE, CAS or I-20)</th>
                    <th scope="col">Batch start date</th>
                    <th scope="col">Census date</th>
                    <th scope="col">
                      <span className="vh">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <span className="icell-pair">
                          <CellSelect aria-label="Month" value={r.month} onChange={(e) => upd(r.key, { month: e.target.value })}>
                            {MONTHS.map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </CellSelect>
                          <CellSelect aria-label="Year" value={r.year} onChange={(e) => upd(r.key, { year: e.target.value })}>
                            {[...new Set([...YEARS, r.year])].map((y) => (
                              <option key={y}>{y}</option>
                            ))}
                          </CellSelect>
                        </span>
                      </td>
                      <td>
                        <CellSelect aria-label="Status" value={r.status} onChange={(e) => upd(r.key, { status: e.target.value as IntakeStatus })}>
                          {(Object.keys(STATUS) as IntakeStatus[]).map((x) => (
                            <option key={x} value={x}>
                              {STATUS[x]}
                            </option>
                          ))}
                        </CellSelect>
                      </td>
                      {cell(r, 'apply', 'Application deadline', true)}
                      {cell(r, 'deposit', 'Deposit deadline')}
                      {cell(r, 'accept', 'Acceptance deadline')}
                      {cell(r, 'start', 'Batch start date')}
                      {cell(r, 'census', 'Census date')}
                      <td>
                        <EditOnly>
                          <button type="button" className="btn btn--link idanger" onClick={() => removeRow(r)}>
                            Remove<span className="vh"> {r.month} {r.year}</span>
                          </button>
                        </EditOnly>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="iempty">No intakes yet.</p>
          )}
          <AddRow onClick={() => setRows((l) => [...l, { key: `n${Date.now().toString(36)}`, month: MONTHS[(new Date().getMonth() + 3) % 12], year: YEARS[1], status: 'open', apply: '', deposit: '', accept: '', start: '', census: '' }])}>Add intake</AddRow>
          <SaveBar
            show={filled || changed}
            cancel={filled}
            note={filled && !changed ? 'Nothing changed yet.' : undefined}
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

/** Fees (30 Oct): the full course fee (it was tuition a year; Course search works out the yearly figure), and optional first-year and application fees. */
function Fees({ c, save }: { c: CourseRec; save: Save }) {
  const first = () => ({ currency: c.currency, full: str(c.fullFee), firstYear: str(c.firstYearFee), appFee: str(c.appFee) });
  const [v, setV] = useState(first);
  const [tried, setTried] = useState(false);
  const filled = c.fullFee > 0;
  const ed = useEditing(filled);
  const set = (p: Partial<ReturnType<typeof first>>) => setV((x) => ({ ...x, ...p }));
  const changed = JSON.stringify(v) !== JSON.stringify(first());
  const err = { full: !(num(v.full) > 0) ? 'Enter the full course fee.' : null };
  const cancel = () => (setV(first()), setTried(false), ed.close());
  const amount = (id: string, label: string, k: 'full' | 'firstYear' | 'appFee', required: boolean, hint?: ReactNode) => (
    <Field id={id} label={label} required={required} optional={!required} hint={hint} error={k === 'full' && tried ? err.full : null}>
      <TextInput id={id} inputMode="numeric" value={v[k]} invalid={k === 'full' && tried && !!err.full} onChange={(e) => set({ [k]: e.target.value.replace(/\D/g, '') })} />
    </Field>
  );
  const shown = (n: number) => (n > 0 ? money(n, c.currency) : null);
  return (
    <Section title="Fees" id="ic-fees" updated={c.stamps.fees} action={!ed.editing ? <EditButton onClick={ed.open} what="fees" /> : undefined}>
      {!ed.editing ? (
        <Facts
          items={[
            ['Currency', c.currency],
            ['Full course fee', shown(c.fullFee)],
            ['First-year fee', shown(c.firstYearFee)],
            ['Application fee', shown(c.appFee)],
          ]}
        />
      ) : (
        <>
          <div className="iaddform__grid">
            <Field id="icf-cur" label="Currency" required>
              <SelectInput id="icf-cur" value={v.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </SelectInput>
            </Field>
            {amount('icf-full', 'Full course fee', 'full', true)}
            {amount('icf-first', 'First-year fee', 'firstYear', false)}
            {amount('icf-app', 'Application fee', 'appFee', false)}
          </div>
          <SaveBar
            show={filled || changed}
            cancel={filled}
            note={filled && !changed ? 'Nothing changed yet.' : undefined}
            error={tried && err.full ? 'Fix what’s marked, then save.' : null}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (err.full) return;
              save((x) => ({ ...x, currency: v.currency, fullFee: num(v.full), firstYearFee: num(v.firstYear), appFee: num(v.appFee) }), 'Fees saved.');
              setTried(false);
              ed.close();
            }}
          />
        </>
      )}
    </Section>
  );
}

/**
 * Academic (4 Nov, as in Nesil's reference): the course's own entry first, four fields (the least education a
 * student needs, its grading scale, the minimum in it, and the backlogs it allows), then the rules for particular
 * countries or qualifications, Add a row, and Cancel or Save. Read-only until Edit, as the other tabs.
 */
function Academic({ c, save }: { c: CourseRec; save: Save }) {
  const first = () => ({ edu: c.entry.edu, scale: c.entry.scale, min: str(c.entry.min), backlogs: c.entry.backlogs });
  const [e, setE] = useState(first);
  const [rows, setRows] = useState<AcademicRule[]>(c.academicRules);
  const [tried, setTried] = useState(false);
  const filled = !!c.entry.edu || c.academicRules.length > 0;
  const ed = useEditing(filled);
  const { ask, dialog } = useAsk();
  const changed = JSON.stringify(e) !== JSON.stringify(first()) || JSON.stringify(rows) !== JSON.stringify(c.academicRules);
  const setEntry = (p: Partial<ReturnType<typeof first>>) => setE((x) => ({ ...x, ...p }));
  const upd = (id: string, p: Partial<AcademicRule>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const err = {
    edu: !e.edu ? 'Pick the minimum education.' : null,
    scale: !e.scale ? 'Pick its grading scale.' : null,
    min: !(num(e.min) > 0) ? 'Enter the minimum score.' : null,
  };
  const error = Object.values(err).some(Boolean) || rows.some((r) => !(r.min > 0)) ? 'Fix what’s marked, then save.' : null;
  const cancel = () => (setE(first()), setRows(c.academicRules), setTried(false), ed.close());
  const removeRow = (r: AcademicRule, n: number) => {
    const go = () => setRows((l) => l.filter((x) => x.id !== r.id));
    if (!c.academicRules.some((x) => x.id === r.id)) return go();
    ask(`Remove rule ${n + 1}?`, 'Remove', <p>{countriesText(r.countries)}, {r.qual}: it goes when you save.</p>, go);
  };
  return (
    <Section title="Academic" id="ic-academic" updated={c.stamps.academic} action={!ed.editing ? <EditButton onClick={ed.open} what="academic" /> : undefined}>
      {dialog}
      {!ed.editing ? (
        <>
          <Facts
            items={[
              ['Minimum highest education required', c.entry.edu || null],
              ['Its grading scale', c.entry.scale || null],
              ['Minimum score in it', c.entry.min > 0 ? <span key="m" className="num">{c.entry.min}</span> : null],
              ['Backlogs allowed in it', c.entry.backlogs === '' ? 'No limit' : <span key="b" className="num">{c.entry.backlogs}</span>],
            ]}
          />
          <div className="iblock iacrules">
            <h3 className="iblock__title">Rules</h3>
            {c.academicRules.length ? (
              <div className="stab-wrap">
                <table className="itab itab--view">
                  <thead>
                    <tr>
                      <th scope="col">Countries</th>
                      <th scope="col">Qualification</th>
                      <th scope="col">Board (Grade 12)</th>
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
                        <td className="num">{r.min}</td>
                        <td className="num">{r.backlogs === '' ? 'No limit' : r.backlogs}</td>
                        <td>{r.note || <Dash />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="iempty">No rules yet.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="iaddform__grid iacentry">
            <Field id="ica-edu" label="Minimum highest education required" required error={tried ? err.edu : null}>
              <SelectInput id="ica-edu" value={e.edu} placeholder="Pick one" invalid={tried && !!err.edu} onChange={(x) => setEntry({ edu: x.target.value as MinEducation })}>
                {MIN_EDUCATION.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="ica-scale" label="Its grading scale" required error={tried ? err.scale : null}>
              <SelectInput id="ica-scale" value={e.scale} placeholder="Pick one" invalid={tried && !!err.scale} onChange={(x) => setEntry({ scale: x.target.value as Scale })}>
                {SCALES.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="ica-min" label="Minimum score in it" required error={tried ? err.min : null}>
              <TextInput id="ica-min" inputMode="decimal" value={e.min} invalid={tried && !!err.min} onChange={(x) => setEntry({ min: x.target.value.replace(/[^\d.]/g, '') })} />
            </Field>
            <Field id="ica-back" label="Backlogs allowed in it" optional>
              <TextInput id="ica-back" inputMode="numeric" value={e.backlogs} placeholder="No limit" onChange={(x) => setEntry({ backlogs: x.target.value.replace(/\D/g, '') })} />
            </Field>
          </div>
          <div className="iblock iacrules">
            <h3 className="iblock__title">Rules</h3>
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
                          <MultiPick id={`ica-${r.id}-c`} label={`Countries, rule ${n + 1}`} value={r.countries} options={COUNTRY_LIST} onChange={(countries) => upd(r.id, { countries })} empty="All countries" all="All countries" search />
                        </td>
                        <td>
                          <CellSelect aria-label={`Qualification, rule ${n + 1}`} value={r.qual} onChange={(x) => upd(r.id, { qual: x.target.value as Qualification, board: x.target.value === 'Grade 12' ? r.board : '' })}>
                            {QUALIFICATIONS.map((q) => (
                              <option key={q}>{q}</option>
                            ))}
                          </CellSelect>
                        </td>
                        <td>{r.qual === 'Grade 12' ? <input aria-label={`Board, rule ${n + 1}`} className="icell" value={r.board} onChange={(x) => upd(r.id, { board: x.target.value })} placeholder="Like: CBSE" /> : <Dash />}</td>
                        <td>
                          <CellSelect aria-label={`Grading scale, rule ${n + 1}`} value={r.scale} onChange={(x) => upd(r.id, { scale: x.target.value as Scale })}>
                            {SCALES.map((q) => (
                              <option key={q}>{q}</option>
                            ))}
                          </CellSelect>
                        </td>
                        <td>
                          <input aria-label={`Minimum, rule ${n + 1}`} inputMode="decimal" className={`icell icell--num ${tried && !(r.min > 0) ? 'is-invalid' : ''}`} value={r.min || ''} onChange={(x) => upd(r.id, { min: Number(x.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                        </td>
                        <td>
                          <input aria-label={`Backlogs allowed, rule ${n + 1}`} inputMode="numeric" className="icell icell--num" value={r.backlogs} placeholder="No limit" onChange={(x) => upd(r.id, { backlogs: x.target.value.replace(/\D/g, '') })} />
                        </td>
                        <td>
                          <input aria-label={`Note, rule ${n + 1}`} className="icell" value={r.note} onChange={(x) => upd(r.id, { note: x.target.value })} />
                        </td>
                        <td>
                          <EditOnly>
                            <button type="button" className="btn btn--link idanger" onClick={() => removeRow(r, n)}>
                              Remove<span className="vh"> rule {n + 1}</span>
                            </button>
                          </EditOnly>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="iempty">No rules yet.</p>
            )}
            <AddRow onClick={() => setRows((l) => [...l, { id: newRuleId(), countries: [], qual: 'Applicable to all', board: '', scale: 'Percentage', min: 0, backlogs: '', note: '' }])}>Add a row</AddRow>
          </div>
          <SaveBar
            show
            cancel={filled}
            note={filled && !changed ? 'Nothing changed yet.' : undefined}
            error={tried ? error : null}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (error) return;
              save((x) => ({ ...x, entry: { edu: e.edu, scale: e.scale, min: num(e.min), backlogs: e.backlogs }, academicRules: rows }), 'Academic saved.');
              setTried(false);
              ed.close();
            }}
          />
        </>
      )}
    </Section>
  );
}

function English({ c, save }: { c: CourseRec; save: Save }) {
  const [rows, setRows] = useState<EnglishRule[]>(c.englishRules);
  const [tried, setTried] = useState(false);
  const filled = c.englishRules.length > 0;
  const ed = useEditing(filled);
  const changed = JSON.stringify(rows) !== JSON.stringify(c.englishRules);
  const upd = (id: string, p: Partial<EnglishRule>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const error = rows.some((r) => !(r.overall > 0)) ? 'Each rule needs its overall score.' : null;
  const cancel = () => (setRows(c.englishRules), setTried(false), ed.close());
  const { ask, dialog } = useAsk();
  const removeRow = (r: EnglishRule, n: number) => {
    const go = () => setRows((l) => l.filter((x) => x.id !== r.id));
    if (!c.englishRules.some((x) => x.id === r.id)) return go();
    ask(`Remove rule ${n + 1}?`, 'Remove', <p>{r.test}, {countriesText(r.countries)}: it goes when you save.</p>, go);
  };
  return (
    <Section title="English" id="ic-english" updated={c.stamps.english} action={!ed.editing ? <EditButton onClick={ed.open} what="English rules" /> : undefined}>
      {dialog}
      {!ed.editing ? (
        <div className="stab-wrap">
          <table className="itab itab--view">
            <thead>
              <tr>
                <th scope="col">Countries</th>
                <th scope="col">Test</th>
                <th scope="col">Overall</th>
                <th scope="col">Lowest band or section</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {c.englishRules.map((r) => (
                <tr key={r.id}>
                  <td>{countriesText(r.countries)}</td>
                  <td>{r.test}</td>
                  <td className="num">{r.overall}</td>
                  <td>{r.min > 0 ? <span className="num">{r.min}</span> : <Dash />}</td>
                  <td>{r.note || <Dash />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {rows.length ? (
            <div className="stab-wrap">
              <table className="itab itab--form">
                <thead>
                  <tr>
                    <th scope="col">Countries</th>
                    <th scope="col">
                      Test
                      <Req />
                    </th>
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
                      <td className="icell-wide">
                        <MultiPick id={`ice-${r.id}-c`} label={`Countries, rule ${n + 1}`} value={r.countries} options={COUNTRY_LIST} onChange={(countries) => upd(r.id, { countries })} empty="All countries" all="All countries" search />
                      </td>
                      <td>
                        <CellSelect aria-label={`Test, rule ${n + 1}`} value={r.test} onChange={(e) => upd(r.id, { test: e.target.value as Test })}>
                          {TESTS.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </CellSelect>
                      </td>
                      <td>
                        <input aria-label={`Overall, rule ${n + 1}`} inputMode="decimal" className={`icell icell--num ${tried && !(r.overall > 0) ? 'is-invalid' : ''}`} value={r.overall || ''} onChange={(e) => upd(r.id, { overall: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                      </td>
                      <td>
                        {/* one column for every test, so the row stays level; what it means for this test is its name and tooltip */}
                        <input aria-label={`${TEST_MIN[r.test]}, rule ${n + 1}`} title={TEST_MIN[r.test]} inputMode="decimal" className="icell icell--num" value={r.min || ''} onChange={(e) => upd(r.id, { min: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                      </td>
                      <td>
                        <input aria-label={`Note, rule ${n + 1}`} className="icell" value={r.note} onChange={(e) => upd(r.id, { note: e.target.value })} />
                      </td>
                      <td>
                        <EditOnly>
                          <button type="button" className="btn btn--link idanger" onClick={() => removeRow(r, n)}>
                            Remove<span className="vh"> rule {n + 1}</span>
                          </button>
                        </EditOnly>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="iempty">No English rules yet.</p>
          )}
          <AddRow onClick={() => setRows((l) => [...l, { id: newRuleId(), countries: [], test: 'IELTS Academic', overall: 0, min: 0, note: '' }])}>Add rule</AddRow>
          <SaveBar
            show={filled || changed}
            cancel={filled}
            note={filled && !changed ? 'Nothing changed yet.' : undefined}
            error={tried ? error : null}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (error) return;
              save((x) => ({ ...x, englishRules: rows }), 'English rules saved.');
              setTried(false);
              ed.close();
            }}
          />
        </>
      )}
    </Section>
  );
}

const AddRow = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <EditOnly>
    <button type="button" className="btn btn--secondary btn--sm iadd iadd--row" onClick={onClick}>
      <Icon name="plus" size={16} /> {children}
    </button>
  </EditOnly>
);
