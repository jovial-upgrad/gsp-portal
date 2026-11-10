import { useState } from 'react';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Field } from './forms';

/**
 * Mark as completed (Jovial, 10 Nov, Q36): a task closes on its own when its rule's condition clears. A rule that
 * closes on Done is completed with a click; any other task can be completed early, with a note saying why, and it
 * doesn't come back for that record.
 */
export type Completable = { id: string; title: string; canComplete: boolean };

export function useCompleteTask(onDone: (id: string, note?: string) => void) {
  const [task, setTask] = useState<Completable | null>(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const start = (t: Completable) => {
    if (t.canComplete) return onDone(t.id);
    setNote('');
    setTried(false);
    setTask(t);
  };
  const close = () => setTask(null);
  const save = () => {
    if (!task) return;
    if (!note.trim()) return setTried(true);
    onDone(task.id, note.trim());
    setTask(null);
  };
  const dialog = (
    <Sheet
      open={!!task}
      onClose={close}
      center
      className="iform cfg__sheet"
      title="Complete this task early?"
      sub={task?.title}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={save}>Mark as completed</Button>
          </div>
        </div>
      }
    >
      <p className="field__hint">It would close by itself once its condition clears. Completed now, it won’t come back for this record.</p>
      <Field id="ct-note" label="Why it’s done" required error={tried && !note.trim() ? 'Add a note saying why it’s done.' : undefined}>
        <textarea id="ct-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Sheet>
  );
  return { start, dialog };
}
