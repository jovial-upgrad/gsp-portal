import type { ComponentProps } from 'react';
import { RpEarnings } from '../../finance/RpEarnings';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import type { Account } from '../signin/model';
import type { SignupState } from '../signup/model';
import { returnedDocs } from '../signup/docs';
import { LOCKED_COPY, NAV, expectedBy, phaseOf, sentDocs, whenLabel, type Access, type Section } from './model';
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

/** The agency and the person signed in, with the business documents and their status, then its branches and team (RP Admin). */
export function ProfileSection({
  acc,
  join,
  access,
  onDocs,
  onSignOut,
  team,
}: {
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
  return (
    <div className={`page ${team ? 'page--full' : ''}`}>
      <h1 className="page__title">Profile</h1>
      <div className="page__stack">
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

        {team && <TeamSection {...team} />}

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
      </div>
    </div>
  );
}
