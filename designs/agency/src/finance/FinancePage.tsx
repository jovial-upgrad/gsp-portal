import type { ReactNode } from 'react';
import { HostContext } from './persona';
import Commissions from './Commissions';
import FinanceHome from './FinanceHome';
import Setup from './Setup';
import './finance.css';

/** Finance's pages in GSP Admin's portal (GSP · Finance, Jovial 31 Oct). */
export type FinSection = 'fin-uni' | 'fin-rp' | 'fin-run' | 'fin-exc' | 'fin-terms' | 'fin-reports' | 'fin-setup' | 'fin-how';
export const FIN_SECTIONS: FinSection[] = ['fin-uni', 'fin-rp', 'fin-run', 'fin-exc', 'fin-terms', 'fin-reports', 'fin-setup', 'fin-how'];
const VIEW: Record<FinSection, string | null> = { 'fin-uni': 'uni', 'fin-rp': 'rp', 'fin-run': 'payout', 'fin-exc': 'exceptions', 'fin-terms': 'terms', 'fin-reports': 'reports', 'fin-setup': null, 'fin-how': 'processes' };
/** The add-on pages' ids, as Finance home's jobs name them, to this portal's sections. */
const PAGE: Record<string, string> = {
  'gspx-fin-home': 'home', 'gspx-fin-uni': 'fin-uni', 'gspx-fin-rp': 'fin-rp', 'gspx-fin-run': 'fin-run', 'gspx-fin-exc': 'fin-exc',
  'gspx-fin-terms': 'fin-terms', 'gspx-fin-reports': 'fin-reports', 'gspx-fin-setup': 'fin-setup', 'gspx-fin-how': 'fin-how', 'gspx-mywork': 'home', 'gspx-mail': 'home',
};

export function FinancePage({ section, go }: { section: FinSection | 'home'; go: (s: string) => void }) {
  const ctx = { hostRole: 'gsp-finance', openRecord: () => undefined, exit: () => undefined, openPage: (id: string) => go(PAGE[id] ?? 'home') };
  let page: ReactNode;
  if (section === 'home') page = <FinanceHome />;
  else if (section === 'fin-setup') page = <Setup />;
  else page = <Commissions key={section} view={VIEW[section] as never} />;
  return (
    <HostContext.Provider value={ctx as never}>
      <div className="gspx-fin">{page}</div>
    </HostContext.Provider>
  );
}
