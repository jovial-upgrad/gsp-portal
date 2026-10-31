import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { Toast } from '../../components/Toast';
import { MoreMenu } from '../../components/MoreMenu';
import { LEVELS, LEVEL_NAME, TESTS, TEST_ORDER, eduDocKey, eduDocName, fullName, levelsFor, readiness, type Member, type Student } from '../../data/students';
import { COURSES, FLAG, UNIVERSITIES, money } from '../../data/courses';
import { UniMark, campusLabel } from '../courses/parts';
import { Avatar, CopyButton, OWNER, Ring, addedLabel, copyText } from './parts';
import { Personal } from './record/Personal';
import { Education } from './record/Education';
import { Work } from './record/Work';
import { Tests } from './record/Tests';
import { Background } from './record/Background';
import { Documents } from './record/Documents';
import type { Update } from './record/fields';
import { addJob, addLevel, addTest } from './record/read';
import '../../screens/students/record/record.css';

const ease = [0.2, 0.8, 0.2, 1] as const;
let seq = 1;

export type RecordTab = 'personal' | 'education' | 'work' | 'tests' | 'background' | 'documents' | 'applications' | 'shortlist';
/** The menu: three things (Nesil, 29 Oct). Personal details and Applications have tabs inside, knowingly against the "no tabs inside tabs" Decision. */
type Group = 'details' | 'documents' | 'apps';
const GROUPS: [Group, string, IconName][] = [
  ['details', 'Personal details', 'user'],
  ['documents', 'Documents', 'folder'],
  ['apps', 'Applications', 'doc'],
];
const DETAIL_TABS: [Editable, string][] = [
  ['personal', 'Personal'],
  ['education', 'Academics'],
  ['tests', 'English test'],
  ['work', 'Work experience'],
  ['background', 'Background'],
];
const APP_TABS: [RecordTab, string][] = [
  ['applications', 'My applications'],
  ['shortlist', 'Shortlisted'],
];
const groupOf = (t: RecordTab): Group => (t === 'documents' ? 'documents' : t === 'applications' || t === 'shortlist' ? 'apps' : 'details');
const LABEL: Record<RecordTab, string> = { personal: 'Personal', education: 'Academics', tests: 'English test', work: 'Work experience', background: 'Background', documents: 'Documents', applications: 'My applications', shortlist: 'Shortlisted' };
type Editable = 'personal' | 'education' | 'work' | 'tests' | 'background';
const EDITABLE: RecordTab[] = ['personal', 'education', 'work', 'tests', 'background'];
const isEditable = (k: RecordTab): k is Editable => EDITABLE.includes(k);

/** A section with something saved in it reads as text, with Edit; an empty one opens ready to fill in. */
const hasData = (k: Editable, s: Student) =>
  k === 'personal'
    ? // the passport's own details, or the passport: before either, it opens ready to upload the passport
      !!(s.docs.passport || s.dob || s.gender || s.city)
    : k === 'education'
      ? Object.values(s.edu).some((e) => !!(e.level || e.institution || e.qualification || e.score))
      : k === 'work'
        ? s.work.length > 0
        : k === 'tests'
          ? s.tests.length > 0
          : !!(s.visa || s.disability);

/** What each section owns, so saving one section never touches another (or what an upload read meanwhile). */
const OWN: Record<Editable, (keyof Student)[]> = {
  personal: ['first', 'last', 'oneName', 'nationality', 'passport', 'dob', 'gender', 'email', 'dial', 'phone', 'country', 'state', 'city'],
  education: ['eduCountry', 'highest', 'edu'],
  work: ['work'],
  tests: ['tests'],
  background: ['visa', 'visaNote', 'disability', 'disabilityNote'],
};
// the resume read in Work experience is kept as the CV in Additional documents
const OWN_DOCS: Partial<Record<Editable, (key: string) => boolean>> = { personal: (x) => x === 'passport', education: (x) => x.startsWith('edu-'), work: (x) => x === 'cv', tests: (x) => x.startsWith('test-') };
function merge(k: Editable, p: Student, d: Student): Student {
  const out = { ...p } as Record<string, unknown>;
  OWN[k].forEach((f) => (out[f] = d[f]));
  const own = OWN_DOCS[k];
  const docs = own ? { ...Object.fromEntries(Object.entries(p.docs).filter(([x]) => !own(x))), ...Object.fromEntries(Object.entries(d.docs).filter(([x]) => own(x))) } : p.docs;
  return { ...(out as Student), docs, read: [...new Set([...p.read, ...d.read])] };
}
const without = <T extends object>(o: T, k: keyof T): T => {
  const c = { ...o };
  delete c[k];
  return c;
};

/** A line under the title, where one helps (Nesil, 29 Oct: none on the parts of Personal details). */
const INTRO: Partial<Record<RecordTab, string>> = {
  documents: 'Every document uploaded for the student, by the part it belongs to, kept once and reused on every application.',
  applications: 'Every application for this student, and who has it now.',
  shortlist: 'Courses shortlisted for this student in Find courses.',
};

/**
 * A student's record: everything an application needs. Above it, back to Students and Share with student
 * (a link for the student to add their own details). The header says who the student is, their contact and
 * counsellor, Find courses and Start application, and how ready the profile is. A just-added student's profile says
 * so in a notification, bottom left ("Nesil Noble added · Complete the student's profile"), for a few seconds. Documents uploaded all at once in Add a
 * student are already filed and read into their parts.
 * The menu has three things (Nesil, 29 Oct): **Personal details**, in tabs (Personal, Academics, English test, Work
 * experience, Background), each saying whether it's complete, incomplete or optional; **Documents**, every document
 * on the profile and only there; and **Applications**, in tabs (My applications, Shortlisted). A part of Personal
 * details with something saved reads as text until Edit; editing works on a draft that Save keeps and Cancel throws
 * away. The first time, before a part has its document or details, uploading the document fills it in. Adding to a
 * part (a level, a job, a test) is at its top and opens it for editing. Documents save straight away.
 */
export function StudentRecord({
  s,
  list,
  update,
  team,
  tab,
  setTab,
  fresh,
  onDismissFresh,
  onBack,
  onFindCourses,
  onCounsellor: _onCounsellor,
  onOpenApp,
  onNewApp,
  say,
}: {
  s: Student;
  list: Student[];
  update: Update;
  team: Member[];
  tab: RecordTab;
  setTab: (t: RecordTab) => void;
  /** Just added: say so, and what's next. */
  fresh: boolean;
  onDismissFresh: () => void;
  onBack: () => void;
  onFindCourses: (s: Student) => void;
  onCounsellor: (s: Student, id: string) => void;
  /** Opens one of the student's applications, or starts a new one for them (for a shortlisted course, with it). */
  onOpenApp?: (id: string) => void;
  onNewApp?: (s: Student, courseId?: string) => void;
  say: (m: string) => void;
}) {
  const reduce = useReducedMotion();
  const r = readiness(s);
  const [saved, setSaved] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  useEffect(() => {
    if (!linkCopied) return;
    const t = window.setTimeout(() => setLinkCopied(false), 2400);
    return () => window.clearTimeout(t);
  }, [linkCopied]);
  const panel = useRef<HTMLDivElement>(null);
  // sections open for editing, and their unsaved drafts (kept while switching tabs, until Save or Cancel)
  const [editing, setEditing] = useState<Partial<Record<Editable, boolean>>>({});
  const [drafts, setDrafts] = useState<Partial<Record<Editable, Student>>>({});
  useEffect(() => {
    setEditing({});
    setDrafts({});
  }, [s.id]);
  const group = groupOf(tab);
  // the tab each group last showed, so coming back to it lands there
  const last = useRef<Partial<Record<Group, RecordTab>>>({});
  last.current[group] = tab;

  // uploads and saved sections show "Saved" in the header for a moment
  const save: Update = (fn) => {
    update(fn);
    setSaved(Date.now());
  };
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(null), 1800);
    return () => window.clearTimeout(t);
  }, [saved]);

  const first = (g: Group): RecordTab => last.current[g] ?? (g === 'details' ? 'personal' : g === 'documents' ? 'documents' : 'applications');
  const pick = (g: Group) => {
    setTab(first(g));
    const top = panel.current?.closest('.rbody')?.getBoundingClientRect().top ?? 0;
    if (top < 0) panel.current?.closest('.rbody')?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  };
  const onKey = (e: KeyboardEvent) => {
    const i = GROUPS.findIndex(([k]) => k === group);
    const to = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (i + 1) % GROUPS.length : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (i - 1 + GROUPS.length) % GROUPS.length : e.key === 'Home' ? 0 : e.key === 'End' ? GROUPS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(first(GROUPS[to][0]));
    document.getElementById(`rtab-${GROUPS[to][0]}`)?.focus();
  };
  /** The tabs inside a group: arrows move along them. */
  const onSubKey = (tabs: [RecordTab, string][]) => (e: KeyboardEvent) => {
    const i = tabs.findIndex(([k]) => k === tab);
    const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(tabs[to][0]);
    document.getElementById(`rsub-${tabs[to][0]}`)?.focus();
  };
  const sec = isEditable(tab) ? tab : null;
  const mode = sec ? (editing[sec] || !hasData(sec, s) ? 'edit' : 'view') : null;
  const shown = (sec && drafts[sec]) || s;
  const draftUpdate: Update = (fn) => sec && setDrafts((d) => ({ ...d, [sec]: fn(d[sec] ?? s) }));
  const sectionUpdate: Update = mode === 'edit' ? draftUpdate : () => undefined;
  const startEdit = (k: Editable) => {
    setEditing((e) => ({ ...e, [k]: true }));
    // straight into the first field
    window.setTimeout(() => panel.current?.querySelector<HTMLElement>('.rform input:not([type=file]):not([type=hidden]):not(.vh):not([disabled]), .rform select')?.focus(), 60);
  };
  /** Adds to a section from its top (a level, a job, a test): opens it for editing with the addition in the draft. */
  const act = (k: Editable, fn: (p: Student) => Student, focus: string) => {
    setEditing((e) => ({ ...e, [k]: true }));
    setDrafts((d) => ({ ...d, [k]: fn(d[k] ?? s) }));
    window.setTimeout(() => document.getElementById(focus)?.focus(), 80);
  };
  /** What a section adds from its top: a level of education, a job, a test. */
  const adder = (k: Editable) => {
    const d = drafts[k] ?? s;
    if (k === 'education') {
      // the levels not on the record yet; one above the highest becomes the highest, and so required
      const open = (l: (typeof LEVELS)[number]) => levelsFor(d.highest).includes(l) && (l === d.highest || !!d.edu[l] || !!d.docs[eduDocKey(l)]);
      const left = LEVELS.filter((l) => !open(l));
      return left.length ? (
        <MoreMenu
          id="radd-edu"
          label="Add education"
          text="Add education"
          icon="plus"
          items={left.map((l) => ({
            id: l,
            label: LEVEL_NAME[l],
            onPick: () => {
              if (LEVELS.indexOf(l) < LEVELS.indexOf(d.highest)) say(`${LEVEL_NAME[l]} is now the highest education, so its details are required.`);
              act('education', (p) => addLevel(p, l), `re-${l}-country`);
            },
          }))}
        />
      ) : null;
    }
    if (k === 'work') {
      return (
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Icon name="plus" size={16} />}
          onClick={() => {
            const id = `wn${seq++}`;
            act('work', (p) => addJob(p, id), `rw-${id}-org`);
          }}
        >
          Add job
        </Button>
      );
    }
    if (k === 'tests') {
      return (
        <MoreMenu
          id="radd-test"
          label="Add test"
          text="Add test"
          icon="plus"
          items={TEST_ORDER.map((t) => ({
            id: t,
            label: TESTS[t].name,
            onPick: () => {
              const id = `tn${seq++}`;
              act('tests', (p) => addTest(p, id, t), `rt-${id}-cert`);
            },
          }))}
        />
      );
    }
    return null;
  };
  const close = (k: Editable) => {
    setDrafts((d) => without(d, k));
    setEditing((e) => without(e, k));
  };
  const saveSection = (k: Editable) => {
    const d = drafts[k];
    if (d) save((p) => merge(k, p, d));
    close(k);
    say(`${LABEL[k]} saved.`);
  };

  // the documents the profile needs are counted in Documents, not in the part they belong to
  const docMissing = ['passport copy', eduDocName(s.highest).toLowerCase()];
  const missingIn = (k: Editable) => r.sections.find((x) => x.key === k)?.missing.filter((m) => !docMissing.includes(m)) ?? [];
  const needDocs = [!s.docs.passport, !s.docs[eduDocKey(s.highest)]].filter(Boolean).length;
  const shortlist = (s.shortlist ?? []).map((id) => COURSES.find((c) => c.id === id)).filter((c): c is (typeof COURSES)[number] => !!c);
  /** A part of Personal details: unsaved, incomplete, done, or optional. */
  const tabStatus = (k: Editable) => {
    if (drafts[k]) return { text: 'Unsaved', cls: 'is-unsaved' };
    const sec = r.sections.find((x) => x.key === k)!;
    if (sec.optional) return sec.filled ? { text: 'Completed', cls: 'is-done' } : { text: 'Optional', cls: 'is-opt' };
    return missingIn(k).length ? { text: 'Incomplete', cls: 'is-todo' } : { text: 'Completed', cls: 'is-done' };
  };
  const status = (g: Group) => {
    if (g === 'apps') return { text: String(s.apps.length), cls: 'is-count' };
    if (g === 'documents') return needDocs ? { text: `${needDocs} missing`, cls: 'is-todo' } : { text: String(Object.keys(s.docs).length), cls: 'is-count' };
    if (DETAIL_TABS.some(([k]) => drafts[k])) return { text: 'Unsaved', cls: 'is-unsaved' };
    return missingIn('personal').length || missingIn('education').length ? { text: 'Incomplete', cls: 'is-todo' } : { text: 'Completed', cls: 'is-done' };
  };
  const counts: Partial<Record<RecordTab, number>> = { applications: s.apps.length, shortlist: shortlist.length };

  return (
    <div className="record">
      <div className="rtop">
        <button type="button" className="rback" onClick={onBack}>
          <Icon name="arrowLeft" size={18} />
          Students
        </button>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Icon name={linkCopied ? 'check' : 'share'} size={16} />}
          onClick={async () => {
            await copyText(`https://gsp.upgrad.com/s/${s.id.toLowerCase().replace('s-', '')}`);
            setLinkCopied(true);
            say(`Link copied. ${s.first} can add their own details and documents; you check what they add.`);
          }}
        >
          {linkCopied ? 'Link copied' : 'Share with student'}
        </Button>
      </div>

      {/* just added: a notification, bottom left, that goes after a few seconds */}
      <Toast
        onClose={onDismissFresh}
        t={
          fresh
            ? {
                key: s.added,
                icon: 'checkCircle',
                tone: 'ok',
                title: `${fullName(s)} added`,
                text: s.consentCheck ? `This passport is also on another agency’s student, so GSP is asking ${s.first} which agency they want. Meanwhile, complete the profile.` : 'Complete the student’s profile.',
              }
            : null
        }
      />

      <header className="card rhead">
        <div className="rhead__av">
          <Avatar s={s} big />
        </div>
        <div className="rhead__names">
          <h1 className="rhead__name">{fullName(s)}</h1>
          <p className="rhead__meta num">
            {s.id} · {s.nationality} · {addedLabel(s.added)} by {s.addedBy}
          </p>
        </div>
        <p className="rhead__contact">
          <span className="rhead__line">
            {s.email} <CopyButton text={s.email} what="Email" onDone={say} />
          </span>
          {s.phone && (
            <span className="rhead__line">
              {s.dial} {s.phone} <CopyButton text={`${s.dial} ${s.phone}`} what="Phone number" onDone={say} />
            </span>
          )}
          <span className="rhead__line rhead__c">
            {/* GSP sees whose student it is; the counsellor is the RP's to change (W12) */}
            <span className="rhead__k">{s.rp ?? 'GSP test agency'}</span>
            <span>{team.find((m) => m.id === s.counsellor)?.name ?? 'No counsellor'}</span>
          </span>
        </p>
        <div className="rhead__acts">
          <Button variant="secondary" size="sm" iconRight={<Icon name="arrowRight" size={16} />} onClick={() => onFindCourses(s)}>
            Find courses for {s.first}
          </Button>
          {onNewApp && (
            <Button size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => onNewApp(s)}>
              Start application
            </Button>
          )}
        </div>

        <div className="rprog">
          <Ring pct={r.pct} size={40} />
          <div className="rprog__t">
            <p className="rprog__title">{r.complete ? 'Profile complete: ready to apply' : `Profile ${r.pct}% ready`}</p>
          </div>
          {saved && (
            <p className="rsaved is-on" aria-live="off">
              <Icon name="check" size={14} />
              Saved
            </p>
          )}
        </div>
      </header>

      {s.consentCheck && (
        <div className="sflag" role="note">
          <span className="who who--gsp">With GSP</span>
          <p>
            <strong>Checking with {s.first}.</strong> This passport is also on a student at another agency, so GSP has asked {s.first} which agency they want to apply with. Applications can
            start once they reply, usually within 2 days.
          </p>
        </div>
      )}

      <div className="rbody">
        <nav className="rnav" aria-label="Profile sections">
          <div role="tablist" aria-orientation="vertical" aria-label="Profile sections" className="rnav__list" onKeyDown={onKey}>
            {GROUPS.map(([k, label, icon]) => {
              const st = status(k);
              const on = group === k;
              return (
                <button key={k} id={`rtab-${k}`} type="button" role="tab" aria-selected={on} aria-controls="rpanel" tabIndex={on ? 0 : -1} className={`rnav__item ${on ? 'is-on' : ''}`} onClick={() => pick(k)}>
                  {on && <motion.span layoutId="rnav-lens" className="rnav__lens" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }} />}
                  <Icon name={icon} size={18} />
                  <span className="rnav__label">{label}</span>
                  <span className={`rnav__st ${st.cls}`}>{st.text}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div id="rpanel" role="tabpanel" aria-labelledby={`rtab-${group}`} tabIndex={-1} ref={panel} className="rpanel">
          <header className={`rpanel__head ${group === 'documents' ? 'is-plain' : ''}`}>
            <h2 className="rpanel__title">{GROUPS.find(([k]) => k === group)![1]}</h2>
            {group === 'documents' && <p className="rpanel__text">{INTRO.documents}</p>}
            {group !== 'documents' && (
              <div className="rtabs" role="tablist" aria-label={GROUPS.find(([k]) => k === group)![1]} onKeyDown={onSubKey(group === 'details' ? DETAIL_TABS : APP_TABS)}>
                {(group === 'details' ? DETAIL_TABS : APP_TABS).map(([k, label]) => {
                  const on = tab === k;
                  const st = isEditable(k) ? tabStatus(k) : null;
                  return (
                    <button key={k} id={`rsub-${k}`} type="button" role="tab" aria-selected={on} aria-controls="rsubpanel" tabIndex={on ? 0 : -1} className={`rtab ${on ? 'is-on' : ''}`} onClick={() => setTab(k)}>
                      {label}
                      {st ? (
                        <span className={`rtab__st ${st.cls}`} title={st.text}>
                          {st.cls === 'is-done' ? <Icon name="check" size={12} strokeWidth={2.8} /> : st.cls === 'is-opt' ? null : st.cls === 'is-todo' ? '' : st.text}
                          <span className="vh">: {st.text}</span>
                        </span>
                      ) : (
                        <span className="rtab__n num">{counts[k] ?? 0}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </header>
          <div id="rsubpanel" role={group === 'documents' ? undefined : 'tabpanel'} aria-labelledby={group === 'documents' ? undefined : `rsub-${tab}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease }}>
                {(sec || (INTRO[tab] && group !== 'documents')) && (
                <div className="rpanel__row">
                  {INTRO[tab] && group !== 'documents' && <p className="rpanel__text">{INTRO[tab]}</p>}
                  {sec && (
                    <div className="rpanel__acts">
                      {adder(sec)}
                      {mode === 'view' && (
                        <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => startEdit(sec)} aria-label={`Edit ${LABEL[sec].toLowerCase()}`}>
                          Edit
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                )}
                {sec ? (
                  // saved: the same fields, read-only and shown as text; editing: the draft
                  <fieldset className={`rform ${mode === 'view' ? 'is-view' : ''}`} disabled={mode === 'view'} aria-label={LABEL[sec]}>
                    {sec === 'personal' && <Personal s={shown} list={list} update={sectionUpdate} />}
                    {sec === 'education' && <Education s={shown} update={sectionUpdate} />}
                    {sec === 'work' && <Work s={shown} update={sectionUpdate} />}
                    {sec === 'tests' && <Tests s={shown} update={sectionUpdate} />}
                    {sec === 'background' && <Background s={shown} update={sectionUpdate} />}
                  </fieldset>
                ) : tab === 'documents' ? (
                  <Documents s={s} update={save} />
                ) : tab === 'shortlist' ? (
                  <Shortlisted s={s} list={shortlist} onFindCourses={onFindCourses} onNewApp={onNewApp} onRemove={(id) => save((p) => ({ ...p, shortlist: (p.shortlist ?? []).filter((x) => x !== id) }))} />
                ) : (
                  <Applications s={s} complete={r.complete} onFindCourses={onFindCourses} onOpenApp={onOpenApp} onNewApp={onNewApp} />
                )}
                {sec && mode === 'edit' ? (
                  <div className="redit">
                    <p className="redit__note" aria-live="polite">
                      {drafts[sec] ? 'Unsaved changes' : hasData(sec, s) ? 'No changes yet' : ''}
                    </p>
                    {(editing[sec] || drafts[sec]) && (
                      <Button variant="secondary" onClick={() => close(sec)}>
                        Cancel
                      </Button>
                    )}
                    <Button onClick={() => saveSection(sec)} disabled={!drafts[sec] && !editing[sec]}>
                      Save
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Applications({
  s,
  complete,
  onFindCourses,
  onOpenApp,
  onNewApp,
}: {
  s: Student;
  complete: boolean;
  onFindCourses: (s: Student) => void;
  onOpenApp?: (id: string) => void;
  onNewApp?: (s: Student, courseId?: string) => void;
}) {
  return s.apps.length ? (
    <div className="rsec">
      <ul className="sapps">
        {s.apps.map((x) => (
          <li key={x.id}>
            <button type="button" className="card sapp" onClick={() => onOpenApp?.(x.id)} disabled={!onOpenApp}>
              {(() => {
                const u = UNIVERSITIES.find((v) => v.name === x.uni);
                return u ? <UniMark u={u} /> : null;
              })()}
              <span className="sapp__t">
                <span className="sapp__course">{x.course}</span>
                <span className="sapp__uni">
                  {x.uni} · {x.intake} · <span className="num">{x.id}</span>
                </span>
                <span className="sapp__status">{x.status}</span>
              </span>
              <span className={`who ${OWNER[x.owner][1]}`}>{OWNER[x.owner][0]}</span>
            </button>
          </li>
        ))}
      </ul>
      {onNewApp && (
        <div>
          <Button variant="secondary" iconLeft={<Icon name="plus" size={18} />} onClick={() => onNewApp(s)}>
            Add application
          </Button>
        </div>
      )}
    </div>
  ) : (
    <div className="rempty">
      <p className="rempty__title">No applications yet</p>
      <p className="rempty__text">{complete ? `Find a course ${s.first} can be offered, or start an application if you know the course.` : `You can search now; GSP starts checking once the profile has its documents.`}</p>
      <div className="rempty__acts">
        <Button variant="secondary" iconRight={<Icon name="arrowRight" size={18} />} onClick={() => onFindCourses(s)}>
          Find courses for {s.first}
        </Button>
        {onNewApp && (
          <Button variant="secondary" iconLeft={<Icon name="plus" size={18} />} onClick={() => onNewApp(s)}>
            Add application
          </Button>
        )}
      </div>
    </div>
  );
}

/** The courses shortlisted for this student in Find courses (with the student picked there), each to apply for or take off the list. */
function Shortlisted({
  s,
  list,
  onFindCourses,
  onNewApp,
  onRemove,
}: {
  s: Student;
  list: typeof COURSES;
  onFindCourses: (s: Student) => void;
  onNewApp?: (s: Student, courseId?: string) => void;
  onRemove: (id: string) => void;
}) {
  if (!list.length)
    return (
      <div className="rempty">
        <p className="rempty__title">Nothing shortlisted yet</p>
        <p className="rempty__text">In Find courses, pick {s.first} as the student and star a course: it’s kept here.</p>
        <div className="rempty__acts">
          <Button variant="secondary" iconRight={<Icon name="arrowRight" size={18} />} onClick={() => onFindCourses(s)}>
            Find courses for {s.first}
          </Button>
        </div>
      </div>
    );
  return (
    <ul className="rshort">
      {list.map((c) => (
        <li key={c.id} className="card rshort__item">
          <UniMark u={c.uni} />
          <div className="rshort__t">
            <p className="rshort__name">{c.name}</p>
            <p className="rshort__uni">
              {c.uni.name} · {campusLabel(c.campus)} · <span aria-hidden="true">{FLAG[c.uni.country]}</span> {c.uni.country}
            </p>
            <p className="rshort__meta">
              <span className="num">{money(c.tuition, c.currency)}</span> a year · {c.intakes.map((i) => i.month).join(', ')}
            </p>
          </div>
          <div className="rshort__acts">
            <button type="button" className="icon-btn" aria-label={`Take ${c.name} off the shortlist`} title="Take off the shortlist" onClick={() => onRemove(c.id)}>
              <Icon name="close" size={16} />
            </button>
            {onNewApp && (
              <Button size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => onNewApp(s, c.id)}>
                Start application
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
