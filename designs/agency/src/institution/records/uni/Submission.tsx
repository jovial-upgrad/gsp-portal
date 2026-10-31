import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { Field, SelectInput, TextInput } from '../../../components/forms';
import { CHANNELS, FORM_FOR, REGIONS, type Channel, type FormFor, type UniRec } from '../../data/catalogue';
import { CONTACT_FOR, dateText, inDays, type ContactFor, type InstitutionPartner } from '../../data/records';
import { AddButton, Section } from '../parts';
import { ContactTable, FILE_TYPES } from '../PartnerPage';
import type { UniUpd } from '../UniversityPage';

const LINK: Record<Channel, [string, string]> = {
  'Own portal': ['Portal address', 'Like: apply.university.edu'],
  StudyLink: ['StudyLink address', 'studylink.com'],
  Email: ['Email applications go to', 'Like: admissions@university.edu'],
};

/**
 * Submission and contacts (29 Oct, 2nd round, after the PM prototype): the forms the university needs for each level,
 * how GSP sends applications to it (its own portal, StudyLink or email), the logins GSP uses on its portal, kept in
 * the secrets store, and who to talk to about admissions and marketing. 29 Oct (7th round): in that order, and no
 * log of who looked at a password. `part` changes one section and says who did, and when.
 */
export function Submission({ u, p, part, say, me }: { u: UniRec; p?: InstitutionPartner; part: (k: string) => UniUpd; say: (m: string) => void; me: string }) {
  const [channel, setChannel] = useState<Channel | ''>(u.channel);
  const [link, setLink] = useState(u.link);
  const changed = channel !== u.channel || link !== u.link;
  const upd = part('submission');
  return (
    <>
      <Forms u={u} upd={part('forms')} say={say} />
      <Section title="How applications are sent" id="iu-sub" updated={u.stamps.submission} note="Admissions use this to send each application.">
        <div className="itypes itypes--3" role="radiogroup" aria-label="Channel">
          {CHANNELS.map((c) => (
            <label key={c} className={`itype ${channel === c ? 'is-on' : ''}`}>
              <input type="radio" name={`ius-ch-${u.id}`} className="vh" checked={channel === c} onChange={() => (setChannel(c), setLink(c === 'StudyLink' ? 'studylink.com' : c === u.channel ? u.link : ''))} />
              <span className="itype__k">{c}</span>
              <span className="itype__v">{c === 'Own portal' ? 'GSP applies on the university’s own portal' : c === 'StudyLink' ? 'GSP applies through StudyLink' : 'GSP emails each application'}</span>
            </label>
          ))}
        </div>
        {channel && (
          <div className="iaddform__grid">
            <Field id="ius-link" label={LINK[channel][0]}>
              <TextInput id="ius-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder={LINK[channel][1]} />
            </Field>
          </div>
        )}
        {changed && (
          <div className="isave">
            <p className="isave__t">Not saved yet.</p>
            <Button variant="secondary" size="sm" onClick={() => (setChannel(u.channel), setLink(u.link))}>
              Discard
            </Button>
            <Button
              size="sm"
              disabled={!channel || !link.trim()}
              onClick={() => {
                upd((x) => ({ ...x, channel, link: link.trim(), studylink: channel === 'StudyLink' }));
                say('Submission saved.');
              }}
            >
              Save submission
            </Button>
          </div>
        )}
      </Section>
      <Logins u={u} upd={part('logins')} say={say} me={me} />
      <UniContacts u={u} p={p} upd={part('contacts')} say={say} />
    </>
  );
}

/** The forms the university asks for, each for all courses or one level: an application asks for every one that matches. */
function Forms({ u, upd, say }: { u: UniRec; upd: UniUpd; say: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState({ name: '', for: 'All courses' as FormFor, file: '' });
  const [tried, setTried] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const err = { name: !v.name.trim() ? 'Name the form.' : null, file: !v.file ? 'Choose the template.' : null };
  const close = () => {
    setAdding(false);
    setTried(false);
    setV({ name: '', for: 'All courses', file: '' });
  };
  return (
    <Section title="Forms the university needs" id="iu-forms" updated={u.stamps.forms} note="Each is for all courses or one level. An application asks for every form that matches its course." action={!adding ? <AddButton onClick={() => setAdding(true)}>Add a form</AddButton> : undefined}>
      {adding && (
        <div className="iaddform">
          <div className="iaddform__grid">
            <Field id="iuf-name" label="Form" required error={tried ? err.name : null}>
              <TextInput id="iuf-name" value={v.name} invalid={tried && !!err.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Like: International application form" />
            </Field>
            <Field id="iuf-for" label="For">
              <SelectInput id="iuf-for" value={v.for} onChange={(e) => setV({ ...v, for: e.target.value as FormFor })}>
                {FORM_FOR.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="iuf-file" label="Template" required error={tried ? err.file : null} hint="PDF, Word or an image">
              <button id="iuf-file" type="button" className={`ipick ${tried && err.file ? 'is-invalid' : ''}`} onClick={() => pick.current?.click()}>
                <Icon name={v.file ? 'file' : 'upload'} size={18} />
                <span className="ipick__t">{v.file || 'Choose a file'}</span>
              </button>
            </Field>
          </div>
          <input
            ref={pick}
            type="file"
            accept={FILE_TYPES}
            className="vh"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="iuf-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setV((x) => ({ ...x, file: f.name, name: x.name || f.name.replace(/\.[a-z]+$/i, '').replace(/[_-]+/g, ' ') }));
            }}
          />
          <div className="iaddform__acts">
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTried(true);
                if (Object.values(err).some(Boolean)) return;
                upd((x) => ({ ...x, forms: [...x.forms, { id: `fm-${Date.now().toString(36)}`, name: v.name.trim(), for: v.for, file: v.file }] }));
                say(`${v.name.trim()} added.`);
                close();
              }}
            >
              Add form
            </Button>
          </div>
        </div>
      )}
      {u.forms.length ? (
        <ul className="ilist">
          {u.forms.map((f) => (
            <li key={f.id} className="ilist__item">
              <Icon name="file" size={18} />
              <span className="ilist__t">
                {f.name}
                <span className="ilist__sub">
                  {f.for} · {f.file}
                </span>
              </span>
              <button
                type="button"
                className="btn btn--link idanger"
                onClick={() => {
                  upd((x) => ({ ...x, forms: x.forms.filter((y) => y.id !== f.id) }));
                  say(`${f.name} removed.`);
                }}
              >
                Remove<span className="vh"> {f.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="iempty">No forms: applications need only the student’s own documents.</p>
      )}
    </Section>
  );
}

function UniContacts({ u, p, upd, say }: { u: UniRec; p?: InstitutionPartner; upd: UniUpd; say: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [v, setV] = useState({ name: '', title: '', for: 'Admissions' as ContactFor, email: '' });
  const [tried, setTried] = useState(false);
  const err = { name: !v.name.trim() ? 'Enter a name or team.' : null, email: !/^\S+@\S+\.\S+$/.test(v.email.trim()) ? 'Enter an email like name@university.edu.' : null };
  const close = () => {
    setAdding(false);
    setEditing(null);
    setTried(false);
    setV({ name: '', title: '', for: 'Admissions', email: '' });
  };
  return (
    <Section title="University contacts" id="iu-contacts" updated={u.stamps.contacts} note={`Admissions and marketing at the university.${p ? ` The agreement, commission and renewal are with the partner, ${p.name}.` : ''}`} action={!adding ? <AddButton onClick={() => setAdding(true)}>Add a contact</AddButton> : undefined}>
      {adding && (
        <div className="iaddform">
          <div className="iaddform__grid">
            <Field id="iuct-name" label="Name or team" required error={tried ? err.name : null}>
              <TextInput id="iuct-name" value={v.name} invalid={tried && !!err.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </Field>
            <Field id="iuct-for" label="Talk to them about">
              <SelectInput id="iuct-for" value={v.for} onChange={(e) => setV({ ...v, for: e.target.value as ContactFor })}>
                {CONTACT_FOR.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="iuct-email" label="Email" required error={tried ? err.email : null}>
              <TextInput id="iuct-email" type="email" value={v.email} invalid={tried && !!err.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
            </Field>
          </div>
          <div className="iaddform__acts">
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTried(true);
                if (Object.values(err).some(Boolean)) return;
                const c = { name: v.name.trim(), title: v.title, for: v.for, email: v.email.trim() };
                if (editing) upd((x) => ({ ...x, contacts: x.contacts.map((y) => (y.id === editing ? { ...y, ...c } : y)) }));
                else upd((x) => ({ ...x, contacts: [...x.contacts, { id: `ct-${Date.now().toString(36)}`, ...c }] }));
                say(editing ? `${c.name} saved.` : `${c.name} added.`);
                close();
              }}
            >
              {editing ? 'Save contact' : 'Add contact'}
            </Button>
          </div>
        </div>
      )}
      {u.contacts.length ? (
        <ContactTable
          list={u.contacts}
          say={say}
          editing={editing}
          onEdit={(c) => {
            setEditing(c.id);
            setAdding(true);
            setTried(false);
            setV({ name: c.name, title: c.title, for: c.for, email: c.email });
          }}
          onRemove={(id) => upd((x) => ({ ...x, contacts: x.contacts.filter((c) => c.id !== id) }))}
        />
      ) : (
        <p className="iempty">No contacts yet.</p>
      )}
    </Section>
  );
}

/** Portal logins: the password shows for a few seconds when asked. */
function Logins({ u, upd, say, me }: { u: UniRec; upd: UniUpd; say: (m: string) => void; me: string }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState({ region: 'All regions', username: '', secret: '' });
  const [tried, setTried] = useState(false);
  const [showing, setShowing] = useState<string | null>(null);
  useEffect(() => {
    if (!showing) return;
    const t = window.setTimeout(() => setShowing(null), 10000);
    return () => window.clearTimeout(t);
  }, [showing]);
  const err = { username: !v.username.trim() ? 'Enter the username.' : null, secret: v.secret.length < 6 ? 'Enter the password.' : null };
  const close = () => {
    setAdding(false);
    setTried(false);
    setV({ region: 'All regions', username: '', secret: '' });
  };
  return (
    <Section
      title="Portal logins"
      id="iu-logins"
      updated={u.stamps.logins}
      note="The logins GSP uses on the university’s portal or StudyLink, one for each region it gives separate ones for. Kept in the secrets store: the Institution Team adds them, Admissions can look."
      action={!adding ? <AddButton onClick={() => setAdding(true)}>Add a login</AddButton> : undefined}
    >
      {adding && (
        <div className="iaddform">
          <div className="iaddform__grid">
            <Field id="iul-region" label="Region">
              <SelectInput id="iul-region" value={v.region} onChange={(e) => setV({ ...v, region: e.target.value })}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="iul-user" label="Username" required error={tried ? err.username : null}>
              <TextInput id="iul-user" value={v.username} autoComplete="off" invalid={tried && !!err.username} onChange={(e) => setV({ ...v, username: e.target.value })} />
            </Field>
            <Field id="iul-secret" label="Password" required error={tried ? err.secret : null}>
              <TextInput id="iul-secret" type="password" autoComplete="new-password" value={v.secret} invalid={tried && !!err.secret} onChange={(e) => setV({ ...v, secret: e.target.value })} />
            </Field>
          </div>
          <div className="iaddform__acts">
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTried(true);
                if (Object.values(err).some(Boolean)) return;
                upd((x) => ({ ...x, logins: [...x.logins, { id: `lg-${Date.now().toString(36)}`, region: v.region, username: v.username.trim(), secret: v.secret, added: inDays(0), by: me }] }));
                say(`Login for ${v.region} added to the secrets store.`);
                close();
              }}
            >
              Add login
            </Button>
          </div>
        </div>
      )}
      {u.logins.length ? (
        <div className="stab-wrap">
          <table className="itab">
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col">Username</th>
                <th scope="col">Password</th>
                <th scope="col">Added</th>
                <th scope="col">
                  <span className="vh">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {u.logins.map((l) => (
                <tr key={l.id}>
                  <td>{l.region}</td>
                  <td className="num">{l.username}</td>
                  <td>
                    <span className="isecret">
                      <span className="num">{showing === l.id ? l.secret : '••••••••••'}</span>
                      <button
                        type="button"
                        className="btn btn--link"
                        onClick={() => {
                          setShowing(showing === l.id ? null : l.id);
                        }}
                      >
                        {showing === l.id ? 'Hide' : 'Show'}
                        <span className="vh"> the {l.region} password</span>
                      </button>
                    </span>
                  </td>
                  <td>
                    <span className="num">{dateText(l.added)}</span>
                    <span className="irow__sub">{l.by}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--link idanger"
                      onClick={() => {
                        upd((x) => ({ ...x, logins: x.logins.filter((y) => y.id !== l.id) }));
                        say(`${l.region} login removed.`);
                      }}
                    >
                      Remove<span className="vh"> the {l.region} login</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">No logins yet.</p>
      )}
    </Section>
  );
}
