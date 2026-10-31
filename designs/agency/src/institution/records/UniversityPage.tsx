import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { money } from '../../data/courses';
import { UniMark, campusLabel } from '../courses/parts';
import { COUNTRIES, countryByName } from '../../data/partners';
import { UNI_TYPES, coursesOf, searchable, type CampusRec, type CourseRec, type UniRec, type UniType } from '../data/catalogue';
import { agreementOf, canGoLive, dateText, isClosed, stampBy } from '../data/records';
import { patch } from '../data/store';
import { AddButton, Facts, PAGE, RecordHead, RecordTabs, Section, TabPanel } from './parts';
import { SearchPick } from './SearchPick';
import { CourseForm, blankCourse, newCourse, type CourseDraft } from './CourseForm';
import { CoursePill, PartnerPill, UniPill } from './pills';
import { Territory } from './uni/Territory';
import { Submission } from './uni/Submission';
import { Scholarships } from './uni/Scholarships';
import type { PageProps } from '../portal/model';

type Tab = 'overview' | 'campuses' | 'courses' | 'scholarships' | 'territory' | 'submission';
const TABS: Tab[] = ['overview', 'campuses', 'courses', 'scholarships', 'territory', 'submission'];
export type UniUpd = (fn: (u: UniRec) => UniRec) => void;
const SENT = { 'Own portal': 'applications on its own portal', StudyLink: 'applications through StudyLink', Email: 'applications by email' } as const;

/**
 * A university's page (29 Oct, 2nd round, after the PM prototype's IP team): whether it's live, and what it takes to
 * go live; the institution partner it sits under, picked here (4th round); its profile; campuses; courses (added in
 * place); scholarships; territory rules; and the forms, how applications are sent, logins and who to talk to.
 * Nothing is filled in for the team, and nothing is checked on a timer (4th round). 29 Oct (7th round): the partner
 * changes from its name's edit button; no Changes tab; each part says who last changed it, and when.
 */
export function UniversityPage(props: PageProps & { u: UniRec; tab?: string; backLabel: string; onBack: () => void; appsByUni?: Record<string, number> }) {
  const { u, tab: start, backLabel, onBack, db, set, open, say, me } = props;
  const [tab, setTab] = useState<Tab>(TABS.includes(start as Tab) ? (start as Tab) : 'overview');
  useEffect(() => {
    if (start && TABS.includes(start as Tab)) setTab(start as Tab);
  }, [start]);
  const [pausing, setPausing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<CourseDraft | null>(null);
  // the partner shows by name; its edit button opens the list to pick another
  const [moving, setMoving] = useState(false);
  const [ipTo, setIpTo] = useState(u.ip);
  const p = db.ips.find((x) => x.id === u.ip);
  const a = p ? agreementOf(p) : null;
  const courses = coursesOf(db.courses, u.id);
  const live = courses.filter(searchable);
  const upd: UniUpd = (fn) => set((d) => ({ ...d, unis: patch(d.unis, u.id, fn) }));
  /** Changes one part of the university and says who did, and when. */
  const part =
    (k: string): UniUpd =>
    (fn) =>
      upd((x) => ({ ...fn(x), stamps: { ...x.stamps, [k]: stampBy(me) } }));

  // what going live needs
  const needs: [string, boolean][] = [
    [p ? `Its partner’s agreement is executed and in date (${p.status})` : 'Under an institution partner whose agreement is executed', canGoLive(p)],
    ['At least one active campus', u.campuses.some((c) => !u.inactive.includes(c.name))],
    ['At least one live course', live.length > 0],
    ['How applications are sent', !!u.channel],
  ];
  const ready = needs.every(([, ok]) => ok);
  const setStatus = (status: UniRec['status'], what: string) => {
    part('status')((x) => ({ ...x, status }));
    say(`${u.name}: ${what}.`);
  };

  return (
    <div className="ipage irecord">
      <RecordHead
        back={backLabel}
        onBack={onBack}
        mark={<UniMark u={u} big />}
        title={u.name}
        sub={`${p ? `Under ${p.name} · ${p.type}` : 'No institution partner yet'} · ${u.utype} · ${u.country}${u.channel ? ` · ${SENT[u.channel]}` : ''}`}
        updated={u.stamps.status}
        status={
          <>
            <UniPill s={u.status} />
            <span className="irhead__k num">{live.length === 1 ? '1 live course' : `${live.length} live courses`}</span>
          </>
        }
      >
        {u.status === 'Setting up' ? (
          <div className="igolive">
            <ul className="igolive__list" aria-label="To go live">
              {needs.map(([k, ok]) => (
                <li key={k} className={`igolive__item ${ok ? 'is-done' : ''}`}>
                  <Icon name={ok ? 'checkCircle' : 'clock'} size={16} />
                  {k}
                </li>
              ))}
            </ul>
            <Button size="sm" disabled={!ready} onClick={() => setStatus('Live', 'Went live')}>
              Go live
            </Button>
          </div>
        ) : u.status === 'Live' ? (
          <div className="istatus">
            <p className="istatus__note">In Course search: partners can find and apply to its live courses.</p>
            <Button variant="secondary" size="sm" onClick={() => setPausing(true)}>
              Pause
            </Button>
          </div>
        ) : u.status === 'Paused' ? (
          <div className="istatus">
            <p className="istatus__note">{canGoLive(p) ? 'Paused: out of Course search until it’s resumed. Applications already made carry on.' : 'Paused: its partner’s agreement isn’t in date. Renew it on the partner to resume.'}</p>
            <Button size="sm" disabled={!canGoLive(p)} onClick={() => setStatus('Live', 'Resumed')}>
              Resume
            </Button>
          </div>
        ) : (
          <div className="istatus">
            <p className="istatus__note">Ended with its partner. Applications already made carry on.</p>
          </div>
        )}
      </RecordHead>

      <RecordTabs
        id="iutab"
        label="University"
        tab={tab}
        setTab={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'campuses', label: 'Campuses', n: u.campuses.length },
          { key: 'courses', label: 'Courses', n: courses.length },
          { key: 'scholarships', label: 'Scholarships', n: u.scholarships.length },
          { key: 'territory', label: 'Territory' },
          { key: 'submission', label: 'Submission and contacts' },
        ]}
      />

      <TabPanel id="iutab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section title="Institution partner" id="iu-ip" updated={u.stamps.partner} note={p ? undefined : 'Pick the partner it sits under: it then shows on that partner’s page.'}>
              {moving ? (
                <div className="ipartner">
                  <label className="field__label" htmlFor="iu-pick">
                    Institution partner
                  </label>
                  <div className="ipartner__pick">
                    <SearchPick id="iu-pick" label="Institution partners" placeholder="Search partners" value={ipTo} options={db.ips.filter((x) => !isClosed(x.status) || x.id === u.ip).map((x) => ({ value: x.id, label: x.name, note: x.type }))} onChange={setIpTo} />
                    <Button variant="secondary" size="sm" onClick={() => (setIpTo(u.ip), setMoving(false))}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!ipTo || ipTo === u.ip}
                      onClick={() => {
                        const to = db.ips.find((x) => x.id === ipTo);
                        part('partner')((x) => ({ ...x, ip: ipTo }));
                        setMoving(false);
                        say(`${u.name} is now under ${to?.name}.`);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="ipartner ipartner--name">
                  {p ? (
                    <button type="button" className="btn btn--link ipartner__name" onClick={() => open({ section: 'ips', id: p.id, back: { section: 'universities', id: u.id, label: u.name } })}>
                      {p.name}
                    </button>
                  ) : (
                    <span className="muted">No institution partner yet</span>
                  )}
                  <button type="button" className="icon-btn ipartner__edit" aria-label={p ? 'Change institution partner' : 'Pick an institution partner'} title={p ? 'Change institution partner' : 'Pick an institution partner'} onClick={() => (setIpTo(u.ip), setMoving(true))}>
                    <Icon name="edit" size={18} />
                  </button>
                </div>
              )}
              {p && (
                <Facts
                  items={[
                    ['Type', p.type],
                    ['Relationship manager', p.rm],
                    ['Status', <PartnerPill key="s" p={p} />],
                    ['Agreement', a ? `${dateText(a.start)} to ${dateText(a.end)}` : null],
                  ]}
                />
              )}
            </Section>
            <Section
              title="Profile"
              id="iu-profile"
              updated={u.stamps.profile}
              action={
                <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
              }
            >
              <Facts
                items={[
                  ['Type', u.utype],
                  ['Public or private', u.sector],
                  [
                    'Website',
                    u.website ? (
                      <a href={`https://${u.website}`} target="_blank" rel="noreferrer">
                        {u.website}
                      </a>
                    ) : null,
                  ],
                  ...(u.country === 'Australia' ? ([['CRICOS provider code', u.cricos || null]] as [string, string | null][]) : []),
                  ['Display priority', u.priority ? <span key="dp" className="num">{u.priority}</span> : null],
                  ['Applies through StudyLink', u.studylink ? 'Yes' : 'No'],
                  ['Pathway provider', u.pathway ? 'Yes' : 'No'],
                ]}
              />
            </Section>
          </>
        )}

        {tab === 'campuses' && (
          <Campuses
            u={u}
            upd={part('campuses')}
            say={say}
            counts={courses}
            onSave={(was, k) =>
              // a renamed campus is renamed on its courses and in the inactive list too
              set((d) => ({
                ...d,
                unis: patch(d.unis, u.id, (x) => ({
                  ...x,
                  campuses: was ? x.campuses.map((y) => (y.name === was ? k : y)) : [...x.campuses, k],
                  inactive: was ? x.inactive.map((n) => (n === was ? k.name : n)) : x.inactive,
                  stamps: { ...x.stamps, campuses: stampBy(me) },
                })),
                courses: was ? d.courses.map((c) => (c.uni.id === u.id && c.campus.name === was ? { ...c, campus: k } : c)) : d.courses,
              }))
            }
          />
        )}

        {tab === 'courses' && (
          <UniCourses
            u={u}
            courses={courses}
            onOpen={(id) => open({ section: 'catalogue', id, back: { section: 'universities', id: u.id, tab: 'courses', label: u.name } })}
            onAdd={() => setAdding({ ...blankCourse, uni: u.id })}
          />
        )}

        {tab === 'scholarships' && <Scholarships u={u} upd={part('scholarships')} say={say} updated={u.stamps.scholarships} />}
        {tab === 'territory' && <Territory u={u} rps={db.rps} upd={upd} say={say} me={me} />}
        {tab === 'submission' && <Submission u={u} p={p} part={part} say={say} me={me} />}
      </TabPanel>

      <ConfirmDialog open={pausing} title={`Pause ${u.name}?`} confirm="Pause" onConfirm={() => (setPausing(false), setStatus('Paused', 'Paused'))} onCancel={() => setPausing(false)}>
        <p>Its courses leave Course search until it’s resumed. Applications already made carry on.</p>
      </ConfirmDialog>
      <CourseForm
        f={adding}
        unis={db.unis}
        courses={db.courses}
        lockUni
        onCancel={() => setAdding(null)}
        onSave={(f) => {
          const rec = newCourse(f, db.unis, db.courses);
          set((d) => ({ ...d, courses: [rec, ...d.courses] }));
          setAdding(null);
          say(`${rec.name} saved as a draft. Open it to fill in its intakes, fees, academic and English.`);
        }}
      />
      <EditProfile
        u={editing ? u : null}
        onCancel={() => setEditing(false)}
        onSave={(f) => {
          part('profile')((x) => ({ ...x, ...f }));
          setEditing(false);
          say('Profile saved.');
        }}
      />
    </div>
  );
}

/** The country list's name for a destination. */
const GEO_NAME: Record<string, string> = { UK: 'United Kingdom', USA: 'United States' };
const SETTINGS = ['City centre', 'Suburban', 'Regional town'] as const;
const mapLink = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim());

/**
 * Campuses: making one inactive takes its courses out of Course search. 30 Oct: a campus is added and edited in a
 * pop-up, with its name, country, state, city and Google Maps link (and its setting, if known).
 */
function Campuses({ u, upd, say, counts, onSave }: { u: UniRec; upd: UniUpd; say: (m: string) => void; counts: { campus: { name: string } }[]; onSave: (was: string | null, k: CampusRec) => void }) {
  const [form, setForm] = useState<CampusRec | 'new' | null>(null);
  return (
    <Section title="Campuses" id="iu-campuses" updated={u.stamps.campuses} note="An inactive campus takes its courses out of Course search. Applications already made carry on." action={<AddButton onClick={() => setForm('new')}>Add a campus</AddButton>}>
      {u.campuses.length ? (
        <div className="stab-wrap">
          <table className="itab">
            <thead>
              <tr>
                <th scope="col">Campus</th>
                <th scope="col">City and state</th>
                <th scope="col">Country</th>
                <th scope="col">Map</th>
                <th scope="col">Courses</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="vh">Edit or change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {u.campuses.map((c) => {
                const off = u.inactive.includes(c.name);
                return (
                  <tr key={c.name}>
                    <td>
                      {c.name}
                      {c.setting && <span className="irow__sub">{c.setting}</span>}
                    </td>
                    <td>
                      {c.city}
                      {c.state ? <span className="irow__sub">{c.state}</span> : <span className="irow__sub muted">State not added</span>}
                    </td>
                    <td>{c.country ?? GEO_NAME[u.country] ?? u.country}</td>
                    <td>
                      {c.map ? (
                        <a href={c.map} target="_blank" rel="noreferrer">
                          Open map<span className="vh"> of {c.name}, opens in a new tab</span>
                        </a>
                      ) : (
                        <span className="muted">Not added</span>
                      )}
                    </td>
                    <td className="num">{counts.filter((x) => x.campus.name === c.name).length}</td>
                    <td>{off ? <span className="dpill idpill--grey">Inactive</span> : <span className="dpill dpill--verified">Active</span>}</td>
                    <td>
                      <span className="irowacts">
                        <button type="button" className="btn btn--link" onClick={() => setForm(c)}>
                          Edit<span className="vh"> {c.name}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--link"
                          onClick={() => {
                            upd((x) => ({ ...x, inactive: off ? x.inactive.filter((n) => n !== c.name) : [...x.inactive, c.name] }));
                            say(`${c.name} is ${off ? 'active' : 'inactive'}.`);
                          }}
                        >
                          {off ? 'Make active' : 'Make inactive'}
                          <span className="vh"> {c.name}</span>
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">No campuses yet. Add one: courses are taught at a campus.</p>
      )}
      <CampusForm
        u={u}
        k={form}
        onCancel={() => setForm(null)}
        onSave={(k) => {
          const was = form === 'new' || !form ? null : form.name;
          onSave(was, k);
          say(was ? `${k.name} saved.` : `${campusLabel(k)} added.`);
          setForm(null);
        }}
      />
    </Section>
  );
}

type CampusDraft = { name: string; country: string; state: string; city: string; map: string; setting: string };

/** Add or edit a campus. Every field but the setting is needed. */
function CampusForm({ u, k, onCancel, onSave }: { u: UniRec; k: CampusRec | 'new' | null; onCancel: () => void; onSave: (k: CampusRec) => void }) {
  const home = GEO_NAME[u.country] ?? u.country;
  const blank: CampusDraft = { name: '', country: home, state: '', city: '', map: '', setting: '' };
  const [v, setV] = useState<CampusDraft>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!k) return;
    setV(k === 'new' ? blank : { name: k.name, country: k.country ?? home, state: k.state ?? '', city: k.city, map: k.map ?? '', setting: k.setting ?? '' });
    setTried(false);
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (f: Partial<CampusDraft>) => setV((x) => ({ ...x, ...f }));
  const states = countryByName(v.country)?.states ?? [];
  const was = k && k !== 'new' ? k.name : null;
  const err = {
    name: !v.name.trim() ? 'Enter the campus’s name.' : u.campuses.some((c) => c.name !== was && c.name.toLowerCase() === v.name.trim().toLowerCase()) ? 'That campus is already here.' : null,
    country: !v.country ? 'Choose the country.' : null,
    state: !v.state.trim() ? 'Choose the state.' : null,
    city: !v.city.trim() ? 'Enter the city.' : null,
    map: !v.map.trim() ? 'Paste the campus’s Google Maps link.' : !mapLink(v.map) ? 'Paste the whole link, starting with https://' : null,
  };
  const show = (f: keyof typeof err) => (tried ? err[f] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const setting = (v.setting || undefined) as CampusRec['setting'];
    const old = k && k !== 'new' ? k : undefined;
    onSave({ ...old, name: v.name.trim(), country: v.country, state: v.state.trim(), city: v.city.trim(), map: v.map.trim(), setting, regional: u.country === 'Australia' ? setting === 'Regional town' : undefined });
  };
  return (
    <Sheet
      open={!!k}
      onClose={onCancel}
      center
      className="iform"
      title={k === 'new' ? 'Add a campus' : 'Edit campus'}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="iuc-name" label="Campus name" required error={show('name')} className="iform__wide">
          <TextInput id="iuc-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} placeholder="Like: City campus" />
        </Field>
        <Field id="iuc-country" label="Country" required error={show('country')}>
          <SelectInput id="iuc-country" value={v.country} invalid={!!show('country')} onChange={(e) => set({ country: e.target.value, state: '' })}>
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="iuc-state" label="State" required error={show('state')}>
          {states.length ? (
            <SelectInput id="iuc-state" value={v.state} placeholder="Choose the state" invalid={!!show('state')} onChange={(e) => set({ state: e.target.value })}>
              {states.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </SelectInput>
          ) : (
            <TextInput id="iuc-state" value={v.state} invalid={!!show('state')} onChange={(e) => set({ state: e.target.value })} />
          )}
        </Field>
        <Field id="iuc-city" label="City" required error={show('city')}>
          <TextInput id="iuc-city" value={v.city} invalid={!!show('city')} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field id="iuc-setting" label="Setting" optional>
          <SelectInput id="iuc-setting" value={v.setting} placeholder="Pick one" allowEmpty onChange={(e) => set({ setting: e.target.value })}>
            {SETTINGS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="iuc-map" label="Google Maps link" required error={show('map')} className="iform__wide">
          <TextInput id="iuc-map" type="url" value={v.map} invalid={!!show('map')} onChange={(e) => set({ map: e.target.value })} placeholder="https://maps.google.com/…" />
        </Field>
      </div>
    </Sheet>
  );
}

/** The university's courses, with what reading its website finds. */
function UniCourses({ u, courses, onOpen, onAdd }: { u: UniRec; courses: CourseRec[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const [n, setN] = useState(PAGE);
  const by = (s: string) => courses.filter((c) => c.status === s).length;
  const canAdd = u.campuses.some((c) => !u.inactive.includes(c.name));
  return (
    <Section
      title="Courses"
      id="iu-courses"
      note={`${courses.length} ${courses.length === 1 ? 'course' : 'courses'} · ${by('Live')} live · ${by('Draft')} drafts · ${by('Hidden')} hidden`}
      action={
        <div className="irsec__acts">
          {canAdd ? <AddButton onClick={onAdd}>Add a course</AddButton> : <span className="irsec__foot">Add a campus first: courses are taught at a campus.</span>}
        </div>
      }
    >
      {courses.length ? (
        <>
          <div className="stab-wrap">
            <table className="itab itab--crs">
              <thead>
                <tr>
                  <th scope="col">Course</th>
                  <th scope="col">Campus</th>
                  <th scope="col">Tuition a year</th>
                  <th scope="col">Next intake</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {courses.slice(0, n).map((c) => (
                  <tr key={c.id} className="irow" onClick={() => onOpen(c.id)}>
                    <td>
                      <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), onOpen(c.id))}>
                        {c.name}
                      </button>
                      <span className="irow__sub">
                        {c.level} · {c.area}
                      </span>
                    </td>
                    <td>{c.campus.name}</td>
                    <td className="num">{c.tuition > 0 ? money(c.tuition, c.currency) : <span className="muted">Not added</span>}</td>
                    <td>{c.intakes[0]?.month ?? <span className="muted">Not added</span>}</td>
                    <td>
                      <CoursePill s={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {courses.length > n && (
            <div className="imore">
              <Button variant="secondary" onClick={() => setN((x) => x + PAGE)}>
                Show {Math.min(PAGE, courses.length - n)} more
              </Button>
              <span className="imore__n">
                Showing <span className="num">{n}</span> of <span className="num">{courses.length}</span>
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="iempty">No courses yet. Add each with its basics, then its fees, entry and intakes on its page.</p>
      )}
    </Section>
  );
}

type Profile = Pick<UniRec, 'name' | 'utype' | 'sector' | 'website' | 'cricos' | 'priority' | 'studylink' | 'pathway'>;

function EditProfile({ u, onCancel, onSave }: { u: UniRec | null; onCancel: () => void; onSave: (f: Profile) => void }) {
  const [v, setV] = useState<Profile>({ name: '', utype: 'University', sector: 'Public', website: '', cricos: '', priority: '', studylink: false, pathway: false });
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!u) return;
    setV({ name: u.name, utype: u.utype, sector: u.sector, website: u.website ?? '', cricos: u.cricos, priority: u.priority, studylink: u.studylink, pathway: u.pathway });
    setTried(false);
  }, [u]);
  const set = (f: Partial<Profile>) => setV((x) => ({ ...x, ...f }));
  const err = {
    name: !v.name.trim() ? 'Enter the university’s name.' : null,
    website: !v.website?.trim() ? 'Enter its website.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  return (
    <Sheet
      open={!!u}
      onClose={onCancel}
      center
      className="iform"
      title="Edit profile"
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
                onSave({ ...v, name: v.name.trim(), website: (v.website ?? '').trim().replace(/^https?:\/\//, ''), cricos: v.cricos.trim() });
              }}
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="iform__grid">
        <Field id="iup-name" label="Name" required error={show('name')} className="iform__wide">
          <TextInput id="iup-name" value={v.name} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="iup-type" label="Type" required>
          <SelectInput id="iup-type" value={v.utype} onChange={(e) => set({ utype: e.target.value as UniType })}>
            {UNI_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="iup-sector" label="Public or private">
          <SelectInput id="iup-sector" value={v.sector} onChange={(e) => set({ sector: e.target.value as UniRec['sector'] })}>
            <option value="Public">Public</option>
            <option value="Private">Private</option>
          </SelectInput>
        </Field>
        <Field id="iup-web" label="Website" required error={show('website')}>
          <TextInput id="iup-web" value={v.website ?? ''} invalid={!!show('website')} onChange={(e) => set({ website: e.target.value })} />
        </Field>
        <Field id="iup-priority" label="Display priority" optional hint="A number. It breaks ties in search.">
          <TextInput id="iup-priority" inputMode="numeric" value={v.priority} onChange={(e) => set({ priority: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="Like: 10" />
        </Field>
        {u?.country === 'Australia' && (
          <Field id="iup-cricos" label="CRICOS provider code" optional>
            <TextInput id="iup-cricos" value={v.cricos} onChange={(e) => set({ cricos: e.target.value.toUpperCase() })} placeholder="Like: 00114A" />
          </Field>
        )}
        <div className="iform__wide iswitches">
          <Switch id="iup-studylink" checked={v.studylink} onChange={(x) => set({ studylink: x })}>
            Applies through StudyLink
          </Switch>
          <Switch id="iup-pathway" checked={v.pathway} onChange={(x) => set({ pathway: x })}>
            Pathway provider
          </Switch>
        </div>
      </div>
    </Sheet>
  );
}
