// @ts-nocheck -- typed when the mail API is designed.
/**
 * Mail, kept simple (Jovial, 5 Nov). Every mail to gsp.admissions@ is linked to its application (it shows in that
 * application's Mail tab, where the officer reads it) or forwarded to the inbox that handles it. This page is where
 * the rest is handled: mail the system couldn't link (Global Ops links it, T27), and the team mailboxes' own mail.
 * It also shows, for checking, what was linked, forwarded or not kept.
 */
import { adminCfg } from '../admin/data/store';
import { mailboxAccess } from '../admin/data/config';
import { fmtWhen } from '../data/format';
import { useContext, useMemo, useState } from 'react';
import { useStore, update, recordById, queueById } from './store';
import { can, inScope, oversees } from '../finance/access';
import { Button, Select, Empty, toast, fmtAge } from '../finance/kit';
import { PersonaBar, usePersona, HostContext } from './persona';
import { Icon } from '../components/Icon';
import { routeOf, targetOf } from './mailRoute';
import '../finance/finance.css';
import './mail.css';

const VIEWS = [
  ['unlinked', 'To link', 'search'],
  ['boxes', 'Team mailboxes', 'mail'],
  ['linked', 'Linked to an application', 'doc'],
  ['forward', 'Forwarded', 'share'],
  ['drop', 'Not kept', 'folder'],
];
const clean = (s) => s.replace(/^(re|fwd?|fw):\s*/i, '');

export default function Mail() {
  const s = useStore();
  const { user, role } = usePersona();
  if (!can(s.matrix, role.id, 'mail')) {
    return (
      <div className="ipage gspx-fin">
        <PersonaBar />
        <Empty title={`${role.name} doesn’t use the shared mailboxes`}>Access is set in Admin › Permission roles.</Empty>
      </div>
    );
  }
  return <MailBody key={user.id} s={s} user={user} role={role} />;
}

function MailBody({ s, user, role }) {
  const { openRecord } = useContext(HostContext);
  const M = s.mail;
  const [view, setView] = useState('unlinked');
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const boxes = M.mailboxes.filter((b) => oversees(role.id) || b.addresses.some((x) => mailboxAccess(adminCfg(), user.email, x)));
  const seesAdm = boxes.some((b) => b.id === 'mb-adm');
  // every item, threads and the mail filed on arrival, with where it went
  const items = useMemo(() => [
    ...M.threads.map((t) => ({ ...t, isThread: true })),
    ...(M.filed || []).map((f) => ({ ...f, mailbox: f.mailbox || 'mb-adm', messages: [{ id: 'f', from: [f.from, ''], at: f.at, body: '', dir: 'in' }] })),
  ].filter((x) => boxes.some((b) => b.id === x.mailbox)).map((x) => ({ ...x, route: x.mailbox === 'mb-adm' ? routeOf(s, x) : { kind: 'box' } })), [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = q.trim().toLowerCase();
  const visible = (x) => (!x.record || !recordById(s, x.record) || inScope(user, recordById(s, x.record), s.roles)) && (!text || [x.subject, x.org, x.from, x.record].join(' ').toLowerCase().includes(text));
  const byView = Object.fromEntries(VIEWS.map(([k]) => [k, items.filter((x) => (k === 'boxes' ? x.route.kind === 'box' && x.state !== 'done' : x.route.kind === k) && visible(x))]));
  const shown = VIEWS.filter(([k]) => (k === 'boxes' ? boxes.some((b) => b.id !== 'mb-adm') : seesAdm));
  const rows = (byView[view] || []).sort((a, b) => last(b) - last(a));
  const open = rows.find((x) => x.id === sel) || null;

  return (
    <div className="ipage gspx-fin mx">
      <PersonaBar />
      <header className="mx__head">
        <div>
          <h1 className="page__title">Mail</h1>
          <p className="stu__lead">Every mail to gsp.admissions@ is linked to its application, where its officer reads it in the Mail tab, or forwarded. Here is the mail that couldn’t be linked{boxes.some((b) => b.id !== 'mb-adm') ? ', and your team mailboxes' : ''}.</p>
        </div>
        <div className="mx__tools">
          <label className="ssearch mx__search">
            <Icon name="search" size={18} />
            <span className="vh">Search mail</span>
            <input type="search" placeholder="Student, university, RP or subject" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </header>

      {seesAdm && view !== 'boxes' && <Rules s={s} />}

      <div className={`mx__panes ${open ? 'has-open' : ''}`}>
        <nav className="mx__views" aria-label="Mail views">
          {shown.map(([k, label, icon]) => (
            <button key={k} type="button" className={`mx__view ${view === k ? 'is-on' : ''}`} aria-current={view === k ? 'page' : undefined} onClick={() => { setView(k); setSel(null); }}>
              <Icon name={icon} size={18} />
              <span>{label}</span>
              <span className="mx__n num">{byView[k].length}</span>
            </button>
          ))}
        </nav>

        <section className="mx__list" aria-label={(VIEWS.find((v) => v[0] === view) || [])[1]}>
          {!rows.length && <Empty title={{ unlinked: 'Nothing to link', boxes: 'Nothing in your team mailboxes', linked: 'Nothing linked yet', forward: 'Nothing forwarded', drop: 'Nothing set aside' }[view]} />}
          <ul className="mx__rows">
            {rows.map((x) => (
              <li key={x.id} className={`mx__row ${sel === x.id ? 'is-on' : ''}`}>
                <button type="button" className="mx__rowbtn" onClick={() => setSel(x.id)}>
                  <span className="mx__line1"><span className="mx__from">{x.org || x.from}</span><span className="mx__age">{fmtAge(last(x))}</span></span>
                  <span className="mx__subject">{clean(x.subject)}</span>
                  {x.route.text && <span className="mx__summary">{x.route.text}</span>}
                  {x.route.kind === 'box' && <span className="mx__summary">{(M.mailboxes.find((b) => b.id === x.mailbox) || {}).name}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx__read" aria-label="Mail">
          {open ? <Read key={open.id} x={open} s={s} user={user} openRecord={openRecord} onBack={() => setSel(null)} /> : <Empty title="Pick a mail">It opens here.</Empty>}
        </section>
      </div>
    </div>
  );

  function last(x) { return x.messages[x.messages.length - 1].at; }
}

/** The routing rules, in one line each (from Mail's routes). */
function Rules({ s }) {
  const M = s.mail;
  const R = M.routes || {};
  return (
    <section className="mx__rulesbox" aria-label="How gsp.admissions@ mail is routed">
      <p><b>About an application:</b> linked to it, and read in its Mail tab. No task.</p>
      <p><b>Forwarded:</b> {(R.forward || []).map((f) => `${f.name} to the ${(targetOf(M, f.to) || {}).name}`).join('; ')}.</p>
      <p><b>No application found</b> (a student with no application yet, say): {queueById(s, R.unlinked)?.name || 'Global Ops'} links it.</p>
      <p><b>Not kept:</b> {(R.drop || []).map((d) => d.name).join(', ')}.</p>
    </section>
  );
}

function Read({ x, s, user, openRecord, onBack }) {
  const M = s.mail;
  const [link, setLink] = useState('');
  const [fwd, setFwd] = useState('');
  const apps = s.records.filter((r) => r.type === 'Application' && inScope(user, r, s.roles));
  const targets = (M.routes?.forward || []).map((f) => targetOf(M, f.to)).filter(Boolean);
  const set = (fn, log) => update((d) => fn(d.mail.threads.find((t) => t.id === x.id) || (d.mail.filed || []).find((t) => t.id === x.id)), log);
  const doLink = () => {
    const r = recordById(s, link);
    set((t) => { t.record = link; }, `${user.name} linked ${clean(x.subject)} to ${link}`);
    toast(`Linked to ${r?.student || link}. It’s in the application’s Mail tab.`);
  };
  const doForward = () => {
    const t = targetOf(M, fwd);
    set((y) => { y.forwardedTo = fwd; }, `${user.name} forwarded ${clean(x.subject)} to the ${t?.name}`);
    toast(`Forwarded to the ${t?.name}.`);
  };
  const r = x.route.rec;
  return (
    <article className="mx__conv">
      <header className="mx__convhead">
        <button type="button" className="btn btn--link gspx-link mx__back" onClick={onBack}><Icon name="arrowLeft" size={16} /> Mail</button>
        <h2 className="mx__title">{clean(x.subject)}</h2>
        <div className="mx__meta">
          <span className="mx__from">{x.org || x.from}</span>
          {r && (
            <button type="button" className="mx__rec is-link" onClick={() => (r.type === 'Application' && !r.addon ? openRecord?.(r.id) : toast('This application is only in the demo data, not in Applications yet.'))}>
              {r.student} · {r.uni} · {r.id} <Icon name="external" size={12} />
            </button>
          )}
        </div>
      </header>

      {x.route.kind === 'unlinked' ? (
        <section className="mx__ai" aria-label="Link or forward">
          <p className="mx__ailead">No application found for this mail. Link it to one, or forward it.</p>
          <div className="mx__aigrid">
            <div>
              <Select id="mx-link" label="Application" value={link} onChange={setLink} placeholder="Choose an application" options={apps.map((a) => [a.id, `${a.student} · ${a.uni} · ${a.id}`])} />
              <div className="mx__nextacts"><Button kind="primary" disabled={!link} onClick={doLink}>Link</Button></div>
            </div>
            <div>
              <Select id="mx-fwd" label="Or forward to" value={fwd} onChange={setFwd} placeholder="Choose an inbox" options={targets.map((t) => [t.id, t.name])} />
              <div className="mx__nextacts"><Button disabled={!fwd} onClick={doForward}>Forward</Button></div>
            </div>
          </div>
        </section>
      ) : x.route.text ? (
        <p className="gspx-note">{x.route.text}</p>
      ) : null}

      {x.isThread && (
        <section className="mx__thread" aria-label="Messages">
          {x.messages.map((m) => (
            <div key={m.id} className={`mx__msg ${m.dir === 'out' ? 'is-out' : ''}`}>
              <p className="mx__msghead">
                <b>{m.dir === 'out' ? `GSP · ${m.from[0]}` : m.from[0]}</b> <span className="muted">&lt;{m.from[1]}&gt;</span>
                <span className="muted mx__when">{fmtWhen(m.at)}</span>
              </p>
              <pre className="gspx-pre">{m.body}</pre>
              {m.attachments?.length > 0 && <p className="mx__att">{m.attachments.map((a) => <span key={a} className="cfg__chip cfg__chip--plain"><Icon name="attach" size={12} /> {a}</span>)}</p>}
            </div>
          ))}
        </section>
      )}
    </article>
  );
}
