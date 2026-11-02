import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { DateInput, Field, TextInput } from '../../components/forms';
import { AREAS, CURRENCY, LEVELS, MIN_EDUCATION, type Area, type Course, type Destination, type Level, type StudyMode } from '../../data/courses';
import { campusLabel } from '../courses/parts';
import { DURATION_UNITS, SOURCES, type CourseRec, type DurationUnit, type Source, type UniRec } from '../data/catalogue';
import { todayIso } from '../data/records';
import { change } from '../data/changelog';
import { ErrorText, Pick } from './parts';
import { NumberField } from '../../components/NumberField';

/**
 * Add a course (slice 2 PRD): opens on the university with the Basics fields (not Tags) and **Add draft** saves it
 * as a Draft and opens its page. The same checks run on Basics Edit and on every CSV import row.
 */
export type CourseDraft = { uni: string; campus: string; name: string; code: string; cricos: string; level: Level | ''; area: Area | ''; mode: StudyMode | ''; durUnit: DurationUnit | ''; durValue: string; url: string; checked: string; source: Source | ''; minEducation?: string };
export const blankCourse: CourseDraft = { uni: '', campus: '', name: '', code: '', cricos: '', level: '', area: '', mode: '', durUnit: '', durValue: '', url: '', checked: '', source: 'Added by hand' };
export const MODES: StudyMode[] = ['Full time', 'Part time', 'Blended', 'Online'];

/** The university's active campuses. */
export const activeCampuses = (u?: UniRec) => (u?.campuses ?? []).filter((c) => !u?.inactive.includes(c.name));

/** Every Basics check (slice 2 PRD), for Add a course, Basics Edit and the CSV import. `self` is the course being edited. */
export function basicsErrors(v: CourseDraft, u: UniRec | undefined, courses: CourseRec[], self?: string) {
  const at = v.campus;
  const same = (c: CourseRec) => c.id !== self && c.uni.id === v.uni && c.campus.name === at;
  const code = v.code.trim().toUpperCase();
  const name = v.name.trim();
  const au = u?.country === 'Australia';
  const n = Number(v.durValue);
  return {
    uni: !u ? 'Pick a university.' : null,
    code: !code ? 'Enter the course code.' : !/^[A-Z0-9-]{1,30}$/.test(code) ? 'Use letters, digits and hyphens, up to 30.' : courses.some((c) => same(c) && c.code.toUpperCase() === code) ? `This code is already used at ${at}.` : null,
    cricos: au ? (!v.cricos.trim() ? 'Enter the CRICOS course code.' : !/^\d{6}[A-Z]$/.test(v.cricos.trim().toUpperCase()) ? 'Use 6 digits and a letter, like 012345A.' : null) : null,
    name: !name ? 'Enter the course name.' : name.length > 160 ? 'Use up to 160 characters.' : courses.some((c) => same(c) && c.name.toLowerCase() === name.toLowerCase()) ? `${at} already has a course with this name.` : null,
    campus: !activeCampuses(u).some((k) => k.name === at) ? 'Pick a campus.' : null,
    level: !v.level ? 'Pick a program level.' : null,
    area: !v.area ? 'Pick a study area.' : null,
    mode: !v.mode ? 'Pick a study mode.' : null,
    durUnit: !v.durUnit ? 'Pick a unit.' : null,
    durValue: !v.durValue.trim() ? 'Enter the duration.' : !/^\d+(\.\d+)?$/.test(v.durValue.trim()) || !(n > 0 && n <= 500) ? 'Enter a number above 0 and up to 500.' : null,
    url: !/^https:\/\/\S+\.\S+/.test(v.url.trim()) ? 'Enter the whole web address, starting with https://.' : null,
    checked: !v.checked ? 'Enter the last checked date.' : !/^\d{4}-\d{2}-\d{2}$/.test(v.checked) ? 'Enter a date like 02/11/2026.' : v.checked > todayIso() ? 'Pick today or an earlier date.' : null,
    source: !v.source ? 'Pick a source.' : null,
  };
}

/**
 * What a course still needs before it can be published (slice 2 PRD): an intake with an application deadline, and
 * Minimum highest education required (proposal, S2C-3).
 */
export const missingOf = (c: CourseRec) =>
  (
    [
      [c.intakes.some((i) => !!i.deadline), 'an intake with an application deadline'],
      [!!c.minEducation, 'the minimum highest education (Academic tab)'],
    ] as [boolean, string][]
  )
    .filter(([ok]) => !ok)
    .map(([, k]) => k);

/** A new Draft from the Basics. `how` is written to its Change log ("Course created" or "Course created (CSV import)"). */
export function newCourse(f: CourseDraft, unis: UniRec[], courses: CourseRec[], who: { by: string; role: string }, how = 'Course created'): CourseRec {
  const u = unis.find((x) => x.id === f.uni)!;
  const campus = u.campuses.find((x) => x.name === f.campus) ?? u.campuses[0];
  // fields the institution pages don't show (documents, other costs) start from a course like it, for Course search
  const like: Course = courses.find((c) => c.uni.id === u.id && c.level === f.level) ?? courses.find((c) => c.uni.country === u.country) ?? courses[0];
  const durValue = Number(f.durValue) || 0;
  const unit = (f.durUnit || 'Months') as DurationUnit;
  const months = unit === 'Months' ? durValue : unit === 'Years' ? durValue * 12 : unit === 'Weeks' ? Math.round(durValue / 4.345) : 0;
  const at = Date.now();
  return {
    ...like,
    id: `${u.id}-new-${at.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: f.name.trim(),
    code: f.code.trim().toUpperCase(),
    uni: u,
    campus,
    level: f.level as Level,
    area: f.area as Area,
    mode: f.mode as StudyMode,
    months,
    durUnit: unit,
    durValue,
    url: f.url.trim(),
    tags: [],
    intakes: [],
    dates: {},
    tuition: 0,
    currency: CURRENCY[u.country as Destination] ?? like.currency,
    firstYearFee: 0,
    fullFee: 0,
    totalFee: 0,
    appFee: 0,
    feeYear: new Date().getFullYear(),
    academic: 0,
    backlogs: undefined,
    academicRules: [],
    ielts: [0, 0],
    pte: [0, 0],
    toefl: [0, 0],
    duolingo: [0, 0],
    englishRules: [],
    englishFlex: false,
    deposit: 0,
    scholarship: 0,
    scholarshipName: undefined,
    cricos: f.cricos.trim() ? f.cricos.trim().toUpperCase() : undefined,
    minEducation: f.minEducation || undefined,
    rate: u.rate,
    checked: f.checked,
    status: 'Draft',
    source: (f.source || 'Added by hand') as Source,
    stamps: {},
    log: [change(who.by, who.role, how, '—', f.name.trim(), at)],
    created: { by: who.by, at },
  };
}

/** The Basics fields as a form: used by Add a course and the Basics tab's Edit. */
export function BasicsFields({ v, set, u, unis, err, show, lockUni, idp }: { v: CourseDraft; set: (p: Partial<CourseDraft>) => void; u?: UniRec; unis?: UniRec[]; err: ReturnType<typeof basicsErrors>; show: boolean; lockUni: boolean; idp: string }) {
  const e = (k: keyof typeof err) => (show ? err[k] : null);
  const campuses = activeCampuses(u);
  return (
    <div className="iform__grid">
      {!lockUni && unis && (
        <Field id={`${idp}-uni`} label="University" required error={e('uni')} className="iform__wide">
          <Pick id={`${idp}-uni`} label="University" value={v.uni} placeholder="Pick a university" invalid={!!e('uni')} options={unis.filter((x) => x.status !== 'Ended').map((x) => ({ value: x.id, label: x.name }))} onChange={(uni) => set({ uni, campus: '' })} />
        </Field>
      )}
      <Field id={`${idp}-code`} label="Course code" required error={e('code')} hint="Unique at its campus. Saved in capitals.">
        <TextInput id={`${idp}-code`} value={v.code} maxLength={30} invalid={!!e('code')} onChange={(x) => set({ code: x.target.value.toUpperCase() })} placeholder="Like: MBA-HAT-01" />
      </Field>
      {u?.country === 'Australia' && (
        <Field id={`${idp}-cricos`} label="CRICOS course code" required error={e('cricos')}>
          <TextInput id={`${idp}-cricos`} value={v.cricos} maxLength={7} invalid={!!e('cricos')} onChange={(x) => set({ cricos: x.target.value.toUpperCase() })} placeholder="Like: 012345A" />
        </Field>
      )}
      <Field id={`${idp}-name`} label="Course name" required error={e('name')} className="iform__wide">
        <TextInput id={`${idp}-name`} value={v.name} maxLength={160} invalid={!!e('name')} onChange={(x) => set({ name: x.target.value })} placeholder="Like: Master of Data Science" />
      </Field>
      <Field id={`${idp}-campus`} label="Campus" required error={e('campus')} hint={u && !campuses.length ? 'This university has no active campus yet.' : undefined}>
        <Pick id={`${idp}-campus`} label="Campus" value={v.campus} placeholder="Pick a campus" invalid={!!e('campus')} options={campuses.map((c) => ({ value: c.name, label: campusLabel(c) }))} onChange={(campus) => set({ campus })} />
      </Field>
      <Field id={`${idp}-level`} label="Program level" required error={e('level')}>
        <Pick id={`${idp}-level`} label="Program level" value={v.level} placeholder="Pick a level" invalid={!!e('level')} options={LEVELS} onChange={(level) => set({ level: level as Level })} />
      </Field>
      <Field id={`${idp}-area`} label="Study area" required error={e('area')}>
        <Pick id={`${idp}-area`} label="Study area" value={v.area} placeholder="Pick an area" invalid={!!e('area')} options={AREAS} onChange={(area) => set({ area: area as Area })} />
      </Field>
      <Field id={`${idp}-mode`} label="Study mode" required error={e('mode')}>
        <Pick id={`${idp}-mode`} label="Study mode" value={v.mode} placeholder="Pick a mode" invalid={!!e('mode')} options={MODES} onChange={(mode) => set({ mode: mode as StudyMode })} />
      </Field>
      <Field id={`${idp}-dur`} label="Duration" required error={e('durValue')} hint="Like 24 or 1.5">
        <NumberField id={`${idp}-dur`} decimal value={v.durValue} invalid={!!e('durValue')} onChange={(_t) => set({ durValue: _t.replace(/[^\d.]/g, '') })} />
      </Field>
      <Field id={`${idp}-unit`} label="Unit" required error={e('durUnit')}>
        <Pick id={`${idp}-unit`} label="Unit" value={v.durUnit} placeholder="Pick a unit" invalid={!!e('durUnit')} options={DURATION_UNITS} onChange={(durUnit) => set({ durUnit: durUnit as DurationUnit })} />
      </Field>
      <Field id={`${idp}-url`} label="Course page" required error={e('url')} hint="On the university’s site." className="iform__wide">
        <TextInput id={`${idp}-url`} type="url" value={v.url} invalid={!!e('url')} onChange={(x) => set({ url: x.target.value })} placeholder="https://" />
      </Field>
      <Field id={`${idp}-checked`} label="Last checked" required error={e('checked')} hint="When the team last checked it against the university’s page. Course search shows it as Last updated.">
        <DateInput id={`${idp}-checked`} value={v.checked} invalid={!!e('checked')} onChange={(checked) => set({ checked })} />
      </Field>
      <Field id={`${idp}-source`} label="Source" required error={e('source')}>
        <Pick id={`${idp}-source`} label="Source" value={v.source} placeholder="Pick a source" invalid={!!e('source')} options={SOURCES} onChange={(source) => set({ source: source as Source })} />
      </Field>
    </div>
  );
}

export function CourseForm({ f, unis, courses, lockUni = false, onCancel, onSave }: { f: CourseDraft | null; unis: UniRec[]; courses: CourseRec[]; lockUni?: boolean; onCancel: () => void; onSave: (f: CourseDraft) => void }) {
  const [v, setV] = useState<CourseDraft>(f ?? blankCourse);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (f) {
      const u = unis.find((x) => x.id === f.uni);
      setV({ ...f, campus: f.campus || activeCampuses(u)[0]?.name || '' });
      setTried(false);
    }
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<CourseDraft>) => setV((x) => ({ ...x, ...p }));
  const u = unis.find((x) => x.id === v.uni);
  const err = basicsErrors(v, u, courses);
  const bad = Object.values(err).some(Boolean);
  return (
    <Sheet
      open={!!f}
      onClose={onCancel}
      center
      className="iform"
      title="Add a course"
      sub={u ? `At ${u.name}. It’s saved as a Draft: add its intakes, fees and entry rules on its page, then publish it.` : 'It’s saved as a Draft: add its intakes, fees and entry rules on its page, then publish it.'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!bad) onSave(v);
                else (document.querySelector('.iform [aria-invalid="true"]') as HTMLElement | null)?.focus();
              }}
            >
              Add draft
            </Button>
          </div>
        </div>
      }
    >
      <BasicsFields v={v} set={set} u={u} unis={unis} err={err} show={tried} lockUni={lockUni} idp="ic" />
      {tried && bad && <ErrorText>Fix what’s marked, then add the draft.</ErrorText>}
    </Sheet>
  );
}

export { MIN_EDUCATION };
