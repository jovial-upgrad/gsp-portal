import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { MultiPick } from '../../components/MultiPick';
import { SearchPick } from '../../institution/records/SearchPick';
import { ErrorText, Facts, useAsk } from '../../institution/records/parts';
import { CURRENCY } from '../../data/courses';
import { todayIso } from '../../institution/data/records';
import { BandsEditor, FilePick, bandsError, numOf, numText } from './parts';
import { COUNTRIES } from '../../data/partners';
import { AddlEditor, RuleCard, RuleList, BandBonusEditor, COMM_LEVELS, FormSec, IntakePick, MilestonesEditor, PromosEditor, RateRowsEditor, SchemesEditor, addlBad, bandBonusBad, cleanCond, condOpts, milestoneBad, promoBad, rateRowBad, schemeBad } from './editors';
import { acceptedOn, acceptedRps, saveRpView, ctxRps, ctxUnis, levelsOf, newAgreementId, newGroupId, newNoticeId, saveAgreement, saveGroup, saveNotice, saveRecord, saveSettings, saveTerms, termsEffect, uniName, useComm } from './store';
import {
  AB_WHEN,
  ANNUITY_RULES,
  RP_VIEW_KINDS,
  RP_VIEW_PERIODS,
  type RpView,
  type RpViewKind,
  type RpViewPeriods,
  CHARGE_UNITS,
  COMBINES,
  PAY_UNITS,
  BENEFITS,
  COUNTED_PER,
  DESTINATIONS,
  FEE_BASES,
  LEVELS,
  SHARE_TYPES,
  TRIGGER_LABELS,
  UNI_COUNTED_PER,
  YES_NO,
  dayText,
  money,
  type Agreement,
  type AgreementBonus,
  type AgreementTerms,
  type Band,
  type Benefit,
  type Charge,
  type ChargeUnit,
  type Combine,
  type PayUnit,
  type Settings,
  type UniGroup,
  type FileRef,
  type Level,
  type Notice,
  type TermsBody,
  type Trigger,
  type UniCountedPer,
  type UniTerms,
} from './model';

/** A Setup form: a centred sheet with Cancel and Save on the right. */
function FormSheet({ open, title, sub, onClose, onSave, children, saveLabel = 'Save' }: { open: boolean; title: string; sub?: ReactNode; onClose: () => void; onSave: () => void; children: ReactNode; saveLabel?: string }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title={title}
      sub={sub}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSave}>{saveLabel}</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">{children}</div>
    </Sheet>
  );
}
const pctBad = (n: number | null, required: boolean) => (n === null ? required : !(n > 0 && n <= 100));
const wholeIn = (n: number | null, lo: number, hi: number) => n !== null && Number.isInteger(n) && n >= lo && n <= hi;
/** A select's choices from a settings list. A plain function, not a component: SelectInput reads the option elements among its
 *  children to build its list, and can't see inside a component (9 Nov: `<Options>` left every such list empty). */
const options = (list: readonly string[]) =>
  list.map((x) => (
    <option key={x} value={x}>
      {x}
    </option>
  ));
function Area({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="control iform__area">
      <textarea id={id} className="control__input" rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------- Agreement ---------- */

type AgDraft = AgreementTerms & { id: string; name: string };
const blankAg = (): AgDraft => ({ id: '', name: '', shareType: 'Flat', share: null, bands: [], countedPer: 'Financial year', retro: false, addl: null, bonuses: [], payDays: 30, details: '', doc: null });

/** Add and Edit Agreement (the PRD's form): name, share or bands, how they're counted, what's passed on, pay within, details and document. */
export function AgreementForm({ open, edit, me, onClose, onSaved }: { open: boolean; edit: Agreement | null; me: string; onClose: () => void; onSaved: (name: string) => void }) {
  const s = useComm();
  const [v, setV] = useState<AgDraft>(blankAg);
  const [tried, setTried] = useState(false);
  const [big, setBig] = useState(false);
  // Q41 (Jovial, 10 Nov): an edit has an Effective from date; enrolments whose intake starts before it keep the terms before
  const [from, setFrom] = useState(todayIso());
  useEffect(() => {
    if (!open) return;
    setV(edit ? { ...edit } : blankAg());
    setTried(false);
    setBig(false);
    setFrom(todayIso());
  }, [open, edit]);
  const set = (p: Partial<AgDraft>) => setV((x) => ({ ...x, ...p }));
  const flat = v.shareType === 'Flat';
  const lastFrom = edit ? [...edit.earlier].map((x) => x.until).sort().pop() ?? '' : '';
  const err = {
    claim: v.claimMonths != null && !wholeIn(v.claimMonths, 1, 120) ? 'A whole number of months, 1 to 120.' : null,
    name: !v.name.trim() ? 'Name the agreement.' : s.agreements.some((a) => a.id !== v.id && a.name.trim().toLowerCase() === v.name.trim().toLowerCase()) ? 'There’s already an agreement with this name.' : null,
    share: flat && pctBad(v.share, true) ? 'A number from 0 to 100.' : null,
    bands: !flat ? bandsError(v.bands) : null,
    addl: pctBad(v.addl, false) ? 'A number from 0 to 100.' : null,
    bonuses: v.bonuses.some((b) => !b.desc.trim() || !(b.amount > 0) || (b.when !== AB_WHEN[0] && !wholeIn(b.nth, 1, 999))) ? 'Give each bonus a description, an amount and, for an enrolment number, the number.' : null,
    payDays: !wholeIn(v.payDays, 1, 90) ? 'A whole number from 1 to 90.' : null,
    doc: big ? `The file is over ${s.settings.maxFileMb} MB.` : null,
    from: edit && (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from <= lastFrom) ? (lastFrom ? `A date after ${lastFrom}, the last edit’s.` : 'Pick the date the new terms start.') : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const upBonus = (i: number, p: Partial<AgreementBonus>) => set({ bonuses: v.bonuses.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const name = v.name.trim();
    saveAgreement({ ...v, name, id: v.id || newAgreementId(), share: flat ? v.share : null, bands: flat ? [] : v.bands, status: edit?.status ?? 'Active' }, me, from);
    onSaved(name);
  };
  return (
    <FormSheet open={open} title={edit ? `Edit ${edit.name}` : 'Add Agreement'} sub={edit ? 'Applies to enrolments whose intake starts on or after Effective from. Earlier ones keep the terms before; lines already invoiced never change.' : undefined} onClose={onClose} onSave={save}>
      <FormSec title="The agreement" />
      <Field id="cag-name" label="Name" required error={show('name')} className="iform__wide">
        <TextInput id="cag-name" maxLength={80} value={v.name} invalid={!!show('name')} placeholder="Like: Standard agreement 2026" onChange={(e) => set({ name: e.target.value })} />
      </Field>
      {edit && (
        <Field id="cag-from" label="Effective from" required error={show('from')} hint="The intake start date the changed terms apply from.">
          <TextInput id="cag-from" type="date" value={from} invalid={!!show('from')} onChange={(e) => setFrom(e.target.value)} />
        </Field>
      )}
      <FormSec title="The RP’s share" note="A share of GSP’s base commission on each student: flat, or by how many students the RP enrols." />
      <Field id="cag-type" label="Share type" required>
        <SelectInput id="cag-type" value={v.shareType} onChange={(e) => set({ shareType: e.target.value as AgDraft['shareType'] })}>
          {options(SHARE_TYPES)}
        </SelectInput>
      </Field>
      {flat && (
        <Field id="cag-share" label="Share of GSP’s commission (%)" required error={show('share')}>
          <TextInput id="cag-share" inputMode="decimal" value={numText(v.share)} invalid={!!show('share')} onChange={(e) => set({ share: numOf(e.target.value) })} />
        </Field>
      )}
      {(
        <Field id="cag-counted" label="Counted per" required hint={v.countedPer === 'Financial year' ? `GSP’s financial year: 1 ${MONTH_NAMES[s.settings.fyStart - 1]} to the end of ${MONTH_NAMES[(s.settings.fyStart + 10) % 12]}.` : undefined}>
          <SelectInput id="cag-counted" value={v.countedPer} onChange={(e) => set({ countedPer: e.target.value as AgDraft['countedPer'] })}>
            {options(COUNTED_PER)}
          </SelectInput>
        </Field>
      )}
      {v.countedPer === 'Academic year' && (
        <Field id="cag-ystart" label="Academic year starts in" required>
          <SelectInput id="cag-ystart" value={String(v.yearStart ?? 1)} onChange={(e) => set({ yearStart: Number(e.target.value) })}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}
      {!flat && (
        <Field id="cag-bands" label="Bands" required error={show('bands')} className="iform__wide" hint="Enrolments from and to; the last band’s To can be empty (and above).">
          <BandsEditor id="cag-bands" bands={v.bands} invalid={!!show('bands')} onChange={(bands) => set({ bands })} />
        </Field>
      )}
      <Field id="cag-retro" label="Retrospective" optional hint="Yes: reaching a higher band raises the share of every earlier enrolment in the same period.">
        <SelectInput id="cag-retro" value={v.retro ? 'Yes' : 'No'} onChange={(e) => set({ retro: e.target.value === 'Yes' })}>
          {options(YES_NO)}
        </SelectInput>
      </Field>
      {v.retro && !flat && (
        <Field id="cag-retrotop" label="Only once the top band is reached" optional hint="Yes: earlier enrolments are raised only when the last band is reached.">
          <SelectInput id="cag-retrotop" value={v.retroTop ? 'Yes' : 'No'} onChange={(e) => set({ retroTop: e.target.value === 'Yes' })}>
            {options(YES_NO)}
          </SelectInput>
        </Field>
      )}
      <FormSec title="Payment" />
      <Field id="cag-pay" label="Pay within (days)" required error={show('payDays')} hint="Days after GSP receives the RP’s accepted invoice.">
        <TextInput id="cag-pay" inputMode="numeric" value={numText(v.payDays)} invalid={!!show('payDays')} onChange={(e) => set({ payDays: numOf(e.target.value) ?? NaN })} />
      </Field>
      <Field id="cag-claim" label="The RP can claim for (months)" optional error={show('claim')} hint={`After the study period ends. Empty: Settings’ ${s.settings.rpClaimMonths} months. Past it the line stays and Finance adjusts the books; the RP isn’t told.`}>
        <TextInput id="cag-claim" inputMode="numeric" value={numText(v.claimMonths ?? null)} invalid={!!show('claim')} onChange={(e) => set({ claimMonths: numOf(e.target.value) })} />
      </Field>
      <Field id="cag-addl" label="Additional commission passed on (%)" optional error={show('addl')} hint="Share of any additional commission the university pays. Empty: the same as the share above.">
        <TextInput id="cag-addl" inputMode="decimal" value={numText(v.addl)} invalid={!!show('addl')} onChange={(e) => set({ addl: numOf(e.target.value) })} />
      </Field>
      <FormSec title="Bonus" note="The RP’s own bonus, paid whether or not GSP meets a university’s bonus tier. No RP gets a share of a bonus a university pays GSP. The amount is in each enrolment’s university currency." />
      <div className="cform__list">
        {v.bonuses.map((b, i) => (
          <div key={b.id} className="cform__row cform__row--agbonus">
            <TextInput id={`cag-bn-d-${i}`} aria-label={`Bonus ${i + 1}: description`} placeholder="Like: Milestone bonus" value={b.desc} onChange={(e) => upBonus(i, { desc: e.target.value })} />
            <TextInput id={`cag-bn-a-${i}`} aria-label={`Bonus ${i + 1}: amount, in the university’s currency`} placeholder="Amount" inputMode="decimal" value={numText(b.amount)} onChange={(e) => upBonus(i, { amount: numOf(e.target.value) ?? NaN })} />
            <SelectInput id={`cag-bn-w-${i}`} aria-label={`Bonus ${i + 1}: when`} value={b.when} onChange={(e) => upBonus(i, { when: e.target.value as AgreementBonus['when'], nth: e.target.value === AB_WHEN[0] ? null : b.nth })}>
              {options(AB_WHEN)}
            </SelectInput>
            {b.when === AB_WHEN[0] ? (
              <span aria-hidden="true" />
            ) : (
              <TextInput id={`cag-bn-n-${i}`} aria-label={`Bonus ${i + 1}: the enrolment number, counted per ${v.countedPer.toLowerCase()}`} placeholder="Enrolment no." inputMode="numeric" value={numText(b.nth)} onChange={(e) => upBonus(i, { nth: numOf(e.target.value) })} />
            )}
            <button type="button" className="icon-btn" aria-label={`Remove bonus ${i + 1}`} onClick={() => set({ bonuses: v.bonuses.filter((_, j) => j !== i) })}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        {show('bonuses') && <ErrorText id="cag-bn-err">{show('bonuses')}</ErrorText>}
        <button type="button" className="btn btn--secondary btn--sm iadd" style={{ justifySelf: 'start' }} onClick={() => set({ bonuses: [...v.bonuses, { id: `ab-${Date.now().toString(36)}-${++rid}`, desc: '', amount: NaN, when: AB_WHEN[0], nth: null }] })}>
          <Icon name="plus" size={16} /> Add bonus
        </button>
      </div>
      <FormSec title="Details and document" />
      <Field id="cag-details" label="Agreement details" optional className="iform__wide" hint="Shown on every RP’s Commission tab.">
        <Area id="cag-details" value={v.details} placeholder="Anything else the agreement says" onChange={(details) => set({ details })} />
      </Field>
      <Field id="cag-doc" label="Agreement document" optional error={show('doc')} hint={`PDF, up to ${s.settings.maxFileMb} MB. Shown to preview on the RP’s Commission tab.`} className="iform__wide">
        <FilePick id="cag-doc" value={v.doc} accept=".pdf,application/pdf" maxMb={s.settings.maxFileMb} invalid={!!show('doc')} onTooBig={setBig} onChange={(doc) => set({ doc })} />
      </Field>
    </FormSheet>
  );
}

/* ---------- RP record ---------- */

/**
 * Add and Edit RP record: the RP (only RPs with an accepted agreement and no record), its agreement (active ones),
 * From, an own flat share and a share after year 1; its business details, read only. Moving it to
 * another agreement asks first.
 */
export function RecordForm({ open, rp: editRp, preset, me, onClose, onSaved, onAgreements }: { open: boolean; rp: string | null; preset?: string; me: string; onClose: () => void; onSaved: (rp: string) => void; onAgreements: () => void }) {
  const s = useComm();
  const was = editRp ? s.records.find((r) => r.rp === editRp) : undefined;
  const [rp, setRp] = useState('');
  const [agreement, setAgreement] = useState('');
  const [from, setFrom] = useState('');
  const [own, setOwn] = useState<number | null>(null);
  const [ann, setAnn] = useState<number | null>(null);
  const [view, setView] = useState<RpView>(s.settings.rpView);
  const [tried, setTried] = useState(false);
  const { ask, dialog } = useAsk();
  useEffect(() => {
    if (!open) return;
    const r = was?.rp ?? preset ?? '';
    setRp(r);
    setAgreement(was?.agreement ?? '');
    setFrom(was?.from ?? (r ? acceptedOn(r) : ''));
    setOwn(was?.ownFlat ?? null);
    setAnn(was?.annuityPct ?? null);
    setView(was?.view ?? s.settings.rpView);
    setTried(false);
  }, [open, editRp, preset]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = acceptedRps().filter((r) => !s.records.some((x) => x.rp === r.id));
  const info = ctxRps().find((r) => r.id === rp);
  const active = s.agreements.filter((a) => a.status === 'Active' || a.id === was?.agreement);
  const err = { rp: !rp ? 'Choose the RP.' : null, agreement: !agreement ? 'Choose the agreement.' : null, from: !from ? 'Choose the date.' : null, own: pctBad(own, false) ? 'A number from 0 to 100.' : null, ann: ann !== null && !(ann >= 0 && ann <= 100) ? 'A number from 0 to 100.' : null };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const name = info?.name ?? '';
  const commit = () => {
    saveRecord({ rp, agreement, from, ownFlat: own, annuityPct: ann, view }, me);
    onSaved(rp);
  };
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    if (was && (was.agreement !== agreement || was.from !== from)) {
      const ag = s.agreements.find((a) => a.id === agreement)!;
      ask(`Move ${name} to ${ag.name} from ${dayText(from)}?`, 'Move', <p>Items made from then use the new agreement; earlier ones keep theirs.</p>, commit);
    } else commit();
  };
  return (
    <>
      <FormSheet open={open} title={was ? `Edit ${name}’s record` : 'Add RP record'} onClose={onClose} onSave={save}>
        <FormSec title="The RP and its agreement" />
        <Field id="crec-rp" label="RP" required error={show('rp')} className="iform__wide">
          {was ? (
            <p className="cline">
              {name} <span className="cmuted">({info?.code})</span>
            </p>
          ) : (
            <SearchPick
              id="crec-rp"
              label="RPs with an accepted agreement and no record yet"
              placeholder="Search by name or RP ID"
              value={rp}
              invalid={!!show('rp')}
              options={pool.map((r) => ({ value: r.id, label: r.name, note: r.code }))}
              onChange={(id) => {
                setRp(id);
                setFrom(acceptedOn(id));
              }}
            />
          )}
        </Field>
        <Field
          id="crec-ag"
          label="Agreement"
          required
          error={show('agreement')}
          hint={
            <>
              Not in the list?{' '}
              <button type="button" className="btn btn--link" onClick={onAgreements}>
                Add it in Agreements first.
              </button>
            </>
          }
        >
          <SelectInput id="crec-ag" value={agreement} placeholder="Choose the agreement" invalid={!!show('agreement')} onChange={(e) => setAgreement(e.target.value)}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="crec-from" label="From" required error={show('from')} hint="The RP’s accepted agreement’s effective date, to start with.">
          <TextInput id="crec-from" type="date" value={from} invalid={!!show('from')} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <FormSec title="This RP’s own terms" note="Only when this RP’s terms differ from its agreement’s. Empty: the agreement’s." />
        <Field id="crec-own" label="Own flat share (%)" optional error={show('own')} hint="Instead of the agreement’s share, for this RP only. Empty: the agreement’s.">
          <TextInput id="crec-own" inputMode="decimal" value={numText(own)} invalid={!!show('own')} onChange={(e) => setOwn(numOf(e.target.value))} />
        </Field>
        <Field id="crec-ann" label="Share after year 1 (%)" optional error={show('ann')} hint={`For later years of a course. Empty: Settings’ rule (${s.settings.annuity.rule}${s.settings.annuity.rule === 'Flat %' && s.settings.annuity.pct != null ? ` ${s.settings.annuity.pct}%` : ''}).`}>
          <TextInput id="crec-ann" inputMode="decimal" value={numText(ann)} invalid={!!show('ann')} onChange={(e) => setAnn(numOf(e.target.value))} />
        </Field>
        <FormSec title="What the RP sees" />
        <RpViewFields idp="crec" v={view} set={setView} hint="Starts as Settings’ default. GSP sees every line." />
        {info && (
          <div className="cform__ro">
            <Facts
              items={[
                ['Business name', info.name],
                ['RP ID', <span key="c" className="num">{info.code}</span>],
                ['Sales region', info.region],
              ]}
            />
          </div>
        )}
      </FormSheet>
      {dialog}
    </>
  );
}

/* ---------- what the RP sees ---------- */

/** What an RP is shown (Jovial, 11 Nov): the kinds of line and the study periods. A line it can't see stays GSP's. */
export function RpViewFields({ idp, v, set, hint }: { idp: string; v: RpView; set: (v: RpView) => void; hint: string }) {
  return (
    <>
      <Field id={`${idp}-sees`} label="What the RP sees" optional className="iform__wide" hint={`${hint} A line the RP can’t see is never shown to it, and asking for its invoice sends it nothing.`}>
        <MultiPick id={`${idp}-sees`} label="What the RP sees" value={v.kinds} options={[...RP_VIEW_KINDS]} onChange={(x) => set({ ...v, kinds: RP_VIEW_KINDS.filter((k) => x.includes(k)) as RpViewKind[] })} empty="Nothing" />
      </Field>
      <Field id={`${idp}-periods`} label="Study periods the RP sees" required>
        <SelectInput id={`${idp}-periods`} value={v.periods} onChange={(e) => set({ ...v, periods: e.target.value as RpViewPeriods })}>
          {RP_VIEW_PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectInput>
      </Field>
    </>
  );
}

/** Finance or RP Ops changes what one RP sees, from the RP's Commission tab. */
export function RpViewForm({ open, rp, me, onClose, onSaved }: { open: boolean; rp: { id: string; name: string }; me: string; onClose: () => void; onSaved: () => void }) {
  const s = useComm();
  const rec = s.records.find((r) => r.rp === rp.id);
  const [v, setV] = useState<RpView>(rec?.view ?? s.settings.rpView);
  useEffect(() => {
    if (open) setV(rec?.view ?? s.settings.rpView);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormSheet
      open={open}
      title={`What ${rp.name} sees`}
      sub="Of its commission, on Earnings and its applications"
      onClose={onClose}
      onSave={() => {
        saveRpView(rp.id, v, me);
        onSaved();
      }}
    >
      <RpViewFields idp="cview" v={v} set={setV} hint="GSP sees every line." />
    </FormSheet>
  );
}

/* ---------- RP IDs: picked, or pasted ---------- */

/** RPs with a commission record, picked by name or RP ID, or pasted as IDs (one a line, or comma separated). */
export function RpPicker({ id, value, onChange }: { id: string; value: string[]; onChange: (ids: string[]) => void }) {
  const s = useComm();
  const pool = ctxRps().filter((r) => s.records.some((x) => x.rp === r.id));
  const label = (r: { name: string; code: string }) => `${r.name} (${r.code})`;
  const [paste, setPaste] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const add = () => {
    const codes = paste.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    const found = codes.map((c) => pool.find((r) => r.code.toLowerCase() === c.toLowerCase())).filter((r): r is (typeof pool)[number] => !!r);
    setMissing(codes.filter((c) => !pool.some((r) => r.code.toLowerCase() === c.toLowerCase())));
    onChange([...new Set([...value, ...found.map((r) => r.id)])]);
    setPaste('');
  };
  return (
    <div className="cform__list">
      <MultiPick id={id} label="RPs" value={value.map((v) => label(pool.find((r) => r.id === v) ?? { name: v, code: '' }))} options={pool.map(label)} onChange={(l) => onChange(l.map((x) => pool.find((r) => label(r) === x)?.id ?? x))} empty="No RPs yet" search />
      <div className="cform__row" style={{ gridTemplateColumns: '1fr auto' }}>
        <TextInput id={`${id}-paste`} aria-label="Paste RP IDs" placeholder="Or paste RP IDs, like AG-1003, AG-1007" value={paste} onChange={(e) => setPaste(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button variant="secondary" size="sm" onClick={add} disabled={!paste.trim()}>
          Add
        </Button>
      </div>
      {missing.length > 0 && <ErrorText id={`${id}-missing`}>Not found: {missing.join(', ')}</ErrorText>}
    </div>
  );
}

/* ---------- Notice ---------- */

type NtDraft = Omit<Notice, 'created' | 'updated' | 'doc' | 'benefit'> & { doc: FileRef | null; benefit: Benefit | '' };
const blankNt = (): NtDraft => ({ id: '', name: '', doc: null, docType: '', starts: '', ends: '', intakes: [], dests: [], unis: [], levels: [], benefit: '', amount: null, share: null, bands: [], retro: false, combine: COMBINES[0], milestones: [], tuitionPct: null, rps: [], regions: [], removed: [] });
/** Which fields a benefit uses. */
const USES: Record<Benefit, { amount?: boolean; share?: boolean; bands?: boolean; milestones?: boolean; tuition?: boolean; combine?: boolean }> = {
  'Bonus per enrolment': { amount: true },
  Share: { share: true, combine: true },
  'Tiered share': { bands: true, combine: true },
  'Share plus amount per enrolment': { share: true, amount: true, combine: true },
  Milestone: { milestones: true },
  '% of tuition': { tuition: true, combine: true },
};

/** Add and Edit Notice: name, document and its type, dates and intakes, what it applies to, its benefit and how it combines, and who may use it. */
export function NoticeForm({ open, edit, me, onClose, onSaved }: { open: boolean; edit: Notice | null; me: string; onClose: () => void; onSaved: (name: string) => void }) {
  const s = useComm();
  const [v, setV] = useState<NtDraft>(blankNt);
  const [tried, setTried] = useState(false);
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = edit ? { ...blankNt(), ...edit } : blankNt();
    setV(d);
    setTried(false);
    setBig(false);
  }, [open, edit]);
  const set = (p: Partial<NtDraft>) => setV((x) => ({ ...x, ...p }));
  const unis = ctxUnis();
  const use = v.benefit ? USES[v.benefit] : {};
  const salesRegions = [...new Set([...ctxRps().map((r) => r.region), ...Object.keys(s.settings.regionGroups)])].filter(Boolean).sort();
  const err = {
    name: !v.name.trim() ? 'Name the notice.' : s.notices.some((n) => n.id !== v.id && n.name.trim().toLowerCase() === v.name.trim().toLowerCase()) ? 'There’s already a notice with this name.' : null,
    doc: big ? `The file is over ${s.settings.maxFileMb} MB.` : !v.doc ? 'Upload the notice.' : null,
    docType: !v.docType ? 'Choose what the document is.' : null,
    dates: !v.starts || !v.ends ? 'Choose the dates.' : v.ends <= v.starts ? 'It has to end after it starts.' : null,
    benefit: !v.benefit ? 'Choose the benefit.' : null,
    amount: use.amount && !(v.amount !== null && v.amount > 0) ? 'Enter the amount.' : null,
    share: use.share && pctBad(v.share, true) ? 'A number from 0 to 100.' : null,
    bands: use.bands ? bandsError(v.bands) : null,
    milestones: use.milestones ? (!(v.milestones ?? []).length ? 'Add at least one milestone.' : (v.milestones ?? []).map(milestoneBad).find(Boolean) ?? null) : null,
    tuition: use.tuition && pctBad(v.tuitionPct ?? null, true) ? 'A number from 0 to 100.' : null,
    who: !v.rps.length && !(v.regions ?? []).length ? 'List the RPs, or choose the sales regions it’s for.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const name = v.name.trim();
    const b = v.benefit as Benefit;
    const u = USES[b];
    saveNotice(
      {
        ...v,
        name,
        id: v.id || newNoticeId(),
        doc: v.doc!,
        benefit: b,
        intakes: v.intakes ?? [],
        amount: u.amount ? v.amount : null,
        share: u.share ? v.share : null,
        bands: u.bands ? v.bands : [],
        milestones: u.milestones ? [...(v.milestones ?? [])].sort((a, b) => a.count - b.count) : [],
        tuitionPct: u.tuition ? v.tuitionPct : null,
        combine: u.combine ? v.combine : undefined,
        retro: u.bands ? v.retro : false,
      },
      me,
    );
    onSaved(name);
  };
  const uniLabel = (id: string) => unis.find((u) => u.id === id)?.name ?? id;
  return (
    <FormSheet open={open} title={edit ? `Edit ${edit.name}` : 'Add Notice'} sub="An offer to RPs for a time, on top of or instead of their agreement." onClose={onClose} onSave={save}>
      <FormSec title="The notice" />
      <Field id="cnt-name" label="Name" required error={show('name')} className="iform__wide">
        <TextInput id="cnt-name" maxLength={80} value={v.name} invalid={!!show('name')} placeholder="Like: UK Promotion 2026" onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field id="cnt-type" label="Document type" required error={show('docType')}>
        <SelectInput id="cnt-type" value={v.docType ?? ''} placeholder="Choose the type" invalid={!!show('docType')} onChange={(e) => set({ docType: e.target.value })}>
          {options(s.settings.docTypes)}
        </SelectInput>
      </Field>
      <Field id="cnt-doc" label="Notice document" required error={show('doc')} hint={`PDF, up to ${s.settings.maxFileMb} MB. Shown to each listed RP.`}>
        <FilePick id="cnt-doc" value={v.doc} accept=".pdf,application/pdf" maxMb={s.settings.maxFileMb} invalid={!!show('doc')} onTooBig={setBig} onChange={(doc) => set({ doc })} />
      </Field>
      <Field id="cnt-starts" label="Starts" required error={show('dates')} hint="Enrolments with an enrolment date in the period count.">
        <TextInput id="cnt-starts" type="date" value={v.starts} invalid={!!show('dates')} onChange={(e) => set({ starts: e.target.value })} />
      </Field>
      <Field id="cnt-ends" label="Ends" required>
        <TextInput id="cnt-ends" type="date" value={v.ends} invalid={!!show('dates')} onChange={(e) => set({ ends: e.target.value })} />
      </Field>

      <FormSec title="Who it’s for" note="List the RPs, or leave the list empty and choose sales regions: every RP in them gets it." />
      <Field id="cnt-rps" label="RPs" optional error={show('who')} className="iform__wide" hint="RPs with a commission record. An RP taken off keeps the notice for its enrolments before today.">
        <RpPicker id="cnt-rps" value={v.rps} onChange={(rps) => set({ rps })} />
      </Field>
      {!v.rps.length && (
        <Field id="cnt-regions" label="Sales regions" required error={show('who')} className="iform__wide">
          <MultiPick id="cnt-regions" label="Sales regions" value={v.regions ?? []} options={salesRegions} onChange={(regions) => set({ regions })} empty="Choose the regions" />
        </Field>
      )}

      <FormSec title="Which enrolments" note="Leave a field empty for every one." />
      <Field id="cnt-dests" label="Destinations" optional>
        <MultiPick id="cnt-dests" label="Destinations" value={v.dests} options={[...DESTINATIONS]} onChange={(x) => set({ dests: x as NtDraft['dests'] })} empty="Every destination" />
      </Field>
      <Field id="cnt-unis" label="Universities" optional>
        <MultiPick id="cnt-unis" label="Universities" value={v.unis.map(uniLabel)} options={unis.map((u) => u.name)} onChange={(x) => set({ unis: x.map((n) => unis.find((u) => u.name === n)?.id ?? n) })} empty="Every university" search />
      </Field>
      <Field id="cnt-levels" label="Program levels" optional>
        <MultiPick id="cnt-levels" label="Program levels" value={v.levels} options={[...LEVELS]} onChange={(x) => set({ levels: x as Level[] })} empty="Every program level" />
      </Field>
      <Field id="cnt-intakes" label="Intake months" optional>
        <IntakePick id="cnt-intakes" label="Intake months" value={v.intakes ?? []} onChange={(intakes) => set({ intakes })} today={todayIso()} />
      </Field>

      <FormSec title="What the RP gets" />
      <Field id="cnt-benefit" label="Benefit" required error={show('benefit')}>
        <SelectInput id="cnt-benefit" value={v.benefit} placeholder="Choose the benefit" invalid={!!show('benefit')} onChange={(e) => set({ benefit: e.target.value as Benefit })}>
          {options(BENEFITS)}
        </SelectInput>
      </Field>
      {use.combine ? (
        <Field id="cnt-combine" label="With the RP’s own share" required hint="Separate box: its own line, not counted in the RP’s band. Highest wins: the higher of the two. Adds on top: added to the RP’s share.">
          <SelectInput id="cnt-combine" value={v.combine ?? COMBINES[0]} onChange={(e) => set({ combine: e.target.value as Combine })}>
            {options(COMBINES)}
          </SelectInput>
        </Field>
      ) : (
        <span aria-hidden="true" />
      )}
      {use.amount && (
        <Field id="cnt-amount" label="Amount per enrolment" required error={show('amount')} hint="In each enrolment’s university currency. Bonuses from two notices add up.">
          <TextInput id="cnt-amount" inputMode="decimal" value={numText(v.amount)} invalid={!!show('amount')} onChange={(e) => set({ amount: numOf(e.target.value) })} />
        </Field>
      )}
      {use.share && (
        <Field id="cnt-share" label="Share of GSP’s commission (%)" required error={show('share')}>
          <TextInput id="cnt-share" inputMode="decimal" value={numText(v.share)} invalid={!!show('share')} onChange={(e) => set({ share: numOf(e.target.value) })} />
        </Field>
      )}
      {use.tuition && (
        <Field id="cnt-tuition" label="% of the tuition fee" required error={show('tuition')} hint="Of the student’s first-year tuition fee.">
          <TextInput id="cnt-tuition" inputMode="decimal" value={numText(v.tuitionPct ?? null)} invalid={!!show('tuition')} onChange={(e) => set({ tuitionPct: numOf(e.target.value) })} />
        </Field>
      )}
      {use.bands && (
        <Field id="cnt-bands" label="Bands" required error={show('bands')} className="iform__wide">
          <BandsEditor id="cnt-bands" bands={v.bands} invalid={!!show('bands')} onChange={(bands) => set({ bands })} />
        </Field>
      )}
      {use.bands && (
        <Field id="cnt-retro" label="Retrospective" optional hint="Yes: reaching a higher band raises the earlier enrolments it covers, as on agreements.">
          <SelectInput id="cnt-retro" value={v.retro ? 'Yes' : 'No'} onChange={(e) => set({ retro: e.target.value === 'Yes' })}>
            {options(YES_NO)}
          </SelectInput>
        </Field>
      )}
      {use.milestones && (
        <div className="cform__wide">
          <p className="cform__label">Milestones</p>
          <p className="cform__hint">A lump sum once GSP is paid for that many enrolments under the notice, even after it ends.</p>
          <MilestonesEditor id="cnt-ms" items={v.milestones ?? []} onChange={(milestones) => set({ milestones })} tried={tried} />
        </div>
      )}
    </FormSheet>
  );
}

/* ---------- University terms ---------- */

type TermsDraft = Omit<TermsBody, 'contract' | 'trigger' | 'payDays'> & { uni: string; contract: FileRef | null; trigger: Trigger | ''; payDays: number | null };
const blankTerms = (uni = ''): TermsDraft => ({
  uni,
  currency: '',
  rates: {},
  feeBasis: 'Tuition after scholarship',
  fixed: {},
  rateRows: [],
  trigger: '',
  triggerWeeks: null,
  payUnit: PAY_UNITS[0].label,
  charge: { unit: CHARGE_UNITS[1].label, n: 1 },
  payDays: 30,
  cap: null,
  bands: [],
  countedPer: 'Calendar year',
  yearStart: 1,
  tierRetro: true,
  tierPerCountry: false,
  tierLevels: [],
  bandBonuses: [],
  promos: [],
  addl: [],
  bonus: [],
  contract: null,
  notes: '',
});
let rid = 0;
/** January to December, as the locale names them (for an academic year's start). */
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }));
const chargeNeedsN = (u: ChargeUnit) => u !== CHARGE_UNITS[0].label;

/** A tier's options, shared by University terms and Groups: counted per, academic year start, retrospective, per country, levels. */
function TierOptions({ idp, v, set }: { idp: string; v: Pick<TermsBody, 'countedPer' | 'yearStart' | 'tierRetro' | 'tierPerCountry' | 'tierLevels'>; set: (p: Partial<TermsBody>) => void }) {
  return (
    <>
      <Field id={`${idp}-per`} label="Tier counted per" required hint="The university’s year, as its contract has it. Only students GSP will be paid for count.">
        <SelectInput id={`${idp}-per`} value={v.countedPer} onChange={(e) => set({ countedPer: e.target.value as UniCountedPer })}>
          {options(UNI_COUNTED_PER)}
        </SelectInput>
      </Field>
      {v.countedPer === 'Academic year' && (
        <Field id={`${idp}-ystart`} label="Academic year starts in" required>
          <SelectInput id={`${idp}-ystart`} value={String(v.yearStart)} onChange={(e) => set({ yearStart: Number(e.target.value) })}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}
      <Field id={`${idp}-retro`} label="Retrospective" optional hint="Yes: the band reached sets every student’s rate in the year. No: each student gets the band they fell in.">
        <SelectInput id={`${idp}-retro`} value={v.tierRetro ? 'Yes' : 'No'} onChange={(e) => set({ tierRetro: e.target.value === 'Yes' })}>
          {options(YES_NO)}
        </SelectInput>
      </Field>
      <Field id={`${idp}-country`} label="Counted per source country" optional hint="Yes: students from each country are counted on their own.">
        <SelectInput id={`${idp}-country`} value={v.tierPerCountry ? 'Yes' : 'No'} onChange={(e) => set({ tierPerCountry: e.target.value === 'Yes' })}>
          {options(YES_NO)}
        </SelectInput>
      </Field>
      <Field id={`${idp}-levels`} label="Levels in the tier" optional hint="Empty: every level counts.">
        <MultiPick id={`${idp}-levels`} label="Levels in the tier" value={v.tierLevels} options={[...LEVELS]} onChange={(x) => set({ tierLevels: x as Level[] })} empty="Every level" />
      </Field>
    </>
  );
}

/**
 * Add and Edit University terms (the sandbox's terms): currency, rates by program level (or a fixed amount) and rate rows,
 * the fee they're on, how commission is paid and for how long, the trigger, payment days, a first-year cap, tier bands
 * with their options and band bonuses, promotions, additional commission, GSP's bonus schemes, the contract and notes.
 * Saving an edit shows its effect first (D15).
 */
export function TermsForm({ open, uni: editUni, preset, me, onClose, onSaved }: { open: boolean; uni: string | null; preset?: string; me: string; onClose: () => void; onSaved: (uni: string) => void }) {
  const s = useComm();
  const was = editUni ? s.terms.find((t) => t.uni === editUni) : undefined;
  const [v, setV] = useState<TermsDraft>(blankTerms);
  const [tried, setTried] = useState(false);
  const [big, setBig] = useState(false);
  const { ask, dialog } = useAsk();
  // Q41 (Jovial, 10 Nov): an edit has an Effective from date (intake start); earlier intakes keep the terms before
  const [from, setFrom] = useState(todayIso());
  useEffect(() => {
    if (!open) return;
    const d = was ? { ...blankTerms(), ...was } : blankTerms(preset ?? '');
    setV(d);
    setTried(false);
    setBig(false);
    setFrom(todayIso());
  }, [open, editUni, preset]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastFrom = was ? [...(was as UniTerms).earlier].map((x) => x.until).sort().pop() ?? '' : '';
  const set = (p: Partial<TermsDraft>) => setV((x) => ({ ...x, ...p }));
  const all = ctxUnis();
  const pool = all.filter((u) => !s.terms.some((t) => t.uni === u.id));
  const u = all.find((x) => x.id === v.uni);
  const home = u ? CURRENCY[u.country] : '';
  const cur = v.currency || home;
  const levels = v.uni ? levelsOf(v.uni) : [];
  const rateVals = levels.map((l) => v.rates[l]).filter((x) => x !== undefined) as number[];
  const o = condOpts(v.uni ? [v.uni] : null, levels.length ? levels : COMM_LEVELS, s.settings.regionGroups, todayIso());
  const needWeeks = v.trigger === 'Withdrawal deadline';
  const err = {
    uni: !v.uni ? 'Choose the university.' : null,
    currency: v.currency && !/^[A-Z]{3}$/.test(v.currency) ? 'A three-letter currency code, like AUD.' : null,
    rates: !rateVals.length && !levels.some((l) => v.fixed[l] !== undefined) && !v.rateRows.length ? 'Enter a rate for at least one level, or add a rate row.' : rateVals.some((r) => !(r > 0 && r <= 100)) ? 'Rates are numbers from 0 to 100.' : null,
    rows: v.rateRows.map(rateRowBad).find(Boolean) ?? null,
    trigger: !v.trigger ? 'Choose the trigger.' : null,
    weeks: needWeeks && v.triggerWeeks !== null && !wholeIn(v.triggerWeeks, 0, 52) ? 'A whole number of weeks, 0 to 52.' : null,
    charge: chargeNeedsN(v.charge.unit) && !(v.charge.n !== null && v.charge.n > 0) ? 'How many (or how much).' : null,
    payDays: !wholeIn(v.payDays, 1, 180) ? 'A whole number from 1 to 180.' : null,
    bands: v.bands.length ? bandsError(v.bands) : null,
    bandBonuses: v.bandBonuses.map((b) => bandBonusBad(b, v.bands.length)).find(Boolean) ?? null,
    promos: v.promos.map(promoBad).find(Boolean) ?? null,
    addl: v.addl.map(addlBad).find(Boolean) ?? null,
    schemes: v.bonus.map(schemeBad).find(Boolean) ?? null,
    contract: big ? `The file is over ${s.settings.maxFileMb} MB.` : !v.contract ? 'Upload the contract.' : null,
    from: was && (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from <= lastFrom) ? (lastFrom ? `A date after ${lastFrom}, the last edit’s.` : 'Pick the date the new terms start.') : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const setLevel = (k: 'rates' | 'fixed', l: Level, n: number | null) => {
    const next = { ...v[k] };
    if (n === null || Number.isNaN(n)) delete next[l];
    else next[l] = n;
    set({ [k]: next } as Partial<TermsDraft>);
  };
  const body = () => ({
    ...v,
    currency: v.currency || undefined,
    trigger: v.trigger as Trigger,
    triggerWeeks: needWeeks ? v.triggerWeeks : null,
    charge: chargeNeedsN(v.charge.unit) ? v.charge : { unit: v.charge.unit, n: null },
    payDays: v.payDays!,
    contract: v.contract!,
    promos: v.promos.map((p) => ({ ...p, name: p.name.trim(), cond: cleanCond(p.cond) })),
    bonus: v.bonus.map((b) => ({ ...b, name: b.name.trim(), cond: cleanCond(b.cond) })),
    addl: v.addl.map((a) => ({ ...a, desc: a.desc.trim(), cond: cleanCond(a.cond) })),
  });
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const t = body();
    const commit = () => {
      saveTerms(t, me, from);
      onSaved(v.uni);
    };
    if (!was) return commit();
    // D15: see the effect first; a back-dated edit re-prices lines not yet invoiced, and kept lines get Adjustment lines
    const fx = termsEffect(t, from, me);
    const none = !fx.repriced && !fx.adjusted && !fx.added;
    ask(
      `Save ${uniName(v.uni)}’s terms from ${dayText(from)}?`,
      'Save',
      none ? (
        <p>No line changes: no enrolment of this university’s has an intake on or after {dayText(from)} that these terms price differently.</p>
      ) : (
        <p>
          {fx.repriced} line{fx.repriced === 1 ? '' : 's'} not yet invoiced will be re-priced, {fx.adjusted} kept line{fx.adjusted === 1 ? '' : 's'} will get an Adjustment line{fx.added ? `, and ${fx.added} new line${fx.added === 1 ? '' : 's'} will appear` : ''}. University → GSP changes by {money(Math.round(fx.change * 100) / 100, fx.currency)}. RP lines follow.
        </p>
      ),
      commit,
    );
  };
  const tier = (p: Partial<TermsBody>) => set(p as Partial<TermsDraft>);
  return (
    <>
      <FormSheet open={open} title={was ? `Edit ${uniName(v.uni)}’s terms` : 'Add University terms'} sub={was ? 'Applies to enrolments whose intake starts on or after Effective from. Earlier ones keep the terms before; lines already invoiced never change: the difference is an Adjustment line.' : 'What the university pays GSP, as its contract says. Every rule below is optional except the rates and how it pays.'} onClose={onClose} onSave={save}>
        <FormSec title="The university and its contract" />
        <Field id="cut-uni" label="University" required error={show('uni')}>
          {was ? (
            <p className="cline">{uniName(v.uni)}</p>
          ) : (
            <SearchPick id="cut-uni" label="Universities with no terms yet" placeholder="Search universities" value={v.uni} invalid={!!show('uni')} options={pool.map((x) => ({ value: x.id, label: x.name, note: x.country }))} onChange={(id) => set({ uni: id, rates: {}, fixed: {}, rateRows: [] })} />
          )}
        </Field>
        {was ? (
          <Field id="cut-from" label="Effective from" required error={show('from')} hint="The intake start date the changed terms apply from. It can be in the past.">
            <TextInput id="cut-from" type="date" value={from} invalid={!!show('from')} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        ) : (
          <span aria-hidden="true" />
        )}
        <Field id="cut-cur" label="Currency" optional error={show('currency')} hint={home ? `Empty: ${home}, the university’s country’s. Change it when the contract pays in another.` : 'The university’s country’s, unless the contract says otherwise.'}>
          <TextInput id="cut-cur" maxLength={3} value={v.currency ?? ''} placeholder={home} invalid={!!show('currency')} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
        </Field>
        <Field id="cut-contract" label="Contract" required error={show('contract')} hint={`PDF, up to ${s.settings.maxFileMb} MB. Its dates come from the institution partner’s agreement.`} className="iform__wide">
          <FilePick id="cut-contract" value={v.contract} accept=".pdf,application/pdf" maxMb={s.settings.maxFileMb} invalid={!!show('contract')} onTooBig={setBig} onChange={(contract) => set({ contract })} />
        </Field>

        <FormSec title="What GSP earns" note={`A rate (%) for each program level, or a fixed amount${cur ? ` in ${cur}` : ''} instead. A level with neither is held as Rate missing.`} />
        {show('rates') && <ErrorText id="cut-rates-error">{show('rates')}</ErrorText>}
        {levels.length ? (
          <div className="clevels" role="group" aria-label="Rates by program level">
            <div className="clevels__head" aria-hidden="true">
              <span>Program level</span>
              <span>Rate (%)</span>
              <span>Or a fixed amount{cur ? ` (${cur})` : ''}</span>
            </div>
            {levels.map((l) => (
              <div key={l} className="clevels__row">
                <span className="clevels__name">{l}</span>
                <TextInput id={`cut-rate-${LEVELS.indexOf(l)}`} aria-label={`${l}: rate (%)`} inputMode="decimal" value={numText(v.rates[l])} invalid={!!show('rates')} onChange={(e) => setLevel('rates', l, numOf(e.target.value))} />
                <TextInput id={`cut-fixed-${LEVELS.indexOf(l)}`} aria-label={`${l}: fixed amount`} inputMode="decimal" value={numText(v.fixed[l])} onChange={(e) => setLevel('fixed', l, numOf(e.target.value))} />
              </div>
            ))}
          </div>
        ) : (
          <p className="cmuted cform__wide">Choose the university to see the program levels it offers.</p>
        )}
        <Field id="cut-basis" label="Rates are on" required>
          <SelectInput id="cut-basis" value={v.feeBasis} onChange={(e) => set({ feeBasis: e.target.value as TermsDraft['feeBasis'] })}>
            {options(FEE_BASES)}
          </SelectInput>
        </Field>
        <span aria-hidden="true" />
        <div className="cform__wide">
          <p className="cform__label">Rate rows</p>
          <p className="cform__hint">A different rate for some students: a course, a campus, where they’re from or a study period. The most specific row that matches wins.</p>
          <RateRowsEditor id="cut-rows" rows={v.rateRows} onChange={(rateRows) => set({ rateRows })} o={o} cur={cur} tried={tried} />
        </div>

        <FormSec title="How and when it pays" />
        <Field id="cut-unit" label="Commission is paid" required hint="Per year, semester, trimester or term; per unit of study (Admissions enters the units); or on each fee payment.">
          <SelectInput id="cut-unit" value={v.payUnit} onChange={(e) => set({ payUnit: e.target.value as PayUnit })}>
            {options(PAY_UNITS.map((x) => x.label))}
          </SelectInput>
        </Field>
        <Field id="cut-trigger" label="Earned on" required error={show('trigger')} hint="When a study period’s commission is earned.">
          <SelectInput id="cut-trigger" value={v.trigger} placeholder="Choose the trigger" invalid={!!show('trigger')} onChange={(e) => set({ trigger: e.target.value as Trigger })}>
            {options(TRIGGER_LABELS)}
          </SelectInput>
        </Field>
        {needWeeks && (
          <Field id="cut-weeks" label="Weeks after the study period starts" optional error={show('weeks')} hint={`Empty: Settings’ ${s.settings.fallbackWeeks} weeks.`}>
            <TextInput id="cut-weeks" inputMode="numeric" value={numText(v.triggerWeeks)} invalid={!!show('weeks')} onChange={(e) => set({ triggerWeeks: numOf(e.target.value) })} />
          </Field>
        )}
        <Field id="cut-charge" label="Chargeable for" required>
          <SelectInput id="cut-charge" value={v.charge.unit} onChange={(e) => set({ charge: { unit: e.target.value as ChargeUnit, n: v.charge.n } as Charge })}>
            {options(CHARGE_UNITS.map((x) => x.label))}
          </SelectInput>
        </Field>
        {chargeNeedsN(v.charge.unit) && (
          <Field id="cut-charge-n" label={v.charge.unit === 'Fees up to' ? `Fees up to${cur ? ` (${cur})` : ''}` : `How many ${v.charge.unit.toLowerCase()}`} required error={show('charge')}>
            <TextInput id="cut-charge-n" inputMode="decimal" value={numText(v.charge.n)} invalid={!!show('charge')} onChange={(e) => set({ charge: { ...v.charge, n: numOf(e.target.value) } })} />
          </Field>
        )}
        <Field id="cut-pay" label="Pay within (days)" required error={show('payDays')} hint="Days after GSP’s invoice.">
          <TextInput id="cut-pay" inputMode="numeric" value={numText(v.payDays)} invalid={!!show('payDays')} onChange={(e) => set({ payDays: numOf(e.target.value) })} />
        </Field>
        <Field id="cut-claim" label="GSP can invoice for (months)" optional hint="After the study period ends, as the contract says. Lines not invoiced by then are flagged for Finance; nothing closes. Empty: no limit.">
          <TextInput id="cut-claim" inputMode="numeric" value={numText(v.claimMonths ?? null)} onChange={(e) => set({ claimMonths: numOf(e.target.value) })} />
        </Field>
        <Field id="cut-cap" label={`First-year cap per student${cur ? ` (${cur})` : ''}`} optional hint="The most course commission and Tier bonus per student in the first year. Additional commission isn’t capped.">
          <TextInput id="cut-cap" inputMode="decimal" value={numText(v.cap)} onChange={(e) => set({ cap: numOf(e.target.value) })} />
        </Field>

        <FormSec title="Tier" note="A higher rate once GSP enrols more students with this university. The part above the student’s rate is its own Tier bonus line, GSP’s alone: RPs are paid on the base rate. A group’s tier, when the university is in one, wins when higher." />
        <Field id="cut-bands" label="Tier bands" optional error={show('bands')} className="iform__wide">
          <BandsEditor id="cut-bands" bands={v.bands} unit="Rate (%)" invalid={!!show('bands')} onChange={(bands: Band[]) => set({ bands })} />
        </Field>
        {v.bands.length > 0 && <TierOptions idp="cut" v={v} set={tier} />}
        {v.bands.length > 0 && (
          <div className="cform__wide">
            <p className="cform__label">Band bonuses</p>
            <p className="cform__hint">A bonus per student once a band is reached.</p>
            <BandBonusEditor id="cut-bb" items={v.bandBonuses} bands={v.bands.length} onChange={(bandBonuses) => set({ bandBonuses })} cur={cur} tried={tried} />
          </div>
        )}

        <FormSec title="Promotions and additional commission" note="Promotions change or add to the rate for some students. Additional commission is paid on top, and RPs get their share of it." />
        <div className="cform__wide">
          <p className="cform__label">Promotions</p>
          <PromosEditor id="cut-promos" items={v.promos} onChange={(promos) => set({ promos })} o={o} cur={cur} tried={tried} />
        </div>
        <div className="cform__wide">
          <p className="cform__label">Additional commission</p>
          <AddlEditor id="cut-addl" items={v.addl} onChange={(addl) => set({ addl })} o={o} cur={cur} tried={tried} />
        </div>

        <FormSec title="GSP’s own bonus schemes" note="Bonuses the university pays GSP for volume. Never shared with RPs." />
        <div className="cform__wide">
          <SchemesEditor id="cut-schemes" items={v.bonus} onChange={(bonus) => set({ bonus })} o={o} cur={cur} tried={tried} countedLabel={v.countedPer} />
        </div>

        <FormSec title="Notes" />
        <Field id="cut-notes" label="Notes" optional className="iform__wide" hint="Shown on the university’s Commission tab.">
          <Area id="cut-notes" value={v.notes} onChange={(notes) => set({ notes })} />
        </Field>
      </FormSheet>
      {dialog}
    </>
  );
}

/* ---------- University group ---------- */

type GroupDraft = Omit<UniGroup, 'created' | 'updated'>;
const blankGroup = (): GroupDraft => ({ id: '', name: '', members: [], bands: [], countedPer: 'Calendar year', yearStart: 1, tierRetro: true, tierPerCountry: false, tierLevels: [], bandBonuses: [], bonus: [], notes: '' });

/** Add and Edit Group (Q56): universities counted together for a tier and group bonus schemes; a university is in at most one group. */
export function GroupForm({ open, edit, me, onClose, onSaved }: { open: boolean; edit: UniGroup | null; me: string; onClose: () => void; onSaved: (name: string) => void }) {
  const s = useComm();
  const [v, setV] = useState<GroupDraft>(blankGroup);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = edit ? { ...blankGroup(), ...edit } : blankGroup();
    setV(d);
    setTried(false);
  }, [open, edit]);
  const set = (p: Partial<GroupDraft>) => setV((x) => ({ ...x, ...p }));
  const unis = ctxUnis();
  const taken = new Set(s.groups.filter((g) => g.id !== v.id).flatMap((g) => g.members));
  const free = unis.filter((u) => !taken.has(u.id));
  const o = condOpts(v.members.length ? v.members : null, COMM_LEVELS, s.settings.regionGroups, todayIso());
  const cur = (() => {
    const cs = [...new Set(v.members.map((m) => s.terms.find((t) => t.uni === m)?.currency || CURRENCY[unis.find((u) => u.id === m)?.country as keyof typeof CURRENCY]).filter(Boolean))];
    return cs.length === 1 ? cs[0]! : '';
  })();
  const err = {
    name: !v.name.trim() ? 'Name the group.' : s.groups.some((g) => g.id !== v.id && g.name.trim().toLowerCase() === v.name.trim().toLowerCase()) ? 'There’s already a group with this name.' : null,
    members: v.members.length < 2 ? 'Choose at least two universities.' : null,
    bands: v.bands.length ? bandsError(v.bands) : !v.bonus.length ? 'Add tier bands or a bonus scheme.' : null,
    bandBonuses: v.bandBonuses.map((b) => bandBonusBad(b, v.bands.length)).find(Boolean) ?? null,
    schemes: v.bonus.map(schemeBad).find(Boolean) ?? null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const name = v.name.trim();
    saveGroup({ ...v, name, id: v.id || newGroupId(), bonus: v.bonus.map((b) => ({ ...b, name: b.name.trim(), cond: cleanCond(b.cond) })) }, me);
    onSaved(name);
  };
  const label = (id: string) => unis.find((u) => u.id === id)?.name ?? id;
  return (
    <FormSheet open={open} title={edit ? `Edit ${edit.name}` : 'Add Group'} sub="Universities whose students count together for a tier or a bonus. Each member keeps its own terms." onClose={onClose} onSave={save}>
      <FormSec title="The group" />
      <Field id="cgr-name" label="Name" required error={show('name')} className="iform__wide">
        <TextInput id="cgr-name" maxLength={80} value={v.name} invalid={!!show('name')} placeholder="Like: UK partner group" onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field id="cgr-members" label="Universities" required error={show('members')} className="iform__wide" hint="Universities not in another group. Their own tier still applies; the group’s wins when higher.">
        <MultiPick id="cgr-members" label="Universities" value={v.members.map(label)} options={free.map((u) => u.name)} onChange={(x) => set({ members: x.map((n) => unis.find((u) => u.name === n)?.id ?? n) })} empty="Choose the universities" search />
      </Field>
      <FormSec title="Group tier" note="Enrolments across every member, counted per the group’s year. Wins over a member’s own tier when higher. A group needs a tier or a bonus scheme." />
      <Field id="cgr-bands" label="Group tier bands" optional error={show('bands')} className="iform__wide">
        <BandsEditor id="cgr-bands" bands={v.bands} unit="Rate (%)" invalid={!!show('bands')} onChange={(bands: Band[]) => set({ bands })} />
      </Field>
      {v.bands.length > 0 && <TierOptions idp="cgr" v={v} set={(p) => set(p as Partial<GroupDraft>)} />}
      {v.bands.length > 0 && (
        <div className="cform__wide">
          <p className="cform__label">Band bonuses</p>
          <BandBonusEditor id="cgr-bb" items={v.bandBonuses} bands={v.bands.length} onChange={(bandBonuses) => set({ bandBonuses })} cur={cur} tried={tried} />
        </div>
      )}
      <FormSec title="Group bonus schemes" note="GSP’s own, counted across every member. Never shared with RPs." />
      <div className="cform__wide">
        <SchemesEditor id="cgr-schemes" items={v.bonus} onChange={(bonus) => set({ bonus })} o={o} cur={cur} tried={tried} countedLabel={v.countedPer} />
      </div>
      <FormSec title="Notes" />
      <Field id="cgr-notes" label="Notes" optional className="iform__wide">
        <Area id="cgr-notes" value={v.notes} onChange={(notes) => set({ notes })} />
      </Field>
    </FormSheet>
  );
}

/* ---------- Commission settings ---------- */

const daysText = (d: number[]) => d.join(', ');
const daysOf = (t: string) => t.split(/[\s,]+/).filter(Boolean).map(Number);
const linesOf = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);

/** Edit Commission settings (Finance › Setup › Settings): the rules every line uses. */
export function SettingsForm({ open, me, onClose, onSaved }: { open: boolean; me: string; onClose: () => void; onSaved: () => void }) {
  const s = useComm();
  const [v, setV] = useState<Settings>(s.settings);
  const [gstRows, setGstRows] = useState<{ dest: string; pct: number | null }[]>([]);
  const [grpRows, setGrpRows] = useState<{ name: string; countries: string[] }[]>([]);
  const [t, setT] = useState({ docTypes: '', studentTypes: '', partReasons: '', rpInvoice: '', uniPayment: '', rpPayment: '' });
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    const x = s.settings;
    setV(x);
    setGstRows(Object.entries(x.gst).map(([dest, pct]) => ({ dest, pct: pct ?? null })));
    setGrpRows(Object.entries(x.regionGroups).map(([name, countries]) => ({ name, countries })));
    setT({
      docTypes: x.docTypes.join('\n'),
      studentTypes: x.studentTypes.join('\n'),
      partReasons: x.partReasons.join('\n'),
      rpInvoice: daysText(x.reminders.rpInvoice),
      uniPayment: daysText(x.reminders.uniPayment),
      rpPayment: daysText(x.reminders.rpPayment),
    });
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Settings>) => setV((x) => ({ ...x, ...p }));
  const up = (k: keyof typeof t) => (e: { target: { value: string } }) => setT((x) => ({ ...x, [k]: e.target.value }));
  const days = (x: string) => daysOf(x).every((n) => Number.isInteger(n) && n >= 0 && n <= 120);
  const err = {
    weeks: !wholeIn(v.fallbackWeeks, 0, 52) ? 'A whole number of weeks, 0 to 52.' : null,
    claim: !wholeIn(v.rpClaimMonths, 1, 120) ? 'A whole number of months, 1 to 120.' : null,
    gst: gstRows.some((g) => !g.dest || pctBad(g.pct, true)) ? 'Choose the destination and a % from 0 to 100.' : new Set(gstRows.map((g) => g.dest)).size < gstRows.length ? 'Each destination once.' : null,
    groups: grpRows.some((g) => !g.name.trim() || !g.countries.length) ? 'Name each group and choose its countries.' : new Set(grpRows.map((g) => g.name.trim().toLowerCase())).size < grpRows.length ? 'Each group name once.' : null,
    annuity: v.annuity.rule === 'Flat %' && pctBad(v.annuity.pct, true) ? 'A number from 0 to 100.' : null,
    lists: !linesOf(t.docTypes).length || !linesOf(t.partReasons).length ? 'Keep at least one in each list.' : null,
    days: ![t.rpInvoice, t.uniPayment, t.rpPayment].every(days) ? 'Days, like 0, 7, 14.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    saveSettings(
      {
        ...v,
        annuity: { rule: v.annuity.rule, pct: v.annuity.rule === 'Flat %' ? v.annuity.pct : null },
        gst: Object.fromEntries(gstRows.map((g) => [g.dest, g.pct!])),
        regionGroups: Object.fromEntries(grpRows.map((g) => [g.name.trim(), g.countries])),
        docTypes: linesOf(t.docTypes),
        studentTypes: linesOf(t.studentTypes),
        partReasons: linesOf(t.partReasons),
        reminders: { rpInvoice: daysOf(t.rpInvoice), uniPayment: daysOf(t.uniPayment), rpPayment: daysOf(t.rpPayment) },
      },
      me,
      'Commission settings',
    );
    onSaved();
  };
  const area = (id: string, k: keyof typeof t) => (
    <div className="control iform__area">
      <textarea id={id} className="control__input" rows={3} value={t[k]} onChange={up(k)} />
    </div>
  );
  return (
    <FormSheet open={open} title="Edit Commission settings" sub="Lines not yet invoiced follow the new settings; kept lines don’t change." onClose={onClose} onSave={save}>
      <FormSec title="Counting and dates" />
      <Field id="cst-fy" label="Financial year starts in" required>
        <SelectInput id="cst-fy" value={String(v.fyStart)} onChange={(e) => set({ fyStart: Number(e.target.value) })}>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field id="cst-weeks" label="Census fallback (weeks)" required error={show('weeks')} hint="When an application has no census date: the study period’s start plus these weeks, shown as an estimated date.">
        <TextInput id="cst-weeks" inputMode="numeric" value={numText(v.fallbackWeeks)} invalid={!!show('weeks')} onChange={(e) => set({ fallbackWeeks: numOf(e.target.value) ?? NaN })} />
      </Field>
      <FormSec title="RPs" note="The defaults for every RP; an RP’s record can change them." />
      <Field id="cst-claim" label="RPs can claim for (months)" required error={show('claim')} hint="After the study period ends; an agreement can say otherwise. Past it the line stays on the portal, isn’t closed and the RP isn’t told: Finance adjusts the books.">
        <TextInput id="cst-claim" inputMode="numeric" value={numText(v.rpClaimMonths)} invalid={!!show('claim')} onChange={(e) => set({ rpClaimMonths: numOf(e.target.value) ?? NaN })} />
      </Field>
      <Field id="cst-ann" label="RP share after year 1" required hint="Unless the RP’s record has its own.">
        <SelectInput id="cst-ann" value={v.annuity.rule} onChange={(e) => set({ annuity: { ...v.annuity, rule: e.target.value as Settings['annuity']['rule'] } })}>
          {options(ANNUITY_RULES)}
        </SelectInput>
      </Field>
      {v.annuity.rule === 'Flat %' && (
        <Field id="cst-annpct" label="Share after year 1 (%)" required error={show('annuity')}>
          <TextInput id="cst-annpct" inputMode="decimal" value={numText(v.annuity.pct)} invalid={!!show('annuity')} onChange={(e) => set({ annuity: { ...v.annuity, pct: numOf(e.target.value) } })} />
        </Field>
      )}
      <RpViewFields idp="cst" v={v.rpView} set={(rpView) => set({ rpView })} hint="For a new RP’s record; each RP’s record can change it." />
      <FormSec title="Invoices and regions" />
      <div className="cform__wide">
        <p className="cform__label">GST on GSP’s invoices to universities</p>
        <p className="cform__hint">By destination. Nowhere else.</p>
        <RuleList id="cst-gst" empty="No GST anywhere." add="Add destination" onAdd={() => setGstRows((x) => [...x, { dest: '', pct: null }])} error={show('gst')}>
          {gstRows.map((g, i) => (
            <RuleCard key={i} title={g.dest || `Destination ${i + 1}`} removeLabel={`Remove GST ${i + 1}`} onRemove={() => setGstRows((x) => x.filter((_, j) => j !== i))}>
              <Field id={`cst-gst-d-${i}`} label="Destination" required>
                <SelectInput id={`cst-gst-d-${i}`} value={g.dest} placeholder="Choose" onChange={(e) => setGstRows((x) => x.map((y, j) => (j === i ? { ...y, dest: e.target.value } : y)))}>
                  {options(DESTINATIONS)}
                </SelectInput>
              </Field>
              <Field id={`cst-gst-p-${i}`} label="GST (%)" required>
                <TextInput id={`cst-gst-p-${i}`} inputMode="decimal" value={numText(g.pct)} onChange={(e) => setGstRows((x) => x.map((y, j) => (j === i ? { ...y, pct: numOf(e.target.value) } : y)))} />
              </Field>
            </RuleCard>
          ))}
        </RuleList>
      </div>
      <div className="cform__wide">
        <p className="cform__label">Region groups</p>
        <p className="cform__hint">A name for several countries, like SEA. Rate rows, promotions, bonuses and notices can choose a group instead of one country.</p>
        <RuleList id="cst-groups" empty="No region groups." add="Add region group" onAdd={() => setGrpRows((x) => [...x, { name: '', countries: [] }])} error={show('groups')}>
          {grpRows.map((g, i) => (
            <RuleCard key={i} title={g.name || `Region group ${i + 1}`} removeLabel={`Remove region group ${i + 1}`} onRemove={() => setGrpRows((x) => x.filter((_, j) => j !== i))}>
              <Field id={`cst-grp-n-${i}`} label="Name" required>
                <TextInput id={`cst-grp-n-${i}`} value={g.name} onChange={(e) => setGrpRows((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
              </Field>
              <Field id={`cst-grp-c-${i}`} label="Countries" required className="crule__wide">
                <MultiPick id={`cst-grp-c-${i}`} label="Countries" value={g.countries} options={COUNTRIES.map((c) => c.name)} onChange={(countries) => setGrpRows((x) => x.map((y, j) => (j === i ? { ...y, countries } : y)))} empty="Choose the countries" search />
              </Field>
            </RuleCard>
          ))}
        </RuleList>
      </div>
      <FormSec title="Lists" note="The choices the commission forms offer." />
      <Field id="cst-doc" label="Notice document types" required error={show('lists')} hint="One a line.">
        {area('cst-doc', 'docTypes')}
      </Field>
      <Field id="cst-stype" label="Student types (Australia)" optional hint="One a line. An Australian enrolment without one is an exception.">
        {area('cst-stype', 'studentTypes')}
      </Field>
      <Field id="cst-part" label="Part payment reasons" required error={show('lists')} className="iform__wide" hint="One a line: what Record payment offers when a university pays less.">
        {area('cst-part', 'partReasons')}
      </Field>
      <FormSec title="Reminders" note="Days, separated by commas. Bell and email; no escalation." />
      <Field id="cst-r1" label="Remind the RP to invoice (days)" required error={show('days')} hint="After its invoice is asked for.">
        <TextInput id="cst-r1" value={t.rpInvoice} invalid={!!show('days')} onChange={up('rpInvoice')} />
      </Field>
      <Field id="cst-r2" label="Remind Finance of a university payment (days)" required error={show('days')} hint="From the line’s due date.">
        <TextInput id="cst-r2" value={t.uniPayment} invalid={!!show('days')} onChange={up('uniPayment')} />
      </Field>
      <Field id="cst-r3" label="Remind Finance to pay an RP (days)" required error={show('days')} hint="After Pay within, for Approved lines.">
        <TextInput id="cst-r3" value={t.rpPayment} invalid={!!show('days')} onChange={up('rpPayment')} />
      </Field>
    </FormSheet>
  );
}
