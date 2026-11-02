/**
 * GSP Assist's eligibility check (slice 3 PRD, Eligibility check, decided 2 Nov: S3-4 to S3-6, S3-15 to S3-18, and the
 * S3C-1 to S3C-3 proposals until they're answered). It compares the student's record with the course's entry rules,
 * wherever a student is selected: the course page's Eligibility tab and Add an application. It's always a soft check:
 * it never blocks applying. Worked out each time it's shown, never stored, so editing the student, the course or
 * Admin's tables changes it at once.
 */
import { RULE_SCALE, UK_CODE, equiv, systemOf, toPct, type EquivRow } from '../admin/data/eligibility';
export { systemOf, toPct } from '../admin/data/eligibility';
import { MIN_EDUCATION, eduRank, type HighestEducation } from './education';
import { tagsOf, type Course } from './courses';
import { TESTS, type Edu, type Level as EduLevel, type Student, type Test, type TestType } from './students';
import { parseDate } from './dates';

export type Ok = 'yes' | 'warn' | 'no' | 'add' | 'na';
/** One line of the check: its result, what it's about, and why, in the PRD's words. */
export type Line = { ok: Ok; label: string; result: string; why: string };
export type PartVerdict = 'Eligible' | 'Eligible with conditions' | 'Not eligible' | 'Add details to check' | 'Not specified';
export type Check = { lines: Line[]; academic: PartVerdict; english: PartVerdict; verdict: PartVerdict; academicLines: Line[]; englishLines: Line[] };

/* ---------- the student's highest education (S3C-1) ---------- */

/** The student's Highest education, in the one list: the record's own, else read from its top education level. */
export function highestEdOf(s: Student): HighestEducation {
  const own = (s as Student & { highestEd?: HighestEducation }).highestEd;
  if (own) return own;
  const top = s.edu[s.highest];
  if (s.highest === 'pg') return /PhD|Doctor/i.test(top?.level ?? '') ? 'Doctorate' : 'Master’s';
  if (s.highest === 'ug') return /Diploma/i.test(top?.level ?? '') ? 'Diploma' : /4|four|B\.?E|B\.?Tech/i.test(`${top?.qualification ?? ''}`) ? 'Bachelor’s (4 years)' : 'Bachelor’s (3 years)';
  return s.highest === 'g12' ? 'Grade 12' : 'Grade 10';
}

/* ---------- the course's rules ---------- */

type AcademicRule = { id: string; countries: string[]; qual: string; board?: string; scale: string; min: number; backlogs: string; note?: string };
type EnglishRule = { id: string; countries: string[]; test: string; overall: number; min: number; note: string };
type WithRules = Course & { academicRules?: AcademicRule[]; englishRules?: EnglishRule[] };

/** The academic rules for students from a country: the country's own, else the rules for every country. */
export function academicRulesFor(c: Course, country: string): AcademicRule[] {
  const rows = (c as WithRules).academicRules ?? (c.academic ? [{ id: 'a', countries: [], qual: 'Applicable to all', scale: 'Percentage', min: c.academic, backlogs: c.backlogs !== undefined ? String(c.backlogs) : '' }] : []);
  const own = rows.filter((r) => r.countries.includes(country));
  return own.length ? own : rows.filter((r) => !r.countries.length);
}
/** The English rules for students from a country: for each test, the country's own row, else the one for every country. */
export function englishRulesFor(c: Course, country: string): EnglishRule[] {
  const rec = (c as WithRules).englishRules;
  const rows: EnglishRule[] =
    rec ??
    ([
      ['IELTS Academic', c.ielts],
      ['TOEFL iBT', c.toefl],
      ['PTE Academic', c.pte],
      ['Duolingo English Test', c.duolingo],
    ] as [string, [number, number] | undefined][])
      .filter(([, v]) => v && v[0] > 0)
      .map(([test, v]) => ({ id: test, countries: [], test, overall: v![0], min: v![1], note: '' }));
  return [...new Set(rows.map((r) => r.test))].flatMap((t) => {
    const own = rows.filter((r) => r.test === t && r.countries.includes(country));
    return own.length ? own : rows.filter((r) => r.test === t && !r.countries.length);
  });
}
/** A rule's minimum as a percentage, from its own scale (conversion happens only at comparison time). */
function rulePct(r: AcademicRule): number | null {
  const sys = systemOf(RULE_SCALE[r.scale] ?? r.scale);
  if (r.scale === 'UK class' && r.min < 10) return toPct(sys, UK_CODE[String(r.min)] ?? String(r.min));
  return toPct(sys, String(r.min));
}
const ruleText = (r: AcademicRule) => (r.scale === 'Percentage' ? `${r.min}%` : r.scale === 'GPA 4' ? `${r.min} out of 4` : r.scale === 'GPA 10' ? `${r.min} out of 10` : `${UK_CODE[String(r.min)] ?? r.min} (UK class)`);

/** The student's entry a rule's qualification asks about: Grade 12, a diploma or bachelor's, or the highest entry. */
function entryFor(s: Student, qual: string): { level: EduLevel; e?: Edu; name: string } {
  if (/Grade 12/.test(qual)) return { level: 'g12', e: s.edu.g12, name: 'Grade 12' };
  if (/Bachelor|Diploma/.test(qual)) return { level: 'ug', e: s.edu.ug, name: qual.replace(/ \(.*\)/, '').toLowerCase() === 'diploma' ? 'diploma' : 'bachelor’s' };
  return { level: s.highest, e: s.edu[s.highest], name: 'highest qualification' };
}
const studentScore = (e: Edu) => `${e.score}${systemOf(e.grading)?.by === 'As is' ? '%' : ` (${systemOf(e.grading)?.name ?? 'score'})`}`;

/* ---------- English test equivalence ---------- */

const COL: Record<TestType, keyof EquivRow | undefined> = { IELTS: 'ielts', TOEFL: 'toefl', PTE: 'pte', Duolingo: 'duolingo', SAT: undefined, ACT: undefined, GMAT: undefined, GRE: undefined };
const TYPE_OF: Record<string, TestType> = { 'IELTS Academic': 'IELTS', 'TOEFL iBT': 'TOEFL', 'PTE Academic': 'PTE', 'Duolingo English Test': 'Duolingo' };
/**
 * A score on one test as another test's score (S3-16): the row at or below the score in its column, read across. Below
 * the lowest row converts to nothing. TOEFL sections (0–30) are ×4 before the lookup and ÷4 (rounded down) after (S3C-3).
 */
export function convertScore(v: number, from: TestType, to: TestType, section = false): number | null {
  const a = COL[from];
  const b = COL[to];
  if (!a || !b) return null;
  const x = section && from === 'TOEFL' ? v * 4 : v;
  const rows = [...equiv()].sort((p, q) => p[a] - q[a]);
  const row = rows.filter((r) => r[a] <= x).pop();
  if (!row) return null;
  return section && to === 'TOEFL' ? Math.floor(row[b] / 4) : row[b];
}

/** A test taken more than 2 years ago counts as missing (S3-5). */
export function expired(t: Test, now = Date.now()) {
  const d = parseDate(t.date);
  if (!d) return false;
  const until = new Date(d);
  until.setFullYear(until.getFullYear() + TESTS[t.type].years);
  return until.getTime() < now;
}
const fmt = (type: TestType, n: number) => (type === 'IELTS' ? n.toFixed(1) : String(n));

function englishLines(s: Student, c: Course, country: string): Line[] {
  const rules = englishRulesFor(c, country);
  if (!rules.length) return [{ ok: 'na', label: 'English', result: 'Not specified', why: 'The course lists no English test. It doesn’t count against the student.' }];
  const tests = s.tests.filter((t) => TESTS[t.type].kind === 'English' && t.overall.trim() !== '');
  const valid = tests.filter((t) => !expired(t));
  const old = tests.filter((t) => expired(t));
  const listed = (t: Test) => rules.find((r) => TYPE_OF[r.test] === t.type);
  const partsOf = (t: Test) => TESTS[t.type].parts.map((p) => Number(t.parts[p.key])).filter((n) => !Number.isNaN(n));
  // a: a test the course lists, against its rule
  const direct = valid.filter((t) => listed(t));
  if (direct.length) {
    const read = direct.map((t) => {
      const r = listed(t)!;
      const low = partsOf(t).length ? Math.min(...partsOf(t)) : Number(t.overall);
      const meets = Number(t.overall) >= r.overall && (!r.min || low >= r.min);
      return { meets, why: `${TESTS[t.type].short} ${fmt(t.type, Number(t.overall))} (lowest section ${fmt(t.type, low)}); needs ${fmt(t.type, r.overall)}${r.min ? `, no section below ${fmt(t.type, r.min)}` : ''}` };
    });
    const best = read.find((x) => x.meets) ?? read[0];
    return [{ ok: best.meets ? 'yes' : 'no', label: 'English', result: best.meets ? 'Meets' : 'Below', why: best.why }];
  }
  // b: only tests the course doesn't list: converted to each test it lists (met this way: with conditions)
  if (valid.length) {
    const tries = valid.flatMap((t) =>
      rules.map((r) => {
        const to = TYPE_OF[r.test];
        const ov = to ? convertScore(Number(t.overall), t.type, to) : null;
        const secs = partsOf(t).map((p) => (to ? convertScore(p, t.type, to, true) : null));
        const low = secs.length && secs.every((x) => x !== null) ? Math.min(...(secs as number[])) : ov;
        const meets = ov !== null && ov >= r.overall && (!r.min || (low !== null && low >= r.min));
        return { meets, t, why: `${TESTS[t.type].short} ${fmt(t.type, Number(t.overall))} is about ${to ? TESTS[to].short : r.test} ${ov === null ? 'below the lowest row' : fmt(to!, ov)}; needs ${r.overall}` };
      }),
    );
    const best = tries.find((x) => x.meets) ?? tries[0];
    return [{ ok: best.meets ? 'warn' : 'no', label: 'English', result: best.meets ? `Meets (converted from ${TESTS[best.t.type].short})` : 'Below (converted)', why: best.why }];
  }
  // c: no test (or only expired ones): May be waived on courses tagged so, else Add an English test
  const waiver = tagsOf(c).some((t) => t === 'English test waiver' || t === 'MOI acceptable');
  const note = rules.map((r) => r.note).find((n) => n.trim());
  const exp = old[0] ? `Expired: ${TESTS[old[0].type].short} taken ${old[0].date}, more than 2 years ago. ` : '';
  if (waiver) return [{ ok: 'warn', label: 'English', result: 'May be waived', why: `${exp}${c.uni.name} may waive the English test for this course${note ? `: ${note}` : '.'}` }];
  return [{ ok: 'add', label: 'English', result: old.length ? 'Expired' : 'Add an English test', why: old.length ? `${exp}Add a newer test to check.` : 'Add an English test to the student’s record to check.' }];
}

function academicLines(s: Student, c: Course, country: string): Line[] {
  const out: Line[] = [];
  // the level check (S3-18): Not specified until the course has its Minimum highest education required
  const min = c.minEducation;
  const mine = highestEdOf(s);
  if (!min) out.push({ ok: 'na', label: 'Highest education', result: 'Not specified', why: 'The course has no minimum highest education yet.' });
  else if (eduRank(mine) < eduRank(min)) out.push({ ok: 'no', label: 'Highest education', result: 'Not eligible', why: `${mine}; needs ${min}${min === MIN_EDUCATION[MIN_EDUCATION.length - 1] ? '' : ' or higher'}` });
  else out.push({ ok: 'yes', label: 'Highest education', result: 'Meets', why: `${mine}; needs ${min} or higher` });
  // the academic rules for the student's country, else every country's (S3C-2: Meets if any rule that applies is met)
  const rules = academicRulesFor(c, country);
  const hasData = Object.values(s.edu).some((e) => e && e.score.trim() !== '');
  if (!rules.length) {
    out.push(hasData ? { ok: 'na', label: 'Academics', result: 'Not specified by the university', why: `No academic rule for students from ${country}.` } : { ok: 'na', label: 'Academics', result: 'Not specified', why: 'Neither the course nor the student has academic details.' });
    return out;
  }
  const tries = rules.map((r) => {
    const { e, name } = entryFor(s, r.qual);
    const need = rulePct(r);
    if (!e || e.score.trim() === '' || !e.grading) return { r, e, state: 'add' as const, why: `Add the ${name}’s ${!e ? 'details' : !e.grading ? 'grading system' : 'score'} to check. It needs ${ruleText(r)}.` };
    const got = toPct(systemOf(e.grading), e.score);
    if (got === null || need === null) return { r, e, state: 'add' as const, why: `The ${name}’s score can’t be read on its grading system; correct it to check.` };
    // a score that meets only after grade conversion is plain Meets, with no "converted" label (S3-17)
    return { r, e, state: got >= need ? ('yes' as const) : ('no' as const), why: `${studentScore(e)}; needs ${ruleText(r)}` };
  });
  const met = tries.find((x) => x.state === 'yes');
  const pick = met ?? tries.find((x) => x.state === 'add') ?? tries[0];
  out.push({ ok: pick.state, label: 'Academics', result: pick.state === 'yes' ? 'Meets' : pick.state === 'no' ? 'Below' : 'Add details to check', why: pick.why });
  // backlogs: against the rule that was met (or the first that applies); more than allowed is its own Not eligible line
  const br = (met ?? tries[0]).r;
  const be = (met ?? tries[0]).e;
  if (br.backlogs !== '' && be && be.backlogs.trim() !== '') {
    const has = Number(be.backlogs);
    const allowed = Number(br.backlogs);
    if (has > allowed) out.push({ ok: 'no', label: 'Backlogs', result: 'Not eligible', why: `${has} backlogs; up to ${allowed} allowed` });
  }
  return out;
}

const partOf = (lines: Line[]): PartVerdict => {
  if (lines.some((l) => l.ok === 'no')) return 'Not eligible';
  if (lines.some((l) => l.ok === 'add')) return 'Add details to check';
  if (lines.every((l) => l.ok === 'na')) return 'Not specified';
  if (lines.some((l) => l.ok === 'warn')) return 'Eligible with conditions';
  return 'Eligible';
};

/**
 * The check for a student and a course, in the PRD's verdicts: Eligible; Eligible with conditions (English met only
 * through equivalence, or May be waived); Add details to check (something missing, an expired test included); Not
 * eligible (anything Below, a highest education under the minimum, too many backlogs). A part the university hasn't
 * specified doesn't count; neither specified: Not specified.
 */
export function eligibility(s: Student, c: Course, country = s.country || s.nationality): Check {
  const a = academicLines(s, c, country);
  const e = englishLines(s, c, country);
  const academic = partOf(a);
  const english = partOf(e);
  const lines = [...a, ...e];
  return { lines, academicLines: a, englishLines: e, academic, english, verdict: partOf(lines) };
}

/** The verdict's tone for its pill. */
export const verdictTone = (v: PartVerdict): Ok => (v === 'Eligible' ? 'yes' : v === 'Eligible with conditions' ? 'warn' : v === 'Not eligible' ? 'no' : v === 'Add details to check' ? 'add' : 'na');
