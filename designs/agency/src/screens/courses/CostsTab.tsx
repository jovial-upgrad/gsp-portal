import { useState } from 'react';
import { courseCosts, type CostPart } from '../../admin/data/store';
import { money, scholarshipsOf, type Course } from '../../data/courses';
import { Box } from './parts';

/**
 * The course dialog's Costs, in every role (Jovial, 1 Nov): exactly four parts and their total, for the course's
 * duration as its record gives it: the tuition fee, living costs and visa and health cover (both from GSP · Admin's
 * settings), and the application fee, once. A course whose length is in credits shows one year of each and says so.
 * Then the scholarships: only the university record's that fit this course (Jovial, 1 Nov, HC9), as the record has them.
 */
export function CostsTab({ c }: { c: Course }) {
  const { parts, total, span, credits, credit } = courseCosts(c);
  const schols = scholarshipsOf(c);
  return (
    <>
      <section className="cm-total" aria-labelledby="cs-total">
        <div className="cm-total__head">
          <h3 id="cs-total" className="cm-total__k">
            Total, for {span}
          </h3>
          <p className="cm-total__v">
            <span className="cm-unit">≈ </span>
            <span className="cm-unit">{c.currency} </span>
            {money(total, c.currency).split(' ').slice(1).join(' ')}
          </p>
          <p className="cm-total__note">
            {credits
              ? `This course’s length is in credits${credit ? ` (${credit})` : ''}, so these are for 1 year.`
              : `For one student, for the whole course (${span}): tuition, living costs, visa and health cover, and the application fee.`}
          </p>
        </div>
        <CostBar parts={parts} total={total} cur={c.currency} />
      </section>

      <Box id="cs-schol" icon="award" title="Scholarships" meta={schols.length === 1 ? '1 listed' : `${schols.length} listed`}>
        {schols.length ? (
          <ul className="cs-schols">
            {schols.map((x) => (
              <li key={x.name} className="cs-schol">
                <p className="cs-schol__from">From {c.uni.name}</p>
                <p className="cs-schol__name">{x.name}</p>
                <p className="cs-schol__amt">{x.amount}</p>
                {x.forCountries && <p className="cs-schol__who">For students from {x.forCountries.join(', ')}</p>}
                {x.conditions && <p className="cs-schol__who">{x.conditions}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cnote">No scholarships listed for this course.</p>
        )}
      </Box>
    </>
  );
}

/**
 * The parts as one bar, with the parts listed under it in aligned columns (amount, share) and what each is made of,
 * so no part relies on its colour alone. Pointing at a part shows its amount and share.
 */
function CostBar({ parts, total, cur }: { parts: CostPart[]; total: number; cur: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const shown = parts.filter((p) => p.v > 0);
  // where each part's middle falls along the bar, for the tip over it (kept inside the bar's ends)
  let at = 0;
  const mid = Object.fromEntries(shown.map((p) => [p.key, (at += p.v) - p.v / 2]));
  const on = shown.find((p) => p.key === hover);
  return (
    <div className="cbar">
      <div className="cbar__track" aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {shown.map((p) => (
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
              <span className="cbar__lab">
                {p.label}
                <span className="cbar__basis">{p.basis}</span>
              </span>
            </dt>
            <dd className="cbar__amt">{p.v ? money(p.v, cur) : p.key === 'app' ? 'Free' : '–'}</dd>
            <dd className="cbar__pct">{pct(p.v)}%</dd>
          </div>
        ))}
        <div className="cbar__item cbar__item--total">
          <dt>Total</dt>
          <dd className="cbar__amt">{money(total, cur)}</dd>
          <dd className="cbar__pct">100%</dd>
        </div>
      </dl>
    </div>
  );
}
