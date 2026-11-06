import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { EditOnly } from '../../proto/viewOnly';
import { shortDate } from '../../data/dates';
import { Facts, Pill, Section } from '../../institution/records/parts';
import { RP_CYCLES, RP_PLANS, agreementsOf, type OpsRp, type RpCommission } from './data';

/** Until GSP · Finance saves terms: the standard plan, a 70% share paid monthly, held while no agreement is accepted. */
export const rpCommissionOf = (r: OpsRp): RpCommission =>
  r.commission ?? { plan: 'Standard', share: 70, cycle: 'Monthly', hold: !agreementsOf(r).active, holdWhy: agreementsOf(r).active ? undefined : 'No accepted agreement yet' };

/**
 * A recruitment partner's commission (GSP · Finance, 6 Nov), the one tab Finance changes on a partner: the plan, the
 * partner's share of the university's commission, how often it's paid, the statements email (from its details),
 * tax ID and bank account, and whether payouts are on hold (and why). Edit opens the fields in place; Save goes to Logs.
 */
export function RpCommissionTab({ r, update, say, me }: { r: OpsRp; update: (fn: (r: OpsRp) => OpsRp) => void; say: (m: string) => void; me: string }) {
  const c = rpCommissionOf(r);
  const [v, setV] = useState<RpCommission | null>(null);
  const [tried, setTried] = useState(false);
  const shareBad = !!v && !(v.share >= 0 && v.share <= 100);
  const holdBad = !!v && v.hold && !v.holdWhy?.trim();
  const save = () => {
    setTried(true);
    if (!v || shareBad || holdBad) return;
    update((x) => ({ ...x, commission: { ...v, by: me, at: Date.now() }, log: [...x.log, { at: Date.now(), what: `Commission terms changed by ${me}: ${v.plan}, ${v.share}% ${v.cycle.toLowerCase()}${v.hold ? ', payouts on hold' : ''}` }] }));
    setV(null);
    setTried(false);
    say('Commission terms saved.');
  };
  const masked = (x?: string) => (x ? `•••• ${x.replace(/\s+/g, '').slice(-4)}` : undefined);
  return (
    <Section
      title="Commission"
      id="orp-com"
      action={
        !v && (
          <EditOnly>
            <Button variant="secondary" iconLeft={<Icon name="edit" size={18} />} onClick={() => setV({ ...c })}>
              Edit<span className="vh"> the commission terms</span>
            </Button>
          </EditOnly>
        )
      }
    >
      {!v ? (
        <Facts
          items={[
            ['Payouts', c.hold ? <Pill key="h" tone="bad">On hold</Pill> : <Pill key="h" tone="ok">Paying</Pill>],
            ['Plan', c.plan],
            ['Partner’s share', <span key="s" className="num">{c.share}% of the university’s commission</span>],
            ['Paid', c.cycle],
            ['Statements to', r.cemail],
            ['Tax ID', c.tax && <span key="t" className="num">{c.tax}</span>],
            ['Bank account', masked(c.bank)],
            ...(c.hold ? ([['Why on hold', c.holdWhy, 'wide']] as [string, string | undefined, 'wide'][]) : []),
            ['Last changed', c.by ? `${c.by}, ${shortDate(new Date(c.at!))}` : 'The standard terms: not changed yet'],
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
            <Field id="orp-com-plan" label="Plan" required>
              <SelectInput id="orp-com-plan" value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value as RpCommission['plan'] })}>
                {RP_PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="orp-com-share" label="Partner’s share (%)" required error={tried && shareBad ? 'Enter a share from 0 to 100.' : null}>
              <TextInput id="orp-com-share" inputMode="decimal" value={Number.isFinite(v.share) ? String(v.share) : ''} invalid={tried && shareBad} onChange={(e) => setV({ ...v, share: e.target.value.trim() === '' ? NaN : Number(e.target.value) })} />
            </Field>
            <Field id="orp-com-cycle" label="Paid" required>
              <SelectInput id="orp-com-cycle" value={v.cycle} onChange={(e) => setV({ ...v, cycle: e.target.value as RpCommission['cycle'] })}>
                {RP_CYCLES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="orp-com-tax" label="Tax ID" optional>
              <TextInput id="orp-com-tax" value={v.tax ?? ''} placeholder="Like 29ABCDE1234F1Z5" onChange={(e) => setV({ ...v, tax: e.target.value || undefined })} />
            </Field>
            <Field id="orp-com-bank" label="Bank account number" optional hint="Shown with only its last four digits.">
              <TextInput id="orp-com-bank" value={v.bank ?? ''} inputMode="numeric" onChange={(e) => setV({ ...v, bank: e.target.value || undefined })} />
            </Field>
            <div className="acom__wide">
              <Switch id="orp-com-hold" checked={v.hold} onChange={(hold) => setV({ ...v, hold })}>
                Hold payouts
              </Switch>
            </div>
            {v.hold && (
              <Field id="orp-com-why" label="Why on hold" required className="acom__wide" error={tried && holdBad ? 'Say why payouts are on hold.' : null}>
                <TextInput id="orp-com-why" value={v.holdWhy ?? ''} invalid={tried && holdBad} placeholder="Like: the signed agreement is with GSP" onChange={(e) => setV({ ...v, holdWhy: e.target.value })} />
              </Field>
            )}
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
