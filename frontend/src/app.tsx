import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Gabarit } from '@/components/layout/Gabarit';
import { useSession } from '@/hooks/useDonnees';
import { useTheme } from '@/hooks/useTheme';
import { PageConnexion } from '@/pages/Connexion';
import { PageTableauDeBord } from '@/pages/TableauDeBord';
import { PageMoteur } from '@/pages/Moteur';
import { PageFormule } from '@/pages/Formule';
import { PageHistorique } from '@/pages/Historique';
import { PageBaremes } from '@/pages/Baremes';

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
          <Route index element={<PageTableauDeBord />} />
          <Route path="moteur/:moteur" element={<PageMoteur />} />
          <Route path="calcul/:moteur/:formule" element={<PageFormule />} />
          <Route path="historique" element={<PageHistorique />} />
          <Route path="baremes" element={<PageBaremes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster richColors position="bottom-right" theme={sombre ? 'dark' : 'light'} />
    </BrowserRouter>
  );
}
