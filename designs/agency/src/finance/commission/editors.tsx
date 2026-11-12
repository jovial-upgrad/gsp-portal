import { useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { MultiPick } from '../../components/MultiPick';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { COUNTRIES } from '../../data/partners';
import { numOf, numText } from './parts';
import { catalogue } from './store';
import { ADDL_KINDS, ADDL_WHEN, BONUS_PER, COMM_LEVELS, PROMO_COMBINES, UNI_COUNTED_PER, YES_NO, type Addl, type AddlKind, type BandBonus, type BonusScheme, type Cond, type CountBand, type Level, type Milestone, type Promo, type RateRow } from './model';

/*
 * Structured editors for the terms forms (Jovial, 11 Nov: clean forms, easy to understand). Each rule is a row of
 * fields with dropdowns fed by the data (the university's levels, courses and campuses; countries and Settings' region
 * groups; intake months), never a line of typed syntax. They edit the same records the engine reads.
 */

let seq = 0;
export const newRowId = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

/** What a condition can be chosen from, for one university (or every university, on a group). */
export type CondOpts = { levels: string[]; courses: string[]; campuses: string[]; regions: string[]; intakes: { value: string; label: string }[] };
const MONTH = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
/** Intake months from last January to the end of the year after next (a calendar, not data). */
const intakeMonths = (today: string) => {
  const y = +today.slice(0, 4);
  const out: { value: string; label: string }[] = [];
  for (let yy = y - 1; yy <= y + 2; yy++) for (let m = 1; m <= 12; m++) {
    const v = `${yy}-${String(m).padStart(2, '0')}`;
    out.push({ value: v, label: MONTH(v) });
  }
  return out;
};
export function condOpts(unis: string[] | null, levels: readonly string[], groups: Record<string, string[]>, today: string): CondOpts {
  const cs = catalogue().filter((c) => !unis || unis.includes(c.uni));
  return {
    levels: [...levels],
    courses: [...new Set(cs.map((c) => c.name))].sort(),
    campuses: [...new Set(cs.map((c) => c.campus).filter(Boolean))].sort(),
    regions: [...Object.keys(groups), ...COUNTRIES.map((c) => c.name)],
    intakes: intakeMonths(today),
  };
}

/** A rule's card: its title, Remove, and its fields in a grid that folds to one column on a phone. */
export function RuleCard({ title, onRemove, removeLabel, children }: { title: ReactNode; onRemove: () => void; removeLabel: string; children: ReactNode }) {
  return (
    <div className="crule">
      <div className="crule__head">
        <span className="crule__title">{title}</span>
        <button type="button" className="icon-btn" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="crule__grid">{children}</div>
    </div>
  );
}
export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="btn btn--secondary btn--sm iadd crule__add" onClick={onClick}>
      <Icon name="plus" size={16} /> {children}
    </button>
  );
}
/** A section of a form: a heading, what it's for, and its fields. */
export function FormSec({ title, note, children }: { title: string; note?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <div className="cform__sec">
        <h3 className="cform__sech">{title}</h3>
        {note && <p className="cform__secnote">{note}</p>}
      </div>
      {children}
    </>
  );
}
/** A rule list: its cards, an empty line when there are none, and the Add button. */
export function RuleList({ id, empty, add, onAdd, error, children }: { id: string; empty: string; add: string; onAdd: () => void; error?: string | null; children: ReactNode[] }) {
  return (
    <div className="crules" id={id}>
      {children.length ? children : <p className="cmuted crules__empty">{empty}</p>}
      {error && (
        <p className="field__msg field__msg--error" role="alert">
          {error}
        </p>
      )}
      <AddButton onClick={onAdd}>{add}</AddButton>
    </div>
  );
}

const opts = (xs: readonly string[]) =>
  xs.map((x) => (
    <option key={x} value={x}>
      {x}
    </option>
  ));
/** % or an amount, then the number: one control pair used by every rule. */
function KindValue({ id, label, kind, value, cur, onKind, onValue, invalid }: { id: string; label: string; kind: AddlKind; value: number | null; cur: string; onKind: (k: AddlKind) => void; onValue: (n: number | null) => void; invalid?: boolean }) {
  return (
    <>
      <Field id={`${id}-k`} label="Paid as" required>
        <SelectInput id={`${id}-k`} value={kind} onChange={(e) => onKind(e.target.value as AddlKind)}>
          {ADDL_KINDS.map((k) => (
            <option key={k} value={k}>
              {k === '%' ? '% of the fee' : `An amount${cur ? ` (${cur})` : ''}`}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field id={`${id}-v`} label={label} required>
        <TextInput id={`${id}-v`} inputMode="decimal" value={numText(value)} invalid={invalid} onChange={(e) => onValue(numOf(e.target.value))} />
      </Field>
    </>
  );
}

/* ---------- conditions ---------- */

const COND_KINDS = [
  { key: 'levels', label: 'Program levels' },
  { key: 'courses', label: 'Courses' },
  { key: 'campuses', label: 'Campuses' },
  { key: 'regions', label: 'Students from' },
  { key: 'intakes', label: 'Intake months' },
  { key: 'from', label: 'Intakes from' },
  { key: 'to', label: 'Intakes to' },
] as const;
type CondKey = (typeof COND_KINDS)[number]['key'];
/** Drops empty conditions before saving. */
export const cleanCond = (c?: Cond): Cond => Object.fromEntries(Object.entries(c ?? {}).filter(([, v]) => (Array.isArray(v) ? v.length : !!v))) as Cond;
/** Who a rule covers: everyone, unless conditions are added (each one a dropdown, or a date). */
export function CondEditor({ id, value, onChange, o }: { id: string; value: Cond | undefined; onChange: (c: Cond) => void; o: CondOpts }) {
  const c = value ?? {};
  const on = COND_KINDS.filter((k) => k.key in c);
  const left = COND_KINDS.filter((k) => !(k.key in c));
  const set = (k: CondKey, v: unknown) => onChange({ ...c, [k]: v });
  const drop = (k: CondKey) => {
    const n = { ...c };
    delete n[k];
    onChange(n);
  };
  const list = (k: CondKey): string[] => (k === 'levels' ? o.levels : k === 'courses' ? o.courses : k === 'campuses' ? o.campuses : k === 'regions' ? o.regions : o.intakes.map((x) => x.label));
  return (
    <div className="ccond" id={id}>
      <span className="ccond__lead">{on.length ? 'Only for' : 'Applies to every student. Add a condition to narrow it.'}</span>
      {on.map((k) => (
        <div key={k.key} className="ccond__row">
          <span className="ccond__label">{k.label}</span>
          {k.key === 'from' || k.key === 'to' ? (
            <TextInput id={`${id}-${k.key}`} aria-label={k.label} type="date" value={(c[k.key] as string) ?? ''} onChange={(e) => set(k.key, e.target.value)} />
          ) : (
            <MultiPick
              id={`${id}-${k.key}`}
              label={k.label}
              value={k.key === 'intakes' ? (c.intakes ?? []).map(MONTH) : ((c[k.key] as string[] | undefined) ?? [])}
              // values saved earlier stay on the list even when the catalogue no longer has them
              options={[...new Set([...(k.key === 'intakes' ? (c.intakes ?? []).map(MONTH) : ((c[k.key] as string[] | undefined) ?? [])), ...list(k.key)])]}
              onChange={(x) => set(k.key, k.key === 'intakes' ? x.map((l) => o.intakes.find((i) => i.label === l)?.value ?? l) : k.key === 'levels' ? (x as Level[]) : x)}
              empty="Choose"
              search={list(k.key).length > 10}
            />
          )}
          <button type="button" className="icon-btn" aria-label={`Remove the condition ${k.label}`} onClick={() => drop(k.key)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      {left.length > 0 && (
        <SelectInput id={`${id}-add`} aria-label="Add a condition" placeholder="Add a condition" value="" className="ccond__add" onChange={(e) => e.target.value && set(e.target.value as CondKey, e.target.value === 'from' || e.target.value === 'to' ? '' : [])}>
          {left.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </SelectInput>
      )}
    </div>
  );
}

/* ---------- rate rows ---------- */

export const rateRowBad = (r: RateRow) => (!(r.level || r.course || r.campus || r.region || r.period) ? 'Choose what it matches.' : r.period && !/^\d+(\+|-\d+)?$/.test(r.period) ? 'Study period: a number, like 1, 2+ or 1-2.' : !((r.pct ?? r.amt ?? 0) > 0) ? 'Enter the rate or amount.' : r.pct != null && r.pct > 100 ? 'A rate up to 100%.' : null);
export function RateRowsEditor({ id, rows, onChange, o, cur, tried }: { id: string; rows: RateRow[]; onChange: (r: RateRow[]) => void; o: CondOpts; cur: string; tried: boolean }) {
  const up = (i: number, p: Partial<RateRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const any = (k: 'level' | 'course' | 'campus' | 'region', label: string, xs: string[], i: number, r: RateRow) => (
    <Field id={`${id}-${k}-${i}`} label={label} optional>
      <SelectInput id={`${id}-${k}-${i}`} placeholder="Any" allowEmpty value={(r[k] as string) ?? ''} onChange={(e) => up(i, { [k]: e.target.value || undefined } as Partial<RateRow>)}>
        {/* a value saved earlier stays on the list even when the catalogue no longer has it */}
        {opts(r[k] && !xs.includes(r[k] as string) ? [r[k] as string, ...xs] : xs)}
      </SelectInput>
    </Field>
  );
  return (
    <RuleList id={id} empty="No rate rows: the rates by level apply to everyone." add="Add rate row" onAdd={() => onChange([...rows, { pct: null, amt: null }])} error={tried ? rows.map(rateRowBad).find(Boolean) : null}>
      {rows.map((r, i) => {
        const kind: AddlKind = r.amt != null ? 'Amount' : '%';
        return (
          <RuleCard key={i} title={`Rate row ${i + 1}`} removeLabel={`Remove rate row ${i + 1}`} onRemove={() => onChange(rows.filter((_, j) => j !== i))}>
            {any('level', 'Program level', o.levels, i, r)}
            {any('course', 'Course', o.courses, i, r)}
            {any('campus', 'Campus', o.campuses, i, r)}
            {any('region', 'Students from', o.regions, i, r)}
            <Field id={`${id}-period-${i}`} label="Study period" optional hint="Like 1, 2+ or 1-2. Empty: every period.">
              <TextInput id={`${id}-period-${i}`} value={r.period ?? ''} onChange={(e) => up(i, { period: e.target.value.trim() || undefined })} />
            </Field>
            <KindValue id={`${id}-rate-${i}`} label={kind === '%' ? 'Rate (%)' : `Amount${cur ? ` (${cur})` : ''}`} kind={kind} value={kind === '%' ? r.pct : r.amt} cur={cur} invalid={tried && !!rateRowBad(r)} onKind={(k) => up(i, k === '%' ? { pct: r.amt, amt: null } : { amt: r.pct, pct: null })} onValue={(n) => up(i, kind === '%' ? { pct: n } : { amt: n })} />
          </RuleCard>
        );
      })}
    </RuleList>
  );
}

/* ---------- band bonuses ---------- */

export const bandBonusBad = (b: BandBonus, bands: number) => (!(b.band >= 1 && b.band <= bands) ? 'Choose a band.' : !(b.value > 0) ? 'Enter the bonus.' : null);
export function BandBonusEditor({ id, items, bands, onChange, cur, tried }: { id: string; items: BandBonus[]; bands: number; onChange: (b: BandBonus[]) => void; cur: string; tried: boolean }) {
  const up = (i: number, p: Partial<BandBonus>) => onChange(items.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const nums = Array.from({ length: bands }, (_, k) => String(k + 1));
  return (
    <RuleList id={id} empty={bands ? 'No band bonuses.' : 'Add tier bands first.'} add="Add band bonus" onAdd={() => bands && onChange([...items, { band: Math.min(bands, (items[items.length - 1]?.band ?? 0) + 1), kind: 'Amount', value: NaN }])} error={tried ? items.map((b) => bandBonusBad(b, bands)).find(Boolean) : null}>
      {items.map((b, i) => (
        <RuleCard key={i} title={`Band ${b.band} bonus`} removeLabel={`Remove band bonus ${i + 1}`} onRemove={() => onChange(items.filter((_, j) => j !== i))}>
          <Field id={`${id}-band-${i}`} label="Band" required>
            <SelectInput id={`${id}-band-${i}`} value={String(b.band)} onChange={(e) => up(i, { band: +e.target.value })}>
              {opts(nums)}
            </SelectInput>
          </Field>
          <KindValue id={`${id}-v-${i}`} label={b.kind === '%' ? '% of the first-year fee, per student' : `Per student${cur ? ` (${cur})` : ''}`} kind={b.kind} value={b.value} cur={cur} invalid={tried && !!bandBonusBad(b, bands)} onKind={(kind) => up(i, { kind })} onValue={(n) => up(i, { value: n ?? NaN })} />
        </RuleCard>
      ))}
    </RuleList>
  );
}

/* ---------- promotions ---------- */

export const promoBad = (p: Promo) => (!p.name.trim() ? 'Name the promotion.' : !((p.pct ?? p.amt ?? 0) > 0) ? 'Enter the promotion’s rate or amount.' : null);
export function PromosEditor({ id, items, onChange, o, cur, tried }: { id: string; items: Promo[]; onChange: (p: Promo[]) => void; o: CondOpts; cur: string; tried: boolean }) {
  const up = (i: number, p: Partial<Promo>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <RuleList id={id} empty="No promotions." add="Add promotion" onAdd={() => onChange([...items, { id: newRowId('pr'), name: '', pct: null, amt: null, combine: PROMO_COMBINES[0], cond: {} }])} error={tried ? items.map(promoBad).find(Boolean) : null}>
      {items.map((p, i) => {
        const kind: AddlKind = p.amt != null ? 'Amount' : '%';
        return (
          <RuleCard key={p.id} title={p.name || `Promotion ${i + 1}`} removeLabel={`Remove promotion ${i + 1}`} onRemove={() => onChange(items.filter((_, j) => j !== i))}>
            <Field id={`${id}-name-${i}`} label="Name" required className="crule__wide">
              <TextInput id={`${id}-name-${i}`} placeholder="Like: India promotion 2027" value={p.name} invalid={tried && !p.name.trim()} onChange={(e) => up(i, { name: e.target.value })} />
            </Field>
            <KindValue id={`${id}-rate-${i}`} label={kind === '%' ? 'Rate (%)' : `Amount${cur ? ` (${cur})` : ''}`} kind={kind} value={kind === '%' ? p.pct : p.amt} cur={cur} invalid={tried && !((p.pct ?? p.amt ?? 0) > 0)} onKind={(k) => up(i, k === '%' ? { pct: p.amt, amt: null } : { amt: p.pct, pct: null })} onValue={(n) => up(i, kind === '%' ? { pct: n } : { amt: n })} />
            <Field id={`${id}-comb-${i}`} label="With the base rate" required hint="Highest wins: the higher of the two. Replaces the rate: always this one. Additional line: paid on top, as its own line.">
              <SelectInput id={`${id}-comb-${i}`} value={p.combine} onChange={(e) => up(i, { combine: e.target.value as Promo['combine'] })}>
                {opts(PROMO_COMBINES)}
              </SelectInput>
            </Field>
            <div className="crule__wide">
              <CondEditor id={`${id}-cond-${i}`} value={p.cond} o={o} onChange={(cond) => up(i, { cond })} />
            </div>
          </RuleCard>
        );
      })}
    </RuleList>
  );
}

/* ---------- additional commission ---------- */

export const addlBad = (a: Addl) => (!a.desc.trim() ? 'Describe the additional commission.' : !(a.value > 0) ? 'Enter the additional commission’s amount or %.' : null);
export function AddlEditor({ id, items, onChange, o, cur, tried }: { id: string; items: Addl[]; onChange: (a: Addl[]) => void; o: CondOpts; cur: string; tried: boolean }) {
  const up = (i: number, p: Partial<Addl>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <RuleList id={id} empty="No additional commission." add="Add additional commission" onAdd={() => onChange([...items, { id: newRowId('ad'), desc: '', kind: ADDL_KINDS[0], value: NaN, when: ADDL_WHEN[0], cond: {} }])} error={tried ? items.map(addlBad).find(Boolean) : null}>
      {items.map((a, i) => (
        <RuleCard key={a.id} title={a.desc || `Additional commission ${i + 1}`} removeLabel={`Remove additional commission ${i + 1}`} onRemove={() => onChange(items.filter((_, j) => j !== i))}>
          <Field id={`${id}-d-${i}`} label="What it’s for" required className="crule__wide">
            <TextInput id={`${id}-d-${i}`} placeholder="Like: Service fee" value={a.desc} invalid={tried && !a.desc.trim()} onChange={(e) => up(i, { desc: e.target.value })} />
          </Field>
          <KindValue id={`${id}-v-${i}`} label={a.kind === '%' ? 'Rate (%)' : `Amount${cur ? ` (${cur})` : ''}`} kind={a.kind} value={a.value} cur={cur} invalid={tried && !(a.value > 0)} onKind={(kind) => up(i, { kind })} onValue={(n) => up(i, { value: n ?? NaN })} />
          <Field id={`${id}-w-${i}`} label="Earned" required>
            <SelectInput id={`${id}-w-${i}`} value={a.when} onChange={(e) => up(i, { when: e.target.value as Addl['when'] })}>
              {opts(ADDL_WHEN)}
            </SelectInput>
          </Field>
          <div className="crule__wide">
            <CondEditor id={`${id}-cond-${i}`} value={a.cond} o={o} onChange={(cond) => up(i, { cond })} />
          </div>
        </RuleCard>
      ))}
    </RuleList>
  );
}

/* ---------- bonus schemes (GSP's own) ---------- */

export const schemeBad = (b: BonusScheme) =>
  !b.name.trim() ? 'Name the bonus scheme.' : b.per === 'By count' ? (!b.bands.length || b.bands.some((x) => !(x.value > 0) || !(x.from >= 1)) ? 'Add the counts and the bonus for each.' : null) : !(b.value > 0) ? 'Enter the bonus.' : b.per === 'At a number' && !((b.threshold ?? 0) >= 1) ? 'Enter the number of students.' : null;
export function SchemesEditor({ id, items, onChange, o, cur, tried, countedLabel }: { id: string; items: BonusScheme[]; onChange: (b: BonusScheme[]) => void; o: CondOpts; cur: string; tried: boolean; countedLabel: string }) {
  const up = (i: number, p: Partial<BonusScheme>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <RuleList id={id} empty="No bonus schemes." add="Add bonus scheme" onAdd={() => onChange([...items, { id: newRowId('bs'), name: '', per: BONUS_PER[0], kind: 'Amount', value: NaN, threshold: null, bands: [], retro: true, perCountry: false, cond: {} }])} error={tried ? items.map(schemeBad).find(Boolean) : null}>
      {items.map((b, i) => (
        <RuleCard key={b.id} title={b.name || `Bonus scheme ${i + 1}`} removeLabel={`Remove bonus scheme ${i + 1}`} onRemove={() => onChange(items.filter((_, j) => j !== i))}>
          <Field id={`${id}-name-${i}`} label="Name" required className="crule__wide">
            <TextInput id={`${id}-name-${i}`} placeholder="Like: Volume bonus 2027" value={b.name} invalid={tried && !b.name.trim()} onChange={(e) => up(i, { name: e.target.value })} />
          </Field>
          <Field id={`${id}-per-${i}`} label="Paid" required hint="Per student: on every student. At a number: once, on the student who reaches it. By count: per student, by how many enrol.">
            <SelectInput id={`${id}-per-${i}`} value={b.per} onChange={(e) => up(i, { per: e.target.value as BonusScheme['per'] })}>
              {opts(BONUS_PER)}
            </SelectInput>
          </Field>
          {b.per === 'At a number' && (
            <Field id={`${id}-n-${i}`} label="Students" required>
              <TextInput id={`${id}-n-${i}`} inputMode="numeric" value={numText(b.threshold)} invalid={tried && !((b.threshold ?? 0) >= 1)} onChange={(e) => up(i, { threshold: numOf(e.target.value) })} />
            </Field>
          )}
          {b.per !== 'By count' ? (
            <KindValue id={`${id}-v-${i}`} label={b.kind === '%' ? '% of the first-year fee' : `Bonus${cur ? ` (${cur})` : ''}`} kind={b.kind} value={b.value} cur={cur} invalid={tried && !(b.value > 0)} onKind={(kind) => up(i, { kind })} onValue={(n) => up(i, { value: n ?? NaN })} />
          ) : (
            <div className="crule__wide">
              <CountBands id={`${id}-cb-${i}`} bands={b.bands} cur={cur} onChange={(bands) => up(i, { bands })} />
            </div>
          )}
          <Field id={`${id}-cp-${i}`} label="Counted per" optional hint={`Empty: ${countedLabel}.`}>
            <SelectInput id={`${id}-cp-${i}`} placeholder={`As the terms (${countedLabel})`} allowEmpty value={b.countedPer ?? ''} onChange={(e) => up(i, { countedPer: (e.target.value || undefined) as BonusScheme['countedPer'] })}>
              {opts(UNI_COUNTED_PER)}
            </SelectInput>
          </Field>
          <Field id={`${id}-retro-${i}`} label="Retrospective" required hint="Yes: students who enrolled before the number was reached get it too.">
            <SelectInput id={`${id}-retro-${i}`} value={b.retro ? 'Yes' : 'No'} onChange={(e) => up(i, { retro: e.target.value === 'Yes' })}>
              {opts(YES_NO)}
            </SelectInput>
          </Field>
          <Field id={`${id}-pc-${i}`} label="Counted per source country" required>
            <SelectInput id={`${id}-pc-${i}`} value={b.perCountry ? 'Yes' : 'No'} onChange={(e) => up(i, { perCountry: e.target.value === 'Yes' })}>
              {opts(YES_NO)}
            </SelectInput>
          </Field>
          <div className="crule__wide">
            <CondEditor id={`${id}-cond-${i}`} value={b.cond} o={o} onChange={(cond) => up(i, { cond })} />
          </div>
        </RuleCard>
      ))}
    </RuleList>
  );
}
function CountBands({ id, bands, cur, onChange }: { id: string; bands: CountBand[]; cur: string; onChange: (b: CountBand[]) => void }) {
  const up = (i: number, p: Partial<CountBand>) => onChange(bands.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="ccount" id={id}>
      {bands.map((x, i) => (
        <div key={i} className="ccount__row">
          <Field id={`${id}-f-${i}`} label="From (students)" required>
            <TextInput id={`${id}-f-${i}`} inputMode="numeric" value={numText(x.from)} onChange={(e) => up(i, { from: numOf(e.target.value) ?? NaN })} />
          </Field>
          <Field id={`${id}-t-${i}`} label="To" optional>
            <TextInput id={`${id}-t-${i}`} inputMode="numeric" placeholder="and above" value={numText(x.to)} onChange={(e) => up(i, { to: numOf(e.target.value) })} />
          </Field>
          <KindValue id={`${id}-v-${i}`} label={x.kind === '%' ? '% per student' : `Per student${cur ? ` (${cur})` : ''}`} kind={x.kind} value={x.value} cur={cur} onKind={(kind) => up(i, { kind })} onValue={(n) => up(i, { value: n ?? NaN })} />
          <button type="button" className="icon-btn ccount__x" aria-label={`Remove count ${i + 1}`} onClick={() => onChange(bands.filter((_, j) => j !== i))}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      <AddButton onClick={() => onChange([...bands, { from: bands.length ? (bands[bands.length - 1].to ?? bands[bands.length - 1].from) + 1 : 1, to: null, value: NaN, kind: 'Amount' }])}>Add a count</AddButton>
    </div>
  );
}

/* ---------- notice milestones ---------- */

export const milestoneBad = (m: Milestone) => (!(m.count >= 1) ? 'Enter the number of enrolments.' : !(m.amount > 0) ? 'Enter the milestone’s amount.' : null);
export function MilestonesEditor({ id, items, onChange, tried }: { id: string; items: Milestone[]; onChange: (m: Milestone[]) => void; tried: boolean }) {
  const up = (i: number, p: Partial<Milestone>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <RuleList id={id} empty="No milestones yet." add="Add milestone" onAdd={() => onChange([...items, { count: NaN, amount: NaN }])} error={tried ? (items.length ? items.map(milestoneBad).find(Boolean) : 'Add at least one milestone.') : null}>
      {items.map((m, i) => (
        <RuleCard key={i} title={`Milestone ${i + 1}`} removeLabel={`Remove milestone ${i + 1}`} onRemove={() => onChange(items.filter((_, j) => j !== i))}>
          <Field id={`${id}-n-${i}`} label="Enrolments GSP is paid for" required>
            <TextInput id={`${id}-n-${i}`} inputMode="numeric" value={numText(m.count)} invalid={tried && !(m.count >= 1)} onChange={(e) => up(i, { count: numOf(e.target.value) ?? NaN })} />
          </Field>
          <Field id={`${id}-a-${i}`} label="Lump sum (university’s currency)" required>
            <TextInput id={`${id}-a-${i}`} inputMode="decimal" value={numText(m.amount)} invalid={tried && !(m.amount > 0)} onChange={(e) => up(i, { amount: numOf(e.target.value) ?? NaN })} />
          </Field>
        </RuleCard>
      ))}
    </RuleList>
  );
}

/** Intake months, picked from a calendar list (a notice's Intake months). */
export function IntakePick({ id, label, value, onChange, today }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void; today: string }) {
  const [ms] = useState(() => intakeMonths(today));
  return <MultiPick id={id} label={label} value={value.map(MONTH)} options={ms.map((m) => m.label)} onChange={(x) => onChange(x.map((l) => ms.find((m) => m.label === l)?.value ?? l))} empty="Every intake" search />;
}
export { COMM_LEVELS };
