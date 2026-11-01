import type { ReactNode } from 'react';
import type { ConfigSection } from '../portal/model';
import { type Cfg } from '../data/store';
export { sampleCfg, type Cfg } from '../data/store';
import { Regions, Permissions, Queues } from './Roles';
import { Users } from './Users';
import { Emails } from './Emails';
import { Bdm } from './Bdm';
import { Currency, LivingCosts, VisaFees } from './Course';
import { Routing } from './Routing';
import { Documents } from './Documents';
import { Logs, Security } from './Other';
import './config.css';

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
      return { ...next, log: [{ id: `l${Date.now()}`, at: Date.now(), who: me, area, text, kind: 'change', role: 'Admin' }, ...next.log] };
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
    visa: <VisaFees {...p} />,
    routing: <Routing {...p} />,
    documents: <Documents {...p} />,
    logs: <Logs {...p} />,
    security: <Security {...p} />,
  };
  return <div className="ipage cfg">{pages[section]}</div>;
}

/** The config state, for the portal: Admin's saved settings, which every role reads (admin/data/store.ts). */
export { useAdminCfg as useCfg } from '../data/store';
