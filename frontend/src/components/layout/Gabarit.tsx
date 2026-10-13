import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookMarked, History, LayoutDashboard, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useCatalogue, useSession } from '@/hooks/useDonnees';
import { useTheme } from '@/hooks/useTheme';
import { apparence, pastille } from '@/lib/moteurs';
import { cn } from '@/lib/utils';
import { PaletteCommandes } from './PaletteCommandes';

/** « Compte de démonstration » → « CD » ; un seul mot → ses deux premières lettres. */
const initiales = (nom: string) => {
  const mots = nom.trim().split(/\s+/).filter((m) => m.length > 2 || /^[A-ZÀ-Ý]/.test(m));
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : nom.slice(0, 2)).toUpperCase();
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl degrade-accent shadow-[0_6px_18px_-6px_hsl(243_75%_55%/.7)]">
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17l5-6 4 3 7-9" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="font-bold tracking-tight">Comptapilot</p>
        <p className="text-[11px] text-attenue">Moteur de calcul comptable</p>
      </div>
    </div>
  );
}

function LienNav({ to, icone, libelle, compte, teinte, fin }: { to: string; icone: React.ReactNode; libelle: string; compte?: number; teinte?: number; fin?: boolean }) {
  return (
    <NavLink
      to={to}
      end={fin}
      className={({ isActive }) =>
        cn('group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13.5px] transition-colors', isActive ? 'bg-surface-2 font-semibold text-texte' : 'text-attenue hover:bg-surface-2/70 hover:text-texte')
      }
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={teinte !== undefined ? pastille(teinte) : undefined}>
        {icone}
      </span>
      <span className="flex-1 truncate">{libelle}</span>
      {compte !== undefined && <span className="chiffre text-[11px] text-attenue">{compte}</span>}
    </NavLink>
  );
}

export function Gabarit() {
  const { moteurs, formules } = useCatalogue();
  const { data: session } = useSession();
  const { sombre, basculer } = useTheme();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const qc = useQueryClient();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => setMenu(false), [loc.pathname]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  const deconnexion = async () => {
    await api('/auth/deconnexion', { method: 'POST' });
    qc.clear();
    nav('/connexion');
  };

  const barre = (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-5 barre-defilement">
      <div className="px-2">
        <Logo />
      </div>
      <div className="space-y-0.5">
        <LienNav to="/" fin icone={<LayoutDashboard className="size-4" />} libelle="Tableau de bord" />
        <LienNav to="/historique" icone={<History className="size-4" />} libelle="Historique des calculs" />
        <LienNav to="/baremes" icone={<BookMarked className="size-4" />} libelle="Barèmes et taux" />
      </div>
      <div>
        <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-attenue">Moteurs · {formules.length} formules</p>
        <div className="space-y-0.5">
          {moteurs.map((m) => {
            const a = apparence(m.code);
            return <LienNav key={m.code} to={`/moteur/${m.code}`} teinte={a.teinte} icone={<a.icone className="size-3.5" />} libelle={m.nom} compte={m.formules.length} />;
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-bordure bg-surface/80 backdrop-blur-xl lg:block">{barre}</aside>
      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-bordure bg-surface animate-in slide-in-from-left" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-5 rounded-lg p-1.5 text-attenue hover:bg-surface-2" onClick={() => setMenu(false)} aria-label="Fermer le menu">
              <X className="size-4" />
            </button>
            {barre}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-bordure bg-fond/75 px-4 backdrop-blur-xl sm:px-6">
        <button className="rounded-lg p-2 text-attenue hover:bg-surface-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Menu">
          <Menu className="size-5" />
        </button>
        <button
          onClick={() => setPalette(true)}
          className="flex h-10 min-w-0 flex-1 max-w-md items-center gap-2.5 rounded-xl border border-bordure bg-surface px-3 text-sm text-attenue shadow-carte transition-colors hover:border-accent/40"
        >
          <Search className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">Rechercher une formule…</span>
          <kbd className="hidden rounded-md border border-bordure px-1.5 py-0.5 font-mono text-[11px] sm:block">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <button onClick={basculer} className="rounded-xl p-2.5 text-attenue hover:bg-surface-2 hover:text-texte" aria-label="Changer de thème">
            {sombre ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
          {session && (
            <div className="flex items-center gap-2.5 rounded-xl py-1 pl-1 sm:pr-2">
              <div className="grid size-8 place-items-center rounded-full degrade-accent text-xs font-bold text-white">{initiales(session.utilisateur.nom)}</div>
              <div className="hidden leading-tight sm:block">
                <p className="text-[13px] font-semibold">{session.utilisateur.nom}</p>
                <p className="text-[11px] text-attenue">{session.utilisateur.role === 'ADMIN' ? 'Administrateur' : session.utilisateur.role === 'COMPTABLE' ? 'Comptable' : 'Lecteur'}</p>
              </div>
              <button onClick={deconnexion} className="ml-1 rounded-lg p-2 text-attenue hover:bg-surface-2 hover:text-danger" aria-label="Se déconnecter" title="Se déconnecter">
                <LogOut className="size-4" />
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
      <PaletteCommandes ouvert={palette} onFermer={() => setPalette(false)} />
    </div>
  );
}
