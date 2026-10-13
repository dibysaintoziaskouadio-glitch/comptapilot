import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app';
import { PreferencesProvider } from './lib/i18n';
import './index.css';

const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
