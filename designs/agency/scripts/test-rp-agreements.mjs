// The RP agreement rules (Jovial, 2 Nov): src/institution/data/agreements.ts. Checks the statuses, the one active
// agreement, Superseded, held commission, and that every derived item (bell note, email, Activity line) comes from a
// version: an RP with no versions gets none. Exits 1 on any failure.
//   node scripts/test-rp-agreements.mjs   (from designs/agency)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = await build({ stdin: { contents: "export * from './src/institution/data/agreements.ts';", resolveDir: path.join(here, '..'), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error' });
const A = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
let pass = 0, fail = 0;
const ok = (what, got, exp) => { const g = JSON.stringify(got), e = JSON.stringify(exp); if (g === e) pass++; else { fail++; console.log(`FAIL ${what}: expected ${e} got ${g}`); } };
const T = (iso, h = 10) => new Date(`${iso}T${String(h).padStart(2, '0')}:00:00`).getTime();
const v = (id, o) => ({ id, version: id, file: `${id}.pdf`, size: 1000, uploadedAt: T('2026-01-01', 9), uploadedBy: 'RP Ops', sentAt: T('2026-01-01'), sentBy: 'RP Ops', status: 'Sent', ...o });
const rp = (agreements) => ({ id: 'rp-x', name: 'Sample agency', agreements, activity: [] });
const DAY = '2026-11-02';

// none: held, nothing derived
const none = rp([]);
ok('no versions: no active', A.activeAgreement(none, DAY), null);
ok('no versions: held', A.commissionHeld(none, DAY), true);
ok('no versions: no notes', A.agreementNotes(none).length, 0);
ok('no versions: no emails', A.agreementEmails(none).length, 0);
ok('no versions: no activity', A.agreementActivity(none, DAY).length, 0);

// first sent: open with the RP, still held
const sent = rp([v('v1', {})]);
ok('sent: open', A.openAgreement(sent)?.id, 'v1');
ok('sent: with RP', A.withRp(A.openAgreement(sent)), true);
ok('sent: held', A.commissionHeld(sent, DAY), true);
ok('sent: one note, one E8', [A.agreementNotes(sent).length, A.agreementEmails(sent).map((e) => e.tpl)], [1, ['E8']]);

// signed copy uploaded then accepted
const accepted = rp([v('v1', { status: 'Accepted', copies: [{ file: 's.pdf', size: 1, on: '2026-01-02', at: T('2026-01-02'), by: 'RP Admin' }], accepted: { by: 'RP Ops', at: T('2026-01-03') }, effectiveFrom: '2026-01-03' })]);
ok('accepted: active', A.activeAgreement(accepted, DAY)?.id, 'v1');
ok('accepted: not held', A.commissionHeld(accepted, DAY), false);
ok('accepted: status', A.statusOf(accepted, accepted.agreements[0], DAY), 'Accepted');

// a new version pending: the old one stays active, nothing held
const pending = rp([...accepted.agreements, v('v2', { uploadedAt: T('2026-10-30', 9), sentAt: T('2026-10-30') })]);
ok('new pending: old active', A.activeAgreement(pending, DAY)?.id, 'v1');
ok('new pending: not held', A.commissionHeld(pending, DAY), false);
ok('new pending: open is v2', A.openAgreement(pending)?.id, 'v2');
ok('new pending: card note', A.rpCardCopy(pending, pending.agreements[1]).note, 'Your current agreement stays active until this one is accepted.');

// the new one accepted: active, the old one Superseded
const swapped = rp([accepted.agreements[0], { ...pending.agreements[1], status: 'Accepted', accepted: { by: 'RP Ops', at: T('2026-11-01') }, effectiveFrom: '2026-11-01' }]);
ok('accepted new: active v2', A.activeAgreement(swapped, DAY)?.id, 'v2');
ok('accepted new: v1 superseded', A.statusOf(swapped, swapped.agreements[0], DAY), 'Superseded');
ok('accepted new: superseded logged', A.agreementActivity(swapped, DAY).some((s) => /superseded by v2/.test(s.what)), true);

// accepted with a later effective date: the old one stays active until then
const later = rp([accepted.agreements[0], { ...swapped.agreements[1], effectiveFrom: '2026-12-01' }]);
ok('future effective: v1 still active', A.activeAgreement(later, DAY)?.id, 'v1');
ok('future effective: v1 not superseded yet', A.statusOf(later, later.agreements[0], DAY), 'Accepted');
ok('future effective: v1 superseded on the day', A.statusOf(later, later.agreements[0], '2026-12-01'), 'Superseded');

// withdrawn and sent back
const wd = rp([v('v1', { status: 'Withdrawn', withdrawn: { by: 'RP Ops', at: T('2026-01-02') } })]);
ok('withdrawn: nothing open', A.openAgreement(wd), null);
const back = rp([v('v1', { status: 'Sent back', returns: [{ by: 'RP Ops', at: T('2026-01-04'), reason: 'Unsigned page' }] })]);
ok('sent back: with RP, one E9', [A.withRp(A.openAgreement(back)), A.agreementEmails(back).filter((e) => e.tpl === 'E9').length], [true, 1]);

// every derived item names a version that exists
for (const r of [sent, accepted, pending, swapped, later, wd, back]) {
  const ids = new Set(r.agreements.map((x) => x.id));
  for (const n of A.agreementNotes(r)) ok(`note ${n.id} from a version`, ids.has(n.id.split('-')[1]), true);
}
console.log(`\n${pass} checks pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
