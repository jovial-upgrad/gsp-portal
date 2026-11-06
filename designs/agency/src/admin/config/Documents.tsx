import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { COUNTRIES } from '../../data/partners';
import { MultiPick } from '../../institution/records/MultiPick';
import { PageHead } from '../../institution/records/parts';
import { DOC_UNI_COUNTRIES, STAGES, whenText, type DocRule, type RpDocRule } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditActions, History, Panel, useAsk, type Ask } from './parts';

type Draft = { docRules: DocRule[]; rpDocs: RpDocRule[]; reasons: string[]; categories: string[] };

/**
 * Document Configuration (PM: Settings › Document rules and Agency documents). **Application documents**: one table
 * decides what an application asks for, at which stage, when, mandatory or optional, and who uploads it; nobody sets
 * documents on a course. **Recruitment partner documents**: what a partner sends to be verified, by its country.
 * 3 Nov (Nesil): **send-back reasons** too, the ones GSP picks from when it sends a document back; and the page reads
 * as it is until Edit, then Save Changes keeps everything changed. 4 Nov (Nesil): a rule applies by program level,
 * study area, university country and the student's current country, several of each; **request categories**, what
 * GSP asks a partner for; no icon before a reason; and every delete or remove is asked first.
 */
export function Documents({ cfg, change, say }: ConfigProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ask, asking] = useAsk();
  const saved: Draft = { docRules: cfg.docRules, rpDocs: cfg.rpDocs, reasons: cfg.reasons, categories: cfg.categories };
  const d: Draft = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (r: DocRule, patch: Partial<DocRule>) => setDraft((x) => ({ ...x!, docRules: x!.docRules.map((y) => (y.id === r.id ? { ...y, ...patch } : y)) }));
  const save = () => {
    const x = draft!;
    const what: string[] = [];
    x.docRules.forEach((r) => {
      const was = cfg.docRules.find((y) => y.id === r.id);
      if (!was) what.push(`added ${r.doc} (${r.stage}, ${whenText(r)}, ${r.setting.toLowerCase()}, uploaded by ${r.by})`);
      else {
        const ch = [was.stage !== r.stage && `stage → ${r.stage}`, was.setting !== r.setting && r.setting.toLowerCase(), was.by !== r.by && `uploaded by ${r.by}`, was.on !== r.on && (r.on ? 'switched on' : 'switched off')].filter(Boolean);
        if (ch.length) what.push(`${r.doc}: ${ch.join(', ')}`);
      }
    });
    cfg.docRules.filter((r) => !x.docRules.some((y) => y.id === r.id)).forEach((r) => what.push(`deleted ${r.doc}`));
    if (JSON.stringify(x.rpDocs) !== JSON.stringify(cfg.rpDocs)) what.push('recruitment partner documents changed');
    x.reasons.filter((r) => !cfg.reasons.includes(r)).forEach((r) => what.push(`added send-back reason “${r}”`));
    cfg.reasons.filter((r) => !x.reasons.includes(r)).forEach((r) => what.push(`removed send-back reason “${r}”`));
    x.categories.filter((r) => !cfg.categories.includes(r)).forEach((r) => what.push(`added request category “${r}”`));
    cfg.categories.filter((r) => !x.categories.includes(r)).forEach((r) => what.push(`removed request category “${r}”`));
    change('Document configuration', what.join('; '), (c) => ({ ...c, docRules: x.docRules, rpDocs: x.rpDocs, reasons: x.reasons, categories: x.categories }));
    say('Saved. Applies to stages an open application hasn’t reached yet.');
    setDraft(null);
  };
  return (
    <>
      <PageHead title="Document Configuration" lead="Which documents an application asks for, which a partner sends, and why GSP sends one back.">
        <EditActions editing={!!draft} dirty={dirty} onEdit={() => setDraft(saved)} onCancel={() => setDraft(null)} onSave={save} />
      </PageHead>
      <Panel
        title="Application Documents"
        note="One table decides which documents an application asks for; nobody sets documents on a course. The RP only sees what’s needed for the current stage."
        action={
          draft ? (
            <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setAdding(true)}>
              Add Rule
            </Button>
          ) : undefined
        }
        flush
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__docs">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Document</th>
                <th scope="col">Application stage</th>
                <th scope="col">Applies when</th>
                <th scope="col">Setting</th>
                <th scope="col">Uploaded by</th>
                <th scope="col">Status</th>
                {draft && (
                  <th scope="col">
                    <span className="vh">Delete</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {d.docRules.map((r, i) => (
                <tr key={r.id} className={r.on ? '' : 'is-off'}>
                  <td className="cfg__muted num">{i + 1}</td>
                  <td className="cfg__strong">{r.doc}</td>
                  <td>
                    {draft ? (
                      <SelectInput id={`dr-st-${r.id}`} aria-label={`${r.doc}: stage`} value={r.stage} onChange={(e) => set(r, { stage: e.target.value as DocRule['stage'] })}>
                        {STAGES.map((st) => (
                          <option key={st}>{st}</option>
                        ))}
                      </SelectInput>
                    ) : (
                      r.stage
                    )}
                  </td>
                  <td className="cfg__muted">{whenText(r)}</td>
                  <td>
                    {draft ? (
                      <SelectInput id={`dr-se-${r.id}`} aria-label={`${r.doc}: setting`} value={r.setting} onChange={(e) => set(r, { setting: e.target.value as DocRule['setting'] })}>
                        <option>Mandatory</option>
                        <option>Optional</option>
                      </SelectInput>
                    ) : (
                      r.setting
                    )}
                  </td>
                  <td>
                    {draft ? (
                      <SelectInput id={`dr-by-${r.id}`} aria-label={`${r.doc}: uploaded by`} value={r.by} onChange={(e) => set(r, { by: e.target.value as DocRule['by'] })}>
                        <option>RP</option>
                        <option>GSP</option>
                      </SelectInput>
                    ) : (
                      r.by
                    )}
                  </td>
                  <td>
                    {draft ? (
                      <Switch id={`dr-on-${r.id}`} checked={r.on} onChange={(v) => set(r, { on: v })}>
                        <span className="vh">{r.doc}</span>
                      </Switch>
                    ) : (
                      <span className={`cfg__state ${r.on ? 'is-on' : ''}`}>{r.on ? 'On' : 'Off'}</span>
                    )}
                  </td>
                  {draft && (
                    <td className="cfg__acts">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Delete the ${r.doc} rule`}
                        onClick={() =>
                          ask({
                            title: `Delete the ${r.doc} rule?`,
                            confirm: 'Delete Rule',
                            body: 'Once you save, applications stop asking for it at the stages they haven’t reached.',
                            run: () => setDraft((x) => ({ ...x!, docRules: x!.docRules.filter((y) => y.id !== r.id) })),
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
      </Panel>

      <RpDocs rules={d.rpDocs} editing={!!draft} ask={ask} set={(fn) => setDraft((x) => ({ ...x!, rpDocs: fn(x!.rpDocs) }))} />

      <TextList
        id="rs"
        title="Send-back Reasons"
        note="What GSP picks from when it sends a document back to the recruitment partner, with its own note under it."
        items={d.reasons}
        editing={!!draft}
        ask={ask}
        set={(fn) => setDraft((x) => ({ ...x!, reasons: fn(x!.reasons) }))}
        what="Reason"
        placeholder="Add a reason, like: Signature missing"
        gone="GSP can’t pick it when it sends a document back."
      />

      {/* 4 Nov (Nesil): laid out like Send-back Reasons; the samples are the requests GSP already makes */}
      <TextList
        id="rc"
        title="Request Categories"
        note="What GSP picks from when it asks the recruitment partner for something on an application."
        items={d.categories}
        editing={!!draft}
        ask={ask}
        set={(fn) => setDraft((x) => ({ ...x!, categories: fn(x!.categories) }))}
        what="Category"
        placeholder="Add a category, like: Proof of address"
        gone="GSP can’t pick it for a request."
      />
      <History log={cfg.log} area="Document configuration" />
      {asking}
      <AddRule
        open={adding}
        levels={cfg.levels.filter((l) => l.on).map((l) => l.name)}
        areas={cfg.areas.filter((a) => a.on).map((a) => a.name)}
        onClose={() => setAdding(false)}
        onSave={(r) => {
          setDraft((x) => ({ ...x!, docRules: [...x!.docRules, r] }));
          setAdding(false);
        }}
      />
    </>
  );
}

/**
 * A list of short texts, each changed in place while editing, taken out with × (asked first) or added at the foot:
 * the send-back reasons and the request categories. No icon before each one (Nesil, 4 Nov).
 */
function TextList({
  id,
  title,
  note,
  items,
  editing,
  ask,
  set,
  what,
  placeholder,
  gone,
}: {
  id: string;
  title: string;
  note: ReactNode;
  items: string[];
  editing: boolean;
  ask: (a: Ask) => void;
  set: (fn: (l: string[]) => string[]) => void;
  /** One of them, as a button names it: Reason, Category. */
  what: string;
  placeholder: string;
  /** What happens once one is taken out and saved. */
  gone: string;
}) {
  const [v, setV] = useState('');
  useEffect(() => {
    if (!editing) setV('');
  }, [editing]);
  const t = v.trim();
  return (
    <Panel title={title} note={note}>
      <ul className="cfg__reasons">
        {items.map((r, i) => (
          <li key={`${i}-${r}`}>
            {editing ? (
              <TextInput id={`${id}-${i}`} aria-label={`${what} ${i + 1}`} defaultValue={r} onBlur={(e) => e.target.value.trim() && set((l) => l.map((y, j) => (j === i ? e.target.value.trim() : y)))} />
            ) : (
              <span>{r}</span>
            )}
            {editing && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove “${r}”`}
                disabled={items.length === 1}
                onClick={() => ask({ title: `Remove “${r}”?`, confirm: `Remove ${what}`, body: `Once you save, ${gone}`, run: () => set((l) => l.filter((_, j) => j !== i)) })}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <div className="cfg__add">
          <TextInput id={`${id}-new`} aria-label={`A new ${what.toLowerCase()}`} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
          <Button
            variant="secondary"
            size="sm"
            disabled={!t || items.some((x) => x.toLowerCase() === t.toLowerCase())}
            onClick={() => {
              set((l) => [...l, t]);
              setV('');
            }}
          >
            Add {what}
          </Button>
        </div>
      )}
    </Panel>
  );
}

/** What a recruitment partner sends to be verified: every rule matching its country applies, and their documents add up. */
function RpDocs({ rules, editing, ask, set }: { rules: RpDocRule[]; editing: boolean; ask: (a: Ask) => void; set: (fn: (l: RpDocRule[]) => RpDocRule[]) => void }) {
  const [doc, setDoc] = useState<Record<string, string>>({});
  const upd = (r: RpDocRule, patch: Partial<RpDocRule>) => set((l) => l.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
  // the patch is worked out when the answer comes, from the rule as it is then
  const updWith = (id: string, fn: (r: RpDocRule) => Partial<RpDocRule>) => set((l) => l.map((x) => (x.id === id ? { ...x, ...fn(x) } : x)));
  return (
    <Panel
      title="Recruitment Partner Documents"
      note="Every rule that matches the partner’s country applies, and their documents add up (each document is asked for once). All are mandatory."
      action={
        editing ? (
          <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => set((l) => [...l, { id: `r${Date.now()}`, applies: 'Only these countries', countries: [], docs: [] }])}>
            Add Rule
          </Button>
        ) : undefined
      }
    >
      <div className="cfg__rprules">
        {rules.map((r, i) => (
          <div key={r.id} className="cfg__rprule">
            <div className="cfg__rphead">
              <p className="cfg__strong">Rule {i + 1}</p>
              {editing ? (
                <>
                  <SelectInput id={`rpa-${r.id}`} aria-label={`Rule ${i + 1}: applies to`} value={r.applies} onChange={(e) => upd(r, { applies: e.target.value as RpDocRule['applies'] })}>
                    <option>Only these countries</option>
                    <option>All countries except</option>
                    <option>All countries</option>
                  </SelectInput>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete rule ${i + 1}`}
                    onClick={() => ask({ title: `Delete rule ${i + 1}?`, confirm: 'Delete Rule', body: 'Once you save, partners aren’t asked for its documents, unless another rule asks for them.', run: () => set((l) => l.filter((x) => x.id !== r.id)) })}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </>
              ) : (
                <span className="cfg__tag">{r.applies}</span>
              )}
            </div>
            {r.applies !== 'All countries' && (
              <div className="cfg__chips">
                {r.countries.map((c) => (
                  <span key={c} className="cfg__chip">
                    {c}
                    {editing && (
                      <button type="button" aria-label={`Remove ${c}`} onClick={() => ask({ title: `Remove ${c} from rule ${i + 1}?`, confirm: 'Remove Country', body: `It comes out of rule ${i + 1} when you save.`, run: () => updWith(r.id, (x) => ({ countries: x.countries.filter((y) => y !== c) })) })}>
                        <Icon name="close" size={12} />
                      </button>
                    )}
                  </span>
                ))}
                {!r.countries.length && !editing && <span className="cfg__muted">No countries yet</span>}
                {editing && (
                  <SelectInput id={`rpc-${r.id}`} aria-label={`Rule ${i + 1}: add a country`} className="cfg__mini" value="" placeholder="Add country" onChange={(e) => e.target.value && upd(r, { countries: [...r.countries, e.target.value] })}>
                    {COUNTRIES.filter((c) => !r.countries.includes(c.name)).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </div>
            )}
            <ul className="cfg__doclist">
              {r.docs.map((dname) => (
                <li key={dname}>
                  <Icon name="file" size={16} />
                  <span>{dname}</span>
                  {editing && (
                    <button type="button" className="icon-btn" aria-label={`Remove ${dname}`} onClick={() => ask({ title: `Remove ${dname}?`, confirm: 'Remove Document', body: `Rule ${i + 1} stops asking for it when you save.`, run: () => updWith(r.id, (x) => ({ docs: x.docs.filter((y) => y !== dname) })) })}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </li>
              ))}
              {!r.docs.length && <li className="cfg__muted">No documents yet</li>}
            </ul>
            {editing && (
              <div className="cfg__add">
                <TextInput id={`rpd-${r.id}`} aria-label={`Rule ${i + 1}: add a document`} placeholder="Add a document" value={doc[r.id] ?? ''} onChange={(e) => setDoc((x) => ({ ...x, [r.id]: e.target.value }))} />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!doc[r.id]?.trim()}
                  onClick={() => {
                    upd(r, { docs: [...r.docs, doc[r.id].trim()] });
                    setDoc((x) => ({ ...x, [r.id]: '' }));
                  }}
                >
                  Add Document
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * A new application document rule: the document, its stage, when it applies, mandatory or optional, and who uploads
 * it. 4 Nov (Nesil): when it applies is the **program levels**, **study areas**, **university countries** and the
 * **student's current countries**, several of each (none picked: any).
 */
function AddRule({ open, levels, areas, onClose, onSave }: { open: boolean; levels: string[]; areas: string[]; onClose: () => void; onSave: (r: DocRule) => void }) {
  const blank = { doc: '', stage: 'New' as DocRule['stage'], levels: [] as string[], areas: [] as string[], uni: [] as string[], now: [] as string[], setting: 'Mandatory' as DocRule['setting'], by: 'RP' as DocRule['by'] };
  const [v, setV] = useState(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(blank);
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = !v.doc.trim() ? 'Name the document.' : null;
  const rule: DocRule = { id: `d${Date.now()}`, ...v, doc: v.doc.trim(), on: true };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title="Add Document Rule"
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!err) onSave(rule);
              }}
            >
              Add Rule
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="ar-doc" label="Document" required error={tried ? err : null} className="iform__wide">
          <TextInput id="ar-doc" value={v.doc} invalid={tried && !!err} placeholder="Like: Medical certificate" onChange={(e) => setV((x) => ({ ...x, doc: e.target.value }))} />
        </Field>
        <Field id="ar-stage" label="Application stage" required>
          <SelectInput id="ar-stage" value={v.stage} onChange={(e) => setV((x) => ({ ...x, stage: e.target.value as DocRule['stage'] }))}>
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ar-level" label="Program level">
          <MultiPick id="ar-level" label="Program level" value={v.levels} options={levels} onChange={(x) => setV((y) => ({ ...y, levels: x }))} empty="Any program level" />
        </Field>
        <Field id="ar-area" label="Study area">
          <MultiPick id="ar-area" label="Study area" value={v.areas} options={areas} onChange={(x) => setV((y) => ({ ...y, areas: x }))} empty="Any study area" />
        </Field>
        <Field id="ar-uni" label="University country">
          <MultiPick id="ar-uni" label="University country" value={v.uni} options={DOC_UNI_COUNTRIES} onChange={(x) => setV((y) => ({ ...y, uni: x }))} empty="Any country" />
        </Field>
        <Field id="ar-now" label="Student’s current country">
          <MultiPick id="ar-now" label="Student’s current country" value={v.now} options={COUNTRIES.map((c) => c.name)} onChange={(x) => setV((y) => ({ ...y, now: x }))} empty="Any country" search />
        </Field>
        <Field id="ar-set" label="Setting">
          <SelectInput id="ar-set" value={v.setting} onChange={(e) => setV((x) => ({ ...x, setting: e.target.value as DocRule['setting'] }))}>
            <option>Mandatory</option>
            <option>Optional</option>
          </SelectInput>
        </Field>
        <Field id="ar-by" label="Uploaded by">
          <SelectInput id="ar-by" value={v.by} onChange={(e) => setV((x) => ({ ...x, by: e.target.value as DocRule['by'] }))}>
            <option>RP</option>
            <option>GSP</option>
          </SelectInput>
        </Field>
        <p className="cfg__note iform__wide">Applies when: {whenText(rule)}.</p>
      </div>
    </Sheet>
  );
}
