import './range.css';

/**
 * A range on one track with two handles (Nesil, 3 Nov: tuition and duration in course search): from and to, each
 * a native range input (arrow keys, Page Up and Down, Home and End), the part between them filled, and both values
 * said above it. The whole range picked means no limit.
 */
export function RangeSlider({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  format: (n: number) => string;
}) {
  const [lo, hi] = value;
  const span = Math.max(1, max - min);
  const at = (n: number) => ((n - min) / span) * 100;
  const whole = lo <= min && hi >= max;
  return (
    <div className="rslider">
      <p className="rslider__v" id={`${id}-v`} aria-live="polite">
        {whole ? 'Any' : `${format(lo)} to ${format(hi)}`}
      </p>
      <div className="rslider__track" style={{ ['--lo' as string]: `${at(lo)}%`, ['--hi' as string]: `${at(hi)}%` }}>
        <span className="rslider__fill" aria-hidden="true" />
        <input
          id={id}
          type="range"
          className="rslider__in"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={`${label}: from`}
          aria-valuetext={format(lo)}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi - step), hi])}
        />
        <input
          id={`${id}-hi`}
          type="range"
          className="rslider__in"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={`${label}: to`}
          aria-valuetext={format(hi)}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
        />
      </div>
      <p className="rslider__ends" aria-hidden="true">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </p>
    </div>
  );
}
