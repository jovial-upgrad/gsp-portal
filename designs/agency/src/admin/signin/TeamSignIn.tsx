import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Field, Form, TextInput, Switch, describedBy } from '../../components/forms';
import { PasswordInput } from '../../components/PasswordInput';
import { CodeInput } from '../../components/CodeInput';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TEST_CODE } from '../../data/testing';
import { AuthScene, settle, useScene } from './AuthScene';
import {
  LOCK_MINUTES,
  MAX_ATTEMPTS,
  PASSWORD_HINT,
  TEAM_AUTH_PRESETS,
  TEAM_MEMBER,
  checkPassword,
  codeDestination,
  hasPassword,
  initialTeamAuth,
  memberFor,
  setPassword,
  verify,
  type Member,
  type PwMode,
  type PwStep,
  type TeamAuth,
} from './model';
import { signInAs } from '../user';
import '../../screens/signin/signin.css';
import '../../institution/institution.css';
import '../admin.css';

type Set = (fn: (a: TeamAuth) => TeamAuth) => void;
const ease = [0.2, 0.8, 0.2, 1] as const;
const KEY = 'gsp-team-remember-id';
const remembered = () => {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};

/**
 * The GSP Admin's way in (29 Oct): sign in with a GSP email and password, set a password up the first
 * time (a GSP admin gives access; there's no registering), or reset a forgotten one. Its own scene, with
 * "GSP Admin" beside the logo.
 */
export function TeamSignIn({ preset, notice, onSignedIn }: { preset: string | null; notice: string | null; onSignedIn: (m: Member) => void }) {
  const [a, setA] = useState<TeamAuth>(() =>
    preset && preset !== 'signin' && preset in TEAM_AUTH_PRESETS ? TEAM_AUTH_PRESETS[preset].make() : { ...initialTeamAuth(remembered()), notice },
  );
  const set: Set = (fn) => setA(fn);
  const signedIn = (m: Member) => {
    signInAs(m);
    try {
      if (a.remember) localStorage.setItem(KEY, m.email);
    } catch {
      /* not kept */
    }
    onSignedIn(m);
  };
  return (
    <AuthScene sceneKey="team" hero={<TeamHero />} heroKey="team">
      <TeamPanel a={a} set={set} onSignedIn={signedIn} />
    </AuthScene>
  );
}

/** What the photo says: the team's job, rising line by line once the photo is in. */
function TeamHero() {
  const { reduce, ready } = useScene();
  const line = (i: number) =>
    reduce ? {} : { initial: { y: '108%' }, animate: ready ? { y: '0%' } : undefined, transition: { duration: 0.9, ease: settle, delay: 0.45 + i * 0.1 } };
  return (
    <p className="auth__statement">
      <span className="auth__line">
        <motion.span className="auth__line-in" {...line(0)}>
          The universities and courses
        </motion.span>
      </span>{' '}
      <span className="auth__line auth__line--soft">
        <motion.span className="auth__line-in" {...line(1)}>
          every partner relies on.
        </motion.span>
      </span>
    </p>
  );
}

function TeamPanel({ a, set, onSignedIn }: { a: TeamAuth; set: Set; onSignedIn: (m: Member) => void }) {
  const { reduce } = useScene();
  const toFlow = (mode: PwMode, id = a.id) =>
    set((p) => ({ ...p, view: 'password', error: null, notice: null, unset: false, flow: { ...p.flow, mode, step: 'request', dir: 1, id, submitted: false, busy: false, code: '', codeError: null } }));
  const toSignIn = (notice?: string) =>
    set((p) => ({ ...p, view: 'signin', id: p.flow.id || p.id, pw: '', status: 'idle', error: null, unset: false, submitted: false, notice: notice ?? null, attempts: notice ? 0 : p.attempts, lockedUntil: notice ? 0 : p.lockedUntil }));
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={a.view === 'signin' ? 'signin' : a.flow.mode}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease }}
      >
        {a.view === 'signin' ? (
          <SignInForm a={a} set={set} onForgot={() => toFlow('reset')} onSetup={() => toFlow('setup')} onSignedIn={onSignedIn} />
        ) : (
          <PasswordFlow a={a} set={set} onBack={toSignIn} onSignedIn={onSignedIn} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------- sign in ---------- */

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

function SignInForm({ a, set, onForgot, onSetup, onSignedIn }: { a: TeamAuth; set: Set; onForgot: () => void; onSetup: () => void; onSignedIn: (m: Member) => void }) {
  const reduce = useReducedMotion();
  const pwRef = useRef<HTMLInputElement>(null);
  const [caps, setCaps] = useState(false);
  useNow(a.lockedUntil > Date.now());
  const left = Math.max(0, a.lockedUntil - Date.now());
  const stillLocked = left > 0;
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (a.lockedUntil && !stillLocked) set((p) => ({ ...p, lockedUntil: 0, attempts: 0, error: null }));
  }, [stillLocked, a.lockedUntil, set]);

  const idErr = a.submitted && !a.id.trim() ? 'Enter your GSP email.' : null;
  const pwErr = a.submitted && !a.pw && !a.unset ? 'Enter your password.' : null;

  const submit = () => {
    if (stillLocked || a.status !== 'idle') return;
    // someone with access who hasn't set a password: no password to check, so offer to set one up
    const m = memberFor(a.id);
    if (m && !hasPassword(m)) return set((p) => ({ ...p, submitted: true, unset: true, error: null, notice: null, pw: '' }));
    if (!a.id.trim() || !a.pw) return set((p) => ({ ...p, submitted: true, error: null, notice: null, unset: false }));
    set((p) => ({ ...p, submitted: true, status: 'checking', error: null, notice: null, unset: false }));
    timer.current = window.setTimeout(() => {
      const ok = verify(a.id, a.pw);
      if (!ok) {
        const attempts = a.attempts + 1;
        const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60_000 : 0;
        const tries = MAX_ATTEMPTS - attempts;
        set((p) => ({
          ...p,
          status: 'idle',
          pw: '',
          attempts,
          lockedUntil,
          error: lockedUntil
            ? null
            : tries <= 2
              ? `That email and password don’t match. ${tries} ${tries === 1 ? 'try' : 'tries'} left before sign-in pauses for ${LOCK_MINUTES} minutes.`
              : 'That email and password don’t match. Check both, or reset your password.',
        }));
        window.setTimeout(() => pwRef.current?.focus(), 40);
      } else {
        set((p) => ({ ...p, status: 'success' }));
        timer.current = window.setTimeout(() => onSignedIn(ok), 1500);
      }
    }, 900);
  };

  if (a.status === 'success') {
    const m = memberFor(a.id) ?? TEAM_MEMBER;
    return <Welcome title={`Welcome back, ${m.first}`} text="Opening GSP Admin portal…" bar />;
  }

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  return (
    <div className="auth-form">
      <h1 className="auth-form__title">Welcome back</h1>
      <p className="auth-form__lead">Sign in to GSP Admin with your GSP email.</p>

      <AnimatePresence initial={false} mode="popLayout">
        {stillLocked ? (
          <motion.div key="locked" className="banner banner--bad" role="alert" {...bannerMotion(reduce)}>
            <Icon name="lock" size={18} />
            <div className="banner__body">
              <p className="banner__title">
                Sign-in is paused for <span className="num">{mm}:{String(ss).padStart(2, '0')}</span>
              </p>
              <p>After {MAX_ATTEMPTS} attempts we pause sign-in to keep GSP’s records safe. Reset your password to get in now.</p>
              <Button size="sm" variant="secondary" onClick={onForgot} iconLeft={<Icon name="key" size={16} />}>
                Reset password
              </Button>
            </div>
          </motion.div>
        ) : a.unset ? (
          <motion.div key="unset" className="banner isign__unset" role="status" {...bannerMotion(reduce, false)}>
            <Icon name="key" size={18} />
            <div className="banner__body">
              <p className="banner__title">Set up your password first</p>
              <p>You have access, but no password yet. We’ll email you a code to set one.</p>
              <Button size="sm" variant="secondary" onClick={onSetup} iconRight={<Icon name="arrowRight" size={16} />}>
                Set up your password
              </Button>
            </div>
          </motion.div>
        ) : a.error ? (
          <motion.div key={a.error} className="banner banner--bad" role="alert" {...bannerMotion(reduce)}>
            <Icon name="alert" size={18} />
            <p className="banner__body">{a.error}</p>
          </motion.div>
        ) : a.notice ? (
          <motion.div key="notice" className="banner banner--ok" role="status" {...bannerMotion(reduce, false)}>
            <Icon name="checkCircle" size={18} />
            <p className="banner__body">{a.notice}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Form className="auth-form__fields" onSubmit={submit}>
        <Field id="si-id" label="GSP email" error={idErr}>
          <TextInput
            id="si-id"
            name="username"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@gsp.upgrad.com"
            value={a.id}
            invalid={!!idErr || !!a.error}
            aria-describedby={describedBy('si-id', idErr)}
            onChange={(e) => set((p) => ({ ...p, id: e.target.value, error: null, unset: false }))}
          />
        </Field>

        <div className={`field ${pwErr ? 'field--error' : ''}`}>
          <div className="pw-head">
            <label className="field__label" htmlFor="si-pw">
              Password
            </label>
            <button type="button" className="btn btn--link pw-forgot" onClick={onForgot}>
              Forgot password?
            </button>
          </div>
          <PasswordInput
            ref={pwRef}
            id="si-pw"
            name="password"
            autoComplete="current-password"
            value={a.pw}
            invalid={!!pwErr || !!a.error}
            aria-describedby={pwErr ? 'si-pw-error' : caps ? 'si-pw-caps' : undefined}
            onCaps={setCaps}
            onChange={(e) => set((p) => ({ ...p, pw: e.target.value, error: null }))}
          />
          {pwErr ? (
            <p className="field__msg field__msg--error" id="si-pw-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{pwErr}</span>
            </p>
          ) : (
            caps && (
              <p id="si-pw-caps" className="field__msg caps">
                <Icon name="capslock" size={16} />
                <span>Caps Lock is on</span>
              </p>
            )
          )}
        </div>

        <Switch id="si-remember" checked={a.remember} onChange={(v) => set((p) => ({ ...p, remember: v }))}>
          Keep me signed in
        </Switch>

        <Button type="submit" block loading={a.status === 'checking'} disabled={stillLocked}>
          {a.status === 'checking' ? 'Signing in…' : 'Sign in'}
        </Button>
      </Form>

      <div className="auth-or" role="presentation">
        <span>First time here?</span>
      </div>
      <Button variant="secondary" block className="join-btn" onClick={onSetup} iconRight={<Icon name="arrowRight" size={18} />}>
        Set up your password
      </Button>
      <p className="auth-form__help isign__note">Your GSP admin gives you access, by email. There’s no signing up.</p>
    </div>
  );
}

/* ---------- setting up or resetting a password ---------- */

type Patch = (x: Partial<TeamAuth['flow']>) => void;
type Go = (step: PwStep, dir?: 1 | -1, extra?: Partial<TeamAuth['flow']>) => void;

function PasswordFlow({ a, set, onBack, onSignedIn }: { a: TeamAuth; set: Set; onBack: (notice?: string) => void; onSignedIn: (m: Member) => void }) {
  const reduce = useReducedMotion();
  const f = a.flow;
  const go: Go = (step, dir = 1, extra = {}) => set((p) => ({ ...p, flow: { ...p.flow, ...extra, step, dir, busy: false, submitted: false } }));
  const patch: Patch = (extra) => set((p) => ({ ...p, flow: { ...p.flow, ...extra } }));
  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 28 * d }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: -28 * d }),
  };
  return (
    <div className="auth-form">
      <div className="fsteps" aria-hidden="true">
        {(['request', 'code', 'new'] as PwStep[]).map((s, i) => {
          const idx = ['request', 'code', 'new', 'done'].indexOf(f.step);
          return <span key={s} className={`fsteps__bar ${i < idx ? 'is-done' : i === idx ? 'is-now' : ''}`} />;
        })}
      </div>
      <AnimatePresence mode="wait" custom={f.dir}>
        <motion.div key={f.step} custom={f.dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.24, ease }} className="fstep">
          {f.step !== 'done' && (
            <button
              type="button"
              className="back-link"
              onClick={() => (f.step === 'request' ? onBack() : f.step === 'code' ? go('request', -1, { code: '', codeError: null }) : go('code', -1))}
            >
              <Icon name="arrowLeft" size={16} />
              {f.step === 'request' ? 'Back to sign in' : f.step === 'code' ? 'Use a different email' : 'Back'}
            </button>
          )}
          {f.step === 'request' && <RequestStep f={f} patch={patch} go={go} />}
          {f.step === 'code' && <CodeStep f={f} patch={patch} go={go} />}
          {f.step === 'new' && <NewStep f={f} patch={patch} go={go} />}
          {f.step === 'done' && <DoneStep f={f} onBack={onBack} onSignedIn={onSignedIn} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function RequestStep({ f, patch, go }: { f: TeamAuth['flow']; patch: Patch; go: Go }) {
  const setup = f.mode === 'setup';
  const m = memberFor(f.id);
  // setting up says plainly when an email has no access, or already has a password: these are GSP's own people
  const err = !f.submitted
    ? null
    : !f.id.trim()
      ? 'Enter your GSP email.'
      : setup && !m
        ? 'That email doesn’t have access to GSP Admin yet. Ask your GSP admin to give you access.'
        : setup && m && hasPassword(m)
          ? 'That email already has a password. Go back and sign in, or reset it if you’ve forgotten it.'
          : null;
  const send = () => {
    const bad = !f.id.trim() || (setup && (!m || hasPassword(m)));
    if (bad) return patch({ submitted: true });
    patch({ busy: true });
    window.setTimeout(() => go('code', 1, { code: '', codeError: null, resendAt: Date.now() + 30_000 }), 800);
  };
  return (
    <>
      <h1 className="auth-form__title">{setup ? 'Set up your password' : 'Reset your password'}</h1>
      <p className="auth-form__lead">
        {setup
          ? 'Your GSP admin gave you access to GSP Admin. Enter your GSP email and we’ll email you a 6-digit code to set your password.'
          : 'Enter your GSP email. We’ll email you a 6-digit code to set a new password.'}
      </p>
      <Form className="auth-form__fields" onSubmit={send}>
        <Field id="fp-id" label="GSP email" error={err}>
          <TextInput
            id="fp-id"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@gsp.upgrad.com"
            leading={<Icon name="mail" size={18} />}
            value={f.id}
            invalid={!!err}
            aria-describedby={describedBy('fp-id', err)}
            onChange={(e) => patch({ id: e.target.value, submitted: false })}
            autoFocus
          />
        </Field>
        <Button type="submit" block loading={f.busy}>
          {f.busy ? 'Sending code…' : 'Send code'}
        </Button>
      </Form>
      <p className="auth-form__help">Can’t open that email? Ask your GSP admin.</p>
    </>
  );
}

function CodeStep({ f, patch, go }: { f: TeamAuth['flow']; patch: Patch; go: Go }) {
  const codeRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    window.setTimeout(() => codeRef.current?.focus(), 260);
    return () => window.clearInterval(t);
  }, []);
  const wait = Math.min(30, Math.max(0, Math.ceil((f.resendAt - now) / 1000)));
  const dest = codeDestination(f.id);
  const check = (code: string) => {
    patch({ busy: true, codeError: null });
    window.setTimeout(() => {
      // only someone with access gets a code, so for anyone else every code is wrong
      if (code !== TEST_CODE || !memberFor(f.id)) {
        patch({ busy: false, code: '', codeError: 'That code doesn’t match. Check the latest email from GSP, or send a new code.' });
        window.setTimeout(() => codeRef.current?.focus(), 40);
      } else go('new', 1, { pw: '', pw2: '', code: '' });
    }, 700);
  };
  return (
    <>
      <h1 className="auth-form__title">Check your email</h1>
      <p className="auth-form__lead">
        {dest ? (
          <>
            We sent a 6-digit code to <strong>{dest}</strong>.
          </>
        ) : (
          'If that email has access, we’ve sent it a 6-digit code.'
        )}{' '}
        It works for 10 minutes.
      </p>
      <div className="auth-form__fields">
        <div className="field">
          <label className="field__label" htmlFor="fp-code">
            Code from the email
          </label>
          <div className="ev__row">
            <CodeInput ref={codeRef} id="fp-code" value={f.code} invalid={!!f.codeError} disabled={f.busy} describedBy="fp-code-msg" onChange={(code) => patch({ code, codeError: null })} onComplete={check} />
            {f.busy && (
              <span className="ev__checking" role="status">
                <span className="btn__spinner" aria-hidden="true" />
                Checking…
              </span>
            )}
          </div>
          <p id="fp-code-msg" className={`ev__msg ${f.codeError ? 'is-error' : ''}`} role={f.codeError ? 'alert' : undefined}>
            {f.codeError ? (
              <>
                <Icon name="alert" size={16} />
                <span>{f.codeError}</span>
              </>
            ) : (
              <span>Not there? Check your spam folder.</span>
            )}
          </p>
        </div>
        <div className="ev__actions">
          {wait > 0 ? (
            <span className="ev__wait" aria-live="polite">
              Send a new code in <span className="num">0:{String(wait).padStart(2, '0')}</span>
            </span>
          ) : (
            <button type="button" className="btn btn--link" onClick={() => patch({ resendAt: Date.now() + 30_000, code: '', codeError: null })}>
              Send a new code
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function NewStep({ f, patch, go }: { f: TeamAuth['flow']; patch: Patch; go: Go }) {
  const setup = f.mode === 'setup';
  const { meetsHint, usesName, ok } = checkPassword(f.pw, f.id);
  const match = f.pw2.length > 0 && f.pw2 === f.pw;
  const hint = meetsHint && usesName ? 'Don’t use your name in your password.' : PASSWORD_HINT;
  const hintState = ok ? 'ok' : f.submitted || usesName ? 'error' : 'idle';
  const pw2Err = f.submitted && ok && !match ? 'The two passwords don’t match yet.' : null;
  const save = () => {
    if (!ok || !match) return patch({ submitted: true });
    patch({ busy: true });
    window.setTimeout(() => {
      const m = memberFor(f.id);
      if (m) setPassword(m, f.pw);
      go('done', 1);
    }, 900);
  };
  return (
    <>
      <h1 className="auth-form__title">{setup ? 'Choose your password' : 'Choose a new password'}</h1>
      <p className="auth-form__lead">
        For <strong>{f.id}</strong>.
      </p>
      <Form className="auth-form__fields" onSubmit={save}>
        <input type="text" name="username" autoComplete="username" value={f.id} readOnly hidden />
        <Field id="fp-pw" label={setup ? 'Password' : 'New password'}>
          <PasswordInput id="fp-pw" autoComplete="new-password" value={f.pw} invalid={hintState === 'error'} aria-describedby="fp-pw-hint" onChange={(e) => patch({ pw: e.target.value })} />
        </Field>
        <div className="pw-pair">
          <Field id="fp-pw2" label="Type it again" error={pw2Err} success={!pw2Err && match ? 'Passwords match' : undefined}>
            <PasswordInput
              id="fp-pw2"
              autoComplete="new-password"
              value={f.pw2}
              invalid={!!pw2Err}
              aria-describedby={[describedBy('fp-pw2', pw2Err, match), 'fp-pw-hint'].filter(Boolean).join(' ')}
              onChange={(e) => patch({ pw2: e.target.value })}
            />
          </Field>
          <p id="fp-pw-hint" className={`pw-hint pw-hint--${hintState}`} role={hintState === 'error' ? 'alert' : undefined} aria-live="polite">
            <Icon name={hintState === 'ok' ? 'checkCircle' : hintState === 'error' ? 'alert' : 'info'} size={16} />
            <span>
              {hint}
              {hintState === 'ok' && <span className="vh"> Your password meets this.</span>}
            </span>
          </p>
        </div>
        {!setup && (
          <Switch id="fp-others" checked={f.others} onChange={(v) => patch({ others: v })}>
            Sign me out on other devices
          </Switch>
        )}
        <Button type="submit" block loading={f.busy}>
          {f.busy ? 'Saving…' : setup ? 'Set password' : 'Save new password'}
        </Button>
      </Form>
    </>
  );
}

function DoneStep({ f, onBack, onSignedIn }: { f: TeamAuth['flow']; onBack: (notice?: string) => void; onSignedIn: (m: Member) => void }) {
  const m = memberFor(f.id);
  if (f.mode === 'setup')
    return (
      <Welcome title="You’re all set" text="Your password is set. Next time, sign in with your GSP email and this password.">
        <Button block onClick={() => onSignedIn(m ?? TEAM_MEMBER)} iconRight={<Icon name="arrowRight" size={18} />}>
          Go to the portal
        </Button>
      </Welcome>
    );
  const dest = codeDestination(f.id);
  return (
    <Welcome title="Password changed" text={`Sign in with your new password.${dest ? ` We’ve emailed ${dest} to let you know` : ' We’ve emailed you to let you know'}${f.others ? ', and signed you out on your other devices.' : '.'}`}>
      <Button block onClick={() => onBack('Password changed. Sign in with your new password.')} iconRight={<Icon name="arrowRight" size={18} />}>
        Sign in
      </Button>
    </Welcome>
  );
}

/** A tick that draws itself, a title and a line; with a bar filling while the portal opens, or a button. */
function Welcome({ title, text, bar, children }: { title: string; text: string; bar?: boolean; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className={`welcome ${bar ? '' : 'welcome--left'}`} role="status">
      <motion.div className="success-mark" initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }} aria-hidden="true">
        <svg viewBox="0 0 48 48" width="48" height="48">
          <motion.path
            d="M14 25l7 7 14-15"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.42, ease, delay: 0.15 }}
          />
        </svg>
      </motion.div>
      <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2, ease }}>
        <h1 className="auth-form__title">{title}</h1>
        <p className="auth-form__lead">{text}</p>
      </motion.div>
      {bar && (
        <div className="welcome__bar" aria-hidden="true">
          <motion.span initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.3, ease: [0.4, 0, 0.2, 1] }} />
        </div>
      )}
      {children}
    </div>
  );
}

const bannerMotion = (reduce: boolean | null, shake = true) =>
  reduce
    ? {}
    : {
        initial: { opacity: 0, y: -6 },
        animate: shake ? { opacity: 1, y: 0, x: [0, -6, 5, -3, 0] } : { opacity: 1, y: 0 },
        exit: { opacity: 0, transition: { duration: 0.15 } },
        transition: { duration: 0.36, ease },
      };
