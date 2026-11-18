import { useState } from 'react';
import { Checkbox } from '../../components/forms';
import { PageHead } from '../../institution/records/parts';
import { OTHER_REASON, type CloseReasons } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { TextList } from './Documents';
import { EditActions, History, Panel, useAsk } from './parts';

/**
 * Closing reasons (Jovial, 18 Nov): every way an application closes asks GSP why, from this list (and Other, with
 * words); a way of closing marked as a rejection counts in the Admissions dashboard's Rejections report. Changes apply
 * to applications closed from now on.
 */
export function Closing({ cfg, change, say }: ConfigProps) {
  const [draft, setDraft] = useState<CloseReasons[] | null>(null);
  const [ask, asking] = useAsk();
  const d = draft ?? cfg.closeReasons;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(cfg.closeReasons);
  const set = (kind: string, fn: (x: CloseReasons) => CloseReasons) => setDraft((l) => (l ?? cfg.closeReasons).map((x) => (x.kind === kind ? fn(x) : x)));
  const save = () => {
    const what: string[] = [];
    draft!.forEach((x) => {
      const was = cfg.closeReasons.find((y) => y.kind === x.kind);
      if (!was) return;
      x.reasons.filter((r) => !was.reasons.includes(r)).forEach((r) => what.push(`${x.kind}: added “${r}”`));
      was.reasons.filter((r) => !x.reasons.includes(r)).forEach((r) => what.push(`${x.kind}: removed “${r}”`));
      if (was.rejection !== x.rejection) what.push(`${x.kind}: ${x.rejection ? 'counts' : 'no longer counts'} as a rejection`);
    });
    change('Closing reasons', what.join('; '), (c) => ({ ...c, closeReasons: draft! }));
    say('Saved. Applies to applications closed from now on.');
    setDraft(null);
  };
  return (
    <>
      <PageHead title="Closing Reasons" lead={`Why an application closed: GSP picks one when it closes an application, or ${OTHER_REASON} with a few words.`}>
        <EditActions editing={!!draft} dirty={dirty} onEdit={() => setDraft(cfg.closeReasons)} onCancel={() => setDraft(null)} onSave={save} />
      </PageHead>
      {d.map((x) => (
        <div key={x.kind}>
          <TextList
            id={`cr-${x.kind.replace(/\W+/g, '-').toLowerCase()}`}
            title={x.kind}
            note={
              draft ? (
                <Checkbox id={`cr-rej-${x.kind.replace(/\W+/g, '-').toLowerCase()}`} checked={x.rejection} onChange={(on) => set(x.kind, (y) => ({ ...y, rejection: on }))} hint="Counts in the Admissions dashboard's Rejections report.">
                  A rejection
                </Checkbox>
              ) : x.rejection ? (
                'A rejection: counts in the Admissions dashboard’s Rejections report.'
              ) : (
                'Not a rejection.'
              )
            }
            items={x.reasons}
            editing={!!draft}
            ask={ask}
            set={(fn) => set(x.kind, (y) => ({ ...y, reasons: fn(y.reasons) }))}
            what="Reason"
            placeholder="Add a reason, like: Course full"
            gone={`GSP can’t pick it when an application closes as ${x.kind.toLowerCase()}.`}
          />
        </div>
      ))}
      <Panel title="Other">
        <p className="cfg__note">{OTHER_REASON} is always offered last, and asks for a few words.</p>
      </Panel>
      <History log={cfg.log} area="Closing reasons" />
      {asking}
    </>
  );
}
