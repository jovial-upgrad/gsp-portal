import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, TextInput } from '../../components/forms';
import { audit } from '../data/changelog';
import { PageHead, Pill, Section } from './parts';
import type { CourseTag, Db, SetDb } from '../data/store';
import { canEditObject } from '../../admin/data/menus';

/**
 * GSP · Admin › Course tags (slice 2 PRD, S2-16): Admin owns the list of tags partners see on courses in course
 * search (and use as quick filters). Add, rename, retire; a retired tag isn't offered and leaves every course; a
 * retired tag can be restored (proposal S2C-13). Seeded with today's tags; no Regional university tag (S2-27).
 */
export function CourseTags({ db, set, me, say, role = 'Admin' }: { db: Db; set: SetDb; me: string; say: (m: string) => void; role?: string }) {
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const [renaming, setRenaming] = useState<CourseTag | null>(null);
  const [to, setTo] = useState('');
  const [retiring, setRetiring] = useState<CourseTag | null>(null);
  const taken = (n: string, self?: string) => db.tags.some((t) => t.id !== self && t.name.toLowerCase() === n.trim().toLowerCase());
  const err = !name.trim() ? 'Enter the tag name.' : taken(name) ? 'This tag is already on the list.' : null;
  const renameErr = !to.trim() ? 'Enter the tag name.' : taken(to, renaming?.id) ? 'This tag is already on the list.' : null;
  // the matrix's Settings row (admin/data/menus.ts): View Only and other View roles see the list without actions
  const may = canEditObject(role, 'Settings');
  const uses = (t: CourseTag) => db.courses.filter((c) => c.tags.includes(t.name)).length;
  return (
    <div className="ipage">
      <PageHead title="Course tags" lead="The tags the Institution team picks for each course by hand. Partners see them on the course in course search, and they’re quick filters there." />
      {may && <Section title="Add a tag" id="ctag-add">
        <div className="ipicker__row">
          <Field id="ctag-name" label="Tag name" required error={tried ? err : null}>
            <TextInput id="ctag-name" value={name} maxLength={60} invalid={tried && !!err} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button
            iconLeft={<Icon name="plus" size={16} />}
            onClick={() => {
              setTried(true);
              if (err) return;
              set((d) => ({ ...d, tags: [...d.tags, { id: `tag-${Date.now().toString(36)}`, name: name.trim(), retired: false }] }));
              audit('Course tags', `Tag added: ${name.trim()}`, me, role);
              say(`${name.trim()} added.`);
              setName('');
              setTried(false);
            }}
          >
            Add tag
          </Button>
        </div>
      </Section>}
      <Section title="Tags" id="ctag-list">
        <div className="stab-wrap">
          <table className="itab">
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
              {db.tags.map((t) => (
                <tr key={t.id}>
                  <td>
                    {renaming?.id === t.id ? (
                      <span className="irowacts">
                        <TextInput id={`ctag-r-${t.id}`} aria-label={`New name for ${t.name}`} value={to} invalid={!!renameErr} onChange={(e) => setTo(e.target.value)} />
                        <Button size="sm" variant="secondary" onClick={() => setRenaming(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={!!renameErr || to.trim() === t.name}
                          onClick={() => {
                            const nm = to.trim();
                            set((d) => ({ ...d, tags: d.tags.map((x) => (x.id === t.id ? { ...x, name: nm } : x)), courses: d.courses.map((c) => (c.tags.includes(t.name) ? { ...c, tags: c.tags.map((g) => (g === t.name ? nm : g)) } : c)) }));
                            audit('Course tags', `Tag renamed: ${t.name} → ${nm}`, me, role);
                            say(`Renamed to ${nm} on every course.`);
                            setRenaming(null);
                          }}
                        >
                          Save
                        </Button>
                      </span>
                    ) : (
                      t.name
                    )}
                  </td>
                  <td className="num">{uses(t)}</td>
                  <td>{t.retired ? <Pill tone="grey">Retired</Pill> : <Pill tone="ok">In use</Pill>}</td>
                  <td>
                    {may && <span className="irowacts">
                      {!t.retired && renaming?.id !== t.id && (
                        <button type="button" className="btn btn--link" onClick={() => (setRenaming(t), setTo(t.name))}>
                          Rename<span className="vh"> {t.name}</span>
                        </button>
                      )}
                      {t.retired ? (
                        <button
                          type="button"
                          className="btn btn--link"
                          onClick={() => {
                            set((d) => ({ ...d, tags: d.tags.map((x) => (x.id === t.id ? { ...x, retired: false } : x)) }));
                            audit('Course tags', `Tag restored: ${t.name}`, me, role);
                            say(`${t.name} restored. Pick it on each course again.`);
                          }}
                        >
                          Restore<span className="vh"> {t.name}</span>
                        </button>
                      ) : (
                        <button type="button" className="btn btn--link idanger" onClick={() => setRetiring(t)}>
                          Retire<span className="vh"> {t.name}</span>
                        </button>
                      )}
                    </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <ConfirmDialog
        open={!!retiring}
        title={`Retire ${retiring?.name}?`}
        confirm="Retire tag"
        danger
        onCancel={() => setRetiring(null)}
        onConfirm={() => {
          const t = retiring!;
          set((d) => ({ ...d, tags: d.tags.map((x) => (x.id === t.id ? { ...x, retired: true } : x)), courses: d.courses.map((c) => (c.tags.includes(t.name) ? { ...c, tags: c.tags.filter((g) => g !== t.name) } : c)) }));
          audit('Course tags', `Tag retired: ${t.name}`, me, role);
          say(`${t.name} retired: it left every course.`);
          setRetiring(null);
        }}
      >
        <p>It leaves every course ({retiring ? uses(retiring) : 0}) and isn’t offered any more. It can be restored.</p>
      </ConfirmDialog>
    </div>
  );
}
