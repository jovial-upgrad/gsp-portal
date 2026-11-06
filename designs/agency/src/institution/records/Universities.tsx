import { useEffect, useMemo, useState } from 'react';
import { EditOnly, useHides } from '../../proto/viewOnly';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, SelectInput, TextInput } from '../../components/forms';
import { DESTINATIONS, FLAG, type Destination } from '../../data/courses';
import { UniMark } from '../courses/parts';
import { UNI_STATUSES, UNI_TYPES, coursesOf, newUniRec, searchable, type UniRec, type UniStatus, type UniType } from '../data/catalogue';
import { isClosed, logLine, stampBy, type InstitutionPartner } from '../data/records';
import { Filter, NoMatch, PageHead, Pager, Tiles, passes, usePaged, useRecord } from './parts';
import { CsvImport, same, type CsvRead } from './CsvImport';
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
 * university is added with its basics and the rest is entered on its page. 4 Nov: the filters pick several; 20 a
 * page; Update QS ranking has no line under its title, and a file it can't read says "Invalid format, upload again."
 */
export function Universities(props: PageProps & { appsByUni?: Record<string, number> }) {
  const { db, set, focus, navKey, open, say, scrollTop, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const [ranking, setRanking] = useState(false);
  // GSP · Finance and Global Ops (6 Nov): no Update QS ranking; Global Ops: the list to look at (no Add a university)
  const qsUpdate = useHides('uni.qs-update');
  const qsAll = useHides('uni.qs');
  const noQsUpdate = qsUpdate || qsAll;
  const noAdd = useHides('uni.add');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState<string[]>([]);
  const [ip, setIp] = useState<string[]>([]);
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
    if (!passes(country, u.country) || !passes(ip, u.ip)) return false;
    if (status && u.status !== status) return false;
    return true;
  });
  const pg = usePaged(rows, [q, country, ip, status]);
  const clear = () => {
    setQ('');
    setCountry([]);
    setIp([]);
    setStatus('');
  };
  const partners = db.ips.filter((p) => unis.some((u) => u.ip === p.id));
  const ipName = (id: string) => ipOf.get(id)?.name ?? id;

  const shown = cur ? unis.find((u) => u.id === cur.id) : undefined;
  if (cur && shown) return <UniversityPage key={shown.id} u={shown} tab={cur.tab} backLabel={cur.back?.label ?? 'Universities'} onBack={back} {...props} />;

  return (
    <div className="ipage">
      <PageHead title="Universities" lead="Each university sits under one institution partner and goes live on its own.">
        {!noQsUpdate && <EditOnly>
          <Button variant="secondary" iconLeft={<Icon name="upload" size={18} />} onClick={() => setRanking(true)}>
            Update QS ranking
          </Button>
        </EditOnly>}
        {!noAdd && <EditOnly>
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAdding(true)}>
            Add a university
          </Button>
        </EditOnly>}
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
            <Filter id="iuni-country" label="Country" all="All countries" value={country} options={DESTINATIONS} onChange={setCountry} />
            <Filter id="iuni-ip" label="Institution partner" all="All partners" value={ip} options={partners.map((p) => p.id)} onChange={setIp} labels={ipName} search />
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
                {pg.rows.map((u) => {
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
                              {u.state && ` · ${u.state}`}
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
        <Pager pg={pg} what="universities" />
      </section>

      <CsvImport
        open={ranking}
        title="Update QS ranking"
        template={{ name: 'qs-world-ranking-template.csv', rows: [['University', 'Country', 'QS world ranking'], ...unis.map((u) => [u.name, u.country, u.qs ?? ''])] }}
        columns={
          <p className="icsv__note">
            One row for each university, with its rank as a whole number. Leave the rank empty for a university QS doesn’t rank. The template lists every university with its rank today.
          </p>
        }
        read={(rows) => readRanks(rows, unis)}
        saveLabel={(n) => `Update ${n} ${n === 1 ? 'ranking' : 'rankings'}`}
        readyText={(n) => `${n} ${n === 1 ? 'ranking changes' : 'rankings change'}.`}
        onCancel={() => setRanking(false)}
        onSave={(list) => {
          const m = new Map(list.map((r) => [r.id, r.qs]));
          set((d) => ({
            ...d,
            unis: d.unis.map((u) => {
              if (!m.has(u.id)) return u;
              const qs = m.get(u.id);
              const what = `QS world ranking ${u.qs ? `changed from ${u.qs} to ${qs ?? 'not ranked'}` : `set to ${qs}`} (CSV upload)`;
              return { ...u, qs, stamps: { ...u.stamps, profile: stampBy(me) }, log: [logLine(me, 'profile', what), ...u.log] };
            }),
          }));
          setRanking(false);
          say(`QS world ranking updated for ${list.length} ${list.length === 1 ? 'university' : 'universities'}.`);
        }}
      />

      <AddUniversity
        open={adding}
        ips={db.ips}
        taken={(n) => unis.some((u) => u.name.toLowerCase() === n.trim().toLowerCase())}
        me={me}
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

/** Reads the QS ranking CSV: each row's university by name (or another name it goes by), and its rank. */
function readRanks(rows: string[][], unis: UniRec[]): CsvRead<{ id: string; qs: number | undefined }> {
  const head = rows[0].map((h) => h.toLowerCase());
  const nameAt = head.findIndex((h) => h.includes('university'));
  const at = head.findIndex((h) => h.includes('rank'));
  // not the template's headings: the file can't be read
  if (nameAt < 0 || at < 0) return { ok: [], problems: [], bad: true };
  const ok: { id: string; qs: number | undefined }[] = [];
  const problems: string[] = [];
  let unchanged = 0;
  rows.slice(1).forEach((r, i) => {
    const row = i + 2;
    const name = r[nameAt] ?? '';
    const u = unis.find((x) => same(x.name, name) || (x.aka ?? []).some((a) => same(a, name)));
    if (!u) return problems.push(`Row ${row}: no university called “${name || 'nothing'}”.`);
    const raw = (r[at] ?? '').replace(/[#=,\s]/g, '');
    const qs = raw === '' ? undefined : Number(raw);
    if (qs !== undefined && !(Number.isInteger(qs) && qs > 0 && qs <= 2000)) return problems.push(`Row ${row}: ${u.name}’s rank “${r[at]}” isn’t a whole number from 1 to 2000.`);
    if (ok.some((x) => x.id === u.id)) return problems.push(`Row ${row}: ${u.name} is in the file twice; the first row counts.`);
    if (qs === u.qs) return void unchanged++;
    ok.push({ id: u.id, qs });
  });
  return { ok, same: unchanged, problems };
}

type Draft = { ip: string; name: string; utype: UniType | ''; country: Destination | ''; website: string };

/**
 * Adding a university (29 Oct, 4th round): its basic details only, the partner found by searching (direct partners
 * too, and a direct partner can have several). It starts as Setting up, out of Course search; its campuses, courses
 * and everything else are entered on its page.
 */
export function AddUniversity({ open, ips, taken, me, onCancel, onAdd }: { open: boolean; ips: InstitutionPartner[]; taken: (n: string) => boolean; me: string; onCancel: () => void; onAdd: (u: UniRec) => void }) {
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
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <EditOnly>
              <Button
                onClick={() => {
                  setTried(true);
                  if (Object.values(err).some(Boolean)) return;
                  onAdd(newUniRec({ name: v.name.trim(), utype: v.utype as UniType, country: v.country as Destination, website: v.website.trim().replace(/^https?:\/\//, ''), ip: v.ip, by: me }));
                }}
              >
                Save
              </Button>
            </EditOnly>
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
