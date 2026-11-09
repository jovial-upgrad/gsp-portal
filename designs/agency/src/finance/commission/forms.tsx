import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { MultiPick } from '../../components/MultiPick';
import { SearchPick } from '../../institution/records/SearchPick';
import { ErrorText, Facts, useAsk } from '../../institution/records/parts';
import { CURRENCIES } from '../../institution/data/catalogue';
import { CURRENCY } from '../../data/courses';
import { todayIso } from '../../institution/data/records';
import { BandsEditor, FilePick, bandsError, numOf, numText } from './parts';
import { acceptedOn, acceptedRps, ctxRps, ctxUnis, levelsOf, newAgreementId, newNoticeId, saveAgreement, saveNotice, saveRecord, saveTerms, uniName, useComm } from './store';
import {
  ADDL_KINDS,
  ADDL_WHEN,
  BENEFITS,
  COUNTED_PER,
  DESTINATIONS,
  FEE_BASES,
  LEVELS,
  SHARE_TYPES,
  TRIGGER_LABELS,
  YES_NO,
  dayText,
  type Addl,
  type Agreement,
  type AgreementTerms,
  type Band,
  type Benefit,
  type Bonus,
  type FileRef,
  type Level,
  type Notice,
  type TermsBody,
  type Trigger,
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
const Options = ({ list }: { list: readonly string[] }) => (
  <>
    {list.map((x) => (
      <option key={x} value={x}>
        {x}
      </option>
    ))}
  </>
);
function Area({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="control iform__area">
      <textarea id={id} className="control__input" rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- Agreement ---------- */

type AgDraft = AgreementTerms & { id: string; name: string };
const blankAg = (): AgDraft => ({ id: '', name: '', shareType: 'Flat', share: null, bands: [], countedPer: 'Financial year', retro: false, addl: null, bonus: null, payDays: 30, details: '', doc: null });

/** Add and Edit Agreement (the PRD's form): name, share or bands, how they're counted, what's passed on, pay within, details and document. */
export function AgreementForm({ open, edit, me, onClose, onSaved }: { open: boolean; edit: Agreement | null; me: string; onClose: () => void; onSaved: (name: string) => void }) {
  const s = useComm();
  const [v, setV] = useState<AgDraft>(blankAg);
  const [tried, setTried] = useState(false);
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(edit ? { ...edit } : blankAg());
    setTried(false);
    setBig(false);
  }, [open, edit]);
  const set = (p: Partial<AgDraft>) => setV((x) => ({ ...x, ...p }));
  const flat = v.shareType === 'Flat';
  const err = {
    name: !v.name.trim() ? 'Name the agreement.' : s.agreements.some((a) => a.id !== v.id && a.name.trim().toLowerCase() === v.name.trim().toLowerCase()) ? 'There’s already an agreement with this name.' : null,
    share: flat && pctBad(v.share, true) ? 'A number from 0 to 100.' : null,
    bands: !flat ? bandsError(v.bands) : null,
    addl: pctBad(v.addl, false) ? 'A number from 0 to 100.' : null,
    bonus: pctBad(v.bonus, false) ? 'A number from 0 to 100.' : null,
    payDays: !wholeIn(v.payDays, 1, 90) ? 'A whole number from 1 to 90.' : null,
    doc: big ? `The file is over ${s.settings.maxFileMb} MB.` : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const name = v.name.trim();
    saveAgreement({ ...v, name, id: v.id || newAgreementId(), share: flat ? v.share : null, bands: flat ? [] : v.bands, status: edit?.status ?? 'Active' }, me);
    onSaved(name);
  };
  return (
    <FormSheet open={open} title={edit ? `Edit ${edit.name}` : 'Add Agreement'} sub={edit ? 'Applies to commission items made after you save. Items already made keep their share.' : undefined} onClose={onClose} onSave={save}>
      <Field id="cag-name" label="Name" required error={show('name')} className="iform__wide">
        <TextInput id="cag-name" maxLength={80} value={v.name} invalid={!!show('name')} placeholder="Like: Standard agreement 2026" onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field id="cag-type" label="Share type" required>
        <SelectInput id="cag-type" value={v.shareType} onChange={(e) => set({ shareType: e.target.value as AgDraft['shareType'] })}>
          <Options list={SHARE_TYPES} />
        </SelectInput>
      </Field>
      {flat ? (
        <Field id="cag-share" label="Share of GSP’s commission (%)" required error={show('share')}>
          <TextInput id="cag-share" inputMode="decimal" value={numText(v.share)} invalid={!!show('share')} onChange={(e) => set({ share: numOf(e.target.value) })} />
        </Field>
      ) : (
        <Field id="cag-counted" label="Counted per" required hint={v.countedPer === 'Financial year' ? `GSP’s financial year: 1 ${MONTH_NAMES[s.settings.fyStart - 1]} to the end of ${MONTH_NAMES[(s.settings.fyStart + 10) % 12]}.` : undefined}>
          <SelectInput id="cag-counted" value={v.countedPer} onChange={(e) => set({ countedPer: e.target.value as AgDraft['countedPer'] })}>
            <Options list={COUNTED_PER} />
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
          <Options list={YES_NO} />
        </SelectInput>
      </Field>
      <Field id="cag-pay" label="Pay within (days)" required error={show('payDays')} hint="Days after GSP receives the RP’s accepted invoice.">
        <TextInput id="cag-pay" inputMode="numeric" value={numText(v.payDays)} invalid={!!show('payDays')} onChange={(e) => set({ payDays: numOf(e.target.value) ?? NaN })} />
      </Field>
      <Field id="cag-addl" label="Additional commission passed on (%)" optional error={show('addl')} hint="Share of any additional commission the university pays. Empty: the same as the share above.">
        <TextInput id="cag-addl" inputMode="decimal" value={numText(v.addl)} invalid={!!show('addl')} onChange={(e) => set({ addl: numOf(e.target.value) })} />
      </Field>
      <Field id="cag-bonus" label="Bonus passed on (%)" optional error={show('bonus')} hint="Share of any bonus the university pays. Empty: none.">
        <TextInput id="cag-bonus" inputMode="decimal" value={numText(v.bonus)} invalid={!!show('bonus')} onChange={(e) => set({ bonus: numOf(e.target.value) })} />
      </Field>
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
 * From and Registered for tax; its business details and bank details as the RP set them, read only. Moving it to
 * another agreement asks first.
 */
export function RecordForm({ open, rp: editRp, preset, me, onClose, onSaved, onAgreements }: { open: boolean; rp: string | null; preset?: string; me: string; onClose: () => void; onSaved: (rp: string) => void; onAgreements: () => void }) {
  const s = useComm();
  const was = editRp ? s.records.find((r) => r.rp === editRp) : undefined;
  const [rp, setRp] = useState('');
  const [agreement, setAgreement] = useState('');
  const [from, setFrom] = useState('');
  const [tax, setTax] = useState(false);
  const [tried, setTried] = useState(false);
  const { ask, dialog } = useAsk();
  useEffect(() => {
    if (!open) return;
    const r = was?.rp ?? preset ?? '';
    setRp(r);
    setAgreement(was?.agreement ?? '');
    setFrom(was?.from ?? (r ? acceptedOn(r) : ''));
    setTax(was?.tax ?? false);
    setTried(false);
  }, [open, editRp, preset]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = acceptedRps().filter((r) => !s.records.some((x) => x.rp === r.id));
  const info = ctxRps().find((r) => r.id === rp);
  const bank = s.banks.find((b) => b.rp === rp);
  const active = s.agreements.filter((a) => a.status === 'Active' || a.id === was?.agreement);
  const err = { rp: !rp ? 'Choose the RP.' : null, agreement: !agreement ? 'Choose the agreement.' : null, from: !from ? 'Choose the date.' : null };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const name = info?.name ?? '';
  const commit = () => {
    saveRecord({ rp, agreement, from, tax }, me);
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
  const notAdded = 'Not added yet';
  return (
    <>
      <FormSheet open={open} title={was ? `Edit ${name}’s record` : 'Add RP record'} onClose={onClose} onSave={save}>
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
        <Field id="crec-tax" label="Registered for tax (GST, VAT)" optional hint="Yes adds the tax line to GSP’s filled-in invoice.">
          <SelectInput id="crec-tax" value={tax ? 'Yes' : 'No'} onChange={(e) => setTax(e.target.value === 'Yes')}>
            <Options list={YES_NO} />
          </SelectInput>
        </Field>
        {info && (
          <div className="cform__ro">
            <Facts
              items={[
                ['Business name', info.name],
                ['RP ID', <span key="c" className="num">{info.code}</span>],
                ['Sales region', info.region],
                ['Bank account', bank ? <span key="b" className="num">{`${bank.bank} ····${bank.number.slice(-4)}`}</span> : notAdded],
                ['Bank currency', bank?.currency ?? notAdded],
                ['Payee name', bank?.account ?? notAdded],
              ]}
            />
          </div>
        )}
      </FormSheet>
      {dialog}
    </>
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
const blankNt = (): NtDraft => ({ id: '', name: '', doc: null, starts: '', ends: '', dests: [], unis: [], levels: [], benefit: '', amount: null, currency: CURRENCIES[0], share: null, bands: [], retro: false, rps: [] });

/** Add and Edit Notice: name, document, dates, what it applies to, its benefit and the RPs that may use it. */
export function NoticeForm({ open, edit, me, onClose, onSaved }: { open: boolean; edit: Notice | null; me: string; onClose: () => void; onSaved: (name: string) => void }) {
  const s = useComm();
  const [v, setV] = useState<NtDraft>(blankNt);
  const [tried, setTried] = useState(false);
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(edit ? { ...edit } : blankNt());
    setTried(false);
    setBig(false);
  }, [open, edit]);
  const set = (p: Partial<NtDraft>) => setV((x) => ({ ...x, ...p }));
  const unis = ctxUnis();
  const err = {
    name: !v.name.trim() ? 'Name the notice.' : s.notices.some((n) => n.id !== v.id && n.name.trim().toLowerCase() === v.name.trim().toLowerCase()) ? 'There’s already a notice with this name.' : null,
    doc: big ? `The file is over ${s.settings.maxFileMb} MB.` : !v.doc ? 'Upload the notice.' : null,
    dates: !v.starts || !v.ends ? 'Choose the dates.' : v.ends <= v.starts ? 'It has to end after it starts.' : null,
    benefit: !v.benefit ? 'Choose the benefit.' : null,
    amount: v.benefit === 'Bonus per enrolment' && !(v.amount !== null && v.amount > 0) ? 'Enter the bonus.' : null,
    share: v.benefit === 'Share instead of the agreement’s' && pctBad(v.share, true) ? 'A number from 0 to 100.' : null,
    bands: v.benefit === 'Tiered share' ? bandsError(v.bands) : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const name = v.name.trim();
    const b = v.benefit as Benefit;
    saveNotice({ ...v, name, id: v.id || newNoticeId(), doc: v.doc!, benefit: b, amount: b === 'Bonus per enrolment' ? v.amount : null, share: b === 'Share instead of the agreement’s' ? v.share : null, bands: b === 'Tiered share' ? v.bands : [] }, me);
    onSaved(name);
  };
  const uniLabel = (id: string) => unis.find((u) => u.id === id)?.name ?? id;
  return (
    <FormSheet open={open} title={edit ? `Edit ${edit.name}` : 'Add Notice'} onClose={onClose} onSave={save}>
      <Field id="cnt-name" label="Name" required error={show('name')} className="iform__wide">
        <TextInput id="cnt-name" maxLength={80} value={v.name} invalid={!!show('name')} placeholder="Like: UK Promotion 2026" onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field id="cnt-doc" label="Notice document" required error={show('doc')} hint={`PDF, up to ${s.settings.maxFileMb} MB. Shown to preview on each listed RP’s Commission tab.`} className="iform__wide">
        <FilePick id="cnt-doc" value={v.doc} accept=".pdf,application/pdf" maxMb={s.settings.maxFileMb} invalid={!!show('doc')} onTooBig={setBig} onChange={(doc) => set({ doc })} />
      </Field>
      <Field id="cnt-starts" label="Starts" required error={show('dates')} hint="Enrolments with a census or enrolment date in the period count.">
        <TextInput id="cnt-starts" type="date" value={v.starts} invalid={!!show('dates')} onChange={(e) => set({ starts: e.target.value })} />
      </Field>
      <Field id="cnt-ends" label="Ends" required>
        <TextInput id="cnt-ends" type="date" value={v.ends} invalid={!!show('dates')} onChange={(e) => set({ ends: e.target.value })} />
      </Field>
      <Field id="cnt-dests" label="Destinations" optional>
        <MultiPick id="cnt-dests" label="Destinations" value={v.dests} options={[...DESTINATIONS]} onChange={(x) => set({ dests: x as NtDraft['dests'] })} empty="Every destination" />
      </Field>
      <Field id="cnt-unis" label="Universities" optional>
        <MultiPick id="cnt-unis" label="Universities" value={v.unis.map(uniLabel)} options={unis.map((u) => u.name)} onChange={(x) => set({ unis: x.map((n) => unis.find((u) => u.name === n)?.id ?? n) })} empty="Every university" search />
      </Field>
      <Field id="cnt-levels" label="Program levels" optional hint="Empty: every course.">
        <MultiPick id="cnt-levels" label="Program levels" value={v.levels} options={[...LEVELS]} onChange={(x) => set({ levels: x as Level[] })} empty="Every program level" />
      </Field>
      <Field id="cnt-benefit" label="Benefit" required error={show('benefit')}>
        <SelectInput id="cnt-benefit" value={v.benefit} placeholder="Choose the benefit" invalid={!!show('benefit')} onChange={(e) => set({ benefit: e.target.value as Benefit })}>
          <Options list={BENEFITS} />
        </SelectInput>
      </Field>
      {v.benefit === 'Bonus per enrolment' && (
        <>
          <Field id="cnt-amount" label="Bonus amount" required error={show('amount')}>
            <TextInput id="cnt-amount" inputMode="decimal" value={numText(v.amount)} invalid={!!show('amount')} onChange={(e) => set({ amount: numOf(e.target.value) })} />
          </Field>
          <Field id="cnt-cur" label="Currency" required>
            <SelectInput id="cnt-cur" value={v.currency} onChange={(e) => set({ currency: e.target.value })}>
              <Options list={CURRENCIES} />
            </SelectInput>
          </Field>
        </>
      )}
      {v.benefit === 'Share instead of the agreement’s' && (
        <Field id="cnt-share" label="Share (%)" required error={show('share')} hint="The higher of the notice’s and the agreement’s share is used.">
          <TextInput id="cnt-share" inputMode="decimal" value={numText(v.share)} invalid={!!show('share')} onChange={(e) => set({ share: numOf(e.target.value) })} />
        </Field>
      )}
      {v.benefit === 'Tiered share' && (
        <Field id="cnt-bands" label="Bands" required error={show('bands')} className="iform__wide" hint="The higher of the notice’s and the agreement’s share is used.">
          <BandsEditor id="cnt-bands" bands={v.bands} invalid={!!show('bands')} onChange={(bands) => set({ bands })} />
        </Field>
      )}
      {v.benefit && v.benefit !== 'Bonus per enrolment' && (
        <Field id="cnt-retro" label="Retrospective" optional>
          <SelectInput id="cnt-retro" value={v.retro ? 'Yes' : 'No'} onChange={(e) => set({ retro: e.target.value === 'Yes' })}>
            <Options list={YES_NO} />
          </SelectInput>
        </Field>
      )}
      <Field id="cnt-rps" label="RPs" optional className="iform__wide" hint="RPs with a commission record. IDs that don’t match one show here.">
        <RpPicker id="cnt-rps" value={v.rps} onChange={(rps) => set({ rps })} />
      </Field>
    </FormSheet>
  );
}

/* ---------- University terms ---------- */

type TermsDraft = Omit<TermsBody, 'contract' | 'trigger' | 'inst' | 'payDays'> & { uni: string; contract: FileRef | null; trigger: Trigger | ''; inst: number | null; payDays: number | null };
const blankTerms = (uni = ''): TermsDraft => ({ uni, rates: {}, feeBasis: 'Tuition after scholarship', fixed: {}, trigger: '', inst: null, payDays: 30, cap: null, bands: [], addl: [], bonus: [], contract: null, notes: '' });
let rid = 0;

/**
 * Add and Edit University terms: the rates by program level (or a fixed amount), the fee they're on, the trigger,
 * instalments, payment days, a cap, tier bands, additional commission and bonuses, the contract and notes.
 */
export function TermsForm({ open, uni: editUni, preset, me, onClose, onSaved }: { open: boolean; uni: string | null; preset?: string; me: string; onClose: () => void; onSaved: (uni: string) => void }) {
  const s = useComm();
  const was = editUni ? s.terms.find((t) => t.uni === editUni) : undefined;
  const [v, setV] = useState<TermsDraft>(blankTerms);
  const [tried, setTried] = useState(false);
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(was ? { ...was } : blankTerms(preset ?? ''));
    setTried(false);
    setBig(false);
  }, [open, editUni, preset]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<TermsDraft>) => setV((x) => ({ ...x, ...p }));
  const all = ctxUnis();
  const pool = all.filter((u) => !s.terms.some((t) => t.uni === u.id));
  const u = all.find((x) => x.id === v.uni);
  const cur = u ? CURRENCY[u.country] : '';
  const levels = v.uni ? levelsOf(v.uni) : [];
  const rateVals = levels.map((l) => v.rates[l]).filter((x) => x !== undefined) as number[];
  const err = {
    uni: !v.uni ? 'Choose the university.' : null,
    rates: !rateVals.length && !levels.some((l) => v.fixed[l] !== undefined) ? 'Enter a rate for at least one level.' : rateVals.some((r) => !(r > 0 && r <= 100)) ? 'Enter a rate for at least one level.' : null,
    trigger: !v.trigger ? 'Choose the trigger.' : null,
    inst: !wholeIn(v.inst, 1, 12) ? 'A whole number from 1 to 12.' : null,
    payDays: !wholeIn(v.payDays, 1, 180) ? 'A whole number from 1 to 180.' : null,
    bands: v.bands.length ? bandsError(v.bands) : null,
    contract: big ? `The file is over ${s.settings.maxFileMb} MB.` : !v.contract ? 'Upload the contract.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const setLevel = (k: 'rates' | 'fixed', l: Level, n: number | null) => {
    const next = { ...v[k] };
    if (n === null || Number.isNaN(n)) delete next[l];
    else next[l] = n;
    set({ [k]: next } as Partial<TermsDraft>);
  };
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    saveTerms({ ...v, trigger: v.trigger as Trigger, inst: v.inst!, payDays: v.payDays!, contract: v.contract!, addl: v.addl.filter((a) => a.desc.trim() && a.value > 0), bonus: v.bonus.filter((b) => b.desc.trim() && b.amount > 0) }, me);
    onSaved(v.uni);
  };
  const upAddl = (i: number, p: Partial<Addl>) => set({ addl: v.addl.map((a, j) => (j === i ? { ...a, ...p } : a)) });
  const upBonus = (i: number, p: Partial<Bonus>) => set({ bonus: v.bonus.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  return (
    <FormSheet open={open} title={was ? `Edit ${uniName(v.uni)}’s terms` : 'Add University terms'} sub={was ? 'Applies to transactions made after you save; earlier ones keep their amounts unless overridden.' : undefined} onClose={onClose} onSave={save}>
      <Field id="cut-uni" label="University" required error={show('uni')}>
        {was ? (
          <p className="cline">{uniName(v.uni)}</p>
        ) : (
          <SearchPick id="cut-uni" label="Universities with no terms yet" placeholder="Search universities" value={v.uni} invalid={!!show('uni')} options={pool.map((x) => ({ value: x.id, label: x.name, note: x.country }))} onChange={(id) => set({ uni: id, rates: {}, fixed: {} })} />
        )}
      </Field>
      <Field id="cut-cur" label="Currency">
        <p className="cline">{cur || <span className="cmuted">The university’s country’s currency</span>}</p>
      </Field>
      <p className="cform__sec">Rates by program level (%)</p>
      {show('rates') && <ErrorText id="cut-rates-error">{show('rates')}</ErrorText>}
      <div className="cform__levels">
        {levels.length ? (
          levels.map((l) => (
            <Field key={l} id={`cut-rate-${LEVELS.indexOf(l)}`} label={l} optional>
              <TextInput id={`cut-rate-${LEVELS.indexOf(l)}`} inputMode="decimal" value={numText(v.rates[l])} invalid={!!show('rates')} onChange={(e) => setLevel('rates', l, numOf(e.target.value))} />
            </Field>
          ))
        ) : (
          <p className="cmuted">Choose the university to see the levels it offers. Empty levels earn nothing.</p>
        )}
      </div>
      <Field id="cut-basis" label="Fee basis" required>
        <SelectInput id="cut-basis" value={v.feeBasis} onChange={(e) => set({ feeBasis: e.target.value as TermsDraft['feeBasis'] })}>
          <Options list={FEE_BASES} />
        </SelectInput>
      </Field>
      <Field id="cut-trigger" label="Trigger" required error={show('trigger')} hint="When a study period’s commission is earned.">
        <SelectInput id="cut-trigger" value={v.trigger} placeholder="Choose the trigger" invalid={!!show('trigger')} onChange={(e) => set({ trigger: e.target.value as Trigger })}>
          <Options list={TRIGGER_LABELS} />
        </SelectInput>
      </Field>
      <Field id="cut-inst" label="Instalments" required error={show('inst')} hint="Study periods the university pays commission on (like 2 for the first year of semesters).">
        <TextInput id="cut-inst" inputMode="numeric" value={numText(v.inst)} invalid={!!show('inst')} onChange={(e) => set({ inst: numOf(e.target.value) })} />
      </Field>
      <Field id="cut-pay" label="Pay within (days)" required error={show('payDays')} hint="Days after GSP’s invoice.">
        <TextInput id="cut-pay" inputMode="numeric" value={numText(v.payDays)} invalid={!!show('payDays')} onChange={(e) => set({ payDays: numOf(e.target.value) })} />
      </Field>
      <Field id="cut-cap" label={`Cap per student${cur ? ` (${cur})` : ''}`} optional hint="The most commission per student.">
        <TextInput id="cut-cap" inputMode="decimal" value={numText(v.cap)} onChange={(e) => set({ cap: numOf(e.target.value) })} />
      </Field>
      {levels.length > 0 && (
        <>
          <p className="cform__sec">Fixed amount instead{cur ? ` (${cur})` : ''}, per level: when set, replaces the rate</p>
          <div className="cform__levels">
            {levels.map((l) => (
              <Field key={l} id={`cut-fixed-${LEVELS.indexOf(l)}`} label={l} optional>
                <TextInput id={`cut-fixed-${LEVELS.indexOf(l)}`} inputMode="decimal" value={numText(v.fixed[l])} onChange={(e) => setLevel('fixed', l, numOf(e.target.value))} />
              </Field>
            ))}
          </div>
        </>
      )}
      <Field id="cut-bands" label="Tier bands" optional error={show('bands')} className="iform__wide" hint="Enrolments with this university, counted per its year; the band’s rate replaces the level’s.">
        <BandsEditor id="cut-bands" bands={v.bands} unit="Rate (%)" invalid={!!show('bands')} onChange={(bands: Band[]) => set({ bands })} />
      </Field>
      <p className="cform__sec">Additional commission</p>
      <div className="cform__list">
        {v.addl.map((a, i) => (
          <div key={a.id} className="cform__row">
            <TextInput id={`cut-ad-d-${i}`} aria-label={`Additional commission ${i + 1}: description`} placeholder="Like: Service fee" value={a.desc} onChange={(e) => upAddl(i, { desc: e.target.value })} />
            <SelectInput id={`cut-ad-k-${i}`} aria-label={`Additional commission ${i + 1}: amount or %`} value={a.kind} onChange={(e) => upAddl(i, { kind: e.target.value as Addl['kind'] })}>
              <Options list={ADDL_KINDS} />
            </SelectInput>
            <TextInput id={`cut-ad-v-${i}`} aria-label={`Additional commission ${i + 1}: ${a.kind === '%' ? 'percent' : `amount in ${cur}`}`} inputMode="decimal" value={numText(a.value)} onChange={(e) => upAddl(i, { value: numOf(e.target.value) ?? NaN })} />
            <SelectInput id={`cut-ad-w-${i}`} aria-label={`Additional commission ${i + 1}: when`} value={a.when} onChange={(e) => upAddl(i, { when: e.target.value as Addl['when'] })}>
              <Options list={ADDL_WHEN} />
            </SelectInput>
            <button type="button" className="icon-btn" aria-label={`Remove additional commission ${i + 1}`} onClick={() => set({ addl: v.addl.filter((_, j) => j !== i) })}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--secondary btn--sm iadd" style={{ justifySelf: 'start' }} onClick={() => set({ addl: [...v.addl, { id: `ad-n${++rid}`, desc: '', kind: ADDL_KINDS[0], value: NaN, when: ADDL_WHEN[0] }] })}>
          <Icon name="plus" size={16} /> Add additional commission
        </button>
      </div>
      <p className="cform__sec">Bonus</p>
      <div className="cform__list">
        {v.bonus.map((b, i) => (
          <div key={b.id} className="cform__row cform__row--bonus">
            <TextInput id={`cut-bn-d-${i}`} aria-label={`Bonus ${i + 1}: description`} placeholder="Like: Volume bonus" value={b.desc} onChange={(e) => upBonus(i, { desc: e.target.value })} />
            <TextInput id={`cut-bn-a-${i}`} aria-label={`Bonus ${i + 1}: amount in ${cur}`} placeholder={`Amount${cur ? ` (${cur})` : ''}`} inputMode="decimal" value={numText(b.amount)} onChange={(e) => upBonus(i, { amount: numOf(e.target.value) ?? NaN })} />
            <TextInput id={`cut-bn-m-${i}`} aria-label={`Bonus ${i + 1}: when this many students enrol`} placeholder="Students" inputMode="numeric" value={numText(b.min)} onChange={(e) => upBonus(i, { min: numOf(e.target.value) ?? NaN })} />
            <TextInput id={`cut-bn-y-${i}`} aria-label={`Bonus ${i + 1}: in the year`} placeholder="Year" inputMode="numeric" value={numText(b.year)} onChange={(e) => upBonus(i, { year: numOf(e.target.value) ?? NaN })} />
            <button type="button" className="icon-btn" aria-label={`Remove bonus ${i + 1}`} onClick={() => set({ bonus: v.bonus.filter((_, j) => j !== i) })}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--secondary btn--sm iadd" style={{ justifySelf: 'start' }} onClick={() => set({ bonus: [...v.bonus, { id: `bn-n${++rid}`, desc: '', amount: NaN, min: NaN, year: Number(todayIso().slice(0, 4)) }] })}>
          <Icon name="plus" size={16} /> Add bonus
        </button>
      </div>
      <Field id="cut-contract" label="Contract" required error={show('contract')} hint={`PDF, up to ${s.settings.maxFileMb} MB. Shown to preview on the university’s Commission tab.`} className="iform__wide">
        <FilePick id="cut-contract" value={v.contract} accept=".pdf,application/pdf" maxMb={s.settings.maxFileMb} invalid={!!show('contract')} onTooBig={setBig} onChange={(contract) => set({ contract })} />
      </Field>
      <Field id="cut-notes" label="Notes" optional className="iform__wide" hint="Shown on the university’s Commission tab.">
        <Area id="cut-notes" value={v.notes} onChange={(notes) => set({ notes })} />
      </Field>
    </FormSheet>
  );
}
