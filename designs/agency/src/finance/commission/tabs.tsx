import { useMemo } from 'react';
import { Facts, Section } from '../../institution/records/parts';
import { CURRENCY } from '../../data/courses';
import { fullName, type Student } from '../../data/students';
import type { Application } from '../../data/applications';
import { DocLine, SetupButton, StatusPill, TxTable } from './parts';
import { compute, settleAll, noticeStatus, totalsText, type Item } from './engine';
import { ctxOf, ctxUnis, enrolmentsOf, useComm } from './store';
import { LEVELS, addlText, bandsText, benefitText, bonusCondition, dayText, money, pct, type CommState, type Notice } from './model';
import { todayIso } from '../../institution/data/records';

/** Where a notice applies: its destinations, universities and program levels, or every course. */
export const appliesText = (n: Notice) => {
  const names = n.unis.map((u) => ctxUnis().find((x) => x.id === u)?.name ?? u);
  const all = [...n.dests, ...names, ...n.levels];
  return all.length ? all.join(', ') : 'Every course';
};
const last4 = (n: string) => `····${n.replace(/\s+/g, '').slice(-4)}`;

/**
 * A recruitment partner's Commission tab, GSP side (Jovial, 9 Nov): what the RP earns, for every GSP team that sees
 * the tab. Read only: its agreement (with its details as fields and the document to preview), the notices it's on, and
 * how it's paid, as the RP set it on Earnings. Commissions changes it in Setup.
 */
export function RpCommissionTab({ rp }: { rp: { id: string; name: string } }) {
  const s = useComm();
  const rec = s.records.find((r) => r.rp === rp.id);
  const ag = rec && s.agreements.find((a) => a.id === rec.agreement);
  const bank = s.banks.find((b) => b.rp === rp.id);
  const notices = s.notices.filter((n) => n.rps.includes(rp.id));
  const today = todayIso();
  if (!rec || !ag)
    return (
      <Section title="Commission" id="crp-none" action={<SetupButton tab="rps" open={`new:${rp.id}`}>Add RP record</SetupButton>}>
        <p className="iempty">No commission record yet.</p>
      </Section>
    );
  return (
    <>
      <Section title="Agreement" id="crp-ag" note={`Set by ${rec.updated.by} on ${dayText(new Date(rec.updated.at).toISOString())}`} action={<SetupButton tab="rps" open={rp.id} />}>
        <Facts
          items={[
            ['Agreement', ag.name],
            ['From', <span key="f" className="num">{dayText(rec.from)}</span>],
            ...(ag.shareType === 'Flat'
              ? ([['Share', `${pct(ag.share ?? 0)} of GSP’s commission`]] as [string, string][])
              : ([
                  ['Share', `By enrolments: ${bandsText(ag.bands)}`],
                  ['Counted per', ag.countedPer],
                ] as [string, string][])),
            ['Retrospective', ag.retro ? 'Yes' : 'No'],
            ['Additional commission passed on', ag.addl === null ? 'The same as the share' : pct(ag.addl)],
            ['Bonus', ag.bonuses.length ? ag.bonuses.map((b) => `${b.desc}: ${b.amount.toLocaleString('en-GB')} in the university’s currency, ${b.when === 'Every enrolment' ? 'on every enrolment' : `on enrolment ${b.nth}, counted per ${ag.countedPer.toLowerCase()}`}`).join('; ') : 'None', 'wide'],
            ['Pay within', `${ag.payDays} days of GSP receiving the accepted invoice`],
            ['Agreement details', ag.details, 'wide'],
            ['Agreement document', <DocLine key="d" file={ag.doc} label={ag.name} />, 'wide'],
          ]}
        />
      </Section>
      <Section title="Notices" id="crp-notices">
        {notices.length ? (
          <ul className="cnotes">
            {notices.map((n) => (
              <li key={n.id}>
                <div className="cnotes__top">
                  <span className="cnotes__name">{n.name}</span>
                  <span className="dpill idpill--grey">{noticeStatus(n, today)}</span>
                </div>
                <Facts
                  items={[
                    ['Period', `${dayText(n.starts)} to ${dayText(n.ends)}`],
                    ['Applies to', appliesText(n)],
                    ['Benefit', benefitText(n)],
                    ['Notice document', <DocLine key="d" file={n.doc} label={n.name} />, 'wide'],
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="iempty">No notices</p>
        )}
      </Section>
      <Section title="Payment" id="crp-pay" note="As the RP set them on Earnings.">
        <Facts
          items={[
            ['Bank account', bank ? <span key="b" className="num">{`${bank.bank} ${last4(bank.number)}`}</span> : 'Not added yet'],
            ['Bank currency', bank ? bank.currency : 'Not added yet'],
            ['Payee name', bank ? bank.account : 'Not added yet'],
            ['Registered for tax', rec.tax ? 'Yes' : 'No'],
          ]}
        />
      </Section>
    </>
  );
}

/** Everything a university's terms say, as fields: its Commission tab, and Setup's form when read only. */
export function termsFacts(t: CommState['terms'][number], cur: string): ([string, React.ReactNode] | [string, React.ReactNode, 'wide'])[] {
  const levels = LEVELS.filter((l) => t.rates[l] !== undefined);
  const fixed = LEVELS.filter((l) => t.fixed[l] !== undefined);
  return [
    ['Rates by program level', levels.length ? levels.map((l) => `${l} ${pct(t.rates[l]!)}`).join(', ') : 'None', 'wide'],
    ['Fee basis', t.feeBasis],
    ['Fixed amounts', fixed.length ? fixed.map((l) => `${l} ${money(t.fixed[l]!, cur)}`).join(', ') : 'None'],
    ['Trigger', t.trigger],
    ['Instalments', `${t.inst} ${t.inst === 1 ? 'study period' : 'study periods'}`],
    ['Pay within', `${t.payDays} days of GSP’s invoice`],
    ['Cap per student', t.cap === null ? 'None' : money(t.cap, cur)],
    ['Tier bands', t.bands.length ? bandsText(t.bands) : 'None'],
    ['Additional commission', t.addl.length ? t.addl.map((a) => addlText(a, cur)).join('; ') : 'None', 'wide'],
    ['Bonus', t.bonus.length ? `${t.bonus.map((b) => `${b.desc}: ${money(b.amount, cur)} ${bonusCondition(b)}`).join('; ')}. GSP’s alone: no RP gets a share.` : 'None', 'wide'],
    ['Notes', t.notes, 'wide'],
  ];
}

/**
 * A university's Commission tab (Jovial, 9 Nov), for every team that can see the university: its terms as fields,
 * with the currency on every amount, and the contract to preview, so nobody needs Setup or the contract.
 */
export function UniCommissionTab({ uni }: { uni: { id: string; name: string; country: keyof typeof CURRENCY } }) {
  const s = useComm();
  const t = s.terms.find((x) => x.uni === uni.id);
  const cur = CURRENCY[uni.country];
  if (!t)
    return (
      <Section title="Commission terms" id="cuni-none" action={<SetupButton tab="terms" open={`new:${uni.id}`}>Add University terms</SetupButton>}>
        <p className="iempty">No commission terms yet. Commissions enters them before the university goes live.</p>
      </Section>
    );
  return (
    <Section title="Commission terms" id="cuni" note={`What ${uni.name} pays GSP, in ${cur}. Last saved by ${t.updated.by} on ${dayText(new Date(t.updated.at).toISOString())}.`} action={<SetupButton tab="terms" open={uni.id} />}>
      <Facts items={[...termsFacts(t, cur), ['Contract', <DocLine key="c" file={t.contract} label={`${uni.name}: contract`} />, 'wide']]} />
    </Section>
  );
}

/** One commission item: its totals, then its transactions. */
function ItemCard({ item, rp, rpView }: { item: Item; rp?: boolean; rpView?: boolean }) {
  const s = useComm();
  // the RP never sees GSP's rate, GSP's amount or its share of GSP's commission (9 Nov)
  const note = item.side === 'uni' ? 'What the university pays GSP.' : rpView ? 'What GSP pays you for this application, line by line.' : 'What GSP pays the RP: its share of each of the university’s lines, and its own bonuses.';
  return (
    <Section title={item.label} id={`citem-${item.side}`} note={note}>
      {item.note ? (
        <p className="iempty">{item.note}</p>
      ) : (
        <>
          <dl className="citem__sum">
            <div>
              <dt>{item.side === 'uni' ? 'Total expected' : 'Total the RP earns'}</dt>
              <dd className="num">{totalsText(item.totals)}</dd>
            </div>
            <div>
              <dt>{item.side === 'uni' ? 'Received so far' : 'Paid so far'}</dt>
              <dd className="num">{totalsText(item.settled)}</dd>
            </div>
          </dl>
          <TxTable txs={item.txs} rp={rp} rpView={rpView} caption={item.label} amountNote={rp ? `To question an amount, email ${s.settings.disputeEmail} with the transaction ID.` : undefined} />
        </>
      )}
    </Section>
  );
}

/**
 * An application's Commission tab (Jovial, 9 Nov): the money on one application, as two commission items, University →
 * GSP and GSP → RP, each with its transactions. GSP's roles see both; the RP (`rpOnly`) sees only GSP → RP.
 */
export function AppCommissionTab({ a, s, rpOnly }: { a: Application; s: Student; rpOnly?: boolean }) {
  const st = useComm();
  // with each line's ID and, once acted on, as it was kept (the portal keeps them in the store)
  const res = useMemo(() => {
    const extra = enrolmentsOf([a], [s]);
    return compute(settleAll(st, ctxOf(), extra), ctxOf(), extra);
  }, [st, a, s]);
  const lines = res.byApp.get(a.id);
  if (!lines)
    return (
      <Section title="Commission" id="capp-none">
        <p className="iempty">Commission is worked out once {fullName(s)} enrols.</p>
      </Section>
    );
  return (
    <>
      {!rpOnly && <ItemCard item={lines.uniItem} />}
      <ItemCard item={lines.rpItem} rp rpView={rpOnly} />
    </>
  );
}

export { StatusPill };
