import { useEffect, useRef, useState } from 'react';
import type { Application } from '../../data/applications';
import type { Member, Student } from '../../data/students';
import type { RecordTab } from '../students/StudentRecord';
import { AppList, NEW_LIST, type ListState } from './AppList';
import { AppDetail, type AppTab } from './AppDetail';
import { NewApplication, type NewSeed } from './NewApplication';
import { deskFor, type Desk } from './desk';
import '../../screens/applications/applications.css';
import '../gsp.css';

export type AppsStart = { key: string; open?: string; tab?: AppTab; add?: NewSeed | true };

/**
 * Applications: the list of every application with who has it and what's next, one application's page,
 * and the sheet that starts a new one, seen from GSP's side. GSP Assist checks eligibility before applying,
 * reads documents as they arrive and sums up the university's mail.
 */
export function Applications({
  apps,
  setApps,
  desks,
  setDesks,
  students,
  setStudents,
  team,
  me,
  agency,
  nationality,
  start,
  navKey,
  scrollTop,
  onOpenStudent,
  onFindCourses,
}: {
  apps: Application[];
  setApps: (fn: (l: Application[]) => Application[]) => void;
  /** GSP's own records for each application, kept once one is changed; the rest start from the application. */
  desks: Record<string, Desk>;
  setDesks: (fn: (d: Record<string, Desk>) => Record<string, Desk>) => void;
  students: Student[];
  setStudents: (fn: (l: Student[]) => Student[]) => void;
  team: Member[];
  me: string;
  agency: string;
  /** The agency's country, which a new student starts with. */
  nationality: string;
  start?: AppsStart;
  navKey: number;
  scrollTop: () => void;
  onOpenStudent: (id: string, tab?: RecordTab) => void;
  onFindCourses: () => void;
}) {
  const [list, setList] = useState<ListState>(NEW_LIST);
  const [openId, setOpenId] = useState<string | null>(start?.open ?? null);
  const [tab, setTab] = useState<AppTab>(start?.tab ?? 'chat');
  // the sheet stays mounted while it closes, so it can animate out; a new key starts it fresh
  const [add, setAddState] = useState<{ key: number; open: boolean; seed?: NewSeed }>(() => (start?.add ? { key: 1, open: true, seed: start.add === true ? undefined : start.add } : { key: 0, open: false }));
  const setAdd = (v: { key: number; seed?: NewSeed } | null) => setAddState((p) => (v ? { ...v, open: true } : { ...p, open: false }));
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!start) return;
    setOpenId(start.open ?? null);
    setTab(start.tab ?? 'chat');
    setAdd(start.add ? { key: Date.now(), seed: start.add === true ? undefined : start.add } : null);
  }, [start?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // the sidebar's link back to the list closes what's open; opening this page on a record (from elsewhere) doesn't
  const seenNav = useRef(navKey);
  useEffect(() => {
    if (navKey === seenNav.current) return;
    seenNav.current = navKey;
    setOpenId(null);
  }, [navKey]);

  const open = apps.find((a) => a.id === openId) ?? null;
  const openStudent = open ? students.find((s) => s.id === open.studentId)! : null;
  const desk = open && openStudent ? (desks[open.id] ?? deskFor(open, openStudent)) : null;
  const openApp = (id: string, t: AppTab = 'chat') => {
    setOpenId(id);
    setTab(t);
    scrollTop();
  };

  return (
    <div className="stu apps">
      {open ? (
        <AppDetail
          a={open}
          s={openStudent!}
          team={team}
          agency={agency}
          desk={desk!}
          setDesk={(fn) => setDesks((m) => ({ ...m, [open.id]: fn(m[open.id] ?? deskFor(open, openStudent!)) }))}
          tab={tab}
          setTab={setTab}
          update={(fn) => setApps((l) => l.map((x) => (x.id === open.id ? fn(x) : x)))}
          updateStudent={(fn) => setStudents((l) => l.map((x) => (x.id === open.studentId ? fn(x) : x)))}
          onBack={() => {
            setOpenId(null);
            scrollTop();
          }}
          onOpenStudent={onOpenStudent}
          say={setMsg}
        />
      ) : (
        <AppList apps={apps} students={students} team={team} st={list} set={setList} onOpen={openApp} onAdd={() => setAdd({ key: Date.now() })} onFindCourses={onFindCourses} say={setMsg} />
      )}

      <p className="vh" role="status" aria-live="polite">
        {msg}
      </p>

      {add.key > 0 && (
        <NewApplication
          key={add.key}
          open={add.open}
          seed={add.seed}
          students={students}
          setStudents={setStudents}
          team={team}
          nationality={nationality}
          apps={apps}
          me={me}
          onClose={() => setAdd(null)}
          onOpenStudent={(id, t) => {
            setAdd(null);
            onOpenStudent(id, t);
          }}
          onCreate={(a) => {
            setApps((l) => [a, ...l]);
            setMsg(`${a.id} started.`);
          }}
          onOpenApp={(id) => {
            setAdd(null);
            openApp(id);
          }}
        />
      )}
    </div>
  );
}
