/**
 * RP Admin's Background (Nesil, 4 Nov): what it requires, how it's checked before Save, and the profile's readiness
 * with it counted. GSP Team keeps its own Background, so none of this reaches it.
 */
import { newRefusal, readiness, type Refusal, type Student } from '../../../data/students';
import { parseDate, parseMonth } from '../../../data/dates';

/** The refusals to show: at least one once the student has been refused (an older record may have only the line). */
export const refusalsOf = (s: Student): Refusal[] => (s.refusals?.length ? s.refusals : [newRefusal('r0')]);

export type Issue = { id: string; label: string; msg: string };

/** Background's required answers that are missing or wrong, in the order they're asked, by the field's id. */
export function backgroundIssues(s: Student): Issue[] {
  const out: Issue[] = [];
  const now = Date.now();
  if (!s.marital) out.push({ id: 'rb-marital', label: 'marital status', msg: 'Choose the marital status.' });
  if (s.marital === 'Married') {
    const d = parseDate(s.marriedOn ?? '');
    const msg = !s.marriedOn ? 'Enter the date of marriage.' : !d ? 'Enter the date as DD/MM/YYYY, like 14/02/2024.' : d.getTime() > now ? 'The date of marriage can’t be in the future.' : null;
    if (msg) out.push({ id: 'rb-married-on', label: 'date of marriage', msg });
  }
  if (!s.visa) out.push({ id: 'rb-visa', label: 'visa refusals', msg: 'Choose No or Yes.' });
  if (s.visa === 'yes')
    refusalsOf(s).forEach((r, i) => {
      const n = `refusal ${i + 1}`;
      if (!r.country) out.push({ id: `rb-r-${r.id}-country`, label: `${n}: country`, msg: 'Choose the country.' });
      if (!r.visa.trim()) out.push({ id: `rb-r-${r.id}-visa`, label: `${n}: visa or document`, msg: 'Enter the visa or document.' });
      const m = parseMonth(r.when);
      const msg = !r.when ? 'Enter the month.' : !m ? 'Enter it as MM/YYYY, like 07/2023.' : m.getTime() > now ? 'This month hasn’t come yet.' : null;
      if (msg) out.push({ id: `rb-r-${r.id}-when`, label: `${n}: when`, msg });
    });
  return out;
}

/** How many required answers Background has now: the two questions, the date when married, three for each refusal. */
const requiredCount = (s: Student) => 2 + (s.marital === 'Married' ? 1 : 0) + (s.visa === 'yes' ? 3 * refusalsOf(s).length : 0);

/** What's saved: answers to questions no longer asked go (a date of marriage once not married, refusals once "No"). */
export function tidyBackground(s: Student): Student {
  return {
    ...s,
    marriedOn: s.marital === 'Married' ? s.marriedOn : '',
    refusals: s.visa === 'yes' ? refusalsOf(s) : [],
    dependentsCount: s.dependents === 'yes' ? s.dependentsCount : '',
    disabilityNote: s.disability === 'yes' ? s.disabilityNote : '',
  };
}

/**
 * The profile's readiness in RP Admin: the shared one, with Background's required answers counted as well (4 Nov),
 * so the Background tab, Personal details and the profile's percentage agree.
 */
export function rpReadiness(s: Student) {
  const r = readiness(s);
  const missing = backgroundIssues(s).map((x) => x.label);
  const total = r.total + requiredCount(s);
  const toAdd = r.toAdd + missing.length;
  return {
    ...r,
    sections: r.sections.map((x) => (x.key === 'background' ? { ...x, optional: false, missing } : x)),
    toAdd,
    total,
    pct: Math.round(((total - toAdd) / total) * 100),
    complete: toAdd === 0,
  };
}
