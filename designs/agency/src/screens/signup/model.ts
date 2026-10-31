import { countryByName, emailInUse } from '../../data/partners';
import { checkPassword } from '../signin/model';
import type { DocSlot } from './docs';

/**
 * Fields copied from the PM prototype's "New agency signing up" form, plus a password. Registering takes the
 * first few (name, business, country, email, password); the rest are asked in the portal, before the documents.
 */
export type SignupForm = {
  first: string;
  last: string;
  biz: string;
  country: string;
  /** Only while registering: never saved in the draft, cleared once the account exists. */
  pw: string;
  pw2: string;
  state: string;
  city: string;
  email: string;
  dial: string;
  phone: string;
  ownerSame: boolean;
  ownerName: string;
  ownerEmail: string;
  ownerDial: string;
  ownerPhone: string;
  cemail: string;
  src: string;
  ref: string;
};

export type EmailStatus = 'idle' | 'sending' | 'sent' | 'checking' | 'verified';

/**
 * Registering: form → code (the 6-digit code sent to the business email) → creating.
 * Then, in the portal: details (business details and documents; nothing else opens) → sending → sent (GSP is
 * verifying; course search and the profile open) → verified (All Access).
 * GSP can send documents back (sent-back), which returns the partner to uploading.
 */
export type Stage = 'form' | 'code' | 'creating' | 'details' | 'sending' | 'sent' | 'sent-back' | 'verified';

export type SignupState = {
  form: SignupForm;
  email: { status: EmailStatus; code: string; codeError: string | null; sentTo: string; resendAt: number };
  touched: Partial<Record<keyof SignupForm | 'code', boolean>>;
  submitted: boolean;
  /** Counts failed submit attempts, so focus moves to the first field to fix each time. */
  attempts?: number;
  stage: Stage;
  /** In the portal: the business details are saved, so the documents come next. */
  detailsDone?: boolean;
  /** Business documents, by document name. */
  docs: Record<string, DocSlot>;
  /** They tried to send with something missing: missing slots show their error. */
  docsTried?: number;
  /** When the documents went to GSP, when GSP last sent any back, and when it verified the business. */
  sentAt?: number;
  reviewedAt?: number;
  verifiedAt?: number;
  /** How many times the documents have gone to GSP (2 or more after replacing sent-back ones). */
  rounds?: number;
};

export const EMPTY_FORM: SignupForm = {
  first: '',
  last: '',
  biz: '',
  country: 'India',
  pw: '',
  pw2: '',
  state: '',
  city: '',
  email: '',
  dial: '+91',
  phone: '',
  ownerSame: true,
  ownerName: '',
  ownerEmail: '',
  ownerDial: '+91',
  ownerPhone: '',
  cemail: '',
  src: '',
  ref: '',
};

export const initialState = (): SignupState => ({
  form: { ...EMPTY_FORM },
  email: { status: 'idle', code: '', codeError: null, sentTo: '', resendAt: 0 },
  touched: {},
  submitted: false,
  stage: 'form',
  docs: {},
});

/** The sample agency: what it gave when registering, then the details it adds in the portal. */
export const SAMPLE_REGISTER: SignupForm = {
  ...EMPTY_FORM,
  first: 'Asha',
  last: 'Menon',
  biz: 'BrightPath Overseas',
  country: 'India',
  email: 'asha@brightpathoverseas.in',
};
export const SAMPLE: SignupForm = {
  ...SAMPLE_REGISTER,
  state: 'Karnataka',
  city: 'Bengaluru',
  phone: '98450 12345',
  cemail: 'accounts@brightpathoverseas.in',
  src: 'Event or fair',
};
const PW = 'Bright2026';

/** Named states the prototype can jump to (each has a #token link). The portal's own come from the portal. */
export const PRESETS: Record<string, { label: string; make: () => SignupState }> = {
  signup: { label: 'Empty form', make: initialState },
  'signup-filled': {
    label: 'Filled in',
    make: () => ({ ...initialState(), form: { ...SAMPLE_REGISTER, pw: PW, pw2: PW } }),
  },
  'signup-errors': {
    label: 'Sent with errors',
    make: () => ({
      ...initialState(),
      form: { ...EMPTY_FORM, first: 'Asha', biz: 'BrightPath Overseas', email: 'asha@brightpath', pw: 'bright', pw2: 'bright' },
      submitted: true,
    }),
  },
  'signup-email-used': {
    label: 'Email already on GSP',
    make: () => ({
      ...initialState(),
      form: { ...EMPTY_FORM, first: 'Ananya', last: 'Rao', email: 'ananya@horizonoverseas.in' },
      touched: { email: true },
    }),
  },
  'signup-code': {
    label: 'Code sent to email',
    make: () => ({
      ...initialState(),
      form: { ...SAMPLE_REGISTER, pw: PW, pw2: PW },
      stage: 'code',
      email: { status: 'sent', code: '', codeError: null, sentTo: SAMPLE_REGISTER.email, resendAt: Date.now() + 30_000 },
    }),
  },
  'signup-code-wrong': {
    label: 'Code doesn’t match',
    make: () => ({
      ...initialState(),
      form: { ...SAMPLE_REGISTER, pw: PW, pw2: PW },
      stage: 'code',
      email: {
        status: 'sent',
        code: '',
        codeError: 'That code doesn’t match. Check the latest email from GSP, or send a new code.',
        sentTo: SAMPLE_REGISTER.email,
        resendAt: 0,
      },
    }),
  },
};

/** The account the sample agency has once its email is verified: in the portal, with the rest still to add. */
export function accountCreated(form: SignupForm = SAMPLE_REGISTER): SignupState {
  return {
    ...initialState(),
    form: { ...form, pw: '', pw2: '' },
    stage: 'details',
    email: { status: 'verified', code: '', codeError: null, sentTo: form.email, resendAt: 0 },
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v: string) => EMAIL_RE.test(v.trim());
const digits = (v: string) => v.replace(/\D/g, '').length;

export type Errors = Partial<Record<keyof SignupForm | 'code', string>>;

/** Registering: plain-language messages that say what to do. */
export function validateRegister(s: SignupState): Errors {
  const f = s.form;
  const e: Errors = {};
  if (!f.first.trim()) e.first = 'Enter your first name.';
  if (!f.last.trim()) e.last = 'Enter your last name.';
  if (!f.biz.trim()) e.biz = 'Enter your business name as it appears on your registration certificate.';
  if (!countryByName(f.country)) e.country = 'Choose your country from the list.';
  if (!f.email.trim()) e.email = 'Enter your business email.';
  else if (!isEmail(f.email)) e.email = 'Enter a full email address, like you@youragency.com.';
  else if (emailInUse(f.email)) e.email = 'This email already has a GSP account.';
  const pw = checkPassword(f.pw, f.email);
  if (!f.pw) e.pw = 'Choose a password.';
  else if (!pw.meetsHint) e.pw = PASSWORD_RULE;
  else if (pw.usesName) e.pw = 'Don’t use your email name in your password.';
  if (!e.pw && f.pw2 !== f.pw) e.pw2 = f.pw2 ? 'The two passwords don’t match yet.' : 'Type your password again.';
  return e;
}
export const PASSWORD_RULE = 'Use at least 8 characters, with upper and lowercase letters and a number.';

/** In the portal: the business details, all of them as before registration was split. */
export function validateDetails(s: SignupState): Errors {
  const f = s.form;
  const e: Errors = {};
  if (!f.first.trim()) e.first = 'Enter your first name.';
  if (!f.last.trim()) e.last = 'Enter your last name.';
  if (!f.biz.trim()) e.biz = 'Enter your business name as it appears on your registration certificate.';
  if (!countryByName(f.country)) e.country = 'Choose your country from the list.';
  if ((countryByName(f.country)?.states.length ?? 0) > 0 && !f.state) e.state = 'Choose your state or province.';
  if (!f.city.trim()) e.city = 'Enter the city your office is in.';
  if (!f.phone.trim()) e.phone = 'Enter a mobile number.';
  else if (digits(f.phone) < 7 || digits(f.phone) > 13) e.phone = 'Enter a mobile number with 7 to 13 digits.';
  if (!f.ownerSame) {
    if (!f.ownerName.trim()) e.ownerName = 'Enter the owner’s full name.';
    if (!isEmail(f.ownerEmail)) e.ownerEmail = 'Enter the owner’s email.';
    if (digits(f.ownerPhone) < 7) e.ownerPhone = 'Enter the owner’s mobile number.';
  }
  if (!f.cemail.trim()) e.cemail = 'Enter the email where commission statements should go.';
  else if (!isEmail(f.cemail)) e.cemail = 'Enter a full email address, like accounts@youragency.com.';
  return e;
}

/** Field order for the error count and focus. */
export const REGISTER_ORDER: (keyof SignupForm)[] = ['first', 'last', 'biz', 'country', 'email', 'pw', 'pw2'];
export const DETAILS_ORDER: (keyof SignupForm)[] = [
  'first', 'last', 'biz', 'country', 'state', 'city', 'phone',
  'ownerName', 'ownerEmail', 'ownerPhone', 'cemail',
];

export const FIELD_LABEL: Record<string, string> = {
  first: 'First name', last: 'Last name', biz: 'Registered business name', country: 'Country',
  state: 'State or province', city: 'City', email: 'Business email', phone: 'Mobile number',
  ownerName: 'Owner’s name', ownerEmail: 'Owner’s email', ownerPhone: 'Owner’s mobile', cemail: 'Commissions email',
  src: 'How you found us', pw: 'Password', pw2: 'Password, again',
};

/** WhatsApp is the update channel in these markets (brief); elsewhere it's email. */
export const WHATSAPP_MARKETS = ['India', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Vietnam'];

const KEY = 'gsp-agency-signup-v1';
export function loadDraft(): SignupState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SignupState;
    if (!s || !s.form) return null;
    // a reload interrupts whatever was in flight: half-done uploads start again, sends go back a step.
    // Older drafts hold stages from the one-page form: an unsent form starts again; an account made there
    // carries on in the portal with its details already in.
    const old = s.stage as string;
    const stage: Stage =
      old === 'creating' || old === 'duplicate' ? 'form' : old === 'sending' || old === 'created' || old.startsWith('next') ? 'details' : s.stage;
    const detailsDone = s.detailsDone ?? (old === 'created' || old === 'sending' || old.startsWith('next'));
    const docs = Object.fromEntries(Object.entries(s.docs ?? {}).map(([k, v]) => [k, v.status === 'uploading' ? { status: 'empty' as const } : v]));
    return { ...initialState(), ...s, form: { ...EMPTY_FORM, ...s.form, pw: '', pw2: '' }, stage, detailsDone, docs };
  } catch {
    return null;
  }
}
/** Drafts never keep a password. */
export function saveDraft(s: SignupState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, form: { ...s.form, pw: '', pw2: '' } }));
  } catch {
    /* storage unavailable: the form still works, it just isn't kept */
  }
}
export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
