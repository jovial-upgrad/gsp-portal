import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TextInput } from './forms';
import { Icon } from './Icon';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean; onCaps?: (on: boolean) => void };

/** Password field with show/hide and a Caps Lock signal. */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput({ onCaps, invalid, ...rest }, ref) {
  const [shown, setShown] = useState(false);
  const caps = (e: React.KeyboardEvent<HTMLInputElement>) => onCaps?.(e.getModifierState?.('CapsLock') ?? false);
  return (
    <TextInput
      ref={ref}
      type={shown ? 'text' : 'password'}
      invalid={invalid}
      spellCheck={false}
      autoCapitalize="none"
      onKeyDown={caps}
      onKeyUp={caps}
      {...rest}
      onBlur={(e) => {
        onCaps?.(false);
        rest.onBlur?.(e);
      }}
      trailing={
        <button
          type="button"
          className="pw-toggle"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={shown ? 'off' : 'on'}
              initial={{ opacity: 0, rotate: -20, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 20, scale: 0.8 }}
              transition={{ duration: 0.14 }}
              style={{ display: 'grid' }}
            >
              <Icon name={shown ? 'eyeOff' : 'eye'} size={20} />
            </motion.span>
          </AnimatePresence>
        </button>
      }
    />
  );
});
