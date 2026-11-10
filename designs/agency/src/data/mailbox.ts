import { courseOf, type Application } from './applications';
import { fullName, type Student } from './students';

/**
 * Inbox (Nesil, 3 Nov): GSP's shared email groups, the mail each one holds, and which of them a person has
 * connected. Every GSP role has the page (GSP Team, GSP · Institution, GSP · Admin); RP Admin doesn't. The groups
 * are the ones GSP's mail tool filters by today. In the product they sync from Microsoft 365; here each one
 * brings its own sample mail when it's connected.
 */
export type MailGroup = { key: string; name: string; email: string };

export const MAIL_GROUPS: MailGroup[] = [
  { key: 'commission', name: 'GSP Commission', email: 'commission@gsp.upgrad.com' },
  { key: 'admission', name: 'GSP Admission', email: 'admission@gsp.upgrad.com' },
  { key: 'training', name: 'GSP Training', email: 'training@gsp.upgrad.com' },
  { key: 'recruitment', name: 'GSP Recruitment', email: 'recruitment@gsp.upgrad.com' },
  { key: 'bap', name: 'BAP', email: 'bap@gsp.upgrad.com' },
  { key: 'calendar', name: 'Recruitment Calendar Sync', email: 'recruitment.calendar@gsp.upgrad.com' },
  { key: 'support', name: 'System Supports', email: 'support@gsp.upgrad.com' },
  { key: 'services', name: 'GSP Student Services', email: 'studentservices@gsp.upgrad.com' },
  { key: 'admission-temp', name: 'Admission Temp', email: 'admission.temp@gsp.upgrad.com' },
  { key: 'commissions-temp', name: 'Commissions Temp', email: 'commissions.temp@gsp.upgrad.com' },
  // Jovial, 10 Nov (Q30): the compliance inbox's address; university marketing mail is forwarded here
  { key: 'compliance', name: 'GSP Compliance', email: 'compliance.gsp@upgrad.com' },
  { key: 'data', name: 'Data-Team', email: 'data.team@gsp.upgrad.com' },
  { key: 'vn', name: 'VN Admission', email: 'admission.vn@gsp.upgrad.com' },
  { key: 'ph', name: 'PH Admissions', email: 'admissions.ph@gsp.upgrad.com' },
];
export const groupOf = (key: string) => MAIL_GROUPS.find((g) => g.key === key);
/** Mail started from an application record goes out only from GSP Admission (Jovial, 10 Nov, Q29). */
export const APPLICATION_MAILBOX = 'admission';
/** Its subject starts with the application's GSP ID, then the university's reference when there is one. */
export const appSubjectTag = (a: { id: string; uniRef?: string }) => [a.id, a.uniRef].filter(Boolean).join(' · ');
export const withAppTag = (a: { id: string; uniRef?: string }, subject: string) => {
  const s = subject.trim();
  return s.includes(a.id) ? s : `${appSubjectTag(a)} · ${s || '(No subject)'}`;
};

/** Which inboxes each role starts with; the rest can be connected from the page. */
export type MailRole = 'gsp-team' | 'institution' | 'admin' | 'rp-ops' | 'finance' | 'globalops';
const STARTS: Record<MailRole, string[]> = {
  'gsp-team': ['admission', 'admission-temp', 'vn', 'ph', 'services'],
  institution: ['data', 'compliance', 'training'],
  admin: MAIL_GROUPS.map((g) => g.key),
  // RP Ops (4 Nov): the recruitment partners' side of GSP
  'rp-ops': ['recruitment', 'commission', 'bap'],
  // GSP · Finance (6 Nov): the commission inboxes
  finance: ['commission', 'commissions-temp'],
  // GSP · Global Ops (6 Nov): admissions, student services and support
  globalops: ['admission', 'services', 'support'],
};

export type Folder = 'inbox' | 'sent' | 'draft' | 'archive';
/** A file on a mail: its name as it reads, the file, and its size in KB. */
export type Attachment = { name: string; file: string; kb: number };
/**
 * A message earlier in a mail's thread (Nesil, 5 Nov): replies and follow-ups between GSP and a university or a
 * partner. The mail itself is the latest message; its thread holds the ones before it, oldest first.
 */
export type ThreadMsg = { id: string; from: { name: string; email: string }; to: string[]; cc?: string[]; body: string; at: number; files?: Attachment[] };
export type BoxMail = {
  id: string;
  /** The email group it's in. */
  group: string;
  folder: Folder;
  from: { name: string; email: string };
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  at: number;
  read: boolean;
  files?: Attachment[];
  /** GSP Assist's summary, a line each; read from the text when there's none. */
  summary?: string[];
  /** The application it's about, to open from the mail. */
  app?: string;
  /** The messages before this one in its thread, oldest first. */
  thread?: ThreadMsg[];
  /** GSP sorted it as miscellaneous: not about an application (training, finance runs, invites, course data). */
  other?: boolean;
  /** Forwarded to another of GSP's inboxes: which one, who forwarded it and when. */
  forwarded?: { to: string; by: string; at: number };
  /** A copy forwarded here from another inbox: where from, who forwarded it and when. */
  via?: { from: string; by: string; at: number };
  /** Marked Not needed (spam or junk) instead of linking or forwarding it (Jovial, 10 Nov, Q31): who and when, kept on the mail. */
  notNeeded?: { by: string; at: number };
};

/**
 * The categories GSP sorts mail into as it arrives (Nesil, 5 Nov). Linked to an application: matched to one, or
 * linked by hand. Forwarded: sent on to another inbox. Others: miscellaneous, not about an application. Not linked:
 * what GSP couldn't place; it waits for someone to link it to an application or forward it.
 */
export type MailCategory = 'unlinked' | 'linked' | 'forwarded' | 'other';
export const CATEGORIES: { key: MailCategory; label: string }[] = [
  { key: 'unlinked', label: 'Not linked' },
  { key: 'linked', label: 'Linked to an application' },
  { key: 'forwarded', label: 'Forwarded' },
  { key: 'other', label: 'Others' },
];
export const categoryOf = (m: BoxMail): MailCategory => (m.app ? 'linked' : m.forwarded ? 'forwarded' : m.other || m.notNeeded ? 'other' : 'unlinked');
/** Every message in a mail's thread, oldest first, the mail itself last. */
export const messagesOf = (m: BoxMail): ThreadMsg[] => [...(m.thread ?? []), { id: m.id, from: m.from, to: m.to, cc: m.cc, body: m.body, at: m.at, files: m.files }];
/** Who wrote in a thread, in the order they first wrote; GSP's own people as "me" when it's the signed-in person. */
export const peopleOf = (m: BoxMail, me: string) => [...new Set(messagesOf(m).map((x) => (x.from.name === me ? 'me' : x.from.name)))];
/** A connected inbox: the group, and the date its mail syncs from. */
export type Connection = { group: string; since: number };
export type Mailbox = { connected: Connection[]; mails: BoxMail[] };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** The sync's start, as offered when an inbox is connected. */
export const SINCE: { days: number; label: string }[] = [
  { days: 7, label: 'The last 7 days' },
  { days: 30, label: 'The last 30 days' },
  { days: 90, label: 'The last 90 days' },
];

const first = (name: string) => name.split(' ')[0];
const slug = (t: string) => t.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

type Ctx = { apps: Application[]; students: Student[]; me: { name: string; email: string }; now: number };

/** A university's mail address, from its website. */
const uniMail = (a: Application, box: string) => {
  const web = (courseOf(a).uni.website ?? 'university.edu').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  return `${box}@${web}`;
};

/** GSP Admission: the universities' mail about the applications GSP has submitted, and what GSP sent them. */
function admission(c: Ctx): BoxMail[] {
  const g = groupOf('admission')!;
  const out: BoxMail[] = [];
  const who = (a: Application) => c.students.find((s) => s.id === a.studentId);
  const pick = (test: (a: Application) => boolean) => c.apps.find((a) => test(a) && who(a));
  let t = c.now;
  const at = (gap: number) => (t -= gap);

  const offer = pick((a) => ['conditions', 'condsent', 'uol'].includes(a.status));
  if (offer) {
    const s = who(offer)!;
    const co = courseOf(offer);
    const name = fullName(s);
    out.push({
      id: `adm-offer-${offer.id}`,
      group: g.key,
      folder: 'inbox',
      from: { name: `${co.uni.name} Offers`, email: uniMail(offer, 'offers') },
      to: [g.email],
      subject: `Conditional offer: ${name}${offer.uniRef ? ` (${offer.uniRef})` : ''}`,
      body: `Dear GSP Admissions team,\n\nWe are pleased to make ${name} a conditional offer of admission to the ${co.name}, starting ${offer.intake}.\n\nThe offer is subject to the conditions listed in the attached letter. Please return the signed acceptance with the conditions met.\n\nKind regards,\nAdmissions Offers\n${co.uni.name}`,
      at: at(38 * MIN),
      read: false,
      files: [{ name: 'Conditional offer letter', file: `Conditional_Offer_${slug(name)}.pdf`, kb: 246 }],
      summary: [`${co.uni.name} has made ${s.first} a conditional offer for the ${co.name}, ${offer.intake}.`, 'The conditions are in the attached letter.', 'The signed acceptance goes back once they are met.'],
      app: offer.id,
    });
  }
  // 5 Nov: a thread, the university and GSP Admissions settling an offer's conditions over five mails
  // it follows a real application where one fits, and fixed sample details where none does
  const th = pick((a) => a !== offer && ['conditions', 'condsent'].includes(a.status)) ?? offer;
  {
    const st = th ? who(th)! : undefined;
    const s = { first: st?.first ?? 'Kavya' };
    const co = th ? courseOf(th) : { name: 'Master of Data Science', uni: { name: 'Deakin University' } };
    const name = st ? fullName(st) : 'Kavya Iyer';
    const intake = th?.intake ?? 'March 2027';
    const ref = th?.uniRef ?? 'DU-2027-48113';
    const uni = { name: `${co.uni.name} Offers`, email: th ? uniMail(th, 'offers') : 'offers@deakin.edu.au' };
    const key = th?.id ?? 'sample';
    const gsp = { name: 'Alfiya Khan', email: g.email };
    const sign = `Kind regards,\nAlfiya Khan\nGSP Admissions`;
    const uniSign = `Kind regards,\nAdmissions Offers\n${co.uni.name}`;
    const t0 = c.now;
    out.push({
      id: `adm-thread-${key}`,
      group: g.key,
      folder: 'inbox',
      from: uni,
      to: [g.email],
      subject: `Re: Conditions on ${name}’s offer (${ref})`,
      body: `Dear Alfiya,\n\nThank you. Both conditions are now met. ${name}’s unconditional offer will follow within 3 working days.\n\n${uniSign}`,
      at: t0 - 25 * MIN,
      read: false,
      summary: [`${co.uni.name} confirms both of ${s.first}’s offer conditions are met.`, 'The unconditional offer follows within 3 working days.', `It accepted PTE Academic 62 (no skill below 54) in place of IELTS.`],
      app: th?.id,
      thread: [
        { id: `adm-thread-${key}-1`, from: uni, to: [g.email], at: t0 - 3 * DAY, body: `Dear GSP Admissions team,\n\nWe are pleased to make ${name} a conditional offer for the ${co.name}, ${intake}. The conditions are:\n\n1. IELTS Academic 6.5 overall, with no band below 6.0\n2. The final semester transcript\n\nThe offer letter is attached.\n\n${uniSign}`, files: [{ name: 'Conditional offer letter', file: `Conditional_Offer_${slug(name)}.pdf`, kb: 238 }] },
        { id: `adm-thread-${key}-2`, from: gsp, to: [uni.email], at: t0 - 2 * DAY, body: `Dear Admissions Offers team,\n\nThank you for the offer. ${s.first} has IELTS Academic 6.5 overall, but Writing is 5.5. Would you accept a PTE Academic score of 62 overall instead?\n\n${sign}` },
        { id: `adm-thread-${key}-3`, from: uni, to: [g.email], at: t0 - 1 * DAY, body: `Dear Alfiya,\n\nYes: we can accept PTE Academic 62 overall, with no communicative skill below 54. Please send the score report and the final transcript by 30 November.\n\n${uniSign}` },
        { id: `adm-thread-${key}-4`, from: gsp, to: [uni.email], at: t0 - 5 * HOUR, body: `Dear Admissions Offers team,\n\nThe PTE score report (62 overall, lowest skill 58) and the final transcript are attached. Please confirm both conditions are met.\n\n${sign}`, files: [{ name: 'PTE Academic score report', file: `PTE_Score_Report_${slug(name)}.pdf`, kb: 182 }, { name: 'Final transcript', file: `Final_Transcript_${slug(name)}.pdf`, kb: 310 }] },
      ],
    });
  }
  const lodged = c.apps.filter((a) => a.status === 'lodged' && a.uniRef && who(a));
  lodged.slice(0, 2).forEach((a, i) => {
    const s = who(a)!;
    const co = courseOf(a);
    out.push({
      id: `adm-ack-${a.id}`,
      group: g.key,
      folder: 'inbox',
      from: { name: `${co.uni.name} Admissions`, email: uniMail(a, 'admissions') },
      to: [g.email],
      subject: `Application received: ${fullName(s)}, ${a.uniRef}`,
      body: `Dear GSP Admissions team,\n\nThank you for ${fullName(s)}'s application for the ${co.name}, ${a.intake}. Our reference is ${a.uniRef}: please quote it in every email.\n\nWe will be in touch with a decision.\n\nKind regards,\nInternational Admissions\n${co.uni.name}`,
      at: at(i ? 26 * HOUR : 3 * HOUR),
      read: i > 0,
      summary: [`${co.uni.name} has received ${s.first}'s application for the ${co.name}.`, `Their reference is ${a.uniRef}.`, 'A decision follows by mail.'],
      app: a.id,
    });
  });
  const check = pick((a) => a.status === 'checking');
  if (check) {
    const s = who(check)!;
    const co = courseOf(check);
    out.push({
      id: `adm-info-${check.id}`,
      group: g.key,
      folder: 'inbox',
      from: { name: `${co.uni.name} Admissions`, email: uniMail(check, 'admissions') },
      to: [g.email],
      cc: [c.me.email],
      subject: `More information needed: ${fullName(s)}`,
      body: `Dear GSP Admissions team,\n\nTo finish assessing ${fullName(s)}'s application for the ${co.name}, please send a short statement explaining the gap in study since the last qualification, and the final semester transcript.\n\nPlease reply within 7 days.\n\nKind regards,\nInternational Admissions\n${co.uni.name}`,
      at: at(5 * HOUR),
      read: false,
      summary: [`${co.uni.name} needs two more things for ${s.first}: a gap statement and the final transcript.`, 'They ask for a reply within 7 days.'],
      app: check.id,
    });
  }
  const visa = pick((a) => ['visa', 'visasub', 'startdate'].includes(a.status));
  if (visa) {
    const s = who(visa)!;
    const co = courseOf(visa);
    out.push({
      id: `adm-coe-${visa.id}`,
      group: g.key,
      folder: 'inbox',
      from: { name: `${co.uni.name} Admissions`, email: uniMail(visa, 'admissions') },
      to: [g.email],
      subject: `Confirmation of Enrolment issued: ${fullName(s)}`,
      body: `Dear GSP Admissions team,\n\nPlease find attached the Confirmation of Enrolment for ${fullName(s)}, ${co.name}, ${visa.intake}. The student can now apply for the visa.\n\nKind regards,\nInternational Admissions\n${co.uni.name}`,
      at: at(DAY),
      read: true,
      files: [{ name: 'Confirmation of Enrolment', file: `CoE_${slug(fullName(s))}.pdf`, kb: 182 }],
      app: visa.id,
    });
  }
  if (offer) {
    const co = courseOf(offer);
    out.push({
      id: `adm-sent-${offer.id}`,
      group: g.key,
      folder: 'sent',
      from: { name: c.me.name, email: g.email },
      to: [uniMail(offer, 'admissions')],
      subject: `Re: Conditional offer: ${fullName(who(offer)!)}`,
      body: `Dear ${co.uni.name} Admissions,\n\nThank you for the offer. We have shared the conditions with the student's counsellor and will send the signed acceptance once they are met.\n\nKind regards,\n${c.me.name}\nGSP Admission`,
      at: c.now - 20 * MIN,
      read: true,
      app: offer.id,
    });
  }
  out.push({
    id: 'adm-draft-1',
    group: g.key,
    folder: 'draft',
    from: { name: c.me.name, email: g.email },
    to: ['international.admissions@coventry.ac.uk'],
    subject: 'Decision timeline for the January intake',
    other: true,
    body: `Dear Coventry Admissions,\n\nCould you tell us when we can expect decisions on the applications we submitted last week for the January 2027 intake?\n\n`,
    at: c.now - 2 * HOUR,
    read: true,
  });
  return out;
}

type SeedMsg = Omit<ThreadMsg, 'id' | 'at'> & { ago: number };
type Seed = Omit<BoxMail, 'id' | 'group' | 'at' | 'to' | 'folder' | 'read' | 'thread' | 'forwarded'> & {
  ago: number;
  folder?: Folder;
  read?: boolean;
  to?: string[];
  thread?: SeedMsg[];
  forwarded?: { to: string; by: string; ago: number };
};

/** The other groups' mail: the same for everyone who connects them. */
const SEEDS: Record<string, Seed[]> = {
  commission: [
    // 5 Nov: a claim GSP couldn't match to an application
    {
      ago: 3 * HOUR,
      from: { name: 'BrightPath Overseas', email: 'accounts@brightpathoverseas.in' },
      subject: 'Commission claim for a July enrolment',
      body: 'Hello GSP Commission,\n\nOur student Sneha Patil enrolled in July, but her commission is not on our statement. Could you check?\n\nThanks,\nAccounts\nBrightPath Overseas',
      read: false,
    },
    {
      ago: 2 * HOUR,
      from: { name: 'Flinders University Finance', email: 'ap@flinders.edu.au' },
      subject: 'Remittance advice: commission for Semester 2, 2026',
      other: true,
      body: 'Hello GSP Commission team,\n\nPayment of AUD 48,320.00 has been made today for the invoices listed in the attached remittance advice.\n\nRegards,\nAccounts Payable\nFlinders University',
      files: [{ name: 'Remittance advice', file: 'Remittance_Flinders_S2_2026.pdf', kb: 96 }],
      summary: ['Flinders University paid AUD 48,320 today.', 'The invoices it covers are in the attached remittance advice.'],
      read: false,
    },
    {
      ago: 2 * DAY,
      from: { name: 'Coventry University Partnerships', email: 'partnerships@coventry.ac.uk' },
      subject: 'Invoice INV-2026-0418: query on two students',
      other: true,
      body: 'Hello,\n\nTwo students on invoice INV-2026-0418 withdrew before the census date. Could you send a corrected invoice without them?\n\nThanks,\nPartnerships Finance\nCoventry University',
      read: true,
    },
  ],
  'commissions-temp': [
    {
      ago: 4 * HOUR,
      from: { name: 'GSP Finance', email: 'finance@gsp.upgrad.com' },
      subject: 'Weekly statements ready: week 44',
      other: true,
      body: 'Hi team,\n\nThe self-billed statements for week 44 are ready to check. 37 agencies, INR 1.84 crore in all. The file is attached.\n\nThanks,\nGSP Finance',
      files: [{ name: 'Statements, week 44', file: 'Statements_Week_44.xlsx', kb: 412 }],
      read: false,
    },
  ],
  training: [
    {
      ago: 6 * HOUR,
      from: { name: 'GSP Training', email: 'training@gsp.upgrad.com' },
      subject: 'Partner training: the new portal, Thu 6 Nov',
      other: true,
      body: 'Hi all,\n\nThe partner training on the new portal is on Thursday, 6 November, 11:00 am IST. The deck is attached; please go through it before the session.\n\nThanks,\nGSP Training',
      files: [{ name: 'Training deck', file: 'GSP_Portal_Partner_Training.pdf', kb: 3240 }],
      read: false,
    },
    {
      ago: 3 * DAY,
      from: { name: 'Lotus Study Abroad', email: 'ops@lotusstudyabroad.in' },
      subject: 'Attendance for last week’s session',
      other: true,
      body: 'Hello,\n\nFour of our counsellors joined last Tuesday’s session. Could you share the recording for the two who missed it?\n\nRegards,\nLotus Study Abroad',
      read: true,
    },
  ],
  recruitment: [
    {
      ago: 3 * DAY,
      from: { name: 'Edulink Dhaka', email: 'rafiq@edulinkdhaka.com' },
      subject: 'Visa refusal for one of our students',
      body: 'Dear GSP,\n\nOne of our students was refused a UK visa yesterday. Can someone advise on reapplying?\n\nBest regards,\nRafiq Hasan',
      forwarded: { to: 'services', by: 'Garima Bhardwaj', ago: 3 * DAY - HOUR },
      read: true,
    },
    // 5 Nov: a thread with an RP finishing its onboarding
    {
      ago: 2 * HOUR,
      from: { name: 'Rafiq Hasan', email: 'rafiq@edulinkdhaka.com' },
      subject: 'Re: Onboarding documents: Edulink Dhaka',
      other: true,
      body: 'Dear Garima,\n\nWe have signed the partner agreement; it is attached. When can we start submitting applications?\n\nBest regards,\nRafiq Hasan\nDirector, Edulink Dhaka',
      read: false,
      files: [{ name: 'Signed partner agreement', file: 'Edulink_Dhaka_Signed_Agreement.pdf', kb: 412 }],
      summary: ['Edulink Dhaka has signed and returned its partner agreement.', 'All its onboarding documents are verified; the trade licence was re-sent as a full scan.', 'It asks when it can start submitting applications.'],
      thread: [
        { ago: 5 * DAY, from: { name: 'Rafiq Hasan', email: 'rafiq@edulinkdhaka.com' }, to: ['recruitment@gsp.upgrad.com'], body: 'Dear GSP team,\n\nOur onboarding documents are attached: the trade licence, the TIN certificate and the director’s ID.\n\nBest regards,\nRafiq Hasan\nDirector, Edulink Dhaka', files: [{ name: 'Trade licence', file: 'Trade_Licence.jpg', kb: 980 }, { name: 'TIN certificate', file: 'TIN_Certificate.pdf', kb: 210 }, { name: 'Director’s ID', file: 'Director_ID.pdf', kb: 340 }] },
        { ago: 4 * DAY, from: { name: 'Garima Bhardwaj', email: 'recruitment@gsp.upgrad.com' }, to: ['rafiq@edulinkdhaka.com'], body: 'Dear Rafiq,\n\nThank you. The TIN certificate and the director’s ID are verified. The trade licence scan is cut off at the bottom, so its expiry date can’t be read. Could you send a full scan?\n\nKind regards,\nGarima Bhardwaj\nGSP Recruitment Partner Operations' },
        { ago: 2 * DAY, from: { name: 'Rafiq Hasan', email: 'rafiq@edulinkdhaka.com' }, to: ['recruitment@gsp.upgrad.com'], body: 'Dear Garima,\n\nApologies. A full scan of the trade licence is attached.\n\nBest regards,\nRafiq Hasan', files: [{ name: 'Trade licence, full scan', file: 'Trade_Licence_Full.pdf', kb: 520 }] },
        { ago: 1 * DAY, from: { name: 'Garima Bhardwaj', email: 'recruitment@gsp.upgrad.com' }, to: ['rafiq@edulinkdhaka.com'], body: 'Dear Rafiq,\n\nThank you, the trade licence is verified. Your partner agreement is on its way for signature.\n\nKind regards,\nGarima Bhardwaj\nGSP Recruitment Partner Operations' },
      ],
    },
    {
      ago: 90 * MIN,
      from: { name: 'Himalayan Study Centre', email: 'director@himalayanstudy.com.np' },
      subject: 'Partnership: adding a second branch in Pokhara',
      other: true,
      body: 'Dear GSP Recruitment,\n\nWe are opening a second branch in Pokhara next month. What do we need to send to add it to our account?\n\nBest regards,\nHimalayan Study Centre',
      read: false,
    },
    {
      ago: 2 * DAY,
      from: { name: 'Saurabh', email: 'saurabh@gsp.upgrad.com' },
      subject: 'BDM visits next week: Bengaluru',
      other: true,
      body: 'Hi team,\n\nI will be visiting six agencies in Bengaluru next week. The plan is attached.\n\nThanks,\nSaurabh',
      files: [{ name: 'Visit plan', file: 'BDM_Visits_Bengaluru.xlsx', kb: 38 }],
      read: true,
    },
  ],
  bap: [
    {
      ago: 50 * MIN,
      from: { name: 'Saigon Bridge Education', email: 'admin@saigonbridge.vn' },
      subject: 'Business documents sent again',
      other: true,
      body: 'Dear GSP,\n\nAs asked, we are sending the business registration again with all pages, and our tax certificate.\n\nThank you,\nSaigon Bridge Education',
      files: [
        { name: 'Business registration', file: 'Business_Registration_Saigon_Bridge.pdf', kb: 1180 },
        { name: 'Tax certificate', file: 'Tax_Certificate_Saigon_Bridge.pdf', kb: 640 },
      ],
      summary: ['Saigon Bridge Education sent its business registration again, with every page.', 'Its tax certificate is attached too.'],
      read: false,
    },
  ],
  calendar: [
    {
      ago: 3 * HOUR,
      from: { name: 'Leena Thomas', email: 'leena.thomas@gsp.upgrad.com' },
      subject: 'Invitation: agency review, Thu 6 Nov, 3:00 pm',
      other: true,
      body: 'Leena Thomas has invited you to the monthly agency review.\n\nThursday, 6 November, 3:00 to 4:00 pm IST\nMicrosoft Teams',
      files: [{ name: 'Calendar invite', file: 'Agency_review.ics', kb: 2 }],
      read: false,
    },
  ],
  support: [
    {
      ago: 25 * MIN,
      from: { name: 'BrightPath Overseas', email: 'admin@brightpathoverseas.in' },
      subject: 'Can’t upload documents on one application',
      body: 'Hello support,\n\nUploads on GSP-24061 stop at 90% and never finish. A screenshot is attached.\n\nThanks,\nBrightPath Overseas',
      files: [{ name: 'Screenshot', file: 'Upload_stuck.png', kb: 210 }],
      read: false,
    },
    {
      ago: DAY + 4 * HOUR,
      from: { name: 'GSP Support', email: 'support@gsp.upgrad.com' },
      subject: 'Ticket 4821 resolved: password reset emails',
      other: true,
      body: 'Hi,\n\nThe delay in password reset emails is fixed. They now arrive within a minute.\n\nGSP Support',
      read: true,
    },
  ],
  services: [
    {
      ago: 30 * HOUR,
      from: { name: 'GSP Student Services', email: 'studentservices@gsp.upgrad.com' },
      subject: 'Pre-departure briefings: January dates',
      body: 'Hi team,\n\nThe pre-departure briefings for January starters are on 8, 15 and 22 December, 5:00 pm IST. The schedule is attached; please share it with partners.\n\nThanks,\nGSP Student Services',
      files: [{ name: 'Briefing schedule', file: 'Predeparture_Briefings_January.pdf', kb: 74 }],
      other: true,
      read: true,
    },
    {
      ago: 7 * HOUR,
      from: { name: 'Horizon Overseas', email: 'counsellors@horizonoverseas.in' },
      subject: 'Airport pickup for a student arriving 2 Feb',
      body: 'Hello Student Services,\n\nOne of our students lands in Adelaide on 2 February at 6:40 am. Can the university’s pickup be booked? The flight ticket is attached.\n\nThanks,\nHorizon Overseas',
      files: [{ name: 'Flight ticket', file: 'Flight_Ticket_Adelaide.pdf', kb: 88 }],
      read: false,
    },
  ],
  'admission-temp': [
    // 5 Nov: forwarded to the inbox it belongs in
    {
      ago: 26 * HOUR,
      from: { name: 'Lotus Study Abroad', email: 'accounts@lotusstudyabroad.in' },
      subject: 'Commission for students enrolled in September',
      body: 'Hello,\n\nThree of our students enrolled at Deakin in September. When will the commission for them be paid?\n\nRegards,\nAccounts\nLotus Study Abroad',
      forwarded: { to: 'commission', by: 'Anita Rao', ago: 25 * HOUR },
      read: true,
    },
    {
      ago: 9 * HOUR,
      from: { name: 'Northumbria University Admissions', email: 'admissions@northumbria.ac.uk' },
      subject: 'Interview invitation for a January applicant',
      body: 'Dear GSP,\n\nWe would like to interview one of your January applicants on Monday, 10 November. Please pick a time from the attached slots.\n\nKind regards,\nInternational Admissions\nNorthumbria University',
      files: [{ name: 'Interview slots', file: 'Interview_Slots_10_Nov.pdf', kb: 54 }],
      read: false,
    },
  ],
  compliance: [
    // 5 Nov: about a student, but GSP couldn't tell which application
    {
      ago: 2 * HOUR,
      from: { name: 'University of Newcastle Admissions', email: 'intl.verification@newcastle.edu.au' },
      subject: 'Bank statement check for a February applicant',
      body: 'Dear GSP,\n\nWe could not verify the bank statement for Ahmed Khan, who applied for the February intake. Could you confirm it with the bank and send us a letter from them?\n\nKind regards,\nAdmissions Verification\nUniversity of Newcastle',
      files: [{ name: 'Bank statement', file: 'Bank_Statement_Ahmed_Khan.pdf', kb: 310 }],
      read: false,
    },
    {
      ago: 5 * HOUR,
      from: { name: 'GSP Legal', email: 'legal@gsp.upgrad.com' },
      subject: 'Agreement renewal due in 60 days: Flinders University',
      other: true,
      body: 'Hi team,\n\nThe Flinders University agreement ends on 31 December. The renewal draft is attached for review.\n\nGSP Legal',
      files: [{ name: 'Renewal draft', file: 'Flinders_Renewal_Draft_2027.docx', kb: 156 }],
      read: false,
    },
    {
      ago: 4 * DAY,
      from: { name: 'GSP Compliance', email: 'compliance.gsp@upgrad.com' },
      subject: 'Quarterly agent audit: checklist',
      other: true,
      body: 'Hi all,\n\nThe quarterly agent audit starts on 15 November. The checklist is attached.\n\nGSP Compliance',
      files: [{ name: 'Audit checklist', file: 'Agent_Audit_Checklist_Q4.pdf', kb: 120 }],
      read: true,
    },
  ],
  data: [
    {
      ago: 30 * HOUR,
      from: { name: 'Flinders University Admissions', email: 'intl.admissions@flinders.edu.au' },
      subject: 'Question about a student’s offer conditions',
      body: 'Hello,\n\nOne of your students asked us to change the English test condition on her offer. Who at GSP should we speak to?\n\nKind regards,\nInternational Admissions\nFlinders University',
      forwarded: { to: 'admission', by: 'Namita Nath', ago: 29 * HOUR },
      read: true,
    },
    // 5 Nov: a thread with a university's course data contact
    {
      ago: 45 * MIN,
      from: { name: 'Priya Nair', email: 'coursedata@deakin.edu.au' },
      subject: 'Re: 2027 international fees for Deakin University',
      other: true,
      body: 'Hi Namita,\n\nUse AUD 41,800: our website updates on 15 November. I have also attached the updated course list with the new CRICOS codes.\n\nKind regards,\nPriya Nair\nInternational Course Data, Deakin University',
      read: false,
      files: [{ name: 'Updated course list', file: 'Deakin_Course_List_2027_CRICOS.xlsx', kb: 64 }],
      summary: ['Deakin’s 2027 fee for the Master of Data Science is AUD 41,800; its website updates on 15 November.', 'Intakes stay March, July and November; the Master of Business Analytics becomes two years.', 'The fee schedule and an updated course list with CRICOS codes are attached.'],
      thread: [
        { ago: 4 * DAY, from: { name: 'Namita Nath', email: 'data.team@gsp.upgrad.com' }, to: ['coursedata@deakin.edu.au'], body: 'Hello Priya,\n\nWe are updating Deakin’s courses for the 2027 intakes in GSP’s course search. Could you share the 2027 international tuition fees and intake dates for your postgraduate courses?\n\nThanks,\nNamita Nath\nGSP Data-Team' },
        { ago: 3 * DAY, from: { name: 'Priya Nair', email: 'coursedata@deakin.edu.au' }, to: ['data.team@gsp.upgrad.com'], body: 'Hi Namita,\n\nThe 2027 fee schedule is attached. Intake dates are unchanged: March, July and November. Note that the Master of Business Analytics becomes a two-year course.\n\nKind regards,\nPriya Nair\nInternational Course Data, Deakin University', files: [{ name: '2027 fee schedule', file: 'Deakin_2027_International_Fees.xlsx', kb: 86 }] },
        { ago: 2 * DAY, from: { name: 'Namita Nath', email: 'data.team@gsp.upgrad.com' }, to: ['coursedata@deakin.edu.au'], body: 'Thanks, Priya.\n\nThe schedule lists the Master of Data Science at AUD 41,800, but your website still shows AUD 39,600. Which should we use?\n\nThanks,\nNamita Nath\nGSP Data-Team' },
      ],
    },
    {
      ago: 70 * MIN,
      from: { name: 'University of Hertfordshire', email: 'international@herts.ac.uk' },
      subject: '2027 course list and fees',
      other: true,
      body: 'Dear GSP Data team,\n\nPlease find attached our 2027 course list with tuition fees and intakes for international students.\n\nKind regards,\nInternational Office\nUniversity of Hertfordshire',
      files: [{ name: '2027 course list', file: 'Herts_Courses_2027.xlsx', kb: 524 }],
      summary: ['Hertfordshire sent its 2027 course list, with fees and intakes.', 'It’s in the attached spreadsheet.'],
      read: false,
    },
    {
      ago: 2 * DAY,
      from: { name: 'Coventry University', email: 'international@coventry.ac.uk' },
      subject: 'Fee change from September 2027',
      other: true,
      body: 'Dear partners,\n\nTuition for our postgraduate courses rises by 4% from the September 2027 intake. The new fees are attached.\n\nCoventry University',
      files: [{ name: 'Fee schedule', file: 'Coventry_Fees_Sep_2027.pdf', kb: 210 }],
      read: true,
    },
  ],
  vn: [
    {
      ago: 2 * DAY,
      from: { name: 'Mekong Education Partners', email: 'hello@mekongedu.vn' },
      subject: 'Training for our new counsellors',
      body: 'Dear GSP Vietnam,\n\nWe have hired three new counsellors in Da Nang. Can they join the next partner training on the portal?\n\nThank you,\nMekong Education Partners',
      forwarded: { to: 'training', by: 'Linh Tran', ago: 2 * DAY - 2 * HOUR },
      read: true,
    },
    {
      ago: 4 * HOUR,
      from: { name: 'RMIT University Vietnam Office', email: 'vn.admissions@rmit.edu.au' },
      subject: 'Offer letter: Nguyen Thi Lan',
      body: 'Dear GSP Vietnam,\n\nPlease find attached the unconditional offer for Nguyen Thi Lan, Master of Information Technology, February 2027.\n\nKind regards,\nRMIT University',
      files: [{ name: 'Unconditional offer letter', file: 'Offer_Nguyen_Thi_Lan.pdf', kb: 232 }],
      read: false,
    },
  ],
  ph: [
    {
      ago: 11 * HOUR,
      from: { name: 'Department of Home Affairs', email: 'noreply@homeaffairs.gov.au' },
      subject: 'Visa grant notice: Maria Santos',
      body: 'This is to confirm that a Student (subclass 500) visa has been granted to Maria Santos. The grant notice is attached.',
      files: [{ name: 'Visa grant notice', file: 'Visa_Grant_Maria_Santos.pdf', kb: 140 }],
      read: false,
    },
    {
      ago: 3 * DAY,
      from: { name: 'Manila Study Link', email: 'team@manilastudylink.ph' },
      subject: 'Two new applications for February',
      body: 'Hello GSP Philippines,\n\nWe have added two applications for the February intake. Their documents are all uploaded.\n\nThanks,\nManila Study Link',
      read: true,
    },
  ],
};

/** An inbox's mail, from the date its sync starts. */
export function mailsFor(key: string, since: number, c: Ctx): BoxMail[] {
  const g = groupOf(key);
  if (!g) return [];
  const list =
    key === 'admission'
      ? admission(c)
      : (SEEDS[key] ?? []).map((s, i): BoxMail => {
          const { ago, ...rest } = s;
          const thread = s.thread?.map(({ ago: a, ...t }, j): ThreadMsg => ({ ...t, id: `${key}-${i}-${j}`, at: c.now - a }));
          const forwarded = s.forwarded && { to: s.forwarded.to, by: s.forwarded.by, at: c.now - s.forwarded.ago };
          return { ...rest, id: `${key}-${i}`, group: key, folder: s.folder ?? 'inbox', to: s.to ?? [g.email], at: c.now - ago, read: s.read ?? true, thread, forwarded };
        });
  return list.filter((m) => m.at >= since);
}

/** What a role starts with: its inboxes connected 30 days back, and their mail. */
export function sampleMailbox(role: MailRole, apps: Application[], students: Student[], me: { name: string; email: string }): Mailbox {
  const now = Date.now();
  const since = now - 30 * DAY;
  const connected = STARTS[role].map((group) => ({ group, since }));
  return { connected, mails: connected.flatMap((x) => mailsFor(x.group, since, { apps, students, me, now })) };
}

/** Connects an inbox: its mail from the chosen start comes in. */
export function connect(box: Mailbox, key: string, days: number, apps: Application[], students: Student[], me: { name: string; email: string }): Mailbox {
  const now = Date.now();
  const since = now - days * DAY;
  return {
    connected: [...box.connected.filter((x) => x.group !== key), { group: key, since }],
    mails: [...box.mails.filter((m) => m.group !== key), ...mailsFor(key, since, { apps, students, me, now })],
  };
}

/** Disconnects an inbox: its mail goes from the page (it stays in the mailbox itself). */
export const disconnect = (box: Mailbox, key: string): Mailbox => ({ connected: box.connected.filter((x) => x.group !== key), mails: box.mails.filter((m) => m.group !== key) });

/** GSP Assist's three lines: the mail's own summary, or its first sentences. */
export function summaryOf(m: BoxMail): string[] {
  if (m.summary) return m.summary;
  const text = m.body
    .split('\n')
    .filter((l) => l.trim() && !/^(dear|hello|hi|thanks|thank you|regards|kind regards|best regards)\b/i.test(l.trim()) && !/^>/.test(l))
    .join(' ');
  const lines = text.match(/[^.!?]+[.!?]/g) ?? [text];
  return lines.slice(0, 3).map((x) => x.trim());
}

export const sizeText = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((p) => /^[A-Za-z]/.test(p))
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
export { first as firstName };
