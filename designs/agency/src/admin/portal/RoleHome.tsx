import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useAdmin } from '../data/store';
import { useStore } from '../../work/store';
import { isOpen, type Application } from '../../data/applications';
import { Pill, Section, Tiles, type Tone } from '../../institution/records/parts';
import { canApprove } from '../../institution/data/rpverify';
import type { RecruitmentPartner } from '../../institution/data/records';
import type { Db } from '../../institution/data/store';
import type { Section as PortalSection, Target, Variant } from './model';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

type Props = { variant: Exclude<Variant, 'finance'>; first: string; me: string; db: Db; apps: Application[]; open: (t: Target) => void; go: (k: PortalSection) => void };

/**
 * Each GSP role's own Home (W7, 1 Nov), in place of the Institution Team's queue: Recruitment sees its RPs (new ones
 * assigned, inactive ones), BAP the RPs to verify and the documents sent back, Admin the settings that need a look.
 */
export function RoleHome(p: Props) {
  return p.variant === 'recruitment' ? <RecruitmentHome {...p} /> : p.variant === 'bap' ? <BapHome {...p} /> : <AdminHome {...p} />;
}

function Head({ first, lead, children }: { first: string; lead: string; children?: ReactNode }) {
  return (
    <header className="stu__head">
      <div className="stu__titles">
        <h1 className="page__title">
          {greeting()}, {first}
        </h1>
        <p className="stu__lead">{lead}</p>
      </div>
      {children && <div className="apps__acts">{children}</div>}
    </header>
  );
}

/** A short list of recruitment partners, each opening its record. */
function RpList({ rps, open, empty, sub }: { rps: RecruitmentPartner[]; open: Props['open']; empty: string; sub: (r: RecruitmentPartner) => ReactNode }) {
  if (!rps.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="ilist">
      {rps.slice(0, 8).map((r) => (
        <li key={r.id} className="ilist__item">
          <Icon name="partner" size={18} />
          <span className="ilist__t">
            <button type="button" className="btn btn--link" onClick={() => open({ section: 'rps', id: r.id })}>
              {r.name}
            </button>
            <span className="irow__sub">{sub(r)}</span>
          </span>
          <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status}</Pill>
        </li>
      ))}
      {rps.length > 8 && <li className="ilist__item muted">and {rps.length - 8} more in Recruitment partners</li>}
    </ul>
  );
}
const STATUS_TONE: Record<string, Tone> = { 'Not activated': 'you', Verifying: 'gsp', 'Documents sent back': 'you', Activated: 'uni', 'Agreement signed': 'ok', Rejected: 'bad', Suspended: 'bad', Dormant: 'grey' };
const where = (r: RecruitmentPartner) => [r.city, r.country].filter(Boolean).join(', ');

/** Recruitment (a BDM): the RPs they look after, the new ones assigned to them, and the ones gone quiet. */
function RecruitmentHome({ first, me, db, apps, open, go }: Props) {
  const mine = db.rps.filter((r) => r.bdm === me);
  const fresh = mine.filter((r) => ['Not activated', 'Verifying', 'Documents sent back', 'Activated'].includes(r.status));
  const openBy = new Map<string, number>();
  apps.filter(isOpen).forEach((a) => openBy.set(a.rp ?? 'GSP test agency', (openBy.get(a.rp ?? 'GSP test agency') ?? 0) + 1));
  const signed = mine.filter((r) => r.status === 'Agreement signed');
  const quiet = mine.filter((r) => r.status === 'Dormant' || r.status === 'Suspended' || (r.status === 'Agreement signed' && !openBy.get(r.name)));
  return (
    <div className="ipage ihome">
      <Head first={first} lead="The recruitment partners you look after: new ones to bring on, and ones gone quiet.">
        <Button variant="secondary" onClick={() => go('rps')} iconRight={<Icon name="arrowRight" size={18} />}>
          All recruitment partners
        </Button>
      </Head>
      <Tiles
        label="Your recruitment partners"
        value=""
        onPick={() => go('rps')}
        items={[
          { key: 'mine', label: 'Your RPs', sub: 'You’re their BDM', tone: 'gsp', n: mine.length },
          { key: 'new', label: 'New, assigned to you', sub: 'Still onboarding', tone: 'you', n: fresh.length },
          { key: 'active', label: 'Signed and applying', sub: 'Open applications', tone: 'ok', n: signed.length - quiet.filter((r) => r.status === 'Agreement signed').length },
          { key: 'quiet', label: 'Inactive', sub: 'Dormant, suspended or no open applications', tone: 'bad', n: quiet.length },
        ]}
      />
      <div className="shome__grid">
        <Section title="New RPs assigned to you" note="Signed up, with BAP, or activated and waiting to sign the agreement." id="rh-new">
          <RpList rps={fresh} open={open} empty="No new partners assigned to you." sub={(r) => `${where(r)} · since ${r.since}`} />
        </Section>
        <Section title="Inactive RPs" note="Dormant or suspended, or signed with no open application: worth a call." id="rh-quiet">
          <RpList rps={quiet} open={open} empty="Every partner you look after has open applications." sub={(r) => `${where(r)} · ${openBy.get(r.name) ?? 0} open applications`} />
        </Section>
        <Section title="Your RPs with the most open applications" id="rh-top">
          <RpList rps={signed.filter((r) => openBy.get(r.name)).sort((a, b) => (openBy.get(b.name) ?? 0) - (openBy.get(a.name) ?? 0))} open={open} empty="None of your partners has an open application yet." sub={(r) => `${openBy.get(r.name)} open applications`} />
        </Section>
      </div>
    </div>
  );
}

/** BAP (Recruitment Ops): the new RPs to verify, and the ones whose documents went back to them. */
function BapHome({ first, db, open, go }: Props) {
  const toCheck = db.rps.filter((r) => r.docs.some((d) => d.state === 'With BAP'));
  const toApprove = db.rps.filter(canApprove);
  const back = db.rps.filter((r) => r.status === 'Documents sent back' || r.docs.some((d) => d.state === 'Sent back' && r.status !== 'Rejected'));
  const notYet = db.rps.filter((r) => r.status === 'Not activated');
  return (
    <div className="ipage ihome">
      <Head first={first} lead="New recruitment partners to verify: check each document, send back what isn’t right, and approve them.">
        <Button variant="secondary" onClick={() => go('rps')} iconRight={<Icon name="arrowRight" size={18} />}>
          Recruitment partners
        </Button>
      </Head>
      <Tiles
        label="Verification"
        value=""
        onPick={() => go('rps')}
        items={[
          { key: 'check', label: 'To verify', sub: 'Documents waiting for BAP', tone: 'gsp', n: toCheck.length },
          { key: 'approve', label: 'Ready to approve', sub: 'Every document verified', tone: 'ok', n: toApprove.length },
          { key: 'back', label: 'Sent back', sub: 'Waiting for the RP', tone: 'you', n: back.length },
          { key: 'new', label: 'Not activated', sub: 'Signed up, documents not sent', tone: 'grey', n: notYet.length },
        ]}
      />
      <div className="shome__grid">
        <Section title="RPs to verify" note="Oldest first." id="bh-check">
          <RpList rps={[...toApprove, ...toCheck.filter((r) => !toApprove.includes(r))].sort((a, b) => (a.since < b.since ? -1 : 1))} open={open} empty="Nothing to verify." sub={(r) => (canApprove(r) ? 'Every document verified: approve it' : `${((n) => (n === 1 ? '1 document' : `${n} documents`))(r.docs.filter((d) => d.state === 'With BAP').length)} to check · ${where(r)}`)} />
        </Section>
        <Section title="Documents sent back" note="The RP uploads a new file; it comes back here to check." id="bh-back">
          <RpList rps={back} open={open} empty="No documents with RPs." sub={(r) => r.docs.filter((d) => d.state === 'Sent back').map((d) => d.name).join(', ') || where(r)} />
        </Section>
      </div>
    </div>
  );
}

type Warn = { id: string; tone: Tone; title: string; text: string; go: PortalSection; action: string };

/** Admin: the settings that need a look, with a way to each. */
function AdminHome({ first, db, go }: Props) {
  const cfg = useAdmin();
  const work = useStore() as { tasks: { queue: string; status: string }[] };
  const now = Date.now();
  const today = iso(now);
  const warns: Warn[] = [];
  const empty = cfg.queues.filter((q) => !q.members.length && !q.lead);
  const noLead = cfg.queues.filter((q) => !q.lead);
  const noMembers = cfg.queues.filter((q) => !q.members.length && q.lead);
  if (empty.length) warns.push({ id: 'q-empty', tone: 'bad', title: `${empty.length === 1 ? '1 queue has' : `${empty.length} queues have`} no one in it`, text: empty.map((q) => q.name).join(', '), go: 'queues', action: 'Queues' });
  if (noMembers.length) warns.push({ id: 'q-members', tone: 'you', title: `${noMembers.length === 1 ? '1 queue has' : `${noMembers.length} queues have`} only a leader`, text: `${noMembers.map((q) => q.name).join(', ')}: every task goes to the leader.`, go: 'queues', action: 'Queues' });
  if (noLead.length && !empty.length) warns.push({ id: 'q-lead', tone: 'you', title: `${noLead.length === 1 ? '1 queue has' : `${noLead.length} queues have`} no leader`, text: noLead.map((q) => q.name).join(', '), go: 'queues', action: 'Queues' });
  // this week's exchange rates: Finance prices a line at the rate of the week it's paid
  const week = cfg.fxWeeks.find((w) => w.week <= today && today < iso(Date.parse(w.week + 'T00:00:00Z') + 7 * DAY));
  const codes = cfg.rates.map((r) => r.code).filter((c) => c !== 'AUD');
  const missing = week ? codes.filter((c) => week[c] === undefined || week[c] === '' || Number.isNaN(Number(week[c]))) : codes;
  if (!week) warns.push({ id: 'fx', tone: 'bad', title: 'No exchange rates for this week', text: 'Finance can’t price this week’s lines until the week’s rates are in.', go: 'currency', action: 'Currency exchange' });
  else if (missing.length) warns.push({ id: 'fx', tone: 'you', title: `This week’s rates are missing ${missing.join(', ')}`, text: `Week of ${week.week}.`, go: 'currency', action: 'Currency exchange' });
  const fallback = work.tasks.filter((t) => t.queue === 'q-fallback' && t.status === 'open');
  if (fallback.length) warns.push({ id: 'fb', tone: 'bad', title: `${fallback.length === 1 ? '1 task' : `${fallback.length} tasks`} in Fallback`, text: 'No queue matched them, or their queue was removed. Assign them, or fix the task rule.', go: 'mywork', action: 'My work' });
  const noContact = cfg.regions.filter((r) => !r.contact && r.name !== 'Global');
  if (noContact.length) warns.push({ id: 'reg', tone: 'you', title: `${noContact.length === 1 ? '1 sales region has' : `${noContact.length} sales regions have`} no Admissions contact`, text: noContact.map((r) => r.name).join(', '), go: 'regions', action: 'Sales regions' });
  const noBdm = db.rps.filter((r) => !r.bdm && !['Rejected'].includes(r.status));
  if (noBdm.length) warns.push({ id: 'bdm', tone: 'you', title: `${noBdm.length === 1 ? '1 recruitment partner has' : `${noBdm.length} recruitment partners have`} no BDM`, text: `${noBdm.slice(0, 4).map((r) => r.name).join(', ')}${noBdm.length > 4 ? '…' : ''}: check BDM assignment covers their city.`, go: 'bdm', action: 'BDM assignment' });
  const off = cfg.docRules.filter((r) => !r.on).length;
  return (
    <div className="ipage ihome">
      <Head first={first} lead="GSP’s settings at a glance: what needs a look before it holds anyone up." />
      <Tiles
        label="Settings"
        value=""
        onPick={() => undefined}
        items={[
          { key: 'warn', label: 'Need a look', sub: 'Below', tone: warns.length ? 'bad' : 'ok', n: warns.length },
          { key: 'users', label: 'GSP users', sub: `${cfg.users.filter((u) => u.status !== 'Active').length} not active`, tone: 'gsp', n: cfg.users.length },
          { key: 'queues', label: 'Queues', sub: `${noLead.length} without a leader`, tone: 'uni', n: cfg.queues.length },
          { key: 'docs', label: 'Document rules', sub: `${off} switched off`, tone: 'grey', n: cfg.docRules.length },
        ]}
      />
      <Section title="Needs a look" note={warns.length ? 'Each opens the setting to fix it.' : 'Every setting is in order.'} id="ah-warn">
        {warns.length > 0 && (
          <ul className="ilist">
            {warns.map((w) => (
              <li key={w.id} className="ilist__item">
                <Icon name="alert" size={18} />
                <span className="ilist__t">
                  {w.title}
                  <span className="irow__sub">{w.text}</span>
                </span>
                <Pill tone={w.tone}>{w.tone === 'bad' ? 'Fix now' : 'Check'}</Pill>
                <Button size="sm" variant="secondary" onClick={() => go(w.go)}>
                  {w.action}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
