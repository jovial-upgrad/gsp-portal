import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { MoreMenu } from '../../components/MoreMenu';
import { useCheck, emailError, phoneError, dupError } from '../../components/validate';
import { Toast, type ToastMsg } from '../../components/Toast';
import { Field, SelectInput, TextInput, describedBy } from '../../components/forms';
import { CountryCombobox } from '../../components/CountryCombobox';
import { PhoneInput } from '../../components/PhoneInput';
import { countryByName, type Contact } from '../../data/partners';
import { CITIES, type Member, type Student, type TeamRole } from '../../data/students';
import { TEAM_ROLES, branchBdm, lastAdmin, type Branch } from '../../data/team';

type Props = {
  agency: string;
  /** The agency's own partner manager at GSP: every branch has them unless GSP has someone in its city. */
  bdm: Contact | null;
  team: Member[];
  setTeam: (fn: (l: Member[]) => Member[]) => void;
  branches: Branch[];
  setBranches: (fn: (l: Branch[]) => Branch[]) => void;
  students: Student[];
  setStudents: (fn: (l: Student[]) => Student[]) => void;
};

const location = (b: Pick<Branch, 'city' | 'state' | 'country'>) => [b.city, b.state, b.country].filter(Boolean).join(', ');

/**
 * Branches and team, on RP Admin's Profile (Nesil, 29 Oct; not in GSP Team). **Branches**: each office with where
 * it is and its branch BDM, set by the system (GSP's partner manager for its city, or the agency's own; just the
 * name, Nesil 30 Oct), and how many of the team work there; Add branch, Edit, Remove (not the head office; its
 * people move to the head office).
 * **Team**: each member's name and email, phone, role (RP Admin, Branch Admin or Counsellor) and branch; Invite team
 * member, Edit (role and branch included, so a member moves branch here), Remove (not yourself, not the last RP
 * Admin; their students move to you). The team is the one Students picks counsellors from.
 */
export function TeamSection({ agency, bdm, team, setTeam, branches, setBranches, students, setStudents }: Props) {
  const [branchDlg, setBranchDlg] = useState<{ edit?: Branch } | null>(null);
  const [memberDlg, setMemberDlg] = useState<{ edit?: Member } | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const tell = (title: string, text?: string, undo?: () => void) =>
    setToast({ key: Date.now(), title, text, icon: undo ? 'info' : 'checkCircle', tone: undo ? 'plain' : 'ok', action: undo ? { label: 'Undo', onClick: undo } : undefined });
  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name ?? 'No branch';
  const main = branches.find((b) => b.main) ?? branches[0];
  const studentsOf = (m: Member) => students.filter((s) => s.counsellor === m.id).length;

  /* QC, 1 Nov (H33): removing is reversible, so it happens straight away and the notification offers Undo */
  const removeNow = (removing: { m: Member } | { b: Branch }) => {
    const was = { team, branches, students };
    const undo = () => {
      setTeam(() => was.team);
      setBranches(() => was.branches);
      setStudents(() => was.students);
    };
    if ('m' in removing) {
      const m = removing.m;
      const n = studentsOf(m);
      setTeam((l) => l.filter((x) => x.id !== m.id));
      if (n) setStudents((l) => l.map((s) => (s.counsellor === m.id ? { ...s, counsellor: 'me' } : s)));
      tell(`${m.name} removed from the team`, n ? `Their ${n === 1 ? 'student is' : `${n} students are`} now yours.` : `They can no longer sign in to ${agency}’s portal.`, undo);
    } else {
      const b = removing.b;
      const moved = team.filter((x) => x.branch === b.id).length;
      setBranches((l) => l.filter((x) => x.id !== b.id));
      if (moved) setTeam((l) => l.map((x) => (x.branch === b.id ? { ...x, branch: main?.id } : x)));
      tell(`${b.name} removed`, moved ? `${moved === 1 ? 'Its team member is' : `Its ${moved} team members are`} now at ${main?.name}.` : undefined, undo);
    }
  };
  const setRemoving = (r: { m: Member } | { b: Branch }) => {
    removeNow(r);
    // the row's menu has gone: focus goes to its section's heading (QC, 1 Nov, H8)
    window.setTimeout(() => {
      const h = document.getElementById('m' in r ? 'team-title' : 'br-title');
      h?.setAttribute('tabindex', '-1');
      h?.focus();
    }, 60);
  };

  return (
    <>
      <section className="card pcard tcard" aria-labelledby="br-title">
        <div className="pcard__row">
          <div className="pcard__lead">
            <h2 id="br-title" className="pcard__title">
              Branches <span className="tcount num">{branches.length}</span>
            </h2>
          </div>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => setBranchDlg({})}>
            Add branch
          </Button>
        </div>
        <div className="ttable__wrap">
          <table className="ttable">
            <thead>
              <tr>
                <th scope="col">Branch</th>
                <th scope="col">Location</th>
                <th scope="col">Branch BDM</th>
                <th scope="col">Team</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => {
                const n = team.filter((x) => x.branch === b.id).length;
                return (
                  <tr key={b.id}>
                    <td data-k="Branch">
                      <span className="ttable__name">{b.name}</span>
                      {b.main && <span className="tpill">Head office</span>}
                    </td>
                    <td data-k="Location">{location(b)}</td>
                    <td data-k="Branch BDM">{branchBdm(b, bdm)?.name ?? 'Not set yet'}</td>
                    <td data-k="Team" className="num">
                      {n}
                    </td>
                    <td className="ttable__acts">
                      <MoreMenu
                        id={`br-${b.id}`}
                        label={`More for ${b.name}`}
                        items={[
                          { id: 'edit', label: 'Edit branch', icon: 'edit', onPick: () => setBranchDlg({ edit: b }) },
                          ...(b.main ? [] : [{ id: 'remove', label: 'Remove branch', icon: 'close' as const, danger: true, onPick: () => setRemoving({ b }) }]),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card pcard tcard" aria-labelledby="team-title">
        <div className="pcard__row">
          <div className="pcard__lead">
            <h2 id="team-title" className="pcard__title">
              Team <span className="tcount num">{team.length}</span>
            </h2>
          </div>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => setMemberDlg({})}>
            Invite team member
          </Button>
        </div>
        <div className="ttable__wrap">
          <table className="ttable">
            <thead>
              <tr>
                <th scope="col">Name and email</th>
                <th scope="col">Phone</th>
                <th scope="col">Role</th>
                <th scope="col">Branch</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td data-k="Name">
                    <span className="ttable__name">
                      {m.name}
                      {m.id === 'me' && <span className="ttable__you"> (you)</span>}
                    </span>
                    <span className="ttable__sub ttable__email">{m.email ?? '–'}</span>
                    {m.invited && <span className="tpill tpill--wait">Invited</span>}
                  </td>
                  <td data-k="Phone" className="num ttable__phone">
                    {m.phone ? `${m.dial ?? ''} ${m.phone}` : '–'}
                  </td>
                  <td data-k="Role">{m.role}</td>
                  <td data-k="Branch">{branchName(m.branch)}</td>
                  <td className="ttable__acts">
                    <MoreMenu
                      id={`tm-${m.id}`}
                      label={`More for ${m.name}`}
                      items={[
                        { id: 'edit', label: 'Edit details, role or branch', icon: 'edit', onPick: () => setMemberDlg({ edit: m }) },
                        ...(m.id === 'me' || lastAdmin(team, m) ? [] : [{ id: 'remove', label: 'Remove from team', icon: 'close' as const, danger: true, onPick: () => setRemoving({ m }) }]),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BranchDialog
        open={!!branchDlg}
        edit={branchDlg?.edit}
        branches={branches}
        onClose={() => setBranchDlg(null)}
        onSave={(b) => {
          const isNew = !branches.some((x) => x.id === b.id);
          setBranches((l) => (isNew ? [...l, b] : l.map((x) => (x.id === b.id ? b : x))));
          setBranchDlg(null);
          tell(isNew ? `${b.name} added` : `${b.name} updated`, isNew ? `Branch BDM: ${branchBdm(b, bdm)?.name ?? 'set by GSP soon'}.` : undefined);
        }}
      />
      <MemberDialog
        open={!!memberDlg}
        edit={memberDlg?.edit}
        team={team}
        branches={branches}
        onClose={() => setMemberDlg(null)}
        onSave={(m) => {
          const isNew = !team.some((x) => x.id === m.id);
          setTeam((l) => (isNew ? [...l, m] : l.map((x) => (x.id === m.id ? m : x))));
          setMemberDlg(null);
          tell(isNew ? `Invitation sent to ${m.name}` : `${m.name} saved`, isNew ? `To ${m.email}, with a link that works for 7 days.` : `${m.role} · ${branchName(m.branch)}`);
        }}
      />
      <Toast t={toast} onClose={() => setToast(null)} />
    </>
  );
}

/** Add or edit a branch: its name and where it is. The branch BDM follows from the city, set by the system (it shows in the table). */
function BranchDialog({ open, edit, branches, onClose, onSave }: { open: boolean; edit?: Branch; branches: Branch[]; onClose: () => void; onSave: (b: Branch) => void }) {
  const [b, setB] = useState<Branch>({ id: '', name: '', country: 'India', state: '', city: '' });
  const [start, setStart] = useState<Branch>(b);
  const states = countryByName(b.country)?.states ?? [];
  const cities = CITIES[b.state] ?? [];
  // QC, 1 Nov (H25): the city comes from the state's list when there is one
  const err = {
    name: b.name.trim().length < 2 ? 'Enter the branch name, like Mysuru.' : dupError(b.name, branches.filter((x) => x.id !== b.id).map((x) => x.name), 'There’s already a branch with this name.'),
    country: b.country ? null : 'Pick the country.',
    state: states.length && !b.state ? 'Pick the state or province.' : null,
    city: cities.length ? (!b.city ? 'Pick the city.' : null) : b.city.trim().length < 2 ? 'Enter the city.' : null,
  };
  const c = useCheck(err);
  useEffect(() => {
    if (!open) return;
    const x = edit ?? { id: `br${Date.now()}`, name: '', country: 'India', state: '', city: '' };
    setB(x);
    setStart(x);
    c.reset();
  }, [open, edit?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(b) !== JSON.stringify(start);
  const show = (k: keyof typeof err) => c.err(k);
  const save = () => {
    if (!c.submit()) return;
    onSave({ ...b, name: b.name.trim(), city: b.city.trim() });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      what={edit ? edit.name : 'the new branch'}
      center
      className="tsheet"
      title={edit ? `Edit ${edit.name}` : 'Add branch'}
      footer={
        <div className="asf asf--end">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!!edit && !dirty}>
              {edit ? 'Save' : 'Add branch'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="tform"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field id="br-name" label="Branch name" required error={show('name')}>
          <TextInput id="br-name" value={b.name} placeholder="Like: Mysuru" onBlur={c.blur('name')} onChange={(e) => setB((x) => ({ ...x, name: e.target.value }))} />
        </Field>
        <Field id="br-country" label="Country" required error={show('country')}>
          <CountryCombobox id="br-country" value={b.country} invalid={!!show('country')} onChange={(v) => v !== b.country && setB((x) => ({ ...x, country: v, state: '', city: '' }))} />
        </Field>
        <div className="grid2">
          <Field id="br-state" label="State or province" required={states.length > 0} error={show('state')}>
            {states.length ? (
              <SelectInput id="br-state" value={b.state} placeholder="Choose" onBlur={c.blur('state')} onChange={(e) => setB((x) => ({ ...x, state: e.target.value, city: '' }))}>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <TextInput id="br-state" value={b.state} onChange={(e) => setB((x) => ({ ...x, state: e.target.value }))} />
            )}
          </Field>
          <Field id="br-city" label="City" required error={show('city')} hint={!cities.length && b.state ? undefined : !b.state && states.length ? 'Pick the state first.' : undefined}>
            {cities.length ? (
              <SelectInput id="br-city" value={b.city} placeholder="Choose" onBlur={c.blur('city')} onChange={(e) => setB((x) => ({ ...x, city: e.target.value }))}>
                {[...new Set([...cities, b.city].filter(Boolean))].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <TextInput id="br-city" value={b.city} disabled={states.length > 0 && !b.state} onBlur={c.blur('city')} onChange={(e) => setB((x) => ({ ...x, city: e.target.value }))} />
            )}
          </Field>
        </div>
        <button type="submit" className="vh" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Sheet>
  );
}

/** Invite a team member, or edit one: their name, work email, phone with the country code, role and branch. */
function MemberDialog({ open, edit, team, branches, onClose, onSave }: { open: boolean; edit?: Member; team: Member[]; branches: Branch[]; onClose: () => void; onSave: (m: Member) => void }) {
  const blank = (): Member => ({ id: `m${Date.now()}`, name: '', role: 'Counsellor', email: '', dial: '+91', phone: '', branch: branches.find((b) => b.main)?.id ?? branches[0]?.id, invited: true });
  const [m, setM] = useState<Member>(blank);
  const [start, setStart] = useState<Member>(m);
  const email = (m.email ?? '').trim().toLowerCase();
  const onlyAdmin = !!edit && lastAdmin(team, edit);
  // QC, 1 Nov: checked when left and on Send; the phone's length follows its country code; the first error is focused
  const err = {
    name: m.name.trim().length < 2 ? 'Enter their full name.' : null,
    email: emailError(email, { what: 'work email', example: 'name@agency.com' }) || dupError(email, team.filter((x) => x.id !== m.id).map((x) => x.email ?? ''), 'Someone on the team already has this email.'),
    phone: phoneError(m.dial ?? '+91', m.phone ?? '', { required: true }),
    branch: m.branch ? null : 'Pick their branch.',
  };
  const c = useCheck(err);
  useEffect(() => {
    if (!open) return;
    const x = edit ? { dial: '+91', phone: '', email: '', ...edit } : blank();
    setM(x);
    setStart(x);
    c.reset();
  }, [open, edit?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(m) !== JSON.stringify(start);
  const show = (k: keyof typeof err) => c.err(k);
  const save = () => {
    if (!c.submit()) return;
    onSave({ ...m, name: m.name.trim(), email });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      what={edit ? edit.name : 'the invitation'}
      center
      className="tsheet"
      title={edit ? `Edit ${edit.name}` : 'Invite team member'}
      footer={
        <div className="asf asf--end">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!!edit && !dirty}>
              {edit ? 'Save' : 'Send invitation'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="tform"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field id="tm-name" label="Full name" required error={show('name')}>
          <TextInput id="tm-name" value={m.name} onBlur={c.blur('name')} onChange={(e) => setM((x) => ({ ...x, name: e.target.value }))} />
        </Field>
        <Field id="tm-email" label="Work email" required error={show('email')}>
          <TextInput id="tm-email" type="email" value={m.email ?? ''} onBlur={c.blur('email')} onChange={(e) => setM((x) => ({ ...x, email: e.target.value }))} />
        </Field>
        <Field id="tm-phone" label="Phone number" required error={show('phone')}>
          <PhoneInput id="tm-phone" dial={m.dial ?? '+91'} number={m.phone ?? ''} invalid={!!show('phone')} describedBy={describedBy('tm-phone', show('phone'))} onBlur={c.blur('phone')} onDial={(v) => setM((x) => ({ ...x, dial: v }))} onNumber={(v) => setM((x) => ({ ...x, phone: v }))} />
        </Field>
        <div className="grid2">
          <Field id="tm-role" label="Role" required hint={onlyAdmin ? 'The only RP Admin: make someone else an RP Admin first.' : undefined}>
            <SelectInput id="tm-role" value={m.role} disabled={onlyAdmin} aria-describedby={describedBy('tm-role', null, onlyAdmin)} onChange={(e) => setM((x) => ({ ...x, role: e.target.value as TeamRole }))}>
              {TEAM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="tm-branch" label="Branch" required error={show('branch')}>
            <SelectInput id="tm-branch" value={m.branch ?? ''} placeholder="Choose" onBlur={c.blur('branch')} onChange={(e) => setM((x) => ({ ...x, branch: e.target.value }))}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <button type="submit" className="vh" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Sheet>
  );
}
