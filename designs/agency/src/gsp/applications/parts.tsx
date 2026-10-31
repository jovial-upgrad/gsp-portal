import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { STAGES, type AppOwner } from '../../data/applications';

/** What each stage means, from GSP's side (W28, 1 Nov): the RP's own path says "You add the application". */
export const GSP_STAGE_HINT = [
  'The RP adds the application and its documents',
  'GSP Admissions verifies the documents',
  'GSP Admissions submits to the university, which decides',
  'The offer, and its conditions',
  'Finance and background check, assessment, the unconditional offer',
  'Tuition or deposit, then the acceptance letter',
  'The visa',
  'Enrolment',
];
import { OWNER_TAG, OWNER_WORD } from './owners';
import { shortDate } from '../../data/dates';

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * GSP Assist's mark: a speech shape with a spark cut into it, filled with the AI gradient (the GSP logo's
 * spectrum) and always beside the words "GSP Assist", so it never reads as a favourite star or the brand.
 * It's alive where it speaks for GSP Assist: the colours flow slowly round it and the spark twinkles now
 * and then ("idle"); while it reads or thinks, the spark turns and the colours move faster ("busy").
 * Small marks in lists, chips and messages stay "still". Nothing moves under reduced motion.
 */
export function AssistMark({ size = 18, motion: mode = 'still' }: { size?: number; motion?: 'idle' | 'busy' | 'still' }) {
  const id = `amg${useId().replace(/:/g, '')}`;
  const reduce = useReducedMotion();
  const live = !reduce && mode !== 'still';
  return (
    <svg className={`amark${live ? ` amark--${mode}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--ai-s1)' }} />
          <stop offset="0.4" style={{ stopColor: 'var(--ai-s2)' }} />
          <stop offset="0.75" style={{ stopColor: 'var(--ai-s3)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ai-s4)' }} />
          {live && <animateTransform attributeName="gradientTransform" type="rotate" values="0 12 12;360 12 12" dur={mode === 'busy' ? '2.4s' : '9s'} repeatCount="indefinite" />}
        </linearGradient>
      </defs>
      <path d="M12 2.8c5.2 0 9.2 3.6 9.2 8.3s-4 8.3-9.2 8.3c-1 0-2-.1-2.9-.4L4.6 21l1-3.9C3.8 15.6 2.8 13.5 2.8 11.1 2.8 6.4 6.8 2.8 12 2.8z" fill={`url(#${id})`} />
      <path className="amark__spark" d="M12 6.6l1.15 3.15L16.3 11l-3.15 1.15L12 15.3l-1.15-3.15L7.7 11l3.15-1.25z" fill="#fff" />
    </svg>
  );
}

/**
 * GSP Assist's name. Over its own surfaces (`eyebrow`) it's a header: a larger live mark, "GSP ASSIST" in
 * capitals, and what the surface is in sentence case ("GSP ASSIST · Today"). Elsewhere it's a plain line.
 */
export function AssistLabel({ text = 'GSP Assist', note, eyebrow = false, busy = false }: { text?: string; note?: string; eyebrow?: boolean; busy?: boolean }) {
  if (eyebrow)
    return (
      <span className="alabel alabel--eyebrow">
        <AssistMark size={24} motion={busy ? 'busy' : 'idle'} />
        <span>
          <span className="alabel__name">GSP Assist</span>
          {note && (
            <span key={note} className="alabel__note">
              {' '}
              · {note}
            </span>
          )}
        </span>
      </span>
    );
  return (
    <span className="alabel">
      <AssistMark size={16} motion="idle" />
      {text}
    </span>
  );
}

/** "Thinking": a soft teal sweep with what's being done, so a pause never reads as broken. */
export function Thinking({ text }: { text: string }) {
  return (
    <span className="athink" role="status">
      <span className="athink__bar" aria-hidden="true">
        <span />
      </span>
      {text}
    </span>
  );
}

/** Eight short segments, filled to the current stage in the owner's colour. */
export function StageMeter({ stage, owner }: { stage: number; owner: AppOwner }) {
  return (
    <span className={`smeter smeter--${owner}`} aria-hidden="true">
      {STAGES.map((_, i) => (
        <span key={i} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''} />
      ))}
    </span>
  );
}

/**
 * The eight stages as a path: checks for the stages passed, the current one in the owner's colour with
 * a slow pulse, the rest waiting. Each stage says what it means on hover and to screen readers. Under the
 * current one, who has it; or just "Now" where the page already says who (`who={false}`).
 */
export function StageTrack({ stage, owner, dates = [], who = true }: { stage: number; owner: AppOwner; dates?: (number | undefined)[]; who?: boolean }) {
  const reduce = useReducedMotion();
  const ended = owner === 'end';
  const pct = (Math.min(stage, STAGES.length - 1) / (STAGES.length - 1)) * 100;
  return (
    <div className={`strack strack--${owner}`}>
      <div className="strack__rail" aria-hidden="true">
        <motion.span className="strack__fill" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: pct / 100 }} transition={{ duration: 0.9, ease, delay: 0.15 }} />
      </div>
      <ol className="strack__list">
        {STAGES.map((name, i) => {
          const st = i < stage || owner === 'done' ? 'done' : i === stage ? (ended ? 'ended' : 'now') : 'next';
          return (
            <li key={name} className={`strack__step is-${st}`} title={GSP_STAGE_HINT[i]} aria-current={st === 'now' ? 'step' : undefined}>
              <motion.span
                className="strack__dot"
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease, delay: 0.1 + i * 0.05 }}
              >
                {st === 'done' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : st === 'ended' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span className="strack__n">{i + 1}</span>
                )}
              </motion.span>
              <span className="strack__name">{name}</span>
              <span className="strack__when">{st === 'now' ? (who ? OWNER_WORD[owner] : 'Now') : st === 'done' && dates[i] ? shortDate(new Date(dates[i]!)) : st === 'ended' ? 'Closed here' : ''}</span>
              <span className="vh">
                {st === 'done' ? ', done' : st === 'now' ? ', now' : st === 'ended' ? ', closed here' : ', to come'}. {GSP_STAGE_HINT[i]}.
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Who has it, in their colour and in words. */
export function OwnerTag({ owner, short = false }: { owner: AppOwner; short?: boolean }) {
  const cls = owner === 'done' ? 'ok' : owner;
  return <span className={`who who--${cls}`}>{short ? OWNER_TAG[owner] : OWNER_WORD[owner]}</span>;
}
