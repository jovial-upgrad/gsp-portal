/** The Add a student form: the basics, what's checked, duplicates, and how a new student is made. */
import { countryByName } from '../../data/partners';
import { OTHER_AGENCY_PASSPORTS, emptyEdu, type Gender, type Level, type Student } from '../../data/students';

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
  /** The recruitment partner the student is with (30 Oct): GSP adds students for them. Required to add one. */
  rp?: string;
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

export const newForm = (nationality: string, rp = ''): AddForm => ({
  first: '',
  last: '',
  oneName: false,
  nationality,
  // most students live where their agency is
  country: nationality,
  passport: '',
  email: '',
  dial: countryByName(nationality)?.dial ?? '+91',
  phone: '',
  highest: '',
  counsellor: 'me',
  rp,
});

export const newAdd = (nationality: string, rp = ''): AddState => ({ f: newForm(nationality, rp), auto: [], file: null, extra: null, reading: false, touched: {}, submitted: false, attempts: 0 });

/* ---------- checks ---------- */

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const norm = (v: string) => v.replace(/\s+/g, '').toUpperCase();

/** Someone this agency already added, with the same email or passport. */
export function sameStudent(f: Pick<AddForm, 'email' | 'passport'>, list: Student[], except?: string) {
  const email = f.email.trim().toLowerCase();
  const pp = norm(f.passport);
  const others = list.filter((s) => s.id !== except);
  const byEmail = email ? others.find((s) => s.email.toLowerCase() === email) : undefined;
  const byPassport = pp ? others.find((s) => norm(s.passport) === pp) : undefined;
  return { byEmail, byPassport };
}
export const atOtherAgency = (passport: string) => !!passport && OTHER_AGENCY_PASSPORTS.includes(norm(passport));
export const passportOk = (v: string) => !v.trim() || /^[A-Z0-9]{6,9}$/i.test(norm(v));

export const FIELD_ORDER = ['rp', 'first', 'last', 'nationality', 'country', 'passport', 'email', 'phone', 'highest'] as const;
export type FieldKey = (typeof FIELD_ORDER)[number];

export function validate(f: AddForm, list: Student[]) {
  const e: Partial<Record<FieldKey, string>> = {};
  if (!f.rp) e.rp = 'Choose the recruitment partner the student is with.';
  if (!f.first.trim()) e.first = 'Enter the first name, as on the passport.';
  if (!f.oneName && !f.last.trim()) e.last = 'Enter the last name, or tick “Only one name on the passport”.';
  if (!f.nationality) e.nationality = 'Choose the nationality on the passport.';
  if (!f.country) e.country = 'Choose the country the student lives in now.';
  const { byEmail, byPassport } = sameStudent(f, list);
  if (!passportOk(f.passport)) e.passport = 'A passport number is 6 to 9 letters and digits.';
  else if (byPassport) e.passport = 'This passport number is already on one of your students.';
  if (!f.email.trim()) e.email = 'Enter the student’s email.';
  else if (!isEmail(f.email)) e.email = 'Enter a full email address, like name@gmail.com.';
  else if (byEmail) e.email = 'This email is already on one of your students.';
  if (!f.phone.trim()) e.phone = 'Enter the student’s mobile number.';
  else if (f.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter the full mobile number.';
  if (!f.highest) e.highest = 'Choose the highest education the student has finished.';
  return e;
}

/** Anything typed or picked that closing would lose. */
export const isDirty = (a: AddState, nationality: string) => {
  const b = newForm(nationality);
  return !!a.file || (Object.keys(b) as (keyof AddForm)[]).some((k) => k !== 'counsellor' && k !== 'rp' && a.f[k] !== b[k]);
};

let seq = 24820;
/** A new student: the basics from the form, and what the passport read; the rest of the profile is empty. */
export function makeStudent(a: AddState, me: string): Student {
  const f = a.f;
  const x = a.extra;
  return {
    id: `S-${seq++}`,
    rp: f.rp,
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
    read: x ? ['gender', 'dob', 'passportExpiry'] : [],
    counsellor: f.counsellor,
    added: Date.now(),
    addedBy: me,
    apps: [],
    consentCheck: atOtherAgency(f.passport) || undefined,
  };
}
