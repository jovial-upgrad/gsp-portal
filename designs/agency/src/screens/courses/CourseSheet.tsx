import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useHides } from '../../proto/viewOnly';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { COURSES, FLAG, FLAG_COLOURS, blockedFor, coursePage, earnOf, intakeState, money, scholarshipsOf, type Course } from '../../data/courses';
import { RP_COUNTRY } from '../../data/entry';
import { EntryTab } from './EntryTab';
import type { CourseSearch } from './search';
import { ScholarshipCards } from './Scholarships';
import { CampusCard, UniTab } from './UniTab';
import { Box, UniLogo, UniMark, campusLabel, duration } from './parts';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
  return COURSES.filter((x) => x.uni.country === c.uni.country && x.level === c.level && x.area === c.area && !blockedFor(x.uni, s.need.country, s.need.state))
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
  shortlisted,
  onShort,
  compared = false,
  comparable = true,
  onCompare,
  canApply,
  agency,
  onApply,
  onPick,
}: {
  c: Course | null;
  s: CourseSearch;
  onClose: () => void;
  shortlisted: boolean;
  /** Shortlist: for the student picked in the search, or a list of students to pick from (shown under the button). */
  onShort: (anchor: HTMLElement) => void;
  /** Ticked to compare (up to five), beside Shortlist. */
  compared?: boolean;
  comparable?: boolean;
  onCompare?: () => void;
  canApply: boolean;
  agency: string;
  onApply: () => void;
  /** Open another course here: a similar one, or the same course on another campus. */
  onPick: (c: Course) => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  // whose entry requirements: the RP's own country to start with, kept from tab to tab
  const [from, setFrom] = useState(RP_COUNTRY);
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
            {coursePage(c) && (
              <a className="cs-web" href={coursePage(c)} target="_blank" rel="noreferrer" title={coursePage(c)}>
                Course page
                <Icon name="external" size={14} />
                <span className="vh"> on {c.uni.website ?? 'the university’s website'} (opens in a new tab)</span>
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
              {onCompare && (
                <label className={`ccmp ccmp--sheet ${compared ? 'is-on' : ''} ${comparable ? '' : 'is-off'}`} title={comparable ? undefined : 'Up to 5 courses'}>
                  <input type="checkbox" className="vh" checked={compared} disabled={!comparable} onChange={onCompare} aria-label={`Compare ${c.name}`} />
                  <span className="ccmp__box" aria-hidden="true">
                    <Icon name="check" size={12} strokeWidth={2.8} />
                  </span>
                  <span className="cm-acts__label" aria-hidden="true">
                    Compare
                  </span>
                </label>
              )}
              <Button variant="secondary" onClick={(e) => onShort(e.currentTarget)} aria-pressed={shortlisted} aria-label={shortlisted ? 'Shortlisted' : 'Shortlist'} iconLeft={<Icon name="star" size={18} className={shortlisted ? 'is-on' : undefined} />}>
                <span className="cm-acts__label">{shortlisted ? 'Shortlisted' : 'Shortlist'}</span>
              </Button>
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
              Last updated on {c.checked} 26, from {c.uni.website ?? 'the university’s website'}.
            </span>
          </p>
        )
      }
    >
      {c && (
        <div className="csheet" ref={body}>
          <Panel tab={tab} id={c.id}>
            {tab === 'overview' && <Overview c={c} s={s} onPick={pick} />}
            {tab === 'costs' && <Costs c={c} />}
            {tab === 'entry' && <EntryTab c={c} country={from} onCountry={setFrom} />}
            {tab === 'uni' && <UniTab c={c} courses={COURSES} />}
          </Panel>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- the header's tags and fact strip ---------- */

const MODE_NOTE: Record<Course['mode'], string> = { 'Full time': 'On campus', 'Part time': 'On campus', Blended: 'On campus and online', Online: 'Online only' };

function Facts({ c, s, canApply, agency }: { c: Course; s: CourseSearch; canApply: boolean; agency: string }) {
  const noCommission = useHides('courses.commission');
  return (
    <div className="cm-band">
      <dl className={`cs-stats ${s.studentView ? 'is-3' : ''}`}>
        <div className="cs-stat">
          <dt>Study mode</dt>
          <dd className="cs-stat__v">{c.mode}</dd>
          <dd className="cs-stat__sub">{MODE_NOTE[c.mode]}</dd>
        </div>
        <div className="cs-stat">
          <dt>Duration</dt>
          <dd className="cs-stat__v">{duration(c.months)}</dd>
        </div>
        <div className="cs-stat">
          <dt>Total tuition</dt>
          <dd className="cs-stat__v">
            <Money v={Math.round((c.tuition * c.months) / 12)} cur={c.currency} />
          </dd>
          <dd className="cs-stat__sub">{money(c.tuition, c.currency)} a year</dd>
        </div>
        {!s.studentView && !noCommission && (
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
  const elsewhere = COURSES.filter((x) => x.uni.id === c.uni.id && x.name === c.name && x.id !== c.id);
  const similar = similarTo(c, s);
  // in pairs, row by row, so the cards beside each other start and end together
  return (
    <div className="cm-grid">
      <Box id="cs-intakes" icon="calendar" title="Intakes">
        <ol className="cm-intakes">
          {c.intakes.map((i) => {
            const st = intakeState(i);
            const by = new Date(i.deadline);
            return (
              <li key={i.month} className={`cm-intake ${st === 'closed' ? 'is-closed' : ''}`}>
                <span className="cm-cal" aria-hidden="true">
                  <span className="cm-cal__m">{by.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3)}</span>
                  <span className="cm-cal__d">{by.getDate()}</span>
                </span>
                <span className="cm-intake__t">
                  <span className="cm-intake__name">{i.month} intake</span>
                  <span className="cm-intake__by">{st === 'closed' ? `Closed ${day(i.deadline)}` : `Apply by ${day(i.deadline)}`}</span>
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
                    {money(x.tuition, x.currency)}
                    <span className="cs-sim__per"> a year</span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </Box>
      )}
    </div>
  );
}


/* ---------- costs ---------- */

function Costs({ c }: { c: Course }) {
  const schols = scholarshipsOf(c);
  const others = c.otherFees.reduce((n, [, v]) => n + v, 0);
  const firstYear = c.tuition - c.scholarship + c.appFee + c.living + others;
  // the first year, part by part, in a fixed order: each part keeps its colour whatever the course
  const parts = [
    { key: 'tuition', label: c.scholarship ? 'Tuition, after the scholarship' : 'Tuition', v: c.tuition - c.scholarship },
    { key: 'living', label: 'Living costs', v: c.living },
    { key: 'visa', label: 'Visa and health cover', v: others },
    { key: 'app', label: 'Application fee', v: c.appFee },
  ].filter((x) => x.v > 0);
  return (
    <>
      <section className="cm-total" aria-labelledby="cs-total">
        <div className="cm-total__head">
          <h3 id="cs-total" className="cm-total__k">
            First year, all in
          </h3>
          <p className="cm-total__v">
            <Money v={firstYear} cur={c.currency} approx />
          </p>
          <p className="cm-total__note">For one student: tuition{c.scholarship ? ' after the scholarship' : ''}, living costs, visa and health cover{c.appFee ? ' and the application fee' : ''}.</p>
        </div>
        <CostBar parts={parts} total={firstYear} cur={c.currency} />
      </section>

      <div className="cm-grid">
        <Box id="cs-fees" icon="wallet" title="Fees">
          <dl className="cdl">
            <Row k="Total tuition" v={money(Math.round((c.tuition * c.months) / 12), c.currency)} />
            <Row k="Application fee" v={c.appFee ? money(c.appFee, c.currency) : 'Free'} />
          </dl>
        </Box>
        <Box id="cs-other" icon="globe" title="Other costs">
          <dl className="cdl">
            <Row k="Living costs a year (visa figure)" v={money(c.living, c.currency)} />
            {c.otherFees.map(([k, v]) => (
              <Row key={k} k={k} v={`≈ ${money(v, c.currency)}`} />
            ))}
          </dl>
          <p className="cs-fine">Visa and health cover are approximate, for one student. Check the official sites before quoting them.</p>
        </Box>
        <Box id="cs-schol" icon="award" title="Scholarships" meta={schols.length === 1 ? '1 listed' : `${schols.length} listed`}>
          {schols.length ? (
            <ScholarshipCards list={schols} />
          ) : (
            <p className="cnote">No scholarships listed for this course.</p>
          )}
        </Box>
      </div>
    </>
  );
}

/**
 * The first year as one bar split into its parts, with the parts listed under it in aligned columns (amount,
 * share), so no part relies on its colour alone. Pointing at a part shows its amount and share.
 */
function CostBar({ parts, total, cur }: { parts: { key: string; label: string; v: number }[]; total: number; cur: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const pct = (v: number) => Math.round((v / total) * 100);
  // where each part's middle falls along the bar, for the tip over it (kept inside the bar's ends)
  let at = 0;
  const mid = Object.fromEntries(parts.map((p) => [p.key, (at += p.v) - p.v / 2]));
  const on = parts.find((p) => p.key === hover);
  return (
    <div className="cbar">
      <div className="cbar__track" aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {parts.map((p) => (
          <span key={p.key} className={`cbar__seg cbar__seg--${p.key} ${hover && hover !== p.key ? 'is-dim' : ''}`} style={{ flexGrow: p.v }} onMouseEnter={() => setHover(p.key)} />
        ))}
        {on && (
          <div className="cbar__tip" style={{ left: `clamp(110px, ${(mid[on.key] / total) * 100}%, calc(100% - 110px))` }}>
            <strong>{on.label}</strong>
            <span>
              {money(on.v, cur)} · {pct(on.v)}%
            </span>
          </div>
        )}
      </div>
      <dl className="cbar__legend">
        {parts.map((p) => (
          <div key={p.key} className={`cbar__item ${hover === p.key ? 'is-on' : ''}`} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}>
            <dt>
              <span className={`cbar__key cbar__seg--${p.key}`} aria-hidden="true" />
              {p.label}
            </dt>
            <dd className="cbar__amt">{money(p.v, cur)}</dd>
            <dd className="cbar__pct">{pct(p.v)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------- the university and its campuses ---------- */



function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="cdl__row">
      <dt>{k}</dt>
      <dd className={ok === undefined ? undefined : ok ? 'is-yes' : 'is-no'}>
        {ok !== undefined && <Icon name={ok ? 'checkCircle' : 'close'} size={16} />}
        {v}
      </dd>
    </div>
  );
}
