// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * "Acting as": lets a reviewer see a page as any user, so role access and
 * region isolation can be shown. Prototype-only: in the real build the signed-in
 * user is the persona.
 */
import React, { createContext, useContext } from 'react';
import { useStore, update, userById } from './store';
import { DEFAULT_PERSONA } from './store';
import { SCOPES } from './access';
import { Select } from './kit';

export const HostContext = createContext({ hostRole: 'gsp-admin', openRecord: () => {} });

const ALLOWED = {
  'gsp-team': ['admission', 'admission-ops', 'recruitment', 'recruitment-ops', 'finance', 'view-only'],
  'institution-partner': ['institution', 'institution-ops'],
  'gsp-admin': ['admin', 'admission', 'admission-ops', 'recruitment', 'recruitment-ops', 'institution', 'institution-ops', 'finance', 'view-only'],
  'rp-admin': ['rp-admin', 'branch-admin', 'counsellor'],
  'gsp-finance': ['finance'],
};

export function usePersona() {
  const { hostRole } = useContext(HostContext);
  const s = useStore();
  const allowed = ALLOWED[hostRole] || ALLOWED['gsp-admin'];
  let u = userById(s, s.persona);
  if (!u || !allowed.includes(u.role)) u = userById(s, DEFAULT_PERSONA[hostRole]) || s.users[0];
  const role = s.roles.find(r => r.id === u.role);
  return { user: u, role, allowed };
}

export function PersonaBar() {
  const s = useStore();
  const { user, role, allowed } = usePersona();
  const options = s.users.filter(u => allowed.includes(u.role))
    .map(u => [u.id, `${u.name} · ${s.roles.find(r => r.id === u.role).name}`]);
  const { hostRole } = useContext(HostContext);
  if (options.length < 2) return null; // only one person to be: nothing to switch
  const scope = role.scope === 'regions' ? (user.regions || []).join(', ') : SCOPES[role.scope];
  return (
    <div className="gspx-persona" role="group" aria-label="Acting as">
      <span className="gspx-persona__k">Acting as</span>
      <Select id="gspx-persona" label="Acting as" hideLabel value={user.id} onChange={v => update(d => { d.persona = v; })} options={options} />
      <span className="gspx-persona__scope"><b>{role.name}</b> · sees {scope}</span>
      {hostRole === 'gsp-finance' && <span className="gspx-persona__tag">For testing: act as Lav to check Suman’s changes</span>}
    </div>
  );
}
