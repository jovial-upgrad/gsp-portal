/**
 * The GSP portal's sign-in (PRD slice 1, Sign-in and passwords): GSP people Admin created in GSP users, by their
 * GSP email. There's no signing up and no single sign-on (S1-5). The first time, they set up a password (from the
 * Set up your account email's link, which opens the new-password step directly, or with a code); later, they sign
 * in, or reset a forgotten password with a code. Prototype values: the code 000000, every password upGrad1234.
 */
import { TEST_PASSWORD } from '../../data/testing';
import { adminCfg, onAdminChange, setAdminCfg } from '../../admin/data/store';
import { CODE_MINUTES, CODES_PER_HOUR, MAX_WRONG_CODES } from '../data/config';
import { STAFF, label } from '../../data/staff';

export type PwStep = 'request' | 'code' | 'new' | 'done' | 'expired';
/** Resetting a forgotten password, or setting one up the first time. */
export type PwMode = 'reset' | 'setup';

export type TeamAuth = {
  view: 'signin' | 'password';
  id: string;
  pw: string;
  remember: boolean;
  status: 'idle' | 'checking' | 'success';
  error: string | null;
  /** From 2 tries left: "N tries left before sign-in pauses." */
  left: string | null;
  attempts: number;
  lockedUntil: number;
  notice: string | null;
  /** After a reset: offer to sign out on other devices (off by default). */
  others: boolean | null;
  /** The right password for someone whose access is turned off. */
  off: boolean;
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
    wrongCodes: number;
    sentAt: number;
    resendAt: number;
    pw: string;
    pw2: string;
    others: boolean;
    submitted: boolean;
    /** Opened from the Set up your account link, which already proves the email (proposal S1C-5). */
    viaLink: boolean;
  };
};

/** A GSP person who can sign in. `set`: they've set up their password. `off`: Admin deactivated them. */
export type Member = { name: string; first: string; email: string; org: string; role: string; set: boolean; off?: boolean };

/** Admin's users as they are now (GSP users): who can sign in, who hasn't set a password (Link sent), who's turned off. */
function members(): Member[] {
  let users: { name: string; email: string; role: string; status: string }[] = [];
  try {
    users = adminCfg().users;
  } catch {
    users = [];
  }
  const fromAdmin = users.map((u) => ({ name: u.name, first: u.name.split(' ')[0], email: u.email.toLowerCase(), org: 'GSP', role: u.role, set: u.status !== 'Link sent', off: u.status === 'Deactivated' }));
  const known = new Set(fromAdmin.map((m) => m.email));
  const rest = STAFF.filter((s) => !known.has(s.email.toLowerCase())).map((s) => ({ name: label(s), first: s.first, email: s.email.toLowerCase(), org: 'GSP', role: s.role, set: true }));
  return [...fromAdmin, ...rest];
}
const JOVIAL = 'jovial.lejo@upgrad.com';
const INVITED = 'prakriti.nanda@upgrad.com';
const DEACTIVATED = 'dzung.hoang@upgrad.com';
const first = (email: string): Member => {
  const s = STAFF.find((x) => x.email === email)!;
  return { name: label(s), first: s.first, email, org: 'GSP', role: s.role, set: email !== INVITED };
};
/** Who the portal is signed in as by default. */
export const TEAM_MEMBER = first(JOVIAL);
export const INVITED_MEMBER = first(INVITED);

/** Matches the GSP email, or the part before the @. Not case-sensitive. */
export function memberFor(id: string): Member | null {
  const v = id.trim().toLowerCase();
  if (!v) return null;
  return members().find((m) => m.email === v || m.email.split('@')[0] === v) ?? null;
}

/** Passwords set or changed on this visit; a reload goes back to the test password. */
const passwords = new Map<string, string>();
export const hasPassword = (m: Member) => passwords.has(m.email) || m.set;
export function setPassword(m: Member, pw: string) {
  passwords.set(m.email, pw);
  // a first setup makes the user Active in GSP users; a reset sets their wrong-password count back to 0
  tries.delete(m.email);
  try {
    setAdminCfg((c) => ({ ...c, users: c.users.map((u) => (u.email.toLowerCase() === m.email && u.status === 'Link sent' ? { ...u, status: 'Active', lastSignIn: Date.now() } : u)) }));
  } catch {
    /* Admin not loaded */
  }
}

/** The member, if the email and password match. Unknown emails fail the same way, so nobody learns who has access. */
export function verify(id: string, pw: string): Member | null {
  const m = memberFor(id);
  if (!m || !hasPassword(m)) return null;
  return pw === (passwords.get(m.email) ?? TEST_PASSWORD) ? m : null;
}
/** A successful sign-in: the count back to 0, and Last sign-in in GSP users. */
export function signedInNow(m: Member) {
  tries.delete(m.email);
  try {
    setAdminCfg((c) => ({ ...c, users: c.users.map((u) => (u.email.toLowerCase() === m.email ? { ...u, lastSignIn: Date.now() } : u)) }));
  } catch {
    /* Admin not loaded */
  }
}

/**
 * How tries are counted: per typed email, whether or not an account exists; only wrong passwords in a row count; a
 * sign-in or a reset sets the count back to 0. During the pause even the right password is refused.
 */
const tries = new Map<string, { n: number; until: number }>();
export const triesFor = (id: string) => {
  const k = id.trim().toLowerCase();
  const t = tries.get(k);
  if (t && t.until && t.until <= Date.now()) {
    tries.delete(k);
    return { n: 0, until: 0 };
  }
  return t ?? { n: 0, until: 0 };
};
export const wrongPassword = (id: string) => {
  const k = id.trim().toLowerCase();
  const n = triesFor(k).n + 1;
  const until = n >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60_000 : 0;
  tries.set(k, { n, until });
  return { n, until };
};

/** Sign-in rules (Admin › Other configurations › Sign-in security). Live: they follow Admin's setting from the next sign-in. */
export let MAX_ATTEMPTS = adminCfg().security.maxAttempts;
export let LOCK_MINUTES = adminCfg().security.lockMinutes;
/** Seconds before a code can be sent again. */
export let RESEND_SECONDS = adminCfg().security.resendSeconds;
onAdminChange(() => {
  ({ maxAttempts: MAX_ATTEMPTS, lockMinutes: LOCK_MINUTES, resendSeconds: RESEND_SECONDS } = adminCfg().security);
});
export { CODE_MINUTES, MAX_WRONG_CODES, CODES_PER_HOUR };
/** When a code just sent can be sent again. */
export const resendFrom = (now = Date.now()) => now + RESEND_SECONDS * 1000;
/** Codes sent per account in the last hour (at most 5, proposal). */
const sends = new Map<string, number[]>();
export function sendCode(id: string) {
  const k = id.trim().toLowerCase();
  const recent = (sends.get(k) ?? []).filter((t) => Date.now() - t < 3_600_000);
  if (recent.length >= CODES_PER_HOUR) return false;
  sends.set(k, [...recent, Date.now()]);
  return true;
}

export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!domain) return null;
  return `${user.slice(0, 1)}••••@${domain}`;
}
/** Where the code goes, without saying whether the email has access: the typed email, masked. */
export function codeDestination(id: string) {
  const m = memberFor(id);
  const email = m?.email ?? (id.includes('@') ? id.trim().toLowerCase() : '');
  return email ? maskEmail(email) : null;
}

/** The rule: 8 to 64 characters, with an uppercase letter, a lowercase letter and a number, and not the email's name part. */
export const PASSWORD_HINT = '8 to 64 characters, with an uppercase letter, a lowercase letter and a number. Not your email’s name.';
export function checkPassword(pw: string, id: string) {
  const name = id.trim().split('@')[0].toLowerCase();
  const meetsHint = pw.length >= 8 && pw.length <= 64 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);
  const parts = name.split(/[._+-]/).filter((p) => p.length >= 3);
  const usesName = parts.some((p) => pw.toLowerCase().includes(p));
  return { meetsHint, usesName, ok: meetsHint && !usesName };
}

const flowAt = (mode: PwMode, step: PwStep = 'request', id = '', viaLink = false): TeamAuth['flow'] => ({
  mode,
  step,
  dir: 1,
  id,
  busy: false,
  code: '',
  codeError: null,
  wrongCodes: 0,
  sentAt: step === 'code' ? Date.now() : 0,
  resendAt: step === 'code' ? resendFrom() : 0,
  pw: '',
  pw2: '',
  others: false,
  submitted: false,
  viaLink,
});

export const initialTeamAuth = (id = ''): TeamAuth => ({
  view: 'signin',
  id,
  pw: '',
  remember: true,
  status: 'idle',
  error: null,
  left: null,
  attempts: 0,
  lockedUntil: 0,
  notice: null,
  others: null,
  off: false,
  submitted: false,
  unset: false,
  flow: flowAt('reset'),
});

const ME = TEAM_MEMBER.email;
const NEW = INVITED_MEMBER.email;
const at = (mode: PwMode, step: PwStep, id: string, viaLink = false): TeamAuth => ({ ...initialTeamAuth(id), view: 'password', flow: flowAt(mode, step, id, viaLink) });

/**
 * Named states for review links (the Prototype panel), the PRD's sign-in states each. The sign-in and reset links
 * share RP Admin's names, so they open this sign-in in the GSP roles.
 */
export const TEAM_AUTH_PRESETS: Record<string, { label: string; make: () => TeamAuth }> = {
  signin: { label: 'Sign in', make: () => initialTeamAuth() },
  'signin-error': {
    label: 'Wrong password (2 tries left)',
    make: () => {
      tries.set(ME, { n: Math.max(0, MAX_ATTEMPTS - 2), until: 0 });
      return { ...initialTeamAuth(ME), attempts: MAX_ATTEMPTS - 2, submitted: true, error: 'That email and password don’t match. Check both, or reset your password.', left: '2 tries left before sign-in pauses.' };
    },
  },
  'signin-locked': {
    label: 'Sign-in paused',
    make: () => {
      tries.set(ME, { n: MAX_ATTEMPTS, until: Date.now() + LOCK_MINUTES * 60_000 });
      return { ...initialTeamAuth(ME), attempts: MAX_ATTEMPTS, lockedUntil: Date.now() + LOCK_MINUTES * 60_000 };
    },
  },
  'signin-unset': { label: 'No password yet', make: () => ({ ...initialTeamAuth(NEW), submitted: true, unset: true }) },
  'signin-off': { label: 'Access turned off', make: () => ({ ...initialTeamAuth(DEACTIVATED), submitted: true, off: true }) },
  forgot: { label: 'Forgot password', make: () => at('reset', 'request', '') },
  'forgot-code': { label: 'Reset code sent', make: () => at('reset', 'code', ME) },
  'code-expired': { label: 'Code expired', make: () => ({ ...at('reset', 'code', ME), flow: { ...flowAt('reset', 'code', ME), codeError: 'That code has expired. Send a new one.', sentAt: Date.now() - (CODE_MINUTES + 1) * 60_000 } }) },
  'code-many': { label: 'Too many wrong codes', make: () => ({ ...at('reset', 'code', ME), flow: { ...flowAt('reset', 'code', ME), wrongCodes: MAX_WRONG_CODES, codeError: 'Too many wrong codes. Send a new one.' } }) },
  'forgot-new': { label: 'Choose a new password', make: () => at('reset', 'new', ME) },
  'forgot-done': { label: 'Password changed', make: () => ({ ...initialTeamAuth(ME), notice: 'Password changed', others: false }) },
  setup: { label: 'Set up your password', make: () => at('setup', 'request', '') },
  'setup-code': { label: 'Set-up code sent', make: () => at('setup', 'code', NEW) },
  'setup-new': { label: 'Choose your password', make: () => at('setup', 'new', NEW) },
  'setup-done': { label: 'You’re all set', make: () => at('setup', 'done', NEW) },
  'link-new': { label: 'Login link: choose your password', make: () => at('setup', 'new', NEW, true) },
  'link-expired': { label: 'Login link expired', make: () => at('setup', 'expired', NEW, true) },
};
