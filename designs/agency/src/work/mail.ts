// @ts-nocheck -- sample data; typed when the mail API is designed.
/*
 * Shared mailboxes, rethought (Jovial, 31 Oct). Today's inbox is a list of single emails, each assigned by hand to
 * a "case", with GSP's own notifications, newsletters and one-time codes mixed in. Here the unit is a
 * **conversation** (a Gmail thread) linked to the application it's about, owned by that application's officer,
 * with a state (needs you, waiting on someone, done) and an SLA. Noise never reaches a person: it's filed on its own.
 * Modelled on the real inbox (171,215 emails, Jan–Oct 2026) and the 31 Oct screenshot; students and addresses
 * are invented.
 */
const H = 36e5;
const at = (h) => Date.now() - h * H;

import { ACCOUNT_EMAILS } from '../admin/data/emails';

export const MAILBOXES = [
  // the five seeded mailboxes as Mail shows them (name, address, the queue unmatched mail goes to); who can view or
  // send is per person, in Admin › Shared mailboxes (B-6), not here
  { id: 'mb-adm', name: 'GSP Admissions', addresses: ['gsp.admissions@upgrad.com'], routing: 'record-region', queue: 'q-adm-global', ytd: 164952 },
  { id: 'mb-admin', name: 'GSP Admin', addresses: ['admin.gsp@upgrad.com'], routing: 'queue', queue: 'q-admin', ytd: 1190 }, // S1C-14: mail to admin.gsp@ is the Admin queue's (T29); Admin forwards anything for RP Ops
  { id: 'mb-bap', name: 'Partner onboarding', addresses: ['bap.gsp@upgrad.com'], routing: 'queue', queue: 'q-rp-ops', ytd: 4847 },
  { id: 'mb-comm', name: 'Commissions', addresses: ['commissions.gsp@upgrad.com'], routing: 'queue', queue: 'q-finance', ytd: 67 },
  { id: 'mb-data', name: 'Data team', addresses: ['data-team.gsp@upgrad.com'], routing: 'queue', queue: 'q-inst-ops', ytd: 28 },
];

/*
 * gsp.admissions@, kept simple (Jovial, 5 Nov): every mail is either **linked to an application** (it shows in that
 * application's Mail tab, where its officer reads it: no task, no owner, no reasons) or **forwarded** to the inbox
 * that handles it. Mail the system can't link, a student with no application yet say, goes to Global Ops to link.
 * GSP's own notifications, out-of-office replies, bounces and sign-in codes are not kept on any application.
 */
export const MAIL_ROUTES = {
  /** Forwarded, never linked: the first whose words appear in the subject or text. `to` is a mailbox or a target below. */
  forward: [
    { id: 'commission', name: 'Commission', to: 'mb-comm', words: ['commission', 'invoice', 'payout', 'remittance', 'statement'] },
    { id: 'platform', name: 'Access or platform', to: 'mb-bap', words: ['access', 'login', 'log in', 'password', 'account', 'portal', 'sign in'] },
    { id: 'marketing', name: 'University news or marketing', to: 'fw-compliance', words: ['newsletter', 'webinar', 'partner update', 'scholarship allocations', 'was anything missed'] },
  ],
  /** Not kept anywhere: what GSP's own systems, auto-replies and codes send. */
  drop: [
    { id: 'system', name: 'GSP system notifications', why: 'the portal already records the change' },
    { id: 'ooo', name: 'Out-of-office replies', why: 'an automatic reply' },
    { id: 'bounce', name: 'Bounces', why: 'the address is marked bounced on the contact' },
    { id: 'code', name: 'Sign-in and account codes', why: 'shown only to the person who asked' },
  ],
  /** Where mail that can't be linked goes, to be linked by hand (T27). */
  unlinked: 'q-adm-global',
};
/** Where forwarded mail goes that isn't one of the portal's mailboxes. The address is still to come (Pending Questions). */
export const FORWARD_TARGETS = [{ id: 'fw-compliance', name: 'Compliance inbox', address: '' }];

export const MAIL_SETTINGS = { autoFile: 90, suggest: 60, autoAct: false, nudgeRps: true, waitDays: 3 };

const m = (id, from, h, body, o = {}) => ({ id, from, at: at(h), body, attachments: [], dir: 'in', ...o });
const GSP = ['GSP Admissions', 'gsp.admissions@upgrad.com'];
const T = (o) => ({ state: 'needs', attachments: 0, messages: [], fields: {}, reasons: [], ...o });

export const THREADS = [
  T({
    id: 'C-1001', mailbox: 'mb-adm', subject: '181395/IRAM/Auckland Institute of Studies/MORE INFORMATION REQUIRED', sender: 'RP', org: 'Info Educuratives', record: 'GSP-24205', conf: 98, intent: 'other', sla: 1,
    summary: 'The RP confirmed the course: Master of Science by Research. AIS is waiting for this answer.',
    reasons: ['Same thread as AIS’s request, which carries reference 181395', 'Sender is the RP on this application'],
    fields: { 'Course confirmed': 'Master of Science by Research', 'University reference': '181395', 'Asked by AIS': '29 Oct' },
    draft: 'Dear AIS Admissions,\n\nFurther to your request for application 181395, the applicant’s intended course of study is the Master of Science by Research.\n\nPlease let us know if you need anything else to assess the application.\n\nKind regards,\nRamish\nGSP Admissions',
    messages: [
      m('m1', ['AIS International Admissions', 'admissions@ais.example'], 49, 'Dear Partner,\n\nRe: 181395 – Kabir Sharma\n\nThe applicant’s documents mention two programmes. Please confirm the intended course of study so we can assess the application.\n\nAIS Admissions'),
      m('m2', GSP, 26, 'Dear Team,\n\nGreetings from GSP!\n\nKindly confirm the applicant’s intended course of study, as AIS has asked (below).\n\nRegards,\nGSP Admissions', { dir: 'out', to: 'info@educuratives.example' }),
      m('m3', ['Info Educuratives', 'info@educuratives.example'], 0.8, 'Hello Team,\n\nHope you are doing well.\n\nKindly proceed with the Master of Science by Research program.\n\nThanks & Regards'),
    ],
  }),
  T({
    id: 'C-1002', mailbox: 'mb-adm', subject: 'UC Application [U3249817] Unconditional offer – Navneet Kaur', sender: 'University', org: 'University of Canberra', record: 'GSP-24206', conf: 97, intent: 'uncond', sla: 1, attachments: 1,
    summary: 'Conditions met: unconditional offer for the Master of Public Health (Extended). Deposit AUD 10,000 by 20 Nov.',
    reasons: ['University reference U3249817 is on this application', 'Same thread as the conditional offer'],
    fields: { 'University reference': 'U3249817', Start: 'Semester 1, 2027', Deposit: 'AUD 10,000', 'Accept by': '20 Nov 2026' },
    messages: [m('m1', ['University of Canberra Admissions', 'intladmissions@canberra.example'], 1.2, 'Dear Agent,\n\nWe are pleased to advise that Navneet Kaur has met all conditions and is now offered an unconditional place in the Master of Public Health (Extended), commencing Semester 1, 2027.\n\nTo accept, the student must pay the deposit of AUD 10,000 by 20 November 2026.\n\nUC International Admissions', { attachments: ['UC_Offer_U3249817.pdf'] })],
  }),
  T({
    id: 'C-1003', mailbox: 'mb-adm', subject: 'Request for further information – Dev Kaur (ECU-2026-44871)', sender: 'University', org: 'Edith Cowan University', record: 'GSP-24201', conf: 93, intent: 'info', sla: 1,
    summary: 'ECU needs an IELTS or PTE result and a CV with dates within 5 working days, or the application is withdrawn.',
    reasons: ['Student name and university match one application', 'ECU reference stored on submission'],
    fields: { 'Asked for': 'IELTS or PTE result; CV with dates', Deadline: '5 working days' },
    messages: [m('m1', ['ECU International Admissions', 'international@ecu.example'], 2.5, 'Dear GSP team,\n\nTo assess the application for Dev Kaur (Master of Engineering), please provide:\n1. IELTS or PTE result\n2. Detailed CV with dates\n\nPlease respond within 5 working days or the application will be withdrawn.\n\nECU Admissions')],
  }),
  T({
    id: 'C-1004', mailbox: 'mb-adm', subject: 'Arjun Sharma – SCU enrolment status?', sender: 'RP', org: 'Chetanya Career Consultants', record: 'GSP-24202', conf: 91, intent: 'other', sla: 1,
    summary: 'The RP is asking when Southern Cross will send the CoE.',
    reasons: ['Sender is the RP on this application', 'Student name matches'],
    draft: 'Hi Anil,\n\nArjun’s enrolment confirmation is with Southern Cross now. You’ll see it in the portal as soon as it arrives, and you can message us there in the application’s chat.\n\nGSP Admissions',
    messages: [m('m1', ['Anil (Chetanya Career Consultants)', 'anil@chetanya.example'], 0.6, 'Hi team,\n\nCan you please update on Arjun Sharma’s enrolment at Southern Cross? Student is asking when the CoE will come.\n\nThanks,\nAnil')],
  }),
  T({
    id: 'C-1005', mailbox: 'mb-adm', subject: 'Action Required On Your Pending Interview – Simran Nair', sender: 'Vendor', org: 'Authentz', record: 'GSP-24207', conf: 88, intent: 'remind', sla: 1,
    summary: 'The genuine student interview for Kaplan Business School isn’t booked. Book before 4 Nov.',
    reasons: ['Student name matches one open application', 'Kaplan Business School is the university on it'],
    fields: { Vendor: 'Authentz', 'Book before': '4 Nov 2026' },
    messages: [m('m1', ['Authentz', 'notifications@authentz.example'], 3.1, 'Hello,\n\nThe genuine student interview for Simran Nair (Kaplan Business School) is pending. Please ask the student to book a slot before 4 November 2026.\n\nAuthentz')],
  }),
  T({
    id: 'C-1006', mailbox: 'mb-adm', subject: 'CAS issued – Rohan Patel – MBA January 2027', sender: 'University', org: 'University of the West of Scotland', record: 'GSP-24204', conf: 96, intent: 'coe', sla: 1, attachments: 1,
    summary: 'UWS issued the CAS for the January 2027 MBA.',
    reasons: ['Student name, university and intake match', 'CAS attached'],
    fields: { 'CAS number': 'E4G7K2P9X1Q8', Intake: 'January 2027' },
    messages: [m('m1', ['UWS Admissions', 'uk-admissions@uws.example'], 4.4, 'Dear Partner,\n\nPlease find attached the CAS statement for Rohan Patel, MBA, January 2027 intake. CAS number: E4G7K2P9X1Q8.\n\nUWS Admissions', { attachments: ['CAS_Statement_RohanPatel.pdf'] })],
  }),
  T({
    id: 'C-1007', mailbox: 'mb-adm', subject: 'Genuine student: financial capacity – Navneet Nair', sender: 'University', org: 'TAFE SA', record: 'GSP-24203', conf: 90, intent: 'gs', sla: 2,
    summary: 'TAFE SA needs evidence of AUD 29,710 plus first-year tuition, with 3 months of bank statements, before the CoE.',
    reasons: ['Student name and university match one application'],
    fields: { 'Funds to show': 'AUD 29,710 + first-year tuition', Statements: 'Last 3 months' },
    messages: [m('m1', ['TAFE SA International', 'international@tafesa.example'], 5.2, 'Dear Agent,\n\nBefore we can issue a CoE for Navneet Nair, we need evidence of funds covering 12 months of living costs, tuition and travel (AUD 29,710 + first-year tuition), with bank statements for the last 3 months.\n\nTAFE SA')],
  }),
  T({
    id: 'C-1008', mailbox: 'mb-adm', subject: 'Conditional offer – DKN-2611407 – Priya Raman', sender: 'University', org: 'Deakin University', record: 'GSP-24102', conf: 99, intent: 'cond', sla: 1, attachments: 1,
    state: 'done', doneBy: 'u-ramish-jafery', doneAt: at(24 + 3), outcome: 'Offer added to Documents; its 3 conditions sent to the RP. Status moved to Conditional offer received.',
    summary: 'Deakin’s conditional offer for Priya Raman, Master of Information Technology, Trimester 1 2027, with 3 conditions.',
    // W20 (Jovial, 1 Nov): matched on the university reference stored at submission, and the same 3 conditions as the application
    reasons: ['University reference DKN-2611407 is on this application', 'Sender is Deakin, the application’s university'],
    fields: { 'University reference': 'DKN-2611407', Conditions: '3: final transcript, bank statements (6 months), acceptance', Start: 'Trimester 1, 2027' },
    messages: [m('m1', ['Deakin University', 'noreply@deakin.example'], 24 + 4, 'Dear GSP,\n\nRe: DKN-2611407 – Priya Raman\n\nWe are pleased to offer a conditional place in the Master of Information Technology, Trimester 1 2027. Conditions (page 2):\n1. Final semester transcript showing the degree is complete\n2. Bank statements for the last 6 months showing at least AUD 67,510\n3. Confirmation the student accepts the offer and will start in February 2027\n\nDeakin Admissions', { attachments: ['Deakin_conditional_offer_Priya_Raman.pdf'] })],
  }),
  T({
    id: 'C-1009', mailbox: 'mb-adm', subject: '180204 – Offer letter', sender: 'RP', org: 'SCOL', record: 'GSP-24209', conf: 86, intent: 'other', sla: 1, attachments: 2,
    summary: 'The RP sent the same question twice, with the student’s updated marksheet attached both times.',
    reasons: ['Sender is the RP on this application', 'Student number 180204 is in the RP’s earlier email on this application'],
    draft: 'Hi team,\n\nThanks, we have the updated marksheet and have added it to the application. We’ll come back to you in the portal chat once the university responds.\n\nGSP Admissions',
    messages: [
      m('m1', ['SCOL', 'admissions@scol.example'], 1.6, 'Dear Team,\n\nPlease find the updated marksheet for 180204. When can we expect the offer letter?\n\nRegards, SCOL', { attachments: ['Marksheet_180204.pdf'] }),
      m('m2', ['SCOL', 'admissions@scol.example'], 1.5, 'Dear Team,\n\nPlease find the updated marksheet for 180204. When can we expect the offer letter?\n\nRegards, SCOL', { attachments: ['Marksheet_180204.pdf'] }),
    ],
  }),
  T({
    id: 'C-1010', mailbox: 'mb-adm', subject: 'Payment received – Mithila Chowdhury', sender: 'University', org: 'Victoria University of Wellington', record: 'GSP-24210', conf: 92, intent: 'payment', sla: 1, attachments: 1,
    summary: 'VUW received the NZD 12,500 tuition deposit.',
    reasons: ['Student name and university match', 'The application is at “Tuition paid, payment proof pending”'],
    fields: { Amount: 'NZD 12,500', Receipt: '88213' },
    messages: [m('m1', ['Victoria University of Wellington', 'international@vuw.example'], 9, 'Kia ora,\n\nWe confirm receipt of NZD 12,500 tuition deposit for Mithila Chowdhury, Master of Health.\n\nNgā mihi,\nVUW', { attachments: ['Receipt_VUW_88213.pdf'] })],
  }),
  T({
    id: 'C-1011', mailbox: 'mb-adm', subject: 'Enrolment confirmed – Tanvir Islam – 2026 Spring', sender: 'University', org: 'Western Sydney University', record: 'GSP-24211', conf: 96, intent: 'enrol', sla: 1,
    summary: 'Tanvir has enrolled in the Bachelor of Science. Census date 21 Nov 2026.',
    reasons: ['Student name and university match', 'The application is at “Enrolment confirmation pending”'],
    fields: { 'Census date': '21 Nov 2026', Term: 'Spring 2026' },
    messages: [m('m1', ['Western Sydney University', 'international@wsu.example'], 11, 'Dear Agent,\n\nTanvir Islam has enrolled in the Bachelor of Science for Spring 2026. Census date: 21 November 2026.\n\nWSU International')],
  }),
  T({
    id: 'C-1012', mailbox: 'mb-adm', subject: 'Application outcome – Zainab Malik', sender: 'University', org: 'The University of Notre Dame Australia', record: 'GSP-24217', conf: 94, intent: 'reject', sla: 1,
    summary: 'Notre Dame can’t offer a place: academic requirements not met.',
    reasons: ['Student name, university and course match one application', 'There’s a second Zainab Malik at another university; the course rules it out'],
    fields: { Reason: 'Academic requirements not met' },
    messages: [m('m1', ['University of Notre Dame Australia', 'admissions@nd.example'], 8.2, 'Dear Agent,\n\nThank you for the application for Zainab Malik to the Bachelor of Computer Science. Unfortunately we are unable to offer a place, as the academic requirements are not met.\n\nNotre Dame Admissions')],
  }),
  T({
    id: 'C-1013', mailbox: 'mb-adm', subject: 'New application – Prabhjot Singh', sender: 'RP', org: 'Australia RPC Global', record: null, conf: 41, intent: 'other', sla: 1, attachments: 3, state: 'match',
    summary: 'The RP emailed a new application with a passport and transcripts instead of adding it in the portal.',
    reasons: ['No GSP application for this student yet', 'Sender is a known RP: Australia RPC Global'],
    candidates: [],
    draft: 'Hi team,\n\nThanks for sending this. Please add the application in the portal (Applications › Add application) so it reaches the right Admissions queue straight away, with its documents checked as they upload.\n\nGSP Admissions',
    messages: [m('m1', ['Australia RPC Global', 'apply@rpcglobal.example'], 2.2, 'Hi team,\n\nNew 180388 Prabhjot Singh. Please find passport, transcripts and English test attached. Course: Master of IT, Feb 2027.\n\nThanks', { attachments: ['Passport.pdf', 'Transcripts.pdf', 'PTE.pdf'] })],
  }),
  T({
    id: 'C-1014', mailbox: 'mb-adm', subject: 'Fwd: Application 183962', sender: 'Person', org: 'Jinal Sheth', record: null, conf: 34, intent: 'unclassified', sla: 1, state: 'match',
    summary: 'A forwarded application number with no student name, from a personal address.',
    reasons: ['No GSP reference, student name or university in the email', 'Sender isn’t a known RP, student or university'],
    candidates: ['GSP-24209', 'GSP-24208'],
    messages: [m('m1', ['Jinal Sheth', 'jinal.sheth@gmail.example'], 4.6, 'Please check status of application 183962.')],
  }),
  T({
    id: 'C-1015', mailbox: 'mb-adm', subject: 'Unconditional offer – Bibek Shrestha – BA (Hons) Business Management', sender: 'University', org: 'University of Winchester', record: 'GSP-24223', conf: 95, intent: 'uncond', sla: 1, attachments: 1,
    summary: 'Unconditional place for February 2027.',
    reasons: ['Student name, university and course match'],
    fields: { Start: 'February 2027' },
    messages: [m('m1', ['University of Winchester', 'international@winchester.example'], 14, 'Dear Partner,\n\nWe are delighted to offer Bibek Shrestha an unconditional place, starting February 2027.\n\nWinchester International', { attachments: ['Offer_BShrestha.pdf'] })],
  }),
  T({
    id: 'C-1016', mailbox: 'mb-comm', subject: 'Commission remittance – Trimester 2 2026', sender: 'University', org: 'Kaplan Business School', record: null, conf: 98, intent: 'box', sla: 2, attachments: 1, uni: 'Kaplan Business School',
    summary: 'KBS paid AUD 41,228.40 for 14 students’ Trimester 2 commission.',
    reasons: ['Sender is Kaplan Business School’s finance team', 'Remittance attached'],
    fields: { Students: '14', Amount: 'AUD 41,228.40', Period: 'Trimester 2 2026' },
    messages: [m('m1', ['Kaplan Business School Finance', 'agentpayments@kbs.example'], 20, 'Hello,\n\nPlease find attached the remittance for Trimester 2 2026 commissions (14 students, AUD 41,228.40), paid today.\n\nKBS Finance', { attachments: ['KBS_Remittance_T2_2026.pdf'] })],
  }),
  T({
    id: 'C-1020', mailbox: 'mb-adm', subject: 'Your offer to study at Griffith College – Sadia Rahman', sender: 'University', org: 'Griffith College', record: 'GSP-24216', conf: 94, intent: 'offer', sla: 1, attachments: 1,
    summary: 'Griffith College offers a place in the BSc in Computing Science. The letter doesn’t say whether it is conditional.',
    reasons: ['Student name and university match one application', 'The application is at “Submitted to university”'],
    fields: { Course: 'BSc in Computing Science', Start: 'Trimester 1, 2027' },
    messages: [m('m1', ['Griffith College Admissions', 'admissions@griffithcollege.example'], 1.9, 'Dear Partner,\n\nWe are pleased to offer Sadia Rahman a place in the BSc in Computing Science, starting Trimester 1, 2027. The offer letter is attached.\n\nGriffith College Admissions', { attachments: ['Griffith_Offer.pdf'] })],
  }),
  T({
    id: 'C-1021', mailbox: 'mb-adm', subject: 'Application decision – Sonam Htet', sender: 'University', org: 'La Trobe University', record: 'GSP-24246', conf: 92, intent: 'decision', sla: 1,
    summary: 'La Trobe has a decision on the Master of Nursing, but the mail only links to its portal.',
    reasons: ['Student name and university match one application'],
    messages: [m('m1', ['La Trobe Admissions', 'admissions@latrobe.example'], 3.6, 'Dear Agent,\n\nA decision has been made on the application for Sonam Htet (Master of Nursing). Please sign in to the agent portal to view it.\n\nLa Trobe Admissions')],
  }),
  T({
    id: 'C-1022', mailbox: 'mb-adm', subject: 'Visa grant notice – Lan Nguyen', sender: 'University', org: 'Macquarie University', record: 'GSP-24235', conf: 90, intent: 'visa', sla: 1, attachments: 1,
    summary: 'Macquarie forwarded Lan’s student visa grant for the Bachelor of Commerce.',
    reasons: ['Student name and university match one application'],
    fields: { Visa: 'Student visa (subclass 500)' },
    messages: [m('m1', ['Macquarie International', 'intl@mq.example'], 6.1, 'Dear Partner,\n\nPlease find attached the visa grant notice for Lan Nguyen, Bachelor of Commerce.\n\nMacquarie International', { attachments: ['Visa_Grant_LNguyen.pdf'] })],
  }),
  T({
    id: 'C-1023', mailbox: 'mb-adm', subject: 'Deferral request received – Rafiq Hossain', sender: 'University', org: 'University of Greenwich', record: 'GSP-24213', conf: 93, intent: 'deferral', sla: 1,
    summary: 'Greenwich can move Rafiq’s BSc (Hons) in Computing to the May 2027 intake once the student confirms.',
    reasons: ['Student name and university match one application'],
    fields: { 'New intake': 'May 2027' },
    messages: [m('m1', ['Greenwich International', 'international@gre.example'], 7.4, 'Dear Partner,\n\nWe have received the deferral request for Rafiq Hossain. We can move the offer to the May 2027 intake once the student confirms.\n\nGreenwich International')],
  }),
  T({
    id: 'C-1024', mailbox: 'mb-adm', subject: 'Re: Application – Bibek Thapa – Global MBA', sender: 'University', org: 'La Trobe University', record: 'GSP-24222', conf: 95, intent: 'other', sla: 1,
    summary: 'La Trobe asks whether the student wants to be considered for the February intake as well.',
    reasons: ['Same thread as GSP’s submission of this application'],
    messages: [m('m1', ['La Trobe Admissions', 'admissions@latrobe.example'], 2.8, 'Dear Partner,\n\nCould you confirm whether Bibek Thapa would also like to be considered for the February intake?\n\nLa Trobe Admissions')],
  }),
  /* waiting on someone: GSP replied, the clock is on them */
  T({
    id: 'C-1017', mailbox: 'mb-adm', subject: 'Additional offer 182677 / documents', sender: 'RP', org: 'Education Care Immigration', record: 'GSP-24208', conf: 95, intent: 'info', sla: 1, state: 'waiting', waitingOn: 'RP', due: Date.now() + 2 * 864e5,
    summary: 'GSP asked the RP for the student’s updated passport. Waiting since yesterday.',
    reasons: ['Same thread as GSP’s request on this application'],
    messages: [
      m('m1', ['Education Care Immigration', 'docs@educare.example'], 30, 'Dear team, please process the additional offer for 182677.'),
      m('m2', GSP, 26, 'Dear team, please send the student’s updated passport (the copy we have expires before the course starts).', { dir: 'out', to: 'docs@educare.example' }),
    ],
  }),
  T({
    id: 'C-1018', mailbox: 'mb-adm', subject: 'Re: Navneet Kaur – conditions', sender: 'University', org: 'University of Canberra', record: 'GSP-24206', conf: 99, intent: 'other', sla: 1, state: 'waiting', waitingOn: 'University', due: Date.now() - 864e5,
    summary: 'GSP sent UC the IELTS result to lift the condition. UC hasn’t answered: 1 day late.',
    reasons: ['University reference U3249817'],
    messages: [m('m1', GSP, 74, 'Dear UC Admissions,\n\nPlease find the IELTS result to lift the English condition for U3249817.\n\nGSP Admissions', { dir: 'out', to: 'intladmissions@canberra.example', attachments: ['IELTS_TRF.pdf'] })],
  }),
  /* done */
  T({
    id: 'C-1019', mailbox: 'mb-adm', subject: 'Offer of admission – Imran Islam', sender: 'University', org: 'Griffith University', record: 'GSP-24215', conf: 96, intent: 'uncond', state: 'done', doneBy: 'u-kamrun-nahar', doneAt: at(25), outcome: 'Offer added to Documents; status moved to Unconditional offer letter received.',
    summary: 'Unconditional offer.', reasons: ['Student name and university match'],
    messages: [m('m1', ['Griffith University', 'intl@griffith.example'], 26, 'Offer attached.', { attachments: ['Offer.pdf'] })],
  }),
];

/* Filed without a person (a sample; the counts on Filed show the real share). */
export const FILED = [
  { id: 'F-1', drop: 'system', from: 'no-reply@globalstudypartners.com', subject: 'GSP System Notification – Enrolment Course update', at: at(0.3) },
  { id: 'F-2', drop: 'system', from: 'no-reply@globalstudypartners.com', subject: 'GSP System Notification – Student update', at: at(0.9) },
  { id: 'F-3', from: 'Opulence Education Group', subject: 'October at OEG: was anything missed?', at: at(1.1) },
  { id: 'F-4', drop: 'code', from: 'UWA Accounts', subject: 'Your verification code', at: at(1.4), forUser: 'u-tasha-tandon' },
  { id: 'F-5', from: 'AUT (ArionSystem)', subject: 'Partners Online Application Received – AUT-26-55190', at: at(1.8), record: 'GSP-24214', ref: 'AUT-26-55190' },
  { id: 'F-6', from: 'University of Tasmania', subject: 'Application submitted', at: at(3.3), record: 'GSP-24221', ref: '5523019' },
  { id: 'F-7', drop: 'bounce', from: 'Mail Delivery Subsystem', subject: 'Undeliverable: Document request', at: at(4), record: 'GSP-24222' },
  { id: 'F-8', drop: 'ooo', from: 'Catherine (UC)', subject: 'Automatic reply: conditions', at: at(5), record: 'GSP-24206' },
  { id: 'F-9', from: 'Study Group Admissions', subject: 'Partner update: February 2027 intake', at: at(18) },
  { id: 'F-10', from: 'GSP Admissions (Dhaka office)', subject: 'RE: Letter of Offer – Conditional', at: at(2.4), record: 'GSP-24102' },
  { id: 'F-11', from: 'Ra Global Solutions Bd', subject: 'Regarding commission details for September intake', at: at(2.9) },
  { id: 'F-12', from: 'Unicampus Global', subject: 'Not able to access our account', at: at(6.5) },
  { id: 'F-13', drop: 'bounce', from: 'Mail Delivery Subsystem', subject: 'Undeliverable: Your application update', at: at(8) },
];

/* Conversations no record was found for raise a task (T26, T27, T28): work/recordRules.ts works them out. */

/* ---------- the portal's emails (slice 4 PRD, Emails) ---------- */
/**
 * Every email the portal sends: 23 templates the system fills in (slice 1 drafted E1 to E4; slice 4 the rest).
 * `canTurnOff`: Profile › Email preferences (slice 1's page, both portals) lets each person turn off any email they
 * get except slice 1's four account emails, which sign-in needs (S4-16). Turning an email off never turns off the bell.
 * Slice 1's Email preferences reads this list.
 */
/** `who`: whose Email preferences list it (GSP Profile, the RP's Profile, or both). */
export type EmailTemplate = { id: string; name: string; group: 'Account' | 'RP onboarding' | 'Applications' | 'Work'; slice: number; when: string; to: string; subject: string; body: string; canTurnOff: boolean; who: 'GSP' | 'RP' | 'Both' };
/** Slice 1's wording for E1 to E4 (Admin › Sign-in security shows it): one source. */
const ACCOUNT_BY_ID = { E1: 'setup', E2: 'code', E3: 'changed', E4: 'paused' };
const account = (id) => ACCOUNT_EMAILS.find((a) => a.id === ACCOUNT_BY_ID[id]);
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  { id: 'E1', name: 'Set up your account', group: 'Account', slice: 1, when: 'A GSP user or RP user is created', to: 'The new user', subject: account('E1').subject, body: account('E1').body, who: 'Both', canTurnOff: false },
  { id: 'E2', name: 'Your code', group: 'Account', slice: 1, when: 'Sign-in or a password reset asks for a code', to: 'The person signing in', subject: account('E2').subject, body: account('E2').body, who: 'Both', canTurnOff: false },
  { id: 'E3', name: 'Password changed', group: 'Account', slice: 1, when: 'A password is changed or reset', to: 'The account’s owner', subject: account('E3').subject, body: account('E3').body, who: 'Both', canTurnOff: false },
  { id: 'E4', name: 'Sign-in paused', group: 'Account', slice: 1, when: 'Too many wrong attempts pause sign-in', to: 'The account’s owner', subject: account('E4').subject, body: account('E4').body, who: 'Both', canTurnOff: false },
  { id: 'E5', name: 'Welcome', group: 'RP onboarding', slice: 2, when: 'rp.email_verified', to: 'The RP’s business email', subject: 'Welcome to upGrad GSP', body: 'Hi {first name}, your email is verified. Next, add {agency}’s business details and documents and send them to GSP: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E6', name: 'Documents received', group: 'RP onboarding', slice: 2, when: 'rp.documents_sent', to: 'The RP’s business email', subject: 'We’ve received your documents', body: 'Thanks, {agency}. GSP is checking your documents. We’ll email you once they’re verified, or if anything needs changing. Meanwhile you can look at courses in Find courses: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E7', name: 'Document sent back', group: 'RP onboarding', slice: 2, when: 'rp.document_sent_back', to: 'The RP’s business email', subject: 'Please upload your {document} again', body: 'GSP couldn’t accept your {document}: {reason}. Upload a new file here: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E8', name: 'Agreement to sign', group: 'RP onboarding', slice: 2, when: 'rp.agreement_sent: RP Ops sends an agreement (the first, or a new version later)', to: 'The RP’s business email and its RP Admins', subject: 'Sign your agreement with upGrad GSP ({version})', body: '{agency}, your agreement with upGrad GSP ({version}) is attached and on your Home. Download it, sign it, and upload the signed copy: {link}. If you already have an agreement with GSP, it stays active until this one is accepted.', who: 'RP', canTurnOff: true },
  { id: 'E9', name: 'Signed agreement sent back', group: 'RP onboarding', slice: 2, when: 'rp.agreement_sent_back', to: 'The RP’s business email and its RP Admins', subject: 'Please upload your signed agreement again ({version})', body: 'GSP couldn’t accept the signed copy of {version}: {reason}. Upload it again here: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E10', name: 'Agreement accepted', group: 'RP onboarding', slice: 2, when: 'rp.agreement_accepted (the first one is rp.approved too)', to: 'The RP’s business email and its RP Admins', subject: 'Your agreement is accepted ({version})', body: 'GSP accepted your signed agreement ({version}). It’s active from {date}. With your first agreement, Students, Applications, Earnings and your Profile open, and commissions apply. See it on Profile › Agreement: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E11', name: 'Account status', group: 'RP onboarding', slice: 2, when: 'rp.status_changed', to: 'The RP’s business email; Suspended and Reactivated also to every user of the RP', subject: 'Rejected: “Your GSP partner application”; Suspended: “Your upGrad GSP access is paused”; Reactivated: “Your upGrad GSP access is back”; Dormant: “We miss you at upGrad GSP”', body: 'Rejected: “We can’t take {agency} on as a GSP partner. Questions? Reply to your partner manager.” Suspended: “Access to the portal for {agency} is paused from {date}. Your partner manager can tell you more.” Reactivated: “Access for {agency} is back. Sign in: {link}.” Dormant: “{agency} hasn’t applied in 3 months. Find courses for your students: {link}.” Back from Dormant: no email.', who: 'RP', canTurnOff: true },
  { id: 'E12', name: 'Linked to a Master Partner', group: 'RP onboarding', slice: 2, when: 'master_partner.rp_linked', to: 'The RP’s business email', subject: '{agency} is now part of {Master Partner}', body: '{agency} is linked to {Master Partner} from {date}. (Unlinked: “… is no longer part of …”)', who: 'RP', canTurnOff: true },
  { id: 'E13', name: 'Onboarding reminder', group: 'RP onboarding', slice: 2, when: 'T34’s reminder, 3 working days after a send-back', to: 'The RP’s business email', subject: 'Reminder: your documents', body: 'Your {document} still needs a new upload: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E22', name: 'Agreement reminder', group: 'RP onboarding', slice: 2, when: 'T69’s reminders: 3 and 7 working days after an agreement is sent, while no signed copy is uploaded (L-5)', to: 'The RP’s RP Admins', subject: 'Reminder: sign your agreement with upGrad GSP ({version})', body: '{agency}, your agreement with upGrad GSP ({version}) is still waiting for your signed copy. Download it from your Home, sign it, and upload the signed copy: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E14', name: 'Announcement', group: 'RP onboarding', slice: 2, when: 'announcement.published with Send as email', to: 'The announcement’s recipients', subject: 'The announcement’s title', body: 'The announcement’s text, the university’s name, and “Search {university} courses”: {link}', who: 'Both', canTurnOff: true },
  { id: 'E15', name: 'Request', group: 'Applications', slice: 3, when: 'request.sent (a document or conditions request)', to: 'The RP: the student’s counsellor, the branch’s Branch Admin, every RP Admin (S4-14)', subject: '{GSP name} needs {request title} for {student}', body: 'For {student}’s application to {course} at {university} ({application ID}): {what’s needed}. {Due by {due date}.} Upload or answer here: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E16', name: 'Sent back', group: 'Applications', slice: 3, when: 'document.rejected', to: 'The RP', subject: 'Please upload the {document} for {student} again', body: '{GSP name} sent back the {document}: {reason}. Upload a new file: {link}.', who: 'RP', canTurnOff: true },
  { id: 'E17', name: 'Reminder', group: 'Applications', slice: 3, when: 'The “RP reminded” time of T2, T7, T9b, T14, T17', to: 'The RP', subject: 'Reminder: {request title} for {student}', body: 'GSP is still waiting for {request title} for {student}’s application to {university}. {Due by {due date}.} {link}', who: 'RP', canTurnOff: true },
  { id: 'E18', name: 'Daily update', group: 'Applications', slice: 3, when: 'Once a day at 09:00 IST, when anything happened since the last one', to: 'The RP', subject: '{n} updates on your applications', body: 'One line per application: “{student} · {university}: {what happened}” (status changes, messages, verified documents, closes), each linked. Requests and send-backs are not repeated here.', who: 'RP', canTurnOff: true },
  // admissions feedback (4 Nov): the officer hears by email too, not only the bell (W11)
  { id: 'E23', name: 'Requested documents uploaded', group: 'Applications', slice: 3, when: 'document.uploaded against a GSP request: each upload the RP makes for a document GSP asked for', to: 'The application’s Admissions officer', subject: '{RP} uploaded {document} for {student}', body: '{RP} uploaded the {document} you asked for, for {student}’s application to {course} at {university} ({application ID}). Check it here: {link}.', who: 'GSP', canTurnOff: true },
  { id: 'E19', name: 'Morning email', group: 'Work', slice: 4, when: '08:30 IST, on their working days, when they have a task due today, due tomorrow or late', to: 'The GSP person', subject: 'Your work today: {n} due, {m} late', body: 'Three groups, Late, Due today, Due tomorrow, each task with its title, record and SLA words, linked; then “Open My work”: {link}. Leaders get a fourth group, “Late in your team”.', who: 'GSP', canTurnOff: true },
  { id: 'E20', name: 'Renewal reminder', group: 'Work', slice: 4, when: 'T38 fires, 60 days before an agreement ends', to: 'The partner’s relationship manager', subject: 'The agreement with {partner} ends on {date}', body: 'Start the renewal: {link}. It’s in your My work too.', who: 'GSP', canTurnOff: true },
  { id: 'E21', name: 'Escalated to you', group: 'Work', slice: 4, when: 'Level 3 escalation', to: 'Every Admin', subject: 'Late by 5 working days: {task title}', body: '{task title} on {record}, assigned to {assignee}, was due {date}. {link}', who: 'GSP', canTurnOff: true },
];
/** The rules every email follows (slice 4 PRD, Rules for every email). */
export const EMAIL_RULES: [string, string][] = [
  ['Sender', '“upGrad GSP” no-reply@gsp.upgrad.com, through Amazon SES (slice 1)'],
  ['Reply-to', 'None: every email is a notification from no-reply, with no Reply-to. Work happens on the portal, so each email links to the page to act on and ends with “Please don’t reply to this email. Reply on the GSP portal.”'],
  ['Language', 'English only'],
  ['Layout', 'The upGrad GSP logo, the body, one button for {link}, and the footer “You’re getting this because you use the upGrad GSP portal.” with a link to Email preferences (not on the account emails)'],
  ['Links', 'Every {link} opens the record in the portal; signed out, it goes through sign-in and then to the record'],
  ['Unsubscribe', 'Profile › Email preferences, in both portals, lets each person turn off any or all of the emails they get (S4-16). Slice 1’s 4 account emails can’t be turned off, because sign-in doesn’t work without them (proposal, S4-16). Turning off an email never turns off the bell'],
  ['Who it goes to on the RP side', 'Onboarding emails: the RP’s business email. Application emails: as the bell (S4-14)'],
  ['Failure', 'A bounce or failure is logged against the email (Logs) and never retried more than 3 times'],
  ['Logged', 'Every email sent: template, to, record, time, SES message ID, delivered or bounced'],
];
export const EMAIL_FOOTER = 'Please don’t reply to this email. Reply on the GSP portal.';
export const EMAIL_PLACEHOLDERS = '{first name}, {agency}, {student}, {university}, {course}, {intake}, {application ID}, {request title}, {what’s needed}, {due date}, {document}, {reason}, {GSP name}, {status}, {date}, {link}';

/* ---------- daily jobs (slice 4 PRD, Daily jobs): all times IST ---------- */
export type Job = { id: string; name: string; slice: number; runs: string; every: { daily?: string; minutes?: number; weekly?: [number, string][] }; checks: string; changes: string; writes: string };
export const JOBS: Job[] = [
  { id: 'J1', name: 'Agreement ended', slice: 2, runs: 'Daily, 01:00', every: { daily: '01:00' }, checks: 'Institution partners at Agreement executed whose current agreement’s end date is before today (the end date itself is in date)', changes: 'Status → Agreement ended; its Live universities → Paused, so their courses leave course search (S2-15). Acts once per end date: a hand-picked Agreement executed afterwards is left alone', writes: 'ip.status_changed, university.status_changed, by “System”' },
  { id: 'J2', name: 'Dormant', slice: 2, runs: 'Daily, 01:00', every: { daily: '01:00' }, checks: 'RPs at Agreement signed with no new application in the last 3 months', changes: 'Status → Dormant; sends E11. The RP’s next application moves it back (an event, not this job)', writes: 'rp.status_changed by “System”' },
  { id: 'J3', name: 'Date rules', slice: 4, runs: 'Daily, 01:00', every: { daily: '01:00' }, checks: 'T33 (not activated 2 working days), T34 (sent back 7 working days), T37 (no application in 90 days), T38 (agreement ends in 60 days), T40 (university not live 14 days after creation), T41 (course in draft 7 days), T42 (last intake’s deadline passed, no next intake), T57 (the course start date, visa granted)', changes: 'Creates each task whose condition holds and that doesn’t exist yet; sends E20 for T38', writes: 'task.created' },
  { id: 'J4', name: 'Work clock', slice: 4, runs: 'Every 15 minutes', every: { minutes: 15 }, checks: 'Every open condition with a wait (T2, T5, T7, T54, T9b, T10, T14, T16, T17, T56), every open task’s due time, every RP reminder time (T69’s agreement reminders included)', changes: 'Starts chase tasks whose wait ran out (T69 after 10 working days); sends RP reminders (E13, E17, E22) at their time; moves tasks to Due soon and Breached; raises escalation levels 1, 2, 3 (E21 at level 3)', writes: 'task.created, task.due_soon, task.breached, task.escalated, email.sent' },
  { id: 'J5', name: 'Leave cover', slice: 4, runs: 'Daily, 00:05', every: { daily: '00:05' }, checks: 'People whose leave starts or ends today', changes: 'Their open tasks show as their leader’s while on leave, and as theirs again after; new work skips them', writes: 'task.covered, task.uncovered' },
  { id: 'J6', name: 'Morning email', slice: 4, runs: 'Every 30 minutes', every: { minutes: 30 }, checks: 'GSP people, once it is 08:30 IST on one of their working days, with something due today, due tomorrow or late', changes: 'Sends E19', writes: 'email.sent' },
  { id: 'J7', name: 'RP daily update', slice: 4, runs: 'Every 30 minutes', every: { minutes: 30 }, checks: 'RPs, once it is 09:00 IST, with updates since the last one', changes: 'Sends E18', writes: 'email.sent' },
  { id: 'J8', name: 'Weekly checks', slice: 4, runs: 'Fridays 01:00 (T50); Mondays 01:00 (T49, slice 5)', every: { weekly: [[5, '01:00'], [1, '01:00']] }, checks: 'No exchange rates entered for next week; the week’s payout run', changes: 'Creates T50’s task in the Admin queue; T49 is slice 5’s', writes: 'task.created' },
  { id: 'J9', name: 'Announcements', slice: 2, runs: 'Every 15 minutes', every: { minutes: 15 }, checks: 'Scheduled announcements whose publish date has come (its first run after midnight IST, S2C-18); live ones past their expiry date', changes: 'Publishes (and sends E14 when Send as email), or ends them', writes: 'announcement.published' },
  { id: 'J10', name: 'Unverified sign-ups', slice: 2, runs: 'Daily, 01:00', every: { daily: '01:00' }, checks: 'RP sign-ups whose business email was never verified, 30 days after they started (S2C-16)', changes: 'Deletes them, so the email can sign up again', writes: 'rp.signup_deleted by “System”' },
];
export const JOB_RULES: [string, string][] = [
  ['Idempotent', 'Each change has a key: job + record + the date or the moment its condition started (for tasks, the task ID in My work). Running a job twice, or two copies at once, changes nothing the second time. A task closed with Done is not made again for the same condition.'],
  ['Catches up', 'A job acts on every record past its date, not only those that passed since yesterday, so a missed run is made good by the next one. An email whose moment passed by more than 6 hours is not sent late (the morning email is skipped that day).'],
  ['Working days', '“2 working days” and the like count on the record’s region calendar (SLAs). Calendar days (“60 days before”, “90 days”, “14 days”) are plain dates.'],
  ['Switched-off rules', 'Make nothing; their open tasks stay until they clear.'],
  ['Logged', 'Each run writes one line to Admin › Logs: job, start and end time, records checked, records changed, emails sent, and any error with the record it failed on. Each change also writes the record’s Activity, by “System”. A run that fails part-way keeps what it did and picks up the rest next time; three failed runs in a row put a warning on Admin Home (proposal).'],
  ['Not jobs', 'An English test’s 2-year expiry (slice 3) and an intake’s “Late: likelihood is low” are worked out when shown. There is no document expiry job: passport validity was removed everywhere (31 Oct).'],
];
