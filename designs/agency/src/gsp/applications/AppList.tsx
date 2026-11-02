import { canEditNow } from '../../admin/data/menus';
import { routeApplication } from '../../data/regions';
import { PriorityChip } from '../../components/PriorityChip';
import { useEffect, useState } from 'react';
import { SelectMenu } from '../../components/SelectMenu';
import { Pager } from '../../screens/courses/ResultParts';
import { appliedAt } from './AppDetail';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DateInput, SelectInput } from '../../components/forms';
import { MultiPick } from '../../institution/records/MultiPick';
import { LIST_CHIPS, chipCounts, inChip, type ChipKey } from '../../data/listChips';

const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

import { fullName, type Member, type Student } from '../../data/students';
import { shortDate } from '../../data/dates';
import { STAGES, courseOf, destOf, isOpen, ownerOf, stageOf, statusText, type AppOwner, type Application } from '../../data/applications';
import { OWNER_WORD, pendingFromGsp } from './owners';
import { StageMeter } from './parts';
import { byRegion, gspIsMine, useScope } from '../../data/scope';
import { HOME_RP } from '../rps';

const ease = [0.2, 0.8, 0.2, 1] as const;

export type OwnerView = '' | 'you' | 'gsp' | 'uni';
/** The status chip picked ('' is All): data/listChips.ts (Jovial, 2 Nov). */
export type Progress = ChipKey | '';
/**
 * The list's filters. stage, from and to are the advanced ones (Jovial, 2 Nov): a stage, and the applied date between
 * two days (yyyy-mm-dd). `rps` (several, Jovial 2 Nov) and `region`: GSP's filters by recruitment partner and sales
 * region (W12); `who` is kept for older links.
 */
export type ListState = { owner: OwnerView; progress: Progress; q: string; dest: string; who: string; rps?: string[]; region?: string; intake: string; stage: string; from: string; to: string };
export const NEW_LIST: ListState = { owner: '', progress: '', q: '', dest: '', who: '', rps: [], region: '', intake: '', stage: '', from: '', to: '' };

/** A yyyy-mm-dd day from a date input, as the start or the end of that day. */
const dayStart = (d: string) => new Date(`${d}T00:00:00`).getTime();
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999`).getTime();
const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function AppList({
  apps: all,
  students,
  team,
  st,
  set,
  onOpen,
  onAdd,
  onFindCourses,
  say,
}: {
  apps: Application[];
  students: Student[];
  team: Member[];
  st: ListState;
  set: (fn: (s: ListState) => ListState) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onFindCourses: () => void;
  say: (m: string) => void;
}) {
  const reduce = useReducedMotion();
  let apps = all;
  const stu = (a: Application) => students.find((s) => s.id === a.studentId);
  const counsellorOf = (a: Application) => team.find((m) => m.id === stu(a)?.counsellor);
  // GSP sees every RP's applications (W12): each with its own RP and sales region, cut to the person's regions
  const rpOf = (a: Application) => a.rp ?? stu(a)?.rp ?? HOME_RP;
  // never a default region (HC27): one without a region is routed by Admin's rules
  const regionOf = (a: Application) => {
    if (a.region) return a.region;
    const s = stu(a);
    return routeApplication({ rp: a.rp ?? s?.rp, nationality: s?.nationality ?? '', livesIn: s?.country ?? '', dest: destOf(a) }).region;
  };
  useScope(); // re-render when the person switches to every region
  apps = byRegion(apps, regionOf);
  const owners = { '': apps.length, you: 0, gsp: 0, uni: 0 } as Record<OwnerView, number>;
  for (const a of apps) {
    const o = ownerOf(a);
    if (o === 'you' || o === 'gsp' || o === 'uni') owners[o]++;
  }
  const ql = st.q.trim().toLowerCase().replace(/\s+/g, '');
  const rows = apps
    .filter((a) => {
      const s = stu(a);
      if (st.owner && ownerOf(a) !== st.owner) return false;
      if (st.progress && !inChip(st.progress, a)) return false;
      if (st.dest && destOf(a) !== st.dest) return false;
      if (st.who && s?.counsellor !== st.who) return false;
      if (st.rps?.length && !st.rps.includes(rpOf(a))) return false;
      if (st.region && regionOf(a) !== st.region) return false;
      if (st.intake && a.intake !== st.intake) return false;
      if (st.stage && stageOf(a) !== Number(st.stage)) return false;
      // a typed date only filters once it's a whole date (DD/MM/YYYY)
      // the applied date (Jovial, 2 Nov: Applied date between)
      if (isIso(st.from) && appliedAt(a) < dayStart(st.from)) return false;
      if (isIso(st.to) && appliedAt(a) > dayEnd(st.to)) return false;
      // by application number or student name only, the fields the list shows (Jovial, 2 Nov: no passport)
      if (ql && !`${a.id}|${s ? fullName(s) : ''}`.toLowerCase().replace(/\s+/g, '').includes(ql)) return false;
      return true;
    })
    // what's pending on GSP first, then the rest by the latest change
    .sort((a, b) => Number(pendingFromGsp(b)) - Number(pendingFromGsp(a)) || Number(isOpen(b)) - Number(isOpen(a)) || b.since - a.since);
  const advanced = (st.stage ? 1 : 0) + (st.from || st.to ? 1 : 0);
  // 25 a page, numbered (S3C-14); any change of filter goes back to page 1
  const PER = 25;
  const [page, setPage] = useState(1);
  const sig = JSON.stringify(st);
  useEffect(() => setPage(1), [sig]);
  const filtered = !!(ql || st.dest || st.who || st.rps?.length || st.region || st.intake || st.progress || advanced);
  const narrowed = filtered || !!st.owner;
  // Clear all (Jovial, 2 Nov): every filter, the advanced ones and the status chip included
  const clear = () => set((p) => ({ ...p, q: '', dest: '', who: '', rps: [], region: '', intake: '', progress: '', stage: '', from: '', to: '' }));
  const [adv, setAdv] = useState(advanced > 0);
  // the chips count what the other filters leave (not the chip itself)
  const chipBase = apps.filter((a) => (!st.owner || ownerOf(a) === st.owner));
  const chipN = chipCounts(chipBase);
  const dests = [...new Set(apps.map(destOf))].sort();
  const rpNames = [...new Set(apps.map(rpOf))].sort((x, y) => x.localeCompare(y));
  const regions = [...new Set(apps.map(regionOf))].sort();

  // the table as it stands (its filters and order) as a CSV file, one row per application, the same columns
  const exportCsv = () => {
    const head = ['Application', 'Applied', 'Student', 'Course', 'University', 'Intake', 'Recruitment partner', 'Counsellor', 'Stage', 'Who has it', 'Status'];
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = rows.map((a) => {
      const c = courseOf(a);
      const s = stu(a);
      return [a.id, isoDay(appliedAt(a)), s ? fullName(s) : '', c.name, c.uni.name, a.intake, rpOf(a), counsellorOf(a)?.name ?? '', `${STAGES[stageOf(a)]} ${stageOf(a) + 1}/8`, OWNER_WORD[ownerOf(a)], statusText(a)]
        .map(cell)
        .join(',');
    });
    // a byte-order mark so Excel reads it as UTF-8; Windows line ends
    const csv = '\uFEFF' + [head.map(cell).join(','), ...lines].join('\r\n');
    const name = `applications-${isoDay(Date.now())}.csv`;
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.style.display = 'none';
      // in the page, so every browser follows it
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      say(`Downloaded ${name}: ${rows.length} ${rows.length === 1 ? 'application' : 'applications'}.`);
    } catch {
      say('Downloads aren’t allowed here. Open the portal in your browser to download.');
    }
  };

  if (!apps.length) return <Empty hasStudents={students.length > 0} onAdd={onAdd} onFindCourses={onFindCourses} />;

  return (
    <>
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">Applications</h1>
          <p className="stu__lead">{gspIsMine() ? 'Every RP’s applications: who has each one, and what’s pending on you.' : 'Every RP’s applications, and who has each one.'}</p>
        </div>
        <div className="apps__acts">
          <Button variant="secondary" iconLeft={<Icon name="download" size={16} />} onClick={exportCsv} disabled={!rows.length}>
            Download
          </Button>
          {canEditNow('Applications') && (
            <Button iconLeft={<Icon name="plus" size={18} />} onClick={onAdd}>
              Add application
            </Button>
          )}
        </div>
      </header>

      {/* who has them */}
      <div className="atiles" role="group" aria-label="Who has it">
        {(
          [
            ['', 'All applications'],
            ['gsp', 'On GSP'],
            ['you', 'On RP'],
            ['uni', 'On university'],
          ] as [OwnerView, string][]
        ).map(([k, label]) => (
          <button key={k || 'all'} type="button" className={`atile atile--${k || 'all'}`} aria-pressed={st.owner === k} onClick={() => set((p) => ({ ...p, owner: k }))}>
            <span className="atile__n num">{owners[k]}</span>
            <span className="atile__label">{label}</span>
          </button>
        ))}
      </div>

      <section className="card stable atable" aria-labelledby="atable-count">
        <div className="stools">
          {/* slice 3 PRD, Applications list (GSP): search; filters destination, recruitment partner, stage, and sales region
              for roles that see several. No other filters (the progress chips and date range are gone). */}
          <div className="stools__row atools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search applications</span>
              <input id="ap-q" type="search" placeholder="Application number or student name" value={st.q} onChange={(e) => set((p) => ({ ...p, q: e.target.value }))} />
            </label>
            <SelectInput id="ap-dest" aria-label="Destination" value={st.dest} placeholder="All destinations" allowEmpty onChange={(e) => set((p) => ({ ...p, dest: e.target.value }))}>
              {dests.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectInput>
            {/* Jovial, 2 Nov: several RPs at once, 20 to a page */}
            <MultiPick id="ap-rp" label="Recruitment partners" value={st.rps ?? []} options={rpNames} empty="All RPs" all="All RPs" search pageSize={20} onChange={(v) => set((p) => ({ ...p, rps: v }))} />
            <SelectInput id="ap-region" aria-label="Sales region" value={st.region ?? ''} placeholder="All sales regions" allowEmpty onChange={(e) => set((p) => ({ ...p, region: e.target.value }))}>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectInput>
            <button type="button" className={`aadv__toggle ${advanced ? 'is-set' : ''}`} aria-expanded={adv} aria-controls="ap-adv" onClick={() => setAdv((v) => !v)}>
              <Icon name="sliders" size={16} />
              Advanced filters
              {advanced > 0 && <span className="aadv__n">{advanced}</span>}
              <Icon name="chevronDown" size={16} className="aadv__chev" />
            </button>
          </div>
          {adv && (
            <div className="aadv" id="ap-adv">
              <div className="aadv__in">
                <div className="aadv__field">
                  <span className="aadv__label" id="ap-applied-l">Applied date between</span>
                  <span className="aadv__range">
                    <DateInput id="ap-from" aria-labelledby="ap-applied-l" aria-label="Applied from" value={st.from} max={isIso(st.to) ? st.to : undefined} onChange={(v) => set((p) => ({ ...p, from: v }))} />
                    <span className="aadv__and">and</span>
                    <DateInput id="ap-to" aria-label="Applied to" value={st.to} min={isIso(st.from) ? st.from : undefined} onChange={(v) => set((p) => ({ ...p, to: v }))} />
                    {(st.from || st.to) && (
                      <button type="button" className="btn btn--link aadv__x" onClick={() => set((p) => ({ ...p, from: '', to: '' }))}>
                        Clear
                      </button>
                    )}
                  </span>
                  {isIso(st.from) && isIso(st.to) && st.from > st.to && <span className="aadv__err">The second date is before the first.</span>}
                </div>
                <div className="aadv__field">
                  <span className="aadv__label">Stage</span>
                  <span className="aadv__range">
                    <span className="astage-pick">
                      <SelectMenu id="ap-stage" label="Stage" value={st.stage} placeholder="All stages" options={[{ value: '', label: 'All stages' }, ...STAGES.map((x, i) => ({ value: String(i), label: `${i + 1}. ${x}` }))]} onChange={(v) => set((p) => ({ ...p, stage: v }))} />
                    </span>
                    {st.stage && (
                      <button type="button" className="btn btn--link aadv__x" onClick={() => set((p) => ({ ...p, stage: '' }))}>
                        Clear
                      </button>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
          <StatusChips counts={chipN} value={st.progress} onPick={(k) => set((p) => ({ ...p, progress: k }))} />
          <p className="stools__count" id="atable-count" role="status">
            <span>
              <span className="num">{narrowed ? `${rows.length} of ${apps.length}` : apps.length}</span> {apps.length === 1 ? 'application' : 'applications'}
            </span>
            {filtered && (
              <button type="button" className="btn btn--link stools__clear" onClick={clear}>
                Clear all
              </button>
            )}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="snone">
            {filtered ? (
              <>
                <p className="snone__title">No applications match. Clear the search or filters.</p>
                <Button variant="secondary" size="sm" onClick={clear}>
                  Clear all
                </Button>
              </>
            ) : (
              <>
                <p className="snone__title">{st.owner === 'gsp' ? (gspIsMine() ? 'Nothing pending on you' : 'Nothing with GSP right now') : st.owner === 'you' ? 'Nothing with an RP right now' : 'Nothing with a university right now'}</p>
                <p className="snone__text">{st.owner === 'gsp' ? 'When something is, it shows here first.' : 'Applications move here as they progress.'}</p>
              </>
            )}
          </div>
        ) : (
          <div className="stab-wrap">
            <table className="atab atab--gsp" role="table" aria-label="Applications">
              <thead role="rowgroup">
                <tr role="row">
                  {['Application', 'Student', 'Course', 'Intake', 'Recruitment partner', 'Stage', 'Status'].map((h) => (
                    <th key={h} role="columnheader" scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {rows.slice((page - 1) * PER, page * PER).map((a, i) => {
                  const s = stu(a);
                  const c = courseOf(a);
                  const o = ownerOf(a);
                  const who = counsellorOf(a);
                  return (
                    <motion.tr
                      key={a.id}
                      role="row"
                      className={`arow arow--${o}`}
                      onClick={() => onOpen(a.id)}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, ease, delay: Math.min(i, 10) * 0.025 }}
                    >
                      <td role="cell" className="arow__id">
                        <button type="button" className="arow__open num" onClick={(e) => (e.stopPropagation(), onOpen(a.id))} aria-label={`${a.id}: ${s ? fullName(s) : ''}, ${c.name}`}>
                          {a.id}
                        </button>
                        <span className="arow__sub">
                          {a.status === 'docs' ? `Started ${shortDate(new Date(a.created), true)}` : `Applied ${shortDate(new Date(appliedAt(a)), true)}`}
                        </span>
                      </td>
                      <td role="cell" className="arow__stu">
                        <span className="arow__name">{s ? fullName(s) : 'Student removed'}</span>
                        <PriorityChip a={a} s={s} />
                      </td>
                      <td role="cell" className="arow__course">
                        <span className="arow__cname" title={c.name}>
                          {c.name}
                        </span>
                        <span className="arow__uni">{c.uni.name}</span>
                      </td>
                      <td role="cell" className="arow__intake">
                        {a.intake}
                      </td>
                      <td role="cell" className="arow__who">
                        <span>{rpOf(a)}</span>
                        {who && <span className="arow__sub">{who.name}</span>}
                      </td>
                      <td role="cell" className="arow__stage">
                        <StageMeter stage={stageOf(a)} owner={o} />
                        <span className="arow__sname">
                          {STAGES[stageOf(a)]} <span className="muted num">{stageOf(a) + 1}/8</span>
                        </span>
                      </td>
                      <td role="cell" className="arow__status">
                        <span className={`astat astat--${o}`}>
                          <span className="astat__own">{ownerWord(o)}</span>
                          <span className="astat__text">{statusText(a)}</span>
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            <Pager page={page} total={rows.length} onPage={setPage} per={PER} />
          </div>
        )}
      </section>
    </>
  );
}

const ownerWord = (o: AppOwner) => OWNER_WORD[o];

/**
 * The status chips (Jovial, 2 Nov): All, then data/listChips.ts's chips, each with its count; a chip with none is
 * greyed out and can't be picked.
 */
export function StatusChips({ counts, value, onPick }: { counts: Record<ChipKey | '', number>; value: ChipKey | ''; onPick: (k: ChipKey | '') => void }) {
  return (
    <div className="amiles" role="group" aria-label="Status">
      {[{ key: '' as const, label: 'All' }, ...LIST_CHIPS].map((c) => (
        <button key={c.key || 'all'} type="button" className="amile" aria-pressed={value === c.key} disabled={c.key !== '' && !counts[c.key] && value !== c.key} onClick={() => onPick(c.key)}>
          {c.label} <span className="num">{counts[c.key]}</span>
        </button>
      ))}
    </div>
  );
}

/** No applications yet: the journey an application takes, and how to start one. */
function Empty({ hasStudents, onAdd, onFindCourses }: { hasStudents: boolean; onAdd: () => void; onFindCourses: () => void }) {
  const reduce = useReducedMotion();
  return (
    <>
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">Applications</h1>
          <p className="stu__lead">{gspIsMine() ? 'Every RP’s applications: who has each one, and what’s pending on you.' : 'Every RP’s applications, and who has each one.'}</p>
        </div>
      </header>
      <section className="card aempty" aria-labelledby="aempty-title">
        <ol className="aempty__path" aria-label="The eight stages of an application">
          {STAGES.map((s, i) => (
            <motion.li
              key={s}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: 0.08 + i * 0.07 }}
              className={`aempty__stop aempty__stop--${i < 1 ? 'you' : i < 3 ? 'gsp' : i < 7 ? 'uni' : 'done'}`}
            >
              <span className="aempty__dot">{i + 1}</span>
              <span className="aempty__name">{s}</span>
            </motion.li>
          ))}
        </ol>
        <h2 id="aempty-title" className="sempty__title">
          No applications yet
        </h2>
        <p className="sempty__text">
          {hasStudents
            ? 'Pick a student and a course. GSP Assist checks they can be offered a place first, and reuses the documents on their profile.'
            : 'Add a student first, then pick a course for them. GSP Assist checks they can be offered a place and reuses their documents.'}
        </p>
        <div className="sempty__acts">
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={onAdd}>
            Add application
          </Button>
          <Button variant="secondary" iconLeft={<Icon name="search" size={18} />} onClick={onFindCourses}>
            Find courses
          </Button>
        </div>
        <ul className="aempty__notes">
          <li>
            <span className="aempty__ic aempty__ic--you" aria-hidden="true" />
            <span>
              <strong>Amber is the RP.</strong> Every application says who has it and what happens next.
            </span>
          </li>
          <li>
            <span className="aempty__ic aempty__ic--gsp" aria-hidden="true" />
            <span>
              <strong>Violet is GSP.</strong> Admissions checks the documents and submits to the university.
            </span>
          </li>
          <li>
            <span className="aempty__ic aempty__ic--uni" aria-hidden="true" />
            <span>
              <strong>Blue is the university.</strong> Offers, enrolment letters and the visa, with typical waits shown.
            </span>
          </li>
        </ul>
      </section>
    </>
  );
}
