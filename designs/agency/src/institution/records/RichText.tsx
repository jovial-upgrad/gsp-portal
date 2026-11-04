import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, TextInput } from '../../components/forms';

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'H3', 'P', 'BR', 'DIV', 'A']);

/** Keeps only the formatting the editor makes (bold, italics, lists, headings, links), and safe links. */
export function cleanHtml(html: string) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const walk = (el: Element) => {
    [...el.children].forEach((c) => {
      walk(c);
      if (!ALLOWED.has(c.tagName)) {
        c.replaceWith(...c.childNodes);
        return;
      }
      const href = c.tagName === 'A' ? c.getAttribute('href') ?? '' : '';
      [...c.attributes].forEach((a) => c.removeAttribute(a.name));
      if (href && /^(https?:|mailto:)/i.test(href)) {
        c.setAttribute('href', href);
        c.setAttribute('target', '_blank');
        c.setAttribute('rel', 'noreferrer');
      }
    });
  };
  const root = doc.body.firstElementChild!;
  walk(root);
  return root.innerHTML;
}
export const textOf = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';

/**
 * A description with formatting (29 Oct, 6th round), as in the PM prototype: bold, italics, lists, a heading and
 * links, and images or PDFs attached under it.
 */
export function RichText({ id, value, onChange, files, onFiles, onMedia, invalid, describedBy, disabled }: { id: string; value: string; onChange: (html: string) => void; files: string[]; onFiles: (f: string[]) => void; /** An attached image's stored file, once read (4 Nov: images show on the course's details). */ onMedia?: (name: string, src: string) => void; invalid?: boolean; describedBy?: string; disabled?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  // the link's address is asked in the portal's own dialog (Jovial, 2 Nov: no browser prompt); the text picked is kept
  const [link, setLink] = useState<{ url: string; tried: boolean } | null>(null);
  const range = useRef<Range | null>(null);
  const linkOk = (u: string) => /^(https?:\/\/\S+|mailto:\S+)$/i.test(u.trim());
  const addLink = () => {
    if (!link) return;
    if (!linkOk(link.url)) return setLink({ ...link, tried: true });
    const url = link.url.trim();
    setLink(null);
    window.setTimeout(() => {
      box.current?.focus();
      const sel = window.getSelection();
      if (range.current && sel) {
        sel.removeAllRanges();
        sel.addRange(range.current);
      }
      run('createLink', url);
    }, 30);
  };
  // the editor owns its content while it's typed in (what's shown elsewhere is cleaned); set from outside when they differ
  useEffect(() => {
    if (box.current && box.current.innerHTML !== value) box.current.innerHTML = value;
  }, [value]);
  const run = (cmd: string, arg?: string) => {
    box.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(box.current?.innerHTML ?? '');
  };
  const tools: [string, string, () => void][] = [
    ['B', 'Bold', () => run('bold')],
    ['I', 'Italic', () => run('italic')],
    ['• List', 'Bulleted list', () => run('insertUnorderedList')],
    ['1. List', 'Numbered list', () => run('insertOrderedList')],
    ['H', 'Heading', () => run('formatBlock', 'h3')],
    [
      'Link',
      'Link',
      () => {
        const sel = window.getSelection();
        range.current = sel && sel.rangeCount && box.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
        setLink({ url: 'https://', tried: false });
      },
    ],
  ];
  return (
    <div className={`irt ${invalid ? 'is-invalid' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <div className="irt__bar" role="toolbar" aria-label="Formatting">
        {tools.map(([k, label, fn]) => (
          <button key={k} type="button" className={`irt__tool irt__tool--${label.toLowerCase().replace(/\s+/g, '-')}`} aria-label={label} title={label} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={fn}>
            {k}
          </button>
        ))}
        <button type="button" className="irt__tool irt__attach" disabled={disabled} onClick={() => pick.current?.click()}>
          <Icon name="attach" size={16} /> Image or PDF
        </button>
        <input
          ref={pick}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="vh"
          tabIndex={-1}
          aria-hidden="true"
          data-testid={`${id}-files`}
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])];
            const names = picked.map((f) => f.name);
            picked
              .filter((f) => f.type.startsWith('image/') && !files.includes(f.name))
              .forEach((f) => {
                const r = new FileReader();
                r.onload = () => onMedia?.(f.name, String(r.result));
                r.readAsDataURL(f);
              });
            e.target.value = '';
            if (names.length) onFiles([...files, ...names.filter((n) => !files.includes(n))]);
          }}
        />
      </div>
      <div
        ref={box}
        id={id}
        className="irt__area"
        role="textbox"
        aria-multiline="true"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => onChange(box.current?.innerHTML ?? '')}
      />
      {files.length > 0 && (
        <ul className="irt__files">
          {files.map((f) => (
            <li key={f} className="itag itag--x">
              <Icon name="file" size={14} />
              {f}
              {!disabled && (
                <button type="button" aria-label={`Remove ${f}`} onClick={() => onFiles(files.filter((x) => x !== f))}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!link} title="Add a link" confirm="Add link" onCancel={() => setLink(null)} onConfirm={addLink}>
        <Field id={`${id}-link`} label="Link to" error={link?.tried && !linkOk(link.url) ? 'Enter a web address starting https://, or mailto:' : null}>
          <TextInput
            id={`${id}-link`}
            type="url"
            value={link?.url ?? ''}
            onChange={(e) => setLink((l) => (l ? { ...l, url: e.target.value } : l))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLink();
              }
            }}
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
