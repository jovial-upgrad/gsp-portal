/**
 * GSP's working calendar, as Work › Calendars keeps it (HC32, Jovial 1 Nov): Monday to Friday, except Bangladesh,
 * Sunday to Thursday; 9:30 to 18:30; with each calendar's holidays. Used for dates GSP gives an RP, like when to
 * expect verification. The work store reads every module's applications, so it's loaded after this module starts;
 * until it is, the plain Monday to Friday week stands in.
 */
import { regionOfCountry } from './regions';

type Cal = { id: string; name: string; days: number[]; hours: string; regions: string[]; holidays: [string, string][] };
const FALLBACK: Cal = { id: 'cal-mon-fri', name: 'Monday to Friday', days: [1, 2, 3, 4, 5], hours: '9:30 to 18:30', regions: [], holidays: [] };
let cals: (() => Cal[]) | null = null;
void import('../work/store')
  .then((m) => {
    cals = () => (m.getState() as { calendars: Cal[] }).calendars;
  })
  .catch(() => undefined);

/** The calendar for a country, by its sales region. */
export function calendarFor(country: string): Cal {
  const region = regionOfCountry(country);
  const all = cals?.() ?? [];
  return all.find((c) => c.regions.includes(region)) ?? all.find((c) => c.regions.includes('Global')) ?? all[0] ?? FALLBACK;
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const isWorkingDay = (d: Date, cal: Cal) => cal.days.includes(d.getDay()) && !cal.holidays.some(([h]) => h === iso(d));
/** The next working day after a time, in the country's calendar. */
export function nextWorkingDay(from: number, country: string) {
  const cal = calendarFor(country);
  const d = new Date(from);
  for (let i = 0; i < 14; i++) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d, cal)) break;
  }
  return d;
}
const DAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Mon–Fri, 9:30 am to 6:30 pm": the calendar's week and hours, for a contact card. */
export function hoursText(country: string) {
  const cal = calendarFor(country);
  const days = cal.days.length ? `${DAY_NAME[cal.days[0]]}–${DAY_NAME[cal.days[cal.days.length - 1]]}` : '';
  const t = (x: string) => {
    const [h, m] = x.trim().split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  };
  const [a, b] = cal.hours.split(' to ');
  return b ? `${days}, ${t(a)} to ${t(b)}` : days;
}
