import { UNIVERSITIES } from './courses';
import { courseOf, type Application, type Event, type Msg } from './applications';
import { fullName, type Student } from './students';
import { statusOf, type Announcement } from '../institution/data/announcements';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The bell and the megaphone at the top right of the portal (Nesil, 30 Oct; every role).
 * **Notifications** are about the portal's own work, and are built from it (HC53, Jovial 1 Nov), never typed: for the
 * RP, what GSP and the universities did on its applications (statuses, requests, documents, chat messages and
 * university emails) and the students its team added; for GSP, the person's My work tasks and what the RPs did on
 * the applications they own. **Announcements** are in the model GSP's Institution Team publishes them in.
 */

export type NoteKind = 'system' | 'chat' | 'mail';
export const NOTE_KINDS: [NoteKind, string][] = [
  ['system', 'System'],
  ['chat', 'Chat'],
  ['mail', 'Mail'],
];
/** Where a notification takes you: an application, a student's record, or a page. */
export type NoteTarget = { app: string } | { student: string } | { page: 'home' | 'earnings' | 'profile' | 'mywork' };
export type Note = { id: string; kind: NoteKind; title: string; text: string; at: number; read?: boolean; to?: NoteTarget };
/** A My work task, as the bell needs it (work/store.ts). */
export type NoteTask = { id: string; title: string; record?: string; assignee?: string | null; status: string; created?: number };

/**
 * How far back the bell looks (slice 4 PRD, S4-15): notifications are kept 90 days; the bell shows the newest 40 and
 * "Show older" for the rest (Inbox.tsx). Read state is saved per person (Inbox.tsx).
 */
const WINDOW = 90 * DAY;
export const BELL_SHOWS = 40;
const clip = (s: string) => (s.length > 110 ? `${s.slice(0, 107).trimEnd()}…` : s);
const shortUni = (name: string) => name.replace(/^The /, '');

/** Still registering, or with GSP for verification: what the portal has done so far, from the registration's own times. */
function onboardingNotes(access: 'setup' | 'verifying', join?: { created?: number; sentAt?: number }): Note[] {
  const made = join?.created;
  const sent = join?.sentAt;
  return [
    ...(made ? [{ id: 'n-ob-email', kind: 'mail' as const, title: 'Email address verified', text: access === 'setup' ? 'Your account is ready. Add the business details and documents to send to GSP.' : 'Your account is ready.', at: made, read: access !== 'setup', to: { page: 'home' as const } }] : []),
    ...(access === 'verifying' && sent
      ? [
          { id: 'n-ob-sent', kind: 'system' as const, title: 'GSP is verifying your documents', text: 'You’ll get an email too.', at: sent, to: { page: 'home' as const } },
          { id: 'n-ob-mail', kind: 'mail' as const, title: 'Email sent to you', text: 'A copy of what you sent GSP, for your records.', at: sent, to: { page: 'home' as const } },
        ]
      : []),
  ];
}

/** The notifications one application gives the side that didn't act: the other side's messages, then its activity. */
function appNotes(a: Application, theirs: string[], about: string, actor: (e: Event) => string, mineSince: number): Note[] {
  const to = { app: a.id };
  const said = new Set(a.chat.filter((m) => theirs.includes(m.from)).map((m) => m.at));
  const msg = (m: Msg): Note => {
    const id = `${a.id}-${m.id}`;
    const read = m.at <= mineSince;
    if (m.request) return { id, kind: 'system', title: `${m.name} asked for the ${(m.requestName ?? 'document').toLowerCase()}`, text: about, at: m.at, read, to };
    if (m.via === 'email') return { id, kind: 'mail', title: `Email from ${m.name}`, text: `${about}: “${clip(m.text)}”`, at: m.at, read, to };
    return { id, kind: 'chat', title: `${m.name} sent a message`, text: `${about}: “${clip(m.text)}”`, at: m.at, read, to };
  };
  return [
    ...a.chat.filter((m) => theirs.includes(m.from) && (m.text || m.request)).map(msg),
    ...a.history
      .filter((e) => theirs.includes(e.who) && !said.has(e.at))
      .map((e): Note => ({ id: `${a.id}-h${e.at}`, kind: 'system', title: e.text, text: `${about} · ${actor(e)}`, at: e.at, read: e.at <= mineSince, to })),
  ];
}
/** When a side last did something on the application: what came before it has been seen. */
const lastBy = (a: Application, mine: string[]) => Math.max(0, ...a.history.filter((e) => mine.includes(e.who)).map((e) => e.at), ...a.chat.filter((m) => mine.includes(m.from)).map((m) => m.at));

/**
 * The notifications for a role, built from its applications (HC53). RP: GSP's and the universities' side of each of
 * its applications, and the students its team added. GSP: the person's open My work tasks (`tasks`, `me` their staff
 * id), and the RPs' side of the applications they own (every application when no one is given).
 */
export function notesFor(
  role: 'rp' | 'gsp',
  o: { access: 'setup' | 'verifying' | 'all'; agency: string; apps: Application[]; students: Student[]; join?: { created?: number; sentAt?: number }; tasks?: NoteTask[]; me?: string; meName?: string; work?: Note[]; covering?: string[] },
): Note[] {
  if (o.access !== 'all') return onboardingNotes(o.access, o.join);
  const from = Date.now() - WINDOW;
  const stu = new Map(o.students.map((s) => [s.id, s]));
  const aboutOf = (a: Application) => {
    const s = stu.get(a.studentId);
    return `${s ? fullName(s) : a.studentId} · ${shortUni(courseOf(a).uni.name)}`;
  };
  const out: Note[] = [];
  if (role === 'rp') {
    for (const a of o.apps) out.push(...appNotes(a, ['gsp', 'uni'], aboutOf(a), (e) => e.by ?? (e.who === 'uni' ? shortUni(courseOf(a).uni.name) : 'GSP'), lastBy(a, ['you'])));
    for (const s of o.students)
      if (s.added >= from && s.addedBy && s.addedBy !== o.meName && !s.rp)
        out.push({ id: `stu-${s.id}`, kind: 'system', title: `${s.addedBy} added a student`, text: `${fullName(s)}${s.city ? `, from ${s.city}` : ''}.`, at: s.added, read: true, to: { student: s.id } });
  } else {
    // "the officer": the application's officer, or the queue's leader while the officer is on leave or deactivated (slice 4 PRD)
    const mine = o.me ? o.apps.filter((a) => a.officer === o.me || (o.covering ?? []).includes(a.id)) : o.apps;
    for (const a of mine) out.push(...appNotes(a, ['you'], `${a.rp ?? o.agency} · ${aboutOf(a)}`, (e) => (e.by && e.by !== 'You' ? e.by : a.rp ?? o.agency), lastBy(a, ['gsp', 'uni'])));
    // My work's notifications (slice 4 PRD, Tasks and SLAs), from the work store (work/store.ts workNotes)
    if (o.work) out.push(...o.work);
    else {
      const ids = new Set(o.apps.map((a) => a.id));
      for (const t of o.tasks ?? [])
        if (t.status === 'open' && o.me && t.assignee === o.me)
          out.push({ id: `task-${t.id}`, kind: 'system', title: t.title, text: 'My work: a task for you', at: t.created ?? Date.now(), to: t.record && ids.has(t.record) ? { app: t.record } : undefined });
    }
  }
  return out
    .filter((n) => n.at >= from && n.at <= Date.now() + 365 * DAY)
    .sort((x, y) => y.at - x.at);
}

/**
 * While connected (30 Oct): an application the other role changed, as the bottom-left notification. The same ids as
 * the bell's, so opening it marks the bell's one read.
 */
export function notesFromChange(role: 'rp' | 'gsp', before: Application | undefined, after: Application, c: { student: string; uni: string; agency: string }): Note[] {
  const theirs: string[] = role === 'rp' ? ['gsp', 'uni'] : ['you'];
  const about = `${c.student} · ${c.uni}`;
  if (!before) return [{ id: `${after.id}-new`, kind: 'system', title: role === 'rp' ? 'GSP started an application' : `New application from ${c.agency}`, text: about, at: after.created, to: { app: after.id } }];
  const had = new Set(before.chat.map((m) => m.id));
  const seen = new Set(before.history.map((e) => `${e.who}|${e.at}|${e.text}`));
  const diff: Application = { ...after, chat: after.chat.filter((m) => !had.has(m.id)), history: after.history.filter((e) => !seen.has(`${e.who}|${e.at}|${e.text}`)) };
  return appNotes(diff, theirs, about, (e) => e.by ?? (e.who === 'uni' ? c.uni : e.who === 'gsp' ? 'GSP' : c.agency), 0);
}

/** One announcement as the megaphone shows it: its category, the university it's about, and the words without formatting. */
export type Notice = { id: string; kind: string; tag: string; title: string; text: string; at: number; uni?: string; uniName?: string };

/**
 * The Institution Team's live announcements, for a role (30 Oct). RP Admin gets the ones sent to RPs, for its role
 * (RP admin), country and sales region, or for everyone; GSP's own teams see every live one.
 */
export function noticesFor(role: 'rp' | 'gsp', list: Announcement[], names: Record<string, string>, country = ''): Notice[] {
  const nameOf = (id: string) => names[id] ?? UNIVERSITIES.find((u) => u.id === id)?.name ?? id;
  const forMe = (a: Announcement) =>
    role === 'gsp' ||
    (a.userTypes.includes('RP') && (!a.roles.length || a.roles.includes('RP Admin')) && (!a.countries.length || a.countries.includes(country)) && (!a.regions.length || a.regions.includes(country) || a.regions.includes('Global')));
  return list
    .filter((a) => statusOf(a) === 'Live' && forMe(a))
    .map((a) => ({
      id: a.id,
      kind: a.category,
      tag: a.subcategory ? `${a.category} · ${a.subcategory}` : a.category,
      title: a.title,
      text: a.body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(),
      at: new Date(`${a.publish.slice(0, 10)}T09:00:00`).getTime(),
      uni: a.unis[0],
      uniName: a.unis.length > 1 ? `${a.unis.length} universities` : a.unis[0] ? nameOf(a.unis[0]) : 'GSP',
    }));
}
