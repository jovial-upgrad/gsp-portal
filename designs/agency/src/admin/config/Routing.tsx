import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { PageHead } from '../../institution/records/parts';
import { DESTINATIONS, NATIONALITY, ROUTING_RPS, route, workRegions } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History, Panel } from './parts';

const EXAMPLES: [string, { rp: string; nationality: string; now: string; dest: string }][] = [
  ['Indian student, Indian RP', { rp: 'BrightPath Overseas', nationality: 'India', now: 'India', dest: 'Australia' }],
  ['Indian student, Nepali RP', { rp: 'Kathmandu Study Hub', nationality: 'India', now: 'India', dest: 'United Kingdom' }],
  ['Onshore, Vietnamese RP', { rp: 'Saigon Study Link', nationality: 'Vietnam', now: 'Australia', dest: 'Australia' }],
  ['Onshore, Indian RP', { rp: 'BrightPath Overseas', nationality: 'India', now: 'Australia', dest: 'Australia' }],
  ['Direct, Nigerian student', { rp: '', nationality: 'Nigeria', now: 'Nigeria', dest: 'Canada' }],
  ['Unmapped nationality', { rp: 'Horizon Overseas', nationality: 'United Arab Emirates', now: 'United Arab Emirates', dest: 'Australia' }],
];

/**
 * Application routing (PM: Settings › Application routing): when an application is submitted it gets its region
 * (which Admissions queue works it), its BDM, its source region and the rule that set them. The rules run from the
 * top and the first that matches wins; switch one off or move it. Test any case first; nothing is saved.
 */
export function Routing({ cfg, change, say }: ConfigProps) {
  const [t, setT] = useState(EXAMPLES[1][1]);
  const [addTo, setAddTo] = useState<Record<string, string>>({});
  const r = route(cfg.rules, cfg.lists, t);
  const keepAt = cfg.rules.findIndex((x) => x.id === 'keep');
  const onAt = cfg.rules.findIndex((x) => x.id === 'onshore');
  const move = (i: number, d: -1 | 1) => {
    const a = cfg.rules[i];
    const b = cfg.rules[i + d];
    change('Application routing', `Moved “${a.title}” ${d < 0 ? 'above' : 'below'} “${b.title}”`, (c) => {
      const rules = [...c.rules];
      [rules[i], rules[i + d]] = [rules[i + d], rules[i]];
      return { ...c, rules };
    });
    say('Saved. Applies to applications submitted from now. Submitted applications keep their values.');
  };
  const onList = new Set(Object.values(cfg.lists).flat());
  return (
    <>
      <PageHead
        title="Application routing"
        lead="When an application is submitted it gets four values: its region (which Admissions queue works it and where it is reported), its BDM, its source region (the RP’s region) and the rule that set them. The rules run from the top; the first one that matches wins. A change applies to applications submitted after it; submitted applications never change."
      />
      <div className="cfg__routing">
        <Panel title="Rules, in order">
          <ol className="cfg__rules">
            {cfg.rules.map((x, i) => {
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
                    ) : (
                      <>
                        <Switch
                          id={`rt-on-${x.id}`}
                          checked={x.on}
                          onChange={(v) => {
                            change('Application routing', `${v ? 'Switched on' : 'Switched off'} “${x.title}”`, (c) => ({ ...c, rules: c.rules.map((y) => (y.id === x.id ? { ...y, on: v } : y)) }));
                            say(`“${x.title}” ${v ? 'on' : 'off'}. Applies to applications submitted from now.`);
                          }}
                        >
                          <span className="vh">{x.title}: </span>On
                        </Switch>
                        <button type="button" className="icon-btn" aria-label={`Move “${x.title}” up`} disabled={i === 0} onClick={() => move(i, -1)}>
                          <Icon name="chevronDown" size={16} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <button type="button" className="icon-btn" aria-label={`Move “${x.title}” down`} disabled={cfg.rules[i + 1]?.id === 'fb'} onClick={() => move(i, 1)}>
                          <Icon name="chevronDown" size={16} />
                        </button>
                      </>
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
                  <dd>{r.hit.region} Admissions</dd>
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

      <Panel title="Regional RP lists" note="Every application from an RP on a list goes to the list’s region, whatever the student’s nationality. An RP can be on one list only." flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col">RPs on the list</th>
                <th scope="col">Add an RP</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cfg.lists).map(([reg, rps]) => (
                <tr key={reg}>
                  <td className="cfg__strong">{reg}</td>
                  <td>
                    <div className="cfg__chips">
                      {rps.map((p) => (
                        <span key={p} className="cfg__chip">
                          {p}
                          <button
                            type="button"
                            aria-label={`Take ${p} off the ${reg} list`}
                            onClick={() => {
                              change('Application routing', `Took ${p} off the ${reg} list`, (c) => ({ ...c, lists: { ...c.lists, [reg]: c.lists[reg].filter((x) => x !== p) } }));
                              say(`${p} taken off the ${reg} list.`);
                            }}
                          >
                            <Icon name="close" size={12} />
                          </button>
                        </span>
                      ))}
                      {!rps.length && <span className="cfg__muted">None yet</span>}
                    </div>
                  </td>
                  <td>
                    <div className="cfg__add">
                      <SelectInput id={`rl-${reg}`} aria-label={`RP to add to the ${reg} list`} value={addTo[reg] ?? ''} placeholder="Choose RP" allowEmpty onChange={(e) => setAddTo((x) => ({ ...x, [reg]: e.target.value }))}>
                        {ROUTING_RPS.filter((p) => !onList.has(p.name)).map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </SelectInput>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!addTo[reg]}
                        onClick={() => {
                          const p = addTo[reg];
                          change('Application routing', `Added ${p} to the ${reg} list`, (c) => ({ ...c, lists: { ...c.lists, [reg]: [...c.lists[reg], p] } }));
                          say(`${p} added to the ${reg} list.`);
                          setAddTo((x) => ({ ...x, [reg]: '' }));
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Region defaults" note="The BDM an application gets when a rule says “that region’s default BDM”, and the Admissions queue that works it." flush>
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
              {[...workRegions(cfg.regions), { name: 'Direct', contact: '' }].map((reg) => (
                <tr key={reg.name}>
                  <td className="cfg__strong">{reg.name}</td>
                  <td>
                    <TextInput
                      id={`rd-${reg.name}`}
                      aria-label={`${reg.name}: default application BDM`}
                      className="cfg__cellinput"
                      defaultValue={cfg.regionBdm[reg.name] ?? ''}
                      placeholder="Not set"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === (cfg.regionBdm[reg.name] ?? '')) return;
                        change('Application routing', `${reg.name}: default BDM → ${v || 'Not set'}`, (c) => ({ ...c, regionBdm: { ...c.regionBdm, [reg.name]: v } }));
                        say(`${reg.name}’s default BDM saved.`);
                      }}
                    />
                    {!cfg.regionBdm[reg.name] && <span className="cfg__warn">Applications that need a region default here will have no BDM</span>}
                  </td>
                  <td className="cfg__muted">{reg.name} Admissions</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Application routing" />
    </>
  );
}
