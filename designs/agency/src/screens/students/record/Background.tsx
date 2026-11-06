import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MARITAL, newRefusal, type Marital, type Refusal, type Student } from '../../../data/students';
import { typeDate, typeMonth } from '../../../data/dates';
import { Field, describedBy } from '../../../components/forms';
import { CountryCombobox } from '../../../components/CountryCombobox';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Choice, Sel, Txt, type Update } from './fields';
import { backgroundIssues, refusalsOf } from './checks';

let seq = 1;
/** Where refusals usually come from: the countries students apply to most, first in the country list. */
const STUDY_DESTINATIONS = ['United Kingdom', 'Canada', 'Australia', 'United States', 'New Zealand', 'Ireland', 'Germany'];

/**
 * Background (Nesil, 4 Nov, in RP Admin): what universities and visa officers ask, each question in its own card and
 * said plainly, with why it's asked, so counsellors can explain it to the student. **Marital status** (and the date of
 * marriage when married) and **visa refusals** (each refusal's country, visa or document, and when) are required:
 * Save shows what's missing and goes to the first. A spouse or dependents going with the student, and a disability
 * or long-term health condition, are optional.
 */
export function Background({ s, update, tried = 0, saved }: { s: Student; update: Update; tried?: number; saved?: Student }) {
  const reduce = useReducedMotion();
  const { ask, dialog } = useConfirm();
  // the height animates; once open, a list (the country picker's) can drop out of it
  const fade = reduce
    ? {}
    : {
        initial: { opacity: 0, height: 0, overflow: 'hidden' as const },
        animate: { opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' as const } },
        exit: { opacity: 0, height: 0, overflow: 'hidden' as const },
        transition: { duration: 0.2 },
      };
  const issues = backgroundIssues(s);
  const err = (id: string) => issues.find((x) => x.id === id)?.msg ?? null;
  /** Lists and choices say what's missing once Save was tried; text fields also once they're left. */
  const shown = (id: string) => (tried ? err(id) : null);
  const set = (patch: Partial<Student>) => update((p) => ({ ...p, ...patch }));
  const refusals = refusalsOf(s);
  const setRefusal = (id: string, patch: Partial<Refusal>) => update((p) => ({ ...p, refusals: refusalsOf(p).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const addRefusal = () => {
    const id = `rn${seq++}`;
    update((p) => ({ ...p, refusals: [...refusalsOf(p), newRefusal(id)] }));
    window.setTimeout(() => document.getElementById(`rb-r-${id}-country`)?.focus(), 80);
  };
  const removeRefusal = (r: Refusal, i: number) => {
    const run = () => update((p) => ({ ...p, refusals: refusalsOf(p).filter((x) => x.id !== r.id) }));
    // one that's saved on the profile asks first
    if (saved?.refusals?.some((x) => x.id === r.id))
      ask({ title: `Remove refusal ${i + 1}?`, text: `${[r.country, r.visa].filter(Boolean).join(', ') || 'It'} comes off Background when you save. Cancel keeps it.`, run });
    else run();
  };

  return (
    <div className="rsec">
      <p className="vh" role="status">
        {tried && issues.length ? `${issues.length} ${issues.length === 1 ? 'answer needs' : 'answers need'} attention.` : ''}
      </p>

      <div className="card rq">
        <div className="grid2">
          <Sel
            id="rb-marital"
            label="Marital status"
            required
            value={s.marital ?? ''}
            options={[...MARITAL]}
            error={shown('rb-marital')}
            onChange={(v) => set({ marital: v as Marital })}
          />
          <AnimatePresence initial={false}>
            {s.marital === 'Married' && (
              <motion.div key="m" initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <Txt
                  id="rb-married-on"
                  label="Date of marriage"
                  required
                  value={s.marriedOn ?? ''}
                  placeholder="DD/MM/YYYY"
                  inputMode="numeric"
                  format={typeDate}
                  tried={!!tried}
                  error={err('rb-married-on')}
                  onChange={(v) => set({ marriedOn: v })}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="card rq">
        <Choice
          id="rb-visa"
          label="Has the student ever been refused a visa, for any country?"
          required
          value={s.visa}
          hint="Universities and visa officers ask. A past refusal doesn’t stop an application, but it needs to be declared."
          error={shown('rb-visa')}
          onChange={(v) => update((p) => ({ ...p, visa: v }))}
          options={[
            ['no', 'No'],
            ['yes', 'Yes'],
          ]}
        />
        <AnimatePresence initial={false}>
          {s.visa === 'yes' && (
            <motion.div key="v" className="rq__open" {...fade}>
              <div className="rrefusals">
                {refusals.map((r, i) => {
                  const id = (f: string) => `rb-r-${r.id}-${f}`;
                  return (
                    <fieldset key={r.id} className="rrefusal">
                      <legend className="rrefusal__title">Refusal {i + 1}</legend>
                      {refusals.length > 1 && (
                        <button type="button" className="icon-btn rrefusal__remove" aria-label={`Remove refusal ${i + 1}`} title="Remove" onClick={() => removeRefusal(r, i)}>
                          <Icon name="close" size={16} />
                        </button>
                      )}
                      <div className="rrefusal__grid">
                        <Field id={id('country')} label="Country" required error={shown(id('country'))}>
                          <CountryCombobox
                            id={id('country')}
                            value={r.country}
                            invalid={!!shown(id('country'))}
                            describedBy={describedBy(id('country'), shown(id('country')))}
                            top={STUDY_DESTINATIONS}
                            topLabel="Where students apply most"
                            onChange={(v) => setRefusal(r.id, { country: v })}
                          />
                        </Field>
                        <Txt
                          id={id('visa')}
                          label="Which visa or document"
                          required
                          value={r.visa}
                          placeholder="Like: Study permit"
                          tried={!!tried}
                          error={err(id('visa'))}
                          onChange={(v) => setRefusal(r.id, { visa: v })}
                        />
                        <Txt
                          id={id('when')}
                          label="When"
                          required
                          value={r.when}
                          placeholder="MM/YYYY"
                          inputMode="numeric"
                          format={typeMonth}
                          tried={!!tried}
                          error={err(id('when'))}
                          onChange={(v) => setRefusal(r.id, { when: v })}
                        />
                      </div>
                    </fieldset>
                  );
                })}
                <div className="rrefusals__add">
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={addRefusal}>
                    Add another refusal
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="card rq">
        <Choice
          id="rb-dependents"
          label="Will a spouse or dependents go with the student?"
          value={s.dependents ?? ''}
          hint="Optional. Some visas and universities ask, for funds and accommodation."
          onChange={(v) => set({ dependents: v })}
          options={[
            ['no', 'No'],
            ['yes', 'Yes'],
          ]}
        />
        <AnimatePresence initial={false}>
          {s.dependents === 'yes' && (
            <motion.div key="dp" className="rq__open" {...fade}>
              <div className="grid2">
                <Txt
                  id="rb-dependents-n"
                  label="How many?"
                  value={s.dependentsCount ?? ''}
                  inputMode="numeric"
                  format={(v) => v.replace(/\D/g, '').slice(0, 2)}
                  error={s.dependentsCount && Number(s.dependentsCount) < 1 ? 'Enter 1 or more.' : null}
                  onChange={(v) => set({ dependentsCount: v })}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="card rq">
        <Choice
          id="rb-disability"
          label="Does the student have a disability or long-term health condition?"
          value={s.disability}
          hint="Universities use this to offer support. It never affects an offer."
          onChange={(v) => update((p) => ({ ...p, disability: v }))}
          options={[
            ['no', 'No'],
            ['yes', 'Yes'],
            ['na', 'Prefer not to say'],
          ]}
        />
        <AnimatePresence initial={false}>
          {s.disability === 'yes' && (
            <motion.div key="d" className="rq__open" {...fade}>
              <Txt id="rb-disability-note" label="What support might help?" value={s.disabilityNote} hint="Optional. Like extra time in exams, or step-free rooms." onChange={(v) => update((p) => ({ ...p, disabilityNote: v }))} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {dialog}
    </div>
  );
}
