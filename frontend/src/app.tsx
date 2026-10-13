import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Gabarit } from '@/components/layout/Gabarit';
import { useSession } from '@/hooks/useDonnees';
import { useTheme } from '@/hooks/useTheme';
import { PageConnexion } from '@/pages/Connexion';
import { InviteInstallation } from '@/components/InviteInstallation';

// Pages chargées à la demande : l'écran de connexion s'affiche sans attendre les graphiques et les moteurs.
const PageTableauDeBord = lazy(() => import('@/pages/TableauDeBord').then((m) => ({ default: m.PageTableauDeBord })));
const PageMoteur = lazy(() => import('@/pages/Moteur').then((m) => ({ default: m.PageMoteur })));
const PageFormule = lazy(() => import('@/pages/Formule').then((m) => ({ default: m.PageFormule })));
const PageHistorique = lazy(() => import('@/pages/Historique').then((m) => ({ default: m.PageHistorique })));
const PageBaremes = lazy(() => import('@/pages/Baremes').then((m) => ({ default: m.PageBaremes })));

const Attente = () => (
  <div className="grid min-h-[50vh] place-items-center">
    <Loader2 className="size-6 animate-spin text-accent" />
  </div>
);

function Protege() {
  const session = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    const f = () => {
      qc.clear();
      nav('/connexion');
    };
    window.addEventListener('session-expiree', f);
    return () => window.removeEventListener('session-expiree', f);
  }, [nav, qc]);
  if (session.isLoading)
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  if (session.isError) return <Navigate to="/connexion" replace />;
  return <Gabarit />;
}

export function App() {
  const { sombre } = useTheme();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<PageConnexion />} />
        <Route element={<Protege />}>
          <Route index element={<Suspense fallback={<Attente />}><PageTableauDeBord /></Suspense>} />
          <Route path="moteur/:moteur" element={<Suspense fallback={<Attente />}><PageMoteur /></Suspense>} />
          <Route path="calcul/:moteur/:formule" element={<Suspense fallback={<Attente />}><PageFormule /></Suspense>} />
          <Route path="historique" element={<Suspense fallback={<Attente />}><PageHistorique /></Suspense>} />
          <Route path="baremes" element={<Suspense fallback={<Attente />}><PageBaremes /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <InviteInstallation />
      <Toaster richColors position="bottom-right" theme={sombre ? 'dark' : 'light'} />
    </BrowserRouter>
  );
}
