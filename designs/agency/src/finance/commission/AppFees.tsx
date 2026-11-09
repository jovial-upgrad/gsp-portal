/**
 * The fee and dates commission is worked out from (Jovial, 9 Nov), in an application's Key details for GSP's roles:
 * the student's tuition fee and scholarship a year, the day the course starts, and a date per study period the
 * university pays on, for the trigger its terms use (Census date, Enrolment confirmed on, Tuition paid on). The
 * application's Admissions officer fills them in; nothing is assumed, and the application can't be Student enrolled
 * until the ones commission needs are in (`enrolBlock`). Each change is logged on the application.
 */
import { useRef, useState, type ReactNode } from 'react';
import { EditOnly } from '../../proto/viewOnly';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { money } from '../../data/courses';
import { blankFees, type AppFees, type Application } from '../../data/applications';
import { feesMissing } from './engine';
import { TRIGGERS, dayText } from './model';
import { termsForCourse, useComm } from './store';

/** Why the application can't be Student enrolled yet (empty: it can). */
export function enrolBlock(a: Pick<Application, 'courseId' | 'fees'>): string {
  const { terms } = termsForCourse(a.courseId);
  const miss = feesMissing({ fees: a.fees }, terms);
  if (!miss.length) return '';
  const list = miss.length === 1 ? miss[0] : `${miss.slice(0, -1).join(', ')} and ${miss[miss.length - 1]}`;
  return `Add the ${list} in Key details first: commission is worked out from them.`;
}

type Kind = 'money' | 'date';
/** The study period dates the university's trigger needs, as Key details shows them. */
function datesWanted(courseId: string) {
  const { terms, periods } = termsForCourse(courseId);
  const trig = TRIGGERS.find((t) => t.label === terms?.trigger) ?? TRIGGERS[0];
  return { trig, periods };
}

export function FeeRows({ a, currency, update, log, say }: { a: Application; currency: string; update: (fn: (a: Application) => Application) => void; log: (text: string) => void; say: (m: string) => void }) {
  useComm(); // the university's terms can change while the page is open
  const f = a.fees ?? blankFees();
  const { trig, periods } = datesWanted(a.courseId);
  const set = (p: Partial<AppFees>, line: string) => {
    update((x) => ({ ...x, fees: { ...(x.fees ?? blankFees()), ...p } }));
    log(line);
    say(`${line}.`);
  };
  const setDate = (k: number, v: string) => {
    const list = [...f[trig.field]];
    while (list.length <= k) list.push('');
    list[k] = v;
    set({ [trig.field]: list } as Partial<AppFees>, `Set the ${trig.date.toLowerCase()} for study period ${k + 1} to ${dayText(v)}`);
  };
  return (
    <>
      <FeeRow id="fee" k="Tuition fee a year" kind="money" currency={currency} value={f.tuition} onSave={(n) => set({ tuition: n as number }, `Set the tuition fee to ${money(n as number, currency)} a year`)} />
      <FeeRow id="schol" k="Scholarship a year" kind="money" currency={currency} zero value={f.scholarship} onSave={(n) => set({ scholarship: n as number }, `Set the scholarship to ${money(n as number, currency)} a year`)} />
      <FeeRow id="start" k="Course starts" kind="date" value={f.start || null} onSave={(v) => set({ start: v as string }, `Set the course start date to ${dayText(v as string)}`)} />
      {Array.from({ length: periods }, (_, k) =>
        trig.field === 'confirmed' && k === 0 ? null : (
          <FeeRow key={k} id={`trig-${k}`} k={periods > 1 ? `${trig.date}, study period ${k + 1}` : trig.date} kind="date" value={f[trig.field][k] || null} onSave={(v) => setDate(k, v as string)} />
        ),
      )}
    </>
  );
}

/** A Key details line Admissions fills in: the value (or Not added yet) with a pencil, then a field with Save and Cancel. */
function FeeRow({ id, k, kind, value, currency, zero, onSave }: { id: string; k: string; kind: Kind; value: number | string | null; currency?: string; zero?: boolean; onSave: (v: number | string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  const empty = value === null || value === '';
  const shown: ReactNode = empty ? <span className="muted">Not added yet</span> : kind === 'money' ? <span className="num">{money(value as number, currency ?? '')}</span> : <span className="num">{dayText(value as string)}</span>;
  const begin = () => {
    setV(empty ? '' : String(value));
    setBad(false);
    setEditing(true);
    window.setTimeout(() => ref.current?.focus(), 30);
  };
  const end = () => {
    setEditing(false);
    window.setTimeout(() => pencil.current?.focus(), 30);
  };
  const save = () => {
    if (kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return setBad(true);
      if (v !== value) onSave(v);
      return end();
    }
    const n = Number(v.replace(/[^\d.]/g, ''));
    if (!v.trim() || !Number.isFinite(n) || n < 0 || (!zero && n === 0) || n > 10_000_000) return setBad(true);
    if (n !== value) onSave(n);
    end();
  };
  return (
    <div className={`cdl__row gedit ${editing ? 'is-editing' : ''}`}>
      <dt>{editing ? <label htmlFor={`gfee-${id}`}>{k}</label> : k}</dt>
      <dd>
        {editing ? (
          <form
            className="gedit__form"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              e.stopPropagation();
              end();
            }}
          >
            <span className={`control gedit__control ${bad ? 'is-invalid' : ''}`}>
              {kind === 'money' && (
                <span className="gedit__cur" aria-hidden="true">
                  {currency}
                </span>
              )}
              <input
                ref={ref}
                id={`gfee-${id}`}
                className="control__input num"
                type={kind === 'date' ? 'date' : 'text'}
                inputMode={kind === 'money' ? 'numeric' : undefined}
                value={v}
                aria-invalid={bad || undefined}
                aria-describedby={bad ? `gfee-${id}-err` : undefined}
                onChange={(e) => {
                  setV(e.target.value);
                  setBad(false);
                }}
              />
            </span>
            {bad && (
              <span id={`gfee-${id}-err`} className="gedit__err" role="alert">
                {kind === 'date' ? 'Pick a date.' : zero ? 'Enter the amount as a number (0 for none).' : 'Enter the fee as a number.'}
              </span>
            )}
            <span className="gedit__acts">
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={end}>
                Cancel
              </Button>
            </span>
          </form>
        ) : (
          <span className="gedit__val">
            {shown}
            <EditOnly>
              <button ref={pencil} type="button" className="scopy gedit__pen" aria-label={`${empty ? 'Add' : 'Edit'} the ${k.toLowerCase()}`} title={`${empty ? 'Add' : 'Edit'} the ${k.toLowerCase()}`} onClick={begin}>
                <Icon name="edit" size={14} />
              </button>
            </EditOnly>
          </span>
        )}
      </dd>
    </div>
  );
}
