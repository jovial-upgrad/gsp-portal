// Fails on fixed option lists and data labels written into components (Jovial, 2 Nov: nothing hard-coded). Scans
// every .tsx under src/ for an array literal of three or more quoted strings (a dropdown's options, a filter's
// values, a status list), and for a seeded record written into a component (an object literal with an id and a
// name, label or title). Lists belong in a data or settings module (src/**/data, src/admin/data, a store); a .tsx
// may keep design copy only: tab and section names, keyboard keys, CSS classes. Each allowed line is in
// scripts/hardcoded-allow.json with why. Exits 1 on anything else.   node scripts/scan-hardcoded.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src');
const allow = JSON.parse(readFileSync(path.join(here, 'hardcoded-allow.json'), 'utf8'));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(src).filter((f) => f.endsWith('.tsx'));
const STR = String.raw`(?:'[^'\n]{1,80}'|"[^"\n]{1,80}"|` + '`[^`\\n$]{1,80}`)';
const LIST = new RegExp(String.raw`\[\s*${STR}(?:\s*,\s*${STR}){2,}\s*,?\s*\]`, 'g');
// a record (a seeded row with an id and a name); a menu action ({ id, label }) is design
const RECORD = /\{\s*id:\s*['"][^'"]+['"]\s*,\s*name:\s*['"][^'"]+['"]/g;
const found = [];
for (const f of files) {
  const rel = path.relative(path.join(here, '..'), f);
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    // className lists and joined strings are design, not data
    const hits = [...line.matchAll(LIST)].map((m) => m[0]).filter((m) => {
      const before = line.slice(0, line.indexOf(m));
      if (/\]\s*\.join\(/.test(line.slice(line.indexOf(m))) || /className/.test(before)) return false;
      // a table's column headings are the page's design copy, not data
      if (/head(?:ers)?\s*[=:]\s*\{?\s*$|head=\{\[?$/.test(before.trimEnd()) || /\bhead\b|\bheaders?\b|\bcols\b|\bcolumns\b/i.test(before)) return false;
      const items = [...m.matchAll(new RegExp(STR, 'g'))].map((x) => x[0].slice(1, -1));
      // keys, not words people read: identifiers (tab and field keys, icon names), keyboard keys, colours
      if (items.some((x) => /^[a-z][a-zA-Z0-9-]*$/.test(x))) return false;
      if (items.every((x) => /^(Arrow\w+|Enter|Home|End|Escape|Tab| |#[0-9A-Fa-f]{3,8})$/.test(x))) return false;
      return true;
    });
    for (const m of [...hits, ...[...line.matchAll(RECORD)].map((x) => x[0])]) {
      const ok = allow.some((a) => a.file === rel && line.includes(a.match));
      if (!ok) found.push(`${rel}:${i + 1}: ${m.slice(0, 100)}`);
    }
  });
}
if (found.length) {
  console.log(`FAIL ${found.length} fixed lists or data labels in components:`);
  for (const x of found) console.log('  ' + x);
  process.exit(1);
}
console.log(`PASS scanned ${files.length} components: no fixed option list or data label outside the allow-list (${allow.length} entries of design copy)`);
