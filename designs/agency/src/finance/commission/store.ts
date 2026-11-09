/**
 * The commission store (Jovial, 9 Nov): the records Commissions keeps, as one shared store standing in for the
 * product's back end, so every role's page reads the same thing: Finance's Setup and Commission lines, the RP's,
 * university's and application's Commission tabs in every role, the go-live checklist, My work and the RP's Earnings.
 * Each change goes through one of the actions below, which also writes its Logs line.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { COURSES, LEVELS } from '../../data/courses';
import { fullName, type Student } from '../../data/students';
import type { Application } from '../../data/applications';
import { sampleUniRecs } from '../../institution/data/catalogue';
import { samplePartners, todayIso } from '../../institution/data/records';
import { HOME_RP } from '../../gsp/rps';
import { agreementsOf, regionOf, sampleOps, type OpsRp } from '../../rpops/records/data';
import { sampleComm } from './seed';
import { sampleUsers } from '../../admin/data/config';
import { compute, nextInvoiceNumber, periodsFor, settleAll, type Ctx, type CtxCourse, type CtxUni, type Result } from './engine';
import { benefitText, money, ratesText, shareText, type Agreement, type Bank, type CommState, type Enrolment, type FileRef, type Log, type LogArea, type Notice, type RpRecord, type UniTerms } from './model';
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

/* ---------- what the engine reads from other modules ---------- */

let unis: CtxUni[] | null = null;
let rps: (OpsRp & { region: string })[] | null = null;
const courses = new Map(COURSES.map((c) => [c.id, c]));
/** The universities, as the Institution Team keeps them (seeded). */
export const ctxUnis = () => (unis ??= sampleUniRecs().map((u) => ({ id: u.id, name: u.name, country: u.country, ip: u.ip, status: u.status, added: u.added }) as CtxUni & { status: string; added: string }));
/** The recruitment partners, as RP Ops keeps them (seeded), with their sales region. */
export const ctxRps = () => (rps ??= sampleOps().map((r) => ({ ...r, region: regionOf(r.country) })));
/** RPs whose partner agreement GSP has accepted: the ones that can have a commission record. */
export const acceptedRps = () => ctxRps().filter((r) => !!agreementsOf(r).active || !!agreementsOf(r).next);
/** The day the RP's accepted agreement took effect: From's default. */
export const acceptedOn = (rp: string) => {
  const r = ctxRps().find((x) => x.id === rp);
  const a = r && (agreementsOf(r).active ?? agreementsOf(r).next);
  return a?.effective ?? todayIso();
};
const course = (id: string): CtxCourse | undefined => {
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
  return { terms: t, periods: c && t ? periodsFor(t.inst, c.months, state.settings.periodMonths) : 1 };
};
/** The program levels a university offers, in the levels' order: University terms asks a rate for each. */
export const levelsOf = (uni: string) => LEVELS.filter((l) => COURSES.some((c) => c.uni.id === uni && c.level === l));
let ips: { id: string; name: string }[] | null = null;
/** Institution partners' names, for University terms' list. */
export const ipName = (id?: string) => (ips ??= samplePartners().map((p) => ({ id: p.id, name: p.name }))).find((p) => p.id === id)?.name ?? '';
export const rpName = (id: string) => ctxRps().find((r) => r.id === id)?.name ?? id;
export const uniName = (id: string) => ctxUnis().find((u) => u.id === id)?.name ?? id;

/** The portal's own applications at Student enrolled, as the engine reads them (their RP: the one on it, else the prototype's agency). */
export function enrolmentsOf(apps: Application[], students: Pick<Student, 'id' | 'first' | 'last' | 'oneName'>[]): Enrolment[] {
  return apps
    .filter((a) => a.status === 'enrolled')
    .map((a) => {
      const s = students.find((x) => x.id === a.studentId);
      const rp = ctxRps().find((r) => r.name === (a.rp ?? HOME_RP));
      return { app: a.id, student: s ? fullName(s as Student) : a.studentId, rp: rp?.id ?? '', course: a.courseId, intake: a.intake, enrolled: new Date(a.since).toISOString().slice(0, 10), fees: a.fees };
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

export function saveAgreement(a: Omit<Agreement, 'created' | 'updated' | 'earlier'>, by: string) {
  setComm((s) => {
    const was = s.agreements.find((x) => x.id === a.id);
    const today = todayIso();
    const next: Agreement = was
      ? { ...was, ...a, updated: stamp(by), earlier: [...was.earlier, { shareType: was.shareType, share: was.share, bands: was.bands, countedPer: was.countedPer, retro: was.retro, addl: was.addl, bonuses: was.bonuses, payDays: was.payDays, details: was.details, doc: was.doc, until: today }] }
      : { ...a, created: stamp(by), updated: stamp(by), earlier: [] };
    return withLog({ ...s, agreements: was ? s.agreements.map((x) => (x.id === a.id ? next : x)) : [...s.agreements, next] }, log('agreements', by, `${by} saved agreement ${a.name}: ${shareText(a)}`));
  });
}
export const newAgreementId = () => id('ag');
export function retireAgreement(agId: string, by: string) {
  setComm((s) => {
    const a = s.agreements.find((x) => x.id === agId)!;
    return withLog({ ...s, agreements: s.agreements.map((x) => (x.id === agId ? { ...x, status: 'Retired', updated: stamp(by) } : x)) }, log('agreements', by, `${by} retired agreement ${a.name}`));
  });
}

export function saveRecord(r: Pick<RpRecord, 'rp' | 'agreement' | 'from' | 'tax'>, by: string) {
  setComm((s) => {
    const was = s.records.find((x) => x.rp === r.rp);
    const ag = s.agreements.find((a) => a.id === r.agreement)!;
    const moved = was && (was.agreement !== r.agreement || was.from !== r.from);
    const next: RpRecord = was
      ? { ...was, ...r, moves: moved ? [...was.moves, { agreement: was.agreement, from: was.from }] : was.moves, updated: stamp(by) }
      : { ...r, moves: [], created: stamp(by), updated: stamp(by) };
    const text = !was || moved ? `${by} set ${rpName(r.rp)} on ${ag.name} from ${r.from}` : `${by} changed ${rpName(r.rp)}’s record: registered for tax ${r.tax ? 'Yes' : 'No'}`;
    return withLog({ ...s, records: was ? s.records.map((x) => (x.rp === r.rp ? next : x)) : [...s.records, next] }, log('rps', by, text, { rp: r.rp }));
  });
}

export const newNoticeId = () => id('nt');
export function saveNotice(nt: Omit<Notice, 'created' | 'updated'>, by: string) {
  setComm((s) => {
    const was = s.notices.find((x) => x.id === nt.id);
    const next: Notice = was ? { ...was, ...nt, updated: stamp(by) } : { ...nt, created: stamp(by), updated: stamp(by) };
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
    return withLog({ ...s, notices: s.notices.map((x) => (x.id === ntId ? { ...x, rps: x.rps.filter((r) => r !== rp), updated: stamp(by) } : x)) }, log('notices', by, `${by} removed ${rpName(rp)} from ${nt.name}`));
  });
}
export function endNotice(ntId: string, by: string) {
  setComm((s) => {
    const nt = s.notices.find((x) => x.id === ntId)!;
    return withLog({ ...s, notices: s.notices.map((x) => (x.id === ntId ? { ...x, ends: todayIso(), updated: stamp(by) } : x)) }, log('notices', by, `${by} ended notice ${nt.name} today`));
  });
}

export function saveTerms(t: Omit<UniTerms, 'created' | 'updated' | 'earlier'>, by: string) {
  setComm((s) => {
    const was = s.terms.find((x) => x.uni === t.uni);
    const { created: _c, updated: _u, earlier: _e, uni: _x, ...body } = was ?? ({} as UniTerms);
    const next: UniTerms = was ? { ...was, ...t, updated: stamp(by), earlier: [...was.earlier, { ...body, until: todayIso() }] } : { ...t, created: stamp(by), updated: stamp(by), earlier: [] };
    return withLog({ ...s, terms: was ? s.terms.map((x) => (x.uni === t.uni ? next : x)) : [...s.terms, next] }, log('terms', by, `${by} saved terms for ${uniName(t.uni)}: ${ratesText(t, uniCurrency(t.uni))}`, { uni: t.uni }));
  });
}

/** The RP's bank account, from Earnings: it shows at once on its Commission tab and in Setup, and is logged on the RP. */
export function saveBank(b: Omit<Bank, 'updated'>, by: string) {
  setComm((s) => {
    const was = s.banks.find((x) => x.rp === b.rp);
    const next: Bank = { ...b, updated: stamp(by) };
    const last4 = b.number.replace(/\s+/g, '').slice(-4);
    return withLog({ ...s, banks: was ? s.banks.map((x) => (x.rp === b.rp ? next : x)) : [...s.banks, next] }, log('bank', by, `${by} ${was ? 'changed' : 'added'} the bank account: ${b.bank} ····${last4}, ${b.currency}`, { rp: b.rp }));
  });
}

/* the lines */
const lineLog = (by: string, text: string, txs: string[], more: Partial<Log> = {}) => log('lines', by, text, { txs, ...more });

export function raiseInvoice(uni: string, txs: string[], by: string) {
  const day = todayIso();
  const number = nextInvoiceNumber(state, uni, day);
  setComm((s) => withLog({ ...s, invoices: [...s.invoices, { number, uni, date: day, txs, by, at: Date.now() }] }, lineLog(by, `${by} raised invoice ${number}`, txs, { uni })));
  return number;
}
export function recordPayment(uni: string, txs: string[], amount: number, cur: string, date: string, by: string) {
  setComm((s) => withLog({ ...s, receipts: [...s.receipts, { id: id('rc'), uni, txs, amount, date, by, at: Date.now() }] }, lineLog(by, `${by} recorded ${money(amount, cur)} received from ${uniName(uni)} on ${date}`, txs, { uni })));
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
export function markPaid(rp: string, txs: string[], date: string, by: string) {
  setComm((s) => withLog({ ...s, rpPayments: [...s.rpPayments, { id: id('rpp'), rp, txs, date, by, at: Date.now() }] }, lineLog(by, `${by} marked paid to ${rpName(rp)} on ${date}`, txs, { rp })));
}
export function overrideLine(tx: string, o: { amount: number | null; due: string | null; hold: boolean; reason: string }, old: string, now: string, by: string) {
  setComm((s) => withLog({ ...s, overrides: [...s.overrides, { id: id('ov'), tx, ...o, by, at: Date.now() }] }, lineLog(by, `${by} overrode ${tx}: ${old} → ${now}. ${o.reason}`, [tx])));
}
/** An export, for Admin › Logs. */
export function logDownload(d: { who: string; email: string; role: string; region: string; filters: string; records: number }) {
  setComm((s) => ({ ...s, downloads: [{ id: id('dl'), at: Date.now(), area: 'Commission lines', text: 'commission-lines.csv', format: 'CSV', ...d }, ...s.downloads] }));
}
