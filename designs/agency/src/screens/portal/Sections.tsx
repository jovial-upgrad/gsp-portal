import { useEffect, useMemo, useState, type ComponentProps, type KeyboardEvent } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Switch } from '../../components/forms';
import { PreviewSheet, downloadDoc, type DocRef } from '../../components/DocView';
import { Thumb, previews } from '../signup/Documents';
import { fmtSize } from '../signup/docs';
import { Status, extOf } from './DocumentsSheet';
import type { Account } from '../signin/model';
import type { SignupState } from '../signup/model';
import { returnedDocs } from '../signup/docs';
import { AGREEMENT, LOCKED_COPY, NAV, agreementOf, expectedBy, phaseOf, sampleVerified, sentDocs, whenLabel, type Access, type Section } from './model';
import { dayText } from './Agreement';
import { TeamSection } from './Team';

const labelOf = (k: Section) => NAV.find((n) => n.key === k)?.label ?? '';

/** A locked section keeps its place: its name, what it's for, why it's closed and when it opens. */
export function LockedSection({ section, join, onDocs, go }: { section: Section; join: SignupState; onDocs: () => void; go: (k: Section) => void }) {
  const copy = LOCKED_COPY[section];
  const back = phaseOf(join) === 'sent-back' ? returnedDocs(sentDocs(join).map((d) => d.need), join.docs).length : 0;
  // still registering: everything waits for the business details and documents
  if (phaseOf(join) === 'setup') {
    const early = section === 'courses' || section === 'profile';
    return (
      <div className="page page--locked">
        <h1 className="page__title">{labelOf(section)}</h1>
        <section className="card locked" aria-labelledby="locked-title">
          <span className="locked__icon" aria-hidden="true">
            <Icon name="lock" size={22} />
          </span>
          <h2 id="locked-title" className="locked__title">
            Opens once you’ve finished registering
          </h2>
          <p className="locked__text">
            {copy?.text} {early ? 'It opens as soon as' : 'It opens once GSP has verified them, after'} you send {join.form.biz}’s business details and documents
            to GSP, on Home.
          </p>
          <div className="locked__actions">
            <Button onClick={() => go('home')} iconRight={<Icon name="arrowRight" size={18} />}>
              Finish registering
            </Button>
          </div>
        </section>
      </div>
    );
  }
  // 4 Nov: verified, but Earnings waits for GSP to accept the signed agreement
  if (join.stage === 'verified') {
    const ag = agreementOf(join);
    return (
      <div className="page page--locked">
        <h1 className="page__title">{labelOf(section)}</h1>
        <section className="card locked" aria-labelledby="locked-title">
          <span className="locked__icon" aria-hidden="true">
            <Icon name="lock" size={22} />
          </span>
          <h2 id="locked-title" className="locked__title">
            Opens once GSP accepts your agreement
          </h2>
          <p className="locked__text">
            {copy?.text}{' '}
            {ag === 'with-gsp'
              ? `GSP is checking your signed agreement, usually within 1 working day. Expect it by ${expectedBy(join.agreement?.sentAt)}.`
              : ag === 'sent-back'
                ? 'GSP couldn’t accept your signed agreement. Sign it again where GSP says and upload it, on Home.'
                : 'Sign your partner agreement and upload the signed copy, on Home.'}
          </p>
          <div className="locked__actions">
            <Button onClick={() => go('home')} iconRight={<Icon name="arrowRight" size={18} />}>
              {ag === 'with-gsp' ? 'See it on Home' : 'Go to the agreement'}
            </Button>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="page page--locked">
      <h1 className="page__title">{labelOf(section)}</h1>
      <section className="card locked" aria-labelledby="locked-title">
        <span className="locked__icon" aria-hidden="true">
          <Icon name="lock" size={22} />
        </span>
        <h2 id="locked-title" className="locked__title">
          Opens after verification
        </h2>
        {back > 0 ? (
          <p className="locked__text">
            {copy?.text} GSP needs a new copy of {back === 1 ? 'one document' : `${back} documents`} before it can verify {join.form.biz}.
          </p>
        ) : (
          <p className="locked__text">
            {copy?.text} GSP is verifying {join.form.biz}, usually within 1 working day. Expect it by{' '}
            <span className="num">{expectedBy(join.sentAt)}</span>.
          </p>
        )}
        <div className="locked__actions">
          <Button onClick={onDocs}>{back === 0 ? 'View documents' : back === 1 ? 'Replace document' : 'Replace documents'}</Button>
          <Button variant="secondary" onClick={() => go('courses')}>
            Search courses
          </Button>
        </div>
      </section>
    </div>
  );
}

/** Sections the prototype doesn't cover yet say so plainly, inside the real frame. */
export function LaterSection({ section }: { section: Section }) {
  return (
    <div className="page">
      <h1 className="page__title">{labelOf(section)}</h1>
      <p className="later">
        <Icon name="info" size={16} />
        <span>
          {labelOf(section)} is designed next. This prototype covers sign-in, registration, business documents, Home, Find courses, Students and Applications.
        </span>
      </p>
    </div>
  );
}

type ProfileTab = 'business' | 'documents' | 'team' | 'email';

/** The emails GSP sends an RP, each of which can be turned off (Nesil, 3 Nov, from the reference). */
const EMAILS = ['Welcome', 'Documents received', 'Document sent back', 'Agreement to sign', 'Signed agreement sent back', 'Agreement accepted', 'Account status', 'Linked to a Master Partner', 'Onboarding reminder', 'Agreement reminder', 'Announcement', 'Request', 'Sent back', 'Reminder', 'Daily update'] as const;
/** Sent whatever the preferences, for the account's security. */
const ALWAYS = ['Set up your account', 'Your code', 'Password changed'];
const PREFS_KEY = 'gsp-rp-email-prefs';
/** The emails turned off, kept in this browser for the prototype. */
function readOff(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * RP Admin's Profile (Nesil, 3 Nov): four tabs in one row. **Business details**: the business and the person signed
 * in (You); **Documents**: the business documents sent at registration and where each one is, each with Preview and
 * Download (3 Nov, 2nd round); **Branches and team**
 * (RP Admin's own portal); **Email preferences**: each email GSP sends, on or off.
 */
export function ProfileSection({
  acc,
  join,
  access,
  onDocs,
  onSignOut,
  team,
  start,
}: {
  acc: Account;
  join: SignupState | null;
  access: Access;
  onDocs: () => void;
  onSignOut: () => void;
  /** Open on a tab (4 Nov: Home's "View documents" opens Documents). */
  start?: { tab: ProfileTab; key: number };
  /** Branches and team, to add to and change (RP Admin's own portal). */
  team?: ComponentProps<typeof TeamSection>;
}) {
  const f = join?.form;
  // a partner who signed in without registering here is a verified agency: its documents are the sample's
  const sample = useMemo(() => (join ? null : sampleVerified()), [join]);
  const dj = join ?? sample!;
  const rows = sentDocs(dj);
  const sent = rows.filter((d) => d.slot.file);
  const back = phaseOf(dj) === 'sent-back' ? returnedDocs(rows.map((d) => d.need), dj.docs).length : 0;
  const [tab, setTab] = useState<ProfileTab>(start?.tab ?? 'business');
  useEffect(() => {
    if (start) setTab(start.tab);
  }, [start?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const agr = dj.agreement;
  const [off, setOff] = useState<string[]>(readOff);
  // the document being previewed; it stays set while the pop-up closes, so it closes gently
  const [viewing, setViewing] = useState<DocRef | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const tabs: [ProfileTab, string][] = [
    ['business', 'Business details'],
    ['documents', 'Documents'],
    ...(team ? ([['team', 'Branches and team']] as [ProfileTab, string][]) : []),
    ['email', 'Email preferences'],
  ];
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex(([k]) => k === tab);
    const n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    setTab(tabs[n][0]);
    document.getElementById(`ptab-${tabs[n][0]}`)?.focus();
  };
  const toggleEmail = (k: string, on: boolean) => {
    const next = on ? off.filter((x) => x !== k) : [...off, k];
    setOff(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the choice holds while the page is open */
    }
  };

  return (
    <div className="page page--full">
      <h1 className="page__title">Profile</h1>
      <div className="rtabs ptabs" role="tablist" aria-label="Profile" onKeyDown={onKey}>
        {tabs.map(([k, label]) => (
          <button key={k} id={`ptab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="ppanel" tabIndex={tab === k ? 0 : -1} className={`rtab ${tab === k ? 'is-on' : ''}`} onClick={() => setTab(k)}>
            {label}
            {k === 'documents' && back > 0 && (
              <span className="rtab__st is-todo" title={`${back} to replace`}>
                <span className="vh">: {back} to replace</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <div id="ppanel" role="tabpanel" aria-labelledby={`ptab-${tab}`} className="page__stack ppanel">
        {tab === 'business' && (
          <>
            <section className="card pcard" aria-labelledby="biz-title">
              <h2 id="biz-title" className="pcard__title">
                Business
              </h2>
              <dl className="facts">
                <div>
                  <dt>Registered name</dt>
                  <dd>{acc.agency}</dd>
                </div>
                {f && (
                  <>
                    <div>
                      <dt>Office</dt>
                      <dd>{[f.city, f.state, f.country].filter(Boolean).join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Owner</dt>
                      <dd>{f.ownerSame ? `${f.first} ${f.last}` : f.ownerName}</dd>
                    </div>
                    <div>
                      <dt>Commission statements</dt>
                      <dd>{f.cemail}</dd>
                    </div>
                  </>
                )}
              </dl>
            </section>
            <section className="card pcard" aria-labelledby="me-title">
              <h2 id="me-title" className="pcard__title">
                You
              </h2>
              <dl className="facts">
                <div>
                  <dt>Name</dt>
                  <dd>{acc.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{acc.email}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{team?.team.find((m) => m.id === 'me')?.role ?? acc.role}</dd>
                </div>
              </dl>
              <Button variant="secondary" size="sm" iconLeft={<Icon name="logout" size={16} />} onClick={onSignOut}>
                Sign out
              </Button>
            </section>
          </>
        )}

        {tab === 'documents' && (
          <section className="card pcard" aria-labelledby="pdocs-title">
            <div className="pcard__row">
              <div className="pcard__lead">
                <h2 id="pdocs-title" className="pcard__title">
                  Business documents
                </h2>
                <p className="pcard__text">
                  The documents you sent when you registered. {sent.length} sent {whenLabel(dj.sentAt)}
                  {access === 'all' && dj.verifiedAt ? ` · verified ${whenLabel(dj.verifiedAt)}` : ''}
                </p>
              </div>
              {access === 'all' ? (
                <span className="pill pill--ok">Verified</span>
              ) : back > 0 ? (
                <span className="pill pill--bad">{back} not verified</span>
              ) : (
                <span className="pill pill--gsp">Verifying</span>
              )}
            </div>
            {rows.length > 0 && (
              <ul className="sdocs pdocs" aria-label="Business documents">
                {rows.map(({ need, slot }) => {
                  const file = slot.file;
                  const preview = previews.get(need.name);
                  return (
                    <li key={need.name} className={`sdoc ${file ? '' : 'is-empty'}`}>
                      <Thumb key={preview ?? 'none'} src={preview} />
                      <div className="sdoc__text">
                        <p className="sdoc__name">{need.name}</p>
                        {file ? (
                          <>
                            <p className="sdoc__file">{file.name}</p>
                            <p className="sdoc__meta">
                              {extOf(file.name)} · {fmtSize(file.size)}
                            </p>
                          </>
                        ) : (
                          <p className="sdoc__meta">{need.optional ? `Optional. ${need.hint}.` : need.hint}</p>
                        )}
                        {slot.reason && <p className="sdoc__meta pdocs__why">GSP: {slot.reason}</p>}
                        {file && (
                          <p className="pdocs__acts">
                            <button type="button" className="btn btn--link" onClick={() => (setViewing({ name: need.name, file: file.name }), setPreviewing(true))}>
                              <Icon name="eye" size={16} /> Preview<span className="vh"> {need.name}</span>
                            </button>
                            <button type="button" className="btn btn--link" onClick={() => downloadDoc({ name: need.name, file: file.name })}>
                              <Icon name="download" size={16} /> Download<span className="vh"> {need.name}</span>
                            </button>
                          </p>
                        )}
                      </div>
                      <Status slot={slot} optional={need.optional} />
                    </li>
                  );
                })}
              </ul>
            )}
            {back > 0 && join && (
              <Button size="sm" onClick={onDocs}>
                {back === 1 ? 'Replace document' : 'Replace documents'}
              </Button>
            )}
          </section>
        )}
        {tab === 'documents' && agr?.file && (
          // 4 Nov: the signed partner agreement sits with the business documents
          <section className="card pcard" aria-labelledby="pagr-title">
            <div className="pcard__row">
              <div className="pcard__lead">
                <h2 id="pagr-title" className="pcard__title">
                  Partner agreement
                </h2>
                <p className="pcard__text">
                  {AGREEMENT.title} · {AGREEMENT.version}. Signed on {dayText(agr.signedOn)}, sent {whenLabel(agr.sentAt)}
                  {agr.status === 'accepted' && agr.acceptedAt ? ` · accepted ${whenLabel(agr.acceptedAt)}` : ''}
                </p>
              </div>
              {agr.status === 'accepted' ? (
                <span className="pill pill--ok">Accepted</span>
              ) : agr.status === 'sent-back' ? (
                <span className="pill pill--bad">Not accepted</span>
              ) : (
                <span className="pill pill--gsp">Checking</span>
              )}
            </div>
            <ul className="sdocs pdocs" aria-label="Partner agreement">
              <li className="sdoc">
                <Thumb />
                <div className="sdoc__text">
                  <p className="sdoc__name">Signed agreement</p>
                  <p className="sdoc__file">{agr.file.name}</p>
                  <p className="sdoc__meta">
                    {extOf(agr.file.name)} · {fmtSize(agr.file.size)}
                  </p>
                  {agr.status === 'sent-back' && agr.reason && <p className="sdoc__meta pdocs__why">GSP: {agr.reason}</p>}
                  <p className="pdocs__acts">
                    <button type="button" className="btn btn--link" onClick={() => (setViewing({ name: 'Signed partner agreement', file: agr.file!.name }), setPreviewing(true))}>
                      <Icon name="eye" size={16} /> Preview<span className="vh"> the signed agreement</span>
                    </button>
                    <button type="button" className="btn btn--link" onClick={() => downloadDoc({ name: 'Signed partner agreement', file: agr.file!.name })}>
                      <Icon name="download" size={16} /> Download<span className="vh"> the signed agreement</span>
                    </button>
                  </p>
                </div>
              </li>
            </ul>
          </section>
        )}

        {tab === 'team' && team && <TeamSection {...team} />}
        {viewing && <PreviewSheet d={viewing} open={previewing} onClose={() => setPreviewing(false)} />}

        {tab === 'email' && (
          <section className="card pcard" aria-labelledby="pemail-title">
            <h2 id="pemail-title" className="pcard__title">
              Email preferences
            </h2>
            <p className="pcard__text">Emails come from no-reply@gsp.upgrad.com. Turning one off doesn’t turn off the bell: you still see it in Notifications.</p>
            <div className="eprefs" role="group" aria-label="Emails GSP sends">
              {EMAILS.map((k) => (
                <Switch key={k} id={`eprefs-${k.toLowerCase().replace(/[^a-z]+/g, '-')}`} checked={!off.includes(k)} onChange={(v) => toggleEmail(k, v)}>
                  {k}
                </Switch>
              ))}
            </div>
            <p className="pcard__text">Always on, for your account’s security: {ALWAYS.join(', ')}.</p>
          </section>
        )}
      </div>
    </div>
  );
}
