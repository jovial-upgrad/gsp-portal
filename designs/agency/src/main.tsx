import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installDownloadLog } from './data/downloads';

// every CSV downloaded anywhere is logged in GSP · Admin › Logs
installDownloadLog();
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/tokens.css';
import './styles/base.css';
import './proto/stage.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
