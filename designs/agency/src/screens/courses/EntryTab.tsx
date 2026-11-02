import { Icon } from '../../components/Icon';
import { SelectMenu } from '../../components/SelectMenu';
import { tagsOf, type Course } from '../../data/courses';
import { fullName, type Student } from '../../data/students';
import { eligibility, groupsOf, verdictTone, type Line } from '../../data/eligibility';
import { COUNTRIES, TOP_MARKETS } from '../../data/partners';
import { TEST_MIN, type AcademicRule, type EnglishRule } from '../../institution/data/catalogue';
import { courseDocs, type CourseDoc } from '../../admin/data/store';
import { Box, Tile } from './parts';

/** The dropdown's first choice: every country side by side. */
export const ALL_COUNTRIES = 'all';
/** Where the RP is: the dropdown starts here (India for every agency in the prototype). */
export const RP_COUNTRY = 'India';

/** A country's flag, from its ISO code. */
export const flagOf = (name: string) => {
  const iso = COUNTRIES.find((c) => c.name === name)?.iso;
  return iso ? String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '';
};

/** The course's academic and English rules, as its catalogue record keeps them (Institution › Courses). */
const rulesOf = (c: Course) => {
  const r = c as Course & { academicRules?: AcademicRule[]; englishRules?: EnglishRule[] };
  return { academic: r.academicRules ?? [], english: r.englishRules ?? [] };
};
/** The academic rows for students from a country: the country's own, or else the ones for every country. */
const academicFor = (rows: AcademicRule[], country: string) => {
  const own = rows.filter((r) => r.countries.includes(country));
  return own.length ? own : rows.filter((r) => !r.countries.length);
};
/** The English rows for students from a country: for each test, the country's own row, or else the one for every country. */
const englishFor = (rows: EnglishRule[], country: string) =>
  [...new Set(rows.map((r) => r.test))].flatMap((t) => {
    const own = rows.filter((r) => r.test === t && r.countries.includes(country));
    return own.length ? own : rows.filter((r) => r.test === t && !r.countries.length);
  });

/**
 * Eligibility and documents, in every role's course dialog (Jovial, 1 Nov, HC6): the entry requirements are only
 * the course record's **academic** and **English** rules, as the Institution Team enters them (no typed rules or
 * waivers by country). The dropdown starts on the RP's own country and shows that country's rows (or the rows for
 * every country when it has none of its own); **All countries** lays every row side by side. Backlogs are part of
 * the academic rule. Then the documents, from GSP · Admin's document rules.
 */
export function EntryTab({ c, country, onCountry, student }: { c: Course; country: string; onCountry: (c: string) => void; student?: Student }) {
  const { academic, english } = rulesOf(c);
  const named = [...academic, ...english].flatMap((r) => r.countries);
  const countries = [...new Set([...TOP_MARKETS, ...named, ...(country !== ALL_COUNTRIES ? [country] : [])])];
  return (
    <div className="cm-stack">
      <Verdicts c={c} student={student} />
      <div className="cm-cpick">
        <label htmlFor="cm-cpick" className="cm-cpick__k">
          Requirements for students from
        </label>
        <div className="cm-cpick__menu">
          <SelectMenu id="cm-cpick" value={country} label="Countries" options={[{ value: ALL_COUNTRIES, label: 'All countries' }, ...countries.map((n) => ({ value: n, label: `${flagOf(n)}  ${n}` }))]} onChange={onCountry} />
        </div>
      </div>
      {country === ALL_COUNTRIES ? <AllCountries c={c} academic={academic} english={english} /> : <OneCountry c={c} country={country} academic={academicFor(academic, country)} english={englishFor(english, country)} />}
      <Docs c={c} />
    </div>
  );
}

const before = (c: Course) => `Completed before the ${c.level === 'PhD or research' ? 'PhD' : c.level.charAt(0).toLowerCase() + c.level.slice(1)}`;
const qualText = (r: AcademicRule) => (r.board ? `${r.qual} (${r.board})` : r.qual);
const minText = (r: AcademicRule) => (r.scale === 'Percentage' ? `${r.min}%` : r.scale === 'GPA 4' ? `${r.min} out of 4` : r.scale === 'GPA 10' ? `${r.min} out of 10` : `${r.min} (UK class)`);
const backlogText = (r: AcademicRule) => (r.backlogs === '' ? 'No limit' : r.backlogs === '0' ? 'None' : `Up to ${r.backlogs}`);
const countriesText = (l: string[]) => (l.length ? l.join(', ') : 'All countries');
const needClass = (need: string) => `cs-need cs-need--${need === 'Required' ? 'req' : need === 'Optional' ? 'opt' : 'later'}`;

/** A pathway provider, from the university's record (HC2). */
function Pathway({ c }: { c: Course }) {
  if (!c.uni.pathway) return null;
  return (
    <p className="cnote">
      <strong>Doesn’t meet entry yet?</strong> {c.uni.name} is a pathway provider.
    </p>
  );
}

const Notes = ({ rows }: { rows: { id: string; note: string }[] }) => (
  <>
    {rows
      .filter((r) => r.note.trim())
      .map((r) => (
        <p key={r.id} className="cnote">
          {r.note}
        </p>
      ))}
  </>
);

/** One country: its academic rule as tiles (a table when it has several), its English tests as tiles. */
function OneCountry({ c, country, academic, english }: { c: Course; country: string; academic: AcademicRule[]; english: EnglishRule[] }) {
  const meta = `For students from ${country}`;
  return (
    <>
      <Box id="cs-academic" icon="cap" title="Entry requirements" meta={meta}>
        {academic.length === 0 ? (
          <p className="cnote">No academic rule added for this course yet.</p>
        ) : academic.length === 1 ? (
          <dl className="cm-tiles">
            <Tile k="Qualification" v={qualText(academic[0])} sub={before(c)} />
            <Tile k="Minimum" v={minText(academic[0])} sub={academic[0].scale} />
            {academic[0].backlogs !== '' && <Tile k="Backlogs allowed" v={backlogText(academic[0])} />}
          </dl>
        ) : (
          <AcademicTable rows={academic} />
        )}
        <Notes rows={academic} />
        <Pathway c={c} />
      </Box>

      <Box id="cs-english" icon="chat" title="English" meta={meta}>
        {english.length ? (
          <dl className="cm-tiles">
            {english.map((r) => (
              <Tile key={r.id} k={r.test} v={String(r.overall)} sub={r.min > 0 ? `Overall · ${TEST_MIN[r.test].toLowerCase()} ${r.min}` : 'Overall'} />
            ))}
          </dl>
        ) : (
          <p className="cnote">No English rule added for this course yet.</p>
        )}
        <Notes rows={english} />
        <Waiver c={c} />
      </Box>
    </>
  );
}

/** Waivers (S3-6): a course tagged "English test waiver" or "MOI acceptable" may waive the English test. */
function Waiver({ c }: { c: Course }) {
  const t = tagsOf(c).filter((x) => x === 'English test waiver' || x === 'MOI acceptable');
  if (!t.length) return null;
  return (
    <p className="cnote">
      <strong>May be waived:</strong> {c.uni.name} may waive the English test for this course ({t.join(', ')}).
    </p>
  );
}

/**
 * The eligibility check for the student picked in the search (slice 3 PRD, Eligibility check): each part's verdict
 * and why, in two groups (Jovial, 2 Nov): Academics (highest education, the score, backlogs) and English, each with
 * its worst check's state, then the overall verdict. It's a soft check: it never
 * blocks applying. With no student picked, the rules show without verdicts.
 */
function Verdicts({ c, student }: { c: Course; student?: Student }) {
  if (!student)
    return (
      <p className="cnote" role="status">
        Select a student to check their eligibility.
      </p>
    );
  const k = eligibility(student, c);
  const pill = (l: Pick<Line, 'ok' | 'result'>) => <span className={`cs-verdict cs-verdict--${l.ok}`}>{l.result}</span>;
  return (
    <Box id="cs-elig" icon="checkCircle" title={`Eligibility check for ${fullName(student)}`} meta={pill({ ok: verdictTone(k.verdict), result: k.verdict })}>
      <ul className="cs-checks">
        {groupsOf(k).map((g) => (
          <li key={g.key} className="cs-check cs-check--group">
            <span className="cs-check__k">{g.key}</span>
            <span className="cs-check__line">{pill({ ok: g.ok, result: g.verdict })}</span>
            <ul className="cs-check__subs">
              {g.lines.map((l) => (
                <li key={l.label + l.why} className="cs-check cs-check--sub">
                  <span className="cs-check__k">{l.sub}</span>
                  <span className="cs-check__line">
                    {pill(l)}
                    <span className="cs-check__why">{l.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="cnote">For students from {student.country || student.nationality}. A soft check: it never blocks applying.</p>
    </Box>
  );
}

function AcademicTable({ rows, countries = false }: { rows: AcademicRule[]; countries?: boolean }) {
  const backlogs = rows.some((r) => r.backlogs !== '');
  return (
    <table className="cs-etable">
      <thead>
        <tr>
          {countries && <th scope="col">Students from</th>}
          <th scope="col">Qualification</th>
          <th scope="col">Minimum</th>
          {backlogs && <th scope="col">Backlogs allowed</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            {countries && <CountryCell l={r.countries} />}
            <td data-k="Qualification">
              <strong>{qualText(r)}</strong>
            </td>
            <td data-k="Minimum">
              <strong>{minText(r)}</strong>
              <span className="cs-etable__sub">{r.scale}</span>
            </td>
            {backlogs && <td data-k="Backlogs allowed">{backlogText(r)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CountryCell = ({ l }: { l: string[] }) => (
  <th scope="row" className="cs-etable__c">
    {l.length === 1 && (
      <span className="cs-etable__flag" aria-hidden="true">
        {flagOf(l[0])}
      </span>
    )}
    {countriesText(l)}
  </th>
);

/** Every row the course has, side by side: whom each is for. */
function AllCountries({ c, academic, english }: { c: Course; academic: AcademicRule[]; english: EnglishRule[] }) {
  const meta = 'For all countries';
  return (
    <>
      <Box id="cs-academic" icon="cap" title="Entry requirements" meta={meta}>
        {academic.length ? (
          <>
            <AcademicTable rows={academic} countries />
            <p className="cs-etable__foot">{before(c)}.</p>
          </>
        ) : (
          <p className="cnote">No academic rule added for this course yet.</p>
        )}
        <Notes rows={academic} />
        <Pathway c={c} />
      </Box>

      <Box id="cs-english" icon="chat" title="English" meta={meta}>
        {english.length ? (
          <table className="cs-etable">
            <thead>
              <tr>
                <th scope="col">Students from</th>
                <th scope="col">Test</th>
                <th scope="col">Overall</th>
                <th scope="col">Lowest band or part</th>
              </tr>
            </thead>
            <tbody>
              {english.map((r) => (
                <tr key={r.id}>
                  <CountryCell l={r.countries} />
                  <td data-k="Test">
                    <strong>{r.test}</strong>
                  </td>
                  <td data-k="Overall">{r.overall}</td>
                  <td data-k="Lowest band or part">{r.min > 0 ? r.min : <span className="cs-etable__sub">Not set</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="cnote">No English rule added for this course yet.</p>
        )}
        <Notes rows={english} />
      </Box>
    </>
  );
}

function DocList({ docs }: { docs: CourseDoc[] }) {
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

/**
 * The documents to collect (Jovial, 1 Nov): GSP · Admin's document rules for this course, the same for students from
 * every country, as Add an application asks for them.
 */
function Docs({ c }: { c: Course }) {
  const docs = courseDocs(c);
  const req = docs.filter(([, need]) => need === 'Required').length;
  return (
    <Box id="cs-docs" icon="folder" title="Documents to collect" meta={`${req} required`}>
      <DocList docs={docs} />
    </Box>
  );
}
