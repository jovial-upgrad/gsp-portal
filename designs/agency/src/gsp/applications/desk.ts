import { money, submission, type Destination } from '../../data/courses';
import { shortDate } from '../../data/dates';
import { fullName, type Student } from '../../data/students';
import { ENROL_DOC, ENROL_DOC_LONG, VISA_NAME, censusOf, courseOf, destOf, gspContact, stageOf, type Application, type StatusKey } from '../../data/applications';

/**
 * What only GSP's team keeps for an application: the university's mail about it, where and how it's
 * submitted, and the census date and final tuition fee. Kept apart from the application itself, so the
 * agency portal never sees it.
 */
export type Mail = {
  id: string;
  at: number;
  from: { name: string; email: string };
  to: string[];
  subject: string;
  body: string;
  files?: string[];
  /** In from the university, sent by GSP, or kept as a draft. */
  box: 'in' | 'sent' | 'draft';
  read?: boolean;
  /** GSP Assist's summary, a line each. Written for the sample mail; read from the body for the rest. */
  summary?: string[];
  /** Who it's from, when not the university: the visa grant comes from the immigration authority. */
  org?: string;
};

/** Where the application goes in: by mail to an address, or through StudyLink or the university's own portal. */
export type Channel = { via: 'mail'; email: string } | { via: 'studylink' | 'portal'; url: string; username: string; password: string };
export const CHANNEL_NAME: Record<Channel['via'], string> = { mail: 'Through mail', studylink: 'Through StudyLink', portal: 'Through the university portal' };

/** `dismissed`: university documents in the mail GSP chose not to add to Documents. */
export type Desk = { mails: Mail[]; channel: Channel; census: number; fee: number; dismissed?: string[] };

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The first day of an intake like "Feb 2027". */
export const intakeStart = (intake: string) => {
  const [m, y] = intake.split(' ');
  return new Date(Number(y), Math.max(0, MONTHS.indexOf(m)), 1).getTime();
};
/** A date with its year: "31 Mar 2027". */
export const longDate = (t: number) => `${shortDate(new Date(t))} ${new Date(t).getFullYear()}`;

/** How the university takes applications from GSP: the Institution Team's university record (Jovial, 31 Oct). */
function channelFor(a: Application): Channel {
  const u = courseOf(a).uni;
  const sub = submission(u.id);
  if (!sub || sub.channel === 'Email') return { via: 'mail', email: sub?.link || `international@${u.website ?? `${u.id}.edu`}` };
  if (sub.channel === 'StudyLink') return { via: 'studylink', url: `https://www.studylink.com/${u.id}`, username: sub.username ?? '', password: sub.secret ?? '' };
  return { via: 'portal', url: `https://${sub.link}`, username: sub.username ?? '', password: sub.secret ?? '' };
}

/** The university's mail so far, from where the application has got to. */
function mailsFor(a: Application, s: Student): Mail[] {
  const c = courseOf(a);
  const u = c.uni;
  const web = u.website ?? `${u.id}.edu`;
  const g = gspContact(u.country);
  const gspMail = `${g.name.toLowerCase().replace(' ', '.')}@gsp.upgrad.com`;
  const admissions = { name: `${u.name} Admissions`, email: `admissions@${web}` };
  const name = fullName(s);
  const at = (re: RegExp) => a.history.find((e) => re.test(e.text))?.at;
  const out: Mail[] = [];
  const submitted = a.uniRef ? at(/^Submitted to/i) ?? a.created + DAY : undefined;
  if (a.uniRef && submitted) {
    out.push({
      id: `${a.id}-m1`,
      at: submitted + 3 * 3_600_000,
      from: admissions,
      to: [gspMail],
      subject: `Application received: ${name}, ${c.name} (${a.uniRef})`,
      body: `Dear ${g.first},\n\nThank you for submitting ${name}'s application for the ${c.name}, ${a.intake} intake.\n\nYour reference is ${a.uniRef}. Please quote it in all correspondence about this application.\n\nWe aim to make an assessment within ${c.offerDays} working days. We will contact you if we need anything further.\n\nKind regards,\nInternational Admissions\n${u.name}`,
      box: 'in',
      read: true,
      summary: [`${u.name} has received ${s.first}'s application for the ${c.name}, ${a.intake}.`, `Their reference is ${a.uniRef}: quote it in every mail.`, `A decision usually takes about ${c.offerDays} working days.`],
    });
  }
  if (a.chased) {
    out.push({
      id: `${a.id}-m2`,
      at: a.chased,
      from: { name: g.name, email: gspMail },
      to: [admissions.email],
      subject: `Update requested: ${name} (${a.uniRef})`,
      body: `Dear Admissions team,\n\nCould you let us know where ${name}'s application (${a.uniRef}) stands? It has been with you longer than usual for this course.\n\nMany thanks,\n${g.name}\nupGrad GSP`,
      box: 'sent',
      read: true,
      summary: [`GSP asked ${u.name} for an update on ${s.first}'s application.`, 'It has been with the university longer than usual.'],
    });
  }
  if (a.offer) {
    const o = a.offer;
    out.push({
      id: `${a.id}-m3`,
      at: o.at - 2 * 3_600_000,
      from: { name: `${u.name} Offers`, email: `offers@${web}` },
      to: [gspMail],
      subject: `${o.kind === 'conditional' ? 'Conditional offer' : 'Offer'} of admission: ${name} (${a.uniRef ?? c.name})`,
      body: `Dear ${g.first},\n\nWe are pleased to make ${name} ${o.kind === 'conditional' ? 'a conditional' : 'an unconditional'} offer of admission to the ${c.name}, starting ${a.intake}.\n\n${o.conditions.length ? `The offer is subject to these conditions:\n${o.conditions.map((x, i) => `${i + 1}. ${x.text}`).join('\n')}\n\n` : ''}To accept, please return the signed acceptance and pay the deposit of ${money(o.deposit, c.currency)} by ${longDate(o.acceptBy)}.\n\nThe offer letter is attached.\n\nKind regards,\nAdmissions Offers\n${u.name}`,
      files: [o.file],
      box: 'in',
      read: false,
      summary: [
        `${o.kind === 'conditional' ? 'A conditional' : 'An unconditional'} offer for ${s.first}, ${c.name}, ${a.intake}.`,
        ...(o.conditions.length ? [`${o.conditions.length === 1 ? '1 condition' : `${o.conditions.length} conditions`}: ${o.conditions.map((x) => x.doc ?? x.text).join('; ')}.`] : []),
        `Accept and pay the ${money(o.deposit, c.currency)} deposit by ${longDate(o.acceptBy)}.`,
      ],
    });
  }
  if (a.status === 'moreinfo') {
    out.push({
      id: `${a.id}-m4`,
      at: a.since,
      from: admissions,
      to: [gspMail],
      subject: `More information needed: ${name} (${a.uniRef})`,
      body: `Dear ${g.first},\n\nTo complete our assessment of ${name}'s application, please send a short statement explaining the gap in study since the last qualification.\n\nPlease reply to this email within 7 days.\n\nKind regards,\nInternational Admissions\n${u.name}`,
      box: 'in',
      read: false,
      summary: [`${u.name} needs a gap statement from ${s.first} to finish assessing.`, 'Reply within 7 days.'],
    });
  }
  const doc = statusMail(a, s, a.status, Date.now() - 2 * 3_600_000);
  if (doc) out.push(doc);
  if (stageOf(a) >= 5 && a.status !== 'closed') {
    out.push({
      id: `${a.id}-m5`,
      at: a.since,
      from: { name: `${u.name} Admissions`, email: `admissions@${web}` },
      to: [gspMail],
      subject: `Deposit and acceptance received: ${name} (${a.uniRef})`,
      body: `Dear ${g.first},\n\nWe have received ${name}'s signed acceptance and deposit. The acceptance document will follow by email.\n\nKind regards,\nInternational Admissions\n${u.name}`,
      box: 'in',
      read: true,
      summary: [`${u.name} has ${s.first}'s acceptance and deposit.`, 'The acceptance document follows by mail.'],
    });
  }
  return out.sort((x, y) => y.at - x.at);
}

/** Who grants the student visa, by destination: the visa grant comes from them by mail. */
const VISA_BODY: Record<Destination, { name: string; email: string }> = {
  Australia: { name: 'Department of Home Affairs', email: 'noreply@homeaffairs.gov.au' },
  UK: { name: 'UK Visas and Immigration', email: 'noreply@ukvi.homeoffice.gov.uk' },
  USA: { name: 'U.S. Department of State', email: 'noreply@state.gov' },
  Canada: { name: 'Immigration, Refugees and Citizenship Canada', email: 'noreply@cic.gc.ca' },
  'New Zealand': { name: 'Immigration New Zealand', email: 'noreply@immigration.govt.nz' },
  Ireland: { name: 'Immigration Service Delivery', email: 'noreply@irishimmigration.ie' },
};

/**
 * The document a status comes with, by mail, for GSP Assist to offer to add to Documents (Nesil, 28 Oct): the
 * conditional offer letter, the unconditional offer letter, the acceptance letter (CoE, CAS, I-20, LOA) and the
 * visa grant. None when the offer that came already is this one.
 */
export function statusMail(a: Application, s: Student, k: StatusKey, at: number): Mail | undefined {
  const c = courseOf(a);
  const u = c.uni;
  const web = u.website ?? `${u.id}.edu`;
  const g = gspContact(u.country);
  const gspMail = `${g.name.toLowerCase().replace(' ', '.')}@gsp.upgrad.com`;
  const name = fullName(s);
  const short = u.name.replace(/ University$|^University of (the )?/, '').replace(/\s+/g, '_');
  const ref = a.uniRef ? ` (${a.uniRef})` : '';
  const file = (doc: string, withRef = true) => `${doc}_${s.first}_${s.last}${withRef && a.uniRef ? `_${a.uniRef}` : ''}.pdf`.replace(/\s+/g, '_').replace(/_+/g, '_');
  const base = { at, to: [gspMail], box: 'in' as const, read: false };
  if ((k === 'conditions' && a.offer?.kind !== 'conditional') || (k === 'uol' && a.offer?.kind !== 'unconditional')) {
    const cond = k === 'conditions';
    return {
      ...base,
      id: `${a.id}-${k}`,
      from: { name: `${u.name} Offers`, email: `offers@${web}` },
      subject: `${cond ? 'Conditional offer' : 'Unconditional offer'} of admission: ${name}${ref}`,
      body: `Dear ${g.first},\n\nWe are pleased to make ${name} ${cond ? 'a conditional' : 'an unconditional'} offer of admission to the ${c.name}, starting ${a.intake}.\n\n${cond ? 'The conditions are set out in the offer letter, attached.' : 'The offer letter is attached. The student can now accept the offer and pay the deposit.'}\n\nKind regards,\nAdmissions Offers\n${u.name}`,
      files: [file(`${short}_${cond ? 'conditional' : 'unconditional'}_offer`)],
      summary: [`${cond ? 'A conditional' : 'An unconditional'} offer for ${s.first}, ${c.name}, ${a.intake}.`, cond ? 'The conditions are in the offer letter, attached.' : `${s.first} can now accept and pay the deposit.`],
    };
  }
  if (k === 'waitad') {
    const doc = ENROL_DOC[u.country];
    return {
      ...base,
      id: `${a.id}-m6`,
      from: { name: `${u.name} Admissions`, email: `admissions@${web}` },
      subject: `Your ${doc}: ${name}${ref}`,
      body: `Dear ${g.first},\n\nPlease find attached ${name}'s ${ENROL_DOC_LONG[u.country]} for the ${c.name}, ${a.intake} intake.\n\nThe student will need it for the visa application.\n\nKind regards,\nInternational Admissions\n${u.name}`,
      files: [file(doc)],
      summary: [`${u.name} has issued ${s.first}'s ${doc}.`, `It's attached; ${s.first} needs it for the visa.`],
    };
  }
  if (k === 'startdate') {
    const d = destOf(a);
    const body = VISA_BODY[d];
    return {
      ...base,
      id: `${a.id}-visa`,
      from: body,
      org: body.name,
      subject: `Visa grant notice: ${name}`,
      body: `Dear ${g.first},\n\nThis is to confirm that ${name}'s ${VISA_NAME[d]} has been granted, for the ${c.name} at ${u.name}.\n\nThe grant notice is attached. Please keep it with the student's records.\n\n${body.name}`,
      files: [file('Visa_grant', false)],
      summary: [`${s.first}'s visa has been granted.`, 'The grant notice is attached.'],
    };
  }
  return undefined;
}
/** Census date: the catalogue's, for this intake. Final tuition fee: the course's yearly tuition. */
export function deskFor(a: Application, s: Student): Desk {
  const c = courseOf(a);
  return { mails: mailsFor(a, s), channel: channelFor(a), census: censusOf(a), fee: c.tuition };
}

/** GSP Assist's summary of a mail: the written one, or its first few sentences. */
export function summaryOf(m: Mail): string[] {
  if (m.summary?.length) return m.summary;
  const text = m.body
    .split('\n')
    .filter((l) => l.trim() && !/^(dear|hi|hello|kind regards|regards|many thanks|thanks|best)/i.test(l.trim()))
    .join(' ');
  const sentences = text.match(/[^.!?]+[.!?]/g) ?? [text];
  return sentences.slice(0, 3).map((x) => x.trim());
}

/** The RP's person on an application, as GSP reaches them: the student's counsellor at the agency. */
export function rpContact(name: string, role: string, agency: string) {
  const [first, ...rest] = name.split(' ');
  const domain = `${agency.toLowerCase().replace(/[^a-z]/g, '')}.com`;
  const n = [...name].reduce((t, ch) => t + ch.charCodeAt(0), 0);
  return {
    name,
    first,
    role: `${role}, ${agency}`,
    email: `${[first, ...rest.slice(-1)].join('.').toLowerCase()}@${domain}`,
    phone: `+91 98${String(450 + (n % 500)).padStart(3, '0')} ${String(10000 + ((n * 37) % 89999)).slice(0, 5)}`,
  };
}

/** A university document that came in GSP's mail and isn't in Documents yet: GSP Assist offers to add it for the RP. `org`: who sent it. */
export type MailDoc = { mail: Mail; file: string; name: string; org: string };
/** What a university document is, from its file name: offer letters, the acceptance letter (CoE, CAS, I-20, LOA), the visa. */
function uniDocName(file: string, a: Application) {
  const d = courseOf(a).uni.country;
  if (/uncond/i.test(file)) return 'Unconditional offer letter';
  if (/conditional/i.test(file)) return 'Conditional offer letter';
  if (/(^|[^a-z])(coe|cas|i-?20|loa)([^a-z]|$)|acceptance|confirmation[-_ ]of[-_ ]enrol|offer[-_ ]of[-_ ]place/i.test(file)) return ENROL_DOC_LONG[d];
  if (/visa|grant/i.test(file)) return 'Visa grant letter';
  if (/offer/i.test(file)) return a.offer?.file === file ? (a.offer.kind === 'conditional' ? 'Conditional offer letter' : 'Unconditional offer letter') : 'Offer letter';
  return undefined;
}
/** The document each status waits on from the mail: the offer letters, the acceptance letter, the visa grant. */
function nudgeFor(a: Application) {
  const d = courseOf(a).uni.country;
  return a.status === 'conditions' ? 'Conditional offer letter' : a.status === 'uol' ? 'Unconditional offer letter' : a.status === 'waitad' ? ENROL_DOC_LONG[d] : a.status === 'startdate' ? 'Visa grant letter' : undefined;
}
/** The university documents in the mail that aren't in Documents: only the one the status is about (Nesil, 28 Oct). */
export function mailDocs(desk: Desk, a: Application): MailDoc[] {
  const want = nudgeFor(a);
  const out: MailDoc[] = [];
  if (!want) return out;
  for (const m of desk.mails.filter((x) => x.box === 'in').sort((x, y) => y.at - x.at))
    for (const file of m.files ?? []) {
      const name = uniDocName(file, a);
      if (name === want && !a.files.some((f) => f.file === file) && !desk.dismissed?.includes(file)) out.push({ mail: m, file, name, org: m.org ?? courseOf(a).uni.name });
    }
  return out;
}
