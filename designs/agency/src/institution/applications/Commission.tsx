import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { EditOnly } from '../../proto/viewOnly';
import { COMMISSION_STATUSES, earnFor, type AppCommission, type Application, type CommissionStatus } from '../../data/applications';
import { shortDate } from '../../data/dates';
import { money } from '../../data/courses';
import { Facts, Pill, Section, type Tone } from '../records/parts';
import { GSP_USER } from '../user';

const TONE: Record<CommissionStatus, Tone> = { 'Not due': 'grey', Due: 'you', Claimed: 'gsp', Invoiced: 'uni', Paid: 'ok', 'On hold': 'bad', 'Not payable': 'grey' };

/** Until GSP · Finance saves one: the course's base commission, due once the student enrols, nothing if it closed. */
export const commissionOf = (a: Application): AppCommission =>
  a.commission ?? { status: a.status === 'enrolled' ? 'Due' : a.status === 'closed' ? 'Not payable' : 'Not due', amount: earnFor(a).amount };

const day = (iso?: string) => (iso ? shortDate(new Date(iso)) : undefined);

/**
 * An application's commission (GSP · Finance, 6 Nov), the one thing Finance changes on an application: where it is
 * (Not due, Due, Claimed, Invoiced, Paid, On hold, Not payable), the amount, the invoice and its dates, and a note.
 * Edit opens the fields in place; Save writes it to the application's Logs.
 */
export function CommissionTab({ a, update, say }: { a: Application; update: (fn: (a: Application) => Application) => void; say: (m: string) => void }) {
  const c = commissionOf(a);
  const cur = earnFor(a).currency;
  const [v, setV] = useState<AppCommission | null>(null);
  const [tried, setTried] = useState(false);
  const bad = v && (!(v.amount >= 0) || ((v.status === 'Invoiced' || v.status === 'Paid') && !v.invoice?.trim()) || (v.status === 'Paid' && !v.paid));
  const save = () => {
    setTried(true);
    if (!v || bad) return;
    const by = GSP_USER.name;
    update((x) => ({ ...x, commission: { ...v, by, at: Date.now() }, history: [...x.history, { at: Date.now(), who: 'gsp', by, text: `Commission: ${v.status}, ${money(v.amount, cur)}${v.invoice ? `, invoice ${v.invoice}` : ''}` }] }));
    setV(null);
    setTried(false);
    say('Commission saved.');
  };
  return (
    <Section
      title="Commission"
      id="acom"
      action={
        !v && (
          <EditOnly>
            <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setV({ ...c })}>
              Edit<span className="vh"> the commission</span>
            </Button>
          </EditOnly>
        )
      }
    >
      {!v ? (
        <Facts
          items={[
            ['Status', <Pill key="s" tone={TONE[c.status]}>{c.status}</Pill>],
            ['Commission', <span key="a" className="num">{money(c.amount, cur)}</span>],
            ['Base commission', <span key="b" className="num">{earnFor(a).text}</span>],
            ['Invoice', c.invoice && <span key="i" className="num">{c.invoice}</span>],
            ['Invoiced on', day(c.invoiced)],
            ['Paid on', day(c.paid)],
            ['Note', c.note, 'wide'],
            ['Last changed', c.by ? `${c.by}, ${shortDate(new Date(c.at!))}` : 'Not changed yet: worked out from the course'],
          ]}
        />
      ) : (
        <form
          className="acom__form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="acom__grid">
            <Field id="acom-status" label="Status" required>
              <SelectInput id="acom-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as CommissionStatus })}>
                {COMMISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="acom-amount" label={`Commission (${cur})`} required error={tried && !(v.amount >= 0) ? 'Enter the commission, as a number.' : null}>
              <TextInput id="acom-amount" inputMode="decimal" value={Number.isFinite(v.amount) ? String(v.amount) : ''} invalid={tried && !(v.amount >= 0)} onChange={(e) => setV({ ...v, amount: e.target.value.trim() === '' ? NaN : Number(e.target.value.replace(/,/g, '')) })} />
            </Field>
            <Field id="acom-invoice" label="Invoice number" optional={v.status !== 'Invoiced' && v.status !== 'Paid'} required={v.status === 'Invoiced' || v.status === 'Paid'} error={tried && (v.status === 'Invoiced' || v.status === 'Paid') && !v.invoice?.trim() ? 'Enter the invoice number.' : null}>
              <TextInput id="acom-invoice" value={v.invoice ?? ''} placeholder="Like INV-2026-0418" invalid={tried && (v.status === 'Invoiced' || v.status === 'Paid') && !v.invoice?.trim()} onChange={(e) => setV({ ...v, invoice: e.target.value })} />
            </Field>
            <Field id="acom-invoiced" label="Invoiced on" optional>
              <TextInput id="acom-invoiced" type="date" value={v.invoiced ?? ''} onChange={(e) => setV({ ...v, invoiced: e.target.value || undefined })} />
            </Field>
            <Field id="acom-paid" label="Paid on" optional={v.status !== 'Paid'} required={v.status === 'Paid'} error={tried && v.status === 'Paid' && !v.paid ? 'Enter the date it was paid.' : null}>
              <TextInput id="acom-paid" type="date" value={v.paid ?? ''} invalid={tried && v.status === 'Paid' && !v.paid} onChange={(e) => setV({ ...v, paid: e.target.value || undefined })} />
            </Field>
            <Field id="acom-note" label="Note" optional className="acom__wide">
              <TextInput id="acom-note" value={v.note ?? ''} placeholder="Like: held until the census date" onChange={(e) => setV({ ...v, note: e.target.value })} />
            </Field>
          </div>
          <div className="acom__acts">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setV(null);
                setTried(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      )}
    </Section>
  );
}
