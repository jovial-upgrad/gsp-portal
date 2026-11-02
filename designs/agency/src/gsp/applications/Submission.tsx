import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { courseOf, stageOf, statusText, type Application } from '../../data/applications';
import { CopyButton } from '../students/parts';
import { CHANNEL_NAME, type Desk } from './desk';

/** Submitted to the university: past "Ready to submit", or closed after it had a reference. */
export const isSubmitted = (a: Application) => (a.status === 'closed' ? !!a.uniRef : stageOf(a) > 2 || (stageOf(a) === 2 && a.status !== 'ready'));
const REF = /^[A-Za-z0-9][A-Za-z0-9/_-]{2,29}$/;

/**
 * Submission: where the application goes in (by mail, through StudyLink or the university's portal, with the
 * sign-in to copy), and the university's reference for it, added once it's submitted and changed only after
 * a confirmation.
 */
export function SubmissionTab({ a, desk, onRef, say }: { a: Application; desk: Desk; onRef: (ref: string, was?: string) => void; say: (m: string) => void }) {
  const c = courseOf(a);
  const ch = desk.channel;
  const [shown, setShown] = useState(false);
  const submitted = isSubmitted(a);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(a.uniRef ?? '');
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const clean = value.trim().toUpperCase();
  const valid = REF.test(clean);

  const submit = () => {
    setTried(true);
    if (!valid) return;
    if (a.uniRef && a.uniRef !== clean) return setConfirm(true);
    if (!a.uniRef) {
      onRef(clean);
      say(`Reference ${clean} added.`);
    }
    setEditing(false);
    setTried(false);
  };

  return (
    <div className="gsub">
      <section className="card acard" aria-labelledby="gsub-where">
        <div className="gsub__head">
          <h2 id="gsub-where" className="acard__title">
            Where it’s submitted
          </h2>
          <span className={`gsub__via gsub__via--${ch.via}`}>
            {/* a chip, not a link (Jovial, 2 Nov) */}
            <Icon name={ch.via === 'mail' ? 'mail' : 'globe'} size={14} />
            {CHANNEL_NAME[ch.via]}
          </span>
        </div>
        <p className="acard__text">How {c.uni.name} takes applications from GSP.</p>
        <dl className="gsub__creds">
          {ch.via === 'mail' ? (
            <div className="gsub__cred">
              <dt>Email</dt>
              <dd>
                <a className="gsub__val" href={`mailto:${ch.email}`}>
                  {ch.email}
                </a>
                <CopyButton text={ch.email} what="Email" onDone={say} />
              </dd>
            </div>
          ) : (
            <>
              <div className="gsub__cred">
                <dt>{ch.via === 'studylink' ? 'StudyLink' : 'Portal'}</dt>
                <dd>
                  <a className="gsub__val gsub__link" href={ch.url} target="_blank" rel="noopener noreferrer">
                    {ch.url.replace(/^https:\/\//, '')}
                    <Icon name="external" size={14} />
                  </a>
                  <CopyButton text={ch.url} what="Link" onDone={say} />
                </dd>
              </div>
              <div className="gsub__cred">
                <dt>Username</dt>
                <dd>
                  <span className="gsub__val gsub__mono">{ch.username}</span>
                  <CopyButton text={ch.username} what="Username" onDone={say} />
                </dd>
              </div>
              <div className="gsub__cred">
                <dt>Password</dt>
                <dd>
                  <span className="gsub__val gsub__mono">
                    {shown ? (
                      ch.password
                    ) : (
                      <>
                        <span aria-hidden="true">{'•'.repeat(12)}</span>
                        <span className="vh">Hidden</span>
                      </>
                    )}
                  </span>
                  <button type="button" className="scopy" aria-pressed={shown} aria-label={shown ? 'Hide password' : 'Show password'} title={shown ? 'Hide password' : 'Show password'} onClick={() => setShown((x) => !x)}>
                    <Icon name={shown ? 'eyeOff' : 'eye'} size={16} />
                  </button>
                  <CopyButton text={ch.password} what="Password" onDone={say} />
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <section className="card acard" aria-labelledby="gsub-ref">
        <div className="gsub__head">
          <h2 id="gsub-ref" className="acard__title">
            University reference
          </h2>
          {a.uniRef && !editing && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<Icon name="edit" size={16} />}
              onClick={() => {
                setValue(a.uniRef!);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
        </div>
        <p className="acard__text">The reference {c.uni.name} gave the submission. GSP tracks the application with it.</p>
        {a.uniRef && !editing ? (
          <p className="gsub__ref">
            <span className="gsub__mono">{a.uniRef}</span>
            <CopyButton text={a.uniRef} what="Reference" onDone={say} />
          </p>
        ) : (
          <form
            className="gsub__form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="vh" htmlFor="gsub-ref-input">
              University reference
            </label>
            <div className={`control ${tried && !valid ? 'is-invalid' : ''} ${submitted ? '' : 'is-disabled'}`}>
              <input
                id="gsub-ref-input"
                className="control__input gsub__mono"
                value={value}
                placeholder={`Like ${c.uni.id.slice(0, 3).toUpperCase()}-2611407`}
                disabled={!submitted}
                aria-invalid={(tried && !valid) || undefined}
                aria-describedby="gsub-ref-note"
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!submitted}>
              {a.uniRef ? 'Save' : 'Submit'}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setTried(false);
                }}
              >
                Cancel
              </Button>
            )}
          </form>
        )}
        <p id="gsub-ref-note" className={`gsub__note ${tried && !valid ? 'is-bad' : ''}`} role={tried && !valid ? 'alert' : undefined}>
          {!submitted
            ? `You can add it once the application is submitted. It’s at “${statusText(a)}”.`
            : tried && !valid
              ? 'Use 3 to 30 letters, numbers or dashes, as the university wrote it.'
              : a.uniRef && !editing
                ? ''
                : 'As the university wrote it, like the one in their acknowledgement mail.'}
        </p>
      </section>

      <ConfirmDialog
        open={confirm}
        title="Change the university reference?"
        confirm="Change it"
        cancel={`Keep ${a.uniRef}`}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onRef(clean, a.uniRef);
          say(`Reference changed to ${clean}.`);
          setEditing(false);
          setTried(false);
        }}
      >
        <p>
          From <strong className="gsub__mono">{a.uniRef}</strong> to <strong className="gsub__mono">{clean}</strong>. GSP tracks the submission with the new one from now on, and the change shows in Activity.
        </p>
      </ConfirmDialog>
    </div>
  );
}
