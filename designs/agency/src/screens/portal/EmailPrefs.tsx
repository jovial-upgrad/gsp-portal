import { useState } from 'react';
import { Switch } from '../../components/forms';

/** Slice 1's account emails: they can't be turned off (S4-16). */
const ACCOUNT = ['Your code (sign-up and sign-in)', 'Set up your account', 'Reset your password', 'New sign-in to your account'];
/** The emails an RP user gets in slice 2 (slice 4's templates), each of which they can turn off. */
const RP_EMAILS: [string, string][] = [
  ['E5', 'Welcome, and what’s next'],
  ['E6', 'Documents received'],
  ['E7', 'A document was sent back'],
  ['E13', 'Reminder: documents to replace'],
  ['E8', 'You’re verified: sign your agreement'],
  ['E9', 'Your signed agreement was sent back'],
  ['E10', 'Your agreement is signed: commissions start'],
  ['E11', 'Your partner account’s status changed'],
  ['E12', 'Linked to or unlinked from a Master Partner'],
  ['E14', 'Announcements from GSP'],
];
const KEY = 'gsp-rp-email-prefs';
const load = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

/**
 * Profile › Email preferences (S4-16, Regression row 21): each person can turn off any or all emails, except slice 1's
 * account emails. The bell can't be turned off. Emails come from no-reply@gsp.upgrad.com, with no Reply-to.
 */
export function EmailPrefs() {
  const [off, setOff] = useState<string[]>(load);
  const set = (id: string, on: boolean) => {
    const next = on ? off.filter((x) => x !== id) : [...off, id];
    setOff(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* not kept in a private window */
    }
  };
  return (
    <section className="card pcard" aria-labelledby="ep-title">
      <h2 id="ep-title" className="pcard__title">
        Email preferences
      </h2>
      <p className="pcard__text">Emails come from no-reply@gsp.upgrad.com. Turning one off doesn’t turn off the bell: you still see it in the portal.</p>
      <div className="iswitches">
        {RP_EMAILS.map(([id, label]) => (
          <Switch key={id} id={`ep-${id}`} checked={!off.includes(id)} onChange={(on) => set(id, on)}>
            {label}
          </Switch>
        ))}
      </div>
      <p className="pcard__text">Always on, for your account’s security: {ACCOUNT.join(', ')}.</p>
    </section>
  );
}
