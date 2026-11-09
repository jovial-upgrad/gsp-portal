// Turns the single-file build into the shared page: dist-artifact/gsp-partner-portal.html.
//
// It has to open however it's opened: downloaded and double-clicked, previewed in an app, or published
// as a claude.ai artifact (where the host adds <!doctype>, <html>, <head> and <body> itself). So:
// - the charset comes first, so a browser opening the file on its own reads it as UTF-8;
// - the <title> sits in the first 8 KB;
// - the stylesheet and the code are gzipped and base64'd, then unpacked in the browser on load. The page
//   stays well under 1 MB, and the code is plain ASCII, so no text encoding can break it.
import fs from 'node:fs';
import zlib from 'node:zlib';

const src = 'dist-artifact/index.html';
const out = 'dist-artifact/gsp-partner-portal.html';
const html = fs.readFileSync(src, 'utf8');

// The code itself may hold HTML text (a printable invoice has its own <head> and <style>), so find the module
// script by position first, and read the real head and style only around it.
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const sOpen = html.indexOf('<script type="module"');
const sBody = html.indexOf('>', sOpen) + 1;
const sClose = html.indexOf('</script>', sBody);
const script = sOpen < 0 ? null : [html.slice(sOpen, sClose + 9), html.slice(sBody, sClose)];
const headEnd = html.indexOf('</head>', sClose);
const head = html.slice(html.indexOf('<head>') + 6, headEnd);
const style = html.slice(sClose + 9, headEnd).match(/<style[^>]*>([\s\S]*?)<\/style>/) ?? head.slice(0, sOpen - html.indexOf('<head>') - 6).match(/<style[^>]*>([\s\S]*?)<\/style>/);
const body = html.slice(html.indexOf('<body>', headEnd) + 6, html.lastIndexOf('</body>'));
if (!script || !style) throw new Error('Expected one inline module script and one inline style in the single-file build.');

const pack = (text) => zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).toString('base64');

const headRest = head
  .replace(title, '')
  .replace(script[0], '')
  .replace(style[0], '')
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>/i, '');

// unpacks the stylesheet, then the code, and runs it as the module it was built as
const boot = `<script>
(function () {
  function unzip(id) {
    var bin = atob(document.getElementById(id).textContent.trim());
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  function fail() {
    var root = document.getElementById('root');
    if (root) root.innerHTML = '<p style="font:16px/1.5 system-ui,sans-serif;padding:24px;max-width:40ch">This prototype needs an up-to-date browser: Chrome, Edge, Firefox or Safari 16.4 or later.</p>';
  }
  // an error before the app draws anything leaves the page empty: say so, with the message to pass on
  window.addEventListener('error', function (e) {
    setTimeout(function () {
      var root = document.getElementById('root');
      if (!root || root.children.length) return;
      var msg = String((e && (e.message || e.error)) || 'Unknown error').replace(/[<&]/g, function (c) { return c === '<' ? '&lt;' : '&amp;'; });
      root.innerHTML = '<div style="font:16px/1.5 system-ui,sans-serif;padding:24px;max-width:60ch"><p><strong>The prototype did not start.</strong> Send Claude this message, then reload the page.</p><pre style="white-space:pre-wrap;font-size:12px;background:#eef0f4;padding:12px;border-radius:8px">' + msg + '</pre></div>';
    }, 0);
  });
  if (typeof DecompressionStream === 'undefined') return fail();
  Promise.all([unzip('gsp-css'), unzip('gsp-js')]).then(function (r) {
    var st = document.createElement('style');
    st.textContent = r[0];
    document.head.appendChild(st);
    var sc = document.createElement('script');
    sc.type = 'module';
    sc.textContent = r[1];
    document.body.appendChild(sc);
  }, fail);
})();
</script>`;

const page = [
  '<meta charset="utf-8">',
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  headRest.trim(),
  body.trim(),
  `<script type="application/octet-stream" id="gsp-css">${pack(style[1])}</script>`,
  `<script type="application/octet-stream" id="gsp-js">${pack(script[1])}</script>`,
  boot,
].join('\n');

const nonAscii = [...page].filter((c) => c.charCodeAt(0) > 127).length;
fs.writeFileSync(out, page);
console.log(`${out}: ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB${nonAscii ? `, ${nonAscii} non-ASCII characters outside the code` : ', all ASCII'}`);
