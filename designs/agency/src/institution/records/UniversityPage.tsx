import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMPUS_SETTINGS } from '../../data/courses';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CountryCombobox } from '../../components/CountryCombobox';
import { Field, Switch, TextInput } from '../../components/forms';
import { DESTINATIONS, SEARCH_PRIORITY, type Destination } from '../../data/courses';
import { UniMark, campusLabel } from '../courses/parts';
import { countryByName } from '../../data/partners';
import { COURSE_STATUSES, UNI_TYPES, coursesOf, searchable, type CampusRec, type CourseRec, type UniRec, type UniType } from '../data/catalogue';
import { EXECUTED, agreementOf, canGoLive, dateText, executedByHand, isClosed, stampBy } from '../data/records';
import { acceptOf, audit, checkFile, withLog, type Change, type LogSpec } from '../data/changelog';
import { getDb, patch } from '../data/store';
import { AddButton, ChangeLog, ErrorText, Facts, NoMatch, Pick, RecordHead, RecordTabs, Section, SystemInfo, TabPanel, usePager } from './parts';
import { SearchPick } from './SearchPick';
import { CourseForm, blankCourse, newCourse, type CourseDraft } from './CourseForm';
import { CsvImport } from './CsvImport';
import { nextIntake } from './Catalogue';
import { CoursePill, PartnerPill, UniPill } from './pills';
import { Territory } from './uni/Territory';
import { Submission } from './uni/Submission';
import { Scholarships } from './uni/Scholarships';
import { Pictures } from './uni/Pictures';
import { OBJ, canEdit, canSee, type PageProps } from '../portal/model';
import { NumberField } from '../../components/NumberField';

type Tab = 'overview' | 'campuses' | 'pictures' | 'courses' | 'scholarships' | 'territory' | 'submission' | 'log';
const TABS: Tab[] = ['overview', 'campuses', 'pictures', 'courses', 'scholarships', 'territory', 'submission', 'log'];
export type UniUpd = (fn: (u: UniRec) => UniRec) => void;
const SENT = { 'Own portal': 'applications on its own portal', StudyLink: 'applications through StudyLink', Email: 'applications by email' } as const;

/** What a university's Change log writes (S2-13): record · part · field. Secrets are never written. */
const specFor = (partnerName: (id: string) => string): LogSpec<UniRec> => ({
  record: 'University',
  fields: {
    name: 'Overview · Name', ip: 'Overview · Institution partner', utype: 'Overview · Type', sector: 'Overview · Public or private', country: 'Overview · Country', website: 'Overview · Website', cricos: 'Overview · CRICOS provider code', founded: 'Overview · Founded', searchPriority: 'Overview · Search priority', pathway: 'Overview · Pathway provider', studylink: 'Overview · Applies through StudyLink', about: 'Overview · About', logo: 'Overview · Logo',
    campuses: 'Campuses · Campus', inactive: 'Campuses · Inactive campuses', pictures: 'Pictures · Picture', scholarships: 'Scholarships · Scholarship', territory: 'Territory',
    forms: 'Submission · Application form', channel: 'Submission · How applications are sent', link: 'Submission · Link or address', logins: 'Submission · Portal logins', contacts: 'Submission · Contact', status: 'Status',
  },
  fmt: {
    ip: (v) => partnerName(String(v)),
    logo: (v) => (v ? 'Uploaded' : '—'),
    territory: (v) => {
      const t = v as UniRec['territory'];
      return `${t.mode === 'all' ? 'All countries' : `${t.mode === 'only' ? 'Only' : 'All except'} ${t.countries.join(', ')}`}; priority ${t.priority.join(', ') || 'none'}; ${t.blocked.length} blocked; hidden from ${t.hiddenFrom.length}`;
    },
    logins: (v) => (v as UniRec['logins']).map((l) => `${l.region}: ${l.username}`).join(', ') || '—',
    pictures: (v) => `${(v as unknown[]).length} pictures`,
  },
});

/** Every required Overview field is filled (proposal S2C-2: a fifth check to go Live). */
export const profileMissing = (u: UniRec) =>
  (
    [
      ['public or private', !!u.sector],
      ['website', !!u.website],
      ['founded', !!u.founded],
      ['logo', !!(u.logo || u.mark)],
      ...(u.country === 'Australia' ? ([['CRICOS provider code', !!u.cricos]] as [string, boolean][]) : []),
    ] as [string, boolean][]
  )
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

/**
 * A university's page (slice 2 PRD): its status and what moves it (Go live with what's missing, Pause with a
 * confirm, Resume), then Overview, Campuses, Pictures, Courses, Scholarships, Territory, Submission and contacts,
 * and the Change log. Each tab is saved on its own. Edited by Institution, IP Ops and Admin; Ended is read-only.
 */
export function UniversityPage(props: PageProps & { u: UniRec; tab?: string; backLabel: string; onBack: () => void; appsByUni?: Record<string, number> }) {
  const { u, tab: start, backLabel, onBack, db, set, open, say, me } = props;
  const role = props.role ?? 'Institution';
  const p = db.ips.find((x) => x.id === u.ip);
  // an Ended university whose partner was reopened (S2C-19) isn't read-only: IP Ops activates it on its own
  const reopened = u.status === 'Ended' && !!p && !isClosed(p.status);
  const ended = u.status === 'Ended' && !reopened;
  const edit = canEdit(props, OBJ.unis) && !ended;
  const seeCampuses = canSee(props, OBJ.campuses);
  const editCampuses = canEdit(props, OBJ.campuses) && !ended;
  const seeLogins = canSee(props, OBJ.logins);
  const editLogins = canEdit(props, OBJ.logins) && !ended;
  const editSite = canEdit(props, OBJ.microsites) && !ended;
  const editCourses = canEdit(props, OBJ.courses);
  const tabs = TABS.filter((t) => t !== 'campuses' || seeCampuses);
  const [tab, setTab] = useState<Tab>(tabs.includes(start as Tab) ? (start as Tab) : 'overview');
  useEffect(() => {
    if (start && tabs.includes(start as Tab)) setTab(start as Tab);
  }, [start]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<CourseDraft | null>(null);
  const [importing, setImporting] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [ipTo, setIpTo] = useState(u.ip);
  const a = p ? agreementOf(p) : null;
  const courses = coursesOf(db.courses, u.id);
  const live = courses.filter(searchable);
  const spec = specFor((id) => db.ips.find((x) => x.id === id)?.name ?? id);
  const upd: UniUpd = (fn) => set((d) => ({ ...d, unis: patch(d.unis, u.id, (x) => withLog(spec, x, fn(x), me, role)) }));
  /** Changes one part of the university, stamps it, and writes the Change log. */
  const part =
    (k: string): UniUpd =>
    (fn) =>
      upd((x) => ({ ...fn(x), stamps: { ...x.stamps, [k]: stampBy(me) } }));

  // what Go live and Resume need (slice 2 PRD; the fifth, profile complete, is proposal S2C-2)
  const missingProfile = profileMissing(u);
  const needs: [string, boolean][] = [
    [p ? `Its partner is Agreement executed${executedByHand(p) ? ' (set by hand after its end date: in date, Decision A)' : ''} (now ${p.status})` : 'Its partner is Agreement executed', canGoLive(p)],
    ['An active campus', u.campuses.some((c) => !u.inactive.includes(c.name))],
    ['A live course', live.length > 0],
    ['How applications are sent', !!u.channel],
    [missingProfile.length ? `Profile complete (missing: ${missingProfile.join(', ')})` : 'Profile complete', missingProfile.length === 0],
  ];
  const ready = needs.every(([, ok]) => ok);
  const setStatus = (status: UniRec['status'], what: string) => {
    part('status')((x) => ({ ...x, status }));
    audit('Universities', `university.status_changed: ${u.name}, ${u.status} → ${status}`, me, role);
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
        {u.status === 'Setting up' || u.status === 'Paused' || reopened ? (
          <div className="igolive">
            {reopened && <p className="istatus__note">Ended with its partnership. {p?.name} was reopened: activate this university when it’s ready. Nothing changes on its own.</p>}
            {!ready && <p className="istatus__note">{u.status === 'Paused' ? 'It can’t be resumed yet:' : reopened ? 'It can’t be activated yet:' : 'It can’t go Live yet:'}</p>}
            {u.status === 'Paused' && ready && <p className="istatus__note">Paused: out of course search until it’s resumed. Applications already made carry on. Nothing resumes on its own.</p>}
            <ul className="igolive__list" aria-label={u.status === 'Paused' ? 'To resume' : reopened ? 'To activate' : 'To go Live'}>
              {needs.map(([k, ok]) => (
                <li key={k} className={`igolive__item ${ok ? 'is-done' : ''}`}>
                  <Icon name={ok ? 'checkCircle' : 'clock'} size={16} />
                  {k}
                </li>
              ))}
            </ul>
            {canEdit(props, OBJ.unis) && (
              <Button size="sm" disabled={!ready} onClick={() => setStatus('Live', u.status === 'Paused' ? 'resumed' : reopened ? 'activated' : 'went live')}>
                {u.status === 'Paused' ? 'Resume' : reopened ? 'Activate' : 'Go live'}
              </Button>
            )}
          </div>
        ) : u.status === 'Live' ? (
          <div className="istatus">
            <p className="istatus__note">In course search: its live courses at active campuses.</p>
            {edit && (
              <Button variant="secondary" size="sm" onClick={() => setPausing(true)}>
                Pause
              </Button>
            )}
          </div>
        ) : (
          <div className="istatus">
            <p className="istatus__note">Ended with its partnership: read-only. Applications already made carry on.</p>
          </div>
        )}
      </RecordHead>

      <RecordTabs
        id="iutab"
        label="University"
        tab={tab}
        setTab={setTab}
        tabs={(
          [
            { key: 'overview', label: 'Overview' },
            { key: 'campuses', label: 'Campuses', n: u.campuses.length },
            { key: 'pictures', label: 'Pictures', n: u.pictures.length },
            { key: 'courses', label: 'Courses', n: courses.length },
            { key: 'scholarships', label: 'Scholarships', n: u.scholarships.length },
            { key: 'territory', label: 'Territory' },
            { key: 'submission', label: 'Submission and contacts' },
            { key: 'log', label: 'Change log', n: u.log.length },
          ] as { key: Tab; label: string; n?: number }[]
        ).filter((t) => tabs.includes(t.key))}
      />

      <TabPanel id="iutab" tab={tab}>
        {tab === 'overview' && (
          <>
            <Section title="Institution partner" id="iu-ip" updated={u.stamps.partner}>
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
                    <span className="muted">Not set</span>
                  )}
                  {edit && (
                    <button type="button" className="icon-btn ipartner__edit" aria-label="Change institution partner" title="Change institution partner" onClick={() => (setIpTo(u.ip), setMoving(true))}>
                      <Icon name="edit" size={18} />
                    </button>
                  )}
                </div>
              )}
              {p && (
                <Facts
                  items={[
                    ['Type', p.type],
                    ['Relationship manager', p.rm],
                    ['Status', <PartnerPill key="s" p={p} />],
                    ['Current agreement', a ? `${dateText(a.start)} to ${dateText(a.end)}` : 'No agreement yet'],
                  ]}
                />
              )}
            </Section>
            <Section
              title="Profile"
              id="iu-profile"
              updated={u.stamps.profile}
              action={
                edit ? (
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditing(true)}>
                    Edit profile
                  </Button>
                ) : undefined
              }
            >
              <ProfileFacts u={u} />
            </Section>
            <SystemInfo created={u.created} log={u.log} />
          </>
        )}

        {tab === 'campuses' && seeCampuses && (
          <Campuses
            u={u}
            edit={editCampuses}
            upd={part('campuses')}
            say={say}
            counts={courses}
            onSave={(was, k) =>
              // a renamed campus is renamed on its courses and in the inactive list too
              set((d) => ({
                ...d,
                unis: patch(d.unis, u.id, (x) =>
                  withLog(spec, x, {
                    ...x,
                    campuses: was ? x.campuses.map((y) => (y.name === was ? k : y)) : [...x.campuses, k],
                    inactive: was ? x.inactive.map((n) => (n === was ? k.name : n)) : x.inactive,
                    stamps: { ...x.stamps, campuses: stampBy(me) },
                  }, me, role),
                ),
                courses: was ? d.courses.map((c) => (c.uni.id === u.id && c.campus.name === was ? { ...c, campus: k } : c)) : d.courses,
              }))
            }
          />
        )}

        {tab === 'courses' && (
          <UniCourses
            u={u}
            courses={courses}
            edit={editCourses && !ended}
            onOpen={(id) => open({ section: 'catalogue', id, back: { section: 'universities', id: u.id, tab: 'courses', label: u.name } })}
            onAdd={() => setAdding({ ...blankCourse, uni: u.id })}
            onImport={() => setImporting(true)}
          />
        )}

        {tab === 'pictures' && <Pictures u={u} upd={part('pictures')} say={say} updated={u.stamps.pictures} edit={editSite} />}
        {tab === 'scholarships' && <Scholarships u={u} upd={part('scholarships')} say={say} updated={u.stamps.scholarships} edit={edit} />}
        {tab === 'territory' && <Territory u={u} rps={db.rps} upd={upd} say={say} me={me} edit={edit} />}
        {tab === 'submission' && <Submission u={u} p={p} part={part} say={say} me={me} role={role} edit={edit} editLogins={editLogins} seeLogins={seeLogins} />}
        {tab === 'log' && <ChangeLog log={u.log} id="iu-log" />}
      </TabPanel>

      <CourseForm
        f={adding}
        unis={db.unis}
        courses={db.courses}
        lockUni
        onCancel={() => setAdding(null)}
        onSave={(f) => {
          const rec = newCourse(f, db.unis, db.courses, { by: me, role });
          set((d) => ({ ...d, courses: [rec, ...d.courses] }));
          setAdding(null);
          say(`${rec.name} added as a Draft.`);
          open({ section: 'catalogue', id: rec.id, back: { section: 'universities', id: u.id, tab: 'courses', label: u.name } });
        }}
      />
      <CsvImport open={importing} uni={u.id} unis={db.unis} courses={db.courses} me={me} role={role} onClose={() => setImporting(false)} onLoad={(recs) => recs.length && set((d) => ({ ...d, courses: [...recs, ...d.courses] }))} />
      <ConfirmDialog
        open={pausing}
        title={`Pause ${u.name}?`}
        confirm="Pause"
        onCancel={() => setPausing(false)}
        onConfirm={() => {
          setPausing(false);
          setStatus('Paused', 'paused');
        }}
      >
        <p>
          Its {live.length} live {live.length === 1 ? 'course leaves' : 'courses leave'} course search at once. Applications already made carry on.
        </p>
      </ConfirmDialog>
      <EditProfile
        u={editing ? u : null}
        taken={(n) => db.unis.some((x) => x.id !== u.id && x.name.toLowerCase() === n.trim().toLowerCase())}
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

/** The profile as the Overview shows it: "Not set" for what isn't filled yet. */
function ProfileFacts({ u }: { u: UniRec }) {
  const ns = <span className="muted">Not set</span>;
  return (
    <Facts
      items={[
        ['Logo', u.logo || u.mark ? <img key="l" className="iulogo" src={u.logo ?? u.mark} alt={`${u.name} logo`} /> : <span key="l" className="muted">Not set (initials show until one is uploaded)</span>],
        ['Type', u.utype],
        ['Public or private', u.sector || ns],
        ['Country', u.country],
        ['Website', u.website ? <a key="w" href={`https://${u.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer">https://{u.website.replace(/^https?:\/\//, '')}</a> : ns],
        ...(u.country === 'Australia' ? ([['CRICOS provider code', u.cricos || ns]] as [string, React.ReactNode][]) : []),
        ['QS world ranking', u.qs ? <span key="qs" className="num">#{u.qs} · QS {u.qsYear ?? 2026}</span> : '—'],
        ['Founded', u.founded ? <span key="fd" className="num">{u.founded}</span> : ns],
        ['Search priority', <span key="sp" className="num">{u.searchPriority}</span>],
        ['Pathway provider', u.pathway ? 'Yes' : 'No'],
        ['Applies through StudyLink', u.studylink ? 'Yes' : 'No'],
        ['About', u.about || <span key="ab" className="muted">—</span>],
      ]}
    />
  );
}

const SETTINGS = CAMPUS_SETTINGS;
const GEO_NAME: Record<string, string> = { UK: 'United Kingdom', USA: 'United States' };

/**
 * Campuses (slice 2 PRD): Campus (Setting underneath), City and state, Country, Map, Courses, Status, with Edit and
 * Make inactive or Make active. A campus with courses can be made inactive but not removed; one without can be.
 */
function Campuses({ u, edit, upd, say, counts, onSave }: { u: UniRec; edit: boolean; upd: UniUpd; say: (m: string) => void; counts: { campus: { name: string } }[]; onSave: (was: string | null, k: CampusRec) => void }) {
  const [form, setForm] = useState<CampusRec | 'new' | null>(null);
  const [removing, setRemoving] = useState<CampusRec | null>(null);
  return (
    <Section title="Campuses" id="iu-campuses" updated={u.stamps.campuses} note="An inactive campus takes its courses out of course search; applications already made carry on. Renaming a campus renames it on its courses." action={edit ? <AddButton onClick={() => setForm('new')}>Add a campus</AddButton> : undefined}>
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
                {edit && (
                  <th scope="col">
                    <span className="vh">Edit or change</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {u.campuses.map((c) => {
                const off = u.inactive.includes(c.name);
                const n = counts.filter((x) => x.campus.name === c.name).length;
                return (
                  <tr key={c.name}>
                    <td>
                      {c.name}
                      {c.setting && <span className="irow__sub">{c.setting}</span>}
                    </td>
                    <td>
                      {c.city}
                      {c.state ? <span className="irow__sub">{c.state}</span> : <span className="irow__sub muted">State not set</span>}
                    </td>
                    <td>{c.country ?? GEO_NAME[u.country] ?? u.country}</td>
                    <td>
                      {c.map ? (
                        <a href={c.map} target="_blank" rel="noreferrer">
                          Open map<span className="vh"> of {c.name}, opens in a new tab</span>
                        </a>
                      ) : (
                        <span className="muted">Not set</span>
                      )}
                    </td>
                    <td className="num">{n}</td>
                    <td>{off ? <span className="dpill idpill--grey">Inactive</span> : <span className="dpill dpill--verified">Active</span>}</td>
                    {edit && (
                      <td>
                        <span className="irowacts">
                          <button type="button" className="btn btn--link" onClick={() => setForm(c)}>
                            Edit<span className="vh"> {c.name}</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn--link"
                            onClick={() => {
                              upd((x) => ({ ...x, inactive: off ? x.inactive.filter((m) => m !== c.name) : [...x.inactive, c.name] }));
                              say(off ? `${c.name} is active.` : `${c.name} is inactive: its courses left course search.`);
                            }}
                          >
                            {off ? 'Make active' : 'Make inactive'}
                            <span className="vh"> {c.name}</span>
                          </button>
                          {n === 0 && (
                            <button type="button" className="btn btn--link idanger" onClick={() => setRemoving(c)}>
                              Remove<span className="vh"> {c.name}</span>
                            </button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">No campuses yet.{edit ? ' Add one: courses are taught at a campus.' : ''}</p>
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
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name}?`}
        confirm="Remove campus"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) upd((x) => ({ ...x, campuses: x.campuses.filter((y) => y.name !== removing.name), inactive: x.inactive.filter((m) => m !== removing.name) }));
          say(`${removing?.name} removed.`);
          setRemoving(null);
        }}
      >
        <p>It has no courses. A campus with courses can only be made inactive.</p>
      </ConfirmDialog>
    </Section>
  );
}

type CampusDraft = { name: string; country: string; state: string; city: string; address: string; map: string; setting: string };

/** Add or edit a campus (slice 2 PRD): name (unique within the university), country, state, city, Google Maps link; Setting optional and descriptive only (S2-27). */
function CampusForm({ u, k, onCancel, onSave }: { u: UniRec; k: CampusRec | 'new' | null; onCancel: () => void; onSave: (k: CampusRec) => void }) {
  const home = GEO_NAME[u.country] ?? u.country;
  const blank: CampusDraft = { name: '', country: home, state: '', city: '', address: '', map: '', setting: '' };
  const [v, setV] = useState<CampusDraft>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!k) return;
    setV(k === 'new' ? blank : { name: k.name, country: k.country ?? home, state: k.state ?? '', city: k.city, address: k.address ?? '', map: k.map ?? '', setting: k.setting ?? '' });
    setTried(false);
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (f: Partial<CampusDraft>) => setV((x) => ({ ...x, ...f }));
  const states = countryByName(v.country)?.states ?? [];
  const was = k && k !== 'new' ? k.name : null;
  const err = {
    name: !v.name.trim() ? 'Enter the name.' : u.campuses.some((c) => c.name !== was && c.name.toLowerCase() === v.name.trim().toLowerCase()) ? 'This university already has a campus with this name.' : null,
    country: !countryByName(v.country) ? 'Pick a country.' : null,
    state: !v.state.trim() ? (states.length ? 'Pick a state.' : 'Enter the state.') : null,
    city: !v.city.trim() ? 'Enter the city.' : null,
    map: !/^https:\/\/\S+\.\S+/i.test(v.map.trim()) ? 'Paste the whole link, starting with https://.' : null,
  };
  const show = (f: keyof typeof err) => (tried ? err[f] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const setting = (v.setting || undefined) as CampusRec['setting'];
    const old = k && k !== 'new' ? k : undefined;
    // the Setting is descriptive only: it sets no tag (S2-27)
    onSave({ ...old, name: v.name.trim(), country: v.country, state: v.state.trim(), city: v.city.trim(), address: v.address.trim() || undefined, map: v.map.trim(), setting, regional: undefined });
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
        <Field id="iuc-name" label="Name" required error={show('name')} className="iform__wide">
          <TextInput id="iuc-name" value={v.name} maxLength={120} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} placeholder="Like: City campus" />
        </Field>
        <Field id="iuc-country" label="Country" required error={show('country')}>
          <CountryCombobox id="iuc-country" value={v.country} invalid={!!show('country')} onChange={(country) => set({ country, state: '' })} />
        </Field>
        <Field id="iuc-state" label="State" required error={show('state')}>
          {states.length ? <Pick id="iuc-state" label="State" value={v.state} placeholder="Pick a state" invalid={!!show('state')} options={states} onChange={(state) => set({ state })} /> : <TextInput id="iuc-state" value={v.state} invalid={!!show('state')} onChange={(e) => set({ state: e.target.value })} />}
        </Field>
        <Field id="iuc-city" label="City" required error={show('city')}>
          <TextInput id="iuc-city" value={v.city} maxLength={80} invalid={!!show('city')} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field id="iuc-setting" label="Setting" optional hint="Descriptive only; shown under the campus name.">
          <Pick id="iuc-setting" label="Setting" value={v.setting} all="Not set" options={SETTINGS} onChange={(setting) => set({ setting })} />
        </Field>
        <Field id="iuc-map" label="Google Maps link" required error={show('map')} className="iform__wide">
          <TextInput id="iuc-map" type="url" value={v.map} invalid={!!show('map')} onChange={(e) => set({ map: e.target.value })} placeholder="https://maps.google.com/…" />
        </Field>
      </div>
    </Sheet>
  );
}

/** The university's Courses tab (slice 2 PRD): Course (campus, CRICOS), Level, Next intake, Source, Status; search, Level and Status. */
function UniCourses({ u, courses, edit, onOpen, onAdd, onImport }: { u: UniRec; courses: CourseRec[]; edit: boolean; onOpen: (id: string) => void; onAdd: () => void; onImport: () => void }) {
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState('');
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...courses].sort((a, b) => a.name.localeCompare(b.name)).filter((c) => (!t || `${c.name} ${c.code} ${c.cricos ?? ''}`.toLowerCase().includes(t)) && (!level || c.level === level) && (!status || c.status === status));
  }, [courses, q, level, status]);
  const { page, pager } = usePager(rows, [q, level, status]);
  const by = (s: string) => courses.filter((c) => c.status === s).length;
  const canAdd = u.campuses.some((c) => !u.inactive.includes(c.name));
  return (
    <Section
      title="Courses"
      id="iu-courses"
      note={`${courses.length} ${courses.length === 1 ? 'course' : 'courses'} · ${by('Live')} live · ${by('Draft')} drafts · ${by('Hidden')} hidden`}
      action={
        edit ? (
          <div className="irsec__acts">
            <Button variant="secondary" size="sm" iconLeft={<Icon name="upload" size={16} />} onClick={onImport}>
              Import CSV
            </Button>
            {canAdd ? <AddButton onClick={onAdd}>Add a course</AddButton> : <span className="irsec__foot">Add an active campus first: courses are taught at a campus.</span>}
          </div>
        ) : undefined
      }
    >
      {courses.length ? (
        <>
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search this university’s courses</span>
              <input type="search" placeholder="Course, code or CRICOS" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <Pick id="iuc-level-f" label="Level" value={level} all="All levels" options={getDb().levels.map((l) => l.name)} onChange={setLevel} />
            <Pick id="iuc-status-f" label="Status" value={status} all="All statuses" options={COURSE_STATUSES} onChange={setStatus} />
          </div>
          {rows.length ? (
            <div className="stab-wrap">
              <table className="itab itab--crs">
                <thead>
                  <tr>
                    <th scope="col">Course</th>
                    <th scope="col">Level</th>
                    <th scope="col">Next intake</th>
                    <th scope="col">Source</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((c) => (
                    <tr key={c.id} className="irow" onClick={() => onOpen(c.id)}>
                      <td>
                        <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), onOpen(c.id))}>
                          {c.name}
                        </button>
                        <span className="irow__sub">
                          {c.campus.name}
                          {c.cricos ? ` · CRICOS ${c.cricos}` : ''}
                        </span>
                      </td>
                      <td>{c.level}</td>
                      <td>{nextIntake(c)}</td>
                      <td>{c.source}</td>
                      <td>
                        <CoursePill s={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoMatch onClear={() => (setQ(''), setLevel(''), setStatus(''))} />
          )}
          {pager}
        </>
      ) : (
        <p className="iempty">No courses yet.{edit && canAdd ? ' Add a course, or import a CSV.' : ''}</p>
      )}
    </Section>
  );
}

type Profile = Pick<UniRec, 'name' | 'utype' | 'sector' | 'website' | 'cricos' | 'searchPriority' | 'studylink' | 'pathway' | 'founded' | 'about' | 'logo' | 'country'>;
type ProfileDraft = { name: string; utype: string; sector: string; website: string; cricos: string; searchPriority: string; studylink: boolean; pathway: boolean; founded: string; about: string; logo?: string; country: string };
const LOGO_KINDS = ['png', 'jpg', 'svg', 'webp'] as const;

/**
 * Edit profile (slice 2 PRD): every field is required except CRICOS (Australia only) and About. QS world ranking is
 * read-only here: it comes from the Universities page's QS ranking CSV (S2-2, S2C-17). Search priority 1–10, default 5 (S2C-1).
 */
function EditProfile({ u, taken, onCancel, onSave }: { u: UniRec | null; taken: (n: string) => boolean; onCancel: () => void; onSave: (f: Profile) => void }) {
  const first = (x: UniRec): ProfileDraft => ({ name: x.name, utype: x.utype, sector: x.sector ?? '', website: x.website ? `https://${x.website.replace(/^https?:\/\//, '')}` : '', cricos: x.cricos, searchPriority: String(x.searchPriority ?? SEARCH_PRIORITY.default), studylink: x.studylink, pathway: x.pathway, founded: x.founded ? String(x.founded) : '', about: x.about ?? '', logo: x.logo, country: x.country });
  const [v, setV] = useState<ProfileDraft | null>(null);
  const [tried, setTried] = useState(false);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!u) return;
    setV(first(u));
    setTried(false);
    setLogoErr(null);
  }, [u]); // eslint-disable-line react-hooks/exhaustive-deps
  const x = v ?? ({ name: '', utype: '', sector: '', website: '', cricos: '', searchPriority: String(SEARCH_PRIORITY.default), studylink: false, pathway: false, founded: '', about: '', country: '' } as ProfileDraft);
  const set = (f: Partial<ProfileDraft>) => setV((y) => (y ? { ...y, ...f } : y));
  const year = new Date().getFullYear();
  const au = x.country === 'Australia';
  const sp = x.searchPriority.trim();
  const err = {
    name: !x.name.trim() ? 'Enter the name.' : x.name.trim().length < 2 ? 'Use 2 to 120 characters.' : taken(x.name) ? 'Another university has this name.' : null,
    utype: !x.utype ? 'Pick a type.' : null,
    sector: !x.sector ? 'Pick public or private.' : null,
    country: !x.country ? 'Pick a country.' : null,
    website: !/^https:\/\/\S+\.\S+/.test(x.website.trim()) ? 'Enter the whole web address, starting with https://.' : null,
    cricos: au ? (!x.cricos.trim() ? 'Enter the CRICOS provider code.' : !/^\d{5}[A-Z]$/.test(x.cricos.trim().toUpperCase()) ? 'Use 5 digits and a letter, like 00114A.' : null) : null,
    founded: !x.founded ? 'Enter the founded year.' : !/^\d{4}$/.test(x.founded) || Number(x.founded) > year ? `A year of 4 digits, not after ${year}.` : null,
    searchPriority: !/^\d{1,2}$/.test(sp) || Number(sp) < SEARCH_PRIORITY.min || Number(sp) > SEARCH_PRIORITY.max ? `Enter a whole number from ${SEARCH_PRIORITY.min} to ${SEARCH_PRIORITY.max}.` : null,
    logo: logoErr ?? (!x.logo && !u?.mark ? 'Upload a logo.' : null),
  };
  const bad = Object.values(err).some(Boolean);
  const show = (k: keyof typeof err) => (tried || (k === 'logo' && logoErr) ? err[k] : null);
  const changed = !!u && !!v && JSON.stringify(v) !== JSON.stringify(first(u));
  return (
    <Sheet
      open={!!u}
      onClose={onCancel}
      center
      className="iform"
      title="Edit profile"
      sub="Every field is required except CRICOS (Australia only) and About."
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              disabled={!changed}
              onClick={() => {
                setTried(true);
                if (bad) return (document.querySelector('.iform [aria-invalid="true"]') as HTMLElement | null)?.focus();
                onSave({ name: x.name.trim(), utype: x.utype as UniType, sector: x.sector as UniRec['sector'], website: x.website.trim().replace(/^https?:\/\//, ''), cricos: au ? x.cricos.trim().toUpperCase() : '', searchPriority: Number(sp), studylink: x.studylink, pathway: x.pathway, founded: Number(x.founded), about: x.about.trim() || undefined, logo: x.logo, country: x.country as Destination });
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
          <TextInput id="iup-name" value={x.name} maxLength={120} invalid={!!show('name')} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="iup-type" label="Type" required error={show('utype')}>
          <Pick id="iup-type" label="Type" value={x.utype} placeholder="Pick a type" invalid={!!show('utype')} options={UNI_TYPES} onChange={(utype) => set({ utype })} />
        </Field>
        <Field id="iup-sector" label="Public or private" required error={show('sector')}>
          <Pick id="iup-sector" label="Public or private" value={x.sector} placeholder="Pick one" invalid={!!show('sector')} options={['Public', 'Private']} onChange={(sector) => set({ sector })} />
        </Field>
        <Field id="iup-country" label="Country" required error={show('country')} hint="The destinations course search offers.">
          <Pick id="iup-country" label="Country" value={x.country} placeholder="Pick a country" invalid={!!show('country')} options={DESTINATIONS} onChange={(country) => set({ country })} />
        </Field>
        <Field id="iup-web" label="Website" required error={show('website')}>
          <TextInput id="iup-web" type="url" value={x.website} invalid={!!show('website')} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
        </Field>
        {au && (
          <Field id="iup-cricos" label="CRICOS provider code" required error={show('cricos')}>
            <TextInput id="iup-cricos" value={x.cricos} maxLength={6} invalid={!!show('cricos')} onChange={(e) => set({ cricos: e.target.value.toUpperCase() })} placeholder="Like: 00114A" />
          </Field>
        )}
        <Field id="iup-founded" label="Founded" required error={show('founded')}>
          <NumberField id="iup-founded" value={x.founded} invalid={!!show('founded')} onChange={(_t) => set({ founded: _t.replace(/\D/g, '').slice(0, 4) })} placeholder="Like: 1966" />
        </Field>
        <Field id="iup-priority" label="Search priority" required error={show('searchPriority')} hint={`A whole number from ${SEARCH_PRIORITY.min} to ${SEARCH_PRIORITY.max}; ${SEARCH_PRIORITY.default} by default. Course search’s Recommended sort orders by it first, highest first.`}>
          <NumberField id="iup-priority" min={SEARCH_PRIORITY.min} max={SEARCH_PRIORITY.max} steppers value={x.searchPriority} invalid={!!show('searchPriority')} onChange={(_t) => set({ searchPriority: _t.replace(/\D/g, '').slice(0, 2) })} />
        </Field>
        <Field id="iup-qs" label="QS world ranking" hint="Read-only: from the QS ranking CSV on the Universities page.">
          <TextInput id="iup-qs" value={u?.qs ? `#${u.qs} · QS ${u.qsYear ?? 2026}` : '—'} readOnly />
        </Field>
        <Field id="iup-logo" label="Logo" required error={show('logo')} hint="PNG, JPG, SVG or WebP, up to 5 MB. Shown on course cards and the university’s page." className="iform__wide">
          <span className="irowacts">
            {(x.logo || u?.mark) && <img className="iulogo" src={x.logo ?? u?.mark} alt="" />}
            <button id="iup-logo" type="button" className={`ipick ${show('logo') ? 'is-invalid' : ''}`} onClick={() => pick.current?.click()}>
              <Icon name="upload" size={18} />
              <span className="ipick__t">{x.logo || u?.mark ? 'Replace logo' : 'Upload a logo'}</span>
            </button>
          </span>
          <input
            ref={pick}
            type="file"
            accept={acceptOf([...LOGO_KINDS])}
            className="vh"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="iup-logo-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const bad2 = checkFile(f, [...LOGO_KINDS], 5);
              setLogoErr(bad2);
              if (bad2) return;
              const r = new FileReader();
              r.onload = () => set({ logo: String(r.result) });
              r.readAsDataURL(f);
            }}
          />
        </Field>
        <Field id="iup-about" label="About" optional hint="Shown to RPs on the university’s page." className="iform__wide">
          <div className="control iform__area">
            <textarea id="iup-about" className="control__input" rows={3} maxLength={2000} value={x.about} onChange={(e) => set({ about: e.target.value })} />
          </div>
        </Field>
        <div className="iform__wide iswitches">
          <Switch id="iup-studylink" checked={x.studylink} onChange={(y) => set({ studylink: y })}>
            Applies through StudyLink
          </Switch>
          <Switch id="iup-pathway" checked={x.pathway} onChange={(y) => set({ pathway: y })}>
            Pathway provider
          </Switch>
        </div>
      </div>
      {tried && bad && <ErrorText>Every field is required except CRICOS (Australia only) and About.</ErrorText>}
    </Sheet>
  );
}

export type { UniRec, Change };
export { EXECUTED };
