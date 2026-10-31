// @ts-nocheck -- typed when the mail API is designed.
/**
 * Mail, rethought (Jovial, 31 Oct). The shared Gmail mailboxes as a work surface, not a list of emails:
 *  - one row per **conversation** (Gmail thread), not per email; replies and duplicates fold in;
 *  - every conversation is already **linked to its application** (with how sure, and why) and **owned** by that
 *    application's officer; no case numbers to assign by hand;
 *  - each has a **state**: Needs you, Check the match, Waiting on the university/RP (with a timer), Done;
 *  - an **AI summary**, what was read from it, and **one suggested next step** to confirm;
 *  - a reply drafted in context, sent as the mailbox, after which the conversation waits with a timer;
 *  - noise (GSP's own notifications, newsletters, one-time codes, acknowledgements, bounces) is **filed on its own**.
 * Three panes on a wide screen (views, conversations, the conversation); one at a time on a phone.
 * Keys: j / k next and previous, e done, r reply.
 */
import { regionQueueId } from './seed';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, update, recordById, nameOf, queueById } from './store';
import { can, inScope } from '../finance/access';
import { Button, Select, Pill, Empty, toast, fmtAge } from '../finance/kit';
import { askDiscard } from '../components/unsaved';
import { PersonaBar, usePersona, HostContext } from './persona';
import { Icon } from '../components/Icon';
import '../finance/finance.css';
import './mail.css';
import { setLiveStatus } from '../data/live';

const OVERSIGHT = ['admission-ops', 'admin', 'view-only'];
const regionQueue = regionQueueId;
const ACT = { status: 'Change the status', task: 'Raise a task', chat: 'Answer in the RP chat', finance: 'Send to Finance', reply: 'Reply to the university', file: 'Just file it' };
const VIEWS = [
  ['needs', 'Needs you', 'bell'],
  ['match', 'Check the match', 'search'],
  ['waiting', 'Waiting on others', 'clock'],
  ['done', 'Done', 'checkCircle'],
  ['filed', 'Filed automatically', 'folder'],
];
const SENDER_TONE = { University: 'is-uni', RP: 'is-rp', Vendor: 'is-vendor', Person: 'is-person' };
const clean = (s) => s.replace(/^(re|fwd?|fw):\s*/i, '');
const day = 864e5;

export function confOf(s, conf) {
  const t = s.mail.settings;
  return conf >= t.autoFile ? ['Sure', 'dpill--verified'] : conf >= t.suggest ? ['Check', 'dpill--checking'] : ['Not sure', 'dpill--bad'];
}

/** The SLA of a conversation: when it needs you by, or how long the other side has. */
function clock(t) {
  const last = t.messages[t.messages.length - 1];
  if (t.state === 'waiting' && t.due) {
    const d = Math.round((t.due - Date.now()) / day);
    return d < 0 ? [`${t.waitingOn} late by ${-d} day${d === -1 ? '' : 's'}`, 'bad'] : [`${t.waitingOn} has ${d || 'under 1'} day${d === 1 ? '' : 's'}`, 'wait'];
  }
  if (t.state === 'done') return ['Done', 'done'];
  const due = last.at + (t.sla || 1) * day;
  const h = Math.round((due - Date.now()) / 36e5);
  return h < 0 ? [`Late by ${Math.ceil(-h / 24)} day${Math.ceil(-h / 24) === 1 ? '' : 's'}`, 'bad'] : h < 8 ? [`Due in ${Math.max(1, h)} h`, 'soon'] : [`Due in ${Math.ceil(h / 24)} day${Math.ceil(h / 24) === 1 ? '' : 's'}`, 'ok'];
}

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
  const [view, setView] = useState('needs');
  const [who, setWho] = useState('mine');
  const [box, setBox] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [picked, setPicked] = useState([]);
  const listRef = useRef(null);
  const M = s.mail;
  const boxes = M.mailboxes.filter((b) => OVERSIGHT.includes(role.id) || b.see.includes(role.id));
  const recOf = (t) => (t.record ? recordById(s, t.record) : null);
  // the mailbox's queue: Unmatched mail for admissions mailboxes, Finance for Commission, and so on
  const boxQueue = (t) => queueById(s, t.record ? regionQueue(recOf(t)?.region) : (M.mailboxes.find((b) => b.id === t.mailbox) || {}).queue);
  const ownerOf = (t) => t.assignee || recOf(t)?.officer || boxQueue(t)?.leader || null;
  const mine = (t) => ownerOf(t) === user.id || (!t.assignee && !recOf(t)?.officer && (boxQueue(t)?.members || []).includes(user.id));
  const inView = (t) => boxes.some((b) => b.id === t.mailbox) && (!box || t.mailbox === box) && (!recOf(t) || inScope(user, recOf(t), s.roles));
  const all = M.threads.filter(inView);
  const scoped = who === 'mine' ? all.filter(mine) : all;
  const text = q.trim().toLowerCase();
  const match = (t) => !text || [t.subject, t.org, t.summary, recOf(t)?.student, t.record].join(' ').toLowerCase().includes(text);
  const byView = {
    needs: scoped.filter((t) => t.state === 'needs' && (t.conf ?? 0) >= M.settings.suggest),
    match: scoped.filter((t) => t.state === 'match' || (t.state === 'needs' && (t.conf ?? 0) < M.settings.suggest)),
    waiting: scoped.filter((t) => t.state === 'waiting'),
    done: scoped.filter((t) => t.state === 'done'),
  };
  const filed = (M.filed || []).filter((f) => boxes.some((b) => b.id === (f.mailbox || 'mb-adm')) && (!text || (f.subject + f.from).toLowerCase().includes(text)));
  const rows = view === 'filed' ? [] : (byView[view] || []).filter(match).sort((a, b) => (view === 'needs' ? clockSort(a) - clockSort(b) : last(b) - last(a)));
  const open = M.threads.find((t) => t.id === sel) || null;
  // on a wide screen the first conversation opens on its own; on a phone the list comes first
  useEffect(() => { if (view !== 'filed' && (!open || !rows.some((r) => r.id === open.id)) && window.innerWidth > 760) setSel(rows[0]?.id ?? null); }, [view, who, box]); // eslint-disable-line react-hooks/exhaustive-deps

  // j / k / e / r
  useEffect(() => {
    const key = (e) => {
      if (/input|textarea|select/i.test(e.target.tagName)) return;
      const i = rows.findIndex((r) => r.id === sel);
      if (e.key === 'j' && rows[i + 1]) setSel(rows[i + 1].id);
      if (e.key === 'k' && rows[i - 1]) setSel(rows[i - 1].id);
      if (e.key === 'e' && open && open.state !== 'done') markDone([open.id], 'Marked done.');
      if (e.key === 'r' && open) document.getElementById('mx-reply')?.focus();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });

  const markDone = (ids, outcome) => {
    // reversible (QC, 1 Nov): no question first; Undo in the notification puts each back as it was
    const was = M.threads.filter((t) => ids.includes(t.id)).map((t) => ({ id: t.id, state: t.state, doneBy: t.doneBy, doneAt: t.doneAt, outcome: t.outcome }));
    update((d) => d.mail.threads.forEach((t) => { if (ids.includes(t.id)) { t.state = 'done'; t.doneBy = user.id; t.doneAt = Date.now(); t.outcome = t.outcome || outcome; } }), `${user.name} marked ${ids.length} conversation${ids.length === 1 ? '' : 's'} done`);
    setPicked([]);
    toast(ids.length === 1 ? 'Conversation done' : `${ids.length} conversations done`, {
      undo: () => update((d) => was.forEach((w) => { const t = d.mail.threads.find((x) => x.id === w.id); if (t) Object.assign(t, w); }), `${user.name} undid marking ${ids.length} conversation${ids.length === 1 ? '' : 's'} done`),
    });
  };
  const counts = { needs: byView.needs.length, match: byView.match.length, waiting: byView.waiting.length, done: byView.done.length, filed: filed.length };
  const late = byView.needs.filter((t) => clock(t)[1] === 'bad').length;

  return (
    <div className="ipage gspx-fin mx">
      <PersonaBar />
      <header className="mx__head">
        <div>
          <h1 className="page__title">Mail</h1>
          <p className="stu__lead">Conversations from the shared mailboxes, already linked to their application and read. {late ? <b>{late} late.</b> : 'Nothing late.'}</p>
        </div>
        <div className="mx__tools">
          <label className="ssearch mx__search">
            <Icon name="search" size={18} />
            <span className="vh">Search mail</span>
            <input type="search" placeholder="Student, university, RP or subject" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <Select id="mx-box" label="Mailbox" hideLabel value={box} onChange={setBox} placeholder="All my mailboxes" options={boxes.map((b) => [b.id, b.name])} />
        </div>
      </header>

      <div className={`mx__panes ${open ? 'has-open' : ''}`}>
        <nav className="mx__views" aria-label="Mail views">
          {VIEWS.map(([k, label, icon]) => (
            <button key={k} type="button" className={`mx__view ${view === k ? 'is-on' : ''}`} aria-current={view === k ? 'page' : undefined} onClick={() => { setView(k); setPicked([]); }}>
              <Icon name={icon} size={18} />
              <span>{label}</span>
              <span className="mx__n num">{counts[k]}</span>
            </button>
          ))}
          <div className="mx__whose" role="group" aria-label="Whose">
            {[['mine', 'Mine'], ['all', 'Everyone I can see']].map(([k, l]) => (
              <button key={k} type="button" className="ichip" aria-pressed={who === k} onClick={() => setWho(k)}>{l}</button>
            ))}
          </div>
          <p className="mx__hint muted">Keys: j and k to move, e for done, r to reply.</p>
        </nav>

        {view === 'filed' ? (
          <Filed s={s} filed={filed} />
        ) : (
          <section className="mx__list" aria-label={VIEWS.find((v) => v[0] === view)[1]} ref={listRef}>
            {picked.length > 0 && (
              <div className="mx__bulk">
                <span><b className="num">{picked.length}</b> picked</span>
                <Button size="sm" onClick={() => markDone(picked, 'Marked done in bulk.')}>Mark done</Button>
                <button type="button" className="btn btn--link gspx-link" onClick={() => setPicked([])}>Clear</button>
              </div>
            )}
            {!rows.length && <Empty title={{ needs: 'Nothing needs you', match: 'Every conversation is matched', waiting: 'Nobody owes you a reply', done: 'Nothing done yet' }[view]}>{view === 'needs' && who === 'mine' ? 'Switch to “Everyone I can see” for the rest of your regions.' : ''}</Empty>}
            <ul className="mx__rows">
              {rows.map((t) => {
                const r = recOf(t);
                const [ct, ctone] = clock(t);
                const owner = ownerOf(t);
                const lastMsg = t.messages[t.messages.length - 1];
                return (
                  <li key={t.id} className={`mx__row ${sel === t.id ? 'is-on' : ''} ${t.unread === false ? '' : 'is-new'}`}>
                    <input type="checkbox" aria-label={`Pick ${clean(t.subject)}`} checked={picked.includes(t.id)} onChange={(e) => setPicked((l) => (e.target.checked ? [...l, t.id] : l.filter((x) => x !== t.id)))} />
                    <button type="button" className="mx__rowbtn" onClick={() => setSel(t.id)}>
                      <span className="mx__line1">
                        <span className={`mx__from ${SENDER_TONE[t.sender] || ''}`}>{t.org}</span>
                        {t.messages.length > 1 && <span className="mx__count num">{t.messages.length}</span>}
                        {t.attachments > 0 && <Icon name="attach" size={14} />}
                        <span className={`mx__clock is-${ctone}`}>{ct}</span>
                      </span>
                      <span className="mx__subject">{clean(t.subject)}</span>
                      <span className="mx__summary">{t.summary}</span>
                      <span className="mx__line3">
                        {r ? <span className="mx__rec">{r.student} · {r.id}</span> : <span className="mx__rec is-none">No application yet</span>}
                        <span className="mx__intent">{(M.intents.find((i) => i.id === t.intent) || {}).name}</span>
                        <span className="mx__owner" title={owner ? `Owner: ${nameOf(s, owner)}` : 'Unassigned'}>{owner ? nameOf(s, owner) : 'Unassigned'}</span>
                        <span className="mx__age">{fmtAge(lastMsg.at)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {view !== 'filed' && (
          <section className="mx__read" aria-label="Conversation">
            {open ? <Conversation key={open.id} t={open} s={s} user={user} role={role} ownerOf={ownerOf} openRecord={openRecord} onBack={() => setSel(null)} onDone={(o) => markDone([open.id], o)} /> : <Empty title="Pick a conversation">It opens here, with what the system read and the next step.</Empty>}
          </section>
        )}
      </div>
    </div>
  );

  function last(t) { return t.messages[t.messages.length - 1].at; }
  function clockSort(t) { return last(t) + (t.sla || 1) * day; }
}

function Conversation({ t, s, user, role, ownerOf, openRecord, onBack, onDone }) {
  const M = s.mail;
  const [intentId, setIntent] = useState(t.intent);
  const [link, setLink] = useState(t.record || '');
  const [reply, setReply] = useState(null);
  const [showOld, setShowOld] = useState(false);
  const canAct = can(s.matrix, role.id, 'mail', 'U');
  const rule = M.intents.find((i) => i.id === intentId) || {};
  const r = link ? recordById(s, link) : null;
  const mb = M.mailboxes.find((b) => b.id === t.mailbox) || {};
  const [ct, ctone] = confOf(s, t.conf ?? 0);
  const apps = s.records.filter((x) => x.type === 'Application' && inScope(user, x, s.roles));
  const cands = (t.candidates || []).map((id) => recordById(s, id)).filter(Boolean);
  const owner = ownerOf(t);
  const people = s.users.filter((u) => ['admission', 'admission-ops', 'finance', 'recruitment-ops'].includes(u.role));
  const canSend = mb.sendAs?.includes(role.id) || role.id === 'admin';
  const dupes = t.messages.filter((m, i) => i > 0 && m.body === t.messages[i - 1].body).length;
  const shown = t.messages.filter((m, i) => !(i > 0 && m.body === t.messages[i - 1].body));
  const older = shown.length > 2 && !showOld ? shown.slice(0, -2) : [];
  const recent = older.length ? shown.slice(-2) : shown;
  const lastIn = [...t.messages].reverse().find((m) => m.dir !== 'out');
  // who the reply goes to: the university when passing on the RP's answer, otherwise whoever wrote last
  const uniMsg = t.messages.find((m) => m.dir !== 'out' && m.from[1] !== lastIn?.from[1]);
  const toMsg = rule.act === 'reply' && uniMsg ? uniMsg : lastIn;
  const to = { name: toMsg?.from[0] ?? '', addr: toMsg?.from[1] ?? '', side: rule.act === 'reply' ? 'University' : t.sender === 'RP' ? 'RP' : 'University' };
  const draft = t.draft || `Dear ${(lastIn?.from[0] || '').split(' (')[0]},\n\nThank you. ${rule.id === 'info' ? 'We’ll send what you asked for shortly.' : 'We’ve noted this on the application.'}\n\nKind regards,\n${user.name}\nGSP Admissions`;

  const set = (fn, log) => update((d) => fn(d.mail.threads.find((x) => x.id === t.id), d), log);
  const finish = (outcome, extra) => {
    set((x, d) => {
      x.state = 'done'; x.doneBy = user.id; x.doneAt = Date.now(); x.outcome = outcome; x.record = link || null; x.intent = intentId;
      const task = d.tasks.find((y) => y.id === 'T-' + t.id);
      if (task) { task.status = 'done'; task.doneBy = user.id; task.doneAt = Date.now(); }
      extra && extra(d);
    }, `${user.name}: ${clean(t.subject)} → ${outcome}`);
  };
  const confirm = () => {
    if (!r && ['status', 'task', 'chat', 'reply'].includes(rule.act)) { toast('Link the conversation to an application first.'); return; }
    const name = r ? r.student || r.label : '';
    if (rule.act === 'status') {
      finish(`Status moved to “${rule.status}”${rule.attach && t.attachments ? `; ${rule.attach} added to Documents` : ''}.`, (d) => { const x = d.records.find((y) => y.id === r.id); x.status = rule.status; x.since = Date.now(); });
      // the application itself, in every role (data/live.ts)
      if (rule.key) setLiveStatus(r.id, { status: rule.key, at: Date.now(), by: user.name, end: rule.end, note: rule.status });
      toast(`${name}: status moved to “${rule.status}”.`);
    } else if (rule.act === 'task' || rule.act === 'finance') {
      const qid = rule.act === 'finance' ? 'q-finance' : queueById(s, regionQueue(r.region)) ? regionQueue(r.region) : 'q-adm-ops';
      const what = t.fields['Asked for'] ? `Get from the RP: ${t.fields['Asked for']}` : rule.act === 'finance' ? `Match ${t.uni || 'the'} remittance${t.fields.Amount ? ` (${t.fields.Amount})` : ''}` : rule.name;
      const title = rule.act === 'finance' ? what : `${what} – ${name}`;
      finish(`Task raised in ${(queueById(s, qid) || {}).name}: ${title}.`, (d) => {
        d.tasks.unshift({ id: 'T-M' + t.id + '-' + Date.now().toString(36), record: r ? r.id : 'cm-payout', kind: rule.kind || 'k-uni-mail', queue: qid, rule: null, title, note: `From mail: ${clean(t.subject)}`, created: Date.now(), status: 'open', assignee: r?.officer || null, slaDays: rule.sla });
      });
      toast(`Task raised${r?.officer ? ` for ${nameOf(s, r.officer)}` : ''}, with a ${rule.sla || 1}-working-day SLA. It’s in My work.`);
    } else if (rule.act === 'chat') {
      setReply(draft); toast('Answer below: it goes to the application’s chat with the RP, and the RP is asked to use the portal next time.');
      return;
    } else if (rule.act === 'reply') {
      setReply(draft); return;
    } else { finish('Filed on the application.'); toast('Filed.'); }
  };
  const relink = () => set((x, d) => {
    x.record = link; x.conf = 100; x.reasons = [`Linked by ${user.name}`]; x.state = 'needs';
    const task = d.tasks.find((y) => y.id === 'T-' + t.id); if (task) { task.status = 'done'; task.doneBy = user.id; task.doneAt = Date.now(); }
  }, `${user.name} linked ${clean(t.subject)} to ${link}`) || toast('Linked. Next time this sender writes, it’s matched on its own.');
  const send = () => {
    const toChat = rule.act === 'chat';
    set((x) => {
      x.messages.push({ id: 'o' + Date.now(), from: [user.name, mb.addresses[0]], to: to.addr, at: Date.now(), body: reply, dir: 'out', attachments: [], via: toChat ? 'chat' : 'mail' });
      x.state = toChat ? 'done' : 'waiting'; x.waitingOn = to.side; x.due = Date.now() + (M.settings.waitDays || 3) * day;
      if (toChat) { x.outcome = 'Answered in the application’s chat with the RP.'; x.doneBy = user.id; x.doneAt = Date.now(); }
    }, `${user.name} replied to ${clean(t.subject)}${toChat ? ' in the RP chat' : ` as ${mb.addresses[0]}`}`);
    toast(toChat ? 'Sent in the application’s chat. Done.' : `Sent to ${to.name} as ${mb.addresses[0]}. Waiting on the ${to.side === 'RP' ? 'RP' : 'university'}: ${M.settings.waitDays || 3} days before it comes back to you.`);
    setReply(null);
  };

  return (
    <article className="mx__conv">
      <header className="mx__convhead">
        <button type="button" className="btn btn--link gspx-link mx__back" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Conversations
        </button>
        <h2 className="mx__title">{clean(t.subject)}</h2>
        <div className="mx__meta">
          <span className={`mx__from ${SENDER_TONE[t.sender] || ''}`}>{t.org}</span>
          <span className="muted">to {mb.name}</span>
          {r ? (
            <button type="button" className="mx__rec is-link" onClick={() => (r.type === 'Application' && !r.addon ? openRecord?.(r.id) : toast('This application is only in the demo data, not in Applications yet.'))}>
              {r.student} · {r.uni} · {r.id} <Icon name="external" size={12} />
            </button>
          ) : (
            <span className="mx__rec is-none">No application yet</span>
          )}
          {canAct && t.state !== 'done' ? (
            <Select id="mx-owner" label="Owner" hideLabel value={owner || ''} placeholder="Unassigned" onChange={(v) => set((x) => { x.assignee = v; }, `${user.name} gave ${clean(t.subject)} to ${nameOf(s, v)}`)} options={people.map((u) => [u.id, u.name])} />
          ) : (
            <span className="muted">{owner ? nameOf(s, owner) : 'Unassigned'}</span>
          )}
        </div>
      </header>

      {t.state !== 'done' ? (
        <section className="mx__ai" aria-label="What the system read">
          <p className="mx__ailead">
            <Icon name="star" size={16} /> {t.summary}
          </p>
          <div className="mx__aigrid">
            <div>
              <p className="mx__k">What it is</p>
              {canAct ? <Select id="mx-int" label="What it is" hideLabel value={intentId} onChange={setIntent} options={M.intents.map((i) => [i.id, i.name])} /> : <p>{rule.name}</p>}
            </div>
            <div>
              <p className="mx__k">Linked to <Pill tone={ctone}>{ct} · {t.conf}%</Pill></p>
              {canAct ? (
                <Select id="mx-link" label="Linked to" hideLabel value={link} onChange={setLink} placeholder="Choose an application" options={[...cands, ...apps.filter((a) => !cands.includes(a))].map((a) => [a.id, `${a.student} · ${a.uni} · ${a.id}`])} />
              ) : (
                <p>{r ? `${r.student} · ${r.id}` : 'Not linked'}</p>
              )}
              <ul className="mx__why">{t.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            {Object.keys(t.fields).length > 0 && (
              <div className="mx__fields">
                <p className="mx__k">Read from the conversation</p>
                <dl>{Object.entries(t.fields).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              </div>
            )}
          </div>
          {canAct && (
            <div className="mx__next">
              <p><span className="mx__k">Next step</span> {rule.text}</p>
              <div className="mx__nextacts">
                {link !== (t.record || '') ? (
                  <Button kind="primary" disabled={!link} onClick={relink}>Save the link</Button>
                ) : (
                  <Button kind="primary" onClick={confirm}>{rule.act === 'reply' || rule.act === 'chat' ? 'Write the reply' : `Confirm: ${ACT[rule.act]?.toLowerCase()}`}</Button>
                )}
                {canSend && rule.act !== 'reply' && rule.act !== 'chat' && <Button onClick={() => setReply(reply == null ? draft : null)}>Reply</Button>}
                <button type="button" className="btn btn--link gspx-link" onClick={() => onDone('Nothing needed: done.')}>Nothing needed</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <p className="gspx-note">Done{t.doneBy ? ` by ${nameOf(s, t.doneBy)}` : ''}: {t.outcome}</p>
      )}

      {reply != null && (
        <section className="mx__compose" aria-label="Reply">
          <p className="mx__k">{rule.act === 'chat' ? 'Answer in the application’s chat with the RP' : `To ${to.name} <${to.addr}> · from ${mb.addresses?.[0]}, in this thread`}</p>
          <textarea id="mx-reply" aria-label="Reply" className="gspx-textarea" rows={8} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="mx__nextacts">
            <Button kind="primary" disabled={!reply.trim()} onClick={send}>Send</Button>
            <button type="button" className="btn btn--link gspx-link" onClick={() => (reply.trim() ? askDiscard('the reply').then((ok) => ok && setReply(null)) : setReply(null))}>Discard</button>
            <span className="muted">{t.draft ? 'Drafted from the conversation and the application. Check it before sending.' : 'A starting point. Edit it before sending.'}</span>
          </div>
        </section>
      )}

      <section className="mx__thread" aria-label="Messages">
        {dupes > 0 && <p className="muted">{dupes} duplicate message{dupes === 1 ? '' : 's'} folded in.</p>}
        {older.length > 0 && (
          <button type="button" className="mx__older" onClick={() => setShowOld(true)}>
            {older.length} earlier message{older.length === 1 ? '' : 's'}
          </button>
        )}
        {recent.map((m) => (
          <div key={m.id} className={`mx__msg ${m.dir === 'out' ? 'is-out' : ''}`}>
            <p className="mx__msghead">
              <b>{m.dir === 'out' ? `GSP · ${m.from[0]}` : m.from[0]}</b> <span className="muted">&lt;{m.from[1]}&gt;{m.via === 'chat' ? ' · in the RP chat' : ''}</span>
              <span className="muted mx__when">{new Date(m.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </p>
            <pre className="gspx-pre">{m.body}</pre>
            {m.attachments?.length > 0 && <p className="mx__att">{m.attachments.map((a) => <span key={a} className="cfg__chip cfg__chip--plain"><Icon name="attach" size={12} /> {a}</span>)}</p>}
          </div>
        ))}
      </section>
    </article>
  );
}

function Filed({ s, filed }) {
  const F = s.mail.filters;
  return (
    <section className="mx__list mx__filed" aria-label="Filed automatically">
      <div className="mx__filedtop">
        {F.map((f) => (
          <div key={f.id} className="mx__filter">
            <span className="num mx__share">{f.share}%</span>
            <span><b>{f.name}</b><br /><span className="muted">{f.does}</span></span>
          </div>
        ))}
      </div>
      <ul className="mx__rows">
        {filed.map((x) => (
          <li key={x.id} className="mx__row is-filed">
            <div className="mx__rowbtn">
              <span className="mx__line1"><span className="mx__from">{x.from}</span><span className="mx__age">{fmtAge(x.at)}</span></span>
              <span className="mx__subject">{x.subject}</span>
              <span className="mx__summary">{x.outcome}</span>
              <span className="mx__line3"><span className="mx__intent">{(F.find((f) => f.id === x.filter) || {}).name}</span></span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
