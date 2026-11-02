/**
 * Master Partners (slice 2 PRD, S2-21 to S2-25, decided 2 Nov): an aggregator that brings several RPs under it. GSP
 * pays the MP for its RPs' applications on the MP's own commission terms. It has its own record, created by RP Ops
 * (GSP · BAP › Master Partners). There's no Master Partner portal and no Master Partner users (S2-24). RP Ops
 * onboards it in person and uploads its documents: no checking, verification or agreement signing (S2-25).
 */
import { nameOf } from '../../data/staff';
import { regionOfCountry } from '../../data/regions';
import { atIso, change, type Change, type Created } from './changelog';
import { inDays } from './records';
import { partnerManagerFor } from '../../data/partners';

export type MpStatus = 'Active' | 'Inactive';
export type MpDoc = { id: string; name: string; file: string; by: string; at: number };
/** An RP linked under the MP: from when its new applications pay the MP (S2-23), and who linked it. */
export type MpLink = { rpId: string; at: number; by: string };
export type MasterPartner = {
  id: string;
  /** MP- and a number, from MP-1001. */
  code: string;
  name: string;
  country: string;
  state: string;
  city: string;
  contact: { name: string; email: string; dial: string; phone: string };
  commissionsEmail: string;
  bdm: string;
  status: MpStatus;
  notes: string;
  docs: MpDoc[];
  rps: MpLink[];
  log: Change[];
  created: Created;
};

/** Its sales region: from its country through the map, as for an RP (slice 1). */
export const mpRegion = (m: Pick<MasterPartner, 'country'>) => regionOfCountry(m.country);
export const nextMpCode = (list: MasterPartner[]) => `MP-${Math.max(1000, ...list.map((m) => Number(m.code.slice(3)) || 0)) + 1}`;

const RO = (local: string) => nameOf(`${local}@upgrad.com`);

export const sampleMps = (): MasterPartner[] => {
  const by = RO('garima.bhardwaj');
  const rows: MasterPartner[] = [
    {
      id: 'mp-mekong',
      code: 'MP-1001',
      name: 'Mekong Education Network',
      country: 'Vietnam',
      state: 'Ho Chi Minh',
      city: 'Ho Chi Minh City',
      contact: { name: 'Quang Le', email: 'quang@mekongedu.vn', dial: '+84', phone: '90 811 7720' },
      commissionsEmail: 'accounts@mekongedu.vn',
      bdm: '',
      status: 'Active',
      notes: 'Brings agencies in Hanoi and the south. Onboarded in person in Ho Chi Minh City.',
      docs: [{ id: 'mpd-1', name: 'Business registration', file: 'Mekong_business_registration.pdf', by, at: atIso('2025-03-20') }],
      rps: [{ rpId: 'rp-hanoi', at: atIso('2025-04-21'), by }],
      log: [change(by, 'Recruitment Ops', 'RPs · Lotus Study Abroad', '—', 'Linked', atIso('2025-04-21')), change(by, 'Recruitment Ops', 'Master Partner created', '—', 'Mekong Education Network', atIso('2025-03-20'))],
      created: { by, at: atIso('2025-03-20') },
    },
    {
      id: 'mp-sasa',
      code: 'MP-1002',
      name: 'South Asia Study Alliance',
      country: 'India',
      state: 'Maharashtra',
      city: 'Pune',
      contact: { name: 'Neha Kulkarni', email: 'neha@sasalliance.in', dial: '+91', phone: '98220 31877' },
      commissionsEmail: 'finance@sasalliance.in',
      bdm: '',
      status: 'Active',
      notes: '',
      docs: [],
      rps: [],
      log: [change(by, 'Recruitment Ops', 'Master Partner created', '—', 'South Asia Study Alliance', atIso(inDays(-14)))],
      created: { by, at: atIso(inDays(-14)) },
    },
    {
      id: 'mp-gulf',
      code: 'MP-1003',
      name: 'Bengal Delta Partners',
      country: 'Bangladesh',
      state: 'Dhaka Division',
      city: 'Dhaka',
      contact: { name: 'Farhan Kabir', email: 'farhan@bengaldelta.com.bd', dial: '+880', phone: '1711 902 334' },
      commissionsEmail: 'farhan@bengaldelta.com.bd',
      bdm: '',
      status: 'Inactive',
      notes: 'Paused while its own agreements are reviewed.',
      docs: [],
      rps: [],
      log: [change(by, 'Recruitment Ops', 'Master Partner · Status', 'Active', 'Inactive', atIso(inDays(-30))), change(by, 'Recruitment Ops', 'Master Partner created', '—', 'Bengal Delta Partners', atIso('2025-08-01'))],
      created: { by, at: atIso('2025-08-01') },
    },
  ];
  // the BDM from BDM assignment, by city, state and country, once the location is in
  return rows.map((m) => ({ ...m, bdm: partnerManagerFor(m.country, m.city, '')?.name ?? '' }));
};
