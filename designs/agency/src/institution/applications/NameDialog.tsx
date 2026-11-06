import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field, TextInput } from '../../components/forms';

const MAX = 80;
/** A name to start from, read from the file: "deakin_offer-letter.pdf" reads "Deakin offer letter". */
export const nameFromFile = (file: string) => {
  const t = file.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * A document GSP uploads in Documents gets a name first (Nesil, 28 Oct): what the RP sees it as. It starts from
 * the file's name, or from one of the documents GSP usually adds.
 */
export function NameDialog({ file, usual, onCancel, onAdd }: { file: File | null; usual: string[]; onCancel: () => void; onAdd: (name: string) => void }) {
  // the last file stays while the dialog animates out
  const [shown, setShown] = useState<File | null>(file);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) return;
    setShown(file);
    setName(nameFromFile(file.name));
    setTried(false);
    window.setTimeout(() => input.current?.select(), 60);
  }, [file]);
  if (!shown) return null;
  const ok = name.trim().length >= 2;
  const add = () => {
    setTried(true);
    if (ok) onAdd(name.trim());
  };
  return (
    <Sheet
      open={!!file}
      onClose={onCancel}
      center
      className="gname"
      title="Name the document"
      sub={
        <span className="gname__file">
          <Icon name="file" size={14} /> {shown.name}
        </span>
      }
      footer={
        <div className="asf">
          <p className="asf__note">The RP sees it in Documents by this name.</p>
          <div className="asf__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={add}>Add to documents</Button>
          </div>
        </div>
      }
    >
      <form
        className="gname__form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field id="gname-name" label="Document name" error={tried && !ok ? 'Give it a name, so the RP knows what it is.' : null} hint={`${name.length} of ${MAX}`}>
          <TextInput ref={input} id="gname-name" value={name} maxLength={MAX} invalid={tried && !ok} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="gname__chips" role="group" aria-label="Names GSP often uses">
          {usual.map((x) => (
            <button key={x} type="button" className="gchip" aria-pressed={name === x} onClick={() => setName(x)}>
              <span className="gchip__in">{x}</span>
            </button>
          ))}
        </div>
      </form>
    </Sheet>
  );
}
