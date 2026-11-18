/**
 * Downloads in the published prototype (Suman, 18 Nov: "Export CSV doesn't work"). A claude.ai artifact can't start a
 * browser download itself; it offers the file through its `downloads` capability, and the viewer confirms. Every page
 * of the prototype downloads the same way (a link with `download` on a file it made), so this one place hands those
 * files to the capability when it's there, and leaves the browser's own download everywhere else (local runs, tests).
 */
type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };
type ClaudeHost = { use?: (name: string) => Promise<Downloads | null> };

let ready: Promise<Downloads | null> | null = null;
const host = () => (window as unknown as { claude?: ClaudeHost }).claude;
const downloads = () => (ready ??= host()?.use ? host()!.use!('downloads').catch(() => null) : Promise.resolve(null));

const click = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  const name = this.getAttribute('download');
  const href = this.href;
  if (name === null || !href.startsWith('blob:') || !host()?.use) return click.call(this);
  void (async () => {
    const d = await downloads();
    if (!d) return click.call(this);
    try {
      const blob = await (await fetch(href)).blob();
      await d.save({ filename: name || 'download', data: blob });
    } catch {
      // the viewer declined, or saves aren't possible in this view: nothing else to do
    }
  })();
};

// the pages free a file's link as soon as they've clicked it; give the capability time to read it first
const revoke = URL.revokeObjectURL.bind(URL);
URL.revokeObjectURL = (url: string) => void setTimeout(() => revoke(url), 60_000);
