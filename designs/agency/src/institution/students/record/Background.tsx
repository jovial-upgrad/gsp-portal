import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Student } from '../../../data/students';
import { Choice, Txt, type Update } from './fields';

/**
 * Background: two optional questions universities and visa officers ask. Said plainly, with why they're
 * asked, so counsellors can explain them to the student.
 */
export function Background({ s, update }: { s: Student; update: Update }) {
  const reduce = useReducedMotion();
  const fade = reduce ? {} : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.2 } };
  return (
    <div className="rsec">
      <div className="card rq">
        <Choice
          id="rb-visa"
          label="Has the student ever been refused a visa, for any country?"
          value={s.visa}
          hint="Universities and visa officers ask. A past refusal doesn’t stop an application, but it needs to be declared."
          onChange={(v) => update((p) => ({ ...p, visa: v }))}
          options={[
            ['no', 'No'],
            ['yes', 'Yes'],
          ]}
        />
        <AnimatePresence initial={false}>
          {s.visa === 'yes' && (
            <motion.div key="v" className="rq__more" {...fade}>
              <Txt id="rb-visa-note" label="Which country, which visa, and when?" value={s.visaNote} hint="Like: Canada, study permit, 2023." onChange={(v) => update((p) => ({ ...p, visaNote: v }))} />
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
            <motion.div key="d" className="rq__more" {...fade}>
              <Txt id="rb-disability-note" label="What support might help?" value={s.disabilityNote} hint="Optional. Like extra time in exams, or step-free rooms." onChange={(v) => update((p) => ({ ...p, disabilityNote: v }))} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
