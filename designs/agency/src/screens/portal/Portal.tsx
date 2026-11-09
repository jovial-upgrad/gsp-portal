import { useEffect, useMemo, useRef, useState } from 'react';
import { Earnings } from '../../finance/commission/Earnings';
import { commNotes } from '../../finance/commission/engine';
import { ctxRps, rpName as commRpName, useComm, useLines } from '../../finance/commission/store';
import { HOME_RP } from '../../gsp/rps';
import type { Note } from '../../data/inbox';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppShell } from '../../shell/AppShell';
import { ThemeToggle } from '../../components/ThemeToggle';
import { GlassRim } from '../../components/GlassRim';
import { AccountMenu } from '../../components/AccountMenu';
import { Icon } from '../../components/Icon';
import { partnerManagerFor } from '../../data/partners';
import type { Account } from '../signin/model';
import type { SignupState } from '../signup/model';
import { AGREEMENT, NAV, accessOf, agreementOf, earningsLocked, expectedBy, phaseOf, sentDocs, type Section } from './model';
import { PreviewSheet } from '../../components/DocView';
import { docsFor, missingRequired } from '../signup/docs';
import { returnedDocs, stillToReplace } from '../signup/docs';
import { Home } from './Home';
import { LaterSection, LockedSection, ProfileSection } from './Sections';
import { DocumentsSheet } from './DocumentsSheet';
import { FindCourses } from '../courses/FindCourses';
import { newSearch, runSearch, type CourseSearch } from '../courses/search';
import type { NoteTarget } from '../../data/inbox';
import { sampleAnnouncements } from '../../institution/data/announcements';
import { useInbox } from './Inbox';
import { Students } from '../students/Students';
import { fullName, sampleStudents, teamFor, type Member, type Student } from '../../data/students';
import { sampleBranches, type Branch } from '../../data/team';
import type { AddState } from '../students/form';
import type { RecordTab } from '../students/StudentRecord';
import { Applications, type AppsStart } from '../applications/Applications';
import { sampleApplications, studentApps, type Application } from '../../data/applications';
import { useLinkedData } from '../../proto/link';
import { AccessProvider, type Feature } from '../../proto/viewOnly';
import { AccountPage } from '../../institution/records/Account';

/**
 * A seat in the agency (Nesil, 6 Nov, from the access sheet): GSP Branch Manager (the students and applications of
 * one branch) or GSP Counsellor (their own). RP Admin's portal without Earnings, the agency's Profile or commission;
 * Find courses, Students and Applications (Chat and Documents) to use.
 */
export type Seat = { kind: 'branch' | 'counsellor'; member: Member; title: string };
/** What a seat leaves out (src/proto/viewOnly.tsx). */
const SEAT_HIDE: Feature[] = ['courses.commission', 'app.base-commission'];
import '../signup/signup.css';
import './portal.css';

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
  seat,
}: {
  acc: Account;
  /** GSP Branch Manager or GSP Counsellor (6 Nov): one branch's, or one counsellor's, students and applications. */
  seat?: Seat;
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
  const [search, setSearch] = useState<CourseSearch>(() => start?.search ?? newSearch(join?.form.country || 'India', join?.form.state || ''));
  // students live here too: a new agency starts with none, an established one with its own
  // a seat sees its branch's students, or its own (by who's their counsellor)
  const seatTeam = () => [...teamFor(acc.name, acc.email).filter((m) => m.id !== seat?.member.id), ...(seat ? [seat.member] : [])];
  const inSeat = (st: Student) => !seat || (seat.kind === 'counsellor' ? st.counsellor === seat.member.id : seatTeam().find((m) => m.id === st.counsellor)?.branch === seat.member.branch);
  const [students, setStudents] = useState<Student[]>(() => start?.students ?? (join ? [] : sampleStudents(acc.name).filter(inSeat)));
  // and applications, for those students; the student list shows each one's applications from here
  const [apps, setApps] = useState<Application[]>(() => {
    const all = start?.apps ?? (start?.students ? (start.students.length ? sampleApplications() : []) : join ? [] : sampleApplications());
    if (!seat) return all;
    const mine = new Set(sampleStudents(acc.name).filter(inSeat).map((x) => x.id));
    return all.filter((a) => mine.has(a.studentId));
  });
  // connected to the other role for testing (Role, beside Prototype): see proto/link.ts
  // the bell and the megaphone: this portal's notifications (real ones from the other role while connected), and
  // announcements as the Institution Team's model has them (this role's own copy: nothing that team changes reaches here)
  const [anns] = useState(() => ({ list: sampleAnnouncements(), names: {} }));
  const comm = useComm();
  const commLines = useLines(apps, students);
  const commExtra = useMemo<Note[]>(() => {
    const me = ctxRps().find((r) => r.name === acc.agency) ?? ctxRps().find((r) => r.name === HOME_RP);
    return commNotes(comm, commLines, commRpName)
      .filter((n) => n.to === 'rp' && n.rp === me?.id)
      .map((n) => ({ id: n.id, kind: 'system', title: n.title, text: n.text, at: n.at, read: n.at < Date.now() - 2 * 86_400_000, to: { page: 'earnings' } }));
  }, [comm, commLines, acc.agency]);
  const inbox = useInbox({
    role: 'rp',
    access: accessOf(join),
    agency: acc.agency,
    country: join?.form.country || 'India',
    apps,
    students,
    anns,
    // 9 Nov (Jovial): N16 (send your invoice) and N18 (GSP paid you), to the RP Admin; seats see no commission
    extra: seat ? [] : commExtra,
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
  const [team, setTeam] = useState<Member[]>(() => (seat ? seatTeam() : teamFor(acc.name, acc.email)));
  const [branches, setBranches] = useState<Branch[]>(sampleBranches);
  // moving between sections with something open: a student's record, an application, the new application sheet
  const [jump, setJump] = useState<PortalStart | undefined>();
  // the review state's opening (a student, an application) counts once: after the menu is used, sections open on their first page
  const [moved, setMoved] = useState(false);
  const begin = jump ?? (moved ? undefined : start);
  // a new review state replaces what's on screen; the first one already set it up above
  const seenStart = useRef(start?.key);
  useEffect(() => {
    if (!start || start.key === seenStart.current) return;
    seenStart.current = start.key;
    setJump(undefined);
    setMoved(false);
    setSection(start.section);
    if (start.search) setSearch(start.search);
    if (start.students) setStudents(start.students);
    if (start.apps || start.students) setApps(start.apps ?? (start.students?.length ? sampleApplications() : []));
  }, [start?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const jumpTo = (p: Omit<PortalStart, 'key'>) => {
    setJump({ ...p, key: `jump-${Date.now()}` });
    setSection(p.section);
    scrollTop();
  };
  const [docsOpen, setDocsOpen] = useState(false);
  const access = accessOf(join);
  const phase = phaseOf(join);
  const needs = join ? sentDocs(join).map((d) => d.need) : [];
  const back = join ? returnedDocs(needs, join.docs).length : 0;
  const left = join ? stillToReplace(needs, join.docs).length : 0;
  // while registering, only Home is open; while GSP verifies, the sections marked locked wait
  // 4 Nov: once the business is verified, Earnings still waits for GSP to accept the signed agreement
  const agreement = agreementOf(join);
  const isLocked = (k: Section) =>
    access === 'setup' ? k !== 'home' : access === 'verifying' ? !!NAV.find((n) => n.key === k)?.locked : k === 'earnings' && earningsLocked(join);
  const lockNote = (k: Section) => (access === 'setup' ? ', opens once you’ve finished registering' : access === 'verifying' ? ', opens after verification' : k === 'earnings' ? ', opens once GSP accepts your agreement' : '');
  const toDo = join && access === 'setup' ? (join.detailsDone ? 0 : 1) + missingRequired(docsFor(join.form.country), join.docs).length : 0;
  // 4 Nov: the state and city decide the GSP Recruitment contact (no referral code)
  const manager = join ? partnerManagerFor(join.form.country, join.form.city, '', join.form.state) : partnerManagerFor('India', 'Bengaluru', '', 'Karnataka');
  const [profileStart, setProfileStart] = useState<{ tab: 'documents'; key: number } | undefined>();
  const [agrPreview, setAgrPreview] = useState(false);

  // changes GSP makes while the portal is open are said once: verified, or documents sent back
  const [announce, setAnnounce] = useState('');
  const was = useRef(phase);
  useEffect(() => {
    if (was.current !== phase) {
      // the details are in now: course search starts from the agency's own country and state
      if (was.current === 'setup' && join) setSearch(newSearch(join.form.country || 'India', join.form.state || ''));
      if (phase === 'setup') setAnnounce('');
      else if (phase === 'verified') setAnnounce(`GSP verified ${acc.agency}. Students and applications are open. Sign your partner agreement to open Earnings.`);
      else if (phase === 'sent-back') setAnnounce(`GSP couldn’t verify ${back === 1 ? '1 document' : `${back} documents`}. Replace ${back === 1 ? 'it' : 'them'} to finish verification.`);
      else setAnnounce('Sent to GSP. Course search and your profile are open. Verification usually takes 1 working day.');
    }
    was.current = phase;
  }, [phase, acc.agency, back]);

  const wasAgr = useRef(agreement);
  useEffect(() => {
    if (wasAgr.current !== agreement) {
      if (agreement === 'with-gsp') setAnnounce('Signed agreement sent to GSP. GSP usually checks it within 1 working day.');
      else if (agreement === 'accepted' && wasAgr.current !== 'none') setAnnounce('GSP accepted your partner agreement. Earnings is open.');
      else if (agreement === 'sent-back') setAnnounce('GSP couldn’t accept your signed agreement. See why on Home.');
    }
    wasAgr.current = agreement;
  }, [agreement]);

  // picking a section in the menu always lands on its first page (Students: the list, not a student)
  const [navKey, setNavKey] = useState(0);
  const go = (k: Section) => {
    // a deep link (an application or student opened from elsewhere, or the review state's) is spent once you move on
    setJump(undefined);
    setMoved(true);
    setSection(k);
    setNavKey((n) => n + 1);
    scrollTop();
  };
  const openDocs = () => setDocsOpen(true);
  const openNote = (t: NoteTarget) => {
    if ('app' in t) jumpTo({ section: 'applications', app: { open: t.app } });
    else if ('student' in t) jumpTo({ section: 'students', open: t.student, tab: 'personal' });
    else go(t.page);
  };

  const who = seat ? seat.member.name : acc.name;
  const initials = who.split(' ').map((p) => p[0]).slice(0, 2).join('');
  // a seat's menu: no Earnings (commission) and no agency Profile (the initials open the person's own account)
  const menu = seat ? NAV.filter((n) => n.key !== 'earnings' && n.key !== 'profile') : NAV;
  let lockIndex = 0; // staggers the locks opening, top to bottom

  const sidebar = (
    <>
      <nav aria-label="Main">
        <ul className="pnav">
          {menu.map((n) => {
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
                    {locked && <span className="vh">{lockNote(n.key)}</span>}
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
        {access === 'all' && join && agreement !== 'accepted' && agreement !== 'none' && (
          <motion.div
            key="agr"
            className={`sstatus ${agreement === 'with-gsp' ? '' : 'is-back'}`}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, transition: { duration: 0.24, ease } }}
          >
            {agreement === 'with-gsp' ? (
              <>
                <span className="who who--gsp">With GSP</span>
                <p className="sstatus__title">Agreement being checked</p>
                <p className="sstatus__text">Usually by {expectedBy(join.agreement?.sentAt)}</p>
              </>
            ) : agreement === 'sent-back' ? (
              <>
                <span className="who who--you">Needs your attention</span>
                <p className="sstatus__title">Agreement not accepted</p>
                <p className="sstatus__text is-bad">Sign it again and upload it. See why.</p>
              </>
            ) : (
              <>
                <span className="who who--you">With you</span>
                <p className="sstatus__title">Sign your agreement</p>
                <p className="sstatus__text">It opens Earnings</p>
              </>
            )}
            {section !== 'home' && (
              <button type="button" className="btn btn--link sstatus__link" onClick={() => go('home')}>
                {agreement === 'with-gsp' ? 'See it on Home' : 'Go to the agreement'}
              </button>
            )}
          </motion.div>
        )}
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
                <p className="sstatus__text">Usually by {expectedBy(join.sentAt)}</p>
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

  const tabs = menu.filter((n) => n.key !== 'profile');
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
                  {locked && <span className="vh">{lockNote(n.key)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const content =
    section === 'home' ? (
      <Home
        acc={acc}
        join={join}
        access={access}
        manager={manager}
        onDocs={openDocs}
        onProfileDocs={() => (setProfileStart({ tab: 'documents', key: Date.now() }), go('profile'))}
        onAgreementPreview={() => setAgrPreview(true)}
        go={go}
        set={set}
        scrollTop={scrollTop}
        startKey={start?.key}
        apps={apps}
        students={studentsView}
        onOpenApp={(id) => jumpTo({ section: 'applications', app: { open: id } })}
      />
    ) : isLocked(section) && join ? (
      <LockedSection section={section} join={join} onDocs={openDocs} go={go} />
    ) : section === 'profile' && seat ? (
      <AccountPage name={seat.member.name} org={`${acc.agency} · ${seat.title}`} email={seat.member.email ?? acc.email} onSignOut={onSignOut} />
    ) : section === 'earnings' && seat ? (
      <LaterSection section="home" />
    ) : section === 'earnings' ? (
      // 9 Nov (Jovial, the PRD's Commissions tab): RP Admin's Earnings
      <Earnings agency={acc.agency} me={acc.name} apps={apps} students={students} />
    ) : section === 'profile' ? (
      <ProfileSection
        acc={acc}
        join={join}
        access={access}
        onDocs={openDocs}
        start={profileStart}
        onSignOut={onSignOut}
        team={{ agency: acc.agency, bdm: manager, team, setTeam, branches, setBranches, students, setStudents }}
      />
    ) : section === 'students' ? (
      <Students
        list={studentsView}
        set={setStudents}
        team={team}
        me={acc.name}
        nationality={join?.form.country || 'India'}
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
        nationality={join?.form.country || 'India'}
        onFindCourses={() => go('courses')}
      />
    ) : section === 'courses' ? (
      <FindCourses
        s={search}
        set={setSearch}
        canApply={access === 'all'}
        agency={acc.agency}
        onApply={(c) => jumpTo({ section: 'applications', app: { add: { courseId: c.id, studentId: search.studentId } } })}
        students={access === 'all' ? studentsView : []}
        home={{ country: join?.form.country || 'India', state: join?.form.state || '' }}
        onShortlist={(id, ids) => setStudents((l) => l.map((x) => (x.id === id ? { ...x, shortlist: ids } : x)))}
        onOpenShortlist={(id) => jumpTo({ section: 'students', open: id, tab: 'shortlist' })}
        from={{ org: acc.agency, name: acc.name, email: acc.email }}
      />
    ) : (
      <LaterSection section={section} />
    );

  return (
    <>
      <AppShell
        inert={docsOpen || agrPreview}
        sidebar={sidebar}
        footer={<AccountMenu name={who} org={`${acc.agency} · ${seat ? seat.title : acc.role}`} email={seat?.member.email ?? acc.email} onSignOut={onSignOut} />}
        tools={<ThemeToggle />}
        corner={inbox.corner}
        topEnd={
          <div className="topend">
            {inbox.top}
            <ThemeToggle />
            <button
              type="button"
              className={`topend__me ${section === 'profile' ? 'is-active' : ''}`}
              aria-label={`${seat ? 'Account' : 'Profile'}: ${who}, ${acc.agency}`}
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
            <AccessProvider hide={seat ? SEAT_HIDE : []}>{content}</AccessProvider>
          </motion.div>
        </AnimatePresence>
        <p className="vh" role="status" id="portal-announce">
          {announce}
        </p>
      </AppShell>
      {inbox.toast}
      {join && <DocumentsSheet open={docsOpen} onClose={() => setDocsOpen(false)} join={join} set={set} manager={manager} />}
      <PreviewSheet d={{ name: AGREEMENT.title, file: AGREEMENT.file }} open={agrPreview} onClose={() => setAgrPreview(false)} />
    </>
  );
}
