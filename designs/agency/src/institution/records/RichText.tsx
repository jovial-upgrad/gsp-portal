import { useEffect, useRef } from 'react';
import { Icon } from '../../components/Icon';

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
export function RichText({ id, value, onChange, files, onFiles, invalid, describedBy, disabled }: { id: string; value: string; onChange: (html: string) => void; files: string[]; onFiles: (f: string[]) => void; invalid?: boolean; describedBy?: string; disabled?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);
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
        const url = window.prompt('Link to (https://…)');
        if (url && /^(https?:|mailto:)/i.test(url)) run('createLink', url);
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
            const names = [...(e.target.files ?? [])].map((f) => f.name);
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
    </div>
  );
}
