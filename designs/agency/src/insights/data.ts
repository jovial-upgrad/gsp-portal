/**
 * The reporting data the dashboards read (Jovial, 18 Nov). In the product the dashboards read the live stores; the
 * prototype's own stores hold a handful of applications, so the dashboards get a reporting set of **seeded records**
 * (RPs, students, applications and each application's dated status changes), built from the same sources the portal
 * uses: Admin's sales regions, queues and people, and the course catalogue. Nothing derived is stored here: every
 * count, rate, list and chart is worked out from these records in `metrics.ts`.
 */
import { COURSES, UNIVERSITIES, type Destination } from '../data/courses';
import { CLOSE_AT, STATUS, type EndKind, type StatusKey } from '../data/applications';
import { OTHER_REASON, peopleOf, sampleCloseReasons, sampleQueues, sampleRegions, sampleUsers, type Queue, type Region, type User } from '../admin/data/config';
import { RP_STATUSES, todayIso, type RpStatus } from '../institution/data/records';

/** One status change: the status it moved to, and when (ms). Closing is `closed` with the end's kind. */
export type Move = { s: StatusKey; at: number };
/** `counsellors`: the RP's own staff who make its applications (each application names one: the RP contact on it). */
export type RepRp = { id: string; name: string; country: string; state: string; city: string; region: string; bdm: string; mp?: string; counsellors: string[]; status: RpStatus };
export type RepStudent = { id: string; name: string; nationality: string };
export type RepApp = {
  id: string;
  student: string;
  rp: string;
  /** Kept when the application was made (18 Nov): the RP's country and sales region, its BDM (the enrolment BDM) and
   *  the IP's priority for that region, so later changes don't rewrite history. */
  country: string;
  region: string;
  bdm: string;
  priority: boolean;
  /** The Admissions officer who worked it. */
  officer: string;
  /** The RP's counsellor on it (the application's RP contact). */
  counsellor: string;
  course: string;
  uni: string;
  dest: Destination;
  /** The month the course starts, YYYY-MM. */
  intake: string;
  created: number;
  moves: Move[];
  end?: { kind: EndKind; at: number; reason: string };
  /** Documents on the application. */
  docs: number;
};
export type Reporting = { rps: RepRp[]; students: RepStudent[]; apps: RepApp[]; users: User[]; queues: Queue[]; regions: Region[] };

/* ---------- a seeded, repeatable random sequence ---------- */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- sample records: names, places, partners ---------- */
const FIRST: Record<string, string[]> = {
  India: ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Kabir', 'Isha', 'Arjun', 'Meera', 'Vihaan', 'Saanvi', 'Aditya', 'Kavya', 'Rahul', 'Pooja', 'Siddharth', 'Neha', 'Harpreet', 'Gurpreet', 'Jaspreet', 'Simran', 'Akhil', 'Anjali', 'Nikhil', 'Lekshmi'],
  Bangladesh: ['Rafiq', 'Nusrat', 'Tanvir', 'Farhana', 'Shakib', 'Mim', 'Arif', 'Sadia', 'Imran', 'Tasnim'],
  Nepal: ['Suman', 'Anjali', 'Bikash', 'Sabina', 'Prakash', 'Rojina', 'Nabin', 'Sita'],
  'Sri Lanka': ['Kasun', 'Nethmi', 'Dilan', 'Sanduni', 'Ravindu', 'Ishara'],
  Vietnam: ['Minh', 'Linh', 'Huy', 'Trang', 'Duc', 'Ngoc', 'Anh', 'Thao'],
  other: ['Daniel', 'Grace', 'Samuel', 'Faith', 'Juan', 'Maria', 'Ahmed', 'Aisha', 'Kofi', 'Ama', 'Lucas', 'Sofia'],
};
const LAST: Record<string, string[]> = {
  India: ['Sharma', 'Patel', 'Singh', 'Kaur', 'Nair', 'Reddy', 'Iyer', 'Gupta', 'Menon', 'Shah', 'Joshi', 'Verma', 'Pillai', 'Kumar'],
  Bangladesh: ['Ahmed', 'Rahman', 'Hossain', 'Islam', 'Akter', 'Chowdhury'],
  Nepal: ['Shrestha', 'Thapa', 'Gurung', 'Tamang', 'Rai', 'Karki'],
  'Sri Lanka': ['Perera', 'Fernando', 'Silva', 'Jayasinghe', 'Wickramasinghe'],
  Vietnam: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu'],
  other: ['Okafor', 'Mensah', 'Garcia', 'Lopez', 'Khan', 'Ali', 'Santos', 'Otieno'],
};
/** Indian states and cities RPs sit in (sample). */
const PLACES: Record<string, [string, string][]> = {
  India: [
    ['Punjab', 'Amritsar'], ['Punjab', 'Ludhiana'], ['Punjab', 'Mohali'], ['Haryana', 'Karnal'], ['Haryana', 'Ambala'], ['Delhi', 'New Delhi'], ['Gujarat', 'Ahmedabad'], ['Gujarat', 'Vadodara'],
    ['Maharashtra', 'Pune'], ['Maharashtra', 'Mumbai'], ['Telangana', 'Hyderabad'], ['Andhra Pradesh', 'Vijayawada'], ['Kerala', 'Kochi'], ['Kerala', 'Thiruvananthapuram'], ['Tamil Nadu', 'Chennai'],
  ],
};
/** Which India regional queue keeps which states (sample, as the India sales tracker splits them). */
const INDIA_RM_STATES: Record<string, string[]> = {
  'q-rec-india-north': ['Delhi', 'Haryana'],
  'q-rec-india-punjab': ['Punjab'],
  'q-rec-india-west': ['Gujarat', 'Maharashtra'],
  'q-rec-india-south': ['Telangana', 'Andhra Pradesh', 'Tamil Nadu'],
  'q-rec-india-kerala': ['Kerala'],
};
const RP_WORDS = [['Global', 'Bright', 'Pathway', 'Horizon', 'Study', 'Unique', 'Prime', 'Elite', 'Future', 'Aspire', 'Vision', 'Royal', 'Smart', 'Golden', 'Blue Sky'], ['Overseas', 'Education', 'Abroad', 'Consultants', 'Edu Services', 'Visa & Study', 'Careers', 'Academy']];
/** How many RPs each region has in the sample, and how many applications a year it sends. */
const RP_COUNT: Record<string, number> = { India: 70, Bangladesh: 30, Nepal: 18, 'Sri Lanka': 10, Vietnam: 16, Pakistan: 6, Philippines: 6, Africa: 8, 'Latin America and Europe': 6, Australia: 10 };

const DAY = 86_400_000;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Builds the reporting set: about 3,000 applications from November last year to today, each moving through the
 * statuses with dated changes; some close (the reasons each stage allows), some are still open.
 */
export function sampleReporting(seed = 18_11_2026): Reporting {
  const r = rng(seed);
  const pick = <T,>(l: readonly T[]) => l[Math.floor(r() * l.length)];
  const users = sampleUsers();
  const queues = sampleQueues(users);
  const regions = sampleRegions(queues);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const today = new Date(`${todayIso()}T12:00:00`).getTime();

  /* RPs: each region's, each with its BDM from the region's Recruitment queue (India: the regional queue for its state) */
  const rps: RepRp[] = [];
  Object.entries(RP_COUNT).forEach(([region, n]) => {
    const reg = regions.find((x) => x.name === region);
    const q = queues.find((x) => x.id === reg?.recruitment);
    if (!reg || !q) return;
    for (let i = 0; i < n; i++) {
      const country = reg.countries.length ? pick(reg.countries) : region;
      const [state, city] = PLACES[country] ? pick(PLACES[country]) : ['', country];
      const local = Object.entries(INDIA_RM_STATES).find(([, states]) => states.includes(state))?.[0];
      const lq = queues.find((x) => x.id === local);
      const people = (lq ? peopleOf(lq, queues) : peopleOf(q, queues)).map(nameOf).filter(Boolean);
      const id = `RP-${String(11000 + rps.length * 37).slice(0, 5)}`;
      const fl = FIRST[country] ? country : 'other';
      const counsellors = [0, 1].map(() => `${pick(FIRST[fl])} ${pick(LAST[fl])}`);
      // most RPs are working with GSP; a few are suspended or dormant (sample records, the RP record's statuses)
      const status = (i % 13 === 5 ? RP_STATUSES.find((x) => x === 'Suspended') : i % 11 === 7 ? RP_STATUSES.find((x) => x === 'Dormant') : i % 2 ? RP_STATUSES.find((x) => x === 'Agreement signed') : RP_STATUSES.find((x) => x === 'Activated'))!;
      rps.push({ id, name: `${pick(RP_WORDS[0])} ${pick(RP_WORDS[1])}${i % 7 === 3 ? ` ${city}` : ''}`, country, state, city, region, bdm: people[i % people.length] ?? nameOf(q.lead), counsellors, status });
    }
  });
  // a few RPs belong to a Master Partner (sample)
  rps.forEach((x, i) => {
    if (i % 11 === 4) x.mp = i % 2 ? 'MP-1001' : 'MP-1002';
  });
  // bigger partners send more: a skewed weight per RP
  const weight = rps.map(() => Math.pow(r(), 3) * 10 + 0.3);
  const total = weight.reduce((a, b) => a + b, 0);
  const pickRp = () => {
    let x = r() * total;
    for (let i = 0; i < rps.length; i++) if ((x -= weight[i]) <= 0) return rps[i];
    return rps[rps.length - 1];
  };

  /* universities a region's IPs give priority to (sample): a fixed share of each destination's */
  const priorityUni = new Set(UNIVERSITIES.filter((_, i) => i % 3 !== 1).map((u) => u.id));
  const byDest = new Map<string, typeof COURSES>();
  COURSES.forEach((c) => byDest.set(c.uni.country, [...(byDest.get(c.uni.country) ?? []), c]));
  const DESTS = [...byDest.keys()];
  const DEST_W: Record<string, number> = { Australia: 50, UK: 32, 'New Zealand': 9, Ireland: 4, Canada: 3, USA: 2 };

  const students: RepStudent[] = [];
  const apps: RepApp[] = [];
  const start = today - 380 * DAY;
  let sid = 100_000;
  while (apps.length < 3000) {
    const rp = pickRp();
    // more applications lately: the sample grows towards today
    const created = start + Math.pow(r(), 0.55) * (today - start);
    const nat = rp.country;
    const fl = FIRST[nat] ? nat : 'other';
    const st: RepStudent = { id: `E00${++sid}`, name: `${pick(FIRST[fl])} ${pick(LAST[fl])}`, nationality: nat };
    students.push(st);
    let dw = r() * DESTS.reduce((a, d) => a + (DEST_W[d] ?? 1), 0);
    const dest = DESTS.find((d) => (dw -= DEST_W[d] ?? 1) <= 0) ?? DESTS[0];
    const count = r() < 0.55 ? 1 : r() < 0.7 ? 2 : 3;
    // the course starts 2 to 10 months after the student applies
    const startMonth = new Date(created + (60 + r() * 240) * DAY);
    const intake = `${startMonth.getUTCFullYear()}-${String(startMonth.getUTCMonth() + 1).padStart(2, '0')}`;
    const qAdm = queues.find((q) => q.id === regions.find((x) => x.name === rp.region)?.queue) ?? queues.find((q) => q.name === 'Global Admissions');
    const officers = qAdm ? peopleOf(qAdm, queues).map(nameOf).filter(Boolean) : [];
    for (let k = 0; k < count && apps.length < 3000; k++) {
      const c = pick(byDest.get(dest)!);
      const a = journey(r, Math.min(today - DAY / 4, created + k * r() * 3 * DAY), `${intake}-01`, today, c.uni.country as Destination);
      apps.push({
        id: `E00${String(110_000 + apps.length).padStart(6, '0')}`,
        student: st.id,
        rp: rp.id,
        country: rp.country,
        region: rp.region,
        bdm: rp.bdm,
        priority: priorityUni.has(c.uni.id),
        officer: officers.length ? officers[Math.floor(r() * officers.length)] : '',
        counsellor: rp.counsellors[Math.floor(r() * rp.counsellors.length)],
        course: c.id,
        uni: c.uni.id,
        dest: c.uni.country as Destination,
        intake,
        created: a.moves[0].at,
        moves: a.moves,
        end: a.end,
        docs: a.moves.length < 2 ? Math.floor(r() * 4) : 4 + Math.floor(r() * 12),
      });
    }
  }
  return { rps, students, apps: apps.sort((a, b) => b.created - a.created), users, queues, regions };
}

/** Why applications close: Admin's Closing reasons for each way of closing (Jovial, 18 Nov). */
const CLOSE_REASONS = Object.fromEntries(sampleCloseReasons().map((x) => [x.kind, x.reasons])) as Partial<Record<EndKind, string[]>>;

/** The main path an application takes, each step with the chance it happens and the days it takes (sample). */
const PATH: [StatusKey, number, number, number][] = [
  ['checking', 0.86, 1, 6],
  ['ready', 0.9, 1, 8],
  ['lodged', 0.9, 1, 12],
  ['conditions', 0.72, 3, 40],
  ['uol', 0.28, 10, 70],
  ['payreview', 0.5, 5, 35],
  ['acceptrec', 0.82, 5, 35],
  ['visasub', 0.86, 5, 30],
  ['startdate', 0.78, 14, 45],
  ['enrolled', 0.9, 0, 0],
];

function journey(r: () => number, created: number, start: string, today: number, _dest: Destination) {
  const moves: Move[] = [{ s: 'docs', at: created }];
  let at = created;
  const begins = new Date(`${start}T09:00:00`).getTime();
  for (const [s, p, lo, hi] of PATH) {
    // enrolment happens when the course starts
    let next = s === 'enrolled' ? Math.max(begins, at + DAY) : at + (lo + r() * (hi - lo)) * DAY;
    if (next > today) return { moves };
    if (r() > p) {
      // the step didn't happen: the application either waits here or closes, with a reason its stage allows
      if (r() < 0.55) {
        const stage = STATUS[moves[moves.length - 1].s].stage;
        const kinds = s === 'startdate' ? (['Visa refused'] as EndKind[]) : CLOSE_AT[stage];
        const endAt = Math.min(today, next);
        const kind = kinds[Math.floor(r() * kinds.length)];
        const why = CLOSE_REASONS[kind] ?? [OTHER_REASON];
        moves.push({ s: 'closed', at: endAt });
        return { moves, end: { kind, at: endAt, reason: why[Math.floor(r() * why.length)] } };
      }
      return { moves };
    }
    // some offers go through an assessment or interview first (the Interview tracker's)
    if (s === 'uol' && r() < 0.18) {
      const iv = at + (2 + r() * 10) * DAY;
      if (iv > today) return { moves };
      moves.push({ s: 'interview', at: iv });
      at = iv;
      // a recent interview is often still waiting for its outcome
      if (today - iv < 25 * DAY && r() < 0.6) return { moves };
      next = Math.max(next, iv + 3 * DAY);
      if (next > today) return { moves };
    }
    moves.push({ s, at: next });
    at = next;
  }
  return { moves };
}

export const isoDay = dayOf;
