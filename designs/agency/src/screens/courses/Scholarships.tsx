import type { Scholarship } from '../../data/courses';

const num = (n: number) => n.toLocaleString('en-GB');
/** "AUD 2,450 to 11,200", "AUD 10,000", "10% to 25% of tuition", "5% of tuition", as GSP · Institution writes it. */
export const amountText = (s: Scholarship) =>
  s.amountType === 'Percentage'
    ? s.low === s.high
      ? `${s.high}% of tuition`
      : `${s.low}% to ${s.high}% of tuition`
    : `${s.currency} ${s.low === s.high ? num(s.high) : `${num(s.low)} to ${num(s.high)}`}`;
const all = (list: string[], what: string) => (list.length ? list.join(', ') : `All ${what}`);

/**
 * The course's scholarships, in every role's course dialog (4 Nov), each as GSP · Institution's card on the
 * university's page shows it: how much in green, its name, who it's for and its description, to read only.
 */
export function ScholarshipCards({ list }: { list: Scholarship[] }) {
  return (
    <ul className="cs-schols">
      {list.map((s) => (
        <li key={s.id} className="cs-schol">
          <p className="cs-schol__amt">{amountText(s)}</p>
          <h4 className="cs-schol__name">{s.name}</h4>
          <dl className="cs-schol__facts">
            <div>
              <dt>Students from</dt>
              <dd>{all(s.from, 'countries')}</dd>
            </div>
            <div>
              <dt>Program levels</dt>
              <dd>{all(s.levels, 'levels')}</dd>
            </div>
            <div>
              <dt>Study areas</dt>
              <dd>{all(s.areas, 'areas')}</dd>
            </div>
          </dl>
          {s.description && <p className="cs-schol__desc">{s.description}</p>}
        </li>
      ))}
    </ul>
  );
}
