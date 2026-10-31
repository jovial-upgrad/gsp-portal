import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { COUNTRIES } from '../../data/partners';
import { PageHead } from '../../institution/records/parts';
import { STAGES, type DocRule, type RpDocRule } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History, Panel } from './parts';

const LEVELS = ['Any study level', 'Foundation', 'Diploma', 'Undergraduate', 'Postgraduate', 'Doctorate'];
const UNI_COUNTRIES = ['Any country', 'Australia', 'UK', 'Canada', 'USA', 'New Zealand', 'Ireland', 'Malaysia'];
const WHERE = ['Anywhere', 'Already in the destination', 'Outside the destination'];

/**
 * Document configuration (PM: Settings › Document rules and Agency documents). **Application documents**: one table
 * decides what an application asks for, at which stage, when, mandatory or optional, and who uploads it; nobody sets
 * documents on a course. **Recruitment partner documents**: what a partner sends to be verified, by its country.
 */
export function Documents({ cfg, change, say }: ConfigProps) {
  const [adding, setAdding] = useState(false);
  const set = (r: DocRule, patch: Partial<DocRule>, what: string) => {
    change('Document configuration', `${r.doc}: ${what}`, (c) => ({ ...c, docRules: c.docRules.map((x) => (x.id === r.id ? { ...x, ...patch } : x)) }));
    say('Saved. Applies to stages an open application hasn’t reached yet.');
  };
  return (
    <>
      <PageHead title="Document configuration" lead="Which documents an application asks for, and which a recruitment partner sends to be verified. Every change is logged." />
      <Panel
        title="Application documents"
        note="One table decides which documents an application asks for; nobody sets documents on a course. The RP only sees what’s needed for the current stage. Changes apply to stages an open application hasn’t reached yet."
        action={
          <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setAdding(true)}>
            Add rule
          </Button>
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
                <th scope="col">
                  <span className="vh">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.docRules.map((r, i) => (
                <tr key={r.id} className={r.on ? '' : 'is-off'}>
                  <td className="cfg__muted num">{i + 1}</td>
                  <td className="cfg__strong">{r.doc}</td>
                  <td>
                    <SelectInput id={`dr-st-${r.id}`} aria-label={`${r.doc}: stage`} value={r.stage} onChange={(e) => set(r, { stage: e.target.value as DocRule['stage'] }, `stage → ${e.target.value}`)}>
                      {STAGES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </SelectInput>
                  </td>
                  <td className="cfg__muted">{r.when}</td>
                  <td>
                    <SelectInput id={`dr-se-${r.id}`} aria-label={`${r.doc}: setting`} value={r.setting} onChange={(e) => set(r, { setting: e.target.value as DocRule['setting'] }, e.target.value)}>
                      <option>Mandatory</option>
                      <option>Optional</option>
                    </SelectInput>
                  </td>
                  <td>
                    <SelectInput id={`dr-by-${r.id}`} aria-label={`${r.doc}: uploaded by`} value={r.by} onChange={(e) => set(r, { by: e.target.value as DocRule['by'] }, `uploaded by ${e.target.value}`)}>
                      <option>RP</option>
                      <option>GSP</option>
                    </SelectInput>
                  </td>
                  <td>
                    <Switch id={`dr-on-${r.id}`} checked={r.on} onChange={(v) => set(r, { on: v }, v ? 'switched on' : 'switched off')}>
                      <span className="vh">{r.doc}</span>
                    </Switch>
                  </td>
                  <td className="cfg__acts">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete the ${r.doc} rule`}
                      onClick={() => {
                        change('Document configuration', `Deleted the ${r.doc} rule`, (c) => ({ ...c, docRules: c.docRules.filter((x) => x.id !== r.id) }));
                        say(`${r.doc} rule deleted.`);
                      }}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <RpDocs {...{ cfg, change, say }} />
      <History log={cfg.log} area="Document configuration" />
      <AddRule
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(r) => {
          change('Document configuration', `Added a rule: ${r.doc}, ${r.stage}, ${r.setting.toLowerCase()}, uploaded by ${r.by}`, (c) => ({ ...c, docRules: [...c.docRules, r] }));
          say(`${r.doc} added. Applies to stages an open application hasn’t reached yet.`);
          setAdding(false);
        }}
      />
    </>
  );
}

/** What a recruitment partner sends to be verified: every rule matching its country applies, and their documents add up. */
function RpDocs({ cfg, change, say }: Pick<ConfigProps, 'cfg' | 'change' | 'say'>) {
  const [doc, setDoc] = useState<Record<string, string>>({});
  const upd = (r: RpDocRule, patch: Partial<RpDocRule>, what: string) => {
    change('Document configuration', `Recruitment partner documents, rule ${cfg.rpDocs.indexOf(r) + 1}: ${what}`, (c) => ({ ...c, rpDocs: c.rpDocs.map((x) => (x.id === r.id ? { ...x, ...patch } : x)) }));
    say('Saved and logged.');
  };
  return (
    <Panel
      title="Recruitment partner documents"
      note="Every rule that matches the partner’s country applies, and their documents add up (each document is asked for once). All are mandatory."
      action={
        <Button
          variant="secondary"
          iconLeft={<Icon name="plus" size={16} />}
          onClick={() => {
            change('Document configuration', 'Recruitment partner documents: added a rule', (c) => ({ ...c, rpDocs: [...c.rpDocs, { id: `r${Date.now()}`, applies: 'Only these countries', countries: [], docs: [] }] }));
            say('Rule added. Pick its countries and documents.');
          }}
        >
          Add rule
        </Button>
      }
    >
      <div className="cfg__rprules">
        {cfg.rpDocs.map((r, i) => (
          <div key={r.id} className="cfg__rprule">
            <div className="cfg__rphead">
              <p className="cfg__strong">Rule {i + 1}</p>
              <SelectInput id={`rpa-${r.id}`} aria-label={`Rule ${i + 1}: applies to`} value={r.applies} onChange={(e) => upd(r, { applies: e.target.value as RpDocRule['applies'] }, `applies to → ${e.target.value}`)}>
                <option>Only these countries</option>
                <option>All countries except</option>
                <option>All countries</option>
              </SelectInput>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete rule ${i + 1}`}
                onClick={() => {
                  change('Document configuration', `Recruitment partner documents: deleted rule ${i + 1}`, (c) => ({ ...c, rpDocs: c.rpDocs.filter((x) => x.id !== r.id) }));
                  say(`Rule ${i + 1} deleted.`);
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            {r.applies !== 'All countries' && (
              <div className="cfg__chips">
                {r.countries.map((c) => (
                  <span key={c} className="cfg__chip">
                    {c}
                    <button type="button" aria-label={`Remove ${c}`} onClick={() => upd(r, { countries: r.countries.filter((x) => x !== c) }, `removed ${c}`)}>
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}
                <SelectInput id={`rpc-${r.id}`} aria-label={`Rule ${i + 1}: add a country`} className="cfg__mini" value="" placeholder="Add country" onChange={(e) => e.target.value && upd(r, { countries: [...r.countries, e.target.value] }, `added ${e.target.value}`)}>
                  {COUNTRIES.filter((c) => !r.countries.includes(c.name)).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
            <ul className="cfg__doclist">
              {r.docs.map((dname) => (
                <li key={dname}>
                  <Icon name="file" size={16} />
                  <span>{dname}</span>
                  <button type="button" className="icon-btn" aria-label={`Remove ${dname}`} onClick={() => upd(r, { docs: r.docs.filter((x) => x !== dname) }, `removed ${dname}`)}>
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="cfg__add">
              <TextInput id={`rpd-${r.id}`} aria-label={`Rule ${i + 1}: add a document`} placeholder="Add a document" value={doc[r.id] ?? ''} onChange={(e) => setDoc((x) => ({ ...x, [r.id]: e.target.value }))} />
              <Button
                variant="secondary"
                size="sm"
                disabled={!doc[r.id]?.trim()}
                onClick={() => {
                  upd(r, { docs: [...r.docs, doc[r.id].trim()] }, `added ${doc[r.id].trim()}`);
                  setDoc((x) => ({ ...x, [r.id]: '' }));
                }}
              >
                Add
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** A new application document rule: the document, its stage, when it applies, mandatory or optional, and who uploads it. */
function AddRule({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (r: DocRule) => void }) {
  const [v, setV] = useState({ doc: '', stage: 'New' as DocRule['stage'], level: LEVELS[0], uni: UNI_COUNTRIES[0], where: WHERE[0], setting: 'Mandatory' as DocRule['setting'], by: 'RP' as DocRule['by'] });
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV({ doc: '', stage: 'New', level: LEVELS[0], uni: UNI_COUNTRIES[0], where: WHERE[0], setting: 'Mandatory', by: 'RP' });
    setTried(false);
  }, [open]);
  const err = !v.doc.trim() ? 'Name the document.' : null;
  const when = [v.level !== LEVELS[0] && v.level, v.uni !== UNI_COUNTRIES[0] && `University in ${v.uni}`, v.where !== WHERE[0] && v.where.toLowerCase()].filter(Boolean).join(', ') || 'Always';
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title="Add a document rule"
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!err) onSave({ id: `d${Date.now()}`, doc: v.doc.trim(), stage: v.stage, when, setting: v.setting, by: v.by, on: true });
              }}
            >
              Add rule
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
        <Field id="ar-level" label="Study level">
          <SelectInput id="ar-level" value={v.level} onChange={(e) => setV((x) => ({ ...x, level: e.target.value }))}>
            {LEVELS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ar-uni" label="University country">
          <SelectInput id="ar-uni" value={v.uni} onChange={(e) => setV((x) => ({ ...x, uni: e.target.value }))}>
            {UNI_COUNTRIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ar-where" label="Where the student is now">
          <SelectInput id="ar-where" value={v.where} onChange={(e) => setV((x) => ({ ...x, where: e.target.value }))}>
            {WHERE.map((s) => (
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
        <p className="cfg__note iform__wide">Applies when: {when}.</p>
      </div>
    </Sheet>
  );
}
