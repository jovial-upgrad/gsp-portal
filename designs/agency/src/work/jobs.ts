// @ts-nocheck -- typed with the work API.
/**
 * The daily jobs' runs (slice 4 PRD, Daily jobs, Rules for every job), on the prototype's clock in IST. Each job runs
 * at its times (JOBS in work/mail.ts: daily at a time, every N minutes, or weekly) from the work service's start
 * onwards; a run is worked out, not stored. What a run found and changed is the work as it stands at that time:
 * the tasks its rules made since the run before (work/store.ts), and the emails it sent (Emails and daily jobs).
 *
 * Testing aid only: the Prototype panel can make a job's latest runs fail (as an outage would), which is what makes
 * task T65 and Admin Home's "failed 3 runs in a row" warning appear. The build's jobs run on the server.
 */
import { JOBS } from './mail';
import { istAt, istYmd, istWeekday } from './clock';

const DAY = 864e5;
/** When the work service started running jobs: 2 Nov 2026, 00:00 IST (as recordRules.ts WORK_START). */
export const JOBS_FROM = Date.parse('2026-11-02T00:00:00+05:30');
export const JOB_NAME = Object.fromEntries(JOBS.map((j) => [j.id, j.name]));
/** Which task rules each job raises (J3's date rules, J4's waits, J8's weekly checks), for a run's "records changed". */
export const JOB_RULES_OF = {
  J3: ['T33', 'T34', 'T37', 'T38', 'T40', 'T41', 'T42', 'T57', 'T60', 'T61', 'T62', 'T63', 'T64', 'T67', 'T68'],
  J4: ['T2', 'T5', 'T7', 'T54', 'T9b', 'T10', 'T14', 'T16', 'T17', 'T56', 'T69'],
  J8: ['T49', 'T50'],
};

/** Which email templates each job sends (slice 4 PRD, Daily jobs), for a run's "emails sent". */
export const JOB_SENDS = { J2: ['E11'], J3: ['E20'], J4: ['E13', 'E17', 'E21', 'E22'], J6: ['E19'], J7: ['E18'], J9: ['E14'] };

/** The moments a job has run, newest first, at most `limit`, up to `now`. */
export function runTimes(j, now, limit = 20) {
  const job = JOBS.find((x) => x.id === j);
  if (!job) return [];
  const out = [];
  if (job.every.minutes) {
    const m = job.every.minutes * 60000;
    for (let t = Math.floor(now / m) * m; t >= JOBS_FROM && out.length < limit; t -= m) out.push(t);
    return out;
  }
  for (let k = 0; out.length < limit; k++) {
    const day = istYmd(now - k * DAY);
    const at = istAt(day, '00:00');
    if (at + DAY <= JOBS_FROM) break;
    const slots = job.every.daily ? [job.every.daily] : (job.every.weekly || []).filter(([d]) => d === istWeekday(at + 12 * 36e5)).map(([, hm]) => hm);
    for (const hm of [...slots].sort().reverse()) {
      const t = istAt(day, hm);
      if (t <= now && t >= JOBS_FROM && out.length < limit) out.push(t);
    }
  }
  return out;
}

/** A job's runs, newest first: start and end (IST), and the error when the Prototype panel made it fail. */
export function jobRuns(j, now, jobs = {}, limit = 20) {
  const failed = new Set((jobs.fail || {})[j] || []);
  return runTimes(j, now, limit).map((at) => ({ job: j, at, end: at + 2 * 60000, error: failed.has(at) ? `${j} stopped: the data store didn’t answer in time` : null }));
}
