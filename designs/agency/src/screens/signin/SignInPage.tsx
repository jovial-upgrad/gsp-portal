import { AnimatePresence, motion } from 'motion/react';
import { settle, useScene } from '../../shell/AuthScene';
import { SignInForm } from './SignInForm';
import { ForgotFlow } from './ForgotFlow';
import type { Account, AuthState } from './model';
import './signin.css';

type Set = (fn: (a: AuthState) => AuthState) => void;
const ease = [0.2, 0.8, 0.2, 1] as const;

/** What sign in says on the photo: one statement, rising line by line once the photo is in. */
export function SignInHero() {
  const { reduce, ready } = useScene();
  const line = (i: number) =>
    reduce ? {} : { initial: { y: '108%' }, animate: ready ? { y: '0%' } : undefined, transition: { duration: 0.9, ease: settle, delay: 0.45 + i * 0.1 } };
  return (
    <p className="auth__statement">
      <span className="auth__line">
        <motion.span className="auth__line-in" {...line(0)}>
          The global marketplace
        </motion.span>
      </span>{' '}
      <span className="auth__line auth__line--soft">
        <motion.span className="auth__line-in" {...line(1)}>
          for international student recruitment.
        </motion.span>
      </span>
    </p>
  );
}

/** The glass panel's content for sign in: the form, or the forgotten-password steps. */
export function SignInPanel({
  a,
  set,
  onJoin,
  onSignedIn,
}: {
  a: AuthState;
  set: Set;
  onJoin: () => void;
  onSignedIn: (acc: Account) => void;
}) {
  const { reduce } = useScene();
  const toForgot = () =>
    set((p) => ({ ...p, view: 'forgot', error: null, notice: null, forgot: { ...p.forgot, step: 'request', dir: 1, id: p.id, submitted: false, busy: false } }));
  const toSignIn = (notice?: string) =>
    set((p) => ({ ...p, view: 'signin', id: p.forgot.id || p.id, pw: '', status: 'idle', error: null, submitted: false, notice: notice ?? null, attempts: notice ? 0 : p.attempts, lockedUntil: notice ? 0 : p.lockedUntil }));

  // the scene animates this in on arrival; inside, only the switch between sign in and forgot password animates
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={a.view}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease }}
      >
        {a.view === 'signin' ? (
          <SignInForm a={a} set={set} onForgot={toForgot} onJoin={onJoin} onSignedIn={onSignedIn} />
        ) : (
          <ForgotFlow a={a} set={set} onBack={toSignIn} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
