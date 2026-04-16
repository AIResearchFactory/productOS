import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

import { appApi } from './api/app';

// Expose appApi for E2E testing
if (typeof window !== 'undefined') {
  (window as any).appApi = appApi;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
