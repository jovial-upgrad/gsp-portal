import { useState } from 'react';
import { useComm } from '../../finance/commission/store';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectInput, TextInput } from '../../components/forms';
import { NoMatch, PageHead, downloadCsv } from '../../institution/records/parts';
import type { LogEntry } from '../data/config';
import { GSP_USER } from '../user';
import type { ConfigProps } from './ConfigPage';
import { Pager, usePaged } from './parts';

const day = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const stamp = (t: number) => {
  const d = new Date(t);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Logs (PM: the download log, and each settings tab's change history, together): every change to GSP Admin's
 * settings and every download or export, by anyone, kept forever. 3 Nov (Nesil): filtered by role, user, sales
 * region, area and the dates from and to, 20 a page; Export Log is logged too. 4 Nov (Nesil): a table, not a
 * timeline: **Email, Role, Export date and time, Source, Records downloaded, Sales region**, filtered by **Source,
 * Role** and **Sales region** (and the dates). A change's source is the settings page, with what changed under it.
 */
export function Logs({ cfg, change, say, me }: ConfigProps) {
  const [source, setSource] = useState('');
  const [role, setRole] = useState('');
  const [region, setRegion] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const userOf = (name: string) => cfg.users.find((u) => u.name === name);
  const emailOf = (l: LogEntry) => l.email ?? userOf(l.who)?.email ?? '';
  const regionOf = (l: LogEntry) => l.region ?? userOf(l.who)?.region ?? '';
  // 9 Nov (Jovial): Commission lines' CSV exports are logged here too (from the commission store)
  const comm = useComm();
  const all = [...cfg.log, ...comm.downloads.map((d): LogEntry => ({ ...d, kind: 'download' }))].sort((a, b) => b.at - a.at);
  const rows = all.filter((l) => (!source || l.area === source) && (!role || l.role === role) && (!region || regionOf(l) === region) && (!from || day(l.at) >= from) && (!to || day(l.at) <= to));
  const pg = usePaged(rows, [source, role, region, from, to]);
  const any = !!(source || role || region || from || to);
  const clear = () => {
    setSource('');
    setRole('');
    setRegion('');
    setFrom('');
    setTo('');
  };
  const list = (f: (l: LogEntry) => string) => [...new Set(all.map(f).filter(Boolean))].sort();
  const regions = [...new Set([...cfg.regions.map((r) => r.name), ...all.map(regionOf).filter(Boolean)])];
  const today = day(Date.now());
  const dash = <span className="cfg__muted">—</span>;
  return (
    <>
      <PageHead title="Logs" lead="Every change to these settings and every download or export, by anyone, kept forever.">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            downloadCsv('gsp-log.csv', [
              ['Email', 'Name', 'Role', 'Export date and time', 'Source', 'What', 'Records downloaded', 'Format', 'Filters', 'Sales region'],
              ...rows.map((l) => [emailOf(l), l.who, l.role ?? '', new Date(l.at).toISOString(), l.area, l.text, l.records ?? '', l.format ?? '', l.filters ?? '', regionOf(l)]),
            ]);
            const filters = [source, role, region, from && `from ${from}`, to && `to ${to}`].filter(Boolean).join(' · ') || 'Everything';
            const u = userOf(me);
            // logged as a download only: change() adds no change of its own when the text is empty
            change('Logs', '', (c) => ({ ...c, log: [{ id: `x${Date.now()}`, at: Date.now(), who: me, email: u?.email ?? GSP_USER.email, role: 'Super Admin', region: u?.region || 'Global', area: 'Logs', text: 'Log', kind: 'download', filters, records: rows.length, format: 'CSV' }, ...c.log] }));
            say(`${rows.length} log entries exported. The export is logged too.`);
          }}
        >
          Export Log
        </Button>
      </PageHead>
      <section className="card stable" aria-labelledby="lg-count">
        <div className="lg__filters">
          <label className="lg__f">
            <span className="lg__k">Source</span>
            <SelectInput id="lg-source" value={source} placeholder="All sources" allowEmpty onChange={(e) => setSource(e.target.value)}>
              {list((l) => l.area).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </SelectInput>
          </label>
          <label className="lg__f">
            <span className="lg__k">Role</span>
            <SelectInput id="lg-role" value={role} placeholder="All roles" allowEmpty onChange={(e) => setRole(e.target.value)}>
              {list((l) => l.role ?? '').map((x) => (
                <option key={x}>{x}</option>
              ))}
            </SelectInput>
          </label>
          <label className="lg__f">
            <span className="lg__k">Sales region</span>
            <SelectInput id="lg-region" value={region} placeholder="All regions" allowEmpty onChange={(e) => setRegion(e.target.value)}>
              {regions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </SelectInput>
          </label>
          <label className="lg__f">
            <span className="lg__k">From</span>
            <TextInput id="lg-from" type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="lg__f">
            <span className="lg__k">To</span>
            <TextInput id="lg-to" type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <p className="stools__count lg__count" id="lg-count" role="status">
          <span>
            <span className="num">{rows.length === all.length ? all.length : `${rows.length} of ${all.length}`}</span> entries
          </span>
          {any && (
            <button type="button" className="cfg__linkbtn" onClick={clear}>
              Clear filters
            </button>
          )}
        </p>
        {rows.length === 0 ? (
          <NoMatch what="entries" onClear={clear} />
        ) : (
          <div className="stab-wrap">
            <table className="itab cfg__tab lg__tab">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Export date and time</th>
                  <th scope="col">Source</th>
                  <th scope="col" className="is-num">
                    Records downloaded
                  </th>
                  <th scope="col">Sales region</th>
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((l) => (
                  <tr key={l.id}>
                    <td className="lg__email">{emailOf(l) || dash}</td>
                    <td>{l.role || dash}</td>
                    <td className="cfg__nowrap num">{stamp(l.at)}</td>
                    <td className="lg__source">
                      <span className="cfg__strong">{l.area}</span>
                      <span className="cfg__sub">{l.kind === 'download' ? [l.text, l.filters].filter(Boolean).join(' · ') : l.text}</span>
                    </td>
                    <td className="is-num num">
                      {l.kind === 'download' && l.records !== undefined ? (
                        <>
                          {l.records.toLocaleString('en-GB')}
                          {l.format && <span className="cfg__sub">{l.format}</span>}
                        </>
                      ) : (
                        dash
                      )}
                    </td>
                    <td>{regionOf(l) || dash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pg={pg} what="entries" />
      </section>
    </>
  );
}
