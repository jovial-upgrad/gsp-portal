import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DateInput } from '../../components/forms';
import { afterError, dateError } from '../../components/validate';
import { Panel } from './parts';
import { CODE_MINUTES, type LogEntry, type Security as SecurityCfg } from '../data/config';
import { PageHead, downloadCsv } from '../../institution/records/parts';
import type { ConfigProps } from './ConfigPage';
import { ACCOUNT_EMAILS, SENDER } from '../data/emails';
import { Empty, Loaded, Pager, usePaged, Pick, ViewOnlyNote, istDate, istDay, istTime } from './states';

/**
 * Logs (Jovial, S1C-9): the download log only, for now. Every CSV or export downloaded anywhere, with who, their
 * role, the page, the filters applied and the rows. Filters: role, person, from and to dates (IST); search by page
 * or filters. Newest first, 50 a page. Kept forever: nobody can edit or delete an entry. Export log is itself logged.
 * Admin sees it; View Only views it. Settings changes stay on each settings page's own Change history.
 */
export function Logs({ cfg, canEdit }: ConfigProps) {
  const [role, setRole] = useState('');
  const [who, setWho] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const t = q.trim().toLowerCase();
  const downloads = cfg.log.filter((l) => l.kind === 'download');
  const rows = downloads
    .filter((l) => (!role || l.role === role) && (!who || l.who === who) && (!iso(from) || istDay(l.at) >= from) && (!iso(to) || istDay(l.at) <= to) && (!t || [l.text, l.area, l.filters ?? ''].some((x) => x.toLowerCase().includes(t))))
    .sort((a, b) => b.at - a.at);
  const { shown, pager } = usePaged(rows, [role, who, from, to, q]);
  const rangeErr = dateError(from, { what: 'From date' }) || dateError(to, { what: 'To date' }) || afterError(from, to, 'To date', 'From date');
  const filtered = Boolean(role || who || from || to || q);
  const clear = () => (setRole(''), setWho(''), setFrom(''), setTo(''), setQ(''));
  const what = (l: LogEntry) => `${l.area === l.text ? l.text : `${l.area} · ${l.text}`}${l.format ? ` (${l.format})` : ''}`;
  return (
    <>
      <PageHead title="Logs" lead="Every download from the portal, kept forever: who downloaded what, with which filters. Nobody can edit or delete an entry. Times are IST.">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            // the export is itself logged, as a download
            downloadCsv('gsp-download-log.csv', [['Date', 'Time (IST)', 'Name', 'Role', 'Download', 'Filters applied', 'Rows'], ...rows.map((l) => [istDate(l.at), istTime(l.at), l.who, l.role ?? '', what(l), l.filters ?? '', l.size ?? ''])]);
          }}
        >
          Export log
        </Button>
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      <Loaded page="logs" cols={6}>
        <section className="card stable" aria-labelledby="lg-count">
          <div className="stools">
            <div className="stools__row">
              <label className="ssearch">
                <Icon name="search" size={18} />
                <span className="vh">Search the download log</span>
                <input id="lg-q" type="search" placeholder="Search by page or filters" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <Pick id="lg-role" label="Role" value={role} empty="All roles" options={[...new Set(downloads.map((l) => l.role ?? ''))].filter(Boolean).sort()} onChange={setRole} />
              <Pick id="lg-who" label="Person" value={who} empty="Everyone" options={[...new Set(downloads.map((l) => l.who))].sort()} onChange={setWho} />
              <label className="cfg__date">
                <span>From</span>
                <DateInput id="lg-from" value={from} invalid={!!rangeErr && !!from} aria-describedby={rangeErr ? 'lg-range' : undefined} onChange={setFrom} />
              </label>
              <label className="cfg__date">
                <span>To</span>
                <DateInput id="lg-to" value={to} invalid={!!rangeErr && !!to} aria-describedby={rangeErr ? 'lg-range' : undefined} onChange={setTo} />
              </label>
              {filtered && (
                <Button variant="link" onClick={clear}>
                  Clear filters
                </Button>
              )}
            </div>
            {rangeErr && (from.length >= 10 || to.length >= 10) && (
              <p className="field__msg field__msg--error" id="lg-range" role="alert">
                {rangeErr}
              </p>
            )}
            <p className="stools__count" id="lg-count" role="status">
              <span className="num">{rows.length}</span> downloads
            </p>
          </div>
          {!rows.length ? (
            <Empty>No downloads for these filters.</Empty>
          ) : (
            <div className="stab-wrap">
              <table className="itab cfg__tab">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Time</th>
                    <th scope="col">Name</th>
                    <th scope="col">Role</th>
                    <th scope="col">Download</th>
                    <th scope="col">Filters applied</th>
                    <th scope="col">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id}>
                      <td className="num cfg__nowrap">{istDate(l.at)}</td>
                      <td className="num cfg__nowrap cfg__muted">{istTime(l.at)}</td>
                      <td className="cfg__strong">{l.who}</td>
                      <td>{l.role ?? '–'}</td>
                      <td>{what(l)}</td>
                      <td className="cfg__muted">{l.filters ?? '–'}</td>
                      <td className="num cfg__nowrap">{l.size ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager {...pager} thing="Log" />
        </section>
      </Loaded>
    </>
  );
}

const SEC: [keyof SecurityCfg, string, string][] = [
  ['maxAttempts', 'Wrong passwords before sign-in pauses', 'tries'],
  ['lockMinutes', 'Sign-in pauses for', 'minutes'],
  ['resendSeconds', 'A code can be sent again after', 'seconds'],
];

/**
 * Sign-in security (PRD slice 1; Admin › Other configurations › Sign-in security): both portals read these at every
 * sign-in. Pre-decided values, not configurable in Admin (Jovial, S1C-11): shown read only, from SECURITY in
 * admin/data/config.ts. The code lifetime is engineering's. There is no single sign-on (S1-5). The four account
 * emails are shown below.
 */
export function Security({ cfg }: ConfigProps) {
  return (
    <>
      <PageHead title="Sign-in security" lead="How sign-in protects accounts, in both portals. These are decided values and can’t be changed here. There is no single sign-on: GSP people sign in with their email and password." />
      <Loaded page="sign-in security" cols={2}>
        <Panel flush>
          <div className="stab-wrap">
            <table className="itab cfg__tab">
              <thead>
                <tr>
                  <th scope="col">Setting</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {SEC.map(([k, label, unit]) => (
                  <tr key={k}>
                    <td className="cfg__strong">{label}</td>
                    <td>
                      <span className="num">
                        {cfg.security[k]} {unit}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="cfg__strong">Code lifetime</td>
                  <td>
                    <span className="num">{CODE_MINUTES} minutes</span>
                    <span className="cfg__sub">A code works once.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
        <AccountEmails />
      </Loaded>
    </>
  );
}

/** The four account emails (PRD slice 1, Emails this slice sends): drafts, for Jovial to approve the wording. */
function AccountEmails() {
  return (
    <Panel
      title="Account emails"
      note={`The system’s own account emails, in both portals. Sender: ${SENDER}, with no Reply-to. They can’t be turned off, because sign-in doesn’t work without them, and have no Email preferences link. English only; times are IST.`}
    >
      <div className="cfg__emailtpl">
        {ACCOUNT_EMAILS.map((e) => (
          <article key={e.id}>
            <h3>{e.name}</h3>
            <p className="cfg__muted">Sent when: {e.when}</p>
            <p>
              <span className="cfg__muted">Subject:</span> {e.subject}
            </p>
            <p className="cfg__mailbody">{e.body}</p>
            <p className="cfg__muted">Please don’t reply to this email.</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
