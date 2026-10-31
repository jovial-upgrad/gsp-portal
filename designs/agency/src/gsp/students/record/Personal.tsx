import { phoneError } from '../../../components/validate';
import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Checkbox, Field } from '../../../components/forms';
import { CountryCombobox } from '../../../components/CountryCombobox';
import { Icon } from '../../../components/Icon';
import { countryByName } from '../../../data/partners';
import { CITIES, fullName, type Student } from '../../../data/students';
import { fillFromPassport, savePassport } from './read';
import { parseDate, typeDate, yearsSince } from '../../../data/dates';
import { atOtherAgency, isEmail, passportOk, sameStudent } from '../form';
import { ReadBox, ReadNote, readMs } from '../ReadBox';
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
  const cities = CITIES[s.state];
  const typedCity = otherCity || (!!s.city && !!cities && !cities.includes(s.city));
  const read = (k: string) => (s.read.includes(k) ? PASSPORT : null);
  /** Sets fields and drops their "read from a document" mark. */
  const set = (patch: Partial<Student>) => update((p) => ({ ...p, ...patch, read: p.read.filter((k) => !(k in patch)) }));
  const dup = sameStudent(s, list, s.id);
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
      {reading || (!s.docs.passport && !(s.dob || s.gender)) ? (
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
        s.docs.passport &&
        s.read.some((k) => ['gender', 'dob', 'first', 'last', 'passport'].includes(k)) && <ReadNote text="Filled in from the passport, which is in Documents. What was read is highlighted: check it." />
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
              error={!passportOk(s.passport) ? 'A passport number is 6 to 9 letters and digits.' : dup.byPassport ? `This passport number is already on ${fullName(dup.byPassport)}.` : null}
            />
            {atOtherAgency(s.passport) && !s.consentCheck && (
              <p className="anote">
                <Icon name="info" size={16} />
                <span>This passport is on a student at another agency. GSP will ask the student which agency they want to apply with.</span>
              </p>
            )}
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
            error={!s.email.trim() ? 'Enter the student’s email.' : !isEmail(s.email) ? 'Enter a full email address, like name@gmail.com.' : dup.byEmail ? `This email is already on ${fullName(dup.byEmail)}.` : null}
          />
          <Phone id="rp-phone" required dial={s.dial} number={s.phone} error={phoneError(s.dial, s.phone, { required: true, what: 'student’s mobile number' })} onDial={(v) => set({ dial: v })} onNumber={(v) => set({ phone: v })} />
        </div>
      </fieldset>

      <fieldset className="rgroup">
        <legend className="rgroup__title">Where they live now</legend>
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
        </div>
      </fieldset>
    </div>
  );
}
