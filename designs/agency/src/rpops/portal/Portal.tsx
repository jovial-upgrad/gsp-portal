import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppShell } from '../../shell/AppShell';
import { ThemeToggle } from '../../components/ThemeToggle';
import { GlassRim } from '../../components/GlassRim';
import { AccountMenu } from '../../components/AccountMenu';
import { Icon } from '../../components/Icon';
import type { Account } from '../../screens/signin/model';
import type { SignupState } from '../../screens/signup/model';
import { Notices } from '../../finance/commission/Notices';
import { FIRST, NAV, TABS, VIEW, type NavItem, type Section } from './model';
import { AccessProvider, ViewOnlyNote, ViewOnlyProvider, type Feature } from '../../proto/viewOnly';
import { InstitutionPartners } from '../../institution/records/InstitutionPartners';
import type { Focus, PageProps, Target } from '../../institution/portal/model';
import { MyWork } from '../work/MyWork';
// GSP · Institution's own pages, as GSP · Admin uses them: a change there shows here too
import { FindCourses } from '../../institution/courses/FindCourses';
import { newSearch, runSearch, setCatalogue, type CourseSearch } from '../../institution/courses/search';
import { Students } from '../../institution/students/Students';
import { fullName, sampleStudents, teamFor, type Student } from '../../data/students';
import type { AddState } from '../../institution/students/form';
import type { RecordTab } from '../../institution/students/StudentRecord';
import { Applications, type AppsStart } from '../../institution/applications/Applications';
import { sampleApplications, studentApps, type Application } from '../../data/applications';
import { useLinkedData } from '../../proto/link';
import { useInbox } from '../../screens/portal/Inbox';
import type { NoteTarget } from '../../data/inbox';
import type { Desk } from '../../institution/applications/desk';
import { GSP_USER } from '../user';
import { GSP_USER as INSTITUTION_USER, signInAs as actAsInInstitution } from '../../institution/user';
import { sampleDb } from '../../institution/data/store';
import { forSearch, searchable } from '../../institution/data/catalogue';
// RP Ops' own pages (4 Nov): its Recruitment partners and Master Partners, changed together when an RP is linked
import { OpsHome } from '../records/Home';
import { RecruitmentPartners } from '../records/RecruitmentPartners';
import { MasterPartners } from '../records/MasterPartners';
import { sampleOps, type OpsRp } from '../records/data';
import { sampleMps, type MasterPartner } from '../records/masters';
import type { OpsFocus, OpsTarget } from '../records/parts';
import { nowIso, todayIso } from '../../institution/data/records';
import '../records/rpops.css';
import { AccountPage } from '../../institution/records/Account';
import { Toast } from '../../institution/records/parts';
import { MailInbox } from '../../mailbox/MailInbox';
import { sampleMailbox, type Mailbox } from '../../data/mailbox';
import '../../screens/signup/signup.css';
import '../../screens/portal/portal.css';
import '../../institution/institution.css';

const ease = [0.2, 0.8, 0.2, 1] as const;
const lensSpring = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 } as const;

/** A review state can open the portal on a section: with a course search made, or with students and the add form. */
export type PortalStart = {
  key: string;
  /** Other roles' states can name pages RP Ops doesn't have (Earnings): they open Home. */
  section: Section | 'earnings';
  search?: CourseSearch;
  students?: Student[];
  add?: AddState | true;
  open?: string;
  tab?: RecordTab;
  apps?: Application[];
  app?: Omit<AppsStart, 'key'>;
};
const sectionOf = (s?: PortalStart['section']): Section => (!s || s === 'earnings' ? FIRST : s);

/**
 * RP Ops' portal (Nesil, 4 Nov): GSP's team for the recruitment partners. Applications, Students and Course search
 * are GSP · Institution's own pages (as GSP · Admin has them); Home (its queue), Recruitment partners and Master
 * Partners are RP Ops' own; GSP's Inbox after Home, in the same design as every role. Signed in as Rohan Desai, RP Ops; while RP Ops is open, the shared pages act as Rohan,
 * and GSP · Institution gets its own person back after.
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
  // the shared pages act as GSP · Institution's signed-in person: while RP Ops is open, that's Rohan
  const [handBack] = useState(() => {
    const was = { ...INSTITUTION_USER };
    actAsInInstitution({ ...GSP_USER, set: true });
    return was;
  });
  useEffect(
    () => () => {
      actAsInInstitution({ ...handBack, set: true });
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [section, setSection] = useState<Section>(sectionOf(start?.section));
  const country = join?.form.country || 'India';
  const [search, setSearch] = useState<CourseSearch>(() => start?.search ?? newSearch(country, join?.form.state || ''));
  const [students, setStudents] = useState<Student[]>(() => start?.students ?? sampleStudents(acc.name));
  const [apps, setApps] = useState<Application[]>(() => start?.apps ?? (start?.students ? (start.students.length ? sampleApplications() : []) : sampleApplications()));
  const [desks, setDesks] = useState<Record<string, Desk>>({});
  const studentsView = useMemo(() => students.map((s) => ({ ...s, apps: studentApps(apps, s.id) })), [students, apps]);
  const [mailbox, setMailbox] = useState<Mailbox>(() => sampleMailbox('rp-ops', apps, students, GSP_USER));
  const team = teamFor(acc.name);

  // the catalogue course search reads; RP Ops' recruitment partners and Master Partners; changes stay in this portal
  const [db, setDb] = useState(sampleDb);
  // 6 Nov: GSP · Institution's Institution partners page opens its records this way
  const [ifocus, setIfocus] = useState<Focus | null>(null);
  const [rps, setRps] = useState<OpsRp[]>(sampleOps);
  const [mps, setMps] = useState<MasterPartner[]>(sampleMps);
  const [focus, setFocus] = useState<OpsFocus | null>(null);
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const say = (text: string) => setMsg({ text, key: Date.now() });

  // the bell and the megaphone, as in every role
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
  useLinkedData(apps, setApps, students, setStudents, inbox.onIncoming);
  // Course search reads the catalogue as the Institution Team keeps it
  const catalogue = useMemo(() => {
    const ip = new Map(db.ips.map((p) => [p.id, p]));
    const unis = new Map(db.unis.filter((u) => u.status === 'Live').map((u) => [u.id, forSearch(u, ip.get(u.ip))]));
    const courses = db.courses.filter((c) => searchable(c) && unis.has(c.uni.id) && unis.get(c.uni.id)!.campuses.some((x) => x.name === c.campus.name)).map((c) => ({ ...c, uni: unis.get(c.uni.id)! }));
    return { courses, unis: [...unis.values()] };
  }, [db.ips, db.unis, db.courses]);
  setCatalogue(catalogue.courses, catalogue.unis, db.anns);

  // moving between sections with something open; a review state's opening counts once (as in RP Admin)
  const [jump, setJump] = useState<PortalStart | undefined>();
  const [moved, setMoved] = useState(false);
  const begin = jump ?? (moved ? undefined : start);
  const seenStart = useRef(start?.key);
  useEffect(() => {
    if (!start || start.key === seenStart.current) return;
    seenStart.current = start.key;
    setJump(undefined);
    setMoved(false);
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
    setJump(undefined);
    setMoved(true);
    setSection(k);
    setFocus(null);
    setIfocus(null);
    setNavKey((n) => n + 1);
    scrollTop();
  };
  const openNote = (t: NoteTarget) => {
    if ('app' in t) jumpTo({ section: 'applications', app: { open: t.app } });
    else if ('student' in t) jumpTo({ section: 'students', open: t.student, tab: 'personal' });
    else go(t.page === 'profile' ? 'profile' : FIRST);
  };
  // a recruitment partner's page opens its Master Partner, and a Master Partner's its RPs
  const openRecord = (t: OpsTarget) => {
    setJump(undefined);
    setMoved(true);
    setSection(t.section);
    setFocus({ ...t, key: Date.now() });
    scrollTop();
  };
  // an institution partner (its universities aren't RP Ops' pages)
  const openInst = (t: Target) => {
    if (t.section !== 'ips') return;
    setJump(undefined);
    setMoved(true);
    setSection('ips');
    setIfocus({ ...t, key: Date.now() });
    scrollTop();
  };
  /** What RP Ops leaves out of the pages it shares, and adds (6 Nov access sheet; src/proto/viewOnly.tsx). */
  const HIDE: Feature[] = ['courses.commission', 'app.mail', 'app.submission', 'app.base-commission'];
  const SHOW: Feature[] = ['rp.commission', 'rp.view.edit'];
  /** Link an RP to a Master Partner, or unlink it (null): the RP's Logs and both Master Partners' Logs say so. */
  const link = (rpId: string, mpId: string | null) => {
    const r = rps.find((x) => x.id === rpId);
    if (!r || (r.mp ?? null) === mpId) return;
    const was = mps.find((m) => m.id === r.mp);
    const to = mps.find((m) => m.id === mpId);
    const me = GSP_USER.name;
    const at = nowIso();
    setRps((l) =>
      l.map((x) =>
        x.id === rpId
          ? { ...x, mp: mpId ?? undefined, mpSince: mpId ? todayIso() : undefined, log: [...x.log, { at: Date.now(), what: to ? `Linked to ${to.name} (Master Partner) by ${me}` : `Unlinked from ${was?.name ?? 'its Master Partner'} by ${me}` }] }
          : x,
      ),
    );
    setMps((l) =>
      l.map((m) =>
        m.id === mpId || m.id === was?.id
          ? { ...m, last: { by: me, at }, log: [...m.log, { id: `mpl-${Date.now()}-${m.id}`, at, by: me, part: 'rps', what: `${m.id === mpId ? 'Linked' : 'Unlinked'} ${r.name} (${r.code})` }] }
          : m,
      ),
    );
  };
  const initials = GSP_USER.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  const org = `${GSP_USER.org} · ${GSP_USER.role}`;

  const item = (n: NavItem) => {
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
  };
  const sidebar = (
    <nav aria-label="Main">
      <ul className="pnav">{NAV.map(item)}</ul>
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

  const records = { focus: focus?.section === section ? focus : null, navKey, open: openRecord, say, scrollTop, me: GSP_USER.name };
  const instPage: PageProps = { db, set: setDb, focus: ifocus?.section === section ? ifocus : null, navKey, open: openInst, say, scrollTop, me: GSP_USER.name };
  const appsByUni = useMemo(() => {
    const m: Record<string, number> = {};
    apps.forEach((a) => {
      const id = db.courses.find((c) => c.id === a.courseId)?.uni.id;
      if (id) m[id] = (m[id] ?? 0) + 1;
    });
    return m;
  }, [apps, db.courses]);
  const content =
    section === 'home' ? (
      <OpsHome first={GSP_USER.first} rps={rps} open={openRecord} />
    ) : section === 'work' ? (
      <MyWork />
    ) : section === 'inbox' ? (
      <MailInbox box={mailbox} setBox={setMailbox} me={GSP_USER} apps={apps} students={students} navKey={navKey} onOpenApp={(id) => jumpTo({ section: 'applications', app: { open: id } })} />
    ) : section === 'profile' ? (
      <AccountPage name={GSP_USER.name} org={org} email={GSP_USER.email} onSignOut={onSignOut} />
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
    ) : section === 'ips' ? (
      <InstitutionPartners {...instPage} appsByUni={appsByUni} />
    ) : section === 'notices' ? (
      <Notices me={GSP_USER.name} />
    ) : section === 'mps' ? (
      <MasterPartners mps={mps} setMps={setMps} rps={rps} link={link} {...records} />
    ) : (
      <RecruitmentPartners rps={rps} setRps={setRps} mps={mps} link={link} {...records} />
    );

  return (
    <AppShell
      brand={['GSP', 'RP Ops']}
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
          <AccessProvider hide={HIDE} show={SHOW}>
            <ViewOnlyProvider on={VIEW.includes(section)}>
              {VIEW.includes(section) && <ViewOnlyNote page>View only: RP Ops can look at this page, not change it.</ViewOnlyNote>}
              {content}
            </ViewOnlyProvider>
          </AccessProvider>
        </motion.div>
      </AnimatePresence>
      <Toast msg={msg} />
      {inbox.toast}
    </AppShell>
  );
}
