// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * My work: every GSP user's home for tasks.
 * Assigned to me · My queues (unassigned) · My team (leaders) · Waiting on others · Watching.
 * Every row shows its SLA. Visibility follows role access and the user's regions.
 */
import React, { useContext, useMemo, useState } from 'react';
import { useStore, update, closeTask, assignTask, recordById, queueById, kindById, nameOf, slaOf, waitOf, SLA_PILL } from './store';
import { can, inScope, oversees } from '../finance/access';
import { Page, Card, Tiles, Segmented, Select, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, toast, fmtDate, fmtAge } from '../finance/kit';
import { PersonaBar, usePersona, HostContext } from './persona';


export function taskTitle(s, t) {
  if (t.title) return t.title;
  const rule = s.rules.find(r => r.id === t.rule);
  const rec = recordById(s, t.record) || { label: t.record };
  const name = rec.type === 'Application' ? rec.student : rec.label;
  if (rule) return rule.task.replace('[record]', name);
  return `${(kindById(s, t.kind) || {}).name || 'Task'}: ${name}`;
}

/* Which tasks this user may see at all (role access + data scope). */
export function visibleTasks(s, user, role) {
  if (!can(s.matrix, role.id, 'tasks', 'R')) return [];
  return s.tasks.filter(t => {
    const rec = recordById(s, t.record) || {};
    if (!inScope(user, rec, s.roles)) return false;
    if (oversees(role.id)) return true;
    if (t.assignee === user.id) return true;
    const q = queueById(s, t.queue);
    const esc = t.esc && t.esc.level >= 2 ? queueById(s, t.esc.to) : null;
    return [q, esc].some(x => x && (x.leader === user.id || (x.members || []).includes(user.id)));
  });
}

export default function MyWork() {
  const s = useStore();
  const { openRecord, openPage } = useContext(HostContext);
  const { user, role } = usePersona();
  const [tab, setTab] = useState('mine');
  const [tile, setTile] = useState(null);
  const [queueF, setQueueF] = useState('');
  const [assigning, setAssigning] = useState(null);

  const canAct = can(s.matrix, role.id, 'tasks', 'U');
  const myQueues = s.queues.filter(q => q.leader === user.id || (q.members || []).includes(user.id));
  const leads = s.queues.filter(q => q.leader === user.id);
  const seeAll = oversees(role.id);
  const vis = useMemo(() => visibleTasks(s, user, role).filter(t => t.status === 'open'), [s, user, role]);
  const sla = t => slaOf(s, t);

  const sets = {
    mine: vis.filter(t => t.assignee === user.id),
    queues: vis.filter(t => !t.assignee && myQueues.some(q => q.id === t.queue)),
    team: vis.filter(t => seeAll || leads.some(q => q.id === t.queue)),
    watching: vis.filter(t => (s.watching[user.id] || []).includes(t.id)),
  };
  const waiting = s.records.filter(r => r.waitingOn && inScope(user, r, s.roles) &&
    (seeAll || r.officer === user.id || r.owner === user.id || myQueues.some(q => q.region && q.region === r.region)));

  const tabs = [['mine', `Assigned to me (${sets.mine.length})`], ['queues', `My queues (${sets.queues.length})`]];
  if (leads.length || seeAll) tabs.push(['team', `${seeAll ? 'All work' : 'My team'} (${sets.team.length})`]);
  tabs.push(['waiting', `Waiting on others (${waiting.length})`], ['watching', `Watching (${sets.watching.length})`]);

  let rows = tab === 'waiting' ? [] : sets[tab] || [];
  if (queueF) rows = rows.filter(t => t.queue === queueF);
  if (tile === 'breached') rows = rows.filter(t => sla(t).state === 'breached');
  if (tile === 'soon') rows = rows.filter(t => sla(t).state === 'due-soon');
  rows = [...rows].sort((a, b) => sla(a).due - sla(b).due);

  const pool = tab === 'mine' ? sets.mine : vis;
  const tiles = [
    { id: null, n: sets.mine.length, label: 'Assigned to me', sub: `${sets.mine.filter(t => sla(t).state === 'breached').length} breached`, tone: 'you' },
    { id: 'soon', n: pool.filter(t => sla(t).state === 'due-soon').length, label: 'Due today or tomorrow', sub: tab === 'mine' ? 'Yours' : 'In this view', tone: 'gsp' },
    { id: 'breached', n: pool.filter(t => sla(t).state === 'breached').length, label: 'Breached', sub: 'Past the SLA', tone: 'bad' },
    { id: 'unassigned', n: sets.queues.length, label: 'Unassigned in my queues', sub: myQueues.length ? myQueues.map(q => q.name).slice(0, 2).join(', ') + (myQueues.length > 2 ? '…' : '') : 'Not in a queue', tone: 'gsp' },
  ];

  const pick = t => { assignTask(t.id, user.id, user.id); toast('It’s yours now.'); };
  const done = t => {
    if (t.maker && t.maker === user.id) { toast('You made this change, so someone else must check it.'); return; }
    closeTask(t.id, user.id);
    toast(t.auto ? 'Done. It would also have closed itself when the status changed.' : 'Done.');
  };
  const open = id => {
    const rec = recordById(s, id);
    if (rec && rec.type === 'Application' && !rec.addon) openRecord(id);
    else if (rec && rec.type === 'Commission' && openPage) openPage('gspx-comm');
    else if (rec && rec.type === 'Email' && openPage) openPage('gspx-mail');
    else toast('This record is only in the add-on demo, not in the main prototype yet.');
  };

  const head = ['Task', 'Record', 'Queue', 'Assigned to', 'Waiting', 'SLA', ''];
  return (
    <Page title="My work" top={<PersonaBar />}
      lead="Every task waiting on you and your queues, soonest due first. Tasks come from the task rules: an application’s tasks close themselves when its status changes, and you can close one with Done.">
      {!canAct && <Notice>{role.name} can see tasks but not change them.</Notice>}
      <Tiles items={tiles.map(t => ({ ...t, id: t.id ?? 'mine' }))} value={tile} onChange={v => { if (v === 'mine') { setTab('mine'); setTile(null); } else if (v === 'unassigned') { setTab('queues'); setTile(null); } else setTile(v); }} />
      <Card flush>
        <div className="stools">
          <div className="stools__row">
            <Segmented label="Whose work" options={tabs} value={tab} onChange={v => { setTab(v); setTile(null); }} />
            {tab !== 'waiting' && <Select id="mw-queue" label="Queue" hideLabel value={queueF} onChange={setQueueF} placeholder="All queues"
              options={s.queues.filter(q => vis.some(t => t.queue === q.id)).map(q => [q.id, q.name])} />}
          </div>
          <p className="stools__count" role="status">
            <span><span className="num">{tab === 'waiting' ? waiting.length : rows.length}</span> {tab === 'waiting' ? 'records waiting' : 'tasks'}{tile ? ` · filtered: ${tile === 'breached' ? 'breached' : 'due soon'}` : ''}</span>
            {tile && <LinkButton onClick={() => setTile(null)}>Clear filter</LinkButton>}
          </p>
        </div>
        {tab === 'waiting' ? (
          <Table head={['Record', 'Waiting on', 'For', 'Since', 'Timer']}
            empty={!waiting.length && <Empty title="Nothing is waiting on others">When GSP asks an RP, student or university for something, it shows here with a timer.</Empty>}>
            {waiting.map(r => { const w = waitOf(r); return (
              <tr key={r.id} className="irow">
                <td><button type="button" className="irow__open" onClick={() => open(r.id)}>{r.type === 'Application' ? `${r.student} · ${r.id}` : r.label}</button><span className="irow__sub">{r.type === 'Application' ? `${r.uni} · ${r.status}` : r.type}</span></td>
                <td>{r.waitingOn}</td><td>{r.waitingFor}</td><td className="num">{fmtAge(r.since || Date.now())}</td>
                <td>{w && <><Pill tone={SLA_PILL[w.state][1]}>{SLA_PILL[w.state][0]}</Pill><span className="irow__sub">{w.text}</span></>}</td>
              </tr>); })}
          </Table>
        ) : (
          <Table head={head} className="itab--queue"
            empty={!rows.length && <Empty title={tab === 'mine' ? 'Nothing assigned to you' : 'Nothing here'}>{tab === 'mine' && sets.queues.length ? 'Pick up a task from My queues.' : 'New tasks appear here when a task rule fires.'}</Empty>}>
            {rows.map(t => {
              const rec = recordById(s, t.record) || {}; const q = queueById(s, t.queue); const st = sla(t);
              const isLeader = q && q.leader === user.id;
              return (
                <tr key={t.id} className="irow">
                  <td><button type="button" className="irow__open" onClick={() => open(t.record)}>{taskTitle(s, t)}</button>
                    <span className="irow__sub">{t.note || (kindById(s, t.kind) || {}).name}{t.maker ? ` · changed by ${nameOf(s, t.maker)}` : ''}{t.esc ? ` · ${t.esc.text}` : ''}</span></td>
                  <td>{rec.type === 'Application' ? <>{rec.id}<span className="irow__sub">{rec.uni} · {rec.region}</span></> : <>{rec.type}<span className="irow__sub">{rec.region || 'Global'}</span></>}</td>
                  <td>{q ? q.name : <span className="muted">Record owner</span>}</td>
                  <td>{t.assignee ? nameOf(s, t.assignee) : <span className="muted">Unassigned</span>}</td>
                  <td className="num">{fmtAge(t.created)}</td>
                  <td><Pill tone={SLA_PILL[st.state][1]}>{SLA_PILL[st.state][0]}</Pill><span className="irow__sub">{st.text}</span></td>
                  <td><div className="gspx-acts">
                    {canAct && !t.assignee && <Button size="sm" onClick={() => pick(t)}>Pick up</Button>}
                    {canAct && (isLeader || role.id === 'admin' || role.id === 'admission-ops' || (q && (q.members || []).includes(user.id))) && <LinkButton onClick={() => setAssigning(t)}>{t.assignee ? 'Reassign' : 'Assign'}</LinkButton>}
                    {canAct && t.assignee === user.id && <LinkButton onClick={() => done(t)}>Done</LinkButton>}
                  </div></td>
                </tr>);
            })}
          </Table>
        )}
      </Card>
      {assigning && <AssignSheet task={assigning} onClose={() => setAssigning(null)} by={user} />}
    </Page>
  );
}

function AssignSheet({ task, onClose, by }) {
  const s = useStore();
  const q = queueById(s, task.queue);
  const people = q ? [q.leader, ...(q.members || [])].filter(Boolean) : s.users.filter(u => u.role !== 'counsellor').map(u => u.id);
  const [who, setWho] = useState(task.assignee || '');
  return (
    <Sheet title="Assign task" sub={taskTitle(s, task)} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={!who || who === task.assignee} onClick={() => { assignTask(task.id, who, by.id); toast(`Assigned to ${nameOf(s, who)}.`); onClose(); }}>Assign</Button></>}>
      <Select id="as-who" label={q ? `People in ${q.name}` : 'Person'} value={who} onChange={setWho} placeholder="Choose a person" options={[...new Set(people)].map(id => [id, nameOf(s, id)])} />
    </Sheet>
  );
}
