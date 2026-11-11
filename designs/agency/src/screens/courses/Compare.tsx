import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { FLAG, daysTo, earnOf, earnText, intakeState, money, type Course } from '../../data/courses';
import { campusLabel, duration } from './parts';

/** Up to this many courses are compared or downloaded together (as in the PM prototype). */
export const MAX_PICK = 5;

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const nextOpen = (c: Course) => c.intakes.find((i) => intakeState(i) !== 'closed');

/**
 * What can be compared and downloaded about a course. `best` marks the row's best value (lowest or highest) when
 * the courses differ, money only in one currency. `csv` columns are ticked to begin with; `agent` ones (the base
 * commission) are never shown to students: not in Student view, not in the PDF for the student.
 */
type Field = {
  key: string;
  label: string;
  get: (c: Course) => string;
  num?: (c: Course) => number | null;
  best?: 'low' | 'high';
  money?: boolean;
  /** Where it appears: in the comparison and the PDF, and as a CSV column. */
  compare?: boolean;
  csv?: boolean;
  /** A CSV column ticked to begin with. */
  on?: boolean;
  agent?: boolean;
};

export const FIELDS: Field[] = [
  { key: 'course', label: 'Course', get: (c) => c.name, csv: true, on: true },
  { key: 'uni', label: 'University', get: (c) => c.uni.name, compare: true, csv: true, on: true },
  { key: 'campus', label: 'Campus', get: (c) => campusLabel(c.campus), compare: true, csv: true },
  { key: 'city', label: 'City', get: (c) => c.campus.city, csv: true, on: true },
  { key: 'country', label: 'Country', get: (c) => c.uni.country, compare: true, csv: true, on: true },
  { key: 'level', label: 'Level', get: (c) => c.level, compare: true, csv: true, on: true },
  { key: 'area', label: 'Study area', get: (c) => c.area, compare: true, csv: true },
  { key: 'mode', label: 'Study mode', get: (c) => c.mode, compare: true, csv: true },
  { key: 'duration', label: 'Duration', get: (c) => duration(c.months), compare: true, csv: true, on: true },
  { key: 'currency', label: 'Currency', get: (c) => c.currency, csv: true, on: true },
  { key: 'tuition', label: 'Tuition a year', get: (c) => money(c.tuition, c.currency), num: (c) => c.tuition, best: 'low', money: true, compare: true, csv: true, on: true },
  { key: 'total', label: 'Total tuition', get: (c) => money(Math.round((c.tuition * c.months) / 12), c.currency), num: (c) => Math.round((c.tuition * c.months) / 12), best: 'low', money: true, compare: true, csv: true },
  { key: 'schol', label: 'Scholarship', get: (c) => (c.scholarship ? `Up to ${money(c.scholarship, c.currency)}` : 'None listed'), num: (c) => c.scholarship, best: 'high', money: true, compare: true, csv: true, on: true },
  { key: 'fee', label: 'Application fee', get: (c) => (c.appFee ? money(c.appFee, c.currency) : 'Free'), num: (c) => c.appFee, best: 'low', money: true, compare: true, csv: true },
  { key: 'deposit', label: 'Deposit', get: (c) => money(c.deposit, c.currency), num: (c) => c.deposit, best: 'low', money: true, compare: true, csv: true },
  { key: 'intakes', label: 'Intakes', get: (c) => c.intakes.map((i) => i.month).join(', '), compare: true, csv: true, on: true },
  {
    key: 'deadline',
    label: 'Next deadline',
    get: (c) => {
      const i = nextOpen(c);
      return i ? `${i.month}: apply by ${shortDate(i.deadline)} (${daysTo(i.deadline)} days)` : 'Every intake closed';
    },
    compare: true,
    csv: true,
    on: true,
  },
  { key: 'ielts', label: 'IELTS overall', get: (c) => c.ielts[0].toFixed(1), num: (c) => c.ielts[0], best: 'low', compare: true, csv: true, on: true },
  { key: 'band', label: 'IELTS no band below', get: (c) => c.ielts[1].toFixed(1), num: (c) => c.ielts[1], best: 'low', compare: true, csv: true },
  { key: 'pte', label: 'PTE overall', get: (c) => String(c.pte[0]), num: (c) => c.pte[0], best: 'low', compare: true, csv: true },
  { key: 'toefl', label: 'TOEFL iBT overall', get: (c) => String(c.toefl[0]), num: (c) => c.toefl[0], best: 'low', compare: true, csv: true },
  { key: 'wait', label: 'English test can wait', get: (c) => (c.englishFlex ? 'Yes' : 'No'), compare: true, csv: true },
  { key: 'academic', label: 'Academic minimum (%)', get: (c) => `${c.academic}%`, num: (c) => c.academic, best: 'low', compare: true, csv: true, on: true },
  { key: 'qs', label: 'QS world ranking', get: (c) => (c.uni.qs ? `#${c.uni.qs}` : 'Not ranked'), num: (c) => c.uni.qs ?? null, best: 'low', compare: true, csv: true },
  { key: 'psw', label: 'Post-study work visa', get: (c) => (c.psw ? 'Yes' : 'No'), compare: true, csv: true },
  { key: 'web', label: 'University website', get: (c) => c.uni.website ?? '', csv: true },
  { key: 'earn', label: 'You earn (about)', get: (c) => earnText(c) ?? '—', num: (c) => earnOf(c) ?? -1, best: 'high', money: true, compare: true, csv: true, agent: true },
];
const BEST_WORD: Record<string, string> = { low: 'lowest', high: 'highest' };

/** The best value of a row across the courses, if they differ (money only when they share a currency). */
function bestOf(f: Field, list: Course[]): number | null {
  if (!f.best || !f.num || list.length < 2) return null;
  if (f.money && new Set(list.map((c) => c.currency)).size > 1) return null;
  const vals = list.map(f.num).filter((v): v is number => v !== null);
  if (vals.length < 2 || new Set(vals).size === 1) return null;
  return f.best === 'low' ? Math.min(...vals) : Math.max(...vals);
}
const wordFor = (f: Field) => (f.key === 'qs' ? 'best' : BEST_WORD[f.best!]);

/**
 * The bar under the results once a course is ticked to compare: how many, Deselect all, Compare (two or more)
 * and Download. It stays at the bottom of the results while they scroll.
 */
export function CompareBar({ n, onClear, onCompare, onDownload }: { n: number; onClear: () => void; onCompare: () => void; onDownload: () => void }) {
  return (
    <div className="cmpbar" role="region" aria-label="Courses picked to compare">
      <p className="cmpbar__n">
        <strong className="num">{n}</strong> {n === 1 ? 'course' : 'courses'} selected
        <span className="cmpbar__max"> · up to {MAX_PICK}</span>
      </p>
      <button type="button" className="cmpbar__btn" onClick={onClear}>
        <Icon name="close" size={16} />
        Deselect all
      </button>
      <button type="button" className="cmpbar__btn is-main" onClick={onCompare} disabled={n < 2} title={n < 2 ? 'Pick at least 2 courses to compare' : undefined}>
        <Icon name="sliders" size={16} />
        Compare
      </button>
      <button type="button" className="cmpbar__btn" onClick={onDownload}>
        <Icon name="download" size={16} />
        Download
      </button>
    </div>
  );
}

/**
 * The courses side by side, a column each with a line between them, the best of each row marked, and Apply and
 * Shortlist at the foot of each; then Download comparison.
 */
export function CompareSheet({
  open,
  list,
  agent,
  canApply,
  isShort,
  onApply,
  onShort,
  onClose,
  onRemove,
  onDownload,
}: {
  open: boolean;
  list: Course[];
  /** The agency's own view: the base commission shows (not in Student view). */
  agent: boolean;
  canApply: boolean;
  isShort: (id: string) => boolean;
  onApply: (c: Course) => void;
  /** Shortlist, as the star on a card does: for the student picked, or a list of students under the button. */
  onShort: (c: Course, anchor: HTMLElement) => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  onDownload: () => void;
}) {
  const rows = FIELDS.filter((f) => f.compare && (agent || !f.agent));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      expandable
      wide
      className="cmpsheet"
      title="Compare courses"
      sub={`${list.length} of up to ${MAX_PICK} courses. The best of each row is marked.`}
      footer={
        <div className="asf asf--end">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button iconLeft={<Icon name="download" size={16} />} onClick={onDownload} disabled={!list.length}>
              Download comparison
            </Button>
          </div>
        </div>
      }
    >
      <div className="cmp__scroll">
        <table className="cmp">
          <thead>
            <tr>
              <th scope="col" className="cmp__k">
                <span className="vh">Detail</span>
              </th>
              {list.map((c) => (
                <th key={c.id} scope="col" className="cmp__c">
                  <span className="cmp__name">{c.name}</span>
                  <span className="cmp__uni">
                    {c.uni.name} <span aria-hidden="true">{FLAG[c.uni.country]}</span>
                  </span>
                  <button type="button" className="cmp__rm" onClick={() => onRemove(c.id)} aria-label={`Remove ${c.name} from the comparison`}>
                    Remove
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const best = bestOf(f, list);
              return (
                <tr key={f.key} className={f.agent ? 'is-earn' : ''}>
                  <th scope="row" className="cmp__k">
                    {f.label}
                  </th>
                  {list.map((c) => {
                    const on = best !== null && f.num!(c) === best;
                    return (
                      <td key={c.id} className={on ? 'is-best' : ''}>
                        {f.get(c)}
                        {on && <span className="cmp__best"> {wordFor(f)}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="cmp__k">
                <span className="vh">Act on a course</span>
              </th>
              {list.map((c) => {
                const on = isShort(c.id);
                return (
                  <td key={c.id} className="cmp__acts">
                    <Button size="sm" onClick={() => onApply(c)} disabled={!canApply} aria-label={`Apply for ${c.name}, ${c.uni.name}`}>
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-pressed={on}
                      aria-label={`${on ? 'Shortlisted' : 'Shortlist'}: ${c.name}, ${c.uni.name}`}
                      iconLeft={<Icon name="star" size={16} className={on ? 'is-on' : undefined} />}
                      onClick={(e) => onShort(c, e.currentTarget)}
                    >
                      {on ? 'Shortlisted' : 'Shortlist'}
                    </Button>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      {list.length === 1 && <p className="cmp__more">Tick another course in the results to compare it with this one.</p>}
    </Sheet>
  );
}

/* ---------- downloading: the PDF for the student, or a CSV with the columns picked ---------- */

type Line = { text: string; size?: number; bold?: boolean; gap?: number; grey?: boolean };

/** A plain A4 PDF of lines (Helvetica, ASCII), wrapped to the page and over as many pages as it takes. */
function pdfOf(lines: Line[]) {
  const esc = (t: string) =>
    t
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/·/g, '|')
      .replace(/≈/g, '~')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/[\\()]/g, (m) => `\\${m}`);
  const wrap = (t: string, size: number) => {
    const max = Math.floor(483 / (size * 0.52));
    const out: string[] = [];
    let cur = '';
    for (const w of t.split(' ')) {
      if ((cur + ' ' + w).trim().length > max) {
        if (cur) out.push(cur);
        cur = w;
      } else cur = (cur + ' ' + w).trim();
    }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  };
  const pages: string[][] = [[]];
  let y = 790;
  for (const l of lines) {
    const size = l.size ?? 10;
    wrap(esc(l.text), size).forEach((t, i) => {
      y -= i === 0 ? l.gap ?? size * 1.5 : size * 1.4;
      if (y < 56) {
        pages.push([]);
        y = 790 - size;
      }
      pages[pages.length - 1].push(`BT /${l.bold ? 'F2' : 'F1'} ${size} Tf ${l.grey ? '0.4 0.4 0.45' : '0.08 0.1 0.14'} rg 56 ${y.toFixed(1)} Td (${t}) Tj ET`);
    });
  }
  const n = pages.length;
  // objects: catalog, pages, two fonts, then a page and its contents for each page
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  pages.forEach((p, i) => {
    const body = p.join('\n');
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });
  let out = '%PDF-1.4\n';
  const at: number[] = [];
  objs.forEach((o, i) => {
    at.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((x) => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const stamp = () => new Date().toISOString().slice(0, 10);

/** Who the PDF is from: the agency and the person sharing it. Never GSP's pricing or commission. */
export type Sender = { org: string; name: string; email: string };

/**
 * Download, for the courses picked (from the bar, or Download comparison): **PDF for the student**, the full
 * comparison under the agency's name and the sender's contact, a block per course with every detail (no base
 * commission), previewed as it will look; or **CSV spreadsheet**, with the columns to include ticked (or Select
 * all), previewed as a table. The base commission is a CSV column for the agency's own
 * use, unticked to begin with and gone in Student view.
 */
export function DownloadSheet({ open, list, agent, from, compare, onClose }: { open: boolean; list: Course[]; agent: boolean; from: Sender; compare: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'pdf' | 'csv'>('pdf');
  const cols = FIELDS.filter((f) => f.csv && (agent || !f.agent));
  const [on, setOn] = useState<string[]>(() => FIELDS.filter((f) => f.on).map((f) => f.key));
  const picked = cols.filter((f) => on.includes(f.key));
  const pdfRows = FIELDS.filter((f) => f.compare && !f.agent && f.key !== 'uni');
  const title = compare ? 'Course comparison' : 'Selected courses';

  const downloadPdf = () => {
    const lines: Line[] = [
      { text: from.org, size: 18, bold: true, gap: 0 },
      { text: `${from.name} | ${from.email}`, grey: true },
      { text: `${title} | ${today()}`, size: 12, bold: true, gap: 26 },
    ];
    list.forEach((c, i) => {
      lines.push({ text: `${i + 1}. ${c.name}`, size: 13, bold: true, gap: 28 });
      lines.push({ text: `${c.uni.name} | ${c.campus.city}, ${c.uni.country}`, grey: true });
      pdfRows.forEach((f) => lines.push({ text: `${f.label}: ${f.get(c)}`, gap: 15 }));
    });
    lines.push({ text: `Shared by ${from.org}. Fees and requirements as published by each university. No GSP pricing or commission.`, size: 8, grey: true, gap: 30 });
    save(pdfOf(lines), `${title.toLowerCase().replace(/ /g, '-')}-${stamp()}.pdf`);
  };
  const downloadCsv = () => {
    const out = [picked.map((f) => csvCell(f.label)).join(','), ...list.map((c) => picked.map((f) => csvCell(f.get(c))).join(','))].join('\n');
    save(new Blob([out], { type: 'text/csv' }), `courses-${stamp()}.csv`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      expandable
      className="cdown"
      title={`${title} · ${list.length} ${list.length === 1 ? 'course' : 'courses'}`}
      nav={
        <div className="cdown__kinds" role="tablist" aria-label="Download as">
          {(
            [
              ['pdf', 'PDF for the student'],
              ['csv', 'CSV spreadsheet'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={`cdown__kind ${kind === k ? 'is-on' : ''}`} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>
      }
      footer={
        <div className="asf asf--end">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {kind === 'pdf' ? (
              <Button iconLeft={<Icon name="download" size={16} />} onClick={downloadPdf} disabled={!list.length}>
                Download PDF
              </Button>
            ) : (
              <Button iconLeft={<Icon name="download" size={16} />} onClick={downloadCsv} disabled={!picked.length || !list.length}>
                Download CSV
              </Button>
            )}
          </div>
        </div>
      }
    >
      {kind === 'pdf' ? (
        <div className="cdown__body">
          <p className="cdown__k">Preview</p>
          <article className="cdoc" aria-label="PDF preview">
            <header className="cdoc__head">
              <div>
                <p className="cdoc__org">{from.org}</p>
                <p className="cdoc__who">
                  {from.name} · {from.email}
                </p>
              </div>
              <p className="cdoc__what">
                {title}
                <span>{today()}</span>
              </p>
            </header>
            {list.map((c, i) => (
              <section key={c.id} className="cdoc__course">
                <h3 className="cdoc__name">
                  {i + 1}. {c.name}
                </h3>
                <p className="cdoc__uni">
                  {c.uni.name} · {c.campus.city}, {c.uni.country}
                </p>
                <dl className="cdoc__facts">
                  {pdfRows.map((f) => (
                    <div key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>{f.get(c)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <p className="cdoc__note">Your agency’s name and contact details only: no GSP pricing or commission. Fees and requirements as published by each university.</p>
          </article>
        </div>
      ) : (
        <div className="cdown__body">
          <div className="cdown__colhead">
            <p className="cdown__k">
              Columns · {picked.length} of {cols.length}
            </p>
            <p className="cdown__quick">
              <button type="button" className="btn btn--link" onClick={() => setOn(cols.map((f) => f.key))}>
                Select all
              </button>
            </p>
          </div>
          <fieldset className="cdown__cols">
            <legend className="vh">Columns to include</legend>
            {cols.map((f) => (
              <label key={f.key} className={`cdown__col ${on.includes(f.key) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={on.includes(f.key)} onChange={(e) => setOn((l) => (e.target.checked ? [...l, f.key] : l.filter((k) => k !== f.key)))} />
                <span>{f.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="cdown__k">
            Preview · {list.length} {list.length === 1 ? 'row' : 'rows'}
          </p>
          {picked.length ? (
            <div className="cdown__scroll">
              <table className="cdown__table">
                <thead>
                  <tr>
                    {picked.map((f) => (
                      <th key={f.key} scope="col">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      {picked.map((f) => (
                        <td key={f.key}>{f.get(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="cdown__none">Tick at least one column.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
