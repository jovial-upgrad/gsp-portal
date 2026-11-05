// @ts-nocheck -- typed with the work API.
/**
 * Where a task goes (Jovial, 5 Nov): one setting, the kind of work's **Goes to** (Admin › Work › Queues, SLA and
 * escalation › Kinds of work). Every task rule takes its queue from its kind; a rule has no queue of its own. Goes to
 * is a queue's id, or one of two routed destinations:
 *  - 'region': the application's regional Admissions queue (Sales regions › Admissions queue); only for a kind whose
 *    record is Application;
 *  - 'recruitment': the RP's region's Recruitment queue; only for a kind whose record is RP.
 * A task keeps the Goes to it was created with (`s.routed`, kept by the store): a change applies to new tasks only.
 * Every engine (engine.ts, rpRules.ts, recordRules.ts, store.ts) resolves a rule's queue through `queueOfRule`.
 */
import { regionQueueId, recruitmentQueueId, regionsNow } from './seed';

const ADMIN_Q = 'q-admin';
export const BY_REGION = 'region';
export const BY_RECRUITMENT = 'recruitment';
/** The routed destinations, each with the record a kind must be about to use it, and its words. */
export const ROUTED = [
  { id: BY_REGION, record: 'Application', name: 'The application’s regional Admissions queue' },
  { id: BY_RECRUITMENT, record: 'RP', name: 'The RP’s Recruitment queue' },
];

export const kindOf = (s, id) => (s.kinds || []).find((k) => k.id === id);
/** What a kind of work may go to: the routed destination its record allows, then every queue (from the queues store). */
export const goesToOptions = (s, record) => [
  ...ROUTED.filter((x) => x.record === record).map((x) => [x.id, x.name]),
  ...(s.queues || []).map((q) => [q.id, q.name]),
];
/** A Goes to value in words: the routed destination's name, the queue's name, or null when the queue is gone. */
export const goesToName = (s, to) => ROUTED.find((x) => x.id === to)?.name ?? (s.queues || []).find((q) => q.id === to)?.name ?? null;
/** Is `to` a Goes to this kind may have (required; routed only for its record; a queue that exists)? */
export const goesToValid = (s, kind, to) => !!to && (ROUTED.some((x) => x.id === to) ? ROUTED.some((x) => x.id === to && x.record === kind.record) : (s.queues || []).some((q) => q.id === to));

/** A rule's Goes to: what the task `id` was created with, else its kind of work's now. */
export const goesToOfRule = (s, r, id) => (id != null && s.routed?.[id]) || kindOf(s, r?.kind)?.goesTo || null;

/**
 * The queue a rule's task goes to. `ctx`: `id` (the task, for the Goes to it was made with), `region` (the record's
 * sales region), `appQueue` (the application's regional queue, or a function giving it). A queue that no longer
 * exists, or no Goes to: the Admin queue.
 */
export function queueOfRule(s, r, ctx = {}) {
  const to = goesToOfRule(s, r, ctx.id);
  const queues = s.queues || [];
  if (to === BY_REGION) {
    const q = typeof ctx.appQueue === 'function' ? ctx.appQueue() : ctx.appQueue;
    return q || regionQueueId(ctx.region || 'Direct', queues);
  }
  if (to === BY_RECRUITMENT) return recruitmentQueueId(ctx.region, queues);
  return queues.some((q) => q.id === to) ? to : ADMIN_Q;
}

/** The kinds of work whose Goes to is this queue (a queue can't be deleted while any do). */
export const kindsGoingTo = (s, qid) => (s.kinds || []).filter((k) => k.goesTo === qid);
/** Is this queue some sales region's Admissions queue, or some region's Recruitment queue (so routed kinds reach it)? */
const regionsOf = () => { try { return [...new Set([...regionsNow(), 'Direct'])]; } catch { return []; } };
export const isRegionalQueue = (s, qid) => regionsOf().some((r) => regionQueueId(r, s.queues || []) === qid);
export const isRecruitmentQueue = (s, qid) => regionsOf().some((r) => recruitmentQueueId(r, s.queues || []) === qid);
/** What lands in a queue: the kinds that go to it by name, and the routed kinds it gets as a region's queue. */
export function receivesOf(s, q) {
  const direct = kindsGoingTo(s, q.id);
  const region = isRegionalQueue(s, q.id) ? (s.kinds || []).filter((k) => k.goesTo === BY_REGION) : [];
  const recruitment = isRecruitmentQueue(s, q.id) ? (s.kinds || []).filter((k) => k.goesTo === BY_RECRUITMENT) : [];
  return { direct, region, recruitment, all: [...direct, ...region, ...recruitment] };
}
