import { useState } from 'react';
import type { Contact } from '../data/partners';
import { Icon } from './Icon';
import './contact.css';

/** Icon-only copy: the icon turns into a green check for a moment, and screen readers hear "Copied". */
function CopyButton({ value, what }: { value: string; what: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`copy ${done ? 'is-done' : ''}`}
      aria-label={`Copy ${what}`}
      title={done ? 'Copied' : `Copy ${what}`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1400);
          },
          () => undefined,
        );
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={16} strokeWidth={done ? 2.4 : 1.6} />
      <span className="vh" role="status">
        {done ? 'Copied' : ''}
      </span>
    </button>
  );
}

/** A named GSP person with ways to reach them, and when. Numbers are shown as text; links are a convenience. */
export function ContactCard({ person, hours }: { person: Contact; hours?: string }) {
  return (
    <div className="contact">
      <div className="contact__head">
        <span className="contact__avatar" aria-hidden="true">
          {person.initials}
        </span>
        <div className="contact__who">
          <p className="contact__name">{person.name}</p>
          <p className="contact__role">{person.role}</p>
        </div>
      </div>
      <dl className="contact__lines">
        {person.phone && (
          <div>
            <dt className="vh">Phone</dt>
            <dd>
              <Icon name="phone" size={16} />
              <span className="num">{person.phone}</span>
              <CopyButton value={person.phone} what="phone number" />
            </dd>
          </div>
        )}
        <div>
          <dt className="vh">Email</dt>
          <dd>
            <Icon name="mail" size={16} />
            <span className="contact__email">{person.email}</span>
            <CopyButton value={person.email} what="email address" />
          </dd>
        </div>
        {hours && (
          <div>
            <dt className="vh">Hours</dt>
            <dd>
              <Icon name="clock" size={16} />
              <span>{hours}</span>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
