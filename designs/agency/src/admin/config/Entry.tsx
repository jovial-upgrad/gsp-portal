import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { COUNTRIES } from '../../data/partners';
import { MultiPick } from '../../institution/records/MultiPick';
import { PageHead } from '../../institution/records/parts';
import { ENGLISH_TESTS, GRADE_METHODS, type Band, type EnglishRow, type GradeMethod, type GradeSystem } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditActions, History, Panel, useAsk } from './parts';

const short = (list: string[], n = 3) => (list.length <= n + 1 ? list.join(', ') : `${list.slice(0, n).join(', ')} and ${list.length - n} more`);
const valuesText = (g: GradeSystem) => (g.method === 'Multiplier' ? `× ${g.factor}` : g.method === 'Bands' ? (g.bands ?? []).map((b) => `${b.grade} = ${b.pct}%`).join(', ') : '–');

/**
 * Grade Conversion (Nesil, 3 Nov, after the reference screen): how each grading system becomes a percentage, which
 * the eligibility check compares with a course's minimum. As it is, times a number, or grade by grade. **Add Grading
 * System** in a pop-up (countries picked from a list); each row has Edit and Deactivate (asked first).
 */
export function GradeConversion({ cfg, change, say }: ConfigProps) {
  const [edit, setEdit] = useState<GradeSystem | 'new' | null>(null);
  const [asking, setAsking] = useState<GradeSystem | null>(null);
  return (
    <>
      <PageHead title="Grade Conversion" lead="How each grading system converts to a percentage, for the eligibility check.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
          Add Grading System
        </Button>
      </PageHead>
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab gc__tab">
            <thead>
              <tr>
                <th scope="col">Grading system</th>
                <th scope="col">Used in</th>
                <th scope="col">Converts by</th>
                <th scope="col">Values</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.grades.map((g) => (
                <tr key={g.id} className={g.on ? '' : 'is-off'}>
                  <td className="cfg__strong">{g.name}</td>
                  <td className="cfg__muted" title={g.countries.join(', ')}>
                    {g.countries.length ? short(g.countries) : 'Any country'}
                  </td>
                  <td>{g.method}</td>
                  <td>
                    {g.method === 'Bands' ? (
                      <span className="gc__bands">
                        {(g.bands ?? []).map((b) => (
                          <span key={b.grade} className="gc__band num">
                            {b.grade} <span aria-hidden="true">=</span>
                            <span className="vh"> is </span> {b.pct}%
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="num">{valuesText(g)}</span>
                    )}
                  </td>
                  <td>
                    <span className={`cfg__state ${g.on ? 'is-on' : ''}`}>{g.on ? 'Active' : 'Deactivated'}</span>
                  </td>
                  <td className="cfg__linkacts">
                    <button type="button" className="cfg__linkbtn" aria-label={`Edit ${g.name}`} onClick={() => setEdit(g)}>
                      Edit
                    </button>
                    <button type="button" className={`cfg__linkbtn ${g.on ? 'is-danger' : ''}`} aria-label={`${g.on ? 'Deactivate' : 'Reactivate'} ${g.name}`} onClick={() => setAsking(g)}>
                      {g.on ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cfg__foot cfg__note">A score that meets the course’s minimum only after conversion counts as a plain Meets. A converted score above 100% counts as 100%.</p>
      </Panel>
      <History log={cfg.log} area="Grade conversion" />
      <GradeDialog
        open={!!edit}
        g={edit === 'new' ? null : edit}
        all={cfg.grades}
        onClose={() => setEdit(null)}
        onSave={(g) => {
          const isNew = !cfg.grades.some((x) => x.id === g.id);
          change('Grade conversion', `${isNew ? 'Added' : 'Edited'} ${g.name}: ${g.method}${g.method === 'As is' ? '' : `, ${valuesText(g)}`}`, (c) => ({ ...c, grades: isNew ? [...c.grades, g] : c.grades.map((x) => (x.id === g.id ? g : x)) }));
          say(`${g.name} ${isNew ? 'added' : 'saved'}.`);
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!asking}
        title={asking ? `${asking.on ? 'Deactivate' : 'Reactivate'} ${asking.name}?` : ''}
        confirm={asking?.on ? 'Deactivate Grading System' : 'Reactivate Grading System'}
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          const g = asking!;
          change('Grade conversion', `${g.on ? 'Deactivated' : 'Reactivated'} ${g.name}`, (c) => ({ ...c, grades: c.grades.map((x) => (x.id === g.id ? { ...x, on: !x.on } : x)) }));
          say(`${g.name} ${g.on ? 'deactivated' : 'reactivated'}.`);
          setAsking(null);
        }}
      >
        <p>{asking?.on ? 'It can’t be picked for a student’s education any more. Profiles that use it keep their scores, converted as now.' : 'It can be picked for a student’s education again.'}</p>
      </ConfirmDialog>
    </>
  );
}

/** Add or edit a grading system: its name, the countries it's used in, how it converts, and its values. */
function GradeDialog({ open, g, all, onClose, onSave }: { open: boolean; g: GradeSystem | null; all: GradeSystem[]; onClose: () => void; onSave: (g: GradeSystem) => void }) {
  const [name, setName] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [method, setMethod] = useState<GradeMethod>('Multiplier');
  const [factor, setFactor] = useState('');
  const [bands, setBands] = useState<{ grade: string; pct: string }[]>([]);
  const [tried, setTried] = useState(false);
  const [ask, asking] = useAsk();
  useEffect(() => {
    if (!open) return;
    setName(g?.name ?? '');
    setCountries(g?.countries ?? []);
    setMethod(g?.method ?? 'Multiplier');
    setFactor(g?.factor ? String(g.factor) : '');
    setBands((g?.bands ?? [{ grade: '', pct: 0 }]).map((b) => ({ grade: b.grade, pct: b.pct ? String(b.pct) : '' })));
    setTried(false);
  }, [open, g?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = name.trim();
  const f = Number(factor);
  const filled = bands.filter((b) => b.grade.trim() || b.pct);
  const err = {
    name: v.length < 2 ? 'Name the grading system.' : all.some((x) => x.id !== g?.id && x.name.toLowerCase() === v.toLowerCase()) ? 'There’s already one with this name.' : null,
    values:
      method === 'Multiplier'
        ? !(f > 0) || f > 100 || !/^\d+(\.\d{1,2})?$/.test(factor.trim())
          ? 'Enter a number up to 100, with up to 2 decimals.'
          : null
        : method === 'Bands'
          ? !filled.length || filled.some((b) => !b.grade.trim() || !(Number(b.pct) > 0) || Number(b.pct) > 100)
            ? 'Give each grade its percentage, up to 100.'
            : null
          : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({
      id: g?.id ?? `g-${Date.now()}`,
      name: v,
      countries,
      method,
      factor: method === 'Multiplier' ? f : undefined,
      bands: method === 'Bands' ? filled.map((b): Band => ({ grade: b.grade.trim(), pct: Number(b.pct) })) : undefined,
      on: g?.on ?? true,
    });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={g ? `Edit ${g.name}` : 'Add Grading System'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{g ? 'Save Changes' : 'Add Grading System'}</Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="gc-name" label="Name" required error={show('name')}>
          <TextInput id="gc-name" value={name} invalid={!!show('name')} placeholder="Like: CGPA out of 10" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="gc-countries" label="Used in" optional hint="Shown next to the name when a student’s grading system is picked.">
          <MultiPick id="gc-countries" label="Used in" value={countries} options={COUNTRIES.map((c) => c.name)} onChange={setCountries} empty="Choose countries" search />
        </Field>
        <Field id="gc-method" label="Converts to a percentage by" required>
          <SelectInput id="gc-method" value={method} onChange={(e) => setMethod(e.target.value as GradeMethod)}>
            {GRADE_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </SelectInput>
        </Field>
        {method === 'Multiplier' && (
          <Field id="gc-values" label="Values" required error={show('values')} hint="The score is multiplied by this. Up to 100, 2 decimals.">
            <TextInput id="gc-values" inputMode="decimal" value={factor} invalid={!!show('values')} placeholder="Like: 9.5" onChange={(e) => setFactor(e.target.value.replace(/[^\d.]/g, ''))} />
          </Field>
        )}
        {method === 'Bands' && (
          <Field id="gc-band-0" label="Values" required error={show('values')} hint="Each grade and the percentage it counts as.">
            <div className="gc__rows">
              {bands.map((b, i) => (
                <div key={i} className="gc__row">
                  <TextInput id={`gc-band-${i}`} aria-label={`Grade ${i + 1}`} value={b.grade} placeholder="Grade, like First" onChange={(e) => setBands((l) => l.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} />
                  <span className="gc__eq" aria-hidden="true">
                    =
                  </span>
                  <span className="cfg__money gc__pct">
                    <TextInput id={`gc-pct-${i}`} aria-label={`Grade ${i + 1}: percentage`} inputMode="decimal" value={b.pct} placeholder="70" onChange={(e) => setBands((l) => l.map((x, j) => (j === i ? { ...x, pct: e.target.value.replace(/[^\d.]/g, '') } : x)))} />
                    <span>%</span>
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove grade ${i + 1}`}
                    disabled={bands.length === 1}
                    onClick={() => {
                      const drop = () => setBands((l) => l.filter((_, j) => j !== i));
                      // an empty row goes straight away; one with a grade in it is asked first
                      if (!b.grade.trim() && !b.pct) drop();
                      else ask({ title: `Remove ${b.grade.trim() || `grade ${i + 1}`}?`, confirm: 'Remove Grade', body: 'It comes out of this grading system when you save.', run: drop });
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn--link gc__add" onClick={() => setBands((l) => [...l, { grade: '', pct: '' }])}>
                <Icon name="plus" size={16} /> Add Grade
              </button>
            </div>
          </Field>
        )}
        {method === 'As is' && <p className="cfg__note">The score is already a percentage, so it’s used as it is.</p>}
      </div>
      {asking}
    </Sheet>
  );
}

/**
 * English Test Equivalence (Nesil, 3 Nov, after the reference screen): how a score on one English test converts to
 * the others. A student whose test the course doesn't list is checked against the tests it does: met this way, the
 * verdict is Eligible with conditions. It reads as it is until Edit; rows can be changed, added or taken out, then
 * Save Changes.
 */
export function EnglishEquivalence({ cfg, change, say }: ConfigProps) {
  const [draft, setDraft] = useState<EnglishRow[] | null>(null);
  const [ask, asking] = useAsk();
  const rows = draft ?? cfg.english;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(cfg.english);
  const fmt = (k: string, v: number) => (k === 'ielts' ? v.toFixed(1) : String(v));
  return (
    <>
      <PageHead title="English Test Equivalence" lead="How a score on one English test converts to the others, when a course doesn’t list the student’s test." />
      <Panel
        flush
        title="Equivalent Scores"
        note="Find the score in its test’s column, take the row at or below it, and read across. TOEFL iBT sections are ×4 first."
        action={
          <EditActions
            editing={!!draft}
            dirty={dirty}
            onEdit={() => setDraft(cfg.english)}
            onCancel={() => setDraft(null)}
            onSave={() => {
              const d = [...draft!].sort((a, b) => a.ielts - b.ielts);
              change('English test equivalence', `Equivalent scores: ${d.length} rows (${d.map((r) => `IELTS ${r.ielts.toFixed(1)} = TOEFL ${r.toefl}, PTE ${r.pte}, Duolingo ${r.duolingo}`).join('; ')})`, (c) => ({ ...c, english: d }));
              say('Equivalent scores saved.');
              setDraft(null);
            }}
          />
        }
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__tab--even en__tab">
            <thead>
              <tr>
                {ENGLISH_TESTS.map(([k, l]) => (
                  <th key={k} scope="col">
                    {l}
                  </th>
                ))}
                {draft && (
                  <th scope="col" className="cfg__actcol">
                    <span className="vh">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  {ENGLISH_TESTS.map(([k, l]) => (
                    <td key={k} className="num">
                      {draft ? (
                        <TextInput
                          id={`en-${k}-${r.id}`}
                          aria-label={`Row ${i + 1}: ${l}`}
                          inputMode="decimal"
                          className="cfg__cellinput cfg__num"
                          defaultValue={fmt(k, r[k])}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (n > 0) setDraft((d) => d!.map((x) => (x.id === r.id ? { ...x, [k]: n } : x)));
                          }}
                        />
                      ) : (
                        fmt(k, r[k])
                      )}
                    </td>
                  ))}
                  {draft && (
                    <td className="cfg__acts">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove row ${i + 1}`}
                        disabled={rows.length === 1}
                        onClick={() =>
                          ask({
                            title: `Remove row ${i + 1}?`,
                            confirm: 'Remove Row',
                            body: `IELTS ${r.ielts.toFixed(1)}, TOEFL ${r.toefl}, PTE ${r.pte}, Duolingo ${r.duolingo}. It comes out when you save.`,
                            run: () => setDraft((d) => d!.filter((x) => x.id !== r.id)),
                          })
                        }
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {draft && (
          <div className="cfg__foot">
            <button
              type="button"
              className="btn btn--link gc__add"
              onClick={() => {
                const last = rows[rows.length - 1];
                setDraft((d) => [...d!, { id: `en${Date.now()}`, ielts: last.ielts + 0.5, toefl: last.toefl + 8, pte: last.pte + 7, duolingo: last.duolingo + 10 }]);
              }}
            >
              <Icon name="plus" size={16} /> Add Row
            </button>
          </div>
        )}
      </Panel>
      <History log={cfg.log} area="English test equivalence" />
      {asking}
    </>
  );
}
