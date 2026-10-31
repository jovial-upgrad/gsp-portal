/**
 * The download log (Jovial, 31 Oct): every CSV downloaded from anywhere in the portal is logged in GSP · Admin ›
 * Logs, with who, their role, the page and how many rows. Each portal says who's signed in (`setSession`); any
 * download of a .csv file is caught where the browser saves it, so a new export anywhere is logged without its own
 * code. In the real build the server logs each export it serves.
 */
import { setAdminCfg } from '../admin/data/store';

let session = { name: '', role: '' };
/** Who's signed in, for the log. Each portal calls this as it opens. */
export const setSession = (name: string, role: string) => {
  session = { name, role };
};

function areaNow() {
  const h = document.querySelector('main h1')?.textContent?.trim();
  return h || document.title || 'Portal';
}
function filtersNow() {
  const on = [...document.querySelectorAll('main [aria-pressed="true"], main .is-on, main select')]
    .map((x) => (x instanceof HTMLSelectElement ? (x.value && x.selectedIndex > 0 ? x.selectedOptions[0]?.textContent?.trim() : '') : x.textContent?.trim()))
    .filter((x): x is string => !!x && x.length < 40);
  return on.slice(0, 4).join(' · ') || 'None';
}

export function logDownload(file: string, rows: number, area = areaNow(), filters = filtersNow()) {
  const at = Date.now();
  setAdminCfg((c) => ({
    ...c,
    log: [{ id: `dl${at}`, at, who: session.name || 'Someone', role: session.role || '', area, text: file, kind: 'download', filters, size: `${rows.toLocaleString('en-GB')} rows`, format: 'CSV' }, ...c.log],
  }));
}

let installed = false;
/** Catch every .csv download in this window. */
export function installDownloadLog() {
  if (installed || typeof HTMLAnchorElement === 'undefined') return;
  installed = true;
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    const file = this.download;
    if (file && /\.csv$/i.test(file)) {
      const area = areaNow();
      const filters = filtersNow();
      fetch(this.href)
        .then((r) => r.text())
        .then((t) => logDownload(file, Math.max(0, t.trim().split('\n').length - 1), area, filters))
        .catch(() => logDownload(file, 0, area, filters));
    }
    return click.call(this);
  };
}
