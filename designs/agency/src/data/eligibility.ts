/**
 * GSP Assist's eligibility check (slice 3 PRD, Eligibility check, decided 2 Nov: S3-4 to S3-6, S3-15 to S3-18, and the
 * S3C-1 to S3C-3 proposals until they're answered). It compares the student's record with the course's entry rules,
 * wherever a student is selected: the course page's Eligibility tab and Add an application. It's always a soft check:
 * it never blocks applying. Academics compares the highest qualification only (lock answers S3C-2, S2C-3). Worked out each time it's shown, never stored, so editing the student, the course or
 * Admin's tables changes it at once.
 */
import { RULE_SCALE, UK_CODE, equiv, systemOf, toPct, type EquivRow } from '../admin/data/eligibility';
export { systemOf, toPct } from '../admin/data/eligibility';
import { eduName, eduRank, isTopEducation, type HighestEducation } from './education';
import { tagsOf, type Course } from './courses';
import { TESTS, isOtherGrading, type Edu, type Student, type Test, type TestType } from './students';
import { parseDate } from './dates';

export type Ok = 'yes' | 'warn' | 'no' | 'add' | 'na';
/** One line of the check: its result, what it's about, and why, in the PRD's words. */
export type Line = { ok: Ok; label: string; result: string; why: string };
/** 'GSP to confirm' (Jovial, 6 Nov): the university hasn't set it, or the check can't compare it (a grading system,
 *  level or test it can't convert); GSP checks it by hand. It never counts against the student. */
export type PartVerdict = 'Eligible' | 'Eligible with conditions' | 'Not eligible' | 'Add details to check' | 'GSP to confirm';
export type Check = { lines: Line[]; academic: PartVerdict; english: PartVerdict; verdict: PartVerdict; academicLines: Line[]; englishLines: Line[] };

/* ---------- the student's highest education (S3C-1) ---------- */

/** The student's Highest education, in the one list: the record's own, else read from its top education level. */
export function highestEdOf(s: Student): HighestEducation {
  const own = (s as Student & { highestEd?: HighestEducation }).highestEd;
  if (own) return eduName(own);
  const top = s.edu[s.highest];
  if (s.highest === 'pg') return /PhD|Doctor/i.test(top?.level ?? '') ? 'Doctorate' : 'Master’s';
  if (s.highest === 'ug') return /Diploma/i.test(top?.level ?? '') ? 'Diploma' : /4|four|B\.?E|B\.?Tech/i.test(`${top?.qualification ?? ''}`) ? 'Bachelor’s (4 years)' : 'Bachelor’s (3 years)';
  return s.highest === 'g12' ? 'Grade 12' : 'Grade 10';
}

/* ---------- the course's rules ---------- */

type AcademicRule = { id: string; countries: string[]; qual: string; board?: string; scale: string; min: number; backlogs: string; note?: string };
type EnglishRule = { id: string; countries: string[]; test: string; overall: number; min: number; note: string };
type WithRules = Course & { academicRules?: AcademicRule[]; englishRules?: EnglishRule[] };

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

/** A test's lowest and highest score in the table, in its own column (for "off the table"). */
export function tableRange(t: TestType): [number, number] | null {
  const a = COL[t];
  if (!a) return null;
  const v = equiv().map((r) => r[a]);
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
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

const HAND = 'GSP to confirm';
/**
 * English (Jovial, 6 Nov): every valid test is tried, a listed one against its rule, the others through English test
 * equivalence, and the best result counts: a listed test that meets is Meets; a converted one that meets is Meets
 * (converted), with conditions; otherwise the closest. A test the table can't convert, or a score or minimum off the
 * table, can't be compared: GSP confirms by hand. A course with a section minimum needs the section scores.
 */
function englishLines(s: Student, c: Course, country: string): Line[] {
  const rules = englishRulesFor(c, country);
  if (!rules.length) return [{ ok: 'na', label: 'English', result: 'Not specified', why: 'The course lists no English test. It doesn’t count against the student.' }];
  const tests = s.tests.filter((t) => TESTS[t.type].kind === 'English' && t.overall.trim() !== '');
  const valid = tests.filter((t) => !expired(t));
  const old = tests.filter((t) => expired(t));
  const partsOf = (t: Test) => TESTS[t.type].parts.map((p) => String(t.parts[p.key] ?? '').trim()).filter((x) => x !== '' && !Number.isNaN(Number(x))).map(Number);
  type Try = { ok: Line['ok']; result: string; why: string; rank: number };
  const tries: Try[] = [];
  for (const t of valid) {
    const short = TESTS[t.type].short;
    const overall = Number(t.overall);
    for (const r of rules) {
      const to = TYPE_OF[r.test];
      const secs = partsOf(t);
      const needSecs = !!r.min && secs.length < TESTS[t.type].parts.length;
      if (to === t.type) {
        // a: a test the course lists, against its rule
        const low = secs.length ? Math.min(...secs) : overall;
        const meets = overall >= r.overall && (!r.min || low >= r.min);
        const need = `needs ${fmt(t.type, r.overall)}${r.min ? `, no section below ${fmt(t.type, r.min)}` : ''}`;
        if (needSecs && overall >= r.overall) tries.push({ ok: 'add', result: 'Add details to check', why: `${short} ${fmt(t.type, overall)}; add the section scores: the course ${need}`, rank: 3 });
        else tries.push({ ok: meets ? 'yes' : 'no', result: meets ? 'Meets' : 'Below', why: `${short} ${fmt(t.type, overall)}${secs.length ? ` (lowest section ${fmt(t.type, low)})` : ''}; ${need}`, rank: meets ? 6 : 1 });
        continue;
      }
      // b: another test, through the table
      const range = tableRange(t.type);
      const toRange = to ? tableRange(to) : null;
      if (!to || !range || !toRange) {
        tries.push({ ok: 'na', result: HAND, why: `${short} can’t be converted to ${r.test} yet; GSP checks it by hand`, rank: 2 });
        continue;
      }
      // off the table: the student's score above its top row with the need above the top too, or below its lowest row with the need at or below the lowest
      const above = overall > range[1] && r.overall > toRange[1];
      const below = overall < range[0] && r.overall <= toRange[0];
      if (above || below) {
        tries.push({ ok: 'na', result: HAND, why: `${short} ${fmt(t.type, overall)} and ${TESTS[to].short} ${fmt(to, r.overall)} are outside English test equivalence; GSP checks it by hand`, rank: 2 });
        continue;
      }
      const ov = convertScore(overall, t.type, to);
      const conv = secs.map((p) => convertScore(p, t.type, to, true));
      const low = conv.length && conv.every((x) => x !== null) ? Math.min(...(conv as number[])) : ov;
      const meets = ov !== null && ov >= r.overall && (!r.min || (low !== null && low >= r.min));
      if (needSecs && meets) tries.push({ ok: 'add', result: 'Add details to check', why: `${short} ${fmt(t.type, overall)} is about ${TESTS[to].short} ${fmt(to, ov!)}; add the section scores: the course needs no section below ${fmt(to, r.min)}`, rank: 3 });
      else tries.push({ ok: meets ? 'warn' : 'no', result: meets ? `Meets (converted from ${short})` : 'Below (converted)', why: `${short} ${fmt(t.type, overall)} is about ${TESTS[to].short} ${ov === null ? 'below the lowest row' : fmt(to, ov)}; needs ${fmt(to, r.overall)}`, rank: meets ? 5 : 0 });
    }
  }
  if (tries.length) {
    // the best result counts: Meets, then Meets (converted), then add sections, then GSP to confirm, then the closest Below
    const best = [...tries].sort((x, y) => y.rank - x.rank)[0];
    return [{ ok: best.ok, label: 'English', result: best.result, why: best.why }];
  }
  // c: no test (or only expired ones): May be waived on courses tagged so, else Add an English test
  const waiver = tagsOf(c).some((t) => t === 'English test waiver' || t === 'MOI acceptable');
  const note = rules.map((r) => r.note).find((n) => n.trim());
  const exp = old[0] ? `Expired: ${TESTS[old[0].type].short} taken ${old[0].date}, more than 2 years ago. ` : '';
  if (waiver) return [{ ok: 'warn', label: 'English', result: 'May be waived', why: `${exp}${c.uni.name} may waive the English test for this course${note ? `: ${note}` : '.'}` }];
  return [{ ok: 'add', label: 'English', result: old.length ? 'Expired' : 'Add an English test', why: old.length ? `${exp}Add a newer test to check.` : 'Add an English test to the student’s record to check.' }];
}

/**
 * The course's minimum score in its Minimum highest education (lock answers S3C-2 with S2C-3, Jovial, 2 Nov): the
 * course's own `minScore` on `minScoreScale`, and its backlog limit (`minBacklogs`) when it states one. Required with
 * `minEducation` to save the Academic tab and to publish, so every course has them; a course without them shows Not
 * specified (no other row is read).
 */
export type MinScore = { min: number; scale: string; backlogs: string };
export function minScoreOf(c: Course): MinScore | null {
  if (typeof c.minScore !== 'number' || c.minScore <= 0 || !c.minScoreScale) return null;
  return { min: c.minScore, scale: c.minScoreScale, backlogs: c.minBacklogs == null ? '' : String(c.minBacklogs) };
}

/**
 * Academics (lock answers S3C-2 with S2C-3, Jovial, 2 Nov: "compare only with highest qualification needed for both
 * course and what's present in student"): the student's **highest qualification** against the course's **Minimum
 * highest education** (the level, in the one ordered list) and its **minimum score** (both converted to a percentage
 * through Admin › Grade conversion). No other academic row or qualification is matched. **Backlogs** count only when
 * the course states a backlog limit; otherwise there's no backlog check.
 */
function academicLines(s: Student, c: Course): Line[] {
  const out: Line[] = [];
  const min = c.minEducation;
  const mine = highestEdOf(s);
  // the level check (S3-18): Not specified until the course has its Minimum highest education required
  // a level that isn't on GSP's education list (a foreign qualification, say) can't be ranked: GSP confirms by hand
  const unranked = !!min && (eduRank(mine) < 0 || eduRank(min) < 0);
  if (!min) out.push({ ok: 'na', label: 'Highest education', result: 'Not specified', why: 'The course has no minimum highest education yet.' });
  else if (unranked) out.push({ ok: 'na', label: 'Highest education', result: HAND, why: `${eduName(mine) || 'The student’s qualification'} can’t be compared with ${eduName(min)} automatically; GSP checks it by hand` });
  else if (eduRank(mine) < eduRank(min)) out.push({ ok: 'no', label: 'Highest education', result: 'Not eligible', why: `${eduName(mine)}; needs ${eduName(min)}${isTopEducation(min) ? '' : ' or higher'}` });
  else out.push({ ok: 'yes', label: 'Highest education', result: 'Meets', why: `${eduName(mine)}; needs ${eduName(min)}${isTopEducation(min) ? '' : ' or higher'}` });
  // the score: the student's highest qualification's against the course's minimum score
  const need = minScoreOf(c);
  const e = s.edu[s.highest];
  const what = eduName(mine);
  // over-qualified (Jovial, 6 Nov): the course sets its minimum on a lower level than the student's highest, so the
  // student's score can't be read against it; GSP confirms by hand
  const over = !!min && !unranked && eduRank(mine) > eduRank(min);
  if (!need) out.push({ ok: 'na', label: 'Academics', result: 'Not specified', why: 'The course has no minimum score for its minimum highest education.' });
  else if (unranked) out.push({ ok: 'na', label: 'Academics', result: HAND, why: `The score can’t be compared until the qualification is; GSP checks it by hand` });
  else if (over) out.push({ ok: 'na', label: 'Academics', result: HAND, why: `${s.first ?? 'The student'} has a ${what}; the course sets its minimum score on ${eduName(min)}, so GSP checks it by hand` });
  else {
    const needPct = rulePct({ id: 'min', countries: [], qual: '', scale: need.scale, min: need.min, backlogs: need.backlogs });
    const needText = ruleText({ id: 'min', countries: [], qual: '', scale: need.scale, min: need.min, backlogs: need.backlogs });
    if (e && isOtherGrading(e.grading)) out.push({ ok: 'na', label: 'Academics', result: HAND, why: `${e.gradingNote || 'This grading'}${e.score ? ` (${e.score})` : ''} can’t be converted yet; GSP checks it by hand` });
    else if (!e || e.score.trim() === '' || !e.grading) out.push({ ok: 'add', label: 'Academics', result: 'Add details to check', why: `Add the ${!e ? 'details' : !e.grading ? 'grading system' : 'score'} of the ${what} to check. It needs ${needText}.` });
    else {
      const got = toPct(systemOf(e.grading), e.score);
      // a score that meets only after grade conversion is plain Meets, with no "converted" label (S3-17)
      // a grading system the check can't convert ("Other", or a score it can't read): GSP confirms by hand
      if (got === null || needPct === null) out.push({ ok: 'na', label: 'Academics', result: HAND, why: `${isOtherGrading(e.grading) ? `${e.gradingNote || 'This grading'}` : `${e.score} on ${systemOf(e.grading)?.name ?? e.grading}`} can’t be converted yet; GSP checks it by hand` });
      else out.push({ ok: got >= needPct ? 'yes' : 'no', label: 'Academics', result: got >= needPct ? 'Meets' : 'Below', why: `${what}: ${studentScore(e)}; needs ${needText}` });
    }
    // backlogs only when the course states a limit (S3C-2): more than allowed is its own Not eligible line
    if (need.backlogs !== '' && e && e.backlogs.trim() === '') out.push({ ok: 'add', label: 'Backlogs', result: 'Add details to check', why: `Add the backlogs of the ${what}: the course allows up to ${need.backlogs}` });
    if (need.backlogs !== '' && e && e.backlogs.trim() !== '') {
      const has = Number(e.backlogs);
      const allowed = Number(need.backlogs);
      out.push(has > allowed ? { ok: 'no', label: 'Backlogs', result: 'Not eligible', why: `${has} backlogs; up to ${allowed} allowed` } : { ok: 'yes', label: 'Backlogs', result: 'Meets', why: `${has} backlogs; up to ${allowed} allowed` });
    }
  }
  return out;
}

const partOf = (lines: Line[]): PartVerdict => {
  if (lines.some((l) => l.ok === 'no')) return 'Not eligible';
  if (lines.some((l) => l.ok === 'add')) return 'Add details to check';
  if (lines.some((l) => l.ok === 'warn')) return 'Eligible with conditions';
  // anything the university hasn't set or the check can't compare: GSP confirms it (never against the student)
  if (lines.some((l) => l.ok === 'na')) return 'GSP to confirm';
  return 'Eligible';
};

/**
 * The check for a student and a course, in the PRD's verdicts: Eligible; Eligible with conditions (English met only
 * through equivalence, or May be waived); Add details to check (something missing, an expired test included); Not
 * eligible (anything Below, a highest education under the minimum, too many backlogs). A part the university hasn't
 * specified doesn't count; neither specified: Not specified.
 */
export function eligibility(s: Student, c: Course, country = s.country || s.nationality): Check {
  const a = academicLines(s, c);
  const e = englishLines(s, c, country);
  const academic = partOf(a);
  const english = partOf(e);
  const lines = [...a, ...e];
  return { lines, academicLines: a, englishLines: e, academic, english, verdict: partOf(lines) };
}

/** The verdict's tone for its pill. */
export const verdictTone = (v: PartVerdict): Ok => (v === 'Eligible' ? 'yes' : v === 'Eligible with conditions' ? 'warn' : v === 'Not eligible' ? 'no' : v === 'Add details to check' ? 'add' : 'na');

/* ---------- the check in two groups (Jovial, 2 Nov) ---------- */

/** Worst first: a group takes the state of its worst line (Jovial, 2 Nov: no > add > warn > na > yes). */
const WORST: Ok[] = ['no', 'add', 'warn', 'na', 'yes'];
export const worstOf = (oks: Ok[]): Ok => WORST.find((o) => oks.includes(o)) ?? 'na';
/** A group's state in the PRD's verdict words, so its icon and its words always agree. */
const VERDICT_OF: Record<Ok, PartVerdict> = { no: 'Not eligible', add: 'Add details to check', warn: 'Eligible with conditions', na: 'GSP to confirm', yes: 'Eligible' };
/** One check inside a group: what it's about (named for the group it's in), its result and why. */
export type SubLine = Line & { sub: string };
export type LineGroup = { key: 'Academics' | 'English'; ok: Ok; verdict: PartVerdict; lines: SubLine[] };
// the order inside Academics: Highest education, then the score or grade checks, then Backlogs
const ACADEMIC_ORDER = (l: Line) => (l.label === 'Highest education' ? 0 : l.label === 'Backlogs' ? 2 : 1);
const SUB_NAME: Record<string, string> = { Academics: 'Score', English: 'English test' };
/**
 * The check's lines as two groups, Academics and English (Jovial, 2 Nov: highest education, the scores and the
 * backlogs come together), each with its worst line's state and every check under it, in a fixed order. Add an
 * application (GSP Assist) and the course page's Eligibility tab both show them this way.
 */
export function groupsOf(k: Check): LineGroup[] {
  const group = (key: LineGroup['key'], lines: Line[]): LineGroup => {
    const ok = worstOf(lines.map((l) => l.ok));
    return { key, ok, verdict: VERDICT_OF[ok], lines: lines.map((l) => ({ ...l, sub: SUB_NAME[l.label] ?? l.label })) };
  };
  return [group('Academics', [...k.academicLines].sort((a, b) => ACADEMIC_ORDER(a) - ACADEMIC_ORDER(b))), group('English', k.englishLines)];
}
