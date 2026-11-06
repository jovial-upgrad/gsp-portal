/**
 * Who the prototype is seen as, for testing: the recruitment partner's admin (the agency portal), GSP's own
 * team, or GSP's Institution Team (GSP · Institution), the GSP Team members a GSP admin gives access to keep the
 * institutions' records. GSP Team starts as a copy of the agency portal (src/gsp) so it can change without touching
 * RP Admin; the Institution Team started as a copy of GSP Team (src/institution) and never touches either. GSP
 * Admin (GSP · Admin, 30 Oct) builds on the Institution Team (src/admin), with its own configuration. RP Ops
 * (4 Nov) is GSP's team for the recruitment partners (src/rpops): the Institution Team's Applications, Students,
 * Course search and Recruitment partners, and the Inbox. GSP · View Only (6 Nov) is GSP · Institution's portal with
 * nothing to change but Course search (see proto/viewOnly.tsx). GSP · Finance (6 Nov, src/finance) is GSP · Institution's
 * pages with RP Ops' partners: Inbox, My work, Students and Course search to use, commission to change, the rest to look at.
 */
export type Role = 'rp-admin' | 'rp-admin-backup' | 'rp-branch' | 'rp-counsellor' | 'gsp-team' | 'institution-partner' | 'gsp-admin' | 'rp-ops' | 'gsp-view' | 'gsp-finance' | 'gsp-globalops' | 'gsp-recruitment' | 'gsp-instops';

/** 4 Nov: GSP Team shows as "GSP · Admissions" and RP Ops as "GSP · RP Ops" in the prototype; the keys stay. */
export const ROLES: { key: Role; label: string; note: string }[] = [
  { key: 'rp-admin', label: 'RP Admin', note: 'The recruitment partner’s admin: the agency portal.' },
  // 6 Nov (Nesil): a copy of RP Admin as it stood before the access sheets, kept for reference; engineering builds from RP Admin
  { key: 'rp-admin-backup', label: 'RP Admin (Backup - not for Engineering)', note: 'A copy of RP Admin as it stood on 6 Nov, kept for reference. Engineering builds from RP Admin.' },
  // 6 Nov (access sheet): the agency's own people, on RP Admin's portal without commission
  { key: 'rp-branch', label: 'GSP Branch Manager', note: 'An agency branch’s manager: that branch’s students and applications; no commission.' },
  { key: 'rp-counsellor', label: 'GSP Counsellor', note: 'An agency counsellor: their own students and applications; no commission.' },
  { key: 'gsp-team', label: 'GSP · Admissions', note: 'GSP’s admissions team: GSP’s side of every application.' },
  { key: 'institution-partner', label: 'GSP · Institution', note: 'GSP’s Institution Team: universities, courses and partners.' },
  { key: 'gsp-admin', label: 'GSP · Admin', note: 'GSP’s admins: configuration, and the Institution Team’s pages.' },
  { key: 'rp-ops', label: 'GSP · RP Ops', note: 'GSP’s team for the recruitment partners: their applications, students and records.' },
  { key: 'gsp-finance', label: 'GSP · Finance', note: 'GSP’s Finance team: commission on applications and partners; the rest to look at.' },
  { key: 'gsp-globalops', label: 'GSP · Global Ops', note: 'GSP’s Global Ops team: applications, universities and announcements; partners to look at.' },
  { key: 'gsp-recruitment', label: 'GSP · Recruitment', note: 'GSP’s Recruitment team: recruitment partners, branches and teams; applications to look at, with their chat.' },
  { key: 'gsp-instops', label: 'GSP · Institution Ops', note: 'GSP’s Institution Ops team: universities, courses and announcements; institution partners to look at.' },
  { key: 'gsp-view', label: 'GSP · View Only', note: 'GSP · Institution’s pages to look at: only Course search can be used.' },
];

/** The two roles Side by side shows. */
export const PAIR: Role[] = ['rp-admin', 'gsp-team'];
export const roleLabel = (r: Role) => ROLES.find((x) => x.key === r)!.label;

export const roleOf = (v: string | null): Role => (v === 'gsp-team' || v === 'institution-partner' || v === 'gsp-admin' || v === 'rp-ops' || v === 'gsp-view' || v === 'gsp-finance' || v === 'gsp-globalops' || v === 'gsp-recruitment' || v === 'gsp-instops' || v === 'rp-admin-backup' || v === 'rp-branch' || v === 'rp-counsellor' ? v : 'rp-admin');
