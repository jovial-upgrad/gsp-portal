import { useEffect, useState } from 'react';
import { EditOnly } from '../../proto/viewOnly';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Field, SelectInput, TextInput, describedBy } from '../../components/forms';
import { PhoneInput } from '../../components/PhoneInput';
import { CopyButton } from '../students/parts';
import { CONTACT_FOR, DIAL, contactName, type Contact, type ContactFor } from '../data/records';
import { Pager, useAsk, usePaged } from './parts';

type Draft = { first: string; last: string; title: string; for: ContactFor | ''; dial: string; phone: string; email: string };

/**
 * Adding or editing a contact (3 Nov): a pop-up with first and last name, title, what they're for, a phone with its
 * country code, and email; the names, For and email are needed. Its buttons on the right, as every pop-up's are.
 * The same form on an institution partner and on a university.
 */
export function ContactForm({ open, c, country, onCancel, onSave }: { open: boolean; c: Contact | null; country: string; onCancel: () => void; onSave: (c: Omit<Contact, 'id'>) => void }) {
  const blank = (): Draft => ({ first: '', last: '', title: '', for: '', dial: DIAL[country] ?? '+61', phone: '', email: '' });
  const [v, setV] = useState<Draft>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(c ? { first: c.first, last: c.last, title: c.title, for: c.for, dial: c.dial || (DIAL[country] ?? '+61'), phone: c.phone, email: c.email } : blank());
    setTried(false);
  }, [open, c]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Draft>) => setV((x) => ({ ...x, ...p }));
  const err = {
    first: !v.first.trim() ? 'Enter their first name.' : null,
    last: !v.last.trim() ? 'Enter their last name.' : null,
    for: !v.for ? 'Pick what they’re for.' : null,
    phone: v.phone.trim() && v.phone.replace(/\D/g, '').length < 6 ? 'Enter the whole number, or leave it empty.' : null,
    email: !v.email.trim() ? 'Enter their email.' : !/^\S+@\S+\.\S+$/.test(v.email.trim()) ? 'Enter an email like name@university.edu.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title={c ? 'Edit contact' : 'Add a contact'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <EditOnly>
              <Button
                onClick={() => {
                  setTried(true);
                  if (Object.values(err).some(Boolean)) return;
                  onSave({ first: v.first.trim(), last: v.last.trim(), title: v.title.trim(), for: v.for as ContactFor, dial: v.dial, phone: v.phone.trim(), email: v.email.trim() });
                }}
              >
                Save
              </Button>
            </EditOnly>
          </div>
        </div>
      }
    >
      <p className="ireq">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required
      </p>
      <div className="iform__grid">
        <Field id="ict-first" label="First name" required error={show('first')}>
          <TextInput id="ict-first" value={v.first} autoComplete="off" invalid={!!show('first')} onChange={(e) => set({ first: e.target.value })} />
        </Field>
        <Field id="ict-last" label="Last name" required error={show('last')}>
          <TextInput id="ict-last" value={v.last} autoComplete="off" invalid={!!show('last')} onChange={(e) => set({ last: e.target.value })} />
        </Field>
        <Field id="ict-title" label="Title">
          <TextInput id="ict-title" value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="Like: Head of International Partnerships" />
        </Field>
        <Field id="ict-for" label="For" required error={show('for')}>
          <SelectInput id="ict-for" value={v.for} placeholder="Pick one" invalid={!!show('for')} onChange={(e) => set({ for: e.target.value as ContactFor })}>
            {CONTACT_FOR.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="ict-phone" label="Phone" error={show('phone')}>
          <PhoneInput id="ict-phone" dial={v.dial} number={v.phone} invalid={!!show('phone')} describedBy={describedBy('ict-phone', show('phone'))} onDial={(d) => set({ dial: d })} onNumber={(p) => set({ phone: p })} />
        </Field>
        <Field id="ict-email" label="Email" required error={show('email')}>
          <TextInput id="ict-email" type="email" value={v.email} autoComplete="off" invalid={!!show('email')} onChange={(e) => set({ email: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Contacts as a table, on a partner and on a university: each can be edited (in the pop-up) or removed. */
export function ContactTable({ list, say, onRemove, onEdit }: { list: Contact[]; say: (m: string) => void; onRemove: (c: Contact) => void; onEdit: (c: Contact) => void }) {
  const pg = usePaged(list);
  return (
    <>
    <div className="stab-wrap">
      <table className="itab">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">For</th>
            <th scope="col">Phone</th>
            <th scope="col">Email</th>
            <th scope="col">
              <span className="vh">Edit or remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pg.rows.map((c) => (
            <tr key={c.id}>
              <td>
                {contactName(c)}
                {c.title && <span className="irow__sub">{c.title}</span>}
              </td>
              <td>{c.for}</td>
              <td className="num">{c.phone ? `${c.dial} ${c.phone}` : <span className="muted">Not added</span>}</td>
              <td>
                <span className="ifacts__copy">
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                  <CopyButton text={c.email} what="Email" onDone={say} />
                </span>
              </td>
              <td>
                <span className="irowacts">
                  <EditOnly>
                    <button type="button" className="btn btn--link" onClick={() => onEdit(c)}>
                      Edit<span className="vh"> {contactName(c)}</span>
                    </button>
                  </EditOnly>
                  <EditOnly>
                    <button type="button" className="btn btn--link idanger" onClick={() => onRemove(c)}>
                      Remove<span className="vh"> {contactName(c)}</span>
                    </button>
                  </EditOnly>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pager pg={pg} what="contacts" />
    </>
  );
}

/**
 * A list of contacts with Add a contact in its section's head: the pop-up adds or edits one. `upd` saves the list,
 * with a line for the log. 4 Nov: removing one asks first.
 */
export function useContacts(list: Contact[], upd: (fn: (l: Contact[]) => Contact[], what: string) => void, say: (m: string) => void) {
  const [form, setForm] = useState<Contact | 'new' | null>(null);
  const { ask, dialog } = useAsk();
  return {
    add: () => setForm('new'),
    table: (
      <>
        <ContactTable
          list={list}
          say={say}
          onEdit={(c) => setForm(c)}
          onRemove={(c) =>
            ask(`Remove ${contactName(c)}?`, 'Remove', <p>Their name, phone and email go from the contacts.</p>, () => {
              upd((l) => l.filter((x) => x.id !== c.id), `Removed ${contactName(c)}`);
              say(`${contactName(c)} removed.`);
            })
          }
        />
        {dialog}
      </>
    ),
    form: (country: string) => (
      <ContactForm
        open={!!form}
        c={form && form !== 'new' ? form : null}
        country={country}
        onCancel={() => setForm(null)}
        onSave={(c) => {
          const was = form && form !== 'new' ? form : null;
          if (was) upd((l) => l.map((x) => (x.id === was.id ? { ...x, ...c } : x)), `Changed ${contactName({ ...was, ...c })}`);
          else upd((l) => [...l, { id: `ct-${Date.now().toString(36)}`, ...c }], `Added ${contactName({ id: '', ...c })} (${c.for})`);
          say(was ? `${contactName({ ...was, ...c })} saved.` : `${contactName({ id: '', ...c })} added.`);
          setForm(null);
        }}
      />
    ),
  };
}
