// Grade conversion, English test equivalence and the eligibility check for every market (Jovial, 6 Nov): one common
// standard, other grade names, lower-is-better systems, best English result, off-table and can't-compare cases go to
// GSP to confirm. Exits 1 on any failure.  node scripts/test-eligibility.mjs
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.__glob = () => ({});
globalThis.window = globalThis.window ?? { addEventListener: () => {}, removeEventListener: () => {} };
const out = await build({
  stdin: { contents: "export * as F from './src/finance/store.ts'; export * as WS from './src/work/store.ts'; export { toPct, systemOf } from './src/admin/data/eligibility.ts'; export { eligibility, convertScore } from './src/data/eligibility.ts'; export { scoreOk, pctOf } from './src/data/students.ts';", resolveDir: path.join(here, '..'), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', jsx: 'automatic', resolveExtensions: ['.ts', '.tsx', '.js', '.json'], define: { 'import.meta.glob': 'globalThis.__glob', 'import.meta.env.MODE': '"test"' },
  loader: { '.webp': 'empty', '.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.css': 'empty' },
});
const dir = path.join(here, '..', 'node_modules', '.cache'); mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'test-elig.mjs'); writeFileSync(file, out.outputFiles[0].text);
const W = await import(pathToFileURL(file).href);

let pass = 0, fail = 0;
const ok = (what, got, exp) => { const g = JSON.stringify(got), e = JSON.stringify(exp); if (g === e) pass++; else { fail++; console.log(`FAIL ${what}: expected ${e} got ${g}`); } };
const P = (sys, score) => W.toPct(W.systemOf(sys), score);
// one standard: a 2:1 everywhere is 60
for (const [sys, sc] of [['UK degree class', '2:1'], ['Percentage', '60'], ['CGPA out of 10', '6.5'], ['GPA out of 4', '3.0'], ['GPA out of 5', '4.0'], ['Out of 10', '7.2'], ['Out of 20', '12.5'], ['German grade (1.0 best, 5.0 fail)', '2.0'], ['GWA (1.0 best, 5.0 fail)', '2.0'], ['ECTS grade (A to E)', 'B']]) ok(`${sys} ${sc} is a 2:1`, P(sys, sc), 60);
ok('US 3.0 no longer beats a First', P('GPA out of 4', '3.0') < P('UK degree class', 'First'), true);
// other names
for (const n of ['2.1', 'Upper second', 'second class upper']) ok(`UK "${n}"`, P('UK degree class', n), 60);
ok('Division "1st"', P('Division', '1st'), 60);
ok('Division "First Division"', P('Division', 'First Division'), 60);
ok('form takes "2.1"', W.scoreOk({ grading: 'UK degree class', score: '2.1' }), true);
// lower is better
ok('German 0.9 is the best band', P('German grade (1.0 best, 5.0 fail)', '0.9'), 70);
ok('German 1.55 (gap) takes the worse band', P('German grade (1.0 best, 5.0 fail)', '1.55'), 60);
ok('German 4.5 (fail) is 0', P('German grade (1.0 best, 5.0 fail)', '4.5'), 0);
ok('GWA 1.5', P('GWA (1.0 best, 5.0 fail)', '1.5'), 70);
// higher is better: gap, below, above
ok('CGPA/5 4.495 (gap) takes the band below', P('CGPA out of 5', '4.495'), 60);
ok('GPA/4 1.5 (below the last band) is 0', P('GPA out of 4', '1.5'), 0);
// English table
ok('IELTS 5.0 → PTE', W.convertScore(5.0, 'IELTS', 'PTE'), 36);
ok('TOEFL 115 → IELTS', W.convertScore(115, 'TOEFL', 'IELTS'), 8.5);

const T = (type, overall, parts = {}, date = '01/09/2026') => ({ type, overall: String(overall), parts, date, cert: 'x' });
const all = (n) => ({ l: String(n), r: String(n), w: String(n), s: String(n) });
const stu = (o = {}) => ({ first: 'Asha', country: 'India', nationality: 'India', highest: 'ug', highestEd: 'Bachelor’s (3 years)', edu: { ug: { level: 'Bachelor’s', qualification: 'B.Com', score: '62', grading: 'Percentage', backlogs: '0' } }, tests: [], ...o });
const ielts = (overall = 6.5, min = 6.0) => [{ id: 'e', countries: [], test: 'IELTS Academic', overall, min, note: '' }];
const course = (o = {}) => ({ id: 'c', name: 'MSc', uni: { name: 'Sample University', country: 'UK' }, minEducation: 'Bachelor’s (3 years)', minScore: 60, minScoreScale: 'Percentage', minBacklogs: null, englishRules: ielts(), tags: [], ...o });
const E = (s, c) => W.eligibility(s, c).englishLines[0];
const A = (s, c) => W.eligibility(s, c).academicLines.find((l) => l.label === 'Academics');
ok('listed test meets', E(stu({ tests: [T('IELTS', 6.5, all(6.5))] }), course()).ok, 'yes');
ok('listed test fails but another meets through the table', E(stu({ tests: [T('IELTS', 6.0, all(6)), T('PTE', 65, all(65))] }), course()).ok, 'warn');
ok('listed and converted both fail: Below', E(stu({ tests: [T('IELTS', 5.5, all(5.5)), T('PTE', 45, all(45))] }), course()).ok, 'no');
ok('section minimum, no sections: add details', E(stu({ tests: [T('IELTS', 7.0)] }), course()).ok, 'add');
ok('no section minimum, no sections: fine', E(stu({ tests: [T('IELTS', 7.0)] }), course({ englishRules: ielts(6.5, 0) })).ok, 'yes');
ok('both off the table (below): GSP to confirm', E(stu({ tests: [T('PTE', 25, all(25))] }), course({ englishRules: ielts(4.0, 0) })).result, 'GSP to confirm');
ok('off the table, but clearly below: Below', E(stu({ tests: [T('PTE', 25, all(25))] }), course()).ok, 'no');
ok('both off the table (above): GSP to confirm', E(stu({ tests: [T('TOEFL', 118, all(30))] }), course({ englishRules: ielts(9.0, 0) })).result, 'GSP to confirm');
ok('needs 3.0 of 4; Indian 70%: Meets', A(stu({ edu: { ug: { score: '70', grading: 'Percentage', backlogs: '0' } } }), course({ minScore: 3.0, minScoreScale: 'GPA 4' })).ok, 'yes');
ok('needs 2:1; "2.1" typed: Meets', A(stu({ edu: { ug: { score: '2.1', grading: 'UK degree class', backlogs: '0' } } }), course({ minScore: 2.1, minScoreScale: 'UK class' })).ok, 'yes');
ok('over-qualified: GSP to confirm', A(stu(), course({ minEducation: 'Grade 12', minScore: 75 })).result, 'GSP to confirm');
ok('Other grading: GSP to confirm', A(stu({ edu: { ug: { score: 'B+', grading: 'Other', gradingNote: 'Letter grades', backlogs: '0' } } }), course()).result, 'GSP to confirm');
ok('Other qualification: GSP to confirm', W.eligibility(stu({ highestEd: 'Other qualification' }), course()).academicLines[0].result, 'GSP to confirm');
ok('a level not on the list: GSP to confirm', W.eligibility(stu({ highestEd: 'HND (UK)' }), course()).academicLines[0].result, 'GSP to confirm');
ok('backlogs missing with a limit: add', W.eligibility(stu({ edu: { ug: { score: '70', grading: 'Percentage', backlogs: '' } } }), course({ minBacklogs: 0 })).academicLines.find((l) => l.label === 'Backlogs').ok, 'add');
ok('GSP to confirm never makes Not eligible', W.eligibility(stu({ edu: { ug: { score: 'B+', grading: 'Other', backlogs: '0' } } }), course({ englishRules: [] })).verdict, 'GSP to confirm');
ok('all met: Eligible', W.eligibility(stu({ tests: [T('IELTS', 7, all(7))] }), course()).verdict, 'Eligible');
console.log(`${pass} checks pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
