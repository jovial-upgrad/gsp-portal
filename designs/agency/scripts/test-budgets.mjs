// Course search budgets in any currency (Jovial, 6 Nov): a budget with no currency is in the student's own
// (their country's), one with a code, name or symbol is in that, lakhs, crores, millions and billions are read, and it
// converts to the destination's currency at the search rates. Exits 1 on any failure.  node scripts/test-budgets.mjs
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.__glob = () => ({});
globalThis.window = globalThis.window ?? { addEventListener: () => {}, removeEventListener: () => {} };
const out = await build({
  stdin: { contents: "export { readBox, runSearch, newSearch, homeCurrency } from './src/screens/courses/search.ts'; export { searchConvert } from './src/admin/data/store.ts';", resolveDir: path.join(here, '..'), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', jsx: 'automatic', resolveExtensions: ['.ts', '.tsx', '.js', '.json'], define: { 'import.meta.glob': 'globalThis.__glob', 'import.meta.env.MODE': '"test"' },
  loader: { '.webp': 'empty', '.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.css': 'empty' },
});
const dir = path.join(here, '..', 'node_modules', '.cache');
mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'test-budgets.mjs');
writeFileSync(file, out.outputFiles[0].text);
const W = await import(pathToFileURL(file).href);
let pass = 0, fail = 0;
const ok = (what, got, exp) => { const g = JSON.stringify(got), e = JSON.stringify(exp); if (g === e) pass++; else { fail++; console.log(`FAIL ${what}: expected ${e} got ${g}`); } };
const near = (what, got, exp) => { if (got && Math.abs(got - exp) / exp < 0.02) pass++; else { fail++; console.log(`FAIL ${what}: expected ≈${exp} got ${got}`); } };

ok('India: rupee', W.homeCurrency({ country: 'India' }), 'INR');
ok('Bangladesh: taka', W.homeCurrency({ country: 'Bangladesh' }), 'BDT');
ok('Vietnam: dong', W.homeCurrency({ country: 'Vietnam' }), 'VND');
ok('Nigeria: naira', W.homeCurrency({ country: 'Nigeria' }), 'NGN');

const b = (t, prefer) => W.readBox(t, prefer).budget;
ok('25 lakhs', b('mba in uk under 25 lakhs'), { amount: 2500000, as: '25 lakh' });
ok('2 crore', b('under 2 crore'), { amount: 20000000, as: '2 crore' });
ok('500 million dong', b('below 500 million dong'), { amount: 500000000, cur: 'VND', as: 'VND 500 million' });
ok('£22k', b('mba uk under £22k', ['GBP']), { amount: 22000, cur: 'GBP', as: 'GBP 22,000' });
ok('30,000 usd', b('under 30,000 usd'), { amount: 30000, cur: 'USD', as: 'USD 30,000' });
ok('usd first', b('max usd 30000'), { amount: 30000, cur: 'USD', as: 'USD 30,000' });
ok('30 lakh taka', b('australia under 30 lakh taka'), { amount: 3000000, cur: 'BDT', as: 'BDT 30 lakh' });
ok('$ is the destination’s dollar', b('under $40k', ['AUD', 'INR']).cur, 'AUD');
ok('no budget', b('mba in uk'), undefined);
ok('the rest stays a search word', W.readBox('mba in uk under 25 lakhs').keyword, 'mba');

const run = (text, dest, country) => W.runSearch({ ...W.newSearch(country), text, need: { ...W.newSearch(country).need, dest } });
const r1 = run('mba under 25 lakhs', 'UK', 'India');
near('25 lakh INR in GBP', r1.filters.fee[1], W.searchConvert(2500000, 'INR', 'GBP'));
ok('said back in rupees', r1.filters.feeAs, 'INR 25 lakh');
const r2 = run('mba under 30 lakhs', 'Australia', 'Bangladesh');
near('30 lakh BDT in AUD', r2.filters.fee[1], W.searchConvert(3000000, 'BDT', 'AUD'));
ok('said back in taka', r2.filters.feeAs, 'BDT 30 lakh');
const r3 = run('mba under 20000', 'UK', 'Vietnam');
near('20000 with no currency: the student’s dong', r3.filters.fee[1] || 1, Math.max(1, W.searchConvert(20000, 'VND', 'GBP')));
const r4 = run('mba under 25000 gbp', 'UK', 'Nigeria');
ok('in the destination’s own currency', [r4.filters.fee[1], r4.filters.feeAs], [25000, undefined]);
const r5 = run('mba under 25 lakhs', '', 'India');
ok('no destination: not used', r5.filters.fee, null);
ok('no destination: says so', r5.understood.some((x) => /pick a destination/.test(x)), true);
const r6 = run('mba under 25 lakhs', 'UK', '');
ok('no student country: not used', r6.filters.fee, null);

console.log(`${pass} checks pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
