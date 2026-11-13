import { useMemo, useState } from 'react';
import { SelectInput } from '../../components/forms';
import { bandStanding, type Result, type Unlock } from './engine';
import { ctxOf, ctxRps, ctxUnis, enrolmentsOf, rpName, uniName, useComm } from './store';
import { dayText, pct } from './model';
import type { Application } from '../../data/applications';
import type { Student } from '../../data/students';

/**
 * What the next enrolments unlock (Jovial, 13 Nov): Commission lines' third page, for Finance. Every university and
 * group tier and bonus scheme in its counting windows still open, from the engine (the pool the lines are priced on):
 * how many are counted, how many more reach each band, and who the counted students are by course level, sales region,
 * source country and course. A university filter narrows it (a group shows for each of its members). Then each RP's
 * own agreement bands, with how many more reach its next one.
 */
export function Unlocks({ res, apps, students }: { res: Result; apps: Application[]; students: Student[] }) {
  const s = useComm();
  const [uni, setUni] = useState('');
  const unis = useMemo(() => [...new Set(res.unlocks.flatMap((u) => u.unis))].sort((a, b) => uniName(a).localeCompare(uniName(b))), [res]);
  const shown = res.unlocks.filter((u) => !uni || u.unis.includes(uni)).sort((a, b) => nextMore(a) - nextMore(b));
  const rps = useMemo(() => {
    const extra = enrolmentsOf(apps, students);
    return s.records
      .map((r) => ({ rp: r.rp, st: bandStanding(s, ctxOf(), r.rp, extra) }))
      .filter((x) => x.st && x.st.bands.length)
      .sort((a, b) => (a.st!.next?.more ?? 1e9) - (b.st!.next?.more ?? 1e9));
  }, [s, apps, students]);
  const region = (rp: string) => ctxRps().find((r) => r.id === rp)?.region ?? '';

  return (
    <>
      <section className="card irsec" aria-labelledby="cunl-h">
        <div className="irsec__head">
          <div className="irsec__t">
            <h2 className="irsec__title" id="cunl-h">
              What the next enrolments unlock
            </h2>
            <p className="irsec__note">Each university’s and group’s tier and bonus schemes, in the counting windows still open. Counted as the lines are: students GSP will be paid for, by intake start. Closest to the next band first.</p>
          </div>
          <div className="cearn__acts">
            <SelectInput id="cunl-uni" aria-label="University" placeholder="Every university" allowEmpty value={uni} onChange={(e) => setUni(e.target.value)}>
              {unis.map((u) => (
                <option key={u} value={u}>
                  {uniName(u)}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>
        {!shown.length && <p className="iempty">{ctxUnis().length ? 'No tier or bonus scheme is counting in an open window.' : 'No universities yet.'}</p>}
      </section>

      {shown.map((u) => (
        <UnlockCard key={u.id} u={u} />
      ))}

      <section className="card irsec" aria-labelledby="cunl-rps">
        <div className="irsec__head">
          <div className="irsec__t">
            <h2 className="irsec__title" id="cunl-rps">
              RPs and their next band
            </h2>
            <p className="irsec__note">From each RP’s agreement: what reaching the next band raises GSP’s cost to. Closest first.</p>
          </div>
        </div>
        {rps.length ? (
          <div className="stab-wrap">
            <table className="itab">
              <thead>
                <tr>
                  <th scope="col">RP</th>
                  <th scope="col">Agreement</th>
                  <th scope="col">Counted</th>
                  <th scope="col">Band now</th>
                  <th scope="col">Next</th>
                </tr>
              </thead>
              <tbody>
                {rps.map(({ rp, st }) => (
                  <tr key={rp}>
                    <td>
                      <span className="iw-strong">{rpName(rp)}</span>
                      <span className="iw-sub">{region(rp)}</span>
                    </td>
                    <td>{st!.agreement}</td>
                    <td className="num">
                      {st!.count}
                      <span className="iw-sub">
                        {st!.window}
                        {st!.ends ? `, to ${dayText(st!.ends)}` : ''}
                      </span>
                    </td>
                    <td className="num">{pct(st!.share)}</td>
                    <td className="num">
                      {st!.next ? `${st!.next.more} more → ${pct(st!.next.share)}` : 'Top band'}
                      {st!.next && st!.retro && <span className="iw-sub">Retrospective: every enrolment in the window moves</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="iempty">No RP has banded terms.</p>
        )}
      </section>
    </>
  );
}

const nextMore = (u: Unlock) => u.bands.find((b) => b.more > 0)?.more ?? 1e9;

function UnlockCard({ u }: { u: Unlock }) {
  const next = u.bands.find((b) => b.more > 0);
  const goal = next?.from ?? u.bands[u.bands.length - 1]?.from ?? 1;
  const splits: [string, Record<string, number>][] = [
    ['Course level', u.by.level],
    ['Sales region (RP)', u.by.region],
    ['Source country', u.by.country],
    ['Course', u.by.course],
  ];
  return (
    <section className="card irsec cunlock" aria-labelledby={`cunl-${u.id}`}>
      <div className="irsec__head">
        <div className="irsec__t">
          <p className="cunlock__kicker">
            {u.kind} · {u.who === 'group' ? `Group of ${u.unis.map(uniName).join(', ')}` : uniName(u.unis[0])}
          </p>
          <h3 className="irsec__title" id={`cunl-${u.id}`}>
            {u.name}: {next ? `${next.more} more ${next.more === 1 ? 'enrolment unlocks' : 'enrolments unlock'} ${next.label}` : 'top band reached'}
          </h3>
          <p className="irsec__note">
            {u.count} counted in {u.window}
            {u.country ? `, students from ${u.country}` : ''}
            {u.levels.length ? `, ${u.levels.join(', ')} only` : ''}
            {u.ends ? `; the window ends ${dayText(u.ends)}` : ''}. {u.retro ? 'Retrospective: reaching a band sets it for every student counted.' : 'Prospective: each student gets the band of their own place.'}
          </p>
        </div>
      </div>
      <div className="cunlock__bar" role="img" aria-label={`${u.count} of ${goal}`}>
        <span style={{ width: `${Math.min(100, (u.count / Math.max(1, goal)) * 100)}%` }} />
      </div>
      <ol className="cunlock__bands">
        {u.bands.map((b) => (
          <li key={b.from} className={b.now ? 'is-now' : b.more === 0 ? 'is-done' : ''}>
            <span className="cunlock__pct">{b.label}</span>
            <span className="cunlock__range num">
              {b.from}
              {b.to == null ? '+' : `–${b.to}`} students
            </span>
            <span className="cunlock__state">{b.now ? 'Here now' : b.more === 0 ? 'Reached' : `${b.more} more`}</span>
          </li>
        ))}
      </ol>
      <div className="cunlock__splits">
        {splits.map(([h, m]) => (
          <div key={h}>
            <p className="cunlock__kicker">{h}</p>
            <ul>
              {Object.entries(m)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => (
                  <li key={k}>
                    <span>{k}</span>
                    <span className="num">{n}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
