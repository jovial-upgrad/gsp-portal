import { useId } from 'react';
import { UPGRAD_PATHS } from './upgradPaths';

/**
 * Stacked lockup: the official upGrad wordmark with "GSP" below it in the logo gradient.
 * The "GSP" line is set in the UI font as a stand-in until the logo is redrawn as final vector art.
 */
export function Logo({ height = 40, title = 'upGrad GSP' }: { height?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 159 71"
      height={height}
      width={(height * 159) / 71}
      role="img"
      aria-label={title}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`gsp-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--gsp-1)" />
          <stop offset="0.38" stopColor="var(--gsp-2)" />
          <stop offset="0.72" stopColor="var(--gsp-3)" />
          <stop offset="1" stopColor="var(--gsp-4)" />
        </linearGradient>
      </defs>
      <g fill="var(--logo-red)">
        {UPGRAD_PATHS.map((d) => (
          <path key={d.slice(0, 16)} d={d} />
        ))}
      </g>
      <text
        x="159"
        y="70"
        textAnchor="end"
        textLength="82"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Figtree, var(--font-sans)"
        fontWeight="800"
        fontSize="44"
        letterSpacing="-1"
        fill={`url(#gsp-${id})`}
      >
        GSP
      </text>
    </svg>
  );
}
