import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Field, Form, TextInput, Switch, describedBy } from '../../components/forms';
import { PasswordInput } from '../../components/PasswordInput';
import { CodeInput } from '../../components/CodeInput';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { PASSWORD_HINT, accountFor, checkPassword, codeDestination, setPassword, type AuthState, type ForgotStep } from './model';
import { TEST_CODE } from '../../data/testing';

type Set = (fn: (a: AuthState) => AuthState) => void;
const ease = [0.2, 0.8, 0.2, 1] as const;

export function ForgotFlow({ a, set, onBack }: { a: AuthState; set: Set; onBack: (notice?: string) => void }) {
  const reduce = useReducedMotion();
  const f = a.forgot;
  const go = (step: ForgotStep, dir: 1 | -1 = 1, extra: Partial<AuthState['forgot']> = {}) =>
    set((p) => ({ ...p, forgot: { ...p.forgot, ...extra, step, dir, busy: false, submitted: false } }));
  const patch = (extra: Partial<AuthState['forgot']>) => set((p) => ({ ...p, forgot: { ...p.forgot, ...extra } }));

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 28 * d }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: -28 * d }),
  };

  return (
    <div className="auth-form">
      <div className="fsteps" aria-hidden="true">
        {(['request', 'code', 'new'] as ForgotStep[]).map((s, i) => {
          const idx = ['request', 'code', 'new', 'done'].indexOf(f.step);
          return <span key={s} className={`fsteps__bar ${i < idx ? 'is-done' : i === idx ? 'is-now' : ''}`} />;
        })}
      </div>
      <AnimatePresence mode="wait" custom={f.dir}>
        <motion.div
          key={f.step}
          custom={f.dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.24, ease }}
          className="fstep"
        >
          {f.step !== 'done' && (
            <button
              type="button"
              className="back-link"
              onClick={() => (f.step === 'request' ? onBack() : f.step === 'code' ? go('request', -1, { code: '', codeError: null }) : go('code', -1))}
            >
              <Icon name="arrowLeft" size={16} />
              {f.step === 'request' ? 'Back to sign in' : f.step === 'code' ? 'Use a different username' : 'Back'}
            </button>
          )}
          {f.step === 'request' && <RequestStep a={a} patch={patch} go={go} />}
          {f.step === 'code' && <CodeStep a={a} patch={patch} go={go} />}
          {f.step === 'new' && <NewStep a={a} patch={patch} go={go} />}
          {f.step === 'done' && <DoneStep a={a} onBack={onBack} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

type StepProps = {
  a: AuthState;
  patch: (x: Partial<AuthState['forgot']>) => void;
  go: (step: ForgotStep, dir?: 1 | -1, extra?: Partial<AuthState['forgot']>) => void;
};

function RequestStep({ a, patch, go }: StepProps) {
  const f = a.forgot;
  const id = f.id || a.id;
  const err = f.submitted && !id.trim() ? 'Enter the username or email you sign in with.' : null;
  const send = () => {
    if (!id.trim()) {
      window.setTimeout(() => document.getElementById('fp-id')?.focus(), 40);
      return patch({ submitted: true });
    }
    patch({ busy: true, id });
    window.setTimeout(() => go('code', 1, { id, code: '', codeError: null, resendAt: Date.now() + 30_000 }), 800);
  };
  return (
    <>
      <h1 className="auth-form__title">Reset your password</h1>
      <p className="auth-form__lead">Enter the username or email you sign in with. We’ll email you a 6-digit code to set a new password.</p>
      <Form className="auth-form__fields" onSubmit={send}>
        <Field id="fp-id" label="Username or email" error={err}>
          <TextInput
            id="fp-id"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            leading={<Icon name="user" size={18} />}
            value={id}
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
      <p className="auth-form__help">
        Can’t open that email any more?{' '}
        <a href="https://upgradgsp.com/contact-list/" target="_blank" rel="noreferrer">
          Contact the GSP team
        </a>{' '}
        and we’ll check it’s you.
      </p>
    </>
  );
}

function CodeStep({ a, patch, go }: StepProps) {
  const f = a.forgot;
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
      // only an account on GSP gets a code, so for anyone else every code is wrong
      if (code !== TEST_CODE || !accountFor(f.id)) {
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
          'If that username is on GSP, we’ve sent a 6-digit code to the email on the account.'
        )}{' '}
        It works for 10 minutes.
      </p>
      <div className="auth-form__fields">
        <div className="field">
          <label className="field__label" htmlFor="fp-code">
            Code from the email
          </label>
          <div className="ev__row">
            <CodeInput
              ref={codeRef}
              id="fp-code"
              value={f.code}
              invalid={!!f.codeError}
              disabled={f.busy}
              describedBy="fp-code-msg"
              onChange={(code) => patch({ code, codeError: null })}
              onComplete={check}
            />
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

function NewStep({ a, patch, go }: StepProps) {
  const f = a.forgot;
  const { meetsHint, usesName, ok } = checkPassword(f.pw, f.id);
  const match = f.pw2.length > 0 && f.pw2 === f.pw;
  // the one hint line under both fields: grey while typing, green once met, red if they try to save without it
  const hint = meetsHint && usesName ? 'Don’t use your username in your password.' : PASSWORD_HINT;
  const hintState = ok ? 'ok' : f.submitted || usesName ? 'error' : 'idle';
  const pw2Err = f.submitted && ok && !match ? 'The two passwords don’t match yet.' : null;

  const save = () => {
    if (!ok || !match) {
      window.setTimeout(() => document.getElementById(!ok ? 'fp-pw' : 'fp-pw2')?.focus(), 40);
      return patch({ submitted: true });
    }
    patch({ busy: true });
    window.setTimeout(() => {
      const acc = accountFor(f.id);
      if (acc) setPassword(acc, f.pw);
      go('done', 1);
    }, 900);
  };

  return (
    <>
      <h1 className="auth-form__title">Choose a new password</h1>
      <p className="auth-form__lead">
        For <strong>{f.id}</strong>.
      </p>
      <Form className="auth-form__fields" onSubmit={save}>
        <input type="text" name="username" autoComplete="username" value={f.id} readOnly hidden />
        <Field id="fp-pw" label="New password">
          <PasswordInput
            id="fp-pw"
            autoComplete="new-password"
            value={f.pw}
            invalid={hintState === 'error'}
            aria-describedby="fp-pw-hint"
            onChange={(e) => patch({ pw: e.target.value })}
          />
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
        <Switch id="fp-others" checked={f.others} onChange={(v) => patch({ others: v })}>
          Sign me out on other devices
        </Switch>
        <Button type="submit" block loading={f.busy}>
          {f.busy ? 'Saving…' : 'Save new password'}
        </Button>
      </Form>
    </>
  );
}

function DoneStep({ a, onBack }: { a: AuthState; onBack: (notice?: string) => void }) {
  const reduce = useReducedMotion();
  const f = a.forgot;
  const dest = codeDestination(f.id);
  return (
    <div className="welcome welcome--left">
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
      <h1 className="auth-form__title">Password changed</h1>
      <p className="auth-form__lead">
        Sign in with your new password.{dest ? ` We’ve emailed ${dest} to let you know` : ' We’ve emailed you to let you know'}
        {f.others ? ', and signed you out on your other devices.' : '.'}
      </p>
      <Button block onClick={() => onBack('Password changed. Sign in with your new password.')} iconRight={<Icon name="arrowRight" size={18} />}>
        Sign in
      </Button>
    </div>
  );
}
