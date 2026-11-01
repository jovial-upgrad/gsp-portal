import { TEST_COUNTRY } from '../../data/rpteam';
/** Review states for the Students page and student records, for an agency GSP has verified. */
import { sampleStudents, type Student } from '../../data/students';
import { newAdd, type AddState } from './form';
import type { RecordTab } from './StudentRecord';

type Make = (me: string) => { students: Student[]; add?: AddState | true; open?: string; tab?: RecordTab };

const filled = (patch: Partial<AddState['f']>, more: Partial<AddState> = {}): AddState => {
  const a = newAdd(TEST_COUNTRY);
  return { ...a, ...more, f: { ...a.f, ...patch } };
};

export const STUDENT_PRESETS: Record<string, { label: string; make: Make }> = {
  'students-empty': { label: 'Students: Empty State', make: () => ({ students: [] }) },
  students: { label: 'Students: List', make: (me) => ({ students: sampleStudents(me) }) },
  'students-add': { label: 'Students: Add', make: (me) => ({ students: sampleStudents(me), add: true }) },
  // the "Add:" states sit under "Students: Add" in the Prototype panel
  'students-autofill': {
    label: 'Add: From passport',
    make: (me) => ({
      students: sampleStudents(me),
      add: filled(
        { first: 'Arjun', last: 'Nair', passport: 'W4831726' },
        { file: { name: 'arjun_nair_passport.jpg' }, auto: ['first', 'last', 'nationality', 'passport'], extra: { dob: '19/05/2002', gender: 'Male', passportExpiry: '11/02/2033' } },
      ),
    }),
  },
  'students-errors': {
    label: 'Add: Validations',
    make: (me) => ({ students: sampleStudents(me), add: filled({ first: 'Meera', email: 'meera.iyer@gmail', phone: '98', passport: 'AB12' }, { submitted: true, attempts: 1 }) }),
  },
  'students-duplicate': {
    label: 'Add: Email already exists',
    make: (me) => ({ students: sampleStudents(me), add: filled({ first: 'Priya', last: 'Raman', email: 'priya.raman@gmail.com' }, { touched: { email: true } }) }),
  },
  'students-add-complete': {
    label: 'Add: Completed',
    make: (me) => ({
      students: sampleStudents(me),
      add: filled({ first: 'Kavya', last: 'Menon', passport: 'Z5528190', email: 'kavya.menon@gmail.com', phone: '98455 21307', highest: 'ug' }),
    }),
  },
  'student-new': { label: 'Profile: Basic Data Added', make: (me) => ({ students: sampleStudents(me), open: 'S-24818', tab: 'personal' }) },
  'student-education': { label: 'Profile: Record Pending', make: (me) => ({ students: sampleStudents(me), open: 'S-24818', tab: 'education' }) },
  'student-complete': { label: 'Record: complete profile', make: (me) => ({ students: sampleStudents(me), open: 'S-24811', tab: 'personal' }) },
  'student-tests': { label: 'Record: tests', make: (me) => ({ students: sampleStudents(me), open: 'S-24807', tab: 'tests' }) },
  'student-documents': { label: 'Record: documents', make: (me) => ({ students: sampleStudents(me), open: 'S-24781', tab: 'documents' }) },
};
