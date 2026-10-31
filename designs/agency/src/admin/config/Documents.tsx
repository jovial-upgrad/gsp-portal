import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { COUNTRIES } from '../../data/partners';
import { PageHead } from '../../institution/records/parts';
import { MultiPick } from '../../institution/records/MultiPick';
import { DOC_COUNTRIES, DOC_LEVELS, DOC_WHERE, STAGES, condOf, whenText, type DocCond, type DocRule, type RpDocRule } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';

type Draft = { docRules: DocRule[]; rpDocs: RpDocRule[] };

/**
 * Document configuration (PM: Settings › Document rules and Agency documents). **Application documents**: one table
 * decides what an application asks for, at which stage, when, mandatory or optional, and who uploads it.
 * **Recruitment partner documents**: what a partner sends to be verified, by its country. Jovial, 31 Oct: the page
 * is read-only until Edit; every record can be edited, "Applies when" is set from conditions, and nothing is kept
 * until Save.
 */
export function Documents({ cfg, change, say }: ConfigProps) {
  const d = useDraft<Draft>({ docRules: cfg.docRules, rpDocs: cfg.rpDocs }, 'the document rules');
  const [rule, setRule] = useState<DocRule | 'new' | null>(null);
  const ed = d.editing;
  const v = d.value;
  const setRow = (id: string, patch: Partial<DocRule>) => d.set((x) => ({ ...x, docRules: x.docRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const save = () => {
    const n = v.docRules.filter((r) => JSON.stringify(r) !== JSON.stringify(cfg.docRules.find((x) => x.id === r.id))).length + Math.abs(v.docRules.length - cfg.docRules.length);
    const rp = JSON.stringify(v.rpDocs) !== JSON.stringify(cfg.rpDocs);
    change('Document configuration', `Saved ${n} application document rule${n === 1 ? '' : 's'}${rp ? ' and the recruitment partner documents' : ''}`, (c) => ({ ...c, ...v }));
    say('Document rules saved. They apply to stages an open application hasn’t reached yet.');
    d.stop();
  };
  return (
    <>
      <PageHead title="Document configuration" lead="Which documents an application asks for, and which a recruitment partner sends to be verified. Every change is logged.">
        <EditBar name="document rules" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={d.stop} onSave={save} />
      </PageHead>
      {ed && <p className="cfg__warnbox cfg__editing">You’re editing. Nothing is kept until you click Save.</p>}
      <Panel
        title="Application documents"
        note="One table decides which documents an application asks for; nobody sets documents on a course. The RP only sees what’s needed for the current stage. Changes apply to stages an open application hasn’t reached yet."
        action={
          ed && (
            <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setRule('new')}>
              Add rule
            </Button>
          )
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
                        <button type="button" className="icon-btn" aria-label={`Delete the ${r.doc} rule`} onClick={() => d.set((x) => ({ ...x, docRules: x.docRules.filter((y) => y.id !== r.id) }))}>
                          <Icon name="close" size={16} />
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <RpDocs ed={ed} rules={v.rpDocs} set={(fn) => d.set((x) => ({ ...x, rpDocs: fn(x.rpDocs) }))} />
      <History log={cfg.log} area="Document configuration" />
      <RuleDialog
        open={!!rule}
        rule={rule === 'new' ? null : rule}
        onClose={() => setRule(null)}
        onSave={(r) => {
          d.set((x) => ({ ...x, docRules: x.docRules.some((y) => y.id === r.id) ? x.docRules.map((y) => (y.id === r.id ? r : y)) : [...x.docRules, r] }));
          setRule(null);
        }}
      />
    </>
  );
}

/** What a recruitment partner sends to be verified: every rule matching its country applies, and their documents add up. */
function RpDocs({ ed, rules, set }: { ed: boolean; rules: RpDocRule[]; set: (fn: (l: RpDocRule[]) => RpDocRule[]) => void }) {
  const [doc, setDoc] = useState<Record<string, string>>({});
  const upd = (id: string, patch: Partial<RpDocRule>) => set((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <Panel
      title="Recruitment partner documents"
      note="Every rule that matches the partner’s country applies, and their documents add up (each document is asked for once). All are mandatory."
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
              <p className="cfg__strong">Rule {i + 1}</p>
              {ed ? (
                <>
                  <SelectInput id={`rpa-${r.id}`} aria-label={`Rule ${i + 1}: applies to`} value={r.applies} onChange={(e) => upd(r.id, { applies: e.target.value as RpDocRule['applies'] })}>
                    <option>Only these countries</option>
                    <option>All countries except</option>
                    <option>All countries</option>
                  </SelectInput>
                  <button type="button" className="icon-btn" aria-label={`Delete rule ${i + 1}`} onClick={() => set((l) => l.filter((x) => x.id !== r.id))}>
                    <Icon name="close" size={16} />
                  </button>
                </>
              ) : (
                <span className="cfg__muted">{r.applies}</span>
              )}
            </div>
            {r.applies !== 'All countries' &&
              (ed ? (
                <MultiPick id={`rpc-${r.id}`} label={`Rule ${i + 1}: countries`} value={r.countries} options={COUNTRIES.map((c) => c.name)} empty="Choose countries" search onChange={(countries) => upd(r.id, { countries })} />
              ) : (
                <p className="cfg__muted">{r.countries.join(', ') || 'No countries yet'}</p>
              ))}
            <ul className="cfg__doclist">
              {r.docs.map((dname) => (
                <li key={dname}>
                  <Icon name="file" size={16} />
                  <span>{dname}</span>
                  {ed && (
                    <button type="button" className="icon-btn" aria-label={`Remove ${dname}`} onClick={() => upd(r.id, { docs: r.docs.filter((x) => x !== dname) })}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {ed && (
              <div className="cfg__add">
                <TextInput id={`rpd-${r.id}`} aria-label={`Rule ${i + 1}: add a document`} placeholder="Add a document" value={doc[r.id] ?? ''} onChange={(e) => setDoc((x) => ({ ...x, [r.id]: e.target.value }))} />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!doc[r.id]?.trim()}
                  onClick={() => {
                    upd(r.id, { docs: [...r.docs, doc[r.id].trim()] });
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

/** Add or edit an application document rule: the document, its stage, when it applies, mandatory or optional, who uploads it. */
function RuleDialog({ open, rule, onClose, onSave }: { open: boolean; rule: DocRule | null; onClose: () => void; onSave: (r: DocRule) => void }) {
  const blank = (): DocRule => ({ id: `d${Date.now()}`, doc: '', stage: 'New', when: 'Always', setting: 'Mandatory', by: 'RP', on: true, cond: { levels: [], countries: [], where: 'Anywhere', other: '' } });
  const [v, setV] = useState<DocRule>(blank);
  const [c, setC] = useState<DocCond>({ levels: [], countries: [], where: 'Anywhere', other: '' });
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    const r = rule ?? blank();
    setV(r);
    setC(condOf(r));
    setTried(false);
  }, [open, rule?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = !v.doc.trim() ? 'Name the document.' : null;
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
            <Button
              onClick={() => {
                setTried(true);
                if (!err) onSave({ ...v, doc: v.doc.trim(), when, cond: c });
              }}
            >
              {rule ? 'Done' : 'Add rule'}
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
        <p className="cfg__k iform__wide">Applies when</p>
        <Field id="ar-level" label="Study level">
          <MultiPick id="ar-level" label="Study level" value={c.levels} options={DOC_LEVELS} empty="Any study level" onChange={(levels) => setC((x) => ({ ...x, levels }))} />
        </Field>
        <Field id="ar-uni" label="University country">
          <MultiPick id="ar-uni" label="University country" value={c.countries} options={DOC_COUNTRIES} empty="Any country" onChange={(countries) => setC((x) => ({ ...x, countries }))} />
        </Field>
        <Field id="ar-where" label="Where the student is now">
          <SelectInput id="ar-where" value={c.where} onChange={(e) => setC((x) => ({ ...x, where: e.target.value }))}>
            {DOC_WHERE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ar-other" label="Anything else" optional>
          <TextInput id="ar-other" value={c.other} placeholder="Like: The university has its own form" onChange={(e) => setC((x) => ({ ...x, other: e.target.value }))} />
        </Field>
        <p className="cfg__note iform__wide">Applies when: {when}.</p>
      </div>
    </Sheet>
  );
}
