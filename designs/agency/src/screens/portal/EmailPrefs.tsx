import { useState } from 'react';
import { Switch } from '../../components/forms';
import { EMAIL_TEMPLATES } from '../../work/mail';

/** The emails an RP user gets, from slice 4's one template list (work/mail.ts): the account emails can't be turned off (S4-16). */
const ACCOUNT = EMAIL_TEMPLATES.filter((e) => !e.canTurnOff && e.who !== 'GSP').map((e) => e.name);
const RP_EMAILS: [string, string][] = EMAIL_TEMPLATES.filter((e) => e.canTurnOff && e.who !== 'GSP').map((e) => [e.id, e.name]);
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
