import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { requestPersist } from './utils/storagePersist';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Request persistent storage so IndexedDB won't be evicted under storage pressure.
// Silently fails in private mode or on unsupported browsers — no user action needed.
requestPersist().catch(() => {});

