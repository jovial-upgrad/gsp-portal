import type { ReactNode } from 'react';
import type { ConfigSection } from '../portal/model';
import { type Cfg } from '../data/store';
export { sampleCfg, type Cfg } from '../data/store';
import { Regions, Permissions } from './Roles';
import { Users } from './Users';
import { Emails } from './Emails';
import { Bdm } from './Bdm';
import { Currency, LivingCosts } from './Course';
import { EnglishEquivalence, GradeConversion } from './Eligibility';
import { Routing } from './Routing';
import { Documents } from './Documents';
import { Logs, Security } from './Other';
import { NoAccessPage, NotFoundPage, useSim } from './states';
import './config.css';

/** What every configuration page gets. `change` saves and logs in one go; `say` confirms it. */
export type ConfigProps = {
  cfg: Cfg;
  change: (area: string, text: string, fn: (c: Cfg) => Cfg) => void;
  say: (m: string) => void;
  me: string;
  /** View + edit on the page's object (PRD slice 1, Permission model); View shows the page without its actions. */
  canEdit: boolean;
  /** The signed-in person's role, for the log. */
  role: string;
  /** Go to another page (Home's buttons, Go to Home). */
  go?: (k: string) => void;
};

/**
 * GSP Admin's configuration pages, one per menu item under User roles (Create roles, Sales regions, Permission
 * roles, Emails), Recruitment, Course configuration, Application configuration and Other configurations, as the
 * slice 1 PRD specifies them. Every change is logged: who, their role, when, what (old → new), on Logs.
 * There is no Queues page here: queues are edited only in Admin › Work (S4-1).
 */
export function ConfigPage({ section, cfg, setCfg, me, role, canEdit, say, go }: { section: ConfigSection; cfg: Cfg; setCfg: (fn: (c: Cfg) => Cfg) => void; me: string; role: string; canEdit: boolean; say: (m: string) => void; go: (k: string) => void }) {
  const sim = useSim();
  const change: ConfigProps['change'] = (area, text, fn) =>
    setCfg((c) => {
      const next = fn(c);
      return { ...next, log: [{ id: `l${Date.now()}`, at: Date.now(), who: me, area, text, kind: 'change', role }, ...next.log] };
    });
  const p: ConfigProps = { cfg, change, say, me, role, canEdit: canEdit && sim !== 'view-only', go };
  if (sim === 'no-access') return <NoAccessPage onHome={() => go('home')} />;
  if (sim === 'not-found') return <NotFoundPage onHome={() => go('home')} />;
  const pages: Record<ConfigSection, ReactNode> = {
    users: <Users {...p} />,
    regions: <Regions {...p} />,
    permissions: <Permissions {...p} />,
    emails: <Emails {...p} />,
    bdm: <Bdm {...p} />,
    currency: <Currency {...p} />,
    living: <LivingCosts {...p} />,
    grades: <GradeConversion {...p} />,
    english: <EnglishEquivalence {...p} />,
    routing: <Routing {...p} />,
    documents: <Documents {...p} />,
    logs: <Logs {...p} />,
    security: <Security {...p} />,
    // Course tags is GSP · Institution's page (institution/records/CourseTags.tsx), routed by the portal
    tags: null,
  };
  return <div className="ipage cfg">{pages[section]}</div>;
}

/** The config state, for the portal: Admin's saved settings, which every role reads (admin/data/store.ts). */
export { useAdminCfg as useCfg } from '../data/store';
