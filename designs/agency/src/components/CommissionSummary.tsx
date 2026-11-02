// @ts-nocheck -- reads Finance's terms (typed with the finance API)
/**
 * Commission on the institution partner and RP records (Jovial, 1 Nov): a read-only summary of the terms Finance
 * keeps in Commissions, which stays the only place they're edited. The RP's bank details can be changed here by
 * RP Ops and Finance; the change goes to Finance to verify against the bank letter, and payouts hold.
 */
import { useState } from 'react';
import { useStore } from '../finance/store';
import { UNI_TERMS } from '../data/dataset';
import { BankSheet } from '../finance/Earnings';
import { Button } from './Button';

const LEVEL = { UG: 'Undergraduate', PG: 'Postgraduate', DIP: 'Diploma', VET: 'VET', SA: 'Study Abroad', ELICOS: 'English (ELICOS)', RES: 'Research', FDN: 'Foundation' };
const TRIG = { census: 'At the census date', enrolment: 'At enrolment', invoice: 'When invoiced' };
const nice = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** The universities under an institution partner, each with Finance's terms. */
export function IpCommission({ unis }: { unis: { id: string; name: string }[] }) {
  const cfg = useStore((s) => s.comm.cfg);
  const rows = unis.map((u) => ({ u, t: cfg.unis.find((x) => x.id === (UNI_TERMS[u.id] ?? u.id)) }));
  if (!rows.length) return <p className="iempty">No universities under this partner yet.</p>;
  return (
    <div className="csum">
      <p className="csum__note">Read only. Finance enters and changes these in Commissions, and a second person checks each change.</p>
      {rows.map(({ u, t }) => (
        <div key={u.id} className="csum__item">
          <p className="csum__name">{u.name}</p>
          {t ? (
            <dl className="cdl">
              <div className="cdl__row"><dt>Rates</dt><dd>{Object.entries(t.levels || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${LEVEL[k] || k} ${v}%`).join(' · ') || 'Fixed amounts'}</dd></div>
              <div className="cdl__row"><dt>Earned</dt><dd>{TRIG[t.trigger] || t.trigger}{t.inst > 1 ? `, in ${t.inst} instalments` : ''}</dd></div>
              <div className="cdl__row"><dt>University pays within</dt><dd>{t.payDays} days of the invoice</dd></div>
              <div className="cdl__row"><dt>Agreement ends</dt><dd>{nice(t.ends)}</dd></div>
              <div className="cdl__row"><dt>Status</dt><dd>{t.status || 'Active'}</dd></div>
            </dl>
          ) : (
            <p className="iempty">No terms in Commissions yet: Finance has a task to enter them.</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** An RP's terms and bank details. `canBank`: RP Ops and Finance may change the bank details. */
export function RpCommission({ name, canBank }: { name: string; canBank: boolean }) {
  const cfg = useStore((s) => s.comm.cfg);
  const [bank, setBank] = useState(false);
  const rp = cfg.rps.find((r) => r.name === name);
  if (!rp) return <p className="iempty">No RP terms in Commissions: Finance’s default share ({cfg.settings?.defaultShare ?? 70}%) applies.</p>;
  const sc = cfg.schemes.find((x) => x.id === rp.scheme);
  const share = sc ? `${sc.name}${sc.bands ? `: ${sc.bands.map(([a, b, p]) => `${a}${b ? `–${b}` : '+'} students ${p}%`).join(', ')}` : ''}` : rp.flat != null ? `${rp.flat}% of GSP’s commission` : `Finance’s default (${cfg.settings?.defaultShare ?? 70}%)`;
  return (
    <div className="csum">
      <p className="csum__note">Read only. Finance sets the RP’s share in Commissions.</p>
      <dl className="cdl">
        <div className="cdl__row"><dt>Share</dt><dd>{share}</dd></div>
        <div className="cdl__row"><dt>Paid in</dt><dd>{rp.cur}{rp.gst ? ', plus GST' : ''}</dd></div>
        <div className="cdl__row"><dt>Bank account</dt><dd>{rp.bank === 'AU' ? 'Australian account' : 'Local account'}{rp.bankLast4 ? ` ending ••${rp.bankLast4}` : ' on file'} · {rp.bankVerified === false ? 'new details waiting for Finance to verify; payouts held' : 'verified'}</dd></div>
      </dl>
      {canBank && <Button variant="secondary" onClick={() => setBank(true)}>Change bank details</Button>}
      {bank && <BankSheet rp={rp} user={{ id: 'gsp', name: 'GSP' }} onClose={() => setBank(false)} />}
    </div>
  );
}
