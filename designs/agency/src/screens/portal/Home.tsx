import { TEST_COUNTRY } from '../../data/rpteam';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { ContactCard } from '../../components/ContactCard';
import { Icon, type IconName } from '../../components/Icon';
import type { Contact } from '../../data/partners';
import type { Account } from '../signin/model';
import { Setup } from './Setup';
import { WHATSAPP_MARKETS, type SignupState } from '../signup/model';
import { inSentence, returnedDocs, stillToReplace } from '../signup/docs';
import { LOCKED_COPY, expectedBy, phaseOf, sentDocs, whenLabel, type Access, type Section } from './model';
import { Track, type StepState } from './Track';
import { adminCfg } from '../../admin/data/store';
import { NATIONALITY } from '../../admin/data/config';
import { STAFF, label } from '../../data/staff';
import { courseOf, isOpen, needsYou, statusText, type Application } from '../../data/applications';
import { fullName, type Student } from '../../data/students';
import { shortDate } from '../../data/dates';

/** The agency's region's Admissions contact (W15): GSP · Admin › Sales regions, as a person from the staff list. */
export function admissionsContactFor(country: string): Contact | null {
  const region = NATIONALITY[country] || country;
  const name = adminCfg().regions.find((g) => g.name === region)?.contact;
  const s = name ? STAFF.find((x) => label(x) === name) : undefined;
  if (!s) return null;
  return { name: label(s), role: `Admissions contact · ${region}`, phone: s.phone ? `${s.dial} ${s.phone}` : '', email: s.email, initials: `${s.first[0] ?? ''}${s.last[0] ?? ''}` };
}

const ease = [0.2, 0.8, 0.2, 1] as const;
const rise = (reduce: boolean | null, i: number) =>
  reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease, delay: 0.06 + i * 0.07 } };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const LOCKED: { key: Section; icon: IconName }[] = [
  { key: 'students', icon: 'people' },
  { key: 'applications', icon: 'doc' },
  { key: 'earnings', icon: 'wallet' },
];

/** Home: while GSP verifies, what's happening and what opens next; once verified, where to start. */
export function Home({
  acc,
  join,
  access,
  manager,
  onDocs,
  go,
  set,
  scrollTop,
  startKey,
  apps = [],
  students = [],
  onOpenApp,
}: {
  /** The agency's applications and students, for what's pending on it (W24). */
  apps?: Application[];
  students?: Student[];
  onOpenApp?: (id: string) => void;
  acc: Account;
  join: SignupState | null;
  access: Access;
  manager: Contact | null;
  onDocs: () => void;
  go: (k: Section) => void;
  /** Updates the registration while the partner finishes it here. */
  set?: (fn: (s: SignupState) => SignupState) => void;
  scrollTop: () => void;
  /** Changes when a review state is picked, so registering starts again from that state. */
  startKey?: string;
}) {
  const reduce = useReducedMotion();
  const setup = access === 'setup' && join && set ? join : null;
  const verifying = access === 'verifying' && join;
  const phase = phaseOf(join);

  return (
    <div className="home">
      <motion.header className="home__head" {...rise(reduce, 0)}>
        {/* the same greeting and line in every state, from the moment the portal first opens */}
        <h1 className="home__title">
          {greeting()}, {acc.first}{' '}
          <span className="home__wave" aria-hidden="true">
            👋
          </span>
        </h1>
        <p className="home__lead">Welcome to the upGrad GSP Partner Portal.</p>
      </motion.header>

      <div className="home__grid">
        <div className="home__main">
          {setup ? (
            <Setup key={startKey} join={setup} set={set!} scrollTop={scrollTop} />
          ) : verifying ? (
            <>
              {phase === 'sent-back' ? <ReturnCard join={join} onDocs={onDocs} reduce={reduce} /> : <VerifyCard join={join} onDocs={onDocs} reduce={reduce} />}
              <motion.section className="home__sec" aria-labelledby="after-title" {...rise(reduce, 2)}>
                <h2 id="after-title" className="home__h2">
                  Opens after verification
                </h2>
                <ul className="ltiles">
                  {LOCKED.map((l) => (
                    <li key={l.key} className="ltile">
                      <span className="ltile__icon" aria-hidden="true">
                        <Icon name={l.icon} size={20} />
                      </span>
                      <span className="ltile__lock" aria-hidden="true">
                        <Icon name="lock" size={14} />
                      </span>
                      <span className="ltile__title">{LOCKED_COPY[l.key]?.title}</span>
                      <span className="ltile__text">{LOCKED_COPY[l.key]?.text}</span>
                    </li>
                  ))}
                </ul>
              </motion.section>
              <motion.section className="card ccard" aria-labelledby="courses-title" {...rise(reduce, 3)}>
                <span className="ccard__icon" aria-hidden="true">
                  <Icon name="search" size={22} />
                </span>
                <div className="ccard__body">
                  <span className="pill pill--ok">Open now</span>
                  <h2 id="courses-title" className="ccard__title">
                    Find courses
                  </h2>
                  <p className="ccard__text">Compare courses, fees, intakes and entry requirements in the UK, Australia, Canada, the USA and more.</p>
                </div>
                <Button variant="secondary" onClick={() => go('courses')} iconRight={<Icon name="arrowRight" size={18} />}>
                  Search courses
                </Button>
              </motion.section>
            </>
          ) : (
            <>
              {join && <VerifiedCard join={join} onDocs={onDocs} reduce={reduce} />}
              <PendingCard apps={apps} students={students} onOpen={onOpenApp} go={go} reduce={reduce} />
              <motion.section className="home__sec" aria-labelledby="start-title" {...rise(reduce, 2)}>
                <h2 id="start-title" className="vh">
                  Start here
                </h2>
                <ul className="stiles">
                  <StartTile icon="people" title="Add a student" text="Fill their details once and reuse them for every application." onClick={() => go('students')} />
                  <StartTile icon="search" title="Find a course" text="Search by subject, country and intake, with entry requirements." onClick={() => go('courses')} />
                  <StartTile icon="doc" title="Start an application" text="Pick a student and a course, and GSP takes it from there." onClick={() => go('applications')} />
                </ul>
              </motion.section>
            </>
          )}
        </div>

        <motion.aside className="home__side" aria-label="Help" {...rise(reduce, 2)}>
          <section className="card side-card" aria-labelledby="contact-title">
            <h2 id="contact-title" className="side-card__title">
              Your GSP contacts
            </h2>
            {setup ? (
              // no one is assigned until the documents go to GSP
              <div className="cempty">
                <span className="cempty__art" aria-hidden="true">
                  <Icon name="user" size={24} />
                  <span className="cempty__badge">
                    <Icon name="clock" size={13} />
                  </span>
                </span>
                <p className="cempty__title">Your GSP relationship manager isn’t assigned yet</p>
                <p className="side-card__text">Once you upload your documents and send them for verification, we’ll assign one.</p>
              </div>
            ) : manager ? (
              <>
                <ContactCard person={{ ...manager, role: 'Partner manager (BDM)' }} hours="Mon–Sat, 9:30 am to 6:30 pm" />
                {/* and the region's Admissions contact, for applications (W15) */}
                {(() => {
                  const adm = admissionsContactFor(join?.form.country || TEST_COUNTRY);
                  return adm ? <ContactCard person={adm} hours="Mon–Sat, 9:30 am to 6:30 pm" /> : null;
                })()}
              </>
            ) : (
              <p className="side-card__text">Your partner manager will be in touch within 1 working day. Their name and number will show here.</p>
            )}
          </section>
        </motion.aside>
      </div>
    </div>
  );
}

/** The one thing happening now: GSP verifying the business and its documents, where it's up to, and when to expect it. */
function VerifyCard({ join, onDocs, reduce }: { join: SignupState; onDocs: () => void; reduce: boolean | null }) {
  const f = join.form;
  const sent = sentDocs(join).filter((d) => d.slot.file);
  const whatsapp = WHATSAPP_MARKETS.includes(f.country);
  const again = (join.rounds ?? 1) > 1;
  const steps: { title: string; note?: string; state: StepState }[] = [
    { title: 'Account created', state: 'done' },
    { title: again ? 'Documents sent again' : 'Details and documents sent', note: whenLabel(join.sentAt), state: 'done' },
    { title: 'Verification', state: 'now' },
    { title: 'All Access', state: 'end' },
  ];

  return (
    <motion.section className="card vcard" aria-labelledby="vcard-title" {...rise(reduce, 1)}>
      <div className="vcard__head">
        <span className="who who--gsp">With GSP</span>
        <h2 id="vcard-title" className="vcard__title">
          Document verification in progress
        </h2>
        <p className="vcard__text">
          GSP is verifying your business details and documents, usually within 1 working day. Expect it by{' '}
          <strong className="num">{expectedBy(join.sentAt)}</strong>.
        </p>
      </div>

      <Track steps={steps} />

      <ul className="vchecks" aria-label="What GSP verifies">
        <li className="vcheck">
          <span className="vcheck__icon" aria-hidden="true">
            <Icon name="building" size={18} />
          </span>
          <span className="vcheck__text">
            <span className="vcheck__name">Business details</span>
            <span className="vcheck__meta">
              {f.biz} · {[f.city, f.country].filter(Boolean).join(', ')}
            </span>
          </span>
          <span className="pill pill--gsp">Verifying</span>
        </li>
        <li className="vcheck">
          <span className="vcheck__icon" aria-hidden="true">
            <Icon name="doc" size={18} />
          </span>
          <span className="vcheck__text">
            <span className="vcheck__name">Business documents</span>
            <span className="vcheck__meta">
              {again ? `New ${sent.length === 1 ? 'file' : 'files'} sent ${whenLabel(join.sentAt)}` : `${sent.length} ${sent.length === 1 ? 'document' : 'documents'} sent ${whenLabel(join.sentAt)}`}
            </span>
          </span>
          <span className="pill pill--gsp">Verifying</span>
        </li>
      </ul>

      <div className="vcard__foot">
        <Button onClick={onDocs} iconRight={<Icon name="arrowRight" size={18} />}>
          View documents
        </Button>
        <p className="vcard__note">
          We’ll email {f.email}
          {whatsapp ? ' and message you on WhatsApp' : ''} when it’s done.
        </p>
      </div>
    </motion.section>
  );
}

/**
 * GSP couldn't verify one or more documents. The card is the agency's now (amber): which documents,
 * GSP's note on each, and one action to replace them and send them again.
 */
function ReturnCard({ join, onDocs, reduce }: { join: SignupState; onDocs: () => void; reduce: boolean | null }) {
  const f = join.form;
  const all = sentDocs(join);
  const back = returnedDocs(all.map((d) => d.need), join.docs);
  const left = stillToReplace(all.map((d) => d.need), join.docs);
  const ready = back.length - left.length;
  const verified = all.filter((d) => d.slot.status === 'accepted').map((d) => d.need.name);
  const one = back.length === 1;
  const steps: { title: string; note?: string; state: StepState }[] = [
    { title: 'Account created', state: 'done' },
    { title: 'Documents sent', note: whenLabel(join.sentAt), state: 'done' },
    { title: one ? 'Replace document' : 'Replace documents', state: 'back' },
    { title: 'Verification', state: 'wait' },
    { title: 'All Access', state: 'end' },
  ];
  const action = left.length === 0 ? 'Send to GSP again' : one ? 'Replace document' : 'Replace documents';

  return (
    <motion.section className="card vcard vcard--back" aria-labelledby="vcard-title" {...rise(reduce, 1)}>
      <div className="vcard__head">
        <span className="who who--you">Needs your attention</span>
        <h2 id="vcard-title" className="vcard__title">
          {one ? '1 document needs replacing' : `${back.length} documents need replacing`}
        </h2>
        <p className="vcard__text">
          GSP couldn’t verify {one ? `your ${inSentence(back[0].name)}` : `${back.length} of your documents`}. Upload{' '}
          {one ? 'a new copy' : 'new copies'}, then send {one ? 'it' : 'them'} again. GSP usually verifies within 1 working day after that.
        </p>
      </div>

      <Track steps={steps} />

      <ul className="rdocs" aria-label="Documents to replace">
        {back.map((d) => {
          const slot = join.docs[d.name];
          const isReady = !left.includes(d);
          return (
            <li key={d.name} className={`rdoc ${isReady ? 'is-ready' : ''}`}>
              <span className="vcheck__icon" aria-hidden="true">
                <Icon name="doc" size={18} />
              </span>
              <div className="rdoc__body">
                <div className="rdoc__top">
                  <span className="rdoc__text">
                    <span className="vcheck__name">{d.name}</span>
                    {slot?.file && <span className="vcheck__meta">{isReady ? `New file: ${slot.file.name}` : `You sent ${slot.file.name}`}</span>}
                  </span>
                  {isReady ? <span className="pill pill--ok">New file ready</span> : <span className="pill pill--bad">Not verified</span>}
                </div>
                {!isReady && (
                  <p className="rdoc__why">
                    <strong>Why it wasn’t verified</strong>
                    {slot?.reason}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="vcard__foot">
        <Button onClick={onDocs} iconRight={<Icon name="arrowRight" size={18} />}>
          {action}
        </Button>
        <p className="vcard__note">
          {ready > 0 && left.length > 0 ? `${ready} of ${back.length} replaced. ` : ''}
          {verified.length > 0 ? `${listOf(verified)} ${verified.length === 1 ? 'is' : 'are'} verified. ` : ''}We’ve emailed GSP’s notes to {f.email} too.
        </p>
      </div>
    </motion.section>
  );
}

const listOf = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** The moment it lands: the business is verified and everything is open. It can be put away. */
function VerifiedCard({ join, onDocs, reduce }: { join: SignupState; onDocs: () => void; reduce: boolean | null }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <motion.section className="card okcard" aria-labelledby="ok-title" {...rise(reduce, 1)}>
      <span className="okcard__mark" aria-hidden="true">
        <motion.svg viewBox="0 0 24 24" width="26" height="26">
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, ease, delay: 0.3 }}
          />
        </motion.svg>
      </span>
      <div className="okcard__body">
        <span className="who who--ok">Verified</span>
        <h2 id="ok-title" className="okcard__title">
          {join.form.biz} is verified
        </h2>
        <p className="okcard__text">
          GSP verified your business and documents {whenLabel(join.verifiedAt)}. Students, applications and earnings are open.
        </p>
        <Button variant="secondary" size="sm" onClick={onDocs}>
          View documents
        </Button>
      </div>
      <button type="button" className="icon-btn okcard__close" aria-label="Hide this message" onClick={() => setHidden(true)}>
        <Icon name="close" size={16} />
      </button>
    </motion.section>
  );
}

function StartTile({ icon, title, text, onClick }: { icon: IconName; title: string; text: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="stile" onClick={onClick}>
        <span className="stile__icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className="stile__title">{title}</span>
        <span className="stile__text">{text}</span>
        <Icon name="arrowRight" size={18} className="stile__go" />
      </button>
    </li>
  );
}

/**
 * What's pending on the agency (W24, 1 Nov): each application waiting on it, what it needs and by when, soonest first.
 */
function PendingCard({ apps, students, onOpen, go, reduce }: { apps: Application[]; students: Student[]; onOpen?: (id: string) => void; go: (k: Section) => void; reduce: boolean | null }) {
  const mine = apps.filter((a) => isOpen(a) && needsYou(a));
  if (!apps.length) return null;
  const dueOf = (a: Application) => Math.min(...a.needs.map((n) => n.due ?? Infinity), a.offer && a.status === 'conditions' ? a.offer.acceptBy : Infinity);
  const rows = mine.map((a) => ({ a, due: dueOf(a) })).sort((x, y) => x.due - y.due);
  const stu = (a: Application) => students.find((x) => x.id === a.studentId);
  return (
    <motion.section className="card side-card pend" aria-labelledby="pend-title" {...rise(reduce, 1)}>
      <div className="pend__head">
        <h2 id="pend-title" className="home__h2">
          Pending on you
        </h2>
        <Button variant="secondary" size="sm" onClick={() => go('applications')}>
          All applications
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="side-card__text">Nothing is waiting on you. GSP and the universities have the rest.</p>
      ) : (
        <ul className="pend__list">
          {rows.slice(0, 6).map(({ a, due }) => {
            const s = stu(a);
            const what = a.needs.filter((n) => !n.profile).map((n) => n.title);
            const late = Number.isFinite(due) && due < Date.now();
            return (
              <li key={a.id} className="pend__item">
                <button type="button" className="pend__open" onClick={() => (onOpen ? onOpen(a.id) : go('applications'))}>
                  <span className="pend__who">
                    {s ? fullName(s) : a.studentId} <span className="muted">· {courseOf(a).uni.name}</span>
                  </span>
                  <span className="pend__what">{what.length ? what.join(', ') : statusText(a)}</span>
                </button>
                <span className={`pend__due num ${late ? 'is-late' : ''}`}>{Number.isFinite(due) ? `${late ? 'Was due' : 'Due'} ${shortDate(new Date(due), true)}` : 'No due date'}</span>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 6 && <p className="side-card__text">and {rows.length - 6} more in Applications.</p>}
    </motion.section>
  );
}
