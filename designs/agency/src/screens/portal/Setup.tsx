import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Field, Form as SubmitForm, TextInput, SelectInput, Checkbox, describedBy } from '../../components/forms';
import { CountryCombobox } from '../../components/CountryCombobox';
import { CityCombobox } from '../../components/CityCombobox';
import { PhoneInput } from '../../components/PhoneInput';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { CITY_EXAMPLE, FOUND_US, countryByName } from '../../data/partners';
import { hasCityList } from '../../data/cities';
import { DETAILS_ORDER, WHATSAPP_MARKETS, validateDetails, type SignupForm as Form, type SignupState } from '../signup/model';
import { slug, useDocUploads } from '../signup/Documents';
import { DocList } from './DocList';
import { docsFor, inSentence, missingRequired, slotOf } from '../signup/docs';
import { Track, type TrackStep } from './Track';

type SetState = (fn: (s: SignupState) => SignupState) => void;
const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * Finishing registration, on Home: the account exists, nothing else opens yet. Two steps, in order: the
 * business details (everything the one-page form used to ask, with what they gave when registering already
 * in), then the business documents. A card for where they are, whose two steps work as tabs: below it shows
 * one step at a time, the documents only once the details are saved. Sending both to GSP opens course search
 * and the profile; GSP's verification opens the rest.
 */
export function Setup({ join, set, scrollTop }: { join: SignupState; set: SetState; scrollTop: () => void }) {
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const done = !!join.detailsDone;
  // the details until they're saved; after that the documents, unless the details tab is picked
  const [picked, setPicked] = useState<'details' | 'docs' | null>(null);
  const view = done ? picked ?? 'docs' : 'details';
  const docs = docsFor(join.form.country);
  const missing = missingRequired(docs, join.docs);
  const steps: TrackStep[] = [
    { title: 'Account created', state: 'done' },
    { title: 'Business details', state: done ? 'done' : 'you', onSelect: () => setPicked('details'), selected: view === 'details' },
    { title: 'Documents', state: done ? 'you' : 'wait', ...(done && { onSelect: () => setPicked('docs'), selected: view === 'docs' }) },
    { title: 'Verification', state: 'wait' },
    { title: 'Agreement', state: 'wait' },
    { title: 'All Access', state: 'end' },
  ];
  const docsHead = useRef<HTMLHeadingElement>(null);

  const saved = () => {
    setEditing(false);
    setPicked('docs');
    // the documents come next: take people there, and say so
    window.setTimeout(() => {
      docsHead.current?.focus({ preventScroll: true });
      docsHead.current?.closest('.sstep')?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }, 320);
  };

  const rise = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease, delay: 0.06 + i * 0.07 } });
  const swap = reduce ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };

  return (
    <div className="setup">
      <motion.section className="card vcard" aria-labelledby="setup-title" {...rise(0)}>
        <div className="vcard__head">
          <span className="who who--you">Pending</span>
          <h2 id="setup-title" className="vcard__title">
            Finish registering {join.form.biz}
          </h2>
          <p className="vcard__text">
            {done
              ? `Your details are saved. Upload ${missing.length === 0 ? 'nothing more: every required document is in' : `${missing.length} more ${missing.length === 1 ? 'document' : 'documents'}`}, then send them to GSP to verify.`
              : 'Add your business details.'}
          </p>
        </div>

        <Track steps={steps} controls="setup-step" />
      </motion.section>

      <motion.div id="setup-step" {...rise(1)}>
        <AnimatePresence initial={false} mode="wait">
          {view === 'details' ? (
            <motion.section key="details" className={`sstep ${done && !editing ? 'is-done' : 'is-now'}`} aria-labelledby="sstep-details" {...swap}>
              <div className="sstep__head">
                <span className="sstep__num" aria-hidden="true">
                  {done && !editing ? <Icon name="check" size={14} strokeWidth={2.6} /> : '1'}
                </span>
                <h3 id="sstep-details" className="sstep__title">
                  Business details
                </h3>
                {done && !editing && (
                  <button type="button" className="btn btn--link sstep__edit" onClick={() => setEditing(true)} aria-label="Edit business details">
                    Edit
                  </button>
                )}
              </div>
              <AnimatePresence initial={false} mode="wait">
                {!done || editing ? (
                  <motion.div key="form" {...swap}>
                    <DetailsForm s={join} set={set} onSaved={saved} again={done} />
                  </motion.div>
                ) : (
                  <motion.div key="sum" className="card scard" {...swap}>
                    <DetailsSummary s={join} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          ) : (
            <motion.section key="docs" className="sstep is-now" aria-labelledby="sstep-docs" {...swap}>
              <div className="sstep__head">
                <span className="sstep__num" aria-hidden="true">
                  2
                </span>
                <h3 id="sstep-docs" className="sstep__title" ref={docsHead} tabIndex={-1}>
                  Business documents
                </h3>
              </div>
              <div className="card scard">
                <DocsUpload s={join} set={set} scrollTop={scrollTop} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/** What they saved, in a few lines, so they can check it before the documents. */
function DetailsSummary({ s }: { s: SignupState }) {
  const f = s.form;
  const owner = f.ownerSame ? `${f.first} ${f.last}` : f.ownerName;
  return (
    <dl className="ssum">
      <div>
        <dt>Business</dt>
        <dd>
          {f.biz} · {[f.city, f.state, f.country].filter(Boolean).join(', ')}
        </dd>
      </div>
      <div>
        <dt>Contact</dt>
        <dd>
          {f.first} {f.last} · {f.email} · <span className="num">{f.dial} {f.phone}</span>
        </dd>
      </div>
      <div>
        <dt>Owner</dt>
        <dd>{f.ownerSame ? `${owner} (you)` : `${owner} · ${f.ownerEmail}`}</dd>
      </div>
      <div>
        <dt>Commission statements</dt>
        <dd>{f.cemail}</dd>
      </div>
    </dl>
  );
}

/** Every business detail the one-page form asked, now in the portal; what they gave when registering is already in. */
function DetailsForm({ s, set, onSaved, again }: { s: SignupState; set: SetState; onSaved: () => void; again: boolean }) {
  const reduce = useReducedMotion();
  const errors = useMemo(() => validateDetails(s), [s]);
  const f = s.form;
  const country = countryByName(f.country);
  const states = country?.states ?? [];

  const show = (k: keyof Form) => (s.submitted || s.touched[k] ? errors[k] ?? null : null);
  const up = (patch: Partial<Form>) => set((p) => ({ ...p, form: { ...p.form, ...patch } }));
  const touch = (k: keyof Form) => set((p) => ({ ...p, touched: { ...p.touched, [k]: true } }));
  const listed = s.submitted ? DETAILS_ORDER.filter((k) => errors[k]) : [];

  const attempt = s.submitted ? s.attempts ?? 0 : 0;
  useEffect(() => {
    if (attempt === 0) return;
    const first = DETAILS_ORDER.find((k) => errors[k]);
    const el = first ? document.getElementById(`su-${first}`) : null;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [attempt]); // only on a new attempt, with that attempt's errors

  const save = () => {
    if (Object.keys(errors).length) {
      set((p) => ({ ...p, submitted: true, attempts: (p.attempts ?? 0) + 1 }));
      return;
    }
    set((p) => ({ ...p, detailsDone: true, submitted: false, attempts: 0 }));
    onSaved();
  };

  const whatsapp = WHATSAPP_MARKETS.includes(f.country);
  const fade = reduce ? {} : { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };

  return (
    <SubmitForm className="signup__form setup__form" onSubmit={save}>
      <p className="setup__req">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required. What you gave when you registered is already in.
      </p>
      <p className="vh" role="status">
        {listed.length > 0 ? `${listed.length} ${listed.length === 1 ? 'field needs' : 'fields need'} attention.` : ''}
      </p>

      <div className="card scard">
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
      </div>

      <div className="card scard">
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
                up({ country: name, state: '', city: '', dial: c?.dial ?? f.dial, ownerDial: c?.dial ?? f.ownerDial });
              }}
            />
          </Field>
          <div className="grid2">
            {states.length > 0 ? (
              <Field id="su-state" label="State or province" required error={show('state')}>
                <SelectInput
                  id="su-state"
                  value={f.state}
                  placeholder="Choose"
                  invalid={!!show('state')}
                  aria-describedby={describedBy('su-state', show('state'))}
                  onChange={(e) => e.target.value !== f.state && up({ state: e.target.value, city: '' })}
                  onBlur={() => touch('state')}
                >
                  {states.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            ) : null /* territories with no states or provinces: nothing to ask */}
            <Field id="su-city" required label="City" error={show('city')}>
              {/* 4 Nov (Nesil): a list to search and pick from, for the country and state; a city that isn't listed can be typed */}
              {hasCityList(f.country) ? (
                <CityCombobox
                  id="su-city"
                  country={f.country}
                  state={f.state}
                  value={f.city}
                  invalid={!!show('city')}
                  describedBy={describedBy('su-city', show('city'))}
                  onChange={(city, state) => up(state ? { city, state } : { city })}
                  onBlur={() => touch('city')}
                />
              ) : (
                <TextInput
                  id="su-city"
                  autoComplete="address-level2"
                  placeholder={`e.g. ${CITY_EXAMPLE[f.country] ?? 'your city'}`}
                  value={f.city}
                  invalid={!!show('city')}
                  aria-describedby={describedBy('su-city', show('city'))}
                  onChange={(e) => up({ city: e.target.value })}
                  onBlur={() => touch('city')}
                />
              )}
            </Field>
          </div>
        </fieldset>
      </div>

      <div className="card scard">
        <fieldset className="fs">
          <legend className="fs__legend">How we reach you</legend>
          <Field id="su-email" label="Business email" success="Verified. You sign in with it, and partner updates come here.">
            <TextInput id="su-email" type="email" value={f.email} readOnly valid aria-describedby="su-email-hint" />
          </Field>
          <Field
            id="su-phone"
            required
            label="Mobile number"
            hint={whatsapp ? 'We send application updates and your daily task list on WhatsApp to this number.' : 'Your GSP contact calls you on this number.'}
            error={show('phone')}
          >
            <PhoneInput
              id="su-phone"
              dial={f.dial}
              number={f.phone}
              invalid={!!show('phone')}
              describedBy={describedBy('su-phone', show('phone'), true)}
              onDial={(dial) => up({ dial })}
              onNumber={(phone) => up({ phone })}
              onBlur={() => touch('phone')}
            />
          </Field>
          <Checkbox id="su-owner-same" checked={f.ownerSame} onChange={(v) => up({ ownerSame: v })}>
            The owner’s contact details are the same as mine
          </Checkbox>
          <AnimatePresence initial={false}>
            {!f.ownerSame && (
              <motion.div key="owner" className="owner" {...fade} transition={{ duration: 0.2 }}>
                <Field id="su-ownerName" required label="Owner’s full name" error={show('ownerName')}>
                  <TextInput
                    id="su-ownerName"
                    value={f.ownerName}
                    invalid={!!show('ownerName')}
                    aria-describedby={describedBy('su-ownerName', show('ownerName'))}
                    onChange={(e) => up({ ownerName: e.target.value })}
                    onBlur={() => touch('ownerName')}
                  />
                </Field>
                <div className="grid2">
                  <Field id="su-ownerEmail" required label="Owner’s email" error={show('ownerEmail')}>
                    <TextInput
                      id="su-ownerEmail"
                      type="email"
                      inputMode="email"
                      value={f.ownerEmail}
                      invalid={!!show('ownerEmail')}
                      aria-describedby={describedBy('su-ownerEmail', show('ownerEmail'))}
                      onChange={(e) => up({ ownerEmail: e.target.value })}
                      onBlur={() => touch('ownerEmail')}
                    />
                  </Field>
                  <Field id="su-ownerPhone" required label="Owner’s mobile" error={show('ownerPhone')}>
                    <PhoneInput
                      id="su-ownerPhone"
                      dial={f.ownerDial}
                      number={f.ownerPhone}
                      invalid={!!show('ownerPhone')}
                      describedBy={describedBy('su-ownerPhone', show('ownerPhone'))}
                      onDial={(ownerDial) => up({ ownerDial })}
                      onNumber={(ownerPhone) => up({ ownerPhone })}
                      onBlur={() => touch('ownerPhone')}
                    />
                  </Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </fieldset>

        <fieldset className="fs">
          <legend className="fs__legend">Commission</legend>
          <Field id="su-cemail" required label="Commissions email" hint="Commission statements and payment receipts go here. Often your accounts team." error={show('cemail')}>
            <TextInput
              id="su-cemail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="accounts@youragency.com"
              value={f.cemail}
              invalid={!!show('cemail')}
              aria-describedby={describedBy('su-cemail', show('cemail'), true)}
              onChange={(e) => up({ cemail: e.target.value })}
              onBlur={() => touch('cemail')}
              trailing={
                !f.cemail && f.email ? (
                  <button type="button" className="inline-action" onClick={() => up({ cemail: f.email.trim() })}>
                    Use my email
                  </button>
                ) : undefined
              }
            />
          </Field>
        </fieldset>
      </div>

      <div className="card scard">
        <fieldset className="fs">
          <legend className="fs__legend">One more thing</legend>
          {/* 4 Nov (Nesil): no referral code; the state and city decide the GSP Recruitment contact */}
          <div className="grid2">
            <Field id="su-src" label="How did you find us?">
              <SelectInput id="su-src" value={f.src} placeholder="Choose one" allowEmpty onChange={(e) => up({ src: e.target.value })}>
                {FOUND_US.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </fieldset>
      </div>

      <div className="setup__save">
        <Button type="submit" iconRight={<Icon name="arrowRight" size={18} />}>
          {again ? 'Save changes' : 'Save and continue'}
        </Button>
        {again && <span className="setup__save-note">Your documents stay as they are.</span>}
      </div>
    </SubmitForm>
  );
}

/**
 * The business documents for the agency's country. Every required one must be in before they go to GSP;
 * optional ones never hold anyone up. Sending them is the end of registering.
 */
function DocsUpload({ s, set, scrollTop }: { s: SignupState; set: SetState; scrollTop: () => void }) {
  const reduce = useReducedMotion();
  const docs = docsFor(s.form.country);
  const sending = s.stage === 'sending';
  const { onFile, clear } = useDocUploads(set);
  const missing = missingRequired(docs, s.docs);
  const uploading = docs.some((d) => slotOf(s.docs, d.name).status === 'uploading');
  const tried = (s.docsTried ?? 0) > 0;
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const send = () => {
    if (sending) return;
    if (uploading || missing.length) {
      set((p) => ({ ...p, docsTried: (p.docsTried ?? 0) + 1 }));
      const first = missing[0];
      const el = first ? document.getElementById(`doc-${slug(first.name)}`) : null;
      el?.focus({ preventScroll: true });
      el?.closest('.ldoc')?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    set((p) => ({ ...p, stage: 'sending' }));
    timer.current = window.setTimeout(() => {
      set((p) => ({
        ...p,
        stage: 'sent',
        docsTried: 0,
        rounds: 1,
        sentAt: Date.now(),
        docs: Object.fromEntries(Object.entries(p.docs).map(([k, v]) => [k, v.status === 'uploaded' ? { ...v, status: 'checking' as const, reason: undefined } : v])),
      }));
      scrollTop();
    }, 1000);
  };

  const countText = uploading
    ? 'Wait for the uploads to finish.'
    : missing.length === 0
      ? 'All required documents are in. Send them to GSP.'
      : `Upload your ${missing.map((d) => inSentence(d.name)).join(' and ')} to send your documents to GSP.`;

  return (
    <div className="setup__docs">
      <DocList docs={docs} slots={s.docs} tried={tried} missing={missing} locked={sending} onFile={onFile} onClear={clear} />
      <div className="docs__send">
        {/* 4 Nov (Nesil): no line above the button; the list says what's missing, and screen readers hear this */}
        <p className="vh" role="status">
          {countText}
        </p>
        <Button block loading={sending} onClick={send} iconRight={<Icon name="arrowRight" size={18} />}>
          {sending ? 'Sending to GSP…' : 'Send to GSP for verification'}
        </Button>
        <p className="setup__save-note">Course search and your profile open as soon as they’re sent.</p>
      </div>
    </div>
  );
}
