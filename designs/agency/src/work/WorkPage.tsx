import type { ReactNode } from 'react';
import { HostContext } from './persona';
import MyWork from './MyWork';
import Mail from './Mail';
import Queues from './Queues';
import TaskRules from './TaskRules';
import EmailsJobs from './EmailsJobs';
import '../finance/finance.css';
import './work.css';

/** My work, Mail and the work settings (Jovial, 31 Oct), in any portal. */
export type WorkSection = 'mywork' | 'mail' | 'work-sla' | 'work-rules' | 'work-mail';
export const WORK_SECTIONS: WorkSection[] = ['mywork', 'mail', 'work-sla', 'work-rules', 'work-mail'];
const PAGE: Record<string, string> = { 'gspx-mywork': 'mywork', 'gspx-mail': 'mail', 'gspx-queues': 'work-sla', 'gspx-rules': 'work-rules' };

export function WorkPage({ section, role, go, openApp, openRp }: { section: WorkSection; role: string; go: (s: string) => void; openApp: (id: string) => void; openRp?: (id: string) => void }) {
  const ctx = { hostRole: role, openRecord: openApp, openRp, exit: () => undefined, openPage: (id: string) => go(PAGE[id] ?? id) };
  const page: ReactNode = section === 'mywork' ? <MyWork /> : section === 'mail' ? <Mail /> : section === 'work-sla' ? <Queues /> : section === 'work-mail' ? <EmailsJobs /> : <TaskRules />;
  return (
    <HostContext.Provider value={ctx as never}>
      <div className="gspx-fin gspx-page">{page}</div>
    </HostContext.Provider>
  );
}
