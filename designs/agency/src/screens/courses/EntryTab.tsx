import { Icon } from '../../components/Icon';
import { SelectMenu } from '../../components/SelectMenu';
import type { Course } from '../../data/courses';
import { ALL_COUNTRIES, ENTRY_COUNTRIES, entryFor, flagOf, type EntryRules } from '../../data/entry';
import { Box, Tile } from './parts';

/**
 * Eligibility and documents, in both roles' course dialogs. Entry differs by where the student studied, so it
 * opens with one dropdown: **All countries** first, then the countries GSP recruits from most, each with its
 * flag; the RP's own country (India, for now) by default. One country shows its requirements, English and
 * documents, each card saying "For students from India"; All countries lays them side by side in tables, a
 * row a country, and lists once the documents every country needs.
 */
export function EntryTab({ c, country, onCountry }: { c: Course; country: string; onCountry: (c: string) => void }) {
  return (
    <div className="cm-stack">
      <div className="cm-cpick">
        <label htmlFor="cm-cpick" className="cm-cpick__k">
          Requirements for students from
        </label>
        <div className="cm-cpick__menu">
          <SelectMenu
            id="cm-cpick"
            value={country}
            label="Countries"
            options={[{ value: ALL_COUNTRIES, label: 'All countries' }, ...ENTRY_COUNTRIES.map((n) => ({ value: n, label: `${flagOf(n)}  ${n}` }))]}
            onChange={onCountry}
          />
        </div>
      </div>
      {country === ALL_COUNTRIES ? <AllCountries c={c} /> : <OneCountry c={c} country={country} />}
    </div>
  );
}

const isPg = (c: Course) => c.level === 'Master’s degree' || c.level === 'Postgraduate diploma' || c.level === 'PhD or research';
const before = (c: Course) => `Completed before the ${c.level === 'PhD or research' ? 'PhD' : c.level.charAt(0).toLowerCase() + c.level.slice(1)}`;
const TESTS = (c: Course): [string, string, string][] => [
  ['IELTS Academic', c.ielts[0].toFixed(1), c.ielts[1].toFixed(1)],
  ['PTE Academic', String(c.pte[0]), String(c.pte[1])],
  ['TOEFL iBT', String(c.toefl[0]), String(c.toefl[1])],
];
const needClass = (need: string) => `cs-need cs-need--${need === 'Required' ? 'req' : need === 'Optional' ? 'opt' : 'later'}`;

function Pathway({ c }: { c: Course }) {
  if (!c.pathway) return null;
  return (
    <p className="cnote">
      <strong>Doesn’t meet entry yet?</strong> The university runs a pathway: {isPg(c) ? 'a graduate certificate' : 'a foundation year or diploma'} or English classes first, then straight into this course.
    </p>
  );
}

function EnglishTiles({ c }: { c: Course }) {
  return (
    <dl className="cm-tiles">
      {TESTS(c).map(([t, overall, band]) => (
        <Tile key={t} k={t} v={overall} sub={`Overall · no band below ${band}`} />
      ))}
    </dl>
  );
}

function DocList({ docs }: { docs: Course['docs'] }) {
  return (
    <ul className="cs-docs">
      {docs.map(([name, need, when]) => (
        <li key={name} className="cs-doc">
          <span className="cs-doc__icon" aria-hidden="true">
            <Icon name="doc" size={16} />
          </span>
          <span className="cs-doc__name">{name}</span>
          <span className="cs-doc__when">{when}</span>
          <span className={needClass(need)}>{need}</span>
        </li>
      ))}
    </ul>
  );
}

/** One country: its requirements as tiles, English with its waiver, and its documents. */
function OneCountry({ c, country }: { c: Course; country: string }) {
  const r = entryFor(c, country);
  const meta = `For students from ${country}`;
  const req = r.docs.filter(([, need]) => need === 'Required').length;
  return (
    <>
      <Box id="cs-academic" icon="cap" title="Entry requirements" meta={meta}>
        <dl className="cm-tiles">
          <Tile k="Eligibility" v={r.from} sub={before(c)} />
          <Tile k="Highest education" v={r.grade} sub={r.gradeSub} />
          {r.backlogs && <Tile k="Maximum backlogs" v={String(c.backlogs)} sub="in the bachelor’s degree" />}
        </dl>
        {r.note && <p className="cnote">{r.note}</p>}
        <Pathway c={c} />
      </Box>

      <Box id="cs-english" icon="chat" title="English" meta={meta}>
        <EnglishTiles c={c} />
        {c.englishFlex && <p className="cnote">The English test can wait: a conditional offer is possible{r.waiver ? `, or ${r.waiver}` : ''}.</p>}
      </Box>

      <Box id="cs-docs" icon="folder" title="Documents to collect" meta={`${meta} · ${req} required`}>
        <DocList docs={r.docs} />
      </Box>
    </>
  );
}

const Country = ({ n }: { n: string }) => (
  <th scope="row" className="cs-etable__c">
    <span className="cs-etable__flag" aria-hidden="true">
      {flagOf(n)}
    </span>
    {n}
  </th>
);

/** Every country side by side: a table a card, a row a country; the documents every country needs listed once. */
function AllCountries({ c }: { c: Course }) {
  const rows: [string, EntryRules][] = ENTRY_COUNTRIES.map((n) => [n, entryFor(c, n)]);
  const meta = `For all ${ENTRY_COUNTRIES.length} countries`;
  const backlogs = rows.some(([, r]) => r.backlogs);
  // a document every country's list has, the same way, is listed once; the rest by country
  const key = (d: Course['docs'][number]) => d.join('|');
  const common = rows[0][1].docs.filter((d) => rows.every(([, r]) => r.docs.some((x) => key(x) === key(d))));
  const own = rows.map(([n, r]) => [n, r.docs.filter((d) => !common.some((x) => key(x) === key(d)))] as const);
  return (
    <>
      <Box id="cs-academic" icon="cap" title="Entry requirements" meta={meta}>
        <table className="cs-etable">
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">Eligibility</th>
              <th scope="col">Highest education</th>
              {backlogs && <th scope="col">Maximum backlogs</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(([n, r]) => (
              <tr key={n}>
                <Country n={n} />
                <td data-k="Eligibility">
                  <strong>{r.from}</strong>
                  {r.note && <span className="cs-etable__note">{r.note}</span>}
                </td>
                <td data-k="Highest education">
                  <strong>{r.grade}</strong>
                  <span className="cs-etable__sub">{r.gradeSub}</span>
                </td>
                {backlogs && <td data-k="Maximum backlogs">{r.backlogs ? <strong>{c.backlogs}</strong> : <span className="cs-etable__sub">Not counted</span>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cs-etable__foot">{before(c)}.</p>
        <Pathway c={c} />
      </Box>

      <Box id="cs-english" icon="chat" title="English" meta={meta}>
        <EnglishTiles c={c} />
        {c.englishFlex && (
          <>
            <p className="cs-etable__k">The test can wait: a conditional offer is possible. How it can be waived:</p>
            <table className="cs-etable cs-etable--2">
              <tbody>
                {rows.map(([n, r]) => (
                  <tr key={n}>
                    <Country n={n} />
                    <td data-k="Waiver">{r.waiver ? r.waiver.charAt(0).toUpperCase() + r.waiver.slice(1) : <span className="cs-etable__sub">Not waived: a test score is needed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Box>

      <Box id="cs-docs" icon="folder" title="Documents to collect" meta={meta}>
        <p className="cs-etable__k">From every country</p>
        <DocList docs={common} />
        <p className="cs-etable__k">And by country</p>
        <table className="cs-etable cs-etable--2">
          <tbody>
            {own.map(([n, docs]) => (
              <tr key={n}>
                <Country n={n} />
                <td data-k="Documents">
                  {docs.length ? (
                    <ul className="cs-etable__docs">
                      {docs.map(([name, need, when]) => (
                        <li key={name}>
                          <span className="cs-etable__dname">{name}</span>
                          <span className="cs-etable__sub">{when}</span>
                          <span className={needClass(need)}>{need}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="cs-etable__sub">Nothing more</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </>
  );
}
