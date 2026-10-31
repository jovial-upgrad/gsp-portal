/** Sign-in and forgot-password state. Prototype rules are listed in the Prototype panel. */
import { TEST_PASSWORD } from '../../data/testing';

export type ForgotStep = 'request' | 'code' | 'new' | 'done';

export type AuthState = {
  view: 'signin' | 'forgot';
  id: string;
  pw: string;
  remember: boolean;
  status: 'idle' | 'checking' | 'success';
  error: string | null;
  attempts: number;
  lockedUntil: number;
  notice: string | null;
  submitted: boolean;
  forgot: {
    step: ForgotStep;
    dir: 1 | -1;
    id: string;
    busy: boolean;
    code: string;
    codeError: string | null;
    resendAt: number;
    pw: string;
    pw2: string;
    others: boolean;
    submitted: boolean;
  };
};

export type Account = { name: string; first: string; email: string; agency: string; role: string; aliases?: string[] };

/** The test account first, then sample people from the PM prototype's agencies. */
const ACCOUNTS: Account[] = [
  { name: 'Nesil Noble', first: 'Nesil', email: 'nesil@upgard.com', aliases: ['nesil@upgrad.com'], agency: 'GSP test agency', role: 'RP admin' },
  { name: 'Ananya Rao', first: 'Ananya', email: 'ananya@horizonoverseas.in', agency: 'Horizon Overseas', role: 'RP admin' },
  { name: 'Vikram Desai', first: 'Vikram', email: 'vikram@horizonoverseas.in', agency: 'Horizon Overseas · Pune', role: 'Branch admin' },
  { name: 'Rahul Verma', first: 'Rahul', email: 'rahul@horizonoverseas.in', agency: 'Horizon Overseas · Lucknow', role: 'Counsellor' },
  { name: 'Lan Tran', first: 'Lan', email: 'lan@saigonbridge.vn', agency: 'Saigon Bridge Education', role: 'RP admin' },
];

export const SAMPLE_ACCOUNT = ACCOUNTS[0];

/** Matches an email, or the part before the @, against each account's email and aliases. */
export function accountFor(id: string): Account | null {
  const v = id.trim().toLowerCase();
  if (!v) return null;
  return ACCOUNTS.find((a) => [a.email, ...(a.aliases ?? [])].some((e) => e === v || e.split('@')[0] === v)) ?? null;
}

/** A password set through "Forgot password" lasts until the page reloads; then it's the test password again. */
const changed = new Map<string, string>();
export const setPassword = (acc: Account, pw: string) => changed.set(acc.email, pw);

/** The account, if the username and password match. Unknown usernames fail the same way, so nobody learns who has an account. */
export function verify(id: string, pw: string): Account | null {
  const acc = accountFor(id);
  return acc && pw === (changed.get(acc.email) ?? TEST_PASSWORD) ? acc : null;
}

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!domain) return null;
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(3, Math.min(6, user.length - 1)))}@${domain}`;
}
/** Where the reset code goes, without saying whether an account exists. */
export function codeDestination(id: string) {
  const acc = accountFor(id);
  const email = acc?.email ?? (id.includes('@') ? id.trim() : '');
  return email ? maskEmail(email) : null;
}

/** The new-password rule, said once, in one sentence. */
export const PASSWORD_HINT = 'Use at least 8 characters, with upper and lowercase letters and a number.';
export function checkPassword(pw: string, id: string) {
  const name = id.trim().split('@')[0].toLowerCase();
  const meetsHint = pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);
  const usesName = name.length >= 3 && pw.toLowerCase().includes(name);
  return { meetsHint, usesName, ok: meetsHint && !usesName };
}

export const initialAuth = (id = ''): AuthState => ({
  view: 'signin',
  id,
  pw: '',
  remember: true,
  status: 'idle',
  error: null,
  attempts: 0,
  lockedUntil: 0,
  notice: null,
  submitted: false,
  forgot: { step: 'request', dir: 1, id: '', busy: false, code: '', codeError: null, resendAt: 0, pw: '', pw2: '', others: true, submitted: false },
});

const DEMO = SAMPLE_ACCOUNT.email;

/** Named states for review links. */
export const AUTH_PRESETS: Record<string, { label: string; make: () => AuthState }> = {
  signin: { label: 'Sign in', make: () => initialAuth() },
  'signin-error': {
    label: 'Wrong password',
    make: () => ({
      ...initialAuth(DEMO),
      attempts: 3,
      submitted: true,
      error: 'That username and password don’t match. Check both, or reset your password.',
    }),
  },
  'signin-locked': {
    label: 'Sign-in paused',
    make: () => ({ ...initialAuth(DEMO), attempts: MAX_ATTEMPTS, lockedUntil: Date.now() + LOCK_MINUTES * 60_000 }),
  },
  forgot: { label: 'Forgot password', make: () => ({ ...initialAuth(), view: 'forgot' }) },
  'forgot-code': {
    label: 'Reset code sent',
    make: () => {
      const a = initialAuth(DEMO);
      return { ...a, view: 'forgot', forgot: { ...a.forgot, step: 'code', id: DEMO, resendAt: Date.now() + 30_000 } };
    },
  },
  'forgot-new': {
    label: 'Choose a new password',
    make: () => {
      const a = initialAuth(DEMO);
      return { ...a, view: 'forgot', forgot: { ...a.forgot, step: 'new', id: DEMO, pw: '', pw2: '' } };
    },
  },
  'forgot-done': {
    label: 'Password changed',
    make: () => {
      const a = initialAuth(DEMO);
      return { ...a, view: 'forgot', forgot: { ...a.forgot, step: 'done', id: DEMO } };
    },
  },
};
