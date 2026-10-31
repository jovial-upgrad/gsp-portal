import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { DESTINATIONS, FLAG, type Destination } from '../../data/courses';
import { UniMark } from '../courses/parts';
import { UNI_STATUSES, UNI_TYPES, coursesOf, newUniRec, searchable, type UniRec, type UniStatus, type UniType } from '../data/catalogue';
import { isClosed, type InstitutionPartner } from '../data/records';
import { NoMatch, PageHead, Tiles, useRecord } from './parts';
import { SearchPick } from './SearchPick';
import { UNI_TONE, UniPill } from './pills';
import { UniversityPage } from './UniversityPage';
import type { PageProps } from '../portal/model';

const SUB: Record<UniStatus, string> = { Live: 'In Course search', 'Setting up': 'Not live yet', Paused: 'Out of search for now', Ended: 'No longer with GSP' };

/**
 * Universities (29 Oct; 2nd round from the PM prototype's IP team): every university GSP recruits for. Each sits
 * under one institution partner and goes live on its own: set up, then live (in Course search), paused or ended.
 * The team keeps each one's profile, campuses, courses, scholarships, territory, how applications are sent, and the
 * changes the university sends. 29 Oct (4th round): nothing is automated and there's no four-weekly check; a
 * university is added with its basics and the rest is entered on its page.
 */
export function Universities(props: PageProps & { appsByUni?: Record<string, number> }) {
  const { db, set, focus, navKey, open, say, scrollTop } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [ip, setIp] = useState('');
  const [status, setStatus] = useState<UniStatus | ''>('');
  const [adding, setAdding] = useState(false);

  const unis = db.unis;
  const ipOf = useMemo(() => new Map(db.ips.map((p) => [p.id, p])), [db.ips]);
  const counts = useMemo(() => {
    const m = new Map<string, [number, number]>();
    db.courses.forEach((c) => {
      const x = m.get(c.uni.id) ?? [0, 0];
      m.set(c.uni.id, [x[0] + (searchable(c) ? 1 : 0), x[1] + 1]);
    });
    return m;
  }, [db.courses]);
  const rows = unis.filter((u) => {
    const t = q.trim().toLowerCase();
    if (t && ![u.name, ...(u.aka ?? []), ...u.campuses.map((c) => c.city), ipOf.get(u.ip)?.name ?? ''].some((x) => x.toLowerCase().includes(t))) return false;
    if (country && u.country !== country) return false;
    if (ip && u.ip !== ip) return false;
    if (status && u.status !== status) return false;
    return true;
  });
  const clear = () => {
    setQ('');
    setCountry('');
    setIp('');
    setStatus('');
  };

  const shown = cur ? unis.find((u) => u.id === cur.id) : undefined;
  if (cur && shown) return <UniversityPage key={shown.id} u={shown} tab={cur.tab} backLabel={cur.back?.label ?? 'Universities'} onBack={back} {...props} />;

  return (
    <div className="ipage">
      <PageHead title="Universities" lead="Each university sits under one institution partner and goes live on its own. Course search shows the live ones.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding(true)}>
          Add a university
        </Button>
      </PageHead>

      <Tiles label="Where each university is" value={status} onPick={setStatus} items={UNI_STATUSES.map((s) => ({ key: s, label: s, sub: SUB[s], tone: UNI_TONE[s], n: unis.filter((u) => u.status === s).length }))} />

      <section className="card stable" aria-labelledby="iuni-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search universities</span>
              <input id="iuni-q" type="search" placeholder="University, partner or city" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <SelectInput id="iuni-country" aria-label="Country" value={country} placeholder="All countries" allowEmpty onChange={(e) => setCountry(e.target.value)}>
              {DESTINATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="iuni-ip" aria-label="Institution partner" value={ip} placeholder="All partners" allowEmpty onChange={(e) => setIp(e.target.value)}>
              {db.ips
                .filter((p) => unis.some((u) => u.ip === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </SelectInput>
          </div>
          <p className="stools__count" id="iuni-count" role="status">
            <span>
              <span className="num">{rows.length === unis.length ? unis.length : `${rows.length} of ${unis.length}`}</span> {unis.length === 1 ? 'university' : 'universities'}
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <NoMatch what="universities" onClear={clear} />
        ) : (
          <div className="stab-wrap">
            <table className="itab itab--uni">
              <thead>
                <tr>
                  <th scope="col">University</th>
                  <th scope="col">Institution partner</th>
                  <th scope="col">Campuses</th>
                  <th scope="col">Courses</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const p = ipOf.get(u.ip);
                  const [live, all] = counts.get(u.id) ?? [0, 0];
                  return (
                    <tr key={u.id} className="irow" onClick={() => show(u.id)}>
                      <td>
                        <span className="irow__lead">
                          <UniMark u={u} />
                          <span>
                            <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(u.id))}>
                              {u.name}
                            </button>
                            <span className="irow__sub">
                              {u.utype} · <span aria-hidden="true">{FLAG[u.country]}</span> {u.country}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {p?.name ?? <span className="muted">Not picked yet</span>}
                        {p && <span className="irow__sub">{p.type}</span>}
                      </td>
                      <td>
                        <span className="num">{u.campuses.length - u.inactive.length}</span>
                        {u.inactive.length > 0 && <span className="irow__sub">{u.inactive.length} inactive</span>}
                      </td>
                      <td>
                        <span className="num">{live}</span> live
                        {all > live && <span className="irow__sub">{all} in all</span>}
                      </td>
                      <td>
                        <UniPill s={u.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AddUniversity
        open={adding}
        ips={db.ips}
        taken={(n) => unis.some((u) => u.name.toLowerCase() === n.trim().toLowerCase())}
        onCancel={() => setAdding(false)}
        onAdd={(u) => {
          set((d) => ({ ...d, unis: [u, ...d.unis] }));
          setAdding(false);
          clear();
          show(u.id);
          say(`${u.name} added. Fill in its details, campuses and courses, then go live.`);
        }}
      />
    </div>
  );
}

type Draft = { ip: string; name: string; utype: UniType | ''; country: Destination | ''; website: string };

/**
 * Adding a university (29 Oct, 4th round): its basic details only, the partner found by searching (direct partners
 * too, and a direct partner can have several). It starts as Setting up, out of Course search; its campuses, courses
 * and everything else are entered on its page.
 */
export function AddUniversity({ open, ips, taken, onCancel, onAdd }: { open: boolean; ips: InstitutionPartner[]; taken: (n: string) => boolean; onCancel: () => void; onAdd: (u: UniRec) => void }) {
  const pool = ips.filter((p) => !isClosed(p.status));
  const blank: Draft = { ip: '', name: '', utype: '', country: '', website: '' };
  const [v, setV] = useState<Draft>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(blank);
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Draft>) => setV((x) => ({ ...x, ...p }));
  const err = {
    ip: !v.ip ? 'Pick its institution partner.' : null,
    name: !v.name.trim() ? 'Enter the university’s name.' : taken(v.name) ? 'That university is already here.' : null,
    utype: !v.utype ? 'Pick the type.' : null,
    country: !v.country ? 'Pick the country.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Add a university"
      sub="Its basic details. Everything else is entered on its page."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (Object.values(err).some(Boolean)) return;
                onAdd(newUniRec({ name: v.name.trim(), utype: v.utype as UniType, country: v.country as Destination, website: v.website.trim().replace(/^https?:\/\//, ''), ip: v.ip }));
              }}
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="iu-ip" label="Institution partner" required error={show('ip')} className="iform__wide">
          <SearchPick
            id="iu-ip"
            label="Institution partners"
            placeholder="Search partners"
            value={v.ip}
            invalid={!!show('ip')}
            options={pool.map((p) => ({ value: p.id, label: p.name, note: p.type }))}
            onChange={(id) => set({ ip: id, country: v.country || ((ips.find((x) => x.id === id)?.country as Destination) ?? '') })}
          />
        </Field>
        <Field id="iu-name" label="University name" required error={show('name')} className="iform__wide">
          <TextInput id="iu-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} placeholder="Like: University of Melbourne" />
        </Field>
        <Field id="iu-type" label="University type" required error={show('utype')}>
          <SelectInput id="iu-type" value={v.utype} placeholder="Pick a type" invalid={!!show('utype')} onChange={(e) => set({ utype: e.target.value as UniType })}>
            {UNI_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="iu-country" label="Country" required error={show('country')}>
          <SelectInput id="iu-country" value={v.country} placeholder="Pick a country" invalid={!!show('country')} onChange={(e) => set({ country: e.target.value as Destination })}>
            {DESTINATIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="iu-web" label="Website" optional className="iform__wide">
          <TextInput id="iu-web" value={v.website} onChange={(e) => set({ website: e.target.value })} placeholder="Like: unimelb.edu.au" />
        </Field>
      </div>
    </Sheet>
  );
}

export type { UniRec };
export const liveCourses = (courses: PageProps['db']['courses'], id: string) => coursesOf(courses, id).filter(searchable);
