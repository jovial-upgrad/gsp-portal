import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, TextInput } from '../../components/forms';
import { NoMatch, PageHead } from '../../institution/records/parts';
import type { ProgramLevel, StudyArea, Tag } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { History, Pager, Panel, usePaged } from './parts';

/** In use or Deactivated, as a pill. */
const Status = ({ on }: { on: boolean }) => <span className={`cfg__state ${on ? 'is-on' : ''}`}>{on ? 'In use' : 'Deactivated'}</span>;

/** A name, asked in a small pop-up: to add something, or to rename it. */
function NameDialog({
  open,
  title,
  label,
  cta,
  start,
  taken,
  placeholder,
  extra,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  label: string;
  cta: string;
  start: string;
  taken: string[];
  placeholder: string;
  extra?: ReactNode;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [v, setV] = useState(start);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(start);
    setTried(false);
  }, [open, start]);
  const name = v.trim();
  const err = name.length < 2 ? `Enter the ${label.toLowerCase()}.` : taken.some((t) => t.toLowerCase() === name.toLowerCase() && t !== start) ? 'That one’s already on the list.' : null;
  const save = () => {
    setTried(true);
    if (!err) onSave(name);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform cfg__sheet"
      title={title}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{cta}</Button>
          </div>
        </div>
      }
    >
      <form
        className="cfg__form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field id="cn-name" label={label} required error={tried ? err : null}>
          <TextInput id="cn-name" value={v} invalid={tried && !!err} placeholder={placeholder} onChange={(e) => setV(e.target.value)} autoFocus />
        </Field>
        {extra}
      </form>
    </Sheet>
  );
}

/**
 * Course Tags (Nesil, 3 Nov, after the reference screen): the tags the Institution team picks for each course by hand.
 * Partners see them on the course in course search, and they're quick filters there. **Add Tag** in a pop-up, a
 * search, and each tag's courses and status, with Rename and Deactivate (asked first; Reactivate brings it back).
 */
export function CourseTags({ cfg, change, say, courses }: ConfigProps) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Tag | null>(null);
  const [asking, setAsking] = useState<Tag | null>(null);
  const count = (t: Tag) => courses.filter((c) => c.tags.includes(t.name) || (t.was ?? []).some((w) => c.tags.includes(w))).length;
  const s = q.trim().toLowerCase();
  const rows = cfg.tags.filter((t) => !s || t.name.toLowerCase().includes(s));
  const pg = usePaged(rows, [s]);
  const inUse = cfg.tags.filter((t) => t.on).length;
  return (
    <>
      <PageHead title="Course Tags" lead="The tags the Institution team picks for each course. Partners see them in course search and filter by them.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding(true)}>
          Add Tag
        </Button>
      </PageHead>
      <section className="card stable" aria-labelledby="tg-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search tags</span>
              <input id="tg-q" type="search" placeholder="Search tags" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <p className="stools__count" id="tg-count" role="status">
            <span>
              <span className="num">{rows.length === cfg.tags.length ? cfg.tags.length : `${rows.length} of ${cfg.tags.length}`}</span> tags · <span className="num">{inUse}</span> in use
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <NoMatch what="tags" onClear={() => setQ('')} />
        ) : (
          <div className="stab-wrap">
            <table className="itab cfg__tab cfg__tab--even">
              <colgroup>
                <col className="cfg__wide" />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Tag</th>
                  <th scope="col">Courses</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((t) => (
                  <tr key={t.name} className={t.on ? '' : 'is-off'}>
                    <td className="cfg__strong">{t.name}</td>
                    <td className="num">{count(t).toLocaleString('en-GB')}</td>
                    <td>
                      <Status on={t.on} />
                    </td>
                    <td className="cfg__linkacts">
                      <button type="button" className="cfg__linkbtn" onClick={() => setRenaming(t)} aria-label={`Rename ${t.name}`}>
                        Rename
                      </button>
                      <button type="button" className={`cfg__linkbtn ${t.on ? 'is-danger' : ''}`} onClick={() => setAsking(t)} aria-label={`${t.on ? 'Deactivate' : 'Reactivate'} ${t.name}`}>
                        {t.on ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pg={pg} what="tags" />
      </section>
      <History log={cfg.log} area="Course tags" />
      <NameDialog
        open={adding}
        title="Add Tag"
        label="Tag name"
        cta="Add Tag"
        start=""
        taken={cfg.tags.map((t) => t.name)}
        placeholder="Like: Scholarship available"
        onClose={() => setAdding(false)}
        onSave={(name) => {
          change('Course tags', `Added ${name}`, (c) => ({ ...c, tags: [{ name, on: true }, ...c.tags] }));
          say(`${name} added. The Institution team can pick it on a course now.`);
          setAdding(false);
        }}
      />
      <NameDialog
        open={!!renaming}
        title="Rename Tag"
        label="Tag name"
        cta="Save Changes"
        start={renaming?.name ?? ''}
        taken={cfg.tags.map((t) => t.name)}
        placeholder="Tag name"
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          const t = renaming!;
          if (name !== t.name) {
            change('Course tags', `Renamed ${t.name} to ${name}`, (c) => ({ ...c, tags: c.tags.map((x) => (x.name === t.name ? { ...x, name, was: [...(x.was ?? []), t.name] } : x)) }));
            say(`Renamed to ${name}. Its courses keep it.`);
          }
          setRenaming(null);
        }}
      />
      <ConfirmDialog
        open={!!asking}
        title={asking ? `${asking.on ? 'Deactivate' : 'Reactivate'} ${asking.name}?` : ''}
        confirm={asking?.on ? 'Deactivate Tag' : 'Reactivate Tag'}
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          const t = asking!;
          change('Course tags', `${t.on ? 'Deactivated' : 'Reactivated'} ${t.name}`, (c) => ({ ...c, tags: c.tags.map((x) => (x.name === t.name ? { ...x, on: !x.on } : x)) }));
          say(`${t.name} ${t.on ? 'deactivated' : 'reactivated'}.`);
          setAsking(null);
        }}
      >
        <p>
          {asking?.on
            ? `${count(asking).toLocaleString('en-GB')} ${count(asking) === 1 ? 'course has' : 'courses have'} it. Partners stop seeing it in course search, and it can’t be picked for a course. You can reactivate it.`
            : 'Partners see it on its courses again, and it can be picked for a course.'}
        </p>
      </ConfirmDialog>
    </>
  );
}

/**
 * Program Level Configuration (Nesil, 3 Nov): two lists the courses are filed under, **program levels** and **study
 * areas**; each shows its courses and status, can be deactivated (asked first) and reactivated, and new ones are added
 * in a pop-up, as Course Tags does. 4 Nov (Nesil): the Add pop-up asks for the name only. 6 Nov (Nesil): no Application
 * form level column, and each row has **Edit**, a pop-up with its name; a renamed one keeps its courses.
 */
export function ProgramLevels({ cfg, change, say, courses }: ConfigProps) {
  const [adding, setAdding] = useState<'level' | 'area' | null>(null);
  const [asking, setAsking] = useState<{ kind: 'level' | 'area'; name: string; on: boolean } | null>(null);
  const [editing, setEditing] = useState<{ kind: 'level' | 'area'; name: string } | null>(null);
  const levelCount = (l: ProgramLevel) => courses.filter((c) => c.level === l.name || l.was?.includes(c.level)).length;
  const areaCount = (a: StudyArea) => courses.filter((c) => c.area === a.name || a.was?.includes(c.area)).length;
  const flip = (kind: 'level' | 'area', name: string) =>
    change('Program level configuration', `${asking?.on ? 'Deactivated' : 'Reactivated'} ${kind === 'level' ? 'program level' : 'study area'} ${name}`, (c) =>
      kind === 'level' ? { ...c, levels: c.levels.map((x) => (x.name === name ? { ...x, on: !x.on } : x)) } : { ...c, areas: c.areas.map((x) => (x.name === name ? { ...x, on: !x.on } : x)) },
    );
  const n = asking ? (asking.kind === 'level' ? levelCount(cfg.levels.find((l) => l.name === asking.name)!) : areaCount(cfg.areas.find((a) => a.name === asking.name)!)) : 0;
  return (
    <>
      <PageHead title="Program Level Configuration" lead="The program levels and study areas courses are filed under." />
      <Panel
        flush
        title="Program Levels"
        note={`${cfg.levels.filter((l) => l.on).length} of ${cfg.levels.length} in use`}
        action={
          <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setAdding('level')}>
            Add Program Level
          </Button>
        }
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__tab--even">
            <thead>
              <tr>
                <th scope="col">Program level</th>
                <th scope="col">Courses</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.levels.map((l) => (
                <tr key={l.name} className={l.on ? '' : 'is-off'}>
                  <td className="cfg__strong">{l.name}</td>
                  <td className="num">{levelCount(l).toLocaleString('en-GB')}</td>
                  <td>
                    <Status on={l.on} />
                  </td>
                  <td className="cfg__linkacts">
                    <button type="button" className="cfg__linkbtn" onClick={() => setEditing({ kind: 'level', name: l.name })} aria-label={`Edit ${l.name}`}>
                      Edit
                    </button>
                    <button type="button" className={`cfg__linkbtn ${l.on ? 'is-danger' : ''}`} onClick={() => setAsking({ kind: 'level', name: l.name, on: l.on })} aria-label={`${l.on ? 'Deactivate' : 'Reactivate'} ${l.name}`}>
                      {l.on ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        flush
        title="Study Areas"
        note={`${cfg.areas.filter((a) => a.on).length} of ${cfg.areas.length} in use`}
        action={
          <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} onClick={() => setAdding('area')}>
            Add Study Area
          </Button>
        }
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__tab--even">
            <thead>
              <tr>
                <th scope="col">Study area</th>
                <th scope="col">Courses</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cfg.areas.map((a) => (
                <tr key={a.name} className={a.on ? '' : 'is-off'}>
                  <td className="cfg__strong">{a.name}</td>
                  <td className="num">{areaCount(a).toLocaleString('en-GB')}</td>
                  <td>
                    <Status on={a.on} />
                  </td>
                  <td className="cfg__linkacts">
                    <button type="button" className="cfg__linkbtn" onClick={() => setEditing({ kind: 'area', name: a.name })} aria-label={`Edit ${a.name}`}>
                      Edit
                    </button>
                    <button type="button" className={`cfg__linkbtn ${a.on ? 'is-danger' : ''}`} onClick={() => setAsking({ kind: 'area', name: a.name, on: a.on })} aria-label={`${a.on ? 'Deactivate' : 'Reactivate'} ${a.name}`}>
                      {a.on ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Program level configuration" />
      <NameDialog
        open={adding === 'level'}
        title="Add Program Level"
        label="Program level name"
        cta="Add Program Level"
        start=""
        taken={cfg.levels.map((l) => l.name)}
        placeholder="Like: Graduate certificate"
        onClose={() => setAdding(null)}
        onSave={(name) => {
          change('Program level configuration', `Added program level ${name}`, (c) => ({ ...c, levels: [...c.levels, { name, on: true }] }));
          say(`${name} added.`);
          setAdding(null);
        }}
      />
      <NameDialog
        open={adding === 'area'}
        title="Add Study Area"
        label="Study area name"
        cta="Add Study Area"
        start=""
        taken={cfg.areas.map((a) => a.name)}
        placeholder="Like: Hospitality and tourism"
        onClose={() => setAdding(null)}
        onSave={(name) => {
          change('Program level configuration', `Added study area ${name}`, (c) => ({ ...c, areas: [...c.areas, { name, on: true }] }));
          say(`${name} added.`);
          setAdding(null);
        }}
      />
      <NameDialog
        open={!!editing}
        title={editing?.kind === 'area' ? 'Edit Study Area' : 'Edit Program Level'}
        label={editing?.kind === 'area' ? 'Study area name' : 'Program level name'}
        cta="Save Changes"
        start={editing?.name ?? ''}
        taken={(editing?.kind === 'area' ? cfg.areas : cfg.levels).map((x) => x.name)}
        placeholder={editing?.kind === 'area' ? 'Study area name' : 'Program level name'}
        onClose={() => setEditing(null)}
        onSave={(name) => {
          const e = editing!;
          if (name !== e.name) {
            const what = e.kind === 'level' ? 'program level' : 'study area';
            const ren = <T extends { name: string; was?: string[] }>(xs: T[]) => xs.map((x) => (x.name === e.name ? { ...x, name, was: [...(x.was ?? []), e.name] } : x));
            change('Program level configuration', `Renamed ${what} ${e.name} to ${name}`, (c) => (e.kind === 'level' ? { ...c, levels: ren(c.levels) } : { ...c, areas: ren(c.areas) }));
            say(`Renamed to ${name}. Its courses keep it.`);
          }
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!asking}
        title={asking ? `${asking.on ? 'Deactivate' : 'Reactivate'} ${asking.name}?` : ''}
        confirm={asking ? `${asking.on ? 'Deactivate' : 'Reactivate'} ${asking.kind === 'level' ? 'Program Level' : 'Study Area'}` : ''}
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          const x = asking!;
          flip(x.kind, x.name);
          say(`${x.name} ${x.on ? 'deactivated' : 'reactivated'}.`);
          setAsking(null);
        }}
      >
        <p>
          {asking?.on
            ? `${n.toLocaleString('en-GB')} ${n === 1 ? 'course is' : 'courses are'} filed under it and stay so, but it can’t be picked for a new course, and course search stops offering it as a filter. You can reactivate it.`
            : 'It can be picked for a course again, and course search offers it as a filter.'}
        </p>
      </ConfirmDialog>
    </>
  );
}
