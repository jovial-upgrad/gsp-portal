/**
 * The one upload rule (HC18, Jovial 1 Nov): every upload in the portal, the RP's, GSP's and the Institution Team's,
 * takes a PDF, JPG or PNG up to 20 MB. Forms, file pickers, drop zones and their hints all read this.
 */
export const UPLOAD = {
  maxMB: 20,
  exts: ['pdf', 'jpg', 'jpeg', 'png'],
  /** For a file input's accept. */
  accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  /** The rule in a line, for hints. */
  short: 'PDF, JPG or PNG · up to 20 MB',
  /** The types in words. */
  types: 'PDF, JPG or PNG',
};
export const UPLOAD_MAX_BYTES = UPLOAD.maxMB * 1024 * 1024;
/** A file name with an allowed type. */
export const OK_TYPES = new RegExp(`\\.(${UPLOAD.exts.join('|')})$`, 'i');
/** "1.2 MB", "380 KB" */
export const sizeText = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
/** What's wrong with a file, in a sentence that says what to do; '' when it's fine. */
export function uploadError(f: { name: string; size: number }) {
  if (!OK_TYPES.test(f.name)) return `${f.name} isn’t a ${UPLOAD.types}. Upload one of those.`;
  if (f.size === 0) return `${f.name} is empty. Choose another file.`;
  if (f.size > UPLOAD_MAX_BYTES) return `${f.name} is ${sizeText(f.size)}. Upload one up to ${UPLOAD.maxMB} MB.`;
  return '';
}
