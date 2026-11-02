import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, Switch } from '../../components/forms';
import { PageHead } from '../../institution/records/parts';
import { MultiPick } from '../../institution/records/MultiPick';
import { DESTINATIONS, regionQueueName, route, type RouteRule } from '../data/config';
import { routingRps } from '../../data/regions';
import { COUNTRIES } from '../../data/partners';
import { nationalityWord } from '../data/nationalities';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';
import { Empty, Loaded, Pick, SaveBanner, ViewOnlyNote, trySave, type SaveResult } from './states';

type Test = { rp: string; nationality: string; now: string; dest: string };
const EXAMPLES: [string, Test][] = [
  // real RPs from the records (HC49, 1 Nov)
  ['Indian student, Indian RP', { rp: 'Silver Fern Education', nationality: 'India', now: 'India', dest: 'Australia' }],
  ['Indian student, Nepali RP', { rp: 'Kathmandu Pathways', nationality: 'India', now: 'India', dest: 'United Kingdom' }],
  ['In Australia, Vietnamese RP', { rp: 'Future Journey Visa Services', nationality: 'Vietnam', now: 'Australia', dest: 'Australia' }],
  ['In Australia, Indian RP', { rp: 'Silver Fern Education', nationality: 'India', now: 'Australia', dest: 'Australia' }],
  ['Direct, Nigerian student', { rp: '', nationality: 'Nigeria', now: 'Nigeria', dest: 'Canada' }],
  ['Unmapped nationality', { rp: 'MWT Education', nationality: 'Japan', now: 'Japan', dest: 'Australia' }],
];

type Draft = { rules: RouteRule[]; lists: Record<string, string[]> };

/**
 * Application routing (PRD slice 1; Admin › Application configuration › Application routing): when an application
 * reaches Pre-screening (New → Pre-screening, when the RP sends the documents; slice 3) it gets a sales region, a BDM
 * and its region's Admissions queue, whose Fewest open then picks the officer (slice 4). The six rules are code:
 * Admin owns each one's On or Off (not the Fallback, always on) and the order (the Fallback stays last), and keeps
 * the regional RP lists. Read only until Edit; Save or Cancel. Test a routing is never saved or logged.
 */
export function Routing({ cfg, change, say, canEdit }: ConfigProps) {
  const [t, setT] = useState<Test>(EXAMPLES[1][1]);
  const [tried, setTried] = useState(false);
  const [newList, setNewList] = useState('');
  const [listErr, setListErr] = useState(false);
  const [addTo, setAddTo] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<SaveResult | null>(null);
  const d = useDraft<Draft>({ rules: cfg.rules, lists: cfg.lists }, 'the routing');
  const v = d.value;
  const ed = d.editing;
  // the RPs as the rules see them, from their records; on this draft's lists a listed RP takes the list's region
  const rpRecs = routingRps().map((p) => ({ ...p, region: Object.entries(v.lists).find(([, l]) => l.includes(p.name))?.[0] ?? p.region }));
  const r = route(v.rules, v.lists, { ...t, rpInfo: rpRecs.find((p) => p.name === t.rp) }, cfg.regionBdm, cfg.nationality);
  const countries = COUNTRIES.map((c) => c.name);
  const move = (i: number, dir: -1 | 1) =>
    d.set((x) => {
      const rules = [...x.rules];
      [rules[i], rules[i + dir]] = [rules[i + dir], rules[i]];
      return { ...x, rules };
    });
  const listOf = new Map(Object.entries(v.lists).flatMap(([reg, l]) => l.map((p) => [p, reg] as [string, string])));
  const emptyLists = Object.entries(v.lists).filter(([, l]) => !l.length).map(([k]) => k);
  const save = () => {
    // a list needs at least one RP to save
    if (emptyLists.length) return setListErr(true);
    const res = trySave();
    if (res !== 'ok') return setResult(res);
    const what: string[] = [];
    v.rules.forEach((x, i) => {
      const was = cfg.rules.findIndex((y) => y.id === x.id);
      if (was !== i) what.push(`“${x.title}” ${was + 1} → ${i + 1}`);
      if (cfg.rules[was]?.on !== x.on) what.push(`“${x.title}” ${cfg.rules[was]?.on ? 'On' : 'Off'} → ${x.on ? 'On' : 'Off'}`);
    });
    for (const reg of new Set([...Object.keys(cfg.lists), ...Object.keys(v.lists)])) {
      const a = cfg.lists[reg]?.join(', ') ?? 'no list';
      const b = v.lists[reg]?.join(', ') ?? 'no list';
      if (a !== b) what.push(`${reg} list: ${a || 'none'} → ${b || 'none'}`);
    }
    change('Application routing', what.join('; ') || 'No changes', (c) => ({ ...c, ...v }));
    say('Saved.');
    setResult(null);
    setListErr(false);
    d.stop();
  };
  const testErr = (k: keyof Test) => (tried && k !== 'rp' && !t[k] ? `Pick ${k === 'nationality' ? 'the nationality' : k === 'now' ? 'where the student lives' : 'the destination'}.` : null);
  return (
    <>
      <PageHead title="Application routing" lead="When an application reaches Pre-screening (New → Pre-screening, when the RP sends the documents), it gets a sales region, a Recruitment contact and its region’s Admissions queue, whose Fewest open then picks the officer. The rules run from the top; the first one that matches decides, and the result and the rule number are stored on the application. Changing the rules affects only applications that reach Pre-screening afterwards.">
        {canEdit && <EditBar name="the routing" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (setResult(null), setListErr(false), d.stop())} onSave={save} />}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      {ed && <SaveBanner result={result} onReload={d.stop} />}
      <Loaded page="application routing" cols={4}>
        <div className="cfg__routing">
          <Panel title="Rules, in order" note="The rules and what each matches are code. Switch a rule off (not the Fallback), or move it up or down; the Fallback stays last.">
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
                      <p className="cfg__sub">Matches when: {x.when}</p>
                      <p className="cfg__rulesets">
                        <span className="cfg__tag cfg__tag--soft">Region: {x.region}</span>
                        <span className="cfg__tag cfg__tag--soft">BDM: {x.bdm}</span>
                      </p>
                    </div>
                    <div className="cfg__ruleacts">
                      {last ? (
                        <span className="cfg__muted">Always on, always last</span>
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
            <p className="cfg__note">“The RP” is the branch that created the application.</p>
          </Panel>
          <Panel title="Test a routing" note="Pick an RP, nationality, current country and destination to see which rule matches. Nothing is saved or logged.">
            <div className="cfg__examples" role="group" aria-label="Examples">
              {EXAMPLES.map(([l, x]) => (
                <button key={l} type="button" className="ichip" aria-pressed={JSON.stringify(x) === JSON.stringify(t)} onClick={() => (setT(x), setTried(false))}>
                  {l}
                </button>
              ))}
            </div>
            <div className="cfg__testgrid">
              <Field id="rt-rp" label="RP" optional hint="Empty means no RP.">
                <Pick id="rt-rp" label="RP" value={t.rp} empty="No RP (direct application)" options={rpRecs.map((p) => [p.name, `${p.name} (${p.region})`] as [string, string])} onChange={(rp) => setT((x) => ({ ...x, rp }))} />
              </Field>
              <Field id="rt-nat" label="Nationality" required error={testErr('nationality')}>
                <Pick id="rt-nat" label="Nationality" value={t.nationality} placeholder="Pick the nationality" options={countries.map((c) => [c, nationalityWord(c)] as [string, string])} invalid={!!testErr('nationality')} onChange={(nationality) => setT((x) => ({ ...x, nationality }))} />
              </Field>
              <Field id="rt-now" label="Where the student lives" required error={testErr('now')}>
                <Pick id="rt-now" label="Where the student lives" value={t.now} placeholder="Pick a country" options={countries} invalid={!!testErr('now')} onChange={(now) => setT((x) => ({ ...x, now }))} />
              </Field>
              <Field id="rt-dest" label="Destination" required error={testErr('dest')}>
                <Pick id="rt-dest" label="Destination" value={t.dest} placeholder="Pick a country" options={DESTINATIONS} invalid={!!testErr('dest')} onChange={(dest) => setT((x) => ({ ...x, dest }))} />
              </Field>
            </div>
            {t.nationality && t.now && t.dest && r.hit ? (
              <div className="cfg__result" role="status">
                <p className="cfg__resultbig">
                  {r.hit.region} · routed by rule {r.hit.n}, {r.hit.rule.title.toLowerCase()}
                </p>
                <dl className="cfg__resultfacts">
                  <div>
                    <dt>Sales region</dt>
                    <dd>{r.hit.region}</dd>
                  </div>
                  <div>
                    <dt>Recruitment</dt>
                    <dd>{r.hit.bdm}</dd>
                  </div>
                  <div>
                    <dt>Admissions queue</dt>
                    <dd>{regionQueueName(r.hit.region)}</dd>
                  </div>
                  <div>
                    <dt>Rule that matched</dt>
                    <dd>
                      {r.hit.n}. {r.hit.rule.title}
                    </dd>
                  </div>
                </dl>
                <p className="cfg__k">Each rule</p>
                <ol className="cfg__trace">
                  {r.trace.map((s) => (
                    <li key={s.r.id} className={s.state === 'Matched' ? 'is-match' : s.state === 'Not reached' ? 'is-skipped' : ''}>
                      <span className="cfg__tstate">{s.state}</span>
                      <span>
                        {s.r.title}: {s.why}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setTried(true)}>
                Test
              </Button>
            )}
          </Panel>
        </div>

        <Panel
          title="Regional RP lists"
          note="Every application from an RP on a list goes to the list’s region, whatever the student’s nationality (rule 2). One list per region; an RP can be on only one list."
          action={
            ed && (
              <span className="cfg__add">
                <Pick id="rl-new" label="Sales region for a new list" value={newList} placeholder="Pick a sales region" options={cfg.regions.filter((x) => x.name !== 'Global' && !(x.name in v.lists)).map((x) => x.name)} onChange={setNewList} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!newList) return setListErr(true);
                    d.set((x) => ({ ...x, lists: { ...x.lists, [newList]: [] } }));
                    setNewList('');
                  }}
                >
                  Add list
                </Button>
              </span>
            )
          }
          flush
        >
          {ed && listErr && !newList && !emptyLists.length && (
            <p className="field__msg field__msg--error cfg__foot" role="alert">
              Pick a sales region.
            </p>
          )}
          {!Object.keys(v.lists).length ? (
            <Empty>No regional RP lists yet.</Empty>
          ) : (
            <div className="stab-wrap">
              <table className="itab cfg__tab">
                <thead>
                  <tr>
                    <th scope="col">Sales region</th>
                    <th scope="col">RPs</th>
                    {ed && <th scope="col">Add RPs</th>}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(v.lists).map(([reg, rps]) => (
                    <tr key={reg}>
                      <td className="cfg__strong">
                        {reg}
                        {ed && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() =>
                              d.set((x) => {
                                const lists = { ...x.lists };
                                delete lists[reg];
                                return { ...x, lists };
                              })
                            }
                          >
                            Delete list
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
                          {!rps.length && <span className={ed && listErr ? 'cfg__err' : 'cfg__muted'}>No RPs on this list yet.{ed && listErr ? ' Add at least one to save.' : ''}</span>}
                        </div>
                      </td>
                      {ed && (
                        <td>
                          <div className="cfg__add">
                            <MultiPick
                              id={`rl-${reg}`}
                              label={`RPs to add to the ${reg} list`}
                              value={addTo[reg] ?? []}
                              options={rpRecs.map((p) => (listOf.has(p.name) ? `${p.name} (on ${listOf.get(p.name)} list)` : p.name))}
                              empty="Search RPs"
                              search
                              onChange={(l) => setAddTo((x) => ({ ...x, [reg]: l.filter((y) => !/ \(on .+ list\)$/.test(y)) }))}
                            />
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
            </div>
          )}
        </Panel>
      </Loaded>
      <History log={cfg.log} area="Application routing" />
    </>
  );
}
