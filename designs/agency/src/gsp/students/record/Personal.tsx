import { phoneError } from '../../../components/validate';
import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Checkbox, Field, Switch } from '../../../components/forms';
import { CountryCombobox } from '../../../components/CountryCombobox';
import { countryByName } from '../../../data/partners';
import { citiesOf, emptyAddress, type Address, type Student } from '../../../data/students';
import { POSTCODE_MAX } from '../../../data/reference';
import { fillFromPassport, savePassport } from './read';
import { parseDate, typeDate, yearsSince } from '../../../data/dates';
import { isEmail, passportError, sameStudent } from '../form';
import { ReadBox, ReadNote, filledAt, filledText, readMs } from '../ReadBox';
import { Choice, Phone, Sel, Txt, type Update } from './fields';

const PASSPORT = 'passport';

/**
 * Personal details: the passport's details, how to reach the student, and where they live now, which decides the
 * courses they can apply to. The first time, before there's a passport or its details, uploading it fills them in;
 * after that they're edited by hand, and the passport is kept in Documents (Nesil, 29 Oct).
 */
export function Personal({ s, list, update }: { s: Student; list: Student[]; update: Update }) {
  const reduce = useReducedMotion();
  const [reading, setReading] = useState(false);
  const [otherCity, setOtherCity] = useState(false);
  const states = countryByName(s.country)?.states ?? [];
  const cities = citiesOf(s.country, s.state);
  const typedCity = otherCity || (!!s.city && !!cities && !cities.includes(s.city));
  const read = (k: string) => (s.read.includes(k) ? PASSPORT : null);
  /** Sets fields and drops their "read from a document" mark. */
  const set = (patch: Partial<Student>) => update((p) => ({ ...p, ...patch, read: p.read.filter((k) => !(k in patch)) }));
  // the same passport number on another of this RP's students (1 Nov: passport only, within one RP)
  const dup = sameStudent(s, list, s.id);
  // autofill is one-time (1 Nov): once the passport filled this in, it's corrected by hand
  const filled = filledAt(s, PASSPORT);
  const dob = parseDate(s.dob);

  const readFile = (file: File) => {
    setReading(true);
    update((p) => savePassport(p, file.name));
    window.setTimeout(() => {
      update((p) => fillFromPassport(p, file.name));
      setReading(false);
    }, readMs(reduce));
  };

  return (
    <div className="rsec">
      {reading || (!filled && !s.docs.passport && !(s.dob || s.gender)) ? (
        <ReadBox
          id="rp-file"
          title="Fill this in from the passport"
          text="Upload the photo page and we fill in anything missing here: names, passport number, date of birth, gender and expiry. It’s kept in Documents."
          button="Upload passport"
          file={s.docs.passport?.file}
          reading={reading}
          onFile={readFile}
        />
      ) : (
        filled && <ReadNote text={filledText('passport', filled)} />
      )}

      <fieldset className="rgroup">
        <legend className="rgroup__title">As on the passport</legend>
        <div className="grid2">
          <Txt id="rp-first" label="First name" required value={s.first} read={read('first')} onChange={(v) => set({ first: v })} error={s.first.trim() ? null : 'Enter the first name, as on the passport.'} />
          <div className="afs__last">
            <Txt id="rp-last" label="Last name" required={!s.oneName} value={s.oneName ? '' : s.last} disabled={s.oneName} read={read('last')} onChange={(v) => set({ last: v })} />
            <Checkbox id="rp-onename" checked={!!s.oneName} onChange={(v) => set({ oneName: v })}>
              Only one name on the passport
            </Checkbox>
          </div>
          <Field id="rp-nationality" label="Nationality" required>
            <CountryCombobox id="rp-nationality" value={s.nationality} onChange={(v) => set({ nationality: v })} />
          </Field>
          <div>
            <Txt
              id="rp-passport"
              label="Passport number"
              required
              value={s.passport}
              read={read('passport')}
              onChange={(v) => set({ passport: v.toUpperCase() })}
              error={passportError(s.passport, dup.byPassport)}
            />
          </div>
          <Txt
            id="rp-dob"
            label="Date of birth"
            required
            value={s.dob}
            read={read('dob')}
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            format={typeDate}
            onChange={(v) => set({ dob: v })}
            hint={dob ? `Age ${yearsSince(dob)}` : undefined}
            error={s.dob && !dob ? 'Enter the date as DD/MM/YYYY, like 19/05/2002.' : dob && dob.getTime() > Date.now() ? 'The date of birth can’t be in the future.' : null}
          />
        </div>
        <Choice
          id="rp-gender"
          label="Gender"
          required
          value={s.gender}
          read={read('gender')}
          onChange={(v) => set({ gender: v })}
          options={[
            ['Male', 'Male'],
            ['Female', 'Female'],
            ['Other', 'Other'],
          ]}
        />
      </fieldset>

      <fieldset className="rgroup">
        <legend className="rgroup__title">Contact</legend>
        <div className="grid2">
          <Txt
            id="rp-email"
            label="Email"
            required
            type="email"
            value={s.email}
            onChange={(v) => set({ email: v })}
            hint="Used on university applications."
            error={!s.email.trim() ? 'Enter the student’s email.' : !isEmail(s.email) ? 'Enter a full email address, like name@gmail.com.' : null}
          />
          <Phone id="rp-phone" required dial={s.dial} number={s.phone} error={phoneError(s.dial, s.phone, { required: true, what: 'student’s mobile number' })} onDial={(v) => set({ dial: v })} onNumber={(v) => set({ phone: v })} />
        </div>
      </fieldset>

      <fieldset className="rgroup">
        <legend className="rgroup__title">Present address</legend>
        <div className="grid2">
          <Field id="rp-country" label="Current country of residence" required hint={s.country === s.nationality ? 'Same as their nationality.' : undefined}>
            <CountryCombobox id="rp-country" value={s.country} describedBy={s.country === s.nationality ? 'rp-country-hint' : undefined} onChange={(v) => v !== s.country && set({ country: v, state: '', city: '' })} />
          </Field>
          {states.length > 0 ? (
            <Sel id="rp-state" label={`State or province in ${s.country}`} required value={s.state} options={states} onChange={(v) => (set({ state: v, city: '' }), setOtherCity(false))} placeholder="Choose a state or province" />
          ) : (
            <span />
          )}
          {cities && !typedCity ? (
            <Sel
              id="rp-city"
              label="City"
              required
              value={s.city}
              options={[...cities, ['__other', 'Another city…']]}
              onChange={(v) => (v === '__other' ? (setOtherCity(true), set({ city: '' })) : set({ city: v }))}
              placeholder="Choose a city"
            />
          ) : (
            <Txt
              id="rp-city"
              label="City"
              required
              value={s.city}
              onChange={(v) => set({ city: v })}
              hint={cities ? (
                <button type="button" className="btn btn--link rlink" onClick={() => (setOtherCity(false), set({ city: '' }))}>
                  Pick from the list instead
                </button>
              ) : s.state || states.length === 0 ? undefined : 'Choose the state first.'}
              disabled={states.length > 0 && !s.state}
            />
          )}
          {/* the rest of the present address (4 Nov: used for application lodgement) */}
          <Txt id="rp-addr1" label="Address line 1" required value={s.addr1 ?? ''} onChange={(v) => set({ addr1: v })} placeholder="House or flat, street" />
          <Txt id="rp-addr2" label="Address line 2" value={s.addr2 ?? ''} onChange={(v) => set({ addr2: v })} placeholder="Area or landmark (optional)" />
          <Txt id="rp-postcode" label="Postcode" required value={s.postcode ?? ''} onChange={(v) => set({ postcode: v.slice(0, POSTCODE_MAX) })} />
        </div>
      </fieldset>

      <fieldset className="rgroup">
        <legend className="rgroup__title">Permanent address</legend>
        <Switch id="rp-permsame" checked={!!s.permSame} onChange={(v) => set({ permSame: v, perm: v ? undefined : (s.perm ?? emptyAddress(s.country)) })}>
          Permanent address is the same as present
        </Switch>
        {!s.permSame && <AddressFields id="rp-perm" a={s.perm ?? emptyAddress(s.country)} onChange={(perm) => set({ perm })} />}
      </fieldset>
    </div>
  );
}

/** A full address: line 1, line 2 (optional), city, state or province (where the country has them), postcode, country. */
function AddressFields({ id, a, onChange }: { id: string; a: Address; onChange: (a: Address) => void }) {
  const states = countryByName(a.country)?.states ?? [];
  const put = (patch: Partial<Address>) => onChange({ ...a, ...patch });
  return (
    <div className="grid2">
      <Field id={`${id}-country`} label="Country" required>
        <CountryCombobox id={`${id}-country`} value={a.country} onChange={(v) => v !== a.country && put({ country: v, state: '', city: '' })} />
      </Field>
      {states.length > 0 ? <Sel id={`${id}-state`} label={`State or province in ${a.country}`} required value={a.state} options={states} onChange={(v) => put({ state: v })} placeholder="Choose a state or province" /> : <span />}
      <Txt id={`${id}-city`} label="City" required value={a.city} onChange={(v) => put({ city: v })} />
      <Txt id={`${id}-postcode`} label="Postcode" required value={a.postcode} onChange={(v) => put({ postcode: v.slice(0, POSTCODE_MAX) })} />
      <Txt id={`${id}-line1`} label="Address line 1" required value={a.line1} onChange={(v) => put({ line1: v })} placeholder="House or flat, street" />
      <Txt id={`${id}-line2`} label="Address line 2" value={a.line2} onChange={(v) => put({ line2: v })} placeholder="Area or landmark (optional)" />
    </div>
  );
}
