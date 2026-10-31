import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectInput, Switch } from '../../components/forms';
import { PageHead, downloadCsv } from '../../institution/records/parts';
import type { FilterSet } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History, Panel, when } from './parts';

/**
 * Filters configuration (not in the PM prototype; the filters course search, Applications and Students already
 * have): which filters each list shows and in what order. A hidden filter is gone for everyone.
 */
export function Filters({ cfg, change, say }: ConfigProps) {
  const upd = (page: string, what: string, fn: (f: FilterSet['filters']) => FilterSet['filters']) => {
    change('Filters configuration', `${page}: ${what}`, (c) => ({ ...c, filters: c.filters.map((s) => (s.page === page ? { ...s, filters: fn(s.filters) } : s)) }));
    say('Saved. Everyone sees it on their next page load.');
  };
  return (
    <>
      <PageHead title="Filters configuration" lead="Which filters each list shows, and in what order. A hidden filter is gone for everyone; the list still shows every record." />
      <div className="cfg__filtergrid">
        {cfg.filters.map((s) => (
          <Panel key={s.page} title={s.page} note={`${s.filters.filter((f) => f.shown).length} of ${s.filters.length} shown`}>
            <ol className="cfg__filters">
              {s.filters.map((f, i) => (
                <li key={f.id} className={f.shown ? '' : 'is-off'}>
                  <span className="cfg__muted num">{i + 1}</span>
                  <span className="cfg__fname">{f.label}</span>
                  <Switch id={`fl-${f.id}`} checked={f.shown} onChange={(v) => upd(s.page, `${v ? 'showed' : 'hid'} ${f.label}`, (l) => l.map((x) => (x.id === f.id ? { ...x, shown: v } : x)))}>
                    <span className="vh">Show {f.label}</span>
                  </Switch>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${f.label} up`}
                    disabled={i === 0}
                    onClick={() =>
                      upd(s.page, `moved ${f.label} up`, (l) => {
                        const n = [...l];
                        [n[i - 1], n[i]] = [n[i], n[i - 1]];
                        return n;
                      })
                    }
                  >
                    <Icon name="chevronDown" size={16} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${f.label} down`}
                    disabled={i === s.filters.length - 1}
                    onClick={() =>
                      upd(s.page, `moved ${f.label} down`, (l) => {
                        const n = [...l];
                        [n[i + 1], n[i]] = [n[i], n[i + 1]];
                        return n;
                      })
                    }
                  >
                    <Icon name="chevronDown" size={16} />
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>
      <History log={cfg.log} area="Filters configuration" />
    </>
  );
}

/**
 * Logs (PM: the download log, and each settings tab's change history, together): every change to GSP Admin's
 * settings and every download or export, by anyone, kept forever. Filter by kind, area or person; Export log is
 * logged too.
 */
export function Logs({ cfg, change, say }: ConfigProps) {
  const [kind, setKind] = useState<'' | 'change' | 'download'>('');
  const [area, setArea] = useState('');
  const [who, setWho] = useState('');
  const rows = cfg.log.filter((l) => (!kind || l.kind === kind) && (!area || l.area === area) && (!who || l.who === who)).sort((a, b) => b.at - a.at);
  const count = (k: '' | 'change' | 'download') => cfg.log.filter((l) => !k || l.kind === k).length;
  return (
    <>
      <PageHead title="Logs" lead="Every change to these settings and every download or export, by anyone, kept forever.">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            downloadCsv('gsp-log.csv', [['When', 'Who', 'Role', 'Kind', 'Area', 'What', 'Filters', 'Size', 'Format'], ...rows.map((l) => [new Date(l.at).toISOString(), l.who, l.role ?? '', l.kind === 'change' ? 'Change' : 'Download', l.area, l.text, l.filters ?? '', l.size ?? '', l.format ?? ''])]);
            change('Logs', 'Exported the log', (c) => ({ ...c, log: [{ id: `x${Date.now()}`, at: Date.now(), who: 'Ishaan Verma', role: 'Super Admin', area: 'Logs', text: 'Log', kind: 'download', filters: [kind && (kind === 'change' ? 'Changes' : 'Downloads'), area, who].filter(Boolean).join(' · ') || 'Everything', size: `${rows.length} rows`, format: 'CSV' }, ...c.log] }));
            say(`${rows.length} log entries exported. The export is logged too.`);
          }}
        >
          Export log
        </Button>
      </PageHead>
      <section className="card stable" aria-labelledby="lg-count">
        <div className="stools">
          <div className="stools__row">
            <div className="ichips cfg__kinds" role="group" aria-label="Show">
              {(
                [
                  ['', 'All'],
                  ['change', 'Changes'],
                  ['download', 'Downloads'],
                ] as ['' | 'change' | 'download', string][]
              ).map(([k, l]) => (
                <button key={k || 'all'} type="button" className="ichip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {l} <span className="ichip__n num">{count(k)}</span>
                </button>
              ))}
            </div>
            <SelectInput id="lg-area" aria-label="Area" value={area} placeholder="All areas" allowEmpty onChange={(e) => setArea(e.target.value)}>
              {[...new Set(cfg.log.map((l) => l.area))].sort().map((a) => (
                <option key={a}>{a}</option>
              ))}
            </SelectInput>
            <SelectInput id="lg-who" aria-label="Person" value={who} placeholder="Everyone" allowEmpty onChange={(e) => setWho(e.target.value)}>
              {[...new Set(cfg.log.map((l) => l.who))].sort().map((a) => (
                <option key={a}>{a}</option>
              ))}
            </SelectInput>
          </div>
          <p className="stools__count" id="lg-count" role="status">
            <span className="num">{rows.length}</span> entries
          </p>
        </div>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">What</th>
                <th scope="col">Size</th>
                <th scope="col">Format</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="cfg__muted num cfg__nowrap">{when(l.at)}</td>
                  <td>
                    <span className="cfg__strong">{l.who}</span>
                    {l.role && <span className="cfg__sub">{l.role}</span>}
                  </td>
                  <td>
                    <span className={`cfg__tag ${l.kind === 'download' ? 'cfg__tag--dl' : 'cfg__tag--soft'}`}>{l.kind === 'change' ? 'Change' : 'Download'}</span> <span className="cfg__muted">{l.area}:</span> {l.text}
                    {l.filters && <span className="cfg__sub">{l.filters}</span>}
                  </td>
                  <td className="cfg__muted num">{l.size ?? '–'}</td>
                  <td className="cfg__muted">{l.format ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
