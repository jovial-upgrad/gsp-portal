/**
 * The emails a person can get, for Profile › Email preferences (S4-16), and slice 1's four account emails (PRD
 * slice 1, Emails this slice sends). The account emails are the system's own: the system fills in the name, link or
 * code; they always stay on ("Needed to sign in"). work/mail.ts's EMAIL_TEMPLATES uses this wording for E1 to E4.
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

/* The email template list (E1 to E21, with canTurnOff) is slice 4's EMAIL_TEMPLATES in work/mail.ts: both Email
   preferences pages (GSP Profile and the RP's Profile) read it. */
