/**
 * The GSP Admin's sign-in (29 Oct): GSP people a GSP admin gave access to, by their GSP email. There's no
 * registering. The first time, they set up a password with a code sent to that email; later, they sign in, or reset
 * a forgotten password the same way. Prototype values: the code 000000, Jovial's password upGrad1234.
 */
import { TEST_PASSWORD } from '../../data/testing';

export type PwStep = 'request' | 'code' | 'new' | 'done';
/** Resetting a forgotten password, or setting one up the first time. */
export type PwMode = 'reset' | 'setup';

export type TeamAuth = {
  view: 'signin' | 'password';
  id: string;
  pw: string;
  remember: boolean;
  status: 'idle' | 'checking' | 'success';
  error: string | null;
  attempts: number;
  lockedUntil: number;
  notice: string | null;
  submitted: boolean;
  /** Someone with access who hasn't set a password yet tried to sign in: offer to set one up. */
  unset: boolean;
  flow: {
    mode: PwMode;
    step: PwStep;
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

import { STAFF, label } from '../../data/staff';

/** A GSP person with access to GSP Admin. `set`: they've set up their password. */
export type Member = { name: string; first: string; email: string; org: string; role: string; set: boolean };

/** Everyone on GSP's staff list can sign in (data/staff.ts). One of them hasn't set a password yet, for the first-time flow. */
const INVITED = 'prakriti.nanda@upgrad.com';
const MEMBERS: Member[] = [
  ...STAFF.filter((s) => s.email === 'jovial.lejo@upgrad.com'),
  ...STAFF.filter((s) => s.email === INVITED),
  ...STAFF.filter((s) => s.email !== 'jovial.lejo@upgrad.com' && s.email !== INVITED),
].map((s) => ({ name: label(s), first: s.first, email: s.email.toLowerCase(), org: 'GSP', role: s.role, set: s.email !== INVITED }));

/** Who the portal is signed in as. */
export const TEAM_MEMBER = MEMBERS[0];
export const INVITED_MEMBER = MEMBERS[1];

/** Matches the GSP email, or the part before the @. */
export function memberFor(id: string): Member | null {
  const v = id.trim().toLowerCase();
  if (!v) return null;
  return MEMBERS.find((m) => m.email === v || m.email.split('@')[0] === v) ?? null;
}

/** Passwords set or changed on this visit; a reload goes back to the test password (and to Sara's not being set). */
const passwords = new Map<string, string>();
export const hasPassword = (m: Member) => m.set || passwords.has(m.email);
export const setPassword = (m: Member, pw: string) => passwords.set(m.email, pw);

/** The member, if the email and password match. Unknown emails fail the same way, so nobody learns who has access. */
export function verify(id: string, pw: string): Member | null {
  const m = memberFor(id);
  if (!m || !hasPassword(m)) return null;
  return pw === (passwords.get(m.email) ?? TEST_PASSWORD) ? m : null;
}

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!domain) return null;
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(3, Math.min(6, user.length - 1)))}@${domain}`;
}
/** Where the code goes, without saying whether the email has access. */
export function codeDestination(id: string) {
  const m = memberFor(id);
  const email = m?.email ?? (id.includes('@') ? id.trim() : '');
  return email ? maskEmail(email) : null;
}

export const PASSWORD_HINT = 'Use at least 8 characters, with upper and lowercase letters and a number.';
export function checkPassword(pw: string, id: string) {
  const name = id.trim().split('@')[0].toLowerCase();
  const meetsHint = pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);
  const usesName = name.length >= 3 && pw.toLowerCase().includes(name.split('.')[0]);
  return { meetsHint, usesName, ok: meetsHint && !usesName };
}

const flowAt = (mode: PwMode, step: PwStep = 'request', id = ''): TeamAuth['flow'] => ({
  mode,
  step,
  dir: 1,
  id,
  busy: false,
  code: '',
  codeError: null,
  resendAt: step === 'code' ? Date.now() + 30_000 : 0,
  pw: '',
  pw2: '',
  others: true,
  submitted: false,
});

export const initialTeamAuth = (id = ''): TeamAuth => ({
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
  unset: false,
  flow: flowAt('reset'),
});

const ISHAAN = TEAM_MEMBER.email;
const SARA = INVITED_MEMBER.email;
const at = (mode: PwMode, step: PwStep, id: string): TeamAuth => ({ ...initialTeamAuth(id), view: 'password', flow: flowAt(mode, step, id) });

/**
 * Named states for review links. The sign-in and reset links share RP Admin's names, so the Prototype panel's
 * states open this sign-in in this role; setting up a password has its own.
 */
export const TEAM_AUTH_PRESETS: Record<string, { label: string; make: () => TeamAuth }> = {
  signin: { label: 'Sign in', make: () => initialTeamAuth() },
  'signin-error': {
    label: 'Wrong password',
    make: () => ({ ...initialTeamAuth(ISHAAN), attempts: 3, submitted: true, error: 'That email and password don’t match. 2 tries left before sign-in pauses for 15 minutes.' }),
  },
  'signin-locked': { label: 'Sign-in paused', make: () => ({ ...initialTeamAuth(ISHAAN), attempts: MAX_ATTEMPTS, lockedUntil: Date.now() + LOCK_MINUTES * 60_000 }) },
  'signin-unset': { label: 'No password yet', make: () => ({ ...initialTeamAuth(SARA), submitted: true, unset: true }) },
  forgot: { label: 'Forgot password', make: () => at('reset', 'request', '') },
  'forgot-code': { label: 'Reset code sent', make: () => at('reset', 'code', ISHAAN) },
  'forgot-new': { label: 'Choose a new password', make: () => at('reset', 'new', ISHAAN) },
  'forgot-done': { label: 'Password changed', make: () => at('reset', 'done', ISHAAN) },
  setup: { label: 'Set up your password', make: () => at('setup', 'request', '') },
  'setup-code': { label: 'Set-up code sent', make: () => at('setup', 'code', SARA) },
  'setup-new': { label: 'Choose your password', make: () => at('setup', 'new', SARA) },
  'setup-done': { label: 'Password set', make: () => at('setup', 'done', SARA) },
};
