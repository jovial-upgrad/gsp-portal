import { studentRegion } from '../../data/regions';
import { RegionBar } from '../../components/RegionBar';
import { useScope } from '../../data/scope';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pager } from '../../screens/courses/ResultParts';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectInput } from '../../components/forms';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { byRegion } from '../../data/scope';
import { HOME_RP } from '../rps';
import { MoreMenu } from '../../components/MoreMenu';
import { fullName, readiness, type Member, type Student } from '../../data/students';
import { AddStudentSheet } from './AddStudentSheet';
import { StudentRecord, type RecordTab } from './StudentRecord';
import { Avatar, CopyButton, Ring } from './parts';
import type { AddState } from './form';
import { NewApplication, type NewSeed } from '../applications/NewApplication';
import type { Application } from '../../data/applications';
import '../../screens/students/students.css';

const ease = [0.2, 0.8, 0.2, 1] as const;

type Status = '' | 'inc' | 'com';
type Apps = '' | 'none' | 'some' | 'you';
type Sort = 'recent' | 'name' | 'ready';
const SORTS: [Sort, string][] = [
  ['recent', 'Recently added'],
  ['name', 'Name, A to Z'],
  ['ready', 'Least complete first'],
];

export type StudentsStart = { key: string; add?: AddState | true; open?: string; tab?: RecordTab };

/**
 * Students: everyone the agency has added, how ready each profile is, who looks after them and their
 * applications. With no students yet, the page explains what a student record is for and how to add one.
 * "Add student" opens a short form; the rest of the profile is filled later.
 */
export function Students({
  list: listIn,
  set,
  team,
  me,
  nationality,
  start,
  navKey,
  scrollTop,
  onFindCourses,
  onOpenApp,
  onNewApp,
  appList,
  onCreateApp,
}: {
  list: Student[];
  set: (fn: (l: Student[]) => Student[]) => void;
  team: Member[];
  /** The name of the person signed in. */
  me: string;
  /** The agency's country, which new students start with. */
  nationality: string;
  start?: StudentsStart;
  /** Changes whenever Students is picked in the menu: back to the list. */
  navKey: number;
  scrollTop: () => void;
  onFindCourses: (s: Student) => void;
  onOpenApp?: (id: string) => void;
  onNewApp?: (s: Student, courseId?: string) => void;
  /** The agency's applications: starting one from a profile opens Add an application there, on the profile. */
  appList?: Application[];
  onCreateApp?: (a: Application) => void;
}) {
  const reduce = useReducedMotion();
  let list = listIn;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [who, setWho] = useState('');
  // GSP's filters (W12): by recruitment partner and by sales region
  const [rpF, setRpF] = useState('');
  const [regionF, setRegionF] = useState('');
  const [apps, setApps] = useState<Apps>('');
  const [sort, setSort] = useState<Sort>('recent');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<RecordTab>('personal');
  const [fresh, setFresh] = useState<string | null>(null);
  // Add an application, opened from a profile (Start application, or a shortlisted course): it stays on the profile
  const [newApp, setNewApp] = useState<{ key: number; seed: NewSeed } | null>(null);
  const startApp = appList && onCreateApp ? (s: Student, courseId?: string) => setNewApp({ key: Date.now(), seed: { studentId: s.id, courseId } }) : onNewApp;
  // the add form stays mounted while it closes, so it can animate out; a new key starts it fresh
  const [add, setAddState] = useState<{ key: number; open: boolean; seed?: AddState }>({ key: 0, open: false });
  const setAdd = (v: { key: number; seed?: AddState } | null) => setAddState((p) => (v ? { ...v, open: true } : { ...p, open: false }));
  const [added, setAdded] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  // a new counsellor waits for a yes: it changes who can see the student
  const [move, setMove] = useState<{ s: Student; to: string } | null>(null);

  // a review state starts the page over: with the add form open, or without
  useEffect(() => {
    if (!start) return;
    setAdd(start.add ? { key: Date.now(), seed: start.add === true ? undefined : start.add } : null);
    setOpenId(start.open ?? null);
    setTab(start.tab ?? 'personal');
    setAdded(null);
    setFresh(null);
  }, [start?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // the sidebar's link back to the list closes what's open; opening this page on a record (from elsewhere) doesn't
  const seenNav = useRef(navKey);
  useEffect(() => {
    if (navKey === seenNav.current) return;
    seenNav.current = navKey;
    setOpenId(null);
  }, [navKey]);

  const say = (m: string) => setMsg(m);
  // every RP's students (W12): each with its RP and sales region (its application's, or its RP's), cut to the person's regions
  const rpOf = (s: Student) => s.rp ?? HOME_RP;
  // a student's sales region is the RP branch's that added them (Jovial, 1 Nov, SR5)
  const regionOf = (s: Student) => studentRegion(s);
  useScope();
  const all = list;
  list = byRegion(all, regionOf);
  const rpNames = [...new Set(list.map(rpOf))].sort((x, y) => x.localeCompare(y));
  const regionNames = [...new Set(list.map(regionOf))].sort();
  const open = all.find((s) => s.id === openId) ?? null;
  const memberName = (id: string) => team.find((m) => m.id === id)?.name ?? '';
  const ready = useMemo(() => new Map(list.map((s) => [s.id, readiness(s)])), [list]);
  // how many students each counsellor has, shown when picking a new one

  const counts = { '': list.length, inc: list.filter((s) => !ready.get(s.id)!.complete).length, com: list.filter((s) => ready.get(s.id)!.complete).length };

  const ql = q.trim().toLowerCase().replace(/\s+/g, '');
  // 25 a page, numbered (S3C-14, proposal); a change of tab, search, filter or sort goes back to page 1
  const PER = 25;
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, status, sort, who, apps]);
  const rows = list
    .filter((s) => {
      const r = ready.get(s.id)!;
      if (status === 'inc' && r.complete) return false;
      if (status === 'com' && !r.complete) return false;
      if (who && s.counsellor !== who) return false;
      if (rpF && rpOf(s) !== rpF) return false;
      if (regionF && regionOf(s) !== regionF) return false;
      if (apps === 'none' && s.apps.length) return false;
      if (apps === 'some' && !s.apps.length) return false;
      if (apps === 'you' && !s.apps.some((a) => a.owner === 'you')) return false;
      if (ql && !`${fullName(s)}${s.email}${s.dial}${s.phone}${s.passport}${s.id}${rpOf(s)}`.toLowerCase().replace(/\s+/g, '').includes(ql)) return false;
      return true;
    })
    .sort((a, b) => (sort === 'name' ? fullName(a).localeCompare(fullName(b)) : sort === 'ready' ? ready.get(a.id)!.pct - ready.get(b.id)!.pct : b.added - a.added));
  // the Incomplete and Complete tabs are views, not filters: "Clear filters" leaves them as they are
  const filtered = !!(ql || who || rpF || regionF || apps);
  const narrowed = filtered || !!status;
  const clear = () => {
    setQ('');
    setWho('');
    setRpF('');
    setRegionF('');
    setApps('');
  };

  const requestAssign = (s: Student, id: string) => {
    if (id !== s.counsellor) setMove({ s, to: id });
  };
  const assign = (s: Student, id: string) => {
    set((l) => l.map((x) => (x.id === s.id ? { ...x, counsellor: id } : x)));
    say(`${fullName(s)} is now with ${memberName(id)}. They’ve been told.`);
  };
  const openStudent = (id: string, t: RecordTab = 'personal') => {
    setOpenId(id);
    setTab(t);
    scrollTop();
  };
  // a new student opens on their profile, which says what to add next
  const onAdded = (s: Student) => {
    set((l) => [s, ...l]);
    setAdd(null);
    clear();
    setStatus('');
    setSort('recent');
    setAdded(s.id);
    setFresh(s.id);
    openStudent(s.id);
    say(`${fullName(s)} added. Complete the profile next.`);
  };
  const exportCsv = () => {
    const head = ['Student ID', 'Name', 'Email', 'Phone', 'Nationality', 'Lives in', 'Recruitment partner', 'Counsellor', 'Sales region', 'Profile', 'Applications'];
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = rows.map((s) =>
      [s.id, fullName(s), s.email, s.phone ? `${s.dial} ${s.phone}` : '', s.nationality, [s.state, s.country].filter(Boolean).join(', '), rpOf(s), memberName(s.counsellor), regionOf(s), `${ready.get(s.id)!.pct}%`, s.apps.length].map(cell).join(','),
    );
    try {
      const url = URL.createObjectURL(new Blob([[head.map(cell).join(','), ...lines].join('\n')], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'students.csv';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(`${rows.length} ${rows.length === 1 ? 'student' : 'students'} exported.`);
    } catch {
      say('Export isn’t available here.');
    }
  };

  return (
    <div className="stu">
      {open ? (
        <StudentRecord
          s={open}
          list={all}
          update={(fn) => set((l) => l.map((x) => (x.id === open.id ? fn(x) : x)))}
          team={team}
          tab={tab}
          setTab={setTab}
          fresh={fresh === open.id}
          onDismissFresh={() => setFresh(null)}
          onBack={() => {
            setOpenId(null);
            setFresh(null);
            scrollTop();
          }}
          onFindCourses={onFindCourses}
          onCounsellor={requestAssign}
          onOpenApp={onOpenApp}
          onNewApp={startApp}
          say={say}
        />
      ) : (
      <>
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">Students</h1>
          <p className="stu__lead">Every RP’s students, with their profiles and applications.</p>
        </div>
        {list.length > 0 && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdd({ key: Date.now() })}>
            Add student
          </Button>
        )}
      </header>

      {list.length === 0 ? (
        <section className="card sempty" aria-labelledby="sempty-title">
          <span className="sempty__icon" aria-hidden="true">
            <Icon name="people" size={26} />
          </span>
          <h2 id="sempty-title" className="sempty__title">
            No students yet. Add your first student to start applying.
          </h2>
          <p className="sempty__text">Upload their passport in the form and we fill in the details for you to check.</p>
          <div className="sempty__acts">
            <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdd({ key: Date.now() })}>
              Add a student
            </Button>
          </div>
          <ol className="sempty__steps">
            <li>
              <span className="sempty__n">1</span>
              <span>
                <strong>Add the student.</strong> Name, email and where they live. About a minute.
              </span>
            </li>
            <li>
              <span className="sempty__n">2</span>
              <span>
                <strong>Complete the profile.</strong> Academics, English test and documents, or send the student a link to add them.
              </span>
            </li>
            <li>
              <span className="sempty__n">3</span>
              <span>
                <strong>Find courses and apply.</strong> Only courses they can be offered show, and each application reuses the profile.
              </span>
            </li>
          </ol>
        </section>
      ) : (
        <section className="card stable" aria-labelledby="stable-count">
          <RegionBar page="Students" />
          <div className="stools">
            <div className="sseg" role="group" aria-label="Profile">
              {(
                [
                  ['', 'All'],
                  ['inc', 'Incomplete'],
                  ['com', 'Complete'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" className="sseg__btn" aria-pressed={status === k} onClick={() => setStatus(k)}>
                  {status === k && <motion.span layoutId="sseg-lens" className="sseg__lens" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />}
                  <span className="sseg__label">
                    {label} <span className="sseg__n num">{counts[k]}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="stools__row">
              <label className="ssearch">
                <Icon name="search" size={18} />
                <span className="vh">Search students</span>
                <input id="st-q" type="search" placeholder="Name, email, phone or passport" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <SelectInput id="st-rp" aria-label="Recruitment partner" value={rpF} placeholder="All recruitment partners" allowEmpty onChange={(e) => setRpF(e.target.value)}>
                {rpNames.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectInput>
              <SelectInput id="st-region" aria-label="Sales region" value={regionF} placeholder="All sales regions" allowEmpty onChange={(e) => setRegionF(e.target.value)}>
                {regionNames.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectInput>
              <SelectInput id="st-apps" aria-label="Applications" value={apps} placeholder="Any applications" allowEmpty onChange={(e) => setApps(e.target.value as Apps)}>
                <option value="you">Has an application with the RP</option>
                <option value="some">Has applications</option>
                <option value="none">No application yet</option>
              </SelectInput>
              <div className="stools__end">
              <MoreMenu
                id="st-sort"
                icon="sort"
                className="mmore--tool"
                label={`Sort: ${SORTS.find(([k]) => k === sort)?.[1]}`}
                items={SORTS.map(([k, label]) => ({ id: k, label, checked: sort === k, onPick: () => setSort(k) }))}
              />
              <Button variant="secondary" iconLeft={<Icon name="download" size={16} />} onClick={exportCsv} disabled={!rows.length}>
                Export
              </Button>
              </div>
            </div>
            <p className="stools__count" id="stable-count" role="status">
              <span>
                <span className="num">{narrowed ? `${rows.length} of ${list.length}` : list.length}</span> {list.length === 1 ? 'student' : 'students'}
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
                  <p className="snone__title">No students match. Clear the search or filters.</p>
                  <Button variant="secondary" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="snone__title">{status === 'inc' ? 'Every profile is complete' : 'No complete profiles yet'}</p>
                  <p className="snone__text">{status === 'inc' ? 'These students are ready to apply with.' : 'Add academics, an English test and documents to complete a profile.'}</p>
                </>
              )}
            </div>
          ) : (
            <div className="stab-wrap">
            {/* a grid under the table roles: each column is as wide as its content and the space left over
                is shared equally between columns, so the gaps match */}
            <table className="stab stab--gsp" role="table" aria-label="Students">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col">Student</th>
                  <th role="columnheader" scope="col">Contact</th>
                  <th role="columnheader" scope="col">Recruitment partner</th>
                  <th role="columnheader" scope="col">Sales region</th>
                  <th role="columnheader" scope="col">Profile</th>
                  <th role="columnheader" scope="col">Applications</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {rows.slice((page - 1) * PER, page * PER).map((s, i) => {
                  const r = ready.get(s.id)!;
                  return (
                    <motion.tr
                      key={s.id}
                      role="row"
                      className={`srow ${s.id === added ? 'is-new' : ''}`}
                      onClick={() => openStudent(s.id)}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, ease, delay: Math.min(i, 8) * 0.025 }}
                    >
                      <td role="cell" className="srow__who">
                        <div className="srow__whoin">
                        <Avatar s={s} />
                        <span className="srow__names">
                          <button type="button" className="srow__open" onClick={(e) => (e.stopPropagation(), openStudent(s.id))}>
                            {fullName(s)}
                          </button>
                          <span className="srow__sub">{[s.state, s.country].filter(Boolean).join(', ')}</span>
                        </span>
                        </div>
                      </td>
                      <td role="cell" className="srow__contact" data-label="Contact">
                        <span className="srow__line">
                          <span className="srow__val" title={s.email}>
                            {s.email}
                          </span>
                          <CopyButton text={s.email} what="Email" onDone={say} />
                        </span>
                        <span className="srow__line">
                          {s.phone ? (
                            <>
                              <span className="srow__val" title={`${s.dial} ${s.phone}`}>
                                {s.dial} {s.phone}
                              </span>
                              <CopyButton text={`${s.dial} ${s.phone}`} what="Phone number" onDone={say} />
                            </>
                          ) : (
                            <span className="muted">No phone</span>
                          )}
                        </span>
                      </td>
                      {/* GSP sees whose student it is; the RP's counsellor is the RP's to change (W12) */}
                      <td role="cell" className="srow__counsellor" data-label="Recruitment partner">
                        <span className="srow__names">
                          <span>{rpOf(s)}</span>
                          {memberName(s.counsellor) && <span className="srow__sub">{memberName(s.counsellor)}</span>}
                        </span>
                      </td>
                      <td role="cell" className="srow__region" data-label="Sales region">
                        {regionOf(s)}
                      </td>
                      <td role="cell" className="srow__profile" data-label="Profile">
                        <span className="sprof" title={r.complete ? 'Complete' : `To add: ${r.sections.flatMap((x) => x.missing).join(', ')}`}>
                          <Ring pct={r.pct} />
                          <span className="sprof__t">
                            <span className="sprof__main">{r.complete ? 'Complete' : `${r.pct}%`}</span>
                            {!r.complete && <span className="sprof__sub">{r.toAdd} to add</span>}
                          </span>
                        </span>
                      </td>
                      <td role="cell" className="srow__apps" data-label="Applications">
                        <span className={`sapps-n num ${s.apps.length ? '' : 'is-zero'}`}>
                          {s.apps.length}
                          <span className="sapps-l"> {s.apps.length === 1 ? 'application' : 'applications'}</span>
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
      )}

      </>
      )}

      <p className="vh" role="status" aria-live="polite">
        {msg}
      </p>

      {newApp && appList && onCreateApp && (
        <NewApplication
          key={newApp.key}
          open
          seed={newApp.seed}
          students={list}
          setStudents={set}
          team={team}
          nationality={nationality}
          apps={appList}
          me={me}
          onClose={() => setNewApp(null)}
          onOpenStudent={(id, t) => {
            setNewApp(null);
            openStudent(id, t);
          }}
          onCreate={(a) => {
            onCreateApp(a);
            say(`${a.id} started.`);
          }}
          onOpenApp={(id) => {
            setNewApp(null);
            onOpenApp?.(id);
          }}
        />
      )}

      {add.key > 0 && (
        <AddStudentSheet
          key={add.key}
          open={add.open}
          onClose={() => setAdd(null)}
          list={list}
          team={team}
          me={me}
          nationality={nationality}
          seed={add.seed}
          onAdded={onAdded}
          onOpenStudent={(s) => {
            setAdd(null);
            openStudent(s.id);
          }}
        />
      )}
      <MoveDialog
        move={move}
        team={team}
        onCancel={() => setMove(null)}
        onConfirm={() => {
          if (move) assign(move.s, move.to);
          setMove(null);
        }}
      />
    </div>
  );
}

/** Changing the counsellor changes who sees the student, so it says what will happen and asks first. */
function MoveDialog({ move, team, onCancel, onConfirm }: { move: { s: Student; to: string } | null; team: Member[]; onCancel: () => void; onConfirm: () => void }) {
  // keeps the words while the dialog fades out
  const last = useRef(move);
  if (move) last.current = move;
  const s = last.current?.s;
  const from = team.find((m) => m.id === s?.counsellor);
  const to = team.find((m) => m.id === last.current?.to);
  const first = (m?: Member) => (m?.id === 'me' ? 'you' : m?.name.split(' ')[0] ?? '');
  const toMe = to?.id === 'me';
  const n = s?.apps.length ?? 0;
  // the counsellors this changes for are told; the admin making the change isn't
  const told = [from, to].filter((m): m is Member => !!m && m.id !== 'me').map((m) => m.name.split(' ')[0]);
  return (
    <ConfirmDialog
      open={!!move}
      title={s && to ? (toMe ? `Look after ${fullName(s)} yourself?` : `Move ${fullName(s)} to ${to.name}?`) : ''}
      confirm={toMe ? `Move to me` : `Move to ${first(to)}`}
      cancel={from?.id === 'me' ? 'Keep with me' : `Keep with ${first(from)}`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {s && to && (
        <>
          <p>
            {toMe ? 'You’ll' : <strong>{to.name}</strong>}
            {toMe ? '' : ' will'} see {s.first}’s profile{n ? ` and ${n === 1 ? 'application' : `${n} applications`}` : ''}, and get {s.first}’s updates.
          </p>
          {from && from.id !== 'me' ? (
            <p>
              <strong>{from.name}</strong> won’t see {s.first} any more.
            </p>
          ) : (
            <p>As the admin, you’ll still see every student.</p>
          )}
          {told.length > 0 && <p>We’ll let {told.join(' and ')} know.</p>}
        </>
      )}
    </ConfirmDialog>
  );
}
