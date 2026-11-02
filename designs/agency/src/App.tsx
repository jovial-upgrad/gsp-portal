import { ToastHost } from './components/Toast';
import { UnsavedHost } from './components/unsaved';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SignupBar, SignupPanel, accountMade } from './screens/signup/SignupFlow';
import { PRESETS, clearDraft, initialState, loadDraft, saveDraft, type SignupState } from './screens/signup/model';
import { SignInHero, SignInPanel } from './screens/signin/SignInPage';
import { AUTH_PRESETS, SAMPLE_ACCOUNT, initialAuth, type Account, type AuthState } from './screens/signin/model';
import { Portal } from './screens/portal/Portal';
// GSP Team starts as a copy of the agency portal, so it can change without touching RP Admin
import { Portal as GspPortal } from './gsp/portal/Portal';
import { Portal as InstitutionPortal } from './institution/portal/Portal';
// the Institution Team (GSP · Institution) signs in its own way: a GSP email, a password set up the first time, no registering
import { TeamSignIn } from './institution/signin/TeamSignIn';
import { TEAM_AUTH_PRESETS } from './institution/signin/model';
// GSP Admin (GSP · Admin, 30 Oct): builds on the Institution Team, with its own sign-in
import { Portal as AdminPortal } from './admin/portal/Portal';
import type { ComponentProps } from 'react';

/** GSP Admin's portal for each role that uses it, with that role's menu (admin/portal/variants.ts). */
const ADMIN_PORTALS = {
  'gsp-admin': (p: ComponentProps<typeof AdminPortal>) => <AdminPortal {...p} variant="admin" />,
  'gsp-recruitment': (p: ComponentProps<typeof AdminPortal>) => <AdminPortal {...p} variant="recruitment" />,
  'gsp-bap': (p: ComponentProps<typeof AdminPortal>) => <AdminPortal {...p} variant="bap" />,
  'gsp-finance': (p: ComponentProps<typeof AdminPortal>) => <AdminPortal {...p} variant="finance" />,
  // View Only reuses GSP · Admin's pages, read only (S1-1)
  'gsp-view-only': (p: ComponentProps<typeof AdminPortal>) => <AdminPortal {...p} variant="viewonly" />,
};
import { TeamSignIn as AdminSignIn } from './admin/signin/TeamSignIn';
import { TEAM_AUTH_PRESETS as ADMIN_AUTH_PRESETS } from './admin/signin/model';
import { PORTAL_PRESETS, portalAccount } from './screens/portal/model';
import { COURSE_PRESETS } from './screens/courses/search';
import { STUDENT_PRESETS } from './screens/students/presets';
import { APP_PRESETS } from './screens/applications/presets';
import type { PortalStart } from './screens/portal/Portal';
import type { Section } from './screens/portal/model';
import { AuthScene } from './shell/AuthScene';
import { ProtoPanel, type Device } from './proto/ProtoPanel';
import { ADMIN_LIKE, ADMISSIONS_LIKE, INSTITUTION_LIKE, RP_ROLE, roleOf, setCurrentRole, type Role } from './proto/roles';
import { actAsGspRole } from './gsp/user';
import { actAsInstitutionRole } from './institution/user';
import { accountByRole } from './screens/signin/model';
import { ADMIN_STATES, setSim } from './admin/config/states';
import { setLink, useLink } from './proto/link';
import { SideBySide } from './proto/SideBySide';
import { sampleApplications, courseOf } from './data/applications';
import { fullName, sampleStudents } from './data/students';
import { ThemeContext, type Theme } from './theme';

/** In a pane of Side by side, the window is named after the pane's role, which it keeps. */
const PANE: Role | null = typeof window !== 'undefined' && window.name.startsWith('gsp-pane-') ? roleOf(window.name.slice('gsp-pane-'.length)) : null;
/** Side by side loads this page again in two frames, which a page shown from inline HTML can't do. */
const CAN_SPLIT = !PANE && typeof window !== 'undefined' && !/^(about|data):/.test(window.location.href);

/** home: an established partner who signed in. portal: the agency that just registered, while GSP verifies it and after. */
type Route = 'auth' | 'signup' | 'portal' | 'home';

const routeOf = (token: string | null): Route | null =>
  !token
    ? null
    : token in AUTH_PRESETS || token in TEAM_AUTH_PRESETS || token in ADMIN_AUTH_PRESETS
      ? 'auth'
      : token in PRESETS
        ? 'signup'
        : token in PORTAL_PRESETS || token in COURSE_PRESETS || token in STUDENT_PRESETS || token in APP_PRESETS
          ? 'portal'
          : token === 'home' || token in ADMIN_STATES
            ? 'home'
            : null;
/** "Become a GSP partner" always means a new registration: a draft whose account already exists starts again. */
const toRegister = (s: SignupState | null) => (!s || accountMade(s) ? initialState() : s);
const readHash = () => {
  const k = window.location.hash.replace('#', '');
  return routeOf(k) ? k : null;
};

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage unavailable: preferences just aren't kept */
  }
}

export default function App() {
  const reduce = useReducedMotion();
  const first = readHash();
  const [token, setToken] = useState<string | null>(first);
  const [route, setRoute] = useState<Route>(routeOf(first) ?? 'auth');
  const [auth, setAuth] = useState<AuthState>(() =>
    first && first in AUTH_PRESETS ? AUTH_PRESETS[first].make() : initialAuth(readPref('gsp-remember-id', '')),
  );
  // A reload on the plain #signup link keeps the partner's draft; the other registration links are fixed review states.
  // Portal links use the partner's own registration when there is one.
  const [signup, setSignup] = useState<SignupState>(() =>
    first && first in PRESETS && first !== 'signup'
      ? PRESETS[first].make()
      : first && first in PORTAL_PRESETS
        ? PORTAL_PRESETS[first].make(loadDraft())
        : first && (first in COURSE_PRESETS || first in STUDENT_PRESETS || first in APP_PRESETS)
          ? PORTAL_PRESETS['portal-verified'].make(loadDraft())
          : first === 'signup'
            ? toRegister(loadDraft())
            : loadDraft() ?? initialState(),
  );
  const [account, setAccount] = useState<Account>(SAMPLE_ACCOUNT);
  // a page state's review state opens an Admin page (PRD slice 1)
  const [adminStart, setAdminStart] = useState<{ key: string; section: Section } | undefined>(() => (first && first in ADMIN_STATES ? (setSim(ADMIN_STATES[first].sim), { key: first, section: ADMIN_STATES[first].section as Section }) : undefined));
  // course search review states open a verified agency, with its students to search for, on Find courses with a search already made
  const courseStart = (k: string, s: SignupState): PortalStart => ({
    key: `${k}-${Date.now()}`,
    section: 'courses' as Section,
    search: COURSE_PRESETS[k].make(),
    students: STUDENT_PRESETS.students.make(portalAccount(s).name).students,
  });
  // student review states open a verified agency's Students page, with its students and sometimes the add form
  const studentStart = (k: string, s: SignupState): PortalStart =>
    k in APP_PRESETS
      ? { key: `${k}-${Date.now()}`, section: 'applications', ...APP_PRESETS[k].make(portalAccount(s).name) }
      : { key: `${k}-${Date.now()}`, section: 'students', ...STUDENT_PRESETS[k].make(portalAccount(s).name) };
  const [start, setStart] = useState<PortalStart | undefined>(() =>
    first && first in COURSE_PRESETS ? courseStart(first, signup) :first && (first in STUDENT_PRESETS || first in APP_PRESETS) ? studentStart(first, signup) : undefined,
  );
  // light unless the person picked dark (an older 'system' choice falls back to light)
  const [theme, setTheme] = useState<Theme>(() => (readPref<string>('gsp-theme', 'light') === 'dark' ? 'dark' : 'light'));
  const [device, setDevice] = useState<Device>(() => readPref<Device>('gsp-proto-device', 'desktop'));
  // the role the portal is seen as (testing only): RP Admin, the agency portal, GSP Team, GSP · Institution or GSP · Admin
  const [role, setRole] = useState<Role>(() => PANE ?? roleOf(readPref<string>('gsp-proto-role', 'rp-admin')));
  // the two roles connected for testing, and seen side by side
  const link = useLink();
  const [split, setSplit] = useState(false);
  const links = useMemo(() => {
    const ss = sampleStudents('');
    return sampleApplications().map((a) => {
      const st = ss.find((x) => x.id === a.studentId);
      return { id: a.id, label: `${a.id} · ${st ? fullName(st) : a.studentId}, ${courseOf(a).uni.name.replace(/^University of (the )?| University$/g, '')}` };
    });
  }, []);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveDraft(signup), [signup]);
  // the latest registration, for review links that need it while they set it
  const signupRef = useRef(signup);
  signupRef.current = signup;
  useEffect(() => writePref('gsp-proto-device', device), [device]);
  useEffect(() => {
    if (!PANE) writePref('gsp-proto-role', role);
  }, [role]);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    writePref('gsp-theme', theme);
  }, [theme]);

  const scrollTop = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (device === 'phone') frameRef.current?.scrollTo({ top: 0 });
      else window.scrollTo({ top: 0 });
      // wide screens: the portal's page scrolls in its own area, under the strip with the notification buttons
      document.querySelector('.shell__scroll')?.scrollTo({ top: 0 });
      document.getElementById('main')?.focus({ preventScroll: true });
    });
  }, [device]);

  const mark = (k: string | null) => {
    setToken(k);
    try {
      window.history.replaceState(null, '', k ? `#${k}` : window.location.pathname);
    } catch {
      /* ignore */
    }
  };

  const jump = useCallback(
    (k: string) => {
      const r = routeOf(k);
      if (!r) return;
      if (r === 'auth' && k in AUTH_PRESETS) setAuth(AUTH_PRESETS[k].make());
      if (r === 'signup') setSignup(PRESETS[k].make());
      if (r === 'portal' && k in COURSE_PRESETS) {
        setSignup((prev) => PORTAL_PRESETS['portal-verified'].make(prev));
        setStart(courseStart(k, PORTAL_PRESETS['portal-verified'].make(signupRef.current)));
      } else if (r === 'portal' && (k in STUDENT_PRESETS || k in APP_PRESETS)) {
        setSignup((prev) => PORTAL_PRESETS['portal-verified'].make(prev));
        setStart(studentStart(k, PORTAL_PRESETS['portal-verified'].make(signupRef.current)));
      } else if (r === 'portal') {
        setSignup((prev) => PORTAL_PRESETS[k].make(prev));
        setStart({ key: `${k}-${Date.now()}`, section: 'home' });
      }
      if (r === 'home') setAccount(SAMPLE_ACCOUNT);
      // the page states' review states (PRD slice 1): an Admin page, loading, failing, view only…
      if (k in ADMIN_STATES) {
        setSim(ADMIN_STATES[k].sim);
        setAdminStart({ key: `${k}-${Date.now()}`, section: ADMIN_STATES[k].section as Section });
      } else if (r === 'home') setSim(null);
      setRoute(r);
      mark(k);
      scrollTop();
    },
    [scrollTop],
  );

  useEffect(() => {
    const onHash = () => {
      const k = readHash();
      if (k) jump(k);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [jump]);

  const setAuthFree = useCallback((fn: (a: AuthState) => AuthState) => {
    setAuth(fn);
    setToken(null);
  }, []);
  const setSignupFree = useCallback((fn: (s: SignupState) => SignupState) => {
    setSignup(fn);
    setToken(null);
  }, []);

  const go = (r: Route, k: string | null) => {
    setRoute(r);
    mark(k);
    scrollTop();
  };

  const toSignIn = () => {
    setAuth(initialAuth(signup.form.email || readPref('gsp-remember-id', '')));
    go('auth', 'signin');
  };
  const signOut = (id: string) => {
    setAuth({ ...initialAuth(id), notice: 'You’re signed out.' });
    go('auth', 'signin');
  };
  // Sign in and becoming a partner share one scene that stays mounted and looks the same: the photo, its statement
  // and the panel stay in place and only the panel's content changes; only going in or out of the portal fades the whole page.
  const isPublic = route === 'auth' || route === 'signup';
  // every role in the Role menu has its own signed-in person (Jovial, 2 Nov); the new ones reuse existing views (S1-1)
  setCurrentRole(role);
  if (ADMISSIONS_LIKE.includes(role)) actAsGspRole();
  if (INSTITUTION_LIKE.includes(role)) actAsInstitutionRole();
  const RolePortal = ADMISSIONS_LIKE.includes(role) ? GspPortal : INSTITUTION_LIKE.includes(role) ? InstitutionPortal : ADMIN_LIKE.includes(role) ? ADMIN_PORTALS[role as keyof typeof ADMIN_PORTALS] : Portal;
  // the RP's roles: the test agency's RP Admin, Branch Admin or a counsellor
  const rpAccount = RP_ROLE[role] && RP_ROLE[role] !== 'RP Admin' ? accountByRole(RP_ROLE[role]!) : account;
  // the Institution Team and GSP Admin sign in with a GSP email, each in its own scene
  // every GSP role signs in at the GSP portal (PRD slice 1, Sign-in): a GSP email, a password set up the first time
  const team = INSTITUTION_LIKE.includes(role) || ADMIN_LIKE.includes(role) || ADMISSIONS_LIKE.includes(role);
  const TeamGate = team ? AdminSignIn : TeamSignIn;
  const teamPresets = team ? ADMIN_AUTH_PRESETS : TEAM_AUTH_PRESETS;
  // switching role shows that role's portal: the same state if one is open, otherwise its Home, signed in
  const switchRole = (r: Role) => {
    setRole(r);
    if (isPublic) jump('home');
    else scrollTop();
  };

  const view = (
    <AnimatePresence mode="wait">
      <motion.div
        key={isPublic ? 'public' : `${route}-${role}`}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.995 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {isPublic && team && <TeamGate key={`team-${role}-${token}`} preset={token} notice={auth.notice} onSignedIn={() => go('home', 'home')} />}
        {isPublic && !team && (
          <AuthScene
            sceneKey={route}
            hero={<SignInHero />}
            heroKey="statement"
            bar={route === 'signup' ? <SignupBar onSignIn={toSignIn} /> : undefined}
          >
            {route === 'auth' ? (
              <SignInPanel
                a={auth}
                set={setAuthFree}
                onJoin={() => {
                  setSignup(toRegister);
                  go('signup', 'signup');
                }}
                onSignedIn={(acc) => {
                  if (auth.remember) writePref('gsp-remember-id', auth.id.trim());
                  setAccount(acc);
                  go('home', 'home');
                }}
              />
            ) : (
              <SignupPanel
                s={signup}
                set={setSignupFree}
                scrollTop={scrollTop}
                onSignIn={toSignIn}
                onPortal={() => {
                  // the account exists: the portal opens on Home, where registering carries on
                  setStart({ key: `registered-${Date.now()}`, section: 'home' });
                  go('portal', 'portal');
                }}
              />
            )}
          </AuthScene>
        )}
        {route === 'portal' && (
          <RolePortal acc={portalAccount(signup)} join={signup} set={setSignupFree} scrollTop={scrollTop} onSignOut={() => signOut(signup.form.email)} start={start} />
        )}
        {route === 'home' && <RolePortal key={role} acc={rpAccount} join={null} scrollTop={scrollTop} start={ADMIN_LIKE.includes(role) ? adminStart : undefined} onSignOut={() => signOut(readPref('gsp-remember-id', ''))} />}
      </motion.div>
    </AnimatePresence>
  );

  const teamGroups = useMemo(
    () => [
      { title: 'Sign in', items: ['signin', 'signin-error', 'signin-locked', 'signin-unset', 'signin-off', 'forgot', 'forgot-code', 'code-expired', 'code-many', 'forgot-new', 'forgot-done'].filter((k) => k in teamPresets).map((k) => ({ key: k, label: teamPresets[k].label })) },
      { title: 'Set up a password (first time)', items: ['setup', 'setup-code', 'setup-new', 'setup-done', 'link-new', 'link-expired'].filter((k) => k in teamPresets).map((k) => ({ key: k, label: teamPresets[k].label })) },
      ...(ADMIN_LIKE.includes(role) ? [{ title: 'Admin page states (slice 1)', items: Object.entries(ADMIN_STATES).map(([key, v]) => ({ key, label: v.label })) }] : []),
      { title: 'Portal', items: [{ key: 'home', label: 'Signed in' }] },
      { title: 'Course search', items: Object.entries(COURSE_PRESETS).map(([key, v]) => ({ key, label: v.label })) },
      { title: 'Students', items: Object.entries(STUDENT_PRESETS).map(([key, v]) => ({ key, label: v.label, sub: v.label.startsWith('Add: ') })) },
      { title: 'Applications', items: Object.entries(APP_PRESETS).map(([key, v]) => ({ key, label: v.label })) },
    ],
    [teamPresets],
  );
  const groups = useMemo(
    () => [
      {
        title: 'Sign in',
        items: ['signin', 'signin-error', 'signin-locked', 'signin-agency-paused', 'forgot', 'forgot-code', 'forgot-new', 'forgot-done'].map((k) => ({ key: k, label: AUTH_PRESETS[k].label })),
      },
      { title: 'Become a partner', items: Object.entries(PRESETS).map(([key, v]) => ({ key, label: v.label })) },
      {
        title: 'Portal',
        items: [
          ...['portal-setup', 'portal-setup-docs', 'portal-verifying', 'portal-sent-back', 'portal-sent-back-2', 'portal-verified'].map((k) => ({ key: k, label: PORTAL_PRESETS[k].label })),
          { key: 'home', label: 'Established partner signed in' },
        ],
      },
      { title: 'Find courses (verified agency)', items: Object.entries(COURSE_PRESETS).map(([key, v]) => ({ key, label: v.label })) },
      { title: 'Students (verified agency)', items: Object.entries(STUDENT_PRESETS).map(([key, v]) => ({ key, label: v.label, sub: v.label.startsWith('Add: ') })) },
      { title: 'Applications (verified agency)', items: Object.entries(APP_PRESETS).map(([key, v]) => ({ key, label: v.label })) },
    ],
    [],
  );

  if (split)
    return (
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <SideBySide hash={token && (routeOf(token) === 'portal' || routeOf(token) === 'home') ? token : 'home'} links={links} onExit={() => setSplit(false)} />
      </ThemeContext.Provider>
    );

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {device === 'phone' ? (
        <div className="stage">
          <div className="device-wrap">
            <div className="device" ref={frameRef}>
              <div className="app">
                {view}
                <ToastHost />
                <UnsavedHost />
              </div>
            </div>
            <div id="layer" className="layer" />
          </div>
        </div>
      ) : (
        <>
          <div className="app">
            {view}
            <ToastHost />
            <UnsavedHost />
          </div>
          <div id="layer" className="layer" />
        </>
      )}
      <ProtoPanel
        groups={team ? teamGroups : groups}
        current={token}
        onJump={jump}
        theme={theme}
        onTheme={setTheme}
        device={device}
        onDevice={setDevice}
        role={role}
        onRole={switchRole}
        link={link}
        onLink={setLink}
        links={links}
        pane={!!PANE}
        onSplit={
          CAN_SPLIT
            ? () => {
                // seeing both is for watching a change go across, so it connects them all unless one is picked
                if (link.mode === 'off') setLink({ mode: 'all', app: link.app });
                setSplit(true);
              }
            : undefined
        }
        onReset={() => {
          clearDraft();
          writePref('gsp-remember-id', '');
          setSignup(initialState());
          jump('signin');
        }}
      />
    </ThemeContext.Provider>
  );
}
