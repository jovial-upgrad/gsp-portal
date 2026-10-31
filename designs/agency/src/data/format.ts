/**
 * One way to show money and dates everywhere (QC, 1 Nov, rule 5).
 * Money: INR with Indian grouping and no paise ("INR 6,69,598"); every other currency with two decimals
 * ("AUD 2,295.00"). Never "-0". Dates: "5 Nov 2026" (never "Sept"); in lists, the year only when it isn't this year.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The number alone, grouped for its currency: "6,69,598" for INR, "2,295.00" for the rest. */
export function fmtAmount(n: number, cur = 'INR', decimals?: number) {
  const inr = cur === 'INR';
  const d = decimals ?? (inr ? 0 : 2);
  // round first, so a tiny negative never shows as "-0"
  let v = Number(n.toFixed(d));
  if (Object.is(v, -0) || v === 0) v = 0;
  return Math.abs(v).toLocaleString(inr ? 'en-IN' : 'en-AU', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** "INR 6,69,598", "AUD 2,295.00", "−AUD 40.00"; "—" when there's no amount. `cur` '' leaves the code out. */
export function fmtMoney(n: number | null | undefined | '', cur = 'INR', o: { decimals?: number; sign?: boolean } = {}) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '—';
  const x = Number(n);
  const body = fmtAmount(x, cur || 'AUD', o.decimals);
  const neg = Number(x.toFixed(o.decimals ?? (cur === 'INR' ? 0 : 2))) < 0;
  return `${neg ? '−' : o.sign && x > 0 ? '+' : ''}${cur ? `${cur} ` : ''}${body}`;
}

const toDate = (d: string | number | Date): Date | null => {
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  if (typeof d === 'number') return new Date(d);
  if (!d) return null;
  // an ISO day ("2026-11-05") is that day where you are, not midnight UTC
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.slice(0, 10));
  if (m && d.length <= 10) return new Date(+m[1], +m[2] - 1, +m[3]);
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
};

/**
 * "5 Nov 2026". With `list`, "5 Nov" when it's this year (lists and tables); with `year: false`, never the year.
 * Takes an ISO day, a timestamp or a Date; '' or a bad date gives ''.
 */
export function fmtDate(d: string | number | Date | null | undefined, o: { list?: boolean; year?: boolean } = {}) {
  if (d === null || d === undefined) return '';
  const x = toDate(d);
  if (!x) return '';
  const year = o.year === false ? false : o.list ? x.getFullYear() !== new Date().getFullYear() : true;
  return `${x.getDate()} ${MONTHS[x.getMonth()]}${year ? ` ${x.getFullYear()}` : ''}`;
}

/** "Today, 14:05" or "5 Nov, 14:05": when something happened, for logs. */
export function fmtWhen(at: number) {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? 'Today' : fmtDate(d, { list: true })}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** An ISO day as typed: "2026-11-05" → "05/11/2026". */
export const isoToDmy = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '';
};
/** "05/11/2026" → "2026-11-05", or null when it isn't a real day. */
export const dmyToIso = (v: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const x = new Date(y, mo - 1, d);
  return x.getFullYear() === y && x.getMonth() === mo - 1 && x.getDate() === d ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
