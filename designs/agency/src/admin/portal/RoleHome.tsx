import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { setAdminCfg, useAdmin } from '../data/store';
import { LINK_DAYS } from '../data/config';
import { ago, istDay, istHour } from '../config/states';
import { GSP_USER } from '../user';
import { useStore } from '../../work/store';
import { isOpen, type Application } from '../../data/applications';
import { Pill, Section, Tiles, type Tone } from '../../institution/records/parts';
import { canApprove, docsVerified } from '../../institution/data/rpverify';
import type { RecruitmentPartner } from '../../institution/data/records';
import type { Db } from '../../institution/data/store';
import type { Section as PortalSection, Target, Variant } from './model';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const DAY = 86_400_000;

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

/** BAP (RP Ops): the new RPs to verify, and the ones whose documents went back to them. */
function BapHome({ first, db, open, go }: Props) {
  const toCheck = db.rps.filter((r) => r.docs.some((d) => d.state === 'With BAP'));
  // slice 2 PRD: Ready to approve once every document is verified (BAP then uploads the agreement and approves)
  const toApprove = db.rps.filter(docsVerified);
  const signedCopy = db.rps.filter((r) => r.agreement?.state === 'Signed copy received');
  const back = db.rps.filter((r) => r.status === 'Documents sent back' || r.docs.some((d) => d.state === 'Sent back' && r.status !== 'Rejected'));
  const notYet = db.rps.filter((r) => r.status === 'Not activated');
  const waiting = db.rps.filter((r) => r.status === 'Documents sent back' || r.agreement?.state === 'Sent' || r.agreement?.state === 'Sent back');
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
          { key: 'signed', label: 'Signed copy to check', sub: 'The RP signed its agreement', tone: 'uni', n: signedCopy.length },
          { key: 'back', label: 'Sent back', sub: 'Waiting for the RP', tone: 'you', n: back.length },
          { key: 'new', label: 'Not activated', sub: 'Signed up, documents not sent', tone: 'grey', n: notYet.length },
        ]}
      />
      <div className="shome__grid">
        <Section title="RPs to verify" note="Oldest first." id="bh-check">
          <RpList rps={[...signedCopy, ...toApprove, ...toCheck.filter((r) => !toApprove.includes(r))].filter((r, i, l) => l.indexOf(r) === i).sort((a, b) => (a.since < b.since ? -1 : 1))} open={open} empty="Nothing to verify." sub={(r) => (r.agreement?.state === 'Signed copy received' ? 'Signed copy to check: accept it or send it back' : canApprove(r) ? 'Agreement uploaded: approve the partner' : docsVerified(r) ? 'Every document verified: upload the agreement, then approve' : `${((n) => (n === 1 ? '1 document' : `${n} documents`))(r.docs.filter((d) => d.state === 'With BAP').length)} to check · ${where(r)}`)} />
        </Section>
        <Section title="Waiting on the RP" note="Documents sent back, or the agreement to sign." id="bh-back">
          <RpList rps={waiting} open={open} empty="Nothing with RPs." sub={(r) => (r.agreement?.state === 'Sent' ? 'Agreement sent: waiting for the signed copy' : r.agreement?.state === 'Sent back' ? `Signed copy sent back: ${r.agreement.reason ?? ''}` : r.docs.filter((d) => d.state === 'Sent back').map((d) => d.name).join(', ') || where(r))} />
        </Section>
      </div>
    </div>
  );
}

type Warn = { id: string; title: string; text: string; go: PortalSection; action: string; act?: () => void };

/**
 * Admin home (PRD slice 1): where GSP · Admin lands after sign-in, all worked out from the pages below; nobody
 * types it. Tiles (GSP users, Sales regions, Application documents), Needs a look (one row per item, each with the
 * button that fixes it) and Recent changes (the last 3 Change entries). View Only sees it without the buttons that
 * change something.
 */
function AdminHome({ first, go, variant }: Props) {
  const cfg = useAdmin();
  const work = useStore() as { tasks: { queue: string; status: string }[]; queues: { id: string; name: string; leader: string; members: string[] }[] };
  const canEdit = variant !== 'viewonly';
  const now = Date.now();
  const today = istDay(now);
  const warns: Warn[] = [];
  // a login link that expires within 1 day, or has expired
  for (const u of cfg.users.filter((x) => x.status === 'Link sent' && x.sentAt)) {
    const left = (u.sentAt ?? 0) + LINK_DAYS * DAY - now;
    if (left < DAY)
      warns.push({
        id: `link-${u.id}`,
        title: left <= 0 ? `${u.name}’s login link has expired` : `${u.name}’s login link expires within a day`,
        text: `${u.email} · sent ${ago(u.sentAt, now)}`,
        go: 'users',
        action: 'Resend login email',
        act: () => {
          setAdminCfg((c) => ({ ...c, users: c.users.map((x) => (x.id === u.id ? { ...x, sentAt: Date.now() } : x)), log: [{ id: `l${Date.now()}`, at: Date.now(), who: GSP_USER.name, role: 'Admin', area: 'Create roles', text: `Resent the login email to ${u.name} (${u.email}); the old link stopped working`, kind: 'change' }, ...c.log] }));
        },
      });
  }
  // this week's exchange rates: not saved, or older than 7 days
  const week = cfg.fxWeeks.find((w) => w.week <= today && today < istDay(Date.parse(w.week + 'T00:00:00Z') + 7 * DAY));
  const stale = cfg.rates.filter((r) => r.code !== 'AUD' && now - r.updated > 7 * DAY);
  if (!week) warns.push({ id: 'fx', title: 'This week’s exchange rates aren’t saved', text: 'Last week’s rates apply until you save.', go: 'currency', action: 'Currency exchange' });
  else if (stale.length) warns.push({ id: 'fx', title: `${stale.length === 1 ? '1 exchange rate is' : `${stale.length} exchange rates are`} older than 7 days`, text: stale.map((r) => r.code).join(', '), go: 'currency', action: 'Currency exchange' });
  // a user with no sales region
  for (const u of cfg.users.filter((x) => x.status !== 'Deactivated' && !x.regions.length)) warns.push({ id: `nr-${u.id}`, title: `${u.name} has no sales region`, text: `${u.role}: sees no records until given one.`, go: 'users', action: 'Edit' });
  // slice 4's queue warnings, from Admin › Work's queues
  const qs = work.queues ?? [];
  const noMembers = qs.filter((q) => q.id !== 'q-admin' && !q.leader && !q.members.length);
  const onlyLeader = qs.filter((q) => q.id !== 'q-admin' && q.leader && !q.members.length);
  if (noMembers.length) warns.push({ id: 'q-empty', title: `${noMembers.length === 1 ? '1 queue has' : `${noMembers.length} queues have`} no members`, text: noMembers.map((q) => q.name).join(', '), go: 'work-sla', action: 'Queues' });
  if (onlyLeader.length) warns.push({ id: 'q-lead', title: `${onlyLeader.length === 1 ? '1 queue has' : `${onlyLeader.length} queues have`} only a leader`, text: `${onlyLeader.map((q) => q.name).join(', ')}: every task goes to the leader.`, go: 'work-sla', action: 'Queues' });
  const inAdmin = work.tasks.filter((t) => t.queue === 'q-admin' && t.status === 'open');
  if (inAdmin.length) warns.push({ id: 'q-admin', title: `${inAdmin.length === 1 ? '1 task' : `${inAdmin.length} tasks`} in the Admin queue`, text: 'Work that no queue took, or that escalated to Admin.', go: 'mywork', action: 'My work' });
  // a daily job that failed 3 runs in a row (slice 4's job runs, in Logs)
  const jobs = [...new Set(cfg.log.filter((l) => l.kind === 'job').map((l) => l.text))];
  for (const j of jobs) {
    const runs = cfg.log.filter((l) => l.kind === 'job' && l.text === j).sort((a, b) => b.at - a.at).slice(0, 3);
    if (runs.length === 3 && runs.every((r) => r.error)) warns.push({ id: `job-${j}`, title: `${j} failed 3 runs in a row`, text: runs[0].error ?? '', go: 'logs', action: 'Logs' });
  }
  const notActive = cfg.users.filter((u) => u.status !== 'Active').length;
  const off = cfg.docRules.filter((r) => !r.on).length;
  const recent = cfg.log.filter((l) => l.kind === 'change').sort((a, b) => b.at - a.at).slice(0, 3);
  const h = istHour(now);
  return (
    <div className="ipage ihome">
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">
            {h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, {first}
          </h1>
        </div>
      </header>
      <Tiles
        label="Settings"
        value=""
        onPick={(k) => k && go(k as PortalSection)}
        items={[
          { key: 'users' as const, label: 'GSP users', sub: `${notActive} not active`, tone: 'gsp', n: cfg.users.length },
          { key: 'regions' as const, label: 'Sales regions', sub: '3 of them system regions', tone: 'uni', n: cfg.regions.length },
          { key: 'documents' as const, label: 'Application documents', sub: `${off} switched off`, tone: 'grey', n: cfg.docRules.length },
        ]}
      />
      <div className="shome__grid">
        <Section title="Needs a look" id="ah-warn">
          {warns.length ? (
            <ul className="ilist">
              {warns.map((w) => (
                <li key={w.id} className="ilist__item">
                  <Icon name="alert" size={18} />
                  <span className="ilist__t">
                    {w.title}
                    <span className="irow__sub">{w.text}</span>
                  </span>
                  {(canEdit || !w.act) && (
                    <Button size="sm" variant="secondary" onClick={() => (w.act && canEdit ? w.act() : go(w.go))}>
                      {canEdit ? w.action : 'Open'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing needs a look.</p>
          )}
        </Section>
        <Section title="Recent changes" id="ah-recent" action={<Button size="sm" variant="secondary" onClick={() => go('logs')}>Open logs</Button>}>
          {recent.length ? (
            <ul className="cfg__recent">
              {recent.map((l) => (
                <li key={l.id}>
                  <span>{l.text}</span>
                  <span className="irow__sub">
                    {l.who} · {l.area} · {ago(l.at, now)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No changes yet.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
