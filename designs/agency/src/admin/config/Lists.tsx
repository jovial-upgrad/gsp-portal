import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, TextInput } from '../../components/forms';
import { SelectMenu } from '../../components/SelectMenu';
import { PageHead } from '../../institution/records/parts';
import { getDb } from '../../institution/data/store';
import { LEVELS, LEVEL_NAME, type Level } from '../../data/students';
import { STAGES } from '../../data/applications';
import { REASON_DEFAULTS } from '../../data/reasons';
import type { EducationLevel } from '../../data/education';
import { REASON_MAX, educationOf, reasonError, reasonListsOf, withEducation, withReasonLists, type ReasonLists } from '../data/lists';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';

const AREA_EDU = 'Highest education';
const AREA_REASONS = 'Reasons';

/** The record's education sections, as the profile names them (data/students.ts), lowest first. */
const SECTIONS = [...LEVELS].reverse().map((l) => ({ value: l, label: LEVEL_NAME[l] }));

/** What changed between two versions of the list, for the log. */
function eduChanges(was: EducationLevel[], now: EducationLevel[]) {
  const out: string[] = [];
  for (const x of now) {
    const old = was.find((y) => y.id === x.id);
    if (!old) out.push(`added ${x.name}`);
    else {
      if (old.name !== x.name) out.push(`renamed ${old.name} → ${x.name}`);
      if (old.record !== x.record) out.push(`${x.name}: section ${LEVEL_NAME[old.record]} → ${LEVEL_NAME[x.record]}`);
      if (!!old.retired !== !!x.retired) out.push(`${x.retired ? 'retired' : 'restored'} ${x.name}`);
    }
  }
  const order = (l: EducationLevel[]) => l.filter((x) => was.some((y) => y.id === x.id) && now.some((y) => y.id === x.id)).map((x) => x.id).join();
  if (order(was) !== order(now)) out.push(`order ${now.map((x) => x.name).join(' < ')}`);
  return out.join('; ') || 'no changes';
}

/**
 * Admin › Course configuration › **Highest education** (lock answer S3C-1, Jovial, 2 Nov: "aligned with proposed,
 * should be editable"). The one ordered list students (Add a student, the record's Academics) and courses (Minimum
 * highest education required) pick from. Edit, then Save: add a level, rename one, move it up or down, retire or
 * restore it. The order is the eligibility check's level check (lowest first). A retired level isn't offered for new
 * picks; students and courses already on it keep it, and its place. A renamed level keeps its old name for the
 * records saved under it. Each level names the profile section it fills. Every save is logged.
 */
export function HighestEducation({ cfg, change, say, canEdit }: ConfigProps) {
  const saved = educationOf(cfg);
  const d = useDraft<EducationLevel[]>(saved, 'the highest education list');
  const [adding, setAdding] = useState('');
  const [section, setSection] = useState<Level | ''>('');
  const [tried, setTried] = useState(false);
  const list = d.value;
  const nameErr = (v: string, self?: string) => {
    const t = v.trim();
    if (!t) return 'Type the level’s name.';
    if (t.length > REASON_MAX) return `Up to ${REASON_MAX} characters.`;
    if (list.some((x) => x.id !== self && x.name.toLowerCase() === t.toLowerCase())) return `${t} is on the list already.`;
    return null;
  };
  const addErr = nameErr(adding) ?? (!section ? 'Pick the profile section it fills.' : null);
  const errs = Object.fromEntries(list.map((x) => [x.id, nameErr(x.name, x.id)]));
  const bad = Object.values(errs).some(Boolean) || list.filter((x) => !x.retired).length < 2;
  const courses = (() => {
    try {
      return getDb().courses;
    } catch {
      return [];
    }
  })();
  const uses = (x: EducationLevel) => courses.filter((c) => c.minEducation && (c.minEducation === x.name || x.was?.includes(c.minEducation))).length;
  const upd = (id: string, patch: Partial<EducationLevel>) => d.set((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (i: number, by: -1 | 1) =>
    d.set((l) => {
      const n = [...l];
      const j = i + by;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const save = () => {
    if (bad) return;
    // a renamed level keeps its earlier names, so records saved under them still read it
    const next = list.map((x) => {
      const old = saved.find((y) => y.id === x.id);
      const name = x.name.trim();
      return old && old.name !== name ? { ...x, name, was: [...new Set([...(old.was ?? []), old.name])] } : { ...x, name };
    });
    change(AREA_EDU, `Highest education: ${eduChanges(saved, next)}`, (c) => withEducation(c, next));
    say('Saved. Students, courses and the eligibility check use the list from now.');
    d.stop();
  };
  return (
    <>
      <PageHead
        title="Highest education"
        lead="The one ordered list of education levels, lowest first. Students pick their highest education from it, and courses their minimum highest education. The eligibility check uses its order: a student meets a course’s minimum at that level or any after it."
      />
      <Panel
        flush
        title="Levels"
        note="A retired level isn’t offered for new students or courses; those already on it keep it, and its place in the order."
        action={canEdit && <EditBar name="the highest education list" editing={d.editing} dirty={d.dirty} onEdit={d.start} onCancel={() => (setAdding(''), setSection(''), setTried(false), d.stop())} onSave={save} />}
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Level</th>
                <th scope="col">Profile section it fills</th>
                <th scope="col">Courses with it as minimum</th>
                <th scope="col">Status</th>
                {d.editing && (
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {list.map((x, i) => (
                <tr key={x.id} className={x.retired ? 'is-off' : ''}>
                  <td className="num">{i + 1}</td>
                  <td className="cfg__strong">
                    {d.editing ? (
                      <Field id={`hed-n-${x.id}`} label={`Name of level ${i + 1}`} error={errs[x.id]}>
                        <TextInput id={`hed-n-${x.id}`} value={x.name} maxLength={REASON_MAX} invalid={!!errs[x.id]} onChange={(e) => upd(x.id, { name: e.target.value })} />
                      </Field>
                    ) : (
                      x.name
                    )}
                  </td>
                  <td>{d.editing ? <SelectMenu id={`hed-s-${x.id}`} label={`${x.name}: profile section`} value={x.record} options={SECTIONS} onChange={(v) => upd(x.id, { record: v as Level })} /> : LEVEL_NAME[x.record]}</td>
                  <td className="num">{uses(x)}</td>
                  <td>{x.retired ? 'Retired' : 'Active'}</td>
                  {d.editing && (
                    <td className="cfg__acts">
                      <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${x.name} up`}>
                        Up
                      </Button>
                      <Button size="sm" variant="ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${x.name} down`}>
                        Down
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => upd(x.id, { retired: !x.retired })} aria-label={`${x.retired ? 'Restore' : 'Retire'} ${x.name}`}>
                        {x.retired ? 'Restore' : 'Retire'}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.editing && list.filter((x) => !x.retired).length < 2 && (
          <p className="field__msg field__msg--error" role="alert">
            Keep at least two active levels.
          </p>
        )}
        {d.editing && (
          <div className="cfg__foot cfg__addusers">
            <Field id="hed-add" label="Add a level" error={tried ? nameErr(adding) : null}>
              <TextInput id="hed-add" value={adding} maxLength={REASON_MAX} invalid={tried && !!nameErr(adding)} onChange={(e) => setAdding(e.target.value)} />
            </Field>
            <Field id="hed-add-s" label="Profile section it fills" error={tried && !section ? 'Pick the profile section it fills.' : null}>
              <SelectMenu id="hed-add-s" label="Profile section it fills" value={section} placeholder="Pick one" invalid={tried && !section} options={SECTIONS} onChange={(v) => setSection(v as Level)} />
            </Field>
            <Button
              variant="secondary"
              iconLeft={<Icon name="plus" size={16} />}
              onClick={() => {
                setTried(true);
                if (addErr) return;
                d.set((l) => [...l, { id: `ed-${Date.now().toString(36)}`, name: adding.trim(), record: section as Level }]);
                setAdding('');
                setSection('');
                setTried(false);
              }}
            >
              Add
            </Button>
          </div>
        )}
      </Panel>
      <History log={cfg.log} area={AREA_EDU} />
    </>
  );
}

/** One editable list of reasons: rename, remove, add; each 1 to 60 characters and unique in the list. */
function ReasonList({ id, title, items, editing, set }: { id: string; title: string; items: string[]; editing: boolean; set: (fn: (l: string[]) => string[]) => void }) {
  const [adding, setAdding] = useState('');
  const [tried, setTried] = useState(false);
  const err = reasonError(adding, items);
  return (
    <div className="cfg__reasons">
      <p className="cfg__strong">{title}</p>
      {items.length ? (
        <ul className="cfg__doclist">
          {items.map((x, i) => (
            <li key={`${id}-${i}`}>
              {editing ? (
                <>
                  <Field id={`${id}-${i}`} label={`${title}: reason ${i + 1}`} error={reasonError(x, items, i)}>
                    <TextInput id={`${id}-${i}`} value={x} maxLength={REASON_MAX} invalid={!!reasonError(x, items, i)} onChange={(e) => set((l) => l.map((y, j) => (j === i ? e.target.value : y)))} />
                  </Field>
                  <button type="button" className="icon-btn" aria-label={`Remove ${x}`} onClick={() => set((l) => l.filter((_, j) => j !== i))}>
                    <Icon name="close" size={14} />
                  </button>
                </>
              ) : (
                <span>{x}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="cfg__muted">No reasons: nothing is offered here.</p>
      )}
      {editing && (
        <div className="cfg__add">
          <TextInput id={`${id}-add`} aria-label={`${title}: add a reason`} placeholder="Add a reason" maxLength={REASON_MAX} value={adding} invalid={tried && !!err} onChange={(e) => setAdding(e.target.value)} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTried(true);
              if (err) return;
              set((l) => [...l, adding.trim()]);
              setAdding('');
              setTried(false);
            }}
          >
            Add
          </Button>
          {tried && err && (
            <span className="field__msg field__msg--error" role="alert">
              {err}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const listDiff = (name: string, was: string[], now: string[]) => {
  const added = now.filter((x) => !was.includes(x));
  const gone = was.filter((x) => !now.includes(x));
  return [added.length && `${name}: added ${added.join(', ')}`, gone.length && `${name}: removed ${gone.join(', ')}`].filter(Boolean) as string[];
};

/**
 * Admin › Application configuration › **Reasons** (lock answer S3C-21, Jovial, 2 Nov). Two tables: **Close reasons
 * by stage** (what GSP picks when it closes an application at each stage) and **Withdraw reasons** (More › Withdraw,
 * RP and GSP). Edit, then Save; each reason up to 60 characters and unique in its list. Removing a reason stops it
 * being offered; applications already closed or withdrawn with it keep it. Send-back reasons (rejecting a document)
 * are fixed and not edited here. Every save is logged, with a Change history.
 */
export function Reasons({ cfg, change, say, canEdit }: ConfigProps) {
  const saved = reasonListsOf(cfg, REASON_DEFAULTS);
  const d = useDraft<ReasonLists>(saved, 'the reasons');
  const v = d.value;
  const bad = [...v.close, v.withdraw].some((l) => l.some((x, i) => reasonError(x, l, i)));
  const save = () => {
    if (bad) return;
    const next: ReasonLists = { close: v.close.map((l) => l.map((x) => x.trim())), withdraw: v.withdraw.map((x) => x.trim()) };
    const text = [...STAGES.flatMap((s, i) => listDiff(`Close at ${s}`, saved.close[i] ?? [], next.close[i] ?? [])), ...listDiff('Withdraw', saved.withdraw, next.withdraw)];
    change(AREA_REASONS, `Reasons: ${text.join('; ') || 'no changes'}`, (c) => withReasonLists(c, next));
    say('Saved. Close and Withdraw offer these from now; applications keep the reason they closed with.');
    d.stop();
  };
  const edit = canEdit && <EditBar name="the reasons" editing={d.editing} dirty={d.dirty} onEdit={d.start} onCancel={d.stop} onSave={save} />;
  return (
    <>
      <PageHead title="Reasons" lead="Why an application closes or is withdrawn. GSP picks from these when it closes an application; the RP and GSP pick from the withdraw reasons. Removing a reason stops it being offered; applications already closed with it keep it." />
      <Panel title="Close reasons by stage" note="What Change status › Close offers at each stage." action={edit}>
        <div className="cfg__reasongrid">
          {STAGES.map((s, i) => (
            <ReasonList key={s} id={`rz-c${i}`} title={s} items={v.close[i] ?? []} editing={d.editing} set={(fn) => d.set((x) => ({ ...x, close: STAGES.map((_, j) => (j === i ? fn(x.close[j] ?? []) : (x.close[j] ?? []))) }))} />
          ))}
        </div>
      </Panel>
      <Panel title="Withdraw reasons" note="What More › Withdraw application offers, in the RP portal and GSP’s.">
        <ReasonList id="rz-w" title="Withdraw" items={v.withdraw} editing={d.editing} set={(fn) => d.set((x) => ({ ...x, withdraw: fn(x.withdraw) }))} />
      </Panel>
      <Panel title="Send-back reasons" note="Why GSP sends a document back. Fixed: they aren’t edited here.">
        <ul className="cfg__doclist">
          {REASON_DEFAULTS.sendBack.map((x) => (
            <li key={x}>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <History log={cfg.log} area={AREA_REASONS} />
    </>
  );
}
