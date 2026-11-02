import { TEST_COUNTRY } from '../../data/rpteam';
import { allRpMembers } from '../../data/rpteam';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppShell } from '../../shell/AppShell';
import { ThemeToggle } from '../../components/ThemeToggle';
import { GlassRim } from '../../components/GlassRim';
import { AccountMenu } from '../../components/AccountMenu';
import { Icon } from '../../components/Icon';
import type { Account } from '../../screens/signin/model';
import type { SignupState } from '../../screens/signup/model';
import { NAV, TABS, type Focus, type PageProps, type Section, type Target } from './model';
import { FindCourses } from '../courses/FindCourses';
import { newSearch, runSearch, setCatalogue, type CourseSearch } from '../courses/search';
import { Students } from '../students/Students';
import { fullName, sampleStudents, type Student } from '../../data/students';
import type { AddState } from '../students/form';
import type { RecordTab } from '../students/StudentRecord';
import { Applications, type AppsStart } from '../applications/Applications';
import { courseOf, sampleApplications, studentApps, type Application } from '../../data/applications';
import { useLinkedData } from '../../proto/link';
import { useInbox } from '../../screens/portal/Inbox';
import type { NoteTarget } from '../../data/inbox';
import type { Desk } from '../applications/desk';
import { GSP_USER } from '../user';
import { useSharedDb } from '../data/store';
import { forSearch, searchable } from '../data/catalogue';
import { TeamHome } from '../records/Home';
import { WorkPage } from '../../work/WorkPage';
import { Universities } from '../records/Universities';
import { Catalogue } from '../records/Catalogue';
import { InstitutionPartners } from '../records/InstitutionPartners';
import { RecruitmentPartners } from '../records/RecruitmentPartners';
import { Announcements } from '../records/Announcements';
import { StaffProfile } from '../../gsp/portal/StaffPages';
import { Toast } from '../records/parts';
import '../../screens/signup/signup.css';
import '../../screens/portal/portal.css';
import '../institution.css';
import { useLiveApps } from '../../data/live';
import { setSession } from '../../data/downloads';
import { setScope } from '../../data/scope';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** A review state can open the portal on a section: with a course search made, or with students and the add form. */
export type PortalStart = {
  key: string;
  /** RP Admin's states can name Earnings, which the Institution Team doesn't have: it opens Home. */
  section: Section | 'earnings';
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
const sectionOf = (s?: PortalStart['section']): Section => (!s || s === 'earnings' ? 'home' : s);

export type { Focus };

/**
 * The Institution Team's portal (GSP · Institution, 29 Oct). GSP Team members a GSP admin gave access to collect
 * and keep the records of the institutions GSP works with: universities, their courses, the institution partners
 * GSP has agreements with, and the recruitment partners who send students. It began as a copy of GSP Team (whose
 * Students, Applications and Course search it keeps as they are) and changes here never touch GSP Team or RP
 * Admin. Signed in as Kevin Mcewan, GSP · Institution; there's no registering or verification here.
 */
export function Portal({
  acc,
  join,
  scrollTop,
  onSignOut,
  start,
}: {
  acc: Account;
  /** The agency registration a review state carries: only its country is used, for course search. */
  join: SignupState | null;
  set?: (fn: (s: SignupState) => SignupState) => void;
  scrollTop: () => void;
  onSignOut: () => void;
  start?: PortalStart;
}) {
  const reduce = useReducedMotion();
  const [section, setSection] = useState<Section>(sectionOf(start?.section));
  const country = join?.form.country || TEST_COUNTRY;
  const [search, setSearch] = useState<CourseSearch>(() => start?.search ?? newSearch(country, join?.form.state || ''));
  const [students, setStudents] = useState<Student[]>(() => start?.students ?? sampleStudents(acc.name));
  const [apps, setApps] = useState<Application[]>(() => start?.apps ?? (start?.students ? (start.students.length ? sampleApplications() : []) : sampleApplications()));
  // statuses set elsewhere (a university email confirmed in Mail) reach this copy: data/live.ts
  useLiveApps(setApps);
  // who's signed in, for the download log (data/downloads.ts)
  setSession(GSP_USER.name, GSP_USER.role);
  setScope('gsp-institution', GSP_USER.email);
  const [desks, setDesks] = useState<Record<string, Desk>>({});
  const studentsView = useMemo(() => students.map((s) => ({ ...s, apps: studentApps(apps, s.id) })), [students, apps]);
  // every RP's team (data/rpteam.ts, W21): a student's counsellor is on their RP's
  const team = useMemo(allRpMembers, []);

  // the records the team keeps; its changes stay in this portal
  // the catalogue and records: one copy for every role (institution/data/store.ts)
  const [db, setDb] = useSharedDb();
  const [focus, setFocus] = useState<Focus | null>(null);
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const say = (text: string) => setMsg({ text, key: Date.now() });

  // the bell and the megaphone (30 Oct): GSP's notifications, real ones from the RP while connected, and the live
  // announcements this team publishes (they stay in this role, by Nesil's 29 Oct rule)
  const ownAnns = useMemo(() => ({ list: db.anns, names: Object.fromEntries(db.unis.map((u) => [u.id, u.name])) }), [db.anns, db.unis]);
  const inbox = useInbox({
    role: 'gsp',
    access: 'all',
    agency: acc.agency,
    country,
    apps,
    students,
    anns: ownAnns,
    onOpen: (t) => openNote(t),
    onCourses: (uni) => {
      setSearch((p) => runSearch({ ...newSearch(p.need.country, p.need.state), text: uni }));
      go('courses');
    },
  });
  // connected to the other roles for testing (Role, beside Prototype): see proto/link.ts
  useLinkedData(apps, setApps, students, setStudents, inbox.onIncoming);
  // Course search reads the catalogue as the team keeps it: live courses at live universities and active campuses,
  // each university with its territory rules and its partner's commission
  const catalogue = useMemo(() => {
    const ip = new Map(db.ips.map((p) => [p.id, p]));
    const unis = new Map(db.unis.filter((u) => u.status === 'Live').map((u) => [u.id, forSearch(u, ip.get(u.ip))]));
    const courses = db.courses.filter((c) => searchable(c) && unis.has(c.uni.id) && unis.get(c.uni.id)!.campuses.some((x) => x.name === c.campus.name)).map((c) => ({ ...c, uni: unis.get(c.uni.id)! }));
    return { courses, unis: [...unis.values()] };
  }, [db.ips, db.unis, db.courses]);
  setCatalogue(catalogue.courses, catalogue.unis);
  const appsByUni = useMemo(() => {
    const m: Record<string, number> = {};
    apps.forEach((a) => {
      const id = courseOf(a)?.uni.id;
      if (id) m[id] = (m[id] ?? 0) + 1;
    });
    return m;
  }, [apps]);

  // moving between sections with something open: a student's record, an application, the new application sheet
  const [jump, setJump] = useState<PortalStart | undefined>();
  const begin = jump ?? start;
  const seenStart = useRef(start?.key);
  useEffect(() => {
    if (!start || start.key === seenStart.current) return;
    seenStart.current = start.key;
    setJump(undefined);
    setSection(sectionOf(start.section));
    if (start.search) setSearch(start.search);
    if (start.students) setStudents(start.students);
    if (start.apps || start.students) setApps(start.apps ?? (start.students?.length ? sampleApplications() : []));
    setDesks({});
  }, [start?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const jumpTo = (p: Omit<PortalStart, 'key'>) => {
    setJump({ ...p, key: `jump-${Date.now()}` });
    setSection(sectionOf(p.section));
    scrollTop();
  };

  // picking a section in the menu always lands on its first page
  const [navKey, setNavKey] = useState(0);
  const go = (k: Section) => {
    setSection(k);
    setFocus(null);
    setNavKey((n) => n + 1);
    scrollTop();
  };
  const openNote = (t: NoteTarget) => {
    if ('app' in t) jumpTo({ section: 'applications', app: { open: t.app } });
    else if ('student' in t) jumpTo({ section: 'students', open: t.student, tab: 'personal' });
    else go(t.page === 'profile' ? 'profile' : 'home');
  };
  const openRecord = (t: Target) => {
    setSection(t.section);
    setFocus({ ...t, key: Date.now() });
    scrollTop();
  };
  const initials = GSP_USER.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  const org = `${GSP_USER.org} · ${GSP_USER.role}`;

  const sidebar = (
    <nav aria-label="Main">
      <ul className="pnav">
        {NAV.map((n) => {
          const active = section === n.key;
          return (
            <li key={n.key}>
              <button type="button" className={`pnav__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(n.key)}>
                {active && <motion.span layoutId="pnav-lens" className="pnav__lens" transition={reduce ? { duration: 0 } : lensSpring} />}
                <Icon name={n.icon} size={20} />
                <span className="pnav__label">{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const tabbar = (
    <nav className="tabbar glass" aria-label="Main">
      <GlassRim />
      <ul className="tabbar__list">
        {NAV.filter((n) => TABS.includes(n.key)).map((n) => {
          const active = section === n.key;
          return (
            <li key={n.key}>
              <button type="button" className={`tab ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(n.key)}>
                {active && <motion.span layoutId="tab-lens" className="tab__lens" transition={reduce ? { duration: 0 } : lensSpring} />}
                <span className="tab__icon">
                  <Icon name={n.icon} size={22} />
                </span>
                <span className="tab__label">{n.short}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const page: PageProps = { db, set: setDb, focus: focus?.section === section ? focus : null, navKey, open: openRecord, say, scrollTop, me: GSP_USER.name };
  const content =
    section === 'home' ? (
      <TeamHome first={GSP_USER.first} db={db} open={openRecord} me={GSP_USER.name} />
    ) : section === 'mywork' ? (
      <WorkPage section="mywork" role="institution-partner" go={(k) => go(k as Section)} openApp={(id) => jumpTo({ section: 'applications', app: { open: id } })} />
    ) : section === 'profile' ? (
      <StaffProfile email={GSP_USER.email} onSignOut={onSignOut} />
    ) : section === 'students' ? (
      <Students
        list={studentsView}
        set={setStudents}
        team={team}
        me={acc.name}
        nationality={country}
        start={begin?.section === 'students' ? { key: begin.key, add: begin.add, open: begin.open, tab: begin.tab } : undefined}
        navKey={navKey}
        scrollTop={scrollTop}
        onFindCourses={(s) => {
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
        desks={desks}
        setDesks={setDesks}
        students={studentsView}
        setStudents={setStudents}
        team={team}
        me={acc.name}
        agency={acc.agency}
        start={begin?.section === 'applications' && begin.app ? { key: begin.key, ...begin.app } : undefined}
        navKey={navKey}
        scrollTop={scrollTop}
        onOpenStudent={(id, tab) => jumpTo({ section: 'students', open: id, tab: tab ?? 'personal' })}
        nationality={country}
        onFindCourses={() => go('courses')}
      />
    ) : section === 'courses' ? (
      <FindCourses
        s={search}
        set={setSearch}
        canApply
        agency={acc.agency}
        onApply={(c) => jumpTo({ section: 'applications', app: { add: { courseId: c.id, studentId: search.studentId } } })}
        students={studentsView}
        home={{ country, state: join?.form.state || '' }}
        onShortlist={(id, ids) => setStudents((l) => l.map((x) => (x.id === id ? { ...x, shortlist: ids } : x)))}
        onOpenShortlist={(id) => jumpTo({ section: 'students', open: id, tab: 'shortlist' })}
        from={{ org: 'upGrad GSP', name: GSP_USER.name, email: GSP_USER.email }}
      />
    ) : section === 'universities' ? (
      <Universities {...page} appsByUni={appsByUni} />
    ) : section === 'catalogue' ? (
      <Catalogue {...page} />
    ) : section === 'ips' ? (
      <InstitutionPartners {...page} appsByUni={appsByUni} />
    ) : section === 'announcements' ? (
      <Announcements {...page} />
    ) : (
      <RecruitmentPartners {...page} />
    );

  return (
    <AppShell
      brand={['GSP', 'Institution']}
      sidebar={sidebar}
      footer={<AccountMenu name={GSP_USER.name} org={org} email={GSP_USER.email} onSignOut={onSignOut} />}
      tools={<ThemeToggle />}
      corner={inbox.corner}
      topEnd={
        <div className="topend">
          {inbox.top}
          <ThemeToggle />
          <button
            type="button"
            className={`topend__me ${section === 'profile' ? 'is-active' : ''}`}
            aria-label={`Account: ${GSP_USER.name}, ${org}`}
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
          key={section}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
      <Toast msg={msg} />
      {inbox.toast}
    </AppShell>
  );
}
