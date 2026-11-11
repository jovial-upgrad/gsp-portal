/**
 * GSP · Admissions' Change status pop-up: the same pop-up as the Institution Team's, so both ask for exactly what
 * each status needs (data/applications.ts STATUS_NEEDS: the university reference, the offer and acceptance
 * letters, who lodges the visa, the visa grant when GSP lodged it, the optional acceptance letter at Student
 * enrolled) and keep Student enrolled's commission check (11 Nov: restored after the 6 Nov base dropped them).
 */
export { StatusDialog, letterFor, type StatusPick } from '../../institution/applications/StatusDialog';
import '../../institution/applications/applications.css';
