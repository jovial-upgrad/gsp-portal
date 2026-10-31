/** Review states for Applications, for an agency GSP has verified, with its sample students. */
import { sampleStudents, type Student } from '../../data/students';
import { sampleApplications, type Application } from '../../data/applications';
import type { AppsStart } from './Applications';

type Make = (me: string) => { students: Student[]; apps: Application[]; app?: Omit<AppsStart, 'key'> };
const all = (me: string, app?: Omit<AppsStart, 'key'>) => ({ students: sampleStudents(me), apps: sampleApplications(), app: app ?? {} });

/** Sneha's Coventry application, at its happy end. */
const enrolled = (x: ReturnType<typeof all>) => ({ ...x, apps: x.apps.map((a) => (a.id === 'GSP-24063' ? { ...a, status: 'enrolled' as const, since: Date.now(), needs: [] } : a)) });

export const APP_PRESETS: Record<string, { label: string; make: Make }> = {
  'applications-empty': { label: 'No applications yet', make: (me) => ({ students: sampleStudents(me), apps: [], app: {} }) },
  applications: { label: '9 applications, 4 pending on you', make: (me) => all(me) },
  'application-offer': { label: 'Offer: send the conditions', make: (me) => all(me, { open: 'GSP-24102' }) },
  'application-late': { label: 'With the university, late', make: (me) => all(me, { open: 'GSP-24097' }) },
  'application-reupload': { label: 'Sent back: upload again', make: (me) => all(me, { open: 'GSP-24061' }) },
  'application-request': { label: 'GSP asked for a document', make: (me) => all(me, { open: 'GSP-24055', tab: 'chat' }) },
  'application-documents': { label: 'Documents: pending and from GSP', make: (me) => all(me, { open: 'GSP-24055', tab: 'documents' }) },
  'application-visa': { label: 'Visa lodgement: yours, or ask GSP', make: (me) => all(me, { open: 'GSP-23710' }) },
  'application-chat': { label: 'Chat with GSP', make: (me) => all(me, { open: 'GSP-24102', tab: 'chat' }) },
  'application-enrolled': { label: 'Enrolled: the student has started', make: (me) => enrolled(all(me, { open: 'GSP-24063' })) },
  'application-mail-doc': { label: 'Awaiting the CAS (in GSP Team, it came by mail)', make: (me) => all(me, { open: 'GSP-24063' }) },
  'application-new': { label: 'Add an application', make: (me) => all(me, { add: true }) },
  'application-new-check': { label: 'Add: eligibility checked', make: (me) => all(me, { add: { studentId: 'S-24811', courseId: 'canberra-9', intake: 'Feb 2027' } }) },
  'application-new-miss': { label: 'Add: not eligible, close courses', make: (me) => all(me, { add: { studentId: 'S-24796', courseId: 'herts-1', intake: 'Jan 2027' } }) },
};
