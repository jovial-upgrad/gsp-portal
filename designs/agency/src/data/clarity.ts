/**
 * The clarity check (slice 3 PRD, BR-50; brief, 2 Nov): every RP upload (Add a student's bulk upload, Add an
 * application, Documents, a request card) is read before it's accepted and gets a clarity score from 0 to 100%.
 *
 * - At or above the pass mark (CLARITY.min, 80%): accepted, and sorted into its document type; one that can't be placed
 *   is kept in Additional documents under its file name.
 * - Below it: "The attached document is not clear.", the file isn't kept, and the RP uploads it again. Send to GSP
 *   stays off while any required document is below the mark or not uploaded. There is no "Keep it".
 *
 * The pass mark is a pre-decided value (like Sign-in security, S1C-11): one source, read here and nowhere else.
 */
export const CLARITY = Object.freeze({ min: 80, unclear: 'The attached document is not clear.' });

/**
 * PROTOTYPE ONLY: the one place the score is simulated. The build reads the page (OCR and image quality) and returns
 * the score; this stand-in reads the file name, so a reviewer can try both sides: a name with "blur", "dark",
 * "unclear", "photo_<n>" or "whatsapp" scores below the mark; anything else scores at or above it. The score is
 * stable for a name, so the same file always reads the same way.
 */
export function simulateClarityScore(file: string): number {
  const h = [...file.toLowerCase()].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
  if (/blur|dark|unclear|photo_?\d|whatsapp/i.test(file)) return 40 + (h % 35); // 40–74
  return CLARITY.min + 5 + (h % (100 - CLARITY.min - 4)); // 85–100
}

/** The clarity score of an upload (0–100). The build replaces the simulation; nothing else changes. */
export const clarityOf = (file: string) => simulateClarityScore(file);
/** Whether an upload is clear enough to keep (BR-50). */
export const isClear = (file: string) => clarityOf(file) >= CLARITY.min;
