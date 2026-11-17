/**
 * Commission work for Finance's two queues (Jovial, 17 Nov, after the Finance demo): what each commission task rule's
 * condition holds for, read from the commission lines as the engine works them out. Institution partner work (raise
 * invoices, chase overdue, fix exceptions) is one task per IP; RP work (request, check, pay, recover) one per RP. Each
 * hit carries `keep`, the IP or RP it's about, so the same person keeps it (the rule's sharing "One person per IP or
 * RP"). Nothing here is written by hand: no line, no task.
 */
import type { Application } from '../../data/applications';
import type { Student } from '../../data/students';
import { compute, settleAll, type Tx } from './engine';
import { ACTION_FROM, CHASE, RP_INVOICE_STATES, TO_RECOVER, type CommState } from './model';
import { ctxOf, ctxUnis, enrolmentsOf, ipName } from './store';

/** The commission task rules this module answers, and what each is about. */
export const COMM_RULES = { raise: 'T86', chase: 'T87', fix: 'T88', request: 'T89', check: 'T90', pay: 'T91', recover: 'T92' } as const;
export type CommRuleKey = keyof typeof COMM_RULES;
export const commRuleOf = (code: string) => (Object.keys(COMM_RULES) as CommRuleKey[]).find((k) => COMM_RULES[k] === code);

export type CommHit = { key: string; since: number; ref: string; about: string; keep: string; vars: Record<string, string> };

const at = (iso: string) => new Date(`${(iso || '').slice(0, 10) || '2026-01-01'}T09:30`).getTime();
const earliest = (xs: string[]) => xs.filter(Boolean).sort()[0] ?? '';
const lines = (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`;

/** The lines as the engine works them out for these records (the same path Commission lines takes). */
export function commLines(comm: CommState, apps: Application[], students: Pick<Student, 'id' | 'first' | 'last' | 'oneName'>[], today?: string) {
  const ctx = ctxOf(today);
  const extra = enrolmentsOf(apps, students);
  return compute(settleAll(comm, ctx, extra), ctx, extra);
}

/** Each commission rule's condition: one hit per IP (University → GSP work) or per RP (GSP → RP work). */
export function commHits(code: string, comm: CommState, apps: Application[], students: Pick<Student, 'id' | 'first' | 'last' | 'oneName'>[], today?: string): CommHit[] {
  const k = commRuleOf(code);
  if (!k) return [];
  const res = commLines(comm, apps, students, today);
  const unis = ctxUnis();
  const ipOfUni = (uni: string) => unis.find((u) => u.id === uni)?.ip || `uni:${uni}`;
  const ipLabel = (ip: string, uniNameOf: string) => (ip.startsWith('uni:') ? uniNameOf : ipName(ip) || uniNameOf);
  const byIp = (txs: Tx[], date: (t: Tx) => string, rule: CommRuleKey) => {
    const m = new Map<string, Tx[]>();
    txs.forEach((t) => m.set(ipOfUni(t.uni), [...(m.get(ipOfUni(t.uni)) ?? []), t]));
    return [...m.entries()].map(([ip, xs]): CommHit => {
      const name = ipLabel(ip, xs[0].uniName);
      return { key: `${rule}-${ip}`, since: at(earliest(xs.map(date))), ref: name, about: name, keep: `ip:${ip}`, vars: { IP: name, lines: lines(xs.length) } };
    });
  };
  const byRp = (txs: { rp: string; rpName: string; date: string }[], rule: CommRuleKey) => {
    const m = new Map<string, { rp: string; rpName: string; date: string }[]>();
    txs.forEach((t) => m.set(t.rp, [...(m.get(t.rp) ?? []), t]));
    return [...m.entries()].map(([rp, xs]): CommHit => ({ key: `${rule}-${rp}`, since: at(earliest(xs.map((x) => x.date))), ref: xs[0].rpName, about: xs[0].rpName, keep: `rp:${rp}`, vars: { RP: xs[0].rpName, lines: lines(xs.length) } }));
  };
  const uni = res.txs.filter((t) => t.side === 'uni');
  const rp = res.txs.filter((t) => t.side === 'rp');
  const has = (list: readonly string[], t: Tx) => list.includes(t.status);
  switch (k) {
    case 'raise':
      return byIp(uni.filter((t) => has(ACTION_FROM.raise, t)), (t) => t.trigger, k);
    case 'chase':
      return byIp(uni.filter((t) => has(CHASE, t)), (t) => t.due, k);
    case 'fix': {
      const enrolled = new Map(res.apps.map((a) => [a.app, a]));
      const xs = res.exceptions.map((x) => ({ x, a: enrolled.get(x.app) })).filter((v) => v.a);
      const m = new Map<string, typeof xs>();
      xs.forEach((v) => m.set(ipOfUni(v.a!.uni), [...(m.get(ipOfUni(v.a!.uni)) ?? []), v]));
      return [...m.entries()].map(([ip, vs]): CommHit => {
        const name = ipLabel(ip, vs[0].a!.uniName);
        return { key: `${k}-${ip}`, since: at(earliest(vs.map((v) => v.a!.enrolled))), ref: name, about: name, keep: `ip:${ip}`, vars: { IP: name, lines: lines(vs.length) } };
      });
    }
    case 'request':
      return byRp(rp.filter((t) => has(ACTION_FROM.request, t)).map((t) => ({ rp: t.rp, rpName: t.rpName, date: t.trigger })), k);
    case 'check': {
      const toCheck = comm.rpInvoices.filter((i) => i.state === RP_INVOICE_STATES[0]);
      return byRp(toCheck.map((i) => ({ rp: i.rp, rpName: rp.find((t) => t.rp === i.rp)?.rpName ?? i.rp, date: new Date(i.at).toISOString().slice(0, 10) })), k);
    }
    case 'pay':
      return byRp(rp.filter((t) => has(ACTION_FROM.pay, t)).map((t) => ({ rp: t.rp, rpName: t.rpName, date: t.due || t.trigger })), k);
    case 'recover':
      return byRp(rp.filter((t) => t.status === TO_RECOVER).map((t) => ({ rp: t.rp, rpName: t.rpName, date: t.trigger })), k);
  }
}
