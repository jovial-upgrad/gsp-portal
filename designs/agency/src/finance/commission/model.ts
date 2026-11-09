/**
 * Commissions (Jovial, PM, 9 Nov: the PRD's Commissions tab). What GSP records about what each university pays it and
 * what it owes each RP. Commissions (GSP · Finance) keeps four kinds of record in Finance › Setup: agreement variants,
 * one commission record per RP, notices, and one set of terms per university. The RP keeps its bank account on
 * Earnings. Everything else (commission items, transactions, their statuses, due dates and amounts) is worked out by
 * the engine (engine.ts) from those records, the enrolled applications and the actions people take, and today's date.
 *
 * This module holds the shapes and every option list and status the pages show: no page has a list of its own.
 */
import { DESTINATIONS, LEVELS, type Destination, type Level } from '../../data/courses';
import type { AppFees } from '../../data/applications';

export { DESTINATIONS, LEVELS };
export type { Destination, Level };

/** A file someone uploaded: its name and size in bytes. */
export type FileRef = { name: string; size: number };
/** Who did something, and when (ms). */
export type Stamp = { by: string; at: number };

/* ---------- settings ---------- */

/**
 * The module's settings (seeded in seed.ts, kept in the store): GSP’s own name and address (RPs bill it; it bills universities), where disputes go,
 * how long a study period is, when the financial year starts, the largest file, how GSP numbers its invoices to
 * universities (Open question 2), and each RP country's usual bank currency.
 */
export type Settings = {
  gsp: { name: string; lines: string[] };
  disputeEmail: string;
  /** Months from one study period's start to the next. */
  periodMonths: number;
  /** The month (1–12) the financial year starts: 7 is 1 July to 30 June. */
  fyStart: number;
  maxFileMb: number;
  /** GSP's invoice to a university: {code}, {year} and {seq} filled in. */
  invoiceFormat: string;
  /** The RP's country's currency: Bank currency's default on Earnings. */
  countryCurrency: Record<string, string>;
  /** Every currency an RP can be paid in. */
  bankCurrencies: string[];
  /** Tax added to GSP's filled-in invoice for an RP registered for tax: its name and rate by the RP's country. */
  tax: Record<string, { name: string; pct: number }>;
};

/* ---------- agreements ---------- */

export const SHARE_TYPES = ['Flat', 'Tiered by enrolments'] as const;
export type ShareType = (typeof SHARE_TYPES)[number];
export const COUNTED_PER = ['Financial year', 'Calendar year', 'Intake'] as const;
export type CountedPer = (typeof COUNTED_PER)[number];
export const AGREEMENT_STATUSES = ['Active', 'Retired'] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];
export const YES_NO = ['No', 'Yes'] as const;

/** A band of enrolments and its share or rate: from and to (to null: and above). */
export type Band = { from: number; to: number | null; pct: number };

/** What an agreement says: the share, its bands, how they're counted, what's passed on, how soon GSP pays. */
export type AgreementTerms = {
  shareType: ShareType;
  share: number | null;
  bands: Band[];
  countedPer: CountedPer;
  retro: boolean;
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
/** An agreement's bonus: its description, amount and currency, and when (`nth`: the enrolment number, for At an enrolment number). */
export type AgreementBonus = { id: string; desc: string; amount: number; currency: string; when: AbWhen; nth: number | null };
/** An agreement variant. `earlier`: its terms before each edit, with the day they stopped (items made before keep them). */
export type Agreement = AgreementTerms & { id: string; name: string; status: AgreementStatus; created: Stamp; updated: Stamp; earlier: (AgreementTerms & { until: string })[] };

/* ---------- RP records and bank details ---------- */

/** One commission record per RP: its agreement from a date (`moves`: the agreements it was on before). */
export type RpRecord = { rp: string; agreement: string; from: string; tax: boolean; moves: { agreement: string; from: string }[]; created: Stamp; updated: Stamp };
/** The RP's bank account, as its RP Admin sets it on Earnings. */
/** `taxId`: the RP's GST or VAT number, for GSP's filled-in invoice (optional). */
export type Bank = { rp: string; bank: string; account: string; number: string; swift: string; address: string; currency: string; taxId?: string; updated: Stamp };
export const BANK_FIELDS: { key: keyof Omit<Bank, 'rp' | 'currency' | 'updated' | 'taxId'>; label: string; field: string }[] = [
  { key: 'bank', label: 'Bank name', field: 'bank name' },
  { key: 'account', label: 'Account name', field: 'account name' },
  { key: 'number', label: 'Account number', field: 'account number' },
  { key: 'swift', label: 'SWIFT or BSB', field: 'SWIFT or BSB' },
  { key: 'address', label: 'Bank address', field: 'bank address' },
];

/* ---------- notices ---------- */

export const BENEFITS = ['Bonus per enrolment', 'Share instead of the agreement’s', 'Tiered share'] as const;
export type Benefit = (typeof BENEFITS)[number];
export const NOTICE_STATUSES = ['Upcoming', 'Active', 'Ended'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];
export type Notice = {
  id: string;
  name: string;
  doc: FileRef;
  starts: string;
  ends: string;
  dests: Destination[];
  unis: string[];
  levels: Level[];
  benefit: Benefit;
  amount: number | null;
  currency: string;
  share: number | null;
  bands: Band[];
  retro: boolean;
  /** The RPs (by id) that may use it. */
  rps: string[];
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
  { label: 'Tuition paid', field: 'paid', date: 'Tuition paid on' },
] as const satisfies readonly { label: string; field: keyof Pick<AppFees, 'census' | 'confirmed' | 'paid'>; date: string }[];
export type Trigger = (typeof TRIGGERS)[number]['label'];
export const TRIGGER_LABELS = TRIGGERS.map((t) => t.label) as Trigger[];
export const ADDL_KINDS = ['Amount', '%'] as const;
export type AddlKind = (typeof ADDL_KINDS)[number];
/** When an additional commission is earned: on enrolment, or with study period 1's trigger. */
export const ADDL_WHEN = ['On enrolment', 'With study period 1'] as const;
export type AddlWhen = (typeof ADDL_WHEN)[number];
export type Addl = { id: string; desc: string; kind: AddlKind; value: number; when: AddlWhen };
/** A bonus the university pays once `min` students enrol with it in `year`: on the application that reaches it. */
export type Bonus = { id: string; desc: string; amount: number; min: number; year: number };
export type TermsBody = {
  rates: Partial<Record<Level, number>>;
  feeBasis: FeeBasis;
  fixed: Partial<Record<Level, number>>;
  trigger: Trigger;
  inst: number;
  payDays: number;
  cap: number | null;
  bands: Band[];
  addl: Addl[];
  bonus: Bonus[];
  contract: FileRef;
  notes: string;
};
export type UniTerms = TermsBody & { uni: string; created: Stamp; updated: Stamp; earlier: (TermsBody & { until: string })[] };

/* ---------- enrolled applications ---------- */

/**
 * An enrolled application, as the engine reads it: from the portal's applications (status Student enrolled) or the
 * seeded records of other RPs' enrolments. `withdrawn`: the day the student withdrew, if they did.
 */
export type Enrolment = { app: string; student: string; rp: string; course: string; intake: string; enrolled: string; withdrawn?: string; fees?: AppFees };

/* ---------- transactions ---------- */

export type Side = 'uni' | 'rp';
export const SIDES: Record<Side, string> = { uni: 'University → GSP', rp: 'GSP → RP' };
export const SIDE_KEYS = Object.keys(SIDES) as Side[];
/** Adjustment: the difference when a line's worked-out amount changes after it was invoiced, requested or paid (Jovial, 9 Nov). */
export const TX_TYPES = ['Course commission', 'Additional commission', 'Bonus', 'Adjustment'] as const;
export type TxType = (typeof TX_TYPES)[number];

export const UNI_STATUSES = ['Expected', 'Ready to invoice', 'Invoiced', 'Overdue', 'Held', 'Paid', 'Not payable'] as const;
export const RP_STATUSES = ['Expected', 'Ready to pay', 'Invoice requested', 'Invoice received', 'Held', 'Paid', 'Not payable'] as const;
export type UniStatus = (typeof UNI_STATUSES)[number];
export type RpStatus = (typeof RP_STATUSES)[number];
export type TxStatus = UniStatus | RpStatus;
export const STATUSES_OF: Record<Side, readonly TxStatus[]> = { uni: UNI_STATUSES, rp: RP_STATUSES };

/** The status groups (the Commission lines page's tabs, but Not counted, which shows under All). */
export const GROUPS = [
  { key: 'estimate', label: 'Estimate', uni: ['Expected'], rp: ['Expected'], tab: true },
  { key: 'progress', label: 'In progress', uni: ['Ready to invoice', 'Invoiced', 'Overdue', 'Held'], rp: ['Ready to pay', 'Invoice requested', 'Invoice received', 'Held'], tab: true },
  { key: 'paid', label: 'Paid', uni: ['Paid'], rp: ['Paid'], tab: true },
  { key: 'none', label: 'Not counted', uni: ['Not payable'], rp: ['Not payable'], tab: false },
] as const satisfies readonly { key: string; label: string; uni: readonly UniStatus[]; rp: readonly RpStatus[]; tab: boolean }[];
export type GroupKey = (typeof GROUPS)[number]['key'];
export const groupOf = (side: Side, s: TxStatus): GroupKey | undefined => GROUPS.find((g) => (g[side] as readonly string[]).includes(s))?.key;
/** The Commission lines page's status tabs: All, then each group that's a tab. */
export const LINE_TABS: { key: GroupKey | 'all'; label: string }[] = [{ key: 'all', label: 'All' }, ...GROUPS.filter((g) => g.tab).map((g) => ({ key: g.key, label: g.label }))];

/** Which lines each Commission lines action takes (the PRD's Actions table). */
export const ACTION_FROM = {
  raise: ['Ready to invoice'],
  record: ['Invoiced', 'Overdue'],
  request: ['Ready to pay'],
  pay: ['Invoice received'],
} as const satisfies Record<string, readonly TxStatus[]>;
/** The RP's lines GSP asked it to invoice (Earnings' Invoices to send). */
export const REQUESTED: RpStatus = 'Invoice requested';
/** Held lines: In progress, but not ready (Earnings leaves them out of Ready to pay). */
export const HELD: TxStatus = 'Held';
/** Each status's colour (as Pill tones). */
export const STATUS_TONE: Record<TxStatus, 'ok' | 'gsp' | 'you' | 'bad' | 'uni' | 'grey'> = {
  Expected: 'grey',
  'Ready to invoice': 'you',
  Invoiced: 'gsp',
  Overdue: 'bad',
  Held: 'bad',
  Paid: 'ok',
  'Not payable': 'grey',
  'Ready to pay': 'you',
  'Invoice requested': 'uni',
  'Invoice received': 'gsp',
};

/* ---------- what people do (records the statuses are worked out from) ---------- */

/** GSP's invoice to a university, raised on Commission lines. */
export type UniInvoice = { number: string; uni: string; date: string; txs: string[]; by: string; at: number };
/** A payment received from a university. */
export type Receipt = { id: string; uni: string; txs: string[]; amount: number | null; date: string; by: string; at: number };
/** Commissions asked an RP for its invoice. */
export type InvoiceRequest = { id: string; rp: string; txs: string[]; date: string; by: string; at: number };
export const RP_INVOICE_STATES = ['To check', 'Accepted', 'Sent back'] as const;
export type RpInvoiceState = (typeof RP_INVOICE_STATES)[number];
/** The RP's invoice: one file, covering the requested lines it ticked. */
export type RpInvoice = { id: string; rp: string; file: FileRef; txs: string[]; by: string; at: number; state: RpInvoiceState; reason?: string; decided?: Stamp };
/** GSP paid an RP for some lines. */
export type RpPayment = { id: string; rp: string; txs: string[]; date: string; by: string; at: number };
/** An override on one line: its amount, due date and hold, and why. The latest for a line counts. */
export type Override = { id: string; tx: string; amount: number | null; due: string | null; hold: boolean; reason: string; by: string; at: number };

/** The Logs at each Setup tab's foot, and each line's history: who did what, when. */
export const LOG_AREAS = ['rps', 'agreements', 'notices', 'terms', 'lines', 'bank'] as const;
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
export type Frozen = { key: string; app: string; side: Side; type: TxType; what: string; rpWhat: string; base: number; amount: number; currency: string; due: string; trigger: string; period?: number; matches?: string; notice?: string; adjusts?: string; final?: boolean; at: number };

/** Everything the module keeps. */
export type CommState = {
  settings: Settings;
  agreements: Agreement[];
  records: RpRecord[];
  banks: Bank[];
  notices: Notice[];
  terms: UniTerms[];
  enrolments: Enrolment[];
  invoices: UniInvoice[];
  receipts: Receipt[];
  requests: InvoiceRequest[];
  rpInvoices: RpInvoice[];
  rpPayments: RpPayment[];
  overrides: Override[];
  /** Each line's transaction ID, given once (Jovial, 9 Nov), by what the line is for (its key); `idSeq`: the last one given. */
  ids: Record<string, string>;
  idSeq: number;
  /** Lines invoiced, requested or paid, by transaction ID: what they were then. */
  frozen: Record<string, Frozen>;
  logs: Log[];
  downloads: Download[];
};

/* ---------- words ---------- */

export const money = (n: number, cur: string) => `${cur} ${n.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
export const pct = (n: number) => `${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`;
/** "75% to 80%, by enrolments", "75% flat". */
export const bandsText = (b: Band[], unit = '%') => b.map((x) => `${x.from}${x.to === null ? '+' : `–${x.to}`}: ${x.pct}${unit}`).join(', ');
export const shareText = (t: Pick<AgreementTerms, 'shareType' | 'share' | 'bands'>) =>
  t.shareType === 'Flat' ? `${pct(t.share ?? 0)} flat` : t.bands.length ? `${pct(Math.min(...t.bands.map((b) => b.pct)))} to ${pct(Math.max(...t.bands.map((b) => b.pct)))}, by enrolments` : 'No bands yet';
export const benefitText = (n: Pick<Notice, 'benefit' | 'amount' | 'currency' | 'share' | 'bands'>) =>
  n.benefit === 'Bonus per enrolment' ? `${money(n.amount ?? 0, n.currency)} bonus per enrolment` : n.benefit === 'Tiered share' ? `Share ${bandsText(n.bands)}` : `Share ${pct(n.share ?? 0)}`;
/** "3 Nov 2026". */
export const dayText = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const stampText = (s: Stamp) => `${s.by}, ${new Date(s.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
export const sizeText = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
/** "UG 15%, PG 17.5%": a university's rates by level, in the levels' order. */
export const ratesText = (t: Pick<TermsBody, 'rates' | 'fixed'>, cur: string) =>
  LEVELS.filter((l) => t.rates[l] !== undefined || t.fixed[l] !== undefined)
    .map((l) => `${l} ${t.fixed[l] !== undefined ? money(t.fixed[l]!, cur) : pct(t.rates[l]!)}`)
    .join(', ') || 'No rates';
export const bonusCondition = (b: Pick<Bonus, 'min' | 'year'>) => `when ${b.min} students enrol in ${b.year}`;
export const addlText = (a: Addl, cur: string) => `${a.desc}: ${a.kind === '%' ? `${pct(a.value)} of the fee` : money(a.value, cur)}, ${a.when.toLowerCase()}`;
