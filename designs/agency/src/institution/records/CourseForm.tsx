import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { AREAS, LEVELS, type Area, type Course, type Level, type StudyMode } from '../../data/courses';
import { campusLabel } from '../courses/parts';
import type { CourseRec, UniRec } from '../data/catalogue';
import { todayIso } from '../data/records';

/**
 * Adding a course (29 Oct, 4th round; 6th round as in the PM prototype). It asks for the basics only (university,
 * campus, name, code, level, study area, mode) and saves a draft; its duration, intakes, fees and academic and English
 * rules are entered in the tabs of its page, and it's published once they're there. On Courses and, in place, on a
 * university's page.
 */
export type CourseDraft = { uni: string; campus: string; name: string; code: string; level: Level | ''; area: Area | ''; mode: StudyMode };
export const blankCourse: CourseDraft = { uni: '', campus: '', name: '', code: '', level: '', area: '', mode: 'Full time' };

/**
 * What a course still needs before it can be published (Jovial, 31 Oct): only an intake with its application
 * deadline. Everything else shows as "Not added" in Course search until the team enters it.
 */
export const missingOf = (c: CourseRec) =>
  [
    [c.intakes.length > 0 && c.intakes.some((i) => !!i.deadline), 'an intake with its application deadline'],
    // slice 3 PRD (S3-18): required on new and edited courses, on the Academic tab
    [!!c.minHighestEducation, 'the minimum highest education required (Academic)'],
  ]
    .filter(([ok]) => !ok)
    .map(([, k]) => k as string);

/** A new course from the basics: a draft, everything else still to enter. */
export function newCourse(f: CourseDraft, unis: UniRec[], courses: CourseRec[]): CourseRec {
  const u = unis.find((x) => x.id === f.uni)!;
  const campus = u.campuses.find((x) => x.name === f.campus) ?? u.campuses[0];
  // fields the institution pages don't show (documents, other costs) start from a course like it, for Course search
  const like: Course = courses.find((c) => c.uni.id === u.id && c.level === f.level) ?? courses.find((c) => c.uni.country === u.country) ?? courses[0];
  return {
    ...like,
    id: `${u.id}-new-${Date.now().toString(36)}`,
    // asked for on the Academic tab (S3-18); a new course starts without it
    minHighestEducation: undefined,
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
    academicRules: [],
    ielts: [0, 0],
    pte: [0, 0],
    toefl: [0, 0],
    englishRules: [],
    englishFlex: false,
    deposit: 0,
    scholarship: 0,
    scholarshipName: undefined,
    cricos: undefined,
    rate: u.rate,
    // the day it was added; the team sets the date it was last checked on its Basics (HC3)
    checked: todayIso(),
    status: 'Draft',
    source: 'Added by hand',
    stamps: {},
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
      sub="The basics. It’s saved as a draft: fill in its intakes, fees, academic and English on its page, then publish it."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (Object.values(err).every((e) => !e)) onSave({ ...v, campus });
              }}
            >
              Save
            </Button>
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
