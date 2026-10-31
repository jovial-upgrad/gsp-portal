import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DocButtons } from '../../components/DocView';
import { shortDate } from '../../data/dates';
import type { Cond, Need } from '../../data/applications';
import type { Student } from '../../data/students';

const MAX = 2000;
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/**
 * An offer's conditions, as GSP sent them: each a question to answer or a document to upload. The agency answers
 * them all here (opened from the request in the chat, or from Documents) and sends them to GSP together; GSP
 * passes them to the university.
 */
export function CondForm({ n, s, onClose, onSend }: { n: Need | null; s: Student; onClose: () => void; onSend: (n: Need, items: Cond[]) => void }) {
  // the last form stays while the dialog animates out
  const [shown, setShown] = useState<Need | null>(n);
  const [items, setItems] = useState<Cond[]>(n?.form ?? []);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!n) return;
    setShown(n);
    setItems(n.form ?? []);
    setTried(false);
  }, [n?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  const done = (c: Cond) => (c.kind === 'question' ? (c.answer ?? '').trim().length >= 5 : !!c.file);
  const left = items.filter((c) => !done(c)).length;
  const set = (id: string, patch: Partial<Cond>) => setItems((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const send = () => {
    setTried(true);
    if (!left) onSend(shown, items.map((c) => ({ ...c, answer: c.answer?.trim() })));
  };

  return (
    <Sheet
      open={!!n}
      onClose={onClose}
      center
      className="cform"
      title={shown.title}
      sub={
        <>
          From {shown.request?.by ?? 'GSP'}
          {shown.due ? ` · due ${shortDate(new Date(shown.due))}` : ''}. {shown.why}
        </>
      }
      footer={
        <div className="asf">
          <p className={`asf__note ${tried && left ? 'cform__left' : ''}`} role={tried && left ? 'alert' : undefined}>
            {tried && left ? `${left === 1 ? 'One condition still needs' : `${left} conditions still need`} an answer.` : `They go to ${shown.request?.by ?? 'GSP'} together, who passes them to the university.`}
          </p>
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={send} iconRight={<Icon name="arrowRight" size={18} />}>
              Send to GSP
            </Button>
          </div>
        </div>
      }
    >
      <ol className="cform__list">
        {items.map((c, i) => {
          const id = `cond-${c.id}`;
          const bad = tried && !done(c);
          return (
            <li key={c.id} className={`cform__item ${bad ? 'is-bad' : ''} ${done(c) ? 'is-done' : ''}`}>
              <div className="cform__head">
                <span className="cform__n" aria-hidden="true">
                  {done(c) ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}
                </span>
                <div className="cform__t">
                  <label className="cform__q" htmlFor={id}>
                    {c.text}
                  </label>
                  <p className="cform__meta">
                    <span className="cform__kind">{c.kind === 'question' ? 'Question' : 'Document'}</span>
                    {c.source && <span>{c.source}</span>}
                  </p>
                </div>
              </div>
              {c.kind === 'question' ? (
                <div className={`control cform__area ${bad ? 'is-invalid' : ''}`}>
                  <textarea
                    id={id}
                    className="control__input"
                    rows={4}
                    maxLength={MAX}
                    value={c.answer ?? ''}
                    placeholder={`${s.first}’s answer`}
                    aria-invalid={bad || undefined}
                    aria-describedby={`${id}-hint`}
                    onChange={(e) => set(c.id, { answer: e.target.value })}
                  />
                </div>
              ) : c.file ? (
                <div className="cform__file">
                  <Icon name="file" size={16} />
                  <span className="cform__fname">{c.file}</span>
                  <DocButtons d={{ name: c.text, file: c.file }} s={s} />
                  <label className="btn btn--secondary btn--sm" htmlFor={id}>
                    Replace
                  </label>
                </div>
              ) : (
                <label className={`mdrop cform__drop ${bad ? 'is-bad' : ''}`} htmlFor={id}>
                  <span className="mdrop__ic" aria-hidden="true">
                    <Icon name="upload" size={20} />
                  </span>
                  <span className="mdrop__t">
                    <span className="mdrop__main">
                      Upload the document, or <span className="mdrop__link">browse</span>
                    </span>
                    <span className="mdrop__sub">PDF, JPG or PNG · up to 10 MB</span>
                  </span>
                </label>
              )}
              {c.kind === 'document' && (
                <input
                  id={id}
                  className="vh"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  aria-label={`Upload for condition ${i + 1}`}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) set(c.id, { file: f.name });
                    e.target.value = '';
                  }}
                />
              )}
              {c.kind === 'question' && (
                <p id={`${id}-hint`} className={`cform__hint ${bad ? 'is-bad' : ''}`}>
                  {bad ? 'Answer this one.' : `${words(c.answer ?? '')} words`}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}

/** The conditions as the agency answered them: each question with its answer, each document with its file. */
export function CondAnswers({ items, s }: { items: Cond[]; s?: Student }) {
  return (
    <ol className="cans">
      {items.map((c, i) => (
        <li key={c.id} className="cans__item">
          <span className="cans__n num" aria-hidden="true">
            {i + 1}
          </span>
          <div className="cans__t">
            <p className="cans__q">{c.text}</p>
            {c.kind === 'question' ? (
              <p className="cans__a">{c.answer || 'Not answered yet'}</p>
            ) : c.file ? (
              <p className="cans__file">
                <Icon name="file" size={14} /> {c.file}
                <DocButtons d={{ name: c.text, file: c.file }} s={s} />
              </p>
            ) : (
              <p className="cans__a">No file yet</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
