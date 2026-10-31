import { useState, type ReactNode } from 'react';
import type { ConfigSection } from '../portal/model';
import {
  sampleBdm,
  sampleEmails,
  sampleQueues,
  sampleUsers,
  sampleDocRules,
  sampleFilters,
  sampleLists,
  sampleLiving,
  sampleLog,
  samplePerms,
  sampleRates,
  sampleRegions,
  sampleRpDocs,
  sampleRules,
  REGION_BDM,
  type BdmRow,
  type DocRule,
  type EmailGroup,
  type FilterSet,
  type Living,
  type LogEntry,
  type Perms,
  type Queue,
  type Rate,
  type Region,
  type RouteRule,
  type RpDocRule,
  type User,
} from '../data/config';
import { Regions, Permissions, Queues } from './Roles';
import { Users } from './Users';
import { Emails } from './Emails';
import { Bdm } from './Bdm';
import { Currency, LivingCosts } from './Course';
import { Routing } from './Routing';
import { Documents } from './Documents';
import { Filters, Logs } from './Other';
import './config.css';

/** Everything GSP Admin configures, held by its portal; each change is logged. */
export type Cfg = {
  users: User[];
  regions: Region[];
  perms: Perms;
  queues: Queue[];
  emails: EmailGroup[];
  bdm: BdmRow[];
  rates: Rate[];
  living: Living[];
  rules: RouteRule[];
  lists: Record<string, string[]>;
  regionBdm: Record<string, string>;
  docRules: DocRule[];
  rpDocs: RpDocRule[];
  filters: FilterSet[];
  log: LogEntry[];
};
export const sampleCfg = (): Cfg => {
  const users = sampleUsers();
  return {
    users,
    regions: sampleRegions(),
    perms: samplePerms(),
    queues: sampleQueues(users),
    emails: sampleEmails(users),
    bdm: sampleBdm(),
    rates: sampleRates(),
    living: sampleLiving(),
    rules: sampleRules(),
    lists: sampleLists(),
    regionBdm: { ...REGION_BDM },
    docRules: sampleDocRules(),
    rpDocs: sampleRpDocs(),
    filters: sampleFilters(),
    log: sampleLog(),
  };
};

/** What every configuration page gets. `change` saves and logs in one go; `say` confirms it. */
export type ConfigProps = {
  cfg: Cfg;
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
export function ConfigPage({ section, cfg, setCfg, me, say }: { section: ConfigSection; cfg: Cfg; setCfg: (fn: (c: Cfg) => Cfg) => void; me: string; say: (m: string) => void }) {
  const change: ConfigProps['change'] = (area, text, fn) =>
    setCfg((c) => {
      const next = fn(c);
      return { ...next, log: [{ id: `l${Date.now()}`, at: Date.now(), who: me, area, text, kind: 'change', role: 'Super Admin' }, ...next.log] };
    });
  const p: ConfigProps = { cfg, change, say, me };
  const pages: Record<ConfigSection, ReactNode> = {
    users: <Users {...p} />,
    regions: <Regions {...p} />,
    permissions: <Permissions {...p} />,
    queues: <Queues {...p} />,
    emails: <Emails {...p} />,
    bdm: <Bdm {...p} />,
    currency: <Currency {...p} />,
    living: <LivingCosts {...p} />,
    routing: <Routing {...p} />,
    documents: <Documents {...p} />,
    filters: <Filters {...p} />,
    logs: <Logs {...p} />,
  };
  return <div className="ipage cfg">{pages[section]}</div>;
}

/** The config state, for the portal. */
export const useCfg = () => useState(sampleCfg);
