import { useState, type ReactNode } from 'react';
import type { ConfigSection } from '../portal/model';
import {
  sampleBdm,
  sampleEmails,
  sampleQueues,
  sampleUsers,
  sampleDocRules,
  sampleLists,
  sampleLiving,
  sampleLog,
  samplePerms,
  sampleFx,
  sampleGrades,
  sampleEnglish,
  sampleRegions,
  sampleTags,
  sampleLevels,
  sampleAreas,
  sampleRpDocs,
  sampleRules,
  sampleCategories,
  REGION_BDM,
  type BdmRow,
  type DocRule,
  type EmailGroup,
  type Living,
  type LogEntry,
  type Perms,
  type Queue,
  type FxWeek,
  type GradeSystem,
  type EnglishRow,
  type ProgramLevel,
  type Region,
  type StudyArea,
  type Tag,
  type RouteRule,
  type RpDocRule,
  type User,
} from '../data/config';
import { Regions, Permissions } from './Roles';
import { QueuesSla, TaskRules } from './Work';
import { MyWork } from './MyWork';
import { runRules, sampleRecords, waitsFor, type Wait, type WorkTask } from '../data/mywork';
import { sampleCalendars, sampleRules as sampleTaskRules, type Calendar, type TaskRule } from '../data/work';
import { sampleNationalities, type NationalityRow } from '../data/nationalities';
import { Users } from './Users';
import { Emails } from './Emails';
import { Bdm } from './Bdm';
import { Currency, LivingCosts } from './Course';
import { CourseTags, ProgramLevels } from './Catalogue';
import { TAGS, type CourseRec } from '../../institution/data/catalogue';
import { Routing } from './Routing';
import { Documents } from './Documents';
import { Logs } from './Other';
import { EnglishEquivalence, GradeConversion } from './Entry';
import { REJECT_REASONS } from '../../institution/applications/review';
import { GSP_USER } from '../user';
import './config.css';

/** Everything GSP Admin configures, held by its portal; each change is logged. */
export type Cfg = {
  users: User[];
  regions: Region[];
  /** Which sales region each student nationality goes to (Sales Regions › Nationality Map, 4 Nov). */
  nationalities: NationalityRow[];
  perms: Perms;
  queues: Queue[];
  /** Work (9 Nov): the working calendars every SLA counts on, and the task rules that make every task (each says
   *  where its task goes and its SLA). */
  calendars: Calendar[];
  taskRules: TaskRule[];
  /** My Work: the open tasks the task rules made from the records, and the records waiting on others. */
  tasks: WorkTask[];
  waits: Wait[];
  emails: EmailGroup[];
  bdm: BdmRow[];
  /** Weekly exchange rates, this week first. */
  fx: FxWeek[];
  living: Living[];
  tags: Tag[];
  levels: ProgramLevel[];
  areas: StudyArea[];
  rules: RouteRule[];
  lists: Record<string, string[]>;
  regionBdm: Record<string, string>;
  docRules: DocRule[];
  /** Why GSP sends a document back (Nesil, 3 Nov). */
  reasons: string[];
  /** What GSP asks a recruitment partner for (Nesil, 4 Nov). */
  categories: string[];
  grades: GradeSystem[];
  english: EnglishRow[];
  rpDocs: RpDocRule[];
  log: LogEntry[];
};
export const sampleCfg = (): Cfg => {
  const users = sampleUsers();
  const queues = sampleQueues(users);
  const regions = sampleRegions(queues);
  const taskRules = sampleTaskRules();
  const calendars = sampleCalendars(regions.map((r) => r.name));
  return {
    users,
    regions,
    nationalities: sampleNationalities(regions),
    perms: samplePerms(),
    queues,
    calendars,
    taskRules,
    tasks: runRules(taskRules, sampleRecords(GSP_USER), queues, regions, users, calendars),
    waits: waitsFor(),
    emails: sampleEmails(users),
    bdm: sampleBdm(),
    fx: sampleFx(),
    living: sampleLiving(),
    tags: sampleTags(TAGS),
    levels: sampleLevels(),
    areas: sampleAreas(),
    rules: sampleRules(),
    lists: sampleLists(),
    regionBdm: { ...REGION_BDM },
    docRules: sampleDocRules(),
    reasons: [...REJECT_REASONS],
    categories: sampleCategories(),
    grades: sampleGrades(),
    english: sampleEnglish(),
    rpDocs: sampleRpDocs(),
    log: sampleLog(),
  };
};

/** What every configuration page gets. `change` saves and logs in one go (with no text, it only saves); `say` confirms it. `courses` are the
 *  Institution pages' courses, for the counts on Course Tags and Program Level Configuration. */
export type ConfigProps = {
  cfg: Cfg;
  courses: CourseRec[];
  change: (area: string, text: string, fn: (c: Cfg) => Cfg) => void;
  say: (m: string) => void;
  me: string;
};

/**
 * GSP Admin's configuration pages (Nesil, 30 Oct), one per menu item under User roles (Create roles, Sales regions,
 * Permission roles, Queues, Emails), Recruitment, Course
 * configuration, Application configuration and Other configurations. Their fields come from the PM prototype's
 * Super Admin › Settings where it has them. Every change is logged: who, when, what, on Logs.
 */
export function ConfigPage({ section, cfg, setCfg, me, say, courses }: { section: ConfigSection; cfg: Cfg; setCfg: (fn: (c: Cfg) => Cfg) => void; me: string; say: (m: string) => void; courses: CourseRec[] }) {
  const change: ConfigProps['change'] = (area, text, fn) =>
    setCfg((c) => {
      const next = fn(c);
      // no text: nothing to log as a change (Export Log logs itself as a download)
      if (!text) return next;
      const u = c.users.find((x) => x.name === me);
      return { ...next, log: [{ id: `l${Date.now()}`, at: Date.now(), who: me, email: u?.email ?? GSP_USER.email, region: u?.region || 'Global', area, text, kind: 'change', role: 'Super Admin' }, ...next.log] };
    });
  const p: ConfigProps = { cfg, change, say, me, courses };
  const pages: Record<ConfigSection, ReactNode> = {
    users: <Users {...p} />,
    regions: <Regions {...p} />,
    permissions: <Permissions {...p} />,
    queues: <QueuesSla {...p} />,
    tasks: <TaskRules {...p} />,
    mywork: <MyWork {...p} />,
    emails: <Emails {...p} />,
    bdm: <Bdm {...p} />,
    currency: <Currency {...p} />,
    living: <LivingCosts {...p} />,
    tags: <CourseTags {...p} />,
    levels: <ProgramLevels {...p} />,
    grades: <GradeConversion {...p} />,
    english: <EnglishEquivalence {...p} />,
    routing: <Routing {...p} />,
    documents: <Documents {...p} />,
    logs: <Logs {...p} />,
  };
  return <div className="ipage cfg">{pages[section]}</div>;
}

/** The config state, for the portal. */
export const useCfg = () => useState(sampleCfg);
