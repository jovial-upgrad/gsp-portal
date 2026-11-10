/**
 * The fee and dates commission is worked out from (Jovial, 9 Nov), in an application's Key details for GSP's roles:
 * the student's tuition fee and scholarship a year, the day the course starts, and a date per study period the
 * university pays on, for the trigger its terms use (Census date, Enrolment confirmed on, Fees paid on). The
 * application's Admissions officer fills them in; nothing is assumed, and the application can't be Student enrolled
 * until the ones commission needs are in (`enrolBlock`). Each change is logged on the application.
 *
 * Jovial, 10 Nov (the sandbox's inputs): what some universities pay on, shown only when the terms need it: the campus,
 * later years' fees, units (name, fee, census) for a per-unit payer, fee payments for an each-payment payer, credit
 * points a year, the student type (Australia) and a leave of absence. Study period 1's census date starts from the
 * course intake's (D6); a census date left empty is estimated (start + Settings' weeks). Who entered the fee, and when,
 * is kept (D7). GSP's roles only: the RP never sees any of this.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditOnly } from '../../proto/viewOnly';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { money } from '../../data/courses';
import { blankFees, courseOf, type AppFees, type Application } from '../../data/applications';
import { feesMissing } from './engine';
import { PAY_UNITS, TRIGGERS, dayText } from './model';
import { SelectInput } from '../../components/forms';
import { plusDays } from './pricing';
import { commState, intakeCensus, termsForCourse, useComm } from './store';

/** Why the application can't be Student enrolled yet (empty: it can). */
export function enrolBlock(a: Pick<Application, 'courseId' | 'fees'>): string {
  const { terms } = termsForCourse(a.courseId);
  const miss = feesMissing({ fees: a.fees }, terms);
  if (!miss.length) return '';
  const list = miss.length === 1 ? miss[0] : `${miss.slice(0, -1).join(', ')} and ${miss[miss.length - 1]}`;
  return `Add the ${list} in Key details first: commission is worked out from them.`;
}

/**
 * D27 (Jovial, 10 Nov): moving an application back from Student enrolled is blocked once any of its commission lines is
 * kept (invoiced, requested or paid); before that its lines simply stop (the enrolment is undone).
 */
export function leaveBlock(a: Pick<Application, 'id' | 'status'>, to: string): string {
  if (a.status !== 'enrolled' || to === 'enrolled' || !to) return '';
  const kept = Object.values(commState().frozen).filter((f) => f.app === a.id);
  return kept.length ? `${kept.length} commission ${kept.length === 1 ? 'line is' : 'lines are'} already invoiced or paid, so the application stays at Student enrolled. Ask Finance to adjust the lines instead.` : '';
}

type Kind = 'money' | 'date' | 'text' | 'number' | 'lines' | 'select';
/** The study period dates the university's trigger needs, as Key details shows them. */
function datesWanted(courseId: string) {
  const { terms, periods } = termsForCourse(courseId);
  const trig = TRIGGERS.find((t) => t.label === terms?.trigger) ?? TRIGGERS[0];
  return { trig, periods };
}

const unitsText = (u: AppFees['units'] = []) => u.map((x) => `${x.name}; ${x.fee}; ${x.census}`).join('\n');
const paysText = (p: AppFees['feePayments'] = []) => p.map((x) => `${x.date}; ${x.amount}`).join('\n');
const parseUnits = (t: string) => {
  const rows = t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(';').map((x) => x.trim()));
  return rows.every((r) => r.length === 3 && r[0] && Number(r[1]) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r[2])) ? rows.map((r) => ({ name: r[0], fee: Number(r[1]), census: r[2] })) : null;
};
const parsePays = (t: string) => {
  const rows = t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(';').map((x) => x.trim()));
  return rows.every((r) => r.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && Number(r[1]) > 0) ? rows.map((r) => ({ date: r[0], amount: Number(r[1]) })) : null;
};

export function FeeRows({ a, me, currency, update, log, say }: { a: Application; me?: string; currency: string; update: (fn: (a: Application) => Application) => void; log: (text: string) => void; say: (m: string) => void }) {
  const st = useComm(); // the university's terms can change while the page is open
  const f = a.fees ?? blankFees();
  const { trig, periods } = datesWanted(a.courseId);
  const { terms } = termsForCourse(a.courseId);
  const course = courseOf(a);
  const set = (p: Partial<AppFees>, line: string) => {
    update((x) => ({ ...x, fees: { ...(x.fees ?? blankFees()), ...p } }));
    log(line);
    say(`${line}.`);
  };
  // D7: who entered the fee and when, shown on the line's working and on Raise invoice
  const setFee = (p: Partial<AppFees>, line: string) => set({ ...p, feeBy: { by: me ?? '', at: Date.now() } }, line);
  // D6: study period 1's census date starts from the course intake's, when the Institution team keeps one
  const fromIntake = trig.field === 'census' && terms?.trigger === 'Census date' ? intakeCensus(a.courseId, a.intake) : '';
  useEffect(() => {
    if (!fromIntake || f.census[0]) return;
    update((x) => {
      const fx = x.fees ?? blankFees();
      if (fx.census[0]) return x;
      return { ...x, fees: { ...fx, census: [fromIntake, ...fx.census.slice(1)] }, history: [...x.history, { at: Date.now(), who: 'gsp', text: `Census date for study period 1 started from the course intake: ${dayText(fromIntake)}`, by: me ?? '' }] };
    });
  }, [fromIntake]); // eslint-disable-line react-hooks/exhaustive-deps
  const est = (k: number) => {
    // an empty census date is estimated from the study period's start (Settings' weeks); shown, never saved
    if (trig.field !== 'census' || !f.start || !terms) return '';
    const months = 12 / Math.max(1, PAY_UNITS.find((x) => x.label === terms.payUnit)?.per || 1);
    const start = new Date(`${f.start}T00:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() + Math.round(months * k));
    const weeks = terms.trigger === 'Withdrawal deadline' ? terms.triggerWeeks ?? st.settings.fallbackWeeks : st.settings.fallbackWeeks;
    return plusDays(start.toISOString().slice(0, 10), weeks * 7);
  };
  const years = Math.max(1, Math.ceil((course.months ?? 12) / 12));
  const unit = terms?.payUnit;
  const charge = terms?.charge.unit;
  const isAU = course.uni.country === 'Australia';
  const campuses = course.uni.campuses.map((c) => c.name);
  const setDate = (k: number, v: string) => {
    const list = [...f[trig.field]];
    while (list.length <= k) list.push('');
    list[k] = v;
    set({ [trig.field]: list } as Partial<AppFees>, `Set the ${trig.date.toLowerCase()} for study period ${k + 1} to ${dayText(v)}`);
  };
  return (
    <>
      <FeeRow id="fee" k="Tuition fee a year" kind="money" currency={currency} value={f.tuition} note={f.feeBy?.by ? `Entered by ${f.feeBy.by}, ${dayText(new Date(f.feeBy.at).toISOString().slice(0, 10))}` : undefined} onSave={(n) => setFee({ tuition: n as number }, `Set the tuition fee to ${money(n as number, currency)} a year`)} />
      <FeeRow id="schol" k="Scholarship a year" kind="money" currency={currency} zero value={f.scholarship} onSave={(n) => setFee({ scholarship: n as number }, `Set the scholarship to ${money(n as number, currency)} a year`)} />
      {years > 1 &&
        Array.from({ length: years - 1 }, (_, i) => (
          <FeeRow key={`y${i}`} id={`yfee-${i}`} k={`Tuition fee, year ${i + 2}`} kind="money" currency={currency} value={f.yearFees?.[i + 1] ?? null} note="Empty: the same as year 1." onSave={(n) => {
            const list = [...(f.yearFees ?? [])];
            while (list.length <= i + 1) list.push(null);
            list[i + 1] = n as number;
            setFee({ yearFees: list }, `Set the year ${i + 2} tuition fee to ${money(n as number, currency)}`);
          }} />
        ))}
      {campuses.length > 1 && <FeeRow id="campus" k="Campus" kind="select" options={campuses} value={f.campus ?? null} onSave={(v) => set({ campus: v as string }, `Set the campus to ${v}`)} />}
      {isAU && st.settings.studentTypes.length > 0 && <FeeRow id="stype" k="Student type" kind="select" options={st.settings.studentTypes} value={f.studentType ?? null} onSave={(v) => set({ studentType: v as string }, `Set the student type to ${v}`)} />}
      {charge === 'Credit points' && <FeeRow id="points" k="Credit points a year" kind="number" value={f.points ?? null} onSave={(n) => set({ points: n as number }, `Set the credit points to ${n} a year`)} />}
      {unit === 'Per unit' && <FeeRow id="units" k="Units (name; fee; census date)" kind="lines" value={unitsText(f.units) || null} hint="One a line, like: ACC101; 3200; 2027-03-31" onSave={(v) => { const u = parseUnits(v as string); if (u) set({ units: u }, `Set ${u.length} ${u.length === 1 ? 'unit' : 'units'} of study`); }} validate={(v) => !!parseUnits(v)} />}
      {unit === 'Each fee payment' && <FeeRow id="pays" k="Fee payments (date; amount)" kind="lines" value={paysText(f.feePayments) || null} hint="One a line, like: 2027-02-15; 12500" onSave={(v) => { const p = parsePays(v as string); if (p) set({ feePayments: p }, `Set ${p.length} fee ${p.length === 1 ? 'payment' : 'payments'}`); }} validate={(v) => !!parsePays(v)} />}
      <FeeRow id="leave-from" k="Leave of absence from" kind="date" value={f.leave?.from || null} onSave={(v) => set({ leave: { from: v as string, to: f.leave?.to ?? '' } }, `Set a leave of absence from ${dayText(v as string)}`)} />
      {f.leave?.from && <FeeRow id="leave-to" k="Leave of absence to" kind="date" value={f.leave?.to || null} onSave={(v) => set({ leave: { from: f.leave!.from, to: v as string } }, `Set the leave of absence to end ${dayText(v as string)}`)} />}
      <FeeRow id="start" k="Course starts" kind="date" value={f.start || null} onSave={(v) => set({ start: v as string }, `Set the course start date to ${dayText(v as string)}`)} />
      {Array.from({ length: periods }, (_, k) =>
        trig.field === 'confirmed' && k === 0 ? null : (
          <FeeRow key={k} id={`trig-${k}`} k={periods > 1 ? `${trig.date}, study period ${k + 1}` : trig.date} kind="date" value={f[trig.field][k] || null} note={!f[trig.field][k] && est(k) ? `Estimated ${dayText(est(k))} until it’s added` : undefined} onSave={(v) => setDate(k, v as string)} />
        ),
      )}
    </>
  );
}

/** A Key details line Admissions fills in: the value (or Not added yet) with a pencil, then a field with Save and Cancel. */
function FeeRow({ id, k, kind, value, currency, zero, onSave, note, hint, options = [], validate }: { id: string; k: string; kind: Kind; value: number | string | null; currency?: string; zero?: boolean; onSave: (v: number | string) => void; note?: string; hint?: string; options?: string[]; validate?: (v: string) => boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  const empty = value === null || value === '';
  const shown: ReactNode = empty ? (
    <span className="muted">Not added yet</span>
  ) : kind === 'money' ? (
    <span className="num">{money(value as number, currency ?? '')}</span>
  ) : kind === 'date' ? (
    <span className="num">{dayText(value as string)}</span>
  ) : kind === 'lines' ? (
    <span className="num cpre">{String(value)}</span>
  ) : (
    <span>{String(value)}</span>
  );
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
    if (kind === 'text' || kind === 'select' || kind === 'lines') {
      if (!v.trim() || (validate && !validate(v))) return setBad(true);
      if (v !== value) onSave(kind === 'lines' ? v : v.trim());
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
              {kind === 'select' ? (
                <SelectInput id={`gfee-${id}`} value={v} placeholder="Choose" invalid={bad} onChange={(e) => (setV(e.target.value), setBad(false))}>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </SelectInput>
              ) : kind === 'lines' ? (
                <textarea id={`gfee-${id}`} className="control__input num" rows={3} value={v} aria-invalid={bad || undefined} aria-describedby={hint ? `gfee-${id}-hint` : undefined} onChange={(e) => (setV(e.target.value), setBad(false))} />
              ) : (
                <input
                  ref={ref}
                  id={`gfee-${id}`}
                  className="control__input num"
                  type={kind === 'date' ? 'date' : 'text'}
                  inputMode={kind === 'money' || kind === 'number' ? 'numeric' : undefined}
                  value={v}
                  aria-invalid={bad || undefined}
                  aria-describedby={bad ? `gfee-${id}-err` : undefined}
                  onChange={(e) => {
                    setV(e.target.value);
                    setBad(false);
                  }}
                />
              )}
            </span>
            {bad && (
              <span id={`gfee-${id}-err`} className="gedit__err" role="alert">
                {kind === 'date' ? 'Pick a date.' : kind === 'select' ? 'Choose one.' : kind === 'lines' ? hint ?? 'Check each line.' : kind === 'number' ? 'Enter a number.' : zero ? 'Enter the amount as a number (0 for none).' : 'Enter the fee as a number.'}
              </span>
            )}
            {hint && !bad && (
              <span id={`gfee-${id}-hint`} className="muted">
                {hint}
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
            {note && <span className="iw-sub">{note}</span>}
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
