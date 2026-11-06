import { adminCfg, onAdminChange } from '../../admin/data/store';
/** Sign-in and forgot-password state. Prototype rules are listed in the Prototype panel. */
import { TEST_PASSWORD } from '../../data/testing';
import { TEST_AGENCY, rpTeam } from '../../data/rpteam';

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

/**
 * One sample agency (HC35, Jovial 1 Nov): the accounts are the GSP test agency's team, from its one record
 * (data/rpteam.ts): Nesil Noble, its RP Admin (the test account), then its Branch Manager and counsellors.
 */
const ACCOUNTS: Account[] = rpTeam(TEST_AGENCY).map((m) => ({
  name: m.name,
  first: m.name.split(' ')[0],
  email: m.email ?? '',
  ...(m.id === 'me' ? { aliases: ['nesil@upgrad.com'] } : {}),
  agency: TEST_AGENCY,
  role: m.role,
}));

export const SAMPLE_ACCOUNT = ACCOUNTS[0];
/** The test agency's person for an RP role (Jovial, 2 Nov: one signed-in user for every role): its RP Admin, its Branch Manager, a counsellor. */
export const accountByRole = (role: string) => ACCOUNTS.find((a) => a.role === role) ?? SAMPLE_ACCOUNT;

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

// both portals read Admin › Sign-in security at every sign-in (PRD slice 1): 3 wrong passwords, a 10-minute pause
export let MAX_ATTEMPTS = adminCfg().security.maxAttempts;
export let LOCK_MINUTES = adminCfg().security.lockMinutes;
onAdminChange(() => {
  ({ maxAttempts: MAX_ATTEMPTS, lockMinutes: LOCK_MINUTES } = adminCfg().security);
});

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
  // an RP person whose RP is Suspended (slice 2), with the right password (PRD slice 1)
  'signin-agency-paused': {
    label: 'Agency paused',
    make: () => ({ ...initialAuth(DEMO), submitted: true, error: 'Your agency’s access is paused. Your Recruitment contact at GSP can tell you more.' }),
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
