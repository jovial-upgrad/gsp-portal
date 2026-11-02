import { useRef, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { MoreMenu } from '../../../components/MoreMenu';
import type { UniRec } from '../../data/catalogue';
import type { Stamp } from '../../data/records';
import { acceptOf, checkFile } from '../../data/changelog';
import { AddButton, ErrorText, Section } from '../parts';
import type { UniUpd } from '../UniversityPage';

const KINDS = ['jpg', 'png', 'webp'] as const;

/**
 * Pictures (slice 2 PRD): photos of the university, uploaded on the university. JPG, PNG or WebP up to 5 MB each, each
 * with an optional caption; drag to reorder (or Move up / Move down from its menu); each can be removed from its
 * menu. Course search shows them in this order; with none, none are shown. Owner: Institution, IP Ops, Admin
 * (matrix: University microsites, proposal S2C-11).
 */
export function Pictures({ u, upd, say, updated, edit = true }: { u: UniRec; upd: UniUpd; say: (m: string) => void; updated?: Stamp; edit?: boolean }) {
  const pick = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [removing, setRemoving] = useState<UniRec['pictures'][number] | null>(null);
  const n = u.pictures.length;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= n || from === to) return;
    upd((x) => {
      const l = [...x.pictures];
      const [p] = l.splice(from, 1);
      l.splice(to, 0, p);
      return { ...x, pictures: l };
    });
    say('Order saved.');
  };
  return (
    <Section
      title="Pictures"
      id="iu-pictures"
      updated={updated}
      note="Course search shows them in this order. With none, none are shown."
      action={edit ? <AddButton onClick={() => pick.current?.click()}>Add pictures</AddButton> : undefined}
    >
      <input
        ref={pick}
        type="file"
        accept={acceptOf([...KINDS])}
        multiple
        className="vh"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="iupic-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (!files.length) return;
          const bad = files.map((f) => [f, checkFile(f, [...KINDS], 5)] as const).filter(([, m]) => m);
          const ok = files.filter((f) => !bad.some(([b]) => b === f));
          setErr(bad.length ? `${bad.map(([f]) => `“${f.name}”`).join(', ')}: ${bad[0][1]}` : null);
          if (!ok.length) return;
          Promise.all(ok.map((f) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); }))).then((srcs) => {
            upd((x) => ({ ...x, pictures: [...x.pictures, ...ok.map((f, i) => ({ id: `pic-${Date.now().toString(36)}-${i}`, name: f.name, src: srcs[i], caption: '' }))] }));
            say(ok.length === 1 ? `${ok[0].name} added.` : `${ok.length} pictures added.`);
          });
        }}
      />
      {err && <ErrorText>{err}</ErrorText>}
      {n ? (
        <ul className="ipics" aria-label={`${n} ${n === 1 ? 'picture' : 'pictures'}`}>
          {u.pictures.map((p, i) => (
            <li
              key={p.id}
              className={`ipic ${drag === i ? 'is-dragging' : ''}`}
              draggable={edit}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => edit && e.preventDefault()}
              onDrop={() => (drag !== null && move(drag, i), setDrag(null))}
              onDragEnd={() => setDrag(null)}
            >
              {p.src ? (
                <img className="ipic__img" src={p.src} alt={p.caption || ''} loading="lazy" decoding="async" />
              ) : (
                <span className="ipic__img ipic__ph" aria-hidden="true">
                  <Icon name="file" size={22} />
                </span>
              )}
              {edit ? (
                <input className="icell ipic__cap" aria-label={`Caption for ${p.name}`} placeholder="Caption (optional)" maxLength={120} value={p.caption ?? ''} onChange={(e) => upd((x) => ({ ...x, pictures: x.pictures.map((y) => (y.id === p.id ? { ...y, caption: e.target.value } : y)) }))} />
              ) : (
                <span className="ipic__name">{p.caption || p.name}</span>
              )}
              {edit && (
                <MoreMenu
                  id={`iupic-m-${p.id}`}
                  label={`More for ${p.name}`}
                  items={[
                    ...(i > 0 ? [{ id: 'up', label: 'Move up', onPick: () => move(i, i - 1) }] : []),
                    ...(i < n - 1 ? [{ id: 'down', label: 'Move down', onPick: () => move(i, i + 1) }] : []),
                    { id: 'rm', label: 'Remove', danger: true, onPick: () => setRemoving(p) },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="iempty">No pictures yet. Course search shows none for {u.name} until some are added.</p>
      )}
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name}?`}
        confirm="Remove picture"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) upd((x) => ({ ...x, pictures: x.pictures.filter((y) => y.id !== removing.id) }));
          say(`${removing?.name} removed.`);
          setRemoving(null);
        }}
      >
        <p>Course search stops showing it.</p>
      </ConfirmDialog>
    </Section>
  );
}
