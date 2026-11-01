import { RP_OWNER_TAG as OWNER_TAG } from '../../data/owners';
import { withdrawReasons } from '../../data/reasons';
import { UPLOAD } from '../../data/uploads';
import { setLiveStatus, setLiveFlags, useLiveAll, finalFeeOf } from '../../data/live';
import { NameDialog } from '../../gsp/applications/NameDialog';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AppCommission } from '../../finance/AppCommission';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreMenu } from '../../components/MoreMenu';
import { FLAG, money } from '../../data/courses';
import { shortDate } from '../../data/dates';
import { eduDocName, fullName, readiness, TESTS, type Member, type Student } from '../../data/students';
import {
  NEXT_AFTER_YOU,
  STAGES,
  STATUS,
  clock,
  courseOf,
  earnFor,
  gspContact,
  arriveAt,
  docLines,
  isOpen,
  keptOnProfile,
  ownerOf,
  named,
  profileKeyFor,
  readFile,
  stageOf,
  statusText,
  type AppDoc,
  type AppFile,
  type Cond,
  type Application,
  type AppOwner,
  type EndKind,
  type Need,
} from '../../data/applications';
import { campusLabel, duration, UniMark } from '../courses/parts';
import { Avatar, CopyButton } from '../students/parts';
import { DocButtons } from '../../components/DocView';
import { Celebrate } from '../../components/Celebrate';
import { CondForm } from './CondForm';
import { CondCard, CondDialog, condViews } from './Conditions';
import { readMs } from '../students/ReadBox';
import type { RecordTab } from '../students/StudentRecord';
import { AssistMark, StageTrack, Thinking } from './parts';
import { Assist } from './Assist';

export type AppTab = 'chat' | 'documents' | 'commission' | 'activity';
const TABS: [AppTab, string, IconName][] = [
  ['chat', 'Chat', 'chat'],
  ['documents', 'Documents', 'folder'],
  ['commission', 'Commission', 'wallet'],
  ['activity', 'Activity', 'clock'],
];
/** The one tag in the header's corner: who has the application now, never two at once. */
/** A due date with its year: "31 Oct 26". */
const dueDate = (t: number) => `${shortDate(new Date(t))} ${String(new Date(t).getFullYear()).slice(2)}`;
const HEAD_TAG: Record<AppOwner, string> = OWNER_TAG;
const ease = [0.2, 0.8, 0.2, 1] as const;

/** A need is met when its file reads as the right document, a profile detail is filled, or a payment is confirmed. */
export function needMet(n: Need, s: Student) {
  if (n.profile === 'education') return readiness(s).sections.find((x) => x.key === 'education')!.missing.length === 0;
  if (n.profile === 'personal') return readiness(s).sections.find((x) => x.key === 'personal')!.missing.length === 0;
  if (n.profile === 'tests') return s.tests.some((t) => TESTS[t.type].kind === 'English' && !!t.overall);
  if (n.action) return n.check === 'ok';
  return !!n.file && n.check !== 'reading';
}

/**
 * One application, led by the student: the course and university under their name, the status in the corner
 * with the one party who has it, the stage path, the one thing to do now, and everything else in tabs that
 * never move (Chat, Documents, Activity) beside the key details and the GSP contact. GSP Assist reads uploads
 * before GSP does. The documents the application asks for were set when it was added; anything needed later is
 * a document GSP asks for in the chat, which shows in Documents too.
 */
export function AppDetail({
  a,
  s,
  team,
  me,
  tab,
  setTab,
  update,
  updateStudent,
  onBack,
  onOpenStudent,
  say,
}: {
  a: Application;
  s: Student;
  team: Member[];
  me: string;
  tab: AppTab;
  setTab: (t: AppTab) => void;
  update: (fn: (a: Application) => Application) => void;
  updateStudent: (fn: (s: Student) => Student) => void;
  onBack: () => void;
  onOpenStudent: (id: string, tab?: RecordTab) => void;
  say: (m: string) => void;
}) {
  const reduce = useReducedMotion();
  const c = courseOf(a);
  const d = c.uni.country;
  const o = ownerOf(a);
  const gsp = gspContact(a);
  const counsellor = team.find((m) => m.id === s.counsellor);
  useLiveAll(); // the final tuition fee prices the base commission
  const earn = earnFor(a);
  const [withdraw, setWithdraw] = useState(false);
  const needsRef = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  // what's pending on the agency: documents to upload, GSP's requests and the offer's conditions (details for the
  // student's profile aren't listed here: the profile and the eligibility check ask for them)
  const todo = a.needs.filter((n) => !n.profile);
  const open = todo.filter((n) => !needMet(n, s));
  const pending = a.needs.filter((n) => !n.profile && !n.action && !needMet(n, s));
  const reached = stageDates(a);

  // opening the chat reads its new messages
  useEffect(() => {
    if (tab === 'chat' && a.unread) update((x) => ({ ...x, unread: 0 }));
  }, [tab, a.unread]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNeeds = () => {
    setTab('documents');
    window.setTimeout(() => needsRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 60);
  };

  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    setTab(TABS[n][0]);
    document.getElementById(`atab-${TABS[n][0]}`)?.focus();
  };

  /* ---------- acting on the application ---------- */

  // a document GSP asked for goes to GSP as soon as it's in: off the needs, into the application's documents.
  // The status stays where it is; once everything asked for is in, it's with GSP, who moves it on
  const fulfil = (n: Need, file: string, note?: string) => {
    const now = Date.now();
    update((x) => ({
      ...x,
      needs: x.needs.filter((y) => y.id !== n.id),
      files: [...x.files, { name: n.title, file, from: 'you', at: now, status: 'checking', via: 'request', req: n.id }],
      history: [...x.history, { at: now, who: 'you', text: `Uploaded the ${named(n.title)} GSP asked for`, by: me }, ...(note ? [{ at: now, who: 'ai' as const, text: `GSP Assist read it first: ${note}` }] : [])],
    }));
    setLiveFlags(a.id, { rpNews: now, rpWhat: `the ${named(n.title)}` });
    // no made-up reply from GSP (HC26): Activity has the upload, and GSP answers in the chat themselves
    say(`${n.title} sent to ${n.request?.by ?? 'GSP'}.`);
  };

  // an offer's conditions, answered in the form and sent to GSP together
  const [answering, setAnswering] = useState<Need | null>(null);
  const sendConds = (n: Need, items: Cond[]) => {
    const now = Date.now();
    const by = n.request?.by ?? gsp.name;
    update((x) => ({
      ...x,
      needs: x.needs.filter((y) => y.id !== n.id),
      conds: [...(x.conds ?? []), { id: n.id, title: n.title, by, at: n.request?.at ?? now, sent: now, items }],
      history: [...x.history, { at: now, who: 'you', text: `Answered the ${named(n.title)} and sent them to GSP`, by: me }],
    }));
    setAnswering(null);
    setLiveFlags(a.id, { rpNews: now, rpWhat: `the ${named(n.title)}` });
    say(`${n.title} sent to ${by}.`);
  };

  // GSP Assist reads a file for a need; a request goes on to GSP as soon as it reads as right
  const takeFile = (n: Need, file: string) => {
    update((x) => ({ ...x, needs: x.needs.map((y) => (y.id === n.id ? { ...y, file, check: 'reading', note: undefined } : y)) }));
    say(`Reading ${file}…`);
    timers.current.push(
      window.setTimeout(() => {
        const r = readFile(file, n.title, s);
        if (r.ok && n.request) return fulfil(n, file, r.note);
        update((x) => ({ ...x, needs: x.needs.map((y) => (y.id === n.id ? { ...y, check: r.ok ? 'ok' : 'flag', note: r.note } : y)) }));
        say(r.ok ? `${n.title}: looks right. ${r.note}` : `${n.title}: ${r.note}`);
      }, readMs(reduce)),
    );
  };
  const onFile = (n: Need, f: File | null) => f && takeFile(n, f.name);
  const keepAnyway = (n: Need) => {
    if (n.request && n.file) return fulfil(n, n.file);
    update((x) => ({ ...x, needs: x.needs.map((y) => (y.id === n.id ? { ...y, check: 'ok', note: 'Kept as uploaded. GSP checks it next.' } : y)) }));
  };
  const removeFile = (n: Need) => update((x) => ({ ...x, needs: x.needs.map((y) => (y.id === n.id ? { ...y, file: undefined, check: undefined, note: undefined } : y)) }));
  const confirmAction = (n: Need) => update((x) => ({ ...x, needs: x.needs.map((y) => (y.id === n.id ? { ...y, check: 'ok', note: `Marked as done ${shortDate(new Date())}` } : y)) }));

  /** One of the application's own documents that isn't a need yet: kept on the application (and the profile, for the profile's documents), for GSP to check. */
  const addDoc = (m: AppDoc, f: File | null) => {
    if (!f) return;
    const r = readFile(f.name, m.name, s);
    const now = Date.now();
    update((x) => ({
      ...x,
      files: [...x.files.filter((y) => y.name !== m.name), { name: m.name, file: f.name, from: 'you', at: now, status: 'uploaded' }],
      history: [...x.history, { at: now, who: 'you', text: `Uploaded the ${m.name}`, by: me }],
    }));
    if (keptOnProfile(m.key)) updateStudent((p) => ({ ...p, docs: { ...p.docs, [m.key]: { name: m.level ? eduDocName(m.level) : m.name, file: f.name, status: 'uploaded' } } }));
    say(r.ok ? `${m.name} uploaded. GSP checks it next.` : `${m.name} uploaded. ${r.note}`);
  };

  const send = () => {
    const next = NEXT_AFTER_YOU[a.status];
    if (!next) return;
    const now = Date.now();
    const sent = a.needs.filter((n) => !n.request && n.file);
    for (const n of sent) {
      if (n.id === 'passport' || n.id.startsWith('edu-') || n.id.startsWith('test-') || profileKeyFor(n.title))
        updateStudent((p) => ({ ...p, docs: { ...p.docs, [profileKeyFor(n.title) ?? n.id]: { name: n.title, file: n.file!, status: 'checking' } } }));
    }
    update((x) => {
      // requests stay until they're answered; the status's own needs are done, and GSP asks for what the next one needs
      const y = arriveAt(x, next, now);
      return {
        ...y,
        status: next,
        since: now,
        files: [...x.files, ...sent.map((n) => ({ name: n.title, file: n.file!, from: 'you' as const, at: now, status: 'checking' as const }))],
        history: [
          ...y.history,
          { at: now, who: 'you', text: sent.length ? `Sent ${sent.length === 1 ? `the ${named(sent[0].title)}` : `${sent.length} documents`} to GSP` : 'Sent to GSP', by: me },
          ...(sent.length ? [{ at: now, who: 'ai' as const, text: 'GSP Assist checked the files first: right documents, names match' }] : []),
          { at: now, who: 'system', text: STATUS[next].text(d) },
        ],
      };
    });
    // New to Pre-screening: the one move the RP makes, seen by every module (Jovial, 1 Nov)
    setLiveStatus(a.id, { status: next, at: now, by: me, note: STATUS[next].text(d), via: 'rp' });
    say(`Sent. ${STATUS[next].text(d)}.`);
  };

  const chase = () => {
    const now = Date.now();
    update((x) => ({
      ...x,
      chased: now,
      // Activity keeps the request; GSP's own reply comes from GSP (HC26: no automatic answer)
      history: [...x.history, { at: now, who: 'you', text: `Asked GSP to chase ${c.uni.name}`, by: me }],
    }));
    setLiveFlags(a.id, { rpNews: now, rpWhat: `a request to chase ${c.uni.name}` });
    say(`Asked ${gsp.first} to chase ${c.uni.name}.`);
  };

  // the visa is lodged by the agency or by GSP: asking GSP hands the step over
  const gspLodges = () => {
    const now = Date.now();
    update((x) => ({
      ...x,
      visaBy: 'gsp',
      needs: x.needs.filter((n) => n.id !== 'visa'),
      history: [...x.history, { at: now, who: 'you', text: 'Asked GSP to lodge the visa', by: me }],
    }));
    setLiveFlags(a.id, { visaBy: 'gsp', rpNews: now, rpWhat: 'a request for GSP to lodge the visa' });
    say(`GSP will lodge ${s.first}’s visa.`);
  };

  const close = (kind: EndKind, reason: string) => {
    const now = Date.now();
    update((x) => ({ ...x, status: 'closed', since: now, needs: [], end: { kind, reason, stage: stageOf(x), at: now }, history: [...x.history, { at: now, who: 'you', text: `${kind}: ${reason}`, by: me }] }));
    say(`${a.id} withdrawn.`);
  };

  // the offer's facts sit in Key details until the deposit is paid; its conditions are needs, in Documents
  const offer = a.offer && isOpen(a) && stageOf(a) <= 5 ? a.offer : undefined;
  const acceptLeft = offer ? Math.max(0, Math.ceil((offer.acceptBy - Date.now()) / 86_400_000)) : 0;
  const chaseable = isOpen(a) && STATUS[a.status].owner === 'uni' && clock(a).late && !a.chased;
  // older applications may still carry profile details as to-dos: they don't show, and don't hold Send to GSP
  const sendable = isOpen(a) && !!NEXT_AFTER_YOU[a.status] && a.needs.some((n) => !n.request);
  // the visa: the agency lodges it and uploads the proof GSP asked for, or hands it to GSP
  const handOver = isOpen(a) && a.status === 'visa' && a.visaBy !== 'gsp' && !!a.needs.find((n) => n.id === 'visa' && !n.file);
  const blocked = todo.filter((n) => !n.request && (!needMet(n, s) || n.check === 'flag'));
  const needRow = (n: Need) => (
    <NeedRow
      key={n.id}
      n={n}
      s={s}
      met={needMet(n, s)}
      onFile={(f) => onFile(n, f)}
      onRemove={() => removeFile(n)}
      onKeep={() => keepAnyway(n)}
      onAction={() => confirmAction(n)}
      onForm={() => setAnswering(n)}
    />
  );

  return (
    <div className="record aapp">
      <button type="button" className="rback" onClick={onBack}>
        <Icon name="arrowLeft" size={18} />
        Applications
      </button>

      <header className="card ahead">
        <div className="ahead__top">
          <Avatar s={s} big />
          <div className="ahead__names">
            <h1 className="ahead__title">
              <button type="button" className="ahead__stu" onClick={() => onOpenStudent(s.id)} title={`Open ${s.first}’s profile`}>
                {fullName(s)}
              </button>
            </h1>
            <p className="ahead__course">
              <UniMark u={c.uni} />
              <span>
                <span className="ahead__cname">{c.name}</span>
                <span className="ahead__dot" aria-hidden="true">
                  {' '}
                  ·{' '}
                </span>
                {c.uni.name}
              </span>
            </p>
            <p className="ahead__meta">
              <Icon name="pin" size={16} />
              {campusLabel(c.campus)} · <span className="ahead__dest"><span aria-hidden="true">{FLAG[d]}</span> {d}</span> · {a.intake} intake
            </p>
          </div>
          <div className="ahead__side">
            <div className="ahead__status">
              <span className="ahead__k">Status</span>
              <span className="ahead__st">{statusText(a)}</span>
              <span className={`who who--${o === 'done' ? 'ok' : o}`}>{HEAD_TAG[o]}</span>
            </div>
            <MoreMenu
              id="app-more"
              label="More for this application"
              word="More"
              items={[
                { id: 'student', label: 'Student profile', icon: 'user', onPick: () => onOpenStudent(s.id) },
                ...(chaseable ? [{ id: 'chase', label: `Ask GSP to chase ${c.uni.name}`, icon: 'refresh' as IconName, onPick: chase }] : []),
                ...(isOpen(a) ? [{ id: 'withdraw', label: 'Withdraw application', icon: 'close' as IconName, danger: true, onPick: () => setWithdraw(true) }] : []),
              ]}
            />
          </div>
        </div>
        <StageTrack stage={stageOf(a)} owner={o} dates={reached} who={false} />
      </header>

      {/* the one thing to do now */}
      <AnimatePresence initial={false}>
        {open.length > 0 && isOpen(a) && (
          <motion.section
            key="needs"
            className="aneed"
            aria-label="Pending on you"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease }}
          >
            <span className="aneed__mark" aria-hidden="true">
              <Icon name="alert" size={20} />
            </span>
            <div className="aneed__t">
              <p className="aneed__title">
                Pending on you: {open.length === 1 ? '1 thing to do' : `${open.length} things to do`}
                {open.some((n) => n.due) && <span className="aneed__due"> · due {dueDate(Math.min(...open.filter((n) => n.due).map((n) => n.due!)))}</span>}
              </p>
              <p className="aneed__text">{open.map((n) => n.title).join(' · ')}</p>
            </div>
            <Button onClick={() => (open.length === 1 && open[0].form ? setAnswering(open[0]) : goNeeds())} iconRight={<Icon name="arrowRight" size={18} />}>
              {open.every((n) => n.form) ? 'Answer the conditions' : open.length === 1 ? 'Upload it' : 'Upload them'}
            </Button>
          </motion.section>
        )}
        {a.status === 'enrolled' && <Celebrate key="enrolled" title={`${s.first} is enrolled`} text={`${fullName(s)} is enrolled at ${c.uni.name} for the ${c.name}, ${a.intake} intake.`} />}
        {a.status === 'closed' && a.end && (
          <motion.section
            key="closed"
            className="aneed aneed--calm"
            aria-label={a.end.kind}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease }}
          >
            <span className="aneed__mark" aria-hidden="true">
              <Icon name="close" size={20} />
            </span>
            <div className="aneed__t">
              <p className="aneed__title">{a.end.kind}</p>
              <p className="aneed__text">
                {a.end.reason ? `${a.end.reason}. ` : ''}Closed at {STAGES[a.end.stage]} on {shortDate(new Date(a.end.at))}. The documents stay on {s.first}’s profile for other applications.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="atabs" role="tablist" aria-label="Application" onKeyDown={onTabKey}>
        {TABS.map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`atab-${k}`}
            aria-selected={tab === k}
            aria-controls="apanel"
            tabIndex={tab === k ? 0 : -1}
            className="atabs__tab"
            onClick={() => setTab(k)}
          >
            {tab === k && <motion.span layoutId="atabs-lens" className="atabs__lens" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />}
            <span className="atabs__in">
              <Icon name={icon} size={18} />
              {label}
              {k === 'chat' && !!a.unread && <span className="atabs__badge num">{a.unread}</span>}
              {k === 'documents' && pending.length > 0 && (
                <span className="atabs__badge atabs__badge--you num" title={`${pending.length} to upload`}>
                  {pending.length}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="abody">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            id="apanel"
            role="tabpanel"
            aria-labelledby={`atab-${tab}`}
            className={`apanel apanel--${tab}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease }}
          >
            {tab === 'chat' && (
              <Assist a={a} s={s} me={me} update={update} onNeedFile={(n, file) => takeFile(n, file)} onForm={setAnswering} say={say} />
            )}
            {tab === 'documents' && (
              <DocsTab
                a={a}
                s={s}
                open={isOpen(a) ? todo : []}
                needRow={needRow}
                pendRef={needsRef}
                onDoc={addDoc}
                onForm={setAnswering}
                onExtra={(name, file) => {
                  const now = Date.now();
                  update((x) => ({ ...x, files: [...x.files, { name, file, from: 'you', at: now, status: 'checking' }], history: [...x.history, { at: now, who: 'you', text: `Uploaded “${name}”`, by: me }] }));
                  setLiveFlags(a.id, { rpNews: now, rpWhat: `“${name}”` });
                  say(`${name} sent to GSP to check.`);
                }}
                sendBar={
                  (sendable || handOver) && (
                    <div className="aneeds__send">
                      <p className="aneeds__note">
                        {!sendable
                          ? `Lodge ${s.first}’s visa and upload the proof, or ask GSP to lodge it.`
                          : blocked.length
                            ? `To send: ${blocked.map((n) => (n.check === 'flag' ? `check the ${named(n.title)}` : named(n.title))).join(', ')}.`
                            : `Everything’s in. GSP picks it up next${a.status === 'conditions' ? ' and sends it to the university' : ''}.`}
                      </p>
                      <span className="aneeds__btns">
                        {handOver && (
                          <Button variant="secondary" onClick={gspLodges}>
                            Ask GSP to lodge it
                          </Button>
                        )}
                        {sendable && (
                          <Button onClick={send} disabled={blocked.length > 0} iconRight={<Icon name="arrowRight" size={18} />}>
                            Send to GSP
                          </Button>
                        )}
                      </span>
                    </div>
                  )
                }
              />
            )}
            {tab === 'commission' && <AppCommission a={a} agency={''} side="rp" />}
            {tab === 'activity' && <Activity a={a} />}
          </motion.div>
        </AnimatePresence>

        <aside className="abody__side" aria-label="About this application">
          <section className="card acard aperson">
            <h2 className="acard__title">Your GSP contact</h2>
            <div className="aperson__who">
              <span className="savatar aperson__av" aria-hidden="true">
                {gsp.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')}
              </span>
              <span>
                <span className="aperson__name">{gsp.name}</span>
                <span className="aperson__role">{gsp.role}</span>
              </span>
            </div>
            <dl className="aperson__ways">
              {gsp.phone && (
                <div className="aperson__line">
                  <dt>
                    <Icon name="phone" size={16} />
                    <span className="vh">Phone</span>
                  </dt>
                  <dd>
                    <span>{gsp.phone}</span>
                    <CopyButton text={gsp.phone} what={`${gsp.first}’s number`} onDone={say} />
                  </dd>
                </div>
              )}
              <div className="aperson__line">
                <dt>
                  <Icon name="mail" size={16} />
                  <span className="vh">Email</span>
                </dt>
                <dd>
                  <a className="aperson__mail" href={`mailto:${gsp.email}`}>
                    {gsp.email}
                  </a>
                  <CopyButton text={gsp.email} what={`${gsp.first}’s email`} onDone={say} />
                </dd>
              </div>
            </dl>
          </section>
          <section className="card acard">
            <h2 className="acard__title">Key details</h2>
            <dl className="cdl">
              <Row k="Application" v={<span className="num">{a.id}</span>} />
              {a.uniRef && <Row k="University reference" v={<span className="num">{a.uniRef}</span>} />}
              <Row k="Intake" v={a.intake} />
              <Row k="Duration" v={duration(c.months)} />
              <Row k="Final tuition fee" v={<span className="num">{money(finalFeeOf(a.id, c.tuition), c.currency)}</span>} />
              {offer && (
                <>
                  <Row k="Offer" v={`${offer.kind === 'conditional' ? 'Conditional' : 'Unconditional'}, ${shortDate(new Date(offer.at))}`} />
                  <Row
                    k="Accept by"
                    v={
                      <span>
                        {shortDate(new Date(offer.acceptBy))} <span className="cdl__soft num">· {acceptLeft === 1 ? '1 day left' : `${acceptLeft} days left`}</span>
                      </span>
                    }
                  />
                  <Row k="Deposit" v={<span className="num">{money(offer.deposit, c.currency)}</span>} />
                </>
              )}
              <Row
                k="Counsellor"
                v={
                  <span>
                    {counsellor?.name}
                    {counsellor?.id === 'me' ? <span className="cdl__soft"> (you)</span> : ''}
                  </span>
                }
              />
              <Row k="Base commission" v={<span className="num">{earn.text}</span>} />
              <Row k="Applied" v={shortDate(new Date(a.created), true)} />
            </dl>
          </section>
        </aside>
      </div>

      <WithdrawDialog open={withdraw} a={a} s={s} onCancel={() => setWithdraw(false)} onConfirm={(r) => (setWithdraw(false), close('Student withdrawn', r))} />
      <CondForm n={answering} s={s} onClose={() => setAnswering(null)} onSend={sendConds} />
    </div>
  );
}

/** When each stage was reached, from the activity: submitted, offer, deposit, acceptance document and so on. */
function stageDates(a: Application): (number | undefined)[] {
  const at = (re: RegExp) => a.history.find((e) => re.test(e.text))?.at;
  return [a.created, at(/checked the documents|Sent to GSP/i), at(/^Submitted to/i), at(/conditional offer/i), at(/Verified the financial|unconditional offer/i), at(/Deposit/i), at(/uploaded the (CoE|CAS|I-20|LOA)|Visa/i), undefined];
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="cdl__row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

/* ---------- what to upload ---------- */

function NeedRow({
  n,
  s,
  met,
  onFile,
  onRemove,
  onKeep,
  onAction,
  onForm,
}: {
  n: Need;
  s: Student;
  met: boolean;
  onFile: (f: File | null) => void;
  onRemove: () => void;
  onKeep: () => void;
  onAction: () => void;
  /** An offer's conditions: the form opens. */
  onForm: () => void;
}) {
  const id = `need-${n.id}`;
  const state = n.profile || n.action ? (met ? 'ok' : 'todo') : n.check === 'reading' ? 'reading' : n.check === 'flag' ? 'flag' : n.check === 'ok' ? 'ok' : 'todo';
  return (
    <li className={`nrow nrow--${state} ${state === 'todo' ? 'nrow--hl' : ''}`}>
      <span className="nrow__mark" aria-hidden="true">
        {state === 'ok' ? <Icon name="check" size={16} strokeWidth={2.4} /> : state === 'flag' ? <Icon name="alert" size={16} /> : state === 'reading' ? <AssistMark size={16} motion="busy" /> : <Icon name={n.profile ? 'edit' : n.action ? 'wallet' : 'upload'} size={16} />}
      </span>
      <div className="nrow__t">
        <p className="nrow__title">
          {n.title}
        </p>
        <p className="nrow__why">{n.why}</p>
        {(n.source || n.due) && (
          <p className="nrow__meta">
            {n.source && (
              <span className="nrow__cite">
                <Icon name="doc" size={14} />
                {n.source}
              </span>
            )}
            {n.due && <span className="nrow__due">Due {dueDate(n.due)}</span>}
          </p>
        )}
        {n.file && (
          <div className={`nrow__file nrow__file--${state}`}>
            <span className="nrow__fname">
              <Icon name="file" size={16} />
              {n.file}
              <DocButtons d={{ name: n.title, file: n.file }} s={s} />
            </span>
            {state === 'reading' ? (
              <Thinking text="GSP Assist is reading it…" />
            ) : (
              n.note && (
                <p className="nrow__note">
                  <span className="alabel alabel--sm">
                    <AssistMark size={14} /> {state === 'flag' ? 'Check this' : 'Read by GSP Assist'}
                  </span>{' '}
                  {n.note}
                </p>
              )
            )}
          </div>
        )}
        {n.action && n.note && <p className="nrow__note">{n.note}</p>}
      </div>
      <div className="nrow__acts">
        {n.form ? (
          <Button size="sm" onClick={onForm} iconRight={<Icon name="arrowRight" size={16} />}>
            Answer them
          </Button>
        ) : n.action ? (
          met ? (
            <span className="nrow__done">Done</span>
          ) : (
            <Button size="sm" onClick={onAction}>
              {n.action}
            </Button>
          )
        ) : state === 'reading' ? null : n.file ? (
          <>
            {state === 'flag' && (
              <Button variant="ghost" size="sm" onClick={onKeep}>
                Keep it
              </Button>
            )}
            <label className="btn btn--secondary btn--sm nrow__pick" htmlFor={id}>
              Replace
            </label>
            <button type="button" className="scopy" aria-label={`Remove ${n.file}`} onClick={onRemove}>
              <Icon name="close" size={16} />
            </button>
          </>
        ) : (
          <label className="btn btn--primary btn--sm nrow__pick" htmlFor={id}>
            <Icon name="upload" size={16} /> Upload
          </label>
        )}
        {!n.profile && !n.action && !n.form && (
          <input
            id={id}
            className="vh"
            type="file"
            accept={UPLOAD.accept}
            aria-label={`Upload ${n.title}`}
            onChange={(e) => {
              onFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        )}
      </div>
    </li>
  );
}

/* ---------- documents ---------- */

type DocState = 'pending' | 'rejected' | 'review' | 'approved';
type DocTab = 'all' | 'pending' | 'review' | 'approved' | 'conditions';
/** A document on the application: one it asked for when it was added, or one GSP requested since. */
type DocRow = { key: string; name: string; state: DocState; note: string; file?: string; need?: Need; doc?: AppDoc };
const DOC_TABS: [DocTab, string][] = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['review', 'In review'],
  ['approved', 'Approved'],
  ['conditions', 'Conditions'],
];
const inTab = (t: DocTab, st: DocState) => t === 'all' || (t === 'pending' ? st === 'pending' || st === 'rejected' : st === t);
const DOC_PILL: Record<DocState, [string, string]> = {
  pending: ['Pending', 'dpill--missing'],
  rejected: ['Rejected', 'dpill--bad'],
  review: ['In review', 'dpill--checking'],
  approved: ['Approved', 'dpill--verified'],
};
const fromStatus = (st?: AppFile['status']): DocState => (st === 'verified' ? 'approved' : 'review');

/**
 * Only what the application asks for: the documents set when it was added (the course's list, read for the
 * student), then whatever GSP requested since. Each one's state comes from what's asked for now, the
 * application's files and the student's profile: pending (to upload), rejected (GSP sent it back, with the
 * reason), in review (with GSP) or approved (verified by GSP). An optional one that wasn't added isn't listed.
 */
function docRows(a: Application, s: Student): DocRow[] {
  const lines = docLines(a, s);
  const rows: DocRow[] = [];
  for (const l of lines) {
    const need = a.needs.find((n) => n.id === l.key || n.title === l.name);
    if (need) {
      if (need.file) rows.push({ key: l.key, name: l.name, doc: l, need, file: need.file, state: need.check === 'flag' ? 'pending' : 'review', note: need.check === 'flag' ? need.note ?? 'Check this file' : `${need.file} · uploaded` });
      else rows.push({ key: l.key, name: l.name, doc: l, need, file: l.file, state: l.file || need.source?.startsWith('GSP') ? 'rejected' : 'pending', note: need.why });
    } else if (l.file) rows.push({ key: l.key, name: l.name, doc: l, file: l.file, state: fromStatus(l.status), note: `${l.file} · ${l.from === 'application' && l.via !== 'profile' ? 'this application' : `from ${s.first}’s profile`}` });
    else if (l.need === 'required') rows.push({ key: l.key, name: l.name, doc: l, state: 'pending', note: l.what });
  }
  // what GSP asked for: still to upload, or uploaded for the request
  for (const n of a.needs.filter((x) => x.request && !lines.some((l) => l.key === x.id))) {
    const asked = `Requested by ${n.request!.by} · ${shortDate(new Date(n.request!.at))}`;
    rows.push({ key: n.id, name: n.title, need: n, file: n.file, state: n.file ? (n.check === 'flag' ? 'pending' : 'review') : 'pending', note: n.file ? `${n.file} · ${asked}` : `${asked}. ${n.why}` });
  }
  for (const f of a.files.filter((x) => x.via === 'request' && !lines.some((l) => l.name === x.name))) rows.push({ key: `req-${f.file}`, name: f.name, file: f.file, state: fromStatus(f.status), note: `${f.file} · uploaded for GSP’s request, ${shortDate(new Date(f.at))}` });
  return rows;
}

/**
 * Documents: one card, in tabs by state. What's still to do comes first, highlighted, in All and Pending: what the
 * application needs from the agency (one of its documents, something GSP requested or sent back, an offer's
 * conditions, the payment or visa proof, a detail for the profile), each to upload or do in place, then Send to
 * GSP when it applies. Then what's with GSP and what GSP approved, and in All what GSP added (the university's
 * letters among them). Conditions has the offer's conditions: to answer, or as answered. Every document can be
 * previewed and downloaded.
 */
function DocsTab({
  a,
  s,
  open,
  needRow,
  pendRef,
  sendBar,
  onDoc,
  onForm,
  onExtra,
}: {
  a: Application;
  s: Student;
  /** What the application needs from the agency now. */
  open: Need[];
  needRow: (n: Need) => React.ReactNode;
  /** Where "Upload it" in the banner brings you. */
  pendRef: React.RefObject<HTMLElement>;
  sendBar: React.ReactNode;
  onDoc: (d: AppDoc, f: File | null) => void;
  /** An offer's conditions: the form opens. */
  onForm: (n: Need) => void;
  /** Another document, named by the RP. */
  onExtra?: (name: string, file: string) => void;
}) {
  // the needs show as their own rows; the rest of the documents by state
  const rows = docRows(a, s).filter((r) => !r.need);
  const todo = isOpen(a) ? rows.filter((r) => r.state === 'pending' || r.state === 'rejected') : [];
  const rest = rows.filter((r) => r.state === 'review' || r.state === 'approved');
  const [tab, setTab] = useState<DocTab>('all');
  const showTodo = tab === 'all' || tab === 'pending';
  const shown = tab === 'conditions' ? [] : rest.filter((r) => inTab(tab, r.state)).sort((x, y) => (x.state === y.state ? 0 : x.state === 'review' ? -1 : 1));
  // what GSP added (the university's letters among them), in All
  const byGsp = a.files.filter((f) => f.from !== 'you').sort((x, y) => y.at - x.at);
  const forms = open.filter((n) => n.form);
  const conds = a.conds ?? [];
  // the conditions as cards, as GSP's team sees them (Nesil, 28 Oct): the ones to answer, then the ones sent
  const views = condViews({ ...a, needs: forms }, 'rp');
  const [viewing, setViewing] = useState<string | null>(null);
  // a set of conditions counts as one, however many questions it has
  const count = (t: DocTab) =>
    t === 'conditions'
      ? forms.length + conds.length
      : (t === 'all' || t === 'pending' ? open.length + todo.length : 0) + rest.filter((r) => inTab(t, r.state)).length + (t === 'all' ? byGsp.length : 0);
  const onKey = (e: React.KeyboardEvent) => {
    const i = DOC_TABS.findIndex(([k]) => k === tab);
    const to = e.key === 'ArrowRight' ? (i + 1) % DOC_TABS.length : e.key === 'ArrowLeft' ? (i - 1 + DOC_TABS.length) % DOC_TABS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(DOC_TABS[to][0]);
    document.getElementById(`adtab-${DOC_TABS[to][0]}`)?.focus();
  };
  const empty = tab === 'conditions' ? !forms.length && !conds.length : !(showTodo && open.length + todo.length > 0) && shown.length === 0 && !(tab === 'all' && byGsp.length);
  return (
    <div className="adocs">
      <section className="card acard adocs__card" aria-labelledby="adocs-title" ref={pendRef} tabIndex={-1}>
        <h2 id="adocs-title" className="acard__title">
          Documents
        </h2>
        <div className="adtabs" role="tablist" aria-label="Documents by state" onKeyDown={onKey}>
          {DOC_TABS.map(([k, label]) => (
            <button key={k} id={`adtab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="adocs-list" tabIndex={tab === k ? 0 : -1} className={`adtab ${tab === k ? 'is-on' : ''}`} onClick={() => setTab(k)}>
              {label}
              <span className="adtab__n num">{count(k)}</span>
            </button>
          ))}
        </div>
        <div id="adocs-list" className="adocs__body" role="tabpanel" aria-labelledby={`adtab-${tab}`}>
          {empty && (
            <p className="adocs__empty">
              {tab === 'pending'
                ? 'Nothing pending on you.'
                : tab === 'review'
                  ? 'Nothing with GSP right now.'
                  : tab === 'approved'
                    ? 'Nothing approved yet.'
                    : tab === 'conditions'
                      ? 'No conditions. When an offer has conditions, GSP sends them here to answer.'
                      : 'No documents yet.'}
            </p>
          )}
          {tab === 'conditions' && views.length > 0 && (
            <div className="condcards">
              {views.map((v) => (
                <CondCard
                  key={v.id}
                  v={v}
                  action={v.state === 'rp' ? 'Answer them' : 'View'}
                  onOpen={(id) => {
                    const n = forms.find((x) => x.id === id);
                    if (n) onForm(n);
                    else setViewing(id);
                  }}
                />
              ))}
            </div>
          )}
          {showTodo && open.length + todo.length > 0 && (
            <div className="adocs__todo">
              <ul className="aneeds__list">
                {open.map(needRow)}
                {todo.map((r) => {
                  const id = `adoc-${r.key}`;
                  return (
                    <li key={r.key} className="nrow nrow--todo nrow--hl">
                      <span className="nrow__mark" aria-hidden="true">
                        <Icon name="upload" size={16} />
                      </span>
                      <div className="nrow__t">
                        <p className="nrow__title">{r.name}</p>
                        <p className="nrow__why">{r.note}</p>
                      </div>
                      {r.doc && (
                        <div className="nrow__acts">
                          <label className="btn btn--primary btn--sm nrow__pick" htmlFor={id}>
                            <Icon name="upload" size={16} /> Upload
                          </label>
                          <input
                            id={id}
                            className="vh"
                            type="file"
                            accept={UPLOAD.accept}
                            aria-label={`Upload ${r.name}`}
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              e.target.value = '';
                              onDoc(r.doc!, f);
                            }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {sendBar}
            </div>
          )}
          {shown.length > 0 && (
            <ul className="adocs__list">
              {shown.map((r) => (
                <li key={r.key} className={`adoc is-${r.state}`}>
                  <span className={`adoc__icon adoc__icon--${r.state}`} aria-hidden="true">
                    <Icon name="file" size={18} />
                  </span>
                  <span className="adoc__t">
                    <span className="adoc__name">{r.name}</span>
                    <span className="adoc__file">{r.note}</span>
                  </span>
                  {r.file && <DocButtons d={{ name: r.name, file: r.file }} s={s} />}
                  <span className={`dpill ${DOC_PILL[r.state][1]}`}>{DOC_PILL[r.state][0]}</span>
                </li>
              ))}
            </ul>
          )}
          {tab === 'all' && byGsp.length > 0 && (
            <>
              <h3 className="adocs__k">From GSP</h3>
              <ul className="adocs__list">
                {byGsp.map((f) => (
                  <li key={f.file + f.at} className="adoc">
                    <span className="adoc__icon adoc__icon--uni" aria-hidden="true">
                      <Icon name="file" size={18} />
                    </span>
                    <span className="adoc__t">
                      <span className="adoc__name">{f.name}</span>
                      <span className="adoc__file">
                        {f.file} · {f.from === 'uni' ? 'from the university, added by GSP' : 'added by GSP'} {shortDate(new Date(f.at))}
                      </span>
                    </span>
                    <DocButtons d={{ name: f.name, file: f.file }} s={s} />
                    <span className="dpill dpill--uni">By GSP</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
      {isOpen(a) && onExtra && <ExtraDoc onAdd={onExtra} />}
      <CondDialog v={viewing ? views.find((v) => v.id === viewing) ?? null : null} s={s} onClose={() => setViewing(null)} />
    </div>
  );
}

/** Any other document the RP wants GSP to have, with a name the RP gives it (Jovial, 1 Nov). */
function ExtraDoc({ onAdd }: { onAdd: (name: string, file: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  return (
    <section className="card aextra">
      <div>
        <h3 className="aextra__t">Another document</h3>
        <p className="aextra__s">Anything else GSP should have for this application. You name it; GSP checks it.</p>
      </div>
      <Button variant="secondary" onClick={() => input.current?.click()}>
        <Icon name="upload" size={16} /> Upload a document
      </Button>
      <input ref={input} type="file" hidden accept={UPLOAD.accept} onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <NameDialog file={file} usual={['Gap explanation letter', 'Experience letter', 'Sponsor letter', 'Name change affidavit']} onCancel={() => setFile(null)} onAdd={(n) => { if (file) onAdd(n, file.name); setFile(null); }} />
    </section>
  );
}

/* ---------- activity ---------- */

const WHO: Record<string, [string, IconName]> = { you: ['Your agency', 'user'], gsp: ['GSP', 'shield'], uni: ['University', 'building'], ai: ['GSP Assist', 'chat'], system: ['Automatic', 'refresh'] };

function Activity({ a }: { a: Application }) {
  const reduce = useReducedMotion();
  const list = [...a.history].sort((x, y) => y.at - x.at);
  return (
    <section className="card acard" aria-labelledby="aact-title">
      <h2 id="aact-title" className="acard__title">
        What has happened
      </h2>
      <p className="acard__text">Every step, including the automatic ones, with who or what did it.</p>
      <ol className="aact">
        {list.map((e, i) => (
          <motion.li
            key={e.at + e.text}
            className={`aact__item aact__item--${e.who}`}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease, delay: Math.min(i, 8) * 0.03 }}
          >
            <span className="aact__icon" aria-hidden="true">
              {e.who === 'ai' ? <AssistMark size={16} /> : <Icon name={WHO[e.who][1]} size={16} />}
            </span>
            <span className="aact__t">
              <span className="aact__text">{e.text}</span>
              <span className="aact__meta">
                {e.by ?? WHO[e.who][0]} · {shortDate(new Date(e.at))}, {new Date(e.at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- withdrawing ---------- */

/** Why it's withdrawn: one list, data/reasons.ts (HC23). */
const REASONS = { get list() { return withdrawReasons(); } };

function WithdrawDialog({ open, a, s, onCancel, onConfirm }: { open: boolean; a: Application; s: Student; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(REASONS.list[0]);
  const c = courseOf(a);
  return (
    <ConfirmDialog open={open} title={`Withdraw ${s.first}’s application to ${c.uni.name}?`} confirm="Withdraw application" danger onCancel={onCancel} onConfirm={() => onConfirm(reason)}>
      <p>GSP tells {c.uni.name}, and the application closes. {s.first}’s documents stay on the profile for other applications.</p>
      <fieldset className="wreasons">
        <legend className="wreasons__legend">Why?</legend>
        {REASONS.list.map((r) => (
          <label key={r} className="wreason">
            <input type="radio" name="wreason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            <span>{r}</span>
          </label>
        ))}
      </fieldset>
    </ConfirmDialog>
  );
}
