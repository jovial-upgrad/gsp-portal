import { HostContext } from './persona';
import Earnings from './Earnings';
import './finance.css';

/** The RP's Earnings page (RP Admin), on Finance's data: the agency's commission, the invoice to approve, bank details. */
export function RpEarnings() {
  return (
    <HostContext.Provider value={{ hostRole: 'rp-admin', openRecord: () => undefined } as never}>
      <div className="gspx-fin">
        <Earnings />
      </div>
    </HostContext.Provider>
  );
}
