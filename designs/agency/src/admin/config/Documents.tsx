import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Field, Switch, TextInput } from '../../components/forms';
import { useCheck } from '../../components/validate';
import { COUNTRIES } from '../../data/partners';
import { PageHead } from '../../institution/records/parts';
import { MultiPick } from '../../institution/records/MultiPick';
import { DOC_LEVELS, DOC_WHERE, STAGES, editCond, rpDocsOf, whenText, type DocCond, type DocRule, type RpDoc, type RpDocRule } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';
import { Empty, Loaded, Pick, SaveBanner, ViewOnlyNote, trySave, type SaveResult } from './states';

type Draft = { docRules: DocRule[]; rpDocs: RpDocRule[] };

/**
 * Document configuration (PRD slice 1; Admin › Application configuration). **Application documents**: one table
 * decides which documents an application asks for (nobody sets documents per course): the 10 rules, all asked at
 * New and uploaded by the RP. GSP's own uploads on a status change (the offer letters, one Acceptance letter for
 * every destination, the visa grant) are slice 3's. A rule an application has asked for can only be switched off
 * (proposal S1C-12). **Recruitment partner documents**: what a new RP uploads to be verified, by its head-office
 * country. Read only until Edit; changes apply only to applications that haven't reached that stage yet.
 */
export function Documents({ cfg, change, say, canEdit }: ConfigProps) {
  const d = useDraft<Draft>({ docRules: cfg.docRules, rpDocs: cfg.rpDocs.map((r) => ({ ...r, docs: rpDocsOf(r) })) }, 'the document rules');
  const [rule, setRule] = useState<DocRule | 'new' | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [rpTried, setRpTried] = useState(false);
  const ed = d.editing;
  const v = d.value;
  const setRow = (id: string, patch: Partial<DocRule>) => d.set((x) => ({ ...x, docRules: x.docRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const rpErrors = rpRuleErrors(v.rpDocs);
  const save = () => {
    if (Object.values(rpErrors).some(Boolean)) return setRpTried(true);
    const res = trySave();
    if (res !== 'ok') return setResult(res);
    const diffs: string[] = [];
    for (const r of v.docRules) {
      const was = cfg.docRules.find((x) => x.id === r.id);
      if (!was) diffs.push(`added ${r.doc} (${r.stage}, ${r.setting}, ${r.by})`);
      else if (JSON.stringify(was) !== JSON.stringify(r)) diffs.push(`${r.doc}: ${[was.on !== r.on && `${was.on ? 'On' : 'Off'} → ${r.on ? 'On' : 'Off'}`, was.setting !== r.setting && `${was.setting} → ${r.setting}`, was.stage !== r.stage && `${was.stage} → ${r.stage}`, was.when !== r.when && `applies when ${was.when} → ${r.when}`, was.by !== r.by && `uploaded by ${was.by} → ${r.by}`, was.doc !== r.doc && `named ${was.doc}`].filter(Boolean).join(', ')}`);
    }
    cfg.docRules.filter((x) => !v.docRules.some((r) => r.id === x.id)).forEach((x) => diffs.push(`deleted ${x.doc}`));
    if (JSON.stringify(v.rpDocs) !== JSON.stringify(cfg.rpDocs)) diffs.push('recruitment partner documents');
    change('Document configuration', diffs.join('; ') || 'No changes', (c) => ({ ...c, ...v }));
    say('Saved.');
    setResult(null);
    setRpTried(false);
    d.stop();
  };
  return (
    <>
      <PageHead title="Document configuration" lead="Which documents an application asks for, and which a new recruitment partner sends to be verified. Changes apply only to applications that haven’t reached that stage yet.">
        {canEdit && <EditBar name="document rules" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (setResult(null), setRpTried(false), d.stop())} onSave={save} />}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      {ed && <SaveBanner result={result} onReload={d.stop} />}
      <Loaded page="document configuration" cols={7}>
        <Panel
          title="Application documents"
          note="One table decides which documents an application asks for; nobody sets documents per course. All Applies when parts empty (and Anywhere) means always. Documents GSP uploads when it moves an application to a status that needs them (the offer letters, the Acceptance letter for every destination, the visa grant) are set in the application’s status changes, not here."
          action={
            ed && (
              <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setRule('new')}>
                Add rule
              </Button>
            )
          }
          flush
        >
          {!v.docRules.length ? (
            <Empty>No document rules. Applications won’t ask for any documents.</Empty>
          ) : (
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
                    <th scope="col">On</th>
                    {ed && (
                      <th scope="col">
                        <span className="vh">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {v.docRules.map((r, i) => (
                    <tr key={r.id} className={r.on ? '' : 'is-off'}>
                      <td className="cfg__muted num">{i + 1}</td>
                      <td className="cfg__strong">{r.doc}</td>
                      <td>{r.stage}</td>
                      <td className="cfg__muted">{r.when}</td>
                      <td>{r.setting}</td>
                      <td>{r.by}</td>
                      <td>
                        {ed ? (
                          <Switch id={`dr-on-${r.id}`} checked={r.on} onChange={(on) => setRow(r.id, { on })}>
                            <span className="vh">{r.doc}</span>
                          </Switch>
                        ) : (
                          <span className="cfg__muted">{r.on ? 'On' : 'Off'}</span>
                        )}
                      </td>
                      {ed && (
                        <td className="cfg__acts">
                          <span className="cfg__rowacts">
                            <button type="button" className="icon-btn" aria-label={`Edit the ${r.doc} rule`} onClick={() => setRule(r)}>
                              <Icon name="edit" size={16} />
                            </button>
                            {/* a rule an application has asked for can only be switched off (proposal S1C-12) */}
                            {!r.asked && (
                              <button type="button" className="icon-btn" aria-label={`Delete the ${r.doc} rule`} onClick={() => d.set((x) => ({ ...x, docRules: x.docRules.filter((y) => y.id !== r.id) }))}>
                                <Icon name="close" size={16} />
                              </button>
                            )}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <RpDocs ed={ed} rules={v.rpDocs} errors={rpTried ? rpErrors : {}} set={(fn) => d.set((x) => ({ ...x, rpDocs: fn(x.rpDocs) }))} />
      </Loaded>
      <History log={cfg.log} area="Document configuration" />
      <RuleDialog
        open={!!rule}
        rule={rule === 'new' ? null : rule}
        rules={v.docRules}
        onClose={() => setRule(null)}
        onSave={(r) => {
          d.set((x) => ({ ...x, docRules: x.docRules.some((y) => y.id === r.id) ? x.docRules.map((y) => (y.id === r.id ? r : y)) : [...x.docRules, r] }));
          setRule(null);
        }}
      />
    </>
  );
}

/** Each recruitment partner rule's errors: countries (unless All countries; a country in one Only-these rule only), and at least one document. */
function rpRuleErrors(rules: RpDocRule[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  rules.forEach((r, i) => {
    const taken = rules.filter((x, j) => j !== i && x.applies === 'Only these countries').flatMap((x) => x.countries);
    const clash = r.applies === 'Only these countries' ? r.countries.find((c) => taken.includes(c)) : undefined;
    out[`c-${r.id}`] = r.applies !== 'All countries' && !r.countries.length ? 'Pick at least one country.' : clash ? `${clash} is already in another Only these countries rule.` : null;
    out[`d-${r.id}`] = !r.docs.length ? 'Add at least one document.' : r.docs.some((x) => x.name.trim().length < 2 || x.name.trim().length > 80) ? 'Each document’s name is 2 to 80 characters.' : null;
  });
  return out;
}

/**
 * Recruitment partner documents: what a new RP uploads to be verified, by its head-office country. Each rule has a
 * Type, its Countries and its Documents (each Mandatory or Optional). An RP gets the first rule that names its
 * country, else the All countries rule, which can't be deleted. Files: PDF, JPG or PNG up to 20 MB (slice 2).
 */
function RpDocs({ ed, rules, errors, set }: { ed: boolean; rules: RpDocRule[]; errors: Record<string, string | null>; set: (fn: (l: RpDocRule[]) => RpDocRule[]) => void }) {
  const [doc, setDoc] = useState<Record<string, string>>({});
  const upd = (id: string, patch: Partial<RpDocRule>) => set((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const updDoc = (id: string, i: number, patch: Partial<RpDoc>) => set((l) => l.map((x) => (x.id === id ? { ...x, docs: x.docs.map((y, j) => (j === i ? { ...y, ...patch } : y)) } : x)));
  return (
    <Panel
      title="Recruitment partner documents"
      note="What a new RP uploads to be verified, by its head-office country. An RP gets the first rule that names its country, else the All countries rule. Changes apply to RPs that haven’t sent their documents yet."
      action={
        ed && (
          <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => set((l) => [...l, { id: `r${Date.now()}`, applies: 'Only these countries', countries: [], docs: [] }])}>
            Add rule
          </Button>
        )
      }
    >
      <div className="cfg__rprules">
        {rules.map((r, i) => (
          <div key={r.id} className="cfg__rprule">
            <div className="cfg__rphead">
              <p className="cfg__strong">{r.name ?? `Rule ${i + 1}`}</p>
              {ed ? (
                <>
                  <Pick id={`rpa-${r.id}`} label={`${r.name ?? `Rule ${i + 1}`}: type`} value={r.applies} options={['Only these countries', 'All countries except', 'All countries']} onChange={(x) => upd(r.id, { applies: x as RpDocRule['applies'] })} />
                  {r.applies !== 'All countries' && (
                    <button type="button" className="icon-btn" aria-label={`Delete ${r.name ?? `rule ${i + 1}`}`} onClick={() => set((l) => l.filter((x) => x.id !== r.id))}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </>
              ) : (
                <span className="cfg__muted">{r.applies}</span>
              )}
            </div>
            {r.applies !== 'All countries' &&
              (ed ? (
                <Field id={`rpc-${r.id}`} label="Countries" required error={errors[`c-${r.id}`]}>
                  <MultiPick id={`rpc-${r.id}`} label="Countries" value={r.countries} options={COUNTRIES.map((c) => c.name)} invalid={!!errors[`c-${r.id}`]} empty="Pick countries" search onChange={(countries) => upd(r.id, { countries })} />
                </Field>
              ) : (
                <p className="cfg__muted">{r.countries.join(', ')}</p>
              ))}
            <ul className="cfg__doclist">
              {r.docs.map((x, j) => (
                <li key={`${x.name}-${j}`}>
                  <Icon name="file" size={16} />
                  <span>{x.name}</span>
                  {ed ? (
                    <>
                      <span className="cfg__segment" role="group" aria-label={`${x.name}: Mandatory or Optional`}>
                        {(['Mandatory', 'Optional'] as const).map((s) => (
                          <button key={s} type="button" aria-pressed={x.setting === s} onClick={() => updDoc(r.id, j, { setting: s })}>
                            {s}
                          </button>
                        ))}
                      </span>
                      <button type="button" className="icon-btn" aria-label={`Remove ${x.name}`} onClick={() => upd(r.id, { docs: r.docs.filter((_, k) => k !== j) })}>
                        <Icon name="close" size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="cfg__muted">{x.setting}</span>
                  )}
                </li>
              ))}
            </ul>
            {errors[`d-${r.id}`] && (
              <p className="field__msg field__msg--error" role="alert">
                {errors[`d-${r.id}`]}
              </p>
            )}
            {ed && (
              <div className="cfg__add">
                <TextInput id={`rpd-${r.id}`} aria-label={`${r.name ?? `Rule ${i + 1}`}: add a document`} placeholder="Add a document" maxLength={80} value={doc[r.id] ?? ''} onChange={(e) => setDoc((x) => ({ ...x, [r.id]: e.target.value }))} />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={(doc[r.id]?.trim().length ?? 0) < 2}
                  onClick={() => {
                    upd(r.id, { docs: [...r.docs, { name: doc[r.id].trim(), setting: 'Mandatory' }] });
                    setDoc((x) => ({ ...x, [r.id]: '' }));
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Add or edit an application document rule (PRD slice 1, Document configuration › Fields). */
function RuleDialog({ open, rule, rules, onClose, onSave }: { open: boolean; rule: DocRule | null; rules: DocRule[]; onClose: () => void; onSave: (r: DocRule) => void }) {
  const blankCond: DocCond = { levels: [], countries: [], where: 'Anywhere', other: '' };
  const blank = (): DocRule => ({ id: `d${Date.now()}`, doc: '', stage: '' as DocRule['stage'], when: 'Always', setting: 'Mandatory', by: 'RP', on: true, cond: blankCond });
  const [v, setV] = useState<DocRule>(blank);
  const [c, setC] = useState<DocCond>(blankCond);
  useEffect(() => {
    if (!open) return;
    const r = rule ?? blank();
    setV(r);
    setC(editCond(r));
    k.reset();
  }, [open, rule?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = v.doc.trim();
  const k = useCheck({
    doc: name.length < 2 || name.length > 80 ? 'Enter the document’s name.' : rules.some((r) => r.id !== v.id && r.doc.toLowerCase() === name.toLowerCase()) ? `There’s already a rule for ${name}.` : null,
    stage: !v.stage ? 'Pick the stage.' : null,
  });
  const when = whenText(c);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={rule ? `Edit the ${rule.doc} rule` : 'Add a document rule'}
      sub="Kept when you Save the page."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => k.submit() && onSave({ ...v, doc: name, when, cond: c })}>{rule ? 'Done' : 'Add rule'}</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="ar-doc" label="Document" required error={k.err('doc')} className="iform__wide">
          <TextInput id="ar-doc" value={v.doc} maxLength={80} invalid={!!k.err('doc')} placeholder="Like: Medical certificate" onBlur={k.blur('doc')} onChange={(e) => setV((x) => ({ ...x, doc: e.target.value }))} />
        </Field>
        <Field id="ar-stage" label="Stage" required error={k.err('stage')}>
          <Pick id="ar-stage" label="Stage" value={v.stage} placeholder="Pick the stage" options={[...STAGES]} invalid={!!k.err('stage')} onChange={(x) => (setV((y) => ({ ...y, stage: x as DocRule['stage'] })), k.blur('stage')())} />
        </Field>
        <Field id="ar-set" label="Setting" required>
          <Pick id="ar-set" label="Setting" value={v.setting} options={['Mandatory', 'Optional']} onChange={(x) => setV((y) => ({ ...y, setting: x as DocRule['setting'] }))} />
        </Field>
        <Field id="ar-by" label="Uploaded by" required>
          <Pick id="ar-by" label="Uploaded by" value={v.by} options={['RP', 'GSP']} onChange={(x) => setV((y) => ({ ...y, by: x as DocRule['by'] }))} />
        </Field>
        <p className="cfg__k iform__wide">Applies when</p>
        <Field id="ar-level" label="Program levels" optional hint="Empty means any level.">
          <MultiPick id="ar-level" label="Program levels" value={c.levels} options={DOC_LEVELS} empty="Any program level" onChange={(levels) => setC((x) => ({ ...x, levels }))} />
        </Field>
        <Field id="ar-uni" label="University countries" optional hint="Empty means any country.">
          <MultiPick id="ar-uni" label="University countries" value={c.countries} options={COUNTRIES.map((x) => x.name)} empty="Any country" search onChange={(countries) => setC((x) => ({ ...x, countries }))} />
        </Field>
        <Field id="ar-where" label="Where the student is" required>
          <Pick id="ar-where" label="Where the student is" value={c.where === 'Outside the destination' ? 'Outside it' : c.where} options={DOC_WHERE} onChange={(where) => setC((x) => ({ ...x, where }))} />
        </Field>
        <Field id="ar-other" label="Other condition" optional hint="Read by GSP people; the system doesn’t check it, except “The university has its own form”.">
          <TextInput id="ar-other" value={c.other} maxLength={120} placeholder="Like: The university has its own form" onChange={(e) => setC((x) => ({ ...x, other: e.target.value }))} />
        </Field>
        <p className="cfg__note iform__wide">Applies when: {when}.</p>
      </div>
    </Sheet>
  );
}
