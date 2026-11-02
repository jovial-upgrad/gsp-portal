import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DateInput, Field, TextInput } from '../../components/forms';
import { afterError, dateError, useCheck } from '../../components/validate';
import { EditBar, History, Panel, useDraft } from './parts';
import { CODE_MINUTES, SECURITY_RANGE, type LogEntry, type Security as SecurityCfg } from '../data/config';
import { PageHead, downloadCsv } from '../../institution/records/parts';
import type { ConfigProps } from './ConfigPage';
import { ACCOUNT_EMAILS, SENDER } from '../data/emails';
import { Empty, Loaded, PAGE_SIZE, Pager, Pick, SaveBanner, ViewOnlyNote, istDate, istDay, istTime, trySave, type SaveResult } from './states';

type Kind = 'all' | LogEntry['kind'];
const KINDS: [Kind, string][] = [
  ['all', 'All'],
  ['change', 'Changes'],
  ['download', 'Downloads'],
  ['job', 'Job runs'],
  ['email', 'Emails'],
];
const KIND_WORD: Record<LogEntry['kind'], string> = { change: 'Change', download: 'Download', job: 'Job run', email: 'Email' };

/**
 * Logs (PRD slice 1, Audit; proposal S1C-9): every kind of entry, a tab per kind (All, Changes, Downloads, Job runs,
 * Emails), each with its count. Filters: role, person, from and to dates (IST); search by what or area. Newest
 * first, 50 a page. Kept forever: nobody can edit or delete an entry. Export log is itself logged. Admin sees it;
 * View Only views it. Each settings page also shows its own Change history (the same entries, for that page).
 */
export function Logs({ cfg, canEdit }: ConfigProps) {
  const [kind, setKind] = useState<Kind>('all');
  const [role, setRole] = useState('');
  const [who, setWho] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const t = q.trim().toLowerCase();
  const base = cfg.log.filter((l) => (!role || l.role === role) && (!who || l.who === who) && (!iso(from) || istDay(l.at) >= from) && (!iso(to) || istDay(l.at) <= to) && (!t || l.text.toLowerCase().includes(t) || l.area.toLowerCase().includes(t)));
  const count = (k: Kind) => (k === 'all' ? base.length : base.filter((l) => l.kind === k).length);
  const rows = base.filter((l) => kind === 'all' || l.kind === kind).sort((a, b) => b.at - a.at);
  useEffect(() => setPage(0), [kind, role, who, from, to, q]);
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const rangeErr = dateError(from, { what: 'From date' }) || dateError(to, { what: 'To date' }) || afterError(from, to, 'To date', 'From date');
  const filtered = Boolean(role || who || from || to || q);
  const clear = () => (setRole(''), setWho(''), setFrom(''), setTo(''), setQ(''));
  const what = (l: LogEntry) =>
    l.kind === 'download'
      ? `${l.text} · ${l.size ?? ''} · ${l.format ?? 'CSV'}${l.filters && l.filters !== 'None' ? ` · filters: ${l.filters}` : ''}`
      : l.kind === 'job'
        ? `${l.text}: ${l.checked ?? 0} checked, ${l.changed ?? 0} changed, ${l.sent ?? 0} emails${l.end ? `, ${istTime(l.at)} to ${istTime(l.end)}` : ''}${l.error ? `. Error: ${l.error}` : ''}`
        : l.kind === 'email'
          ? `${l.text} to ${l.to} · ${l.record} · ${l.delivered === false ? 'Bounced' : 'Delivered'} · SES ${l.ses}`
          : l.text;
  return (
    <>
      <PageHead title="Logs" lead="Every change, download, daily job run and email, kept forever. Nobody can edit or delete an entry. Times are IST.">
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={() => {
            // the export is itself logged, as a download
            downloadCsv('gsp-log.csv', [['Kind', 'Date', 'Time (IST)', 'Who', 'Role', 'Area', 'What'], ...rows.map((l) => [KIND_WORD[l.kind], istDate(l.at), istTime(l.at), l.who, l.role ?? '', l.area, what(l)])]);
          }}
        >
          Export log
        </Button>
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      <Loaded page="logs" cols={6}>
        <div className="cfg__tabs" role="group" aria-label="Kind of entry">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" className="ichip" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {label} <span className="num">{count(k)}</span>
            </button>
          ))}
        </div>
        <section className="card stable" aria-labelledby="lg-count">
          <div className="stools">
            <div className="stools__row">
              <label className="ssearch">
                <Icon name="search" size={18} />
                <span className="vh">Search the log</span>
                <input id="lg-q" type="search" placeholder="Search by what or area" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <Pick id="lg-role" label="Role" value={role} empty="All roles" options={[...new Set(cfg.log.map((l) => l.role ?? ''))].filter(Boolean).sort()} onChange={setRole} />
              <Pick id="lg-who" label="Person" value={who} empty="Everyone" options={[...new Set(cfg.log.map((l) => l.who))].sort()} onChange={setWho} />
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
              <span className="num">{rows.length}</span> entries
            </p>
          </div>
          {!rows.length ? (
            <Empty>Nothing logged for these filters.</Empty>
          ) : (
            <div className="stab-wrap">
              <table className="itab cfg__tab">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    {kind === 'all' && <th scope="col">Kind</th>}
                    <th scope="col">Who</th>
                    <th scope="col">Role</th>
                    <th scope="col">Area</th>
                    <th scope="col">What</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id}>
                      <td className="num cfg__nowrap">
                        {istDate(l.at)}
                        <span className="cfg__sub">{istTime(l.at)}</span>
                      </td>
                      {kind === 'all' && <td className="cfg__muted">{KIND_WORD[l.kind]}</td>}
                      <td className="cfg__strong">{l.who}</td>
                      <td>{l.role ?? '–'}</td>
                      <td className="cfg__muted">{l.area}</td>
                      <td className={l.error || l.delivered === false ? 'cfg__warn' : undefined}>{what(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager total={rows.length} page={page} setPage={setPage} thing="Log" />
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
 * sign-in, so a change applies from the next sign-in. Read only until Edit; Save or Cancel. The code lifetime is
 * engineering's and not editable. There is no single sign-on (S1-5). The four account emails are shown below.
 */
export function Security({ cfg, change, say, canEdit }: ConfigProps) {
  const d = useDraft<SecurityCfg>(cfg.security, 'the sign-in rules');
  const [result, setResult] = useState<SaveResult | null>(null);
  const v = d.value;
  const err = (k: keyof SecurityCfg) => {
    const [lo, hi] = SECURITY_RANGE[k];
    const n = Number(v[k]);
    return (v[k] as unknown) === '' || !Number.isInteger(n) || n < lo || n > hi ? `Enter a whole number from ${lo} to ${hi}.` : null;
  };
  const c = useCheck({ maxAttempts: err('maxAttempts'), lockMinutes: err('lockMinutes'), resendSeconds: err('resendSeconds') });
  const set = (k: keyof SecurityCfg) => (x: string) => d.set((s) => ({ ...s, [k]: x === '' ? ('' as unknown as number) : Number(x.replace(/[^\d]/g, '')) }));
  return (
    <>
      <PageHead title="Sign-in security" lead="How sign-in protects accounts, in both portals. Both read these at every sign-in, so a change applies from the next sign-in. There is no single sign-on: GSP people sign in with their email and password.">
        {canEdit && (
          <EditBar
            editing={d.editing}
            dirty={d.dirty}
            name="sign-in security"
            onEdit={() => (c.reset(), d.start())}
            onCancel={() => (setResult(null), d.stop())}
            onSave={() => {
              if (!c.submit()) return;
              const r = trySave();
              if (r !== 'ok') return setResult(r);
              const diffs = SEC.filter(([k]) => cfg.security[k] !== Number(v[k])).map(([k, label, unit]) => `${label} ${cfg.security[k]} → ${v[k]} ${unit}`);
              change('Sign-in security', diffs.join('; ') || 'No changes', (x) => ({ ...x, security: { maxAttempts: Number(v.maxAttempts), lockMinutes: Number(v.lockMinutes), resendSeconds: Number(v.resendSeconds) } }));
              say('Saved.');
              setResult(null);
              d.stop();
            }}
          />
        )}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      {d.editing && <SaveBanner result={result} onReload={d.stop} />}
      <Loaded page="sign-in security" cols={4}>
        <Panel flush>
          <div className="stab-wrap">
            <table className="itab cfg__tab">
              <thead>
                <tr>
                  <th scope="col">Setting</th>
                  <th scope="col">Value</th>
                  <th scope="col">Allowed</th>
                </tr>
              </thead>
              <tbody>
                {SEC.map(([k, label, unit]) => (
                  <tr key={k}>
                    <td className="cfg__strong">{label}</td>
                    <td>
                      {d.editing ? (
                        <Field id={`sec-${k}`} label={`${label}, in ${unit}`} error={c.err(k)} className="cfg__cellfield">
                          <TextInput id={`sec-${k}`} inputMode="numeric" className="cfg__cellinput cfg__num" value={String(v[k])} invalid={!!c.err(k)} onBlur={c.blur(k)} onChange={(e) => set(k)(e.target.value)} />
                        </Field>
                      ) : (
                        <span className="num">
                          {cfg.security[k]} {unit}
                        </span>
                      )}
                    </td>
                    <td className="cfg__muted num">
                      {SECURITY_RANGE[k][0]} to {SECURITY_RANGE[k][1]} {unit}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="cfg__strong">Code lifetime</td>
                  <td className="num">{CODE_MINUTES} minutes</td>
                  <td className="cfg__muted">Not editable (set by engineering). A code works once.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
        <AccountEmails />
      </Loaded>
      <History log={cfg.log} area="Sign-in security" />
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
