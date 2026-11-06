import { useEffect, useRef, useState } from 'react';
import { EditOnly, ViewOnlyProvider, useHides, useViewOnly } from '../../proto/viewOnly';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, SelectInput, Switch, TextInput } from '../../components/forms';
import { DESTINATIONS, type Destination } from '../../data/courses';
import { UniMark, campusLabel } from '../courses/parts';
import { COUNTRIES, countryByName } from '../../data/partners';
import { PRIORITY_DEFAULT, UNI_TYPES, courseUpdated, coursesOf, searchable, type CampusRec, type CourseRec, type UniRec, type UniType } from '../data/catalogue';
import { agreementOf, canGoLive, dateText, isClosed, logLine, stampBy } from '../data/records';
import { patch } from '../data/store';
import { AddButton, ErrorText, Facts, Logs, Pager, RecordHead, RecordTabs, Section, TabPanel, useAsk, usePaged } from './parts';
import { SearchPick } from './SearchPick';
import { CourseColumns, CourseForm, blankCourse, courseTemplate, newCourse, readCourses, type CourseDraft } from './CourseForm';
import { CsvImport } from './CsvImport';
import { CoursePill, PartnerPill, UniPill } from './pills';
import { Territory } from './uni/Territory';
import { Submission, onPortal } from './uni/Submission';
import { Scholarships } from './uni/Scholarships';
import { IMAGE_TYPES, Images, MAX_MB, readImage } from './uni/Images';
import type { PageProps } from '../portal/model';

type Tab = 'overview' | 'campuses' | 'images' | 'courses' | 'scholarships' | 'territory' | 'submission' | 'logs';
const TABS: Tab[] = ['overview', 'campuses', 'images', 'courses', 'scholarships', 'territory', 'submission', 'logs'];
/** Changes one part of the university; `what` is its line in the Logs tab. */
export type UniUpd = (fn: (u: UniRec) => UniRec, what?: string) => void;
const SENT = { 'Own portal': 'applications on its own portal', StudyLink: 'applications through StudyLink', Email: 'applications by email' } as const;
/** Each part of a university as its Logs tab names it. */
const PARTS: Record<string, string> = { status: 'Status', partner: 'Institution partner', profile: 'Profile', campuses: 'Campuses', images: 'Images', courses: 'Courses', scholarships: 'Scholarships', territory: 'Territory', forms: 'Forms', submission: 'How applications are sent', logins: 'Portal logins', contacts: 'University contacts' };
/** "Australia · South Australia": the state follows the country (3 Nov). */
export const whereOf = (u: UniRec) => (u.state ? `${u.country} · ${u.state}` : u.country);

/**
 * A university's page (29 Oct, 2nd round, after the PM prototype's IP team): whether it's live, and what it takes to
 * go live; the institution partner it sits under, picked here (4th round); its profile; campuses; courses (added in
 * place); scholarships; territory rules; and the forms, how applications are sent, logins and who to talk to.
 * Nothing is filled in for the team, and nothing is checked on a timer (4th round). 29 Oct (7th round): the partner
 * changes from its name's edit button; no Changes tab; each part says who last changed it, and when. 3 Nov: the
 * profile shows everything Edit profile asks for, its logo first; an Images tab after Campuses; courses come in from
 * a CSV too; Territory is edited only after Edit territory; and a Logs tab lists every change. 4 Nov: Pause is red;
 * a campus has no setting, Make inactive is red, and making one inactive or active asks first; no lines under the
 * tabs' titles or under Search priority and QS world ranking; Own portal and StudyLink need a portal login to go live.
 */
export function UniversityPage(props: PageProps & { u: UniRec; tab?: string; backLabel: string; onBack: () => void; appsByUni?: Record<string, number> }) {
  const { u, tab: start, backLabel, onBack, db, set, open, say, me } = props;
  const [tab, setTab] = useState<Tab>(TABS.includes(start as Tab) ? (start as Tab) : 'overview');
  // GSP · Finance (6 Nov): no QS ranking, Scholarships, Territory, or Submission and contacts
  const noQs = useHides('uni.qs');
  const noScholarships = useHides('uni.scholarships');
  const noTerritory = useHides('uni.territory');
  const noSubmission = useHides('uni.submission');
  // GSP · Global Ops (6 Nov): Territory to look at
  const territoryView = useHides('uni.territory.view');
  const viewOnly = useViewOnly();
  useEffect(() => {
    if (start && TABS.includes(start as Tab)) setTab(start as Tab);
  }, [start]);
  const [pausing, setPausing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<CourseDraft | null>(null);
  const [importing, setImporting] = useState(false);
  // the partner shows by name; its edit button opens the list to pick another
  const [moving, setMoving] = useState(false);
  const [ipTo, setIpTo] = useState(u.ip);
  const p = db.ips.find((x) => x.id === u.ip);
  const a = p ? agreementOf(p) : null;
  const courses = coursesOf(db.courses, u.id);
  const live = courses.filter(searchable);
  const upd = (fn: (u: UniRec) => UniRec) => set((d) => ({ ...d, unis: patch(d.unis, u.id, fn) }));
  /** Changes one part of the university, says who did and when, and adds its line to the Logs tab. */
  const part =
    (k: string): UniUpd =>
    (fn, what) =>
      upd((x) => ({ ...fn(x), stamps: { ...x.stamps, [k]: stampBy(me) }, log: [logLine(me, k, what ?? `Changed the ${PARTS[k]?.toLowerCase() ?? k}`), ...x.log] }));

  // what going live needs
  const needs: [string, boolean][] = [
    [p ? `Its partner’s agreement is executed and in date (${p.status})` : 'Under an institution partner whose agreement is executed', canGoLive(p)],
    ['At least one active campus', u.campuses.some((c) => !u.inactive.includes(c.name))],
    ['At least one live course', live.length > 0],
    // 4 Nov: Own portal and StudyLink need at least one portal login
    onPortal(u.channel) && !u.logins.length ? [`A portal login for ${u.channel}`, false] : ['How applications are sent', !!u.channel],
  ];
  const ready = needs.every(([, ok]) => ok);
  const setStatus = (status: UniRec['status'], what: string) => {
    part('status')((x) => ({ ...x, status }), what);
    say(`${u.name}: ${what}.`);
  };
  const addCourses = (list: CourseRec[], what: string) => {
    set((d) => ({ ...d, courses: [...list, ...d.courses] }));
    part('courses')((x) => x, what);
  };

  return (
    <div className="ipage irecord">
      <RecordHead
        back={backLabel}
        onBack={onBack}
        mark={<UniMark u={u} big />}
        title={u.name}
        sub={`${p ? `Under ${p.name} · ${p.type}` : 'No institution partner yet'} · ${u.utype} · ${whereOf(u)}${u.channel ? ` · ${SENT[u.channel]}` : ''}`}
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
            <EditOnly>
              <Button size="sm" disabled={!ready} onClick={() => setStatus('Live', 'Went live')}>
                Go live
              </Button>
            </EditOnly>
          </div>
        ) : u.status === 'Live' ? (
          <div className="istatus">
            <p className="istatus__note">In Course search: partners can find and apply to its live courses.</p>
            <EditOnly>
              <Button size="sm" className="ired" onClick={() => setPausing(true)}>
                Pause
              </Button>
            </EditOnly>
          </div>
        ) : u.status === 'Paused' ? (
          <div className="istatus">
            <p className="istatus__note">{canGoLive(p) ? 'Paused: out of Course search until it’s resumed. Applications already made carry on.' : 'Paused: its partner’s agreement isn’t in date. Renew it on the partner to resume.'}</p>
            <EditOnly>
              <Button size="sm" disabled={!canGoLive(p)} onClick={() => setStatus('Live', 'Resumed')}>
                Resume
              </Button>
            </EditOnly>
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
          { key: 'images', label: 'Images', n: u.images.length },
          { key: 'courses', label: 'Courses', n: courses.length },
          ...(noScholarships ? [] : [{ key: 'scholarships' as Tab, label: 'Scholarships', n: u.scholarships.length }]),
          ...(noTerritory ? [] : [{ key: 'territory' as Tab, label: 'Territory' }]),
          ...(noSubmission ? [] : [{ key: 'submission' as Tab, label: 'Submission and contacts' }]),
          { key: 'logs', label: 'Logs', n: u.log.length + 1 },
        ]}
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
                    <EditOnly>
                      <Button
                        size="sm"
                        disabled={!ipTo || ipTo === u.ip}
                        onClick={() => {
                          const to = db.ips.find((x) => x.id === ipTo);
                          part('partner')((x) => ({ ...x, ip: ipTo }), `${p ? `${p.name} → ` : ''}${to?.name}`);
                          setMoving(false);
                          say(`${u.name} is now under ${to?.name}.`);
                        }}
                      >
                        Save
                      </Button>
                    </EditOnly>
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
                  <EditOnly>
                    <button type="button" className="icon-btn ipartner__edit" aria-label={p ? 'Change institution partner' : 'Pick an institution partner'} title={p ? 'Change institution partner' : 'Pick an institution partner'} onClick={() => (setIpTo(u.ip), setMoving(true))}>
                      <Icon name="edit" size={18} />
                    </button>
                  </EditOnly>
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
                <EditOnly>
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditing(true)}>
                    Edit profile
                  </Button>
                </EditOnly>
              }
            >
              <div className="iprof">
                <LogoPlate u={u} />
                <Facts
                  items={[
                    ['Name', u.name],
                    ['Type', u.utype],
                    ['Public or private', u.sector],
                    ['Country', u.country],
                    ['State', u.state || null],
                    [
                      'Website',
                      u.website ? (
                        <a href={`https://${u.website}`} target="_blank" rel="noreferrer">
                          {u.website}
                        </a>
                      ) : null,
                    ],
                    ...(u.country === 'Australia' ? ([['CRICOS provider code', u.cricos || null]] as [string, string | null][]) : []),
                    ['Founded', u.founded ? <span key="f" className="num">{u.founded}</span> : null],
                    ['Search priority', <span key="sp" className="num">{u.priority}</span>],
                    ...(noQs ? [] : ([['QS world ranking', u.qs ? <span key="qs" className="num">{u.qs}</span> : 'Not ranked']] as [string, JSX.Element | string][])),
                    ['Applies through StudyLink', u.studylink ? 'Yes' : 'No'],
                    ['Pathway provider', u.pathway ? 'Yes' : 'No'],
                    ['About', u.about || null, 'wide'],
                  ]}
                />
              </div>
            </Section>
          </>
        )}

        {tab === 'campuses' && (
          <Campuses
            u={u}
            upd={part('campuses')}
            say={say}
            counts={courses}
            onSave={(was, k) => {
              // a renamed campus is renamed on its courses and in the inactive list too
              set((d) => ({
                ...d,
                unis: patch(d.unis, u.id, (x) => ({
                  ...x,
                  campuses: was ? x.campuses.map((y) => (y.name === was ? k : y)) : [...x.campuses, k],
                  inactive: was ? x.inactive.map((n) => (n === was ? k.name : n)) : x.inactive,
                  stamps: { ...x.stamps, campuses: stampBy(me) },
                  log: [logLine(me, 'campuses', was ? `Changed ${was}${was !== k.name ? ` (now ${k.name})` : ''}` : `Added ${campusLabel(k)}`), ...x.log],
                })),
                courses: was ? d.courses.map((c) => (c.uni.id === u.id && c.campus.name === was ? { ...c, campus: k } : c)) : d.courses,
              }));
            }}
          />
        )}

        {tab === 'images' && <Images u={u} upd={part('images')} say={say} />}

        {tab === 'courses' && (
          <UniCourses
            u={u}
            courses={courses}
            onOpen={(id) => open({ section: 'catalogue', id, back: { section: 'universities', id: u.id, tab: 'courses', label: u.name } })}
            onAdd={() => setAdding({ ...blankCourse, uni: u.id })}
            onImport={() => setImporting(true)}
          />
        )}

        {tab === 'scholarships' && !noScholarships && <Scholarships u={u} upd={part('scholarships')} say={say} updated={u.stamps.scholarships} />}
        {tab === 'territory' && !noTerritory && (
          <ViewOnlyProvider on={viewOnly || territoryView}>
            <Territory u={u} rps={db.rps} upd={part('territory')} say={say} />
          </ViewOnlyProvider>
        )}
        {tab === 'submission' && !noSubmission && <Submission u={u} p={p} part={part} say={say} me={me} />}
        {tab === 'logs' && <Logs id="iu-logs" lines={u.log} created={u.created} added="Added the university" parts={PARTS} />}
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
          const rec = newCourse(f, db.unis, db.courses, me);
          addCourses([rec], `Added ${rec.name} as a draft`);
          setAdding(null);
          say(`${rec.name} saved as a draft. Open it to fill in its intakes, fees, academic and English.`);
        }}
      />
      <CsvImport
        open={importing}
        title="Import courses from a CSV"
        template={{ name: `${u.id}-courses-template.csv`, rows: courseTemplate(false) }}
        columns={<CourseColumns u={u} />}
        read={(rows) => readCourses(rows, db.unis, db.courses, u)}
        saveLabel={(n) => `Add ${n} ${n === 1 ? 'course' : 'courses'}`}
        readyText={(n) => `${n} ${n === 1 ? 'course' : 'courses'} to add as drafts.`}
        onCancel={() => setImporting(false)}
        onSave={(list) => {
          const recs = list.map((f) => newCourse(f, db.unis, db.courses, me, 'CSV upload'));
          addCourses(recs, `Added ${recs.length} ${recs.length === 1 ? 'course' : 'courses'} as drafts from a CSV upload: ${recs.map((r) => r.name).join(', ')}`);
          setImporting(false);
          say(recs.length === 1 ? `${recs[0].name} added as a draft.` : `${recs.length} courses added as drafts.`);
        }}
      />
      <EditProfile
        u={editing ? u : null}
        onCancel={() => setEditing(false)}
        onSave={(f) => {
          part('profile')((x) => ({ ...x, ...f }), profileChanges(u, f));
          setEditing(false);
          say('Profile saved.');
        }}
      />
    </div>
  );
}

/** The logo the university has (or its emblem), on a white plate so it reads the same in dark mode. */
function LogoPlate({ u, big = false }: { u: Pick<UniRec, 'name' | 'logo' | 'mark'>; big?: boolean }) {
  const src = u.logo ?? u.mark;
  return (
    <span className={`iplate ${big ? 'iplate--big' : ''}`}>
      {src ? <img src={src} alt={`${u.name} logo`} /> : <span className="iplate__none">No logo yet</span>}
    </span>
  );
}

/** The country list's name for a destination. */
const GEO_NAME: Record<string, string> = { UK: 'United Kingdom', USA: 'United States' };
const mapLink = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim());

/**
 * Campuses: making one inactive takes its courses out of Course search. 30 Oct: a campus is added and edited in a
 * pop-up, with its name, country, state, city and Google Maps link. 4 Nov: no setting; Make inactive is red, and
 * making one inactive or active again asks first.
 */
function Campuses({ u, upd, say, counts, onSave }: { u: UniRec; upd: UniUpd; say: (m: string) => void; counts: { campus: { name: string } }[]; onSave: (was: string | null, k: CampusRec) => void }) {
  const [form, setForm] = useState<CampusRec | 'new' | null>(null);
  const { ask, dialog } = useAsk();
  const pg = usePaged(u.campuses);
  const flip = (c: CampusRec, off: boolean) => {
    const n = counts.filter((x) => x.campus.name === c.name).length;
    const courses = n === 1 ? '1 course' : `${n} courses`;
    ask(
      off ? `Make ${c.name} active?` : `Make ${c.name} inactive?`,
      off ? 'Make active' : 'Make inactive',
      <p>{off ? 'Its live courses come back into Course search.' : `${n ? `Its ${courses} leave` : 'It leaves'} Course search. Applications already made carry on.`}</p>,
      () => {
        upd((x) => ({ ...x, inactive: off ? x.inactive.filter((m) => m !== c.name) : [...x.inactive, c.name] }), `Made ${c.name} ${off ? 'active' : 'inactive'}`);
        say(`${c.name} is ${off ? 'active' : 'inactive'}.`);
      },
    );
  };
  return (
    <Section title="Campuses" id="iu-campuses" updated={u.stamps.campuses} action={<AddButton onClick={() => setForm('new')}>Add a campus</AddButton>}>
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
              {pg.rows.map((c) => {
                const off = u.inactive.includes(c.name);
                return (
                  <tr key={c.name}>
                    <td>{c.name}</td>
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
                        <EditOnly>
                          <button type="button" className="btn btn--link" onClick={() => setForm(c)}>
                            Edit<span className="vh"> {c.name}</span>
                          </button>
                        </EditOnly>
                        <EditOnly>
                          <button type="button" className={`btn btn--link ${off ? '' : 'idanger'}`} onClick={() => flip(c, off)}>
                            {off ? 'Make active' : 'Make inactive'}
                            <span className="vh"> {c.name}</span>
                          </button>
                        </EditOnly>
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
      <Pager pg={pg} what="campuses" />
      {dialog}
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

type CampusDraft = { name: string; country: string; state: string; city: string; map: string };

/** Add or edit a campus. Every field is needed (4 Nov: no setting). */
function CampusForm({ u, k, onCancel, onSave }: { u: UniRec; k: CampusRec | 'new' | null; onCancel: () => void; onSave: (k: CampusRec) => void }) {
  const home = GEO_NAME[u.country] ?? u.country;
  const blank: CampusDraft = { name: '', country: home, state: '', city: '', map: '' };
  const [v, setV] = useState<CampusDraft>(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!k) return;
    setV(k === 'new' ? blank : { name: k.name, country: k.country ?? home, state: k.state ?? '', city: k.city, map: k.map ?? '' });
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
    // what the form doesn't ask for (a sample campus's setting) stays as it was
    const old = k && k !== 'new' ? k : undefined;
    onSave({ ...old, name: v.name.trim(), country: v.country, state: v.state.trim(), city: v.city.trim(), map: v.map.trim() });
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
            <EditOnly>
              <Button onClick={save}>Save</Button>
            </EditOnly>
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
        <Field id="iuc-map" label="Google Maps link" required error={show('map')}>
          <TextInput id="iuc-map" type="url" value={v.map} invalid={!!show('map')} onChange={(e) => set({ map: e.target.value })} placeholder="https://maps.google.com/…" />
        </Field>
      </div>
    </Sheet>
  );
}

/** The university's courses (3 Nov): their source and who changed them last, and Import CSV beside Add a course. */
function UniCourses({ u, courses, onOpen, onAdd, onImport }: { u: UniRec; courses: CourseRec[]; onOpen: (id: string) => void; onAdd: () => void; onImport: () => void }) {
  const pg = usePaged(courses);
  const canAdd = u.campuses.some((c) => !u.inactive.includes(c.name));
  return (
    <Section
      title="Courses"
      id="iu-courses"
      action={
        <div className="irsec__acts">
          {canAdd ? (
            <>
              <EditOnly>
                <Button variant="secondary" size="sm" iconLeft={<Icon name="upload" size={16} />} onClick={onImport}>
                  Import CSV
                </Button>
              </EditOnly>
              <AddButton onClick={onAdd}>Add a course</AddButton>
            </>
          ) : (
            <span className="irsec__foot">Add a campus first: courses are taught at a campus.</span>
          )}
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
                  <th scope="col">Source</th>
                  <th scope="col">Last updated</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((c) => {
                  const last = courseUpdated(c);
                  return (
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
                      <td>{c.source}</td>
                      <td>
                        <span className="num">{dateText(last.at)}</span>
                        <span className="irow__sub">{last.by}</span>
                      </td>
                      <td>
                        <CoursePill s={c.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager pg={pg} what="courses" />
        </>
      ) : (
        <p className="iempty">No courses yet. Add each with its basics, or import several from a CSV; then fill in their fees, entry and intakes on their pages.</p>
      )}
    </Section>
  );
}

type Profile = Pick<UniRec, 'name' | 'utype' | 'sector' | 'country' | 'state' | 'website' | 'cricos' | 'founded' | 'priority' | 'logo' | 'mark' | 'about' | 'studylink' | 'pathway'>;
const LABEL: Partial<Record<keyof Profile, string>> = { name: 'Name', utype: 'Type', sector: 'Public or private', country: 'Country', state: 'State', website: 'Website', cricos: 'CRICOS provider code', founded: 'Founded', priority: 'Search priority', about: 'About', studylink: 'Applies through StudyLink', pathway: 'Pathway provider' };
const shown = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v === undefined || v === '' ? 'empty' : String(v));
/** What Edit profile changed, for the Logs tab: "Search priority 5 → 8; Logo replaced; About". */
function profileChanges(u: UniRec, f: Profile) {
  const out: string[] = [];
  (Object.keys(LABEL) as (keyof Profile)[]).forEach((k) => {
    if ((u[k] ?? '') === (f[k] ?? '')) return;
    out.push(k === 'about' ? 'About changed' : `${LABEL[k]} ${shown(u[k])} → ${shown(f[k])}`);
  });
  if ((u.logo ?? u.mark) !== (f.logo ?? f.mark)) out.push('Logo replaced');
  return out.join('; ') || 'Saved with no changes';
}

/** The country list's name for each destination, for its states. */
const geoName = (d: string) => GEO_NAME[d] ?? d;
const THIS_YEAR = new Date().getFullYear();

/**
 * Edit profile (3 Nov, from Nesil's reference): name, type, public or private, country and its state, website,
 * founded, Search priority (1 to 10, 5 by default), the QS world ranking (read-only: from the QS ranking CSV on
 * Universities), the logo (PNG, JPG, SVG or WebP, up to 5 MB), About, StudyLink and pathway provider. Every field is
 * needed but CRICOS (Australia only) and About.
 */
function EditProfile({ u, onCancel, onSave }: { u: UniRec | null; onCancel: () => void; onSave: (f: Profile) => void }) {
  const empty: Profile = { name: '', utype: 'University', sector: 'Public', country: 'Australia', state: '', website: '', cricos: '', founded: undefined, priority: PRIORITY_DEFAULT, logo: undefined, mark: undefined, about: '', studylink: false, pathway: false };
  const [v, setV] = useState<Profile>(empty);
  const [founded, setFounded] = useState('');
  const [prio, setPrio] = useState(String(PRIORITY_DEFAULT));
  const [tried, setTried] = useState(false);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!u) return;
    setV({ name: u.name, utype: u.utype, sector: u.sector, country: u.country, state: u.state, website: u.website ?? '', cricos: u.cricos, founded: u.founded, priority: u.priority, logo: u.logo, mark: u.mark, about: u.about ?? '', studylink: u.studylink, pathway: u.pathway });
    setFounded(u.founded ? String(u.founded) : '');
    setPrio(String(u.priority));
    setTried(false);
    setLogoErr(null);
  }, [u]);
  const set = (f: Partial<Profile>) => setV((x) => ({ ...x, ...f }));
  const states = countryByName(geoName(v.country))?.states ?? [];
  const year = Number(founded);
  const pr = Number(prio);
  const err = {
    name: !v.name.trim() ? 'Enter the university’s name.' : null,
    state: !v.state ? 'Pick its state.' : null,
    website: !v.website?.trim() ? 'Enter its website.' : null,
    founded: !founded ? 'Enter the year it was founded.' : !(Number.isInteger(year) && year >= 1000 && year <= THIS_YEAR) ? `A year from 1000 to ${THIS_YEAR}.` : null,
    priority: !(Number.isInteger(pr) && pr >= 1 && pr <= 10) ? 'A whole number from 1 to 10.' : null,
    logo: !(v.logo ?? v.mark) ? 'Upload its logo.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const step = (d: number) => setPrio(String(Math.min(10, Math.max(1, (Number.isInteger(pr) ? pr : PRIORITY_DEFAULT) + d))));
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
            <EditOnly>
              <Button
                onClick={() => {
                  setTried(true);
                  if (Object.values(err).some(Boolean)) return;
                  onSave({ ...v, name: v.name.trim(), website: (v.website ?? '').trim().replace(/^https?:\/\//, ''), cricos: v.country === 'Australia' ? v.cricos.trim() : '', founded: year, priority: pr, about: (v.about ?? '').trim() });
                }}
              >
                Save
              </Button>
            </EditOnly>
          </div>
        </div>
      }
    >
      <p className="ireq">
        <span className="field__req" aria-hidden="true">
          *
        </span>{' '}
        Required
      </p>
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
        <Field id="iup-sector" label="Public or private" required>
          <SelectInput id="iup-sector" value={v.sector} onChange={(e) => set({ sector: e.target.value as UniRec['sector'] })}>
            <option value="Public">Public</option>
            <option value="Private">Private</option>
          </SelectInput>
        </Field>
        <Field id="iup-country" label="Country" required hint="The destinations course search offers.">
          <SelectInput id="iup-country" value={v.country} onChange={(e) => set({ country: e.target.value as Destination, state: '' })}>
            {DESTINATIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="iup-state" label="State" required error={show('state')}>
          <SelectInput id="iup-state" value={v.state} placeholder="Pick its state" invalid={!!show('state')} onChange={(e) => set({ state: e.target.value })}>
            {states.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="iup-web" label="Website" required error={show('website')}>
          <TextInput id="iup-web" value={v.website ?? ''} invalid={!!show('website')} onChange={(e) => set({ website: e.target.value })} placeholder="Like: https://abertay.ac.uk" />
        </Field>
        <Field id="iup-founded" label="Founded" required error={show('founded')}>
          <TextInput id="iup-founded" inputMode="numeric" value={founded} invalid={!!show('founded')} onChange={(e) => setFounded(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Like: 1994" />
        </Field>
        <Field id="iup-priority" label="Search priority" required error={show('priority')}>
          <div className={`control istepper ${show('priority') ? 'is-invalid' : ''}`}>
            <button type="button" className="istepper__b" aria-label="Lower the search priority" disabled={pr <= 1} onClick={() => step(-1)}>
              <Icon name="minus" size={18} />
            </button>
            <input id="iup-priority" className="control__input istepper__v num" inputMode="numeric" value={prio} aria-invalid={!!show('priority') || undefined} onChange={(e) => setPrio(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={() => prio && step(0)} />
            <button type="button" className="istepper__b" aria-label="Raise the search priority" disabled={pr >= 10} onClick={() => step(1)}>
              <Icon name="plus" size={18} />
            </button>
          </div>
        </Field>
        <Field id="iup-qs" label="QS world ranking">
          <TextInput id="iup-qs" value={u?.qs ? String(u.qs) : '—'} readOnly disabled />
        </Field>
        {v.country === 'Australia' && (
          <Field id="iup-cricos" label="CRICOS provider code" optional>
            <TextInput id="iup-cricos" value={v.cricos} onChange={(e) => set({ cricos: e.target.value.toUpperCase() })} placeholder="Like: 00114A" />
          </Field>
        )}
        <div className={`field iform__wide ${show('logo') || logoErr ? 'field--error' : ''}`}>
          <span className="field__label" id="iup-logo-l">
            Logo
            <span className="field__req" aria-hidden="true">
              *
            </span>
            <span className="vh"> (required)</span>
          </span>
          <div className="ilogo">
            <LogoPlate u={{ name: v.name, logo: v.logo, mark: v.mark }} big />
            <button type="button" className={`idrop ilogo__drop ${show('logo') || logoErr ? 'is-invalid' : ''}`} aria-describedby="iup-logo-l iup-logo-h" onClick={() => pick.current?.click()}>
              <Icon name="upload" size={20} />
              <span className="idrop__t">{v.logo ?? v.mark ? 'Replace logo' : 'Upload logo'}</span>
            </button>
          </div>
          <input
            ref={pick}
            type="file"
            accept={`${IMAGE_TYPES},.svg,image/svg+xml`}
            className="vh"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="iup-logo"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const src = await readImage(f, /^image\/(png|jpe?g|webp|svg\+xml)$/);
                setLogoErr(null);
                set({ logo: src, mark: src });
              } catch (m) {
                setLogoErr(String(m).replace('isn’t a PNG, JPG or WebP image', 'isn’t a PNG, JPG, SVG or WebP image'));
              }
            }}
          />
          {logoErr || show('logo') ? (
            <ErrorText>{logoErr ?? show('logo')}</ErrorText>
          ) : (
            <p className="field__msg" id="iup-logo-h">
              PNG, JPG, SVG or WebP, up to {MAX_MB} MB. Shown on course cards and the university’s page.
            </p>
          )}
        </div>
        <Field id="iup-about" label="About" hint="Shown to RPs on the university’s page." className="iform__wide">
          <div className="control iform__area">
            <textarea id="iup-about" className="control__input" rows={3} value={v.about ?? ''} onChange={(e) => set({ about: e.target.value })} />
          </div>
        </Field>
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
