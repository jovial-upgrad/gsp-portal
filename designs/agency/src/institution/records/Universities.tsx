import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, TextInput } from '../../components/forms';
import { DESTINATIONS, FLAG, type Destination } from '../../data/courses';
import { UniMark } from '../courses/parts';
import { UNI_STATUSES, UNI_TYPES, coursesOf, newUniRec, searchable, type UniRec, type UniStatus, type UniType } from '../data/catalogue';
import { isClosed, type InstitutionPartner } from '../data/records';
import { audit } from '../data/changelog';
import { Empty, Gone, NoMatch, PageHead, Pick, Tiles, usePager, useRecord } from './parts';
import { SearchPick } from './SearchPick';
import { UNI_TONE, UniPill } from './pills';
import { UniversityPage } from './UniversityPage';
import { QsImport } from './QsImport';
import { OBJ, canEdit, type PageProps } from '../portal/model';

const SUB: Record<UniStatus, string> = { Live: 'In course search', 'Setting up': 'Not live yet', Paused: 'Out of search for now', Ended: 'Its partnership ended' };

/**
 * Universities (slice 2 PRD): tiles Live, Setting up, Paused, Ended (a tile filters; again clears); search by
 * university, partner or city; filters Country, Institution partner, Status; sorted by name, 25 a page. Add a
 * university and Update QS rankings (a CSV for every university at once, S2C-17) show to Institution, IP Ops and
 * Admin (matrix: Universities); every other role views. An unranked university shows "—".
 */
export function Universities(props: PageProps & { appsByUni?: Record<string, number> }) {
  const { db, set, focus, navKey, open, say, scrollTop, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const edit = canEdit(props, OBJ.unis);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [ip, setIp] = useState('');
  const [status, setStatus] = useState<UniStatus | ''>('');
  const [adding, setAdding] = useState(false);
  const [ranking, setRanking] = useState(false);

  const unis = useMemo(() => [...db.unis].sort((a, b) => a.name.localeCompare(b.name)), [db.unis]);
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
  const { page, pager } = usePager(rows, [q, country, ip, status]);
  const clear = () => {
    setQ('');
    setCountry('');
    setIp('');
    setStatus('');
  };

  if (cur) {
    const shown = db.unis.find((u) => u.id === cur.id);
    if (!shown) return <Gone back={cur.back?.label ?? 'Universities'} onBack={back} />;
    return <UniversityPage key={shown.id} u={shown} tab={cur.tab} backLabel={cur.back?.label ?? 'Universities'} onBack={back} {...props} />;
  }

  return (
    <div className="ipage">
      <PageHead title="Universities" lead="Each university sits under one institution partner and goes live on its own. Course search shows the live ones.">
        {(edit || canEdit(props, OBJ.qs)) && (
          <>
            {/* every university's QS rank in one go (S2C-17): its own row in Permission roles (6 Nov) */}
            {canEdit(props, OBJ.qs) && (
              <Button variant="secondary" iconLeft={<Icon name="upload" size={18} />} onClick={() => setRanking(true)}>
                Update QS rankings
              </Button>
            )}
            {edit && (
            <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding(true)}>
              Add a university
            </Button>
            )}
          </>
        )}
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
            <Pick id="iuni-country" label="Country" value={country} all="All countries" options={[...new Set(db.unis.map((u) => u.country))].sort()} onChange={setCountry} />
            <Pick id="iuni-ip" label="Institution partner" value={ip} all="All partners" options={db.ips.filter((p) => unis.some((u) => u.ip === p.id)).map((p) => ({ value: p.id, label: p.name }))} onChange={setIp} />
            <Pick id="iuni-status" label="Status" value={status} all="All statuses" options={UNI_STATUSES} onChange={(v) => setStatus(v as UniStatus | '')} />
          </div>
          <p className="stools__count" id="iuni-count" role="status">
            <span>
              <span className="num">{rows.length === unis.length ? unis.length : `${rows.length} of ${unis.length}`}</span> {unis.length === 1 ? 'university' : 'universities'}
            </span>
          </p>
        </div>
        {unis.length === 0 ? (
          <Empty text="No universities yet." action={edit ? 'Add a university.' : undefined} onAction={() => setAdding(true)} />
        ) : rows.length === 0 ? (
          <NoMatch onClear={clear} />
        ) : (
          <div className="stab-wrap">
            <table className="itab itab--uni">
              <thead>
                <tr>
                  <th scope="col">University</th>
                  <th scope="col">Institution partner</th>
                  <th scope="col">Campuses</th>
                  <th scope="col">Courses</th>
                  <th scope="col">QS rank</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {page.map((u) => {
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
                        {p?.name ?? <span className="muted">Not set</span>}
                        {p && <span className="irow__sub">{p.type}</span>}
                      </td>
                      <td className="num">{u.campuses.length - u.inactive.length}</td>
                      <td>
                        <span className="num">{live}</span> live · <span className="num">{all}</span> in all
                      </td>
                      {/* unranked: "—" (S2C-17) */}
                      <td className="num">{u.qs ? `#${u.qs}` : '—'}</td>
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
        {pager}
      </section>

      <QsImport
        open={ranking}
        unis={db.unis}
        me={me}
        role={props.role ?? 'Institution'}
        onClose={() => setRanking(false)}
        onApply={(next) => {
          set((d) => ({ ...d, unis: next }));
          say('QS rankings updated.');
        }}
      />

      <AddUniversity
        open={adding}
        ips={db.ips}
        me={me}
        role={props.role ?? 'Institution'}
        taken={(n) => db.unis.some((u) => u.name.toLowerCase() === n.trim().toLowerCase())}
        onCancel={() => setAdding(false)}
        onAdd={(u) => {
          set((d) => ({ ...d, unis: [u, ...d.unis] }));
          audit('Universities', `University created: ${u.name}, Setting up`, me, props.role ?? 'Institution');
          setAdding(false);
          clear();
          show(u.id);
          say(`${u.name} added as Setting up. Fill in its profile with Edit profile.`);
        }}
      />
    </div>
  );
}

type Draft = { ip: string; name: string; utype: UniType | ''; country: Destination | '' };

/**
 * Add a university (slice 2 PRD): only the basics: name, its institution partner (found by search; any partner that
 * isn't Closed), university type and country. Everything else is entered on its page; nothing is read automatically
 * from the website. It saves as Setting up and writes "University created" to its Change log.
 */
export function AddUniversity({ open, ips, taken, onCancel, onAdd, me, role }: { open: boolean; ips: InstitutionPartner[]; taken: (n: string) => boolean; onCancel: () => void; onAdd: (u: UniRec) => void; me: string; role: string }) {
  const pool = ips.filter((p) => !isClosed(p.status));
  const blank: Draft = { ip: '', name: '', utype: '', country: '' };
  const [v, setV] = useState<Draft>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(blank);
    setTried(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Draft>) => setV((x) => ({ ...x, ...p }));
  const n = v.name.trim();
  const err = {
    ip: !v.ip ? 'Pick an institution partner.' : null,
    name: !n ? 'Enter the name.' : n.length < 2 ? 'Use 2 to 120 characters.' : taken(n) ? 'Another university has this name.' : null,
    utype: !v.utype ? 'Pick a type.' : null,
    country: !v.country ? 'Pick a country.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform"
      title="Add a university"
      sub="Only the basics. Everything else is entered on its page; nothing is read from the website."
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
                onAdd(newUniRec({ name: n, utype: v.utype as UniType, country: v.country as Destination, ip: v.ip, by: me, role }));
              }}
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="iu-name" label="Name" required error={show('name')} className="iform__wide">
          <TextInput id="iu-name" value={v.name} maxLength={120} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} placeholder="Like: University of Melbourne" />
        </Field>
        <Field id="iu-ip" label="Institution partner" required error={show('ip')} className="iform__wide">
          <SearchPick id="iu-ip" label="Institution partners" placeholder="Search partners" value={v.ip} invalid={!!show('ip')} options={pool.map((p) => ({ value: p.id, label: p.name, note: p.type }))} onChange={(id) => set({ ip: id })} />
        </Field>
        <Field id="iu-type" label="Type" required error={show('utype')}>
          <Pick id="iu-type" label="Type" value={v.utype} placeholder="Pick a type" invalid={!!show('utype')} options={UNI_TYPES} onChange={(t) => set({ utype: t as UniType })} />
        </Field>
        <Field id="iu-country" label="Country" required error={show('country')}>
          <Pick id="iu-country" label="Country" value={v.country} placeholder="Pick a country" invalid={!!show('country')} options={DESTINATIONS} onChange={(c) => set({ country: c as Destination })} />
        </Field>
      </div>
    </Sheet>
  );
}

export type { UniRec };
export const liveCourses = (courses: PageProps['db']['courses'], id: string) => coursesOf(courses, id).filter(searchable);
