import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { PageHead } from '../../institution/records/parts';
import { MultiPick } from '../../institution/records/MultiPick';
import { Sheet } from '../../components/Sheet';
import { DESTINATIONS, NATIONALITY, ROUTING_RPS, route, type Region, type RouteRule } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';

const EXAMPLES: [string, { rp: string; nationality: string; now: string; dest: string }][] = [
  ['Indian student, Indian RP', { rp: 'BrightPath Overseas', nationality: 'India', now: 'India', dest: 'Australia' }],
  ['Indian student, Nepali RP', { rp: 'Kathmandu Study Hub', nationality: 'India', now: 'India', dest: 'United Kingdom' }],
  ['Onshore, Vietnamese RP', { rp: 'Saigon Study Link', nationality: 'Vietnam', now: 'Australia', dest: 'Australia' }],
  ['Onshore, Indian RP', { rp: 'BrightPath Overseas', nationality: 'India', now: 'Australia', dest: 'Australia' }],
  ['Direct, Nigerian student', { rp: '', nationality: 'Nigeria', now: 'Nigeria', dest: 'Canada' }],
  ['Unmapped nationality', { rp: 'Horizon Overseas', nationality: 'United Arab Emirates', now: 'United Arab Emirates', dest: 'Australia' }],
];

type Draft = { rules: RouteRule[]; lists: Record<string, string[]>; regionBdm: Record<string, string>; regionQueue: Record<string, string>; regions: Region[] };

/**
 * Application routing (PM: Settings › Application routing): when an application is submitted it gets its region
 * (which Admissions queue works it), its BDM, its source region and the rule that set them. The rules run from the
 * top and the first that matches wins. Jovial, 31 Oct: nothing changes until Edit is clicked, and nothing is kept
 * until Save; regional lists can be added and take several RPs at once; region defaults pick the BDM and the
 * Admissions queue from lists, and new sales regions can be added here. Test any case; the test is never saved.
 */
export function Routing({ cfg, change, say }: ConfigProps) {
  const [t, setT] = useState(EXAMPLES[1][1]);
  const [addTo, setAddTo] = useState<Record<string, string[]>>({});
  const [newList, setNewList] = useState('');
  const [newRegion, setNewRegion] = useState(false);
  const saved: Draft = { rules: cfg.rules, lists: cfg.lists, regionBdm: cfg.regionBdm, regionQueue: cfg.regionQueue, regions: cfg.regions };
  const d = useDraft(saved);
  const v = d.value;
  const ed = d.editing;
  const r = route(v.rules, v.lists, t, v.regionBdm);
  const keepAt = v.rules.findIndex((x) => x.id === 'keep');
  const onAt = v.rules.findIndex((x) => x.id === 'onshore');
  const move = (i: number, dir: -1 | 1) =>
    d.set((x) => {
      const rules = [...x.rules];
      [rules[i], rules[i + dir]] = [rules[i + dir], rules[i]];
      return { ...x, rules };
    });
  const onList = new Set(Object.values(v.lists).flat());
  const bdms = cfg.users.filter((u) => u.role === 'Recruitment' && u.status !== 'Deactivated').map((u) => u.name);
  const admissionsQueues = cfg.queues.filter((q) => /Admissions$/.test(q.name));
  const queueName = (id: string) => cfg.queues.find((q) => q.id === id)?.name ?? '';
  const defaultRegions = Object.keys(v.regionBdm);
  const save = () => {
    const what: string[] = [];
    if (JSON.stringify(v.rules) !== JSON.stringify(cfg.rules)) what.push('rules');
    if (JSON.stringify(v.lists) !== JSON.stringify(cfg.lists)) what.push('regional RP lists');
    if (JSON.stringify(v.regionBdm) !== JSON.stringify(cfg.regionBdm) || JSON.stringify(v.regionQueue) !== JSON.stringify(cfg.regionQueue)) what.push('region defaults');
    if (v.regions.length !== cfg.regions.length) what.push(`new sales region ${v.regions.filter((x) => !cfg.regions.some((y) => y.name === x.name)).map((x) => x.name).join(', ')}`);
    change('Application routing', `Saved ${what.join(', ') || 'no changes'}`, (c) => ({ ...c, ...v }));
    say('Saved. Applies to applications submitted from now. Submitted applications keep their values.');
    d.stop();
  };
  return (
    <>
      <PageHead
        title="Application routing"
        lead="When an application is submitted it gets four values: its region (which Admissions queue works it and where it is reported), its BDM, its source region (the RP’s region) and the rule that set them. The rules run from the top; the first one that matches wins. A change applies to applications submitted after it; submitted applications never change."
      >
        <EditBar editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={d.stop} onSave={save} />
      </PageHead>
      {ed && <p className="cfg__warnbox cfg__editing">You’re editing. Nothing is kept until you click Save.</p>}
      <div className="cfg__routing">
        <Panel title="Rules, in order">
          <ol className="cfg__rules">
            {v.rules.map((x, i) => {
              const last = x.id === 'fb';
              return (
                <li key={x.id} className={`cfg__rule ${x.on || last ? '' : 'is-off'}`}>
                  <span className="cfg__rulen num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="cfg__rulet">
                    <p className="cfg__strong">
                      {x.title} {!x.on && !last && <span className="cfg__tag">Off</span>}
                    </p>
                    <p className="cfg__sub">When: {x.when}</p>
                    <p className="cfg__rulesets">
                      <span className="cfg__tag cfg__tag--soft">Region: {x.region}</span>
                      <span className="cfg__tag cfg__tag--soft">BDM: {x.bdm}</span>
                    </p>
                  </div>
                  <div className="cfg__ruleacts">
                    {last ? (
                      <span className="cfg__muted">Always last</span>
                    ) : ed ? (
                      <>
                        <Switch id={`rt-on-${x.id}`} checked={x.on} onChange={(on) => d.set((y) => ({ ...y, rules: y.rules.map((z) => (z.id === x.id ? { ...z, on } : z)) }))}>
                          <span className="vh">{x.title}: </span>On
                        </Switch>
                        <button type="button" className="icon-btn" aria-label={`Move “${x.title}” up`} disabled={i === 0} onClick={() => move(i, -1)}>
                          <Icon name="chevronDown" size={16} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <button type="button" className="icon-btn" aria-label={`Move “${x.title}” down`} disabled={v.rules[i + 1]?.id === 'fb'} onClick={() => move(i, 1)}>
                          <Icon name="chevronDown" size={16} />
                        </button>
                      </>
                    ) : (
                      <span className="cfg__muted">{x.on ? 'On' : 'Off'}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {keepAt > onAt && (
            <p className="cfg__warnbox">
              <Icon name="alert" size={16} /> Rule {keepAt + 1} never applies: rule {onAt + 1} above it catches every onshore application first. Move it up.
            </p>
          )}
        </Panel>
        <Panel title="Test a routing" note="Try any case before you change a rule. Nothing is saved.">
          <div className="cfg__examples" role="group" aria-label="Examples">
            {EXAMPLES.map(([l, v]) => (
              <button key={l} type="button" className="ichip" aria-pressed={JSON.stringify(v) === JSON.stringify(t)} onClick={() => setT(v)}>
                {l}
              </button>
            ))}
          </div>
          <div className="cfg__testgrid">
            <Field id="rt-rp" label="RP">
              <SelectInput id="rt-rp" value={t.rp} onChange={(e) => setT((x) => ({ ...x, rp: e.target.value }))}>
                <option value="">No RP (direct application)</option>
                {ROUTING_RPS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.region})
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="rt-nat" label="Student nationality">
              <SelectInput id="rt-nat" value={t.nationality} onChange={(e) => setT((x) => ({ ...x, nationality: e.target.value }))}>
                {Object.keys(NATIONALITY).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SelectInput>
            </Field>
            <Field id="rt-now" label="Student current country">
              <SelectInput id="rt-now" value={t.now} onChange={(e) => setT((x) => ({ ...x, now: e.target.value }))}>
                {[...new Set(['Australia', ...Object.keys(NATIONALITY)])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SelectInput>
            </Field>
            <Field id="rt-dest" label="Destination">
              <SelectInput id="rt-dest" value={t.dest} onChange={(e) => setT((x) => ({ ...x, dest: e.target.value }))}>
                {DESTINATIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          {r.hit && (
            <div className="cfg__result" role="status">
              <p className="cfg__resultbig">
                Goes to {r.hit.region} · BDM {r.hit.bdm}
              </p>
              <dl className="cfg__resultfacts">
                <div>
                  <dt>Application region</dt>
                  <dd>{r.hit.region}</dd>
                </div>
                <div>
                  <dt>Application BDM</dt>
                  <dd>{r.hit.bdm}</dd>
                </div>
                <div>
                  <dt>Source region</dt>
                  <dd>{r.source}</dd>
                </div>
                <div>
                  <dt>Rule applied</dt>
                  <dd>
                    {r.hit.n}. {r.hit.rule.title}
                  </dd>
                </div>
                <div>
                  <dt>Admissions queue</dt>
                  <dd>{queueName(v.regionQueue[r.hit.region]) || `${r.hit.region} Admissions`}</dd>
                </div>
              </dl>
              <p className="cfg__k">How it got there</p>
              <ol className="cfg__trace">
                {r.trace.map((s) => (
                  <li key={s.r.id} className={`is-${s.state.toLowerCase()}`}>
                    <span className="cfg__tstate">{s.state === 'Match' ? '✓ Match' : s.state === 'No' ? '– No' : s.state}</span>
                    <span>
                      {s.r.title}: {s.why}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Regional RP lists"
        note="Every application from an RP on a list goes to the list’s region, whatever the student’s nationality. An RP can be on one list only."
        action={
          ed && (
            <span className="cfg__add">
              <SelectInput id="rl-new" aria-label="Region for a new list" value={newList} placeholder="Add a region" allowEmpty onChange={(e) => setNewList(e.target.value)}>
                {v.regions.filter((x) => x.name !== 'Global' && !(x.name in v.lists)).map((x) => (
                  <option key={x.name}>{x.name}</option>
                ))}
              </SelectInput>
              <Button variant="secondary" size="sm" disabled={!newList} onClick={() => { d.set((x) => ({ ...x, lists: { ...x.lists, [newList]: [] } })); setNewList(''); }}>
                Add region
              </Button>
            </span>
          )
        }
        flush
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col">RPs on the list</th>
                {ed && <th scope="col">Add RPs</th>}
              </tr>
            </thead>
            <tbody>
              {Object.entries(v.lists).map(([reg, rps]) => (
                <tr key={reg}>
                  <td className="cfg__strong">
                    {reg}
                    {ed && (
                      <Button variant="link" size="sm" onClick={() => d.set((x) => { const lists = { ...x.lists }; delete lists[reg]; return { ...x, lists }; })}>
                        Remove list
                      </Button>
                    )}
                  </td>
                  <td>
                    <div className="cfg__chips">
                      {rps.map((p) => (
                        <span key={p} className="cfg__chip">
                          {p}
                          {ed && (
                            <button type="button" aria-label={`Take ${p} off the ${reg} list`} onClick={() => d.set((x) => ({ ...x, lists: { ...x.lists, [reg]: x.lists[reg].filter((y) => y !== p) } }))}>
                              <Icon name="close" size={12} />
                            </button>
                          )}
                        </span>
                      ))}
                      {!rps.length && <span className="cfg__muted">None yet</span>}
                    </div>
                  </td>
                  {ed && (
                    <td>
                      <div className="cfg__add">
                        <MultiPick id={`rl-${reg}`} label={`RPs to add to the ${reg} list`} value={addTo[reg] ?? []} options={ROUTING_RPS.filter((p) => !onList.has(p.name)).map((p) => p.name)} empty="Choose RPs" search onChange={(l) => setAddTo((x) => ({ ...x, [reg]: l }))} />
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!addTo[reg]?.length}
                          onClick={() => {
                            const add = addTo[reg];
                            d.set((x) => ({ ...x, lists: { ...x.lists, [reg]: [...x.lists[reg], ...add] } }));
                            setAddTo((x) => ({ ...x, [reg]: [] }));
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!Object.keys(v.lists).length && <p className="cfg__note cfg__empty">No regional lists.</p>}
        </div>
      </Panel>

      <Panel
        title="Region defaults"
        note="The BDM an application gets when a rule says “that region’s default BDM”, and the Admissions queue that works the region’s applications."
        action={
          ed && (
            <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => setNewRegion(true)}>
              Add sales region
            </Button>
          )
        }
        flush
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col">Default application BDM</th>
                <th scope="col">Admissions queue</th>
              </tr>
            </thead>
            <tbody>
              {defaultRegions.map((reg) => (
                <tr key={reg}>
                  <td className="cfg__strong">{reg}</td>
                  <td>
                    {ed ? (
                      <SelectInput id={`rd-${reg}`} aria-label={`${reg}: default application BDM`} value={v.regionBdm[reg] ?? ''} placeholder="Choose a BDM" allowEmpty onChange={(e) => d.set((x) => ({ ...x, regionBdm: { ...x.regionBdm, [reg]: e.target.value } }))}>
                        {[...new Set([...bdms, v.regionBdm[reg]].filter(Boolean))].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </SelectInput>
                    ) : (
                      v.regionBdm[reg] || <span className="cfg__muted">Not set</span>
                    )}
                    {!v.regionBdm[reg] && <span className="cfg__warn">Applications that need a region default here will have no BDM</span>}
                  </td>
                  <td>
                    {ed ? (
                      <SelectInput id={`rq-${reg}`} aria-label={`${reg}: Admissions queue`} value={v.regionQueue[reg] ?? ''} placeholder="Choose a queue" allowEmpty onChange={(e) => d.set((x) => ({ ...x, regionQueue: { ...x.regionQueue, [reg]: e.target.value } }))}>
                        {admissionsQueues.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.name}
                          </option>
                        ))}
                      </SelectInput>
                    ) : (
                      queueName(v.regionQueue[reg]) || <span className="cfg__muted">Not set</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <NewRegionDialog
        open={newRegion}
        taken={v.regions.map((x) => x.name)}
        admissions={cfg.users.filter((u) => (u.role === 'Admission' || u.role === 'Admission Ops') && u.status !== 'Deactivated').map((u) => u.name)}
        bdms={bdms}
        queues={admissionsQueues}
        onClose={() => setNewRegion(false)}
        onAdd={(x) => {
          d.set((y) => ({ ...y, regions: [...y.regions.filter((z) => z.name !== 'Global'), { name: x.name, contact: x.contact }, ...y.regions.filter((z) => z.name === 'Global')], regionBdm: { ...y.regionBdm, [x.name]: x.bdm }, regionQueue: { ...y.regionQueue, [x.name]: x.queue } }));
          setNewRegion(false);
        }}
      />
      <History log={cfg.log} area="Application routing" />
    </>
  );
}

/** A new sales region, from Region defaults: its name, its Admissions contact, default BDM and Admissions queue. */
function NewRegionDialog({ open, taken, admissions, bdms, queues, onClose, onAdd }: { open: boolean; taken: string[]; admissions: string[]; bdms: string[]; queues: { id: string; name: string }[]; onClose: () => void; onAdd: (x: { name: string; contact: string; bdm: string; queue: string }) => void }) {
  const [x, setX] = useState({ name: '', contact: '', bdm: '', queue: '' });
  const [tried, setTried] = useState(false);
  const err = {
    name: !x.name.trim() ? 'Name the region.' : taken.some((t) => t.toLowerCase() === x.name.trim().toLowerCase()) ? 'There’s already a region with this name.' : null,
    contact: !x.contact ? 'Choose its Admissions contact.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const close = () => { setX({ name: '', contact: '', bdm: '', queue: '' }); setTried(false); onClose(); };
  return (
    <Sheet
      open={open}
      onClose={close}
      center
      className="iform cfg__sheet"
      title="Add sales region"
      sub="It’s added to Sales regions too, when you save this page."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (err.name || err.contact) return;
                onAdd({ ...x, name: x.name.trim() });
                setX({ name: '', contact: '', bdm: '', queue: '' });
                setTried(false);
              }}
            >
              Add region
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="nr-name" label="Region name" required error={show('name')}>
          <TextInput id="nr-name" value={x.name} invalid={!!show('name')} onChange={(e) => setX({ ...x, name: e.target.value })} />
        </Field>
        <Field id="nr-contact" label="Admissions contact" required error={show('contact')}>
          <SelectInput id="nr-contact" value={x.contact} placeholder="Choose" invalid={!!show('contact')} onChange={(e) => setX({ ...x, contact: e.target.value })}>
            {admissions.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="nr-bdm" label="Default application BDM" optional>
          <SelectInput id="nr-bdm" value={x.bdm} placeholder="Choose" allowEmpty onChange={(e) => setX({ ...x, bdm: e.target.value })}>
            {bdms.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="nr-queue" label="Admissions queue" optional>
          <SelectInput id="nr-queue" value={x.queue} placeholder="Choose" allowEmpty onChange={(e) => setX({ ...x, queue: e.target.value })}>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}
