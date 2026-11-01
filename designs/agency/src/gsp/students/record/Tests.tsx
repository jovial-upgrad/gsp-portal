import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Icon } from '../../../components/Icon';
import { TESTS, inRange, rangeText, testDocKey, type Student, type Test } from '../../../data/students';
import { fillFromTest, saveTest } from './read';
import { parseDate, shortDate, typeDate } from '../../../data/dates';
import { ReadBox, ReadNote, filledAt, filledText, readMs } from '../ReadBox';
import { Txt, type Update } from './fields';
import { useRevealErrors } from '../../../components/validate';

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * English test: optional. English tests (IELTS, TOEFL, PTE, Duolingo) and admission tests (SAT, ACT, GMAT, GRE),
 * added from "Add test" at the top of the section, each with its certificate ID, date and scores in their
 * own ranges. Once a test is added, every field is required (Jovial's Test fields sheet, 1 Nov): the score report,
 * the certificate ID, the date of examination, the overall and every part; Save shows what's missing. The first time, uploading the score report fills it in; after that it's edited by hand, and the
 * report is kept in Documents. Scores past their validity say so.
 */
export function Tests({ s, update }: { s: Student; update: Update }) {
  const remove = (t: Test) =>
    update((p) => {
      const docs = { ...p.docs };
      delete docs[testDocKey(t)];
      return { ...p, tests: p.tests.filter((x) => x.id !== t.id), docs, read: p.read.filter((k) => !k.startsWith(`test.${t.id}.`)) };
    });

  return (
    <div className="rsec">
      {s.tests.map((t) => (
        <TestCard key={t.id} t={t} s={s} update={update} onRemove={() => remove(t)} />
      ))}
      {s.tests.length === 0 && (
        <div className="rempty">
          <p className="rempty__title">No tests added</p>
          <p className="rempty__text">Use Add test at the top.</p>
        </div>
      )}
    </div>
  );
}

function TestCard({ t, s, update, onRemove }: { t: Test; s: Student; update: Update; onRemove: () => void }) {
  const reduce = useReducedMotion();
  const [reading, setReading] = useState(false);
  const def = TESTS[t.type];
  const id = (f: string) => `rt-${t.id}-${f}`;
  const doc = s.docs[testDocKey(t)];
  const read = (f: string) => (s.read.includes(`test.${t.id}.${f}`) ? 'score report' : null);
  // autofill is one-time (1 Nov): once the score report filled this in, it's corrected by hand
  const filled = filledAt(s, testDocKey(t));
  const set = (patch: Partial<Test>, field: string) =>
    update((p) => ({ ...p, tests: p.tests.map((x) => (x.id === t.id ? { ...x, ...patch } : x)), read: p.read.filter((k) => k !== `test.${t.id}.${field}`) }));
  const date = parseDate(t.date);
  const until = date ? new Date(date.getFullYear() + def.years, date.getMonth(), date.getDate()) : null;
  const expired = until ? until.getTime() < Date.now() : false;

  const readFile = (file: File) => {
    setReading(true);
    update((p) => saveTest(p, t, file.name));
    window.setTimeout(() => {
      update((p) => fillFromTest(p, t.id));
      setReading(false);
    }, readMs(reduce));
  };
  const scoreError = (v: string, range: [number, number, number], what: string) => (!v.trim() ? `Enter the ${what}.` : !inRange(v, range) ? `Enter a score from ${rangeText(range)}.` : null);
  // the score report is required too: Save says so under the upload (HC Test fields, 1 Nov)
  const reveal = useRevealErrors();
  const noReport = !doc && !reading && reveal > 0;

  return (
    <motion.section className="card rlevel" aria-labelledby={id('title')} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }}>
      <header className="rlevel__head">
        <h3 id={id('title')} className="rlevel__title" tabIndex={-1}>
          {def.name}
        </h3>
        <span className="rtag">{def.kind === 'English' ? 'English' : 'Admission'}</span>
        {until && (
          <span className={`rlevel__state ${expired ? 'is-bad' : 'is-plain'}`}>
            {expired ? `Expired ${shortDate(until, true)}` : `Valid until ${shortDate(until, true)}`}
          </span>
        )}
        <button type="button" className="icon-btn rlevel__remove" aria-label={`Remove ${def.name}`} title="Remove" onClick={onRemove}>
          <Icon name="close" size={16} />
        </button>
      </header>
      {reading || (!filled && !doc && !(t.cert || t.date || t.overall)) ? (
        <>
          <ReadBox id={id('file')} compact title="Fill this in from the score report *" text="Upload it and we fill in the scores below. It’s kept in Documents." button="Upload report" file={doc?.file} reading={reading} onFile={readFile} />
          {noReport && (
            <p className="field__msg field__msg--error" id={id('file-error')} role="alert" tabIndex={-1} aria-invalid="true">
              <span>Upload the score report.</span>
            </p>
          )}
        </>
      ) : !doc ? (
        <>
          <ReadBox id={id('file')} compact title="Score report *" text="Upload the score report. It’s kept in Documents." button="Upload report" reading={reading} onFile={(f) => update((p) => saveTest(p, t, f.name))} />
          {noReport && (
            <p className="field__msg field__msg--error" id={id('file-error')} role="alert" tabIndex={-1} aria-invalid="true">
              <span>Upload the score report.</span>
            </p>
          )}
        </>
      ) : null}
      {filled && !reading && <ReadNote text={filledText(`${def.name} score report`, filled)} />}
      <div className="grid2">
        <Txt id={id('cert')} label="Certificate ID" required error={t.cert.trim() ? null : 'Enter the certificate ID.'} value={t.cert} read={read('cert')} hint={def.cert} onChange={(v) => set({ cert: v }, 'cert')} />
        <Txt
          id={id('date')}
          label="Date of examination"
          required
          value={t.date}
          read={read('date')}
          placeholder="DD/MM/YYYY"
          inputMode="numeric"
          format={typeDate}
          onChange={(v) => set({ date: v }, 'date')}
          error={!t.date ? 'Enter the date of examination.' : !date ? 'Enter the date as DD/MM/YYYY, like 12/08/2026.' : date && date.getTime() > Date.now() ? 'The test date can’t be in the future.' : null}
          hint={`Scores count for ${def.years} years.`}
        />
      </div>
      <div className={`rscores ${def.parts.length > 4 ? 'is-wide' : ''}`}>
        <Txt id={id('overall')} label="Overall" required value={t.overall} read={read('overall')} inputMode="decimal" hint={rangeText(def.overall)} onChange={(v) => set({ overall: v.replace(/[^\d.]/g, '') }, 'overall')} error={scoreError(t.overall, def.overall, 'overall score')} />
        {def.parts.map((p) => (
          <Txt
            key={p.key}
            id={id(p.key)}
            label={p.label}
            required
            value={t.parts[p.key] ?? ''}
            read={read(p.key)}
            inputMode="decimal"
            hint={rangeText(p.range)}
            onChange={(v) => set({ parts: { ...t.parts, [p.key]: v.replace(/[^\d.]/g, '') } }, p.key)}
            error={scoreError(t.parts[p.key] ?? '', p.range, `${p.label.toLowerCase()} score`)}
          />
        ))}
      </div>
    </motion.section>
  );
}
