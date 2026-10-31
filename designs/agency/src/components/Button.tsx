import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './button.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'link';
  size?: 'md' | 'sm';
  loading?: boolean;
  block?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, iconLeft, iconRight, children, className = '', disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''}${loading ? ' is-loading' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : iconLeft}
      <span className="btn__label">{children}</span>
      {!loading && iconRight}
    </button>
  );
});
