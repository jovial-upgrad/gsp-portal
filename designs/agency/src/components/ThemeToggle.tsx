import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTheme, type Theme } from '../theme';
import { Icon, type IconName } from './Icon';
import { GlassRim } from './GlassRim';
import './theme-toggle.css';

const OPTIONS: { value: Theme; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

/**
 * Light / dark theme switch, shown in the product itself.
 * The selected thumb slides between options like a drop of liquid (a spring that stretches, then settles).
 * `glass` is for when it floats over a photo; on a glass panel use the plain one (no glass on glass).
 */
export function ThemeToggle({ className = '', glass = false }: { className?: string; glass?: boolean }) {
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();
  const thumbId = useId();
  return (
    <div className={`ttoggle ${glass ? 'ttoggle--glass glass glass--clear' : ''} ${className}`} role="radiogroup" aria-label="Theme">
      {glass && <GlassRim />}
      {OPTIONS.map((o) => {
        const on = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            className="ttoggle__opt"
            onClick={() => setTheme(o.value)}
          >
            {on && (
              <motion.span
                layoutId={thumbId}
                className="ttoggle__thumb"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 32, mass: 0.8 }}
                aria-hidden="true"
              />
            )}
            <Icon name={o.icon} size={16} />
          </button>
        );
      })}
    </div>
  );
}
