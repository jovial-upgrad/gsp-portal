import { createContext, useContext, type ReactNode } from 'react';
import { Icon } from '../components/Icon';

/**
 * View only (Nesil, 6 Nov): GSP · View Only sees GSP · Institution's pages but changes nothing, except in Course
 * search. Pages read this and leave out every way to change something: add, edit, delete, status changes, assign,
 * send, upload, link and forward. Looking, searching, filtering, opening records, previewing and downloading stay.
 * Every other role is outside the provider, so it reads false.
 */
const ViewOnly = createContext(false);
export const ViewOnlyProvider = ({ on, children }: { on: boolean; children: ReactNode }) => <ViewOnly.Provider value={on}>{children}</ViewOnly.Provider>;
export const useViewOnly = () => useContext(ViewOnly);
/** Shows its children only where changes are allowed. */
export const EditOnly = ({ children }: { children: ReactNode }) => (useContext(ViewOnly) ? null : <>{children}</>);
/** Where something would be written or added, a quiet line saying it's view only (the lock, then the words). */
export const ViewOnlyNote = ({ children, page }: { children: ReactNode; page?: boolean }) => (
  <p className={`iviewonly ${page ? 'iviewonly--page' : ''}`}>
    <Icon name="eye" size={16} />
    <span>{children}</span>
  </p>
);

/**
 * What a role leaves out or adds on pages it shares (GSP · Finance, 6 Nov). `hide` takes things away (an
 * application's Chat tab, commission in Course search, a university's Territory); `show` adds a role's own (the
 * Commission tabs). Every other role is outside the provider: nothing hidden, nothing added.
 */
export type Feature =
  // GSP · Admin marks a student's primary application (6 Nov)
  | 'app.primary'
  | 'app.chat'
  | 'app.mail'
  | 'app.documents'
  | 'app.submission'
  | 'app.commission'
  | 'courses.commission'
  | 'student.documents.view'
  | 'rp.commission'
  | 'uni.qs'
  | 'uni.scholarships'
  | 'uni.territory'
  | 'uni.submission'
  // GSP · Global Ops (6 Nov)
  | 'app.base-commission'
  | 'rp.documents'
  | 'rp.branches'
  | 'rp.team'
  | 'rp.commission-email'
  | 'mp.documents'
  | 'mp.commission'
  | 'ip.commission'
  | 'uni.qs-update'
  | 'uni.add'
  | 'uni.territory.view'
  | 'course.academic'
  | 'course.english'
  // GSP · Admissions (6 Nov)
  | 'rp.master'
  // GSP · Recruitment (6 Nov): commission to look at, an application's chat to use, a partner's documents to look at
  | 'app.commission.view'
  | 'app.chat.edit'
  | 'rp.documents.view'
  | 'rp.commission.view'
  // GSP · Finance: a Master Partner's commission terms to change inside a view-only page
  | 'mp.commission.edit'
  // GSP · Institution Ops (6 Nov): no Students or Applications, so Course search has no student, shortlist or Apply
  | 'courses.students';
type Access = { hide: ReadonlySet<Feature>; show: ReadonlySet<Feature> };
const AccessCtx = createContext<Access>({ hide: new Set(), show: new Set() });
export const AccessProvider = ({ hide = [], show = [], children }: { hide?: Feature[]; show?: Feature[]; children: ReactNode }) => (
  <AccessCtx.Provider value={{ hide: new Set(hide), show: new Set(show) }}>{children}</AccessCtx.Provider>
);
/** True when the role leaves this out. */
export const useHides = (f: Feature) => useContext(AccessCtx).hide.has(f);
/** True when the role adds this. */
export const useShows = (f: Feature) => useContext(AccessCtx).show.has(f);
