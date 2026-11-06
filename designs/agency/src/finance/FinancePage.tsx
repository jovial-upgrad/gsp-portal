import type { ReactNode } from 'react';
import { HostContext } from './persona';
import Commissions from './Commissions';
import FinanceHome from './FinanceHome';
import Setup from './Setup';
import FxRates from './FxRates';
import CommissionLines from './CommissionLines';
import Scenarios from './Scenarios';
import './finance.css';

/** Finance's pages in GSP Admin's portal (GSP · Finance, Jovial 31 Oct). */
export type FinSection = 'fin-uni' | 'fin-rp' | 'fin-run' | 'fin-exc' | 'fin-terms' | 'fin-reports' | 'fin-setup' | 'fin-fx' | 'fin-how' | 'fin-scen' | 'fin-lines';
export const FIN_SECTIONS: FinSection[] = ['fin-uni', 'fin-rp', 'fin-run', 'fin-exc', 'fin-terms', 'fin-reports', 'fin-setup', 'fin-fx', 'fin-how', 'fin-scen', 'fin-lines'];
const VIEW: Record<FinSection, string | null> = { 'fin-uni': 'uni', 'fin-rp': 'rp', 'fin-run': 'payout', 'fin-exc': 'exceptions', 'fin-terms': 'terms', 'fin-reports': 'reports', 'fin-setup': null, 'fin-fx': null, 'fin-lines': null, 'fin-how': 'processes', 'fin-scen': null };
/** The add-on pages' ids, as Finance home's jobs name them, to this portal's sections. */
const PAGE: Record<string, string> = {
  'gspx-fin-home': 'home', 'gspx-fin-uni': 'fin-lines', 'gspx-fin-rp': 'fin-lines', 'gspx-fin-run': 'fin-lines', 'gspx-fin-exc': 'fin-lines', 'gspx-comm': 'fin-lines', 'gspx-fin-lines': 'fin-lines',
  'gspx-fin-terms': 'fin-terms', 'gspx-fin-reports': 'fin-reports', 'gspx-fin-setup': 'fin-setup', 'gspx-fin-fx': 'fin-fx', 'gspx-fin-how': 'fin-how', 'gspx-mywork': 'home', 'gspx-mail': 'home',
};

export function FinancePage({ section, go }: { section: FinSection | 'home'; go: (s: string) => void }) {
  const ctx = { hostRole: 'gsp-finance', openRecord: () => undefined, exit: () => undefined, openPage: (id: string) => go(PAGE[id] ?? 'home') };
  let page: ReactNode;
  if (section === 'home') page = <FinanceHome />;
  else if (section === 'fin-setup') page = <Setup />;
  else if (section === 'fin-fx') page = <FxRates />;
  // one page for commissions (Jovial, 6 Nov): the old University invoices, RP commission, RP invoices and Exceptions open it
  else if (section === 'fin-lines' || section === 'fin-uni' || section === 'fin-exc') page = <CommissionLines key={section} start={section === 'fin-exc' ? 'exc' : 'uni'} />;
  else if (section === 'fin-rp' || section === 'fin-run') page = <CommissionLines key={section} start="rp" />;
  else if (section === 'fin-scen') page = <Scenarios />;
  else page = <Commissions key={section} view={VIEW[section] as never} />;
  return (
    <HostContext.Provider value={ctx as never}>
      <div className="gspx-fin">{page}</div>
    </HostContext.Provider>
  );
}
