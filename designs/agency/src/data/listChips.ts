/**
 * The Applications list's status chips (Jovial, 2 Nov), one list for the RP portal and every GSP role: each chip names
 * the statuses it counts. **New** is the New stage; **Offer received** the conditional and the unconditional offer
 * letter; **Enrolled** Student enrolled; **Closed** every way an application ends (closed or withdrawn). "All" comes
 * first in the list itself. The names are the statuses' own (data/applications.ts STATUS), so a renamed status
 * renames nothing here.
 */
import { STATUS, STATUS_ORDER, type Application, type StatusKey } from './applications';

export type ChipKey = 'new' | 'offer' | 'enrolled' | 'closed';
export type ListChip = { key: ChipKey; label: string; statuses: StatusKey[] };

export const LIST_CHIPS: ListChip[] = [
  // every status of the New stage (today Waiting for documents)
  { key: 'new', label: 'New', statuses: STATUS_ORDER.filter((k) => STATUS[k].stage === 0) },
  { key: 'offer', label: 'Offer received', statuses: ['conditions', 'uol'] },
  { key: 'enrolled', label: 'Enrolled', statuses: ['enrolled'] },
  // closed and withdrawn are both the status Closed (a withdrawal is its end kind)
  { key: 'closed', label: 'Closed', statuses: ['closed'] },
];

/** Whether an application is in a chip ('' is All). */
export const inChip = (key: ChipKey | '', a: Pick<Application, 'status'>) => !key || !!LIST_CHIPS.find((c) => c.key === key)?.statuses.includes(a.status);

/** Each chip's count over a list, with All first. */
export function chipCounts(apps: Pick<Application, 'status'>[]): Record<ChipKey | '', number> {
  const out = { '': apps.length } as Record<ChipKey | '', number>;
  for (const c of LIST_CHIPS) out[c.key] = apps.filter((a) => c.statuses.includes(a.status)).length;
  return out;
}
