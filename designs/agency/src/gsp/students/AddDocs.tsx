import { UPLOAD } from '../../data/uploads';
import { CLARITY, isClear } from '../../data/clarity';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { LEVEL_NAME, TESTS, levelsFor, type Level } from '../../data/students';
import { MAX_SIZE, OK_TYPES, PLACE_NAME, classify, nameOf, placesOf, type Kind } from './record/sort';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** A file chosen in Add a student: still being sorted, or sorted. */
export type BulkFile = { name: string; sorting: boolean };
export type Failed = { name: string; error: string };

/** Why a file can't be uploaded, or nothing. */
/** Why a bulk file isn't kept: its type, its size, or a clarity score below the pass mark (BR-50: upload it again). */
export const fileError = (f: File) => (!OK_TYPES.test(f.name) ? `not a ${UPLOAD.types}` : f.size > MAX_SIZE ? `over ${UPLOAD.maxMB} MB` : !isClear(f.name) ? `${CLARITY.unclear} Upload it again.` : '');

/**
 * Documents, at the end of Add a student: **Bulk upload**, with "Or upload them individually from the student's
 * profile" under it, since it's optional and the only place to upload in bulk. Clicking it drops a panel out of
 * it: what to include (Passport, Academics, English test, each ticked green once it's in; the passport too when
 * it was uploaded to fill the form), then Choose files or a drop, and each file as it's sorted into its folder on
 * the profile ("Grade 12 marksheet · Education"). Files can be dropped on it closed, too.
 */
export function AddDocs({
  first,
  highest,
  files,
  failed,
  passport,
  onFiles,
  onRemove,
}: {
  first: string;
  highest: Level | '';
  files: BulkFile[];
  failed: Failed[];
  /** The passport uploaded to fill the form, if any. */
  passport?: string;
  onFiles: (f: File[]) => void;
  onRemove: (name: string) => void;
}) {
  const reduce = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  // new files: the dialog scrolls to them, so their sorting can be seen
  const count = files.length + failed.length;
  const seen = useRef(count);
  useEffect(() => {
    if (count > seen.current) window.setTimeout(() => filesRef.current?.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' }), 80);
    seen.current = count;
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps
  const [over, setOver] = useState(false);
  const whose = first.trim() ? `${first.trim()}’s` : 'the student’s';
  const h = highest || 'pg';
  // what's in so far, from the files sorted
  const kinds: Kind[] = files.filter((f) => !f.sorting).map((f) => classify(f.name, h));
  const has = (ok: (k: Kind) => boolean) => kinds.some(ok);
  const passDone = !!passport || has((k) => k.t === 'passport');
  const levels = highest ? levelsFor(highest) : [];
  const levelDone = (l: Level) => has((k) => k.t === 'edu' && k.l === l);
  const englishDone = has((k) => k.t === 'test' && TESTS[k.type].kind === 'English');
  const sorted = kinds.length;
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const fs = [...(e.dataTransfer.files ?? [])];
    if (fs.length) {
      setOpen(true);
      onFiles(fs);
    }
  };
  const drop = reduce ? {} : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.24, ease } };

  return (
    <section className="adx" aria-labelledby="as-docs-k">
      <h3 id="as-docs-k" className="adx__title">
        Documents
      </h3>
      <div
        className={`abulk ${open ? 'is-open' : ''} ${over ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
        onDrop={onDrop}
      >
        <button type="button" className="abulk__btn" aria-expanded={open} aria-controls="as-bulk-panel" onClick={() => setOpen((v) => !v)}>
          <span className="abulk__icon" aria-hidden="true">
            <Icon name="upload" size={20} />
          </span>
          <span className="abulk__t">
            <span className="abulk__name">Bulk upload</span>
            <span className="abulk__sub">Or upload them individually from {whose} profile, after adding.</span>
          </span>
          {sorted > 0 && <span className="abulk__count">{sorted === 1 ? '1 sorted' : `${sorted} sorted`}</span>}
          <span className="abulk__chev" aria-hidden="true">
            <Icon name="chevronDown" size={18} />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="panel" id="as-bulk-panel" className="abulk__panel" {...drop}>
              <div className="abulk__in">
                <p className="abulk__k">Include these, all at once</p>
                <ul className="abulk__need">
                  <Need done={passDone} name="Passport" sub={passport ? 'Uploaded to fill the form' : 'The photo page'} />
                  <Need
                    done={highest ? levelDone(highest) : false}
                    name="Academics"
                    sub={
                      levels.length ? (
                        <span className="abulk__levels">
                          {levels.map((l) => (
                            <span key={l} className={`abulk__lv ${levelDone(l) ? 'is-done' : ''}`}>
                              {levelDone(l) && <Icon name="check" size={12} strokeWidth={2.6} />}
                              {LEVEL_NAME[l]}
                              {l === highest ? ' (needed)' : ''}
                            </span>
                          ))}
                        </span>
                      ) : (
                        'Marksheets and transcripts, up to the highest education'
                      )
                    }
                  />
                  <Need done={englishDone} name="English test" sub="IELTS, PTE, TOEFL or Duolingo score report" />
                </ul>
                <p className="abulk__more">Anything else, like a CV, statement of purpose or letters, goes to Documents too.</p>
                <div className="abulk__pick">
                  <input
                    ref={input}
                    id="as-bulk"
                    type="file"
                    multiple
                    accept={UPLOAD.accept}
                    className="vh"
                    tabIndex={-1}
                    aria-labelledby="as-docs-k"
                    onChange={(e) => {
                      const fs = [...(e.target.files ?? [])];
                      e.target.value = '';
                      if (fs.length) onFiles(fs);
                    }}
                  />
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="upload" size={16} />} aria-describedby="as-bulk-rules" onClick={() => input.current?.click()}>
                    Choose files
                  </Button>
                  <span id="as-bulk-rules" className="abulk__rules">
                    or drop them here · {UPLOAD.types}, up to {UPLOAD.maxMB} MB each
                  </span>
                </div>
                {(files.length > 0 || failed.length > 0) && (
                  <ul ref={filesRef} className="adrop__files" aria-live="polite">
                    {files.map((f) => {
                      const k = classify(f.name, h);
                      const read = k.t === 'passport' && f.name === passport;
                      return (
                        <li key={f.name} className="adrop__file">
                          <span className="adrop__fi" aria-hidden="true">
                            <Icon name="file" size={16} />
                          </span>
                          <span className="adrop__fn">{f.name}</span>
                          {f.sorting ? (
                            <span className="adrop__into is-sorting">
                              <span className="adrop__spin" aria-hidden="true" />
                              Sorting…
                            </span>
                          ) : (
                            <span className="adrop__into">
                              <span className="adrop__doc">{nameOf(k)}</span>
                              <span className="adrop__folder">
                                <Icon name="folder" size={14} />
                                {placesOf(k)
                                  .map((p) => PLACE_NAME[p])
                                  .join(' and ')}
                                {read ? ' · read into the form' : ''}
                              </span>
                            </span>
                          )}
                          <button type="button" className="icon-btn adrop__x" aria-label={`Remove ${f.name}`} onClick={() => onRemove(f.name)}>
                            <Icon name="close" size={16} />
                          </button>
                        </li>
                      );
                    })}
                    {failed.map((f) => (
                      <li key={f.name} className="adrop__file is-bad">
                        <span className="adrop__fi" aria-hidden="true">
                          <Icon name="alert" size={16} />
                        </span>
                        <span className="adrop__fn">{f.name}</span>
                        <span className="adrop__into">Not uploaded: {f.error}</span>
                        <button type="button" className="icon-btn adrop__x" aria-label={`Dismiss ${f.name}`} onClick={() => onRemove(f.name)}>
                          <Icon name="close" size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/** One thing to include, ticked green once it's in. */
function Need({ done, name, sub }: { done: boolean; name: string; sub: ReactNode }) {
  return (
    <li className={`abulk__item ${done ? 'is-done' : ''}`}>
      <span className="abulk__tick" aria-hidden="true">
        {done && <Icon name="check" size={14} strokeWidth={2.6} />}
      </span>
      <span className="abulk__it">
        <span className="abulk__iname">
          {name}
          <span className="vh">{done ? ': in' : ': not in yet'}</span>
        </span>
        <span className="abulk__isub">{sub}</span>
      </span>
    </li>
  );
}
