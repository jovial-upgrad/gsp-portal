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

/**
 * The email templates, in slice 4's shape (prd-s4 exports the full list as EMAIL_TEMPLATES in work/mail.ts; this is
 * the GSP side of it, copied until the slices merge, when Profile should read that list). E1 to E4 are slice 1's
 * account emails (canTurnOff false); the rest are the ones a GSP person can get.
 */
export type EmailTemplate = { id: string; name: string; group: string; slice: number; when: string; to: string; canTurnOff: boolean };
export const GSP_EMAIL_TEMPLATES: EmailTemplate[] = [
  { id: 'E1', name: 'Set up your account', group: 'Account', slice: 1, when: 'A GSP user or RP user is created', to: 'The new user', canTurnOff: false },
  { id: 'E2', name: 'Your code', group: 'Account', slice: 1, when: 'Sign-in or a password reset asks for a code', to: 'The person signing in', canTurnOff: false },
  { id: 'E3', name: 'Password changed', group: 'Account', slice: 1, when: 'A password is changed or reset', to: 'The account’s owner', canTurnOff: false },
  { id: 'E4', name: 'Sign-in paused', group: 'Account', slice: 1, when: 'Too many wrong attempts pause sign-in', to: 'The account’s owner', canTurnOff: false },
  { id: 'E14', name: 'Announcement', group: 'Announcements', slice: 2, when: 'An announcement is published with Send as email', to: 'The announcement’s recipients', canTurnOff: true },
  { id: 'E19', name: 'Morning email', group: 'Work', slice: 4, when: '08:30 IST on your working days, when you have a task due today, due tomorrow or late', to: 'The GSP person', canTurnOff: true },
  { id: 'E20', name: 'Renewal reminder', group: 'Work', slice: 4, when: '60 days before an agreement you manage ends', to: 'The partner’s relationship manager', canTurnOff: true },
  { id: 'E21', name: 'Escalated to you', group: 'Work', slice: 4, when: 'A task is late by 5 working days (Admins)', to: 'Every Admin', canTurnOff: true },
];
/** The other emails a GSP person can get, each one switch on Profile › Email preferences. */
export const WORK_EMAILS = GSP_EMAIL_TEMPLATES.filter((e) => e.canTurnOff).map((e) => ({ id: e.id, name: e.name, what: e.when }));
