import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput } from '../../components/forms';
import { AREAS, COURSES, DESTINATIONS, FLAG, LEVELS, UNIVERSITIES, daysTo, intakeState, money, type Course } from '../../data/courses';
import { shortDate } from '../../data/dates';
import { LEVEL_NAME, eduDocName, fullName, type Member, type Student } from '../../data/students';
import {
  STATUS,
  checkFit,
  courseOf,
  docsFor,
  keptOnProfile,
  nearMisses,
  newApplication,
  nextId,
  readDoc,
  stageOf,
  type AppDoc,
  type Application,
  type DocIssue,
  type Reason,
  type Verdict,
} from '../../data/applications';
import { campusLabel, UniMark } from '../courses/parts';
import { AddStudentSheet } from '../students/AddStudentSheet';
import { readMs } from '../students/ReadBox';
import type { RecordTab } from '../students/StudentRecord';
import { AssistLabel, AssistMark, StageTrack, Thinking } from './parts';
import { RPS, rpLabel, rpOf } from '../rps';

export type NewSeed = { studentId?: string; courseId?: string; intake?: string };
const ease = [0.2, 0.8, 0.2, 1] as const;
const CHECKS = ['Where they live', 'Academics', 'English', 'Intake'];
/** How long GSP Assist spends on each part of the check, so it's seen working through them. */
const CHECK_MS = 1200;
const NEW_STUDENT = '__new';
/** A document uploaded here: sent, then read by GSP Assist, then uploaded, or flagged to upload again (and why). */
type Up = { file: string; size: number; phase: 'sending' | 'reading' | 'ok' | 'flag'; pct: number; note?: string; issue?: DocIssue };
/** "statement of purpose", "CV", "10th marksheet": a document's name inside a sentence. */
const named = (n: string) => n.replace(/^[A-Z](?=[a-z])/, (x) => x.toLowerCase());
const MAX_MB = 10;
const TYPES = /\.(pdf|jpe?g|png)$/i;
const sizeText = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Starting an application takes three choices: the student (or a new one, added without leaving), the
 * course (by destination, university, program level and study area, or by name) and the intake. GSP Assist then checks the student
 * can be offered a place, with the reason for each part, and suggests close courses when they can't.
 * Documents: what this application asks for (the course's list, read for the student), reused from the profile
 * or uploaded here, read by GSP Assist as it arrives. Anything needed later, GSP asks for in the chat. Only hard rules stop it: a university that doesn't take students from
 * where they live, a closed intake, or the same application twice.
 */
export function NewApplication({
  open,
  seed,
  students,
  setStudents,
  team,
  nationality,
  apps,
  me,
  onClose,
  onOpenStudent,
  onCreate,
  onOpenApp,
}: {
  open: boolean;
  seed?: NewSeed;
  students: Student[];
  setStudents: (fn: (l: Student[]) => Student[]) => void;
  team: Member[];
  /** The agency's country, which a new student starts with. */
  nationality: string;
  apps: Application[];
  me: string;
  onClose: () => void;
  onOpenStudent: (id: string, tab?: RecordTab) => void;
  onCreate: (a: Application) => void;
  onOpenApp: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const [studentId, setStudentId] = useState(seed?.studentId ?? '');
  // GSP adds applications for a recruitment partner (30 Oct): whose comes first, and narrows the students to theirs
  const [rp, setRp] = useState(() => {
    const st = seed?.studentId ? students.find((x) => x.id === seed.studentId) : undefined;
    return st ? rpOf(st) : '';
  });
  const theirs = students.filter((x) => rpOf(x) === rp);
  const [courseId, setCourseId] = useState(seed?.courseId ?? '');
  const [intake, setIntake] = useState(seed?.intake ?? '');
  const [q, setQ] = useState('');
  // GSP Assist's check: which part it's on (all of them done once it reaches CHECKS.length)
  const [step, setStep] = useState(0);
  const [made, setMade] = useState<Application | null>(null);
  const [dest, setDest] = useState('');
  const [uni, setUni] = useState('');
  const [level, setLevel] = useState('');
  const [area, setArea] = useState('');
  // a new student is added in a sheet over this one, then picked here
  const [adding, setAdding] = useState<{ key: number; open: boolean }>({ key: 0, open: false });
  const [up, setUp] = useState<Partial<Record<string, Up>>>({});
  // a file that can't be used (type or size), said on its card until another is picked
  const [bad, setBad] = useState<Partial<Record<string, string>>>({});
  const s = students.find((x) => x.id === studentId);
  const c = COURSES.find((x) => x.id === courseId);
  const intakes = c ? c.intakes.filter((i) => intakeState(i) !== 'closed') : [];
  const courseRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  // set when a pick starts GSP Assist's check (the intake, or a course, which picks its intake): the check scrolls into view
  const [toCheck, setToCheck] = useState(0);

  // a course with one open intake takes it; otherwise the next open one is picked for you
  useEffect(() => {
    if (!c) return;
    if (!intakes.some((i) => i.month === intake)) setIntake((intakes.find((i) => intakeState(i) === 'open') ?? intakes[0])?.month ?? '');
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // GSP Assist checks once all three are picked, one part after another, so it's seen doing the work
  useEffect(() => {
    if (!s || !c || !intake) return;
    setStep(0);
    if (reduce) {
      const t = window.setTimeout(() => setStep(CHECKS.length), 250);
      return () => window.clearTimeout(t);
    }
    const id = window.setInterval(() => setStep((n) => Math.min(CHECKS.length, n + 1)), CHECK_MS);
    return () => window.clearInterval(id);
  }, [studentId, courseId, intake]); // eslint-disable-line react-hooks/exhaustive-deps
  const checking = !!(s && c && intake) && step < CHECKS.length;

  // bring GSP Assist's check to the top of the form once it has rendered (a course's intake is picked a render later)
  useEffect(() => {
    if (!toCheck) return;
    const t = window.setTimeout(() => {
      const el = formRef.current?.querySelector<HTMLElement>('.nacheck');
      const body = el?.closest<HTMLElement>('.sheet__body');
      if (!el || !body) return;
      body.scrollTo({ top: body.scrollTop + el.getBoundingClientRect().top - body.getBoundingClientRect().top - 16, behavior: reduce ? 'auto' : 'smooth' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [toCheck]); // eslint-disable-line react-hooks/exhaustive-deps

  const fit = s && c && intake ? checkFit(s, c, intake) : null;
  const hard = fit?.reasons.some((r) => r.ok === 'no' && (r.title === 'Where they live' || r.title === 'Intake'));
  const dupe = s && c ? apps.find((a) => a.studentId === s.id && a.courseId === c.id && a.intake === intake && a.status !== 'closed') : undefined;
  // what this application asks for: the course's documents, read for the student (required ones first)
  const docs = s && c ? docsFor(s, c).sort((x, y) => Number(y.need === 'required') - Number(x.need === 'required')) : [];
  const required = docs.filter((d) => d.need === 'required');
  const alts = useMemo(() => (s && c && fit && fit.verdict === 'Not eligible' ? nearMisses(s, c) : []), [studentId, courseId, intake, fit?.verdict]); // eslint-disable-line react-hooks/exhaustive-deps

  // courses to pick from: by destination, university, program level and study area, and any words typed
  const ql = q.trim().toLowerCase();
  const narrowed = !!(dest || uni || level || area || ql.length >= 2);
  const found = useMemo(() => {
    if (!narrowed) return [];
    const words = ql.split(/\s+/).filter((w) => w.length > 1);
    return COURSES.filter((x) => {
      if (dest && x.uni.country !== dest) return false;
      if (uni && x.uni.id !== uni) return false;
      if (level && x.level !== level) return false;
      if (area && x.area !== area) return false;
      const hay = `${x.name} ${x.uni.name} ${(x.uni.aka ?? []).join(' ')} ${x.campus.city}`.toLowerCase();
      return words.every((w) => hay.includes(w)) && x.intakes.some((i) => intakeState(i) !== 'closed');
    });
  }, [ql, dest, uni, level, area, narrowed]);

  // a file for a document: checked for type and size, sent (a progress bar), then read by GSP Assist
  const pickFile = (m: AppDoc, file: File | null) => {
    if (!file || !s) return;
    if (!TYPES.test(file.name)) return setBad((b) => ({ ...b, [m.key]: `${file.name} can’t be used. Upload a PDF, JPG or PNG.` }));
    if (file.size > MAX_MB * 1048576) return setBad((b) => ({ ...b, [m.key]: `${file.name} is ${sizeText(file.size)}. Upload one up to ${MAX_MB} MB.` }));
    setBad((b) => ({ ...b, [m.key]: undefined }));
    const mine = (x?: Up) => x?.file === file.name;
    setUp((u) => ({ ...u, [m.key]: { file: file.name, size: file.size, phase: 'sending', pct: 0 } }));
    const total = reduce ? 200 : 900;
    const t0 = performance.now();
    const tick = () => {
      const pct = Math.min(100, Math.round(((performance.now() - t0) / total) * 100));
      setUp((u) => (mine(u[m.key]) && u[m.key]!.phase === 'sending' ? { ...u, [m.key]: { ...u[m.key]!, pct, phase: pct >= 100 ? 'reading' : 'sending' } } : u));
      if (pct < 100) requestAnimationFrame(tick);
      else
        window.setTimeout(() => {
          const r = readDoc(file.name, m, s);
          setUp((u) => (mine(u[m.key]) ? { ...u, [m.key]: { ...u[m.key]!, phase: r.ok ? 'ok' : 'flag', note: r.note, issue: r.issue } } : u));
        }, readMs(reduce));
    };
    requestAnimationFrame(tick);
  };

  const start = () => {
    if (!s || !c || !intake || hard || dupe) return;
    // only what reads as right goes with it; one to upload again stays on the application's to-do list
    const sent = docs.filter((d) => up[d.key]?.phase === 'ok');
    const uploads = sent.map((d) => ({ key: d.key, name: d.name, file: up[d.key]!.file }));
    // the application keeps what it asked for: anything later is GSP's to ask for in the chat
    const a = { ...newApplication({ id: nextId(apps), s, c, intake, me, uploads, asks: docs }), rp: rpOf(s) };
    // the profile's documents (passport, marksheets, the score report, CV...) are kept there too, for the next application
    const keep = sent.filter((d) => keptOnProfile(d.key));
    if (keep.length)
      setStudents((l) =>
        l.map((x) => (x.id === s.id ? { ...x, docs: { ...x.docs, ...Object.fromEntries(keep.map((d) => [d.key, { name: d.level ? eduDocName(d.level) : d.name, file: up[d.key]!.file, status: 'uploaded' as const }])) } } : x)),
      );
    onCreate(a);
    setMade(a);
  };

  const ready = !!(s && c && intake && !checking);
  // where each step stands: done, the one to do now (the first not done), or still to come
  const docsDone = !!s && required.every((d) => (up[d.key] ? up[d.key]!.phase === 'ok' : !!s.docs[d.key]));
  const done = [!!s, !!c, !!(c && intake), !!fit && !checking, docsDone];
  const now = done.indexOf(false);
  const stateOf = (i: number): StepState => (done[i] ? 'done' : i === now ? 'now' : 'next');
  const footer = made ? (
    <div className="asf">
      <p className="asf__note">It’s in Applications, and on {s?.first}’s profile.</p>
      <div className="asf__acts">
        <Button
          variant="secondary"
          onClick={() => {
            setMade(null);
            setCourseId('');
            setIntake('');
            setQ('');
            setUp({});
            setBad({});
          }}
        >
          Add another for {s?.first}
        </Button>
        <Button onClick={() => onOpenApp(made.id)} iconRight={<Icon name="arrowRight" size={18} />}>
          Open application
        </Button>
      </div>
    </div>
  ) : (
    <div className="asf">
      <p className="asf__note">
        {!s
          ? 'Pick a student to start.'
          : !c
            ? 'Pick a course.'
            : dupe
              ? `${s.first} already has this application.`
              : hard
                ? 'This one can’t go ahead: see why above.'
                : fit?.verdict === 'Not eligible'
                  ? 'You can still start it, but the university will likely say no.'
                  : ''}
      </p>
      <div className="asf__acts">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={start} disabled={!ready || !!hard || !!dupe}>
          {fit?.verdict === 'Not eligible' && !hard ? 'Start anyway' : 'Start application'}
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      expandable
      className="naw"
      title={made ? 'Application started' : 'Add an application'}
      sub={made ? undefined : 'Pick the student, the course and the intake. GSP Assist checks eligibility before anything is sent.'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {made && s ? (
          <motion.div key="done" className="nadone" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}>
            <motion.span className="nadone__mark" aria-hidden="true" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.05 }}>
              <svg width="34" height="34" viewBox="0 0 24 24">
                <motion.path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.2, ease }} />
              </svg>
            </motion.span>
            <p className="nadone__id num">{made.id}</p>
            <h3 className="nadone__title">
              {fullName(s)} · {courseOf(made).name}
            </h3>
            <p className="nadone__text">
              {made.status === 'checking'
                ? 'Sent to GSP. GSP checks the documents, usually within the hour, then submits to the university.'
                : 'Waiting for documents.'}
            </p>
            <div className="nadone__track">
              <StageTrack stage={stageOf(made)} owner={STATUS[made.status].owner} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" ref={formRef} className="nasheet" initial={false} exit={{ opacity: 0 }}>
            {/* 1. the student */}
            <Step id="na-s1" n={1} title="Student" state={stateOf(0)}>
              <Field id="na-rp" required label="Recruitment partner">
                <SelectInput
                  id="na-rp"
                  value={rp}
                  placeholder="Choose the recruitment partner"
                  onChange={(e) => {
                    setRp(e.target.value);
                    if (s && rpOf(s) !== e.target.value) setStudentId('');
                  }}
                >
                  {RPS.map((r) => (
                    <option key={r.name} value={r.name}>
                      {rpLabel(r)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              {!rp ? (
                <p className="nanone__hint">Choose the recruitment partner first: their students show here.</p>
              ) : theirs.length === 0 ? (
                <div className="nanone">
                  <p>No students for {rp} yet. Add one here: it takes a minute, and you carry on with this application.</p>
                  <Button variant="secondary" iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding({ key: Date.now(), open: true })}>
                    Add a new student
                  </Button>
                </div>
              ) : (
                <>
                  <Field id="na-student" label="Who is this application for?">
                    <SelectInput
                      id="na-student"
                      value={studentId}
                      placeholder="Pick a student"
                      onChange={(e) => {
                        if (e.target.value === NEW_STUDENT) return setAdding({ key: Date.now(), open: true });
                        setStudentId(e.target.value);
                        if (c && intake) setToCheck(Date.now());
                      }}
                    >
                      {[...theirs]
                        .sort((a, b) => fullName(a).localeCompare(fullName(b)))
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {fullName(x)} · {x.id}
                          </option>
                        ))}
                      <option value={NEW_STUDENT}>+ Add a new student</option>
                    </SelectInput>
                  </Field>
                  {/* no summary of the profile here: GSP Assist's eligibility check says what it used */}
                  {!s && (
                    <button type="button" className="btn btn--link nanew" onClick={() => setAdding({ key: Date.now(), open: true })}>
                      <Icon name="plus" size={16} /> Not in the list? Add a new student
                    </button>
                  )}
                </>
              )}
            </Step>

            {/* 2. the course */}
            <Step id="na-s2" n={2} title="Course" state={stateOf(1)}>
              {c ? (
                <div className="nacourse">
                  <UniMark u={c.uni} />
                  <div className="nacourse__t">
                    <p className="nacourse__name">{c.name}</p>
                    <p className="nacourse__meta">
                      {c.uni.name} · {campusLabel(c.campus)} · <span aria-hidden="true">{FLAG[c.uni.country]}</span> {c.uni.country}
                    </p>
                    <p className="nacourse__meta num">
                      {money(c.tuition, c.currency)} a year · IELTS {c.ielts[0].toFixed(1)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCourseId('');
                      setIntake('');
                      window.setTimeout(() => courseRef.current?.focus(), 30);
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="nafind">
                    <Field id="na-dest" label="Destination">
                      <SelectInput
                        id="na-dest"
                        value={dest}
                        placeholder="Any destination"
                        allowEmpty
                        onChange={(e) => {
                          setDest(e.target.value);
                          // a university elsewhere no longer fits
                          if (uni && UNIVERSITIES.find((u) => u.id === uni)?.country !== e.target.value && e.target.value) setUni('');
                        }}
                      >
                        {DESTINATIONS.map((d) => (
                          <option key={d} value={d}>
                            {FLAG[d]} {d}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field id="na-uni" label="University">
                      <SelectInput id="na-uni" value={uni} placeholder="Any university" allowEmpty onChange={(e) => setUni(e.target.value)}>
                        {DESTINATIONS.filter((d) => !dest || d === dest).map((d) => (
                          <optgroup key={d} label={d}>
                            {UNIVERSITIES.filter((u) => u.country === d)
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field id="na-level" label="Program Level">
                      <SelectInput id="na-level" value={level} placeholder="Any level" allowEmpty onChange={(e) => setLevel(e.target.value)}>
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field id="na-area" label="Study Area">
                      <SelectInput id="na-area" value={area} placeholder="Any area" allowEmpty onChange={(e) => setArea(e.target.value)}>
                        {AREAS.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                  <label className="ssearch nasearch">
                    <Icon name="search" size={18} />
                    <span className="vh">Course name</span>
                    <input ref={courseRef} id="na-course" type="search" placeholder="Course name, like “data science”" value={q} onChange={(e) => setQ(e.target.value)} />
                  </label>
                  {narrowed && found.length > 0 && (
                    <div className="napick">
                      <p className="napick__k" id="na-found">
                        {found.length} {found.length === 1 ? 'course' : 'courses'} with an open intake
                      </p>
                      {/* the list scrolls inside itself, so the steps below stay where they are */}
                      <ul className="napick__list" aria-labelledby="na-found" tabIndex={found.length > 5 ? 0 : undefined}>
                        {found.map((x) => (
                          <li key={x.id}>
                            <button
                              type="button"
                              className="napick__opt"
                              onClick={() => {
                                setCourseId(x.id);
                                if (s) setToCheck(Date.now());
                              }}
                            >
                              <UniMark u={x.uni} />
                              <span className="napick__t">
                                <span className="napick__name">{x.name}</span>
                                <span className="napick__uni">
                                  {x.uni.name} · {x.level} · {x.uni.country}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {narrowed && found.length === 0 && <p className="nahint">No courses with an open intake match. Try another destination, program level or study area, or fewer words.</p>}
                  {!narrowed && <p className="nahint">Pick a destination, university, program level or study area, or type the course name.</p>}
                </>
              )}
            </Step>

            {/* 3. the intake */}
            <Step id="na-s3" n={3} title="Intake" state={stateOf(2)} waiting={!c}>
              {c ? (
                <>
                  <div className="naintakes" role="radiogroup" aria-labelledby="na-s3">
                    {intakes.map((i) => {
                      const st = intakeState(i);
                      const d = daysTo(i.deadline);
                      const on = intake === i.month;
                      return (
                        <label key={i.month} className={`naintake ${on ? 'is-on' : ''}`}>
                          <input
                            type="radio"
                            name="na-intake"
                            value={i.month}
                            checked={on}
                            onChange={() => {
                              setIntake(i.month);
                              if (s) setToCheck(Date.now());
                            }}
                          />
                          <span className="naintake__ic" aria-hidden="true">
                            <Icon name="calendar" size={18} />
                          </span>
                          <span className="naintake__t">
                            <span className="naintake__m">{i.month}</span>
                            <span className={`naintake__s ${st === 'open' && d <= 21 ? 'is-soon' : ''}`}>{st === 'open' ? `Closes ${shortDate(new Date(i.deadline))}` : 'Likely to open'}</span>
                          </span>
                          {on && (
                            <span className="naintake__tick" aria-hidden="true">
                              <Icon name="check" size={12} strokeWidth={3} />
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {dupe && (
                    <div className="dupe">
                      <p className="dupe__t">
                        {s?.first} already has this application: <strong className="num">{dupe.id}</strong>, {STATUS[dupe.status].text(c.uni.country).toLowerCase()}.
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => onOpenApp(dupe.id)}>
                        Open {dupe.id}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="nahint">The course’s open intakes show here once it’s picked.</p>
              )}
            </Step>

            {/* GSP Assist's check: what it looks at, each part in turn, then the verdict with a reason for each */}
            {!(s && c && intake) && (
              <Step id="na-check-title" title="Eligibility" state="next" waiting>
                <p className="nahint">GSP Assist checks it once the student, the course and the intake are picked.</p>
              </Step>
            )}
            {s && c && intake && (
              <Step
                id="na-check-title"
                state={stateOf(3)}
                card={`card nacheck ${checking ? 'is-checking' : `is-${verdictKey(fit!.verdict)}`}`}
                busy={checking}
              >
                <AssistLabel eyebrow busy={checking} note="Eligibility" />
                <p className="nacheck__what" id="na-check-title">
                  {checking
                    ? `GSP Assist is checking ${s.first}’s profile details against ${c.uni.name}’s requirements for the ${c.name}, to see if ${s.first} is eligible.`
                    : `GSP Assist checked ${s.first}’s profile details against ${c.uni.name}’s requirements for the ${c.name}.`}
                </p>
                {checking ? (
                  <div className="nacheck__run" role="status">
                    <Thinking text={`Checking ${s.first}’s eligibility, one requirement at a time…`} />
                    <ol className="nacheck__steps">
                      {CHECKS.map((k, i) => (
                        <li key={k} className={`nacheck__step ${i < step ? 'is-done' : i === step ? 'is-now' : ''}`}>
                          <span className="nacheck__tick" aria-hidden="true">
                            {i < step ? <Icon name="check" size={12} strokeWidth={3} /> : i === step ? <span className="nacheck__spin" /> : null}
                          </span>
                          <span className="nacheck__k">{k}</span>
                          <span className="nacheck__v">{i < step ? 'Checked' : i === step ? checkingLine(k, s, c, intake) : 'Next'}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease }}>
                    {/* no headline over the reasons: each part says where it stands; screen readers hear the outcome */}
                    <p className="vh" id="na-check">
                      {fit!.verdict}
                    </p>
                    <ul className="nareasons">
                      {fit!.reasons.map((r, i) => (
                        <ReasonRow
                          key={r.title}
                          r={r}
                          i={i}
                          // details to complete: straight to that part of the profile
                          onFix={r.ok === 'add' && (r.title === 'Academics' || r.title === 'English') ? () => onOpenStudent(s.id, r.title === 'English' ? 'tests' : 'education') : undefined}
                        />
                      ))}
                    </ul>
                    {alts.length > 0 && (
                      <div className="naalts">
                        <p className="naalts__k">Close courses {s.first} can be offered</p>
                        <ul className="naalts__list">
                          {alts.map((m) => (
                            <li key={m.c.id} className="naalt">
                              <UniMark u={m.c.uni} />
                              <span className="naalt__t">
                                <span className="naalt__name">{m.c.name}</span>
                                <span className="naalt__uni">
                                  {m.c.uni.name} · {m.intake} · {m.fit.verdict}
                                </span>
                              </span>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setCourseId(m.c.id);
                                  setIntake(m.intake);
                                  setToCheck(Date.now());
                                }}
                              >
                                Use this
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </Step>
            )}

            {/* 4. documents: what this application asks for, from the profile or uploaded here */}
            {!(s && c && !checking && intake) && (
              <Step id="na-docs" n={4} title="Documents" state="next" waiting>
                <p className="nahint">After the eligibility check: what the university asks for with this course.</p>
              </Step>
            )}
            {s && c && !checking && intake && !dupe && (
              <Documents
                state={stateOf(4)}
                s={s}
                c={c}
                docs={docs}
                up={up}
                bad={bad}
                onFile={pickFile}
                onRemove={(m) => {
                  setUp((u) => ({ ...u, [m.key]: undefined }));
                  setBad((b) => ({ ...b, [m.key]: undefined }));
                }}
              />
            )}

          </motion.div>
        )}
      </AnimatePresence>
      {/* the actions come at the end of the form, where it's been read, rather than in a bar held at the bottom */}
      <div className="naend">{footer}</div>
      {adding.key > 0 && (
        <AddStudentSheet
          key={adding.key}
          open={adding.open}
          onClose={() => setAdding((a) => ({ ...a, open: false }))}
          list={students}
          team={team}
          me={me}
          nationality={nationality}
          forApplication
          rp={rp}
          onAdded={(st) => {
            setStudents((l) => [st, ...l]);
            setRp(rpOf(st));
            setStudentId(st.id);
            setAdding((a) => ({ ...a, open: false }));
          }}
          onOpenStudent={(st) => {
            setRp(rpOf(st));
            setStudentId(st.id);
            setAdding((a) => ({ ...a, open: false }));
          }}
        />
      )}
    </Sheet>
  );
}

type StepState = 'done' | 'now' | 'next';
/**
 * One step of the form: a stage has its marker on the rail at the left (its number, a tick once it's done),
 * then its own card: a title over a line, then what's in it. What isn't a stage (GSP Assist's check) has no
 * number and no marker; the rail runs past it. The step to do now is lifted; a step
 * that can't start yet (`waiting`) is a dashed outline with a line on what unlocks it. A card without a
 * title (GSP Assist's check) brings its own heading.
 */
function Step({
  id,
  n,
  title,
  meta,
  state,
  waiting = false,
  card = '',
  busy,
  children,
}: {
  id: string;
  n?: number;
  title?: string;
  meta?: ReactNode;
  state: StepState;
  waiting?: boolean;
  card?: string;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`nastep is-${state} ${waiting ? 'is-waiting' : ''} ${n ? '' : 'nastep--bare'}`} aria-labelledby={id} aria-busy={busy}>
      {n && (
        <span className="nastep__mark" aria-hidden="true">
          {state === 'done' ? <Icon name="check" size={16} strokeWidth={2.6} /> : n}
        </span>
      )}
      <div className={`nastep__card ${card}`}>
        {title ? (
          <>
            <header className="nastep__head">
              <h3 className="nastep__title" id={id}>
                {n && <span className="vh">Step {n}: </span>}
                {title}
                {state === 'done' && n && <span className="vh"> (done)</span>}
              </h3>
              {meta}
            </header>
            <div className="nastep__body">{children}</div>
          </>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

const verdictKey = (v: Verdict) => (v === 'Eligible' ? 'yes' : v === 'Eligible with conditions' ? 'warn' : v === 'Not eligible' ? 'no' : 'add');
/** What GSP Assist is looking at, for each part of the check, while it checks. */
function checkingLine(k: string, s: Student, c: Course, intake: string) {
  const uni = c.uni.name.replace(/^University of (the )?/, '');
  if (k === 'Where they live') return `Does ${uni} take students from ${s.country}?`;
  if (k === 'Academics') return `${s.first}’s ${LEVEL_NAME[s.highest].toLowerCase()} result against the ${c.academic}% ${uni} asks for`;
  if (k === 'English') return `${s.first}’s English test against IELTS ${c.ielts[0].toFixed(1)} or PTE ${c.pte[0]}`;
  return `Is the ${intake} intake open?`;
}

function ReasonRow({ r, i, onFix }: { r: Reason; i: number; onFix?: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.li className={`nareason nareason--${r.ok}`} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease, delay: 0.08 + i * 0.07 }}>
      <span className="nareason__ic" aria-hidden="true">
        <Icon name={r.ok === 'yes' ? 'check' : r.ok === 'warn' ? 'info' : r.ok === 'no' ? 'close' : 'edit'} size={14} strokeWidth={2.4} />
      </span>
      <span className="nareason__k">{r.title}</span>
      <span className="nareason__v">
        {r.text}
        {onFix && (
          <>
            {' '}
            <button type="button" className="btn btn--link nareason__fix" onClick={onFix}>
              Open the profile
            </button>
          </>
        )}
      </span>
    </motion.li>
  );
}

/**
 * The documents step: each marksheet on its own card, numbered, with what it is and whether it's needed. A
 * card is a drop zone until a file is in; then the file with its size, a progress bar while it's sent, GSP
 * Assist reading it, and what it read (or why it needs another look), with Replace and Remove. What's on the
 * student's profile is used as it is, and can be swapped for another file.
 */
function Documents({
  state,
  s,
  c,
  docs,
  up,
  bad,
  onFile,
  onRemove,
}: {
  state: StepState;
  s: Student;
  c: Course;
  docs: AppDoc[];
  up: Partial<Record<string, Up>>;
  bad: Partial<Record<string, string>>;
  onFile: (d: AppDoc, f: File | null) => void;
  onRemove: (d: AppDoc) => void;
}) {
  const required = docs.filter((d) => d.need === 'required');
  const ready = required.filter((d) => (up[d.key] ? up[d.key]!.phase === 'ok' : !!s.docs[d.key])).length;
  return (
    <Step
      id="na-docs"
      n={4}
      title="Documents"
      state={state}
      meta={
        <span className="nadocs2__count" aria-live="polite">
          <span className="num">{ready}</span> of <span className="num">{required.length}</span> required ready
        </span>
      }
    >
      <div className="nadocs2__bar" aria-hidden="true">
        <motion.span initial={false} animate={{ width: `${required.length ? (ready / required.length) * 100 : 100}%` }} transition={{ duration: 0.4, ease }} />
      </div>
      <p className="nahint">
        What {c.uni.name} asks for with this course, for {s.first}’s education. Anything needed later, GSP asks for in the chat. Add each as a PDF, JPG or PNG, up to {MAX_MB} MB; what’s on {s.first}’s profile is
        used from there. GSP verifies every one for this application, those from the profile too.
      </p>
      <ol className="mdocs">
        {docs.map((d, i) => (
          <DocCard key={d.key} n={i + 1} d={d} s={s} u={up[d.key]} bad={bad[d.key]} onFile={(f) => onFile(d, f)} onRemove={() => onRemove(d)} />
        ))}
      </ol>
    </Step>
  );
}

function DocCard({ n, d, s, u, bad, onFile, onRemove }: { n: number; d: AppDoc; s: Student; u?: Up; bad?: string; onFile: (f: File | null) => void; onRemove: () => void }) {
  const reduce = useReducedMotion();
  const id = `na-doc-${d.key}`;
  const need = d.need === 'required';
  const [over, setOver] = useState(false);
  const onProfile = !u ? s.docs[d.key] : undefined;
  const state = u ? u.phase : onProfile ? 'profile' : 'empty';
  const pill =
    state === 'ok'
      ? ['Uploaded', 'ok']
      : state === 'profile'
        ? ['Ready', 'ok']
        : state === 'flag'
          ? ['Re-upload', 'warn']
        : state === 'sending'
          ? ['Uploading', 'send']
          : state === 'reading'
            ? ['Reading', 'busy']
            : need
              ? ['Not added', 'todo']
              : ['Optional', 'opt'];
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFile(e.dataTransfer.files?.[0] ?? null);
  };
  const input = (
    <input
      id={id}
      className="vh"
      type="file"
      accept=".pdf,.jpg,.jpeg,.png"
      aria-label={`Upload the ${named(d.name)}`}
      aria-describedby={bad ? `${id}-err` : undefined}
      onChange={(e) => {
        onFile(e.target.files?.[0] ?? null);
        e.target.value = '';
      }}
    />
  );
  return (
    <li className={`mdoc mdoc--${state}`}>
      <div className="mdoc__head">
        <span className="mdoc__n" aria-hidden="true">
          {state === 'ok' || state === 'profile' ? <Icon name="check" size={14} strokeWidth={2.6} /> : n}
        </span>
        <div className="mdoc__t">
          <p className="mdoc__name">
            {d.name}
            <span className="mdoc__need">{need ? 'Required' : 'Optional'}</span>
          </p>
          <p className="mdoc__what">{d.what}</p>
        </div>
        <span className={`mdoc__pill mdoc__pill--${pill[1]}`}>{pill[0]}</span>
      </div>

      {state === 'empty' ? (
        <label
          className={`mdrop ${over ? 'is-over' : ''} ${bad ? 'is-bad' : ''}`}
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <span className="mdrop__ic" aria-hidden="true">
            <Icon name="upload" size={20} />
          </span>
          <span className="mdrop__t">
            <span className="mdrop__main">
              Drop the file here, or <span className="mdrop__link">browse</span>
            </span>
            <span className="mdrop__sub">PDF, JPG or PNG · up to {MAX_MB} MB</span>
          </span>
          {input}
        </label>
      ) : (
        <div className="mfile">
          <span className="mfile__ic" aria-hidden="true">
            {state === 'reading' ? <AssistMark size={18} motion="busy" /> : <Icon name="file" size={18} />}
          </span>
          <div className="mfile__t">
            <p className="mfile__name">
              <span className="mfile__file">{u ? u.file : onProfile!.file}</span>
              {u && <span className="mfile__size">{sizeText(u.size)}</span>}
            </p>
            {state === 'sending' ? (
              <div className="mfile__prog" role="progressbar" aria-label={`Uploading the ${named(d.name)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={u!.pct}>
                <span style={{ width: `${u!.pct}%` }} />
              </div>
            ) : state === 'reading' ? (
              <p className="mfile__note is-ai">GSP Assist is reading it…</p>
            ) : state === 'profile' ? (
              <p className="mfile__note">From {s.first}’s profile</p>
            ) : (
              <motion.p className={`mfile__note ${state === 'ok' ? 'is-ok' : 'is-warn'}`} initial={reduce ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }}>
                <Icon name={state === 'ok' ? 'checkCircle' : 'alert'} size={14} />
                {u!.note}
              </motion.p>
            )}
          </div>
          {state !== 'sending' && state !== 'reading' && (
            <span className="mfile__acts">
              <label className={`btn btn--${state === 'flag' ? 'primary' : 'secondary'} btn--sm`} htmlFor={id}>
                {state === 'profile' ? 'Use another file' : state === 'flag' ? 'Re-upload' : 'Replace'}
              </label>
              {u && (
                <button type="button" className="mfile__x" aria-label={`Remove ${u.file}`} onClick={onRemove}>
                  <Icon name="close" size={16} />
                </button>
              )}
              {input}
            </span>
          )}
        </div>
      )}
      {bad && (
        <p className="mdoc__err" id={`${id}-err`} role="alert">
          <Icon name="alert" size={14} />
          {bad}
        </p>
      )}
    </li>
  );
}
