import { AnimatePresence, motion } from 'motion/react';
import { useScene } from '../../shell/AuthScene';
import { SignupForm } from './SignupForm';
import { EmailCode, sendCode } from './EmailVerify';
import { validateRegister, type SignupState } from './model';
import './signup.css';

type SetState = (fn: (s: SignupState) => SignupState) => void;

/** The account exists once the email is verified; everything after happens in the portal. */
export const accountMade = (s: SignupState) => ['details', 'sending', 'sent', 'sent-back', 'verified'].includes(s.stage);

/** The panel's top bar: a way back to sign in. */
export function SignupBar({ onSignIn }: { onSignIn: () => void }) {
  return (
    <p className="auth__bar-note">
      Already a partner?{' '}
      <button type="button" className="btn btn--link" onClick={onSignIn}>
        Sign in
      </button>
    </p>
  );
}

/**
 * The glass panel's content for becoming a partner: the short form, then the code sent to the business email.
 * It looks like sign in: the same photo and statement, the same panel, no steps beside it.
 */
export function SignupPanel({
  s,
  set,
  scrollTop,
  onSignIn,
  onPortal,
}: {
  s: SignupState;
  set: SetState;
  scrollTop: () => void;
  onSignIn: () => void;
  onPortal: () => void;
}) {
  const { reduce } = useScene();

  const submit = () => {
    if (s.email.status === 'sending') return;
    if (Object.keys(validateRegister(s)).length) {
      set((p) => ({ ...p, submitted: true, attempts: (p.attempts ?? 0) + 1 }));
      return;
    }
    sendCode(set, scrollTop);
  };
  const back = () => {
    set((p) => ({ ...p, stage: 'form', email: { status: 'idle', code: '', codeError: null, sentTo: '', resendAt: 0 } }));
    scrollTop();
    // the form comes back after the code screen has gone: focus the email once it's there
    const focusEmail = (tries: number) => {
      const el = document.getElementById('su-email');
      if (el) el.focus();
      else if (tries > 0) window.setTimeout(() => focusEmail(tries - 1), 60);
    };
    window.setTimeout(() => focusEmail(20), 120);
  };

  const view = s.stage === 'code' || s.stage === 'creating' ? 'code' : 'form';

  return (
    <>
      {/* the scene animates the first view in; after that, each change of view does */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {view === 'form' ? <SignupForm s={s} set={set} onSubmit={submit} onSignIn={onSignIn} /> : <EmailCode s={s} set={set} onCreated={onPortal} onBack={back} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
