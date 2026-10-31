import { Logo } from './Logo';
import './brand-lockup.css';

/** The portal's brand: the upGrad GSP logo, a thin vertical line, then "Partner Portal" (or another label) on two lines. */
export function BrandLockup({ height = 34, label = ['Partner', 'Portal'] }: { height?: number; label?: [string, string] }) {
  return (
    <span className="lockup" style={{ ['--lockup-h' as string]: `${height}px` }}>
      <Logo height={height} />
      <span className="lockup__rule" aria-hidden="true" />
      <span className="lockup__label">
        <span>{label[0]}</span>
        <span>{label[1]}</span>
      </span>
    </span>
  );
}
