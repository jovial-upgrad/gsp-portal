import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { CodeInput } from '../../components/CodeInput';
import { PasswordInput } from '../../components/PasswordInput';
import { DateInput, Field, Switch } from '../../components/forms';
import { afterError, dateError } from '../../components/validate';
import { staffByEmail } from '../../data/staff';
import { setAdminCfg, useAdmin } from '../data/store';
import { leaveOf, setLeave, useLeave, type Leave } from '../../data/leave';
import { TEST_CODE } from '../../data/testing';
import { Facts, Pill, Section } from '../../institution/records/parts';
import { EMAIL_TEMPLATES } from '../../work/mail';

/** GSP's Email preferences read slice 4's one template list: the account emails locked on, the rest one switch each. */
const ACCOUNT_EMAILS = EMAIL_TEMPLATES.filter((e) => !e.canTurnOff && e.who !== 'RP');
const WORK_EMAILS = EMAIL_TEMPLATES.filter((e) => e.canTurnOff && e.who !== 'RP').map((e) => ({ id: e.id, name: e.name, what: e.when }));
import { checkPassword, maskEmail } from '../signin/model';
import { istDay } from '../config/states';

const dayText = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
};

/**
 * A GSP person's own Profile (PRD slice 1, Profile): their details, read only (from Admin › GSP users; nothing Admin
 * owns can be changed here), Change password (the set up or reset flow, for their own email), Leave (from and to,
 * both included; while on leave new work skips them, slice 4) and Email preferences (one switch per email, all On by
 * default; the 4 account emails On and locked, "Needed to sign in"; turning one off never turns off the bell; each
 * change writes email_preferences.changed). Admin can't change someone else's.
 */
export function StaffProfile({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const cfg = useAdmin();
  const staff = staffByEmail(email);
  const u = cfg.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  useLeave();
  const id = u?.id ?? staff?.id ?? email;
  const list = leaveOf(id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  const [pw, setPw] = useState(false);
  const now = istDay(Date.now());
  const onNow = list.find((l) => l.from <= now && now <= l.to);
  const off = cfg.emailOff[id] ?? [];
  const name = u?.name ?? (staff ? `${staff.first} ${staff.last}` : email);
  const add = () => {
    const e = dateError(from, { what: 'From date', required: true }) || dateError(to, { what: 'To date', required: true }) || afterError(from, to, 'To date', 'From date');
    if (e) return setErr(e);
    if (to < now) return setErr('That leave is already over.');
    if (list.some((l) => !(to < l.from || from > l.to))) return setErr('That overlaps leave you’ve already added.');
    setLeave(id, [...list, { from, to }].sort((a, b) => (a.from < b.from ? -1 : 1)));
    setFrom('');
    setTo('');
    setErr('');
  };
  const remove = (l: Leave) => setLeave(id, list.filter((x) => x !== l));
  const toggle = (k: string, label: string, on: boolean) =>
    setAdminCfg((c) => {
      const mine = c.emailOff[id] ?? [];
      const next = on ? mine.filter((x) => x !== k) : [...new Set([...mine, k])];
      // email_preferences.changed, in the audit log
      return { ...c, emailOff: { ...c.emailOff, [id]: next }, log: [{ id: `ep${Date.now()}`, at: Date.now(), who: name, role: u?.role ?? staff?.role ?? '', area: 'Email preferences', text: `email_preferences.changed: “${label}” ${on ? 'Off → On' : 'On → Off'}`, kind: 'change' }, ...c.log] };
    });
  if (!u && !staff)
    return (
      <div className="ipage">
        <p className="muted">{email} isn’t a GSP user.</p>
      </div>
    );
  const parts = name.split(' ');
  const initials = `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`;
  const role = u?.role ?? staff!.role;
  const title = u?.title ?? staff!.title;
  return (
    <div className="ipage irecord">
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">Profile</h1>
          <p className="stu__lead">Your details in GSP users. A GSP Admin changes your name, role, title and sales regions.</p>
        </div>
      </header>
      <section className="card acard iacct" aria-label="Signed in as">
        <span className="savatar iacct__av" aria-hidden="true">
          {initials}
        </span>
        <div className="iacct__t">
          <p className="iacct__name">{name}</p>
          <p className="iacct__org">
            {title} · GSP · {role}
          </p>
          <p className="iacct__mail">{email}</p>
        </div>
        {onNow && <Pill tone="you">On leave until {dayText(onNow.to)}</Pill>}
        <Button variant="secondary" iconLeft={<Icon name="logout" size={18} />} onClick={onSignOut}>
          Sign out
        </Button>
      </section>
      <Section title="Details" id="sp-details" note="Read only.">
        <Facts
          items={[
            ['Name', name],
            ['Email', <a key="e" href={`mailto:${email}`}>{email}</a>],
            ['Phone', (u?.phone ?? staff?.phone) ? <span key="p" className="num">{`${u?.dial ?? staff?.dial} ${u?.phone ?? staff?.phone}`}</span> : '–'],
            ['Role', role],
            ['Title', title || '–'],
            ['Sales regions', (u?.regions ?? staff!.regions).join(', ') || 'No sales region'],
          ]}
        />
      </Section>
      <Section title="Password" id="sp-password" action={<Button size="sm" variant="secondary" iconLeft={<Icon name="key" size={16} />} onClick={() => setPw(true)}>Change password</Button>}>
        <p className="muted">We email a 6-digit code to {maskEmail(email)} to change it.</p>
      </Section>
      <Section title="Leave" id="sp-leave" note="From and to, both included. While you’re on leave, new work skips you.">
        {list.length > 0 ? (
          <ul className="ilist">
            {list.map((l) => (
              <li key={`${l.from}-${l.to}`} className="ilist__item">
                <Icon name="calendar" size={18} />
                <span className="ilist__t">{l.from === l.to ? dayText(l.from) : `${dayText(l.from)} to ${dayText(l.to)}`}</span>
                {l.to < now ? <Pill tone="grey">Past</Pill> : l.from <= now ? <Pill tone="you">Now</Pill> : <Pill tone="gsp">Coming up</Pill>}
                <Button size="sm" variant="secondary" onClick={() => remove(l)}>
                  Remove<span className="vh"> leave from {dayText(l.from)}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No leave added.</p>
        )}
        <div className="sp-leave">
          <Field id="sp-from" label="From">
            <DateInput id="sp-from" value={from} onChange={(x) => (setFrom(x), setErr(''))} />
          </Field>
          <Field id="sp-to" label="To">
            <DateInput id="sp-to" value={to} onChange={(x) => (setTo(x), setErr(''))} />
          </Field>
          <Button onClick={add} iconLeft={<Icon name="plus" size={18} />}>
            Add leave
          </Button>
        </div>
        {err && (
          <p className="sp-leave__err" role="alert">
            {err}
          </p>
        )}
      </Section>
      <Section title="Email preferences" id="sp-email" note="One switch per email you can get, all On to start. Turning one off never turns off the bell.">
        <ul className="cfg__prefs">
          {ACCOUNT_EMAILS.map((e) => (
            <li key={e.id}>
              <span>
                {e.name}
                <span className="irow__sub">{e.when}</span>
              </span>
              <span className="cfg__locked">
                <Icon name="lock" size={14} /> On · Needed to sign in
              </span>
            </li>
          ))}
          {WORK_EMAILS.map((e) => (
            <li key={e.id}>
              <span>
                {e.name}
                <span className="irow__sub">{e.what}</span>
              </span>
              <Switch id={`ep-${e.id}`} checked={!off.includes(e.id)} onChange={(on) => toggle(e.id, e.name, on)}>
                <span className="vh">{e.name}: </span>
                {off.includes(e.id) ? 'Off' : 'On'}
              </Switch>
            </li>
          ))}
        </ul>
      </Section>
      <ChangePassword open={pw} email={email} onClose={() => setPw(false)} />
    </div>
  );
}

/** Change password: the reset flow's code and new-password steps, for the person's own email. */
function ChangePassword({ open, email, onClose }: { open: boolean; email: string; onClose: () => void }) {
  const [step, setStep] = useState<'code' | 'new' | 'done'>('code');
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [tried, setTried] = useState(false);
  const close = () => {
    setStep('code');
    setCode('');
    setCodeErr(null);
    setP1('');
    setP2('');
    setTried(false);
    onClose();
  };
  const { ok } = checkPassword(p1, email);
  const mismatch = tried && ok && p1 !== p2 ? 'The passwords don’t match.' : null;
  return (
    <Sheet
      open={open}
      onClose={close}
      center
      className="iform cfg__sheet"
      title={step === 'done' ? 'Password changed' : 'Change password'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            {step === 'done' ? (
              <Button onClick={close}>Done</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
                {step === 'new' && (
                  <Button
                    onClick={() => {
                      setTried(true);
                      if (ok && p1 === p2) setStep('done');
                    }}
                  >
                    Save new password
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      }
    >
      {step === 'code' && (
        <div className="cfg__form">
          <p>
            We sent a 6-digit code to <strong>{maskEmail(email)}</strong>. It works for 10 minutes. (Prototype: {TEST_CODE}.)
          </p>
          <CodeInput
            id="cp-code"
            value={code}
            invalid={!!codeErr}
            describedBy="cp-code-msg"
            onChange={(x) => (setCode(x), setCodeErr(null))}
            onComplete={(x) => (x === TEST_CODE ? setStep('new') : (setCodeErr('That code isn’t right. Check the email, or send a new one.'), setCode('')))}
          />
          <p id="cp-code-msg" className={`field__msg ${codeErr ? 'field__msg--error' : ''}`} role={codeErr ? 'alert' : undefined}>
            {codeErr ?? 'Not there? Check your spam folder.'}
          </p>
        </div>
      )}
      {step === 'new' && (
        <div className="cfg__form">
          <Field id="cp-pw" label="New password">
            <PasswordInput id="cp-pw" autoComplete="new-password" value={p1} invalid={tried && !ok} aria-describedby="cp-hint" onChange={(e) => setP1(e.target.value)} />
          </Field>
          <Field id="cp-pw2" label="Type it again" error={mismatch}>
            <PasswordInput id="cp-pw2" autoComplete="new-password" value={p2} invalid={!!mismatch} onChange={(e) => setP2(e.target.value)} />
          </Field>
          <p id="cp-hint" className={`pw-hint pw-hint--${ok ? 'ok' : tried ? 'error' : 'idle'}`}>
            8 to 64 characters, with an uppercase letter, a lowercase letter and a number, and not containing your email’s name part.
          </p>
        </div>
      )}
      {step === 'done' && <p>Your password was changed. We’ve emailed {maskEmail(email)} to let you know.</p>}
    </Sheet>
  );
}
