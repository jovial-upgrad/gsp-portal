import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field } from '../../components/forms';
import { FileDrop } from '../../components/FileDrop';
import { QS_CSV_COLUMNS, QS_MAX_RANK, QS_SOURCE, type UniRec } from '../data/catalogue';
import { acceptOf, audit, checkFile, withLog, type LogSpec } from '../data/changelog';
import { stampBy } from '../data/records';
import { parseCsv } from './CsvImport';
import { ErrorText, downloadCsv } from './parts';

const SPEC: LogSpec<UniRec> = { record: 'University', fields: { qs: 'Overview · QS world ranking', qsYear: 'Overview · QS year' } };
const MAX_ROWS = 2000;
type Skipped = { row: number; reason: string; cells: string[] };
type Result = { file: string; updated: number; unchanged: number; skipped: Skipped[] };

/** The template: every university with its current QS rank and year, to edit and upload back. */
export const qsTemplate = (unis: UniRec[], year: number): (string | number)[][] => [
  [...QS_CSV_COLUMNS],
  ...[...unis].sort((a, b) => a.name.localeCompare(b.name)).map((u) => [u.name, QS_SOURCE, u.qs ?? '', u.qsYear ?? (u.qs ? year : '')]),
];

/**
 * Update the QS ranking of every university in one go (S2-2; Jovial, S2C-17), from the Universities page. Download
 * the template (every university, its rank now), change it, and upload it back: CSV only, up to 5 MB. A row matches
 * a university by its name; only rows whose ranking is QS change anything; a rank is a whole number from 1, or
 * empty (or "—") for unranked. Each change goes in the university's Change log and the audit log; the result lists
 * the rows updated, unchanged and skipped (with why), with Download skipped rows.
 */
export function QsImport({ open, unis, onClose, onApply, me, role }: { open: boolean; unis: UniRec[]; onClose: () => void; onApply: (next: UniRec[]) => void; me: string; role: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const year = new Date().getFullYear();
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setResult(null);
  }, [open]);

  const read = async (f: File) => {
    const bad = checkFile(f, ['csv'], 5);
    if (bad) return setErr(bad);
    const rows = parseCsv(await f.text());
    const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
    const col = (name: string) => head.indexOf(name);
    if (col('university') < 0 || col('rank') < 0) return setErr('Use the template: its first row names the columns.');
    const body = rows.slice(1);
    if (body.length > MAX_ROWS) return setErr(`This file has ${body.length.toLocaleString('en-GB')} rows. Upload up to ${MAX_ROWS.toLocaleString('en-GB')} at a time.`);
    const skipped: Skipped[] = [];
    const changes = new Map<string, { qs?: number; qsYear?: number }>();
    const seen = new Set<string>();
    let unchanged = 0;
    body.forEach((cells, i) => {
      const at = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? '').trim() : '');
      const row = i + 2;
      const name = at('university');
      const u = unis.find((x) => x.name.toLowerCase() === name.toLowerCase() || (x.aka ?? []).some((a) => a.toLowerCase() === name.toLowerCase()));
      const source = at('ranking') || QS_SOURCE;
      const rankText = at('rank').replace(/^#/, '');
      const unranked = rankText === '' || rankText === '—' || rankText === '-';
      const rank = Number(rankText);
      const yearText = at('year');
      const y = yearText ? Number(yearText) : year;
      const reason = !name
        ? 'No university named.'
        : !u
          ? `“${name}” isn’t a university on the portal.`
          : source.toLowerCase() !== QS_SOURCE.toLowerCase()
            ? `The ranking is “${source}”: only ${QS_SOURCE} rows update the QS rank.`
            : !unranked && (!/^\d+$/.test(rankText) || rank < 1 || rank > QS_MAX_RANK)
              ? `Rank “${at('rank')}” isn’t a whole number from 1 to ${QS_MAX_RANK.toLocaleString('en-GB')} (leave it empty for unranked).`
              : !/^\d{4}$/.test(String(y)) || y > year + 1
                ? `Year “${yearText}” isn’t a year like ${year}.`
                : seen.has(u.id)
                  ? `${u.name} is on an earlier row too; the first one counts.`
                  : null;
      if (reason) return skipped.push({ row, reason, cells });
      seen.add(u!.id);
      const next = unranked ? { qs: undefined, qsYear: undefined } : { qs: rank, qsYear: y };
      if (u!.qs === next.qs && (u!.qs ? u!.qsYear === next.qsYear : true)) return void unchanged++;
      changes.set(u!.id, next);
    });
    const real = [...changes.entries()];
    const next = unis.map((u) => {
      const c = real.find(([k]) => k === u.id)?.[1];
      return c ? withLog(SPEC, u, { ...u, qs: c.qs, qsYear: c.qsYear, stamps: { ...u.stamps, qs: stampBy(me) } }, me, role) : u;
    });
    if (real.length) onApply(next);
    audit('Universities', `QS ranking CSV ${f.name}: ${real.length} universities updated, ${unchanged} unchanged, ${skipped.length} rows skipped`, me, role);
    setResult({ file: f.name, updated: real.length, unchanged, skipped });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title="Update QS rankings"
      sub={`Every university’s QS world ranking in one go. Only ${QS_SOURCE} rows change a rank; an empty rank means unranked (shown as “—” and sorted last).`}
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
          <p className="irsec__note">
            <Button variant="link" iconLeft={<Icon name="download" size={16} />} onClick={() => downloadCsv('gsp-qs-ranking-template.csv', qsTemplate(unis, year))}>
              Download the template
            </Button>{' '}
            It lists every university with its rank now. Columns: {QS_CSV_COLUMNS.join(', ')}.
          </p>
          <Field id="iqs-file" label="CSV file" required error={err} hint="CSV only, up to 5 MB." className="iform__wide">
            <FileDrop id="iqs-file" accept={acceptOf(['csv'])} invalid={!!err} describedBy={err ? 'iqs-file-error' : undefined} onFiles={(fs) => fs[0] && void read(fs[0])} label="Drag the CSV here, or" button="Choose a CSV file" />
          </Field>
          {err && <ErrorText>{err}</ErrorText>}
        </>
      ) : (
        <div role="status">
          <p className="isave__t">
            {result.file}: <strong>{result.updated}</strong> {result.updated === 1 ? 'university updated' : 'universities updated'}, <strong>{result.unchanged}</strong> unchanged, <strong>{result.skipped.length}</strong> {result.skipped.length === 1 ? 'row skipped' : 'rows skipped'}.
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
              <Button variant="secondary" size="sm" iconLeft={<Icon name="download" size={16} />} onClick={() => downloadCsv('qs-skipped-rows.csv', [['row', 'reason', ...QS_CSV_COLUMNS], ...result.skipped.map((s) => [s.row, s.reason, ...s.cells])])}>
                Download skipped rows
              </Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
