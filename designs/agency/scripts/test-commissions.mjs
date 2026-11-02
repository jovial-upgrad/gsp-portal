// Runs every commission scenario (the commissions team's sheet, IP1–IP19 and RP1–RP7, plus the combination cases)
// against the engine, with the hand-worked expected values in src/finance/scenarioCases.ts. Exits 1 on any mismatch.
//   node scripts/test-commissions.mjs            (from designs/agency)
//   node scripts/test-commissions.mjs --verbose  (every check, not just failures)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = await build({
  stdin: { contents: "export * from './src/finance/engine.ts'; export { SCENARIOS, runAll } from './src/finance/scenarioCases.ts';", resolveDir: path.join(here, '..'), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error',
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const verbose = process.argv.includes('--verbose');
const results = mod.runAll(mod.compute, mod.buildRun);
let pass = 0, fail = 0, casesOk = 0;
for (const r of results) {
  if (r.ok) casesOk++;
  for (const c of r.checks) {
    c.ok ? pass++ : fail++;
    if (!c.ok || verbose) console.log((c.ok ? 'PASS ' : 'FAIL ') + r.id.padEnd(5) + ' ' + c.what + (c.calc ? '  [' + c.calc + ']' : '') + '  expected ' + JSON.stringify(c.exp) + ' got ' + JSON.stringify(c.got) + (c.today ? '  (on ' + c.today + ')' : ''));
  }
}
console.log(`\n${casesOk}/${results.length} scenarios pass · ${pass} checks pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
