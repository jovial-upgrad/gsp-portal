/**
 * Commissions (Jovial, PM, 9 Nov: the PRD's Commissions tab). What GSP records about what each university pays it and
 * what it owes each RP. Commissions (GSP · Finance) keeps four kinds of record in Finance › Setup: agreement variants,
 * one commission record per RP, notices, one set of terms per university and university groups. No payment details are kept
 * on the portal (Jovial, 10 Nov, Q45: they're exchanged by email). Everything else (commission items, transactions, their statuses, due dates and amounts) is worked out by
 * the engine (engine.ts) from those records, the enrolled applications and the actions people take, and today's date.
 *
 * This module holds the shapes and every option list and status the pages show: no page has a list of its own.
 */
import { DESTINATIONS, LEVELS, type Destination } from '../../data/courses';
import type { AppFees } from '../../data/applications';

export { DESTINATIONS, LEVELS };
/** Program levels a university's terms can price (the sandbox's): the catalogue's, plus vocational, English and study abroad. */
export const COMM_LEVELS = [...LEVELS, 'VET', 'ELICOS', 'Study Abroad'] as const;
export type { Destination };
/** A level commission can be priced at: a course's level, or VET, ELICOS or Study Abroad (the sandbox's sectors). */
export type Level = (typeof COMM_LEVELS)[number];

/** A file someone uploaded: its name and size in bytes. */
export type FileRef = { name: string; size: number };
/** Who did something, and when (ms). */
export type Stamp = { by: string; at: number };

/* ---------- settings ---------- */

/**
 * The module's settings (seeded in seed.ts, kept in the store): GSP’s own name and address (RPs bill it; it bills universities), where disputes go,
 * how long a study period is, when the financial year starts, the largest file, how GSP numbers its invoices to
 * universities (Open question 2), and the commission rules.
 */
export type Settings = {
  gsp: { name: string; lines: string[] };
  disputeEmail: string;
  /** The mailbox GSP's invoices to universities go out from, through Mail (D17). */
  invoiceFrom: string;
  /**
   * Weeks after a study period starts when its census date (or withdrawal deadline) falls, when the application holds
   * none (the sandbox's fallback, Jovial 10 Nov): the line shows the date as estimated.
   */
  fallbackWeeks: number;
  /** The month (1–12) the financial year starts (Jovial, 10 Nov, D14: a setting, April by default). */
  fyStart: number;
  maxFileMb: number;
  /** GSP's invoice to a university: {code}, {year} and {seq} filled in. */
  invoiceFormat: string;
  /** GST on GSP's invoices to universities, by destination (Jovial, 10 Nov, C6: 10% for Australia, nowhere else). */
  gst: Partial<Record<Destination, number>>;
  /** Region groups a rate row, promotion or bonus can name instead of one country (SEA, South Asia…). */
  regionGroups: Record<string, string[]>;
  /** The RP's share after the first year (annuity), unless its record has its own: the same as year 1, a flat %, or none. */
  annuity: { rule: AnnuityRule; pct: number | null };
  /** What a new RP is shown of its commission until its record says otherwise (Jovial, 11 Nov). */
  rpView: RpView;
  /**
   * Months after a study period ends that an RP can claim its commission (the commissions team, 11 Nov, R105: 12, the
   * same in every new agreement; an agreement can say otherwise). Past it the line stays, isn't closed and the RP isn't
   * told; Finance sees it flagged and adjusts the books (Xero).
   */
  rpClaimMonths: number;
  /** Q118/Q125 (Jovial, 13 Nov): days a recovery waits with nothing to set it against before Finance chases it with a debit note. */
  recoveryChaseDays?: number;
  /** A notice's source document types. */
  docTypes: string[];
  /** Student types an Australian enrolment needs (new, progression, transfer). */
  studentTypes: string[];
  /** The countries whose universities need the student type (Jovial, 17 Nov: a setting, not written in the code). */
  studentTypeCountries: string[];
  /** The application status from which commission is forecast and the fee, scholarship and course start are required (17 Nov). */
  forecastFrom: string;
  /** The day commissions went live on the portal (17 Nov: old commissions stay in the old portal): no task's clock starts before it. */
  liveFrom: string;
  /** Why a university paid less than a line's amount (Jovial, 10 Nov, Q44): the reasons Record payment offers. */
  partReasons: string[];
  /** 17 Nov (Jovial, Finance demo): what Mark not payable offers; 'Other' asks for a few words. */
  notPayableReasons?: string[];
  /** Lav, 18 Nov: why Finance sends an RP's invoice back; 'Other' asks for a few words. */
  sendBackReasons?: string[];
  /** Lav, 18 Nov (R158): GST an Australian-registered RP adds to its filled-in invoice, in %. */
  rpGst?: number;
  /** Suman, 18 Nov: the prefix of GSP's invoice numbers to universities (from Xero) and of the matching bill number on the RP's lines. */
  invPrefix?: string;
  billPrefix?: string;
  /**
   * Reminders, email and bell (Jovial, 10 Nov, Q47), in days: to the RP after its invoice is asked for and not sent;
   * to Finance (and the university's contact) from a University → GSP line's due date while it isn't paid. No escalation.
   */
  reminders: { rpInvoice: number[]; uniPayment: number[]; rpPayment: number[] };
};
/**
 * What an RP is shown of its commission (Jovial, 11 Nov): which kinds of line, and which study periods. GSP sees every
 * line. A line the RP can't see is never shown to it: asking for its invoice changes the line's status for Finance and
 * sends nothing to the RP. Set per RP on its commission record (Finance or RP Ops); Settings holds the default.
 * Promotions count as course commission; an Adjustment follows the line it adjusts.
 */
export const RP_VIEW_KINDS = ['Course commission', 'Tier top-up', 'Additional commission', 'Bonus'] as const;
export type RpViewKind = (typeof RP_VIEW_KINDS)[number];
/** R112 (13 Nov): what the RP is shown before its invoice is asked for: its first payment as an estimate, or nothing. */
export const RP_VIEW_PERIODS = ['First study period only', 'Nothing'] as const;
export type RpViewPeriods = (typeof RP_VIEW_PERIODS)[number];
export type RpView = { kinds: RpViewKind[]; periods: RpViewPeriods };
/** In words, for a Commission tab and a log line. */
export const rpViewText = (v: RpView) => `${v.kinds.length ? v.kinds.join(', ') : 'Nothing'}; before its invoice is asked for, ${v.periods === 'Nothing' ? 'nothing' : 'its first payment as an estimate'}`;
export const ANNUITY_RULES = ['Same as year 1', 'Flat %', 'None'] as const;
export type AnnuityRule = (typeof ANNUITY_RULES)[number];

/* ---------- agreements ---------- */

export const SHARE_TYPES = ['Flat', 'Tiered by enrolments'] as const;
export type ShareType = (typeof SHARE_TYPES)[number];
/** How an agreement's (or a notice's) bands count enrolments (Jovial, 10 Nov, D14: the same options as university terms; 13 Nov: no two intakes). */
export const COUNTED_PER = ['Financial year', 'Calendar year', 'Academic year', 'Intake'] as const;
export type CountedPer = (typeof COUNTED_PER)[number];
export const AGREEMENT_STATUSES = ['Active', 'Retired'] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];
export const YES_NO = ['No', 'Yes'] as const;

/** A band of enrolments and its share or rate: from and to (to null: and above). */
export type Band = { from: number; to: number | null; pct: number };

/** What an agreement says: the share, its bands, how they're counted, what's passed on, how soon GSP pays. */
export type AgreementTerms = {
  /** Months after a study period ends that the RP can claim (R105); empty: Settings'. */
  claimMonths?: number | null;
  shareType: ShareType;
  share: number | null;
  bands: Band[];
  countedPer: CountedPer;
  /** The month an academic year starts (1–12), when that's what the bands count by. */
  yearStart?: number;
  retro: boolean;
  /** Retrospective only once the top band is reached (the sandbox's "top tier only"). */
  retroTop?: boolean;
  /** Share of any additional commission passed on (%); null: the same as the share. */
  addl: number | null;
  /**
   * The agreement's own bonuses (Jovial, 9 Nov): paid to the RP whether or not GSP meets a university's bonus tier. No
   * RP gets a share of a bonus a university pays GSP.
   */
  bonuses: AgreementBonus[];
  payDays: number;
  details: string;
  doc: FileRef | null;
};
/** When an agreement's bonus is paid: on every enrolment, or on the enrolment that reaches a number in the agreement's counting window. */
export const AB_WHEN = ['Every enrolment', 'At an enrolment number'] as const;
export type AbWhen = (typeof AB_WHEN)[number];
/**
 * An agreement's bonus: its description and amount, and when (`nth`: the enrolment number, for At an enrolment number).
 * The amount is in the university's currency, like every line (Jovial, 10 Nov, Q67).
 */
export type AgreementBonus = { id: string; desc: string; amount: number; when: AbWhen; nth: number | null };
/**
 * An agreement variant. `earlier`: its terms before each edit, with the day they stopped: an edit has an Effective
 * from date (Jovial, 10 Nov, Q41), and an enrolment takes the terms in force on its intake start date.
 */
export type Agreement = AgreementTerms & { id: string; name: string; status: AgreementStatus; created: Stamp; updated: Stamp; earlier: (AgreementTerms & { until: string })[] };

/* ---------- RP records ---------- */

/**
 * One commission record per RP: its agreement from a date (`moves`: the agreements it was on before); `ownFlat`: its own
 * flat share instead of the agreement's (the sandbox's "own flat %"); `annuityPct`: its own share after the first year.
 * No tax line (Jovial, 10 Nov, D8: Phase 2) and no payment details (Q45).
 */
export type RpRecord = { rp: string; agreement: string; from: string; /** Jovial, 13 Nov: the last day the agreement applies (empty: open-ended). */ to?: string; /** R158 (Lav, 18 Nov): an Australian-registered RP's ABN, when it's registered for GST (its filled-in invoice adds GST). */ abn?: string; ownFlat?: number | null; annuityPct?: number | null; view?: RpView | null; moves: { agreement: string; from: string }[]; created: Stamp; updated: Stamp };

/* ---------- notices ---------- */

/**
 * What a notice gives (Jovial, 10 Nov: the sandbox's notice structures): a bonus per enrolment, a share, a tiered share,
 * a share plus an amount per enrolment, a milestone lump sum (once GSP is paid for N enrolments under it, even after it
 * ends), or a % of the student's tuition fee.
 */
export const BENEFITS = ['Bonus per enrolment', 'Share', 'Tiered share', 'Share plus amount per enrolment', 'Milestone', '% of tuition'] as const;
/** How a share notice combines with the RP's own terms (D12): a separate box (not counted in the RP's tier), the higher wins, or it adds on top. */
// Q142 (Jovial, 16 Nov): the options in plain words
export const COMBINES = ['The higher of the two', 'Counted separately (own band)', 'Added to the RP’s share'] as const;
export const [HIGHER, SEPARATE, ADDS] = COMBINES;
export type Combine = (typeof COMBINES)[number];
/** A milestone: the lump sum due once GSP has been paid for `count` enrolments under the notice. */
export type Milestone = { count: number; amount: number };
export type Benefit = (typeof BENEFITS)[number];
export const NOTICE_STATUSES = ['Upcoming', 'Active', 'Ended'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];
export type Notice = {
  id: string;
  name: string;
  /** The source document: a notice, addendum, flyer or email (Settings' document types). */
  docType?: string;
  doc: FileRef;
  /** Only these intake months (YYYY-MM); empty: every intake between Starts and Ends. */
  intakes?: string[];
  starts: string;
  ends: string;
  dests: Destination[];
  unis: string[];
  levels: Level[];
  benefit: Benefit;
  /** A bonus's amount, in the university's currency of each enrolment it covers (Jovial, 10 Nov, Q67). */
  amount: number | null;
  share: number | null;
  bands: Band[];
  /** A tiered share counted retrospectively: the band reached raises the earlier enrolments it covers (Q57). */
  retro: boolean;
  combine?: Combine;
  milestones?: Milestone[];
  /** % of tuition: the share of the student's first-year tuition fee. */
  tuitionPct?: number | null;
  /** The RPs (by id) that may use it; none listed: every RP in `regions` (sales regions). */
  rps: string[];
  regions?: string[];
  /** RPs taken off it, and the day (Jovial, 10 Nov, Q65): their enrolments before that day keep it. */
  removed: { rp: string; on: string }[];
  /** RP Ops (BAP) issues a notice Finance created (Jovial, 11 Nov, Q107, R103): until then it applies to nobody and no RP sees it. */
  issued?: Stamp | null;
  created: Stamp;
  updated: Stamp;
};

/* ---------- university terms ---------- */

export const FEE_BASES = ['Tuition before scholarship', 'Tuition after scholarship'] as const;
export type FeeBasis = (typeof FEE_BASES)[number];
/**
 * When a study period's commission is earned, and which of the application's dates (filled in by Admissions) says
 * when that is, per study period. Enrolment confirmed's study period 1 is the day the application became Student enrolled.
 */
export const TRIGGERS = [
  { label: 'Census date', field: 'census', date: 'Census date' },
  { label: 'Enrolment confirmed', field: 'confirmed', date: 'Enrolment confirmed on' },
  { label: 'Fees paid', field: 'paid', date: 'Fees paid on' },
  // the sandbox's Withdrawal deadline: the study period's start + the terms' weeks (Settings' fallback when blank); no date to fill in
  { label: 'Withdrawal deadline', field: 'census', date: 'Withdrawal deadline' },
] as const satisfies readonly { label: string; field: keyof Pick<AppFees, 'census' | 'confirmed' | 'paid'>; date: string }[];
/** How the university pays commission (the sandbox's pay unit): a period of the year, per unit of study, or on each fee payment. */
export const PAY_UNITS = [
  { label: 'Year', per: 1, one: 'Year' },
  { label: 'Semester', per: 2, one: 'Semester' },
  { label: 'Trimester', per: 3, one: 'Trimester' },
  { label: 'Term', per: 4, one: 'Term' },
  { label: 'Per unit', per: 0, one: 'Unit' },
  { label: 'Each fee payment', per: 0, one: 'Fee payment' },
] as const;
export type PayUnit = (typeof PAY_UNITS)[number]['label'];
/** How long commission is chargeable (the sandbox's Chargeable for): the whole course, N periods, the first N credit points, or fees up to an amount. */
export const CHARGE_UNITS = [
  { label: 'Whole course', months: 0 },
  { label: 'Years', months: 12 },
  { label: 'Semesters', months: 6 },
  { label: 'Trimesters', months: 4 },
  { label: 'Terms', months: 3 },
  { label: 'Units', months: 0 },
  { label: 'Credit points', months: 0 },
  { label: 'Fees up to', months: 0 },
] as const;
export type ChargeUnit = (typeof CHARGE_UNITS)[number]['label'];
export type Charge = { unit: ChargeUnit; n: number | null };
/**
 * Conditions a rate row, promotion, additional commission or bonus can carry (the sandbox's): intake start dates, intake
 * months (YYYY-MM), the student's country or region group, courses (by name), levels and campuses. Empty: no condition.
 */
export type Cond = { from?: string; to?: string; intakes?: string[]; regions?: string[]; courses?: string[]; levels?: Level[]; campuses?: string[] };
/** A rate row: what it matches (level, course, campus, student's region, study period: 2, 3+, 1-2) and its % or fixed amount; the most specific match wins. */
export type RateRow = { level?: Level; course?: string; campus?: string; region?: string; period?: string; pct: number | null; amt: number | null };
/** How a university promotion combines with the rate: the higher wins, it replaces the rate, or it adds its own line. */
export const PROMO_COMBINES = ['Highest wins', 'Replaces the rate', 'Additional line'] as const;
export type PromoCombine = (typeof PROMO_COMBINES)[number];
export type Promo = { id: string; name: string; pct: number | null; amt: number | null; combine: PromoCombine; cond: Cond };
/** A band's own bonus per student (a fixed amount, or % of the first-year fee): band 1 is the first. */
export type BandBonus = { band: number; kind: AddlKind; value: number };
/**
 * A bonus scheme, GSP's own and never shared with RPs (the sandbox's): per student, once N students enrol (on the Nth),
 * or an amount per student by how many enrol; counted per the terms' counting year (or its own), retrospectively unless
 * not, optionally per source country, and only the students its conditions cover.
 */
export const BONUS_PER = ['Per student', 'At a number', 'By count'] as const;
export type BonusPer = (typeof BONUS_PER)[number];
export type CountBand = { from: number; to: number | null; value: number; kind: AddlKind };
export type BonusScheme = { id: string; name: string; per: BonusPer; kind: AddlKind; value: number; threshold: number | null; bands: CountBand[]; countedPer?: UniCountedPer; retro: boolean; perCountry: boolean; cond: Cond };
export type Trigger = (typeof TRIGGERS)[number]['label'];
export const TRIGGER_LABELS = TRIGGERS.map((t) => t.label) as Trigger[];
export const ADDL_KINDS = ['Amount', '%'] as const;
export type AddlKind = (typeof ADDL_KINDS)[number];
/** When an additional commission is earned: on enrolment, or with study period 1's trigger. */
export const ADDL_WHEN = ['On enrolment', 'With study period 1'] as const;
export type AddlWhen = (typeof ADDL_WHEN)[number];
export type Addl = { id: string; desc: string; kind: AddlKind; value: number; when: AddlWhen; cond?: Cond };
/** How a university's tier bands and bonuses count students (Jovial, 10 Nov, Q55): the year in the contract. */
export const UNI_COUNTED_PER = ['Calendar year', 'Academic year', 'Financial year', 'Intake'] as const;
export type UniCountedPer = (typeof UNI_COUNTED_PER)[number];
export type TermsBody = {
  /** Months after a study period ends that GSP can invoice the university (R105: it varies by contract); empty: no limit. */
  claimMonths?: number | null;
  /** The currency the university pays in (D20): its country's by default, editable from the contract. */
  currency?: string;
  rates: Partial<Record<Level, number>>;
  feeBasis: FeeBasis;
  fixed: Partial<Record<Level, number>>;
  /** Rows that differ from the rates by level (the most specific match wins). */
  rateRows: RateRow[];
  trigger: Trigger;
  /** Withdrawal deadline: weeks after the study period starts (blank: Settings' fallback weeks). */
  triggerWeeks: number | null;
  payUnit: PayUnit;
  charge: Charge;
  payDays: number;
  /** The most commission per student in the first year, on the course and Tier bonus lines (additional commission isn't capped). */
  cap: number | null;
  bands: Band[];
  /** What the bands count over, and the month an academic year starts (1–12) when that's the year. */
  countedPer: UniCountedPer;
  yearStart: number;
  /** Bands counted retrospectively (the total sets everyone's band), per source country, and for some levels only. */
  tierRetro: boolean;
  tierPerCountry: boolean;
  tierLevels: Level[];
  bandBonuses: BandBonus[];
  promos: Promo[];
  addl: Addl[];
  bonus: BonusScheme[];
  contract: FileRef;
  notes: string;
};
export type UniTerms = TermsBody & { uni: string; created: Stamp; updated: Stamp; earlier: (TermsBody & { until: string })[] };

/**
 * IP terms (Q56; 16 Nov: a group is an institution partner): some or all of an IP's universities counted together for a
 * tier and GSP's bonuses. A partner has an IP tier or tiers per university, never both (R124).
 */
export type UniGroup = {
  id: string;
  /** The institution partner whose terms these are (16 Nov: a group is an IP); its name is the IP's. */
  ip: string;
  name: string;
  /** The IP's universities that count toward its tier and bonuses: all of them, or some. */
  members: string[];
  bands: Band[];
  countedPer: UniCountedPer;
  yearStart: number;
  tierRetro: boolean;
  tierPerCountry: boolean;
  tierLevels: Level[];
  bandBonuses: BandBonus[];
  bonus: BonusScheme[];
  notes: string;
  created: Stamp;
  updated: Stamp;
};

/* ---------- enrolled applications ---------- */

/**
 * An enrolled application, as the engine reads it: from the portal's applications (status Student enrolled) or the
 * seeded records of other RPs' enrolments. `withdrawn`: the day the student withdrew, if they did.
 */
/** `estimate` (Jovial, 17 Nov): the application is past Acceptance letter received but not enrolled yet: its lines are Expected, for the forecast, and it counts toward no tier or band. */
export type Enrolment = { app: string; student: string; rp: string; course: string; intake: string; enrolled: string; withdrawn?: string; fees?: AppFees; nationality?: string; estimate?: boolean };

/* ---------- transactions ---------- */

export type Side = 'uni' | 'rp';
export const SIDES: Record<Side, string> = { uni: 'University → GSP', rp: 'GSP → RP' };
export const SIDE_KEYS = Object.keys(SIDES) as Side[];
/** Adjustment: the difference when a line's worked-out amount changes after it was invoiced, requested or paid (Jovial, 9 Nov). */
export const TX_TYPES = ['Course commission', 'Tier bonus', 'IP commission', 'Promotion', 'Additional commission', 'Bonus', 'Tier top-up', 'Adjustment', 'Clawback', 'Recovery', 'Credit note'] as const;
/** Suman, 18 Nov: what Add lines offers. A credit note comes only from the credit note form; a recovery from a clawback (an RP-side clawback added by hand becomes one). */
export const ADDABLE_TYPES = TX_TYPES.filter((t) => t !== 'Credit note' && t !== 'Recovery');
/** Suman, 18 Nov: types that are always a minus amount. */
export const MINUS_TYPES: readonly string[] = ['Clawback', 'Recovery', 'Credit note'];
export type TxType = (typeof TX_TYPES)[number];

/** Part paid (Jovial, 10 Nov, Q44): the university paid less than the line, with a reason, until the rest comes or is written off. */
export const UNI_STATUSES = ['Expected', 'Ready to invoice', 'Invoiced', 'Overdue', 'Part paid', 'Held', 'Paid', 'Not payable', 'Credited'] as const;
/**
 * The RP's statuses (Jovial, 10 Nov, Q50, the Commissions flow's #21): Expected, Waiting for university (GSP's line is
 * due but not paid yet), Ready to request (GSP is paid; Finance hasn't asked for the RP's invoice yet), Invoice requested
 * (R112, 13 Nov: Finance asked; the RP sees it as To invoice), Invoice in review (the RP's invoice is with Finance), Approved, Paid; and
 * On hold, Sent back, Not payable. To recover and Recovered: a university's clawback the RP's share of which is set against its next payment (R106).
 */
export const RP_STATUSES = ['Expected', 'Waiting for university', 'Ready to request', 'Invoice requested', 'Invoice in review', 'Approved', 'Overdue to pay', 'On hold', 'Sent back', 'To recover', 'Paid', 'Recovered', 'Not payable'] as const;
export type UniStatus = (typeof UNI_STATUSES)[number];
export type RpStatus = (typeof RP_STATUSES)[number];
export type TxStatus = UniStatus | RpStatus;
export const STATUSES_OF: Record<Side, readonly TxStatus[]> = { uni: UNI_STATUSES, rp: RP_STATUSES };

/** The status groups (the Commission lines page's tabs, but Not counted, which shows under All). */
export const GROUPS = [
  { key: 'estimate', label: 'Not yet ready', uni: ['Expected'], rp: ['Expected'], tab: true },
  { key: 'progress', label: 'In progress', uni: ['Ready to invoice', 'Invoiced', 'Overdue', 'Part paid', 'Held'], rp: ['Waiting for university', 'Ready to request', 'Invoice requested', 'Invoice in review', 'Approved', 'Overdue to pay', 'On hold', 'Sent back', 'To recover'], tab: true },
  { key: 'paid', label: 'Paid', uni: ['Paid'], rp: ['Paid', 'Recovered'], tab: true },
  { key: 'none', label: 'Not counted', uni: ['Not payable', 'Credited'], rp: ['Not payable'], tab: false },
] as const satisfies readonly { key: string; label: string; uni: readonly UniStatus[]; rp: readonly RpStatus[]; tab: boolean }[];
export type GroupKey = (typeof GROUPS)[number]['key'];
export const groupOf = (side: Side, s: TxStatus): GroupKey | undefined => GROUPS.find((g) => (g[side] as readonly string[]).includes(s))?.key;
/** The Commission lines page's status tabs: All, then each group that's a tab. */
export const LINE_TABS: { key: GroupKey | 'all'; label: string }[] = [{ key: 'all', label: 'All' }, ...GROUPS.filter((g) => g.tab).map((g) => ({ key: g.key, label: g.label }))];

/** Which lines each Commission lines action takes (the PRD's Actions table). */
export const ACTION_FROM = {
  raise: ['Ready to invoice'],
  record: ['Invoiced', 'Overdue', 'Part paid'],
  request: ['Ready to request'],
  pay: ['Approved', 'Overdue to pay'],
} as const satisfies Record<string, readonly TxStatus[]>;
/** University lines to chase (17 Nov: Finance's IP queue): past due, or paid short. */
export const CHASE: readonly UniStatus[] = ['Overdue', 'Part paid'];
/** The RP's lines it can invoice (Earnings' Invoices to send: those GSP has asked for). */
export const TO_INVOICE: readonly RpStatus[] = ['Invoice requested', 'Sent back'];
/** GSP's line is due but the university hasn't paid it: the RP waits (Q50). */
export const WAITING_UNI: RpStatus = 'Waiting for university';
/** The RP's invoice is with Finance. */
export const IN_REVIEW: RpStatus = 'Invoice in review';
/** A university's clawback, the RP's share waiting to be set against its next payment, then set against it (R106). */
export const TO_RECOVER: RpStatus = 'To recover';
export const RECOVERED: RpStatus = 'Recovered';
/** A university line paid short (Q44): Write off the rest acts on it. */
export const PART_PAID: UniStatus = 'Part paid';
/** Suman, 18 Nov: lines kept only as a record: Not payable (struck through in red) and Credited (muted). */
export const NOT_PAYABLE: TxStatus = 'Not payable';
export const CREDITED: UniStatus = 'Credited';
export const recordClass = (s: TxStatus) => (s === NOT_PAYABLE ? 'is-void' : s === CREDITED ? 'is-credited' : '');
/** University → GSP lines Finance can invoice, and those past due. */
export const READY_UNI: UniStatus = 'Ready to invoice';
export const OVERDUE_UNI: UniStatus = 'Overdue';
/** GSP → RP lines GSP has approved and owes (D24: past Pay within, Overdue to pay). */
export const TO_PAY: readonly RpStatus[] = ['Approved', 'Overdue to pay'];
/** GSP → RP lines whose amount can still change until GSP is paid (D21). */
export const RP_ESTIMATE: readonly RpStatus[] = ['Expected', 'Waiting for university', 'Ready to request'];
/** R112: Finance asks for the RP's invoice on these, with Request invoice. */
export const READY_RP: RpStatus = 'Ready to request';
/** R112: Finance has asked for the RP's invoice; the RP hasn't sent it yet. */
export const ASKED_RP: RpStatus = 'Invoice requested';
/**
 * The status as the RP reads it on Earnings (R112): a line it's shown before its invoice is asked for is its first
 * payment, an Estimate; once asked for, it's To invoice. Every other status reads the same.
 */
export const rpLabel = (s: TxStatus): string => ((RP_ESTIMATE as readonly string[]).includes(s) ? 'Estimate' : s === 'Invoice requested' ? 'To invoice' : s);
/** Held lines: In progress, but not ready (Earnings leaves them out of Ready to invoice). */
export const HELD: readonly TxStatus[] = ['Held', 'On hold'];
/** Each status's colour (as Pill tones). */
export const STATUS_TONE: Record<TxStatus, 'ok' | 'gsp' | 'you' | 'bad' | 'uni' | 'grey'> = {
  Expected: 'grey',
  Credited: 'grey',
  'Ready to invoice': 'you',
  'Ready to request': 'you',
  'Invoice requested': 'uni',
  Invoiced: 'gsp',
  Overdue: 'bad',
  'Part paid': 'bad',
  Held: 'bad',
  'On hold': 'bad',
  'Sent back': 'bad',
  Paid: 'ok',
  'Not payable': 'bad',
  'Waiting for university': 'uni',
  'Invoice in review': 'gsp',
  Approved: 'gsp',
  'Overdue to pay': 'bad',
  'To recover': 'you',
  Recovered: 'ok',
};

/**
 * What the engine can't price safely (the sandbox's exceptions, Jovial 10 Nov, D10 and D11): each holds its lines until
 * Finance fixes the terms or the application. `hold`: the lines are held; otherwise it's a warning. A rule, like the
 * statuses, not a list anyone keeps.
 */
// Q148 (Jovial, 16 Nov): six left, all gaps in a contract or in Setup; Key details are required at the right stage instead
export const EXCEPTIONS = [
  { type: 'Rate missing', hold: true, fix: 'terms' },
  { type: 'No terms', hold: true, fix: 'terms' },
  { type: 'Contract ended', hold: true, fix: null },
  { type: 'Agreement not yet in force', hold: true, fix: null },
  { type: 'RP terms not in force', hold: true, fix: 'rps' },
] as const;
export type ExceptionType = (typeof EXCEPTIONS)[number]['type'];
export type Exc = { app: string; type: ExceptionType; text: string; hold: boolean };

/* ---------- what people do (records the statuses are worked out from) ---------- */

/** GSP's invoice to a university, raised on Commission lines. */
export type UniInvoice = { number: string; uni: string; date: string; txs: string[]; by: string; at: number; sent?: { from: string; to: string; by: string; at: number } };
/**
 * A payment received from a university (Jovial, 10 Nov, Q44): what came in for each line it covers (`paid`), and for a
 * line paid short, why (`short`, one of Settings' part-payment reasons). A line is Paid once what came in for it,
 * over all receipts, reaches its amount, or the rest is written off.
 */
export type Receipt = { id: string; uni: string; txs: string[]; amount: number | null; paid: Record<string, number>; short: Record<string, string>; date: string; by: string; at: number };
/** The rest of a line paid short, written off by Finance (the same person may do it): the line counts as Paid. */
/** A note on an unpaid university invoice (18 Nov): the latest per invoice counts. */
export type FollowUp = { invoice: string; expected: string; comment: string; escalate: boolean; by: string; at: number };
export type WriteOff = { id: string; tx: string; amount: number; reason: string; by: string; at: number };
/**
 * A university takes back commission it paid GSP on a line (the commissions team, 11 Nov, R106): GSP recovers the
 * RP's share of it (what was shared with the RP), set against the RP's next payments. No time limit.
 */
export type Clawback = { id: string; tx: string; amount: number; reason: string; date: string; by: string; at: number };
/**
 * A credit note (Jovial, 17 Nov, after the Finance demo): GSP reverses invoiced lines in full, never editing the invoice
 * (the month is closed in Xero). Numbered CN-{invoice}. Each credited line's place is taken by a new line: at the
 * `revised` amount when the university's statement gives one (with the fee it used, `fees`), else as worked out; with
 * `reissue`, the new lines go on that new invoice at once. A withdrawal's credit note has no reissue: the new lines are
 * Not payable.
 */
export type CreditNote = { number: string; invoice: string; uni: string; date: string; txs: string[]; revised: Record<string, number>; fees: Record<string, number>; reason: string; reissue?: string; by: string; at: number };
/**
 * Finance records that a student withdrew (17 Nov): the university said so, usually in reply to an invoice. The
 * application's stage doesn't change. Lines triggered after the date are Not payable; invoiced ones are credited.
 */
export type Withdrawal = { id: string; app: string; date: string; reason: string; by: string; at: number; file?: FileRef };
/** A line Finance adds to an application by hand (17 Nov): what the rules don't make. A University → GSP line gives the RP its usual share. */
export type ManualLine = { id: string; app: string; side: Side; type: TxType; amount: number; period?: number; date: string; reason: string; by: string; at: number };
/** Commissions asked an RP for its invoice. */
export type InvoiceRequest = { id: string; rp: string; txs: string[]; date: string; by: string; at: number };
export const RP_INVOICE_STATES = ['To check', 'Accepted', 'Sent back'] as const;
export type RpInvoiceState = (typeof RP_INVOICE_STATES)[number];
/** The RP's invoice: one file, covering the requested lines it ticked. */
export type RpInvoice = { id: string; rp: string; file: FileRef; txs: string[]; by: string; at: number; state: RpInvoiceState; reason?: string; decided?: Stamp };
/** GSP paid an RP for some lines. */
/**
 * GSP's payment to an RP. `recovered` (Jovial, 13 Nov, Q123): how much of each recovery this payment set off, when it
 * couldn't take all of it (the rest stays To recover); a recovery listed without it was set off in full. `repaid`: the RP
 * paid a recovery back itself, after GSP's debit note (Q118).
 */
export type RpPayment = { id: string; rp: string; txs: string[]; date: string; by: string; at: number; recovered?: Record<string, number>; repaid?: boolean; /** Lav, 18 Nov: what GSP actually paid, in the currency the RP asked for, and the rate used (from the lines' currency). */ paid?: { currency: string; amount: number; rate?: number } };
/** GSP's debit note to an RP (Jovial, 13 Nov, Q118/Q125): asks it to pay back recoveries GSP had nothing to set against. */
export type DebitNote = { id: string; number: string; rp: string; txs: string[]; date: string; by: string; at: number };
/** An override on one line: its amount, due date and hold, and why. The latest for a line counts. */
/** A line Finance marked Not payable by hand (17 Nov, the Finance demo): the university said so, say. Lifted by `lifted`. */
export type NotPayable = { id: string; tx: string; reason: string; by: string; at: number; lifted?: { by: string; at: number } };
export type Override = { id: string; tx: string; amount: number | null; due: string | null; hold: boolean; reason: string; by: string; at: number };
/** Finance confirmed the student is still studying, so a study period after the first can be invoiced (Jovial, 10 Nov, D19). */
export type Confirm = { app: string; period: number; by: string; at: number };
/** A tier period Finance closed (Q68): the tier (university or group name) and its window, recounted at the period end. */
/** A line's amount changed (D21): the RP sees its lines' history. */
export type AmountChange = { tx: string; at: number; from: number; to: number };

/** The Logs at each Setup tab's foot, and each line's history: who did what, when. */
export const LOG_AREAS = ['rps', 'agreements', 'notices', 'terms', 'groups', 'settings', 'lines'] as const;
export type LogArea = (typeof LOG_AREAS)[number];
export type Log = { id: string; at: number; by: string; area: LogArea; text: string; txs?: string[]; rp?: string; uni?: string };
/** A download, for Admin › Logs. */
export type Download = { id: string; at: number; who: string; email: string; role: string; region: string; area: string; text: string; filters: string; records: number; format: string };

/**
 * A line as it stood when it was invoiced (University → GSP) or its invoice requested (GSP → RP) (Jovial, 9 Nov):
 * from then on its amount and what it's for never change. `base`: the amount worked out then (before any override),
 * which later work-outs are compared with: any difference becomes an Adjustment line. `final`: it's Paid, and its
 * amount and due date are as paid, overrides and all.
 */
export type Frozen = { key: string; app: string; side: Side; type: TxType; what: string; rpWhat: string; base: number; amount: number; currency: string; due: string; trigger: string; period?: number; matches?: string; notice?: string; adjusts?: string; final?: boolean; at: number; trace?: Step[]; gst?: number };
/** One step of how a line is worked out: a heading and plain words with the numbers (the sandbox's trace). GSP's views only. */
export type Step = { h: string; t: string };

/** Everything the module keeps. */
export type CommState = {
  settings: Settings;
  agreements: Agreement[];
  records: RpRecord[];
  notices: Notice[];
  terms: UniTerms[];
  groups: UniGroup[];
  enrolments: Enrolment[];
  invoices: UniInvoice[];
  receipts: Receipt[];
  requests: InvoiceRequest[];
  rpInvoices: RpInvoice[];
  debitNotes?: DebitNote[];
  rpPayments: RpPayment[];
  writeOffs: WriteOff[];
  /** 18 Nov (Jovial, AR ageing): the team's notes while chasing an unpaid invoice: when the university says it'll pay, a comment, and whether to escalate. */
  followUps?: FollowUp[];
  clawbacks?: Clawback[];
  credits?: CreditNote[];
  withdrawals?: Withdrawal[];
  manual?: ManualLine[];
  /** Suman, 18 Nov: an RP line moved to follow another university line (its bill number and when it's payable), with why. */
  follows?: { tx: string; uni: string; reason: string; by: string; at: number }[];
  overrides: Override[];
  /** 17 Nov: lines Finance marked Not payable by hand, with its reason. */
  notPayable?: NotPayable[];
  confirms: Confirm[];
  /** Each line's last worked-out amount, and its changes (D21). */
  seen: Record<string, number>;
  history: AmountChange[];
  /** Each line's transaction ID, given once (Jovial, 9 Nov), by what the line is for (its key); `idSeq`: the last one given. */
  ids: Record<string, string>;
  idSeq: number;
  /** Lines invoiced, requested or paid, by transaction ID: what they were then. */
  frozen: Record<string, Frozen>;
  logs: Log[];
  downloads: Download[];
};

/* ---------- words ---------- */

/** A currency's smallest unit, as decimal places (2 for AUD, 0 for JPY), from the currency's own definition. */
export const minorUnits = (cur: string) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};
/**
 * Rounding (Jovial, 10 Nov, Q62): each line rounds half up to its currency's smallest unit; totals add the rounded lines;
 * no minimum payout. Half up away from zero, so a credit rounds like the amount it takes back.
 */
export const roundMoney = (n: number, cur = 'AUD') => {
  const d = minorUnits(cur);
  const f = 10 ** d;
  return (Math.sign(n) * Math.round(Math.abs(n) * f + 1e-9)) / f;
};
/** Suman, 18 Nov: a minus amount (a credit note, clawback or recovery) reads with a clear minus sign: −AUD 500. */
export const money = (n: number, cur: string) => `${n < 0 ? '−' : ''}${cur} ${Math.abs(n).toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
export const pct = (n: number) => `${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`;
/** "75% to 80%, by enrolments", "75% flat". */
export const bandsText = (b: Band[], unit = '%') => b.map((x) => `${x.from}${x.to === null ? '+' : `–${x.to}`}: ${x.pct}${unit}`).join(', ');
export const shareText = (t: Pick<AgreementTerms, 'shareType' | 'share' | 'bands'>) =>
  t.shareType === 'Flat' ? `${pct(t.share ?? 0)} flat` : t.bands.length ? `${pct(Math.min(...t.bands.map((b) => b.pct)))} to ${pct(Math.max(...t.bands.map((b) => b.pct)))}, by enrolments` : 'No bands yet';
export const benefitText = (n: Pick<Notice, 'benefit' | 'amount' | 'share' | 'bands' | 'milestones' | 'tuitionPct' | 'combine'>) =>
  (n.benefit === 'Bonus per enrolment'
    ? `${(n.amount ?? 0).toLocaleString('en-GB')} bonus per enrolment, in each university’s currency`
    : n.benefit === 'Tiered share'
      ? `Share ${bandsText(n.bands)}`
      : n.benefit === 'Milestone'
        ? `Milestones: ${(n.milestones ?? []).map((m) => `${m.count} enrolments → ${m.amount.toLocaleString('en-GB')}`).join(', ')}`
        : n.benefit === '% of tuition'
          ? `${pct(n.tuitionPct ?? 0)} of the tuition fee`
          : n.benefit === 'Share plus amount per enrolment'
            ? `Share ${pct(n.share ?? 0)} plus ${(n.amount ?? 0).toLocaleString('en-GB')} per enrolment`
            : `Share ${pct(n.share ?? 0)}`) + (n.combine && n.combine !== HIGHER && ['Share', 'Tiered share', 'Share plus amount per enrolment', '% of tuition'].includes(n.benefit) ? ` (${n.combine.toLowerCase()})` : '');
/** "3 Nov 2026". */
export const dayText = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const stampText = (s: Stamp) => `${s.by}, ${new Date(s.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
export const sizeText = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
/** "UG 15%, PG 17.5%": a university's rates by level, in the levels' order. */
export const ratesText = (t: Pick<TermsBody, 'rates' | 'fixed'>, cur: string) =>
  COMM_LEVELS.filter((l) => t.rates[l] !== undefined || t.fixed[l] !== undefined)
    .map((l) => `${l} ${t.fixed[l] !== undefined ? money(t.fixed[l]!, cur) : pct(t.rates[l]!)}`)
    .join(', ') || 'No rates';
/** "Per student, AUD 500", "On the 20th student, AUD 3,000", "By count: 10–14: AUD 800, 15+: AUD 1,200". */
export const bonusText = (b: BonusScheme, cur: string) => {
  const v = (kind: AddlKind, value: number) => (kind === '%' ? `${pct(value)} of the first-year fee` : money(value, cur));
  return b.per === 'Per student' ? `${v(b.kind, b.value)} per student` : b.per === 'At a number' ? `${v(b.kind, b.value)} once ${b.threshold} students enrol` : `By count: ${b.bands.map((x) => `${x.from}${x.to === null ? '+' : `–${x.to}`}: ${v(x.kind, x.value)}`).join(', ')}`;
};
/** "students from India, UG, intakes Jan 2027": a condition in words (empty: none). */
export const condText = (c?: Cond) =>
  !c
    ? ''
    : [
        c.regions?.length ? `students from ${c.regions.join(', ')}` : '',
        c.levels?.length ? c.levels.join(', ') : '',
        c.courses?.length ? `courses ${c.courses.join(', ')}` : '',
        c.campuses?.length ? `${c.campuses.join(', ')} campus` : '',
        c.intakes?.length ? `intakes ${c.intakes.join(', ')}` : '',
        c.from || c.to ? `intakes ${c.from ? `from ${c.from}` : ''}${c.to ? ` to ${c.to}` : ''}` : '',
      ]
        .filter(Boolean)
        .join('; ');
export const addlText = (a: Addl, cur: string) => `${a.desc}: ${a.kind === '%' ? `${pct(a.value)} of the fee` : money(a.value, cur)}, ${a.when.toLowerCase()}`;
