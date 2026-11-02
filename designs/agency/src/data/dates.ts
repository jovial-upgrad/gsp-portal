/** Dates typed day first, the way agencies in GSP's markets write them, and month-year for study and work. */

/** Keeps digits and puts the slashes in as you type: "19052002" → "19/05/2002". */
export function typeDate(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
}
/** "082019" → "08/2019". */
export function typeMonth(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 6);
  return [d.slice(0, 2), d.slice(2)].filter(Boolean).join('/');
}

/** "19/05/2002" → a Date, or null when it isn't a real day. */
export function parseDate(v: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}
/** "08/2019" → the first of that month, or null. */
export function parseMonth(v: string) {
  const m = /^(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1950) return null;
  return new Date(+m[2], +m[1] - 1, 1);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "14 Oct", or "18 Sep 2032" with the year (en-GB would say "Sept"). */
/**
 * A moment's calendar parts in IST (slice 1 NFR-1: one time zone, Asia/Kolkata, for every date and time shown),
 * whatever the viewer's own zone. IST is UTC+5:30 all year.
 */
export function istParts(d: Date | number) {
  const x = new Date((typeof d === 'number' ? d : d.getTime()) + 5.5 * 3_600_000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), h: x.getUTCHours(), min: x.getUTCMinutes(), wd: x.getUTCDay() };
}
export const shortDate = (d: Date, year = false) => {
  const p = istParts(d);
  return `${p.d} ${MONTHS[p.m]}${year ? ` ${p.y}` : ''}`;
};
export const monthLabel = (d: Date) => {
  const p = istParts(d);
  return `${MONTHS[p.m]} ${p.y}`;
};

/* No passport-validity rule here (HC17, Jovial 1 Nov): how long a passport must still run is the visa's rule, not ours. */

/** Whole years since a date: an age, or how old a test score is. */
export const yearsSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / (365.25 * 86_400_000));
