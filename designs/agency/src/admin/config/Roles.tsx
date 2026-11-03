import { useEffect, useMemo, useState } from 'react';
import { useCheck } from '../../components/validate';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { MoreMenu } from '../../components/MoreMenu';
import { Field, TextInput } from '../../components/forms';
import { MultiPick } from '../../institution/records/MultiPick';
import { PageHead } from '../../institution/records/parts';
import { LEVELS, LEVEL_SHORT, OBJECTS, REGION_MEANS, ROLES, isSystemRegion, type Level, type Region } from '../data/config';
import { nationalityWord } from '../data/nationalities';
import { COUNTRIES } from '../../data/partners';
import { useStore } from '../../work/store';
import { calendarIdOf, putRegionsOn, useCalendars } from '../../work/calendars';
import { sampleApplications, isOpen } from '../../data/applications';
import { routingRps } from '../../data/regions';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft } from './parts';
import { Empty, Loaded, Pick, SaveBanner, ViewOnlyNote, trySave, type SaveResult } from './states';

/** A region as the Sales regions page edits it: its own record, plus its default recruitment contact and Admissions queue. Its working calendar is set only on Admin › Work › Working days (Jovial, 3 Nov). */
type RegionRow = Region & { bdm: string; queue: string };

/**
 * Sales regions (PRD slice 1; Admin › User roles › Sales regions): the only list of sales regions in the product.
 * Each has a name, its countries, an Admissions contact, a default recruitment contact, its Admissions queue (from Admin › Work, the
 * one queue editor, S4-1). Its working calendar is set on Admin › Work › Working days only (S4-25; Jovial, 3 Nov). One time zone, IST. Global,
 * Direct and Rest of world are system regions. The same page keeps the nationality map, on its own tab.
 */
export function Regions(p: ConfigProps) {
  const [tab, setTab] = useState<'regions' | 'nationality'>('regions');
  return (
    <>
      <PageHead title="Sales regions" lead="The only list of sales regions: every country-by-region list reads it. Everything counts in IST (Asia/Kolkata); a region’s calendar only sets which days, hours and holidays are working time." />
      {!p.canEdit && <ViewOnlyNote />}
      <div className="cfg__tabs" role="group" aria-label="Sales regions or the nationality map">
        <button type="button" className="ichip" aria-pressed={tab === 'regions'} onClick={() => setTab('regions')}>
          Sales regions
        </button>
        <button type="button" className="ichip" aria-pressed={tab === 'nationality'} onClick={() => setTab('nationality')}>
          Nationality map
        </button>
      </div>
      <Loaded page="sales regions" cols={5}>
        {tab === 'regions' ? <RegionList {...p} /> : <NationalityMap {...p} />}
      </Loaded>
      <History log={p.cfg.log} area="Sales regions" />
    </>
  );
}

function RegionList({ cfg, change, say, canEdit }: ConfigProps) {
  const [edit, setEdit] = useState<RegionRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<Region | null>(null);
  const work = useStore() as { queues: { id: string; name: string }[] };
  const cals = useCalendars();
  const queueNames = (work.queues ?? []).filter((q) => q.id !== 'q-fallback' && q.id !== 'q-admin').map((q) => q.name);
  const queueOf = (r: string) => {
    const v = cfg.regionQueue[r];
    const name = cfg.queues.find((q) => q.id === v)?.name ?? v;
    // a deleted queue falls back to Global Admissions
    return name && queueNames.includes(name) ? name : 'Global Admissions';
  };
  const rows: RegionRow[] = cfg.regions.map((r) => ({ ...r, bdm: cfg.regionBdm[r.name] ?? '', queue: queueOf(r.name) }));
  // what keeps a region from being deleted (S1-8): an RP, a branch or an open application in it
  const inUse = (name: string) => {
    const rps = routingRps().filter((x) => x.region === name).length;
    const apps = sampleApplications().filter((a) => isOpen(a) && a.region === name).length;
    return { rps, apps };
  };
  const usersIn = (r: string) => cfg.users.filter((u) => u.regions.includes(r)).length;
  const blocked = removing ? inUse(removing.name) : null;
  const stop = !!blocked && (blocked.rps > 0 || blocked.apps > 0);
  return (
    <>
      <Panel
        flush
        title="Sales regions"
        note={`${cfg.regions.length} regions, 3 of them system regions (Rest of world, Direct, Global).`}
        action={
          canEdit && (
            <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEdit('new')}>
              Add sales region
            </Button>
          )
        }
      >
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Countries</th>
                <th scope="col">Admissions contact</th>
                <th scope="col">Default recruitment contact</th>
                <th scope="col">Admissions queue</th>
                {canEdit && (
                  <th scope="col">
                    <span className="vh">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="cfg__strong">
                    {r.name}
                    <span className="cfg__sub">
                      {isSystemRegion(r.name) ? 'System region · ' : ''}
                      {usersIn(r.name)} {usersIn(r.name) === 1 ? 'user' : 'users'}
                    </span>
                  </td>
                  <td className="cfg__muted">{r.countries.length ? (r.countries.length <= 3 ? r.countries.join(', ') : `${r.countries.length} countries: ${r.countries.slice(0, 3).join(', ')}…`) : REGION_MEANS[r.name] ?? 'None'}</td>
                  <td>{r.contact || <span className="cfg__warn">Not set</span>}</td>
                  <td>{r.bdm || <span className="cfg__warn">Not set</span>}</td>
                  <td>{r.queue}</td>
                  {canEdit && (
                    <td className="cfg__acts">
                      <MoreMenu
                        id={`rg-${r.name}`}
                        label={`More for ${r.name}`}
                        items={[
                          { id: 'edit', label: 'Edit', icon: 'edit', onPick: () => setEdit(r) },
                          ...(isSystemRegion(r.name) ? [] : [{ id: 'remove', label: 'Delete', icon: 'close' as const, danger: true, onPick: () => setRemoving(r) }]),
                        ]}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <RegionDialog
        open={!!edit}
        region={edit === 'new' ? null : edit}
        regions={cfg.regions}
        contacts={cfg.users.filter((u) => (u.role === 'Admission' || u.role === 'Global Ops') && u.status === 'Active').map((u) => u.name)}
        bdms={cfg.users.filter((u) => u.role === 'Recruitment' && u.status === 'Active').map((u) => u.name)}
        queues={queueNames}
        onClose={() => setEdit(null)}
        onSave={(r) => {
          const was = edit === 'new' ? null : edit;
          // the working calendar is Admin › Work › Working days' (Jovial, 3 Nov): an edit here keeps the region on its calendar
          const calId = was ? calendarIdOf(was.name) : undefined;
          const region: Region = { name: r.name, contact: r.contact, countries: r.countries, ...(calId ? { calendarId: calId } : {}) };
          if (!was) {
            change('Sales regions', `Added ${r.name}: ${r.countries.length} countries; contact ${r.contact}; recruitment contact ${r.bdm}; queue ${r.queue}`, (c) => {
              const at = c.regions.findIndex((x) => isSystemRegion(x.name));
              return { ...c, regions: [...c.regions.slice(0, at), region, ...c.regions.slice(at)], regionBdm: { ...c.regionBdm, [r.name]: r.bdm }, regionQueue: { ...c.regionQueue, [r.name]: r.queue } };
            });
          } else {
            const renamed = was.name !== r.name;
            const re = (x: string) => (x === was.name ? r.name : x);
            const rekey = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).map(([k, x]) => [re(k), x]));
            const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);
            const diffs = (
              [
                ['name', was.name, r.name],
                ['countries', was.countries.join(', ') || 'none', r.countries.join(', ') || 'none'],
                ['Admissions contact', was.contact, r.contact],
                ['default recruitment contact', was.bdm, r.bdm],
                ['Admissions queue', was.queue, r.queue],
              ] as [string, string, string][]
            )
              .filter(([, a, b]) => a !== b)
              .map(([k, a, b]) => `${k} ${short(a)} → ${short(b)}`);
            // renaming keeps the region's id: its users, RPs and records move with it
            change('Sales regions', `${was.name}: ${diffs.join('; ')}`, (c) => ({
              ...c,
              regions: c.regions.map((x) => (x.name === was.name ? region : x)),
              users: renamed ? c.users.map((u) => (u.regions.includes(was.name) ? { ...u, regions: u.regions.map(re), region: u.regions.map(re).join(', ') } : u)) : c.users,
              nationality: renamed ? Object.fromEntries(Object.entries(c.nationality).map(([k, x]) => [k, re(x)])) : c.nationality,
              lists: renamed ? rekey(c.lists) : c.lists,
              regionBdm: { ...(renamed ? rekey(c.regionBdm) : c.regionBdm), [r.name]: r.bdm },
              regionQueue: { ...(renamed ? rekey(c.regionQueue) : c.regionQueue), [r.name]: r.queue },
            }));
          }
          // a renamed region stays on its calendar under its new name
          if (calId && was && was.name !== r.name) {
            const on = cals.find((c) => c.id === calId)?.regions.filter((x) => x !== was.name && x !== r.name) ?? [];
            putRegionsOn(calId, [...on, r.name]);
          }
          say('Saved.');
          setEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={stop ? `${removing?.name} can’t be deleted yet` : `Delete ${removing?.name}?`}
        confirm={stop ? 'OK' : 'Delete'}
        danger={!stop}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing!;
          if (stop) return setRemoving(null);
          change('Sales regions', `Deleted ${r.name}; ${usersIn(r.name)} users left with no sales region`, (c) => ({
            ...c,
            regions: c.regions.filter((x) => x.name !== r.name),
            users: c.users.map((u) => (u.regions.includes(r.name) ? { ...u, regions: u.regions.filter((x) => x !== r.name), region: u.regions.filter((x) => x !== r.name).join(', ') } : u)),
          }));
          say('Sales region deleted.');
          setRemoving(null);
        }}
      >
        {stop ? (
          <p>
            A region can be deleted only once no RP, branch or open application is in it. {removing?.name} has {blocked!.rps} {blocked!.rps === 1 ? 'RP' : 'RPs'} and {blocked!.apps} open {blocked!.apps === 1 ? 'application' : 'applications'}.
          </p>
        ) : (
          <p>{removing && (usersIn(removing.name) ? `Its ${usersIn(removing.name)} users are left with no sales region until you give them one; users without a region see no records (only Admin sees every region).` : 'Nobody is in it.')}</p>
        )}
      </ConfirmDialog>
    </>
  );
}

/** Add or edit a sales region (PRD slice 1, A sales region). System regions keep their name and countries. */
function RegionDialog({ open, region, regions, contacts, bdms, queues, onClose, onSave }: { open: boolean; region: RegionRow | null; regions: Region[]; contacts: string[]; bdms: string[]; queues: string[]; onClose: () => void; onSave: (r: RegionRow) => void }) {
  const blank: RegionRow = { name: '', contact: '', countries: [], bdm: '', queue: '' };
  const [v, setV] = useState<RegionRow>(blank);
  const [result, setResult] = useState<SaveResult | null>(null);
  const system = !!region && isSystemRegion(region.name);
  const name = v.name.trim();
  // a country sits in only one region: one in another region shows "(in <region>)" and can't be picked
  const elsewhere = useMemo(() => {
    const m = new Map<string, string>();
    regions.filter((r) => r.name !== region?.name).forEach((r) => r.countries.forEach((c) => m.set(c, r.name)));
    return m;
  }, [regions, region?.name]);
  const c = useCheck({
    name: system ? null : name.length < 2 || name.length > 60 ? 'Enter the region’s name.' : regions.some((r) => r.name !== region?.name && r.name.toLowerCase() === name.toLowerCase()) ? `There’s already a region called ${name}.` : null,
    countries: system || v.countries.length ? null : 'Pick at least one country.',
    contact: !v.contact ? 'Pick the admissions contact.' : null,
    bdm: !v.bdm ? 'Pick the default recruitment contact.' : null,
    queue: !v.queue ? 'Pick the Admissions queue.' : null,
  });
  useEffect(() => {
    if (!open) return;
    setV(region ?? blank);
    setResult(null);
    c.reset();
  }, [open, region?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(v) !== JSON.stringify(region ?? blank);
  const save = () => {
    if (!c.submit()) return;
    const r = trySave();
    if (r !== 'ok') return setResult(r);
    onSave({ ...v, name: system ? region!.name : name });
  };
  // a country already in another sales region isn't offered (Jovial, 2 Nov)
  const options = COUNTRIES.map((x) => x.name).filter((x) => !elsewhere.has(x) || v.countries.includes(x));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      what={region ? region.name : 'the new sales region'}
      center
      className="iform cfg__sheet"
      title={region ? `Edit ${region.name}` : 'Add sales region'}
      sub={system ? 'A system region: its name and countries are fixed; its contact, default recruitment contact and queue can change.' : undefined}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!!region && !dirty}>
              {region ? 'Save' : 'Add sales region'}
            </Button>
          </div>
        </div>
      }
    >
      <SaveBanner result={result} onReload={onClose} />
      <div className="cfg__form">
        <Field id="rg-name" label="Name" required error={c.err('name')}>
          <TextInput id="rg-name" value={v.name} maxLength={60} disabled={system} placeholder="Like: Middle East" invalid={!!c.err('name')} onBlur={c.blur('name')} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        {system ? (
          <div className="field">
            <span className="field__label">Countries</span>
            <p className="cfg__muted">{REGION_MEANS[region!.name]}</p>
          </div>
        ) : (
          <Field id="rg-countries" label="Countries" required error={c.err('countries')} hint="A country sits in only one region: countries already in another region aren’t listed.">
            <MultiPick
              id="rg-countries"
              label="Countries"
              value={v.countries}
              options={options}
              invalid={!!c.err('countries')}
              onClose={c.blur('countries')}
              empty="Pick its countries"
              search
              onChange={(l) => setV({ ...v, countries: l })}
            />
          </Field>
        )}
        <Field id="rg-contact" label="Admissions contact" required error={c.err('contact')} hint="Active Admission or Global Ops users.">
          <Pick id="rg-contact" label="Admissions contact" value={v.contact} placeholder="Pick the admissions contact" options={[...new Set([...contacts, v.contact].filter(Boolean))]} invalid={!!c.err('contact')} onChange={(x) => (setV({ ...v, contact: x }), c.blur('contact')())} />
        </Field>
        <Field id="rg-bdm" label="Default recruitment contact" required error={c.err('bdm')} hint="Active Recruitment users.">
          <Pick id="rg-bdm" label="Default recruitment contact" value={v.bdm} placeholder="Pick the default recruitment contact" options={[...new Set([...bdms, v.bdm].filter(Boolean))]} invalid={!!c.err('bdm')} onChange={(x) => (setV({ ...v, bdm: x }), c.blur('bdm')())} />
        </Field>
        <Field id="rg-queue" label="Admissions queue" required error={c.err('queue')} hint="From Admin › Work › Queues, SLA and escalation, the only queue editor. If the queue is deleted, the region falls back to Global Admissions.">
          <Pick id="rg-queue" label="Admissions queue" value={v.queue} placeholder="Pick the Admissions queue" options={queues} invalid={!!c.err('queue')} onChange={(x) => (setV({ ...v, queue: x }), c.blur('queue')())} />
        </Field>
      </div>
    </Sheet>
  );
}

/**
 * Nationality map (PRD slice 1): one row per nationality, shown as the nationality word, and its sales region.
 * Routing rule 5 reads it; a nationality with no row falls to rule 6, Fallback. Read only until Edit map; Save
 * writes settings.changed. Changes affect only applications that reach Pre-screening afterwards.
 */
function NationalityMap({ cfg, change, say, canEdit }: ConfigProps) {
  const d = useDraft({ map: cfg.nationality, at: cfg.nationalityChanged }, 'the nationality map');
  const [q, setQ] = useState('');
  const [add, setAdd] = useState({ country: '', region: '' });
  const [tried, setTried] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const map = d.value.map;
  const names = cfg.regions.filter((r) => r.name !== 'Global').map((r) => r.name);
  const t = q.trim().toLowerCase();
  const rows = Object.entries(map)
    .filter(([k, x]) => !t || k.toLowerCase().includes(t) || nationalityWord(k).toLowerCase().includes(t) || x.toLowerCase().includes(t))
    .sort(([a], [b]) => nationalityWord(a).localeCompare(nationalityWord(b)));
  const free = COUNTRIES.map((x) => x.name).filter((x) => !(x in map));
  const save = () => {
    const r = trySave();
    if (r !== 'ok') return setResult(r);
    const was = cfg.nationality;
    const changed = [...new Set([...Object.keys(was), ...Object.keys(map)])].filter((k) => was[k] !== map[k]).map((k) => `${nationalityWord(k)} ${was[k] ?? 'none'} → ${map[k] ?? 'none'}`);
    change('Sales regions', `Nationality map: ${changed.join('; ') || 'no changes'}`, (c) => ({ ...c, nationality: map, nationalityChanged: d.value.at }));
    say('Saved.');
    setResult(null);
    d.stop();
  };
  const addErr = tried && !add.region ? 'Pick a sales region.' : null;
  return (
    <Panel
      flush
      title="Nationality map"
      note={`${Object.keys(map).length} nationalities mapped. Routing rule 5 (Student’s nationality) reads it; a nationality with no row falls to rule 6, Fallback. Only a student’s nationality reads it: an RP’s and a branch’s region come from each region’s countries.`}
      action={canEdit && <EditBar editing={d.editing} dirty={d.dirty} label="Edit map" name="the nationality map" onEdit={d.start} onCancel={() => (setResult(null), d.stop())} onSave={save} />}
    >
      {d.editing && <SaveBanner result={result} onReload={d.stop} />}
      <div className="stools">
        <div className="stools__row">
          <TextInput id="nm-q" aria-label="Search nationalities" placeholder="Search a nationality or region" value={q} onChange={(e) => setQ(e.target.value)} />
          {d.editing && (
            <>
              <Pick id="nm-add-c" label="Nationality to add" value={add.country} placeholder="Nationality to add" options={free.map((x) => [x, nationalityWord(x)] as [string, string])} onChange={(x) => setAdd({ ...add, country: x })} />
              <Pick id="nm-add-r" label="Its sales region" value={add.region} placeholder="Sales region" options={names} invalid={!!addErr} onChange={(x) => setAdd({ ...add, region: x })} />
              <Button
                variant="secondary"
                disabled={!add.country}
                onClick={() => {
                  setTried(true);
                  if (!add.region) return;
                  d.set((m) => ({ map: { ...m.map, [add.country]: add.region }, at: { ...m.at, [add.country]: Date.now() } }));
                  setAdd({ country: '', region: '' });
                  setTried(false);
                }}
              >
                Add
              </Button>
            </>
          )}
        </div>
        {addErr && (
          <p className="field__msg field__msg--error" role="alert">
            {addErr}
          </p>
        )}
      </div>
      {!Object.keys(map).length ? (
        <Empty>No nationalities mapped yet. Every application falls to rule 6, Fallback.</Empty>
      ) : (
        <div className="stab-wrap cfg__scroll">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Nationality</th>
                <th scope="col">Sales region</th>
                {d.editing && (
                  <th scope="col">
                    <span className="vh">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, x]) => (
                <tr key={k}>
                  <td className="cfg__strong">
                    {nationalityWord(k)}
                    <span className="cfg__sub">{k}</span>
                  </td>
                  <td>
                    {d.editing ? (
                      <Pick id={`nm-${k}`} label={`${nationalityWord(k)}: sales region`} value={x} options={[...new Set([...names, x])]} onChange={(val) => d.set((m) => ({ map: { ...m.map, [k]: val }, at: { ...m.at, [k]: Date.now() } }))} />
                    ) : (
                      x
                    )}
                  </td>
                  {d.editing && (
                    <td className="cfg__acts">
                      <Button
                        variant="link"
                        aria-label={`Remove ${nationalityWord(k)}`}
                        onClick={() =>
                          d.set((m) => {
                            const next = { ...m.map };
                            delete next[k];
                            return { ...m, map: next };
                          })
                        }
                      >
                        Remove
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const GROUPS: [string, number, number][] = [
  ['Students and applications', 0, 6],
  ['Recruitment partners', 6, 11],
  ['Institutions and courses', 11, 20],
  ['Commissions', 20, 25],
  ['GSP', 25, 29],
  ['Work', 29, 33],
];
const LEVEL_NAME = Object.fromEntries(LEVELS) as Record<Level, string>;

/**
 * Permission roles (PRD slice 1, Permission model): the matrix, 33 objects × the 9 GSP roles, each cell No access
 * (—), View or View + edit (Edit). Read only until Edit; Save or Cancel. Admin always has Edit on everything and
 * can't be lowered. Each changed cell is logged old → new and applies from each person's next request. RP roles
 * aren't here: they're fixed by role. Sales region isolation still applies: only Admin sees every region.
 */
export function Permissions({ cfg, change, say, canEdit }: ConfigProps) {
  const d = useDraft(cfg.perms, 'the permission matrix');
  const [result, setResult] = useState<SaveResult | null>(null);
  const v = d.value;
  const save = () => {
    const r = trySave();
    if (r !== 'ok') return setResult(r);
    const diffs: string[] = [];
    for (const o of OBJECTS) for (const role of ROLES) if (role !== 'Admin' && (cfg.perms[o]?.[role] ?? 'N') !== (v[o]?.[role] ?? 'N')) diffs.push(`${role}, ${o}: ${LEVEL_NAME[cfg.perms[o]?.[role] ?? 'N']} → ${LEVEL_NAME[v[o]?.[role] ?? 'N']}`);
    change('Permission roles', diffs.join('; ') || 'No changes', (c) => ({ ...c, perms: v }));
    say('Saved.');
    setResult(null);
    d.stop();
  };
  const cell = (o: string, role: string): Level => (role === 'Admin' ? 'E' : ((v[o]?.[role] ?? 'N') as Level));
  return (
    <>
      <PageHead title="Permission roles" lead="What each GSP role can see and change: No access (—), View, or View + edit (Edit). A page whose objects are all No access isn’t in that role’s menu. Admin always has Edit on everything. Sales region isolation still applies: only Admin sees every region, every other role sees the sales regions on the person. The RP’s roles are fixed by role.">
        {canEdit && <EditBar name="the permission matrix" editing={d.editing} dirty={d.dirty} onEdit={d.start} onCancel={() => (setResult(null), d.stop())} onSave={save} />}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      {d.editing && <SaveBanner result={result} onReload={d.stop} />}
      <Loaded page="the permission matrix" cols={10}>
        <Panel flush>
          <div className="stab-wrap cfg__matrixwrap">
            <table className="itab cfg__tab cfg__matrix">
              <thead>
                <tr>
                  <th scope="col">Object</th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col" className="cfg__lvl">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              {GROUPS.map(([g, a, b]) => (
                <tbody key={g}>
                  <tr className="cfg__grouprow">
                    <th scope="rowgroup" colSpan={ROLES.length + 1}>
                      {g}
                    </th>
                  </tr>
                  {OBJECTS.slice(a, b).map((o) => (
                    <tr key={o}>
                      <th scope="row" className="cfg__strong">
                        {o}
                      </th>
                      {ROLES.map((role) => {
                        const l = cell(o, role);
                        return (
                          <td key={role} className="cfg__lvl">
                            {d.editing && role !== 'Admin' ? (
                              <span className="cfg__segment" role="group" aria-label={`${role}, ${o}`}>
                                {LEVELS.map(([k, label]) => (
                                  <button key={k} type="button" aria-pressed={l === k} aria-label={label} onClick={() => d.set((p) => ({ ...p, [o]: { ...p[o], [role]: k } }))}>
                                    {LEVEL_SHORT[k]}
                                  </button>
                                ))}
                              </span>
                            ) : (
                              <span className={`cfg__lv cfg__lv--${l}`} title={LEVEL_NAME[l]}>
                                {LEVEL_SHORT[l]}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="cfg__legend">
            <span>— No access: not in lists, search, counts, exports or menus; a direct link shows “You don’t have access”.</span>
            <span>View: open, list, filter, and export where the page has an export (each export is logged).</span>
            <span>Edit (View + edit): also create, change and delete, where the object allows each. A page’s own rules still apply.</span>
            <span>Admin is fixed at Edit.</span>
          </p>
        </Panel>
      </Loaded>
      <History log={cfg.log} area="Permission roles" />
    </>
  );
}
