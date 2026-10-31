import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Field, Form, TextInput, Switch, describedBy } from '../../components/forms';
import { PasswordInput } from '../../components/PasswordInput';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { LOCK_MINUTES, MAX_ATTEMPTS, SAMPLE_ACCOUNT, accountFor, verify, type Account, type AuthState } from './model';

type Set = (fn: (a: AuthState) => AuthState) => void;
const ease = [0.2, 0.8, 0.2, 1] as const;

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

export function SignInForm({
  a,
  set,
  onForgot,
  onJoin,
  onSignedIn,
}: {
  a: AuthState;
  set: Set;
  onForgot: () => void;
  onJoin: () => void;
  onSignedIn: (acc: Account) => void;
}) {
  const reduce = useReducedMotion();
  const pwRef = useRef<HTMLInputElement>(null);
  const [caps, setCaps] = useState(false);
  const locked = a.lockedUntil > Date.now();
  useNow(locked); // re-render every second while paused
  const left = Math.max(0, a.lockedUntil - Date.now());
  const stillLocked = left > 0;
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    // the pause ends by itself: clear it so the form works again
    if (a.lockedUntil && !stillLocked) set((p) => ({ ...p, lockedUntil: 0, attempts: 0, error: null }));
  }, [stillLocked, a.lockedUntil, set]);

  const idErr = a.submitted && !a.id.trim() ? 'Enter your username or email.' : null;
  const pwErr = a.submitted && !a.pw ? 'Enter your password.' : null;

  const submit = () => {
    if (stillLocked || a.status !== 'idle') return;
    if (!a.id.trim() || !a.pw) {
      set((p) => ({ ...p, submitted: true, error: null, notice: null }));
      return;
    }
    set((p) => ({ ...p, submitted: true, status: 'checking', error: null, notice: null }));
    timer.current = window.setTimeout(() => {
      const acc = verify(a.id, a.pw);
      if (!acc) {
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
              ? `That username and password don’t match. ${tries} ${tries === 1 ? 'try' : 'tries'} left before sign-in pauses for ${LOCK_MINUTES} minutes.`
              : 'That username and password don’t match. Check both, or reset your password.',
        }));
        window.setTimeout(() => pwRef.current?.focus(), 40);
      } else {
        set((p) => ({ ...p, status: 'success' }));
        timer.current = window.setTimeout(() => onSignedIn(acc), 1500);
      }
    }, 900);
  };

  if (a.status === 'success') {
    const acc = accountFor(a.id) ?? SAMPLE_ACCOUNT;
    return (
      <div className="welcome" role="status">
        <motion.div
          className="success-mark"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-hidden="true"
        >
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
          <h1 className="auth-form__title">Welcome back, {acc.first}</h1>
          <p className="auth-form__lead">Opening your partner portal…</p>
        </motion.div>
        <div className="welcome__bar" aria-hidden="true">
          <motion.span initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.3, ease: [0.4, 0, 0.2, 1] }} />
        </div>
      </div>
    );
  }

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  return (
    <div className="auth-form">
      <h1 className="auth-form__title">Welcome back</h1>
      <p className="auth-form__lead">Sign in to your partner account.</p>

      <AnimatePresence initial={false} mode="popLayout">
        {stillLocked ? (
          <motion.div key="locked" className="banner banner--bad" role="alert" {...bannerMotion(reduce)}>
            <Icon name="lock" size={18} />
            <div className="banner__body">
              <p className="banner__title">
                Sign-in is paused for <span className="num">{mm}:{String(ss).padStart(2, '0')}</span>
              </p>
              <p>After {MAX_ATTEMPTS} attempts we pause sign-in to keep your agency’s data safe. Reset your password to get in now.</p>
              <Button size="sm" variant="secondary" onClick={onForgot} iconLeft={<Icon name="key" size={16} />}>
                Reset password
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
        <Field id="si-id" label="Username or email" error={idErr}>
          <TextInput
            id="si-id"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={a.id}
            invalid={!!idErr || !!a.error}
            aria-describedby={describedBy('si-id', idErr)}
            onChange={(e) => set((p) => ({ ...p, id: e.target.value, error: null }))}
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
            <AnimatePresence initial={false}>
              {caps && (
                <motion.p
                  id="si-pw-caps"
                  className="field__msg caps"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <Icon name="capslock" size={16} />
                  <span>Caps Lock is on</span>
                </motion.p>
              )}
            </AnimatePresence>
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
        <span>New to upGrad GSP?</span>
      </div>

      <Button variant="secondary" block className="join-btn" onClick={onJoin} iconRight={<Icon name="arrowRight" size={18} />}>
        Become a GSP partner
      </Button>
    </div>
  );
}

/** Errors arrive with one small shake; good news just settles in. */
const bannerMotion = (reduce: boolean | null, shake = true) =>
  reduce
    ? {}
    : {
        initial: { opacity: 0, y: -6 },
        animate: shake ? { opacity: 1, y: 0, x: [0, -6, 5, -3, 0] } : { opacity: 1, y: 0 },
        exit: { opacity: 0, transition: { duration: 0.15 } },
        transition: { duration: 0.36, ease },
      };
