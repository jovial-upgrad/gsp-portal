import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Field, TextInput } from '../../../components/forms';
import { CHANNELS, FORM_FOR, REGIONS, type Channel, type FormFor, type UniRec } from '../../data/catalogue';
import { dateText, inDays, type InstitutionPartner } from '../../data/records';
import { acceptOf, audit, checkFile } from '../../data/changelog';
import { AddButton, Pick, Section } from '../parts';
import { Contacts, downloadFile } from '../PartnerPage';
import type { UniUpd } from '../UniversityPage';

const LINK: Record<Channel, [string, string]> = {
  'Own portal': ['Portal link', 'https://apply.university.edu'],
  StudyLink: ['StudyLink', 'studylink.com'],
  Email: ['Email address', 'admissions@university.edu'],
};
const FORM_KINDS = ['pdf', 'word', 'jpg', 'png'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Submission and contacts (slice 2 PRD): the application forms the university needs (name, file, level), how
 * applications are sent (own portal with its https:// link, StudyLink, or email with a valid address: required to go
 * Live), portal logins by sales region (Institution, IP Ops, Global Ops and Admin edit; Admission, Finance and View
 * Only can Show; each Show is in the audit log), and the university's contacts.
 */
export function Submission({ u, p, part, say, me, role, edit, editLogins, seeLogins }: { u: UniRec; p?: InstitutionPartner; part: (k: string) => UniUpd; say: (m: string) => void; me: string; role: string; edit: boolean; editLogins: boolean; seeLogins: boolean }) {
  const [channel, setChannel] = useState<Channel | ''>(u.channel);
  const [link, setLink] = useState(u.link);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setChannel(u.channel);
    setLink(u.link);
  }, [u.channel, u.link]);
  const changed = channel !== u.channel || link !== u.link;
  const upd = part('submission');
  const err = !channel ? 'Pick how applications are sent.' : channel === 'Own portal' && !/^https:\/\/\S+\.\S+/.test(link.trim()) ? 'Enter the whole web address, starting with https://.' : channel === 'Email' && !EMAIL.test(link.trim()) ? 'Enter a valid email, like name@university.edu.' : null;
  return (
    <>
      <Forms u={u} upd={part('forms')} say={say} edit={edit} />
      <Section title="How applications are sent" id="iu-sub" updated={u.stamps.submission} note="One of own portal (with its link), StudyLink, or email (with the address). Required to go Live.">
        {edit ? (
          <>
            <div className="itypes itypes--3" role="radiogroup" aria-label="How applications are sent">
              {CHANNELS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={channel === c} className={`itype ${channel === c ? 'is-on' : ''}`} onClick={() => (setChannel(c), setLink(c === 'StudyLink' ? 'studylink.com' : c === u.channel ? u.link : ''))}>
                  <span className="itype__t">{c}</span>
                </button>
              ))}
            </div>
            {channel && channel !== 'StudyLink' && (
              <div className="iaddform__grid">
                <Field id="ius-link" label={LINK[channel][0]} required error={tried ? err : null}>
                  <TextInput id="ius-link" value={link} invalid={tried && !!err} onChange={(e) => setLink(e.target.value)} placeholder={LINK[channel][1]} />
                </Field>
              </div>
            )}
            {changed && (
              <div className="isave" role="region" aria-label="Unsaved changes">
                <p className="isave__t">{tried && err ? err : 'Not saved yet.'}</p>
                <Button variant="secondary" size="sm" onClick={() => (setChannel(u.channel), setLink(u.link), setTried(false))}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setTried(true);
                    if (err) return;
                    upd((x) => ({ ...x, channel, link: link.trim(), studylink: channel === 'StudyLink' }));
                    setTried(false);
                    say('Submission saved.');
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </>
        ) : (
          <p>{u.channel ? `${u.channel}${u.channel !== 'StudyLink' && u.link ? `: ${u.link}` : ''}` : <span className="muted">Not set</span>}</p>
        )}
      </Section>
      {seeLogins && <Logins u={u} upd={part('logins')} say={say} me={me} role={role} edit={editLogins} />}
      <Contacts
        id="iu-contacts"
        list={u.contacts}
        edit={edit}
        say={say}
        note={`The university’s own contacts.${p ? ` The agreement, commission and renewal are with ${p.name}.` : ''}`}
        save={(fn) => part('contacts')((x) => ({ ...x, contacts: fn(x.contacts) }))}
      />
    </>
  );
}

/**
 * Application forms the university needs: a name, a file (PDF, Word or image) and a level. Every application to the
 * university at that level gets the mandatory document "University application form, filled" (slice 1, rule 8).
 */
function Forms({ u, upd, say, edit }: { u: UniRec; upd: UniUpd; say: (m: string) => void; edit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState<{ name: string; for: FormFor | ''; file: string }>({ name: '', for: '', file: '' });
  const [tried, setTried] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UniRec['forms'][number] | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const err = { name: !v.name.trim() ? 'Enter the name.' : null, for: !v.for ? 'Pick a level.' : null, file: fileErr ?? (!v.file ? 'Choose a file.' : null) };
  const close = () => {
    setAdding(false);
    setTried(false);
    setFileErr(null);
    setV({ name: '', for: '', file: '' });
  };
  return (
    <Section title="Application forms the university needs" id="iu-forms" updated={u.stamps.forms} note="A form for All courses applies at every level. The RP downloads the blank form beside the document “University application form, filled” and uploads it filled in." action={edit && !adding ? <AddButton onClick={() => setAdding(true)}>Add a form</AddButton> : undefined}>
      {adding && (
        <div className="iaddform">
          <div className="iaddform__grid">
            <Field id="iuf-name" label="Name" required error={tried ? err.name : null}>
              <TextInput id="iuf-name" value={v.name} maxLength={120} invalid={tried && !!err.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Like: International application form" />
            </Field>
            <Field id="iuf-for" label="Level" required error={tried ? err.for : null}>
              <Pick id="iuf-for" label="Level" value={v.for} placeholder="Pick a level" invalid={tried && !!err.for} options={FORM_FOR} onChange={(f) => setV({ ...v, for: f as FormFor })} />
            </Field>
            <Field id="iuf-file" label="File" required error={tried || fileErr ? err.file : null} hint="PDF, Word or an image, up to 20 MB">
              <button id="iuf-file" type="button" className={`ipick ${(tried || fileErr) && err.file ? 'is-invalid' : ''}`} onClick={() => pick.current?.click()}>
                <Icon name={v.file ? 'file' : 'upload'} size={18} />
                <span className="ipick__t">{v.file || 'Choose a file'}</span>
              </button>
            </Field>
          </div>
          <input
            ref={pick}
            type="file"
            accept={acceptOf([...FORM_KINDS])}
            className="vh"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="iuf-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const bad = checkFile(f, [...FORM_KINDS], 20);
              setFileErr(bad);
              setV((x) => ({ ...x, file: bad ? '' : f.name }));
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
                upd((x) => ({ ...x, forms: [...x.forms, { id: `fm-${Date.now().toString(36)}`, name: v.name.trim(), file: v.file, for: v.for as FormFor }] }));
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
                <span className="irow__sub">
                  {f.for} · {f.file}
                </span>
              </span>
              <button type="button" className="btn btn--link" onClick={() => downloadFile(f.file)}>
                Download<span className="vh"> {f.name}</span>
              </button>
              {edit && (
                <button type="button" className="btn btn--link idanger" onClick={() => setRemoving(f)}>
                  Remove<span className="vh"> {f.name}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="iempty">No application forms. Applications to this university don’t ask for one.</p>
      )}
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name}?`}
        confirm="Remove form"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) upd((x) => ({ ...x, forms: x.forms.filter((y) => y.id !== removing.id) }));
          say(`${removing?.name} removed.`);
          setRemoving(null);
        }}
      >
        <p>New applications stop asking for it. Applications that already have it keep theirs.</p>
      </ConfirmDialog>
    </Section>
  );
}

/** Portal logins: by sales region (or All regions); the secret is hidden until shown, and every Show is logged. */
function Logins({ u, upd, say, me, role, edit }: { u: UniRec; upd: UniUpd; say: (m: string) => void; me: string; role: string; edit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState({ region: '', username: '', secret: '' });
  const [tried, setTried] = useState(false);
  const [showing, setShowing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UniRec['logins'][number] | null>(null);
  useEffect(() => {
    if (!showing) return;
    const t = window.setTimeout(() => setShowing(null), 10000);
    return () => window.clearTimeout(t);
  }, [showing]);
  const err = { region: !v.region ? 'Pick a sales region.' : null, username: !v.username.trim() ? 'Enter the username.' : null, secret: !v.secret ? 'Enter the secret.' : null };
  const close = () => {
    setAdding(false);
    setTried(false);
    setV({ region: '', username: '', secret: '' });
  };
  return (
    <Section
      title="Portal logins"
      id="iu-logins"
      updated={u.stamps.logins}
      note="By sales region. Applications use the login for their own region, else the All regions one. Secrets are kept in the secrets store, never in the Change log; each Show is logged."
      action={edit && !adding ? <AddButton onClick={() => setAdding(true)}>Add a login</AddButton> : undefined}
    >
      {adding && (
        <div className="iaddform">
          <div className="iaddform__grid">
            <Field id="iul-region" label="Sales region" required error={tried ? err.region : null}>
              <Pick id="iul-region" label="Sales region" value={v.region} placeholder="Pick a region" invalid={tried && !!err.region} options={REGIONS} onChange={(region) => setV({ ...v, region })} />
            </Field>
            <Field id="iul-user" label="Username" required error={tried ? err.username : null}>
              <TextInput id="iul-user" value={v.username} autoComplete="off" invalid={tried && !!err.username} onChange={(e) => setV({ ...v, username: e.target.value })} />
            </Field>
            <Field id="iul-secret" label="Secret" required error={tried ? err.secret : null}>
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
                <th scope="col">Sales region</th>
                <th scope="col">Username</th>
                <th scope="col">Secret</th>
                <th scope="col">Added by and on</th>
                {edit && (
                  <th scope="col">
                    <span className="vh">Remove</span>
                  </th>
                )}
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
                          if (showing !== l.id) audit('Universities', `Showed the ${l.region} portal login secret for ${u.name}`, me, role);
                          setShowing(showing === l.id ? null : l.id);
                        }}
                      >
                        {showing === l.id ? 'Hide' : 'Show'}
                        <span className="vh"> the {l.region} secret</span>
                      </button>
                    </span>
                  </td>
                  <td>
                    {l.by}
                    <span className="irow__sub num">{dateText(l.added)}</span>
                  </td>
                  {edit && (
                    <td>
                      <button type="button" className="btn btn--link idanger" onClick={() => setRemoving(l)}>
                        Remove<span className="vh"> the {l.region} login</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">No logins yet.</p>
      )}
      <ConfirmDialog
        open={!!removing}
        title={`Remove the ${removing?.region} login?`}
        confirm="Remove login"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) upd((x) => ({ ...x, logins: x.logins.filter((y) => y.id !== removing.id) }));
          say(`${removing?.region} login removed.`);
          setRemoving(null);
        }}
      >
        <p>Its secret is deleted from the secrets store.</p>
      </ConfirmDialog>
    </Section>
  );
}
