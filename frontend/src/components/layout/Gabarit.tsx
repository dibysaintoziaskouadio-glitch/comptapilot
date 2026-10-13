/**
 * Mise en page de l'application, style « verre » :
 * - navigation verticale flottante (pilule d'icônes, indicateur glissant, info-bulles), panneau des moteurs au survol ;
 * - en-tête en éléments de verre séparés : recherche, langue et monnaie, thème, carte utilisateur ;
 * - sur mobile : barre de navigation flottante en bas et panneau des moteurs.
 * Les pages apparaissent avec une transition douce à chaque changement de route.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookMarked, Boxes, ChevronDown, History, LayoutDashboard, LogOut, Moon, Search, Sun, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useCatalogue, useSession } from '@/hooks/useDonnees';
import { useTheme } from '@/hooks/useTheme';
import { apparence, pastille } from '@/lib/moteurs';
import { cn } from '@/lib/utils';
import { PaletteCommandes } from './PaletteCommandes';
import { MenuPreferences } from './Preferences';
import { useT } from '@/lib/i18n';
import { LogoVision, MARQUE, MonogrammeVision } from '@/components/Marque';

/** « Compte de démonstration » → « CD » ; un seul mot → ses deux premières lettres. */
const initiales = (nom: string) => {
  const mots = nom.trim().split(/\s+/).filter((m) => m.length > 2 || /^[A-ZÀ-Ý]/.test(m));
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : nom.slice(0, 2)).toUpperCase();
};

/** Lueurs du fond, en mouvement lent (immobiles si l'utilisateur limite les animations). */
function Scene() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -right-40 -top-40 size-[42rem] rounded-full bg-[hsl(276_80%_55%/.18)] blur-[140px] animate-derive dark:bg-[hsl(276_70%_45%/.28)]" />
      <div className="absolute -bottom-52 -left-40 size-[38rem] rounded-full bg-[hsl(318_85%_60%/.14)] blur-[140px] animate-derive [animation-delay:-7s] dark:bg-[hsl(310_70%_45%/.22)]" />
      <div className="absolute left-1/3 top-1/3 size-[28rem] rounded-full bg-[hsl(250_80%_60%/.10)] blur-[130px] animate-derive [animation-delay:-12s] dark:bg-[hsl(250_70%_50%/.16)]" />
    </div>
  );
}

type Rubrique = 'accueil' | 'moteurs' | 'historique' | 'baremes';
const rubriqueDe = (chemin: string): Rubrique =>
  chemin.startsWith('/historique') ? 'historique' : chemin.startsWith('/baremes') ? 'baremes' : chemin.startsWith('/moteur') || chemin.startsWith('/calcul') ? 'moteurs' : 'accueil';

/** Liste des moteurs (panneau latéral sur ordinateur, feuille du bas sur mobile). */
function ListeMoteurs({ onChoisir }: { onChoisir?: () => void }) {
  const { moteurs, formules } = useCatalogue();
  const { t, nomMoteur } = useT();
  const loc = useLocation();
  return (
    <div>
      <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-attenue">{t('nav.moteurs', { n: formules.length })}</p>
      <div className="grid gap-0.5">
        {moteurs.map((m, i) => {
          const a = apparence(m.code);
          const actif = loc.pathname.startsWith(`/moteur/${m.code}`) || loc.pathname.startsWith(`/calcul/${m.code}/`);
          return (
            <Link
              key={m.code}
              to={`/moteur/${m.code}`}
              onClick={onChoisir}
              className={cn('group flex items-center gap-2.5 rounded-2xl px-2 py-1.5 text-[13.5px] transition-all duration-300 animate-montee', actif ? 'bg-surface-2 font-semibold text-texte' : 'text-attenue hover:bg-surface-2 hover:text-texte')}
              style={{ animationDelay: `${i * 18}ms` }}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110" style={pastille(a.teinte)}>
                <a.icone className="size-4" />
              </span>
              <span className="flex-1 truncate">{nomMoteur(m)}</span>
              <span className="chiffre text-[11px] text-attenue">{m.formules.length}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const PAS = 52; // hauteur d'un bouton de la barre (44 px) + espacement (8 px)

function Bulle({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 ml-4 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-xl border border-bordure bg-surface-pleine px-2.5 py-1 text-[12px] font-medium text-texte opacity-0 shadow-flottant transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
      {children}
    </span>
  );
}

function BarreLaterale({ ouvrirPalette }: { ouvrirPalette: () => void }) {
  const { t } = useT();
  const loc = useLocation();
  const rubrique = rubriqueDe(loc.pathname);
  const [moteursOuverts, setMoteursOuverts] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const minuterie = useRef<number>();
  const declencheur = useRef<HTMLDivElement>(null);
  // Le panneau est rendu hors de la barre (portail) : un flou d'arrière-plan ne s'applique pas dans un autre.
  const ouvrir = () => {
    clearTimeout(minuterie.current);
    const r = declencheur.current?.getBoundingClientRect();
    if (r) setPosition({ top: r.top + r.height / 2, left: r.right + 22 });
    setMoteursOuverts(true);
  };
  const fermerBientot = () => {
    minuterie.current = window.setTimeout(() => setMoteursOuverts(false), 220);
  };
  useEffect(() => {
    setMoteursOuverts(false);
  }, [loc.pathname]);

  const elements: { id: Rubrique; to?: string; icone: React.ReactNode; libelle: string }[] = [
    { id: 'accueil', to: '/', icone: <LayoutDashboard className="size-[19px]" />, libelle: t('nav.tableauDeBord') },
    { id: 'moteurs', icone: <Boxes className="size-[19px]" />, libelle: t('nav.moteursCourt') },
    { id: 'historique', to: '/historique', icone: <History className="size-[19px]" />, libelle: t('nav.historique') },
    { id: 'baremes', to: '/baremes', icone: <BookMarked className="size-[19px]" />, libelle: t('nav.baremes') },
  ];
  const index = elements.findIndex((e) => e.id === rubrique);
  const bouton = 'relative z-10 grid size-11 place-items-center rounded-full transition-colors duration-300';

  return (
    <aside className="fixed left-5 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
      <nav className="carte flex flex-col items-center gap-3 rounded-full p-2" aria-label="Navigation">
        <Link to="/" className="grid size-11 place-items-center" aria-label="Comptapilot">
          <LogoVision className="size-10 rounded-full ring-1 ring-white/10" />
        </Link>
        <div className="h-px w-7 bg-bordure" />
        <div className="relative flex flex-col gap-2">
          {/* Indicateur de la rubrique active : glisse d'un bouton à l'autre. */}
          <span
            aria-hidden
            className="absolute left-0 top-0 size-11 rounded-full bg-surface-2 shadow-[inset_0_1px_0_hsl(0_0%_100%/.14),0_8px_22px_-8px_hsl(var(--accent)/.7)] ring-1 ring-accent/30 transition-transform duration-500 [transition-timing-function:cubic-bezier(.3,1.3,.5,1)]"
            style={{ transform: `translateY(${index * PAS}px)` }}
          />
          {elements.map((e) => {
            const actif = e.id === rubrique;
            const classe = cn(bouton, actif ? 'text-texte' : 'text-attenue hover:text-texte');
            if (e.id === 'moteurs')
              return (
                <div key={e.id} ref={declencheur} className="group relative" onMouseEnter={ouvrir} onMouseLeave={fermerBientot}>
                  <button className={classe} onClick={() => (moteursOuverts ? setMoteursOuverts(false) : ouvrir())} aria-label={e.libelle} aria-expanded={moteursOuverts}>
                    {e.icone}
                  </button>
                  {!moteursOuverts && <Bulle>{e.libelle}</Bulle>}
                  {moteursOuverts &&
                    position &&
                    createPortal(
                      <div
                        className="fixed z-50 w-[300px] animate-in fade-in slide-in-from-left-2"
                        style={{ top: position.top, left: position.left, transform: 'translateY(-50%)' }}
                        onMouseEnter={ouvrir}
                        onMouseLeave={fermerBientot}
                      >
                        <div className="carte carte-pleine max-h-[80vh] overflow-y-auto p-3 shadow-flottant barre-defilement">
                          <ListeMoteurs />
                        </div>
                      </div>,
                      document.body,
                    )}
                </div>
              );
            return (
              <NavLink key={e.id} to={e.to!} end={e.id === 'accueil'} className={cn('group', classe)} aria-label={e.libelle}>
                {e.icone}
                <Bulle>{e.libelle}</Bulle>
              </NavLink>
            );
          })}
        </div>
        <div className="h-px w-7 bg-bordure" />
        <button onClick={ouvrirPalette} className={cn('group text-attenue hover:text-texte', bouton)} aria-label={t('nav.rechercher')}>
          <Search className="size-[19px]" />
          <Bulle>
            {t('nav.rechercher')} <kbd className="ml-1 font-mono text-[10.5px] text-attenue">Ctrl K</kbd>
          </Bulle>
        </button>
      </nav>
    </aside>
  );
}

function BarreMobile({ ouvrirPalette }: { ouvrirPalette: () => void }) {
  const { t } = useT();
  const loc = useLocation();
  const rubrique = rubriqueDe(loc.pathname);
  const [feuille, setFeuille] = useState(false);
  useEffect(() => {
    setFeuille(false);
  }, [loc.pathname]);
  const item = (actif: boolean) => cn('flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10.5px] font-medium transition-all duration-300', actif ? 'bg-surface-2 text-texte' : 'text-attenue');
  return (
    <>
      {feuille && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setFeuille(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" />
          <div className="carte carte-pleine absolute inset-x-3 bottom-24 max-h-[70vh] overflow-y-auto p-3 animate-in slide-in-from-bottom-4 fade-in" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-3 rounded-full p-1.5 text-attenue hover:bg-surface-2" onClick={() => setFeuille(false)} aria-label={t('nav.fermerMenu')}>
              <X className="size-4" />
            </button>
            <ListeMoteurs onChoisir={() => setFeuille(false)} />
          </div>
        </div>
      )}
      <nav className="carte fixed inset-x-3 bottom-3 z-40 flex items-center gap-1 rounded-full p-1.5 lg:hidden" aria-label="Navigation">
        <Link to="/" className={item(rubrique === 'accueil')}>
          <LayoutDashboard className="size-5" />
          {t('nav.accueilCourt')}
        </Link>
        <button onClick={() => setFeuille((f) => !f)} className={item(rubrique === 'moteurs' || feuille)}>
          <Boxes className="size-5" />
          {t('nav.moteursCourt')}
        </button>
        <button onClick={ouvrirPalette} className={item(false)}>
          <Search className="size-5" />
          {t('nav.rechercheCourt')}
        </button>
        <Link to="/historique" className={item(rubrique === 'historique')}>
          <History className="size-5" />
          {t('nav.historiqueCourt')}
        </Link>
        <Link to="/baremes" className={item(rubrique === 'baremes')}>
          <BookMarked className="size-5" />
          {t('nav.baremesCourt')}
        </Link>
      </nav>
    </>
  );
}

function CarteUtilisateur() {
  const { data: session } = useSession();
  const { t } = useT();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const nav = useNavigate();
  useEffect(() => {
    if (!ouvert) return;
    const f = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOuvert(false);
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [ouvert]);
  if (!session) return null;
  const u = session.utilisateur;
  const deconnexion = async () => {
    await api('/auth/deconnexion', { method: 'POST' });
    qc.clear();
    nav('/connexion');
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOuvert((o) => !o)} className="carte flex h-12 items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-2 transition-all duration-300 hover:border-accent/40 sm:pr-3" aria-expanded={ouvert} aria-label={u.nom}>
        <span className="grid size-9 place-items-center rounded-xl degrade-accent text-xs font-bold text-white">{initiales(u.nom)}</span>
        <span className="hidden min-w-0 text-left leading-tight md:block">
          <span className="block max-w-[180px] truncate text-[13px] font-semibold">{u.nom}</span>
          <span className="block max-w-[180px] truncate text-[11.5px] text-attenue">{u.email}</span>
        </span>
        <ChevronDown className={cn('hidden size-4 text-attenue transition-transform duration-300 sm:block', ouvert && 'rotate-180')} />
      </button>
      {ouvert && (
        <div className="carte carte-pleine absolute right-0 top-14 z-40 w-64 p-2 shadow-flottant animate-in fade-in slide-in-from-top-1">
          <div className="px-3 py-2">
            <p className="truncate text-[13.5px] font-semibold">{u.nom}</p>
            <p className="truncate text-[12px] text-attenue">{u.email}</p>
            {u.telephone && <p className="truncate text-[12px] text-attenue">{u.telephone}</p>}
            <p className="mt-1.5 inline-flex rounded-full bg-accent-doux px-2 py-0.5 text-[11px] font-semibold text-accent-texte">{t(`role.${u.role}`)}</p>
          </div>
          <div className="my-1 h-px bg-bordure" />
          <button onClick={deconnexion} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger/10">
            <LogOut className="size-4" /> {t('nav.deconnexion')}
          </button>
        </div>
      )}
    </div>
  );
}

export function Gabarit() {
  const { sombre, basculer } = useTheme();
  const { t } = useT();
  const [palette, setPalette] = useState(false);
  const loc = useLocation();

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
  // Retour en haut de page à chaque changement de route.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  const boutonVerre = 'carte place-items-center rounded-2xl text-attenue transition-all duration-300 hover:border-accent/40 hover:text-texte';

  return (
    <div className="relative min-h-screen">
      <Scene />
      <BarreLaterale ouvrirPalette={() => setPalette(true)} />
      <div className="lg:pl-[104px]">
        <header className="sticky top-0 z-20 bg-gradient-to-b from-[hsl(var(--fond)/.85)] via-[hsl(var(--fond)/.55)] to-transparent px-3 pb-3 pt-3 sm:px-6 sm:pt-4 lg:pr-8">
          <div className="mx-auto flex max-w-[1500px] items-center gap-2.5 sm:gap-3">
            <Link to="/" className="shrink-0 lg:hidden" aria-label="Comptapilot">
              <LogoVision className="size-11 ring-1 ring-white/10" />
            </Link>
            <button
              onClick={() => setPalette(true)}
              className="carte flex h-12 min-w-0 max-w-xl flex-1 items-center gap-3 rounded-2xl px-4 text-[14px] text-attenue transition-all duration-300 hover:border-accent/40"
            >
              <Search className="size-[18px] shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{t('nav.rechercher')}</span>
              <kbd className="hidden rounded-lg border border-bordure px-1.5 py-0.5 font-mono text-[11px] sm:block">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <MenuPreferences />
              <button onClick={basculer} className={cn(boutonVerre, 'hidden size-12 shrink-0 sm:grid')} aria-label={t('nav.theme')} title={t('nav.theme')}>
                {sombre ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </button>
              <CarteUtilisateur />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-3 pb-28 pt-2 sm:px-6 lg:pb-10 lg:pr-8">
          {/* Transition de page : chaque changement de route rejoue l'apparition. */}
          <div key={loc.pathname} className="animate-page">
            <Outlet />
          </div>
          <p className="mt-10 flex items-center justify-center gap-2 text-[11.5px] text-attenue">
            <MonogrammeVision className="size-3.5 text-texte" />© {new Date().getFullYear()} {MARQUE.societe}
          </p>
        </main>
      </div>
      <BarreMobile ouvrirPalette={() => setPalette(true)} />
      <PaletteCommandes ouvert={palette} onFermer={() => setPalette(false)} />
    </div>
  );
}
