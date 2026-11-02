import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field } from '../../components/forms';
import { MIN_EDUCATION } from '../../data/courses';
import { getDb, liveAreas, liveLevels } from '../data/store';
import { DURATION_UNITS, SCALES, SCALE_MAX, SOURCES, type CourseRec, type UniRec } from '../data/catalogue';
import { acceptOf, audit, checkFile } from '../data/changelog';
import { basicsErrors, MODES, newCourse, type CourseDraft } from './CourseForm';
import { ErrorText, Pick, downloadCsv } from './parts';

/** The template's columns (slice 2 PRD, S2-3; source: S2C-4; minimum highest education and its minimum score: S2C-3). */
export const CSV_COLUMNS = ['course code', 'CRICOS course code', 'course name', 'campus', 'program level', 'study area', 'study mode', 'duration', 'unit', 'course page', 'last checked', 'source', 'minimum highest education', 'minimum score', 'minimum score scale'] as const;
const MAX_ROWS = 1000;

/** Splits CSV text into rows of cells (quotes, commas and new lines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}
const isoOf = (s: string) => {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t;
};
const inList = <T extends string>(v: string, list: readonly T[]): T | undefined => list.find((x) => x.toLowerCase() === v.trim().toLowerCase());

type Skipped = { row: number; reason: string; cells: string[] };

/**
 * CSV import (S2-3): from the Courses list it asks for the university first; from a university it's already set.
 * CSV only, up to 5 MB and 1,000 rows. Every row is checked as Add a course checks it; good rows load as Drafts
 * ("Course created (CSV import)"), bad rows are skipped and listed with their row number and reason, with Download
 * skipped rows.
 */
export function CsvImport({ open, uni, unis, courses, onClose, onLoad, me, role }: { open: boolean; uni?: string; unis: UniRec[]; courses: CourseRec[]; onClose: () => void; onLoad: (recs: CourseRec[]) => void; me: string; role: string }) {
  const [pickUni, setPickUni] = useState(uni ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ loaded: number; skipped: Skipped[]; file: string } | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setPickUni(uni ?? '');
    setErr(null);
    setResult(null);
  }, [open, uni]);
  const u = unis.find((x) => x.id === pickUni);

  const read = async (f: File) => {
    const bad = checkFile(f, ['csv'], 5);
    if (bad) return setErr(bad);
    if (!u) return setErr('Pick a university.');
    const rows = parseCsv(await f.text());
    const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
    const col = (name: string) => head.indexOf(name.toLowerCase());
    if (col('course code') < 0 || col('course name') < 0) return setErr('Use the template: its first row names the columns.');
    const body = rows.slice(1);
    if (body.length > MAX_ROWS) return setErr(`This file has ${body.length.toLocaleString('en-GB')} rows. Import up to 1,000 at a time.`);
    const skipped: Skipped[] = [];
    const made: CourseRec[] = [];
    body.forEach((cells, i) => {
      const at = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? '').trim() : '');
      const rowNo = i + 2;
      const campusName = at('campus');
      const campus = u.campuses.find((k) => k.name.toLowerCase() === campusName.toLowerCase());
      // Admin's lists (S2C-13): a retired level or area isn't taken
      const level = inList(at('program level'), liveLevels(getDb()));
      const area = inList(at('study area'), liveAreas(getDb()));
      const mode = inList(at('study mode'), MODES);
      const unit = inList(at('unit'), DURATION_UNITS);
      const source = at('source') ? inList(at('source'), SOURCES) : ('Added by hand' as const);
      const minEd = at('minimum highest education') ? inList(at('minimum highest education'), MIN_EDUCATION) : '';
      const scale = at('minimum score scale') ? inList(at('minimum score scale'), SCALES) : at('minimum score') ? undefined : '';
      const score = at('minimum score') ? Number(at('minimum score')) : undefined;
      const reason = !campus || u.inactive.includes(campus.name)
        ? `Campus “${campusName}” isn’t an active campus of this university.`
        : at('program level') && !level
          ? `Program level “${at('program level')}” isn’t in Admin’s Program levels.`
          : at('study area') && !area
            ? `Study area “${at('study area')}” isn’t in Admin’s Study areas.`
            : at('study mode') && !mode
              ? `Study mode “${at('study mode')}” isn’t one of Full time, Part time, Blended, Online.`
              : at('unit') && !unit
                ? `Unit “${at('unit')}” isn’t one of Months, Years, Weeks, Credits.`
                : !source
                  ? `Source “${at('source')}” isn’t one of University website, StudyLink, Email, Added by hand.`
                  : minEd === undefined
                    ? `Minimum highest education “${at('minimum highest education')}” isn’t one of ${MIN_EDUCATION.join(', ')}.`
                    : scale === undefined
                      ? `Minimum score scale “${at('minimum score scale')}” isn’t one of ${SCALES.join(', ')}.`
                      : score !== undefined && (!(score > 0) || (scale && score > SCALE_MAX[scale]))
                        ? `Minimum score “${at('minimum score')}” isn’t a number above 0${scale ? `, up to ${SCALE_MAX[scale]} on ${scale}` : ''}.`
                        : null;
      if (reason) return skipped.push({ row: rowNo, reason, cells });
      const d: CourseDraft = { uni: u.id, campus: campus!.name, name: at('course name'), code: at('course code').toUpperCase(), cricos: at('CRICOS course code'), level: (level ?? '') as CourseDraft['level'], area: (area ?? '') as CourseDraft['area'], mode: mode ?? '', durUnit: unit ?? '', durValue: at('duration'), url: at('course page'), checked: isoOf(at('last checked')), source: source ?? '', minEducation: minEd || undefined, minScore: score, minScoreScale: scale || undefined };
      const e = basicsErrors(d, u, [...courses, ...made]);
      const first = Object.entries(e).find(([, x]) => x);
      if (first) {
        const [k, msg] = first;
        const why = k === 'code' && msg!.startsWith('This code') ? `Course code ${d.code} is already used at ${d.campus}.` : msg!.replace(/\.$/, '');
        return skipped.push({ row: rowNo, reason: k === 'code' && msg!.startsWith('This code') ? why : `${why}${why.endsWith('.') ? '' : '.'}`, cells });
      }
      made.push(newCourse(d, unis, [...courses, ...made], { by: me, role }, 'Course created (CSV import)'));
    });
    onLoad(made);
    audit('Courses', `CSV import for ${u.name}: ${made.length} drafts loaded, ${skipped.length} rows skipped (course.created)`, me, role);
    setResult({ loaded: made.length, skipped, file: f.name });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title="Import courses from a CSV"
      sub="Each good row loads as a Draft. Rows with a problem are skipped and listed here."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              {result ? 'Done' : 'Cancel'}
            </Button>
          </div>
        </div>
      }
    >
      {!result ? (
        <>
          <div className="iform__grid">
            {!uni && (
              <Field id="icsv-uni" label="University" required className="iform__wide">
                <Pick id="icsv-uni" label="University" value={pickUni} placeholder="Pick a university" options={unis.filter((x) => x.status !== 'Ended').map((x) => ({ value: x.id, label: x.name }))} onChange={(v) => (setPickUni(v), setErr(null))} />
              </Field>
            )}
            <Field id="icsv-file" label="CSV file" required hint="CSV only, up to 5 MB and 1,000 rows." className="iform__wide">
              <button id="icsv-file" type="button" className={`ipick ${err ? 'is-invalid' : ''}`} onClick={() => (u ? pick.current?.click() : setErr('Pick a university.'))}>
                <Icon name="upload" size={18} />
                <span className="ipick__t">Choose a CSV file</span>
              </button>
            </Field>
          </div>
          {err && <ErrorText>{err}</ErrorText>}
          <p className="irsec__note">
            <button type="button" className="btn btn--link" onClick={() => downloadCsv('gsp-course-import-template.csv', [[...CSV_COLUMNS], ['MBIO-BP-01', '012345A', 'Master of Biotechnology', u?.campuses[0]?.name ?? 'Bedford Park', 'Master’s degree', 'Health and nursing', 'Full time', '24', 'Months', 'https://www.university.edu/courses/master-biotechnology', '2026-11-02', 'University website', 'Bachelor’s (3 years)', '60', 'Percentage']])}>
              Download the template
            </button>{' '}
            Columns: {CSV_COLUMNS.join(', ')}.
          </p>
          <input
            ref={pick}
            type="file"
            accept={acceptOf(['csv'])}
            className="vh"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="icsv-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void read(f);
            }}
          />
        </>
      ) : (
        <div role="status">
          <p className="isave__t">
            {result.file}: <strong>{result.loaded}</strong> {result.loaded === 1 ? 'course loaded as a Draft' : 'courses loaded as Drafts'}, <strong>{result.skipped.length}</strong> {result.skipped.length === 1 ? 'row skipped' : 'rows skipped'}.
          </p>
          {result.skipped.length > 0 && (
            <>
              <div className="stab-wrap">
                <table className="itab">
                  <thead>
                    <tr>
                      <th scope="col">Row</th>
                      <th scope="col">Why it was skipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.skipped.map((s) => (
                      <tr key={s.row}>
                        <td className="num">{s.row}</td>
                        <td>{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="secondary" size="sm" iconLeft={<Icon name="download" size={16} />} onClick={() => downloadCsv('skipped-rows.csv', [['row', 'reason', ...CSV_COLUMNS], ...result.skipped.map((s) => [s.row, s.reason, ...s.cells])])}>
                Download skipped rows
              </Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
