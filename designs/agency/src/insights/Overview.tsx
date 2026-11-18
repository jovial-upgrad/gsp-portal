import { useMemo, useState } from 'react';
import { PageHead } from '../institution/records/parts';
import { Button } from '../components/Button';
import type { Reporting, RepApp } from './data';
import { ageing, applyFilters, byUniversity, daysSince, funnel, isLive, lastChange, pct, reached, reachedAt, series, studentStates, type Filters, type Grain, type InsightSettings } from './metrics';
import { Card, Drill, FilterBar, Num, Seg, TimeBars } from './parts';

/**
 * Overview (dashboards round 1, 18 Nov): where every application is, for the filters picked. Every number opens
 * the applications behind it. Built on the India team's portal (Overview) and Ramish's Admissions overview.
 */
export function Overview({ d, s, f, setF, now }: { d: Reporting; s: InsightSettings; f: Filters; setF: (f: Filters) => void; now: number }) {
  const apps = useMemo(() => applyFilters(d, f), [d, f]);
  const [drill, setDrill] = useState<{ title: string; apps: RepApp[] } | null>(null);
  const open = (title: string, l: RepApp[]) => setDrill({ title, apps: l });
  const [grain, setGrain] = useState<Grain>('week');
  const [run, setRun] = useState<'per' | 'run'>('per');
  const [dgrain, setDgrain] = useState<Grain>('week');
  const [drun, setDrun] = useState<'per' | 'run'>('per');
  const M = (k: string) => s.milestones.find((m) => m.key === k)!;
  const fun = useMemo(() => funnel(apps, s.milestones), [apps, s]);
  const live = apps.filter(isLive);
  const idle = live.filter((a) => daysSince(lastChange(a), now) >= s.idleDays);
  const st = useMemo(() => studentStates(apps, s, M('visa').status), [apps, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const studentsOf = (ids: string[]) => {
    const set = new Set(ids);
    return apps.filter((a) => set.has(a.student));
  };
  const age = useMemo(() => ageing(apps, s, now), [apps, s, now]);
  // Jovial, 18 Nov: the top 10, and Show all with 25 a page
  const allUnis = useMemo(() => byUniversity(apps, s), [apps, s]);
  const [uniAll, setUniAll] = useState(false);
  const [uniPage, setUniPage] = useState(0);
  const UNI_PAGE = 25;
  const uniPages = Math.max(1, Math.ceil(allUnis.length / UNI_PAGE));
  const unis = uniAll ? allUnis.slice(uniPage * UNI_PAGE, uniPage * UNI_PAGE + UNI_PAGE) : allUnis.slice(0, 10);
  const lim = grain === 'day' ? 60 : grain === 'week' ? 52 : undefined;
  const pts = useMemo(() => series(apps, (a) => a.created, grain, now, lim), [apps, grain, now, lim]);
  const dep = M('deposit');
  const dpts = useMemo(() => series(apps, (a) => reachedAt(a, dep.status), dgrain, now, dgrain === 'day' ? 60 : dgrain === 'week' ? 52 : undefined), [apps, dgrain, now, dep.status]);
  const n = (k: string) => fun.find((x) => x.key === k)!;
  const share = (a: number, b: number) => (b ? pct(a / b) : '—');
  const maxCell = Math.max(1, ...age.rows.flatMap((r) => r.cells.map((c) => c.length)));
  const heat = (c: number) => (c ? Math.min(5, 1 + Math.floor((c / maxCell) * 5)) : 0);
  const Stat = ({ k, title, l, sub, count }: { k: string; title: string; l: RepApp[]; sub: string; count?: number }) => (
    <button type="button" className="ins-stat" onClick={() => l.length && open(title, l)} aria-label={`${title}: ${count ?? l.length}, open the list`} key={k}>
      <span className="ins-stat__k">{title}</span>
      <span className="ins-stat__n">{(count ?? l.length).toLocaleString('en-GB')}</span>
      <span className="ins-stat__sub">{sub}</span>
    </button>
  );
  return (
    <div className="ins">
      <PageHead title="Overview" lead="Where every application is, for the filters you pick. Every number opens the students behind it." />
      <FilterBar d={d} f={f} set={setF} />
      <div className="ins-stats">
        <Stat k="apps" title="Applications" l={apps} sub={`${live.length.toLocaleString('en-GB')} live`} />
        <Stat k="sub" title={n('submitted').label} l={reached(apps, M('submitted'))} sub={`${share(n('submitted').n, apps.length)} of applications`} />
        <Stat k="off" title={n('offer').label} l={reached(apps, M('offer'))} sub={`${n('uncond').n.toLocaleString('en-GB')} ${n('uncond').label}`} />
        <Stat k="dep" title={n('deposit').label} l={reached(apps, dep)} sub={`${share(n('deposit').n, n('offer').n)} of offers`} />
        <Stat k="doc" title={n('enroldoc').label} l={reached(apps, M('enroldoc'))} sub={`${n('visalodged').n.toLocaleString('en-GB')} ${n('visalodged').label}`} />
        <Stat k="enr" title={n('enrolled').label} l={reached(apps, M('enrolled'))} sub={`${share(n('enrolled').n, apps.length)} of applications`} />
        <Stat k="idle" title={`Idle ${s.idleDays}+ days`} l={idle} sub={`${share(idle.length, live.length)} of live applications`} />
      </div>

      <Card title="Students" sub="Each student counts once, however many applications they have (Ramish's overview). Safe: a visa granted on any of them. Drop: every application closed. WIP: the rest.">
        <div className="ins-stats">
          <Stat k="u" title="Unique applicants" l={apps} count={st.students} sub={`${apps.length.toLocaleString('en-GB')} applications`} />
          <Stat k="ud" count={st.deposit.length} title={`Reached ${M('deposit').label}`} l={studentsOf(st.deposit)} sub={`${share(st.deposit.length, st.students)} of applicants`} />
          <Stat k="us" count={st.safe.length} title="Safe" l={studentsOf(st.safe)} sub={`${share(st.safe.length, st.students)} · reached ${M('visa').label}`} />
          <Stat k="ux" count={st.drop.length} title="Drop" l={studentsOf(st.drop)} sub={`${share(st.drop.length, st.students)} · every application closed`} />
          <Stat k="uw" count={st.wip.length} title="WIP" l={studentsOf(st.wip)} sub={`${share(st.wip.length, st.students)} · in progress`} />
        </div>
      </Card>

      <div className="ins__grid">
        <Card
          title="Applications"
          sub="By date received · a bar opens its students"
          action={
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Seg label="Show" value={run} items={[['per', 'Per period'], ['run', 'Running total']]} onPick={setRun} />
              <Seg label="Group by" value={grain} items={[['day', 'Day'], ['week', 'Week'], ['month', 'Month']]} onPick={setGrain} />
            </span>
          }
        >
          <TimeBars points={pts} grain={grain} running={run === 'run'} label="Applications received" open={open} />
        </Card>
        <Card
          title="Deposits"
          sub="By the date the deposit was confirmed"
          action={
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Seg label="Show" value={drun} items={[['per', 'Per period'], ['run', 'Running total']]} onPick={setDrun} />
              <Seg label="Group by" value={dgrain} items={[['day', 'Day'], ['week', 'Week'], ['month', 'Month']]} onPick={setDgrain} />
            </span>
          }
        >
          <TimeBars points={dpts} grain={dgrain} running={drun === 'run'} label="Deposits" open={open} />
        </Card>
      </div>

      <div className="ins__grid">
        <Card title="Funnel" sub="Applications that reached each stage · % of applications · step = from the stage before">
          <div className="ins-funnel">
            <div className="ins-funnel__row ins-funnel__head" aria-hidden="true">
              <span>Stage</span>
              <span />
              <span style={{ textAlign: 'right' }}>Applications</span>
              <span style={{ textAlign: 'right' }}>Share</span>
              <span style={{ textAlign: 'right' }}>Step</span>
            </div>
            {fun.map((x) => (
              <div className="ins-funnel__row" key={x.key}>
                <span>{x.label}</span>
                <span className="ins-funnel__bar">
                  <span className="ins-funnel__fill" style={{ width: `${x.share * 100}%` }} />
                </span>
                <span className="ins-funnel__n">
                  <Num apps={reached(apps, x)} open={open} title={x.label} />
                </span>
                <span className="ins-funnel__share">{pct(x.share)}</span>
                <span className="ins-funnel__step">{pct(x.step)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title={uniAll ? 'Universities' : 'Top universities'}
          sub={uniAll ? `All ${allUnis.length}, most applications first · page ${uniPage + 1} of ${uniPages}` : `The 10 with the most applications, of ${allUnis.length}`}
          flush
          action={
            <span className="ins-acts">
              {uniAll && uniPages > 1 && (
                <>
                  <Button variant="secondary" size="sm" disabled={uniPage === 0} onClick={() => setUniPage(uniPage - 1)}>
                    Previous
                  </Button>
                  <Button variant="secondary" size="sm" disabled={uniPage >= uniPages - 1} onClick={() => setUniPage(uniPage + 1)}>
                    Next
                  </Button>
                </>
              )}
              {allUnis.length > 10 && (
                <Button variant="secondary" size="sm" onClick={() => (setUniAll(!uniAll), setUniPage(0))}>
                  {uniAll ? 'Top 10' : 'Show all'}
                </Button>
              )}
            </span>
          }
        >
          <div className="ins-scroll">
            <table className="itab ins-tab">
              <thead>
                <tr>
                  <th scope="col">University</th>
                  <th scope="col" className="n">Applications</th>
                  <th scope="col" className="n">Offers</th>
                  <th scope="col" className="n">Deposits</th>
                  <th scope="col" className="n">App → offer</th>
                </tr>
              </thead>
              <tbody>
                {unis.map((u) => (
                  <tr key={u.uni}>
                    <td>{u.name}</td>
                    <td className="n"><Num apps={u.apps} open={open} title={`${u.name}: applications`} /></td>
                    <td className="n"><Num apps={u.offers} open={open} title={`${u.name}: offers`} /></td>
                    <td className="n"><Num apps={u.deposits} open={open} title={`${u.name}: deposits`} /></td>
                    <td className="n">{pct(u.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Where applications are stuck" sub={`Live applications by stage and days since their status last changed`} flush>
        <div className="ins-scroll">
          <table className="itab ins-tab ins-heat">
            <thead>
              <tr>
                <th scope="col">Stage</th>
                {age.labels.map((l) => (
                  <th key={l} scope="col" className="n">{l}</th>
                ))}
                <th scope="col" className="n">Total</th>
                <th scope="col" className="n">Average</th>
              </tr>
            </thead>
            <tbody>
              {age.rows.map((r) => (
                <tr key={r.m.key}>
                  <th scope="row" style={{ background: 'none', fontSize: 'inherit', color: 'var(--text)', fontWeight: 500 }}>{r.m.label}</th>
                  {r.cells.map((c, i) => (
                    <td key={i} className={`n h${heat(c.length)}`}>
                      <Num apps={c} open={open} title={`${r.m.label}, ${age.labels[i]} since last change`} />
                    </td>
                  ))}
                  <td className="n"><Num apps={r.total} open={open} title={`${r.m.label}: live`} /></td>
                  <td className="n">{r.avg.toFixed(1)} d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Drill open={!!drill} title={drill?.title ?? ''} apps={drill?.apps ?? []} d={d} s={s} now={now} onClose={() => setDrill(null)} />
    </div>
  );
}
