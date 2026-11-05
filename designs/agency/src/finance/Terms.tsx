// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Commission terms: universities (from contracts), RP terms, schemes, notices,
 * settings and weekly FX. Every change waits for a second Finance person
 * (maker-checker) and shows what it would do to amounts already in the system.
 */
import { adminCfg } from '../admin/data/store';
import { NOTICE_SOURCES, STUDENT_TYPES } from './defaults';
import React, { useState } from 'react';
import { update, nameOf, getState } from './store';
import { Card, Tabs, Select, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, Num, Chip, toast, fmtAge, NumberInput, DateField } from './kit';
import { NoMatch } from '../institution/records/parts';
import { useCheck, numError, pctError, dateError, afterError, dupError } from '../components/validate';
import { useUnsaved } from '../components/unsaved';
import { nice, money, LEVELS, TRIG, DEST, bandTxt, winName } from './engine';
import { salesRegionNames } from '../admin/data/config';
import { proposeChange, applyChange, impactOf, aud, opsOf, payoutCurOf, settingsOf } from './shared';

const AREAS = [['unis', 'Universities'], ['rps', 'RP terms'], ['schemes', 'Schemes'], ['notices', 'Notices'], ['settings', 'Settings and FX']];
// the currencies: GSP · Admin › Currency exchange, the one source (Jovial, 31 Oct)
const cursNow = () => adminCfg().rates.map(r => r.code);

export default function Terms({ c, user, canEdit }) {
  const [area, setArea] = useState('unis');
  const [edit, setEdit] = useState(null); // { area, item (or null for new) }
  const s = getState();
  const checks = c.checks.filter(k => k.status === 'waiting');
  // one Finance person enters and saves; no second-person check (Jovial, 5 Nov: Commissions flow Q1)
  const propose = (area, id, before, after, summary) => {
    update(d => applyChange(d, { area, target: id, after }), `${user.name} changed ${summary}`);
    toast('Saved', { text: 'It applies straight away, from its effective date.' }); setEdit(null);
  };
  return (
    <>
      <Tabs label="Terms" options={AREAS} value={area} onChange={setArea} />
      {area === 'unis' && <Unis c={c} canEdit={canEdit} onEdit={u => setEdit({ area, item: u })} />}
      {area === 'rps' && <Rps c={c} canEdit={canEdit} onEdit={r => setEdit({ area, item: r })} />}
      {area === 'schemes' && <Schemes c={c} canEdit={canEdit} onEdit={x => setEdit({ area, item: x })} />}
      {area === 'notices' && <Notices c={c} canEdit={canEdit} onEdit={x => setEdit({ area, item: x })} />}
      {area === 'settings' && <Settings c={c} canEdit={canEdit} propose={propose} />}
      {edit && edit.area === 'unis' && <UniSheet ro={!canEdit} c={c} u={edit.item} onClose={() => setEdit(null)} propose={propose} />}
      {edit && edit.area === 'rps' && <RpSheet ro={!canEdit} c={c} r={edit.item} onClose={() => setEdit(null)} propose={propose} />}
      {edit && edit.area === 'schemes' && <SchemeSheet ro={!canEdit} c={c} x={edit.item} onClose={() => setEdit(null)} propose={propose} />}
      {edit && edit.area === 'notices' && <NoticeSheet ro={!canEdit} c={c} x={edit.item} onClose={() => setEdit(null)} propose={propose} />}
      {!canEdit && <p className="muted">Read only. Finance and Admin can change terms.</p>}
    </>
  );
}

/* ---------- maker-checker ---------- */
function Checks({ checks, user, canEdit, selfCheck }) {
  const s = getState();
  const decide = (k, ok) => {
    if (k.maker === user.id && !selfCheck) { toast('You made this change, so someone else must check it.'); return; }
    // a rejection can be undone from the notification (QC, 1 Nov): nothing changed, so it goes back to waiting
    const was = structuredClone(getState().tasks.find(y => y.id === 'T-' + k.id) || null);
    update(d => {
      const x = d.comm.checks.find(y => y.id === k.id); x.status = ok ? 'approved' : 'rejected'; x.checker = user.id; x.checkedAt = Date.now();
      if (ok) applyChange(d, x);
      const t = d.tasks.find(y => y.id === 'T-' + k.id); if (t) { t.status = 'done'; t.doneBy = user.id; t.doneAt = Date.now(); }
    }, `${user.name} ${ok ? 'approved' : 'rejected'} ${k.summary} (made by ${nameOf(s, k.maker)})`);
    if (ok) { toast('Approved. The new terms apply now.'); return; }
    toast('Change rejected', { text: `${k.summary}. Nothing changed.`, undo: () => update(d => {
      const x = d.comm.checks.find(y => y.id === k.id); x.status = 'waiting'; delete x.checker; delete x.checkedAt;
      const t = d.tasks.findIndex(y => y.id === 'T-' + k.id); if (t >= 0 && was) d.tasks[t] = was;
    }, `${user.name} undid the rejection of ${k.summary}`) });
  };
  return (
    <Card flush>
      <div className="gspx-pad"><h2 className="gspx-h3">Waiting for a second person ({checks.length})</h2></div>
      <Table head={['Change', 'Made by', 'Effect on amounts already in the system', '']}>
        {checks.map(k => (
          <tr key={k.id} className="irow">
            <td className="cfg__strong">{k.summary}<span className="irow__sub">{k.id}</span></td>
            <td>{nameOf(s, k.maker)}<span className="irow__sub">{fmtAge(k.at)} ago</span></td>
            <td>{k.impact.lines || k.impact.ipLines ? <>RP lines: {k.impact.lines} change, {k.impact.delta >= 0 ? '+' : ''}{aud(k.impact.delta)}<span className="irow__sub">University lines: {k.impact.ipLines} change, {k.impact.ipDelta >= 0 ? '+' : ''}{aud(k.impact.ipDelta)}</span></> : <span className="muted">No amount changes today; applies to new enrolments</span>}</td>
            <td><div className="gspx-acts">{canEdit && <><Button size="sm" kind="primary" onClick={() => decide(k, true)}>Approve</Button><LinkButton onClick={() => decide(k, false)}>Reject</LinkButton></>}</div></td>
          </tr>))}
      </Table>
    </Card>
  );
}

/* ---------- lists ---------- */
function Unis({ c, canEdit, onEdit }) {
  const [q, setQ] = useState('');
  const rows = c.cfg.unis.filter(u => !q || u.name.toLowerCase().includes(q.toLowerCase()));
  const none = q && !rows.length && <NoMatch what="universities" onClear={() => setQ('')} />;
  const ahead = opsOf(c.cfg).lookAhead.contracts;
  const soon = d => d && d < new Date(Date.parse(c.today) + ahead * 864e5).toISOString().slice(0, 10);
  return (
    <Card flush>
      <div className="stools"><div className="stools__row"><Input id="u-q" value={q} onChange={setQ} placeholder="Search universities" aria-label="Search universities" /></div>
        <p className="stools__count"><span><span className="num">{rows.length}</span> universities · terms drafted from the contracts, checked by Finance</span></p></div>
      {none || <Table head={['University', 'Rates', 'Paid when', 'Instalments', 'Tier', 'Annuity', 'Agreement ends', '']}>
        {rows.map(u => (
          <tr key={u.id} className="irow">
            <td className="cfg__strong">{u.name}<span className="irow__sub">{u.country} · {u.cur}{u.territory && u.territory !== 'All countries' ? ` · Territory: ${u.territory}` : ''}{u.flag ? ` · ${u.flag}` : ''}</span></td>
            <td><span className="gspx-wrap">{Object.entries(u.levels || {}).map(([k, v]) => `${k} ${v}%`).join(', ') || '—'}</span></td>
            <td>{TRIG[u.trigger] || u.trigger}<span className="irow__sub">pays in {u.payDays} days</span></td>
            <td className="num">{u.inst}</td>
            <td>{u.tier ? <span className="gspx-wrap">{bandTxt(u.tier.bands)}</span> : '—'}</td>
            <td>{u.annuity && u.annuity.on ? 'Yes' : '—'}</td>
            <td className="num">{u.ends ? nice(u.ends) : '—'}{u.ends && u.ends < c.today ? <span className="irow__sub">Ended</span> : soon(u.ends) ? <span className="irow__sub">Within {ahead} days</span> : null}</td>
            <td><LinkButton aria-label={`${canEdit ? 'Edit' : 'View'} ${u.name}`} onClick={() => onEdit(u)}>{canEdit ? 'Edit' : 'View'}</LinkButton></td>
          </tr>))}
      </Table>}
    </Card>
  );
}

function Rps({ c, canEdit, onEdit }) {
  const [q, setQ] = useState('');
  const sch = Object.fromEntries(c.cfg.schemes.map(x => [x.id, x]));
  const byId = Object.fromEntries(c.cfg.rps.map(x => [x.id, x]));
  const rows = c.cfg.rps.filter(r => !q || (r.name + r.id + r.region).toLowerCase().includes(q.toLowerCase()));
  const none = q && !rows.length && <NoMatch what="RPs" onClear={() => setQ('')} />;
  return (
    <Card flush>
      <div className="stools"><div className="stools__row"><Input id="r-q" value={q} onChange={setQ} placeholder="Search RPs" aria-label="Search RPs" /><div className="gspx-grow" />{canEdit && <Button kind="primary" onClick={() => onEdit(null)}>Add RP terms</Button>}</div>
        <p className="stools__count"><span><span className="num">{rows.length}</span> RPs with terms. RPs without terms get the default ({c.cfg.settings.defaultPct}%) and an exception.</span></p></div>
      {none || <Table head={['RP', 'Terms', 'Payee', 'Currency and bank', 'GST', '']}>
        {rows.map(r => (
          <tr key={r.id} className="irow">
            <td className="cfg__strong">{r.name}<span className="irow__sub">{r.id} · {r.region}{r.mp ? ' · Master Partner' : ''}</span></td>
            <td>{r.flat != null && r.flat !== '' ? `Own flat ${r.flat}%` : sch[r.scheme] ? `${sch[r.scheme].id} ${sch[r.scheme].name}` : <Pill tone="dpill--bad">No terms</Pill>}</td>
            <td>{r.payee ? `Master Partner: ${(byId[r.payee] || {}).name || r.payee}` : 'Itself'}</td>
            <td>{r.cur} · {r.bank === 'AU' ? 'Australian account' : 'Local account'}{r.bankVerified === false && <span className="irow__sub">Bank change not verified: payouts held</span>}</td>
            <td>{r.gst ? 'Registered' : '—'}</td>
            <td><LinkButton aria-label={`${canEdit ? 'Edit' : 'View'} ${r.name}`} onClick={() => onEdit(r)}>{canEdit ? 'Edit' : 'View'}</LinkButton></td>
          </tr>))}
      </Table>}
    </Card>
  );
}

function Schemes({ c, canEdit, onEdit }) {
  const count = id => c.cfg.rps.filter(r => r.scheme === id && (r.flat == null || r.flat === '')).length;
  return (
    <Card flush>
      <div className="stools"><div className="stools__row"><span className="muted gspx-grow">A scheme is a standard structure many RPs share. Change it once and every RP on it moves.</span>{canEdit && <Button kind="primary" onClick={() => onEdit(null)}>Add scheme</Button>}</div></div>
      <Table head={['Scheme', 'Structure', 'Counting', 'RPs on it', '']}>
        {c.cfg.schemes.map(x => (
          <tr key={x.id} className="irow">
            <td className="cfg__strong">{x.id} {x.name}<span className="irow__sub">{x.region}</span></td>
            <td>{x.type === 'flat' ? `Flat ${x.flat}%` : <span className="gspx-wrap">{bandTxt(x.bands)}</span>}</td>
            <td>{x.type === 'flat' ? '—' : `${x.retro === 'yes' ? 'Retrospective' : x.retro === 'top' ? 'Retrospective at the top band' : 'Prospective'}, per ${winName[x.window] || x.window}`}</td>
            <td className="num">{count(x.id)}</td>
            <td><LinkButton aria-label={`${canEdit ? 'Edit' : 'View'} ${x.id} ${x.name}`} onClick={() => onEdit(x)}>{canEdit ? 'Edit' : 'View'}</LinkButton></td>
          </tr>))}
      </Table>
    </Card>
  );
}

const NKIND = { tier: 'Tier %', flat: 'Flat %', flatfixed: 'Flat % plus a fixed amount', milestone: 'Milestone lump sums' };
const COMBINE = { box: 'Separate box (doesn’t count toward the RP’s tier)', highest: 'Highest of the two wins', adds: 'Adds on top' };
/** How many RPs a notice reaches: its listed RPs, or every RP in its region (Jovial, 5 Nov: one notice, many RPs, the same terms). */
const reach = (c, n) => ((n.rps || []).length ? n.rps.length : c.cfg.rps.filter(r => r.region === n.region).length);
function Notices({ c, canEdit, onEdit }) {
  const live = n => (!n.start || n.start <= c.today) && (!n.end || n.end >= c.today);
  return (
    <Card flush>
      <div className="stools"><div className="stools__row"><span className="muted gspx-grow">Notices, addenda, flyers and email approvals that change what RPs are paid, for a time.</span>{canEdit && <Button kind="primary" onClick={() => onEdit(null)}>Add notice</Button>}</div></div>
      <Table head={['Notice', 'Who', 'In force (enrolment dates)', 'Where', 'Structure', 'Sent', '']}>
        {c.cfg.notices.map(n => (
          <tr key={n.id} className="irow">
            <td className="cfg__strong">{n.id} {n.name}<span className="irow__sub">{n.doc || ''}{n.note ? ` · ${n.note}` : ''}</span></td>
            <td>{(n.rps || []).length ? `${n.rps.length} listed RP${n.rps.length > 1 ? 's' : ''}` : `Every RP in ${n.region}`}</td>
            <td className="num">{nice(n.start)} – {nice(n.end)}<span className="irow__sub">{live(n) ? 'Live' : n.start > c.today ? 'Not started' : 'Ended'}</span></td>
            <td>{(n.dest || []).length ? n.dest.map(d => DEST[d] || d).join(', ') : 'Any destination'}</td>
            <td><span className="gspx-wrap">{NKIND[n.kind]}{n.kind === 'tier' ? `: ${bandTxt(n.bands || [])}` : n.kind === 'milestone' ? `: ${(n.milestones || []).map(m => `${m[0]} → ${n.fixedCur || 'AUD'} ${m[1]}`).join(', ')}` : n.flat != null ? `: ${n.flat}%` : ''}</span><span className="irow__sub">{COMBINE[n.combine] || ''}</span></td>
            <td>{n.sentAt ? <>{nice(new Date(n.sentAt).toISOString().slice(0, 10))}<span className="irow__sub">to {reach(c, n)} RPs</span></> : <span className="muted">Not sent</span>}</td>
            <td><div className="gspx-acts"><LinkButton aria-label={`${canEdit ? 'Edit' : 'View'} ${n.id} ${n.name}`} onClick={() => onEdit(n)}>{canEdit ? 'Edit' : 'View'}</LinkButton>
              {canEdit && !n.sentAt && <LinkButton onClick={() => update(d => { const x = d.comm.cfg.notices.find(y => y.id === n.id); x.sentAt = Date.now(); }, `Sent notice ${n.id} ${n.name} to ${reach(c, n)} RPs`) || toast('Notice sent', { text: `${reach(c, n)} RPs see it on Earnings.` })}>Send to RPs</LinkButton>}</div></td>
          </tr>))}
      </Table>
    </Card>
  );
}

/* ---------- editors ---------- */
/* QC, 1 Nov: each sheet checks its fields when they're left and on Send, shows the error under the field, focuses the
 * first one and sends nothing while one shows; closing with changes asks "Discard changes?". Empty is "not set", never 0. */
function useDraft(init) {
  const [d, setD] = useState(() => structuredClone(init));
  const set = (k, v) => setD(x => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(d) !== JSON.stringify(init);
  return [d, set, setD, dirty];
}
const num = v => (v === '' || v == null ? null : typeof v === 'string' && /[.-]$/.test(v) ? v : Number(v));

/** What's wrong with a list of bands: from ≤ to, each band after the last, rates 0 to 100 (or an amount for milestones). */
export function bandErrors(bands, unit = '%') {
  const out = bands.map(() => ({}));
  bands.forEach((b, i) => {
    const e = out[i];
    e.from = numError(b[0], { what: `band ${i + 1}’s first enrolment`, min: 1, int: true, required: true });
    e.to = b[1] == null || b[1] === '' ? null : numError(b[1], { what: `band ${i + 1}’s last enrolment`, min: 1, int: true }) || (Number(b[1]) < Number(b[0]) ? `Band ${i + 1} has to end at or after ${b[0]}.` : null);
    e.rate = unit === '%' ? pctError(b[2], `band ${i + 1}’s rate`, true) : numError(b[2], { what: `band ${i + 1}’s amount`, min: 0, required: true });
    if (!e.from && i > 0 && bands[i - 1][1] != null && bands[i - 1][1] !== '' && Number(b[0]) <= Number(bands[i - 1][1])) e.from = `Band ${i + 1} has to start after ${bands[i - 1][1]}.`;
  });
  return out;
}
const firstBandError = (errs) => { for (const e of errs) for (const k of ['from', 'to', 'rate']) if (e[k]) return e[k]; return null; };

function Bands({ bands, onChange, unit = '%', show = false, label = 'Band' }) {
  const set = (i, j, v) => onChange(bands.map((b, k) => k === i ? b.map((x, m) => m === j ? num(v) : x) : b));
  const errs = bandErrors(bands, unit);
  return (
    <div className="gspx-bands">
      {bands.map((b, i) => {
        const e = show ? errs[i] : {};
        return (
          <div key={i} className="gspx-errs">
            <div className="gspx-inline">
              <span className="muted">From</span><Num label={`${label} ${i + 1}: from (enrolments)`} value={b[0]} error={e.from} onChange={v => set(i, 0, v)} />
              <span className="muted">to</span><Num label={`${label} ${i + 1}: to (enrolments, empty for no limit)`} placeholder="no limit" value={b[1]} error={e.to} onChange={v => set(i, 1, v)} />
              <span className="muted">enrolments →</span><Num label={`${label} ${i + 1}: ${unit === '%' ? 'rate (%)' : `amount (${unit})`}`} value={b[2]} error={e.rate} onChange={v => set(i, 2, v)} /><span className="muted">{unit}</span>
              {bands.length > 1 && <LinkButton aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(bands.filter((_, k) => k !== i))}>Remove</LinkButton>}
            </div>
            {(e.from || e.to || e.rate) && <p className="field__msg field__msg--error" role="alert">{e.from || e.to || e.rate}</p>}
          </div>
        );
      })}
      <LinkButton onClick={() => { const last = bands[bands.length - 1] || [0, null, 70]; onChange([...bands.slice(0, -1), [last[0], (Number(last[0]) || 0) + 4, last[2]], [(Number(last[0]) || 0) + 5, null, (Number(last[2]) || 70) + 5]]); }}>Add a band</LinkButton>
    </div>
  );
}

function Foot({ onClose, onSave, ro, dirty = true }) {
  return <><Button onClick={onClose}>{ro ? 'Close' : 'Cancel'}</Button>{!ro && <Button kind="primary" disabled={!dirty} onClick={onSave}>Save</Button>}</>;
}

function UniSheet({ ro, c, u, onClose, propose }) {
  const [d, set, , dirty] = useDraft(u);
  const lv = Object.keys(LEVELS);
  const rateErr = Object.fromEntries(lv.map(k => [k, pctError((d.levels || {})[k], `${LEVELS[k]} rate`)]));
  const errors = {
    payDays: numError(d.payDays, { what: 'days to pay an invoice', min: 0, max: 365, int: true, required: true }),
    cap: numError(d.cap, { what: 'cap per student', min: 0 }),
    tw: d.trigger === 'withdrawal' ? numError(d.triggerWeeks, { what: 'weeks after the start date', min: 0, max: 52, int: true }) : null,
    ends: dateError(d.ends || '', { what: 'contract end date' }),
    rates: Object.values(rateErr).find(Boolean) || null,
    years: d.annuity && d.annuity.on ? numError(d.annuity.maxYears, { what: 'number of annuity years', min: 1, max: 10, int: true }) : null,
    tier: d.tier ? firstBandError(bandErrors(d.tier.bands)) : null,
  };
  const v = useCheck(errors);
  const save = () => v.submit() && propose('unis', u.id, u, d, `${u.name} terms`);
  return (
    <Sheet title={u.name} sub="University terms. What the contract says is at the end." onClose={onClose} wide dirty={!ro && dirty} what={`${u.name}’s terms`} footer={<Foot ro={ro} dirty={dirty} onClose={onClose} onSave={save} />}>
      <div className="gspx-grid2">
        <div className="gspx-form2">
          <Select id="u-trig" label="Commission is earned at" required value={d.trigger} onChange={x => set('trigger', x)} options={Object.entries(TRIG)} />
          {d.trigger === 'withdrawal' && <Field id="u-tw" label="Weeks after the start date" hint="The withdrawal deadline, e.g. 4 weeks from the start date (commissions team, 3 Nov). Blank: Finance setup's default." error={v.err('tw')}><NumberInput id="u-tw" decimal={false} min={0} steppers value={d.triggerWeeks ?? ''} onBlur={v.blur('tw')} onChange={x => set('triggerWeeks', num(x))} /></Field>}
          <Select id="u-inst" label="First-year instalments" required value={String(d.inst)} onChange={x => set('inst', Number(x))} options={[['1', '1 (once a year)'], ['2', '2 (per semester)'], ['3', '3 (per trimester)']]} />
          <Field id="u-days" label="Days to pay an invoice" required error={v.err('payDays')}><NumberInput id="u-days" decimal={false} min={0} steppers value={d.payDays} onBlur={v.blur('payDays')} onChange={x => set('payDays', x)} /></Field>
          <Field id="u-cap" label="Cap per student (first year)" hint="Leave blank for no cap" error={v.err('cap')}><NumberInput id="u-cap" value={d.cap ?? ''} onBlur={v.blur('cap')} onChange={x => set('cap', num(x))} /></Field>
          <Field id="u-end" label="Agreement ends" hint={u.agreement ? `From the Institution partner record${u.agreement.partner ? ` (${u.agreement.partner}, ${u.agreement.status})` : ''}: the Institution Team changes it there.` : 'No Institution partner record yet.'}><DateField id="u-end" value={d.ends || ''} onChange={() => undefined} readOnly /></Field>
          <Select id="u-cur" label="Currency" required value={d.cur} onChange={x => set('cur', x)} options={cursNow()} />
          <Select id="u-invper" label="How GSP invoices" required value={d.invoicePer || 'cycle'} onChange={x => set('invoicePer', x)} options={[['cycle', 'One invoice a month for every student'], ['student', 'One invoice per student']]} />
          <label className="gspx-check"><input type="checkbox" checked={!!d.selfBilling} onChange={e => set('selfBilling', e.target.checked)} /> Self-billing: the university sends its own statement or remittance, so GSP doesn’t invoice it</label>
          <fieldset className="field gspx-fieldset"><legend className="field__label">Rates by level (% of tuition; empty: not paid)</legend>
            <div className="gspx-rates">{lv.map(k => (
              <label key={k} className="gspx-rate"><span>{LEVELS[k]}</span>
                <Num label={`${LEVELS[k]} rate (% of tuition)`} placeholder="Not paid" value={(d.levels || {})[k]} error={(v.shown || v.err('rates')) && rateErr[k]} onBlur={v.blur('rates')} onChange={x => set('levels', { ...(d.levels || {}), [k]: num(x) })} /></label>))}</div>
            {v.err('rates') && <p className="field__msg field__msg--error" role="alert">{v.err('rates')}</p>}</fieldset>
          <div className="field"><span className="field__label">Annuity (year 2 onwards)</span>
            <label className="gspx-check"><input type="checkbox" checked={!!(d.annuity && d.annuity.on)} onChange={e => set('annuity', e.target.checked ? { on: true, maxYears: d.annuity?.maxYears ?? null } : null)} /> The university pays commission for every year of the course</label>
            {d.annuity && d.annuity.on && <div className="gspx-inline"><span className="muted">Up to</span><Num label="Annuity years (empty: the course length)" placeholder="course length" value={d.annuity.maxYears} error={v.err('years')} onBlur={v.blur('years')} onChange={x => set('annuity', { ...d.annuity, maxYears: num(x) })} /><span className="muted">years</span></div>}
            {v.err('years') && <p className="field__msg field__msg--error" role="alert">{v.err('years')}</p>}</div>
          {d.tier && <div className="field"><span className="field__label">University tier ({d.tier.retro ? 'retrospective' : 'prospective'}, all GSP students{d.tier.scope === 'country' ? ' per source country' : ''})</span>
            <Bands bands={d.tier.bands} show={v.shown} onChange={b => set('tier', { ...d.tier, bands: b })} /></div>}
        </div>
        <dl className="gspx-dl">
          <dt>Rate</dt><dd>{u.contract?.rate || '—'}</dd>
          <dt>Periods</dt><dd>{u.contract?.periods || '—'}</dd>
          <dt>Trigger</dt><dd>{u.contract?.trigger || '—'}</dd>
          <dt>Tier</dt><dd>{u.contract?.tier || '—'}</dd>
          <dt>Clawback</dt><dd>{u.contract?.claw || '—'}</dd>
          <dt>After the contract ends</dt><dd>{u.contract?.after || '—'}</dd>
          <dt>Source</dt><dd>{u.contract?.src || '—'}</dd>
          <dt>Territory</dt><dd>{u.territory ? `${u.territory} (the university’s record)` : '—'}</dd>
          {u.flag && <><dt>Open point</dt><dd>{u.flag}</dd></>}
        </dl>
      </div>
    </Sheet>
  );
}

function RpSheet({ ro, c, r, onClose, propose }) {
  const blank = { id: '', name: '', region: 'India', scheme: 'S05', flat: null, gst: false, cur: 'AUD', bank: 'AU', payee: '', mp: false, annuityPct: null, note: '', bankVerified: true };
  const [d, set, , dirty] = useDraft(r || blank);
  const own = d.flat != null && d.flat !== '';
  // a new RP's payout currency starts from Finance setup's table for its region (HC44)
  const setRegion = x => { set('region', x); if (!r) set('cur', payoutCurOf(c.cfg, x)); };
  // the sales regions Admin keeps, plus the regions already on RP terms (Australia Onshore is Finance's own)
  const regions = [...new Set([...salesRegionNames(), ...c.cfg.rps.map(x => x.region).filter(Boolean), 'Australia Onshore'])];
  const mps = c.cfg.rps.filter(x => x.mp && x.id !== d.id);
  const errors = {
    id: r ? null : !d.id.trim() ? 'Enter the RP ID, like RP-1042.' : dupError(d.id, c.cfg.rps.map(x => x.id), `There are already terms for ${d.id.trim()}.`),
    name: r ? null : !d.name.trim() ? 'Enter the RP name.' : null,
    region: r ? null : !d.region ? 'Choose the sales region.' : null,
    flat: own ? pctError(d.flat, 'own flat rate', true) : d.mp ? 'A Master Partner is paid a flat rate: choose Own flat rate.' : null,
    ann: pctError(d.annuityPct, 'own annuity share'),
    from: !d.from ? 'Enter the date the terms are in force from.' : null,
  };
  const v = useCheck(errors);
  const save = () => {
    if (!v.submit()) return;
    propose('rps', r ? r.id : d.id.trim(), r || null, { ...d, id: d.id.trim(), name: d.name.trim() }, `${d.name} RP terms${r ? '' : ' (new)'}`);
  };
  return (
    <Sheet title={r ? r.name : 'Add RP terms'} sub="From the RP’s signed agreement" onClose={onClose} wide dirty={!ro && dirty} what={r ? `${r.name}’s terms` : 'the new RP terms'} footer={<Foot ro={ro} dirty={!r || dirty} onClose={onClose} onSave={save} />}>
      <div className="gspx-form2">
        {!r && <><Field id="rp-id" label="RP ID" required error={v.err('id')}><Input id="rp-id" value={d.id} onBlur={v.blur('id')} onChange={x => set('id', x)} /></Field>
          <Field id="rp-n" label="RP name" required error={v.err('name')}><Input id="rp-n" value={d.name} onBlur={v.blur('name')} onChange={x => set('name', x)} /></Field>
          <Select id="rp-reg" label="Sales region" required error={v.err('region')} onBlur={v.blur('region')} value={d.region} onChange={setRegion} options={regions} /></>}
        <Select id="rp-terms" label="Terms" required value={own ? 'own' : d.scheme} onChange={x => x === 'own' ? set('flat', 80) : (set('flat', null), set('scheme', x))}
          options={[['own', 'Own flat rate'], ...c.cfg.schemes.map(x => [x.id, `${x.id} ${x.name}`])]} />
        <Field id="rp-from" label="Terms in force from" required error={v.err('from')} hint="From the agreement: intakes from this date use these terms."><DateField id="rp-from" value={d.from || ''} onBlur={v.blur('from')} onChange={x => set('from', x)} /></Field>
        {own && <Field id="rp-flat" label="Own flat rate (% of GSP’s commission)" required error={v.err('flat')}><NumberInput id="rp-flat" value={d.flat} onBlur={v.blur('flat')} onChange={x => set('flat', x)} /></Field>}
        <Select id="rp-cur" label="Payout currency" required value={d.cur} onChange={x => set('cur', x)} options={cursNow()} />
        <Select id="rp-bank" label="Bank account" required value={d.bank} onChange={x => set('bank', x)} options={[['AU', 'Australian account (batch 1)'], ['Local', 'Local account (batch 2)']]} />
        <Select id="rp-payee" label="Paid through a Master Partner?" value={d.payee || ''} onChange={x => set('payee', x)} placeholder="No, GSP pays the RP" options={mps.map(x => [x.id, x.name])} />
        <Field id="rp-ann" label="Own annuity share (%)" error={v.err('ann')} hint={`Blank: the setting (${c.cfg.settings.annuityRp === 'same' ? 'same as year 1' : c.cfg.settings.annuityRp})`}><NumberInput id="rp-ann" value={d.annuityPct ?? ''} onBlur={v.blur('ann')} onChange={x => set('annuityPct', num(x))} /></Field>
        <label className="gspx-check"><input type="checkbox" checked={!!d.gst} onChange={e => set('gst', e.target.checked)} /> Registered for GST</label>
        <label className="gspx-check"><input type="checkbox" checked={!!d.mp} onChange={e => set('mp', e.target.checked)} /> This RP is a Master Partner (other RPs are paid through it)</label>
        {d.bankVerified === false && <p className="muted">New bank details are waiting for RP Ops to verify them (on the RP’s record). Payouts are held until then.</p>}
        <Field id="rp-note" label="Note"><Input id="rp-note" value={d.note} onChange={x => set('note', x)} /></Field>
      </div>
      {d.payee && <Notice>GSP pays the Master Partner its flat rate. What the Master Partner pays this RP stays between them, outside GSP.</Notice>}
    </Sheet>
  );
}

function SchemeSheet({ ro, c, x, onClose, propose }) {
  const next = 'S' + String(c.cfg.schemes.length + 1).padStart(2, '0');
  const [d, set, , dirty] = useDraft(x || { id: next, name: '', region: 'All', type: 'tier', bands: [[1, 4, 70], [5, null, 75]], retro: 'no', window: 'CY', flat: null, note: '' });
  const errors = {
    name: !d.name.trim() ? 'Enter the scheme’s name.' : dupError(d.name, c.cfg.schemes.filter(y => y.id !== d.id).map(y => y.name), 'There’s already a scheme with this name.'),
    flat: d.type === 'flat' ? pctError(d.flat, 'flat rate', true) : null,
    bands: d.type === 'tier' ? firstBandError(bandErrors(d.bands)) : null,
  };
  const v = useCheck(errors);
  const save = () => v.submit() && propose('schemes', d.id, x || null, d, `scheme ${d.id} ${d.name}${x ? '' : ' (new)'}`);
  return (
    <Sheet title={x ? `${x.id} ${x.name}` : 'Add scheme'} onClose={onClose} wide dirty={!ro && dirty} what={x ? `scheme ${x.id}` : 'the new scheme'} footer={<Foot ro={ro} dirty={!x || dirty} onClose={onClose} onSave={save} />}>
      <div className="gspx-form2">
        <Field id="s-n" label="Name" required error={v.err('name')}><Input id="s-n" value={d.name} onBlur={v.blur('name')} onChange={y => set('name', y)} /></Field>
        <Field id="s-r" label="Region"><Input id="s-r" value={d.region} onChange={y => set('region', y)} /></Field>
        <Select id="s-t" label="Structure" required value={d.type} onChange={y => set('type', y)} options={[['tier', 'Tier by number of enrolments'], ['flat', 'Flat %']]} />
        {d.type === 'flat' ? <Field id="s-f" label="Flat % of GSP’s commission" required error={v.err('flat')}><NumberInput id="s-f" value={d.flat} onBlur={v.blur('flat')} onChange={y => set('flat', y)} /></Field> : <>
          <Select id="s-re" label="When a higher band is reached" required value={d.retro} onChange={y => set('retro', y)} options={[['no', 'Prospective: only later enrolments get it'], ['yes', 'Retrospective: every enrolment in the window gets it'], ['top', 'Retrospective only at the top band']]} />
          <Select id="s-w" label="Counted per" required value={d.window} onChange={y => set('window', y)} options={Object.entries(winName)} /></>}
      </div>
      {d.type === 'tier' && <div className="field"><span className="field__label">Bands (enrolments GSP has been paid for)</span><Bands bands={d.bands} show={v.shown} onChange={b => set('bands', b)} /></div>}
    </Sheet>
  );
}

function NoticeSheet({ ro, c, x, onClose, propose }) {
  const next = 'N' + String(c.cfg.notices.length + 1).padStart(2, '0');
  const [d, set, , dirty] = useDraft(x || { id: next, name: '', region: 'India', doc: 'Notice', rps: [], start: c.today, end: '', dest: [], unis: [], kind: 'flat', flat: 80, bands: [[1, 10, 80], [11, null, 85]], milestones: [[10, 1000]], fixed: null, fixedCur: 'AUD', retro: 'no', combine: 'box', note: '' });
  const [pick, setPick] = useState('');
  const errors = {
    name: !d.name.trim() ? 'Enter the notice’s name.' : null,
    start: dateError(d.start, { what: 'first enrolment date', required: true }),
    end: dateError(d.end, { what: 'last enrolment date' }) || afterError(d.start, d.end, 'last enrolment date', 'first enrolment date'),
    flat: d.kind === 'flat' || d.kind === 'flatfixed' ? pctError(d.flat, 'rate', true) : null,
    fixed: d.kind === 'flatfixed' ? numError(d.fixed, { what: 'fixed amount', min: 0, required: true }) : null,
    bands: d.kind === 'tier' ? firstBandError(bandErrors(d.bands)) : d.kind === 'milestone' ? firstBandError(bandErrors(d.milestones.map(m => [m[0], null, m[1]]), d.fixedCur || 'AUD')) : null,
  };
  const v = useCheck(errors);
  const save = () => v.submit() && propose('notices', d.id, x || null, d, `notice ${d.id} ${d.name}${x ? '' : ' (new)'}`);
  const rpName = id => (c.cfg.rps.find(r => r.id === id) || {}).name || id;
  return (
    <Sheet title={x ? `${x.id} ${x.name}` : 'Add notice'} sub="From the notice, addendum, flyer or email approval" onClose={onClose} wide dirty={!ro && dirty} what={x ? `notice ${x.id}` : 'the new notice'} footer={<Foot ro={ro} dirty={!x || dirty} onClose={onClose} onSave={save} />}>
      <div className="gspx-form2">
        <Field id="n-n" label="Name" required error={v.err('name')}><Input id="n-n" value={d.name} onBlur={v.blur('name')} onChange={y => set('name', y)} /></Field>
        <Select id="n-doc" label="Source document" required value={d.doc} onChange={y => set('doc', y)} options={[...NOTICE_SOURCES]} />
        <Field id="n-s" label="In force from (enrolments from)" required error={v.err('start')}><DateField id="n-s" value={d.start} onBlur={v.blur('start')} onChange={y => set('start', y)} /></Field>
        <Field id="n-e" label="Enrolments to" hint="Leave blank for no end" error={v.err('end')}><DateField id="n-e" value={d.end} onBlur={v.blur('end')} onChange={y => set('end', y)} /></Field>
        <Field id="n-r" label="Region (when no RPs are listed)"><Input id="n-r" value={d.region} onChange={y => set('region', y)} /></Field>
        <Select id="n-k" label="Structure" required value={d.kind} onChange={y => set('kind', y)} options={Object.entries(NKIND)} />
        {(d.kind === 'flat' || d.kind === 'flatfixed') && <Field id="n-f" label="% of GSP’s commission" required error={v.err('flat')}><NumberInput id="n-f" value={d.flat} onBlur={v.blur('flat')} onChange={y => set('flat', y)} /></Field>}
        {d.kind === 'flatfixed' && <Field id="n-fx" label="Plus a fixed amount per enrolment (AUD)" required error={v.err('fixed')}><NumberInput id="n-fx" value={d.fixed ?? ''} onBlur={v.blur('fixed')} onChange={y => set('fixed', num(y))} /></Field>}
        {d.kind !== 'milestone' && <Select id="n-c" label="How it combines with the RP’s own terms" required value={d.combine} onChange={y => set('combine', y)} options={Object.entries(COMBINE)} />}
      </div>
      {d.kind === 'tier' && <div className="field"><span className="field__label">Bands</span><Bands bands={d.bands} show={v.shown} onChange={b => set('bands', b)} /></div>}
      {d.kind === 'milestone' && <div className="field"><span className="field__label">Milestones: lump sum once GSP is paid for this many enrolments</span>
        <Bands label="Milestone" bands={d.milestones.map(m => [m[0], null, m[1]])} unit={d.fixedCur || 'AUD'} show={v.shown} onChange={b => set('milestones', b.map(m => [m[0], m[2]]))} /></div>}
      <div className="field"><span className="field__label">Destinations (none = any)</span>
        <div className="gspx-checks">{Object.entries(DEST).map(([k, val]) => <label key={k} className="gspx-check"><input type="checkbox" checked={(d.dest || []).includes(k)} onChange={e => set('dest', e.target.checked ? [...(d.dest || []), k] : d.dest.filter(z => z !== k))} />{val}</label>)}</div></div>
      <div className="field"><span className="field__label">Listed RPs (none = every RP in the region)</span>
        <div className="cfg__chips">{(d.rps || []).map(id => <Chip key={id} onRemove={() => set('rps', d.rps.filter(z => z !== id))}>{rpName(id)}</Chip>)}</div>
        <div className="gspx-inline"><Select id="n-add" label="RP to add" hideLabel value={pick} onChange={setPick} placeholder="Choose an RP" options={c.cfg.rps.filter(r => !(d.rps || []).includes(r.id)).map(r => [r.id, r.name])} />
          <Button disabled={!pick} onClick={() => { set('rps', [...(d.rps || []), pick]); setPick(''); }}>Add</Button></div></div>
      <Field id="n-note" label="Open point or note"><Input id="n-note" value={d.note} onChange={y => set('note', y)} /></Field>
    </Sheet>
  );
}

export function Settings({ c, canEdit, propose }) {
  // with Finance setup's defaults filled in (HC43–HC45), so every one shows and can be changed
  const S = settingsOf(c.cfg);
  const [d, set, setD, changed] = useDraft(S);
  const weekOf = c.today; const rows = [...d.fx].sort((a, b) => a.week < b.week ? -1 : 1);
  const cur = rows.filter(w => w.week <= weekOf).pop();
  const ccy = cursNow().filter(k => k !== 'AUD');
  // QC, 1 Nov: rates 0 to 100, no negative days or weeks, empty is "not set" (never 0)
  const errors = {
    dp: pctError(d.defaultPct, 'default rate', true),
    gl: pctError(d.gspLeadPct, 'GSP lead rate', true),
    ap: d.annuityRp === 'flat' ? pctError(d.annuityPct, 'annuity share', true) : null,
    ag: pctError(d.auGst, 'GST on university invoices', true),
    rg: pctError(d.rpGst, 'GST on RP payouts', true),
    wh: Object.entries(d.wht || {}).map(([k, x]) => pctError(x, `withholding for ${k}`)).find(Boolean) || null,
    est: numError(d.estimate.payDays, { what: 'days to pay for an estimate', min: 0, max: 365, int: true, required: true }) || numError(d.estimate.inst, { what: 'instalments for an estimate', min: 1, max: 6, int: true, required: true }),
    yrs: Object.entries(d.courseYears).map(([k, x]) => numError(x, { what: `default years for ${LEVELS[k] || k}`, min: 1, max: 8, required: true })).find(Boolean) || null,
    lg: numError(d.legalDays, { what: 'days before Legal', min: 1, max: 365, int: true, required: true }),
    fb: numError(d.fallbackWeeks, { what: 'weeks after the start', min: 0, max: 52, int: true, required: true }),
  };
  const box = React.useRef(null);
  const v = useCheck(errors, () => box.current);
  useUnsaved(canEdit && changed, changed, { onDiscard: () => setD(structuredClone(S)), region: box, what: 'the commission settings', esc: false });
  const f = (id, k, label, value, onChange, hint) => (
    <Field id={id} label={label} required={k !== 'wh'} hint={hint} error={v.err(k)}><NumberInput id={id} value={value} disabled={!canEdit} onBlur={v.blur(k)} onChange={onChange} /></Field>
  );
  return (
    <div ref={box} className="gspx-stack">
      <Card>
        <h2 className="gspx-h3">Defaults and rules</h2>
        <div className="gspx-form2">
          <Select id="st-dm" label="RP with no terms" required disabled={!canEdit} value={d.defaultMode} onChange={x => set('defaultMode', x)} options={[['flat', 'Pay the default % and flag it'], ['hold', 'Hold in exceptions']]} />
          {f('st-dp', 'dp', 'Default % (new contract)', d.defaultPct, x => set('defaultPct', x))}
          {f('st-gl', 'gl', 'GSP lead: RP gets (%)', d.gspLeadPct, x => set('gspLeadPct', x))}
          <Select id="st-an" label="RP share of annuity" required disabled={!canEdit} value={d.annuityRp} onChange={x => set('annuityRp', x)} options={[['same', 'Same % as the first year'], ['flat', 'A flat %'], ['none', 'Not shared']]} />
          {d.annuityRp === 'flat' && f('st-ap', 'ap', 'Annuity share (%)', d.annuityPct ?? '', x => set('annuityPct', num(x)))}
          {f('st-ag', 'ag', 'GST on Australian university invoices (%)', d.auGst, x => set('auGst', x))}
          {f('st-rg', 'rg', 'GST on RP payouts, if registered (%)', d.rpGst, x => set('rpGst', x))}
          {f('st-lg', 'lg', 'Send unrecovered clawbacks to Legal after (days)', d.legalDays, x => set('legalDays', x))}
          {f('st-fb', 'fb', 'No census date: use start + (weeks)', d.fallbackWeeks, x => set('fallbackWeeks', x))}
          <label className="gspx-check"><input type="checkbox" disabled={!canEdit} checked={!!d.selfCheck} onChange={e => set('selfCheck', e.target.checked)} /> Allow the maker to check their own change (not recommended)</label>
        </div>
      </Card>
      <Card>
        <h2 className="gspx-h3">Estimates for a university with no terms yet</h2>
        <p className="muted">Until Finance enters a university’s terms, an application’s Commission tab estimates with the course record’s rate and these.</p>
        <div className="gspx-form2">
          <Field id="st-ei" label="Instalments a year" required error={v.err('est')}><NumberInput id="st-ei" decimal={false} min={1} max={12} steppers value={d.estimate.inst} disabled={!canEdit} onBlur={v.blur('est')} onChange={x => set('estimate', { ...d.estimate, inst: num(x) })} /></Field>
          <Field id="st-ep" label="University pays within (days)" required><NumberInput id="st-ep" decimal={false} min={0} steppers value={d.estimate.payDays} disabled={!canEdit} onBlur={v.blur('est')} onChange={x => set('estimate', { ...d.estimate, payDays: num(x) })} /></Field>
          <Select id="st-et" label="Commission is earned at" required disabled={!canEdit} value={d.estimate.trigger} onChange={x => set('estimate', { ...d.estimate, trigger: x })} options={Object.entries(TRIG)} />
          <Select id="st-es" label="Student type" required disabled={!canEdit} value={d.estimate.studentType} onChange={x => set('estimate', { ...d.estimate, studentType: x })} options={[...STUDENT_TYPES]} />
        </div>
      </Card>
      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Default course length</h2><p className="muted">Years of annuity commission when an application has no course length of its own.</p></div>
        <Table head={['Level', 'Years']}>
          {Object.entries(d.courseYears).map(([k, x]) => (
            <tr key={k} className="irow"><td className="cfg__strong">{LEVELS[k] || k}</td>
              <td><Num label={`${LEVELS[k] || k}: default years`} disabled={!canEdit} value={x} onBlur={v.blur('yrs')} onChange={y => set('courseYears', { ...d.courseYears, [k]: y })} /></td></tr>))}
        </Table>
        {v.err('yrs') && <p className="field__msg field__msg--error gspx-pad" role="alert">{v.err('yrs')}</p>}
      </Card>
      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Payout currency and withholding, by sales region</h2>
          <p className="muted">The one table of payout currencies: an RP with no signed terms is paid in its region’s currency (AUD where none is set), and a new RP’s terms start from it. Withholding is taken off RP payouts in that region (none decided so far: GSP pays from the Australian entity). Sales regions come from GSP · Admin.</p></div>
        <Table head={['Sales region', 'Payout currency', 'Withholding (%)']}>
          {salesRegionNames().filter(r => r !== 'Global').map(r => (
            <tr key={r} className="irow"><td className="cfg__strong">{r}</td>
              <td><Select id={`st-pc-${r}`} label={`${r}: payout currency`} hideLabel disabled={!canEdit} value={d.payoutCur[r] || 'AUD'} onChange={x => set('payoutCur', { ...d.payoutCur, [r]: x === 'AUD' ? undefined : x })} options={cursNow()} /></td>
              <td><Num label={`${r}: withholding (%)`} disabled={!canEdit} value={(d.wht || {})[r] ?? ''} onBlur={v.blur('wh')} onChange={y => set('wht', { ...(d.wht || {}), [r]: y === '' ? undefined : y })} /></td></tr>))}
        </Table>
        {v.err('wh') && <p className="field__msg field__msg--error gspx-pad" role="alert">{v.err('wh')}</p>}
      </Card>
      <Card>
        <h2 className="gspx-h3">FX rates · week of {cur ? nice(cur.week) : '—'}</h2>
        <p className="muted">AUD for 1 unit. Set in GSP · Admin › Course configuration › Currency exchange, the one source for every part of GSP; each line is priced at the rate of the week it’s paid. A payout run is held for a currency with no rate this week.</p>
        {cur && <div className="gspx-rates">{ccy.map(k => (
          <span key={k} className="gspx-rate"><span>{k}</span><b className="num">{cur[k] ?? 'Missing'}</b></span>))}</div>}
      </Card>
      {canEdit && <div className="gspx-inline">{changed && <Button onClick={() => { setD(structuredClone(S)); v.reset(); }}>Cancel</Button>}<Button kind="primary" disabled={!changed} onClick={() => { if (!v.submit()) return; propose('settings', 'settings', S, d, 'commission settings'); setD(structuredClone(S)); v.reset(); }}>Send for checking</Button></div>}
    </div>
  );
}
