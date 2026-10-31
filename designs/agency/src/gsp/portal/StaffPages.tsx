import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TextInput } from '../../components/forms';
import { staffByEmail } from '../../data/staff';
import { useAdmin } from '../../admin/data/store';
import { leaveOf, setLeave, useLeave, type Leave } from '../../data/leave';
import { courseOf, isOpen, ownerOf, statusText, type Application } from '../../data/applications';
import { fullName, type Student } from '../../data/students';
import { useStore, slaOf, kindById } from '../../work/store';
import { Facts, Pill, Section, Tiles } from '../../institution/records/parts';
import { OWNER_WORD } from '../applications/owners';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const today = () => new Date().toISOString().slice(0, 10);
const dayText = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
};

type WorkTask = { id: string; record: string; kind: string; assignee: string | null; status: string; note?: string };

/**
 * GSP · Admissions' Home (W6, 1 Nov): the signed-in person's own work, not the RP's portal Home. Their open
 * applications by who has them, the ones waiting on them (oldest first), their tasks due, and a way into My work.
 */
export function AdmissionsHome({ email, apps, students, onOpenApp, onMyWork }: { email: string; apps: Application[]; students: Student[]; onOpenApp: (id: string) => void; onMyWork: () => void }) {
  const me = staffByEmail(email);
  const [tile, setTile] = useState<'gsp' | 'you' | 'uni' | ''>('gsp');
  const mine = apps.filter((a) => isOpen(a) && a.officer === me?.id);
  const by = (o: string) => mine.filter((a) => ownerOf(a) === o);
  const rows = (tile ? by(tile) : mine).slice().sort((x, y) => x.since - y.since);
  const work = useStore() as { tasks: WorkTask[] };
  const s = useStore();
  const tasks = work.tasks.filter((t) => t.status === 'open' && t.assignee === me?.id).map((t) => ({ t, sla: slaOf(s, t) as { due: number; state: string; text: string } })).sort((x, y) => x.sla.due - y.sla.due);
  const late = tasks.filter((x) => x.sla.state === 'breached').length;
  const stu = (a: Application) => students.find((x) => x.id === a.studentId);
  return (
    <div className="ipage ihome">
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">
            {greeting()}, {me?.first ?? 'there'}
          </h1>
          <p className="stu__lead">Your applications and tasks today. Everything waiting on you is in My work.</p>
        </div>
        <div className="apps__acts">
          <Button onClick={onMyWork} iconRight={<Icon name="arrowRight" size={18} />}>
            Open My work
          </Button>
        </div>
      </header>

      <Tiles
        label="Your open applications, by who has them"
        value={tile}
        onPick={setTile}
        items={[
          { key: 'gsp', label: 'Pending on you', sub: 'Yours to move on', tone: 'gsp', n: by('gsp').length },
          { key: 'you', label: 'With RP', sub: 'Waiting on the agency', tone: 'you', n: by('you').length },
          { key: 'uni', label: 'With university', sub: 'Waiting on a decision', tone: 'uni', n: by('uni').length },
        ]}
      />

      <div className="shome__grid">
        <Section title={tile ? `${OWNER_WORD[tile]}: your applications` : 'Your open applications'} note={`${rows.length} of your ${mine.length} open applications, the longest waiting first.`} id="sh-apps">
          {rows.length === 0 ? (
            <p className="muted">Nothing here right now.</p>
          ) : (
            <ul className="ilist">
              {rows.slice(0, 8).map((a) => {
                const st = stu(a);
                return (
                  <li key={a.id} className="ilist__item">
                    <Icon name="doc" size={18} />
                    <span className="ilist__t">
                      <button type="button" className="btn btn--link" onClick={() => onOpenApp(a.id)}>
                        {a.id} · {st ? fullName(st) : a.studentId}
                      </button>
                      <span className="irow__sub">
                        {courseOf(a).uni.name} · {a.rp ?? 'GSP test agency'}
                      </span>
                    </span>
                    <span className="irow__sub">{statusText(a)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <Section title="Your tasks" note={tasks.length ? `${tasks.length} open${late ? `, ${late} late` : ''}, by due date.` : 'Nothing assigned to you.'} id="sh-tasks" action={<Button variant="secondary" size="sm" onClick={onMyWork}>My work</Button>}>
          {tasks.length > 0 && (
            <ul className="ilist">
              {tasks.slice(0, 6).map(({ t, sla }) => (
                <li key={t.id} className="ilist__item">
                  <Icon name="checkCircle" size={18} />
                  <span className="ilist__t">
                    {(kindById(s, t.kind) as { name?: string } | undefined)?.name ?? 'Task'}
                    <span className="irow__sub">{t.record}</span>
                  </span>
                  <Pill tone={sla.state === 'breached' ? 'bad' : sla.state === 'due-soon' ? 'you' : 'ok'}>{sla.text}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

/**
 * A GSP person's Profile (W6, 1 Nov): who they are on the staff list (name, email, phone, title, role, sales
 * regions), the queues they're in (Admin › User roles › Queues), and their leave, which they set themselves. While
 * someone is on leave, new applications skip them (data/leave.ts `onLeave`, for assignment).
 */
export function StaffProfile({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const me = staffByEmail(email);
  const cfg = useAdmin();
  useLeave();
  const id = me?.id ?? email;
  const list = leaveOf(id);
  const queues = useMemo(() => cfg.queues.filter((q) => q.lead === id || q.members.includes(id)), [cfg.queues, id]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const now = today();
  const onNow = list.find((l) => l.from <= now && now <= l.to);
  const add = () => {
    if (!from || !to) return setErr('Choose the first and last day of your leave.');
    if (to < from) return setErr('The last day is before the first.');
    if (to < now) return setErr('That leave is already over.');
    if (list.some((l) => !(to < l.from || from > l.to))) return setErr('That overlaps leave you’ve already added.');
    setLeave(id, [...list, { from, to, note: note.trim() || undefined }].sort((a, b) => (a.from < b.from ? -1 : 1)));
    setFrom('');
    setTo('');
    setNote('');
    setErr('');
  };
  const remove = (l: Leave) => setLeave(id, list.filter((x) => x !== l));
  if (!me)
    return (
      <div className="ipage">
        <p className="muted">{email} isn’t on GSP’s staff list.</p>
      </div>
    );
  const initials = `${me.first[0] ?? ''}${me.last[0] ?? ''}`;
  return (
    <div className="ipage irecord">
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">Profile</h1>
          <p className="stu__lead">Your details on GSP’s staff list. A GSP admin changes your role, regions and queues.</p>
        </div>
      </header>
      <section className="card acard iacct" aria-label="Signed in as">
        <span className="savatar iacct__av" aria-hidden="true">
          {initials}
        </span>
        <div className="iacct__t">
          <p className="iacct__name">
            {me.first} {me.last}
          </p>
          <p className="iacct__org">
            {me.title} · GSP · {me.role}
          </p>
          <p className="iacct__mail">{me.email}</p>
        </div>
        {onNow && <Pill tone="you">On leave until {dayText(onNow.to)}</Pill>}
        <Button variant="secondary" iconLeft={<Icon name="logout" size={18} />} onClick={onSignOut}>
          Sign out
        </Button>
      </section>
      <Section title="Details" id="sp-details">
        <Facts
          items={[
            ['Name', `${me.first} ${me.last}`],
            ['Email', <a key="e" href={`mailto:${me.email}`}>{me.email}</a>],
            ['Phone', me.phone ? <span key="p" className="num">{`${me.dial} ${me.phone}`}</span> : ''],
            ['Title', me.title],
            ['Role', me.role],
            ['Sales regions', me.regions.join(', ')],
            ['Queues', queues.length ? queues.map((q) => `${q.name}${q.lead === id ? ' (leader)' : ''}`).join(', ') : 'None'],
            ...(me.area ? ([['Area', me.area]] as [string, string][]) : []),
          ]}
        />
      </Section>
      <Section title="Leave" id="sp-leave" note="While you’re on leave, new applications skip you and your open work is covered by your queue’s leader.">
        {list.length > 0 ? (
          <ul className="ilist">
            {list.map((l) => (
              <li key={`${l.from}-${l.to}`} className="ilist__item">
                <Icon name="calendar" size={18} />
                <span className="ilist__t">
                  {l.from === l.to ? dayText(l.from) : `${dayText(l.from)} to ${dayText(l.to)}`}
                  {l.note && <span className="irow__sub">{l.note}</span>}
                </span>
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
          <label className="sp-leave__f" htmlFor="sp-from">
            <span>First day</span>
            <TextInput id="sp-from" type="date" value={from} min={now} onChange={(e) => (setFrom(e.target.value), setErr(''))} />
          </label>
          <label className="sp-leave__f" htmlFor="sp-to">
            <span>Last day</span>
            <TextInput id="sp-to" type="date" value={to} min={from || now} onChange={(e) => (setTo(e.target.value), setErr(''))} />
          </label>
          <label className="sp-leave__f sp-leave__note" htmlFor="sp-note">
            <span>Note (optional)</span>
            <TextInput id="sp-note" value={note} placeholder="Annual leave" onChange={(e) => setNote(e.target.value)} />
          </label>
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
    </div>
  );
}
