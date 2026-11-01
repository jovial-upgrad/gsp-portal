/**
 * GSP's working calendar, as Work › Calendars keeps it (HC32, Jovial 1 Nov): Monday to Friday, except Bangladesh,
 * Sunday to Thursday; 9:30 to 18:30; with each calendar's holidays. Used for dates GSP gives an RP, like when to
 * expect verification. The work store reads every module's applications, so it's loaded after this module starts;
 * until it is, the plain Monday to Friday week stands in.
 */
import { regionOfCountry } from './regions';
import { calendarOf, hoursText as calendarHours } from '../work/calendars';

type Cal = { days: number[]; holidays: [string, string][] };
/** The calendar for a country, by its sales region: Admin › Work › Working days (work/calendars.ts). */
export function calendarFor(country: string): Cal {
  return calendarOf(regionOfCountry(country));
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
/** "Mon–Fri, 9:30 am to 6:30 pm": the calendar's week and hours, for a contact card. */
export const hoursText = (country: string) => calendarHours(regionOfCountry(country));
