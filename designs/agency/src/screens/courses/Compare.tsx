import { fmtDate } from '../../data/format';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { durationText, feeAYear, intakeState, money, scholarshipsOf, totalTuition, urlOf, type Course } from '../../data/courses';
import { UniMark } from './parts';
import { campusState, convert } from './search';
import { academicRulesFor, englishRulesFor } from '../../data/eligibility';

/** Up to this many courses are compared or downloaded together (slice 3 PRD). */
export const MAX_PICK = 5;

const shortDate = (iso: string) => fmtDate(iso);

/**
 * The comparison's fields (slice 3 PRD, decided): only these, in this order; the CSV has the same fields. `best` is
 * the row's tag (Lowest, Yes, Best); `num` the value it's decided on (null: "—", which never wins); money is compared
 * in one currency, converted with Admin's Currency exchange (S3C-5). `country`: the search's student country, whose
 * requirements the Requirements row shows.
 */
type Field = {
  key: string;
  label: string;
  get: (c: Course, country: string) => string;
  /** A second, smaller line (the fee a year under the total). */
  sub?: (c: Course) => string;
  num?: (c: Course, cur: string, country: string) => number | null;
  best?: 'low' | 'high';
  tag?: string;
};
/** The next open intake's deadline (the earliest isn't highlighted). */
const deadlineOf = (c: Course) => {
  const i = c.intakes.find((x) => intakeState(x) === 'open');
  return i ? `${shortDate(i.deadline)} (${i.month})` : '—';
};
/** Yes when the university has a scholarship that fits the course and the student's country (S3C-12). */
const hasScholarship = (c: Course, country: string) => scholarshipsOf(c).some((x) => !x.forCountries?.length || x.forCountries.includes(country));
/** Requirements for the student's country: minimum highest education, academic minimum and English overall. */
function requirements(c: Course, country: string) {
  const a = academicRulesFor(c, country)[0];
  const e = englishRulesFor(c, country);
  const min = a ? (a.scale === 'Percentage' ? `${a.min}%` : `${a.min} (${a.scale})`) : '—';
  const eng = e.length ? e.map((r) => `${r.test.replace(/ (Academic|iBT|English Test)$/, '')} ${r.overall}`).join(', ') : '—';
  return `Minimum highest education: ${c.minHighestEducation ?? '—'} · Academic minimum: ${min} · English overall: ${eng}`;
}
export const FIELDS: Field[] = [
  { key: 'level', label: 'Program level', get: (c) => c.level },
  { key: 'duration', label: 'Duration', get: (c) => durationText(c) },
  { key: 'intakes', label: 'Intakes', get: (c) => c.intakes.filter((i) => intakeState(i) !== 'closed').map((i) => i.month).join(', ') || '—' },
  { key: 'deadline', label: 'Application deadline', get: (c) => deadlineOf(c) },
  { key: 'tuition', label: 'Tuition fee', get: (c) => money(totalTuition(c), c.currency), sub: (c) => `${money(feeAYear(c), c.currency)} a year`, num: (c, cur) => convert(totalTuition(c), c.currency, cur), best: 'low', tag: 'Lowest' },
  { key: 'fee', label: 'Application fee', get: (c) => (c.appFee ? money(c.appFee, c.currency) : 'Free'), num: (c, cur) => convert(c.appFee, c.currency, cur), best: 'low', tag: 'Lowest' },
  { key: 'schol', label: 'Scholarship', get: (c, k) => (hasScholarship(c, k) ? 'Yes' : 'No'), num: (c, _cur, k) => (hasScholarship(c, k) ? 1 : 0), best: 'high', tag: 'Yes' },
  { key: 'req', label: 'Requirements', get: (c, k) => requirements(c, k) },
  { key: 'qs', label: 'QS rank', get: (c) => (c.uni.qs ? `#${c.uni.qs}` : '—'), num: (c) => c.uni.qs ?? null, best: 'low', tag: 'Best' },
];
/** The header's fields, first in the CSV: course name, university, state and country, course URL. */
const HEAD: Field[] = [
  { key: 'course', label: 'Course', get: (c) => c.name },
  { key: 'uni', label: 'University', get: (c) => c.uni.name },
  { key: 'where', label: 'State and country', get: (c) => [campusState(c), c.uni.country].filter(Boolean).join(', ') },
  { key: 'url', label: 'Course URL', get: (c) => urlOf(c) ?? (c.uni.website ? `https://${c.uni.website}` : '—') },
];
const CSV_FIELDS = [...HEAD, ...FIELDS];

/**
 * The courses a row tags (slice 3 PRD): only when 2 or more courses have a value and the values differ; ties tag
 * every tied course; a missing value never wins. Scholarship tags the Yes ones.
 */
function tagged(f: Field, list: Course[], country: string): Set<string> {
  if (!f.best || !f.num || list.length < 2) return new Set();
  const cur = list[0].currency;
  const vals = list.map((c) => ({ id: c.id, v: f.num!(c, cur, country) })).filter((x): x is { id: string; v: number } => x.v !== null);
  if (vals.length < 2) return new Set();
  const round = (v: number) => Math.round(v * 100) / 100;
  if (new Set(vals.map((x) => round(x.v))).size === 1) return new Set();
  const win = f.best === 'low' ? Math.min(...vals.map((x) => round(x.v))) : Math.max(...vals.map((x) => round(x.v)));
  return new Set(vals.filter((x) => round(x.v) === win).map((x) => x.id));
}

/**
 * The bar under the results once a course is ticked: N selected, Deselect all, Compare (on from 2, "Pick at least
 * 2 courses to compare" under it) and Download (on from 1).
 */
export function CompareBar({ n, onClear, onCompare, onDownload }: { n: number; onClear: () => void; onCompare: () => void; onDownload: () => void }) {
  return (
    <div className="cmpbar" role="region" aria-label="Courses picked to compare">
      <p className="cmpbar__n">
        <strong className="num">{n}</strong> selected
        <span className="cmpbar__max"> · up to {MAX_PICK}</span>
      </p>
      <button type="button" className="cmpbar__btn" onClick={onClear}>
        <Icon name="close" size={16} />
        Deselect all
      </button>
      <button type="button" className="cmpbar__btn is-main" onClick={onCompare} disabled={n < 2} aria-describedby={n < 2 ? 'cmpbar-hint' : undefined}>
        <Icon name="sliders" size={16} />
        Compare
      </button>
      <button type="button" className="cmpbar__btn" onClick={onDownload} disabled={n < 1}>
        <Icon name="download" size={16} />
        Download
      </button>
      {n < 2 && (
        <p id="cmpbar-hint" className="cmpbar__hint">
          Pick at least 2 courses to compare
        </p>
      )}
    </div>
  );
}

/**
 * The comparison (slice 3 PRD): a table, one column per course, the decided fields in order, each row's tag where it
 * applies, and a line saying whose requirements they are. No Apply or Shortlist here: both stay on the result cards.
 */
export function CompareSheet({ open, list, country, onClose, onRemove, onDownload }: { open: boolean; list: Course[]; /** The search's student country. */ country: string; onClose: () => void; onRemove: (id: string) => void; onDownload: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      expandable
      wide
      className="cmpsheet"
      title="Compare courses"
      sub={`${list.length} of up to ${MAX_PICK} courses.`}
      footer={
        <div className="asf asf--end">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button iconLeft={<Icon name="download" size={16} />} onClick={onDownload} disabled={!list.length}>
              Download
            </Button>
          </div>
        </div>
      }
    >
      <p className="cmp__note">Requirements are for students from {country}, the search’s student country.</p>
      <div className="cmp__scroll">
        <table className="cmp">
          <thead>
            <tr>
              <th scope="col" className="cmp__k">
                <span className="vh">Detail</span>
              </th>
              {list.map((c) => {
                const url = HEAD[3].get(c, country);
                return (
                  <th key={c.id} scope="col" className="cmp__c">
                    <span className="cmp__head">
                      <UniMark u={c.uni} />
                      <span className="cmp__name">{c.name}</span>
                      <span className="cmp__uni">{c.uni.name}</span>
                      <span className="cmp__where">{HEAD[2].get(c, country)}</span>
                      {url !== '—' && (
                        <a className="cs-web" href={url} target="_blank" rel="noreferrer">
                          Course page
                          <Icon name="external" size={14} />
                          <span className="vh"> (opens in a new tab)</span>
                        </a>
                      )}
                    </span>
                    <button type="button" className="cmp__rm" onClick={() => onRemove(c.id)} aria-label={`Remove ${c.name} from the comparison`}>
                      Remove
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => {
              const win = tagged(f, list, country);
              return (
                <tr key={f.key}>
                  <th scope="row" className="cmp__k">
                    {f.label}
                  </th>
                  {list.map((c) => {
                    const v = f.get(c, country);
                    const on = win.has(c.id);
                    return (
                      <td key={c.id} className={on ? 'is-best' : ''}>
                        {v === '—' ? <span className="cmp__dash">—</span> : v}
                        {f.sub && <span className="cmp__sub">{f.sub(c)}</span>}
                        {on && <span className="cmp__best"> {f.tag}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 1 && <p className="cmp__more">Tick another course in the results to compare it with this one.</p>}
    </Sheet>
  );
}

/* ---------- downloading: the PDF for the student, or the CSV for internal use ---------- */

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
const today = () => fmtDate(new Date());
const stamp = () => new Date().toISOString().slice(0, 10);

/** Who the PDF is from: the agency and the person sharing it. Never GSP's pricing or commission. */
export type Sender = { org: string; name: string; email: string };

/**
 * Download, for the courses picked (from the bar, or the comparison's Download): **PDF for the student**, the
 * comparison's fields under the agency's name and the sender's contact, never any commission; or **CSV for internal
 * use**, the same fields as columns (logged as a download, slice 1).
 */
export function DownloadSheet({ open, list, country, from, compare, onClose }: { open: boolean; list: Course[]; country: string; from: Sender; compare: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'pdf' | 'csv'>('pdf');
  const title = compare ? 'Course comparison' : 'Selected courses';

  const downloadPdf = () => {
    const lines: Line[] = [
      { text: from.org, size: 18, bold: true, gap: 0 },
      { text: [from.name, from.email].filter(Boolean).join(' | '), grey: true },
      { text: `${title} | ${today()}`, size: 12, bold: true, gap: 26 },
      { text: `Requirements are for students from ${country}.`, grey: true },
    ];
    list.forEach((c, i) => {
      lines.push({ text: `${i + 1}. ${c.name}`, size: 13, bold: true, gap: 28 });
      lines.push({ text: `${c.uni.name} | ${HEAD[2].get(c, country)}`, grey: true });
      lines.push({ text: HEAD[3].get(c, country), grey: true });
      FIELDS.forEach((f) => lines.push({ text: `${f.label}: ${f.get(c, country)}${f.sub ? ` (${f.sub(c)})` : ''}`, gap: 15 }));
    });
    lines.push({ text: `Shared by ${from.org}. Fees and requirements as published by each university.`, size: 8, grey: true, gap: 30 });
    save(pdfOf(lines), `${title.toLowerCase().replace(/ /g, '-')}-${stamp()}.pdf`);
  };
  const downloadCsv = () => {
    const out = [CSV_FIELDS.map((f) => csvCell(f.label)).join(','), ...list.map((c) => CSV_FIELDS.map((f) => csvCell(f.get(c, country))).join(','))].join('\n');
    // a .csv download is logged where the browser saves it (data/downloads.ts)
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
              ['csv', 'CSV for internal use'],
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
              <Button iconLeft={<Icon name="download" size={16} />} onClick={downloadCsv} disabled={!list.length}>
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
                <p className="cdoc__who">{[from.name, from.email].filter(Boolean).join(' · ')}</p>
              </div>
              <p className="cdoc__what">
                {title}
                <span>{today()}</span>
              </p>
            </header>
            <p className="cdoc__note">Requirements are for students from {country}.</p>
            {list.map((c, i) => (
              <section key={c.id} className="cdoc__course">
                <h3 className="cdoc__name">
                  {i + 1}. {c.name}
                </h3>
                <p className="cdoc__uni">
                  {c.uni.name} · {HEAD[2].get(c, country)}
                </p>
                <dl className="cdoc__facts">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>
                        {f.get(c, country)}
                        {f.sub ? ` (${f.sub(c)})` : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <p className="cdoc__note">Your agency’s name and contact details only: never any commission. Fees and requirements as published by each university.</p>
          </article>
        </div>
      ) : (
        <div className="cdown__body">
          <p className="cdown__k">
            Preview · {list.length} {list.length === 1 ? 'row' : 'rows'} · the comparison’s fields. The download is logged.
          </p>
          <div className="cdown__scroll">
            <table className="cdown__table">
              <thead>
                <tr>
                  {CSV_FIELDS.map((f) => (
                    <th key={f.key} scope="col">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    {CSV_FIELDS.map((f) => (
                      <td key={f.key}>{f.get(c, country)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Sheet>
  );
}
