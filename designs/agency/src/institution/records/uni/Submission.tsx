import { useEffect, useRef, useState } from 'react';
import { EditOnly } from '../../../proto/viewOnly';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { Field, SelectInput, TextInput } from '../../../components/forms';
import { CHANNELS, FORM_FOR, REGIONS, type Channel, type FormFor, type UniRec } from '../../data/catalogue';
import { dateText, inDays, type InstitutionPartner } from '../../data/records';
import { AddButton, ErrorText, Section, Updated, useAsk } from '../parts';
import { FILE_TYPES } from '../PartnerPage';
import { useContacts } from '../Contacts';
import type { UniUpd } from '../UniversityPage';

/** 3 Nov: StudyLink shows what Own portal does: its portal address, and the logins GSP uses there. */
const LINK: Record<Channel, [string, string]> = {
  'Own portal': ['Portal address', 'Like: apply.university.edu'],
  StudyLink: ['Portal address', 'Like: apply.university.edu'],
  Email: ['Email applications go to', 'Like: admissions@university.edu'],
};
/** Own portal and StudyLink: GSP applies on a portal, with its logins (4 Nov: at least one). */
export const onPortal = (c: Channel | '') => c === 'Own portal' || c === 'StudyLink';
const ON_PORTAL = onPortal;

/**
 * Submission and contacts (29 Oct, 2nd round, after the PM prototype): the forms the university needs for each level,
 * how GSP sends applications to it (its own portal, StudyLink or email), the logins GSP uses on its portal, kept in
 * the secrets store, and who to talk to about admissions and marketing. 29 Oct (7th round): in that order, and no
 * log of who looked at a password. `part` changes one section and says who did, and when. 3 Nov: the portal logins
 * sit in How applications are sent, for Own portal and StudyLink alike, and not for Email. 4 Nov: a login can be
 * edited; Own portal and StudyLink need at least one, so they can't be saved without it, and the last one can't go;
 * removing a form or a login asks first.
 */
export function Submission({ u, part, say, me }: { u: UniRec; p?: InstitutionPartner; part: (k: string) => UniUpd; say: (m: string) => void; me: string }) {
  const [channel, setChannel] = useState<Channel | ''>(u.channel);
  const [link, setLink] = useState(u.link);
  const changed = channel !== u.channel || link !== u.link;
  const upd = part('submission');
  const noLogin = ON_PORTAL(channel) && !u.logins.length;
  return (
    <>
      <Forms u={u} upd={part('forms')} say={say} />
      <Section title="How applications are sent" id="iu-sub" updated={u.stamps.submission}>
        <div className="itypes itypes--3" role="radiogroup" aria-label="Channel">
          {CHANNELS.map((c) => (
            <label key={c} className={`itype ${channel === c ? 'is-on' : ''}`}>
              <input type="radio" name={`ius-ch-${u.id}`} className="vh" checked={channel === c} onChange={() => (setChannel(c), setLink(c === u.channel || (ON_PORTAL(c) && ON_PORTAL(u.channel)) ? u.link : ''))} />
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
            <p className="isave__t">{noLogin ? `Add at least one portal login for ${channel}, then save.` : 'Not saved yet.'}</p>
            <Button variant="secondary" size="sm" onClick={() => (setChannel(u.channel), setLink(u.link))}>
              Discard
            </Button>
            <EditOnly>
              <Button
                size="sm"
                disabled={!channel || !link.trim() || noLogin}
                onClick={() => {
                  upd((x) => ({ ...x, channel, link: link.trim(), studylink: channel === 'StudyLink' }), `${channel === u.channel ? channel : `${u.channel || 'Not set'} → ${channel}`}; ${LINK[channel as Channel][0].toLowerCase()} ${link.trim()}`);
                  say('Submission saved.');
                }}
              >
                Save submission
              </Button>
            </EditOnly>
          </div>
        )}
        {ON_PORTAL(channel) && <Logins u={u} channel={channel as Channel} keepOne={ON_PORTAL(u.channel)} upd={part('logins')} say={say} me={me} />}
      </Section>
      <UniContacts u={u} upd={part('contacts')} say={say} />
    </>
  );
}

/** The forms the university asks for, each for all courses or one level: an application asks for every one that matches. */
function Forms({ u, upd, say }: { u: UniRec; upd: UniUpd; say: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState({ name: '', for: 'All courses' as FormFor, file: '' });
  const [tried, setTried] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const { ask, dialog } = useAsk();
  const err = { name: !v.name.trim() ? 'Name the form.' : null, file: !v.file ? 'Choose the template.' : null };
  const close = () => {
    setAdding(false);
    setTried(false);
    setV({ name: '', for: 'All courses', file: '' });
  };
  return (
    <Section title="Forms the university needs" id="iu-forms" updated={u.stamps.forms} action={!adding ? <AddButton onClick={() => setAdding(true)}>Add a form</AddButton> : undefined}>
      {dialog}
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
            <EditOnly>
              <Button
                size="sm"
                onClick={() => {
                  setTried(true);
                  if (Object.values(err).some(Boolean)) return;
                  upd((x) => ({ ...x, forms: [...x.forms, { id: `fm-${Date.now().toString(36)}`, name: v.name.trim(), for: v.for, file: v.file }] }), `Added ${v.name.trim()} (${v.for})`);
                  say(`${v.name.trim()} added.`);
                  close();
                }}
              >
                Add form
              </Button>
            </EditOnly>
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
              <EditOnly>
                <button
                  type="button"
                  className="btn btn--link idanger"
                  onClick={() =>
                    ask(`Remove ${f.name}?`, 'Remove', <p>New applications stop asking for it. Applications that already have it keep it.</p>, () => {
                      upd((x) => ({ ...x, forms: x.forms.filter((y) => y.id !== f.id) }), `Removed ${f.name}`);
                      say(`${f.name} removed.`);
                    })
                  }
                >
                  Remove<span className="vh"> {f.name}</span>
                </button>
              </EditOnly>
            </li>
          ))}
        </ul>
      ) : (
        <p className="iempty">No forms: applications need only the student’s own documents.</p>
      )}
    </Section>
  );
}

function UniContacts({ u, upd, say }: { u: UniRec; upd: UniUpd; say: (m: string) => void }) {
  const c = useContacts(u.contacts, (fn, what) => upd((x) => ({ ...x, contacts: fn(x.contacts) }), what), say);
  return (
    <Section title="University contacts" id="iu-contacts" updated={u.stamps.contacts} action={<AddButton onClick={c.add}>Add a contact</AddButton>}>
      {u.contacts.length ? c.table : <p className="iempty">No contacts yet.</p>}
      {c.form(u.country)}
    </Section>
  );
}

/**
 * Portal logins: the password shows for a few seconds when asked. 4 Nov: each can be edited in the same form as
 * adding one, and removing one asks first; Own portal and StudyLink need at least one (`keepOne` once it's saved
 * that way), so it says so when there's none, and the last one can't be removed.
 */
function Logins({ u, channel, keepOne, upd, say, me }: { u: UniRec; channel: Channel; keepOne: boolean; upd: UniUpd; say: (m: string) => void; me: string }) {
  // the form: adding a login, or editing one (by its id)
  const [form, setForm] = useState<'new' | string | null>(null);
  const [v, setV] = useState({ region: 'All regions', username: '', secret: '' });
  const [tried, setTried] = useState(false);
  const [showing, setShowing] = useState<string | null>(null);
  const { ask, dialog } = useAsk();
  useEffect(() => {
    if (!showing) return;
    const t = window.setTimeout(() => setShowing(null), 10000);
    return () => window.clearTimeout(t);
  }, [showing]);
  const editing = form && form !== 'new' ? u.logins.find((l) => l.id === form) : undefined;
  const err = { username: !v.username.trim() ? 'Enter the username.' : null, secret: v.secret.length < 6 ? 'Enter the password.' : null };
  const close = () => {
    setForm(null);
    setTried(false);
    setV({ region: 'All regions', username: '', secret: '' });
  };
  const last = keepOne && u.logins.length === 1;
  // pressing Remove on the last one says why it stays, until the logins change
  const [lastTried, setLastTried] = useState(false);
  useEffect(() => setLastTried(false), [u.logins.length, form]);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const f = { region: v.region, username: v.username.trim(), secret: v.secret };
    if (editing) {
      upd((x) => ({ ...x, logins: x.logins.map((y) => (y.id === editing.id ? { ...y, ...f } : y)) }), `Changed the ${f.region} login (${f.username})`);
      say(`Login for ${f.region} saved.`);
    } else {
      upd((x) => ({ ...x, logins: [...x.logins, { id: `lg-${Date.now().toString(36)}`, ...f, added: inDays(0), by: me }] }), `Added the ${f.region} login (${f.username})`);
      say(`Login for ${f.region} added to the secrets store.`);
    }
    close();
  };
  return (
    <div className="iblock ilogins" role="group" aria-labelledby="iu-logins">
      {dialog}
      <div className="iblock__head">
        <div className="irsec__t">
          <h3 className="iblock__title" id="iu-logins">
            Portal logins
            <span className="field__req" aria-hidden="true">
              *
            </span>
            <span className="vh"> (at least one)</span>
          </h3>
          <Updated s={u.stamps.logins} />
        </div>
        {!form && <AddButton onClick={() => (close(), setForm('new'))}>Add a login</AddButton>}
      </div>
      {!u.logins.length && !form && <ErrorText>{channel} needs at least one portal login. Add one.</ErrorText>}
      {form && (
        <div className="iaddform" role="group" aria-label={editing ? `Edit the ${editing.region} login` : 'Add a login'}>
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
            <Button size="sm" onClick={save}>
              {editing ? 'Save' : 'Add login'}
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
                  <span className="vh">Edit or remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {u.logins.map((l) => (
                <tr key={l.id} className={editing?.id === l.id ? 'is-editing' : ''}>
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
                    <span className="irowacts">
                      <EditOnly>
                        <button
                          type="button"
                          className="btn btn--link"
                          onClick={() => {
                            setForm(l.id);
                            setTried(false);
                            setV({ region: l.region, username: l.username, secret: l.secret });
                          }}
                        >
                          Edit<span className="vh"> the {l.region} login</span>
                        </button>
                      </EditOnly>
                      <EditOnly>
                        <button
                          type="button"
                          className="btn btn--link idanger"
                          onClick={() =>
                            last
                              ? setLastTried(true)
                              : ask(`Remove the ${l.region} login?`, 'Remove', <p>{l.username} leaves the secrets store. Admissions can’t use it on the portal any more.</p>, () => {
                                  if (form === l.id) close();
                                  upd((x) => ({ ...x, logins: x.logins.filter((y) => y.id !== l.id) }), `Removed the ${l.region} login (${l.username})`);
                                  say(`${l.region} login removed.`);
                                })
                          }
                        >
                          Remove<span className="vh"> the {l.region} login</span>
                        </button>
                      </EditOnly>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {last && lastTried && <ErrorText>{u.channel} needs at least one portal login, so the last one can’t be removed. Edit it, or add another first.</ErrorText>}
    </div>
  );
}
