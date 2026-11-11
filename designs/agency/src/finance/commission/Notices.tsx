import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { PageHead, Pill, Toast, useAsk } from '../../institution/records/parts';
import { todayIso } from '../../institution/data/records';
import { DocLine } from './parts';
import { appliesText } from './tabs';
import { noticeStatus } from './engine';
import { issueNotice, rpName, useComm } from './store';
import { benefitText, dayText } from './model';

/**
 * Notices, GSP · RP Ops (Jovial, 11 Nov, Q107, R103): Finance (Lav) creates a notice in Setup; RP Ops (Garima, BAP)
 * reads it, previews its document and issues it to the RPs it's for. Until then it applies to nobody and no RP sees it;
 * T85 puts it in RP Ops' My work. Issued ones stay listed, with who issued them and when.
 */
export function Notices({ me }: { me: string }) {
  const s = useComm();
  const today = todayIso();
  const { ask, dialog } = useAsk();
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const rows = [...s.notices].sort((a, b) => Number(!!a.issued) - Number(!!b.issued) || b.created.at - a.created.at);
  const waiting = rows.filter((n) => !n.issued).length;
  return (
    <div className="ipage cnotices">
      <PageHead title="Notices" lead={`Offers to RPs for a time. Finance creates them; RP Ops issues them to the RPs.${waiting ? ` ${waiting} waiting to be issued.` : ''}`} />
      {rows.length ? (
        <div className="card stab-wrap">
          <table className="itab">
            <thead>
              <tr>
                <th scope="col">Notice</th>
                <th scope="col">Period</th>
                <th scope="col">For</th>
                <th scope="col">Applies to</th>
                <th scope="col">Benefit</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="vh">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const st = noticeStatus(n, today);
                const who = n.rps.length ? n.rps.map(rpName).join(', ') : `Every RP in ${(n.regions ?? []).join(', ')}`;
                return (
                  <tr key={n.id}>
                    <td>
                      <span className="iw-strong">{n.name}</span>
                      <DocLine file={n.doc} label={n.name} />
                      <span className="iw-sub">
                        Created by {n.created.by} on {dayText(new Date(n.created.at).toISOString())}
                      </span>
                    </td>
                    <td className="num iw-nowrap">
                      {dayText(n.starts)} to {dayText(n.ends)}
                    </td>
                    <td>{who}</td>
                    <td>{appliesText(n)}</td>
                    <td>{benefitText(n)}</td>
                    <td>
                      <Pill tone={!n.issued ? 'you' : st === 'Active' ? 'ok' : st === 'Upcoming' ? 'uni' : 'grey'}>{st}</Pill>
                      {n.issued && (
                        <span className="iw-sub">
                          Issued by {n.issued.by} on {dayText(new Date(n.issued.at).toISOString())}
                        </span>
                      )}
                    </td>
                    <td className="iw-acts">
                      {!n.issued && (
                        <Button
                          size="sm"
                          iconLeft={<Icon name="send" size={16} />}
                          onClick={() =>
                            ask(`Issue ${n.name}?`, 'Issue', <p>It applies from now to {who}, and they see it on their Commission tab and Earnings. Finance can still edit or end it.</p>, () => {
                              issueNotice(n.id, me);
                              setMsg({ text: `${n.name} issued to ${who}.`, key: Date.now() });
                            })
                          }
                        >
                          Issue<span className="vh"> {n.name}</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">No notices yet. Finance creates them in Setup.</p>
      )}
      {dialog}
      <Toast msg={msg} />
    </div>
  );
}
