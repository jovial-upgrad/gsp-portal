import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Field, SelectInput, Switch } from '../../components/forms';
import { MultiPick } from '../../institution/records/MultiPick';
import { PageHead } from '../../institution/records/parts';
import { DESTINATIONS, TEST_NATIONALITIES, ROUTING_RPS, route, workRegions, type RouteRule } from '../data/config';
import { nationalityRegions } from '../data/nationalities';
import type { ConfigProps } from './ConfigPage';
import { EditActions, History, Panel, useAsk } from './parts';

const EXAMPLES: [string, { rp: string; nationality: string; now: string; dest: string }][] = [
  ['Indian student, Indian RP', { rp: 'BrightPath Overseas', nationality: 'India', now: 'India', dest: 'Australia' }],
  ['Indian student, Nepali RP', { rp: 'Kathmandu Study Hub', nationality: 'India', now: 'India', dest: 'United Kingdom' }],
  ['Onshore, Vietnamese RP', { rp: 'Saigon Study Link', nationality: 'Vietnam', now: 'Australia', dest: 'Australia' }],
  ['Onshore, Indian RP', { rp: 'BrightPath Overseas', nationality: 'India', now: 'Australia', dest: 'Australia' }],
  ['Direct, Nigerian student', { rp: '', nationality: 'Nigeria', now: 'Nigeria', dest: 'Canada' }],
  ['Unmapped nationality', { rp: 'Horizon Overseas', nationality: 'United Arab Emirates', now: 'United Arab Emirates', dest: 'Australia' }],
];

/**
 * Application Routing (PM: Settings › Application routing): when an application is submitted it gets its region
 * (which Admissions queue works it), its BDM, its source region and the rule that set them. The rules run from the
 * top and the first that matches wins. Test any case; nothing is saved. 3 Nov (Nesil): it reads as it is until Edit,
 * then rules switch off or move and the regional RP lists change, and Save Changes keeps it. No region defaults.
 * 4 Nov (Nesil): while editing, **Add Region** (a sales region and its RPs, several), several RPs added to a list at
 * once, and a region's list deleted; every delete or take-off is asked first.
 */
export function Routing({ cfg, change, say }: ConfigProps) {
  const [t, setT] = useState(EXAMPLES[1][1]);
  const [addTo, setAddTo] = useState<Record<string, string[]>>({});
  const [adding, setAdding] = useState(false);
  const [ask, asking] = useAsk();
  const [draft, setDraft] = useState<{ rules: RouteRule[]; lists: Record<string, string[]> } | null>(null);
  const rules = draft?.rules ?? cfg.rules;
  const lists = draft?.lists ?? cfg.lists;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify({ rules: cfg.rules, lists: cfg.lists });
  const r = route(rules, lists, t, nationalityRegions(cfg.nationalities));
  const keepAt = rules.findIndex((x) => x.id === 'keep');
  const onAt = rules.findIndex((x) => x.id === 'onshore');
  const move = (i: number, d: -1 | 1) =>
    setDraft((x) => {
      const n = [...x!.rules];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return { ...x!, rules: n };
    });
  const save = () => {
    const d = draft!;
    const what: string[] = [];
    if (d.rules.map((x) => x.id).join() !== cfg.rules.map((x) => x.id).join()) what.push(`order: ${d.rules.map((x, i) => `${i + 1}. ${x.title}`).join(', ')}`);
    d.rules.forEach((x) => {
      const was = cfg.rules.find((y) => y.id === x.id)!;
      if (was.on !== x.on) what.push(`${x.on ? 'switched on' : 'switched off'} “${x.title}”`);
    });
    Object.entries(d.lists).forEach(([reg, l]) => {
      if (!cfg.lists[reg]) return void what.push(`added the ${reg} list: ${l.join(', ')}`);
      const was = cfg.lists[reg];
      l.filter((p) => !was.includes(p)).forEach((p) => what.push(`added ${p} to the ${reg} list`));
      was.filter((p) => !l.includes(p)).forEach((p) => what.push(`took ${p} off the ${reg} list`));
    });
    Object.keys(cfg.lists)
      .filter((reg) => !d.lists[reg])
      .forEach((reg) => what.push(`deleted the ${reg} list`));
    change('Application routing', what.join('; '), (c) => ({ ...c, rules: d.rules, lists: d.lists }));
    say('Saved. Applies to applications submitted from now. Submitted applications keep their values.');
    setDraft(null);
    setAddTo({});
  };
  const onList = new Set(Object.values(lists).flat());
  return (
    <>
      <PageHead title="Application Routing" lead="Which region, queue and BDM a submitted application goes to: the first rule that matches wins.">
        <EditActions editing={!!draft} dirty={dirty} onEdit={() => setDraft({ rules: cfg.rules, lists: cfg.lists })} onCancel={() => (setDraft(null), setAddTo({}))} onSave={save} />
      </PageHead>
      <div className="cfg__routing">
        <Panel title="Rules, in Order" note={draft ? 'Switch a rule off (not the Fallback), or move it up or down; the Fallback stays last.' : 'Edit to switch a rule off or change the order. A change applies to applications submitted after it.'}>
          <ol className="cfg__rules">
            {rules.map((x, i) => {
              const last = x.id === 'fb';
              return (
                <li key={x.id} className={`cfg__rule ${x.on || last ? '' : 'is-off'}`}>
                  <span className="cfg__rulen num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="cfg__rulet">
                    <p className="cfg__strong">
                      {x.title}
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
                    ) : draft ? (
                      <>
                        <Switch id={`rt-on-${x.id}`} checked={x.on} onChange={(v) => setDraft((d) => ({ ...d!, rules: d!.rules.map((y) => (y.id === x.id ? { ...y, on: v } : y)) }))}>
                          <span className="vh">{x.title}: </span>On
                        </Switch>
                        <button type="button" className="icon-btn" aria-label={`Move “${x.title}” up`} disabled={i === 0} onClick={() => move(i, -1)}>
                          <Icon name="chevronDown" size={16} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <button type="button" className="icon-btn" aria-label={`Move “${x.title}” down`} disabled={rules[i + 1]?.id === 'fb'} onClick={() => move(i, 1)}>
                          <Icon name="chevronDown" size={16} />
                        </button>
                      </>
                    ) : (
                      <span className={`cfg__state ${x.on ? 'is-on' : ''}`}>{x.on ? 'On' : 'Off'}</span>
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

        <Panel title="Test a Routing" note="Try any case before you change a rule. Nothing is saved.">
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
                {TEST_NATIONALITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SelectInput>
            </Field>
            <Field id="rt-now" label="Student current country">
              <SelectInput id="rt-now" value={t.now} onChange={(e) => setT((x) => ({ ...x, now: e.target.value }))}>
                {[...new Set(['Australia', ...TEST_NATIONALITIES])].map((c) => (
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

      <Panel
        title="Regional RP Lists"
        note="Every application from an RP on a list goes to the list’s region, whatever the student’s nationality. An RP can be on one list only."
        action={
          draft ? (
            <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setAdding(true)}>
              Add Region
            </Button>
          ) : undefined
        }
        flush
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col">RPs on the list</th>
                {draft && <th scope="col">Add an RP</th>}
                {draft && (
                  <th scope="col">
                    <span className="vh">Delete</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {Object.entries(lists).map(([reg, rps]) => (
                <tr key={reg}>
                  <td className="cfg__strong">{reg}</td>
                  <td>
                    <div className="cfg__chips">
                      {rps.map((p) => (
                        <span key={p} className="cfg__chip">
                          {p}
                          {draft && (
                            <button
                              type="button"
                              aria-label={`Take ${p} off the ${reg} list`}
                              onClick={() =>
                                ask({
                                  title: `Take ${p} off the ${reg} list?`,
                                  confirm: 'Take Off',
                                  body: `Once you save, ${p}’s applications follow the other rules.`,
                                  run: () => setDraft((d) => ({ ...d!, lists: { ...d!.lists, [reg]: d!.lists[reg].filter((x) => x !== p) } })),
                                })
                              }
                            >
                              <Icon name="close" size={12} />
                            </button>
                          )}
                        </span>
                      ))}
                      {!rps.length && <span className="cfg__muted">None yet</span>}
                    </div>
                  </td>
                  {draft && (
                    <td>
                      <div className="cfg__add cfg__addrps">
                        <MultiPick id={`rl-${reg}`} label={`RPs to add to the ${reg} list`} value={addTo[reg] ?? []} options={ROUTING_RPS.filter((p) => !onList.has(p.name)).map((p) => p.name)} onChange={(v) => setAddTo((x) => ({ ...x, [reg]: v }))} empty="Choose RPs" search />
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!addTo[reg]?.length}
                          onClick={() => {
                            const ps = addTo[reg];
                            setDraft((d) => ({ ...d!, lists: { ...d!.lists, [reg]: [...d!.lists[reg], ...ps] } }));
                            setAddTo((x) => ({ ...x, [reg]: [] }));
                          }}
                        >
                          Add RPs
                        </Button>
                      </div>
                    </td>
                  )}
                  {draft && (
                    <td className="cfg__acts">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Delete the ${reg} list`}
                        onClick={() =>
                          ask({
                            title: `Delete the ${reg} list?`,
                            confirm: 'Delete Region',
                            body: rps.length ? `Once you save, ${rps.length === 1 ? `${rps[0]}’s applications follow` : `the applications of its ${rps.length} RPs follow`} the other rules.` : 'It has no RPs.',
                            run: () => {
                              setDraft((d) => ({ ...d!, lists: Object.fromEntries(Object.entries(d!.lists).filter(([k]) => k !== reg)) }));
                              setAddTo((x) => ({ ...x, [reg]: [] }));
                            },
                          })
                        }
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!Object.keys(lists).length && (
                <tr>
                  <td colSpan={draft ? 4 : 2} className="cfg__muted">
                    No regional lists.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <History log={cfg.log} area="Application routing" />
      {asking}
      <ListDialog
        open={adding}
        regions={workRegions(cfg.regions)
          .map((x) => x.name)
          .filter((x) => !lists[x])}
        rps={ROUTING_RPS.filter((p) => !onList.has(p.name)).map((p) => p.name)}
        onClose={() => setAdding(false)}
        onSave={(reg, rps) => {
          setDraft((d) => ({ ...d!, lists: { ...d!.lists, [reg]: rps } }));
          setAdding(false);
        }}
      />
    </>
  );
}

/** A new regional RP list (4 Nov): the sales region, and the RPs on it, several (an RP is on one list only). */
function ListDialog({ open, regions, rps, onClose, onSave }: { open: boolean; regions: string[]; rps: string[]; onClose: () => void; onSave: (region: string, rps: string[]) => void }) {
  const [region, setRegion] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setRegion('');
    setPicked([]);
    setTried(false);
  }, [open]);
  const err = { region: !region ? 'Pick the sales region.' : null, rps: !picked.length ? 'Pick at least one RP.' : null };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (!Object.values(err).some(Boolean)) onSave(region, picked);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title="Add Region"
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Add Region</Button>
          </div>
        </div>
      }
    >
      <div className="cfg__form">
        <Field id="rl-new-region" label="Sales region" required error={show('region')}>
          <SelectInput id="rl-new-region" value={region} placeholder="Choose one region" invalid={!!show('region')} onChange={(e) => setRegion(e.target.value)}>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="rl-new-rps" label="RP list" required error={show('rps')} hint={!rps.length ? 'Every RP is on a list already.' : undefined}>
          <MultiPick id="rl-new-rps" label="RP list" value={picked} options={rps} onChange={setPicked} empty="Choose RPs" search />
        </Field>
      </div>
    </Sheet>
  );
}
