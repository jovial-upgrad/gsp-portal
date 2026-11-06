import { useState } from 'react';
import { EditOnly, useHides } from '../../proto/viewOnly';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { MoreMenu } from '../../components/MoreMenu';
import { Field, SelectInput, TextInput, describedBy } from '../../components/forms';
import { CountryCombobox } from '../../components/CountryCombobox';
import { PhoneInput } from '../../components/PhoneInput';
import { countryByName } from '../../data/partners';
import { CITIES, type TeamRole } from '../../data/students';
import { TEAM_ROLES, isEmail } from '../../data/team';
import { Pill, Section } from '../../institution/records/parts';
import { bdmFor, regionOf, type Branch, type OpsMember, type OpsRp } from './data';
import { Confirm } from './Confirm';
import { Foot } from './parts';

const where = (b: Pick<Branch, 'city' | 'state' | 'country'>) => [b.city, b.state, b.country].filter(Boolean).join(', ');
const lastAdmin = (team: OpsMember[], m: OpsMember) => m.role === 'RP Admin' && team.filter((x) => x.role === 'RP Admin').length === 1;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * An RP's **Branches** and **Team**, two sections of its Overview (Nesil, 4 Nov, later), as the RP Admin's Profile has
 * them (src/screens/portal/Team.tsx): RP Ops adds, edits and removes each. A branch: its name, where it is, its sales
 * region and its BDM (set by the system from BDM assignment), and how many work there; the head office (from the
 * business details) can't be removed, and a removed branch's people move to it. A team member: name, email, phone,
 * role and branch; a new one is invited by email; the last RP Admin can't be removed. Removing asks first.
 */
export function TeamSections({ r, update, log, say }: { r: OpsRp; update: (fn: (r: OpsRp) => OpsRp) => void; log: (x: OpsRp, what: string) => OpsRp; say: (m: string) => void }) {
  const [branchDlg, setBranchDlg] = useState<{ edit?: Branch } | null>(null);
  const [memberDlg, setMemberDlg] = useState<{ edit?: OpsMember } | null>(null);
  const [removing, setRemoving] = useState<{ m: OpsMember } | { b: Branch } | null>(null);
  // GSP · Global Ops (6 Nov): no Branches or Team
  const noBranches = useHides('rp.branches');
  const noTeam = useHides('rp.team');
  const head = r.branches.find((b) => b.head) ?? r.branches[0];
  const branchName = (id?: string) => r.branches.find((b) => b.id === id)?.name;
  const at = (b: Branch) => r.team.filter((m) => m.branch === b.id).length;

  const removeNow = () => {
    if (!removing) return;
    if ('m' in removing) {
      const m = removing.m;
      update((x) => log({ ...x, team: x.team.filter((y) => y.id !== m.id) }, `${m.name} removed from the team`));
      say(`${m.name} removed from the team.`);
    } else {
      const b = removing.b;
      const n = at(b);
      update((x) => log({ ...x, branches: x.branches.filter((y) => y.id !== b.id), team: x.team.map((m) => (m.branch === b.id ? { ...m, branch: head?.id } : m)) }, `Branch ${b.name} removed`));
      say(n ? `${b.name} removed. ${n === 1 ? 'Its team member is' : `Its ${n} team members are`} now at ${head?.name}.` : `${b.name} removed.`);
    }
    setRemoving(null);
  };

  return (
    <>
      {!noBranches && (
        <Section
          title="Branches"
          id="orp-branches"
          action={
            <EditOnly>
              <Button variant="secondary" iconLeft={<Icon name="plus" size={18} />} onClick={() => setBranchDlg({})}>
                Add branch
              </Button>
            </EditOnly>
          }
        >
          {r.branches.length === 0 ? (
            <p className="muted ops-empty">No branches yet.</p>
          ) : (
            <div className="stab-wrap">
              <table className="itab ops-tab ops-tab--mid">
                <thead>
                  <tr>
                    <th scope="col">Branch</th>
                    <th scope="col">Location</th>
                    <th scope="col">Sales region</th>
                    <th scope="col">Branch BDM</th>
                    <th scope="col" className="num">
                      Team
                    </th>
                    <th scope="col">
                      <span className="vh">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.branches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="ops-strong">{b.name}</span>
                        {b.head && <span className="irow__sub">Head office</span>}
                      </td>
                      <td>{where(b)}</td>
                      <td>{regionOf(b.country)}</td>
                      <td>{b.contact || <span className="muted">—</span>}</td>
                      <td className="num">{at(b)}</td>
                      <td className="ops-end">
                        <EditOnly>
                          <MoreMenu
                            id={`obr-${b.id}`}
                            label={`More for ${b.name}`}
                            items={[
                              { id: 'edit', label: 'Edit branch', icon: 'edit', onPick: () => setBranchDlg({ edit: b }) },
                              ...(b.head ? [] : [{ id: 'remove', label: 'Remove branch', icon: 'close' as const, danger: true, onPick: () => setRemoving({ b }) }]),
                            ]}
                          />
                        </EditOnly>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {!noTeam && (
        <Section
          title="Team"
          id="orp-team"
          action={
            <EditOnly>
              <Button variant="secondary" iconLeft={<Icon name="plus" size={18} />} onClick={() => setMemberDlg({})}>
                Add team member
              </Button>
            </EditOnly>
          }
        >
          <div className="stab-wrap">
            <table className="itab ops-tab ops-tab--mid">
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
                {r.team.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className="ops-strong">{m.name}</span>
                      <span className="irow__sub">{m.email}</span>
                    </td>
                    <td className="num ops-nowrap">{m.phone ? `${m.dial} ${m.phone}` : <span className="muted">—</span>}</td>
                    <td>
                      <span className="ops-stack">
                        {m.role}
                        {m.invited && <Pill tone="gsp">Invited</Pill>}
                      </span>
                    </td>
                    <td>{branchName(m.branch) ?? <span className="muted">—</span>}</td>
                    <td className="ops-end">
                      <EditOnly>
                        <MoreMenu
                          id={`otm-${m.id}`}
                          label={`More for ${m.name}`}
                          items={[
                            { id: 'edit', label: 'Edit details, role or branch', icon: 'edit', onPick: () => setMemberDlg({ edit: m }) },
                            ...(lastAdmin(r.team, m) ? [] : [{ id: 'remove', label: 'Remove from team', icon: 'close' as const, danger: true, onPick: () => setRemoving({ m }) }]),
                          ]}
                        />
                      </EditOnly>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <BranchSheet
        open={!!branchDlg}
        edit={branchDlg?.edit}
        branches={r.branches}
        fallback={r.recruitment}
        onClose={() => setBranchDlg(null)}
        onSave={(b) => {
          const isNew = !r.branches.some((x) => x.id === b.id);
          update((x) => log({ ...x, branches: isNew ? [...x.branches, b] : x.branches.map((y) => (y.id === b.id ? b : y)) }, isNew ? `Branch ${b.name} added` : `Branch ${b.name} edited`));
          say(isNew ? `${b.name} added.` : `${b.name} saved.`);
          setBranchDlg(null);
        }}
      />
      <MemberSheet
        open={!!memberDlg}
        edit={memberDlg?.edit}
        team={r.team}
        branches={r.branches}
        onClose={() => setMemberDlg(null)}
        onSave={(m) => {
          const isNew = !r.team.some((x) => x.id === m.id);
          update((x) => log({ ...x, team: isNew ? [...x.team, m] : x.team.map((y) => (y.id === m.id ? m : y)) }, isNew ? `${m.name} added to the team (${m.role}), invitation sent` : `${m.name}’s details edited`));
          say(isNew ? `${m.name} added. Invitation sent to ${m.email}.` : `${m.name} saved.`);
          setMemberDlg(null);
        }}
      />
      <Confirm
        open={!!removing}
        title={removing ? ('m' in removing ? `Remove ${removing.m.name} from the team?` : `Remove ${removing.b.name}?`) : ''}
        confirm="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={removeNow}
      >
        {removing && 'm' in removing && <p>They can no longer sign in to the RP portal.</p>}
        {removing && 'b' in removing && <p>{at(removing.b) ? `${plural(at(removing.b), 'team member')} move to ${head?.name}.` : 'Nobody on the team works there.'}</p>}
      </Confirm>
    </>
  );
}

/** Add or edit a branch: its name and where it is. Its BDM comes from BDM assignment, shown as it's set. */
function BranchSheet({ open, edit, branches, fallback, onClose, onSave }: { open: boolean; edit?: Branch; branches: Branch[]; fallback: string; onClose: () => void; onSave: (b: Branch) => void }) {
  const blank = (): Branch => ({ id: `obr${Date.now()}`, name: '', country: '', state: '', city: '', contact: '' });
  const [b, setB] = useState<Branch>(blank);
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setB(edit ?? blank()), setTried(false));
  }
  const states = countryByName(b.country)?.states ?? [];
  const cities = CITIES[b.state] ?? [];
  const contact = b.country ? bdmFor(b.country, b.city.trim(), b.state) || fallback : '';
  const taken = branches.some((x) => x.id !== b.id && x.name.trim().toLowerCase() === b.name.trim().toLowerCase());
  const err = {
    name: b.name.trim().length < 2 ? 'Give the branch a name, like Mysuru.' : taken ? 'There’s already a branch with this name.' : null,
    country: b.country ? null : 'Choose the country.',
    state: states.length && !b.state ? 'Choose the state or province.' : null,
    city: b.city.trim().length < 2 ? 'Enter the city.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ ...b, name: b.name.trim(), city: b.city.trim(), contact });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title={edit ? `Edit ${edit.name}` : 'Add branch'}
      footer={
        <Foot onClose={onClose}>
          <Button onClick={save}>{edit ? 'Save' : 'Add branch'}</Button>
        </Foot>
      }
    >
      <p className="ireq">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required
      </p>
      <div className="ops-form ops-form--2">
        <Field id="obr-name" label="Branch name" required error={show('name')} className="ops-wide">
          <TextInput id="obr-name" value={b.name} invalid={!!show('name')} aria-describedby={describedBy('obr-name', show('name'))} onChange={(e) => setB((x) => ({ ...x, name: e.target.value }))} />
        </Field>
        <Field id="obr-country" label="Country" required error={show('country')}>
          <CountryCombobox id="obr-country" value={b.country} invalid={!!show('country')} onChange={(v) => v !== b.country && setB((x) => ({ ...x, country: v, state: '', city: '' }))} />
        </Field>
        <Field id="obr-state" label="State or province" required={states.length > 0} error={show('state')}>
          {states.length ? (
            <SelectInput id="obr-state" value={b.state} placeholder="Choose" invalid={!!show('state')} onChange={(e) => setB((x) => ({ ...x, state: e.target.value, city: '' }))}>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          ) : (
            <TextInput id="obr-state" value={b.state} onChange={(e) => setB((x) => ({ ...x, state: e.target.value }))} />
          )}
        </Field>
        <Field id="obr-city" label="City" required error={show('city')}>
          <TextInput id="obr-city" value={b.city} list={cities.length ? 'obr-cities' : undefined} invalid={!!show('city')} onChange={(e) => setB((x) => ({ ...x, city: e.target.value }))} />
        </Field>
        {cities.length > 0 && (
          <datalist id="obr-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
        <Field id="obr-bdm" label="Branch BDM">
          <TextInput id="obr-bdm" value={contact || '—'} readOnly disabled />
        </Field>
      </div>
    </Sheet>
  );
}

/** Add a team member (they're invited by email), or edit one: name, work email, phone with the country code, role and branch. */
function MemberSheet({ open, edit, team, branches, onClose, onSave }: { open: boolean; edit?: OpsMember; team: OpsMember[]; branches: Branch[]; onClose: () => void; onSave: (m: OpsMember) => void }) {
  const head = branches.find((b) => b.head) ?? branches[0];
  const blank = (): OpsMember => ({ id: `otm${Date.now()}`, name: '', email: '', dial: team[0]?.dial ?? '+91', phone: '', role: 'Counsellor', branch: head?.id, invited: true });
  const [m, setM] = useState<OpsMember>(blank);
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) (setM(edit ?? blank()), setTried(false));
  }
  const email = m.email.trim().toLowerCase();
  const taken = team.some((x) => x.id !== m.id && x.email.toLowerCase() === email);
  const onlyAdmin = !!edit && lastAdmin(team, edit);
  const err = {
    name: m.name.trim().length < 2 ? 'Enter their full name.' : null,
    email: !isEmail(email) ? 'Enter a work email, like name@agency.com.' : taken ? 'Someone on the team already has this email.' : null,
    phone: m.phone.replace(/\D/g, '').length < 7 ? 'Enter their phone number.' : null,
    branch: branches.length && !m.branch ? 'Choose their branch.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ ...m, name: m.name.trim(), email, phone: m.phone.trim() });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="iform"
      title={edit ? `Edit ${edit.name}` : 'Add team member'}
      footer={
        <Foot onClose={onClose}>
          <Button onClick={save}>{edit ? 'Save' : 'Add team member'}</Button>
        </Foot>
      }
    >
      <p className="ireq">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required
      </p>
      <div className="ops-form ops-form--2">
        <Field id="otm-name" label="Full name" required error={show('name')} className="ops-wide">
          <TextInput id="otm-name" value={m.name} invalid={!!show('name')} aria-describedby={describedBy('otm-name', show('name'))} onChange={(e) => setM((x) => ({ ...x, name: e.target.value }))} />
        </Field>
        <Field id="otm-email" label="Work email" required error={show('email')}>
          <TextInput id="otm-email" type="email" value={m.email} invalid={!!show('email')} aria-describedby={describedBy('otm-email', show('email'))} onChange={(e) => setM((x) => ({ ...x, email: e.target.value }))} />
        </Field>
        <Field id="otm-phone" label="Phone number" required error={show('phone')}>
          <PhoneInput id="otm-phone" dial={m.dial} number={m.phone} invalid={!!show('phone')} describedBy={describedBy('otm-phone', show('phone'))} onDial={(v) => setM((x) => ({ ...x, dial: v }))} onNumber={(v) => setM((x) => ({ ...x, phone: v }))} />
        </Field>
        <Field id="otm-role" label="Role" required>
          <SelectInput id="otm-role" value={m.role} disabled={onlyAdmin} onChange={(e) => setM((x) => ({ ...x, role: e.target.value as TeamRole }))}>
            {TEAM_ROLES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="otm-branch" label="Branch" required={branches.length > 0} error={show('branch')}>
          <SelectInput id="otm-branch" value={m.branch ?? ''} placeholder={branches.length ? 'Choose' : 'No branches yet'} disabled={!branches.length} invalid={!!show('branch')} onChange={(e) => setM((x) => ({ ...x, branch: e.target.value }))}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Sheet>
  );
}
