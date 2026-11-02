import { TEST_COUNTRY } from '../../data/rpteam';
import { TEST_RP } from '../../data/dataset';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppShell } from '../../shell/AppShell';
import { ThemeToggle } from '../../components/ThemeToggle';
import { GlassRim } from '../../components/GlassRim';
import { AccountMenu } from '../../components/AccountMenu';
import { Icon } from '../../components/Icon';
import { partnerManagerFor } from '../../data/partners';
import type { Account } from '../signin/model';
import type { SignupState } from '../signup/model';
import { NAV, accessOf, expectedBy, phaseOf, sentDocs, type Section } from './model';
import { docsFor, missingRequired } from '../signup/docs';
import { returnedDocs, stillToReplace } from '../signup/docs';
import { Home } from './Home';
import { LaterSection, LockedSection, ProfileSection } from './Sections';
import { AccountClosed, HeldNote, RpAgreementCard } from './Agreement';
import { DocumentsSheet } from './DocumentsSheet';
import { FindCourses } from '../courses/FindCourses';
import { newSearch, runSearch, type CourseSearch } from '../courses/search';
import type { NoteTarget } from '../../data/inbox';
import { sampleAnnouncements } from '../../institution/data/announcements';
import { useInbox } from './Inbox';
import { Students } from '../students/Students';
import { fullName, sampleStudents, type Member, type Student } from '../../data/students';
import { teamFor } from '../../data/rpteam';
import { sampleBranches, type Branch } from '../../data/team';
import type { AddState } from '../students/form';
import type { RecordTab } from '../students/StudentRecord';
import { Applications, type AppsStart } from '../applications/Applications';
import { sampleApplications, studentApps, type Application } from '../../data/applications';
import { useLinkedData } from '../../proto/link';
import '../signup/signup.css';
import './portal.css';
import { useLiveApps } from '../../data/live';
import { useSharedDb } from '../../institution/data/store';
import { bapDecisions, signupId, syncSignup } from '../../institution/data/rpverify';
import { setSession } from '../../data/downloads';
import { rpSees, seesEarnings } from '../../data/rproles';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** A review state can open the portal on a section: with a course search made, or with students and the add form. */
export type PortalStart = {
  key: string;
  section: Section;
  search?: CourseSearch;
  students?: Student[];
  add?: AddState | true;
  open?: string;
  tab?: RecordTab;
  /** Applications, and how the Applications page opens. */
  apps?: Application[];
  app?: Omit<AppsStart, 'key'>;
};
const lensSpring = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 } as const;

/**
 * A padlock whose shackle swings open when its section unlocks, then fades.
 * It only animates on the way out, so a page that loads already unlocked shows nothing.
 */
function Padlock({ size = 15, delay = 0 }: { size?: number; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.2 } } : { opacity: 0, scale: 0.7, transition: { delay: delay + 0.42, duration: 0.24 } }}
    >
      <motion.path
        d="M5 7.2V5.2a3 3 0 0 1 6 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ originX: 1, originY: 1 }}
        initial={false}
        animate={{ y: 0, rotate: 0 }}
        exit={reduce ? undefined : { y: -2.4, rotate: -32, transition: { delay, duration: 0.38, ease } }}
      />
      <rect x="3" y="7" width="10" height="7.2" rx="2" fill="currentColor" />
    </motion.svg>
  );
}

/**
 * The partner's portal. While GSP verifies a new agency, Home says so and what happens next, course search
 * and the profile are open, and Students, Applications and Earnings keep their place in the menu with a lock.
 * When GSP verifies the business and its documents, the locks open where they are.
 */
export function Portal({
  acc,
  join,
  set,
  scrollTop,
  onSignOut,
  start,
}: {
  acc: Account;
  /** The registration this partner came from; none for a partner who signed in to an established account. */
  join: SignupState | null;
  /** Updates the registration: replacing sent-back documents and sending them again. */
  set?: (fn: (s: SignupState) => SignupState) => void;
  scrollTop: () => void;
  onSignOut: () => void;
  /** A review state can open the portal on a section, with a course search already made. */
  start?: PortalStart;
}) {
  const reduce = useReducedMotion();
  const [section, setSection] = useState<Section>(start?.section ?? 'home');
  // the course search lives here, so leaving Find courses and coming back keeps it
  // the agency's own state, from its profile (W34): the registration's, or the head office's for an established agency
  const homeState = join ? join.form.state || '' : sampleBranches().find((b) => b.main)?.state ?? '';
  const [search, setSearch] = useState<CourseSearch>(() => start?.search ?? newSearch(join?.form.country || TEST_COUNTRY, homeState));
  // students live here too: a new agency starts with none, an established one with its own
  // an RP sees only its own students and applications: GSP's others (with another RP) aren't theirs
  // slice 1 Roles (S1-1): a Branch Admin sees their branch's students, a Counsellor only those assigned to them
  const sees = useMemo(() => rpSees(acc), [acc]);
  const [students, setStudents] = useState<Student[]>(() => (start?.students ?? (join ? [] : sampleStudents(acc.name))).filter((x) => !x.rp).filter(sees));
  // and applications, for those students; the student list shows each one's applications from here
  const [apps, setApps] = useState<Application[]>(() => (start?.apps ?? (start?.students ? (start.students.length ? sampleApplications() : []) : join ? [] : sampleApplications())).filter((x) => !x.rp).filter((a) => acc.role === 'RP Admin' || !acc.role || students.some((s) => s.id === a.studentId)));
  // statuses set elsewhere (a university email confirmed in Mail) reach this copy: data/live.ts
  useLiveApps(setApps);
  // who's signed in, for the download log (data/downloads.ts)
  setSession(acc.name, acc.role ?? 'RP Admin');
  // connected to the other role for testing (Role, beside Prototype): see proto/link.ts
  // the bell and the megaphone: this portal's notifications (real ones from the other role while connected), and
  // announcements as the Institution Team's model has them (this role's own copy: nothing that team changes reaches here)
  const [anns] = useState(() => ({ list: sampleAnnouncements(), names: {} }));
  const inbox = useInbox({
    role: 'rp',
    access: accessOf(join),
    agency: acc.agency,
    country: join?.form.country || TEST_COUNTRY,
    apps,
    students,
    me: acc,
    join: join ?? undefined,
    anns,
    onOpen: (t) => openNote(t),
    onCourses: (uni) => {
      // the university's courses, for any student
      setSearch((p) => runSearch({ ...newSearch(p.need.country, p.need.state), text: uni }));
      go('courses');
    },
  });
  useLinkedData(apps, setApps, students, setStudents, inbox.onIncoming);
  const studentsView = useMemo(() => students.map((s) => ({ ...s, apps: studentApps(apps, s.id) })), [students, apps]);
  // the agency's team and branches: managed on Profile, and the team Students picks counsellors from
  const [team, setTeam] = useState<Member[]>(() => teamFor(acc));
  const [branches, setBranches] = useState<Branch[]>(sampleBranches);
  // moving between sections with something open: a student's record, an application, the new application sheet
  const [jump, setJump] = useState<PortalStart | undefined>();
  const begin = jump ?? start;
  // a new review state replaces what's on screen; the first one already set it up above
  const seenStart = useRef(start?.key);
  useEffect(() => {
    if (!start || start.key === seenStart.current) return;
    seenStart.current = start.key;
    setJump(undefined);
    setSection(start.section);
    if (start.search) setSearch(start.search);
    if (start.students) setStudents(start.students.filter((x) => !x.rp));
    if (start.apps || start.students) setApps((start.apps ?? (start.students?.length ? sampleApplications() : [])).filter((x) => !x.rp));
  }, [start?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const jumpTo = (p: Omit<PortalStart, 'key'>) => {
    setJump({ ...p, key: `jump-${Date.now()}` });
    setSection(p.section);
    scrollTop();
  };
  const [docsOpen, setDocsOpen] = useState(false);
  // a new sign-up is on GSP's Recruitment partners list from the start (W5), and BAP's decisions on its documents
  // come back here (W4): data/rpverify.ts
  const [db] = useSharedDb();
  useEffect(() => {
    if (join) syncSignup(join);
  }, [join]);
  const rpRec = join ? db.rps.find((r) => r.id === signupId(join)) : undefined;
  // the agency's own record: its sign-up, or the prototype's own agency (slice 2 PRD: agreement, held commission, suspension)
  const myRp = rpRec ?? (!join ? db.rps.find((r) => r.id === 'rp-test') : undefined);
  useEffect(() => {
    if (!join || !rpRec || !set) return;
    const next = bapDecisions(join, rpRec);
    if (next) set(() => next);
  }, [rpRec]); // eslint-disable-line react-hooks/exhaustive-deps
  const access = accessOf(join);
  const phase = phaseOf(join);
  const needs = join ? sentDocs(join).map((d) => d.need) : [];
  const back = join ? returnedDocs(needs, join.docs).length : 0;
  const left = join ? stillToReplace(needs, join.docs).length : 0;
  // while registering, only Home is open; while GSP verifies, the sections marked locked wait
  const isLocked = (k: Section) => (access === 'setup' ? k !== 'home' : access === 'verifying' && !!NAV.find((n) => n.key === k)?.locked);
  const toDo = join && access === 'setup' ? (join.detailsDone ? 0 : 1) + missingRequired(docsFor(join.form.country), join.docs).length : 0;
  const manager = join ? partnerManagerFor(join.form.country, join.form.city, join.form.ref) : partnerManagerFor(TEST_COUNTRY, TEST_RP.city ?? '', '');

  // changes GSP makes while the portal is open are said once: verified, or documents sent back
  const [announce, setAnnounce] = useState('');
  const was = useRef(phase);
  useEffect(() => {
    if (was.current !== phase) {
      // the details are in now: course search starts from the agency's own country and state
      if (was.current === 'setup' && join) setSearch(newSearch(join.form.country || TEST_COUNTRY, join.form.state || ''));
      if (phase === 'setup') setAnnounce('');
      else if (phase === 'verified') setAnnounce(`GSP verified ${acc.agency}. Students, applications and earnings are open.`);
      else if (phase === 'sent-back') setAnnounce(`GSP couldn’t verify ${back === 1 ? '1 document' : `${back} documents`}. Replace ${back === 1 ? 'it' : 'them'} to finish verification.`);
      else setAnnounce('Sent to GSP. Course search and your profile are open.');
    }
    was.current = phase;
  }, [phase, acc.agency, back]);

  // picking a section in the menu always lands on its first page (Students: the list, not a student)
  const [navKey, setNavKey] = useState(0);
  const go = (k: Section) => {
    setSection(k);
    setNavKey((n) => n + 1);
    scrollTop();
  };
  const openDocs = () => setDocsOpen(true);
  const openNote = (t: NoteTarget) => {
    if ('app' in t) jumpTo({ section: 'applications', app: { open: t.app } });
    else if ('student' in t) jumpTo({ section: 'students', open: t.student, tab: 'personal' });
    // RP roles have no My work (slice 4 PRD): a task notification never reaches them
    else go(t.page === 'mywork' ? 'home' : t.page);
  };

  const initials = acc.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  let lockIndex = 0; // staggers the locks opening, top to bottom

  const sidebar = (
    <>
      <nav aria-label="Main">
        <ul className="pnav">
          {NAV.filter((n) => n.key !== 'earnings' || seesEarnings(acc)).map((n) => {
            const active = section === n.key;
            const locked = isLocked(n.key);
            const delay = n.locked ? 0.08 * lockIndex++ : 0;
            return (
              <li key={n.key}>
                <button type="button" className={`pnav__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(n.key)}>
                  {active && <motion.span layoutId="pnav-lens" className="pnav__lens" transition={reduce ? { duration: 0 } : lensSpring} />}
                  <Icon name={n.icon} size={20} />
                  <span className="pnav__label">
                    {n.label}
                    {locked && <span className="vh">{access === 'setup' ? ', opens once you’ve finished registering' : ', opens after verification'}</span>}
                  </span>
                  <AnimatePresence initial={false}>
                    {locked && (
                      <span className="pnav__lock" key="lock">
                        <Padlock delay={delay} />
                      </span>
                    )}
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <AnimatePresence initial={false}>
        {access !== 'all' && join && (
          <motion.div
            className={`sstatus ${phase === 'sent-back' || phase === 'setup' ? 'is-back' : ''}`}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, transition: { duration: 0.24, ease } }}
          >
            {phase === 'setup' ? (
              <>
                <span className="who who--you">Pending</span>
                <p className="sstatus__title">Finish registering</p>
                <p className="sstatus__text">
                  {join.detailsDone ? (toDo === 0 ? 'Documents in. Send them to GSP.' : `${toDo} ${toDo === 1 ? 'document' : 'documents'} to upload`) : 'Business details, then documents'}
                </p>
                {section !== 'home' && (
                  <button type="button" className="btn btn--link sstatus__link" onClick={() => go('home')}>
                    Continue registering
                  </button>
                )}
              </>
            ) : phase === 'sent-back' ? (
              <>
                <span className="who who--you">Needs your attention</span>
                <p className="sstatus__title">{back === 1 ? '1 document to replace' : `${back} documents to replace`}</p>
                <p className="sstatus__text is-bad">GSP couldn’t verify {back === 1 ? 'it' : 'them'}. See why.</p>
                <button type="button" className="btn btn--link sstatus__link" onClick={openDocs}>
                  {left === 0 ? 'Send to GSP again' : back === 1 ? 'Replace document' : 'Replace documents'}
                </button>
              </>
            ) : (
              <>
                <span className="who who--gsp">With GSP</span>
                <p className="sstatus__title">Verification in progress</p>
                <p className="sstatus__text">Expect it by {expectedBy(join.sentAt, join.form.country)}</p>
                <button type="button" className="btn btn--link sstatus__link" onClick={openDocs}>
                  View documents
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  const tabs = NAV.filter((n) => n.key !== 'profile' && (n.key !== 'earnings' || seesEarnings(acc)));
  const tabbar = (
    <nav className="tabbar glass" aria-label="Main">
      <GlassRim />
      <ul className="tabbar__list">
        {tabs.map((n) => {
          const active = section === n.key;
          const locked = isLocked(n.key);
          return (
            <li key={n.key}>
              <button type="button" className={`tab ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(n.key)}>
                {active && <motion.span layoutId="tab-lens" className="tab__lens" transition={reduce ? { duration: 0 } : lensSpring} />}
                <span className="tab__icon">
                  <Icon name={n.icon} size={22} />
                  <AnimatePresence initial={false}>
                    {locked && (
                      <motion.span className="tab__lock" key="lock" exit={{ opacity: 0, transition: { delay: 0.5, duration: 0.2 } }}>
                        <Padlock size={10} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className="tab__label">
                  {n.short}
                  {locked && <span className="vh">{access === 'setup' ? ', opens once you’ve finished registering' : ', opens after verification'}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const content =
    myRp && (myRp.status === 'Suspended' || myRp.status === 'Rejected') ? (
      <AccountClosed r={myRp} />
    ) : section === 'home' ? (
      <>
      {myRp && <RpAgreementCard r={myRp} by={acc.name} canSign={acc.role === 'RP Admin'} />}
      <Home acc={acc} join={join} access={access} manager={manager} onDocs={openDocs} go={go} set={set} scrollTop={scrollTop} startKey={start?.key} apps={apps} students={students} onOpenApp={(id) => jumpTo({ section: 'applications', app: { open: id } })} />
      </>
    ) : isLocked(section) && join ? (
      <LockedSection section={section} join={join} onDocs={openDocs} go={go} />
    ) : section === 'profile' ? (
      <ProfileSection
        acc={acc}
        join={join}
        access={access}
        onDocs={openDocs}
        onSignOut={onSignOut}
        team={{ agency: acc.agency, bdm: manager, team, setTeam, branches, setBranches, students, setStudents }}
      />
    ) : section === 'students' ? (
      <Students
        list={studentsView}
        set={setStudents}
        team={team}
        me={acc.name}
        nationality={join?.form.country || TEST_COUNTRY}
        start={begin?.section === 'students' ? { key: begin.key, add: begin.add, open: begin.open, tab: begin.tab } : undefined}
        navKey={navKey}
        scrollTop={scrollTop}
        onFindCourses={(s) => {
          // the search takes the student's country and state, which decide what they can apply to
          setSearch((p) => ({ ...p, need: { ...p.need, country: s.country || s.nationality, state: s.state }, student: fullName(s), studentId: s.id, shortlist: s.shortlist ?? [], shown: 20 }));
          go('courses');
        }}
        onOpenApp={(id) => jumpTo({ section: 'applications', app: { open: id } })}
        onNewApp={(s, courseId) => jumpTo({ section: 'applications', app: { add: { studentId: s.id, courseId } } })}
        appList={apps}
        onCreateApp={(a) => setApps((l) => [a, ...l])}
        ownOnly={acc.role === 'Counsellor'}
      />
    ) : section === 'applications' ? (
      <Applications
        apps={apps}
        setApps={setApps}
        students={studentsView}
        setStudents={setStudents}
        team={team}
        me={acc.name}
        start={begin?.section === 'applications' && begin.app ? { key: begin.key, ...begin.app } : undefined}
        navKey={navKey}
        scrollTop={scrollTop}
        onOpenStudent={(id, tab) => jumpTo({ section: 'students', open: id, tab: tab ?? 'personal' })}
        nationality={join?.form.country || TEST_COUNTRY}
        onFindCourses={() => go('courses')}
        ownOnly={acc.role === 'Counsellor'}
      />
    ) : section === 'courses' ? (
      <FindCourses
        s={search}
        set={setSearch}
        canApply={access === 'all'}
        agency={acc.agency}
        onApply={(c) => jumpTo({ section: 'applications', app: { add: { courseId: c.id, studentId: search.studentId } } })}
        students={access === 'all' ? studentsView : []}
        home={{ country: join?.form.country || TEST_COUNTRY, state: homeState }}
        onShortlist={(id, ids) => setStudents((l) => l.map((x) => (x.id === id ? { ...x, shortlist: ids } : x)))}
        onOpenShortlist={(id) => jumpTo({ section: 'students', open: id, tab: 'shortlist' })}
        from={{ org: acc.agency, name: acc.name, email: acc.email }}
      />
    ) : section === 'earnings' && myRp && myRp.status === 'Activated' ? (
      <>
        <HeldNote />
        <LaterSection section={section} />
      </>
    ) : (
      <LaterSection section={section} />
    );

  return (
    <>
      <AppShell
        inert={docsOpen}
        sidebar={sidebar}
        footer={<AccountMenu name={acc.name} org={`${acc.agency} · ${acc.role}`} email={acc.email} onSignOut={onSignOut} />}
        tools={<ThemeToggle />}
        corner={inbox.corner}
        topEnd={
          <div className="topend">
            {inbox.top}
            <ThemeToggle />
            <button
              type="button"
              className={`topend__me ${section === 'profile' ? 'is-active' : ''}`}
              aria-label={`Profile: ${acc.name}, ${acc.agency}`}
              aria-current={section === 'profile' ? 'page' : undefined}
              onClick={() => go('profile')}
            >
              {initials}
            </button>
          </div>
        }
        tabbar={tabbar}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${section}:${isLocked(section) ? 'locked' : ''}:${phase}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
        <p className="vh" role="status" id="portal-announce">
          {announce}
        </p>
      </AppShell>
      {inbox.toast}
      {join && <DocumentsSheet open={docsOpen} onClose={() => setDocsOpen(false)} join={join} set={set} manager={manager} />}
    </>
  );
}
