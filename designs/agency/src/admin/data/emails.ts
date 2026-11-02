/**
 * The emails a person can get, for Profile › Email preferences (S4-16), and slice 1's four account emails (PRD
 * slice 1, Emails this slice sends). The account emails are the system's own: the system fills in the name, link or
 * code; they always stay on ("Needed to sign in"). The others are slice 4's notification emails (its PRD owns their
 * wording); every one is On by default and can be turned off. Turning an email off never turns off the bell.
 */
export const SENDER = '“upGrad GSP” no-reply@gsp.upgrad.com (through Amazon SES)';

export type AccountEmail = { id: string; name: string; when: string; subject: string; body: string };
export const ACCOUNT_EMAILS: AccountEmail[] = [
  {
    id: 'setup',
    name: 'Set up your account',
    when: 'A GSP user is created, the link is resent, or they’re reactivated; an RP team member is invited',
    subject: 'Set up your upGrad GSP account',
    body: 'Hi {first name}, {inviter} has given you access to the upGrad GSP portal. Set your password here: {link}. The link works for 7 days.',
  },
  {
    id: 'code',
    name: 'Your code',
    when: 'Step 2 of setting up or resetting a password; an RP verifying its email at sign-up',
    subject: 'Your upGrad GSP code: {code}',
    body: 'Your code is {code}. It works for 10 minutes. If you didn’t ask for it, ignore this email.',
  },
  {
    id: 'changed',
    name: 'Password changed',
    when: 'A password is set or reset',
    subject: 'Your upGrad GSP password was changed',
    body: 'Your password was changed on {date, time}. If this wasn’t you, reset it now: {link}.',
  },
  {
    id: 'paused',
    name: 'Sign-in paused',
    when: 'Too many wrong passwords',
    subject: 'Sign-in to upGrad GSP is paused',
    body: 'We paused sign-in to your account for {minutes} minutes after {n} wrong passwords. To get back in now, reset your password: {link}.',
  },
];

/** The other emails a GSP person can get (slice 4's), each one switch on Profile › Email preferences. */
export const WORK_EMAILS: { id: string; name: string; what: string }[] = [
  { id: 'task-new', name: 'New task for you', what: 'A task lands on you in My work' },
  { id: 'task-due', name: 'Task due soon', what: 'One working day before a task is due' },
  { id: 'task-late', name: 'Task overdue', what: 'A task of yours, or of your queue, is past its SLA' },
  { id: 'daily', name: 'Daily summary', what: 'Your open work, each working morning' },
  { id: 'announce', name: 'Announcements', what: 'New announcements from universities' },
];
