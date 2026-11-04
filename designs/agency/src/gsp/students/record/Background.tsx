import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { Field } from '../../../components/forms';
import { CountryCombobox } from '../../../components/CountryCombobox';
import { emptyRefusal, type Refusal, type Student } from '../../../data/students';
import { DISABILITY_ANSWERS, MARITAL_STATUSES, MARRIED, MAX_DEPENDANTS, YES_NO } from '../../../data/reference';
import { parseDate, parseMonth, typeDate, typeMonth } from '../../../data/dates';
import { Choice, Sel, Txt, type Update } from './fields';

let seq = 0;
const yesNo = YES_NO.map(([v, l]) => [v, l] as ['yes' | 'no', string]);

/**
 * Background (admissions feedback, 4 Nov): marital status (mandatory; the marriage date when married) and the visa
 * refusal question (mandatory to answer; each refusal's country, visa or document and month when yes) are what
 * universities and visa officers ask. Accompanying spouse or dependents, and the disability question, are optional.
 * Said plainly, with why they're asked, so counsellors can explain them to the student. The lists are reference
 * data (data/reference.ts).
 */
export function Background({ s, update }: { s: Student; update: Update }) {
  const reduce = useReducedMotion();
  const fade = reduce ? {} : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.2 } };
  const refusals = s.refusals ?? [];
  const setRefusal = (id: string, patch: Partial<Refusal>) => update((p) => ({ ...p, refusals: (p.refusals ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const addRefusal = () => {
    const id = `vr${Date.now().toString(36)}${seq++}`;
    update((p) => ({ ...p, refusals: [...(p.refusals ?? []), emptyRefusal(id)] }));
    window.setTimeout(() => document.getElementById(`rb-ref-${id}-country`)?.focus(), 60);
  };
  const married = parseDate(s.marriedOn ?? '');
  return (
    <div className="rsec">
      <div className="card rq">
        <Sel
          id="rb-marital"
          label="Marital status"
          required
          value={s.marital ?? ''}
          options={[...MARITAL_STATUSES]}
          placeholder="Choose"
          onChange={(v) => update((p) => ({ ...p, marital: v, marriedOn: v === MARRIED ? p.marriedOn : '' }))}
        />
        <AnimatePresence initial={false}>
          {s.marital === MARRIED && (
            <motion.div key="m" className="rq__more" {...fade}>
              <Txt
                id="rb-married-on"
                label="Date of marriage"
                required
                value={s.marriedOn ?? ''}
                placeholder="DD/MM/YYYY"
                inputMode="numeric"
                format={typeDate}
                onChange={(v) => update((p) => ({ ...p, marriedOn: v }))}
                error={!s.marriedOn ? 'Enter the date of marriage.' : !married ? 'Enter the date as DD/MM/YYYY, like 14/02/2022.' : married.getTime() > Date.now() ? 'The date of marriage can’t be in the future.' : null}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="card rq">
        <Choice
          id="rb-visa"
          label="Has the student ever been refused a visa, for any country?"
          required
          value={s.visa}
          hint="Universities and visa officers ask. A past refusal doesn’t stop an application, but it needs to be declared."
          onChange={(v) => update((p) => ({ ...p, visa: v, refusals: v === 'yes' ? (p.refusals?.length ? p.refusals : [emptyRefusal(`vr${Date.now().toString(36)}${seq++}`)]) : [] }))}
          options={yesNo}
        />
        <AnimatePresence initial={false}>
          {s.visa === 'yes' && (
            <motion.div key="v" className="rq__more rrefusals" {...fade}>
              {!refusals.length && s.visaNote.trim() && <p className="field__msg">Earlier answer: {s.visaNote}. Add each refusal below.</p>}
              {refusals.map((r, i) => (
                <fieldset key={r.id} className="rrefusal">
                  <legend className="rrefusal__title">
                    Refusal {i + 1}
                    {refusals.length > 1 && (
                      <button type="button" className="icon-btn" aria-label={`Remove refusal ${i + 1}`} onClick={() => update((p) => ({ ...p, refusals: (p.refusals ?? []).filter((x) => x.id !== r.id) }))}>
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </legend>
                  <div className="grid3">
                    <Field id={`rb-ref-${r.id}-country`} label="Country" required>
                      <CountryCombobox id={`rb-ref-${r.id}-country`} value={r.country} onChange={(v) => setRefusal(r.id, { country: v })} />
                    </Field>
                    <Txt id={`rb-ref-${r.id}-visa`} label="Which visa or document" required value={r.visa} onChange={(v) => setRefusal(r.id, { visa: v.slice(0, 80) })} placeholder="Like: Study permit" error={r.visa.trim() ? null : 'Enter which visa or document.'} />
                    <Txt
                      id={`rb-ref-${r.id}-when`}
                      label="When"
                      required
                      value={r.when}
                      placeholder="MM/YYYY"
                      inputMode="numeric"
                      format={typeMonth}
                      onChange={(v) => setRefusal(r.id, { when: v })}
                      error={!r.when ? 'Enter the month and year.' : !parseMonth(r.when) ? 'Enter the month as MM/YYYY, like 03/2023.' : null}
                    />
                  </div>
                </fieldset>
              ))}
              <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={addRefusal}>
                Add another refusal
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="card rq">
        <Choice
          id="rb-dependants"
          label="Will a spouse or dependents go with the student?"
          value={s.dependants ?? ''}
          hint="Optional. Some visas and universities ask, for funds and accommodation."
          onChange={(v) => update((p) => ({ ...p, dependants: v, dependantsCount: v === 'yes' ? p.dependantsCount : '' }))}
          options={yesNo}
        />
        <AnimatePresence initial={false}>
          {s.dependants === 'yes' && (
            <motion.div key="dp" className="rq__more" {...fade}>
              <Txt
                id="rb-dependants-n"
                label="How many?"
                value={s.dependantsCount ?? ''}
                inputMode="numeric"
                onChange={(v) => update((p) => ({ ...p, dependantsCount: v.replace(/\D/g, '').slice(0, 2) }))}
                error={s.dependantsCount && (Number(s.dependantsCount) < 1 || Number(s.dependantsCount) > MAX_DEPENDANTS) ? `Enter a number from 1 to ${MAX_DEPENDANTS}.` : null}
              />
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
          options={DISABILITY_ANSWERS.map(([v, l]) => [v, l] as ['yes' | 'no' | 'na', string])}
        />
        <AnimatePresence initial={false}>
          {s.disability === 'yes' && (
            <motion.div key="d" className="rq__more" {...fade}>
              <Txt id="rb-disability-note" label="What support might help?" value={s.disabilityNote} hint="Optional. Like extra time in exams, or step-free rooms." onChange={(v) => update((p) => ({ ...p, disabilityNote: v }))} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
