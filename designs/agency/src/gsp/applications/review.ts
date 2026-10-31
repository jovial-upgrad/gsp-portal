import { docLines, keptOnProfile, type Application, type Need } from '../../data/applications';
import type { DocStatus, Student } from '../../data/students';

/**
 * A document from the RP as GSP checks it: the latest file for each document the application asked for when it
 * was added (an upload to this application wins over the copy on the student's profile), then what the RP sent
 * outside that list, for GSP's requests.
 */
export type Review = {
  /** The document's key (its profile key where it has one), or `file:<file>` for one outside the application's list. */
  key: string;
  name: string;
  file: string;
  status: DocStatus;
  /** Where the decision is kept: on the student's profile, shared by their applications, or on this application. */
  on: 'profile' | 'application';
  at?: number;
  via?: 'chat' | 'request' | 'profile';
  need?: 'required' | 'optional' | 'later';
  /** GSP sent it back, and the RP has yet to send a new one. */
  back?: Need;
};

/** Keys kept on the student's profile, so a decision on one counts for every application. */
export const onProfile = keptOnProfile;

/** A need GSP made by sending a document back (the sample's "GSP check", or a rejection here). */
export const isSentBack = (n: Need) => /^(GSP check|Sent back)/.test(n.source ?? '');

export function reviewsOf(a: Application, s: Student): Review[] {
  const lines = docLines(a, s);
  const fromRp = a.files.filter((f) => f.from === 'you');
  const latest = (name: string) => fromRp.filter((f) => f.name === name).sort((x, y) => y.at - x.at)[0];
  const back = (key: string, name: string) => a.needs.find((n) => (n.id === key || n.title === name) && isSentBack(n));
  const out: Review[] = [];
  for (const l of lines) {
    const f = latest(l.name);
    const p = s.docs[l.key];
    if (f) out.push({ key: l.key, name: l.name, file: f.file, status: f.status, on: 'application', at: f.at, via: f.via, need: l.need, back: back(l.key, l.name) });
    else if (l.from === 'profile' && p) out.push({ key: l.key, name: l.name, file: p.file, status: p.status, on: 'profile', need: l.need, back: back(l.key, l.name) });
  }
  const seen = new Set(lines.map((l) => l.name));
  for (const f of [...fromRp].sort((x, y) => y.at - x.at)) {
    if (seen.has(f.name)) continue;
    seen.add(f.name);
    out.push({ key: `file:${f.file}`, name: f.name, file: f.file, status: f.status, on: 'application', at: f.at, via: f.via, back: back(`file:${f.file}`, f.name) });
  }
  return out;
}

/** Waiting for GSP: sent to GSP (or on the profile unchecked, once the application is with GSP), and not sent back. */
export const toReview = (r: Review, a: Application) => !r.back && (r.status === 'checking' || (r.status === 'uploaded' && a.status !== 'docs'));

/** Reasons GSP most often sends a document back, to start the explanation from. */
export const REJECT_REASONS = ['Blurred or hard to read', 'Pages are missing', 'It’s the wrong document', 'The name doesn’t match the passport', 'It has expired'];
