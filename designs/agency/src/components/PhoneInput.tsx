import { useMemo } from 'react';
import { COUNTRIES, TOP_MARKETS } from '../data/partners';
import { Icon } from './Icon';
import { SelectInput } from './forms';
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
    return { top, rest };
  }, []);

  return (
    <div className={`control phone ${invalid ? 'is-invalid' : ''}`}>
      {/* the dial code: the product's dropdown, its list as wide as the whole phone field */}
      <SelectInput
        aria-label="Country code"
        value={dial}
        onChange={(e) => onDial(e.target.value)}
        wrapClass="phone__dial"
        btnClass="phone__btn"
        nativeClass="phone__select"
        anchorTo=".phone"
        minListWidth={300}
        noChevron
        display={() => (
          <>
            <span className="phone__code num">{dial}</span>
            <Icon name="chevronDown" size={16} className="phone__chev" />
          </>
        )}
      >
          <optgroup label="Where most partners are">
            {options.top.map((c) => (
              <option key={c.iso} value={c.dial}>
                {c.name} {c.dial}
              </option>
            ))}
          </optgroup>
          <optgroup label="All countries">
            {options.rest.map((c) => (
              <option key={c.iso} value={c.dial}>
                {c.name} {c.dial}
              </option>
            ))}
          </optgroup>
      </SelectInput>
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
