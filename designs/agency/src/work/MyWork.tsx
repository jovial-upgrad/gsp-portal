// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * My work (slice 4 PRD, My work): every GSP person's list of open tasks, soonest due first.
 * Tabs: Assigned to me · My team (queue leaders, S4-26) or All work (Admin, Global Ops, View Only) · Waiting on others.
 * Every row shows its SLA. Who sees a task follows role access, region isolation (per person, S4-24) and the queues.
 */
import React, { useContext, useMemo, useState } from 'react';
import { useStore, closeTask, assignTasks, recordById, queueById, kindById, nameOf, slaOf, waitOf, SLA_PILL, isGlobalOps, BULK_MAX } from './store';
import { can, inScope, oversees } from '../finance/access';
import { Page, Card, Tiles, Segmented, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, toast, fmtAge } from '../finance/kit';
import { PersonaBar, usePersona, HostContext } from './persona';
import { Pick, Tick } from './ui';
import { regionQueueId } from './seed';
import { now, clockOffset, setClockOffset, useClockOffset, istStamp } from './clock';
import { addWorkingHours, calendarOf } from './calendars';

export function taskTitle(s, t) {
  if (t.title) return t.title;
  const rule = s.rules.find(r => r.row === t.rule || r.id === t.rule);
  const rec = recordById(s, t.record) || { label: t.record };
  const name = rec.type === 'Application' ? rec.student : rec.label;
  if (rule) return rule.task.replace(/<[^>]+>/, name);
  return `${(kindById(s, t.kind) || {}).name || 'Task'}: ${name}`;
}

/**
 * Who sees a task (slice 4 PRD, What lands in a person's list): their role has View on My work and tasks; the
 * record is in their sales regions (Admission and Recruitment); and they are the assignee, lead the task's queue, are
 * in the queue a level 2 escalation went to, or their role has oversight (Admin, Global Ops, View Only).
 */
export function visibleTasks(s, user, role) {
  if (!can(s.matrix, role.id, 'tasks', 'R')) return [];
  return s.tasks.filter(t => {
    const rec = recordById(s, t.record) || {};
    if (!inScope(user, rec, s.roles)) return false;
    if (oversees(role.id)) return true;
    if (t.assignee === user.id) return true;
    const q = queueById(s, t.queue);
    if (q && q.leader === user.id) return true;
    const esc = t.esc && t.esc.level >= 2 ? queueById(s, t.esc.to) : null;
    return !!esc && (esc.leader === user.id || (esc.members || []).includes(user.id));
  });
}

export default function MyWork() {
  const s = useStore();
  const { openRecord, openPage, hostRole, openRp } = useContext(HostContext);
  const { user, role } = usePersona();
  const [tab, setTab] = useState('mine');
  const [tile, setTile] = useState(null);
  const [queueF, setQueueF] = useState('');
  const [assigning, setAssigning] = useState(null);
  const [picked, setPicked] = useState([]);

  const canAct = can(s.matrix, role.id, 'tasks', 'U');
  const leads = s.queues.filter(q => q.leader === user.id);
  const seeAll = oversees(role.id);
  const boss = role.id === 'admin' || isGlobalOps(role.id);
  const vis = useMemo(() => visibleTasks(s, user, role).filter(t => t.status === 'open'), [s, user, role]);
  const sla = t => slaOf(s, t);

  const sets = {
    mine: vis.filter(t => t.assignee === user.id),
    team: vis.filter(t => (seeAll ? true : leads.some(q => q.id === t.queue))),
  };
  const inQueue = (r) => { const q = queueById(s, regionQueueId(r.region || 'Direct', s.queues)); return q && (q.leader === user.id || (q.members || []).includes(user.id)); };
  const waiting = s.records.filter(r => r.type === 'Application' && !r.closed && r.waitingOn && inScope(user, r, s.roles) && (seeAll || r.officer === user.id || inQueue(r)));

  const tabs = [['mine', `Assigned to me (${sets.mine.length})`]];
  if (seeAll) tabs.push(['team', `All work (${sets.team.length})`]);
  else if (leads.length) tabs.push(['team', `My team (${sets.team.length})`]);
  tabs.push(['waiting', `Waiting on others (${waiting.length})`]);

  let rows = tab === 'waiting' ? [] : sets[tab] || [];
  if (queueF) rows = rows.filter(t => t.queue === queueF);
  if (tile === 'breached') rows = rows.filter(t => sla(t).state === 'breached');
  if (tile === 'soon') rows = rows.filter(t => sla(t).state === 'due-soon');
  rows = [...rows].sort((a, b) => sla(a).due - sla(b).due || a.created - b.created);

  const pool = tab === 'mine' ? sets.mine : tab === 'team' ? sets.team : vis;
  const tiles = [
    { id: 'mine', n: sets.mine.length, label: 'Assigned to me', sub: `${sets.mine.filter(t => sla(t).state === 'breached').length} breached`, tone: 'you' },
    { id: 'soon', n: pool.filter(t => sla(t).state === 'due-soon').length, label: 'Due soon', sub: tab === 'mine' ? 'Yours' : 'In this view', tone: 'gsp' },
    { id: 'breached', n: pool.filter(t => sla(t).state === 'breached').length, label: 'Breached', sub: 'Past the SLA', tone: 'bad' },
  ];

  const mayAssign = t => { const q = queueById(s, t.queue); return canAct && (boss || (q && (q.leader === user.id || (q.members || []).includes(user.id)))); };
  const canBulk = canAct && (boss || leads.length > 0) && tab !== 'waiting';
  const bulkable = rows.filter(mayAssign);
  const done = t => {
    if (t.maker && t.maker === user.id) { toast('You made this change, so someone else must check it.'); return; }
    closeTask(t.id, user.id);
    toast(t.auto ? 'Done. It would also have closed itself when its condition ended.' : 'Done.');
  };
  const open = id => {
    const rec = recordById(s, id);
    if (rec && rec.type === 'Application' && !rec.addon) openRecord(id);
    else if (rec && rec.type === 'RP' && openRp && rec.page === 'rps') openRp(id);
    else if (rec && rec.type === 'Commission' && openPage) openPage('gspx-comm');
    else if (rec && rec.type === 'Email' && openPage) openPage('gspx-mail');
    else if (rec && rec.type === 'Setting' && openPage && hostRole === 'gsp-admin') openPage(rec.page);
    else toast(`Opens the ${rec?.type === 'RP' ? 'RP' : (rec?.type || 'record').toLowerCase()} page${rec?.type === 'Setting' ? ' in GSP · Admin' : ''}.`);
  };
  const toggle = id => setPicked(l => (l.includes(id) ? l.filter(x => x !== id) : l.length >= BULK_MAX ? (toast(`Up to ${BULK_MAX} at a time.`), l) : [...l, id]));
  const all = bulkable.slice(0, BULK_MAX).map(t => t.id);

  const head = [...(canBulk ? [<Tick key="all" id="mw-all" checked={picked.length > 0 && all.every(id => picked.includes(id))} onChange={v => setPicked(v ? all : [])}><span className="vh">Tick every task you can assign (up to {BULK_MAX})</span></Tick>] : []), 'Task', 'Record', 'Queue', 'Assigned to', 'Waiting', 'SLA', ''];
  return (
    <Page title="My work" top={<PersonaBar />}
      lead="Every task waiting on you and your queues, soonest due first. Tasks come from the task rules: an application’s tasks close themselves when its status changes, and you can close one with Done.">
      <ClockBar />
      {!canAct && <Notice>{role.name} can see tasks but not change them.</Notice>}
      <Tiles items={tiles} value={tile} onChange={v => { if (v === 'mine') { setTab('mine'); setTile(null); setPicked([]); } else setTile(v); }} />
      <Card flush>
        <div className="stools">
          <div className="stools__row">
            <Segmented label="Whose work" options={tabs} value={tab} onChange={v => { setTab(v); setTile(null); setPicked([]); }} />
            {tab !== 'waiting' && <Pick id="mw-queue" label="Queue" hideLabel value={queueF} onChange={setQueueF} placeholder="All queues"
              options={[['', 'All queues'], ...s.queues.filter(q => vis.some(t => t.queue === q.id)).map(q => [q.id, q.name])]} />}
          </div>
          <p className="stools__count" role="status">
            <span><span className="num">{tab === 'waiting' ? waiting.length : rows.length}</span> {tab === 'waiting' ? 'records waiting' : 'tasks'}{tile ? ` · filtered: ${tile === 'breached' ? 'breached' : 'due soon'}` : ''}</span>
            {tile && <LinkButton onClick={() => setTile(null)}>Clear filter</LinkButton>}
          </p>
          {canBulk && picked.length > 0 && (
            <div className="stools__row" role="group" aria-label="Ticked tasks">
              <span><b className="num">{picked.length}</b> ticked</span>
              <Button size="sm" kind="primary" onClick={() => setAssigning({ bulk: picked })}>Assign {picked.length}</Button>
              <LinkButton onClick={() => setPicked([])}>Clear</LinkButton>
            </div>
          )}
        </div>
        {tab === 'waiting' ? (
          <Table head={['Record', 'Waiting on', 'For', 'Since', 'Timer']}
            empty={!waiting.length && <Empty title="Nothing is waiting on others">When GSP asks an RP, student or university for something, it shows here with a timer.</Empty>}>
            {waiting.map(r => { const w = waitOf(r); return (
              <tr key={r.id} className="irow">
                <td><button type="button" className="irow__open" onClick={() => open(r.id)}>{r.student} · {r.id}</button><span className="irow__sub">{r.uni} · {r.status}</span></td>
                <td>{r.waitingOn}</td><td>{r.waitingFor || r.status}</td><td className="num">{fmtAge(r.since || now())}</td>
                <td>{w && <><Pill tone={SLA_PILL[w.state][1]}>{SLA_PILL[w.state][0]}</Pill><span className="irow__sub">{w.text}</span></>}</td>
              </tr>); })}
          </Table>
        ) : (
          <Table head={head} className={canBulk ? "itab--queue itab--ticks" : "itab--queue"}
            empty={!rows.length && <Empty title={tab === 'mine' ? 'Nothing assigned to you' : 'Nothing here'}>New tasks appear here when a task rule fires.</Empty>}>
            {rows.map(t => {
              const rec = recordById(s, t.record) || {}; const q = queueById(s, t.queue); const st = sla(t);
              const kind = (kindById(s, t.kind) || {}).name;
              return (
                <tr key={t.id} className="irow">
                  {canBulk && <td>{mayAssign(t) ? <Tick id={`mw-t-${t.id}`} checked={picked.includes(t.id)} onChange={() => toggle(t.id)}><span className="vh">Tick {taskTitle(s, t)}</span></Tick> : null}</td>}
                  <td><button type="button" className="irow__open" onClick={() => open(t.record)}>{taskTitle(s, t)}</button>
                    <span className="irow__sub">{[kind, t.maker ? `changed by ${nameOf(s, t.maker)}` : null, t.esc ? t.esc.text : null, t.note].filter(Boolean).join(' · ')}</span></td>
                  <td>{rec.type === 'Application' ? <>{rec.id}<span className="irow__sub">{rec.uni} · {rec.region}</span></> : <>{rec.type}<span className="irow__sub">{rec.region || 'Global'}</span></>}</td>
                  <td>{q ? q.name : 'Admin'}</td>
                  <td>{nameOf(s, t.assignee)}</td>
                  <td className="num">{fmtAge(t.created)}</td>
                  <td><Pill tone={SLA_PILL[st.state][1]}>{SLA_PILL[st.state][0]}</Pill><span className="irow__sub">{st.paused || st.text}</span></td>
                  <td><div className="gspx-acts">
                    {mayAssign(t) && <LinkButton onClick={() => setAssigning({ one: t })}>{t.assignee === user.id ? 'Assign' : 'Reassign'}</LinkButton>}
                    {canAct && t.assignee === user.id && <LinkButton onClick={() => done(t)}>Done</LinkButton>}
                  </div></td>
                </tr>);
            })}
          </Table>
        )}
      </Card>
      {assigning && <AssignSheet tasks={assigning.one ? [assigning.one] : s.tasks.filter(t => assigning.bulk.includes(t.id))} onClose={() => setAssigning(null)} by={user} onDone={() => setPicked([])} />}
    </Page>
  );
}

/** Assign or Reassign (one task, or up to 50 ticked): the queue's leader and members; Assign is off until a different person is picked. */
function AssignSheet({ tasks, onClose, by, onDone }) {
  const s = useStore();
  const queues = [...new Set(tasks.map(t => t.queue))].map(id => queueById(s, id)).filter(Boolean);
  const people = [...new Set(queues.flatMap(q => [q.leader, ...(q.members || [])]).filter(Boolean))].filter(id => s.users.some(u => u.id === id));
  const one = tasks.length === 1 ? tasks[0] : null;
  const [who, setWho] = useState(one ? one.assignee || '' : '');
  const same = one ? who === one.assignee : tasks.every(t => t.assignee === who);
  return (
    <Sheet title={one ? (one.assignee === by.id ? 'Assign task' : 'Reassign task') : `Assign ${tasks.length} tasks`} sub={one ? taskTitle(s, one) : `To one person. Only these tasks move; an application’s next task still goes to its officer.`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={!who || same} onClick={() => { assignTasks(tasks.map(t => t.id), who, by.id); toast(`Assigned to ${nameOf(s, who)}.`); onDone?.(); onClose(); }}>Assign</Button></>}>
      <Pick id="as-who" label={queues.length === 1 ? `People in ${queues[0].name}` : 'Person'} value={who} onChange={setWho} placeholder="Choose a person"
        options={people.map(id => [id, `${nameOf(s, id)}${queues.some(q => q.leader === id) ? ' (leader)' : ''}`])} />
    </Sheet>
  );
}

/**
 * Prototype only: move the work clock on to watch a task go from On track to Due soon to Breached and up the
 * escalation ladder. Every SLA, timer and the bell read it. The build has no such control.
 */
function ClockBar() {
  const off = useClockOffset();
  const cal = calendarOf('Global');
  const step = (wh) => setClockOffset(addWorkingHours(cal, now(), wh) - Date.now());
  return (
    <div className="gspx-persona" role="group" aria-label="Prototype clock">
      <span className="gspx-persona__k">Prototype clock</span>
      <span className="gspx-persona__scope"><b>{istStamp(now())}</b>{off ? ` · moved on ${Math.round(off / 36e5)} h` : ' · now'}</span>
      <Button size="sm" onClick={() => step(1)}>+1 working hour</Button>
      <Button size="sm" onClick={() => step(9)}>+1 working day</Button>
      {off > 0 && <LinkButton onClick={() => setClockOffset(0)}>Back to now</LinkButton>}
      <span className="gspx-persona__tag">For testing: SLAs, timers and the bell follow it</span>
    </div>
  );
}
export { clockOffset };
