import { gspContact } from './applications';
import { UNIVERSITIES } from './courses';
import type { Application } from './applications';
import { statusOf, type Announcement } from '../institution/data/announcements';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The bell and the megaphone at the top right of the portal (Nesil, 30 Oct; every role).
 * **Notifications** are about the portal's own work: what the system did (a status, a document sent back), messages
 * in an application's chat, and emails sent or received; sample ones, and real ones from the other role while
 * connected. **Announcements** are in the model GSP's Institution Team publishes them in (its sample data; what that
 * team changes stays in its role).
 */

export type NoteKind = 'system' | 'chat' | 'mail';
export const NOTE_KINDS: [NoteKind, string][] = [
  ['system', 'System'],
  ['chat', 'Chat'],
  ['mail', 'Mail'],
];
/** Where a notification takes you: an application, a student's record, or a page. */
export type NoteTarget = { app: string } | { student: string } | { page: 'home' | 'earnings' | 'profile' };
export type Note = { id: string; kind: NoteKind; title: string; text: string; at: number; read?: boolean; to?: NoteTarget };

const ago = (d: number, h = 0) => Date.now() - d * DAY - h * HOUR;

/** Still registering, or with GSP for verification: what the portal has said so far. */
function onboardingNotes(access: 'setup' | 'verifying'): Note[] {
  return access === 'setup'
    ? [
        { id: 'n-ob-email', kind: 'mail', title: 'Email address verified', text: 'Your account is ready. Add the business details and documents to send to GSP.', at: ago(0, 0.2), to: { page: 'home' } },
        { id: 'n-ob-hello', kind: 'system', title: 'Welcome to the GSP Partner Portal', text: 'Finish registering to open course search and your profile.', at: ago(0, 0.25), read: true, to: { page: 'home' } },
      ]
    : [
        { id: 'n-ob-sent', kind: 'system', title: 'GSP is verifying your documents', text: 'Usually within 1 working day. You’ll get an email too.', at: ago(0, 0.1), to: { page: 'home' } },
        { id: 'n-ob-mail', kind: 'mail', title: 'Email sent to you', text: 'A copy of what you sent GSP, for your records.', at: ago(0, 0.1), to: { page: 'home' } },
        { id: 'n-ob-email', kind: 'mail', title: 'Email address verified', text: 'Your account is ready.', at: ago(0, 1), read: true },
      ];
}

/** RP Admin's notifications: GSP's messages and requests, statuses, and the emails the system sent. */
function rpNotes(agency: string): Note[] {
  return [
    { id: 'n-rp-1', kind: 'chat', title: `${gspContact('Australia').name} sent a message`, text: 'Priya Raman · Deakin: “The offer has 3 conditions. Answer them in the form by the date and send it.”', at: ago(0, 0.4), to: { app: 'GSP-24102' } },
    { id: 'n-rp-2', kind: 'system', title: 'GSP asked for a document', text: 'Sneha Patil · Flinders: Gap explanation document, due in 3 days.', at: ago(0, 0.3), to: { app: 'GSP-24055' } },
    { id: 'n-rp-3', kind: 'system', title: 'Document sent back', text: 'Sneha Patil · Newcastle: GSP couldn’t read the passport scan. Upload it again.', at: ago(0, 3), to: { app: 'GSP-24061' } },
    { id: 'n-rp-4', kind: 'mail', title: 'Email sent to Priya Raman', text: 'Her conditional offer from Deakin, with what happens next. You were copied in.', at: ago(1, 2), to: { app: 'GSP-24102' } },
    { id: 'n-rp-5', kind: 'chat', title: `${gspContact('Australia').name} sent a message`, text: 'Priya Raman · Wollongong: “Wollongong is taking a little longer than usual this month. I reminded them today.”', at: ago(0, 4), read: true, to: { app: 'GSP-24097' } },
    { id: 'n-rp-6', kind: 'system', title: 'Conditional offer from Deakin', text: 'Priya Raman · Deakin University: accept within 19 days.', at: ago(1, 3), read: true, to: { app: 'GSP-24102' } },
    { id: 'n-rp-7', kind: 'system', title: 'Visa application lodged', text: 'Fatima Sheikh · RMIT: GSP lodged it with the Department of Home Affairs.', at: ago(2), read: true, to: { app: 'GSP-23710' } },
    { id: 'n-rp-8', kind: 'mail', title: 'October commission statement', text: `Sent to ${agency}’s accounts email.`, at: ago(3), read: true, to: { page: 'earnings' } },
    { id: 'n-rp-9', kind: 'system', title: 'Divya Shetty added a student', text: 'Mohammed Irfan, from Bengaluru.', at: ago(3, 5), read: true, to: { student: 'S-24818' } },
  ];
}

/** GSP Team's notifications: the agencies' uploads and replies, and universities' emails. */
function gspNotes(agency: string): Note[] {
  return [
    { id: 'n-g-1', kind: 'chat', title: 'Karthik Nair replied', text: `${agency} · Priya Raman · Deakin: “Thanks ${gspContact('Australia').first}, Priya will answer the conditions today.”`, at: ago(0, 0.3), to: { app: 'GSP-24102' } },
    { id: 'n-g-2', kind: 'mail', title: 'Email from Deakin University', text: 'Conditional offer for Priya Raman (DKN-2611407). Filed in the application.', at: ago(0, 1), to: { app: 'GSP-24102' } },
    { id: 'n-g-3', kind: 'system', title: 'New application to check', text: `${agency} · Sneha Patil · Flinders University.`, at: ago(0, 1), to: { app: 'GSP-24055' } },
    { id: 'n-g-4', kind: 'system', title: 'Documents ready to check', text: `${agency} uploaded 2 documents for Rohan Gupta · Northumbria.`, at: ago(0, 2), to: { app: 'GSP-23944' } },
    { id: 'n-g-5', kind: 'mail', title: 'Email from University of Wollongong', text: 'Decision update for UOW-5508812, Priya Raman.', at: ago(0, 5), read: true, to: { app: 'GSP-24097' } },
    { id: 'n-g-6', kind: 'system', title: 'Census date in 5 days', text: 'Fatima Sheikh · RMIT: confirm she has enrolled.', at: ago(1), read: true, to: { app: 'GSP-23710' } },
    { id: 'n-g-7', kind: 'chat', title: 'Divya Shetty sent a message', text: `${agency} · Sneha Patil · Coventry: “Has Coventry said when the decision is due?”`, at: ago(2, 3), read: true, to: { app: 'GSP-24063' } },
  ];
}

/**
 * The notifications for a role and the account's state. Ones about an application or a student the portal doesn't
 * have (a new agency with none yet) are left out; a just-verified agency hears that first.
 */
export function notesFor(role: 'rp' | 'gsp', o: { access: 'setup' | 'verifying' | 'all'; agency: string; apps: string[]; students: string[] }): Note[] {
  if (o.access !== 'all') return onboardingNotes(o.access);
  const all = role === 'rp' ? rpNotes(o.agency) : gspNotes(o.agency);
  const kept = all.filter((n) => !n.to || ('app' in n.to ? o.apps.includes(n.to.app) : 'student' in n.to ? o.students.includes(n.to.student) : true));
  return [...kept, { id: 'n-verified', kind: 'system', title: `GSP verified ${o.agency}`, text: 'Students, applications and earnings are open.', at: ago(5), read: true, to: { page: 'home' } }];
}

/**
 * Real notifications (30 Oct): an application the other role changed while connected, turned into what happened.
 * Its new chat messages from the other side (a university's email placed in the chat counts as Mail), then its new
 * activity from the other side (a status, a request, an upload, a verified document), leaving out activity the
 * messages already say. An application the other role started is one notification.
 */
export function notesFromChange(role: 'rp' | 'gsp', before: Application | undefined, after: Application, c: { student: string; uni: string; agency: string }): Note[] {
  const theirs: string[] = role === 'rp' ? ['gsp', 'uni'] : ['you'];
  const about = `${c.student} · ${c.uni}`;
  const to = { app: after.id };
  if (!before)
    return [{ id: `live-${after.id}-new`, kind: 'system', title: role === 'rp' ? 'GSP started an application' : `New application from ${c.agency}`, text: about, at: after.created, to }];
  const had = new Set(before.chat.map((m) => m.id));
  const msgs = after.chat.filter((m) => !had.has(m.id) && theirs.includes(m.from));
  const seen = new Set(before.history.map((e) => `${e.who}|${e.text}`));
  const said = new Set(msgs.map((m) => m.at));
  const acts = after.history.filter((e) => theirs.includes(e.who) && !seen.has(`${e.who}|${e.text}`) && !said.has(e.at));
  const clip = (s: string) => (s.length > 110 ? `${s.slice(0, 107).trimEnd()}…` : s);
  const actor = (by: string | undefined, who: string) => by ?? (who === 'uni' ? c.uni : who === 'gsp' ? 'GSP' : c.agency);
  const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
  return [
    ...msgs.map(
      (m, i): Note =>
        m.via === 'email'
          ? { id: `live-${after.id}-${m.id}`, kind: 'mail', title: `Email from ${m.name}`, text: `${about}: “${clip(m.text)}”`, at: m.at + i, to }
          : { id: `live-${after.id}-${m.id}`, kind: 'chat', title: `${m.name} sent a message`, text: `${about}: “${clip(m.text)}”`, at: m.at + i, to },
    ),
    ...acts.map((e, i): Note => ({ id: `live-${after.id}-${e.at}-${i}`, kind: 'system', title: `${actor(e.by, e.who)} ${lower(e.text)}`, text: about, at: e.at + i, to })),
  ];
}

/** One announcement as the megaphone shows it: its category, the university it's about, and the words without formatting. */
export type Notice = { id: string; kind: string; tag: string; title: string; text: string; at: number; uni?: string; uniName?: string };

/**
 * The Institution Team's live announcements, for a role (30 Oct). RP Admin gets the ones sent to RPs, for its role
 * (RP admin), country and sales region, or for everyone; GSP's own teams see every live one.
 */
export function noticesFor(role: 'rp' | 'gsp', list: Announcement[], names: Record<string, string>, country = 'India'): Notice[] {
  const nameOf = (id: string) => names[id] ?? UNIVERSITIES.find((u) => u.id === id)?.name ?? id;
  const forMe = (a: Announcement) =>
    role === 'gsp' ||
    (a.userTypes.includes('RP') && (!a.roles.length || a.roles.includes('RP admin')) && (!a.countries.length || a.countries.includes(country)) && (!a.regions.length || a.regions.includes(country) || a.regions.includes('Global')));
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
