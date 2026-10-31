import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Icon } from '../../../components/Icon';
import { TESTS, inRange, rangeText, testDocKey, type Student, type Test } from '../../../data/students';
import { fillFromTest, saveTest } from './read';
import { parseDate, shortDate, typeDate } from '../../../data/dates';
import { ReadBox, ReadNote, readMs } from '../ReadBox';
import { Txt, type Update } from './fields';

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * English test: optional. English tests (IELTS, TOEFL, PTE, Duolingo) and admission tests (SAT, ACT, GMAT, GRE),
 * added from "Add test" at the top of the section, each with its certificate ID, date and scores in their
 * own ranges. The first time, uploading the score report fills it in; after that it's edited by hand, and the
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
  const scoreError = (v: string, range: [number, number, number]) => (v && !inRange(v, range) ? `Enter a score from ${rangeText(range)}.` : null);

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
      {reading || (!doc && !(t.cert || t.date || t.overall)) ? (
        <ReadBox id={id('file')} compact title="Fill this in from the score report" text="Upload it and we fill in the scores below. It’s kept in Documents." button="Upload report" file={doc?.file} reading={reading} onFile={readFile} />
      ) : (
        doc && s.read.some((k) => k.startsWith(`test.${t.id}.`)) && <ReadNote text="Filled in from the score report, which is in Documents. What was read is highlighted: check it." />
      )}
      <div className="grid2">
        <Txt id={id('cert')} label="Certificate ID" value={t.cert} read={read('cert')} hint={def.cert} onChange={(v) => set({ cert: v }, 'cert')} />
        <Txt
          id={id('date')}
          label="Date of examination"
          value={t.date}
          read={read('date')}
          placeholder="DD/MM/YYYY"
          inputMode="numeric"
          format={typeDate}
          onChange={(v) => set({ date: v }, 'date')}
          error={t.date && !date ? 'Enter the date as DD/MM/YYYY, like 12/08/2026.' : date && date.getTime() > Date.now() ? 'The test date can’t be in the future.' : null}
          hint={`Scores count for ${def.years} years.`}
        />
      </div>
      <div className={`rscores ${def.parts.length > 4 ? 'is-wide' : ''}`}>
        <Txt id={id('overall')} label="Overall" value={t.overall} read={read('overall')} inputMode="decimal" hint={rangeText(def.overall)} onChange={(v) => set({ overall: v.replace(/[^\d.]/g, '') }, 'overall')} error={scoreError(t.overall, def.overall)} />
        {def.parts.map((p) => (
          <Txt
            key={p.key}
            id={id(p.key)}
            label={
              <>
                {p.label}
                {p.optional && <span className="field__optional"> (optional)</span>}
              </>
            }
            value={t.parts[p.key] ?? ''}
            read={read(p.key)}
            inputMode="decimal"
            hint={rangeText(p.range)}
            onChange={(v) => set({ parts: { ...t.parts, [p.key]: v.replace(/[^\d.]/g, '') } }, p.key)}
            error={scoreError(t.parts[p.key] ?? '', p.range)}
          />
        ))}
      </div>
    </motion.section>
  );
}
