import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// what a course earns (R104): registered once, read by every Find courses
import './finance/commission/estimate';
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
