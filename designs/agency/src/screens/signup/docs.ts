/** Business documents after sign-up: what each slot holds, the file rules, and when the set is complete. */
import { businessDocsFor, type DocNeed } from '../../data/partners';

export type DocFile = { name: string; size: number; type: string };

export type SlotStatus =
  | 'empty'
  | 'uploading'
  | 'uploaded'
  | 'error' // our own check failed: wrong format, too big, empty
  | 'checking' // with GSP
  | 'accepted' // GSP checked it
  | 'sent-back'; // GSP needs a new file

export type DocSlot = { status: SlotStatus; file?: DocFile; error?: string | null; reason?: string };

/** Said before anyone uploads anything, and again on each drop zone. */
export const FILE_RULES = { maxMB: 20, exts: ['pdf', 'jpg', 'jpeg', 'png'], accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png' };
export const RULES_SHORT = 'PDF, JPG or PNG · up to 20 MB';

export function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Plain messages that say what to do. */
export function checkFile(f: DocFile): string | null {
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  if (!FILE_RULES.exts.includes(ext)) return `“${f.name}” is a .${ext || 'unknown'} file. Upload a PDF, JPG or PNG.`;
  if (f.size === 0) return 'This file is empty. Choose another one.';
  if (f.size > FILE_RULES.maxMB * 1024 * 1024) return `This file is ${fmtSize(f.size)}. Upload one under ${FILE_RULES.maxMB} MB, or a clear photo instead of a scan.`;
  return null;
}

export const docsFor = (country: string): DocNeed[] => businessDocsFor(country);

/** Every required document has a file that's in (or already accepted). Optional ones never hold anyone up. */
export function missingRequired(docs: DocNeed[], slots: Record<string, DocSlot>) {
  return docs.filter((d) => !d.optional && !['uploaded', 'checking', 'accepted'].includes(slots[d.name]?.status ?? 'empty'));
}

/** A document's name inside a sentence: "your PAN card", "your business registration certificate". */
export const inSentence = (name: string) => (/^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

export const slotOf = (slots: Record<string, DocSlot>, name: string): DocSlot => slots[name] ?? { status: 'empty' };

/** Documents GSP sent back this round (they keep GSP's reason until the new file goes to GSP). */
export const returnedDocs = (docs: DocNeed[], slots: Record<string, DocSlot>) => docs.filter((d) => !!slots[d.name]?.reason);

/** Sent-back documents that don't have a new file in yet. */
export const stillToReplace = (docs: DocNeed[], slots: Record<string, DocSlot>) =>
  docs.filter((d) => slots[d.name]?.reason && !['uploaded', 'checking', 'accepted'].includes(slots[d.name].status));

/** Sample files for review states. */
export const SAMPLE_FILES: Record<string, DocFile> = {
  'Business registration certificate': { name: 'BrightPath-registration-certificate.pdf', size: 1_240_000, type: 'application/pdf' },
  'PAN card': { name: 'PAN-card.jpg', size: 820_000, type: 'image/jpeg' },
  'GST certificate': { name: 'GST-certificate.pdf', size: 640_000, type: 'application/pdf' },
};
