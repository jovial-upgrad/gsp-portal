import { useEffect, useRef, useState } from 'react';
import { CodeInput } from '../../components/CodeInput';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SIGNUP_CODE, type SignupState } from './model';

import { TEST_CODE } from '../../data/testing';

type SetState = (fn: (s: SignupState) => SignupState) => void;

/** Sends the 6-digit code to the business email; the form calls it to move on, and the code screen to send again. */
export function sendCode(set: SetState, then?: () => void) {
  set((p) => ({ ...p, email: { ...p.email, status: 'sending', codeError: null } }));
  window.setTimeout(() => {
    set((p) => ({
      ...p,
      stage: 'code',
      // a new code voids the old one: it works for 10 minutes and allows 5 wrong tries (S2C-16, SIGNUP_CODE)
      email: { status: 'sent', code: '', codeError: null, sentTo: p.form.email.trim(), resendAt: Date.now() + SIGNUP_CODE.resendSeconds * 1000, sentAt: Date.now(), wrong: 0 },
    }));
    then?.();
  }, 700);
}

/**
 * Second step of registering: the code sent to the business email. The right code makes the account
 * (a short "Creating your account…") and opens the portal, where the rest of the business details are asked.
 */
export function EmailCode({ s, set, onCreated, onBack }: { s: SignupState; set: SetState; onCreated: () => void; onBack: () => void }) {
  const codeRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());
  const em = s.email;
  const status = em.status;
  const creating = s.stage === 'creating';
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (status !== 'sent') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [status]);
  useEffect(() => {
    if (status === 'sent') window.setTimeout(() => codeRef.current?.focus(), 80);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const wait = Math.min(SIGNUP_CODE.resendSeconds, Math.max(0, Math.ceil((em.resendAt - now) / 1000)));

  const check = (code: string) => {
    set((p) => ({ ...p, email: { ...p.email, status: 'checking', codeError: null } }));
    timer.current = window.setTimeout(() => {
      const dead = (s.email.wrong ?? 0) >= SIGNUP_CODE.maxWrong || (!!s.email.sentAt && Date.now() - s.email.sentAt > SIGNUP_CODE.minutes * 60_000);
      if (code !== TEST_CODE || dead) {
        set((p) => {
          const wrong = (p.email.wrong ?? 0) + (dead ? 0 : 1);
          return { ...p, email: { ...p.email, status: 'sent', code: '', wrong, codeError: wrong >= SIGNUP_CODE.maxWrong ? `That code has stopped working after ${SIGNUP_CODE.maxWrong} wrong tries. Send a new one.` : 'That code isn’t right. Check it, or send a new one.' } };
        });
        window.setTimeout(() => codeRef.current?.focus(), 60);
        return;
      }
      // the email is verified: the account is made, the password is set, and nothing about it stays in the draft
      set((p) => ({ ...p, stage: 'creating', email: { ...p.email, status: 'verified', code: '', codeError: null } }));
      timer.current = window.setTimeout(() => {
        set((p) => ({
          ...p,
          stage: 'details',
          detailsDone: false,
          form: { ...p.form, pw: '', pw2: '' },
          submitted: false,
          attempts: 0,
          touched: {},
        }));
        onCreated();
      }, 1100);
    }, 650);
  };

  const again = () => sendCode(set, () => window.setTimeout(() => codeRef.current?.focus(), 60));

  return (
    <div className="signup signup--code">
      <header className="signup__head">
        <span className="code-mark" aria-hidden="true">
          <Icon name="mail" size={22} />
        </span>
        <h1 className="auth-form__title">Check your email</h1>
        <p className="signup__lead">
          Enter the 6-digit code we sent to <strong>{em.sentTo || s.form.email}</strong>. It verifies your email and creates the account for{' '}
          <strong>{s.form.biz}</strong>.
        </p>
      </header>

      <div className="ev__panel ev__panel--page">
        <label className="ev__label" htmlFor="su-code">
          6-digit code
        </label>
        <div className="ev__row">
          <CodeInput
            ref={codeRef}
            id="su-code"
            value={em.code}
            invalid={!!em.codeError}
            disabled={status === 'checking' || creating}
            describedBy="su-code-msg"
            onChange={(code) => set((p) => ({ ...p, email: { ...p.email, code, codeError: null } }))}
            onComplete={check}
          />
          {status === 'checking' && (
            <span className="ev__checking" role="status">
              <span className="btn__spinner" aria-hidden="true" />
              Checking…
            </span>
          )}
        </div>
        <p id="su-code-msg" className={`ev__msg ${em.codeError ? 'is-error' : ''}`} role={em.codeError ? 'alert' : undefined}>
          {em.codeError ? (
            <>
              <Icon name="alert" size={16} />
              <span>{em.codeError}</span>
            </>
          ) : (
            <span>The code works for {SIGNUP_CODE.minutes} minutes. Not there? Check your spam folder.</span>
          )}
        </p>
        {!creating && (
          <div className="ev__actions">
            {status === 'sending' ? (
              <span className="ev__wait" role="status">
                Sending a new code…
              </span>
            ) : wait > 0 ? (
              <span className="ev__wait" aria-live="polite">
                Send a new code in <span className="num">0:{String(wait).padStart(2, '0')}</span>
              </span>
            ) : (
              <button type="button" className="btn btn--link" onClick={again}>
                Send a new code
              </button>
            )}
            <span aria-hidden="true" className="ev__dot">
              ·
            </span>
            <button type="button" className="btn btn--link" onClick={onBack}>
              Change email
            </button>
          </div>
        )}
      </div>

      {creating && (
        <Button block loading>
          Creating your account…
        </Button>
      )}
    </div>
  );
}
