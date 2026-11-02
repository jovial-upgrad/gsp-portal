import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Field } from '../../../components/forms';
import { CountryCombobox } from '../../../components/CountryCombobox';
import { Icon } from '../../../components/Icon';
import { countryByName } from '../../../data/partners';
import { systemOf } from '../../../admin/data/eligibility';
import { activeEducation, levelOfEd } from '../../../data/education';
import { highestEdOf } from '../../../data/eligibility';
import {
  gradingOptions,
  scaleMax,
  scoreOk,
  LANGUAGES,
  LEVEL_NAME,
  STUDY_LEVELS,
  eduDocKey,
  eduDocName,
  eduFields,
  emptyEdu,
  isSchool,
  levelsFor,
  pctOf,
  type Edu,
  type Level,
  type Student,
} from '../../../data/students';
import { parseMonth, typeMonth } from '../../../data/dates';
import { ReadBox, ReadNote, filledAt, filledText, readMs } from '../ReadBox';
import { Sel, Txt, type Update } from './fields';
import { fillFromEducation, saveEducation } from './read';

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * Academics: the highest education, then its card, which is mandatory with its marksheet or transcript.
 * Other levels are optional, added from "Add education" at the top of the section, each with its own country.
 * The first time, before a level has its document or details, uploading the document fills the card; after that
 * it's edited by hand, and the document is kept in Documents (Nesil, 29 Oct).
 */
export function Education({ s, update }: { s: Student; update: Update }) {
  const levels = levelsFor(s.highest);
  const setLevel = (l: Level, patch: Partial<Edu>) =>
    update((p) => ({
      ...p,
      edu: { ...p.edu, [l]: { ...(p.edu[l] ?? emptyEdu(p.eduCountry)), ...patch } },
      read: p.read.filter((k) => !Object.keys(patch).some((f) => k === `edu.${l}.${f}`)),
    }));

  return (
    <div className="rsec">
      <div className="grid2">
        <Sel
          id="re-highest"
          label="Highest education"
          required
          value={highestEdOf(s)}
          options={[...activeEducation(), ...(activeEducation().includes(highestEdOf(s)) ? [] : [highestEdOf(s)])]}
          hint="The highest education is required. Other levels are optional."
          onChange={(v) => {
            // the one list (S3C-1, Admin › Course configuration › Highest education); its level names the section
            const h = levelOfEd(v);
            update((p) => ({ ...p, highestEd: v, highest: h, edu: { ...p.edu, [h]: p.edu[h] ?? emptyEdu(p.eduCountry) } }));
          }}
        />
      </div>

      {levels.map((l) => {
        const required = l === s.highest;
        // the highest level always shows; another once it's added (or read from an upload)
        const open = required || !!s.edu[l] || !!s.docs[eduDocKey(l)];
        return open ? <LevelCard key={l} l={l} s={s} required={required} setLevel={setLevel} update={update} onRemove={required ? undefined : () => update((p) => removeLevel(p, l))} /> : null;
      })}
    </div>
  );
}

function removeLevel(p: Student, l: Level): Student {
  const edu = { ...p.edu };
  delete edu[l];
  const docs = { ...p.docs };
  delete docs[eduDocKey(l)];
  return { ...p, edu, docs, read: p.read.filter((k) => !k.startsWith(`edu.${l}.`)) };
}

function LevelCard({
  l,
  s,
  required,
  setLevel,
  update,
  onRemove,
}: {
  l: Level;
  s: Student;
  required: boolean;
  setLevel: (l: Level, patch: Partial<Edu>) => void;
  update: Update;
  onRemove?: () => void;
}) {
  const reduce = useReducedMotion();
  const [reading, setReading] = useState(false);
  const e = s.edu[l] ?? emptyEdu(s.eduCountry);
  const id = (f: string) => `re-${l}-${f}`;
  const doc = s.docs[eduDocKey(l)];
  const from = isSchool(l) ? 'marksheet' : 'transcript';
  const read = (f: keyof Edu) => (s.read.includes(`edu.${l}.${f}`) ? from : null);
  // autofill is one-time (1 Nov): once the document filled this level in, it's corrected by hand
  const filled = filledAt(s, eduDocKey(l));
  const states = countryByName(e.country)?.states ?? [];
  const left = eduFields(l, e).filter(([, , ok]) => !ok).length;
  const pct = pctOf(e);
  const start = parseMonth(e.start);
  const end = parseMonth(e.end);

  const readFile = (file: File) => {
    setReading(true);
    update((p) => saveEducation(p, l, file.name));
    window.setTimeout(() => {
      update((p) => fillFromEducation(p, l));
      setReading(false);
    }, readMs(reduce));
  };

  return (
    <motion.section className="card rlevel" aria-labelledby={id('title')} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }}>
      <header className="rlevel__head">
        <h3 id={id('title')} className="rlevel__title">
          {LEVEL_NAME[l]}
        </h3>
        <span className={`rtag ${required ? 'rtag--req' : ''}`}>{required ? 'Required' : 'Optional'}</span>
        {/* only the mandatory level can be incomplete */}
        {left === 0 ? <span className="rlevel__state is-done">Complete</span> : required ? <span className="rlevel__state is-todo">Incomplete</span> : null}
        {onRemove && (
          <button type="button" className="icon-btn rlevel__remove" aria-label={`Remove ${LEVEL_NAME[l]} details`} title="Remove" onClick={onRemove}>
            <Icon name="close" size={16} />
          </button>
        )}
      </header>

      {reading || (!filled && !doc && !(e.level || e.institution || e.qualification || e.score)) ? (
        <ReadBox
          id={id('file')}
          compact
          title={`Fill this in from the ${eduDocName(l).toLowerCase()}`}
          text={`Upload it and we fill in this ${LEVEL_NAME[l]} section. It’s kept in Documents.${required ? ' Every application needs it.' : ''}`}
          button={`Upload ${from}`}
          file={doc?.file}
          reading={reading}
          onFile={readFile}
        />
      ) : (
        filled && <ReadNote text={filledText(eduDocName(l).toLowerCase(), filled)} />
      )}

      <div className="grid2">
        <Field id={id('country')} label="Country" required={required}>
          <CountryCombobox id={id('country')} value={e.country} onChange={(v) => v !== e.country && setLevel(l, { country: v, state: '' })} />
        </Field>
        {states.length > 0 ? <Sel id={id('state')} label="State or province" required={required} value={e.state} read={read('state')} options={states} onChange={(v) => setLevel(l, { state: v })} /> : <span />}
        <Sel id={id('level')} label="Program Level" required={required} value={e.level} read={read('level')} options={STUDY_LEVELS[l]} onChange={(v) => setLevel(l, { level: v })} />
        <Txt id={id('institution')} label={isSchool(l) ? 'School board' : 'University'} required={required} value={e.institution} read={read('institution')} onChange={(v) => setLevel(l, { institution: v })} hint={isSchool(l) ? 'Like CBSE, ICSE or a state board.' : undefined} />
        <Txt
          id={id('qualification')}
          label={isSchool(l) ? 'Qualification' : 'Qualification or degree'}
          required={required}
          value={e.qualification}
          read={read('qualification')}
          onChange={(v) => setLevel(l, { qualification: v })}
          hint={isSchool(l) ? (l === 'g12' ? 'Like PUC, Science (PCMB) or HSC, Commerce.' : 'Like SSLC or Secondary School Certificate.') : 'Like B.Tech, Computer Science.'}
        />
        <Sel id={id('grading')} label="Grading system" required={required} value={e.grading} read={read('grading')} options={gradingOptions(e.grading)} onChange={(v) => setLevel(l, { grading: v as Edu['grading'], score: '' })} hint="From Admin › Grade conversion. The eligibility check converts the score to a percentage." />
        <Txt
          id={id('score')}
          label="Score"
          required={required}
          value={e.score}
          read={read('score')}
          inputMode="decimal"
          disabled={!e.grading}
          onChange={(v) => setLevel(l, { score: v.slice(0, 12) })}
          hint={!e.grading ? 'Choose the grading system first.' : pct !== null && systemOf(e.grading)?.by !== 'As is' ? `About ${pct}%` : scaleMax(e.grading) ? `Out of ${scaleMax(e.grading)}` : `A grade: ${systemOf(e.grading)?.bands.map((b) => b.from).join(', ')}`}
          error={e.score && e.grading && !scoreOk(e) ? (systemOf(e.grading)?.by === 'Bands' && Number.isNaN(Number(e.score)) ? `Enter one of the grades: ${systemOf(e.grading)?.bands.map((b) => b.from).join(', ')}.` : `Enter a score from 0 to ${scaleMax(e.grading)}.`) : null}
        />
        <Sel id={id('language')} label="Primary language of instruction" required={required} value={e.language} read={read('language')} options={LANGUAGES} onChange={(v) => setLevel(l, { language: v })} hint="English can waive the English test for some universities." />
        {!isSchool(l) && (
          <Txt
            id={id('backlogs')}
            label="Backlogs"
            required={required}
            value={e.backlogs}
            read={read('backlogs')}
            inputMode="numeric"
            onChange={(v) => setLevel(l, { backlogs: v.replace(/\D/g, '') })}
            hint="Subjects failed and retaken. 0 if none."
          />
        )}
        <Txt
          id={id('start')}
          label="Start date"
          required={required}
          value={e.start}
          read={read('start')}
          placeholder="MM/YYYY"
          inputMode="numeric"
          format={typeMonth}
          onChange={(v) => setLevel(l, { start: v })}
          error={e.start && !start ? 'Enter the month as MM/YYYY, like 08/2019.' : null}
        />
        <Txt
          id={id('end')}
          label="End date"
          required={required}
          value={e.end}
          read={read('end')}
          placeholder="MM/YYYY"
          inputMode="numeric"
          format={typeMonth}
          onChange={(v) => setLevel(l, { end: v })}
          error={e.end && !end ? 'Enter the month as MM/YYYY, like 06/2023.' : start && end && end <= start ? 'The end date is before the start date.' : null}
        />
      </div>
    </motion.section>
  );
}
