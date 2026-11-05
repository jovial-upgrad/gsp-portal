// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * The work store (slice 4 PRD): queues, kinds of work, task rules, the escalation ladder, tasks and the work log.
 * Where a task goes is its kind of work's Goes to (work/routing.ts, 5 Nov); every engine resolves it through
 * `queueOfRule`, and a task keeps the Goes to it was made with (`routed`).
 * It saves to this browser and tells components when something changes. Calendars are in work/calendars.ts, the
 * clock in work/clock.ts. In the real build this is the work service; components only use `useStore`, `update` and
 * the helpers below.
 */
import { useSyncExternalStore } from 'react';
import * as seed from './seed';
import { gspRoles, inScope, oversees } from '../finance/access';
import { getCalendars, subscribeCalendars, calendarOf } from './calendars';
import * as mail from './mail';
import { liveAll, liveFlags, onLiveChange } from '../data/live';
import { onLeave, subscribeLeave } from '../data/leave';
import { adminCfg, onAdminChange, setAdminCfg } from '../admin/data/store';
import { liveApps, appRecord, appTasks, addWorkingHours, workingHoursBetween, DAY_HOURS, pickOfficer, timeHours, afterFrom } from './engine';
import { regionQueueId, sameRole } from './seed';
import { queueOfRule, goesToOfRule, goesToName, kindsGoingTo } from './routing';
export { queueOfRule, goesToOfRule, goesToName, goesToOptions, goesToValid, kindsGoingTo, receivesOf, ROUTED, BY_REGION, BY_RECRUITMENT } from './routing';
import { now, subscribeClock, istDate, istTime, istYmd } from './clock';
import { WORK_KEY } from './renewal';
import { getDb as rpDb, onDbChange } from '../institution/data/store';
import { rpTasks, rpRecord, ipTasks, uniRecord, nationalityTasks } from './rpRules';
import { recordTasks } from './recordRules';
import { emailLog } from './emailLog';
import { ruleLive } from './engine';
import { readSource } from './sources';
import { runTimes } from './jobs';
import { sampleStudents } from '../data/students';

const KEY = WORK_KEY; // see renewal.ts for each version
const ADMIN_Q = 'q-admin';
const NO_HOURS = 18; // no rule SLA and no kind SLA: 18 working hours

/* ---------- the role names this slice acts on (slice 1's names) ---------- */
const roleName = (id) => (gspRoles().find((r) => r.id === id) || {}).name || id;
/** Global Ops: Admin's equal on My work (All work, Assign any task) and the settings. */
export const isGlobalOps = (roleId) => sameRole(roleName(roleId), 'Global Ops');
export const isAdminRole = (roleId) => roleId === 'admin';
export const isViewOnly = (roleId) => roleId === 'view-only';

function fresh() {
  const st = {
    users: seed.USERS,
    queues: seed.QUEUES, kinds: seed.KINDS, rules: seed.RULES, escalation: seed.ESCALATION,
    // nothing seeded (Jovial, 2 Nov: nothing hard-coded): every task comes from a rule (engine.ts, rpRules.ts,
    // recordRules.ts); `tasks` holds none until the build's Mail makes some, and `records` only what an action adds
    records: [], tasks: [],
    persona: null, log: [], closed: {}, overrides: {}, officers: {}, frozen: {}, routed: {}, pauses: {}, appQueue: {}, gave: [],
    // testing aids (the Prototype panel): job runs made to fail, emails made to bounce
    jobs: { fail: {} }, bounces: {},
    mail: { threads: mail.THREADS, filed: mail.FILED, mailboxes: mail.MAILBOXES, filters: mail.FILTERS, intents: mail.INTENTS, settings: mail.MAIL_SETTINGS },
  };
  return st;
}

function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }

/* ---------- one queue editor (S4-1): Admin's queue list (routing, mailboxes, Admin Home) is this one ---------- */
function syncAdminQueues() {
  try {
    const c = adminCfg();
    const want = state.queues.map((q) => ({ id: q.id, name: q.name, lead: q.leader || '', members: [...(q.members || [])] }));
    if (JSON.stringify(c.queues) === JSON.stringify(want)) return;
    const nameOf = (id) => c.queues.find((q) => q.id === id)?.name;
    // a region's queue may be stored by id or (slice 1's Sales regions) by name: either finds it
    const regionQueue = Object.fromEntries(Object.entries(c.regionQueue || {}).map(([r, v]) => [r, want.find((q) => q.id === v)?.id ?? want.find((q) => q.name === v)?.id ?? want.find((q) => q.name === nameOf(v))?.id ?? 'q-adm-global']));
    setAdminCfg((x) => ({ ...x, queues: want, regionQueue }));
  } catch { /* Admin's settings not loaded */ }
}

/* ---------- people ---------- */
/**
 * One user list (W17, Jovial, 1 Nov): the staff list plus whoever Admin › Create roles adds. Someone deactivated
 * isn't in it: they get no new work, and their open work goes to their queue's leader.
 */
const ROLE_ID = (r) => String(r).toLowerCase().replace(/ /g, '-');
function usersNow(st) {
  let admin = [];
  try { admin = adminCfg().users || []; } catch { admin = []; }
  const off = new Set(admin.filter((u) => u.status === 'Deactivated').map((u) => u.id));
  const have = new Set(st.users.map((u) => u.id));
  const added = admin.filter((u) => !have.has(u.id) && u.status !== 'Deactivated').map((u) => ({ id: u.id, name: u.name, email: u.email, role: ROLE_ID(u.role), title: u.role, regions: u.regions || [] }));
  return [...st.users.filter((u) => !off.has(u.id)), ...added];
}
const isActive = (s, id) => !!id && s.users.some((u) => u.id === id);
const canSee = (s, id, rec) => { const u = s.users.find((x) => x.id === id); return !!u && (!rec || !rec.region || inScope(u, rec, s.roles)); };
/** Can take new work now: active, not on leave today, and can open the record (S4-24 proposal). */
const canTake = (s, id, rec) => isActive(s, id) && !onLeave(id, istYmd(now())) && canSee(s, id, rec);

/* ---------- sharing (S4-2): Fewest open, Record owner, To the leader ---------- */
export const SHARE = { 'fewest-open': 'Fewest open', 'record-owner': 'Record owner', 'to-leader': 'To the leader' };
export const SHARE_HELP = {
  'fewest-open': 'A new task goes to the member (leader included) with the fewest open tasks in this queue; a tie goes to the name first in alphabetical order. People on leave, deactivated users and anyone who can’t see the record are skipped; if everyone is, the leader gets it.',
  'record-owner': 'A new task goes to whoever owns the record: the application’s officer, the RP’s Recruitment contact, the partner’s or university’s relationship manager. No owner: Fewest open.',
  'to-leader': 'A new task goes to the queue’s leader, who does it or assigns it to a member. No leader: the Admin queue’s leader.',
};
/** How a rule's task is shared: the application's officer, the queue's own way, or one of the three. */
export const RULE_SHARE = { officer: 'The application’s officer', '': 'The queue’s own way', ...SHARE, 'not-maker': 'Fewest open, never the maker' };
const ruleOf = (s, t) => s.rules.find((r) => r.row === t.rule || r.id === t.rule);
/** Who a new task goes to. `open` is the open tasks so far (for Fewest open). */
function shareTo(s, t, rec, open) {
  const q = s.queues.find((x) => x.id === t.queue) || s.queues.find((x) => x.id === ADMIN_Q);
  const admin = s.queues.find((x) => x.id === ADMIN_Q);
  if (!q) return admin?.leader ?? null;
  const r = ruleOf(s, t);
  const how = t.share || (r?.share && r.share !== 'officer' ? r.share : null) || q.assign || 'fewest-open';
  if (how === 'to-leader') return q.leader || admin?.leader || null;
  if (how === 'record-owner') {
    const owner = rec.owner || rec.officer;
    if (owner && isActive(s, owner)) return owner;
  }
  const people = [q.leader, ...(q.members || [])].filter((id, i, l) => id && l.indexOf(id) === i && canTake(s, id, rec) && !(how === 'not-maker' && id === t.maker));
  if (!people.length) return q.leader || admin?.leader || null;
  const n = (id) => open.filter((x) => x.status === 'open' && x.queue === q.id && x.assignee === id).length;
  const name = (id) => (s.users.find((u) => u.id === id) || {}).name || id;
  return people.sort((x, y) => n(x) - n(y) || name(x).localeCompare(name(y)))[0];
}
/** A task's SLA in working hours, first match wins: the rule's own, else its kind's, else 18 (slice 4 PRD). */
function hoursFor(s, t) {
  const r = ruleOf(s, t);
  if (r?.sla) return timeHours(r.sla);
  const k = s.kinds.find((x) => x.id === t.kind);
  return k?.sla ?? NO_HOURS;
}

/* ---------- the stored lists (after the helpers fresh() uses) ---------- */
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || null; } catch { state = null; }
if (!state || !state.mail || !state.mail.threads || !state.rules?.[0]?.group) state = fresh();
state.jobs = state.jobs || { fail: {} };
state.bounces = state.bounces || {};
for (const k of ['closed', 'overrides', 'officers', 'frozen', 'routed', 'pauses', 'appQueue']) state[k] = state[k] || {};
// saved before Goes to (5 Nov): each kind takes its seed's Goes to (else the Admin queue), and queues lose their ticks
state.kinds = (state.kinds || []).map((k) => (k.goesTo ? k : { ...k, goesTo: seed.KINDS.find((x) => x.id === k.id)?.goesTo || ADMIN_Q }));
state.queues = (state.queues || []).map(({ kinds, ...q }) => q);
state.rules = (state.rules || []).map(({ queue, ...r }) => r);
state.gave = state.gave || [];
const listeners = new Set();

syncAdminQueues();

/* ---------- escalation (T51): level 1 the leader, level 2 the team's Ops queue, level 3 the Admin queue ---------- */
/** The team's Ops queue for level 2 (slice 4 PRD): Global Admissions for Admissions, RP Ops for RP Ops and Recruitment, IP Ops for Institution and IP Ops, Finance for Finance, else Admin. */
export const opsQueueOf = (qid) => (!qid ? ADMIN_Q : qid.startsWith('q-adm-') ? 'q-adm-global' : qid === 'q-rp-ops' || qid.startsWith('q-rec-') ? 'q-rp-ops' : qid === 'q-institution' || qid === 'q-inst-ops' ? 'q-inst-ops' : qid === 'q-finance' ? 'q-finance' : ADMIN_Q);

/*
 * What every page reads: the stored lists, plus the applications as they are now in every module and the tasks the
 * application rules make from them (work/engine.ts). Facts the work service would store the moment they happen (an
 * officer picked, a task's SLA hours, a pause starting or ending, a new task's assignee) are kept here the first time
 * they're seen, so they don't drift.
 */
let view = null, vkey = [];
let pending = new Map();
let flushing = false;
const later = (key, fn, log) => { if (!pending.has(key)) pending.set(key, { fn, log }); };
function flush() {
  if (flushing || !pending.size) return;
  flushing = true;
  const list = [...pending.values()];
  pending = new Map();
  queueMicrotask(() => {
    flushing = false;
    const next = structuredClone(state);
    for (const p of list) p.fn(next);
    const logs = list.filter((p) => p.log).map((p) => ({ at: now(), who: null, ...p.log }));
    if (logs.length) next.log = [...logs, ...next.log].slice(0, 300);
    state = next; save(); view = null; listeners.forEach((l) => l());
  });
}

let studsCache = null;
/** The universities under a reopened partner (T70's records), as My work shows them. */
const reopenedUnis = (rdb) => (rdb.ips || []).filter((p) => p.reopenedAt).flatMap((p) => (rdb.unis || []).filter((u) => u.ip === p.id).map((u) => uniRecord(u, p)));
function derive() {
  const live = liveAll(), fl = liveFlags(), minute = Math.floor(now() / 60000);
  const cals = getCalendars();
  const rdb = rpDb();
  if (view && vkey[0] === state && vkey[1] === live && vkey[2] === fl && vkey[3] === leaveSnap && vkey[4] === minute && vkey[5] === cals && vkey[6] === adminTick && vkey[7] === rdb) return view;
  const t0 = now();
  const apps = liveApps(live);
  // Waiting on others, from Who has it (slice 4 PRD, proposal): an open request is On RP (its title and due date); a
  // university status is On university, due when the rule that chases it would start
  const recs = apps.map((a) => {
    const r = appRecord(a);
    if (r.closed) return r;
    const need = r.needs.find((n) => n.at);
    if (need) return { ...r, waitingOn: 'RP', waitingFor: need.title, due: need.due ?? undefined };
    if (r.has !== 'uni') return r;
    const timer = seed.STATUS_SLA.find((x) => x.status === r.status) || seed.STATUS_SLA.find((x) => r.status.startsWith(x.status));
    const rule = timer && state.rules.find((y) => y.row === timer.row);
    return { ...r, waitingOn: 'University', waitingFor: r.status, due: rule?.after ? afterFrom(calendarOf(r.region || 'Global'), r.since, rule.after) : undefined };
  });
  const appIds = new Set(recs.map((r) => r.id));
  const closedApp = new Set(recs.filter((r) => r.closed).map((r) => r.id));
  // one source each: the sales regions (Admin), the roles (Admin › Permission roles), the calendars (Working days)
  const base = {
    ...state, regions: seed.regionsNow(), roles: gspRoles(), calendars: cals, users: usersNow(state),
    // the RPs as the Institution Team's records have them (their tasks come from rpRules.ts)
    records: [...recs, ...rdb.rps.map(rpRecord), ...reopenedUnis(rdb), ...state.records.filter((r) => (r.type !== 'Application' || !appIds.has(r.id)) && !rdb.rps.some((x) => x.id === r.id))],
    calFor: (region) => calendarOf(region || 'Global'),
  };
  // the application's officer: set by routing when the RP sends the documents, kept until changed (S4-5); a
  // deactivated officer's applications go to the queue's leader, who picks a new officer (S4-4)
  const regionalLeader = (a) => (base.queues.find((q) => q.id === regionQueueId(a.region || 'Direct', base.queues)) || {}).leader;
  base.officerOf = (a) => {
    const o = state.officers[a.id];
    const own = a.officer || null;
    let cur = o && o.from === own ? o.officer : own;
    if (!cur && (a.status === 'docs' || !a.since)) return null; // no officer while New
    // re-routing (S1C-7): an edit that sends the application to another Admissions queue has that queue pick a new
    // officer (Fewest open), and the open tasks move with it (they follow the officer); the same queue keeps the
    // officer. The queue each application was last worked in is kept, and the move is logged.
    const qNow = regionQueueId(a.region || 'Direct', base.queues);
    const qWas = (state.appQueue || {})[a.id];
    if (!qWas) later(`aq-${a.id}`, (d) => { d.appQueue[a.id] = d.appQueue[a.id] || qNow; });
    else if (cur && qWas !== qNow) {
      const prev = cur;
      const next = pickOfficer(base, apps, a.region || 'Direct', (id) => canTake(base, id, { region: a.region }), (x) => (state.officers[x.id]?.from === (x.officer || null) ? state.officers[x.id].officer : x.officer));
      const qn = (id) => (base.queues.find((q) => q.id === id) || {}).name || id;
      if (next) {
        later(`off-${a.id}`, (d) => { d.officers[a.id] = { officer: next, from: own, why: 'rerouted', queue: qNow, at: t0 }; d.appQueue[a.id] = qNow; }, { event: 'application.officer_changed', text: `${a.id} re-routed from ${qn(qWas)} to ${qn(qNow)}: ${nameOfIn(base, next)} is the officer (Fewest open), was ${nameOfIn(base, prev)}; open tasks moved` });
        cur = next;
      }
    }
    if (!cur) {
      cur = pickOfficer(base, apps, a.region || 'Direct', (id) => canTake(base, id, { region: a.region }), (x) => (state.officers[x.id]?.from === (x.officer || null) ? state.officers[x.id].officer : x.officer));
      if (cur) later(`off-${a.id}`, (d) => { if (d.officers[a.id]?.from === own) return; d.officers[a.id] = { officer: cur, from: own, why: 'routing', at: t0 }; }, { event: 'application.officer_set', text: `Routing made ${nameOfIn(base, cur)} the officer on ${a.id} (Fewest open)` });
    }
    if (cur && !isActive(base, cur)) {
      const lead = regionalLeader(a);
      const gone = (state.users.find((u) => u.id === cur) || {}).name || 'The officer';
      if (lead && lead !== cur) later(`off-${a.id}`, (d) => { d.officers[a.id] = { officer: lead, from: own, why: 'left', left: cur, at: t0 }; }, { event: 'application.officer_changed', text: `${gone} has left GSP: ${nameOfIn(base, lead)} (leader) is now the officer on ${a.id} and assigns a new one` });
      return lead || cur;
    }
    return cur;
  };
  const officerNote = (a) => { const o = state.officers[a.id]; return o?.why === 'left' && o.from === (a.officer || null) ? 'Their officer has left GSP: the leader has it' : null; };

  // the record rules (recordRules.ts): RPs, partners, universities, courses, mail, commission, Admin's settings and jobs
  let cfgNow = null;
  try { cfgNow = adminCfg(); } catch { cfgNow = null; }
  const rr = cfgNow ? recordTasks(base, {
    s: base, rdb, apps, now: t0, cfg: cfgNow, cals, threads: state.mail.threads, filed: state.mail.filed || [], mailCfg: state.mail.settings,
    comm: readSource('commission'), jobs: state.jobs, bounces: state.bounces,
    studentOf: (id) => recs.find((r) => r.id === id)?.student ?? id,
    queueOfApp: (id) => regionQueueId(apps.find((a) => a.id === id)?.region || 'Direct', base.queues),
    officerOfApp: (id) => { const a = apps.find((y) => y.id === id); return a ? base.officerOf(a) : null; },
  }, t0) : { tasks: [], records: [] };
  for (const r of rr.records) {
    const had = base.records.find((y) => y.id === r.id);
    if (had) Object.assign(had, Object.fromEntries(Object.entries(r).filter(([k, v]) => v != null && had[k] == null)));
    else base.records.push(r);
  }
  const auto = [...appTasks(base, live, t0), ...rpTasks(base, rdb.rps, t0), ...ipTasks(base, rdb.ips, rdb.unis, t0), ...nationalityTasks(base, (studsCache ??= sampleStudents('')), t0), ...rr.tasks].map((t) => ({ ...t, ...(state.overrides?.[t.id] || {}) }));
  const manual = state.tasks.map((t) => (t.status === 'open' && closedApp.has(t.record) ? { ...t, status: 'done', doneAt: t0, doneBy: null, outcome: 'Closed with the application' } : t));
  const list = [];
  for (const t0x of [...manual, ...auto]) {
    let t = t0x;
    if (t.status !== 'open') { list.push(t); continue; }
    const rec = base.records.find((r) => r.id === t.record) || {};
    // the title, from the rule, with the student's name or the record's (slice 4 PRD, What a task is)
    if (!t.title) {
      const r = ruleOf(base, t);
      const name = rec.type === 'Application' ? rec.student : String(rec.label || t.record).replace(/ \(.*\)$/, '');
      t = { ...t, title: r ? r.task.replace(/<[^>]+>/, name).replace(/ \(“.*$/, '') : `${(base.kinds.find((k) => k.id === t.kind) || {}).name || 'Task'}: ${name}` };
    }
    // S4-2: never unassigned; the pick is kept (as the service would store it)
    if (!t.assignee) {
      const who = shareTo(base, t, rec, list);
      t = { ...t, assignee: who };
      const id = t.id;
      if (t.auto) later(`as-${id}`, (d) => { if (!d.overrides[id]?.assignee) d.overrides[id] = { ...(d.overrides[id] || {}), assignee: who }; });
      else later(`as-${id}`, (d) => { const x = d.tasks.find((y) => y.id === id); if (x && !x.assignee) x.assignee = who; });
    }
    // S4-11: a task keeps the SLA hours it was created with
    if (t.auto && state.frozen[t.id] == null) { const id = t.id, h = t.slaHours; later(`fz-${id}`, (d) => { if (d.frozen[id] == null) d.frozen[id] = h; }); }
    // 5 Nov: and the Goes to it was created with, so a kind's new Goes to applies to new tasks only
    if (t.auto && t.goesTo && state.routed[t.id] == null) { const id = t.id, g = t.goesTo; later(`rt-${id}`, (d) => { if (d.routed[id] == null) d.routed[id] = g; }); }
    // S4-10: GSP's task pauses while the RP is asked for something
    const p = state.pauses[t.id];
    if (t.pausedNow && !p?.open) { const id = t.id, from = t.pausedNow.from; const title = t.pausedNow.title; later(`pz-${id}`, (d) => { if (!d.pauses[id]?.open) d.pauses[id] = { done: d.pauses[id]?.done || 0, open: from, title }; }); }
    if (!t.pausedNow && p?.open) { const id = t.id; later(`pz-${id}`, (d) => { if (!d.pauses[id]?.open) return; const c = calendarOf(rec.region || 'Global'); d.pauses[id] = { done: (d.pauses[id].done || 0) + Math.max(0, workingHoursBetween(c, d.pauses[id].open, t0)), open: null }; }); }
    // cover (S4-4): on leave or deactivated, the queue's leader has it; back from leave, it's theirs again
    const q = base.queues.find((x) => x.id === t.queue);
    const app = t.auto ? apps.find((a) => a.id === t.record) : null;
    const left = app ? officerNote(app) : null;
    let note = left;
    if (t.assignee && (!isActive(base, t.assignee) || onLeave(t.assignee, istYmd(t0))) && q?.leader && q.leader !== t.assignee) {
      const nm = (state.users.find((u) => u.id === t.assignee) || {}).name || 'they';
      note = isActive(base, t.assignee) ? `Covering while ${nm} is on leave` : `${nm} has left GSP: the leader has it`;
      t = { ...t, coverFor: t.assignee, assignee: q.leader };
    }
    if (note) t = { ...t, note };
    list.push(t);
  }
  const e = state.escalation || seed.ESCALATION;
  const tasks = list.map((t) => {
    if (t.status !== 'open') return t;
    const sla = slaOf(base, t);
    if (sla.state !== 'breached') return t;
    const late = workingHoursBetween(sla.cal, sla.due, t0);
    const q = base.queues.find((x) => x.id === t.queue);
    const ops = opsQueueOf(t.queue);
    const esc = late >= e.adminAfter * DAY_HOURS ? { level: 3, to: ADMIN_Q, text: 'Escalated to Admin' }
      : late >= e.opsAfter * DAY_HOURS ? { level: 2, to: ops, text: `Escalated to ${(base.queues.find((x) => x.id === ops) || {}).name || 'Admin'}` }
      : { level: 1, to: t.queue, text: `${q?.leader ? nameOfIn(base, q.leader) : 'The leader'} (leader) told` };
    return { ...t, esc };
  });
  // T66 (S4-28): an address that bounced 3 times in 7 days, from the email log the work makes (work/emailLog.ts)
  const t66 = base.rules.find((r) => r.row === 'T66');
  if (t66 && Object.keys(state.bounces || {}).length) {
    const sent = emailLog({ ...base, tasks }, t0);
    for (const [who, b] of Object.entries(state.bounces)) {
      const n = sent.filter((m) => m.toId === who && m.result === 'Bounced' && m.at > t0 - 7 * 864e5).sort((a, b2) => a.at - b2.at);
      if (n.length < 3 || !ruleLive(t66, n[2].at)) continue;
      const id = `R-set-users-${who}-T66-${b.email}`;
      if (state.closed?.[id]) continue;
      const q66 = queueOfRule(base, t66, { id });
      const lead = (base.queues.find((q) => q.id === q66) || {}).leader;
      const recId = `set-users-${who}`;
      if (!base.records.some((r) => r.id === recId)) base.records.push({ id: recId, type: 'Setting', label: 'GSP users', page: 'users' });
      tasks.push({ id, rule: 'T66', row: 'T66', kind: t66.kind, record: recId, queue: q66, goesTo: goesToOfRule(base, t66, id), assignee: (state.overrides?.[id] || {}).assignee || lead, created: n[2].at, status: 'open', auto: true, title: t66.task.replace('<person>', nameOfIn(base, who)).replace('<n>', String(n.length)), slaHours: state.frozen?.[id] ?? timeHours(t66.sla), closes: t66.closes });
    }
  }
  // the six statuses' usual times, from the rules that time them (S4-12): data/applications.ts reads these
  const statusSla = seed.STATUS_SLA.map((x) => { const r = base.rules.find((y) => y.row === x.row); return { ...x, days: r ? timeHours(r.after) || timeHours(r.sla) : 0 }; });
  view = { ...base, tasks, statusSla };
  vkey = [state, live, fl, leaveSnap, minute, cals, adminTick, rdb];
  flush();
  return view;
}
let adminTick = 0;
try { onAdminChange(() => { adminTick += 1; view = null; listeners.forEach((l) => l()); }); } catch { /* admin store not loaded */ }
const nameOfIn = (s, id) => (s.users.find((u) => u.id === id) || {}).name || '—';
let leaveSnap = 0;
subscribeLeave(() => { leaveSnap += 1; listeners.forEach((l) => l()); });
onLiveChange(() => listeners.forEach((l) => l()));
// an RP's record changes (a signed copy uploaded, accepted, training done): its tasks follow
onDbChange(() => { view = null; listeners.forEach((l) => l()); });
subscribeCalendars(() => { view = null; listeners.forEach((l) => l()); });
subscribeClock(() => { view = null; listeners.forEach((l) => l()); });

export function getState() { return derive(); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useStore(select = (s) => s) { return select(useSyncExternalStore(subscribe, getState)); }

/* update(draft => { ...change draft... }, 'What changed, for the log', 'event.name') */
export function update(fn, logText, event) {
  const next = structuredClone(state);
  for (const k of ['closed', 'overrides', 'officers', 'frozen', 'routed', 'pauses', 'appQueue']) next[k] = next[k] || {};
  const before = JSON.stringify(state.queues);
  fn(next);
  if (logText) next.log = [{ at: now(), who: next.persona, text: logText, event }, ...next.log].slice(0, 300);
  state = next; save(); view = null; listeners.forEach((l) => l());
  if (JSON.stringify(state.queues) !== before) syncAdminQueues();
}
/** A settings change (queues, kinds, rules, calendars, the ladder): the page's Change history and Admin's Audit log. */
export function logChange(event, text, by) {
  update(() => {}, text, event);
  try {
    setAdminCfg((c) => ({ ...c, log: [{ id: 'w' + now().toString(36) + Math.random().toString(36).slice(2, 5), at: now(), who: by || 'GSP · Admin', area: 'Work', text: `${text} (${event})`, kind: 'change' }, ...(c.log || [])] }));
  } catch { /* Admin's log not loaded */ }
}

export function resetAll() { state = fresh(); save(); view = null; listeners.forEach((l) => l()); syncAdminQueues(); }

/**
 * Key details › Assigned officer › Change (lock answer S3C-8): the application's officer becomes `to`; its open
 * tasks follow, since every application task goes to the officer (S4-5). `from` is the officer the application's
 * record has, so the change holds until the record itself changes. Logged as application.officer_changed.
 */
export function changeOfficer(appId, recordOfficer, to, by, toName) {
  update((d) => { d.officers[appId] = { officer: to, from: recordOfficer || null, why: 'changed', by, at: now() }; }, `${by} made ${toName || to} the officer on ${appId}; its open tasks moved to them`, 'application.officer_changed');
}

/**
 * A university reference fixed on an application (lock answer S3C-19): the mail conversations matched on that
 * reference move with it to the application that now has it. Logged as mail.thread_moved.
 */
export function moveThreadsByRef(ref, appId, by) {
  const key = String(ref || '').trim().toUpperCase();
  if (!key) return 0;
  const hits = (state.mail?.threads || []).filter((t) => String(t.fields?.['University reference'] || '').trim().toUpperCase() === key && t.record !== appId);
  if (!hits.length) return 0;
  update((d) => { for (const t of d.mail.threads) if (hits.some((h) => h.id === t.id)) t.record = appId; }, `${by} moved ${hits.length === 1 ? '1 mail conversation' : `${hits.length} mail conversations`} matched on reference ${key} to ${appId}`, 'mail.thread_moved');
  return hits.length;
}

/* ---------- task actions ---------- */
const titleOf = (id) => (getState().tasks.find((t) => t.id === id) || {}).title || id;
/** Done (the assignee): the task closes now, logged "<name> completed <task>". */
export function closeTask(id, by, outcome) {
  const name = nameOf(getState(), by), title = titleOf(id);
  update((d) => {
    const x = d.tasks.find((y) => y.id === id);
    if (x) { x.status = 'done'; x.doneAt = now(); x.doneBy = by; x.outcome = outcome; }
    else d.closed[id] = { at: now(), by, outcome };
  }, `${name} completed ${title}`, 'task.done');
}
/** Assign or Reassign one task (leader, a member, Admin, Global Ops): only that task moves (S4-5). */
export function assignTask(id, who, by) { assignTasks([id], who, by); }
/** Bulk Assign (S4-6): up to 50 at a time, to one person. */
export const BULK_MAX = 50;
export function assignTasks(ids, who, by) {
  const s = getState();
  const list = ids.slice(0, BULK_MAX).map((id) => s.tasks.find((t) => t.id === id)).filter(Boolean);
  update((d) => {
    for (const t of list) {
      const x = d.tasks.find((y) => y.id === t.id);
      if (x) x.assignee = who;
      else d.overrides[t.id] = { ...(d.overrides[t.id] || {}), assignee: who };
      d.gave = [{ id: t.id, title: t.title || t.id, from: t.coverFor || t.assignee, to: who, by, at: now() }, ...(d.gave || [])].slice(0, 200);
    }
  }, list.length === 1 ? `${nameOf(s, by)} gave ${list[0].title || list[0].id} to ${nameOf(s, who)}` : `${nameOf(s, by)} gave ${list.length} tasks to ${nameOf(s, who)}`, 'task.reassigned');
}
/**
 * A task from an RP event (slice 2's RP page calls this): T58 when the RP's agreement is executed, T32 when the
 * documents are sent, RPA when the signed agreement is uploaded. Same record and rule
 * twice: one task (idempotent).
 */
export function raiseRpTask(row, rp, at = now()) {
  const s = getState();
  const r = s.rules.find((x) => x.row === row);
  if (!r || !r.on) return null;
  const id = `R-${rp.id}-${row}`;
  if (s.tasks.some((t) => t.id === id)) return id;
  const queue = queueOfRule(s, r, { region: rp.region });
  const title = r.task.replace('<RP>', rp.name || rp.label);
  update((d) => {
    if (!d.records.some((x) => x.id === rp.id)) d.records.push({ id: rp.id, type: 'RP', label: rp.name || rp.label, region: rp.region, agency: rp.name, owner: rp.bdm || rp.owner });
    d.tasks.push({ id, rule: row, kind: r.kind, record: rp.id, queue, assignee: null, created: at, status: 'open', title, slaHours: timeHours(r.sla) });
  }, `Task ${row}: ${title}`, 'task.created');
  return id;
}

/* ---------- queues and kinds of work (5 Nov): Goes to ---------- */
/**
 * Delete a queue. Refused while any kind of work goes to it (returns those kinds; nothing changes): change their Goes
 * to first. Its open tasks move to the Admin queue. Logged queue.deleted.
 */
export function removeQueue(id, by) {
  const s = getState();
  const q = queueById(s, id);
  if (!q || id === ADMIN_Q) return { refused: [] };
  const kinds = kindsGoingTo(s, id);
  if (kinds.length) return { refused: kinds };
  const open = s.tasks.filter((t) => t.queue === id && t.status === 'open').length;
  update((d) => { d.queues = d.queues.filter((x) => x.id !== id); d.tasks.forEach((t) => { if (t.queue === id && t.status === 'open') t.queue = ADMIN_Q; }); });
  logChange('queue.deleted', `${by} deleted queue ${q.name}${open ? `; its ${open} open tasks moved to the Admin queue` : ''}`, by);
  return { refused: null, open };
}
/**
 * Add or save a kind of work. A new Goes to applies to new tasks only (open tasks keep theirs) and is logged
 * "<kind>: goes to <old> → <new>" (kind.goes_to); the rest is logged kind.saved.
 */
export function saveKind(k, by) {
  const s = getState();
  const was = kindById(s, k.id);
  update((d) => { const i = d.kinds.findIndex((x) => x.id === k.id); if (i >= 0) d.kinds[i] = k; else d.kinds.push(k); });
  const name = (to) => goesToName(s, to) || 'a deleted queue';
  if (was && was.goesTo !== k.goesTo) logChange('kind.goes_to', `${k.name}: goes to ${name(was.goesTo)} → ${name(k.goesTo)}`, by);
  if (!was || was.name !== k.name || was.record !== k.record || was.sla !== k.sla) logChange('kind.saved', `${by} ${was ? 'saved' : 'added'} kind of work ${k.name} (${k.sla} wh, goes to ${name(k.goesTo)})`, by);
}

/* ---------- testing aids (the Prototype bar on Emails and daily jobs): external events, not product actions ---------- */
/** Make a job's latest `n` runs fail (as an outage would): T65 and Admin Home's warning follow from the runs. */
export function simulateJobFailure(job, n = 1) {
  const runs = runTimes(job, now(), n);
  update((d) => { d.jobs = d.jobs || { fail: {} }; d.jobs.fail[job] = [...new Set([...(d.jobs.fail[job] || []), ...runs])]; }, `Prototype: ${job}'s last ${n === 1 ? 'run' : `${n} runs`} made to fail`, 'prototype.job_failed');
}
/** Mark a person's address as bouncing from 7 days ago (as SES would report): their emails since then bounce. */
export function simulateBounces(userId) {
  const u = getState().users.find((x) => x.id === userId);
  if (!u) return;
  update((d) => { d.bounces = { ...(d.bounces || {}), [userId]: { email: u.email, from: now() - 7 * 864e5 } }; }, `Prototype: emails to ${u.name} bounce`, 'prototype.email_bounced');
}
/** Clear every simulated failure and bounce. */
export function clearSimulations() {
  update((d) => { d.jobs = { fail: {} }; d.bounces = {}; }, 'Prototype: simulated failures and bounces cleared', 'prototype.cleared');
}

/* ---------- lookups ---------- */
export const userById = (s, id) => s.users.find((u) => u.id === id);
export const nameOf = (s, id) => (userById(s, id) || {}).name || '—';
export const roleOf = (s, id) => s.roles.find((r) => r.id === (userById(s, id) || {}).role);
export const recordById = (s, id) => s.records.find((r) => r.id === id);
export const queueById = (s, id) => s.queues.find((q) => q.id === id);
export const kindById = (s, id) => s.kinds.find((k) => k.id === id);
export const ruleById = (s, id) => s.rules.find((r) => r.row === id || r.id === id);

/* ---------- SLA clock: working hours on the record's region's calendar, IST ---------- */
const DAY = 864e5;
export function calendarFor(s, region) { return calendarOf(region || 'Global'); }

/**
 * A task's SLA (slice 4 PRD, States): due time, state (on-track, due-soon, breached, done) and its words. Due soon:
 * working hours left ≤ the smaller of 9 and half the SLA. A pause while the RP is asked (S4-10) adds its hours.
 */
export function slaOf(s, task) {
  const rec = recordById(s, task.record) || {};
  const hours = task.slaHours ?? hoursFor(s, task);
  const cal = calendarFor(s, rec.region);
  const p = (s.pauses || {})[task.id];
  const t1 = now();
  const pausedFor = (p?.done || 0) + (p?.open ? Math.max(0, workingHoursBetween(cal, p.open, t1)) : 0);
  const due = task.due || addWorkingHours(cal, task.created, hours + pausedFor);
  const days = hours / DAY_HOURS;
  if (task.status === 'done') return { due, days, hours, state: 'done', text: 'Done', cal };
  const left = workingHoursBetween(cal, t1, due);
  const today = istYmd(due) === istYmd(t1);
  let st = 'on-track';
  let text = today ? `Due today, ${istTime(due)}` : `Due ${istDate(due)}`;
  if (t1 > due) {
    const late = workingHoursBetween(cal, due, t1);
    st = 'breached';
    const h = Math.max(1, Math.floor(late)), dd = Math.floor(late / DAY_HOURS);
    text = late < DAY_HOURS ? `Late by ${h} working hour${h === 1 ? '' : 's'}` : `Late by ${dd} working day${dd === 1 ? '' : 's'}`;
  } else if (left <= Math.min(DAY_HOURS, hours / 2)) st = 'due-soon';
  const paused = p?.open ? `Paused while the RP answers: ${p.title || 'a request'}` : null;
  return { due, days, hours, state: st, text, cal, left, paused };
}

/* Timer on something GSP is waiting for (RP or university): Waiting on others. */
export function waitOf(rec) {
  if (!rec.waitingOn || !rec.due) return null;
  const d = Math.round((Date.parse(istYmd(rec.due)) - Date.parse(istYmd(now()))) / DAY);
  if (d < 0) return { state: 'breached', text: `${-d} day${d === -1 ? '' : 's'} past due: a chase task is raised` };
  if (d <= 1) return { state: 'due-soon', text: d === 0 ? 'Due today' : 'Due tomorrow' };
  return { state: 'on-track', text: `Due in ${d} days` };
}

export const SLA_PILL = { 'on-track': ['On track', 'dpill--verified'], 'due-soon': ['Due soon', 'dpill--checking'], breached: ['Breached', 'dpill--bad'], done: ['Done', 'dpill--verified'] };
/** For older callers: how a queue shares its work. */
export const QUEUE_ASSIGN = SHARE;
export const QUEUE_ASSIGN_HELP = SHARE_HELP;
export const ASSIGN = RULE_SHARE;

/* ---------- the bell's work notifications (slice 4 PRD, Tasks and SLAs) ---------- */
/**
 * What a person's bell holds from My work, worked out from the tasks as they are now: a task for you (created or
 * given to you), due tomorrow (SLA of 18 wh or more, S4-18), late (you and the queue's leader), escalated (level 2:
 * the Ops queue's members; level 3: every Admin), and a task you were covering or gave away. Each opens the task's
 * record. Only GSP people get these; read state is the bell's (per person).
 */
export function workNotes(s, me) {
  if (!me) return [];
  const user = s.users.find((u) => u.id === me);
  if (!user) return [];
  const out = [];
  const t1 = now();
  const e = s.escalation || seed.ESCALATION;
  const target = (t) => { const r = recordById(s, t.record) || {}; return r.type === 'Application' ? { app: r.id } : { page: 'mywork' }; };
  const gaveTo = new Map(s.gave.filter((g) => g.to === me).map((g) => [g.id, g]));
  const isAdmin = user.role === 'admin';
  for (const t of s.tasks) {
    if (t.status !== 'open') continue;
    const rec = recordById(s, t.record) || {};
    if (rec.region && !inScope(user, rec, s.roles)) continue; // never about a record they can't see
    const sla = slaOf(s, t);
    const q = queueById(s, t.queue);
    const mine = t.assignee === me;
    const lead = q?.leader === me;
    const to = target(t);
    if (mine) {
      const g = gaveTo.get(t.id);
      if (g) out.push({ id: `tk-g-${t.id}-${g.at}`, kind: 'system', title: `${nameOf(s, g.by)} gave you ${t.title}`, text: 'My work: a task for you', at: g.at, to });
      else out.push({ id: `tk-c-${t.id}`, kind: 'system', title: t.title, text: t.coverFor ? `My work: covering while ${nameOf(s, t.coverFor)} is away` : 'My work: a task for you', at: t.created, to });
      if (sla.hours >= 18) {
        const at = addWorkingHours(sla.cal, t.created, Math.max(0, sla.hours - e.remindBefore * DAY_HOURS));
        if (t1 >= at && t1 < sla.due) out.push({ id: `tk-s-${t.id}`, kind: 'system', title: `Due tomorrow: ${t.title}`, text: `${rec.label || ''}`.trim() || 'My work', at, to });
      }
    }
    if (sla.state === 'breached' && (mine || lead)) out.push({ id: `tk-b-${t.id}`, kind: 'system', title: `Late: ${t.title}`, text: `${nameOf(s, t.assignee)} · due ${istDate(sla.due)}, ${istTime(sla.due)}`, at: sla.due, to });
    if (t.esc && t.esc.level >= 2) {
      const ops = queueById(s, t.esc.to);
      const inOps = ops && (ops.leader === me || (ops.members || []).includes(me));
      if ((t.esc.level === 2 && inOps) || (t.esc.level === 3 && isAdmin)) {
        const late = Math.floor(workingHoursBetween(sla.cal, sla.due, t1) / DAY_HOURS);
        out.push({ id: `tk-e${t.esc.level}-${t.id}`, kind: 'system', title: `Escalated: ${t.title}`, text: `Late by ${late} working day${late === 1 ? '' : 's'} · ${nameOf(s, t.assignee)}`, at: addWorkingHours(sla.cal, sla.due, (t.esc.level === 3 ? e.adminAfter : e.opsAfter) * DAY_HOURS), to });
      }
    }
  }
  for (const g of s.gave) if (g.from === me && g.to !== me) out.push({ id: `tk-o-${g.id}-${g.at}`, kind: 'system', title: `${nameOf(s, g.by)} gave ${g.title} to ${nameOf(s, g.to)}`, text: 'My work', at: g.at, to: { page: 'mywork' } });
  return out.filter((n) => n.at <= t1 + 36e5);
}
/** For pages outside My work: is this person Admin, Global Ops or View Only (sees every queue)? */
export const seesAll = (roleId) => oversees(roleId);
/** The applications a person covers as "the officer" for the bell: their regional queue's leader while the officer is on leave or has left GSP. */
export function coveringApps(s, me) {
  if (!me) return [];
  return s.records.filter((r) => r.type === 'Application' && !r.closed && r.officer && r.officer !== me && (onLeave(r.officer, istYmd(now())) || !s.users.some((u) => u.id === r.officer)) && (queueById(s, regionQueueId(r.region || 'Direct', s.queues)) || {}).leader === me).map((r) => r.id);
}
