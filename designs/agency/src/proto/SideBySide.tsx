import { useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { SelectMenu } from '../components/SelectMenu';
import { addLinkSink, isLinkMsg, setLink, useLink, type Link } from './link';
import { PAIR, ROLES } from './roles';

/**
 * Side by side (testing only): RP Admin and GSP Team, each in its own pane of this window, so a change in one
 * shows in the other as it happens. The panes pass what's connected to each other through this page.
 */
export function SideBySide({ hash, links, onExit }: { hash: string; links: { id: string; label: string }[]; onExit: () => void }) {
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);
  const link = useLink();
  const src = `${window.location.href.split('#')[0]}#${hash}`;

  useEffect(() => {
    const to = (m: unknown, except?: MessageEventSource | null) => {
      for (const f of frames.current) {
        const w = f?.contentWindow;
        if (!w || w === except) continue;
        try {
          w.postMessage(m, '*');
        } catch {
          /* the pane is reloading */
        }
      }
    };
    // a pane's change goes to the other pane; this page's own (the connection below) goes to both
    const relay = (e: MessageEvent) => isLinkMsg(e.data) && to(e.data, e.source);
    window.addEventListener('message', relay);
    const off = addLinkSink((m) => to(m));
    return () => {
      window.removeEventListener('message', relay);
      off();
    };
  }, []);

  const value = link.mode === 'one' ? link.app : link.mode;
  const pick = (v: string): Link => (v === 'off' || v === 'all' ? { mode: v, app: link.app } : { mode: 'one', app: v });

  return (
    <div className="split">
      <header className="split__bar">
        <p className="split__title">
          <Icon name="monitor" size={18} />
          Side by side
        </p>
        <div className="split__link">
          <span className="split__k">Connected</span>
          <SelectMenu
            className="split__pick"
            host="body"
            label="Connected applications"
            ariaLabel="Connected applications"
            value={value}
            minWidth={280}
            onChange={(v) => setLink(pick(v))}
            options={[
              { value: 'all', label: 'All applications' },
              ...links.map((l) => ({ value: l.id, label: l.label, group: 'One application' })),
              { value: 'off', label: 'Not connected' },
            ]}
          />
        </div>
        <p className="split__note">{link.mode === 'off' ? 'Not connected: each role keeps its own copy.' : 'A change in one role shows in the other as it happens.'}</p>
        <button type="button" className="split__exit" onClick={onExit}>
          <Icon name="close" size={16} />
          Exit side by side
        </button>
      </header>
      <div className="split__panes">
        {ROLES.filter((r) => PAIR.includes(r.key)).map((r, i) => (
          <section key={r.key} className="split__pane" aria-label={r.label}>
            <p className="split__k split__role">{r.label}</p>
            <iframe ref={(el) => (frames.current[i] = el)} name={`gsp-pane-${r.key}`} src={src} title={`${r.label}: the portal`} />
          </section>
        ))}
      </div>
    </div>
  );
}
