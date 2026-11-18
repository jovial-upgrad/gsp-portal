import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { Filter, downloadCsv } from '../institution/records/parts';
import { STATUS } from '../data/applications';
import type { Reporting, RepApp } from './data';
import { courseOf, daysSince, intakeText, lastChange, milestoneOf, options, uniOf, type Filters, type Grain, type InsightSettings, noFilters, filtersOn } from './metrics';

/* ---------- the filter bar, the same on every dashboard ---------- */
export function FilterBar({ d, f, set }: { d: Reporting; f: Filters; set: (f: Filters) => void }) {
  const o = useMemo(() => options(d), [d]);
  const put = <K extends keyof Filters>(k: K) => (v: Filters[K]) => set({ ...f, [k]: v });
  return (
    <div className="ins-filters" role="group" aria-label="Filters">
      <Filter id="df-intake" label="Intake" all="All intakes" value={f.intake} options={o.intake} labels={intakeText} onChange={put('intake')} />
      <Filter id="df-dest" label="Destination" all="All destinations" value={f.dest} options={o.dest} onChange={put('dest')} />
      <Filter id="df-country" label="Source country" all="All source countries" value={f.country} options={o.country} onChange={put('country')} />
      <Filter id="df-region" label="Sales region" all="All sales regions" value={f.region} options={o.region} onChange={put('region')} />
      <Filter id="df-uni" label="University" all="All universities" value={f.uni} options={o.uni} onChange={put('uni')} />
      <Filter id="df-rm" label="Regional manager" all="All regional managers" value={f.rm} options={o.rm} onChange={put('rm')} />
      <Filter id="df-bdm" label="BDM" all="All BDMs" value={f.bdm} options={o.bdm} onChange={put('bdm')} />
      <Filter id="df-rp" label="RP" all="All RPs" value={f.rp} options={o.rp} onChange={put('rp')} />
      <span className="ins-filters__dates">
        <label htmlFor="df-from">Received</label>
        <input id="df-from" type="date" value={f.from} onChange={(e) => set({ ...f, from: e.target.value })} />
        <span aria-hidden="true">–</span>
        <label htmlFor="df-to" className="vh">
          Received to
        </label>
        <input id="df-to" type="date" value={f.to} onChange={(e) => set({ ...f, to: e.target.value })} />
      </span>
      <Seg label="Applications" value={f.state} items={[['all', 'All'], ['live', 'Live'], ['closed', 'Closed']]} onPick={(v) => set({ ...f, state: v })} />
      {filtersOn(f) > 0 && (
        <Button variant="secondary" size="sm" className="ins-filters__clear" onClick={() => set(noFilters())}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

/** A small set of choices, one picked. */
export function Seg<K extends string>({ label, value, items, onPick }: { label: string; value: K; items: [K, string][]; onPick: (k: K) => void }) {
  return (
    <span className="ins-seg" role="group" aria-label={label}>
      {items.map(([k, t]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onPick(k)}>
          {t}
        </button>
      ))}
    </span>
  );
}

/** A card on a dashboard. */
export function Card({ title, sub, action, children, flush }: { title: string; sub?: string; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className={`ins-card ${flush ? 'ins-card--flush' : ''}`}>
      <div className="ins-card__head">
        <div>
          <h2 className="ins-card__t">{title}</h2>
          {sub && <p className="ins-card__sub">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A count that opens the applications behind it. */
export function Num({ apps, open, title, children }: { apps: RepApp[]; open: (t: string, a: RepApp[]) => void; title: string; children?: ReactNode }) {
  if (!apps.length) return <span className="ins-num ins-num--zero">{children ?? 0}</span>;
  return (
    <button type="button" className="ins-num" onClick={() => open(title, apps)} aria-label={`${title}: ${apps.length.toLocaleString('en-GB')}, open the list`}>
      {children ?? apps.length.toLocaleString('en-GB')}
    </button>
  );
}

/* ---------- a bar chart over time, one series: per period or the running total (never both on two axes) ---------- */
const dateText = (at: number, g: Grain) => new Date(at).toLocaleDateString('en-GB', g === 'month' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short', year: '2-digit' });
export function TimeBars({ points, grain, running, label, open }: { points: { at: number; apps: RepApp[] }[]; grain: Grain; running: boolean; label: string; open: (t: string, a: RepApp[]) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, L = 40, B = 34, T = 10;
  const vals = points.reduce<number[]>((acc, p, i) => [...acc, running ? (acc[i - 1] ?? 0) + p.apps.length : p.apps.length], []);
  const max = Math.max(1, ...vals);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const bw = (W - L) / Math.max(1, points.length);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const every = Math.max(1, Math.ceil(points.length / 8));
  const cum = (i: number) => points.slice(0, i + 1).flatMap((p) => p.apps);
  return (
    <div className="ins-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}${running ? ', running total' : ''}, by ${grain}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="ins-chart__grid" x1={L} x2={W} y1={y(t)} y2={y(t)} />
            <text className="ins-chart__axis" x={L - 6} y={y(t) + 4} textAnchor="end">
              {t.toLocaleString('en-GB')}
            </text>
          </g>
        ))}
        {running ? (
          <polyline className="ins-chart__line" points={vals.map((v, i) => `${L + i * bw + bw / 2},${y(v)}`).join(' ')} />
        ) : (
          vals.map((v, i) => {
            const h = Math.max(v ? 2 : 0, H - B - y(v));
            const x = L + i * bw + Math.min(2, bw * 0.15);
            const w = Math.max(1, bw - Math.min(4, bw * 0.3));
            return <path key={i} className="ins-chart__bar" data-on={hover === i} d={`M${x},${H - B} v${-Math.max(0, h - Math.min(4, w / 2))} q0,${-Math.min(4, w / 2)} ${Math.min(4, w / 2)},${-Math.min(4, w / 2)} h${w - 2 * Math.min(4, w / 2)} q${Math.min(4, w / 2)},0 ${Math.min(4, w / 2)},${Math.min(4, w / 2)} v${Math.max(0, h - Math.min(4, w / 2))} z`} />;
          })
        )}
        {running && hover !== null && <circle className="ins-chart__dot" cx={L + hover * bw + bw / 2} cy={y(vals[hover])} r={5} />}
        {points.map((p, i) =>
          i % every === 0 ? (
            <text key={p.at} className="ins-chart__axis" x={L + i * bw + bw / 2} y={H - B + 16} textAnchor="middle">
              {dateText(p.at, grain)}
            </text>
          ) : null,
        )}
        {points.map((p, i) => (
          <rect
            key={`h${p.at}`}
            className="ins-chart__hit"
            x={L + i * bw}
            y={T}
            width={bw}
            height={H - B - T}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => open(`${label}, ${running ? 'up to ' : ''}${dateText(p.at, grain)}`, running ? cum(i) : p.apps)}
          >
            <title>{`${dateText(p.at, grain)}: ${vals[i].toLocaleString('en-GB')}`}</title>
          </rect>
        ))}
      </svg>
      {hover !== null && (
        <div className="ins-tip" style={{ left: `${((L + hover * bw + bw / 2) / W) * 100}%`, top: `${(y(vals[hover]) / H) * 100}%` }}>
          <b>{dateText(points[hover].at, grain)}</b> · {vals[hover].toLocaleString('en-GB')} {running ? 'so far' : ''}
        </div>
      )}
    </div>
  );
}

/* ---------- the applications behind a number ---------- */
export function Drill({ open, title, apps, d, s, now, onClose }: { open: boolean; title: string; apps: RepApp[]; d: Reporting; s: InsightSettings; now: number; onClose: () => void }) {
  const [n, setN] = useState(50);
  const student = useMemo(() => new Map(d.students.map((x) => [x.id, x])), [d]);
  const rp = useMemo(() => new Map(d.rps.map((x) => [x.id, x])), [d]);
  const rows = [...apps].sort((a, b) => lastChange(a) - lastChange(b));
  const csv = () =>
    downloadCsv(`${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, [
      ['Application', 'Student', 'University', 'Course', 'Destination', 'Intake', 'BDM', 'RP', 'Stage', 'Status', 'Days since last change'],
      ...rows.map((a) => [a.id, student.get(a.student)?.name ?? '', uniOf(a.uni), courseOf(a.course), a.dest, intakeText(a.intake), a.bdm, rp.get(a.rp)?.name ?? '', milestoneOf(a, s.milestones).label, statusOf(a), daysSince(lastChange(a), now)]),
    ]);
  return (
    <Sheet open={open} onClose={onClose} center wide title={title} sub={`${apps.length.toLocaleString('en-GB')} ${apps.length === 1 ? 'application' : 'applications'}`} className="ins-drill" footer={<div className="asf"><div className="asf__acts"><Button variant="secondary" onClick={csv}>Download CSV</Button><Button onClick={onClose}>Done</Button></div></div>}>
      <p className="ins-drill__meta">Oldest status change first.</p>
      <div className="ins-scroll">
        <table className="itab">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">University</th>
              <th scope="col">Destination</th>
              <th scope="col">BDM</th>
              <th scope="col">RP</th>
              <th scope="col">Stage</th>
              <th scope="col">Status</th>
              <th scope="col" className="n">
                Days idle
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, n).map((a) => (
              <tr key={a.id}>
                <td>
                  <span className="cfg__strong">{student.get(a.student)?.name}</span>
                  <span className="irow__sub">{a.id}</span>
                </td>
                <td>{uniOf(a.uni)}</td>
                <td>{a.dest}</td>
                <td>{a.bdm}</td>
                <td>{rp.get(a.rp)?.name}</td>
                <td>{milestoneOf(a, s.milestones).label}</td>
                <td>{statusOf(a)}</td>
                <td className="n">{daysSince(lastChange(a), now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > n && (
        <div className="imore">
          <span className="imore__n">
            {n} of {rows.length.toLocaleString('en-GB')}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setN(n + 100)}>
            Show more
          </Button>
        </div>
      )}
    </Sheet>
  );
}
/** The status in words: the portal's own status text, or the closing reason. */
export const statusOf = (a: RepApp) => (a.end ? `Closed: ${a.end.kind}` : STATUS[a.moves[a.moves.length - 1].s].text(a.dest));

/* ---------- a table: columns say how to show and how to export each cell ---------- */
export type Col<R> = { h: string; n?: boolean; v: (r: R) => ReactNode; csv?: (r: R) => string | number };
export function Table<R>({ rows, cols, rowKey, empty, foot }: { rows: R[]; cols: Col<R>[]; rowKey: (r: R) => string; empty?: string; foot?: ReactNode }) {
  if (!rows.length) return <p className="ins-empty">{empty ?? 'Nothing for these filters.'}</p>;
  return (
    <div className="ins-scroll">
      <table className="itab ins-tab">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.h} scope="col" className={c.n ? 'n' : undefined}>
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {cols.map((c) => (
                <td key={c.h} className={c.n ? 'n' : undefined}>
                  {c.v(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot}
      </table>
    </div>
  );
}
/** A table's rows for a CSV: its headings, then each row's export value (or its text). */
export const tableCsv = <R,>(rows: R[], cols: Col<R>[]) => [cols.map((c) => c.h), ...rows.map((r) => cols.map((c) => (c.csv ? c.csv(r) : String(c.v(r) ?? ''))))];
/** A "Download CSV" for one table. */
export const CsvButton = <R,>({ name, rows, cols }: { name: string; rows: R[]; cols: Col<R>[] }) => (
  <Button variant="secondary" size="sm" onClick={() => downloadCsv(`${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, tableCsv(rows, cols))}>
    Download CSV
  </Button>
);
/** A page's own tabs. */
export function Tabs<K extends string>({ value, items, onPick, label }: { value: K; items: [K, string][]; onPick: (k: K) => void; label: string }) {
  return (
    <div className="ins-tabs" role="tablist" aria-label={label}>
      {items.map(([k, t]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className="ins-tabs__t" onClick={() => onPick(k)}>
          {t}
        </button>
      ))}
    </div>
  );
}
/** A stat tile that opens its applications. */
export function Stat({ title, apps, count, sub, open }: { title: string; apps: RepApp[]; count?: number | string; sub?: string; open: (t: string, a: RepApp[]) => void }) {
  return (
    <button type="button" className="ins-stat" onClick={() => apps.length && open(title, apps)} aria-label={`${title}: ${count ?? apps.length}, open the list`}>
      <span className="ins-stat__k">{title}</span>
      <span className="ins-stat__n">{typeof count === 'string' ? count : (count ?? apps.length).toLocaleString('en-GB')}</span>
      {sub && <span className="ins-stat__sub">{sub}</span>}
    </button>
  );
}
/** The drill-down, held by a page. */
export function useDrill() {
  const [drill, setDrill] = useState<{ title: string; apps: RepApp[] } | null>(null);
  return { drill, open: (title: string, apps: RepApp[]) => setDrill({ title, apps }), close: () => setDrill(null) };
}
