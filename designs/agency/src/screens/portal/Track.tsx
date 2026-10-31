import { motion, useReducedMotion } from 'motion/react';

export type StepState = 'done' | 'you' | 'now' | 'back' | 'wait' | 'end';
export type TrackStep = {
  title: string;
  note?: string;
  state: StepState;
  /** Makes the step a tab for what shows below the card. */
  onSelect?: () => void;
  selected?: boolean;
};

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * Where the agency is in joining, as numbered steps: done steps filled green, the step on now ringed in green
 * (turning while GSP works on it), a step GSP sent back ringed in red, the rest grey. Steps with onSelect also
 * work as tabs, underlined when selected.
 */
export function Track({ steps, controls }: { steps: TrackStep[]; /** id of the content the tab steps switch */ controls?: string }) {
  const reduce = useReducedMotion();
  const said = { done: ' (done)', you: ' (pending)', now: ' (in progress)', back: ' (needs you)', wait: ' (next)', end: ' (next)' };
  const tabs = steps.some((s) => s.onSelect);
  return (
    <ol className={`vtrack vtrack--${steps.length} ${tabs ? 'vtrack--tabs' : ''}`} aria-label="Joining upGrad GSP">
      {steps.map((s, i) => {
        const inner = (
          <>
            <span className="vtrack__marker" aria-hidden="true">
              {i + 1}
              {s.state === 'now' && <span className="vtrack__spin" />}
            </span>
            <span className="vtrack__title">
              {s.title}
              <span className="vh">{said[s.state]}</span>
            </span>
            {s.note && <span className="vtrack__note">{s.note}</span>}
          </>
        );
        return (
          <li
            key={s.title}
            className={`vtrack__step is-${s.state} ${s.onSelect ? 'vtrack__step--tab' : ''}`}
            aria-current={s.state === 'now' || s.state === 'back' || s.state === 'you' ? 'step' : undefined}
          >
            {s.onSelect ? (
              <button type="button" className="vtrack__tab" aria-pressed={!!s.selected} aria-controls={controls} onClick={s.onSelect}>
                {inner}
                {s.selected && <motion.span className="vtrack__bar" layoutId="vtrack-bar" transition={reduce ? { duration: 0 } : { duration: 0.28, ease }} />}
              </button>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}
