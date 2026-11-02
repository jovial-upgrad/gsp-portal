import { useMemo } from 'react';
import { COUNTRIES, TOP_MARKETS } from '../data/partners';
import { SelectMenu } from './SelectMenu';
import './phone.css';

/** Dial code + number. The code follows the country picked above but can be changed. */
export function PhoneInput({
  id,
  dial,
  number,
  onDial,
  onNumber,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string;
  dial: string;
  number: string;
  onDial: (v: string) => void;
  onNumber: (v: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const options = useMemo(() => {
    const top = TOP_MARKETS.map((n) => COUNTRIES.find((c) => c.name === n)!);
    const rest = COUNTRIES.filter((c) => !TOP_MARKETS.includes(c.name)).sort((a, b) => a.name.localeCompare(b.name));
    return [
      ...top.map((c) => ({ value: c.dial, label: c.name, note: c.dial, group: 'Where most partners are' })),
      ...rest.map((c) => ({ value: c.dial, label: c.name, note: c.dial, group: 'All countries' })),
    ];
  }, []);

  return (
    <div className={`control phone ${invalid ? 'is-invalid' : ''}`}>
      <div className="phone__dial">
        {/* the portal's own list, searchable (Jovial, 2 Nov: no system UI) */}
        <SelectMenu
          bare
          className="phone__pick"
          value={dial}
          label="Country code"
          ariaLabel="Country code"
          options={options}
          minWidth={300}
          search
          onChange={onDial}
          render={() => <span className="phone__code num">{dial || 'Code'}</span>}
        />
      </div>
      <input
        id={id}
        className="control__input"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="Mobile number"
        value={number}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onNumber(e.target.value.replace(/[^\d\s-]/g, ''))}
        onBlur={onBlur}
      />
    </div>
  );
}
