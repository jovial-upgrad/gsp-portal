import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectInput, TextInput } from '../../components/forms';
import { PageHead, downloadCsv } from '../../institution/records/parts';
import type { ConfigProps } from './ConfigPage';

/**
 * Logs (Jovial, 31 Oct): the download log. Every download or export, by anyone, kept forever: date, time, name,
 * role, the filters applied and the rows. Filter by role, person and a date range; Export log is logged too.
 * Changes to settings stay in each page's Change history.
 */
export function Logs({ cfg, change, say, me }: ConfigProps) {
  const [role, setRole] = useState('');
  const [who, setWho] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const day = (at: number) => new Date(at - new Date(at).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const all = cfg.log.filter((l) => l.kind === 'download');
  const rows = all.filter((l) => (!role || l.role === role) && (!who || l.who === who) && (!from || day(l.at) >= from) && (!to || day(l.at) <= to)).sort((a, b) => b.at - a.at);
  const date = (at: number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = (at: number) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const filtered = Boolean(role || who || from || to);
  return (
    <>
      <PageHead title="Logs" lead="Every download and export, by anyone, kept forever.">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            downloadCsv('gsp-log.csv', [['Date', 'Time', 'Name', 'Role', 'Filters applied', 'Rows'], ...rows.map((l) => [date(l.at), time(l.at), l.who, l.role ?? '', l.filters ?? '', l.size ?? ''])]);
            const applied = [role, who, from && `from ${from}`, to && `to ${to}`].filter(Boolean).join(' · ') || 'None';
            change('Logs', 'Exported the log', (c) => ({ ...c, log: [{ id: `x${Date.now()}`, at: Date.now(), who: me, role: 'Admin', area: 'Logs', text: 'Log', kind: 'download', filters: applied, size: `${rows.length} rows`, format: 'CSV' }, ...c.log] }));
            say(`${rows.length} log entries exported. The export is logged too.`);
          }}
        >
          Export log
        </Button>
      </PageHead>
      <section className="card stable" aria-labelledby="lg-count">
        <div className="stools">
          <div className="stools__row">
            <SelectInput id="lg-role" aria-label="Role" value={role} placeholder="All roles" allowEmpty onChange={(e) => setRole(e.target.value)}>
              {[...new Set(all.map((l) => l.role ?? ''))].filter(Boolean).sort().map((a) => (
                <option key={a}>{a}</option>
              ))}
            </SelectInput>
            <SelectInput id="lg-who" aria-label="Person" value={who} placeholder="Everyone" allowEmpty onChange={(e) => setWho(e.target.value)}>
              {[...new Set(all.map((l) => l.who))].sort().map((a) => (
                <option key={a}>{a}</option>
              ))}
            </SelectInput>
            <label className="cfg__date">
              <span>From</span>
              <TextInput id="lg-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="cfg__date">
              <span>To</span>
              <TextInput id="lg-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            {filtered && (
              <Button variant="link" onClick={() => { setRole(''); setWho(''); setFrom(''); setTo(''); }}>
                Clear
              </Button>
            )}
          </div>
          <p className="stools__count" id="lg-count" role="status">
            <span className="num">{rows.length}</span> entries
          </p>
        </div>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Time</th>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Filters applied</th>
                <th scope="col">Rows</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="num cfg__nowrap">{date(l.at)}</td>
                  <td className="cfg__muted num">{time(l.at)}</td>
                  <td className="cfg__strong">{l.who}</td>
                  <td>{l.role ?? '–'}</td>
                  <td className="cfg__muted">{l.filters || 'None'}</td>
                  <td className="num">{(l.size ?? '–').replace(/ rows?$/, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="cfg__note cfg__empty">No downloads match these filters.</p>}
        </div>
      </section>
    </>
  );
}
