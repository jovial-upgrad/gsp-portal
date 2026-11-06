// Stress test of Grade conversion, English test equivalence and the eligibility check (Jovial, 6 Nov): runs edge
// scenarios and prints what the check says, so each can be judged. Not a pass/fail test.  node scripts/stress-eligibility.mjs
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
const file = path.join(dir, 'stress-elig.mjs'); writeFileSync(file, out.outputFiles[0].text);
const W = await import(pathToFileURL(file).href);
const P = (sys, score) => W.toPct(W.systemOf(sys), score);
console.log('--- Grade conversion: score → %');
for (const [sys, sc] of [['Percentage','72'],['Percentage','72%'],['CGPA out of 10','8.2'],['CGPA out of 10','82'],['CGPA out of 10','10'],['GPA out of 4','3.0'],['GPA out of 4','2.4'],['GPA out of 5','4.5'],['GPA out of 5','4.995'],['GPA out of 5','0.9'],['CGPA out of 5','4.495'],['UK degree class','2:1'],['UK degree class','2.1'],['UK degree class','Upper second'],['Division','First'],['Division','1st'],['Division','First Division'],['A-level grade (Sri Lanka)','A'],['A-level grade (Sri Lanka)','AB'],['Out of 10','8'],['Other','B+']])
  console.log(`${sys.padEnd(26)} ${sc.padEnd(14)} → ${P(sys, sc)}   form accepts: ${W.scoreOk({ grading: sys, score: sc })}`);
console.log('--- Same "level" across systems (UK 2:1 ≈ India 60% ≈ CGPA 6.5 ≈ US GPA 3.0, by the usual university equivalences)');
for (const [sys, sc] of [['UK degree class','2:1'],['Percentage','60'],['CGPA out of 10','6.5'],['GPA out of 4','3.0'],['GPA out of 5','4.0'],['Division','First']]) console.log(`${sys.padEnd(26)} ${sc.padEnd(6)} → ${P(sys, sc)}%`);
console.log('--- English: convertScore');
for (const [v, f, t, sec] of [[6.5,'IELTS','PTE'],[58,'PTE','IELTS'],[57,'PTE','IELTS'],[5.0,'IELTS','PTE'],[40,'PTE','IELTS'],[8.5,'IELTS','TOEFL'],[115,'TOEFL','IELTS'],[22,'TOEFL','IELTS',true],[6.5,'IELTS','TOEFL',true],[100,'Duolingo','IELTS']])
  console.log(`${f} ${v}${sec ? ' (section)' : ''} → ${t} ${W.convertScore(v, f, t, !!sec)}`);
// the check end to end
const T = (type, overall, parts = {}, date = '01/09/2026') => ({ type, overall: String(overall), parts, date, cert: 'x' });
const stu = (o = {}) => ({ country: 'India', nationality: 'India', highest: 'ug', edu: { ug: { level: 'Bachelor’s', qualification: 'B.Com', score: '62', grading: 'Percentage', backlogs: '0' } }, tests: [], ...o });
const course = (o = {}) => ({ id: 'c', name: 'MSc', uni: { name: 'Sample University', country: 'UK' }, minEducation: 'Bachelor’s (3 years)', minScore: 60, minScoreScale: 'Percentage', minBacklogs: null, englishRules: [{ id: 'e', countries: [], test: 'IELTS Academic', overall: 6.5, min: 6.0, note: '' }], tags: [], ...o });
const show = (what, s, c) => { const k = W.eligibility(s, c); console.log(`${what.padEnd(64)} → ${k.verdict} | ${k.lines.map((l) => `${l.label}: ${l.result}`).join('; ')}`); };
console.log('--- The check');
show('IELTS 6.5 all 6.0+', stu({ tests: [T('IELTS', 6.5, { l: '6.5', r: '6', w: '6', s: '7' })] }), course());
show('IELTS 6.5 overall, no section scores', stu({ tests: [T('IELTS', 6.5)] }), course());
show('IELTS 6.0 (below) AND PTE 65 (≈ 7.0)', stu({ tests: [T('IELTS', 6.0, { l: '6', r: '6', w: '6', s: '6' }), T('PTE', 65, { l: '65', r: '65', w: '65', s: '65' })] }), course());
show('Only PTE 65, sections 60+', stu({ tests: [T('PTE', 65, { l: '62', r: '60', w: '61', s: '70' })] }), course());
show('Only PTE 65, no sections', stu({ tests: [T('PTE', 65)] }), course());
show('Course needs IELTS 5.0; student PTE 40', stu({ tests: [T('PTE', 40, { l: '40', r: '40', w: '40', s: '40' })] }), course({ englishRules: [{ id: 'e', countries: [], test: 'IELTS Academic', overall: 5.0, min: 0, note: '' }] }));
show('Course needs IELTS 8.0; student TOEFL 115', stu({ tests: [T('TOEFL', 115, { l: '29', r: '29', w: '28', s: '29' })] }), course({ englishRules: [{ id: 'e', countries: [], test: 'IELTS Academic', overall: 8.0, min: 7.0, note: '' }] }));
show('IELTS taken 3 years ago', stu({ tests: [T('IELTS', 7.0, {}, '01/09/2023')] }), course());
show('Needs 60%; CGPA 6.5', stu({ edu: { ug: { score: '6.5', grading: 'CGPA out of 10', backlogs: '0' } } }), course({ englishRules: [] }));
show('Needs GPA 3.0 of 4; student 70% (First class, India)', stu({ edu: { ug: { score: '70', grading: 'Percentage', backlogs: '0' } } }), course({ minScore: 3.0, minScoreScale: 'GPA 4', englishRules: [] }));
show('Needs 2:1; student GPA 3.0 of 4', stu({ edu: { ug: { score: '3.0', grading: 'GPA out of 4', backlogs: '0' } } }), course({ minScore: 2.1, minScoreScale: 'UK class', englishRules: [] }));
show('Needs 2:1; student "2.1" on UK class', stu({ edu: { ug: { score: '2.1', grading: 'UK degree class', backlogs: '0' } } }), course({ minScore: 2.1, minScoreScale: 'UK class', englishRules: [] }));
show('Needs 60% of Grade 12; student has a bachelor’s (UG course)', stu(), course({ minEducation: 'Grade 12', minScore: 75, englishRules: [] }));
show('Grading "Other"', stu({ edu: { ug: { score: 'B+', grading: 'Other', backlogs: '0' } } }), course({ englishRules: [] }));
show('Backlogs 3, course allows 2', stu({ edu: { ug: { score: '70', grading: 'Percentage', backlogs: '3' } } }), course({ minBacklogs: 2, englishRules: [] }));
show('Backlogs not given, course allows 0', stu({ edu: { ug: { score: '70', grading: 'Percentage', backlogs: '' } } }), course({ minBacklogs: 0, englishRules: [] }));
