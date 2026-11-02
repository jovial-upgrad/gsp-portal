import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Field, TextInput } from '../../components/forms';
import { SelectMenu } from '../../components/SelectMenu';
import { useCheck } from '../../components/validate';
import { PageHead } from '../../institution/records/parts';
import { EQUIV_COLS, bandError, equivOf, gradesOf, overlapOf, withEquiv, withGrades, type Band, type ConvertBy, type EquivRow, type GradingSystem } from '../data/eligibility';
import type { ConfigProps } from './ConfigPage';
import { CellError, EditBar, History, Panel, useDraft } from './parts';
import { NumberField } from '../../components/NumberField';

const valuesOf = (g: GradingSystem) =>
  g.by === 'As is' ? '—' : g.by === 'Multiplier' ? `× ${g.mult}` : g.bands.map((b) => `${b.from === b.to ? b.from : `${b.from}–${b.to}`} = ${b.pct}%`).join(', ');

/**
 * Admin › Course configuration › **Grade conversion** (slice 3 PRD, decided 2 Nov: S3-4, S3-15, S3-29). Each grading
 * system converts to a percentage as is, by a multiplier or by bands; the eligibility check compares the student's
 * score and the course's minimum in percentages. Seeded with 9 systems. Admin adds, edits, retires and restores them;
 * every save is logged. A retired system leaves the picker on the student record; entries already on it keep it (S3C-18).
 */
export function GradeConversion({ cfg, change, say, canEdit }: ConfigProps) {
  const list = gradesOf(cfg);
  const [form, setForm] = useState<GradingSystem | null>(null);
  const save = (g: GradingSystem) => {
    const was = list.find((x) => x.id === g.id);
    change('Grade conversion', `${was ? 'Edited' : 'Added'} ${g.name}: ${g.by}${g.by === 'As is' ? '' : ` (${valuesOf(g)})`}`, (c) => withGrades(c, was ? gradesOf(c).map((x) => (x.id === g.id ? g : x)) : [...gradesOf(c), g]));
    say(`${g.name} saved. Verdicts use it from now.`);
    setForm(null);
  };
  const setStatus = (g: GradingSystem, status: GradingSystem['status']) => {
    change('Grade conversion', `${status === 'Retired' ? 'Retired' : 'Restored'} ${g.name}`, (c) => withGrades(c, gradesOf(c).map((x) => (x.id === g.id ? { ...x, status } : x))));
    say(status === 'Retired' ? `${g.name} retired: it’s no longer offered on the student record.` : `${g.name} restored.`);
  };
  return (
    <>
      <PageHead title="Grade conversion" lead="How each grading system converts to a percentage. The eligibility check compares a student’s score with a course’s minimum in percentages; a score that meets only after conversion counts as plain Meets.">
        {canEdit && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setForm({ id: `gs-${Date.now().toString(36)}`, name: '', usedIn: '', by: 'Multiplier', mult: undefined, bands: [], status: 'Active' })}>
            Add a grading system
          </Button>
        )}
      </PageHead>
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Grading system</th>
                <th scope="col">Used in (countries)</th>
                <th scope="col">Converts to percentage by</th>
                <th scope="col">Values</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <tr key={g.id} className={g.status === 'Retired' ? 'is-muted' : ''}>
                  <td className="cfg__strong">{g.name}</td>
                  <td className="cfg__muted">{g.usedIn || '—'}</td>
                  <td>{g.by}</td>
                  <td className="num">{valuesOf(g)}</td>
                  <td>{g.status}</td>
                  <td className="cfg__acts">
                    {canEdit && (<>
                    <Button size="sm" variant="ghost" onClick={() => setForm(g)} aria-label={`Edit ${g.name}`}>
                      Edit
                    </Button>
                    {g.status === 'Active' ? (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(g, 'Retired')} aria-label={`Retire ${g.name}`}>
                        Retire
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(g, 'Active')} aria-label={`Restore ${g.name}`}>
                        Restore
                      </Button>
                    )}
                    </>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Grade conversion" />
      <GradeForm g={form} list={list} onCancel={() => setForm(null)} onSave={save} />
    </>
  );
}

/** Add a grading system, or Edit one: Name, Used in, how it converts, the multiplier or the bands; Cancel and Save. */
function GradeForm({ g, list, onCancel, onSave }: { g: GradingSystem | null; list: GradingSystem[]; onCancel: () => void; onSave: (g: GradingSystem) => void }) {
  const [v, setV] = useState<GradingSystem | null>(null);
  const [multText, setMultText] = useState('');
  const [tried, setTried] = useState(false);
  const cur = v && g && v.id === g.id ? v : g;
  if (!g && v) setV(null);
  if (g && (!v || v.id !== g.id)) {
    setV(structuredClone(g));
    setMultText(g.mult ? String(g.mult) : '');
    setTried(false);
  }
  const x = cur;
  const set = (p: Partial<GradingSystem>) => setV((o) => (o ? { ...o, ...p } : o));
  const setBand = (i: number, p: Partial<Band>) => setV((o) => (o ? { ...o, bands: o.bands.map((b, j) => (j === i ? { ...b, ...p } : b)) } : o));
  const name = x?.name.trim() ?? '';
  const nameErr = !name ? 'Give the grading system a name.' : list.some((y) => y.id !== x?.id && y.name.trim().toLowerCase() === name.toLowerCase()) ? 'A grading system with this name already exists.' : null;
  const mult = Number(multText);
  const multErr = x?.by === 'Multiplier' && (!multText.trim() || Number.isNaN(mult) || mult <= 0 || mult > 100 || !/^\d+(\.\d{1,2})?$/.test(multText.trim())) ? 'Enter a number greater than 0.' : null;
  const bandErrs = x?.by === 'Bands' ? x.bands.map(bandError) : [];
  const clash = x?.by === 'Bands' ? overlapOf(x.bands) : null;
  const bandsErr = x?.by === 'Bands' && !x.bands.length ? 'Add at least one band.' : null;
  const fmtBand = (b?: Band) => (b ? (b.from === b.to ? b.from : `${b.from}–${b.to}`) : '');
  const overlapMsg = clash && x ? `These bands overlap: ${fmtBand(x.bands[clash[0]])} runs into ${fmtBand(x.bands[clash[1]])}. Bands can’t overlap, so Save didn’t go through.` : null;
  const save = () => {
    setTried(true);
    if (!x || nameErr || multErr || bandsErr || bandErrs.some(Boolean) || clash) return;
    onSave({ ...x, name, usedIn: x.usedIn.trim(), mult: x.by === 'Multiplier' ? mult : undefined, bands: x.by === 'Bands' ? x.bands : [] });
  };
  return (
    <Sheet
      open={!!g}
      onClose={onCancel}
      center
      title={g && list.some((y) => y.id === g.id) ? `Edit ${g.name}` : 'Add a grading system'}
      footer={
        <div className="asf asf--end">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      }
    >
      {x && (
        <div className="cfg__form">
          <Field id="gs-name" label="Name" required error={tried ? nameErr : null}>
            <TextInput id="gs-name" maxLength={60} value={x.name} invalid={tried && !!nameErr} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field id="gs-used" label="Used in (countries)" optional hint="Shown next to the name when a student’s grading system is picked.">
            <TextInput id="gs-used" maxLength={120} value={x.usedIn} onChange={(e) => set({ usedIn: e.target.value })} />
          </Field>
          <Field id="gs-by" label="Converts to a percentage by" required>
            <SelectMenu id="gs-by" label="Converts to a percentage by" value={x.by} options={(['As is', 'Multiplier', 'Bands'] as ConvertBy[]).map((k) => ({ value: k, label: k }))} onChange={(k) => set({ by: k as ConvertBy, bands: k === 'Bands' && !x.bands.length ? [{ from: '', to: '', pct: 0 }] : x.bands })} />
          </Field>
          {x.by === 'Multiplier' && (
            <Field id="gs-mult" label="Multiplier" required hint="Up to 100, 2 decimals. A converted score above 100% counts as 100%." error={tried ? multErr : null}>
              <NumberField id="gs-mult" decimal value={multText} invalid={tried && !!multErr} onChange={(_t) => setMultText(_t.replace(/[^\d.]/g, ''))} />
            </Field>
          )}
          {x.by === 'Bands' && (
            <fieldset className="cfg__bands">
              <legend className="field__label">Bands</legend>
              <p className="cfg__note">From and To on the system’s own scale (To may be a grade, such as First), and the percentage it converts to.</p>
              <table className="itab cfg__tab">
                <thead>
                  <tr>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Percentage</th>
                    <th scope="col">
                      <span className="vh">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {x.bands.map((b, i) => {
                    const hit = !!clash && clash.includes(i) && tried;
                    const bad = tried && !!bandErrs[i];
                    return (
                      <tr key={i}>
                        <td>
                          <TextInput id={`gs-b${i}-from`} aria-label={`Band ${i + 1}, from`} className="cfg__cellinput" value={b.from} invalid={hit || bad} onChange={(e) => setBand(i, { from: e.target.value })} />
                        </td>
                        <td>
                          <TextInput id={`gs-b${i}-to`} aria-label={`Band ${i + 1}, to`} className="cfg__cellinput" value={b.to} invalid={hit || bad} onChange={(e) => setBand(i, { to: e.target.value })} />
                          <CellError id={`gs-b${i}`}>{bad ? bandErrs[i] : null}</CellError>
                        </td>
                        <td>
                          <NumberField id={`gs-b${i}-pct`} aria-label={`Band ${i + 1}, percentage`} className="cfg__cellinput cfg__num" value={String(b.pct)} onChange={(_t) => setBand(i, { pct: Number(_t.replace(/[^\d.]/g, '')) })} />
                        </td>
                        <td>
                          <Button size="sm" variant="ghost" onClick={() => setV((o) => (o ? { ...o, bands: o.bands.filter((_, j) => j !== i) } : o))} aria-label={`Remove band ${i + 1}`}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Button size="sm" variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setV((o) => (o ? { ...o, bands: [...o.bands, { from: '', to: '', pct: 0 }] } : o))}>
                Add a band
              </Button>
              {tried && (overlapMsg || bandsErr) && (
                <p className="field__msg field__msg--error" role="alert">
                  {overlapMsg ?? bandsErr}
                </p>
              )}
            </fieldset>
          )}
        </div>
      )}
    </Sheet>
  );
}

/**
 * Admin › Course configuration › **English test equivalence** (slice 3 PRD, decided 2 Nov: S3-16). Each row is the
 * same level on each test's scale; a score between two rows takes the lower row; sections convert with the same rows.
 * Edit, then Cancel or Save; + Add a row, Remove. Every cell required and within its test's range and steps; scores
 * go up row by row in every column; at least 2 rows. Logged.
 */
export function EnglishEquivalence({ cfg, change, say, canEdit }: ConfigProps) {
  const saved = equivOf(cfg);
  const d = useDraft<EquivRow[]>(saved, 'the English test equivalence');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const ed = d.editing;
  const errors: Record<string, string | null> = {};
  d.value.forEach((r, i) =>
    EQUIV_COLS.forEach((col) => {
      const t = typed[`${i}-${col.key}`] ?? String(r[col.key]);
      const n = Number(t);
      const ok = t.trim() !== '' && !Number.isNaN(n) && n >= col.min && n <= col.max && Math.abs((n - col.min) / col.step - Math.round((n - col.min) / col.step)) < 1e-6;
      errors[`eq-${i}-${col.key}`] = ok ? (i > 0 && n <= d.value[i - 1][col.key] ? 'Scores must go up row by row in every column.' : null) : `Enter a score from ${col.min} to ${col.max}.`;
    }),
  );
  errors['eq-rows'] = d.value.length < 2 ? 'Keep at least 2 rows.' : null;
  const v = useCheck(errors);
  const setCell = (i: number, k: keyof EquivRow, text: string) => {
    setTyped((x) => ({ ...x, [`${i}-${k}`]: text }));
    const n = Number(text);
    if (!Number.isNaN(n)) d.set((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: n } : r)));
  };
  const save = () => {
    if (!v.submit()) return;
    change('English test equivalence', `Saved ${d.value.length} rows: ${d.value.map((r) => `IELTS ${r.ielts} ≈ TOEFL ${r.toefl} ≈ PTE ${r.pte} ≈ Duolingo ${r.duolingo}`).join('; ')}`, (c) => withEquiv(c, d.value));
    say('English test equivalence saved. Verdicts use it from now.');
    setTyped({});
    v.reset();
    d.stop();
  };
  return (
    <>
      <PageHead title="English test equivalence" lead="How a score on one English test converts to the others. A student whose test the course doesn’t list is checked against the tests it does: met this way, the verdict is Eligible with conditions." />
      <Panel
        flush
        title="Equivalent scores"
        note="Find the score in its test’s column, take the row at or below it, and read across. Each section uses the same rows; TOEFL iBT sections are ×4 first."
        action={canEdit && <EditBar name="English test equivalence" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (v.reset(), setTyped({}), d.stop())} onSave={save} />}
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                {EQUIV_COLS.map((c) => (
                  <th key={c.key} scope="col">
                    {c.name}
                  </th>
                ))}
                {ed && (
                  <th scope="col">
                    <span className="vh">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {d.value.map((r, i) => (
                <tr key={i}>
                  {EQUIV_COLS.map((c) => {
                    const id = `eq-${i}-${c.key}`;
                    return (
                      <td key={c.key}>
                        {ed ? (
                          <>
                            <NumberField id={id} aria-label={`Row ${i + 1}, ${c.name}`} decimal className="cfg__cellinput cfg__num" value={typed[`${i}-${c.key}`] ?? String(r[c.key])} invalid={!!v.err(id)} aria-describedby={v.err(id) ? `${id}-error` : undefined} onBlur={v.blur(id)} onChange={(_t) => setCell(i, c.key, _t.replace(/[^\d.]/g, ''))} />
                            <CellError id={id}>{v.err(id)}</CellError>
                          </>
                        ) : (
                          <span className="num">{c.key === 'ielts' ? r[c.key].toFixed(1) : r[c.key]}</span>
                        )}
                      </td>
                    );
                  })}
                  {ed && (
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => (d.set((rows) => rows.filter((_, j) => j !== i)), setTyped({}))} aria-label={`Remove row ${i + 1}`}>
                        Remove
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ed && (
          <div className="cfg__foot">
            <Button size="sm" variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => d.set((rows) => [...rows, { ...(rows[rows.length - 1] ?? { ielts: 5.5, toefl: 46, pte: 42, duolingo: 95 }) }])}>
              Add a row
            </Button>
            <CellError id="eq-rows">{v.err('eq-rows')}</CellError>
          </div>
        )}
      </Panel>
      <History log={cfg.log} area="English test equivalence" />
    </>
  );
}
