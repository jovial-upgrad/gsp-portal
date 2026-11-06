import { useRef, useState } from 'react';
import { EditOnly } from '../../../proto/viewOnly';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { MAX_IMAGES, type UniImage, type UniRec } from '../../data/catalogue';
import { Section } from '../parts';
import type { UniUpd } from '../UniversityPage';

/** Pictures and logos: these types, up to 5 MB each. */
export const IMAGE_TYPES = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
const OK_TYPE = /^image\/(png|jpe?g|webp)$/;
export const MAX_MB = 5;

/** Reads an image file into a page-ready address, or says what's wrong with it. */
export function readImage(f: File, types = OK_TYPE): Promise<string> {
  return new Promise((res, rej) => {
    if (!types.test(f.type)) return rej(`${f.name} isn’t a PNG, JPG or WebP image.`);
    if (f.size > MAX_MB * 1024 * 1024) return rej(`${f.name} is over ${MAX_MB} MB.`);
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(`${f.name} couldn’t be read.`);
    r.readAsDataURL(f);
  });
}

let n = 0;
const nid = () => `img-${Date.now().toString(36)}${(++n).toString(36)}`;

/**
 * Images (3 Nov): the university's pictures, in the order they show. Upload several at once (up to 10 in all), drag
 * one to a new place or move it with its arrows, replace one with another file, or delete it.
 */
export function Images({ u, upd, say }: { u: UniRec; upd: UniUpd; say: (m: string) => void }) {
  const add = useRef<HTMLInputElement>(null);
  const swap = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<UniImage | null>(null);
  const [deleting, setDeleting] = useState<UniImage | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = u.images;
  const room = MAX_IMAGES - list.length;

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= list.length) return;
    const img = list[from];
    upd((x) => {
      const l = [...x.images];
      l.splice(from, 1);
      l.splice(to, 0, img);
      return { ...x, images: l };
    }, `Moved ${img.name} from ${from + 1} to ${to + 1}`);
    say(`${img.name} is now ${to + 1} of ${list.length}.`);
  };

  const upload = async (files: File[]) => {
    setError(null);
    const take = files.slice(0, Math.max(0, room));
    const read = await Promise.allSettled(take.map((f) => readImage(f)));
    const added: UniImage[] = [];
    const bad: string[] = [];
    read.forEach((r, i) => (r.status === 'fulfilled' ? added.push({ id: nid(), name: take[i].name, src: r.value }) : bad.push(String(r.reason))));
    if (files.length > take.length) bad.push(`Only ${MAX_IMAGES} images in all: ${files.length - take.length} more ${files.length - take.length === 1 ? 'wasn’t' : 'weren’t'} added.`);
    if (added.length) {
      upd((x) => ({ ...x, images: [...x.images, ...added] }), `Added ${added.map((a) => a.name).join(', ')}`);
      say(added.length === 1 ? `${added[0].name} added.` : `${added.length} images added.`);
    }
    if (bad.length) setError(bad.join(' '));
  };

  const replace = async (f: File | undefined, img: UniImage) => {
    setError(null);
    if (!f) return;
    try {
      const src = await readImage(f);
      upd((x) => ({ ...x, images: x.images.map((y) => (y.id === img.id ? { ...y, name: f.name, src } : y)) }), `Replaced ${img.name} with ${f.name}`);
      say(`${img.name} replaced with ${f.name}.`);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Section
      title="Images"
      id="iu-images"
      updated={u.stamps.images}
      action={
        <EditOnly>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="upload" size={16} />} disabled={room <= 0} onClick={() => add.current?.click()}>
            Upload images
          </Button>
        </EditOnly>
      }
    >
      {error && (
        <p className="field__msg field__msg--error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
      {list.length ? (
        <ol className="iimgs" aria-label="Images, in the order they show">
          {list.map((img, i) => (
            <li
              key={img.id}
              className={`iimg ${dragging === img.id ? 'is-dragging' : ''} ${over === i && dragging && dragging !== img.id ? 'is-over' : ''}`}
              draggable
              onDragStart={(e) => {
                setDragging(img.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', img.id);
              }}
              onDragEnd={() => (setDragging(null), setOver(null))}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = list.findIndex((x) => x.id === dragging);
                setDragging(null);
                setOver(null);
                if (from >= 0) move(from, i);
              }}
            >
              <div className="iimg__pic">
                <img src={img.src} alt={`${u.name}, image ${i + 1}`} draggable={false} />
                <span className="iimg__n num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="iimg__grip" title="Drag to move" aria-hidden="true">
                  <Icon name="grip" size={18} strokeWidth={3} />
                </span>
              </div>
              <div className="iimg__foot">
                <span className="iimg__name" title={img.name}>
                  {img.name}
                </span>
                <span className="iimg__acts">
                  <EditOnly>
                    <button type="button" className="icon-btn" aria-label={`Move ${img.name} earlier`} title="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>
                      <Icon name="arrowLeft" size={16} />
                    </button>
                  </EditOnly>
                  <EditOnly>
                    <button type="button" className="icon-btn" aria-label={`Move ${img.name} later`} title="Move later" disabled={i === list.length - 1} onClick={() => move(i, i + 1)}>
                      <Icon name="arrowRight" size={16} />
                    </button>
                  </EditOnly>
                  <EditOnly>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Replace ${img.name}`}
                      title="Replace"
                      onClick={() => {
                        setReplacing(img);
                        swap.current?.click();
                      }}
                    >
                      <Icon name="refresh" size={16} />
                    </button>
                  </EditOnly>
                  <EditOnly>
                    <button type="button" className="icon-btn idanger" aria-label={`Delete ${img.name}`} title="Delete" onClick={() => setDeleting(img)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </EditOnly>
                </span>
              </div>
            </li>
          ))}
          {room > 0 && (
            <li className="iimg iimg--add">
              {/* the same size as an image's card (3 Nov): its picture's shape, then a foot as tall */}
              <EditOnly>
                <button
                  type="button"
                  className="iimg__addbtn"
                  onClick={() => add.current?.click()}
                  onDragOver={(e) => {
                    if (dragging) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (dragging) return;
                    e.preventDefault();
                    upload([...(e.dataTransfer.files ?? [])]);
                  }}
                >
                  <span className="iimg__pic iimg__addpic">
                    <Icon name="image" size={24} />
                    <span className="idrop__t">Add images</span>
                  </span>
                  <span className="iimg__foot iimg__addfoot">{room === 1 ? '1 more fits' : `${room} more fit`}</span>
                </button>
              </EditOnly>
            </li>
          )}
        </ol>
      ) : (
        <EditOnly>
          <button
            type="button"
            className="idrop idrop--big"
            onClick={() => add.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              upload([...(e.dataTransfer.files ?? [])]);
            }}
          >
            <Icon name="image" size={24} />
            <span className="idrop__t">No images yet. Choose images, or drop them here</span>
          </button>
        </EditOnly>
      )}
      <input
        ref={add}
        type="file"
        accept={IMAGE_TYPES}
        multiple
        className="vh"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="iimg-add"
        onChange={(e) => {
          upload([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      <input
        ref={swap}
        type="file"
        accept={IMAGE_TYPES}
        className="vh"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="iimg-swap"
        onChange={(e) => {
          if (replacing) replace(e.target.files?.[0], replacing);
          setReplacing(null);
          e.target.value = '';
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? 'this image'}?`}
        confirm="Delete"
        onConfirm={() => {
          if (deleting) {
            upd((x) => ({ ...x, images: x.images.filter((y) => y.id !== deleting.id) }), `Deleted ${deleting.name}`);
            say(`${deleting.name} deleted.`);
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      >
        <p>It leaves the university’s page. The other images keep their order.</p>
      </ConfirmDialog>
    </Section>
  );
}
