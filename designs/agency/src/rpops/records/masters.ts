/**
 * Master Partners (Nesil, 4 Nov, in RP Ops): aggregators that bring several RPs under them. GSP pays the Master
 * Partner for its RPs' applications, on its own commission terms. RP Ops onboards one in person, outside the portal:
 * there's no Master Partner portal and no Master Partner users. An RP links to at most one Master Partner;
 * applications created after the link pay the Master Partner, and earlier ones stay as they were. 4 Nov (later): it can
 * cover several countries, states and cities (picked from lists), and has no notes.
 */
import type { LogLine, Stamp } from '../../institution/data/records';
import { regionOf, type FileMeta } from './data';

export type MpStatus = 'Active' | 'Inactive';
export const MP_STATUSES: MpStatus[] = ['Active', 'Inactive'];
/** A document RP Ops keeps for it: no checking, verification or agreement signing. */
export type MpDoc = { id: string; name: string; file: FileMeta; by: string; at: number };
export type MasterPartner = {
  id: string;
  /** MP-…, set by the system. */
  code: string;
  name: string;
  /** Where it works: one country or more, and the states and cities in them (none: the whole country). */
  countries: string[];
  states: string[];
  cities: string[];
  contact: { name: string; email: string; phone: string };
  /** Where Finance's statements go. */
  cemail: string;
  /** Its BDM at GSP. */
  recruitment: string;
  status: MpStatus;
  /** Its commission terms: its share of GSP's commission on its RPs' applications, from when. */
  share: number;
  shareFrom: string;
  docs: MpDoc[];
  created: Stamp;
  last: Stamp;
  /** Every change after it was added, newest last. */
  log: LogLine[];
};

/** The sample: the one in the reference, and one in Nepal with an RP under it. */
export function sampleMps(): MasterPartner[] {
  return [
    {
      id: 'mp-1002',
      code: 'MP-1002',
      name: 'South Asia Study Alliance',
      countries: ['India'],
      states: ['Maharashtra'],
      cities: ['Pune'],
      contact: { name: 'Neha Kulkarni', email: 'neha@sasalliance.in', phone: '+91 98220 31877' },
      cemail: 'finance@sasalliance.in',
      recruitment: 'Saurabh Chaudhary',
      status: 'Active',
      share: 80,
      shareFrom: '2026-10-21',
      docs: [],
      created: { by: 'Garima Bhardwaj', at: '2026-10-21T10:00' },
      last: { by: 'Garima Bhardwaj', at: '2026-10-21T10:00' },
      log: [],
    },
    {
      id: 'mp-1001',
      code: 'MP-1001',
      name: 'Himalaya Partner Network',
      countries: ['Nepal'],
      states: ['Bagmati Zone', 'Gandaki Zone'],
      cities: ['Kathmandu', 'Pokhara'],
      contact: { name: 'Ramesh KC', email: 'ramesh@himalayapartners.com.np', phone: '+977 98460 55210' },
      cemail: 'accounts@himalayapartners.com.np',
      recruitment: 'Sujan Shrestha',
      status: 'Active',
      share: 85,
      shareFrom: '2026-01-01',
      docs: [
        { id: 'mpd-1', name: 'Business registration certificate', file: { name: 'HPN-business-registration.pdf', size: 612_000 }, by: 'Garima Bhardwaj', at: Date.parse('2026-01-08T11:42:00') },
        { id: 'mpd-2', name: 'Master Partner agreement, signed in person', file: { name: 'HPN-master-partner-agreement-signed.pdf', size: 1_240_000 }, by: 'Garima Bhardwaj', at: Date.parse('2026-01-08T11:45:00') },
      ],
      created: { by: 'Garima Bhardwaj', at: '2026-01-08T11:30' },
      last: { by: 'Garima Bhardwaj', at: '2026-01-10T15:05' },
      log: [
        { id: 'mpl-1', at: '2026-01-08T11:42', by: 'Garima Bhardwaj', part: 'documents', what: 'Uploaded Business registration certificate' },
        { id: 'mpl-2', at: '2026-01-08T11:45', by: 'Garima Bhardwaj', part: 'documents', what: 'Uploaded Master Partner agreement, signed in person' },
        { id: 'mpl-3', at: '2026-01-10T15:05', by: 'Garima Bhardwaj', part: 'rps', what: 'Linked Himalayan Study Centre (AG-1019)' },
      ],
    },
  ];
}

/** Its sales regions, one for each country's (a Master Partner can cover several). */
export const regionsOf = (m: Pick<MasterPartner, 'countries'>) => [...new Set(m.countries.map(regionOf))];

/** The next code: MP- and one more than the highest. */
export const nextCode = (l: MasterPartner[]) => `MP-${Math.max(1000, ...l.map((m) => Number(m.code.slice(3)) || 0)) + 1}`;
