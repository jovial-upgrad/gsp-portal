/**
 * Rule rows as text, one a line (the sandbox's way of writing them): rate rows, promotions, bonus schemes, band bonuses and
 * conditions. Finance types them on University terms and Groups; each line is parsed back into the record the engine reads,
 * and a line that doesn't parse is shown with its line number, never saved. The words come from the model's own lists.
 */
import { COMM_LEVELS as LEVELS, ADDL_KINDS, BONUS_PER, PROMO_COMBINES, UNI_COUNTED_PER, type AddlKind, type BandBonus, type BonusScheme, type Cond, type CountBand, type Level, type Promo, type RateRow, type UniCountedPer } from './model';

/** The keys a condition or rate row can name, with what they set. */
const KEYS = { level: 'levels', course: 'courses', campus: 'campuses', region: 'regions', intake: 'intakes', from: 'from', to: 'to' } as const;
const ROW_KEYS = ['level', 'course', 'campus', 'region', 'period'] as const;
const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
const lc = (s: string) => s.trim().toLowerCase();
const levelOf = (s: string) => LEVELS.find((l) => lc(l) === lc(s)) as Level | undefined;
const date = /^\d{4}-\d{2}-\d{2}$/;
const month = /^\d{4}-\d{2}$/;
type Parsed<T> = { ok: T[]; bad: string[] };

/** `key=value` parts, separated by `;`; anything else is returned as `rest` (in order). */
function parts(line: string) {
  const kv: Record<string, string> = {};
  const rest: string[] = [];
  for (const p of line.split(';').map((x) => x.trim()).filter(Boolean)) {
    const m = /^([a-z ]+)=(.*)$/i.exec(p);
    if (m) kv[lc(m[1])] = m[2].trim();
    else rest.push(p);
  }
  return { kv, rest };
}

/** A condition from `key=value` pairs: level, course, campus, region (a country or a region group), intake (YYYY-MM), from, to. */
function condOf(kv: Record<string, string>, bad: (why: string) => void): Cond {
  const c: Cond = {};
  for (const [k, v] of Object.entries(kv)) {
    const to = KEYS[k as keyof typeof KEYS];
    if (!to) continue;
    if (to === 'from' || to === 'to') {
      if (!date.test(v)) bad(`${k} needs a date like 2026-01-31`);
      c[to] = v;
    } else if (to === 'levels') {
      const ls = list(v).map((x) => levelOf(x));
      if (ls.some((x) => !x)) bad(`level is one of ${LEVELS.join(', ')}`);
      c.levels = ls.filter(Boolean) as Level[];
    } else if (to === 'intakes') {
      const ms = list(v);
      if (ms.some((x) => !month.test(x))) bad('intake needs months like 2027-01');
      c.intakes = ms;
    } else c[to] = list(v);
  }
  return c;
}
export const condLine = (c?: Cond) =>
  !c
    ? ''
    : [
        c.levels?.length ? `level=${c.levels.join(', ')}` : '',
        c.courses?.length ? `course=${c.courses.join(', ')}` : '',
        c.campuses?.length ? `campus=${c.campuses.join(', ')}` : '',
        c.regions?.length ? `region=${c.regions.join(', ')}` : '',
        c.intakes?.length ? `intake=${c.intakes.join(', ')}` : '',
        c.from ? `from=${c.from}` : '',
        c.to ? `to=${c.to}` : '',
      ]
        .filter(Boolean)
        .join('; ');

/** `18%` or `4500` (an amount in the terms' currency). */
function valueOf(s: string): { pct: number | null; amt: number | null } | null {
  const m = /^(\d+(?:\.\d+)?)\s*(%?)$/.exec(s.replace(/,/g, '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? (n > 0 && n <= 100 ? { pct: n, amt: null } : null) : n > 0 ? { pct: null, amt: n } : null;
}
const valueText = (v: { pct: number | null; amt: number | null }) => (v.pct != null ? `${v.pct}%` : `${v.amt}`);
const kindValue = (s: string): { kind: AddlKind; value: number } | null => {
  const v = valueOf(s);
  return v ? { kind: v.pct != null ? ADDL_KINDS[1] : ADDL_KINDS[0], value: (v.pct ?? v.amt)! } : null;
};
const kvText = (kind: AddlKind, value: number) => (kind === '%' ? `${value}%` : `${value}`);

function each<T>(text: string, one: (line: string, bad: (why: string) => void) => T | null): Parsed<T> {
  const ok: T[] = [];
  const bad: string[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const why: string[] = [];
    const v = one(line, (w) => why.push(w));
    if (why.length || v === null) bad.push(`Line ${i + 1}: ${why[0] ?? 'can’t read it'}.`);
    else ok.push(v);
  });
  return { ok, bad };
}

/* ---------- rate rows: `level=Master's; course=Master of Animation; region=Vietnam; period=2+; 18%` ---------- */

export const RATE_ROW_HINT = 'One a line: what it matches (level=, course=, campus=, region=, period= like 1, 2+ or 1-2) and the rate (18%) or a fixed amount (4500). The most specific match wins.';
export const parseRateRows = (text: string) =>
  each<RateRow>(text, (line, bad) => {
    const { kv, rest } = parts(line);
    const v = rest.length === 1 ? valueOf(rest[0]) : null;
    if (!v) bad('end it with a rate like 18% or an amount like 4500');
    if (!Object.keys(kv).length) bad('say what the row matches, like level=Master’s');
    const row: RateRow = { pct: v?.pct ?? null, amt: v?.amt ?? null };
    for (const [k, val] of Object.entries(kv)) {
      if (!ROW_KEYS.includes(k as (typeof ROW_KEYS)[number])) bad(`${k}= isn’t one of ${ROW_KEYS.join(', ')}`);
      else if (k === 'level') {
        const l = levelOf(val);
        if (!l) bad(`level is one of ${LEVELS.join(', ')}`);
        row.level = l;
      } else if (k === 'period') {
        if (!/^\d+(\+|-\d+)?$/.test(val)) bad('period is a number, like 1, 2+ or 1-2');
        row.period = val;
      } else (row as Record<string, unknown>)[k] = val;
    }
    return row;
  });
export const rateRowsText = (rows: RateRow[]) => rows.map((r) => [...ROW_KEYS.filter((k) => r[k]).map((k) => `${k}=${r[k]}`), valueText(r)].join('; ')).join('\n');

/* ---------- promotions: `Deakin PG 2026: 18%; Highest wins; level=Master's; from=2026-01-01` ---------- */

export const PROMO_HINT = `One a line: name: rate (18%) or amount; how it combines (${PROMO_COMBINES.join(', ')}); then its conditions (level=, course=, campus=, region=, intake=, from=, to=).`;
export const parsePromos = (text: string, ids: string[] = []) =>
  each<Promo>(text, (line, bad) => {
    const m = /^([^:]+):(.*)$/.exec(line);
    if (!m) return bad('start with the name and a colon'), null;
    const { kv, rest } = parts(m[2]);
    const v = rest[0] ? valueOf(rest[0]) : null;
    if (!v) bad('give the rate (18%) or amount after the name');
    const combine = PROMO_COMBINES.find((c) => lc(c) === lc(rest[1] ?? ''));
    if (!combine) bad(`say how it combines: ${PROMO_COMBINES.join(', ')}`);
    const cond = condOf(kv, bad);
    return { id: ids.shift() ?? newRuleId('pr'), name: m[1].trim(), pct: v?.pct ?? null, amt: v?.amt ?? null, combine: combine ?? PROMO_COMBINES[0], cond };
  });
export const promosText = (ps: Promo[]) => ps.map((p) => [`${p.name}: ${valueText(p)}`, p.combine, condLine(p.cond)].filter(Boolean).join('; ')).join('\n');

/* ---------- bonus schemes ---------- */

export const SCHEME_HINT = `One a line: name: per student 500 | at 20: 3000 | by count 10-14: 800, 15+: 1200 (amounts, or % of the first-year fee). Then, if needed: counted=${UNI_COUNTED_PER.join('/')}; retro=no; per country; conditions (region=, level=, course=, intake=, from=, to=).`;
export const parseSchemes = (text: string, ids: string[] = []) =>
  each<BonusScheme>(text, (line, bad) => {
    const m = /^([^:]+):(.*)$/.exec(line);
    if (!m) return bad('start with the name and a colon'), null;
    const segs = m[2].split(';').map((x) => x.trim()).filter(Boolean);
    const head = segs.shift() ?? '';
    const s: BonusScheme = { id: ids.shift() ?? newRuleId('bn'), name: m[1].trim(), per: BONUS_PER[0], kind: 'Amount', value: 0, threshold: null, bands: [], retro: true, perCountry: false, cond: {} };
    let h: RegExpExecArray | null;
    if ((h = /^per student\s+(.+)$/i.exec(head))) {
      const kv = kindValue(h[1]);
      if (!kv) bad('per student needs an amount or %');
      Object.assign(s, { per: BONUS_PER[0], ...kv });
    } else if ((h = /^at\s+(\d+)\s*:\s*(.+)$/i.exec(head))) {
      const kv = kindValue(h[2]);
      if (!kv) bad('at N needs an amount or %');
      Object.assign(s, { per: BONUS_PER[1], threshold: Number(h[1]), ...kv });
    } else if ((h = /^by count\s+(.+)$/i.exec(head))) {
      const bands: CountBand[] = [];
      for (const b of list(h[1])) {
        const bm = /^(\d+)(?:-(\d+)|(\+))\s*:\s*(.+)$/.exec(b);
        const kv = bm ? kindValue(bm[4]) : null;
        if (!bm || !kv) bad('by count bands look like 10-14: 800, 15+: 1200');
        else bands.push({ from: Number(bm[1]), to: bm[2] ? Number(bm[2]) : null, ...kv });
      }
      Object.assign(s, { per: BONUS_PER[2], bands });
    } else bad('say per student, at N or by count');
    const kv: Record<string, string> = {};
    for (const seg of segs) {
      const p = /^([a-z ]+)=(.*)$/i.exec(seg);
      if (lc(seg) === 'per country') s.perCountry = true;
      else if (p && lc(p[1]) === 'counted') {
        const c = UNI_COUNTED_PER.find((x) => lc(x) === lc(p[2]));
        if (!c) bad(`counted is one of ${UNI_COUNTED_PER.join(', ')}`);
        s.countedPer = c as UniCountedPer;
      } else if (p && lc(p[1]) === 'retro') s.retro = lc(p[2]) !== 'no';
      else if (p) kv[lc(p[1])] = p[2].trim();
      else bad(`can’t read “${seg}”`);
    }
    s.cond = condOf(kv, bad);
    return s;
  });
export const schemesText = (bs: BonusScheme[]) =>
  bs
    .map((b) =>
      [
        `${b.name}: ${b.per === BONUS_PER[0] ? `per student ${kvText(b.kind, b.value)}` : b.per === BONUS_PER[1] ? `at ${b.threshold}: ${kvText(b.kind, b.value)}` : `by count ${b.bands.map((x) => `${x.from}${x.to === null ? '+' : `-${x.to}`}: ${kvText(x.kind, x.value)}`).join(', ')}`}`,
        b.countedPer ? `counted=${b.countedPer}` : '',
        b.retro ? '' : 'retro=no',
        b.perCountry ? 'per country' : '',
        condLine(b.cond),
      ]
        .filter(Boolean)
        .join('; '),
    )
    .join('\n');

/* ---------- band bonuses: `band 2: 250` or `band 3: 1%` ---------- */

export const BAND_BONUS_HINT = 'One a line: band 2: 250 (an amount per student) or band 3: 1% (of the first-year fee). Band 1 is the first.';
export const parseBandBonuses = (text: string) =>
  each<BandBonus>(text, (line, bad) => {
    const m = /^band\s+(\d+)\s*:\s*(.+)$/i.exec(line);
    const kv = m ? kindValue(m[2]) : null;
    if (!m || !kv) return bad('write it like band 2: 250'), null;
    return { band: Number(m[1]), ...kv };
  });
export const bandBonusesText = (bs: BandBonus[]) => bs.map((b) => `band ${b.band}: ${kvText(b.kind, b.value)}`).join('\n');

/* ---------- a condition on its own (an additional commission's) ---------- */

export const parseCond = (text: string): { cond: Cond; bad: string | null } => {
  const why: string[] = [];
  const { kv, rest } = parts(text);
  if (rest.length) why.push(`can’t read “${rest[0]}”`);
  const cond = condOf(kv, (w) => why.push(w));
  return { cond, bad: why[0] ?? null };
};

let seq = 0;
export const newRuleId = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;
