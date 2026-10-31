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

export const MAILBOXES = [
  { id: 'mb-adm', name: 'GSP Admission', addresses: ['admissions@globalstudypartners.com', 'gsp.admissions@upgrad.com'], routing: 'record-region', queue: 'q-mail', see: ['admission', 'admission-ops', 'admin', 'view-only'], sendAs: ['admission', 'admission-ops'], ytd: 164952 },
  { id: 'mb-ph', name: 'PH Admissions', addresses: ['admissionsph@globalstudypartners.com'], routing: 'record-region', queue: 'q-mail', see: ['admission', 'admission-ops', 'admin', 'view-only'], sendAs: ['admission', 'admission-ops'], ytd: 4847 },
  { id: 'mb-vn', name: 'VN Admission', addresses: ['Vietnam admissions address (to confirm)'], routing: 'record-region', queue: 'q-mail', see: ['admission', 'admission-ops', 'admin', 'view-only'], sendAs: ['admission', 'admission-ops'], ytd: 1190 },
  { id: 'mb-comm', name: 'Commission', addresses: ['commissions@gsp.upgrad.com'], routing: 'queue', queue: 'q-finance', see: ['finance', 'admin', 'view-only'], sendAs: ['finance'], ytd: 67 },
  { id: 'mb-bap', name: 'Recruitment Ops (was BAP)', addresses: ['partners@gsp.upgrad.com'], routing: 'queue', queue: 'q-rp-ops', see: ['recruitment-ops', 'admin', 'view-only'], sendAs: ['recruitment-ops'], ytd: 28 },
];

/* Mail that never reaches a person. Share = of all mail, Jan–Oct 2026. */
export const FILTERS = [
  { id: 'f-system', name: 'GSP system notifications', example: 'GSP System Notification – Enrolment update', does: 'Stopped at source: the portal already records these changes.', share: 46.5, on: true },
  { id: 'f-ack', name: 'Application received or submitted', example: 'Application Submitted – (SCU-…)', does: 'Filed on the application, with the university’s reference recorded.', share: 3.8, on: true },
  { id: 'f-bounce', name: 'Bounces and out-of-office', example: 'Undeliverable: … · Automatic reply: …', does: 'Bounces flag the address on the contact; out-of-office replies are filed.', share: 4.2, on: true },
  { id: 'f-code', name: 'Sign-in and verification codes', example: 'Your verification code', does: 'Sent only to the person who asked for it; never shared.', share: 0.4, on: true },
  { id: 'f-marketing', name: 'Newsletters and marketing', example: 'October at OEG: was anything …', does: 'Sent to Institution Ops as possible announcements.', share: 1.7, on: true },
];

/* What each kind of conversation does once matched. Editable on Mail › Settings. */
export const INTENTS = [
  { id: 'offer', name: 'Unconditional offer', act: 'status', key: 'uol', status: 'Unconditional offer letter received', attach: 'Offer letter', text: 'Add the offer to Documents and move the application to “Unconditional offer letter received”.' },
  { id: 'cond', name: 'Conditional offer', act: 'status', key: 'conditions', status: 'Conditional offer received, conditions pending', attach: 'Offer letter', text: 'Add the offer, record its conditions, and move to “Conditional offer received”.' },
  { id: 'reject', name: 'Rejection', act: 'status', key: 'closed', end: 'Rejected by university', status: 'Closed: Rejected by university', attach: 'Outcome letter', text: 'Close the application as “Rejected by university” and tell the RP.' },
  { id: 'coe', name: 'CoE, CAS or LOA', act: 'status', key: 'visa', status: 'Visa lodgement pending', attach: 'CoE / CAS', text: 'Add the CoE or CAS to Documents and move to “Visa lodgement pending”.' },
  { id: 'info', name: 'University needs more information', act: 'task', kind: 'k-uni-mail', sla: 1, text: 'Get it from the RP: a document request goes to the RP in the application’s chat.' },
  { id: 'answer', name: 'RP answered GSP’s question', act: 'reply', text: 'Pass the RP’s answer to the university, in the same thread.' },
  { id: 'funds', name: 'Funds verification', act: 'task', kind: 'k-gsp-check', sla: 2, text: 'Raise a GSP check task for the funds documents.' },
  { id: 'interview', name: 'Interview or GS', act: 'task', kind: 'k-uni-mail', sla: 1, text: 'Raise a task to book the interview with the student.' },
  { id: 'payment', name: 'Payment receipt', act: 'status', key: 'waitad', status: 'Awaiting acceptance letter from university', attach: 'Payment receipt', text: 'Add the receipt, close “Check payment proof” and move to “Awaiting acceptance letter from university”.' },
  { id: 'enrol', name: 'Enrolment confirmed', act: 'status', key: 'enrolled', status: 'Student enrolled', attach: 'Enrolment confirmation', text: 'Mark enrolled. Finance’s commission lines for it start from this.' },
  { id: 'rp', name: 'RP asking about an application', act: 'chat', text: 'Answer in the application’s chat with the RP, so it’s visible to both sides.' },
  { id: 'new', name: 'RP sending a new application', act: 'task', kind: 'k-verify', sla: 1, text: 'Create the application from the attachments, or ask the RP to add it in the portal.' },
  { id: 'commission', name: 'Commission statement or remittance', act: 'finance', kind: 'k-exception', sla: 2, text: 'Send to Finance to match against Commissions.' },
  { id: 'query', name: 'Other question', act: 'task', kind: 'k-uni-mail', sla: 1, text: 'Raise a task for the officer to answer.' },
];

export const MAIL_SETTINGS = { autoFile: 90, suggest: 60, autoAct: false, nudgeRps: true, waitDays: 3 };

const m = (id, from, h, body, o = {}) => ({ id, from, at: at(h), body, attachments: [], dir: 'in', ...o });
const GSP = ['Gsp Admissions', 'gsp.admissions@upgrad.com'];
const T = (o) => ({ state: 'needs', attachments: 0, messages: [], fields: {}, reasons: [], ...o });

export const THREADS = [
  T({
    id: 'C-1001', mailbox: 'mb-adm', subject: '181395/IRAM/Auckland Institute of Studies/MORE INFORMATION REQUIRED', sender: 'RP', org: 'Info Educuratives', record: 'GSP-24205', conf: 98, intent: 'answer', sla: 1,
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
    id: 'C-1002', mailbox: 'mb-adm', subject: 'UC Application [U3249817] Unconditional offer – Navneet Kaur', sender: 'University', org: 'University of Canberra', record: 'GSP-24206', conf: 97, intent: 'offer', sla: 1, attachments: 1,
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
    id: 'C-1004', mailbox: 'mb-adm', subject: 'Arjun Sharma – SCU enrolment status?', sender: 'RP', org: 'Chetanya Career Consultants', record: 'GSP-24202', conf: 91, intent: 'rp', sla: 1,
    summary: 'The RP is asking when Southern Cross will send the CoE.',
    reasons: ['Sender is the RP on this application', 'Student name matches'],
    draft: 'Hi Anil,\n\nArjun’s enrolment confirmation is with Southern Cross now. You’ll see it in the portal as soon as it arrives, and you can message us there in the application’s chat.\n\nGSP Admissions',
    messages: [m('m1', ['Anil (Chetanya Career Consultants)', 'anil@chetanya.example'], 0.6, 'Hi team,\n\nCan you please update on Arjun Sharma’s enrolment at Southern Cross? Student is asking when the CoE will come.\n\nThanks,\nAnil')],
  }),
  T({
    id: 'C-1005', mailbox: 'mb-adm', subject: 'Action Required On Your Pending Interview – Simran Nair', sender: 'Vendor', org: 'Authentz', record: 'GSP-24207', conf: 88, intent: 'interview', sla: 1,
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
    id: 'C-1007', mailbox: 'mb-adm', subject: 'Genuine student: financial capacity – Navneet Nair', sender: 'University', org: 'TAFE SA', record: 'GSP-24203', conf: 90, intent: 'funds', sla: 2,
    summary: 'TAFE SA needs evidence of AUD 29,710 plus first-year tuition, with 3 months of bank statements, before the CoE.',
    reasons: ['Student name and university match one application'],
    fields: { 'Funds to show': 'AUD 29,710 + first-year tuition', Statements: 'Last 3 months' },
    messages: [m('m1', ['TAFE SA International', 'international@tafesa.example'], 5.2, 'Dear Agent,\n\nBefore we can issue a CoE for Navneet Nair, we need evidence of funds covering 12 months of living costs, tuition and travel (AUD 29,710 + first-year tuition), with bank statements for the last 3 months.\n\nTAFE SA')],
  }),
  T({
    id: 'C-1008', mailbox: 'mb-adm', subject: 'Offer for application 7781902', sender: 'University', org: 'Deakin University', record: 'GSP-24102', conf: 71, intent: 'cond', sla: 1, attachments: 1,
    summary: 'A conditional offer for “Priya R.” at Deakin, condition: final transcripts. Check it’s Priya Raman.',
    reasons: ['First name and initial match Priya Raman', 'Deakin is on one open application', 'Deakin’s number 7781902 isn’t on any application yet'],
    fields: { 'Deakin application': '7781902', Condition: 'Final transcripts', Start: 'Trimester 1, 2027' },
    messages: [m('m1', ['Deakin University', 'noreply@deakin.example'], 6, 'Dear Priya R.,\n\nCongratulations. You have been offered a conditional place in the Master of Information Technology, Trimester 1 2027. Condition: provide final transcripts.\n\nDeakin Admissions', { attachments: ['Offer_7781902.pdf'] })],
  }),
  T({
    id: 'C-1009', mailbox: 'mb-adm', subject: '180204 – Offer letter', sender: 'RP', org: 'SCOL', record: 'GSP-24209', conf: 86, intent: 'rp', sla: 1, attachments: 2,
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
    reasons: ['Student name and university match', 'The application is at “Payment proof under review”'],
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
    id: 'C-1013', mailbox: 'mb-adm', subject: 'New application – Prabhjot Singh', sender: 'RP', org: 'Australia RPC Global', record: null, conf: 41, intent: 'new', sla: 1, attachments: 3, state: 'match',
    summary: 'The RP emailed a new application with a passport and transcripts instead of adding it in the portal.',
    reasons: ['No GSP application for this student yet', 'Sender is a known RP: Australia RPC Global'],
    candidates: [],
    draft: 'Hi team,\n\nThanks for sending this. Please add the application in the portal (Applications › Add application) so it reaches the right Admissions queue straight away, with its documents checked as they upload.\n\nGSP Admissions',
    messages: [m('m1', ['Australia RPC Global', 'apply@rpcglobal.example'], 2.2, 'Hi team,\n\nNew 180388 Prabhjot Singh. Please find passport, transcripts and English test attached. Course: Master of IT, Feb 2027.\n\nThanks', { attachments: ['Passport.pdf', 'Transcripts.pdf', 'PTE.pdf'] })],
  }),
  T({
    id: 'C-1014', mailbox: 'mb-adm', subject: 'Fwd: Application 183962', sender: 'Person', org: 'Jinal Sheth', record: null, conf: 34, intent: 'query', sla: 1, state: 'match',
    summary: 'A forwarded application number with no student name, from a personal address.',
    reasons: ['No GSP reference, student name or university in the email', 'Sender isn’t a known RP, student or university'],
    candidates: ['GSP-24209', 'GSP-24208'],
    messages: [m('m1', ['Jinal Sheth', 'jinal.sheth@gmail.example'], 4.6, 'Please check status of application 183962.')],
  }),
  T({
    id: 'C-1015', mailbox: 'mb-adm', subject: 'Unconditional offer – Bibek Shrestha – BA (Hons) Business Management', sender: 'University', org: 'University of Winchester', record: 'GSP-24223', conf: 95, intent: 'offer', sla: 1, attachments: 1,
    summary: 'Unconditional place for February 2027.',
    reasons: ['Student name, university and course match'],
    fields: { Start: 'February 2027' },
    messages: [m('m1', ['University of Winchester', 'international@winchester.example'], 14, 'Dear Partner,\n\nWe are delighted to offer Bibek Shrestha an unconditional place, starting February 2027.\n\nWinchester International', { attachments: ['Offer_BShrestha.pdf'] })],
  }),
  T({
    id: 'C-1016', mailbox: 'mb-comm', subject: 'Commission remittance – Trimester 2 2026', sender: 'University', org: 'Kaplan Business School', record: null, conf: 98, intent: 'commission', sla: 2, attachments: 1, uni: 'Kaplan Business School',
    summary: 'KBS paid AUD 41,228.40 for 14 students’ Trimester 2 commission.',
    reasons: ['Sender is Kaplan Business School’s finance team', 'Remittance attached'],
    fields: { Students: '14', Amount: 'AUD 41,228.40', Period: 'Trimester 2 2026' },
    messages: [m('m1', ['Kaplan Business School Finance', 'agentpayments@kbs.example'], 20, 'Hello,\n\nPlease find attached the remittance for Trimester 2 2026 commissions (14 students, AUD 41,228.40), paid today.\n\nKBS Finance', { attachments: ['KBS_Remittance_T2_2026.pdf'] })],
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
    id: 'C-1018', mailbox: 'mb-adm', subject: 'Re: Navneet Kaur – conditions', sender: 'University', org: 'University of Canberra', record: 'GSP-24206', conf: 99, intent: 'query', sla: 1, state: 'waiting', waitingOn: 'University', due: Date.now() - 864e5,
    summary: 'GSP sent UC the IELTS result to lift the condition. UC hasn’t answered: 1 day late.',
    reasons: ['University reference U3249817'],
    messages: [m('m1', GSP, 74, 'Dear UC Admissions,\n\nPlease find the IELTS result to lift the English condition for U3249817.\n\nGSP Admissions', { dir: 'out', to: 'intladmissions@canberra.example', attachments: ['IELTS_TRF.pdf'] })],
  }),
  /* done */
  T({
    id: 'C-1019', mailbox: 'mb-adm', subject: 'Offer of admission – Imran Islam', sender: 'University', org: 'Griffith University', record: 'GSP-24215', conf: 96, intent: 'offer', state: 'done', doneBy: 'u-kamrun-nahar', doneAt: at(25), outcome: 'Offer added to Documents; status moved to Unconditional offer letter received.',
    summary: 'Unconditional offer.', reasons: ['Student name and university match'],
    messages: [m('m1', ['Griffith University', 'intl@griffith.example'], 26, 'Offer attached.', { attachments: ['Offer.pdf'] })],
  }),
];

/* Filed without a person (a sample; the counts on Filed show the real share). */
export const FILED = [
  { id: 'F-1', filter: 'f-system', from: 'no-reply@globalstudypartners.com', subject: 'GSP System Notification – Enrolment Course update', at: at(0.3), outcome: 'GSP’s own notification. To be stopped at source.' },
  { id: 'F-2', filter: 'f-system', from: 'no-reply@globalstudypartners.com', subject: 'GSP System Notification – Student update', at: at(0.9), outcome: 'GSP’s own notification. To be stopped at source.' },
  { id: 'F-3', filter: 'f-marketing', from: 'Opulence Education Group', subject: 'October at OEG: was anything missed?', at: at(1.1), outcome: 'Newsletter. Sent to Institution Ops as a possible announcement.' },
  { id: 'F-4', filter: 'f-code', from: 'UWA Accounts', subject: 'Your verification code', at: at(1.4), outcome: 'A sign-in code. Sent only to Tasha Tandon, who asked for it from the UWA portal.' },
  { id: 'F-5', filter: 'f-ack', from: 'AUT (ArionSystem)', subject: 'Partners Online Application Received – AUT-26-55190', at: at(1.8), record: 'GSP-24214', outcome: 'Filed on GSP-24214. University reference AUT-26-55190 recorded.' },
  { id: 'F-6', filter: 'f-ack', from: 'University of Tasmania', subject: 'Application submitted', at: at(3.3), record: 'GSP-24221', outcome: 'Filed on GSP-24221. University reference 5523019 recorded.' },
  { id: 'F-7', filter: 'f-bounce', from: 'Mail Delivery Subsystem', subject: 'Undeliverable: Document request', at: at(4), outcome: 'Bounce. Address flagged on Lead Ahead Consultancy’s contact.' },
  { id: 'F-8', filter: 'f-bounce', from: 'Catherine (UC)', subject: 'Automatic reply: conditions', at: at(5), outcome: 'Out-of-office. Filed.' },
  { id: 'F-9', filter: 'f-marketing', from: 'Study Group Admissions', subject: 'Partner update: February 2027 intake', at: at(18), outcome: 'Newsletter. Sent to Institution Ops.' },
];

/* Conversations no record was found for raise a task in the Unmatched mail queue. */
export const MAIL_RECORDS = THREADS.filter((t) => !t.record && t.state === 'match').map((t) => ({ id: t.id, type: 'Email', label: `Email · ${t.subject}` }));
export const MAIL_TASKS = THREADS.filter((t) => !t.record && t.state === 'match').map((t, i) => ({
  id: 'T-' + t.id, record: t.id, kind: 'k-mail', queue: 'q-mail', rule: null, title: `Match email: ${t.subject}`, created: t.messages[t.messages.length - 1].at, status: 'open', assignee: i === 0 ? 'u-ashu-rajpal' : null,
}));
