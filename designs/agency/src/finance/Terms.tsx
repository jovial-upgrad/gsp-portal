// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Commission terms: universities (from contracts), RP terms, schemes, notices,
 * settings and weekly FX. Every change waits for a second Finance person
 * (maker-checker) and shows what it would do to amounts already in the system.
 */
import React, { useState } from 'react';
import { update, nameOf, getState } from './store';
import { Card, Segmented, Select, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, Chip, toast, fmtAge } from './kit';
import { nice, money, LEVELS, TRIG, DEST, bandTxt, winName } from './engine';
import { SALES_REGIONS } from '../institution/data/announcements';
import { proposeChange, applyChange, impactOf, aud, opsOf } from './shared';

const AREAS = [['unis', 'Universities'], ['rps', 'RP terms'], ['schemes', 'Schemes'], ['notices', 'Notices'], ['settings', 'Settings and FX']];
const CURS = ['AUD', 'GBP', 'NZD', 'USD', 'INR', 'NPR', 'BDT', 'LKR', 'VND'];

export default function Terms({ c, user, canEdit }) {
  const [area, setArea] = useState('unis');
  const [edit, setEdit] = useState(null); // { area, item (or null for new) }
  const s = getState();
  const checks = c.checks.filter(k => k.status === 'waiting');
  const propose = (area, id, before, after, summary) => {
    if (!opsOf(c.cfg).makerChecker[area === 'settings' ? 'settings' : 'terms']) {
      update(d => applyChange(d, { area, target: id, after }), `${user.name} changed ${summary} (no check needed: maker-checker is off)`);
      toast('Saved. Maker-checker is off for this kind of change (Finance setup).'); setEdit(null); return;
    }
    const impact = impactOf(c.cfg, c.apps, c.today, area, id, after);
    proposeChange({ area, id, before, after, summary, impact, user });
    toast('Sent for checking. Nothing changes until a second Finance person approves it.');
    setEdit(null);
  };
  return (
    <>
      {checks.length > 0 && <Checks checks={checks} user={user} canEdit={canEdit} selfCheck={c.cfg.settings.selfCheck} />}
      <Segmented label="Terms" options={AREAS} value={area} onChange={setArea} />
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
    update(d => {
      const x = d.comm.checks.find(y => y.id === k.id); x.status = ok ? 'approved' : 'rejected'; x.checker = user.id; x.checkedAt = Date.now();
      if (ok) applyChange(d, x);
      const t = d.tasks.find(y => y.id === 'T-' + k.id); if (t) { t.status = 'done'; t.doneBy = user.id; t.doneAt = Date.now(); }
    }, `${user.name} ${ok ? 'approved' : 'rejected'} ${k.summary} (made by ${nameOf(s, k.maker)})`);
    toast(ok ? 'Approved. The new terms apply now.' : 'Rejected. Nothing changed.');
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
  const soon = d => d && d < new Date(Date.parse(c.today) + 90 * 864e5).toISOString().slice(0, 10);
  return (
    <Card flush>
      <div className="stools"><div className="stools__row"><Input id="u-q" value={q} onChange={setQ} placeholder="Search universities" aria-label="Search universities" /></div>
        <p className="stools__count"><span><span className="num">{rows.length}</span> universities · terms drafted from the contracts, checked by Finance</span></p></div>
      <Table head={['University', 'Rates', 'Paid when', 'Instalments', 'Tier', 'Annuity', 'Contract ends', '']}>
        {rows.map(u => (
          <tr key={u.id} className="irow">
            <td className="cfg__strong">{u.name}<span className="irow__sub">{u.country} · {u.cur}{u.flag ? ` · ${u.flag}` : ''}</span></td>
            <td><span className="gspx-wrap">{Object.entries(u.levels || {}).map(([k, v]) => `${k} ${v}%`).join(', ') || '—'}</span></td>
            <td>{TRIG[u.trigger] || u.trigger}<span className="irow__sub">pays in {u.payDays} days</span></td>
            <td className="num">{u.inst}</td>
            <td>{u.tier ? <span className="gspx-wrap">{bandTxt(u.tier.bands)}</span> : '—'}</td>
            <td>{u.annuity && u.annuity.on ? 'Yes' : '—'}</td>
            <td className="num">{u.ends ? nice(u.ends) : '—'}{u.ends && u.ends < c.today ? <span className="irow__sub">Ended</span> : soon(u.ends) ? <span className="irow__sub">Within 90 days</span> : null}</td>
            <td><LinkButton onClick={() => onEdit(u)}>{canEdit ? 'Edit' : 'View'}</LinkButton></td>
          </tr>))}
      </Table>
    </Card>
  );
}

function Rps({ c, canEdit, onEdit }) {
  const [q, setQ] = useState('');
  const sch = Object.fromEntries(c.cfg.schemes.map(x => [x.id, x]));
  const byId = Object.fromEntries(c.cfg.rps.map(x => [x.id, x]));
  const rows = c.cfg.rps.filter(r => !q || (r.name + r.id + r.region).toLowerCase().includes(q.toLowerCase()));
  return (
    <Card flush>
      <div className="stools"><div className="stools__row"><Input id="r-q" value={q} onChange={setQ} placeholder="Search RPs" aria-label="Search RPs" /><div className="gspx-grow" />{canEdit && <Button kind="primary" onClick={() => onEdit(null)}>Add RP terms</Button>}</div>
        <p className="stools__count"><span><span className="num">{rows.length}</span> RPs with terms. RPs without terms get the default ({c.cfg.settings.defaultPct}%) and an exception.</span></p></div>
      <Table head={['RP', 'Terms', 'Payee', 'Currency and bank', 'GST', '']}>
        {rows.map(r => (
          <tr key={r.id} className="irow">
            <td className="cfg__strong">{r.name}<span className="irow__sub">{r.id} · {r.region}{r.mp ? ' · Master Partner' : ''}</span></td>
            <td>{r.flat != null && r.flat !== '' ? `Own flat ${r.flat}%` : sch[r.scheme] ? `${sch[r.scheme].id} ${sch[r.scheme].name}` : <Pill tone="dpill--bad">No terms</Pill>}</td>
            <td>{r.payee ? `Master Partner: ${(byId[r.payee] || {}).name || r.payee}` : 'Itself'}</td>
            <td>{r.cur} · {r.bank === 'AU' ? 'Australian account' : 'Local account'}{r.bankVerified === false && <span className="irow__sub">Bank change not verified: payouts held</span>}</td>
            <td>{r.gst ? 'Registered' : '—'}</td>
            <td><LinkButton onClick={() => onEdit(r)}>{canEdit ? 'Edit' : 'View'}</LinkButton></td>
          </tr>))}
      </Table>
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
            <td><LinkButton onClick={() => onEdit(x)}>{canEdit ? 'Edit' : 'View'}</LinkButton></td>
          </tr>))}
      </Table>
    </Card>
  );
}

const NKIND = { tier: 'Tier %', flat: 'Flat %', flatfixed: 'Flat % plus a fixed amount', milestone: 'Milestone lump sums' };
const COMBINE = { box: 'Separate box (doesn’t count toward the RP’s tier)', highest: 'Highest of the two wins', adds: 'Adds on top' };
function Notices({ c, canEdit, onEdit }) {
  const live = n => (!n.start || n.start <= c.today) && (!n.end || n.end >= c.today);
  return (
    <Card flush>
      <div className="stools"><div className="stools__row"><span className="muted gspx-grow">Notices, addenda, flyers and email approvals that change what RPs are paid, for a time.</span>{canEdit && <Button kind="primary" onClick={() => onEdit(null)}>Add notice</Button>}</div></div>
      <Table head={['Notice', 'Who', 'When (enrolment dates)', 'Where', 'Structure', '']}>
        {c.cfg.notices.map(n => (
          <tr key={n.id} className="irow">
            <td className="cfg__strong">{n.id} {n.name}<span className="irow__sub">{n.doc || ''}{n.note ? ` · ${n.note}` : ''}</span></td>
            <td>{(n.rps || []).length ? `${n.rps.length} listed RP${n.rps.length > 1 ? 's' : ''}` : `Every RP in ${n.region}`}</td>
            <td className="num">{nice(n.start)} – {nice(n.end)}<span className="irow__sub">{live(n) ? 'Live' : n.start > c.today ? 'Not started' : 'Ended'}</span></td>
            <td>{(n.dest || []).length ? n.dest.map(d => DEST[d] || d).join(', ') : 'Any destination'}</td>
            <td><span className="gspx-wrap">{NKIND[n.kind]}{n.kind === 'tier' ? `: ${bandTxt(n.bands || [])}` : n.kind === 'milestone' ? `: ${(n.milestones || []).map(m => `${m[0]} → ${n.fixedCur || 'AUD'} ${m[1]}`).join(', ')}` : n.flat != null ? `: ${n.flat}%` : ''}</span><span className="irow__sub">{COMBINE[n.combine] || ''}</span></td>
            <td><LinkButton onClick={() => onEdit(n)}>{canEdit ? 'Edit' : 'View'}</LinkButton></td>
          </tr>))}
      </Table>
    </Card>
  );
}

/* ---------- editors ---------- */
function useDraft(init) {
  const [d, setD] = useState(() => structuredClone(init));
  const set = (k, v) => setD(x => ({ ...x, [k]: v }));
  return [d, set, setD];
}
const num = v => (v === '' || v == null ? null : Number(v));

function Bands({ bands, onChange, unit = '%' }) {
  const set = (i, j, v) => onChange(bands.map((b, k) => k === i ? b.map((x, m) => m === j ? num(v) : x) : b));
  return (
    <div className="gspx-bands">
      {bands.map((b, i) => (
        <div className="gspx-inline" key={i}>
          <span className="muted">From</span><input className="gspx-num" aria-label={`Band ${i + 1} from`} type="number" value={b[0] ?? ''} onChange={e => set(i, 0, e.target.value)} />
          <span className="muted">to</span><input className="gspx-num" aria-label={`Band ${i + 1} to`} type="number" placeholder="no limit" value={b[1] ?? ''} onChange={e => set(i, 1, e.target.value)} />
          <span className="muted">enrolments →</span><input className="gspx-num" aria-label={`Band ${i + 1} rate`} type="number" value={b[2] ?? ''} onChange={e => set(i, 2, e.target.value)} /><span className="muted">{unit}</span>
          {bands.length > 1 && <LinkButton onClick={() => onChange(bands.filter((_, k) => k !== i))}>Remove</LinkButton>}
        </div>))}
      <LinkButton onClick={() => { const last = bands[bands.length - 1] || [0, null, 70]; onChange([...bands.slice(0, -1), [last[0], (last[0] || 0) + 4, last[2]], [(last[0] || 0) + 5, null, (last[2] || 70) + 5]]); }}>Add a band</LinkButton>
    </div>
  );
}

function Foot({ onClose, onSave, ro }) {
  return <>{!ro && <span className="muted gspx-grow">A second Finance person approves before it applies.</span>}<Button onClick={onClose}>{ro ? 'Close' : 'Cancel'}</Button>{!ro && <Button kind="primary" onClick={onSave}>Send for checking</Button>}</>;
}

function UniSheet({ ro, c, u, onClose, propose }) {
  const [d, set] = useDraft(u);
  const lv = Object.keys(LEVELS);
  const save = () => propose('unis', u.id, u, d, `${u.name} terms`);
  return (
    <Sheet title={u.name} sub="University terms. What the contract says is at the end." onClose={onClose} wide footer={<Foot ro={ro} onClose={onClose} onSave={save} />}>
      <div className="gspx-grid2">
        <div className="gspx-form2">
          <Select id="u-trig" label="Commission is earned at" value={d.trigger} onChange={v => set('trigger', v)} options={Object.entries(TRIG)} />
          <Select id="u-inst" label="First-year instalments" value={String(d.inst)} onChange={v => set('inst', Number(v))} options={[['1', '1 (once a year)'], ['2', '2 (per semester)'], ['3', '3 (per trimester)']]} />
          <Field id="u-days" label="Days to pay an invoice"><Input id="u-days" type="number" value={d.payDays} onChange={v => set('payDays', v)} /></Field>
          <Field id="u-cap" label="Cap per student (first year)" hint="Leave blank for no cap"><Input id="u-cap" type="number" value={d.cap ?? ''} onChange={v => set('cap', num(v))} /></Field>
          <Field id="u-end" label="Contract ends"><Input id="u-end" type="date" value={d.ends || ''} onChange={v => set('ends', v)} /></Field>
          <Select id="u-cur" label="Currency" value={d.cur} onChange={v => set('cur', v)} options={CURS} />
          <div className="field"><span className="field__label">Rates by level (% of tuition)</span>
            <div className="gspx-rates">{lv.map(k => (
              <label key={k} className="gspx-rate"><span>{LEVELS[k]}</span>
                <input className="gspx-num" type="number" placeholder="Not paid" value={(d.levels || {})[k] ?? ''} onChange={e => set('levels', { ...(d.levels || {}), [k]: num(e.target.value) })} /></label>))}</div></div>
          <div className="field"><span className="field__label">Annuity (year 2 onwards)</span>
            <label className="gspx-check"><input type="checkbox" checked={!!(d.annuity && d.annuity.on)} onChange={e => set('annuity', e.target.checked ? { on: true, maxYears: d.annuity?.maxYears ?? null } : null)} /> The university pays commission for every year of the course</label>
            {d.annuity && d.annuity.on && <div className="gspx-inline"><span className="muted">Up to</span><input className="gspx-num" type="number" aria-label="Annuity years" placeholder="course length" value={d.annuity.maxYears ?? ''} onChange={e => set('annuity', { ...d.annuity, maxYears: num(e.target.value) })} /><span className="muted">years</span></div>}</div>
          {d.tier && <div className="field"><span className="field__label">University tier ({d.tier.retro ? 'retrospective' : 'prospective'}, all GSP students{d.tier.scope === 'country' ? ' per source country' : ''})</span>
            <Bands bands={d.tier.bands} onChange={b => set('tier', { ...d.tier, bands: b })} /></div>}
        </div>
        <dl className="gspx-dl">
          <dt>Rate</dt><dd>{u.contract?.rate || '—'}</dd>
          <dt>Periods</dt><dd>{u.contract?.periods || '—'}</dd>
          <dt>Trigger</dt><dd>{u.contract?.trigger || '—'}</dd>
          <dt>Tier</dt><dd>{u.contract?.tier || '—'}</dd>
          <dt>Clawback</dt><dd>{u.contract?.claw || '—'}</dd>
          <dt>After the contract ends</dt><dd>{u.contract?.after || '—'}</dd>
          <dt>Source</dt><dd>{u.contract?.src || '—'}</dd>
          {u.flag && <><dt>Open point</dt><dd>{u.flag}</dd></>}
        </dl>
      </div>
    </Sheet>
  );
}

function RpSheet({ ro, c, r, onClose, propose }) {
  const blank = { id: '', name: '', region: 'India', scheme: 'S05', flat: null, gst: false, cur: 'AUD', bank: 'AU', payee: '', mp: false, annuityPct: null, note: '', bankVerified: true };
  const [d, set] = useDraft(r || blank);
  const own = d.flat != null && d.flat !== '';
  // the sales regions Admin keeps, plus the regions already on RP terms (Australia Onshore is Finance's own)
  const regions = [...new Set([...SALES_REGIONS, ...c.cfg.rps.map(x => x.region).filter(Boolean), 'Australia Onshore'])];
  const mps = c.cfg.rps.filter(x => x.mp && x.id !== d.id);
  const save = () => {
    if (!d.id || !d.name) { toast('Give the RP its ID and name.'); return; }
    propose('rps', r ? r.id : d.id, r || null, d, `${d.name} RP terms${r ? '' : ' (new)'}`);
  };
  return (
    <Sheet title={r ? r.name : 'Add RP terms'} sub="From the RP’s signed agreement" onClose={onClose} wide footer={<Foot ro={ro} onClose={onClose} onSave={save} />}>
      <div className="gspx-form2">
        {!r && <><Field id="rp-id" label="RP ID" required><Input id="rp-id" value={d.id} onChange={v => set('id', v)} /></Field>
          <Field id="rp-n" label="RP name" required><Input id="rp-n" value={d.name} onChange={v => set('name', v)} /></Field>
          <Select id="rp-reg" label="Sales region" value={d.region} onChange={v => set('region', v)} options={regions} /></>}
        <Select id="rp-terms" label="Terms" value={own ? 'own' : d.scheme} onChange={v => v === 'own' ? set('flat', 80) : (set('flat', null), set('scheme', v))}
          options={[['own', 'Own flat rate'], ...c.cfg.schemes.map(x => [x.id, `${x.id} ${x.name}`])]} />
        {own && <Field id="rp-flat" label="Own flat rate (% of GSP’s commission)"><Input id="rp-flat" type="number" value={d.flat} onChange={v => set('flat', v)} /></Field>}
        <Select id="rp-cur" label="Payout currency" value={d.cur} onChange={v => set('cur', v)} options={CURS} />
        <Select id="rp-bank" label="Bank account" value={d.bank} onChange={v => set('bank', v)} options={[['AU', 'Australian account (batch 1)'], ['Local', 'Local account (batch 2)']]} />
        <Select id="rp-payee" label="Paid through a Master Partner?" value={d.payee || ''} onChange={v => set('payee', v)} placeholder="No, GSP pays the RP" options={mps.map(x => [x.id, x.name])} />
        <Field id="rp-ann" label="Own annuity share (%)" hint={`Blank: the setting (${c.cfg.settings.annuityRp === 'same' ? 'same as year 1' : c.cfg.settings.annuityRp})`}><Input id="rp-ann" type="number" value={d.annuityPct ?? ''} onChange={v => set('annuityPct', num(v))} /></Field>
        <label className="gspx-check"><input type="checkbox" checked={!!d.gst} onChange={e => set('gst', e.target.checked)} /> Registered for GST</label>
        <label className="gspx-check"><input type="checkbox" checked={!!d.mp} onChange={e => set('mp', e.target.checked)} /> This RP is a Master Partner (other RPs are paid through it)</label>
        <label className="gspx-check"><input type="checkbox" checked={d.bankVerified !== false} onChange={e => set('bankVerified', e.target.checked)} /> Bank details verified</label>
        <Field id="rp-note" label="Note"><Input id="rp-note" value={d.note} onChange={v => set('note', v)} /></Field>
      </div>
      {d.payee && <Notice>GSP pays the Master Partner on the Master Partner’s own terms. What the Master Partner pays this RP stays between them, outside GSP.</Notice>}
    </Sheet>
  );
}

function SchemeSheet({ ro, c, x, onClose, propose }) {
  const next = 'S' + String(c.cfg.schemes.length + 1).padStart(2, '0');
  const [d, set] = useDraft(x || { id: next, name: '', region: 'All', type: 'tier', bands: [[1, 4, 70], [5, null, 75]], retro: 'no', window: 'CY', flat: null, note: '' });
  const save = () => { if (!d.name) { toast('Give the scheme a name.'); return; } propose('schemes', d.id, x || null, d, `scheme ${d.id} ${d.name}${x ? '' : ' (new)'}`); };
  return (
    <Sheet title={x ? `${x.id} ${x.name}` : 'Add scheme'} onClose={onClose} wide footer={<Foot ro={ro} onClose={onClose} onSave={save} />}>
      <div className="gspx-form2">
        <Field id="s-n" label="Name" required><Input id="s-n" value={d.name} onChange={v => set('name', v)} /></Field>
        <Field id="s-r" label="Region"><Input id="s-r" value={d.region} onChange={v => set('region', v)} /></Field>
        <Select id="s-t" label="Structure" value={d.type} onChange={v => set('type', v)} options={[['tier', 'Tier by number of enrolments'], ['flat', 'Flat %']]} />
        {d.type === 'flat' ? <Field id="s-f" label="Flat % of GSP’s commission"><Input id="s-f" type="number" value={d.flat} onChange={v => set('flat', v)} /></Field> : <>
          <Select id="s-re" label="When a higher band is reached" value={d.retro} onChange={v => set('retro', v)} options={[['no', 'Prospective: only later enrolments get it'], ['yes', 'Retrospective: every enrolment in the window gets it'], ['top', 'Retrospective only at the top band']]} />
          <Select id="s-w" label="Counted per" value={d.window} onChange={v => set('window', v)} options={Object.entries(winName)} /></>}
      </div>
      {d.type === 'tier' && <div className="field"><span className="field__label">Bands (enrolments GSP has been paid for)</span><Bands bands={d.bands} onChange={b => set('bands', b)} /></div>}
    </Sheet>
  );
}

function NoticeSheet({ ro, c, x, onClose, propose }) {
  const next = 'N' + String(c.cfg.notices.length + 1).padStart(2, '0');
  const [d, set] = useDraft(x || { id: next, name: '', region: 'India', doc: 'Notice', rps: [], start: c.today, end: '', dest: [], unis: [], kind: 'flat', flat: 80, bands: [[1, 10, 80], [11, null, 85]], milestones: [[10, 1000]], fixed: null, fixedCur: 'AUD', retro: 'no', combine: 'box', note: '' });
  const [pick, setPick] = useState('');
  const save = () => { if (!d.name || !d.start) { toast('Give the notice a name and a start date.'); return; } propose('notices', d.id, x || null, d, `notice ${d.id} ${d.name}${x ? '' : ' (new)'}`); };
  const rpName = id => (c.cfg.rps.find(r => r.id === id) || {}).name || id;
  return (
    <Sheet title={x ? `${x.id} ${x.name}` : 'Add notice'} sub="From the notice, addendum, flyer or email approval" onClose={onClose} wide footer={<Foot ro={ro} onClose={onClose} onSave={save} />}>
      <div className="gspx-form2">
        <Field id="n-n" label="Name" required><Input id="n-n" value={d.name} onChange={v => set('name', v)} /></Field>
        <Select id="n-doc" label="Source document" value={d.doc} onChange={v => set('doc', v)} options={['Notice', 'Addendum', 'Flyer', 'Email approval']} />
        <Field id="n-s" label="Enrolments from" required><Input id="n-s" type="date" value={d.start} onChange={v => set('start', v)} /></Field>
        <Field id="n-e" label="Enrolments to"><Input id="n-e" type="date" value={d.end} onChange={v => set('end', v)} /></Field>
        <Field id="n-r" label="Region (when no RPs are listed)"><Input id="n-r" value={d.region} onChange={v => set('region', v)} /></Field>
        <Select id="n-k" label="Structure" value={d.kind} onChange={v => set('kind', v)} options={Object.entries(NKIND)} />
        {(d.kind === 'flat' || d.kind === 'flatfixed') && <Field id="n-f" label="% of GSP’s commission"><Input id="n-f" type="number" value={d.flat} onChange={v => set('flat', v)} /></Field>}
        {d.kind === 'flatfixed' && <Field id="n-fx" label="Plus a fixed amount per enrolment (AUD)"><Input id="n-fx" type="number" value={d.fixed ?? ''} onChange={v => set('fixed', num(v))} /></Field>}
        {d.kind !== 'milestone' && <Select id="n-c" label="How it combines with the RP’s own terms" value={d.combine} onChange={v => set('combine', v)} options={Object.entries(COMBINE)} />}
      </div>
      {d.kind === 'tier' && <div className="field"><span className="field__label">Bands</span><Bands bands={d.bands} onChange={b => set('bands', b)} /></div>}
      {d.kind === 'milestone' && <div className="field"><span className="field__label">Milestones: lump sum once GSP is paid for this many enrolments</span>
        <Bands bands={d.milestones.map(m => [m[0], null, m[1]])} unit={d.fixedCur || 'AUD'} onChange={b => set('milestones', b.map(m => [m[0], m[2]]))} /></div>}
      <div className="field"><span className="field__label">Destinations (none = any)</span>
        <div className="gspx-checks">{Object.entries(DEST).map(([k, v]) => <label key={k} className="gspx-check"><input type="checkbox" checked={(d.dest || []).includes(k)} onChange={e => set('dest', e.target.checked ? [...(d.dest || []), k] : d.dest.filter(z => z !== k))} />{v}</label>)}</div></div>
      <div className="field"><span className="field__label">Listed RPs (none = every RP in the region)</span>
        <div className="cfg__chips">{(d.rps || []).map(id => <Chip key={id} onRemove={() => set('rps', d.rps.filter(z => z !== id))}>{rpName(id)}</Chip>)}</div>
        <div className="gspx-inline"><Select id="n-add" label="Add an RP" hideLabel value={pick} onChange={setPick} placeholder="Add an RP" options={c.cfg.rps.filter(r => !(d.rps || []).includes(r.id)).map(r => [r.id, r.name])} />
          <Button disabled={!pick} onClick={() => { set('rps', [...(d.rps || []), pick]); setPick(''); }}>Add</Button></div></div>
      <Field id="n-note" label="Open point or note"><Input id="n-note" value={d.note} onChange={v => set('note', v)} /></Field>
    </Sheet>
  );
}

export function Settings({ c, canEdit, propose }) {
  const S = c.cfg.settings;
  const [d, set, setD] = useDraft(S);
  const weekOf = c.today; const rows = [...d.fx].sort((a, b) => a.week < b.week ? -1 : 1);
  const cur = rows.filter(w => w.week <= weekOf).pop();
  const ccy = ['GBP', 'NZD', 'USD', 'INR', 'NPR', 'BDT', 'LKR', 'VND'];
  const setRate = (k, v) => setD(x => ({ ...x, fx: x.fx.map(w => w.week === cur.week ? { ...w, [k]: num(v) } : w) }));
  const addWeek = () => { const last = rows[rows.length - 1]; const wk = new Date(Date.parse(last.week) + 7 * 864e5).toISOString().slice(0, 10); setD(x => ({ ...x, fx: [...x.fx, { ...last, week: wk }] })); };
  const changed = JSON.stringify(d) !== JSON.stringify(S);
  return (
    <>
      <Card>
        <h2 className="gspx-h3">Defaults and rules</h2>
        <div className="gspx-form2">
          <Select id="st-dm" label="RP with no terms" value={d.defaultMode} onChange={v => set('defaultMode', v)} options={[['flat', 'Pay the default % and flag it'], ['hold', 'Hold in exceptions']]} />
          <Field id="st-dp" label="Default % (new contract)"><Input id="st-dp" type="number" value={d.defaultPct} onChange={v => set('defaultPct', v)} /></Field>
          <Field id="st-gl" label="GSP lead: RP gets (%)"><Input id="st-gl" type="number" value={d.gspLeadPct} onChange={v => set('gspLeadPct', v)} /></Field>
          <Select id="st-an" label="RP share of annuity" value={d.annuityRp} onChange={v => set('annuityRp', v)} options={[['same', 'Same % as the first year'], ['flat', 'A flat %'], ['none', 'Not shared']]} />
          {d.annuityRp === 'flat' && <Field id="st-ap" label="Annuity share (%)"><Input id="st-ap" type="number" value={d.annuityPct ?? ''} onChange={v => set('annuityPct', num(v))} /></Field>}
          <Field id="st-ag" label="GST on Australian university invoices (%)"><Input id="st-ag" type="number" value={d.auGst} onChange={v => set('auGst', v)} /></Field>
          <Field id="st-rg" label="GST on RP payouts, if registered (%)"><Input id="st-rg" type="number" value={d.rpGst} onChange={v => set('rpGst', v)} /></Field>
          <Field id="st-wh" label="Withholding for India RPs (%)" hint="Decided: none. GSP pays from the Australian entity."><Input id="st-wh" type="number" value={d.wht?.India ?? ''} onChange={v => set('wht', { ...d.wht, India: num(v) })} /></Field>
          <Field id="st-lg" label="Send unrecovered clawbacks to Legal after (days)"><Input id="st-lg" type="number" value={d.legalDays} onChange={v => set('legalDays', v)} /></Field>
          <Field id="st-fb" label="No census date: use start + (weeks)"><Input id="st-fb" type="number" value={d.fallbackWeeks} onChange={v => set('fallbackWeeks', v)} /></Field>
          <label className="gspx-check"><input type="checkbox" checked={!!d.selfCheck} onChange={e => set('selfCheck', e.target.checked)} /> Allow the maker to check their own change (not recommended)</label>
        </div>
      </Card>
      <Card>
        <h2 className="gspx-h3">FX rates · week of {cur ? nice(cur.week) : '—'}</h2>
        <p className="muted">AUD for 1 unit. Filled each Monday, confirmed by Finance. A payout run is held for a currency with no rate this week.</p>
        {cur && <div className="gspx-rates">{ccy.map(k => (
          <label key={k} className="gspx-rate"><span>{k}</span><input className="gspx-num" type="number" step="any" placeholder="Missing" value={cur[k] ?? ''} onChange={e => setRate(k, e.target.value)} disabled={!canEdit} /></label>))}</div>}
        {canEdit && <div className="gspx-inline"><LinkButton onClick={addWeek}>Add next week (copy of the last)</LinkButton></div>}
      </Card>
      {canEdit && <div className="gspx-inline"><Button kind="primary" disabled={!changed} onClick={() => propose('settings', 'settings', S, d, 'commission settings and FX')}>Send for checking</Button>{changed && <LinkButton onClick={() => setD(structuredClone(S))}>Undo changes</LinkButton>}</div>}
    </>
  );
}
