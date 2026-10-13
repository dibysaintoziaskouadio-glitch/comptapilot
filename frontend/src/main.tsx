import React, { Component, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app';
import { PreferencesProvider } from './lib/i18n';
import './index.css';

/** Dernier filet : une erreur de rendu affiche un message lisible au lieu d'une page blanche. */
class FiletErreur extends Component<{ children: ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null };
  static getDerivedStateFromError(erreur: Error) {
    return { erreur };
  }
  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontWeight: 700, fontSize: 18 }}>Une erreur empêche l’affichage de Comptapilot.</p>
          <p style={{ opacity: 0.7, fontSize: 14 }}>{this.state.erreur.message}</p>
          <button onClick={() => location.reload()} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 999, border: '1px solid #999', background: 'transparent', cursor: 'pointer' }}>
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}

const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FiletErreur>
      <QueryClientProvider client={client}>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </QueryClientProvider>
    </FiletErreur>
  </React.StrictMode>,
);
