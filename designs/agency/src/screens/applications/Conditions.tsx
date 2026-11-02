import { RP_OWNER_WORD } from '../../data/owners';
import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { shortDate } from '../../data/dates';
import type { Application, Cond } from '../../data/applications';
import type { Student } from '../../data/students';
import { CondAnswers } from './CondForm';

/**
 * An offer's conditions as each side sees them: sent and with the RP to answer, or answered and sent to GSP.
 * `pill`: what the card says about it, in the side's words.
 */
export type CondView = { id: string; title: string; items: Cond[]; state: 'rp' | 'answered'; meta: string; pill: string };

const nItems = (n: number) => (n === 1 ? '1 condition' : `${n} conditions`);
const PREVIEW = 3;

/** Every conditions form on the application, the ones with the RP first, then the answered ones: as GSP's team or the RP reads them. */
export function condViews(a: Application, side: 'gsp' | 'rp' = 'gsp'): CondView[] {
  const gsp = side === 'gsp';
  const open: CondView[] = a.needs
    .filter((n) => n.form)
    .map((n) => ({
      id: n.id,
      title: n.title,
      items: n.form!,
      state: 'rp',
      pill: gsp ? 'With RP' : RP_OWNER_WORD.you,
      meta: `${nItems(n.form!.length)} ${gsp ? 'for the RP to answer' : `from ${n.request?.by ?? 'GSP'}`}${n.request ? `, sent ${shortDate(new Date(n.request.at))}` : ''}${n.due ? ` · due ${shortDate(new Date(n.due))}` : ''}`,
    }));
  const done: CondView[] = (a.conds ?? []).map((x) => ({
    id: x.id,
    title: x.title,
    items: x.items,
    state: 'answered',
    pill: gsp ? 'Answered' : 'Sent to GSP',
    meta: gsp ? `${nItems(x.items.length)}, answered by the RP ${shortDate(new Date(x.sent))}` : `${nItems(x.items.length)}, answered and sent to ${x.by} ${shortDate(new Date(x.sent))}`,
  }));
  return [...open, ...done];
}

/**
 * A conditions form as a card, the same in RP Admin and GSP Team (Nesil, 28 Oct): its title, where it's got to
 * and the first conditions. The whole card opens it: to answer, for the RP while it's theirs; to read, otherwise.
 */
export function CondCard({ v, onOpen, action = 'View' }: { v: CondView; onOpen: (id: string) => void; action?: string }) {
  const more = v.items.length - PREVIEW;
  return (
    <button type="button" className={`condcard ${v.state === 'rp' ? 'is-rp' : 'is-answered'}`} onClick={() => onOpen(v.id)} aria-label={`${action} ${v.title}: ${v.meta}`}>
      <span className="condcard__head">
        <span className="condcard__t">
          <span className="condcard__title">{v.title}</span>
          <span className="condcard__meta">{v.meta}</span>
        </span>
        <span className={`dpill ${v.state === 'rp' ? 'dpill--missing' : 'dpill--checking'}`}>{v.pill}</span>
      </span>
      <ol className="condcard__list" aria-hidden="true">
        {v.items.slice(0, PREVIEW).map((c, i) => (
          <li key={c.id} className="condcard__item">
            <span className="cans__n num">{i + 1}</span>
            <span className="condcard__q">{c.text}</span>
            {c.kind === 'document' && <span className="condcard__kind">Document</span>}
          </li>
        ))}
      </ol>
      <span className="condcard__foot" aria-hidden="true">
        {more > 0 ? `+${more} more · ` : ''}
        {action}
        <Icon name="arrowRight" size={14} />
      </span>
    </button>
  );
}

/** A conditions form, opened from its card in Documents or in the chat: every condition, with the RP's answers once sent. */
export function CondDialog({ v, s, onClose }: { v: CondView | null; s: Student; onClose: () => void }) {
  // the last form stays while the dialog animates out
  const [shown, setShown] = useState<CondView | null>(v);
  useEffect(() => {
    if (v) setShown(v);
  }, [v]);
  if (!shown) return null;
  return (
    <Sheet
      open={!!v}
      onClose={onClose}
      center
      className="conddlg"
      title={shown.title}
      sub={
        <span className="conddlg__sub">
          <span className={`dpill ${shown.state === 'rp' ? 'dpill--missing' : 'dpill--checking'}`}>{shown.pill}</span>
          {shown.meta}
        </span>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <CondAnswers items={shown.items} s={s} />
    </Sheet>
  );
}
