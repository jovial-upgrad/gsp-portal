import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Checkbox, Field, Form, SelectInput, TextInput, describedBy } from '../../components/forms';
import { CountryCombobox } from '../../components/CountryCombobox';
import { PhoneInput } from '../../components/PhoneInput';
import { countryByName } from '../../data/partners';
import { readPassport, type Member, type Student } from '../../data/students';
import { SelectMenu } from '../../components/SelectMenu';
import { HIGHEST_EDUCATION, levelOfEd, type HighestEducation } from '../../data/education';
import { FIELD_ORDER, isDirty, makeStudent, newAdd, sameStudent, validate, type AddForm, type AddState, type FieldKey } from './form';
import { ReadBox, readMs } from './ReadBox';
import { addedLabel } from './parts';
import { AddDocs, fileError, type BulkFile, type Failed } from './AddDocs';
import { classify, fileInto } from './record/sort';
import { RPS, rpLabel, rpOf } from '../rps';
import { rpTeam } from '../../data/rpteam';

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * Add a student, in a dialog in the middle of the window that can expand to fill it (as Add an application does):
 * the basics, then documents. Names, nationality and passport number can be read from the passport; the country
 * they live in, email, phone and the highest education finished come from the counsellor. Documents are optional
 * here: a bulk upload (the only place to upload in bulk) sorts them into the profile's folders; or they're added one
 * by one from the profile afterwards. The student is yours, whoever adds them; an admin can reassign them later.
 */
export function AddStudentSheet({
  open,
  onClose,
  list,
  team,
  me,
  nationality,
  seed,
  onAdded,
  onOpenStudent,
  forApplication = false,
  rp = '',
}: {
  open: boolean;
  onClose: () => void;
  list: Student[];
  team: Member[];
  me: string;
  /** The agency's country: where most of its students are from. */
  nationality: string;
  /** A review state can open the form part-filled. */
  seed?: AddState;
  onAdded: (s: Student) => void;
  onOpenStudent: (s: Student) => void;
  /** Opened from Add an application: adding the student goes back to the application, and a duplicate can be picked. */
  forApplication?: boolean;
  /** The recruitment partner already picked (in Add an application), to start with. */
  rp?: string;
}) {
  const reduce = useReducedMotion();
  const [a, setA] = useState<AddState>(() => seed ?? newAdd(nationality, rp));
  const [confirm, setConfirm] = useState(false);
  // documents, optionally, all at once (sorted into the profile's folders); or one by one from the profile later
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [failed, setFailed] = useState<Failed[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const keepRef = useRef<HTMLButtonElement>(null);
  const f = a.f;
  // duplicates are checked within the chosen RP only (1 Nov): the same passport at another RP is allowed
  const mine = useMemo(() => (f.rp ? list.filter((x) => rpOf(x) === f.rp) : []), [list, f.rp]);
  const errors = useMemo(() => validate(f, mine), [f, mine]);
  // the duplicate check: same passport number, this agency only (1 Nov); it blocks, and says who straight away
  const dup = sameStudent(f, mine);

  const show = (k: FieldKey) => (a.submitted || a.touched[k] || (k === 'passport' && dup.byPassport) ? errors[k] ?? null : null);
  const touch = (k: FieldKey) => setA((p) => ({ ...p, touched: { ...p.touched, [k]: true } }));
  const up = (patch: Partial<AddForm>) => setA((p) => ({ ...p, f: { ...p.f, ...patch }, auto: p.auto.filter((k) => !(k in patch)) }));
  const isAuto = (k: keyof AddForm) => a.auto.includes(k);
  const autoHint = (k: keyof AddForm) => (isAuto(k) ? 'From the passport. Check it.' : undefined);

  // a failed submit takes people to the first field to fix
  useEffect(() => {
    if (!a.attempts) return;
    const k = FIELD_ORDER.find((x) => errors[x]);
    const el = k ? document.getElementById(`as-${k}`) : null;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [a.attempts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (confirm) keepRef.current?.focus();
  }, [confirm]);

  /* ---------- the passport ---------- */
  const readFile = (file: File) => {
    setA((p) => ({ ...p, reading: true, file: { name: file.name } }));
    window.setTimeout(() => {
      const r = readPassport(file.name);
      setA((p) => {
        // what was typed stays; the rest comes from the passport
        const fill: Partial<AddForm> = {};
        if (!p.f.first) fill.first = r.first;
        if (!p.f.last && !p.f.oneName) fill.last = r.last;
        if (!p.f.passport) fill.passport = r.passport;
        if (p.f.nationality !== r.nationality) Object.assign(fill, { nationality: r.nationality, dial: countryByName(r.nationality)?.dial ?? p.f.dial });
        const read = [...Object.keys(fill).filter((k) => k !== 'dial'), ...(p.f.nationality === r.nationality ? ['nationality'] : [])];
        return { ...p, reading: false, f: { ...p.f, ...fill }, extra: { dob: r.dob, gender: r.gender, passportExpiry: r.passportExpiry }, auto: [...new Set([...p.auto, ...read])] };
      });
    }, readMs(reduce));
  };
  const removeFile = () =>
    setA((p) => ({
      ...p,
      file: null,
      extra: null,
      f: { ...p.f, ...Object.fromEntries(p.auto.filter((k) => k !== 'nationality').map((k) => [k, ''])) },
      auto: [],
    }));

  /* ---------- documents, all at once ---------- */
  const addFiles = (list: File[]) => {
    const good = list.filter((x) => !fileError(x) && !files.some((y) => y.name === x.name));
    setFailed((l) => [...l.filter((x) => !list.some((y) => y.name === x.name)), ...list.filter((x) => fileError(x)).map((x) => ({ name: x.name, error: fileError(x) }))]);
    setFiles((l) => [...l, ...good.map((x) => ({ name: x.name, sorting: true }))]);
    // one after another, so it reads as working through the pile
    good.forEach((x, i) =>
      timers.current.push(window.setTimeout(() => setFiles((l) => l.map((y) => (y.name === x.name ? { ...y, sorting: false } : y))), (reduce ? 0 : 300 * i) + readMs(reduce))),
    );
    // the passport, when the form hasn't read one: read into the form above too
    const pass = good.find((x) => classify(x.name, f.highest || 'pg').t === 'passport');
    if (pass && !a.file && !a.reading) readFile(pass);
  };
  const removeBulk = (name: string) => {
    setFiles((l) => l.filter((x) => x.name !== name));
    setFailed((l) => l.filter((x) => x.name !== name));
    if (a.file?.name === name) removeFile();
  };
  const sorting = files.some((x) => x.sorting);

  /* ---------- closing and adding ---------- */
  const requestClose = () => {
    if (confirm) setConfirm(false);
    else if (isDirty(a, nationality) || files.length) setConfirm(true);
    else onClose();
  };
  const submit = () => {
    if (a.reading || sorting) return;
    if (Object.keys(errors).length) {
      setA((p) => ({ ...p, submitted: true, attempts: p.attempts + 1 }));
      return;
    }
    // the passport read into the form is saved with the student; the rest go to their folders
    const s = makeStudent(a, me);
    onAdded(fileInto(s, files.map((x) => x.name), a.file?.name));
  };
  const listed = a.submitted ? FIELD_ORDER.filter((k) => errors[k]) : [];
  const fade = reduce ? {} : { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.2, ease } };

  const footer = confirm ? (
    <div className="asf asf--confirm" role="alertdialog" aria-labelledby="asf-q" aria-describedby="asf-d">
      <div>
        <p id="asf-q" className="asf__q">
          Discard this student?
        </p>
        <p id="asf-d" className="asf__note">
          What you’ve entered will be lost.
        </p>
      </div>
      <div className="asf__acts">
        <Button variant="secondary" ref={keepRef} onClick={() => setConfirm(false)}>
          Keep editing
        </Button>
        <Button className="btn--danger" onClick={onClose}>
          Discard
        </Button>
      </div>
    </div>
  ) : (
    <div className="asf asf--end">
      <div className="asf__acts">
        <Button variant="secondary" onClick={requestClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={a.reading || sorting}>
          {forApplication ? 'Add and continue' : 'Add student'}
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onClose={requestClose} center expandable title="Add a student" footer={footer}>
      <Form id="add-student" className="asheet" onSubmit={submit}>
        <p className="vh" role="status">
          {listed.length > 0 ? `${listed.length} ${listed.length === 1 ? 'field needs' : 'fields need'} attention.` : ''}
        </p>

        {/* GSP adds students for a recruitment partner (30 Oct): whose is first */}
        <Field id="as-rp" required label="Recruitment partner" error={show('rp')}>
          <SelectInput id="as-rp" value={f.rp ?? ''} placeholder="Choose the recruitment partner" invalid={!!show('rp')} onChange={(e) => (up({ rp: e.target.value }), touch('rp'))}>
            {RPS.map((r) => (
              <option key={r.name} value={r.name}>
                {rpLabel(r)}
              </option>
            ))}
          </SelectInput>
        </Field>

        <ReadBox
          id="as-file"
          title="Autofill from the passport"
          text="Upload the photo page and we fill in the name, nationality and passport number. Date of birth, gender and expiry go to the profile."
          button="Upload passport"
          file={a.file?.name}
          reading={a.reading}
          readTitle="Details read from the passport"
          readText="Check the highlighted fields before you add the student."
          savedAs="saved as their passport"
          onFile={readFile}
          onRemove={removeFile}
        />

        <div className="grid2">
          <Field id="as-first" required label="First name" error={show('first')} hint={autoHint('first')}>
            <TextInput
              id="as-first"
              autoComplete="off"
              value={f.first}
              className={isAuto('first') ? 'is-auto' : ''}
              invalid={!!show('first')}
              aria-describedby={describedBy('as-first', show('first'), autoHint('first'))}
              onChange={(e) => up({ first: e.target.value })}
              onBlur={() => touch('first')}
            />
          </Field>
          <div className="afs__last">
            <Field id="as-last" required={!f.oneName} label="Last name" error={show('last')} hint={autoHint('last')}>
              <TextInput
                id="as-last"
                autoComplete="off"
                value={f.oneName ? '' : f.last}
                disabled={f.oneName}
                className={isAuto('last') ? 'is-auto' : ''}
                invalid={!!show('last')}
                aria-describedby={describedBy('as-last', show('last'), autoHint('last'))}
                onChange={(e) => up({ last: e.target.value })}
                onBlur={() => touch('last')}
              />
            </Field>
            <Checkbox id="as-onename" checked={f.oneName} onChange={(v) => up({ oneName: v })}>
              Only one name on the passport
            </Checkbox>
          </div>
          <Field id="as-nationality" required label="Nationality" error={show('nationality')} hint={autoHint('nationality')}>
            <CountryCombobox
              id="as-nationality"
              value={f.nationality}
              invalid={!!show('nationality')}
              describedBy={describedBy('as-nationality', show('nationality'), autoHint('nationality'))}
              onChange={(name) => name !== f.nationality && up({ nationality: name, dial: countryByName(name)?.dial ?? f.dial })}
            />
          </Field>
          <Field id="as-country" required label="Current country of residence" hint="Where the student lives now." error={show('country')}>
            <CountryCombobox
              id="as-country"
              value={f.country}
              invalid={!!show('country')}
              describedBy={describedBy('as-country', show('country'), true)}
              onChange={(name) => name !== f.country && up({ country: name })}
            />
          </Field>
          <div>
            <Field id="as-passport" required label="Passport number" error={show('passport')} hint={autoHint('passport')}>
              <TextInput
                id="as-passport"
                autoComplete="off"
                value={f.passport}
                className={isAuto('passport') ? 'is-auto' : ''}
                invalid={!!show('passport')}
                aria-describedby={describedBy('as-passport', show('passport'), autoHint('passport'))}
                onChange={(e) => up({ passport: e.target.value.toUpperCase() })}
                onBlur={() => touch('passport')}
              />
            </Field>
            <AnimatePresence initial={false}>
              {dup.byPassport && <Dupe key="dp" s={dup.byPassport} team={team} onOpen={onOpenStudent} fade={fade} pick={forApplication} />}
            </AnimatePresence>
          </div>
          <Field id="as-email" required label="Email" hint="Used on university applications. GSP never sends students marketing." error={show('email')}>
              <TextInput
                id="as-email"
                type="email"
                autoComplete="off"
                value={f.email}
                invalid={!!show('email')}
                aria-describedby={describedBy('as-email', show('email'), true)}
                onChange={(e) => up({ email: e.target.value })}
                onBlur={() => touch('email')}
              />
            </Field>
          <Field id="as-phone" required label="Phone number" error={show('phone')}>
            <PhoneInput
              id="as-phone"
              dial={f.dial}
              number={f.phone}
              invalid={!!show('phone')}
              describedBy={describedBy('as-phone', show('phone'))}
              onDial={(v) => up({ dial: v })}
              onNumber={(v) => up({ phone: v })}
              onBlur={() => touch('phone')}
            />
          </Field>
          <Field id="as-highest" required label="Highest education" error={show('highest')}>
            {/* the one list (S3C-1), in the level check's order; the record's education level follows from it */}
            <SelectMenu
              id="as-highest"
              label="Highest education"
              value={f.highestEd ?? ''}
              placeholder="Choose"
              invalid={!!show('highest')}
              describedBy={describedBy('as-highest', show('highest'))}
              options={HIGHEST_EDUCATION.map((x) => ({ value: x, label: x }))}
              onChange={(v) => (up({ highestEd: v as HighestEducation, highest: levelOfEd(v) }), touch('highest'))}
            />
          </Field>
          {/* GSP adds for an RP (W12): the student goes to the RP's counsellor, whom the RP can change */}
          <Field id="as-counsellor" label="Counsellor" hint="The RP’s counsellor. The RP can reassign the student.">
            <TextInput id="as-counsellor" value={f.rp ? (rpTeam(f.rp).find((m) => m.role === 'Counsellor') ?? rpTeam(f.rp)[0])?.name ?? f.rp : 'Choose the recruitment partner first'} readOnly aria-describedby="as-counsellor-hint" />
          </Field>
        </div>

        <AddDocs first={f.first} highest={f.highest} files={files} failed={failed} passport={a.file?.name} onFiles={addFiles} onRemove={removeBulk} />

        {/* Enter in a field adds the student */}
        <button type="submit" className="vh" tabIndex={-1} aria-hidden="true">
          Add student
        </button>
      </Form>
    </Sheet>
  );
}

/** The student who already has this passport number (the field's error names them): when and with whom, and a way to open them instead. */
function Dupe({ s, team, onOpen, fade, pick = false }: { s: Student; team: Member[]; onOpen: (s: Student) => void; fade: object; pick?: boolean }) {
  const who = team.find((m) => m.id === s.counsellor)?.name;
  return (
    <motion.div className="dupe" {...fade}>
      <p className="dupe__meta">
        {addedLabel(s.added)}
        {who ? ` · with ${who}` : ''}
      </p>
      <Button variant="secondary" size="sm" onClick={() => onOpen(s)}>
        {pick ? `Apply for ${s.first} instead` : `Open ${s.first}’s profile`}
      </Button>
    </motion.div>
  );
}
