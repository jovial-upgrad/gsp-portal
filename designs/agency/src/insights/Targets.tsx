import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { Checkbox, Field, SelectInput, TextInput } from '../components/forms';
import { Icon } from '../components/Icon';
import { Filter, PageHead, downloadCsv, useAsk } from '../institution/records/parts';
import { todayIso } from '../institution/data/records';
import { TARGET_LEVELS, TARGET_METRICS, readTargets, templateRows, versionRows, type ReadRow, type TargetLevel, type TargetVersion } from './targets';

/**
 * Admin › Targets (Jovial, 18 Nov): the business shares its targets as a table; Admin uploads it as a CSV into a
 * named version. One version is current: the dashboards compare with it. Versions stay, so a plan and its revisions
 * can be compared.
 */
export function Targets({ names, versions, setVersions, me, say, fyStart = 4 }: { fyStart?: number; names: Record<TargetLevel, string[]>; versions: TargetVersion[]; setVersions: (f: (v: TargetVersion[]) => TargetVersion[]) => void; me: string; say: (t: string) => void }) {
  const [pick, setPick] = useState(versions.find((v) => v.current)?.id ?? versions[0]?.id ?? '');
  const [up, setUp] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const { ask, dialog } = useAsk();
  const v = versions.find((x) => x.id === pick);
  // this financial year (it starts in the Dashboard settings' month): the template's quarters
  const now = new Date();
  const fy = now.getMonth() + 1 >= fyStart ? now.getFullYear() + 1 : now.getFullYear();
  const rows = (v?.rows ?? []).filter((r) => (!levels.length || levels.includes(r.level)) && (!periods.length || periods.includes(r.period)));
  const makeCurrent = (id: string) => {
    setVersions((l) => l.map((x) => ({ ...x, current: x.id === id })));
    say(`${versions.find((x) => x.id === id)?.name} is now the current targets.`);
  };
  const remove = (id: string) => {
    const x = versions.find((y) => y.id === id);
    if (!x || x.current) return;
    setVersions((l) => l.filter((y) => y.id !== id));
    setPick(versions.find((y) => y.current)?.id ?? '');
    say(`${x.name} deleted.`);
  };
  return (
    <div className="ins">
      <PageHead title="Targets" lead="What the business aims for, by BDM, sales region, destination, university or IP, per month or quarter of the course start. The dashboards compare with the current version.">
        <Button variant="secondary" iconLeft={<Icon name="download" size={18} />} onClick={() => downloadCsv(`targets-template-fy${String(fy).slice(2)}.csv`, templateRows(names, fy, fyStart))}>
          Download template
        </Button>
        <Button iconLeft={<Icon name="upload" size={18} />} onClick={() => setUp(true)}>
          Upload targets
        </Button>
      </PageHead>
      <section className="ins-card">
        <h2 className="ins-card__t">How targets get in, and where they show</h2>
        <ol className="ins-steps">
          <li>
            <strong>Download template</strong>: every {TARGET_LEVELS.join(', ').toLowerCase()} the portal knows, one row per quarter of FY{String(fy).slice(2)} (by course start). Fill only what the business sets; empty rows are skipped. A quarter (OND 26) or a month (2027-02) goes in Period.
          </li>
          <li>
            <strong>Upload targets</strong> as a named version (AOP, a revision, a country manager's projection). Lines that can't be read are listed with the reason before saving. Make one version <strong>current</strong>.
          </li>
          <li>
            The dashboards compare each target with the applications whose course starts in that period and that reached that stage:
            <ul>
              <li>Company: Overview tiles</li>
              <li>BDM (the application BDM): Sales tracker, Potential to earn, Leadership pack (BDM target vs actual)</li>
              <li>Sales region: Country report (applications and enrolments); a country manager's projection is a version too</li>
              <li>Destination: Leadership pack (Destination targets)</li>
              <li>University: Admissions › University tracker (Enrolment target)</li>
            </ul>
          </li>
        </ol>
        <p className="ins-card__sub">Columns: {TARGET_METRICS.map((m) => m.col).join(', ')}.</p>
      </section>
      <div className="ins-ver" role="group" aria-label="Versions">
        {versions.map((x) => (
          <button key={x.id} type="button" className="ins-ver__chip" aria-pressed={x.id === pick} onClick={() => setPick(x.id)}>
            {x.name}
            {x.current && <span className="ins-ver__cur">Current</span>}
            <span className="cfg__muted">{x.rows.length} rows</span>
          </button>
        ))}
      </div>
      {v ? (
        <section className="ins-card ins-card--flush">
          <div className="ins-card__head">
            <div>
              <h2 className="ins-card__t">{v.name}</h2>
              <p className="ins-card__sub">
                Uploaded by {v.by} on {new Date(`${v.at}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {v.current ? ' · the dashboards use this version' : ''}
              </p>
            </div>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Filter id="tg-level" label="Level" all="All levels" value={levels} options={[...new Set(v.rows.map((r) => r.level))]} onChange={setLevels} />
              <Filter id="tg-period" label="Period" all="All periods" value={periods} options={[...new Set(v.rows.map((r) => r.period))]} onChange={setPeriods} />
              <Button variant="secondary" size="sm" onClick={() => downloadCsv(`${v.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, versionRows(v))}>
                Download
              </Button>
              {!v.current && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => makeCurrent(v.id)}>
                    Make current
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => ask(`Delete ${v.name}?`, 'Delete version', <p>Its {v.rows.length} targets go. The current version stays.</p>, () => remove(v.id))}>
                    Delete
                  </Button>
                </>
              )}
            </span>
          </div>
          <div className="ins-scroll">
            <table className="itab ins-tab">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Level</th>
                  <th scope="col">Period</th>
                  {TARGET_METRICS.map((m) => (
                    <th key={m.key} scope="col" className="n">
                      {m.col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.level}|${r.name}|${r.period}`}>
                    <td>{r.name}</td>
                    <td>{r.level}</td>
                    <td>{r.period}</td>
                    {TARGET_METRICS.map((m) => (
                      <td key={m.key} className="n">
                        {r.values[m.key] !== undefined ? r.values[m.key].toLocaleString('en-GB') : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="muted">No targets yet. Upload the business’s targets to start.</p>
      )}
      {dialog}
      <UploadSheet
        open={up}
        names={names}
        versions={versions}
        onClose={() => setUp(false)}
        onSave={(name, into, rows, current) => {
          const id = into || `tv-${Date.now()}`;
          setVersions((l) => {
            const kept = l.filter((x) => x.id !== into);
            const was = l.find((x) => x.id === into);
            const nv: TargetVersion = { id, name, current: current || !!was?.current, by: me, at: todayIso(), rows };
            return [...(current ? kept.map((x) => ({ ...x, current: false })) : kept), nv];
          });
          setPick(id);
          setUp(false);
          say(`${rows.length} targets saved in ${name}.`);
        }}
      />
    </div>
  );
}

function UploadSheet({ open, names, versions, onClose, onSave }: { open: boolean; names: Record<TargetLevel, string[]>; versions: TargetVersion[]; onClose: () => void; onSave: (name: string, into: string, rows: TargetVersion['rows'], current: boolean) => void }) {
  const [into, setInto] = useState('');
  const [name, setName] = useState('');
  const [read, setRead] = useState<ReadRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [current, setCurrent] = useState(false);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setInto('');
    setName('');
    setRead([]);
    setErr(null);
    setCurrent(false);
    setTried(false);
  }, [open]);
  const good = useMemo(() => read.flatMap((r) => (r.row ? [r.row] : [])), [read]);
  const bad = read.filter((r) => r.error);
  const v = name.trim();
  const e = {
    name: !into && !v ? 'Name the version, like “AOP FY28”.' : !into && versions.some((x) => x.name.toLowerCase() === v.toLowerCase()) ? 'There’s a version with this name: pick it under “Replace a version”.' : null,
    file: !read.length ? err ?? 'Choose a file.' : !good.length ? 'No line in the file can be used.' : null,
  };
  const save = () => {
    setTried(true);
    if (e.name || e.file) return;
    onSave(into ? versions.find((x) => x.id === into)!.name : v, into, good, current);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      wide
      className="iform"
      title="Upload targets"
      sub="A CSV with Level, Name, Period and a column per target"
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Save {good.length ? `${good.length} targets` : 'targets'}</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="tu-into" label="Replace a version" hint="Leave it empty to make a new version.">
          <SelectInput id="tu-into" value={into} placeholder="None: a new version" allowEmpty onChange={(ev) => setInto(ev.target.value)}>
            {versions.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        {!into && (
          <Field id="tu-name" label="Version name" required error={tried ? e.name : null}>
            <TextInput id="tu-name" value={name} maxLength={40} onChange={(ev) => setName(ev.target.value)} />
          </Field>
        )}
        <div className="iform__wide">
          <Checkbox id="tu-current" checked={current} onChange={setCurrent} hint="The dashboards compare with this version from now on.">
            Make it the current targets
          </Checkbox>
        </div>
        <Field id="tu-file" label="Targets file" required className="iform__wide" hint={`Levels: ${TARGET_LEVELS.join(', ')}. Periods: a month (2027-02) or a quarter (OND 26). Targets: ${TARGET_METRICS.map((m) => m.col).join(', ')}.`} error={tried ? e.file : null}>
          <input
            id="tu-file"
            type="file"
            accept=".csv,text/csv"
            onChange={async (ev) => {
              const file = ev.target.files?.[0];
              if (!file) return;
              const out = readTargets(await file.text(), names);
              setRead(out.rows);
              setErr(out.error ?? null);
            }}
          />
        </Field>
        {read.length > 0 && (
          <p className="iform__wide cmuted" role="status">
            {good.length} {good.length === 1 ? 'line' : 'lines'} ready{bad.length ? `, ${bad.length} left out` : ''}.
          </p>
        )}
        {bad.length > 0 && (
          <table className="iform__wide itab ins-tab">
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">Why it’s left out</th>
              </tr>
            </thead>
            <tbody className="ins-bad">
              {bad.slice(0, 20).map((r) => (
                <tr key={r.line}>
                  <td>{r.line}</td>
                  <td>{r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Sheet>
  );
}
