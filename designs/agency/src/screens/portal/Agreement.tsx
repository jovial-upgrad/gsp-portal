import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DateInput, Field } from '../../components/forms';
import { dateError } from '../../components/validate';
import type { RecruitmentPartner } from '../../institution/data/records';
import { uploadSignedCopy } from '../../institution/data/rpverify';
import { acceptOf, checkFile, dateTimeText } from '../../institution/data/changelog';
import { downloadFile } from '../../institution/records/PartnerPage';

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
};

/**
 * The RP agreement on the RP portal's Home (slice 2 PRD, The RP agreement): approval sends it here and by email; the
 * RP Admin downloads it, signs it and uploads the signed copy with the date it was signed. BAP then accepts it or
 * sends it back with a reason, shown here.
 */
export function RpAgreementCard({ r, by, canSign }: { r: RecruitmentPartner; by: string; canSign: boolean }) {
  const a = r.agreement;
  const [file, setFile] = useState<File | null>(null);
  const [on, setOn] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  if (!a || !a.sentAt || a.state === 'Accepted' || a.state === 'Uploaded') return null;
  const sent = isoDay(a.sentAt);
  const today = isoDay(Date.now());
  const onErr = dateError(on, { what: 'signed on date', required: true }) ?? (on > today || on < sent ? `Not after today, and not before GSP sent it (${day(sent)}).` : null);
  const fileErr = err ?? (!file ? 'Choose a file.' : null);
  return (
    <section className="card vcard" aria-labelledby="rpagr-title">
      <div className="vcard__head">
        <span className={`who ${a.state === 'Signed copy received' ? 'who--gsp' : 'who--you'}`}>{a.state === 'Signed copy received' ? 'With GSP' : 'With you'}</span>
        <h2 id="rpagr-title" className="vcard__title">
          {a.state === 'Signed copy received' ? 'GSP is checking your signed agreement' : a.state === 'Sent back' ? 'Your signed agreement was sent back' : 'Sign your agreement'}
        </h2>
        <p className="vcard__text">
          {a.state === 'Signed copy received'
            ? `You uploaded it on ${dateTimeText(a.signed!.at)}. Your commission is held until GSP accepts it.`
            : 'Download it, sign it, and upload the signed copy with the date you signed it. Your commission is held until you sign your agreement; it’s paid once the signed copy is accepted.'}
        </p>
        {a.state === 'Sent back' && a.reason && (
          <p className="vcard__text" role="alert">
            <strong>GSP’s reason:</strong> {a.reason}
          </p>
        )}
      </div>
      <div className="locked__actions">
        <Button variant="secondary" iconLeft={<Icon name="download" size={16} />} onClick={() => downloadFile(a.file)}>
          Download agreement ({a.version})
        </Button>
      </div>
      {canSign && a.state !== 'Signed copy received' && (
        <div className="iform__grid">
          <Field id="rpagr-file" label="Signed copy" required hint="PDF, JPG or PNG, up to 20 MB." error={tried || err ? fileErr : null}>
            <button id="rpagr-file" type="button" className="ipick" onClick={() => pick.current?.click()}>
              <Icon name={file ? 'file' : 'upload'} size={18} />
              <span className="ipick__t">{file?.name ?? 'Choose a file'}</span>
            </button>
            <input
              ref={pick}
              type="file"
              accept={acceptOf(['pdf', 'jpg', 'png'])}
              className="vh"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="rpagr-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const bad = checkFile(f, ['pdf', 'jpg', 'png'], 20);
                setErr(bad);
                setFile(bad ? null : f);
              }}
            />
          </Field>
          <Field id="rpagr-on" label="Signed on" required error={tried ? onErr : null}>
            <DateInput id="rpagr-on" value={on} invalid={tried && !!onErr} onChange={setOn} />
          </Field>
          <div>
            <Button
              onClick={() => {
                setTried(true);
                if (fileErr || onErr) return;
                uploadSignedCopy(r.id, file!.name, on, by);
                setFile(null);
                setOn('');
                setTried(false);
              }}
            >
              Upload signed copy
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Earnings until the agreement is signed (S2-11). */
export const HeldNote = () => (
  <div className="page">
    <p className="card irsec" role="status">
      Your commission is held until you sign your agreement. It’s paid once the signed copy is accepted.
    </p>
  </div>
);

/** A Suspended or Rejected RP: every user loses access and can't sign in (S2-12, S2C-9). */
export function AccountClosed({ r }: { r: RecruitmentPartner }) {
  return (
    <div className="page">
      <section className="card locked" role="alert">
        <h1 className="page__title">{r.status === 'Rejected' ? 'This partner account is closed.' : 'This partner account is suspended.'}</h1>
        <p>{r.status === 'Rejected' ? 'This partner account is closed. Contact your Recruitment contact at GSP.' : 'GSP has suspended this partner account: every user has lost access and can’t sign in until GSP reactivates it. Applications in progress carry on. Contact your Recruitment contact at GSP.'}</p>
        {r.bdm && <p>Partner manager: {r.bdm}</p>}
      </section>
    </div>
  );
}
