import { useUnsaved } from '../../components/unsaved';
import { notify } from '../../components/Toast';
import { useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { AREAS, LEVELS, type Area, type IntakeStatus, type Level, type StudyMode } from '../../data/courses';
import { COUNTRIES, TOP_MARKETS } from '../../data/partners';
import { UniMark, campusLabel } from '../courses/parts';
import { CURRENCIES, DURATION_UNITS, QUALIFICATIONS, SCALES, TAGS, TESTS, TEST_MIN, newRuleId, withSearchFields, type AcademicRule, type CourseRec, type DurationUnit, type EnglishRule, type IntakeDates, type Qualification, type Scale, type Test, type UniRec } from '../data/catalogue';
import { dateText, stampBy } from '../data/records';
import { patch } from '../data/store';
import { Facts, RecordHead, RecordTabs, Section, TabPanel, toggle } from './parts';
import { CoursePill } from './pills';
import { money } from '../../data/courses';
import { MultiPick } from './MultiPick';
import { missingOf } from './CourseForm';
import type { PageProps } from '../portal/model';

type Tab = 'basics' | 'intakes' | 'fees' | 'academic' | 'english';
const TABS: Tab[] = ['basics', 'intakes', 'fees', 'academic', 'english'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() + i));
const STATUS: Record<IntakeStatus, string> = { open: 'Open', likely: 'Likely', late: 'Late (low likelihood)', closed: 'Closed' };
const COUNTRY_LIST = [...TOP_MARKETS, ...COUNTRIES.map((c) => c.name).filter((n) => !TOP_MARKETS.includes(n))];

/**
 * A course's page (29 Oct, 6th round), as the PM prototype's course record: its status and what moves it (Publish or
 * Delete a draft, Hide or Show), then five tabs to fill in and save: Basics, Intakes, Fees, Academic and English.
 * No other fields, no preview, no log, nothing filled in for the team. 29 Oct (7th round): Basics has the university;
 * no post-study work tick; the tables' dropdowns have the portal's own arrow; each tab and the status say who last
 * changed them, and when.
 */
export function CoursePage({ c, tab: start, backLabel, onBack, set, say, db, open, me }: PageProps & { c: CourseRec; tab?: string; backLabel: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>(TABS.includes(start as Tab) ? (start as Tab) : 'basics');
  const [deleting, setDeleting] = useState(false);
  const u = db.unis.find((x) => x.id === c.uni.id);
  /** Saves a tab (or the status) and says who changed it, and when. */
  const save = (fn: (x: CourseRec) => CourseRec, what: string, part: string = tab) => {
    set((d) => ({ ...d, courses: patch(d.courses, c.id, (x) => withSearchFields({ ...fn(x), stamps: { ...x.stamps, [part]: stampBy(me) } })) }));
    say(what);
  };
  /** QC, 1 Nov (H34): hiding is reversible, so it happens straight away and the notification offers Undo. */
  const hide = () => {
    const was = { status: c.status, stamp: c.stamps.status };
    set((d) => ({ ...d, courses: patch(d.courses, c.id, (x) => withSearchFields({ ...x, status: 'Hidden', stamps: { ...x.stamps, status: stampBy(me) } })) }));
    notify({
      title: `${c.name} hidden`,
      text: 'It’s out of Course search. Applications already made carry on.',
      undo: () => set((d) => ({ ...d, courses: patch(d.courses, c.id, (x) => withSearchFields({ ...x, status: was.status, stamps: { ...x.stamps, status: was.stamp } })) })),
    });
  };
  const missing = missingOf(c);

  const act =
    c.status === 'Draft' ? (
      <>
        <Button variant="secondary" size="sm" onClick={() => setDeleting(true)}>
          Delete draft
        </Button>
        <Button size="sm" disabled={missing.length > 0} onClick={() => save((x) => ({ ...x, status: 'Live' }), `${c.name} published.`, 'status')}>
          Publish
        </Button>
      </>
    ) : c.status === 'Hidden' ? (
      <Button size="sm" variant="secondary" onClick={() => save((x) => ({ ...x, status: 'Live' }), `${c.name} is back in Course search.`, 'status')}>
        Show again
      </Button>
    ) : (
      <Button size="sm" variant="secondary" onClick={hide}>
        Hide
      </Button>
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
          { key: 'academic', label: 'Academic', n: c.academicRules.length },
          { key: 'english', label: 'English', n: c.englishRules.length },
        ]}
      />

      <TabPanel id="ictab" tab={tab}>
        {tab === 'basics' && <Basics key={c.id} c={c} unis={db.unis} courses={db.courses} save={save} />}
        {tab === 'intakes' && <Intakes key={c.id} c={c} save={save} />}
        {tab === 'fees' && <Fees key={c.id} c={c} save={save} />}
        {tab === 'academic' && <Academic key={c.id} c={c} save={save} />}
        {tab === 'english' && <English key={c.id} c={c} save={save} />}
      </TabPanel>

      <ConfirmDialog
        open={deleting}
        title={`Delete ${c.name}?`}
        confirm="Delete draft"
        danger
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

type Save = (fn: (x: CourseRec) => CourseRec, what: string) => void;

/** A dropdown in a table row, with the portal's own arrow (29 Oct, 7th round): the browser's looked broken beside the rest. */
const CellSelect = ({ className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <span className="icell-sel">
    <select {...p} className={`icell ${className}`}>
      {children}
    </select>
    <Icon name="chevronDown" size={18} />
  </span>
);

/** Unsaved changes on a tab: Discard (or Cancel, when editing what was saved) or Save. */
function SaveBar({ show, onDiscard, onSave, error, cancel = false, note }: { show: boolean; onDiscard: () => void; onSave: () => void; error?: string | null; cancel?: boolean; note?: string }) {
  // QC, 1 Nov (H2): leaving the course, or another of its tabs, with these changes asks first
  useUnsaved(show, show, { onDiscard, what: 'this tab', esc: false });
  if (!show) return null;
  return (
    <div className="isave" role="region" aria-label="Unsaved changes">
      <p className="isave__t">{error ?? note ?? 'Not saved yet.'}</p>
      <Button variant="secondary" size="sm" onClick={onDiscard}>
        {cancel ? 'Cancel' : 'Discard'}
      </Button>
      <Button size="sm" onClick={onSave}>
        Save changes
      </Button>
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

const num = (s: string) => (s.trim() === '' ? 0 : Number(s));
const str = (n: number) => (n > 0 ? String(n) : '');

function Basics({ c, unis, courses, save }: { c: CourseRec; unis: UniRec[]; courses: CourseRec[]; save: Save }) {
  const first = () => ({ code: c.code, cricos: c.cricos ?? '', name: c.name, uni: c.uni.id, campus: c.campus.name, level: c.level, area: c.area, mode: c.mode, durUnit: c.durUnit, durValue: str(c.durValue), url: c.url, tags: c.tags });
  const [v, setV] = useState(first);
  const [tried, setTried] = useState(false);
  const set = (p: Partial<ReturnType<typeof first>>) => setV((x) => ({ ...x, ...p }));
  const changed = JSON.stringify(v) !== JSON.stringify(first());
  const u = unis.find((x) => x.id === v.uni);
  // the university's active campuses, and the one it's at now
  const campusesOf = (x?: UniRec) => (x?.campuses ?? []).filter((k) => !x?.inactive.includes(k.name) || (x.id === c.uni.id && k.name === c.campus.name));
  const campuses = u ? campusesOf(u) : [c.campus];
  const same = (x: CourseRec) => x.id !== c.id && x.uni.id === v.uni && x.campus.name === v.campus;
  const err = {
    name: !v.name.trim() ? 'Enter the course’s name.' : courses.some((x) => same(x) && x.name.toLowerCase() === v.name.trim().toLowerCase()) ? 'That course is already here, at that campus.' : null,
    code: v.code.trim() && courses.some((x) => same(x) && x.code.toLowerCase() === v.code.trim().toLowerCase()) ? 'Another course at this campus has that code.' : null,
    campus: !campuses.some((k) => k.name === v.campus) ? 'Pick a campus. This university has no active campus yet.' : null,
    durValue: !v.durValue ? 'Enter the duration.' : !(Number(v.durValue) > 0 && Number(v.durValue) <= 500) ? 'A number, like 24.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Section title="Basics" id="ic-basics" updated={c.stamps.basics}>
      <div className="iaddform__grid">
        <Field id="icb-code" label="Course code" optional error={show('code')}>
          <TextInput id="icb-code" value={v.code} invalid={!!show('code')} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="Like: MBA-HAT-01" />
        </Field>
        {(u?.country ?? c.uni.country) === 'Australia' && (
          <Field id="icb-cricos" label="CRICOS course code" optional hint="Each course registered on CRICOS has its own code; the university's provider code is on the university.">
            <TextInput id="icb-cricos" value={v.cricos} onChange={(e) => set({ cricos: e.target.value.toUpperCase() })} placeholder="Like: 012345A" />
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
        <Field id="icb-url" label="Course page on the university website" optional className="iform__wide">
          <TextInput id="icb-url" type="url" value={v.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
        </Field>
      </div>
      <div className="iblock itagblock">
        <h3 className="iblock__title">Tags</h3>
        <p className="irsec__note">Shown to partners as tags on this course in search; they also work as quick filters. Tick the ones that apply. Only a GSP admin adds a new tag to the list.</p>
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
        show={changed}
        onDiscard={() => (setV(first()), setTried(false))}
        onSave={() => {
          setTried(true);
          if (Object.values(err).some(Boolean)) return;
          const campus = campuses.find((x) => x.name === v.campus) ?? c.campus;
          save((x) => ({ ...x, code: v.code.trim(), cricos: v.cricos.trim() || undefined, name: v.name.trim(), uni: u ?? x.uni, campus, level: v.level, area: v.area, mode: v.mode, durUnit: v.durUnit, durValue: num(v.durValue), url: v.url.trim(), tags: v.tags }), 'Basics saved.');
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
  const error = rows.some((r) => !r.apply || !r.deposit) ? 'Each intake needs its application and deposit deadlines.' : new Set(names).size !== names.length ? 'Each intake once only.' : null;
  const cancel = () => (setRows(first()), setTried(false), ed.close());
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
      note="“Likely” means the university runs this intake every year but hasn’t confirmed it. Partners can still apply; GSP submits when it opens."
      action={!ed.editing ? <EditButton onClick={ed.open} what="intakes" /> : undefined}
    >
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
                    <th scope="col">
                      Deposit deadline
                      <Req />
                    </th>
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
                      {cell(r, 'deposit', 'Deposit deadline', true)}
                      {cell(r, 'accept', 'Acceptance deadline')}
                      {cell(r, 'start', 'Batch start date')}
                      {cell(r, 'census', 'Census date')}
                      <td>
                        <button type="button" className="btn btn--link idanger" onClick={() => setRows((l) => l.filter((x) => x.key !== r.key))}>
                          Remove<span className="vh"> {r.month} {r.year}</span>
                        </button>
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
            {amount('icf-app', 'Application fee', 'appFee', false, 'Paid by the student.')}
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

function Academic({ c, save }: { c: CourseRec; save: Save }) {
  const [rows, setRows] = useState<AcademicRule[]>(c.academicRules);
  const [tried, setTried] = useState(false);
  const filled = c.academicRules.length > 0;
  const ed = useEditing(filled);
  const changed = JSON.stringify(rows) !== JSON.stringify(c.academicRules);
  const upd = (id: string, p: Partial<AcademicRule>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const error = rows.some((r) => !(r.min > 0)) ? 'Each rule needs its minimum.' : null;
  const cancel = () => (setRows(c.academicRules), setTried(false), ed.close());
  return (
    <Section
      title="Academic"
      id="ic-academic"
      updated={c.stamps.academic}
      note="One row per country and qualification. For Grade 12, add one row per board. Backlogs allowed: leave it empty for no limit, 0 for none. Partners only see the rows for their student’s country."
      action={!ed.editing ? <EditButton onClick={ed.open} what="academic rules" /> : undefined}
    >
      {!ed.editing ? (
        <div className="stab-wrap">
          <table className="itab itab--view">
            <thead>
              <tr>
                <th scope="col">Countries</th>
                <th scope="col">Qualification</th>
                <th scope="col">Board (Grade 12)</th>
                <th scope="col">Scale</th>
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
                  <td className="num">{r.backlogs === '' ? 'Any' : r.backlogs}</td>
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
                      Qualification
                      <Req />
                    </th>
                    <th scope="col">Board (Grade 12)</th>
                    <th scope="col">
                      Scale
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
                        <CellSelect aria-label={`Qualification, rule ${n + 1}`} value={r.qual} onChange={(e) => upd(r.id, { qual: e.target.value as Qualification, board: e.target.value === 'Grade 12' ? r.board : '' })}>
                          {QUALIFICATIONS.map((q) => (
                            <option key={q}>{q}</option>
                          ))}
                        </CellSelect>
                      </td>
                      <td>{r.qual === 'Grade 12' ? <input aria-label={`Board, rule ${n + 1}`} className="icell" value={r.board} onChange={(e) => upd(r.id, { board: e.target.value })} placeholder="Like: CBSE" /> : <Dash />}</td>
                      <td>
                        <CellSelect aria-label={`Scale, rule ${n + 1}`} value={r.scale} onChange={(e) => upd(r.id, { scale: e.target.value as Scale })}>
                          {SCALES.map((q) => (
                            <option key={q}>{q}</option>
                          ))}
                        </CellSelect>
                      </td>
                      <td>
                        <input aria-label={`Minimum, rule ${n + 1}`} inputMode="decimal" className={`icell icell--num ${tried && !(r.min > 0) ? 'is-invalid' : ''}`} value={r.min || ''} onChange={(e) => upd(r.id, { min: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                      </td>
                      <td>
                        <input aria-label={`Backlogs allowed, rule ${n + 1}`} inputMode="numeric" className="icell icell--num" value={r.backlogs} placeholder="Any" onChange={(e) => upd(r.id, { backlogs: e.target.value.replace(/\D/g, '') })} />
                      </td>
                      <td>
                        <input aria-label={`Note, rule ${n + 1}`} className="icell" value={r.note} onChange={(e) => upd(r.id, { note: e.target.value })} />
                      </td>
                      <td>
                        <button type="button" className="btn btn--link idanger" onClick={() => setRows((l) => l.filter((x) => x.id !== r.id))}>
                          Remove<span className="vh"> rule {n + 1}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="iempty">No academic rules yet.</p>
          )}
          <AddRow onClick={() => setRows((l) => [...l, { id: newRuleId(), countries: [], qual: 'Applicable to all', board: '', scale: 'Percentage', min: 0, backlogs: '', note: '' }])}>Add rule</AddRow>
          <SaveBar
            show={filled || changed}
            cancel={filled}
            note={filled && !changed ? 'Nothing changed yet.' : undefined}
            error={tried ? error : null}
            onDiscard={cancel}
            onSave={() => {
              setTried(true);
              if (error) return;
              save((x) => ({ ...x, academicRules: rows }), 'Academic rules saved.');
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
  return (
    <Section
      title="English"
      id="ic-english"
      updated={c.stamps.english}
      note="One row per test and student country. A row with no country applies to every student country; a row for a country overrides it. Partners only see the rows for their student’s country."
      action={!ed.editing ? <EditButton onClick={ed.open} what="English rules" /> : undefined}
    >
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
                        <button type="button" className="btn btn--link idanger" onClick={() => setRows((l) => l.filter((x) => x.id !== r.id))}>
                          Remove<span className="vh"> rule {n + 1}</span>
                        </button>
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
  <button type="button" className="btn btn--secondary btn--sm iadd iadd--row" onClick={onClick}>
    <Icon name="plus" size={16} /> {children}
  </button>
);
