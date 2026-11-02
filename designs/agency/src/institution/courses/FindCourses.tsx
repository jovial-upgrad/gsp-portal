import type { ComponentProps } from 'react';
import { FindCourses as Shared } from '../../screens/courses/FindCourses';

/**
 * Find courses in GSP's roles: the RP portal's page (slice 3 PRD: one course search for RP users and every GSP
 * role), with no Student view and no commission figures, since GSP's people never see commission here (W26).
 */
export function FindCourses(p: Omit<ComponentProps<typeof Shared>, 'gsp'>) {
  return <Shared {...p} gsp />;
}
