import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Checkbox, Field, SelectInput, TextInput } from '../../components/forms';
import { AREAS, LEVELS, type Area, type Level } from '../../data/courses';
import { COUNTRIES, TOP_MARKETS } from '../../data/partners';
import { ANN_CATEGORIES, ANN_STATUSES, PERMISSION_ROLES, SALES_REGIONS, SUBCATEGORIES, USER_TYPES, statusOf, type AnnCategory, type AnnStatus, type Announcement } from '../data/announcements';
import { dateText, inDays, stampBy, todayIso } from '../data/records';
import { patch } from '../data/store';
import { NoMatch, PageHead, Tiles, Updated, useRecord, type Tone } from './parts';
import { MultiPick } from './MultiPick';
import { RichText, cleanHtml, textOf } from './RichText';
import type { PageProps } from '../portal/model';

const TONE: Record<AnnStatus, Tone> = { Draft: 'gsp', Scheduled: 'uni', Live: 'ok', Expired: 'grey', Withdrawn: 'grey' };
const PILL: Record<Tone, string> = { ok: 'dpill--verified', gsp: 'dpill--checking', uni: 'dpill--uni', you: 'dpill--missing', bad: 'dpill--bad', grey: 'idpill--grey' };
const SUB: Record<AnnStatus, string> = { Draft: 'Not published', Scheduled: 'Publishes on its date', Live: 'Partners see it now', Expired: 'Past its end date', Withdrawn: 'Taken down early' };
const COUNTRY_LIST = [...TOP_MARKETS, ...COUNTRIES.map((c) => c.name).filter((n) => !TOP_MARKETS.includes(n))];

/**
 * Announcements (29 Oct; 6th round, as in the PM prototype's IP team): news for recruitment partners about the
 * universities, shown in their portal's top bar, on matching course cards and on the university's page from its
 * publish date until it expires, and by email if asked. The PM's fields only, and no change log. In this prototype
 * they stay in the Institution Team's portal. 29 Oct (7th round): Publish on is a date, with no time.
 */
export function Announcements(props: PageProps) {
  const { db, set, focus, navKey, open, say, scrollTop, me } = props;
  const { cur, show, back } = useRecord(focus, navKey, scrollTop, open);
  const [status, setStatus] = useState<AnnStatus | ''>('');
  const [cat, setCat] = useState('');
  const [uni, setUni] = useState('');
  const [q, setQ] = useState('');
  const anns = db.anns;
  const uniName = (id: string) => db.unis.find((u) => u.id === id)?.name ?? id;
  const rows = anns
    .filter((a) => {
      const t = q.trim().toLowerCase();
      if (t && !`${a.title} ${a.id} ${a.author}`.toLowerCase().includes(t)) return false;
      if (status && statusOf(a) !== status) return false;
      if (cat && a.category !== cat) return false;
      if (uni && !a.unis.includes(uni)) return false;
      return true;
    })
    .sort((a, b) => b.publish.localeCompare(a.publish));
  const clear = () => {
    setStatus('');
    setCat('');
    setUni('');
    setQ('');
  };
  const nextId = () => `AN-${Math.max(...anns.map((a) => Number(a.id.slice(3))), 100) + 1}`;

  if (cur) {
    const a = cur.id === 'new' ? null : anns.find((x) => x.id === cur.id);
    if (cur.id === 'new' || a)
      return (
        <AnnPage
          key={cur.id}
          a={a ?? null}
          id={a?.id ?? nextId()}
          me={me}
          unis={db.unis.filter((u) => u.status !== 'Ended')}
          onBack={back}
          onSave={(x, what) => {
            set((d) => ({ ...d, anns: d.anns.some((y) => y.id === x.id) ? patch(d.anns, x.id, () => x) : [x, ...d.anns] }));
            say(what);
            back();
          }}
        />
      );
  }

  return (
    <div className="ipage">
      <PageHead title="Announcements" lead="Shown to recruitment partners in their portal’s top bar, on matching course cards and on the university’s page.">
        <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => show('new')}>
          New announcement
        </Button>
      </PageHead>

      <Tiles label="Where each announcement is" value={status} onPick={setStatus} items={ANN_STATUSES.map((s) => ({ key: s, label: s, sub: SUB[s], tone: TONE[s], n: anns.filter((a) => statusOf(a) === s).length }))} />

      <section className="card stable" aria-labelledby="iann-count">
        <div className="stools">
          <div className="stools__row">
            <label className="ssearch">
              <Icon name="search" size={18} />
              <span className="vh">Search announcements</span>
              <input id="iann-q" type="search" placeholder="Title, number or author" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <SelectInput id="iann-cat" aria-label="Category" value={cat} placeholder="All categories" allowEmpty onChange={(e) => setCat(e.target.value)}>
              {ANN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="iann-uni" aria-label="University" value={uni} placeholder="All universities" allowEmpty onChange={(e) => setUni(e.target.value)}>
              {[...new Set(anns.flatMap((a) => a.unis))].map((id) => (
                <option key={id} value={id}>
                  {uniName(id)}
                </option>
              ))}
            </SelectInput>
          </div>
          <p className="stools__count" id="iann-count" role="status">
            <span>
              <span className="num">{rows.length === anns.length ? anns.length : `${rows.length} of ${anns.length}`}</span> announcements
            </span>
          </p>
        </div>
        {rows.length === 0 ? (
          <NoMatch what="announcements" onClear={clear} />
        ) : (
          <div className="stab-wrap">
            <table className="itab itab--ann">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Category</th>
                  <th scope="col">Universities</th>
                  <th scope="col">Publish on</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Author</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const s = statusOf(a);
                  return (
                    <tr key={a.id} className="irow" onClick={() => show(a.id)}>
                      <td>
                        <button type="button" className="irow__open" onClick={(e) => (e.stopPropagation(), show(a.id))}>
                          {a.title}
                        </button>
                        <span className="irow__sub">{a.id}</span>
                      </td>
                      <td>
                        {a.category}
                        {a.subcategory && <span className="irow__sub">{a.subcategory}</span>}
                      </td>
                      <td>{a.unis.length ? (a.unis.length === 1 ? uniName(a.unis[0]) : `${a.unis.length} universities`) : <span className="muted">—</span>}</td>
                      <td className="num">{dateText(a.publish)}</td>
                      <td className="num">{dateText(a.expires)}</td>
                      <td>{a.author === me ? `${a.author} (you)` : a.author}</td>
                      <td>
                        <span className={`dpill ${PILL[TONE[s]]}`}>{s}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type Draft = { title: string; category: AnnCategory | ''; subcategory: string; unis: string[]; levels: Level[]; areas: Area[]; publishDay: string; expires: string; body: string; files: string[]; email: boolean; userTypes: string[]; roles: string[]; countries: string[]; regions: string[] };

/** One announcement: written, previewed, then saved as a draft, scheduled or published; a live one can be withdrawn. */
function AnnPage({ a, id, me, unis, onBack, onSave }: { a: Announcement | null; id: string; me: string; unis: PageProps['db']['unis']; onBack: () => void; onSave: (a: Announcement, what: string) => void }) {
  const s = a ? statusOf(a) : 'Draft';
  const locked = s === 'Expired' || s === 'Withdrawn';
  const [v, setV] = useState<Draft>(() =>
    a
      ? { title: a.title, category: a.category, subcategory: a.subcategory, unis: a.unis, levels: a.levels, areas: a.areas, publishDay: a.publish.slice(0, 10), expires: a.expires, body: a.body, files: a.files, email: a.email, userTypes: a.userTypes, roles: a.roles, countries: a.countries, regions: a.regions }
      : { title: '', category: '', subcategory: '', unis: [], levels: [], areas: [], publishDay: inDays(0), expires: inDays(30), body: '', files: [], email: false, userTypes: ['RP'], roles: [], countries: [], regions: [] },
  );
  const [tried, setTried] = useState(false);
  const [preview, setPreview] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const set = (f: Partial<Draft>) => setV((x) => ({ ...x, ...f }));
  const subs = v.category ? SUBCATEGORIES[v.category] ?? [] : [];
  const needsUnis = v.category !== 'System Updates';
  const err = {
    title: !v.title.trim() ? 'Write a title.' : null,
    category: !v.category ? 'Pick a category.' : null,
    unis: needsUnis && !v.unis.length ? 'Pick the universities it’s about.' : null,
    publishDay: !v.publishDay ? 'Pick when it publishes.' : null,
    expires: !v.expires ? 'Pick when it expires.' : v.expires < v.publishDay ? 'It has to expire after it publishes.' : null,
    body: !textOf(v.body) ? 'Write the description.' : null,
    userTypes: !v.userTypes.length ? 'Pick who gets it.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const uniName = (x: string) => unis.find((u) => u.id === x)?.name ?? x;
  const build = (draft: boolean): Announcement => ({
    id,
    title: v.title.trim(),
    category: v.category as AnnCategory,
    subcategory: v.subcategory,
    unis: v.unis,
    levels: v.levels,
    areas: v.areas,
    publish: v.publishDay,
    expires: v.expires,
    body: cleanHtml(v.body),
    files: v.files,
    email: v.email,
    userTypes: v.userTypes,
    roles: v.roles,
    countries: v.countries,
    regions: v.regions,
    author: a?.author ?? me,
    draft,
    withdrawn: a?.withdrawn ?? false,
    reached: a?.reached ?? 0,
    sent: a?.sent ?? 0,
    opened: a?.opened ?? 0,
    updated: stampBy(me),
  });
  const future = v.publishDay > todayIso();
  const go = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave(build(false), s === 'Live' ? 'Saved.' : future ? `Scheduled for ${dateText(v.publishDay)}.` : 'Published: partners see it now.');
  };
  const pickById = (label: string, idx: string, value: string[], onChange: (x: string[]) => void) => (
    <MultiPick id={idx} label={label} value={value.map(uniName)} options={unis.map((u) => u.name)} onChange={(names) => onChange(names.map((n) => unis.find((u) => u.name === n)?.id ?? n))} empty="Choose" search />
  );

  return (
    <div className="ipage irecord">
      <button type="button" className="rback" onClick={onBack}>
        <Icon name="arrowLeft" size={18} />
        Announcements
      </button>
      <header className="ianhead">
        <div>
          <h1 className="page__title">{a ? a.title : 'New announcement'}</h1>
          <p className="stu__lead">
            {id} · {s}
          </p>
          <Updated s={a?.updated} />
        </div>
      </header>

      <div className="ianbody">
        <section className="card irsec" aria-label="The announcement">
          <fieldset className="ianform" disabled={locked}>
            <div className="iform__grid">
              <Field id="ian-title" label="Title" required error={show('title')} className="iform__wide">
                <TextInput id="ian-title" value={v.title} invalid={!!show('title')} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field id="ian-cat" label="Category" required error={show('category')}>
                <SelectInput id="ian-cat" value={v.category} placeholder="Choose" invalid={!!show('category')} onChange={(e) => set({ category: e.target.value as AnnCategory, subcategory: '' })}>
                  {ANN_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field id="ian-sub" label="Subcategory" optional>
                <SelectInput id="ian-sub" value={v.subcategory} placeholder="Choose" allowEmpty disabled={!subs.length} onChange={(e) => set({ subcategory: e.target.value })}>
                  {subs.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field id="ian-unis" label="Universities" required={needsUnis} optional={!needsUnis} error={show('unis')} className="iform__wide">
                {pickById('Universities', 'ian-unis', v.unis, (unis) => set({ unis }))}
              </Field>
              <Field id="ian-levels" label="Program level" optional>
                <MultiPick id="ian-levels" label="Program level" value={v.levels} options={[...LEVELS]} onChange={(x) => set({ levels: x as Level[] })} empty="All levels" all="All levels" />
              </Field>
              <Field id="ian-areas" label="Study area" optional>
                <MultiPick id="ian-areas" label="Study area" value={v.areas} options={[...AREAS]} onChange={(x) => set({ areas: x as Area[] })} empty="All areas" all="All areas" search />
              </Field>
              <Field id="ian-pub" label="Publish on" required error={show('publishDay')}>
                <TextInput id="ian-pub" type="date" value={v.publishDay} invalid={!!show('publishDay')} onChange={(e) => set({ publishDay: e.target.value })} />
              </Field>
              <Field id="ian-exp" label="Expires on" required error={show('expires')}>
                <TextInput id="ian-exp" type="date" value={v.expires} invalid={!!show('expires')} onChange={(e) => set({ expires: e.target.value })} />
              </Field>
              <Field id="ian-body" label="Description" required error={show('body')} className="iform__wide">
                <RichText id="ian-body" value={v.body} onChange={(body) => set({ body })} files={v.files} onFiles={(files) => set({ files })} invalid={!!show('body')} disabled={locked} />
              </Field>
              <div className="iform__wide">
                <Checkbox id="ian-email" checked={v.email} onChange={(email) => set({ email })} hint="One email at Publish on, from no-reply, to recipients who opted in.">
                  Send as email
                </Checkbox>
              </div>
            </div>
            <h3 className="iblock__title ianform__k">Recipients</h3>
            <div className="iform__grid">
              <Field id="ian-types" label="User type" required error={show('userTypes')}>
                <MultiPick id="ian-types" label="User type" value={v.userTypes} options={[...USER_TYPES]} onChange={(userTypes) => set({ userTypes })} empty="Choose" />
              </Field>
              <Field id="ian-roles" label="Permission role" optional>
                <MultiPick id="ian-roles" label="Permission role" value={v.roles} options={[...PERMISSION_ROLES]} onChange={(roles) => set({ roles })} empty="All roles" all="All roles" />
              </Field>
              <Field id="ian-countries" label="RP country" optional>
                <MultiPick id="ian-countries" label="RP country" value={v.countries} options={COUNTRY_LIST} onChange={(countries) => set({ countries })} empty="All countries" all="All countries" search />
              </Field>
              <Field id="ian-regions" label="Sales region" optional>
                <MultiPick id="ian-regions" label="Sales region" value={v.regions} options={[...SALES_REGIONS]} onChange={(regions) => set({ regions })} empty="All regions" all="All regions" />
              </Field>
            </div>
          </fieldset>
          {!locked && (
            <div className="ianacts">
              <Button variant="secondary" iconLeft={<Icon name="eye" size={16} />} onClick={() => setPreview(true)}>
                Preview
              </Button>
              {s !== 'Live' && s !== 'Scheduled' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!v.title.trim()) return setTried(true);
                    onSave(build(true), 'Draft saved.');
                  }}
                >
                  Save draft
                </Button>
              )}
              {(s === 'Live' || s === 'Scheduled') && (
                <Button variant="secondary" onClick={() => setWithdrawing(true)}>
                  Withdraw
                </Button>
              )}
              <Button onClick={go}>{s === 'Live' ? 'Save' : future ? 'Schedule' : 'Publish'}</Button>
            </div>
          )}
        </section>

        <aside className="ianside" aria-label="System information">
          <section className="card irsec">
            <h2 className="irsec__title">System information</h2>
            <dl className="ifacts ifacts--one">
              {(
                [
                  ['Created by', a?.author ?? me],
                  ['Status', s],
                  ['Recipients reached', a?.reached ? a.reached.toLocaleString('en-GB') : '—'],
                  ['Emails sent / opened', a?.sent ? `${a.sent} / ${a.opened}` : '—'],
                ] as const
              ).map(([k, x]) => (
                <div key={k} className="ifacts__row">
                  <dt>{k}</dt>
                  <dd className="num">{x}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>

      <Sheet open={preview} onClose={() => setPreview(false)} center className="iform" title="How partners see it" sub="In the top bar of their portal, on matching course cards and on the university’s page.">
        <article className="ianprev">
          <p className="ianprev__k">
            <Icon name="mail" size={16} /> {v.category || 'Announcement'}
            {v.subcategory ? ` · ${v.subcategory}` : ''}
            {v.unis.length ? ` · ${v.unis.map(uniName).join(', ')}` : ''}
          </p>
          <h3 className="ianprev__title">{v.title || 'Your title'}</h3>
          {textOf(v.body) ? <div className="ianprev__body" dangerouslySetInnerHTML={{ __html: cleanHtml(v.body) }} /> : <p className="ianprev__body">The description.</p>}
          {v.files.length > 0 && (
            <ul className="irt__files">
              {v.files.map((f) => (
                <li key={f} className="itag">
                  <Icon name="file" size={14} /> {f}
                </li>
              ))}
            </ul>
          )}
          <p className="ianprev__foot">Until {v.expires ? dateText(v.expires) : '…'}</p>
        </article>
      </Sheet>
      <ConfirmDialog
        open={withdrawing}
        title="Withdraw this announcement?"
        confirm="Withdraw"
        onConfirm={() => {
          setWithdrawing(false);
          if (a) onSave({ ...build(false), withdrawn: true }, 'Withdrawn: partners no longer see it.');
        }}
        onCancel={() => setWithdrawing(false)}
      >
        <p>Partners stop seeing it straight away. Emails already sent can’t be taken back.</p>
      </ConfirmDialog>
    </div>
  );
}
