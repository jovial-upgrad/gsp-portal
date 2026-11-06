import { useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { RpEarnings } from '../../finance/RpEarnings';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import type { Account } from '../signin/model';
import type { SignupState } from '../signup/model';
import { returnedDocs } from '../signup/docs';
import { LOCKED_COPY, NAV, expectedBy, phaseOf, sentDocs, whenLabel, type Access, type Section } from './model';
import { TeamSection } from './Team';
import { EmailPrefs } from './EmailPrefs';
import { downloadFile } from '../../institution/records/PartnerPage';
import { dateText, type RecruitmentPartner, type RpDoc } from '../../institution/data/records';

/** How the RP reads a document's state on its own record (the GSP side's With BAP is "Verifying" to the RP). */
const RP_DOC_STATE: Record<RpDoc['state'], [string, string]> = { 'With BAP': ['Verifying', 'pill--gsp'], Verified: ['Verified', 'pill--ok'], 'Sent back': ['Not verified', 'pill--bad'], Missing: ['Not uploaded', 'pill--bad'] };

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
            {copy?.text} GSP is verifying {join.form.biz}. Expect it by{' '}
            <span className="num">{expectedBy(join.sentAt, join.form.country)}</span>.
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
  // Earnings (Jovial, 31 Oct): the RP's commission from Finance's engine
  if (section === 'earnings') return <RpEarnings />;
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

/** The RP's Profile (Jovial, 3 Nov): one level of tabs so nothing needs a long scroll. Profile (the agency's details and
 * You), Documents (business documents and the agreement; RP Admin), Branches and team (RP Admin and Branch Manager) and
 * Email preferences. The details are the agency's RP record (what it entered when it registered, as GSP holds it). */
type ProfileTab = 'profile' | 'documents' | 'team' | 'email';
export function ProfileSection({
  acc,
  join,
  access,
  onDocs,
  onSignOut,
  team,
  agreement,
  recordDocs,
  record,
}: {
  /** Profile › Agreement: RP Admin only (Branch Manager and Counsellor don't see it). */
  agreement?: ReactNode;
  /** The agency's business documents on its RP record (GSP · RP Ops sees the same list), for an RP that isn't registering in this session. */
  recordDocs?: RpDoc[];
  /** The agency's RP record: the details it registered with, as GSP holds them. */
  record?: RecruitmentPartner;
  acc: Account;
  join: SignupState | null;
  access: Access;
  onDocs: () => void;
  onSignOut: () => void;
  /** Branches and team, to add to and change (RP Admin's own portal). */
  team?: ComponentProps<typeof TeamSection>;
}) {
  const f = join?.form;
  const sent = join ? sentDocs(join).filter((d) => d.slot.file) : [];
  const back = join && phaseOf(join) === 'sent-back' ? returnedDocs(sentDocs(join).map((d) => d.need), join.docs).length : 0;
  const hasDocs = Boolean(join || recordDocs || agreement);
  const tabs: [ProfileTab, string][] = [['profile', 'Profile'], ...(hasDocs ? [['documents', 'Documents'] as [ProfileTab, string]] : []), ...(team ? [['team', 'Branches and team'] as [ProfileTab, string]] : []), ['email', 'Email preferences']];
  const [tab, setTab] = useState<ProfileTab>('profile');
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex(([k]) => k === tab);
    const n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1;
    if (n < 0) return;
    e.preventDefault();
    setTab(tabs[n][0]);
    document.getElementById(`ptab-${tabs[n][0]}`)?.focus();
  };
  // the agency's details: its RP record, else (registering, before the record exists) what it typed
  const r = record;
  const office = r ? [r.city, r.state, r.country].filter(Boolean).join(', ') : f ? [f.city, f.state, f.country].filter(Boolean).join(', ') : '';
  const owner = r?.owner ?? (f ? (f.ownerSame ? { name: `${f.first} ${f.last}`, email: f.email, phone: f.phone ? `${f.dial} ${f.phone}` : '' } : { name: f.ownerName, email: f.ownerEmail, phone: f.ownerPhone ? `${f.ownerDial} ${f.ownerPhone}` : '' }) : undefined);
  const contact = r?.contact ?? (f ? { name: `${f.first} ${f.last}`, email: f.email, phone: f.phone ? `${f.dial} ${f.phone}` : '' } : undefined);
  const facts: [string, ReactNode][] = [
    ['Registered name', r?.name ?? acc.agency],
    ...(r ? ([['Partner code', <span key="c" className="num">{r.code}</span>]] as [string, ReactNode][]) : []),
    ['Head office', office || '—'],
    ['Contact person', contact ? `${contact.name} · ${contact.email}${contact.phone ? ` · ${contact.phone}` : ''}` : '—'],
    ['Owner', owner ? (contact && owner.name === contact.name ? `${owner.name} (the contact person)` : `${owner.name} · ${owner.email}${owner.phone ? ` · ${owner.phone}` : ''}`) : '—'],
    ['Commission statements', r?.commissionEmail || f?.cemail || '—'],
    ['How you found GSP', r?.foundUs || f?.src || '—'],
    ...(r?.referral ? ([['Referred by', r.referral]] as [string, ReactNode][]) : []),
    ...(r ? ([['Partner since', dateText(r.since)]] as [string, ReactNode][]) : []),
    ...(r?.bdm ? ([['Your Recruitment contact at GSP', r.bdm]] as [string, ReactNode][]) : []),
  ];
  return (
    <div className={`page ${team ? 'page--full' : ''}`}>
      <h1 className="page__title">Profile</h1>
      <div className="rtabs ptabs" role="tablist" aria-label="Profile sections" onKeyDown={onKey}>
        {tabs.map(([k, label]) => (
          <button key={k} id={`ptab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="ptab-panel" tabIndex={tab === k ? 0 : -1} className={`rtab ${tab === k ? 'is-on' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="page__stack" id="ptab-panel" role="tabpanel" aria-labelledby={`ptab-${tab}`}>
        {tab === 'profile' && (
          <>
            <section className="card pcard" aria-labelledby="biz-title">
              <h2 id="biz-title" className="pcard__title">
                Business
              </h2>
              <p className="pcard__text">What you entered when you registered. To change any of it, ask your Recruitment contact at GSP.</p>
              <dl className="facts">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
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
                  <dd>{acc.role ?? team?.team.find((m) => m.id === 'me')?.role ?? 'RP Admin'}</dd>
                </div>
              </dl>
              <Button variant="secondary" size="sm" iconLeft={<Icon name="logout" size={16} />} onClick={onSignOut}>
                Sign out
              </Button>
            </section>
          </>
        )}

        {tab === 'documents' && (
          <>
            {join && (
              <section className="card pcard" aria-labelledby="pdocs-title">
                <div className="pcard__row">
                  <div className="pcard__lead">
                    <h2 id="pdocs-title" className="pcard__title">
                      Business documents
                    </h2>
                    <p className="pcard__text">
                      {sent.length} sent {whenLabel(join.sentAt)}
                      {access === 'all' && join.verifiedAt ? ` · verified ${whenLabel(join.verifiedAt)}` : ''}
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
                <Button variant={back > 0 ? 'primary' : 'secondary'} size="sm" onClick={onDocs}>
                  {back === 0 ? 'View documents' : back === 1 ? 'Replace document' : 'Replace documents'}
                </Button>
              </section>
            )}
            {!join && recordDocs && (
              <section className="card pcard" aria-labelledby="pdocs-title">
                <div className="pcard__row">
                  <div className="pcard__lead">
                    <h2 id="pdocs-title" className="pcard__title">
                      Business documents
                    </h2>
                    <p className="pcard__text">The documents you sent GSP when you registered, as GSP holds them on your record.</p>
                  </div>
                  {recordDocs.every((d) => d.state === 'Verified' || (d.optional && d.state === 'Missing')) ? <span className="pill pill--ok">Verified</span> : <span className="pill pill--gsp">Verifying</span>}
                </div>
                {recordDocs.length ? (
                  <ul className="ilist">
                    {recordDocs.map((d) => {
                      const [label, tone] = RP_DOC_STATE[d.state];
                      return (
                        <li key={d.name} className="ilist__item">
                          <Icon name="file" size={18} />
                          <span className="ilist__t">
                            {d.name}
                            <span className="irow__sub">{d.state === 'Missing' ? (d.optional ? 'Optional' : 'Not uploaded') : d.file}</span>
                          </span>
                          <span className={`pill ${tone}`}>{label}</span>
                          {d.state !== 'Missing' && (
                            <button type="button" className="btn btn--link" onClick={() => downloadFile(d.file)}>
                              Download<span className="vh"> {d.name}</span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="pcard__text">No business documents on your record.</p>
                )}
              </section>
            )}
            {agreement}
          </>
        )}

        {tab === 'team' && team && <TeamSection {...team} />}
        {tab === 'email' && <EmailPrefs />}
      </div>
    </div>
  );
}
