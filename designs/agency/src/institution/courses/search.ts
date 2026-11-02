/**
 * One course search in every role (slice 3 PRD): the RP portal's, which reads the Institution Team's catalogue
 * (`searchCatalogue`). `setCatalogue` stays for the portals that still call it; the catalogue is read from the store.
 */
import type { Course, University } from '../../data/courses';
export * from '../../screens/courses/search';
export const setCatalogue = (_courses: Course[], _unis: University[]) => undefined;
