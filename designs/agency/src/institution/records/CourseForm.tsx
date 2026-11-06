import { useEffect, useState } from 'react';
import { EditOnly } from '../../proto/viewOnly';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { AREAS, LEVELS, type Area, type Course, type Level, type StudyMode } from '../../data/courses';
import { campusLabel } from '../courses/parts';
import { blankEntry, type CourseRec, type UniRec } from '../data/catalogue';
import { same, type CsvRead } from './CsvImport';
import { stampBy, today } from '../data/records';

/**
 * Adding a course (29 Oct, 4th round; 6th round as in the PM prototype). It asks for the basics only (university,
 * campus, name, code, level, study area, mode) and saves a draft; its duration, intakes, fees and academic and English
 * rules are entered in the tabs of its page, and it's published once they're there. On Courses and, in place, on a
 * university's page.
 */
export type CourseDraft = { uni: string; campus: string; name: string; code: string; level: Level | ''; area: Area | ''; mode: StudyMode };
export const blankCourse: CourseDraft = { uni: '', campus: '', name: '', code: '', level: '', area: '', mode: 'Full time' };

/**
 * What a course still needs before it can be published. 4 Nov: its course page; an intake's deposit deadline is
 * optional, so an intake needs only its application deadline; the academic entry (minimum education, its grading
 * scale and the minimum in it) in place of a first academic rule.
 */
export const missingOf = (c: CourseRec) =>
  [
    [c.durValue > 0, 'duration'],
    [!!c.url.trim(), 'course page'],
    [c.intakes.length > 0 && c.intakes.every((i) => i.deadline), 'an intake with its application deadline'],
    [c.fullFee > 0, 'full course fee'],
    [!!c.entry.edu && !!c.entry.scale && c.entry.min > 0, 'minimum education'],
    [c.englishRules.length > 0, 'an English rule'],
  ]
    .filter(([ok]) => !ok)
    .map(([, k]) => k as string);

let seq = 0;

/* ---------- 3 Nov: adding courses from a CSV file, with the same basics ---------- */

const MODES: StudyMode[] = ['Full time', 'Part time', 'Online', 'Blended'];
const COLS = ['Course name', 'Course code', 'Campus', 'Program level', 'Study area', 'Study mode'];
/** The template: its headings (with University first on Courses, where it's for any university). */
export const courseTemplate = (anyUni: boolean) => [anyUni ? ['University', ...COLS] : COLS];

/** What each column takes, under the template. */
export function CourseColumns({ u }: { u?: UniRec }) {
  const campuses = u ? u.campuses.filter((c) => !u.inactive.includes(c.name)).map((c) => c.name) : null;
  return (
    <dl className="icsv__cols-list">
      {!u && (
        <div>
          <dt>University</dt>
          <dd>Its name as on Universities. It needs an active campus.</dd>
        </div>
      )}
      <div>
        <dt>Course name</dt>
        <dd>Needed.</dd>
      </div>
      <div>
        <dt>Course code</dt>
        <dd>Optional; unique at its campus.</dd>
      </div>
      <div>
        <dt>Campus</dt>
        <dd>{campuses ? `${campuses.join(', ')}${campuses.length === 1 ? ' (or leave it empty)' : ''}.` : 'One of the university’s active campuses; empty for a university with one.'}</dd>
      </div>
      <div>
        <dt>Program level</dt>
        <dd>{LEVELS.join(', ')}.</dd>
      </div>
      <div>
        <dt>Study area</dt>
        <dd>{AREAS.join(', ')}.</dd>
      </div>
      <div>
        <dt>Study mode</dt>
        <dd>{MODES.join(', ')}; Full time when empty.</dd>
      </div>
    </dl>
  );
}

/** Reads the courses CSV into drafts: each row checked as Add a course checks it. `u` fixes the university. */
export function readCourses(rows: string[][], unis: UniRec[], courses: CourseRec[], u?: UniRec): CsvRead<CourseDraft> {
  const head = rows[0].map((h) => h.toLowerCase());
  const col = (k: string, i: number) => {
    const at = head.findIndex((h) => h.includes(k));
    return at >= 0 ? at : i;
  };
  const off = u ? 0 : 1;
  const at = { uni: col('university', 0), name: col('name', off), code: col('code', off + 1), campus: col('campus', off + 2), level: col('level', off + 3), area: col('area', off + 4), mode: col('mode', off + 5) };
  const ok: CourseDraft[] = [];
  const problems: string[] = [];
  rows.slice(1).forEach((r, i) => {
    const row = `Row ${i + 2}`;
    const cell = (k: keyof typeof at) => (r[at[k]] ?? '').trim();
    const uni = u ?? unis.find((x) => same(x.name, cell('uni')) || (x.aka ?? []).some((a) => same(a, cell('uni'))));
    if (!uni) return problems.push(`${row}: no university called “${cell('uni') || 'nothing'}”.`);
    const active = uni.campuses.filter((c) => !uni.inactive.includes(c.name));
    if (!active.length) return problems.push(`${row}: ${uni.name} has no active campus yet.`);
    const name = cell('name');
    if (!name) return problems.push(`${row}: the course name is empty.`);
    const campus = cell('campus') ? active.find((c) => same(c.name, cell('campus')) || same(c.city, cell('campus')) || same(campusLabel(c), cell('campus'))) : active.length === 1 ? active[0] : undefined;
    if (!campus) return problems.push(`${row}: ${name}: ${cell('campus') ? `no active campus called “${cell('campus')}”` : 'name its campus'} at ${uni.name}.`);
    const level = LEVELS.find((l) => same(l, cell('level')));
    if (!level) return problems.push(`${row}: ${name}: “${cell('level') || 'nothing'}” isn’t a program level.`);
    const area = AREAS.find((a) => same(a, cell('area')));
    if (!area) return problems.push(`${row}: ${name}: “${cell('area') || 'nothing'}” isn’t a study area.`);
    const mode = cell('mode') ? MODES.find((m) => same(m, cell('mode'))) : 'Full time';
    if (!mode) return problems.push(`${row}: ${name}: “${cell('mode')}” isn’t a study mode.`);
    const here = (x: { uni: string; campus: string }) => x.uni === uni.id && x.campus === campus.name;
    const all = [...courses.map((c) => ({ uni: c.uni.id, campus: c.campus.name, name: c.name, code: c.code })), ...ok];
    if (all.some((x) => here(x) && same(x.name, name))) return problems.push(`${row}: ${name} is already at ${campus.name}.`);
    const code = cell('code').toUpperCase();
    if (code && all.some((x) => here(x) && same(x.code, code))) return problems.push(`${row}: ${name}: another course at ${campus.name} has the code ${code}.`);
    ok.push({ uni: uni.id, campus: campus.name, name, code, level, area, mode });
  });
  return { ok, problems };
}

/** A new course from the basics: a draft, everything else still to enter. */
export function newCourse(f: CourseDraft, unis: UniRec[], courses: CourseRec[], by: string, source: CourseRec['source'] = 'Added by hand'): CourseRec {
  const u = unis.find((x) => x.id === f.uni)!;
  const campus = u.campuses.find((x) => x.name === f.campus) ?? u.campuses[0];
  // fields the institution pages don't show (documents, other costs) start from a course like it, for Course search
  const like: Course = courses.find((c) => c.uni.id === u.id && c.level === f.level) ?? courses.find((c) => c.uni.country === u.country) ?? courses[0];
  return {
    ...like,
    id: `${u.id}-new-${Date.now().toString(36)}${(++seq).toString(36)}`,
    name: f.name.trim(),
    code: f.code.trim(),
    uni: u,
    campus,
    level: f.level as Level,
    area: f.area as Area,
    mode: f.mode,
    months: 0,
    durUnit: 'Months',
    durValue: 0,
    url: '',
    psw: false,
    tags: [],
    intakes: [],
    dates: {},
    tuition: 0,
    currency: courses.find((c) => c.uni.country === u.country)?.currency ?? like.currency,
    firstYearFee: 0,
    fullFee: 0,
    appFee: 0,
    academic: 0,
    backlogs: undefined,
    entry: { ...blankEntry },
    academicRules: [],
    ielts: [0, 0],
    pte: [0, 0],
    toefl: [0, 0],
    englishRules: [],
    englishFlex: false,
    deposit: 0,
    scholarship: 0,
    scholarshipName: undefined,
    placement: false,
    pathway: false,
    careers: [],
    cricos: undefined,
    rate: u.rate,
    offerDays: u.offerDays,
    checked: today(),
    status: 'Draft',
    source,
    created: stampBy(by),
    stamps: {},
    log: [],
  };
}

export function CourseForm({ f, unis, courses, lockUni = false, onCancel, onSave }: { f: CourseDraft | null; unis: UniRec[]; courses: CourseRec[]; lockUni?: boolean; onCancel: () => void; onSave: (f: CourseDraft) => void }) {
  const [v, setV] = useState<CourseDraft>(f ?? blankCourse);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (f) {
      setV(f);
      setTried(false);
    }
  }, [f]);
  const set = (p: Partial<CourseDraft>) => setV((x) => ({ ...x, ...p }));
  const u = unis.find((x) => x.id === v.uni);
  const campuses = (u?.campuses ?? []).filter((c) => !u?.inactive.includes(c.name));
  const campus = v.campus || campuses[0]?.name || '';
  const err = {
    uni: !v.uni ? 'Pick the university.' : !campuses.length ? 'Add a campus to the university first.' : null,
    name: !v.name.trim() ? 'Enter the course’s name.' : courses.some((c) => c.uni.id === v.uni && c.campus.name === campus && c.name.toLowerCase() === v.name.trim().toLowerCase()) ? 'That course is already here, at that campus.' : null,
    code: v.code.trim() && courses.some((c) => c.uni.id === v.uni && c.campus.name === campus && c.code.toLowerCase() === v.code.trim().toLowerCase()) ? 'Another course at this campus has that code.' : null,
    level: !v.level ? 'Pick the program level.' : null,
    area: !v.area ? 'Pick the study area.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Sheet
      open={!!f}
      onClose={onCancel}
      center
      className="iform"
      title="Add a course"
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <EditOnly>
              <Button
                onClick={() => {
                  setTried(true);
                  if (Object.values(err).every((e) => !e)) onSave({ ...v, campus });
                }}
              >
                Save
              </Button>
            </EditOnly>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="ic-uni" label="University" required error={show('uni')}>
          <SelectInput id="ic-uni" value={v.uni} placeholder="Pick a university" invalid={!!show('uni')} disabled={lockUni} onChange={(e) => set({ uni: e.target.value, campus: '' })}>
            {unis
              .filter((x) => x.status !== 'Ended' || x.id === v.uni)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </SelectInput>
        </Field>
        <Field id="ic-campus" label="Campus">
          <SelectInput id="ic-campus" value={campus} disabled={!campuses.length} onChange={(e) => set({ campus: e.target.value })}>
            {campuses.map((c) => (
              <option key={c.name} value={c.name}>
                {campusLabel(c)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ic-name" label="Course name" required error={show('name')}>
          <TextInput id="ic-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} placeholder="Like: Master of Data Science" />
        </Field>
        <Field id="ic-code" label="Course code" optional error={show('code')}>
          <TextInput id="ic-code" value={v.code} invalid={!!show('code')} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="Like: MBA-HAT-01" />
        </Field>
        <Field id="ic-level" label="Program level" required error={show('level')}>
          <SelectInput id="ic-level" value={v.level} placeholder="Pick a level" invalid={!!show('level')} onChange={(e) => set({ level: e.target.value as Level })}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ic-area" label="Study area" required error={show('area')}>
          <SelectInput id="ic-area" value={v.area} placeholder="Pick an area" invalid={!!show('area')} onChange={(e) => set({ area: e.target.value as Area })}>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ic-mode" label="Study mode">
          <SelectInput id="ic-mode" value={v.mode} onChange={(e) => set({ mode: e.target.value as StudyMode })}>
            {(['Full time', 'Part time', 'Online', 'Blended'] as StudyMode[]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}
