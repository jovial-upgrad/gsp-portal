/** The portal around a partner: which sections they can use, and the verification that opens the rest. */
import type { IconName } from '../../components/Icon';
import type { Account } from '../signin/model';
import { SAMPLE, accountCreated, type SignupState } from '../signup/model';
import { SAMPLE_FILES, docsFor } from '../signup/docs';

export type Section = 'home' | 'applications' | 'students' | 'courses' | 'earnings' | 'profile';

/**
 * setup: the account exists, but the business details and documents haven't gone to GSP; only Home is open.
 * verifying: GSP has the business details and documents; course search and the profile are open, the rest waits.
 * all: GSP verified the business and its documents, so every section is open.
 */
export type Access = 'setup' | 'verifying' | 'all';

/** The menu never changes order with the account's state; locked sections keep their place and say so. */
export const NAV: { key: Section; label: string; short: string; icon: IconName; locked: boolean }[] = [
  { key: 'home', label: 'Home', short: 'Home', icon: 'home', locked: false },
  { key: 'courses', label: 'Find courses', short: 'Courses', icon: 'search', locked: false },
  { key: 'applications', label: 'Applications', short: 'Applications', icon: 'doc', locked: true },
  { key: 'students', label: 'Students', short: 'Students', icon: 'people', locked: true },
  { key: 'earnings', label: 'Earnings', short: 'Earnings', icon: 'wallet', locked: true },
  { key: 'profile', label: 'Profile', short: 'Profile', icon: 'building', locked: false },
];

/** What each locked section is for, said on its locked page and on Home. */
export const LOCKED_COPY: Partial<Record<Section, { title: string; text: string }>> = {
  courses: { title: 'Find courses', text: 'Compare courses, fees, intakes and entry requirements.' },
  profile: { title: 'Profile', text: 'Your business details, documents and team.' },
  students: { title: 'Students', text: 'Add students once and keep their documents in one place.' },
  applications: { title: 'Applications', text: 'Apply for your students and see who has each application.' },
  earnings: { title: 'Earnings', text: 'See the commission you’ve earned and when it’s paid.' },
};

/** The owner who registered is the agency's admin. */
export const portalAccount = (s: SignupState): Account => ({
  name: `${s.form.first} ${s.form.last}`.trim() || 'Partner',
  first: s.form.first || 'there',
  email: s.form.email,
  agency: s.form.biz,
  role: 'RP Admin',
});

/** Still registering: the account exists, the business details and documents haven't gone to GSP yet. */
export const inSetup = (s: SignupState | null) => !!s && ['form', 'code', 'creating', 'details', 'sending'].includes(s.stage);
export const accessOf = (s: SignupState | null): Access => (!s || s.stage === 'verified' ? 'all' : inSetup(s) ? 'setup' : 'verifying');

/**
 * Where joining is: finishing registration (setup), with GSP, back with the partner (GSP couldn't verify one
 * or more documents and said why), or done. The last locks only open when it's done.
 */
export type Phase = 'setup' | 'verifying' | 'sent-back' | 'verified';
export const phaseOf = (s: SignupState | null): Phase =>
  !s || s.stage === 'verified' ? 'verified' : inSetup(s) ? 'setup' : s.stage === 'sent-back' ? 'sent-back' : 'verifying';

/** GSP verifies the business and every document it was sent. */
export function verifyAll(s: SignupState): SignupState {
  return {
    ...s,
    stage: 'verified',
    verifiedAt: Date.now(),
    docs: Object.fromEntries(Object.entries(s.docs).map(([k, v]) => [k, v.file ? { ...v, status: 'accepted' as const, reason: undefined } : v])),
  };
}

/** The partner sends the replaced documents: the new files go to GSP and verification starts again. */
export function resend(s: SignupState): SignupState {
  return {
    ...s,
    stage: 'sent',
    sentAt: Date.now(),
    rounds: (s.rounds ?? 1) + 1,
    docs: Object.fromEntries(Object.entries(s.docs).map(([k, v]) => [k, v.status === 'uploaded' ? { ...v, status: 'checking' as const, reason: undefined } : v])),
  };
}

const MIN = 60_000;
/** The sample agency, its details and documents sent a little while ago. */
function sampleSent(): SignupState {
  return {
    ...accountCreated(SAMPLE),
    stage: 'sent',
    detailsDone: true,
    sentAt: Date.now() - 18 * MIN,
    docs: {
      'Business registration certificate': { status: 'checking', file: SAMPLE_FILES['Business registration certificate'] },
      'PAN card': { status: 'checking', file: SAMPLE_FILES['PAN card'] },
      'GST certificate': { status: 'checking', file: SAMPLE_FILES['GST certificate'] },
    },
  };
}
const hasAccount = (s: SignupState | null): s is SignupState => !!s && ['details', 'sending', 'sent', 'sent-back', 'verified'].includes(s.stage);
const wasSent = (s: SignupState | null): s is SignupState => !!s && ['sent', 'sent-back', 'verified'].includes(s.stage);

/**
 * GSP's note for a document it couldn't verify: what's wrong and what to upload instead.
 * Two kinds in this prototype: the wrong document, or a file that can't be read.
 */
function reasonFor(doc: string, kind: 'wrong' | 'unclear', biz: string) {
  if (kind === 'wrong') {
    if (doc === 'Business registration certificate')
      return `This is a shop and establishment licence, not the registration certificate. Upload the certificate of registration issued to ${biz}.`;
    return `This isn’t the ${doc.toLowerCase()}. Upload the ${doc.toLowerCase()} for ${biz}.`;
  }
  if (doc === 'PAN card') return 'The photo is blurred, so the PAN number can’t be read. Upload a sharp photo or a scan, with the whole card in the frame.';
  if (doc === 'Owner’s ID') return 'Part of the ID is cut off. Upload a photo or scan that shows the whole page, including the photo and the number.';
  return 'The file is blurred and the details can’t be read. Upload a sharp photo or a scan of the whole page.';
}

/** GSP sends some documents back with a reason each; the rest are verified and stay as they are. */
function sendBack(s: SignupState, back: { doc: string; kind: 'wrong' | 'unclear' }[]): SignupState {
  const docs = docsFor(s.form.country).map((d) => d.name);
  const slots = Object.fromEntries(
    docs
      .filter((name) => s.docs[name]?.file || back.some((b) => b.doc === name))
      .map((name) => {
        const b = back.find((x) => x.doc === name);
        const slot = s.docs[name] ?? { status: 'empty' as const };
        return [name, b ? { status: 'sent-back' as const, file: slot.file, reason: reasonFor(name, b.kind, s.form.biz) } : { ...slot, status: 'accepted' as const, reason: undefined }];
      }),
  );
  return { ...s, stage: 'sent-back', verifiedAt: undefined, reviewedAt: Date.now() - 6 * MIN, sentAt: s.sentAt ?? Date.now() - 3 * 60 * MIN, docs: { ...s.docs, ...slots } };
}
/** The first two required documents for the agency's country: the ones GSP sends back in the review states. */
const firstRequired = (s: SignupState) => docsFor(s.form.country).filter((d) => !d.optional).map((d) => d.name);

/** Review links for course search: the partner's own registration once it's been sent, otherwise the sample. */
export const sentForReview = (prev: SignupState | null): SignupState => (wasSent(prev) ? prev : sampleSent());

/**
 * Named portal states. Each takes the partner's own registration when there is one, so reviewing
 * "verified" after registering shows your own agency unlocking rather than the sample.
 */
export const PORTAL_PRESETS: Record<string, { label: string; make: (prev: SignupState | null) => SignupState }> = {
  portal: {
    label: 'Your registration',
    make: (prev) => (hasAccount(prev) ? prev : sampleSent()),
  },
  'portal-setup': {
    label: 'Registered: Onboarding',
    make: (prev) => {
      const s = hasAccount(prev) ? prev : accountCreated();
      return { ...s, stage: 'details', detailsDone: false, submitted: false, attempts: 0, touched: {}, docs: {}, docsTried: 0, sentAt: undefined, reviewedAt: undefined, verifiedAt: undefined, rounds: undefined };
    },
  },
  'portal-setup-docs': {
    label: 'Onboarding: Documents',
    make: (prev) => {
      const s = hasAccount(prev) && prev.detailsDone ? prev : accountCreated(SAMPLE);
      const [first, second] = docsFor(s.form.country).filter((d) => !d.optional).map((d) => d.name);
      return {
        ...s,
        stage: 'details',
        detailsDone: true,
        docsTried: 0,
        sentAt: undefined,
        reviewedAt: undefined,
        verifiedAt: undefined,
        rounds: undefined,
        docs: {
          ...(first ? { [first]: { status: 'uploaded' as const, file: SAMPLE_FILES[first] ?? { name: `${first}.pdf`, size: 412_000, type: 'application/pdf' } } } : {}),
          ...(second ? { [second]: { status: 'error' as const, error: '“PAN-card.heic” is a .heic file. Upload a PDF, JPG or PNG.' } } : {}),
        },
      };
    },
  },
  'portal-verifying': {
    label: 'Onboarding: Verification',
    make: (prev) => {
      if (!wasSent(prev)) return sampleSent();
      const docs = Object.fromEntries(Object.entries(prev.docs).map(([k, v]) => [k, v.file ? { ...v, status: 'checking' as const, reason: undefined } : v]));
      return { ...prev, stage: 'sent', verifiedAt: undefined, docs, sentAt: prev.sentAt ?? Date.now() - 18 * MIN };
    },
  },
  'portal-sent-back': {
    label: 'Onboarding: Verification Failed (1)',
    make: (prev) => {
      const s = wasSent(prev) ? prev : sampleSent();
      return sendBack(s, [{ doc: firstRequired(s)[1] ?? firstRequired(s)[0], kind: 'unclear' }]);
    },
  },
  'portal-sent-back-2': {
    label: 'Onboarding: Verification Failed (2)',
    make: (prev) => {
      const s = wasSent(prev) ? prev : sampleSent();
      const [a, b] = firstRequired(s);
      return sendBack(s, [{ doc: a, kind: 'wrong' }, ...(b ? [{ doc: b, kind: 'unclear' as const }] : [])]);
    },
  },
  'portal-verified': {
    label: 'Verified: All Access',
    make: (prev) => verifyAll(wasSent(prev) ? prev : sampleSent()),
  },
};

/** Documents for the agency's country, each with what was sent and where it is. */
export function sentDocs(s: SignupState) {
  return docsFor(s.form.country).map((need) => ({ need, slot: s.docs[need.name] ?? { status: 'empty' as const } }));
}

/* ---------- Dates, in the partner's terms ---------- */

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** "today, 10:42 am" or "24 Oct, 10:42 am" */
export function whenLabel(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${sameDay(d, new Date()) ? 'today' : day(d)}, ${time(d)}`;
}

/** GSP works Monday to Saturday; "usually within 1 working day" lands on the next one. */
export function expectedBy(ts?: number) {
  const d = new Date(ts ?? Date.now());
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
