/**
 * The commission store (Jovial, 9 Nov): the records Commissions keeps, as one shared store standing in for the
 * product's back end, so every role's page reads the same thing: Finance's Setup and Commission lines, the RP's,
 * university's and application's Commission tabs in every role, the go-live checklist, My work and the RP's Earnings.
 * Each change goes through one of the actions below, which also writes its Logs line.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { COURSES } from '../../data/courses';
import { fullName, type Student } from '../../data/students';
import type { Application } from '../../data/applications';
import { sampleCourseRecs, sampleUniRecs } from '../../institution/data/catalogue';
import { samplePartners, subscribeClock, todayIso } from '../../institution/data/records';
import { HOME_RP } from '../../gsp/rps';
import { agreementsOf, regionOf, sampleOps, type OpsRp } from '../../rpops/records/data';
import { sampleComm } from './seed';
import { sampleUsers } from '../../admin/data/config';
import { compute, nextInvoiceNumber, periodCount, settleAll, type Ctx, type CtxCourse, type CtxUni, type Result } from './engine';
import { COMM_LEVELS, benefitText, money, ratesText, rpViewText, shareText, type RpView, type Agreement, type CommState, type Enrolment, type FileRef, type Log, type LogArea, type Notice, type RpRecord, type Settings, type UniGroup, type UniTerms } from './model';
import { CURRENCY } from '../../data/courses';

/* ---------- the store ---------- */

let state: CommState = sampleComm();
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const commState = () => state;
export function setComm(fn: (s: CommState) => CommState) {
  const next = fn(state);
  if (next === state) return;
  state = next;
  subs.forEach((f) => f());
}
/** Back to the seeded records (the Prototype panel's reset, and tests). */
export const resetComm = () => setComm(() => sampleComm());
export const useComm = () => useSyncExternalStore(subscribe, commState, commState);
// the Prototype panel's clock moved: every line's status is worked out again for the new date
subscribeClock(() => setComm((s) => ({ ...s })));

/**
 * A commission scenario (Prototype panel, Jovial 12 Nov): one of the sandbox's cases, its own small world of
 * universities, RPs, courses and records, in place of the seeded ones until the reviewer leaves it. Its lines are
 * worked out by this same engine; nothing is written for the scenario but its records.
 */
export type World = { id: string; unis: CtxUni[]; rps: (OpsRp & { region: string })[]; courses: Map<string, CtxCourse> };
let world: World | null = null;
let saved: CommState | null = null;
const worldSubs = new Set<() => void>();
export const worldOn = () => world;
export const useWorld = () => useSyncExternalStore((f) => (worldSubs.add(f), () => void worldSubs.delete(f)), worldOn, worldOn);
export function enterWorld(s: CommState, w: World) {
  if (!world) saved = state;
  world = w;
  worldSubs.forEach((f) => f());
  setComm(() => s);
}
export function leaveWorld() {
  if (!world) return;
  world = null;
  const back = saved ?? sampleComm();
  saved = null;
  worldSubs.forEach((f) => f());
  setComm(() => back);
}

/**
 * The Prototype panel's "Earnings as" (RP Admin, for Deepesh's walkthrough, 11 Nov): see another seeded RP's Earnings.
 * Prototype only; empty is the signed-in agency.
 */
let earnAs = '';
const earnSubs = new Set<() => void>();
export const setEarnAs = (rp: string) => {
  earnAs = rp;
  earnSubs.forEach((f) => f());
};
export const useEarnAs = () => useSyncExternalStore((f) => (earnSubs.add(f), () => void earnSubs.delete(f)), () => earnAs, () => earnAs);

/* ---------- what the engine reads from other modules ---------- */

let unis: CtxUni[] | null = null;
let rps: (OpsRp & { region: string })[] | null = null;
const courses = new Map(COURSES.map((c) => [c.id, c]));
/** The universities, as the Institution Team keeps them (seeded). */
export const ctxUnis = (): CtxUni[] => world?.unis ?? (unis ??= sampleUniRecs().map((u) => ({ id: u.id, name: u.name, country: u.country, ip: u.ip, status: u.status, added: u.added, agreement: agreementDates(u.ip) }) as CtxUni & { status: string; added: string }));
/**
 * A university's agreement dates, from its institution partner's documents (the IP tab's rule): from the earliest start
 * to the latest end of its New agreement and Renewal documents. Enrolments outside them are held (D11).
 */
function agreementDates(ip?: string) {
  const p = ip ? samplePartners().find((x) => x.id === ip) : undefined;
  const docs = (p?.docs ?? []).filter((d) => d.start && d.end && /agreement|renewal/i.test(d.type));
  if (!docs.length) return null;
  return { start: docs.map((d) => d.start).sort()[0], end: docs.map((d) => d.end).sort().slice(-1)[0] };
}
/** The recruitment partners, as RP Ops keeps them (seeded), with their sales region. */
export const ctxRps = () => world?.rps ?? (rps ??= sampleOps().map((r) => ({ ...r, region: regionOf(r.country) })));
/** RPs whose partner agreement GSP has accepted: the ones that can have a commission record. */
export const acceptedRps = () => ctxRps().filter((r) => !!agreementsOf(r).active || !!agreementsOf(r).next);
/** The day the RP's accepted agreement took effect: From's default. */
export const acceptedOn = (rp: string) => {
  const r = ctxRps().find((x) => x.id === rp);
  const a = r && (agreementsOf(r).active ?? agreementsOf(r).next);
  return a?.effective ?? todayIso();
};
const course = (id: string): CtxCourse | undefined => {
  if (world) return world.courses.get(id);
  const c = courses.get(id);
  // no fee: commission is worked out from the student's own fee on the application (9 Nov)
  return c && { id: c.id, name: c.name, level: c.level, months: c.months, currency: c.currency, uni: c.uni.id };
};
export const ctxOf = (today = todayIso()): Ctx => ({ unis: ctxUnis(), rps: ctxRps(), course, today });
export const uniCurrency = (uni: string) => {
  const u = ctxUnis().find((x) => x.id === uni);
  return u ? CURRENCY[u.country] : '';
};
/** The university's commission terms for a course's university, and the study periods it pays on (Admissions fills a date for each). */
export const termsForCourse = (courseId: string) => {
  const c = courses.get(courseId);
  const t = c && state.terms.find((x) => x.uni === c.uni.id);
  return { terms: t, periods: c && t ? periodCount(t, c.months) : 1 };
};
let courseRecs: ReturnType<typeof sampleCourseRecs> | null = null;
/** The census date the Institution team keeps on a course's intake (D6: Key details starts from it; empty when none). */
export const intakeCensus = (courseId: string, intake: string) => {
  const c = (courseRecs ??= sampleCourseRecs()).find((x) => x.id === courseId);
  return c?.dates?.[intake.split(' ')[0]]?.census || c?.dates?.[intake]?.census || '';
};
/** The program levels a university offers, in the levels' order: University terms asks a rate for each. */
/**
 * The courses the forms offer (rate rows, promotions, bonus conditions): the catalogue, or a commission scenario's own
 * courses while one is open.
 */
export const catalogue = (): { name: string; level: string; uni: string; campus: string }[] =>
  world
    ? [...world.courses.values()].filter((c): c is CtxCourse => !!c).map((c) => ({ name: c.name, level: c.level, uni: c.uni, campus: '' }))
    : COURSES.map((c) => ({ name: c.name, level: c.level, uni: c.uni.id, campus: c.campus.name }));
/** The levels University terms asks a rate for: the university's courses' levels, and any level its terms already price. */
export const levelsOf = (uni: string) => {
  const t = state.terms.find((x) => x.uni === uni);
  const priced = new Set([...Object.keys(t?.rates ?? {}), ...Object.keys(t?.fixed ?? {})]);
  return COMM_LEVELS.filter((l) => priced.has(l) || catalogue().some((c) => c.uni === uni && c.level === l));
};
let ips: { id: string; name: string }[] | null = null;
/** Institution partners' names, for University terms' list. */
export const ipName = (id?: string) => (ips ??= samplePartners().map((p) => ({ id: p.id, name: p.name }))).find((p) => p.id === id)?.name ?? '';
export const rpName = (id: string) => ctxRps().find((r) => r.id === id)?.name ?? id;
export const uniName = (id: string) => ctxUnis().find((u) => u.id === id)?.name ?? id;

/** The portal's own applications at Student enrolled, as the engine reads them (their RP: the one on it, else the prototype's agency). */
export function enrolmentsOf(apps: Application[], students: Pick<Student, 'id' | 'first' | 'last' | 'oneName'>[]): Enrolment[] {
  // a scenario's world has only its own enrolments
  if (world) return [];
  return apps
    .filter((a) => a.status === 'enrolled')
    .map((a) => {
      const s = students.find((x) => x.id === a.studentId);
      const rp = ctxRps().find((r) => r.name === (a.rp ?? HOME_RP));
      return { app: a.id, student: s ? fullName(s as Student) : a.studentId, nationality: (s as Student | undefined)?.nationality, rp: rp?.id ?? '', course: a.courseId, intake: a.intake, enrolled: new Date(a.since).toISOString().slice(0, 10), fees: a.fees };
    });
}

/** Every commission item and transaction, worked out from the store and the portal's applications. */
export function useLines(apps: Application[] = [], students: Pick<Student, 'id' | 'first' | 'last' | 'oneName'>[] = []): Result {
  const s = useComm();
  const extra = useMemo(() => enrolmentsOf(apps, students), [apps, students]);
  // new lines get their IDs, and lines acted on are kept as they were (engine.ts, settle): worked out here so the page
  // shows them at once, and kept in the store just after
  const res = useMemo(() => compute(settleAll(s, ctxOf(), extra), ctxOf(), extra), [s, extra]);
  useEffect(() => setComm((cur) => settleAll(cur, ctxOf(), extra)), [s, extra]);
  return res;
}

/** Who's exporting, for Admin › Logs: their role and sales region as GSP · Admin keeps them (Create Roles). */
export const whoIs = (name: string, email: string) => {
  const u = sampleUsers().find((x) => x.name === name);
  return { name, email, role: u ? `${u.role} · ${u.title}` : '', region: u?.region ?? '' };
};

/* ---------- actions: each one changes the records and writes its Logs line ---------- */

let n = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${(++n).toString(36)}`;
const log = (area: LogArea, by: string, text: string, more: Partial<Log> = {}): Log => ({ id: id('lg'), at: Date.now(), by, area, text, ...more });
const stamp = (by: string) => ({ by, at: Date.now() });
const withLog = (s: CommState, ...l: Log[]): CommState => ({ ...s, logs: [...l, ...s.logs] });

/** `from`: the edit's Effective from date (Q41): enrolments whose intake starts before it keep the terms before. */
export function saveAgreement(a: Omit<Agreement, 'created' | 'updated' | 'earlier'>, by: string, from = todayIso()) {
  setComm((s) => {
    const was = s.agreements.find((x) => x.id === a.id);
    const today = from;
    const next: Agreement = was
      ? { ...was, ...a, updated: stamp(by), earlier: [...was.earlier, { shareType: was.shareType, share: was.share, bands: was.bands, countedPer: was.countedPer, retro: was.retro, addl: was.addl, bonuses: was.bonuses, payDays: was.payDays, claimMonths: was.claimMonths, details: was.details, doc: was.doc, until: today }] }
      : { ...a, created: stamp(by), updated: stamp(by), earlier: [] };
    return withLog({ ...s, agreements: was ? s.agreements.map((x) => (x.id === a.id ? next : x)) : [...s.agreements, next] }, log('agreements', by, `${by} saved agreement ${a.name}: ${shareText(a)}${was ? `, effective from ${from}` : ''}`));
  });
}
export const newAgreementId = () => id('ag');
export function retireAgreement(agId: string, by: string) {
  setComm((s) => {
    const a = s.agreements.find((x) => x.id === agId)!;
    return withLog({ ...s, agreements: s.agreements.map((x) => (x.id === agId ? { ...x, status: 'Retired', updated: stamp(by) } : x)) }, log('agreements', by, `${by} retired agreement ${a.name}`));
  });
}

/** What an RP is shown of its commission (Jovial, 11 Nov): Finance or RP Ops sets it on the RP's record; logged. */
export function saveRpView(rp: string, view: RpView, by: string) {
  setComm((s) => withLog({ ...s, records: s.records.map((x) => (x.rp === rp ? { ...x, view, updated: stamp(by) } : x)) }, log('rps', by, `${by} set what ${rpName(rp)} sees: ${rpViewText(view)}`, { rp })));
}
export function saveRecord(r: Pick<RpRecord, 'rp' | 'agreement' | 'from' | 'ownFlat' | 'annuityPct' | 'view'>, by: string) {
  setComm((s) => {
    const was = s.records.find((x) => x.rp === r.rp);
    const ag = s.agreements.find((a) => a.id === r.agreement)!;
    const moved = was && (was.agreement !== r.agreement || was.from !== r.from);
    const next: RpRecord = was
      ? { ...was, ...r, moves: moved ? [...was.moves, { agreement: was.agreement, from: was.from }] : was.moves, updated: stamp(by) }
      : { ...r, moves: [], created: stamp(by), updated: stamp(by) };
    const own = r.ownFlat != null ? `, own flat share ${r.ownFlat}%` : '';
    const ann = r.annuityPct != null ? `, ${r.annuityPct}% after year 1` : '';
    const text = !was || moved ? `${by} set ${rpName(r.rp)} on ${ag.name} from ${r.from}${own}${ann}` : `${by} changed ${rpName(r.rp)}’s record${own || ', no own flat share'}${ann}`;
    return withLog({ ...s, records: was ? s.records.map((x) => (x.rp === r.rp ? next : x)) : [...s.records, next] }, log('rps', by, text, { rp: r.rp }));
  });
}

export const newNoticeId = () => id('nt');
/** RP Ops (BAP) issues a notice Finance created (R103): from now it applies and the RPs it's for see it. */
export function issueNotice(nid: string, by: string) {
  setComm((s) => {
    const n = s.notices.find((x) => x.id === nid);
    if (!n || n.issued) return s;
    return withLog({ ...s, notices: s.notices.map((x) => (x.id === nid ? { ...x, issued: stamp(by) } : x)) }, log('notices', by, `${by} issued notice ${n.name}`));
  });
}
export function saveNotice(nt: Omit<Notice, 'created' | 'updated'>, by: string) {
  setComm((s) => {
    const was = s.notices.find((x) => x.id === nt.id);
    // RPs taken off in the form keep it for their enrolments before today (Q65); one put back loses that line
    const on = todayIso();
    const off = was ? was.rps.filter((r) => !nt.rps.includes(r)) : [];
    const removed = [...(was?.removed ?? nt.removed ?? []).filter((r) => !nt.rps.includes(r.rp) && !off.includes(r.rp)), ...off.map((rp) => ({ rp, on }))];
    // a new notice waits for RP Ops (BAP) to issue it (R103); an edit keeps whether it's issued
    const next: Notice = was ? { ...was, ...nt, removed, issued: was.issued, updated: stamp(by) } : { ...nt, removed: [], issued: null, created: stamp(by), updated: stamp(by) };
    return withLog({ ...s, notices: was ? s.notices.map((x) => (x.id === nt.id ? next : x)) : [...s.notices, next] }, log('notices', by, `${by} saved notice ${nt.name}: ${benefitText(nt)}, ${nt.rps.length} ${nt.rps.length === 1 ? 'RP' : 'RPs'}`));
  });
}
export function addNoticeRps(ntId: string, add: string[], by: string) {
  setComm((s) => {
    const nt = s.notices.find((x) => x.id === ntId)!;
    const fresh = add.filter((r) => !nt.rps.includes(r));
    if (!fresh.length) return s;
    return withLog({ ...s, notices: s.notices.map((x) => (x.id === ntId ? { ...x, rps: [...x.rps, ...fresh], updated: stamp(by) } : x)) }, log('notices', by, `${by} added ${fresh.map(rpName).join(', ')} to ${nt.name}`));
  });
}
export function removeNoticeRp(ntId: string, rp: string, by: string) {
  setComm((s) => {
    const nt = s.notices.find((x) => x.id === ntId)!;
    // its enrolments before today keep the notice (Q65)
    const on = todayIso();
    return withLog({ ...s, notices: s.notices.map((x) => (x.id === ntId ? { ...x, rps: x.rps.filter((r) => r !== rp), removed: [...(x.removed ?? []).filter((r) => r.rp !== rp), { rp, on }], updated: stamp(by) } : x)) }, log('notices', by, `${by} removed ${rpName(rp)} from ${nt.name}; enrolments before ${on} keep it`));
  });
}
export function endNotice(ntId: string, by: string) {
  setComm((s) => {
    const nt = s.notices.find((x) => x.id === ntId)!;
    return withLog({ ...s, notices: s.notices.map((x) => (x.id === ntId ? { ...x, ends: todayIso(), updated: stamp(by) } : x)) }, log('notices', by, `${by} ended notice ${nt.name} today`));
  });
}

/** `from`: the edit's Effective from date (Q41). */
function withTerms(s: CommState, t: Omit<UniTerms, 'created' | 'updated' | 'earlier'>, by: string, from: string): CommState {
  const was = s.terms.find((x) => x.uni === t.uni);
  const { created: _c, updated: _u, earlier: _e, uni: _x, ...body } = was ?? ({} as UniTerms);
  const next: UniTerms = was ? { ...was, ...t, updated: stamp(by), earlier: [...was.earlier, { ...body, until: from }] } : { ...t, created: stamp(by), updated: stamp(by), earlier: [] };
  return { ...s, terms: was ? s.terms.map((x) => (x.uni === t.uni ? next : x)) : [...s.terms, next] };
}
/** `from`: the edit's Effective from date (Q41). The log says how many lines it moved (D15). */
export function saveTerms(t: Omit<UniTerms, 'created' | 'updated' | 'earlier'>, by: string, from = todayIso()) {
  const fx = termsEffect(t, from, by);
  setComm((s) => {
    const was = s.terms.some((x) => x.uni === t.uni);
    const moved = fx.repriced + fx.adjusted ? `; ${fx.repriced} line${fx.repriced === 1 ? '' : 's'} re-priced, ${fx.adjusted} adjustment line${fx.adjusted === 1 ? '' : 's'}` : '';
    return withLog(withTerms(s, t, by, from), log('terms', by, `${by} saved terms for ${uniName(t.uni)}: ${ratesText(t, uniCurrency(t.uni))}${was ? `, effective from ${from}` : ''}${moved}`, { uni: t.uni }));
  });
}
/**
 * See the effect (D15): what saving these terms would do to the university's lines, worked out by the same engine on
 * the seeded enrolments: lines not yet invoiced are re-priced, kept lines get an Adjustment line, new lines appear.
 */
export function termsEffect(t: Omit<UniTerms, 'created' | 'updated' | 'earlier'>, from: string, by: string) {
  const ctx = ctxOf();
  const now = compute(settleAll(state, ctx), ctx);
  const then = compute(settleAll(withTerms(state, t, by, from), ctx), ctx);
  const mine = (r: Result) => new Map(r.txs.filter((x) => x.uni === t.uni && x.side === 'uni').map((x) => [x.key, x]));
  const a = mine(now);
  const b = mine(then);
  let repriced = 0;
  let adjusted = 0;
  let added = 0;
  let change = 0;
  for (const [k, x] of b) {
    const y = a.get(k);
    if (!y) {
      if (x.type === 'Adjustment') adjusted++;
      else added++;
      change += x.amount;
    } else if (Math.abs(y.amount - x.amount) > 0.004) {
      repriced++;
      change += x.amount - y.amount;
    }
  }
  for (const [k, y] of a) if (!b.has(k)) change -= y.amount;
  return { repriced, adjusted, added, change, currency: t.currency || uniCurrency(t.uni) };
}

/** A university group (Q56): its members, tier and group bonuses. A university is in at most one group. */
export const newGroupId = () => id('grp');
export function saveGroup(g: Omit<UniGroup, 'created' | 'updated'>, by: string) {
  setComm((s) => {
    const was = (s.groups ?? []).find((x) => x.id === g.id);
    const next: UniGroup = was ? { ...was, ...g, updated: stamp(by) } : { ...g, created: stamp(by), updated: stamp(by) };
    const groups = was ? s.groups.map((x) => (x.id === g.id ? next : x)) : [...(s.groups ?? []), next];
    return withLog({ ...s, groups }, log('groups', by, `${by} saved group ${g.name}: ${g.members.map(uniName).join(', ')}`));
  });
}
export function deleteGroup(gid: string, by: string) {
  setComm((s) => {
    const g = s.groups.find((x) => x.id === gid)!;
    return withLog({ ...s, groups: s.groups.filter((x) => x.id !== gid) }, log('groups', by, `${by} deleted group ${g.name}`));
  });
}
/** Commission settings (Finance › Setup › Settings). */
export function saveSettings(next: Settings, by: string, what: string) {
  setComm((s) => withLog({ ...s, settings: next }, log('settings', by, `${by} changed ${what}`)));
}
/** A lump sum a university paid that isn't one student's line (a volume bonus, a tier true-up), on the university. */
export function recordLump(uni: string, amount: number, currency: string, reason: string, date: string, by: string) {
  setComm((s) => withLog({ ...s, lumps: [...(s.lumps ?? []), { id: id('lp'), uni, amount, currency, reason, date, by, at: Date.now() }] }, lineLog(by, `${by} recorded a lump sum of ${money(amount, currency)} from ${uniName(uni)} on ${date}: ${reason}`, [], { uni })));
}
/** Finance closed a tier period (T83, Q68): the count is final; credits and top-ups for it fall due at its end. */
export function closePeriod(scope: string, window: string, by: string) {
  setComm((s) => withLog({ ...s, closes: [...(s.closes ?? []), { scope, window, by, at: Date.now() }] }, lineLog(by, `${by} closed the ${scope} tier period ${window}`, [])));
}
/**
 * Finance's commission work, as the task rules read it (Jovial, 10 Nov): T82 one task per exception; T83 one per tier
 * period that has ended and isn't closed; T84 one per later study period whose date has come and that waits for
 * Finance to confirm the student continues (D19). All worked out by the engine from the records, on the seeded enrolments.
 */
export function commWork(s: CommState = state, today = todayIso()) {
  const ctx = ctxOf(today);
  const res = compute(settleAll(s, ctx), ctx);
  const enrolledOn = new Map(res.apps.map((a) => [a.app, a.enrolled]));
  const exceptions = res.exceptions.map((x) => ({ ...x, since: enrolledOn.get(x.app) ?? today, uni: res.byApp.get(x.app)?.uniName ?? '' }));
  const periods = new Map<string, { scope: string; window: string; ends: string; count: number }>();
  for (const a of res.apps)
    for (const t of a.tiers) {
      if (!t.ends || t.ends >= today || (s.closes ?? []).some((c) => c.scope === t.name && c.window === t.window)) continue;
      const k = `${t.name}|${t.window}`;
      periods.set(k, { scope: t.name, window: t.window, ends: t.ends, count: Math.max(periods.get(k)?.count ?? 0, t.total) });
    }
  const confirm: { app: string; period: number; student: string; uni: string; since: string; tx: string }[] = [];
  for (const t of res.txs)
    if (t.side === 'uni' && t.toConfirm && t.period && t.trigger && t.trigger <= today && t.status !== 'Not payable' && !confirm.some((c) => c.app === t.app && c.period === t.period))
      confirm.push({ app: t.app, period: t.period, student: t.student, uni: t.uniName, since: t.trigger, tx: t.id });
  // notices Finance created that RP Ops hasn't issued yet (R103; shown on RP Ops › Notices, no task)
  const issue = s.notices.filter((n) => !n.issued).map((n) => ({ id: n.id, name: n.name, since: new Date(n.created.at).toISOString().slice(0, 10) }));
  return { exceptions, periods: [...periods.values()], confirm, issue };
}
/** Finance confirmed students continue, so their later study periods can be invoiced (D19). */
export function confirmContinuing(items: { app: string; period: number }[], by: string) {
  setComm((s) =>
    withLog(
      { ...s, confirms: [...(s.confirms ?? []), ...items.filter((x) => !(s.confirms ?? []).some((c) => c.app === x.app && c.period === x.period)).map((x) => ({ ...x, by, at: Date.now() }))] },
      lineLog(by, `${by} confirmed ${items.length === 1 ? `${items[0].app} continues into study period ${items[0].period}` : `${items.length} students continue into their next study period`}`, []),
    ),
  );
}

/* the lines */
const lineLog = (by: string, text: string, txs: string[], more: Partial<Log> = {}) => log('lines', by, text, { txs, ...more });

export function raiseInvoice(uni: string, txs: string[], by: string) {
  const day = todayIso();
  const number = nextInvoiceNumber(state, uni, day);
  setComm((s) => withLog({ ...s, invoices: [...s.invoices, { number, uni, date: day, txs, by, at: Date.now() }] }, lineLog(by, `${by} raised invoice ${number}`, txs, { uni })));
  return number;
}
/** The university's finance contact, from its institution partner's contacts (Finance and invoices). */
export const uniFinanceContact = (uni: string) => {
  const u = ctxUnis().find((x) => x.id === uni);
  const p = u?.ip ? samplePartners().find((x) => x.id === u.ip) : undefined;
  return p?.contacts.find((c) => c.for === 'Finance and invoices') ?? null;
};
/** D17: GSP's invoice goes to the university's finance contact from Settings' mailbox, logged on its lines. */
export function sendUniInvoice(number: string, by: string) {
  setComm((s) => {
    const inv = s.invoices.find((i) => i.number === number);
    const to = inv && uniFinanceContact(inv.uni)?.email;
    if (!inv || !to) return s;
    const sent = { from: s.settings.invoiceFrom, to, by, at: Date.now() };
    return withLog({ ...s, invoices: s.invoices.map((i) => (i.number === number ? { ...i, sent } : i)) }, lineLog(by, `${by} sent invoice ${number} from ${sent.from} to ${to}`, inv.txs, { uni: inv.uni }));
  });
}
/**
 * A payment from a university, line by line (Q44): what came in for each line, and why where it's less than the line.
 * `amount` is the total, for the log.
 */
export function recordPayment(uni: string, txs: string[], amount: number, cur: string, date: string, by: string, paid: Record<string, number> = {}, short: Record<string, string> = {}) {
  const shortTxt = Object.keys(short).length ? `; paid short: ${Object.entries(short).map(([t, why]) => `${t} (${why})`).join(', ')}` : '';
  setComm((s) => withLog({ ...s, receipts: [...s.receipts, { id: id('rc'), uni, txs, amount, paid, short, date, by, at: Date.now() }] }, lineLog(by, `${by} recorded ${money(amount, cur)} received from ${uniName(uni)} on ${date}${shortTxt}`, txs, { uni })));
}
/** Writes off the rest of a line paid short (Q44): the same Finance person may do it; the line counts as Paid. */
/** A university's clawback on a line it paid (R106): the RP's share becomes a recovery line, set against its next payment. */
export function recordClawback(tx: string, amount: number, cur: string, reason: string, date: string, by: string) {
  setComm((s) => withLog({ ...s, clawbacks: [...(s.clawbacks ?? []), { id: id('cb'), tx, amount, reason, date, by, at: Date.now() }] }, lineLog(by, `${by} recorded a clawback of ${money(amount, cur)} on ${tx}: ${reason}`, [tx])));
}
export function writeOff(tx: string, amount: number, cur: string, reason: string, by: string) {
  setComm((s) => withLog({ ...s, writeOffs: [...(s.writeOffs ?? []), { id: id('wo'), tx, amount, reason, by, at: Date.now() }] }, lineLog(by, `${by} wrote off ${money(amount, cur)} on ${tx}: ${reason}`, [tx])));
}
export function requestInvoice(rp: string, txs: string[], by: string) {
  setComm((s) => withLog({ ...s, requests: [...s.requests, { id: id('rq'), rp, txs, date: todayIso(), by, at: Date.now() }] }, lineLog(by, `${by} requested ${rpName(rp)}’s invoice`, txs, { rp })));
}
export function uploadRpInvoice(rp: string, file: FileRef, txs: string[], by: string) {
  setComm((s) => withLog({ ...s, rpInvoices: [...s.rpInvoices, { id: id('ri'), rp, file, txs, by, at: Date.now(), state: 'To check' }] }, lineLog(by, `${by} (${rpName(rp)}) sent invoice ${file.name}`, txs, { rp })));
}
export function acceptRpInvoice(invId: string, by: string) {
  setComm((s) => {
    const i = s.rpInvoices.find((x) => x.id === invId)!;
    return withLog({ ...s, rpInvoices: s.rpInvoices.map((x) => (x.id === invId ? { ...x, state: 'Accepted', decided: stamp(by) } : x)) }, lineLog(by, `${by} accepted ${rpName(i.rp)}’s invoice ${i.file.name}`, i.txs, { rp: i.rp }));
  });
}
export function sendBackRpInvoice(invId: string, reason: string, by: string) {
  setComm((s) => {
    const i = s.rpInvoices.find((x) => x.id === invId)!;
    return withLog({ ...s, rpInvoices: s.rpInvoices.map((x) => (x.id === invId ? { ...x, state: 'Sent back', reason, decided: stamp(by) } : x)) }, lineLog(by, `${by} sent back ${rpName(i.rp)}’s invoice ${i.file.name}: ${reason}`, i.txs, { rp: i.rp }));
  });
}
export function markPaid(rp: string, txs: string[], date: string, by: string, recovered?: Record<string, number>) {
  setComm((s) => withLog({ ...s, rpPayments: [...s.rpPayments, { id: id('rpp'), rp, txs, date, by, at: Date.now(), ...(recovered && Object.keys(recovered).length ? { recovered } : {}) }] }, lineLog(by, `${by} marked paid to ${rpName(rp)} on ${date}`, txs, { rp })));
}
/** Q118/Q125 (Jovial, 13 Nov): GSP's debit note asks the RP to pay back recoveries with nothing to set them against. */
export function sendDebitNote(rp: string, txs: string[], by: string) {
  const day = todayIso();
  const code = ctxRps().find((r) => r.id === rp)?.code ?? rp;
  const n = (state.debitNotes ?? []).filter((d) => d.rp === rp).length + 1;
  const number = `DN-${code}-${day.slice(0, 4)}-${String(n).padStart(3, '0')}`;
  setComm((s) => withLog({ ...s, debitNotes: [...(s.debitNotes ?? []), { id: id('dn'), number, rp, txs, date: day, by, at: Date.now() }] }, lineLog(by, `${by} sent ${rpName(rp)} debit note ${number}`, txs, { rp })));
  return number;
}
/** The RP paid a recovery back itself (after GSP's debit note): Recovered. */
export function recordRepayment(rp: string, tx: string, amount: number, date: string, by: string) {
  setComm((s) => withLog({ ...s, rpPayments: [...s.rpPayments, { id: id('rpp'), rp, txs: [tx], date, by, at: Date.now(), recovered: { [tx]: amount }, repaid: true }] }, lineLog(by, `${by} recorded ${rpName(rp)} paying back ${tx} on ${date}`, [tx], { rp })));
}
export function overrideLine(tx: string, o: { amount: number | null; due: string | null; hold: boolean; reason: string }, old: string, now: string, by: string) {
  setComm((s) => withLog({ ...s, overrides: [...s.overrides, { id: id('ov'), tx, ...o, by, at: Date.now() }] }, lineLog(by, `${by} overrode ${tx}: ${old} → ${now}. ${o.reason}`, [tx])));
}
/** An export, for Admin › Logs. */
export function logDownload(d: { who: string; email: string; role: string; region: string; filters: string; records: number }) {
  setComm((s) => ({ ...s, downloads: [{ id: id('dl'), at: Date.now(), area: 'Commission lines', text: 'commission-lines.csv', format: 'CSV', ...d }, ...s.downloads] }));
}
