// Builds the standalone Commissions Sandbox (one self-contained HTML file) with THE portal's engine:
// src/finance/engine.ts and src/finance/scenarioCases.ts are bundled to plain JS and inlined, so the sandbox, the portal
// and the scenario test never drift.
//   node scripts/build-sandbox.mjs [out.html]     (default dist-sandbox/commissions-sandbox.html)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist-sandbox/commissions-sandbox.html'));
const eng = await build({
  stdin: { contents: "export * from './src/finance/engine.ts'; export { SCENARIOS, SCEN_SETTINGS, runAll, runScenario } from './src/finance/scenarioCases.ts';", resolveDir: root, loader: 'ts' },
  bundle: true, format: 'iife', globalName: 'GSPE', platform: 'browser', target: 'es2019', write: false, logLevel: 'error', legalComments: 'none',
});
const js = eng.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const baseline = JSON.stringify(JSON.parse(readFileSync(path.join(root, 'sandbox/baseline.json'), 'utf8')));
let html = readFileSync(path.join(root, 'sandbox/sandbox.src.html'), 'utf8');
if (!html.includes('/*@@ENGINE@@*/') || !html.includes('/*@@BASELINE@@*/')) throw new Error('sandbox.src.html is missing a marker');
html = html.replace('/*@@BASELINE@@*/', () => 'const BASELINE=' + baseline.replace(/<\/script/gi, '<\\/script') + ';').replace('/*@@ENGINE@@*/', () => '/* Engine: generated from src/finance/engine.ts and src/finance/scenarioCases.ts by scripts/build-sandbox.mjs. Do not edit here. */\n' + js);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log('Sandbox written to ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
