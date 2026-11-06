import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { ContactCard } from '../../components/ContactCard';
import { Icon } from '../../components/Icon';
import { countryByName, partnerManagerFor, type Contact } from '../../data/partners';
import type { Account } from '../signin/model';
import type { Application } from '../../data/applications';
import type { Student } from '../../data/students';
import { Setup } from './Setup';
import { WHATSAPP_MARKETS, type SignupForm, type SignupState } from '../signup/model';
import { inSentence, returnedDocs, stillToReplace } from '../signup/docs';
import { agreementOf, expectedBy, phaseOf, sentDocs, whenLabel, type Access, type Section } from './model';
import { Track, type StepState } from './Track';
import { AgreementCard, DoneStrip, dayText } from './Agreement';
import { Summary } from './Summary';

const ease = [0.2, 0.8, 0.2, 1] as const;
const rise = (reduce: boolean | null, i: number) =>
  reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease, delay: 0.06 + i * 0.07 } };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/**
 * Home, in every state (4 Nov): finishing registering; GSP verifying (no "Opens after verification" tiles any more);
 * the business verified, as a small strip, with the partner agreement under it (and nothing else); and only once the
 * agreement is accepted (or for an established partner), a summary of what matters now.
 */
export function Home({
  acc,
  join,
  access,
  manager,
  onDocs,
  onProfileDocs,
  onAgreementPreview,
  go,
  set,
  scrollTop,
  startKey,
  apps,
  students,
  onOpenApp,
}: {
  acc: Account;
  join: SignupState | null;
  access: Access;
  manager: Contact | null;
  onDocs: () => void;
  /** Profile's Documents tab: the documents and the agreement, once verified. */
  onProfileDocs: () => void;
  onAgreementPreview: () => void;
  go: (k: Section) => void;
  /** Updates the registration while the partner finishes it here. */
  set?: (fn: (s: SignupState) => SignupState) => void;
  scrollTop: () => void;
  /** Changes when a review state is picked, so registering starts again from that state. */
  startKey?: string;
  apps: Application[];
  students: Student[];
  onOpenApp: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const setup = access === 'setup' && join && set ? join : null;
  const verifying = access === 'verifying' && join;
  const phase = phaseOf(join);
  const agreement = agreementOf(join);
  const signing = !!join && access === 'all' && agreement !== 'accepted';

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
              <motion.section className="card ccard" aria-labelledby="courses-title" {...rise(reduce, 2)}>
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
          ) : signing && join && set ? (
            <>
              {/* 4 Nov: the business verified, as a strip; the agreement under it */}
              <DoneStrip
                title={`${join.form.biz} is verified`}
                text={`GSP verified your business and documents ${whenLabel(join.verifiedAt)}. Students and applications are open.`}
                action="View documents"
                onAction={onProfileDocs}
              />
              <AgreementCard join={join} set={set} onPreview={onAgreementPreview} />
            </>
          ) : (
            <>
              {join?.agreement?.acceptedAt && (
                <DoneStrip
                  title="Your partner agreement is accepted"
                  text={`Signed on ${dayText(join.agreement.signedOn)}, accepted ${whenLabel(join.agreement.acceptedAt)}. Every page is open now, Earnings too.`}
                  action="View documents"
                  onAction={onProfileDocs}
                />
              )}
              <Summary apps={apps} students={students} go={go} onOpenApp={onOpenApp} />
            </>
          )}
        </div>

        <motion.aside className="home__side" aria-label="Help" {...rise(reduce, 2)}>
          <section className="card side-card" aria-labelledby="contact-title">
            <h2 id="contact-title" className="side-card__title">
              Your GSP contact
            </h2>
            {setup ? (
              <AssignContact form={setup.form} detailsOpen={!setup.detailsDone} />
            ) : manager ? (
              <ContactCard person={{ ...manager, role: 'GSP Recruitment contact' }} hours="Mon–Sat, 9:30 am to 6:30 pm" />
            ) : (
              <p className="side-card__text">Your GSP Recruitment contact will be in touch within 1 working day. Their name and number will show here.</p>
            )}
          </section>
          {/* 4 Nov (Nesil): no "Latest from universities" here; announcements stay at the top right */}
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
    { title: 'Agreement', state: 'wait' },
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
    { title: 'Agreement', state: 'wait' },
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


const FACES = ['AR', 'SK', 'RM', 'AS', 'MP', 'SS', 'RA', 'DP'];

/**
 * The GSP contact while registering (Nesil, 4 Nov): "Add your state and city: they decide your GSP Recruitment
 * contact, who helps you get started." Once both are in (and they've stopped typing), GSP is seen assigning someone,
 * faces trying each other on, then the contact lands with a check. A change of state or city assigns again.
 */
function AssignContact({ form, detailsOpen }: { form: SignupForm; detailsOpen: boolean }) {
  const reduce = useReducedMotion();
  const states = countryByName(form.country)?.states ?? [];
  const ready = form.city.trim().length >= 2 && (states.length === 0 || !!form.state);
  const key = ready ? `${form.country}|${form.state}|${form.city.trim().toLowerCase()}` : '';
  // what's on screen: the contact for `shown`, or the assigning moment while `busy`
  const [shown, setShown] = useState(key);
  const [busy, setBusy] = useState(false);
  const [face, setFace] = useState(0);
  useEffect(() => {
    if (!key) {
      setBusy(false);
      setShown('');
      return;
    }
    if (key === shown && !busy) return;
    const wait = window.setTimeout(() => setBusy(true), 700); // they've stopped typing
    const done = window.setTimeout(() => (setShown(key), setBusy(false)), 700 + (reduce ? 400 : 2200));
    return () => (window.clearTimeout(wait), window.clearTimeout(done));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!busy || reduce) return;
    const t = window.setInterval(() => setFace((f) => (f + 1) % FACES.length), 240);
    return () => window.clearInterval(t);
  }, [busy, reduce]);
  const person = shown ? partnerManagerFor(form.country, form.city, '', form.state) : null;
  const where = [form.city.trim(), form.state].filter(Boolean).join(', ');
  const focusPlace = () => {
    const el = document.getElementById(states.length && !form.state ? 'su-state' : 'su-city');
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="cassign" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {busy ? (
          <motion.div key="busy" className="cassign__busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <span className="cassign__ring" aria-hidden="true">
              <span className="cassign__seat">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={face}
                  className="cassign__face"
                  initial={reduce ? false : { opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                >
                  {FACES[face]}
                </motion.span>
              </AnimatePresence>
              </span>
            </span>
            <p className="cempty__title">Assigning your GSP Recruitment contact…</p>
            <p className="side-card__text">Matching {where} to GSP’s recruitment team.</p>
            <span className="cassign__bar" aria-hidden="true">
              <span />
            </span>
          </motion.div>
        ) : person ? (
          <motion.div
            key={`p-${shown}`}
            className="cassign__done"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.32, ease }}
          >
            <span className="pill pill--ok cassign__pill">
              <Icon name="check" size={13} strokeWidth={2.6} /> Assigned to {form.biz || 'you'}
            </span>
            <ContactCard person={{ ...person, role: 'GSP Recruitment contact' }} hours="Mon–Sat, 9:30 am to 6:30 pm" />
          </motion.div>
        ) : (
          <motion.div key="ask" className="cempty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <span className="cempty__art" aria-hidden="true">
              <Icon name="user" size={24} />
              <span className="cempty__badge">
                <Icon name="pin" size={13} />
              </span>
            </span>
            <p className="cempty__title">Add your state and city</p>
            <p className="side-card__text">They decide your GSP Recruitment contact, who helps you get started.</p>
            {detailsOpen && (
              <button type="button" className="btn btn--link cassign__add" onClick={focusPlace}>
                Add them
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
