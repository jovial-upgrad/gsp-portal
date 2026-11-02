import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from '../components/Icon';
import { SelectMenu } from '../components/SelectMenu';
import type { Theme } from '../theme';
import { ROLES, type Role } from './roles';
import type { Link } from './link';
import './proto.css';

export type Device = 'desktop' | 'phone';
type Group = { title: string; items: { key: string; label: string; /** shown indented, under the item before it */ sub?: boolean }[] };

/** A group heading that opens and closes what's under it. */
function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  const fold = reduce ? {} : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.2 } };
  return (
    <div>
      <button type="button" className="proto__label proto__toggle" aria-expanded={open} onClick={onToggle}>
        {title}
        <Icon name="chevronDown" size={16} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" className="proto__body" {...fold}>
            <div className="proto__inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Prototype-only controls: jump to any state, switch theme and device, and, beside them, the role the portal is
 * seen as. Not part of the product design.
 */
export function ProtoPanel({
  groups,
  current,
  onJump,
  theme,
  onTheme,
  device,
  onDevice,
  role,
  onRole,
  link,
  onLink,
  links,
  onSplit,
  pane = false,
  onReset,
}: {
  groups: Group[];
  current: string | null;
  onJump: (key: string) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  device: Device;
  onDevice: (d: Device) => void;
  role: Role;
  onRole: (r: Role) => void;
  /** Which applications are the same in both roles. */
  link: Link;
  onLink: (l: Link) => void;
  /** The applications that can be connected one at a time. */
  links: { id: string; label: string }[];
  /** Opens Side by side, when this window can show it. */
  onSplit?: () => void;
  /** In a pane of Side by side: the role is the pane's. */
  pane?: boolean;
  onReset: () => void;
}) {
  // one of the two opens at a time: the prototype controls, or the role menu
  const [shown, setShown] = useState<'proto' | 'role' | null>(null);
  const open = shown === 'proto';
  const setOpen = (v: boolean) => setShown(v ? 'proto' : null);
  const roleNow = ROLES.find((r) => r.key === role)!;
  // a group the reviewer hasn't opened or closed starts open only if it holds the state on screen; "Try" starts open
  const [folds, setFolds] = useState<Record<string, boolean>>({});
  const isOpen = (title: string, byDefault: boolean) => folds[title] ?? byDefault;
  const toggle = (title: string, byDefault: boolean) => setFolds((f) => ({ ...f, [title]: !(f[title] ?? byDefault) }));
  return (
    <div className={`proto ${shown ? 'is-open' : ''}`} onKeyDown={(e) => e.key === 'Escape' && shown && setShown(null)}>
      {open && (
        <div className="proto__panel" role="dialog" aria-label="Prototype controls">
          <div className="proto__head">
            <p className="proto__title">Prototype controls</p>
            <button type="button" className="proto__close" aria-label="Close prototype controls" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <p className="proto__note">Not part of the design. Use these to review every state.</p>

          {groups.map((g) => {
            const byDefault = g.items.some((p) => p.key === current);
            return (
              <Section key={g.title} title={g.title} open={isOpen(g.title, byDefault)} onToggle={() => toggle(g.title, byDefault)}>
                <div className="proto__states">
                  {g.items.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`proto__state ${p.sub ? 'proto__state--sub' : ''} ${current === p.key ? 'is-on' : ''}`}
                      onClick={() => onJump(p.key)}
                    >
                      <span>{p.label}</span>
                      <code>#{p.key}</code>
                    </button>
                  ))}
                </div>
              </Section>
            );
          })}

          <p className="proto__label">Theme</p>
          <div className="proto__seg" role="radiogroup" aria-label="Theme">
            {(['light', 'dark'] as Theme[]).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={theme === t} onClick={() => onTheme(t)}>
                <Icon name={t === 'light' ? 'sun' : 'moon'} size={16} />
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <p className="proto__label">Device</p>
          <div className="proto__seg" role="radiogroup" aria-label="Device">
            {(['desktop', 'phone'] as Device[]).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={device === d} onClick={() => onDevice(d)}>
                <Icon name={d === 'desktop' ? 'monitor' : 'mobile'} size={16} />
                {d === 'desktop' ? 'Desktop' : 'Phone 390'}
              </button>
            ))}
          </div>

          <Section title="Try" open={isOpen('Try', true)} onToggle={() => toggle('Try', true)}>
            <ul className="proto__tips">
              <li>Sign in with <code>nesil@upgard.com</code> and <code>upGrad1234</code>. Any other password is wrong; 5 in a row pause sign-in.</li>
              <li>The test agency’s team signs in with the same password: <code>anita.desai@gsptestagency.in</code>, <code>karthik.nair@gsptestagency.in</code>, <code>divya.shetty@gsptestagency.in</code>.</li>
              <li>The email code is <code>000000</code>, when becoming a partner and in password reset. Any other code is wrong.</li>
              <li>Becoming a partner: a short form with a password, then the code. The account opens the portal with only Home open; Home asks for the business details and documents, and sending them opens Find courses and Profile.</li>
              <li>A password you set with “Forgot password” works until you reload the page.</li>
              <li>Documents: any PDF, JPG or PNG up to 20 MB uploads; other formats or bigger files show what to do. Drag a file onto a slot, or choose one.</li>
              <li>Find courses: try <code>MBA in UK under 25 lakhs</code>, <code>mba uk under 22k jan</code>, a typo like <code>abertey</code>, or the old name <code>University of Adelaide</code>. State Punjab with Australia hides some courses, and says which.</li>
              <li>Add an application, Documents: GSP Assist checks each marksheet by its file name. <code>blurry_12th.jpg</code> isn’t clear, <code>10th_marks.pdf</code> uploaded for the 12th is the wrong document, and a file with another person’s first name (<code>rohit_12th.pdf</code> for Priya) is a name mismatch: each asks to re-upload. Anything else is uploaded.</li>
              <li>Applications: GSP Assist reads each upload by its file name. For a marksheet or transcript, a file named <code>ielts_result.pdf</code> is caught as the wrong document and <code>blurry_photo.jpg</code> as unreadable; anything else reads as right. The chat is with your GSP contact, who answers there; documents go in Documents, not the chat.</li>
              <li>Students: name a passport file after a person (<code>meera_iyer_passport.jpg</code>) and autofill uses that name. Passport <code>V8810342</code> is already on one of the agency's students (Priya Raman). In a record, drop several files at once on “Upload … documents”: the file name says what each is (<code>passport</code>, <code>btech</code> or <code>transcript</code>, <code>12th</code>, <code>ielts</code>, <code>cv</code>, <code>sop</code>…), and anything else goes to Additional documents. Passports, marksheets and score reports are read in with sample values.</li>
              <li>Portal: “Registered: Onboarding” and “Onboarding: Documents” show registering on Home. “Verified: All Access” plays GSP verifying the agency, and “Onboarding: Verification Failed” plays GSP returning 1 or 2 documents with a note each. After registering, they act on yours.</li>
              <li>Becoming a partner: the sample is Meera Krishnan of Kaveri Study Abroad, a new agency. An email already on an RP’s team (like <code>chloe@visafastmigration.com</code>) is already registered.</li>
              <li>Your contact comes from the staff list: the Recruitment person whose area covers your city or state (try Hyderabad, Jalandhar, Kochi or Hanoi), else the one for your country.</li>
            </ul>
          </Section>

          <button type="button" className="proto__reset" onClick={onReset}>
            <Icon name="refresh" size={16} />
            Reset everything
          </button>
        </div>
      )}
      <div className="proto__fabs">
        {/* in a pane of Side by side the role is the pane's */}
        {!pane && (
        <div className="proto__rolewrap">
          {shown === 'role' && (
            <div className="proto__panel proto__roles" role="dialog" aria-label="Role">
              <p className="proto__title">View as</p>
              <p className="proto__note">For testing: the portal each role sees.</p>
              <div className="proto__states" role="radiogroup" aria-label="Role">
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    role="radio"
                    aria-checked={role === r.key}
                    className={`proto__role ${role === r.key ? 'is-on' : ''}`}
                    onClick={() => {
                      onRole(r.key);
                      setShown(null);
                    }}
                  >
                    <span className="proto__role-t">
                      <span className="proto__role-name">{r.label}</span>
                      <span className="proto__role-note">{r.note}</span>
                    </span>
                    {role === r.key && <Icon name="check" size={16} strokeWidth={2.4} />}
                  </button>
                ))}
              </div>
              <div className="proto__link">
                <p className="proto__label" id="proto-link">
                  Connect RP Admin and every GSP role
                </p>
                <p className="proto__note">A connected application is the same in every role: the RP sends a message or a document and the officer gets a “Needs you” in My work; GSP changes the status and the RP sees it.</p>
                <div className="proto__seg" role="radiogroup" aria-labelledby="proto-link">
                  {(
                    [
                      ['off', 'Off'],
                      ['one', 'One'],
                      ['all', 'All'],
                    ] as const
                  ).map(([m, label]) => (
                    <button key={m} type="button" role="radio" aria-checked={link.mode === m} onClick={() => onLink({ mode: m, app: link.app || links[0]?.id || '' })}>
                      {label}
                    </button>
                  ))}
                </div>
                {link.mode === 'one' && (
                  <SelectMenu
                    className="proto__pick"
                    host="body"
                    label="Application to connect"
                    ariaLabel="Application to connect"
                    value={link.app || links[0]?.id || ''}
                    options={links.map((l) => ({ value: l.id, label: l.label }))}
                    onChange={(v) => onLink({ mode: 'one', app: v })}
                  />
                )}
                {onSplit && (
                  <button
                    type="button"
                    className="proto__split"
                    onClick={() => {
                      setShown(null);
                      onSplit();
                    }}
                  >
                    <Icon name="monitor" size={16} />
                    See both side by side
                  </button>
                )}
              </div>
            </div>
          )}
          <button type="button" className="proto__rolebtn" aria-haspopup="dialog" aria-expanded={shown === 'role'} onClick={() => setShown((s) => (s === 'role' ? null : 'role'))}>
            <Icon name="people" size={18} />
            <span className="proto__fab-k">Role</span>
            {roleNow.label}
            {link.mode !== 'off' && (
              <span className="proto__linked" title={link.mode === 'all' ? 'All applications connected' : `${link.app} connected`}>
                <span className="vh">, </span>connected
              </span>
            )}
            <Icon name="chevronDown" size={16} className="proto__fab-chev" />
          </button>
        </div>
        )}
        <button type="button" className="proto__fab" aria-expanded={open} onClick={() => setShown((s) => (s === 'proto' ? null : 'proto'))}>
          <Icon name="sliders" size={18} />
          Prototype
        </button>
      </div>
    </div>
  );
}
