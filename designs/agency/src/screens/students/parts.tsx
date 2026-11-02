import { RP_OWNER_WORD as OWNER_WORD } from '../../data/owners';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { initialsOf, type Owner, type Student } from '../../data/students';
import { shortDate } from '../../data/dates';

const DAY = 86_400_000;

/** "Added today", "Added yesterday", "Added 3 days ago", then the date. */
export function addedLabel(t: number) {
  const days = Math.floor((Date.now() - t) / DAY);
  if (days < 1) return 'Added today';
  if (days === 1) return 'Added yesterday';
  if (days < 7) return `Added ${days} days ago`;
  return `Added ${shortDate(new Date(t))}`;
}

export { shortDate };

export function Avatar({ s, big = false }: { s: Pick<Student, 'first' | 'last'>; big?: boolean }) {
  return (
    <span className={`savatar ${big ? 'savatar--big' : ''}`} aria-hidden="true">
      {initialsOf(s)}
    </span>
  );
}

/** How much of the profile is filled, as a ring: green once complete. */
export function Ring({ pct, size = 28 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className={`ring ${pct >= 100 ? 'is-done' : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} />
      <circle className="ring__fill" cx={size / 2} cy={size / 2} r={r} strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      {pct >= 100 && <path className="ring__tick" d={`M${size * 0.32} ${size * 0.52}l${size * 0.12} ${size * 0.12} ${size * 0.24}-${size * 0.26}`} />}
    </svg>
  );
}

export const OWNER: Record<Owner | 'done' | 'end' | 'wd', [string, string]> = {
  you: [OWNER_WORD.you, 'who--you'],
  gsp: [OWNER_WORD.gsp, 'who--gsp'],
  uni: [OWNER_WORD.uni, 'who--uni'],
  done: [OWNER_WORD.done, 'who--ok'],
  end: [OWNER_WORD.end, 'who--end'],
  wd: [OWNER_WORD.wd, 'who--wd'],
};

/** Copies to the clipboard, falling back to a hidden text box where the clipboard API isn't allowed. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** A copy icon that turns into a tick for a moment once copied. */
export function CopyButton({ text, what, onDone }: { text: string; what: string; onDone?: (msg: string) => void }) {
  const [done, setDone] = useState(false);
  const t = useRef<number>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <button
      type="button"
      className={`scopy ${done ? 'is-done' : ''}`}
      aria-label={done ? `${what} copied` : `Copy ${what.toLowerCase()}`}
      title={done ? 'Copied' : `Copy ${what.toLowerCase()}`}
      onClick={async (e) => {
        e.stopPropagation();
        await copyText(text);
        setDone(true);
        onDone?.(`${what} copied`);
        window.clearTimeout(t.current);
        t.current = window.setTimeout(() => setDone(false), 1600);
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={16} strokeWidth={done ? 2.2 : 1.6} />
    </button>
  );
}
