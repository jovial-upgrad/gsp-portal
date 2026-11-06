import type { ReactNode } from 'react';
import { HostContext } from './persona';
import Commissions from './Commissions';
import FinanceHome from './FinanceHome';
import Setup from './Setup';
import FxRates from './FxRates';
import Scenarios from './Scenarios';
import './finance.css';

/** Finance's pages in GSP Admin's portal (GSP · Finance, Jovial 31 Oct). */
export type FinSection = 'fin-uni' | 'fin-rp' | 'fin-run' | 'fin-exc' | 'fin-terms' | 'fin-reports' | 'fin-setup' | 'fin-fx' | 'fin-how' | 'fin-scen';
export const FIN_SECTIONS: FinSection[] = ['fin-uni', 'fin-rp', 'fin-run', 'fin-exc', 'fin-terms', 'fin-reports', 'fin-setup', 'fin-fx', 'fin-how', 'fin-scen'];
const VIEW: Record<FinSection, string | null> = { 'fin-uni': 'uni', 'fin-rp': 'rp', 'fin-run': 'payout', 'fin-exc': 'exceptions', 'fin-terms': 'terms', 'fin-reports': 'reports', 'fin-setup': null, 'fin-fx': null, 'fin-how': 'processes', 'fin-scen': null };
/** The add-on pages' ids, as Finance home's jobs name them, to this portal's sections. */
const PAGE: Record<string, string> = {
  'gspx-fin-home': 'home', 'gspx-fin-uni': 'fin-uni', 'gspx-fin-rp': 'fin-rp', 'gspx-fin-run': 'fin-run', 'gspx-fin-exc': 'fin-exc',
  'gspx-fin-terms': 'fin-terms', 'gspx-fin-reports': 'fin-reports', 'gspx-fin-setup': 'fin-setup', 'gspx-fin-fx': 'fin-fx', 'gspx-fin-how': 'fin-how', 'gspx-mywork': 'home', 'gspx-mail': 'home',
};

export function FinancePage({ section, go }: { section: FinSection | 'home'; go: (s: string) => void }) {
  const ctx = { hostRole: 'gsp-finance', openRecord: () => undefined, exit: () => undefined, openPage: (id: string) => go(PAGE[id] ?? 'home') };
  let page: ReactNode;
  if (section === 'home') page = <FinanceHome />;
  else if (section === 'fin-setup') page = <Setup />;
  else if (section === 'fin-fx') page = <FxRates />;
  else if (section === 'fin-scen') page = <Scenarios />;
  else page = <Commissions key={section} view={VIEW[section] as never} />;
  return (
    <HostContext.Provider value={ctx as never}>
      <div className="gspx-fin">{page}</div>
    </HostContext.Provider>
  );
}
