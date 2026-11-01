import { UPLOAD, uploadError } from '../../../data/uploads';
import { useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { DocButtons } from '../../../components/DocView';
import { EXTRA_DOCS, eduDocKey, eduDocName, levelsFor, testDocKey, testDocName, type Doc, type Student } from '../../../data/students';
import { fillFromEducation, fillFromPassport, fillFromResume, fillFromTest, saveEducation, savePassport, saveResume, saveTest } from './read';
import { PLACE_NAME, classify, fileInto, isOther, nameOf, placesOf } from './sort';
import type { Update } from './fields';

const STATUS: Record<Doc['status'], [string, string]> = {
  uploaded: ['Uploaded', 'dstat--up'],
  checking: ['GSP checking', 'dstat--gsp'],
  verified: ['Verified', 'dstat--ok'],
};


const check = (f: File) => uploadError(f);

/** One document the profile keeps: where it's saved, and, uploaded into an empty part of the profile, what it fills in. */
type Slot = { key: string; name: string; place: (p: Student, file: string) => Student };
type Group = { id: string; title: string; slots: Slot[] };

/** The documents, by the part of the profile they belong to. Uploaded where that part has no details yet, a document fills them in. */
function groupsOf(s: Student): Group[] {
  const levels = levelsFor(s.highest).filter((l) => l === s.highest || !!s.edu[l] || !!s.docs[eduDocKey(l)]);
  const extra = (key: string) => EXTRA_DOCS.find(([k]) => k === key)!;
  const plain = (key: string, name: string) => (p: Student, file: string) => ({ ...p, docs: { ...p.docs, [key]: { name, file, status: 'uploaded' as const } } });
  return [
    {
      id: 'personal',
      title: 'Personal details',
      slots: [
        {
          key: 'passport',
          name: 'Passport',
          place: (p, file) => {
            const q = savePassport(p, file);
            return p.dob || p.gender || p.passportExpiry ? q : fillFromPassport(q, file);
          },
        },
      ],
    },
    {
      id: 'education',
      title: 'Academics',
      slots: levels.map((l) => ({
        key: eduDocKey(l),
        name: eduDocName(l),
        place: (p: Student, file: string) => {
          const q = saveEducation(p, l, file);
          const e = p.edu[l];
          return e && (e.level || e.institution || e.qualification || e.score) ? q : fillFromEducation(q, l);
        },
      })),
    },
    {
      id: 'tests',
      title: 'English test',
      slots: s.tests.map((t) => ({
        key: testDocKey(t),
        name: testDocName(t),
        place: (p: Student, file: string) => {
          const q = saveTest(p, t, file);
          const x = p.tests.find((y) => y.id === t.id);
          return x && (x.cert || x.date || x.overall) ? q : fillFromTest(q, t.id);
        },
      })),
    },
    {
      id: 'work',
      title: 'Work experience',
      slots: [
        { key: 'cv', name: 'CV', place: (p, file) => (p.work.length ? saveResume(p, file) : fillFromResume(saveResume(p, file))) },
        { key: 'work', name: extra('work')[1], place: plain('work', extra('work')[1]) },
      ],
    },
    {
      id: 'more',
      title: 'Additional documents',
      slots: ['sop', 'lor'].map((key) => ({ key, name: extra(key)[1], place: plain(key, extra(key)[1]) })),
    },
  ];
}

/**
 * Documents: every document on the profile, and only here (Nesil, 29 Oct), and only what's uploaded: the passport,
 * each level's marksheet or transcript, each test's score report, the CV and work letters, the statement of purpose,
 * recommendation letters and any other file, under the part of the profile it belongs to; a part with nothing
 * uploaded isn't listed. Each can be previewed, downloaded and replaced; another file can be removed. **Upload a
 * document** adds one at a time, sorted into its part (and read in where the part is still empty).
 */
export function Documents({ s, update }: { s: Student; update: Update }) {
  const others = Object.entries(s.docs).filter(([k]) => isOther(k));
  const groups = groupsOf(s)
    .map((g) => ({ ...g, slots: g.slots.filter((x) => s.docs[x.key]) }))
    .filter((g) => g.slots.length || (g.id === 'more' && others.length));
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="rsec">
      <div className="dtop">
        <input
          ref={input}
          type="file"
          accept={UPLOAD.accept}
          className="vh"
          tabIndex={-1}
          aria-label="Upload a document"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const bad = check(f);
            if (bad) return setNote({ ok: false, text: `${f.name}: ${bad}` });
            const k = classify(f.name, s.highest);
            update((p) => fileInto(p, [f.name]));
            setNote({ ok: true, text: `${f.name} added as ${nameOf(k)}, under ${placesOf(k).map((x) => PLACE_NAME[x]).join(' and ')}.` });
          }}
        />
        <Button variant="secondary" size="sm" iconLeft={<Icon name="upload" size={16} />} onClick={() => input.current?.click()}>
          Upload a document
        </Button>
      </div>
      {note && (
        <p className={`dnote ${note.ok ? 'is-ok' : 'is-bad'}`} role="status">
          <Icon name={note.ok ? 'checkCircle' : 'alert'} size={16} />
          <span>{note.text}</span>
        </p>
      )}

      {groups.map((g) => (
        <section key={g.id} className="dgroup" aria-labelledby={`rd-${g.id}`}>
          <h3 id={`rd-${g.id}`} className="dgroup__title">
            {g.title}
          </h3>
          <ul className="card dlist">
            {g.slots.map((x) => (
              <DocRow key={x.key} id={`rd-${x.key}`} slot={x} s={s} doc={s.docs[x.key]!} onFile={(file) => update((p) => x.place(p, file))} />
            ))}
            {g.id === 'more' &&
              others.map(([key, d]) => (
                <li key={key} className="drow has-file">
                  <span className="drow__icon" aria-hidden="true">
                    <Icon name="file" size={18} />
                  </span>
                  <div className="drow__t">
                    <p className="drow__name">{d.file}</p>
                    <p className="drow__sub">{d.name}</p>
                  </div>
                  <DocButtons d={{ name: d.name, file: d.file }} s={s} />
                  <span className={`dstat ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${d.file}`}
                    onClick={() =>
                      update((p) => {
                        const docs = { ...p.docs };
                        delete docs[key];
                        return { ...p, docs };
                      })
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {!groups.length && (
        <div className="rempty">
          <p className="rempty__title">No documents yet</p>
          <p className="rempty__text">Upload them one at a time here, or fill in a part of Personal details from its document: it’s kept here.</p>
        </div>
      )}
    </div>
  );
}

function DocRow({ id, slot, s, doc, onFile }: { id: string; slot: Slot; s: Student; doc: Doc; onFile: (file: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  return (
    <li className="drow has-file">
      <span className="drow__icon" aria-hidden="true">
        <Icon name="file" size={18} />
      </span>
      <div className="drow__t">
        <p className="drow__name" id={`${id}-name`}>
          {slot.name}
        </p>
        <p className="drow__sub">{doc.file}</p>
        {error && (
          <p className="field__msg field__msg--error" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </p>
        )}
      </div>
      <DocButtons d={{ name: slot.name, file: doc.file }} s={s} />
      <span className={`dstat ${STATUS[doc.status][1]}`}>{STATUS[doc.status][0]}</span>
      <input
        ref={ref}
        id={id}
        type="file"
        accept={UPLOAD.accept}
        className="vh"
        tabIndex={-1}
        aria-labelledby={`${id}-name`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const bad = check(f);
          setError(bad);
          if (!bad) onFile(f.name);
        }}
      />
      <Button variant="ghost" size="sm" aria-describedby={`${id}-name`} onClick={() => ref.current?.click()}>
        Replace
      </Button>
    </li>
  );
}
