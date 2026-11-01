import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DateInput, Field, SelectInput, TextInput } from '../../components/forms';
import { fmtDate } from '../../data/format';
import { afterError, dateError, numError, useCheck } from '../../components/validate';
import { EditBar, History, Panel, useDraft } from './parts';
import type { Security as SecurityCfg } from '../data/config';
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
  // a date filter only applies once it's a whole date (typed DD/MM/YYYY)
  const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const rows = all.filter((l) => (!role || l.role === role) && (!who || l.who === who) && (!iso(from) || day(l.at) >= from) && (!iso(to) || day(l.at) <= to)).sort((a, b) => b.at - a.at);
  const date = (at: number) => fmtDate(at);
  const rangeErr = dateError(from, { what: 'From date' }) || dateError(to, { what: 'To date' }) || afterError(from, to, 'To date', 'From date');
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
              <DateInput id="lg-from" value={from} invalid={!!rangeErr && !!from} aria-describedby={rangeErr ? 'lg-range' : undefined} onChange={setFrom} />
            </label>
            <label className="cfg__date">
              <span>To</span>
              <DateInput id="lg-to" value={to} invalid={!!rangeErr && !!to} aria-describedby={rangeErr ? 'lg-range' : undefined} onChange={setTo} />
            </label>
            {filtered && (
              <Button variant="link" onClick={() => { setRole(''); setWho(''); setFrom(''); setTo(''); }}>
                Clear
              </Button>
            )}
          </div>
          {rangeErr && (from.length >= 10 || to.length >= 10) && (
            <p className="field__msg field__msg--error" id="lg-range" role="alert">
              {rangeErr}
            </p>
          )}
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

/**
 * Sign-in security (Jovial, 1 Nov, HC52): how many wrong passwords pause sign-in, for how long, and how soon a code
 * can be sent again. Every GSP sign-in reads it (GSP · Admin's and GSP · Institution's). Edit, then Save.
 */
export function Security({ cfg, change, say }: ConfigProps) {
  const d = useDraft<SecurityCfg>(cfg.security, 'the sign-in rules');
  const v = d.value;
  const c = useCheck({
    max: numError(v.maxAttempts, { what: 'wrong passwords before sign-in pauses', min: 1, max: 20, int: true, required: true }),
    lock: numError(v.lockMinutes, { what: 'minutes sign-in pauses for', min: 1, max: 1440, int: true, required: true }),
    resend: numError(v.resendSeconds, { what: 'seconds before a code can be sent again', min: 5, max: 600, int: true, required: true }),
  });
  const num = (k: keyof SecurityCfg) => (x: string) => d.set((s) => ({ ...s, [k]: x === '' ? ('' as unknown as number) : Number(x) }));
  return (
    <>
      <PageHead title="Sign-in security" lead="How GSP’s sign-in protects accounts. Every GSP portal’s sign-in follows these as soon as they’re saved." />
      <Panel
        title="Sign-in rules"
        note="Wrong passwords in a row pause sign-in for that person; codes sent by email can be sent again after a wait."
        action={
          <EditBar
            editing={d.editing}
            dirty={d.dirty}
            name="sign-in rules"
            onEdit={() => (c.reset(), d.start())}
            onCancel={d.stop}
            onSave={() => {
              if (!c.submit()) return;
              change('Sign-in security', `Sign-in pauses after ${v.maxAttempts} wrong passwords for ${v.lockMinutes} minutes; codes again after ${v.resendSeconds} seconds`, (x) => ({ ...x, security: { maxAttempts: Number(v.maxAttempts), lockMinutes: Number(v.lockMinutes), resendSeconds: Number(v.resendSeconds) } }));
              say('Sign-in rules saved. They apply to the next sign-in.');
              d.stop();
            }}
          />
        }
      >
        <div className="cfg__form">
          <Field id="sec-max" label="Wrong passwords before sign-in pauses" required error={c.err('max')}>
            <TextInput id="sec-max" type="number" inputMode="numeric" disabled={!d.editing} value={String(v.maxAttempts)} onBlur={c.blur('max')} onChange={(e) => num('maxAttempts')(e.target.value)} />
          </Field>
          <Field id="sec-lock" label="Sign-in pauses for (minutes)" required error={c.err('lock')}>
            <TextInput id="sec-lock" type="number" inputMode="numeric" disabled={!d.editing} value={String(v.lockMinutes)} onBlur={c.blur('lock')} onChange={(e) => num('lockMinutes')(e.target.value)} />
          </Field>
          <Field id="sec-resend" label="A code can be sent again after (seconds)" required error={c.err('resend')}>
            <TextInput id="sec-resend" type="number" inputMode="numeric" disabled={!d.editing} value={String(v.resendSeconds)} onBlur={c.blur('resend')} onChange={(e) => num('resendSeconds')(e.target.value)} />
          </Field>
        </div>
      </Panel>
      <History log={cfg.log} area="Sign-in security" />
    </>
  );
}
