import { useEffect, useState } from 'react';
import { EditOnly } from '../../../proto/viewOnly';
import { Sheet } from '../../../components/Sheet';
import { Button } from '../../../components/Button';
import { Field, SelectInput, TextInput } from '../../../components/forms';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { AREAS, LEVELS, type Area, type Level } from '../../../data/courses';
import { COUNTRIES } from '../../../data/partners';
import { AMOUNT_TYPES, CURRENCIES, type AmountType, type Scholarship, type UniRec } from '../../data/catalogue';
import { AddButton, ErrorText, Section } from '../parts';
import { MultiPick } from '../MultiPick';
import type { Stamp } from '../../data/records';
import type { UniUpd } from '../UniversityPage';

const all = (list: string[], what: string) => (list.length ? list.join(', ') : `All ${what}`);

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);
const num = (n: number) => n.toLocaleString('en-GB');
/** "15% to 25% of tuition", "20% of tuition", "AUD 5,000 to 10,000", "AUD 10,000". */
export const amountText = (s: Scholarship) => {
  const range = s.low === s.high ? num(s.high) : `${num(s.low)} to ${num(s.high)}`;
  return s.amountType === 'Percentage' ? (s.low === s.high ? `${s.high}% of tuition` : `${s.low}% to ${s.high}% of tuition`) : `${s.currency} ${range}`;
};

/**
 * Scholarships (29 Oct, 2nd round): each shows as a card on the university's page that partners see. 29 Oct (7th
 * round): who it's for is picked from dropdowns, and nothing says whether it comes with the offer. 30 Oct: how much is a
 * range, a percentage of tuition or an amount in a currency picked here.
 */
export function Scholarships({ u, upd, say, updated }: { u: UniRec; upd: UniUpd; say: (m: string) => void; updated?: Stamp }) {
  const [form, setForm] = useState<Scholarship | 'new' | null>(null);
  const [removing, setRemoving] = useState<Scholarship | null>(null);
  return (
    <Section title="Scholarships" id="iu-sch" updated={updated} action={<AddButton onClick={() => setForm('new')}>Add a scholarship</AddButton>}>
      {u.scholarships.length ? (
        <ul className="ischs">
          {u.scholarships.map((s) => (
            <li key={s.id} className="isch">
              <p className="isch__amt">{amountText(s)}</p>
              <h3 className="isch__name">{s.name}</h3>
              <dl className="isch__facts">
                <div>
                  <dt>Students from</dt>
                  <dd>{s.from.length ? s.from.join(', ') : 'All countries'}</dd>
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
              {s.description && <p className="isch__cond">{s.description}</p>}
              <div className="isch__acts">
                <EditOnly>
                  <button type="button" className="btn btn--link" onClick={() => setForm(s)}>
                    Edit<span className="vh"> {s.name}</span>
                  </button>
                </EditOnly>
                <EditOnly>
                  <button type="button" className="btn btn--link idanger" onClick={() => setRemoving(s)}>
                    Remove<span className="vh"> {s.name}</span>
                  </button>
                </EditOnly>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="iempty">No scholarships yet.</p>
      )}
      <ScholarshipForm
        s={form}
        onCancel={() => setForm(null)}
        onSave={(s) => {
          upd((x) => ({ ...x, scholarships: x.scholarships.some((y) => y.id === s.id) ? x.scholarships.map((y) => (y.id === s.id ? s : y)) : [...x.scholarships, s] }), `${u.scholarships.some((y) => y.id === s.id) ? 'Changed' : 'Added'} ${s.name}`);
          setForm(null);
          say(`${s.name} saved.`);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? 'this scholarship'}?`}
        confirm="Remove"
        onConfirm={() => {
          if (removing) upd((x) => ({ ...x, scholarships: x.scholarships.filter((y) => y.id !== removing.id) }), `Removed ${removing.name}`);
          say(`${removing?.name} removed.`);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      >
        <p>Partners stop seeing it on the university’s page. Offers that already include it keep it.</p>
      </ConfirmDialog>
    </Section>
  );
}

function ScholarshipForm({ s, onCancel, onSave }: { s: Scholarship | 'new' | null; onCancel: () => void; onSave: (s: Scholarship) => void }) {
  const blank: Scholarship = { id: '', name: '', amountType: 'Percentage', low: 0, high: 0, currency: 'AUD', from: [], levels: [], areas: [], description: '' };
  const [v, setV] = useState<Scholarship>(blank);
  // the range as typed, so a box can be empty while it's being filled in
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!s) return;
    setV(s === 'new' ? { ...blank, id: `sch-${Date.now().toString(36)}` } : s);
    setLow(s === 'new' ? '' : String(s.low));
    setHigh(s === 'new' ? '' : String(s.high));
    setTried(false);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (f: Partial<Scholarship>) => setV((x) => ({ ...x, ...f }));
  const pct = v.amountType === 'Percentage';
  const lo = Number(low);
  const hi = Number(high);
  const err = {
    name: !v.name.trim() ? 'Enter its name.' : null,
    amount: !low || !high ? 'Enter both numbers: the same in both for a fixed amount.' : hi < lo ? 'The second number can’t be less than the first.' : pct && hi > 100 ? 'A percentage goes up to 100.' : !(hi > 0) ? 'Enter how much it’s worth.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Sheet
      open={!!s}
      onClose={onCancel}
      center
      className="iform"
      title={s === 'new' ? 'Add a scholarship' : 'Edit scholarship'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <EditOnly>
              <Button
                onClick={() => {
                  setTried(true);
                  if (!Object.values(err).some(Boolean)) onSave({ ...v, name: v.name.trim(), low: lo, high: hi, description: v.description.trim() });
                }}
              >
                Save
              </Button>
            </EditOnly>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="isch-name" label="Name" required error={show('name')} className="iform__wide">
          <TextInput id="isch-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} placeholder="Like: International Excellence Scholarship" />
        </Field>
        <Field id="isch-type" label="Amount range" required error={show('amount')} hint="Use the same number in both boxes for a fixed amount." className="iform__wide">
          <div className="irange">
            <SelectInput id="isch-type" value={v.amountType} onChange={(e) => set({ amountType: e.target.value as AmountType })}>
              {AMOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
            <label className="irange__k" htmlFor="isch-low">
              From
            </label>
            <TextInput id="isch-low" inputMode="decimal" value={low} invalid={!!show('amount') && !low} onChange={(e) => setLow(e.target.value.replace(/[^\d.]/g, ''))} />
            <label className="irange__k" htmlFor="isch-high">
              to
            </label>
            <TextInput id="isch-high" inputMode="decimal" value={high} invalid={!!show('amount') && (!high || hi < lo)} onChange={(e) => setHigh(e.target.value.replace(/[^\d.]/g, ''))} />
            {pct ? (
              <span className="irange__unit">% of tuition</span>
            ) : (
              <SelectInput id="isch-cur" aria-label="Currency" value={v.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </SelectInput>
            )}
          </div>
        </Field>
        <Field id="isch-from" label="Students from" optional className="iform__wide">
          <MultiPick id="isch-from" label="Students from" value={v.from} options={COUNTRY_NAMES} onChange={(from) => set({ from })} empty="All countries" all="All countries" search />
        </Field>
        <Field id="isch-levels" label="Program levels" optional>
          <MultiPick id="isch-levels" label="Program levels" value={v.levels} options={[...LEVELS]} onChange={(levels) => set({ levels: levels as Level[] })} empty="All levels" all="All levels" />
        </Field>
        <Field id="isch-areas" label="Study areas" optional>
          <MultiPick id="isch-areas" label="Study areas" value={v.areas} options={[...AREAS]} onChange={(areas) => set({ areas: areas as Area[] })} empty="All areas" all="All areas" search />
        </Field>
        <Field id="isch-desc" label="Description" optional className="iform__wide">
          <div className="control iform__area">
            <textarea id="isch-desc" className="control__input" rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="Like: For students with 70% or more in their last qualification" />
          </div>
        </Field>
      </div>
      {tried && Object.values(err).some(Boolean) && <ErrorText>Fill in the name and how much it’s worth.</ErrorText>}
    </Sheet>
  );
}
