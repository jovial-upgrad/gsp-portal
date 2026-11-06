import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectInput, TextInput } from '../../components/forms';
import { FLAG } from '../../data/courses';
import { fullName, type Member, type Student } from '../../data/students';
import { shortDate } from '../../data/dates';
import { STAGES, courseOf, destOf, isOpen, ownerOf, stageOf, statusText, rankOf, type AppOwner, type Application } from '../../data/applications';
import { RankTag } from '../../components/RankTag';
import { OWNER_WORD, pendingFromGsp } from './owners';
import { StageMeter } from './parts';

const ease = [0.2, 0.8, 0.2, 1] as const;

export type OwnerView = '' | 'you' | 'gsp' | 'uni';
export type Progress = '' | 'new' | 'applied' | 'offer' | 'deposit' | 'enrolled' | 'closed';
/** The list's filters. stage, from and to are the advanced ones: a stage, and when the application started (yyyy-mm-dd). */
export type ListState = { owner: OwnerView; progress: Progress; q: string; dest: string; who: string; intake: string; stage: string; from: string; to: string };
export const NEW_LIST: ListState = { owner: '', progress: '', q: '', dest: '', who: '', intake: '', stage: '', from: '', to: '' };

/**
 * The primary filters: how far an application has got, read from the status it's at (and so its stage).
 * Each open application is in exactly one; closed ones are in none.
 */
const PROGRESS: [Progress, string, string, (a: Application) => boolean][] = [
  ['new', 'New', 'Waiting for documents, or GSP checking them', (a) => isOpen(a) && stageOf(a) <= 1],
  ['applied', 'Applied', 'Submitted to the university, waiting for a decision', (a) => isOpen(a) && stageOf(a) === 2],
  ['offer', 'Offer received', 'An offer, and the deposit not paid yet', (a) => isOpen(a) && (stageOf(a) === 3 || stageOf(a) === 4 || a.status === 'deposit')],
  ['deposit', 'Deposit paid', 'The tuition or deposit paid, through to the visa and enrolment', (a) => isOpen(a) && ((stageOf(a) === 5 && a.status !== 'deposit') || stageOf(a) >= 6)],
  ['enrolled', 'Enrolled', 'The student is enrolled', (a) => a.status === 'enrolled'],
  // 3 Nov (Nesil): the ones that ended (withdrawn, rejected, refused, deferred, not eligible…)
  ['closed', 'Closed', 'Ended before enrolment: withdrawn, rejected, refused, deferred or not eligible', (a) => a.status === 'closed'],
];

/** A yyyy-mm-dd day from a date input, as the start or the end of that day. */
const dayStart = (d: string) => new Date(`${d}T00:00:00`).getTime();
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999`).getTime();
const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function AppList({
  apps,
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
  const stu = (a: Application) => students.find((s) => s.id === a.studentId);
  const counsellorOf = (a: Application) => team.find((m) => m.id === stu(a)?.counsellor);
  const owners = { '': apps.length, you: 0, gsp: 0, uni: 0 } as Record<OwnerView, number>;
  for (const a of apps) {
    const o = ownerOf(a);
    if (o === 'you' || o === 'gsp' || o === 'uni') owners[o]++;
  }
  const ql = st.q.trim().toLowerCase().replace(/\s+/g, '');
  const rows = apps
    .filter((a) => {
      const s = stu(a);
      const c = courseOf(a);
      if (st.owner && ownerOf(a) !== st.owner) return false;
      if (st.progress && !PROGRESS.find((m) => m[0] === st.progress)![3](a)) return false;
      if (st.dest && destOf(a) !== st.dest) return false;
      if (st.who && s?.counsellor !== st.who) return false;
      if (st.intake && a.intake !== st.intake) return false;
      if (st.stage && stageOf(a) !== Number(st.stage)) return false;
      if (st.from && a.created < dayStart(st.from)) return false;
      if (st.to && a.created > dayEnd(st.to)) return false;
      if (ql && !`${a.id}${a.uniRef ?? ''}${s ? fullName(s) : ''}${c.name}${c.uni.name}`.toLowerCase().replace(/\s+/g, '').includes(ql)) return false;
      return true;
    })
    // what's pending on GSP first, then the rest by the latest change
    .sort((a, b) => Number(pendingFromGsp(b)) - Number(pendingFromGsp(a)) || Number(isOpen(b)) - Number(isOpen(a)) || b.since - a.since);
  const advanced = (st.stage ? 1 : 0) + (st.from || st.to ? 1 : 0);
  const filtered = !!(ql || st.dest || st.who || st.intake || st.progress || advanced);
  const narrowed = filtered || !!st.owner;
  const clear = () => set((p) => ({ ...p, q: '', dest: '', who: '', intake: '', progress: '', stage: '', from: '', to: '' }));
  const dests = [...new Set(apps.map(destOf))].sort();
  const intakes = [...new Set(apps.map((a) => a.intake))];
  // the advanced filters open when one is set, and stay where the agency left them
  const [advOpen, setAdvOpen] = useState(advanced > 0);
  const badRange = !!(st.from && st.to && st.from > st.to);

  // the table as it stands (its filters and order) as a CSV file, one row per application, the same columns
  const exportCsv = () => {
    const head = ['Application', 'Started', 'Student', 'Course', 'University', 'Intake', 'Destination', 'Counsellor', 'Stage', 'Who has it', 'Status'];
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = rows.map((a) => {
      const c = courseOf(a);
      const s = stu(a);
      return [a.id, isoDay(a.created), s ? fullName(s) : '', c.name, c.uni.name, a.intake, destOf(a), counsellorOf(a)?.name ?? '', STAGES[stageOf(a)], OWNER_WORD[ownerOf(a)], statusText(a)]
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
          <p className="stu__lead">Who has each application, and what’s pending on you.</p>
        </div>
        <div className="apps__acts">
          <Button variant="secondary" iconLeft={<Icon name="download" size={16} />} onClick={exportCsv} disabled={!rows.length}>
            Download
          </Button>
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={onAdd}>
            Add application
          </Button>
        </div>
      </header>

      {/* who has them */}
      <div className="atiles" role="group" aria-label="Who has it">
        {(
          [
            ['', 'All applications'],
            ['gsp', 'Pending on you'],
            ['you', 'With RP'],
            ['uni', 'With university'],
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
          {/* the primary filters: how far each application has got */}
          <div className="amiles" role="group" aria-label="How far it has got">
            {PROGRESS.map(([k, label, hint, test]) => (
              <button key={k} type="button" className="amile" title={hint} aria-pressed={st.progress === k} onClick={() => set((p) => ({ ...p, progress: p.progress === k ? '' : k }))}>
                {label} <span className="num">{apps.filter(test).length}</span>
              </button>
            ))}
          </div>
          <div className="stools__row atools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search applications</span>
              <input id="ap-q" type="search" placeholder="Student or course" value={st.q} onChange={(e) => set((p) => ({ ...p, q: e.target.value }))} />
            </label>
            <SelectInput id="ap-dest" aria-label="Destination" value={st.dest} placeholder="All destinations" allowEmpty onChange={(e) => set((p) => ({ ...p, dest: e.target.value }))}>
              {dests.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="ap-who" aria-label="Counsellor" value={st.who} placeholder="All counsellors" allowEmpty onChange={(e) => set((p) => ({ ...p, who: e.target.value }))}>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="ap-intake" aria-label="Intake" value={st.intake} placeholder="All intakes" allowEmpty onChange={(e) => set((p) => ({ ...p, intake: e.target.value }))}>
              {intakes.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </SelectInput>
            <button type="button" className={`aadv__toggle ${advanced ? 'is-set' : ''}`} aria-expanded={advOpen} aria-controls="ap-adv" onClick={() => setAdvOpen((o) => !o)}>
              <Icon name="sliders" size={18} />
              Advanced filters
              {advanced > 0 && <span className="aadv__n num">{advanced}</span>}
              <Icon name="chevronDown" size={16} className="aadv__chev" />
            </button>
          </div>
          {/* the advanced filters: a stage, and a date range for when the applications started */}
          <AnimatePresence initial={false}>
            {advOpen && (
              <motion.div
                id="ap-adv"
                className="aadv"
                role="group"
                aria-label="Advanced filters"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease }}
              >
                <div className="aadv__in">
                  <label className="aadv__field" htmlFor="ap-stage">
                    <span className="aadv__label">Stage</span>
                    <SelectInput id="ap-stage" value={st.stage} placeholder="Any stage" allowEmpty onChange={(e) => set((p) => ({ ...p, stage: e.target.value }))}>
                      {STAGES.map((s, i) => (
                        <option key={s} value={String(i)}>
                          {i + 1}. {s}
                        </option>
                      ))}
                    </SelectInput>
                  </label>
                  <div className="aadv__field aadv__dates" role="group" aria-labelledby="ap-dates-label" aria-describedby={badRange ? 'ap-dates-err' : undefined}>
                    <span className="aadv__label" id="ap-dates-label">
                      Started between
                    </span>
                    <div className="aadv__range">
                      <TextInput id="ap-from" type="date" aria-label="Start date" value={st.from} max={st.to || undefined} invalid={badRange} onChange={(e) => set((p) => ({ ...p, from: e.target.value }))} />
                      <span className="aadv__and" aria-hidden="true">
                        and
                      </span>
                      <TextInput id="ap-to" type="date" aria-label="End date" value={st.to} min={st.from || undefined} invalid={badRange} onChange={(e) => set((p) => ({ ...p, to: e.target.value }))} />
                    </div>
                    {badRange && (
                      <p className="aadv__err" id="ap-dates-err" role="alert">
                        The end date is before the start date.
                      </p>
                    )}
                  </div>
                  {advanced > 0 && (
                    <button type="button" className="btn btn--link aadv__clear" onClick={() => set((p) => ({ ...p, stage: '', from: '', to: '' }))}>
                      Clear these
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="stools__count" id="atable-count" role="status">
            <span>
              <span className="num">{narrowed ? `${rows.length} of ${apps.length}` : apps.length}</span> {apps.length === 1 ? 'application' : 'applications'}
            </span>
            {filtered && (
              <button type="button" className="btn btn--link stools__clear" onClick={clear}>
                Clear filters
              </button>
            )}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="snone">
            {filtered ? (
              <>
                <p className="snone__title">No applications match</p>
                <p className="snone__text">Try another name or ID, or clear the filters.</p>
                <Button variant="secondary" size="sm" onClick={clear}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="snone__title">{st.owner === 'gsp' ? 'Nothing pending on you' : st.owner === 'you' ? 'Nothing with an RP right now' : 'Nothing with a university right now'}</p>
                <p className="snone__text">{st.owner === 'gsp' ? 'When something is, it shows here first.' : 'Applications move here as they progress.'}</p>
              </>
            )}
          </div>
        ) : (
          <div className="stab-wrap">
            <table className="atab" role="table" aria-label="Applications">
              <thead role="rowgroup">
                <tr role="row">
                  {['Application', 'Student', 'Course', 'Intake', 'Destination', 'Counsellor', 'Stage', 'Status'].map((h) => (
                    <th key={h} role="columnheader" scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {rows.map((a, i) => {
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
                          {`Started ${shortDate(new Date(a.created))}`}
                        </span>
                      </td>
                      <td role="cell" className="arow__stu">
                        <span className="arow__name">{s ? fullName(s) : 'Student removed'}</span>
                        {/* 6 Nov (Nesil): the student's primary application, or one of the others */}
                        <span className="arow__rank">
                          <RankTag rank={rankOf(apps, a, s?.primaryApp)} />
                        </span>
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
                      <td role="cell" className="arow__dest">
                        <span className="arow__flag" aria-hidden="true">
                          {FLAG[c.uni.country]}
                        </span>
                        {c.uni.country}
                      </td>
                      <td role="cell" className="arow__who">
                        <span>{who ? who.name : '—'}</span>
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
          </div>
        )}
      </section>
    </>
  );
}

const ownerWord = (o: AppOwner) => OWNER_WORD[o];

/** No applications yet: the journey an application takes, and how to start one. */
function Empty({ hasStudents, onAdd, onFindCourses }: { hasStudents: boolean; onAdd: () => void; onFindCourses: () => void }) {
  const reduce = useReducedMotion();
  return (
    <>
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">Applications</h1>
          <p className="stu__lead">Who has each application, and what’s pending on you.</p>
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
              <strong>Amber means it’s pending on you.</strong> Every application says who has it and what happens next.
            </span>
          </li>
          <li>
            <span className="aempty__ic aempty__ic--gsp" aria-hidden="true" />
            <span>
              <strong>Violet is GSP.</strong> GSP checks the documents and submits to the university, usually the same day.
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
