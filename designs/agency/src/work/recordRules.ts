// @ts-nocheck -- typed with the work API.
/**
 * Every task rule that isn't about one application's status (slice 4 PRD, Every timer; Admin tasks, S4-28), worked
 * out from the records and settings as they are now, the same way the application rules work (work/engine.ts):
 * RPs (slice 2), institution partners, universities and courses, the shared mailboxes' conversations, Finance's
 * commission lines, and Admin's own settings and daily jobs. A task exists while its condition holds and closes
 * itself when the record moves on; nothing is seeded. Each hit names its rule; a rule with no logic here makes nothing.
 *
 * The rules are data (Admin › Work › Task rules: on/off, start after, SLA, sharing; the queue is the kind of work's
 * Goes to); only the trigger is code.
 * Calendar days ("90 days", "14 days") are plain dates; working days count on the record's region's calendar.
 * Date rules (1 March, 1 December, Fridays, Mondays) fire from the work service's start (WORK_START) onwards: the
 * jobs that raise them (J3, J8) didn't run before it, so nothing is made for dates before it.
 */
import { regionOfPlace } from '../data/regions';
import { queueOfRule, goesToOfRule } from './routing';
import { ruleLive, timeHours, afterFrom } from './engine';
import { calendarOf } from './calendars';
import { agreementOf, EXECUTED, ENDED, RP_ONBOARDING } from '../institution/data/records';
import { destinations } from '../data/reference';
import { istAt, istYmd, istWeekday } from './clock';
import { jobRuns, JOB_NAME } from './jobs';
import { fmtDate } from '../data/format';

const DAY = 864e5;
/** When the work service started running its jobs (prototype: the day slice 4 was locked, 2 Nov 2026, IST). */
export const WORK_START = Date.parse('2026-11-02T00:00:00+05:30');

/** "2026-05-01" (a record's own date) at 10:00 IST, as a moment. */
const atDay = (iso) => (iso ? Date.parse(`${String(iso).slice(0, 10)}T10:00:00+05:30`) : NaN);
const latest = (...xs) => Math.max(...xs.filter((x) => Number.isFinite(x)));
/** A person's user id from their name (records keep names; tasks need ids). */
const idOf = (s, name) => (name ? s.users.find((u) => u.name === name)?.id : undefined);

/* ---------- the record each rule's task is about (My work's Record column, and what opening it opens) ---------- */
const rpRec = (s, r) => ({ id: r.id, type: 'RP', label: r.name, region: regionOfPlace(r.country), agency: r.name, page: 'rps', owner: idOf(s, r.bdm) });
const ipRec = (s, p) => ({ id: p.id, type: 'Institution partner', label: p.name, page: 'partners', owner: idOf(s, p.rm) });
const uniRec = (s, u, p) => ({ id: u.id, type: 'University', label: u.name, page: 'universities', owner: idOf(s, p?.rm) });
const courseRec = (c) => ({ id: c.id, type: 'Course', label: `${c.name} · ${c.uni?.name ?? ''}`.replace(/ · $/, ''), page: 'courses' });
const mailRec = (t) => ({ id: t.id, type: 'Email', label: `Email · ${t.subject}`, page: 'mail' });
/** An Admin setting a task points at: the page that fixes it (GSP · Admin). */
const SETTING_PAGE = { fx: ['Currency exchange', 'currency'], routing: ['Application routing', 'routing'], calendars: ['Working days', 'work-sla'], living: ['Living costs and fees', 'living'], jobs: ['Emails and daily jobs', 'work-mail'], users: ['GSP users', 'users'], queues: ['Queues, SLA and escalation', 'work-sla'], docs: ['Document configuration', 'documents'] };
const setRec = (k, extra = '') => ({ id: `set-${k}${extra ? `-${extra}` : ''}`, type: 'Setting', label: SETTING_PAGE[k][0], page: SETTING_PAGE[k][1] });
const commRec = (id, label) => ({ id, type: 'Commission', label, page: 'fin-rp' });

/** The latest moment at or before `now` that is weekday `wd` at `hm` IST, and on or after WORK_START; else null. */
function lastWeekly(now, wd, hm) {
  for (let k = 0; k < 8; k++) {
    const day = istYmd(now - k * DAY);
    const t = istAt(day, hm);
    if (istWeekday(t) === wd && t <= now) return t >= WORK_START ? t : null;
  }
  return null;
}
/** The latest `mm-dd` (01:00 IST) at or before `now`, on or after WORK_START; else null. */
function lastYearly(now, mmdd) {
  const y = Number(istYmd(now).slice(0, 4));
  for (const yy of [y, y - 1]) {
    const t = istAt(`${yy}-${mmdd}`, '01:00');
    if (t <= now) return t >= WORK_START ? t : null;
  }
  return null;
}

/**
 * The rules, by row: each returns the hits (one per task) for the records as they are now. A hit: `key` (with the
 * rule and record, the task id: the same condition never makes two tasks), `rec` (its record), `since` (when the
 * condition started; the rule's "start after" counts from it) and `vars` for the title's placeholders.
 */
export const RECORD_LOGIC = {
  /* ---- RPs (slice 2) ---- */
  T32: (x) => x.rdb.rps.filter((r) => r.status === 'Verifying' && r.docs.some((d) => d.state === 'With BAP')).map((r) => ({ key: 'docs', rec: rpRec(x.s, r), since: statusSince(r), vars: { RP: r.name } })),
  T34: (x) => x.rdb.rps.filter((r) => r.status === 'Documents sent back').map((r) => ({ key: 'sent-back', rec: rpRec(x.s, r), since: latest(...r.docs.filter((d) => d.state === 'Sent back').map((d) => d.at), statusSince(r)), vars: { RP: r.name } })),
  T33: (x) => x.rdb.rps.filter((r) => r.status === 'Not activated').map((r) => ({ key: 'signup', rec: rpRec(x.s, r), since: atDay(r.since), vars: { RP: r.name } })),
  T37: (x) => x.rdb.rps.filter((r) => r.status === 'Agreement signed').map((r) => {
    const last = latest(...x.apps.filter((a) => a.rp === r.name).map((a) => a.history?.[0]?.at ?? a.since), r.approved?.at, atDay(r.since));
    return { key: String(last), rec: rpRec(x.s, r), since: last, vars: { RP: r.name } };
  }),
  W23: (x) => x.rdb.rps.filter((r) => ONBOARDING.includes(r.status) && r.bdm && !r.firstCall).map((r) => ({ key: 'assigned', rec: rpRec(x.s, r), since: atDay(r.since), vars: { RP: r.name } })),
  T36: (x) => x.rdb.rps.filter((r) => r.lifecycleRequest?.state === 'open').map((r) => ({ key: String(r.lifecycleRequest.at), rec: rpRec(x.s, r), since: r.lifecycleRequest.at, vars: { RP: r.name } })),
  T35: (x) => x.rdb.rps.filter((r) => r.bankChange?.state === 'open').map((r) => ({ key: String(r.bankChange.at), rec: rpRec(x.s, r), since: r.bankChange.at, maker: idOf(x.s, r.bankChange.by), vars: { RP: r.name } })),

  /* ---- institution partners, universities, courses (slice 2) ---- */
  T38: (x, rule) => x.rdb.ips.filter((p) => p.status === EXECUTED || p.status === ENDED).map((p) => {
    const a = agreementOf(p);
    if (!a?.end) return null;
    const since = atDay(a.end) - (Number(rule.days) || 60) * DAY;
    return { key: a.end, rec: ipRec(x.s, p), since, vars: { partner: p.name } };
  }).filter(Boolean),
  T40: (x) => x.rdb.unis.filter((u) => u.status === 'Setting up').map((u) => ({ key: 'golive', rec: uniRec(x.s, u, x.rdb.ips.find((p) => p.id === u.ip)), since: (u.created?.at ?? atDay(u.added)) + 14 * DAY, vars: { university: u.name } })),
  T41: (x) => x.rdb.courses.filter((c) => c.status === 'Draft').map((c) => ({ key: 'draft', rec: courseRec(c), since: (c.created?.at ?? x.now) + 7 * DAY, vars: { course: c.name } })),
  T42: (x) => x.rdb.courses.filter((c) => c.status === 'Live' && c.intakes?.length && c.intakes.every((i) => atDay(i.deadline) < x.now)).map((c) => {
    const last = latest(...c.intakes.map((i) => atDay(i.deadline)));
    return { key: String(last), rec: courseRec(c), since: last, vars: { course: c.name } };
  }),

  /* ---- the shared mailboxes' conversations (Mail) ---- */
  T6: (x) => x.threads.filter((t) => t.record && (t.state ?? 'needs') === 'needs' && t.conf >= x.mailCfg.autoFile && t.mailbox === 'mb-adm').map((t) => ({ key: 'needs', rec: mailRec(t), app: t.record, since: lastIn(t), vars: { student: x.studentOf(t.record) } })),
  T26: (x) => x.threads.filter((t) => t.state === 'match' && t.conf >= x.mailCfg.suggest && t.conf < x.mailCfg.autoFile && t.intent !== 'new').map((t) => ({ key: 'check', rec: mailRec(t), since: lastIn(t) })),
  T27: (x) => x.threads.filter((t) => t.state === 'match' && !t.record && t.conf < x.mailCfg.suggest && t.intent !== 'new').map((t) => ({ key: 'match', rec: mailRec(t), since: lastIn(t) })),
  T28: (x) => x.threads.filter((t) => t.state === 'match' && t.intent === 'new').map((t) => ({ key: 'new', rec: mailRec(t), since: lastIn(t) })),
  T29: (x) => x.threads.filter((t) => t.mailbox === 'mb-admin' && (t.state ?? 'needs') !== 'done').map((t) => ({ key: 'admin', rec: mailRec(t), since: lastIn(t) })),
  T30: (x) => x.threads.filter((t) => t.mailbox === 'mb-comm' && (t.state ?? 'needs') !== 'done').map((t) => ({ key: 'remit', rec: mailRec(t), since: lastIn(t) })),
  T31: (x) => x.filed.filter((f) => f.filter === 'f-marketing' && !f.reviewed).map((f) => ({ key: 'news', rec: { id: f.id, type: 'Email', label: `Newsletter · ${f.subject}`, page: 'mail' }, since: f.at })),

  /* ---- commission (slice 5 owns what each task does) ---- */
  T39: (x) => (x.comm?.missingTerms || []).map((m) => ({ key: m.id, rec: commRec(`cm-terms-${m.id}`, `Commission terms · ${m.name}`), since: m.since, vars: { partner: m.name } })),
  T45: (x) => (x.comm?.checks || []).filter((k) => k.status === 'waiting').map((k) => ({ key: k.id, rec: commRec(`cm-check-${k.id}`, k.title || `Change ${k.id}`), since: k.at ?? k.made ?? x.now, maker: k.maker, vars: { record: k.title || k.id } })),
  T46: (x) => groupLines(x.comm?.lines, (l) => /^(Ready|Top-up) to invoice/.test(l.st?.[0] ?? '')).map((g) => ({ key: g.key, rec: commRec(`cm-inv-${g.key}`, `Invoices due · ${g.name}`), since: g.since, vars: { record: g.name } })),
  T47: (x) => groupLines(x.comm?.lines, (l) => l.st?.[0] === 'Payment overdue').map((g) => ({ key: g.key, rec: commRec(`cm-od-${g.key}`, `Payment overdue · ${g.name}`), since: g.since, vars: { record: g.name } })),
  T48: (x) => (x.comm?.exc || []).map((e, i) => ({ key: `${e.app || 'x'}-${e.type}`, rec: commRec(`cm-exc-${e.app || i}-${e.type}`.replace(/\W+/g, '-'), `Exception · ${e.type}${e.app ? ` · ${e.app}` : ''}`), since: x.comm.since, vars: { record: e.app || e.type } })),
  T49: (x) => {
    const mon = lastWeekly(x.now, 1, '01:00');
    if (!mon || (x.comm?.runs || []).some((r) => (r.approvedAt ?? atDay(r.date)) >= mon)) return [];
    return [{ key: istYmd(mon), rec: commRec(`cm-run-${istYmd(mon)}`, `Payout run · week of ${istYmd(mon)}`), since: mon }];
  },

  /* ---- Admin (T50, and S4-28's T60 to T68) ---- */
  T50: (x) => {
    const fri = lastWeekly(x.now, 5, '01:00');
    if (!fri) return [];
    const next = istYmd(fri + 3 * DAY); // the Monday after
    return x.cfg.fxWeeks.some((w) => w.week === next) ? [] : [{ key: next, rec: setRec('fx'), since: fri }];
  },
  T60: (x) => {
    const wk = x.cfg.fxWeeks.filter((w) => w.week <= istYmd(x.now)).sort((a, b) => b.week.localeCompare(a.week))[0];
    const used = [...new Set([...(x.comm?.currencies || []), ...x.rdb.courses.filter((c) => c.status === 'Live').map((c) => c.currency)].filter(Boolean))];
    return used.filter((c) => c !== 'AUD' && !(wk && Number(wk[c]) > 0)).map((c) => ({ key: `${c}-${wk?.week ?? 'none'}`, rec: setRec('fx', c), since: wk ? atDay(wk.week) : WORK_START, vars: { currency: c, date: fmtDate(wk ? atDay(wk.week) : WORK_START) } }));
  },
  T61: (x) => x.apps.filter((a) => a.status !== 'docs' && a.routed && a.routed.fallback).map((a) => ({ key: a.id, rec: setRec('routing', a.id), since: a.since, vars: { student: a.student, country: a.routed.nationality || a.routed.livesIn || 'an unmapped country' } })),
  T63: (x) => {
    const dec = lastYearly(x.now, '12-01');
    if (!dec) return [];
    const next = String(Number(istYmd(dec).slice(0, 4)) + 1);
    return x.cals.filter((c) => (c.regions || []).length && !(c.holidays || []).some(([d]) => String(d).startsWith(next))).map((c) => ({ key: `${c.id}-${next}`, rec: setRec('calendars', c.id), since: dec, vars: { year: next, calendar: c.name } }));
  },
  T64: (x) => {
    const mar = lastYearly(x.now, '03-01');
    return mar ? [{ key: istYmd(mar).slice(0, 4), rec: setRec('living'), since: mar, vars: { year: istYmd(mar).slice(0, 4) } }] : [];
  },
  T65: (x) => Object.keys(JOB_NAME).map((j) => {
    const runs = jobRuns(j, x.now, x.jobs, 1);
    const r = runs[0];
    return r?.error ? { key: `${j}-${r.at}`, rec: setRec('jobs', j), since: r.end, vars: { job: `${j} ${JOB_NAME[j]}`, date: fmtDate(r.at) } } : null;
  }).filter(Boolean),
  // T66 (bounces) is worked out after the other tasks, from the email log they make (work/store.ts derive)
  T67: (x) => {
    // a leader is required on save: only a queue saved before that can have none. Every kind of work has a Goes to
    // (required, 5 Nov), so "no queue receives a kind" can't happen and isn't checked.
    return x.s.queues.filter((q) => !q.leader).map((q) => ({ key: `lead-${q.id}`, rec: setRec('queues', q.id), since: WORK_START, vars: { what: `${q.name} has no leader` } }));
  },
  T68: (x) => {
    const on = x.cfg.docRules.filter((r) => r.on);
    const covers = (pick) => on.some((r) => pick(r.cond || { levels: [], countries: [] }));
    const levels = x.rdb.levels.filter((l) => !l.retired && !covers((c) => !c.levels.length || c.levels.includes(l.name))).map((l) => l.name);
    const dests = destinations().filter((d) => !covers((c) => !c.countries.length || c.countries.map(catName).includes(d)));
    return [...levels, ...dests].map((what) => ({ key: what, rec: setRec('docs', what), since: WORK_START, vars: { 'level / destination': what } }));
  },
};
const ONBOARDING = RP_ONBOARDING;
const catName = (c) => ({ 'United Kingdom': 'UK', 'United States': 'USA' })[c] ?? c;
/** When an RP's status last changed: its latest logged step, else the day it joined. */
function statusSince(r) {
  return latest(...(r.activity || []).map((e) => e.time ?? atDay(e.at)), atDay(r.since));
}
const lastIn = (t) => latest(...(t.messages || []).filter((m) => m.dir !== 'out').map((m) => m.at), t.at);
/** Finance's lines, one task per university (its record), from the oldest line's date. */
function groupLines(lines, pick) {
  const by = new Map();
  for (const l of (lines || []).filter(pick)) {
    const k = l.uniId || l.uni || 'x';
    const g = by.get(k) || { key: String(k).replace(/\W+/g, '-'), name: l.uniName || l.uni || String(k), since: Infinity };
    g.since = Math.min(g.since, atDay(l.date));
    by.set(k, g);
  }
  return [...by.values()].map((g) => ({ ...g, since: Number.isFinite(g.since) ? g.since : WORK_START }));
}

/** The title from the rule's wording, its placeholders filled from the hit. */
const fillTitle = (task, vars = {}) => task.replace(/<([^>]+)>/g, (m, k) => vars[k] ?? m).replace(/ \(“.*$/, '');

/**
 * The tasks the record rules make right now, and the records they're about (for My work's Record column). The
 * queue is the rule's kind of work's Goes to (routing.ts): 'recruitment' the RP's region's Recruitment queue,
 * 'region' the application's regional queue, else the named queue.
 */
export function recordTasks(s, x, now) {
  const tasks = [], records = [];
  for (const [row, logic] of Object.entries(RECORD_LOGIC)) {
    const r = s.rules.find((y) => y.row === row);
    if (!r) continue;
    for (const hit of logic(x, r) || []) {
      if (!hit || !Number.isFinite(hit.since)) continue;
      const cal = calendarOf(hit.rec.region || 'Global');
      const start = r.after ? afterFrom(cal, hit.since, r.after) : hit.since;
      if (!ruleLive(r, hit.since) || now < start) continue;
      const id = `R-${hit.rec.id}-${row}-${hit.key}`;
      if (s.closed?.[id]) continue;
      const queue = queueOfRule(s, r, { id, region: hit.rec.region, appQueue: () => x.queueOfApp(hit.app) });
      const assignee = r.share === 'officer' && hit.app ? x.officerOfApp(hit.app) : null;
      const reminded = r.remind ? afterFrom(cal, hit.since, r.remind) : null;
      tasks.push({
        id, rule: row, row, kind: r.kind, record: hit.app || hit.rec.id, queue, goesTo: goesToOfRule(s, r, id), assignee, maker: hit.maker, share: r.share && r.share !== 'officer' ? r.share : null, created: start, status: 'open', auto: true,
        title: fillTitle(r.task, hit.vars), slaHours: s.frozen?.[id] ?? timeHours(r.sla), closes: r.closes, reminded: reminded && now > reminded ? reminded : null,
      });
      if (!hit.app) records.push(hit.rec);
    }
  }
  return { tasks, records };
}
