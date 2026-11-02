/**
 * Slice 2 PRD (2 Nov), rules for every screen: the Change log and System information on institution partners,
 * universities, courses and Master Partners (S2-13, S2-14), the audit log every event goes to, and the upload checks.
 *
 * The Change log is written by the system on every save: when, who, their role, what (record · part · field) and the
 * value before and after. Nobody adds notes; no entry is edited or deleted. "System" is the daily job.
 */
import { setAdminCfg } from '../../admin/data/store';

export type Change = { id: string; at: number; who: string; role: string; what: string; from: string; to: string };
/** Who added the record, and when. Last modified is the latest Change log entry. */
export type Created = { by: string; at: number };
export const SYSTEM = 'System';

let seq = 0;
export const change = (who: string, role: string, what: string, from: string, to: string, at = Date.now()): Change => ({ id: `chg-${at.toString(36)}-${(++seq).toString(36)}`, at, who, role, what, from, to });

/** The PRD's names for the matrix's roles: since the merge the matrix holds slice 1's names, so a role shows as it is. */
export const roleName = (r: string) => r;

/** A value as the Change log shows it. */
export function shown(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' && x ? nameOf(x) : String(x))).join(', ') : '—';
  if (typeof v === 'object') return nameOf(v);
  return String(v);
}
const nameOf = (x: object): string => {
  const o = x as Record<string, unknown>;
  const n = o.name ?? (o.first ? `${o.first} ${o.last ?? ''}`.trim() : undefined) ?? o.title ?? o.file ?? o.username ?? o.month ?? o.type ?? o.id;
  return String(n ?? '');
};
const keyOf = (x: unknown) => (typeof x === 'object' && x ? String((x as Record<string, unknown>).id ?? nameOf(x)) : String(x));

/** For each top-level key that can change: the part and field it belongs to, and how to show it. */
export type LogSpec<T> = { record: string; fields: Partial<Record<keyof T, string>>; fmt?: Partial<Record<keyof T, (v: unknown) => string>> };

/**
 * The entries a save writes: one per changed field. A list of things (contacts, campuses, documents) writes one entry
 * per thing added, removed or changed, with its name on the old or new side.
 */
export function diffOf<T extends object>(spec: LogSpec<T>, a: T, b: T, who: string, role: string): Change[] {
  const out: Change[] = [];
  const at = Date.now();
  for (const k of Object.keys(spec.fields) as (keyof T)[]) {
    const x = a[k];
    const y = b[k];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    const what = `${spec.record} · ${spec.fields[k]}`;
    const f = spec.fmt?.[k];
    if (!f && Array.isArray(x) && Array.isArray(y) && [...x, ...y].some((v) => typeof v === 'object')) {
      const xs = new Map(x.map((v) => [keyOf(v), v]));
      const ys = new Map(y.map((v) => [keyOf(v), v]));
      for (const [id, v] of ys) if (!xs.has(id)) out.push(change(who, role, `${what} · added`, '—', shown(v), at));
      for (const [id, v] of xs) if (!ys.has(id)) out.push(change(who, role, `${what} · removed`, shown(v), '—', at));
      for (const [id, v] of ys) if (xs.has(id) && JSON.stringify(xs.get(id)) !== JSON.stringify(v)) out.push(change(who, role, `${what} · ${shown(v)}`, detail(xs.get(id)), detail(v), at));
      continue;
    }
    out.push(change(who, role, what, f ? f(x) : shown(x), f ? f(y) : shown(y), at));
  }
  return out;
}
/** A changed thing in a list, field by field, briefly. */
const detail = (v: unknown) =>
  typeof v === 'object' && v
    ? Object.entries(v as Record<string, unknown>)
        .filter(([k, x]) => k !== 'id' && x !== '' && x !== undefined && typeof x !== 'object')
        .map(([, x]) => shown(x))
        .slice(0, 5)
        .join(' · ')
    : shown(v);

/** A record after a save, with what changed added to its Change log (newest first). */
export function withLog<T extends { log: Change[] }>(spec: LogSpec<T>, a: T, b: T, who: string, role: string, extra: Change[] = []): T {
  const add = [...extra, ...diffOf(spec, a, b, who, role)];
  return add.length ? { ...b, log: [...add, ...a.log] } : b;
}

/* ---------- the audit log (Admin › Logs) ---------- */

/** Every slice 2 event also writes the audit log (slice 1). */
export function audit(area: string, text: string, who: string, role: string, kind: 'change' | 'download' = 'change', extra: Record<string, string> = {}) {
  const at = Date.now();
  try {
    setAdminCfg((c) => ({ ...c, log: [{ id: `s2-${at.toString(36)}-${(++seq).toString(36)}`, at, who, role, area, text, kind, ...extra }, ...c.log] }));
  } catch {
    /* Admin's log not loaded */
  }
}

/* ---------- dates and times ---------- */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2 Nov 2026, 16:40", in the viewer's time zone. */
export const dateTimeText = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** A sample time from an ISO date, at 10:00. */
export const atIso = (iso: string, h = 10) => new Date(`${iso.slice(0, 10)}T${String(h).padStart(2, '0')}:00:00`).getTime();

/* ---------- uploads ---------- */

export type FileKind = 'pdf' | 'word' | 'jpg' | 'png' | 'webp' | 'svg' | 'csv';
const EXT: Record<FileKind, string[]> = { pdf: ['pdf'], word: ['doc', 'docx'], jpg: ['jpg', 'jpeg'], png: ['png'], webp: ['webp'], svg: ['svg'], csv: ['csv'] };
const WORD: Record<FileKind, string> = { pdf: 'PDF', word: 'Word file', jpg: 'JPG', png: 'PNG', webp: 'WebP', svg: 'SVG', csv: 'CSV file' };
export const acceptOf = (kinds: FileKind[]) => kinds.flatMap((k) => EXT[k].map((e) => `.${e}`)).join(',');
const listOf = (kinds: FileKind[]) => {
  const w = kinds.map((k) => WORD[k]);
  return w.length === 1 ? w[0] : `${w.slice(0, -1).join(', ')} or ${w[w.length - 1]}`;
};
/** Uploads are checked for type and size before they're sent: "Upload a PDF, JPG or PNG." and "This file is over 20 MB." */
export function checkFile(f: { name: string; size: number }, kinds: FileKind[], maxMb: number): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (!kinds.some((k) => EXT[k].includes(ext))) return `Upload a ${listOf(kinds)}.`;
  if (f.size > maxMb * 1024 * 1024) return `This file is over ${maxMb} MB.`;
  return null;
}
