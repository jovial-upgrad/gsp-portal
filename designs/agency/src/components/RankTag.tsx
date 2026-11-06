import { useState } from 'react';
import { courseOf, primaryOf, rankOf, type Application, type Rank } from '../data/applications';
import type { Student } from '../data/students';
import { EditOnly } from '../proto/viewOnly';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';
import './rank.css';

/**
 * An application's rank for its student (Nesil, 6 Nov): **Primary** (navy soft, with a star) or **Secondary** (grey).
 * Shown in every role's applications list and on the application page; GSP · Admin and GSP · Admissions can mark
 * another application as primary.
 */
export function RankTag({ rank }: { rank: Rank }) {
  return (
    <span className={`arank arank--${rank.toLowerCase()}`} title={rank === 'Primary' ? 'The student’s primary application' : 'One of the student’s other applications'}>
      {rank === 'Primary' && <Icon name="star" size={12} />}
      {rank}
    </span>
  );
}

/**
 * The rank on the application page, under the student's name: the tag, and for GSP · Admin and GSP · Admissions
 * (`canMark`) **Mark as Primary** on a secondary one, asked first. The student keeps the choice (`primaryApp`), so the
 * other application turns secondary, and the recruitment partner sees it; the application's Activity says who did it.
 */
export function AppRank({
  a,
  s,
  apps,
  canMark,
  by,
  update,
  updateStudent,
  say,
}: {
  a: Application;
  s: Student;
  /** The student's applications (at least this one). */
  apps: Application[];
  canMark?: boolean;
  by: string;
  update: (fn: (a: Application) => Application) => void;
  updateStudent: (fn: (s: Student) => Student) => void;
  say: (m: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const rank = rankOf(apps, a, s.primaryApp);
  const now = apps.find((x) => x.id === primaryOf(apps, a.studentId, s.primaryApp));
  const nowCourse = now ? courseOf(now) : undefined;
  return (
    <div className="ahead__rank">
      <RankTag rank={rank} />
      {canMark && rank === 'Secondary' && (
        <EditOnly>
          <button type="button" className="ahead__rankbtn" onClick={() => setAsking(true)}>
            Mark as Primary
          </button>
        </EditOnly>
      )}
      <ConfirmDialog
        open={asking}
        title={`Make this ${s.first}’s primary application?`}
        confirm="Mark as Primary"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          updateStudent((x) => ({ ...x, primaryApp: a.id }));
          update((x) => ({ ...x, history: [...x.history, { at: Date.now(), who: 'gsp', by, text: 'Marked as the student’s primary application' }] }));
          setAsking(false);
          say(`${a.id} is ${s.first}’s primary application now.`);
        }}
      >
        <p>
          {now && nowCourse ? `${now.id} (${nowCourse.uni.name}) becomes secondary. ` : ''}The recruitment partner sees the change on both applications.
        </p>
      </ConfirmDialog>
    </div>
  );
}
