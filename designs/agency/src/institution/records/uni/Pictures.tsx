import { useRef } from 'react';
import { Icon } from '../../../components/Icon';
import type { UniRec } from '../../data/catalogue';
import type { Stamp } from '../../data/records';
import { AddButton, Section } from '../parts';
import type { UniUpd } from '../UniversityPage';

/** Course search's Campus life shows this many. */
const MAX = 10;

/**
 * A university's Pictures (Jovial, 1 Nov, HC11): course search's Campus life photos come from here, in this order, up
 * to ten; a university with none shows none. In the prototype an upload keeps the file's name and shows a placeholder
 * in place of the image.
 */
export function Pictures({ u, upd, say, updated }: { u: UniRec; upd: UniUpd; say: (m: string) => void; updated?: Stamp }) {
  const pick = useRef<HTMLInputElement>(null);
  const n = u.pictures.length;
  return (
    <Section
      title="Pictures"
      id="iu-pictures"
      updated={updated}
      note={`Course search shows the first ${MAX} as the university’s Campus life photos, in this order. With none, it shows none.`}
      action={<AddButton onClick={() => pick.current?.click()}>Add pictures</AddButton>}
    >
      <input
        ref={pick}
        type="file"
        accept="image/*"
        multiple
        className="vh"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="iupic-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (!files.length) return;
          upd((x) => ({ ...x, pictures: [...x.pictures, ...files.map((f, i) => ({ id: `pic-${Date.now().toString(36)}-${i}`, name: f.name }))] }));
          say(files.length === 1 ? `${files[0].name} added.` : `${files.length} pictures added.`);
        }}
      />
      {n ? (
        <ul className="ipics" aria-label={`${n} ${n === 1 ? 'picture' : 'pictures'}`}>
          {u.pictures.map((p, i) => (
            <li key={p.id} className={`ipic ${i >= MAX ? 'is-out' : ''}`}>
              {p.src ? (
                <img className="ipic__img" src={p.src} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="ipic__img ipic__ph" aria-hidden="true">
                  <Icon name="file" size={22} />
                  <span>Preview</span>
                </span>
              )}
              <span className="ipic__name">{p.name}</span>
              {i >= MAX && <span className="ipic__note">Not shown: course search shows the first {MAX}</span>}
              <button
                type="button"
                className="btn btn--link ipic__rm"
                onClick={() => {
                  upd((x) => ({ ...x, pictures: x.pictures.filter((y) => y.id !== p.id) }));
                  say(`${p.name} removed.`);
                }}
              >
                Remove<span className="vh"> {p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="iempty">No pictures yet. Course search shows no Campus life photos for {u.name} until some are added.</p>
      )}
    </Section>
  );
}
