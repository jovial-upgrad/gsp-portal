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
// slice 3 PRD's added pieces; loaded after every page's own styles (they come in with App)
import './styles/s3.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
