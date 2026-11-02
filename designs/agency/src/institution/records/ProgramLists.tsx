import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, TextInput } from '../../components/forms';
import { audit } from '../data/changelog';
import { PageHead, Pick, Pill, Section } from './parts';
import { FORM_LEVELS, type Db, type ProgramLevel, type SetDb, type StudyArea } from '../data/store';
import { canEditObject } from '../../admin/data/menus';

type Item = ProgramLevel | StudyArea;
type Kind = 'levels' | 'areas';
const WORD: Record<Kind, { one: string; many: string }> = { levels: { one: 'program level', many: 'Program levels' }, areas: { one: 'study area', many: 'Study areas' } };

/**
 * GSP · Admin › Program levels and study areas (slice 2 PRD, S2-17; Jovial, S2C-13): the two lists a course picks
 * from. Add, retire and restore; a retired one isn't offered for new courses, and courses that have it keep it. A
 * Program level needs its Application form level: which of the application form's levels it counts as. Matrix row
 * Settings: View roles see the lists without actions.
 */
export function ProgramLists({ db, set, me, say, role = 'Admin' }: { db: Db; set: SetDb; me: string; say: (m: string) => void; role?: string }) {
  const may = canEditObject(role, 'Settings');
  return (
    <div className="ipage">
      <PageHead title="Program levels and study areas" lead="The lists a course picks its program level and study area from. Each program level says which level of the application form it counts as." />
      <List kind="levels" items={db.levels} db={db} set={set} me={me} say={say} role={role} may={may} />
      <List kind="areas" items={db.areas} db={db} set={set} me={me} say={say} role={role} may={may} />
    </div>
  );
}

function List({ kind, items, db, set, me, say, role, may }: { kind: Kind; items: Item[]; db: Db; set: SetDb; me: string; say: (m: string) => void; role: string; may: boolean }) {
  const w = WORD[kind];
  const [name, setName] = useState('');
  const [form, setForm] = useState('');
  const [tried, setTried] = useState(false);
  const [retiring, setRetiring] = useState<Item | null>(null);
  const levels = kind === 'levels';
  const taken = (n: string) => items.some((t) => t.name.toLowerCase() === n.trim().toLowerCase());
  const err = { name: !name.trim() ? `Enter the ${w.one}.` : taken(name) ? `This ${w.one} is already on the list.` : null, form: levels && !form ? 'Pick the application form level it counts as.' : null };
  const uses = (t: Item) => db.courses.filter((c) => (levels ? c.level : c.area) === t.name).length;
  const area = (fn: (l: Item[]) => Item[]) => set((d) => ({ ...d, [kind]: fn(d[kind] as Item[]) }) as Db);
  const page = 'Program levels and study areas';
  return (
    <>
      {may && (
        <Section title={`Add a ${w.one}`} id={`plist-${kind}-add`}>
          <div className="ipicker__row">
            <Field id={`plist-${kind}-name`} label={levels ? 'Program level' : 'Study area'} required error={tried ? err.name : null}>
              <TextInput id={`plist-${kind}-name`} value={name} maxLength={60} invalid={tried && !!err.name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {levels && (
              <Field id={`plist-${kind}-form`} label="Application form level" required error={tried ? err.form : null}>
                <Pick id={`plist-${kind}-form`} label="Application form level" value={form} placeholder="Pick a level" invalid={tried && !!err.form} options={[...FORM_LEVELS]} onChange={setForm} />
              </Field>
            )}
            <Button
              iconLeft={<Icon name="plus" size={16} />}
              onClick={() => {
                setTried(true);
                if (err.name || err.form) return;
                const nm = name.trim();
                area((l) => [...l, levels ? { id: `lvl-${Date.now().toString(36)}`, name: nm, formLevel: form, retired: false } : { id: `area-${Date.now().toString(36)}`, name: nm, retired: false }]);
                audit(page, `${levels ? 'Program level' : 'Study area'} added: ${nm}${levels ? ` (application form level ${form})` : ''}`, me, role);
                say(`${nm} added.`);
                setName('');
                setForm('');
                setTried(false);
              }}
            >
              Add
            </Button>
          </div>
        </Section>
      )}
      <Section title={w.many} id={`plist-${kind}`}>
        <div className="stab-wrap">
          <table className="itab">
            <thead>
              <tr>
                <th scope="col">{levels ? 'Program level' : 'Study area'}</th>
                {levels && <th scope="col">Application form level</th>}
                <th scope="col">Courses</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  {levels && <td>{(t as ProgramLevel).formLevel}</td>}
                  <td className="num">{uses(t)}</td>
                  <td>{t.retired ? <Pill tone="grey">Retired</Pill> : <Pill tone="ok">In use</Pill>}</td>
                  <td>
                    {may &&
                      (t.retired ? (
                        <button
                          type="button"
                          className="btn btn--link"
                          onClick={() => {
                            area((l) => l.map((x) => (x.id === t.id ? { ...x, retired: false } : x)));
                            audit(page, `${levels ? 'Program level' : 'Study area'} restored: ${t.name}`, me, role);
                            say(`${t.name} restored: it’s offered for courses again.`);
                          }}
                        >
                          Restore<span className="vh"> {t.name}</span>
                        </button>
                      ) : (
                        <button type="button" className="btn btn--link idanger" onClick={() => setRetiring(t)}>
                          Retire<span className="vh"> {t.name}</span>
                        </button>
                      ))}
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
        confirm="Retire"
        danger
        onCancel={() => setRetiring(null)}
        onConfirm={() => {
          const t = retiring!;
          area((l) => l.map((x) => (x.id === t.id ? { ...x, retired: true } : x)));
          audit(page, `${levels ? 'Program level' : 'Study area'} retired: ${t.name}`, me, role);
          say(`${t.name} retired.`);
          setRetiring(null);
        }}
      >
        <p>It isn’t offered for new courses any more. The {retiring ? uses(retiring) : 0} courses that have it keep it. It can be restored.</p>
      </ConfirmDialog>
    </>
  );
}
