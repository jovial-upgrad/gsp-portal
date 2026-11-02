import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { staffByEmail } from '../../data/staff';
import { courseOf, isOpen, ownerOf, statusText, type Application } from '../../data/applications';
import { fullName, type Student } from '../../data/students';
import { useStore, slaOf, kindById } from '../../work/store';
import { Pill, Section, Tiles } from '../../institution/records/parts';
import { OWNER_WORD } from '../applications/owners';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
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

/** A GSP person's Profile: slice 1's (PRD, Profile), in admin/profile/Profile.tsx. */
export { StaffProfile } from '../../admin/profile/Profile';
