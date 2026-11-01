import { useEffect, useMemo } from 'react';
import { useReducedMotion } from 'motion/react';
import { Field, Form as SubmitForm, TextInput, describedBy } from '../../components/forms';
import { CountryCombobox } from '../../components/CountryCombobox';
import { PasswordInput } from '../../components/PasswordInput';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { countryByName } from '../../data/partners';
import { emailInUse } from './model';
import { checkPassword } from '../signin/model';
import { PASSWORD_RULE, REGISTER_ORDER, isEmail, validateRegister, type SignupForm as Form, type SignupState } from './model';

type Props = {
  s: SignupState;
  set: (fn: (s: SignupState) => SignupState) => void;
  onSubmit: () => void;
  onSignIn: () => void;
};

/**
 * Becoming a partner starts small: who you are, the business, its country, the email you'll sign in with and a
 * password. The code to verify the email comes next; the rest of the business details are asked in the portal.
 */
export function SignupForm({ s, set, onSubmit, onSignIn }: Props) {
  const reduce = useReducedMotion();
  const errors = useMemo(() => validateRegister(s), [s]);
  const f = s.form;

  const show = (k: keyof Form) => (s.submitted || s.touched[k] ? errors[k] ?? null : null);
  const up = (patch: Partial<Form>) => set((p) => ({ ...p, form: { ...p.form, ...patch } }));
  const touch = (k: keyof Form) => set((p) => ({ ...p, touched: { ...p.touched, [k]: true } }));

  const listed = s.submitted ? REGISTER_ORDER.filter((k) => errors[k]) : [];
  const inUse = isEmail(f.email) && emailInUse(f.email);

  // the password rule, said once under both fields: grey while typing, green once met, red if they try to go on without it
  const pw = checkPassword(f.pw, f.email);
  const pwHint = pw.meetsHint && pw.usesName ? 'Don’t use your email name in your password.' : PASSWORD_RULE;
  const pwState = pw.ok ? 'ok' : (s.submitted && !!errors.pw) || (pw.meetsHint && pw.usesName) ? 'error' : 'idle';
  const match = f.pw2.length > 0 && f.pw2 === f.pw;
  const pw2Err = show('pw2');

  // When a submit attempt fails, take people to the first field that needs fixing; its error is read out with it.
  const attempt = s.submitted ? s.attempts ?? 0 : 0;
  useEffect(() => {
    if (attempt === 0) return;
    const first = REGISTER_ORDER.find((k) => errors[k]);
    const el = first ? document.getElementById(`su-${first}`) : null;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [attempt]); // only on a new attempt, with that attempt's errors

  const sending = s.email.status === 'sending';

  return (
    <div className="signup">
      <header className="signup__head">
        <h1 className="auth-form__title">
          Become a <span className="brand-phrase">GSP partner</span>
        </h1>
        <p className="signup__lead">
          You’ll add the rest of your business details and documents in your portal.
        </p>
        <p className="signup__req">
          <span className="field__req" aria-hidden="true">
            *
          </span>{' '}
          Required
        </p>
      </header>

      <SubmitForm className="signup__form" onSubmit={onSubmit}>
        {/* errors show next to their fields only; this line tells screen readers how many there are */}
        <p className="vh" role="status">
          {listed.length > 0 ? `${listed.length} ${listed.length === 1 ? 'field needs' : 'fields need'} attention.` : ''}
        </p>

        <fieldset className="fs">
          <legend className="fs__legend">About you</legend>
          <div className="grid2">
            <Field id="su-first" required label="First name" error={show('first')}>
              <TextInput
                id="su-first"
                autoComplete="given-name"
                value={f.first}
                invalid={!!show('first')}
                aria-describedby={describedBy('su-first', show('first'))}
                onChange={(e) => up({ first: e.target.value })}
                onBlur={() => touch('first')}
              />
            </Field>
            <Field id="su-last" required label="Last name" error={show('last')}>
              <TextInput
                id="su-last"
                autoComplete="family-name"
                value={f.last}
                invalid={!!show('last')}
                aria-describedby={describedBy('su-last', show('last'))}
                onChange={(e) => up({ last: e.target.value })}
                onBlur={() => touch('last')}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="fs">
          <legend className="fs__legend">Your business</legend>
          <Field id="su-biz" required label="Registered business name" hint="Exactly as it appears on your registration certificate." error={show('biz')}>
            <TextInput
              id="su-biz"
              autoComplete="organization"
              value={f.biz}
              invalid={!!show('biz')}
              aria-describedby={describedBy('su-biz', show('biz'), true)}
              onChange={(e) => up({ biz: e.target.value })}
              onBlur={() => touch('biz')}
            />
          </Field>
          <Field id="su-country" required label="Country" hint="Decides the documents we ask for and who your GSP contact is." error={show('country')}>
            <CountryCombobox
              id="su-country"
              value={f.country}
              invalid={!!show('country')}
              describedBy={describedBy('su-country', show('country'), true)}
              onChange={(name) => {
                if (name === f.country) return;
                const c = countryByName(name);
                up({ country: name, state: '', dial: c?.dial ?? f.dial, ownerDial: c?.dial ?? f.ownerDial });
              }}
            />
          </Field>
        </fieldset>

        <fieldset className="fs">
          <legend className="fs__legend">Signing in</legend>
          <div className="ev">
            <Field id="su-email" required label="Business email" hint="This is the email you’ll use to sign in to the portal." error={show('email')}>
              <TextInput
                id="su-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@youragency.com"
                value={f.email}
                invalid={!!show('email')}
                aria-describedby={describedBy('su-email', show('email'), true)}
                onChange={(e) => up({ email: e.target.value })}
                onBlur={() => f.email && touch('email')}
              />
            </Field>
            {inUse && s.touched.email && (
              <p className="ev__inuse">
                <a
                  href="#signin"
                  onClick={(e) => {
                    e.preventDefault();
                    onSignIn();
                  }}
                >
                  Sign in instead
                </a>
                <span aria-hidden="true">·</span>
                <span>Joining a team that’s already on GSP? Ask its admin to invite you.</span>
              </p>
            )}
          </div>
          <Field id="su-pw" required label="Password">
            <PasswordInput
              id="su-pw"
              autoComplete="new-password"
              value={f.pw}
              invalid={pwState === 'error'}
              aria-describedby="su-pw-hint"
              onChange={(e) => up({ pw: e.target.value })}
              onBlur={() => f.pw && touch('pw')}
            />
          </Field>
          <div className="pw-pair">
            <Field id="su-pw2" required label="Type it again" error={pw2Err} success={!pw2Err && match && pw.ok ? 'Passwords match' : undefined}>
              <PasswordInput
                id="su-pw2"
                autoComplete="new-password"
                value={f.pw2}
                invalid={!!pw2Err}
                aria-describedby={[describedBy('su-pw2', pw2Err, match), 'su-pw-hint'].filter(Boolean).join(' ')}
                onChange={(e) => up({ pw2: e.target.value })}
                onBlur={() => f.pw2 && touch('pw2')}
              />
            </Field>
            <p id="su-pw-hint" className={`pw-hint pw-hint--${pwState}`} role={pwState === 'error' ? 'alert' : undefined} aria-live="polite">
              <Icon name={pwState === 'ok' ? 'checkCircle' : pwState === 'error' ? 'alert' : 'info'} size={16} />
              <span>
                {s.submitted && errors.pw === 'Choose a password.' ? 'Choose a password. ' : ''}
                {pwHint}
                {pwState === 'ok' && <span className="vh"> Your password meets this.</span>}
              </span>
            </p>
          </div>
        </fieldset>

        <div className="signup__submit">
          <p className="signup__terms">
            By creating an account you agree to the{' '}
            <a href="#terms" onClick={(e) => e.preventDefault()}>
              partner terms
            </a>{' '}
            and{' '}
            <a href="#privacy" onClick={(e) => e.preventDefault()}>
              privacy policy
            </a>
            .
          </p>
          <Button type="submit" block loading={sending} iconRight={<Icon name="arrowRight" size={18} />}>
            {sending ? 'Sending your code…' : 'Continue'}
          </Button>
          <p className="signup__next">Next, we’ll email you a code to verify your email.</p>
        </div>
      </SubmitForm>
    </div>
  );
}
