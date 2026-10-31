import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MoreMenu } from '../../components/MoreMenu';
import { FLAG, money } from '../../data/courses';
import { shortDate } from '../../data/dates';
import { fullName, readiness, TESTS, type Member, type Student } from '../../data/students';
import {
  ENROL_DOC_LONG,
  REUPLOAD_AT,
  STAGES,
  STATUS,
  docLines,
  courseOf,
  earnFor,
  isOpen,
  arriveAt,
  ownerOf,
  stageOf,
  statusText,
  type Application,
  type AppOwner,
  type EndKind,
  type Need,
} from '../../data/applications';
import { campusLabel, duration, UniMark } from '../courses/parts';
import { Avatar, CopyButton } from '../students/parts';
import type { RecordTab } from '../students/StudentRecord';
import { AssistMark, StageTrack } from './parts';
import { Chat, type AskSeed } from './Chat';
import { MailTab } from './Mail';
import { SubmissionTab, isSubmitted } from './Submission';
import { StatusDialog, type StatusPick } from './StatusDialog';
import { ReviewDialog, whereFrom } from './ReviewDialog';
import { isSentBack, onProfile, reviewsOf, toReview, type Review } from './review';
import { longDate, mailDocs, rpContact, statusMail, type Desk, type MailDoc } from './desk';
import { DocButtons, downloadDoc } from '../../components/DocView';
import { Celebrate } from '../../components/Celebrate';
import { CondCard, CondDialog, condViews } from '../../screens/applications/Conditions';
import { NameDialog, nameFromFile } from './NameDialog';
import { OWNER_TAG } from './owners';
import { GSP_USER } from '../user';

export type AppTab = 'chat' | 'mail' | 'documents' | 'submission' | 'activity';
const TABS: [AppTab, string, IconName][] = [
  ['chat', 'Chat', 'chat'],
  ['mail', 'Mail', 'mail'],
  ['documents', 'Documents', 'folder'],
  ['submission', 'Submission', 'upload'],
  ['activity', 'Activity', 'clock'],
];
/** The one tag in the header's corner: who has the application now, as GSP sees it, never two at once. */
const HEAD_TAG: Record<AppOwner, string> = OWNER_TAG;
const ease = [0.2, 0.8, 0.2, 1] as const;
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('');

/** A need is met when its file reads as the right document, a profile detail is filled, or a payment is confirmed. */
export function needMet(n: Need, s: Student) {
  if (n.profile === 'education') return readiness(s).sections.find((x) => x.key === 'education')!.missing.length === 0;
  if (n.profile === 'personal') return readiness(s).sections.find((x) => x.key === 'personal')!.missing.length === 0;
  if (n.profile === 'tests') return s.tests.some((t) => TESTS[t.type].kind === 'English' && !!t.overall);
  if (n.action) return n.check === 'ok';
  return !!n.file && n.check !== 'reading';
}

/**
 * One application, from GSP's side: the student under their name with the course and university, the status
 * in the corner (GSP's team can change it, with a reason), the stage path, what's with the RP, and tabs that
 * never move: Chat with the RP (free text, plus the Request document template), Mail with the university,
 * Documents (the student's, and GSP's), Submission (where it goes in, and the university's reference) and
 * Activity. The RP contact, then Key details (with the census date and final tuition fee to edit), sit beside
 * every tab.
 */
export function AppDetail({
  a,
  s,
  team,
  agency,
  desk,
  setDesk,
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
  agency: string;
  desk: Desk;
  setDesk: (fn: (d: Desk) => Desk) => void;
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
  // GSP's actions are the signed-in person's
  const gsp = GSP_USER;
  const counsellor = team.find((m) => m.id === s.counsellor);
  const rp = rpContact(counsellor?.name ?? team[0].name, counsellor?.role ?? 'Admin', agency);
  const earn = earnFor(a);
  const [withdraw, setWithdraw] = useState(false);
  const [changing, setChanging] = useState(false);
  const [ask, setAsk] = useState<AskSeed | undefined>();
  const [docs, setDocs] = useState<DocTab>('all');
  const [rev, setRev] = useState<{ key: string; reject: boolean; list: string[] } | null>(null);
  // a document GSP is uploading, to name first
  const [naming, setNaming] = useState<File | null>(null);
  // a conditions form, opened from its card
  const [cond, setCond] = useState<string | null>(null);
  const docsRef = useRef<HTMLElement>(null);
  // the RP's to-dos: documents, requests and conditions (profile details aren't the application's to-dos)
  const open = a.needs.filter((n) => !n.profile && !needMet(n, s));
  const reviews = reviewsOf(a, s);
  const pending = reviews.filter((r) => toReview(r, a));
  const reached = stageDates(a);
  const unreadMail = desk.mails.filter((m) => m.box === 'in' && !m.read).length;
  const refMissing = isOpen(a) && isSubmitted(a) && !a.uniRef;

  // a request started from Documents is for this visit to the chat only
  useEffect(() => {
    if (tab !== 'chat') setAsk(undefined);
  }, [tab]);

  // the Documents tab fades in after the one before it fades out, so wait for the card before scrolling to it
  const scrollTo = (ref: React.RefObject<HTMLElement>) => {
    let tries = 0;
    const go = () => {
      if (ref.current) return ref.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (++tries < 15) window.setTimeout(go, 50);
    };
    window.setTimeout(go, 60);
  };
  const goNeeds = () => {
    setDocs('rp');
    setTab('documents');
    scrollTo(docsRef);
  };

  const goReview = () => {
    setDocs('review');
    setTab('documents');
    scrollTo(docsRef);
  };

  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    setTab(TABS[n][0]);
    document.getElementById(`atab-${TABS[n][0]}`)?.focus();
  };

  /* ---------- acting on the application, as GSP ---------- */

  const log = (text: string) => {
    const now = Date.now();
    update((x) => ({ ...x, history: [...x.history, { at: now, who: 'gsp', text, by: gsp.name }] }));
  };

  // GSP sets the status by hand: the old status's needs are done (requests stay), and a document the new one
  // needs from the RP (the payment proof, the visa lodgement proof) is asked for in the chat, by GSP. Or it closes.
  // A status that comes with a document by mail (an offer letter, the acceptance letter, the visa grant) has
  // its mail in, for GSP Assist to offer to add it to Documents
  const changeStatus = (pick: StatusPick) => {
    setChanging(false);
    if ('end' in pick) return close(pick.end, '', pick.stage);
    const { k } = pick;
    const now = Date.now();
    const from = statusText(a);
    const to = STATUS[k].text(d);
    update((x) => ({
      ...arriveAt({ ...x, history: [...x.history, { at: now, who: 'gsp', text: `Changed the status from “${from}” to “${to}”`, by: gsp.name }] }, k, now, gsp.name),
      status: k,
      since: now,
      end: undefined,
    }));
    const mail = statusMail({ ...a, status: k }, s, k, now - 15 * 60_000);
    if (mail) setDesk((x) => (x.mails.some((m) => m.id === mail.id) ? x : { ...x, mails: [mail, ...x.mails] }));
    say(`Status changed to ${to}.`);
  };

  const setRef = (ref: string, was?: string) => {
    const now = Date.now();
    update((x) => ({ ...x, uniRef: ref, history: [...x.history, { at: now, who: 'gsp', text: was ? `Changed the university reference from ${was} to ${ref}` : `Added the university reference ${ref}`, by: gsp.name }] }));
  };

  const setCensus = (t: number) => {
    setDesk((x) => ({ ...x, census: t }));
    log(`Set the census date to ${longDate(t)}`);
    say(`Census date set to ${longDate(t)}.`);
  };
  const setFee = (n: number) => {
    setDesk((x) => ({ ...x, fee: n }));
    log(`Set the final tuition fee to ${money(n, c.currency)}`);
    say(`Final tuition fee set to ${money(n, c.currency)}.`);
  };

  // a document GSP adds: from the chat, or uploaded in Documents, with the name GSP gave it
  const addFile = (file: string, via?: 'chat', name = nameFromFile(file)) => {
    const now = Date.now();
    update((x) => ({
      ...x,
      files: [...x.files, { name, file, from: 'gsp', at: now, status: 'verified', via }],
      history: [...x.history, { at: now, who: 'gsp', text: via ? `Shared ${file} in the chat` : `Uploaded ${file}`, by: gsp.name }],
    }));
  };

  /* ---------- reviewing the RP's documents ---------- */

  // the preview moves through the list it was opened from; after a decision, on to the next one still to review
  const revR = rev ? reviews.find((x) => x.key === rev.key) ?? null : null;
  const revAt = rev ? rev.list.indexOf(rev.key) : -1;
  const afterDecision = (r: Review) => {
    if (!rev) return;
    const i = rev.list.indexOf(r.key);
    const next = [...rev.list.slice(i + 1), ...rev.list.slice(0, Math.max(0, i))].find((k) => k !== r.key && pending.some((p) => p.key === k));
    setRev(next ? { ...rev, key: next, reject: false } : null);
  };

  // accepted: verified where it's kept, and on the profile too for a profile document; the last one of a check readies it to submit
  // accepting marks it verified; moving the application on (to Ready to submit, say) is GSP's, with Change
  const accept = (r: Review) => {
    const now = Date.now();
    const left = pending.filter((x) => x.key !== r.key);
    if (r.on === 'profile' || onProfile(r.key)) updateStudent((p) => ({ ...p, docs: { ...p.docs, [r.key]: { name: p.docs[r.key]?.name ?? r.name, file: r.file, status: 'verified' } } }));
    update((x) => ({
      ...x,
      files: x.files.map((f) => (f.from === 'you' && f.name === r.name && f.file === r.file ? { ...f, status: 'verified' } : f)),
      history: [...x.history, { at: now, who: 'gsp', text: `Verified the ${r.name.toLowerCase()}`, by: gsp.name }],
    }));
    afterDecision(r);
    say(`${r.name} verified.${left.length ? ` ${left.length} left to review.` : ' Nothing left to review: change the status when it’s ready to move on.'}`);
  };

  // sent back: a request to upload it again, with GSP's reason, which comes straight back to GSP once uploaded.
  // Rejecting puts the application at its stage's Document re-upload pending, with the RP (Nesil, 28 Oct); it's
  // GSP's to move on again once the new copy is checked
  const reject = (r: Review, reason: string) => {
    const now = Date.now();
    const back = REUPLOAD_AT[stageOf(a)];
    const base = r.key.startsWith('file:') ? `redo-${now}` : r.key;
    const id = a.needs.some((n) => n.id === base) ? `${base}-${now}` : base;
    const need: Need = { id, title: r.name, why: reason, source: `Sent back by GSP, ${shortDate(new Date(now))}`, request: { by: gsp.name, at: now }, ...(back ? { step: back } : {}) };
    update((x) => ({
      ...x,
      ...(back && back !== x.status ? { status: back, since: now } : {}),
      unread: (x.unread ?? 0) + 1,
      needs: [...x.needs, need],
      chat: [...x.chat, { id: `m${now}`, at: now, from: 'gsp', name: gsp.name, text: `I’ve sent back the ${r.name.toLowerCase()}: ${/[.!?]$/.test(reason) ? reason : `${reason}.`} Could you upload it again?`, request: need.id, requestName: need.title }],
      history: [
        ...x.history,
        { at: now, who: 'gsp', text: `Sent back the ${r.name.toLowerCase()}: ${reason}`, by: gsp.name },
        ...(back && back !== x.status ? [{ at: now, who: 'system' as const, text: STATUS[back].text(d) }] : []),
      ],
    }));
    afterDecision(r);
    say(`${r.name} sent back to the RP.`);
  };

  // a missing document in Documents: the chat's Request document template, filled in
  const requestDoc = (title: string, why: string) => {
    setAsk({ key: Date.now(), title, text: why });
    setTab('chat');
  };

  // a university document that came by mail: GSP Assist offers to add it to Documents and tell the RP
  const nudge = isOpen(a) ? mailDocs(desk, a)[0] : undefined;
  const addFromMail = (m: MailDoc) => {
    const now = Date.now();
    update((x) => ({
      ...x,
      files: [...x.files, { name: m.name, file: m.file, from: 'uni', at: now, status: 'verified' }],
      unread: (x.unread ?? 0) + 1,
      chat: [...x.chat, { id: `m${now}`, at: now, from: 'gsp', name: gsp.name, text: `${m.org} sent ${s.first}’s ${m.name}. I’ve added it to Documents.`, files: [m.file] }],
      history: [...x.history, { at: now, who: 'gsp', text: `Added the ${m.name} from ${m.org}’s mail to Documents, and let the RP know`, by: gsp.name }],
    }));
    say(`${m.name} added to Documents. ${agency} has been told in the chat.`);
  };
  const skipMail = (m: MailDoc) => {
    setDesk((x) => ({ ...x, dismissed: [...(x.dismissed ?? []), m.file] }));
    say(`${m.name} left in the mail.`);
  };

  const close = (kind: EndKind, reason: string, stage = stageOf(a)) => {
    const now = Date.now();
    update((x) => ({ ...x, status: 'closed', since: now, needs: [], end: { kind, reason, stage, at: now }, history: [...x.history, { at: now, who: 'gsp', text: `Closed, ${kind.toLowerCase()}${reason ? `: ${reason}` : ''}`, by: gsp.name }] }));
    say(`${a.id} closed: ${kind.toLowerCase()}.`);
  };

  // the offer's facts sit in Key details until the deposit is paid; its conditions are needs, in Documents
  const offer = a.offer && isOpen(a) && stageOf(a) <= 5 ? a.offer : undefined;
  const acceptLeft = offer ? Math.max(0, Math.ceil((offer.acceptBy - Date.now()) / 86_400_000)) : 0;

  return (
    <div className="record aapp gapp">
      <button type="button" className="rback" onClick={onBack}>
        <Icon name="arrowLeft" size={18} />
        Applications
      </button>

      <header className="card ahead">
        <div className="ahead__top">
          <Avatar s={s} big />
          <div className="ahead__names">
            <p className="ahead__kicker num">
              {a.id}
              <CopyButton text={a.id} what="Application ID" onDone={say} />
              {a.uniRef && (
                <>
                  <span className="ahead__dot" aria-hidden="true">·</span> {c.uni.name.replace(/ University$|^University of (the )?/, '')} ref {a.uniRef}
                  <CopyButton text={a.uniRef} what="University reference" onDone={say} />
                </>
              )}
            </p>
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
              <span className="gstat__line">
                <span className={`who who--${o === 'done' ? 'ok' : o}`}>{HEAD_TAG[o]}</span>
                <button type="button" className="gstat__change" aria-label="Change status" onClick={() => setChanging(true)}>
                  <Icon name="edit" size={14} />
                  Change
                </button>
              </span>
            </div>
            <MoreMenu
              id="app-more"
              label="More for this application"
              word="More"
              items={[
                { id: 'student', label: 'Student profile', icon: 'user', onPick: () => onOpenStudent(s.id) },
                ...(isOpen(a) ? [{ id: 'withdraw', label: 'Withdraw application', icon: 'close' as IconName, danger: true, onPick: () => setWithdraw(true) }] : []),
              ]}
            />
          </div>
        </div>
        <StageTrack stage={stageOf(a)} owner={o} dates={reached} who={false} />
      </header>

      {/* GSP Assist's nudge, what's GSP's to do, what's with the RP, or why it's closed */}
      <AnimatePresence initial={false}>
        {nudge && (
          <motion.section
            key={`mail-${nudge.file}`}
            className="aneed gnudge"
            aria-label="GSP Assist"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease }}
          >
            <span className="gnudge__mark" aria-hidden="true">
              <AssistMark size={22} motion="idle" />
            </span>
            <div className="aneed__t">
              <p className="gnudge__k">GSP Assist</p>
              <p className="aneed__title">
                Hi {gsp.name.split(' ')[0]}, we’ve received the {nudge.name} for {fullName(s)}.
              </p>
              <p className="aneed__text">
                It came from {nudge.mail.from.name} by mail. Should I add it to Documents, so {agency} can access it, and let them know?
              </p>
              <span className="gnudge__file">
                <Icon name="file" size={16} />
                <span className="gnudge__fname">{nudge.file}</span>
                <DocButtons d={{ name: nudge.name, file: nudge.file }} s={s} />
              </span>
            </div>
            <span className="gnudge__acts">
              <Button variant="secondary" onClick={() => skipMail(nudge)}>
                No
              </Button>
              <Button onClick={() => addFromMail(nudge)}>Yes, add to documents</Button>
            </span>
          </motion.section>
        )}
        {a.status === 'enrolled' && <Celebrate key="enrolled" title={`${s.first} is enrolled`} text={`${fullName(s)} is enrolled at ${c.uni.name} for the ${c.name}, ${a.intake} intake.`} />}
        {pending.length > 0 && isOpen(a) && (
          <motion.section
            key="review"
            className="aneed aneed--gsp"
            aria-label="To review"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease }}
          >
            <span className="aneed__mark" aria-hidden="true">
              <Icon name="doc" size={20} />
            </span>
            <div className="aneed__t">
              <p className="aneed__title">Pending on you: {pending.length === 1 ? '1 document to review' : `${pending.length} documents to review`}</p>
              <p className="aneed__text">{pending.map((r) => r.name).join(' · ')}</p>
            </div>
            <Button onClick={goReview} iconRight={<Icon name="arrowRight" size={18} />}>
              {pending.length === 1 ? 'Review it' : 'Review them'}
            </Button>
          </motion.section>
        )}
        {open.length > 0 && isOpen(a) && (
          <motion.section
            key="needs"
            className="aneed"
            aria-label="With RP"
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
                With RP: {open.length === 1 ? '1 thing to do' : `${open.length} things to do`}
                {open.some((n) => n.due) && <span className="aneed__due"> · due {shortDate(new Date(Math.min(...open.filter((n) => n.due).map((n) => n.due!))))}</span>}
              </p>
              <p className="aneed__text">{open.map((n) => (n.request ? `${n.title} (you asked)` : n.title)).join(' · ')}</p>
            </div>
            <Button onClick={goNeeds} iconRight={<Icon name="arrowRight" size={18} />}>
              {open.length === 1 ? 'See it' : 'See them'}
            </Button>
          </motion.section>
        )}
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
              {k === 'documents' && pending.length > 0 && (
                <span className="atabs__badge atabs__badge--gsp num" title={`${pending.length} to review`}>
                  {pending.length}
                </span>
              )}
              {k === 'mail' && unreadMail > 0 && (
                <span className="atabs__badge num" title={`${unreadMail} unread`}>
                  {unreadMail}
                </span>
              )}
              {k === 'submission' && refMissing && (
                <span className="atabs__badge atabs__badge--gsp num" title="The university reference is still to add">
                  1
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
            {tab === 'chat' && <Chat a={a} s={s} agency={agency} update={update} onShare={(f) => addFile(f, 'chat')} ask={ask} say={say} />}
            {tab === 'mail' && <MailTab a={a} desk={desk} setDesk={setDesk} onLog={log} say={say} />}
            {tab === 'documents' && (
              <DocsTab
                a={a}
                s={s}
                tab={docs}
                setTab={setDocs}
                cardRef={docsRef}
                reviews={reviews}
                pending={pending}
                onPreview={(r, list) => setRev({ key: r.key, reject: false, list })}
                onReject={(r, list) => setRev({ key: r.key, reject: true, list })}
                onAccept={accept}
                onRequest={requestDoc}
                onCond={setCond}
                onUpload={(f) => f && setNaming(f)}
              />
            )}
            {tab === 'submission' && <SubmissionTab a={a} desk={desk} onRef={setRef} say={say} />}
            {tab === 'activity' && <Activity a={a} agency={agency} />}
          </motion.div>
        </AnimatePresence>

        <aside className="abody__side" aria-label="About this application">
          <section className="card acard aperson">
            <h2 className="acard__title">RP contact</h2>
            <div className="aperson__who">
              <span className="savatar aperson__av gperson__av" aria-hidden="true">
                {initials(rp.name)}
              </span>
              <span>
                <span className="aperson__name">{rp.name}</span>
                <span className="aperson__role">{rp.role}</span>
              </span>
            </div>
            <dl className="aperson__ways">
              <div className="aperson__line">
                <dt>
                  <Icon name="phone" size={16} />
                  <span className="vh">Phone</span>
                </dt>
                <dd>
                  <span>{rp.phone}</span>
                  <CopyButton text={rp.phone} what={`${rp.first}’s number`} onDone={say} />
                </dd>
              </div>
              <div className="aperson__line">
                <dt>
                  <Icon name="mail" size={16} />
                  <span className="vh">Email</span>
                </dt>
                <dd>
                  <a className="aperson__mail" href={`mailto:${rp.email}`}>
                    {rp.email}
                  </a>
                  <CopyButton text={rp.email} what={`${rp.first}’s email`} onDone={say} />
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
              <EditRow id="census" k="Census date" kind="date" value={desk.census} shown={longDate(desk.census)} onSave={setCensus} />
              <EditRow
                id="fee"
                k="Final tuition fee"
                kind="money"
                currency={c.currency}
                value={desk.fee}
                shown={
                  <span>
                    <span className="num">{money(desk.fee, c.currency)}</span>
                    {desk.fee !== c.tuition && <span className="cdl__soft num"> · listed {money(c.tuition, c.currency)}</span>}
                  </span>
                }
                onSave={setFee}
              />
              <Row k="Campus" v={campusLabel(c.campus)} />
              <Row k="Length" v={duration(c.months)} />
              {c.scholarship > 0 && <Row k="Scholarship" v={<span className="num">Up to {money(c.scholarship, c.currency)}</span>} />}
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
              <Row k="Counsellor" v={counsellor?.name} />
              <Row k="Base commission" v={<span className="num">{earn.text}</span>} />
              <Row k="Started" v={shortDate(new Date(a.created))} />
            </dl>
          </section>
        </aside>
      </div>

      <StatusDialog open={changing} a={a} onCancel={() => setChanging(false)} onConfirm={changeStatus} />
      <CondDialog v={cond ? condViews(a).find((v) => v.id === cond) ?? null : null} s={s} onClose={() => setCond(null)} />
      <ReviewDialog
        r={revR}
        a={a}
        s={s}
        rejecting={!!rev?.reject}
        onClose={() => setRev(null)}
        onAccept={accept}
        onReject={reject}
        pos={rev && revAt >= 0 ? { i: revAt, n: rev.list.length } : undefined}
        onStep={(by) => rev && setRev({ ...rev, key: rev.list[revAt + by] ?? rev.key, reject: false })}
      />
      <NameDialog
        file={naming}
        usual={['Conditional offer letter', 'Unconditional offer letter', ENROL_DOC_LONG[d], 'Visa grant letter', 'Proof of enrolment']}
        onCancel={() => setNaming(null)}
        onAdd={(name) => {
          if (naming) addFile(naming.name, undefined, name);
          setNaming(null);
          say(`${name} added to Documents.`);
        }}
      />
      <WithdrawDialog open={withdraw} a={a} s={s} agency={agency} onCancel={() => setWithdraw(false)} onConfirm={(r) => (setWithdraw(false), close('Student withdrawn', r))} />
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

const isoDate = (t: number) => {
  const x = new Date(t);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** A Key details line GSP can correct: the value with a pencil, then a field with Save and Cancel. */
function EditRow({ id, k, kind, value, shown, currency, onSave }: { id: string; k: string; kind: 'date' | 'money'; value: number; shown: React.ReactNode; currency?: string; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  const begin = () => {
    setV(kind === 'date' ? isoDate(value) : String(value));
    setBad(false);
    setEditing(true);
    window.setTimeout(() => ref.current?.focus(), 30);
  };
  const end = () => {
    setEditing(false);
    window.setTimeout(() => pencil.current?.focus(), 30);
  };
  const save = () => {
    const n = kind === 'date' ? new Date(`${v}T00:00:00`).getTime() : Number(v.replace(/[^\d.]/g, ''));
    if (!v.trim() || !Number.isFinite(n) || n <= 0 || (kind === 'money' && n > 10_000_000)) return setBad(true);
    if (n !== value) onSave(n);
    end();
  };
  return (
    <div className={`cdl__row gedit ${editing ? 'is-editing' : ''}`}>
      <dt>{editing ? <label htmlFor={`gedit-${id}`}>{k}</label> : k}</dt>
      <dd>
        {editing ? (
          <form
            className="gedit__form"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              e.stopPropagation();
              end();
            }}
          >
            <span className={`control gedit__control ${bad ? 'is-invalid' : ''}`}>
              {kind === 'money' && (
                <span className="gedit__cur" aria-hidden="true">
                  {currency}
                </span>
              )}
              <input
                ref={ref}
                id={`gedit-${id}`}
                className="control__input num"
                type={kind === 'date' ? 'date' : 'text'}
                inputMode={kind === 'money' ? 'numeric' : undefined}
                value={v}
                aria-invalid={bad || undefined}
                aria-describedby={bad ? `gedit-${id}-err` : undefined}
                onChange={(e) => {
                  setV(e.target.value);
                  setBad(false);
                }}
              />
            </span>
            {bad && (
              <span id={`gedit-${id}-err`} className="gedit__err" role="alert">
                {kind === 'date' ? 'Pick a date.' : 'Enter the fee as a number.'}
              </span>
            )}
            <span className="gedit__acts">
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={end}>
                Cancel
              </Button>
            </span>
          </form>
        ) : (
          <span className="gedit__val">
            {shown}
            <button ref={pencil} type="button" className="scopy gedit__pen" aria-label={`Edit the ${k.toLowerCase()}`} title={`Edit the ${k.toLowerCase()}`} onClick={begin}>
              <Icon name="edit" size={14} />
            </button>
          </span>
        )}
      </dd>
    </div>
  );
}

/* ---------- what's with the RP ---------- */

/** What the RP owes for this application, read-only here: GSP sees each item and where it's got to. */
function NeedRow({ n, met, onView }: { n: Need; met: boolean; onView?: (id: string) => void }) {
  const state = met ? 'ok' : n.check === 'flag' ? 'flag' : 'todo';
  return (
    <li className={`nrow nrow--${state} ${n.request ? 'nrow--request' : ''}`}>
      <span className="nrow__mark" aria-hidden="true">
        {state === 'ok' ? <Icon name="check" size={16} strokeWidth={2.4} /> : state === 'flag' ? <Icon name="alert" size={16} /> : <Icon name={n.profile || n.form ? 'edit' : n.action ? 'wallet' : 'upload'} size={16} />}
      </span>
      <div className="nrow__t">
        <p className="nrow__title">
          {n.title}
          {isSentBack(n) ? <span className="nrow__req">Sent back</span> : n.request && <span className="nrow__req">You asked</span>}
        </p>
        <p className="nrow__why">{n.why}</p>
        {(n.source || n.due || n.request) && (
          <p className="nrow__meta">
            {n.request && !isSentBack(n) && (
              <span className="nrow__cite">
                <Icon name="chat" size={14} />
                {n.request.by}, {shortDate(new Date(n.request.at))}, in the chat
              </span>
            )}
            {n.source && (
              <span className="nrow__cite">
                <Icon name="doc" size={14} />
                {n.source}
              </span>
            )}
            {n.due && <span className="nrow__due">Due {shortDate(new Date(n.due))}</span>}
          </p>
        )}
        {n.file && (
          <div className={`nrow__file nrow__file--${state}`}>
            <span className="nrow__fname">
              <Icon name="file" size={16} />
              {n.file}
            </span>
          </div>
        )}
      </div>
      <div className="nrow__acts">
        {n.form && onView && (
          <Button size="sm" variant="secondary" iconLeft={<Icon name="eye" size={16} />} onClick={() => onView(n.id)} aria-label={`View ${n.title}`}>
            View
          </Button>
        )}
        <span className={`who who--${met ? 'ok' : 'you'}`}>{met ? (n.profile ? 'On the profile' : 'Done') : n.file ? 'Uploaded, not sent' : 'With RP'}</span>
      </div>
    </li>
  );
}

/* ---------- documents ---------- */

type DocTab = 'all' | 'review' | 'rp' | 'approved' | 'conditions';
const DOC_TABS: [DocTab, string][] = [
  ['all', 'All'],
  ['review', 'To review'],
  ['rp', 'With RP'],
  ['approved', 'Approved'],
  ['conditions', 'Conditions'],
];
const needTag = (n?: Review['need']) => n && <span className="nadoc__tag">{n === 'required' ? 'Required' : n === 'optional' ? 'Optional' : 'Later'}</span>;

/** One of the RP's documents that isn't waiting on GSP: approved, or uploaded and not sent to GSP yet. */
function DocRow({ r, s, onPreview }: { r: Review; s: Student; onPreview: (r: Review) => void }) {
  const ok = r.status === 'verified';
  return (
    <li className="adoc">
      <span className={`adoc__icon adoc__icon--${ok ? 'approved' : 'pending'}`} aria-hidden="true">
        <Icon name="file" size={18} />
      </span>
      <span className="adoc__t">
        <span className="adoc__name">
          {r.name} {needTag(r.need)}
        </span>
        <span className="adoc__file">
          {r.file} · {whereFrom(r, s)}
        </span>
      </span>
      <span className="gdoc__end">
        <button type="button" className="scopy" aria-label={`Download ${r.file}`} title="Download" onClick={() => downloadDoc(r, s)}>
          <Icon name="download" size={16} />
        </button>
        <button type="button" className="scopy" aria-label={`Preview the ${r.name.toLowerCase()}`} title="Preview" onClick={() => onPreview(r)}>
          <Icon name="eye" size={16} />
        </button>
        <span className={`dpill dpill--${ok ? 'verified' : 'uploaded'}`}>{ok ? 'Approved' : 'Not sent yet'}</span>
      </span>
    </li>
  );
}

/**
 * Documents: one card, in tabs by state (the RP's tabs, from GSP's side; against the "no tabs inside tabs"
 * Decision, as in RP Admin). **To review** comes first, in GSP's colour: what the RP sent, to preview, accept or
 * reject. **With RP**: what the RP owes (GSP's requests, documents sent back, an offer's conditions, the
 * payment or visa proof), the application's documents not uploaded yet, each with Request, and uploads not
 * sent to GSP yet. **Approved**: what GSP verified. **Conditions**: each conditions form as a card that opens
 * it. All has every one of them but the conditions, then what GSP added (the university's letters among them).
 */
function DocsTab({
  a,
  s,
  tab,
  setTab,
  cardRef,
  reviews,
  pending,
  onPreview,
  onReject,
  onAccept,
  onRequest,
  onCond,
  onUpload,
}: {
  a: Application;
  s: Student;
  tab: DocTab;
  setTab: (t: DocTab) => void;
  /** Where the banners' See them and Review them bring you. */
  cardRef: React.RefObject<HTMLElement>;
  reviews: Review[];
  /** What's waiting for GSP's check. */
  pending: Review[];
  /** With the list it's in, to move through in the preview. */
  onPreview: (r: Review, list: string[]) => void;
  onReject: (r: Review, list: string[]) => void;
  onAccept: (r: Review) => void;
  onRequest: (title: string, why: string) => void;
  onCond: (id: string) => void;
  onUpload: (f: File | null) => void;
}) {
  const c = courseOf(a);
  const open = isOpen(a);
  const lines = docLines(a, s);
  const asked = (key: string, name: string) => a.needs.some((n) => n.id === key || n.title === name);
  // what the RP owes; then the application's own documents it hasn't uploaded, and uploads not sent to GSP yet
  const needs = open ? a.needs : [];
  const missing = open ? lines.filter((l) => l.need === 'required' && !reviews.some((r) => r.key === l.key) && !asked(l.key, l.name)) : [];
  const notSent = reviews.filter((r) => !r.back && r.status === 'uploaded' && !toReview(r, a));
  const approved = reviews.filter((r) => !r.back && r.status === 'verified');
  const byGsp = a.files.filter((f) => f.from !== 'you').sort((x, y) => y.at - x.at);
  const views = condViews(a);
  const count: Record<DocTab, number> = {
    review: pending.length,
    rp: needs.length + missing.length + notSent.length,
    approved: approved.length,
    // a set of conditions counts as one, however many questions it has
    conditions: views.length,
    all: 0,
  };
  count.all = count.review + count.rp + count.approved + byGsp.length;
  const show = (t: DocTab) => tab === 'all' || tab === t;
  // the documents as this tab lists them, for the preview to move through
  const order = [...(show('review') ? pending : []), ...(show('rp') ? notSent : []), ...(show('approved') ? approved : [])].map((r) => r.key);
  const preview = (r: Review) => onPreview(r, order);
  const empty = tab === 'conditions' ? !views.length : count[tab] === 0;
  const onKey = (e: KeyboardEvent) => {
    const i = DOC_TABS.findIndex(([k]) => k === tab);
    const to = e.key === 'ArrowRight' ? (i + 1) % DOC_TABS.length : e.key === 'ArrowLeft' ? (i - 1 + DOC_TABS.length) % DOC_TABS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(DOC_TABS[to][0]);
    document.getElementById(`gdtab-${DOC_TABS[to][0]}`)?.focus();
  };

  return (
    <div className="adocs">
      <section className="card acard adocs__card gdocs__card" aria-labelledby="gdocs-title" ref={cardRef} tabIndex={-1}>
        <div className="gdocs__top">
          <h2 id="gdocs-title" className="acard__title">
            Documents
          </h2>
          <label className="btn btn--secondary btn--sm nrow__pick" htmlFor="gdocs-file">
            <Icon name="upload" size={16} /> Upload
          </label>
          <input
            id="gdocs-file"
            className="vh"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            aria-label="Upload a document as GSP"
            onChange={(e) => {
              onUpload(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </div>
        <div className="adtabs" role="tablist" aria-label="Documents by state" onKeyDown={onKey}>
          {DOC_TABS.map(([k, label]) => (
            <button key={k} id={`gdtab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="gdocs-list" tabIndex={tab === k ? 0 : -1} className={`adtab ${tab === k ? 'is-on' : ''}`} onClick={() => setTab(k)}>
              {label}
              <span className="adtab__n num">{count[k]}</span>
            </button>
          ))}
        </div>
        <div id="gdocs-list" className="adocs__body" role="tabpanel" aria-labelledby={`gdtab-${tab}`}>
          {empty && (
            <p className="adocs__empty">
              {tab === 'review'
                ? 'Nothing to review. What the RP sends comes here first.'
                : tab === 'rp'
                  ? 'Nothing with the RP. To ask for something, use Request document or Request conditions in the chat.'
                  : tab === 'approved'
                    ? 'Nothing approved yet.'
                    : tab === 'conditions'
                      ? 'No conditions. When an offer has conditions, send them to the RP with Request conditions in the chat.'
                      : 'No documents yet.'}
            </p>
          )}

          {tab === 'conditions' && views.length > 0 && (
            <div className="condcards">
              {views.map((v) => (
                <CondCard key={v.id} v={v} onOpen={onCond} />
              ))}
            </div>
          )}

          {show('review') && pending.length > 0 && (
            <ul className="gdocs__review" aria-label="To review">
              {pending.map((r) => (
                <li key={r.key} className="grow">
                  <span className="adoc__icon" aria-hidden="true">
                    <Icon name="file" size={18} />
                  </span>
                  <span className="adoc__t">
                    <span className="adoc__name">
                      {r.name} {r.need !== 'later' && needTag(r.need)}
                    </span>
                    <span className="adoc__file">
                      {r.file} · {whereFrom(r, s)}
                      {r.at ? `, ${shortDate(new Date(r.at))}` : ''}
                    </span>
                  </span>
                  <span className="greview__acts">
                    <Button size="sm" variant="ghost" iconLeft={<Icon name="eye" size={16} />} aria-label={`Preview the ${r.name.toLowerCase()}`} onClick={() => preview(r)}>
                      Preview
                    </Button>
                    <Button size="sm" variant="secondary" aria-label={`Reject the ${r.name.toLowerCase()}`} onClick={() => onReject(r, order)}>
                      Reject
                    </Button>
                    <Button size="sm" iconLeft={<Icon name="check" size={16} strokeWidth={2.4} />} aria-label={`Accept the ${r.name.toLowerCase()}`} onClick={() => onAccept(r)}>
                      Accept
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {show('rp') && needs.length > 0 && (
            <ul className="aneeds__list" aria-label="With RP">
              {needs.map((n) => (
                <NeedRow key={n.id} n={n} met={needMet(n, s)} onView={onCond} />
              ))}
            </ul>
          )}
          {show('rp') && missing.length + notSent.length > 0 && (
            <ul className="adocs__list">
              {missing.map((l) => (
                <li key={l.key} className="adoc">
                  <span className="adoc__icon adoc__icon--missing" aria-hidden="true">
                    <Icon name="upload" size={18} />
                  </span>
                  <span className="adoc__t">
                    <span className="adoc__name">
                      {l.name} {needTag(l.need)}
                    </span>
                    <span className="adoc__file">Not uploaded yet · {l.what}</span>
                  </span>
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="chat" size={16} />} onClick={() => onRequest(l.name, `${c.uni.name} asks for it with the application.`)} aria-label={`Request the ${l.name.toLowerCase()} from the RP`}>
                    Request
                  </Button>
                </li>
              ))}
              {notSent.map((r) => (
                <DocRow key={r.key} r={r} s={s} onPreview={preview} />
              ))}
            </ul>
          )}

          {show('approved') && approved.length > 0 && (
            <ul className="adocs__list">
              {approved.map((r) => (
                <DocRow key={r.key} r={r} s={s} onPreview={preview} />
              ))}
            </ul>
          )}

          {tab === 'all' && byGsp.length > 0 && (
            <>
              <h3 className="adocs__k">By GSP</h3>
              <ul className="adocs__list">
                {byGsp.map((f) => (
                  <li key={f.file + f.at} className="adoc">
                    <span className="adoc__icon adoc__icon--uni" aria-hidden="true">
                      <Icon name="file" size={18} />
                    </span>
                    <span className="adoc__t">
                      <span className="adoc__name">{f.name}</span>
                      <span className="adoc__file">
                        {f.file} · {f.from === 'uni' ? 'from the university' : f.via === 'chat' ? 'shared in the chat' : 'uploaded by GSP'}
                      </span>
                    </span>
                    <DocButtons d={{ name: f.name, file: f.file }} s={s} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------- activity ---------- */

const WHO: Record<string, [string, IconName]> = { you: ['RP', 'user'], gsp: ['GSP', 'shield'], uni: ['University', 'building'], ai: ['GSP Assist', 'chat'], system: ['Automatic', 'refresh'] };

function Activity({ a, agency }: { a: Application; agency: string }) {
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
                {e.by ? (e.who === 'you' ? `${e.by}, ${agency}` : e.by) : e.who === 'you' ? agency : WHO[e.who][0]} · {shortDate(new Date(e.at))}, {new Date(e.at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- withdrawing ---------- */

const REASONS = ['The student chose another offer', 'The student is deferring to a later intake', 'The student isn’t going to study abroad', 'Another reason'];

function WithdrawDialog({ open, a, s, agency, onCancel, onConfirm }: { open: boolean; a: Application; s: Student; agency: string; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const c = courseOf(a);
  return (
    <ConfirmDialog open={open} title={`Withdraw ${s.first}’s application to ${c.uni.name}?`} confirm="Withdraw" cancel="Keep it" onCancel={onCancel} onConfirm={() => onConfirm(reason)}>
      <p>Tell {c.uni.name} by mail; the application closes here and for {agency}, with the reason. {s.first}’s documents stay on the profile for other applications.</p>
      <fieldset className="wreasons">
        <legend className="wreasons__legend">Why?</legend>
        {REASONS.map((r) => (
          <label key={r} className="wreason">
            <input type="radio" name="wreason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            <span>{r}</span>
          </label>
        ))}
      </fieldset>
    </ConfirmDialog>
  );
}
