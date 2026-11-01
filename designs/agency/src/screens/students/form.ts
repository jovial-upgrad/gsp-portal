/** The Add a student form: the basics, what's checked, duplicates, and how a new student is made. */
import { phoneError } from '../../components/validate';
import { countryByName } from '../../data/partners';
import { emptyEdu, fullName, type Gender, type Level, type Student } from '../../data/students';

export type AddForm = {
  first: string;
  last: string;
  /** Some passports carry one name only. */
  oneName: boolean;
  nationality: string;
  /** Where the student lives now. */
  country: string;
  passport: string;
  email: string;
  dial: string;
  phone: string;
  highest: '' | Level;
  /** Whoever adds the student; an admin can reassign them later. */
  counsellor: string;
};

/** What the passport read beyond the form's fields, kept for the profile. */
export type PassportExtra = { dob: string; gender: Gender; passportExpiry: string };

export type AddState = {
  f: AddForm;
  /** Fields filled from the passport, until someone edits them. */
  auto: string[];
  file: { name: string } | null;
  extra: PassportExtra | null;
  reading: boolean;
  touched: Record<string, boolean>;
  submitted: boolean;
  attempts: number;
};

export const newForm = (nationality: string): AddForm => ({
  first: '',
  last: '',
  oneName: false,
  nationality,
  // most students live where their agency is
  country: nationality,
  passport: '',
  email: '',
  dial: countryByName(nationality)?.dial ?? '',
  phone: '',
  highest: '',
  counsellor: 'me',
});

export const newAdd = (nationality: string): AddState => ({ f: newForm(nationality), auto: [], file: null, extra: null, reading: false, touched: {}, submitted: false, attempts: 0 });

/* ---------- checks ---------- */

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
/** A passport number as it's compared and kept: no spaces, upper case (1 Nov). */
export const normPassport = (v: string) => v.replace(/\s+/g, '').toUpperCase();
const norm = normPassport;

/**
 * Someone this agency already added with the same passport number (1 Nov, with engineering: the duplicate check is
 * by passport only, and only within one RP; the same passport at another RP is allowed).
 */
export function sameStudent(f: Pick<AddForm, 'passport'>, list: Student[], except?: string) {
  const pp = norm(f.passport);
  const byPassport = pp ? list.find((s) => s.id !== except && norm(s.passport) === pp) : undefined;
  return { byPassport };
}
/** The passport number is required to add a student (1 Nov): 6 to 9 letters and digits. */
export const passportOk = (v: string) => /^[A-Z0-9]{6,9}$/i.test(norm(v));
export const passportError = (v: string, dup?: Student) =>
  !v.trim() ? 'Enter the passport number.' : !passportOk(v) ? 'A passport number is 6 to 9 letters and digits.' : dup ? `${fullName(dup)} already has this passport number.` : null;

export const FIELD_ORDER = ['first', 'last', 'nationality', 'country', 'passport', 'email', 'phone', 'highest'] as const;
export type FieldKey = (typeof FIELD_ORDER)[number];

export function validate(f: AddForm, list: Student[]) {
  const e: Partial<Record<FieldKey, string>> = {};
  if (!f.first.trim()) e.first = 'Enter the first name, as on the passport.';
  if (!f.oneName && !f.last.trim()) e.last = 'Enter the last name, or tick “Only one name on the passport”.';
  if (!f.nationality) e.nationality = 'Choose the nationality on the passport.';
  if (!f.country) e.country = 'Choose the country the student lives in now.';
  const pe = passportError(f.passport, sameStudent(f, list).byPassport);
  if (pe) e.passport = pe;
  if (!f.email.trim()) e.email = 'Enter the student’s email.';
  else if (!isEmail(f.email)) e.email = 'Enter a full email address, like name@gmail.com.';
  if (!f.phone.trim()) e.phone = 'Enter the student’s mobile number.';
  else if (phoneError(f.dial, f.phone)) e.phone = phoneError(f.dial, f.phone, { what: 'student’s mobile number' })!;
  if (!f.highest) e.highest = 'Choose the highest education the student has finished.';
  return e;
}

/** Anything typed or picked that closing would lose. */
export const isDirty = (a: AddState, nationality: string) => {
  const b = newForm(nationality);
  return !!a.file || (Object.keys(b) as (keyof AddForm)[]).some((k) => k !== 'counsellor' && a.f[k] !== b[k]);
};

let seq = 24820;
/** A new student: the basics from the form, and what the passport read; the rest of the profile is empty. */
export function makeStudent(a: AddState, me: string): Student {
  const f = a.f;
  const x = a.extra;
  return {
    id: `S-${seq++}`,
    first: f.first.trim(),
    last: f.oneName ? '' : f.last.trim(),
    oneName: f.oneName,
    nationality: f.nationality,
    email: f.email.trim(),
    dial: f.dial,
    phone: f.phone.trim(),
    passport: norm(f.passport),
    highest: f.highest || 'ug',
    gender: x?.gender ?? '',
    dob: x?.dob ?? '',
    passportExpiry: x?.passportExpiry ?? '',
    country: f.country,
    state: '',
    city: '',
    eduCountry: f.nationality,
    edu: { [f.highest || 'ug']: emptyEdu(f.nationality) },
    work: [],
    tests: [],
    visa: '',
    visaNote: '',
    disability: '',
    disabilityNote: '',
    docs: a.file ? { passport: { name: 'Passport', file: a.file.name, status: 'uploaded' } } : {},
    read: x ? ['gender', 'dob'] : [],
    // the passport read here is its one autofill (1 Nov): the record doesn't offer it again
    filled: x ? { passport: Date.now() } : undefined,
    counsellor: f.counsellor,
    added: Date.now(),
    addedBy: me,
    apps: [],
  };
}
