import { useState } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { Icon } from './Icon';
import { fullName, TESTS, type Student } from '../data/students';
import './docview.css';

/** A document as both roles show it: what it is, and its file. */
export type DocRef = { name: string; file: string };

const kindOf = (d: DocRef) =>
  /passport/i.test(d.name) ? 'passport' : /transcript|marksheet/i.test(d.name) ? 'marks' : /score report/i.test(d.name) ? 'score' : 'letter';

/**
 * Every document can be previewed and downloaded, in RP Admin and GSP Team. In this prototype the preview is a
 * stand-in for the file's first page, laid out like the document it is, and the download a one-page PDF that
 * says what it stands in for.
 */
export function Paper({ d, s }: { d: DocRef; s?: Student }) {
  const name = s ? fullName(s) : '';
  const kind = kindOf(d);
  const n = [...d.file].reduce((t, ch) => t + ch.charCodeAt(0), 0);
  return (
    <figure className={`dpaper dpaper--${kind}`} aria-label={`Preview of ${d.file}, page 1`}>
      {kind === 'passport' && s ? (
        <div className="dpp">
          <p className="dpp__k">{s.nationality === 'India' ? 'Republic of India · Passport' : `${s.nationality} · Passport`}</p>
          <div className="dpp__row">
            <span className="dpp__photo" aria-hidden="true">
              <Icon name="user" size={34} />
            </span>
            <dl className="dpp__dl">
              <div>
                <dt>Surname</dt>
                <dd>{(s.last || s.first).toUpperCase()}</dd>
              </div>
              <div>
                <dt>Given names</dt>
                <dd>{s.oneName ? '—' : s.first.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Passport no.</dt>
                <dd className="num">{s.passport || 'P' + (1000000 + (n % 8999999))}</dd>
              </div>
              <div>
                <dt>Date of birth</dt>
                <dd className="num">{s.dob || '14/03/2002'}</dd>
              </div>
              <div>
                <dt>Date of expiry</dt>
                <dd className="num">{s.passportExpiry || '09/11/2033'}</dd>
              </div>
            </dl>
          </div>
          <p className="dpp__mrz num" aria-hidden="true">
            P&lt;IND{(s.last || s.first).toUpperCase()}&lt;&lt;{s.first.toUpperCase()}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
          </p>
        </div>
      ) : kind === 'marks' ? (
        <div className="dpp">
          <p className="dpp__k">{d.name}</p>
          {name && <p className="dpp__name">{name}</p>}
          <table className="dpp__table">
            <thead>
              <tr>
                <th scope="col">{/marksheet/i.test(d.name) ? 'Subject' : 'Semester'}</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {(/marksheet/i.test(d.name) ? ['English', 'Mathematics', 'Physics', 'Chemistry', 'Computer Science'] : ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6']).map((x, i) => (
                <tr key={x}>
                  <td>{x}</td>
                  <td className="num">{/marksheet/i.test(d.name) ? `${70 + ((n + i * 7) % 26)} / 100` : `${(7 + ((n + i * 3) % 25) / 10).toFixed(1)} GPA`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : kind === 'score' && s ? (
        <div className="dpp">
          <p className="dpp__k">{d.name}</p>
          <p className="dpp__name">{name}</p>
          <p className="dpp__score num">{s.tests.find((t) => d.name.startsWith(TESTS[t.type].name))?.overall || '7.0'}</p>
          <p className="dpp__sub">Overall</p>
        </div>
      ) : (
        <div className="dpp">
          <p className="dpp__k">{d.name}</p>
          {name && <p className="dpp__name">{name}</p>}
          <span className="dpp__lines" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} style={{ width: `${68 + ((n + i * 13) % 30)}%` }} />
            ))}
          </span>
        </div>
      )}
      <figcaption className="dpp__cap">
        <Icon name="file" size={14} /> {d.file} · page 1
      </figcaption>
    </figure>
  );
}

/** A one-page PDF: the document's name, its file and the student, in Helvetica (ASCII only). */
function pdfFor(lines: string[]) {
  const esc = (t: string) => t.replace(/[‘’]/g, "'").replace(/[^\x20-\x7e]/g, '-').replace(/[\\()]/g, (m) => `\\${m}`);
  const body = ['BT', '/F1 18 Tf', '56 780 Td', `(${esc(lines[0])}) Tj`, '/F1 11 Tf', ...lines.slice(1).flatMap((l) => ['0 -24 Td', `(${esc(l)}) Tj`]), 'ET'].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const at: number[] = [];
  objs.forEach((o, i) => {
    at.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((x) => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

/** Saves the document. In the prototype, a one-page PDF named after the file. */
export function downloadDoc(d: DocRef, s?: Student) {
  const blob = pdfFor([d.name, `File: ${d.file}`, ...(s ? [`Student: ${fullName(s)}`] : []), 'A stand-in from the GSP prototype: the real file downloads here in the product.']);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = /\.pdf$/i.test(d.file) ? d.file : `${d.file.replace(/\.[a-z0-9]+$/i, '')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the document in a new tab (the Inbox's View). False when the browser won't open one. */
export function openDoc(d: DocRef, s?: Student) {
  const url = URL.createObjectURL(pdfFor([d.name, `File: ${d.file}`, ...(s ? [`Student: ${fullName(s)}`] : []), 'A stand-in from the GSP prototype: the real file opens here in the product.']));
  const w = window.open(url, '_blank');
  if (w) w.opener = null;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return !!w;
}

/** The document, opened: its first page, with Download. */
export function PreviewSheet({ d, s, open, onClose }: { d: DocRef; s?: Student; open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="dprev"
      title={d.name}
      sub={<span className="dprev__file">{d.file}</span>}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button iconLeft={<Icon name="download" size={16} />} onClick={() => downloadDoc(d, s)}>
              Download
            </Button>
          </div>
        </div>
      }
    >
      <Paper d={d} s={s} />
    </Sheet>
  );
}

/** Preview and Download, as two small buttons beside a document. */
export function DocButtons({ d, s }: { d: DocRef; s?: Student }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="dview">
      <button type="button" className="dview__btn" aria-label={`Preview ${d.file}`} title="Preview" onClick={() => setOpen(true)}>
        <Icon name="eye" size={16} />
      </button>
      <button type="button" className="dview__btn" aria-label={`Download ${d.file}`} title="Download" onClick={() => downloadDoc(d, s)}>
        <Icon name="download" size={16} />
      </button>
      <PreviewSheet d={d} s={s} open={open} onClose={() => setOpen(false)} />
    </span>
  );
}
