// The sandbox's scenario cases (ref-ours, sandbox-tier-split 614708d: src/finance/scenarioCases.ts, copied verbatim to
// src/proto/scenarios/cases.ts) run against the prototype's engine (Jovial, 10 Nov: parity with the sandbox Finance signed off).
// Each case's small world (university terms, RPs, agreements, notices, groups, students, what was paid) is translated
// into the prototype's records; every expected value is the sandbox's own, worked out by hand. Cases and checks whose
// rule the 10 Nov decisions changed are skipped, each with its reason (SKIP and SKIP_CHECK below).
//   cd designs/agency && node tests/unit/scenarios.mjs
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });

let pass = 0, fail = 0, skipped = 0;
const lines = [];
try {
  // the translation lives with the Prototype panel's scenarios (src/proto/scenarios/run.ts), so both read one copy
  const run = await vite.ssrLoadModule('/src/proto/scenarios/run.ts');
  for (const c of run.SCENARIOS) {
    const R = run.runChecks(c);
    if (R.skipped) {
      skipped++;
      lines.push(`SKIP ${c.id} ${c.title.trim()}: ${R.skipped}`);
      continue;
    }
    let caseOk = true, caseSkips = 0;
    const out = [];
    for (const k of R.checks) {
      if (k.skip) { caseSkips++; out.push(`    skip  ${k.what}: ${k.skip}`); continue; }
      if (!k.ok) caseOk = false;
      out.push(`    ${k.ok ? 'pass' : 'FAIL'}  ${k.what}: expected ${JSON.stringify(k.exp)}${k.ok ? '' : `, got ${JSON.stringify(k.got)}`}`);
    }
    caseOk ? pass++ : fail++;
    lines.push(`${caseOk ? 'PASS' : 'FAIL'} ${c.id} ${c.title.trim()}${caseSkips ? ` (${caseSkips} check${caseSkips === 1 ? '' : 's'} skipped)` : ''}`);
    if (!caseOk || process.argv.includes('-v')) lines.push(...out);
  }
} finally {
  await vite.close();
}
console.log(lines.join('\n'));
console.log(`${pass} cases passed, ${fail} failed, ${skipped} skipped`);
process.exit(fail ? 1 : 0);
