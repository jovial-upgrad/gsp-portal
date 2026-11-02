import { fmtDate } from '../../data/format';
import { UniNews } from '../../components/UniNews';

import { CostsTab } from './CostsTab';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { searchCatalogue } from '../../institution/data/store';
import { FLAG, FLAG_COLOURS, blockedFor, daysTo, durationText, earnOf, feeAYear, intakeState, money, totalTuition, type Campus, type Course, type University, intakeDates } from '../../data/courses';
import type { Student } from '../../data/students';
import { EntryTab } from './EntryTab';
import type { CourseSearch } from './search';
import { Box, Tile, UniLogo, UniMark, campusLabel } from './parts';
import { CampusLife, photosOf } from './CampusLife';

const day = (iso: string) => fmtDate(iso.length > 10 ? new Date(iso) : iso);
const ease = [0.2, 0.8, 0.2, 1] as const;

const TABS = [
  ['overview', 'Overview'],
  ['costs', 'Costs'],
  ['entry', 'Eligibility and documents'],
  ['uni', 'University'],
] as const;
type Tab = (typeof TABS)[number][0];


/** The same course for the same student at other universities in the destination, closest in price first. */
function similarTo(c: Course, s: CourseSearch) {
  const seen = new Set<string>([c.uni.id]);
  return searchCatalogue().courses.filter((x) => x.uni.country === c.uni.country && x.level === c.level && x.area === c.area && !blockedFor(x.uni, s.need.country, s.need.state))
    .sort((a, b) => Math.abs(a.tuition - c.tuition) - Math.abs(b.tuition - c.tuition))
    .filter((x) => !seen.has(x.uni.id) && seen.add(x.uni.id))
    .slice(0, 3);
}

/** Days to an intake's apply-by date, in words. */

/** "AUD 39,700" as a figure: the currency small and grey, the number large. */
function Money({ v, cur, approx = false }: { v: number; cur: string; approx?: boolean }) {
  const [code, num] = money(v, cur).split(' ');
  return (
    <>
      {approx && <span className="cm-unit">≈ </span>}
      <span className="cm-unit">{code} </span>
      {num}
    </>
  );
}

/**
 * One course, everything an agency checks before applying, as a dialog in the middle of the window (a sheet
 * from the bottom on phones) that scrolls as one. The header wears the destination's flag, as the result card
 * does, with the course's key facts in a strip; a slim bar with the four tabs, Shortlist and Apply stays at
 * the top while the rest scrolls. The tabs hold the course and its campus, what it costs, what the student
 * needs to get in and which documents to collect, and the university with all its campuses, each part on its
 * own card. The end says where the facts came from and when they were checked.
 */
export function CourseSheet({
  c,
  s,
  onClose,
  canApply,
  agency,
  onApply,
  onPick,
  student,
}: {
  c: Course | null;
  s: CourseSearch;
  /** The student picked in the search: the Eligibility tab shows each rule's verdict for them. */
  student?: Student;
  onClose: () => void;
  shortlisted: boolean;
  /** Shortlist: for the student picked in the search, or a list of students to pick from (shown under the button). */
  onShort: (anchor: HTMLElement) => void;
  /** Why Shortlist is off (no students yet), when it is. */
  shortOff?: string;
  canApply: boolean;
  agency: string;
  onApply: () => void;
  /** Open another course here: a similar one, or the same course on another campus. */
  onPick: (c: Course) => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  // whose entry requirements: the search's student country to start with (the selected student's), kept from tab to tab
  const [from, setFrom] = useState(s.need.country || 'India');
  useEffect(() => setFrom(s.need.country || 'India'), [s.need.country]);
  // the button that opened the next course goes away with this one, so focus moves to the new course's tabs
  const pick = (x: Course) => {
    onPick(x);
    requestAnimationFrame(() => document.getElementById('cs-tab-overview')?.focus());
  };
  const body = useRef<HTMLDivElement>(null);
  const id = c?.id;
  // a new course opens on its overview, at the top
  useEffect(() => {
    setTab('overview');
    body.current?.closest('.sheet__scroll')?.scrollTo({ top: 0 });
  }, [id]);
  // once the bar reaches the top it stays there, over the content, and makes room for the close button
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const scroll = body.current?.closest<HTMLElement>('.sheet__scroll');
    const bar = scroll?.querySelector<HTMLElement>('.cm-bar');
    if (!scroll || !bar) return;
    const check = () => setStuck(scroll.scrollTop > 0 && bar.getBoundingClientRect().top - scroll.getBoundingClientRect().top < 1);
    check();
    scroll.addEventListener('scroll', check, { passive: true });
    return () => scroll.removeEventListener('scroll', check);
  }, [id]);
  // another tab starts just under the bar, if the reader had scrolled past the header
  useEffect(() => {
    const scroll = body.current?.closest<HTMLElement>('.sheet__scroll');
    const start = body.current?.closest<HTMLElement>('.sheet__body');
    const bar = scroll?.querySelector<HTMLElement>('.cm-bar');
    if (!scroll || !start || !bar) return;
    const top = start.offsetTop - bar.offsetHeight;
    if (scroll.scrollTop > top) scroll.scrollTo({ top });
  }, [tab]);

  const flag = c ? ({ '--flag-1': FLAG_COLOURS[c.uni.country][0], '--flag-2': FLAG_COLOURS[c.uni.country][1] } as CSSProperties) : undefined;

  return (
    <Sheet
      open={!!c}
      onClose={onClose}
      modal
      expandable
      className="cmodal"
      style={flag}
      title={c?.name ?? ''}
      lead={
        c && (
          <>
            <span className="cm-country">
              <span className="cm-country__flag" aria-hidden="true">
                {FLAG[c.uni.country]}
              </span>
              {c.uni.country}
            </span>
            <UniLogo u={c.uni} />
          </>
        )
      }
      sub={
        c && (
          <span className="cs-sub">
            <span>
              {c.uni.name} · {campusLabel(c.campus)}
            </span>
            {c.uni.website && (
              <a className="cs-web" href={`https://${c.uni.website}`} target="_blank" rel="noreferrer">
                {c.uni.website}
                <Icon name="external" size={14} />
                <span className="vh"> (opens in a new tab)</span>
              </a>
            )}
          </span>
        )
      }
      band={c && <Facts c={c} s={s} canApply={canApply} agency={agency} />}
      nav={
        c && (
          <div className={`cm-bar ${stuck ? 'is-stuck' : ''}`}>
            <Tabs tab={tab} setTab={setTab} />
            <div className="csheet__acts">
              {/* slice 3 PRD: Apply only; no Compare or Shortlist in the course page (both stay on the result cards) */}
              <Button onClick={onApply} disabled={!canApply} iconRight={canApply ? <Icon name="arrowRight" size={18} /> : undefined}>
                Apply
              </Button>
            </div>
          </div>
        )
      }
      footer={
        c && (
          <p className="csheet__src">
            <Icon name="refresh" size={14} />
            <span>
              Last updated {fmtDate(c.checked)}.
            </span>
          </p>
        )
      }
    >
      {c && (
        <div className="csheet" ref={body}>
          <Panel tab={tab} id={c.id}>
            {tab === 'overview' && <Overview c={c} s={s} onPick={pick} />}
            {tab === 'costs' && <CostsTab c={c} />}
            {tab === 'entry' && <EntryTab c={c} country={from} onCountry={setFrom} student={student} />}
            {tab === 'uni' && <Uni c={c} />}
          </Panel>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- the header's tags and fact strip ---------- */

const MODE_NOTE: Record<Course['mode'], string> = { 'Full time': 'On campus', 'Part time': 'On campus', Blended: 'On campus and online', Online: 'Online only' };

/** The course's tags and CRICOS code, from the Institution Team's course record (Jovial, 31 Oct). */
const recordOf = (c: Course) => c as Course & { tags?: string[]; code?: string };
function Facts({ c, s, canApply, agency }: { c: Course; s: CourseSearch; canApply: boolean; agency: string }) {
  const rec = recordOf(c);
  return (
    <div className="cm-band">
      {(rec.tags?.length || (c.uni.country === 'Australia' && c.cricos)) && (
        <div className="csheet__tags">
          {rec.tags?.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          {c.uni.country === 'Australia' && c.cricos && <span className="tag">CRICOS {c.cricos}</span>}
        </div>
      )}
      <dl className={`cs-stats ${s.studentView ? 'is-3' : ''}`}>
        <div className="cs-stat">
          <dt>Study mode</dt>
          <dd className="cs-stat__v">{c.mode}</dd>
          <dd className="cs-stat__sub">{MODE_NOTE[c.mode]}</dd>
        </div>
        <div className="cs-stat">
          <dt>Duration</dt>
          <dd className="cs-stat__v">{durationText(c)}</dd>
        </div>
        <div className="cs-stat">
          <dt>Total tuition</dt>
          <dd className="cs-stat__v">
            <Money v={totalTuition(c)} cur={c.currency} />
          </dd>
          <dd className="cs-stat__sub">{money(feeAYear(c), c.currency)} a year</dd>
        </div>
        {!s.studentView && (
          <div className="cs-stat is-earn">
            <dt>Base commission</dt>
            <dd className="cs-stat__v">
              <Money v={earnOf(c)} cur={c.currency} approx />
            </dd>
            <dd className="cs-stat__sub">Once the student enrols</dd>
          </div>
        )}
      </dl>
      {!canApply && (
        <p className="csheet__lock">
          <Icon name="lock" size={14} />
          <span>Applications open once GSP verifies {agency || 'your agency'}.</span>
        </p>
      )}
    </div>
  );
}

/* ---------- tabs ---------- */

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const reduce = useReducedMotion();
  const list = useRef<HTMLDivElement>(null);
  // arrow keys move between tabs and pick them, as the ARIA tabs pattern does
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const to = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(TABS[to][0]);
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[to]?.focus();
  };
  return (
    <div className="cs-tabs" role="tablist" aria-label="Course details" ref={list} onKeyDown={onKey}>
      {TABS.map(([k, label]) => (
        <button key={k} type="button" role="tab" id={`cs-tab-${k}`} aria-controls="cs-panel" aria-selected={tab === k} tabIndex={tab === k ? 0 : -1} className="cs-tab" onClick={() => setTab(k)}>
          {label}
          {tab === k && <motion.span className="cs-tab__bar" layoutId="cs-tab-bar" transition={reduce ? { duration: 0 } : { duration: 0.28, ease }} />}
        </button>
      ))}
    </div>
  );
}

function Panel({ tab, id, children }: { tab: Tab; id: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${id}:${tab}`}
        id="cs-panel"
        role="tabpanel"
        aria-labelledby={`cs-tab-${tab}`}
        className="cs-panel"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.2, ease }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------- overview: the course and its campus ---------- */

function Overview({ c, s, onPick }: { c: Course; s: CourseSearch; onPick: (c: Course) => void }) {
  const elsewhere = searchCatalogue().courses.filter((x) => x.uni.id === c.uni.id && x.name === c.name && x.id !== c.id);
  const similar = similarTo(c, s);
  // in pairs, row by row, so the cards beside each other start and end together
  return (
    <>
      {/* the university's announcements (Jovial, 31 Oct) */}
      <UniNews c={c} audience="RP" />
    <div className="cm-grid">
      <Box id="cs-intakes" icon="calendar" title="Intakes">
        <ol className="cm-intakes">
          {c.intakes.map((i) => {
            const st = intakeState(i);
            const by = new Date(i.deadline);
            return (
              <li key={i.month} className={`cm-intake ${st === 'closed' ? 'is-closed' : ''}`}>
                <span className="cm-cal" aria-hidden="true">
                  <span className="cm-cal__m">{fmtDate(by, { year: false }).split(' ')[1]}</span>
                  <span className="cm-cal__d">{by.getDate()}</span>
                </span>
                <span className="cm-intake__t">
                  <span className="cm-intake__name">{i.month} intake</span>
                  <span className="cm-intake__by">{st === 'closed' ? `Closed ${day(i.deadline)}` : st === 'late' ? `Closed ${day(i.deadline)}: likelihood is low` : `Apply by ${day(i.deadline)} · ${daysTo(i.deadline)} ${daysTo(i.deadline) === 1 ? 'day' : 'days'} left`}</span>
                  {intakeDates(c.id, i.month)?.start && (
                    <span className="cm-intake__by">
                      Starts {day(intakeDates(c.id, i.month)!.start)} · Census {day(intakeDates(c.id, i.month)!.census)}
                    </span>
                  )}
                </span>
                {st === 'closed' && (
                  <span className="cm-state cm-state--closed">
                    <span className="cm-state__dot" aria-hidden="true" />
                    Closed
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Box>

      <Box id="cs-campus" icon="pin" title="Campus">
        <CampusCard u={c.uni} k={c.campus} />
        {elsewhere.length > 0 && (
          <p className="cs-also">
            Also taught at{' '}
            {elsewhere.map((x, i) => (
              <span key={x.id}>
                {i > 0 && ', '}
                <button type="button" className="cs-linkbtn" onClick={() => onPick(x)}>
                  {x.campus.name} campus
                </button>
              </span>
            ))}
            .
          </p>
        )}
      </Box>

      {similar.length > 0 && (
        <Box id="cs-similar" icon="search" title="Similar courses for this student">
          <ul className="cs-similar">
            {similar.map((x) => (
              <li key={x.id}>
                <button type="button" className="cs-sim" onClick={() => onPick(x)}>
                  <UniMark u={x.uni} />
                  <span className="cs-sim__t">
                    <span className="cs-sim__name">{x.name}</span>
                    <span className="cs-sim__uni">
                      {x.uni.name} · {x.campus.city}
                    </span>
                  </span>
                  <span className="cs-sim__fee">
                    {money(totalTuition(x), x.currency)}
                    <span className="cs-sim__per"> in all</span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </Box>
      )}
    </div>
    </>
  );
}

/** A campus with a map tile, from the campus record: its address, setting and its Google Maps link (30 Oct: nothing about regional visas). */
function CampusCard({ k, current = false }: { u: University; k: Campus; current?: boolean }) {
  return (
    <div className={`cs-campus ${current ? 'is-current' : ''}`}>
      <span className="cs-campus__tile" aria-hidden="true">
        <Icon name="pin" size={20} />
      </span>
      <div className="cs-campus__t">
        <p className="cs-campus__name">
          {k.name === k.city ? k.city : `${k.name} campus`}
          {current && <span className="tag tag--here">This course</span>}
        </p>
        <p className="cs-campus__addr">{k.address ?? k.city}</p>
        <p className="cs-campus__meta">
          {[k.name !== k.city && k.city, k.setting].filter(Boolean).join(' · ')}
        </p>
      </div>
      {/* the campus record's Google Maps link (HC3); none, no link */}
      {k.map && (
        <a className="cs-campus__map" href={k.map} target="_blank" rel="noreferrer">
          View on map
          <Icon name="external" size={14} />
          <span className="vh"> of {k.name}, opens in a new tab</span>
        </a>
      )}
    </div>
  );
}

/* ---------- the university and its campuses ---------- */

function Uni({ c }: { c: Course }) {
  const u = c.uni;
  const life = photosOf(u);
  const facts: [string, string][] = [
    // from the university record (Jovial, 1 Nov, HC2, HC3): its type and sector, founding year and QS rank
    ...(u.utype ? ([['Type', `${u.sector ?? ''} ${u.sector ? u.utype.toLowerCase() : u.utype}`.trim()]] as [string, string][]) : []),
    ...(u.founded ? ([['Founded', String(u.founded)]] as [string, string][]) : []),
    ['QS world ranking', u.qs ? `#${u.qs}` : 'Not ranked'],
  ];
  return (
    <>
      <section className="cs-uni" aria-labelledby="cs-uni-name">
        <div className="cs-uni__head">
          <UniLogo u={u} />
          <div className="cs-uni__titles">
            <h3 id="cs-uni-name" className="cs-uni__name">
              {u.name}
            </h3>
            {u.website && (
              <a className="cs-web" href={`https://${u.website}`} target="_blank" rel="noreferrer">
                {u.website}
                <Icon name="external" size={14} />
                <span className="vh"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
        {u.about && <p className="cs-uni__about">{u.about}</p>}
        <dl className="cm-tiles">
          {facts.map(([k, v]) => (
            <Tile key={k} k={k} v={v} />
          ))}
        </dl>
      </section>

      {/* the university record's Pictures (HC11); none, no Campus life */}
      {life.length > 0 && (
        <Box id="cs-life" icon="building" title="Campus life">
          <CampusLife list={life} />
        </Box>
      )}

      <Box id="cs-campuses" icon="pin" title={u.campuses.length === 1 ? 'Campus' : `${u.campuses.length} campuses`}>
        <ul className="cs-campuses">
          {u.campuses.map((k) => (
            <li key={k.name}>
              <CampusCard u={u} k={k} current={k.name === c.campus.name} />
            </li>
          ))}
        </ul>
      </Box>
    </>
  );
}
